/**
 * Enhanced Role-Based Access Control (RBAC)
 * Integrates with SSO providers and manages healthcare-specific permissions
 */

const { getRBACConfig, getRolePermissions } = require('../sso-config');
const auditLogger = require('../audit/audit-logger');

/**
 * RBAC Manager Class
 */
class RBACManager {
    constructor() {
        this.config = getRBACConfig();
        this.roleHierarchy = this.buildRoleHierarchy();
        this.permissionCache = new Map();
        this.resourcePermissions = this.initializeResourcePermissions();
    }

    /**
     * Build role hierarchy
     * @returns {Object} Role hierarchy mapping
     */
    buildRoleHierarchy() {
        return {
            'admin': ['physician', 'nurse', 'staff', 'pharmacist', 'technician', 'patient'],
            'physician': ['nurse', 'technician', 'patient'],
            'nurse': ['patient'],
            'staff': ['patient'],
            'pharmacist': ['patient'],
            'technician': [],
            'patient': []
        };
    }

    /**
     * Initialize resource-specific permissions
     * @returns {Object} Resource permissions mapping
     */
    initializeResourcePermissions() {
        return {
            // Patient data access
            'Patient': {
                'read': ['admin', 'physician', 'nurse', 'staff', 'pharmacist', 'technician'],
                'write': ['admin', 'physician', 'nurse'],
                'delete': ['admin'],
                'read-own': ['patient'],
                'write-own': ['patient']
            },
            
            // Appointment management
            'Appointment': {
                'read': ['admin', 'physician', 'nurse', 'staff'],
                'write': ['admin', 'physician', 'nurse', 'staff'],
                'delete': ['admin', 'physician'],
                'read-own': ['patient'],
                'write-own': ['patient']
            },
            
            // Prescription management
            'Prescription': {
                'read': ['admin', 'physician', 'pharmacist'],
                'write': ['admin', 'physician', 'pharmacist'],
                'delete': ['admin', 'physician'],
                'read-own': ['patient']
            },
            
            // Lab results
            'LabResult': {
                'read': ['admin', 'physician', 'nurse', 'technician'],
                'write': ['admin', 'physician', 'technician'],
                'delete': ['admin'],
                'read-own': ['patient']
            },
            
            // Medical records
            'MedicalRecord': {
                'read': ['admin', 'physician', 'nurse'],
                'write': ['admin', 'physician', 'nurse'],
                'delete': ['admin'],
                'read-own': ['patient']
            },
            
            // Billing information
            'Billing': {
                'read': ['admin', 'staff'],
                'write': ['admin', 'staff'],
                'delete': ['admin'],
                'read-own': ['patient']
            },
            
            // Administrative functions
            'Administration': {
                'read': ['admin'],
                'write': ['admin'],
                'delete': ['admin']
            },
            
            // Audit logs
            'AuditLog': {
                'read': ['admin'],
                'write': ['admin'],
                'delete': ['admin']
            }
        };
    }

    /**
     * Check if user has permission for a resource action
     * @param {Object} user - User object with role information
     * @param {string} resource - Resource name (e.g., 'Patient', 'Appointment')
     * @param {string} action - Action (e.g., 'read', 'write', 'delete')
     * @param {Object} context - Additional context (e.g., resource owner)
     * @returns {Object} Permission check result
     */
    checkPermission(user, resource, action, context = {}) {
        const permissionKey = `${user.id}:${resource}:${action}`;
        
        // Check cache first
        if (this.permissionCache.has(permissionKey)) {
            const cached = this.permissionCache.get(permissionKey);
            if (Date.now() - cached.timestamp < 300000) { // 5 minutes cache
                return cached.result;
            }
        }

        const result = this._checkPermissionInternal(user, resource, action, context);
        
        // Cache result
        this.permissionCache.set(permissionKey, {
            result: result,
            timestamp: Date.now()
        });

        // Audit permission check
        auditLogger.logInfo('permission_check', {
            userId: user.id,
            userRole: user.role,
            resource: resource,
            action: action,
            granted: result.granted,
            reason: result.reason,
            context: context,
            timestamp: new Date().toISOString()
        });

        return result;
    }

