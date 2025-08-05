/**
 * HIPAA Service Implementation
 * 
 * Implements HIPAA compliance requirements including PHI protection,
 * access logging, breach detection, and Business Associate Agreement management
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import {
  PHIAccessLog,
  PHIAction,
  PHIPurpose,
  PHIType,
  BusinessAssociateAgreement,
  HIPAABreach,
  HIPAAService,
  BreachType,
  BreachCause
} from '../types/hipaa';

import { 
  ComplianceContext, 
  ComplianceResponse, 
  ComplianceError,
  ComplianceServiceConfig 
} from '../types/compliance';

import { AuditLogger, AuditLogInput } from '../../ehr-integrations/services/auditLogger';

/**
 * HIPAA Service Configuration
 */
interface HIPAAServiceConfig extends ComplianceServiceConfig {
  /** PHI retention policy in days */
  phiRetentionDays: number;
  
  /** Breach notification email */
  breachNotificationEmail?: string;
  
  /** Automatic breach detection threshold */
  breachDetectionThreshold: {
    failedAccessAttempts: number;
    timeWindowMinutes: number;
    suspiciousPatternEnabled: boolean;
  };
  
  /** BAA management settings */
  baaManagement: {
    expirationWarningDays: number;
    autoRenewEnabled: boolean;
  };
}

/**
 * HIPAA Service Implementation
 */
export class HIPAAServiceImpl implements HIPAAService {
  private config: HIPAAServiceConfig;
  private auditLogger: AuditLogger;
  
  // In-memory stores (in production, these would be database-backed)
  private phiAccessLogs: PHIAccessLog[] = [];
  private businessAssociateAgreements: BusinessAssociateAgreement[] = [];
  private hipaaBreaches: HIPAABreach[] = [];
  
  // Breach detection tracking
  private failedAccessAttempts: Map<string, { count: number; firstAttempt: Date }> = new Map();

  constructor(config: Partial<HIPAAServiceConfig>, auditLogger: AuditLogger) {
    this.config = {
      enabled: true,
      logging: {
        enabled: true,
        level: 'info',
        destination: 'console'
      },
      notifications: {
        enabled: true,
        channels: ['email'],
        recipients: []
      },
      retention: {
        auditLogDays: 2555, // 7 years as required by HIPAA
        consentRecordDays: 2555,
        incidentRecordDays: 2555
      },
      phiRetentionDays: 2555,
      breachDetectionThreshold: {
        failedAccessAttempts: 5,
        timeWindowMinutes: 15,
        suspiciousPatternEnabled: true
      },
      baaManagement: {
        expirationWarningDays: 30,
        autoRenewEnabled: false
      },
      ...config
    };
    
    this.auditLogger = auditLogger;
    
    this.logInfo('HIPAA Service initialized', {
      config: {
        phiRetentionDays: this.config.phiRetentionDays,
        breachDetectionEnabled: this.config.breachDetectionThreshold.suspiciousPatternEnabled,
        baaManagementEnabled: true
      }
    });
  }

