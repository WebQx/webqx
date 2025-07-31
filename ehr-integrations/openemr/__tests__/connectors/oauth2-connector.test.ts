/**
 * Unit Tests for OAuth2 Connector
 */

import { OAuth2Connector, OAuth2ConnectorConfig } from '../../connectors/oauth2-connector';

// Mock fetch globally
global.fetch = jest.fn();

describe('OAuth2Connector', () => {
  let oauth2Connector: OAuth2Connector;
  let mockConfig: OAuth2ConnectorConfig;

  beforeEach(() => {
    mockConfig = {
      centralIdp: {
        issuer: 'https://test-idp.webqx.health',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'https://test.webqx.health/callback',
        scopes: ['openid', 'profile', 'healthcare:read'],
        discoveryUrl: 'https://test-idp.webqx.health/.well-known/openid_configuration'
      },
      openemr: {
        baseUrl: 'https://test-openemr.example.com',
        clientId: 'openemr-client-id',
        clientSecret: 'openemr-client-secret',
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
        clockSkewTolerance: 300,
        enablePKCE: true
      },
      audit: {
        enabled: true,
        logTokenExchange: true,
        logUserMapping: true
      }
    };

    oauth2Connector = new OAuth2Connector(mockConfig);
    
    // Reset fetch mock
    (fetch as jest.MockedFunction<typeof fetch>).mockReset();
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid config', async () => {
      // Mock OIDC discovery
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          authorization_endpoint: 'https://test-idp.webqx.health/oauth2/authorize',
          token_endpoint: 'https://test-idp.webqx.health/oauth2/token',
          userinfo_endpoint: 'https://test-idp.webqx.health/oauth2/userinfo'
        })
      } as Response);

      await expect(oauth2Connector.initialize()).resolves.not.toThrow();
    });

    it('should fail initialization with invalid discovery URL', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(new Error('Network error'));

      await expect(oauth2Connector.initialize()).rejects.toThrow();
    });

    it('should fail initialization with missing required config', () => {
      const invalidConfig = JSON.parse(JSON.stringify(mockConfig));
      invalidConfig.centralIdp.clientId = '';

      expect(() => new OAuth2Connector(invalidConfig)).toThrow('Missing required configuration');
    });
  });

  describe('PKCE Generation', () => {
    it('should generate valid PKCE parameters', () => {
      const pkce = oauth2Connector.generatePKCE();

      expect(pkce).toHaveProperty('codeVerifier');
      expect(pkce).toHaveProperty('codeChallenge');
      expect(pkce).toHaveProperty('codeChallengeMethod');
      expect(pkce.codeChallengeMethod).toBe('S256');
      expect(pkce.codeVerifier).toHaveLength(128);
      expect(pkce.codeChallenge).toBeTruthy();
    });
  });

  describe('Authorization URL Generation', () => {
    it('should generate correct authorization URL', () => {
      const state = 'test-state';
      const pkce = oauth2Connector.generatePKCE();
      
      const authUrl = oauth2Connector.getAuthorizationUrl(state, pkce);
      
      expect(authUrl).toContain('response_type=code');
      expect(authUrl).toContain(`client_id=${mockConfig.centralIdp.clientId}`);
      expect(authUrl).toContain(`state=${state}`);
      expect(authUrl).toContain('code_challenge=');
      expect(authUrl).toContain('code_challenge_method=S256');
    });

    it('should generate authorization URL without PKCE when disabled', () => {
      mockConfig.security.enablePKCE = false;
      oauth2Connector = new OAuth2Connector(mockConfig);
      
      const authUrl = oauth2Connector.getAuthorizationUrl('test-state');
      
      expect(authUrl).not.toContain('code_challenge');
      expect(authUrl).not.toContain('code_challenge_method');
    });
  });

  describe('Token Exchange', () => {
    beforeEach(async () => {
      // Mock OIDC discovery
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          authorization_endpoint: 'https://test-idp.webqx.health/oauth2/authorize',
          token_endpoint: 'https://test-idp.webqx.health/oauth2/token',
          userinfo_endpoint: 'https://test-idp.webqx.health/oauth2/userinfo'
        })
      } as Response);

      await oauth2Connector.initialize();
    });

    it('should exchange authorization code for tokens successfully', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'openid profile',
        id_token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0LXVzZXIiLCJlbWFpbCI6InRlc3RAdGVzdC5jb20iLCJnaXZlbl9uYW1lIjoiVGVzdCIsImZhbWlseV9uYW1lIjoiVXNlciIsInJvbGUiOiJwcm92aWRlciJ9.test'
      };

      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse
      } as Response);

      const result = await oauth2Connector.exchangeCodeForCentralTokens('test-code', 'test-state');

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.session).toBeDefined();
      expect(result.user?.id).toBe('test-user');
      expect(result.user?.email).toBe('test@test.com');
    });

    it('should handle token exchange failure', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        text: async () => 'Invalid authorization code'
      } as Response);

      const result = await oauth2Connector.exchangeCodeForCentralTokens('invalid-code', 'test-state');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('CENTRAL_IDP_TOKEN_EXCHANGE_FAILED');
    });
  });

  describe('Token Validation', () => {
    beforeEach(async () => {
      // Mock OIDC discovery
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          userinfo_endpoint: 'https://test-idp.webqx.health/oauth2/userinfo'
        })
      } as Response);

      await oauth2Connector.initialize();
    });

    it('should validate token successfully', async () => {
      const mockUserInfo = {
        sub: 'test-user',
        email: 'test@test.com',
        iss: mockConfig.centralIdp.issuer,
        aud: [mockConfig.centralIdp.clientId]
      };

      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserInfo
      } as Response);

      const result = await oauth2Connector.validateCentralToken('valid-token');

      expect(result.valid).toBe(true);
      expect(result.claims).toEqual(mockUserInfo);
    });

    it('should reject invalid token', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized'
      } as Response);

      const result = await oauth2Connector.validateCentralToken('invalid-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should validate issuer when enabled', async () => {
      const mockUserInfo = {
        sub: 'test-user',
        email: 'test@test.com',
        iss: 'https://malicious.com', // Wrong issuer
        aud: [mockConfig.centralIdp.clientId]
      };

      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserInfo
      } as Response);

      const result = await oauth2Connector.validateCentralToken('token-with-wrong-issuer');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid token issuer');
    });
  });

  describe('OpenEMR Token Exchange', () => {
    it('should exchange central token for OpenEMR tokens', async () => {
      // Create a fresh connector instance without discovery URL to avoid initialization issues
      const testConfig = { ...mockConfig };
      delete testConfig.centralIdp.discoveryUrl;
      const testConnector = new OAuth2Connector(testConfig);
      
      const mockUser = {
        id: 'test-user',
        email: 'test@test.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'PROVIDER' as const,
        isVerified: true,
        mfaEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock token validation
      (fetch as jest.MockedFunction<typeof fetch>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sub: 'test-user', email: 'test@test.com' })
        } as Response)
        // Mock OpenEMR token request
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'openemr-access-token',
            token_type: 'Bearer',
            expires_in: 3600,
            scope: 'openid fhirUser'
          })
        } as Response);

      const result = await testConnector.exchangeForOpenEMRTokens({
        centralIdpToken: 'central-token',
        userContext: mockUser,
        requestedScopes: ['openid', 'fhirUser']
      });

      expect(result.success).toBe(true);
      expect(result.openemrTokens).toBeDefined();
      expect(result.openemrTokens?.accessToken).toBe('openemr-access-token');
      expect(result.userMapping).toBeDefined();
      expect(result.userMapping?.webqxUserId).toBe('test-user');
    });

    it('should handle OpenEMR token exchange failure', async () => {
      // Create a fresh connector instance without discovery URL
      const testConfig = { ...mockConfig };
      delete testConfig.centralIdp.discoveryUrl;
      const testConnector = new OAuth2Connector(testConfig);
      
      const mockUser = {
        id: 'test-user',
        email: 'test@test.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'PROVIDER' as const,
        isVerified: true,
        mfaEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock token validation success but OpenEMR failure
      (fetch as jest.MockedFunction<typeof fetch>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sub: 'test-user', email: 'test@test.com' })
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          statusText: 'Unauthorized'
        } as Response);

      const result = await testConnector.exchangeForOpenEMRTokens({
        centralIdpToken: 'central-token',
        userContext: mockUser
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('OPENEMR_TOKEN_EXCHANGE_FAILED');
    });
  });

  describe('Token Refresh', () => {
    it('should refresh OpenEMR tokens successfully', async () => {
      const mockRefreshResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600
      };

      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRefreshResponse
      } as Response);

      const result = await oauth2Connector.refreshOpenEMRTokens('refresh-token');

      expect(result.success).toBe(true);
      expect(result.data?.accessToken).toBe('new-access-token');
      expect(result.data?.refreshToken).toBe('new-refresh-token');
    });

    it('should handle token refresh failure', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request'
      } as Response);

      const result = await oauth2Connector.refreshOpenEMRTokens('invalid-refresh-token');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TOKEN_REFRESH_FAILED');
    });
  });

  describe('Token Revocation', () => {
    beforeEach(async () => {
      // Mock OIDC discovery
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          revocation_endpoint: 'https://test-idp.webqx.health/oauth2/revoke'
        })
      } as Response);

      await oauth2Connector.initialize();
    });

    it('should revoke tokens successfully', async () => {
      // Mock successful revocation calls
      (fetch as jest.MockedFunction<typeof fetch>)
        .mockResolvedValueOnce({ ok: true } as Response)
        .mockResolvedValueOnce({ ok: true } as Response);

      const result = await oauth2Connector.revokeTokens('access-token', 'refresh-token');

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    it('should handle token revocation failure gracefully', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(new Error('Network error'));

      const result = await oauth2Connector.revokeTokens('access-token');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TOKEN_REVOCATION_FAILED');
    });
  });
});