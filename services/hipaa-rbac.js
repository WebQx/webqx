/**
 * HIPAA Role-Based Access Control (RBAC) Service
 * 
 * Implements healthcare-specific role hierarchy and permissions for PACS system.
 * Ensures only authorized personnel can access sensitive patient data.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

/**
 * Healthcare roles hierarchy (highest to lowest privilege)
 */
const HEALTHCARE_ROLES = {
    SUPER_ADMIN: {
        level: 100,
        name: 'Super Administrator',
        description: 'Full system access including configuration and user management'
    },
    ADMIN: {
        level: 90,
        name: 'Administrator',
        description: 'Administrative access to system management'
    },
    SECURITY_OFFICER: {
        level: 85,
        name: 'Security Officer',
        description: 'HIPAA security oversight and audit access'
    },
    RADIOLOGIST: {
        level: 80,
        name: 'Radiologist',
        description: 'Full radiology and PACS access'
    },
    PHYSICIAN: {
        level: 70,
        name: 'Physician',
        description: 'Full patient care access'
    },
    NURSE_PRACTITIONER: {
        level: 65,
        name: 'Nurse Practitioner',
        description: 'Advanced nursing practice access'
    },
    NURSE: {
        level: 60,
        name: 'Registered Nurse',
        description: 'Nursing care and limited patient access'
    },
    TECHNICIAN: {
        level: 50,
        name: 'Medical Technician',
        description: 'Technical procedures and equipment access'
    },
    RADIOLOGY_TECH: {
        level: 45,
        name: 'Radiology Technician',
        description: 'PACS imaging and basic metadata access'
    },
    RECEPTIONIST: {
        level: 30,
        name: 'Receptionist',
        description: 'Scheduling and basic patient information'
    },
    PATIENT: {
        level: 10,
        name: 'Patient',
        description: 'Access to own medical records only'
    }
};

/**
 * Granular permissions for healthcare operations
 */
const PERMISSIONS = {
    // Patient data permissions
    'patient.read': 'View patient information',
    'patient.write': 'Modify patient information',
    'patient.create': 'Create new patient records',
    'patient.delete': 'Delete patient records',
    
    // PACS and imaging permissions
    'pacs.view_images': 'View medical images',
    'pacs.view_metadata': 'View DICOM metadata',
    'pacs.modify_metadata': 'Modify DICOM metadata',
    'pacs.upload_images': 'Upload medical images',
    'pacs.delete_images': 'Delete medical images',
    'pacs.export_images': 'Export medical images',
    'pacs.share_studies': 'Share imaging studies',
    
    // Clinical permissions
    'clinical.read_notes': 'Read clinical notes',
    'clinical.write_notes': 'Write clinical notes',
    'clinical.prescribe': 'Prescribe medications',
    'clinical.order_tests': 'Order medical tests',
    'clinical.view_results': 'View test results',
    
    // Administrative permissions
    'admin.manage_users': 'Manage user accounts',
    'admin.manage_roles': 'Manage user roles',
    'admin.system_config': 'Configure system settings',
    'admin.view_audit_logs': 'View audit logs',
    'admin.export_data': 'Export system data',
    
    // Security permissions
    'security.emergency_access': 'Emergency break-glass access',
    'security.audit_review': 'Review security audit logs',
    'security.compliance_reports': 'Generate compliance reports'
};

/**
 * Role-permission mapping
 */
const ROLE_PERMISSIONS = {
    SUPER_ADMIN: Object.keys(PERMISSIONS),
    
    ADMIN: [
        'patient.read', 'patient.write', 'patient.create',
        'pacs.view_images', 'pacs.view_metadata', 'pacs.modify_metadata',
        'clinical.read_notes', 'clinical.write_notes', 'clinical.view_results',
        'admin.manage_users', 'admin.manage_roles', 'admin.view_audit_logs'
    ],
    
    SECURITY_OFFICER: [
        'admin.view_audit_logs', 'security.audit_review', 'security.compliance_reports',
        'patient.read', 'pacs.view_metadata'
    ],
    
    RADIOLOGIST: [
        'patient.read', 'patient.write',
        'pacs.view_images', 'pacs.view_metadata', 'pacs.modify_metadata',
        'pacs.upload_images', 'pacs.export_images', 'pacs.share_studies',
        'clinical.read_notes', 'clinical.write_notes', 'clinical.view_results'
    ],
    
    PHYSICIAN: [
        'patient.read', 'patient.write',
        'pacs.view_images', 'pacs.view_metadata', 'pacs.share_studies',
        'clinical.read_notes', 'clinical.write_notes', 'clinical.prescribe',
        'clinical.order_tests', 'clinical.view_results'
    ],
    
    NURSE_PRACTITIONER: [
        'patient.read', 'patient.write',
        'pacs.view_images', 'pacs.view_metadata',
        'clinical.read_notes', 'clinical.write_notes', 'clinical.prescribe',
        'clinical.order_tests', 'clinical.view_results'
    ],
    
    NURSE: [
        'patient.read', 'patient.write',
        'pacs.view_metadata',
        'clinical.read_notes', 'clinical.write_notes', 'clinical.view_results'
    ],
    
    TECHNICIAN: [
        'patient.read',
        'pacs.view_metadata',
        'clinical.view_results'
    ],
    
    RADIOLOGY_TECH: [
        'patient.read',
        'pacs.view_images', 'pacs.view_metadata', 'pacs.upload_images'
    ],
    
    RECEPTIONIST: [
        'patient.read', 'patient.create'
    ],
    
    PATIENT: [
        'patient.read' // Limited to own records via ownership check
    ]
};

