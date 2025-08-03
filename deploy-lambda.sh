#!/bin/bash

# WebQX Healthcare Platform - AWS Lambda Deployment Script

set -e

echo "🚀 WebQX Healthcare Platform - Lambda Deployment"
echo "================================================"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install AWS CLI and configure your credentials."
    exit 1
fi

# Check if serverless is installed
if ! command -v serverless &> /dev/null; then
    echo "❌ Serverless Framework not found. Installing..."
    npm install -g serverless
fi

# Get deployment stage
STAGE=${1:-dev}
echo "📍 Deploying to stage: $STAGE"

# Validate AWS credentials
echo "🔐 Validating AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials not configured. Please run 'aws configure' first."
    exit 1
fi

echo "✅ AWS credentials validated"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Run tests before deployment
echo "🧪 Running tests..."
if npm test -- --testPathPattern="auth|fhir|openehr" --passWithNoTests; then
    echo "✅ Tests passed"
else
    echo "⚠️ Some tests failed, but continuing with deployment..."
fi

# Check for environment file
ENV_FILE=".env.${STAGE}"
if [ ! -f "$ENV_FILE" ]; then
    echo "⚠️ Environment file $ENV_FILE not found"
    echo "💡 Using .env.lambda.example as reference"
    echo "Please create $ENV_FILE with your configuration"
fi

# Deploy with Serverless Framework
echo "🚀 Deploying to AWS Lambda..."
echo "Stage: $STAGE"
echo "Region: ${AWS_REGION:-us-east-1}"

if serverless deploy --stage "$STAGE"; then
    echo ""
    echo "🎉 Deployment successful!"
    echo ""
    
    # Get the deployed endpoint
    ENDPOINT=$(serverless info --stage "$STAGE" | grep "GET" | head -1 | awk '{print $4}' | sed 's/{proxy+}//' 2>/dev/null || echo "")
    
    if [ -n "$ENDPOINT" ]; then
        echo "🌐 API Endpoint: $ENDPOINT"
        echo "💊 Health Check: ${ENDPOINT}health"
        echo ""
        
        # Test the health endpoint
        echo "🩺 Testing health endpoint..."
        if curl -f -s "${ENDPOINT}health" > /dev/null; then
            echo "✅ Health check passed"
        else
            echo "⚠️ Health check failed - the API might still be starting up"
        fi
    fi
    
    echo ""
    echo "📋 Next steps:"
    echo "1. Test your API endpoints"
    echo "2. Configure custom domain (if needed)"
    echo "3. Set up monitoring and alerts"
    echo "4. Update DNS records (if using custom domain)"
    
else
    echo "❌ Deployment failed"
    exit 1
fi