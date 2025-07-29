/**
 * Test Environment Setup for Integration Tests
 * 
 * This module provides centralized configuration and utilities for integration testing
 * across all WebQx platform services including FHIR, HL7, Pharmacy, Lab Results,
 * Firebase, AI/NLP services, and healthcare integrations.
 */

import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.test') });

export interface TestEnvironmentConfig {
  server: {
    port: number;
    host: string;
    baseUrl: string;
  };
  database: {
    url: string;
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
  };
  security: {
    jwtSecret: string;
    encryptionKey: string;
    sessionSecret: string;
  };
  external: {
    fhir: {
      serverUrl: string;
      clientId: string;
      clientSecret: string;
    };
    firebase: {
      projectId: string;
      privateKey: string;
      clientEmail: string;
    };
    openai: {
      apiKey: string;
      whisperApiUrl: string;
    };
    email: {
      smtpHost: string;
      smtpPort: number;
      smtpUser: string;
      smtpPassword: string;
    };
    healthcare: {
      epic: {
        clientId: string;
        clientSecret: string;
        apiUrl: string;
      };
      cerner: {
        apiKey: string;
        apiUrl: string;
      };
      allscripts: {
        apiKey: string;
        apiUrl: string;
      };
    };
    messaging: {
      matrix: {
        serverUrl: string;
        accessToken: string;
      };
      medplum: {
        apiUrl: string;
        clientId: string;
        clientSecret: string;
      };
    };
  };
}

export const getTestConfig = (): TestEnvironmentConfig => {
  return {
    server: {
      port: parseInt(process.env.TEST_PORT || '3001', 10),
      host: process.env.TEST_HOST || 'localhost',
      baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3001',
    },
    database: {
      url: process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/webqx_test',
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || '5432', 10),
      name: process.env.TEST_DB_NAME || 'webqx_test',
      user: process.env.TEST_DB_USER || 'test',
      password: process.env.TEST_DB_PASSWORD || 'test',
    },
    security: {
      jwtSecret: process.env.TEST_JWT_SECRET || 'test-jwt-secret-min-32-characters-long',
      encryptionKey: process.env.TEST_ENCRYPTION_KEY || 'test-encryption-key-for-testing',
      sessionSecret: process.env.TEST_SESSION_SECRET || 'test-session-secret',
    },
    external: {
      fhir: {
        serverUrl: process.env.TEST_FHIR_SERVER_URL || 'https://test-fhir.webqx.health/fhir',
        clientId: process.env.TEST_FHIR_CLIENT_ID || 'test-fhir-client',
        clientSecret: process.env.TEST_FHIR_CLIENT_SECRET || 'test-fhir-secret',
      },
      firebase: {
        projectId: process.env.TEST_FIREBASE_PROJECT_ID || 'test-webqx-project',
        privateKey: process.env.TEST_FIREBASE_PRIVATE_KEY || 'test-private-key',
        clientEmail: process.env.TEST_FIREBASE_CLIENT_EMAIL || 'test@test-webqx-project.iam.gserviceaccount.com',
      },
      openai: {
        apiKey: process.env.TEST_OPENAI_API_KEY || 'test-openai-key',
        whisperApiUrl: process.env.TEST_WHISPER_API_URL || 'https://api.openai.com/v1/audio/transcriptions',
      },
      email: {
        smtpHost: process.env.TEST_SMTP_HOST || 'localhost',
        smtpPort: parseInt(process.env.TEST_SMTP_PORT || '1025', 10),
        smtpUser: process.env.TEST_SMTP_USER || 'test@webqx.health',
        smtpPassword: process.env.TEST_SMTP_PASSWORD || 'test-password',
      },
      healthcare: {
        epic: {
          clientId: process.env.TEST_EPIC_CLIENT_ID || 'test-epic-client',
          clientSecret: process.env.TEST_EPIC_CLIENT_SECRET || 'test-epic-secret',
          apiUrl: process.env.TEST_EPIC_API_URL || 'https://test-epic.webqx.health/api',
        },
        cerner: {
          apiKey: process.env.TEST_CERNER_API_KEY || 'test-cerner-key',
          apiUrl: process.env.TEST_CERNER_API_URL || 'https://test-cerner.webqx.health/api',
        },
        allscripts: {
          apiKey: process.env.TEST_ALLSCRIPTS_API_KEY || 'test-allscripts-key',
          apiUrl: process.env.TEST_ALLSCRIPTS_API_URL || 'https://test-allscripts.webqx.health/api',
        },
      },
      messaging: {
        matrix: {
          serverUrl: process.env.TEST_MATRIX_SERVER_URL || 'https://test-matrix.webqx.health',
          accessToken: process.env.TEST_MATRIX_ACCESS_TOKEN || 'test-matrix-token',
        },
        medplum: {
          apiUrl: process.env.TEST_MEDPLUM_API_URL || 'https://test-medplum.webqx.health',
          clientId: process.env.TEST_MEDPLUM_CLIENT_ID || 'test-medplum-client',
          clientSecret: process.env.TEST_MEDPLUM_CLIENT_SECRET || 'test-medplum-secret',
        },
      },
    },
  };
};

export const testConfig = getTestConfig();

/**
 * Validates that all required test environment variables are set
 */
export const validateTestEnvironment = (): { valid: boolean; missing: string[] } => {
  const missing: string[] = [];
  const config = getTestConfig();

  // Check critical configuration
  if (!config.security.jwtSecret || config.security.jwtSecret.length < 32) {
    missing.push('TEST_JWT_SECRET (must be at least 32 characters)');
  }

  if (!config.security.encryptionKey) {
    missing.push('TEST_ENCRYPTION_KEY');
  }

  if (!config.database.url) {
    missing.push('TEST_DATABASE_URL');
  }

  return {
    valid: missing.length === 0,
    missing,
  };
};

/**
 * Creates a minimal test environment for unit tests
 */
export const createTestEnvironment = () => {
  // Set essential environment variables for testing
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = testConfig.security.jwtSecret;
  process.env.ENCRYPTION_KEY = testConfig.security.encryptionKey;
  process.env.SESSION_SECRET = testConfig.security.sessionSecret;
  process.env.PORT = testConfig.server.port.toString();
  
  // Database configuration
  process.env.DATABASE_URL = testConfig.database.url;
  process.env.DB_HOST = testConfig.database.host;
  process.env.DB_PORT = testConfig.database.port.toString();
  process.env.DB_NAME = testConfig.database.name;
  process.env.DB_USER = testConfig.database.user;
  process.env.DB_PASSWORD = testConfig.database.password;

  // External service configuration
  process.env.FHIR_SERVER_URL = testConfig.external.fhir.serverUrl;
  process.env.OPENAI_API_KEY = testConfig.external.openai.apiKey;
  process.env.WHISPER_API_URL = testConfig.external.openai.whisperApiUrl;
  
  // Firebase configuration
  process.env.FIREBASE_PROJECT_ID = testConfig.external.firebase.projectId;
  process.env.FIREBASE_PRIVATE_KEY = testConfig.external.firebase.privateKey;
  process.env.FIREBASE_CLIENT_EMAIL = testConfig.external.firebase.clientEmail;

  // Email configuration
  process.env.SMTP_HOST = testConfig.external.email.smtpHost;
  process.env.SMTP_PORT = testConfig.external.email.smtpPort.toString();
  process.env.SMTP_USER = testConfig.external.email.smtpUser;
  process.env.SMTP_PASSWORD = testConfig.external.email.smtpPassword;

  // Healthcare integrations
  process.env.EPIC_CLIENT_ID = testConfig.external.healthcare.epic.clientId;
  process.env.EPIC_CLIENT_SECRET = testConfig.external.healthcare.epic.clientSecret;
  process.env.CERNER_API_KEY = testConfig.external.healthcare.cerner.apiKey;
  process.env.ALLSCRIPTS_API_KEY = testConfig.external.healthcare.allscripts.apiKey;

  // Messaging services
  process.env.MATRIX_SERVER_URL = testConfig.external.messaging.matrix.serverUrl;
  process.env.MEDPLUM_API_URL = testConfig.external.messaging.medplum.apiUrl;
};

/**
 * Cleanup function to reset environment after tests
 */
export const cleanupTestEnvironment = () => {
  // Reset critical environment variables
  delete process.env.NODE_ENV;
  delete process.env.JWT_SECRET;
  delete process.env.ENCRYPTION_KEY;
  delete process.env.SESSION_SECRET;
};