# GitHub Webhooks to AWS Lambda Integration

This module provides a complete setup for integrating GitHub webhooks with AWS Lambda functions to enable automated processing of repository events.

## Overview

The webhook integration allows you to:
- Receive GitHub webhook events (push, pull_request, etc.) in AWS Lambda
- Verify webhook authenticity using HMAC-SHA256 signatures
- Process different event types with custom business logic
- Scale automatically based on webhook volume
- Maintain security through proper authentication

## Architecture

```
GitHub Repository → Webhook → API Gateway → Lambda Function → Processing Logic
```

## Quick Start

1. **Deploy the Lambda Function**
   ```bash
   cd webhooks/lambda
   npm install
   sam build
   sam deploy --guided
   ```

2. **Configure GitHub Webhook**
   - Go to your repository Settings → Webhooks
   - Add webhook with your Lambda's API Gateway URL
   - Set Content-Type to `application/json`
   - Configure events you want to monitor
   - Add your webhook secret

3. **Set Environment Variables**
   ```bash
   export WEBHOOK_SECRET="your-webhook-secret"
   export AWS_REGION="us-east-1"
   ```

## Supported Events

- `push` - Code pushes to repository
- `pull_request` - Pull request opened, closed, merged
- `issues` - Issue creation, updates, comments
- `release` - Release creation and updates
- `deployment` - Deployment events
- `workflow_run` - GitHub Actions workflow completion

## Security

- HMAC-SHA256 signature verification
- Environment-based secret management
- Input validation and sanitization
- Error handling with proper logging

## Files Structure

```
webhooks/
├── README.md                 # This file
├── lambda/                   # Lambda function code
│   ├── index.js             # Main Lambda handler
│   ├── package.json         # Dependencies
│   └── lib/                 # Helper libraries
├── deployment/              # AWS deployment templates
│   ├── template.yaml        # SAM template
│   └── cloudformation.yaml  # Alternative CloudFormation
├── docs/                    # Detailed documentation
│   ├── SETUP.md            # Step-by-step setup guide
│   ├── EVENTS.md           # Webhook event reference
│   └── SECURITY.md         # Security considerations
└── tests/                   # Test files
    ├── webhook.test.js      # Webhook processing tests
    └── fixtures/            # Test data
```

## Next Steps

1. Review the [Setup Guide](./docs/SETUP.md) for detailed configuration
2. Check [Event Reference](./docs/EVENTS.md) for webhook event details
3. Review [Security Guide](./docs/SECURITY.md) for security best practices