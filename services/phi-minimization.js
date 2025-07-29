/**
 * PHI Data Minimization Service
 * 
 * Implements HIPAA data minimization principles by detecting, scrubbing, and
 * minimizing Protected Health Information (PHI) in logs, communications, and storage.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

/**
 * PHI data types and their detection patterns
 */
const PHI_PATTERNS = {
    SSN: {
        pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g,
        replacement: 'XXX-XX-XXXX',
        description: 'Social Security Number'
    },
    PHONE: {
        pattern: /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
        replacement: 'XXX-XXX-XXXX',
        description: 'Phone Number'
    },
    EMAIL: {
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        replacement: 'email@domain.com',
        description: 'Email Address'
    },
    DOB: {
        pattern: /\b(0?[1-9]|1[0-2])[\/\-\.](0?[1-9]|[12][0-9]|3[01])[\/\-\.](\d{2}|\d{4})\b/g,
        replacement: 'XX/XX/XXXX',
        description: 'Date of Birth'
    },
    MRN: {
        pattern: /\b(MRN|mrn|medical record|patient id|patient_id)[:\s]+([A-Z0-9\-]{6,20})\b/gi,
        replacement: (match, prefix, id) => `${prefix}: XXXXXXXX`,
        description: 'Medical Record Number'
    },
    CREDIT_CARD: {
        pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
        replacement: 'XXXX-XXXX-XXXX-XXXX',
        description: 'Credit Card Number'
    },
    ADDRESS: {
        pattern: /\b\d+\s+([A-Za-z]+\s+){1,3}(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Way|Court|Ct)\b/gi,
        replacement: 'XXX Street Address',
        description: 'Street Address'
    },
    ZIP_CODE: {
        pattern: /\b\d{5}(-\d{4})?\b/g,
        replacement: 'XXXXX',
        description: 'ZIP Code'
    }
};

/**
 * Common names that might appear in medical contexts
 * These are treated as potential PHI for extra caution
 */
const COMMON_NAMES = [
    'smith', 'johnson', 'williams', 'brown', 'jones', 'garcia', 'miller', 'davis',
    'rodriguez', 'martinez', 'hernandez', 'lopez', 'gonzalez', 'wilson', 'anderson',
    'thomas', 'taylor', 'moore', 'jackson', 'martin', 'lee', 'perez', 'thompson',
    'white', 'harris', 'sanchez', 'clark', 'ramirez', 'lewis', 'robinson', 'walker'
];

/**
 * Medical terms that are safe to keep (not PHI)
 */
const SAFE_MEDICAL_TERMS = [
    'blood pressure', 'heart rate', 'temperature', 'ct scan', 'mri', 'x-ray',
    'diagnosis', 'treatment', 'medication', 'surgery', 'hospital', 'clinic',
    'doctor', 'nurse', 'patient', 'examination', 'test results', 'ultrasound'
];

/**
 * Data retention policies based on data type and HIPAA requirements
 */
const RETENTION_POLICIES = {
    MEDICAL_RECORDS: { years: 7, description: 'Medical records - 7 years post last treatment' },
    RADIOLOGY: { years: 7, description: 'Radiology images - 7 years' },
    MAMMOGRAPHY: { years: 10, description: 'Mammography - 10 years' },
    AUDIT_LOGS: { years: 7, description: 'Audit logs - 7 years minimum' },
    BILLING: { years: 7, description: 'Billing records - 7 years' },
    TEMP_LOGS: { days: 30, description: 'Temporary processing logs - 30 days' },
    SYSTEM_LOGS: { days: 90, description: 'System logs - 90 days' }
};

/**
 * PHI Data Minimization Service
 */
class PHIDataMinimization {
    constructor(options = {}) {
        this.config = {
            enableAggressive: options.enableAggressive || false,
            preserveContext: options.preserveContext !== false,
            logDetections: options.logDetections !== false,
            ...options
        };
        
        this.detectionStats = {
            totalScanned: 0,
            phiDetected: 0,
            itemsMinimized: 0
        };
    }

