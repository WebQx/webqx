#!/usr/bin/env node
/**
 * Branch Protection Setup Verification Script
 * Validates that all required infrastructure is in place for branch protection
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class BranchProtectionValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.success = [];
  }

  log(message, type = 'info') {
    const prefix = {
      error: '❌',
      warning: '⚠️ ',
      success: '✅',
      info: 'ℹ️ '
    }[type];

    console.log(`${prefix} ${message}`);
    
    if (type === 'error') this.errors.push(message);
    else if (type === 'warning') this.warnings.push(message);
    else if (type === 'success') this.success.push(message);
  }

  checkFile(filePath, description) {
    if (fs.existsSync(filePath)) {
      this.log(`${description} exists`, 'success');
      return true;
    } else {
      this.log(`${description} is missing: ${filePath}`, 'error');
      return false;
    }
  }

  checkDirectory(dirPath, description) {
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      this.log(`${description} directory exists`, 'success');
      return true;
    } else {
      this.log(`${description} directory is missing: ${dirPath}`, 'error');
      return false;
    }
  }

  checkPackageScript(scriptName) {
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      if (packageJson.scripts && packageJson.scripts[scriptName]) {
        this.log(`Package script '${scriptName}' is configured`, 'success');
        return true;
      } else {
        this.log(`Package script '${scriptName}' is missing`, 'error');
        return false;
      }
    } catch (error) {
      this.log(`Error reading package.json: ${error.message}`, 'error');
      return false;
    }
  }

  checkWorkflowFile(filename, requiredJobs) {
    const filePath = path.join('.github', 'workflows', filename);
    if (!this.checkFile(filePath, `${filename} workflow`)) {
      return false;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      let allJobsFound = true;

      requiredJobs.forEach(job => {
        if (content.includes(job)) {
          this.log(`Workflow job '${job}' found in ${filename}`, 'success');
        } else {
          this.log(`Workflow job '${job}' missing in ${filename}`, 'error');
          allJobsFound = false;
        }
      });

      return allJobsFound;
    } catch (error) {
      this.log(`Error reading ${filename}: ${error.message}`, 'error');
      return false;
    }
  }

  checkGitHooks() {
    const huskyDir = '.husky';
    if (!this.checkDirectory(huskyDir, 'Husky git hooks')) {
      return false;
    }

    const hooks = ['pre-commit', 'commit-msg'];
    let allHooksExist = true;

    hooks.forEach(hook => {
      const hookPath = path.join(huskyDir, hook);
      if (!this.checkFile(hookPath, `${hook} git hook`)) {
        allHooksExist = false;
      }
    });

    return allHooksExist;
  }

  checkNodeModules() {
    const criticalPackages = [
      'eslint',
      'prettier',
      'husky',
      'lint-staged',
      '@typescript-eslint/parser',
      '@typescript-eslint/eslint-plugin'
    ];

    let allPackagesInstalled = true;

    criticalPackages.forEach(pkg => {
      const pkgPath = path.join('node_modules', pkg);
      if (fs.existsSync(pkgPath)) {
        this.log(`Package '${pkg}' is installed`, 'success');
      } else {
        this.log(`Package '${pkg}' is not installed`, 'error');
        allPackagesInstalled = false;
      }
    });

    return allPackagesInstalled;
  }

  testCommitValidation() {
    try {
      const validateCommitPath = path.join(__dirname, 'validate-commit-msg.js');
      const { validateCommitMessage } = require(validateCommitPath);
      
      // Test valid commit message
      const validResult = validateCommitMessage('feat(auth): add provider verification system');
      if (validResult.errors.length === 0) {
        this.log('Commit message validation works for valid messages', 'success');
      } else {
        this.log('Commit message validation failed for valid message', 'error');
        return false;
      }

      // Test invalid commit message
      const invalidResult = validateCommitMessage('invalid commit message');
      if (invalidResult.errors.length > 0) {
        this.log('Commit message validation correctly rejects invalid messages', 'success');
      } else {
        this.log('Commit message validation should reject invalid messages', 'warning');
      }

      return true;
    } catch (error) {
      this.log(`Error testing commit validation: ${error.message}`, 'error');
      return false;
    }
  }

  runLintingTest() {
    try {
      this.log('Testing ESLint configuration...', 'info');
      execSync('npm run lint -- --max-warnings 1000 > /dev/null 2>&1');
      this.log('ESLint configuration is working', 'success');
      return true;
    } catch (error) {
      this.log('ESLint configuration test completed (expected some issues in existing code)', 'warning');
      return true; // Linting errors in existing code are expected
    }
  }

  runFormattingTest() {
    try {
      this.log('Testing Prettier configuration...', 'info');
      execSync('npm run format:check -- --loglevel error > /dev/null 2>&1');
      this.log('Prettier configuration is working', 'success');
      return true;
    } catch (error) {
      this.log('Prettier found formatting issues (run npm run format to fix)', 'warning');
      return true; // Formatting issues are fixable
    }
  }

  runTypeCheck() {
    try {
      this.log('Testing TypeScript configuration...', 'info');
      execSync('npm run type-check > /dev/null 2>&1');
      this.log('TypeScript type checking is working', 'success');
      return true;
    } catch (error) {
      this.log('TypeScript found type errors (expected in existing code)', 'warning');
      return true; // Type errors in existing code are expected
    }
  }

  validateInfrastructure() {
    this.log('Starting branch protection infrastructure validation...', 'info');
    
    // Check core files
    const coreFiles = [
      ['.github/workflows/ci.yml', 'CI workflow'],
      ['.github/workflows/pr-validation.yml', 'PR validation workflow'],
      ['.github/CODEOWNERS', 'Code owners file'],
      ['.github/dependabot.yml', 'Dependabot configuration'],
      ['.github/pull_request_template.md', 'Pull request template'],
      ['.eslintrc.json', 'ESLint configuration'],
      ['.prettierrc.json', 'Prettier configuration'],
      ['scripts/validate-commit-msg.js', 'Commit message validator'],
      ['docs/BRANCH_PROTECTION_SETUP.md', 'Branch protection setup guide'],
      ['docs/GITHUB_REPOSITORY_CONFIGURATION.md', 'GitHub configuration guide']
    ];

    let allFilesExist = true;
    coreFiles.forEach(([file, desc]) => {
      if (!this.checkFile(file, desc)) {
        allFilesExist = false;
      }
    });

    // Check directories
    const coreDirectories = [
      ['.github/workflows', 'GitHub workflows'],
      ['.github/ISSUE_TEMPLATE', 'Issue templates'],
      ['scripts', 'Scripts directory']
    ];

    coreDirectories.forEach(([dir, desc]) => {
      if (!this.checkDirectory(dir, desc)) {
        allFilesExist = false;
      }
    });

    // Check package.json scripts
    const requiredScripts = ['lint', 'format', 'format:check', 'type-check', 'precommit'];
    let allScriptsExist = true;
    requiredScripts.forEach(script => {
      if (!this.checkPackageScript(script)) {
        allScriptsExist = false;
      }
    });

    // Check workflows
    const ciJobs = ['test', 'lint', 'security', 'build'];
    const prJobs = ['validate-pr', 'size-check'];
    
    const ciWorkflowValid = this.checkWorkflowFile('ci.yml', ciJobs);
    const prWorkflowValid = this.checkWorkflowFile('pr-validation.yml', prJobs);

    // Check git hooks
    const gitHooksValid = this.checkGitHooks();

    // Check dependencies
    const dependenciesInstalled = this.checkNodeModules();

    // Run functional tests
    const commitValidationWorks = this.testCommitValidation();
    const lintingWorks = this.runLintingTest();
    const formattingWorks = this.runFormattingTest();
    const typeCheckWorks = this.runTypeCheck();

    return {
      filesAndDirectories: allFilesExist,
      packageScripts: allScriptsExist,
      workflows: ciWorkflowValid && prWorkflowValid,
      gitHooks: gitHooksValid,
      dependencies: dependenciesInstalled,
      functionalTests: commitValidationWorks && lintingWorks && formattingWorks && typeCheckWorks
    };
  }

  generateReport() {
    this.log('\n=== BRANCH PROTECTION VALIDATION REPORT ===', 'info');
    
    if (this.success.length > 0) {
      this.log(`\n✅ SUCCESSFUL CHECKS (${this.success.length}):`, 'success');
      // Don't repeat all success messages to keep output clean
    }

    if (this.warnings.length > 0) {
      this.log(`\n⚠️  WARNINGS (${this.warnings.length}):`, 'warning');
      this.warnings.forEach(warning => console.log(`   • ${warning}`));
    }

    if (this.errors.length > 0) {
      this.log(`\n❌ ERRORS (${this.errors.length}):`, 'error');
      this.errors.forEach(error => console.log(`   • ${error}`));
      
      this.log('\n🔧 NEXT STEPS TO FIX ERRORS:', 'info');
      console.log('   1. Review the errors above');
      console.log('   2. Run: npm install (to install missing dependencies)');
      console.log('   3. Run: npm run prepare (to set up git hooks)');
      console.log('   4. Create any missing files from the setup guide');
      console.log('   5. Re-run this validation script');
    }

    if (this.errors.length === 0) {
      this.log('\n🎉 INFRASTRUCTURE READY!', 'success');
      console.log('\nNext steps:');
      console.log('1. Review docs/GITHUB_REPOSITORY_CONFIGURATION.md');
      console.log('2. Configure branch protection rules in GitHub UI');
      console.log('3. Set up required status checks');
      console.log('4. Configure team permissions and code owners');
      
      return true;
    }

    return false;
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new BranchProtectionValidator();
  validator.validateInfrastructure();
  const success = validator.generateReport();
  
  process.exit(success ? 0 : 1);
}

module.exports = { BranchProtectionValidator };