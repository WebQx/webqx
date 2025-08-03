#!/bin/bash

# Local testing script for GitHub Webhook Lambda function
# This script helps test the Lambda function locally using sample events

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to show usage
usage() {
    echo "Usage: $0 [EVENT_TYPE]"
    echo ""
    echo "Event Types:"
    echo "  push      - Test push event (default)"
    echo "  pr        - Test pull request event"  
    echo "  ping      - Test ping event"
    echo "  all       - Test all event types"
    echo ""
    echo "Examples:"
    echo "  $0 push"
    echo "  $0 pr"
    echo "  $0 all"
}

# Function to test specific event
test_event() {
    local event_type=$1
    local event_file="events/test-${event_type}-event.json"
    
    if [[ ! -f "$event_file" ]]; then
        echo "Error: Event file $event_file not found"
        return 1
    fi
    
    print_status "Testing $event_type event..."
    echo "Event file: $event_file"
    echo "----------------------------------------"
    
    # Invoke the function locally
    sam local invoke GitHubWebhookFunction -e "$event_file"
    
    echo "----------------------------------------"
    echo ""
}

# Check if SAM CLI is installed
if ! command -v sam &> /dev/null; then
    echo "Error: AWS SAM CLI is not installed."
    echo "Please install it from: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html"
    exit 1
fi

# Get the event type from command line argument
EVENT_TYPE=${1:-push}

# Change to lambda directory
cd "$(dirname "$0")"

# Ensure we have the necessary files
if [[ ! -f "template.yaml" ]]; then
    echo "Error: template.yaml not found. Make sure you're in the lambda directory."
    exit 1
fi

print_status "Starting local Lambda function testing..."

case $EVENT_TYPE in
    push)
        test_event "push"
        ;;
    pr)
        test_event "pr"
        ;;
    ping)
        test_event "ping"
        ;;
    all)
        test_event "ping"
        test_event "push"
        test_event "pr"
        ;;
    -h|--help)
        usage
        exit 0
        ;;
    *)
        echo "Error: Unknown event type: $EVENT_TYPE"
        usage
        exit 1
        ;;
esac

print_status "Local testing completed!"
echo ""
print_warning "Note: For full testing, set GITHUB_WEBHOOK_SECRET environment variable:"
echo "export GITHUB_WEBHOOK_SECRET=your-test-secret"