/**
 * WebQX™ Keycloak Client Configuration
 * 
 * Provides Keycloak client setup and configuration management.
 */

import Keycloak from 'keycloak-js';
import KeycloakConnect from 'keycloak-connect';
import { KeycloakConfig, KeycloakProviderConfig } from './types';

/**
 * Creates a Keycloak client instance for frontend/browser use
 */
export function createKeycloakClient(config: KeycloakConfig): Keycloak.KeycloakInstance {
  // @types/keycloak-js doesn't expose a KeycloakConfig type; the factory accepts string | {}
  const keycloakConfig: any = {
    url: config.url,
    realm: config.realm,
    clientId: config.clientId,
  };

  const initOptions: Keycloak.KeycloakInitOptions = {
    onLoad: config.onLoad || 'check-sso',
    checkLoginIframe: config.checkLoginIframe !== false,
    // checkLoginIframeInterval is (incorrectly) typed as boolean in @types; omit to avoid type issues
    responseMode: config.responseMode || 'fragment',
    flow: config.flow || 'standard',
  } as any;

  const keycloak = Keycloak(keycloakConfig);

  // Initialize with options (use success/error per @types)
  (keycloak.init(initOptions) as unknown as Keycloak.KeycloakPromise<boolean, Keycloak.KeycloakError>)
    .success((authenticated) => {
      if (config.enableLogging) {
        console.log('Keycloak initialized. Authenticated:', authenticated);
      }
    })
    .error((error) => {
      console.error('Keycloak initialization failed:', error);
    });

  return keycloak;
}

/**
 * Creates a Keycloak Connect instance for server-side use
 */
export function createKeycloakConnect(
  sessionStore: any,
  config: KeycloakConfig
): any {
  // keycloak-connect typings expect options then config
  const kcConfig: any = {
    realm: config.realm,
    'bearer-only': config.bearerOnly !== false,
    'auth-server-url': config.url,
    'ssl-required': 'external',
    resource: config.clientId,
    'public-client': config.publicClient !== false,
  };

  if (config.clientSecret) {
    kcConfig.credentials = { secret: config.clientSecret };
  }

  return new (KeycloakConnect as any)({ store: sessionStore }, kcConfig);
}

/**
 * Gets Keycloak configuration from environment variables
 */
export function getKeycloakConfig(): KeycloakConfig {
  return {
    realm: process.env.KEYCLOAK_REALM || 'webqx-healthcare',
    url: process.env.KEYCLOAK_URL || 'http://localhost:8080/auth',
    clientId: process.env.KEYCLOAK_CLIENT_ID || 'webqx-openemr',
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
    publicClient: process.env.KEYCLOAK_PUBLIC_CLIENT === 'true',
    bearerOnly: process.env.KEYCLOAK_BEARER_ONLY !== 'false',
    checkLoginIframe: process.env.KEYCLOAK_CHECK_LOGIN_IFRAME !== 'false',
    checkLoginIframeInterval: parseInt(process.env.KEYCLOAK_CHECK_LOGIN_IFRAME_INTERVAL || '5'),
    onLoad: (process.env.KEYCLOAK_ON_LOAD as any) || 'check-sso',
    responseMode: (process.env.KEYCLOAK_RESPONSE_MODE as any) || 'fragment',
    flow: (process.env.KEYCLOAK_FLOW as any) || 'standard',
    enableLogging: process.env.KEYCLOAK_ENABLE_LOGGING === 'true',
    pkceMethod: 'S256',
    logoutRedirectUri: process.env.KEYCLOAK_LOGOUT_REDIRECT_URI,
  };
}

/**
 * Gets default role mappings for healthcare specialties
 */
