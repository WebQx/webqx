/**
 * Dynamic Batch Manager
 * Manages dynamic batch size calculations and adjustments based on server load
 */

import { EventEmitter } from 'events';
import { ServerLoadMonitor, ServerLoadMetrics } from './serverLoadMonitor';

export interface BatchSizeConfig {
  minBatchSize: number;
  maxBatchSize: number;
  defaultBatchSize: number;
  lowLoadThreshold: number; // Server load percentage below which to use large batches
  highLoadThreshold: number; // Server load percentage above which to use small batches
}

export interface BatchAdjustmentEvent {
  operation: string;
  previousBatchSize: number;
  newBatchSize: number;
  serverLoad: number;
  timestamp: Date;
  reason: string;
}

export class DynamicBatchManager extends EventEmitter {
  private serverLoadMonitor: ServerLoadMonitor;
  private config: BatchSizeConfig;
  private currentBatchSizes: Map<string, number> = new Map();
  private lastAdjustments: Map<string, Date> = new Map();
  private adjustmentCooldown: number = 5000; // 5 seconds minimum between adjustments
  private enableLogging: boolean;

  constructor(
    serverLoadMonitor: ServerLoadMonitor,
    config: Partial<BatchSizeConfig> = {},
    enableLogging: boolean = false
  ) {
    super();
    this.serverLoadMonitor = serverLoadMonitor;
    this.config = {
      minBatchSize: config.minBatchSize ?? 5,
      maxBatchSize: config.maxBatchSize ?? 100,
      defaultBatchSize: config.defaultBatchSize ?? 25,
      lowLoadThreshold: config.lowLoadThreshold ?? 50,
      highLoadThreshold: config.highLoadThreshold ?? 80,
      ...config
    };
    this.enableLogging = enableLogging;

    // Listen for server load changes
    this.serverLoadMonitor.on('metrics', (metrics: ServerLoadMetrics) => {
      this.handleLoadChange(metrics);
    });

    this.serverLoadMonitor.on('error', (error: Error) => {
      this.emit('monitoringError', error);
    });
  }

  /**
   * Calculate optimal batch size based on current server load
   */
  public calculateBatchSize(
    serverLoad: number,
    operation: string = 'default'
  ): number {
    // Implementation of the example function from the problem statement
    if (serverLoad < this.config.lowLoadThreshold) {
      return this.config.maxBatchSize; // Low load: large batches
    }
    
    if (serverLoad < this.config.highLoadThreshold) {
      // Medium load: scaled batch size
      const loadRatio = (serverLoad - this.config.lowLoadThreshold) / 
                       (this.config.highLoadThreshold - this.config.lowLoadThreshold);
      const batchRange = this.config.maxBatchSize - this.config.minBatchSize;
      return Math.round(this.config.maxBatchSize - (loadRatio * batchRange));
    }
    
    return this.config.minBatchSize; // High load: small batches
  }

  /**
   * Get current batch size for a specific operation
   */
  public getBatchSize(operation: string): number {
    // Check if we have a recent batch size for this operation
    if (this.currentBatchSizes.has(operation)) {
      return this.currentBatchSizes.get(operation)!;
    }

    // Calculate new batch size based on current server load
    const serverLoad = this.serverLoadMonitor.getServerLoad();
    const batchSize = this.calculateBatchSize(serverLoad, operation);
    
    this.currentBatchSizes.set(operation, batchSize);
    return batchSize;
  }

  /**
   * Get fallback batch size when monitoring is unavailable
   */
  public getFallbackBatchSize(operation: string): number {
    if (this.enableLogging) {
      console.warn(`[DynamicBatchManager] Using fallback batch size for operation: ${operation}`);
    }
    return this.config.defaultBatchSize;
  }

