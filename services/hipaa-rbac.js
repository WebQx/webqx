/**
 * HIPAA-Compliant Role-Based Access Control (RBAC) Service
 * 
 * Provides comprehensive access control for healthcare data and operations:
 * - Role-based permissions
 * - Resource-level access control
 * - Patient data access controls
 * - Audit trail for all access decisions
 * - Permission review workflows
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

const crypto = require('crypto');

/**
 * System roles with hierarchical permissions
 */
const SYSTEM_ROLES = {
    SUPER_ADMIN: {
        name: 'Super Administrator',
        level: 100,
        permissions: ['*'], // All permissions
        description: 'Full system access - only for system administrators',
        inherits: []
    },
    ADMIN: {
        name: 'Administrator',
        level: 90,
        permissions: [
            'admin.*',
            'user.manage',
            'role.manage',
            'audit.view',
            'system.configure',
            'patient.read',
            'patient.write',
            'appointment.read',
            'appointment.write',
            'report.generate'
        ],
        description: 'Administrative access to system management',
        inherits: ['DOCTOR', 'NURSE']
    },
    DOCTOR: {
        name: 'Doctor',
        level: 80,
        permissions: [
            'patient.read',
            'patient.write',
            'patient.diagnose',
            'appointment.read',
            'appointment.write',
            'prescription.write',
            'lab.order',
            'imaging.order',
            'medical_record.read',
            'medical_record.write',
            'report.medical'
        ],
        description: 'Medical practitioner with full patient care access',
        inherits: []
    },
    NURSE: {
        name: 'Nurse',
        level: 70,
        permissions: [
            'patient.read',
            'patient.update_vitals',
            'appointment.read',
            'appointment.schedule',
            'medication.administer',
            'medical_record.read',
            'medical_record.update_nursing'
        ],
        description: 'Nursing staff with patient care access',
        inherits: []
    },
    TECHNICIAN: {
        name: 'Technician',
        level: 60,
        permissions: [
            'patient.read_basic',
            'lab.perform',
            'imaging.perform',
            'equipment.operate',
            'result.upload'
        ],
        description: 'Technical staff for lab and imaging services',
        inherits: []
    },
    RECEPTIONIST: {
        name: 'Receptionist',
        level: 50,
        permissions: [
            'patient.read_basic',
            'patient.register',
            'appointment.read',
            'appointment.schedule',
            'appointment.cancel',
            'insurance.verify',
            'billing.basic'
        ],
        description: 'Front desk staff for patient scheduling and registration',
        inherits: []
    },
    PATIENT: {
        name: 'Patient',
        level: 30,
        permissions: [
            'patient.read_own',
            'appointment.read_own',
            'appointment.schedule_own',
            'medical_record.read_own',
            'prescription.read_own',
            'lab.read_own',
            'billing.read_own'
        ],
        description: 'Patient access to own health information',
        inherits: []
    },
    GUEST: {
        name: 'Guest',
        level: 10,
        permissions: [
            'public.read',
            'help.access'
        ],
        description: 'Limited guest access',
        inherits: []
    }
};

/**
 * Resource types and their required permissions
 */
const RESOURCE_PERMISSIONS = {
    'Patient': {
        read: 'patient.read',
        write: 'patient.write',
        delete: 'patient.delete',
        own_read: 'patient.read_own',
        own_write: 'patient.write_own'
    },
    'Appointment': {
        read: 'appointment.read',
        write: 'appointment.write',
        delete: 'appointment.delete',
        own_read: 'appointment.read_own',
        own_write: 'appointment.write_own'
    },
    'MedicalRecord': {
        read: 'medical_record.read',
        write: 'medical_record.write',
        delete: 'medical_record.delete',
        own_read: 'medical_record.read_own'
    },
    'Prescription': {
        read: 'prescription.read',
        write: 'prescription.write',
        own_read: 'prescription.read_own'
    },
    'Lab': {
        read: 'lab.read',
        order: 'lab.order',
        perform: 'lab.perform',
        own_read: 'lab.read_own'
    },
    'Imaging': {
        read: 'imaging.read',
        order: 'imaging.order',
        perform: 'imaging.perform',
        own_read: 'imaging.read_own'
    }
};

/**
 * Special contexts that require elevated permissions
 */
