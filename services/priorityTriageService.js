/**
 * Priority-Aware Triage Service for WebQX Healthcare Platform
 * Replaces basic sorting with robust priority queue for critical data processing
 */

const { PriorityQueue, HealthcarePriorities } = require('./priorityQueue');

class PriorityTriageService {
  constructor(config = {}) {
    this.config = {
      maxQueueSize: config.maxQueueSize || 1000,
      enableMetrics: config.enableMetrics !== false,
      enableLogging: config.enableLogging || false,
      processingTimeoutMs: config.processingTimeoutMs || 300000,
      ...config
    };

    this.priorityQueue = new PriorityQueue(this.config);
    this.triageData = new Map(); // Store full triage data separately
    this.processingItems = new Map(); // Track items being processed
  }

  /**
   * Add new triage entry to priority queue
   */
  addTriageEntry(triageEntry) {
    const { triageId, priority: priorityString, ...data } = triageEntry;
    
    // Convert string priority to numeric for queue
    const numericPriority = this.convertPriorityToNumeric(priorityString);
    
    // Store full triage data
    this.triageData.set(triageId, triageEntry);
    
    // Add to priority queue with metadata
    const queueItemId = this.priorityQueue.enqueue(
      triageId, 
      numericPriority,
      {
        patientId: data.patientId,
        symptoms: data.symptoms,
        culturalContext: data.culturalContext,
        language: data.language,
        urgencyReason: this.determineUrgencyReason(data.symptoms),
        departmentType: 'telepsychiatry'
      }
    );

    if (this.config.enableLogging) {
      console.log(`[PriorityTriageService] Added triage entry ${triageId} with priority ${priorityString} (${numericPriority})`);
    }

    return queueItemId;
  }

  /**
   * Get next highest priority triage entry for processing
   */
  getNextTriageEntry() {
    const queueItem = this.priorityQueue.dequeue();
    if (!queueItem) {
      return null;
    }

    const triageId = queueItem.data;
    const triageEntry = this.triageData.get(triageId);
    
    if (triageEntry) {
      // Mark as being processed
      triageEntry.status = 'processing';
      triageEntry.processingStarted = new Date().toISOString();
      this.processingItems.set(queueItem.id, { queueItem, triageEntry });
      
      if (this.config.enableLogging) {
        console.log(`[PriorityTriageService] Processing triage entry ${triageId} with priority ${triageEntry.priority}`);
      }
    }

    return {
      queueItemId: queueItem.id,
      triageEntry: triageEntry,
      metadata: queueItem.metadata
    };
  }

  /**
   * Mark triage entry as completed
   */
  markTriageCompleted(queueItemId, completionData = {}) {
    const processingItem = this.processingItems.get(queueItemId);
    if (!processingItem) {
      console.warn(`[PriorityTriageService] No processing item found for ID: ${queueItemId}`);
      return false;
    }

    const { triageEntry } = processingItem;
    
    // Update triage entry status
    triageEntry.status = 'completed';
    triageEntry.completedAt = new Date().toISOString();
    triageEntry.completionData = completionData;

    // Mark as completed in priority queue
    this.priorityQueue.markCompleted(queueItemId);
    
    // Remove from processing
    this.processingItems.delete(queueItemId);

    if (this.config.enableLogging) {
      console.log(`[PriorityTriageService] Completed triage entry ${triageEntry.triageId}`);
    }

    return true;
  }

  /**
   * Mark triage entry as failed and optionally requeue
   */
  markTriageFailed(queueItemId, requeue = false, adjustedPriority = null) {
    const processingItem = this.processingItems.get(queueItemId);
    if (!processingItem) {
      return false;
    }

    const { queueItem, triageEntry } = processingItem;
    
    if (requeue) {
      // Requeue with adjusted priority (or lower priority by default)
      const newPriority = adjustedPriority || Math.max(1, queueItem.priority - 10);
      triageEntry.status = 'pending';
      triageEntry.retryCount = (triageEntry.retryCount || 0) + 1;
      triageEntry.lastFailure = new Date().toISOString();
      
      this.priorityQueue.markFailed(queueItemId, true, newPriority, queueItem);
    } else {
      triageEntry.status = 'failed';
      triageEntry.failedAt = new Date().toISOString();
      this.priorityQueue.markFailed(queueItemId, false);
    }

    this.processingItems.delete(queueItemId);

    if (this.config.enableLogging) {
      console.log(`[PriorityTriageService] Failed triage entry ${triageEntry.triageId}${requeue ? ' and requeued' : ''}`);
    }

    return true;
  }