  /**
   * Handle server load changes and adjust batch sizes accordingly
   */
  private handleLoadChange(metrics: ServerLoadMetrics): void {
    const serverLoad = this.serverLoadMonitor.getServerLoad();
    
    // Update batch sizes for all tracked operations
    for (const [operation, currentBatchSize] of this.currentBatchSizes) {
      const newBatchSize = this.calculateBatchSize(serverLoad, operation);
      
      // Only adjust if there's a significant change and cooldown period has passed
      if (this.shouldAdjustBatchSize(operation, currentBatchSize, newBatchSize)) {
        this.adjustBatchSize(operation, currentBatchSize, newBatchSize, serverLoad);
      }
    }
  }

  /**
   * Determine if batch size should be adjusted
   */
  private shouldAdjustBatchSize(
    operation: string,
    currentSize: number,
    newSize: number
  ): boolean {
    // Check if there's a significant change (at least 20% or minimum of 2)
    const changeThreshold = Math.max(2, Math.round(currentSize * 0.2));
    const sizeDifference = Math.abs(newSize - currentSize);
    
    if (sizeDifference < changeThreshold) {
      return false;
    }

    // Check cooldown period
    const lastAdjustment = this.lastAdjustments.get(operation);
    if (lastAdjustment) {
      const timeSinceLastAdjustment = Date.now() - lastAdjustment.getTime();
      if (timeSinceLastAdjustment < this.adjustmentCooldown) {
        return false;
      }
    }

    return true;
  }

  /**
   * Adjust batch size for an operation
   */
  private adjustBatchSize(
    operation: string,
    previousSize: number,
    newSize: number,
    serverLoad: number
  ): void {
    this.currentBatchSizes.set(operation, newSize);
    this.lastAdjustments.set(operation, new Date());

    const adjustmentEvent: BatchAdjustmentEvent = {
      operation,
      previousBatchSize: previousSize,
      newBatchSize: newSize,
      serverLoad,
      timestamp: new Date(),
      reason: this.getBatchAdjustmentReason(serverLoad)
    };

    if (this.enableLogging) {
      console.log(`[DynamicBatchManager] Adjusted batch size for ${operation}: ${previousSize} → ${newSize} (load: ${serverLoad}%)`);
    }

    this.emit('batchSizeAdjusted', adjustmentEvent);
  }

  /**
   * Get human-readable reason for batch adjustment
   */
  private getBatchAdjustmentReason(serverLoad: number): string {
    if (serverLoad < this.config.lowLoadThreshold) {
      return 'Low server load - increased batch size for better throughput';
    } else if (serverLoad < this.config.highLoadThreshold) {
      return 'Medium server load - moderate batch size for balanced performance';
    } else {
      return 'High server load - reduced batch size to prevent overload';
    }
  }

  /**
   * Register a new operation for batch size tracking
   */
  public registerOperation(operation: string, initialBatchSize?: number): void {
    if (!this.currentBatchSizes.has(operation)) {
      const batchSize = initialBatchSize ?? this.getBatchSize(operation);
      this.currentBatchSizes.set(operation, batchSize);
      
      if (this.enableLogging) {
        console.log(`[DynamicBatchManager] Registered operation: ${operation} with batch size: ${batchSize}`);
      }
    }
  }

  /**
   * Get batch adjustment statistics
   */
  public getStatistics(): {
    operations: string[];
    currentBatchSizes: Record<string, number>;
    lastServerLoad: number;
    totalAdjustments: number;
  } {
    return {
      operations: Array.from(this.currentBatchSizes.keys()),
      currentBatchSizes: Object.fromEntries(this.currentBatchSizes),
      lastServerLoad: this.serverLoadMonitor.getServerLoad(),
      totalAdjustments: this.lastAdjustments.size
    };
  }

  /**
   * Start monitoring and dynamic adjustments
   */
  public start(): void {
    this.serverLoadMonitor.start();
    if (this.enableLogging) {
      console.log('[DynamicBatchManager] Started dynamic batch size management');
    }
  }

  /**
   * Stop monitoring and dynamic adjustments
   */
  public stop(): void {
    this.serverLoadMonitor.stop();
    if (this.enableLogging) {
      console.log('[DynamicBatchManager] Stopped dynamic batch size management');
    }
  }
}