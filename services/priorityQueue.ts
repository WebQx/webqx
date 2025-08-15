/**
 * Priority Queue Implementation for WebQX Healthcare Platform
 * Handles critical data processing with priority-based queueing
 */

export interface QueueItem<T = any> {
  id: string;
  data: T;
  priority: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface QueueMetrics {
  totalItems: number;
  processingItems: number;
  completedItems: number;
  averageProcessingTime: number;
  queueLengthByPriority: Record<number, number>;
  lastProcessedTime?: Date;
}

export interface PriorityQueueConfig {
  maxQueueSize?: number;
  enableMetrics?: boolean;
  enableLogging?: boolean;
  processingTimeoutMs?: number;
}

/**
 * Priority Queue for handling critical healthcare data processing
 * Higher priority numbers are processed first
 */
export class PriorityQueue<T = any> {
  private queue: QueueItem<T>[] = [];
  private processing: Set<string> = new Set();
  private completed: Map<string, { item: QueueItem<T>; processingTime: number }> = new Map();
  private config: Required<PriorityQueueConfig>;
  private metrics: QueueMetrics;

  constructor(config: PriorityQueueConfig = {}) {
    this.config = {
      maxQueueSize: config.maxQueueSize ?? 1000,
      enableMetrics: config.enableMetrics ?? true,
      enableLogging: config.enableLogging ?? false,
      processingTimeoutMs: config.processingTimeoutMs ?? 300000 // 5 minutes
    };

    this.metrics = {
      totalItems: 0,
      processingItems: 0,
      completedItems: 0,
      averageProcessingTime: 0,
      queueLengthByPriority: {}
    };
  }

  /**
   * Add item to priority queue
   * @param item - Item to add to queue
   * @param priority - Priority level (higher = more urgent)
   * @param metadata - Optional metadata for the item
   */
  enqueue(item: T, priority: number, metadata?: Record<string, any>): string {
    if (this.queue.length >= this.config.maxQueueSize) {
      throw new Error(`Queue is full. Maximum size: ${this.config.maxQueueSize}`);
    }

    const queueItem: QueueItem<T> = {
      id: this.generateId(),
      data: item,
      priority,
      timestamp: new Date(),
      metadata
    };

    // Insert item in priority order (higher priority first)
    const insertIndex = this.findInsertIndex(priority);
    this.queue.splice(insertIndex, 0, queueItem);

    this.updateMetrics();
    
    if (this.config.enableLogging) {
      console.log(`[PriorityQueue] Enqueued item ${queueItem.id} with priority ${priority}`);
    }

    return queueItem.id;
  }

  /**
   * Remove and return highest priority item
   */
  dequeue(): QueueItem<T> | null {
    if (this.queue.length === 0) {
      return null;
    }

    const item = this.queue.shift()!;
    this.processing.add(item.id);
    this.updateMetrics();

    if (this.config.enableLogging) {
      console.log(`[PriorityQueue] Dequeued item ${item.id} with priority ${item.priority}`);
    }

    return item;
  }

  /**
   * Peek at next item without removing it
   */
  peek(): QueueItem<T> | null {
    return this.queue[0] || null;
  }

  /**
   * Mark item as completed processing
   */
  markCompleted(itemId: string): void {
    if (!this.processing.has(itemId)) {
      if (this.config.enableLogging) {
        console.warn(`[PriorityQueue] Attempted to mark non-processing item as completed: ${itemId}`);
      }
      return;
    }

    this.processing.delete(itemId);
    
    // Calculate processing time if we have the original item
    const completedItem = this.findCompletedItem(itemId);
    if (completedItem) {
      const processingTime = Date.now() - completedItem.timestamp.getTime();
      this.completed.set(itemId, { item: completedItem, processingTime });
    }

    this.updateMetrics();

    if (this.config.enableLogging) {
      console.log(`[PriorityQueue] Marked item ${itemId} as completed`);
    }
  }

