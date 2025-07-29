#!/bin/bash

# WebQx Healthcare Platform Rollback Script
# Version: 1.0.0
# Description: Automated rollback script for WebQx deployments

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROLLBACK_LOG="/var/log/webqx-rollback.log"
PROJECT_NAME="webqx-healthcare-platform"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "${ROLLBACK_LOG}"
}

log_info() {
    log "INFO" "$*"
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    log "SUCCESS" "$*"
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warning() {
    log "WARNING" "$*"
    echo -e "${YELLOW}[WARNING]${NC} $*"
}

log_error() {
    log "ERROR" "$*"
    echo -e "${RED}[ERROR]${NC} $*"
}

# Check if backup exists
check_backup_availability() {
    log_info "Checking backup availability..."
    
    if [[ ! -f "${SCRIPT_DIR}/.last_backup" ]]; then
        log_error "No backup information found. Cannot perform rollback."
        exit 1
    fi
    
    local backup_path=$(cat "${SCRIPT_DIR}/.last_backup")
    
    if [[ ! -d "$backup_path" ]]; then
        log_error "Backup directory not found: $backup_path"
        exit 1
    fi
    
    log_success "Backup found at: $backup_path"
    echo "$backup_path"
}

# Stop current application
stop_application() {
    log_info "Stopping current application..."
    
    # Try PM2 first
    if command -v pm2 &> /dev/null; then
        pm2 stop "$PROJECT_NAME" 2>/dev/null || log_info "No PM2 process to stop"
        pm2 delete "$PROJECT_NAME" 2>/dev/null || log_info "No PM2 process to delete"
    fi
    
    # Try systemd service
    if systemctl is-active --quiet webqx 2>/dev/null; then
        sudo systemctl stop webqx
        log_info "Stopped systemd service"
    fi
    
    # Kill any remaining Node.js processes for this project
    local app_pid_file="${SCRIPT_DIR}/app.pid"
    if [[ -f "$app_pid_file" ]]; then
        local app_pid=$(cat "$app_pid_file")
        if kill -0 "$app_pid" 2>/dev/null; then
            kill "$app_pid"
            rm -f "$app_pid_file"
            log_info "Stopped application process: $app_pid"
        fi
    fi
    
    log_success "Application stopped"
}

# Restore from backup
restore_backup() {
    local backup_path=$1
    log_info "Restoring from backup: $backup_path"
    
    # Create a backup of current state before rollback
    local pre_rollback_backup="/var/backups/webqx/pre_rollback_$(date '+%Y%m%d_%H%M%S')"
    sudo mkdir -p "$(dirname "$pre_rollback_backup")"
    sudo cp -r "${SCRIPT_DIR}" "$pre_rollback_backup"
    log_info "Created pre-rollback backup at: $pre_rollback_backup"
    
    # Restore application files
    rsync -av --delete "$backup_path/" "${SCRIPT_DIR}/"
    log_info "Application files restored"
    
    # Restore to deployment directory if different
    local deploy_dir="/opt/webqx"
    if [[ -d "$deploy_dir" && "$deploy_dir" != "$SCRIPT_DIR" ]]; then
        sudo rsync -av --delete "$backup_path/" "$deploy_dir/"
        sudo chown -R webqx:webqx "$deploy_dir" 2>/dev/null || sudo chown -R $USER:$USER "$deploy_dir"
        log_info "Deployment directory restored"
    fi
    
    log_success "Backup restoration completed"
}

# Restore database (if backup exists)
restore_database() {
    local backup_path=$1
    log_info "Checking for database backup..."
    
    local db_backup=$(find "$backup_path" -name "database_*.sql" | head -1)
    
    if [[ -n "$db_backup" && -f "$db_backup" ]]; then
        log_warning "Database backup found: $db_backup"
        log_warning "Database rollback requires manual intervention for safety"
        log_warning "Please review and manually restore database if needed"
        log_warning "Command: psql \$DATABASE_URL < $db_backup"
    else
        log_info "No database backup found - skipping database rollback"
    fi
}

# Start application
start_application() {
    log_info "Starting application..."
    
    cd "${SCRIPT_DIR}"
    
    # Install dependencies
    npm ci --production --silent
    
    # Start with PM2 if available
    if command -v pm2 &> /dev/null; then
        pm2 start server.js --name "$PROJECT_NAME"
        pm2 save
        log_info "Started application with PM2"
    elif systemctl list-unit-files webqx.service &>/dev/null; then
        sudo systemctl start webqx
        log_info "Started application with systemd"
    else
        # Start directly in background
        nohup node server.js > /dev/null 2>&1 &
        echo $! > "${SCRIPT_DIR}/app.pid"
        log_info "Started application directly"
    fi
    
    log_success "Application started"
}

# Verify rollback
verify_rollback() {
    log_info "Verifying rollback..."
    
    local health_url="${HEALTH_CHECK_URL:-http://localhost:3000/health}"
    local max_attempts=15
    local attempt=0
    
    # Wait for application to start
    sleep 5
    
    while [[ $attempt -lt $max_attempts ]]; do
        if curl -s -f "$health_url" > /dev/null 2>&1; then
            log_success "Health check passed - rollback verified"
            
            # Get version info if available
            local health_response=$(curl -s "$health_url" 2>/dev/null || echo '{}')
            log_info "Health check response: $health_response"
            return 0
        fi
        
        log_info "Verification attempt $((attempt + 1))/$max_attempts..."
        sleep 3
        ((attempt++))
    done
    
    log_error "Rollback verification failed - application not responding"
    return 1
}

# Send notifications
send_notifications() {
    local status=$1
    log_info "Sending rollback notifications..."
    
    # Slack notification (if webhook is configured)
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local message
        local color
        
        if [[ "$status" == "success" ]]; then
            message="🔄 WebQx Healthcare Platform rollback completed successfully"
            color="good"
        else
            message="❌ WebQx Healthcare Platform rollback failed"
            color="danger"
        fi
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$message\",\"color\":\"$color\"}" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || log_warning "Failed to send Slack notification"
    fi
    
    # Email notification (if configured)
    if command -v mail &> /dev/null && [[ -n "${NOTIFICATION_EMAIL:-}" ]]; then
        local subject="WebQx Rollback Notification"
        local body="Rollback operation completed with status: $status"
        echo "$body" | mail -s "$subject" "$NOTIFICATION_EMAIL" 2>/dev/null || log_warning "Failed to send email notification"
    fi
    
    log_success "Notifications sent"
}

# Main rollback function
main() {
    local start_time=$(date +%s)
    
    log_info "Starting WebQx Healthcare Platform rollback"
    
    # Ensure log directory exists
    sudo mkdir -p "$(dirname "$ROLLBACK_LOG")"
    sudo touch "$ROLLBACK_LOG"
    sudo chmod 666 "$ROLLBACK_LOG"
    
    # Check prerequisites
    if [[ $EUID -eq 0 ]]; then
        log_warning "Running rollback as root"
    fi
    
    # Get user confirmation
    echo -e "${YELLOW}WARNING: This will rollback the WebQx Healthcare Platform to the previous version.${NC}"
    echo -e "${YELLOW}This action cannot be undone automatically.${NC}"
    echo
    read -p "Are you sure you want to proceed? (yes/no): " confirmation
    
    if [[ "$confirmation" != "yes" ]]; then
        log_info "Rollback cancelled by user"
        exit 0
    fi
    
    # Perform rollback steps
    local backup_path
    backup_path=$(check_backup_availability)
    
    stop_application
    restore_backup "$backup_path"
    restore_database "$backup_path"
    start_application
    
    if verify_rollback; then
        local end_time=$(date +%s)
        local rollback_time=$((end_time - start_time))
        
        log_success "Rollback completed successfully in ${rollback_time}s"
        send_notifications "success"
        
        echo
        echo "======================================"
        echo "  WebQx Rollback Summary"
        echo "======================================"
        echo "Status: SUCCESS"
        echo "Rollback Time: ${rollback_time}s"
        echo "Restored from: $backup_path"
        echo "Health Check: PASSED"
        echo "======================================"
        echo
        
        exit 0
    else
        log_error "Rollback verification failed"
        send_notifications "failure"
        exit 1
    fi
}

# Script entry point
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi