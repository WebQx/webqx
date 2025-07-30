# GitHub Actions CI/CD Workflows for WebQx Healthcare Platform

This directory contains GitHub Actions workflows for automating CI/CD processes for the WebQx healthcare platform.

## Workflows

### 1. Deploy to AWS Lambda (`deploy.yml`)

Automatically deploys the WebQx healthcare platform to AWS Lambda and integrates with AWS API Gateway when code is pushed to the main branch.

#### Features:
- ✅ **Triggers**: Automatic deployment on push to `main` branch
- ✅ **AWS Lambda Deployment**: Packages and deploys Node.js application as Lambda function
- ✅ **AWS API Gateway Integration**: Creates/updates API Gateway with proxy configuration
- ✅ **Environment Variables**: Securely passes environment variables to Lambda
- ✅ **Deployment Verification**: Tests Lambda function and API Gateway endpoints
- ✅ **Healthcare Compliance**: Includes HIPAA-specific environment configurations

#### Required GitHub Secrets:
```
AWS_ACCESS_KEY_ID         - AWS access key for deployment
AWS_SECRET_ACCESS_KEY     - AWS secret key for deployment
AWS_ACCOUNT_ID           - AWS account ID for IAM role references
JWT_SECRET               - JWT secret for authentication
ENCRYPTION_KEY           - Encryption key for HIPAA compliance
FHIR_SERVER_URL         - FHIR server endpoint URL
DATABASE_URL            - Database connection string
WHISPER_API_KEY         - OpenAI Whisper API key
OPENAI_API_KEY          - OpenAI API key
```

#### AWS Prerequisites:
1. **IAM Role**: Create `lambda-execution-role` with the following policies:
   - `AWSLambdaBasicExecutionRole`
   - `AWSLambdaVPCAccessExecutionRole` (if VPC access needed)
   - Custom policy for any AWS services your application uses

2. **Permissions**: The AWS credentials must have permissions for:
   - Lambda function creation/update
   - API Gateway creation/management
   - IAM role assumption

#### Environment Configuration:
The workflow sets the following environment variables in Lambda:
- `NODE_ENV=production`
- `PORT=3000`
- Healthcare compliance flags (`HIPAA_COMPLIANT_MODE`, `ENABLE_AUDIT_LOGGING`, etc.)
- API keys and secrets from GitHub Secrets

### 2. Unit Tests (`test.yml`)

Runs comprehensive unit tests, security scans, and healthcare compliance checks on pull requests to the main branch.

#### Features:
- ✅ **Triggers**: Automatic testing on pull requests to `main` branch
- ✅ **Multi-Node Testing**: Tests on Node.js 18.x and 20.x
- ✅ **Type Checking**: TypeScript type validation
- ✅ **Unit Tests**: Jest test execution with coverage reporting
- ✅ **Security Scanning**: Dependency vulnerability analysis
- ✅ **Secret Detection**: Basic scanning for hardcoded secrets
- ✅ **HIPAA Compliance**: Healthcare-specific compliance checks
- ✅ **FHIR Integration**: Healthcare endpoint validation
- ✅ **Coverage Reports**: Code coverage via Codecov

#### Test Jobs:
1. **Unit Tests**: Core Jest test execution with coverage
2. **Security Scan**: Vulnerability and secret detection
3. **Healthcare Integration**: FHIR endpoint validation
4. **Dependency Analysis**: Package security and compliance
5. **PR Summary**: Consolidated test results

## Setup Instructions

### 1. Configure GitHub Secrets

Go to your repository settings → Secrets and variables → Actions, and add all required secrets listed above.

### 2. AWS Setup

#### Create Lambda Execution Role:
```bash
# Create trust policy
cat > trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create the role
aws iam create-role \
  --role-name lambda-execution-role \
  --assume-role-policy-document file://trust-policy.json

# Attach basic execution policy
aws iam attach-role-policy \
  --role-name lambda-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

#### IAM User for GitHub Actions:
Create an IAM user with programmatic access and attach policies for Lambda and API Gateway management.

### 3. Environment Variables

Ensure all required environment variables are configured as GitHub Secrets. Reference the `.env.example` file for the complete list of variables needed by the application.

### 4. Healthcare Compliance

The workflows include specific checks for healthcare compliance:
- HIPAA configuration validation
- Audit logging verification
- Data encryption settings
- Security vulnerability scanning

## Workflow Customization

### Modifying Deployment Configuration

To customize the deployment:

1. **Lambda Configuration**: Edit the Lambda function settings in `deploy.yml`:
   - Memory size (default: 512MB)
   - Timeout (default: 30 seconds)
   - Runtime (default: nodejs18.x)

2. **API Gateway**: Modify the API Gateway configuration:
   - Stage names
   - Custom domain setup
   - CORS configuration

3. **Environment Variables**: Add/remove environment variables in the Lambda configuration section.

### Test Configuration

To customize testing:

1. **Node.js Versions**: Modify the matrix strategy in `test.yml`
2. **Test Commands**: Update test scripts and coverage settings
3. **Security Scans**: Add additional security scanning tools
4. **Healthcare Checks**: Extend HIPAA compliance validation

## Monitoring and Troubleshooting

### Deployment Issues

1. **Check AWS Credentials**: Ensure GitHub Secrets are correctly configured
2. **IAM Permissions**: Verify the IAM role has required permissions
3. **Lambda Limits**: Check AWS Lambda limits (package size, timeout, memory)
4. **API Gateway**: Verify API Gateway configuration and permissions

### Test Failures

1. **Dependencies**: Check for version conflicts or missing packages
2. **Environment**: Ensure test environment matches development setup
3. **Security Scans**: Review and fix any security vulnerabilities
4. **Coverage**: Maintain test coverage thresholds

## Security Considerations

### Healthcare Data Protection

- All secrets are stored in GitHub Secrets, never in code
- HIPAA compliance checks are automated
- Environment variables are securely passed to Lambda
- Security vulnerability scanning is performed on every PR

### AWS Security

- Lambda functions run with minimal required permissions
- API Gateway endpoints can be secured with API keys
- VPC configuration available for additional network security

## Support

For issues with the CI/CD workflows:
1. Check GitHub Actions logs for detailed error messages
2. Verify AWS resource configurations
3. Ensure all required secrets are configured
4. Review healthcare compliance requirements

---

*WebQx™ Healthcare Platform - Secure, compliant, and automated healthcare technology deployment*