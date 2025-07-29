/**
 * Role-Based Access Control (RBAC) Service
 * 
 * Comprehensive RBAC implementation for WebQX healthcare platform
 * with periodic access review, PACS-specific permissions, and
 * HIPAA compliance features.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { EHRApiResponse, EHRApiError } from '../types';

/**
 * System roles with hierarchical permissions
 */
export type SystemRole = 
  | 'super_admin'
  | 'system_admin'
  | 'security_admin'
  | 'radiologist'
  | 'referring_physician'
  | 'technologist'
  | 'nurse'
  | 'patient'
  | 'reviewer'
  | 'transcriptionist'
  | 'guest';

/**
 * Permission categories for healthcare operations
 */
export type PermissionCategory = 
  | 'patient_data'
  | 'pacs_imaging'
  | 'pacs_admin'
  | 'transcription'
  | 'audit_logs'
  | 'system_config'
  | 'user_management'
  | 'security_settings'
  | 'reports'
  | 'backup_restore';

/**
 * Specific permissions within categories
 */
export type Permission = 
  // Patient Data Permissions
  | 'patient.view'
  | 'patient.edit'
  | 'patient.create'
  | 'patient.delete'
  | 'patient.export'
  
  // PACS Imaging Permissions
  | 'pacs.image.view'
  | 'pacs.image.download'
  | 'pacs.image.upload'
  | 'pacs.image.delete'
  | 'pacs.study.access'
  | 'pacs.annotation.create'
  | 'pacs.annotation.edit'
  | 'pacs.annotation.delete'
  | 'pacs.report.generate'
  | 'pacs.share.external'
  
  // PACS Administration
  | 'pacs.config.view'
  | 'pacs.config.edit'
  | 'pacs.backup.create'
  | 'pacs.restore.execute'
  | 'pacs.user.manage'
  
  // Transcription Permissions
  | 'transcription.create'
  | 'transcription.edit'
  | 'transcription.review'
  | 'transcription.approve'
  | 'transcription.multilingual'
  
  // Audit and Security
  | 'audit.view'
  | 'audit.export'
  | 'audit.configure'
  | 'security.assess'
  | 'security.configure'
  
  // System Management
  | 'system.config'
  | 'system.backup'
  | 'system.restore'
  | 'user.create'
  | 'user.edit'
  | 'user.delete'
  | 'user.roles.assign'
  
  // Reporting
  | 'reports.view'
  | 'reports.create'
  | 'reports.export';

/**
 * Access context for permission checking
 */
export interface AccessContext {
  /** User making the request */
  userId: string;
  /** User's role */
  userRole: SystemRole;
  /** IP address */
  ipAddress?: string;
  /** Session ID */
  sessionId?: string;
  /** Resource being accessed */
  resourceId?: string;
  /** Patient MRN (for patient-specific access) */
  patientMrn?: string;
  /** Study UID (for PACS access) */
  studyUID?: string;
  /** Time of access request */
  requestTime: Date;
  /** Justification for access */
  accessJustification?: string;
}

/**
 * Role definition with permissions and constraints
 */
export interface RoleDefinition {
  /** Role identifier */
  role: SystemRole;
  /** Display name */
  displayName: string;
  /** Description of role */
  description: string;
  /** Permissions granted to this role */
  permissions: Permission[];
  /** Parent roles (for inheritance) */
  inheritsFrom?: SystemRole[];
  /** Maximum session duration in minutes */
  maxSessionDuration: number;
  /** Requires periodic access review */
  requiresPeriodicReview: boolean;
  /** Review period in days */
  reviewPeriodDays: number;
  /** IP address restrictions */
  ipRestrictions?: string[];
  /** Time-based access restrictions */
  timeRestrictions?: {
    allowedHours: { start: number; end: number }[];
    allowedDays: number[]; // 0-6 (Sunday-Saturday)
  };
  /** Emergency access permissions */
  emergencyPermissions?: Permission[];
}

/**
 * User role assignment with metadata
 */
export interface UserRoleAssignment {
  /** User ID */
  userId: string;
  /** Assigned role */
  role: SystemRole;
  /** Assignment date */
  assignedDate: Date;
  /** Assigned by (user ID) */
  assignedBy: string;
  /** Expiration date (if temporary) */
  expirationDate?: Date;
  /** Last review date */
  lastReviewDate?: Date;
  /** Next required review date */
  nextReviewDate: Date;
  /** Assignment justification */
  justification: string;
  /** Whether assignment is active */
  isActive: boolean;
  /** Emergency access activated */
  emergencyAccess?: {
    activated: boolean;
    activatedDate?: Date;
    activatedBy?: string;
    reason?: string;
    expiresAt?: Date;
  };
}

