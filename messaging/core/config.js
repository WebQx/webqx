/**
 * WebQX™ Messaging Configuration
 * 
 * Central configuration for Matrix-based messaging infrastructure.
 * Supports development, staging, and production environments.
 */

const dotenv = require('dotenv');
dotenv.config();

const config = {
  // Matrix Homeserver Configuration
  MATRIX_HOMESERVER_URL: process.env.MATRIX_HOMESERVER_URL || 'https://matrix.webqx.health',
  MATRIX_ACCESS_TOKEN: process.env.MATRIX_ACCESS_TOKEN || '',
  MATRIX_USER_ID: process.env.MATRIX_USER_ID || '@webqx-service:matrix.webqx.health',
  MATRIX_DEVICE_ID: process.env.MATRIX_DEVICE_ID || 'WEBQX_MESSAGING_001',

  // Security & Encryption Settings
  MATRIX_ENABLE_E2EE: process.env.MATRIX_ENABLE_E2EE !== 'false', // Default to true
  MATRIX_VERIFY_DEVICES: process.env.MATRIX_VERIFY_DEVICES !== 'false', // Default to true
  MATRIX_CROSS_SIGNING: process.env.MATRIX_CROSS_SIGNING !== 'false', // Default to true
  
  // Audit & Compliance Settings
  MATRIX_AUDIT_ENABLED: process.env.MATRIX_AUDIT_ENABLED !== 'false', // Default to true
  MATRIX_AUDIT_RETENTION_DAYS: parseInt(process.env.MATRIX_AUDIT_RETENTION_DAYS) || 2555, // 7 years
  MATRIX_AUDIT_LOG_LEVEL: process.env.MATRIX_AUDIT_LOG_LEVEL || 'info',

  // WebQX™ Platform Integration
  WEBQX_EHR_INTEGRATION: process.env.WEBQX_EHR_INTEGRATION === 'true',
  WEBQX_WHISPER_INTEGRATION: process.env.WEBQX_WHISPER_INTEGRATION === 'true',
  WEBQX_FHIR_INTEGRATION: process.env.WEBQX_FHIR_INTEGRATION === 'true',

  // Channel Configuration
  CHANNEL_DEFAULT_ENCRYPTION: process.env.CHANNEL_DEFAULT_ENCRYPTION !== 'false',
  CHANNEL_MAX_MEMBERS: parseInt(process.env.CHANNEL_MAX_MEMBERS) || 100,
  CHANNEL_MESSAGE_RETENTION_DAYS: parseInt(process.env.CHANNEL_MESSAGE_RETENTION_DAYS) || 2555,

  // File Upload Settings
  MAX_FILE_SIZE_MB: parseInt(process.env.MAX_FILE_SIZE_MB) || 100,
  ALLOWED_FILE_TYPES: (process.env.ALLOWED_FILE_TYPES || 'pdf,jpg,jpeg,png,dcm,txt,doc,docx').split(','),
  HEALTHCARE_DOCUMENT_TYPES: (process.env.HEALTHCARE_DOCUMENT_TYPES || 'lab_result,prescription,imaging,chart_note').split(','),

  // Performance Settings
  SYNC_LIMIT: parseInt(process.env.MATRIX_SYNC_LIMIT) || 10,
  MESSAGE_BATCH_SIZE: parseInt(process.env.MESSAGE_BATCH_SIZE) || 50,
  CONNECTION_TIMEOUT_MS: parseInt(process.env.CONNECTION_TIMEOUT_MS) || 30000,

  // Specialty Channel Configurations
  SPECIALTY_CHANNELS: {
    'primary-care': {
      displayName: 'Primary Care',
      description: 'General practice communications',
      defaultMembers: ['@primary-care-bot:matrix.webqx.health'],
      retentionDays: 2555,
      enableFileSharing: true
    },
    'radiology': {
      displayName: 'Radiology',
      description: 'Imaging and radiology communications',
      defaultMembers: ['@radiology-bot:matrix.webqx.health'],
      retentionDays: 2555,
      enableFileSharing: true,
      allowedFileTypes: ['dcm', 'jpg', 'png', 'pdf']
    },
    'cardiology': {
      displayName: 'Cardiology',
      description: 'Cardiac care communications',
      defaultMembers: ['@cardiology-bot:matrix.webqx.health'],
      retentionDays: 2555,
      enableFileSharing: true
    },
    'psychiatry': {
      displayName: 'Psychiatry',
      description: 'Mental health secure communications',
      defaultMembers: ['@psychiatry-bot:matrix.webqx.health'],
      retentionDays: 2555,
      enableFileSharing: false, // Extra privacy for mental health
      requireExtraVerification: true
    },
    'oncology': {
      displayName: 'Oncology',
      description: 'Cancer care team communications',
      defaultMembers: ['@oncology-bot:matrix.webqx.health'],
      retentionDays: 2555,
      enableFileSharing: true
    },
    'pediatrics': {
      displayName: 'Pediatrics',
      description: 'Pediatric care communications',
      defaultMembers: ['@pediatrics-bot:matrix.webqx.health'],
      retentionDays: 2555,
      enableFileSharing: true,
      requireParentalConsent: true
    }
  },

  // Plugin Configuration
  PLUGINS: {
    whisper: {
      enabled: process.env.PLUGIN_WHISPER_ENABLED === 'true',
      config: {
        supportedLanguages: ['en', 'es', 'fr', 'pt', 'de', 'it'],
        maxAudioDurationMinutes: 10,
        autoTranscribe: true
      }
    },
    ehrIntegration: {
      enabled: process.env.PLUGIN_EHR_ENABLED === 'true',
      config: {
        ehrSystems: ['openemr', 'openmrs', 'librehealth'],
        syncPatientData: true,
        autoCreateChannels: true
      }
    },
    fhirMessaging: {
      enabled: process.env.PLUGIN_FHIR_ENABLED === 'true',
      config: {
        fhirServerUrl: process.env.FHIR_SERVER_URL || 'https://fhir.webqx.health',
        messageFormat: 'FHIR_R4',
        validateMessages: true
      }
    }
  },

  // Development & Testing
  NODE_ENV: process.env.NODE_ENV || 'development',
  DEBUG_MODE: process.env.DEBUG_MODE === 'true',
  TEST_MODE: process.env.NODE_ENV === 'test',

  // Health Check Configuration
  HEALTH_CHECK_INTERVAL_MS: parseInt(process.env.HEALTH_CHECK_INTERVAL_MS) || 30000,
  HEALTH_CHECK_TIMEOUT_MS: parseInt(process.env.HEALTH_CHECK_TIMEOUT_MS) || 5000
};

