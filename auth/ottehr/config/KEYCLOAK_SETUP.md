# Keycloak Integration Configuration Guide

This guide provides step-by-step instructions for setting up Keycloak integration with the Ottehr module in WebQX Healthcare Platform.

## Overview

The Keycloak integration enables Single Sign-On (SSO) and centralized authentication for the Ottehr module using OAuth2 and OpenID Connect protocols. This allows users to authenticate once with Keycloak and access Ottehr services seamlessly.

## Prerequisites

- Keycloak server (version 15+ recommended)
- WebQX Healthcare Platform with Ottehr module
- Administrative access to both systems
- SSL/TLS certificates (required for production)

## Keycloak Server Setup

### 1. Create Realm

1. Log into Keycloak Admin Console
2. Click "Add realm" or use the dropdown in the top-left
3. Import the provided realm configuration:
   - Use the file: `auth/ottehr/config/keycloak-realm.json`
   - Or create manually with realm name: `webqx-healthcare`

### 2. Configure Client

The realm configuration includes a pre-configured client `ottehr-integration`. Update the following settings:

#### Basic Settings
- **Client ID**: `ottehr-integration`
- **Client Protocol**: `openid-connect`
- **Access Type**: `confidential`
- **Standard Flow Enabled**: `ON`
- **Direct Access Grants Enabled**: `ON`
- **Authorization Enabled**: `OFF`

#### Authentication Flow Settings
- **Root URL**: `https://your-webqx-domain.com`
- **Valid Redirect URIs**: 
  - `https://your-webqx-domain.com/auth/keycloak/callback`
  - `http://localhost:3000/auth/keycloak/callback` (for development)
- **Web Origins**: `https://your-webqx-domain.com`
- **Admin URL**: `https://your-webqx-domain.com`

#### Advanced Settings
- **PKCE Code Challenge Method**: `S256`
- **Proof Key for Code Exchange Code Challenge Method**: `S256`

### 3. Configure Client Secret