  /**
   * Log PHI access for audit purposes
   */
  async logPHIAccess(
    context: ComplianceContext, 
    phiAccess: Omit<PHIAccessLog, 'id' | 'timestamp'>
  ): Promise<ComplianceResponse<{ logId: string }>> {
    try {
      const logEntry: PHIAccessLog = {
        id: this.generateUniqueId(),
        timestamp: new Date(),
        userId: context.userId,
        userRole: context.userRole,
        userName: phiAccess.userName,
        patientId: phiAccess.patientId,
        patientMRN: phiAccess.patientMRN,
        phiType: phiAccess.phiType,
        action: phiAccess.action,
        purpose: phiAccess.purpose,
        accessMethod: phiAccess.accessMethod,
        systemId: phiAccess.systemId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        success: phiAccess.success,
        errorMessage: phiAccess.errorMessage,
        authorization: phiAccess.authorization,
        context: {
          sessionId: context.sessionId,
          requestId: context.requestId,
          ...phiAccess.context
        }
      };

      // Store PHI access log
      this.phiAccessLogs.push(logEntry);
      this.cleanupOldPHILogs();

      // Log to main audit system
      await this.logToMainAuditSystem(logEntry);

      // Check for potential breach patterns
      if (!phiAccess.success) {
        await this.checkForBreachPatterns(context, logEntry);
      }

      this.logInfo('PHI access logged', {
        logId: logEntry.id,
        patientId: logEntry.patientId,
        action: logEntry.action,
        success: logEntry.success
      });

      return {
        success: true,
        data: { logId: logEntry.id },
        auditId: logEntry.id
      };

    } catch (error) {
      const complianceError: ComplianceError = {
        code: 'HIPAA_PHI_LOG_ERROR',
        message: 'Failed to log PHI access',
        details: error instanceof Error ? error.message : 'Unknown error',
        standard: 'HIPAA',
        severity: 'critical',
        remediation: 'Check PHI logging configuration and database connectivity'
      };

      this.logError('Failed to log PHI access', error, { 
        patientId: phiAccess.patientId,
        action: phiAccess.action 
      });

      return { success: false, error: complianceError };
    }
  }

  /**
   * Check if user has authorization to access PHI
   */
  async checkPHIAuthorization(
    context: ComplianceContext, 
    patientId: string, 
    action: PHIAction, 
    purpose: PHIPurpose
  ): Promise<ComplianceResponse<{ authorized: boolean; reason?: string }>> {
    try {
      // Basic authorization logic (would be more complex in production)
      let authorized = true;
      let reason: string | undefined;

      // Check user role permissions
      const rolePermissions = this.getRolePermissions(context.userRole);
      if (!rolePermissions.includes(action)) {
        authorized = false;
        reason = `User role '${context.userRole}' not authorized for action '${action}'`;
      }

      // Check purpose validity
      if (authorized && !this.isValidPurpose(context.userRole, purpose)) {
        authorized = false;
        reason = `Purpose '${purpose}' not valid for user role '${context.userRole}'`;
      }

      // Log authorization check
      await this.logPHIAccess(context, {
        patientId,
        action: 'view', // Authorization check is always a view
        purpose,
        phiType: ['other'],
        accessMethod: 'api',
        systemId: 'webqx-compliance',
        success: authorized,
        errorMessage: reason,
        authorization: {
          granted: authorized,
          grantedBy: 'system',
          grantedAt: new Date(),
          reason
        },
        context: { authorizationCheck: true }
      });

      return {
        success: true,
        data: { authorized, reason }
      };

    } catch (error) {
      this.logError('PHI authorization check failed', error, { 
        patientId, 
        action, 
        purpose 
      });

      return {
        success: false,
        error: {
          code: 'HIPAA_AUTHORIZATION_ERROR',
          message: 'Failed to check PHI authorization',
          details: error instanceof Error ? error.message : 'Unknown error',
          standard: 'HIPAA',
          severity: 'high'
        }
      };
    }
  }

