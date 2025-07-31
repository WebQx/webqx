/**
 * PACS Clinical Sync Service
 * 
 * Main orchestration service for PACS clinical data synchronization
 * with HL7 ORM/ORU message processing and openEHR tagging.
 */

import {
  PACSConfiguration,
  ClinicalSyncOperation,
  ClinicalSyncError,
  ClinicalSyncFilter,
  PACSPerformanceMetrics,
  PACSAuditEvent,
  StartClinicalSyncRequest,
  PACSApiResponse,
  HL7MessageType,
  ProcessHL7MessageRequest,
  CreateOpenEHRMappingRequest
} from '../types/pacs-clinical-sync';

import HL7MessageProcessor from './hl7MessageProcessor';
import OpenEHRIntegrationService from './openEHRIntegrationService';
import { AuditLogger } from './auditLogger';

/**
 * PACS Clinical Sync configuration
 */
interface PACSClinicalSyncConfig {
  /** Maximum concurrent operations */
  maxConcurrentOperations: number;
  /** Operation timeout in milliseconds */
  operationTimeoutMs: number;
  /** Enable real-time synchronization */
  enableRealTimeSync: boolean;
  /** Batch processing size */
  batchSize: number;
  /** Retry configuration */
  retryConfig: {
    maxAttempts: number;
    initialDelayMs: number;
    backoffMultiplier: number;
    maxDelayMs: number;
  };
  /** Performance monitoring */
  performanceMonitoring: {
    enabled: boolean;
    metricsIntervalMs: number;
    retentionDays: number;
  };
  /** Security settings */
  security: {
    enableEncryption: boolean;
    encryptionAlgorithm: string;
    enableAccessControl: boolean;
    allowedOrigins: string[];
  };
}

/**
 * Default PACS Clinical Sync configuration
 */
const DEFAULT_PACS_CONFIG: PACSClinicalSyncConfig = {
  maxConcurrentOperations: 5,
  operationTimeoutMs: 300000, // 5 minutes
  enableRealTimeSync: true,
  batchSize: 50,
  retryConfig: {
    maxAttempts: 3,
    initialDelayMs: 1000,
    backoffMultiplier: 2,
    maxDelayMs: 30000
  },
  performanceMonitoring: {
    enabled: true,
    metricsIntervalMs: 60000, // 1 minute
    retentionDays: 30
  },
  security: {
    enableEncryption: true,
    encryptionAlgorithm: 'AES-256-GCM',
    enableAccessControl: true,
    allowedOrigins: ['*']
  }
};

/**
 * Operation status tracking
 */
interface OperationStatus {
  operation: ClinicalSyncOperation;
  promise: Promise<void>;
  controller: AbortController;
  startTime: Date;
}

/**
 * PACS Clinical Sync Service
 */
export class PACSClinicalSyncService {
  private config: PACSClinicalSyncConfig;
  private hl7Processor: HL7MessageProcessor;
  private openEHRService: OpenEHRIntegrationService;
  private auditLogger: AuditLogger;
  private pacsConfigurations: Map<string, PACSConfiguration> = new Map();
  private activeOperations: Map<string, OperationStatus> = new Map();
  private performanceMetrics: PACSPerformanceMetrics[] = [];
  private isInitialized = false;

  /**
   * Constructor
   */
  constructor(config: Partial<PACSClinicalSyncConfig> = {}) {
    this.config = { ...DEFAULT_PACS_CONFIG, ...config };
    this.hl7Processor = new HL7MessageProcessor();
    this.openEHRService = new OpenEHRIntegrationService();
    this.auditLogger = new AuditLogger();
    
    this.initializePerformanceMonitoring();
    this.isInitialized = true;
    
    this.logInfo('PACS Clinical Sync Service initialized', { config: this.config });
  }

  /**
   * Start clinical data synchronization
   */
  async startClinicalSync(request: StartClinicalSyncRequest): Promise<PACSApiResponse<ClinicalSyncOperation>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      this.logInfo('Starting clinical sync operation', { 
        requestId,
        pacsConfigId: request.pacsConfigId,
        patientMrn: request.patientMrn,
        syncType: request.syncType
      });

      // Validate request
      await this.validateSyncRequest(request);

      // Check concurrent operations limit
      if (this.activeOperations.size >= this.config.maxConcurrentOperations) {
        throw new Error(`Maximum concurrent operations limit reached: ${this.config.maxConcurrentOperations}`);
      }

      // Get PACS configuration
      const pacsConfig = this.pacsConfigurations.get(request.pacsConfigId);
      if (!pacsConfig) {
        throw new Error(`PACS configuration not found: ${request.pacsConfigId}`);
      }