const ELEVATED_CONTEXTS = {
    'emergency': {
        description: 'Emergency access to patient data',
        duration: 60, // minutes
        permissions: ['patient.read', 'medical_record.read', 'prescription.read'],
        requiresJustification: true,
        autoAudit: true
    },
    'break_glass': {
        description: 'Break glass access for critical situations',
        duration: 30, // minutes
        permissions: ['patient.read', 'medical_record.read'],
        requiresJustification: true,
        autoAudit: true,
        requiresApproval: true
    }
};

/**
 * HIPAA-Compliant RBAC Service
 */
class HIPAARBACService {
    constructor() {
        this.userRoles = new Map(); // userId -> roleAssignments
        this.rolePermissions = new Map(); // Custom role definitions
        this.resourceOwnership = new Map(); // resourceId -> ownerId
        this.accessRequests = new Map(); // requestId -> accessRequest
        this.elevatedSessions = new Map(); // sessionId -> elevatedAccess
        this.auditLog = [];
        
        // Initialize system roles
        this.initializeSystemRoles();
    }

    /**
     * Assign role to user
     * @param {string} userId User ID
     * @param {string} roleId Role ID
     * @param {Object} options Assignment options
     * @returns {Promise<Object>} Assignment result
     */
    async assignRole(userId, roleId, options = {}) {
        try {
            const { assignedBy, expiresAt, scope, justification } = options;
            
            // Validate role exists
            if (!this.roleExists(roleId)) {
                return {
                    success: false,
                    error: 'ROLE_NOT_FOUND',
                    message: 'Role does not exist'
                };
            }

            // Get current user roles
            const userRoleAssignments = this.userRoles.get(userId) || [];

            // Check if role already assigned
            const existingAssignment = userRoleAssignments.find(assignment => 
                assignment.roleId === roleId && (!assignment.expiresAt || assignment.expiresAt > new Date())
            );

            if (existingAssignment) {
                return {
                    success: false,
                    error: 'ROLE_ALREADY_ASSIGNED',
                    message: 'Role is already assigned to user'
                };
            }

            // Create role assignment
            const assignment = {
                id: this.generateId('role_assignment'),
                userId,
                roleId,
                assignedBy,
                assignedAt: new Date(),
                expiresAt: expiresAt ? new Date(expiresAt) : null,
                scope: scope || 'global',
                justification,
                active: true
            };

            userRoleAssignments.push(assignment);
            this.userRoles.set(userId, userRoleAssignments);

            // Audit log
            this.addAuditEntry({
                action: 'ROLE_ASSIGNED',
                userId,
                roleId,
                assignedBy,
                details: { assignment }
            });

            return {
                success: true,
                message: 'Role assigned successfully',
                assignment
            };

        } catch (error) {
            return {
                success: false,
                error: 'ROLE_ASSIGNMENT_ERROR',
                message: 'Failed to assign role',
                details: error.message
            };
        }
    }

    /**
     * Revoke role from user
     * @param {string} userId User ID
     * @param {string} roleId Role ID
     * @param {Object} options Revocation options
     * @returns {Promise<Object>} Revocation result
     */
    async revokeRole(userId, roleId, options = {}) {
        try {
            const { revokedBy, reason } = options;
            
            const userRoleAssignments = this.userRoles.get(userId) || [];
            const assignmentIndex = userRoleAssignments.findIndex(assignment => 
                assignment.roleId === roleId && assignment.active
            );

            if (assignmentIndex === -1) {
                return {
                    success: false,
                    error: 'ROLE_NOT_ASSIGNED',
                    message: 'Role is not assigned to user'
                };
            }

            // Deactivate assignment
            const assignment = userRoleAssignments[assignmentIndex];
            assignment.active = false;
            assignment.revokedAt = new Date();
            assignment.revokedBy = revokedBy;
            assignment.revocationReason = reason;

            this.userRoles.set(userId, userRoleAssignments);

            // Audit log
            this.addAuditEntry({
                action: 'ROLE_REVOKED',
                userId,
                roleId,
                revokedBy,
                details: { assignment, reason }
            });

            return {
                success: true,
                message: 'Role revoked successfully'
            };

        } catch (error) {
            return {
                success: false,
                error: 'ROLE_REVOCATION_ERROR',
                message: 'Failed to revoke role',
                details: error.message
            };
        }
    }

