/**
 * Data Synchronization Service
 * 
 * Handles bidirectional data synchronization between the WebQX platform
 * and various EHR systems. Ensures data consistency, handles conflicts,
 * and provides comprehensive error handling and logging.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import {
  EHRConfiguration,
  EHRApiResponse,
  EHRApiError,
  SyncOperation,
  SyncStatus,
  SyncDataType,
  SyncError,
  MedicalRecord,
  PatientDemographics,
  LoadingState,
  ErrorState
} from '../types';
import { AuditLogger } from './auditLogger';
import { 
  DynamicSyncConfigurationService, 
  DynamicSyncIntervalConfig,
  SyncIntervalContext,
  DataCriticality 
} from './dynamicSyncConfigurationService';

/**
 * Sync configuration options
 */
export interface SyncConfiguration {
  /** Maximum concurrent sync operations */
  maxConcurrentSyncs: number;
  /** Sync timeout in milliseconds */
  syncTimeoutMs: number;
  /** Batch size for bulk operations */
  batchSize: number;
  /** Whether to enable automatic retry on failure */
  enableAutoRetry: boolean;
  /** Maximum retry attempts */
  maxRetryAttempts: number;
  /** Initial retry delay in milliseconds */
  initialRetryDelayMs: number;
  /** Backoff multiplier for retries */
  retryBackoffMultiplier: number;
  /** Whether to enable conflict resolution */
  enableConflictResolution: boolean;
  /** Conflict resolution strategy */
  conflictResolutionStrategy: 'source_wins' | 'target_wins' | 'most_recent' | 'manual';
  /** Whether to enable dynamic sync intervals */
  enableDynamicIntervals: boolean;
  /** Dynamic sync interval configuration */
  dynamicIntervalConfig?: Partial<DynamicSyncIntervalConfig>;
}

/**
 * Sync conflict information
 */
export interface SyncConflict {
  /** Conflict ID */
  id: string;
  /** Data type in conflict */
  dataType: SyncDataType;
  /** Source record ID */
  sourceRecordId: string;
  /** Target record ID */
  targetRecordId: string;
  /** Source data */
  sourceData: unknown;
  /** Target data */
  targetData: unknown;
  /** Conflict description */
  description: string;
  /** Timestamp when conflict was detected */
  detectedAt: Date;
  /** Resolution status */
  resolutionStatus: 'pending' | 'resolved' | 'ignored';
  /** Resolution details */
  resolutionDetails?: string;
}

/**
 * Sync progress information
 */
export interface SyncProgress {
  /** Operation ID */
  operationId: string;
  /** Current status */
  status: SyncStatus;
  /** Progress percentage (0-100) */
  progressPercent: number;
  /** Current phase description */
  currentPhase: string;
  /** Records processed */
  recordsProcessed: number;
  /** Total records */
  recordsTotal: number;
  /** Records succeeded */
  recordsSucceeded: number;
  /** Records failed */
  recordsFailed: number;
  /** Estimated time remaining in milliseconds */
  estimatedTimeRemainingMs?: number;
  /** Throughput (records per second) */
  throughputPerSecond?: number;
  /** Last update timestamp */
  lastUpdated: Date;
}

/**
 * Sync result summary
 */
export interface SyncResult {
  /** Operation ID */
  operationId: string;
  /** Overall success status */
  success: boolean;
  /** Start timestamp */
  startedAt: Date;
  /** Completion timestamp */
  completedAt: Date;
  /** Duration in milliseconds */
  durationMs: number;
  /** Records processed by type */
  recordsByType: Record<SyncDataType, {
    total: number;
    succeeded: number;
    failed: number;
    skipped: number;
  }>;
  /** Conflicts detected */
  conflicts: SyncConflict[];
  /** Errors encountered */
  errors: SyncError[];
  /** Summary message */
  summary: string;
}

/**
 * Data Synchronization Service
 * 
 * Manages all aspects of data synchronization between WebQX and EHR systems.
 * Provides bidirectional sync, conflict resolution, error handling, and
 * comprehensive progress tracking with audit logging.
 */
