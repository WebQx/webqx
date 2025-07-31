/**
 * OAuth2 Integration Tests
 * End-to-end tests for OAuth2 functionality
 */

const { createOAuth2Instance } = require('../index');
const jwt = require('jsonwebtoken');

describe('OAuth2 Integration', () => {
    let oauth2Instance;
    let mockToken;

    beforeAll(() => {
        process.env.NODE_ENV = 'test';
        process.env.OAUTH2_MOCK_MODE = 'true';
        
        oauth2Instance = createOAuth2Instance({
            config: {
                development: {
                    enableMockMode: true,
                    skipSignatureVerification: true
                },
                rbac: {
                    enabled: true
                }
            }
        });

        // Create a mock token for testing
        mockToken = jwt.sign({
            sub: 'test-user-123',
            iss: 'https://auth.webqx.health',
            aud: 'webqx-healthcare-platform',
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000),
            email: 'test@webqx.health',
            name: 'Test User',
            roles: ['provider', 'patient'],
            permissions: ['patient:read', 'patient:write', 'observation:read'],
            patient_id: 'patient-123'
        }, 'test-secret');
    });

    describe('Complete OAuth2 Flow', () => {
        test('should generate authorization URL', () => {
            const result = oauth2Instance.client.generateAuthorizationUrl({
                scope: 'openid profile patient:read'
            });

            expect(result.authorizationUrl).toContain('https://auth.webqx.health/oauth2/authorize');
            expect(result.authorizationUrl).toContain('client_id=webqx-healthcare-platform');
            expect(result.authorizationUrl).toContain('scope=openid+profile+patient%3Aread');
            expect(result.state).toBeDefined();
            expect(result.nonce).toBeDefined();
        });

        test('should exchange authorization code for tokens', async () => {
            const authUrl = oauth2Instance.client.generateAuthorizationUrl();
            
            const result = await oauth2Instance.client.exchangeCodeForTokens({
                code: 'test-authorization-code',
                state: authUrl.state,
                redirectUri: 'http://localhost:3000/auth/oauth2/callback'
            });

            expect(result.access_token).toBeDefined();
            expect(result.token_type).toBe('Bearer');
            expect(result.expires_in).toBe(3600);
            expect(result.refresh_token).toBeDefined();
        });

        test('should validate access tokens', async () => {
            const result = await oauth2Instance.tokenValidator.validateAccessToken(mockToken);

            expect(result.valid).toBe(true);
            expect(result.userInfo.userId).toBe('test-user-123');
            expect(result.userInfo.email).toBe('test@webqx.health');
            expect(result.userInfo.roles).toContain('provider');
            expect(result.userInfo.permissions).toContain('patient:read');
        });
    });

    describe('RBAC Integration', () => {
        let testUser;

        beforeEach(async () => {
            const validation = await oauth2Instance.tokenValidator.validateAccessToken(mockToken);
            testUser = validation.userInfo;
        });

        test('should check user permissions', () => {
            const result = oauth2Instance.rbacManager.hasPermission(testUser, 'patient:read');
            
            expect(result.authorized).toBe(true);
            expect(result.reason).toBe('Direct permission granted');
        });

        test('should check user roles', () => {
            const result = oauth2Instance.rbacManager.hasRole(testUser, ['provider']);
            
            expect(result.authorized).toBe(true);
            expect(result.matchedRoles).toContain('provider');
        });

        test('should handle role hierarchy', () => {
            // Note: This test is simplified for integration testing
            // Full role hierarchy is tested in the dedicated RBAC tests
            const result = oauth2Instance.rbacManager.hasRole(testUser, ['patient']);
            
            expect(result.authorized).toBe(true);
            expect(result.matchedRoles).toContain('patient');
        });

        test('should handle resource-specific permissions', () => {
            const context = { patientId: 'patient-123' };
            
            const result = oauth2Instance.rbacManager.hasPermission(
                testUser, 
                'patient:read', 
                context
            );
            
            expect(result.authorized).toBe(true);
        });

        test('should deny unauthorized access', () => {
            const result = oauth2Instance.rbacManager.hasPermission(testUser, 'admin:write');
            
            expect(result.authorized).toBe(false);
            expect(result.errorCode).toBe('PERMISSION_DENIED');
        });
    });

    describe('Middleware Integration', () => {
        test('should create authentication middleware', () => {
            const authMiddleware = oauth2Instance.authenticate();
            
            expect(typeof authMiddleware).toBe('function');
            expect(authMiddleware.length).toBe(3); // Express middleware signature
        });

        test('should create authorization middleware', () => {
            const authzMiddleware = oauth2Instance.authorize(['patient:read']);
            
            expect(typeof authzMiddleware).toBe('function');
            expect(authzMiddleware.length).toBe(3);
        });

        test('should create role requirement middleware', () => {
            const roleMiddleware = oauth2Instance.requireRoles(['provider']);
            
            expect(typeof roleMiddleware).toBe('function');
            expect(roleMiddleware.length).toBe(3);
        });
    });

    describe('System Status and Health', () => {
        test('should provide system status', () => {
            const status = oauth2Instance.getStatus();
            
            expect(status.oauth2.enabled).toBe(true);
            expect(status.oauth2.mockMode).toBe(true);
            expect(status.rbac.enabled).toBe(true);
            expect(status.tokenValidator).toBeDefined();
            expect(status.client).toBeDefined();
        });

        test('should provide RBAC statistics', () => {
            const stats = oauth2Instance.rbacManager.getRBACStats();
            
            expect(stats.enabled).toBe(true);
            expect(stats.roleHierarchy).toBeGreaterThan(0);
            expect(stats.defaultRoles).toContain('patient');
        });

        test('should provide token validator statistics', () => {
            const stats = oauth2Instance.tokenValidator.getValidationStats();
            
            expect(stats.config.mockMode).toBe(true);
            expect(stats.cachedTokens).toBeDefined();
            expect(stats.cachedKeys).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        test('should handle invalid tokens gracefully', async () => {
            const result = await oauth2Instance.tokenValidator.validateAccessToken('invalid-token');
            
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBeDefined();
        });

        test('should handle missing user info in RBAC', () => {
            const result = oauth2Instance.rbacManager.hasPermission(null, 'patient:read');
            
            expect(result.authorized).toBe(false);
            expect(result.errorCode).toBe('NO_USER_INFO');
        });

        test('should handle authorization code exchange errors', async () => {
            await expect(oauth2Instance.client.exchangeCodeForTokens({
                code: null, // Missing code
                state: 'test-state'
            })).rejects.toThrow('Authorization code is required');
        });
    });

    describe('Configuration and Flexibility', () => {
        test('should support configuration updates in test mode', () => {
            expect(() => {
                oauth2Instance.config = {
                    ...oauth2Instance.config,
                    rbac: { enabled: false }
                };
            }).not.toThrow();
        });

        test('should handle disabled RBAC', () => {
            const testOAuth2 = createOAuth2Instance({
                config: {
                    rbac: { enabled: false },
                    development: { enableMockMode: true }
                }
            });

            const result = testOAuth2.rbacManager.hasPermission({}, 'any:permission');
            
            expect(result.authorized).toBe(true);
            expect(result.reason).toBe('RBAC disabled');
        });
    });

    describe('Performance and Caching', () => {
        test('should cache token validation results', async () => {
            // Enable caching for this test
            const testOAuth2 = createOAuth2Instance({
                config: {
                    token: { cacheEnabled: true },
                    development: { enableMockMode: true }
                }
            });

            const result1 = await testOAuth2.tokenValidator.validateAccessToken(mockToken);
            const result2 = await testOAuth2.tokenValidator.validateAccessToken(mockToken);

            expect(result1.valid).toBe(true);
            expect(result2.valid).toBe(true);
            expect(testOAuth2.tokenValidator.validatedTokenCache.size).toBeGreaterThan(0);
        });

        test('should cache permission results', () => {
            const user = { userId: 'test', roles: ['patient'], permissions: ['patient:read'] };
            
            const result1 = oauth2Instance.rbacManager.hasPermission(user, 'patient:read');
            const result2 = oauth2Instance.rbacManager.hasPermission(user, 'patient:read');

            expect(result1.authorized).toBe(true);
            expect(result2.authorized).toBe(true);
            expect(oauth2Instance.rbacManager.permissionCache.size).toBeGreaterThan(0);
        });

        test('should clear caches when requested', () => {
            oauth2Instance.clearCaches();
            
            expect(oauth2Instance.tokenValidator.validatedTokenCache.size).toBe(0);
            expect(oauth2Instance.rbacManager.permissionCache.size).toBe(0);
        });
    });

    describe('Production Readiness', () => {
        test('should validate configuration properly', () => {
            const { validateConfig } = require('../config');
            
            // Should pass in test mode
            const validation = validateConfig();
            expect(validation.valid).toBe(true);
        });

        test('should provide comprehensive error information', async () => {
            const expiredToken = jwt.sign({
                sub: 'user-123',
                exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
            }, 'test-secret');

            const result = await oauth2Instance.tokenValidator.validateAccessToken(expiredToken);
            
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('TOKEN_EXPIRED');
            expect(result.error).toContain('expired');
        });

        test('should support various token formats', async () => {
            // Test with Bearer prefix
            const result = await oauth2Instance.tokenValidator.validateAccessToken(`Bearer ${mockToken}`);
            
            expect(result.valid).toBe(true);
            expect(result.userInfo.userId).toBe('test-user-123');
        });
    });
});