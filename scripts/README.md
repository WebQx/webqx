# Automated Merge Conflict Resolution System

This directory contains automated merge conflict resolution scripts and workflows for the WebQx repository.

## Overview

The automated conflict resolution system helps maintain a smooth development workflow by automatically resolving merge conflicts according to predefined rules, reducing manual intervention and ensuring consistency.

## Conflict Resolution Rules

The system follows these prioritized rules when resolving conflicts:

### 1. README.md Files (Highest Priority)
- **Rule**: Always preserve the content from the **source branch** during conflicts
- **Rationale**: README files often contain branch-specific documentation that should be preserved

### 2. JSON/Configuration Files
- **Rule**: Intelligently merge configurations by retaining unique keys from both branches
- **Applies to**: `package.json`, `*.config.json`, and any file containing "config" in the name
- **Behavior**: 
  - Start with main branch as base
  - Add unique keys from source branch that don't exist in main
  - For nested objects, recursively merge unique keys
  - Main branch values take precedence for conflicting keys

### 3. Default Resolution (Lowest Priority)
- **Rule**: Always prefer changes from the `main` branch
- **Applies to**: All other files not covered by specific rules above

## Available Scripts

### Python Script (`scripts/conflict-resolution.py`)
```bash
python3 scripts/conflict-resolution.py
```
- Most comprehensive implementation
- Robust JSON parsing and merging
- Detailed logging and error handling

### Node.js Script (`scripts/conflict-resolution.js`)
```bash
node scripts/conflict-resolution.js
```
- JavaScript/Node.js implementation
- Good for environments where Python is not available
- Similar functionality to Python version

### Bash Script (`scripts/conflict-resolution.sh`)
```bash
bash scripts/conflict-resolution.sh
```
- Shell script implementation
- Lightweight and fast
- Uses Python for JSON parsing when available

## GitHub Actions Workflow

The automated workflow (`.github/workflows/auto-conflict-resolution.yml`) runs:

- **Schedule**: Every 12 hours (00:00 and 12:00 UTC)
- **Manual Trigger**: Via GitHub Actions UI with method selection
- **Scope**: Checks active branches for potential conflicts with main

### Workflow Features

- Detects merge conflicts across active branches
- Resolves conflicts using the selected method (Python/Node.js/Bash)
- Automatically commits and pushes resolved changes
- Provides detailed summary reports
- Handles failures gracefully with notifications

## Testing

### Run Tests
```bash
python3 scripts/test-conflict-resolution.py
```

The test script:
- Creates a temporary git repository
- Simulates realistic conflict scenarios
- Tests all resolution rules
- Validates the correctness of resolutions
- Cleans up automatically

### Test Scenarios

1. **README.md Conflict**: Verifies source branch content is preserved
2. **package.json Conflict**: Tests intelligent merging of dependencies, scripts, etc.
3. **config.json Conflict**: Tests merging of nested configuration objects
4. **Default Conflict**: Tests main branch preference for other files

## Usage Examples

### Manual Conflict Resolution
```bash
# Using Python script
cd /path/to/webqx
python3 scripts/conflict-resolution.py

# Using Node.js script
node scripts/conflict-resolution.js

# Using Bash script
bash scripts/conflict-resolution.sh
```

### Integration in CI/CD
```yaml
- name: Resolve merge conflicts
  run: python3 scripts/conflict-resolution.py
```

## Configuration

### Customizing Rules

To modify the conflict resolution rules, edit the respective script files:

- **Python**: `scripts/conflict-resolution.py` 
- **Node.js**: `scripts/conflict-resolution.js`
- **Bash**: `scripts/conflict-resolution.sh`

### Workflow Schedule

To change the automation schedule, modify the cron expression in `.github/workflows/auto-conflict-resolution.yml`:

```yaml
schedule:
  - cron: '0 0,12 * * *'  # Every 12 hours
```

## Error Handling

The system includes comprehensive error handling:

- **Git Command Failures**: Graceful fallback and cleanup
- **JSON Parsing Errors**: Falls back to default resolution
- **File Access Issues**: Proper error reporting
- **Network Issues**: Retry logic in workflow

## Security Considerations

- Scripts run with minimal required permissions
- Git operations are limited to conflict resolution
- No external network calls in core resolution logic
- Audit logging for all resolution actions

## Monitoring and Logging

- GitHub Actions provides workflow execution logs
- Each script includes detailed progress logging
- Summary reports show resolution statistics
- Failed resolutions are clearly flagged for manual review

## Troubleshooting

### Common Issues

1. **Permission Denied**
   ```bash
   chmod +x scripts/*.py scripts/*.js scripts/*.sh
   ```

2. **Python Not Found**
   - Ensure Python 3.x is installed
   - Use Node.js or Bash alternatives

3. **Git Repository Not Found**
   - Ensure you're in the repository root
   - Check git repository is properly initialized

4. **JSON Parsing Failures**
   - Check JSON file syntax
   - Review merge conflict markers
   - Use default resolution as fallback

### Debug Mode

For verbose output, modify the script logging levels or run with debug flags:

```bash
# Python with verbose output
python3 -v scripts/conflict-resolution.py

# Bash with debug mode
bash -x scripts/conflict-resolution.sh
```

## Contributing

When modifying the conflict resolution system:

1. Update all three script implementations consistently
2. Add appropriate test cases
3. Update this documentation
4. Test thoroughly in isolated environments
5. Consider backward compatibility

## Support

For issues with the automated conflict resolution system:

1. Check the GitHub Actions workflow logs
2. Run the test script to validate functionality
3. Review recent changes to resolution rules
4. Create an issue with detailed error information