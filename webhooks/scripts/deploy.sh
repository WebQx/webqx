#!/bin/bash

# WebQX GitHub Webhooks Deployment Script
# This script automates the deployment of GitHub webhooks to AWS Lambda

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEBHOOK_DIR="$(dirname "$SCRIPT_DIR")"
LAMBDA_DIR="$WEBHOOK_DIR/lambda"
DEPLOYMENT_DIR="$WEBHOOK_DIR/deployment"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Print banner
echo ""
echo "🚀 WebQX GitHub Webhooks Deployment Script"
echo "==========================================="
echo ""

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed. Please install it first."
        echo "  macOS: brew install awscli"
        echo "  Ubuntu: sudo apt-get install awscli"
        echo "  Other: https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html"
        exit 1
    fi
    
    # Check if SAM CLI is installed
    if ! command -v sam &> /dev/null; then
        log_error "AWS SAM CLI is not installed. Please install it first."
        echo "  macOS: brew install aws-sam-cli"
        echo "  Other: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html"
        exit 1
    fi
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js version 18+ is required. Current version: $(node --version)"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured. Please run 'aws configure' first."
        exit 1
    fi
    
    log_success "All prerequisites met!"
}

# Install dependencies
install_dependencies() {
    log_info "Installing Lambda dependencies..."
    cd "$LAMBDA_DIR"
    npm install --production
    log_success "Dependencies installed!"
}

# Run tests
run_tests() {
    log_info "Running tests..."
    cd "$LAMBDA_DIR"
    if npm test; then
        log_success "All tests passed!"
    else
        log_error "Tests failed. Please fix issues before deploying."
        exit 1
    fi
}

# Build SAM application
build_sam() {
    log_info "Building SAM application..."
    cd "$WEBHOOK_DIR"
    if sam build --template-file deployment/template.yaml; then
        log_success "SAM build completed!"
    else
        log_error "SAM build failed."
        exit 1
    fi
}

# Deploy with SAM
deploy_sam() {
    log_info "Deploying with SAM..."
    
    # Check if this is first deployment
    STACK_NAME="webqx-github-webhooks"
    if aws cloudformation describe-stacks --stack-name "$STACK_NAME" &> /dev/null; then
        log_info "Stack exists, performing update..."
        sam deploy
    else
        log_info "First deployment, running guided setup..."
        sam deploy --guided
    fi
    
    if [ $? -eq 0 ]; then
        log_success "Deployment completed!"
        
        # Get outputs
        log_info "Retrieving deployment outputs..."
        WEBHOOK_URL=$(aws cloudformation describe-stacks \
            --stack-name "$STACK_NAME" \
            --query 'Stacks[0].Outputs[?OutputKey==`WebhookApiUrl`].OutputValue' \
            --output text)
        
        HEALTH_URL=$(aws cloudformation describe-stacks \
            --stack-name "$STACK_NAME" \
            --query 'Stacks[0].Outputs[?OutputKey==`HealthCheckUrl`].OutputValue' \
            --output text)
        
        echo ""
        echo "🎉 Deployment Complete!"
        echo "======================="
        echo ""
        echo "📡 Webhook URL: $WEBHOOK_URL"
        echo "🏥 Health Check: $HEALTH_URL"
        echo ""
        echo "Next steps:"
        echo "1. Configure GitHub webhook with the URL above"
        echo "2. Set webhook secret in GitHub settings"
        echo "3. Select events: push, pull_request, issues, releases"
        echo "4. Test with: curl $HEALTH_URL"
        echo ""
    else
        log_error "Deployment failed."
        exit 1
    fi
}

# Test deployment
test_deployment() {
    log_info "Testing deployment..."
    
    STACK_NAME="webqx-github-webhooks"
    HEALTH_URL=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --query 'Stacks[0].Outputs[?OutputKey==`HealthCheckUrl`].OutputValue' \
        --output text)
    
    if [ -n "$HEALTH_URL" ]; then
        log_info "Testing health endpoint: $HEALTH_URL"
        if curl -f -s "$HEALTH_URL" > /dev/null; then
            log_success "Health check passed!"
        else
            log_warning "Health check failed. The deployment may still be initializing."
        fi
    else
        log_warning "Could not retrieve health check URL."
    fi
}

# Cleanup function
cleanup() {
    log_info "Cleaning up temporary files..."
    cd "$LAMBDA_DIR"
    rm -rf node_modules/.cache 2>/dev/null || true
    log_success "Cleanup completed!"
}

# Main deployment flow
main() {
    # Parse command line arguments
    case "${1:-deploy}" in
        "check")
            check_prerequisites
            ;;
        "test")
            check_prerequisites
            install_dependencies
            run_tests
            ;;
        "build")
            check_prerequisites
            install_dependencies
            run_tests
            build_sam
            ;;
        "deploy")
            check_prerequisites
            install_dependencies
            run_tests
            build_sam
            deploy_sam
            test_deployment
            cleanup
            ;;
        "deploy-only")
            build_sam
            deploy_sam
            test_deployment
            ;;
        "destroy")
            log_warning "Destroying webhook infrastructure..."
            read -p "Are you sure you want to delete the webhook stack? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                aws cloudformation delete-stack --stack-name "webqx-github-webhooks"
                log_success "Stack deletion initiated."
            else
                log_info "Destruction cancelled."
            fi
            ;;
        "logs")
            FUNCTION_NAME=$(aws cloudformation describe-stacks \
                --stack-name "webqx-github-webhooks" \
                --query 'Stacks[0].Outputs[?OutputKey==`FunctionName`].OutputValue' \
                --output text)
            if [ -n "$FUNCTION_NAME" ]; then
                log_info "Showing recent logs for $FUNCTION_NAME..."
                sam logs --name "$FUNCTION_NAME" --tail
            else
                log_error "Could not find function name."
            fi
            ;;
        "help"|"--help"|"-h")
            echo "Usage: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  check        Check prerequisites only"
            echo "  test         Install dependencies and run tests"
            echo "  build        Build SAM application"
            echo "  deploy       Full deployment (default)"
            echo "  deploy-only  Deploy without tests (faster)"
            echo "  destroy      Delete the webhook infrastructure"
            echo "  logs         Show recent Lambda logs"
            echo "  help         Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                # Full deployment"
            echo "  $0 test          # Run tests only"
            echo "  $0 deploy-only   # Quick deployment"
            echo "  $0 logs          # View logs"
            ;;
        *)
            log_error "Unknown command: $1"
            echo "Use '$0 help' for available commands."
            exit 1
            ;;
    esac
}

# Handle script interruption
trap cleanup EXIT

# Run main function
main "$@"