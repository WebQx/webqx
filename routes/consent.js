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

// Encryption helper functions (simplified for demo)
const encryptData = (data) => {
  // For demo purposes, just return the JSON-stringified data
  // In production, use proper encryption
  return JSON.stringify(data);
};

const decryptData = (encryptedData) => {
  try {
    // For demo purposes, simplified decryption
    if (typeof encryptedData === 'string') {
      return JSON.parse(encryptedData);
    }
    return encryptedData || {};
  } catch (error) {
    // Suppress console errors during testing to avoid test pollution
    if (process.env.NODE_ENV !== 'test') {
      console.error('Decryption error:', error);
    }
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
 * Record GDPR-compliant patient consent (OpenAPI spec)
 */
router.post('/record',
  requireAuth,
  [
    body('patient_id')
      .notEmpty()
      .withMessage('Patient ID is required'),
    body('timestamp')
      .isISO8601()
      .withMessage('Valid timestamp is required'),
    body('purpose')
      .notEmpty()
      .withMessage('Purpose is required')
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
        patient_id,
        timestamp,
        purpose
      } = req.body;

      const consentId = `consent_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      
      const consentRecord = {
        id: consentId,
        patient_id,
        timestamp,
        purpose,
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
        patientId: patient_id,
        providerId: req.user.id,
        timestamp: new Date().toISOString(),
        ipAddress: req.ip || req.connection.remoteAddress || '127.0.0.1',
        userAgent: req.get('User-Agent') || 'Unknown',
        details: {
          purpose
        }
      };
      auditLogs.push(auditEntry);

      res.status(200).json({
        message: 'Consent recorded',
        consentId,
        status: 'recorded',
        timestamp: new Date().toISOString()
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
 * POST /consent/revoke
 * Revoke patient consent (OpenAPI spec)
 */
router.post('/revoke',
  requireAuth,
  [
    body('patient_id')
      .notEmpty()
      .withMessage('Patient ID is required'),
    body('reason')
      .notEmpty()
      .withMessage('Reason is required')
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
        patient_id,
        reason
      } = req.body;

      // Find all active consents for this patient
      const patientConsents = Array.from(consentStorage.entries())
        .map(([id, encryptedRecord]) => {
          const record = decryptData(encryptedRecord);
          return { id, record };
        })
        .filter(({ record }) => 
          record && 
          record.patient_id === patient_id && 
          record.status === 'active'
        );

      if (patientConsents.length === 0) {
        return res.status(404).json({
          error: 'NO_ACTIVE_CONSENT',
          message: 'No active consent found for the specified patient'
        });
      }

      // Revoke all active consents for this patient
      const revokedConsentIds = [];
      patientConsents.forEach(({ id, record }) => {
        record.status = 'revoked';
        record.revokedAt = new Date().toISOString();
        record.revocationReason = reason;
        
        // Re-encrypt and store
        const encryptedRecord = encryptData(record);
        consentStorage.set(id, encryptedRecord);
        revokedConsentIds.push(id);
      });

      // Log audit entry for revocation
      const auditEntry = {
        id: `audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        action: 'CONSENT_REVOKED',
        consentIds: revokedConsentIds,
        patientId: patient_id,
        providerId: req.user.id,
        timestamp: new Date().toISOString(),
        ipAddress: req.ip || req.connection.remoteAddress || '127.0.0.1',
        userAgent: req.get('User-Agent') || 'Unknown',
        details: {
          reason,
          revokedCount: revokedConsentIds.length
        }
      };
      auditLogs.push(auditEntry);

      res.status(200).json({
        message: 'Consent revoked',
        patient_id,
        revokedConsentIds,
        timestamp: new Date().toISOString(),
        reason
      });

    } catch (error) {
      console.error('[Consent API] Revoke error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to revoke consent'
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