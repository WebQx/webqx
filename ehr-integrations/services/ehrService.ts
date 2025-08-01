/**
 * EHR Service - Main service for Electronic Health Record integrations
 * 
 * Provides comprehensive functionality for connecting to and managing
 * various EHR systems with robust error handling, logging, and type safety.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import {
  EHRConfiguration,
  EHRApiResponse,
  EHRApiError,
  MedicalRecord,
  PatientDemographics,
  SyncOperation,
  SyncStatus,
  SyncDataType,
  ConnectionStatus,
  LoadingState,
  ErrorState,
  AuditAction
} from '../types';
import { AuditLogger } from './auditLogger';
import { DataSyncService, SyncProgress } from './dataSync';
import { validateEHRConfiguration, validatePatientMrn } from '../utils/validation';
import { encryptSensitiveData, decryptSensitiveData } from '../utils/encryption';

/**
 * Configuration options for EHR Service
 */
export interface EHRServiceOptions {
  /** Base URL for the service */
  baseUrl?: string;
  /** Default timeout in milliseconds */
  defaultTimeoutMs?: number;
  /** Whether to enable audit logging */
  enableAuditLogging?: boolean;
  /** Whether to enable automatic retries */
  enableAutoRetry?: boolean;
  /** Maximum number of concurrent operations */
  maxConcurrentOperations?: number;
}

/**
 * EHR Service connection event types
 */
export type EHRServiceEvent = 
  | 'connection_established'
  | 'connection_lost'
  | 'sync_started'
  | 'sync_completed'
  | 'sync_failed'
  | 'error_occurred'
  | 'configuration_updated';

/**
 * Event handler type for EHR Service events
 */
export type EHRServiceEventHandler = (event: EHRServiceEvent, data?: unknown) => void;

/**
 * Main EHR Service class
 * 
 * Handles all interactions with Electronic Health Record systems including:
 * - Connection management
 * - Patient data retrieval
 * - Data synchronization
 * - Error handling and retry logic
 * - Audit logging
 * - Event notifications
 */
export class EHRService {
  private configurations: Map<string, EHRConfiguration> = new Map();
  private connections: Map<string, ConnectionStatus> = new Map();
  private activeOperations: Map<string, SyncOperation> = new Map();
  private eventHandlers: Map<EHRServiceEvent, EHRServiceEventHandler[]> = new Map();
  private auditLogger: AuditLogger;
  private dataSyncService: DataSyncService;
  private options: Required<EHRServiceOptions>;

  /**
   * Constructor
   * @param options Service configuration options
   */
  constructor(options: EHRServiceOptions = {}) {
    this.options = {
      baseUrl: options.baseUrl || 'https://api.webqx.health/ehr',
      defaultTimeoutMs: options.defaultTimeoutMs || 30000,
      enableAuditLogging: options.enableAuditLogging ?? true,
      enableAutoRetry: options.enableAutoRetry ?? true,
      maxConcurrentOperations: options.maxConcurrentOperations || 5
    };

    this.auditLogger = new AuditLogger();
    this.dataSyncService = new DataSyncService();

    // Initialize event handlers map
    Object.values(['connection_established', 'connection_lost', 'sync_started', 'sync_completed', 'sync_failed', 'error_occurred', 'configuration_updated'] as EHRServiceEvent[])
      .forEach(event => this.eventHandlers.set(event, []));

    this.logInfo('EHR Service initialized', { options: this.options });
  }

  // ============================================================================
  // Configuration Management
  // ============================================================================

