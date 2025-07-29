/**
 * PACS-specific Audit Logger Service
 * 
 * Enhanced audit logging specifically for PACS (Picture Archiving and Communication System)
 * operations, ensuring comprehensive tracking of all imaging-related activities
 * for HIPAA compliance.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { AuditLogger, AuditContext, AuditLogInput } from './auditLogger';
import { EHRApiResponse, EHRApiError } from '../types';

/**
 * PACS-specific audit actions
 */
export type PACSAuditAction = 
  | 'pacs_image_view'
  | 'pacs_image_download'
  | 'pacs_image_upload'
  | 'pacs_image_delete'
  | 'pacs_study_access'
  | 'pacs_series_access'
  | 'pacs_report_generate'
  | 'pacs_annotation_create'
  | 'pacs_annotation_edit'
  | 'pacs_annotation_delete'
  | 'pacs_share_external'
  | 'pacs_transcription_start'
  | 'pacs_transcription_complete'
  | 'pacs_backup_create'
  | 'pacs_restore_execute'
  | 'pacs_system_config'
  | 'pacs_user_access';

/**
 * PACS resource types
 */
export type PACSResourceType = 
  | 'dicom_image'
  | 'dicom_study'
  | 'dicom_series'
  | 'pacs_report'
  | 'pacs_annotation'
  | 'pacs_workstation'
  | 'pacs_storage'
  | 'pacs_user'
  | 'pacs_config';

/**
 * PACS audit log entry structure
 */
export interface PACSAuditLogEntry {
  /** Standard audit fields */
  id: string;
  timestamp: Date;
  userId: string;
  userRole: string;
  action: PACSAuditAction;
  resourceType: PACSResourceType;
  resourceId: string;
  patientMrn?: string;
  success: boolean;
  errorMessage?: string;

  /** PACS-specific fields */
  studyInstanceUID?: string;
  seriesInstanceUID?: string;
  sopInstanceUID?: string;
  modality?: string;
  studyDate?: Date;
  radiologist?: string;
  referringPhysician?: string;
  imagingDevice?: string;
  bodyPart?: string;
  
  /** Access control and compliance */
  accessLevel: 'view' | 'edit' | 'admin' | 'system';
  accessJustification?: string;
  consentStatus?: 'granted' | 'pending' | 'denied';
  
  /** Technical details */
  imageSize?: number;
  compressionType?: string;
  transmissionProtocol?: string;
  encryptionStatus?: 'encrypted' | 'unencrypted' | 'partial';
  
  /** Context information */
  workstationId?: string;
  networkLocation?: string;
  viewerVersion?: string;
  
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * PACS audit input structure
 */
export interface PACSAuditInput {
  action: PACSAuditAction;
  resourceType: PACSResourceType;
  resourceId: string;
  patientMrn?: string;
  success: boolean;
  errorMessage?: string;
  
  /** PACS-specific context */
  pacsContext?: {
    studyInstanceUID?: string;
    seriesInstanceUID?: string;
    sopInstanceUID?: string;
    modality?: string;
    studyDate?: Date;
    radiologist?: string;
    referringPhysician?: string;
    imagingDevice?: string;
    bodyPart?: string;
    accessLevel: 'view' | 'edit' | 'admin' | 'system';
    accessJustification?: string;
    consentStatus?: 'granted' | 'pending' | 'denied';
    imageSize?: number;
    compressionType?: string;
    transmissionProtocol?: string;
    encryptionStatus?: 'encrypted' | 'unencrypted' | 'partial';
    workstationId?: string;
    networkLocation?: string;
    viewerVersion?: string;
  };
  
  context?: Record<string, unknown>;
}

/**
 * PACS Audit Logger - specialized for imaging system audit requirements
 */
export class PACSAuditLogger extends AuditLogger {
  private pacsInMemoryLogs: PACSAuditLogEntry[] = [];

