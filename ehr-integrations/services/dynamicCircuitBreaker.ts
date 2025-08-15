/**
 * Dynamic Circuit Breaker
 * 
 * Enhanced circuit breaker that dynamically adjusts failure thresholds and recovery times
 * based on intermittent error patterns detected by the IntermittentErrorDetector.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { IntermittentErrorDetector, ErrorOccurrence, DynamicThresholdRecommendation } from './intermittentErrorDetector';

export interface DynamicCircuitBreakerConfig {
  /** Initial failure threshold */
  initialFailureThreshold: number;
  /** Initial recovery time in milliseconds */
  initialRecoveryTimeMs: number;
  /** Monitoring window for circuit breaker state */
  monitoringWindowMs: number;
  /** Whether to enable dynamic adjustments */
  enableDynamicAdjustment: boolean;
  /** Minimum failure threshold (safety limit) */
  minFailureThreshold: number;
  /** Maximum failure threshold (safety limit) */
  maxFailureThreshold: number;
  /** Minimum recovery time in milliseconds (safety limit) */
  minRecoveryTimeMs: number;
  /** Maximum recovery time in milliseconds (safety limit) */
  maxRecoveryTimeMs: number;
  /** Module/service identifier for error tracking */
  module: string;
}

export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
  currentFailureThreshold: number;
  currentRecoveryTimeMs: number;
  successCount: number;
  lastAdjustmentTime: number;
}

export interface CircuitBreakerMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  circuitOpenCount: number;
  averageResponseTime: number;
  currentThreshold: number;
  currentRecoveryTime: number;
  lastAdjustment?: DynamicThresholdRecommendation;
}

/**
 * Dynamic Circuit Breaker with adaptive failure thresholds and recovery times
 */
export class DynamicCircuitBreaker {
  private config: Required<DynamicCircuitBreakerConfig>;
  private state: CircuitBreakerState;
  private errorDetector: IntermittentErrorDetector;
  private metrics: CircuitBreakerMetrics;
  private requestHistory: Array<{ timestamp: number; success: boolean; responseTime: number }> = [];

  constructor(
    config: DynamicCircuitBreakerConfig,
    errorDetector?: IntermittentErrorDetector
  ) {
    this.config = {
      initialFailureThreshold: config.initialFailureThreshold,
      initialRecoveryTimeMs: config.initialRecoveryTimeMs,
      monitoringWindowMs: config.monitoringWindowMs || 60000, // 1 minute
      enableDynamicAdjustment: config.enableDynamicAdjustment ?? true,
      minFailureThreshold: config.minFailureThreshold || 1,
      maxFailureThreshold: config.maxFailureThreshold || 20,
      minRecoveryTimeMs: config.minRecoveryTimeMs || 1000, // 1 second
      maxRecoveryTimeMs: config.maxRecoveryTimeMs || 300000, // 5 minutes
      module: config.module
    };

    this.errorDetector = errorDetector || new IntermittentErrorDetector();

    this.state = {
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0,
      currentFailureThreshold: this.config.initialFailureThreshold,
      currentRecoveryTimeMs: this.config.initialRecoveryTimeMs,
      successCount: 0,
      lastAdjustmentTime: 0
    };

    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      circuitOpenCount: 0,
      averageResponseTime: 0,
      currentThreshold: this.config.initialFailureThreshold,
      currentRecoveryTime: this.config.initialRecoveryTimeMs
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    operation: () => Promise<T>,
    errorCode: string = 'GENERAL_ERROR'
  ): Promise<T> {
    const startTime = Date.now();

    // Check if circuit is open
    if (this.state.state === 'OPEN') {
      if (Date.now() < this.state.nextAttemptTime) {
        throw new Error(`Circuit breaker is OPEN. Next attempt allowed at ${new Date(this.state.nextAttemptTime).toISOString()}`);
      } else {
        this.state.state = 'HALF_OPEN';
        this.state.successCount = 0;
      }
    }

    this.metrics.totalRequests++;

    try {
      const result = await operation();
      const responseTime = Date.now() - startTime;
      
      this.recordSuccess(responseTime);
      
      // Record recovery if we had previous failures
      if (this.state.failureCount > 0) {
        this.errorDetector.recordRecovery(errorCode, this.config.module, responseTime);
      }

      return result;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.recordFailure(errorCode, error, responseTime);
      throw error;
    }
  }

  /**
   * Get current circuit breaker state
   */
  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  /**
   * Get circuit breaker metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Manually trigger dynamic adjustment (useful for testing)
   */
  async triggerDynamicAdjustment(errorCode: string): Promise<DynamicThresholdRecommendation | null> {
    if (!this.config.enableDynamicAdjustment) {
      return null;
    }

    const recommendation = this.errorDetector.getThresholdRecommendation(
      errorCode,
      this.config.module,
      this.state.currentFailureThreshold,
      this.state.currentRecoveryTimeMs
    );

    if (recommendation && this.shouldApplyRecommendation(recommendation)) {
      this.applyRecommendation(recommendation);
      return recommendation;
    }

    return null;
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    this.state = {
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0,
      currentFailureThreshold: this.config.initialFailureThreshold,
      currentRecoveryTimeMs: this.config.initialRecoveryTimeMs,
      successCount: 0,
      lastAdjustmentTime: 0
    };

    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      circuitOpenCount: 0,
      averageResponseTime: 0,
      currentThreshold: this.config.initialFailureThreshold,
      currentRecoveryTime: this.config.initialRecoveryTimeMs
    };

