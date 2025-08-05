/**
 * GDPR Service Implementation
 * 
 * Implements GDPR compliance requirements including consent management,
 * data subject rights, and breach notification
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import {
  ConsentRecord,
  ConsentType,
  LegalBasis,
  DataSubjectRequest,
  DataSubjectRightType,
  RequestStatus,
  GDPRBreach,
  GDPRService,
  DataCategory
} from '../types/gdpr';

import { 
  ComplianceContext, 
  ComplianceResponse, 
  ComplianceError,
  ComplianceServiceConfig 
} from '../types/compliance';

import { AuditLogger, AuditLogInput } from '../../ehr-integrations/services/auditLogger';

/**
 * GDPR Service Configuration
 */
interface GDPRServiceConfig extends ComplianceServiceConfig {
  /** Data processing legal basis */
  defaultLegalBasis: LegalBasis;
  
  /** Consent expiry period in days */
  consentExpiryDays: number;
  
  /** Data subject request response timeframe */
  requestResponseDays: number;
  
  /** Right to erasure timeframe */
  erasureTimeframeDays: number;
  
  /** Region-specific settings */
  region: 'EU' | 'UK' | 'GLOBAL';
  
  /** Data protection officer contact */
  dpoContact?: string;
}

/**
 * GDPR Service Implementation
 */
export class GDPRServiceImpl implements GDPRService {
  private config: GDPRServiceConfig;
  private auditLogger: AuditLogger;
  
  // In-memory stores (in production, these would be database-backed)
  private consentRecords: ConsentRecord[] = [];
  private dataSubjectRequests: DataSubjectRequest[] = [];
  private gdprBreaches: GDPRBreach[] = [];

