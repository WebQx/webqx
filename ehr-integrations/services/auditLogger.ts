/**
 * Audit Logger Service
 * 
 * Comprehensive audit logging service for tracking all user actions,
 * system events, and data access within the EHR integration system.
 * Ensures HIPAA compliance and provides detailed forensic capabilities.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { 
  AuditLogEntry, 
  AuditAction,
  EHRApiResponse,
  EHRApiError 
} from '../types';

/**
 * Audit log context for capturing request details
 */
export interface AuditContext {
  /** User ID performing the action */
  userId?: string;
  /** User role */
  userRole?: string;
  /** Session ID */
  sessionId?: string;
  /** IP address */
  ipAddress?: string;
  /** User agent string */
  userAgent?: string;
  /** Request ID for correlation */
  requestId?: string;
  /** Additional custom context */
  customContext?: Record<string, unknown>;
}

/**
 * Audit log entry to be recorded
 */
export interface AuditLogInput {
  /** Action being performed */
  action: AuditAction;
  /** Type of resource being acted upon */
  resourceType: string;
  /** ID of the resource */
  resourceId: string;
  /** Patient MRN if applicable */
  patientMrn?: string;
  /** EHR system involved */
  ehrSystem?: string;
  /** Whether the action was successful */
  success: boolean;
  /** Error message if action failed */
  errorMessage?: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Audit log search criteria
 */
export interface AuditSearchCriteria {
  /** Start date for search range */
  startDate?: Date;
  /** End date for search range */
  endDate?: Date;
  /** User ID filter */
  userId?: string;
  /** Action type filter */
  action?: AuditAction;
  /** Resource type filter */
  resourceType?: string;
  /** Patient MRN filter */
  patientMrn?: string;
  /** EHR system filter */
  ehrSystem?: string;
  /** Success status filter */
  success?: boolean;
  /** IP address filter */
  ipAddress?: string;
  /** Search text for free-text search */
  searchText?: string;
  /** Maximum number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Audit log configuration options
 */
export interface AuditLoggerConfig {
  /** Whether to enable audit logging */
  enabled: boolean;
  /** Maximum log entries to keep in memory */
  maxInMemoryEntries: number;
  /** Log retention period in days */
  retentionDays: number;
  /** Whether to log to console */
  logToConsole: boolean;
  /** Whether to log to file */
  logToFile: boolean;
  /** Log file path */
  logFilePath?: string;
  /** Whether to send logs to external service */
  logToExternalService: boolean;
  /** External service endpoint */
  externalServiceEndpoint?: string;
}

/**
 * Audit Logger Service
 * 
 * Handles comprehensive audit logging for all EHR integration activities.
 * Provides methods for logging, searching, and managing audit records
 * with full HIPAA compliance and security considerations.
 */
export class AuditLogger {
  private config: Required<AuditLoggerConfig>;
  private inMemoryLogs: AuditLogEntry[] = [];
  private currentContext: AuditContext = {};

  /**
   * Constructor
   * @param config Audit logger configuration
   */
  constructor(config: Partial<AuditLoggerConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      maxInMemoryEntries: config.maxInMemoryEntries ?? 10000,
      retentionDays: config.retentionDays ?? 2555, // 7 years for HIPAA compliance
      logToConsole: config.logToConsole ?? true,
      logToFile: config.logToFile ?? false,
      logFilePath: config.logFilePath ?? './audit.log',
      logToExternalService: config.logToExternalService ?? false,
      externalServiceEndpoint: config.externalServiceEndpoint ?? ''
    };

    this.logInfo('Audit Logger initialized', { 
      config: { 
        ...this.config, 
        // Don't log sensitive config details
        externalServiceEndpoint: this.config.externalServiceEndpoint ? '[CONFIGURED]' : '[NOT_CONFIGURED]'
      } 
    });
  }

  /**
   * Set audit context for subsequent log entries
   * @param context Audit context information
   */
  setContext(context: AuditContext): void {
    this.currentContext = { ...context };
    this.logDebug('Audit context updated', { context: this.sanitizeContextForLogging(context) });
  }

