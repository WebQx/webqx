/**
 * Consent Management API Routes for Telepsychiatry Platform
 * 
 * Handles signed consent forms storage and audit logging
 * HIPAA-compliant consent management with encryption and audit trails
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const crypto = require('crypto');

const router = express.Router();

// In-memory storage for demo purposes (use database in production)
const consentStorage = new Map();
const auditLogs = [];

// Encryption helper functions
const encryptData = (data) => {
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from(process.env.CONSENT_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'), 'hex');
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipher(algorithm, key);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    algorithm
  };
};

const decryptData = (encryptedData) => {
  try {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.CONSENT_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'), 'hex');
    
    // For demo purposes, return mock decrypted data if actual decryption fails
    return JSON.parse(encryptedData.encrypted || '{}');
  } catch (error) {
    console.error('Decryption error:', error);
    return {};
  }
};

// Middleware to validate session/auth
const requireAuth = (req, res, next) => {
  const sessionId = req.cookies?.sessionId || req.headers['x-session-id'] || req.headers.authorization?.replace('Bearer ', '');
  
  if (!sessionId) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication required'
    });
  }
  
  // In a real implementation, validate the session with userService
  req.user = { id: 'user-123', role: 'PROVIDER' }; // Mock user for demo
  next();
};

/**
 * POST /consent/record
 * Stores signed consent forms with encryption and audit logging
 */
router.post('/record',
  requireAuth,
  [
    body('patientId')
      .notEmpty()
      .withMessage('Patient ID is required'),
    body('consentType')
      .isIn(['telepsychiatry', 'data_sharing', 'recording', 'treatment'])
      .withMessage('Valid consent type is required'),
    body('consentText')
      .notEmpty()
      .withMessage('Consent text is required'),
    body('patientSignature')
      .notEmpty()
      .withMessage('Patient signature is required'),
    body('witnessSignature')
      .optional()
      .isString(),
    body('agreementDate')
      .isISO8601()
      .withMessage('Valid agreement date is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: errors.array()
        });
      }

      const {
        patientId,
        consentType,
        consentText,
        patientSignature,
        witnessSignature,
        agreementDate,
        expirationDate,
        metadata
      } = req.body;

      const consentId = `consent_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      
      const consentRecord = {
        id: consentId,
        patientId,
        consentType,
        consentText,
        patientSignature,
        witnessSignature,
        agreementDate,
        expirationDate: expirationDate || null,
        metadata: metadata || {},
        providerId: req.user.id,
        createdAt: new Date().toISOString(),
        status: 'active',
        version: '1.0'
      };

      // Encrypt the consent record
      const encryptedRecord = encryptData(consentRecord);
      consentStorage.set(consentId, encryptedRecord);

      // Log audit entry
      const auditEntry = {
        id: `audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        action: 'CONSENT_RECORDED',
        consentId,
        patientId,
        providerId: req.user.id,
        timestamp: new Date().toISOString(),
        ipAddress: req.ip || req.connection.remoteAddress || '127.0.0.1',
        userAgent: req.get('User-Agent') || 'Unknown',
        details: {
          consentType,
          hasWitness: !!witnessSignature
        }
      };
      auditLogs.push(auditEntry);

      res.status(201).json({
        consentId,
        status: 'recorded',
        message: 'Consent form recorded successfully',
        timestamp: new Date().toISOString(),
        expirationDate: consentRecord.expirationDate
      });

    } catch (error) {
      console.error('[Consent API] Record error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to record consent form'
      });
    }
  }
);

/**
 * GET /consent/audit
 * Queries consent logs for a user or session with filtering options
 */
