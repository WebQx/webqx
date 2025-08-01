/**
 * OAuth2 Token Validator Tests
 * Tests for OAuth2 token validation functionality
 */

const jwt = require('jsonwebtoken');
const TokenValidator = require('../tokenValidator');
const { updateConfig } = require('../config');

describe('OAuth2 Token Validator', () => {
    let tokenValidator;
    let validToken;
    let expiredToken;
    let invalidToken;

    beforeEach(() => {
        process.env.NODE_ENV = 'test';
        
        // Configure for testing
        updateConfig({
            development: {
                enableMockMode: true,
                skipSignatureVerification: true
            },
            token: {
                cacheEnabled: true,
                cacheTtl: 300
            }
        });
        
        tokenValidator = new TokenValidator();
        
        // Create test tokens
        const now = Math.floor(Date.now() / 1000);
        
        validToken = jwt.sign({
            sub: 'test-user-123',
            iss: 'https://auth.webqx.health',
            aud: 'webqx-healthcare-platform',
            exp: now + 3600,
            iat: now,
            email: 'test@webqx.health',
            name: 'Test User',
            roles: ['patient', 'provider'],
            permissions: ['patient:read', 'patient:write']
        }, 'test-secret');
        
        expiredToken = jwt.sign({
            sub: 'test-user-123',
            iss: 'https://auth.webqx.health',
            aud: 'webqx-healthcare-platform',
            exp: now - 3600, // Expired 1 hour ago
            iat: now - 7200
        }, 'test-secret');
        
        invalidToken = 'invalid.token.format';
    });

    afterEach(() => {
        jest.clearAllMocks();
        tokenValidator.clearCache();
    });

    describe('Access Token Validation', () => {
        test('should validate valid access token successfully', async () => {
            const result = await tokenValidator.validateAccessToken(validToken);
            
            expect(result.valid).toBe(true);
            expect(result.payload).toBeDefined();
            expect(result.userInfo).toBeDefined();
            expect(result.userInfo.userId).toBe('test-user-123');
            expect(result.userInfo.email).toBe('test@webqx.health');
            expect(result.userInfo.roles).toContain('patient');
            expect(result.tokenType).toBe('access_token');
        });

        test('should reject missing token', async () => {
            const result = await tokenValidator.validateAccessToken();
            
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Token is required');
            expect(result.errorCode).toBe('MISSING_TOKEN');
        });

        test('should reject empty token', async () => {
            const result = await tokenValidator.validateAccessToken('');
            
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('MISSING_TOKEN');
        });

        test('should handle Bearer token prefix', async () => {
            const result = await tokenValidator.validateAccessToken(`Bearer ${validToken}`);
            
            expect(result.valid).toBe(true);
            expect(result.userInfo.userId).toBe('test-user-123');
        });

        test('should reject expired token', async () => {
            const result = await tokenValidator.validateAccessToken(expiredToken);
            
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Token has expired');
            expect(result.errorCode).toBe('TOKEN_EXPIRED');
        });

        test('should reject invalid token format', async () => {
            const result = await tokenValidator.validateAccessToken(invalidToken);
            
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Invalid token format');
            expect(result.errorCode).toBe('INVALID_FORMAT');
        });

        test('should cache validation results', async () => {
            const result1 = await tokenValidator.validateAccessToken(validToken);
            const result2 = await tokenValidator.validateAccessToken(validToken);
            
            expect(result1.valid).toBe(true);
            expect(result2.valid).toBe(true);
            
            // Second call should be from cache (same object reference in mock mode)
            expect(tokenValidator.validatedTokenCache.size).toBe(1);
        });

        test('should validate token with custom options', async () => {
            const result = await tokenValidator.validateAccessToken(validToken, {
                tokenType: 'access_token'
            });
            
            expect(result.valid).toBe(true);
            expect(result.tokenType).toBe('access_token');
        });
    });

    describe('ID Token Validation', () => {
        let idToken;

        beforeEach(() => {
            const now = Math.floor(Date.now() / 1000);
            idToken = jwt.sign({
                sub: 'test-user-123',
                iss: 'https://auth.webqx.health',
                aud: 'webqx-healthcare-platform',
                exp: now + 3600,
                iat: now,
                auth_time: now - 60,
                nonce: 'test-nonce-123'
            }, 'test-secret');
        });

        test('should validate ID token successfully', async () => {
            const result = await tokenValidator.validateIdToken(idToken);
            
            expect(result.valid).toBe(true);
            expect(result.tokenType).toBe('id_token');
        });

        test('should validate nonce in ID token', async () => {
            const result = await tokenValidator.validateIdToken(idToken, {
                nonce: 'test-nonce-123'
            });
            
            expect(result.valid).toBe(true);
        });

        test('should reject ID token with invalid nonce', async () => {
            const result = await tokenValidator.validateIdToken(idToken, {
                nonce: 'wrong-nonce'
            });
            
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Nonce mismatch');
            expect(result.errorCode).toBe('NONCE_MISMATCH');
        });

        test('should validate auth_time in ID token', async () => {
            const result = await tokenValidator.validateIdToken(idToken, {
                maxAge: 3600 // 1 hour
            });
            
            expect(result.valid).toBe(true);
        });

        test('should reject ID token with old auth_time', async () => {
            const now = Math.floor(Date.now() / 1000);
            const oldIdToken = jwt.sign({
                sub: 'test-user-123',
                iss: 'https://auth.webqx.health',
                aud: 'webqx-healthcare-platform',
                exp: now + 3600,
                iat: now,
                auth_time: now - 7200 // 2 hours ago
            }, 'test-secret');
            
            const result = await tokenValidator.validateIdToken(oldIdToken, {
                maxAge: 3600 // 1 hour max
            });
            
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Authentication too old');
            expect(result.errorCode).toBe('AUTH_TIME_EXCEEDED');
        });
    });

    describe('Token Header Decoding', () => {
        test('should decode valid token header', () => {
            const header = tokenValidator.decodeTokenHeader(validToken);
            
            expect(header).toBeDefined();
            expect(header.alg).toBeDefined();
            expect(header.typ).toBe('JWT');
        });

        test('should return null for invalid token format', () => {
            const header = tokenValidator.decodeTokenHeader('invalid.token');
            expect(header).toBeNull();
        });

        test('should return null for malformed token', () => {
            const header = tokenValidator.decodeTokenHeader('not-a-token');
            expect(header).toBeNull();
        });
    });

    describe('Claims Validation', () => {
        test('should validate all required claims', () => {
            const now = Math.floor(Date.now() / 1000);
            const payload = {
                sub: 'user-123',
                iss: 'https://auth.webqx.health',
                aud: 'webqx-healthcare-platform',
                exp: now + 3600,
                iat: now,
                nbf: now - 60
            };
            
            const result = tokenValidator.validateTokenClaims(payload);
            expect(result.valid).toBe(true);
        });

        test('should reject token with wrong issuer', () => {
            const payload = {
                sub: 'user-123',
                iss: 'https://wrong-issuer.com',
                aud: 'webqx-healthcare-platform',
                exp: Math.floor(Date.now() / 1000) + 3600
            };
            
            const result = tokenValidator.validateTokenClaims(payload);
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('INVALID_ISSUER');
        });

        test('should reject token with wrong audience', () => {
            const payload = {
                sub: 'user-123',
                iss: 'https://auth.webqx.health',
                aud: 'wrong-audience',
                exp: Math.floor(Date.now() / 1000) + 3600
            };
            
            const result = tokenValidator.validateTokenClaims(payload);
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('INVALID_AUDIENCE');
        });

        test('should reject token not yet valid', () => {
            const now = Math.floor(Date.now() / 1000);
            const payload = {
                sub: 'user-123',
                iss: 'https://auth.webqx.health',
                aud: 'webqx-healthcare-platform',
                exp: now + 3600,
                nbf: now + 3600 // Valid in future
            };
            
            const result = tokenValidator.validateTokenClaims(payload);
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('TOKEN_NOT_YET_VALID');
        });

        test('should reject token issued in future', () => {
            const now = Math.floor(Date.now() / 1000);
            const payload = {
                sub: 'user-123',
                iss: 'https://auth.webqx.health',
                aud: 'webqx-healthcare-platform',
                exp: now + 3600,
                iat: now + 3600 // Issued in future
            };
            
            const result = tokenValidator.validateTokenClaims(payload);
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('TOKEN_ISSUED_IN_FUTURE');
        });

        test('should handle clock tolerance', () => {
            const now = Math.floor(Date.now() / 1000);
            const payload = {
                sub: 'user-123',
                iss: 'https://auth.webqx.health',
                aud: 'webqx-healthcare-platform',
                exp: now - 30, // Expired 30 seconds ago (within tolerance)
                iat: now - 3600
            };
            
            const result = tokenValidator.validateTokenClaims(payload);
            expect(result.valid).toBe(true); // Should pass due to clock tolerance
        });
    });

    describe('User Information Extraction', () => {
        test('should extract standard user information', () => {
            const payload = {
                sub: 'user-123',
                email: 'user@example.com',
                name: 'Test User',
                roles: ['patient', 'provider'],
                permissions: ['read:patient', 'write:patient'],
                groups: ['group1', 'group2'],
                patient_id: 'patient-456'
            };
            
            const userInfo = tokenValidator.extractUserInfo(payload);
            
            expect(userInfo.userId).toBe('user-123');
            expect(userInfo.email).toBe('user@example.com');
            expect(userInfo.name).toBe('Test User');
            expect(userInfo.roles).toEqual(['patient', 'provider']);
            expect(userInfo.permissions).toEqual(['read:patient', 'write:patient']);
            expect(userInfo.patientId).toBe('patient-456');
        });

        test('should use default values for missing claims', () => {
            const payload = {
                sub: 'user-123'
            };
            
            const userInfo = tokenValidator.extractUserInfo(payload);
            
            expect(userInfo.userId).toBe('user-123');
            expect(userInfo.roles).toEqual(['patient']); // Default roles
            expect(userInfo.permissions).toEqual([]);
        });

        test('should extract custom claims', () => {
            const payload = {
                sub: 'user-123',
                email: 'user@example.com',
                custom_claim: 'custom_value',
                organization_id: 'org-123'
            };
            
            const userInfo = tokenValidator.extractUserInfo(payload);
            
            expect(userInfo.customClaims.custom_claim).toBe('custom_value');
            expect(userInfo.customClaims.organization_id).toBe('org-123');
            expect(userInfo.customClaims.email).toBeUndefined(); // Standard claims not in custom
        });
    });

    describe('Mock Token Validation', () => {
        test('should validate mock tokens in development', async () => {
            const mockToken = jwt.sign({ sub: 'mock-user' }, 'mock-secret');
            
            const result = tokenValidator.validateMockToken(mockToken);
            
            expect(result.valid).toBe(true);
            expect(result.mockToken).toBe(true);
            expect(result.payload.sub).toBe('mock-user');
        });

        test('should handle invalid mock tokens', () => {
            const result = tokenValidator.validateMockToken('invalid-mock-token');
            
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('INVALID_MOCK_TOKEN');
        });
    });

    describe('Caching Functionality', () => {
        test('should cache validated tokens', async () => {
            const result = await tokenValidator.validateAccessToken(validToken);
            
            expect(result.valid).toBe(true);
            expect(tokenValidator.validatedTokenCache.size).toBe(1);
        });

        test('should return cached results', async () => {
            await tokenValidator.validateAccessToken(validToken);
            const cachedResult = tokenValidator.getValidatedTokenFromCache(validToken);
            
            expect(cachedResult).toBeDefined();
            expect(cachedResult.valid).toBe(true);
        });

        test('should clear expired cache entries', async () => {
            await tokenValidator.validateAccessToken(validToken);
            
            // Manually expire the cache entry
            const cached = tokenValidator.validatedTokenCache.get(validToken);
            cached.expiresAt = Date.now() - 1000; // Expired
            
            const result = tokenValidator.getValidatedTokenFromCache(validToken);
            expect(result).toBeNull();
            expect(tokenValidator.validatedTokenCache.has(validToken)).toBe(false);
        });

        test('should clear all caches', async () => {
            await tokenValidator.validateAccessToken(validToken);
            tokenValidator.jwksCache.set('test-key', 'test-value');
            
            expect(tokenValidator.validatedTokenCache.size).toBeGreaterThan(0);
            expect(tokenValidator.jwksCache.size).toBeGreaterThan(0);
            
            tokenValidator.clearCache();
            
            expect(tokenValidator.validatedTokenCache.size).toBe(0);
            expect(tokenValidator.jwksCache.size).toBe(0);
        });
    });

    describe('Public Key Management', () => {
        test('should handle missing key ID', async () => {
            const key = await tokenValidator.getPublicKey(null, 'RS256');
            expect(key).toBe('mock-public-key'); // In mock mode
        });

        test('should cache public keys', async () => {
            const keyId = 'test-key-id';
            const algorithm = 'RS256';
            
            const key1 = await tokenValidator.getPublicKey(keyId, algorithm);
            const key2 = await tokenValidator.getPublicKey(keyId, algorithm);
            
            expect(key1).toBe(key2);
            expect(tokenValidator.jwksCache.size).toBeGreaterThan(0);
        });
    });

    describe('Statistics and Monitoring', () => {
        test('should provide validation statistics', () => {
            const stats = tokenValidator.getValidationStats();
            
            expect(stats).toBeDefined();
            expect(stats.cachedTokens).toBeDefined();
            expect(stats.cachedKeys).toBeDefined();
            expect(stats.config).toBeDefined();
            expect(stats.config.cacheEnabled).toBe(true);
            expect(stats.config.mockMode).toBe(true);
        });
    });

    describe('Error Handling', () => {
        test('should handle validation errors gracefully', async () => {
            // Force an error by corrupting the validator
            const originalConfig = tokenValidator.config;
            tokenValidator.config = null;
            
            const result = await tokenValidator.validateAccessToken(validToken);
            
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('VALIDATION_ERROR');
            
            // Restore config
            tokenValidator.config = originalConfig;
        });

        test('should handle JWKS fetch errors', async () => {
            // Disable mock mode to trigger real JWKS fetch
            updateConfig({
                development: { enableMockMode: false, skipSignatureVerification: false }
            });
            tokenValidator = new TokenValidator();
            
            const key = await tokenValidator.getPublicKey('test-key', 'RS256');
            expect(key).toBe('demo-public-key'); // Fallback value
        });
    });
});