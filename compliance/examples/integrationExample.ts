/**
 * WebQx Compliance Framework Integration Example
 * 
 * This example demonstrates how to integrate the compliance framework
 * into your WebQx application with HIPAA, GDPR, and LGPD support
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import express from 'express';
import { ComplianceConfigLoader, createConfiguredComplianceManager } from '../config/configLoader';
import { createComplianceRoutes } from '../routes/complianceRoutes';
import { createComplianceMiddleware, createPHIMiddleware, createPersonalDataMiddleware } from '../middleware/complianceMiddleware';
import { AuditLogger } from '../../ehr-integrations/services/auditLogger';

/**
 * Example Express application with integrated compliance framework
 */
export async function createComplianceEnabledApp(): Promise<express.Application> {
  const app = express();

  // Configure JSON parsing
  app.use(express.json());

  // Initialize audit logger
  const auditLogger = new AuditLogger({
    enabled: true,
    maxInMemoryEntries: 10000,
    retentionDays: 2555, // 7 years for HIPAA compliance
    logToConsole: true,
    logToFile: true,
    logFilePath: './compliance-audit.log',
    logToExternalService: false,
    externalServiceEndpoint: '[NOT_CONFIGURED]'
  });

  // Initialize compliance configuration
  const configLoader = ComplianceConfigLoader.getInstance();
  
  // Load configuration from environment variables or set defaults
  await configLoader.updateConfig({
    hipaa: {
      enabled: true,
      strictMode: true,
      phiRetentionDays: 2555,
      auditRetentionDays: 2555
    },
    gdpr: {
      enabled: true,
      region: 'EU',
      dataProcessingLegalBasis: 'consent',
      consentExpiryDays: 365,
      erasureTimeframeDays: 30
    },
    lgpd: {
      enabled: true,
      region: 'BR',
      dataProcessingLegalBasis: 'consentimento',
      consentExpiryDays: 365,
      eliminationTimeframeDays: 15,
      pseudonymizationRequired: true,
      language: 'pt-BR'
    },
    iso27001: {
      enabled: true,
      auditLevel: 'detailed',
      riskAssessmentInterval: 365,
      incidentResponseEnabled: true
    }
  });

  // Initialize compliance manager
  const complianceManager = await createConfiguredComplianceManager(auditLogger);

  // Add compliance routes
  app.use('/api/compliance', createComplianceRoutes(complianceManager));

  // Example: Protected patient routes with PHI compliance
  const patientRouter = express.Router();
  
  // Apply PHI middleware to all patient routes
  patientRouter.use(createPHIMiddleware(complianceManager));

  patientRouter.get('/:patientId', async (req, res) => {
    try {
      const context = (req as any).complianceContext;
      
      // Simulate patient data retrieval
      const patientData = {
        id: req.params.patientId,
        name: 'John Doe',
        email: 'john.doe@example.com',
        medicalRecordNumber: 'MRN-12345'
      };

      // Log PHI access
      const hipaaService = complianceManager.getHIPAAService();
      if (hipaaService) {
        await hipaaService.logPHIAccess(context, {
          patientId: req.params.patientId,
          patientMRN: 'MRN-12345',
          phiType: ['medical_information'],
          action: 'view',
          purpose: 'treatment',
          accessMethod: 'api',
          systemId: 'webqx-patient-portal',
          success: true,
          authorization: {
            granted: true,
            grantedBy: 'system',
            grantedAt: new Date()
          }
        });
      }

      res.json({
        success: true,
        data: patientData,
        compliance: {
          phiAccessLogged: true,
          hipaaCompliant: true
        }
      });

    } catch (error) {
      console.error('Error retrieving patient data:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.use('/api/patients', patientRouter);

  // Example: User data routes with GDPR/LGPD compliance
  const userRouter = express.Router();
  
  // Apply personal data middleware
  userRouter.use(createPersonalDataMiddleware(complianceManager));

  userRouter.get('/:userId', async (req, res) => {
    try {
      const context = (req as any).complianceContext;
      
      // Check GDPR consent
      const gdprService = complianceManager.getGDPRService();
      if (gdprService) {
        const consentCheck = await gdprService.checkConsent(
          context,
          req.params.userId,
          'data_processing'
        );

        if (!consentCheck.success || !consentCheck.data?.hasValidConsent) {
          return res.status(403).json({
            error: 'GDPR consent required for data processing',
            compliance: {
              gdprCompliant: false,
              consentRequired: true
            }
          });
        }
      }

      // Simulate user data retrieval
      const userData = {
        id: req.params.userId,
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        preferences: {}
      };

      res.json({
        success: true,
        data: userData,
        compliance: {
          gdprCompliant: true,
          consentVerified: true
        }
      });

    } catch (error) {
      console.error('Error retrieving user data:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.use('/api/users', userRouter);

  // Health check endpoint
  app.get('/health/compliance', async (req, res) => {
    try {
      const status = configLoader.getComplianceStatus();
      
      res.json({
        success: true,
        data: {
          status: 'healthy',
          services: status,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(500).json({ 
        success: false,
        error: 'Health check failed' 
      });
    }
  });

  // Dynamic configuration endpoints
  app.get('/api/compliance/config', (req, res) => {
    try {
      const config = configLoader.getConfig();
      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      console.error('Error getting configuration:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.put('/api/compliance/config', async (req, res) => {
    try {
      const newConfig = req.body;
      
      // Validate configuration
      const validation = configLoader.validateConfig(newConfig);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Invalid configuration',
          details: validation.errors
        });
      }

      await configLoader.updateConfig(newConfig);
      
      res.json({
        success: true,
        message: 'Configuration updated successfully'
      });
    } catch (error) {
      console.error('Error updating configuration:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return app;
}

// Example middleware integration for existing routes
export function integrateComplianceIntoExistingApp(
  app: express.Application,
  complianceManager: any
): void {
  
  // Add compliance middleware to sensitive routes
  const sensitiveRoutes = [
    '/api/patients',
    '/api/users',
    '/api/medical-records',
    '/api/appointments',
    '/api/prescriptions'
  ];

  sensitiveRoutes.forEach(route => {
    app.use(route, createComplianceMiddleware({
      complianceManager,
      sensitivityLevel: 'confidential',
      resourceType: 'healthcare_data',
      involvesPHI: true,
      involvesPersonalData: true,
      requiresConsent: true,
      onFailure: 'block'
    }));
  });

  console.log('✅ Compliance middleware integrated into existing routes');
}