/**
 * Sync Configuration Manager
 * 
 * Administrative interface for managing dynamic synchronization intervals,
 * data type criticality mappings, and system-wide sync policies.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { 
  DynamicSyncConfigurationService,
  DynamicSyncIntervalConfig,
  DataCriticality
} from './dynamicSyncConfigurationService';
import { DataSyncService } from './dataSync';
import { RealTimeUpdateService } from './realTimeUpdateService';
import { SyncDataType } from '../types';

/**
 * System-wide sync policy configuration
 */
export interface SyncPolicyConfig {
  /** Global enable/disable for dynamic intervals */
  enableDynamicIntervals: boolean;
  /** Global enable/disable for adaptive adjustments */
  enableAdaptiveAdjustments: boolean;
  /** Maximum concurrent sync operations system-wide */
  maxConcurrentSyncs: number;
  /** Emergency override settings */
  emergencyOverride: {
    enabled: boolean;
    intervalMs: number;
    triggerConditions: string[];
  };
  /** Maintenance mode settings */
  maintenanceMode: {
    enabled: boolean;
    intervalMultiplier: number;
    restrictedDataTypes: SyncDataType[];
  };
}

/**
 * Administrative statistics for sync intervals
 */
export interface SyncIntervalStats {
  /** Data type statistics */
  dataTypeStats: Record<string, {
    averageInterval: number;
    minInterval: number;
    maxInterval: number;
    totalCalculations: number;
    criticality: DataCriticality;
  }>;
  /** System performance metrics */
  systemMetrics: {
    averageSystemLoad: number;
    totalSyncOperations: number;
    failureRate: number;
    adaptiveAdjustments: number;
  };
  /** Configuration effectiveness */
  effectiveness: {
    resourceUtilizationImprovement: number;
    criticalDataResponseTime: number;
    nonEssentialDataOptimization: number;
  };
}

/**
 * Sync Configuration Manager
 * 
 * Provides administrative interface for managing dynamic synchronization
 * intervals across the entire WebQX platform.
 */
export class SyncConfigurationManager {
  private dynamicSyncConfigs: Map<string, DynamicSyncConfigurationService> = new Map();
  private dataSyncServices: Map<string, DataSyncService> = new Map();
  private realTimeServices: Map<string, RealTimeUpdateService> = new Map();
  private systemPolicy: SyncPolicyConfig;
  private stats: SyncIntervalStats;

  constructor() {
    this.systemPolicy = this.getDefaultSyncPolicy();
    this.stats = this.initializeStats();
    
    this.logInfo('Sync Configuration Manager initialized');
  }

  // ============================================================================
  // Configuration Management
  // ============================================================================

  /**
   * Register a dynamic sync configuration service
   * @param serviceId Service identifier
   * @param service Dynamic sync configuration service
   */
  registerDynamicSyncService(serviceId: string, service: DynamicSyncConfigurationService): void {
    this.dynamicSyncConfigs.set(serviceId, service);
    this.logInfo('Dynamic sync service registered', { serviceId });
  }

  /**
   * Register a data sync service
   * @param serviceId Service identifier
   * @param service Data sync service
   */
  registerDataSyncService(serviceId: string, service: DataSyncService): void {
    this.dataSyncServices.set(serviceId, service);
    this.logInfo('Data sync service registered', { serviceId });
  }

  /**
   * Register a real-time update service
   * @param serviceId Service identifier
   * @param service Real-time update service
   */
  registerRealTimeService(serviceId: string, service: RealTimeUpdateService): void {
    this.realTimeServices.set(serviceId, service);
    this.logInfo('Real-time service registered', { serviceId });
  }

  /**
   * Update data type criticality across all services
   * @param dataType Data type to update
   * @param criticality New criticality level
   */
  updateGlobalDataTypeCriticality(dataType: string, criticality: DataCriticality): void {
    // Update all dynamic sync configurations
    for (const [serviceId, config] of this.dynamicSyncConfigs) {
      config.updateDataTypeCriticality(dataType, criticality);
      this.logInfo('Updated data type criticality in service', { serviceId, dataType, criticality });
    }

    // Update all data sync services
    for (const [serviceId, service] of this.dataSyncServices) {
      service.updateDataTypeCriticality(dataType, criticality);
    }

    this.logInfo('Global data type criticality updated', { dataType, criticality });
  }