export class DataSyncService {
  private config: Required<SyncConfiguration>;
  private activeOperations: Map<string, SyncOperation> = new Map();
  private syncProgress: Map<string, SyncProgress> = new Map();
  private conflicts: Map<string, SyncConflict[]> = new Map();
  private auditLogger: AuditLogger;
  private dynamicSyncConfig: DynamicSyncConfigurationService;
  private syncIntervals: Map<string, number> = new Map();

  /**
   * Constructor
   * @param config Sync configuration options
   */
  constructor(config: Partial<SyncConfiguration> = {}) {
    this.config = {
      maxConcurrentSyncs: config.maxConcurrentSyncs || 3,
      syncTimeoutMs: config.syncTimeoutMs || 300000, // 5 minutes
      batchSize: config.batchSize || 100,
      enableAutoRetry: config.enableAutoRetry ?? true,
      maxRetryAttempts: config.maxRetryAttempts || 3,
      initialRetryDelayMs: config.initialRetryDelayMs || 1000,
      retryBackoffMultiplier: config.retryBackoffMultiplier || 2,
      enableConflictResolution: config.enableConflictResolution ?? true,
      conflictResolutionStrategy: config.conflictResolutionStrategy || 'most_recent',
      enableDynamicIntervals: config.enableDynamicIntervals ?? true,
      dynamicIntervalConfig: config.dynamicIntervalConfig || {}
    };

    this.auditLogger = new AuditLogger();
    
    // Initialize dynamic sync configuration service
    this.dynamicSyncConfig = new DynamicSyncConfigurationService(
      this.config.dynamicIntervalConfig
    );

    this.logInfo('Data Sync Service initialized', { 
      config: this.config,
      dynamicIntervalsEnabled: this.config.enableDynamicIntervals
    });
  }

  // ============================================================================
  // Dynamic Sync Interval Management
  // ============================================================================

  /**
   * Calculate dynamic sync interval for a data type
   * @param dataType Data type to sync
   * @param context Additional context for interval calculation
   * @returns Calculated sync interval in milliseconds
   */
  calculateSyncInterval(
    dataType: SyncDataType, 
    context: Partial<SyncIntervalContext> = {}
  ): number {
    if (!this.config.enableDynamicIntervals) {
      // Use default timeout if dynamic intervals are disabled
      return this.config.syncTimeoutMs;
    }

    const intervalContext: SyncIntervalContext = {
      dataType,
      systemLoad: context.systemLoad || this.getCurrentSystemLoad(),
      patientCriticality: context.patientCriticality,
      timeSinceLastSync: context.timeSinceLastSync,
      recentFailures: context.recentFailures || 0,
      customParams: context.customParams
    };

    const result = this.dynamicSyncConfig.calculateSyncInterval(intervalContext);
    
    // Store the calculated interval for this data type
    this.syncIntervals.set(dataType, result.intervalMs);
    
    // Log interval adjustment for audit purposes
    this.auditLogger.log({
      action: 'sync_interval_adjusted',
      resourceType: 'sync_configuration',
      resourceId: dataType,
      success: true,
      context: {
        dataType,
        intervalMs: result.intervalMs,
        criticality: result.criticality,
        adjustmentReason: result.adjustmentReason,
        adjustmentFactors: result.adjustmentFactors
      }
    });

    return result.intervalMs;
  }

  /**
   * Get current sync interval for a data type
   * @param dataType Data type
   * @returns Current sync interval in milliseconds
   */
  getCurrentSyncInterval(dataType: SyncDataType): number {
    if (!this.config.enableDynamicIntervals) {
      return this.config.syncTimeoutMs;
    }
    
    return this.syncIntervals.get(dataType) || this.calculateSyncInterval(dataType);
  }

  /**
   * Update data type criticality mapping
   * @param dataType Data type
   * @param criticality New criticality level
   */
  updateDataTypeCriticality(dataType: string, criticality: DataCriticality): void {
    this.dynamicSyncConfig.updateDataTypeCriticality(dataType, criticality);
    
    // Clear cached interval to force recalculation
    this.syncIntervals.delete(dataType as SyncDataType);
    
    this.logInfo('Data type criticality updated', {
      dataType,
      criticality
    });
  }

