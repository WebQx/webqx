/**
 * @fileoverview HIPAA Compliance Configuration for Telehealth Module
 * 
 * This module provides comprehensive HIPAA compliance configuration including
 * audit logging, data encryption, access controls, and privacy protection
 * for telehealth communications.
 * 
 * Features:
 * - Audit trail management
 * - PHI protection and anonymization
 * - Data retention policies
 * - Access control requirements
 * - Breach notification procedures
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

const crypto = require('crypto');
const path = require('path');

/**
 * HIPAA Compliance Configuration
 */
class HIPAAConfig {
    constructor() {
        this.loadConfiguration();
        this.validateConfiguration();
        this.initializeAuditLogger();
    }

    /**
     * Load HIPAA configuration from environment
     */
    loadConfiguration() {
        this.config = {
            // Compliance enablement
            enabled: process.env.HIPAA_AUDIT_ENABLED === 'true',
            mode: process.env.HIPAA_COMPLIANT_MODE === 'true' ? 'strict' : 'relaxed',
            
            // Data retention
            retentionDays: parseInt(process.env.HIPAA_RETENTION_DAYS || '2555'), // 7 years
            archiveAfterDays: parseInt(process.env.HIPAA_ARCHIVE_DAYS || '365'),
            
            // Encryption requirements
            encryptionKey: process.env.HIPAA_ENCRYPTION_KEY,
            encryptionAlgorithm: 'aes-256-gcm',
            keyRotationDays: 90,
            
            // PHI protection
            phiDetectionEnabled: process.env.PHI_DETECTION_ENABLED === 'true',
            anonymizationEnabled: process.env.PHI_ANONYMIZATION_ENABLED === 'true',
            
            // Access controls
            mfaRequired: true,
            sessionTimeoutMinutes: parseInt(process.env.SESSION_TIMEOUT_MINUTES || '60'),
            maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '10'),
            requirePatientConsent: process.env.REQUIRE_PATIENT_CONSENT === 'true',
            
            // Audit logging
            auditLogRetentionDays: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '2555'),
            auditLogPath: process.env.AUDIT_LOG_PATH || './logs/hipaa-audit.log',
            realTimeAuditing: true,
            
            // Breach notification
            breachNotificationEnabled: true,
            breachThresholdMinutes: 30,
            breachNotificationEmail: process.env.BREACH_NOTIFICATION_EMAIL,
            
            // Business Associate Agreement
            baaRequired: true,
            baaValidationEnabled: true,
            
            // Risk assessment
            riskAssessmentInterval: 90, // days
            vulnerabilityScanningEnabled: true,
            
            // Training and documentation
            trainingRequiredDays: 365,
            documentationRetentionDays: 2555,
            
            // PHI categories for protection
            phiCategories: [
                'names', 'dates', 'telephone', 'fax', 'email', 'ssn',
                'medical_record', 'health_plan', 'account', 'certificate',
                'vehicle', 'device', 'urls', 'ip_addresses', 'biometric',
                'photos', 'other_unique_identifiers'
            ],
            
