/**
 * PostDICOM Configuration Management
 * Handles configuration for storage, API, performance, and compliance settings
 */

import { PostDICOMConfig, CloudProvider, AccessLevel } from '../types/postdicom.types';

/**
 * Default configuration for PostDICOM module
 * Provides secure defaults that comply with healthcare regulations
 */
const DEFAULT_CONFIG: PostDICOMConfig = {
  storage: {
    provider: 'aws' as CloudProvider,
    credentials: {
      accessKey: process.env.POSTDICOM_AWS_ACCESS_KEY || '',
      secretKey: process.env.POSTDICOM_AWS_SECRET_KEY || '',
      region: process.env.POSTDICOM_AWS_REGION || 'us-east-1'
    },
    bucketName: process.env.POSTDICOM_BUCKET_NAME || 'webqx-dicom-storage',
    encryption: true,
    retentionDays: 2555, // 7 years for healthcare compliance
    compressionLevel: 6
  },

  api: {
    baseUrl: process.env.POSTDICOM_API_URL || 'https://api.postdicom.com',
    apiKey: process.env.POSTDICOM_API_KEY || '',
    version: 'v1',
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
    rateLimitPerMinute: 1000
  },

  accessControl: {
    enableRBAC: true,
    defaultAccessLevel: 'restricted' as AccessLevel,
    auditLogging: true,
    sessionTimeout: 30, // 30 minutes
    maxConcurrentSessions: 5
  },

  performance: {
    enableCaching: true,
    cacheProvider: 'memory',
    maxCacheSize: '2GB',
    cacheTTL: 3600, // 1 hour
    preFetchEnabled: true,
    preFetchRules: [
      {
        name: 'recent_studies',
        condition: 'studyDate >= Date.now() - 86400000', // Last 24 hours
        priority: 1,
        maxImages: 50,
        enabled: true
      },
      {
        name: 'urgent_radiology',
        condition: 'modality === "CT" || modality === "MRI"',
        priority: 2,
        maxImages: 20,
        enabled: true
      }
    ]
  },

  compliance: {
    enableHIPAALogging: true,
    dataRetentionDays: 2555, // 7 years
    encryptionAtRest: true,
    encryptionInTransit: true,
    auditLogRetentionDays: 3650, // 10 years for audit logs
    anonymizeExports: true
  }
};

/**
 * Configuration validation rules
 */
const VALIDATION_RULES = {
  storage: {
    retentionDays: { min: 365, max: 3650 }, // 1-10 years
    compressionLevel: { min: 0, max: 9 }
  },
  api: {
    timeout: { min: 1000, max: 300000 }, // 1 second to 5 minutes
    retryAttempts: { min: 0, max: 10 },
    rateLimitPerMinute: { min: 10, max: 10000 }
  },
  accessControl: {
    sessionTimeout: { min: 5, max: 480 }, // 5 minutes to 8 hours
    maxConcurrentSessions: { min: 1, max: 50 }
  },
  performance: {
    cacheTTL: { min: 60, max: 86400 }, // 1 minute to 24 hours
    maxCacheSize: ['1GB', '2GB', '5GB', '10GB', '20GB']
  }
};

/**
 * PostDICOM Configuration Manager
 * Provides centralized configuration management with validation and environment support
 */
export class PostDICOMConfigManager {
  private config: PostDICOMConfig;
  private validationEnabled: boolean;

  constructor(customConfig?: Partial<PostDICOMConfig>, enableValidation = true) {
    this.validationEnabled = enableValidation;
    this.config = this.mergeConfig(DEFAULT_CONFIG, customConfig || {});
    
    if (this.validationEnabled) {
      this.validateConfig();
    }
  }

  /**
   * Get the current configuration
   */
  getConfig(): PostDICOMConfig {
    return { ...this.config };
  }

  /**
   * Update configuration with partial updates
   */
  updateConfig(updates: Partial<PostDICOMConfig>): void {
    const newConfig = this.mergeConfig(this.config, updates);
    
    if (this.validationEnabled) {
      this.validateConfigSection(newConfig);
    }
    
    this.config = newConfig;
  }

  /**
   * Get configuration for a specific cloud provider
   */
  getStorageConfig(provider?: CloudProvider): PostDICOMConfig['storage'] {
    if (provider && provider !== this.config.storage.provider) {
      return this.getProviderDefaults(provider);
    }
    return this.config.storage;
  }

  /**
   * Validate environment variables are properly set
   */
  validateEnvironment(): { valid: boolean; missing: string[] } {
    const required = [
      'POSTDICOM_API_KEY',
      'POSTDICOM_AWS_ACCESS_KEY',
      'POSTDICOM_AWS_SECRET_KEY'
    ];

    const missing = required.filter(env => !process.env[env]);
    
    return {
      valid: missing.length === 0,
      missing
    };
  }

  /**
   * Get configuration optimized for specific specialty
   */
  getSpecialtyConfig(specialty: string): PostDICOMConfig {
    const specialtyConfigs = {
      radiology: {
        performance: {
          ...this.config.performance,
          preFetchEnabled: true,
          preFetchRules: [
            ...this.config.performance.preFetchRules,
            {
              name: 'radiology_priority',
              condition: 'modality === "CT" || modality === "MRI" || modality === "XR"',
              priority: 1,
              maxImages: 100,
              enabled: true
            }
          ]
        }
      },
      cardiology: {
        performance: {
          ...this.config.performance,
          preFetchRules: [
            ...this.config.performance.preFetchRules,
            {
              name: 'cardiology_priority',
              condition: 'modality === "ECG" || modality === "ECHO"',
              priority: 1,
              maxImages: 30,
              enabled: true
            }
          ]
        }
      },
      oncology: {
        accessControl: {
          ...this.config.accessControl,
          defaultAccessLevel: 'confidential' as AccessLevel,
          auditLogging: true
        }
      }
    };

    const specialtyOverrides = specialtyConfigs[specialty as keyof typeof specialtyConfigs];
    if (specialtyOverrides) {
      return this.mergeConfig(this.config, specialtyOverrides);
    }

    return this.config;
  }

