# AWS Lambda Quick Start Guide

## 🚀 Deploy WebQX to AWS Lambda in 5 Minutes

### Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** installed and configured
3. **Node.js 18+** installed
4. **Git** for cloning the repository

### Step 1: Clone and Setup

```bash
# Clone the repository
git clone https://github.com/WebQx/webqx.git
cd webqx

# Install dependencies
npm install
```

### Step 2: Configure AWS

```bash
# Configure AWS credentials (if not already done)
aws configure

# Verify your AWS identity
aws sts get-caller-identity
```

### Step 3: Environment Configuration

```bash
# Copy the Lambda environment template
cp .env.lambda.example .env.prod

# Edit the environment file with your settings
nano .env.prod
```

**Minimum required settings:**
```env
NODE_ENV=production
STAGE=prod
HIPAA_ENCRYPTION_KEY=your-256-bit-encryption-key
```

### Step 4: Deploy

```bash
# Deploy to production
npm run lambda:deploy:prod

# Or use the deployment script
./deploy-lambda.sh prod
```

### Step 5: Test

```bash
# Test the health endpoint
curl https://your-api-id.execute-api.us-east-1.amazonaws.com/prod/health

# Expected response:
{
  "status": "healthy",
  "service": "WebQX Healthcare Platform",
  "runtime": "lambda",
  "lambda": {
    "functionName": "webqx-healthcare-platform-prod-api",
    "functionVersion": "$LATEST",
    "region": "us-east-1",
    "stage": "prod"
  }
}
```

## 🔧 Configuration Options

### Memory and Timeout

Edit `serverless.yml`:

```yaml
provider:
  memorySize: 1024  # Increase for better performance
  timeout: 30       # Increase for long-running operations
```

### Environment Variables

Add to `serverless.yml`:

```yaml
provider:
  environment:
    DATABASE_URL: ${env:DATABASE_URL}
    REDIS_URL: ${env:REDIS_URL}
    # Add your variables here
```

### Custom Domain

1. Uncomment the custom domain section in `serverless.yml`
2. Configure your domain settings
3. Deploy with domain creation:

```bash
serverless create_domain --stage prod
serverless deploy --stage prod
```

## 🛡️ Security Best Practices

1. **Environment Variables**: Use AWS Systems Manager Parameter Store for sensitive data
2. **IAM Roles**: Create custom IAM roles with minimal permissions
3. **VPC**: Deploy Lambda in VPC if accessing private resources
4. **API Gateway**: Configure throttling and API keys

## 📊 Monitoring

### CloudWatch Logs

```bash
# View logs
serverless logs -f api --stage prod

# Follow logs in real-time
serverless logs -f api --stage prod --tail
```

### CloudWatch Metrics

Monitor these key metrics:
- **Duration**: Function execution time
- **Errors**: Error count and rate
- **Throttles**: Lambda throttling events
- **Memory Usage**: Peak memory consumption

## 🔄 Updates and Rollbacks

```bash
# Deploy updates
npm run lambda:deploy:prod

# Rollback (if needed)
serverless remove --stage prod
# Then redeploy previous version
```

## 🧪 Local Development

```bash
# Run locally with Lambda simulation
npm run lambda:dev

# Test specific endpoints
curl http://localhost:3000/health
curl http://localhost:3000/fhir/metadata
```

## 🆘 Troubleshooting

### Common Issues

1. **Cold Starts**: Consider provisioned concurrency for production
2. **Memory Errors**: Increase `memorySize` in configuration
3. **Timeout Errors**: Increase `timeout` setting
4. **Package Size**: Review `package.exclude` in `serverless.yml`

### Debug Commands

```bash
# Check function info
serverless info --stage prod

# Invoke function directly
serverless invoke -f api --stage prod

# Check CloudWatch logs
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/webqx
```

## 📞 Support

- **Documentation**: See `LAMBDA_DEPLOYMENT.md` for detailed guide
- **Issues**: Report issues on GitHub
- **Community**: Join our healthcare tech community

---

**🏥 Ready to revolutionize healthcare with serverless technology!**