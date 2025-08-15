/**
 * Tests for Dynamic Batch Size Management
 */

import { ServerLoadMonitor, ServerLoadMetrics } from '../serverLoadMonitor';
import { DynamicBatchManager, BatchAdjustmentEvent } from '../dynamicBatchManager';

// Mock os module
jest.mock('os', () => ({
  totalmem: jest.fn(() => 8589934592), // 8GB
  freemem: jest.fn(() => 4294967296), // 4GB free
  loadavg: jest.fn(() => [1.5, 1.2, 1.0])
}));

// Mock process.cpuUsage and process.hrtime.bigint
const mockCpuUsage = jest.fn();
const mockHrtime = jest.fn();

Object.defineProperty(process, 'cpuUsage', {
  value: mockCpuUsage,
  writable: true
});

Object.defineProperty(process.hrtime, 'bigint', {
  value: mockHrtime,
  writable: true
});

describe('ServerLoadMonitor', () => {
  let monitor: ServerLoadMonitor;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup CPU usage mocks
    mockCpuUsage
      .mockReturnValueOnce({ user: 1000000, system: 500000 }) // Start usage
      .mockReturnValue({ user: 1500000, system: 750000 }); // End usage

    mockHrtime
      .mockReturnValueOnce(BigInt('1000000000')) // Start time (1 second in nanoseconds)
      .mockReturnValue(BigInt('2000000000')); // End time (2 seconds in nanoseconds)

    monitor = new ServerLoadMonitor({
      pollingInterval: 100,
      enableLogging: false,
      cpuSampleDuration: 50
    });
  });

  afterEach(() => {
    monitor.stop();
  });

  test('should start and stop monitoring', () => {
    expect(monitor.getCurrentMetrics()).toBeNull();
    
    monitor.start();
    expect(monitor['isRunning']).toBe(true);
    
    monitor.stop();
    expect(monitor['isRunning']).toBe(false);
  });

  test('should emit metrics events', (done) => {
    monitor.on('metrics', (metrics: ServerLoadMetrics) => {
      expect(metrics).toHaveProperty('cpuUsage');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('loadAverage');
      expect(metrics).toHaveProperty('timestamp');
      expect(metrics.memoryUsage).toBe(50); // 4GB used / 8GB total = 50%
      expect(metrics.loadAverage).toBe(1.5);
      done();
    });

    monitor.start();
  });

  test('should calculate server load correctly', () => {
    const metrics: ServerLoadMetrics = {
      cpuUsage: 60,
      memoryUsage: 40,
      loadAverage: 1.0,
      timestamp: new Date()
    };

    monitor['lastMetrics'] = metrics;
    
    // Weighted average: 60% CPU * 0.6 + 40% memory * 0.4 = 36 + 16 = 52
    expect(monitor.getServerLoad()).toBe(52);
  });

  test('should return default load when no metrics available', () => {
    expect(monitor.getServerLoad()).toBe(50);
  });
});