/**
 * HIPAA RBAC Service
 */
class HIPAA_RBAC {
    constructor(auditLogger = null) {
        this.auditLogger = auditLogger;
        this.emergencyAccessActive = new Map(); // Track emergency access sessions
    }

    /**
     * Check if user has permission for specific action
     * @param {string} userId - User ID
     * @param {string} userRole - User role
     * @param {string} permission - Permission to check
     * @param {Object} resource - Resource being accessed
     * @returns {Promise<Object>} Permission check result
     */
    async checkPermission(userId, userRole, permission, resource = {}) {
        try {
            // Validate role exists
            if (!HEALTHCARE_ROLES[userRole]) {
                await this.logSecurityEvent({
                    userId,
                    action: 'INVALID_ROLE_ACCESS',
                    details: { role: userRole, permission },
                    success: false
                });
                
                return {
                    granted: false,
                    reason: 'Invalid role',
                    code: 'INVALID_ROLE'
                };
            }

            // Check if role has the permission
            const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
            const hasBasePermission = rolePermissions.includes(permission);

            if (!hasBasePermission) {
                await this.logSecurityEvent({
                    userId,
                    action: 'PERMISSION_DENIED',
                    details: { role: userRole, permission, resource: resource.id },
                    success: false
                });

                return {
                    granted: false,
                    reason: 'Insufficient permissions',
                    code: 'INSUFFICIENT_PERMISSIONS'
                };
            }

            // Additional ownership checks for patient-specific data
            if (permission.startsWith('patient.') && resource.patientId) {
                const ownershipCheck = await this.checkResourceOwnership(
                    userId, 
                    userRole, 
                    resource
                );
                
                if (!ownershipCheck.granted) {
                    return ownershipCheck;
                }
            }

            // Log successful access
            await this.logSecurityEvent({
                userId,
                action: 'PERMISSION_GRANTED',
                details: { role: userRole, permission, resource: resource.id },
                success: true
            });

            return {
                granted: true,
                role: userRole,
                permission: permission
            };

        } catch (error) {
            console.error('Permission check failed:', error);
            return {
                granted: false,
                reason: 'Permission check failed',
                code: 'SYSTEM_ERROR'
            };
        }
    }

    /**
     * Check resource ownership for patient-specific access
     * @param {string} userId - User ID
     * @param {string} userRole - User role
     * @param {Object} resource - Resource being accessed
     * @returns {Promise<Object>} Ownership check result
     */
    async checkResourceOwnership(userId, userRole, resource) {
        // Patients can only access their own records
        if (userRole === 'PATIENT') {
            if (resource.patientId !== userId) {
                await this.logSecurityEvent({
                    userId,
                    action: 'UNAUTHORIZED_PATIENT_ACCESS',
                    details: { 
                        requestedPatientId: resource.patientId,
                        userPatientId: userId
                    },
                    success: false
                });

                return {
                    granted: false,
                    reason: 'Cannot access other patient records',
                    code: 'UNAUTHORIZED_PATIENT_ACCESS'
                };
            }
        }

        return { granted: true };
    }

