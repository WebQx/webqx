/**
 * PostDICOM Role-Based Access Control Service
 * Integrates with WebQX authentication system to provide imaging access control
 */

import {
  UserPermissions,
  UserRole,
  AccessLevel,
  DICOMStudy,
  AuditLogEntry,
  PostDICOMError,
  ERROR_CODES,
  AccessControlConfig
} from '../types/postdicom.types';
import { getPostDICOMConfig } from '../config/postdicom.config';

/**
 * User context interface for authentication integration
 */
interface UserContext {
  userId: string;
  role: UserRole;
  specialties: string[];
  permissions: string[];
  sessionId: string;
  ipAddress: string;
  userAgent: string;
}

/**
 * Access request interface
 */
interface AccessRequest {
  user: UserContext;
  resourceType: 'study' | 'series' | 'image';
  resourceId: string;
  action: 'view' | 'download' | 'share' | 'delete' | 'annotate';
  patientID?: string;
  studyMetadata?: Partial<DICOMStudy>;
}

/**
 * Access result interface
 */
interface AccessResult {
  granted: boolean;
  reason?: string;
  conditions?: string[];
  auditRequired: boolean;
  sessionTimeout?: number;
}

/**
 * PostDICOM RBAC Service
 * Provides comprehensive role-based access control for medical imaging
 */
export class PostDICOMRBACService {
  private config: AccessControlConfig;
  private auditLogs: AuditLogEntry[] = [];
  private activeSessions = new Map<string, { userId: string; lastActivity: Date; sessionCount: number }>();

  constructor(customConfig?: Partial<AccessControlConfig>) {
    const fullConfig = getPostDICOMConfig();
    this.config = { ...fullConfig.accessControl, ...customConfig };
    
    // Start session cleanup timer
    this.startSessionCleanup();
  }

  /**
   * Check if user has access to a specific resource
   */
  async checkAccess(request: AccessRequest): Promise<AccessResult> {
    try {
      // Validate session
      const sessionValid = await this.validateSession(request.user);
      if (!sessionValid) {
        await this.logAccess(request, false, 'Invalid or expired session');
        return {
          granted: false,
          reason: 'Invalid or expired session',
          auditRequired: true
        };
      }

      // Check if RBAC is enabled
      if (!this.config.enableRBAC) {
        await this.logAccess(request, true, 'RBAC disabled - access granted');
        return {
          granted: true,
          auditRequired: this.config.auditLogging
        };
      }

      // Get user permissions
      const permissions = await this.getUserPermissions(request.user);
      
      // Check role-based access
      const roleAccess = this.checkRoleAccess(request, permissions);
      if (!roleAccess.granted) {
        await this.logAccess(request, false, roleAccess.reason);
        return roleAccess;
      }

      // Check specialty access
      const specialtyAccess = this.checkSpecialtyAccess(request, permissions);
      if (!specialtyAccess.granted) {
        await this.logAccess(request, false, specialtyAccess.reason);
        return specialtyAccess;
      }

      // Check access level restrictions
      const accessLevelCheck = this.checkAccessLevel(request, permissions);
      if (!accessLevelCheck.granted) {
        await this.logAccess(request, false, accessLevelCheck.reason);
        return accessLevelCheck;
      }

      // Check action-specific permissions
      const actionAccess = this.checkActionPermissions(request, permissions);
      if (!actionAccess.granted) {
        await this.logAccess(request, false, actionAccess.reason);
        return actionAccess;
      }

      // Update session activity
      await this.updateSessionActivity(request.user.sessionId);
      
      // Log successful access
      await this.logAccess(request, true, 'Access granted');

      return {
        granted: true,
        auditRequired: this.config.auditLogging,
        sessionTimeout: this.config.sessionTimeout
      };

    } catch (error) {
      await this.logAccess(request, false, `Access check error: ${error instanceof Error ? error.message : String(error)}`);
      return {
        granted: false,
        reason: 'Internal access control error',
        auditRequired: true
      };
    }
  }

  /**
   * Get user permissions based on role and specialties
   */
  async getUserPermissions(user: UserContext): Promise<UserPermissions> {
    // In a real implementation, this would query the WebQX user management system
    const permissions: UserPermissions = {
      userId: user.userId,
      role: user.role,
      specialties: user.specialties,
      accessLevels: this.getAccessLevelsForRole(user.role),
      canView: this.canPerformAction(user.role, 'view'),
      canDownload: this.canPerformAction(user.role, 'download'),
      canShare: this.canPerformAction(user.role, 'share'),
      canDelete: this.canPerformAction(user.role, 'delete'),
      canAnnotate: this.canPerformAction(user.role, 'annotate')
    };

    return permissions;
  }

