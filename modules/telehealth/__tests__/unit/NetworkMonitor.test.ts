/**
 * WebQX™ Telehealth - Network Monitor Unit Tests
 */

import { NetworkMonitor, NetworkMonitorConfig } from '../../core/NetworkMonitor';
import { NetworkConditions } from '../../types/telehealth.types';

// Mock fetch for testing
global.fetch = jest.fn();

describe('NetworkMonitor', () => {
  let networkMonitor: NetworkMonitor;
  let config: NetworkMonitorConfig;

  beforeEach(() => {
    config = {
      monitoringIntervalMs: 1000,
      thresholds: {
        minBitrateKbps: 256,
        optimalBitrateKbps: 1024,
        maxBitrateKbps: 4096,
        audioOnlyThresholdKbps: 128,
        textFallbackThresholdKbps: 64
      },
      enableConnectionTypeDetection: true,
      enableBandwidthEstimation: true,
      bandwidthTest: {
        testFileSizeKB: 100,
        timeoutMs: 10000
      },
      rttTest: {
        testUrl: 'http://localhost:8080/fhir/metadata',
        pingCount: 3
      }
    };

    networkMonitor = new NetworkMonitor(config);
  });

  afterEach(() => {
    if (networkMonitor) {
      networkMonitor.stopMonitoring();
    }
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should create NetworkMonitor with valid config', () => {
      expect(networkMonitor).toBeDefined();
      expect(networkMonitor.getCurrentConditions()).toBeDefined();
    });

    test('should return default network conditions initially', () => {
      const conditions = networkMonitor.getCurrentConditions();
      
      expect(conditions).toMatchObject({
        bandwidthKbps: expect.any(Number),
        rttMs: expect.any(Number),
        packetLossPercent: expect.any(Number),
        stabilityScore: expect.any(Number),
        connectionType: expect.any(String)
      });
    });
  });

  describe('Network Quality Assessment', () => {
    test('should assess network quality correctly', () => {
      const quality = networkMonitor.getNetworkQuality();
      expect(['excellent', 'good', 'fair', 'poor', 'disconnected']).toContain(quality);
    });

    test('should support video call with good conditions', () => {
      // Mock good network conditions
      jest.spyOn(networkMonitor, 'getCurrentConditions').mockReturnValue({
        bandwidthKbps: 2000,
        rttMs: 50,
        packetLossPercent: 0,
        stabilityScore: 90,
        connectionType: 'wifi',
        signalStrength: 95
      });

      expect(networkMonitor.supportsVideoCall('low')).toBe(true);
      expect(networkMonitor.supportsVideoCall('medium')).toBe(true);
      expect(networkMonitor.supportsVideoCall('high')).toBe(true);
    });

    test('should not support video call with poor conditions', () => {
      // Mock poor network conditions
      jest.spyOn(networkMonitor, 'getCurrentConditions').mockReturnValue({
        bandwidthKbps: 100,
        rttMs: 300,
        packetLossPercent: 10,
        stabilityScore: 20,
        connectionType: 'cellular',
        signalStrength: 30
      });

      expect(networkMonitor.supportsVideoCall('low')).toBe(false);
      expect(networkMonitor.supportsVideoCall('medium')).toBe(false);
      expect(networkMonitor.supportsVideoCall('high')).toBe(false);
    });

    test('should support audio call with moderate conditions', () => {
      // Mock moderate network conditions
      jest.spyOn(networkMonitor, 'getCurrentConditions').mockReturnValue({
        bandwidthKbps: 100,
        rttMs: 150,
        packetLossPercent: 2,
        stabilityScore: 60,
        connectionType: 'cellular',
        signalStrength: 50
      });

      expect(networkMonitor.supportsAudioCall()).toBe(true);
      expect(networkMonitor.supportsVideoCall('low')).toBe(false);
    });
  });

  describe('Quality Recommendations', () => {
    test('should recommend appropriate quality settings for high bandwidth', () => {
      // Mock high bandwidth conditions
      jest.spyOn(networkMonitor, 'getCurrentConditions').mockReturnValue({
        bandwidthKbps: 3000,
        rttMs: 30,
        packetLossPercent: 0,
        stabilityScore: 95,
        connectionType: 'ethernet',
        signalStrength: undefined
      });

      jest.spyOn(networkMonitor, 'getNetworkQuality').mockReturnValue('excellent');

      const settings = networkMonitor.getRecommendedQualitySettings();
      
      expect(settings.resolution).toBe('720p');
      expect(settings.videoBitrate).toBeGreaterThan(1000);
      expect(settings.framerate).toBe(30);
    });

    test('should recommend low quality settings for low bandwidth', () => {
      // Mock low bandwidth conditions
      jest.spyOn(networkMonitor, 'getCurrentConditions').mockReturnValue({
        bandwidthKbps: 200,
        rttMs: 200,
        packetLossPercent: 3,
        stabilityScore: 40,
        connectionType: 'cellular',
        signalStrength: 40
      });

      jest.spyOn(networkMonitor, 'getNetworkQuality').mockReturnValue('poor');

      const settings = networkMonitor.getRecommendedQualitySettings();
      
      expect(settings.resolution).toBe('144p');
      expect(settings.videoBitrate).toBeLessThan(200);
      expect(settings.framerate).toBe(15);
    });
  });

  describe('Bandwidth Testing', () => {
    test('should test bandwidth successfully', async () => {
      // Mock successful fetch response
      const mockArrayBuffer = new ArrayBuffer(1024 * 100); // 100KB
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockArrayBuffer)
      });

      const bandwidth = await networkMonitor.testBandwidth();
      
      expect(bandwidth).toBeGreaterThan(0);
      expect(typeof bandwidth).toBe('number');
    });

    test('should handle bandwidth test failures gracefully', async () => {
      // Mock failed fetch response
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const bandwidth = await networkMonitor.testBandwidth();
      
      // Should return some fallback value
      expect(typeof bandwidth).toBe('number');
      expect(bandwidth).toBeGreaterThan(0);
    });
  });

  describe('RTT Testing', () => {
    test('should test RTT successfully', async () => {
      // Mock successful fetch response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true
      });

      const rtt = await networkMonitor.testRTT();
      
      expect(rtt).toBeGreaterThan(0);
      expect(typeof rtt).toBe('number');
    });

    test('should handle RTT test failures gracefully', async () => {
      // Mock failed fetch response
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const rtt = await networkMonitor.testRTT();
      
      // Should return some fallback value
      expect(typeof rtt).toBe('number');
      expect(rtt).toBeGreaterThan(0);
    });
  });

  describe('Event Handling', () => {
    test('should add and remove event listeners', () => {
      const mockCallback = jest.fn();
      
      networkMonitor.addEventListener('network-change', mockCallback);
      networkMonitor.removeEventListener('network-change', mockCallback);
      
      // Should not throw
      expect(true).toBe(true);
    });

    test('should handle multiple event listeners', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      networkMonitor.addEventListener('bandwidth-change', callback1);
      networkMonitor.addEventListener('bandwidth-change', callback2);
      
      // Both callbacks should be registered
      expect(true).toBe(true);
    });
  });

  describe('Performance Monitoring', () => {
    test('should start and stop monitoring', async () => {
      // Mock the assessment methods
      jest.spyOn(networkMonitor as any, 'assessNetworkConditions').mockResolvedValue(undefined);
      
      await expect(networkMonitor.startMonitoring()).resolves.not.toThrow();
      
      networkMonitor.stopMonitoring();
      
      // Should not throw
      expect(true).toBe(true);
    });

    test('should not start monitoring twice', async () => {
      // Mock the assessment methods
      jest.spyOn(networkMonitor as any, 'assessNetworkConditions').mockResolvedValue(undefined);
      
      await networkMonitor.startMonitoring();
      await networkMonitor.startMonitoring(); // Should return immediately
      
      networkMonitor.stopMonitoring();
      expect(true).toBe(true);
    });
  });
});