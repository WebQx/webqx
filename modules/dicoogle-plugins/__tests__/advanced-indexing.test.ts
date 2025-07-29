/**
 * Tests for Dicoogle Advanced Indexing Plugin
 */

import { advancedIndexingService } from '../src/plugins/advanced-indexing';
import { IndexingFieldConfig, PreprocessingConfig } from '../src/plugins/advanced-indexing';

describe('Advanced Indexing Plugin', () => {
  describe('Field Configuration Management', () => {
    test('should return default indexing fields', () => {
      const fields = advancedIndexingService.getIndexingFields();
      
      expect(fields).toBeDefined();
      expect(Array.isArray(fields)).toBe(true);
      expect(fields.length).toBeGreaterThan(0);
      
      // Check for standard DICOM tags
      const patientIdField = fields.find(f => f.tag === '00100020');
      expect(patientIdField).toBeDefined();
      expect(patientIdField?.name).toContain('PATIENT ID');
    });

    test('should return fields for specific specialty', () => {
      const radiologyFields = advancedIndexingService.getFieldsForSpecialty('radiology');
      
      expect(radiologyFields).toBeDefined();
      expect(Array.isArray(radiologyFields)).toBe(true);
      
      // Should include general fields and radiology-specific fields
      const hasGeneralFields = radiologyFields.some(f => !f.specialty);
      const hasRadiologyFields = radiologyFields.some(f => f.specialty?.includes('radiology'));
      
      expect(hasGeneralFields || hasRadiologyFields).toBe(true);
    });

    test('should update field configuration', async () => {
      const newFieldConfig: IndexingFieldConfig = {
        tag: '00181030', // Protocol Name
        name: 'Protocol Name',
        dataType: 'LO',
        indexed: true,
        searchable: true,
        faceted: true,
        weight: 0.9,
        specialty: ['radiology'],
      };

      await expect(
        advancedIndexingService.updateFieldConfig(newFieldConfig)
      ).resolves.not.toThrow();

      // Verify the field was added
      const fields = advancedIndexingService.getIndexingFields();
      const updatedField = fields.find(f => f.tag === '00181030');
      expect(updatedField).toBeDefined();
      expect(updatedField?.name).toBe('Protocol Name');
    });

    test('should reject invalid field configuration', async () => {
      const invalidFieldConfig = {
        tag: 'invalid-tag', // Invalid DICOM tag format
        name: '',
        dataType: 'INVALID_TYPE',
        indexed: true,
        searchable: true,
        faceted: false,
      } as IndexingFieldConfig;

      await expect(
        advancedIndexingService.updateFieldConfig(invalidFieldConfig)
      ).rejects.toThrow();
    });

    test('should remove field configuration', async () => {
      // First add a field
      const testFieldConfig: IndexingFieldConfig = {
        tag: '00181088', // Heart Rate
        name: 'Heart Rate',
        dataType: 'IS',
        indexed: true,
        searchable: false,
        faceted: false,
      };

      await advancedIndexingService.updateFieldConfig(testFieldConfig);

      // Then remove it
      await expect(
        advancedIndexingService.removeFieldConfig('00181088')
      ).resolves.not.toThrow();

      // Verify it was removed
      const fields = advancedIndexingService.getIndexingFields();
      const removedField = fields.find(f => f.tag === '00181088');
      expect(removedField).toBeUndefined();
    });
  });

  describe('Indexing Jobs', () => {
    test('should start full indexing job', async () => {
      const jobId = await advancedIndexingService.startFullIndexing({
        batchSize: 50,
        maxConcurrency: 2,
        enablePreprocessing: true,
        forceReindex: false,
      });

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');

      // Check job status
      const job = advancedIndexingService.getJobStatus(jobId);
      expect(job).toBeDefined();
      expect(job?.type).toBe('full');
      expect(['pending', 'running']).toContain(job?.status);
    });

    test('should start incremental indexing job', async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      
      const jobId = await advancedIndexingService.startIncrementalIndexing(since, {
        batchSize: 25,
        maxConcurrency: 1,
        enablePreprocessing: false,
      });

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');

      // Check job status
      const job = advancedIndexingService.getJobStatus(jobId);
      expect(job).toBeDefined();
      expect(job?.type).toBe('incremental');
      expect(['pending', 'running']).toContain(job?.status);
    });

    test('should cancel running job', async () => {
      const jobId = await advancedIndexingService.startFullIndexing();
      
      // Wait a bit for job to start
      await new Promise(resolve => setTimeout(resolve, 100));

      await expect(
        advancedIndexingService.cancelJob(jobId)
      ).resolves.not.toThrow();

      // Check job was cancelled
      const job = advancedIndexingService.getJobStatus(jobId);
      expect(job?.status).toBe('cancelled');
    });

    test('should handle non-existent job', async () => {
      await expect(
        advancedIndexingService.cancelJob('non-existent-job')
      ).rejects.toThrow();

      const job = advancedIndexingService.getJobStatus('non-existent-job');
      expect(job).toBeNull();
    });
  });

  describe('Index Statistics', () => {
    test('should return index statistics', async () => {
      const stats = await advancedIndexingService.getIndexStatistics();
      
      expect(stats).toBeDefined();
      expect(stats.totalDocuments).toBeGreaterThanOrEqual(0);
      expect(stats.totalFields).toBeGreaterThanOrEqual(0);
      expect(stats.indexSize).toBeDefined();
      expect(stats.lastUpdated).toBeInstanceOf(Date);
      expect(stats.indexingRate).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(stats.fieldStatistics)).toBe(true);
    });

    test('should return field statistics', async () => {
      const stats = await advancedIndexingService.getFieldStatistics('00100020');
      
      if (stats) {
        expect(stats.field).toBe('00100020');
        expect(stats.uniqueValues).toBeGreaterThanOrEqual(0);
        expect(stats.nullValues).toBeGreaterThanOrEqual(0);
        expect(stats.avgLength).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(stats.mostCommonValues)).toBe(true);
      }
    });
  });

  describe('Index Management', () => {
    test('should optimize index', async () => {
      await expect(
        advancedIndexingService.optimizeIndex()
      ).resolves.not.toThrow();
    });

    test('should backup index', async () => {
      const destination = '/tmp/test-backup';
      
      await expect(
        advancedIndexingService.backupIndex(destination)
      ).resolves.not.toThrow();
    });

    test('should restore index', async () => {
      const source = '/tmp/test-backup';
      
      await expect(
        advancedIndexingService.restoreIndex(source)
      ).resolves.not.toThrow();
    });
  });

  describe('Preprocessing', () => {
    test('should preprocess metadata without preprocessing config', async () => {
      const metadata = {
        '00100020': 'PAT123',
        '00100010': 'Doe^John',
      };

      const fieldConfig: IndexingFieldConfig = {
        tag: '00100020',
        name: 'Patient ID',
        dataType: 'LO',
        indexed: true,
        searchable: true,
        faceted: false,
      };

      const result = await advancedIndexingService.preprocessMetadata(metadata, fieldConfig);
      expect(result).toBe('PAT123');
    });

    test('should preprocess metadata with normalization', async () => {
      const metadata = {
        '00100020': '  pat123  ',
      };

      const fieldConfig: IndexingFieldConfig = {
        tag: '00100020',
        name: 'Patient ID',
        dataType: 'LO',
        indexed: true,
        searchable: true,
        faceted: false,
        preprocessing: [{
          type: 'normalize',
          enabled: true,
          order: 1,
        }],
      };

      const result = await advancedIndexingService.preprocessMetadata(metadata, fieldConfig);
      expect(result).toBe('PAT123');
    });

    test('should preprocess metadata with extraction', async () => {
      const metadata = {
        '00100020': 'PATIENT_ID_PAT123_SUFFIX',
      };

      const fieldConfig: IndexingFieldConfig = {
        tag: '00100020',
        name: 'Patient ID',
        dataType: 'LO',
        indexed: true,
        searchable: true,
        faceted: false,
        preprocessing: [{
          type: 'extract',
          enabled: true,
          order: 1,
          params: {
            pattern: 'PATIENT_ID_(.+)_SUFFIX',
            flags: 'i',
          },
        }],
      };

      const result = await advancedIndexingService.preprocessMetadata(metadata, fieldConfig);
      expect(result).toBe('PAT123');
    });

    test('should preprocess metadata with value transformation', async () => {
      const metadata = {
        '00080060': 'COMPUTED_TOMOGRAPHY',
      };

      const fieldConfig: IndexingFieldConfig = {
        tag: '00080060',
        name: 'Modality',
        dataType: 'CS',
        indexed: true,
        searchable: true,
        faceted: true,
        preprocessing: [{
          type: 'transform',
          enabled: true,
          order: 1,
          params: {
            mapping: {
              'COMPUTED_TOMOGRAPHY': 'CT',
              'MAGNETIC_RESONANCE': 'MR',
            },
          },
        }],
      };

      const result = await advancedIndexingService.preprocessMetadata(metadata, fieldConfig);
      expect(result).toBe('CT');
    });

    test('should handle multiple preprocessing steps', async () => {
      const metadata = {
        '00100020': '  computed_tomography  ',
      };

      const fieldConfig: IndexingFieldConfig = {
        tag: '00100020',
        name: 'Test Field',
        dataType: 'LO',
        indexed: true,
        searchable: true,
        faceted: false,
        preprocessing: [
          {
            type: 'normalize',
            enabled: true,
            order: 1,
          },
          {
            type: 'transform',
            enabled: true,
            order: 2,
            params: {
              mapping: {
                'COMPUTED_TOMOGRAPHY': 'CT',
              },
            },
          },
        ],
      };

      const result = await advancedIndexingService.preprocessMetadata(metadata, fieldConfig);
      expect(result).toBe('CT');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid preprocessing configuration', async () => {
      const metadata = {
        '00100020': 'PAT123',
      };

      const fieldConfig: IndexingFieldConfig = {
        tag: '00100020',
        name: 'Patient ID',
        dataType: 'LO',
        indexed: true,
        searchable: true,
        faceted: false,
        preprocessing: [{
          type: 'invalid_type' as any,
          enabled: true,
          order: 1,
        }],
      };

      const result = await advancedIndexingService.preprocessMetadata(metadata, fieldConfig);
      // Should return original value when preprocessing fails
      expect(result).toBe('PAT123');
    });

    test('should validate field configuration with invalid preprocessing', async () => {
      const invalidFieldConfig: IndexingFieldConfig = {
        tag: '00100020',
        name: 'Patient ID',
        dataType: 'LO',
        indexed: true,
        searchable: true,
        faceted: false,
        preprocessing: [{
          type: 'invalid_type' as any,
          enabled: true,
          order: -1, // Invalid order
        }],
      };

      await expect(
        advancedIndexingService.updateFieldConfig(invalidFieldConfig)
      ).rejects.toThrow();
    });
  });
});