  /**
   * Update specific context fields
   * @param updates Context updates to apply
   */
  updateContext(updates: Partial<AuditContext>): void {
    this.currentContext = { ...this.currentContext, ...updates };
    this.logDebug('Audit context updated', { 
      updates: this.sanitizeContextForLogging(updates) 
    });
  }

  /**
   * Clear audit context
   */
  clearContext(): void {
    this.currentContext = {};
    this.logDebug('Audit context cleared');
  }

  /**
   * Log an audit entry
   * @param input Audit log input data
   * @returns Promise resolving to success status
   */
  async log(input: AuditLogInput): Promise<EHRApiResponse<{ logId: string }>> {
    try {
      if (!this.config.enabled) {
        return {
          success: true,
          data: { logId: 'disabled' },
          metadata: {
            requestId: this.generateLogId(),
            timestamp: new Date(),
            processingTimeMs: 0
          }
        };
      }

      // Create complete audit log entry
      const logEntry: AuditLogEntry = {
        id: this.generateLogId(),
        timestamp: new Date(),
        userId: this.currentContext.userId || 'system',
        userRole: this.currentContext.userRole || 'unknown',
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        patientMrn: input.patientMrn,
        ehrSystem: input.ehrSystem,
        ipAddress: this.currentContext.ipAddress || 'unknown',
        userAgent: this.currentContext.userAgent || 'unknown',
        context: {
          ...input.context,
          sessionId: this.currentContext.sessionId,
          requestId: this.currentContext.requestId,
          customContext: this.currentContext.customContext
        },
        success: input.success,
        errorMessage: input.errorMessage
      };

      // Store in memory
      this.addToInMemoryStorage(logEntry);

      // Log to various outputs based on configuration
      await Promise.all([
        this.logToConsoleIfEnabled(logEntry),
        this.logToFileIfEnabled(logEntry),
        this.logToExternalServiceIfEnabled(logEntry)
      ]);

      // Clean up old entries if needed
      this.cleanupOldEntries();

      this.logDebug('Audit entry recorded successfully', { 
        logId: logEntry.id,
        action: logEntry.action,
        resourceType: logEntry.resourceType,
        success: logEntry.success
      });

      return {
        success: true,
        data: { logId: logEntry.id },
        metadata: {
          requestId: logEntry.id,
          timestamp: logEntry.timestamp,
          processingTimeMs: 0
        }
      };

    } catch (error) {
      const apiError: EHRApiError = {
        code: 'AUDIT_LOG_ERROR',
        message: 'Failed to record audit log entry',
        details: error instanceof Error ? error.message : 'Unknown audit error',
        retryable: true
      };

      this.logError('Failed to record audit entry', apiError, { input });
      return { success: false, error: apiError };
    }
  }

  /**
   * Search audit log entries
   * @param criteria Search criteria
   * @returns Promise resolving to matching audit entries
   */
  async search(criteria: AuditSearchCriteria): Promise<EHRApiResponse<{
    entries: AuditLogEntry[];
    total: number;
    hasMore: boolean;
  }>> {
    try {
      this.logDebug('Searching audit logs', { criteria: this.sanitizeCriteriaForLogging(criteria) });

      // Audit the search action itself
      await this.log({
        action: 'access_audit_logs',
        resourceType: 'audit_logs',
        resourceId: 'search',
        success: true,
        context: { 
          searchCriteria: this.sanitizeCriteriaForLogging(criteria),
          searchPerformed: true
        }
      });

      // Filter in-memory logs based on criteria
      let filteredEntries = this.inMemoryLogs.filter(entry => 
        this.matchesCriteria(entry, criteria)
      );

      // Sort by timestamp (newest first)
      filteredEntries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      const total = filteredEntries.length;
      const offset = criteria.offset || 0;
      const limit = criteria.limit || 100;

      // Apply pagination
      const paginatedEntries = filteredEntries.slice(offset, offset + limit);
      const hasMore = offset + limit < total;

      this.logDebug('Audit search completed', { 
        total,
        returned: paginatedEntries.length,
        hasMore
      });

      return {
        success: true,
        data: {
          entries: paginatedEntries,
          total,
          hasMore
        },
        metadata: {
          requestId: this.generateLogId(),
          timestamp: new Date(),
          processingTimeMs: 0
        }
      };

    } catch (error) {
      const apiError: EHRApiError = {
        code: 'AUDIT_SEARCH_ERROR',
        message: 'Failed to search audit logs',
        details: error instanceof Error ? error.message : 'Unknown search error',
        retryable: true
      };

      this.logError('Audit search failed', apiError, { criteria });
      return { success: false, error: apiError };
    }
  }

