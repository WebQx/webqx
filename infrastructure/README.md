# WebQX Healthcare Platform - Infrastructure as Code

This directory contains Infrastructure as Code (IaC) configurations for deploying the WebQX Healthcare Platform on AWS. The platform supports multiple deployment approaches to accommodate different organizational needs and preferences.

## 🏗️ Architecture Overview

The WebQX Healthcare Platform uses a serverless, microservices architecture designed for:
- **HIPAA Compliance**: End-to-end encryption, audit logging, access controls
- **Scalability**: Auto-scaling Lambda functions and DynamoDB
- **High Availability**: Multi-AZ deployment across AWS regions
- **Security**: VPC isolation, WAF protection, IAM roles with least privilege

### Core AWS Services

- **AWS Lambda**: Serverless compute for API functions
- **Amazon API Gateway**: RESTful API endpoints
- **Amazon DynamoDB**: NoSQL database for healthcare data
- **Amazon S3**: Storage for medical documents and backups
- **AWS Secrets Manager**: Secure configuration management
- **Amazon CloudWatch**: Monitoring, logging, and alerting
- **AWS VPC**: Network isolation and security

## 📁 Directory Structure

```
infrastructure/
├── terraform/           # Terraform configurations
│   ├── main.tf         # Main infrastructure definition
│   ├── variables.tf    # Input variables
│   ├── outputs.tf      # Output values
│   └── modules/        # Reusable Terraform modules
│       ├── vpc/        # VPC and networking
│       ├── lambda/     # Lambda functions
│       ├── dynamodb/   # DynamoDB tables
│       ├── api_gateway/# API Gateway configuration
│       ├── s3/         # S3 buckets
│       ├── iam/        # IAM roles and policies
│       ├── security/   # Security groups and WAF
│       └── monitoring/ # CloudWatch and alarms
├── cloudformation/      # CloudFormation templates
│   └── webqx-main.yaml # Main infrastructure stack
├── serverless/          # Serverless Framework configuration
│   └── serverless.yml  # Lambda functions and resources
└── scripts/            # Deployment scripts
    ├── deploy-terraform.sh
    ├── deploy-cloudformation.sh
    └── deploy-serverless.sh
```

## 🚀 Deployment Options

### Option 1: Terraform (Recommended)

**Best for**: Organizations with existing Terraform expertise or complex infrastructure requirements.

**Features**:
- Modular, reusable infrastructure components
- State management and drift detection
- Comprehensive resource coverage
- Infrastructure versioning

**Quick Start**:
```bash
# Navigate to project root
cd /path/to/webqx

# Deploy infrastructure
./infrastructure/scripts/deploy-terraform.sh dev us-east-1

# Customize configuration
cp infrastructure/terraform/terraform.tfvars.example infrastructure/terraform/terraform.tfvars
# Edit terraform.tfvars with your settings
```

### Option 2: CloudFormation

**Best for**: AWS-native organizations or those preferring AWS-managed infrastructure.

**Features**:
- Native AWS integration
- CloudFormation drift detection
- AWS CloudFormation Console management
- Stack-based deployments

**Quick Start**:
```bash
# Deploy infrastructure
./infrastructure/scripts/deploy-cloudformation.sh dev us-east-1
```

### Option 3: Serverless Framework

**Best for**: Lambda-focused deployments or rapid prototyping.

**Features**:
- Lambda-centric deployment
- Plugin ecosystem
- Easy local development
- Built-in CloudFormation generation

**Quick Start**:
```bash
# Deploy Lambda functions
./infrastructure/scripts/deploy-serverless.sh dev us-east-1
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_PROFILE=default

# Environment Settings
ENVIRONMENT=dev
PROJECT_NAME=webqx-healthcare

# Healthcare Configuration
FHIR_VERSION=R4
ENABLE_HIPAA_LOGGING=true
BACKUP_RETENTION_DAYS=2555

# Security Settings
ENABLE_WAF=true
ENABLE_VPC_ENDPOINTS=true
```

### Terraform Variables

Edit `infrastructure/terraform/terraform.tfvars`:

```hcl
# Basic Configuration
aws_region = "us-east-1"
environment = "dev"

# Networking
vpc_cidr = "10.0.0.0/16"
availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]

# Healthcare Settings
enable_hipaa_logging = true
audit_log_retention_days = 2555
enable_phi_encryption = true

# Security
enable_waf = true
allowed_cidr_blocks = ["10.0.0.0/8"]

# Monitoring
enable_detailed_monitoring = true
sns_alarm_endpoint = "admin@yourhealthcareorg.com"
```