    /**
     * Check if user has permission for specific action on resource
     * @param {string} userId User ID
     * @param {string} permission Permission to check
     * @param {Object} context Access context
     * @returns {Promise<Object>} Permission check result
     */
    async checkPermission(userId, permission, context = {}) {
        try {
            const { resourceType, resourceId, action, emergency = false } = context;

            // Get user permissions
            const userPermissions = await this.getUserPermissions(userId);

            // Check for wildcard permission
            if (userPermissions.includes('*')) {
                this.addAuditEntry({
                    action: 'PERMISSION_GRANTED',
                    userId,
                    permission,
                    reason: 'WILDCARD_PERMISSION',
                    context
                });
                return {
                    granted: true,
                    reason: 'WILDCARD_PERMISSION'
                };
            }

            // Check direct permission
            if (userPermissions.includes(permission)) {
                this.addAuditEntry({
                    action: 'PERMISSION_GRANTED',
                    userId,
                    permission,
                    reason: 'DIRECT_PERMISSION',
                    context
                });
                return {
                    granted: true,
                    reason: 'DIRECT_PERMISSION'
                };
            }

            // Check resource ownership for 'own' permissions
            if (permission.endsWith('_own') && resourceId) {
                const ownerId = this.resourceOwnership.get(resourceId);
                if (ownerId === userId) {
                    this.addAuditEntry({
                        action: 'PERMISSION_GRANTED',
                        userId,
                        permission,
                        reason: 'RESOURCE_OWNERSHIP',
                        context
                    });
                    return {
                        granted: true,
                        reason: 'RESOURCE_OWNERSHIP'
                    };
                }
            }

            // Check elevated access sessions
            const elevatedAccess = this.checkElevatedAccess(userId, permission);
            if (elevatedAccess.granted) {
                this.addAuditEntry({
                    action: 'PERMISSION_GRANTED',
                    userId,
                    permission,
                    reason: 'ELEVATED_ACCESS',
                    context: { ...context, elevatedSession: elevatedAccess.sessionId }
                });
                return {
                    granted: true,
                    reason: 'ELEVATED_ACCESS',
                    sessionId: elevatedAccess.sessionId
                };
            }

            // Emergency access check
            if (emergency && this.canRequestEmergencyAccess(userId, permission)) {
                return {
                    granted: false,
                    reason: 'PERMISSION_DENIED',
                    canRequestEmergency: true,
                    emergencyOptions: ['emergency', 'break_glass']
                };
            }

            // Permission denied
            this.addAuditEntry({
                action: 'PERMISSION_DENIED',
                userId,
                permission,
                reason: 'INSUFFICIENT_PERMISSIONS',
                context
            });

            return {
                granted: false,
                reason: 'INSUFFICIENT_PERMISSIONS'
            };

        } catch (error) {
            this.addAuditEntry({
                action: 'PERMISSION_CHECK_ERROR',
                userId,
                permission,
                error: error.message,
                context
            });

            return {
                granted: false,
                reason: 'PERMISSION_CHECK_ERROR',
                error: error.message
            };
        }
    }

    /**
     * Request elevated access (emergency/break-glass)
     * @param {string} userId User ID
     * @param {string} context Access context
     * @param {Object} options Request options
     * @returns {Promise<Object>} Request result
     */
    async requestElevatedAccess(userId, context, options = {}) {
        try {
            const { justification, requestedPermissions, approver } = options;

            if (!ELEVATED_CONTEXTS[context]) {
                return {
                    success: false,
                    error: 'INVALID_CONTEXT',
                    message: 'Invalid elevated access context'
                };
            }

            const contextConfig = ELEVATED_CONTEXTS[context];
            const requestId = this.generateId('access_request');

            const accessRequest = {
                id: requestId,
                userId,
                context,
                requestedPermissions: requestedPermissions || contextConfig.permissions,
                justification,
                requestedAt: new Date(),
                expiresAt: new Date(Date.now() + contextConfig.duration * 60 * 1000),
                status: contextConfig.requiresApproval ? 'PENDING_APPROVAL' : 'APPROVED',
                approver,
                autoApproved: !contextConfig.requiresApproval
            };

            this.accessRequests.set(requestId, accessRequest);

            // Auto-approve if no approval required
            if (!contextConfig.requiresApproval) {
                await this.approveElevatedAccess(requestId, 'SYSTEM_AUTO_APPROVED');
            }

            // Audit log
            this.addAuditEntry({
                action: 'ELEVATED_ACCESS_REQUESTED',
                userId,
                context,
                details: { requestId, justification, permissions: accessRequest.requestedPermissions }
            });

            return {
                success: true,
                message: contextConfig.requiresApproval ? 
                    'Elevated access request submitted for approval' : 
                    'Elevated access granted',
                requestId,
                status: accessRequest.status,
                expiresAt: accessRequest.expiresAt
            };

        } catch (error) {
            return {
                success: false,
                error: 'ELEVATED_ACCESS_REQUEST_ERROR',
                message: 'Failed to request elevated access',
                details: error.message
            };
        }
    }