  /**
   * Record a potential HIPAA breach
   */
  async recordBreach(
    context: ComplianceContext, 
    breach: Omit<HIPAABreach, 'id' | 'detectedAt' | 'status'>
  ): Promise<ComplianceResponse<{ breachId: string }>> {
    try {
      const breachRecord: HIPAABreach = {
        id: this.generateUniqueId(),
        detectedAt: new Date(),
        status: 'detected',
        ...breach
      };

      // Store breach record
      this.hipaaBreaches.push(breachRecord);

      // Trigger breach notification if configured
      if (this.config.notifications.enabled && this.config.breachNotificationEmail) {
        await this.sendBreachNotification(breachRecord);
      }

      // Log to audit system
      await this.auditLogger.log({
        action: 'create' as any,
        resourceType: 'hipaa_breach',
        resourceId: breachRecord.id,
        patientMrn: breachRecord.affectedPatients[0]?.patientMRN,
        ehrSystem: 'WebQX-HIPAA',
        success: true,
        context: {
          breachType: breachRecord.type,
          severity: breachRecord.severity,
          individualCount: breachRecord.individualCount
        }
      });

      this.logInfo('HIPAA breach recorded', {
        breachId: breachRecord.id,
        type: breachRecord.type,
        severity: breachRecord.severity,
        individualCount: breachRecord.individualCount
      });

      return {
        success: true,
        data: { breachId: breachRecord.id },
        auditId: breachRecord.id
      };

    } catch (error) {
      this.logError('Failed to record HIPAA breach', error, { 
        breachType: breach.type,
        severity: breach.severity
      });

      return {
        success: false,
        error: {
          code: 'HIPAA_BREACH_RECORD_ERROR',
          message: 'Failed to record HIPAA breach',
          details: error instanceof Error ? error.message : 'Unknown error',
          standard: 'HIPAA',
          severity: 'critical'
        }
      };
    }
  }

  /**
   * Generate HIPAA audit report
   */
  async generateAuditReport(
    context: ComplianceContext,
    criteria: {
      startDate: Date;
      endDate: Date;
      patientId?: string;
      userId?: string;
      phiType?: PHIType;
    }
  ): Promise<ComplianceResponse<{ reportId: string; downloadUrl?: string }>> {
    try {
      const reportId = this.generateUniqueId();

      // Filter PHI access logs based on criteria
      const filteredLogs = this.phiAccessLogs.filter(log => {
        if (log.timestamp < criteria.startDate || log.timestamp > criteria.endDate) return false;
        if (criteria.patientId && log.patientId !== criteria.patientId) return false;
        if (criteria.userId && log.userId !== criteria.userId) return false;
        if (criteria.phiType && !log.phiType.includes(criteria.phiType)) return false;
        return true;
      });

      // Log report generation
      await this.auditLogger.log({
        action: 'access' as any,
        resourceType: 'hipaa_audit_report',
        resourceId: reportId,
        ehrSystem: 'WebQX-HIPAA',
        success: true,
        context: {
          reportCriteria: this.sanitizeCriteria(criteria),
          recordCount: filteredLogs.length
        }
      });

      this.logInfo('HIPAA audit report generated', {
        reportId,
        recordCount: filteredLogs.length,
        dateRange: { start: criteria.startDate, end: criteria.endDate }
      });

      return {
        success: true,
        data: { 
          reportId,
          // downloadUrl would be implemented based on file storage system
        }
      };

    } catch (error) {
      this.logError('Failed to generate HIPAA audit report', error, { criteria });

      return {
        success: false,
        error: {
          code: 'HIPAA_REPORT_ERROR',
          message: 'Failed to generate HIPAA audit report',
          details: error instanceof Error ? error.message : 'Unknown error',
          standard: 'HIPAA',
          severity: 'medium'
        }
      };
    }
  }

