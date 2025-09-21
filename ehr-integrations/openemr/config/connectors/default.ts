/**
 * Default Configuration for OpenEMR Modular Connectors
 * 
 * This file contains the default configuration for the OpenEMR integration
 * connectors including OAuth2, API Gateway, and Auth Proxy components.
 */

import type { OAuth2ConnectorConfig } from '../../connectors/oauth2-connector';
import type { APIGatewayConfig } from '../../gateway/api-gateway';
import type { AuthProxyConfig } from '../../middleware/auth-proxy';

/**
 * Default OAuth2 Connector Configuration
 */
export const defaultOAuth2Config: OAuth2ConnectorConfig = {
  centralIdp: {
    issuer: process.env.CENTRAL_IDP_ISSUER || 'https://auth.webqx.health',
    clientId: process.env.CENTRAL_IDP_CLIENT_ID || '',
    clientSecret: process.env.CENTRAL_IDP_CLIENT_SECRET || '',
    redirectUri: process.env.CENTRAL_IDP_REDIRECT_URI || 'https://api.webqx.health/auth/callback',
    scopes: [
      'openid',
      'profile',
      'email',
      'healthcare:read',
      'healthcare:write'
    ],
    discoveryUrl: process.env.CENTRAL_IDP_DISCOVERY_URL || 'https://auth.webqx.health/.well-known/openid_configuration'
  },
  
  openemr: {
    baseUrl: process.env.OPENEMR_BASE_URL || 'https://openemr.example.com',
    clientId: process.env.OPENEMR_CLIENT_ID || '',
    clientSecret: process.env.OPENEMR_CLIENT_SECRET || '',
    apiVersion: process.env.OPENEMR_API_VERSION || '7.0.2'
  },
  
  tokens: {
    accessTokenTtl: parseInt(process.env.ACCESS_TOKEN_TTL || '3600'), // 1 hour
    refreshTokenTtl: parseInt(process.env.REFRESH_TOKEN_TTL || '604800'), // 7 days
    enableRefresh: process.env.ENABLE_TOKEN_REFRESH !== 'false'
  },
  
  security: {
    validateIssuer: process.env.VALIDATE_ISSUER !== 'false',
    validateAudience: process.env.VALIDATE_AUDIENCE !== 'false',
    clockSkewTolerance: parseInt(process.env.CLOCK_SKEW_TOLERANCE || '300'), // 5 minutes
    enablePKCE: process.env.ENABLE_PKCE !== 'false'
  },
  
  audit: {
    enabled: process.env.AUDIT_ENABLED !== 'false',
    logTokenExchange: process.env.LOG_TOKEN_EXCHANGE !== 'false',
    logUserMapping: process.env.LOG_USER_MAPPING !== 'false'
  }
};

/**
 * Default API Gateway Configuration
 */
export const defaultAPIGatewayConfig: APIGatewayConfig = {
  server: {
    port: parseInt(process.env.API_GATEWAY_PORT || '3001'),
    host: process.env.API_GATEWAY_HOST || '0.0.0.0',
    basePath: process.env.API_GATEWAY_BASE_PATH || '/api/v1/openemr',
    enableCors: process.env.ENABLE_CORS !== 'false',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*']
  },
  
  auth: {
    enableTokenValidation: process.env.ENABLE_TOKEN_VALIDATION !== 'false',
    tokenCacheTtl: parseInt(process.env.TOKEN_CACHE_TTL || '300'), // 5 minutes
    requireValidSession: process.env.REQUIRE_VALID_SESSION !== 'false'
  },
  
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESSFUL !== 'false'
  },
  
  routing: {
    openemrBaseUrl: process.env.OPENEMR_BASE_URL || 'https://openemr.example.com',
    timeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || '30000'), // 30 seconds
    retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3'),
    retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '1000')
  },
  
  circuitBreaker: {
    enabled: process.env.CIRCUIT_BREAKER_ENABLED !== 'false',
    failureThreshold: parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '5'),
    recoveryTimeMs: parseInt(process.env.CIRCUIT_BREAKER_RECOVERY_TIME_MS || '60000'), // 1 minute
    monitoringWindowMs: parseInt(process.env.CIRCUIT_BREAKER_MONITORING_WINDOW_MS || '300000') // 5 minutes
  },
  
  audit: {
    enabled: process.env.AUDIT_ENABLED !== 'false',
    logRequests: process.env.LOG_REQUESTS !== 'false',
    logResponses: process.env.LOG_RESPONSES !== 'false',
    logHeaders: process.env.LOG_HEADERS === 'true'
  }
};

/**
 * Default Auth Proxy Configuration
 */
