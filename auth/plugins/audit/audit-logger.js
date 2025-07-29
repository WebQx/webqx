/**
 * SSO Audit Logger
 * Comprehensive logging for SSO authentication events
 */

const fs = require('fs');
const path = require('path');
const { getAuditConfig } = require('../sso-config');

/**
 * Audit Logger Class
 */
class AuditLogger {
    constructor() {
        this.config = getAuditConfig();
        this.logBuffer = [];
        this.maxBufferSize = 1000;
        
        // Ensure log directory exists if file logging is enabled
        if (this.config.enabled && this.config.logToFile !== false) {
            this.ensureLogDirectory();
        }
        
        // Start periodic flush if needed
        if (this.config.enabled) {
            this.startPeriodicFlush();
        }
    }

    /**
     * Log successful authentication event
     * @param {string} eventType - Type of event
     * @param {Object} details - Event details
     */
    logSuccess(eventType, details) {
        if (!this.config.enabled) return;

        this.log('SUCCESS', eventType, details);
    }

    /**
     * Log failed authentication event
     * @param {string} eventType - Type of event
     * @param {Object} details - Event details
     */
    logFailure(eventType, details) {
        if (!this.config.enabled) return;

        this.log('FAILURE', eventType, details);
    }

    /**
     * Log informational event
     * @param {string} eventType - Type of event
     * @param {Object} details - Event details
     */
    logInfo(eventType, details) {
        if (!this.config.enabled) return;

        this.log('INFO', eventType, details);
    }

    /**
     * Log warning event
     * @param {string} eventType - Type of event
     * @param {Object} details - Event details
     */
    logWarning(eventType, details) {
        if (!this.config.enabled) return;

        this.log('WARNING', eventType, details);
    }

    /**
     * Log security event
     * @param {string} eventType - Type of event
     * @param {Object} details - Event details
     */
    logSecurity(eventType, details) {
        if (!this.config.enabled) return;

        this.log('SECURITY', eventType, details);
    }

