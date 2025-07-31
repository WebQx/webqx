# OpenEMR Modular Connectors Documentation

## Overview

The OpenEMR Modular Connectors provide a comprehensive integration solution for connecting OpenEMR Electronic Health Records (EHR) system with the WebQx platform's Unified Provider Login System. This implementation enables Single Sign-On (SSO) using a central Identity Provider (IDP) and streamlines access to OpenEMR functionality through secure, modular components.

## Architecture

The connector system consists of three main components:

1. **OAuth2/OIDC Connector** - Handles authentication with the central IDP and token exchange
2. **API Gateway** - Provides secure request routing, rate limiting, and circuit breaking
3. **Auth Proxy Middleware** - Implements token validation, RBAC, and session management

## Components

### 1. OAuth2/OIDC Connector

The OAuth2/OIDC Connector manages authentication flows between the WebQx central IDP and OpenEMR.

#### Features:
- OAuth2/OIDC protocol support with PKCE
- Central IDP token validation
- Token exchange for OpenEMR access
- Automatic token refresh
- User context mapping
- Comprehensive audit logging

#### Usage:

```typescript
import { OAuth2Connector, OAuth2ConnectorConfig } from './connectors/oauth2-connector';

const config: OAuth2ConnectorConfig = {
  centralIdp: {
    issuer: 'https://auth.webqx.health',
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret',
    redirectUri: 'https://yourapp.com/callback',
    scopes: ['openid', 'profile', 'healthcare:read'],
    discoveryUrl: 'https://auth.webqx.health/.well-known/openid_configuration'
  },
  openemr: {
    baseUrl: 'https://your-openemr.com',
    clientId: 'openemr-client-id',
    clientSecret: 'openemr-client-secret',
    apiVersion: '7.0.2'
  },
  // ... other configuration options
};

const connector = new OAuth2Connector(config);
await connector.initialize();

// Generate authorization URL
const authUrl = connector.getAuthorizationUrl('state-value');

// Exchange authorization code for tokens
const result = await connector.exchangeCodeForCentralTokens('auth-code', 'state-value');

// Exchange central token for OpenEMR tokens
const openemrResult = await connector.exchangeForOpenEMRTokens({
  centralIdpToken: 'central-token',
  userContext: user
});
```

### 2. API Gateway

The API Gateway provides a secure proxy layer for OpenEMR API requests with authentication, authorization, and monitoring capabilities.

#### Features:
- Request authentication and routing
- Rate limiting and throttling
- Circuit breaker pattern for resilience
- CORS support
- Request/response transformation
- Comprehensive audit logging

#### Usage:

```typescript
import { APIGateway, APIGatewayConfig } from './gateway/api-gateway';

const config: APIGatewayConfig = {
  server: {
    port: 3001,
    host: '0.0.0.0',
    basePath: '/api/v1/openemr',
    enableCors: true,
    corsOrigins: ['https://your-frontend.com']
  },
  routing: {
    openemrBaseUrl: 'https://your-openemr.com',
    timeoutMs: 30000,
    retryAttempts: 3
  },
  // ... other configuration options
};

const gateway = new APIGateway(config, oauth2Connector);
await gateway.initialize();

// Register custom routes
gateway.registerRoute({
  path: '/custom-endpoint/:id',
  method: 'GET',
  requiredPermissions: ['read:patient_records'],
  openemrEndpoint: '/apis/default/api/custom/:id'
});

// Start the gateway server
await gateway.start();
```

### 3. Auth Proxy Middleware

The Auth Proxy Middleware provides Express.js middleware for token validation, role-based access control, and session management.

#### Features:
- Token validation and caching
- Role-based access control (RBAC)
- Patient and provider context management
- Session management
- Security headers
- Request validation

#### Usage:

```typescript
import express from 'express';
import { AuthProxyMiddleware, AuthProxyConfig } from './middleware/auth-proxy';

const config: AuthProxyConfig = {
  token: {
    validateOnEachRequest: true,
    cacheTokens: true,
    cacheTtlSeconds: 300
  },
  accessControl: {
    enableRBAC: true,
    enablePatientContext: true
  },
  // ... other configuration options
};

const authProxy = new AuthProxyMiddleware(config, oauth2Connector);
const app = express();

// Apply authentication middleware
app.use(authProxy.authenticate());

// Apply authorization for specific routes
app.get('/api/patient/:id', 
  authProxy.requirePatientContext(),
  authProxy.authorize(['PROVIDER'], ['read:patient_records']),
  (req, res) => {
    // Your route handler
  }
);
```

## Complete Integration Example

Here's a complete example of setting up all components together:

```typescript
import { OpenEMRConnectorManager, createConnectorManager } from './connectors';

// Create and initialize the connector manager
const manager = await createConnectorManager({
  oauth2: {
    centralIdp: {
      issuer: process.env.CENTRAL_IDP_ISSUER!,
      clientId: process.env.CENTRAL_IDP_CLIENT_ID!,
      clientSecret: process.env.CENTRAL_IDP_CLIENT_SECRET!,
      redirectUri: process.env.REDIRECT_URI!,
      scopes: ['openid', 'profile', 'healthcare:read', 'healthcare:write']
    },
    openemr: {
      baseUrl: process.env.OPENEMR_BASE_URL!,
      clientId: process.env.OPENEMR_CLIENT_ID!,
      clientSecret: process.env.OPENEMR_CLIENT_SECRET!,
      apiVersion: '7.0.2'
    }
  },
  apiGateway: {
    server: {
      port: 3001,
      basePath: '/api/v1/openemr'
    }
  },
  autoStart: true
});

// Get status
const status = manager.getStatus();
console.log('Connector Status:', status);

// Register custom routes
manager.registerRoutes([
  {
    path: '/patient/:id/summary',
    method: 'GET',
    requiredPermissions: ['read:patient_records'],
    openemrEndpoint: '/apis/default/api/patient/:id/summary'
  }
]);
```

## Configuration

### Environment Variables

The connectors support configuration through environment variables:

```bash
# Central IDP Configuration
CENTRAL_IDP_ISSUER=https://auth.webqx.health
CENTRAL_IDP_CLIENT_ID=your-client-id
CENTRAL_IDP_CLIENT_SECRET=your-client-secret
CENTRAL_IDP_REDIRECT_URI=https://yourapp.com/callback
CENTRAL_IDP_DISCOVERY_URL=https://auth.webqx.health/.well-known/openid_configuration

# OpenEMR Configuration
OPENEMR_BASE_URL=https://your-openemr.com
OPENEMR_CLIENT_ID=openemr-client-id
OPENEMR_CLIENT_SECRET=openemr-client-secret
OPENEMR_API_VERSION=7.0.2

# API Gateway Configuration
API_GATEWAY_PORT=3001
API_GATEWAY_HOST=0.0.0.0
API_GATEWAY_BASE_PATH=/api/v1/openemr
ENABLE_CORS=true
CORS_ORIGINS=https://your-frontend.com,https://another-domain.com

# Security Configuration
ENABLE_PKCE=true
VALIDATE_ISSUER=true
VALIDATE_AUDIENCE=true
ENABLE_SECURITY_HEADERS=true

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Circuit Breaker
CIRCUIT_BREAKER_ENABLED=true
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_RECOVERY_TIME_MS=60000

# Audit Configuration
AUDIT_ENABLED=true
LOG_REQUESTS=true
LOG_RESPONSES=false
```

### Configuration Files

You can also use configuration objects:

```typescript
import { loadConfigFromEnvironment, createConfig } from './config/connectors/default';

// Load configuration from environment
const config = loadConfigFromEnvironment();

// Or create environment-specific configuration
const devConfig = createConfig('development');
const prodConfig = createConfig('production');
```

## Security Considerations

### 1. Token Security
- All tokens are validated against the central IDP
- PKCE is enabled by default for enhanced security
- Tokens are cached securely with configurable TTL
- Automatic token refresh prevents session interruptions