    /**
     * Scan and minimize PHI in text data
     * @param {string} text - Text to scan and minimize
     * @param {Object} context - Context information for the scan
     * @returns {Object} Minimization result
     */
    minimizeTextPHI(text, context = {}) {
        if (!text || typeof text !== 'string') {
            return {
                success: true,
                originalText: text,
                minimizedText: text,
                detections: [],
                stats: { phiFound: 0, replacements: 0 }
            };
        }

        this.detectionStats.totalScanned++;

        let minimizedText = text;
        const detections = [];
        let replacementCount = 0;

        // Apply each PHI pattern
        Object.entries(PHI_PATTERNS).forEach(([type, config]) => {
            const matches = [...text.matchAll(config.pattern)];
            
            matches.forEach(match => {
                detections.push({
                    type: type,
                    description: config.description,
                    originalValue: match[0],
                    position: match.index,
                    context: this.extractContext(text, match.index, match[0].length)
                });

                // Replace with appropriate mask
                if (typeof config.replacement === 'function') {
                    minimizedText = minimizedText.replace(match[0], config.replacement(...match));
                } else {
                    minimizedText = minimizedText.replace(match[0], config.replacement);
                }
                
                replacementCount++;
            });
        });

        // Aggressive mode: scan for potential names
        if (this.config.enableAggressive) {
            const nameDetections = this.detectPotentialNames(text);
            nameDetections.forEach(detection => {
                detections.push(detection);
                minimizedText = minimizedText.replace(detection.originalValue, '[NAME]');
                replacementCount++;
            });
        }

        if (detections.length > 0) {
            this.detectionStats.phiDetected++;
            this.detectionStats.itemsMinimized++;
        }

        const result = {
            success: true,
            originalText: text,
            minimizedText: minimizedText,
            detections: detections,
            stats: {
                phiFound: detections.length,
                replacements: replacementCount,
                aggressive: this.config.enableAggressive
            },
            metadata: {
                scanTime: new Date().toISOString(),
                context: context
            }
        };

        if (this.config.logDetections && detections.length > 0) {
            console.log(`[PHI Minimization] Detected ${detections.length} PHI items in text`, {
                context: context,
                types: [...new Set(detections.map(d => d.type))]
            });
        }

        return result;
    }

    /**
     * Minimize PHI in structured data objects
     * @param {Object} data - Data object to minimize
     * @param {Object} context - Context information
     * @returns {Object} Minimization result
     */
    minimizeObjectPHI(data, context = {}) {
        if (!data || typeof data !== 'object') {
            return {
                success: true,
                originalData: data,
                minimizedData: data,
                detections: []
            };
        }

        const minimizedData = JSON.parse(JSON.stringify(data)); // Deep clone
        const detections = [];

        // Recursively scan object properties
        this.scanObjectRecursive(minimizedData, detections, '');

        const result = {
            success: true,
            originalData: data,
            minimizedData: minimizedData,
            detections: detections,
            stats: {
                phiFound: detections.length,
                fieldsScanned: this.countObjectFields(data)
            },
            metadata: {
                scanTime: new Date().toISOString(),
                context: context
            }
        };

        if (this.config.logDetections && detections.length > 0) {
            console.log(`[PHI Minimization] Detected ${detections.length} PHI items in object`, {
                context: context,
                fields: detections.map(d => d.field)
            });
        }

        return result;
    }

    /**
     * Minimize PHI in audit log entries
     * @param {Object} logEntry - Audit log entry
     * @returns {Object} Minimized log entry
     */
    minimizeAuditLog(logEntry) {
        const context = {
            type: 'audit_log',
            action: logEntry.action,
            resourceType: logEntry.resourceType
        };

        // Fields that should never contain PHI (safe to keep)
        const safeFields = [
            'id', 'timestamp', 'action', 'resourceType', 'success',
            'userId', 'userRole', 'ipAddress', 'sessionId'
        ];

        // Fields that might contain PHI (need minimization)
        const sensitiveFields = [
            'errorMessage', 'context', 'resourceId', 'patientMrn'
        ];

        const minimizedEntry = { ...logEntry };

        // Minimize sensitive fields
        sensitiveFields.forEach(field => {
            if (logEntry[field]) {
                if (typeof logEntry[field] === 'string') {
                    const minimized = this.minimizeTextPHI(logEntry[field], {
                        ...context,
                        field: field
                    });
                    minimizedEntry[field] = minimized.minimizedText;
                } else if (typeof logEntry[field] === 'object') {
                    const minimized = this.minimizeObjectPHI(logEntry[field], {
                        ...context,
                        field: field
                    });
                    minimizedEntry[field] = minimized.minimizedData;
                }
            }
        });

        return {
            success: true,
            originalEntry: logEntry,
            minimizedEntry: minimizedEntry,
            metadata: {
                minimizedFields: sensitiveFields.filter(f => logEntry[f]),
                scanTime: new Date().toISOString()
            }
        };
    }

    /**
     * Check if data should be retained based on retention policies
     * @param {Object} dataItem - Data item with metadata
     * @param {string} dataType - Type of data (from RETENTION_POLICIES)
     * @returns {Object} Retention decision
     */
    checkRetentionPolicy(dataItem, dataType) {
        const policy = RETENTION_POLICIES[dataType];
        
        if (!policy) {
            return {
                shouldRetain: true,
                reason: 'No retention policy defined',
                policy: null
            };
        }

        const createdDate = new Date(dataItem.createdDate || dataItem.timestamp);
        const now = new Date();
        
        let retentionPeriod;
        if (policy.years) {
            retentionPeriod = policy.years * 365 * 24 * 60 * 60 * 1000; // Convert years to ms
        } else if (policy.days) {
            retentionPeriod = policy.days * 24 * 60 * 60 * 1000; // Convert days to ms
        } else {
            return {
                shouldRetain: true,
                reason: 'Invalid retention policy',
                policy: policy
            };
        }

        const dataAge = now.getTime() - createdDate.getTime();
        const shouldRetain = dataAge < retentionPeriod;

        return {
            shouldRetain: shouldRetain,
            reason: shouldRetain ? 'Within retention period' : 'Exceeds retention period',
            policy: policy,
            dataAge: {
                days: Math.floor(dataAge / (24 * 60 * 60 * 1000)),
                createdDate: createdDate.toISOString()
            },
            expiryDate: new Date(createdDate.getTime() + retentionPeriod).toISOString()
        };
    }