/**
 * Access review record
 */
export interface AccessReview {
  /** Review ID */
  id: string;
  /** User being reviewed */
  userId: string;
  /** Reviewer user ID */
  reviewerId: string;
  /** Review date */
  reviewDate: Date;
  /** Current role at time of review */
  currentRole: SystemRole;
  /** Review decision */
  decision: 'approved' | 'modified' | 'revoked' | 'pending';
  /** New role (if modified) */
  newRole?: SystemRole;
  /** Review comments */
  comments?: string;
  /** Next review date */
  nextReviewDate: Date;
}

/**
 * RBAC Service Implementation
 */
export class RBACService {
  private roleDefinitions: Map<SystemRole, RoleDefinition> = new Map();
  private userRoleAssignments: Map<string, UserRoleAssignment> = new Map();
  private accessReviews: AccessReview[] = [];

  constructor() {
    this.initializeDefaultRoles();
  }

  /**
   * Check if user has specific permission
   * @param context Access context
   * @param permission Permission to check
   * @returns Promise resolving to access decision
   */
  async hasPermission(context: AccessContext, permission: Permission): Promise<EHRApiResponse<{
    granted: boolean;
    reason?: string;
    conditions?: string[];
    emergencyAccess?: boolean;
  }>> {
    try {
      const userAssignment = this.userRoleAssignments.get(context.userId);
      if (!userAssignment || !userAssignment.isActive) {
        return {
          success: true,
          data: {
            granted: false,
            reason: 'User has no active role assignment'
          }
        };
      }

      // Check if assignment has expired
      if (userAssignment.expirationDate && userAssignment.expirationDate < new Date()) {
        return {
          success: true,
          data: {
            granted: false,
            reason: 'Role assignment has expired'
          }
        };
      }

      const roleDefinition = this.roleDefinitions.get(userAssignment.role);
      if (!roleDefinition) {
        return {
          success: true,
          data: {
            granted: false,
            reason: 'Role definition not found'
          }
        };
      }

      // Check time-based restrictions
      const timeCheck = this.checkTimeRestrictions(roleDefinition, context.requestTime);
      if (!timeCheck.allowed) {
        return {
          success: true,
          data: {
            granted: false,
            reason: timeCheck.reason
          }
        };
      }

      // Check IP restrictions
      const ipCheck = this.checkIPRestrictions(roleDefinition, context.ipAddress);
      if (!ipCheck.allowed) {
        return {
          success: true,
          data: {
            granted: false,
            reason: ipCheck.reason
          }
        };
      }

      // Check if permission is directly granted or inherited
      const hasDirectPermission = roleDefinition.permissions.includes(permission);
      const hasInheritedPermission = await this.checkInheritedPermissions(roleDefinition, permission);
      
      let granted = hasDirectPermission || hasInheritedPermission;
      let emergencyAccess = false;
      const conditions: string[] = [];

      // Check emergency access if regular permission denied
      if (!granted && userAssignment.emergencyAccess?.activated) {
        const emergencyPermissionGranted = roleDefinition.emergencyPermissions?.includes(permission) || false;
        if (emergencyPermissionGranted) {
          granted = true;
          emergencyAccess = true;
          conditions.push('Emergency access activated');
        }
      }

      // Check if access review is required
      if (granted && this.isAccessReviewRequired(userAssignment)) {
        conditions.push('Access review required');
      }

      // Check for patient-specific access restrictions
      if (granted && context.patientMrn) {
        const patientAccessCheck = await this.checkPatientSpecificAccess(
          context.userId, 
          context.patientMrn, 
          permission
        );
        if (!patientAccessCheck.allowed) {
          granted = false;
        }
      }

      return {
        success: true,
        data: {
          granted,
          reason: granted ? undefined : 'Permission not granted for current role',
          conditions: conditions.length > 0 ? conditions : undefined,
          emergencyAccess
        }
      };

    } catch (error) {
      const apiError: EHRApiError = {
        code: 'RBAC_PERMISSION_CHECK_ERROR',
        message: 'Failed to check user permission',
        details: error instanceof Error ? error.message : 'Unknown RBAC error',
        retryable: true
      };

      return { success: false, error: apiError };
    }
  }

