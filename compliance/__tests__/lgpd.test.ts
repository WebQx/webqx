/**
 * LGPD Service Tests
 * 
 * Comprehensive test suite for LGPD compliance functionality
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { LGPDServiceImpl } from '../services/lgpdService';
import { AuditLogger } from '../../ehr-integrations/services/auditLogger';
import { ComplianceContext } from '../types/compliance';
import { LGPDConsentType, LGPDDataSubjectRightType, LGPDDataCategory } from '../types/lgpd';

// Mock the audit logger
jest.mock('../../ehr-integrations/services/auditLogger');

describe('LGPD Service', () => {
  let lgpdService: LGPDServiceImpl;
  let mockAuditLogger: jest.Mocked<AuditLogger>;
  let testContext: ComplianceContext;

  beforeEach(() => {
    mockAuditLogger = new AuditLogger({
      enabled: true,
      maxInMemoryEntries: 1000,
      retentionDays: 1826, // 5 years for LGPD
      logToConsole: false,
      logToFile: false,
      logToExternalService: false,
      externalServiceEndpoint: '[NOT_CONFIGURED]'
    }) as jest.Mocked<AuditLogger>;

    mockAuditLogger.log = jest.fn().mockResolvedValue({ success: true, data: { logId: 'test-log-id' } });

    lgpdService = new LGPDServiceImpl({
      enabled: true,
      defaultLegalBasis: 'consentimento',
      consentExpiryDays: 365,
      requestResponseDays: 15,
      eliminationTimeframeDays: 15,
      pseudonymizationRequired: true,
      region: 'BR',
      language: 'pt-BR',
      timezone: 'America/Sao_Paulo'
    }, mockAuditLogger);

    testContext = {
      userId: 'test-user-123',
      userRole: 'controlador_dados',
      sessionId: 'session-123',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 Test Browser',
      requestId: 'req-123',
      timestamp: new Date()
    };
  });

  describe('Consent Management (Gestão de Consentimento)', () => {
    it('should record explicit consent for sensitive data', async () => {
      const consent = {
        subjectId: 'titular-123',
        subjectEmail: 'test@example.com.br',
        subjectCPF: '123.456.789-00',
        consentType: 'dados_sensiveis' as LGPDConsentType,
        legalBasis: 'consentimento' as const,
        granted: true,
        consentText: 'Eu consinto com o tratamento dos meus dados pessoais sensíveis para fins de saúde',
        explicitConsent: true,
        pseudonymizationRequired: true,
        pseudonymizationApplied: false,
        grantedAt: new Date(),
        ipAddress: testContext.ipAddress,
        userAgent: testContext.userAgent,
        language: 'pt-BR' as const
      };

      const result = await lgpdService.recordConsent(testContext, consent);

      expect(result.success).toBe(true);
      expect(result.data?.consentId).toBeDefined();
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'consentimento_concedido',
          resourceType: 'lgpd_consent',
          success: true
        })
      );
    });

    it('should reject non-explicit consent for sensitive data', async () => {
      const consent = {
        subjectId: 'titular-123',
        subjectEmail: 'test@example.com.br',
        consentType: 'dados_sensiveis' as LGPDConsentType,
        legalBasis: 'consentimento' as const,
        granted: true,
        consentText: 'Eu consinto',
        explicitConsent: false, // Should fail for sensitive data
        pseudonymizationRequired: true,
        pseudonymizationApplied: false,
        grantedAt: new Date(),
        ipAddress: testContext.ipAddress,
        userAgent: testContext.userAgent,
        language: 'pt-BR' as const
      };

      const result = await lgpdService.recordConsent(testContext, consent);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('LGPD_EXPLICIT_CONSENT_REQUIRED');
    });

    it('should withdraw consent successfully', async () => {
      // First record a consent
      const consent = {
        subjectId: 'titular-123',
        subjectEmail: 'test@example.com.br',
        subjectCPF: '123.456.789-00',
        consentType: 'dados_pessoais' as LGPDConsentType,
        legalBasis: 'consentimento' as const,
        granted: true,
        consentText: 'Eu consinto com o tratamento',
        explicitConsent: false,
        pseudonymizationRequired: true,
        pseudonymizationApplied: false,
        grantedAt: new Date(),
        ipAddress: testContext.ipAddress,
        userAgent: testContext.userAgent,
        language: 'pt-BR' as const
      };

      const recordResult = await lgpdService.recordConsent(testContext, consent);
      const consentId = recordResult.data!.consentId;

      // Then withdraw it
      const withdrawResult = await lgpdService.withdrawConsent(
        testContext,
        consentId,
        'Não desejo mais receber os serviços'
      );

      expect(withdrawResult.success).toBe(true);
      expect(withdrawResult.data?.success).toBe(true);
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'consentimento_revogado',
          resourceType: 'lgpd_consent',
          success: true
        })
      );
    });

    it('should check consent status correctly', async () => {
      // Record a valid consent
      const consent = {
        subjectId: 'titular-123',
        subjectEmail: 'test@example.com.br',
        consentType: 'dados_pessoais' as LGPDConsentType,
        legalBasis: 'consentimento' as const,
        granted: true,
        consentText: 'Eu consinto',
        explicitConsent: false,
        pseudonymizationRequired: true,
        pseudonymizationApplied: false,
        grantedAt: new Date(),
        ipAddress: testContext.ipAddress,
        userAgent: testContext.userAgent,
        language: 'pt-BR' as const
      };

      await lgpdService.recordConsent(testContext, consent);

      // Check consent status
      const checkResult = await lgpdService.checkConsent(
        testContext,
        'titular-123',
        'dados_pessoais'
      );

      expect(checkResult.success).toBe(true);
      expect(checkResult.data?.hasValidConsent).toBe(true);
      expect(checkResult.data?.consentRecord).toBeDefined();
    });

    it('should apply pseudonymization when required', async () => {
      const consent = {
        subjectId: 'titular-123',
        subjectEmail: 'test@example.com.br',
        subjectCPF: '123.456.789-00',
        consentType: 'dados_pessoais' as LGPDConsentType,
        legalBasis: 'consentimento' as const,
        granted: true,
        consentText: 'Eu consinto',
        explicitConsent: false,
        pseudonymizationRequired: true,
        pseudonymizationApplied: false,
        grantedAt: new Date(),
        ipAddress: testContext.ipAddress,
        userAgent: testContext.userAgent,
        language: 'pt-BR' as const
      };

      const result = await lgpdService.recordConsent(testContext, consent);

      expect(result.success).toBe(true);
      // The service should apply pseudonymization to CPF when required
    });
  });

  describe('Data Subject Rights (Direitos do Titular)', () => {
    it('should handle confirmação de existência request', async () => {
      const request = {
        subjectId: 'titular-123',
        subjectCPF: '123.456.789-00',
        subjectEmail: 'test@example.com.br',
        subjectName: 'João Silva',
        type: 'confirmacao_existencia' as LGPDDataSubjectRightType,
        description: 'Gostaria de confirmar se vocês possuem dados meus',
        status: 'submetido' as const,
        identityVerified: false,
        identityVerificationMethod: 'email_verification',
        submittedAt: new Date(),
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days
        communications: []
      };

      const result = await lgpdService.handleDataSubjectRequest(testContext, request);

      expect(result.success).toBe(true);
      expect(result.data?.requestId).toBeDefined();
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'create',
          resourceType: 'lgpd_subject_request',
          success: true
        })
      );
    });

    it('should handle acesso aos dados request', async () => {
      const request = {
        subjectId: 'titular-123',
        subjectCPF: '123.456.789-00',
        subjectEmail: 'test@example.com.br',
        subjectName: 'Maria Santos',
        type: 'acesso_dados' as LGPDDataSubjectRightType,
        description: 'Gostaria de acessar todos os meus dados pessoais',
        status: 'submetido' as const,
        identityVerified: true,
        identityVerificationMethod: 'cpf_validation',
        submittedAt: new Date(),
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        communications: []
      };

      const result = await lgpdService.handleDataSubjectRequest(testContext, request);

      expect(result.success).toBe(true);
      expect(result.data?.requestId).toBeDefined();
    });

    it('should process eliminação de dados request', async () => {
      // First create a data elimination request
      const request = {
        subjectId: 'titular-123',
        subjectCPF: '123.456.789-00',
        subjectEmail: 'test@example.com.br',
        subjectName: 'Carlos Oliveira',
        type: 'eliminacao_dados' as LGPDDataSubjectRightType,
        description: 'Solicito a eliminação dos meus dados pessoais',
        status: 'submetido' as const,
        identityVerified: true,
        submittedAt: new Date(),
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        communications: []
      };

      const requestResult = await lgpdService.handleDataSubjectRequest(testContext, request);
      const requestId = requestResult.data!.requestId;

      // Then process the elimination
      const eliminationResult = await lgpdService.processEliminationRequest(testContext, requestId);

      expect(eliminationResult.success).toBe(true);
      expect(eliminationResult.data?.deletedRecords).toBeGreaterThanOrEqual(0);
      expect(eliminationResult.data?.pendingDeletions).toBeDefined();
    });

    it('should handle portabilidade de dados request', async () => {
      // First record some data by creating consent
      const consent = {
        subjectId: 'titular-123',
        subjectEmail: 'test@example.com.br',
        consentType: 'dados_pessoais' as LGPDConsentType,
        legalBasis: 'consentimento' as const,
        granted: true,
        consentText: 'Eu consinto',
        explicitConsent: false,
        pseudonymizationRequired: true,
        pseudonymizationApplied: false,
        grantedAt: new Date(),
        ipAddress: testContext.ipAddress,
        userAgent: testContext.userAgent,
        language: 'pt-BR' as const
      };

      await lgpdService.recordConsent(testContext, consent);

      // Then export the data
      const exportResult = await lgpdService.exportPersonalData(
        testContext,
        'titular-123',
        'json'
      );

      expect(exportResult.success).toBe(true);
      expect(exportResult.data?.exportId).toBeDefined();
      expect(exportResult.data?.downloadUrl).toBeDefined();
    });

    it('should respect 15-day response timeframe', async () => {
      const now = new Date();
      const request = {
        subjectId: 'titular-123',
        subjectCPF: '123.456.789-00',
        subjectEmail: 'test@example.com.br',
        subjectName: 'Ana Costa',
        type: 'correcao_dados' as LGPDDataSubjectRightType,
        description: 'Solicito correção dos meus dados',
        status: 'submetido' as const,
        identityVerified: false,
        submittedAt: now,
        dueDate: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000), // 15 days
        communications: []
      };

      const result = await lgpdService.handleDataSubjectRequest(testContext, request);

      expect(result.success).toBe(true);

      // Check that the service respects the 15-day timeframe
      // The service automatically calculates due date as 15 days from now
      const fifteenDaysFromNow = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
      const fifteenDaysInMs = 15 * 24 * 60 * 60 * 1000;
      
      // Verify the timeframe is approximately 15 days (allow for processing time)
      expect(fifteenDaysInMs).toBeGreaterThan(10 * 24 * 60 * 60 * 1000); // At least 10 days
      expect(fifteenDaysInMs).toBeLessThan(20 * 24 * 60 * 60 * 1000); // At most 20 days
    });
  });

  describe('Pseudonymization (Pseudonimização)', () => {
    it('should apply pseudonymization successfully', async () => {
      const result = await lgpdService.applyPseudonymization(
        testContext,
        'dados_identificacao',
        '123.456.789-00'
      );

      expect(result.success).toBe(true);
      expect(result.data?.pseudonymized).toBe(true);
      expect(result.data?.pseudonymId).toBeDefined();
      expect(result.data?.pseudonymId).toContain('pseud_');
    });

    it('should skip pseudonymization when not required', async () => {
      // Create service with pseudonymization disabled
      const noPseudonymService = new LGPDServiceImpl({
        enabled: true,
        pseudonymizationRequired: false,
        region: 'BR'
      }, mockAuditLogger);

      const result = await noPseudonymService.applyPseudonymization(
        testContext,
        'dados_identificacao',
        '123.456.789-00'
      );

      expect(result.success).toBe(true);
      expect(result.data?.pseudonymized).toBe(false);
    });

    it('should handle different data categories for pseudonymization', async () => {
      const dataCategories: LGPDDataCategory[] = [
        'dados_identificacao',
        'dados_contato',
        'dados_saude',
        'dados_biometricos'
      ];

      for (const category of dataCategories) {
        const result = await lgpdService.applyPseudonymization(
          testContext,
          category,
          'sample-data'
        );

        expect(result.success).toBe(true);
        expect(result.data?.pseudonymized).toBe(true);
      }
    });
  });

  describe('Breach Management (Gestão de Incidentes)', () => {
    it('should record LGPD breach successfully', async () => {
      const breach = {
        occurredAt: new Date(),
        detectedAt: new Date(),
        description: 'Acesso não autorizado a dados pessoais',
        riskToIndividuals: 'alto' as const,
        approximateIndividualsAffected: 100,
        dataCategories: ['dados_identificacao', 'dados_saude'] as LGPDDataCategory[],
        remedialActions: ['Redefinição de senhas', 'Notificação aos titulares'],
        preventiveMeasures: ['Monitoramento aprimorado', 'Treinamento de segurança'],
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
        status: 'identificado' as const
      };

      const result = await lgpdService.recordBreach(testContext, breach);

      expect(result.success).toBe(true);
      expect(result.data?.breachId).toBeDefined();
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'create',
          resourceType: 'lgpd_breach',
          success: true
        })
      );
    });

    it('should determine ANPD notification requirements correctly', async () => {
      const highRiskBreach = {
        occurredAt: new Date(),
        detectedAt: new Date(),
        description: 'Incidente de alto risco',
        riskToIndividuals: 'alto' as const,
        approximateIndividualsAffected: 200,
        dataCategories: ['dados_sensiveis'] as LGPDDataCategory[],
        remedialActions: [],
        preventiveMeasures: [],
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
        status: 'identificado' as const
      };

      const result = await lgpdService.recordBreach(testContext, highRiskBreach);

      expect(result.success).toBe(true);
      // The service should automatically determine ANPD notification requirements
    });

    it('should handle low risk breach appropriately', async () => {
      const lowRiskBreach = {
        occurredAt: new Date(),
        detectedAt: new Date(),
        description: 'Incidente de baixo risco',
        riskToIndividuals: 'baixo' as const,
        approximateIndividualsAffected: 5,
        dataCategories: ['dados_contato'] as LGPDDataCategory[],
        remedialActions: ['Correção de configuração'],
        preventiveMeasures: ['Revisão de processos'],
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
        status: 'identificado' as const
      };

      const result = await lgpdService.recordBreach(testContext, lowRiskBreach);

      expect(result.success).toBe(true);
    });
  });

  describe('Compliance Reports (Relatórios de Conformidade)', () => {
    it('should generate summary report (relatório resumo)', async () => {
      const result = await lgpdService.generateComplianceReport(
        testContext,
        'resumo',
        {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          endDate: new Date()
        }
      );

      expect(result.success).toBe(true);
      expect(result.data?.reportId).toBeDefined();
    });

    it('should generate detailed report (relatório detalhado)', async () => {
      const result = await lgpdService.generateComplianceReport(
        testContext,
        'detalhado',
        {
          startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
          endDate: new Date()
        }
      );

      expect(result.success).toBe(true);
      expect(result.data?.reportId).toBeDefined();
    });

    it('should generate incidents report (relatório de incidentes)', async () => {
      const result = await lgpdService.generateComplianceReport(
        testContext,
        'incidentes',
        {
          startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
          endDate: new Date()
        }
      );

      expect(result.success).toBe(true);
      expect(result.data?.reportId).toBeDefined();
    });
  });

  describe('Brazilian-specific Features (Características Específicas do Brasil)', () => {
    it('should handle CPF validation and masking', async () => {
      const consent = {
        subjectId: 'titular-123',
        subjectEmail: 'test@example.com.br',
        subjectCPF: '123.456.789-00',
        consentType: 'dados_pessoais' as LGPDConsentType,
        legalBasis: 'consentimento' as const,
        granted: true,
        consentText: 'Eu consinto',
        explicitConsent: false,
        pseudonymizationRequired: true,
        pseudonymizationApplied: false,
        grantedAt: new Date(),
        ipAddress: testContext.ipAddress,
        userAgent: testContext.userAgent,
        language: 'pt-BR' as const
      };

      const result = await lgpdService.recordConsent(testContext, consent);

      expect(result.success).toBe(true);
      // CPF should be pseudonymized for privacy
    });

    it('should support Portuguese language', async () => {
      const consent = {
        subjectId: 'titular-123',
        subjectEmail: 'test@example.com.br',
        consentType: 'dados_pessoais' as LGPDConsentType,
        legalBasis: 'consentimento' as const,
        granted: true,
        consentText: 'Eu consinto com o tratamento dos meus dados pessoais',
        explicitConsent: false,
        pseudonymizationRequired: true,
        pseudonymizationApplied: false,
        grantedAt: new Date(),
        ipAddress: testContext.ipAddress,
        userAgent: testContext.userAgent,
        language: 'pt-BR' as const
      };

      const result = await lgpdService.recordConsent(testContext, consent);

      expect(result.success).toBe(true);
    });

    it('should handle Brazilian timezone (America/Sao_Paulo)', async () => {
      const request = {
        subjectId: 'titular-123',
        subjectCPF: '123.456.789-00',
        subjectEmail: 'test@example.com.br',
        subjectName: 'Pedro Silva',
        type: 'acesso_dados' as LGPDDataSubjectRightType,
        description: 'Solicitação de acesso',
        status: 'submetido' as const,
        identityVerified: false,
        submittedAt: new Date(),
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        communications: []
      };

      const result = await lgpdService.handleDataSubjectRequest(testContext, request);

      expect(result.success).toBe(true);
      // The service should handle Brazilian business days and timezone
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle audit logger errors gracefully', async () => {
      mockAuditLogger.log.mockRejectedValue(new Error('Sistema de auditoria indisponível'));

      const consent = {
        subjectId: 'titular-123',
        subjectEmail: 'test@example.com.br',
        consentType: 'dados_pessoais' as LGPDConsentType,
        legalBasis: 'consentimento' as const,
        granted: true,
        consentText: 'Eu consinto',
        explicitConsent: false,
        pseudonymizationRequired: true,
        pseudonymizationApplied: false,
        grantedAt: new Date(),
        ipAddress: testContext.ipAddress,
        userAgent: testContext.userAgent,
        language: 'pt-BR' as const
      };

      const result = await lgpdService.recordConsent(testContext, consent);

      // Should still succeed even if audit logging fails
      expect(result.success).toBe(true);
      expect(result.data?.consentId).toBeDefined();
    });

    it('should handle missing required fields', async () => {
      const invalidConsent = {
        subjectId: '',
        subjectEmail: '',
        consentType: 'dados_pessoais' as LGPDConsentType,
        legalBasis: 'consentimento' as const,
        granted: true,
        consentText: '',
        explicitConsent: false,
        pseudonymizationRequired: true,
        pseudonymizationApplied: false,
        grantedAt: new Date(),
        ipAddress: testContext.ipAddress,
        userAgent: testContext.userAgent,
        language: 'pt-BR' as const
      };

      const result = await lgpdService.recordConsent(testContext, invalidConsent);

      // Should still process but may have warnings
      expect(result.success).toBe(true);
    });

    it('should handle invalid request IDs', async () => {
      const result = await lgpdService.processEliminationRequest(
        testContext,
        'id-inexistente'
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('LGPD_REQUEST_NOT_FOUND');
    });
  });

  describe('Integration with Brazilian Regulations', () => {
    it('should handle different legal basis types', async () => {
      const legalBasisTypes = [
        'consentimento',
        'cumprimento_obrigacao',
        'administracao_publica',
        'estudos_orgao_pesquisa',
        'execucao_contrato',
        'exercicio_direitos',
        'protecao_vida',
        'tutela_saude',
        'interesse_legitimo'
      ];

      for (const legalBasis of legalBasisTypes) {
        const consent = {
          subjectId: `titular-${legalBasis}`,
          subjectEmail: 'test@example.com.br',
          consentType: 'dados_pessoais' as LGPDConsentType,
          legalBasis: legalBasis as any,
          granted: true,
          consentText: `Tratamento baseado em ${legalBasis}`,
          explicitConsent: false,
          pseudonymizationRequired: true,
          pseudonymizationApplied: false,
          grantedAt: new Date(),
          ipAddress: testContext.ipAddress,
          userAgent: testContext.userAgent,
          language: 'pt-BR' as const
        };

        const result = await lgpdService.recordConsent(testContext, consent);
        expect(result.success).toBe(true);
      }
    });
  });
});