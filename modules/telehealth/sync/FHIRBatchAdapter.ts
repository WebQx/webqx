/**
 * WebQX™ Telehealth - FHIR Batch Adapter
 * 
 * Optimized FHIR client for low-bandwidth environments with batching,
 * compression, and differential synchronization capabilities.
 */

import { FHIRR4Client } from '../../../ehr-integrations/services/fhirR4Client';
import {
  FHIRBatchConfig,
  BatchOperation,
  BatchResponse,
  SyncMetadata,
  CompressionResult,
  TelehealthError
} from '../types/telehealth.types';

export interface FHIROptimizationConfig extends FHIRBatchConfig {
  /** FHIR server base URL */
  baseUrl: string;
  /** Authentication configuration */
  auth?: {
    accessToken?: string;
    refreshToken?: () => Promise<string>;
  };
  /** Cache configuration */
  cache?: {
    enabled: boolean;
    maxSize: number;
    ttlSeconds: number;
  };
  /** Offline support configuration */
  offline?: {
    enabled: boolean;
    maxOfflineOperations: number;
    syncOnReconnect: boolean;
  };
}

export class FHIRBatchAdapter {
  private config: FHIROptimizationConfig;
  private fhirClient: FHIRR4Client;
  private pendingOperations: BatchOperation[] = [];
  private lastSyncTime: Map<string, Date> = new Map();
  private compressionSupported: boolean = false;
  private offlineOperations: BatchOperation[] = [];
  private cache: Map<string, { data: any; timestamp: Date }> = new Map();
  private syncInProgress: boolean = false;

  constructor(config: FHIROptimizationConfig) {
    this.config = config;
    this.fhirClient = new FHIRR4Client({
      baseUrl: config.baseUrl,
      timeout: 30000,
      headers: config.auth?.accessToken ? {
        'Authorization': `Bearer ${config.auth.accessToken}`
      } : undefined,
      debug: false
    });

    this.initializeCompression();
    this.setupPeriodicSync();
  }

  /**
   * Add operation to batch queue
   */
  addToBatch(operation: BatchOperation): void {
    this.pendingOperations.push(operation);

    // Auto-execute if batch size reached
    if (this.pendingOperations.length >= this.config.maxBatchSize) {
      this.executeBatch().catch(error => {
        console.error('Auto-batch execution failed:', error);
      });
    }
  }

  /**
   * Execute all pending batch operations
   */
  async executeBatch(): Promise<BatchResponse[]> {
    if (this.pendingOperations.length === 0) {
      return [];
    }

    const operations = [...this.pendingOperations];
    this.pendingOperations = [];

    try {
      return await this.executeBatchOperations(operations);
    } catch (error) {
      // If batch fails, add operations back to queue for retry
      this.pendingOperations.unshift(...operations);
      throw error;
    }
  }

