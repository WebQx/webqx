/**
 * @fileoverview Unit tests for Adaptive Timeout Manager
 * 
 * Tests the adaptive timeout functionality including response time tracking,
 * timeout calculation, error handling, and fallback mechanisms.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { AdaptiveTimeoutManager, calculateAdaptiveTimeout } from '../utils/adaptive-timeout';

describe('AdaptiveTimeoutManager', () => {
  let manager: AdaptiveTimeoutManager;

  beforeEach(() => {
    manager = new AdaptiveTimeoutManager({
      minTimeoutMs: 30000,
      maxTimeoutMs: 120000,
      timeoutMultiplier: 2,
      maxSamples: 20,
      fallbackTimeoutMs: 30000,
      enableLogging: false // Disable logging for tests
    });
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultManager = new AdaptiveTimeoutManager();
      const config = defaultManager.getConfig();
      
      expect(config.minTimeoutMs).toBe(30000);
      expect(config.maxTimeoutMs).toBe(120000);
      expect(config.timeoutMultiplier).toBe(2);
      expect(config.maxSamples).toBe(20);
      expect(config.fallbackTimeoutMs).toBe(30000);
    });

    it('should allow custom configuration', () => {
      const customManager = new AdaptiveTimeoutManager({
        minTimeoutMs: 10000,
        maxTimeoutMs: 60000,
        timeoutMultiplier: 3,
        fallbackTimeoutMs: 20000
      });
      
      const config = customManager.getConfig();
      expect(config.minTimeoutMs).toBe(10000);
      expect(config.maxTimeoutMs).toBe(60000);
      expect(config.timeoutMultiplier).toBe(3);
      expect(config.fallbackTimeoutMs).toBe(20000);
    });
  });

  describe('getAdaptiveTimeout', () => {
    it('should return fallback timeout when no data exists', () => {
      const timeout = manager.getAdaptiveTimeout('test-endpoint');
      expect(timeout).toBe(30000);
    });

    it('should return fallback timeout with override', () => {
      const timeout = manager.getAdaptiveTimeout('test-endpoint', 45000);
      expect(timeout).toBe(45000);
    });

    it('should calculate adaptive timeout based on response times', () => {
      const endpoint = 'test-endpoint';
      
      // Record some response times
      manager.recordResponseTime(endpoint, 5000, true);
      manager.recordResponseTime(endpoint, 7000, true);
      manager.recordResponseTime(endpoint, 6000, true);
      
      const timeout = manager.getAdaptiveTimeout(endpoint);
      // Average = 6000ms, timeout = 6000 * 2 = 12000ms
      // But should be clamped to minTimeoutMs (30000)
      expect(timeout).toBe(30000);
    });

    it('should respect minimum timeout bounds', () => {
      const endpoint = 'fast-endpoint';
      
      // Record very fast response times
      manager.recordResponseTime(endpoint, 100, true);
      manager.recordResponseTime(endpoint, 200, true);
      manager.recordResponseTime(endpoint, 150, true);
      
      const timeout = manager.getAdaptiveTimeout(endpoint);
      // Average = 150ms, timeout = 150 * 2 = 300ms
      // Should be clamped to minTimeoutMs (30000)
      expect(timeout).toBe(30000);
    });

    it('should respect maximum timeout bounds', () => {
      const endpoint = 'slow-endpoint';
      
      // Record very slow response times
      manager.recordResponseTime(endpoint, 80000, true);
      manager.recordResponseTime(endpoint, 90000, true);
      manager.recordResponseTime(endpoint, 85000, true);
      
      const timeout = manager.getAdaptiveTimeout(endpoint);
      // Average = 85000ms, timeout = 85000 * 2 = 170000ms
      // Should be clamped to maxTimeoutMs (120000)
      expect(timeout).toBe(120000);
    });

    it('should handle mixed success/failure responses', () => {
      const endpoint = 'mixed-endpoint';
      
      // Record mixed response times
      manager.recordResponseTime(endpoint, 5000, true);
      manager.recordResponseTime(endpoint, 30000, false); // Failed request
      manager.recordResponseTime(endpoint, 7000, true);
      manager.recordResponseTime(endpoint, 25000, false); // Failed request
      manager.recordResponseTime(endpoint, 6000, true);
      
      const timeout = manager.getAdaptiveTimeout(endpoint);
      // Should only consider successful times: (5000 + 7000 + 6000) / 3 = 6000
      // timeout = 6000 * 2 = 12000, clamped to 30000
      expect(timeout).toBe(30000);
    });

    it('should handle all failed responses', () => {
      const endpoint = 'failing-endpoint';
      
      // Record only failed responses
      manager.recordResponseTime(endpoint, 30000, false);
      manager.recordResponseTime(endpoint, 45000, false);
      manager.recordResponseTime(endpoint, 35000, false);
      
      const timeout = manager.getAdaptiveTimeout(endpoint);
      // Should return fallback * 1.5 but clamped to maxTimeout
      expect(timeout).toBe(45000); // 30000 * 1.5 = 45000
    });
  });

  describe('recordResponseTime', () => {
    it('should record response times correctly', () => {
      const endpoint = 'test-endpoint';
      manager.recordResponseTime(endpoint, 5000, true);
      
      const stats = manager.getEndpointStats(endpoint);
      expect(stats).not.toBeNull();
      expect(stats!.responseTimes).toHaveLength(1);
      expect(stats!.responseTimes[0].duration).toBe(5000);
      expect(stats!.responseTimes[0].success).toBe(true);
    });

    it('should limit the number of samples', () => {
      const endpoint = 'test-endpoint';
      
      // Record more than maxSamples (20)
      for (let i = 0; i < 25; i++) {
        manager.recordResponseTime(endpoint, 1000 + i, true);
      }
      
      const stats = manager.getEndpointStats(endpoint);
      expect(stats!.responseTimes).toHaveLength(20);
      // Should keep the most recent 20 samples
      expect(stats!.responseTimes[0].duration).toBe(1005); // 1000 + 5 (first kept sample)
      expect(stats!.responseTimes[19].duration).toBe(1024); // 1000 + 24 (last sample)
    });

    it('should increment adjustment count', () => {
      const endpoint = 'test-endpoint';
      manager.recordResponseTime(endpoint, 5000, true);
      manager.recordResponseTime(endpoint, 6000, true);
      
      const stats = manager.getEndpointStats(endpoint);
      expect(stats!.adjustmentCount).toBe(2);
    });
  });

  describe('hasSufficientData', () => {
    it('should return false when no data exists', () => {
      expect(manager.hasSufficientData('non-existent')).toBe(false);
    });

    it('should return false when insufficient data', () => {
      const endpoint = 'test-endpoint';
      manager.recordResponseTime(endpoint, 5000, true);
      manager.recordResponseTime(endpoint, 6000, true);
      
      expect(manager.hasSufficientData(endpoint, 3)).toBe(false);
    });

    it('should return true when sufficient data', () => {
      const endpoint = 'test-endpoint';
      manager.recordResponseTime(endpoint, 5000, true);
      manager.recordResponseTime(endpoint, 6000, true);
      manager.recordResponseTime(endpoint, 7000, true);
      
      expect(manager.hasSufficientData(endpoint, 3)).toBe(true);
    });
  });

  describe('statistics and management', () => {
    it('should provide endpoint statistics', () => {
      const endpoint = 'test-endpoint';
      manager.recordResponseTime(endpoint, 5000, true);
      
      const stats = manager.getEndpointStats(endpoint);
      expect(stats).toMatchObject({
        responseTimes: expect.any(Array),
        currentTimeout: expect.any(Number),
        adjustmentCount: expect.any(Number),
        lastAdjusted: expect.any(Number)
      });
    });

    it('should provide all statistics', () => {
      manager.recordResponseTime('endpoint1', 5000, true);
      manager.recordResponseTime('endpoint2', 6000, true);
      
      const allStats = manager.getAllStats();
      expect(allStats.size).toBe(2);
      expect(allStats.has('endpoint1')).toBe(true);
      expect(allStats.has('endpoint2')).toBe(true);
    });

    it('should clear endpoint statistics', () => {
      const endpoint = 'test-endpoint';
      manager.recordResponseTime(endpoint, 5000, true);
      
      expect(manager.getEndpointStats(endpoint)).not.toBeNull();
      
      manager.clearEndpointStats(endpoint);
      expect(manager.getEndpointStats(endpoint)).toBeNull();
    });

    it('should clear all statistics', () => {
      manager.recordResponseTime('endpoint1', 5000, true);
      manager.recordResponseTime('endpoint2', 6000, true);
      
      expect(manager.getAllStats().size).toBe(2);
      
      manager.clearAllStats();
      expect(manager.getAllStats().size).toBe(0);
    });
  });

  describe('configuration updates', () => {
    it('should update configuration', () => {
      manager.updateConfig({
        minTimeoutMs: 15000,
        maxTimeoutMs: 90000
      });
      
      const config = manager.getConfig();
      expect(config.minTimeoutMs).toBe(15000);
      expect(config.maxTimeoutMs).toBe(90000);
      // Other values should remain unchanged
      expect(config.timeoutMultiplier).toBe(2);
    });
  });

  describe('getCurrentTimeout', () => {
    it('should return fallback when no data', () => {
      const timeout = manager.getCurrentTimeout('non-existent');
      expect(timeout).toBe(30000);
    });

    it('should return current timeout when data exists', () => {
      const endpoint = 'test-endpoint';
      manager.recordResponseTime(endpoint, 25000, true);
      manager.getAdaptiveTimeout(endpoint); // This calculates and sets current timeout
      
      const currentTimeout = manager.getCurrentTimeout(endpoint);
      expect(currentTimeout).toBeGreaterThan(0);
    });
  });
});

describe('calculateAdaptiveTimeout helper function', () => {
  it('should return default timeout for empty array', async () => {
    const timeout = await calculateAdaptiveTimeout([]);
    expect(timeout).toBe(30000);
  });

  it('should calculate timeout correctly', async () => {
    const responseTimes = [5000, 7000, 6000];
    const timeout = await calculateAdaptiveTimeout(responseTimes);
    
    // Average = 6000ms, timeout = 6000 * 2 = 12000ms
    // Clamped to minimum 30000ms
    expect(timeout).toBe(30000);
  });

  it('should respect maximum timeout', async () => {
    const responseTimes = [80000, 90000, 85000];
    const timeout = await calculateAdaptiveTimeout(responseTimes);
    
    // Average = 85000ms, timeout = 85000 * 2 = 170000ms
    // Clamped to maximum 120000ms
    expect(timeout).toBe(120000);
  });

  it('should calculate realistic adaptive timeout', async () => {
    const responseTimes = [20000, 25000, 22000, 18000, 24000];
    const timeout = await calculateAdaptiveTimeout(responseTimes);
    
    // Average = 21800ms, timeout = 21800 * 2 = 43600ms
    expect(timeout).toBe(43600);
  });
});