  /**
   * Mark item as failed and optionally re-queue with adjusted priority
   */
  markFailed(itemId: string, requeue: boolean = false, newPriority?: number, originalItem?: QueueItem<T>): void {
    if (!this.processing.has(itemId)) {
      return;
    }

    this.processing.delete(itemId);
    
    if (requeue && originalItem) {
      const priority = newPriority ?? Math.max(0, originalItem.priority - 1);
      this.enqueue(originalItem.data, priority, {
        ...originalItem.metadata,
        retryCount: (originalItem.metadata?.retryCount || 0) + 1,
        lastFailure: new Date().toISOString()
      });
    }

    this.updateMetrics();

    if (this.config.enableLogging) {
      console.log(`[PriorityQueue] Marked item ${itemId} as failed${requeue ? ' and re-queued' : ''}`);
    }
  }

  /**
   * Get current queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Get items by priority level
   */
  getItemsByPriority(priority: number): QueueItem<T>[] {
    return this.queue.filter(item => item.priority === priority);
  }

  /**
   * Get current queue metrics
   */
  getMetrics(): QueueMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear all items from queue
   */
  clear(): void {
    this.queue = [];
    this.processing.clear();
    this.completed.clear();
    this.updateMetrics();

    if (this.config.enableLogging) {
      console.log('[PriorityQueue] Queue cleared');
    }
  }

  /**
   * Get all queue items (for monitoring/debugging)
   */
  getAllItems(): QueueItem<T>[] {
    return [...this.queue];
  }

  /**
   * Remove specific item from queue by ID
   */
  removeItem(itemId: string): boolean {
    const index = this.queue.findIndex(item => item.id === itemId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.updateMetrics();
      return true;
    }
    return false;
  }

  private findInsertIndex(priority: number): number {
    let left = 0;
    let right = this.queue.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.queue[mid].priority >= priority) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    return left;
  }

  private findCompletedItem(itemId: string): QueueItem<T> | null {
    // This is a simplified approach - in a real implementation,
    // you might want to keep a separate map of processing items
    return null;
  }

  private updateMetrics(): void {
    if (!this.config.enableMetrics) {
      return;
    }

    this.metrics.totalItems = this.queue.length + this.processing.size + this.completed.size;
    this.metrics.processingItems = this.processing.size;
    this.metrics.completedItems = this.completed.size;

    // Calculate queue length by priority
    this.metrics.queueLengthByPriority = {};
    for (const item of this.queue) {
      this.metrics.queueLengthByPriority[item.priority] = 
        (this.metrics.queueLengthByPriority[item.priority] || 0) + 1;
    }

    // Calculate average processing time
    if (this.completed.size > 0) {
      const totalProcessingTime = Array.from(this.completed.values())
        .reduce((sum, { processingTime }) => sum + processingTime, 0);
      this.metrics.averageProcessingTime = totalProcessingTime / this.completed.size;
    }

    this.metrics.lastProcessedTime = new Date();
  }

  private generateId(): string {
    return `pq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Utility class for common healthcare priority levels
 */
export class HealthcarePriorities {
  static readonly CRITICAL = 100;  // Life-threatening, immediate processing
  static readonly URGENT = 75;     // Urgent care, process within minutes
  static readonly HIGH = 50;       // High priority, process within hours
  static readonly MEDIUM = 25;     // Standard priority, process within day
  static readonly LOW = 10;        // Low priority, process when resources available
  static readonly BACKGROUND = 1;  // Background tasks, process during low activity

  /**
   * Convert string priority to numeric value
   */
  static fromString(priority: string): number {
    const priorities: Record<string, number> = {
      'critical': HealthcarePriorities.CRITICAL,
      'urgent': HealthcarePriorities.URGENT,
      'high': HealthcarePriorities.HIGH,
      'medium': HealthcarePriorities.MEDIUM,
      'low': HealthcarePriorities.LOW,
      'background': HealthcarePriorities.BACKGROUND
    };

    return priorities[priority.toLowerCase()] ?? HealthcarePriorities.MEDIUM;
  }

  /**
   * Convert numeric priority to string
   */
  static toString(priority: number): string {
    if (priority >= HealthcarePriorities.CRITICAL) return 'critical';
    if (priority >= HealthcarePriorities.URGENT) return 'urgent';
    if (priority >= HealthcarePriorities.HIGH) return 'high';
    if (priority >= HealthcarePriorities.MEDIUM) return 'medium';
    if (priority >= HealthcarePriorities.LOW) return 'low';
    return 'background';
  }
}