    /**
     * Generate data minimization report
     * @returns {Object} Minimization statistics
     */
    getMinimizationReport() {
        return {
            statistics: { ...this.detectionStats },
            configuration: {
                aggressiveMode: this.config.enableAggressive,
                contextPreservation: this.config.preserveContext,
                loggingEnabled: this.config.logDetections
            },
            phiPatterns: Object.keys(PHI_PATTERNS).length,
            retentionPolicies: Object.keys(RETENTION_POLICIES).length,
            lastUpdate: new Date().toISOString()
        };
    }

    /**
     * Reset statistics
     */
    resetStatistics() {
        this.detectionStats = {
            totalScanned: 0,
            phiDetected: 0,
            itemsMinimized: 0
        };
    }

    // ============================================================================
    // Private Helper Methods
    // ============================================================================

    /**
     * Detect potential names in text (aggressive mode)
     * @param {string} text - Text to scan
     * @returns {Array} Potential name detections
     */
    detectPotentialNames(text) {
        const detections = [];
        const words = text.toLowerCase().split(/\s+/);
        
        words.forEach((word, index) => {
            // Skip medical terms
            if (SAFE_MEDICAL_TERMS.some(term => term.includes(word))) {
                return;
            }

            // Check if word looks like a name
            if (COMMON_NAMES.includes(word) || 
                (word.length > 2 && word[0] === word[0].toUpperCase())) {
                
                detections.push({
                    type: 'POTENTIAL_NAME',
                    description: 'Potential personal name',
                    originalValue: word,
                    position: index,
                    confidence: COMMON_NAMES.includes(word) ? 'high' : 'medium'
                });
            }
        });

        return detections;
    }

    /**
     * Extract context around detected PHI
     * @param {string} text - Full text
     * @param {number} position - Position of PHI
     * @param {number} length - Length of PHI
     * @returns {string} Context string
     */
    extractContext(text, position, length) {
        if (!this.config.preserveContext) {
            return '';
        }

        const contextLength = 20;
        const start = Math.max(0, position - contextLength);
        const end = Math.min(text.length, position + length + contextLength);
        
        return text.substring(start, end);
    }

    /**
     * Recursively scan object for PHI
     * @param {Object} obj - Object to scan
     * @param {Array} detections - Array to store detections
     * @param {string} path - Current object path
     */
    scanObjectRecursive(obj, detections, path) {
        Object.keys(obj).forEach(key => {
            const currentPath = path ? `${path}.${key}` : key;
            const value = obj[key];

            if (typeof value === 'string') {
                const result = this.minimizeTextPHI(value, { field: currentPath });
                if (result.detections.length > 0) {
                    detections.push({
                        field: currentPath,
                        detections: result.detections
                    });
                    obj[key] = result.minimizedText;
                }
            } else if (typeof value === 'object' && value !== null) {
                this.scanObjectRecursive(value, detections, currentPath);
            }
        });
    }

    /**
     * Count total fields in object (for statistics)
     * @param {Object} obj - Object to count
     * @returns {number} Field count
     */
    countObjectFields(obj) {
        if (!obj || typeof obj !== 'object') {
            return 0;
        }

        let count = 0;
        Object.keys(obj).forEach(key => {
            count++;
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                count += this.countObjectFields(obj[key]);
            }
        });

        return count;
    }

    /**
     * Validate PHI pattern configuration
     * @param {Object} patterns - Patterns to validate
     * @returns {Object} Validation result
     */
    static validatePatterns(patterns) {
        const errors = [];
        
        Object.entries(patterns).forEach(([type, config]) => {
            if (!config.pattern || !(config.pattern instanceof RegExp)) {
                errors.push(`${type}: Invalid or missing pattern`);
            }
            if (!config.replacement) {
                errors.push(`${type}: Missing replacement value`);
            }
            if (!config.description) {
                errors.push(`${type}: Missing description`);
            }
        });

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Get available retention policies
     * @returns {Object} Retention policies
     */
    static getRetentionPolicies() {
        return RETENTION_POLICIES;
    }

    /**
     * Get PHI detection patterns
     * @returns {Object} PHI patterns
     */
    static getPHIPatterns() {
        return PHI_PATTERNS;
    }
}

module.exports = {
    PHIDataMinimization,
    PHI_PATTERNS,
    RETENTION_POLICIES
};