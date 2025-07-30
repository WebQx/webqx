# Branch Protection Setup Guide

This document provides step-by-step instructions for setting up branch protection rules for the WebQX healthcare platform repository to ensure code quality, security, and compliance with healthcare standards.

## Overview

Branch protection rules are essential for maintaining the integrity and security of healthcare software. This guide establishes requirements that align with HIPAA compliance, clinical safety standards, and software engineering best practices.

## Prerequisites

Before setting up branch protection rules, ensure the following CI/CD infrastructure is in place:

- [x] GitHub Actions workflows (`/.github/workflows/`)
- [x] Code owners file (`/.github/CODEOWNERS`)
- [x] Issue and PR templates (`/.github/ISSUE_TEMPLATE/`, `/.github/pull_request_template.md`)
- [x] ESLint and Prettier configuration
- [x] Dependabot configuration
- [x] Test suite and coverage reporting

## Required Branch Protection Settings

### 1. Code Review Requirements

Navigate to **Settings > Branches** in your GitHub repository and configure:

**Require a pull request before merging:**
- ✅ **Require approvals:** 1 (minimum for healthcare projects)
- ✅ **Dismiss stale pull request approvals when new commits are pushed**
- ✅ **Require review from code owners** (uses `.github/CODEOWNERS`)
- ✅ **Restrict pushes that create files that have a path that matches one**
- ✅ **Require approval of the most recent reviewable push**

**Rationale:** Healthcare software requires peer review to catch potential issues that could affect patient safety or data security.

### 2. Status Check Requirements

**Require status checks to pass before merging:**
- ✅ **Require branches to be up to date before merging**

**Required status checks to include:**
- `Test Suite (16.x)` - Node.js 16 compatibility
- `Test Suite (18.x)` - Node.js 18 compatibility  
- `Test Suite (20.x)` - Node.js 20 compatibility
- `Code Quality` - ESLint and Prettier checks
- `Security Audit` - npm audit and CodeQL
- `Build Check` - Application build verification
- `PR Validation` - Pull request specific checks

**Rationale:** Automated testing and security checks ensure code quality and help prevent deployment of vulnerable code to healthcare environments.

### 3. Additional Protections

**Additional Settings:**
- ✅ **Restrict pushes that create files that have a path that matches one**
- ✅ **Require signed commits** (strongly recommended for healthcare)
- ✅ **Require linear history** (optional, helps maintain clean history)
- ✅ **Do not allow bypassing the above settings**
- ✅ **Allow force pushes** ❌ (disabled for security)
- ✅ **Allow deletions** ❌ (disabled for data integrity)

### 4. Administrator Override

**Include administrators:**
- ✅ **Include administrators** (administrators must follow the same rules)

**Rationale:** In healthcare environments, even administrators should follow the same review processes to maintain audit trails and prevent accidental deployment of unsafe code.

## Setting Up Required Status Checks

The following GitHub Actions workflows provide the required status checks:

### Continuous Integration (`.github/workflows/ci.yml`)
- Runs on: `push` to `main`/`develop`, `pull_request` 
- Provides: `Test Suite`, `Code Quality`, `Security Audit`, `Build Check`
- Matrix testing across Node.js versions 16.x, 18.x, 20.x

### Pull Request Validation (`.github/workflows/pr-validation.yml`)
- Runs on: `pull_request` events
- Provides: `PR Validation`
- Checks: commit messages, PR title format, test coverage, sensitive data detection

## Commit Signing Requirements

### Enable GPG Commit Signing

1. **Generate GPG Key:**
   ```bash
   gpg --full-generate-key
   ```

2. **Add GPG Key to GitHub:**
   ```bash
   gpg --armor --export YOUR_KEY_ID
   ```
   Copy output to GitHub Settings > SSH and GPG keys

3. **Configure Git:**
   ```bash
   git config --global user.signingkey YOUR_KEY_ID
   git config --global commit.gpgsign true
   ```

4. **For Team Members:**
   - All team members must set up GPG signing
   - Include GPG setup instructions in onboarding documentation

### Alternative: Web-based Signing
- GitHub can automatically sign commits made through the web interface
- Enable "Require signed commits" in branch protection
- Configure in repository Settings > General > "Require signed commits"

## Code Owners Configuration

The `.github/CODEOWNERS` file defines who must review changes to critical areas:

```
# Global ownership
* @webqx-health

# Critical files require additional review
/.github/ @webqx-health
/package.json @webqx-health
/legal/ @webqx-health

# Healthcare-specific modules
/ehr-integrations/ @webqx-health
/patient-portal/ @webqx-health
/auth/ @webqx-health
```

## Testing and Validation

Before enabling branch protection:

1. **Test Workflow Success:**
   ```bash
   # Ensure all tests pass
   npm test
   
   # Check linting
   npm run lint
   
   # Verify type checking
   npm run type-check
   
   # Test security audit
   npm run security:audit
   ```

2. **Create Test PR:**
   - Create a small test PR to verify all status checks run correctly
   - Confirm that branch protection blocks merge until all checks pass
   - Test that code owner review is required

3. **Verify Commit Signing:**
   - Make a signed commit: `git commit -S -m "test: verify commit signing"`
   - Confirm signature appears in GitHub UI

## Compliance Considerations

### HIPAA Compliance
- Branch protection helps maintain audit trails required by HIPAA
- Code review requirements help ensure PHI handling is properly implemented
- Signed commits provide authentication and non-repudiation

### Clinical Safety
- Mandatory testing helps prevent deployment of code that could affect patient care
- Security scans help identify vulnerabilities that could compromise patient data
- Review requirements ensure multiple eyes examine healthcare-critical code

### Documentation Requirements
- All changes must include appropriate documentation updates
- Pull request templates enforce consideration of healthcare compliance
- Issue templates ensure security implications are considered

## Enforcement and Monitoring

### Regular Review
- Review branch protection settings quarterly
- Audit compliance with protection rules monthly
- Monitor for any bypass attempts or failures

### Team Training
- Ensure all team members understand the importance of these protections
- Provide training on GPG commit signing
- Document escalation procedures for urgent fixes

### Incident Response
- If protection rules must be bypassed (emergency), document the reason
- Conduct immediate post-incident review
- Ensure changes are retroactively reviewed

## Troubleshooting

### Common Issues

**Status Checks Not Running:**
- Verify GitHub Actions are enabled for the repository
- Check that workflow files are in the correct location
- Ensure required secrets are configured

**Code Owner Reviews Not Required:**
- Verify CODEOWNERS file syntax
- Ensure code owners have repository access
- Check that file paths in CODEOWNERS match actual file structure

**Commit Signing Issues:**
- Verify GPG key is correctly configured
- Check that Git is configured to sign commits
- Ensure GPG key is added to GitHub account

## Contact and Support

For questions about branch protection setup:
- Technical: Create an issue using the provided templates
- Security: Email security@webqx.health
- Compliance: Contact the compliance team through designated channels

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Current | Initial branch protection setup guide |

---

**Important:** Branch protection rules are critical for healthcare software security and compliance. Do not disable or bypass these protections without proper authorization and documentation.