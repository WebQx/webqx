/**
 * PACS Configuration
 * 
 * Default configuration for PACS integration services.
 */

import { PACSConfiguration } from '../types';
import { SpecialtyWorkflows } from '../utils/specialtyWorkflows';

export const defaultPACSConfiguration: PACSConfiguration = {
  orthancConfig: {
    baseUrl: process.env.ORTHANC_URL || 'http://localhost:8042',
    username: process.env.ORTHANC_USERNAME,
    password: process.env.ORTHANC_PASSWORD,
    apiKey: process.env.ORTHANC_API_KEY,
    storageDirectory: process.env.ORTHANC_STORAGE_DIR || '/var/lib/orthanc/db',
    maxConnections: parseInt(process.env.ORTHANC_MAX_CONNECTIONS || '10'),
    timeoutMs: parseInt(process.env.ORTHANC_TIMEOUT_MS || '30000'),
    enableDicomWeb: process.env.ORTHANC_ENABLE_DICOMWEB === 'true',
    plugins: (process.env.ORTHANC_PLUGINS || 'dicom-web,postgresql').split(',')
  },

  dicoogleConfig: {
    baseUrl: process.env.DICOOGLE_URL || 'http://localhost:8080',
    indexPath: process.env.DICOOGLE_INDEX_PATH || '/opt/dicoogle/index',
    queryTimeoutMs: parseInt(process.env.DICOOGLE_TIMEOUT_MS || '15000'),
    maxResults: parseInt(process.env.DICOOGLE_MAX_RESULTS || '1000'),
    enableAdvancedSearch: process.env.DICOOGLE_ADVANCED_SEARCH === 'true',
    searchProviders: (process.env.DICOOGLE_PROVIDERS || 'lucene,file').split(',')
  },

  ohifConfig: {
    baseUrl: process.env.OHIF_URL || 'http://localhost:3000/ohif',
    wadoRsRoot: process.env.WADO_RS_ROOT || 'http://localhost:8042/wado-rs',
    qidoRsRoot: process.env.QIDO_RS_ROOT || 'http://localhost:8042/qido-rs',
    enableMeasurements: process.env.OHIF_ENABLE_MEASUREMENTS !== 'false',
    enableAnnotations: process.env.OHIF_ENABLE_ANNOTATIONS !== 'false',
    defaultLayout: process.env.OHIF_DEFAULT_LAYOUT || 'oneByTwo',
    viewerPresets: [
      {
        name: 'Radiology Standard',
        specialty: 'radiology',
        layout: 'oneByTwo',
        tools: ['WindowLevel', 'Zoom', 'Pan', 'Length', 'Bidirectional'],
        windowing: [
          { name: 'Soft Tissue', windowCenter: 40, windowWidth: 400 },
          { name: 'Lung', windowCenter: -600, windowWidth: 1600 },
          { name: 'Bone', windowCenter: 400, windowWidth: 1000 }
        ]
      },
      {
        name: 'Cardiology Standard',
        specialty: 'cardiology',
        layout: 'oneByOne',
        tools: ['WindowLevel', 'Zoom', 'Pan', 'Cine', 'HeartRate'],
        windowing: [
          { name: 'Cardiac', windowCenter: 50, windowWidth: 350 },
          { name: 'Vessel', windowCenter: 200, windowWidth: 700 }
        ]
      }
    ]
  },

  postdicomConfig: {
    apiKey: process.env.POSTDICOM_API_KEY || '',
    baseUrl: process.env.POSTDICOM_URL || 'https://api.postdicom.com',
    organizationId: process.env.POSTDICOM_ORG_ID || '',
    enableCloudStorage: process.env.POSTDICOM_ENABLE_CLOUD === 'true',
    syncIntervalMs: parseInt(process.env.POSTDICOM_SYNC_INTERVAL_MS || '300000'), // 5 minutes
    maxUploadSizeMB: parseInt(process.env.POSTDICOM_MAX_UPLOAD_MB || '2048') // 2GB
  },

  specialtyWorkflows: SpecialtyWorkflows.getAllWorkflows(),

  security: {
    enableEncryption: process.env.PACS_ENABLE_ENCRYPTION !== 'false',
    encryptionAlgorithm: process.env.PACS_ENCRYPTION_ALGORITHM || 'AES-256-GCM',
    requireAuthentication: process.env.PACS_REQUIRE_AUTH !== 'false',
    allowedRoles: (process.env.PACS_ALLOWED_ROLES || 'physician,radiologist,technician,admin').split(','),
    auditLogging: process.env.PACS_AUDIT_LOGGING !== 'false',
    dataRetentionDays: parseInt(process.env.PACS_DATA_RETENTION_DAYS || '2555') // 7 years
  },

  performance: {
    enableCaching: process.env.PACS_ENABLE_CACHING !== 'false',
    cacheTimeoutMs: parseInt(process.env.PACS_CACHE_TIMEOUT_MS || '3600000'), // 1 hour
    maxCacheSizeMB: parseInt(process.env.PACS_MAX_CACHE_MB || '1024'), // 1GB
    enablePrefetching: process.env.PACS_ENABLE_PREFETCHING === 'true',
    compressionLevel: parseInt(process.env.PACS_COMPRESSION_LEVEL || '6'),
    thumbnailSize: [
      parseInt(process.env.PACS_THUMBNAIL_WIDTH || '256'),
      parseInt(process.env.PACS_THUMBNAIL_HEIGHT || '256')
    ] as [number, number]
  }
};

