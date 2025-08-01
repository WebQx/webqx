/**
 * @fileoverview Integration Tests for Keycloak-Ottehr SSO
 * 
 * These tests validate the complete integration flow between Keycloak and Ottehr
 * including authentication, token management, and role-based access control.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { createOttehrAuthManager, type OttehrAuthConfig, type KeycloakConfig } from '../authManager';

// Mock fetch for testing
global.fetch = jest.fn();

describe('Keycloak-Ottehr Integration Tests', () => {
  let mockFetch: jest.MockedFunction<typeof fetch>;
  
  beforeEach(() => {
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockClear();
  });

  describe('Complete Authentication Flow', () => {
    it('should complete full Keycloak SSO flow', async () => {
      const keycloakConfig: KeycloakConfig = {
        enabled: true,
        baseUrl: 'https://keycloak.test.com',
        realm: 'webqx-healthcare',
        clientId: 'ottehr-integration',
        clientSecret: 'test-secret',
        redirectUri: 'https://app.test.com/callback',
        scope: 'openid profile email ottehr:access',
        issuer: 'https://keycloak.test.com/realms/webqx-healthcare',
        jwksUri: 'https://keycloak.test.com/realms/webqx-healthcare/protocol/openid_connect/certs',
        tokenEndpoint: 'https://keycloak.test.com/realms/webqx-healthcare/protocol/openid_connect/token',
        authorizationEndpoint: 'https://keycloak.test.com/realms/webqx-healthcare/protocol/openid_connect/auth',
        userinfoEndpoint: 'https://keycloak.test.com/realms/webqx-healthcare/protocol/openid_connect/userinfo',
        logoutEndpoint: 'https://keycloak.test.com/realms/webqx-healthcare/protocol/openid_connect/logout',
        enableRoleMapping: true,
        roleMappingClaim: 'realm_access.roles',
        defaultRole: 'ottehr-user'
      };

      const authManager = createOttehrAuthManager({
        clientId: 'test-client',
        clientSecret: 'test-secret',
        keycloak: keycloakConfig
      });

      // Step 1: Generate authorization URL
      const { url, codeVerifier, state, nonce } = authManager.generateKeycloakAuthUrl();
      
      expect(url).toContain('response_type=code');
      expect(url).toContain('code_challenge_method=S256');
      expect(codeVerifier).toBeTruthy();
      expect(state).toBeTruthy();
      expect(nonce).toBeTruthy();

      // Step 2: Mock successful token exchange
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'test-refresh-token',
        id_token: 'test.id.token',
        scope: 'openid profile email ottehr:access'
      };

      // Mock ID token validation
      jest.spyOn(authManager as any, 'validateKeycloakIdToken').mockResolvedValue({
        valid: true,
        payload: {
          iss: keycloakConfig.issuer,
          sub: 'user-123',
          aud: keycloakConfig.clientId,
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
          nonce,
          email: 'test@webqx.health',
          preferred_username: 'testuser',
          realm_access: {
            roles: ['ottehr-admin', 'ottehr-user']
          }
        }
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse
      } as Response);

      // Step 3: Exchange authorization code
      const authResult = await authManager.exchangeKeycloakCode(
        'test-auth-code',
        codeVerifier,
        state,
        nonce
      );

      expect(authResult.success).toBe(true);
      expect(authResult.tokenInfo?.accessToken).toBe('test-access-token');
      expect(authResult.tokenInfo?.roles).toEqual(['ottehr-admin', 'ottehr-user']);
      expect(authResult.tokenInfo?.metadata?.provider).toBe('keycloak');

      // Step 4: Verify authentication state
      expect(authManager.isAuthenticated()).toBe(true);

      // Step 5: Test token refresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'new-refresh-token'
        })
      } as Response);

      const refreshResult = await authManager.refreshKeycloakToken();
      expect(refreshResult.success).toBe(true);
      expect(refreshResult.tokenInfo?.accessToken).toBe('new-access-token');

      // Step 6: Test user info retrieval
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: 'user-123',
          email: 'test@webqx.health',
          preferred_username: 'testuser',
          name: 'Test User'
        })
      } as Response);

      const userInfoResult = await authManager.getKeycloakUserInfo();
      expect(userInfoResult.success).toBe(true);
      expect(userInfoResult.userInfo?.email).toBe('test@webqx.health');

      // Step 7: Test logout
      const logoutResult = await authManager.logoutFromKeycloak('https://app.test.com/');
      expect(logoutResult.success).toBe(true);
      expect(logoutResult.logoutUrl).toContain(keycloakConfig.logoutEndpoint);
      expect(authManager.isAuthenticated()).toBe(false);

      authManager.destroy();
    });

    it('should handle authentication errors gracefully', async () => {
      const authManager = createOttehrAuthManager({
        clientId: 'test-client',
        clientSecret: 'test-secret',
        keycloak: {
          enabled: true,
          baseUrl: 'https://keycloak.test.com',
          realm: 'test-realm',
          clientId: 'test-client',
          clientSecret: 'test-secret',
          redirectUri: 'https://app.test.com/callback',
          scope: 'openid',
          issuer: 'https://keycloak.test.com/realms/test-realm',
          jwksUri: 'https://keycloak.test.com/realms/test-realm/certs',
          tokenEndpoint: 'https://keycloak.test.com/realms/test-realm/token',
          authorizationEndpoint: 'https://keycloak.test.com/realms/test-realm/auth',
          userinfoEndpoint: 'https://keycloak.test.com/realms/test-realm/userinfo',
          logoutEndpoint: 'https://keycloak.test.com/realms/test-realm/logout',
          enableRoleMapping: false,
          roleMappingClaim: '',
          defaultRole: ''
        }
      });

      // Test invalid authorization code
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Invalid authorization code'
        })
      } as Response);

      const result = await authManager.exchangeKeycloakCode('invalid-code', 'verifier');
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('KEYCLOAK_TOKEN_EXCHANGE_FAILED');

      authManager.destroy();
    });
  });

  describe('Role-Based Access Control', () => {
    it('should correctly map and validate user roles', async () => {
      const authManager = createOttehrAuthManager({
        clientId: 'test-client',
        clientSecret: 'test-secret',
        keycloak: {
          enabled: true,
          baseUrl: 'https://keycloak.test.com',
          realm: 'test-realm',
          clientId: 'test-client',
          clientSecret: 'test-secret',
          redirectUri: 'https://app.test.com/callback',
          scope: 'openid',
          issuer: 'https://keycloak.test.com/realms/test-realm',
          jwksUri: 'https://keycloak.test.com/realms/test-realm/certs',
          tokenEndpoint: 'https://keycloak.test.com/realms/test-realm/token',
          authorizationEndpoint: 'https://keycloak.test.com/realms/test-realm/auth',
          userinfoEndpoint: 'https://keycloak.test.com/realms/test-realm/userinfo',
          logoutEndpoint: 'https://keycloak.test.com/realms/test-realm/logout',
          enableRoleMapping: true,
          roleMappingClaim: 'realm_access.roles',
          defaultRole: 'ottehr-user'
        }
      });

      // Mock token with roles
      const mockTokenResponse = {
        access_token: 'test-token',
        token_type: 'Bearer',
        expires_in: 3600,
        id_token: 'test.id.token'
      };

      jest.spyOn(authManager as any, 'validateKeycloakIdToken').mockResolvedValue({
        valid: true,
        payload: {
          iss: 'https://keycloak.test.com/realms/test-realm',
          sub: 'user-123',
          aud: 'test-client',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
          realm_access: {
            roles: ['ottehr-admin', 'ottehr-pharmacy', 'ottehr-user']
          }
        }
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse
      } as Response);

      const result = await authManager.exchangeKeycloakCode('code', 'verifier');
      expect(result.success).toBe(true);

      const tokenInfo = authManager.getTokenInfo();
      expect(tokenInfo?.roles).toContain('ottehr-admin');
      expect(tokenInfo?.roles).toContain('ottehr-pharmacy');
      expect(tokenInfo?.roles).toContain('ottehr-user');

      authManager.destroy();
    });
  });

  describe('Configuration Validation', () => {
    it('should validate Keycloak configuration', () => {
      expect(() => {
        const authManager = createOttehrAuthManager({
          clientId: 'test-client',
          clientSecret: 'test-secret'
          // No Keycloak config
        });
        authManager.generateKeycloakAuthUrl();
      }).toThrow('Keycloak integration is not enabled or configured');
    });

    it('should load configuration from environment variables', () => {
      const originalEnv = process.env;
      
      process.env = {
        ...originalEnv,
        KEYCLOAK_ENABLED: 'true',
        KEYCLOAK_BASE_URL: 'https://test-keycloak.com',
        KEYCLOAK_REALM: 'test-realm',
        KEYCLOAK_CLIENT_ID: 'test-client',
        KEYCLOAK_CLIENT_SECRET: 'test-secret',
        KEYCLOAK_REDIRECT_URI: 'https://app.test.com/callback'
      };

      const authManager = createOttehrAuthManager();
      expect(() => authManager.generateKeycloakAuthUrl()).not.toThrow();

      process.env = originalEnv;
      authManager.destroy();
    });
  });

  describe('Security Features', () => {
    it('should generate secure PKCE parameters', () => {
      const authManager = createOttehrAuthManager({
        clientId: 'test-client',
        clientSecret: 'test-secret',
        keycloak: {
          enabled: true,
          baseUrl: 'https://keycloak.test.com',
          realm: 'test-realm',
          clientId: 'test-client',
          clientSecret: 'test-secret',
          redirectUri: 'https://app.test.com/callback',
          scope: 'openid',
          issuer: 'https://keycloak.test.com/realms/test-realm',
          jwksUri: 'https://keycloak.test.com/realms/test-realm/certs',
          tokenEndpoint: 'https://keycloak.test.com/realms/test-realm/token',
          authorizationEndpoint: 'https://keycloak.test.com/realms/test-realm/auth',
          userinfoEndpoint: 'https://keycloak.test.com/realms/test-realm/userinfo',
          logoutEndpoint: 'https://keycloak.test.com/realms/test-realm/logout',
          enableRoleMapping: false,
          roleMappingClaim: '',
          defaultRole: ''
        }
      });

      const result1 = authManager.generateKeycloakAuthUrl();
      const result2 = authManager.generateKeycloakAuthUrl();

      // Should generate different values each time
      expect(result1.codeVerifier).not.toBe(result2.codeVerifier);
      expect(result1.state).not.toBe(result2.state);
      expect(result1.nonce).not.toBe(result2.nonce);

      // Should meet minimum security requirements
      expect(result1.codeVerifier.length).toBeGreaterThanOrEqual(43);
      expect(result1.state.length).toBeGreaterThanOrEqual(16);
      expect(result1.nonce.length).toBeGreaterThanOrEqual(16);

      authManager.destroy();
    });

    it('should validate state parameter on callback', async () => {
      const authManager = createOttehrAuthManager({
        clientId: 'test-client',
        clientSecret: 'test-secret',
        keycloak: {
          enabled: true,
          baseUrl: 'https://keycloak.test.com',
          realm: 'test-realm',
          clientId: 'test-client',
          clientSecret: 'test-secret',
          redirectUri: 'https://app.test.com/callback',
          scope: 'openid',
          issuer: 'https://keycloak.test.com/realms/test-realm',
          jwksUri: 'https://keycloak.test.com/realms/test-realm/certs',
          tokenEndpoint: 'https://keycloak.test.com/realms/test-realm/token',
          authorizationEndpoint: 'https://keycloak.test.com/realms/test-realm/auth',
          userinfoEndpoint: 'https://keycloak.test.com/realms/test-realm/userinfo',
          logoutEndpoint: 'https://keycloak.test.com/realms/test-realm/logout',
          enableRoleMapping: false,
          roleMappingClaim: '',
          defaultRole: ''
        }
      });

      const { codeVerifier, state } = authManager.generateKeycloakAuthUrl();
      
      // Mock successful token response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          token_type: 'Bearer',
          expires_in: 3600
        })
      } as Response);

      jest.spyOn(authManager as any, 'validateKeycloakIdToken').mockResolvedValue({
        valid: true,
        payload: {
          iss: 'https://keycloak.test.com/realms/test-realm',
          sub: 'user-123',
          aud: 'test-client',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000)
        }
      });

      // Test with correct state
      const validResult = await authManager.exchangeKeycloakCode('code', codeVerifier, state);
      expect(validResult.success).toBe(true);

      authManager.destroy();
    });
  });
});