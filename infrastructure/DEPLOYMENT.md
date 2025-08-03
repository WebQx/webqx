# WebQX Healthcare Platform - Deployment Guide

This guide provides step-by-step instructions for deploying the WebQX Healthcare Platform infrastructure on AWS.

## 🚀 Quick Start

### Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** installed and configured
3. **Terraform** (v1.0+) for infrastructure deployment
4. **Node.js** (v18+) for Lambda functions
5. **Git** for version control

### 1-Minute Deploy (Development)

```bash
git clone https://github.com/WebQx/webqx.git
cd webqx
./infrastructure/scripts/deploy-terraform.sh dev us-east-1
```

## 📋 Detailed Deployment Steps

### Step 1: Environment Setup

1. **Configure AWS CLI**:
   ```bash
   aws configure
   # Enter your AWS credentials and default region
   ```

2. **Verify AWS Access**:
   ```bash
   aws sts get-caller-identity
   ```

3. **Clone Repository**:
   ```bash
   git clone https://github.com/WebQx/webqx.git
   cd webqx
   ```

### Step 2: Infrastructure Deployment (Terraform)

1. **Navigate to Terraform Directory**:
   ```bash
   cd infrastructure/terraform
   ```

2. **Configure Variables**:
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   # Edit terraform.tfvars with your configuration
   ```

3. **Initialize Terraform**:
   ```bash
   terraform init
   ```

4. **Plan Deployment**:
   ```bash
   terraform plan -var-file="terraform.tfvars"
   ```

5. **Deploy Infrastructure**:
   ```bash
   terraform apply -var-file="terraform.tfvars"
   ```

### Step 3: Lambda Functions Deployment

1. **Navigate to Serverless Directory**:
   ```bash
   cd ../serverless
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Deploy Functions**:
   ```bash
   serverless deploy --stage dev
   ```

### Step 4: Configuration

1. **Update Secrets Manager**:
   ```bash
   aws secretsmanager put-secret-value \
     --secret-id webqx-dev-config \
     --secret-string '{
       "database_url": "your_db_url",
       "jwt_secret": "your_jwt_secret",
       "encryption_key": "your_encryption_key"
     }'
   ```

2. **Test API Endpoints**:
   ```bash
   curl https://your-api-gateway-url/dev/patient
   ```

## 🌍 Environment-Specific Deployments

### Development Environment

```bash
# Minimal configuration for testing
./infrastructure/scripts/deploy-terraform.sh dev us-east-1

# Configuration highlights:
# - Single AZ deployment
# - Reduced backup retention
# - Development-friendly settings
```

### Staging Environment

```bash
# Production-like configuration
./infrastructure/scripts/deploy-terraform.sh staging us-east-1

# Configuration highlights:
# - Multi-AZ deployment
# - Extended backup retention
# - WAF enabled
# - Enhanced monitoring
```

### Production Environment

```bash
# Full production configuration
./infrastructure/scripts/deploy-terraform.sh prod us-east-1

# Configuration highlights:
# - Multi-region support
# - HIPAA compliance features
# - 7-year data retention
# - Advanced security features
```

## 🔧 Custom Configuration Examples

### Healthcare Organization Setup

```hcl
# terraform.tfvars for healthcare organization
environment = "prod"
aws_region = "us-east-1"

# HIPAA Compliance
enable_hipaa_logging = true
audit_log_retention_days = 2555
enable_phi_encryption = true

# Security
enable_waf = true
allowed_cidr_blocks = ["10.0.0.0/8", "172.16.0.0/12"]

# High Availability
enable_multi_az = true
backup_retention_days = 30

# Monitoring
enable_detailed_monitoring = true
sns_alarm_endpoint = "security@yourhealthcareorg.com"
```

### Development Team Setup

```hcl
# terraform.tfvars for development
environment = "dev"
aws_region = "us-west-2"

# Cost Optimization
lambda_memory_size = 128
backup_retention_days = 7
enable_detailed_monitoring = false

# Security (relaxed for development)
enable_waf = false
allowed_cidr_blocks = ["0.0.0.0/0"]
```

### Multi-Region Setup

```hcl
# terraform.tfvars for multi-region deployment
environment = "prod"

# Primary region
aws_region = "us-east-1"

# Disaster recovery
enable_cross_region_backup = true
dr_region = "us-west-2"

# Global settings
enable_multi_az = true
enable_detailed_monitoring = true
```

## 🔒 Security Configuration

### HIPAA Compliance Checklist

- [ ] **Encryption**: All data encrypted at rest and in transit
- [ ] **Access Controls**: IAM roles with least privilege
- [ ] **Audit Logging**: Comprehensive audit trails
- [ ] **Network Security**: VPC isolation and security groups
- [ ] **Data Retention**: 7-year retention for compliance
- [ ] **Backup & Recovery**: Automated backups with encryption
- [ ] **Monitoring**: Real-time security monitoring
- [ ] **Incident Response**: Automated alerting and response

### Security Hardening

