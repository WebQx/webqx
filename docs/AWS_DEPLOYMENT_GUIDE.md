# AWS Deployment Guide for WebQX Healthcare Platform

This guide provides comprehensive instructions for deploying the WebQX Healthcare Platform to AWS using multiple deployment methods including Serverless Framework, AWS SAM, and Terraform.

## 🏗️ Architecture Overview

The WebQX Healthcare Platform is deployed as a serverless architecture on AWS with the following components:

- **API Gateway**: FHIR-compliant REST API endpoints
- **Lambda Functions**: Serverless compute for healthcare services
- **DynamoDB**: NoSQL database for patient data, appointments, and observations
- **S3**: Secure storage for healthcare files and audit logs
- **KMS**: Encryption keys for HIPAA compliance
- **CloudWatch**: Monitoring and logging
- **WAF**: Web application firewall for security
- **VPC**: Secure network isolation

## 🔧 Prerequisites

### Required Tools
- AWS CLI v2.x
- Node.js 18.x or later
- Serverless Framework CLI (optional)
- AWS SAM CLI (optional)
- Terraform CLI (optional)

### AWS Setup
1. **AWS Account**: Ensure you have an AWS account with appropriate permissions
2. **IAM User/Role**: Create IAM user with necessary permissions for deployment
3. **AWS CLI Configuration**: Configure AWS CLI with credentials

```bash
aws configure
# Enter your Access Key ID, Secret Access Key, region, and output format
```

### Required AWS Permissions
The deploying user/role needs the following AWS service permissions:
- Lambda (full access)
- API Gateway (full access)
- DynamoDB (full access)
- S3 (full access)
- KMS (full access)
- CloudWatch (full access)
- IAM (role creation and policy attachment)
- VPC (if using VPC deployment)
- CloudFormation (full access)

## 🚀 Deployment Methods

### Method 1: Serverless Framework

#### Installation
```bash
npm install -g serverless
```

#### Configuration
1. **Install Dependencies**:
```bash
npm install
```

2. **Configure Environment Variables**:
```bash
# Copy and edit the environment file
cp .env.example .env
# Edit .env with your specific values
```

3. **Set AWS SSM Parameters** (for secrets):
```bash
# JWT Secret
aws ssm put-parameter \
  --name "/webqx/dev/jwt-secret" \
  --value "your-secure-jwt-secret-32-characters" \
  --type "SecureString" \
  --key-id "alias/webqx-healthcare-dev"

# Encryption Key
aws ssm put-parameter \
  --name "/webqx/dev/encryption-key" \
  --value "your-encryption-key-for-hipaa-compliance" \
  --type "SecureString" \
  --key-id "alias/webqx-healthcare-dev"

# Whisper API Key (if using AI transcription)
aws ssm put-parameter \
  --name "/webqx/dev/whisper-api-key" \
  --value "your-openai-whisper-api-key" \
  --type "SecureString" \
  --key-id "alias/webqx-healthcare-dev"
```

#### Deployment Commands
```bash
# Deploy to development
serverless deploy --stage dev

# Deploy to staging
serverless deploy --stage staging

# Deploy to production
serverless deploy --stage prod --region us-east-1

# Deploy a specific function
serverless deploy function --function fhirPatients --stage dev

# Remove deployment
serverless remove --stage dev
```

#### Environment-Specific Deployment
```bash
# Development with debug logging
serverless deploy --stage dev --verbose

# Production with minimal logging
serverless deploy --stage prod --region us-east-1 --verbose
```

### Method 2: AWS SAM (Serverless Application Model)

#### Installation
```bash
# Install AWS SAM CLI
pip install aws-sam-cli
# Or using Homebrew on macOS
brew install aws-sam-cli
```

#### Configuration
1. **Create SAM Configuration**:
```bash
# Create samconfig.toml
cat > samconfig.toml << EOF
version = 0.1
[default]
[default.deploy]
[default.deploy.parameters]
stack_name = "webqx-healthcare-sam-dev"
s3_bucket = "webqx-sam-deployment-bucket"
s3_prefix = "webqx-healthcare"
region = "us-east-1"
capabilities = "CAPABILITY_IAM CAPABILITY_NAMED_IAM"
parameter_overrides = "Stage=dev VpcId=vpc-12345 PrivateSubnetIds=subnet-123,subnet-456"
EOF
```