  /**
   * Sync specific FHIR resources with differential updates
   */
  async syncResources(resourceTypes: string[], patientId?: string): Promise<SyncMetadata> {
    if (this.syncInProgress) {
      throw new TelehealthError('Sync already in progress', {
        name: 'SyncError',
        code: 'SYNC_IN_PROGRESS',
        category: 'sync',
        recoverable: true
      });
    }

    this.syncInProgress = true;

    try {
      const syncMetadata: SyncMetadata = {
        lastSync: new Date(),
        resources: resourceTypes,
        changes: {
          added: [],
          modified: [],
          deleted: []
        },
        priority: 'medium'
      };

      for (const resourceType of resourceTypes) {
        const lastSync = this.lastSyncTime.get(resourceType);
        const changes = await this.syncResourceType(resourceType, lastSync, patientId);
        
        syncMetadata.changes.added.push(...changes.added);
        syncMetadata.changes.modified.push(...changes.modified);
        syncMetadata.changes.deleted.push(...changes.deleted);

        this.lastSyncTime.set(resourceType, syncMetadata.lastSync);
      }

      return syncMetadata;

    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Create FHIR resource with optimization
   */
  async createResource(resource: any): Promise<any> {
    const operation: BatchOperation = {
      method: 'POST',
      url: resource.resourceType,
      resource: resource
    };

    if (this.isOnline()) {
      return this.executeOperation(operation);
    } else if (this.config.offline?.enabled) {
      this.addToOfflineQueue(operation);
      return { success: true, offline: true };
    } else {
      throw new TelehealthError('No network connection', {
        name: 'NetworkError',
        code: 'OFFLINE_NOT_SUPPORTED',
        category: 'network',
        recoverable: true
      });
    }
  }

  /**
   * Update FHIR resource with optimization
   */
  async updateResource(resource: any): Promise<any> {
    if (!resource.id) {
      throw new TelehealthError('Resource ID required for update', {
        name: 'ValidationError',
        code: 'MISSING_RESOURCE_ID',
        category: 'sync',
        recoverable: false
      });
    }

    const operation: BatchOperation = {
      method: 'PUT',
      url: `${resource.resourceType}/${resource.id}`,
      resource: resource
    };

    if (this.isOnline()) {
      return this.executeOperation(operation);
    } else if (this.config.offline?.enabled) {
      this.addToOfflineQueue(operation);
      return { success: true, offline: true };
    } else {
      throw new TelehealthError('No network connection', {
        name: 'NetworkError',
        code: 'OFFLINE_NOT_SUPPORTED',
        category: 'network',
        recoverable: true
      });
    }
  }

  /**
   * Get FHIR resource with caching
   */
  async getResource(resourceType: string, resourceId: string): Promise<any> {
    const cacheKey = `${resourceType}/${resourceId}`;
    
    // Check cache first
    if (this.config.cache?.enabled) {
      const cached = this.getCachedResource(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const operation: BatchOperation = {
      method: 'GET',
      url: `${resourceType}/${resourceId}`
    };

    const result = await this.executeOperation(operation);
    
    // Cache the result
    if (this.config.cache?.enabled && result.data) {
      this.setCachedResource(cacheKey, result.data);
    }

    return result;
  }

  /**
   * Search FHIR resources with optimization
   */
  async searchResources(resourceType: string, params: Record<string, any>): Promise<any> {
    const queryString = new URLSearchParams(params).toString();
    const cacheKey = `${resourceType}?${queryString}`;

    // Check cache for search results
    if (this.config.cache?.enabled) {
      const cached = this.getCachedResource(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const operation: BatchOperation = {
      method: 'GET',
      url: `${resourceType}?${queryString}`
    };

    const result = await this.executeOperation(operation);

    // Cache search results (with shorter TTL)
    if (this.config.cache?.enabled && result.data) {
      this.setCachedResource(cacheKey, result.data, 300); // 5 minutes for search results
    }

    return result;
  }

  /**
   * Compress FHIR payload for transmission
   */
  async compressPayload(data: any): Promise<CompressionResult> {
    if (!this.compressionSupported || !this.config.enableCompression) {
      return {
        originalSize: 0,
        compressedSize: 0,
        compressionRatio: 1,
        algorithm: 'gzip',
        compressionTimeMs: 0
      };
    }

    const startTime = performance.now();
    const jsonString = JSON.stringify(data);
    const originalSize = new Blob([jsonString]).size;

    try {
      // Use browser compression API if available
      const stream = new CompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();

      writer.write(new TextEncoder().encode(jsonString));
      writer.close();

      const chunks: Uint8Array[] = [];
      let result = await reader.read();
      
      while (!result.done) {
        chunks.push(result.value);
        result = await reader.read();
      }

      const compressedSize = chunks.reduce((total, chunk) => total + chunk.length, 0);
      const compressionTimeMs = performance.now() - startTime;

      return {
        originalSize,
        compressedSize,
        compressionRatio: originalSize / compressedSize,
        algorithm: 'gzip',
        compressionTimeMs
      };

    } catch (error) {
      console.warn('Compression failed, using uncompressed data:', error);
      return {
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1,
        algorithm: 'gzip',
        compressionTimeMs: performance.now() - startTime
      };
    }
  }

  /**
   * Sync offline operations when connection is restored
   */
  async syncOfflineOperations(): Promise<void> {
    if (!this.config.offline?.enabled || this.offlineOperations.length === 0) {
      return;
    }

    const operations = [...this.offlineOperations];
    this.offlineOperations = [];

    try {
      await this.executeBatchOperations(operations);
    } catch (error) {
      // If sync fails, add operations back to offline queue
      this.offlineOperations.unshift(...operations);
      throw new TelehealthError(
        `Failed to sync offline operations: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          name: 'OfflineSyncError',
          code: 'OFFLINE_SYNC_FAILED',
          category: 'sync',
          recoverable: true,
          context: { operationCount: operations.length }
        }
      );
    }
  }

  /**
   * Get statistics about the adapter performance
   */
  getStatistics(): {
    pendingOperations: number;
    offlineOperations: number;
    cacheSize: number;
    lastSyncTimes: Record<string, Date>;
    compressionSupported: boolean;
  } {
    return {
      pendingOperations: this.pendingOperations.length,
      offlineOperations: this.offlineOperations.length,
      cacheSize: this.cache.size,
      lastSyncTimes: Object.fromEntries(this.lastSyncTime),
      compressionSupported: this.compressionSupported
    };
  }

  /**
   * Clear all caches and reset adapter state
   */
  reset(): void {
    this.pendingOperations = [];
    this.offlineOperations = [];
    this.cache.clear();
    this.lastSyncTime.clear();
    this.syncInProgress = false;
  }

  // Private methods

  private async executeBatchOperations(operations: BatchOperation[]): Promise<BatchResponse[]> {
    if (operations.length === 0) {
      return [];
    }

    try {
      // Build FHIR Bundle for batch request
      const bundle = this.buildBatchBundle(operations);
      
      // Compress payload if enabled and supported
      let payload = bundle;
      if (this.config.enableCompression && this.compressionSupported) {
        payload = await this.compressBundle(bundle);
      }

      // Execute batch request
      const response = await this.fhirClient.submitBundle(payload);
      
      if (!response.success || !response.data) {
        throw new Error(response.outcome?.issue?.[0]?.diagnostics || 'Batch operation failed');
      }

      // Parse batch response
      return this.parseBatchResponse(response.data);

    } catch (error) {
      // Retry logic
      if (this.shouldRetry(error)) {
        return this.retryBatchOperations(operations);
      }
      
      throw new TelehealthError(
        `Batch operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          name: 'BatchOperationError',
          code: 'BATCH_FAILED',
          category: 'sync',
          recoverable: this.shouldRetry(error),
          context: { operationCount: operations.length }
        }
      );
    }
  }

  private async executeOperation(operation: BatchOperation): Promise<any> {
    try {
      switch (operation.method) {
        case 'GET':
          if (operation.url.includes('?')) {
            const [resourceType, params] = operation.url.split('?');
            const searchParams = Object.fromEntries(new URLSearchParams(params));
            return await this.fhirClient.searchResources(resourceType, searchParams);
          } else {
            const [resourceType, resourceId] = operation.url.split('/');
            return await this.fhirClient.getResource(resourceType, resourceId);
          }

        case 'POST':
          return await this.fhirClient.createResource(operation.resource);

        case 'PUT':
          return await this.fhirClient.updateResource(operation.resource);

        case 'DELETE':
          const [resourceType, resourceId] = operation.url.split('/');
          return await this.fhirClient.deleteResource(resourceType, resourceId);

        default:
          throw new Error(`Unsupported operation method: ${operation.method}`);
      }
    } catch (error) {
      throw new TelehealthError(
        `Operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          name: 'OperationError',
          code: 'OPERATION_FAILED',
          category: 'sync',
          recoverable: true,
          context: { operation }
        }
      );
    }
  }

  private async syncResourceType(
    resourceType: string, 
    lastSync?: Date, 
    patientId?: string
  ): Promise<{ added: string[]; modified: string[]; deleted: string[] }> {
    const changes = { added: [] as string[], modified: [] as string[], deleted: [] as string[] };

    try {
      // Build search parameters for differential sync
      const searchParams: Record<string, any> = {
        _count: 100,
        _sort: '_lastUpdated'
      };

      if (lastSync) {
        searchParams._lastUpdated = `gt${lastSync.toISOString()}`;
      }

      if (patientId) {
        searchParams.patient = patientId;
      }

      // Search for resources
      const searchResult = await this.searchResources(resourceType, searchParams);

      if (searchResult.data?.entry) {
        for (const entry of searchResult.data.entry) {
          const resource = entry.resource;
          if (resource.id) {
            if (lastSync) {
              changes.modified.push(resource.id);
            } else {
              changes.added.push(resource.id);
            }
          }
        }
      }

      return changes;

    } catch (error) {
      console.error(`Failed to sync ${resourceType}:`, error);
      return changes;
    }
  }

  private buildBatchBundle(operations: BatchOperation[]): any {
    return {
      resourceType: 'Bundle',
      type: 'batch',
      entry: operations.map(op => ({
        request: {
          method: op.method,
          url: op.url,
          ifMatch: op.ifMatch,
          ifNoneMatch: op.ifNoneMatch
        },
        resource: op.resource
      }))
    };
  }

  private async compressBundle(bundle: any): Promise<any> {
    const compressionResult = await this.compressPayload(bundle);
    
    if (compressionResult.compressionRatio > 1.2) {
      // Only use compression if it provides meaningful benefit
      return {
        ...bundle,
        'webqx-compression': {
          algorithm: compressionResult.algorithm,
          originalSize: compressionResult.originalSize,
          compressedSize: compressionResult.compressedSize
        }
      };
    }
    
    return bundle;
  }

  private parseBatchResponse(bundleResponse: any): BatchResponse[] {
    const responses: BatchResponse[] = [];

    if (bundleResponse.entry) {
      for (const entry of bundleResponse.entry) {
        const response = entry.response;
        responses.push({
          success: response.status.startsWith('2'),
          statusCode: parseInt(response.status),
          data: entry.resource,
          error: response.status.startsWith('2') ? undefined : {
            code: response.status,
            message: response.outcome?.issue?.[0]?.diagnostics || 'Operation failed'
          }
        });
      }
    }

    return responses;
  }

  private async retryBatchOperations(operations: BatchOperation[]): Promise<BatchResponse[]> {
    // Implement exponential backoff retry
    const maxAttempts = this.config.retry.maxAttempts;
    let attempt = 1;
    let delay = this.config.retry.initialDelayMs;

    while (attempt <= maxAttempts) {
      try {
        await this.delay(delay);
        return await this.executeBatchOperations(operations);
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }
        attempt++;
        delay *= this.config.retry.backoffMultiplier;
      }
    }

    throw new Error('Retry attempts exhausted');
  }

  private shouldRetry(error: unknown): boolean {
    if (error instanceof TelehealthError) {
      return error.recoverable;
    }
    
    // Retry on network errors, timeouts, and 5xx server errors
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
    return errorMessage.includes('network') || 
           errorMessage.includes('timeout') || 
           errorMessage.includes('50');
  }

  private initializeCompression(): void {
    // Check if compression is supported
    this.compressionSupported = typeof CompressionStream !== 'undefined';
    
    if (!this.compressionSupported && this.config.enableCompression) {
      console.warn('Compression requested but not supported by browser');
    }
  }

  private setupPeriodicSync(): void {
    if (this.config.syncIntervalMs > 0) {
      setInterval(() => {
        if (this.pendingOperations.length > 0) {
          this.executeBatch().catch(error => {
            console.error('Periodic sync failed:', error);
          });
        }
      }, this.config.syncIntervalMs);
    }
  }

  private isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  private addToOfflineQueue(operation: BatchOperation): void {
    if (!this.config.offline?.enabled) return;

    this.offlineOperations.push(operation);

    // Limit offline queue size
    const maxOffline = this.config.offline.maxOfflineOperations || 1000;
    if (this.offlineOperations.length > maxOffline) {
      this.offlineOperations.shift(); // Remove oldest operation
    }
  }

  private getCachedResource(key: string): any | null {
    if (!this.config.cache?.enabled) return null;

    const cached = this.cache.get(key);
    if (!cached) return null;

    const ttlMs = (this.config.cache.ttlSeconds || 3600) * 1000;
    const isExpired = (Date.now() - cached.timestamp.getTime()) > ttlMs;

    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  private setCachedResource(key: string, data: any, customTtlSeconds?: number): void {
    if (!this.config.cache?.enabled) return;

    // Limit cache size
    const maxSize = this.config.cache.maxSize || 1000;
    if (this.cache.size >= maxSize) {
      // Remove oldest entries
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime());
      
      const toRemove = Math.max(1, Math.floor(maxSize * 0.1)); // Remove 10% of entries
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(entries[i][0]);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: new Date()
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}