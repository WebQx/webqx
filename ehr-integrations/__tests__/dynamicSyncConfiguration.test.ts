/**
 * Dynamic Sync Configuration Service Tests
 * 
 * Tests for dynamic synchronization interval functionality including
 * critical data prioritization, system load adaptation, and administrative
 * configuration management.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { 
  DynamicSyncConfigurationService,
  DynamicSyncIntervalConfig,
  SyncIntervalContext,
  DataCriticality
} from '../services/dynamicSyncConfigurationService';
import { DataSyncService } from '../services/dataSync';
import { RealTimeUpdateService } from '../services/realTimeUpdateService';

describe('DynamicSyncConfigurationService', () => {
  let dynamicSyncConfig: DynamicSyncConfigurationService;

  beforeEach(() => {
    dynamicSyncConfig = new DynamicSyncConfigurationService();
  });

  describe('Interval Calculation', () => {
    test('should return critical interval for critical data types', () => {
      const result = dynamicSyncConfig.calculateSyncInterval({
        dataType: 'vitals'
      });

      expect(result.criticality).toBe('critical');
      expect(result.intervalMs).toBe(5000); // 5 seconds
    });

    test('should return non-essential interval for non-essential data types', () => {
      const result = dynamicSyncConfig.calculateSyncInterval({
        dataType: 'demographics'
      });

      expect(result.criticality).toBe('non-essential');
      expect(result.intervalMs).toBe(60000); // 60 seconds
    });

    test('should return default interval for unknown data types', () => {
      const result = dynamicSyncConfig.calculateSyncInterval({
        dataType: 'unknown_type' as any
      });

      expect(result.criticality).toBe('default');
      expect(result.intervalMs).toBe(30000); // 30 seconds
    });

    test('should adjust interval based on system load', () => {
      const lowLoadResult = dynamicSyncConfig.calculateSyncInterval({
        dataType: 'vitals',
        systemLoad: 0.3
      });

      const highLoadResult = dynamicSyncConfig.calculateSyncInterval({
        dataType: 'vitals',
        systemLoad: 0.9
      });

      expect(highLoadResult.intervalMs).toBeGreaterThan(lowLoadResult.intervalMs);
    });

    test('should adjust interval based on patient criticality', () => {
      const normalResult = dynamicSyncConfig.calculateSyncInterval({
        dataType: 'vitals'
      });

      const highPriorityResult = dynamicSyncConfig.calculateSyncInterval({
        dataType: 'vitals',
        patientCriticality: 'high'
      });

      expect(highPriorityResult.intervalMs).toBeLessThan(normalResult.intervalMs);
    });

    test('should apply failure backoff factor', () => {
      const normalResult = dynamicSyncConfig.calculateSyncInterval({
        dataType: 'vitals'
      });

      const failureResult = dynamicSyncConfig.calculateSyncInterval({
        dataType: 'vitals',
        recentFailures: 2
      });

      expect(failureResult.intervalMs).toBeGreaterThan(normalResult.intervalMs);
    });

    test('should respect minimum and maximum interval limits', () => {
      const config = new DynamicSyncConfigurationService({
        minInterval: 2000,
        maxInterval: 120000
      });

      // Test minimum limit
      const minResult = config.calculateSyncInterval({
        dataType: 'vitals',
        systemLoad: 0.1,
        patientCriticality: 'high',
        customParams: { urgency: 'emergency' }
      });

      expect(minResult.intervalMs).toBeGreaterThanOrEqual(2000);

      // Test maximum limit
      const maxResult = config.calculateSyncInterval({
        dataType: 'demographics',
        systemLoad: 1.0,
        recentFailures: 5,
        customParams: { urgency: 'routine' }
      });

      expect(maxResult.intervalMs).toBeLessThanOrEqual(120000);
    });
  });

  describe('Configuration Management', () => {
    test('should update data type criticality', () => {
      dynamicSyncConfig.updateDataTypeCriticality('test_type', 'critical');
      
      const result = dynamicSyncConfig.calculateSyncInterval({
        dataType: 'test_type' as any
      });

      expect(result.criticality).toBe('critical');
    });

    test('should update base intervals', () => {
      dynamicSyncConfig.updateBaseIntervals({
        critical: 3000,
        nonEssential: 90000
      });

      const criticalResult = dynamicSyncConfig.calculateSyncInterval({
        dataType: 'vitals'
      });

      const nonEssentialResult = dynamicSyncConfig.calculateSyncInterval({
        dataType: 'demographics'
      });

      expect(criticalResult.intervalMs).toBe(3000);
      expect(nonEssentialResult.intervalMs).toBe(90000);
    });

    test('should track interval history', () => {
      dynamicSyncConfig.calculateSyncInterval({ dataType: 'vitals' });
      dynamicSyncConfig.calculateSyncInterval({ dataType: 'vitals' });

      const history = dynamicSyncConfig.getIntervalHistory('vitals');
      expect(history).toHaveLength(2);
    });

    test('should enable/disable adaptive adjustment', () => {
      dynamicSyncConfig.setAdaptiveAdjustmentEnabled(false);

      const result = dynamicSyncConfig.calculateSyncInterval({
        dataType: 'vitals',
        systemLoad: 0.9 // High load should not affect interval when adaptive is disabled
      });

      expect(result.intervalMs).toBe(5000); // Base critical interval
      expect(result.adjustmentFactors.systemLoadFactor).toBe(1.0);
    });
  });

  describe('Custom Parameters', () => {
    test('should handle urgency parameter', () => {
      const emergencyResult = dynamicSyncConfig.calculateSyncInterval({
        dataType: 'vitals',
        customParams: { urgency: 'emergency' }
      });

      const routineResult = dynamicSyncConfig.calculateSyncInterval({
        dataType: 'vitals',
        customParams: { urgency: 'routine' }
      });

      expect(emergencyResult.intervalMs).toBeLessThan(routineResult.intervalMs);
    });

    test('should handle data size parameter', () => {
      const smallDataResult = dynamicSyncConfig.calculateSyncInterval({
        dataType: 'vitals',
        customParams: { dataSize: 5 } // 5MB
      });

      const largeDataResult = dynamicSyncConfig.calculateSyncInterval({
        dataType: 'vitals',
        customParams: { dataSize: 60 } // 60MB
      });

      expect(largeDataResult.intervalMs).toBeGreaterThan(smallDataResult.intervalMs);
    });
  });
});

describe('DataSyncService Integration', () => {
  let dataSyncService: DataSyncService;

  beforeEach(() => {
    dataSyncService = new DataSyncService({
      enableDynamicIntervals: true,
      dynamicIntervalConfig: {
        baseIntervals: {
          critical: 3000,
          nonEssential: 45000,
          default: 20000
        }
      }
    });
  });

  test('should calculate dynamic sync intervals', () => {
    const criticalInterval = dataSyncService.calculateSyncInterval('vitals');
    const nonEssentialInterval = dataSyncService.calculateSyncInterval('demographics');

    expect(criticalInterval).toBe(3000);
    expect(nonEssentialInterval).toBe(45000);
  });

  test('should cache calculated intervals', () => {
    const interval1 = dataSyncService.getCurrentSyncInterval('vitals');
    const interval2 = dataSyncService.getCurrentSyncInterval('vitals');

    expect(interval1).toBe(interval2);
  });

  test('should update data type criticality', () => {
    dataSyncService.updateDataTypeCriticality('test_type', 'critical');
    
    const interval = dataSyncService.calculateSyncInterval('test_type' as any);
    expect(interval).toBe(3000);
  });

  test('should disable dynamic intervals when configured', () => {
    const staticService = new DataSyncService({
      enableDynamicIntervals: false,
      syncTimeoutMs: 100000
    });

    const interval = staticService.getCurrentSyncInterval('vitals');
    expect(interval).toBe(100000);
  });
});

describe('RealTimeUpdateService Integration', () => {
  let realTimeService: RealTimeUpdateService;

  beforeEach(() => {
    realTimeService = new RealTimeUpdateService({
      enableWebSocket: false, // Use polling for testing
      enableDynamicPolling: true,
      pollingInterval: 30000,
      dynamicPollingConfig: {
        baseIntervals: {
          critical: 5000,
          nonEssential: 60000,
          default: 30000
        }
      }
    });
  });

  test('should calculate dynamic polling intervals based on subscriptions', () => {
    // Subscribe to critical events
    realTimeService.subscribe({
      eventTypes: ['observation_added', 'medication_prescribed'],
      callback: () => {}
    });

    const interval = realTimeService.calculateDynamicPollingInterval();
    expect(interval).toBe(5000); // Critical interval
  });

  test('should adjust polling interval when subscriptions change', (done) => {
    realTimeService.on('polling_interval_changed', (event) => {
      expect(event.newInterval).toBe(5000);
      done();
    });

    // Add critical subscription
    realTimeService.subscribe({
      eventTypes: ['observation_added'],
      callback: () => {}
    });
  });

  test('should use non-essential interval for non-critical subscriptions', () => {
    realTimeService.subscribe({
      eventTypes: ['resource_created'],
      callback: () => {}
    });

    const interval = realTimeService.calculateDynamicPollingInterval();
    expect(interval).toBe(30000); // Default interval for non-critical events
  });

  test('should disable dynamic polling when configured', () => {
    realTimeService.setDynamicPollingEnabled(false);
    
    realTimeService.subscribe({
      eventTypes: ['observation_added'],
      callback: () => {}
    });

    const interval = realTimeService.calculateDynamicPollingInterval();
    expect(interval).toBe(30000); // Static interval
  });
});

describe('End-to-End Scenarios', () => {
  test('should handle emergency scenario with critical data', () => {
    const dynamicConfig = new DynamicSyncConfigurationService();
    
    const emergencyResult = dynamicConfig.calculateSyncInterval({
      dataType: 'vitals',
      patientCriticality: 'high',
      customParams: {
        urgency: 'emergency'
      }
    });

    // Emergency vitals should have very short interval
    expect(emergencyResult.intervalMs).toBeLessThan(2000);
    expect(emergencyResult.criticality).toBe('critical');
  });

  test('should handle high system load gracefully', () => {
    const dynamicConfig = new DynamicSyncConfigurationService();
    
    const highLoadResult = dynamicConfig.calculateSyncInterval({
      dataType: 'demographics',
      systemLoad: 0.95,
      recentFailures: 1
    });

    // High load + failures should increase interval significantly
    expect(highLoadResult.intervalMs).toBeGreaterThan(100000);
  });

  test('should optimize resource usage for non-essential data during peak load', () => {
    const dynamicConfig = new DynamicSyncConfigurationService();
    
    const peakLoadResult = dynamicConfig.calculateSyncInterval({
      dataType: 'billing',
      systemLoad: 0.8,
      customParams: {
        urgency: 'routine'
      }
    });

    // Non-essential data during peak load should have long intervals
    expect(peakLoadResult.intervalMs).toBeGreaterThan(120000);
  });
});

describe('Configuration Validation', () => {
  test('should handle invalid configuration gracefully', () => {
    expect(() => {
      new DynamicSyncConfigurationService({
        baseIntervals: {
          critical: -1000, // Invalid negative interval
          nonEssential: 60000,
          default: 30000
        }
      });
    }).not.toThrow();
  });

  test('should provide default values for missing configuration', () => {
    const config = new DynamicSyncConfigurationService({});
    const configuration = config.getConfiguration();
    
    expect(configuration.baseIntervals.critical).toBe(5000);
    expect(configuration.baseIntervals.nonEssential).toBe(60000);
    expect(configuration.baseIntervals.default).toBe(30000);
  });
});