## 🔒 Security & Compliance

### HIPAA Compliance Features

- **Encryption**: All data encrypted at rest and in transit
- **Audit Logging**: Comprehensive audit trails for all healthcare data access
- **Access Controls**: Role-based access with IAM policies
- **Network Security**: VPC isolation, security groups, NACLs
- **Data Retention**: Configurable retention policies for compliance

### Security Best Practices

1. **Least Privilege**: IAM roles with minimal required permissions
2. **Network Isolation**: Resources deployed in private subnets
3. **WAF Protection**: Web Application Firewall for API endpoints
4. **Secrets Management**: Sensitive data stored in AWS Secrets Manager
5. **Monitoring**: Real-time security monitoring and alerting

## 📊 Monitoring & Logging

### CloudWatch Dashboards

The infrastructure includes pre-configured dashboards for:
- Lambda function performance and errors
- API Gateway metrics and latency
- DynamoDB performance and throttling
- Security metrics and alerts

### Audit Logging

Healthcare-specific audit logging includes:
- PHI access tracking
- User authentication events
- Data modification logs
- System security events

### Alerts

Automated alerts for:
- High error rates
- Performance degradation
- Security violations
- HIPAA compliance issues

## 🧪 Testing

### Infrastructure Testing

```bash
# Validate Terraform configuration
cd infrastructure/terraform
terraform validate
terraform plan

# Test CloudFormation template
aws cloudformation validate-template \
  --template-body file://infrastructure/cloudformation/webqx-main.yaml

# Test Serverless configuration
cd infrastructure/serverless
serverless print
```

### Integration Testing

```bash
# Run infrastructure tests
npm run test:infrastructure

# Run API endpoint tests
npm run test:api

# Run security compliance tests
npm run test:security
```

## 🔄 CI/CD Integration

### GitHub Actions

The platform includes GitHub Actions workflows for:
- Infrastructure validation
- Automated deployments
- Security scanning
- Compliance checks

### Example Workflow

```yaml
name: Deploy Infrastructure
on:
  push:
    branches: [main]
    paths: ['infrastructure/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy Terraform
        run: ./infrastructure/scripts/deploy-terraform.sh prod
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

## 🚨 Troubleshooting

### Common Issues

**Terraform State Conflicts**:
```bash
# Force unlock state
terraform force-unlock <lock-id>

# Import existing resources
terraform import aws_dynamodb_table.patients webqx-dev-patients
```

**Lambda Deployment Failures**:
```bash
# Check function logs
aws logs tail /aws/lambda/webqx-dev-patient-api --follow

# Update function code
serverless deploy function --function patientApi
```

**CloudFormation Stack Errors**:
```bash
# Check stack events
aws cloudformation describe-stack-events --stack-name webqx-dev

# Cancel stack update
aws cloudformation cancel-update-stack --stack-name webqx-dev
```

### Support Resources

- **Documentation**: Comprehensive guides in `/docs`
- **Examples**: Sample configurations in `/examples`
- **Issues**: GitHub Issues for bug reports
- **Discussions**: GitHub Discussions for questions

## 📄 Cost Optimization

### Resource Sizing

The infrastructure is configured with cost-optimized defaults:
- Lambda: Pay-per-execution with optimized memory allocation
- DynamoDB: On-demand billing for variable workloads
- S3: Intelligent tiering for automatic cost optimization
- CloudWatch: Log retention policies to manage storage costs

### Monitoring Costs

```bash
# Check AWS costs
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-02-01 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE

# Set up billing alerts
aws budgets create-budget --account-id 123456789012 \
  --budget file://budget.json
```

## 🆕 Updates & Maintenance

### Regular Maintenance Tasks

1. **Security Updates**: Keep all dependencies current
2. **Backup Verification**: Test restore procedures monthly
3. **Access Review**: Audit user permissions quarterly
4. **Compliance Audit**: Annual HIPAA compliance review

### Version Updates

```bash
# Update Terraform providers
terraform init -upgrade

# Update Serverless Framework
npm update -g serverless

# Update Lambda dependencies
cd lambda && npm update
```

## 📞 Support

For technical support and questions:

- **GitHub Issues**: Bug reports and feature requests
- **Email**: infrastructure@webqx.health
- **Documentation**: https://docs.webqx.health
- **Community**: https://community.webqx.health

---

*WebQX Healthcare Platform - Infrastructure as Code*  
*Version 1.0.0 | Last Updated: January 2024*