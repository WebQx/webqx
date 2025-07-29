/**
 * WebQX™ Orthanc PACS Integration - Orthanc Client Tests
 */

import { OrthancClient } from '../utils/orthancClient';
import { OrthancConfig } from '../types';

// Mock fetch for testing
global.fetch = jest.fn();

describe('OrthancClient', () => {
  let orthancClient: OrthancClient;
  let mockConfig: OrthancConfig;

  beforeEach(() => {
    mockConfig = {
      baseUrl: 'http://localhost:8042',
      username: 'test',
      password: 'test',
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ssl: {
        enabled: false,
        verifySSL: true
      }
    };

    orthancClient = new OrthancClient(mockConfig);
    (fetch as jest.Mock).mockClear();
  });

  describe('constructor', () => {
    it('should create instance with valid config', () => {
      expect(orthancClient).toBeInstanceOf(OrthancClient);
    });

    it('should set up basic auth header when credentials provided', () => {
      const client = new OrthancClient(mockConfig);
      expect(client).toBeInstanceOf(OrthancClient);
    });

    it('should handle config without credentials', () => {
      const configWithoutAuth = { ...mockConfig };
      delete configWithoutAuth.username;
      delete configWithoutAuth.password;
      
      const client = new OrthancClient(configWithoutAuth);
      expect(client).toBeInstanceOf(OrthancClient);
    });
  });

  describe('getSystemInfo', () => {
    it('should successfully get system info', async () => {
      const mockResponse = {
        ApiVersion: '1.9.7',
        DatabaseVersion: 6,
        DicomAet: 'ORTHANC'
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
        headers: new Map([['content-type', 'application/json']])
      });

      const result = await orthancClient.getSystemInfo();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(result.statusCode).toBe(200);
    });

    it('should handle connection errors', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Connection refused'));

      const result = await orthancClient.getSystemInfo();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection refused');
      expect(result.statusCode).toBe(0);
    });

    it('should retry on failure', async () => {
      (fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          text: () => Promise.resolve('{}'),
          headers: new Map()
        });

      const result = await orthancClient.getSystemInfo();

      expect(result.success).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('healthCheck', () => {
    it('should return true when Orthanc is healthy', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve('{}'),
        headers: new Map()
      });

      const result = await orthancClient.healthCheck();
      expect(result).toBe(true);
    });

    it('should return false when Orthanc is not accessible', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Connection refused'));

      const result = await orthancClient.healthCheck();
      expect(result).toBe(false);
    });
  });

  describe('getAllStudies', () => {
    it('should get list of studies', async () => {
      const mockStudies = ['study1', 'study2', 'study3'];

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve(JSON.stringify(mockStudies)),
        headers: new Map()
      });

      const result = await orthancClient.getAllStudies();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockStudies);
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8042/studies',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('Basic')
          })
        })
      );
    });
  });

  describe('getStudyTags', () => {
    it('should get study DICOM tags', async () => {
      const mockTags = {
        PatientID: '12345',
        PatientName: 'Test Patient',
        StudyInstanceUID: '1.2.3.4.5',
        StudyDate: '20240115',
        Modality: 'CT'
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve(JSON.stringify(mockTags)),
        headers: new Map()
      });

      const result = await orthancClient.getStudyTags('study123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockTags);
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8042/studies/study123/tags?simplify',
        expect.any(Object)
      );
    });
  });

  describe('searchStudies', () => {
    it('should search for studies with query', async () => {
      const mockQuery = { PatientID: '12345' };
      const mockResults = ['study1', 'study2'];

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve(JSON.stringify(mockResults)),
        headers: new Map()
      });

      const result = await orthancClient.searchStudies(mockQuery);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResults);
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8042/tools/find',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            Level: 'Study',
            Query: mockQuery,
            Expand: false
          })
        })
      );
    });
  });

  describe('getInstancePreview', () => {
    it('should get instance preview image', async () => {
      const mockImageData = new ArrayBuffer(1024);

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: () => Promise.resolve(mockImageData),
        headers: new Map([['content-type', 'image/jpeg']])
      });

      const result = await orthancClient.getInstancePreview('instance123');

      expect(result.success).toBe(true);
      expect(result.data).toBe(mockImageData);
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8042/instances/instance123/preview',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('Basic')
          })
        })
      );
    });
  });

  describe('convertToStudy', () => {
    it('should convert Orthanc data to DicomStudy interface', async () => {
      const mockStudyResponse = { ID: 'study123' };
      const mockTagsResponse = {
        PatientID: '12345',
        PatientName: 'Test Patient',
        StudyInstanceUID: '1.2.3.4.5',
        StudyDate: '20240115',
        Modality: 'CT'
      };
      const mockSeriesResponse = ['series1', 'series2'];

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify(mockStudyResponse)),
          headers: new Map()
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify(mockTagsResponse)),
          headers: new Map()
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify(mockSeriesResponse)),
          headers: new Map()
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify({ Instances: ['inst1', 'inst2'] })),
          headers: new Map()
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify({ Instances: ['inst3'] })),
          headers: new Map()
        });

      const result = await orthancClient.convertToStudy('study123');

      expect(result).toBeTruthy();
      expect(result?.id).toBe('study123');
      expect(result?.patientId).toBe('12345');
      expect(result?.studyInstanceUID).toBe('1.2.3.4.5');
      expect(result?.numberOfSeries).toBe(2);
      expect(result?.numberOfInstances).toBe(3);
    });

    it('should return null on error', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await orthancClient.convertToStudy('study123');
      expect(result).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle HTTP errors', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('Not found'),
        headers: new Map()
      });

      const result = await orthancClient.getStudy('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTP 404');
      expect(result.statusCode).toBe(404);
    });

    it('should handle timeout', async () => {
      const slowConfig = { ...mockConfig, timeout: 100 };
      const slowClient = new OrthancClient(slowConfig);

      (fetch as jest.Mock).mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );

      const result = await slowClient.getSystemInfo();
      expect(result.success).toBe(false);
    });
  });
});