### 2. Network Security
- All communications use HTTPS
- SSL certificate validation is enforced
- Security headers are automatically added
- CORS is properly configured

### 3. Access Control
- Role-based access control (RBAC) is enforced
- Resource-level permissions are supported
- Patient context isolation is available
- Session management prevents unauthorized access

### 4. Audit and Monitoring
- All authentication events are logged
- Failed access attempts are tracked
- Permission denied events are audited
- Request/response logging is configurable

## Error Handling

The connectors implement comprehensive error handling:

### 1. Authentication Errors
```typescript
{
  "error": "Invalid token",
  "code": "INVALID_TOKEN",
  "details": "Token has expired"
}
```

### 2. Authorization Errors
```typescript
{
  "error": "Insufficient permissions",
  "required": ["read:patient_records"],
  "actual": ["read:own_records"]
}
```

### 3. Network Errors
- Automatic retry with exponential backoff
- Circuit breaker prevents cascade failures
- Graceful degradation when services are unavailable

## Monitoring and Health Checks

### Health Check Endpoints

The API Gateway provides several health check endpoints:

- `GET /health` - Basic health status
- `GET /health/detailed` - Detailed component status
- `GET /health/oauth2` - OAuth2 connector status
- `GET /health/gateway` - API Gateway status
- `GET /health/proxy` - Auth Proxy status

### Health Check Response
```json
{
  "status": "healthy",
  "components": {
    "oauth2": "healthy",
    "apiGateway": "healthy",
    "authProxy": "healthy",
    "overall": "healthy"
  },
  "timestamp": "2024-01-31T12:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0"
}
```

## Testing

### Unit Tests

Run the unit tests:

```bash
npm test ehr-integrations/openemr/__tests__
```

### Integration Tests

Test the complete flow:

```typescript
import { createConnectorManager } from './connectors';

describe('OpenEMR Integration', () => {
  it('should complete full authentication flow', async () => {
    const manager = await createConnectorManager(testConfig);
    
    // Test OAuth2 flow
    const authUrl = manager.getOAuth2Connector().getAuthorizationUrl('test-state');
    expect(authUrl).toContain('response_type=code');
    
    // Test token exchange
    const result = await manager.exchangeTokens({
      centralIdpToken: 'test-token',
      userContext: testUser
    });
    
    expect(result.success).toBe(true);
  });
});
```

## Deployment

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3001
CMD ["npm", "start"]
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: openemr-connectors
spec:
  replicas: 3
  selector:
    matchLabels:
      app: openemr-connectors
  template:
    metadata:
      labels:
        app: openemr-connectors
    spec:
      containers:
      - name: connectors
        image: webqx/openemr-connectors:latest
        ports:
        - containerPort: 3001
        env:
        - name: CENTRAL_IDP_ISSUER
          valueFrom:
            secretKeyRef:
              name: connector-secrets
              key: central-idp-issuer
        # ... other environment variables
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/detailed
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 5
```

## Troubleshooting

### Common Issues

1. **Token Validation Failures**
   - Check central IDP configuration
   - Verify client credentials
   - Ensure discovery URL is accessible

2. **OpenEMR Connection Issues**
   - Verify OpenEMR base URL
   - Check OpenEMR client credentials
   - Ensure network connectivity

3. **Permission Denied Errors**
   - Verify user roles and permissions
   - Check RBAC configuration
   - Review audit logs for details

4. **Circuit Breaker Activation**
   - Monitor OpenEMR service health
   - Check network connectivity
   - Review error rates and thresholds

### Debug Mode

Enable debug logging:

```bash
DEBUG=openemr:* npm start
```

Or set in configuration:

```typescript
{
  oauth2: {
    audit: {
      enabled: true,
      logTokenExchange: true,
      logUserMapping: true
    }
  }
}
```

## Support

For support and questions:

1. Check the troubleshooting section
2. Review audit logs for error details
3. Monitor health check endpoints
4. Contact the WebQx development team

## License

This software is licensed under the Apache 2.0 License. See the LICENSE file for details.