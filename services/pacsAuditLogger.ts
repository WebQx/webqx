/**
 * PACS Audit Logger Service
 * 
 * Extends the existing audit logging system to include PACS-specific
 * audit events for DICOM operations and imaging study access.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

export interface PacsAuditContext {
  userId?: string;
  userRole?: string;
  specialty?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  pacsSystem?: string;
  studyInstanceUID?: string;
  seriesInstanceUID?: string;
  sopInstanceUID?: string;
  patientId?: string;
  accessionNumber?: string;
  modality?: string;
  bodyPart?: string;
}

export interface PacsAuditEvent {
  action: PacsAuditAction;
  resourceType: 'ImagingStudy' | 'DicomImage' | 'RoutingRule' | 'PacsConfig';
  resourceId: string;
  studyDescription?: string;
  success: boolean;
  errorMessage?: string;
  context?: Record<string, unknown>;
  performance?: {
    duration?: number;
    cacheHit?: boolean;
    dataSize?: number;
  };
}

export type PacsAuditAction = 
  | 'pacs.study.search'
  | 'pacs.study.view'
  | 'pacs.study.route'
  | 'pacs.image.view'
  | 'pacs.image.download'
  | 'pacs.image.measure'
  | 'pacs.image.annotate'
  | 'pacs.series.access'
  | 'pacs.routing.configure'
  | 'pacs.routing.execute'
  | 'pacs.cache.access'
  | 'pacs.cache.prefetch'
  | 'pacs.config.update'
  | 'pacs.export.execute'
  | 'pacs.share.create'
  | 'pacs.share.access';

/**
 * PACS Audit Logger Service
 */
export class PacsAuditLogger {
  private auditLogs: Array<PacsAuditEvent & { timestamp: Date; context: PacsAuditContext }> = [];
  private config: {
    enabled: boolean;
    maxEntries: number;
    retentionDays: number;
    logToConsole: boolean;
    logToFile: boolean;
    logFilePath: string;
  };

  constructor(config?: Partial<typeof this.config>) {
    this.config = {
      enabled: true,
      maxEntries: 10000,
      retentionDays: 2555, // 7 years for HIPAA compliance
      logToConsole: process.env.NODE_ENV === 'development',
      logToFile: true,
      logFilePath: './pacs-audit.log',
      ...config
    };

    if (this.config.enabled) {
      this.logInfo('PACS Audit Logger initialized', { config: this.config });
    }
  }

  /**
   * Log a PACS audit event
   */
  async logEvent(event: PacsAuditEvent, context: PacsAuditContext): Promise<void> {
    if (!this.config.enabled) return;

    const auditEntry = {
      ...event,
      timestamp: new Date(),
      context: {
        ...context,
        requestId: context.requestId || this.generateRequestId()
      }
    };

    // Add to in-memory store
    this.auditLogs.push(auditEntry);

    // Enforce max entries limit
    if (this.auditLogs.length > this.config.maxEntries) {
      this.auditLogs = this.auditLogs.slice(-this.config.maxEntries);
    }

    // Log to console if enabled
    if (this.config.logToConsole) {
      this.logToConsole(auditEntry);
    }

    // Log to file if enabled
    if (this.config.logToFile) {
      await this.logToFile(auditEntry);
    }

    // Clean up old entries
    this.cleanupOldEntries();
  }

  /**
   * Log PACS study search
   */
  async logStudySearch(
    criteria: any,
    results: number,
    context: PacsAuditContext,
    success: boolean,
    error?: string
  ): Promise<void> {
    await this.logEvent({
      action: 'pacs.study.search',
      resourceType: 'ImagingStudy',
      resourceId: JSON.stringify(criteria),
      success,
      errorMessage: error,
      context: {
        searchCriteria: criteria,
        resultCount: results
      }
    }, context);
  }

  /**
   * Log PACS study access
   */
  async logStudyAccess(
    studyInstanceUID: string,
    studyDescription: string,
    context: PacsAuditContext,
    success: boolean,
    error?: string
  ): Promise<void> {
    await this.logEvent({
      action: 'pacs.study.view',
      resourceType: 'ImagingStudy',
      resourceId: studyInstanceUID,
      studyDescription,
      success,
      errorMessage: error
    }, {
      ...context,
      studyInstanceUID
    });
  }