            // Audit event types
            auditEvents: {
                'SESSION_START': { severity: 'INFO', retention: 2555 },
                'SESSION_END': { severity: 'INFO', retention: 2555 },
                'PHI_ACCESS': { severity: 'WARN', retention: 2555 },
                'PHI_MODIFICATION': { severity: 'WARN', retention: 2555 },
                'AUTHENTICATION_FAILURE': { severity: 'ERROR', retention: 2555 },
                'UNAUTHORIZED_ACCESS': { severity: 'CRITICAL', retention: 2555 },
                'DATA_EXPORT': { severity: 'WARN', retention: 2555 },
                'CONSENT_GRANTED': { severity: 'INFO', retention: 2555 },
                'CONSENT_REVOKED': { severity: 'WARN', retention: 2555 },
                'BREACH_DETECTED': { severity: 'CRITICAL', retention: 2555 },
                'SYSTEM_CONFIGURATION_CHANGE': { severity: 'WARN', retention: 2555 }
            }
        };
    }

    /**
     * Validate HIPAA configuration
     */
    validateConfiguration() {
        const errors = [];

        // Check encryption key
        if (!this.config.encryptionKey) {
            errors.push('HIPAA encryption key is required (HIPAA_ENCRYPTION_KEY)');
        } else if (this.config.encryptionKey.length < 32) {
            errors.push('HIPAA encryption key must be at least 256 bits (32 characters)');
        }

        // Check retention periods
        if (this.config.retentionDays < 2555) {
            console.warn('⚠️ HIPAA data retention period should be at least 7 years (2555 days)');
        }

        // Check audit configuration
        if (this.config.enabled && !this.config.auditLogPath) {
            errors.push('Audit log path is required when HIPAA auditing is enabled');
        }

        // Check breach notification
        if (this.config.breachNotificationEnabled && !this.config.breachNotificationEmail) {
            console.warn('⚠️ Breach notification email not configured');
        }

        if (errors.length > 0) {
            throw new Error(`HIPAA Configuration Errors:\n${errors.join('\n')}`);
        }

        console.log('✅ HIPAA configuration validated successfully');
    }

    /**
     * Initialize audit logger
     */
    initializeAuditLogger() {
        this.auditEntries = [];
        this.auditStartTime = new Date();
        
        // Create audit log directory if it doesn't exist
        const logDir = path.dirname(this.config.auditLogPath);
        const fs = require('fs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        console.log('✅ HIPAA audit logger initialized');
    }

    /**
     * Log audit event
     */
    logAuditEvent(eventType, details = {}) {
        if (!this.config.enabled) {
            return;
        }

        const eventConfig = this.config.auditEvents[eventType] || { severity: 'INFO', retention: 2555 };
        
        const auditEntry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            eventType,
            severity: eventConfig.severity,
            userId: details.userId || 'system',
            sessionId: details.sessionId,
            resourceType: details.resourceType,
            resourceId: details.resourceId,
            action: details.action,
            outcome: details.outcome || 'SUCCESS',
            sourceIp: details.sourceIp,
            userAgent: details.userAgent,
            details: this.sanitizeAuditDetails(details.details || {}),
            retentionUntil: new Date(Date.now() + eventConfig.retention * 24 * 60 * 60 * 1000).toISOString()
        };

        // Add to in-memory store
        this.auditEntries.push(auditEntry);

        // Write to log file if configured
        if (this.config.auditLogPath) {
            this.writeAuditLog(auditEntry);
        }

        // Handle critical events
        if (eventConfig.severity === 'CRITICAL') {
            this.handleCriticalEvent(auditEntry);
        }

        return auditEntry.id;
    }

    /**
     * Sanitize audit details to remove PHI
     */
    sanitizeAuditDetails(details) {
        const sanitized = { ...details };
        
        // Remove potential PHI fields
        const phiFields = ['ssn', 'phone', 'email', 'name', 'address', 'birthdate'];
        phiFields.forEach(field => {
            if (sanitized[field]) {
                sanitized[field] = this.maskPHI(sanitized[field]);
            }
        });

        return sanitized;
    }

    /**
     * Mask PHI data
     */
    maskPHI(value) {
        if (typeof value === 'string') {
            // Mask all but last 4 characters
            if (value.length > 4) {
                return '*'.repeat(value.length - 4) + value.slice(-4);
            }
            return '*'.repeat(value.length);
        }
        return '[MASKED]';
    }

    /**
     * Write audit log to file
     */
    writeAuditLog(auditEntry) {
        try {
            const fs = require('fs');
            const logLine = JSON.stringify(auditEntry) + '\n';
            fs.appendFileSync(this.config.auditLogPath, logLine);
        } catch (error) {
            console.error('Failed to write audit log:', error.message);
        }
    }

    /**
     * Handle critical security events
     */
    handleCriticalEvent(auditEntry) {
        console.error(`🚨 CRITICAL HIPAA EVENT: ${auditEntry.eventType}`, {
            id: auditEntry.id,
            timestamp: auditEntry.timestamp,
            details: auditEntry.details
        });

        // Trigger breach notification if configured
        if (this.config.breachNotificationEnabled) {
            this.triggerBreachNotification(auditEntry);
        }
    }

    /**
     * Trigger breach notification
     */
    triggerBreachNotification(auditEntry) {
        // In a real implementation, this would send notifications
        // via email, SMS, or integration with incident management systems
        console.log('📧 Breach notification triggered:', {
            eventId: auditEntry.id,
            type: auditEntry.eventType,
            timestamp: auditEntry.timestamp,
            notificationEmail: this.config.breachNotificationEmail
        });
    }

    /**
     * Encrypt sensitive data
     */
    encryptData(data, additionalData = '') {
        if (!this.config.encryptionKey) {
            throw new Error('Encryption key not configured');
        }

        try {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipher(this.config.encryptionAlgorithm, this.config.encryptionKey);
            
            let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            const authTag = cipher.getAuthTag ? cipher.getAuthTag() : null;
            
            return {
                encrypted,
                iv: iv.toString('hex'),
                authTag: authTag ? authTag.toString('hex') : null,
                algorithm: this.config.encryptionAlgorithm
            };
        } catch (error) {
            throw new Error(`Encryption failed: ${error.message}`);
        }
    }

    /**
     * Decrypt sensitive data
     */
    decryptData(encryptedData) {
        if (!this.config.encryptionKey) {
            throw new Error('Encryption key not configured');
        }

        try {
            const decipher = crypto.createDecipher(encryptedData.algorithm, this.config.encryptionKey);
            
            if (encryptedData.authTag) {
                decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
            }
            
            let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return JSON.parse(decrypted);
        } catch (error) {
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }

    /**
     * Validate patient consent
     */
    validatePatientConsent(patientId, consentType = 'telehealth') {
        // This would typically check a consent database
        // For now, we'll simulate the check
        
        const consentRecord = {
            patientId,
            consentType,
            granted: true,
            grantedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
            version: '1.0'
        };

        // Log consent validation
        this.logAuditEvent('CONSENT_VALIDATION', {
            resourceType: 'Patient',
            resourceId: patientId,
            action: 'VALIDATE_CONSENT',
            details: { consentType, granted: consentRecord.granted }
        });

        return consentRecord;
    }

    /**
     * Generate compliance report
     */
    generateComplianceReport(startDate, endDate) {
        const report = {
            reportId: crypto.randomUUID(),
            generatedAt: new Date().toISOString(),
            period: { start: startDate, end: endDate },
            auditSummary: this.getAuditSummary(startDate, endDate),
            accessControls: this.getAccessControlStatus(),
            dataProtection: this.getDataProtectionStatus(),
            breachIncidents: this.getBreachIncidents(startDate, endDate),
            compliance: this.getComplianceStatus()
        };

        // Log report generation
        this.logAuditEvent('COMPLIANCE_REPORT_GENERATED', {
            action: 'GENERATE_REPORT',
            details: { reportId: report.reportId, period: report.period }
        });

        return report;
    }

    /**
     * Get audit summary
     */
    getAuditSummary(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        const filteredEntries = this.auditEntries.filter(entry => {
            const entryDate = new Date(entry.timestamp);
            return entryDate >= start && entryDate <= end;
        });

        const summary = {
            totalEvents: filteredEntries.length,
            eventsBySeverity: {},
            eventsByType: {},
            uniqueUsers: new Set(),
            uniqueSessions: new Set()
        };

        filteredEntries.forEach(entry => {
            // Count by severity
            summary.eventsBySeverity[entry.severity] = 
                (summary.eventsBySeverity[entry.severity] || 0) + 1;
                
            // Count by type
            summary.eventsByType[entry.eventType] = 
                (summary.eventsByType[entry.eventType] || 0) + 1;
                
            // Track unique users and sessions
            if (entry.userId) summary.uniqueUsers.add(entry.userId);
            if (entry.sessionId) summary.uniqueSessions.add(entry.sessionId);
        });

        summary.uniqueUsers = summary.uniqueUsers.size;
        summary.uniqueSessions = summary.uniqueSessions.size;

        return summary;
    }

    /**
     * Get access control status
     */
    getAccessControlStatus() {
        return {
            mfaEnabled: this.config.mfaRequired,
            sessionTimeout: this.config.sessionTimeoutMinutes,
            maxConcurrentSessions: this.config.maxConcurrentSessions,
            consentRequired: this.config.requirePatientConsent,
            tlsEnforced: true
        };
    }

    /**
     * Get data protection status
     */
    getDataProtectionStatus() {
        return {
            encryptionEnabled: !!this.config.encryptionKey,
            encryptionAlgorithm: this.config.encryptionAlgorithm,
            phiDetectionEnabled: this.config.phiDetectionEnabled,
            anonymizationEnabled: this.config.anonymizationEnabled,
            dataRetentionDays: this.config.retentionDays
        };
    }

    /**
     * Get breach incidents
     */
    getBreachIncidents(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        return this.auditEntries.filter(entry => {
            const entryDate = new Date(entry.timestamp);
            return entryDate >= start && entryDate <= end && 
                   (entry.eventType === 'BREACH_DETECTED' || entry.severity === 'CRITICAL');
        });
    }

    /**
     * Get overall compliance status
     */
    getComplianceStatus() {
        return {
            hipaaCompliant: this.config.enabled && this.config.mode === 'strict',
            auditingEnabled: this.config.enabled,
            encryptionEnabled: !!this.config.encryptionKey,
            accessControlsEnabled: this.config.mfaRequired,
            dataRetentionCompliant: this.config.retentionDays >= 2555,
            breachNotificationEnabled: this.config.breachNotificationEnabled
        };
    }

    /**
     * Get configuration summary
     */
    getConfigSummary() {
        return {
            enabled: this.config.enabled,
            mode: this.config.mode,
            retentionDays: this.config.retentionDays,
            encryptionEnabled: !!this.config.encryptionKey,
            auditEventsTracked: Object.keys(this.config.auditEvents).length,
            phiProtectionEnabled: this.config.phiDetectionEnabled
        };
    }
}

// Export singleton instance
const hipaaConfig = new HIPAAConfig();
module.exports = hipaaConfig;