describe('DynamicBatchManager', () => {
  let monitor: ServerLoadMonitor;
  let batchManager: DynamicBatchManager;

  beforeEach(() => {
    // Setup CPU usage mocks for default behavior
    mockCpuUsage
      .mockReturnValueOnce({ user: 1000000, system: 500000 })
      .mockReturnValue({ user: 1500000, system: 750000 });

    mockHrtime
      .mockReturnValueOnce(BigInt('1000000000'))
      .mockReturnValue(BigInt('2000000000'));

    monitor = new ServerLoadMonitor({
      pollingInterval: 1000,
      enableLogging: false
    });

    batchManager = new DynamicBatchManager(monitor, {
      minBatchSize: 5,
      maxBatchSize: 100,
      defaultBatchSize: 25,
      lowLoadThreshold: 50,
      highLoadThreshold: 80
    }, false);
  });

  afterEach(() => {
    batchManager.stop();
    monitor.stop();
  });

  describe('calculateBatchSize', () => {
    test('should return max batch size for low load', () => {
      const batchSize = batchManager.calculateBatchSize(30);
      expect(batchSize).toBe(100);
    });

    test('should return min batch size for high load', () => {
      const batchSize = batchManager.calculateBatchSize(90);
      expect(batchSize).toBe(5);
    });

    test('should scale batch size for medium load', () => {
      // Load of 65% should be halfway between thresholds (50-80)
      const batchSize = batchManager.calculateBatchSize(65);
      // Should be halfway between max (100) and min (5) = ~52
      expect(batchSize).toBeGreaterThan(40);
      expect(batchSize).toBeLessThan(65);
    });

    test('should handle edge cases', () => {
      expect(batchManager.calculateBatchSize(50)).toBe(100); // Exactly at low threshold
      expect(batchManager.calculateBatchSize(80)).toBe(5);   // Exactly at high threshold
    });
  });

  describe('getBatchSize', () => {
    test('should return calculated batch size for new operation', () => {
      // Mock server load monitor to return specific load
      jest.spyOn(monitor, 'getServerLoad').mockReturnValue(40);
      
      const batchSize = batchManager.getBatchSize('test-operation');
      expect(batchSize).toBe(100); // Low load should return max batch size
    });

    test('should return cached batch size for existing operation', () => {
      batchManager['currentBatchSizes'].set('cached-operation', 42);
      
      const batchSize = batchManager.getBatchSize('cached-operation');
      expect(batchSize).toBe(42);
    });
  });

  test('should return fallback batch size', () => {
    const fallbackSize = batchManager.getFallbackBatchSize('test-operation');
    expect(fallbackSize).toBe(25); // Default batch size
  });

  test('should register operation with initial batch size', () => {
    batchManager.registerOperation('new-operation', 30);
    
    expect(batchManager.getBatchSize('new-operation')).toBe(30);
    
    const stats = batchManager.getStatistics();
    expect(stats.operations).toContain('new-operation');
    expect(stats.currentBatchSizes['new-operation']).toBe(30);
  });

  test('should emit batch size adjustment events', (done) => {
    // Setup initial batch size
    batchManager.registerOperation('test-operation', 50);
    
    // Mock server load change
    jest.spyOn(monitor, 'getServerLoad').mockReturnValue(85); // High load
    
    batchManager.on('batchSizeAdjusted', (event: BatchAdjustmentEvent) => {
      expect(event.operation).toBe('test-operation');
      expect(event.previousBatchSize).toBe(50);
      expect(event.newBatchSize).toBe(5); // Min batch size for high load
      expect(event.serverLoad).toBe(85);
      expect(event.reason).toContain('High server load');
      done();
    });

    // Trigger load change by emitting metrics
    const highLoadMetrics: ServerLoadMetrics = {
      cpuUsage: 90,
      memoryUsage: 80,
      loadAverage: 2.0,
      timestamp: new Date()
    };

    // Manually trigger the load change
    batchManager['handleLoadChange'](highLoadMetrics);
  });

  test('should respect cooldown period', () => {
    batchManager.registerOperation('cooldown-test', 50);
    
    // Set last adjustment to recent time
    batchManager['lastAdjustments'].set('cooldown-test', new Date());
    
    // Try to adjust - should be blocked by cooldown
    const shouldAdjust = batchManager['shouldAdjustBatchSize']('cooldown-test', 50, 10);
    expect(shouldAdjust).toBe(false);
  });

  test('should respect change threshold', () => {
    // Small change should not trigger adjustment
    const shouldAdjust = batchManager['shouldAdjustBatchSize']('test', 50, 51);
    expect(shouldAdjust).toBe(false);
    
    // Large change should trigger adjustment
    const shouldAdjustLarge = batchManager['shouldAdjustBatchSize']('test', 50, 30);
    expect(shouldAdjustLarge).toBe(true);
  });

  describe('integration with server load monitor', () => {
    test('should handle monitoring errors gracefully', (done) => {
      batchManager.on('monitoringError', (error: Error) => {
        expect(error).toBeInstanceOf(Error);
        done();
      });

      // Simulate monitoring error
      monitor.emit('error', new Error('Test monitoring error'));
    });

    test('should start and stop properly', () => {
      const startSpy = jest.spyOn(monitor, 'start');
      const stopSpy = jest.spyOn(monitor, 'stop');

      batchManager.start();
      expect(startSpy).toHaveBeenCalled();

      batchManager.stop();
      expect(stopSpy).toHaveBeenCalled();
    });
  });

  describe('statistics', () => {
    test('should provide comprehensive statistics', () => {
      batchManager.registerOperation('op1', 20);
      batchManager.registerOperation('op2', 40);
      
      jest.spyOn(monitor, 'getServerLoad').mockReturnValue(60);
      
      const stats = batchManager.getStatistics();
      
      expect(stats.operations).toEqual(['op1', 'op2']);
      expect(stats.currentBatchSizes).toEqual({ op1: 20, op2: 40 });
      expect(stats.lastServerLoad).toBe(60);
      expect(typeof stats.totalAdjustments).toBe('number');
    });
  });
});

describe('Integration Tests', () => {
  test('should work end-to-end with real scenario', (done) => {
    const monitor = new ServerLoadMonitor({
      pollingInterval: 50,
      enableLogging: false
    });

    const batchManager = new DynamicBatchManager(monitor, {
      minBatchSize: 10,
      maxBatchSize: 50,
      defaultBatchSize: 25
    });

    // Register multiple operations
    batchManager.registerOperation('transcription', 25);
    batchManager.registerOperation('sync', 15);

    let adjustmentCount = 0;

    batchManager.on('batchSizeAdjusted', (event: BatchAdjustmentEvent) => {
      adjustmentCount++;
      expect(event.newBatchSize).toBeGreaterThanOrEqual(10);
      expect(event.newBatchSize).toBeLessThanOrEqual(50);

      if (adjustmentCount === 2) { // Wait for both operations to adjust
        const stats = batchManager.getStatistics();
        expect(stats.operations.length).toBe(2);
        
        batchManager.stop();
        done();
      }
    });

    batchManager.start();

    // Simulate load change after a short delay
    setTimeout(() => {
      const highLoadMetrics: ServerLoadMetrics = {
        cpuUsage: 95,
        memoryUsage: 85,
        loadAverage: 3.0,
        timestamp: new Date()
      };
      
      monitor.emit('metrics', highLoadMetrics);
    }, 100);
  });
});