  /**
   * Get audit statistics
   * @param startDate Start date for statistics
   * @param endDate End date for statistics
   * @returns Promise resolving to audit statistics
   */
  async getStatistics(
    startDate?: Date,
    endDate?: Date
  ): Promise<EHRApiResponse<{
    totalEntries: number;
    entriesByAction: Record<AuditAction, number>;
    entriesByUser: Record<string, number>;
    entriesBySuccess: { success: number; failure: number };
    entriesByDate: Record<string, number>;
  }>> {
    try {
      this.logDebug('Generating audit statistics', { startDate, endDate });

      // Filter entries by date range if provided
      let entries = this.inMemoryLogs;
      if (startDate || endDate) {
        entries = entries.filter(entry => {
          if (startDate && entry.timestamp < startDate) return false;
          if (endDate && entry.timestamp > endDate) return false;
          return true;
        });
      }

      // Calculate statistics
      const totalEntries = entries.length;
      
      const entriesByAction: Record<string, number> = {};
      const entriesByUser: Record<string, number> = {};
      const entriesByDate: Record<string, number> = {};
      let successCount = 0;
      let failureCount = 0;

      entries.forEach(entry => {
        // Count by action
        entriesByAction[entry.action] = (entriesByAction[entry.action] || 0) + 1;
        
        // Count by user
        entriesByUser[entry.userId] = (entriesByUser[entry.userId] || 0) + 1;
        
        // Count by success/failure
        if (entry.success) {
          successCount++;
        } else {
          failureCount++;
        }
        
        // Count by date
        const dateKey = entry.timestamp.toISOString().split('T')[0];
        entriesByDate[dateKey] = (entriesByDate[dateKey] || 0) + 1;
      });

      // Audit the statistics access
      await this.log({
        action: 'access_audit_logs',
        resourceType: 'audit_statistics',
        resourceId: 'statistics',
        success: true,
        context: { 
          statisticsGenerated: true,
          dateRange: { startDate, endDate },
          totalEntries
        }
      });

      const statistics = {
        totalEntries,
        entriesByAction: entriesByAction as Record<AuditAction, number>,
        entriesByUser,
        entriesBySuccess: { success: successCount, failure: failureCount },
        entriesByDate
      };

      this.logDebug('Audit statistics generated', { 
        totalEntries,
        actionsCount: Object.keys(entriesByAction).length,
        usersCount: Object.keys(entriesByUser).length
      });

      return {
        success: true,
        data: statistics,
        metadata: {
          requestId: this.generateLogId(),
          timestamp: new Date(),
          processingTimeMs: 0
        }
      };

    } catch (error) {
      const apiError: EHRApiError = {
        code: 'AUDIT_STATISTICS_ERROR',
        message: 'Failed to generate audit statistics',
        details: error instanceof Error ? error.message : 'Unknown statistics error',
        retryable: true
      };

      this.logError('Audit statistics generation failed', apiError, { startDate, endDate });
      return { success: false, error: apiError };
    }
  }

