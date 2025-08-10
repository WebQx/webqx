/**
 * Compliance Routes Integration
 * 
 * Main router that integrates all compliance-related routes
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { Router } from 'express';
import { ComplianceManager } from '../services/complianceManager';
import { createComplianceMiddleware, createPHIMiddleware, createPersonalDataMiddleware } from '../middleware/complianceMiddleware';
import { createGDPRRoutes } from './gdprRoutes';
import { createLGPDRoutes } from './lgpdRoutes';

/**
 * Create main compliance router with all integrated routes
 */
export function createComplianceRoutes(complianceManager: ComplianceManager): Router {
  const router = Router();

  // Apply compliance middleware to all compliance routes
  const complianceMiddleware = createComplianceMiddleware({
    complianceManager,
    sensitivityLevel: 'confidential',
    resourceType: 'compliance_data',
    onFailure: 'block'
  });

  router.use(complianceMiddleware);

  // GDPR compliance routes
  router.use('/gdpr', createGDPRRoutes(complianceManager));

  // LGPD compliance routes  
  router.use('/lgpd', createLGPDRoutes(complianceManager));

  // HIPAA compliance routes (basic endpoints)
  router.use('/hipaa', createHIPAARoutes(complianceManager));

  // General compliance status endpoint
  router.get('/status', async (req, res) => {
    try {
      const status = {
        hipaa: {
          enabled: !!complianceManager.getHIPAAService(),
          service: 'available'
        },
        gdpr: {
          enabled: !!complianceManager.getGDPRService(),
          service: 'available'
        },
        lgpd: {
          enabled: !!complianceManager.getLGPDService(),
          service: 'available'
        },
        iso27001: {
          enabled: !!complianceManager.getISO27001Service(),
          service: 'available'
        }
      };

      res.json({
        success: true,
        data: status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Compliance Routes] Error getting status:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Compliance validation endpoint
  router.post('/validate', async (req, res) => {
    try {
      const context = (req as any).complianceContext;
      if (!context) {
        return res.status(400).json({ error: 'Compliance context required' });
      }

      const { action } = req.body;

      if (!action || !action.type || !action.resourceType) {
        return res.status(400).json({ 
          error: 'Action with type and resourceType required' 
        });
      }

      const result = await complianceManager.validateCompliance(context, action);

      if (!result.success) {
        return res.status(400).json({
          error: 'Compliance validation failed',
          details: result.error
        });
      }

      res.json({
        success: true,
        data: result.data
      });

    } catch (error) {
      console.error('[Compliance Routes] Error validating compliance:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

/**
 * Create basic HIPAA routes
 */
function createHIPAARoutes(complianceManager: ComplianceManager): Router {
  const router = Router();

  // Apply PHI-specific middleware
  const phiMiddleware = createPHIMiddleware(complianceManager);
  router.use(phiMiddleware);

  /**
   * Log PHI access
   * POST /api/compliance/hipaa/phi-access
   */
  router.post('/phi-access', async (req, res) => {
    try {
      const context = (req as any).complianceContext;
      if (!context) {
        return res.status(400).json({ error: 'Compliance context required' });
      }

      const hipaaService = complianceManager.getHIPAAService();
      if (!hipaaService) {
        return res.status(503).json({ error: 'HIPAA service not available' });
      }

      const {
        patientId,
        patientMRN,
        phiType,
        action,
        purpose,
        accessMethod,
        systemId,
        success,
        errorMessage,
        authorization
      } = req.body;

      const result = await hipaaService.logPHIAccess(context, {
        patientId,
        patientMRN,
        phiType: phiType || ['other'],
        action: action || 'view',
        purpose: purpose || 'treatment',
        accessMethod: accessMethod || 'api',
        systemId: systemId || 'webqx',
        success: success !== undefined ? success : true,
        errorMessage,
        authorization: authorization || { granted: true }
      });

      if (!result.success) {
        return res.status(400).json({
          error: 'Failed to log PHI access',
          details: result.error
        });
      }

      res.status(201).json({
        success: true,
        data: result.data,
        auditId: result.auditId
      });

    } catch (error) {
      console.error('[HIPAA Routes] Error logging PHI access:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * Check PHI authorization
   * POST /api/compliance/hipaa/authorize
   */
  router.post('/authorize', async (req, res) => {
    try {
      const context = (req as any).complianceContext;
      if (!context) {
        return res.status(400).json({ error: 'Compliance context required' });
      }

      const hipaaService = complianceManager.getHIPAAService();
      if (!hipaaService) {
        return res.status(503).json({ error: 'HIPAA service not available' });
      }

      const { patientId, action, purpose } = req.body;

      if (!patientId || !action || !purpose) {
        return res.status(400).json({ 
          error: 'Patient ID, action, and purpose are required' 
        });
      }

      const result = await hipaaService.checkPHIAuthorization(
        context,
        patientId,
        action,
        purpose
      );

      if (!result.success) {
        return res.status(400).json({
          error: 'Failed to check PHI authorization',
          details: result.error
        });
      }

      res.json({
        success: true,
        data: result.data
      });

    } catch (error) {
      console.error('[HIPAA Routes] Error checking authorization:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * Record HIPAA breach
   * POST /api/compliance/hipaa/breach
   */
  router.post('/breach', async (req, res) => {
    try {
      const context = (req as any).complianceContext;
      if (!context) {
        return res.status(400).json({ error: 'Compliance context required' });
      }

      const hipaaService = complianceManager.getHIPAAService();
      if (!hipaaService) {
        return res.status(503).json({ error: 'HIPAA service not available' });
      }

      const {
        occurredAt,
        type,
        severity,
        description,
        affectedPatients,
        individualCount,
        cause,
        discoveryMethod,
        notifications,
        investigation,
        metadata
      } = req.body;

      const result = await hipaaService.recordBreach(context, {
        occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
        type: type || 'data_breach',
        severity: severity || 'medium',
        description: description || 'HIPAA breach recorded via API',
        affectedPatients: affectedPatients || [],
        individualCount: individualCount || 0,
        cause: cause || 'unknown',
        discoveryMethod: discoveryMethod || 'manual',
        notifications: notifications || {
          patientsNotified: false,
          ochsNotified: false,
          mediaNotified: false
        },
        investigation: investigation || { status: 'pending' },
        metadata: metadata || {}
      });

      if (!result.success) {
        return res.status(400).json({
          error: 'Failed to record HIPAA breach',
          details: result.error
        });
      }

      res.status(201).json({
        success: true,
        data: result.data,
        auditId: result.auditId
      });

    } catch (error) {
      console.error('[HIPAA Routes] Error recording breach:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}