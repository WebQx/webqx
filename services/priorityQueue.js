/**
 * Priority Queue Implementation for WebQX Healthcare Platform (JavaScript)
 * Handles critical data processing with priority-based queueing
 */

/**
 * Priority Queue for handling critical healthcare data processing
 * Higher priority numbers are processed first
 */
class PriorityQueue {
  constructor(config = {}) {
    this.config = {
      maxQueueSize: config.maxQueueSize || 1000,
      enableMetrics: config.enableMetrics !== false,
      enableLogging: config.enableLogging || false,
      processingTimeoutMs: config.processingTimeoutMs || 300000 // 5 minutes
    };

    this.queue = [];
    this.processing = new Set();
    this.completed = new Map();
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
   * @param {*} item - Item to add to queue
   * @param {number} priority - Priority level (higher = more urgent)
   * @param {Object} metadata - Optional metadata for the item
   * @returns {string} - Queue item ID
   */
  enqueue(item, priority, metadata = {}) {
    if (this.queue.length >= this.config.maxQueueSize) {
      throw new Error(`Queue is full. Maximum size: ${this.config.maxQueueSize}`);
    }

    const queueItem = {
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
   * @returns {Object|null} - Queue item or null if empty
   */
  dequeue() {
    if (this.queue.length === 0) {
      return null;
    }

    const item = this.queue.shift();
    this.processing.add(item.id);
    this.updateMetrics();

    if (this.config.enableLogging) {
      console.log(`[PriorityQueue] Dequeued item ${item.id} with priority ${item.priority}`);
    }

    return item;
  }

  /**
   * Peek at next item without removing it
   * @returns {Object|null} - Next queue item or null if empty
   */
  peek() {
    return this.queue[0] || null;
  }

  /**
   * Mark item as completed processing
   * @param {string} itemId - ID of completed item
   */
  markCompleted(itemId) {
    if (!this.processing.has(itemId)) {
      if (this.config.enableLogging) {
        console.warn(`[PriorityQueue] Attempted to mark non-processing item as completed: ${itemId}`);
      }
      return;
    }

    this.processing.delete(itemId);
    
    // Calculate processing time if we have the original item
    const completedItem = this.findProcessingItem(itemId);
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
   * @param {string} itemId - ID of failed item
   * @param {boolean} requeue - Whether to re-queue the item
   * @param {number} newPriority - New priority for re-queued item
   * @param {Object} originalItem - Original queue item (needed for requeue)
   */
  markFailed(itemId, requeue = false, newPriority = null, originalItem = null) {
    if (!this.processing.has(itemId)) {
      return;
    }

    this.processing.delete(itemId);
    
    if (requeue && originalItem) {
      const priority = newPriority !== null ? newPriority : Math.max(0, originalItem.priority - 1);
      this.enqueue(originalItem.data, priority, {
        ...originalItem.metadata,
        retryCount: (originalItem.metadata.retryCount || 0) + 1,
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
   * @returns {number} - Number of items in queue
   */
  size() {
    return this.queue.length;
  }

  /**
   * Check if queue is empty
   * @returns {boolean} - True if queue is empty
   */
  isEmpty() {
    return this.queue.length === 0;
  }

  /**
   * Get items by priority level
   * @param {number} priority - Priority level to filter by
   * @returns {Array} - Items with specified priority
   */
  getItemsByPriority(priority) {
    return this.queue.filter(item => item.priority === priority);
  }

  /**
   * Get current queue metrics
   * @returns {Object} - Queue metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Clear all items from queue
   */
  clear() {
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
   * @returns {Array} - All queue items
   */
  getAllItems() {
    return [...this.queue];
  }

  /**
   * Remove specific item from queue by ID
   * @param {string} itemId - ID of item to remove
   * @returns {boolean} - True if item was removed
   */
  removeItem(itemId) {
    const index = this.queue.findIndex(item => item.id === itemId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.updateMetrics();
      return true;
    }
    return false;
  }

  /**
   * Find insertion index for new item based on priority
   * @private
   */
  findInsertIndex(priority) {
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

  /**
   * Find processing item by ID (simplified implementation)
   * @private
   */
  findProcessingItem(itemId) {
    // In a real implementation, you might want to keep a separate map of processing items
    return null;
  }

  /**
   * Update queue metrics
   * @private
   */
  updateMetrics() {
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

  /**
   * Generate unique ID for queue items
   * @private
   */
  generateId() {
    return `pq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Utility class for common healthcare priority levels
 */
class HealthcarePriorities {
  static get CRITICAL() { return 100; }  // Life-threatening, immediate processing
  static get URGENT() { return 75; }     // Urgent care, process within minutes
  static get HIGH() { return 50; }       // High priority, process within hours
  static get MEDIUM() { return 25; }     // Standard priority, process within day
  static get LOW() { return 10; }        // Low priority, process when resources available
  static get BACKGROUND() { return 1; }  // Background tasks, process during low activity

  /**
   * Convert string priority to numeric value
   * @param {string} priority - String priority
   * @returns {number} - Numeric priority value
   */
  static fromString(priority) {
    const priorities = {
      'critical': HealthcarePriorities.CRITICAL,
      'urgent': HealthcarePriorities.URGENT,
      'high': HealthcarePriorities.HIGH,
      'medium': HealthcarePriorities.MEDIUM,
      'low': HealthcarePriorities.LOW,
      'background': HealthcarePriorities.BACKGROUND
    };

    return priorities[priority.toLowerCase()] || HealthcarePriorities.MEDIUM;
  }

  /**
   * Convert numeric priority to string
   * @param {number} priority - Numeric priority
   * @returns {string} - String priority value
   */
  static toString(priority) {
    if (priority >= HealthcarePriorities.CRITICAL) return 'critical';
    if (priority >= HealthcarePriorities.URGENT) return 'urgent';
    if (priority >= HealthcarePriorities.HIGH) return 'high';
    if (priority >= HealthcarePriorities.MEDIUM) return 'medium';
    if (priority >= HealthcarePriorities.LOW) return 'low';
    return 'background';
  }
}

module.exports = { PriorityQueue, HealthcarePriorities };