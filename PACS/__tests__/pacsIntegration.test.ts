/**
 * PACS Integration Tests
 * 
 * Basic tests to validate PACS module functionality and integration.
 */

import { PACSService } from '../services/pacsService';
import { DICOMService } from '../services/dicomService';
import { ImagingWorkflowService } from '../services/imagingWorkflowService';
import { DICOMValidation } from '../utils/dicomValidation';
import { ImagingUtils } from '../utils/imagingUtils';

describe('PACS Integration', () => {
  let pacsService: PACSService;
  let dicomService: DICOMService;
  let workflowService: ImagingWorkflowService;

  beforeEach(() => {
    pacsService = new PACSService();
    dicomService = new DICOMService();
    workflowService = new ImagingWorkflowService(pacsService);
  });

  describe('PACSService', () => {
    test('should initialize with default servers', () => {
      const servers = pacsService.getAvailableServers();
      expect(servers).toBeDefined();
      expect(Array.isArray(servers)).toBe(true);
    });

    test('should search for studies', async () => {
      const result = await pacsService.searchStudies({
        patientID: 'TEST001'
      });
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.studies).toBeDefined();
      expect(Array.isArray(result.data?.studies)).toBe(true);
    });

    test('should get study details', async () => {
      const studyUID = '1.2.840.113619.2.5.1762583153.215519.978957063.78';
      const result = await pacsService.getStudyDetails(studyUID);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.studyInstanceUID).toBe(studyUID);
    });

    test('should create patient session', async () => {
      const result = await pacsService.createPatientSession(
        'PAT001',
        '1.2.840.113619.2.5.1762583153.215519.978957063.78'
      );
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.sessionID).toBeDefined();
      expect(result.data?.patientID).toBe('PAT001');
    });

    test('should generate viewer URL', () => {
      const studyUID = '1.2.840.113619.2.5.1762583153.215519.978957063.78';
      
      // In test environment, OHIF server is not configured, so this should throw
      try {
        const url = pacsService.getViewerURL(studyUID);
        // If it doesn't throw, check that URL is valid
        expect(typeof url).toBe('string');
        expect(url).toContain(studyUID);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('No OHIF viewer server available');
      }
    });

    test('should test server connection', async () => {
      const servers = pacsService.getAvailableServers();
      if (servers.length > 0) {
        const result = await pacsService.testConnection(servers[0].id);
        expect(result.success).toBe(true);
        expect(result.data).toBe(true);
      }
    });
  });

  describe('DICOMService', () => {
    test('should validate DICOM file format', async () => {
      // Create a mock DICOM file buffer
      const mockDICOMData = new ArrayBuffer(132);
      const view = new Uint8Array(mockDICOMData);
      
      // Add DICOM magic bytes at offset 128
      view[128] = 0x44; // 'D'
      view[129] = 0x49; // 'I'
      view[130] = 0x43; // 'C'
      view[131] = 0x4D; // 'M'
      
      const result = await dicomService.validateDICOMFile(mockDICOMData);
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    test('should parse DICOM metadata', async () => {
      const mockDICOMData = new ArrayBuffer(1024);
      const result = await dicomService.parseDICOMMetadata(mockDICOMData);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.studyInstanceUID).toBeDefined();
      expect(result.data?.patientID).toBeDefined();
    });

    test('should generate thumbnail', async () => {
      const mockDICOMData = new ArrayBuffer(1024);
      const result = await dicomService.generateThumbnail(mockDICOMData);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(typeof result.data).toBe('string');
      expect(result.data).toMatch(/^data:image\//);
    });

    test('should convert to web format', async () => {
      const mockDICOMData = new ArrayBuffer(1024);
      const result = await dicomService.convertToWebFormat(mockDICOMData, 'jpeg');
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(typeof result.data).toBe('string');
      expect(result.data).toMatch(/^data:image\/jpeg/);
    });

    test('should extract DICOM tags', () => {
      const mockDICOMData = new ArrayBuffer(1024);
      
      const patientName = dicomService.extractTag(mockDICOMData, '0010,0010');
      expect(patientName).toBe('Test^Patient');
      
      const patientID = dicomService.extractTag(mockDICOMData, '0010,0020');
      expect(patientID).toBe('PAT001');
      
      const modality = dicomService.extractTag(mockDICOMData, '0008,0060');
      expect(modality).toBe('CT');
    });

    test('should support transfer syntaxes', () => {
      const syntaxes = dicomService.getSupportedTransferSyntaxes();
      expect(Array.isArray(syntaxes)).toBe(true);
      expect(syntaxes.length).toBeGreaterThan(0);
      expect(syntaxes).toContain('1.2.840.10008.1.2'); // Implicit VR Little Endian
    });
  });

  describe('ImagingWorkflowService', () => {
    test('should create imaging order', async () => {
      const orderData = {
        patientID: 'PAT001',
        providerID: 'PROV001',
        orderDate: '2024-01-15',
        modality: 'CT',
        bodyPart: 'Chest',
        clinicalIndication: 'Shortness of breath',
        urgency: 'routine' as const
      };
      
      const result = await workflowService.createImagingOrder(orderData);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.orderID).toBeDefined();
      expect(result.data?.status).toBe('ordered');
    });

    test('should update order status', async () => {
      const result = await workflowService.updateOrderStatus('ORD001', 'completed');
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.status).toBe('completed');
    });

    test('should create imaging report', async () => {
      const reportData = {
        studyInstanceUID: '1.2.840.113619.2.5.1762583153.215519.978957063.78',
        patientID: 'PAT001',
        radiologistID: 'RAD001',
        reportDate: '2024-01-15',
        findings: 'No acute findings',
        impression: 'Normal chest CT',
        status: 'final' as const,
        isAbnormal: false
      };
      
      const result = await workflowService.createImagingReport(reportData);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.reportID).toBeDefined();
    });

    test('should grant patient access', async () => {
      const result = await workflowService.grantPatientAccess(
        'PAT001',
        '1.2.840.113619.2.5.1762583153.215519.978957063.78',
        'view',
        'PROV001'
      );
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.consentGiven).toBe(true);
    });

    test('should get patient accessible studies', async () => {
      const result = await workflowService.getPatientAccessibleStudies('PAT001');
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe('DICOMValidation', () => {
    test('should validate Study Instance UID', () => {
      const validUID = '1.2.840.113619.2.5.1762583153.215519.978957063.78';
      const invalidUID = 'invalid..uid';
      
      expect(DICOMValidation.validateStudyInstanceUID(validUID)).toBe(true);
      expect(DICOMValidation.validateStudyInstanceUID(invalidUID)).toBe(false);
      expect(DICOMValidation.validateStudyInstanceUID('')).toBe(false);
    });

    test('should validate Patient ID', () => {
      expect(DICOMValidation.validatePatientID('PAT001')).toBe(true);
      expect(DICOMValidation.validatePatientID('PAT-001')).toBe(true);
      expect(DICOMValidation.validatePatientID('PAT_001')).toBe(true);
      expect(DICOMValidation.validatePatientID('')).toBe(false);
      expect(DICOMValidation.validatePatientID('PAT@001')).toBe(false);
    });

    test('should validate DICOM date', () => {
      expect(DICOMValidation.validateDICOMDate('20240115')).toBe(true);
      expect(DICOMValidation.validateDICOMDate('20240230')).toBe(false); // Invalid date
      expect(DICOMValidation.validateDICOMDate('2024-01-15')).toBe(false); // Wrong format
      expect(DICOMValidation.validateDICOMDate('240115')).toBe(false); // Too short
    });

    test('should validate DICOM time', () => {
      expect(DICOMValidation.validateDICOMTime('143000')).toBe(true);
      expect(DICOMValidation.validateDICOMTime('143000.123456')).toBe(true);
      expect(DICOMValidation.validateDICOMTime('250000')).toBe(false); // Invalid hour
      expect(DICOMValidation.validateDICOMTime('146000')).toBe(false); // Invalid minute
    });

    test('should validate modality', () => {
      expect(DICOMValidation.validateModality('CT')).toBe(true);
      expect(DICOMValidation.validateModality('MR')).toBe(true);
      expect(DICOMValidation.validateModality('INVALID')).toBe(false);
    });

    test('should validate complete DICOM metadata', () => {
      const validMetadata = {
        studyInstanceUID: '1.2.840.113619.2.5.1762583153.215519.978957063.78',
        seriesInstanceUID: '1.2.840.113619.2.5.1762583153.215519.978957063.79',
        sopInstanceUID: '1.2.840.113619.2.5.1762583153.215519.978957063.80',
        patientID: 'PAT001',
        patientName: 'Test^Patient',
        studyDate: '20240115',
        studyTime: '143000',
        modality: 'CT',
        studyDescription: 'Chest CT',
        seriesDescription: 'Axial Chest',
        instanceNumber: 1,
        numberOfImages: 120
      };
      
      const validation = DICOMValidation.validateDICOMMetadata(validMetadata);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should generate test UIDs', () => {
      const uid = DICOMValidation.generateTestUID();
      expect(DICOMValidation.validateStudyInstanceUID(uid)).toBe(true);
      expect(DICOMValidation.isTestUID(uid)).toBe(true);
    });
  });

  describe('ImagingUtils', () => {
    test('should format patient name', () => {
      expect(ImagingUtils.formatPatientName('Doe^John^M')).toBe('John M Doe');
      expect(ImagingUtils.formatPatientName('Doe^John')).toBe('John Doe');
      expect(ImagingUtils.formatPatientName('')).toBe('Unknown Patient');
    });

    test('should format DICOM date', () => {
      expect(ImagingUtils.formatDICOMDate('20240115')).toBe('January 15, 2024');
      expect(ImagingUtils.formatDICOMDate('invalid')).toBe('Unknown Date');
    });

    test('should format DICOM time', () => {
      expect(ImagingUtils.formatDICOMTime('143000')).toBe('02:30 PM');
      expect(ImagingUtils.formatDICOMTime('invalid')).toBe('Invalid Time');
    });

    test('should get modality names', () => {
      expect(ImagingUtils.getModalityName('CT')).toBe('CT Scan');
      expect(ImagingUtils.getModalityName('MR')).toBe('MRI');
      expect(ImagingUtils.getModalityName('XR')).toBe('X-Ray');
    });

    test('should get modality icons', () => {
      expect(ImagingUtils.getModalityIcon('CT')).toBe('🏥');
      expect(ImagingUtils.getModalityIcon('MR')).toBe('🧲');
      expect(ImagingUtils.getModalityIcon('XR')).toBe('🦴');
    });

    test('should calculate study size', () => {
      const study = {
        studyInstanceUID: '1.2.3.4',
        patientID: 'PAT001',
        patientName: 'Test^Patient',
        studyDate: '20240115',
        studyTime: '143000',
        studyDescription: 'Test Study',
        numberOfSeries: 1,
        numberOfImages: 100,
        modalities: ['CT'],
        series: []
      };
      
      const size = ImagingUtils.calculateStudySize(study);
      expect(size).toBeGreaterThan(0);
      expect(typeof size).toBe('number');
    });

    test('should format file size', () => {
      expect(ImagingUtils.formatFileSize(0.5)).toBe('512 KB');
      expect(ImagingUtils.formatFileSize(1.5)).toBe('1.5 MB');
      expect(ImagingUtils.formatFileSize(1500)).toBe('1.46 GB');
    });

    test('should calculate age', () => {
      const age = ImagingUtils.calculateAge('19900115', '20240115');
      expect(age).toBe(34);
      
      const invalidAge = ImagingUtils.calculateAge('invalid', '20240115');
      expect(invalidAge).toBeNull();
    });

    test('should convert dates', () => {
      const dicomDate = ImagingUtils.isoToDICOMDate('2024-01-15T14:30:00Z');
      expect(dicomDate).toBe('20240115');
      
      const dicomTime = ImagingUtils.isoToDICOMTime('2024-01-15T14:30:00Z');
      expect(dicomTime).toBe('143000');
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete workflow', async () => {
      // 1. Create an order
      const orderResult = await workflowService.createImagingOrder({
        patientID: 'PAT001',
        providerID: 'PROV001',
        orderDate: '2024-01-15',
        modality: 'CT',
        bodyPart: 'Chest',
        clinicalIndication: 'Shortness of breath',
        urgency: 'routine'
      });
      
      expect(orderResult.success).toBe(true);
      
      // 2. Search for studies
      const searchResult = await pacsService.searchStudies({
        patientID: 'PAT001'
      });
      
      expect(searchResult.success).toBe(true);
      
      // 3. Create patient session
      if (searchResult.data?.studies && searchResult.data.studies.length > 0) {
        const study = searchResult.data.studies[0];
        const sessionResult = await pacsService.createPatientSession(
          'PAT001',
          study.studyInstanceUID
        );
        
        expect(sessionResult.success).toBe(true);
      }
      
      // 4. Grant patient access
      const accessResult = await workflowService.grantPatientAccess(
        'PAT001',
        '1.2.840.113619.2.5.1762583153.215519.978957063.78',
        'view',
        'PROV001'
      );
      
      expect(accessResult.success).toBe(true);
    });
  });
});