/**
 * Compliance Manager Service
 * 
 * Main orchestrator for all compliance standards (HIPAA, GDPR, ISO/IEC 27001)
 * Integrates with existing WebQX audit logging and auth systems
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { 
  ComplianceConfig, 
  ComplianceContext, 
  ComplianceResponse, 
  ComplianceAuditEntry,
  ComplianceStandard,
  ComplianceEventType,
  DataSensitivityLevel,
  ComplianceRiskLevel,
  ComplianceError,
  ComplianceServiceConfig
} from '../types/compliance';

import { HIPAAService } from '../types/hipaa';
import { GDPRService } from '../types/gdpr';
import { ISO27001Service } from '../types/iso27001';

// Import existing WebQX services
import { AuditLogger, AuditLogInput } from '../../ehr-integrations/services/auditLogger';

/**
 * Main compliance manager that coordinates all compliance standards
 */
export class ComplianceManager {
  private config: ComplianceConfig;
  private auditLogger: AuditLogger;
  private hipaaService?: HIPAAService;
  private gdprService?: GDPRService;
  private iso27001Service?: ISO27001Service;
  
  private complianceAuditLog: ComplianceAuditEntry[] = [];
  private readonly maxComplianceLogEntries = 10000;

  constructor(config: ComplianceConfig, auditLogger?: AuditLogger) {
    this.config = config;
    
    // Use existing audit logger or create new one
    this.auditLogger = auditLogger || new AuditLogger({
      enabled: true,
      maxInMemoryEntries: this.maxComplianceLogEntries,
      retentionDays: Math.max(
        config.hipaa.auditRetentionDays,
        config.gdpr.consentExpiryDays,
        365 // Minimum 1 year for compliance
      ),
      logToConsole: true,
      logToFile: false,
      logToExternalService: false,
      externalServiceEndpoint: '[NOT_CONFIGURED]'
    });

    this.logInfo('Compliance Manager initialized', { 
      hipaaEnabled: config.hipaa.enabled,
      gdprEnabled: config.gdpr.enabled,
      iso27001Enabled: config.iso27001.enabled
    });
  }

  /**
   * Initialize compliance services based on configuration
   */
  async initialize(): Promise<void> {
    try {
      // Dynamic imports to avoid loading unused services
      if (this.config.hipaa.enabled) {
        const { HIPAAServiceImpl } = await import('./hipaaService');
        this.hipaaService = new HIPAAServiceImpl(this.config.hipaa, this.auditLogger);
      }

      if (this.config.gdpr.enabled) {
        const { GDPRServiceImpl } = await import('./gdprService');
        this.gdprService = new GDPRServiceImpl(this.config.gdpr, this.auditLogger);
      }

      if (this.config.iso27001.enabled) {
        const { ISO27001ServiceImpl } = await import('./iso27001Service');
        this.iso27001Service = new ISO27001ServiceImpl(this.config.iso27001, this.auditLogger);
      }

      this.logInfo('Compliance services initialized successfully');
    } catch (error) {
      this.logError('Failed to initialize compliance services', error);
      throw error;
    }
  }

  /**
   * Get the configured HIPAA service
   */
  getHIPAAService(): HIPAAService | undefined {
    return this.hipaaService;
  }

  /**
   * Get the configured GDPR service
   */
  getGDPRService(): GDPRService | undefined {
    return this.gdprService;
  }

  /**
   * Get the configured ISO/IEC 27001 service
   */
  getISO27001Service(): ISO27001Service | undefined {
    return this.iso27001Service;
  }