  /**
   * Add or update EHR configuration
   * @param config EHR configuration to add/update
   * @returns Promise resolving to success status
   */
  async addConfiguration(config: EHRConfiguration): Promise<EHRApiResponse<{ configId: string }>> {
    try {
      this.logInfo('Adding EHR configuration', { configId: config.id, systemType: config.systemType });

      // Validate configuration
      const validationErrors = validateEHRConfiguration(config);
      if (validationErrors.length > 0) {
        const error: EHRApiError = {
          code: 'VALIDATION_ERROR',
          message: 'Invalid EHR configuration',
          details: validationErrors.join(', '),
          retryable: false
        };
        this.logError('Configuration validation failed', error, { configId: config.id });
        return { success: false, error };
      }

      // Encrypt sensitive data
      const encryptedConfig = await this.encryptConfigurationSecrets(config);
      
      // Store configuration
      this.configurations.set(config.id, encryptedConfig);
      this.connections.set(config.id, 'disconnected');

      // Audit log the configuration addition
      if (this.options.enableAuditLogging) {
        await this.auditLogger.log({
          action: 'configure_ehr',
          resourceType: 'ehr_configuration',
          resourceId: config.id,
          ehrSystem: config.systemType,
          success: true,
          context: { 
            configName: config.name,
            systemType: config.systemType,
            baseUrl: config.baseUrl
          }
        });
      }

      this.emitEvent('configuration_updated', { configId: config.id, action: 'added' });

      this.logInfo('EHR configuration added successfully', { configId: config.id });

      return {
        success: true,
        data: { configId: config.id },
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date(),
          processingTimeMs: 0
        }
      };

    } catch (error) {
      const apiError: EHRApiError = {
        code: 'CONFIGURATION_ERROR',
        message: 'Failed to add EHR configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
        retryable: false
      };
      
      this.logError('Failed to add EHR configuration', apiError, { configId: config.id });
      return { success: false, error: apiError };
    }
  }

  /**
   * Get EHR configuration by ID
   * @param configId Configuration ID
   * @returns Promise resolving to configuration
   */
  async getConfiguration(configId: string): Promise<EHRApiResponse<EHRConfiguration>> {
    try {
      this.logInfo('Retrieving EHR configuration', { configId });

      const config = this.configurations.get(configId);
      if (!config) {
        const error: EHRApiError = {
          code: 'CONFIGURATION_NOT_FOUND',
          message: `EHR configuration not found: ${configId}`,
          retryable: false
        };
        this.logError('Configuration not found', error, { configId });
        return { success: false, error };
      }

      // Decrypt sensitive data for return
      const decryptedConfig = await this.decryptConfigurationSecrets(config);

      return {
        success: true,
        data: decryptedConfig,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date(),
          processingTimeMs: 0
        }
      };

    } catch (error) {
      const apiError: EHRApiError = {
        code: 'CONFIGURATION_RETRIEVAL_ERROR',
        message: 'Failed to retrieve EHR configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };
      
      this.logError('Failed to retrieve EHR configuration', apiError, { configId });
      return { success: false, error: apiError };
    }
  }

  /**
   * Remove EHR configuration
   * @param configId Configuration ID to remove
   * @returns Promise resolving to success status
   */
  async removeConfiguration(configId: string): Promise<EHRApiResponse<{ removed: boolean }>> {
    try {
      this.logInfo('Removing EHR configuration', { configId });

      if (!this.configurations.has(configId)) {
        const error: EHRApiError = {
          code: 'CONFIGURATION_NOT_FOUND',
          message: `EHR configuration not found: ${configId}`,
          retryable: false
        };
        return { success: false, error };
      }

      // Disconnect if connected
      if (this.connections.get(configId) === 'connected') {
        await this.disconnect(configId);
      }

      // Remove configuration
      this.configurations.delete(configId);
      this.connections.delete(configId);

      // Audit log the removal
      if (this.options.enableAuditLogging) {
        await this.auditLogger.log({
          action: 'configure_ehr',
          resourceType: 'ehr_configuration',
          resourceId: configId,
          success: true,
          context: { action: 'removed' }
        });
      }

      this.emitEvent('configuration_updated', { configId, action: 'removed' });

      this.logInfo('EHR configuration removed successfully', { configId });

      return {
        success: true,
        data: { removed: true },
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date(),
          processingTimeMs: 0
        }
      };

    } catch (error) {
      const apiError: EHRApiError = {
        code: 'CONFIGURATION_REMOVAL_ERROR',
        message: 'Failed to remove EHR configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
        retryable: false
      };
      
      this.logError('Failed to remove EHR configuration', apiError, { configId });
      return { success: false, error: apiError };
    }
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Connect to EHR system
   * @param configId Configuration ID
   * @returns Promise resolving to connection status
   */
  async connect(configId: string): Promise<EHRApiResponse<{ status: ConnectionStatus }>> {
    try {
      this.logInfo('Connecting to EHR system', { configId });

      const config = this.configurations.get(configId);
      if (!config) {
        const error: EHRApiError = {
          code: 'CONFIGURATION_NOT_FOUND',
          message: `EHR configuration not found: ${configId}`,
          retryable: false
        };
        return { success: false, error };
      }

      // Set connecting status
      this.connections.set(configId, 'connecting');

      try {
        // Attempt connection with timeout
        const connected = await this.performConnection(config);
        
        if (connected) {
          this.connections.set(configId, 'connected');
          this.emitEvent('connection_established', { configId, systemType: config.systemType });
          
          // Audit log successful connection
          if (this.options.enableAuditLogging) {
            await this.auditLogger.log({
              action: 'sync_ehr_data',
              resourceType: 'ehr_connection',
              resourceId: configId,
              ehrSystem: config.systemType,
              success: true,
              context: { action: 'connected' }
            });
          }

          this.logInfo('Successfully connected to EHR system', { configId, systemType: config.systemType });

          return {
            success: true,
            data: { status: 'connected' },
            metadata: {
              requestId: this.generateRequestId(),
              timestamp: new Date(),
              processingTimeMs: 0
            }
          };
        } else {
          throw new Error('Connection attempt failed');
        }

      } catch (connectionError) {
        this.connections.set(configId, 'error');
        
        const error: EHRApiError = {
          code: 'CONNECTION_FAILED',
          message: 'Failed to connect to EHR system',
          details: connectionError instanceof Error ? connectionError.message : 'Unknown connection error',
          retryable: true,
          retryAfterMs: 5000
        };

        this.logError('EHR connection failed', error, { configId, systemType: config.systemType });
        this.emitEvent('error_occurred', { configId, error });

        return { success: false, error };
      }

    } catch (error) {
      const apiError: EHRApiError = {
        code: 'CONNECTION_ERROR',
        message: 'Connection process failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };
      
      this.logError('Connection process failed', apiError, { configId });
      return { success: false, error: apiError };
    }
  }

  /**
   * Disconnect from EHR system
   * @param configId Configuration ID
   * @returns Promise resolving to disconnection status
   */
  async disconnect(configId: string): Promise<EHRApiResponse<{ status: ConnectionStatus }>> {
    try {
      this.logInfo('Disconnecting from EHR system', { configId });

      const config = this.configurations.get(configId);
      if (!config) {
        const error: EHRApiError = {
          code: 'CONFIGURATION_NOT_FOUND',
          message: `EHR configuration not found: ${configId}`,
          retryable: false
        };
        return { success: false, error };
      }

      // Cancel any active operations for this configuration
      Array.from(this.activeOperations.entries()).forEach(([operationId, operation]) => {
        if (operation.ehrConfigId === configId) {
          operation.status = 'failed';
          operation.completedAt = new Date();
          this.activeOperations.delete(operationId);
        }
      });

      // Set disconnected status
      this.connections.set(configId, 'disconnected');
      this.emitEvent('connection_lost', { configId, systemType: config.systemType });

      this.logInfo('Successfully disconnected from EHR system', { configId, systemType: config.systemType });

      return {
        success: true,
        data: { status: 'disconnected' },
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date(),
          processingTimeMs: 0
        }
      };

    } catch (error) {
      const apiError: EHRApiError = {
        code: 'DISCONNECTION_ERROR',
        message: 'Failed to disconnect from EHR system',
        details: error instanceof Error ? error.message : 'Unknown error',
        retryable: false
      };
      
      this.logError('Disconnection failed', apiError, { configId });
      return { success: false, error: apiError };
    }
  }

  /**
   * Get connection status for a configuration
   * @param configId Configuration ID
   * @returns Current connection status
   */
  getConnectionStatus(configId: string): ConnectionStatus {
    return this.connections.get(configId) || 'disconnected';
  }

  // ============================================================================
  // Patient Data Management
  // ============================================================================

  /**
   * Retrieve patient medical record
   * @param configId EHR configuration ID
   * @param patientMrn Patient medical record number
   * @param dataTypes Optional specific data types to retrieve
   * @returns Promise resolving to medical record
   */
  async getPatientRecord(
    configId: string,
    patientMrn: string,
    dataTypes?: SyncDataType[]
  ): Promise<EHRApiResponse<MedicalRecord>> {
    try {
      this.logInfo('Retrieving patient record', { configId, patientMrn, dataTypes });

      // Validate inputs
      if (!validatePatientMrn(patientMrn)) {
        const error: EHRApiError = {
          code: 'INVALID_PATIENT_MRN',
          message: 'Invalid patient medical record number',
          retryable: false
        };
        return { success: false, error };
      }

      // Check connection status
      const connectionStatus = this.getConnectionStatus(configId);
      if (connectionStatus !== 'connected') {
        const error: EHRApiError = {
          code: 'NOT_CONNECTED',
          message: 'EHR system is not connected',
          retryable: true,
          retryAfterMs: 1000
        };
        return { success: false, error };
      }

      // Audit log the data access
      if (this.options.enableAuditLogging) {
        await this.auditLogger.log({
          action: 'view_patient_data',
          resourceType: 'patient_record',
          resourceId: patientMrn,
          patientMrn,
          ehrSystem: this.configurations.get(configId)?.systemType,
          success: true,
          context: { dataTypes: dataTypes || ['all'] }
        });
      }

      // Retrieve medical record
      const medicalRecord = await this.fetchPatientRecord(configId, patientMrn, dataTypes);

      this.logInfo('Patient record retrieved successfully', { 
        configId, 
        patientMrn, 
        recordsCount: this.countRecords(medicalRecord)
      });

      return {
        success: true,
        data: medicalRecord,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date(),
          processingTimeMs: 0
        }
      };

    } catch (error) {
      const apiError: EHRApiError = {
        code: 'PATIENT_RECORD_RETRIEVAL_ERROR',
        message: 'Failed to retrieve patient record',
        details: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };
      
      this.logError('Failed to retrieve patient record', apiError, { configId, patientMrn });
      return { success: false, error: apiError };
    }
  }

  // ============================================================================
  // Data Synchronization
  // ============================================================================

  /**
   * Start data synchronization operation
   * @param configId EHR configuration ID
   * @param patientMrn Patient medical record number
   * @param syncType Type of synchronization
   * @param dataTypes Data types to synchronize
   * @returns Promise resolving to sync operation details
   */
  async startSync(
    configId: string,
    patientMrn: string,
    syncType: 'full' | 'incremental' | 'targeted' = 'incremental',
    dataTypes: SyncDataType[] = ['all']
  ): Promise<EHRApiResponse<SyncOperation>> {
    try {
      this.logInfo('Starting data sync operation', { configId, patientMrn, syncType, dataTypes });

      // Check if we're at max concurrent operations
      if (this.activeOperations.size >= this.options.maxConcurrentOperations) {
        const error: EHRApiError = {
          code: 'MAX_OPERATIONS_EXCEEDED',
          message: `Maximum concurrent operations exceeded (${this.options.maxConcurrentOperations})`,
          retryable: true,
          retryAfterMs: 5000
        };
        return { success: false, error };
      }

      // Create sync operation
      const operation: SyncOperation = {
        id: this.generateOperationId(),
        ehrConfigId: configId,
        patientMrn,
        type: syncType,
        dataTypes,
        status: 'syncing',
        startedAt: new Date(),
        progressPercent: 0,
        recordsProcessed: 0,
        recordsTotal: 0,
        errors: []
      };

      this.activeOperations.set(operation.id, operation);
      this.emitEvent('sync_started', { operation });

      // Start async sync process
      this.performSync(operation).catch(error => {
        this.logError('Async sync operation failed', { 
          code: 'SYNC_OPERATION_FAILED',
          message: error.message || 'Unknown sync error',
          retryable: true
        }, { operationId: operation.id });
      });

      return {
        success: true,
        data: operation,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date(),
          processingTimeMs: 0
        }
      };

    } catch (error) {
      const apiError: EHRApiError = {
        code: 'SYNC_START_ERROR',
        message: 'Failed to start sync operation',
        details: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };
      
      this.logError('Failed to start sync operation', apiError, { configId, patientMrn });
      return { success: false, error: apiError };
    }
  }

  /**
   * Get sync operation status
   * @param operationId Sync operation ID
   * @returns Promise resolving to operation status
   */
  async getSyncStatus(operationId: string): Promise<EHRApiResponse<SyncProgress>> {
    try {
      const operation = this.activeOperations.get(operationId);
      if (!operation) {
        const error: EHRApiError = {
          code: 'OPERATION_NOT_FOUND',
          message: `Sync operation not found: ${operationId}`,
          retryable: false
        };
        return { success: false, error };
      }

      // Transform SyncOperation to SyncProgress
      const progress: SyncProgress = {
        operationId: operation.id,
        status: operation.status,
        progressPercent: Math.round((operation.recordsProcessed / (operation.recordsTotal || 1)) * 100),
        currentPhase: operation.status === 'syncing' ? 'Processing records' : operation.status,
        recordsProcessed: operation.recordsProcessed,
        recordsTotal: operation.recordsTotal,
        recordsSucceeded: operation.recordsSucceeded || 0,
        recordsFailed: operation.recordsFailed || 0,
        lastUpdated: operation.updatedAt || new Date()
      };

      return {
        success: true,
        data: progress,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date(),
          processingTimeMs: 0
        }
      };

    } catch (error) {
      const apiError: EHRApiError = {
        code: 'SYNC_STATUS_ERROR',
        message: 'Failed to get sync operation status',
        details: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };
      
      return { success: false, error: apiError };
    }
  }

  // ============================================================================
  // Event Management
  // ============================================================================

  /**
   * Register event handler
   * @param event Event type
   * @param handler Event handler function
   */
  on(event: EHRServiceEvent, handler: EHRServiceEventHandler): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  /**
   * Unregister event handler
   * @param event Event type
   * @param handler Event handler function to remove
   */
  off(event: EHRServiceEvent, handler: EHRServiceEventHandler): void {
    const handlers = this.eventHandlers.get(event) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
      this.eventHandlers.set(event, handlers);
    }
  }

  /**
   * Emit event to all registered handlers
   * @param event Event type
   * @param data Event data
   */
  private emitEvent(event: EHRServiceEvent, data?: unknown): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(event, data);
      } catch (error) {
        this.logError('Event handler error', {
          code: 'EVENT_HANDLER_ERROR',
          message: error instanceof Error ? error.message : 'Unknown event handler error',
          retryable: false
        }, { event, data });
      }
    });
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Perform actual connection to EHR system
   * @param config EHR configuration
   * @returns Promise resolving to connection success
   */
  private async performConnection(config: EHRConfiguration): Promise<boolean> {
    // Simulate connection process - in real implementation, this would:
    // 1. Establish network connection
    // 2. Authenticate using provided credentials
    // 3. Verify API access
    // 4. Test basic functionality
    
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate random connection failures for testing
        if (Math.random() < 0.1) {
          reject(new Error('Connection timeout'));
        } else {
          resolve(true);
        }
      }, 1000);
    });
  }

  /**
   * Fetch patient record from EHR system
   * @param configId Configuration ID
   * @param patientMrn Patient MRN
   * @param dataTypes Data types to fetch
   * @returns Promise resolving to medical record
   */
  private async fetchPatientRecord(
    configId: string,
    patientMrn: string,
    dataTypes?: SyncDataType[]
  ): Promise<MedicalRecord> {
    // Mock implementation - in real system, this would make API calls to EHR
    const mockRecord: MedicalRecord = {
      patient: {
        mrn: patientMrn,
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: new Date('1980-01-01'),
        gender: 'male'
      },
      encounters: [],
      diagnoses: [],
      medications: [],
      allergies: [],
      vitals: [],
      labResults: [],
      procedures: [],
      carePlans: [],
      lastSynced: new Date()
    };

    return mockRecord;
  }

  /**
   * Perform sync operation
   * @param operation Sync operation to perform
   */
  private async performSync(operation: SyncOperation): Promise<void> {
    try {
      operation.status = 'syncing';
      operation.progressPercent = 0;

      // Simulate sync progress
      for (let i = 0; i <= 100; i += 10) {
        operation.progressPercent = i;
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      operation.status = 'completed';
      operation.completedAt = new Date();
      operation.successMessage = 'Sync completed successfully';

      this.emitEvent('sync_completed', { operation });
      
      // Remove from active operations after completion
      setTimeout(() => {
        this.activeOperations.delete(operation.id);
      }, 60000); // Keep for 1 minute for status queries

    } catch (error) {
      operation.status = 'failed';
      operation.completedAt = new Date();
      
      this.emitEvent('sync_failed', { operation, error });
      this.activeOperations.delete(operation.id);
    }
  }

  /**
   * Encrypt sensitive data in configuration
   * @param config Configuration to encrypt
   * @returns Encrypted configuration
   */
  private async encryptConfigurationSecrets(config: EHRConfiguration): Promise<EHRConfiguration> {
    const encryptedConfig = { ...config };
    
    if (config.authentication.clientSecret) {
      encryptedConfig.authentication.clientSecret = await encryptSensitiveData(config.authentication.clientSecret);
    }
    
    if (config.authentication.password) {
      encryptedConfig.authentication.password = await encryptSensitiveData(config.authentication.password);
    }
    
    if (config.authentication.apiKey) {
      encryptedConfig.authentication.apiKey = await encryptSensitiveData(config.authentication.apiKey);
    }

    return encryptedConfig;
  }

  /**
   * Decrypt sensitive data in configuration
   * @param config Configuration to decrypt
   * @returns Decrypted configuration
   */
  private async decryptConfigurationSecrets(config: EHRConfiguration): Promise<EHRConfiguration> {
    const decryptedConfig = { ...config };
    
    if (config.authentication.clientSecret) {
      decryptedConfig.authentication.clientSecret = await decryptSensitiveData(config.authentication.clientSecret);
    }
    
    if (config.authentication.password) {
      decryptedConfig.authentication.password = await decryptSensitiveData(config.authentication.password);
    }
    
    if (config.authentication.apiKey) {
      decryptedConfig.authentication.apiKey = await decryptSensitiveData(config.authentication.apiKey);
    }

    return decryptedConfig;
  }

  /**
   * Count records in medical record
   * @param record Medical record
   * @returns Total record count
   */
  private countRecords(record: MedicalRecord): number {
    return record.encounters.length +
           record.diagnoses.length +
           record.medications.length +
           record.allergies.length +
           record.vitals.length +
           record.labResults.length +
           record.procedures.length +
           record.carePlans.length;
  }

  /**
   * Generate unique request ID
   * @returns Request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique operation ID
   * @returns Operation ID
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log informational message
   * @param message Log message
   * @param context Additional context
   */
  private logInfo(message: string, context?: Record<string, unknown>): void {
    console.log(`[EHR Service] ${message}`, context || {});
  }

  /**
   * Log error message
   * @param message Error message
   * @param error Error details
   * @param context Additional context
   */
  private logError(message: string, error: EHRApiError, context?: Record<string, unknown>): void {
    console.error(`[EHR Service] ${message}`, { error, context: context || {} });
  }
}

export default EHRService;