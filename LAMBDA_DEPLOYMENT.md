# WebQX Healthcare Platform - AWS Lambda Deployment Guide

## Overview

This guide provides instructions for deploying the WebQX Healthcare Platform on AWS Lambda for optimal performance, cost-efficiency, and scalability.

## Lambda Optimizations Implemented

### 1. Dependency Optimization
- **Reduced bundle size** from ~124MB to ~25MB (estimated)
- **Conditional loading** of heavy dependencies (Azure, Keycloak, Redis)
- **Peer dependencies** for optional features
- **Eliminated redundancies** (removed duplicate password hashers)

### 2. Cold Start Optimization
- **Lazy loading** of modules and auth systems
- **Lightweight fallbacks** for optional services
- **Streamlined middleware** stack
- **Conditional feature flags**

### 3. Memory and Performance
- **Optimized memory usage** (512MB recommended)
- **Faster initialization** with reduced dependency tree
- **Stateless design** suitable for Lambda execution model

## Deployment Options

### Option 1: Serverless Framework (Recommended)

```bash
# Install dependencies
npm install -g serverless
npm install serverless-offline --save-dev

# Deploy to AWS
serverless deploy --stage production

# Local testing
serverless offline
```

### Option 2: AWS SAM

```bash
# Build and deploy
sam build
sam deploy --guided
```

### Option 3: Docker Container (Lambda Container Image)

```bash
# Build Lambda container
docker build -f Dockerfile.lambda -t webqx-lambda .

# Tag for ECR
docker tag webqx-lambda:latest [account-id].dkr.ecr.[region].amazonaws.com/webqx-lambda:latest

# Push to ECR
docker push [account-id].dkr.ecr.[region].amazonaws.com/webqx-lambda:latest
```

### Option 4: ZIP Package

```bash
# Create optimized Lambda package
npm run package:lambda

# Upload webqx-lambda.zip to AWS Lambda
aws lambda update-function-code \
    --function-name webqx-healthcare \
    --zip-file fileb://webqx-lambda.zip
```

## Environment Configuration

### Required Environment Variables

```bash
NODE_ENV=production
JWT_SECRET=your_jwt_secret_min_32_chars
FHIR_SERVER_URL=https://your-fhir-server.com/fhir
CORS_ORIGINS=https://your-frontend-domain.com
```

### Optional Features (Environment-based)

```bash
# Azure Integration
AZURE_TENANT_ID=your_tenant_id
AZURE_CLIENT_ID=your_client_id
AZURE_CLIENT_SECRET=your_secret

# Keycloak SSO
KEYCLOAK_URL=https://your-keycloak.com/auth
KEYCLOAK_REALM=webqx-healthcare
KEYCLOAK_CLIENT_ID=webqx-client
KEYCLOAK_CLIENT_SECRET=your_secret

# Redis Session Store
REDIS_URL=redis://your-redis-instance:6379
```

## Lambda Configuration Recommendations

### Memory and Timeout
- **Memory**: 512MB (minimum), 1024MB (recommended for heavy workloads)
- **Timeout**: 30 seconds (API Gateway limit)
- **Reserved Concurrency**: Set based on expected load

### Environment Variables
```yaml
Environment:
  Variables:
    NODE_ENV: production
    SERVE_STATIC: false
    JWT_SECRET: !Ref JWTSecret
    FHIR_SERVER_URL: !Ref FHIRServerURL
```

### VPC Configuration (if needed)
```yaml
VpcConfig:
  SecurityGroupIds:
    - !Ref LambdaSecurityGroup
  SubnetIds:
    - !Ref PrivateSubnet1
    - !Ref PrivateSubnet2
```

## Performance Monitoring

### CloudWatch Metrics
- Monitor cold start times
- Track memory utilization
- Monitor error rates and timeouts

### X-Ray Tracing
Enable X-Ray for detailed performance insights:
```yaml
TracingConfig:
  Mode: Active
```

## Cost Optimization

### Lambda Pricing Factors
- **Invocations**: Optimize API routing
- **Duration**: Reduce execution time through lazy loading
- **Memory**: Right-size based on actual usage

### Cost-Saving Features
- **Conditional loading**: Only load needed services
- **Lightweight auth**: Faster token validation
- **Stateless design**: No persistent connections

## Security Considerations

### IAM Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

### API Gateway Security
- Enable CORS properly
- Use API keys for rate limiting
- Implement request validation

## Troubleshooting

### Common Issues

1. **Cold Start Timeouts**
   - Increase memory allocation
   - Reduce dependency loading
   - Use provisioned concurrency for critical APIs

2. **Memory Issues**
   - Monitor CloudWatch metrics
   - Optimize heavy dependencies
   - Use streaming for large responses

3. **Authentication Failures**
   - Verify JWT_SECRET is set
   - Check token expiration times
   - Validate CORS configuration

### Logging and Debugging

Enable debug logging:
```bash
NODE_ENV=development
DEBUG=webqx:*
```

## Migration from Server Deployment

### Key Differences
- No persistent state (sessions, rate limiting)
- Cold start considerations
- Stateless authentication
- Environment-based feature flags

### Migration Steps
1. Update environment variables
2. Test with `serverless offline`
3. Deploy to staging environment
4. Monitor performance metrics
5. Gradually migrate traffic

## Health Checks and Monitoring

### Health Endpoint
The `/health` endpoint provides Lambda-specific status:
```json
{
  "status": "healthy",
  "service": "WebQX Healthcare Platform (Lambda)",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "production"
}
```

### Monitoring Dashboard
Monitor these key metrics:
- Invocation count and duration
- Error rate and types
- Memory utilization
- Cold start frequency
- Feature flag usage

## Support and Troubleshooting

For deployment issues or optimization questions, refer to:
- CloudWatch Logs for detailed error messages
- X-Ray traces for performance analysis
- Feature flag status in health endpoint
- AWS Lambda console for configuration verification