  /**
   * Update base sync intervals for different criticality levels
   * @param intervals New base intervals
   */
  updateBaseSyncIntervals(intervals: Partial<DynamicSyncIntervalConfig['baseIntervals']>): void {
    this.dynamicSyncConfig.updateBaseIntervals(intervals);
    
    // Clear all cached intervals to force recalculation
    this.syncIntervals.clear();
    
    this.logInfo('Base sync intervals updated', {
      newIntervals: intervals
    });
  }

  /**
   * Enable or disable dynamic sync intervals
   * @param enabled Whether to enable dynamic intervals
   */
  setDynamicIntervalsEnabled(enabled: boolean): void {
    this.config.enableDynamicIntervals = enabled;
    
    if (!enabled) {
      // Clear cached intervals when disabling dynamic intervals
      this.syncIntervals.clear();
    }
    
    this.logInfo('Dynamic sync intervals setting changed', { enabled });
  }

  /**
   * Get sync interval history for a data type
   * @param dataType Data type
   * @param limit Maximum number of history entries
   * @returns Interval adjustment history
   */
  getSyncIntervalHistory(dataType: SyncDataType, limit: number = 10) {
    return this.dynamicSyncConfig.getIntervalHistory(dataType, limit);
  }

  /**
   * Get dynamic sync configuration
   * @returns Current dynamic sync configuration
   */
  getDynamicSyncConfiguration() {
    return this.dynamicSyncConfig.getConfiguration();
  }

  // ============================================================================
  // Sync Operation Management
  // ============================================================================

