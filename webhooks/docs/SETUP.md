# GitHub Webhooks Setup Guide

This guide walks you through setting up GitHub webhooks to trigger AWS Lambda functions for the WebQX platform.

## Prerequisites

- AWS CLI configured with appropriate permissions
- AWS SAM CLI installed (for SAM deployment) or AWS CLI (for CloudFormation)
- GitHub repository with admin access
- Node.js 18+ for local testing

## Step-by-Step Setup

### 1. Prepare AWS Environment

#### Option A: Using AWS SAM (Recommended)

1. **Install AWS SAM CLI**
   ```bash
   # macOS
   brew install aws-sam-cli
   
   # Windows
   # Download from https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html
   ```

2. **Navigate to webhook directory**
   ```bash
   cd webhooks/lambda
   npm install
   ```

3. **Build and deploy**
   ```bash
   sam build --template-file ../deployment/template.yaml
   sam deploy --guided
   ```

   When prompted, provide:
   - Stack name: `webqx-github-webhooks`
   - AWS Region: Your preferred region (e.g., `us-east-1`)
   - WebhookSecret: A secure random string (save this for GitHub configuration)
   - Environment: `dev`, `staging`, or `prod`
   - Confirm changes: `Y`
   - Allow SAM to create IAM roles: `Y`

#### Option B: Using CloudFormation

1. **Package Lambda code**
   ```bash
   cd webhooks/lambda
   npm install
   zip -r lambda-deployment.zip . -x "*.git*" "node_modules/.cache/*" "tests/*"
   ```

2. **Upload to S3**
   ```bash
   aws s3 cp lambda-deployment.zip s3://your-deployment-bucket/webhooks/
   ```

3. **Deploy CloudFormation stack**
   ```bash
   aws cloudformation create-stack \
     --stack-name webqx-github-webhooks \
     --template-body file://../deployment/cloudformation.yaml \
     --parameters ParameterKey=WebhookSecret,ParameterValue=your-webhook-secret \
                  ParameterKey=Environment,ParameterValue=dev \
                  ParameterKey=LambdaCodeBucket,ParameterValue=your-deployment-bucket \
                  ParameterKey=LambdaCodeKey,ParameterValue=webhooks/lambda-deployment.zip \
     --capabilities CAPABILITY_NAMED_IAM
   ```

### 2. Configure GitHub Webhook

1. **Get the webhook URL**
   
   After deployment, get the API Gateway URL:
   ```bash
   # For SAM deployment
   sam list endpoints --stack-name webqx-github-webhooks
   
   # For CloudFormation
   aws cloudformation describe-stacks \
     --stack-name webqx-github-webhooks \
     --query 'Stacks[0].Outputs[?OutputKey==`WebhookApiUrl`].OutputValue' \
     --output text
   ```

2. **Add webhook to GitHub repository**
   
   - Go to your repository on GitHub
   - Navigate to **Settings** → **Webhooks**
   - Click **Add webhook**
   - Configure:
     - **Payload URL**: Your Lambda API Gateway URL (from step 1)
     - **Content type**: `application/json`
     - **Secret**: The webhook secret you used during deployment
     - **Which events**: Select events you want to monitor

3. **Recommended Events to Monitor**
   
   Select these events for comprehensive coverage:
   - ✅ **Push** - Code pushes to repository
   - ✅ **Pull requests** - PR creation, updates, merges
   - ✅ **Issues** - Issue creation and updates
   - ✅ **Releases** - Release publication
   - ✅ **Workflow runs** - GitHub Actions completion
   - ✅ **Deployments** - Deployment events
   
   Or select **Send me everything** for all events.

4. **Test the webhook**
   
   - Click **Add webhook**
   - GitHub will send a ping event
   - Check the webhook delivery to ensure it was successful

### 3. Verify Setup

1. **Test the health endpoint**
   ```bash
   curl https://your-api-gateway-url/health
   ```
   
   Expected response:
   ```json
   {
     "status": "healthy",
     "service": "webqx-github-webhooks",
     "version": "1.0.0",
     "timestamp": "2024-01-15T10:30:00.000Z"
   }
   ```

2. **Check CloudWatch logs**
   ```bash
   aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/webqx-github-webhooks"
   ```

3. **Trigger a test event**
   - Create a test commit or open a test issue
   - Check CloudWatch logs for processing messages
   - Verify webhook deliveries in GitHub settings

### 4. Environment Variables

Set these environment variables in your Lambda function:

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `WEBHOOK_SECRET` | GitHub webhook secret for signature verification | Yes | - |
| `ENVIRONMENT` | Deployment environment (dev/staging/prod) | No | dev |
| `LOG_LEVEL` | Logging level (DEBUG/INFO/WARN/ERROR) | No | INFO |

### 5. Security Considerations

1. **Webhook Secret**
   - Use a strong, random secret (32+ characters)
   - Store in AWS Systems Manager Parameter Store or Secrets Manager for production
   - Rotate regularly

2. **API Gateway**
   - Consider adding API keys for additional security
   - Use AWS WAF for DDoS protection in production
   - Monitor CloudWatch metrics for unusual activity

3. **Lambda Function**
   - Review IAM permissions regularly
   - Enable X-Ray tracing for debugging
   - Set up CloudWatch alarms for errors and duration

### 6. Monitoring and Alerting

1. **CloudWatch Alarms** (automatically created)
   - Error count > 5 in 5 minutes
   - Average duration > 25 seconds
   
2. **Custom Metrics**
   ```bash
   # View webhook processing metrics
   aws cloudwatch get-metric-statistics \
     --namespace AWS/Lambda \
     --metric-name Invocations \
     --dimensions Name=FunctionName,Value=webqx-github-webhooks-dev \
     --start-time 2024-01-15T00:00:00Z \
     --end-time 2024-01-15T23:59:59Z \
     --period 3600 \
     --statistics Sum
   ```

### 7. Troubleshooting

#### Common Issues

1. **Webhook delivery failed**
   - Check the webhook URL is correct
   - Verify API Gateway is deployed and accessible
   - Check Lambda function logs for errors

2. **Signature verification failed**
   - Ensure webhook secret matches between GitHub and Lambda
   - Check that signature header is being sent by GitHub

3. **Lambda timeout**
   - Check function duration in CloudWatch
   - Increase timeout if needed (max 15 minutes)
   - Optimize code for better performance

#### Debug Commands

```bash
# Check Lambda function status
aws lambda get-function --function-name webqx-github-webhooks-dev

# View recent logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/webqx-github-webhooks-dev \
  --start-time $(date -d '1 hour ago' +%s)000

# Test webhook endpoint
curl -X POST https://your-api-gateway-url/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: ping" \
  -d '{"zen": "Test payload"}'
```

### 8. Updating the Function

1. **Update code**
   ```bash
   cd webhooks/lambda
   # Make your changes
   sam build
   sam deploy
   ```

2. **Update configuration**
   ```bash
   # Update environment variables
   aws lambda update-function-configuration \
     --function-name webqx-github-webhooks-dev \
     --environment Variables='{WEBHOOK_SECRET=new-secret,LOG_LEVEL=DEBUG}'
   ```

## Next Steps

- Review [Event Reference](./EVENTS.md) for webhook event details
- Check [Security Guide](./SECURITY.md) for advanced security configuration
- Customize event processing logic in `lambda/lib/eventProcessor.js`
- Set up monitoring and alerting for production use