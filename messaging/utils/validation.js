/**
 * WebQX™ Messaging Validation Utilities
 * 
 * Validation and sanitization utilities for Matrix-based healthcare communications.
 * Ensures message content compliance with healthcare standards and security requirements.
 */

const Joi = require('joi');
const crypto = require('crypto');
const { AuditLogger } = require('./audit');

class MessageValidator {
  constructor(options = {}) {
    this.options = {
      enableStrictValidation: options.enableStrictValidation !== false,
      maxMessageLength: options.maxMessageLength || 10000,
      maxFileSize: options.maxFileSize || 100 * 1024 * 1024, // 100MB
      allowedFileTypes: options.allowedFileTypes || [
        'pdf', 'jpg', 'jpeg', 'png', 'dcm', 'txt', 'doc', 'docx'
      ],
      enableContentScanning: options.enableContentScanning !== false,
      ...options
    };

    this.auditLogger = new AuditLogger();
    this.initializeSchemas();
  }

  /**
   * Initialize validation schemas
   */
  initializeSchemas() {
    // Message content schema
    this.messageSchema = Joi.object({
      body: Joi.string().max(this.options.maxMessageLength).required(),
      msgtype: Joi.string().valid('m.text', 'm.emote', 'm.notice', 'm.file', 'm.image', 'm.audio', 'm.video').required(),
      format: Joi.string().optional(),
      formatted_body: Joi.string().optional(),
      'webqx.metadata': Joi.object({
        patientId: Joi.string().optional(),
        providerId: Joi.string().optional(),
        specialty: Joi.string().optional(),
        timestamp: Joi.string().isoDate().optional(),
        urgency: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
        documentType: Joi.string().optional()
      }).optional()
    });

    // File metadata schema
    this.fileSchema = Joi.object({
      name: Joi.string().required(),
      size: Joi.number().positive().max(this.options.maxFileSize).required(),
      type: Joi.string().required(),
      lastModified: Joi.number().optional()
    });

    // Channel creation schema
    this.channelSchema = Joi.object({
      name: Joi.string().min(1).max(255).required(),
      topic: Joi.string().max(1000).optional(),
      channelType: Joi.string().valid(
        'patient-provider', 'provider-admin', 'specialty', 'emergency', 'general'
      ).required(),
      specialty: Joi.string().valid(
        'primary-care', 'radiology', 'cardiology', 'psychiatry', 
        'oncology', 'pediatrics', 'neurology', 'pulmonology'
      ).optional(),
      isDirect: Joi.boolean().optional(),
      inviteUsers: Joi.array().items(Joi.string()).optional(),
      visibility: Joi.string().valid('private', 'public').optional()
    });

    // User ID schema
    this.userIdSchema = Joi.string().pattern(/^@[a-zA-Z0-9._-]+:[a-zA-Z0-9.-]+$/);

    // Room ID schema
    this.roomIdSchema = Joi.string().pattern(/^![a-zA-Z0-9]+:[a-zA-Z0-9.-]+$/);
  }

