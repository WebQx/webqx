/**
 * WebQX™ Messaging Audit Logger
 * 
 * HIPAA-compliant audit logging for Matrix-based healthcare communications.
 * Provides comprehensive audit trails for compliance and security monitoring.
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class AuditLogger {
  constructor(options = {}) {
    this.config = {
      enabled: options.enabled !== false,
      maxInMemoryEntries: options.maxInMemoryEntries || 10000,
      retentionDays: options.retentionDays || 2555, // 7 years for healthcare
      logToConsole: options.logToConsole !== false,
      logToFile: options.logToFile || false,
      logFilePath: options.logFilePath || './audit.log',
      logToExternalService: options.logToExternalService || false,
      externalServiceEndpoint: options.externalServiceEndpoint || '[NOT_CONFIGURED]',
      ...options
    };

    this.inMemoryLogs = [];
    this.sessionId = this.generateSessionId();
    this.startTime = new Date().toISOString();

    this.logInfo('Audit Logger initialized', { config: this.config });
  }

  /**
   * Generate unique session ID for audit trail
   */
  generateSessionId() {
    return `webqx_audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Log an audit event
   */
  log(category, event, details = {}, severity = 'info') {
    if (!this.config.enabled) return;

    const auditEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      category,
      event,
      severity,
      details: this.sanitizeDetails(details),
      source: 'webqx-messaging',
      version: '1.0.0',
      id: this.generateEntryId()
    };

    this.processAuditEntry(auditEntry);
  }

  /**
   * Log info level events
   */
  logInfo(event, details = {}) {
    this.log('info', event, details, 'info');
  }

  /**
   * Log warning level events
   */
  logWarning(event, details = {}) {
    this.log('warning', event, details, 'warning');
  }

  /**
   * Log error level events
   */
  logError(event, details = {}) {
    this.log('error', event, details, 'error');
  }

  /**
   * Log security events
   */
  logSecurity(event, details = {}) {
    this.log('security', event, details, 'critical');
  }

  /**
   * Log compliance events
   */
  logCompliance(event, details = {}) {
    this.log('compliance', event, details, 'info');
  }

  /**
   * Process audit entry through various outputs
   */
  processAuditEntry(entry) {
    // Add to in-memory storage
    this.addToMemoryStore(entry);

    // Log to console if enabled
    if (this.config.logToConsole) {
      this.logToConsole(entry);
    }

    // Log to file if enabled
    if (this.config.logToFile) {
      this.logToFile(entry);
    }

    // Send to external service if enabled
    if (this.config.logToExternalService) {
      this.logToExternalService(entry);
    }
  }

  /**
   * Add entry to in-memory storage
   */
  addToMemoryStore(entry) {
    this.inMemoryLogs.push(entry);

    // Maintain max size
    if (this.inMemoryLogs.length > this.config.maxInMemoryEntries) {
      this.inMemoryLogs.shift(); // Remove oldest entry
    }
  }

  /**
   * Log to console with formatting
   */
  logToConsole(entry) {
    const timestamp = entry.timestamp;
    const level = entry.severity.toUpperCase();
    const message = `${entry.event}`;
    const details = Object.keys(entry.details).length > 0 ? 
      JSON.stringify(entry.details, null, 2) : '';

    console.log(`[Audit Logger] ${message}${details ? ` ${  details}` : ''}`);
  }

  /**
   * Log to file
   */
  async logToFile(entry) {
    try {
      const logLine = `${JSON.stringify(entry)  }\n`;
      await fs.appendFile(this.config.logFilePath, logLine);
    } catch (error) {
      console.error('Failed to write audit log to file:', error.message);
    }
  }

  /**
   * Send to external logging service
   */
  async logToExternalService(entry) {
    try {
      if (this.config.externalServiceEndpoint === '[NOT_CONFIGURED]') {
        return;
      }

      const response = await fetch(this.config.externalServiceEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.AUDIT_SERVICE_TOKEN}`
        },
        body: JSON.stringify(entry)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send audit log to external service:', error.message);
      // Fallback to file logging
      await this.logToFile({
        ...entry,
        externalServiceError: error.message
      });
    }
  }

  /**
   * Sanitize sensitive details for logging
   */
  sanitizeDetails(details) {
    const sanitized = { ...details };
    
    // Remove or mask sensitive fields
    const sensitiveFields = [
      'password', 'token', 'accessToken', 'secret', 'key', 'privateKey',
      'ssn', 'socialSecurityNumber', 'creditCard', 'medicalRecordNumber'
    ];

    const maskField = (obj, field) => {
      if (obj && typeof obj === 'object') {
        Object.keys(obj).forEach(key => {
          if (sensitiveFields.some(sensitive => 
            key.toLowerCase().includes(sensitive.toLowerCase())
          )) {
            obj[key] = this.maskValue(obj[key]);
          } else if (typeof obj[key] === 'object') {
            maskField(obj[key], field);
          }
        });
      }
    };

    maskField(sanitized);
    return sanitized;
  }

  /**
   * Mask sensitive values
   */
  maskValue(value) {
    if (typeof value === 'string') {
      if (value.length <= 4) {
        return '***';
      }
      return value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
    }
    return '[MASKED]';
  }

  /**
   * Generate unique entry ID
   */
  generateEntryId() {
    return `audit_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Get audit logs by category
   */
  getLogsByCategory(category, limit = 100) {
    return this.inMemoryLogs
      .filter(log => log.category === category)
      .slice(-limit)
      .reverse();
  }

  /**
   * Get audit logs by time range
   */
  getLogsByTimeRange(startTime, endTime, limit = 100) {
    const start = new Date(startTime);
    const end = new Date(endTime);

    return this.inMemoryLogs
      .filter(log => {
        const logTime = new Date(log.timestamp);
        return logTime >= start && logTime <= end;
      })
      .slice(-limit)
      .reverse();
  }

  /**
   * Get audit logs by severity
   */
  getLogsBySeverity(severity, limit = 100) {
    return this.inMemoryLogs
      .filter(log => log.severity === severity)
      .slice(-limit)
      .reverse();
  }

  /**
   * Search audit logs
   */
  searchLogs(query, limit = 100) {
    const searchTerm = query.toLowerCase();
    
    return this.inMemoryLogs
      .filter(log => 
        log.event.toLowerCase().includes(searchTerm) ||
        log.category.toLowerCase().includes(searchTerm) ||
        JSON.stringify(log.details).toLowerCase().includes(searchTerm)
      )
      .slice(-limit)
      .reverse();
  }

  /**
   * Get audit statistics
   */
  getAuditStats() {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

    const last24HourLogs = this.inMemoryLogs.filter(log => 
      new Date(log.timestamp) >= last24Hours
    );

    const lastHourLogs = this.inMemoryLogs.filter(log => 
      new Date(log.timestamp) >= lastHour
    );

    const categoryCounts = {};
    const severityCounts = {};

    this.inMemoryLogs.forEach(log => {
      categoryCounts[log.category] = (categoryCounts[log.category] || 0) + 1;
      severityCounts[log.severity] = (severityCounts[log.severity] || 0) + 1;
    });

    return {
      totalLogs: this.inMemoryLogs.length,
      sessionId: this.sessionId,
      sessionStartTime: this.startTime,
      last24Hours: last24HourLogs.length,
      lastHour: lastHourLogs.length,
      categoryCounts,
      severityCounts,
      oldestLog: this.inMemoryLogs.length > 0 ? this.inMemoryLogs[0].timestamp : null,
      newestLog: this.inMemoryLogs.length > 0 ? 
        this.inMemoryLogs[this.inMemoryLogs.length - 1].timestamp : null
    };
  }

  /**
   * Export audit logs for compliance
   */
  async exportLogs(format = 'json', timeRange = null) {
    let logs = [...this.inMemoryLogs];

    if (timeRange) {
      logs = this.getLogsByTimeRange(timeRange.start, timeRange.end, Number.MAX_SAFE_INTEGER);
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      sessionId: this.sessionId,
      totalEntries: logs.length,
      timeRange: timeRange || { start: this.startTime, end: new Date().toISOString() },
      logs
    };

    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(exportData, null, 2);
      
      case 'csv':
        return this.convertToCSV(logs);
      
      case 'xml':
        return this.convertToXML(exportData);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Convert logs to CSV format
   */
  convertToCSV(logs) {
    if (logs.length === 0) return 'No logs to export';

    const headers = ['timestamp', 'sessionId', 'category', 'event', 'severity', 'details'];
    const csvRows = [headers.join(',')];

    logs.forEach(log => {
      const row = [
        log.timestamp,
        log.sessionId,
        log.category,
        `"${log.event.replace(/"/g, '""')}"`,
        log.severity,
        `"${JSON.stringify(log.details).replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  /**
   * Convert logs to XML format
   */
  convertToXML(exportData) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<auditExport>\n';
    xml += `  <exportedAt>${exportData.exportedAt}</exportedAt>\n`;
    xml += `  <sessionId>${exportData.sessionId}</sessionId>\n`;
    xml += `  <totalEntries>${exportData.totalEntries}</totalEntries>\n`;
    xml += '  <logs>\n';

    exportData.logs.forEach(log => {
      xml += '    <log>\n';
      xml += `      <timestamp>${log.timestamp}</timestamp>\n`;
      xml += `      <category>${log.category}</category>\n`;
      xml += `      <event><![CDATA[${log.event}]]></event>\n`;
      xml += `      <severity>${log.severity}</severity>\n`;
      xml += `      <details><![CDATA[${JSON.stringify(log.details)}]]></details>\n`;
      xml += '    </log>\n';
    });

    xml += '  </logs>\n';
    xml += '</auditExport>\n';

    return xml;
  }

  /**
   * Clean up old logs based on retention policy
   */
  cleanupOldLogs() {
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - this.config.retentionDays);

    const originalCount = this.inMemoryLogs.length;
    this.inMemoryLogs = this.inMemoryLogs.filter(log => 
      new Date(log.timestamp) >= retentionDate
    );

    const removedCount = originalCount - this.inMemoryLogs.length;
    
    if (removedCount > 0) {
      this.logInfo('Audit log cleanup completed', {
        removedEntries: removedCount,
        remainingEntries: this.inMemoryLogs.length,
        retentionDays: this.config.retentionDays
      });
    }

    return removedCount;
  }

  /**
   * Generate compliance report
   */
  generateComplianceReport() {
    const stats = this.getAuditStats();
    const securityLogs = this.getLogsByCategory('security');
    const errorLogs = this.getLogsBySeverity('error');
    const complianceLogs = this.getLogsByCategory('compliance');

    return {
      reportGeneratedAt: new Date().toISOString(),
      sessionInfo: {
        sessionId: this.sessionId,
        sessionStartTime: this.startTime,
        sessionDurationHours: (Date.now() - new Date(this.startTime).getTime()) / (1000 * 60 * 60)
      },
      statistics: stats,
      securityEvents: securityLogs.length,
      errorEvents: errorLogs.length,
      complianceEvents: complianceLogs.length,
      recentSecurityEvents: securityLogs.slice(0, 10),
      recentErrors: errorLogs.slice(0, 10),
      recommendations: this.generateRecommendations(stats, securityLogs, errorLogs)
    };
  }

  /**
   * Generate recommendations based on audit data
   */
  generateRecommendations(stats, securityLogs, errorLogs) {
    const recommendations = [];

    if (errorLogs.length > stats.totalLogs * 0.1) {
      recommendations.push({
        type: 'warning',
        message: 'High error rate detected - consider investigating system stability',
        priority: 'high'
      });
    }

    if (securityLogs.length === 0) {
      recommendations.push({
        type: 'info',
        message: 'No security events logged - ensure security monitoring is active',
        priority: 'medium'
      });
    }

    if (stats.totalLogs < 10) {
      recommendations.push({
        type: 'info',
        message: 'Low audit activity - verify audit logging is properly configured',
        priority: 'low'
      });
    }

    return recommendations;
  }
}

module.exports = { AuditLogger };