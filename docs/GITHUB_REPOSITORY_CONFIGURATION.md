# GitHub Repository Configuration Guide

This document provides step-by-step instructions for configuring the GitHub repository settings to work with the implemented CI/CD infrastructure and enforce branch protection rules.

## Repository Settings Configuration

### 1. General Repository Settings

Navigate to **Settings > General** in your GitHub repository:

#### Security and Analysis
- ✅ **Dependency graph** - Enable
- ✅ **Dependabot alerts** - Enable  
- ✅ **Dependabot security updates** - Enable
- ✅ **Code scanning** - Enable (will use CodeQL from CI workflow)
- ✅ **Secret scanning** - Enable
- ✅ **Secret scanning push protection** - Enable

#### Features
- ✅ **Issues** - Enable for bug tracking
- ✅ **Projects** - Enable for project management
- ✅ **Wiki** - Enable for documentation
- ✅ **Discussions** - Enable for community engagement

#### Pull Requests
- ✅ **Allow merge commits** - Enable
- ✅ **Allow squash merging** - Enable
- ✅ **Allow rebase merging** - Enable
- ✅ **Always suggest updating pull request branches** - Enable
- ✅ **Allow auto-merge** - Enable (optional)
- ✅ **Automatically delete head branches** - Enable

### 2. Branch Protection Rules

Navigate to **Settings > Branches** and click **Add rule**:

#### Branch name pattern
- `main` (or your default branch name)

#### Protect matching branches

**Require a pull request before merging:**
- ✅ Enable this setting
- **Required number of reviewers before merging:** `1` (minimum for healthcare)
- ✅ **Dismiss stale pull request approvals when new commits are pushed**
- ✅ **Require review from code owners**
- ✅ **Restrict pushes that create files that have a path that matches one**
- ✅ **Require approval of the most recent reviewable push**

**Require status checks to pass before merging:**
- ✅ Enable this setting
- ✅ **Require branches to be up to date before merging**

**Required status checks** (add these one by one):
```
Test Suite (16.x)
Test Suite (18.x)  
Test Suite (20.x)
Code Quality
Security Audit
Build Check
PR Validation
```

**Additional restrictions:**
- ✅ **Restrict pushes that create files that have a path that matches one**
- ✅ **Require signed commits**
- ✅ **Require linear history** (optional - enforces clean history)
- ✅ **Do not allow bypassing the above settings**
- ❌ **Allow force pushes** (disabled for security)
- ❌ **Allow deletions** (disabled for data integrity)

**Rules applied to administrators:**
- ✅ **Include administrators** (administrators must follow the same rules)

#### Environment Protection (Optional)

For production deployments, consider adding environment protection rules:
1. Navigate to **Settings > Environments**
2. Create environments: `development`, `staging`, `production`
3. Configure deployment protection rules for `production`:
   - Required reviewers
   - Wait timer (e.g., 5 minutes)
   - Deployment branches (limit to `main` only)

### 3. Secrets and Variables

Navigate to **Settings > Secrets and variables > Actions**:

#### Repository secrets (add as needed):
```
CODECOV_TOKEN         # For code coverage reporting
SLACK_WEBHOOK_URL     # For notifications (optional)
SENTRY_AUTH_TOKEN     # For error monitoring (optional)
```

#### Repository variables:
```
NODE_VERSION          # "18.x" (default Node.js version)
COVERAGE_THRESHOLD    # "80" (minimum test coverage percentage)
```

### 4. Code Security and Analysis

Navigate to **Settings > Code security and analysis**:

#### Dependency graph
- ✅ **Dependency graph** - Enable

#### Dependabot
- ✅ **Dependabot alerts** - Enable
- ✅ **Dependabot security updates** - Enable
- ✅ **Dependabot version updates** - Enable (configured via .github/dependabot.yml)

#### Code scanning
- ✅ **Code scanning** - Enable
- Configure **CodeQL Analysis** (already set up in CI workflow)
- Set up alerts to notify security team

#### Secret scanning
- ✅ **Secret scanning** - Enable
- ✅ **Push protection** - Enable (prevents pushing secrets)

### 5. Notifications and Integrations

#### Email Notifications
Navigate to **Settings > Notifications**:
- Configure notifications for security alerts
- Set up notifications for pull requests requiring review

#### Slack Integration (Optional)
1. Install GitHub app in Slack workspace
2. Configure notifications for:
   - Failed CI builds
   - Security alerts
   - Pull request reviews needed

#### Status Checks Integration
- Ensure all CI workflows provide appropriate status contexts
- Configure external status checks if using third-party tools

### 6. Team and Collaborator Access

Navigate to **Settings > Manage access**:

#### Teams and Permissions
Create teams with appropriate access levels:
- **Maintainers** - Admin access
- **Healthcare-Developers** - Write access
- **Reviewers** - Triage access for code review
- **Security-Team** - Read access for security monitoring

#### Branch Protection Exemptions
Consider creating a **break-glass** process for emergency fixes:
- Document the process in `docs/EMERGENCY_PROCEDURES.md`
- Require post-incident review for any protection bypasses
- Log all emergency actions for compliance audits

### 7. Compliance and Audit Configuration

#### Audit Log Access
- Enable organization audit log access
- Configure retention policies for compliance requirements
- Set up automated audit log exports if required

#### Compliance Integration
- Configure integration with compliance monitoring tools
- Set up automated compliance reporting
- Document all configuration changes for audit trails

## Verification Checklist

After configuring all settings, verify the setup:

### Branch Protection Verification
- [ ] Create a test branch and PR
- [ ] Verify all status checks run and must pass
- [ ] Confirm code owner review is required
- [ ] Test that force pushes are blocked
- [ ] Verify commit signing requirement

### CI/CD Pipeline Verification
- [ ] Trigger all workflows with a test commit
- [ ] Verify test suite runs on all Node.js versions
- [ ] Confirm linting and formatting checks work
- [ ] Test security scanning detects vulnerabilities
- [ ] Verify build process completes successfully

### Security Configuration Verification
- [ ] Test secret scanning blocks sensitive data
- [ ] Verify Dependabot creates security PRs
- [ ] Confirm CodeQL analysis runs
- [ ] Test that alerts are properly routed

### Access Control Verification
- [ ] Verify team permissions are correctly applied
- [ ] Test code owner requirements
- [ ] Confirm administrator restrictions work
- [ ] Validate emergency access procedures

## Maintenance and Updates

### Regular Reviews
- **Monthly**: Review branch protection settings
- **Quarterly**: Audit access permissions and team memberships
- **Bi-annually**: Review and update security configurations

### Update Procedures
- Document all configuration changes
- Test changes in a staging environment first
- Notify team of any changes that affect workflows
- Update this documentation when settings change

### Monitoring and Alerts
- Set up monitoring for failed status checks
- Configure alerts for security vulnerabilities
- Monitor compliance with protection rules
- Track metrics on code review effectiveness

## Troubleshooting

### Common Issues and Solutions

**Status checks not appearing:**
- Verify GitHub Actions are enabled
- Check workflow file syntax
- Ensure correct branch triggers are configured

**Code owners not enforced:**
- Verify CODEOWNERS file syntax
- Ensure code owners have repository access
- Check file path patterns match repository structure

**Commit signing issues:**
- Verify GPG keys are properly configured
- Check Git configuration for commit signing
- Ensure team members have signed their commits

### Support Contacts

For configuration assistance:
- **Technical Issues**: Create repository issue
- **Security Concerns**: Contact security@webqx.health
- **Compliance Questions**: Contact compliance team

---

**Last Updated**: Current  
**Version**: 1.0  
**Reviewed By**: WebQX Security Team