#### Deployment Commands
```bash
# Build the application
sam build

# Deploy with guided prompts (first time)
sam deploy --guided

# Deploy with existing configuration
sam deploy

# Deploy to specific stage
sam deploy --parameter-overrides Stage=prod

# Local testing
sam local start-api

# Remove deployment
aws cloudformation delete-stack --stack-name webqx-healthcare-sam-dev
```

#### Testing SAM Locally
```bash
# Start API Gateway locally
sam local start-api --port 3001

# Test specific function
sam local invoke FHIRPatientsFunction --event test-events/patient-get.json

# Generate test events
sam local generate-event apigateway aws-proxy > test-events/api-proxy.json
```

### Method 3: Terraform

#### Installation
```bash
# Install Terraform
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/
```

#### Configuration
1. **Create Terraform Variables**:
```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your specific values
```

2. **Initialize Terraform**:
```bash
terraform init
```

3. **Plan Deployment**:
```bash
terraform plan
```

#### Deployment Commands
```bash
# Deploy infrastructure
terraform apply

# Deploy with auto-approve
terraform apply -auto-approve

# Deploy specific environment
terraform apply -var="environment=prod" -var="aws_region=us-east-1"

# Show current state
terraform show

# Destroy infrastructure
terraform destroy
```

#### Terraform Workspaces (Multi-Environment)
```bash
# Create workspace for different environments
terraform workspace new dev
terraform workspace new staging
terraform workspace new prod

# Switch workspace
terraform workspace select dev

# List workspaces
terraform workspace list
```

## 🔒 Security Configuration

### KMS Key Management
```bash
# Create KMS key for encryption
aws kms create-key \
  --description "WebQX Healthcare Platform HIPAA-compliant encryption key" \
  --key-usage ENCRYPT_DECRYPT \
  --key-spec SYMMETRIC_DEFAULT

# Create alias for the key
aws kms create-alias \
  --alias-name alias/webqx-healthcare-dev \
  --target-key-id <key-id-from-above>
```

### VPC Configuration (HIPAA Compliance)
For HIPAA compliance, Lambda functions should run in a VPC:

```bash
# Create VPC (if not using Terraform)
aws ec2 create-vpc --cidr-block 10.0.0.0/16 --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=webqx-healthcare-vpc}]'

# Create private subnets
aws ec2 create-subnet --vpc-id <vpc-id> --cidr-block 10.0.1.0/24 --availability-zone us-east-1a
aws ec2 create-subnet --vpc-id <vpc-id> --cidr-block 10.0.2.0/24 --availability-zone us-east-1b
```

### SSL Certificate
```bash
# Request SSL certificate for custom domain
aws acm request-certificate \
  --domain-name api.webqx.health \
  --subject-alternative-names "*.webqx.health" \
  --validation-method DNS \
  --region us-east-1
```

## 📊 Monitoring and Logging

### CloudWatch Dashboard
```bash
# Create CloudWatch dashboard
aws cloudwatch put-dashboard \
  --dashboard-name "WebQX-Healthcare-Platform" \
  --dashboard-body file://cloudwatch-dashboard.json
```

### CloudWatch Alarms
```bash
# Lambda error alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "WebQX-Lambda-Errors" \
  --alarm-description "Lambda function errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

## 🧪 Testing Deployment

### Health Check
```bash
# Test health endpoint
curl https://your-api-gateway-url/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "service": "WebQX Healthcare Platform",
  "databases": [...]
}
```

### FHIR API Testing
```bash
# Get test token (development only)
curl https://your-api-gateway-url/dev/token

# Test patient endpoint
curl -H "Authorization: Bearer <token>" \
     https://your-api-gateway-url/fhir/Patient

# Create patient
curl -X POST \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/fhir+json" \
     -d '{"resourceType":"Patient","name":[{"family":"Doe","given":["John"]}]}' \
     https://your-api-gateway-url/fhir/Patient
```

## 🔄 Environment Management

### Development Environment
```bash
# Deploy development environment
serverless deploy --stage dev

