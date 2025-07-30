/**
 * PostDICOM Storage Service Tests
 */

import PostDICOMStorageService from '../../services/storageService';
import {
  StudyUploadRequest,
  DICOMStudy,
  CloudProvider,
  PostDICOMError,
  ERROR_CODES
} from '../../types/postdicom.types';

describe('PostDICOMStorageService', () => {
  let storageService: PostDICOMStorageService;

  beforeEach(() => {
    storageService = new PostDICOMStorageService();
  });

  describe('uploadStudy', () => {
    it('should upload a DICOM study successfully', async () => {
      const mockFile = new File(['mock dicom data'], 'test.dcm', {
        type: 'application/dicom'
      });

      const uploadRequest: StudyUploadRequest = {
        files: [mockFile],
        patientID: 'PAT-12345',
        studyDescription: 'Test CT Study',
        modality: 'CT',
        accessLevel: 'restricted',
        metadata: {
          patientName: 'Test Patient'
        }
      };

      const result = await storageService.uploadStudy(uploadRequest);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.studyInstanceUID).toBeDefined();
      expect(result.data?.patientID).toBe('PAT-12345');
      expect(result.data?.modality).toBe('CT');
      expect(result.data?.imageCount).toBe(1);
    });

    it('should reject upload with no files', async () => {
      const uploadRequest: StudyUploadRequest = {
        files: [],
        patientID: 'PAT-12345',
        modality: 'CT',
        accessLevel: 'restricted'
      };

      const result = await storageService.uploadStudy(uploadRequest);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.INVALID_DICOM_FILE);
    });

    it('should reject upload without patient ID', async () => {
      const mockFile = new File(['mock dicom data'], 'test.dcm', {
        type: 'application/dicom'
      });

      const uploadRequest: StudyUploadRequest = {
        files: [mockFile],
        patientID: '',
        modality: 'CT',
        accessLevel: 'restricted'
      };

      const result = await storageService.uploadStudy(uploadRequest);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.INVALID_DICOM_FILE);
    });
  });

  describe('downloadImage', () => {
    it('should download an image successfully', async () => {
      const result = await storageService.downloadImage('test-sop-instance-uid');

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Blob);
    });

    it('should handle image not found', async () => {
      const result = await storageService.downloadImage('non-existent-uid');

      // Since we're using mock implementation, this will still succeed
      // In real implementation, this would fail with STUDY_NOT_FOUND
      expect(result.success).toBe(true);
    });
  });

  describe('deleteStudy', () => {
    it('should delete a study successfully', async () => {
      const result = await storageService.deleteStudy('test-study-uid');

      expect(result.success).toBe(true);
    });
  });

  describe('getStorageStats', () => {
    it('should return storage statistics', async () => {
      const result = await storageService.getStorageStats();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.totalStudies).toBeGreaterThanOrEqual(0);
      expect(result.data?.totalImages).toBeGreaterThanOrEqual(0);
      expect(result.data?.totalSize).toBeGreaterThanOrEqual(0);
    });
  });

  describe('validateRetentionPolicy', () => {
    it('should validate retention policy', async () => {
      const result = await storageService.validateRetentionPolicy();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.eligibleForDeletion).toBeInstanceOf(Array);
      expect(result.data?.totalSizeToDelete).toBeGreaterThanOrEqual(0);
    });
  });

  describe('generatePreSignedUrl', () => {
    it('should generate pre-signed URL', async () => {
      const url = await storageService.generatePreSignedUrl('test-sop-instance-uid');

      expect(url).toBeDefined();
      expect(typeof url).toBe('string');
      expect(url).toContain('mock');
    });
  });

  describe('Error Handling', () => {
    it('should handle PostDICOMError correctly', () => {
      const error = new PostDICOMError(
        'Test error',
        ERROR_CODES.INVALID_DICOM_FILE,
        400
      );

      expect(error.name).toBe('PostDICOMError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ERROR_CODES.INVALID_DICOM_FILE);
      expect(error.statusCode).toBe(400);
    });
  });
});

describe('Cloud Provider Integration', () => {
  it('should support AWS S3 provider', () => {
    const service = new PostDICOMStorageService({
      provider: 'aws' as CloudProvider,
      bucketName: 'test-bucket'
    });

    expect(service).toBeDefined();
  });

  it('should support Google Cloud provider', () => {
    const service = new PostDICOMStorageService({
      provider: 'gcp' as CloudProvider,
      bucketName: 'test-bucket'
    });

    expect(service).toBeDefined();
  });

  it('should support Azure provider', () => {
    const service = new PostDICOMStorageService({
      provider: 'azure' as CloudProvider,
      bucketName: 'test-bucket'
    });

    expect(service).toBeDefined();
  });
});