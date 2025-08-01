/**
 * Specialty Access Control Service for WebQX™
 * 
 * Healthcare-specific access control system that manages permissions based on
 * medical specialties, roles, and clinical contexts.
 */

import {
  User,
  UserRole,
  MedicalSpecialty,
  AccessControlRequest,
  AccessControlResult,
  AccessContext,
  SpecialtyAccess,
  Permission
} from '../types';

import { HEALTHCARE_ROLES } from './roles';
import { SPECIALTY_PERMISSIONS } from './specialties';

export class SpecialtyAccessControlService {
  private auditEnabled: boolean;

  constructor(options: { enableAudit?: boolean } = {}) {
    this.auditEnabled = options.enableAudit !== false;
  }

  /**
   * Check if user has access to a specific resource and action
   */
  async checkAccess(request: AccessControlRequest): Promise<AccessControlResult> {
    try {
      const user = await this.getUserById(request.userId);
      
      if (!user) {
        return {
          granted: false,
          reason: 'User not found',
          auditRequired: true
        };
      }

      // Check role-based permissions
      const roleAccess = this.checkRoleAccess(user, request.resource, request.action);
      if (!roleAccess.granted) {
        await this.logAccessEvent(request, roleAccess, user);
        return roleAccess;
      }

      // Check specialty-specific access if applicable
      if (user.specialty && this.requiresSpecialtyAccess(request.resource)) {
        const specialtyAccess = this.checkSpecialtyAccess(user, request.resource, request.context);
        if (!specialtyAccess.granted) {
          await this.logAccessEvent(request, specialtyAccess, user);
          return specialtyAccess;
        }
      }

      // Check contextual access controls
      const contextAccess = await this.checkContextualAccess(user, request);
      if (!contextAccess.granted) {
        await this.logAccessEvent(request, contextAccess, user);
        return contextAccess;
      }

      const result: AccessControlResult = {
        granted: true,
        auditRequired: true
      };

      await this.logAccessEvent(request, result, user);
      return result;

    } catch (error) {
      console.error('[Access Control] Error checking access:', error);
      return {
        granted: false,
        reason: 'Access control error',
        auditRequired: true
      };
    }
  }

  /**
   * Check role-based access permissions
   */
  private checkRoleAccess(user: User, resource: string, action: string): AccessControlResult {
    const rolePermissions = HEALTHCARE_ROLES[user.role];
    
    if (!rolePermissions) {
      return {
        granted: false,
        reason: `Unknown role: ${user.role}`
      };
    }

    // Check if user has access to the resource
    if (!rolePermissions.resources.includes(resource)) {
      return {
        granted: false,
        reason: `Role ${user.role} does not have access to resource: ${resource}`
      };
    }

    // Check if user has permission for the action
    const requiredPermission = this.getRequiredPermission(resource, action);
    if (requiredPermission && !rolePermissions.permissions.includes(requiredPermission)) {
      return {
        granted: false,
        reason: `Role ${user.role} does not have permission: ${requiredPermission}`
      };
    }

    // Check role restrictions
    if (rolePermissions.restrictions) {
      const restrictedResource = rolePermissions.restrictions.find(r => resource.includes(r));
      if (restrictedResource) {
        return {
          granted: false,
          reason: `Role ${user.role} is restricted from: ${restrictedResource}`
        };
      }
    }

    return { granted: true };
  }

  /**
   * Check specialty-specific access permissions
   */
  private checkSpecialtyAccess(
    user: User, 
    resource: string, 
    context?: AccessContext
  ): AccessControlResult {
    if (!user.specialty) {
      return {
        granted: false,
        reason: 'Specialty not specified for user'
      };
    }

    const specialtyPermissions = SPECIALTY_PERMISSIONS[user.specialty];
    if (!specialtyPermissions) {
      return {
        granted: false,
        reason: `Unknown specialty: ${user.specialty}`
      };
    }

    // Check if specialty has access to the tool/resource
    if (!specialtyPermissions.tools.includes(resource)) {
      return {
        granted: false,
        reason: `Specialty ${user.specialty} does not have access to: ${resource}`
      };
    }

    // Check specialty restrictions
    if (specialtyPermissions.restrictedAreas?.includes(resource)) {
      return {
        granted: false,
        reason: `Specialty ${user.specialty} is restricted from: ${resource}`
      };
    }

    // Check required certifications
    if (specialtyPermissions.requiredCertifications) {
      // In a real implementation, this would check user's certifications
      // For now, we'll assume verified providers have necessary certifications
      if (!user.isVerified) {
        return {
          granted: false,
          reason: 'Provider verification required for specialty access'
        };
      }
    }

    return { granted: true };
  }