    /**
     * Internal permission check logic
     * @param {Object} user - User object
     * @param {string} resource - Resource name
     * @param {string} action - Action
     * @param {Object} context - Context
     * @returns {Object} Permission result
     */
    _checkPermissionInternal(user, resource, action, context) {
        // Super admin has all permissions
        if (user.role === 'admin' && user.roles?.includes('superadmin')) {
            return { granted: true, reason: 'Super admin access' };
        }

        // Check resource permissions
        const resourcePerms = this.resourcePermissions[resource];
        if (!resourcePerms) {
            return { granted: false, reason: `Unknown resource: ${resource}` };
        }

        const actionPerms = resourcePerms[action];
        if (!actionPerms) {
            return { granted: false, reason: `Unknown action: ${action} for resource: ${resource}` };
        }

        // Check if user's role has permission
        if (actionPerms.includes(user.role)) {
            return { granted: true, reason: `Role ${user.role} has ${action} permission on ${resource}` };
        }

        // Check inherited roles
        const inheritedRoles = this.getInheritedRoles(user.role);
        for (const inheritedRole of inheritedRoles) {
            if (actionPerms.includes(inheritedRole)) {
                return { 
                    granted: true, 
                    reason: `Role ${user.role} inherits ${action} permission on ${resource} from ${inheritedRole}` 
                };
            }
        }

        // Check for "own" resource access
        if (action.endsWith('-own') && context.resourceOwnerId === user.id) {
            const baseAction = action.replace('-own', '');
            const ownActionPerms = resourcePerms[action];
            if (ownActionPerms && ownActionPerms.includes(user.role)) {
                return { 
                    granted: true, 
                    reason: `User has ${action} permission on own ${resource}` 
                };
            }
        }

        // Check specialty-specific permissions
        if (user.specialty && this.checkSpecialtyPermission(user, resource, action, context)) {
            return { 
                granted: true, 
                reason: `Specialty-specific permission: ${user.specialty}` 
            };
        }

        // Check time-based permissions
        if (this.checkTimeBasedPermission(user, resource, action, context)) {
            return { 
                granted: true, 
                reason: 'Time-based permission granted' 
            };
        }

        return { 
            granted: false, 
            reason: `Role ${user.role} does not have ${action} permission on ${resource}` 
        };
    }

    /**
     * Get inherited roles for a role
     * @param {string} role - User role
     * @returns {Array} Inherited roles
     */
    getInheritedRoles(role) {
        return this.roleHierarchy[role] || [];
    }

    /**
     * Check specialty-specific permissions
     * @param {Object} user - User object
     * @param {string} resource - Resource name
     * @param {string} action - Action
     * @param {Object} context - Context
     * @returns {boolean} Has specialty permission
     */
    checkSpecialtyPermission(user, resource, action, context) {
        // Healthcare specialty-specific rules
        const specialtyRules = {
            'radiology': {
                'ImagingStudy': ['read', 'write'],
                'DiagnosticReport': ['read', 'write']
            },
            'cardiology': {
                'ECG': ['read', 'write'],
                'EchocardiogramReport': ['read', 'write']
            },
            'pharmacy': {
                'Medication': ['read', 'write'],
                'Prescription': ['read', 'write', 'dispense']
            },
            'lab': {
                'LabResult': ['read', 'write'],
                'Specimen': ['read', 'write']
            }
        };

        const specialtyRule = specialtyRules[user.specialty];
        if (specialtyRule && specialtyRule[resource]) {
            return specialtyRule[resource].includes(action);
        }

        return false;
    }