  /**
   * Update base intervals across all services
   * @param intervals New base intervals
   */
  updateGlobalBaseIntervals(intervals: Partial<DynamicSyncIntervalConfig['baseIntervals']>): void {
    // Update all dynamic sync configurations
    for (const [serviceId, config] of this.dynamicSyncConfigs) {
      config.updateBaseIntervals(intervals);
    }

    // Update all data sync services
    for (const [serviceId, service] of this.dataSyncServices) {
      service.updateBaseSyncIntervals(intervals);
    }

    // Update all real-time services
    for (const [serviceId, service] of this.realTimeServices) {
      service.updateDynamicPollingConfig({ baseIntervals: intervals });
    }

    this.logInfo('Global base intervals updated', { intervals });
  }

  /**
   * Enable or disable dynamic intervals globally
   * @param enabled Whether to enable dynamic intervals
   */
  setGlobalDynamicIntervalsEnabled(enabled: boolean): void {
    this.systemPolicy.enableDynamicIntervals = enabled;

    // Update all data sync services
    for (const [serviceId, service] of this.dataSyncServices) {
      service.setDynamicIntervalsEnabled(enabled);
    }

    // Update all real-time services
    for (const [serviceId, service] of this.realTimeServices) {
      service.setDynamicPollingEnabled(enabled);
    }

    this.logInfo('Global dynamic intervals setting changed', { enabled });
  }

  /**
   * Enable or disable adaptive adjustments globally
   * @param enabled Whether to enable adaptive adjustments
   */
  setGlobalAdaptiveAdjustmentsEnabled(enabled: boolean): void {
    this.systemPolicy.enableAdaptiveAdjustments = enabled;

    // Update all dynamic sync configurations
    for (const [serviceId, config] of this.dynamicSyncConfigs) {
      config.setAdaptiveAdjustmentEnabled(enabled);
    }

    this.logInfo('Global adaptive adjustments setting changed', { enabled });
  }

  // ============================================================================
  // Emergency and Maintenance Mode
  // ============================================================================

  /**
   * Enable emergency mode with minimal intervals for critical data
   * @param conditions Conditions that triggered emergency mode
   */
  enableEmergencyMode(conditions: string[] = []): void {
    this.systemPolicy.emergencyOverride.enabled = true;
    this.systemPolicy.emergencyOverride.triggerConditions = conditions;

    // Set very short intervals for critical data
    this.updateGlobalBaseIntervals({
      critical: 1000, // 1 second
      default: 5000,  // 5 seconds
      nonEssential: 30000 // 30 seconds (still optimized)
    });

    this.logInfo('Emergency mode enabled', { conditions });
  }

  /**
   * Disable emergency mode and restore normal intervals
   */
  disableEmergencyMode(): void {
    this.systemPolicy.emergencyOverride.enabled = false;

    // Restore default intervals
    this.updateGlobalBaseIntervals({
      critical: 5000,    // 5 seconds
      default: 30000,    // 30 seconds
      nonEssential: 60000 // 60 seconds
    });

    this.logInfo('Emergency mode disabled');
  }

  /**
   * Enable maintenance mode with extended intervals
   * @param intervalMultiplier Factor to multiply intervals by
   * @param restrictedDataTypes Data types to restrict during maintenance
   */
  enableMaintenanceMode(intervalMultiplier: number = 2.0, restrictedDataTypes: SyncDataType[] = []): void {
    this.systemPolicy.maintenanceMode.enabled = true;
    this.systemPolicy.maintenanceMode.intervalMultiplier = intervalMultiplier;
    this.systemPolicy.maintenanceMode.restrictedDataTypes = restrictedDataTypes;

    // Extend intervals during maintenance
    this.updateGlobalBaseIntervals({
      critical: 10000 * intervalMultiplier,     // Extended but still responsive
      default: 60000 * intervalMultiplier,      // Significantly extended
      nonEssential: 300000 * intervalMultiplier // Very extended
    });

    this.logInfo('Maintenance mode enabled', { intervalMultiplier, restrictedDataTypes });
  }

