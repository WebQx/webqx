# GitHub Webhook Lambda Function Setup Guide

This guide provides step-by-step instructions for deploying and configuring the AWS Lambda function to handle GitHub webhook events for the WebQx/webqx repository.

## Quick Start

```bash
# 1. Navigate to the lambda directory
cd lambda

# 2. Install dependencies
npm install

# 3. Run tests to verify everything works
npm test

# 4. Deploy to AWS (replace with your values)
./deploy.sh \
  --bucket your-deployment-bucket \
  --github-secret your-webhook-secret
```

## Prerequisites

### 1. AWS Account Setup

You need an AWS account with the following permissions:
- Lambda function creation and management
- API Gateway creation and management
- CloudFormation stack operations
- S3 bucket operations (for deployment artifacts)
- CloudWatch logs access

### 2. Install Required Tools

#### AWS CLI
```bash
# Install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure AWS credentials
aws configure
```

#### AWS SAM CLI
```bash
# Install SAM CLI
pip3 install aws-sam-cli

# Verify installation
sam --version
```

#### Node.js 18+
```bash
# Install Node.js using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18
```

### 3. Generate GitHub Webhook Secret

```bash
# Generate a secure random secret
openssl rand -base64 32
```

Save this secret - you'll need it for both AWS deployment and GitHub webhook configuration.

## Deployment Steps

### Step 1: Prepare S3 Bucket

Create an S3 bucket for storing deployment artifacts:

```bash
# Replace 'your-unique-bucket-name' with a globally unique name
aws s3 mb s3://your-unique-bucket-name --region us-east-1
```

### Step 2: Deploy Lambda Function

#### Development Environment
```bash
./deploy.sh \
  --stage dev \
  --bucket your-deployment-bucket \
  --github-secret your-webhook-secret \
  --slack-webhook-url https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
```

#### Production Environment
```bash
./deploy.sh \
  --stage prod \
  --bucket your-deployment-bucket \
  --github-secret your-webhook-secret \
  --slack-webhook-url https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
```

### Step 3: Note the Webhook URL

After successful deployment, the script will output the webhook URL:
```
Webhook URL: https://abcd1234.execute-api.us-east-1.amazonaws.com/prod/webhook
```

## GitHub Repository Configuration

### Step 1: Access Repository Settings

1. Navigate to https://github.com/WebQx/webqx
2. Click on **Settings** tab
3. Click on **Webhooks** in the left sidebar

### Step 2: Add New Webhook

1. Click **"Add webhook"** button
2. Fill in the form:

| Field | Value |
|-------|-------|
| **Payload URL** | The webhook URL from deployment output |
| **Content type** | `application/json` |
| **Secret** | Your GitHub webhook secret |
| **SSL verification** | ✅ Enable SSL verification |

### Step 3: Select Events

Choose **"Let me select individual events"** and select:
- ✅ **Pushes**
- ✅ **Pull requests**
- ✅ **Issues**

Uncheck any other events unless specifically needed.

### Step 4: Activate Webhook

- ✅ **Active** checkbox should be checked
- Click **"Add webhook"**

### Step 5: Test Webhook

GitHub will automatically send a **ping** event to test the webhook. Check:
1. Green checkmark appears next to the webhook
2. Recent Deliveries show successful ping event
3. AWS CloudWatch logs show the ping was received

## Verification and Testing

### 1. Check CloudWatch Logs

```bash
# View recent logs
aws logs describe-log-streams \
  --log-group-name "/aws/lambda/webqx-github-webhook-prod-GitHubWebhookFunction-XXXXX" \
  --order-by LastEventTime \
  --descending

# Get log events
aws logs get-log-events \
  --log-group-name "/aws/lambda/webqx-github-webhook-prod-GitHubWebhookFunction-XXXXX" \
  --log-stream-name "LATEST_STREAM_NAME"
```

### 2. Test Different Events

#### Test Push Event
1. Make a small change to your repository
2. Commit and push to a feature branch
3. Check CloudWatch logs for push event processing

#### Test Pull Request Event
1. Create a new pull request
2. Check logs for pull request opened event

#### Test Issues Event
1. Create a new issue
2. Check logs for issue opened event

### 3. Monitor Lambda Metrics

Check AWS Lambda console for:
- **Invocations**: Number of webhook calls
- **Duration**: Processing time (should be < 5 seconds)
- **Errors**: Should be 0 for successful setup
- **Throttles**: Should be 0

