/**
 * PACS Service Tests
 * 
 * Tests for PACS integration services.
 */

import { DICOMValidator } from '../utils/dicomValidation';
import { SpecialtyWorkflows } from '../utils/specialtyWorkflows';
import { defaultPACSConfiguration, validatePACSConfiguration } from '../config';
import { PACSServiceError } from '../types';

describe('PACS Integration', () => {
  describe('DICOMValidator', () => {
    describe('validateStudyInstanceUID', () => {
      test('should validate correct Study Instance UID', () => {
        const validUID = '1.2.3.4.5.6.7.8.9.0.1.2.3.4.5.6';
        expect(DICOMValidator.validateStudyInstanceUID(validUID)).toBe(true);
      });

      test('should reject invalid Study Instance UID', () => {
        expect(DICOMValidator.validateStudyInstanceUID('')).toBe(false);
        expect(DICOMValidator.validateStudyInstanceUID('invalid-uid')).toBe(false);
        expect(DICOMValidator.validateStudyInstanceUID('1.2.3.abc')).toBe(false);
      });

      test('should reject UID that is too long', () => {
        const longUID = '1.'.repeat(100);
        expect(DICOMValidator.validateStudyInstanceUID(longUID)).toBe(false);
      });
    });

    describe('validatePatientID', () => {
      test('should validate correct Patient ID', () => {
        expect(DICOMValidator.validatePatientID('PAT12345')).toBe(true);
        expect(DICOMValidator.validatePatientID('PATIENT_001')).toBe(true);
        expect(DICOMValidator.validatePatientID('PAT-123-456')).toBe(true);
      });

      test('should reject invalid Patient ID', () => {
        expect(DICOMValidator.validatePatientID('')).toBe(false);
        expect(DICOMValidator.validatePatientID('PAT 123')).toBe(false); // spaces not allowed
        expect(DICOMValidator.validatePatientID('PAT@123')).toBe(false); // special chars not allowed
      });
    });

    describe('validateDICOMDate', () => {
      test('should validate correct DICOM date', () => {
        expect(DICOMValidator.validateDICOMDate('20240115')).toBe(true);
        expect(DICOMValidator.validateDICOMDate('19900101')).toBe(true);
      });

      test('should reject invalid DICOM date', () => {
        expect(DICOMValidator.validateDICOMDate('2024-01-15')).toBe(false); // wrong format
        expect(DICOMValidator.validateDICOMDate('20241301')).toBe(false); // invalid month
        expect(DICOMValidator.validateDICOMDate('20240132')).toBe(false); // invalid day
        expect(DICOMValidator.validateDICOMDate('18990101')).toBe(false); // year too old
      });
    });

    describe('validateModality', () => {
      test('should validate correct modalities', () => {
        expect(DICOMValidator.validateModality('CT')).toBe(true);
        expect(DICOMValidator.validateModality('MR')).toBe(true);
        expect(DICOMValidator.validateModality('XA')).toBe(true);
        expect(DICOMValidator.validateModality('US')).toBe(true);
      });

      test('should reject invalid modalities', () => {
        expect(DICOMValidator.validateModality('INVALID')).toBe(false);
        expect(DICOMValidator.validateModality('')).toBe(false);
        expect(DICOMValidator.validateModality('XX')).toBe(false);
      });
    });

    describe('validateDICOMStudy', () => {
      test('should validate complete study object', () => {
        const study = {
          studyInstanceUID: '1.2.3.4.5.6.7.8.9.0.1.2.3.4.5.6',
          patientID: 'PAT12345',
          patientName: 'Doe, John',
          studyDate: '2024-01-15',
          modality: 'CT',
          specialty: 'radiology' as const,
          seriesCount: 3,
          instanceCount: 150
        };

        const result = DICOMValidator.validateDICOMStudy(study);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      test('should reject study with missing required fields', () => {
        const study = {
          patientName: 'Doe, John',
          studyDate: '2024-01-15'
        };

        const result = DICOMValidator.validateDICOMStudy(study);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    describe('validateSearchParameters', () => {
      test('should validate and sanitize search parameters', () => {
        const params = {
          patientID: 'PAT12345',
          patientName: '  Doe, John  ',
          modality: ['CT', 'MR'],
          limit: '50',
          offset: '0'
        };

        const result = DICOMValidator.validateSearchParameters(params);
        expect(result.valid).toBe(true);
        expect(result.sanitized.patientName).toBe('Doe, John'); // trimmed
        expect(result.sanitized.limit).toBe(50); // converted to number
      });

      test('should reject invalid search parameters', () => {
        const params = {
          patientID: 'INVALID@ID',
          limit: '5000', // too high
          offset: '-1' // negative
        };

        const result = DICOMValidator.validateSearchParameters(params);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('SpecialtyWorkflows', () => {
    test('should return all specialty workflows', () => {
      const workflows = SpecialtyWorkflows.getAllWorkflows();
      expect(workflows).toHaveLength(10); // All 10 specialties
      expect(workflows.map(w => w.specialty)).toContain('radiology');
      expect(workflows.map(w => w.specialty)).toContain('cardiology');
      expect(workflows.map(w => w.specialty)).toContain('orthopedics');
    });

    test('should get workflow by specialty', () => {
      const radiologyWorkflow = SpecialtyWorkflows.getWorkflowBySpecialty('radiology');
      expect(radiologyWorkflow).toBeDefined();
      expect(radiologyWorkflow?.specialty).toBe('radiology');
      expect(radiologyWorkflow?.defaultModalitities).toContain('CT');
      expect(radiologyWorkflow?.defaultModalitities).toContain('MR');
    });

    test('should return null for invalid specialty', () => {
      const workflow = SpecialtyWorkflows.getWorkflowBySpecialty('invalid' as any);
      expect(workflow).toBeNull();
    });

    test('radiology workflow should have correct configuration', () => {
      const workflow = SpecialtyWorkflows.getRadiologyWorkflow();
      expect(workflow.specialty).toBe('radiology');
      expect(workflow.defaultModalitities).toContain('CT');
      expect(workflow.defaultModalitities).toContain('MR');
      expect(workflow.viewerSettings.defaultWindowing.length).toBeGreaterThan(0);
      expect(workflow.viewerSettings.enabledTools).toContain('WindowLevel');
      expect(workflow.viewerSettings.enabledTools).toContain('Zoom');
    });

    test('cardiology workflow should have heart-specific tools', () => {
      const workflow = SpecialtyWorkflows.getCardiologyWorkflow();
      expect(workflow.specialty).toBe('cardiology');
      expect(workflow.defaultModalitities).toContain('XA');
      expect(workflow.defaultModalitities).toContain('ES');
      expect(workflow.viewerSettings.enabledTools).toContain('HeartRate');
      expect(workflow.viewerSettings.enabledTools).toContain('EjectionFraction');
      expect(workflow.requiredFields).toContain('heartRate');
    });

    test('orthopedics workflow should have bone-specific configuration', () => {
      const workflow = SpecialtyWorkflows.getOrthopedicsWorkflow();
      expect(workflow.specialty).toBe('orthopedics');
      expect(workflow.viewerSettings.enabledTools).toContain('CobbAngle');
      expect(workflow.viewerSettings.defaultWindowing.some(w => w.name === 'Bone')).toBe(true);
    });
  });

  describe('PACS Configuration', () => {
    test('should have valid default configuration', () => {
      const result = validatePACSConfiguration(defaultPACSConfiguration);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate required configuration fields', () => {
      const invalidConfig = {
        orthancConfig: {
          baseUrl: '' // Empty URL should be invalid
        },
        ohifConfig: {
          baseUrl: '',
          wadoRsRoot: '',
          qidoRsRoot: ''
        }
      };

      const result = validatePACSConfiguration(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate PostDICOM configuration when cloud storage is enabled', () => {
      const configWithCloudStorage = {
        ...defaultPACSConfiguration,
        postdicomConfig: {
          ...defaultPACSConfiguration.postdicomConfig,
          enableCloudStorage: true,
          apiKey: '', // Missing API key
          organizationId: '' // Missing org ID
        }
      };

      const result = validatePACSConfiguration(configWithCloudStorage);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('API key'))).toBe(true);
      expect(result.errors.some(e => e.includes('organization ID'))).toBe(true);
    });
  });

  describe('PACSServiceError', () => {
    test('should create error with code and message', () => {
      const error = new PACSServiceError('TEST_ERROR', 'Test error message', { detail: 'test' });
      
      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test error message');
      expect(error.details).toEqual({ detail: 'test' });
      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.name).toBe('PACSServiceError');
    });

    test('should be instance of Error', () => {
      const error = new PACSServiceError('TEST_ERROR', 'Test error message');
      expect(error).toBeInstanceOf(Error);
    });
  });
});

describe('PACS API Integration', () => {
  // Mock fetch for API tests
  const mockFetch = jest.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    mockFetch.mockClear();
  });

  test('should search studies with correct parameters', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          studies: [
            {
              studyInstanceUID: '1.2.3.4.5.6.7.8.9.0.1.2.3.4.5.6',
              patientID: 'PAT12345',
              patientName: 'Doe, John',
              studyDate: '2024-01-15',
              modality: 'CT',
              specialty: 'radiology'
            }
          ],
          totalCount: 1,
          searchTime: 125
        }
      })
    });

    // Simulate API call
    const searchParams = new URLSearchParams({
      patientID: 'PAT12345',
      modality: 'CT'
    });

    const response = await fetch(`/api/pacs/studies?${searchParams.toString()}`);
    const result = await response.json();

    expect(mockFetch).toHaveBeenCalledWith(`/api/pacs/studies?patientID=PAT12345&modality=CT`);
    expect(result.success).toBe(true);
    expect(result.data.studies).toHaveLength(1);
    expect(result.data.studies[0].patientID).toBe('PAT12345');
  });

  test('should handle API errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({
        success: false,
        message: 'PACS service unavailable'
      })
    });

    const response = await fetch('/api/pacs/studies');
    expect(response.ok).toBe(false);
    expect(response.status).toBe(500);
  });

  test('should validate file upload parameters', async () => {
    const formData = new FormData();
    formData.append('patientID', 'PAT12345');
    formData.append('specialty', 'radiology');
    formData.append('files', new File(['mock dicom data'], 'test.dcm'));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          studyInstanceUID: '1.2.3.4.5.6.7.8.9.0.1.2.3.4.5.7',
          uploadedCount: 1,
          failedCount: 0
        }
      })
    });

    const response = await fetch('/api/pacs/studies', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.data.uploadedCount).toBe(1);
  });
});