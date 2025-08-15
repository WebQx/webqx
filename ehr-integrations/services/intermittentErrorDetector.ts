/**
 * Intermittent Error Detector Service
 * 
 * Analyzes error patterns to identify intermittent vs persistent errors
 * and provides recommendations for dynamic threshold and recovery time adjustments.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

export interface ErrorOccurrence {
  timestamp: Date;
  errorCode: string;
  errorType: string;
  module: string;
  isRetryable: boolean;
  recoveryTimeMs?: number;
}

export interface ErrorPattern {
  errorCode: string;
  module: string;
  totalOccurrences: number;
  successfulRetries: number;
  averageRecoveryTime: number;
  isIntermittent: boolean;
  confidence: number; // 0-1 scale
  lastOccurrence: Date;
  pattern: 'sporadic' | 'burst' | 'consistent' | 'unknown';
}

export interface DynamicThresholdRecommendation {
  currentThreshold: number;
  recommendedThreshold: number;
  currentRecoveryTime: number;
  recommendedRecoveryTime: number;
  reason: string;
  confidence: number;
}

export interface IntermittentErrorDetectorConfig {
  /** Time window for error pattern analysis (milliseconds) */
  analysisWindowMs: number;
  /** Minimum number of errors needed to establish a pattern */
  minErrorsForPattern: number;
  /** Threshold for considering errors as intermittent (successful recovery rate) */
  intermittentThreshold: number;
  /** Maximum threshold multiplier for intermittent errors */
  maxThresholdMultiplier: number;
  /** Minimum recovery time reduction factor */
  minRecoveryReduction: number;
  /** Maximum number of error patterns to track */
  maxPatterns: number;
}

/**
 * Service for detecting intermittent error patterns and providing dynamic adjustment recommendations
 */
export class IntermittentErrorDetector {
  private config: Required<IntermittentErrorDetectorConfig>;
  private errorHistory: Map<string, ErrorOccurrence[]> = new Map();
  private errorPatterns: Map<string, ErrorPattern> = new Map();

  constructor(config: Partial<IntermittentErrorDetectorConfig> = {}) {
    this.config = {
      analysisWindowMs: config.analysisWindowMs || 300000, // 5 minutes
      minErrorsForPattern: config.minErrorsForPattern || 3,
      intermittentThreshold: config.intermittentThreshold || 0.7, // 70% recovery rate
      maxThresholdMultiplier: config.maxThresholdMultiplier || 3.0,
      minRecoveryReduction: config.minRecoveryReduction || 0.3, // 30% reduction
      maxPatterns: config.maxPatterns || 100
    };
  }

  /**
   * Record an error occurrence
   */
  recordError(error: ErrorOccurrence): void {
    const key = this.getErrorKey(error.errorCode, error.module);
    
    if (!this.errorHistory.has(key)) {
      this.errorHistory.set(key, []);
    }
    
    const history = this.errorHistory.get(key)!;
    history.push(error);
    
    // Keep only errors within the analysis window
    const cutoffTime = new Date(Date.now() - this.config.analysisWindowMs);
    const filteredHistory = history.filter(e => e.timestamp >= cutoffTime);
    this.errorHistory.set(key, filteredHistory);
    
    // Update error pattern if we have enough data
    if (filteredHistory.length >= this.config.minErrorsForPattern) {
      this.updateErrorPattern(key, filteredHistory);
    }
    
    // Cleanup old patterns if we exceed the limit
    this.cleanupOldPatterns();
  }

  /**
   * Record a successful recovery from an error
   */
  recordRecovery(errorCode: string, module: string, recoveryTimeMs: number): void {
    const key = this.getErrorKey(errorCode, module);
    const history = this.errorHistory.get(key);
    
    if (history && history.length > 0) {
      // Find the most recent error of this type that doesn't have a recovery time
      for (let i = history.length - 1; i >= 0; i--) {
        if (!history[i].recoveryTimeMs) {
          history[i].recoveryTimeMs = recoveryTimeMs;
          break;
        }
      }
      
      // Update the pattern with this recovery information
      this.updateErrorPattern(key, history);
    }
  }

  /**
   * Get error pattern for a specific error type and module
   */
  getErrorPattern(errorCode: string, module: string): ErrorPattern | undefined {
    const key = this.getErrorKey(errorCode, module);
    return this.errorPatterns.get(key);
  }

  /**
   * Get all current error patterns
   */
  getAllErrorPatterns(): ErrorPattern[] {
    return Array.from(this.errorPatterns.values());
  }

