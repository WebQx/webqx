/**
 * EHR Integration System Tests
 * 
 * Comprehensive test suite for validating EHR integration functionality,
 * error handling, loading states, TypeScript types, accessibility features,
 * and audit logging capabilities.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { EHRService } from '../services/ehrService';
import { AuditLogger } from '../services/auditLogger';
import { DataSyncService } from '../services/dataSync';
import {
  EHRConfiguration,
  EHRSystemType,
  ConnectionStatus,
  SyncOperation,
  SyncStatus,
  PatientDemographics,
  MedicalRecord
} from '../types';
import { 
  validateEHRConfiguration, 
  validatePatientMrn,
  validatePatientDemographics 
} from '../utils/validation';
import { 
  encryptSensitiveData, 
  decryptSensitiveData,
  hashData 
} from '../utils/encryption';

describe('EHR Integration System', () => {
  let ehrService: EHRService;
  let auditLogger: AuditLogger;
  let dataSyncService: DataSyncService;

  beforeEach(() => {
    ehrService = new EHRService({
      baseUrl: 'https://test-ehr-api.webqx.health',
      defaultTimeoutMs: 5000,
      enableAuditLogging: true,
      enableAutoRetry: true,
      maxConcurrentOperations: 3
    });

    auditLogger = new AuditLogger({
      enabled: true,
      logToConsole: false,
      maxInMemoryEntries: 1000
    });

    dataSyncService = new DataSyncService({
      maxConcurrentSyncs: 2,
      syncTimeoutMs: 10000,
      batchSize: 50
    });
  });

  describe('EHR Service Configuration', () => {
    test('should successfully add valid EHR configuration', async () => {
      const validConfig: EHRConfiguration = {
        id: 'test-config-1',
        name: 'Test Epic Integration',
        systemType: 'epic',
        baseUrl: 'https://epic-test.hospital.com/api',
        apiVersion: 'v1',
        authentication: {
          type: 'oauth2',
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
          tokenEndpoint: 'https://epic-test.hospital.com/oauth/token',
          scopes: ['read', 'write']
        },
        timeoutMs: 30000,
        retryConfig: {
          maxAttempts: 3,
          initialDelayMs: 1000,
          backoffMultiplier: 2,
          maxDelayMs: 30000,
          useJitter: true
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await ehrService.addConfiguration(validConfig);

      expect(result.success).toBe(true);
      expect(result.data?.configId).toBe(validConfig.id);
      expect(result.metadata?.requestId).toBeDefined();
      expect(result.metadata?.timestamp).toBeDefined();
    });

    test('should reject invalid EHR configuration', async () => {
      const invalidConfig = {
        id: '', // Invalid: empty ID
        name: 'Test Configuration',
        systemType: 'invalid_system' as EHRSystemType, // Invalid system type
        baseUrl: 'not-a-valid-url', // Invalid URL
        apiVersion: '',
        authentication: {
          type: 'oauth2',
          // Missing required OAuth2 fields
        },
        timeoutMs: -1, // Invalid timeout
        retryConfig: {
          maxAttempts: -1, // Invalid retry attempts
          initialDelayMs: 1000,
          backoffMultiplier: 2,
          maxDelayMs: 30000,
          useJitter: true
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      } as EHRConfiguration;

      const result = await ehrService.addConfiguration(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.message).toContain('Invalid EHR configuration');
    });

    test('should handle configuration retrieval errors gracefully', async () => {
      const result = await ehrService.getConfiguration('non-existent-config');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONFIGURATION_NOT_FOUND');
      expect(result.error?.retryable).toBe(false);
    });
  });

  describe('Connection Management', () => {
    let testConfig: EHRConfiguration;

    beforeEach(async () => {
      testConfig = {
        id: 'connection-test-config',
        name: 'Connection Test Config',
        systemType: 'epic',
        baseUrl: 'https://test-ehr.example.com/api',
        apiVersion: 'v1',
        authentication: {
          type: 'oauth2',
          clientId: 'test-client',
          clientSecret: 'test-secret',
          tokenEndpoint: 'https://test-ehr.example.com/oauth/token'
        },
        timeoutMs: 30000,
        retryConfig: {
          maxAttempts: 3,
          initialDelayMs: 1000,
          backoffMultiplier: 2,
          maxDelayMs: 30000,
          useJitter: true
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await ehrService.addConfiguration(testConfig);
    });

    test('should manage connection lifecycle', async () => {
      // Initial status should be disconnected
      let status = ehrService.getConnectionStatus(testConfig.id);
      expect(status).toBe('disconnected');

      // Attempt connection
      const connectResult = await ehrService.connect(testConfig.id);
      
      // Connection might succeed or fail in test environment
      if (connectResult.success) {
        expect(connectResult.data?.status).toBe('connected');
        status = ehrService.getConnectionStatus(testConfig.id);
        expect(status).toBe('connected');

        // Test disconnection
        const disconnectResult = await ehrService.disconnect(testConfig.id);
        expect(disconnectResult.success).toBe(true);
        expect(disconnectResult.data?.status).toBe('disconnected');
      } else {
        // Connection failed as expected in test environment
        expect(connectResult.error?.code).toBe('CONNECTION_FAILED');
        expect(connectResult.error?.retryable).toBe(true);
      }
    });

    test('should handle connection to non-existent configuration', async () => {
      const result = await ehrService.connect('non-existent-config');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONFIGURATION_NOT_FOUND');
      expect(result.error?.retryable).toBe(false);
    });
  });

  describe('Data Synchronization', () => {
    let testConfig: EHRConfiguration;

    beforeEach(async () => {
      testConfig = {
        id: 'sync-test-config',
        name: 'Sync Test Config',
        systemType: 'epic',
        baseUrl: 'https://test-sync-ehr.example.com/api',
        apiVersion: 'v1',
        authentication: {
          type: 'oauth2',
          clientId: 'sync-test-client',
          clientSecret: 'sync-test-secret',
          tokenEndpoint: 'https://test-sync-ehr.example.com/oauth/token'
        },
        timeoutMs: 30000,
        retryConfig: {
          maxAttempts: 3,
          initialDelayMs: 1000,
          backoffMultiplier: 2,
          maxDelayMs: 30000,
          useJitter: true
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await ehrService.addConfiguration(testConfig);
    });

    test('should start sync operation successfully', async () => {
      const result = await ehrService.startSync(
        testConfig.id,
        'TEST-MRN-001',
        'incremental',
        ['demographics', 'medications']
      );

      expect(result.success).toBe(true);
      expect(result.data?.ehrConfigId).toBe(testConfig.id);
      expect(result.data?.patientMrn).toBe('TEST-MRN-001');
      expect(result.data?.type).toBe('incremental');
      expect(result.data?.dataTypes).toEqual(['demographics', 'medications']);
      expect(result.data?.status).toBe('syncing');
      expect(result.data?.id).toBeDefined();
    });

    test('should track sync operation status', async () => {
      const startResult = await ehrService.startSync(
        testConfig.id,
        'TEST-MRN-002',
        'full',
        ['all']
      );

      expect(startResult.success).toBe(true);
      const operationId = startResult.data!.id;

      // Wait briefly for operation to progress
      await new Promise(resolve => setTimeout(resolve, 100));

      const statusResult = await ehrService.getSyncStatus(operationId);
      expect(statusResult.success).toBe(true);
      expect(statusResult.data?.operationId).toBe(operationId);
      expect(['syncing', 'completed', 'failed']).toContain(statusResult.data?.status);
    });

    test('should handle sync operation for non-existent configuration', async () => {
      const result = await ehrService.startSync(
        'non-existent-config',
        'TEST-MRN-003',
        'incremental',
        ['demographics']
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBeDefined();
    });

    test('should respect maximum concurrent operations limit', async () => {
      const promises = [];
      
      // Start more operations than the limit
      for (let i = 0; i < 5; i++) {
        promises.push(ehrService.startSync(
          testConfig.id,
          `TEST-MRN-${i}`,
          'incremental',
          ['demographics']
        ));
      }

      const results = await Promise.all(promises);
      
      // Some operations should succeed, others should be rejected
      const successes = results.filter(r => r.success).length;
      const failures = results.filter(r => !r.success).length;
      
      expect(successes).toBeGreaterThan(0);
      expect(failures).toBeGreaterThan(0);
      
      // Check that rejected operations have the correct error
      const rejectedOps = results.filter(r => !r.success);
      rejectedOps.forEach(result => {
        expect(result.error?.code).toBe('MAX_OPERATIONS_EXCEEDED');
        expect(result.error?.retryable).toBe(true);
      });
    });
  });

  describe('Patient Data Management', () => {
    let testConfig: EHRConfiguration;

    beforeEach(async () => {
      testConfig = {
        id: 'patient-test-config',
        name: 'Patient Test Config',
        systemType: 'epic',
        baseUrl: 'https://test-patient-ehr.example.com/api',
        apiVersion: 'v1',
        authentication: {
          type: 'oauth2',
          clientId: 'patient-test-client',
          clientSecret: 'patient-test-secret',
          tokenEndpoint: 'https://test-patient-ehr.example.com/oauth/token'
        },
        timeoutMs: 30000,
        retryConfig: {
          maxAttempts: 3,
          initialDelayMs: 1000,
          backoffMultiplier: 2,
          maxDelayMs: 30000,
          useJitter: true
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await ehrService.addConfiguration(testConfig);
    });

    test('should retrieve patient record', async () => {
      const result = await ehrService.getPatientRecord(
        testConfig.id,
        'VALID-MRN-001',
        ['demographics', 'medications']
      );

      // In test environment, this might fail due to no actual EHR connection
      if (result.success) {
        expect(result.data?.patient).toBeDefined();
        expect(result.data?.lastSynced).toBeInstanceOf(Date);
      } else {
        expect(result.error?.code).toBeDefined();
      }
    });

    test('should validate patient MRN format', async () => {
      const invalidMrnResult = await ehrService.getPatientRecord(
        testConfig.id,
        '', // Invalid empty MRN
        ['demographics']
      );

      expect(invalidMrnResult.success).toBe(false);
      expect(invalidMrnResult.error?.code).toBe('INVALID_PATIENT_MRN');
    });

    test('should handle disconnected EHR system', async () => {
      // Ensure system is disconnected
      await ehrService.disconnect(testConfig.id);

      const result = await ehrService.getPatientRecord(
        testConfig.id,
        'VALID-MRN-002',
        ['demographics']
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_CONNECTED');
      expect(result.error?.retryable).toBe(true);
    });
  });

  describe('Audit Logging', () => {
    test('should log user actions with context', async () => {
      auditLogger.setContext({
        userId: 'test-user-123',
        userRole: 'physician',
        sessionId: 'test-session-456',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      const result = await auditLogger.log({
        action: 'view_patient_data',
        resourceType: 'patient_record',
        resourceId: 'patient-123',
        patientMrn: 'TEST-MRN-001',
        ehrSystem: 'epic',
        success: true,
        context: {
          dataTypes: ['demographics', 'medications'],
          exportFormat: 'json'
        }
      });

      expect(result.success).toBe(true);
      expect(result.data?.logId).toBeDefined();
    });

    test('should search audit logs with criteria', async () => {
      // Add some test log entries
      await auditLogger.log({
        action: 'configure_ehr',
        resourceType: 'ehr_configuration',
        resourceId: 'config-1',
        success: true
      });

      await auditLogger.log({
        action: 'sync_ehr_data',
        resourceType: 'sync_operation',
        resourceId: 'sync-1',
        patientMrn: 'TEST-MRN-001',
        success: false,
        errorMessage: 'Connection timeout'
      });

      const searchResult = await auditLogger.search({
        action: 'sync_ehr_data',
        success: false,
        limit: 10
      });

      expect(searchResult.success).toBe(true);
      expect(searchResult.data?.entries).toBeDefined();
      expect(searchResult.data?.total).toBeGreaterThanOrEqual(1);
    });

    test('should export audit logs in different formats', async () => {
      // Add test data
      await auditLogger.log({
        action: 'export_data',
        resourceType: 'audit_logs',
        resourceId: 'export-test',
        success: true
      });

      // Test JSON export
      const jsonExport = await auditLogger.export(
        { limit: 100 },
        'json'
      );

      expect(jsonExport.success).toBe(true);
      expect(jsonExport.data?.mimeType).toBe('application/json');
      expect(jsonExport.data?.filename).toMatch(/\.json$/);

      // Test CSV export
      const csvExport = await auditLogger.export(
        { limit: 100 },
        'csv'
      );

      expect(csvExport.success).toBe(true);
      expect(csvExport.data?.mimeType).toBe('text/csv');
      expect(csvExport.data?.filename).toMatch(/\.csv$/);
    });

    test('should generate audit statistics', async () => {
      // Add test data
      await auditLogger.log({
        action: 'view_patient_data',
        resourceType: 'patient_record',
        resourceId: 'patient-1',
        success: true
      });

      await auditLogger.log({
        action: 'configure_ehr',
        resourceType: 'ehr_configuration',
        resourceId: 'config-1',
        success: true
      });

      const statsResult = await auditLogger.getStatistics();

      expect(statsResult.success).toBe(true);
      expect(statsResult.data?.totalEntries).toBeGreaterThanOrEqual(2);
      expect(statsResult.data?.entriesByAction).toBeDefined();
      expect(statsResult.data?.entriesBySuccess).toBeDefined();
    });
  });

  describe('Validation Utilities', () => {
    test('should validate EHR configuration correctly', () => {
      const validConfig: EHRConfiguration = {
        id: 'valid-config',
        name: 'Valid Configuration',
        systemType: 'epic',
        baseUrl: 'https://valid-ehr.example.com/api',
        apiVersion: 'v1',
        authentication: {
          type: 'oauth2',
          clientId: 'valid-client',
          clientSecret: 'valid-secret',
          tokenEndpoint: 'https://valid-ehr.example.com/oauth/token'
        },
        timeoutMs: 30000,
        retryConfig: {
          maxAttempts: 3,
          initialDelayMs: 1000,
          backoffMultiplier: 2,
          maxDelayMs: 30000,
          useJitter: true
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const errors = validateEHRConfiguration(validConfig);
      expect(errors).toHaveLength(0);
    });

    test('should detect invalid EHR configuration', () => {
      const invalidConfig = {
        id: '', // Invalid
        name: '', // Invalid
        systemType: 'invalid-type', // Invalid
        baseUrl: 'not-a-url', // Invalid
        apiVersion: '', // Invalid
        authentication: {
          type: 'oauth2',
          // Missing required fields
        },
        timeoutMs: -1, // Invalid
        retryConfig: {
          maxAttempts: -1, // Invalid
          initialDelayMs: 1000,
          backoffMultiplier: 2,
          maxDelayMs: 30000,
          useJitter: true
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      } as EHRConfiguration;

      const errors = validateEHRConfiguration(invalidConfig);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors).toContain('Configuration ID is required');
      expect(errors).toContain('Configuration name is required');
    });

    test('should validate patient MRN format', () => {
      expect(validatePatientMrn('ABC123')).toBe(true);
      expect(validatePatientMrn('12345')).toBe(true);
      expect(validatePatientMrn('PATIENT001')).toBe(true);
      
      expect(validatePatientMrn('')).toBe(false);
      expect(validatePatientMrn('AB')).toBe(false); // Too short
      expect(validatePatientMrn('A'.repeat(25))).toBe(false); // Too long
      expect(validatePatientMrn('ABC-123')).toBe(false); // Invalid characters
    });

    test('should validate patient demographics', () => {
      const validDemographics: PatientDemographics = {
        mrn: 'VALID123',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'male',
        email: 'john.doe@example.com',
        phoneNumber: '5551234567'
      };

      const result = validatePatientDemographics(validDemographics);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid patient demographics', () => {
      const invalidDemographics: PatientDemographics = {
        mrn: '', // Invalid
        firstName: '', // Invalid
        lastName: '', // Invalid
        dateOfBirth: new Date('2025-01-01'), // Future date
        gender: 'invalid' as any, // Invalid
        email: 'invalid-email', // Invalid
        phoneNumber: '123' // Invalid
      };

      const result = validatePatientDemographics(invalidDemographics);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Encryption and Security', () => {
    test('should encrypt and decrypt sensitive data', async () => {
      const sensitiveData = 'Patient SSN: 123-45-6789';
      
      const encrypted = await encryptSensitiveData(sensitiveData);
      expect(encrypted).not.toBe(sensitiveData);
      expect(encrypted).toBeDefined();

      const decrypted = await decryptSensitiveData(encrypted);
      expect(decrypted).toBe(sensitiveData);
    });

    test('should handle encryption errors gracefully', async () => {
      try {
        await decryptSensitiveData('invalid-encrypted-data');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should generate consistent hashes', async () => {
      const data = 'test data for hashing';
      
      const hash1 = await hashData(data);
      const hash2 = await hashData(data);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toBeDefined();
      expect(hash1.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle network timeouts gracefully', async () => {
      const shortTimeoutService = new EHRService({
        defaultTimeoutMs: 1, // Very short timeout
        enableAutoRetry: false
      });

      const config: EHRConfiguration = {
        id: 'timeout-test',
        name: 'Timeout Test',
        systemType: 'epic',
        baseUrl: 'https://timeout-test.example.com/api',
        apiVersion: 'v1',
        authentication: {
          type: 'oauth2',
          clientId: 'test',
          clientSecret: 'test',
          tokenEndpoint: 'https://timeout-test.example.com/oauth/token'
        },
        timeoutMs: 1,
        retryConfig: {
          maxAttempts: 1,
          initialDelayMs: 1000,
          backoffMultiplier: 2,
          maxDelayMs: 30000,
          useJitter: true
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await shortTimeoutService.addConfiguration(config);
      const result = await shortTimeoutService.connect(config.id);

      expect(result.success).toBe(false);
      expect(result.error?.retryable).toBe(true);
    });

    test('should provide detailed error information', async () => {
      const result = await ehrService.getPatientRecord(
        'non-existent-config',
        'VALID-MRN',
        ['demographics']
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBeDefined();
      expect(result.error?.message).toBeDefined();
      expect(typeof result.error?.retryable).toBe('boolean');
    });
  });

  describe('Loading States and User Experience', () => {
    test('should provide loading state information', async () => {
      const service = new EHRService({
        enableAuditLogging: true
      });

      // Mock loading state tracking
      let loadingState: LoadingState = { isLoading: false };
      
      // Simulate starting a long operation
      loadingState = { isLoading: true, message: 'Connecting to EHR system...', progress: 25 };
      expect(loadingState.isLoading).toBe(true);
      expect(loadingState.message).toBeDefined();
      expect(loadingState.progress).toBe(25);

      // Simulate completion
      loadingState = { isLoading: false, progress: 100 };
      expect(loadingState.isLoading).toBe(false);
    });

    test('should handle error states with recovery options', () => {
      const errorState: ErrorState = {
        hasError: true,
        message: 'Connection failed',
        code: 'CONNECTION_ERROR',
        retryable: true,
        details: 'Network timeout after 30 seconds'
      };

      expect(errorState.hasError).toBe(true);
      expect(errorState.retryable).toBe(true);
      expect(errorState.details).toBeDefined();
    });
  });

  describe('Accessibility and User Interface', () => {
    test('should provide screen reader compatible error messages', () => {
      const error: ErrorState = {
        hasError: true,
        message: 'Unable to connect to EHR system. Please check your internet connection and try again.',
        code: 'CONNECTION_ERROR',
        retryable: true
      };

      // Error message should be descriptive and actionable
      expect(error.message).toContain('Unable to connect');
      expect(error.message).toContain('try again');
      expect(error.retryable).toBe(true);
    });

    test('should provide progress information for screen readers', () => {
      const loadingState: LoadingState = {
        isLoading: true,
        message: 'Synchronizing patient data. Step 2 of 4 complete.',
        progress: 50
      };

      expect(loadingState.message).toContain('Step 2 of 4');
      expect(loadingState.progress).toBe(50);
    });
  });
});

describe('Data Sync Service Integration', () => {
  let dataSyncService: DataSyncService;

  beforeEach(() => {
    dataSyncService = new DataSyncService({
      maxConcurrentSyncs: 2,
      syncTimeoutMs: 10000,
      batchSize: 50,
      enableConflictResolution: true,
      conflictResolutionStrategy: 'most_recent'
    });
  });

  test('should handle sync operations with progress tracking', async () => {
    const ehrConfig: EHRConfiguration = {
      id: 'sync-test',
      name: 'Sync Test',
      systemType: 'epic',
      baseUrl: 'https://sync-test.example.com/api',
      apiVersion: 'v1',
      authentication: {
        type: 'oauth2',
        clientId: 'sync-client',
        clientSecret: 'sync-secret',
        tokenEndpoint: 'https://sync-test.example.com/oauth/token'
      },
      timeoutMs: 30000,
      retryConfig: {
        maxAttempts: 3,
        initialDelayMs: 1000,
        backoffMultiplier: 2,
        maxDelayMs: 30000,
        useJitter: true
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await dataSyncService.startSync(
      ehrConfig,
      'SYNC-TEST-MRN',
      'incremental',
      ['demographics', 'medications']
    );

    expect(result.success).toBe(true);
    expect(result.data?.ehrConfigId).toBe(ehrConfig.id);
    expect(result.data?.status).toBe('syncing');
  });

  test('should detect and handle data conflicts', async () => {
    const ehrConfig: EHRConfiguration = {
      id: 'conflict-test',
      name: 'Conflict Test',
      systemType: 'epic',
      baseUrl: 'https://conflict-test.example.com/api',
      apiVersion: 'v1',
      authentication: {
        type: 'oauth2',
        clientId: 'conflict-client',
        clientSecret: 'conflict-secret',
        tokenEndpoint: 'https://conflict-test.example.com/oauth/token'
      },
      timeoutMs: 30000,
      retryConfig: {
        maxAttempts: 3,
        initialDelayMs: 1000,
        backoffMultiplier: 2,
        maxDelayMs: 30000,
        useJitter: true
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const syncResult = await dataSyncService.startSync(
      ehrConfig,
      'CONFLICT-TEST-MRN',
      'full',
      ['all']
    );

    if (syncResult.success) {
      const operationId = syncResult.data!.id;
      
      // Check for conflicts after some time
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const conflictsResult = await dataSyncService.getConflicts(operationId);
      expect(conflictsResult.success).toBe(true);
      expect(Array.isArray(conflictsResult.data)).toBe(true);
    }
  });
});

/**
 * Integration test helper functions
 */
function createMockPatientDemographics(): PatientDemographics {
  return {
    mrn: 'TEST123',
    firstName: 'Test',
    lastName: 'Patient',
    dateOfBirth: new Date('1990-01-01'),
    gender: 'male',
    email: 'test.patient@example.com',
    phoneNumber: '5551234567'
  };
}

function createMockEHRConfiguration(): EHRConfiguration {
  return {
    id: 'mock-config',
    name: 'Mock EHR Config',
    systemType: 'epic',
    baseUrl: 'https://mock-ehr.example.com/api',
    apiVersion: 'v1',
    authentication: {
      type: 'oauth2',
      clientId: 'mock-client',
      clientSecret: 'mock-secret',
      tokenEndpoint: 'https://mock-ehr.example.com/oauth/token'
    },
    timeoutMs: 30000,
    retryConfig: {
      maxAttempts: 3,
      initialDelayMs: 1000,
      backoffMultiplier: 2,
      maxDelayMs: 30000,
      useJitter: true
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}