```bash
# Enable additional security features
terraform apply -var="enable_waf=true" \
                -var="enable_guardduty=true" \
                -var="enable_config=true"

# Configure custom security policies
aws iam create-policy --policy-name WebQXSecurityPolicy \
  --policy-document file://security-policy.json
```

## 📊 Monitoring Setup

### CloudWatch Configuration

```bash
# Create custom dashboards
aws cloudwatch put-dashboard \
  --dashboard-name WebQX-Healthcare-Dashboard \
  --dashboard-body file://dashboard.json

# Set up billing alerts
aws budgets create-budget \
  --account-id $(aws sts get-caller-identity --query Account --output text) \
  --budget file://budget.json
```

### Alerting Setup

```bash
# Create SNS topic for alerts
aws sns create-topic --name webqx-healthcare-alerts

# Subscribe to alerts
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:123456789012:webqx-healthcare-alerts \
  --protocol email \
  --notification-endpoint admin@yourhealthcareorg.com
```

## 🧪 Testing & Validation

### Infrastructure Testing

```bash
# Validate Terraform configuration
terraform validate

# Check for security issues
checkov -f main.tf

# Test connectivity
aws ec2 describe-vpcs --filters "Name=tag:Project,Values=WebQX-Healthcare-Platform"
```

### API Testing

```bash
# Test patient API
curl -X GET "https://your-api-gateway-url/dev/patient" \
  -H "Content-Type: application/json"

# Test FHIR endpoints
curl -X GET "https://your-api-gateway-url/dev/fhir/metadata" \
  -H "Accept: application/fhir+json"

# Load testing
npm install -g artillery
artillery run load-test.yml
```

### Security Testing

```bash
# Run security scans
npm audit
npm install -g @aws-amplify/cli
amplify security scan

# Test WAF rules
curl -X GET "https://your-api-gateway-url/dev/patient" \
  -H "X-Test-Attack: <script>alert('xss')</script>"
```

## 🔄 CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy WebQX Infrastructure
on:
  push:
    branches: [main]
    paths: ['infrastructure/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2
        
      - name: Deploy Infrastructure
        run: |
          cd infrastructure/terraform
          terraform init
          terraform apply -auto-approve
          
      - name: Deploy Lambda Functions
        run: |
          cd infrastructure/serverless
          npm install
          npm install -g serverless
          serverless deploy --stage prod
```

### Jenkins Pipeline

```groovy
// Jenkinsfile
pipeline {
    agent any
    
    stages {
        stage('Checkout') {
            steps {
                git 'https://github.com/WebQx/webqx.git'
            }
        }
        
        stage('Infrastructure') {
            steps {
                sh './infrastructure/scripts/deploy-terraform.sh prod us-east-1'
            }
        }
        
        stage('Lambda Functions') {
            steps {
                sh './infrastructure/scripts/deploy-serverless.sh prod us-east-1'
            }
        }
        
        stage('Tests') {
            steps {
                sh 'npm run test:integration'
            }
        }
    }
}
```

## 🚨 Troubleshooting

### Common Issues

**Issue**: Terraform state lock
```bash
# Solution: Force unlock
terraform force-unlock <lock-id>
```

**Issue**: Lambda function timeout
```bash
# Solution: Increase timeout in serverless.yml
timeout: 60  # seconds
```

**Issue**: DynamoDB throttling
```bash
# Solution: Switch to on-demand billing
terraform apply -var="dynamodb_billing_mode=PAY_PER_REQUEST"
```

**Issue**: VPC endpoint connection failures
```bash
# Solution: Check security groups and route tables
aws ec2 describe-vpc-endpoints
aws ec2 describe-route-tables
```

### Debugging Commands

```bash
# Check CloudFormation events
aws cloudformation describe-stack-events --stack-name webqx-dev

# View Lambda logs
aws logs tail /aws/lambda/webqx-dev-patient-api --follow

# Test VPC connectivity
aws ec2 describe-vpcs --filters "Name=state,Values=available"

# Check API Gateway
aws apigateway get-rest-apis
```

## 📞 Support & Maintenance

### Regular Maintenance

1. **Weekly**: Review CloudWatch alarms and metrics
2. **Monthly**: Update Lambda dependencies and security patches
3. **Quarterly**: Review IAM permissions and access patterns
4. **Annually**: Conduct security audit and compliance review

### Support Channels

- **Documentation**: https://docs.webqx.health
- **GitHub Issues**: https://github.com/WebQx/webqx/issues
- **Email Support**: infrastructure@webqx.health
- **Community**: https://community.webqx.health

### Emergency Procedures

**Security Incident**:
1. Immediately rotate all credentials
2. Review CloudTrail logs
3. Update security groups to block malicious traffic
4. Contact security team

**Infrastructure Outage**:
1. Check AWS Service Health Dashboard
2. Review CloudWatch alarms
3. Verify backup systems
4. Implement disaster recovery procedures

---

*WebQX Healthcare Platform - Deployment Guide*  
*Version 1.0.0 | Last Updated: January 2024*