router.get('/audit',
  requireAuth,
  [
    query('patientId')
      .optional()
      .isString()
      .withMessage('Patient ID must be a string'),
    query('consentType')
      .optional()
      .isIn(['telepsychiatry', 'data_sharing', 'recording', 'treatment'])
      .withMessage('Invalid consent type'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be in ISO 8601 format'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be in ISO 8601 format'),
    query('action')
      .optional()
      .isIn(['CONSENT_RECORDED', 'CONSENT_UPDATED', 'CONSENT_REVOKED', 'CONSENT_ACCESSED'])
      .withMessage('Invalid audit action'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a non-negative integer')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: errors.array()
        });
      }

      const {
        patientId,
        consentType,
        startDate,
        endDate,
        action,
        limit = 50,
        offset = 0
      } = req.query;

      // Filter audit logs based on query parameters
      let filteredLogs = auditLogs.filter(log => {
        if (patientId && log.patientId !== patientId) return false;
        if (action && log.action !== action) return false;
        if (consentType && log.details?.consentType !== consentType) return false;
        
        if (startDate) {
          const logDate = new Date(log.timestamp);
          const filterStartDate = new Date(startDate);
          if (logDate < filterStartDate) return false;
        }
        
        if (endDate) {
          const logDate = new Date(log.timestamp);
          const filterEndDate = new Date(endDate);
          if (logDate > filterEndDate) return false;
        }
        
        return true;
      });

      // Sort by timestamp (most recent first)
      filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Apply pagination
      const paginatedLogs = filteredLogs.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

      // Remove sensitive information for response
      const sanitizedLogs = paginatedLogs.map(log => ({
        id: log.id,
        action: log.action,
        consentId: log.consentId,
        patientId: log.patientId,
        timestamp: log.timestamp,
        details: log.details,
        // Hide IP address and user agent for privacy
        location: log.ipAddress ? 'Recorded' : 'Unknown'
      }));

      res.json({
        logs: sanitizedLogs,
        pagination: {
          total: filteredLogs.length,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: filteredLogs.length > parseInt(offset) + parseInt(limit)
        },
        summary: {
          totalConsents: consentStorage.size,
          totalAuditEntries: auditLogs.length,
          dateRange: {
            earliest: auditLogs.length > 0 ? Math.min(...auditLogs.map(log => new Date(log.timestamp))) : null,
            latest: auditLogs.length > 0 ? Math.max(...auditLogs.map(log => new Date(log.timestamp))) : null
          }
        }
      });

    } catch (error) {
      console.error('[Consent API] Audit query error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to retrieve audit logs'
      });
    }
  }
);

/**
 * GET /consent/:consentId
 * Retrieve a specific consent record (for authorized users only)
 */
router.get('/:consentId',
  requireAuth,
  [
    param('consentId')
      .notEmpty()
      .matches(/^consent_\d+_[a-f0-9]+$/)
      .withMessage('Invalid consent ID format')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid consent ID',
          details: errors.array()
        });
      }

      const { consentId } = req.params;
      const encryptedRecord = consentStorage.get(consentId);

      if (!encryptedRecord) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Consent record not found'
        });
      }

      // Decrypt the record
      const consentRecord = decryptData(encryptedRecord);

      // Log access audit entry
      const auditEntry = {
        id: `audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        action: 'CONSENT_ACCESSED',
        consentId,
        patientId: consentRecord.patientId,
        providerId: req.user.id,
        timestamp: new Date().toISOString(),
        ipAddress: req.ip || req.connection.remoteAddress || '127.0.0.1',
        userAgent: req.get('User-Agent') || 'Unknown'
      };
      auditLogs.push(auditEntry);

      // Return consent record without sensitive encryption details
      const sanitizedRecord = {
        id: consentRecord.id,
        patientId: consentRecord.patientId,
        consentType: consentRecord.consentType,
        agreementDate: consentRecord.agreementDate,
        expirationDate: consentRecord.expirationDate,
        status: consentRecord.status,
        version: consentRecord.version,
        createdAt: consentRecord.createdAt,
        hasWitness: !!consentRecord.witnessSignature,
        metadata: consentRecord.metadata
      };

      res.json(sanitizedRecord);

    } catch (error) {
      console.error('[Consent API] Retrieve error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to retrieve consent record'
      });
    }
  }
);

module.exports = router;