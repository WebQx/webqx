/**
 * Role-Based Access Control (RBAC) for OAuth2
 * Handles authorization using claims from OAuth2 tokens
 */

const { getConfig } = require('./config');

/**
 * RBAC Manager class for handling role-based access control
 */
class RBACManager {
    constructor() {
        this.config = getConfig();
        // Permission cache for performance
        this.permissionCache = new Map();
    }

    /**
     * Check if user has required permission
     * @param {Object} userInfo - User information from token
     * @param {string} permission - Required permission
     * @param {Object} context - Additional context (e.g., resource ID)
     * @returns {Object} Authorization result
     */
    hasPermission(userInfo, permission, context = {}) {
        try {
            if (!this.config.rbac.enabled) {
                // RBAC disabled, allow all
                return {
                    authorized: true,
                    reason: 'RBAC disabled'
                };
            }

            if (!userInfo) {
                return {
                    authorized: false,
                    reason: 'No user information provided',
                    errorCode: 'NO_USER_INFO'
                };
            }

            // Check permission cache
            const cacheKey = this.generatePermissionCacheKey(userInfo, permission, context);
            const cached = this.permissionCache.get(cacheKey);
            if (cached && Date.now() < cached.expiresAt) {
                return cached.result;
            }

            // Extract user roles and permissions
            const userRoles = this.normalizeRoles(userInfo.roles);
            const userPermissions = this.normalizePermissions(userInfo.permissions);

            // Check direct permission
            if (this.hasDirectPermission(userPermissions, permission)) {
                const result = {
                    authorized: true,
                    reason: 'Direct permission granted',
                    matchedPermission: permission
                };
                this.cachePermissionResult(cacheKey, result);
                return result;
            }

            // Check role-based permissions
            const rolePermissions = this.getRolePermissions(userRoles);
            if (this.hasDirectPermission(rolePermissions, permission)) {
                const result = {
                    authorized: true,
                    reason: 'Role-based permission granted',
                    matchedRoles: userRoles,
                    matchedPermission: permission
                };
                this.cachePermissionResult(cacheKey, result);
                return result;
            }

            // Check wildcard permissions
            const wildcardResult = this.checkWildcardPermissions(userPermissions.concat(rolePermissions), permission);
            if (wildcardResult.authorized) {
                this.cachePermissionResult(cacheKey, wildcardResult);
                return wildcardResult;
            }

            // Check resource-specific permissions
            if (context.resourceId || context.patientId) {
                const resourceResult = this.checkResourcePermissions(userInfo, permission, context);
                if (resourceResult.authorized) {
                    this.cachePermissionResult(cacheKey, resourceResult);
                    return resourceResult;
                }
            }

            // Permission denied
            const result = {
                authorized: false,
                reason: 'Permission denied',
                errorCode: 'PERMISSION_DENIED',
                requiredPermission: permission,
                userRoles,
                userPermissions
            };

            this.cachePermissionResult(cacheKey, result);
            return result;

        } catch (error) {
            console.error('RBAC permission check error:', error);
            return {
                authorized: false,
                reason: 'RBAC error',
                errorCode: 'RBAC_ERROR',
                details: error.message
            };
        }
    }

    /**
     * Check if user has any of the required roles
     * @param {Object} userInfo - User information from token
     * @param {Array<string>} requiredRoles - Required roles
     * @returns {Object} Authorization result
     */
    hasRole(userInfo, requiredRoles) {
        try {
            if (!this.config.rbac.enabled) {
                return {
                    authorized: true,
                    reason: 'RBAC disabled'
                };
            }

            if (!userInfo) {
                return {
                    authorized: false,
                    reason: 'No user information provided',
                    errorCode: 'NO_USER_INFO'
                };
            }

            const userRoles = this.normalizeRoles(userInfo.roles);
            const normalizedRequiredRoles = this.normalizeRoles(requiredRoles);

            // Check direct role match
            const matchedRoles = userRoles.filter(role => 
                normalizedRequiredRoles.includes(role)
            );

            if (matchedRoles.length > 0) {
                return {
                    authorized: true,
                    reason: 'Direct role match',
                    matchedRoles
                };
            }

            // Check role hierarchy
            const hierarchyMatch = this.checkRoleHierarchy(userRoles, normalizedRequiredRoles);
            if (hierarchyMatch.authorized) {
                return hierarchyMatch;
            }

            return {
                authorized: false,
                reason: 'Role not found',
                errorCode: 'ROLE_NOT_FOUND',
                requiredRoles: normalizedRequiredRoles,
                userRoles
            };

        } catch (error) {
            console.error('RBAC role check error:', error);
            return {
                authorized: false,
                reason: 'RBAC error',
                errorCode: 'RBAC_ERROR',
                details: error.message
            };
        }
    }

