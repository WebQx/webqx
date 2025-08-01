/**
 * @fileoverview Ottehr Authentication Manager Tests
 * 
 * Unit tests for the Ottehr authentication manager covering OAuth2 flows,
 * API key authentication, token refresh, and storage mechanisms.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import {
  OttehrAuthManager,
  createOttehrAuthManager,
  MemoryTokenStorage,
  LocalStorageTokenStorage,
  type OttehrAuthConfig,
  type KeycloakConfig,
  type TokenInfo,
  type OIDCTokenPayload
} from '../authManager';

// Mock fetch globally
global.fetch = jest.fn();

describe('OttehrAuthManager', () => {
  let authManager: OttehrAuthManager;
  let mockFetch: jest.MockedFunction<typeof fetch>;
  let tokenStorage: MemoryTokenStorage;

  beforeEach(() => {
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockClear();
    
    tokenStorage = new MemoryTokenStorage();
    const config: OttehrAuthConfig = {
      clientId: 'test_client_id',
      clientSecret: 'test_client_secret',
      apiKey: 'test_api_key',
      tokenStorage,
      autoRefresh: false
    };
    
    authManager = new OttehrAuthManager(config);
  });

  afterEach(() => {
    authManager.destroy();
  });

  describe('Token Storage', () => {
    describe('MemoryTokenStorage', () => {
      it('should store and retrieve tokens', async () => {
        const storage = new MemoryTokenStorage();
        const testData = { token: 'test_token', expiresAt: Date.now() };
        
        await storage.store('test_key', testData);
        const retrieved = await storage.retrieve('test_key');
        
        expect(retrieved).toEqual(testData);
      });

      it('should remove tokens', async () => {
        const storage = new MemoryTokenStorage();
        await storage.store('test_key', { token: 'test' });
        await storage.remove('test_key');
        
        const retrieved = await storage.retrieve('test_key');
        expect(retrieved).toBeUndefined();
      });
    });

    describe('LocalStorageTokenStorage', () => {
      let mockLocalStorage: { [key: string]: string };

      beforeEach(() => {
        mockLocalStorage = {};
        
        Object.defineProperty(window, 'localStorage', {
          value: {
            getItem: jest.fn((key: string) => mockLocalStorage[key] || null),
            setItem: jest.fn((key: string, value: string) => {
              mockLocalStorage[key] = value;
            }),
            removeItem: jest.fn((key: string) => {
              delete mockLocalStorage[key];
            })
          },
          writable: true
        });
      });

      it('should store and retrieve tokens from localStorage', async () => {
        const storage = new LocalStorageTokenStorage();
        const testData = { token: 'test_token' };
        
        await storage.store('test_key', testData);
        const retrieved = await storage.retrieve('test_key');
        
        expect(retrieved).toEqual(testData);
        expect(localStorage.setItem).toHaveBeenCalledWith(
          'ottehr_test_key',
          JSON.stringify(testData)
        );
      });

      it('should handle localStorage not being available', async () => {
        Object.defineProperty(window, 'localStorage', {
          value: undefined,
          writable: true
        });

        const storage = new LocalStorageTokenStorage();
        await storage.store('test_key', { token: 'test' });
        const retrieved = await storage.retrieve('test_key');
        
        expect(retrieved).toBeNull();
      });
    });
  });

  describe('OAuth2 Authentication', () => {
    it('should authenticate with client credentials flow', async () => {
      const mockResponse = {
        access_token: 'oauth_access_token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'refresh_token_123',
        scope: 'ordering notifications'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await authManager.authenticateWithClientCredentials(['ordering', 'notifications']);
      
      expect(result.success).toBe(true);
      expect(result.tokenInfo?.accessToken).toBe('oauth_access_token');
      expect(result.tokenInfo?.tokenType).toBe('Bearer');
      expect(result.tokenInfo?.refreshToken).toBe('refresh_token_123');
      expect(result.tokenInfo?.scopes).toEqual(['ordering', 'notifications']);
    });

    it('should handle OAuth2 authentication errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: 'invalid_client',
          error_description: 'Invalid client credentials'
        })
      } as Response);

      const result = await authManager.authenticateWithClientCredentials();
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AUTH_FAILED');
      expect(result.error?.message).toContain('Invalid client credentials');
    });

    it('should handle network errors during OAuth2 auth', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await authManager.authenticateWithClientCredentials();
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NETWORK_ERROR');
    });
  });

  describe('API Key Authentication', () => {
    it('should authenticate with API key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: true })
      } as Response);

      const result = await authManager.authenticateWithApiKey();
      
      expect(result.success).toBe(true);
      expect(result.tokenInfo?.accessToken).toBe('test_api_key');
      expect(result.tokenInfo?.tokenType).toBe('ApiKey');
      expect(result.tokenInfo?.expiresAt).toBe(0); // API keys don't expire
    });

    it('should handle invalid API key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      } as Response);

      const result = await authManager.authenticateWithApiKey();
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_API_KEY');
    });

    it('should return error if no API key is configured', async () => {
      const manager = new OttehrAuthManager({
        clientId: 'test_client',
        clientSecret: 'test_secret'
        // No API key
      });

      const result = await manager.authenticateWithApiKey();
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NO_API_KEY');
      
      manager.destroy();
    });
  });

  describe('Token Refresh', () => {
    it('should refresh token successfully', async () => {
      // First, set up a token that can be refreshed
      const initialToken: TokenInfo = {
        accessToken: 'old_token',
        tokenType: 'Bearer',
        expiresAt: Date.now() + 1000,
        refreshToken: 'refresh_token_123',
        scopes: ['ordering']
      };

      await tokenStorage.store('current_token', initialToken);
      authManager = new OttehrAuthManager({
        clientId: 'test_client',
        clientSecret: 'test_secret',
        tokenStorage,
        autoRefresh: false
      });

      const mockRefreshResponse = {
        access_token: 'new_access_token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'new_refresh_token'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRefreshResponse
      } as Response);

      const result = await authManager.refreshToken();
      
      expect(result.success).toBe(true);
      expect(result.tokenInfo?.accessToken).toBe('new_access_token');
      expect(result.tokenInfo?.refreshToken).toBe('new_refresh_token');
    });

    it('should handle refresh token errors', async () => {
      const initialToken: TokenInfo = {
        accessToken: 'old_token',
        tokenType: 'Bearer',
        expiresAt: Date.now() + 1000,
        refreshToken: 'invalid_refresh_token'
      };

      await tokenStorage.store('current_token', initialToken);
      authManager = new OttehrAuthManager({
        clientId: 'test_client',
        clientSecret: 'test_secret',
        tokenStorage,
        autoRefresh: false
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Refresh token has expired'
        })
      } as Response);

      const result = await authManager.refreshToken();
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('REFRESH_FAILED');
    });

    it('should return error if no refresh token available', async () => {
      const result = await authManager.refreshToken();
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NO_REFRESH_TOKEN');
    });
  });

  describe('Token Management', () => {
    it('should check if token is expired', async () => {
      const expiredToken: TokenInfo = {
        accessToken: 'expired_token',
        tokenType: 'Bearer',
        expiresAt: Date.now() - 1000 // Expired 1 second ago
      };

      await tokenStorage.store('current_token', expiredToken);
      authManager = new OttehrAuthManager({
        clientId: 'test_client',
        clientSecret: 'test_secret',
        tokenStorage,
        refreshBufferSeconds: 0 // No buffer for testing
      });

      expect(authManager.isTokenExpired()).toBe(true);
    });

    it('should consider API keys as never expired', async () => {
      const apiKeyToken: TokenInfo = {
        accessToken: 'api_key_token',
        tokenType: 'ApiKey',
        expiresAt: 0 // API keys don't expire
      };

      await tokenStorage.store('current_token', apiKeyToken);
      authManager = new OttehrAuthManager({
        clientId: 'test_client',
        clientSecret: 'test_secret',
        tokenStorage
      });

      expect(authManager.isTokenExpired()).toBe(false);
    });

    it('should get valid token and auto-authenticate if needed', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: true })
      } as Response);

      const token = await authManager.getValidToken();
      
      expect(token).toBe('test_api_key');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/validate'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'ApiKey test_api_key'
          })
        })
      );
    });

    it('should get authorization header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: true })
      } as Response);

      const header = await authManager.getAuthorizationHeader();
      
      expect(header).toBe('ApiKey test_api_key');
    });

    it('should check authentication status', () => {
      expect(authManager.isAuthenticated()).toBe(false);
    });

    it('should get token info without sensitive data', async () => {
      const tokenInfo: TokenInfo = {
        accessToken: 'secret_token',
        tokenType: 'Bearer',
        expiresAt: Date.now() + 3600000,
        refreshToken: 'secret_refresh',
        scopes: ['ordering'],
        metadata: { test: 'data' }
      };

      await tokenStorage.store('current_token', tokenInfo);
      authManager = new OttehrAuthManager({
        clientId: 'test_client',
        clientSecret: 'test_secret',
        tokenStorage
      });

      const safeTokenInfo = authManager.getTokenInfo();
      
      expect(safeTokenInfo).not.toHaveProperty('accessToken');
      expect(safeTokenInfo).not.toHaveProperty('refreshToken');
      expect(safeTokenInfo?.tokenType).toBe('Bearer');
      expect(safeTokenInfo?.scopes).toEqual(['ordering']);
    });
  });

  describe('Logout', () => {
    it('should clear tokens on logout', async () => {
      const tokenInfo: TokenInfo = {
        accessToken: 'test_token',
        tokenType: 'Bearer',
        expiresAt: Date.now() + 3600000
      };

      await tokenStorage.store('current_token', tokenInfo);
      authManager = new OttehrAuthManager({
        clientId: 'test_client',
        clientSecret: 'test_secret',
        tokenStorage
      });

      await authManager.logout();
      
      expect(authManager.isAuthenticated()).toBe(false);
      expect(authManager.getTokenInfo()).toBeNull();
      
      const storedToken = await tokenStorage.retrieve('current_token');
      expect(storedToken).toBeUndefined();
    });
  });

  describe('Auto Refresh', () => {
    it('should schedule token refresh when auto-refresh is enabled', async () => {
      jest.useFakeTimers();
      
      const manager = new OttehrAuthManager({
        clientId: 'test_client',
        clientSecret: 'test_secret',
        tokenStorage,
        autoRefresh: true,
        refreshBufferSeconds: 1 // 1 second buffer
      });

      const tokenInfo: TokenInfo = {
        accessToken: 'test_token',
        tokenType: 'Bearer',
        expiresAt: Date.now() + 5000, // Expires in 5 seconds
        refreshToken: 'refresh_token'
      };

      // Mock the refresh call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'refreshed_token',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'new_refresh_token'
        })
      } as Response);

      await tokenStorage.store('current_token', tokenInfo);
      
      // Fast-forward time to trigger refresh
      jest.advanceTimersByTime(4100); // 4.1 seconds (should trigger refresh)
      
      // Wait for async operations
      await new Promise(resolve => setImmediate(resolve));
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/oauth/token'),
        expect.objectContaining({
          method: 'POST'
        })
      );

      jest.useRealTimers();
      manager.destroy();
    });
  });

  describe('Event Emission', () => {
    it('should emit authentication events', async () => {
      const authSpy = jest.fn();
      authManager.on('authenticated', authSpy);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: true })
      } as Response);

      await authManager.authenticateWithApiKey();
      
      expect(authSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: 'test_api_key',
          tokenType: 'ApiKey'
        })
      );
    });

    it('should emit token refresh events', async () => {
      const refreshSpy = jest.fn();
      authManager.on('tokenRefreshed', refreshSpy);

      const initialToken: TokenInfo = {
        accessToken: 'old_token',
        tokenType: 'Bearer',
        expiresAt: Date.now() + 1000,
        refreshToken: 'refresh_token'
      };

      await tokenStorage.store('current_token', initialToken);
      authManager = new OttehrAuthManager({
        clientId: 'test_client',
        clientSecret: 'test_secret',
        tokenStorage,
        autoRefresh: false
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new_token',
          token_type: 'Bearer',
          expires_in: 3600
        })
      } as Response);

      await authManager.refreshToken();
      
      expect(refreshSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: 'new_token',
          tokenType: 'Bearer'
        })
      );
    });

    it('should emit logout events', async () => {
      const logoutSpy = jest.fn();
      authManager.on('logout', logoutSpy);

      await authManager.logout();
      
      expect(logoutSpy).toHaveBeenCalled();
    });
  });

  describe('Factory Function', () => {
    it('should create auth manager with default config', () => {
      const manager = createOttehrAuthManager();
      
      expect(manager).toBeInstanceOf(OttehrAuthManager);
      expect(manager.getTokenInfo()).toBeNull();
      
      manager.destroy();
    });

    it('should create auth manager with custom config', () => {
      const manager = createOttehrAuthManager({
        clientId: 'custom_client',
        autoRefresh: false
      });
      
      expect(manager).toBeInstanceOf(OttehrAuthManager);
      
      manager.destroy();
    });

    it('should create auth manager with Keycloak config from environment', () => {
      // Mock environment variables
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        KEYCLOAK_ENABLED: 'true',
        KEYCLOAK_BASE_URL: 'https://keycloak.test.com',
        KEYCLOAK_REALM: 'test-realm',
        KEYCLOAK_CLIENT_ID: 'test-keycloak-client',
        KEYCLOAK_CLIENT_SECRET: 'test-keycloak-secret',
        KEYCLOAK_REDIRECT_URI: 'https://app.test.com/callback'
      };

      const manager = createOttehrAuthManager();
      expect(manager).toBeInstanceOf(OttehrAuthManager);
      
      // Clean up
      process.env = originalEnv;
      manager.destroy();
    });
  });

  describe('Keycloak Integration', () => {
    let keycloakAuthManager: OttehrAuthManager;
    let keycloakConfig: KeycloakConfig;

    beforeEach(() => {
      keycloakConfig = {
        enabled: true,
        baseUrl: 'https://keycloak.test.com',
        realm: 'test-realm',
        clientId: 'test-keycloak-client',
        clientSecret: 'test-keycloak-secret',
        redirectUri: 'https://app.test.com/callback',
        scope: 'openid profile email',
        issuer: 'https://keycloak.test.com/realms/test-realm',
        jwksUri: 'https://keycloak.test.com/realms/test-realm/protocol/openid_connect/certs',
        tokenEndpoint: 'https://keycloak.test.com/realms/test-realm/protocol/openid_connect/token',
        authorizationEndpoint: 'https://keycloak.test.com/realms/test-realm/protocol/openid_connect/auth',
        userinfoEndpoint: 'https://keycloak.test.com/realms/test-realm/protocol/openid_connect/userinfo',
        logoutEndpoint: 'https://keycloak.test.com/realms/test-realm/protocol/openid_connect/logout',
        enableRoleMapping: true,
        roleMappingClaim: 'realm_access.roles',
        defaultRole: 'user'
      };

      const config: OttehrAuthConfig = {
        clientId: 'test_client_id',
        clientSecret: 'test_client_secret',
        tokenStorage: new MemoryTokenStorage(),
        autoRefresh: false,
        keycloak: keycloakConfig
      };

      keycloakAuthManager = new OttehrAuthManager(config);
    });

    afterEach(() => {
      keycloakAuthManager.destroy();
    });

    describe('Authorization URL Generation', () => {
      it('should generate Keycloak authorization URL with PKCE', () => {
        const result = keycloakAuthManager.generateKeycloakAuthUrl('test-state', 'test-nonce');
        
        expect(result.url).toContain(keycloakConfig.authorizationEndpoint);
        expect(result.url).toContain('response_type=code');
        expect(result.url).toContain('client_id=test-keycloak-client');
        expect(result.url).toContain('redirect_uri=https%3A//app.test.com/callback');
        expect(result.url).toContain('scope=openid%20profile%20email');
        expect(result.url).toContain('state=test-state');
        expect(result.url).toContain('nonce=test-nonce');
        expect(result.url).toContain('code_challenge=');
        expect(result.url).toContain('code_challenge_method=S256');
        
        expect(result.codeVerifier).toBeDefined();
        expect(result.state).toBe('test-state');
        expect(result.nonce).toBe('test-nonce');
      });

      it('should generate random state and nonce if not provided', () => {
        const result = keycloakAuthManager.generateKeycloakAuthUrl();
        
        expect(result.state).toBeDefined();
        expect(result.state.length).toBeGreaterThan(0);
        expect(result.nonce).toBeDefined();
        expect(result.nonce.length).toBeGreaterThan(0);
        expect(result.codeVerifier).toBeDefined();
        expect(result.codeVerifier.length).toBeGreaterThan(0);
      });

      it('should throw error if Keycloak is not configured', () => {
        const manager = new OttehrAuthManager({
          clientId: 'test_client',
          clientSecret: 'test_secret'
          // No Keycloak config
        });

        expect(() => {
          manager.generateKeycloakAuthUrl();
        }).toThrow('Keycloak integration is not enabled or configured');

        manager.destroy();
      });
    });

    describe('Token Exchange', () => {
      it('should exchange authorization code for tokens', async () => {
        const mockTokenResponse = {
          access_token: 'keycloak_access_token',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'keycloak_refresh_token',
          id_token: 'mock.id.token',
          scope: 'openid profile email'
        };

        // Mock the ID token validation
        jest.spyOn(keycloakAuthManager as any, 'validateKeycloakIdToken').mockResolvedValue({
          valid: true,
          payload: {
            sub: 'user-123',
            email: 'test@example.com',
            preferred_username: 'testuser',
            realm_access: { roles: ['ottehr-user', 'ottehr-pharmacy'] }
          }
        });

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockTokenResponse
        } as Response);

        const result = await keycloakAuthManager.exchangeKeycloakCode(
          'auth_code_123',
          'code_verifier_123',
          'test-state',
          'test-nonce'
        );

        expect(result.success).toBe(true);
        expect(result.tokenInfo?.accessToken).toBe('keycloak_access_token');
        expect(result.tokenInfo?.tokenType).toBe('Bearer');
        expect(result.tokenInfo?.refreshToken).toBe('keycloak_refresh_token');
        expect(result.tokenInfo?.idToken).toBe('mock.id.token');
        expect(result.tokenInfo?.roles).toEqual(['ottehr-user', 'ottehr-pharmacy']);
        expect(result.tokenInfo?.metadata?.provider).toBe('keycloak');
        expect(result.tokenInfo?.metadata?.state).toBe('test-state');
      });

      it('should handle token exchange errors', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({
            error: 'invalid_grant',
            error_description: 'Authorization code is invalid'
          })
        } as Response);

        const result = await keycloakAuthManager.exchangeKeycloakCode(
          'invalid_code',
          'code_verifier_123'
        );

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('KEYCLOAK_TOKEN_EXCHANGE_FAILED');
        expect(result.error?.message).toContain('Authorization code is invalid');
      });

      it('should handle ID token validation failure', async () => {
        const mockTokenResponse = {
          access_token: 'keycloak_access_token',
          token_type: 'Bearer',
          expires_in: 3600,
          id_token: 'invalid.id.token'
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockTokenResponse
        } as Response);

        // Mock failed ID token validation
        jest.spyOn(keycloakAuthManager as any, 'validateKeycloakIdToken').mockResolvedValue({
          valid: false,
          error: 'Invalid token signature'
        });

        const result = await keycloakAuthManager.exchangeKeycloakCode(
          'auth_code_123',
          'code_verifier_123'
        );

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_ID_TOKEN');
        expect(result.error?.message).toContain('Invalid token signature');
      });
    });

    describe('Token Refresh', () => {
      it('should refresh Keycloak tokens', async () => {
        // Set up initial Keycloak token
        const initialToken: TokenInfo = {
          accessToken: 'old_keycloak_token',
          tokenType: 'Bearer',
          expiresAt: Date.now() + 1000,
          refreshToken: 'keycloak_refresh_token',
          roles: ['ottehr-user'],
          metadata: {
            provider: 'keycloak',
            grantType: 'authorization_code'
          }
        };

        await keycloakAuthManager['setCurrentToken'](initialToken);

        const mockRefreshResponse = {
          access_token: 'new_keycloak_access_token',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'new_keycloak_refresh_token',
          id_token: 'new.id.token'
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockRefreshResponse
        } as Response);

        const result = await keycloakAuthManager.refreshKeycloakToken();

        expect(result.success).toBe(true);
        expect(result.tokenInfo?.accessToken).toBe('new_keycloak_access_token');
        expect(result.tokenInfo?.refreshToken).toBe('new_keycloak_refresh_token');
        expect(result.tokenInfo?.metadata?.provider).toBe('keycloak');
      });

      it('should handle Keycloak refresh errors', async () => {
        const initialToken: TokenInfo = {
          accessToken: 'old_token',
          tokenType: 'Bearer',
          expiresAt: Date.now() + 1000,
          refreshToken: 'expired_refresh_token',
          metadata: { provider: 'keycloak' }
        };

        await keycloakAuthManager['setCurrentToken'](initialToken);

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({
            error: 'invalid_grant',
            error_description: 'Refresh token has expired'
          })
        } as Response);

        const result = await keycloakAuthManager.refreshKeycloakToken();

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('KEYCLOAK_REFRESH_FAILED');
      });
    });

    describe('User Information', () => {
      it('should get user info from Keycloak', async () => {
        // Set up authenticated state
        const token: TokenInfo = {
          accessToken: 'valid_access_token',
          tokenType: 'Bearer',
          expiresAt: Date.now() + 3600000,
          metadata: { provider: 'keycloak' }
        };

        await keycloakAuthManager['setCurrentToken'](token);

        const mockUserInfo = {
          sub: 'user-123',
          email: 'test@example.com',
          email_verified: true,
          preferred_username: 'testuser',
          given_name: 'Test',
          family_name: 'User',
          name: 'Test User'
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockUserInfo
        } as Response);

        const result = await keycloakAuthManager.getKeycloakUserInfo();

        expect(result.success).toBe(true);
        expect(result.userInfo).toEqual(mockUserInfo);
        expect(mockFetch).toHaveBeenCalledWith(
          keycloakConfig.userinfoEndpoint,
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer valid_access_token'
            })
          })
        );
      });

      it('should handle userinfo endpoint errors', async () => {
        const token: TokenInfo = {
          accessToken: 'invalid_token',
          tokenType: 'Bearer',
          expiresAt: Date.now() + 3600000,
          metadata: { provider: 'keycloak' }
        };

        await keycloakAuthManager['setCurrentToken'](token);

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized'
        } as Response);

        const result = await keycloakAuthManager.getKeycloakUserInfo();

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain('UserInfo request failed');
      });
    });

    describe('Logout', () => {
      it('should generate logout URL and clear tokens', async () => {
        const token: TokenInfo = {
          accessToken: 'access_token',
          tokenType: 'Bearer',
          expiresAt: Date.now() + 3600000,
          idToken: 'id.token.here',
          metadata: { provider: 'keycloak' }
        };

        await keycloakAuthManager['setCurrentToken'](token);

        const result = await keycloakAuthManager.logoutFromKeycloak(
          'https://app.test.com/logout-complete'
        );

        expect(result.success).toBe(true);
        expect(result.logoutUrl).toContain(keycloakConfig.logoutEndpoint);
        expect(result.logoutUrl).toContain('id_token_hint=id.token.here');
        expect(result.logoutUrl).toContain('post_logout_redirect_uri=https%3A%2F%2Fapp.test.com%2Flogout-complete');
        
        // Verify tokens were cleared
        expect(keycloakAuthManager.isAuthenticated()).toBe(false);
      });

      it('should logout without redirect URI', async () => {
        const token: TokenInfo = {
          accessToken: 'access_token',
          tokenType: 'Bearer',
          expiresAt: Date.now() + 3600000,
          metadata: { provider: 'keycloak' }
        };

        await keycloakAuthManager['setCurrentToken'](token);

        const result = await keycloakAuthManager.logoutFromKeycloak();

        expect(result.success).toBe(true);
        expect(result.logoutUrl).toContain(keycloakConfig.logoutEndpoint);
        expect(result.logoutUrl).not.toContain('post_logout_redirect_uri');
      });
    });

    describe('Role Extraction', () => {
      it('should extract roles from realm_access claim', () => {
        const payload: OIDCTokenPayload = {
          iss: 'https://keycloak.test.com/realms/test-realm',
          sub: 'user-123',
          aud: 'test-keycloak-client',
          exp: Date.now() / 1000 + 3600,
          iat: Date.now() / 1000,
          realm_access: {
            roles: ['ottehr-admin', 'ottehr-user', 'ottehr-pharmacy']
          }
        };

        const roles = keycloakAuthManager['extractRolesFromToken'](payload);
        expect(roles).toEqual(['ottehr-admin', 'ottehr-user', 'ottehr-pharmacy']);
      });

      it('should return default role when no roles found', () => {
        const payload: OIDCTokenPayload = {
          iss: 'https://keycloak.test.com/realms/test-realm',
          sub: 'user-123',
          aud: 'test-keycloak-client',
          exp: Date.now() / 1000 + 3600,
          iat: Date.now() / 1000
          // No realm_access
        };

        const roles = keycloakAuthManager['extractRolesFromToken'](payload);
        expect(roles).toEqual(['user']); // Default role from config
      });

      it('should return empty array when role mapping disabled', () => {
        const configWithoutRoles: OttehrAuthConfig = {
          clientId: 'test_client',
          clientSecret: 'test_secret',
          keycloak: {
            ...keycloakConfig,
            enableRoleMapping: false
          }
        };

        const manager = new OttehrAuthManager(configWithoutRoles);

        const payload: OIDCTokenPayload = {
          iss: 'https://keycloak.test.com/realms/test-realm',
          sub: 'user-123',
          aud: 'test-keycloak-client',
          exp: Date.now() / 1000 + 3600,
          iat: Date.now() / 1000,
          realm_access: {
            roles: ['ottehr-admin']
          }
        };

        const roles = manager['extractRolesFromToken'](payload);
        expect(roles).toEqual([]);

        manager.destroy();
      });
    });

    describe('Utility Functions', () => {
      it('should generate random strings', () => {
        const str1 = keycloakAuthManager['generateRandomString'](32);
        const str2 = keycloakAuthManager['generateRandomString'](32);
        
        expect(str1).toHaveLength(32);
        expect(str2).toHaveLength(32);
        expect(str1).not.toBe(str2); // Should be different
      });

      it('should generate code challenge from verifier', () => {
        const verifier = 'test_code_verifier_123';
        const challenge = keycloakAuthManager['generateCodeChallenge'](verifier);
        
        expect(challenge).toBeDefined();
        expect(challenge.length).toBeGreaterThan(0);
        expect(challenge).not.toContain('+');
        expect(challenge).not.toContain('/');
        expect(challenge).not.toContain('=');
      });

      it('should get nested property from object', () => {
        const obj = {
          level1: {
            level2: {
              level3: 'value'
            },
            array: ['item1', 'item2']
          }
        };

        expect(keycloakAuthManager['getNestedProperty'](obj, 'level1.level2.level3')).toBe('value');
        expect(keycloakAuthManager['getNestedProperty'](obj, 'level1.array')).toEqual(['item1', 'item2']);
        expect(keycloakAuthManager['getNestedProperty'](obj, 'nonexistent.path')).toBeUndefined();
      });
    });

    describe('Event Emission', () => {
      it('should emit keycloak-specific authentication events', async () => {
        const keycloakAuthSpy = jest.fn();
        keycloakAuthManager.on('keycloakAuthenticated', keycloakAuthSpy);

        const mockTokenResponse = {
          access_token: 'keycloak_access_token',
          token_type: 'Bearer',
          expires_in: 3600,
          id_token: 'mock.id.token'
        };

        jest.spyOn(keycloakAuthManager as any, 'validateKeycloakIdToken').mockResolvedValue({
          valid: true,
          payload: {
            sub: 'user-123',
            email: 'test@example.com',
            realm_access: { roles: ['ottehr-user'] }
          }
        });

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockTokenResponse
        } as Response);

        await keycloakAuthManager.exchangeKeycloakCode('code', 'verifier');

        expect(keycloakAuthSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            tokenInfo: expect.objectContaining({
              accessToken: 'keycloak_access_token'
            }),
            userInfo: expect.objectContaining({
              sub: 'user-123',
              email: 'test@example.com'
            })
          })
        );
      });
    });
  });
});