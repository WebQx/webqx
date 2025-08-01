/**
 * @fileoverview Configuration Examples for Whisper-OpenEMR Integration
 * 
 * Provides comprehensive configuration examples for different deployment scenarios
 * including development, staging, and production environments with various
 * OpenEMR setups and Whisper service configurations.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import type { WhisperOpenEMRConfig } from '../services/whisperIntegration';

/**
 * Development configuration example
 * Suitable for local development and testing
 */
export const developmentConfig: WhisperOpenEMRConfig = {
  openemr: {
    baseUrl: 'http://localhost:8080',
    apiVersion: '7.0.2',
    oauth: {
      clientId: 'dev-client-id',
      clientSecret: 'dev-client-secret',
      redirectUri: 'http://localhost:3000/callback',
      scopes: [
        'openid',
        'fhirUser',
        'patient/Patient.read',
        'patient/Patient.write',
        'patient/Encounter.read',
        'patient/Encounter.write',
        'patient/Observation.read',
        'patient/Observation.write',
        'patient/DocumentReference.read',
        'patient/DocumentReference.write'
      ]
    },
    fhir: {
      enabled: true,
      baseUrl: 'http://localhost:8080/apis/default/fhir'
    },
    security: {
      verifySSL: false, // Disabled for local development
      timeout: 30000
    },
    features: {
      enableAudit: true,
      enableSync: true,
      syncInterval: 15
    },
    debug: true // Enable detailed logging
  },
  whisper: {
    timeout: 30000,
    maxFileSize: 25 * 1024 * 1024, // 25MB
    allowedFileTypes: [
      'audio/mpeg',
      'audio/mp4',
      'audio/wav',
      'audio/webm',
      'audio/ogg',
      'audio/flac',
      'audio/m4a'
    ]
  },
  clinical: {
    useMedicalVocabulary: true,
    defaultLanguage: 'en',
    medicalTemperature: 0.1,
    enablePHIProtection: true
  },
  features: {
    enableStreaming: true,
    autoSaveToEncounter: true,
    enableAuditLogging: true
  }
};

/**
 * Production configuration example
 * Suitable for production deployments with enhanced security
 */
export const productionConfig: WhisperOpenEMRConfig = {
  openemr: {
    baseUrl: process.env.OPENEMR_BASE_URL || 'https://your-openemr.example.com',
    apiVersion: process.env.OPENEMR_API_VERSION || '7.0.2',
    oauth: {
      clientId: process.env.OPENEMR_CLIENT_ID!,
      clientSecret: process.env.OPENEMR_CLIENT_SECRET!,
      redirectUri: process.env.OPENEMR_REDIRECT_URI!,
      scopes: [
        'openid',
        'fhirUser',
        'patient/Patient.read',
        'patient/Patient.write',
        'patient/Encounter.read',
        'patient/Encounter.write',
        'patient/Observation.read',
        'patient/Observation.write',
        'patient/DocumentReference.read',
        'patient/DocumentReference.write',
        'user/Practitioner.read'
      ]
    },
    fhir: {
      enabled: true,
      baseUrl: process.env.OPENEMR_FHIR_BASE_URL || 'https://your-openemr.example.com/apis/default/fhir'
    },
    security: {
      verifySSL: true,
      timeout: 45000 // Longer timeout for production
    },
    features: {
      enableAudit: true,
      enableSync: true,
      syncInterval: 10 // More frequent sync in production
    },
    debug: false
  },
  whisper: {
    timeout: 60000, // Longer timeout for production
    maxFileSize: 50 * 1024 * 1024, // 50MB for production
    allowedFileTypes: [
      'audio/mpeg',
      'audio/mp4',
      'audio/wav',
      'audio/webm',
      'audio/ogg',
      'audio/flac',
      'audio/m4a'
    ]
  },
  clinical: {
    useMedicalVocabulary: true,
    defaultLanguage: 'en',
    medicalTemperature: 0.05, // Very low for maximum consistency
    enablePHIProtection: true
  },
  features: {
    enableStreaming: true,
    autoSaveToEncounter: true,
    enableAuditLogging: true
  }
};

/**
 * Multilingual clinic configuration example
 * Suitable for clinics serving diverse patient populations
 */