  /**
   * Create audit log entry
   */
  async logAccess(request: AccessRequest, success: boolean, reason?: string): Promise<void> {
    if (!this.config.auditLogging) {
      return;
    }

    const logEntry: AuditLogEntry = {
      id: this.generateAuditId(),
      timestamp: new Date(),
      userId: request.user.userId,
      userRole: request.user.role,
      action: request.action,
      resourceType: request.resourceType,
      resourceId: request.resourceId,
      patientID: request.patientID || 'unknown',
      ipAddress: request.user.ipAddress,
      userAgent: request.user.userAgent,
      success,
      errorMessage: success ? undefined : reason,
      metadata: {
        sessionId: request.user.sessionId,
        specialties: request.user.specialties,
        studyMetadata: request.studyMetadata
      }
    };

    this.auditLogs.push(logEntry);
    
    // In a real implementation, this would persist to database
    console.log('Audit log entry created:', logEntry);
  }

  /**
   * Get audit logs for a specific user or time period
   */
  async getAuditLogs(filters: {
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    action?: string;
    success?: boolean;
    limit?: number;
  }): Promise<AuditLogEntry[]> {
    let filteredLogs = [...this.auditLogs];

    if (filters.userId) {
      filteredLogs = filteredLogs.filter(log => log.userId === filters.userId);
    }

    if (filters.startDate) {
      filteredLogs = filteredLogs.filter(log => log.timestamp >= filters.startDate!);
    }

    if (filters.endDate) {
      filteredLogs = filteredLogs.filter(log => log.timestamp <= filters.endDate!);
    }

    if (filters.action) {
      filteredLogs = filteredLogs.filter(log => log.action === filters.action);
    }

    if (filters.success !== undefined) {
      filteredLogs = filteredLogs.filter(log => log.success === filters.success);
    }

    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply limit
    if (filters.limit) {
      filteredLogs = filteredLogs.slice(0, filters.limit);
    }

    return filteredLogs;
  }

  /**
   * Start user session with concurrent session tracking
   */
  async startSession(user: UserContext): Promise<{ sessionId: string; maxSessions?: boolean }> {
    const userId = user.userId;
    const currentSession = this.activeSessions.get(userId);
    
    let sessionCount = 1;
    if (currentSession) {
      sessionCount = currentSession.sessionCount + 1;
      
      // Check max concurrent sessions
      if (sessionCount > this.config.maxConcurrentSessions) {
        throw new PostDICOMError(
          `Maximum concurrent sessions (${this.config.maxConcurrentSessions}) exceeded`,
          ERROR_CODES.ACCESS_DENIED,
          403
        );
      }
    }

    const sessionId = this.generateSessionId();
    
    this.activeSessions.set(userId, {
      userId,
      lastActivity: new Date(),
      sessionCount
    });

    return {
      sessionId,
      maxSessions: sessionCount >= this.config.maxConcurrentSessions
    };
  }

  /**
   * End user session
   */
  async endSession(sessionId: string, userId: string): Promise<void> {
    const currentSession = this.activeSessions.get(userId);
    if (currentSession && currentSession.sessionCount > 1) {
      currentSession.sessionCount--;
    } else {
      this.activeSessions.delete(userId);
    }
  }

  /**
   * Get active sessions count
   */
  getActiveSessionsCount(): number {
    return this.activeSessions.size;
  }

  /**
   * Force logout user (admin function)
   */
  async forceLogout(userId: string): Promise<void> {
    this.activeSessions.delete(userId);
    
    // Log admin action
    console.log(`Force logout executed for user: ${userId}`);
  }

  // Private helper methods

  private async validateSession(user: UserContext): Promise<boolean> {
    const session = this.activeSessions.get(user.userId);
    if (!session) {
      return false;
    }

    const now = new Date();
    const sessionAge = now.getTime() - session.lastActivity.getTime();
    const timeoutMs = this.config.sessionTimeout * 60 * 1000;

    if (sessionAge > timeoutMs) {
      this.activeSessions.delete(user.userId);
      return false;
    }

    return true;
  }

  private async updateSessionActivity(sessionId: string): Promise<void> {
    // In a real implementation, this would update session in database
    // For now, we'll update based on active sessions map
    for (const [userId, session] of this.activeSessions) {
      session.lastActivity = new Date();
      break; // Update the first matching session for demo
    }
  }

  private checkRoleAccess(request: AccessRequest, permissions: UserPermissions): AccessResult {
    const roleHierarchy: { [key in UserRole]: number } = {
      'patient': 1,
      'provider': 3,
      'radiologist': 4,
      'admin': 5,
      'researcher': 2
    };

    const requiredLevel = this.getRequiredLevelForAction(request.action, request.resourceType);
    const userLevel = roleHierarchy[permissions.role];

    if (userLevel < requiredLevel) {
      return {
        granted: false,
        reason: `Insufficient role privileges. Required: ${requiredLevel}, User: ${userLevel}`,
        auditRequired: true
      };
    }

    return { granted: true, auditRequired: this.config.auditLogging };
  }