export const defaultAuthProxyConfig: AuthProxyConfig = {
  token: {
    validateOnEachRequest: process.env.VALIDATE_TOKEN_ON_EACH_REQUEST !== 'false',
    refreshThresholdSeconds: parseInt(process.env.TOKEN_REFRESH_THRESHOLD_SECONDS || '300'), // 5 minutes
    cacheTokens: process.env.CACHE_TOKENS !== 'false',
    cacheTtlSeconds: parseInt(process.env.TOKEN_CACHE_TTL_SECONDS || '300') // 5 minutes
  },
  
  session: {
    enableSessionManagement: process.env.ENABLE_SESSION_MANAGEMENT !== 'false',
    sessionTimeoutSeconds: parseInt(process.env.SESSION_TIMEOUT_SECONDS || '3600'), // 1 hour
    enableConcurrentSessions: process.env.ENABLE_CONCURRENT_SESSIONS !== 'false',
    maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '5')
  },
  
  accessControl: {
    enableRBAC: process.env.ENABLE_RBAC !== 'false',
    enableResourceLevelAccess: process.env.ENABLE_RESOURCE_LEVEL_ACCESS !== 'false',
    enablePatientContext: process.env.ENABLE_PATIENT_CONTEXT !== 'false',
    enableProviderContext: process.env.ENABLE_PROVIDER_CONTEXT !== 'false'
  },
  
  security: {
    enableSecurityHeaders: process.env.ENABLE_SECURITY_HEADERS !== 'false',
    enableCSRFProtection: process.env.ENABLE_CSRF_PROTECTION !== 'false',
    enableRequestValidation: process.env.ENABLE_REQUEST_VALIDATION !== 'false',
    maxRequestSize: parseInt(process.env.MAX_REQUEST_SIZE || '10485760') // 10MB
  },
  
  audit: {
    enabled: process.env.AUDIT_ENABLED !== 'false',
    logAllRequests: process.env.LOG_ALL_REQUESTS !== 'false',
    logFailedAuth: process.env.LOG_FAILED_AUTH !== 'false',
    logPermissionDenied: process.env.LOG_PERMISSION_DENIED !== 'false'
  }
};

/**
 * Environment-specific configuration factory
 */
export function createConfig(environment: 'development' | 'staging' | 'production' = 'development') {
  const baseConfigs = {
    oauth2: { ...defaultOAuth2Config },
    apiGateway: { ...defaultAPIGatewayConfig },
    authProxy: { ...defaultAuthProxyConfig }
  };

  switch (environment) {
    case 'development':
      // Development-specific overrides
      baseConfigs.oauth2.security.validateIssuer = false;
      baseConfigs.oauth2.audit.enabled = true;
      baseConfigs.apiGateway.audit.logRequests = true;
      baseConfigs.apiGateway.audit.logResponses = true;
      baseConfigs.authProxy.audit.logAllRequests = true;
      break;

    case 'staging':
      // Staging-specific overrides
      baseConfigs.oauth2.security.validateIssuer = true;
      baseConfigs.apiGateway.rateLimit.maxRequests = 200;
      baseConfigs.authProxy.session.sessionTimeoutSeconds = 7200; // 2 hours
      break;

    case 'production':
      // Production-specific overrides
      baseConfigs.oauth2.security.validateIssuer = true;
      baseConfigs.oauth2.security.validateAudience = true;
      baseConfigs.apiGateway.rateLimit.maxRequests = 1000;
      baseConfigs.apiGateway.circuitBreaker.enabled = true;
      baseConfigs.authProxy.security.enableCSRFProtection = true;
      baseConfigs.authProxy.audit.logAllRequests = false; // Reduce logging in production
      break;
  }

  return baseConfigs;
}

/**
 * Validate configuration completeness
 */
export function validateConfig(config: {
  oauth2: OAuth2ConnectorConfig;
  apiGateway: APIGatewayConfig;
  authProxy: AuthProxyConfig;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate OAuth2 configuration
  if (!config.oauth2.centralIdp.clientId) {
    errors.push('OAuth2: Central IDP client ID is required');
  }
  if (!config.oauth2.centralIdp.clientSecret) {
    errors.push('OAuth2: Central IDP client secret is required');
  }
  if (!config.oauth2.openemr.clientId) {
    errors.push('OAuth2: OpenEMR client ID is required');
  }
  if (!config.oauth2.openemr.clientSecret) {
    errors.push('OAuth2: OpenEMR client secret is required');
  }

  // Validate API Gateway configuration
  if (!config.apiGateway.routing.openemrBaseUrl) {
    errors.push('API Gateway: OpenEMR base URL is required');
  }
  if (config.apiGateway.server.port < 1 || config.apiGateway.server.port > 65535) {
    errors.push('API Gateway: Invalid port number');
  }

  // Validate Auth Proxy configuration
  if (config.authProxy.security.maxRequestSize < 1024) {
    errors.push('Auth Proxy: Maximum request size too small');
  }
  if (config.authProxy.session.sessionTimeoutSeconds < 60) {
    errors.push('Auth Proxy: Session timeout too short (minimum 60 seconds)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Load configuration from environment with validation
 */
export function loadConfigFromEnvironment(environment?: string) {
  const env = (environment || process.env.NODE_ENV || 'development') as 'development' | 'staging' | 'production';
  const config = createConfig(env);
  
  const validation = validateConfig(config);
  if (!validation.valid) {
    throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
  }
  
  return config;
}