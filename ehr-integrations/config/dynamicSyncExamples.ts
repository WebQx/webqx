/**
 * Dynamic Sync Configuration Examples
 * 
 * Example configurations for different healthcare environments and use cases.
 * These examples demonstrate how to configure dynamic synchronization intervals
 * for optimal system performance and responsiveness.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { 
  DynamicSyncConfigurationService,
  DynamicSyncIntervalConfig
} from '../services/dynamicSyncConfigurationService';
import { DataSyncService, SyncConfiguration } from '../services/dataSync';
import { RealTimeUpdateService, RealTimeServiceConfig } from '../services/realTimeUpdateService';
import { SyncConfigurationManager } from '../services/syncConfigurationManager';

// ============================================================================
// Production Hospital Environment
// ============================================================================

/**
 * Configuration for large hospital with high patient volume
 */
export const hospitalProductionConfig: DynamicSyncIntervalConfig = {
  baseIntervals: {
    critical: 3000,    // 3 seconds - very responsive for critical data
    nonEssential: 120000, // 2 minutes - conservative for non-essential
    default: 30000     // 30 seconds - balanced default
  },
  enableAdaptiveAdjustment: true,
  maxInterval: 600000, // 10 minutes maximum
  minInterval: 1000,   // 1 second minimum
  dataTypeMappings: {
    // Critical patient data
    'vitals': 'critical',
    'medications': 'critical',
    'allergies': 'critical',
    'lab_results': 'critical',
    'diagnoses': 'critical',
    'encounters': 'critical',
    
    // Non-essential administrative data
    'demographics': 'non-essential',
    'insurance': 'non-essential',
    'billing': 'non-essential',
    'appointments': 'default', // Moderate priority
    'procedures': 'default',
    'care_plans': 'default',
    
    // Emergency override
    'emergency_alerts': 'critical'
  },
  enableLogging: true
};

/**
 * Data sync service for hospital production
 */
export const hospitalDataSyncConfig: Partial<SyncConfiguration> = {
  enableDynamicIntervals: true,
  dynamicIntervalConfig: hospitalProductionConfig,
  maxConcurrentSyncs: 8,
  syncTimeoutMs: 300000,
  enableAutoRetry: true,
  maxRetryAttempts: 3,
  enableConflictResolution: true,
  conflictResolutionStrategy: 'most_recent'
};

/**
 * Real-time service for hospital production
 */
export const hospitalRealTimeConfig: RealTimeServiceConfig = {
  enableWebSocket: true,
  enableDynamicPolling: true,
  pollingInterval: 15000, // 15 seconds default
  dynamicPollingConfig: {
    baseIntervals: {
      critical: 5000,    // 5 seconds for critical real-time data
      nonEssential: 60000, // 1 minute for non-essential
      default: 15000     // 15 seconds default
    },
    enableAdaptiveAdjustment: true,
    dataTypeMappings: {
      // Real-time critical events
      'observation_added': 'critical',
      'medication_prescribed': 'critical',
      'appointment_booked': 'critical',
      'appointment_cancelled': 'critical',
      'error_occurred': 'critical',
      
      // Less critical events
      'resource_created': 'non-essential',
      'resource_updated': 'default',
      'sync_completed': 'non-essential'
    }
  }
};

// ============================================================================
// Clinic/Small Practice Environment
// ============================================================================

/**
 * Configuration for small clinic with limited resources
 */
export const clinicConfig: DynamicSyncIntervalConfig = {
  baseIntervals: {
    critical: 10000,   // 10 seconds - still responsive but conservative
    nonEssential: 300000, // 5 minutes - very conservative
    default: 60000     // 1 minute - balanced for smaller scale
  },
  enableAdaptiveAdjustment: true,
  maxInterval: 900000, // 15 minutes maximum
  minInterval: 5000,   // 5 seconds minimum
  dataTypeMappings: {
    // Focus on essential clinical data
    'vitals': 'critical',
    'medications': 'critical',
    'allergies': 'critical',
    'encounters': 'critical',
    
    // Everything else is non-essential for small clinic
    'demographics': 'non-essential',
    'insurance': 'non-essential',
    'billing': 'non-essential',
    'lab_results': 'default',
    'procedures': 'non-essential',
    'care_plans': 'non-essential',
    'appointments': 'default'
  },
  enableLogging: false // Reduce logging overhead for smaller systems
};