    /**
     * Approve elevated access request
     * @param {string} requestId Request ID
     * @param {string} approvedBy Approver ID
     * @returns {Promise<Object>} Approval result
     */
    async approveElevatedAccess(requestId, approvedBy) {
        try {
            const accessRequest = this.accessRequests.get(requestId);
            if (!accessRequest) {
                return {
                    success: false,
                    error: 'REQUEST_NOT_FOUND',
                    message: 'Access request not found'
                };
            }

            if (accessRequest.status !== 'PENDING_APPROVAL' && accessRequest.status !== 'APPROVED') {
                return {
                    success: false,
                    error: 'INVALID_STATUS',
                    message: 'Access request cannot be approved in current status'
                };
            }

            // Create elevated session
            const sessionId = this.generateId('elevated_session');
            const elevatedSession = {
                id: sessionId,
                userId: accessRequest.userId,
                context: accessRequest.context,
                permissions: accessRequest.requestedPermissions,
                requestId,
                approvedBy,
                approvedAt: new Date(),
                expiresAt: accessRequest.expiresAt,
                active: true
            };

            this.elevatedSessions.set(sessionId, elevatedSession);

            // Update request status
            accessRequest.status = 'APPROVED';
            accessRequest.approvedBy = approvedBy;
            accessRequest.approvedAt = new Date();
            accessRequest.sessionId = sessionId;

            // Audit log
            this.addAuditEntry({
                action: 'ELEVATED_ACCESS_APPROVED',
                userId: accessRequest.userId,
                context: accessRequest.context,
                approvedBy,
                details: { requestId, sessionId, permissions: accessRequest.requestedPermissions }
            });

            return {
                success: true,
                message: 'Elevated access approved and activated',
                sessionId,
                expiresAt: elevatedSession.expiresAt
            };

        } catch (error) {
            return {
                success: false,
                error: 'ELEVATED_ACCESS_APPROVAL_ERROR',
                message: 'Failed to approve elevated access',
                details: error.message
            };
        }
    }

    /**
     * Get user's effective permissions
     * @param {string} userId User ID
     * @returns {Promise<Array>} User permissions
     */
    async getUserPermissions(userId) {
        const permissions = new Set();
        const userRoleAssignments = this.userRoles.get(userId) || [];

        // Get permissions from active role assignments
        for (const assignment of userRoleAssignments) {
            if (!assignment.active || (assignment.expiresAt && assignment.expiresAt <= new Date())) {
                continue;
            }

            const role = this.getRole(assignment.roleId);
            if (role) {
                // Add direct permissions
                role.permissions.forEach(permission => permissions.add(permission));

                // Add inherited permissions
                this.addInheritedPermissions(role, permissions);
            }
        }

        return Array.from(permissions);
    }

    /**
     * Get user's roles
     * @param {string} userId User ID
     * @returns {Promise<Array>} User roles
     */
    async getUserRoles(userId) {
        const userRoleAssignments = this.userRoles.get(userId) || [];
        return userRoleAssignments
            .filter(assignment => assignment.active && (!assignment.expiresAt || assignment.expiresAt > new Date()))
            .map(assignment => ({
                ...assignment,
                role: this.getRole(assignment.roleId)
            }));
    }

    /**
     * Set resource ownership
     * @param {string} resourceId Resource ID
     * @param {string} ownerId Owner ID
     */
    setResourceOwnership(resourceId, ownerId) {
        this.resourceOwnership.set(resourceId, ownerId);
        
        this.addAuditEntry({
            action: 'RESOURCE_OWNERSHIP_SET',
            resourceId,
            ownerId,
            timestamp: new Date()
        });
    }