  /**
   * Start a new synchronization operation
   * @param ehrConfig EHR configuration
   * @param patientMrn Patient medical record number
   * @param syncType Type of synchronization
   * @param dataTypes Data types to synchronize
   * @param syncContext Additional context for sync interval calculation
   * @returns Promise resolving to sync operation
   */
  async startSync(
    ehrConfig: EHRConfiguration,
    patientMrn: string,
    syncType: 'full' | 'incremental' | 'targeted' = 'incremental',
    dataTypes: SyncDataType[] = ['all'],
    syncContext: Partial<SyncIntervalContext> = {}
  ): Promise<EHRApiResponse<SyncOperation>> {
    try {
      this.logInfo('Starting sync operation', { 
        ehrConfigId: ehrConfig.id,
        patientMrn,
        syncType,
        dataTypes
      });

      // Check concurrent operation limit
      if (this.activeOperations.size >= this.config.maxConcurrentSyncs) {
        const error: EHRApiError = {
          code: 'MAX_CONCURRENT_SYNCS_EXCEEDED',
          message: `Maximum concurrent sync operations exceeded (${this.config.maxConcurrentSyncs})`,
          retryable: true,
          retryAfterMs: 5000
        };
        return { success: false, error };
      }

      // Create sync operation
      const operation: SyncOperation = {
        id: this.generateOperationId(),
        ehrConfigId: ehrConfig.id,
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

      // Initialize progress tracking
      const progress: SyncProgress = {
        operationId: operation.id,
        status: 'syncing',
        progressPercent: 0,
        currentPhase: 'Initializing sync operation',
        recordsProcessed: 0,
        recordsTotal: 0,
        recordsSucceeded: 0,
        recordsFailed: 0,
        lastUpdated: new Date()
      };

      this.activeOperations.set(operation.id, operation);
      this.syncProgress.set(operation.id, progress);

      // Audit log the sync start
      await this.auditLogger.log({
        action: 'sync_ehr_data',
        resourceType: 'sync_operation',
        resourceId: operation.id,
        patientMrn,
        ehrSystem: ehrConfig.systemType,
        success: true,
        context: {
          action: 'started',
          syncType,
          dataTypes,
          ehrConfig: ehrConfig.name
        }
      });

      // Start async sync process with dynamic interval consideration
      this.performSyncOperation(operation, ehrConfig, syncContext).catch(error => {
        this.logError('Async sync operation failed', {
          code: 'SYNC_OPERATION_FAILED',
          message: error.message || 'Unknown sync error',
          retryable: true
        }, { operationId: operation.id });
      });

      this.logInfo('Sync operation started successfully', { operationId: operation.id });

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
      
      this.logError('Failed to start sync operation', apiError, { ehrConfigId: ehrConfig.id, patientMrn });
      return { success: false, error: apiError };
    }
  }

  /**
   * Get sync operation status
   * @param operationId Operation ID
   * @returns Promise resolving to operation status
   */
  async getSyncStatus(operationId: string): Promise<EHRApiResponse<SyncProgress>> {
    try {
      const progress = this.syncProgress.get(operationId);
      if (!progress) {
        const error: EHRApiError = {
          code: 'OPERATION_NOT_FOUND',
          message: `Sync operation not found: ${operationId}`,
          retryable: false
        };
        return { success: false, error };
      }

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

  /**
   * Cancel sync operation
   * @param operationId Operation ID
   * @returns Promise resolving to cancellation status
   */
  async cancelSync(operationId: string): Promise<EHRApiResponse<{ cancelled: boolean }>> {
    try {
      this.logInfo('Cancelling sync operation', { operationId });

      const operation = this.activeOperations.get(operationId);
      if (!operation) {
        const error: EHRApiError = {
          code: 'OPERATION_NOT_FOUND',
          message: `Sync operation not found: ${operationId}`,
          retryable: false
        };
        return { success: false, error };
      }

      // Update operation status
      operation.status = 'failed';
      operation.completedAt = new Date();

      // Update progress
      const progress = this.syncProgress.get(operationId);
      if (progress) {
        progress.status = 'failed';
        progress.currentPhase = 'Cancelled by user';
        progress.lastUpdated = new Date();
      }

      // Audit log the cancellation
      await this.auditLogger.log({
        action: 'sync_ehr_data',
        resourceType: 'sync_operation',
        resourceId: operationId,
        patientMrn: operation.patientMrn,
        success: true,
        context: {
          action: 'cancelled',
          recordsProcessed: operation.recordsProcessed
        }
      });

      // Clean up after a delay
      setTimeout(() => {
        this.activeOperations.delete(operationId);
        this.syncProgress.delete(operationId);
        this.conflicts.delete(operationId);
      }, 60000); // Keep for 1 minute

      this.logInfo('Sync operation cancelled successfully', { operationId });

      return {
        success: true,
        data: { cancelled: true },
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date(),
          processingTimeMs: 0
        }
      };

    } catch (error) {
      const apiError: EHRApiError = {
        code: 'SYNC_CANCEL_ERROR',
        message: 'Failed to cancel sync operation',
        details: error instanceof Error ? error.message : 'Unknown error',
        retryable: false
      };
      
      this.logError('Failed to cancel sync operation', apiError, { operationId });
      return { success: false, error: apiError };
    }
  }

  // ============================================================================
  // Conflict Management
  // ============================================================================

  /**
   * Get conflicts for a sync operation
   * @param operationId Operation ID
   * @returns Promise resolving to conflicts
   */
  async getConflicts(operationId: string): Promise<EHRApiResponse<SyncConflict[]>> {
    try {
      const conflicts = this.conflicts.get(operationId) || [];

      return {
        success: true,
        data: conflicts,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date(),
          processingTimeMs: 0
        }
      };

    } catch (error) {
      const apiError: EHRApiError = {
        code: 'CONFLICTS_RETRIEVAL_ERROR',
        message: 'Failed to retrieve sync conflicts',
        details: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };
      
      return { success: false, error: apiError };
    }
  }

  /**
   * Resolve a sync conflict
   * @param operationId Operation ID
   * @param conflictId Conflict ID
   * @param resolution Resolution strategy
   * @param customData Custom resolution data
   * @returns Promise resolving to resolution status
   */
  async resolveConflict(
    operationId: string,
    conflictId: string,
    resolution: 'use_source' | 'use_target' | 'merge' | 'custom',
    customData?: unknown
  ): Promise<EHRApiResponse<{ resolved: boolean }>> {
    try {
      this.logInfo('Resolving sync conflict', { operationId, conflictId, resolution });

      const conflicts = this.conflicts.get(operationId) || [];
      const conflict = conflicts.find(c => c.id === conflictId);

      if (!conflict) {
        const error: EHRApiError = {
          code: 'CONFLICT_NOT_FOUND',
          message: `Conflict not found: ${conflictId}`,
          retryable: false
        };
        return { success: false, error };
      }

      // Apply resolution
      let resolvedData: unknown;
      let resolutionDetails: string;

      switch (resolution) {
        case 'use_source':
          resolvedData = conflict.sourceData;
          resolutionDetails = 'Used source data';
          break;
        case 'use_target':
          resolvedData = conflict.targetData;
          resolutionDetails = 'Used target data';
          break;
        case 'merge':
          resolvedData = this.mergeData(conflict.sourceData, conflict.targetData);
          resolutionDetails = 'Merged source and target data';
          break;
        case 'custom':
          resolvedData = customData;
          resolutionDetails = 'Used custom resolution data';
          break;
        default:
          throw new Error(`Unknown resolution strategy: ${resolution}`);
      }

      // Update conflict status
      conflict.resolutionStatus = 'resolved';
      conflict.resolutionDetails = resolutionDetails;

      // Audit log the conflict resolution
      await this.auditLogger.log({
        action: 'sync_ehr_data',
        resourceType: 'sync_conflict',
        resourceId: conflictId,
        success: true,
        context: {
          action: 'resolved',
          operationId,
          resolution,
          dataType: conflict.dataType
        }
      });

      this.logInfo('Sync conflict resolved successfully', { operationId, conflictId, resolution });

      return {
        success: true,
        data: { resolved: true },
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date(),
          processingTimeMs: 0
        }
      };

    } catch (error) {
      const apiError: EHRApiError = {
        code: 'CONFLICT_RESOLUTION_ERROR',
        message: 'Failed to resolve sync conflict',
        details: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };
      
      this.logError('Failed to resolve sync conflict', apiError, { operationId, conflictId });
      return { success: false, error: apiError };
    }
  }

