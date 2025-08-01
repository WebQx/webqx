/**
 * OAuth2 RBAC Tests
 * Tests for Role-Based Access Control functionality
 */

const RBACManager = require('../rbac');
const { updateConfig } = require('../config');

describe('OAuth2 RBAC Manager', () => {
    let rbacManager;
    let testUser;

    beforeEach(() => {
        process.env.NODE_ENV = 'test';
        
        updateConfig({
            rbac: {
                enabled: true,
                defaultRoles: ['patient'],
                roleHierarchy: {
                    'super_admin': ['admin', 'provider', 'patient'],
                    'admin': ['provider', 'patient'],
                    'provider': ['patient'],
                    'patient': []
                }
            }
        });
        
        rbacManager = new RBACManager();
        
        testUser = {
            userId: 'user-123',
            email: 'test@webqx.health',
            name: 'Test User',
            roles: ['patient', 'provider'],
            permissions: ['patient:read', 'patient:write', 'observation:read'],
            groups: ['group1'],
            patientId: 'patient-123',
            organizationId: 'org-123'
        };
    });

    afterEach(() => {
        rbacManager.clearCache();
    });

    describe('Permission Checking', () => {
        test('should grant access for direct permission', () => {
            const result = rbacManager.hasPermission(testUser, 'patient:read');
            
            expect(result.authorized).toBe(true);
            expect(result.reason).toBe('Direct permission granted');
            expect(result.matchedPermission).toBe('patient:read');
        });

        test('should deny access for missing permission', () => {
            const result = rbacManager.hasPermission(testUser, 'admin:write');
            
            expect(result.authorized).toBe(false);
            expect(result.reason).toBe('Permission denied');
            expect(result.errorCode).toBe('PERMISSION_DENIED');
        });

        test('should grant access via role-based permissions', () => {
            const userWithoutDirectPermissions = {
                ...testUser,
                permissions: [],
                roles: ['provider']
            };
            
            const result = rbacManager.hasPermission(userWithoutDirectPermissions, 'patient:read');
            
            expect(result.authorized).toBe(true);
            expect(result.reason).toBe('Role-based permission granted');
        });

        test('should handle wildcard permissions', () => {
            const adminUser = {
                ...testUser,
                permissions: ['patient:*']
            };
            
            const result = rbacManager.hasPermission(adminUser, 'patient:delete');
            
            expect(result.authorized).toBe(true);
            expect(result.reason).toBe('Resource wildcard permission');
            expect(result.matchedPermission).toBe('patient:*');
        });

        test('should handle global wildcard permissions', () => {
            const superUser = {
                ...testUser,
                permissions: ['*']
            };
            
            const result = rbacManager.hasPermission(superUser, 'anything:anywhere');
            
            expect(result.authorized).toBe(true);
            expect(result.reason).toBe('Global wildcard permission');
            expect(result.matchedPermission).toBe('*');
        });

        test('should check resource-specific permissions', () => {
            const context = { patientId: 'patient-123' };
            
            const result = rbacManager.hasPermission(testUser, 'patient:read', context);
            
            expect(result.authorized).toBe(true);
            // Should match direct permission first, but resource context is available
        });

        test('should grant access to own patient data', () => {
            const patientUser = {
                ...testUser,
                roles: ['patient'],
                permissions: [],
                patientId: 'patient-456'
            };
            
            const context = { patientId: 'patient-456' };
            const result = rbacManager.hasPermission(patientUser, 'patient:read', context);
            
            expect(result.authorized).toBe(true);
            expect(result.reason).toBe('Own patient data access');
        });

        test('should handle missing user info', () => {
            const result = rbacManager.hasPermission(null, 'patient:read');
            
            expect(result.authorized).toBe(false);
            expect(result.errorCode).toBe('NO_USER_INFO');
        });

        test('should allow access when RBAC is disabled', () => {
            updateConfig({ rbac: { enabled: false } });
            rbacManager = new RBACManager();
            
            const result = rbacManager.hasPermission(testUser, 'any:permission');
            
            expect(result.authorized).toBe(true);
            expect(result.reason).toBe('RBAC disabled');
        });
    });

    describe('Role Checking', () => {
        test('should grant access for direct role match', () => {
            const result = rbacManager.hasRole(testUser, ['provider']);
            
            expect(result.authorized).toBe(true);
            expect(result.reason).toBe('Direct role match');
            expect(result.matchedRoles).toContain('provider');
        });

        test('should grant access for multiple role options', () => {
            const result = rbacManager.hasRole(testUser, ['admin', 'provider']);
            
            expect(result.authorized).toBe(true);
            expect(result.matchedRoles).toContain('provider');
        });

        test('should deny access for missing roles', () => {
            const result = rbacManager.hasRole(testUser, ['admin']);
            
            expect(result.authorized).toBe(false);
            expect(result.errorCode).toBe('ROLE_NOT_FOUND');
        });

        test('should check role hierarchy', () => {
            const adminUser = {
                ...testUser,
                roles: ['admin']
            };
            
            const result = rbacManager.hasRole(adminUser, ['provider']);
            
            expect(result.authorized).toBe(true);
            expect(result.reason).toBe('Role hierarchy match');
            expect(result.userRole).toBe('admin');
            expect(result.matchedRoles).toContain('provider');
        });

        test('should handle string role input', () => {
            const result = rbacManager.hasRole(testUser, 'patient');
            
            expect(result.authorized).toBe(true);
            expect(result.matchedRoles).toContain('patient');
        });

        test('should use default roles when user has none', () => {
            const userWithoutRoles = {
                ...testUser,
                roles: undefined
            };
            
            const result = rbacManager.hasRole(userWithoutRoles, ['patient']);
            
            expect(result.authorized).toBe(true);
            expect(result.matchedRoles).toContain('patient');
        });
    });

    describe('Multiple Permission Checking', () => {
        test('should require all permissions when specified', () => {
            const result = rbacManager.hasAllPermissions(testUser, [
                'patient:read',
                'patient:write'
            ]);
            
            expect(result.authorized).toBe(true);
            expect(result.reason).toBe('All permissions granted');
        });

        test('should deny when missing any required permission', () => {
            const result = rbacManager.hasAllPermissions(testUser, [
                'patient:read',
                'admin:write'
            ]);
            
            expect(result.authorized).toBe(false);
            expect(result.errorCode).toBe('MISSING_PERMISSION');
            expect(result.failedPermission).toBe('admin:write');
        });

        test('should grant access when any permission matches', () => {
            const result = rbacManager.hasAnyPermission(testUser, [
                'admin:write',
                'patient:read'
            ]);
            
            expect(result.authorized).toBe(true);
            expect(result.matchedPermission).toBe('patient:read');
        });

        test('should deny when no permissions match', () => {
            const result = rbacManager.hasAnyPermission(testUser, [
                'admin:write',
                'super:admin'
            ]);
            
            expect(result.authorized).toBe(false);
            expect(result.errorCode).toBe('NO_MATCHING_PERMISSIONS');
        });
    });

    describe('User Permission Retrieval', () => {
        test('should get all user permissions', () => {
            const permissions = rbacManager.getUserPermissions(testUser);
            
            expect(permissions).toContain('patient:read');
            expect(permissions).toContain('patient:write');
            expect(permissions).toContain('observation:read');
            expect(permissions.length).toBeGreaterThan(3); // Should include role-based permissions
        });

        test('should handle user without permissions', () => {
            const userWithoutPermissions = {
                ...testUser,
                permissions: [],
                roles: ['patient']
            };
            
            const permissions = rbacManager.getUserPermissions(userWithoutPermissions);
            
            expect(permissions).toContain('patient:read'); // From role
            expect(permissions.length).toBeGreaterThan(0);
        });

        test('should return empty array for null user', () => {
            const permissions = rbacManager.getUserPermissions(null);
            expect(permissions).toEqual([]);
        });
    });

    describe('Role and Permission Normalization', () => {
        test('should normalize string roles to array', () => {
            const normalized = rbacManager.normalizeRoles('admin');
            expect(normalized).toEqual(['admin']);
        });

        test('should keep array roles as array', () => {
            const normalized = rbacManager.normalizeRoles(['admin', 'provider']);
            expect(normalized).toEqual(['admin', 'provider']);
        });

        test('should use default roles for null/undefined', () => {
            const normalized = rbacManager.normalizeRoles(null);
            expect(normalized).toEqual(['patient']);
        });

        test('should normalize permissions similarly', () => {
            const normalized = rbacManager.normalizePermissions('read:patient');
            expect(normalized).toEqual(['read:patient']);
        });
    });

    describe('Context-Based Authorization', () => {
        test('should authorize group-based access', () => {
            const context = { groupId: 'group1' };
            const userWithoutDirectPermission = {
                ...testUser,
                permissions: [],
                roles: []
            };
            
            const result = rbacManager.hasPermission(
                userWithoutDirectPermission,
                'restricted:action',
                context
            );
            
            expect(result.authorized).toBe(true);
            expect(result.reason).toBe('Group-based access');
        });

        test('should authorize organization-based access', () => {
            const context = { organizationId: 'org-123' };
            const userWithoutDirectPermission = {
                ...testUser,
                permissions: [],
                roles: []
            };
            
            const result = rbacManager.hasPermission(
                userWithoutDirectPermission,
                'org:action',
                context
            );
            
            expect(result.authorized).toBe(true);
            expect(result.reason).toBe('Organization-based access');
        });

        test('should deny access for wrong organization', () => {
            const context = { organizationId: 'different-org' };
            const userWithoutDirectPermission = {
                ...testUser,
                permissions: [],
                roles: [],
                organizationId: 'org-123'
            };
            
            const result = rbacManager.hasPermission(
                userWithoutDirectPermission,
                'org:action',
                context
            );
            
            expect(result.authorized).toBe(false);
        });
    });

    describe('Caching', () => {
        test('should cache permission results', () => {
            const permission = 'patient:read';
            
            const result1 = rbacManager.hasPermission(testUser, permission);
            const result2 = rbacManager.hasPermission(testUser, permission);
            
            expect(result1.authorized).toBe(true);
            expect(result2.authorized).toBe(true);
            expect(rbacManager.permissionCache.size).toBeGreaterThan(0);
        });

        test('should generate consistent cache keys', () => {
            const key1 = rbacManager.generatePermissionCacheKey(testUser, 'patient:read', {});
            const key2 = rbacManager.generatePermissionCacheKey(testUser, 'patient:read', {});
            
            expect(key1).toBe(key2);
        });

        test('should generate different cache keys for different contexts', () => {
            const key1 = rbacManager.generatePermissionCacheKey(testUser, 'patient:read', {});
            const key2 = rbacManager.generatePermissionCacheKey(testUser, 'patient:read', { patientId: '123' });
            
            expect(key1).not.toBe(key2);
        });

        test('should clear cache', () => {
            rbacManager.hasPermission(testUser, 'patient:read');
            expect(rbacManager.permissionCache.size).toBeGreaterThan(0);
            
            rbacManager.clearCache();
            expect(rbacManager.permissionCache.size).toBe(0);
        });
    });

    describe('User Context Validation', () => {
        test('should validate user context', () => {
            const context = {
                ipAddress: '192.168.1.1',
                userAgent: 'Mozilla/5.0',
                sessionId: 'session-123',
                requestCount: 10
            };
            
            const result = rbacManager.validateUserContext(testUser, context);
            
            expect(result.valid).toBe(true);
            expect(result.security.ipAddress).toBe('192.168.1.1');
        });

        test('should detect suspicious activity', () => {
            const context = {
                requestCount: 150 // High request count
            };
            
            const result = rbacManager.validateUserContext(testUser, context);
            
            expect(result.valid).toBe(false);
            expect(result.warnings).toContain('High request count detected');
        });

        test('should detect invalid session', () => {
            const context = {
                sessionId: '' // Invalid session
            };
            
            const result = rbacManager.validateUserContext(testUser, context);
            
            expect(result.valid).toBe(false);
            expect(result.warnings).toContain('Invalid session detected');
        });
    });

    describe('Statistics and Monitoring', () => {
        test('should provide RBAC statistics', () => {
            const stats = rbacManager.getRBACStats();
            
            expect(stats).toBeDefined();
            expect(stats.enabled).toBe(true);
            expect(stats.cachedPermissions).toBeDefined();
            expect(stats.roleHierarchy).toBeGreaterThan(0);
            expect(stats.defaultRoles).toEqual(['patient']);
        });
    });

    describe('Error Handling', () => {
        test('should handle permission check errors gracefully', () => {
            // Force an error by corrupting the manager
            const originalConfig = rbacManager.config;
            rbacManager.config = null;
            
            const result = rbacManager.hasPermission(testUser, 'patient:read');
            
            expect(result.authorized).toBe(false);
            expect(result.errorCode).toBe('RBAC_ERROR');
            
            // Restore config
            rbacManager.config = originalConfig;
        });

        test('should handle role check errors gracefully', () => {
            const originalConfig = rbacManager.config;
            rbacManager.config = null;
            
            const result = rbacManager.hasRole(testUser, ['provider']);
            
            expect(result.authorized).toBe(false);
            expect(result.errorCode).toBe('RBAC_ERROR');
            
            rbacManager.config = originalConfig;
        });
    });

    describe('Role Hierarchy', () => {
        test('should correctly implement role hierarchy', () => {
            const superAdminUser = {
                ...testUser,
                roles: ['super_admin']
            };
            
            // Super admin should have access to all lower roles
            expect(rbacManager.hasRole(superAdminUser, ['admin']).authorized).toBe(true);
            expect(rbacManager.hasRole(superAdminUser, ['provider']).authorized).toBe(true);
            expect(rbacManager.hasRole(superAdminUser, ['patient']).authorized).toBe(true);
        });

        test('should not grant upward role access', () => {
            const patientUser = {
                ...testUser,
                roles: ['patient']
            };
            
            // Patient should not have access to higher roles
            expect(rbacManager.hasRole(patientUser, ['provider']).authorized).toBe(false);
            expect(rbacManager.hasRole(patientUser, ['admin']).authorized).toBe(false);
        });
    });
});