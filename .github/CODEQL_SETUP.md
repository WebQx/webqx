# CodeQL Security Analysis Setup

This document explains the CodeQL security analysis configuration for the WebQx healthcare platform.

## Overview

CodeQL is GitHub's semantic code analysis engine that helps identify security vulnerabilities and coding errors in your codebase. The analysis runs automatically on:

- **Push events** to the `main` branch
- **Pull requests** targeting the `main` branch  
- **Weekly schedule** (Mondays at midnight UTC)

## Current Configuration

### Languages Analyzed
- **JavaScript/TypeScript** - Primary languages used in the WebQx platform

### Security Features
- **Security queries enabled** - Detects common security vulnerabilities
- **Quality queries enabled** - Identifies code quality issues
- **Automatic language detection** - Efficiently scans relevant code
- **SARIF results upload** - Integrates with GitHub Security tab

## Adding Support for Additional Languages

When you add code in other programming languages to the repository, update the workflow by modifying `.github/workflows/codeql.yml`:

### For Python
```yaml
matrix:
  language: [ 'javascript-typescript', 'python' ]
```

### For Ruby
```yaml
matrix:
  language: [ 'javascript-typescript', 'ruby' ]
```

### For Compiled Languages (Go, Java, C#, C++)
```yaml
matrix:
  include:
  - language: javascript-typescript
  - language: go
    build-mode: autobuild
  - language: java-kotlin 
    build-mode: autobuild
  - language: csharp
    build-mode: autobuild
  - language: c-cpp
    build-mode: autobuild
```

## Viewing Results

1. Navigate to your repository on GitHub
2. Click on the **Security** tab
3. Select **Code scanning alerts** to see CodeQL findings
4. Review and dismiss false positives as needed

## Workflow Permissions

The workflow requires these permissions:
- `security-events: write` - Upload security scan results
- `packages: read` - Access CodeQL packages
- `actions: read` - Monitor workflow status
- `contents: read` - Access repository code

## Healthcare Security Considerations

As a healthcare platform handling sensitive patient data, this CodeQL setup helps ensure:

- **HIPAA Compliance** - Identifies potential data exposure vulnerabilities
- **Authentication Security** - Detects weak authentication patterns
- **Input Validation** - Finds injection vulnerability risks
- **Encryption Issues** - Identifies insecure data handling
- **Access Control** - Spots authorization bypass vulnerabilities

## Troubleshooting

### Common Issues

1. **Workflow timeouts** - Adjust `timeout-minutes` if needed for large codebases
2. **False positives** - Use `.github/codeql/codeql-config.yml` to disable specific rules
3. **Build failures** - For compiled languages, ensure proper build configuration

### Getting Help

- [CodeQL Documentation](https://docs.github.com/en/code-security/code-scanning/using-codeql-code-scanning-with-your-existing-ci-system)
- [Security Best Practices](https://docs.github.com/en/code-security/getting-started/securing-your-repository)
- [WebQx Contributing Guidelines](./CONTRIBUTING.md)

## Compliance Notes

This security scanning setup supports WebQx's commitment to:
- **Healthcare Data Security** (HIPAA/HITECH compliance)
- **Open Source Security** (Supply chain vulnerability detection)
- **Continuous Security** (Automated vulnerability identification)
- **Global Standards** (OWASP security recommendations)