1. Go to the "Credentials" tab of the `ottehr-integration` client
2. Note the generated client secret (you'll need this for environment variables)
3. Optionally, regenerate the secret for enhanced security

### 4. Setup Roles

The configuration includes the following realm roles:
- `ottehr-admin`: Full access to all Ottehr features
- `ottehr-user`: Standard user access
- `ottehr-pharmacy`: Pharmacy-specific access
- `ottehr-delivery`: Delivery tracking access

#### Role Mapping
1. Go to "Roles" → "Realm Roles"
2. Verify the roles exist (created automatically if using realm import)
3. Assign roles to users as needed

### 5. Configure Mappers

The client includes protocol mappers for:
- **ottehr-roles**: Maps realm roles to the `ottehr_roles` claim
- **ottehr-access-scope**: Adds audience scope for Ottehr API

Verify these mappers exist in the client's "Mappers" tab.

## WebQX Platform Configuration

### 1. Environment Variables

Add the following environment variables to your `.env` file:

```bash
# Keycloak Integration for Ottehr SSO
KEYCLOAK_ENABLED=true
KEYCLOAK_BASE_URL=https://your-keycloak-server.com
KEYCLOAK_REALM=webqx-healthcare
KEYCLOAK_CLIENT_ID=ottehr-integration
KEYCLOAK_CLIENT_SECRET=your_actual_client_secret_here
KEYCLOAK_REDIRECT_URI=https://your-webqx-domain.com/auth/keycloak/callback
KEYCLOAK_SCOPE=openid profile email ottehr:access
KEYCLOAK_ISSUER=https://your-keycloak-server.com/realms/webqx-healthcare
KEYCLOAK_JWKS_URI=https://your-keycloak-server.com/realms/webqx-healthcare/protocol/openid_connect/certs
KEYCLOAK_TOKEN_ENDPOINT=https://your-keycloak-server.com/realms/webqx-healthcare/protocol/openid_connect/token
KEYCLOAK_AUTHORIZATION_ENDPOINT=https://your-keycloak-server.com/realms/webqx-healthcare/protocol/openid_connect/auth
KEYCLOAK_USERINFO_ENDPOINT=https://your-keycloak-server.com/realms/webqx-healthcare/protocol/openid_connect/userinfo
KEYCLOAK_LOGOUT_ENDPOINT=https://your-keycloak-server.com/realms/webqx-healthcare/protocol/openid_connect/logout
KEYCLOAK_ENABLE_ROLE_MAPPING=true
KEYCLOAK_ROLE_MAPPING_CLAIM=realm_access.roles
KEYCLOAK_DEFAULT_ROLE=ottehr-user
```

### 2. Replace Placeholder Values

Update the following placeholder values:
- `your-keycloak-server.com`: Your Keycloak server domain
- `your-webqx-domain.com`: Your WebQX application domain  
- `your_actual_client_secret_here`: The client secret from Keycloak

## Implementation Usage

### 1. Initialize Authentication Manager

```typescript
import { createOttehrAuthManager, type KeycloakConfig } from './auth/ottehr';

// The auth manager will automatically load Keycloak config from environment
const authManager = createOttehrAuthManager();

// Or configure manually:
const authManager = createOttehrAuthManager({
  keycloak: {
    enabled: true,
    baseUrl: 'https://your-keycloak-server.com',
    realm: 'webqx-healthcare',
    clientId: 'ottehr-integration',
    clientSecret: 'your-secret',
    redirectUri: 'https://your-app.com/auth/keycloak/callback',
    // ... other config
  }
});
```

### 2. Initiate Login Flow

```typescript
// Generate authorization URL with PKCE
const { url, codeVerifier, state, nonce } = authManager.generateKeycloakAuthUrl();

// Store codeVerifier, state, and nonce securely (session storage, etc.)
sessionStorage.setItem('keycloak_code_verifier', codeVerifier);
sessionStorage.setItem('keycloak_state', state);
sessionStorage.setItem('keycloak_nonce', nonce);

// Redirect user to Keycloak
window.location.href = url;
```

### 3. Handle Callback

```typescript
// In your callback route handler
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');
const state = urlParams.get('state');

// Retrieve stored values
const codeVerifier = sessionStorage.getItem('keycloak_code_verifier');
const expectedState = sessionStorage.getItem('keycloak_state');
const expectedNonce = sessionStorage.getItem('keycloak_nonce');

// Validate state
if (state !== expectedState) {
  throw new Error('Invalid state parameter');
}

// Exchange code for tokens
const result = await authManager.exchangeKeycloakCode(
  code!,
  codeVerifier!,
  state!,
  expectedNonce!
);

if (result.success) {
  console.log('Successfully authenticated:', result.tokenInfo);
  // User is now authenticated and can access Ottehr services
} else {
  console.error('Authentication failed:', result.error);
}
```

### 4. Access User Information

```typescript
// Get user info from access token
const userInfoResult = await authManager.getKeycloakUserInfo();
if (userInfoResult.success) {
  console.log('User info:', userInfoResult.userInfo);
}

// Get user roles from token
const tokenInfo = authManager.getTokenInfo();
console.log('User roles:', tokenInfo?.roles);
```

### 5. Logout

```typescript
// Logout from Keycloak and clear local tokens
const logoutResult = await authManager.logoutFromKeycloak(
  'https://your-app.com/logout-complete'
);

if (logoutResult.success) {
  // Redirect to Keycloak logout URL
  window.location.href = logoutResult.logoutUrl!;
}
```

## Role-Based Access Control

The integration supports role-based access control using Keycloak roles:

```typescript
// Check if user has specific role
const tokenInfo = authManager.getTokenInfo();
const hasAdminRole = tokenInfo?.roles?.includes('ottehr-admin');
const hasPharmacyRole = tokenInfo?.roles?.includes('ottehr-pharmacy');

if (hasAdminRole) {
  // Allow admin actions
} else if (hasPharmacyRole) {
  // Allow pharmacy-specific actions
}
```

## Security Considerations

### Production Deployment

1. **Use HTTPS**: All communication must use SSL/TLS
2. **Secure Client Secret**: Store client secrets securely (environment variables, vault)
3. **Validate Tokens**: Always validate JWT tokens and signatures
4. **PKCE**: Use PKCE for additional security in authorization code flow
5. **Token Rotation**: Implement proper token refresh and rotation
6. **CORS Configuration**: Configure CORS appropriately for your domains

### Token Validation

The integration automatically validates ID tokens using JWKS from Keycloak:
- Signature verification using Keycloak's public keys
- Issuer validation
- Audience validation  
- Expiration time validation
- Nonce validation (if provided)

## Troubleshooting

### Common Issues

1. **Invalid Redirect URI**
   - Ensure redirect URIs in Keycloak match your application URLs exactly
   - Include both HTTP (development) and HTTPS (production) URIs

2. **CORS Errors**
   - Configure Web Origins in Keycloak client settings
   - Ensure your application domain is listed

3. **Token Validation Failures**
   - Verify JWKS URI is accessible
   - Check issuer URL matches Keycloak realm
   - Ensure client ID matches audience in tokens

4. **Role Mapping Issues**
   - Verify role mapping claim path (`realm_access.roles`)
   - Check user has assigned roles in Keycloak
   - Confirm mapper configuration in client

### Debug Mode

Enable debug logging for troubleshooting:

```typescript
const authManager = createOttehrAuthManager();

// Listen to events for debugging
authManager.on('authenticated', (tokenInfo) => {
  console.log('Authentication successful:', tokenInfo);
});

authManager.on('keycloakAuthenticated', ({ tokenInfo, userInfo }) => {
  console.log('Keycloak authentication:', { tokenInfo, userInfo });
});

authManager.on('authenticationFailed', (error) => {
  console.error('Authentication failed:', error);
});
```

## Testing

Use the provided test utilities to verify your integration:

```bash
# Run Keycloak integration tests
npm test -- auth/ottehr/__tests__/authManager.test.ts
```

For manual testing, use the Keycloak Admin Console to:
1. Create test users with different roles
2. Verify token contents using JWT debugger
3. Test login/logout flows
4. Verify role assignments

## Support

For additional support:
1. Check Keycloak documentation: https://www.keycloak.org/docs/
2. Review WebQX Healthcare Platform documentation
3. Examine the test files for usage examples
4. Enable debug logging for detailed troubleshooting