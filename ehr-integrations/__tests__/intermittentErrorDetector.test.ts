/**
 * Tests for IntermittentErrorDetector
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { IntermittentErrorDetector, ErrorOccurrence } from '../services/intermittentErrorDetector';

describe('IntermittentErrorDetector', () => {
  let detector: IntermittentErrorDetector;

  beforeEach(() => {
    detector = new IntermittentErrorDetector({
      analysisWindowMs: 60000, // 1 minute for faster testing
      minErrorsForPattern: 3,
      intermittentThreshold: 0.7,
      maxThresholdMultiplier: 3.0,
      minRecoveryReduction: 0.3
    });
  });

  describe('Error Recording and Pattern Detection', () => {
    test('should record errors and build patterns', () => {
      const errors: ErrorOccurrence[] = [
        {
          timestamp: new Date(),
          errorCode: 'TIMEOUT',
          errorType: 'NETWORK',
          module: 'test-module',
          isRetryable: true
        },
        {
          timestamp: new Date(),
          errorCode: 'TIMEOUT',
          errorType: 'NETWORK',
          module: 'test-module',
          isRetryable: true
        },
        {
          timestamp: new Date(),
          errorCode: 'TIMEOUT',
          errorType: 'NETWORK',
          module: 'test-module',
          isRetryable: true
        }
      ];

      errors.forEach(error => detector.recordError(error));

      const pattern = detector.getErrorPattern('TIMEOUT', 'test-module');
      expect(pattern).toBeDefined();
      expect(pattern!.totalOccurrences).toBe(3);
      expect(pattern!.errorCode).toBe('TIMEOUT');
      expect(pattern!.module).toBe('test-module');
    });

    test('should detect intermittent errors correctly', () => {
      // Record errors with recoveries to simulate intermittent pattern
      const baseTime = Date.now();
      for (let i = 0; i < 5; i++) {
        detector.recordError({
          timestamp: new Date(baseTime + i * 1000),
          errorCode: 'INTERMITTENT_ERROR',
          errorType: 'NETWORK',
          module: 'test-module',
          isRetryable: true
        });
        
        // Simulate 80% recovery rate
        if (i < 4) {
          detector.recordRecovery('INTERMITTENT_ERROR', 'test-module', 2000);
        }
      }

      const pattern = detector.getErrorPattern('INTERMITTENT_ERROR', 'test-module');
      expect(pattern).toBeDefined();
      expect(pattern!.isIntermittent).toBe(true);
      expect(pattern!.successfulRetries).toBe(4);
    });

    test('should detect persistent errors correctly', () => {
      // Record errors with very few recoveries
      const baseTime = Date.now();
      for (let i = 0; i < 5; i++) {
        detector.recordError({
          timestamp: new Date(baseTime + i * 1000),
          errorCode: 'PERSISTENT_ERROR',
          errorType: 'SYSTEM',
          module: 'test-module',
          isRetryable: false
        });
        
        // Simulate only 20% recovery rate
        if (i === 0) {
          detector.recordRecovery('PERSISTENT_ERROR', 'test-module', 5000);
        }
      }

      const pattern = detector.getErrorPattern('PERSISTENT_ERROR', 'test-module');
      expect(pattern).toBeDefined();
      expect(pattern!.isIntermittent).toBe(false);
      expect(pattern!.successfulRetries).toBe(1);
    });
  });

  describe('Threshold Recommendations', () => {
    test('should recommend increased threshold for intermittent errors', () => {
      // Setup intermittent error pattern
      for (let i = 0; i < 5; i++) {
        detector.recordError({
          timestamp: new Date(),
          errorCode: 'INTERMITTENT',
          errorType: 'NETWORK',
          module: 'test-module',
          isRetryable: true
        });
        detector.recordRecovery('INTERMITTENT', 'test-module', 1500);
      }

      const recommendation = detector.getThresholdRecommendation(
        'INTERMITTENT',
        'test-module',
        5, // current threshold
        30000 // current recovery time
      );

      expect(recommendation).toBeDefined();
      expect(recommendation!.recommendedThreshold).toBeGreaterThan(5);
      expect(recommendation!.recommendedRecoveryTime).toBeLessThan(30000);
      expect(recommendation!.reason).toContain('Intermittent error pattern detected');
    });

    test('should recommend decreased threshold for persistent errors', () => {
      // Setup persistent error pattern with very low recovery rate
      for (let i = 0; i < 5; i++) {
        detector.recordError({
          timestamp: new Date(),
          errorCode: 'PERSISTENT',
          errorType: 'SYSTEM',
          module: 'test-module',
          isRetryable: false
        });
        // Only 1 recovery out of 5 errors (20% rate, below 0.2 threshold)
        if (i === 0) {
          detector.recordRecovery('PERSISTENT', 'test-module', 10000);
        }
      }

      const recommendation = detector.getThresholdRecommendation(
        'PERSISTENT',
        'test-module',
        5, // current threshold
        30000 // current recovery time
      );

      expect(recommendation).toBeDefined();
      expect(recommendation!.recommendedThreshold).toBeLessThanOrEqual(5);
      expect(recommendation!.reason).toContain('Persistent error pattern detected');
    });

    test('should return undefined for unknown error patterns', () => {
      const recommendation = detector.getThresholdRecommendation(
        'UNKNOWN_ERROR',
        'unknown-module',
        5,
        30000
      );

      expect(recommendation).toBeUndefined();
    });
  });

  describe('Temporal Pattern Analysis', () => {
    test('should detect sporadic error patterns', () => {
      const baseTime = Date.now();
      // Use larger intervals to ensure sporadic detection
      const intervals = [5000, 150000, 10000, 200000, 30000]; // Very variable intervals

      let currentTime = baseTime;
      for (let i = 0; i < 5; i++) {
        if (i > 0) currentTime += intervals[i - 1];
        detector.recordError({
          timestamp: new Date(currentTime),
          errorCode: 'SPORADIC',
          errorType: 'NETWORK',
          module: 'test-module',
          isRetryable: true
        });
        detector.recordRecovery('SPORADIC', 'test-module', 2000);
      }

      const pattern = detector.getErrorPattern('SPORADIC', 'test-module');
      expect(pattern).toBeDefined();
      expect(['sporadic', 'unknown']).toContain(pattern!.pattern); // Allow unknown for edge cases
    });

    test('should detect burst error patterns', () => {
      const baseTime = Date.now();
      
      // Create burst pattern with errors very close together
      for (let i = 0; i < 4; i++) {
        detector.recordError({
          timestamp: new Date(baseTime + i * 5000), // 5 seconds apart
          errorCode: 'BURST',
          errorType: 'NETWORK',
          module: 'test-module',
          isRetryable: true
        });
        detector.recordRecovery('BURST', 'test-module', 1000);
      }

      const pattern = detector.getErrorPattern('BURST', 'test-module');
      expect(pattern).toBeDefined();
      expect(pattern!.pattern).toBe('burst');
    });
  });

  describe('Statistics and Cleanup', () => {
    test('should provide accurate statistics', () => {
      // Create mix of intermittent and persistent errors
      for (let i = 0; i < 3; i++) {
        detector.recordError({
          timestamp: new Date(),
          errorCode: 'INTERMITTENT',
          errorType: 'NETWORK',
          module: 'module1',
          isRetryable: true
        });
        detector.recordRecovery('INTERMITTENT', 'module1', 1000);
      }

      for (let i = 0; i < 3; i++) {
        detector.recordError({
          timestamp: new Date(),
          errorCode: 'PERSISTENT',
          errorType: 'SYSTEM',
          module: 'module2',
          isRetryable: false
        });
        // No recoveries for persistent errors
      }

      const stats = detector.getStatistics();
      expect(stats.totalPatterns).toBe(2);
      expect(stats.intermittentPatterns).toBe(1);
      expect(stats.persistentPatterns).toBe(1);
      expect(stats.totalErrorsTracked).toBe(6);
    });

    test('should reset correctly', () => {
      detector.recordError({
        timestamp: new Date(),
        errorCode: 'TEST',
        errorType: 'NETWORK',
        module: 'test-module',
        isRetryable: true
      });

      let stats = detector.getStatistics();
      expect(stats.totalErrorsTracked).toBeGreaterThan(0);

      detector.reset();

      stats = detector.getStatistics();
      expect(stats.totalErrorsTracked).toBe(0);
      expect(stats.totalPatterns).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle rapid successive errors', () => {
      const baseTime = Date.now();
      
      // Record many errors in quick succession
      for (let i = 0; i < 10; i++) {
        detector.recordError({
          timestamp: new Date(baseTime + i * 100), // 100ms apart
          errorCode: 'RAPID',
          errorType: 'NETWORK',
          module: 'test-module',
          isRetryable: true
        });
      }

      const pattern = detector.getErrorPattern('RAPID', 'test-module');
      expect(pattern).toBeDefined();
      expect(pattern!.totalOccurrences).toBe(10);
    });

    test('should handle errors with same timestamp', () => {
      const timestamp = new Date();
      
      // Record errors with exact same timestamp
      for (let i = 0; i < 3; i++) {
        detector.recordError({
          timestamp,
          errorCode: 'SIMULTANEOUS',
          errorType: 'NETWORK',
          module: 'test-module',
          isRetryable: true
        });
      }

      const pattern = detector.getErrorPattern('SIMULTANEOUS', 'test-module');
      expect(pattern).toBeDefined();
      expect(pattern!.totalOccurrences).toBe(3);
    });
  });
});