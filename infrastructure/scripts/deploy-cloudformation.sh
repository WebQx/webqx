#!/bin/bash

# WebQX Healthcare Platform - CloudFormation Deployment Script
# This script deploys the infrastructure using AWS CloudFormation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-dev}
AWS_REGION=${2:-us-east-1}
PROJECT_NAME="webqx-healthcare"
STACK_NAME="${PROJECT_NAME}-${ENVIRONMENT}"

echo -e "${BLUE}🏥 WebQX Healthcare Platform - CloudFormation Deployment${NC}"
echo -e "${BLUE}======================================================${NC}"
echo ""
echo -e "Environment: ${GREEN}${ENVIRONMENT}${NC}"
echo -e "AWS Region: ${GREEN}${AWS_REGION}${NC}"
echo -e "Stack Name: ${GREEN}${STACK_NAME}${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

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

# Navigate to cloudformation directory
cd "$(dirname "$0")/../cloudformation"

# Validate template
echo -e "${YELLOW}🔍 Validating CloudFormation template...${NC}"
aws cloudformation validate-template \
    --template-body file://webqx-main.yaml \
    --region ${AWS_REGION}

echo -e "${GREEN}✅ Template validation passed${NC}"
echo ""

# Check if stack exists
STACK_EXISTS=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --region ${AWS_REGION} \
    --query 'Stacks[0].StackStatus' \
    --output text 2>/dev/null || echo "DOES_NOT_EXIST")

if [ "$STACK_EXISTS" = "DOES_NOT_EXIST" ]; then
    echo -e "${YELLOW}🚀 Creating new CloudFormation stack...${NC}"
    ACTION="create-stack"
else
    echo -e "${YELLOW}🔄 Updating existing CloudFormation stack...${NC}"
    ACTION="update-stack"
fi

# Deploy stack
aws cloudformation ${ACTION} \
    --stack-name ${STACK_NAME} \
    --template-body file://webqx-main.yaml \
    --parameters \
        ParameterKey=Environment,ParameterValue=${ENVIRONMENT} \
        ParameterKey=ProjectName,ParameterValue=${PROJECT_NAME} \
    --capabilities CAPABILITY_IAM \
    --region ${AWS_REGION} \
    --tags \
        Key=Project,Value="WebQX-Healthcare-Platform" \
        Key=Environment,Value=${ENVIRONMENT} \
        Key=ManagedBy,Value="CloudFormation"

echo -e "${YELLOW}⏳ Waiting for stack operation to complete...${NC}"

if [ "$ACTION" = "create-stack" ]; then
    aws cloudformation wait stack-create-complete \
        --stack-name ${STACK_NAME} \
        --region ${AWS_REGION}
else
    aws cloudformation wait stack-update-complete \
        --stack-name ${STACK_NAME} \
        --region ${AWS_REGION}
fi

echo ""
echo -e "${GREEN}✅ CloudFormation deployment completed!${NC}"
echo ""

# Display outputs
echo -e "${BLUE}📊 Stack Outputs:${NC}"
aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --region ${AWS_REGION} \
    --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
    --output table

echo ""
echo -e "${GREEN}🎉 WebQX Healthcare Platform infrastructure is now deployed!${NC}"
echo -e "${BLUE}Next steps:${NC}"
echo -e "1. Configure your application secrets in AWS Secrets Manager"
echo -e "2. Deploy your Lambda functions using Serverless Framework"
echo -e "3. Set up monitoring and alerting"
echo -e "4. Configure your domain and SSL certificates"