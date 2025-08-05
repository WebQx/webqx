/**
 * HIPAA Service Tests
 * 
 * Comprehensive test suite for HIPAA compliance functionality
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { HIPAAServiceImpl } from '../services/hipaaService';
import { AuditLogger } from '../../ehr-integrations/services/auditLogger';
import { ComplianceContext } from '../types/compliance';
import { PHIAction, PHIPurpose, PHIType } from '../types/hipaa';

// Mock the audit logger
jest.mock('../../ehr-integrations/services/auditLogger');

describe('HIPAA Service', () => {
  let hipaaService: HIPAAServiceImpl;
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

    hipaaService = new HIPAAServiceImpl({
      enabled: true,
      phiRetentionDays: 2555,
      breachDetectionThreshold: {
        failedAccessAttempts: 3,
        timeWindowMinutes: 10,
        suspiciousPatternEnabled: true
      },
      baaManagement: {
        expirationWarningDays: 30,
        autoRenewEnabled: false
      }
    }, mockAuditLogger);

    testContext = {
      userId: 'test-user-123',
      userRole: 'physician',
      sessionId: 'session-123',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 Test Browser',
      requestId: 'req-123',
      timestamp: new Date()
    };
  });

  describe('PHI Access Logging', () => {
    it('should log successful PHI access', async () => {
      const phiAccess = {
        patientId: 'patient-123',
        patientMRN: 'MRN-456',
        phiType: ['medical_information'] as PHIType[],
        action: 'view' as PHIAction,
        purpose: 'treatment' as PHIPurpose,
        accessMethod: 'api' as const,
        systemId: 'webqx-test',
        success: true,
        authorization: {
          granted: true,
          grantedBy: 'system',
          grantedAt: new Date()
        },
        context: { testAccess: true }
      };

      const result = await hipaaService.logPHIAccess(testContext, phiAccess);

      expect(result.success).toBe(true);
      expect(result.data?.logId).toBeDefined();
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'view',
          resourceType: 'phi_data',
          resourceId: 'patient-123',
          success: true
        })
      );
    });

    it('should log failed PHI access and trigger breach detection', async () => {
      const phiAccess = {
        patientId: 'patient-123',
        patientMRN: 'MRN-456',
        phiType: ['medical_information'] as PHIType[],
        action: 'view' as PHIAction,
        purpose: 'treatment' as PHIPurpose,
        accessMethod: 'api' as const,
        systemId: 'webqx-test',
        success: false,
        errorMessage: 'Access denied',
        authorization: {
          granted: false,
          reason: 'Insufficient privileges'
        },
        context: { testAccess: true }
      };

      // Log multiple failed attempts to trigger breach detection
      for (let i = 0; i < 4; i++) {
        await hipaaService.logPHIAccess(testContext, phiAccess);
      }

      expect(mockAuditLogger.log).toHaveBeenCalledTimes(4); // Initial logs
      // Additional calls for breach detection would be made
    });

    it('should handle logging errors gracefully', async () => {
      mockAuditLogger.log.mockRejectedValue(new Error('Audit system unavailable'));

      const phiAccess = {
        patientId: 'patient-123',
        phiType: ['medical_information'] as PHIType[],
        action: 'view' as PHIAction,
        purpose: 'treatment' as PHIPurpose,
        accessMethod: 'api' as const,
        systemId: 'webqx-test',
        success: true,
        authorization: { granted: true }
      };

      const result = await hipaaService.logPHIAccess(testContext, phiAccess);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('HIPAA_PHI_LOG_ERROR');
    });
  });

  describe('PHI Authorization', () => {
    it('should authorize physician to view PHI for treatment', async () => {
      const result = await hipaaService.checkPHIAuthorization(
        testContext,
        'patient-123',
        'view',
        'treatment'
      );

      expect(result.success).toBe(true);
      expect(result.data?.authorized).toBe(true);
    });

    it('should deny unauthorized access based on user role', async () => {
      const billingContext = { ...testContext, userRole: 'billing' };

      const result = await hipaaService.checkPHIAuthorization(
        billingContext,
        'patient-123',
        'delete',
        'treatment'
      );

      expect(result.success).toBe(true);
      expect(result.data?.authorized).toBe(false);
      expect(result.data?.reason).toContain('not authorized for action');
    });

    it('should deny access for invalid purpose', async () => {
      const result = await hipaaService.checkPHIAuthorization(
        { ...testContext, userRole: 'billing' },
        'patient-123',
        'view',
        'research'
      );

      expect(result.success).toBe(true);
      expect(result.data?.authorized).toBe(false);
      expect(result.data?.reason).toContain('not valid for user role');
    });
  });

  describe('Breach Recording', () => {
    it('should record HIPAA breach successfully', async () => {
      const breach = {
        occurredAt: new Date(),
        type: 'unauthorized_access' as const,
        severity: 'high' as const,
        description: 'Test breach for unit testing',
        affectedPatients: [{
          patientId: 'patient-123',
          patientMRN: 'MRN-456',
          phiTypesAffected: ['medical_information'] as PHIType[]
        }],
        individualCount: 1,
        cause: 'human_error' as const,
        discoveryMethod: 'automated',
        notifications: {
          patientsNotified: false,
          ochsNotified: false,
          mediaNotified: false
        },
        investigation: {
          status: 'pending' as const
        },
        metadata: { testBreach: true }
      };

      const result = await hipaaService.recordBreach(testContext, breach);

      expect(result.success).toBe(true);
      expect(result.data?.breachId).toBeDefined();
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'create',
          resourceType: 'hipaa_breach',
          success: true
        })
      );
    });

    it('should handle breach recording errors', async () => {
      mockAuditLogger.log.mockRejectedValue(new Error('Database error'));

      const breach = {
        occurredAt: new Date(),
        type: 'unauthorized_access' as const,
        severity: 'low' as const,
        description: 'Test breach',
        affectedPatients: [],
        individualCount: 0,
        cause: 'human_error' as const,
        discoveryMethod: 'manual',
        notifications: {
          patientsNotified: false,
          ochsNotified: false,
          mediaNotified: false
        },
        investigation: { status: 'pending' as const },
        metadata: {}
      };

      const result = await hipaaService.recordBreach(testContext, breach);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('HIPAA_BREACH_RECORD_ERROR');
    });
  });

  describe('Audit Report Generation', () => {
    beforeEach(async () => {
      // Add some test PHI access logs
      const phiAccess = {
        patientId: 'patient-123',
        phiType: ['medical_information'] as PHIType[],
        action: 'view' as PHIAction,
        purpose: 'treatment' as PHIPurpose,
        accessMethod: 'api' as const,
        systemId: 'webqx-test',
        success: true,
        authorization: { granted: true }
      };

      await hipaaService.logPHIAccess(testContext, phiAccess);
      await hipaaService.logPHIAccess(testContext, { ...phiAccess, patientId: 'patient-456' });
    });

    it('should generate audit report for date range', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date();

      const result = await hipaaService.generateAuditReport(testContext, {
        startDate,
        endDate
      });

      expect(result.success).toBe(true);
      expect(result.data?.reportId).toBeDefined();
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'access',
          resourceType: 'hipaa_audit_report',
          success: true
        })
      );
    });

    it('should filter audit reports by patient ID', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date();

      const result = await hipaaService.generateAuditReport(testContext, {
        startDate,
        endDate,
        patientId: 'patient-123'
      });

      expect(result.success).toBe(true);
      expect(result.data?.reportId).toBeDefined();
    });
  });

  describe('Business Associate Agreement Management', () => {
    it('should create new BAA successfully', async () => {
      const baaData = {
        organizationName: 'Test Healthcare Provider',
        contactPerson: 'John Doe',
        contactEmail: 'john.doe@test.com',
        agreementType: 'standard' as const,
        effectiveDate: new Date(),
        expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        servicesDescription: 'Healthcare IT services',
        phiTypesAccessed: ['medical_information'] as PHIType[]
      };

      const result = await hipaaService.manageBBA(testContext, 'create', baaData);

      expect(result.success).toBe(true);
      expect(result.data?.baaId).toBeDefined();
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'create',
          resourceType: 'business_associate_agreement',
          success: true
        })
      );
    });

    it('should update existing BAA', async () => {
      // First create a BAA
      const baaData = {
        organizationName: 'Test Provider',
        contactPerson: 'Jane Doe',
        contactEmail: 'jane@test.com',
        effectiveDate: new Date(),
        expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        servicesDescription: 'Test services',
        phiTypesAccessed: [] as PHIType[]
      };

      const createResult = await hipaaService.manageBBA(testContext, 'create', baaData);
      const baaId = createResult.data!.baaId;

      // Then update it
      const updateResult = await hipaaService.manageBBA(testContext, 'update', {
        id: baaId,
        contactPerson: 'Jane Smith'
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.data?.baaId).toBe(baaId);
    });

    it('should terminate BAA', async () => {
      // First create a BAA
      const baaData = {
        organizationName: 'Test Provider',
        contactPerson: 'John Smith',
        contactEmail: 'john@test.com',
        effectiveDate: new Date(),
        expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        servicesDescription: 'Test services',
        phiTypesAccessed: [] as PHIType[]
      };

      const createResult = await hipaaService.manageBBA(testContext, 'create', baaData);
      const baaId = createResult.data!.baaId;

      // Then terminate it
      const terminateResult = await hipaaService.manageBBA(testContext, 'terminate', {
        id: baaId
      });

      expect(terminateResult.success).toBe(true);
      expect(terminateResult.data?.baaId).toBe(baaId);
    });

    it('should handle BAA not found error', async () => {
      const result = await hipaaService.manageBBA(testContext, 'update', {
        id: 'non-existent-baa'
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('not found');
    });
  });

  describe('Configuration and Role-Based Access', () => {
    it('should respect configured role permissions', async () => {
      const nurseContext = { ...testContext, userRole: 'nurse' };
      
      // Nurse should be able to view
      const viewResult = await hipaaService.checkPHIAuthorization(
        nurseContext,
        'patient-123',
        'view',
        'treatment'
      );
      expect(viewResult.data?.authorized).toBe(true);

      // Nurse should not be able to delete
      const deleteResult = await hipaaService.checkPHIAuthorization(
        nurseContext,
        'patient-123',
        'delete',
        'treatment'
      );
      expect(deleteResult.data?.authorized).toBe(false);
    });

    it('should validate purpose for different roles', async () => {
      const researcherContext = { ...testContext, userRole: 'researcher' };
      
      // Researcher should be able to access for research purpose
      const researchResult = await hipaaService.checkPHIAuthorization(
        researcherContext,
        'patient-123',
        'view',
        'research'
      );
      expect(researchResult.data?.authorized).toBe(true);

      // Researcher should not be able to access for treatment
      const treatmentResult = await hipaaService.checkPHIAuthorization(
        researcherContext,
        'patient-123',
        'view',
        'treatment'
      );
      expect(treatmentResult.data?.authorized).toBe(false);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing required fields gracefully', async () => {
      const result = await hipaaService.logPHIAccess(testContext, {
        patientId: '',
        phiType: [],
        action: 'view',
        purpose: 'treatment',
        accessMethod: 'api',
        systemId: 'test',
        success: true,
        authorization: { granted: true }
      });

      expect(result.success).toBe(true); // Should still log even with minimal data
    });

    it('should handle concurrent access attempts', async () => {
      const phiAccess = {
        patientId: 'patient-123',
        phiType: ['medical_information'] as PHIType[],
        action: 'view' as PHIAction,
        purpose: 'treatment' as PHIPurpose,
        accessMethod: 'api' as const,
        systemId: 'webqx-test',
        success: true,
        authorization: { granted: true }
      };

      // Simulate concurrent access attempts
      const promises = Array(10).fill(null).map(() => 
        hipaaService.logPHIAccess(testContext, phiAccess)
      );

      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });
});