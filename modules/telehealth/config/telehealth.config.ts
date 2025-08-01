/**
 * WebQX™ Telehealth Configuration Example
 * 
 * Example configuration for the telehealth module showing how to set up
 * video consultations, text fallbacks, and optimized FHIR synchronization.
 */

import { TelehealthConfig } from '../types/telehealth.types';

/**
 * Production configuration for WebQX™ Telehealth
 */
export const productionConfig: TelehealthConfig = {
  // Jitsi Meet configuration
  jitsiConfig: {
    domain: 'meet.webqx.health',
    appId: 'webqx-telehealth-prod',
    jwtAppId: process.env.JITSI_JWT_APP_ID,
    jwtSecret: process.env.JITSI_JWT_SECRET,
    defaultRoomOptions: {
      enableLobby: true,
      requirePassword: false,
      enableWaitingRoom: true,
      maxParticipants: 10
    },
    servers: {
      stun: [
        'stun:stun.webqx.health:3478',
        'stun:stun.l.google.com:19302'
      ],
      turn: [
        {
          urls: 'turn:turn.webqx.health:3478',
          username: process.env.TURN_USERNAME || 'webqx',
          credential: process.env.TURN_PASSWORD || 'secure-password'
        }
      ]
    }
  },

  // Network thresholds for adaptive streaming
  networkThresholds: {
    minBitrateKbps: 256,        // Minimum for basic functionality
    optimalBitrateKbps: 1024,   // Good quality video/audio
    maxBitrateKbps: 4096,       // High definition
    audioOnlyThresholdKbps: 128, // Fall back to audio only
    textFallbackThresholdKbps: 64 // Fall back to text only
  },

  // FHIR optimization configuration
  fhirConfig: {
    baseUrl: process.env.FHIR_SERVER_URL || 'https://fhir.webqx.health/R4',
    maxBatchSize: 25,           // Smaller batches for low bandwidth
    enableCompression: true,
    compressionThreshold: 1024, // Compress payloads > 1KB
    enableDifferentialSync: true,
    syncIntervalMs: 30000,      // Sync every 30 seconds
    retry: {
      maxAttempts: 3,
      initialDelayMs: 1000,
      backoffMultiplier: 2
    },
    auth: {
      accessToken: process.env.FHIR_ACCESS_TOKEN,
      refreshToken: async () => {
        // Implement token refresh logic
        return await refreshFHIRToken();
      }
    }
  },

  // Matrix messaging configuration
  messagingConfig: {
    matrixServer: process.env.MATRIX_SERVER_URL || 'https://matrix.webqx.health',
    enableE2EE: true,
    messageRetentionDays: 2555 // 7 years for HIPAA compliance
  },

  // Recording configuration
  recordingConfig: {
    enableRecording: true,
    storageProvider: 'aws',
    storageConfig: {
      region: process.env.AWS_REGION || 'us-east-1',
      bucket: process.env.AWS_S3_BUCKET || 'webqx-telehealth-recordings',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    },
    retentionDays: 2555 // 7 years
  },

  // Compliance configuration
  complianceConfig: {
    enableAuditLogging: true,
    auditRetentionDays: 2555,
    enableConsentTracking: true,
    encryptionRequired: true
  }
};

/**
 * Development/testing configuration
 */
export const developmentConfig: TelehealthConfig = {
  jitsiConfig: {
    domain: 'meet.jit.si', // Use public Jitsi for development
    appId: 'webqx-telehealth-dev',
    defaultRoomOptions: {
      enableLobby: false,
      requirePassword: false,
      enableWaitingRoom: false,
      maxParticipants: 5
    },
    servers: {
      stun: ['stun:stun.l.google.com:19302']
    }
  },
  networkThresholds: {
    minBitrateKbps: 128,        // Lower thresholds for testing
    optimalBitrateKbps: 512,
    maxBitrateKbps: 2048,
    audioOnlyThresholdKbps: 64,
    textFallbackThresholdKbps: 32
  },
  fhirConfig: {
    baseUrl: 'http://localhost:8080/fhir',
    maxBatchSize: 10,           // Smaller batches for testing
    enableCompression: false,   // Disable compression for easier debugging
    compressionThreshold: 0,
    enableDifferentialSync: true,
    syncIntervalMs: 10000,      // More frequent sync for testing
    retry: {
      maxAttempts: 2,
      initialDelayMs: 500,
      backoffMultiplier: 1.5
    }
  },
  messagingConfig: {
    matrixServer: 'http://localhost:8008',
    enableE2EE: false,          // Disable encryption for easier testing
    messageRetentionDays: 30
  },
  recordingConfig: {
    enableRecording: false,     // Disable recording in development
    storageProvider: 'local',
    storageConfig: {
      path: './recordings'
    },
    retentionDays: 7
  },
  complianceConfig: {
    enableAuditLogging: true,
    auditRetentionDays: 30,
    enableConsentTracking: false,
    encryptionRequired: false
  }
};

/**
 * Low-bandwidth optimized configuration
 */
export const lowBandwidthConfig: TelehealthConfig = {
  jitsiConfig: {
    domain: 'meet.webqx.health',
    appId: 'webqx-telehealth-low-bandwidth',
    defaultRoomOptions: {
      enableLobby: true,
      requirePassword: false,
      enableWaitingRoom: true,
      maxParticipants: 2         // Limit participants to reduce bandwidth
    },
    servers: {
      stun: ['stun:stun.webqx.health:3478'],
      turn: [
        {
          urls: 'turn:turn.webqx.health:3478',
          username: process.env.TURN_USERNAME || 'webqx',
          credential: process.env.TURN_PASSWORD || 'secure-password'
        }
      ]
    }
  },
  networkThresholds: {
    minBitrateKbps: 64,         // Very low minimum
    optimalBitrateKbps: 256,    // Conservative optimal
    maxBitrateKbps: 512,        // Limited maximum
    audioOnlyThresholdKbps: 48,
    textFallbackThresholdKbps: 24
  },
  fhirConfig: {
    baseUrl: process.env.FHIR_SERVER_URL || 'https://fhir.webqx.health/R4',
    maxBatchSize: 5,            // Very small batches
    enableCompression: true,
    compressionThreshold: 512,  // Compress smaller payloads
    enableDifferentialSync: true,
    syncIntervalMs: 60000,      // Less frequent sync to save bandwidth
    retry: {
      maxAttempts: 5,           // More retries for unreliable connections
      initialDelayMs: 2000,     // Longer delays
      backoffMultiplier: 3
    },
    auth: {
      accessToken: process.env.FHIR_ACCESS_TOKEN,
      refreshToken: async () => {
        return await refreshFHIRToken();
      }
    }
  },
  messagingConfig: {
    matrixServer: process.env.MATRIX_SERVER_URL || 'https://matrix.webqx.health',
    enableE2EE: true,
    messageRetentionDays: 2555
  },
  recordingConfig: {
    enableRecording: false,     // Disable recording to save bandwidth
    storageProvider: 'local',
    storageConfig: {
      path: './recordings'
    },
    retentionDays: 30
  },
  complianceConfig: {
    enableAuditLogging: true,
    auditRetentionDays: 2555,
    enableConsentTracking: true,
    encryptionRequired: true
  }
};

/**
 * Configuration for rural/remote areas with very limited connectivity
 */
export const ruralConfig: TelehealthConfig = {
  jitsiConfig: {
    domain: 'meet.webqx.health',
    appId: 'webqx-telehealth-rural',
    defaultRoomOptions: {
      enableLobby: false,        // Skip lobby to reduce connection time
      requirePassword: false,
      enableWaitingRoom: false,
      maxParticipants: 2
    },
    servers: {
      stun: ['stun:stun.webqx.health:3478'],
      turn: [
        {
          urls: 'turn:turn.webqx.health:3478',
          username: process.env.TURN_USERNAME || 'webqx',
          credential: process.env.TURN_PASSWORD || 'secure-password'
        }
      ]
    }
  },
  networkThresholds: {
    minBitrateKbps: 32,         // Extremely low minimum
    optimalBitrateKbps: 128,
    maxBitrateKbps: 256,
    audioOnlyThresholdKbps: 24,
    textFallbackThresholdKbps: 16
  },
  fhirConfig: {
    baseUrl: process.env.FHIR_SERVER_URL || 'https://fhir.webqx.health/R4',
    maxBatchSize: 3,            // Minimal batches
    enableCompression: true,
    compressionThreshold: 256,
    enableDifferentialSync: true,
    syncIntervalMs: 120000,     // Sync every 2 minutes
    retry: {
      maxAttempts: 10,          // Many retries for poor connections
      initialDelayMs: 5000,     // Long delays
      backoffMultiplier: 2
    },
    auth: {
      accessToken: process.env.FHIR_ACCESS_TOKEN,
      refreshToken: async () => {
        return await refreshFHIRToken();
      }
    }
  },
  messagingConfig: {
    matrixServer: process.env.MATRIX_SERVER_URL || 'https://matrix.webqx.health',
    enableE2EE: true,
    messageRetentionDays: 2555
  },
  recordingConfig: {
    enableRecording: false,
    storageProvider: 'local',
    storageConfig: {
      path: './recordings'
    },
    retentionDays: 7
  },
  complianceConfig: {
    enableAuditLogging: true,
    auditRetentionDays: 2555,
    enableConsentTracking: true,
    encryptionRequired: true
  }
};

/**
 * Helper function to refresh FHIR access token
 */
async function refreshFHIRToken(): Promise<string> {
  try {
    const response = await fetch(process.env.FHIR_TOKEN_ENDPOINT || 'https://auth.webqx.health/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: process.env.FHIR_REFRESH_TOKEN || '',
        client_id: process.env.FHIR_CLIENT_ID || '',
        client_secret: process.env.FHIR_CLIENT_SECRET || ''
      })
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const data = await response.json();
    return data.access_token;

  } catch (error) {
    console.error('Failed to refresh FHIR token:', error);
    throw error;
  }
}

/**
 * Get configuration based on environment
 */
export function getConfig(): TelehealthConfig {
  const env = process.env.NODE_ENV || 'development';
  const bandwidthMode = process.env.BANDWIDTH_MODE;

  switch (bandwidthMode) {
    case 'low':
      return lowBandwidthConfig;
    case 'rural':
      return ruralConfig;
    default:
      switch (env) {
        case 'production':
          return productionConfig;
        case 'development':
        case 'test':
          return developmentConfig;
        default:
          return developmentConfig;
      }
  }
}