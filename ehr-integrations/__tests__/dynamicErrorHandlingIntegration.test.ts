/**
 * Integration Test for Dynamic Error Handling
 * 
 * Tests the complete integration of IntermittentErrorDetector and DynamicCircuitBreaker
 * to validate the dynamic failure threshold and recovery time adjustments work correctly.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { IntermittentErrorDetector } from '../services/intermittentErrorDetector';
import { DynamicCircuitBreaker, DynamicCircuitBreakerConfig } from '../services/dynamicCircuitBreaker';

describe('Dynamic Error Handling Integration', () => {
  let errorDetector: IntermittentErrorDetector;
  let circuitBreaker: DynamicCircuitBreaker;

  beforeEach(() => {
    errorDetector = new IntermittentErrorDetector({
      analysisWindowMs: 60000,
      minErrorsForPattern: 2, // Lower threshold for testing
      intermittentThreshold: 0.6,
      maxThresholdMultiplier: 2.0,
      minRecoveryReduction: 0.5
    });

    const config: DynamicCircuitBreakerConfig = {
      initialFailureThreshold: 2, // Lower for easier testing
      initialRecoveryTimeMs: 5000,
      monitoringWindowMs: 30000,
      enableDynamicAdjustment: true,
      minFailureThreshold: 1,
      maxFailureThreshold: 10,
      minRecoveryTimeMs: 1000,
      maxRecoveryTimeMs: 30000,
      module: 'integration-test'
    };

    circuitBreaker = new DynamicCircuitBreaker(config, errorDetector);
  });

  describe('Intermittent Error Pattern Detection', () => {
    test('should detect intermittent patterns and recommend higher thresholds', () => {
      // Manually create intermittent pattern in error detector
      for (let i = 0; i < 5; i++) {
        errorDetector.recordError({
          timestamp: new Date(),
          errorCode: 'INTERMITTENT_TEST',
          errorType: 'NETWORK',
          module: 'integration-test',
          isRetryable: true
        });
        
        // 80% recovery rate
        if (i < 4) {
          errorDetector.recordRecovery('INTERMITTENT_TEST', 'integration-test', 1500);
        }
      }

      const pattern = errorDetector.getErrorPattern('INTERMITTENT_TEST', 'integration-test');
      expect(pattern).toBeDefined();
      expect(pattern!.isIntermittent).toBe(true);

      const recommendation = errorDetector.getThresholdRecommendation(
        'INTERMITTENT_TEST',
        'integration-test',
        2, // current threshold
        5000 // current recovery time
      );

      expect(recommendation).toBeDefined();
      expect(recommendation!.recommendedThreshold).toBeGreaterThan(2);
      expect(recommendation!.recommendedRecoveryTime).toBeLessThan(5000);
    });

    test('should detect persistent patterns correctly', () => {
      // Create persistent pattern (low recovery rate)
      for (let i = 0; i < 5; i++) {
        errorDetector.recordError({
          timestamp: new Date(),
          errorCode: 'PERSISTENT_TEST',
          errorType: 'SYSTEM',
          module: 'integration-test',
          isRetryable: false
        });
        
        // Only 20% recovery rate (1 out of 5)
        if (i === 0) {
          errorDetector.recordRecovery('PERSISTENT_TEST', 'integration-test', 8000);
        }
      }

      const pattern = errorDetector.getErrorPattern('PERSISTENT_TEST', 'integration-test');
      expect(pattern).toBeDefined();
      expect(pattern!.isIntermittent).toBe(false);
      expect(pattern!.successfulRetries).toBe(1);
      expect(pattern!.totalOccurrences).toBe(5);
    });
  });

  describe('Dynamic Circuit Breaker Behavior', () => {
    test('should maintain basic circuit breaker functionality', async () => {
      const successOperation = jest.fn().mockResolvedValue('success');
      const failOperation = jest.fn().mockRejectedValue(new Error('fail'));

      // Successful operation
      const result = await circuitBreaker.execute(successOperation, 'SUCCESS_TEST');
      expect(result).toBe('success');
      expect(circuitBreaker.getState().state).toBe('CLOSED');

      // Failed operations to reach threshold
      for (let i = 0; i < 2; i++) {
        try {
          await circuitBreaker.execute(failOperation, 'FAIL_TEST');
        } catch (error) {
          // Expected
        }
      }

      expect(circuitBreaker.getState().state).toBe('OPEN');
    });

    test('should track error patterns during circuit breaker execution', async () => {
      const mockOperation = jest.fn();

      // Create alternating fail/success pattern
      for (let i = 0; i < 4; i++) {
        if (i % 2 === 0) {
          mockOperation.mockRejectedValueOnce(new Error('Intermittent error'));
          try {
            await circuitBreaker.execute(mockOperation, 'PATTERN_TEST');
          } catch (error) {
            // Expected - circuit may open, but that's ok for this test
            if (error.message.includes('Circuit breaker is OPEN')) {
              // Reset circuit breaker to continue pattern
              circuitBreaker.reset();
            }
          }
        } else {
          mockOperation.mockResolvedValueOnce('success');
          try {
            await circuitBreaker.execute(mockOperation, 'PATTERN_TEST');
          } catch (error) {
            // Circuit might be open, reset to continue
            if (error.message.includes('Circuit breaker is OPEN')) {
              circuitBreaker.reset();
              mockOperation.mockResolvedValueOnce('success');
              await circuitBreaker.execute(mockOperation, 'PATTERN_TEST');
            }
          }
        }
      }

      // Check that patterns are being tracked
      const stats = errorDetector.getStatistics();
      expect(stats.totalErrorsTracked).toBeGreaterThan(0);
    });

    test('should provide comprehensive metrics and diagnostics', () => {
      const metrics = circuitBreaker.getMetrics();
      const state = circuitBreaker.getState();

      // Validate metrics structure
      expect(metrics).toHaveProperty('totalRequests');
      expect(metrics).toHaveProperty('successfulRequests');
      expect(metrics).toHaveProperty('failedRequests');
      expect(metrics).toHaveProperty('currentThreshold');
      expect(metrics).toHaveProperty('currentRecoveryTime');

      // Validate state structure
      expect(state).toHaveProperty('state');
      expect(state).toHaveProperty('currentFailureThreshold');
      expect(state).toHaveProperty('currentRecoveryTimeMs');
      expect(state).toHaveProperty('failureCount');
    });
  });

  describe('Configuration and Safety', () => {
    test('should respect minimum and maximum threshold limits', () => {
      const restrictiveConfig: DynamicCircuitBreakerConfig = {
        initialFailureThreshold: 3,
        initialRecoveryTimeMs: 5000,
        monitoringWindowMs: 30000,
        enableDynamicAdjustment: true,
        minFailureThreshold: 2,
        maxFailureThreshold: 4,
        minRecoveryTimeMs: 2000,
        maxRecoveryTimeMs: 10000,
        module: 'restrictive-test'
      };

      const restrictiveCircuitBreaker = new DynamicCircuitBreaker(restrictiveConfig, errorDetector);
      
      const state = restrictiveCircuitBreaker.getState();
      
      // Initial values should be within limits
      expect(state.currentFailureThreshold).toBeGreaterThanOrEqual(restrictiveConfig.minFailureThreshold!);
      expect(state.currentFailureThreshold).toBeLessThanOrEqual(restrictiveConfig.maxFailureThreshold!);
      expect(state.currentRecoveryTimeMs).toBeGreaterThanOrEqual(restrictiveConfig.minRecoveryTimeMs!);
      expect(state.currentRecoveryTimeMs).toBeLessThanOrEqual(restrictiveConfig.maxRecoveryTimeMs!);
    });

    test('should work with dynamic adjustment disabled', async () => {
      const staticConfig: DynamicCircuitBreakerConfig = {
        initialFailureThreshold: 3,
        initialRecoveryTimeMs: 5000,
        monitoringWindowMs: 30000,
        enableDynamicAdjustment: false,
        minFailureThreshold: 1,
        maxFailureThreshold: 10,
        minRecoveryTimeMs: 1000,
        maxRecoveryTimeMs: 30000,
        module: 'static-test'
      };

      const staticCircuitBreaker = new DynamicCircuitBreaker(staticConfig, errorDetector);
      
      // Record some error pattern
      for (let i = 0; i < 3; i++) {
        errorDetector.recordError({
          timestamp: new Date(),
          errorCode: 'STATIC_TEST',
          errorType: 'NETWORK',
          module: 'static-test',
          isRetryable: true
        });
        errorDetector.recordRecovery('STATIC_TEST', 'static-test', 1000);
      }

      // Try to trigger adjustment
      const recommendation = await staticCircuitBreaker.triggerDynamicAdjustment('STATIC_TEST');
      expect(recommendation).toBeNull();

      // Thresholds should remain unchanged
      const state = staticCircuitBreaker.getState();
      expect(state.currentFailureThreshold).toBe(staticConfig.initialFailureThreshold);
      expect(state.currentRecoveryTimeMs).toBe(staticConfig.initialRecoveryTimeMs);
    });
  });

  describe('Real-world Scenario Simulation', () => {
    test('should handle mixed error scenarios realistically', async () => {
      const scenarios = [
        { type: 'network-timeout', intermittent: true, recoveryTime: 1000 },
        { type: 'database-connection', intermittent: false, recoveryTime: 5000 },
        { type: 'api-rate-limit', intermittent: true, recoveryTime: 500 }
      ];

      for (const scenario of scenarios) {
        const mockOperation = jest.fn();
        
        // Create realistic error pattern for each scenario
        for (let i = 0; i < 6; i++) {
          const shouldFail = scenario.intermittent ? (i % 3 === 0) : (i < 4); // Intermittent: 33% fail, Persistent: 66% fail
          
          if (shouldFail) {
            mockOperation.mockRejectedValueOnce(new Error(scenario.type));
            try {
              await circuitBreaker.execute(mockOperation, scenario.type);
            } catch (error) {
              if (error.message.includes('Circuit breaker is OPEN')) {
                // Circuit opened, which is expected behavior
                break;
              }
            }
          } else {
            mockOperation.mockResolvedValueOnce('success');
            try {
              await circuitBreaker.execute(mockOperation, scenario.type);
            } catch (error) {
              if (error.message.includes('Circuit breaker is OPEN')) {
                circuitBreaker.reset(); // Reset to continue testing
                mockOperation.mockResolvedValueOnce('success');
                await circuitBreaker.execute(mockOperation, scenario.type);
              }
            }
          }
        }
      }

      // Verify that error patterns were captured
      const errorStats = errorDetector.getStatistics();
      expect(errorStats.totalErrorsTracked).toBeGreaterThan(0);
      
      const circuitBreakerMetrics = circuitBreaker.getMetrics();
      expect(circuitBreakerMetrics.totalRequests).toBeGreaterThan(0);
    });
  });
});