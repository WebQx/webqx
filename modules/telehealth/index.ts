/**
 * WebQX™ Telehealth Module - Main Exports
 * 
 * Main entry point for the WebQX™ telehealth module providing video consultations,
 * text-based fallbacks, and optimized FHIR synchronization for low-bandwidth environments.
 */

// Core components
export { TelehealthManager } from './core/TelehealthManager';
export { NetworkMonitor, type NetworkMonitorConfig } from './core/NetworkMonitor';

// Video consultation components
export { JitsiAdapter, type JitsiAdapterConfig } from './video/JitsiAdapter';

// Messaging and text consultation components
export { ConsultationChat, type ConsultationChatConfig } from './messaging/ConsultationChat';

// FHIR optimization components
export { FHIRBatchAdapter, type FHIROptimizationConfig } from './sync/FHIRBatchAdapter';

// Configuration
export {
  productionConfig,
  developmentConfig,
  lowBandwidthConfig,
  ruralConfig,
  getConfig
} from './config/telehealth.config';

// Type definitions
export * from './types/telehealth.types';

// Utility functions for telehealth setup
export {
  createTelehealthManager,
  createLowBandwidthManager,
  createRuralManager,
  validateTelehealthConfig
} from './utils/telehealth.utils';

/**
 * Quick setup function for standard telehealth configuration
 */
export function createTelehealthManager(config?: Partial<import('./types/telehealth.types').TelehealthConfig>): TelehealthManager {
  const { getConfig } = require('./config/telehealth.config');
  const { TelehealthManager } = require('./core/TelehealthManager');
  
  const defaultConfig = getConfig();
  const finalConfig = config ? { ...defaultConfig, ...config } : defaultConfig;
  
  return new TelehealthManager(finalConfig);
}

/**
 * Quick setup function for low-bandwidth telehealth configuration
 */
export function createLowBandwidthManager(): TelehealthManager {
  const { lowBandwidthConfig } = require('./config/telehealth.config');
  const { TelehealthManager } = require('./core/TelehealthManager');
  
  return new TelehealthManager(lowBandwidthConfig);
}

/**
 * Quick setup function for rural/remote telehealth configuration
 */
export function createRuralManager(): TelehealthManager {
  const { ruralConfig } = require('./config/telehealth.config');
  const { TelehealthManager } = require('./core/TelehealthManager');
  
  return new TelehealthManager(ruralConfig);
}

/**
 * Validate telehealth configuration
 */
export function validateTelehealthConfig(config: import('./types/telehealth.types').TelehealthConfig): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate Jitsi configuration
  if (!config.jitsiConfig?.domain) {
    errors.push('Jitsi domain is required');
  }
  
  if (!config.jitsiConfig?.appId) {
    errors.push('Jitsi app ID is required');
  }

  // Validate FHIR configuration
  if (!config.fhirConfig?.baseUrl) {
    errors.push('FHIR base URL is required');
  }

  try {
    new URL(config.fhirConfig.baseUrl);
  } catch {
    errors.push('FHIR base URL must be a valid URL');
  }

  // Validate network thresholds
  const thresholds = config.networkThresholds;
  if (thresholds.minBitrateKbps >= thresholds.optimalBitrateKbps) {
    errors.push('Minimum bitrate must be less than optimal bitrate');
  }
  
  if (thresholds.optimalBitrateKbps >= thresholds.maxBitrateKbps) {
    errors.push('Optimal bitrate must be less than maximum bitrate');
  }

  // Validate FHIR batch configuration
  if (config.fhirConfig.maxBatchSize < 1) {
    errors.push('FHIR batch size must be at least 1');
  }

  if (config.fhirConfig.maxBatchSize > 100) {
    warnings.push('Large FHIR batch sizes may cause performance issues');
  }

  // Validate compliance configuration
  if (config.complianceConfig.enableAuditLogging && config.complianceConfig.auditRetentionDays < 1) {
    errors.push('Audit retention days must be at least 1 when audit logging is enabled');
  }

  // HIPAA compliance warnings
  if (!config.complianceConfig.encryptionRequired) {
    warnings.push('Encryption should be required for HIPAA compliance');
  }

  if (config.complianceConfig.auditRetentionDays < 2555) { // 7 years
    warnings.push('HIPAA requires audit logs to be retained for at least 7 years');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// Default export
export default TelehealthManager;