    /**
     * Generate access report for user
     * @param {string} userId User ID
     * @returns {Promise<Object>} Access report
     */
    async generateAccessReport(userId) {
        try {
            const userRoles = await this.getUserRoles(userId);
            const userPermissions = await this.getUserPermissions(userId);
            const recentAudits = this.auditLog
                .filter(entry => entry.userId === userId)
                .slice(-50)
                .reverse();

            const elevatedSessions = Array.from(this.elevatedSessions.values())
                .filter(session => session.userId === userId);

            return {
                success: true,
                report: {
                    userId,
                    generatedAt: new Date(),
                    roles: userRoles,
                    permissions: userPermissions,
                    recentActivity: recentAudits,
                    elevatedSessions,
                    summary: {
                        totalRoles: userRoles.length,
                        totalPermissions: userPermissions.length,
                        hasElevatedAccess: elevatedSessions.some(s => s.active),
                        lastActivity: recentAudits[0]?.timestamp
                    }
                }
            };

        } catch (error) {
            return {
                success: false,
                error: 'REPORT_GENERATION_ERROR',
                message: 'Failed to generate access report',
                details: error.message
            };
        }
    }

    // ============================================================================
    // Private Helper Methods
    // ============================================================================

    /**
     * Initialize system roles
     */
    initializeSystemRoles() {
        Object.entries(SYSTEM_ROLES).forEach(([roleId, roleConfig]) => {
            this.rolePermissions.set(roleId, roleConfig);
        });
    }

    /**
     * Check if role exists
     * @param {string} roleId Role ID
     * @returns {boolean} Whether role exists
     */
    roleExists(roleId) {
        return this.rolePermissions.has(roleId);
    }

    /**
     * Get role configuration
     * @param {string} roleId Role ID
     * @returns {Object|null} Role configuration
     */
    getRole(roleId) {
        return this.rolePermissions.get(roleId) || null;
    }

    /**
     * Add inherited permissions from role
     * @param {Object} role Role configuration
     * @param {Set} permissions Permissions set to add to
     */
    addInheritedPermissions(role, permissions) {
        if (role.inherits) {
            for (const inheritedRoleId of role.inherits) {
                const inheritedRole = this.getRole(inheritedRoleId);
                if (inheritedRole) {
                    inheritedRole.permissions.forEach(permission => permissions.add(permission));
                    this.addInheritedPermissions(inheritedRole, permissions);
                }
            }
        }
    }

    /**
     * Check elevated access session
     * @param {string} userId User ID
     * @param {string} permission Permission to check
     * @returns {Object} Elevated access check result
     */
    checkElevatedAccess(userId, permission) {
        for (const [sessionId, session] of this.elevatedSessions.entries()) {
            if (session.userId === userId && 
                session.active && 
                session.expiresAt > new Date() &&
                session.permissions.includes(permission)) {
                return {
                    granted: true,
                    sessionId
                };
            }
        }
        return { granted: false };
    }

    /**
     * Check if user can request emergency access
     * @param {string} userId User ID
     * @param {string} permission Permission
     * @returns {boolean} Whether emergency access can be requested
     */
    canRequestEmergencyAccess(userId, permission) {
        // Check if user has minimum role level for emergency access
        const userRoles = this.userRoles.get(userId) || [];
        const maxLevel = Math.max(...userRoles
            .filter(assignment => assignment.active)
            .map(assignment => this.getRole(assignment.roleId)?.level || 0)
        );

        return maxLevel >= 50; // RECEPTIONIST level or higher
    }

    /**
     * Generate unique ID
     * @param {string} prefix ID prefix
     * @returns {string} Unique ID
     */
    generateId(prefix) {
        return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    }

    /**
     * Add audit entry
     * @param {Object} entry Audit entry
     */
    addAuditEntry(entry) {
        this.auditLog.push({
            id: this.generateId('audit'),
            timestamp: new Date(),
            ...entry
        });

        // Keep only last 10000 entries
        if (this.auditLog.length > 10000) {
            this.auditLog = this.auditLog.slice(-10000);
        }
    }
}

module.exports = HIPAARBACService;