    /**
     * Check time-based permissions (e.g., emergency access)
     * @param {Object} user - User object
     * @param {string} resource - Resource name
     * @param {string} action - Action
     * @param {Object} context - Context
     * @returns {boolean} Has time-based permission
     */
    checkTimeBasedPermission(user, resource, action, context) {
        // Emergency access during off-hours
        if (context.emergency && user.role === 'physician') {
            const now = new Date();
            const hour = now.getHours();
            
            // Allow emergency access between 6 PM and 6 AM
            if (hour >= 18 || hour <= 6) {
                auditLogger.logInfo('emergency_access_granted', {
                    userId: user.id,
                    resource: resource,
                    action: action,
                    hour: hour,
                    timestamp: new Date().toISOString()
                });
                return true;
            }
        }

        return false;
    }

    /**
     * Get user's effective permissions
     * @param {Object} user - User object
     * @returns {Object} Effective permissions
     */
    getEffectivePermissions(user) {
        const permissions = {
            role: user.role,
            inheritedRoles: this.getInheritedRoles(user.role),
            resources: {}
        };

        // Calculate permissions for each resource
        for (const [resource, actions] of Object.entries(this.resourcePermissions)) {
            permissions.resources[resource] = {};
            
            for (const action of Object.keys(actions)) {
                const result = this._checkPermissionInternal(user, resource, action, {});
                permissions.resources[resource][action] = result.granted;
            }
        }

        return permissions;
    }

    /**
     * Map external roles to internal roles
     * @param {Array} externalRoles - Roles from identity provider
     * @param {string} provider - Identity provider name
     * @returns {Object} Mapped roles result
     */
    mapExternalRoles(externalRoles, provider) {
        const mappedRoles = [];
        const unmappedRoles = [];

        // Provider-specific role mapping
        const providerMappings = {
            'azureAd': {
                'Healthcare Workers': 'physician',
                'Nurses': 'nurse',
                'Administrative Staff': 'staff',
                'Patients': 'patient',
                'Pharmacists': 'pharmacist',
                'Lab Technicians': 'technician',
                'System Administrators': 'admin'
            },
            'okta': {
                'healthcare-physicians': 'physician',
                'healthcare-nurses': 'nurse',
                'healthcare-staff': 'staff',
                'healthcare-patients': 'patient',
                'healthcare-pharmacy': 'pharmacist',
                'healthcare-lab': 'technician',
                'healthcare-admin': 'admin'
            },
            'oneLogin': {
                'Physicians': 'physician',
                'Nursing Staff': 'nurse',
                'Support Staff': 'staff',
                'Patient Users': 'patient',
                'Pharmacy Staff': 'pharmacist',
                'Laboratory Staff': 'technician',
                'Administrators': 'admin'
            }
        };

        const mapping = providerMappings[provider] || {};

        for (const externalRole of externalRoles) {
            const internalRole = mapping[externalRole];
            if (internalRole) {
                mappedRoles.push(internalRole);
            } else {
                // Try generic mapping from config
                const genericMapping = this.config.roleMapping;
                for (const [internal, externals] of Object.entries(genericMapping)) {
                    if (externals.includes(externalRole.toLowerCase())) {
                        mappedRoles.push(internal);
                        break;
                    }
                }
                
                if (!mappedRoles.includes(externalRole)) {
                    unmappedRoles.push(externalRole);
                }
            }
        }

        // Default role if no mappings found
        if (mappedRoles.length === 0) {
            mappedRoles.push(this.config.defaultRole);
        }

        // Remove duplicates and get primary role
        const uniqueRoles = [...new Set(mappedRoles)];
        const primaryRole = this.getPrimaryRole(uniqueRoles);

        auditLogger.logInfo('role_mapping_completed', {
            provider: provider,
            externalRoles: externalRoles,
            mappedRoles: uniqueRoles,
            primaryRole: primaryRole,
            unmappedRoles: unmappedRoles,
            timestamp: new Date().toISOString()
        });

        return {
            primaryRole: primaryRole,
            allRoles: uniqueRoles,
            unmappedRoles: unmappedRoles
        };
    }