      // Create sync operation
      const operation: ClinicalSyncOperation = {
        id: requestId,
        pacsConfigId: request.pacsConfigId,
        patientMrn: request.patientMrn,
        type: request.syncType,
        status: 'pending',
        priority: request.priority || 'normal',
        startedAt: new Date(),
        progressPercent: 0,
        messagesProcessed: 0,
        dataSynchronized: {
          orders: 0,
          results: 0,
          images: 0,
          reports: 0
        },
        errors: [],
        metadata: {
          requestId,
          userId: 'system', // In a real app, get from authentication context
          filters: request.filters
        }
      };

      // Start async operation
      const controller = new AbortController();
      const operationPromise = this.executeSync(operation, pacsConfig, request.options, controller.signal);
      
      // Track operation
      this.activeOperations.set(requestId, {
        operation,
        promise: operationPromise,
        controller,
        startTime: new Date()
      });

      // Audit log
      await this.auditLogger.log({
        action: 'sync_ehr_data',
        resourceType: 'clinical_sync_operation',
        resourceId: requestId,
        success: true,
        context: { 
          userId: 'system',
          syncType: request.syncType, 
          patientMrn: request.patientMrn 
        }
      });

      const processingTimeMs = Date.now() - startTime;
      this.logInfo('Clinical sync operation started', { 
        requestId,
        operationId: operation.id,
        processingTimeMs
      });

      return {
        success: true,
        data: operation,
        metadata: {
          requestId,
          timestamp: new Date(),
          processingTimeMs,
          version: '1.0.0'
        }
      };

    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      this.logError('Failed to start clinical sync', { 
        requestId,
        error: errorMessage,
        processingTimeMs
      });

      // Audit log
      await this.auditLogger.log({
        action: 'sync_ehr_data',
        resourceType: 'clinical_sync_operation',
        resourceId: requestId,
        success: false,
        errorMessage: errorMessage,
        context: { 
          userId: 'system',
          error: errorMessage 
        }
      });

