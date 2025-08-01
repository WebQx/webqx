/**
 * OAuth2 Configuration Tests
 * Tests for OAuth2 configuration management
 */

const { getConfig, validateConfig, updateConfig, oauth2Config } = require('../config');

describe('OAuth2 Configuration', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('Configuration Loading', () => {
        test('should load default configuration', () => {
            const config = getConfig();
            
            expect(config).toBeDefined();
            expect(config.idp).toBeDefined();
            expect(config.client).toBeDefined();
            expect(config.token).toBeDefined();
            expect(config.rbac).toBeDefined();
            expect(config.security).toBeDefined();
        });

        test('should use environment variables when available', () => {
            process.env.OAUTH2_CLIENT_ID = 'test-client-id';
            process.env.OAUTH2_ISSUER = 'https://test-issuer.com';
            
            // Need to reload module to pick up env changes
            jest.resetModules();
            const { getConfig } = require('../config');
            const config = getConfig();
            
            expect(config.client.clientId).toBe('test-client-id');
            expect(config.idp.issuer).toBe('https://test-issuer.com');
        });

        test('should use default values when env vars not set', () => {
            const config = getConfig();
            
            expect(config.client.clientId).toBe('webqx-healthcare-platform');
            expect(config.client.scope).toContain('openid');
            expect(config.rbac.enabled).toBe(true);
        });
    });

    describe('Configuration Validation', () => {
        test('should validate valid configuration', () => {
            const validation = validateConfig();
            expect(validation.valid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        test('should fail validation for invalid URLs', () => {
            process.env.OAUTH2_ISSUER = 'invalid-url';
            
            jest.resetModules();
            const { validateConfig } = require('../config');
            const validation = validateConfig();
            
            expect(validation.valid).toBe(false);
            expect(validation.errors).toContain('Invalid URL format for idp.issuer: invalid-url');
        });

        test('should require client secret in production', () => {
            process.env.NODE_ENV = 'production';
            process.env.OAUTH2_CLIENT_SECRET = '';
            
            jest.resetModules();
            const { validateConfig } = require('../config');
            const validation = validateConfig();
            
            expect(validation.valid).toBe(false);
            expect(validation.errors).toContain('OAUTH2_CLIENT_SECRET is required in production');
        });
    });

    describe('Configuration Updates', () => {
        test('should allow updates in development', () => {
            process.env.NODE_ENV = 'development';
            
            jest.resetModules();
            const { updateConfig, getConfig } = require('../config');
            
            updateConfig({
                client: { clientId: 'updated-client-id' }
            });
            
            const config = getConfig();
            expect(config.client.clientId).toBe('updated-client-id');
        });

        test('should prevent updates in production', () => {
            process.env.NODE_ENV = 'production';
            
            jest.resetModules();
            const { updateConfig } = require('../config');
            
            expect(() => {
                updateConfig({ client: { clientId: 'new-id' } });
            }).toThrow('Configuration updates only allowed in development/test environments');
        });
    });

    describe('RBAC Configuration', () => {
        test('should have proper claim mappings', () => {
            const config = getConfig();
            
            expect(config.rbac.claimMappings.roles).toBe('roles');
            expect(config.rbac.claimMappings.permissions).toBe('permissions');
            expect(config.rbac.claimMappings.userId).toBe('sub');
        });

        test('should have role hierarchy defined', () => {
            const config = getConfig();
            
            expect(config.rbac.roleHierarchy).toBeDefined();
            expect(config.rbac.roleHierarchy.super_admin).toContain('admin');
            expect(config.rbac.roleHierarchy.admin).toContain('provider');
            expect(config.rbac.roleHierarchy.provider).toContain('patient');
        });

        test('should allow disabling RBAC', () => {
            process.env.OAUTH2_RBAC_ENABLED = 'false';
            
            jest.resetModules();
            const { getConfig } = require('../config');
            const config = getConfig();
            
            expect(config.rbac.enabled).toBe(false);
        });
    });

    describe('Security Configuration', () => {
        test('should have secure defaults', () => {
            const config = getConfig();
            
            expect(config.security.allowedAlgorithms).toContain('RS256');
            expect(config.security.pkceEnabled).toBe(true);
            expect(config.security.stateValidation).toBe(true);
            expect(config.security.nonceValidation).toBe(true);
        });

        test('should allow configuring allowed algorithms', () => {
            process.env.OAUTH2_ALLOWED_ALGORITHMS = 'RS256,ES256';
            
            jest.resetModules();
            const { getConfig } = require('../config');
            const config = getConfig();
            
            expect(config.security.allowedAlgorithms).toEqual(['RS256', 'ES256']);
        });
    });

    describe('Development Configuration', () => {
        test('should have development mode disabled by default', () => {
            const config = getConfig();
            
            expect(config.development.enableMockMode).toBe(false);
            expect(config.development.skipSignatureVerification).toBe(false);
        });

        test('should enable mock mode in development when configured', () => {
            process.env.NODE_ENV = 'development';
            process.env.OAUTH2_MOCK_MODE = 'true';
            
            jest.resetModules();
            const { getConfig } = require('../config');
            const config = getConfig();
            
            expect(config.development.enableMockMode).toBe(true);
        });

        test('should have mock user claims for testing', () => {
            const config = getConfig();
            
            expect(config.development.mockUserClaims).toBeDefined();
            expect(config.development.mockUserClaims.sub).toBeDefined();
            expect(config.development.mockUserClaims.roles).toContain('patient');
        });
    });

    describe('Token Configuration', () => {
        test('should have proper token defaults', () => {
            const config = getConfig();
            
            expect(config.token.validateAudience).toBe(true);
            expect(config.token.validateIssuer).toBe(true);
            expect(config.token.clockTolerance).toBe(60);
            expect(config.token.enableRefresh).toBe(true);
        });

        test('should allow disabling token validation', () => {
            process.env.OAUTH2_VALIDATE_AUDIENCE = 'false';
            process.env.OAUTH2_VALIDATE_ISSUER = 'false';
            
            jest.resetModules();
            const { getConfig } = require('../config');
            const config = getConfig();
            
            expect(config.token.validateAudience).toBe(false);
            expect(config.token.validateIssuer).toBe(false);
        });
    });
});