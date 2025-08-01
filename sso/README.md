# WebQX™ Single Sign-On (SSO) Module

A secure, modular SSO implementation supporting OAuth2 and SAML protocols for WebQX™ healthcare platform integration.

## Overview

The WebQX™ SSO module provides enterprise-grade authentication capabilities with support for:
- **OAuth2 2.0** - Modern token-based authentication
- **SAML 2.0** - Enterprise federated identity management
- **Multi-provider support** - Configure multiple identity providers
- **Security-first design** - Comprehensive validation and encryption
- **Audit logging** - Complete authentication tracking
- **Modular architecture** - Easy to extend and maintain

## Directory Structure

```
sso/
├── README.md                    # This documentation
├── index.ts                     # Main SSO module exports
├── config/
│   ├── index.ts                 # Configuration management
│   ├── oauth2.ts                # OAuth2 provider configurations
│   └── saml.ts                  # SAML provider configurations
├── providers/
│   ├── oauth2/
│   │   ├── index.ts             # OAuth2 provider factory
│   │   ├── base.ts              # Base OAuth2 implementation
│   │   ├── azure.ts             # Azure AD OAuth2 provider
│   │   ├── google.ts            # Google OAuth2 provider
│   │   └── generic.ts           # Generic OAuth2 provider
│   └── saml/
│       ├── index.ts             # SAML provider factory
│       ├── base.ts              # Base SAML implementation
│       ├── azure.ts             # Azure AD SAML provider
│       ├── okta.ts              # Okta SAML provider
│       └── generic.ts           # Generic SAML provider
├── middleware/
│   ├── auth.ts                  # Express authentication middleware
│   ├── validation.ts            # Request validation middleware
│   └── session.ts               # Session management middleware
├── utils/
│   ├── crypto.ts                # Cryptographic utilities
│   ├── jwt.ts                   # JWT token utilities
│   ├── xml.ts                   # XML processing for SAML
│   └── audit.ts                 # Audit logging utilities
├── types/
│   ├── index.ts                 # Main type exports
│   ├── oauth2.ts                # OAuth2 type definitions
│   ├── saml.ts                  # SAML type definitions
│   └── common.ts                # Common SSO types
└── __tests__/
    ├── oauth2.test.ts           # OAuth2 provider tests
    ├── saml.test.ts             # SAML provider tests
    └── integration.test.ts      # Integration tests
```

## Quick Start

### Installation

The SSO module is included with WebQX™. Install dependencies:

```bash
npm install
```

### Basic Configuration

1. **Environment Variables**

```bash
# OAuth2 Configuration
OAUTH2_CLIENT_ID=your_client_id
OAUTH2_CLIENT_SECRET=your_client_secret
OAUTH2_REDIRECT_URI=https://your-domain.com/auth/oauth2/callback

# SAML Configuration  
SAML_ENTRY_POINT=https://your-idp.com/sso
SAML_ISSUER=your-sp-issuer
SAML_CERT=path/to/idp-cert.pem

# General SSO Settings
SSO_SECRET_KEY=your-256-bit-secret-key
SSO_SESSION_TIMEOUT=3600000
SSO_AUDIT_ENABLED=true
```

2. **Basic Express.js Integration**

```typescript
import express from 'express';
import { SSOManager, oauth2Middleware, samlMiddleware } from './sso';

const app = express();

// Initialize SSO
const sso = new SSOManager({
  providers: {
    oauth2: {
      azure: {
        clientId: process.env.OAUTH2_CLIENT_ID,
        clientSecret: process.env.OAUTH2_CLIENT_SECRET,
        redirectUri: process.env.OAUTH2_REDIRECT_URI,
        scope: ['openid', 'profile', 'email']
      }
    },
    saml: {
      azure: {
        entryPoint: process.env.SAML_ENTRY_POINT,
        issuer: process.env.SAML_ISSUER,
        cert: process.env.SAML_CERT
      }
    }
  }
});

// OAuth2 routes
app.get('/auth/oauth2/:provider', oauth2Middleware.initiate);
app.post('/auth/oauth2/:provider/callback', oauth2Middleware.callback);

// SAML routes
app.get('/auth/saml/:provider', samlMiddleware.initiate);
app.post('/auth/saml/:provider/callback', samlMiddleware.callback);

// Protected route example
app.get('/dashboard', sso.requireAuth, (req, res) => {
  res.json({ user: req.user });
});
```

## OAuth2 Configuration

### Supported Providers

#### Azure Active Directory

```typescript
const azureConfig = {
  provider: 'azure',
  clientId: 'your-azure-client-id',
  clientSecret: 'your-azure-client-secret',
  redirectUri: 'https://your-app.com/auth/oauth2/azure/callback',
  tenant: 'your-tenant-id', // Optional for multi-tenant
  scope: ['openid', 'profile', 'email', 'User.Read']
};
```

#### Google

```typescript
const googleConfig = {
  provider: 'google',
  clientId: 'your-google-client-id.googleusercontent.com',
  clientSecret: 'your-google-client-secret',
  redirectUri: 'https://your-app.com/auth/oauth2/google/callback',
  scope: ['openid', 'profile', 'email']
};
```