/**
 * Data sync service for clinic
 */
export const clinicDataSyncConfig: Partial<SyncConfiguration> = {
  enableDynamicIntervals: true,
  dynamicIntervalConfig: clinicConfig,
  maxConcurrentSyncs: 2, // Limited concurrency for small systems
  syncTimeoutMs: 600000, // Longer timeout for slower systems
  enableAutoRetry: true,
  maxRetryAttempts: 2,
  enableConflictResolution: true,
  conflictResolutionStrategy: 'source_wins' // Simpler conflict resolution
};

// ============================================================================
// Emergency Department Configuration
// ============================================================================

/**
 * Configuration optimized for emergency department with critical time requirements
 */
export const emergencyDeptConfig: DynamicSyncIntervalConfig = {
  baseIntervals: {
    critical: 1000,    // 1 second - maximum responsiveness
    nonEssential: 60000,  // 1 minute - still frequent for ED environment
    default: 10000     // 10 seconds - fast default
  },
  enableAdaptiveAdjustment: true,
  maxInterval: 120000, // 2 minutes maximum
  minInterval: 500,    // 500ms minimum for emergency situations
  dataTypeMappings: {
    // Everything is more critical in ED
    'vitals': 'critical',
    'medications': 'critical',
    'allergies': 'critical',
    'lab_results': 'critical',
    'diagnoses': 'critical',
    'encounters': 'critical',
    'procedures': 'critical',
    
    // Only administrative data is non-essential
    'demographics': 'default',
    'insurance': 'non-essential',
    'billing': 'non-essential',
    'appointments': 'default',
    'care_plans': 'default'
  },
  enableLogging: true
};

// ============================================================================
// Telehealth/Remote Configuration
// ============================================================================

/**
 * Configuration for telehealth with network considerations
 */
export const telehealthConfig: DynamicSyncIntervalConfig = {
  baseIntervals: {
    critical: 15000,   // 15 seconds - account for network latency
    nonEssential: 600000, // 10 minutes - very conservative for remote
    default: 60000     // 1 minute - account for variable connectivity
  },
  enableAdaptiveAdjustment: true,
  maxInterval: 1800000, // 30 minutes maximum for remote scenarios
  minInterval: 10000,   // 10 seconds minimum (network considerations)
  dataTypeMappings: {
    // Focus on consultation-relevant data
    'vitals': 'critical',
    'medications': 'critical',
    'allergies': 'critical',
    'encounters': 'critical',
    
    // Less critical for telehealth
    'lab_results': 'default',
    'procedures': 'non-essential',
    'demographics': 'non-essential',
    'insurance': 'non-essential',
    'billing': 'non-essential',
    'appointments': 'default',
    'care_plans': 'default'
  },
  enableLogging: true
};

// ============================================================================
// Configuration Setup Examples
// ============================================================================

/**
 * Setup function for hospital production environment
 */
export function setupHospitalProduction(): {
  dataSyncService: DataSyncService;
  realTimeService: RealTimeUpdateService;
  configManager: SyncConfigurationManager;
} {
  const dataSyncService = new DataSyncService(hospitalDataSyncConfig);
  const realTimeService = new RealTimeUpdateService(hospitalRealTimeConfig);
  const configManager = new SyncConfigurationManager();

  // Register services with configuration manager
  configManager.registerDataSyncService('hospital-main', dataSyncService);
  configManager.registerRealTimeService('hospital-realtime', realTimeService);

  console.log('Hospital production environment configured with dynamic sync intervals');

  return { dataSyncService, realTimeService, configManager };
}

/**
 * Setup function for clinic environment
 */
export function setupClinic(): {
  dataSyncService: DataSyncService;
  realTimeService: RealTimeUpdateService;
} {
  const dataSyncService = new DataSyncService(clinicDataSyncConfig);
  const realTimeService = new RealTimeUpdateService({
    enableWebSocket: false, // Simpler polling-only for clinics
    enableDynamicPolling: true,
    pollingInterval: 60000,
    dynamicPollingConfig: clinicConfig
  });

  console.log('Clinic environment configured with conservative sync intervals');

  return { dataSyncService, realTimeService };
}

/**
 * Setup function for emergency department
 */