export const multilingualConfig: WhisperOpenEMRConfig = {
  openemr: {
    baseUrl: process.env.OPENEMR_BASE_URL || 'https://clinic.example.com',
    apiVersion: '7.0.2',
    oauth: {
      clientId: process.env.OPENEMR_CLIENT_ID!,
      clientSecret: process.env.OPENEMR_CLIENT_SECRET!,
      redirectUri: process.env.OPENEMR_REDIRECT_URI!,
      scopes: [
        'openid',
        'fhirUser',
        'patient/Patient.read',
        'patient/Patient.write',
        'patient/Encounter.read',
        'patient/Encounter.write',
        'patient/Observation.read',
        'patient/Observation.write',
        'patient/DocumentReference.read',
        'patient/DocumentReference.write'
      ]
    },
    fhir: {
      enabled: true,
      baseUrl: process.env.OPENEMR_FHIR_BASE_URL
    },
    security: {
      verifySSL: true,
      timeout: 30000
    },
    features: {
      enableAudit: true,
      enableSync: true,
      syncInterval: 15
    },
    debug: false
  },
  whisper: {
    timeout: 45000,
    maxFileSize: 40 * 1024 * 1024,
    allowedFileTypes: [
      'audio/mpeg',
      'audio/mp4',
      'audio/wav',
      'audio/webm',
      'audio/ogg',
      'audio/flac',
      'audio/m4a'
    ]
  },
  clinical: {
    useMedicalVocabulary: true,
    defaultLanguage: 'auto', // Auto-detect language
    medicalTemperature: 0.2, // Slightly higher for multilingual
    enablePHIProtection: true
  },
  features: {
    enableStreaming: true,
    autoSaveToEncounter: true,
    enableAuditLogging: true
  }
};

/**
 * Emergency department configuration example
 * Optimized for fast, accurate transcription in high-pressure environments
 */
export const emergencyDepartmentConfig: WhisperOpenEMRConfig = {
  openemr: {
    baseUrl: process.env.OPENEMR_BASE_URL || 'https://emergency.hospital.example.com',
    apiVersion: '7.0.2',
    oauth: {
      clientId: process.env.OPENEMR_CLIENT_ID!,
      clientSecret: process.env.OPENEMR_CLIENT_SECRET!,
      redirectUri: process.env.OPENEMR_REDIRECT_URI!,
      scopes: [
        'openid',
        'fhirUser',
        'patient/Patient.read',
        'patient/Patient.write',
        'patient/Encounter.read',
        'patient/Encounter.write',
        'patient/Observation.read',
        'patient/Observation.write',
        'patient/DocumentReference.read',
        'patient/DocumentReference.write',
        'patient/Condition.read',
        'patient/Condition.write',
        'patient/Procedure.read',
        'patient/Procedure.write'
      ]
    },
    fhir: {
      enabled: true,
      baseUrl: process.env.OPENEMR_FHIR_BASE_URL
    },
    security: {
      verifySSL: true,
      timeout: 20000 // Shorter timeout for emergency scenarios
    },
    features: {
      enableAudit: true,
      enableSync: true,
      syncInterval: 5 // Very frequent sync for emergency scenarios
    },
    debug: false
  },
  whisper: {
    timeout: 30000, // Faster processing for emergencies
    maxFileSize: 30 * 1024 * 1024,
    allowedFileTypes: [
      'audio/mpeg',
      'audio/mp4',
      'audio/wav',
      'audio/webm'
    ]
  },
  clinical: {
    useMedicalVocabulary: true,
    defaultLanguage: 'en',
    medicalTemperature: 0.05, // Very low for accuracy in critical situations
    enablePHIProtection: true
  },
  features: {
    enableStreaming: true,
    autoSaveToEncounter: true,
    enableAuditLogging: true
  }
};

/**
 * Pediatric clinic configuration example
 * Optimized for pediatric medical terminology and workflows
 */
export const pediatricClinicConfig: WhisperOpenEMRConfig = {
  openemr: {
    baseUrl: process.env.OPENEMR_BASE_URL || 'https://pediatrics.clinic.example.com',
    apiVersion: '7.0.2',
    oauth: {
      clientId: process.env.OPENEMR_CLIENT_ID!,
      clientSecret: process.env.OPENEMR_CLIENT_SECRET!,
      redirectUri: process.env.OPENEMR_REDIRECT_URI!,
      scopes: [
        'openid',
        'fhirUser',
        'patient/Patient.read',
        'patient/Patient.write',
        'patient/Encounter.read',
        'patient/Encounter.write',
        'patient/Observation.read',
        'patient/Observation.write',
        'patient/DocumentReference.read',
        'patient/DocumentReference.write',
        'patient/Immunization.read',
        'patient/Immunization.write'
      ]
    },
    fhir: {
      enabled: true,
      baseUrl: process.env.OPENEMR_FHIR_BASE_URL
    },
    security: {
      verifySSL: true,
      timeout: 30000
    },
    features: {
      enableAudit: true,
      enableSync: true,
      syncInterval: 15
    },
    debug: false
  },
  whisper: {
    timeout: 35000,
    maxFileSize: 35 * 1024 * 1024,
    allowedFileTypes: [
      'audio/mpeg',
      'audio/mp4',
      'audio/wav',
      'audio/webm',
      'audio/ogg'
    ]
  },
  clinical: {
    useMedicalVocabulary: true,
    defaultLanguage: 'en',
    medicalTemperature: 0.1,
    enablePHIProtection: true
  },
  features: {
    enableStreaming: true,
    autoSaveToEncounter: true,
    enableAuditLogging: true
  }
};