  /**
   * Log PACS image viewing
   */
  async logImageView(
    studyInstanceUID: string,
    seriesInstanceUID: string,
    sopInstanceUID: string,
    context: PacsAuditContext,
    performance?: { duration: number; cacheHit: boolean },
    success: boolean = true,
    error?: string
  ): Promise<void> {
    await this.logEvent({
      action: 'pacs.image.view',
      resourceType: 'DicomImage',
      resourceId: sopInstanceUID,
      success,
      errorMessage: error,
      performance
    }, {
      ...context,
      studyInstanceUID,
      seriesInstanceUID,
      sopInstanceUID
    });
  }

  /**
   * Log study routing event
   */
  async logStudyRouting(
    studyInstanceUID: string,
    routingResult: any,
    context: PacsAuditContext,
    success: boolean,
    error?: string
  ): Promise<void> {
    await this.logEvent({
      action: 'pacs.routing.execute',
      resourceType: 'ImagingStudy',
      resourceId: studyInstanceUID,
      success,
      errorMessage: error,
      context: {
        routingResult,
        primarySpecialty: routingResult?.primarySpecialty,
        secondarySpecialties: routingResult?.secondarySpecialties,
        priority: routingResult?.priority
      }
    }, {
      ...context,
      studyInstanceUID,
      specialty: routingResult?.primarySpecialty
    });
  }

  /**
   * Log image measurement activity
   */
  async logImageMeasurement(
    studyInstanceUID: string,
    seriesInstanceUID: string,
    sopInstanceUID: string,
    measurementType: string,
    measurementValue: any,
    context: PacsAuditContext,
    success: boolean = true,
    error?: string
  ): Promise<void> {
    await this.logEvent({
      action: 'pacs.image.measure',
      resourceType: 'DicomImage',
      resourceId: sopInstanceUID,
      success,
      errorMessage: error,
      context: {
        measurementType,
        measurementValue
      }
    }, {
      ...context,
      studyInstanceUID,
      seriesInstanceUID,
      sopInstanceUID
    });
  }

  /**
   * Log image annotation activity
   */
  async logImageAnnotation(
    studyInstanceUID: string,
    seriesInstanceUID: string,
    sopInstanceUID: string,
    annotationType: string,
    context: PacsAuditContext,
    success: boolean = true,
    error?: string
  ): Promise<void> {
    await this.logEvent({
      action: 'pacs.image.annotate',
      resourceType: 'DicomImage',
      resourceId: sopInstanceUID,
      success,
      errorMessage: error,
      context: {
        annotationType
      }
    }, {
      ...context,
      studyInstanceUID,
      seriesInstanceUID,
      sopInstanceUID
    });
  }

  /**
   * Log cache access
   */
  async logCacheAccess(
    cacheKey: string,
    cacheHit: boolean,
    context: PacsAuditContext
  ): Promise<void> {
    await this.logEvent({
      action: 'pacs.cache.access',
      resourceType: 'ImagingStudy',
      resourceId: cacheKey,
      success: true,
      performance: {
        cacheHit
      }
    }, context);
  }

  /**
   * Search audit logs
   */
  searchLogs(criteria: {
    startDate?: Date;
    endDate?: Date;
    userId?: string;
    action?: PacsAuditAction;
    resourceType?: string;
    studyInstanceUID?: string;
    patientId?: string;
    specialty?: string;
    success?: boolean;
    limit?: number;
    offset?: number;
  }): Array<PacsAuditEvent & { timestamp: Date; context: PacsAuditContext }> {
    let filteredLogs = this.auditLogs;

    // Apply filters
    if (criteria.startDate) {
      filteredLogs = filteredLogs.filter(log => log.timestamp >= criteria.startDate!);
    }
    if (criteria.endDate) {
      filteredLogs = filteredLogs.filter(log => log.timestamp <= criteria.endDate!);
    }
    if (criteria.userId) {
      filteredLogs = filteredLogs.filter(log => log.context.userId === criteria.userId);
    }
    if (criteria.action) {
      filteredLogs = filteredLogs.filter(log => log.action === criteria.action);
    }
    if (criteria.resourceType) {
      filteredLogs = filteredLogs.filter(log => log.resourceType === criteria.resourceType);
    }
    if (criteria.studyInstanceUID) {
      filteredLogs = filteredLogs.filter(log => 
        log.context.studyInstanceUID === criteria.studyInstanceUID
      );
    }
    if (criteria.patientId) {
      filteredLogs = filteredLogs.filter(log => log.context.patientId === criteria.patientId);
    }
    if (criteria.specialty) {
      filteredLogs = filteredLogs.filter(log => log.context.specialty === criteria.specialty);
    }
    if (criteria.success !== undefined) {
      filteredLogs = filteredLogs.filter(log => log.success === criteria.success);
    }

    // Sort by timestamp (most recent first)
    filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const offset = criteria.offset || 0;
    const limit = criteria.limit || 100;
    return filteredLogs.slice(offset, offset + limit);
  }

