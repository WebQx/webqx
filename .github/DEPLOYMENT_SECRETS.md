# 🔐 GitHub Actions Deployment Configuration

This document outlines the required GitHub Secrets and Environment setup for the WebQx Healthcare Platform automated deployment workflow.

## 📋 Overview

The deployment workflow (`deploy.yml`) automates the entire deployment process for the WebQx Healthcare Platform, including environment setup, testing, building, deployment, and notifications. It supports multiple hosting providers and notification channels.

## 🚀 Workflow Features

### ✅ Trigger Events
- **Automatic**: Triggers on pushes to the `main` branch
- **Manual**: `workflow_dispatch` with options for environment selection and test skipping

### 🔧 Workflow Steps
1. **Setup & Validation**: Node.js setup, dependency installation, type checking
2. **Test Suite Execution**: Comprehensive test suite with coverage reports
3. **Build & Prepare**: Production build preparation and artifact creation
4. **Deploy to Production**: Multi-provider deployment support
5. **Notifications**: Slack, email, and GitHub summary notifications

## 🔑 Required GitHub Secrets

### Core Application Configuration

| Secret Name | Description | Required | Example |
|-------------|-------------|----------|---------|
| `PORT` | Application port | ❌ | `3000` |
| `NODE_ENV` | Node environment | ❌ | `production` |

### 🗄️ Database Configuration

| Secret Name | Description | Required | Example |
|-------------|-------------|----------|---------|
| `DATABASE_URL` | Full database connection string | ✅ | `postgresql://user:pass@host:5432/db` |
| `DB_HOST` | Database host | ✅ | `db.webqx.org` |
| `DB_PORT` | Database port | ✅ | `5432` |
| `DB_NAME` | Database name | ✅ | `webqx_healthcare` |
| `DB_USER` | Database username | ✅ | `webqx_user` |
| `DB_PASSWORD` | Database password | ✅ | `secure_password` |

### 🔒 Security & Authentication

| Secret Name | Description | Required | Example |
|-------------|-------------|----------|---------|
| `JWT_SECRET` | JWT signing secret (min 32 chars) | ✅ | `your_jwt_secret_key_min_32_chars` |
| `ENCRYPTION_KEY` | HIPAA compliance encryption key | ✅ | `your_encryption_key_for_hipaa` |
| `SESSION_SECRET` | Session secret key | ✅ | `your_session_secret_key` |

### 🏥 Healthcare API Integration

| Secret Name | Description | Required | Example |
|-------------|-------------|----------|---------|
| `FHIR_SERVER_URL` | FHIR server endpoint | ✅ | `https://fhir.webqx.org/fhir` |
| `HL7_ENDPOINT` | HL7 integration endpoint | ❌ | `https://hl7.webqx.org` |
| `PHARMACY_API_URL` | Pharmacy API endpoint | ❌ | `https://pharmacy-api.webqx.org` |

### 🤖 AI/NLP Services

| Secret Name | Description | Required | Example |
|-------------|-------------|----------|---------|
| `OPENAI_API_KEY` | OpenAI API key | ❌ | `sk-...` |
| `WHISPER_API_KEY` | Whisper API key | ❌ | `sk-...` |

### 📧 Email Configuration

| Secret Name | Description | Required | Example |
|-------------|-------------|----------|---------|
| `SMTP_HOST` | SMTP server host | ❌ | `smtp.webqx.org` |
| `SMTP_PORT` | SMTP server port | ❌ | `587` |
| `SMTP_USER` | SMTP username | ❌ | `noreply@webqx.org` |
| `SMTP_PASSWORD` | SMTP password | ❌ | `smtp_password` |
| `FROM_EMAIL` | From email address | ❌ | `noreply@webqx.org` |

## 🌐 Deployment Provider Configuration

### 🔧 SSH Deployment (Generic Server)

| Secret Name | Description | Required | Example |
|-------------|-------------|----------|---------|
| `SSH_HOST` | Server hostname/IP | ✅ | `webqx.org` |
| `SSH_USER` | SSH username | ✅ | `deploy` |
| `SSH_PRIVATE_KEY` | SSH private key | ✅ | `-----BEGIN PRIVATE KEY-----...` |

### ☁️ AWS Deployment

| Secret Name | Description | Required | Example |
|-------------|-------------|----------|---------|
| `AWS_ACCESS_KEY_ID` | AWS access key | ✅ | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | ✅ | `...` |
| `AWS_REGION` | AWS region | ❌ | `us-east-1` |
| `ECS_CLUSTER_NAME` | ECS cluster name | ❌ | `webqx-cluster` |
| `ECS_SERVICE_NAME` | ECS service name | ❌ | `webqx-service` |

