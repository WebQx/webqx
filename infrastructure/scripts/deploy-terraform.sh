#!/bin/bash

# WebQX Healthcare Platform - Terraform Deployment Script
# This script deploys the infrastructure using Terraform

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

echo -e "${BLUE}🏥 WebQX Healthcare Platform - Terraform Deployment${NC}"
echo -e "${BLUE}=================================================${NC}"
echo ""
echo -e "Environment: ${GREEN}${ENVIRONMENT}${NC}"
echo -e "AWS Region: ${GREEN}${AWS_REGION}${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

if ! command -v terraform &> /dev/null; then
    echo -e "${RED}❌ Terraform is not installed${NC}"
    exit 1
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

# Navigate to terraform directory
cd "$(dirname "$0")/../terraform"

# Initialize Terraform
echo -e "${YELLOW}🔧 Initializing Terraform...${NC}"
terraform init

# Validate configuration
echo -e "${YELLOW}🔍 Validating Terraform configuration...${NC}"
terraform validate

# Plan deployment
echo -e "${YELLOW}📋 Planning deployment...${NC}"
terraform plan \
    -var="environment=${ENVIRONMENT}" \
    -var="aws_region=${AWS_REGION}" \
    -out=tfplan

echo ""
echo -e "${YELLOW}⚠️  Please review the plan above carefully.${NC}"
read -p "Do you want to apply these changes? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🚀 Applying Terraform configuration...${NC}"
    terraform apply tfplan
    
    echo ""
    echo -e "${GREEN}✅ Infrastructure deployment completed!${NC}"
    echo ""
    
    # Display outputs
    echo -e "${BLUE}📊 Infrastructure Outputs:${NC}"
    terraform output
    
    echo ""
    echo -e "${GREEN}🎉 WebQX Healthcare Platform infrastructure is now deployed!${NC}"
    echo -e "${BLUE}Next steps:${NC}"
    echo -e "1. Configure your application secrets in AWS Secrets Manager"
    echo -e "2. Deploy your Lambda functions"
    echo -e "3. Set up monitoring and alerting"
    echo -e "4. Configure your domain and SSL certificates"
    
else
    echo -e "${YELLOW}⏹️  Deployment cancelled${NC}"
    rm -f tfplan
fi