  /**
   * Get audit statistics
   */
  getAuditStatistics(): {
    totalEvents: number;
    eventsByAction: Record<string, number>;
    eventsByResourceType: Record<string, number>;
    eventsBySpecialty: Record<string, number>;
    successRate: number;
    averageResponseTime: number;
    cacheHitRate: number;
  } {
    const total = this.auditLogs.length;
    const eventsByAction: Record<string, number> = {};
    const eventsByResourceType: Record<string, number> = {};
    const eventsBySpecialty: Record<string, number> = {};
    let successCount = 0;
    let totalDuration = 0;
    let durationCount = 0;
    let cacheHits = 0;
    let cacheAccesses = 0;

    this.auditLogs.forEach(log => {
      // Count by action
      eventsByAction[log.action] = (eventsByAction[log.action] || 0) + 1;
      
      // Count by resource type
      eventsByResourceType[log.resourceType] = (eventsByResourceType[log.resourceType] || 0) + 1;
      
      // Count by specialty
      if (log.context.specialty) {
        eventsBySpecialty[log.context.specialty] = (eventsBySpecialty[log.context.specialty] || 0) + 1;
      }
      
      // Success rate
      if (log.success) successCount++;
      
      // Performance metrics
      if (log.performance?.duration) {
        totalDuration += log.performance.duration;
        durationCount++;
      }
      
      // Cache metrics
      if (log.performance?.cacheHit !== undefined) {
        cacheAccesses++;
        if (log.performance.cacheHit) cacheHits++;
      }
    });

    return {
      totalEvents: total,
      eventsByAction,
      eventsByResourceType,
      eventsBySpecialty,
      successRate: total > 0 ? successCount / total : 0,
      averageResponseTime: durationCount > 0 ? totalDuration / durationCount : 0,
      cacheHitRate: cacheAccesses > 0 ? cacheHits / cacheAccesses : 0
    };
  }

  /**
   * Export audit logs for compliance reporting
   */
  exportAuditLogs(criteria?: {
    startDate?: Date;
    endDate?: Date;
    format?: 'json' | 'csv';
  }): string {
    const logs = this.searchLogs(criteria || {});
    
    if (criteria?.format === 'csv') {
      const headers = ['Timestamp', 'Action', 'Resource Type', 'Resource ID', 'User ID', 'User Role', 'Specialty', 'Success', 'Error Message'];
      const csvRows = [
        headers.join(','),
        ...logs.map(log => [
          log.timestamp.toISOString(),
          log.action,
          log.resourceType,
          log.resourceId,
          log.context.userId || '',
          log.context.userRole || '',
          log.context.specialty || '',
          log.success.toString(),
          log.errorMessage || ''
        ].map(field => `"${field}"`).join(','))
      ];
      return csvRows.join('\n');
    }
    
    return JSON.stringify(logs, null, 2);
  }

  /**
   * Log to console
   */
  private logToConsole(entry: any): void {
    const level = entry.success ? 'info' : 'error';
    const message = `[PACS Audit] ${entry.action} - ${entry.resourceType}:${entry.resourceId}`;
    console.log(`[${entry.timestamp.toISOString()}] ${message}`, {
      userId: entry.context.userId,
      specialty: entry.context.specialty,
      success: entry.success,
      error: entry.errorMessage
    });
  }

  /**
   * Log to file (mock implementation)
   */
  private async logToFile(entry: any): Promise<void> {
    // In a real implementation, this would write to a file
    // For now, just append to in-memory store
  }

  /**
   * Clean up old audit entries
   */
  private cleanupOldEntries(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
    
    this.auditLogs = this.auditLogs.filter(log => log.timestamp >= cutoffDate);
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `pacs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log informational message
   */
  private logInfo(message: string, data?: any): void {
    if (this.config.logToConsole) {
      console.log(`[PACS Audit Logger] ${message}`, data);
    }
  }
}

export default PacsAuditLogger;