  /**
   * Export configuration as JSON
   */
  exportConfig(): string {
    const exportableConfig = { ...this.config };
    // Remove sensitive information
    exportableConfig.storage.credentials = {};
    exportableConfig.api.apiKey = '[REDACTED]';
    
    return JSON.stringify(exportableConfig, null, 2);
  }

  /**
   * Import configuration from JSON
   */
  importConfig(configJson: string): void {
    try {
      const importedConfig = JSON.parse(configJson);
      this.updateConfig(importedConfig);
    } catch (error) {
      throw new Error(`Invalid configuration JSON: ${error.message}`);
    }
  }

  /**
   * Reset configuration to defaults
   */
  resetToDefaults(): void {
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Private: Merge configuration objects
   */
  private mergeConfig(base: PostDICOMConfig, override: any): PostDICOMConfig {
    const merged = { ...base };
    
    Object.keys(override).forEach(key => {
      if (override[key] && typeof override[key] === 'object' && !Array.isArray(override[key])) {
        merged[key as keyof PostDICOMConfig] = {
          ...merged[key as keyof PostDICOMConfig],
          ...override[key]
        };
      } else {
        merged[key as keyof PostDICOMConfig] = override[key];
      }
    });

    return merged;
  }

  /**
   * Private: Validate configuration against rules
   */
  private validateConfig(): void {
    this.validateConfigSection(this.config);
  }

  private validateConfigSection(config: PostDICOMConfig): void {
    // Validate storage configuration
    const storageRetention = config.storage.retentionDays;
    if (storageRetention < VALIDATION_RULES.storage.retentionDays.min || 
        storageRetention > VALIDATION_RULES.storage.retentionDays.max) {
      throw new Error(`Storage retention days must be between ${VALIDATION_RULES.storage.retentionDays.min} and ${VALIDATION_RULES.storage.retentionDays.max}`);
    }

    // Validate API configuration
    const apiTimeout = config.api.timeout;
    if (apiTimeout < VALIDATION_RULES.api.timeout.min || 
        apiTimeout > VALIDATION_RULES.api.timeout.max) {
      throw new Error(`API timeout must be between ${VALIDATION_RULES.api.timeout.min} and ${VALIDATION_RULES.api.timeout.max} milliseconds`);
    }

    // Validate cache size
    const cacheSize = config.performance.maxCacheSize;
    if (!VALIDATION_RULES.performance.maxCacheSize.includes(cacheSize)) {
      throw new Error(`Cache size must be one of: ${VALIDATION_RULES.performance.maxCacheSize.join(', ')}`);
    }

    // Validate session timeout
    const sessionTimeout = config.accessControl.sessionTimeout;
    if (sessionTimeout < VALIDATION_RULES.accessControl.sessionTimeout.min || 
        sessionTimeout > VALIDATION_RULES.accessControl.sessionTimeout.max) {
      throw new Error(`Session timeout must be between ${VALIDATION_RULES.accessControl.sessionTimeout.min} and ${VALIDATION_RULES.accessControl.sessionTimeout.max} minutes`);
    }
  }

  /**
   * Private: Get provider-specific defaults
   */
  private getProviderDefaults(provider: CloudProvider): PostDICOMConfig['storage'] {
    const providerDefaults = {
      aws: {
        ...this.config.storage,
        provider: 'aws' as CloudProvider,
        credentials: {
          accessKey: process.env.POSTDICOM_AWS_ACCESS_KEY || '',
          secretKey: process.env.POSTDICOM_AWS_SECRET_KEY || '',
          region: process.env.POSTDICOM_AWS_REGION || 'us-east-1'
        }
      },
      gcp: {
        ...this.config.storage,
        provider: 'gcp' as CloudProvider,
        credentials: {
          projectId: process.env.POSTDICOM_GCP_PROJECT_ID || '',
          region: process.env.POSTDICOM_GCP_REGION || 'us-central1'
        }
      },
      azure: {
        ...this.config.storage,
        provider: 'azure' as CloudProvider,
        credentials: {
          tenantId: process.env.POSTDICOM_AZURE_TENANT_ID || '',
          clientId: process.env.POSTDICOM_AZURE_CLIENT_ID || '',
          clientSecret: process.env.POSTDICOM_AZURE_CLIENT_SECRET || ''
        }
      }
    };

    return providerDefaults[provider];
  }
}

/**
 * Singleton instance for application-wide configuration
 */
export const postdicomConfig = new PostDICOMConfigManager();

/**
 * Helper function to get configuration
 */
export const getPostDICOMConfig = (): PostDICOMConfig => {
  return postdicomConfig.getConfig();
};

/**
 * Helper function to update configuration
 */
export const updatePostDICOMConfig = (updates: Partial<PostDICOMConfig>): void => {
  postdicomConfig.updateConfig(updates);
};

export default PostDICOMConfigManager;