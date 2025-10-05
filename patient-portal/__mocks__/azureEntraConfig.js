// Jest manual mock for azureEntraConfig to bypass @azure/identity ESM in tests
module.exports = {
  azureConfig: {
    patient: {
      tenantId: 'mock-tenant',
      clientId: 'mock-client',
      clientSecret: 'mock-secret',
      authority: 'https://login.microsoftonline.com/mock',
      scopes: ['openid','profile','email'],
      conditionalAccess: { requireMFA: false, requireCompliantDevice: false, blockLegacyAuth: true },
      healthcareRoles: { patient: 'Patient', guardian: 'Guardian', proxy: 'HealthcareProxy', emergency: 'EmergencyContact' }
    }
  },
  createPatientAuthUrl: (redirectUri, state) => `${redirectUri}?state=${state}&mock=1`,
  exchangeCodeForTokens: async () => ({ access_token: 'mock-access', id_token: 'mock-id', refresh_token: 'mock-refresh' }),
  getUserInfo: async () => ({ id:'u1', email:'user@example.com', name:'Mock User', groups:[], manager:null }),
  determinePatientRole: () => 'Patient',
  validateConditionalAccess: () => ({ compliant:true, violations:[] }),
  createLogoutUrl: (post) => `${post}?logged_out=1`,
  refreshAccessToken: async () => ({ access_token:'mock-access-2', refresh_token:'mock-refresh-2' })
};