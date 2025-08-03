#!/bin/bash

# WebQx Healthcare Platform - Quick Lambda Deployment Script
# This script provides a streamlined deployment process for AWS Lambda

set -e

echo "🏥 WebQx Healthcare Platform - AWS Lambda Quick Deploy"
echo "======================================================"

# Configuration
ENVIRONMENT=${1:-dev}
FUNCTION_NAME="webqx-healthcare-platform-${ENVIRONMENT}"
REGION=${AWS_DEFAULT_REGION:-us-east-1}
STACK_NAME="webqx-lambda-${ENVIRONMENT}"

echo "📋 Deployment Configuration:"
echo "   Environment: ${ENVIRONMENT}"
echo "   Function Name: ${FUNCTION_NAME}"
echo "   Region: ${REGION}"
echo "   Stack Name: ${STACK_NAME}"
echo ""

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install AWS CLI first."
    exit 1
fi

if ! command -v sam &> /dev/null; then
    echo "⚠️ AWS SAM CLI is not installed. Installing via pip..."
    pip install aws-sam-cli || {
        echo "❌ Failed to install SAM CLI. Please install manually."
        exit 1
    }
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18.x first."
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials not configured. Please run 'aws configure' first."
    exit 1
fi

echo "✅ Prerequisites check completed"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install || {
    echo "❌ Failed to install npm dependencies"
    exit 1
}

# Build Lambda package
echo "🏗️ Building Lambda package..."
npm run lambda:build || {
    echo "❌ Failed to build Lambda package"
    exit 1
}

# Deploy using SAM
echo "🚀 Deploying to AWS Lambda..."

# Build with SAM
sam build || {
    echo "❌ SAM build failed"
    exit 1
}

# Deploy with SAM
if sam list stack-outputs --stack-name $STACK_NAME --region $REGION &> /dev/null; then
    echo "📝 Stack exists, updating..."
    sam deploy --stack-name $STACK_NAME --region $REGION --no-confirm-changeset
else
    echo "🆕 Creating new stack..."
    sam deploy --guided --stack-name $STACK_NAME --region $REGION
fi

# Get the API Gateway URL
API_URL=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`WebQxApiUrl`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [ -n "$API_URL" ]; then
    echo ""
    echo "✅ Deployment completed successfully!"
    echo ""
    echo "🌐 Your WebQx Healthcare Platform is available at:"
    echo "   ${API_URL}"
    echo ""
    echo "🩺 Health check endpoint:"
    echo "   ${API_URL}health"
    echo ""
    echo "🔧 To test the deployment:"
    echo "   curl ${API_URL}health"
    echo ""
else
    echo "⚠️ Deployment completed but could not retrieve API URL"
    echo "   Check AWS Console for the API Gateway endpoint"
fi

# Show next steps
echo "📋 Next Steps:"
echo "1. Configure environment variables in AWS Lambda console"
echo "2. Set up database connection (RDS/RDS Proxy)"
echo "3. Configure OAuth2 and authentication providers"
echo "4. Upload static files to S3 (if using separate static hosting)"
echo "5. Set up custom domain (optional)"
echo "6. Configure monitoring and alerts"
echo ""
echo "📚 For detailed configuration, see LAMBDA_DEPLOYMENT.md"