  constructor(config: Partial<GDPRServiceConfig>, auditLogger: AuditLogger) {
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
        auditLogDays: 2555, // 7 years
        consentRecordDays: 2555,
        incidentRecordDays: 2555
      },
      defaultLegalBasis: 'consent',
      consentExpiryDays: 365, // 1 year default
      requestResponseDays: 30, // GDPR requirement: 1 month
      erasureTimeframeDays: 30,
      region: 'EU',
      ...config
    };
    
    this.auditLogger = auditLogger;
    
    this.logInfo('GDPR Service initialized', {
      config: {
        region: this.config.region,
        consentExpiryDays: this.config.consentExpiryDays,
        requestResponseDays: this.config.requestResponseDays,
        defaultLegalBasis: this.config.defaultLegalBasis
      }
    });
  }

  /**
   * Record consent from data subject
   */
  async recordConsent(
    context: ComplianceContext,
    consent: Omit<ConsentRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ComplianceResponse<{ consentId: string }>> {
    try {
      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.config.consentExpiryDays);

      const consentRecord: ConsentRecord = {
        id: this.generateUniqueId(),
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        ...consent
      };

      // Store consent record
      this.consentRecords.push(consentRecord);

      // Log to audit system
      await this.logToMainAuditSystem('consent_granted', consentRecord);

      this.logInfo('Consent recorded', {
        consentId: consentRecord.id,
        subjectId: consentRecord.subjectId,
        consentType: consentRecord.consentType,
        granted: consentRecord.granted
      });

      return {
        success: true,
        data: { consentId: consentRecord.id },
        auditId: consentRecord.id
      };

    } catch (error) {
      this.logError('Failed to record consent', error, { 
        subjectId: consent.subjectId,
        consentType: consent.consentType 
      });

      return {
        success: false,
        error: {
          code: 'GDPR_CONSENT_RECORD_ERROR',
          message: 'Failed to record consent',
          details: error instanceof Error ? error.message : 'Unknown error',
          standard: 'GDPR',
          severity: 'high'
        }
      };
    }
  }

  /**
   * Withdraw consent
   */
  async withdrawConsent(
    context: ComplianceContext,
    consentId: string,
    reason?: string
  ): Promise<ComplianceResponse<{ success: boolean }>> {
    try {
      const consentRecord = this.consentRecords.find(c => c.id === consentId);
      if (!consentRecord) {
        return {
          success: false,
          error: {
            code: 'GDPR_CONSENT_NOT_FOUND',
            message: 'Consent record not found',
            standard: 'GDPR',
            severity: 'medium'
          }
        };
      }

      // Update consent record
      consentRecord.granted = false;
      consentRecord.withdrawnAt = new Date();
      consentRecord.updatedAt = new Date();
      
      if (reason) {
        consentRecord.metadata = { 
          ...consentRecord.metadata, 
          withdrawalReason: reason 
        };
      }

      // Log to audit system
      await this.logToMainAuditSystem('consent_withdrawn', consentRecord);

      this.logInfo('Consent withdrawn', {
        consentId,
        subjectId: consentRecord.subjectId,
        consentType: consentRecord.consentType,
        reason
      });

      return {
        success: true,
        data: { success: true }
      };

    } catch (error) {
      this.logError('Failed to withdraw consent', error, { consentId, reason });

      return {
        success: false,
        error: {
          code: 'GDPR_CONSENT_WITHDRAWAL_ERROR',
          message: 'Failed to withdraw consent',
          details: error instanceof Error ? error.message : 'Unknown error',
          standard: 'GDPR',
          severity: 'high'
        }
      };
    }
  }

  /**
   * Check if valid consent exists
   */
  async checkConsent(
    context: ComplianceContext,
    subjectId: string,
    consentType: ConsentType
  ): Promise<ComplianceResponse<{ hasValidConsent: boolean; consentRecord?: ConsentRecord }>> {
    try {
      const now = new Date();
      
      // Find the most recent consent for this subject and type
      const consentRecord = this.consentRecords
        .filter(c => 
          c.subjectId === subjectId && 
          c.consentType === consentType &&
          c.granted &&
          (!c.expiresAt || c.expiresAt > now)
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

      const hasValidConsent = !!consentRecord;

      // Log the consent check
      await this.auditLogger.log({
        action: 'access' as any,
        resourceType: 'gdpr_consent',
        resourceId: consentRecord?.id || 'none',
        ehrSystem: 'WebQX-GDPR',
        success: true,
        context: {
          subjectId,
          consentType,
          hasValidConsent,
          checkPerformed: true
        }
      });

      return {
        success: true,
        data: { hasValidConsent, consentRecord }
      };

    } catch (error) {
      this.logError('Consent check failed', error, { subjectId, consentType });

      return {
        success: false,
        error: {
          code: 'GDPR_CONSENT_CHECK_ERROR',
          message: 'Failed to check consent',
          details: error instanceof Error ? error.message : 'Unknown error',
          standard: 'GDPR',
          severity: 'medium'
        }
      };
    }
  }

  /**
   * Handle data subject rights request
   */
  async handleDataSubjectRequest(
    context: ComplianceContext,
    request: Omit<DataSubjectRequest, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ComplianceResponse<{ requestId: string }>> {
    try {
      // Calculate due date (GDPR: 1 month to respond)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + this.config.requestResponseDays);

      const requestRecord: DataSubjectRequest = {
        id: this.generateUniqueId(),
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'submitted',
        identityVerified: false,
        dueDate,
        communications: [],
        ...request
      };

      // Store request
      this.dataSubjectRequests.push(requestRecord);

      // Log to audit system
      await this.auditLogger.log({
        action: 'create' as any,
        resourceType: 'gdpr_subject_request',
        resourceId: requestRecord.id,
        ehrSystem: 'WebQX-GDPR',
        success: true,
        context: {
          requestType: requestRecord.type,
          subjectId: requestRecord.subjectId,
          dueDate: requestRecord.dueDate
        }
      });

      this.logInfo('Data subject request created', {
        requestId: requestRecord.id,
        type: requestRecord.type,
        subjectId: requestRecord.subjectId,
        dueDate: requestRecord.dueDate
      });

      return {
        success: true,
        data: { requestId: requestRecord.id },
        auditId: requestRecord.id
      };

    } catch (error) {
      this.logError('Failed to handle data subject request', error, { 
        requestType: request.type,
        subjectId: request.subjectId 
      });

      return {
        success: false,
        error: {
          code: 'GDPR_SUBJECT_REQUEST_ERROR',
          message: 'Failed to handle data subject request',
          details: error instanceof Error ? error.message : 'Unknown error',
          standard: 'GDPR',
          severity: 'high'
        }
      };
    }
  }

  /**
   * Process right to erasure request
   */
  async processErasureRequest(
    context: ComplianceContext,
    requestId: string
  ): Promise<ComplianceResponse<{ deletedRecords: number; pendingDeletions: string[] }>> {
    try {
      const request = this.dataSubjectRequests.find(r => r.id === requestId);
      if (!request) {
        return {
          success: false,
          error: {
            code: 'GDPR_REQUEST_NOT_FOUND',
            message: 'Data subject request not found',
            standard: 'GDPR',
            severity: 'medium'
          }
        };
      }

      if (request.type !== 'erasure') {
        return {
          success: false,
          error: {
            code: 'GDPR_INVALID_REQUEST_TYPE',
            message: 'Request is not an erasure request',
            standard: 'GDPR',
            severity: 'medium'
          }
        };
      }

      // Simulate data deletion process
      const deletedRecords = await this.performDataErasure(request.subjectId);
      const pendingDeletions: string[] = []; // Systems that couldn't be processed immediately

      // Update request status
      request.status = 'completed';
      request.respondedAt = new Date();
      request.response = {
        action: 'granted',
        deletionConfirmed: true,
        reason: `${deletedRecords} records deleted successfully`
      };
      request.updatedAt = new Date();

      // Log to audit system
      await this.auditLogger.log({
        action: 'delete' as any,
        resourceType: 'personal_data',
        resourceId: request.subjectId,
        ehrSystem: 'WebQX-GDPR',
        success: true,
        context: {
          requestId,
          deletedRecords,
          pendingDeletions,
          erasureCompleted: true
        }
      });

      this.logInfo('Right to erasure processed', {
        requestId,
        subjectId: request.subjectId,
        deletedRecords,
        pendingDeletions: pendingDeletions.length
      });

      return {
        success: true,
        data: { deletedRecords, pendingDeletions }
      };

    } catch (error) {
      this.logError('Failed to process erasure request', error, { requestId });

      return {
        success: false,
        error: {
          code: 'GDPR_ERASURE_ERROR',
          message: 'Failed to process right to erasure request',
          details: error instanceof Error ? error.message : 'Unknown error',
          standard: 'GDPR',
          severity: 'high'
        }
      };
    }
  }

  /**
   * Export personal data (data portability)
   */
  async exportPersonalData(
    context: ComplianceContext,
    subjectId: string,
    format: 'json' | 'csv' | 'xml'
  ): Promise<ComplianceResponse<{ exportId: string; downloadUrl: string }>> {
    try {
      const exportId = this.generateUniqueId();

      // Simulate data export process
      const exportData = await this.collectPersonalData(subjectId);
      const downloadUrl = await this.generateExportFile(exportData, format, exportId);

      // Log to audit system
      await this.auditLogger.log({
        action: 'export' as any,
        resourceType: 'personal_data',
        resourceId: subjectId,
        ehrSystem: 'WebQX-GDPR',
        success: true,
        context: {
          exportId,
          format,
          recordCount: exportData.recordCount,
          dataPortabilityRequest: true
        }
      });

      this.logInfo('Personal data exported', {
        exportId,
        subjectId,
        format,
        recordCount: exportData.recordCount
      });

      return {
        success: true,
        data: { exportId, downloadUrl }
      };

    } catch (error) {
      this.logError('Failed to export personal data', error, { subjectId, format });

      return {
        success: false,
        error: {
          code: 'GDPR_EXPORT_ERROR',
          message: 'Failed to export personal data',
          details: error instanceof Error ? error.message : 'Unknown error',
          standard: 'GDPR',
          severity: 'medium'
        }
      };
    }
  }

  /**
   * Record GDPR breach
   */
  async recordBreach(
    context: ComplianceContext,
    breach: Omit<GDPRBreach, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ComplianceResponse<{ breachId: string }>> {
    try {
      const breachRecord: GDPRBreach = {
        id: this.generateUniqueId(),
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'identified',
        ...breach
      };

      // Store breach record
      this.gdprBreaches.push(breachRecord);

      // Check notification requirements
      const requiresSupervisoryNotification = this.requiresSupervisoryAuthorityNotification(breachRecord);
      const requiresIndividualNotification = this.requiresIndividualNotification(breachRecord);

      breachRecord.supervisoryAuthorityNotification.required = requiresSupervisoryNotification;
      breachRecord.individualNotification.required = requiresIndividualNotification;

      // Log to audit system
      await this.auditLogger.log({
        action: 'create' as any,
        resourceType: 'gdpr_breach',
        resourceId: breachRecord.id,
        ehrSystem: 'WebQX-GDPR',
        success: true,
        context: {
          riskToIndividuals: breachRecord.riskToIndividuals,
          approximateIndividualsAffected: breachRecord.approximateIndividualsAffected,
          dataCategories: breachRecord.dataCategories,
          requiresSupervisoryNotification,
          requiresIndividualNotification
        }
      });

      this.logInfo('GDPR breach recorded', {
        breachId: breachRecord.id,
        riskLevel: breachRecord.riskToIndividuals,
        individualsAffected: breachRecord.approximateIndividualsAffected,
        requiresSupervisoryNotification,
        requiresIndividualNotification
      });

      return {
        success: true,
        data: { breachId: breachRecord.id },
        auditId: breachRecord.id
      };

    } catch (error) {
      this.logError('Failed to record GDPR breach', error, { 
        riskLevel: breach.riskToIndividuals 
      });

      return {
        success: false,
        error: {
          code: 'GDPR_BREACH_RECORD_ERROR',
          message: 'Failed to record GDPR breach',
          details: error instanceof Error ? error.message : 'Unknown error',
          standard: 'GDPR',
          severity: 'critical'
        }
      };
    }
  }

  // Private helper methods

  private async logToMainAuditSystem(eventType: string, record: any): Promise<void> {
    try {
      const auditInput: AuditLogInput = {
        action: eventType as any,
        resourceType: 'gdpr_consent',
        resourceId: record.id,
        ehrSystem: 'WebQX-GDPR',
        success: true,
        context: {
          gdprCompliance: true,
          subjectId: record.subjectId,
          consentType: record.consentType,
          legalBasis: record.legalBasis
        }
      };

      await this.auditLogger.log(auditInput);
    } catch (error) {
      this.logError('Failed to log to main audit system', error);
    }
  }

  private async performDataErasure(subjectId: string): Promise<number> {
    // Simulate data erasure across systems
    let deletedRecords = 0;

    // Remove consent records
    const consentCount = this.consentRecords.filter(c => c.subjectId === subjectId).length;
    this.consentRecords = this.consentRecords.filter(c => c.subjectId !== subjectId);
    deletedRecords += consentCount;

    // In a real implementation, this would:
    // - Delete from patient records
    // - Delete from audit logs (where legally permissible)
    // - Delete from backup systems
    // - Notify third-party processors
    // - Update derived/aggregated data

    return deletedRecords;
  }

  private async collectPersonalData(subjectId: string): Promise<{ recordCount: number; data: any }> {
    // Simulate collecting all personal data for a subject
    const consentRecords = this.consentRecords.filter(c => c.subjectId === subjectId);
    const requests = this.dataSubjectRequests.filter(r => r.subjectId === subjectId);

    // In a real implementation, this would collect from:
    // - Patient records
    // - Appointment history
    // - Medical records
    // - Billing information
    // - Communication logs
    // - Access logs

    return {
      recordCount: consentRecords.length + requests.length,
      data: {
        consents: consentRecords,
        requests: requests
      }
    };
  }

  private async generateExportFile(data: any, format: string, exportId: string): Promise<string> {
    // In a real implementation, this would generate and store the export file
    // and return a secure download URL
    return `/gdpr/exports/${exportId}.${format}`;
  }

  private requiresSupervisoryAuthorityNotification(breach: GDPRBreach): boolean {
    // GDPR Article 33: Notification within 72 hours unless unlikely to result in risk
    return breach.riskToIndividuals !== 'low' || breach.approximateIndividualsAffected > 100;
  }

  private requiresIndividualNotification(breach: GDPRBreach): boolean {
    // GDPR Article 34: Notification required if high risk to individuals
    return breach.riskToIndividuals === 'high';
  }

  private generateUniqueId(): string {
    return `gdpr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private logInfo(message: string, context?: Record<string, unknown>): void {
    if (this.config.logging.enabled && this.config.logging.level !== 'error') {
      console.log(`[GDPR Service] ${message}`, context || {});
    }
  }

  private logError(message: string, error: unknown, context?: Record<string, unknown>): void {
    if (this.config.logging.enabled) {
      console.error(`[GDPR Service] ${message}`, { 
        error: error instanceof Error ? error.message : error,
        context: context || {} 
      });
    }
  }
}