#### Generic OAuth2

```typescript
const genericConfig = {
  provider: 'generic',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  redirectUri: 'https://your-app.com/auth/oauth2/generic/callback',
  authorizationURL: 'https://your-idp.com/oauth2/authorize',
  tokenURL: 'https://your-idp.com/oauth2/token',
  userInfoURL: 'https://your-idp.com/oauth2/userinfo',
  scope: ['openid', 'profile', 'email']
};
```

### OAuth2 Flow

1. **Initiation**: User clicks login, redirected to provider
2. **Authorization**: User consents at identity provider
3. **Callback**: Provider redirects back with authorization code
4. **Token Exchange**: Exchange code for access token
5. **User Info**: Fetch user profile information
6. **Session Creation**: Create authenticated session

## SAML Configuration

### Supported Providers

#### Azure Active Directory

```typescript
const azureSamlConfig = {
  provider: 'azure-saml',
  entryPoint: 'https://login.microsoftonline.com/{tenant-id}/saml2',
  issuer: 'https://your-app.com',
  cert: fs.readFileSync('azure-idp-cert.pem', 'utf8'),
  privateCert: fs.readFileSync('sp-private-key.pem', 'utf8'),
  decryptionPvk: fs.readFileSync('sp-private-key.pem', 'utf8')
};
```

#### Okta

```typescript
const oktaConfig = {
  provider: 'okta',
  entryPoint: 'https://your-org.okta.com/app/your-app/sso/saml',
  issuer: 'https://your-app.com',
  cert: fs.readFileSync('okta-idp-cert.pem', 'utf8'),
  privateCert: fs.readFileSync('sp-private-key.pem', 'utf8')
};
```

### SAML Flow

1. **SP-Initiated**: User visits protected resource
2. **Redirect**: Redirect to identity provider with SAML request
3. **Authentication**: User authenticates at IdP
4. **Assertion**: IdP returns SAML assertion
5. **Validation**: Validate assertion signature and claims
6. **Session Creation**: Create authenticated session

## Security Features

### Encryption & Validation

- **JWT token validation** with signature verification
- **SAML assertion validation** with certificate verification
- **Request state validation** to prevent CSRF attacks
- **Token encryption** for sensitive data storage
- **Secure session management** with configurable timeouts

### Audit Logging

All authentication events are logged for compliance:

```typescript
{
  timestamp: '2024-01-15T10:30:00Z',
  event: 'login_success',
  provider: 'azure',
  protocol: 'oauth2',
  userId: 'user@domain.com',
  sessionId: 'sess_123456',
  ip: '192.168.1.100',
  userAgent: 'Mozilla/5.0...'
}
```

### Healthcare Compliance

- **HIPAA compliance** with audit trails
- **SOC 2** compatible logging and encryption
- **Role-based access control** integration ready
- **Session management** with healthcare-appropriate timeouts

## Advanced Configuration

### Multi-Tenant Support

```typescript
const multiTenantConfig = {
  providers: {
    oauth2: {
      azure: {
        multiTenant: true,
        tenantResolver: (req) => req.headers['x-tenant-id'],
        configs: {
          'tenant1': { clientId: '...', clientSecret: '...' },
          'tenant2': { clientId: '...', clientSecret: '...' }
        }
      }
    }
  }
};
```

### Custom User Mapping

```typescript
const userMappingConfig = {
  userMapping: {
    oauth2: {
      id: 'sub',
      email: 'email',
      name: 'name',
      roles: 'groups'
    },
    saml: {
      id: 'NameID',
      email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
      name: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
      roles: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'
    }
  }
};
```

## Error Handling

The SSO module provides comprehensive error handling:

```typescript
try {
  const user = await sso.authenticateUser(token);
} catch (error) {
  if (error instanceof SSOAuthenticationError) {
    // Handle authentication failure
  } else if (error instanceof SSOConfigurationError) {
    // Handle configuration issues
  } else if (error instanceof SSOValidationError) {
    // Handle validation errors
  }
}
```

## Testing

Run the SSO tests:

```bash
# Unit tests
npm test sso

# Integration tests  
npm test sso/integration

# Coverage report
npm run test:coverage sso
```

## Troubleshooting

### Common Issues

1. **Invalid redirect URI**
   - Ensure redirect URI matches exactly in IdP configuration
   - Check for trailing slashes and protocol (https/http)

2. **Certificate validation errors**
   - Verify SAML IdP certificate is correctly formatted
   - Ensure certificate is not expired
   - Check certificate chain if using intermediate CAs

3. **Token validation failures**
   - Verify JWT secret key configuration
   - Check token expiration settings
   - Ensure clock synchronization between systems

4. **CORS issues**
   - Configure CORS for your domain in IdP settings
   - Ensure preflight requests are handled correctly

### Debug Mode

Enable debug logging:

```bash
DEBUG=sso:* npm start
```

## Contributing

1. Follow WebQX™ coding standards
2. Add tests for new providers
3. Update documentation
4. Ensure security review for changes

## License

Apache 2.0 - See LICENSE.md for details

---

**WebQX™ Healthcare Platform**  
*Secure, modular authentication for global healthcare*