/**
 * PostDICOM Cache Service Tests
 */

import PostDICOMCacheService from '../../services/cacheService';
import {
  DICOMStudy,
  PreFetchRule,
  CacheConfig
} from '../../types/postdicom.types';

describe('PostDICOMCacheService', () => {
  let cacheService: PostDICOMCacheService;

  beforeEach(() => {
    cacheService = new PostDICOMCacheService();
  });

  afterEach(async () => {
    await cacheService.clear();
  });

  describe('Basic Cache Operations', () => {
    it('should set and get values from cache', async () => {
      const testData = { test: 'value' };
      
      await cacheService.set('test-key', testData);
      const result = await cacheService.get('test-key');

      expect(result).toEqual(testData);
    });

    it('should return null for non-existent keys', async () => {
      const result = await cacheService.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('should delete values from cache', async () => {
      await cacheService.set('test-key', 'test-value');
      await cacheService.delete('test-key');
      
      const result = await cacheService.get('test-key');
      expect(result).toBeNull();
    });

    it('should clear entire cache', async () => {
      await cacheService.set('key1', 'value1');
      await cacheService.set('key2', 'value2');
      
      await cacheService.clear();
      
      const result1 = await cacheService.get('key1');
      const result2 = await cacheService.get('key2');
      
      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });
  });

  describe('DICOM-specific Caching', () => {
    it('should cache study metadata', async () => {
      const mockStudy: DICOMStudy = {
        studyInstanceUID: 'test-study-uid',
        patientID: 'PAT-123',
        patientName: 'Test Patient',
        studyDate: '2024-01-15',
        modality: 'CT',
        seriesCount: 1,
        imageCount: 10,
        studySize: 1024000,
        accessLevel: 'restricted',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await cacheService.cacheStudyMetadata(mockStudy);
      const cachedStudy = await cacheService.getCachedStudyMetadata('test-study-uid');

      expect(cachedStudy).toEqual(mockStudy);
    });

    it('should cache image data', async () => {
      const imageData = Buffer.from('mock image data');
      const sopInstanceUID = 'test-sop-uid';

      await cacheService.cacheImageData(sopInstanceUID, imageData);
      const cachedData = await cacheService.getCachedImageData(sopInstanceUID);

      expect(cachedData).toEqual(imageData);
    });

    it('should cache search results', async () => {
      const searchResults = [
        { studyInstanceUID: 'study1', patientID: 'PAT-1' },
        { studyInstanceUID: 'study2', patientID: 'PAT-2' }
      ];
      const searchKey = 'modality:CT';

      await cacheService.cacheSearchResults(searchKey, searchResults);
      const cachedResults = await cacheService.getCachedSearchResults(searchKey);

      expect(cachedResults).toEqual(searchResults);
    });

    it('should invalidate study cache', async () => {
      const studyUID = 'test-study-uid';
      const mockStudy: DICOMStudy = {
        studyInstanceUID: studyUID,
        patientID: 'PAT-123',
        patientName: 'Test Patient',
        studyDate: '2024-01-15',
        modality: 'CT',
        seriesCount: 1,
        imageCount: 10,
        studySize: 1024000,
        accessLevel: 'restricted',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await cacheService.cacheStudyMetadata(mockStudy);
      await cacheService.invalidateStudy(studyUID);
      
      const cachedStudy = await cacheService.getCachedStudyMetadata(studyUID);
      expect(cachedStudy).toBeNull();
    });
  });

  describe('Pre-fetching', () => {
    it('should execute pre-fetch rules', async () => {
      const rules: PreFetchRule[] = [
        {
          name: 'test-rule',
          condition: 'modality === "CT"',
          priority: 1,
          maxImages: 10,
          enabled: true
        }
      ];

      // This should not throw an error
      await expect(cacheService.preFetch(rules)).resolves.not.toThrow();
    });

    it('should warm up cache with studies', async () => {
      const studyUIDs = ['study1', 'study2', 'study3'];

      // This should not throw an error
      await expect(cacheService.warmUpCache(studyUIDs)).resolves.not.toThrow();
    });
  });

  describe('Cache Statistics', () => {
    it('should return cache statistics', async () => {
      await cacheService.set('test1', 'value1');
      await cacheService.set('test2', 'value2');
      
      // Trigger some cache hits
      await cacheService.get('test1');
      await cacheService.get('test2');
      await cacheService.get('non-existent'); // miss

      const stats = await cacheService.getStats();

      expect(stats).toBeDefined();
      expect(stats.totalRequests).toBeGreaterThan(0);
      expect(stats.hitRate).toBeGreaterThanOrEqual(0);
      expect(stats.missRate).toBeGreaterThanOrEqual(0);
      expect(stats.itemCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cache Provider Configuration', () => {
    it('should support memory cache provider', () => {
      const config: Partial<CacheConfig> = {
        cacheProvider: 'memory',
        maxCacheSize: '1GB'
      };

      const service = new PostDICOMCacheService(config);
      expect(service).toBeDefined();
    });

    it('should support redis cache provider', () => {
      const config: Partial<CacheConfig> = {
        cacheProvider: 'redis',
        maxCacheSize: '2GB'
      };

      const service = new PostDICOMCacheService(config);
      expect(service).toBeDefined();
    });

    it('should support filesystem cache provider', () => {
      const config: Partial<CacheConfig> = {
        cacheProvider: 'filesystem',
        maxCacheSize: '5GB'
      };

      const service = new PostDICOMCacheService(config);
      expect(service).toBeDefined();
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should respect TTL for cached items', async () => {
      const shortTTL = 1; // 1 second
      
      await cacheService.set('ttl-test', 'value', shortTTL);
      
      // Should exist immediately
      let result = await cacheService.get('ttl-test');
      expect(result).toBe('value');

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should be null after TTL expiry
      result = await cacheService.get('ttl-test');
      expect(result).toBeNull();
    });
  });
});