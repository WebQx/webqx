## Description
Brief description of the changes introduced by this PR.

## Type of Change
- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📚 Documentation update
- [ ] 🧹 Code refactoring (no functional changes)
- [ ] ⚡ Performance improvement
- [ ] 🧪 Test improvements
- [ ] 🔧 CI/CD improvements
- [ ] 🔒 Security fix

## Healthcare Context
- **Affected Module(s):** [e.g. Patient Portal, EHR Integration, Radiology Module]
- **User Impact:** [e.g. Patients, Providers, Administrators]
- **Clinical Workflow:** [description of affected clinical workflows]
- **Patient Safety Impact:** [how this change affects patient safety]

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] End-to-end tests added/updated
- [ ] Manual testing completed
- [ ] Performance testing completed (if applicable)
- [ ] Security testing completed (if applicable)

### Test Coverage
- Current coverage: ___%
- Coverage after changes: ___%

## Compliance Checklist
- [ ] **HIPAA Compliance:** Changes maintain HIPAA compliance
- [ ] **Data Security:** Patient data remains secure and encrypted
- [ ] **Access Controls:** Appropriate role-based access controls maintained
- [ ] **Audit Logging:** All data access and modifications are logged
- [ ] **FHIR Compliance:** Changes maintain FHIR R4 compatibility (if applicable)
- [ ] **Data Validation:** Input validation and sanitization implemented
- [ ] **Error Handling:** Appropriate error handling that doesn't expose sensitive data

## Security Review
- [ ] No sensitive data exposed in logs or error messages
- [ ] Authentication and authorization properly implemented
- [ ] Input validation and sanitization in place
- [ ] SQL injection protection (if applicable)
- [ ] XSS protection (if applicable)
- [ ] CSRF protection (if applicable)
- [ ] Secrets properly managed (no hardcoded credentials)

## Performance Impact
- [ ] No significant performance degradation
- [ ] Database queries optimized
- [ ] Memory usage considered
- [ ] API response times maintained
- [ ] Frontend loading times acceptable

## Breaking Changes
If this PR introduces breaking changes, please describe:
1. What breaks:
2. Migration path:
3. Deprecation timeline:

## Dependencies
- [ ] No new dependencies added
- [ ] New dependencies reviewed for security vulnerabilities
- [ ] Dependencies comply with healthcare regulations
- [ ] License compatibility verified

## Documentation
- [ ] Code comments updated
- [ ] API documentation updated (if applicable)
- [ ] User documentation updated (if applicable)
- [ ] README updated (if applicable)
- [ ] Changelog updated

## Screenshots (if applicable)
Add screenshots or GIFs to demonstrate UI changes.

## Related Issues
Closes #[issue_number]
Related to #[issue_number]

## Deployment Notes
Any special deployment considerations:
- [ ] Database migrations required
- [ ] Environment variables need updating
- [ ] Configuration changes needed
- [ ] Cache clearing required
- [ ] Service restarts needed

## Rollback Plan
Describe how to rollback this change if issues arise:

## Post-Deployment Verification
Steps to verify the deployment was successful:
1. 
2. 
3. 

## Checklist
- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published
- [ ] I have considered the healthcare compliance implications
- [ ] I have tested the changes in a realistic clinical scenario (if applicable)