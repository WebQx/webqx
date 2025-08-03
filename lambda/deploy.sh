#!/bin/bash

# WebQx GitHub Webhook Lambda Deployment Script
# This script deploys the Lambda function using AWS SAM

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
STAGE="prod"
STACK_NAME="webqx-github-webhook"
AWS_REGION="us-east-1"
S3_BUCKET=""
GITHUB_WEBHOOK_SECRET=""
SLACK_WEBHOOK_URL=""

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -s, --stage STAGE              Deployment stage (dev|staging|prod). Default: prod"
    echo "  -r, --region REGION           AWS region. Default: us-east-1"
    echo "  -b, --bucket BUCKET           S3 bucket for deployment artifacts (required)"
    echo "  -n, --stack-name NAME         CloudFormation stack name. Default: webqx-github-webhook"
    echo "  --github-secret SECRET        GitHub webhook secret (required)"
    echo "  --slack-webhook-url URL       Optional Slack webhook URL for notifications"
    echo "  -h, --help                    Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --bucket my-deployment-bucket --github-secret mysecret123"
    echo "  $0 --stage dev --bucket my-bucket --github-secret secret --slack-webhook-url https://hooks.slack.com/..."
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--stage)
            STAGE="$2"
            shift 2
            ;;
        -r|--region)
            AWS_REGION="$2"
            shift 2
            ;;
        -b|--bucket)
            S3_BUCKET="$2"
            shift 2
            ;;
        -n|--stack-name)
            STACK_NAME="$2"
            shift 2
            ;;
        --github-secret)
            GITHUB_WEBHOOK_SECRET="$2"
            shift 2
            ;;
        --slack-webhook-url)
            SLACK_WEBHOOK_URL="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Validate required parameters
if [[ -z "$S3_BUCKET" ]]; then
    print_error "S3 bucket is required. Use --bucket option."
    usage
    exit 1
fi

if [[ -z "$GITHUB_WEBHOOK_SECRET" ]]; then
    print_error "GitHub webhook secret is required. Use --github-secret option."
    usage
    exit 1
fi

# Validate stage
if [[ ! "$STAGE" =~ ^(dev|staging|prod)$ ]]; then
    print_error "Invalid stage: $STAGE. Must be one of: dev, staging, prod"
    exit 1
fi

# Update stack name with stage
FULL_STACK_NAME="${STACK_NAME}-${STAGE}"

print_status "Starting deployment..."
print_status "Stage: $STAGE"
print_status "Region: $AWS_REGION"
print_status "Stack Name: $FULL_STACK_NAME"
print_status "S3 Bucket: $S3_BUCKET"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if SAM CLI is installed
if ! command -v sam &> /dev/null; then
    print_error "AWS SAM CLI is not installed. Please install it first."
    print_error "Visit: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html"
    exit 1
fi

# Verify AWS credentials
print_status "Verifying AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured. Please run 'aws configure' first."
    exit 1
fi

# Check if S3 bucket exists
print_status "Checking S3 bucket..."
if ! aws s3 ls "s3://$S3_BUCKET" &> /dev/null; then
    print_warning "S3 bucket '$S3_BUCKET' does not exist or is not accessible."
    read -p "Would you like to create it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Creating S3 bucket..."
        if [[ "$AWS_REGION" == "us-east-1" ]]; then
            aws s3 mb "s3://$S3_BUCKET"
        else
            aws s3 mb "s3://$S3_BUCKET" --region "$AWS_REGION"
        fi
    else
        print_error "Deployment cancelled."
        exit 1
    fi
fi

# Navigate to lambda directory
cd "$(dirname "$0")"

# Build the application
print_status "Building SAM application..."
sam build

# Deploy the application
print_status "Deploying SAM application..."

DEPLOY_PARAMS=(
    --stack-name "$FULL_STACK_NAME"
    --s3-bucket "$S3_BUCKET"
    --region "$AWS_REGION"
    --capabilities CAPABILITY_IAM
    --parameter-overrides 
    "GitHubWebhookSecret=$GITHUB_WEBHOOK_SECRET"
    "Stage=$STAGE"
)

if [[ -n "$SLACK_WEBHOOK_URL" ]]; then
    DEPLOY_PARAMS+=("SlackWebhookUrl=$SLACK_WEBHOOK_URL")
fi

# Add confirm changeset for production
if [[ "$STAGE" == "prod" ]]; then
    DEPLOY_PARAMS+=(--confirm-changeset)
fi

sam deploy "${DEPLOY_PARAMS[@]}"

# Get the API Gateway URL
print_status "Getting deployment outputs..."
WEBHOOK_URL=$(aws cloudformation describe-stacks \
    --stack-name "$FULL_STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`GitHubWebhookApi`].OutputValue' \
    --output text)

if [[ -n "$WEBHOOK_URL" ]]; then
    print_status "Deployment completed successfully!"
    echo ""
    echo "============================================="
    echo "  GitHub Webhook Configuration"
    echo "============================================="
    echo ""
    echo "Webhook URL: $WEBHOOK_URL"
    echo ""
    echo "Configure this URL in your GitHub repository:"
    echo "1. Go to https://github.com/WebQx/webqx/settings/hooks"
    echo "2. Click 'Add webhook'"
    echo "3. Set Payload URL to: $WEBHOOK_URL"
    echo "4. Set Content type to: application/json"
    echo "5. Set Secret to your GitHub webhook secret"
    echo "6. Select events: Push, Pull requests, Issues"
    echo "7. Click 'Add webhook'"
    echo ""
    echo "============================================="
else
    print_error "Failed to retrieve webhook URL from stack outputs."
    exit 1
fi