  /**
   * Disable maintenance mode and restore normal intervals
   */
  disableMaintenanceMode(): void {
    this.systemPolicy.maintenanceMode.enabled = false;

    // Restore default intervals
    this.updateGlobalBaseIntervals({
      critical: 5000,
      default: 30000,
      nonEssential: 60000
    });

    this.logInfo('Maintenance mode disabled');
  }

  // ============================================================================
  // Statistics and Monitoring
  // ============================================================================

  /**
   * Get comprehensive sync interval statistics
   * @returns Current sync interval statistics
   */
  getSyncIntervalStats(): SyncIntervalStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Get current system policy configuration
   * @returns Current sync policy configuration
   */
  getSystemPolicy(): SyncPolicyConfig {
    return { ...this.systemPolicy };
  }

  /**
   * Get configuration for all registered services
   * @returns Map of service configurations
   */
  getAllServiceConfigurations(): Record<string, any> {
    const configurations: Record<string, any> = {};

    for (const [serviceId, config] of this.dynamicSyncConfigs) {
      configurations[`dynamic_${serviceId}`] = config.getConfiguration();
    }

    for (const [serviceId, service] of this.dataSyncServices) {
      configurations[`data_${serviceId}`] = service.getDynamicSyncConfiguration();
    }

    return configurations;
  }

  /**
   * Export current configuration for backup/restore
   * @returns Serializable configuration object
   */
  exportConfiguration(): any {
    return {
      systemPolicy: this.systemPolicy,
      serviceConfigurations: this.getAllServiceConfigurations(),
      exportTimestamp: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  /**
   * Import configuration from backup
   * @param config Configuration object to import
   */
  importConfiguration(config: any): void {
    if (config.systemPolicy) {
      this.systemPolicy = { ...config.systemPolicy };
    }

    // Apply imported configurations to services
    if (config.serviceConfigurations) {
      // This would require implementing import methods on individual services
      this.logInfo('Configuration import completed', { 
        version: config.version,
        timestamp: config.exportTimestamp
      });
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Get default sync policy configuration
   * @returns Default sync policy
   */
  private getDefaultSyncPolicy(): SyncPolicyConfig {
    return {
      enableDynamicIntervals: true,
      enableAdaptiveAdjustments: true,
      maxConcurrentSyncs: 10,
      emergencyOverride: {
        enabled: false,
        intervalMs: 1000,
        triggerConditions: []
      },
      maintenanceMode: {
        enabled: false,
        intervalMultiplier: 2.0,
        restrictedDataTypes: []
      }
    };
  }

  /**
   * Initialize statistics structure
   * @returns Initial statistics object
   */
  private initializeStats(): SyncIntervalStats {
    return {
      dataTypeStats: {},
      systemMetrics: {
        averageSystemLoad: 0,
        totalSyncOperations: 0,
        failureRate: 0,
        adaptiveAdjustments: 0
      },
      effectiveness: {
        resourceUtilizationImprovement: 0,
        criticalDataResponseTime: 0,
        nonEssentialDataOptimization: 0
      }
    };
  }

  /**
   * Update statistics from all registered services
   */
  private updateStats(): void {
    // This would collect statistics from all registered services
    // For now, we'll update with mock data to demonstrate the structure
    
    let totalOperations = 0;
    let totalFailures = 0;

    // Aggregate data from all services
    for (const [serviceId, service] of this.dataSyncServices) {
      // In a real implementation, this would query service statistics
      totalOperations += 100; // Mock data
    }

    this.stats.systemMetrics.totalSyncOperations = totalOperations;
    this.stats.systemMetrics.failureRate = totalOperations > 0 ? totalFailures / totalOperations : 0;
  }

  /**
   * Log info message
   * @param message Info message
   * @param context Additional context
   */
  private logInfo(message: string, context?: Record<string, unknown>): void {
    console.log(`[Sync Config Manager] ${message}`, context || {});
  }
}

/**
 * Global sync configuration manager instance
 */
export const globalSyncConfigManager = new SyncConfigurationManager();

/**
 * Helper function to create a new sync configuration manager
 * @returns New sync configuration manager instance
 */
export function createSyncConfigurationManager(): SyncConfigurationManager {
  return new SyncConfigurationManager();
}

export default SyncConfigurationManager;