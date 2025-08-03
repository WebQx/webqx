# AWS Lambda Deployment Guide for WebQx Healthcare Platform

This guide provides comprehensive instructions for deploying the WebQx Healthcare Platform to AWS Lambda with all necessary infrastructure components.

## 🏗️ Architecture Overview

The deployment includes:
- **AWS Lambda**: Serverless function hosting the Express.js application
- **API Gateway**: HTTP API endpoint for the Lambda function
- **RDS PostgreSQL**: Database with RDS Proxy for connection pooling
- **S3 + CloudFront**: Static file hosting and CDN
- **VPC**: Isolated network environment
- **Secrets Manager**: Secure credential storage
- **CloudWatch**: Logging and monitoring

## 📋 Prerequisites

### Required Tools
1. **AWS CLI** (v2.x): [Installation Guide](https://aws.amazon.com/cli/)
2. **AWS SAM CLI**: [Installation Guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)
3. **Node.js** (v18.x): [Download](https://nodejs.org/)
4. **npm** (comes with Node.js)

### AWS Account Setup
1. Create an AWS account if you don't have one
2. Configure AWS CLI with appropriate credentials:
   ```bash
   aws configure
   ```
3. Ensure your AWS account has the necessary permissions for:
   - Lambda
   - API Gateway
   - RDS
   - S3
   - CloudFront
   - VPC
   - IAM
   - Secrets Manager
   - CloudWatch

## 🚀 Quick Start Deployment

### 1. Clone and Setup
```bash
git clone https://github.com/WebQx/webqx.git
cd webqx
npm install
```

### 2. Configure Environment
```bash
cp .env.lambda.example .env
# Edit .env with your specific configuration
```

### 3. Build and Deploy
```bash
# Build the Lambda package
npm run lambda:build

# Package the application
npm run lambda:package

# Deploy infrastructure (first time only)
npm run lambda:deploy
```

### 4. Access Your Application
After deployment, the API Gateway URL will be displayed. Access your healthcare platform at:
```
https://your-api-id.execute-api.region.amazonaws.com/stage/
```

## 📖 Detailed Deployment Steps

### Step 1: Infrastructure Deployment

First, deploy the foundational infrastructure:

```bash
# Deploy VPC, RDS, and networking components
aws cloudformation create-stack \
  --stack-name webqx-infrastructure-dev \
  --template-body file://aws-deployment/infrastructure.yaml \
  --parameters ParameterKey=Environment,ParameterValue=dev \
               ParameterKey=DatabaseMasterPassword,ParameterValue=YourSecurePassword123! \
  --capabilities CAPABILITY_IAM
```

Wait for the infrastructure stack to complete (~15-20 minutes for RDS):

```bash
aws cloudformation wait stack-create-complete --stack-name webqx-infrastructure-dev
```

### Step 2: Application Deployment

Deploy the Lambda function and API Gateway:

```bash
# Using SAM
sam build
sam deploy --guided

# Or using npm scripts
npm run lambda:build
npm run lambda:package
npm run lambda:deploy
```

### Step 3: Configure Environment Variables

Set up Lambda environment variables through AWS Console or CLI:

```bash
aws lambda update-function-configuration \
  --function-name webqx-healthcare-platform-dev \
  --environment Variables='{
    "NODE_ENV":"production",
    "DATABASE_URL":"postgresql://username:password@rds-proxy-endpoint:5432/webqx_healthcare",
    "JWT_SECRET":"your-jwt-secret-key-32-chars-minimum",
    "OAUTH2_CLIENT_SECRET":"your-oauth2-client-secret"
  }'
```

### Step 4: Upload Static Files

Upload static files to S3:

```bash
# Create S3 bucket (if not created by CloudFormation)
aws s3 mb s3://webqx-static-files-dev-$(aws sts get-caller-identity --query Account --output text)

# Upload static files
aws s3 sync . s3://your-bucket-name \
  --exclude "*" \
  --include "*.html" \
  --include "*.css" \
  --include "*.js" \
  --include "*.png" \
  --include "*.jpg" \
  --include "*.ico"
```

## 🔧 Configuration

### Environment Variables

Key environment variables for Lambda deployment:

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Environment (production) | Yes |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | JWT signing secret (32+ chars) | Yes |
| `OAUTH2_CLIENT_SECRET` | OAuth2 client secret | Yes |
| `WHISPER_API_KEY` | OpenAI Whisper API key | No |
| `S3_STATIC_FILES_BUCKET` | S3 bucket for static files | No |

### Database Configuration

The deployment includes:
- **RDS PostgreSQL**: Primary database
- **RDS Proxy**: Connection pooling for Lambda
- **Secrets Manager**: Credential rotation

Configure the database connection:
```javascript
const dbConfig = {
  host: process.env.RDS_PROXY_ENDPOINT,
  port: 5432,
  database: 'webqx_healthcare',
  // Credentials retrieved from Secrets Manager
};
```

### Security Configuration

#### VPC Configuration
- Lambda functions run in private subnets
- RDS instances in isolated private subnets
- Security groups restrict access

#### Encryption
- RDS encryption at rest
- S3 bucket encryption
- Secrets Manager for sensitive data

#### HIPAA Compliance
- Audit logging enabled
- Data encryption in transit and at rest
- Access controls and monitoring

## 🧪 Testing

### Local Testing with SAM

Test the Lambda function locally:

```bash
# Start API Gateway locally
sam local start-api

# Test specific function
sam local invoke WebQxFunction --event events/test-event.json

# Test with debug
sam local start-api --debug
```

### Health Check

Verify deployment:

```bash
# Test health endpoint
curl https://your-api-id.execute-api.region.amazonaws.com/stage/health

# Expected response:
{
  "status": "healthy",
  "service": "WebQX Healthcare Platform (Lambda)",
  "fhir": "enabled",
  "lambda": {
    "functionName": "webqx-healthcare-platform-dev",
    "functionVersion": "$LATEST"
  }
}
```

### Load Testing

For production deployments, perform load testing:

```bash
# Install Artillery
npm install -g artillery

# Run load test
artillery quick --count 10 --num 5 https://your-api-endpoint/health
```

## 📊 Monitoring and Logging

### CloudWatch Logs

View Lambda logs:

```bash
# View recent logs
aws logs tail /aws/lambda/webqx-healthcare-platform-dev --follow

# Filter error logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/webqx-healthcare-platform-dev \
  --filter-pattern "ERROR"
```

### CloudWatch Metrics

Key metrics to monitor:
- **Duration**: Function execution time
- **Errors**: Error count and rate
- **Throttles**: Throttling events
- **Concurrent Executions**: Concurrent function runs

### Custom Dashboards

Create CloudWatch dashboard for monitoring:

```bash
aws cloudwatch put-dashboard \
  --dashboard-name "WebQx-Healthcare-Platform" \
  --dashboard-body file://aws-deployment/cloudwatch-dashboard.json
```

## 🔄 CI/CD Pipeline

### GitHub Actions

Example workflow (`.github/workflows/deploy.yml`):

```yaml
name: Deploy WebQx to AWS Lambda

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
          
      - name: Install dependencies
        run: npm install
        
      - name: Build and deploy
        run: |
          npm run lambda:build
          npm run lambda:package
          npm run lambda:deploy
```

## 🚨 Troubleshooting

### Common Issues

#### Cold Start Performance
```javascript
// Optimize for cold starts
const AWS = require('aws-sdk');
// Initialize AWS services outside handler
const s3 = new AWS.S3();

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  // Your handler code
};
```

#### Memory Issues
- Increase Lambda memory (1024MB recommended)
- Use connection pooling for database
- Implement caching strategies

#### Database Connection Limits
- Use RDS Proxy for connection pooling
- Set appropriate connection pool sizes
- Monitor database connections

### Error Diagnostics

```bash
# Check function configuration
aws lambda get-function-configuration --function-name webqx-healthcare-platform-dev

# View error metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=webqx-healthcare-platform-dev \
  --start-time 2023-01-01T00:00:00Z \
  --end-time 2023-01-02T00:00:00Z \
  --period 3600 \
  --statistics Sum
```

## 📈 Scaling and Optimization

### Performance Optimization

1. **Lambda Configuration**:
   - Memory: 1024MB (adjust based on needs)
   - Timeout: 30 seconds
   - Reserved concurrency: Set based on expected load

2. **Database Optimization**:
   - Use RDS Proxy for connection pooling
   - Implement read replicas for read-heavy workloads
   - Use appropriate instance sizes

3. **Caching**:
   - Implement Redis/ElastiCache for session storage
   - Use CloudFront for static content caching
   - Cache frequently accessed data

### Cost Optimization

1. **Lambda Costs**:
   - Monitor execution duration
   - Optimize memory allocation
   - Use reserved concurrency wisely

2. **Database Costs**:
   - Right-size RDS instances
   - Use Aurora Serverless for variable workloads
   - Implement proper backup retention

3. **Storage Costs**:
   - Use S3 lifecycle policies
   - Compress static assets
   - Monitor CloudFront usage

## 🔐 Security Best Practices

### Lambda Security
- Use IAM roles with least privilege
- Enable VPC for network isolation
- Encrypt environment variables

### Database Security
- Use Secrets Manager for credentials
- Enable encryption at rest
- Regular security patches

### API Security
- Implement rate limiting
- Use API keys for access control
- Enable WAF for additional protection

## 📚 Additional Resources

- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- [FHIR Implementation Guide](http://hl7.org/fhir/)
- [HIPAA Compliance on AWS](https://aws.amazon.com/compliance/hipaa-compliance/)

## 🆘 Support

For issues and questions:
1. Check CloudWatch logs first
2. Review this documentation
3. Open an issue in the GitHub repository
4. Contact the WebQx development team

---

**Note**: This deployment guide is for reference purposes. Always review and adapt configurations for your specific security and compliance requirements, especially for healthcare applications handling PHI (Protected Health Information).