  /**
   * Validate message content
   */
  validateMessage(content, options = {}) {
    try {
      // Schema validation
      const { error, value } = this.messageSchema.validate(content, { 
        allowUnknown: true,
        stripUnknown: false 
      });

      if (error) {
        this.auditLogger.logWarning('Message validation failed', {
          error: error.details.map(d => d.message),
          contentType: content.msgtype
        });

        return {
          isValid: false,
          errors: error.details.map(d => d.message),
          sanitizedContent: null
        };
      }

      // Additional healthcare-specific validation
      const healthcareValidation = this.validateHealthcareContent(content, options);
      if (!healthcareValidation.isValid) {
        return healthcareValidation;
      }

      // Content scanning for security threats
      if (this.options.enableContentScanning) {
        const securityValidation = this.scanForSecurityThreats(content);
        if (!securityValidation.isValid) {
          return securityValidation;
        }
      }

      // Sanitize content
      const sanitizedContent = this.sanitizeMessageContent(value);

      this.auditLogger.log('validation', 'Message validated successfully', {
        msgtype: content.msgtype,
        hasMetadata: !!content['webqx.metadata'],
        contentLength: content.body ? content.body.length : 0
      });

      return {
        isValid: true,
        errors: [],
        sanitizedContent
      };

    } catch (error) {
      this.auditLogger.logError('Message validation error', {
        error: error.message
      });

      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`],
        sanitizedContent: null
      };
    }
  }

  /**
   * Validate file for upload
   */
  validateFile(file, options = {}) {
    try {
      // Schema validation
      const { error } = this.fileSchema.validate({
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      });

      if (error) {
        this.auditLogger.logWarning('File validation failed', {
          error: error.details.map(d => d.message),
          filename: file.name,
          fileSize: file.size,
          fileType: file.type
        });

        return {
          isValid: false,
          errors: error.details.map(d => d.message)
        };
      }

      // File type validation
      const fileExtension = this.getFileExtension(file.name);
      if (!this.options.allowedFileTypes.includes(fileExtension.toLowerCase())) {
        this.auditLogger.logWarning('File type not allowed', {
          filename: file.name,
          fileType: fileExtension,
          allowedTypes: this.options.allowedFileTypes
        });

        return {
          isValid: false,
          errors: [`File type '${fileExtension}' is not allowed`]
        };
      }

      // Healthcare document validation
      if (options.isHealthcareDocument) {
        const healthcareValidation = this.validateHealthcareDocument(file, options);
        if (!healthcareValidation.isValid) {
          return healthcareValidation;
        }
      }

      // Security scanning
      const securityValidation = this.scanFileForThreats(file, options);
      if (!securityValidation.isValid) {
        return securityValidation;
      }

      this.auditLogger.log('validation', 'File validated successfully', {
        filename: file.name,
        fileSize: file.size,
        fileType: file.type,
        isHealthcareDocument: options.isHealthcareDocument || false
      });

      return {
        isValid: true,
        errors: []
      };

    } catch (error) {
      this.auditLogger.logError('File validation error', {
        error: error.message,
        filename: file.name
      });

      return {
        isValid: false,
        errors: [`File validation error: ${error.message}`]
      };
    }
  }

  /**
   * Validate channel creation parameters
   */
  validateChannel(channelData) {
    try {
      const { error, value } = this.channelSchema.validate(channelData);

      if (error) {
        this.auditLogger.logWarning('Channel validation failed', {
          error: error.details.map(d => d.message),
          channelName: channelData.name,
          channelType: channelData.channelType
        });

        return {
          isValid: false,
          errors: error.details.map(d => d.message),
          sanitizedData: null
        };
      }

      // Additional business logic validation
      if (value.channelType === 'specialty' && !value.specialty) {
        return {
          isValid: false,
          errors: ['Specialty channels must specify a specialty'],
          sanitizedData: null
        };
      }

      this.auditLogger.log('validation', 'Channel validated successfully', {
        channelName: value.name,
        channelType: value.channelType,
        specialty: value.specialty
      });

      return {
        isValid: true,
        errors: [],
        sanitizedData: value
      };

    } catch (error) {
      this.auditLogger.logError('Channel validation error', {
        error: error.message,
        channelName: channelData.name
      });

      return {
        isValid: false,
        errors: [`Channel validation error: ${error.message}`],
        sanitizedData: null
      };
    }
  }

  /**
   * Validate user ID format
   */
  validateUserId(userId) {
    const { error } = this.userIdSchema.validate(userId);
    return {
      isValid: !error,
      error: error?.message || null
    };
  }

  /**
   * Validate room ID format
   */
  validateRoomId(roomId) {
    const { error } = this.roomIdSchema.validate(roomId);
    return {
      isValid: !error,
      error: error?.message || null
    };
  }

  /**
   * Validate healthcare-specific content
   */
  validateHealthcareContent(content, options) {
    const errors = [];

    // Check for required metadata in healthcare contexts
    if (options.requirePatientId && !content['webqx.metadata']?.patientId) {
      errors.push('Patient ID is required for this message type');
    }

    if (options.requireProviderId && !content['webqx.metadata']?.providerId) {
      errors.push('Provider ID is required for this message type');
    }

    // Validate patient ID format if provided
    if (content['webqx.metadata']?.patientId) {
      if (!this.validatePatientId(content['webqx.metadata'].patientId)) {
        errors.push('Invalid patient ID format');
      }
    }

    // Check for sensitive information that should not be in plain text
    if (this.containsSensitiveInformation(content.body)) {
      errors.push('Message contains sensitive information that requires encryption');
    }

    // Validate urgency levels for clinical communications
    if (content['webqx.metadata']?.urgency === 'critical' && !options.allowCritical) {
      errors.push('Critical urgency level requires special authorization');
    }

    if (errors.length > 0) {
      this.auditLogger.logWarning('Healthcare content validation failed', {
        errors,
        hasPatientId: !!content['webqx.metadata']?.patientId,
        urgency: content['webqx.metadata']?.urgency
      });

      return {
        isValid: false,
        errors
      };
    }

    return { isValid: true, errors: [] };
  }

  /**
   * Validate healthcare document
   */
  validateHealthcareDocument(file, options) {
    const errors = [];

    // Check document type
    if (options.documentType && !this.isValidDocumentType(options.documentType)) {
      errors.push(`Invalid document type: ${options.documentType}`);
    }

    // Validate DICOM files for medical imaging
    if (this.getFileExtension(file.name) === 'dcm') {
      if (!this.validateDicomFile(file)) {
        errors.push('Invalid DICOM file format');
      }
    }

    // Check for required patient ID in healthcare documents
    if (!options.patientId) {
      errors.push('Patient ID is required for healthcare documents');
    }

    if (errors.length > 0) {
      this.auditLogger.logWarning('Healthcare document validation failed', {
        errors,
        filename: file.name,
        documentType: options.documentType
      });

      return {
        isValid: false,
        errors
      };
    }

    return { isValid: true, errors: [] };
  }

  /**
   * Scan content for security threats
   */
  scanForSecurityThreats(content) {
    const threats = [];

    // Check for script injection attempts
    if (this.containsScriptInjection(content.body)) {
      threats.push('Potential script injection detected');
    }

    // Check for SQL injection patterns
    if (this.containsSqlInjection(content.body)) {
      threats.push('Potential SQL injection detected');
    }

    // Check for malicious URLs
    if (this.containsMaliciousUrls(content.body)) {
      threats.push('Potentially malicious URLs detected');
    }

    // Check for excessive special characters (potential buffer overflow)
    if (this.hasExcessiveSpecialCharacters(content.body)) {
      threats.push('Suspicious character patterns detected');
    }

    if (threats.length > 0) {
      this.auditLogger.logSecurity('Security threats detected in message', {
        threats,
        contentLength: content.body.length
      });

      return {
        isValid: false,
        errors: threats
      };
    }

    return { isValid: true, errors: [] };
  }

  /**
   * Scan file for security threats
   */
  scanFileForThreats(file, options) {
    const threats = [];

    // Check file size for potential zip bombs
    if (file.size > this.options.maxFileSize) {
      threats.push('File exceeds maximum allowed size');
    }

    // Check for suspicious file names
    if (this.hasSuspiciousFilename(file.name)) {
      threats.push('Suspicious filename detected');
    }

    // Check MIME type consistency
    const expectedMimeType = this.getExpectedMimeType(file.name);
    if (expectedMimeType && file.type !== expectedMimeType) {
      threats.push('File type mismatch detected');
    }

    if (threats.length > 0) {
      this.auditLogger.logSecurity('Security threats detected in file', {
        threats,
        filename: file.name,
        fileSize: file.size
      });

      return {
        isValid: false,
        errors: threats
      };
    }

    return { isValid: true, errors: [] };
  }

  /**
   * Sanitize message content
   */
  sanitizeMessageContent(content) {
    const sanitized = { ...content };

    // Sanitize message body
    if (sanitized.body) {
      sanitized.body = this.sanitizeText(sanitized.body);
    }

    // Sanitize formatted body if present
    if (sanitized.formatted_body) {
      sanitized.formatted_body = this.sanitizeHtml(sanitized.formatted_body);
    }

    // Ensure metadata is properly structured
    if (sanitized['webqx.metadata']) {
      sanitized['webqx.metadata'] = this.sanitizeMetadata(sanitized['webqx.metadata']);
    }

    return sanitized;
  }

  /**
   * Sanitize text content
   */
  sanitizeText(text) {
    if (typeof text !== 'string') return text;

    return text
      // Remove null bytes
      .replace(/\0/g, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      // Trim
      .trim()
      // Remove potential control characters
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  /**
   * Sanitize HTML content
   */
  sanitizeHtml(html) {
    if (typeof html !== 'string') return html;

    // Basic HTML sanitization - in production, use a proper HTML sanitizer
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  /**
   * Sanitize metadata
   */
  sanitizeMetadata(metadata) {
    const sanitized = {};

    Object.keys(metadata).forEach(key => {
      const value = metadata[key];
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeText(value);
      } else {
        sanitized[key] = value;
      }
    });

    return sanitized;
  }

  /**
   * Helper methods for validation
   */

  getFileExtension(filename) {
    return filename.split('.').pop() || '';
  }

  getExpectedMimeType(filename) {
    const ext = this.getFileExtension(filename).toLowerCase();
    const mimeTypes = {
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'txt': 'text/plain',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
    return mimeTypes[ext] || null;
  }

  validatePatientId(patientId) {
    // Example validation - adjust based on your patient ID format
    return /^[A-Z0-9]{6,12}$/.test(patientId);
  }

  isValidDocumentType(documentType) {
    const validTypes = [
      'lab_result', 'prescription', 'imaging', 'chart_note',
      'consent_form', 'insurance_card', 'referral'
    ];
    return validTypes.includes(documentType);
  }

  containsSensitiveInformation(text) {
    const sensitivePatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b\d{4}[\s-]\d{4}[\s-]\d{4}[\s-]\d{4}\b/, // Credit card
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i // Email (in some contexts)
    ];

    return sensitivePatterns.some(pattern => pattern.test(text));
  }

  containsScriptInjection(text) {
    const scriptPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /document\./i
    ];

    return scriptPatterns.some(pattern => pattern.test(text));
  }

  containsSqlInjection(text) {
    const sqlPatterns = [
      /('\s*(or|and)\s*'.*')/i,
      /(union\s+select)/i,
      /(drop\s+table)/i,
      /(insert\s+into)/i,
      /(delete\s+from)/i
    ];

    return sqlPatterns.some(pattern => pattern.test(text));
  }

  containsMaliciousUrls(text) {
    const urlPattern = /https?:\/\/[^\s]+/gi;
    const urls = text.match(urlPattern) || [];
    
    // Check against known malicious domains (simplified example)
    const maliciousDomains = ['malicious.com', 'phishing.net'];
    
    return urls.some(url => 
      maliciousDomains.some(domain => url.includes(domain))
    );
  }

  hasExcessiveSpecialCharacters(text) {
    const specialCharCount = (text.match(/[!@#$%^&*(),.?":{}|<>]/g) || []).length;
    return specialCharCount > text.length * 0.3; // More than 30% special characters
  }

  hasSuspiciousFilename(filename) {
    const suspiciousPatterns = [
      /\.(exe|bat|cmd|scr|pif|com)$/i,
      /\.\./,
      /[<>:"|?*]/,
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(filename));
  }

  validateDicomFile(file) {
    // Basic DICOM validation - check for DICOM header
    // In production, this would be more comprehensive
    return file.name.toLowerCase().endsWith('.dcm');
  }

  /**
   * Get validation statistics
   */
  getValidationStats() {
    // This would be enhanced to track validation statistics over time
    return {
      validatorVersion: '1.0.0',
      maxMessageLength: this.options.maxMessageLength,
      maxFileSize: this.options.maxFileSize,
      allowedFileTypes: this.options.allowedFileTypes,
      strictValidationEnabled: this.options.enableStrictValidation,
      contentScanningEnabled: this.options.enableContentScanning
    };
  }
}

module.exports = { MessageValidator };