  /**
   * Get dynamic threshold recommendation for a specific error type
   */
  getThresholdRecommendation(
    errorCode: string, 
    module: string, 
    currentThreshold: number, 
    currentRecoveryTime: number
  ): DynamicThresholdRecommendation | undefined {
    const pattern = this.getErrorPattern(errorCode, module);
    
    if (!pattern) {
      return undefined;
    }
    
    let recommendedThreshold = currentThreshold;
    let recommendedRecoveryTime = currentRecoveryTime;
    let reason = '';
    let confidence = pattern.confidence;
    
    if (pattern.isIntermittent) {
      // For intermittent errors, increase threshold and reduce recovery time
      const thresholdMultiplier = Math.min(
        1 + (pattern.successfulRetries / pattern.totalOccurrences),
        this.config.maxThresholdMultiplier
      );
      
      recommendedThreshold = Math.ceil(currentThreshold * thresholdMultiplier);
      
      // Reduce recovery time based on average recovery time and pattern confidence
      const reductionFactor = Math.max(
        this.config.minRecoveryReduction,
        1 - (pattern.confidence * 0.7) // Up to 70% reduction for high confidence
      );
      
      recommendedRecoveryTime = Math.max(
        Math.floor(currentRecoveryTime * reductionFactor),
        pattern.averageRecoveryTime || 1000 // Don't go below average recovery time
      );
      
      reason = `Intermittent error pattern detected (${pattern.pattern}, ${Math.round(pattern.confidence * 100)}% confidence). ` +
               `Success rate: ${Math.round((pattern.successfulRetries / pattern.totalOccurrences) * 100)}%`;
    } else {
      // For persistent errors, consider reducing threshold if recovery rate is very low
      if (pattern.successfulRetries / pattern.totalOccurrences < 0.2) {
        recommendedThreshold = Math.max(1, Math.floor(currentThreshold * 0.8));
        reason = `Persistent error pattern detected with low recovery rate (${Math.round((pattern.successfulRetries / pattern.totalOccurrences) * 100)}%)`;
      } else {
        // No recommendation for persistent errors with reasonable recovery
        return undefined;
      }
    }
    
    return {
      currentThreshold,
      recommendedThreshold,
      currentRecoveryTime,
      recommendedRecoveryTime,
      reason,
      confidence
    };
  }

  /**
   * Check if an error should be considered intermittent
   */
  isIntermittentError(errorCode: string, module: string): boolean {
    const pattern = this.getErrorPattern(errorCode, module);
    return pattern?.isIntermittent ?? false;
  }

  /**
   * Get statistics for monitoring and debugging
   */
  getStatistics(): {
    totalPatterns: number;
    intermittentPatterns: number;
    persistentPatterns: number;
    totalErrorsTracked: number;
    averageConfidence: number;
  } {
    const patterns = Array.from(this.errorPatterns.values());
    const intermittentCount = patterns.filter(p => p.isIntermittent).length;
    const totalErrors = Array.from(this.errorHistory.values())
      .reduce((sum, history) => sum + history.length, 0);
    const avgConfidence = patterns.length > 0 
      ? patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length
      : 0;
    
    return {
      totalPatterns: patterns.length,
      intermittentPatterns: intermittentCount,
      persistentPatterns: patterns.length - intermittentCount,
      totalErrorsTracked: totalErrors,
      averageConfidence: avgConfidence
    };
  }

  /**
   * Clear all patterns and history (useful for testing)
   */
  reset(): void {
    this.errorHistory.clear();
    this.errorPatterns.clear();
  }

  // Private helper methods

  private getErrorKey(errorCode: string, module: string): string {
    return `${module}:${errorCode}`;
  }

  private updateErrorPattern(key: string, history: ErrorOccurrence[]): void {
    const [module, errorCode] = key.split(':');
    const totalOccurrences = history.length;
    const successfulRetries = history.filter(e => e.recoveryTimeMs !== undefined).length;
    
    // Calculate average recovery time for successful recoveries
    const recoveryTimes = history
      .filter(e => e.recoveryTimeMs !== undefined)
      .map(e => e.recoveryTimeMs!);
    const averageRecoveryTime = recoveryTimes.length > 0
      ? recoveryTimes.reduce((sum, time) => sum + time, 0) / recoveryTimes.length
      : 0;
    
    // Determine if this is an intermittent error
    const successRate = successfulRetries / totalOccurrences;
    const isIntermittent = successRate >= this.config.intermittentThreshold;
    
    // Analyze temporal pattern
    const pattern = this.analyzeTemporalPattern(history);
    
    // Calculate confidence based on number of samples and consistency
    const confidence = Math.min(
      totalOccurrences / (this.config.minErrorsForPattern * 3), // More samples = higher confidence
      1.0
    );
    
    this.errorPatterns.set(key, {
      errorCode,
      module,
      totalOccurrences,
      successfulRetries,
      averageRecoveryTime,
      isIntermittent,
      confidence,
      lastOccurrence: history[history.length - 1].timestamp,
      pattern
    });
  }

  private analyzeTemporalPattern(history: ErrorOccurrence[]): 'sporadic' | 'burst' | 'consistent' | 'unknown' {
    if (history.length < 3) return 'unknown';
    
    // Calculate time intervals between errors
    const intervals: number[] = [];
    for (let i = 1; i < history.length; i++) {
      intervals.push(history[i].timestamp.getTime() - history[i - 1].timestamp.getTime());
    }
    
    // Calculate coefficient of variation to measure interval consistency
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    
    // Avoid division by zero
    if (avgInterval === 0) return 'burst';
    
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
    const coefficientOfVariation = Math.sqrt(variance) / avgInterval;
    
    // Classify pattern based on interval characteristics
    if (coefficientOfVariation > 1.5) {
      return 'sporadic'; // High variation in timing
    } else if (avgInterval < 30000) { // Less than 30 seconds between errors
      return 'burst'; // Errors happening in quick succession
    } else if (coefficientOfVariation < 0.5) {
      return 'consistent'; // Regular pattern
    } else {
      return 'unknown';
    }
  }

  private cleanupOldPatterns(): void {
    if (this.errorPatterns.size <= this.config.maxPatterns) return;
    
    // Remove patterns that haven't had recent errors
    const cutoffTime = new Date(Date.now() - this.config.analysisWindowMs * 2);
    const patternsToRemove: string[] = [];
    
    for (const [key, pattern] of this.errorPatterns.entries()) {
      if (pattern.lastOccurrence < cutoffTime) {
        patternsToRemove.push(key);
      }
    }
    
    patternsToRemove.forEach(key => {
      this.errorPatterns.delete(key);
      this.errorHistory.delete(key);
    });
  }
}

export default IntermittentErrorDetector;