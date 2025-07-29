/**
 * WebQX™ Orthanc PACS Integration - Default Configuration
 */

import { 
  CloudStorageConfig, 
  RBACConfig, 
  MultilingualConfig, 
  ImageViewingConfig,
  OrthancConfig,
  PluginConfig
} from '../types';

export const defaultOrthancConfig: OrthancConfig = {
  baseUrl: process.env.ORTHANC_URL || 'http://localhost:8042',
  username: process.env.ORTHANC_USERNAME,
  password: process.env.ORTHANC_PASSWORD,
  timeout: parseInt(process.env.ORTHANC_TIMEOUT || '30000'),
  retryAttempts: parseInt(process.env.ORTHANC_RETRY_ATTEMPTS || '3'),
  retryDelay: parseInt(process.env.ORTHANC_RETRY_DELAY || '1000'),
  ssl: {
    enabled: process.env.ORTHANC_SSL_ENABLED === 'true',
    verifySSL: process.env.ORTHANC_SSL_VERIFY !== 'false',
    certPath: process.env.ORTHANC_SSL_CERT_PATH
  }
};

export const defaultCloudStorageConfig: CloudStorageConfig = {
  provider: (process.env.CLOUD_STORAGE_PROVIDER as 'aws' | 'azure' | 'gcp') || 'aws',
  region: process.env.CLOUD_STORAGE_REGION || 'us-east-1',
  bucketName: process.env.CLOUD_STORAGE_BUCKET || 'webqx-dicom-storage',
  credentials: {
    aws: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      sessionToken: process.env.AWS_SESSION_TOKEN
    },
    azure: {
      accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME || '',
      accountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY || '',
      connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING
    },
    gcp: {
      projectId: process.env.GCP_PROJECT_ID || '',
      keyFilename: process.env.GCP_KEY_FILENAME,
      credentials: process.env.GCP_CREDENTIALS ? JSON.parse(process.env.GCP_CREDENTIALS) : undefined
    }
  },
  retentionPolicy: {
    defaultRetentionDays: parseInt(process.env.DEFAULT_RETENTION_DAYS || '2555'), // ~7 years
    modalitySpecificRetention: {
      'CT': parseInt(process.env.CT_RETENTION_DAYS || '3650'), // 10 years
      'MR': parseInt(process.env.MR_RETENTION_DAYS || '3650'), // 10 years
      'US': parseInt(process.env.US_RETENTION_DAYS || '1825'), // 5 years
      'XR': parseInt(process.env.XR_RETENTION_DAYS || '2555'), // 7 years
      'CR': parseInt(process.env.CR_RETENTION_DAYS || '2555'), // 7 years
      'DX': parseInt(process.env.DX_RETENTION_DAYS || '2555'), // 7 years
      'MG': parseInt(process.env.MG_RETENTION_DAYS || '3650'), // 10 years for mammography
    },
    archiveAfterDays: parseInt(process.env.ARCHIVE_AFTER_DAYS || '365'), // 1 year
    deleteAfterDays: process.env.DELETE_AFTER_DAYS ? parseInt(process.env.DELETE_AFTER_DAYS) : undefined,
    glacierTransitionDays: parseInt(process.env.GLACIER_TRANSITION_DAYS || '90')
  },
  encryptionEnabled: process.env.CLOUD_STORAGE_ENCRYPTION !== 'false',
  compressionEnabled: process.env.CLOUD_STORAGE_COMPRESSION !== 'false',
  pathTemplate: process.env.CLOUD_STORAGE_PATH_TEMPLATE || '{year}/{month}/{studyId}/{seriesId}'
};

export const defaultRBACConfig: RBACConfig = {
  enabled: process.env.RBAC_ENABLED !== 'false',
  defaultPermissions: [
    { resource: 'study', action: 'read' },
    { resource: 'series', action: 'read' },
    { resource: 'instance', action: 'read' }
  ],
  roleHierarchy: {
    'admin': ['radiologist', 'technician', 'viewer'],
    'radiologist': ['technician', 'viewer'],
    'technician': ['viewer'],
    'viewer': []
  },
  auditLogging: process.env.RBAC_AUDIT_LOGGING !== 'false',
  sessionTimeout: parseInt(process.env.RBAC_SESSION_TIMEOUT || '28800'), // 8 hours
  mfaRequired: process.env.RBAC_MFA_REQUIRED === 'true'
};