  /**
   * Get filtered triage entries with priority-aware sorting
   */
  getFilteredTriageEntries(filters = {}) {
    const {
      status,
      priority,
      language = 'en',
      culturalContext,
      clinicianId,
      limit = 50
    } = filters;

    let results = [];

    // Get all queue items first (for pending items)
    if (!status || status === 'pending') {
      const queueItems = this.priorityQueue.getAllItems();
      
      // Add pending items from queue
      for (const queueItem of queueItems) {
        const triageId = queueItem.data;
        const triageEntry = this.triageData.get(triageId);
        
        if (triageEntry && this.matchesFilters(triageEntry, filters)) {
          const adaptedTriage = this.adaptTriageForCulture(triageEntry, language, culturalContext);
          results.push({
            ...adaptedTriage,
            queuePosition: results.length + 1,
            estimatedWaitTime: this.calculateEstimatedWaitTime(queueItem.priority, results.length),
            queuePriority: queueItem.priority
          });
        }
      }
    }

    // Add processing items
    if (!status || status === 'processing') {
      for (const [queueItemId, { triageEntry }] of this.processingItems.entries()) {
        if (this.matchesFilters(triageEntry, filters)) {
          const adaptedTriage = this.adaptTriageForCulture(triageEntry, language, culturalContext);
          results.push({
            ...adaptedTriage,
            queuePosition: 0, // Currently processing
            estimatedWaitTime: 'Processing now'
          });
        }
      }
    }

    // Add completed/failed items if requested
    if (!status || ['completed', 'failed'].includes(status)) {
      for (const [triageId, triageEntry] of this.triageData.entries()) {
        // Skip if already added from queue or processing
        if (triageEntry.status === 'pending' || triageEntry.status === 'processing') {
          continue;
        }
        
        if ((triageEntry.status === 'completed' || triageEntry.status === 'failed') && 
            this.matchesFilters(triageEntry, filters)) {
          const adaptedTriage = this.adaptTriageForCulture(triageEntry, language, culturalContext);
          results.push(adaptedTriage);
        }
      }
    }

    // Apply limit
    if (limit && results.length > parseInt(limit)) {
      results = results.slice(0, parseInt(limit));
    }

    return results;
  }

  /**
   * Get queue metrics and performance data
   */
  getQueueMetrics() {
    const queueMetrics = this.priorityQueue.getMetrics();
    
    return {
      ...queueMetrics,
      processingItems: this.processingItems.size,
      totalTriageEntries: this.triageData.size,
      queueUtilization: (queueMetrics.totalItems / this.config.maxQueueSize) * 100,
      priorityDistribution: this.calculatePriorityDistribution(),
      averageWaitTimeByPriority: this.calculateAverageWaitTimes()
    };
  }

  /**
   * Convert string priority to numeric value for queue
   */
  convertPriorityToNumeric(priorityString) {
    // Map telepsychiatry priorities to healthcare standard
    const priorityMap = {
      'urgent': HealthcarePriorities.URGENT,     // 75
      'high': HealthcarePriorities.HIGH,         // 50  
      'medium': HealthcarePriorities.MEDIUM,     // 25
      'low': HealthcarePriorities.LOW            // 10
    };

    return priorityMap[priorityString] || HealthcarePriorities.MEDIUM;
  }

  /**
   * Determine urgency reason based on symptoms
   */
  determineUrgencyReason(symptoms) {
    const criticalKeywords = ['suicide', 'self-harm', 'crisis', 'emergency', 'danger'];
    const urgentKeywords = ['severe', 'panic', 'psychosis', 'violent', 'threat'];
    
    const symptomsText = symptoms.join(' ').toLowerCase();
    
    if (criticalKeywords.some(keyword => symptomsText.includes(keyword))) {
      return 'life-threatening symptoms detected';
    }
    
    if (urgentKeywords.some(keyword => symptomsText.includes(keyword))) {
      return 'severe psychiatric symptoms';
    }
    
    return 'standard psychiatric evaluation';
  }

  /**
   * Check if triage entry matches filters
   */
  matchesFilters(triageEntry, filters) {
    const { status, priority, clinicianId, culturalContext, language } = filters;
    
    if (status && triageEntry.status !== status) return false;
    if (priority && triageEntry.priority !== priority) return false;
    if (clinicianId && triageEntry.assignedClinician !== clinicianId) return false;
    if (culturalContext && triageEntry.culturalContext !== culturalContext) return false;
    if (language && triageEntry.language !== language) return false;
    
    return true;
  }

  /**
   * Adapt triage for cultural context
   */
  adaptTriageForCulture(triage, language, culturalContext) {
    // This could be enhanced with actual cultural adaptation logic
    return {
      ...triage,
      culturallyAdaptedPrompts: this.generateCulturalPrompts(triage.symptoms, culturalContext, language)
    };
  }

  /**
   * Generate cultural prompts (placeholder implementation)
   */
  generateCulturalPrompts(symptoms, culturalContext, language) {
    // Simplified implementation - would be more sophisticated in production
    return [`Culturally adapted prompt for ${culturalContext} in ${language}`];
  }

  /**
   * Calculate estimated wait time based on priority and position
   */
  calculateEstimatedWaitTime(priority, position) {
    const baseTimesByPriority = {
      [HealthcarePriorities.URGENT]: 5,    // 5 minutes
      [HealthcarePriorities.HIGH]: 30,     // 30 minutes
      [HealthcarePriorities.MEDIUM]: 120,  // 2 hours
      [HealthcarePriorities.LOW]: 240      // 4 hours
    };
    
    const baseTime = baseTimesByPriority[priority] || 120;
    const waitTime = baseTime + (position * 10); // Add 10 minutes per position
    
    return `${waitTime} minutes`;
  }

  /**
   * Calculate priority distribution for metrics
   */
  calculatePriorityDistribution() {
    const distribution = {};
    const queueItems = this.priorityQueue.getAllItems();
    
    for (const item of queueItems) {
      const priorityString = HealthcarePriorities.toString(item.priority);
      distribution[priorityString] = (distribution[priorityString] || 0) + 1;
    }
    
    return distribution;
  }

  /**
   * Calculate average wait times by priority
   */
  calculateAverageWaitTimes() {
    // Simplified implementation - would track actual processing times
    return {
      urgent: '5 minutes',
      high: '30 minutes', 
      medium: '2 hours',
      low: '4 hours'
    };
  }

  /**
   * Clear all triage data (for testing/reset)
   */
  clear() {
    this.priorityQueue.clear();
    this.triageData.clear();
    this.processingItems.clear();
  }
}

module.exports = { PriorityTriageService };