/**
 * Validate configuration
 */
function validateConfig() {
  const required = [
    'MATRIX_HOMESERVER_URL',
    'MATRIX_USER_ID'
  ];

  const missing = required.filter(key => !config[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }

  // Validate URLs
  try {
    new URL(config.MATRIX_HOMESERVER_URL);
  } catch (error) {
    throw new Error(`Invalid MATRIX_HOMESERVER_URL: ${config.MATRIX_HOMESERVER_URL}`);
  }

  // Validate user ID format
  if (!config.MATRIX_USER_ID.match(/^@[a-zA-Z0-9._-]+:[a-zA-Z0-9.-]+$/)) {
    throw new Error(`Invalid MATRIX_USER_ID format: ${config.MATRIX_USER_ID}`);
  }

  return true;
}

/**
 * Get configuration for specific environment
 */
function getEnvironmentConfig(env = config.NODE_ENV) {
  const baseConfig = { ...config };

  switch (env) {
    case 'development':
      return {
        ...baseConfig,
        MATRIX_AUDIT_LOG_LEVEL: 'debug',
        DEBUG_MODE: true,
        HEALTH_CHECK_INTERVAL_MS: 10000
      };

    case 'test':
      return {
        ...baseConfig,
        MATRIX_HOMESERVER_URL: 'http://localhost:8008',
        MATRIX_USER_ID: '@test-user:localhost',
        MATRIX_AUDIT_ENABLED: false,
        HEALTH_CHECK_INTERVAL_MS: 5000
      };

    case 'production':
      return {
        ...baseConfig,
        DEBUG_MODE: false,
        MATRIX_AUDIT_LOG_LEVEL: 'warn'
      };

    default:
      return baseConfig;
  }
}

/**
 * Get specialty-specific configuration
 */
function getSpecialtyConfig(specialty) {
  return config.SPECIALTY_CHANNELS[specialty] || null;
}

/**
 * Get plugin configuration
 */
function getPluginConfig(pluginName) {
  return config.PLUGINS[pluginName] || null;
}

module.exports = {
  ...config,
  validateConfig,
  getEnvironmentConfig,
  getSpecialtyConfig,
  getPluginConfig
};