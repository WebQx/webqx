/**
 * @fileoverview OHIF Imaging Cache Service Tests
 * 
 * Comprehensive tests for the imaging cache service with performance
 * optimization and prefetching capabilities.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { ImagingCacheService, CacheConfig } from '../../services/imagingCache';
import { ImagingStudy } from '../../components/imaging/SecureImagingViewer';

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('ImagingCacheService', () => {
  let cacheService: ImagingCacheService;
  const mockStudy: ImagingStudy = {
    id: 'study-123',
    patientId: 'patient-456',
    studyDate: '2024-01-15',
    modality: 'CT',
    description: 'Chest CT',
    seriesCount: 3,
    instanceCount: 150,
    status: 'available',
    sensitivity: 'normal',
    viewerUrl: '/ohif/viewer',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue('mock-auth-token');
    
    const cacheConfig: Partial<CacheConfig> = {
      maxCacheSize: 100, // 100MB for testing
      maxStudyAge: 30, // 30 minutes
      prefetchEnabled: true,
      prefetchLimit: 3,
      compressionEnabled: true,
    };
    
    cacheService = new ImagingCacheService(cacheConfig);
  });

  afterEach(() => {
    cacheService.clearCache();
  });

  describe('Cache Management', () => {
    it('should cache study successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStudy,
      } as Response);

      const result = await cacheService.getStudy('study-123', 'patient-456');

      expect(result).toEqual(mockStudy);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/imaging/studies/study-123',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-auth-token',
          }),
        })
      );

      const metrics = cacheService.getMetrics();
      expect(metrics.totalCachedStudies).toBe(1);
      expect(metrics.cacheHitRate).toBe(0); // First request is a miss
    });

    it('should return cached study on subsequent requests', async () => {
      // First request - cache miss
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStudy,
      } as Response);

      await cacheService.getStudy('study-123', 'patient-456');

      // Second request - should be cache hit
      const result = await cacheService.getStudy('study-123', 'patient-456');

      expect(result).toEqual(mockStudy);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Should not fetch again

      const metrics = cacheService.getMetrics();
      expect(metrics.cacheHitRate).toBe(0.5); // 1 hit out of 2 requests
    });

    it('should handle cache size limits', async () => {
      // Create a service with very small cache size
      const smallCacheService = new ImagingCacheService({
        maxCacheSize: 0.001, // 1KB
        maxStudyAge: 30,
        prefetchEnabled: false,
        prefetchLimit: 0,
        compressionEnabled: false,
      });

      // Mock large study
      const largeStudy = { ...mockStudy, id: 'large-study' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => largeStudy,
      } as Response);

      // Add first study
      await smallCacheService.getStudy('study-1', 'patient-456');
      expect(smallCacheService.getMetrics().totalCachedStudies).toBe(1);

      // Add second study (should evict first due to size limit)
      await smallCacheService.getStudy('study-2', 'patient-456');
      expect(smallCacheService.getMetrics().totalCachedStudies).toBe(1);
    });

    it('should clear cache', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockStudy,
      } as Response);

      await cacheService.getStudy('study-123', 'patient-456');
      expect(cacheService.getMetrics().totalCachedStudies).toBe(1);

      cacheService.clearCache();
      expect(cacheService.getMetrics().totalCachedStudies).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      } as Response);

      await expect(cacheService.getStudy('study-123', 'patient-456'))
        .rejects.toThrow('API request failed: Not Found');
    });

    it('should retry failed requests', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStudy,
        } as Response);

      const result = await cacheService.getStudy('study-123', 'patient-456');
      
      expect(result).toEqual(mockStudy);
      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('Performance Metrics', () => {
    it('should track cache hit rate', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockStudy,
      } as Response);

      // Make several requests
      await cacheService.getStudy('study-123', 'patient-456'); // miss
      await cacheService.getStudy('study-123', 'patient-456'); // hit
      await cacheService.getStudy('study-123', 'patient-456'); // hit

      const metrics = cacheService.getMetrics();
      expect(metrics.cacheHitRate).toBeCloseTo(0.67, 2); // 2 hits out of 3 requests
    });

    it('should use default configuration', () => {
      const defaultService = new ImagingCacheService();
      const config = defaultService.getConfig();
      
      expect(config.maxCacheSize).toBe(500); // Default 500MB
      expect(config.maxStudyAge).toBe(60); // Default 1 hour
      expect(config.prefetchEnabled).toBe(true);
      expect(config.compressionEnabled).toBe(true);
    });
  });
});