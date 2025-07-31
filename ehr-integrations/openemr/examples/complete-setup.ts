/**
 * Example: Complete OpenEMR Connector Setup
 * 
 * This example demonstrates how to set up and use the OpenEMR modular connectors
 * with the WebQx Unified Provider Login System.
 */

import express from 'express';
import { createConnectorManager } from '../connectors';
import type { ConnectorManagerConfig } from '../connectors';

// Example configuration
const connectorConfig: Partial<ConnectorManagerConfig> = {
  oauth2: {
    centralIdp: {
      issuer: 'https://auth.webqx.health',
      clientId: 'webqx-openemr-connector',
      clientSecret: 'your-central-idp-client-secret',
      redirectUri: 'https://your-app.webqx.health/auth/callback',
      scopes: ['openid', 'profile', 'email', 'healthcare:read', 'healthcare:write'],
      discoveryUrl: 'https://auth.webqx.health/.well-known/openid_configuration'
    },
    openemr: {
      baseUrl: 'https://openemr.your-organization.com',
      clientId: 'webqx-connector',
      clientSecret: 'your-openemr-client-secret',
      apiVersion: '7.0.2'
    },
    tokens: {
      accessTokenTtl: 3600,
      refreshTokenTtl: 604800,
      enableRefresh: true
    },
    security: {
      validateIssuer: true,
      validateAudience: true,
      enablePKCE: true,
      clockSkewTolerance: 300
    },
    audit: {
      enabled: true,
      logTokenExchange: true,
      logUserMapping: true
    }
  },
  apiGateway: {
    server: {
      port: 3001,
      host: '0.0.0.0',
      basePath: '/api/v1/openemr',
      enableCors: true,
      corsOrigins: ['https://your-frontend.webqx.health']
    },
    auth: {
      enableTokenValidation: true,
      tokenCacheTtl: 300,
      requireValidSession: true
    },
    rateLimit: {
      enabled: true,
      windowMs: 900000, // 15 minutes
      maxRequests: 100,
      skipSuccessfulRequests: true
    },
    routing: {
      openemrBaseUrl: 'https://openemr.your-organization.com',
      timeoutMs: 30000,
      retryAttempts: 3,
      retryDelayMs: 1000
    },
    circuitBreaker: {
      enabled: true,
      failureThreshold: 5,
      recoveryTimeMs: 60000,
      monitoringWindowMs: 300000
    },
    audit: {
      enabled: true,
      logRequests: true,
      logResponses: false,
      logHeaders: false
    }
  },
  authProxy: {
    token: {
      validateOnEachRequest: true,
      refreshThresholdSeconds: 300,
      cacheTokens: true,
      cacheTtlSeconds: 300
    },
    session: {
      enableSessionManagement: true,
      sessionTimeoutSeconds: 3600,
      enableConcurrentSessions: true,
      maxConcurrentSessions: 5
    },
    accessControl: {
      enableRBAC: true,
      enableResourceLevelAccess: true,
      enablePatientContext: true,
      enableProviderContext: true
    },
    security: {
      enableSecurityHeaders: true,
      enableCSRFProtection: false,
      enableRequestValidation: true,
      maxRequestSize: 10485760
    },
    audit: {
      enabled: true,
      logAllRequests: false,
      logFailedAuth: true,
      logPermissionDenied: true
    }
  },
  autoStart: true,
  enableHealthChecks: true
};