    /**
     * Check multiple permissions (all must be satisfied)
     * @param {Object} userInfo - User information from token
     * @param {Array<string>} permissions - Required permissions
     * @param {Object} context - Additional context
     * @returns {Object} Authorization result
     */
    hasAllPermissions(userInfo, permissions, context = {}) {
        const results = permissions.map(permission => 
            this.hasPermission(userInfo, permission, context)
        );

        const unauthorized = results.find(result => !result.authorized);
        if (unauthorized) {
            return {
                authorized: false,
                reason: 'Missing required permission',
                errorCode: 'MISSING_PERMISSION',
                failedPermission: unauthorized.requiredPermission,
                details: unauthorized
            };
        }

        return {
            authorized: true,
            reason: 'All permissions granted',
            checkedPermissions: permissions
        };
    }

    /**
     * Check multiple permissions (any can be satisfied)
     * @param {Object} userInfo - User information from token
     * @param {Array<string>} permissions - Required permissions (any)
     * @param {Object} context - Additional context
     * @returns {Object} Authorization result
     */
    hasAnyPermission(userInfo, permissions, context = {}) {
        for (const permission of permissions) {
            const result = this.hasPermission(userInfo, permission, context);
            if (result.authorized) {
                return {
                    authorized: true,
                    reason: 'Permission granted',
                    matchedPermission: permission,
                    details: result
                };
            }
        }

        return {
            authorized: false,
            reason: 'No matching permissions',
            errorCode: 'NO_MATCHING_PERMISSIONS',
            requiredPermissions: permissions
        };
    }

    /**
     * Get all permissions for a user
     * @param {Object} userInfo - User information from token
     * @returns {Array<string>} All user permissions
     */
    getUserPermissions(userInfo) {
        if (!userInfo) return [];

        const userRoles = this.normalizeRoles(userInfo.roles);
        const userPermissions = this.normalizePermissions(userInfo.permissions);
        const rolePermissions = this.getRolePermissions(userRoles);

        // Combine and deduplicate permissions
        const allPermissions = [...new Set([...userPermissions, ...rolePermissions])];
        
        return allPermissions.sort();
    }

    /**
     * Normalize roles to array format
     * @param {string|Array<string>} roles - Roles to normalize
     * @returns {Array<string>} Normalized roles array
     */
    normalizeRoles(roles) {
        if (!roles) return this.config.rbac.defaultRoles;
        if (typeof roles === 'string') return [roles];
        if (Array.isArray(roles)) return roles;
        return [];
    }

    /**
     * Normalize permissions to array format
     * @param {string|Array<string>} permissions - Permissions to normalize
     * @returns {Array<string>} Normalized permissions array
     */
    normalizePermissions(permissions) {
        if (!permissions) return [];
        if (typeof permissions === 'string') return [permissions];
        if (Array.isArray(permissions)) return permissions;
        return [];
    }

    /**
     * Check if user has direct permission
     * @param {Array<string>} userPermissions - User permissions
     * @param {string} requiredPermission - Required permission
     * @returns {boolean} True if permission found
     */
    hasDirectPermission(userPermissions, requiredPermission) {
        return userPermissions.includes(requiredPermission);
    }

    /**
     * Get permissions for roles
     * @param {Array<string>} roles - User roles
     * @returns {Array<string>} Role-based permissions
     */
    getRolePermissions(roles) {
        // In a real implementation, this would query a database or configuration
        // For demo purposes, we'll use hardcoded role mappings
        const rolePermissionMap = {
            'super_admin': [
                'patient:*', 'user:*', 'admin:*', 'system:*'
            ],
            'admin': [
                'patient:read', 'patient:write', 'user:read', 'user:write',
                'appointment:read', 'appointment:write', 'observation:read', 'observation:write',
                'admin:read', 'admin:write'
            ],
            'provider': [
                'patient:read', 'patient:write', 'appointment:read', 'appointment:write',
                'observation:read', 'observation:write', 'user:read'
            ],
            'patient': [
                'patient:read', 'appointment:read', 'observation:read'
            ],
            'guest': [
                'patient:read'
            ]
        };

        const permissions = [];
        roles.forEach(role => {
            if (rolePermissionMap[role]) {
                permissions.push(...rolePermissionMap[role]);
            }
        });

        return [...new Set(permissions)]; // Remove duplicates
    }