  // ============================================================================
  // Private Implementation Methods
  // ============================================================================

  /**
   * Perform the actual sync operation
   * @param operation Sync operation
   * @param ehrConfig EHR configuration
   * @param syncContext Sync context for dynamic intervals
   */
  private async performSyncOperation(
    operation: SyncOperation,
    ehrConfig: EHRConfiguration,
    syncContext: Partial<SyncIntervalContext> = {}
  ): Promise<void> {
    const progress = this.syncProgress.get(operation.id)!;
    
    try {
      this.logInfo('Performing sync operation', { operationId: operation.id });

      // Phase 1: Initialize and estimate work
      this.updateProgress(progress, 5, 'Estimating data volume');
      const estimatedRecords = await this.estimateRecordCount(ehrConfig, operation);
      operation.recordsTotal = estimatedRecords;
      progress.recordsTotal = estimatedRecords;

      // Phase 2: Fetch data from source
      this.updateProgress(progress, 20, 'Fetching data from EHR system');
      const sourceData = await this.fetchSourceData(ehrConfig, operation);

      // Phase 3: Process data types with dynamic intervals
      for (let i = 0; i < operation.dataTypes.length; i++) {
        const dataType = operation.dataTypes[i];
        const phaseProgress = 20 + (60 * (i + 1) / operation.dataTypes.length);
        
        this.updateProgress(progress, phaseProgress, `Processing ${dataType} data`);
        
        // Calculate dynamic interval for this specific data type
        const syncInterval = this.calculateSyncInterval(dataType, {
          ...syncContext,
          recentFailures: operation.errors.filter(e => e.dataType === dataType).length
        });
        
        await this.processSyncDataType(operation, ehrConfig, dataType, sourceData, syncInterval);
      }

      // Phase 4: Conflict resolution
      this.updateProgress(progress, 85, 'Resolving conflicts');
      await this.performConflictResolution(operation);

      // Phase 5: Finalize
      this.updateProgress(progress, 100, 'Finalizing sync operation');
      
      operation.status = 'completed';
      operation.completedAt = new Date();
      operation.successMessage = 'Sync completed successfully';
      
      progress.status = 'completed';
      progress.currentPhase = 'Completed';
      progress.lastUpdated = new Date();

      // Audit log successful completion
      await this.auditLogger.log({
        action: 'sync_ehr_data',
        resourceType: 'sync_operation',
        resourceId: operation.id,
        patientMrn: operation.patientMrn,
        ehrSystem: ehrConfig.systemType,
        success: true,
        context: {
          action: 'completed',
          recordsProcessed: operation.recordsProcessed,
          durationMs: operation.completedAt.getTime() - operation.startedAt.getTime()
        }
      });

      this.logInfo('Sync operation completed successfully', { 
        operationId: operation.id,
        recordsProcessed: operation.recordsProcessed,
        durationMs: operation.completedAt.getTime() - operation.startedAt.getTime()
      });

    } catch (error) {
      operation.status = 'failed';
      operation.completedAt = new Date();
      
      progress.status = 'failed';
      progress.currentPhase = 'Failed';
      progress.lastUpdated = new Date();

      const syncError: SyncError = {
        id: this.generateErrorId(),
        dataType: 'all',
        message: error instanceof Error ? error.message : 'Unknown sync error',
        details: error instanceof Error ? error.stack : undefined,
        retryable: true,
        timestamp: new Date()
      };

      operation.errors.push(syncError);

      // Audit log the failure
      await this.auditLogger.log({
        action: 'sync_ehr_data',
        resourceType: 'sync_operation',
        resourceId: operation.id,
        patientMrn: operation.patientMrn,
        ehrSystem: ehrConfig.systemType,
        success: false,
        errorMessage: syncError.message,
        context: {
          action: 'failed',
          recordsProcessed: operation.recordsProcessed,
          errorDetails: syncError.details
        }
      });

      this.logError('Sync operation failed', {
        code: 'SYNC_OPERATION_FAILED',
        message: syncError.message,
        details: syncError.details,
        retryable: true
      }, { operationId: operation.id });

      throw error;
    } finally {
      // Clean up after completion/failure (with delay for status queries)
      setTimeout(() => {
        this.activeOperations.delete(operation.id);
        this.syncProgress.delete(operation.id);
        if (operation.status !== 'failed') {
          this.conflicts.delete(operation.id);
        }
      }, 300000); // Keep for 5 minutes
    }
  }

