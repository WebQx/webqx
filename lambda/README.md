# GitHub Webhook AWS Lambda Function

This directory contains an AWS Lambda function that handles GitHub webhook events for the WebQx/webqx repository. The function processes specific GitHub events and can trigger automated actions based on repository activity.

## Features

- **Secure Webhook Processing**: Verifies GitHub webhook signatures using HMAC-SHA256
- **Event Handling**: Supports push, pull request, issues, and ping events
- **Configurable Notifications**: Optional Slack notifications for processed events
- **Repository Filtering**: Only processes events from the WebQx/webqx repository
- **Error Handling**: Comprehensive error handling and logging
- **AWS SAM Deployment**: Infrastructure as Code using AWS SAM template

## Architecture

```
GitHub Repository (WebQx/webqx)
     ↓ (webhook)
API Gateway
     ↓
Lambda Function
     ↓ (optional)
Slack Notification
```

## Files Structure

```
lambda/
├── src/
│   └── index.js              # Main Lambda handler function
├── tests/
│   └── index.test.js         # Jest tests for the Lambda function
├── events/
│   ├── test-push-event.json  # Sample push event for testing
│   ├── test-pr-event.json    # Sample pull request event for testing
│   └── test-ping-event.json  # Sample ping event for testing
├── deployment/
├── template.yaml             # AWS SAM template
├── package.json              # Node.js dependencies and scripts
├── deploy.sh                 # Deployment script
└── README.md                 # This file
```

## Supported GitHub Events

### Push Events
- **Main/Master Branch**: Triggers actions for production deployments
- **Feature Branches**: Logs feature branch activity
- **Processing**: Extracts commit information, pusher details, and branch information

### Pull Request Events
- **Opened**: New pull request created
- **Closed**: Pull request closed (merged or cancelled)
- **Synchronize**: New commits added to existing pull request
- **Processing**: Extracts PR number, title, author, and merge status

### Issues Events
- **Opened**: New issue created
- **Closed**: Issue resolved or closed
- **Labeled**: Labels added to issues
- **Processing**: Extracts issue number, title, author, and labels

### Ping Events
- **Webhook Test**: GitHub ping to verify webhook connectivity
- **Processing**: Confirms webhook is properly configured

## Prerequisites

