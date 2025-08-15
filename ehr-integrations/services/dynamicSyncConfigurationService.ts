/**
 * Dynamic Sync Configuration Service
 * 
 * Manages dynamic synchronization intervals for critical and non-essential data.
 * Provides intelligent interval adjustment based on data type criticality,
 * system load, and administrative configurations.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { SyncDataType } from '../types';

/**
 * Data criticality levels for sync interval determination
 */
export type DataCriticality = 'critical' | 'non-essential' | 'default';

/**
 * Dynamic sync interval configuration
 */
export interface DynamicSyncIntervalConfig {
  /** Base intervals for different criticality levels (in milliseconds) */
  baseIntervals: {
    critical: number;
    nonEssential: number;
    default: number;
  };
  /** Whether to enable adaptive interval adjustment based on system load */
  enableAdaptiveAdjustment: boolean;
  /** Maximum allowed interval (safety limit) */
  maxInterval: number;
  /** Minimum allowed interval (safety limit) */
  minInterval: number;
  /** Custom data type to criticality mappings */
  dataTypeMappings: Record<string, DataCriticality>;
  /** Enable logging of interval adjustments */
  enableLogging: boolean;
}

/**
 * Sync interval calculation context
 */
export interface SyncIntervalContext {
  /** Data type being synchronized */
  dataType: SyncDataType;
  /** Current system load factor (0.0 to 1.0) */
  systemLoad?: number;
  /** Patient criticality level (for patient-specific data) */
  patientCriticality?: 'high' | 'medium' | 'low';
  /** Time since last successful sync */
  timeSinceLastSync?: number;
  /** Number of recent failures */
  recentFailures?: number;
  /** Custom context parameters */
  customParams?: Record<string, unknown>;
}

/**
 * Sync interval adjustment result
 */
export interface SyncIntervalResult {
  /** Calculated interval in milliseconds */
  intervalMs: number;
  /** Criticality level used for calculation */
  criticality: DataCriticality;
  /** Factors that influenced the calculation */
  adjustmentFactors: {
    baseCriticality: number;
    systemLoadFactor: number;
    patientCriticalityFactor: number;
    failureBackoffFactor: number;
    customFactors: Record<string, number>;
  };
  /** Reason for the interval adjustment */
  adjustmentReason: string;
}

/**
 * Default data type criticality mappings
 */
const DEFAULT_DATA_TYPE_MAPPINGS: Record<string, DataCriticality> = {
  // Critical data types - require frequent updates
  'vitals': 'critical',
  'medications': 'critical',
  'allergies': 'critical',
  'lab_results': 'critical',
  'diagnoses': 'critical',
  'encounters': 'critical',
  
  // Non-essential data types - can tolerate longer intervals
  'procedures': 'non-essential',
  'care_plans': 'non-essential',
  'demographics': 'non-essential',
  'appointments': 'non-essential',
  'insurance': 'non-essential',
  'billing': 'non-essential',
  
  // Default for unknown types
  'all': 'default'
};

/**
 * Dynamic Sync Configuration Service
 * 
 * Manages dynamic interval calculation for data synchronization based on
 * criticality levels, system conditions, and administrative settings.
 */
export class DynamicSyncConfigurationService {
  private config: Required<DynamicSyncIntervalConfig>;
  private intervalAdjustmentHistory: Map<string, SyncIntervalResult[]> = new Map();

  /**
   * Constructor
   * @param config Dynamic sync configuration options
   */
  constructor(config: Partial<DynamicSyncIntervalConfig> = {}) {
    this.config = {
      baseIntervals: {
        critical: config.baseIntervals?.critical || 5000, // 5 seconds
        nonEssential: config.baseIntervals?.nonEssential || 60000, // 60 seconds
        default: config.baseIntervals?.default || 30000 // 30 seconds
      },
      enableAdaptiveAdjustment: config.enableAdaptiveAdjustment ?? true,
      maxInterval: config.maxInterval || 300000, // 5 minutes
      minInterval: config.minInterval || 1000, // 1 second
      dataTypeMappings: {
        ...DEFAULT_DATA_TYPE_MAPPINGS,
        ...config.dataTypeMappings
      },
      enableLogging: config.enableLogging ?? true
    };

    this.logInfo('Dynamic Sync Configuration Service initialized', {
      baseIntervals: this.config.baseIntervals,
      adaptiveEnabled: this.config.enableAdaptiveAdjustment
    });
  }

