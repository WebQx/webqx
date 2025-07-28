const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const encryption = require('../security/encryption');

/**
 * HIPAA-Compliant Audit Trail System
 * Tracks all user actions and system events for healthcare compliance
 */

class AuditLogger {
  constructor() {
    this.logDirectory = process.env.AUDIT_LOG_DIR || './logs/audit';
    this.retentionDays = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS) || 2555; // 7 years
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.currentLogFile = null;
    this.init();
  }

  async init() {
    try {
      await fs.mkdir(this.logDirectory, { recursive: true });
      this.currentLogFile = this.getLogFileName();
      
      // Ensure the log file path is properly set
      if (!this.currentLogFile) {
        this.currentLogFile = this.getLogFileName();
      }
    } catch (error) {
      console.error('Failed to initialize audit logger:', error);
    }
  }

  getLogFileName() {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDirectory, `audit-${date}.json`);
  }

  /**
   * Log user action for HIPAA audit trail
   * @param {Object} auditData - Audit information
   */
  async logUserAction(auditData) {
    const auditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'USER_ACTION',
      severity: auditData.severity || 'INFO',
      userId: auditData.userId,
      userRole: auditData.userRole,
      sessionId: auditData.sessionId,
      action: auditData.action,
      resource: auditData.resource,
      resourceId: auditData.resourceId,
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
      requestId: auditData.requestId,
      outcome: auditData.outcome || 'SUCCESS',
      details: auditData.details || {},
      patientId: auditData.patientId || null, // For PHI access tracking
      location: auditData.location || null,
      source: 'WebQX_Platform'
    };

    await this.writeAuditEntry(auditEntry);
  }

  /**
   * Log system event
   * @param {Object} eventData - System event information
   */
  async logSystemEvent(eventData) {
    const auditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'SYSTEM_EVENT',
      severity: eventData.severity || 'INFO',
      event: eventData.event,
      component: eventData.component,
      outcome: eventData.outcome || 'SUCCESS',
      details: eventData.details || {},
      source: 'WebQX_Platform'
    };

    await this.writeAuditEntry(auditEntry);
  }

  /**
   * Log PHI access specifically for HIPAA compliance
   * @param {Object} phiData - PHI access information
   */
  async logPHIAccess(phiData) {
    const auditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'PHI_ACCESS',
      severity: 'CRITICAL',
      userId: phiData.userId,
      userRole: phiData.userRole,
      sessionId: phiData.sessionId,
      action: phiData.action, // READ, WRITE, UPDATE, DELETE, EXPORT
      patientId: phiData.patientId,
      dataType: phiData.dataType, // MEDICAL_RECORD, LAB_RESULT, PRESCRIPTION, etc.
      accessReason: phiData.accessReason,
      ipAddress: phiData.ipAddress,
      userAgent: phiData.userAgent,
      requestId: phiData.requestId,
      outcome: phiData.outcome || 'SUCCESS',
      details: phiData.details || {},
      source: 'WebQX_Platform'
    };

    await this.writeAuditEntry(auditEntry);
  }

  /**
   * Log security events (failed logins, suspicious activity)
   * @param {Object} securityData - Security event information
   */
  async logSecurityEvent(securityData) {
    const auditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'SECURITY_EVENT',
      severity: securityData.severity || 'WARNING',
      event: securityData.event,
      userId: securityData.userId || null,
      sessionId: securityData.sessionId || null,
      ipAddress: securityData.ipAddress,
      userAgent: securityData.userAgent,
      outcome: securityData.outcome,
      threatLevel: securityData.threatLevel || 'LOW',
      details: securityData.details || {},
      source: 'WebQX_Platform'
    };

    await this.writeAuditEntry(auditEntry);
  }

  /**
   * Write audit entry to file
   * @param {Object} auditEntry - Complete audit entry
   */
  async writeAuditEntry(auditEntry) {
    try {
      // Encrypt sensitive audit data
      const encryptedEntry = {
        ...auditEntry,
        encrypted: true,
        checksum: crypto
          .createHash('sha256')
          .update(JSON.stringify(auditEntry))
          .digest('hex')
      };

      // Encrypt the entire entry if it contains PHI
      if (auditEntry.type === 'PHI_ACCESS' || auditEntry.patientId) {
        encryptedEntry.data = encryption.encryptPHI(JSON.stringify(auditEntry));
        delete encryptedEntry.userId;
        delete encryptedEntry.patientId;
        delete encryptedEntry.details;
      }

      const logLine = JSON.stringify(encryptedEntry) + '\n';
      
      // Check if we need to rotate the log file
      await this.rotateLogIfNeeded();
      
      await fs.appendFile(this.currentLogFile, logLine, 'utf8');
      
      // Also send to external logging service in production
      if (process.env.NODE_ENV === 'production' && process.env.EXTERNAL_AUDIT_ENDPOINT) {
        await this.sendToExternalLogger(encryptedEntry);
      }
      
    } catch (error) {
      console.error('Failed to write audit entry:', error);
      // In a real implementation, this should trigger an alert
    }
  }

  /**
   * Rotate log file if it exceeds size limit
   */
  async rotateLogIfNeeded() {
    try {
      if (!this.currentLogFile) {
        this.currentLogFile = this.getLogFileName();
      }
      
      const stats = await fs.stat(this.currentLogFile);
      if (stats.size > this.maxFileSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const archiveName = this.currentLogFile.replace('.json', `-${timestamp}.json`);
        await fs.rename(this.currentLogFile, archiveName);
        this.currentLogFile = this.getLogFileName();
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error checking log file size:', error);
      }
    }
  }

  /**
   * Send audit entry to external logging service
   * @param {Object} auditEntry - Audit entry to send
   */
  async sendToExternalLogger(auditEntry) {
    try {
      // This would integrate with services like ELK Stack, Splunk, etc.
      // For now, just log that we would send it
      console.log('Would send to external logger:', auditEntry.id);
    } catch (error) {
      console.error('Failed to send to external logger:', error);
    }
  }

  /**
   * Clean up old audit logs based on retention policy
   */
  async cleanupOldLogs() {
    try {
      const files = await fs.readdir(this.logDirectory);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

      for (const file of files) {
        if (file.startsWith('audit-') && file.endsWith('.json')) {
          const filePath = path.join(this.logDirectory, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            console.log(`Deleted old audit log: ${file}`);
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up old logs:', error);
    }
  }

  /**
   * Search audit logs (for compliance reporting)
   * @param {Object} criteria - Search criteria
   * @returns {Array} Matching audit entries
   */
  async searchAuditLogs(criteria) {
    try {
      const files = await fs.readdir(this.logDirectory);
      const auditFiles = files.filter(f => f.startsWith('audit-') && f.endsWith('.json'));
      const results = [];

      for (const file of auditFiles) {
        const filePath = path.join(this.logDirectory, file);
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            if (this.matchesCriteria(entry, criteria)) {
              // Decrypt if necessary for authorized access
              if (entry.encrypted && entry.data) {
                const decryptedData = encryption.decryptPHI(entry.data);
                entry.decryptedData = JSON.parse(decryptedData);
              }
              results.push(entry);
            }
          } catch (parseError) {
            console.error('Error parsing audit log line:', parseError);
          }
        }
      }

      return results;
    } catch (error) {
      console.error('Error searching audit logs:', error);
      return [];
    }
  }

  /**
   * Check if audit entry matches search criteria
   * @param {Object} entry - Audit entry
   * @param {Object} criteria - Search criteria
   * @returns {boolean} Whether entry matches
   */
  matchesCriteria(entry, criteria) {
    if (criteria.userId && entry.userId !== criteria.userId) return false;
    if (criteria.patientId && entry.patientId !== criteria.patientId) return false;
    if (criteria.action && entry.action !== criteria.action) return false;
    if (criteria.type && entry.type !== criteria.type) return false;
    if (criteria.startDate && new Date(entry.timestamp) < new Date(criteria.startDate)) return false;
    if (criteria.endDate && new Date(entry.timestamp) > new Date(criteria.endDate)) return false;
    
    return true;
  }
}

// Export singleton instance
module.exports = new AuditLogger();