/**
 * @fileoverview Adaptive Timeout Manager
 * 
 * Provides dynamic timeout adjustment based on response times for external API calls.
 * Ensures better performance and reliability under variable network conditions
 * while maintaining compatibility with existing timeout configurations.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

/**
 * Configuration for adaptive timeout behavior
 */
export interface AdaptiveTimeoutConfig {
  /** Minimum timeout value in milliseconds (default: 30000) */
  minTimeoutMs: number;
  /** Maximum timeout value in milliseconds (default: 120000) */
  maxTimeoutMs: number;
  /** Multiplier for calculated timeout (default: 2) */
  timeoutMultiplier: number;
  /** Maximum number of response times to track (default: 20) */
  maxSamples: number;
  /** Fallback timeout when no historical data is available */
  fallbackTimeoutMs: number;
  /** Enable detailed logging */
  enableLogging: boolean;
}

/**
 * Response time entry for tracking
 */
interface ResponseTimeEntry {
  /** Response time in milliseconds */
  duration: number;
  /** Timestamp when the response was recorded */
  timestamp: number;
  /** Whether the request was successful */
  success: boolean;
}

/**
 * Statistics for a specific endpoint/service
 */
interface EndpointStats {
  /** Array of recent response times */
  responseTimes: ResponseTimeEntry[];
  /** Current adaptive timeout value */
  currentTimeout: number;
  /** Number of timeout adjustments made */
  adjustmentCount: number;
  /** Last adjustment timestamp */
  lastAdjusted: number;
}

/**
 * Adaptive Timeout Manager
 * 
 * Tracks response times for external API calls and dynamically adjusts timeout values
 * to improve reliability and performance under variable network conditions.
 */
export class AdaptiveTimeoutManager {
  private config: AdaptiveTimeoutConfig;
  private endpointStats: Map<string, EndpointStats> = new Map();
  
  /**
   * Default configuration for adaptive timeout behavior
   */
  private static readonly DEFAULT_CONFIG: AdaptiveTimeoutConfig = {
    minTimeoutMs: 30000,      // 30 seconds minimum
    maxTimeoutMs: 120000,     // 2 minutes maximum
    timeoutMultiplier: 2,     // 2x average response time
    maxSamples: 20,           // Keep last 20 response times
    fallbackTimeoutMs: 30000, // Default fallback
    enableLogging: true
  };

  constructor(config: Partial<AdaptiveTimeoutConfig> = {}) {
    this.config = { ...AdaptiveTimeoutManager.DEFAULT_CONFIG, ...config };
    this.log('AdaptiveTimeoutManager initialized', this.config);
  }

  /**
   * Get adaptive timeout for a specific endpoint
   * @param endpointKey Unique identifier for the endpoint/service
   * @param fallbackTimeout Optional fallback timeout (overrides config)
   * @returns Calculated timeout in milliseconds
   */
  getAdaptiveTimeout(endpointKey: string, fallbackTimeout?: number): number {
    const stats = this.endpointStats.get(endpointKey);
    
    // If no historical data, use fallback
    if (!stats || stats.responseTimes.length === 0) {
      const timeout = fallbackTimeout || this.config.fallbackTimeoutMs;
      this.log(`No data for ${endpointKey}, using fallback timeout: ${timeout}ms`);
      return timeout;
    }

    // Calculate adaptive timeout based on historical data
    const adaptiveTimeout = this.calculateAdaptiveTimeout(stats.responseTimes);
    
    // Update stats
    stats.currentTimeout = adaptiveTimeout;
    stats.lastAdjusted = Date.now();
    
    this.log(`Adaptive timeout for ${endpointKey}: ${adaptiveTimeout}ms (based on ${stats.responseTimes.length} samples)`);
    
    return adaptiveTimeout;
  }

  /**
   * Record response time for an endpoint
   * @param endpointKey Unique identifier for the endpoint/service
   * @param duration Response duration in milliseconds
   * @param success Whether the request was successful
   */
  recordResponseTime(endpointKey: string, duration: number, success: boolean = true): void {
    let stats = this.endpointStats.get(endpointKey);
    
    if (!stats) {
      stats = {
        responseTimes: [],
        currentTimeout: this.config.fallbackTimeoutMs,
        adjustmentCount: 0,
        lastAdjusted: 0
      };
      this.endpointStats.set(endpointKey, stats);
    }

    // Add new response time entry
    const entry: ResponseTimeEntry = {
      duration,
      timestamp: Date.now(),
      success
    };
    
    stats.responseTimes.push(entry);
    
    // Keep only the most recent samples
    if (stats.responseTimes.length > this.config.maxSamples) {
      stats.responseTimes = stats.responseTimes.slice(-this.config.maxSamples);
    }
    
    // Update adjustment count
    stats.adjustmentCount++;
    
    this.log(`Recorded response time for ${endpointKey}: ${duration}ms (success: ${success})`);
  }