  /**
   * Assign role to user
   * @param userId User ID
   * @param role Role to assign
   * @param assignedBy User making the assignment
   * @param justification Reason for assignment
   * @param expirationDate Optional expiration date
   * @returns Promise resolving to assignment result
   */
  async assignRole(
    userId: string,
    role: SystemRole,
    assignedBy: string,
    justification: string,
    expirationDate?: Date
  ): Promise<EHRApiResponse<{ assignment: UserRoleAssignment }>> {
    try {
      const roleDefinition = this.roleDefinitions.get(role);
      if (!roleDefinition) {
        return {
          success: false,
          error: {
            code: 'INVALID_ROLE',
            message: 'Role definition not found',
            retryable: false
          }
        };
      }

      const nextReviewDate = new Date();
      nextReviewDate.setDate(nextReviewDate.getDate() + roleDefinition.reviewPeriodDays);

      const assignment: UserRoleAssignment = {
        userId,
        role,
        assignedDate: new Date(),
        assignedBy,
        expirationDate,
        nextReviewDate,
        justification,
        isActive: true
      };

      this.userRoleAssignments.set(userId, assignment);

      return {
        success: true,
        data: { assignment }
      };

    } catch (error) {
      const apiError: EHRApiError = {
        code: 'RBAC_ROLE_ASSIGNMENT_ERROR',
        message: 'Failed to assign role',
        details: error instanceof Error ? error.message : 'Unknown assignment error',
        retryable: true
      };

      return { success: false, error: apiError };
    }
  }

  /**
   * Activate emergency access for user
   * @param userId User ID
   * @param activatedBy User activating emergency access
   * @param reason Reason for emergency access
   * @param durationMinutes Duration in minutes
   * @returns Promise resolving to activation result
   */
  async activateEmergencyAccess(
    userId: string,
    activatedBy: string,
    reason: string,
    durationMinutes: number = 60
  ): Promise<EHRApiResponse<{ activated: boolean }>> {
    try {
      const userAssignment = this.userRoleAssignments.get(userId);
      if (!userAssignment) {
        return {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User role assignment not found',
            retryable: false
          }
        };
      }

      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + durationMinutes);

      userAssignment.emergencyAccess = {
        activated: true,
        activatedDate: new Date(),
        activatedBy,
        reason,
        expiresAt
      };

      this.userRoleAssignments.set(userId, userAssignment);