  /**
   * Check contextual access controls (patient consent, emergency access, etc.)
   */
  private async checkContextualAccess(
    user: User, 
    request: AccessControlRequest
  ): Promise<AccessControlResult> {
    const context = request.context;
    
    if (!context) {
      return { granted: true };
    }

    // Emergency access override
    if (context.urgency === 'CRITICAL') {
      return {
        granted: true,
        conditions: ['emergency_access_logged'],
        auditRequired: true
      };
    }

    // Patient consent check for patient data access
    if (context.patientId && request.resource.includes('patient_records')) {
      const hasConsent = await this.checkPatientConsent(context.patientId, user.id);
      if (!hasConsent) {
        return {
          granted: false,
          reason: 'Patient consent required for record access'
        };
      }
    }

    // Department-specific access
    if (context.departmentId) {
      const hasDepartmentAccess = await this.checkDepartmentAccess(user.id, context.departmentId);
      if (!hasDepartmentAccess) {
        return {
          granted: false,
          reason: 'Department access not authorized'
        };
      }
    }

    return { granted: true };
  }

  /**
   * Check if resource requires specialty-specific access
   */
  private requiresSpecialtyAccess(resource: string): boolean {
    const specialtyResources = [
      'dicom_viewer',
      'pacs_access',
      'ecg_analysis',
      'surgical_planning',
      'pathology_viewer',
      'radiology_tools',
      'cardiology_tools',
      'oncology_protocols'
    ];

    return specialtyResources.some(sr => resource.includes(sr));
  }

  /**
   * Get required permission for resource and action combination
   */
  private getRequiredPermission(resource: string, action: string): Permission | null {
    const permissionMap: Record<string, Record<string, Permission>> = {
      'patient_records': {
        'read': 'read:patient_records',
        'write': 'write:clinical_notes'
      },
      'prescriptions': {
        'write': 'write:prescriptions'
      },
      'lab_tests': {
        'order': 'order:lab_tests'
      },
      'imaging': {
        'access': 'access:imaging'
      }
    };

    const resourcePermissions = permissionMap[resource];
    return resourcePermissions?.[action] || null;
  }

  /**
   * Check patient consent for data access
   */
  private async checkPatientConsent(patientId: string, providerId: string): Promise<boolean> {
    // In real implementation, this would check patient consent records
    // For now, return true for demonstration
    return true;
  }

  /**
   * Check department access authorization
   */
  private async checkDepartmentAccess(userId: string, departmentId: string): Promise<boolean> {
    // In real implementation, this would check department assignments
    // For now, return true for demonstration
    return true;
  }

  /**
   * Get user by ID
   */
  private async getUserById(userId: string): Promise<User | null> {
    // In real implementation, this would fetch from user database
    // For now, return a mock user
    return {
      id: userId,
      email: 'doctor@example.com',
      firstName: 'Dr. John',
      lastName: 'Smith',
      role: 'PROVIDER',
      specialty: 'CARDIOLOGY',
      isVerified: true,
      mfaEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Log access control event for audit purposes
   */
  private async logAccessEvent(
    request: AccessControlRequest,
    result: AccessControlResult,
    user: User
  ): Promise<void> {
    if (!this.auditEnabled) {
      return;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      userId: request.userId,
      userRole: user.role,
      userSpecialty: user.specialty,
      resource: request.resource,
      action: request.action,
      granted: result.granted,
      reason: result.reason,
      conditions: result.conditions,
      context: request.context
    };

    console.log('[Access Control] Access Event:', JSON.stringify(logEntry, null, 2));
  }
}

export default SpecialtyAccessControlService;