  /**
   * Log a compliance event to the audit trail
   */
  async logComplianceEvent(
    context: ComplianceContext,
    standard: ComplianceStandard,
    eventType: ComplianceEventType,
    details: {
      resourceType: string;
      resourceId: string;
      patientId?: string;
      action: string;
      success: boolean;
      sensitivityLevel: DataSensitivityLevel;
      riskLevel: ComplianceRiskLevel;
      errorMessage?: string;
      additionalContext?: Record<string, unknown>;
    }
  ): Promise<ComplianceResponse<{ auditId: string }>> {
    try {
      const auditEntry: ComplianceAuditEntry = {
        id: this.generateUniqueId(),
        timestamp: new Date(),
        standard,
        eventType,
        userId: context.userId,
        userRole: context.userRole,
        resourceType: details.resourceType,
        resourceId: details.resourceId,
        patientId: details.patientId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        action: details.action,
        success: details.success,
        errorMessage: details.errorMessage,
        context: {
          sessionId: context.sessionId,
          requestId: context.requestId,
          ...details.additionalContext
        },
        sensitivityLevel: details.sensitivityLevel,
        riskLevel: details.riskLevel
      };

      // Store in compliance-specific audit log
      this.addToComplianceLog(auditEntry);

      // Also log to main WebQX audit system for integration
      await this.logToWebQXAudit(auditEntry);

      return {
        success: true,
        data: { auditId: auditEntry.id },
        auditId: auditEntry.id
      };

    } catch (error) {
      const complianceError: ComplianceError = {
        code: 'COMPLIANCE_AUDIT_ERROR',
        message: 'Failed to log compliance event',
        details: error instanceof Error ? error.message : 'Unknown error',
        standard,
        severity: 'high',
        remediation: 'Check audit logging configuration and permissions'
      };

      this.logError('Failed to log compliance event', error, { 
        standard, 
        eventType, 
        context: this.sanitizeContext(context) 
      });
      
      return { success: false, error: complianceError };
    }
  }

  /**
   * Validate compliance for a specific action
   */
  async validateCompliance(
    context: ComplianceContext,
    action: {
      type: string;
      resourceType: string;
      resourceId: string;
      patientId?: string;
      sensitivityLevel: DataSensitivityLevel;
    }
  ): Promise<ComplianceResponse<{ 
    compliant: boolean; 
    warnings: string[];
    requiredActions: string[];
  }>> {
    try {
      const warnings: string[] = [];
      const requiredActions: string[] = [];
      let compliant = true;

      // HIPAA validation
      if (this.config.hipaa.enabled && this.isPhiRelated(action)) {
        const hipaaValidation = await this.validateHIPAACompliance(context, action);
        if (!hipaaValidation.success) {
          compliant = false;
          warnings.push(`HIPAA: ${hipaaValidation.error?.message || 'Validation failed'}`);
        }
      }

      // GDPR validation  
      if (this.config.gdpr.enabled && this.isPersonalDataRelated(action)) {
        const gdprValidation = await this.validateGDPRCompliance(context, action);
        if (!gdprValidation.success) {
          compliant = false;
          warnings.push(`GDPR: ${gdprValidation.error?.message || 'Validation failed'}`);
        }
      }

      // ISO 27001 validation
      if (this.config.iso27001.enabled) {
        const iso27001Validation = await this.validateISO27001Compliance(context, action);
        if (!iso27001Validation.success) {
          compliant = false;
          warnings.push(`ISO 27001: ${iso27001Validation.error?.message || 'Validation failed'}`);
        }
      }

      // Log the compliance check
      await this.logComplianceEvent(context, 'HIPAA', 'phi_access', {
        resourceType: action.resourceType,
        resourceId: action.resourceId,
        patientId: action.patientId,
        action: `compliance_check_${action.type}`,
        success: compliant,
        sensitivityLevel: action.sensitivityLevel,
        riskLevel: compliant ? 'low' : 'high',
        additionalContext: { warnings, requiredActions }
      });

      return {
        success: true,
        data: { compliant, warnings, requiredActions }
      };

    } catch (error) {
      this.logError('Compliance validation failed', error, { 
        action: this.sanitizeAction(action),
        context: this.sanitizeContext(context)
      });

      return {
        success: false,
        error: {
          code: 'COMPLIANCE_VALIDATION_ERROR',
          message: 'Failed to validate compliance',
          details: error instanceof Error ? error.message : 'Unknown error',
          standard: 'HIPAA', // Default to HIPAA for now
          severity: 'critical'
        }
      };
    }
  }

