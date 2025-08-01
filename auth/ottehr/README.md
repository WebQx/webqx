# Ottehr-Keycloak Integration

This directory contains the implementation of Keycloak Single Sign-On (SSO) integration for the Ottehr module in WebQX Healthcare Platform.

## Overview

The integration enables centralized authentication through Keycloak using OAuth2 and OpenID Connect protocols, allowing users to authenticate once and access Ottehr services seamlessly with role-based access control.

## Features

- **OAuth2 Authorization Code Flow with PKCE**: Secure authentication flow with Proof Key for Code Exchange
- **OpenID Connect Support**: ID token validation and user information retrieval
- **Role-Based Access Control**: Automatic role mapping from Keycloak tokens
- **Token Management**: Automatic token refresh and secure storage
- **Multi-Environment Support**: Works in both browser and Node.js environments
- **Comprehensive Error Handling**: Detailed error reporting and recovery mechanisms

## Quick Start

1. **Configure Environment Variables**:
   ```bash
   KEYCLOAK_ENABLED=true
   KEYCLOAK_BASE_URL=https://your-keycloak-server.com
   KEYCLOAK_REALM=webqx-healthcare
   KEYCLOAK_CLIENT_ID=ottehr-integration
   KEYCLOAK_CLIENT_SECRET=your-client-secret
   KEYCLOAK_REDIRECT_URI=https://your-app.com/auth/keycloak/callback
   ```

2. **Initialize Auth Manager**:
   ```typescript
   import { createOttehrAuthManager } from './auth/ottehr';
   const authManager = createOttehrAuthManager();
   ```

3. **Initiate Login**:
   ```typescript
   const { url, codeVerifier, state, nonce } = authManager.generateKeycloakAuthUrl();
   // Store codeVerifier, state, nonce securely
   window.location.href = url; // Redirect to Keycloak
   ```

4. **Handle Callback**:
   ```typescript
   const result = await authManager.exchangeKeycloakCode(code, codeVerifier, state, nonce);
   if (result.success) {
     // User is authenticated
     console.log('User roles:', result.tokenInfo?.roles);
   }
   ```

## File Structure

```
auth/ottehr/
├── authManager.ts          # Main authentication manager with Keycloak support
├── index.ts               # Public API exports
├── routes.js              # Express routes for Ottehr integration
├── config/
│   ├── keycloak-realm.json    # Sample Keycloak realm configuration
│   └── KEYCLOAK_SETUP.md      # Detailed setup instructions
└── __tests__/
    └── authManager.test.ts    # Comprehensive test suite
```

## Key Components

### OttehrAuthManager

The main class that handles authentication with both Ottehr and Keycloak:

- `generateKeycloakAuthUrl()` - Creates authorization URL with PKCE
- `exchangeKeycloakCode()` - Exchanges authorization code for tokens
- `refreshKeycloakToken()` - Refreshes access tokens
- `getKeycloakUserInfo()` - Retrieves user information
- `logoutFromKeycloak()` - Handles logout flow

### Configuration Interfaces

- `OttehrAuthConfig` - Main configuration interface
- `KeycloakConfig` - Keycloak-specific configuration
- `TokenInfo` - Token information with role support
- `OIDCTokenPayload` - OpenID Connect token payload
- `KeycloakUserInfo` - User information from Keycloak

## Role-Based Access Control

The integration supports automatic role mapping from Keycloak:

```typescript
const tokenInfo = authManager.getTokenInfo();
const hasAdminRole = tokenInfo?.roles?.includes('ottehr-admin');
const hasPharmacyRole = tokenInfo?.roles?.includes('ottehr-pharmacy');
```

Available roles:
- `ottehr-admin` - Full access to all features
- `ottehr-user` - Standard user access
- `ottehr-pharmacy` - Pharmacy-specific operations
- `ottehr-delivery` - Delivery tracking access

## Security Features

- **PKCE Support**: Proof Key for Code Exchange for enhanced security
- **JWT Validation**: Automatic ID token validation using JWKS
- **Token Rotation**: Secure token refresh mechanisms
- **Role Validation**: Server-side role verification
- **HTTPS Enforcement**: SSL/TLS requirement for production

## Error Handling

The integration provides comprehensive error handling:

```typescript
const result = await authManager.exchangeKeycloakCode(code, verifier);
if (!result.success) {
  switch (result.error?.code) {
    case 'KEYCLOAK_TOKEN_EXCHANGE_FAILED':
      // Handle token exchange failure
      break;
    case 'INVALID_ID_TOKEN':
      // Handle token validation failure
      break;
    case 'NETWORK_ERROR':
      // Handle network issues
      break;
  }
}
```

## Testing

Run the comprehensive test suite:

```bash
npm test -- auth/ottehr/__tests__/authManager.test.ts
```

The tests cover:
- OAuth2 flows and PKCE
- Token validation and refresh
- Role extraction and mapping
- Error scenarios and edge cases
- Multi-environment compatibility

## Documentation

- `config/KEYCLOAK_SETUP.md` - Complete setup and configuration guide
- `config/keycloak-realm.json` - Sample Keycloak realm configuration
- Inline code documentation with TypeScript types

## Compatibility

- **Node.js**: 16+ (server-side integration)
- **Browsers**: Modern browsers with ES2018+ support
- **Keycloak**: Version 15+ recommended
- **OAuth2/OIDC**: Full compliance with standards

## Contributing

When contributing to this integration:

1. Ensure all tests pass
2. Add tests for new functionality
3. Update documentation as needed
4. Follow existing code patterns and TypeScript conventions
5. Verify security best practices

## Support

For setup assistance, refer to:
1. `config/KEYCLOAK_SETUP.md` for detailed instructions
2. Test files for usage examples
3. TypeScript interfaces for API documentation
4. Keycloak documentation for server configuration