  /**
   * Manage Business Associate Agreements
   */
  async manageBBA(
    context: ComplianceContext,
    action: 'create' | 'update' | 'terminate',
    baa: Partial<BusinessAssociateAgreement>
  ): Promise<ComplianceResponse<{ baaId: string }>> {
    try {
      let baaRecord: BusinessAssociateAgreement;

      switch (action) {
        case 'create':
          baaRecord = {
            id: this.generateUniqueId(),
            organizationName: baa.organizationName!,
            contactPerson: baa.contactPerson!,
            contactEmail: baa.contactEmail!,
            contactPhone: baa.contactPhone,
            agreementType: baa.agreementType || 'standard',
            signedDate: baa.signedDate || new Date(),
            effectiveDate: baa.effectiveDate || new Date(),
            expirationDate: baa.expirationDate!,
            servicesDescription: baa.servicesDescription!,
            phiTypesAccessed: baa.phiTypesAccessed || [],
            status: 'active',
            documentUrl: baa.documentUrl,
            signatureHash: baa.signatureHash,
            complianceStatus: 'compliant',
            createdBy: context.userId,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          this.businessAssociateAgreements.push(baaRecord);
          break;

        case 'update':
          const existingBaa = this.businessAssociateAgreements.find(b => b.id === baa.id);
          if (!existingBaa) {
            throw new Error(`BAA with ID ${baa.id} not found`);
          }
          Object.assign(existingBaa, baa, { updatedAt: new Date() });
          baaRecord = existingBaa;
          break;

        case 'terminate':
          const baaToTerminate = this.businessAssociateAgreements.find(b => b.id === baa.id);
          if (!baaToTerminate) {
            throw new Error(`BAA with ID ${baa.id} not found`);
          }
          baaToTerminate.status = 'terminated';
          baaToTerminate.updatedAt = new Date();
          baaRecord = baaToTerminate;
          break;

        default:
          throw new Error(`Invalid BAA action: ${action}`);
      }

      // Log BAA management action
      await this.auditLogger.log({
        action: action as any,
        resourceType: 'business_associate_agreement',
        resourceId: baaRecord.id,
        ehrSystem: 'WebQX-HIPAA',
        success: true,
        context: {
          organizationName: baaRecord.organizationName,
          agreementType: baaRecord.agreementType,
          status: baaRecord.status
        }
      });

      this.logInfo('BAA management action completed', {
        action,
        baaId: baaRecord.id,
        organizationName: baaRecord.organizationName,
        status: baaRecord.status
      });

      return {
        success: true,
        data: { baaId: baaRecord.id }
      };

    } catch (error) {
      this.logError('BAA management failed', error, { action, baaId: baa.id });

      return {
        success: false,
        error: {
          code: 'HIPAA_BAA_ERROR',
          message: `Failed to ${action} Business Associate Agreement`,
          details: error instanceof Error ? error.message : 'Unknown error',
          standard: 'HIPAA',
          severity: 'medium'
        }
      };
    }
  }

  // Private helper methods

  private async logToMainAuditSystem(phiLog: PHIAccessLog): Promise<void> {
    try {
      const auditInput: AuditLogInput = {
        action: phiLog.action as any,
        resourceType: 'phi_data',
        resourceId: phiLog.patientId,
        patientMrn: phiLog.patientMRN,
        ehrSystem: phiLog.systemId,
        success: phiLog.success,
        errorMessage: phiLog.errorMessage,
        context: {
          phiType: phiLog.phiType,
          purpose: phiLog.purpose,
          accessMethod: phiLog.accessMethod,
          authorization: phiLog.authorization,
          hipaaCompliance: true
        }
      };

      await this.auditLogger.log(auditInput);
    } catch (error) {
      this.logError('Failed to log to main audit system', error);
    }
  }

  private async checkForBreachPatterns(context: ComplianceContext, failedAccess: PHIAccessLog): Promise<void> {
    try {
      if (!this.config.breachDetectionThreshold.suspiciousPatternEnabled) {
        return;
      }

      const userKey = `${context.userId}_${failedAccess.patientId}`;
      const now = new Date();
      const threshold = this.config.breachDetectionThreshold;

      // Track failed attempts
      let attempts = this.failedAccessAttempts.get(userKey);
      if (!attempts) {
        attempts = { count: 1, firstAttempt: now };
        this.failedAccessAttempts.set(userKey, attempts);
      } else {
        attempts.count++;
      }

      // Check if threshold exceeded within time window
      const timeWindowMs = threshold.timeWindowMinutes * 60 * 1000;
      const timeElapsed = now.getTime() - attempts.firstAttempt.getTime();

      if (attempts.count >= threshold.failedAccessAttempts && timeElapsed <= timeWindowMs) {
        // Potential breach detected
        await this.recordBreach(context, {
          occurredAt: attempts.firstAttempt,
          type: 'unauthorized_access',
          severity: 'medium',
          description: `Multiple failed PHI access attempts detected for user ${context.userId} on patient ${failedAccess.patientId}`,
          affectedPatients: [{
            patientId: failedAccess.patientId,
            patientMRN: failedAccess.patientMRN,
            phiTypesAffected: failedAccess.phiType
          }],
          individualCount: 1,
          cause: 'system_malfunction',
          discoveryMethod: 'automated',
          notifications: {
            patientsNotified: false,
            ochsNotified: false,
            mediaNotified: false
          },
          investigation: {
            status: 'pending'
          },
          metadata: {
            detectionMethod: 'failed_access_pattern',
            failedAttempts: attempts.count,
            timeWindow: timeWindowMs
          }
        });

        // Reset counter after breach detection
        this.failedAccessAttempts.delete(userKey);
      }

      // Clean up old tracking entries (older than time window)
      this.cleanupFailedAttempts(timeWindowMs);

    } catch (error) {
      this.logError('Breach pattern check failed', error);
    }
  }

  private cleanupFailedAttempts(timeWindowMs: number): void {
    const now = new Date();
    for (const [key, attempts] of this.failedAccessAttempts.entries()) {
      if (now.getTime() - attempts.firstAttempt.getTime() > timeWindowMs) {
        this.failedAccessAttempts.delete(key);
      }
    }
  }

  private cleanupOldPHILogs(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.phiRetentionDays);
    
    this.phiAccessLogs = this.phiAccessLogs.filter(log => log.timestamp > cutoffDate);
  }