    this.requestHistory = [];
  }

  // Private methods

  private recordSuccess(responseTime: number): void {
    this.metrics.successfulRequests++;
    this.state.successCount++;
    
    this.recordRequest(true, responseTime);

    if (this.state.state === 'HALF_OPEN') {
      // Successful request in half-open state, close the circuit
      this.state.state = 'CLOSED';
      this.state.failureCount = 0;
    }
  }

  private recordFailure(errorCode: string, error: any, responseTime: number): void {
    this.metrics.failedRequests++;
    this.state.failureCount++;
    this.state.lastFailureTime = Date.now();
    
    this.recordRequest(false, responseTime);

    // Record error for pattern analysis
    const errorOccurrence: ErrorOccurrence = {
      timestamp: new Date(),
      errorCode,
      errorType: this.getErrorType(error),
      module: this.config.module,
      isRetryable: this.isRetryableError(error)
    };

    this.errorDetector.recordError(errorOccurrence);

    // Check if we should open the circuit
    if (this.state.failureCount >= this.state.currentFailureThreshold) {
      this.openCircuit();
    }

    // Consider dynamic adjustment after recording the error
    if (this.config.enableDynamicAdjustment) {
      this.considerDynamicAdjustment(errorCode);
    }
  }

  private recordRequest(success: boolean, responseTime: number): void {
    const now = Date.now();
    this.requestHistory.push({ timestamp: now, success, responseTime });
    
    // Clean up old requests outside monitoring window
    const cutoffTime = now - this.config.monitoringWindowMs;
    this.requestHistory = this.requestHistory.filter(req => req.timestamp >= cutoffTime);
  }

  private openCircuit(): void {
    this.state.state = 'OPEN';
    this.state.nextAttemptTime = Date.now() + this.state.currentRecoveryTimeMs;
    this.metrics.circuitOpenCount++;
    
    this.logAdjustment('Circuit breaker opened', {
      failureCount: this.state.failureCount,
      threshold: this.state.currentFailureThreshold,
      recoveryTime: this.state.currentRecoveryTimeMs
    });
  }

  private async considerDynamicAdjustment(errorCode: string): Promise<void> {
    // Avoid too frequent adjustments
    const minAdjustmentInterval = 30000; // 30 seconds
    if (Date.now() - this.state.lastAdjustmentTime < minAdjustmentInterval) {
      return;
    }

    const recommendation = this.errorDetector.getThresholdRecommendation(
      errorCode,
      this.config.module,
      this.state.currentFailureThreshold,
      this.state.currentRecoveryTimeMs
    );

    if (recommendation && this.shouldApplyRecommendation(recommendation)) {
      this.applyRecommendation(recommendation);
    }
  }

  private shouldApplyRecommendation(recommendation: DynamicThresholdRecommendation): boolean {
    // Only apply if confidence is high enough and changes are significant
    const minConfidence = 0.6;
    const minThresholdChange = 1;
    const minRecoveryTimeChange = 1000; // 1 second

    if (recommendation.confidence < minConfidence) {
      return false;
    }

    const thresholdChange = Math.abs(recommendation.recommendedThreshold - recommendation.currentThreshold);
    const recoveryTimeChange = Math.abs(recommendation.recommendedRecoveryTime - recommendation.currentRecoveryTime);

    return thresholdChange >= minThresholdChange || recoveryTimeChange >= minRecoveryTimeChange;
  }

  private applyRecommendation(recommendation: DynamicThresholdRecommendation): void {
    const oldThreshold = this.state.currentFailureThreshold;
    const oldRecoveryTime = this.state.currentRecoveryTimeMs;

    // Apply recommended changes within safety limits
    this.state.currentFailureThreshold = Math.max(
      this.config.minFailureThreshold,
      Math.min(this.config.maxFailureThreshold, recommendation.recommendedThreshold)
    );

    this.state.currentRecoveryTimeMs = Math.max(
      this.config.minRecoveryTimeMs,
      Math.min(this.config.maxRecoveryTimeMs, recommendation.recommendedRecoveryTime)
    );

    this.state.lastAdjustmentTime = Date.now();
    this.metrics.lastAdjustment = recommendation;

    this.logAdjustment('Dynamic adjustment applied', {
      oldThreshold,
      newThreshold: this.state.currentFailureThreshold,
      oldRecoveryTime,
      newRecoveryTime: this.state.currentRecoveryTimeMs,
      reason: recommendation.reason,
      confidence: recommendation.confidence
    });
  }

  private updateMetrics(): void {
    const recentRequests = this.requestHistory;
    
    if (recentRequests.length > 0) {
      const totalResponseTime = recentRequests.reduce((sum, req) => sum + req.responseTime, 0);
      this.metrics.averageResponseTime = totalResponseTime / recentRequests.length;
    }

    this.metrics.currentThreshold = this.state.currentFailureThreshold;
    this.metrics.currentRecoveryTime = this.state.currentRecoveryTimeMs;
  }

  private getErrorType(error: any): string {
    if (error?.code) return error.code;
    if (error?.name) return error.name;
    if (error?.message?.includes('timeout')) return 'TIMEOUT';
    if (error?.message?.includes('network')) return 'NETWORK';
    return 'UNKNOWN';
  }

  private isRetryableError(error: any): boolean {
    // Common retryable error patterns
    const retryablePatterns = [
      'TIMEOUT',
      'NETWORK',
      'CONNECTION_FAILED',
      'SERVICE_UNAVAILABLE',
      'RATE_LIMIT'
    ];

    const errorType = this.getErrorType(error);
    return retryablePatterns.some(pattern => errorType.includes(pattern));
  }

  private logAdjustment(message: string, context: Record<string, any>): void {
    console.log(`[Dynamic Circuit Breaker - ${this.config.module}] ${message}`, context);
  }
}

export default DynamicCircuitBreaker;