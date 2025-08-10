/**
 * LGPD API Routes
 * 
 * RESTful endpoints for LGPD compliance operations
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { Router, Request, Response } from 'express';
import { ComplianceManager } from '../services/complianceManager';
import { ComplianceAwareRequest } from '../middleware/complianceMiddleware';
import { LGPDConsentType, LGPDDataSubjectRightType, LGPDDataCategory } from '../types/lgpd';

/**
 * Create LGPD routes
 */
export function createLGPDRoutes(complianceManager: ComplianceManager): Router {
  const router = Router();

  /**
   * Record consent (Registrar consentimento)
   * POST /api/compliance/lgpd/consentimento
   */
  router.post('/consentimento', async (req: ComplianceAwareRequest, res: Response) => {
    try {
      const context = req.complianceContext;
      if (!context) {
        return res.status(400).json({ error: 'Compliance context required' });
      }

      // Get LGPD service (for now, we'll need to add this to ComplianceManager)
      // This is a placeholder implementation
      const lgpdService = (complianceManager as any).getLGPDService?.();
      if (!lgpdService) {
        return res.status(503).json({ error: 'LGPD service not available' });
      }

      const {
        subjectId,
        subjectEmail,
        subjectCPF,
        consentType,
        legalBasis,
        granted,
        consentText,
        explicitConsent,
        pseudonymizationRequired,
        language = 'pt-BR',
        metadata
      } = req.body;

      const result = await lgpdService.recordConsent(context, {
        subjectId,
        subjectEmail,
        subjectCPF,
        consentType: consentType as LGPDConsentType,
        legalBasis: legalBasis || 'consentimento',
        granted,
        consentText,
        explicitConsent: explicitConsent || false,
        pseudonymizationRequired: pseudonymizationRequired || true,
        pseudonymizationApplied: false, // Will be applied by service
        grantedAt: new Date(),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        language: language as 'pt-BR' | 'en',
        metadata
      });

      if (!result.success) {
        return res.status(400).json({
          error: 'Falha ao registrar consentimento',
          details: result.error
        });
      }

      res.status(201).json({
        success: true,
        data: result.data,
        auditId: result.auditId
      });

    } catch (error) {
      console.error('[LGPD Routes] Error recording consent:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  /**
   * Withdraw consent (Revogar consentimento)
   * DELETE /api/compliance/lgpd/consentimento/:consentId
   */
  router.delete('/consentimento/:consentId', async (req: ComplianceAwareRequest, res: Response) => {
    try {
      const context = req.complianceContext;
      if (!context) {
        return res.status(400).json({ error: 'Compliance context required' });
      }

      const lgpdService = (complianceManager as any).getLGPDService?.();
      if (!lgpdService) {
        return res.status(503).json({ error: 'LGPD service not available' });
      }

      const { consentId } = req.params;
      const { motivo } = req.body; // reason in Portuguese

      const result = await lgpdService.withdrawConsent(context, consentId, motivo);

      if (!result.success) {
        return res.status(400).json({
          error: 'Falha ao revogar consentimento',
          details: result.error
        });
      }

      res.json({
        success: true,
        data: result.data
      });

    } catch (error) {
      console.error('[LGPD Routes] Error withdrawing consent:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  /**
   * Check consent status (Verificar status do consentimento)
   * GET /api/compliance/lgpd/consentimento/:subjectId/:consentType
   */
  router.get('/consentimento/:subjectId/:consentType', async (req: ComplianceAwareRequest, res: Response) => {
    try {
      const context = req.complianceContext;
      if (!context) {
        return res.status(400).json({ error: 'Compliance context required' });
      }

      const lgpdService = (complianceManager as any).getLGPDService?.();
      if (!lgpdService) {
        return res.status(503).json({ error: 'LGPD service not available' });
      }

      const { subjectId, consentType } = req.params;

      const result = await lgpdService.checkConsent(
        context,
        subjectId,
        consentType as LGPDConsentType
      );

      if (!result.success) {
        return res.status(400).json({
          error: 'Falha ao verificar consentimento',
          details: result.error
        });
      }

      res.json({
        success: true,
        data: result.data
      });

    } catch (error) {
      console.error('[LGPD Routes] Error checking consent:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  /**
   * Submit data subject request (Solicitar direitos do titular)
   * POST /api/compliance/lgpd/solicitacao-titular
   */
  router.post('/solicitacao-titular', async (req: ComplianceAwareRequest, res: Response) => {
    try {
      const context = req.complianceContext;
      if (!context) {
        return res.status(400).json({ error: 'Compliance context required' });
      }

      const lgpdService = (complianceManager as any).getLGPDService?.();
      if (!lgpdService) {
        return res.status(503).json({ error: 'LGPD service not available' });
      }

      const {
        subjectId,
        subjectCPF,
        subjectEmail,
        subjectName,
        type,
        description,
        identityVerificationMethod
      } = req.body;

      // Calculate due date (LGPD: 15 days)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 15);

      const result = await lgpdService.handleDataSubjectRequest(context, {
        subjectId,
        subjectCPF,
        subjectEmail,
        subjectName,
        type: type as LGPDDataSubjectRightType,
        description,
        status: 'submetido',
        identityVerified: false,
        identityVerificationMethod,
        submittedAt: new Date(),
        dueDate,
        communications: []
      });

      if (!result.success) {
        return res.status(400).json({
          error: 'Falha ao submeter solicitação do titular',
          details: result.error
        });
      }

      res.status(201).json({
        success: true,
        data: result.data,
        auditId: result.auditId
      });

    } catch (error) {
      console.error('[LGPD Routes] Error submitting subject request:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  /**
   * Process data elimination request (Processar eliminação de dados)
   * POST /api/compliance/lgpd/eliminacao/:requestId
   */
  router.post('/eliminacao/:requestId', async (req: ComplianceAwareRequest, res: Response) => {
    try {
      const context = req.complianceContext;
      if (!context) {
        return res.status(400).json({ error: 'Compliance context required' });
      }

      const lgpdService = (complianceManager as any).getLGPDService?.();
      if (!lgpdService) {
        return res.status(503).json({ error: 'LGPD service not available' });
      }

      const { requestId } = req.params;

      const result = await lgpdService.processEliminationRequest(context, requestId);

      if (!result.success) {
        return res.status(400).json({
          error: 'Falha ao processar eliminação de dados',
          details: result.error
        });
      }

      res.json({
        success: true,
        data: result.data
      });

    } catch (error) {
      console.error('[LGPD Routes] Error processing elimination:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  /**
   * Apply pseudonymization (Aplicar pseudonimização)
   * POST /api/compliance/lgpd/pseudonimizacao
   */
  router.post('/pseudonimizacao', async (req: ComplianceAwareRequest, res: Response) => {
    try {
      const context = req.complianceContext;
      if (!context) {
        return res.status(400).json({ error: 'Compliance context required' });
      }

      const lgpdService = (complianceManager as any).getLGPDService?.();
      if (!lgpdService) {
        return res.status(503).json({ error: 'LGPD service not available' });
      }

      const { dataType, dataId } = req.body;

      if (!dataType || !dataId) {
        return res.status(400).json({ 
          error: 'Tipo de dados e ID são obrigatórios' 
        });
      }

      const result = await lgpdService.applyPseudonymization(
        context,
        dataType as LGPDDataCategory,
        dataId
      );

      if (!result.success) {
        return res.status(400).json({
          error: 'Falha ao aplicar pseudonimização',
          details: result.error
        });
      }

      res.json({
        success: true,
        data: result.data
      });

    } catch (error) {
      console.error('[LGPD Routes] Error applying pseudonymization:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  /**
   * Export personal data (Exportar dados pessoais - portabilidade)
   * POST /api/compliance/lgpd/exportacao/:subjectId
   */
  router.post('/exportacao/:subjectId', async (req: ComplianceAwareRequest, res: Response) => {
    try {
      const context = req.complianceContext;
      if (!context) {
        return res.status(400).json({ error: 'Compliance context required' });
      }

      const lgpdService = (complianceManager as any).getLGPDService?.();
      if (!lgpdService) {
        return res.status(503).json({ error: 'LGPD service not available' });
      }

      const { subjectId } = req.params;
      const { formato = 'json' } = req.body;

      if (!['json', 'csv', 'xml'].includes(formato)) {
        return res.status(400).json({ error: 'Formato de exportação inválido' });
      }

      const result = await lgpdService.exportPersonalData(context, subjectId, formato);

      if (!result.success) {
        return res.status(400).json({
          error: 'Falha ao exportar dados pessoais',
          details: result.error
        });
      }

      res.json({
        success: true,
        data: result.data
      });

    } catch (error) {
      console.error('[LGPD Routes] Error exporting data:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  /**
   * Record LGPD breach (Registrar incidente LGPD)
   * POST /api/compliance/lgpd/incidente
   */
  router.post('/incidente', async (req: ComplianceAwareRequest, res: Response) => {
    try {
      const context = req.complianceContext;
      if (!context) {
        return res.status(400).json({ error: 'Compliance context required' });
      }

      const lgpdService = (complianceManager as any).getLGPDService?.();
      if (!lgpdService) {
        return res.status(503).json({ error: 'LGPD service not available' });
      }

      const {
        occurredAt,
        description,
        riskToIndividuals,
        approximateIndividualsAffected,
        dataCategories,
        remedialActions,
        preventiveMeasures
      } = req.body;

      const result = await lgpdService.recordBreach(context, {
        occurredAt: new Date(occurredAt),
        detectedAt: new Date(),
        description,
        riskToIndividuals,
        approximateIndividualsAffected,
        dataCategories,
        remedialActions: remedialActions || [],
        preventiveMeasures: preventiveMeasures || [],
        anpdNotification: {
          required: false,
          notified: false
        },
        individualNotification: {
          required: false,
          notified: false
        },
        localLawEnforcement: {
          notified: false
        },
        status: 'identificado'
      });

      if (!result.success) {
        return res.status(400).json({
          error: 'Falha ao registrar incidente LGPD',
          details: result.error
        });
      }

      res.status(201).json({
        success: true,
        data: result.data,
        auditId: result.auditId
      });

    } catch (error) {
      console.error('[LGPD Routes] Error recording breach:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  /**
   * Generate compliance report (Gerar relatório de conformidade)
   * POST /api/compliance/lgpd/relatorio
   */
  router.post('/relatorio', async (req: ComplianceAwareRequest, res: Response) => {
    try {
      const context = req.complianceContext;
      if (!context) {
        return res.status(400).json({ error: 'Compliance context required' });
      }

      const lgpdService = (complianceManager as any).getLGPDService?.();
      if (!lgpdService) {
        return res.status(503).json({ error: 'LGPD service not available' });
      }

      const { reportType, startDate, endDate } = req.body;

      if (!reportType || !startDate || !endDate) {
        return res.status(400).json({ 
          error: 'Tipo de relatório, data inicial e final são obrigatórios' 
        });
      }

      const result = await lgpdService.generateComplianceReport(
        context,
        reportType as 'resumo' | 'detalhado' | 'incidentes',
        {
          startDate: new Date(startDate),
          endDate: new Date(endDate)
        }
      );

      if (!result.success) {
        return res.status(400).json({
          error: 'Falha ao gerar relatório de conformidade',
          details: result.error
        });
      }

      res.json({
        success: true,
        data: result.data
      });

    } catch (error) {
      console.error('[LGPD Routes] Error generating report:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  return router;
}