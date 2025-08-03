# AWS Lambda Deployment Guide

This guide explains how to deploy the WebQX Healthcare Platform to AWS Lambda using either the Serverless Framework or AWS SAM.

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Node.js 18.x** or higher
3. **NPM** or **Yarn** package manager
4. **Serverless Framework** (for serverless deployment) or **AWS SAM CLI** (for SAM deployment)

## Environment Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables (create `.env` file based on `.env.example`):
```bash
cp .env.example .env
# Edit .env with your configuration
```

## Deployment Options

### Option 1: Serverless Framework (Recommended)

1. **Install Serverless Framework globally:**
```bash
npm install -g serverless
```

2. **Deploy to development stage:**
```bash
npm run lambda:deploy:dev
```

3. **Deploy to production stage:**
```bash
npm run lambda:deploy:prod
```

4. **Local development with Lambda simulation:**
```bash
npm run lambda:dev
```

5. **View function logs:**
```bash
npm run lambda:logs
```

6. **Remove deployment:**
```bash
npm run lambda:remove
```

### Option 2: AWS SAM

1. **Install AWS SAM CLI:**
   - Follow the [official SAM installation guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)

2. **Build the application:**
```bash
sam build
```

3. **Deploy for the first time:**
```bash
sam deploy --guided
```

4. **Subsequent deployments:**
```bash
sam deploy
```

5. **Local development:**
```bash
sam local start-api --port 3000
```

6. **Clean up:**
```bash
sam delete
```

## Configuration

### Environment Variables

The following environment variables should be configured for production:

- `NODE_ENV`: Set to 'production' for production deployments
- `HIPAA_ENCRYPTION_KEY`: Required for HIPAA compliance
- `DATABASE_URL`: Database connection string
- `REDIS_URL`: Redis connection string (if using)
- `OAUTH2_CLIENT_ID`: OAuth2 client identifier
- `OAUTH2_CLIENT_SECRET`: OAuth2 client secret

### Serverless Framework Configuration

Edit `serverless.yml` to customize:

- **Memory allocation**: Adjust `memorySize` based on your needs (default: 1024MB)
- **Timeout**: Adjust `timeout` based on your longest running operations (default: 30s)
- **Environment variables**: Add your production environment variables
- **Custom domain**: Uncomment and configure the `customDomain` section
- **VPC configuration**: Add VPC settings if needed for database access

### SAM Configuration

Edit `template.yaml` to customize:

- **Memory and timeout**: Adjust in the `Globals.Function` section
- **Environment variables**: Add to the `Environment.Variables` section
- **API Gateway settings**: Modify CORS and other API Gateway configurations

## Lambda-Specific Considerations

### Cold Starts
- The platform is optimized for Lambda cold starts
- Consider using provisioned concurrency for production workloads with strict latency requirements

### Stateless Operations
- All operations are stateless and Lambda-compatible
- Session data should be stored in external systems (Redis, DynamoDB)

### Request/Response Handling
- The Lambda handler uses `@vendia/serverless-express` for seamless Express.js compatibility
- All existing routes and middleware work without modification

### Monitoring
- Use CloudWatch Logs for application logging
- Set up CloudWatch Alarms for error rates and duration
- Consider using AWS X-Ray for distributed tracing

## Health Checks

The platform includes Lambda-aware health checks:

- **Endpoint**: `GET /health`
- **Response includes**:
  - Lambda function information (when running in Lambda)
  - Service status
  - Environment information
  - OAuth2 status

Example response in Lambda:
```json
{
  "status": "healthy",
  "service": "WebQX Healthcare Platform",
  "fhir": "enabled",
  "openehr": "enabled",
  "oauth2": "enabled",
  "environment": "production",
  "runtime": "lambda",
  "lambda": {
    "functionName": "webqx-healthcare-platform-prod-api",
    "functionVersion": "$LATEST",
    "region": "us-east-1",
    "stage": "prod"
  },
  "timestamp": "2025-01-27T20:00:00.000Z"
}
```

## Security Considerations

### IAM Roles
- Lambda functions run with minimal required permissions
- Consider using custom IAM roles for production deployments

### API Gateway
- CORS is configured for development flexibility
- Tighten CORS settings for production
- Consider using API keys or custom authorizers for additional security

### Environment Variables
- Never commit sensitive environment variables to version control
- Use AWS Systems Manager Parameter Store or AWS Secrets Manager for sensitive data

## Troubleshooting

### Common Issues

1. **Cold start timeouts**:
   - Increase Lambda timeout in configuration
   - Consider provisioned concurrency for critical functions

2. **Memory issues**:
   - Monitor CloudWatch metrics for memory usage
   - Increase `memorySize` if needed

3. **Database connection issues**:
   - Ensure Lambda has VPC access if database is in VPC
   - Configure appropriate security groups
   - Consider connection pooling for database efficiency

4. **Large package size**:
   - Review the `package.exclude` section in `serverless.yml`
   - Consider using Lambda layers for shared dependencies

### Debugging

1. **Check CloudWatch Logs**:
```bash
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/webqx
aws logs tail /aws/lambda/webqx-healthcare-platform-dev-api --follow
```

2. **Test Lambda function directly**:
```bash
npm run lambda:invoke
```

3. **Local testing**:
```bash
# Using Serverless Framework
npm run lambda:dev

# Using SAM
sam local start-api
```

## Performance Optimization

### Memory Configuration
- Start with 1024MB and adjust based on CloudWatch metrics
- Higher memory allocation also increases CPU power

### Package Size Optimization
- Exclude unnecessary files (see `serverless.yml` package.exclude)
- Consider using webpack or similar bundlers for smaller packages

### Connection Management
- Reuse database connections across Lambda invocations
- Implement proper connection pooling

## Migration from Traditional Server

The Lambda deployment maintains full compatibility with the traditional server deployment:

- All routes work identically
- Middleware stack is preserved
- Static file serving is handled by Lambda
- Environment variable handling is maintained

The only difference is the deployment target and execution environment.