  /**
   * Export audit logs
   * @param criteria Export criteria
   * @param format Export format
   * @returns Promise resolving to exported data
   */
  async export(
    criteria: AuditSearchCriteria,
    format: 'json' | 'csv' | 'xml' = 'json'
  ): Promise<EHRApiResponse<{ data: string; filename: string; mimeType: string }>> {
    try {
      this.logDebug('Exporting audit logs', { criteria: this.sanitizeCriteriaForLogging(criteria), format });

      // Search for entries matching criteria
      const searchResult = await this.search(criteria);
      if (!searchResult.success || !searchResult.data) {
        return { success: false, error: searchResult.error };
      }

      const entries = searchResult.data.entries;

      // Audit the export action
      await this.log({
        action: 'export_data',
        resourceType: 'audit_logs',
        resourceId: 'export',
        success: true,
        context: { 
          exportFormat: format,
          entriesCount: entries.length,
          exportCriteria: this.sanitizeCriteriaForLogging(criteria)
        }
      });

      // Generate export data based on format
      let exportData: string;
      let mimeType: string;
      let fileExtension: string;

      switch (format) {
        case 'csv':
          exportData = this.exportToCSV(entries);
          mimeType = 'text/csv';
          fileExtension = 'csv';
          break;
        case 'xml':
          exportData = this.exportToXML(entries);
          mimeType = 'application/xml';
          fileExtension = 'xml';
          break;
        case 'json':
        default:
          exportData = this.exportToJSON(entries);
          mimeType = 'application/json';
          fileExtension = 'json';
          break;
      }

      const filename = `audit_export_${new Date().toISOString().split('T')[0]}.${fileExtension}`;

      this.logDebug('Audit logs exported successfully', { 
        format,
        filename,
        entriesCount: entries.length,
        dataSizeBytes: exportData.length
      });

      return {
        success: true,
        data: {
          data: exportData,
          filename,
          mimeType
        },
        metadata: {
          requestId: this.generateLogId(),
          timestamp: new Date(),
          processingTimeMs: 0
        }
      };

    } catch (error) {
      const apiError: EHRApiError = {
        code: 'AUDIT_EXPORT_ERROR',
        message: 'Failed to export audit logs',
        details: error instanceof Error ? error.message : 'Unknown export error',
        retryable: true
      };

      this.logError('Audit export failed', apiError, { criteria, format });
      return { success: false, error: apiError };
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Add entry to in-memory storage
   * @param entry Audit log entry to add
   */
  private addToInMemoryStorage(entry: AuditLogEntry): void {
    this.inMemoryLogs.push(entry);
    
    // Trim if we exceed max entries
    if (this.inMemoryLogs.length > this.config.maxInMemoryEntries) {
      this.inMemoryLogs = this.inMemoryLogs.slice(-this.config.maxInMemoryEntries);
    }
  }

  /**
   * Check if entry matches search criteria
   * @param entry Audit log entry
   * @param criteria Search criteria
   * @returns Whether entry matches criteria
   */
  private matchesCriteria(entry: AuditLogEntry, criteria: AuditSearchCriteria): boolean {
    // Date range filter
    if (criteria.startDate && entry.timestamp < criteria.startDate) return false;
    if (criteria.endDate && entry.timestamp > criteria.endDate) return false;

    // Exact match filters
    if (criteria.userId && entry.userId !== criteria.userId) return false;
    if (criteria.action && entry.action !== criteria.action) return false;
    if (criteria.resourceType && entry.resourceType !== criteria.resourceType) return false;
    if (criteria.patientMrn && entry.patientMrn !== criteria.patientMrn) return false;
    if (criteria.ehrSystem && entry.ehrSystem !== criteria.ehrSystem) return false;
    if (criteria.success !== undefined && entry.success !== criteria.success) return false;
    if (criteria.ipAddress && entry.ipAddress !== criteria.ipAddress) return false;

    // Text search
    if (criteria.searchText) {
      const searchText = criteria.searchText.toLowerCase();
      const searchableText = [
        entry.action,
        entry.resourceType,
        entry.resourceId,
        entry.userId,
        entry.userRole,
        entry.patientMrn || '',
        entry.ehrSystem || '',
        entry.errorMessage || '',
        JSON.stringify(entry.context || {})
      ].join(' ').toLowerCase();

      if (!searchableText.includes(searchText)) return false;
    }

    return true;
  }

  /**
   * Log to console if enabled
   * @param entry Audit log entry
   */
  private async logToConsoleIfEnabled(entry: AuditLogEntry): Promise<void> {
    if (this.config.logToConsole) {
      const logMessage = `[AUDIT] ${entry.timestamp.toISOString()} - ${entry.action} - ${entry.resourceType}/${entry.resourceId} - ${entry.success ? 'SUCCESS' : 'FAILURE'}`;
      console.log(logMessage, this.sanitizeEntryForLogging(entry));
    }
  }

  /**
   * Log to file if enabled
   * @param entry Audit log entry
   */
  private async logToFileIfEnabled(entry: AuditLogEntry): Promise<void> {
    if (this.config.logToFile) {
      // In a real implementation, this would write to a file
      // For now, we'll just simulate the file logging
      this.logDebug('Would log to file', { 
        filepath: this.config.logFilePath,
        entryId: entry.id
      });
    }
  }

  /**
   * Log to external service if enabled
   * @param entry Audit log entry
   */
  private async logToExternalServiceIfEnabled(entry: AuditLogEntry): Promise<void> {
    if (this.config.logToExternalService && this.config.externalServiceEndpoint) {
      // In a real implementation, this would send to external service
      // For now, we'll just simulate the external logging
      this.logDebug('Would log to external service', { 
        endpoint: '[REDACTED]',
        entryId: entry.id
      });
    }
  }

  /**
   * Clean up old entries based on retention policy
   */
  private cleanupOldEntries(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    const initialCount = this.inMemoryLogs.length;
    this.inMemoryLogs = this.inMemoryLogs.filter(entry => entry.timestamp >= cutoffDate);

    const cleanedCount = initialCount - this.inMemoryLogs.length;
    if (cleanedCount > 0) {
      this.logDebug('Cleaned up old audit entries', { 
        cleanedCount,
        retentionDays: this.config.retentionDays
      });
    }
  }

  /**
   * Export entries to JSON format
   * @param entries Audit log entries
   * @returns JSON string
   */
  private exportToJSON(entries: AuditLogEntry[]): string {
    return JSON.stringify({
      exportDate: new Date().toISOString(),
      totalEntries: entries.length,
      entries: entries.map(entry => this.sanitizeEntryForExport(entry))
    }, null, 2);
  }

  /**
   * Export entries to CSV format
   * @param entries Audit log entries
   * @returns CSV string
   */
  private exportToCSV(entries: AuditLogEntry[]): string {
    const headers = [
      'ID', 'Timestamp', 'User ID', 'User Role', 'Action', 'Resource Type',
      'Resource ID', 'Patient MRN', 'EHR System', 'IP Address', 'Success', 'Error Message'
    ];

    const rows = entries.map(entry => [
      entry.id,
      entry.timestamp.toISOString(),
      entry.userId,
      entry.userRole,
      entry.action,
      entry.resourceType,
      entry.resourceId,
      entry.patientMrn || '',
      entry.ehrSystem || '',
      entry.ipAddress,
      entry.success.toString(),
      entry.errorMessage || ''
    ].map(field => `"${field.replace(/"/g, '""')}"`).join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Export entries to XML format
   * @param entries Audit log entries
   * @returns XML string
   */
  private exportToXML(entries: AuditLogEntry[]): string {
    const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n';
    const entriesXml = entries.map(entry => this.entryToXML(entry)).join('\n');
    
    return xmlHeader + 
           `<auditExport exportDate="${new Date().toISOString()}" totalEntries="${entries.length}">\n` +
           entriesXml +
           '\n</auditExport>';
  }

  /**
   * Convert audit entry to XML
   * @param entry Audit log entry
   * @returns XML string for entry
   */
  private entryToXML(entry: AuditLogEntry): string {
    const sanitized = this.sanitizeEntryForExport(entry);
    return `  <auditEntry>
    <id>${this.escapeXML(sanitized.id)}</id>
    <timestamp>${sanitized.timestamp}</timestamp>
    <userId>${this.escapeXML(sanitized.userId)}</userId>
    <userRole>${this.escapeXML(sanitized.userRole)}</userRole>
    <action>${this.escapeXML(sanitized.action)}</action>
    <resourceType>${this.escapeXML(sanitized.resourceType)}</resourceType>
    <resourceId>${this.escapeXML(sanitized.resourceId)}</resourceId>
    <patientMrn>${this.escapeXML(sanitized.patientMrn || '')}</patientMrn>
    <ehrSystem>${this.escapeXML(sanitized.ehrSystem || '')}</ehrSystem>
    <ipAddress>${this.escapeXML(sanitized.ipAddress)}</ipAddress>
    <success>${sanitized.success}</success>
    <errorMessage>${this.escapeXML(sanitized.errorMessage || '')}</errorMessage>
  </auditEntry>`;
  }

  /**
   * Escape XML special characters
   * @param value String to escape
   * @returns Escaped string
   */
  private escapeXML(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Sanitize audit entry for logging (remove sensitive data)
   * @param entry Audit log entry
   * @returns Sanitized entry
   */
  private sanitizeEntryForLogging(entry: AuditLogEntry): Partial<AuditLogEntry> {
    return {
      id: entry.id,
      timestamp: entry.timestamp,
      action: entry.action,
      resourceType: entry.resourceType,
      success: entry.success,
      // Don't log full context to avoid sensitive data in console
      context: entry.context ? { contextKeys: Object.keys(entry.context) } : undefined
    };
  }

  /**
   * Sanitize audit entry for export (remove truly sensitive data)
   * @param entry Audit log entry
   * @returns Sanitized entry
   */
  private sanitizeEntryForExport(entry: AuditLogEntry): AuditLogEntry {
    // For exports, we include most data but might redact some sensitive context
    return {
      ...entry,
      context: entry.context ? this.sanitizeContextForExport(entry.context) : undefined
    };
  }

  /**
   * Sanitize context for logging
   * @param context Audit context
   * @returns Sanitized context
   */
  private sanitizeContextForLogging(context: AuditContext | Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    
    Object.keys(context).forEach(key => {
      // Don't log sensitive fields
      if (['password', 'token', 'secret', 'key'].some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = context[key];
      }
    });

    return sanitized;
  }

  /**
   * Sanitize context for export
   * @param context Context object
   * @returns Sanitized context
   */
  private sanitizeContextForExport(context: Record<string, unknown>): Record<string, unknown> {
    // For exports, we can be less restrictive than logging but still careful
    return this.sanitizeContextForLogging(context);
  }

  /**
   * Sanitize search criteria for logging
   * @param criteria Search criteria
   * @returns Sanitized criteria
   */
  private sanitizeCriteriaForLogging(criteria: AuditSearchCriteria): Record<string, unknown> {
    return {
      dateRange: criteria.startDate || criteria.endDate ? {
        startDate: criteria.startDate?.toISOString(),
        endDate: criteria.endDate?.toISOString()
      } : undefined,
      action: criteria.action,
      resourceType: criteria.resourceType,
      hasSearchText: !!criteria.searchText,
      limit: criteria.limit,
      offset: criteria.offset
    };
  }

  /**
   * Generate unique log ID
   * @returns Log ID
   */
  private generateLogId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log debug message
   * @param message Debug message
   * @param context Additional context
   */
  private logDebug(message: string, context?: Record<string, unknown>): void {
    if (this.config.logToConsole) {
      console.debug(`[Audit Logger] ${message}`, context || {});
    }
  }

  /**
   * Log info message
   * @param message Info message
   * @param context Additional context
   */
  private logInfo(message: string, context?: Record<string, unknown>): void {
    if (this.config.logToConsole) {
      console.log(`[Audit Logger] ${message}`, context || {});
    }
  }

  /**
   * Log error message
   * @param message Error message
   * @param error Error details
   * @param context Additional context
   */
  private logError(message: string, error: EHRApiError, context?: Record<string, unknown>): void {
    if (this.config.logToConsole) {
      console.error(`[Audit Logger] ${message}`, { error, context: context || {} });
    }
  }
}

export default AuditLogger;