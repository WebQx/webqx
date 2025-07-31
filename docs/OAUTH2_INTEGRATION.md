# OAuth2 Integration Documentation

This document describes the OAuth2 integration implemented for the WebQx Healthcare Platform.

## Overview

The OAuth2 integration provides:
- **Centralized Authentication**: Delegates authentication to a central Identity Provider (IDP)
- **Token Validation**: Robust token validation with error handling
- **Role-Based Access Control (RBAC)**: Authorization using claims from OAuth2 tokens
- **Backward Compatibility**: Seamless integration with existing FHIR and patient portal authentication

## Architecture

### Components

1. **OAuth2Client** (`auth/oauth2/client.js`)
   - Handles OAuth2 authorization flow
   - Token exchange and refresh
   - PKCE support for enhanced security

2. **TokenValidator** (`auth/oauth2/tokenValidator.js`)
   - JWT token validation
   - Public key management via JWKS
   - Caching for performance

3. **RBACManager** (`auth/oauth2/rbac.js`)
   - Role and permission-based authorization
   - Hierarchical role system
   - Context-aware access control

4. **OAuth2Middleware** (`auth/oauth2/middleware.js`)
   - Express middleware integration
   - Request authentication and authorization
   - Enhanced FHIR compatibility

5. **Configuration** (`auth/oauth2/config.js`)
   - Environment-based configuration
   - Security settings
   - Development/production modes

## Configuration

### Environment Variables

Add these to your `.env` file:

```env
# OAuth2 Central IDP Configuration
OAUTH2_ISSUER=https://auth.webqx.health
OAUTH2_AUTH_ENDPOINT=https://auth.webqx.health/oauth2/authorize
OAUTH2_TOKEN_ENDPOINT=https://auth.webqx.health/oauth2/token
OAUTH2_USERINFO_ENDPOINT=https://auth.webqx.health/oauth2/userinfo
OAUTH2_JWKS_URI=https://auth.webqx.health/.well-known/jwks.json

# OAuth2 Client Configuration
OAUTH2_CLIENT_ID=webqx-healthcare-platform
OAUTH2_CLIENT_SECRET=your_oauth2_client_secret
OAUTH2_REDIRECT_URI=http://localhost:3000/auth/oauth2/callback
OAUTH2_SCOPE=openid profile email patient/*.read patient/*.write user/*.read

# OAuth2 RBAC Configuration
OAUTH2_RBAC_ENABLED=true
OAUTH2_ROLES_CLAIM=roles
OAUTH2_PERMISSIONS_CLAIM=permissions
OAUTH2_DEFAULT_ROLES=patient

# Security Settings
OAUTH2_PKCE_ENABLED=true
OAUTH2_STATE_VALIDATION=true
OAUTH2_NONCE_VALIDATION=true
```

### Development Mode

For development and testing:

```env
NODE_ENV=development
OAUTH2_MOCK_MODE=true
OAUTH2_SKIP_SIGNATURE_VERIFICATION=true
```

## Usage

### Basic Setup

```javascript
const { createOAuth2Instance } = require('./auth/oauth2');

// Create OAuth2 instance
const oauth2 = createOAuth2Instance();

// Use middleware
app.use('/api/protected', oauth2.authenticate());
app.use('/api/admin', oauth2.requireRoles(['admin']));
app.use('/api/patient-data', oauth2.authorize(['patient:read']));
```

### Integration with Express Routes

```javascript
const express = require('express');
const { createOAuth2Router } = require('./auth/oauth2');

const app = express();

// Add OAuth2 endpoints
app.use('/auth/oauth2', createOAuth2Router(oauth2));

// Protected routes
app.get('/api/patients', 
  oauth2.authenticate(),
  oauth2.authorize(['patient:read']),
  (req, res) => {
    // Access user info via req.user
    res.json({ 
      user: req.user,
      message: 'Protected resource accessed'
    });
  }
);
```

### FHIR Integration

The OAuth2 system enhances existing FHIR authentication:

```javascript
// Existing FHIR routes now support both JWT and OAuth2 tokens
app.use('/fhir/Patient', 
  authenticateToken,  // Enhanced to support OAuth2
  requireScopes(['patient/*.read']), // Enhanced with RBAC
  patientRoutes
);
```

## API Endpoints

### OAuth2 Flow Endpoints

- `GET /auth/oauth2/authorize` - Start authorization flow
- `GET /auth/oauth2/callback` - Handle authorization callback
- `POST /auth/oauth2/token/refresh` - Refresh access token
- `POST /auth/oauth2/token/revoke` - Revoke token
- `GET /auth/oauth2/userinfo` - Get user information
- `GET /auth/oauth2/status` - System status