    /**
     * Get primary role from a list of roles
     * @param {Array} roles - List of roles
     * @returns {string} Primary role
     */
    getPrimaryRole(roles) {
        // Role priority order (highest to lowest)
        const rolePriority = [
            'admin',
            'physician',
            'nurse',
            'pharmacist',
            'technician',
            'staff',
            'patient'
        ];

        for (const role of rolePriority) {
            if (roles.includes(role)) {
                return role;
            }
        }

        return this.config.defaultRole;
    }

    /**
     * Create role assignment
     * @param {string} userId - User ID
     * @param {string} role - Role to assign
     * @param {Object} assignedBy - User assigning the role
     * @param {Object} context - Assignment context
     * @returns {Object} Assignment result
     */
    createRoleAssignment(userId, role, assignedBy, context = {}) {
        // Validate role
        if (!this.config.permissions[role]) {
            return { success: false, reason: `Invalid role: ${role}` };
        }

        // Check if assigner has permission to assign this role
        const canAssign = this.checkPermission(assignedBy, 'Administration', 'write');
        if (!canAssign.granted) {
            return { success: false, reason: 'Insufficient permissions to assign roles' };
        }

        // Role assignment logic would go here
        // In a real system, this would update the database

        auditLogger.logSuccess('role_assigned', {
            userId: userId,
            role: role,
            assignedBy: assignedBy.id,
            context: context,
            timestamp: new Date().toISOString()
        });

        return { success: true, role: role };
    }

    /**
     * Get role statistics
     * @returns {Object} Role statistics
     */
    getRoleStats() {
        // This would typically query the database
        // For demo purposes, we'll return mock data
        return {
            totalUsers: 1250,
            roleDistribution: {
                'patient': 1000,
                'physician': 75,
                'nurse': 100,
                'staff': 50,
                'pharmacist': 15,
                'technician': 8,
                'admin': 2
            },
            specialtyDistribution: {
                'primary-care': 25,
                'cardiology': 12,
                'radiology': 8,
                'psychiatry': 10,
                'pharmacy': 15,
                'lab': 8
            },
            recentAssignments: 15,
            pendingReviews: 3
        };
    }

    /**
     * Clear permission cache
     * @param {string} userId - User ID (optional, clears all if not provided)
     */
    clearPermissionCache(userId = null) {
        if (userId) {
            // Clear cache for specific user
            for (const key of this.permissionCache.keys()) {
                if (key.startsWith(`${userId}:`)) {
                    this.permissionCache.delete(key);
                }
            }
        } else {
            // Clear all cache
            this.permissionCache.clear();
        }

        auditLogger.logInfo('permission_cache_cleared', {
            userId: userId || 'all',
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Validate FHIR scopes against RBAC permissions
     * @param {Object} user - User object
     * @param {Array} requestedScopes - FHIR scopes requested
     * @returns {Object} Scope validation result
     */
    validateFHIRScopes(user, requestedScopes) {
        const validScopes = [];
        const invalidScopes = [];

        for (const scope of requestedScopes) {
            if (this.isValidFHIRScope(user, scope)) {
                validScopes.push(scope);
            } else {
                invalidScopes.push(scope);
            }
        }

        return {
            validScopes: validScopes,
            invalidScopes: invalidScopes,
            allValid: invalidScopes.length === 0
        };
    }

    /**
     * Check if FHIR scope is valid for user
     * @param {Object} user - User object
     * @param {string} scope - FHIR scope (e.g., 'patient/*.read')
     * @returns {boolean} Is scope valid
     */
    isValidFHIRScope(user, scope) {
        const [context, permission] = scope.split('/');
        const [resource, action] = permission.split('.');

        // Map FHIR context to our resources
        const resourceMap = {
            'patient': 'Patient',
            'user': 'MedicalRecord'
        };

        const mappedResource = resourceMap[context] || resource;
        const result = this._checkPermissionInternal(user, mappedResource, action, {});
        
        return result.granted;
    }
}

// Create singleton instance
const rbacManager = new RBACManager();

module.exports = rbacManager;