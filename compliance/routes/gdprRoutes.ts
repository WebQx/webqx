/**
 * GDPR API Routes
 * 
 * Express routes for GDPR compliance endpoints including data subject rights,
 * consent management, and right-to-erasure requests
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { ComplianceManager } from '../services/complianceManager';
import { ComplianceRequest } from '../middleware/complianceMiddleware';
import { 
  ConsentType, 
  DataSubjectRightType, 
  LegalBasis,
  DataCategory 
} from '../types/gdpr';

/**
 * Create GDPR routes
 */
export function createGDPRRoutes(config: { complianceManager: ComplianceManager }): Router {
  const router = Router();
  const gdprService = config.complianceManager.getGDPRService();

  if (!gdprService) {
    console.warn('[GDPR Routes] GDPR service not available - routes will return 503');
    
    router.use((req, res) => {
      res.status(503).json({
        error: 'GDPR service not available',
        message: 'GDPR compliance features are not enabled'
      });
    });
    
    return router;
  }

  // Validation middleware
  const handleValidationErrors = (req: Request, res: Response, next: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }
    next();
  };

  /**
   * POST /gdpr/consent
   * Record consent from data subject
   */
  router.post('/consent',
    [
      body('subjectId').notEmpty().withMessage('Subject ID is required'),
      body('subjectEmail').isEmail().withMessage('Valid email is required'),
      body('consentType').isIn([
        'data_processing', 'data_sharing', 'marketing_communications',
        'research_participation', 'third_party_services', 'analytics_tracking',
        'medical_treatment', 'emergency_contact'
      ]).withMessage('Invalid consent type'),
      body('legalBasis').isIn([
        'consent', 'contract', 'legal_obligation', 'vital_interests',
        'public_task', 'legitimate_interests'
      ]).withMessage('Invalid legal basis'),
      body('purpose').notEmpty().withMessage('Purpose is required'),
      body('dataCategories').isArray().withMessage('Data categories must be an array'),
      body('granted').isBoolean().withMessage('Granted must be boolean'),
      body('consentMethod').isIn(['explicit', 'implicit', 'opt_in', 'opt_out']).optional(),
      body('captureMethod').isIn(['web_form', 'email', 'phone', 'paper', 'api']).optional()
    ],
    handleValidationErrors,
    async (req: ComplianceRequest, res: Response) => {
      try {
        const context = req.compliance!.context;
        
        const result = await gdprService.recordConsent(context, {
          subjectId: req.body.subjectId,
          subjectEmail: req.body.subjectEmail,
          consentType: req.body.consentType as ConsentType,
          legalBasis: req.body.legalBasis as LegalBasis,
          purpose: req.body.purpose,
          dataCategories: req.body.dataCategories as DataCategory[],
          processingActivities: req.body.processingActivities || [],
          granted: req.body.granted,
          consentMethod: req.body.consentMethod || 'explicit',
          captureMethod: req.body.captureMethod || 'api',
          policyVersion: req.body.policyVersion || '1.0',
          consentVersion: req.body.consentVersion || '1.0',
          renewalRequired: req.body.renewalRequired || false,
          metadata: req.body.metadata || {}
        });

        if (!result.success) {
          return res.status(400).json({
            error: 'Failed to record consent',
            details: result.error
          });
        }

        res.status(201).json({
          success: true,
          consentId: result.data!.consentId,
          message: 'Consent recorded successfully'
        });

      } catch (error) {
        console.error('[GDPR Routes] Consent recording error:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to process consent request'
        });
      }
    }
  );

  /**
   * DELETE /gdpr/consent/:consentId
   * Withdraw consent
   */
  router.delete('/consent/:consentId',
    [
      param('consentId').notEmpty().withMessage('Consent ID is required'),
      body('reason').optional().isString().withMessage('Reason must be a string')
    ],
    handleValidationErrors,
    async (req: ComplianceRequest, res: Response) => {
      try {
        const context = req.compliance!.context;
        
        const result = await gdprService.withdrawConsent(
          context,
          req.params.consentId,
          req.body.reason
        );

        if (!result.success) {
          return res.status(400).json({
            error: 'Failed to withdraw consent',
            details: result.error
          });
        }

        res.json({
          success: true,
          message: 'Consent withdrawn successfully'
        });

      } catch (error) {
        console.error('[GDPR Routes] Consent withdrawal error:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to process consent withdrawal'
        });
      }
    }
  );

  /**
   * GET /gdpr/consent/:subjectId/:consentType
   * Check consent status
   */
  router.get('/consent/:subjectId/:consentType',
    [
      param('subjectId').notEmpty().withMessage('Subject ID is required'),
      param('consentType').isIn([
        'data_processing', 'data_sharing', 'marketing_communications',
        'research_participation', 'third_party_services', 'analytics_tracking',
        'medical_treatment', 'emergency_contact'
      ]).withMessage('Invalid consent type')
    ],
    handleValidationErrors,
    async (req: ComplianceRequest, res: Response) => {
      try {
        const context = req.compliance!.context;
        
        const result = await gdprService.checkConsent(
          context,
          req.params.subjectId,
          req.params.consentType as ConsentType
        );

        if (!result.success) {
          return res.status(400).json({
            error: 'Failed to check consent',
            details: result.error
          });
        }

        res.json({
          success: true,
          hasValidConsent: result.data!.hasValidConsent,
          consentRecord: result.data!.consentRecord ? {
            id: result.data!.consentRecord.id,
            consentType: result.data!.consentRecord.consentType,
            granted: result.data!.consentRecord.granted,
            grantedAt: result.data!.consentRecord.grantedAt,
            expiresAt: result.data!.consentRecord.expiresAt,
            legalBasis: result.data!.consentRecord.legalBasis
          } : null
        });

      } catch (error) {
        console.error('[GDPR Routes] Consent check error:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to check consent status'
        });
      }
    }
  );

  /**
   * POST /gdpr/request
   * Submit data subject rights request
   */
  router.post('/request',
    [
      body('type').isIn([
        'access', 'rectification', 'erasure', 'restrict',
        'object', 'portability', 'complaint'
      ]).withMessage('Invalid request type'),
      body('subjectId').notEmpty().withMessage('Subject ID is required'),
      body('subjectEmail').isEmail().withMessage('Valid email is required'),
      body('description').optional().isString().withMessage('Description must be a string'),
      body('dataCategories').optional().isArray().withMessage('Data categories must be an array')
    ],
    handleValidationErrors,
    async (req: ComplianceRequest, res: Response) => {
      try {
        const context = req.compliance!.context;
        
        const result = await gdprService.handleDataSubjectRequest(context, {
          type: req.body.type as DataSubjectRightType,
          subjectId: req.body.subjectId,
          subjectEmail: req.body.subjectEmail,
          subjectName: req.body.subjectName,
          requestDate: new Date(),
          description: req.body.description,
          dataCategories: req.body.dataCategories as DataCategory[],
          processingActivities: req.body.processingActivities,
          status: 'submitted',
          communications: []
        });

        if (!result.success) {
          return res.status(400).json({
            error: 'Failed to submit request',
            details: result.error
          });
        }

        res.status(201).json({
          success: true,
          requestId: result.data!.requestId,
          message: 'Data subject request submitted successfully',
          expectedResponseTime: '30 days'
        });

      } catch (error) {
        console.error('[GDPR Routes] Request submission error:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to process data subject request'
        });
      }
    }
  );

  /**
   * GET /gdpr/request/:requestId
   * Get data subject request status
   */
  router.get('/request/:requestId',
    [
      param('requestId').notEmpty().withMessage('Request ID is required')
    ],
    handleValidationErrors,
    async (req: ComplianceRequest, res: Response) => {
      try {
        // In a real implementation, this would fetch from database
        res.json({
          success: true,
          message: 'Request status endpoint - implementation pending',
          requestId: req.params.requestId
        });

      } catch (error) {
        console.error('[GDPR Routes] Request status error:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to retrieve request status'
        });
      }
    }
  );

  /**
   * POST /gdpr/erasure/:requestId
   * Process right-to-erasure request
   */
  router.post('/erasure/:requestId',
    [
      param('requestId').notEmpty().withMessage('Request ID is required')
    ],
    handleValidationErrors,
    async (req: ComplianceRequest, res: Response) => {
      try {
        const context = req.compliance!.context;
        
        const result = await gdprService.processErasureRequest(
          context,
          req.params.requestId
        );

        if (!result.success) {
          return res.status(400).json({
            error: 'Failed to process erasure request',
            details: result.error
          });
        }

        res.json({
          success: true,
          deletedRecords: result.data!.deletedRecords,
          pendingDeletions: result.data!.pendingDeletions,
          message: 'Erasure request processed successfully'
        });

      } catch (error) {
        console.error('[GDPR Routes] Erasure processing error:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to process erasure request'
        });
      }
    }
  );

  /**
   * GET /gdpr/export/:subjectId
   * Export personal data (data portability)
   */
  router.get('/export/:subjectId',
    [
      param('subjectId').notEmpty().withMessage('Subject ID is required'),
      query('format').optional().isIn(['json', 'csv', 'xml']).withMessage('Invalid format')
    ],
    handleValidationErrors,
    async (req: ComplianceRequest, res: Response) => {
      try {
        const context = req.compliance!.context;
        const format = (req.query.format as string) || 'json';
        
        const result = await gdprService.exportPersonalData(
          context,
          req.params.subjectId,
          format as 'json' | 'csv' | 'xml'
        );

        if (!result.success) {
          return res.status(400).json({
            error: 'Failed to export personal data',
            details: result.error
          });
        }

        res.json({
          success: true,
          exportId: result.data!.exportId,
          downloadUrl: result.data!.downloadUrl,
          format,
          message: 'Personal data export prepared successfully'
        });

      } catch (error) {
        console.error('[GDPR Routes] Data export error:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to export personal data'
        });
      }
    }
  );

  /**
   * POST /gdpr/breach
   * Record GDPR breach (admin only)
   */
  router.post('/breach',
    [
      body('description').notEmpty().withMessage('Description is required'),
      body('natureOfBreach').notEmpty().withMessage('Nature of breach is required'),
      body('dataCategories').isArray().withMessage('Data categories must be an array'),
      body('approximateRecordsAffected').isNumeric().withMessage('Records affected must be numeric'),
      body('approximateIndividualsAffected').isNumeric().withMessage('Individuals affected must be numeric'),
      body('breachDate').isISO8601().withMessage('Valid breach date is required'),
      body('discoveryDate').isISO8601().withMessage('Valid discovery date is required'),
      body('riskToIndividuals').isIn(['low', 'medium', 'high']).withMessage('Invalid risk level')
    ],
    handleValidationErrors,
    async (req: ComplianceRequest, res: Response) => {
      try {
        const context = req.compliance!.context;
        
        // Check if user has admin role (in real implementation)
        if (context.userRole !== 'admin' && context.userRole !== 'compliance_officer') {
          return res.status(403).json({
            error: 'Access denied',
            message: 'Only administrators can record GDPR breaches'
          });
        }
        
        const result = await gdprService.recordBreach(context, {
          description: req.body.description,
          natureOfBreach: req.body.natureOfBreach,
          dataCategories: req.body.dataCategories as DataCategory[],
          approximateRecordsAffected: parseInt(req.body.approximateRecordsAffected),
          approximateIndividualsAffected: parseInt(req.body.approximateIndividualsAffected),
          breachDate: new Date(req.body.breachDate),
          discoveryDate: new Date(req.body.discoveryDate),
          riskToIndividuals: req.body.riskToIndividuals,
          likelyConsequences: req.body.likelyConsequences || '',
          containmentMeasures: req.body.containmentMeasures || [],
          supervisoryAuthorityNotification: {
            required: false,
            notified: false
          },
          individualNotification: {
            required: false,
            notified: false
          },
          recoveryMeasures: req.body.recoveryMeasures || [],
          preventiveMeasures: req.body.preventiveMeasures || [],
          status: 'identified',
          metadata: req.body.metadata || {}
        });

        if (!result.success) {
          return res.status(400).json({
            error: 'Failed to record breach',
            details: result.error
          });
        }

        res.status(201).json({
          success: true,
          breachId: result.data!.breachId,
          message: 'GDPR breach recorded successfully'
        });

      } catch (error) {
        console.error('[GDPR Routes] Breach recording error:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to record GDPR breach'
        });
      }
    }
  );

  /**
   * GET /gdpr/health
   * Health check endpoint
   */
  router.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      service: 'GDPR Compliance API',
      timestamp: new Date().toISOString(),
      features: {
        consentManagement: true,
        dataSubjectRights: true,
        rightToErasure: true,
        dataPortability: true,
        breachNotification: true
      }
    });
  });

  return router;
}