async function setupOpenEMRConnectors() {
  try {
    console.log('Setting up OpenEMR Connectors...');
    
    // Create and initialize the connector manager
    const manager = await createConnectorManager(connectorConfig);
    
    // Check status
    const status = manager.getStatus();
    console.log('Connector Status:', status);
    
    // Register custom routes
    manager.registerRoutes([
      {
        path: '/patient/:id/summary',
        method: 'GET',
        requiredPermissions: ['read:patient_records'],
        openemrEndpoint: '/apis/default/api/patient/:id/summary',
        transformResponse: (data) => {
          // Custom transformation logic
          return {
            ...data,
            timestamp: new Date().toISOString()
          };
        }
      },
      {
        path: '/appointments/available',
        method: 'GET',
        requiredPermissions: ['read:patient_records'],
        openemrEndpoint: '/apis/default/fhir/Slot',
        rateLimit: {
          windowMs: 60000,
          maxRequests: 10
        }
      },
      {
        path: '/appointment',
        method: 'POST',
        requiredPermissions: ['create:appointments'],
        requiredRole: 'PROVIDER',
        openemrEndpoint: '/apis/default/api/appointment',
        transformRequest: (req) => {
          // Add audit trail
          return {
            ...req.body,
            createdBy: req.user?.id,
            createdAt: new Date().toISOString()
          };
        }
      }
    ]);
    
    console.log('OpenEMR Connectors setup complete!');
    console.log(`API Gateway running on port ${connectorConfig.apiGateway?.server?.port || 3001}`);
    console.log(`Health checks available at: /health, /health/detailed`);
    
    return manager;
  } catch (error) {
    console.error('Failed to setup OpenEMR Connectors:', error);
    throw error;
  }
}

// Example: Using connectors in an Express application
async function createApp() {
  const app = express();
  
  // Setup connectors
  const manager = await setupOpenEMRConnectors();
  
  // Get individual components
  const oauth2Connector = manager.getOAuth2Connector();
  const authProxy = manager.getAuthProxy();
  
  // Add custom middleware
  app.use('/auth', (req, res, next) => {
    // Custom authentication logic
    next();
  });
  
  // Protected routes
  app.get('/protected', 
    authProxy.authenticate(),
    authProxy.authorize(['PROVIDER'], ['read:patient_records']),
    (req, res) => {
      res.json({ 
        message: 'Access granted', 
        user: req.user 
      });
    }
  );
  
  // Patient-specific routes
  app.get('/patient/:id/data',
    authProxy.authenticate(),
    authProxy.requirePatientContext(),
    authProxy.authorize(['PROVIDER', 'NURSE'], ['read:patient_records']),
    (req, res) => {
      res.json({
        patientId: req.patientContext,
        data: 'Patient data here'
      });
    }
  );
  
  return app;
}

// Example: OAuth2 flow
async function handleOAuth2Flow() {
  const manager = await createConnectorManager(connectorConfig);
  const oauth2Connector = manager.getOAuth2Connector();
  
  // 1. Generate authorization URL
  const state = 'random-state-value';
  const pkce = oauth2Connector.generatePKCE();
  const authUrl = oauth2Connector.getAuthorizationUrl(state, pkce);
  
  console.log('Redirect user to:', authUrl);
  
  // 2. Handle callback (simulate)
  const authCode = 'received-auth-code';
  const tokenResult = await oauth2Connector.exchangeCodeForCentralTokens(
    authCode, 
    state, 
    pkce.codeVerifier
  );
  
  if (tokenResult.success) {
    console.log('User authenticated:', tokenResult.user);
    
    // 3. Exchange for OpenEMR tokens
    const openemrResult = await oauth2Connector.exchangeForOpenEMRTokens({
      centralIdpToken: tokenResult.session!.token,
      userContext: tokenResult.user!
    });
    
    if (openemrResult.success) {
      console.log('OpenEMR access granted:', openemrResult.openemrTokens);
    }
  }
}

// Example: Health monitoring
async function monitorHealth() {
  const manager = await createConnectorManager(connectorConfig);
  
  setInterval(async () => {
    const status = await manager.performHealthChecks();
    console.log('Health Status:', status);
    
    if (status.overall !== 'healthy') {
      console.warn('System health degraded:', status);
      // Implement alerting logic here
    }
  }, 60000); // Check every minute
}

// Export for use in other modules
export {
  setupOpenEMRConnectors,
  createApp,
  handleOAuth2Flow,
  monitorHealth,
  connectorConfig
};

// Example usage
if (require.main === module) {
  setupOpenEMRConnectors()
    .then(() => console.log('Connectors ready!'))
    .catch(console.error);
}