  /**
   * Calculate adaptive timeout based on response times using the example algorithm
   * @param responseTimes Array of response time entries
   * @returns Calculated timeout in milliseconds
   */
  private calculateAdaptiveTimeout(responseTimes: ResponseTimeEntry[]): number {
    if (responseTimes.length === 0) {
      return this.config.fallbackTimeoutMs;
    }
    
    // Filter to only successful requests for calculation
    const successfulTimes = responseTimes
      .filter(entry => entry.success)
      .map(entry => entry.duration);
    
    if (successfulTimes.length === 0) {
      // If no successful requests, use fallback but with higher value
      return Math.min(this.config.fallbackTimeoutMs * 1.5, this.config.maxTimeoutMs);
    }
    
    // Calculate average response time
    const averageResponseTime = successfulTimes.reduce((sum, time) => sum + time, 0) / successfulTimes.length;
    
    // Apply the formula from the problem statement
    const calculatedTimeout = averageResponseTime * this.config.timeoutMultiplier;
    
    // Ensure timeout is within bounds
    const adaptiveTimeout = Math.min(
      Math.max(calculatedTimeout, this.config.minTimeoutMs),
      this.config.maxTimeoutMs
    );
    
    this.log(`Calculated adaptive timeout: avg=${averageResponseTime.toFixed(0)}ms, adaptive=${adaptiveTimeout}ms`);
    
    return Math.round(adaptiveTimeout);
  }

  /**
   * Get statistics for a specific endpoint
   * @param endpointKey Unique identifier for the endpoint/service
   * @returns Endpoint statistics or null if not found
   */
  getEndpointStats(endpointKey: string): EndpointStats | null {
    return this.endpointStats.get(endpointKey) || null;
  }

  /**
   * Get statistics for all tracked endpoints
   * @returns Map of endpoint statistics
   */
  getAllStats(): Map<string, EndpointStats> {
    return new Map(this.endpointStats);
  }

  /**
   * Clear statistics for a specific endpoint
   * @param endpointKey Unique identifier for the endpoint/service
   */
  clearEndpointStats(endpointKey: string): void {
    this.endpointStats.delete(endpointKey);
    this.log(`Cleared stats for ${endpointKey}`);
  }

  /**
   * Clear all endpoint statistics
   */
  clearAllStats(): void {
    this.endpointStats.clear();
    this.log('Cleared all endpoint statistics');
  }

  /**
   * Update configuration
   * @param newConfig Partial configuration to merge
   */
  updateConfig(newConfig: Partial<AdaptiveTimeoutConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.log('Configuration updated', newConfig);
  }

  /**
   * Get current configuration (without sensitive data)
   * @returns Current configuration
   */
  getConfig(): AdaptiveTimeoutConfig {
    return { ...this.config };
  }

  /**
   * Check if endpoint has sufficient data for adaptive timeouts
   * @param endpointKey Unique identifier for the endpoint/service
   * @param minSamples Minimum number of samples required (default: 3)
   * @returns True if endpoint has sufficient data
   */
  hasSufficientData(endpointKey: string, minSamples: number = 3): boolean {
    const stats = this.endpointStats.get(endpointKey);
    return stats ? stats.responseTimes.length >= minSamples : false;
  }

  /**
   * Get current adaptive timeout without calculating new one
   * @param endpointKey Unique identifier for the endpoint/service
   * @returns Current timeout value or fallback
   */
  getCurrentTimeout(endpointKey: string): number {
    const stats = this.endpointStats.get(endpointKey);
    return stats ? stats.currentTimeout : this.config.fallbackTimeoutMs;
  }

  /**
   * Log message if logging is enabled
   * @param message Log message
   * @param data Additional data to log
   */
  private log(message: string, data?: any): void {
    if (this.config.enableLogging) {
      const timestamp = new Date().toISOString();
      if (data) {
        console.log(`[AdaptiveTimeout] ${timestamp} ${message}`, data);
      } else {
        console.log(`[AdaptiveTimeout] ${timestamp} ${message}`);
      }
    }
  }
}

/**
 * Create a shared instance for the application
 * This can be imported and used across different services
 */
export const sharedAdaptiveTimeoutManager = new AdaptiveTimeoutManager();

/**
 * Helper function that implements the exact algorithm from the problem statement
 * @param responseTimes Array of response times in milliseconds
 * @returns Calculated adaptive timeout
 */
export async function calculateAdaptiveTimeout(responseTimes: number[]): Promise<number> {
  if (responseTimes.length === 0) {
    return 30000; // Default 30 seconds
  }
  
  const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
  return Math.min(Math.max(averageResponseTime * 2, 30000), 120000); // Ensure timeout is between 30s and 120s
}