    /**
     * Core logging method
     * @param {string} level - Log level
     * @param {string} eventType - Type of event
     * @param {Object} details - Event details
     */
    log(level, eventType, details) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level: level,
            eventType: eventType,
            sessionId: this.generateSessionId(),
            ip: details.ip || 'unknown',
            userAgent: details.userAgent || 'unknown',
            userId: details.userId || details.email || 'anonymous',
            provider: details.provider || 'unknown',
            success: level === 'SUCCESS',
            details: this.sanitizeDetails(details)
        };

        // Add to buffer
        this.logBuffer.push(logEntry);

        // Console logging
        if (this.config.logToConsole !== false) {
            this.logToConsole(logEntry);
        }

        // File logging
        if (this.config.logToFile !== false) {
            this.logToFile(logEntry);
        }

        // External service logging
        if (this.config.externalLogging?.enabled) {
            this.logToExternalService(logEntry);
        }

        // Flush buffer if it's getting too large
        if (this.logBuffer.length >= this.maxBufferSize) {
            this.flushBuffer();
        }

        // Check for suspicious activity
        this.checkSuspiciousActivity(logEntry);
    }

    /**
     * Sanitize details to remove sensitive information
     * @param {Object} details - Raw details
     * @returns {Object} Sanitized details
     */
    sanitizeDetails(details) {
        const sanitized = { ...details };
        
        // Remove sensitive fields
        delete sanitized.password;
        delete sanitized.client_secret;
        delete sanitized.access_token;
        delete sanitized.refresh_token;
        delete sanitized.authorization_code;
        
        // Mask partial email for privacy
        if (sanitized.email) {
            sanitized.emailMasked = this.maskEmail(sanitized.email);
            delete sanitized.email;
        }

        return sanitized;
    }

    /**
     * Mask email for privacy
     * @param {string} email - Email address
     * @returns {string} Masked email
     */
    maskEmail(email) {
        const [local, domain] = email.split('@');
        if (local.length <= 2) {
            return `${local[0]}***@${domain}`;
        }
        return `${local.substring(0, 2)}***@${domain}`;
    }

    /**
     * Log to console
     * @param {Object} logEntry - Log entry
     */
    logToConsole(logEntry) {
        const message = `[${logEntry.timestamp}] ${logEntry.level} - ${logEntry.eventType}`;
        
        switch (logEntry.level) {
            case 'FAILURE':
            case 'SECURITY':
                console.error(message, logEntry.details);
                break;
            case 'WARNING':
                console.warn(message, logEntry.details);
                break;
            case 'SUCCESS':
                console.log(message, logEntry.details);
                break;
            default:
                console.info(message, logEntry.details);
        }
    }

    /**
     * Log to file
     * @param {Object} logEntry - Log entry
     */
    async logToFile(logEntry) {
        try {
            const logFile = this.getLogFilePath();
            const logLine = JSON.stringify(logEntry) + '\n';
            
            // Append to log file
            await fs.promises.appendFile(logFile, logLine, 'utf8');
        } catch (error) {
            console.error('Failed to write to audit log file:', error);
        }
    }

    /**
     * Log to external service
     * @param {Object} logEntry - Log entry
     */
    async logToExternalService(logEntry) {
        if (!this.config.externalLogging?.endpoint) {
            return;
        }

        try {
            // In a real implementation, this would make an HTTP request
            // For now, we'll just simulate it
            console.log(`[EXTERNAL LOG] Sending to ${this.config.externalLogging.endpoint}:`, logEntry);
        } catch (error) {
            console.error('Failed to send audit log to external service:', error);
        }
    }

    /**
     * Check for suspicious activity patterns
     * @param {Object} logEntry - Current log entry
     */
    checkSuspiciousActivity(logEntry) {
        if (logEntry.level !== 'FAILURE') return;

        // Count recent failures for this IP
        const recentFailures = this.getRecentFailures(logEntry.ip, 15); // Last 15 minutes
        
        if (recentFailures.length >= 5) {
            this.logSecurity('suspicious_activity_detected', {
                ip: logEntry.ip,
                failureCount: recentFailures.length,
                timeWindow: '15 minutes',
                recommendation: 'Consider blocking IP or implementing additional verification'
            });
        }

        // Check for multiple provider attempts
        const providerAttempts = new Set(recentFailures.map(f => f.details.provider));
        if (providerAttempts.size >= 3) {
            this.logSecurity('multiple_provider_attempts', {
                ip: logEntry.ip,
                providerCount: providerAttempts.size,
                providers: Array.from(providerAttempts)
            });
        }
    }

    /**
     * Get recent failures for an IP address
     * @param {string} ip - IP address
     * @param {number} minutes - Time window in minutes
     * @returns {Array} Recent failure entries
     */
    getRecentFailures(ip, minutes) {
        const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
        
        return this.logBuffer.filter(entry => 
            entry.level === 'FAILURE' && 
            entry.ip === ip && 
            new Date(entry.timestamp) > cutoffTime
        );
    }

    /**
     * Generate session ID for tracking
     * @returns {string} Session ID
     */
    generateSessionId() {
        // In a real implementation, this would use actual session tracking
        return require('crypto').randomBytes(8).toString('hex');
    }

    /**
     * Ensure log directory exists
     */
    ensureLogDirectory() {
        const logFile = this.getLogFilePath();
        const logDir = path.dirname(logFile);
        
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    /**
     * Get log file path
     * @returns {string} Log file path
     */
    getLogFilePath() {
        const baseDir = process.cwd();
        const logDir = path.join(baseDir, 'logs');
        const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        return path.join(logDir, `sso-audit-${date}.log`);
    }

    /**
     * Start periodic buffer flush
     */
    startPeriodicFlush() {
        // Flush buffer every 5 minutes
        setInterval(() => {
            this.flushBuffer();
        }, 5 * 60 * 1000);
    }

    /**
     * Flush log buffer and clean old entries
     */
    flushBuffer() {
        // Remove entries older than retention period
        const cutoffDate = new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000);
        
        this.logBuffer = this.logBuffer.filter(entry => 
            new Date(entry.timestamp) > cutoffDate
        );

        // Keep only recent entries in memory
        if (this.logBuffer.length > this.maxBufferSize) {
            this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
        }
    }

    /**
     * Get audit statistics
     * @param {Object} options - Query options
     * @returns {Object} Audit statistics
     */
    getAuditStats(options = {}) {
        const timeWindow = options.timeWindow || 24; // hours
        const cutoffTime = new Date(Date.now() - timeWindow * 60 * 60 * 1000);
        
        const recentEntries = this.logBuffer.filter(entry => 
            new Date(entry.timestamp) > cutoffTime
        );

        const stats = {
            totalEvents: recentEntries.length,
            successfulLogins: recentEntries.filter(e => 
                e.eventType.includes('login') && e.level === 'SUCCESS'
            ).length,
            failedLogins: recentEntries.filter(e => 
                e.eventType.includes('login') && e.level === 'FAILURE'
            ).length,
            uniqueUsers: new Set(recentEntries.map(e => e.userId)).size,
            uniqueIPs: new Set(recentEntries.map(e => e.ip)).size,
            providerBreakdown: {},
            eventTypeBreakdown: {},
            timeWindow: `${timeWindow} hours`
        };

        // Provider breakdown
        recentEntries.forEach(entry => {
            if (entry.provider && entry.provider !== 'unknown') {
                stats.providerBreakdown[entry.provider] = 
                    (stats.providerBreakdown[entry.provider] || 0) + 1;
            }
        });

        // Event type breakdown
        recentEntries.forEach(entry => {
            stats.eventTypeBreakdown[entry.eventType] = 
                (stats.eventTypeBreakdown[entry.eventType] || 0) + 1;
        });

        return stats;
    }

    /**
     * Get security alerts
     * @param {Object} options - Query options
     * @returns {Array} Security alerts
     */
    getSecurityAlerts(options = {}) {
        const timeWindow = options.timeWindow || 24; // hours
        const cutoffTime = new Date(Date.now() - timeWindow * 60 * 60 * 1000);
        
        return this.logBuffer.filter(entry => 
            entry.level === 'SECURITY' && 
            new Date(entry.timestamp) > cutoffTime
        );
    }
}

// Create singleton instance
const auditLogger = new AuditLogger();

module.exports = auditLogger;