# Environment variables for development
export STAGE=dev
export LOG_LEVEL=debug
export CORS_ORIGIN=http://localhost:3000
```

### Staging Environment
```bash
# Deploy staging environment
serverless deploy --stage staging

# Environment variables for staging
export STAGE=staging
export LOG_LEVEL=info
export CORS_ORIGIN=https://staging.webqx.health
```

### Production Environment
```bash
# Deploy production environment
serverless deploy --stage prod --region us-east-1

# Environment variables for production
export STAGE=prod
export LOG_LEVEL=error
export CORS_ORIGIN=https://app.webqx.health
```

## 🔧 Troubleshooting

### Common Issues

1. **Permission Denied**:
```bash
# Check AWS credentials
aws sts get-caller-identity

# Check IAM permissions
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::account:user/username \
  --action-names lambda:CreateFunction \
  --resource-arns "*"
```

2. **VPC Configuration Issues**:
```bash
# Check VPC endpoints for DynamoDB
aws ec2 describe-vpc-endpoints --filters Name=service-name,Values=com.amazonaws.region.dynamodb
```

3. **Lambda Cold Starts**:
```bash
# Enable provisioned concurrency
aws lambda put-provisioned-concurrency-config \
  --function-name webqx-healthcare-platform-dev-fhirPatients \
  --provisioned-concurrency-config ProvisionedConcurrencyCount=5
```

### Debugging
```bash
# View CloudWatch logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/webqx"

# Tail logs
aws logs tail /aws/lambda/webqx-healthcare-platform-dev-fhirPatients --follow

# X-Ray tracing
aws xray get-trace-summaries --time-range-type TimeRangeByStartTime \
  --start-time 2024-01-15T00:00:00 \
  --end-time 2024-01-15T23:59:59
```

## 📈 Performance Optimization

### Lambda Optimization
```bash
# Set reserved concurrency
aws lambda put-reserved-concurrency-config \
  --function-name webqx-healthcare-platform-dev-fhirPatients \
  --reserved-concurrency-count 10

# Configure memory and timeout
aws lambda update-function-configuration \
  --function-name webqx-healthcare-platform-dev-fhirPatients \
  --memory-size 1024 \
  --timeout 30
```

### DynamoDB Optimization
```bash
# Enable auto-scaling
aws application-autoscaling register-scalable-target \
  --service-namespace dynamodb \
  --resource-id table/webqx-healthcare-patients-dev \
  --scalable-dimension dynamodb:table:WriteCapacityUnits \
  --min-capacity 5 \
  --max-capacity 100
```

## 🔐 HIPAA Compliance Checklist

- [ ] **Encryption at Rest**: All data encrypted using AWS KMS
- [ ] **Encryption in Transit**: All communications use TLS 1.2+
- [ ] **Access Controls**: IAM roles with least privilege
- [ ] **Audit Logging**: CloudTrail and application audit logs
- [ ] **Data Backup**: Automated backups with 7-year retention
- [ ] **Network Security**: VPC with private subnets
- [ ] **Monitoring**: CloudWatch alarms and dashboards
- [ ] **Incident Response**: Automated alerting and response procedures

## 📞 Support and Maintenance

### Regular Maintenance Tasks
```bash
# Update Lambda runtime
aws lambda update-function-configuration \
  --function-name function-name \
  --runtime nodejs18.x

# Update dependencies
npm audit fix
npm update

# Review and rotate secrets
aws ssm put-parameter \
  --name "/webqx/prod/jwt-secret" \
  --value "new-secret-value" \
  --type "SecureString" \
  --overwrite
```

### Backup and Recovery
```bash
# Create DynamoDB backup
aws dynamodb create-backup \
  --table-name webqx-healthcare-patients-prod \
  --backup-name "patients-backup-$(date +%Y%m%d)"

# Export S3 data
aws s3 sync s3://webqx-healthcare-data-prod s3://webqx-backup-bucket/$(date +%Y%m%d)/
```

---

For additional support and documentation, visit:
- [AWS Documentation](https://docs.aws.amazon.com/)
- [Serverless Framework Documentation](https://www.serverless.com/framework/docs/)
- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- [Terraform AWS Provider Documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)