export function setupEmergencyDepartment(): {
  dataSyncService: DataSyncService;
  realTimeService: RealTimeUpdateService;
  configManager: SyncConfigurationManager;
} {
  const dataSyncService = new DataSyncService({
    enableDynamicIntervals: true,
    dynamicIntervalConfig: emergencyDeptConfig,
    maxConcurrentSyncs: 10, // High concurrency for ED
    syncTimeoutMs: 120000, // Shorter timeout for urgency
    enableAutoRetry: true,
    maxRetryAttempts: 5, // More retries for critical environment
    enableConflictResolution: true,
    conflictResolutionStrategy: 'most_recent'
  });

  const realTimeService = new RealTimeUpdateService({
    enableWebSocket: true,
    enableDynamicPolling: true,
    pollingInterval: 5000, // Very frequent polling
    dynamicPollingConfig: emergencyDeptConfig
  });

  const configManager = new SyncConfigurationManager();
  configManager.registerDataSyncService('ed-main', dataSyncService);
  configManager.registerRealTimeService('ed-realtime', realTimeService);

  console.log('Emergency department configured with maximum responsiveness');

  return { dataSyncService, realTimeService, configManager };
}

/**
 * Setup function for telehealth environment
 */
export function setupTelehealth(): {
  dataSyncService: DataSyncService;
  realTimeService: RealTimeUpdateService;
} {
  const dataSyncService = new DataSyncService({
    enableDynamicIntervals: true,
    dynamicIntervalConfig: telehealthConfig,
    maxConcurrentSyncs: 3, // Limited for network efficiency
    syncTimeoutMs: 900000, // Longer timeout for network latency
    enableAutoRetry: true,
    maxRetryAttempts: 3,
    enableConflictResolution: true,
    conflictResolutionStrategy: 'source_wins' // Prefer source for telehealth
  });

  const realTimeService = new RealTimeUpdateService({
    enableWebSocket: true,
    enableDynamicPolling: true,
    pollingInterval: 60000, // Conservative polling for network
    dynamicPollingConfig: telehealthConfig,
    maxReconnectAttempts: 10, // More reconnection attempts for unstable networks
    reconnectDelay: 10000 // Longer delay between reconnection attempts
  });

  console.log('Telehealth environment configured with network-aware sync intervals');

  return { dataSyncService, realTimeService };
}

// ============================================================================
// Administrative Configuration Examples
// ============================================================================

/**
 * Example of configuring emergency mode
 */
export function enableEmergencyMode(configManager: SyncConfigurationManager): void {
  configManager.enableEmergencyMode([
    'mass_casualty_event',
    'system_emergency',
    'critical_patient_influx'
  ]);

  console.log('Emergency mode enabled - all sync intervals minimized for critical response');
}

/**
 * Example of configuring maintenance mode
 */
export function enableMaintenanceMode(configManager: SyncConfigurationManager): void {
  configManager.enableMaintenanceMode(3.0, ['billing', 'insurance', 'demographics']);

  console.log('Maintenance mode enabled - sync intervals extended, non-essential data restricted');
}

/**
 * Example of updating criticality for a specific data type
 */
export function updateDataTypeCriticality(
  configManager: SyncConfigurationManager,
  dataType: string,
  criticality: 'critical' | 'non-essential' | 'default'
): void {
  configManager.updateGlobalDataTypeCriticality(dataType, criticality);

  console.log(`Updated ${dataType} criticality to ${criticality} across all services`);
}

/**
 * Example of exporting configuration for backup
 */
export function backupConfiguration(configManager: SyncConfigurationManager): string {
  const config = configManager.exportConfiguration();
  const configJson = JSON.stringify(config, null, 2);
  
  console.log('Configuration exported for backup');
  return configJson;
}

/**
 * Example of getting system statistics
 */
export function getSystemStatistics(configManager: SyncConfigurationManager): void {
  const stats = configManager.getSyncIntervalStats();
  const policy = configManager.getSystemPolicy();
  
  console.log('Current System Statistics:', {
    totalSyncOperations: stats.systemMetrics.totalSyncOperations,
    failureRate: stats.systemMetrics.failureRate,
    dynamicIntervalsEnabled: policy.enableDynamicIntervals,
    adaptiveAdjustmentsEnabled: policy.enableAdaptiveAdjustments,
    emergencyModeActive: policy.emergencyOverride.enabled,
    maintenanceModeActive: policy.maintenanceMode.enabled
  });
}