    /**
     * Request emergency access (break-glass)
     * @param {string} userId - User requesting access
     * @param {string} userRole - User role
     * @param {string} reason - Emergency reason
     * @param {Object} resource - Resource needing access
     * @returns {Promise<Object>} Emergency access result
     */
    async requestEmergencyAccess(userId, userRole, reason, resource) {
        try {
            // Only certain roles can request emergency access
            const emergencyRoles = ['PHYSICIAN', 'NURSE', 'RADIOLOGIST', 'NURSE_PRACTITIONER'];
            
            if (!emergencyRoles.includes(userRole)) {
                await this.logSecurityEvent({
                    userId,
                    action: 'EMERGENCY_ACCESS_DENIED',
                    details: { reason: 'Role not authorized for emergency access', userRole },
                    success: false
                });

                return {
                    granted: false,
                    reason: 'Role not authorized for emergency access',
                    code: 'EMERGENCY_ACCESS_DENIED'
                };
            }

            // Generate emergency access session
            const sessionId = this.generateEmergencySessionId();
            const expiryTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

            this.emergencyAccessActive.set(sessionId, {
                userId,
                userRole,
                reason,
                resource,
                startTime: new Date(),
                expiryTime,
                active: true
            });

            // Log emergency access grant
            await this.logSecurityEvent({
                userId,
                action: 'EMERGENCY_ACCESS_GRANTED',
                details: { 
                    sessionId, 
                    reason, 
                    resource: resource.id,
                    expiryTime: expiryTime.toISOString()
                },
                success: true
            });

            return {
                granted: true,
                sessionId: sessionId,
                expiryTime: expiryTime,
                permissions: ['patient.read', 'patient.write', 'pacs.view_images', 'pacs.view_metadata'],
                reason: reason
            };

        } catch (error) {
            console.error('Emergency access request failed:', error);
            return {
                granted: false,
                reason: 'Emergency access request failed',
                code: 'SYSTEM_ERROR'
            };
        }
    }

    /**
     * Validate emergency access session
     * @param {string} sessionId - Emergency session ID
     * @returns {Object} Session validation result
     */
    validateEmergencySession(sessionId) {
        const session = this.emergencyAccessActive.get(sessionId);
        
        if (!session) {
            return {
                valid: false,
                reason: 'Session not found'
            };
        }

        if (new Date() > session.expiryTime) {
            this.emergencyAccessActive.delete(sessionId);
            return {
                valid: false,
                reason: 'Session expired'
            };
        }

        return {
            valid: true,
            session: session
        };
    }

    /**
     * Revoke emergency access session
     * @param {string} sessionId - Session to revoke
     * @param {string} revokedBy - User revoking access
     * @returns {Promise<Object>} Revocation result
     */
    async revokeEmergencyAccess(sessionId, revokedBy) {
        const session = this.emergencyAccessActive.get(sessionId);
        
        if (!session) {
            return {
                success: false,
                reason: 'Session not found'
            };
        }

        this.emergencyAccessActive.delete(sessionId);

        await this.logSecurityEvent({
            userId: revokedBy,
            action: 'EMERGENCY_ACCESS_REVOKED',
            details: { 
                sessionId, 
                originalUser: session.userId,
                reason: 'Manually revoked'
            },
            success: true
        });

        return {
            success: true,
            sessionId: sessionId
        };
    }

    /**
     * Get user permissions based on role
     * @param {string} userRole - User role
     * @returns {Array} List of permissions
     */
    getUserPermissions(userRole) {
        return ROLE_PERMISSIONS[userRole] || [];
    }

    /**
     * Get role hierarchy level
     * @param {string} userRole - User role
     * @returns {number} Role level (higher = more privileged)
     */
    getRoleLevel(userRole) {
        return HEALTHCARE_ROLES[userRole]?.level || 0;
    }

    /**
     * Check if role can assign another role
     * @param {string} assignerRole - Role doing the assignment
     * @param {string} targetRole - Role being assigned
     * @returns {boolean} Whether assignment is allowed
     */
    canAssignRole(assignerRole, targetRole) {
        const assignerLevel = this.getRoleLevel(assignerRole);
        const targetLevel = this.getRoleLevel(targetRole);
        
        // Can only assign roles with lower or equal privilege
        return assignerLevel >= targetLevel;
    }

    /**
     * Generate unique emergency session ID
     * @returns {string} Session ID
     */
    generateEmergencySessionId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `emergency_${timestamp}_${random}`;
    }

    /**
     * Log security event to audit system
     * @param {Object} event - Security event details
     */
    async logSecurityEvent(event) {
        if (this.auditLogger) {
            await this.auditLogger.log({
                action: event.action,
                resourceType: 'security',
                resourceId: event.details?.resource || 'system',
                success: event.success,
                context: {
                    securityEvent: true,
                    details: event.details
                }
            });
        }
    }

    /**
     * Get all available roles
     * @returns {Object} Healthcare roles
     */
    static getRoles() {
        return HEALTHCARE_ROLES;
    }

    /**
     * Get all available permissions
     * @returns {Object} Permissions
     */
    static getPermissions() {
        return PERMISSIONS;
    }

    /**
     * Get role-permission mapping
     * @returns {Object} Role permissions
     */
    static getRolePermissions() {
        return ROLE_PERMISSIONS;
    }
}

module.exports = {
    HIPAA_RBAC,
    HEALTHCARE_ROLES,
    PERMISSIONS,
    ROLE_PERMISSIONS
};