## Troubleshooting

### Common Issues

#### 1. "Invalid signature" errors
```
Error: Invalid GitHub signature
```

**Solution:**
- Verify the webhook secret matches in both GitHub and AWS
- Ensure Content-type is set to `application/json` in GitHub

#### 2. "Event ignored - wrong repository"
```
Event ignored - wrong repository
```

**Solution:**
- Ensure webhook is configured on WebQx/webqx repository
- Check repository name in webhook payload

#### 3. Lambda function not receiving events
```
No logs appearing in CloudWatch
```

**Solutions:**
- Verify API Gateway URL is correct in GitHub webhook
- Check API Gateway logs for incoming requests
- Ensure webhook is marked as "Active" in GitHub

#### 4. Deployment failures

**S3 bucket issues:**
```bash
# Check if bucket exists and is accessible
aws s3 ls s3://your-bucket-name

# Create bucket if it doesn't exist
aws s3 mb s3://your-bucket-name
```

**SAM CLI issues:**
```bash
# Reinstall SAM CLI
pip3 uninstall aws-sam-cli
pip3 install aws-sam-cli

# Clear SAM cache
rm -rf ~/.aws-sam
```

**CloudFormation stack issues:**
```bash
# Check stack status
aws cloudformation describe-stacks --stack-name webqx-github-webhook-prod

# Delete and redeploy if needed
aws cloudformation delete-stack --stack-name webqx-github-webhook-prod
```

## Advanced Configuration

### Custom Event Processing

To add support for additional GitHub events:

1. **Add event handler function** in `src/index.js`:
```javascript
async function handleReleaseEvent(payload) {
    // Process release events
    return {
        action: 'release_created',
        processed: true,
        message: 'Release event processed'
    };
}
```

2. **Add case to main switch statement**:
```javascript
case 'release':
    result = await handleReleaseEvent(payload);
    break;
```

3. **Update GitHub webhook configuration** to include release events

### Environment-Specific Configurations

#### Development Configuration
```bash
./deploy.sh \
  --stage dev \
  --bucket webqx-dev-deployments \
  --github-secret dev-webhook-secret \
  --region us-west-2
```

#### Staging Configuration
```bash
./deploy.sh \
  --stage staging \
  --bucket webqx-staging-deployments \
  --github-secret staging-webhook-secret \
  --region us-east-1
```

### Monitoring and Alerting

#### CloudWatch Alarms
```bash
# Create alarm for high error rate
aws cloudwatch put-metric-alarm \
  --alarm-name "webqx-webhook-errors" \
  --alarm-description "High error rate in webhook function" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=webqx-github-webhook-prod-GitHubWebhookFunction-XXXXX
```

#### SNS Notifications
Add SNS topic to SAM template for error notifications:
```yaml
ErrorNotificationTopic:
  Type: AWS::SNS::Topic
  Properties:
    DisplayName: WebQx Webhook Errors
    Subscription:
      - Protocol: email
        Endpoint: admin@webqx.com
```

## Maintenance

### Regular Tasks

#### Update Dependencies
```bash
cd lambda
npm update
npm audit fix
npm test
```

#### Monitor Costs
- Check AWS Lambda billing
- Monitor API Gateway request counts
- Review CloudWatch logs retention

#### Security Reviews
- Rotate webhook secrets quarterly
- Review IAM permissions
- Update Lambda runtime as needed

### Backup and Recovery

#### Export Configuration
```bash
# Export CloudFormation template
aws cloudformation get-template \
  --stack-name webqx-github-webhook-prod \
  --template-stage Processed > backup-template.json
```

#### Disaster Recovery
1. Keep deployment scripts in version control
2. Document all configuration values
3. Test deployment in different AWS regions

## Support

For issues with this Lambda function:
1. Check CloudWatch logs first
2. Review GitHub webhook delivery history
3. Verify AWS service status
4. Test locally using `sam local invoke`

For AWS-specific issues:
- AWS Support (if you have a support plan)
- AWS Documentation: https://docs.aws.amazon.com/lambda/
- AWS Forums: https://forums.aws.amazon.com/

For GitHub webhook issues:
- GitHub Documentation: https://docs.github.com/en/developers/webhooks-and-events/webhooks
- GitHub Support: https://support.github.com/