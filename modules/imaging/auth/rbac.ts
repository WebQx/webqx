/**
 * Role-Based Access Control (RBAC) for WebQX™ OHIF Integration
 * 
 * Manages user permissions, role-based study access, and security policies
 * for imaging operations within the WebQX™ platform.
 */

import { 
  WebQXUser, 
  Permission, 
  UserRole, 
  MedicalSpecialty,
  WebQXStudyMetadata,
  ImagingWorkflow
} from '../types';

interface AccessPolicy {
  role: UserRole;
  permissions: Permission[];
  restrictions: AccessRestriction[];
  specialty?: MedicalSpecialty;
}

interface AccessRestriction {
  type: 'study_access' | 'time_based' | 'location_based' | 'specialty_based';
  condition: string;
  allowed: boolean;
}

interface AuditEntry {
  id: string;
  userId: string;
  action: string;
  resource: string;
  timestamp: Date;
  success: boolean;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export class ImagingRBAC {
  private policies: Map<UserRole, AccessPolicy> = new Map();
  private auditLog: AuditEntry[] = [];
  private maxAuditEntries = 10000;

  constructor() {
    this.initializePolicies();
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(user: WebQXUser, permission: Permission): boolean {
    const policy = this.policies.get(user.role);
    if (!policy) {
      this.logAuditEvent(user.id, 'permission_check', permission, false, {
        reason: 'Unknown role'
      });
      return false;
    }

    const hasPermission = policy.permissions.includes(permission);
    
    this.logAuditEvent(user.id, 'permission_check', permission, hasPermission);
    
    return hasPermission;
  }

  /**
   * Check if user can access specific study
   */
  canAccessStudy(user: WebQXUser, study: WebQXStudyMetadata): boolean {
    // Check basic permissions
    if (!this.hasPermission(user, 'view_images')) {
      return false;
    }

    const policy = this.policies.get(user.role);
    if (!policy) {
      return false;
    }

    // Check specialty restrictions
    if (policy.specialty && study.clinicalContext?.specialty) {
      if (policy.specialty !== study.clinicalContext.specialty) {
        this.logAuditEvent(user.id, 'study_access_denied', study.studyInstanceUID, false, {
          reason: 'Specialty mismatch',
          userSpecialty: policy.specialty,
          studySpecialty: study.clinicalContext.specialty
        });
        return false;
      }
    }

    // Check role-based access list
    if (study.accessibleBy && study.accessibleBy.length > 0) {
      if (!study.accessibleBy.includes(user.role)) {
        this.logAuditEvent(user.id, 'study_access_denied', study.studyInstanceUID, false, {
          reason: 'Role not in access list',
          allowedRoles: study.accessibleBy
        });
        return false;
      }
    }

    // Apply additional restrictions
    for (const restriction of policy.restrictions) {
      if (!this.evaluateRestriction(user, study, restriction)) {
        this.logAuditEvent(user.id, 'study_access_denied', study.studyInstanceUID, false, {
          reason: 'Restriction violation',
          restriction: restriction.type
        });
        return false;
      }
    }

    this.logAuditEvent(user.id, 'study_access_granted', study.studyInstanceUID, true);
    return true;
  }

  /**
   * Filter studies based on user access rights
   */
  filterAccessibleStudies(user: WebQXUser, studies: WebQXStudyMetadata[]): WebQXStudyMetadata[] {
    return studies.filter(study => this.canAccessStudy(user, study));
  }

  /**
   * Check if user can perform workflow action
   */
  canPerformWorkflowAction(
    user: WebQXUser, 
    workflow: ImagingWorkflow, 
    action: string
  ): boolean {
    // Check if user has required workflow permissions
    for (const permission of workflow.permissions) {
      if (!this.hasPermission(user, permission)) {
        this.logAuditEvent(user.id, 'workflow_action_denied', `${workflow.id}:${action}`, false, {
          reason: 'Missing permission',
          requiredPermission: permission
        });
        return false;
      }
    }

    // Check specialty match
    if (workflow.specialty && user.specialty) {
      if (workflow.specialty !== user.specialty) {
        this.logAuditEvent(user.id, 'workflow_action_denied', `${workflow.id}:${action}`, false, {
          reason: 'Specialty mismatch'
        });
        return false;
      }
    }

    this.logAuditEvent(user.id, 'workflow_action_granted', `${workflow.id}:${action}`, true);
    return true;
  }

  /**
   * Get user's effective permissions with role and specialty context
   */
  getEffectivePermissions(user: WebQXUser): Permission[] {
    const policy = this.policies.get(user.role);
    if (!policy) {
      return [];
    }

    let permissions = [...policy.permissions];

    // Add specialty-specific permissions
    if (user.specialty) {
      const specialtyPermissions = this.getSpecialtyPermissions(user.specialty);
      permissions = [...new Set([...permissions, ...specialtyPermissions])];
    }

    this.logAuditEvent(user.id, 'permissions_calculated', 'effective_permissions', true, {
      permissions
    });

    return permissions;
  }

  /**
   * Validate user session and refresh permissions if needed
   */
  validateSession(user: WebQXUser, sessionData: any): boolean {
    // Check session expiry
    if (sessionData.expiresAt && new Date() > new Date(sessionData.expiresAt)) {
      this.logAuditEvent(user.id, 'session_expired', 'session_validation', false);
      return false;
    }

    // Check if role has changed
    if (sessionData.role !== user.role) {
      this.logAuditEvent(user.id, 'role_changed', 'session_validation', true, {
        oldRole: sessionData.role,
        newRole: user.role
      });
      // In real implementation, would refresh user data
    }

    this.logAuditEvent(user.id, 'session_validated', 'session_validation', true);
    return true;
  }

  /**
   * Get audit log entries for user or system
   */
  getAuditLog(filters: {
    userId?: string;
    action?: string;
    resource?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  } = {}): AuditEntry[] {
    let entries = [...this.auditLog];

    // Apply filters
    if (filters.userId) {
      entries = entries.filter(entry => entry.userId === filters.userId);
    }

    if (filters.action) {
      entries = entries.filter(entry => entry.action === filters.action);
    }

    if (filters.resource) {
      entries = entries.filter(entry => entry.resource === filters.resource);
    }

    if (filters.startDate) {
      entries = entries.filter(entry => entry.timestamp >= filters.startDate!);
    }

    if (filters.endDate) {
      entries = entries.filter(entry => entry.timestamp <= filters.endDate!);
    }

    // Sort by timestamp (newest first)
    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply limit
    if (filters.limit) {
      entries = entries.slice(0, filters.limit);
    }

    return entries;
  }

  /**
   * Clear audit log entries older than specified days
   */
  cleanupAuditLog(retentionDays: number = 90): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const initialCount = this.auditLog.length;
    this.auditLog = this.auditLog.filter(entry => entry.timestamp > cutoffDate);
    
    return initialCount - this.auditLog.length;
  }

  // Private methods

  private initializePolicies(): void {
    // Admin policy
    this.policies.set('admin', {
      role: 'admin',
      permissions: [
        'view_images',
        'annotate_images',
        'measure_images',
        'download_images',
        'share_studies',
        'edit_metadata',
        'admin_settings'
      ],
      restrictions: []
    });

    // Radiologist policy
    this.policies.set('radiologist', {
      role: 'radiologist',
      permissions: [
        'view_images',
        'annotate_images',
        'measure_images',
        'download_images',
        'share_studies'
      ],
      restrictions: [
        {
          type: 'specialty_based',
          condition: 'radiology_only',
          allowed: true
        }
      ],
      specialty: 'radiology'
    });

    // Physician policy
    this.policies.set('physician', {
      role: 'physician',
      permissions: [
        'view_images',
        'annotate_images',
        'measure_images'
      ],
      restrictions: [
        {
          type: 'study_access',
          condition: 'own_patients_only',
          allowed: true
        }
      ]
    });

    // Technician policy
    this.policies.set('technician', {
      role: 'technician',
      permissions: [
        'view_images',
        'measure_images'
      ],
      restrictions: [
        {
          type: 'specialty_based',
          condition: 'assigned_specialty_only',
          allowed: true
        }
      ]
    });

    // Nurse policy
    this.policies.set('nurse', {
      role: 'nurse',
      permissions: [
        'view_images'
      ],
      restrictions: [
        {
          type: 'study_access',
          condition: 'assigned_patients_only',
          allowed: true
        }
      ]
    });

    // Student policy
    this.policies.set('student', {
      role: 'student',
      permissions: [
        'view_images'
      ],
      restrictions: [
        {
          type: 'study_access',
          condition: 'educational_studies_only',
          allowed: true
        },
        {
          type: 'time_based',
          condition: 'business_hours_only',
          allowed: true
        }
      ]
    });

    // Patient policy
    this.policies.set('patient', {
      role: 'patient',
      permissions: [
        'view_images'
      ],
      restrictions: [
        {
          type: 'study_access',
          condition: 'own_studies_only',
          allowed: true
        }
      ]
    });
  }

  private evaluateRestriction(
    user: WebQXUser, 
    study: WebQXStudyMetadata, 
    restriction: AccessRestriction
  ): boolean {
    switch (restriction.type) {
      case 'study_access':
        return this.evaluateStudyAccessRestriction(user, study, restriction);
      
      case 'time_based':
        return this.evaluateTimeBasedRestriction(user, restriction);
      
      case 'specialty_based':
        return this.evaluateSpecialtyRestriction(user, study, restriction);
      
      default:
        return restriction.allowed;
    }
  }

  private evaluateStudyAccessRestriction(
    user: WebQXUser, 
    study: WebQXStudyMetadata, 
    restriction: AccessRestriction
  ): boolean {
    switch (restriction.condition) {
      case 'own_patients_only':
        // In real implementation, check if user is assigned to patient
        return study.webqxPatientId.includes(user.id.substring(0, 3));
      
      case 'assigned_patients_only':
        // Similar to above but for nurse assignments
        return true; // Mock implementation
      
      case 'educational_studies_only':
        // Check if study is marked for educational use
        return study.clinicalContext?.indication?.includes('educational') || false;
      
      case 'own_studies_only':
        // For patient access - only their own studies
        return study.webqxPatientId === user.id;
      
      default:
        return restriction.allowed;
    }
  }

  private evaluateTimeBasedRestriction(user: WebQXUser, restriction: AccessRestriction): boolean {
    switch (restriction.condition) {
      case 'business_hours_only':
        const hour = new Date().getHours();
        return hour >= 8 && hour <= 17; // 8 AM to 5 PM
      
      default:
        return restriction.allowed;
    }
  }

  private evaluateSpecialtyRestriction(
    user: WebQXUser, 
    study: WebQXStudyMetadata, 
    restriction: AccessRestriction
  ): boolean {
    switch (restriction.condition) {
      case 'radiology_only':
        return user.specialty === 'radiology';
      
      case 'assigned_specialty_only':
        return !study.clinicalContext?.specialty || 
               study.clinicalContext.specialty === user.specialty;
      
      default:
        return restriction.allowed;
    }
  }

  private getSpecialtyPermissions(specialty: MedicalSpecialty): Permission[] {
    const specialtyPermissions: Record<MedicalSpecialty, Permission[]> = {
      'radiology': ['annotate_images', 'measure_images', 'download_images'],
      'cardiology': ['measure_images', 'annotate_images'],
      'oncology': ['annotate_images', 'share_studies'],
      'neurology': ['measure_images'],
      'orthopedics': ['measure_images'],
      'primary_care': ['view_images'],
      'emergency': ['view_images', 'share_studies'],
      'pathology': ['annotate_images', 'measure_images']
    };

    return specialtyPermissions[specialty] || [];
  }

  private logAuditEvent(
    userId: string,
    action: string,
    resource: string,
    success: boolean,
    details?: Record<string, any>
  ): void {
    const entry: AuditEntry = {
      id: this.generateId(),
      userId,
      action,
      resource,
      timestamp: new Date(),
      success,
      details
    };

    this.auditLog.push(entry);

    // Trim log if it exceeds max entries
    if (this.auditLog.length > this.maxAuditEntries) {
      this.auditLog = this.auditLog.slice(-this.maxAuditEntries);
    }
  }

  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export as default for backwards compatibility
export default ImagingRBAC;