  /**
   * Search compliance audit logs
   */
  async searchComplianceAudit(
    context: ComplianceContext,
    criteria: {
      startDate?: Date;
      endDate?: Date;
      standard?: ComplianceStandard;
      eventType?: ComplianceEventType;
      userId?: string;
      patientId?: string;
      riskLevel?: ComplianceRiskLevel;
      limit?: number;
      offset?: number;
    }
  ): Promise<ComplianceResponse<{
    entries: ComplianceAuditEntry[];
    total: number;
    hasMore: boolean;
  }>> {
    try {
      // Log the search request itself
      await this.logComplianceEvent(context, 'ISO27001', 'access_control_audit', {
        resourceType: 'compliance_audit',
        resourceId: 'search',
        action: 'search_compliance_logs',
        success: true,
        sensitivityLevel: 'confidential',
        riskLevel: 'medium',
        additionalContext: { searchCriteria: this.sanitizeCriteria(criteria) }
      });

      // Filter compliance logs
      let filteredEntries = this.complianceAuditLog.filter(entry => {
        if (criteria.startDate && entry.timestamp < criteria.startDate) return false;
        if (criteria.endDate && entry.timestamp > criteria.endDate) return false;
        if (criteria.standard && entry.standard !== criteria.standard) return false;
        if (criteria.eventType && entry.eventType !== criteria.eventType) return false;
        if (criteria.userId && entry.userId !== criteria.userId) return false;
        if (criteria.patientId && entry.patientId !== criteria.patientId) return false;
        if (criteria.riskLevel && entry.riskLevel !== criteria.riskLevel) return false;
        return true;
      });

      // Sort by timestamp (newest first)
      filteredEntries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      const total = filteredEntries.length;
      const offset = criteria.offset || 0;
      const limit = criteria.limit || 100;

      // Apply pagination
      const paginatedEntries = filteredEntries.slice(offset, offset + limit);
      const hasMore = offset + limit < total;

      return {
        success: true,
        data: {
          entries: paginatedEntries,
          total,
          hasMore
        }
      };

    } catch (error) {
      this.logError('Compliance audit search failed', error, { 
        criteria: this.sanitizeCriteria(criteria)
      });

      return {
        success: false,
        error: {
          code: 'COMPLIANCE_SEARCH_ERROR',
          message: 'Failed to search compliance audit logs',
          details: error instanceof Error ? error.message : 'Unknown error',
          standard: 'ISO27001',
          severity: 'medium'
        }
      };
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    context: ComplianceContext,
    reportType: 'summary' | 'detailed' | 'incidents',
    period: { startDate: Date; endDate: Date },
    standards?: ComplianceStandard[]
  ): Promise<ComplianceResponse<{ reportId: string; downloadUrl?: string }>> {
    try {
      const reportId = this.generateUniqueId();
      
      // Log report generation
      await this.logComplianceEvent(context, 'ISO27001', 'access_control_audit', {
        resourceType: 'compliance_report',
        resourceId: reportId,
        action: `generate_${reportType}_report`,
        success: true,
        sensitivityLevel: 'confidential',
        riskLevel: 'medium',
        additionalContext: { reportType, period, standards }
      });

      // Generate report (implementation would depend on reporting requirements)
      // For now, return success with placeholder
      return {
        success: true,
        data: { 
          reportId,
          // downloadUrl would be implemented based on file storage system
        }
      };

    } catch (error) {
      this.logError('Compliance report generation failed', error, { 
        reportType, 
        period, 
        standards 
      });

      return {
        success: false,
        error: {
          code: 'COMPLIANCE_REPORT_ERROR',
          message: 'Failed to generate compliance report',
          details: error instanceof Error ? error.message : 'Unknown error',
          standard: 'ISO27001',
          severity: 'medium'
        }
      };
    }
  }

  // Private helper methods

  private addToComplianceLog(entry: ComplianceAuditEntry): void {
    this.complianceAuditLog.push(entry);
    
    // Keep logs within memory limits
    if (this.complianceAuditLog.length > this.maxComplianceLogEntries) {
      this.complianceAuditLog = this.complianceAuditLog.slice(-this.maxComplianceLogEntries);
    }
  }

  private async logToWebQXAudit(entry: ComplianceAuditEntry): Promise<void> {
    try {
      const auditInput: AuditLogInput = {
        action: entry.eventType as any, // Map to existing audit actions
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        patientMrn: entry.patientId,
        ehrSystem: 'WebQX-Compliance',
        success: entry.success,
        errorMessage: entry.errorMessage,
        context: {
          complianceStandard: entry.standard,
          sensitivityLevel: entry.sensitivityLevel,
          riskLevel: entry.riskLevel,
          ...entry.context
        }
      };

      await this.auditLogger.log(auditInput);
    } catch (error) {
      this.logError('Failed to log to WebQX audit system', error);
    }
  }

  private generateUniqueId(): string {
    return `compliance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isPhiRelated(action: any): boolean {
    const phiRelatedTypes = ['patient', 'medical_record', 'lab_result', 'prescription', 'appointment'];
    return phiRelatedTypes.includes(action.resourceType.toLowerCase()) ||
           action.sensitivityLevel === 'restricted' || 
           action.sensitivityLevel === 'confidential';
  }

  private isPersonalDataRelated(action: any): boolean {
    const personalDataTypes = ['patient', 'user', 'contact', 'demographic'];
    return personalDataTypes.includes(action.resourceType.toLowerCase()) ||
           action.sensitivityLevel !== 'public';
  }

  private async validateHIPAACompliance(context: ComplianceContext, action: any): Promise<ComplianceResponse> {
    // Implement HIPAA-specific validation logic
    // This would integrate with the HIPAA service
    return { success: true };
  }

  private async validateGDPRCompliance(context: ComplianceContext, action: any): Promise<ComplianceResponse> {
    // Implement GDPR-specific validation logic
    // This would integrate with the GDPR service
    return { success: true };
  }

  private async validateISO27001Compliance(context: ComplianceContext, action: any): Promise<ComplianceResponse> {
    // Implement ISO 27001-specific validation logic
    // This would integrate with the ISO 27001 service
    return { success: true };
  }

  // Utility methods for logging and sanitization

  private logInfo(message: string, context?: Record<string, unknown>): void {
    console.log(`[Compliance Manager] ${message}`, context || {});
  }

  private logError(message: string, error: unknown, context?: Record<string, unknown>): void {
    console.error(`[Compliance Manager] ${message}`, { 
      error: error instanceof Error ? error.message : error,
      context: context || {} 
    });
  }

  private sanitizeContext(context: ComplianceContext): Record<string, unknown> {
    return {
      userId: context.userId,
      userRole: context.userRole,
      sessionId: context.sessionId,
      requestId: context.requestId
      // Exclude potentially sensitive data like IP addresses in logs
    };
  }

  private sanitizeAction(action: any): Record<string, unknown> {
    return {
      type: action.type,
      resourceType: action.resourceType,
      sensitivityLevel: action.sensitivityLevel
      // Exclude actual resource IDs and patient IDs from logs
    };
  }

  private sanitizeCriteria(criteria: any): Record<string, unknown> {
    return {
      standard: criteria.standard,
      eventType: criteria.eventType,
      riskLevel: criteria.riskLevel,
      hasDateRange: !!(criteria.startDate && criteria.endDate),
      limit: criteria.limit || 100
      // Exclude specific user/patient IDs from logs
    };
  }
}