  /**
   * Calculate dynamic sync interval for given context
   * @param context Sync interval calculation context
   * @returns Calculated sync interval result
   */
  calculateSyncInterval(context: SyncIntervalContext): SyncIntervalResult {
    // Determine data criticality
    const criticality = this.getDataTypeCriticality(context.dataType);
    
    // Get base interval for criticality level
    let intervalMs = this.getBaseInterval(criticality);
    
    // Initialize adjustment factors
    const adjustmentFactors = {
      baseCriticality: 1.0,
      systemLoadFactor: 1.0,
      patientCriticalityFactor: 1.0,
      failureBackoffFactor: 1.0,
      customFactors: {} as Record<string, number>
    };

    let adjustmentReason = `Base interval for ${criticality} data`;

    // Apply adaptive adjustments if enabled
    if (this.config.enableAdaptiveAdjustment) {
      // System load adjustment
      if (context.systemLoad !== undefined) {
        const loadFactor = this.calculateSystemLoadFactor(context.systemLoad);
        adjustmentFactors.systemLoadFactor = loadFactor;
        intervalMs *= loadFactor;
        
        if (loadFactor !== 1.0) {
          adjustmentReason += `, system load factor: ${loadFactor.toFixed(2)}`;
        }
      }

      // Patient criticality adjustment
      if (context.patientCriticality) {
        const patientFactor = this.calculatePatientCriticalityFactor(context.patientCriticality);
        adjustmentFactors.patientCriticalityFactor = patientFactor;
        intervalMs *= patientFactor;
        
        if (patientFactor !== 1.0) {
          adjustmentReason += `, patient criticality factor: ${patientFactor.toFixed(2)}`;
        }
      }

      // Failure backoff adjustment
      if (context.recentFailures && context.recentFailures > 0) {
        const backoffFactor = this.calculateFailureBackoffFactor(context.recentFailures);
        adjustmentFactors.failureBackoffFactor = backoffFactor;
        intervalMs *= backoffFactor;
        
        adjustmentReason += `, failure backoff factor: ${backoffFactor.toFixed(2)}`;
      }

      // Custom parameter adjustments
      if (context.customParams) {
        const customAdjustments = this.calculateCustomAdjustments(context.customParams);
        Object.assign(adjustmentFactors.customFactors, customAdjustments);
        
        for (const [param, factor] of Object.entries(customAdjustments)) {
          intervalMs *= factor;
          if (factor !== 1.0) {
            adjustmentReason += `, ${param}: ${factor.toFixed(2)}`;
          }
        }
      }
    }

    // Apply safety limits
    intervalMs = Math.max(this.config.minInterval, Math.min(this.config.maxInterval, intervalMs));
    intervalMs = Math.round(intervalMs);

    const result: SyncIntervalResult = {
      intervalMs,
      criticality,
      adjustmentFactors,
      adjustmentReason
    };

    // Store in history for analysis
    this.storeIntervalAdjustment(context.dataType, result);

    // Log adjustment if enabled
    if (this.config.enableLogging) {
      this.logInfo('Sync interval calculated', {
        dataType: context.dataType,
        intervalMs,
        criticality,
        adjustmentReason
      });
    }

    return result;
  }

  /**
   * Get criticality level for a data type
   * @param dataType Data type to check
   * @returns Criticality level
   */
  getDataTypeCriticality(dataType: SyncDataType): DataCriticality {
    return this.config.dataTypeMappings[dataType] || 
           this.config.dataTypeMappings['all'] || 
           'default';
  }

  /**
   * Update data type criticality mapping
   * @param dataType Data type
   * @param criticality New criticality level
   */
  updateDataTypeCriticality(dataType: string, criticality: DataCriticality): void {
    this.config.dataTypeMappings[dataType] = criticality;
    
    this.logInfo('Data type criticality updated', {
      dataType,
      criticality
    });
  }

  /**
   * Update base intervals for criticality levels
   * @param intervals New base intervals
   */
  updateBaseIntervals(intervals: Partial<DynamicSyncIntervalConfig['baseIntervals']>): void {
    Object.assign(this.config.baseIntervals, intervals);
    
    this.logInfo('Base intervals updated', {
      newIntervals: this.config.baseIntervals
    });
  }

  /**
   * Get interval adjustment history for a data type
   * @param dataType Data type
   * @param limit Maximum number of history entries to return
   * @returns Array of interval adjustment results
   */
  getIntervalHistory(dataType: SyncDataType, limit: number = 10): SyncIntervalResult[] {
    const history = this.intervalAdjustmentHistory.get(dataType) || [];
    return history.slice(-limit);
  }

  /**
   * Get current configuration
   * @returns Current dynamic sync configuration
   */
  getConfiguration(): Required<DynamicSyncIntervalConfig> {
    return { ...this.config };
  }