    /**
     * Check wildcard permissions
     * @param {Array<string>} permissions - User permissions
     * @param {string} requiredPermission - Required permission
     * @returns {Object} Authorization result
     */
    checkWildcardPermissions(permissions, requiredPermission) {
        // Check for exact wildcard match
        if (permissions.includes('*')) {
            return {
                authorized: true,
                reason: 'Global wildcard permission',
                matchedPermission: '*'
            };
        }

        // Check for resource-specific wildcards
        const [resource, action] = requiredPermission.split(':');
        const resourceWildcard = `${resource}:*`;
        
        if (permissions.includes(resourceWildcard)) {
            return {
                authorized: true,
                reason: 'Resource wildcard permission',
                matchedPermission: resourceWildcard
            };
        }

        // Check for action-specific wildcards
        const actionWildcard = `*:${action}`;
        if (permissions.includes(actionWildcard)) {
            return {
                authorized: true,
                reason: 'Action wildcard permission',
                matchedPermission: actionWildcard
            };
        }

        return {
            authorized: false,
            reason: 'No wildcard permissions match'
        };
    }

    /**
     * Check resource-specific permissions
     * @param {Object} userInfo - User information
     * @param {string} permission - Required permission
     * @param {Object} context - Resource context
     * @returns {Object} Authorization result
     */
    checkResourcePermissions(userInfo, permission, context) {
        // Check if user can access their own patient data
        if (context.patientId && userInfo.patientId === context.patientId) {
            return {
                authorized: true,
                reason: 'Own patient data access',
                resourceId: context.patientId
            };
        }

        // Check group-based access
        if (context.groupId && userInfo.groups && userInfo.groups.includes(context.groupId)) {
            return {
                authorized: true,
                reason: 'Group-based access',
                groupId: context.groupId
            };
        }

        // Check organization-based access
        if (context.organizationId && userInfo.organizationId === context.organizationId) {
            return {
                authorized: true,
                reason: 'Organization-based access',
                organizationId: context.organizationId
            };
        }

        return {
            authorized: false,
            reason: 'No resource-specific permissions'
        };
    }

    /**
     * Check role hierarchy
     * @param {Array<string>} userRoles - User roles
     * @param {Array<string>} requiredRoles - Required roles
     * @returns {Object} Authorization result
     */
    checkRoleHierarchy(userRoles, requiredRoles) {
        const hierarchy = this.config.rbac.roleHierarchy;

        for (const userRole of userRoles) {
            if (hierarchy[userRole]) {
                const inheritedRoles = hierarchy[userRole];
                const matchedRoles = requiredRoles.filter(role => 
                    inheritedRoles.includes(role)
                );

                if (matchedRoles.length > 0) {
                    return {
                        authorized: true,
                        reason: 'Role hierarchy match',
                        userRole,
                        matchedRoles,
                        inheritedRoles
                    };
                }
            }
        }

        return {
            authorized: false,
            reason: 'No role hierarchy match'
        };
    }

    /**
     * Generate cache key for permission check
     * @param {Object} userInfo - User information
     * @param {string} permission - Permission
     * @param {Object} context - Context
     * @returns {string} Cache key
     */
    generatePermissionCacheKey(userInfo, permission, context) {
        const userId = userInfo.userId || userInfo.sub;
        const contextKey = Object.keys(context).length > 0 ? 
            JSON.stringify(context) : 'no-context';
        return `${userId}:${permission}:${contextKey}`;
    }

    /**
     * Cache permission result
     * @param {string} cacheKey - Cache key
     * @param {Object} result - Permission result
     */
    cachePermissionResult(cacheKey, result) {
        const cacheEntry = {
            result,
            expiresAt: Date.now() + 300000 // 5 minutes
        };
        
        this.permissionCache.set(cacheKey, cacheEntry);
        
        // Cleanup old entries
        setTimeout(() => {
            this.permissionCache.delete(cacheKey);
        }, 300000);
    }

    /**
     * Clear permission cache
     */
    clearCache() {
        this.permissionCache.clear();
    }

    /**
     * Get RBAC statistics
     * @returns {Object} RBAC statistics
     */
    getRBACStats() {
        return {
            enabled: this.config.rbac.enabled,
            cachedPermissions: this.permissionCache.size,
            roleHierarchy: Object.keys(this.config.rbac.roleHierarchy).length,
            defaultRoles: this.config.rbac.defaultRoles
        };
    }

    /**
     * Validate user context for security
     * @param {Object} userInfo - User information
     * @param {Object} context - Request context
     * @returns {Object} Validation result
     */
    validateUserContext(userInfo, context) {
        const security = {
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
            sessionId: context.sessionId
        };

        // Basic security checks
        const warnings = [];

        // Check for suspicious activity patterns
        if (context.requestCount && context.requestCount > 100) {
            warnings.push('High request count detected');
        }

        // Check session validity
        if (context.sessionId && !this.isValidSession(context.sessionId)) {
            warnings.push('Invalid session detected');
        }

        return {
            valid: warnings.length === 0,
            warnings,
            security
        };
    }

    /**
     * Check if session is valid (placeholder implementation)
     * @param {string} sessionId - Session ID
     * @returns {boolean} True if valid
     */
    isValidSession(sessionId) {
        // In real implementation, check against session store
        return sessionId && sessionId.length > 0;
    }
}

module.exports = RBACManager;