      return {
        success: true,
        data: { activated: true }
      };

    } catch (error) {
      const apiError: EHRApiError = {
        code: 'EMERGENCY_ACCESS_ERROR',
        message: 'Failed to activate emergency access',
        details: error instanceof Error ? error.message : 'Unknown emergency access error',
        retryable: true
      };

      return { success: false, error: apiError };
    }
  }

  /**
   * Conduct periodic access review
   * @param userId User being reviewed
   * @param reviewerId User conducting review
   * @param decision Review decision
   * @param newRole New role if modified
   * @param comments Review comments
   * @returns Promise resolving to review result
   */
  async conductAccessReview(
    userId: string,
    reviewerId: string,
    decision: 'approved' | 'modified' | 'revoked',
    newRole?: SystemRole,
    comments?: string
  ): Promise<EHRApiResponse<{ review: AccessReview }>> {
    try {
      const userAssignment = this.userRoleAssignments.get(userId);
      if (!userAssignment) {
        return {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User role assignment not found',
            retryable: false
          }
        };
      }

      const currentRole = userAssignment.role;
      const roleDefinition = this.roleDefinitions.get(currentRole);
      
      const nextReviewDate = new Date();
      nextReviewDate.setDate(nextReviewDate.getDate() + (roleDefinition?.reviewPeriodDays || 90));

      const review: AccessReview = {
        id: this.generateReviewId(),
        userId,
        reviewerId,
        reviewDate: new Date(),
        currentRole,
        decision,
        newRole,
        comments,
        nextReviewDate
      };

      // Apply review decision
      switch (decision) {
        case 'approved':
          userAssignment.lastReviewDate = new Date();
          userAssignment.nextReviewDate = nextReviewDate;
          break;
        case 'modified':
          if (newRole) {
            userAssignment.role = newRole;
            userAssignment.lastReviewDate = new Date();
            userAssignment.nextReviewDate = nextReviewDate;
          }
          break;
        case 'revoked':
          userAssignment.isActive = false;
          break;
      }

      this.userRoleAssignments.set(userId, userAssignment);
      this.accessReviews.push(review);

      return {
        success: true,
        data: { review }
      };

    } catch (error) {
      const apiError: EHRApiError = {
        code: 'ACCESS_REVIEW_ERROR',
        message: 'Failed to conduct access review',
        details: error instanceof Error ? error.message : 'Unknown review error',
        retryable: true
      };

      return { success: false, error: apiError };
    }
  }

  /**
   * Get users requiring access review
   * @returns Users needing review
   */
  async getUsersRequiringReview(): Promise<EHRApiResponse<{ users: UserRoleAssignment[] }>> {
    try {
      const now = new Date();
      const usersNeedingReview = Array.from(this.userRoleAssignments.values())
        .filter(assignment => 
          assignment.isActive && 
          assignment.nextReviewDate <= now
        );

      return {
        success: true,
        data: { users: usersNeedingReview }
      };

    } catch (error) {
      const apiError: EHRApiError = {
        code: 'REVIEW_QUERY_ERROR',
        message: 'Failed to query users requiring review',
        details: error instanceof Error ? error.message : 'Unknown query error',
        retryable: true
      };

      return { success: false, error: apiError };
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Initialize default role definitions
   */
  private initializeDefaultRoles(): void {
    // Super Admin
    this.roleDefinitions.set('super_admin', {
      role: 'super_admin',
      displayName: 'Super Administrator',
      description: 'Full system access with all permissions',
      permissions: [
        'patient.view', 'patient.edit', 'patient.create', 'patient.delete', 'patient.export',
        'pacs.image.view', 'pacs.image.download', 'pacs.image.upload', 'pacs.image.delete',
        'pacs.study.access', 'pacs.annotation.create', 'pacs.annotation.edit', 'pacs.annotation.delete',
        'pacs.report.generate', 'pacs.share.external', 'pacs.config.view', 'pacs.config.edit',
        'pacs.backup.create', 'pacs.restore.execute', 'pacs.user.manage',
        'transcription.create', 'transcription.edit', 'transcription.review', 'transcription.approve', 'transcription.multilingual',
        'audit.view', 'audit.export', 'audit.configure', 'security.assess', 'security.configure',
        'system.config', 'system.backup', 'system.restore', 'user.create', 'user.edit', 'user.delete', 'user.roles.assign',
        'reports.view', 'reports.create', 'reports.export'
      ],
      maxSessionDuration: 480, // 8 hours
      requiresPeriodicReview: true,
      reviewPeriodDays: 30
    });

    // Radiologist
    this.roleDefinitions.set('radiologist', {
      role: 'radiologist',
      displayName: 'Radiologist',
      description: 'Medical imaging specialist with full PACS access',
      permissions: [
        'patient.view', 'patient.edit',
        'pacs.image.view', 'pacs.image.download', 'pacs.study.access',
        'pacs.annotation.create', 'pacs.annotation.edit', 'pacs.annotation.delete',
        'pacs.report.generate', 'transcription.create', 'transcription.edit', 'transcription.multilingual',
        'reports.view', 'reports.create'
      ],
      maxSessionDuration: 720, // 12 hours
      requiresPeriodicReview: true,
      reviewPeriodDays: 90,
      emergencyPermissions: ['pacs.image.upload', 'pacs.share.external']
    });

    // Referring Physician
    this.roleDefinitions.set('referring_physician', {
      role: 'referring_physician',
      displayName: 'Referring Physician',
      description: 'Physician with patient care access and limited PACS viewing',
      permissions: [
        'patient.view', 'patient.edit',
        'pacs.image.view', 'pacs.study.access', 'pacs.report.generate',
        'reports.view'
      ],
      maxSessionDuration: 480, // 8 hours
      requiresPeriodicReview: true,
      reviewPeriodDays: 90
    });

    // Technologist
    this.roleDefinitions.set('technologist', {
      role: 'technologist',
      displayName: 'Medical Technologist',
      description: 'Imaging technologist with upload and basic viewing permissions',
      permissions: [
        'patient.view',
        'pacs.image.view', 'pacs.image.upload', 'pacs.study.access',
        'pacs.annotation.create'
      ],
      maxSessionDuration: 480, // 8 hours
      requiresPeriodicReview: true,
      reviewPeriodDays: 90
    });

    // Transcriptionist
    this.roleDefinitions.set('transcriptionist', {
      role: 'transcriptionist',
      displayName: 'Medical Transcriptionist',
      description: 'Specialist in medical transcription and multilingual services',
      permissions: [
        'transcription.create', 'transcription.edit', 'transcription.multilingual',
        'pacs.image.view', 'pacs.study.access'
      ],
      maxSessionDuration: 480, // 8 hours
      requiresPeriodicReview: true,
      reviewPeriodDays: 90
    });

    // Reviewer
    this.roleDefinitions.set('reviewer', {
      role: 'reviewer',
      displayName: 'Clinical Reviewer',
      description: 'Reviews and approves transcriptions and reports',
      permissions: [
        'transcription.review', 'transcription.approve',
        'pacs.image.view', 'pacs.study.access', 'pacs.report.generate',
        'reports.view'
      ],
      maxSessionDuration: 480, // 8 hours
      requiresPeriodicReview: true,
      reviewPeriodDays: 90
    });

    // Patient
    this.roleDefinitions.set('patient', {
      role: 'patient',
      displayName: 'Patient',
      description: 'Patient with access to own medical records',
      permissions: [
        'patient.view' // Only own data
      ],
      maxSessionDuration: 120, // 2 hours
      requiresPeriodicReview: false,
      reviewPeriodDays: 365
    });
  }

  /**
   * Check time-based access restrictions
   * @param roleDefinition Role definition
   * @param requestTime Time of request
   * @returns Access check result
   */
  private checkTimeRestrictions(roleDefinition: RoleDefinition, requestTime: Date): {
    allowed: boolean;
    reason?: string;
  } {
    if (!roleDefinition.timeRestrictions) {
      return { allowed: true };
    }

    const hour = requestTime.getHours();
    const day = requestTime.getDay();

    // Check day restrictions
    if (roleDefinition.timeRestrictions.allowedDays && 
        !roleDefinition.timeRestrictions.allowedDays.includes(day)) {
      return { allowed: false, reason: 'Access not allowed on this day' };
    }

    // Check hour restrictions
    if (roleDefinition.timeRestrictions.allowedHours) {
      const isAllowedHour = roleDefinition.timeRestrictions.allowedHours.some(
        range => hour >= range.start && hour <= range.end
      );
      if (!isAllowedHour) {
        return { allowed: false, reason: 'Access not allowed at this time' };
      }
    }

    return { allowed: true };
  }

  /**
   * Check IP address restrictions
   * @param roleDefinition Role definition
   * @param ipAddress IP address
   * @returns Access check result
   */
  private checkIPRestrictions(roleDefinition: RoleDefinition, ipAddress?: string): {
    allowed: boolean;
    reason?: string;
  } {
    if (!roleDefinition.ipRestrictions || !ipAddress) {
      return { allowed: true };
    }

    const isAllowed = roleDefinition.ipRestrictions.some(allowedIP => {
      // Simple IP matching - in production, use proper CIDR matching
      return ipAddress.startsWith(allowedIP) || allowedIP === '*';
    });

    if (!isAllowed) {
      return { allowed: false, reason: 'Access not allowed from this IP address' };
    }

    return { allowed: true };
  }

  /**
   * Check inherited permissions from parent roles
   * @param roleDefinition Role definition
   * @param permission Permission to check
   * @returns Whether permission is inherited
   */
  private async checkInheritedPermissions(roleDefinition: RoleDefinition, permission: Permission): Promise<boolean> {
    if (!roleDefinition.inheritsFrom) {
      return false;
    }

    for (const parentRole of roleDefinition.inheritsFrom) {
      const parentDefinition = this.roleDefinitions.get(parentRole);
      if (parentDefinition) {
        if (parentDefinition.permissions.includes(permission)) {
          return true;
        }
        // Recursively check parent's inheritance
        if (await this.checkInheritedPermissions(parentDefinition, permission)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if access review is required
   * @param assignment User role assignment
   * @returns Whether review is required
   */
  private isAccessReviewRequired(assignment: UserRoleAssignment): boolean {
    return assignment.nextReviewDate <= new Date();
  }

  /**
   * Check patient-specific access restrictions
   * @param userId User ID
   * @param patientMrn Patient MRN
   * @param permission Permission being checked
   * @returns Patient access check result
   */
  private async checkPatientSpecificAccess(
    userId: string,
    patientMrn: string,
    permission: Permission
  ): Promise<{ allowed: boolean; reason?: string }> {
    // In a real implementation, this would check:
    // - Patient consent status
    // - Care team assignments
    // - Break-glass access policies
    // - Organizational access policies
    
    // For now, allow access
    return { allowed: true };
  }

  /**
   * Generate unique review ID
   * @returns Review ID
   */
  private generateReviewId(): string {
    return `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default RBACService;