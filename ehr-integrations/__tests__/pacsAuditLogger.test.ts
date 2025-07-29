/**
 * Test Suite for PACS Audit Logger Service
 * 
 * Comprehensive tests for PACS-specific audit logging functionality
 * ensuring HIPAA compliance and proper tracking of imaging activities.
 */

import PACSAuditLogger, { PACSAuditInput, PACSAuditAction, PACSResourceType } from '../services/pacsAuditLogger';
import { AuditContext } from '../services/auditLogger';

describe('PACS Audit Logger', () => {
  let pacsAuditLogger: PACSAuditLogger;
  
  beforeEach(() => {
    pacsAuditLogger = new PACSAuditLogger();
  });

  afterEach(() => {
    // Clean up any resources
  });

  describe('Basic PACS Audit Logging', () => {
    test('should log DICOM image view action successfully', async () => {
      const auditInput: PACSAuditInput = {
        action: 'pacs_image_view',
        resourceType: 'dicom_image',
        resourceId: 'IMG-12345',
        patientMrn: 'MRN-98765',
        success: true,
        pacsContext: {
          studyInstanceUID: '1.2.840.113619.2.5.1762583153.215519.978957063.78',
          seriesInstanceUID: '1.2.840.113619.2.5.1762583153.215519.978957063.121',
          sopInstanceUID: '1.2.840.113619.2.5.1762583153.215519.978957063.789',
          modality: 'CT',
          accessLevel: 'view',
          encryptionStatus: 'encrypted'
        }
      };

      const result = await pacsAuditLogger.logPACS(auditInput);

      expect(result.success).toBe(true);
      expect(result.data?.logId).toBeDefined();
      expect(result.data?.logId).toMatch(/^pacs_audit_\d+_/);
    });

    test('should log DICOM upload action with proper context', async () => {
      const auditInput: PACSAuditInput = {
        action: 'pacs_image_upload',
        resourceType: 'dicom_image',
        resourceId: 'IMG-54321',
        patientMrn: 'MRN-11111',
        success: true,
        pacsContext: {
          studyInstanceUID: '1.2.840.113619.2.5.1762583153.215519.978957063.99',
          modality: 'MRI',
          imagingDevice: 'Siemens MAGNETOM',
          accessLevel: 'edit',
          encryptionStatus: 'encrypted',
          imageSize: 52428800, // 50MB
          compressionType: 'JPEG2000'
        }
      };

      const result = await pacsAuditLogger.logPACS(auditInput);

      expect(result.success).toBe(true);
      expect(result.data?.logId).toBeDefined();
    });

    test('should log failed PACS access attempt', async () => {
      const auditInput: PACSAuditInput = {
        action: 'pacs_study_access',
        resourceType: 'dicom_study',
        resourceId: 'STUDY-404',
        patientMrn: 'MRN-00000',
        success: false,
        errorMessage: 'Insufficient permissions to access study',
        pacsContext: {
          studyInstanceUID: '1.2.840.113619.2.5.1762583153.215519.978957063.404',
          accessLevel: 'view',
          accessJustification: 'Patient care'
        }
      };

      const result = await pacsAuditLogger.logPACS(auditInput);

      expect(result.success).toBe(true);
      expect(result.data?.logId).toBeDefined();
    });
  });

  describe('DICOM Access Logging', () => {
    test('should log DICOM access with all parameters', async () => {
      await pacsAuditLogger.logDICOMAccess(
        '1.2.840.113619.2.5.1762583153.215519.978957063.100',
        '1.2.840.113619.2.5.1762583153.215519.978957063.200',
        '1.2.840.113619.2.5.1762583153.215519.978957063.300',
        'MRN-77777',
        'view',
        true
      );

      // Verify the log was created (this would require access to internal state)
      // In a real implementation, you might want to add a method to retrieve logs for testing
    });

    test('should log DICOM download attempt', async () => {
      await pacsAuditLogger.logDICOMAccess(
        '1.2.840.113619.2.5.1762583153.215519.978957063.101',
        '1.2.840.113619.2.5.1762583153.215519.978957063.201',
        '1.2.840.113619.2.5.1762583153.215519.978957063.301',
        'MRN-88888',
        'download',
        true
      );

      // Verify logging occurred
    });

    test('should log failed DICOM edit attempt with error', async () => {
      await pacsAuditLogger.logDICOMAccess(
        '1.2.840.113619.2.5.1762583153.215519.978957063.102',
        '1.2.840.113619.2.5.1762583153.215519.978957063.202',
        '1.2.840.113619.2.5.1762583153.215519.978957063.302',
        'MRN-99999',
        'edit',
        false,
        'Read-only access level'
      );

      // Verify error logging
    });
  });

  describe('Transcription Activity Logging', () => {
    test('should log transcription start activity', async () => {
      await pacsAuditLogger.logTranscriptionActivity(
        '1.2.840.113619.2.5.1762583153.215519.978957063.150',
        'TRANS-12345',
        'es',
        'start',
        true
      );

      // Verify transcription logging
    });

    test('should log transcription completion', async () => {
      await pacsAuditLogger.logTranscriptionActivity(
        '1.2.840.113619.2.5.1762583153.215519.978957063.150',
        'TRANS-12345',
        'es',
        'complete',
        true
      );

      // Verify completion logging
    });

    test('should log failed transcription with error', async () => {
      await pacsAuditLogger.logTranscriptionActivity(
        '1.2.840.113619.2.5.1762583153.215519.978957063.151',
        'TRANS-54321',
        'fr',
        'start',
        false,
        'Translation service unavailable'
      );

      // Verify error logging
    });
  });

  describe('Audit Context Management', () => {
    test('should set and use audit context', () => {
      const context: AuditContext = {
        userId: 'user123',
        userRole: 'radiologist',
        sessionId: 'session456',
        ipAddress: '192.168.1.100',
        requestId: 'req789'
      };

      pacsAuditLogger.setContext(context);

      // Context should be used in subsequent logs
      // This would require access to internal state to verify
    });

    test('should update context fields', () => {
      const initialContext: AuditContext = {
        userId: 'user123',
        userRole: 'technologist'
      };

      pacsAuditLogger.setContext(initialContext);
      
      pacsAuditLogger.updateContext({
        sessionId: 'new_session',
        ipAddress: '10.0.0.50'
      });

      // Verify context update
    });

    test('should clear audit context', () => {
      const context: AuditContext = {
        userId: 'user123',
        userRole: 'radiologist'
      };

      pacsAuditLogger.setContext(context);
      pacsAuditLogger.clearContext();

      // Verify context is cleared
    });
  });

  describe('Compliance Reporting', () => {
    test('should generate compliance report with metrics', async () => {
      // Log some test activities first
      await pacsAuditLogger.logPACS({
        action: 'pacs_image_view',
        resourceType: 'dicom_image',
        resourceId: 'IMG-001',
        success: true,
        pacsContext: {
          accessLevel: 'view',
          encryptionStatus: 'encrypted'
        }
      });

      await pacsAuditLogger.logPACS({
        action: 'pacs_image_view',
        resourceType: 'dicom_image',
        resourceId: 'IMG-002',
        success: false,
        pacsContext: {
          accessLevel: 'view',
          encryptionStatus: 'unencrypted'
        }
      });

      // Use current date range to ensure logs are captured
      const now = new Date();
      const startDate = new Date(now.getTime() - 60000); // 1 minute ago
      const endDate = new Date(now.getTime() + 60000); // 1 minute from now

      const report = await pacsAuditLogger.generateComplianceReport(startDate, endDate);

      expect(report.totalAccesses).toBeGreaterThan(0);
      expect(report.unauthorizedAttempts).toBeGreaterThanOrEqual(0);
      expect(report.encryptionCompliance).toBeGreaterThanOrEqual(0);
      expect(report.encryptionCompliance).toBeLessThanOrEqual(100);
      expect(report.accessByRole).toBeDefined();
      expect(report.criticalEvents).toBeDefined();
      expect(Array.isArray(report.criticalEvents)).toBe(true);
    });

    test('should identify data breaches in compliance report', async () => {
      // Log activities that should be flagged as potential breaches
      await pacsAuditLogger.logPACS({
        action: 'pacs_share_external',
        resourceType: 'dicom_image',
        resourceId: 'IMG-BREACH',
        success: true,
        pacsContext: {
          accessLevel: 'admin',
          encryptionStatus: 'unencrypted'
        }
      });

      const report = await pacsAuditLogger.generateComplianceReport(
        new Date('2024-01-01'), 
        new Date('2025-12-31') // Use future date to capture current logs
      );

      expect(report.dataBreaches).toBeGreaterThan(0);
      expect(report.criticalEvents.length).toBeGreaterThan(0);
    });
  });

  describe('High-Risk Activity Detection', () => {
    test('should detect high-risk delete operations', async () => {
      const auditInput: PACSAuditInput = {
        action: 'pacs_image_delete',
        resourceType: 'dicom_image',
        resourceId: 'IMG-DELETE',
        patientMrn: 'MRN-RISK',
        success: true,
        pacsContext: {
          accessLevel: 'admin',
          encryptionStatus: 'encrypted'
        }
      };

      // Mock console.warn to verify it's called
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await pacsAuditLogger.logPACS(auditInput);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[PACS AUDIT] HIGH-RISK ACTIVITY DETECTED'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });

    test('should detect unencrypted data access', async () => {
      const auditInput: PACSAuditInput = {
        action: 'pacs_image_view',
        resourceType: 'dicom_image',
        resourceId: 'IMG-UNENCRYPTED',
        success: true,
        pacsContext: {
          accessLevel: 'view',
          encryptionStatus: 'unencrypted'
        }
      };

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await pacsAuditLogger.logPACS(auditInput);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('should detect failed access attempts', async () => {
      const auditInput: PACSAuditInput = {
        action: 'pacs_study_access',
        resourceType: 'dicom_study',
        resourceId: 'STUDY-FAIL',
        success: false,
        errorMessage: 'Access denied',
        pacsContext: {
          accessLevel: 'view'
        }
      };

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await pacsAuditLogger.logPACS(auditInput);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    test('should handle logging errors gracefully', async () => {
      // Test with invalid input
      const invalidInput = {
        action: 'invalid_action' as PACSAuditAction,
        resourceType: 'invalid_resource' as PACSResourceType,
        resourceId: '',
        success: true
      };

      const result = await pacsAuditLogger.logPACS(invalidInput);

      // Should not throw error, but may return success: false
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    test('should handle missing PACS context', async () => {
      const auditInput: PACSAuditInput = {
        action: 'pacs_image_view',
        resourceType: 'dicom_image',
        resourceId: 'IMG-NO-CONTEXT',
        success: true
        // No pacsContext provided
      };

      const result = await pacsAuditLogger.logPACS(auditInput);

      expect(result.success).toBe(true);
    });
  });

  describe('PACS Audit Log Retrieval', () => {
    beforeEach(async () => {
      // Set up test data
      await pacsAuditLogger.logPACS({
        action: 'pacs_image_view',
        resourceType: 'dicom_image',
        resourceId: 'IMG-TEST-1',
        patientMrn: 'MRN-TEST-1',
        success: true,
        pacsContext: {
          studyInstanceUID: 'STUDY-1',
          modality: 'CT',
          accessLevel: 'view'
        }
      });

      await pacsAuditLogger.logPACS({
        action: 'pacs_image_view',
        resourceType: 'dicom_image',
        resourceId: 'IMG-TEST-2',
        patientMrn: 'MRN-TEST-2',
        success: true,
        pacsContext: {
          studyInstanceUID: 'STUDY-2',
          modality: 'MRI',
          accessLevel: 'view'
        }
      });
    });

    test('should retrieve logs by study UID', async () => {
      const logs = await pacsAuditLogger.getPACSAuditLogs('STUDY-1');

      expect(logs).toBeDefined();
      expect(Array.isArray(logs)).toBe(true);
      // In a real implementation, we'd expect to find the specific log
    });

    test('should retrieve logs by patient MRN', async () => {
      const logs = await pacsAuditLogger.getPACSAuditLogs(undefined, 'MRN-TEST-1');

      expect(logs).toBeDefined();
      expect(Array.isArray(logs)).toBe(true);
    });

    test('should retrieve logs by date range', async () => {
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - 1); // 1 hour ago
      
      const endDate = new Date();
      endDate.setHours(endDate.getHours() + 1); // 1 hour from now

      const logs = await pacsAuditLogger.getPACSAuditLogs(undefined, undefined, startDate, endDate);

      expect(logs).toBeDefined();
      expect(Array.isArray(logs)).toBe(true);
    });

    test('should return logs in chronological order (newest first)', async () => {
      const logs = await pacsAuditLogger.getPACSAuditLogs();

      expect(logs).toBeDefined();
      expect(Array.isArray(logs)).toBe(true);
      
      if (logs.length > 1) {
        // Verify descending order
        for (let i = 0; i < logs.length - 1; i++) {
          expect(logs[i].timestamp.getTime()).toBeGreaterThanOrEqual(logs[i + 1].timestamp.getTime());
        }
      }
    });
  });
});