  /**
   * Log PACS-specific audit entry
   * @param input PACS audit input data
   * @returns Promise resolving to success status
   */
  async logPACS(input: PACSAuditInput): Promise<EHRApiResponse<{ logId: string }>> {
    try {
      // Create PACS-specific audit entry
      const pacsLogEntry: PACSAuditLogEntry = {
        id: this.generateLogId(),
        timestamp: new Date(),
        userId: this.getCurrentContext().userId || 'system',
        userRole: this.getCurrentContext().userRole || 'unknown',
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        patientMrn: input.patientMrn,
        success: input.success,
        errorMessage: input.errorMessage,
        
        // PACS-specific fields from context
        studyInstanceUID: input.pacsContext?.studyInstanceUID,
        seriesInstanceUID: input.pacsContext?.seriesInstanceUID,
        sopInstanceUID: input.pacsContext?.sopInstanceUID,
        modality: input.pacsContext?.modality,
        studyDate: input.pacsContext?.studyDate,
        radiologist: input.pacsContext?.radiologist,
        referringPhysician: input.pacsContext?.referringPhysician,
        imagingDevice: input.pacsContext?.imagingDevice,
        bodyPart: input.pacsContext?.bodyPart,
        accessLevel: input.pacsContext?.accessLevel || 'view',
        accessJustification: input.pacsContext?.accessJustification,
        consentStatus: input.pacsContext?.consentStatus,
        imageSize: input.pacsContext?.imageSize,
        compressionType: input.pacsContext?.compressionType,
        transmissionProtocol: input.pacsContext?.transmissionProtocol,
        encryptionStatus: input.pacsContext?.encryptionStatus,
        workstationId: input.pacsContext?.workstationId,
        networkLocation: input.pacsContext?.networkLocation,
        viewerVersion: input.pacsContext?.viewerVersion,
        context: input.context
      };

      // Store PACS-specific log
      this.pacsInMemoryLogs.push(pacsLogEntry);
      
      // Also log using standard audit logger
      const standardAuditInput: AuditLogInput = {
        action: input.action as any, // Type assertion for compatibility
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        patientMrn: input.patientMrn,
        success: input.success,
        errorMessage: input.errorMessage,
        context: {
          pacsSpecific: true,
          ...input.pacsContext,
          ...input.context
        }
      };

      const standardResult = await super.log(standardAuditInput);
      
      // Log PACS-specific entry to console if enabled
      if (this.isConsoleLoggingEnabled()) {
        this.logPACSToConsole(pacsLogEntry);
      }

      // Check for high-risk activities that require immediate attention
      await this.checkHighRiskActivity(pacsLogEntry);

      return {
        success: true,
        data: { logId: pacsLogEntry.id },
        metadata: {
          requestId: pacsLogEntry.id,
          timestamp: pacsLogEntry.timestamp,
          processingTimeMs: 0
        }
      };

    } catch (error) {
      const apiError: EHRApiError = {
        code: 'PACS_AUDIT_ERROR',
        message: 'Failed to record PACS audit entry',
        details: error instanceof Error ? error.message : 'Unknown PACS audit error',
        retryable: true
      };

      console.error('[PACS Audit Logger] Failed to record PACS audit entry', apiError, { input });
      return { success: false, error: apiError };
    }
  }

  /**
   * Log DICOM image access
   * @param studyUID Study instance UID
   * @param seriesUID Series instance UID
   * @param sopUID SOP instance UID
   * @param patientMrn Patient MRN
   * @param accessType Type of access
   * @param success Whether access was successful
   */
  async logDICOMAccess(
    studyUID: string,
    seriesUID: string,
    sopUID: string,
    patientMrn: string,
    accessType: 'view' | 'download' | 'edit',
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    const actionMap = {
      'view': 'pacs_image_view' as PACSAuditAction,
      'download': 'pacs_image_download' as PACSAuditAction,
      'edit': 'pacs_annotation_edit' as PACSAuditAction
    };

    await this.logPACS({
      action: actionMap[accessType],
      resourceType: 'dicom_image',
      resourceId: sopUID,
      patientMrn,
      success,
      errorMessage,
      pacsContext: {
        studyInstanceUID: studyUID,
        seriesInstanceUID: seriesUID,
        sopInstanceUID: sopUID,
        accessLevel: accessType === 'edit' ? 'edit' : 'view',
        encryptionStatus: 'encrypted'
      }
    });
  }

  /**
   * Log transcription activity with PACS integration
   * @param studyUID Study instance UID
   * @param transcriptionId Transcription session ID
   * @param language Target language for transcription
   * @param action Transcription action
   * @param success Whether action was successful
   */
  async logTranscriptionActivity(
    studyUID: string,
    transcriptionId: string,
    language: string,
    action: 'start' | 'complete',
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    const pacsAction = action === 'start' ? 'pacs_transcription_start' : 'pacs_transcription_complete';

    await this.logPACS({
      action: pacsAction,
      resourceType: 'pacs_report',
      resourceId: transcriptionId,
      success,
      errorMessage,
      pacsContext: {
        studyInstanceUID: studyUID,
        accessLevel: 'edit',
        encryptionStatus: 'encrypted'
      },
      context: {
        targetLanguage: language,
        multilingualTranscription: true
      }
    });
  }

