/**
 * PACS Service Tests
 */

import { PACSService, PACSConfig } from '../pacsService';
import { AuditLogger } from '../../ehr-integrations/services/auditLogger';

// Mock fetch globally
global.fetch = jest.fn();

describe('PACSService', () => {
  let pacsService: PACSService;
  let mockConfig: PACSConfig;

  beforeEach(() => {
    mockConfig = {
      orthancUrl: 'http://localhost:8042',
      ohifViewerUrl: 'http://localhost:3000',
      username: 'test',
      password: 'test',
      enableDICOMWeb: true,
      maxConcurrentDownloads: 3,
      cacheEnabled: true,
      auditLogging: true
    };

    pacsService = new PACSService(mockConfig);
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    pacsService.clearCache();
  });

  describe('Initialization', () => {
    test('should initialize with correct config', () => {
      expect(pacsService).toBeInstanceOf(PACSService);
      expect(pacsService.getCacheStats().size).toBe(0);
    });

    test('should set default config values', () => {
      const minimalConfig = {
        orthancUrl: 'http://localhost:8042',
        ohifViewerUrl: 'http://localhost:3000'
      };
      
      const service = new PACSService(minimalConfig as PACSConfig);
      expect(service).toBeInstanceOf(PACSService);
    });
  });

  describe('Study Management', () => {
    test('should get studies for patient', async () => {
      const mockStudyIds = ['study-123', 'study-456'];
      const mockStudyData = {
        MainDicomTags: {
          StudyInstanceUID: 'study-123',
          StudyDate: '20240115',
          StudyDescription: 'Chest X-Ray',
          Modality: 'CR'
        },
        PatientMainDicomTags: {
          PatientID: 'patient-123',
          PatientName: 'John Doe'
        },
        Series: ['series-123']
      };

      const mockSeriesData = {
        MainDicomTags: {
          SeriesInstanceUID: 'series-123',
          SeriesNumber: '1',
          SeriesDescription: 'PA View',
          Modality: 'CR'
        },
        Instances: ['instance-123']
      };

      const mockInstanceData = {
        MainDicomTags: {
          StudyInstanceUID: 'study-123',
          SeriesInstanceUID: 'series-123',
          SOPInstanceUID: 'instance-123',
          StudyDate: '20240115',
          Modality: 'CR',
          BodyPartExamined: 'CHEST'
        },
        PatientMainDicomTags: {
          PatientID: 'patient-123'
        }
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStudyIds
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStudyData
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSeriesData
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockInstanceData
        });

      const studies = await pacsService.getStudies('patient-123');

      expect(studies).toHaveLength(1);
      expect(studies[0].patientId).toBe('patient-123');
      expect(studies[0].studyInstanceUID).toBe('study-123');
      expect(studies[0].numberOfSeries).toBe(1);
      expect(studies[0].series[0].numberOfImages).toBe(1);
    });

    test('should handle study retrieval errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(pacsService.getStudies('patient-123'))
        .rejects.toThrow('Failed to retrieve studies for patient patient-123');
    });

    test('should cache study results when enabled', async () => {
      const mockStudyIds = ['study-123'];
      const mockStudyData = {
        MainDicomTags: {
          StudyInstanceUID: 'study-123',
          StudyDate: '20240115',
          StudyDescription: 'Chest X-Ray',
          Modality: 'CR'
        },
        PatientMainDicomTags: {
          PatientID: 'patient-123',
          PatientName: 'John Doe'
        },
        Series: ['series-123']
      };

      const mockSeriesData = {
        MainDicomTags: {
          SeriesInstanceUID: 'series-123',
          SeriesNumber: '1',
          SeriesDescription: 'PA View',
          Modality: 'CR'
        },
        Instances: ['instance-123']
      };

      const mockInstanceData = {
        MainDicomTags: {
          StudyInstanceUID: 'study-123',
          SeriesInstanceUID: 'series-123',
          SOPInstanceUID: 'instance-123',
          StudyDate: '20240115',
          Modality: 'CR',
          BodyPartExamined: 'CHEST'
        },
        PatientMainDicomTags: {
          PatientID: 'patient-123'
        }
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStudyIds
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStudyData
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSeriesData
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockInstanceData
        });

      await pacsService.getStudies('patient-123');
      
      // Second call should use cache
      const cachedStudies = await pacsService.getStudies('patient-123');
      
      expect(pacsService.getCacheStats().size).toBe(1);
      expect(cachedStudies).toHaveLength(1);
    });
  });

  describe('Study Details', () => {
    test('should get detailed study information', async () => {
      const mockStudyData = {
        MainDicomTags: {
          StudyInstanceUID: 'study-123',
          StudyDate: '20240115',
          StudyDescription: 'Chest X-Ray',
          Modality: 'CR'
        },
        PatientMainDicomTags: {
          PatientID: 'patient-123',
          PatientName: 'John Doe'
        },
        Series: ['series-123']
      };

      const mockSeriesData = {
        MainDicomTags: {
          SeriesInstanceUID: 'series-123',
          SeriesNumber: '1',
          SeriesDescription: 'PA View',
          Modality: 'CR'
        },
        Instances: ['instance-123']
      };

      const mockInstanceData = {
        MainDicomTags: {
          StudyInstanceUID: 'study-123',
          SeriesInstanceUID: 'series-123',
          SOPInstanceUID: 'instance-123',
          StudyDate: '20240115',
          Modality: 'CR',
          BodyPartExamined: 'CHEST'
        },
        PatientMainDicomTags: {
          PatientID: 'patient-123'
        }
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStudyData
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSeriesData
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockInstanceData
        });

      const study = await pacsService.getStudyDetails('study-123');

      expect(study.studyInstanceUID).toBe('study-123');
      expect(study.patientId).toBe('patient-123');
      expect(study.numberOfSeries).toBe(1);
      expect(study.series[0].numberOfImages).toBe(1);
    });
  });

  describe('OHIF Viewer Integration', () => {
    test('should generate correct viewer URL', () => {
      const studyUID = 'study-123';
      const viewerUrl = pacsService.getViewerUrl(studyUID);
      
      expect(viewerUrl).toContain(mockConfig.ohifViewerUrl);
      expect(viewerUrl).toContain(studyUID);
      expect(viewerUrl).toContain(encodeURIComponent(mockConfig.orthancUrl));
    });
  });

  describe('Search Functionality', () => {
    test('should search studies by criteria', async () => {
      const mockSearchResults = ['study-123'];
      const mockStudyData = {
        MainDicomTags: {
          StudyInstanceUID: 'study-123',
          StudyDate: '20240115',
          StudyDescription: 'Chest X-Ray',
          Modality: 'CR'
        },
        PatientMainDicomTags: {
          PatientID: 'patient-123',
          PatientName: 'John Doe'
        },
        Series: ['series-123']
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSearchResults
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStudyData
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            MainDicomTags: {
              SeriesInstanceUID: 'series-123',
              SeriesNumber: '1',
              SeriesDescription: 'PA View',
              Modality: 'CR'
            },
            Instances: ['instance-123']
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            MainDicomTags: {
              StudyInstanceUID: 'study-123',
              SeriesInstanceUID: 'series-123',
              SOPInstanceUID: 'instance-123',
              StudyDate: '20240115',
              Modality: 'CR',
              BodyPartExamined: 'CHEST'
            },
            PatientMainDicomTags: {
              PatientID: 'patient-123'
            }
          })
        });

      const studies = await pacsService.searchStudies({
        patientId: 'patient-123',
        modality: 'CR'
      });

      expect(studies).toHaveLength(1);
      expect(studies[0].modality).toBe('CR');
    });
  });

  describe('DICOM Upload', () => {
    test('should upload DICOM file successfully', async () => {
      const mockFile = Buffer.from('mock dicom data');
      const mockResponse = { ID: 'instance-new-123' };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await pacsService.uploadDICOM(mockFile, 'test.dcm');

      expect(result.success).toBe(true);
      expect(result.instanceId).toBe('instance-new-123');
    });

    test('should handle upload errors', async () => {
      const mockFile = Buffer.from('mock dicom data');

      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Upload failed'));

      const result = await pacsService.uploadDICOM(mockFile, 'test.dcm');

      expect(result.success).toBe(false);
      expect(result.instanceId).toBeUndefined();
    });
  });

  describe('Connectivity', () => {
    test('should check PACS connectivity successfully', async () => {
      const mockSystemInfo = { Version: '1.9.0' };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSystemInfo
      });

      const connectivity = await pacsService.checkConnectivity();

      expect(connectivity.connected).toBe(true);
      expect(connectivity.version).toBe('1.9.0');
    });

    test('should handle connectivity errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Connection failed'));

      const connectivity = await pacsService.checkConnectivity();

      expect(connectivity.connected).toBe(false);
      expect(connectivity.error).toBe('Connection failed');
    });
  });

  describe('Authentication', () => {
    test('should include basic auth headers when credentials provided', async () => {
      const mockStudyIds = ['study-123'];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStudyIds
      });

      await pacsService.getStudies('patient-123');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/patients/patient-123/studies'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringContaining('Basic')
          })
        })
      );
    });
  });

  describe('Cache Management', () => {
    test('should clear cache', () => {
      pacsService.clearCache();
      expect(pacsService.getCacheStats().size).toBe(0);
    });

    test('should provide cache statistics', () => {
      const stats = pacsService.getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('keys');
      expect(Array.isArray(stats.keys)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle HTTP errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(pacsService.getStudies('patient-123'))
        .rejects.toThrow('Failed to retrieve studies for patient patient-123');
    });

    test('should handle malformed JSON responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); }
      });

      await expect(pacsService.getStudies('patient-123'))
        .rejects.toThrow('Failed to retrieve studies for patient patient-123');
    });
  });

  describe('Events', () => {
    test('should emit events for studies retrieval', (done) => {
      pacsService.on('studiesRetrieved', (data) => {
        expect(data.patientId).toBe('patient-123');
        expect(data.count).toBe(1);
        done();
      });

      const mockStudyIds = ['study-123'];
      const mockStudyData = {
        MainDicomTags: {
          StudyInstanceUID: 'study-123',
          StudyDate: '20240115',
          StudyDescription: 'Chest X-Ray',
          Modality: 'CR'
        },
        PatientMainDicomTags: {
          PatientID: 'patient-123',
          PatientName: 'John Doe'
        },
        Series: []
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStudyIds
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStudyData
        });

      pacsService.getStudies('patient-123');
    });

    test('should emit events for DICOM upload', (done) => {
      pacsService.on('dicomUploaded', (data) => {
        expect(data.filename).toBe('test.dcm');
        expect(data.instanceId).toBe('instance-new-123');
        done();
      });

      const mockFile = Buffer.from('mock dicom data');
      const mockResponse = { ID: 'instance-new-123' };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      pacsService.uploadDICOM(mockFile, 'test.dcm');
    });
  });
});