/**
 * Configuration factory function
 * Creates configuration based on environment and use case
 */
export function createConfig(
  environment: 'development' | 'staging' | 'production',
  useCase?: 'general' | 'multilingual' | 'emergency' | 'pediatric',
  customOverrides?: Partial<WhisperOpenEMRConfig>
): WhisperOpenEMRConfig {
  let baseConfig: WhisperOpenEMRConfig;

  // Select base configuration based on environment
  switch (environment) {
    case 'development':
      baseConfig = developmentConfig;
      break;
    case 'production':
      baseConfig = productionConfig;
      break;
    case 'staging':
      // Staging uses production config with debug enabled
      baseConfig = {
        ...productionConfig,
        openemr: {
          ...productionConfig.openemr,
          debug: true
        }
      };
      break;
    default:
      baseConfig = developmentConfig;
  }

  // Apply use case specific modifications
  if (useCase) {
    switch (useCase) {
      case 'multilingual':
        baseConfig = {
          ...baseConfig,
          clinical: {
            ...baseConfig.clinical,
            defaultLanguage: 'auto',
            medicalTemperature: 0.2
          }
        };
        break;
      case 'emergency':
        baseConfig = {
          ...baseConfig,
          whisper: {
            ...baseConfig.whisper,
            timeout: 30000
          },
          openemr: {
            ...baseConfig.openemr,
            security: {
              ...baseConfig.openemr.security,
              timeout: 20000
            },
            features: {
              ...baseConfig.openemr.features,
              syncInterval: 5
            }
          },
          clinical: {
            ...baseConfig.clinical,
            medicalTemperature: 0.05
          }
        };
        break;
      case 'pediatric':
        // Pediatric specific configuration adjustments
        baseConfig = {
          ...baseConfig,
          clinical: {
            ...baseConfig.clinical,
            medicalTemperature: 0.1
          }
        };
        break;
    }
  }

  // Apply custom overrides
  if (customOverrides) {
    baseConfig = {
      ...baseConfig,
      ...customOverrides,
      openemr: {
        ...baseConfig.openemr,
        ...customOverrides.openemr
      },
      whisper: {
        ...baseConfig.whisper,
        ...customOverrides.whisper
      },
      clinical: {
        ...baseConfig.clinical,
        ...customOverrides.clinical
      },
      features: {
        ...baseConfig.features,
        ...customOverrides.features
      }
    };
  }

  return baseConfig;
}

/**
 * Validate configuration
 * Ensures all required fields are present and valid
 */
export function validateConfig(config: WhisperOpenEMRConfig): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate OpenEMR configuration
  if (!config.openemr?.baseUrl) {
    errors.push('OpenEMR base URL is required');
  }
  if (!config.openemr?.oauth?.clientId) {
    errors.push('OpenEMR OAuth client ID is required');
  }
  if (!config.openemr?.oauth?.clientSecret) {
    errors.push('OpenEMR OAuth client secret is required');
  }
  if (!config.openemr?.oauth?.redirectUri) {
    errors.push('OpenEMR OAuth redirect URI is required');
  }
  if (!config.openemr?.oauth?.scopes?.length) {
    errors.push('OpenEMR OAuth scopes are required');
  }

  // Validate Whisper configuration
  if (config.whisper?.timeout && config.whisper.timeout < 5000) {
    errors.push('Whisper timeout should be at least 5 seconds');
  }
  if (config.whisper?.maxFileSize && config.whisper.maxFileSize < 1024 * 1024) {
    errors.push('Whisper max file size should be at least 1MB');
  }

  // Validate clinical configuration
  if (config.clinical?.medicalTemperature !== undefined) {
    if (config.clinical.medicalTemperature < 0 || config.clinical.medicalTemperature > 1) {
      errors.push('Medical temperature should be between 0 and 1');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export default {
  developmentConfig,
  productionConfig,
  multilingualConfig,
  emergencyDepartmentConfig,
  pediatricClinicConfig,
  createConfig,
  validateConfig
};