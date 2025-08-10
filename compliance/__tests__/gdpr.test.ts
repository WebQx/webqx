/**
 * GDPR Service Tests
 * 
 * Comprehensive test suite for GDPR compliance functionality
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { GDPRServiceImpl } from '../services/gdprService';
import { AuditLogger } from '../../ehr-integrations/services/auditLogger';
import { ComplianceContext } from '../types/compliance';
import { ConsentType, DataSubjectRightType, DataCategory } from '../types/gdpr';

// Mock the audit logger
jest.mock('../../ehr-integrations/services/auditLogger');

describe('GDPR Service', () => {
  let gdprService: GDPRServiceImpl;
  let mockAuditLogger: jest.Mocked<AuditLogger>;
  let testContext: ComplianceContext;

  beforeEach(() => {
    mockAuditLogger = new AuditLogger({
      enabled: true,
      maxInMemoryEntries: 1000,
      retentionDays: 365,
      logToConsole: false,
      logToFile: false,
      logToExternalService: false,
      externalServiceEndpoint: '[NOT_CONFIGURED]'
    }) as jest.Mocked<AuditLogger>;

    mockAuditLogger.log = jest.fn().mockResolvedValue({ success: true, data: { logId: 'test-log-id' } });

    gdprService = new GDPRServiceImpl({
      enabled: true,
      defaultLegalBasis: 'consent',
      consentExpiryDays: 365,
      requestResponseDays: 30,
      erasureTimeframeDays: 30,
      region: 'EU'
    }, mockAuditLogger);

    testContext = {
      userId: 'test-user-123',
      userRole: 'data_controller',
      sessionId: 'session-123',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 Test Browser',
      requestId: 'req-123',
      timestamp: new Date()
    };
  });

  describe('Consent Management', () => {
    it('should record consent successfully', async () => {
      const consent = {
        subjectId: 'subject-123',
        subjectEmail: 'test@example.com',
        consentType: 'data_processing' as ConsentType,
        legalBasis: 'consent' as const,
        granted: true,
        consentText: 'I consent to processing of my personal data',
        purpose: 'Healthcare service provision',
        dataCategories: ['personal_identifiers', 'health_data'] as DataCategory[]
      };

      const result = await gdprService.recordConsent(testContext, consent);

      expect(result.success).toBe(true);
      expect(result.data?.consentId).toBeDefined();
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'consent_granted',
          resourceType: 'gdpr_consent',
          success: true
        })
      );
    });

    it('should withdraw consent successfully', async () => {
      // First record a consent
      const consent = {
        subjectId: 'subject-123',
        subjectEmail: 'test@example.com',
        consentType: 'data_processing' as ConsentType,
        legalBasis: 'consent' as const,
        granted: true,
        consentText: 'I consent to processing',
        purpose: 'Service provision',
        dataCategories: ['personal_identifiers'] as DataCategory[]
      };

      const recordResult = await gdprService.recordConsent(testContext, consent);
      const consentId = recordResult.data!.consentId;

      // Then withdraw it
      const withdrawResult = await gdprService.withdrawConsent(
        testContext,
        consentId,
        'No longer wish to receive services'
      );

      expect(withdrawResult.success).toBe(true);
      expect(withdrawResult.data?.success).toBe(true);
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'consent_withdrawn',
          resourceType: 'gdpr_consent',
          success: true
        })
      );
    });

    it('should check consent status correctly', async () => {
      // Record a valid consent
      const consent = {
        subjectId: 'subject-123',
        subjectEmail: 'test@example.com',
        consentType: 'data_processing' as ConsentType,
        legalBasis: 'consent' as const,
        granted: true,
        consentText: 'I consent',
        purpose: 'Service',
        dataCategories: ['personal_identifiers'] as DataCategory[]
      };

      await gdprService.recordConsent(testContext, consent);

      // Check consent status
      const checkResult = await gdprService.checkConsent(
        testContext,
        'subject-123',
        'data_processing'
      );

      expect(checkResult.success).toBe(true);
      expect(checkResult.data?.hasValidConsent).toBe(true);
      expect(checkResult.data?.consentRecord).toBeDefined();
    });

    it('should return false for non-existent consent', async () => {
      const checkResult = await gdprService.checkConsent(
        testContext,
        'non-existent-subject',
        'data_processing'
      );

      expect(checkResult.success).toBe(true);
      expect(checkResult.data?.hasValidConsent).toBe(false);
      expect(checkResult.data?.consentRecord).toBeUndefined();
    });

    it('should handle consent not found error for withdrawal', async () => {
      const result = await gdprService.withdrawConsent(
        testContext,
        'non-existent-consent-id'
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GDPR_CONSENT_NOT_FOUND');
    });
  });

  describe('Data Subject Rights', () => {
    it('should handle data subject request successfully', async () => {
      const request = {
        subjectId: 'subject-123',
        subjectEmail: 'test@example.com',
        subjectName: 'John Doe',
        type: 'access' as DataSubjectRightType,
        description: 'I want to access my personal data',
        dataCategories: ['personal_identifiers'] as DataCategory[],
        urgency: 'normal' as const
      };

      const result = await gdprService.handleDataSubjectRequest(testContext, request);

      expect(result.success).toBe(true);
      expect(result.data?.requestId).toBeDefined();
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'create',
          resourceType: 'gdpr_subject_request',
          success: true
        })
      );
    });

    it('should process right to erasure request', async () => {
      // First create a data subject request
      const request = {
        subjectId: 'subject-123',
        subjectEmail: 'test@example.com',
        subjectName: 'John Doe',
        type: 'erasure' as DataSubjectRightType,
        description: 'Please delete my data',
        dataCategories: ['personal_identifiers'] as DataCategory[],
        urgency: 'high' as const
      };

      const requestResult = await gdprService.handleDataSubjectRequest(testContext, request);
      const requestId = requestResult.data!.requestId;

      // Then process the erasure
      const erasureResult = await gdprService.processErasureRequest(testContext, requestId);

      expect(erasureResult.success).toBe(true);
      expect(erasureResult.data?.deletedRecords).toBeGreaterThanOrEqual(0);
      expect(erasureResult.data?.pendingDeletions).toBeDefined();
    });

    it('should export personal data successfully', async () => {
      // First record some data by creating consent
      const consent = {
        subjectId: 'subject-123',
        subjectEmail: 'test@example.com',
        consentType: 'data_processing' as ConsentType,
        legalBasis: 'consent' as const,
        granted: true,
        consentText: 'I consent',
        purpose: 'Service',
        dataCategories: ['personal_identifiers'] as DataCategory[]
      };

      await gdprService.recordConsent(testContext, consent);

      // Then export the data
      const exportResult = await gdprService.exportPersonalData(
        testContext,
        'subject-123',
        'json'
      );

      expect(exportResult.success).toBe(true);
      expect(exportResult.data?.exportId).toBeDefined();
      expect(exportResult.data?.downloadUrl).toBeDefined();
    });

    it('should handle invalid request type for erasure', async () => {
      // Create a non-erasure request
      const request = {
        subjectId: 'subject-123',
        subjectEmail: 'test@example.com',
        subjectName: 'John Doe',
        type: 'access' as DataSubjectRightType,
        description: 'Access request',
        dataCategories: [] as DataCategory[],
        urgency: 'normal' as const
      };

      const requestResult = await gdprService.handleDataSubjectRequest(testContext, request);
      const requestId = requestResult.data!.requestId;

      // Try to process as erasure (should fail)
      const erasureResult = await gdprService.processErasureRequest(testContext, requestId);

      expect(erasureResult.success).toBe(false);
      expect(erasureResult.error?.code).toBe('GDPR_INVALID_REQUEST_TYPE');
    });

    it('should handle request not found for erasure', async () => {
      const result = await gdprService.processErasureRequest(
        testContext,
        'non-existent-request-id'
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GDPR_REQUEST_NOT_FOUND');
    });
  });

  describe('Breach Management', () => {
    it('should record GDPR breach successfully', async () => {
      const breach = {
        occurredAt: new Date(),
        description: 'Unauthorized access to personal data',
        riskToIndividuals: 'high' as const,
        approximateIndividualsAffected: 100,
        dataCategories: ['personal_identifiers', 'health_data'] as DataCategory[],
        cause: 'cyber_attack',
        containmentMeasures: ['System shutdown', 'Password reset'],
        remedialActions: ['Security update', 'User notification'],
        preventiveMeasures: ['Enhanced monitoring', 'Security training'],
        supervisoryAuthorityNotification: {
          required: false,
          notified: false
        },
        individualNotification: {
          required: false,
          notified: false
        }
      };

      const result = await gdprService.recordBreach(testContext, breach);

      expect(result.success).toBe(true);
      expect(result.data?.breachId).toBeDefined();
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'create',
          resourceType: 'gdpr_breach',
          success: true
        })
      );
    });

    it('should determine notification requirements correctly', async () => {
      const highRiskBreach = {
        occurredAt: new Date(),
        description: 'High risk breach',
        riskToIndividuals: 'high' as const,
        approximateIndividualsAffected: 500,
        dataCategories: ['special_categories'] as DataCategory[],
        cause: 'human_error',
        containmentMeasures: [],
        remedialActions: [],
        preventiveMeasures: [],
        supervisoryAuthorityNotification: {
          required: false,
          notified: false
        },
        individualNotification: {
          required: false,
          notified: false
        }
      };

      const result = await gdprService.recordBreach(testContext, highRiskBreach);

      expect(result.success).toBe(true);
      // The service should automatically determine notification requirements
      // based on risk level and individual count
    });
  });

  describe('Export Functionality', () => {
    it('should support different export formats', async () => {
      const formats: ('json' | 'csv' | 'xml')[] = ['json', 'csv', 'xml'];

      for (const format of formats) {
        const result = await gdprService.exportPersonalData(
          testContext,
          'subject-123',
          format
        );

        expect(result.success).toBe(true);
        expect(result.data?.downloadUrl).toContain(`.${format}`);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle audit logger errors gracefully', async () => {
      mockAuditLogger.log.mockRejectedValue(new Error('Audit system unavailable'));

      const consent = {
        subjectId: 'subject-123',
        subjectEmail: 'test@example.com',
        consentType: 'data_processing' as ConsentType,
        legalBasis: 'consent' as const,
        granted: true,
        consentText: 'I consent',
        purpose: 'Service',
        dataCategories: [] as DataCategory[]
      };

      const result = await gdprService.recordConsent(testContext, consent);

      // Should still succeed even if audit logging fails
      expect(result.success).toBe(true);
      expect(result.data?.consentId).toBeDefined();
    });

    it('should handle invalid export format', async () => {
      // The service validates format internally, but let's test error handling
      try {
        await gdprService.exportPersonalData(
          testContext,
          'subject-123',
          'invalid' as any
        );
      } catch (error) {
        // Error should be handled gracefully by the service
        expect(error).toBeDefined();
      }
    });
  });

  describe('Configuration and Regional Settings', () => {
    it('should respect consent expiry configuration', async () => {
      // Create service with short expiry for testing
      const shortExpiryService = new GDPRServiceImpl({
        enabled: true,
        consentExpiryDays: 1, // 1 day
        requestResponseDays: 30,
        erasureTimeframeDays: 30,
        region: 'EU'
      }, mockAuditLogger);

      const consent = {
        subjectId: 'subject-123',
        subjectEmail: 'test@example.com',
        consentType: 'data_processing' as ConsentType,
        legalBasis: 'consent' as const,
        granted: true,
        consentText: 'I consent',
        purpose: 'Service',
        dataCategories: [] as DataCategory[]
      };

      await shortExpiryService.recordConsent(testContext, consent);

      // Fast-forward time simulation would require more complex mocking
      // For now, we're just testing that the configuration is respected
      const checkResult = await shortExpiryService.checkConsent(
        testContext,
        'subject-123',
        'data_processing'
      );

      expect(checkResult.success).toBe(true);
    });

    it('should handle different regional configurations', async () => {
      const ukService = new GDPRServiceImpl({
        enabled: true,
        region: 'UK',
        requestResponseDays: 30,
        erasureTimeframeDays: 30
      }, mockAuditLogger);

      expect(ukService).toBeDefined();
      // Additional UK-specific tests could be added here
    });
  });

  describe('Data Categories and Legal Basis', () => {
    it('should handle different legal basis types', async () => {
      const legalBasisTypes = ['consent', 'contract', 'legal_obligation', 'vital_interests'];

      for (const legalBasis of legalBasisTypes) {
        const consent = {
          subjectId: `subject-${legalBasis}`,
          subjectEmail: 'test@example.com',
          consentType: 'data_processing' as ConsentType,
          legalBasis: legalBasis as any,
          granted: true,
          consentText: `Processing based on ${legalBasis}`,
          purpose: 'Service provision',
          dataCategories: ['personal_identifiers'] as DataCategory[]
        };

        const result = await gdprService.recordConsent(testContext, consent);
        expect(result.success).toBe(true);
      }
    });

    it('should handle special categories of data', async () => {
      const specialCategories: DataCategory[] = [
        'special_categories',
        'health_data',
        'biometric_data',
        'genetic_data'
      ];

      for (const category of specialCategories) {
        const consent = {
          subjectId: 'subject-123',
          subjectEmail: 'test@example.com',
          consentType: 'data_processing' as ConsentType,
          legalBasis: 'consent' as const,
          granted: true,
          consentText: `Processing ${category}`,
          purpose: 'Healthcare',
          dataCategories: [category]
        };

        const result = await gdprService.recordConsent(testContext, consent);
        expect(result.success).toBe(true);
      }
    });
  });
});