# GitHub Actions and CodeQL Configuration Guide

## CodeQL Analysis Issues Resolution

If you're experiencing CodeQL analysis errors, here's how to resolve them:

### Issue 1: "CodeQL analyses from advanced configurations cannot be processed when the default setup is enabled"

**Solution:** Disable GitHub's default CodeQL setup and use the custom workflow instead.

#### Steps to Fix:
1. Go to your repository on GitHub
2. Navigate to **Settings** → **Code security and analysis**
3. Find **"Code scanning"** section
4. If "Default setup" is enabled, click **"Disable"**
5. Enable **"Advanced setup"** instead
6. This will allow the custom `.github/workflows/codeql.yml` to run without conflicts

### Issue 2: "Failed to save: Unable to reserve cache with key"

**Solution:** This is a cache conflict. The updated workflow now:
- Uses different timing (2 AM instead of midnight)
- Has manual trigger capability
- Includes repository checks to avoid conflicts

#### Manual Trigger:
You can manually trigger CodeQL analysis by:
1. Go to **Actions** tab in your repository
2. Select **"CodeQL Security Analysis"** workflow
3. Click **"Run workflow"** button

### Current Workflow Status

- **GitHub Pages Deployment**: ✅ Active and working
- **CodeQL Analysis**: ⚠️ Temporarily disabled on push/PR (to avoid conflicts)
- **Manual CodeQL**: ✅ Available via workflow_dispatch
- **Scheduled CodeQL**: ✅ Weekly on Mondays at 2 AM UTC

### Re-enabling Full CodeQL Analysis

Once you've disabled the default setup:

1. Edit `.github/workflows/codeql.yml`
2. Uncomment these lines:
   ```yaml
   push:
     branches: [ "main" ]
   pull_request:
     branches: [ "main" ]
   ```
3. Commit and push the changes

### Alternative: Simple Security Scanning

If CodeQL continues to have issues, you can create a simpler security workflow:

```yaml
name: "Security Scan"
on:
  push:
    branches: [ main ]
  schedule:
    - cron: '0 0 * * 1'

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run security audit
        run: npm audit --audit-level moderate
```

### GitHub Pages Deployment

Your GitHub Pages deployment is working correctly and will:
- Build automatically on every push to `main`
- Deploy static demo site to `https://webqx.github.io/EMR/`
- Include mock data for all demos
- Handle missing files gracefully

### Support

If issues persist:
1. Check the **Actions** tab for detailed error logs
2. Ensure repository permissions are correctly set
3. Contact GitHub Support for advanced CodeQL configuration help