  /**
   * Get PACS-specific audit logs
   * @param studyUID Optional study UID filter
   * @param patientMrn Optional patient MRN filter
   * @param startDate Optional start date filter
   * @param endDate Optional end date filter
   * @returns PACS audit entries
   */
  async getPACSAuditLogs(
    studyUID?: string,
    patientMrn?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<PACSAuditLogEntry[]> {
    let filteredLogs = this.pacsInMemoryLogs;

    if (studyUID) {
      filteredLogs = filteredLogs.filter(log => log.studyInstanceUID === studyUID);
    }

    if (patientMrn) {
      filteredLogs = filteredLogs.filter(log => log.patientMrn === patientMrn);
    }

    if (startDate) {
      filteredLogs = filteredLogs.filter(log => log.timestamp >= startDate);
    }

    if (endDate) {
      filteredLogs = filteredLogs.filter(log => log.timestamp <= endDate);
    }

    return filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Generate PACS compliance report
   * @param startDate Report start date
   * @param endDate Report end date
   * @returns Compliance report data
   */
  async generateComplianceReport(startDate: Date, endDate: Date): Promise<{
    totalAccesses: number;
    unauthorizedAttempts: number;
    dataBreaches: number;
    encryptionCompliance: number;
    accessByRole: Record<string, number>;
    accessByModality: Record<string, number>;
    criticalEvents: PACSAuditLogEntry[];
  }> {
    const logs = await this.getPACSAuditLogs(undefined, undefined, startDate, endDate);
    
    const totalAccesses = logs.length;
    const unauthorizedAttempts = logs.filter(log => !log.success && log.action.includes('access')).length;
    const dataBreaches = logs.filter(log => 
      log.action.includes('external') || 
      (log.encryptionStatus === 'unencrypted' && log.success)
    ).length;
    
    const encryptedCount = logs.filter(log => log.encryptionStatus === 'encrypted').length;
    const encryptionCompliance = totalAccesses > 0 ? (encryptedCount / totalAccesses) * 100 : 100;
    
    const accessByRole: Record<string, number> = {};
    const accessByModality: Record<string, number> = {};
    
    logs.forEach(log => {
      accessByRole[log.userRole] = (accessByRole[log.userRole] || 0) + 1;
      if (log.modality) {
        accessByModality[log.modality] = (accessByModality[log.modality] || 0) + 1;
      }
    });
    
    const criticalEvents = logs.filter(log => 
      !log.success || 
      log.action.includes('delete') || 
      log.action.includes('external') ||
      log.encryptionStatus === 'unencrypted'
    );

    return {
      totalAccesses,
      unauthorizedAttempts,
      dataBreaches,
      encryptionCompliance,
      accessByRole,
      accessByModality,
      criticalEvents
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Log PACS entry to console
   * @param entry PACS audit log entry
   */
  private logPACSToConsole(entry: PACSAuditLogEntry): void {
    const logMessage = `[PACS AUDIT] ${entry.timestamp.toISOString()} - ${entry.action} - ${entry.resourceType}/${entry.resourceId} - ${entry.success ? 'SUCCESS' : 'FAILURE'}`;
    console.log(logMessage, {
      studyUID: entry.studyInstanceUID,
      modality: entry.modality,
      accessLevel: entry.accessLevel,
      encryption: entry.encryptionStatus
    });
  }

  /**
   * Check for high-risk activities requiring immediate attention
   * @param entry PACS audit log entry
   */
  private async checkHighRiskActivity(entry: PACSAuditLogEntry): Promise<void> {
    const highRiskActions = [
      'pacs_image_delete',
      'pacs_share_external',
      'pacs_system_config'
    ];

    const isHighRisk = 
      highRiskActions.includes(entry.action) ||
      !entry.success ||
      entry.encryptionStatus === 'unencrypted' ||
      entry.accessLevel === 'admin';

    if (isHighRisk) {
      console.warn('[PACS AUDIT] HIGH-RISK ACTIVITY DETECTED', {
        logId: entry.id,
        action: entry.action,
        user: entry.userId,
        resource: `${entry.resourceType}/${entry.resourceId}`,
        timestamp: entry.timestamp.toISOString()
      });

      // In a real implementation, this could trigger alerts:
      // - Send to security team
      // - Log to external SIEM
      // - Generate incident ticket
    }
  }

  /**
   * Get current audit context
   * @returns Current context
   */
  private getCurrentContext(): AuditContext {
    // This would be implemented to get current context from the parent class
    // For now, return empty context
    return {};
  }

  /**
   * Check if console logging is enabled
   * @returns Whether console logging is enabled
   */
  private isConsoleLoggingEnabled(): boolean {
    // This would check the configuration from parent class
    return true;
  }

  /**
   * Generate unique log ID
   * @returns Log ID
   */
  private generateLogId(): string {
    return `pacs_audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default PACSAuditLogger;