### 🌐 Vercel Deployment

| Secret Name | Description | Required | Example |
|-------------|-------------|----------|---------|
| `VERCEL_TOKEN` | Vercel API token | ✅ | `...` |
| `VERCEL_ORG_ID` | Vercel organization ID | ✅ | `team_...` |
| `VERCEL_PROJECT_ID` | Vercel project ID | ✅ | `prj_...` |

### 🔄 Railway Deployment

| Secret Name | Description | Required | Example |
|-------------|-------------|----------|---------|
| `RAILWAY_TOKEN` | Railway API token | ✅ | `...` |

### 🌊 Netlify Deployment

| Secret Name | Description | Required | Example |
|-------------|-------------|----------|---------|
| `NETLIFY_AUTH_TOKEN` | Netlify auth token | ✅ | `...` |
| `NETLIFY_SITE_ID` | Netlify site ID | ✅ | `...` |

## 📢 Notification Configuration

### 💬 Slack Notifications

| Secret Name | Description | Required | Example |
|-------------|-------------|----------|---------|
| `SLACK_WEBHOOK_URL` | Slack webhook URL | ❌ | `https://hooks.slack.com/...` |

### 📧 Email Notifications

| Secret Name | Description | Required | Example |
|-------------|-------------|----------|---------|
| `NOTIFICATION_EMAIL` | Notification recipient email | ❌ | `team@webqx.org` |

### 🏥 Health Check

| Secret Name | Description | Required | Example |
|-------------|-------------|----------|---------|
| `HEALTH_CHECK_URL` | Health check endpoint | ❌ | `https://webqx.org/health` |

## 🛠️ Setup Instructions

### 1. Configure GitHub Secrets

1. Navigate to your repository on GitHub
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each required secret from the tables above

### 2. Configure GitHub Environments (Optional)

1. Go to **Settings** → **Environments**
2. Create environments: `production`, `staging`
3. Add environment-specific secrets and protection rules

### 3. Test the Workflow

1. Push to the `main` branch or trigger manually via **Actions** tab
2. Monitor the workflow execution
3. Check notifications in Slack/email

## 🔄 Workflow Customization

### Adding New Deployment Providers

To add support for additional hosting providers, edit `.github/workflows/deploy.yml`:

1. Add a new step in the `deploy-production` job
2. Use conditional execution based on provider-specific secrets
3. Follow the existing pattern for error handling and logging

### Environment-Specific Configuration

The workflow supports multiple environments:

- **Production**: Default environment for `main` branch pushes
- **Staging**: Available via manual trigger
- **Custom**: Extend the workflow for additional environments

### Notification Customization

Modify the `notify` job to:
- Add new notification channels
- Customize message formats
- Include additional deployment metadata

## 🔍 Troubleshooting

### Common Issues

1. **Secret Not Found**: Ensure all required secrets are configured
2. **Deployment Failed**: Check provider-specific credentials and configurations
3. **Test Failures**: Review test logs and consider using `skip_tests: true` for urgent deployments
4. **Type Check Errors**: The workflow continues with warnings, but consider fixing TypeScript issues

### Debug Mode

Enable debug logging by adding this secret:
- `ACTIONS_RUNNER_DEBUG`: `true`
- `ACTIONS_STEP_DEBUG`: `true`

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [WebQx Healthcare Platform Documentation](./README.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Environment Configuration](./.env.example)

## 🏥 Healthcare Compliance

This workflow is designed with healthcare compliance in mind:

- **HIPAA Compliance**: Uses encryption for sensitive data
- **Audit Logging**: Comprehensive logging for all deployment activities
- **Security**: Secure handling of credentials and patient data
- **Availability**: Health checks and monitoring for system reliability

## 🚀 Quick Start

For a minimal setup to get started:

1. **Required Secrets** (minimum viable deployment):
   ```
   DATABASE_URL
   JWT_SECRET
   ENCRYPTION_KEY
   SESSION_SECRET
   FHIR_SERVER_URL
   ```

2. **Choose One Deployment Method**:
   - SSH: `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`
   - OR Vercel: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
   - OR Railway: `RAILWAY_TOKEN`

3. **Optional but Recommended**:
   ```
   SLACK_WEBHOOK_URL (for notifications)
   HEALTH_CHECK_URL (for monitoring)
   ```

This configuration will enable basic automated deployment with monitoring and notifications.