  private checkSpecialtyAccess(request: AccessRequest, permissions: UserPermissions): AccessResult {
    // Patients can only access their own studies
    if (permissions.role === 'patient') {
      if (request.patientID && request.patientID !== permissions.userId) {
        return {
          granted: false,
          reason: 'Patients can only access their own studies',
          auditRequired: true
        };
      }
    }

    // Specialty-specific access for providers
    if (permissions.role === 'provider' || permissions.role === 'radiologist') {
      if (request.studyMetadata?.modality) {
        const requiredSpecialty = this.getSpecialtyForModality(request.studyMetadata.modality);
        if (requiredSpecialty && !permissions.specialties.includes(requiredSpecialty)) {
          return {
            granted: false,
            reason: `Specialty access required: ${requiredSpecialty}`,
            auditRequired: true
          };
        }
      }
    }

    return { granted: true, auditRequired: this.config.auditLogging };
  }

  private checkAccessLevel(request: AccessRequest, permissions: UserPermissions): AccessResult {
    if (!request.studyMetadata?.accessLevel) {
      return { granted: true, auditRequired: this.config.auditLogging };
    }

    const studyAccessLevel = request.studyMetadata.accessLevel;
    
    if (!permissions.accessLevels.includes(studyAccessLevel)) {
      return {
        granted: false,
        reason: `Insufficient access level clearance for ${studyAccessLevel} data`,
        auditRequired: true
      };
    }

    return { granted: true, auditRequired: this.config.auditLogging };
  }

  private checkActionPermissions(request: AccessRequest, permissions: UserPermissions): AccessResult {
    switch (request.action) {
      case 'view':
        if (!permissions.canView) {
          return {
            granted: false,
            reason: 'User does not have view permissions',
            auditRequired: true
          };
        }
        break;
        
      case 'download':
        if (!permissions.canDownload) {
          return {
            granted: false,
            reason: 'User does not have download permissions',
            auditRequired: true
          };
        }
        break;
        
      case 'share':
        if (!permissions.canShare) {
          return {
            granted: false,
            reason: 'User does not have share permissions',
            auditRequired: true
          };
        }
        break;
        
      case 'delete':
        if (!permissions.canDelete) {
          return {
            granted: false,
            reason: 'User does not have delete permissions',
            auditRequired: true
          };
        }
        break;
        
      case 'annotate':
        if (!permissions.canAnnotate) {
          return {
            granted: false,
            reason: 'User does not have annotation permissions',
            auditRequired: true
          };
        }
        break;
    }

    return { granted: true, auditRequired: this.config.auditLogging };
  }

  private getAccessLevelsForRole(role: UserRole): AccessLevel[] {
    const roleAccessLevels: { [key in UserRole]: AccessLevel[] } = {
      'patient': ['public'],
      'provider': ['public', 'restricted'],
      'radiologist': ['public', 'restricted', 'confidential'],
      'admin': ['public', 'restricted', 'confidential', 'top-secret'],
      'researcher': ['public', 'restricted']
    };

    return roleAccessLevels[role] || ['public'];
  }

  private canPerformAction(role: UserRole, action: string): boolean {
    const rolePermissions: { [key in UserRole]: string[] } = {
      'patient': ['view'],
      'provider': ['view', 'download', 'annotate'],
      'radiologist': ['view', 'download', 'share', 'annotate'],
      'admin': ['view', 'download', 'share', 'delete', 'annotate'],
      'researcher': ['view', 'download']
    };

    return rolePermissions[role]?.includes(action) || false;
  }

  private getRequiredLevelForAction(action: string, resourceType: string): number {
    const actionLevels: { [key: string]: number } = {
      'view': 1,
      'download': 2,
      'share': 3,
      'annotate': 3,
      'delete': 5
    };

    return actionLevels[action] || 1;
  }

  private getSpecialtyForModality(modality: string): string | null {
    const modalitySpecialties: { [key: string]: string } = {
      'CT': 'radiology',
      'MRI': 'radiology',
      'XR': 'radiology',
      'US': 'radiology',
      'ECG': 'cardiology',
      'ECHO': 'cardiology',
      'PT': 'nuclear-medicine',
      'NM': 'nuclear-medicine'
    };

    return modalitySpecialties[modality] || null;
  }

  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private startSessionCleanup(): void {
    // Clean up expired sessions every 5 minutes
    setInterval(() => {
      const now = new Date();
      const timeoutMs = this.config.sessionTimeout * 60 * 1000;

      for (const [userId, session] of this.activeSessions) {
        const sessionAge = now.getTime() - session.lastActivity.getTime();
        if (sessionAge > timeoutMs) {
          this.activeSessions.delete(userId);
          console.log(`Cleaned up expired session for user: ${userId}`);
        }
      }
    }, 5 * 60 * 1000); // 5 minutes
  }
}

export default PostDICOMRBACService;