/**
 * Validate PACS configuration
 */
export function validatePACSConfiguration(config: Partial<PACSConfiguration>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate Orthanc configuration
  if (!config.orthancConfig?.baseUrl) {
    errors.push('Orthanc base URL is required');
  }

  // Validate OHIF configuration
  if (!config.ohifConfig?.baseUrl) {
    errors.push('OHIF base URL is required');
  }

  if (!config.ohifConfig?.wadoRsRoot) {
    errors.push('WADO-RS root URL is required');
  }

  if (!config.ohifConfig?.qidoRsRoot) {
    errors.push('QIDO-RS root URL is required');
  }

  // Validate PostDICOM configuration if cloud storage is enabled
  if (config.postdicomConfig?.enableCloudStorage) {
    if (!config.postdicomConfig.apiKey) {
      errors.push('PostDICOM API key is required when cloud storage is enabled');
    }
    if (!config.postdicomConfig.organizationId) {
      errors.push('PostDICOM organization ID is required when cloud storage is enabled');
    }
  }

  // Validate security configuration
  if (config.security?.allowedRoles && config.security.allowedRoles.length === 0) {
    errors.push('At least one allowed role must be specified');
  }

  // Validate performance configuration
  if (config.performance?.maxCacheSizeMB && config.performance.maxCacheSizeMB < 0) {
    errors.push('Max cache size must be non-negative');
  }

  if (config.performance?.compressionLevel && (config.performance.compressionLevel < 0 || config.performance.compressionLevel > 9)) {
    errors.push('Compression level must be between 0 and 9');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get PACS configuration from environment variables
 */
export function getPACSConfigFromEnv(): PACSConfiguration {
  const config = { ...defaultPACSConfiguration };
  
  // Override with any additional environment-specific configurations
  // This allows for easy deployment-specific customization
  
  return config;
}

/**
 * Development PACS configuration for testing
 */
export const developmentPACSConfiguration: PACSConfiguration = {
  ...defaultPACSConfiguration,
  
  orthancConfig: {
    ...defaultPACSConfiguration.orthancConfig,
    baseUrl: 'http://localhost:8042',
    username: 'orthanc',
    password: 'orthanc',
    enableDicomWeb: true
  },

  dicoogleConfig: {
    ...defaultPACSConfiguration.dicoogleConfig,
    baseUrl: 'http://localhost:8080',
    enableAdvancedSearch: true
  },

  ohifConfig: {
    ...defaultPACSConfiguration.ohifConfig,
    baseUrl: 'http://localhost:3001',
    enableMeasurements: true,
    enableAnnotations: true
  },

  postdicomConfig: {
    ...defaultPACSConfiguration.postdicomConfig,
    enableCloudStorage: false // Disabled for development
  },

  security: {
    ...defaultPACSConfiguration.security,
    requireAuthentication: false, // Simplified for development
    auditLogging: true
  },

  performance: {
    ...defaultPACSConfiguration.performance,
    enableCaching: true,
    enablePrefetching: false,
    maxCacheSizeMB: 512 // Smaller cache for development
  }
};