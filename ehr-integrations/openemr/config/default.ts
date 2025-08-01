/**
 * OpenEMR Configuration Example
 */

export const openemrConfig = {
  baseUrl: process.env.OPENEMR_BASE_URL || 'https://localhost',
  apiVersion: process.env.OPENEMR_API_VERSION || '7.0.2',
  oauth: {
    clientId: process.env.OPENEMR_CLIENT_ID!,
    clientSecret: process.env.OPENEMR_CLIENT_SECRET!,
    redirectUri: process.env.OPENEMR_REDIRECT_URI!,
    scopes: [
      'openid',
      'fhirUser',
      'patient/Patient.read',
      'patient/Appointment.read',
      'patient/Appointment.write',
      'patient/Encounter.read',
      'patient/Observation.read'
    ]
  },
  fhir: {
    enabled: process.env.OPENEMR_FHIR_ENABLED === 'true',
    baseUrl: process.env.OPENEMR_FHIR_BASE_URL
  },
  security: {
    verifySSL: process.env.OPENEMR_VERIFY_SSL !== 'false',
    timeout: parseInt(process.env.OPENEMR_TIMEOUT_MS || '30000')
  },
  features: {
    enableAudit: process.env.OPENEMR_ENABLE_AUDIT === 'true',
    enableSync: process.env.OPENEMR_ENABLE_SYNC === 'true',
    syncInterval: parseInt(process.env.OPENEMR_SYNC_INTERVAL_MINUTES || '15')
  }
};

export default openemrConfig;