# 🚀 WebQX CI/CD Pipeline Setup Guide

This guide helps you set up and configure the CI/CD pipeline for the WebQX Healthcare Platform.

## ⚡ Quick Setup Checklist

### 1. Repository Secrets Configuration

Configure these secrets in GitHub Repository Settings → Secrets and variables → Actions:

```bash
# Required for deployment
RAILWAY_TOKEN=rw_***                    # Railway CLI authentication token
RAILWAY_STAGING_PROJECT_ID=xxx          # Railway staging project ID  
RAILWAY_PRODUCTION_PROJECT_ID=xxx       # Railway production project ID

# Optional for notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...  # Slack notifications

# Optional for security scanning
SNYK_TOKEN=xxx                          # Snyk security scanning token
```

### 2. GitHub Environment Protection

Set up these environments in Repository Settings → Environments:

#### `staging`
- **Protection rules**: None required
- **Deployment branches**: `develop` only
- **Environment secrets**: None required

#### `production`
- **Protection rules**: Required reviewers (DevOps team, Lead Developer)
- **Deployment branches**: `main` only  
- **Wait timer**: 0 minutes
- **Environment secrets**: Production-specific overrides if needed

#### `production-rollback`
- **Protection rules**: Required reviewers (Senior DevOps, Technical Lead)
- **Deployment branches**: Any
- **Environment secrets**: None required

### 3. Railway Project Setup

#### Staging Environment
```bash
# Create staging service
railway new webqx-staging
railway env set NODE_ENV=staging
railway env set DATABASE_URL=<staging-db-url>
# Copy RAILWAY_STAGING_PROJECT_ID from project settings
```

#### Production Environment  
```bash
# Create production service
railway new webqx-production
railway env set NODE_ENV=production
railway env set DATABASE_URL=<production-db-url>
# Copy RAILWAY_PRODUCTION_PROJECT_ID from project settings
```

### 4. Branch Protection Rules

Configure branch protection for `main` and `develop`:

#### `main` branch:
- ✅ Require a pull request before merging
- ✅ Require status checks to pass before merging
  - ✅ CI - Test & Build / build-summary
- ✅ Restrict pushes that create files larger than 100MB
- ✅ Require conversation resolution before merging

#### `develop` branch:
- ✅ Require status checks to pass before merging
  - ✅ CI - Test & Build / build-summary
- ✅ Restrict pushes that create files larger than 100MB

## 🔧 Configuration Steps

### Step 1: Railway Setup

1. **Install Railway CLI**:
   ```bash
   curl -fsSL https://railway.app/install.sh | sh
   ```

2. **Login and get token**:
   ```bash
   railway login
   railway auth
   # Copy the token for RAILWAY_TOKEN secret
   ```

3. **Create projects**:
   ```bash
   # Staging
   railway new webqx-staging
   railway env set NODE_ENV=staging
   
   # Production  
   railway new webqx-production
   railway env set NODE_ENV=production
   ```

4. **Get project IDs**:
   ```bash
   railway status
   # Copy project IDs for secrets
   ```

### Step 2: GitHub Configuration

1. **Add Repository Secrets**:
   - Go to Settings → Secrets and variables → Actions
   - Add each required secret from the checklist above

2. **Configure Environments**:
   - Go to Settings → Environments
   - Create each environment with protection rules as specified

3. **Set Branch Protection**:
   - Go to Settings → Branches
   - Add protection rules for `main` and `develop` branches

### Step 3: Slack Integration (Optional)

1. **Create Slack App**:
   - Go to https://api.slack.com/apps
   - Create new app for your workspace
   - Enable Incoming Webhooks
   - Create webhook for desired channel

2. **Add Webhook URL**:
   - Copy webhook URL to `SLACK_WEBHOOK_URL` secret
   - Test with: `curl -X POST -H 'Content-type: application/json' --data '{"text":"Test message"}' $WEBHOOK_URL`

