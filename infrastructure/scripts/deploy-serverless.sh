#!/bin/bash

# WebQX Healthcare Platform - Serverless Framework Deployment Script
# This script deploys Lambda functions using Serverless Framework

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STAGE=${1:-dev}
AWS_REGION=${2:-us-east-1}

echo -e "${BLUE}🏥 WebQX Healthcare Platform - Serverless Deployment${NC}"
echo -e "${BLUE}=================================================${NC}"
echo ""
echo -e "Stage: ${GREEN}${STAGE}${NC}"
echo -e "AWS Region: ${GREEN}${AWS_REGION}${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi

if ! command -v serverless &> /dev/null; then
    echo -e "${YELLOW}📦 Installing Serverless Framework...${NC}"
    npm install -g serverless
fi

if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed${NC}"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"
echo ""

# Navigate to serverless directory
cd "$(dirname "$0")/../serverless"

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install

# Create Lambda function directories if they don't exist
echo -e "${YELLOW}📁 Setting up Lambda function structure...${NC}"
mkdir -p ../../lambda/{patient-api,provider-api,admin-api,fhir-api,telehealth-api,auth-api,hl7-processor,audit-processor}
mkdir -p ../../lambda/layers/webqx-common

# Create placeholder handler files if they don't exist
FUNCTIONS=("patient-api" "provider-api" "admin-api" "fhir-api" "telehealth-api" "auth-api" "hl7-processor" "audit-processor")

for func in "${FUNCTIONS[@]}"; do
    if [ ! -f "../../lambda/${func}/index.js" ]; then
        echo -e "${YELLOW}📝 Creating placeholder handler for ${func}...${NC}"
        cat > "../../lambda/${func}/index.js" << EOF
exports.handler = async (event, context) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE'
        },
        body: JSON.stringify({
            message: 'WebQX Healthcare Platform - ${func} function',
            stage: process.env.STAGE,
            timestamp: new Date().toISOString()
        })
    };
};
EOF
    fi
done

# Create common layer if it doesn't exist
if [ ! -f "../../lambda/layers/webqx-common/package.json" ]; then
    echo -e "${YELLOW}📝 Creating common layer...${NC}"
    cat > "../../lambda/layers/webqx-common/package.json" << EOF
{
  "name": "webqx-common-layer",
  "version": "1.0.0",
  "description": "Common utilities for WebQX Healthcare Platform",
  "main": "index.js",
  "dependencies": {
    "aws-sdk": "^2.1500.0",
    "uuid": "^9.0.1",
    "jsonwebtoken": "^9.0.2"
  }
}
EOF
    
    cd "../../lambda/layers/webqx-common"
    npm install
    cd ../../../infrastructure/serverless
fi

# Package the common layer
echo -e "${YELLOW}📦 Packaging common layer...${NC}"
cd "../../lambda/layers"
if [ -f "webqx-common.zip" ]; then
    rm webqx-common.zip
fi
zip -r webqx-common.zip webqx-common/
cd ../../infrastructure/serverless

# Validate serverless configuration
echo -e "${YELLOW}🔍 Validating Serverless configuration...${NC}"
serverless print --stage ${STAGE} --region ${AWS_REGION}

echo ""
echo -e "${YELLOW}⚠️  This will deploy Lambda functions and associated resources.${NC}"
read -p "Do you want to proceed with deployment? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🚀 Deploying with Serverless Framework...${NC}"
    serverless deploy --stage ${STAGE} --region ${AWS_REGION} --verbose
    
    echo ""
    echo -e "${GREEN}✅ Serverless deployment completed!${NC}"
    echo ""
    
    # Display service information
    echo -e "${BLUE}📊 Service Information:${NC}"
    serverless info --stage ${STAGE} --region ${AWS_REGION}
    
    echo ""
    echo -e "${GREEN}🎉 WebQX Healthcare Platform Lambda functions are now deployed!${NC}"
    echo -e "${BLUE}Next steps:${NC}"
    echo -e "1. Test your API endpoints"
    echo -e "2. Configure monitoring and alerting"
    echo -e "3. Set up CI/CD pipelines"
    echo -e "4. Configure custom domains"
    
else
    echo -e "${YELLOW}⏹️  Deployment cancelled${NC}"
fi