# Contributing to WebQx

Thank you for your interest in contributing to WebQx! Please read this guide carefully before making any contributions.

## 🚨 MANDATORY: Non-Disclosure Agreement

**BEFORE YOU CONTRIBUTE**: All contributors must read, understand, and agree to the [WebQx Contributor Non-Disclosure Agreement (NDA)](./CONTRIBUTOR_NDA.md).

### NDA Acknowledgment Required

By contributing to this repository, you are required to:

1. **Read the complete NDA**: Review the [CONTRIBUTOR_NDA.md](./CONTRIBUTOR_NDA.md) file thoroughly
2. **Acknowledge agreement**: Your first contribution serves as your digital signature and agreement to the NDA terms
3. **Understand the binding nature**: This is a legally binding agreement that remains in effect indefinitely

**⚠️ IMPORTANT**: Contributing to this repository without reading and agreeing to the NDA is not permitted. If you do not agree to the NDA terms, please do not submit any contributions.

## Contribution Guidelines

### Before You Start

1. **Review the NDA**: Ensure you have read and agreed to the [Contributor NDA](./CONTRIBUTOR_NDA.md)
2. **Check existing issues**: Look through existing issues to avoid duplicates
3. **Understand the architecture**: Familiarize yourself with the WebQx modular healthcare platform structure

### Types of Contributions

We welcome the following types of contributions (all subject to NDA terms):

- **Bug fixes**: Corrections to existing functionality
- **Feature enhancements**: Improvements to current modules
- **New specialty workflows**: Healthcare specialty-specific implementations
- **Documentation improvements**: Technical documentation updates
- **Testing**: Unit tests, integration tests, and test coverage improvements

### Contribution Process

#### 1. Fork and Clone
```bash
# Fork the repository through GitHub UI
git clone https://github.com/your-username/webqx.git
cd webqx
```

#### 2. Create a Feature Branch
Use descriptive branch names that include the type of contribution:
```bash
# Examples:
git checkout -b feature/oncology-workflow-v1.0
git checkout -b bugfix/pharmacy-locator-api
git checkout -b docs/update-deployment-guide
```

#### 3. Development Setup
```bash
# Install dependencies
npm install

# Start development server
npm start

# Run tests
npm test
```

#### 4. Make Your Changes
- Follow existing code style and conventions
- Include appropriate tests for new functionality
- Update documentation as needed
- Ensure your code aligns with healthcare compliance requirements

#### 5. Test Your Changes
```bash
# Run the full test suite
npm test

# Check TypeScript compilation
npm run type-check

# Test your changes manually
npm start
```

#### 6. Submit a Pull Request
- **Title**: Use clear, descriptive titles (e.g., "Add oncology workflow module", "Fix pharmacy API authentication")
- **Description**: Include:
  - **NDA Acknowledgment**: Confirm you have read and agree to the NDA
  - Summary of changes
  - Compliance notes (HIPAA, privacy considerations)
  - Testing performed
  - Any breaking changes

#### 7. Pull Request Template
```markdown
## NDA Acknowledgment
- [ ] I have read and agree to the WebQx Contributor NDA

## Description
Brief description of changes...

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Compliance Notes
Any HIPAA, privacy, or security considerations...

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated if needed
- [ ] No sensitive information exposed
```

### Code Standards

#### Healthcare Compliance
- Follow HIPAA guidelines for any patient data handling
- Ensure PHI (Protected Health Information) is properly secured
- Include audit logging for sensitive operations
- Implement proper access controls

#### Technical Standards
- Use TypeScript for type safety
- Follow React best practices for frontend components
- Include comprehensive error handling
- Write unit tests for new functionality
- Document complex business logic

#### Specialty-Specific Contributions
When contributing specialty workflows:
- Include YAML configuration files for AI tuning
- Document clinical decision support logic
- Ensure interoperability with HL7/FHIR standards
- Provide specialty-specific compliance notes

## Legal and Intellectual Property

### Reminder: All Contributions Subject to NDA
- All code, ideas, and discussions are confidential
- WebQx retains full ownership of contributions
- No use of repository content outside authorized contributions
- NDA terms remain in effect indefinitely

### Licensing
- Repository is licensed under Apache 2.0
- All contributions include IP assignment to WebQx
- See [CONTRIBUTOR_NDA.md](./CONTRIBUTOR_NDA.md) for complete legal terms

## Getting Help

### Questions About Contributing
- Review this guide and the NDA thoroughly
- Check existing issues and documentation
- For legal questions about the NDA: Contact [legal@webqx.com]

### Technical Support
- Create an issue for bugs or technical questions
- Join community discussions (subject to NDA confidentiality)
- Review the [README.md](./README.md) for architecture overview

## Code of Conduct

Contributors must:
- Maintain professional communication
- Respect confidentiality requirements
- Follow healthcare industry ethical standards
- Prioritize patient privacy and safety in all contributions

---

**By contributing to WebQx, you acknowledge that you have read, understood, and agreed to the [Contributor NDA](./CONTRIBUTOR_NDA.md) and will comply with all terms and conditions outlined in this contributing guide.**

Thank you for helping to advance healthcare technology while maintaining the highest standards of legal and ethical compliance! 🌐💙