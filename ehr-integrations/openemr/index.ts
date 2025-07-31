/**
 * OpenEMR Integration Module
 * 
 * Ready-to-deploy integration with OpenEMR EHR system including
 * modular connectors for Unified Provider Login System integration
 */

export { OpenEMRIntegration } from './services/integration';
export type {
  OpenEMRConfig,
  OpenEMRTokens,
  OpenEMRPatient,
  OpenEMRAppointment,
  OpenEMRSlot,
  OpenEMREncounter,
  OpenEMRClinicalSummary,
  OpenEMRSearchParams,
  OpenEMRAppointmentRequest,
  OpenEMRSlotSearchParams,
  OpenEMROperationResult,
  OpenEMRAuditEvent
} from './types';

// Export modular connectors for Unified Provider Login System
export {
  OpenEMRConnectorManager,
  createConnectorManager,
  createConnectorApp,
  OAuth2Connector,
  APIGateway,
  AuthProxyMiddleware
} from './connectors';

export type {
  ConnectorManagerConfig,
  ConnectorStatus,
  OAuth2ConnectorConfig,
  TokenExchangeRequest,
  TokenExchangeResult,
  APIGatewayConfig,
  RouteConfig,
  AuthProxyConfig
} from './connectors';

// Export configuration utilities
export {
  defaultOAuth2Config,
  defaultAPIGatewayConfig,
  defaultAuthProxyConfig,
  loadConfigFromEnvironment,
  createConfig,
  validateConfig
} from './config/connectors/default';

// Configuration helper
export const createOpenEMRConfig = (options: {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  apiVersion?: string;
  enableFHIR?: boolean;
  fhirBaseUrl?: string;
  scopes?: string[];
}): import('./types').OpenEMRConfig => ({
  baseUrl: options.baseUrl,
  apiVersion: options.apiVersion || '7.0.2',
  oauth: {
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    redirectUri: options.redirectUri,
    scopes: options.scopes || [
      'openid',
      'fhirUser',
      'patient/Patient.read',
      'patient/Appointment.read',
      'patient/Appointment.write'
    ]
  },
  fhir: {
    enabled: options.enableFHIR !== false,
    baseUrl: options.fhirBaseUrl || `${options.baseUrl}/apis/default/fhir`
  },
  security: {
    verifySSL: true,
    timeout: 30000
  },
  features: {
    enableAudit: true,
    enableSync: true,
    syncInterval: 15
  }
});

// Quick start helper
export const createOpenEMRIntegration = async (config: import('./types').OpenEMRConfig) => {
  const integration = new OpenEMRIntegration(config);
  await integration.initialize();
  return integration;
};