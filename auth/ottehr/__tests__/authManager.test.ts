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
  type TokenInfo
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
  });
});