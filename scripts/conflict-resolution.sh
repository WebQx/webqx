#!/bin/bash
#
# Automated Merge Conflict Resolution Script for WebQx Repository (Bash)
# =======================================================================
#
# This script handles merge conflicts according to the following rules:
# 1. Always prefer changes from the 'main' branch by default
# 2. Always preserve README.md from the source branch during conflicts
# 3. For JSON/config files, intelligently merge configurations by retaining unique keys from both branches
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Global variables
REPO_ROOT=""
CONFLICTS=()
RESOLVED_COUNT=0

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Get repository root
get_repo_root() {
    REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
    if [[ $? -ne 0 ]]; then
        log_error "Not in a git repository"
        exit 1
    fi
}

# Detect merge conflicts
detect_conflicts() {
    local conflict_files
    conflict_files=$(git diff --name-only --diff-filter=U 2>/dev/null || true)
    
    if [[ -n "$conflict_files" ]]; then
        # Convert to array
        while IFS= read -r line; do
            if [[ -n "$line" ]]; then
                CONFLICTS+=("$line")
            fi
        done <<< "$conflict_files"
    fi
    
    echo "${#CONFLICTS[@]}"
}

# Resolve README.md conflicts by preserving source branch content
resolve_readme_conflict() {
    local filepath="$1"
    
    # Check if it's a README.md file
    if [[ ! "$filepath" =~ [Rr][Ee][Aa][Dd][Mm][Ee]\.[Mm][Dd]$ ]]; then
        return 1
    fi
    
    log_info "Resolving README.md conflict: $filepath"
    
    # During a merge, we want to preserve the feature branch version
    # Get the merge head (MERGE_HEAD) which is the incoming branch
    if git show "MERGE_HEAD:$filepath" > "${REPO_ROOT}/${filepath}" 2>/dev/null; then
        # Stage the resolved file
        git add "$filepath"
        log_success "Preserved README.md from source branch: $filepath"
        return 0
    fi
    
    return 1
}

# Simple JSON merger using Python for better JSON handling
merge_json_files() {
    local filepath="$1"
    local main_content="$2"
    local head_content="$3"
    
    python3 -c "
import json
import sys

try:
    main_data = json.loads('''$main_content''')
    head_data = json.loads('''$head_content''')
    
    # Merge intelligently - start with main branch data
    if isinstance(main_data, dict) and isinstance(head_data, dict):
        merged_data = main_data.copy()
        # Add unique keys from head that don't exist in main
        for key, value in head_data.items():
            if key not in main_data:
                merged_data[key] = value
            elif isinstance(main_data[key], dict) and isinstance(value, dict):
                # Simple nested merge
                nested_merged = main_data[key].copy()
                for nested_key, nested_value in value.items():
                    if nested_key not in nested_merged:
                        nested_merged[nested_key] = nested_value
                merged_data[key] = nested_merged
    else:
        merged_data = main_data
    
    print(json.dumps(merged_data, indent=2, ensure_ascii=False))
except Exception as e:
    print('ERROR: ' + str(e), file=sys.stderr)
    sys.exit(1)
" 2>/dev/null
}

# Resolve JSON/config file conflicts intelligently
resolve_json_conflict() {
    local filepath="$1"
    
    # Check if it's a JSON or config file
    if [[ ! "$filepath" =~ \.(json)$ ]] && [[ ! "$filepath" =~ [Cc][Oo][Nn][Ff][Ii][Gg] ]]; then
        return 1
    fi
    
    log_info "Resolving JSON/config conflict: $filepath"
    
    # Get content from both branches
    # HEAD is the current branch, MERGE_HEAD is the incoming branch
    local main_content
    local head_content
    
    main_content=$(git show "HEAD:$filepath" 2>/dev/null) || return 1
    head_content=$(git show "MERGE_HEAD:$filepath" 2>/dev/null) || return 1
    
    # Try to merge using Python
    local merged_content
    merged_content=$(merge_json_files "$filepath" "$main_content" "$head_content")
    
    if [[ $? -eq 0 ]] && [[ -n "$merged_content" ]]; then
        # Write merged content
        echo "$merged_content" > "${REPO_ROOT}/${filepath}"
        
        # Stage the resolved file
        git add "$filepath"
        log_success "Intelligently merged JSON/config file: $filepath"
        return 0
    else
        log_error "Failed to merge JSON file $filepath"
        return 1
    fi
}

# Resolve conflicts by preferring main branch changes
resolve_default_conflict() {
    local filepath="$1"
    
    log_info "Resolving conflict using main branch preference: $filepath"
    
    # Get main branch version (current HEAD during merge)
    if git show "HEAD:$filepath" > "${REPO_ROOT}/${filepath}" 2>/dev/null; then
        # Stage the resolved file
        git add "$filepath"
        log_success "Resolved using main branch content: $filepath"
        return 0
    fi
    
    return 1
}

# Resolve all conflicts according to the rules
resolve_all_conflicts() {
    local conflict_count
    conflict_count=$(detect_conflicts)
    
    if [[ $conflict_count -eq 0 ]]; then
        log_info "No merge conflicts detected."
        return 0
    fi
    
    log_info "Found $conflict_count conflict(s) to resolve:"
    for conflict in "${CONFLICTS[@]}"; do
        echo "  - $conflict"
    done
    
    RESOLVED_COUNT=0
    
    for filepath in "${CONFLICTS[@]}"; do
        local resolved=false
        
        # Rule 2: Always preserve README.md from source branch
        if resolve_readme_conflict "$filepath"; then
            resolved=true
        # Rule 3: Intelligently merge JSON/config files
        elif resolve_json_conflict "$filepath"; then
            resolved=true
        # Rule 1: Default - prefer main branch
        elif resolve_default_conflict "$filepath"; then
            resolved=true
        fi
        
        if [[ "$resolved" == "true" ]]; then
            ((RESOLVED_COUNT++))
        else
            log_error "Failed to resolve conflict: $filepath"
        fi
    done
    
    log_info "Resolved $RESOLVED_COUNT/$conflict_count conflicts."
    
    if [[ $RESOLVED_COUNT -eq $conflict_count ]]; then
        return 0
    else
        return 1
    fi
}

# Commit the resolved changes
commit_resolution() {
    local message="${1:-Auto-resolve merge conflicts}"
    
    # Check if there are staged changes
    if [[ -z "$(git diff --cached --name-only)" ]]; then
        log_info "No changes to commit."
        return 0
    fi
    
    # Commit the changes
    if git commit -m "$message" >/dev/null 2>&1; then
        log_success "Committed resolved conflicts: $message"
        return 0
    else
        log_error "Failed to commit changes"
        return 1
    fi
}

# Main function
main() {
    echo -e "${BLUE}WebQx Automated Conflict Resolution (Bash)${NC}"
    echo -e "${BLUE}===========================================${NC}"
    echo
    
    # Get repository root
    get_repo_root
    
    # Change to repository root
    cd "$REPO_ROOT"
    
    # Resolve conflicts
    if resolve_all_conflicts; then
        # Commit the resolution
        if commit_resolution "Auto-resolve merge conflicts following WebQx rules"; then
            echo
            log_success "All conflicts resolved successfully!"
            exit 0
        else
            echo
            log_error "Failed to commit resolved conflicts"
            exit 1
        fi
    else
        echo
        log_error "Some conflicts could not be resolved automatically."
        exit 1
    fi
}

# Check if script is being run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi