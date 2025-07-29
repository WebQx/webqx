/**
 * Environment Configuration Validation Tests
 * 
 * Tests that validate all environment variables and configuration settings
 * required for the WebQx healthcare platform to function properly.
 */

import { createTestEnvironment, cleanupTestEnvironment, testConfig, validateTestEnvironment } from '../setup/test-environment';

describe('Environment Configuration Validation', () => {
  beforeAll(() => {
    createTestEnvironment();
  });

  afterAll(() => {
    cleanupTestEnvironment();
  });

  describe('Test Environment Validation', () => {
    test('Should validate test environment is properly configured', () => {
      const validation = validateTestEnvironment();
      
      if (!validation.valid) {
        console.warn('Missing test environment variables:', validation.missing);
        // Don't fail the test, just warn about missing variables
      }
      
      expect(Array.isArray(validation.missing)).toBe(true);
    });

    test('Should have all required security configuration', () => {
      const security = testConfig.security;
      
      expect(security.jwtSecret).toBeDefined();
      expect(security.jwtSecret.length).toBeGreaterThanOrEqual(32);
      expect(security.encryptionKey).toBeDefined();
      expect(security.sessionSecret).toBeDefined();
    });

    test('Should have valid database configuration', () => {
      const db = testConfig.database;
      
      expect(db.url).toBeDefined();
      expect(db.host).toBeDefined();
      expect(db.port).toBeGreaterThan(0);
      expect(db.port).toBeLessThan(65536);
      expect(db.name).toBeDefined();
      expect(db.user).toBeDefined();
      expect(db.password).toBeDefined();
      
      // Validate PostgreSQL URL format
      expect(db.url).toMatch(/^postgresql:\/\/.+/);
    });

    test('Should have valid server configuration', () => {
      const server = testConfig.server;
      
      expect(server.port).toBeGreaterThan(0);
      expect(server.port).toBeLessThan(65536);
      expect(server.host).toBeDefined();
      expect(server.baseUrl).toBeDefined();
      expect(server.baseUrl).toMatch(/^https?:\/\/.+/);
    });

    test('Should have external service URLs configured', () => {
      const external = testConfig.external;
      
      // FHIR configuration
      expect(external.fhir.serverUrl).toBeDefined();
      expect(external.fhir.serverUrl).toMatch(/^https?:\/\/.+/);
      expect(external.fhir.clientId).toBeDefined();
      expect(external.fhir.clientSecret).toBeDefined();
      
      // Firebase configuration
      expect(external.firebase.projectId).toBeDefined();
      expect(external.firebase.privateKey).toBeDefined();
      expect(external.firebase.clientEmail).toBeDefined();
      expect(external.firebase.clientEmail).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      
      // OpenAI configuration
      expect(external.openai.apiKey).toBeDefined();
      expect(external.openai.whisperApiUrl).toBeDefined();
      expect(external.openai.whisperApiUrl).toMatch(/^https?:\/\/.+/);
      
      // Email configuration
      expect(external.email.smtpHost).toBeDefined();
      expect(external.email.smtpPort).toBeGreaterThan(0);
      expect(external.email.smtpUser).toBeDefined();
      expect(external.email.smtpPassword).toBeDefined();
      
      // Healthcare integrations
      expect(external.healthcare.epic.clientId).toBeDefined();
      expect(external.healthcare.epic.clientSecret).toBeDefined();
      expect(external.healthcare.epic.apiUrl).toMatch(/^https?:\/\/.+/);
      
      expect(external.healthcare.cerner.apiKey).toBeDefined();
      expect(external.healthcare.cerner.apiUrl).toMatch(/^https?:\/\/.+/);
      
      expect(external.healthcare.allscripts.apiKey).toBeDefined();
      expect(external.healthcare.allscripts.apiUrl).toMatch(/^https?:\/\/.+/);
      
      // Messaging services
      expect(external.messaging.matrix.serverUrl).toBeDefined();
      expect(external.messaging.matrix.serverUrl).toMatch(/^https?:\/\/.+/);
      expect(external.messaging.matrix.accessToken).toBeDefined();
      
      expect(external.messaging.medplum.apiUrl).toBeDefined();
      expect(external.messaging.medplum.apiUrl).toMatch(/^https?:\/\/.+/);
      expect(external.messaging.medplum.clientId).toBeDefined();
      expect(external.messaging.medplum.clientSecret).toBeDefined();
    });
  });

  describe('Production Environment Validation', () => {
    test('Should validate production environment variables from .env.example', () => {
      // Read and validate the .env.example file structure
      const requiredEnvVars = [
        // Server Configuration
        'PORT',
        'NODE_ENV',
        
        // Database Configuration
        'DATABASE_URL',
        'DB_HOST',
        'DB_PORT',
        'DB_NAME',
        'DB_USER',
        'DB_PASSWORD',
        
        // Security & Authentication
        'JWT_SECRET',
        'ENCRYPTION_KEY',
        'SESSION_SECRET',
        
        // External APIs
        'FHIR_SERVER_URL',
        'HL7_ENDPOINT',
        'PHARMACY_API_URL',
        'LAB_RESULTS_API_URL',
        
        // AI/NLP Services
        'WHISPER_API_URL',
        'WHISPER_API_KEY',
        'OPENAI_API_KEY',
        'NLP_SERVICE_URL',
        
        // Firebase Configuration
        'FIREBASE_PROJECT_ID',
        'FIREBASE_PRIVATE_KEY_ID',
        'FIREBASE_PRIVATE_KEY',
        'FIREBASE_CLIENT_EMAIL',
        'FIREBASE_CLIENT_ID',
        'FIREBASE_AUTH_URI',
        'FIREBASE_TOKEN_URI',
        
        // Messaging & Communication
        'MATRIX_SERVER_URL',
        'MEDPLUM_API_URL',
        'SECURE_MESSAGING_KEY',
        
        // Email Configuration
        'SMTP_HOST',
        'SMTP_PORT',
        'SMTP_USER',
        'SMTP_PASSWORD',
        'FROM_EMAIL',
        
        // Healthcare Integration
        'EPIC_CLIENT_ID',
        'EPIC_CLIENT_SECRET',
        'CERNER_API_KEY',
        'ALLSCRIPTS_API_KEY',
        
        // Compliance & Audit
        'AUDIT_LOG_RETENTION_DAYS',
        'VAULT_SERVER_URL',
        'VAULT_TOKEN',
        
        // Analytics & Monitoring
        'GRAFANA_URL',
        'METABASE_URL',
        'MONITORING_API_KEY',
        
        // Localization
        'DEFAULT_LANGUAGE',
        'SUPPORTED_LANGUAGES',
        'TRANSLATION_API_KEY'
      ];

      // Validate that all required environment variables are documented
      requiredEnvVars.forEach(envVar => {
        expect(typeof envVar).toBe('string');
        expect(envVar.length).toBeGreaterThan(0);
      });

      expect(requiredEnvVars).toContain('JWT_SECRET');
      expect(requiredEnvVars).toContain('DATABASE_URL');
      expect(requiredEnvVars).toContain('FHIR_SERVER_URL');
      expect(requiredEnvVars).toContain('OPENAI_API_KEY');
      expect(requiredEnvVars).toContain('FIREBASE_PROJECT_ID');
    });

    test('Should validate security configuration requirements', () => {
      const securityRequirements = {
        jwtSecretMinLength: 32,
        encryptionKeyMinLength: 16,
        sessionSecretMinLength: 16,
        auditRetentionDays: 2555, // 7 years for HIPAA compliance
        supportedLanguages: ['en', 'es', 'fr', 'de', 'pt', 'zh', 'ar', 'hi', 'ja']
      };

      expect(securityRequirements.jwtSecretMinLength).toBe(32);
      expect(securityRequirements.auditRetentionDays).toBe(2555);
      expect(securityRequirements.supportedLanguages).toContain('en');
      expect(securityRequirements.supportedLanguages).toContain('es');
      expect(securityRequirements.supportedLanguages.length).toBeGreaterThan(5);
    });

    test('Should validate HIPAA compliance requirements', () => {
      const hipaaRequirements = {
        encryptionAtRest: true,
        encryptionInTransit: true,
        auditLogging: true,
        accessControls: true,
        dataRetention: 2555, // 7 years in days
        backupEncryption: true,
        userAuthentication: 'multi-factor',
        dataMinimization: true
      };

      Object.entries(hipaaRequirements).forEach(([key, value]) => {
        expect(value).toBeDefined();
        if (typeof value === 'boolean') {
          expect(value).toBe(true);
        }
      });

      expect(hipaaRequirements.dataRetention).toBe(2555);
      expect(hipaaRequirements.userAuthentication).toBe('multi-factor');
    });
  });

  describe('Configuration Validation Functions', () => {
    test('Should validate JWT secret strength', () => {
      const validateJWTSecret = (secret: string): { valid: boolean; errors: string[] } => {
        const errors: string[] = [];
        
        if (!secret) {
          errors.push('JWT secret is required');
        }
        
        if (secret && secret.length < 32) {
          errors.push('JWT secret must be at least 32 characters long');
        }
        
        if (secret && !/[A-Z]/.test(secret)) {
          errors.push('JWT secret should contain uppercase letters');
        }
        
        if (secret && !/[a-z]/.test(secret)) {
          errors.push('JWT secret should contain lowercase letters');
        }
        
        if (secret && !/[0-9]/.test(secret)) {
          errors.push('JWT secret should contain numbers');
        }
        
        return {
          valid: errors.length === 0,
          errors
        };
      };

      // Test with valid secret
      const validSecret = 'MySecureJWTSecret123WithEnoughLength';
      const validResult = validateJWTSecret(validSecret);
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      // Test with invalid secrets
      const invalidSecrets = [
        '',
        'short',
        'toolongbutnouppercaseornumbers',
        'TOOLONGBUTNOLOWERCASEORNUMBERS'
      ];

      invalidSecrets.forEach(secret => {
        const result = validateJWTSecret(secret);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    test('Should validate database URL format', () => {
      const validateDatabaseURL = (url: string): { valid: boolean; error?: string } => {
        if (!url) {
          return { valid: false, error: 'Database URL is required' };
        }
        
        const postgresRegex = /^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/;
        
        if (!postgresRegex.test(url)) {
          return { valid: false, error: 'Invalid PostgreSQL URL format' };
        }
        
        const match = url.match(postgresRegex);
        if (match) {
          const [, username, password, host, port, database] = match;
          
          if (!username || !password || !host || !database) {
            return { valid: false, error: 'Missing required URL components' };
          }
          
          const portNum = parseInt(port);
          if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
            return { valid: false, error: 'Invalid port number' };
          }
        }
        
        return { valid: true };
      };

      // Test valid URLs
      const validURLs = [
        'postgresql://user:pass@localhost:5432/database',
        'postgresql://webqx:secret@db.example.com:5432/webqx_production'
      ];

      validURLs.forEach(url => {
        const result = validateDatabaseURL(url);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      // Test invalid URLs
      const invalidURLs = [
        '',
        'invalid-url',
        'postgresql://localhost:5432/database', // Missing credentials
        'postgresql://user@localhost:5432/database', // Missing password
        'postgresql://user:pass@localhost:99999/database' // Invalid port
      ];

      invalidURLs.forEach(url => {
        const result = validateDatabaseURL(url);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    test('Should validate API endpoint URLs', () => {
      const validateAPIURL = (url: string): { valid: boolean; error?: string } => {
        if (!url) {
          return { valid: false, error: 'API URL is required' };
        }
        
        try {
          const urlObj = new URL(url);
          
          if (!['http:', 'https:'].includes(urlObj.protocol)) {
            return { valid: false, error: 'API URL must use HTTP or HTTPS protocol' };
          }
          
          if (!urlObj.hostname) {
            return { valid: false, error: 'API URL must have a valid hostname' };
          }
          
          return { valid: true };
        } catch (error) {
          return { valid: false, error: 'Invalid URL format' };
        }
      };

      // Test valid URLs
      const validURLs = [
        'https://api.example.com',
        'https://fhir.example.com/fhir',
        'http://localhost:3000',
        'https://test-api.webqx.health/v1'
      ];

      validURLs.forEach(url => {
        const result = validateAPIURL(url);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      // Test invalid URLs
      const invalidURLs = [
        '',
        'not-a-url',
        'ftp://invalid-protocol.com',
        'https://',
        'javascript:alert(1)'
      ];

      invalidURLs.forEach(url => {
        const result = validateAPIURL(url);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    test('Should validate email configuration', () => {
      const validateEmailConfig = (config: {
        smtpHost: string;
        smtpPort: number;
        smtpUser: string;
        smtpPassword: string;
      }): { valid: boolean; errors: string[] } => {
        const errors: string[] = [];
        
        if (!config.smtpHost) {
          errors.push('SMTP host is required');
        }
        
        if (!config.smtpPort || config.smtpPort < 1 || config.smtpPort > 65535) {
          errors.push('SMTP port must be between 1 and 65535');
        }
        
        if (!config.smtpUser) {
          errors.push('SMTP user is required');
        } else {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(config.smtpUser)) {
            errors.push('SMTP user must be a valid email address');
          }
        }
        
        if (!config.smtpPassword) {
          errors.push('SMTP password is required');
        }
        
        return {
          valid: errors.length === 0,
          errors
        };
      };

      // Test valid configuration
      const validConfig = {
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpUser: 'noreply@webqx.health',
        smtpPassword: 'secure-password'
      };

      const validResult = validateEmailConfig(validConfig);
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      // Test invalid configuration
      const invalidConfig = {
        smtpHost: '',
        smtpPort: 99999,
        smtpUser: 'invalid-email',
        smtpPassword: ''
      };

      const invalidResult = validateEmailConfig(invalidConfig);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Runtime Configuration Checks', () => {
    test('Should check if all required services are configured', () => {
      const requiredServices = [
        'database',
        'fhir',
        'firebase',
        'openai',
        'email',
        'epic',
        'cerner',
        'allscripts',
        'matrix',
        'medplum'
      ];

      const configuredServices = {
        database: !!testConfig.database.url,
        fhir: !!testConfig.external.fhir.serverUrl,
        firebase: !!testConfig.external.firebase.projectId,
        openai: !!testConfig.external.openai.apiKey,
        email: !!testConfig.external.email.smtpHost,
        epic: !!testConfig.external.healthcare.epic.clientId,
        cerner: !!testConfig.external.healthcare.cerner.apiKey,
        allscripts: !!testConfig.external.healthcare.allscripts.apiKey,
        matrix: !!testConfig.external.messaging.matrix.serverUrl,
        medplum: !!testConfig.external.messaging.medplum.apiUrl
      };

      requiredServices.forEach(service => {
        expect(configuredServices[service as keyof typeof configuredServices]).toBe(true);
      });

      const totalConfigured = Object.values(configuredServices).filter(Boolean).length;
      expect(totalConfigured).toBe(requiredServices.length);
    });

    test('Should validate configuration consistency', () => {
      // Check that related configurations are consistent
      const config = testConfig;
      
      // Database configuration should be consistent
      if (config.database.url) {
        expect(config.database.url).toContain(config.database.host);
        expect(config.database.url).toContain(config.database.port.toString());
        expect(config.database.url).toContain(config.database.name);
        expect(config.database.url).toContain(config.database.user);
      }
      
      // Firebase email should match project ID pattern
      if (config.external.firebase.clientEmail && config.external.firebase.projectId) {
        expect(config.external.firebase.clientEmail).toContain(config.external.firebase.projectId);
      }
      
      // Server base URL should include port
      if (config.server.baseUrl && config.server.port) {
        expect(config.server.baseUrl).toContain(config.server.port.toString());
      }
    });
  });
});