### Authorization Flow Example

1. **Redirect to authorization endpoint:**
   ```
   GET /auth/oauth2/authorize?scope=openid profile patient:read
   ```

2. **Handle callback:**
   ```
   GET /auth/oauth2/callback?code=auth_code&state=state_value
   ```

3. **Use access token:**
   ```
   Authorization: Bearer <access_token>
   ```

## Role-Based Access Control

### Default Role Hierarchy

```
super_admin
├── admin
│   ├── provider
│   │   └── patient
│   └── patient
└── patient
```

### Permission Examples

```javascript
// Check single permission
const result = rbac.hasPermission(user, 'patient:read');

// Check multiple permissions (any)
const result = rbac.hasAnyPermission(user, ['patient:read', 'patient:write']);

// Check multiple permissions (all)
const result = rbac.hasAllPermissions(user, ['patient:read', 'observation:read']);

// Check roles
const result = rbac.hasRole(user, ['provider', 'admin']);
```

### Context-Aware Authorization

```javascript
// Resource-specific authorization
const context = { patientId: 'patient-123' };
const result = rbac.hasPermission(user, 'patient:read', context);

// Organization-based authorization
const context = { organizationId: 'org-456' };
const result = rbac.hasPermission(user, 'org:manage', context);
```

## Token Claims

### Required Claims

- `sub` - Subject (user ID)
- `iss` - Issuer
- `aud` - Audience
- `exp` - Expiration time
- `iat` - Issued at

### Optional Claims

- `roles` - User roles (array)
- `permissions` - User permissions (array)
- `groups` - User groups (array)
- `patient_id` - Associated patient ID
- `organization_id` - Associated organization ID

### Example Token Payload

```json
{
  "sub": "user-123",
  "iss": "https://auth.webqx.health",
  "aud": "webqx-healthcare-platform",
  "exp": 1640995200,
  "iat": 1640991600,
  "email": "provider@hospital.com",
  "name": "Dr. Jane Smith",
  "roles": ["provider", "patient"],
  "permissions": ["patient:read", "patient:write", "observation:read"],
  "patient_id": "patient-789",
  "organization_id": "hospital-456"
}
```

## Security Features

### PKCE (Proof Key for Code Exchange)
- Enabled by default
- SHA256 code challenge method
- Protects against authorization code interception

### State Parameter Validation
- CSRF protection
- State expiration (10 minutes)
- Secure random generation

### Token Validation
- JWT signature verification
- Issuer and audience validation
- Clock tolerance for time skew
- Token expiration checks

### Caching
- Token validation result caching
- JWKS caching with expiration
- Permission result caching

## Testing

### Running Tests

```bash
# Run all OAuth2 tests
npm test -- auth/oauth2/__tests__/

# Run specific test file
npm test -- auth/oauth2/__tests__/config.test.js
```

### Test Coverage

- Configuration management
- OAuth2 authorization flow
- Token validation
- RBAC functionality
- Error handling
- Mock mode testing

## Monitoring and Debugging

### Health Check

```
GET /health
```

Returns OAuth2 system status including:
- OAuth2 enabled/disabled
- Mock mode status
- RBAC statistics
- Token validation statistics

### Logs

The system logs important events:
- Authentication failures
- Authorization denials
- Token validation errors
- Configuration issues

### Development Tools

- Mock mode for testing
- Token introspection endpoints
- Cache management endpoints
- Configuration validation

## Migration Guide

### From Existing JWT Authentication

1. **Keep existing endpoints**: All existing authentication continues to work
2. **Add OAuth2 configuration**: Configure environment variables
3. **Enhanced middleware**: Existing middleware automatically supports OAuth2
4. **Gradual migration**: Clients can migrate to OAuth2 at their own pace

### FHIR Compatibility

The OAuth2 integration maintains full compatibility with:
- SMART on FHIR specifications
- Existing FHIR endpoints
- Current scope-based authorization
- FHIR capability statements

## Troubleshooting

### Common Issues

1. **Configuration Errors**
   - Check environment variables
   - Validate URLs and secrets
   - Review logs for specific errors

2. **Token Validation Failures**
   - Verify issuer and audience claims
   - Check token expiration
   - Ensure JWKS endpoint is accessible

3. **Permission Denied**
   - Review user roles and permissions
   - Check role hierarchy configuration
   - Verify claim mappings

### Debug Mode

Enable debug logging:

```env
NODE_ENV=development
OAUTH2_MOCK_MODE=true
```

### Support

For additional support:
- Check application logs
- Review configuration validation
- Test with mock mode enabled
- Consult API documentation