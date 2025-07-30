#!/usr/bin/env node
/**
 * Commit message validation script for WebQX Healthcare Platform
 * Ensures commit messages follow conventional commit format for healthcare compliance
 */

const fs = require('fs');
const path = require('path');

// Conventional commit pattern for healthcare projects
const COMMIT_PATTERN = /^(feat|fix|docs|style|refactor|test|chore|ci|build|perf|security)(\(.+\))?: .+/;

// Healthcare-specific commit types that require additional validation
const HEALTHCARE_CRITICAL_TYPES = ['security', 'feat', 'fix'];

// HIPAA and compliance-related keywords that require special attention
const COMPLIANCE_KEYWORDS = [
  'hipaa', 'phi', 'patient', 'medical', 'health', 'clinical', 
  'ehr', 'fhir', 'audit', 'encryption', 'security', 'privacy'
];

function validateCommitMessage(message) {
  const errors = [];
  const warnings = [];

  // Remove any leading/trailing whitespace
  message = message.trim();

  // Check if message follows conventional commit format
  if (!COMMIT_PATTERN.test(message)) {
    errors.push('Commit message must follow conventional commit format: type(scope): description');
    errors.push('Valid types: feat, fix, docs, style, refactor, test, chore, ci, build, perf, security');
    return { errors, warnings };
  }

  // Extract commit type and description
  const match = message.match(/^([^(:]+)(\([^)]+\))?: (.+)/);
  const type = match[1];
  const description = match[3];

  // Check message length
  if (message.length > 100) {
    warnings.push('Commit message should be 100 characters or less for better readability');
  }

  // Check description length
  if (description.length < 3) {
    errors.push('Commit description must be at least 3 characters long');
  }

  // Check for proper capitalization
  if (description && description[0] !== description[0].toLowerCase()) {
    warnings.push('Commit description should start with lowercase letter');
  }

  // Check for period at end
  if (description.endsWith('.')) {
    warnings.push('Commit description should not end with a period');
  }

  // Healthcare-specific validations
  if (HEALTHCARE_CRITICAL_TYPES.includes(type)) {
    warnings.push(`Critical commit type '${type}' detected - ensure proper review and testing`);
  }

  // Check for compliance-related keywords
  const messageWords = message.toLowerCase().split(' ');
  const foundComplianceKeywords = COMPLIANCE_KEYWORDS.filter(keyword => 
    messageWords.some(word => word.includes(keyword))
  );

  if (foundComplianceKeywords.length > 0) {
    warnings.push(`Healthcare compliance keywords detected: ${foundComplianceKeywords.join(', ')}`);
    warnings.push('Ensure this change has been reviewed for HIPAA and healthcare compliance');
  }

  // Security-specific validations
  if (type === 'security') {
    warnings.push('Security commit detected - ensure vulnerability details are not exposed in commit message');
  }

  // Patient data validation
  if (messageWords.some(word => word.includes('patient') || word.includes('phi'))) {
    warnings.push('Patient-related commit detected - ensure no PHI is included in commit message or code');
  }

  return { errors, warnings };
}

function main() {
  try {
    // Get commit message from .git/COMMIT_EDITMSG
    const gitDir = path.join(process.cwd(), '.git');
    const commitMsgFile = path.join(gitDir, 'COMMIT_EDITMSG');

    if (!fs.existsSync(commitMsgFile)) {
      console.error('Error: Could not find commit message file');
      process.exit(1);
    }

    const commitMessage = fs.readFileSync(commitMsgFile, 'utf8').trim();

    // Skip validation for merge commits
    if (commitMessage.startsWith('Merge ') || commitMessage.startsWith('merge ')) {
      console.log('✅ Merge commit detected - skipping validation');
      process.exit(0);
    }

    // Validate the commit message
    const { errors, warnings } = validateCommitMessage(commitMessage);

    // Display results
    if (errors.length > 0) {
      console.error('\n❌ Commit message validation failed:');
      errors.forEach(error => console.error(`   • ${error}`));
      console.error('\nExample valid commit messages:');
      console.error('   • feat(auth): add provider verification system');
      console.error('   • fix(patient-portal): resolve prescription display issue');
      console.error('   • security(ehr): patch authentication vulnerability');
      console.error('   • docs(api): update FHIR integration guide');
      process.exit(1);
    }

    if (warnings.length > 0) {
      console.warn('\n⚠️  Commit message warnings:');
      warnings.forEach(warning => console.warn(`   • ${warning}`));
    }

    console.log('✅ Commit message validation passed');
    
    if (warnings.length === 0) {
      console.log('   Conventional commit format ✓');
      console.log('   Healthcare compliance considerations ✓');
    }

  } catch (error) {
    console.error('Error validating commit message:', error.message);
    process.exit(1);
  }
}

// Run validation if called directly
if (require.main === module) {
  main();
}

module.exports = { validateCommitMessage };