  /**
   * Update sync progress
   * @param progress Progress object to update
   * @param progressPercent Progress percentage
   * @param currentPhase Current phase description
   */
  private updateProgress(
    progress: SyncProgress,
    progressPercent: number,
    currentPhase: string
  ): void {
    progress.progressPercent = Math.round(progressPercent);
    progress.currentPhase = currentPhase;
    progress.lastUpdated = new Date();

    // Update operation progress as well
    const operation = this.activeOperations.get(progress.operationId);
    if (operation) {
      operation.progressPercent = progress.progressPercent;
    }
  }

  /**
   * Estimate record count for sync operation
   * @param ehrConfig EHR configuration
   * @param operation Sync operation
   * @returns Estimated record count
   */
  private async estimateRecordCount(
    ehrConfig: EHRConfiguration,
    operation: SyncOperation
  ): Promise<number> {
    // Mock implementation - in real system, this would query EHR for counts
    let estimate = 0;
    
    for (const dataType of operation.dataTypes) {
      switch (dataType) {
        case 'all':
          estimate += 1000; // Estimate for all data
          break;
        case 'demographics':
          estimate += 1;
          break;
        case 'encounters':
          estimate += 50;
          break;
        case 'medications':
          estimate += 20;
          break;
        case 'lab_results':
          estimate += 100;
          break;
        default:
          estimate += 10;
          break;
      }
    }

    return estimate;
  }

  /**
   * Fetch source data from EHR
   * @param ehrConfig EHR configuration
   * @param operation Sync operation
   * @returns Source data
   */
  private async fetchSourceData(
    ehrConfig: EHRConfiguration,
    operation: SyncOperation
  ): Promise<Record<SyncDataType, unknown[]>> {
    // Mock implementation - in real system, this would fetch from EHR APIs
    const data: Record<string, unknown[]> = {};
    
    for (const dataType of operation.dataTypes) {
      data[dataType] = this.generateMockData(dataType, 10);
    }

    return data as Record<SyncDataType, unknown[]>;
  }