### Required Tools
- [AWS CLI](https://aws.amazon.com/cli/) - Configured with appropriate credentials
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html) - For deployment
- [Node.js 18+](https://nodejs.org/) - For local development and testing
- [Jest](https://jestjs.io/) - For running tests (installed via npm)

### AWS Setup
1. **AWS Account**: Access to AWS account with Lambda and API Gateway permissions
2. **S3 Bucket**: For storing deployment artifacts
3. **IAM Permissions**: Ability to create Lambda functions, API Gateway, and CloudWatch logs

### GitHub Setup
1. **Repository Access**: Admin access to WebQx/webqx repository
2. **Webhook Secret**: Generate a secure secret for webhook signature verification

## Installation

### 1. Install Dependencies
```bash
cd lambda
npm install
```

### 2. Run Tests
```bash
npm test
```

### 3. Run Tests with Coverage
```bash
npm run test:coverage
```

## Deployment

### Quick Deployment
```bash
# Replace with your actual values
./deploy.sh \
  --bucket my-deployment-bucket \
  --github-secret your-github-webhook-secret
```

### Development Deployment
```bash
./deploy.sh \
  --stage dev \
  --bucket my-dev-bucket \
  --github-secret dev-webhook-secret \
  --slack-webhook-url https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
```

### Production Deployment
```bash
./deploy.sh \
  --stage prod \
  --bucket my-prod-bucket \
  --github-secret prod-webhook-secret \
  --slack-webhook-url https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
```

### Deployment Options

| Option | Description | Required | Default |
|--------|-------------|----------|---------|
| `--stage` | Deployment stage (dev/staging/prod) | No | prod |
| `--region` | AWS region | No | us-east-1 |
| `--bucket` | S3 bucket for deployment artifacts | Yes | - |
| `--stack-name` | CloudFormation stack name | No | webqx-github-webhook |
| `--github-secret` | GitHub webhook secret | Yes | - |
| `--slack-webhook-url` | Slack webhook URL (optional) | No | - |

## GitHub Webhook Configuration

After deployment, configure the webhook in your GitHub repository:

1. **Navigate to Repository Settings**
   - Go to https://github.com/WebQx/webqx/settings/hooks

2. **Add Webhook**
   - Click "Add webhook"
   - **Payload URL**: Use the URL provided after deployment
   - **Content type**: `application/json`
   - **Secret**: Enter your GitHub webhook secret
   - **Events**: Select "Let me select individual events"
     - ✅ Pushes
     - ✅ Pull requests
     - ✅ Issues
   - **Active**: ✅ Checked

3. **Test Webhook**
   - GitHub will send a ping event to test connectivity
   - Check CloudWatch logs to verify the ping was received

## Local Development

### Local Testing with SAM
```bash
# Start local API Gateway
npm run local

# In another terminal, test with sample events
npm run invoke:local
```

### Manual Testing
```bash
# Test with specific event
sam local invoke GitHubWebhookFunction -e events/test-push-event.json

# Test with PR event
sam local invoke GitHubWebhookFunction -e events/test-pr-event.json

# Test with ping event
sam local invoke GitHubWebhookFunction -e events/test-ping-event.json
```

### View Logs
```bash
# View recent logs
npm run logs

# View logs for specific deployment
sam logs -n GitHubWebhookFunction --stack-name webqx-github-webhook-dev --tail
```

## Environment Variables

The Lambda function uses the following environment variables:

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `GITHUB_WEBHOOK_SECRET` | Secret for verifying GitHub webhooks | Yes (Prod) | `your-secret-here` |
| `SLACK_WEBHOOK_URL` | Slack webhook URL for notifications | No | `https://hooks.slack.com/...` |
| `STAGE` | Deployment stage | No | `prod` |
| `NODE_ENV` | Node.js environment | No | `production` |

## Security

### Webhook Security
- **Signature Verification**: All webhooks are verified using HMAC-SHA256
- **Repository Filtering**: Only processes events from WebQx/webqx repository
- **HTTPS Only**: API Gateway enforces HTTPS for all requests

### AWS Security
- **IAM Roles**: Lambda function uses least-privilege IAM role
- **CloudWatch Logs**: All events are logged for audit purposes
- **Secrets Management**: Webhook secrets stored as CloudFormation parameters

## Monitoring

### CloudWatch Logs
- Log Group: `/aws/lambda/GitHubWebhookFunction`
- Retention: 14 days
- Logs include event details, processing results, and errors

### CloudWatch Metrics
- **Invocations**: Number of function invocations
- **Duration**: Function execution time
- **Errors**: Number of failed executions
- **Throttles**: Number of throttled requests

### Alarms (Optional)
You can set up CloudWatch alarms for:
- High error rates
- Long execution times
- Failed webhook verifications

## Troubleshooting

### Common Issues

#### 1. Webhook Signature Verification Failed
```
Error: Invalid GitHub signature
```
**Solutions:**
- Verify GitHub webhook secret matches Lambda environment variable
- Ensure webhook is configured with correct secret in GitHub
- Check that content type is set to `application/json`

#### 2. Events Not Processing
```
Event ignored - wrong repository
```
**Solutions:**
- Verify webhook is configured on WebQx/webqx repository
- Check repository name in webhook payload

#### 3. Deployment Fails
```
S3 bucket does not exist
```
**Solutions:**
- Create S3 bucket manually or use deployment script to create it
- Verify AWS credentials have S3 permissions
- Ensure bucket name is globally unique

#### 4. Function Timeout
```
Task timed out after 30.00 seconds
```
**Solutions:**
- Check for infinite loops in event processing
- Verify external service calls (Slack) are responding
- Increase timeout in template.yaml if needed

### Debug Steps

1. **Check CloudWatch Logs**
   ```bash
   aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/GitHubWebhook"
   ```

2. **Test Locally**
   ```bash
   sam local invoke GitHubWebhookFunction -e events/test-ping-event.json
   ```

3. **Verify Deployment**
   ```bash
   aws cloudformation describe-stacks --stack-name webqx-github-webhook-prod
   ```

4. **Test API Gateway**
   ```bash
   curl -X POST [WEBHOOK_URL] \
     -H "Content-Type: application/json" \
     -H "X-GitHub-Event: ping" \
     -d '{"repository":{"full_name":"WebQx/webqx"}}'
   ```

## Extending the Function

### Adding New Event Types
1. Add event handler function (e.g., `handleReleaseEvent`)
2. Add case in main switch statement
3. Add tests for new event type
4. Update GitHub webhook configuration

### Adding External Integrations
1. Add environment variables for service credentials
2. Create service client functions
3. Add error handling for external service calls
4. Update IAM permissions if needed

### Custom Actions
The function can be extended to perform various actions:
- **CI/CD Triggers**: Start build/deployment pipelines
- **Issue Management**: Auto-assign issues, add labels
- **Code Quality**: Trigger code analysis tools
- **Notifications**: Send to multiple channels (email, SMS, etc.)
- **Database Updates**: Log events to external databases

## Cost Optimization

### Lambda Costs
- **Memory**: 256MB (adjustable in template.yaml)
- **Timeout**: 30 seconds (adjustable based on needs)
- **Expected Usage**: ~100-1000 invocations per month for typical repository

### API Gateway Costs
- **Regional API**: Lower cost than edge-optimized
- **Request-based pricing**: Pay per webhook received

### Monitoring Costs
- **CloudWatch Logs**: 14-day retention to minimize costs
- **Metrics**: Basic metrics included with Lambda

## Contributing

1. **Fork Repository**: Create feature branch
2. **Add Tests**: Ensure new functionality is tested
3. **Update Documentation**: Keep README current
4. **Submit PR**: Include description of changes

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE.md](../LICENSE.md) file for details.