  private async sendBreachNotification(breach: HIPAABreach): Promise<void> {
    // Implementation would depend on notification system
    // For now, just log the notification
    this.logInfo('Breach notification sent', {
      breachId: breach.id,
      type: breach.type,
      severity: breach.severity,
      recipients: this.config.notifications.recipients
    });
  }

  private getRolePermissions(userRole: string): PHIAction[] {
    // Define role-based PHI access permissions
    const rolePermissions: Record<string, PHIAction[]> = {
      'physician': ['view', 'create', 'update', 'export', 'print'],
      'nurse': ['view', 'create', 'update'],
      'admin': ['view', 'export', 'print'],
      'billing': ['view', 'export'],
      'patient': ['view'],
      'researcher': ['view', 'export']
    };

    return rolePermissions[userRole] || ['view'];
  }

  private isValidPurpose(userRole: string, purpose: PHIPurpose): boolean {
    // Define valid purposes by role
    const validPurposes: Record<string, PHIPurpose[]> = {
      'physician': ['treatment', 'healthcare_operations', 'quality_assurance'],
      'nurse': ['treatment', 'healthcare_operations'],
      'admin': ['healthcare_operations', 'quality_assurance'],
      'billing': ['payment', 'healthcare_operations'],
      'patient': ['patient_request'],
      'researcher': ['research']
    };

    const allowed = validPurposes[userRole] || [];
    return allowed.includes(purpose);
  }

  private generateUniqueId(): string {
    return `hipaa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeCriteria(criteria: any): Record<string, unknown> {
    return {
      hasDateRange: !!(criteria.startDate && criteria.endDate),
      hasPatientFilter: !!criteria.patientId,
      hasUserFilter: !!criteria.userId,
      hasPhiTypeFilter: !!criteria.phiType
    };
  }

  private logInfo(message: string, context?: Record<string, unknown>): void {
    if (this.config.logging.enabled && this.config.logging.level !== 'error') {
      console.log(`[HIPAA Service] ${message}`, context || {});
    }
  }

  private logError(message: string, error: unknown, context?: Record<string, unknown>): void {
    if (this.config.logging.enabled) {
      console.error(`[HIPAA Service] ${message}`, { 
        error: error instanceof Error ? error.message : error,
        context: context || {} 
      });
    }
  }
}