export const defaultMultilingualConfig: MultilingualConfig = {
  defaultLanguage: process.env.DEFAULT_LANGUAGE || 'en',
  supportedLanguages: (process.env.SUPPORTED_LANGUAGES || 'en,es,fr,de,it,pt,zh,ja,ko,ar').split(','),
  autoDetectLanguage: process.env.AUTO_DETECT_LANGUAGE !== 'false',
  translationProvider: (process.env.TRANSLATION_PROVIDER as 'google' | 'azure' | 'aws' | 'local') || 'local',
  cacheTranslations: process.env.CACHE_TRANSLATIONS !== 'false',
  translationQuality: (process.env.TRANSLATION_QUALITY as 'high' | 'medium' | 'fast') || 'medium'
};

export const defaultImageViewingConfig: ImageViewingConfig = {
  enableThumbnails: process.env.ENABLE_THUMBNAILS !== 'false',
  thumbnailSizes: [64, 128, 256].concat(
    process.env.THUMBNAIL_SIZES ? process.env.THUMBNAIL_SIZES.split(',').map(Number) : []
  ),
  maxPreviewSize: parseInt(process.env.MAX_PREVIEW_SIZE || '1024'),
  imageFormats: (process.env.IMAGE_FORMATS || 'jpeg,png,webp').split(','),
  compressionQuality: parseInt(process.env.IMAGE_COMPRESSION_QUALITY || '85'),
  cacheEnabled: process.env.IMAGE_CACHE_ENABLED !== 'false',
  cacheExpirationHours: parseInt(process.env.IMAGE_CACHE_EXPIRATION_HOURS || '24'),
  watermarkEnabled: process.env.WATERMARK_ENABLED === 'true',
  allowDownload: process.env.ALLOW_DOWNLOAD !== 'false'
};

export const defaultPluginConfig: PluginConfig = {
  enabled: true,
  priority: 100,
  dependencies: [],
  healthCheckEndpoint: '/health',
  metrics: {
    enabled: process.env.METRICS_ENABLED !== 'false',
    metricsEndpoint: process.env.METRICS_ENDPOINT || '/metrics',
    collectionInterval: parseInt(process.env.METRICS_COLLECTION_INTERVAL || '60000'), // 1 minute
    retentionDays: parseInt(process.env.METRICS_RETENTION_DAYS || '30')
  }
};

// Database configurations
export const databaseConfig = {
  postgresql: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'webqx_pacs',
    username: process.env.POSTGRES_USER || 'webqx',
    password: process.env.POSTGRES_PASSWORD || '',
    ssl: process.env.POSTGRES_SSL === 'true',
    poolSize: parseInt(process.env.POSTGRES_POOL_SIZE || '10'),
    connectionTimeout: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT || '30000')
  },
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/webqx_pacs',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: parseInt(process.env.MONGODB_POOL_SIZE || '10'),
      serverSelectionTimeoutMS: parseInt(process.env.MONGODB_TIMEOUT || '30000')
    }
  }
};

// Cache configuration
export const cacheConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    ttl: parseInt(process.env.REDIS_TTL || '3600'), // 1 hour
    maxMemoryPolicy: process.env.REDIS_MAX_MEMORY_POLICY || 'allkeys-lru'
  }
};

// Logging configuration
export const loggingConfig = {
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.LOG_FORMAT || 'json',
  outputs: (process.env.LOG_OUTPUTS || 'console,file').split(','),
  filePath: process.env.LOG_FILE_PATH || './logs/pacs-integration.log',
  maxFileSize: process.env.LOG_MAX_FILE_SIZE || '10MB',
  maxFiles: parseInt(process.env.LOG_MAX_FILES || '5'),
  auditLogPath: process.env.AUDIT_LOG_PATH || './logs/audit.log'
};