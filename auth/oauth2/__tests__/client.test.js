/**
 * OAuth2 Client Tests
 * Tests for OAuth2 client implementation
 */

const OAuth2Client = require('../client');
const { updateConfig } = require('../config');

// Mock crypto for consistent test results
jest.mock('crypto', () => ({
    randomBytes: jest.fn().mockReturnValue(Buffer.from('mockedrandomvalue'))
}));

describe('OAuth2 Client', () => {
    let oauth2Client;

    beforeEach(() => {
        process.env.NODE_ENV = 'test';
        
        // Update config for testing
        updateConfig({
            development: {
                enableMockMode: true
            }
        });
        
        oauth2Client = new OAuth2Client();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Authorization URL Generation', () => {
        test('should generate valid authorization URL', () => {
            const result = oauth2Client.generateAuthorizationUrl();
            
            expect(result).toBeDefined();
            expect(result.authorizationUrl).toContain('https://auth.webqx.health/oauth2/authorize');
            expect(result.authorizationUrl).toContain('client_id=webqx-healthcare-platform');
            expect(result.authorizationUrl).toContain('response_type=code');
            expect(result.state).toBeDefined();
            expect(result.nonce).toBeDefined();
        });

        test('should include custom scope in authorization URL', () => {
            const customScope = 'custom:scope test:permission';
            const result = oauth2Client.generateAuthorizationUrl({ scope: customScope });
            
            // URL encoding converts spaces to + signs, not %20
            expect(result.authorizationUrl).toContain('scope=custom%3Ascope+test%3Apermission');
        });

        test('should include PKCE parameters when enabled', () => {
            const result = oauth2Client.generateAuthorizationUrl();
            
            expect(result.authorizationUrl).toContain('code_challenge=');
            expect(result.authorizationUrl).toContain('code_challenge_method=S256');
            expect(result.codeVerifier).toBeDefined();
        });

        test('should store state and code verifier', () => {
            const result = oauth2Client.generateAuthorizationUrl();
            
            expect(oauth2Client.stateStore.has(result.state)).toBe(true);
            expect(oauth2Client.codeVerifierStore.has(result.state)).toBe(true);
        });

        test('should accept custom state and nonce', () => {
            const customState = 'custom-state-123';
            const customNonce = 'custom-nonce-456';
            
            const result = oauth2Client.generateAuthorizationUrl({
                state: customState,
                nonce: customNonce
            });
            
            expect(result.state).toBe(customState);
            expect(result.nonce).toBe(customNonce);
        });
    });

    describe('Token Exchange', () => {
        test('should exchange code for tokens successfully', async () => {
            const authUrl = oauth2Client.generateAuthorizationUrl();
            
            const result = await oauth2Client.exchangeCodeForTokens({
                code: 'test-auth-code',
                state: authUrl.state,
                redirectUri: 'http://localhost:3000/callback'
            });
            
            expect(result).toBeDefined();
            expect(result.access_token).toBeDefined();
            expect(result.token_type).toBe('Bearer');
            expect(result.expires_in).toBe(3600);
            expect(result.refresh_token).toBeDefined();
        });

        test('should fail without authorization code', async () => {
            await expect(oauth2Client.exchangeCodeForTokens({
                state: 'test-state'
            })).rejects.toThrow('Authorization code is required');
        });

        test('should validate state parameter', async () => {
            await expect(oauth2Client.exchangeCodeForTokens({
                code: 'test-code',
                state: 'invalid-state'
            })).rejects.toThrow('Invalid or expired state parameter');
        });

        test('should handle expired state', async () => {
            const authUrl = oauth2Client.generateAuthorizationUrl();
            
            // Manually expire the state
            const stateData = oauth2Client.stateStore.get(authUrl.state);
            stateData.timestamp = Date.now() - 700000; // 11+ minutes ago
            
            await expect(oauth2Client.exchangeCodeForTokens({
                code: 'test-code',
                state: authUrl.state
            })).rejects.toThrow('State parameter has expired');
        });

        test('should cache tokens when enabled', async () => {
            updateConfig({
                token: { cacheEnabled: true },
                development: { enableMockMode: true }
            });
            
            oauth2Client = new OAuth2Client();
            const authUrl = oauth2Client.generateAuthorizationUrl();
            
            const result = await oauth2Client.exchangeCodeForTokens({
                code: 'test-auth-code',
                state: authUrl.state
            });
            
            expect(oauth2Client.tokenCache.has(result.access_token)).toBe(true);
        });
    });

    describe('Token Refresh', () => {
        test('should refresh access token successfully', async () => {
            const result = await oauth2Client.refreshAccessToken('test-refresh-token');
            
            expect(result).toBeDefined();
            expect(result.access_token).toBeDefined();
            expect(result.token_type).toBe('Bearer');
            expect(result.expires_in).toBe(3600);
        });

        test('should fail without refresh token', async () => {
            await expect(oauth2Client.refreshAccessToken()).rejects.toThrow('Refresh token is required');
        });

        test('should fail with empty refresh token', async () => {
            await expect(oauth2Client.refreshAccessToken('')).rejects.toThrow('Refresh token is required');
        });
    });

    describe('Token Revocation', () => {
        test('should revoke token successfully', async () => {
            const result = await oauth2Client.revokeToken('test-token');
            expect(result).toBe(true);
        });

        test('should fail without token', async () => {
            await expect(oauth2Client.revokeToken()).rejects.toThrow('Token is required for revocation');
        });

        test('should remove token from cache', async () => {
            const token = 'cached-token';
            oauth2Client.cacheToken(token, { access_token: token });
            
            expect(oauth2Client.tokenCache.has(token)).toBe(true);
            
            await oauth2Client.revokeToken(token);
            
            expect(oauth2Client.tokenCache.has(token)).toBe(false);
        });
    });

    describe('Token Caching', () => {
        test('should cache token data', () => {
            const token = 'test-token';
            const tokenData = {
                access_token: token,
                expires_in: 3600,
                token_type: 'Bearer'
            };
            
            oauth2Client.cacheToken(token, tokenData);
            
            const cached = oauth2Client.getCachedToken(token);
            expect(cached).toBeDefined();
            expect(cached.access_token).toBe(token);
            expect(cached.cached_at).toBeDefined();
        });

        test('should return null for non-existent token', () => {
            const cached = oauth2Client.getCachedToken('non-existent-token');
            expect(cached).toBeNull();
        });

        test('should return null for expired cache entry', () => {
            const token = 'expired-token';
            oauth2Client.cacheToken(token, { access_token: token });
            
            // Manually manipulate the cache entry to be expired
            const cached = oauth2Client.tokenCache.get(token);
            cached.cached_at = Date.now() - 400000; // Make it older than the default TTL
            
            const result = oauth2Client.getCachedToken(token);
            expect(result).toBeNull();
            expect(oauth2Client.tokenCache.has(token)).toBe(false);
        });
    });

    describe('State Management', () => {
        test('should clean up expired states', () => {
            // Add some states with different ages
            oauth2Client.stateStore.set('fresh-state', { timestamp: Date.now() });
            oauth2Client.stateStore.set('old-state', { timestamp: Date.now() - 700000 });
            oauth2Client.codeVerifierStore.set('old-state', 'verifier');
            
            oauth2Client.cleanupExpiredStates();
            
            expect(oauth2Client.stateStore.has('fresh-state')).toBe(true);
            expect(oauth2Client.stateStore.has('old-state')).toBe(false);
            expect(oauth2Client.codeVerifierStore.has('old-state')).toBe(false);
        });
    });

    describe('Mock Mode', () => {
        beforeEach(() => {
            updateConfig({
                development: {
                    enableMockMode: true,
                    mockUserClaims: {
                        sub: 'test-user',
                        email: 'test@example.com',
                        roles: ['patient']
                    }
                }
            });
            oauth2Client = new OAuth2Client();
        });

        test('should generate mock tokens', () => {
            const mockResponse = oauth2Client.generateMockTokenResponse();
            
            expect(mockResponse.access_token).toBeDefined();
            expect(mockResponse.token_type).toBe('Bearer');
            expect(mockResponse.expires_in).toBe(3600);
            expect(mockResponse.refresh_token).toBeDefined();
        });

        test('should use mock mode in token exchange', async () => {
            const authUrl = oauth2Client.generateAuthorizationUrl();
            
            const result = await oauth2Client.exchangeCodeForTokens({
                code: 'mock-code',
                state: authUrl.state
            });
            
            expect(result.access_token).toBeDefined();
            expect(result.token_type).toBe('Bearer');
        });
    });

    describe('Configuration Retrieval', () => {
        test('should return client configuration', () => {
            const config = oauth2Client.getClientConfig();
            
            expect(config).toBeDefined();
            expect(config.clientId).toBeDefined();
            expect(config.scope).toBeDefined();
            expect(config.redirectUri).toBeDefined();
            expect(config.authorizationEndpoint).toBeDefined();
            expect(config.tokenEndpoint).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        test('should handle authorization URL generation errors', () => {
            // Force an error by corrupting the config
            oauth2Client.config = null;
            
            expect(() => {
                oauth2Client.generateAuthorizationUrl();
            }).toThrow('Failed to generate authorization URL');
        });

        test('should handle token exchange errors gracefully', async () => {
            // Disable mock mode to trigger real HTTP request (which will fail)
            updateConfig({
                development: { enableMockMode: false }
            });
            oauth2Client = new OAuth2Client();
            
            const authUrl = oauth2Client.generateAuthorizationUrl();
            
            // This should still work because we fall back to mock in makeTokenRequest
            const result = await oauth2Client.exchangeCodeForTokens({
                code: 'test-code',
                state: authUrl.state
            });
            
            expect(result).toBeDefined();
        });
    });
});