  /**
   * Enable or disable adaptive adjustment
   * @param enabled Whether to enable adaptive adjustment
   */
  setAdaptiveAdjustmentEnabled(enabled: boolean): void {
    this.config.enableAdaptiveAdjustment = enabled;
    
    this.logInfo('Adaptive adjustment setting changed', { enabled });
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Get base interval for criticality level
   * @param criticality Criticality level
   * @returns Base interval in milliseconds
   */
  private getBaseInterval(criticality: DataCriticality): number {
    switch (criticality) {
      case 'critical':
        return this.config.baseIntervals.critical;
      case 'non-essential':
        return this.config.baseIntervals.nonEssential;
      case 'default':
      default:
        return this.config.baseIntervals.default;
    }
  }

  /**
   * Calculate system load factor for interval adjustment
   * @param systemLoad System load (0.0 to 1.0)
   * @returns Adjustment factor
   */
  private calculateSystemLoadFactor(systemLoad: number): number {
    // Higher system load increases intervals to reduce pressure
    // Load 0.0-0.5: no adjustment (factor 1.0)
    // Load 0.5-0.8: slight increase (factor 1.0-1.5)
    // Load 0.8-1.0: significant increase (factor 1.5-2.0)
    
    if (systemLoad <= 0.5) {
      return 1.0;
    } else if (systemLoad <= 0.8) {
      return 1.0 + (systemLoad - 0.5) * 1.67; // Linear from 1.0 to 1.5
    } else {
      return 1.5 + (systemLoad - 0.8) * 2.5; // Linear from 1.5 to 2.0
    }
  }

  /**
   * Calculate patient criticality factor for interval adjustment
   * @param patientCriticality Patient criticality level
   * @returns Adjustment factor
   */
  private calculatePatientCriticalityFactor(patientCriticality: 'high' | 'medium' | 'low'): number {
    switch (patientCriticality) {
      case 'high':
        return 0.5; // Reduce interval by 50% for high-priority patients
      case 'medium':
        return 0.8; // Reduce interval by 20% for medium-priority patients
      case 'low':
        return 1.2; // Increase interval by 20% for low-priority patients
      default:
        return 1.0;
    }
  }

  /**
   * Calculate failure backoff factor for interval adjustment
   * @param recentFailures Number of recent failures
   * @returns Adjustment factor
   */
  private calculateFailureBackoffFactor(recentFailures: number): number {
    // Exponential backoff with a cap
    // 1 failure: 1.5x interval
    // 2 failures: 2.0x interval
    // 3+ failures: 3.0x interval (capped)
    
    const factor = Math.min(3.0, 1.0 + (recentFailures * 0.5));
    return factor;
  }

  /**
   * Calculate custom adjustments from context parameters
   * @param customParams Custom parameters
   * @returns Adjustment factors
   */
  private calculateCustomAdjustments(customParams: Record<string, unknown>): Record<string, number> {
    const adjustments: Record<string, number> = {};

    // Example custom adjustments - these can be extended based on specific needs
    if (typeof customParams.urgency === 'string') {
      switch (customParams.urgency) {
        case 'emergency':
          adjustments.urgency = 0.2; // Very fast updates
          break;
        case 'urgent':
          adjustments.urgency = 0.5; // Fast updates
          break;
        case 'routine':
          adjustments.urgency = 1.5; // Slower updates
          break;
        default:
          adjustments.urgency = 1.0;
      }
    }

    if (typeof customParams.dataSize === 'number') {
      // Larger data sets get longer intervals
      const sizeInMB = customParams.dataSize;
      if (sizeInMB > 10) {
        adjustments.dataSize = 1.5;
      } else if (sizeInMB > 50) {
        adjustments.dataSize = 2.0;
      }
    }

    return adjustments;
  }

  /**
   * Store interval adjustment in history
   * @param dataType Data type
   * @param result Interval calculation result
   */
  private storeIntervalAdjustment(dataType: SyncDataType, result: SyncIntervalResult): void {
    const history = this.intervalAdjustmentHistory.get(dataType) || [];
    history.push(result);
    
    // Keep only last 50 entries per data type
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
    
    this.intervalAdjustmentHistory.set(dataType, history);
  }

  /**
   * Log info message
   * @param message Info message
   * @param context Additional context
   */
  private logInfo(message: string, context?: Record<string, unknown>): void {
    console.log(`[Dynamic Sync Config] ${message}`, context || {});
  }
}

/**
 * Default instance of Dynamic Sync Configuration Service
 */
export const defaultDynamicSyncConfig = new DynamicSyncConfigurationService();

/**
 * Factory function to create a new Dynamic Sync Configuration Service
 * @param config Configuration options
 * @returns New service instance
 */
export function createDynamicSyncConfigService(config?: Partial<DynamicSyncIntervalConfig>): DynamicSyncConfigurationService {
  return new DynamicSyncConfigurationService(config);
}

export default DynamicSyncConfigurationService;