export function getDefaultRoleMappings() {
  return [
    {
      keycloakRole: 'healthcare-provider',
      webqxRole: 'PROVIDER' as const,
      permissions: [
        'read:patient_records',
        'write:prescriptions',
        'write:clinical_notes',
        'order:lab_tests',
        'access:imaging',
      ],
    },
    {
      keycloakRole: 'primary-care-physician',
      webqxRole: 'PROVIDER' as const,
      specialty: 'PRIMARY_CARE' as const,
      permissions: [
        'read:patient_records',
        'write:prescriptions',
        'write:clinical_notes',
        'order:lab_tests',
        'access:imaging',
      ],
    },
    {
      keycloakRole: 'nurse',
      webqxRole: 'NURSE' as const,
      permissions: [
        'write:vitals',
        'administer:medications',
        'monitor:patients',
        'read:patient_records',
      ],
    },
    {
      keycloakRole: 'attending-physician',
      webqxRole: 'ATTENDING' as const,
      permissions: [
        'read:patient_records',
        'write:prescriptions',
        'write:clinical_notes',
        'order:lab_tests',
        'access:imaging',
        'supervise:residents',
        'approve:procedures',
      ],
    },
    {
      keycloakRole: 'resident',
      webqxRole: 'RESIDENT' as const,
      permissions: [
        'read:patient_records',
        'write:clinical_notes',
        'order:lab_tests',
      ],
    },
    {
      keycloakRole: 'healthcare-admin',
      webqxRole: 'ADMIN' as const,
      permissions: [
        'manage:users',
        'configure:system',
        'view:audit_logs',
        'manage:billing',
      ],
    },
    {
      keycloakRole: 'patient',
      webqxRole: 'PATIENT' as const,
      permissions: [
        'read:own_records',
        'create:appointments',
        'read:lab_results',
        'send:messages',
      ],
    },
  ];
}

/**
 * Gets full provider configuration with defaults
 */
export function getKeycloakProviderConfig(): KeycloakProviderConfig {
  const identityProviders = {
    microsoft: {
      enabled: process.env.KEYCLOAK_IDP_MICROSOFT_ENABLED !== 'false',
      idpHint: process.env.KEYCLOAK_IDP_MICROSOFT_HINT || process.env.KEYCLOAK_MICROSOFT_IDP_HINT || 'microsoft',
      displayName: process.env.KEYCLOAK_IDP_MICROSOFT_NAME || 'Microsoft',
      clientId: process.env.AZURE_CLIENT_ID
    },
    google: {
      enabled: process.env.KEYCLOAK_IDP_GOOGLE_ENABLED !== 'false',
      idpHint: process.env.KEYCLOAK_IDP_GOOGLE_HINT || process.env.KEYCLOAK_GOOGLE_IDP_HINT || 'google',
      displayName: process.env.KEYCLOAK_IDP_GOOGLE_NAME || 'Google',
      clientId: process.env.GOOGLE_CLIENT_ID
    },
    apple: {
      enabled: process.env.KEYCLOAK_IDP_APPLE_ENABLED !== 'false',
      idpHint: process.env.KEYCLOAK_IDP_APPLE_HINT || process.env.KEYCLOAK_APPLE_IDP_HINT || 'apple',
      displayName: process.env.KEYCLOAK_IDP_APPLE_NAME || 'Apple',
      clientId: process.env.APPLE_CLIENT_ID
    }
  };

  return {
    keycloak: getKeycloakConfig(),
    roleMappings: getDefaultRoleMappings(),
    enableProviderVerification: process.env.KEYCLOAK_ENABLE_PROVIDER_VERIFICATION === 'true',
    enableAuditLogging: process.env.KEYCLOAK_ENABLE_AUDIT_LOGGING !== 'false',
    tokenValidation: {
      checkTokenType: process.env.KEYCLOAK_CHECK_TOKEN_TYPE !== 'false',
      checkAudience: process.env.KEYCLOAK_CHECK_AUDIENCE !== 'false',
      allowedAudiences: process.env.KEYCLOAK_ALLOWED_AUDIENCES?.split(','),
      minimumTokenAge: parseInt(process.env.KEYCLOAK_MIN_TOKEN_AGE || '0'),
      maximumTokenAge: parseInt(process.env.KEYCLOAK_MAX_TOKEN_AGE || '3600'),
    },
    identityProviders,
  };
}