      return {
        success: false,
        error: {
          code: 'SYNC_START_ERROR',
          message: errorMessage,
          details: error instanceof Error ? error.stack : undefined
        },
        metadata: {
          requestId,
          timestamp: new Date(),
          processingTimeMs,
          version: '1.0.0'
        }
      };
    }
  }

  /**
   * Execute synchronization operation
   */
  private async executeSync(
    operation: ClinicalSyncOperation,
    pacsConfig: PACSConfiguration,
    options: StartClinicalSyncRequest['options'],
    signal: AbortSignal
  ): Promise<void> {
    try {
      operation.status = 'in_progress';
      this.logInfo('Executing sync operation', { operationId: operation.id });

      // Simulate different sync types
      switch (operation.type) {
        case 'order_sync':
          await this.performOrderSync(operation, pacsConfig, signal);
          break;
        case 'result_sync':
          await this.performResultSync(operation, pacsConfig, signal);
          break;
        case 'full_sync':
          await this.performFullSync(operation, pacsConfig, signal);
          break;
        case 'real_time_sync':
          await this.performRealTimeSync(operation, pacsConfig, signal);
          break;
        default:
          throw new Error(`Unsupported sync type: ${operation.type}`);
      }

      operation.status = 'completed';
      operation.completedAt = new Date();
      operation.progressPercent = 100;

      this.logInfo('Sync operation completed successfully', { 
        operationId: operation.id,
        messagesProcessed: operation.messagesProcessed,
        dataSynchronized: operation.dataSynchronized
      });

    } catch (error) {
      operation.status = 'failed';
      operation.completedAt = new Date();
      
      const syncError: ClinicalSyncError = {
        id: this.generateErrorId(),
        type: 'other',
        code: 'SYNC_EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error instanceof Error ? error.stack : undefined,
        severity: 'error',
        retryable: true,
        timestamp: new Date(),
        context: { operationId: operation.id }
      };
      
      operation.errors.push(syncError);
      
      this.logError('Sync operation failed', { 
        operationId: operation.id,
        error: syncError.message
      });

    } finally {
      // Remove from active operations
      this.activeOperations.delete(operation.id);
    }
  }

  /**
   * Perform order synchronization
   */
  private async performOrderSync(
    operation: ClinicalSyncOperation,
    pacsConfig: PACSConfiguration,
    signal: AbortSignal
  ): Promise<void> {
    this.logInfo('Performing order sync', { operationId: operation.id });

    // Simulate processing ORM messages
    const mockORMMessages = this.generateMockORMMessages(5);
    operation.messagesTotal = mockORMMessages.length;

    for (const [index, message] of mockORMMessages.entries()) {
      if (signal.aborted) {
        throw new Error('Operation was cancelled');
      }

      try {
        // Process HL7 ORM message
        const hl7Request: ProcessHL7MessageRequest = {
          rawMessage: message,
          messageType: 'ORM',
          pacsConfigId: pacsConfig.id,
          options: {
            validateMessage: true,
            storeMessage: true,
            autoMapToOpenEHR: true
          }
        };

        const hl7Result = await this.hl7Processor.processMessage(hl7Request);
        if (!hl7Result.success) {
          throw new Error(`HL7 processing failed: ${hl7Result.error?.message}`);
        }

        // Map to OpenEHR if auto-mapping is enabled
        if (hl7Request.options?.autoMapToOpenEHR && hl7Result.data) {
          const openEHRRequest: CreateOpenEHRMappingRequest = {
            hl7MessageData: hl7Result.data.messageData as any,
            templateId: pacsConfig.openEHRSettings.defaultTemplateId,
            options: {
              validateComposition: true,
              storeComposition: true
            }
          };

          const openEHRResult = await this.openEHRService.createCompositionFromHL7(openEHRRequest);
          if (!openEHRResult.success) {
            this.logError('OpenEHR mapping failed', { 
              operationId: operation.id,
              error: openEHRResult.error?.message
            });
          }
        }

        operation.messagesProcessed++;
        operation.dataSynchronized.orders++;
        operation.progressPercent = Math.round((index + 1) / mockORMMessages.length * 100);

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        const syncError: ClinicalSyncError = {
          id: this.generateErrorId(),
          type: 'hl7_parsing',
          code: 'ORDER_PROCESSING_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          severity: 'warning',
          retryable: true,
          timestamp: new Date(),
          context: { messageIndex: index, operationId: operation.id }
        };
        
        operation.errors.push(syncError);
        this.logError('Order processing error', { 
          id: syncError.id,
          type: syncError.type,
          code: syncError.code,
          message: syncError.message,
          details: syncError.details,
          severity: syncError.severity,
          retryable: syncError.retryable,
          timestamp: syncError.timestamp.toISOString(),
          context: syncError.context
        });
      }
    }
  }

  /**
   * Perform result synchronization
   */
  private async performResultSync(
    operation: ClinicalSyncOperation,
    pacsConfig: PACSConfiguration,
    signal: AbortSignal
  ): Promise<void> {
    this.logInfo('Performing result sync', { operationId: operation.id });

    // Similar to order sync but for ORU messages
    const mockORUMessages = this.generateMockORUMessages(3);
    operation.messagesTotal = mockORUMessages.length;

    for (const [index, message] of mockORUMessages.entries()) {
      if (signal.aborted) {
        throw new Error('Operation was cancelled');
      }

      try {
        // Process HL7 ORU message
        const hl7Request: ProcessHL7MessageRequest = {
          rawMessage: message,
          messageType: 'ORU',
          pacsConfigId: pacsConfig.id,
          options: {
            validateMessage: true,
            storeMessage: true,
            autoMapToOpenEHR: true
          }
        };

        const hl7Result = await this.hl7Processor.processMessage(hl7Request);
        if (hl7Result.success && hl7Result.data) {
          operation.dataSynchronized.results++;
        }

        operation.messagesProcessed++;
        operation.progressPercent = Math.round((index + 1) / mockORUMessages.length * 100);

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 150));

      } catch (error) {
        const syncError: ClinicalSyncError = {
          id: this.generateErrorId(),
          type: 'hl7_parsing',
          code: 'RESULT_PROCESSING_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          severity: 'warning',
          retryable: true,
          timestamp: new Date(),
          context: { messageIndex: index, operationId: operation.id }
        };
        
        operation.errors.push(syncError);
      }
    }
  }

  /**
   * Perform full synchronization
   */
  private async performFullSync(
    operation: ClinicalSyncOperation,
    pacsConfig: PACSConfiguration,
    signal: AbortSignal
  ): Promise<void> {
    this.logInfo('Performing full sync', { operationId: operation.id });

    // Combine order and result sync
    await this.performOrderSync(operation, pacsConfig, signal);
    if (!signal.aborted) {
      await this.performResultSync(operation, pacsConfig, signal);
    }

    // Additional sync for images and reports
    operation.dataSynchronized.images = 10;
    operation.dataSynchronized.reports = 5;
  }

  /**
   * Perform real-time synchronization
   */
  private async performRealTimeSync(
    operation: ClinicalSyncOperation,
    pacsConfig: PACSConfiguration,
    signal: AbortSignal
  ): Promise<void> {
    this.logInfo('Performing real-time sync', { operationId: operation.id });

    // Real-time sync would typically involve listening to HL7 message streams
    // For demo purposes, simulate processing a few messages over time
    for (let i = 0; i < 5 && !signal.aborted; i++) {
      const message = this.generateMockORUMessages(1)[0];
      
      const hl7Request: ProcessHL7MessageRequest = {
        rawMessage: message,
        messageType: 'ORU',
        pacsConfigId: pacsConfig.id
      };

      await this.hl7Processor.processMessage(hl7Request);
      operation.messagesProcessed++;
      operation.progressPercent = Math.min(100, (i + 1) * 20);

      // Wait for next message (simulate real-time)
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  /**
   * Generate mock ORM messages for testing
   */
  private generateMockORMMessages(count: number): string[] {
    const messages: string[] = [];
    for (let i = 0; i < count; i++) {
      const message = `MSH|^~\\&|PACS|Hospital|WebQX|WebQX|20241215120000||ORM^O01|MSG${i}|P|2.5\r
PID|1||12345^^^Hospital^MR||Doe^John^M||19800101|M|||123 Main St^^Anytown^ST^12345\r
ORC|NW|ORD${i}|FIL${i}|||||||||^Radiologist^MD\r
OBR|1|ORD${i}|FIL${i}|36554-4^CHEST 2 VIEWS^LN|||20241215120000|||||||||||^Radiologist^MD|||||||||||||||||||^CHEST X-RAY\r`;
      messages.push(message);
    }
    return messages;
  }

  /**
   * Generate mock ORU messages for testing
   */
  private generateMockORUMessages(count: number): string[] {
    const messages: string[] = [];
    for (let i = 0; i < count; i++) {
      const message = `MSH|^~\\&|PACS|Hospital|WebQX|WebQX|20241215120000||ORU^R01|MSG${i}|P|2.5\r
PID|1||12345^^^Hospital^MR||Doe^John^M||19800101|M|||123 Main St^^Anytown^ST^12345\r
ORC|OK|ORD${i}|FIL${i}|||||||||^Radiologist^MD\r
OBR|1|ORD${i}|FIL${i}|36554-4^CHEST 2 VIEWS^LN|||20241215120000|||||||||||^Radiologist^MD||||||F||||||||||||||^CHEST X-RAY\r
OBX|1|ST|36554-4^CHEST 2 VIEWS^LN||Normal chest X-ray||||||F|||20241215120000\r`;
      messages.push(message);
    }
    return messages;
  }

  /**
   * Validate sync request
   */
  private async validateSyncRequest(request: StartClinicalSyncRequest): Promise<void> {
    if (!request.pacsConfigId) {
      throw new Error('PACS configuration ID is required');
    }
    if (!request.patientMrn) {
      throw new Error('Patient MRN is required');
    }
    if (!['order_sync', 'result_sync', 'full_sync', 'real_time_sync'].includes(request.syncType)) {
      throw new Error('Invalid sync type');
    }
  }

  /**
   * Get sync operation status
   */
  async getSyncOperationStatus(operationId: string): Promise<PACSApiResponse<ClinicalSyncOperation>> {
    const operationStatus = this.activeOperations.get(operationId);
    
    if (!operationStatus) {
      return {
        success: false,
        error: {
          code: 'OPERATION_NOT_FOUND',
          message: `Sync operation not found: ${operationId}`
        },
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date(),
          processingTimeMs: 0,
          version: '1.0.0'
        }
      };
    }

    return {
      success: true,
      data: operationStatus.operation,
      metadata: {
        requestId: this.generateRequestId(),
        timestamp: new Date(),
        processingTimeMs: 0,
        version: '1.0.0'
      }
    };
  }

  /**
   * Cancel sync operation
   */
  async cancelSyncOperation(operationId: string): Promise<PACSApiResponse<void>> {
    const operationStatus = this.activeOperations.get(operationId);
    
    if (!operationStatus) {
      return {
        success: false,
        error: {
          code: 'OPERATION_NOT_FOUND',
          message: `Sync operation not found: ${operationId}`
        },
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date(),
          processingTimeMs: 0,
          version: '1.0.0'
        }
      };
    }

    // Cancel the operation
    operationStatus.controller.abort();
    operationStatus.operation.status = 'cancelled';
    operationStatus.operation.completedAt = new Date();

    this.logInfo('Sync operation cancelled', { operationId });

    return {
      success: true,
      metadata: {
        requestId: this.generateRequestId(),
        timestamp: new Date(),
        processingTimeMs: 0,
        version: '1.0.0'
      }
    };
  }

  /**
   * Configure PACS system
   */
  configurePACS(config: PACSConfiguration): void {
    this.pacsConfigurations.set(config.id, config);
    this.logInfo('PACS configuration added', { 
      configId: config.id,
      name: config.name,
      vendor: config.vendor
    });
  }

  /**
   * Remove PACS configuration
   */
  removePACSConfiguration(configId: string): boolean {
    const removed = this.pacsConfigurations.delete(configId);
    if (removed) {
      this.logInfo('PACS configuration removed', { configId });
    }
    return removed;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(limit: number = 100): PACSPerformanceMetrics[] {
    return this.performanceMetrics.slice(-limit);
  }

  /**
   * Initialize performance monitoring
   */
  private initializePerformanceMonitoring(): void {
    if (!this.config.performanceMonitoring.enabled) return;

    setInterval(() => {
      const metrics: PACSPerformanceMetrics = {
        timestamp: new Date(),
        operationId: 'system',
        processingTimeMs: 0,
        queueDepth: this.activeOperations.size,
        throughputMps: this.calculateThroughput(),
        errorRatePercent: this.calculateErrorRate(),
        memoryUsageMB: this.getMemoryUsage(),
        cpuUsagePercent: 0, // Would need system monitoring
        networkLatencyMs: 0, // Would need network monitoring
        cacheHitRatePercent: 0 // Would need cache monitoring
      };

      this.performanceMetrics.push(metrics);

      // Clean up old metrics
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.performanceMonitoring.retentionDays);
      this.performanceMetrics = this.performanceMetrics.filter(
        m => m.timestamp > cutoffDate
      );

    }, this.config.performanceMonitoring.metricsIntervalMs);
  }

  /**
   * Calculate throughput (messages per second)
   */
  private calculateThroughput(): number {
    // Simple calculation based on recent operations
    const recentOps = Array.from(this.activeOperations.values()).filter(
      op => new Date().getTime() - op.startTime.getTime() < 60000 // Last minute
    );
    
    const totalMessages = recentOps.reduce((sum, op) => sum + op.operation.messagesProcessed, 0);
    return totalMessages / 60; // Messages per second
  }

  /**
   * Calculate error rate percentage
   */
  private calculateErrorRate(): number {
    const recentOps = Array.from(this.activeOperations.values());
    if (recentOps.length === 0) return 0;

    const totalErrors = recentOps.reduce((sum, op) => sum + op.operation.errors.length, 0);
    const totalMessages = recentOps.reduce((sum, op) => sum + op.operation.messagesProcessed, 0);
    
    return totalMessages > 0 ? (totalErrors / totalMessages) * 100 : 0;
  }

  /**
   * Get memory usage in MB
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed / 1024 / 1024;
    }
    return 0;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `pacs_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  }

  /**
   * Get service statistics
   */
  getServiceStats() {
    return {
      isInitialized: this.isInitialized,
      pacsConfigurationsCount: this.pacsConfigurations.size,
      activeOperationsCount: this.activeOperations.size,
      maxConcurrentOperations: this.config.maxConcurrentOperations,
      performanceMetricsCount: this.performanceMetrics.length,
      hl7ProcessorStats: this.hl7Processor.getProcessingStats(),
      openEHRServiceStats: this.openEHRService.getServiceStats()
    };
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    this.logInfo('Shutting down PACS Clinical Sync Service');

    // Cancel all active operations
    for (const [operationId, operationStatus] of this.activeOperations) {
      operationStatus.controller.abort();
      this.logInfo('Cancelled operation during shutdown', { operationId });
    }

    // Clear caches
    this.openEHRService.clearCaches();
    this.hl7Processor.clearProcessedMessages();

    // Clear metrics
    this.performanceMetrics = [];

    this.isInitialized = false;
    this.logInfo('PACS Clinical Sync Service shutdown complete');
  }

  /**
   * Log info message
   */
  private logInfo(message: string, context?: Record<string, unknown>): void {
    console.log(`[PACS Clinical Sync Service] ${message}`, context || {});
  }

  /**
   * Log error message
   */
  private logError(message: string, context?: Record<string, unknown>): void {
    console.error(`[PACS Clinical Sync Service] ${message}`, context || {});
  }
}

export default PACSClinicalSyncService;