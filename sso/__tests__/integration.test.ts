import { SSOManager } from '../index';
import { SSOConfig } from '../types/common';

describe('SSO Integration Tests', () => {
  let ssoManager: SSOManager;
  
  const mockConfig: Partial<SSOConfig> = {
    secretKey: 'test-secret-key-that-is-at-least-32-chars-long',
    sessionTimeout: 3600000,
    auditEnabled: true,
    providers: {
      oauth2: {
        azure: {
          provider: 'azure',
          clientId: 'test-azure-client-id',
          clientSecret: 'test-azure-client-secret',
          redirectUri: 'https://localhost:3000/auth/oauth2/azure/callback',
          scope: ['openid', 'profile', 'email'],
          tenant: 'test-tenant'
        },
        google: {
          provider: 'google',
          clientId: 'test-google-client-id.googleusercontent.com',
          clientSecret: 'test-google-client-secret',
          redirectUri: 'https://localhost:3000/auth/oauth2/google/callback',
          scope: ['openid', 'profile', 'email']
        }
      },
      saml: {
        azure: {
          provider: 'azure',
          entryPoint: 'https://login.microsoftonline.com/test-tenant/saml2',
          issuer: 'https://webqx.health',
          cert: '-----BEGIN CERTIFICATE-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA\n-----END CERTIFICATE-----'
        },
        okta: {
          provider: 'okta',
          entryPoint: 'https://test-org.okta.com/app/test-app/sso/saml',
          issuer: 'https://webqx.health',
          cert: '-----BEGIN CERTIFICATE-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA\n-----END CERTIFICATE-----'
        }
      }
    }
  };

  beforeEach(() => {
    ssoManager = new SSOManager(mockConfig);
  });

  describe('SSO Manager Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(ssoManager).toBeDefined();
      
      const supportedProviders = ssoManager.getSupportedProviders();
      expect(supportedProviders.oauth2).toContain('azure');
      expect(supportedProviders.oauth2).toContain('google');
      expect(supportedProviders.saml).toContain('azure');
      expect(supportedProviders.saml).toContain('okta');
    });

    it('should have audit logger configured', () => {
      const auditLogger = ssoManager.getAuditLogger();
      expect(auditLogger).toBeDefined();
    });

    it('should have authentication middleware available', () => {
      expect(ssoManager.requireAuth).toBeDefined();
      expect(ssoManager.optionalAuth).toBeDefined();
      expect(typeof ssoManager.requireRoles).toBe('function');
      expect(typeof ssoManager.requireGroups).toBe('function');
    });
  });

  describe('OAuth2 Authentication Flow', () => {
    it('should generate OAuth2 authorization URL for Azure', () => {
      const authUrl = ssoManager.getOAuth2AuthUrl('azure');
      expect(authUrl).toContain('login.microsoftonline.com');
      expect(authUrl).toContain('client_id=test-azure-client-id');
      expect(authUrl).toContain('test-tenant');
    });

    it('should generate OAuth2 authorization URL for Google', () => {
      const authUrl = ssoManager.getOAuth2AuthUrl('google');
      expect(authUrl).toContain('accounts.google.com');
      expect(authUrl).toContain('client_id=test-google-client-id.googleusercontent.com');
    });

    it('should throw error for unknown OAuth2 provider', () => {
      expect(() => {
        ssoManager.getOAuth2AuthUrl('unknown');
      }).toThrow();
    });
  });

  describe('SAML Authentication Flow', () => {
    it('should generate SAML authorization URL for Azure', () => {
      const authUrl = ssoManager.getSAMLAuthUrl('azure');
      expect(authUrl).toContain('login.microsoftonline.com');
      expect(authUrl).toContain('SAMLRequest=');
    });

    it('should generate SAML authorization URL for Okta', () => {
      const authUrl = ssoManager.getSAMLAuthUrl('okta');
      expect(authUrl).toContain('test-org.okta.com');
      expect(authUrl).toContain('SAMLRequest=');
    });

    it('should generate SAML authorization URL with relay state', () => {
      const relayState = 'test-relay-state';
      const authUrl = ssoManager.getSAMLAuthUrl('azure', relayState);
      expect(authUrl).toContain('login.microsoftonline.com');
      expect(authUrl).toContain('SAMLRequest=');
      expect(authUrl).toContain(`RelayState=${relayState}`);
    });

    it('should throw error for unknown SAML provider', () => {
      expect(() => {
        ssoManager.getSAMLAuthUrl('unknown');
      }).toThrow();
    });
  });

  describe('Dynamic Provider Management', () => {
    it('should add OAuth2 provider dynamically', () => {
      const newProviderConfig = {
        provider: 'generic',
        clientId: 'test-generic-client-id',
        clientSecret: 'test-generic-client-secret',
        redirectUri: 'https://localhost:3000/auth/oauth2/generic/callback',
        scope: ['openid', 'profile', 'email'],
        authorizationURL: 'https://example.com/oauth2/authorize',
        tokenURL: 'https://example.com/oauth2/token',
        userInfoURL: 'https://example.com/oauth2/userinfo'
      };

      ssoManager.addOAuth2Provider('generic', newProviderConfig);
      
      const supportedProviders = ssoManager.getSupportedProviders();
      expect(supportedProviders.oauth2).toContain('generic');
      
      const authUrl = ssoManager.getOAuth2AuthUrl('generic');
      expect(authUrl).toContain('example.com/oauth2/authorize');
    });

    it('should add SAML provider dynamically', () => {
      const newProviderConfig = {
        provider: 'generic',
        entryPoint: 'https://example.com/sso/saml',
        issuer: 'https://webqx.health',
        cert: '-----BEGIN CERTIFICATE-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA\n-----END CERTIFICATE-----'
      };

      ssoManager.addSAMLProvider('generic', newProviderConfig);
      
      const supportedProviders = ssoManager.getSupportedProviders();
      expect(supportedProviders.saml).toContain('generic');
      
      const authUrl = ssoManager.getSAMLAuthUrl('generic');
      expect(authUrl).toContain('example.com/sso/saml');
    });

    it('should remove OAuth2 provider dynamically', () => {
      ssoManager.removeProvider('oauth2', 'google');
      
      const supportedProviders = ssoManager.getSupportedProviders();
      expect(supportedProviders.oauth2).not.toContain('google');
      
      expect(() => {
        ssoManager.getOAuth2AuthUrl('google');
      }).toThrow();
    });

    it('should remove SAML provider dynamically', () => {
      ssoManager.removeProvider('saml', 'okta');
      
      const supportedProviders = ssoManager.getSupportedProviders();
      expect(supportedProviders.saml).not.toContain('okta');
      
      expect(() => {
        ssoManager.getSAMLAuthUrl('okta');
      }).toThrow();
    });
  });

  describe('Token Management', () => {
    const mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      roles: ['user'],
      groups: ['staff'],
      metadata: {}
    };

    const mockSession = {
      sessionId: 'test-session-id',
      userId: 'test-user-id',
      provider: 'azure',
      protocol: 'oauth2' as const,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
      lastActivity: new Date()
    };

    // Note: In a real test environment, you would mock the authentication methods
    // For now, we'll test the token refresh functionality
    it('should handle token refresh errors gracefully', async () => {
      const invalidToken = 'invalid.token.here';
      
      await expect(ssoManager.refreshToken(invalidToken)).rejects.toThrow();
    });

    it('should handle logout gracefully with invalid token', async () => {
      const invalidToken = 'invalid.token.here';
      
      // Should not throw error even with invalid token
      await expect(ssoManager.handleLogout(invalidToken)).resolves.not.toThrow();
    });
  });

  describe('Provider Health Check', () => {
    it('should check provider health status', async () => {
      const health = await ssoManager.getProviderHealth();
      
      console.log('Health check result:', health);
      expect(health).toBeDefined();
      expect(health['oauth2_azure']).toBeDefined();
      expect(health['oauth2_generic']).toBeDefined(); // Google may be fallback to generic
      expect(health['saml_azure']).toBeDefined();
      expect(health['saml_generic']).toBeDefined(); // Okta may be fallback to generic
      
      // All providers should be healthy since they can generate auth URLs
      Object.values(health).forEach(status => {
        expect(status.status).toBe('healthy');
        expect(status.lastCheck).toBeInstanceOf(Date);
      });
    });
  });

  describe('Session Management', () => {
    it('should cleanup expired sessions', () => {
      // This is mainly a smoke test since we can't easily test the internal session store
      expect(() => {
        ssoManager.cleanupExpiredSessions();
      }).not.toThrow();
    });
  });

  describe('Middleware Access', () => {
    it('should provide role-based middleware', () => {
      const roleMiddleware = ssoManager.requireRoles(['admin', 'user']);
      expect(typeof roleMiddleware).toBe('function');
    });

    it('should provide group-based middleware', () => {
      const groupMiddleware = ssoManager.requireGroups(['staff', 'management']);
      expect(typeof groupMiddleware).toBe('function');
    });
  });
});