### Step 4: Validation

Run the validation workflow to ensure everything is configured correctly:

```bash
# Trigger validation workflow
gh workflow run validate-cicd.yml

# Check status
gh run list --workflow=validate-cicd.yml
```

## 🚀 Usage Examples

### Deploying to Staging

Staging deployments are automatic:
```bash
# Push to develop branch triggers staging deployment
git checkout develop
git merge feature-branch
git push origin develop
```

### Deploying to Production

Production deployments require manual approval:
```bash
# Use GitHub Actions UI or CLI
gh workflow run deploy-production.yml \
  -f version=main \
  -f reason="Monthly release with new features" \
  -f notify_teams=true
```

### Emergency Rollback

For critical issues:
```bash
# Emergency rollback (bypasses some checks)
gh workflow run rollback.yml \
  -f environment=production \
  -f version=previous \
  -f reason="Critical security vulnerability" \
  -f emergency=true
```

### Standard Rollback

For non-emergency situations:
```bash
# Standard rollback with full safety checks
gh workflow run rollback.yml \
  -f environment=production \
  -f version=v1.2.3 \
  -f reason="Performance regression" \
  -f emergency=false
```

## 📊 Monitoring

### Health Check URLs

- **Staging**: `https://staging.webqx.health/health`
- **Production**: `https://webqx.health/health`

### Key Metrics to Monitor

- Deployment success rate (target: >95%)
- Deployment duration (target: <30 minutes for production)
- Rollback frequency (target: <5% of deployments)
- Health check response time (target: <2 seconds)

### Alerts Setup

Consider setting up monitoring alerts for:
- Failed deployments
- Health check failures
- High response times
- Memory/CPU usage spikes

## 🔒 Security Considerations

### Secrets Management
- ✅ Use GitHub secrets for sensitive data
- ✅ Rotate tokens regularly (quarterly)
- ✅ Use principle of least privilege
- ✅ Audit secret access regularly

### Environment Security
- ✅ Different secrets for staging/production
- ✅ Network isolation between environments  
- ✅ Regular security scans
- ✅ HIPAA compliance validation

### Access Controls
- ✅ Limited deployment permissions
- ✅ Required approvals for production
- ✅ Audit trails for all deployments
- ✅ Emergency access procedures

## 🐛 Troubleshooting

### Common Issues

1. **Railway Token Expired**:
   ```bash
   railway auth  # Get new token
   # Update RAILWAY_TOKEN secret
   ```

2. **Environment Variables Missing**:
   ```bash
   railway vars  # Check current variables
   railway env set KEY=value  # Add missing variables
   ```

3. **Health Check Failures**:
   ```bash
   # Check application logs
   railway logs --tail 100
   
   # Test endpoint manually
   curl -v https://your-app.railway.app/health
   ```

4. **Deployment Stuck**:
   ```bash
   # Check Railway deployment status
   railway status
   
   # Cancel stuck deployment
   gh run cancel <run-id>
   ```

### Getting Help

- **GitHub Issues**: Create issue with `ci-cd` label
- **DevOps Team**: devops@webqx.health
- **Emergency**: Use emergency rollback procedures

## 📝 Next Steps

After setup:

1. **Test the Pipeline**:
   - Create a test PR to verify CI
   - Deploy to staging to test automation
   - Practice production deployment process

2. **Team Training**:
   - Review CI/CD documentation with team
   - Practice rollback procedures
   - Set up monitoring dashboards

3. **Optimization**:
   - Monitor deployment metrics
   - Optimize build times
   - Enhance security scans
   - Add integration tests

4. **Documentation**:
   - Update team runbooks
   - Document incident procedures
   - Create monitoring dashboards

---

**Setup completed?** Run the validation workflow to verify everything is working correctly:

```bash
gh workflow run validate-cicd.yml
```

For detailed documentation, see [CI-CD-DOCUMENTATION.md](./CI-CD-DOCUMENTATION.md).