  /**
   * Process specific data type for sync
   * @param operation Sync operation
   * @param ehrConfig EHR configuration
   * @param dataType Data type to process
   * @param sourceData Source data
   * @param syncIntervalMs Dynamic sync interval for this data type
   */
  private async processSyncDataType(
    operation: SyncOperation,
    ehrConfig: EHRConfiguration,
    dataType: SyncDataType,
    sourceData: Record<SyncDataType, unknown[]>,
    syncIntervalMs: number
  ): Promise<void> {
    const records = sourceData[dataType] || [];
    const progress = this.syncProgress.get(operation.id)!;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      try {
        // Use dynamic interval for processing delay
        // For critical data, process faster; for non-essential data, add delay
        const criticality = this.dynamicSyncConfig.getDataTypeCriticality(dataType);
        let processingDelay = 50; // Default delay
        
        if (criticality === 'critical') {
          processingDelay = 25; // Faster processing for critical data
        } else if (criticality === 'non-essential') {
          processingDelay = 100; // Slower processing for non-essential data
        }
        
        await new Promise(resolve => setTimeout(resolve, processingDelay));

        // Process record with sync interval context
        await this.processRecord(operation, dataType, record, syncIntervalMs);
        
        operation.recordsProcessed++;
        progress.recordsProcessed++;
        progress.recordsSucceeded++;

      } catch (error) {
        const syncError: SyncError = {
          id: this.generateErrorId(),
          dataType,
          recordId: this.extractRecordId(record),
          message: error instanceof Error ? error.message : 'Record processing failed',
          details: error instanceof Error ? error.stack : undefined,
          retryable: true,
          timestamp: new Date()
        };

        operation.errors.push(syncError);
        progress.recordsFailed++;

        this.logError('Record processing failed', {
          code: 'RECORD_PROCESSING_ERROR',
          message: syncError.message,
          details: syncError.details,
          retryable: true
        }, { 
          operationId: operation.id,
          dataType,
          recordId: syncError.recordId
        });
      }
    }
  }

  /**
   * Process individual record
   * @param operation Sync operation
   * @param dataType Data type
   * @param record Record to process
   * @param syncIntervalMs Dynamic sync interval
   */
  private async processRecord(
    operation: SyncOperation,
    dataType: SyncDataType,
    record: unknown,
    syncIntervalMs: number
  ): Promise<void> {
    // Mock implementation - in real system, this would:
    // 1. Validate record
    // 2. Transform data format
    // 3. Check for conflicts
    // 4. Update target system
    
    // Simulate random conflicts
    if (Math.random() < 0.05) { // 5% chance of conflict
      await this.detectConflict(operation, dataType, record);
    }
  }

  /**
   * Detect and record sync conflict
   * @param operation Sync operation
   * @param dataType Data type
   * @param record Source record
   */
  private async detectConflict(
    operation: SyncOperation,
    dataType: SyncDataType,
    record: unknown
  ): Promise<void> {
    const conflict: SyncConflict = {
      id: this.generateConflictId(),
      dataType,
      sourceRecordId: this.extractRecordId(record),
      targetRecordId: this.extractRecordId(record),
      sourceData: record,
      targetData: this.generateMockTargetData(dataType),
      description: `Data conflict detected for ${dataType} record`,
      detectedAt: new Date(),
      resolutionStatus: 'pending'
    };

    const conflicts = this.conflicts.get(operation.id) || [];
    conflicts.push(conflict);
    this.conflicts.set(operation.id, conflicts);

    this.logInfo('Sync conflict detected', {
      operationId: operation.id,
      conflictId: conflict.id,
      dataType,
      recordId: conflict.sourceRecordId
    });
  }

  /**
   * Perform automatic conflict resolution
   * @param operation Sync operation
   */
  private async performConflictResolution(operation: SyncOperation): Promise<void> {
    if (!this.config.enableConflictResolution) {
      return;
    }

    const conflicts = this.conflicts.get(operation.id) || [];
    const pendingConflicts = conflicts.filter(c => c.resolutionStatus === 'pending');

    for (const conflict of pendingConflicts) {
      try {
        await this.autoResolveConflict(operation.id, conflict);
      } catch (error) {
        this.logError('Automatic conflict resolution failed', {
          code: 'AUTO_RESOLUTION_FAILED',
          message: error instanceof Error ? error.message : 'Unknown resolution error',
          retryable: false
        }, {
          operationId: operation.id,
          conflictId: conflict.id
        });
      }
    }
  }

  /**
   * Automatically resolve conflict based on strategy
   * @param operationId Operation ID
   * @param conflict Conflict to resolve
   */
  private async autoResolveConflict(operationId: string, conflict: SyncConflict): Promise<void> {
    let resolution: 'use_source' | 'use_target' | 'merge';

    switch (this.config.conflictResolutionStrategy) {
      case 'source_wins':
        resolution = 'use_source';
        break;
      case 'target_wins':
        resolution = 'use_target';
        break;
      case 'most_recent':
        // Mock logic - in real system, compare timestamps
        resolution = Math.random() > 0.5 ? 'use_source' : 'use_target';
        break;
      case 'manual':
        return; // Don't auto-resolve
      default:
        resolution = 'merge';
        break;
    }

    await this.resolveConflict(operationId, conflict.id, resolution);
  }

  /**
   * Merge data from source and target
   * @param sourceData Source data
   * @param targetData Target data
   * @returns Merged data
   */
  private mergeData(sourceData: unknown, targetData: unknown): unknown {
    // Mock implementation - in real system, this would have sophisticated merging logic
    if (typeof sourceData === 'object' && typeof targetData === 'object' && 
        sourceData !== null && targetData !== null) {
      return { ...targetData, ...sourceData };
    }
    return sourceData;
  }

  /**
   * Generate mock data for testing
   * @param dataType Data type
   * @param count Number of records
   * @returns Mock data array
   */
  private generateMockData(dataType: SyncDataType, count: number): unknown[] {
    const data: unknown[] = [];
    
    for (let i = 0; i < count; i++) {
      switch (dataType) {
        case 'demographics':
          data.push({
            id: `demo_${i}`,
            firstName: `Patient${i}`,
            lastName: 'Test',
            dateOfBirth: new Date(1980 + i, 0, 1)
          });
          break;
        case 'medications':
          data.push({
            id: `med_${i}`,
            name: `Medication ${i}`,
            dosage: '10mg',
            frequency: 'daily'
          });
          break;
        default:
          data.push({
            id: `${dataType}_${i}`,
            type: dataType,
            data: `Mock ${dataType} data ${i}`
          });
          break;
      }
    }
    
    return data;
  }

  /**
   * Generate mock target data for conflicts
   * @param dataType Data type
   * @returns Mock target data
   */
  private generateMockTargetData(dataType: SyncDataType): unknown {
    switch (dataType) {
      case 'demographics':
        return {
          id: 'target_demo',
          firstName: 'TargetPatient',
          lastName: 'Test',
          dateOfBirth: new Date(1980, 0, 1)
        };
      case 'medications':
        return {
          id: 'target_med',
          name: 'Target Medication',
          dosage: '5mg',
          frequency: 'twice daily'
        };
      default:
        return {
          id: `target_${dataType}`,
          type: dataType,
          data: `Mock target ${dataType} data`
        };
    }
  }

  /**
   * Extract record ID from record
   * @param record Record object
   * @returns Record ID
   */
  private extractRecordId(record: unknown): string {
    if (typeof record === 'object' && record !== null && 'id' in record) {
      return (record as { id: string }).id;
    }
    return `unknown_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  }

  /**
   * Get current system load (mock implementation)
   * In a real system, this would check CPU, memory, network, etc.
   * @returns System load factor (0.0 to 1.0)
   */
  private getCurrentSystemLoad(): number {
    // Mock implementation - in real system, this would check:
    // - CPU usage
    // - Memory usage  
    // - Network bandwidth
    // - Disk I/O
    // - Active sync operations
    
    const activeOperationsLoad = this.activeOperations.size / this.config.maxConcurrentSyncs;
    
    // Simulate some system variability
    const randomVariation = Math.random() * 0.2; // 0-20% random variation
    
    return Math.min(1.0, activeOperationsLoad + randomVariation);
  }

  /**
   * Generate unique operation ID
   * @returns Operation ID
   */
  private generateOperationId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique request ID
   * @returns Request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique error ID
   * @returns Error ID
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique conflict ID
   * @returns Conflict ID
   */
  private generateConflictId(): string {
    return `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log info message
   * @param message Info message
   * @param context Additional context
   */
  private logInfo(message: string, context?: Record<string, unknown>): void {
    console.log(`[Data Sync Service] ${message}`, context || {});
  }

  /**
   * Log error message
   * @param message Error message
   * @param error Error details
   * @param context Additional context
   */
  private logError(message: string, error: EHRApiError, context?: Record<string, unknown>): void {
    console.error(`[Data Sync Service] ${message}`, { error, context: context || {} });
  }
}

export default DataSyncService;