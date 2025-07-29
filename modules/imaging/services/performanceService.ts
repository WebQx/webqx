/**
 * Performance Service for WebQX™ OHIF Integration
 * 
 * Handles caching, prefetching, and performance optimization
 * for large DICOM datasets and real-time viewing.
 */

import { 
  CacheConfiguration, 
  PerformanceMetrics, 
  CacheStrategy,
  WebQXUser,
  PerformancePreferences
} from '../types';

interface CacheEntry {
  data: any;
  timestamp: number;
  size: number;
  accessCount: number;
  lastAccessed: number;
  priority: number;
}

interface PrefetchQueue {
  studyInstanceUID: string;
  seriesInstanceUID?: string;
  priority: number;
  userId: string;
}

export class PerformanceService {
  private cache: Map<string, CacheEntry> = new Map();
  private prefetchQueue: PrefetchQueue[] = [];
  private metrics: PerformanceMetrics;
  private config: CacheConfiguration;
  private isProcessingQueue = false;

  constructor(config: CacheConfiguration) {
    this.config = config;
    this.metrics = {
      loadTime: 0,
      renderTime: 0,
      memoryUsage: 0,
      networkLatency: 0,
      cacheHitRate: 0
    };

    // Start cache cleanup interval
    setInterval(() => this.cleanupCache(), 60000); // Every minute
    
    // Start prefetch processing
    setInterval(() => this.processPrefetchQueue(), 5000); // Every 5 seconds
  }

  /**
   * Store data in cache with intelligent eviction
   */
  async cacheData(
    key: string, 
    data: any, 
    options: {
      priority?: number;
      ttl?: number;
      size?: number;
    } = {}
  ): Promise<boolean> {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      size: options.size || this.estimateSize(data),
      accessCount: 1,
      lastAccessed: Date.now(),
      priority: options.priority || 1
    };

    // Check if we need to make space
    if (this.getCurrentCacheSize() + entry.size > this.config.maxSize * 1024 * 1024) {
      await this.evictEntries(entry.size);
    }

    this.cache.set(key, entry);
    this.updateMetrics();
    
    return true;
  }

  /**
   * Retrieve data from cache
   */
  getCachedData(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check TTL
    if (this.config.ttl > 0 && Date.now() - entry.timestamp > this.config.ttl * 1000) {
      this.cache.delete(key);
      return null;
    }

    // Update access metrics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    this.metrics.cacheHitRate = this.calculateCacheHitRate();
    
    return entry.data;
  }

  /**
   * Prefetch study data based on user behavior and clinical context
   */
  schedulePrefetch(
    studyInstanceUID: string,
    options: {
      seriesInstanceUID?: string;
      priority?: number;
      userId: string;
      immediate?: boolean;
    }
  ): void {
    const prefetchItem: PrefetchQueue = {
      studyInstanceUID,
      seriesInstanceUID: options.seriesInstanceUID,
      priority: options.priority || 1,
      userId: options.userId
    };

    // Remove existing items for same study to avoid duplicates
    this.prefetchQueue = this.prefetchQueue.filter(
      item => item.studyInstanceUID !== studyInstanceUID
    );

    this.prefetchQueue.push(prefetchItem);
    
    // Sort by priority (higher priority first)
    this.prefetchQueue.sort((a, b) => b.priority - a.priority);

    if (options.immediate && !this.isProcessingQueue) {
      this.processPrefetchQueue();
    }
  }

  /**
   * Optimize user preferences for performance
   */
  optimizeForUser(user: WebQXUser): PerformancePreferences {
    const basePreferences: PerformancePreferences = {
      imageQuality: 'medium',
      cacheSize: 512, // MB
      prefetchEnabled: true,
      compressionLevel: 3
    };

    // Adjust based on user role and connection
    switch (user.role) {
      case 'radiologist':
        return {
          ...basePreferences,
          imageQuality: 'high',
          cacheSize: 1024,
          prefetchEnabled: true,
          compressionLevel: 1
        };
      
      case 'physician':
        return {
          ...basePreferences,
          imageQuality: 'medium',
          cacheSize: 512,
          prefetchEnabled: true,
          compressionLevel: 3
        };
      
      case 'patient':
        return {
          ...basePreferences,
          imageQuality: 'low',
          cacheSize: 256,
          prefetchEnabled: false,
          compressionLevel: 5
        };
      
      default:
        return basePreferences;
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return {
      ...this.metrics,
      memoryUsage: this.getCurrentCacheSize() / (1024 * 1024) // Convert to MB
    };
  }

  /**
   * Clear cache based on strategy
   */
  clearCache(strategy: 'all' | 'expired' | 'lru' | 'priority' = 'expired'): number {
    const sizeBefore = this.cache.size;

    switch (strategy) {
      case 'all':
        this.cache.clear();
        break;
        
      case 'expired':
        this.evictExpiredEntries();
        break;
        
      case 'lru':
        this.evictLRUEntries(this.cache.size * 0.3); // Remove 30%
        break;
        
      case 'priority':
        this.evictLowPriorityEntries();
        break;
    }

    const cleared = sizeBefore - this.cache.size;
    this.updateMetrics();
    
    return cleared;
  }

  /**
   * Preload critical imaging data for workflow
   */
  async preloadWorkflowData(
    workflow: string,
    userId: string,
    context: {
      patientId?: string;
      studyType?: string;
      priority?: number;
    }
  ): Promise<void> {
    const preloadRules = this.getPreloadRules(workflow);
    
    for (const rule of preloadRules) {
      if (this.shouldPreload(rule, context)) {
        this.schedulePrefetch(rule.studyInstanceUID, {
          priority: rule.priority,
          userId,
          immediate: rule.immediate
        });
      }
    }
  }

  // Private methods

  private async processPrefetchQueue(): Promise<void> {
    if (this.isProcessingQueue || this.prefetchQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      const item = this.prefetchQueue.shift();
      if (!item) return;

      // Check if already cached
      const cacheKey = `prefetch:${item.studyInstanceUID}`;
      if (this.cache.has(cacheKey)) {
        return;
      }

      // Simulate prefetch operation
      // In real implementation, this would fetch from DICOM service
      await this.simulatePrefetch(item);

    } catch (error) {
      console.error('Prefetch error:', error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private async simulatePrefetch(item: PrefetchQueue): Promise<void> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const mockData = {
      studyInstanceUID: item.studyInstanceUID,
      seriesInstanceUID: item.seriesInstanceUID,
      prefetched: true,
      timestamp: Date.now()
    };

    await this.cacheData(`prefetch:${item.studyInstanceUID}`, mockData, {
      priority: item.priority
    });
  }

  private async evictEntries(requiredSpace: number): Promise<void> {
    let freedSpace = 0;
    const sortedEntries = Array.from(this.cache.entries())
      .sort((a, b) => this.getEvictionScore(a[1]) - this.getEvictionScore(b[1]));

    for (const [key, entry] of sortedEntries) {
      if (freedSpace >= requiredSpace) break;
      
      this.cache.delete(key);
      freedSpace += entry.size;
    }
  }

  private getEvictionScore(entry: CacheEntry): number {
    const now = Date.now();
    const age = now - entry.timestamp;
    const lastAccessAge = now - entry.lastAccessed;
    
    // Lower score = higher eviction priority
    switch (this.config.strategy) {
      case 'lru':
        return -lastAccessAge; // Older = higher eviction priority
        
      case 'lfu':
        return entry.accessCount; // Less accessed = higher eviction priority
        
      case 'ttl':
        return -age; // Older = higher eviction priority
        
      default:
        return -(lastAccessAge / entry.accessCount); // Combined metric
    }
  }

  private evictExpiredEntries(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (this.config.ttl > 0 && now - entry.timestamp > this.config.ttl * 1000) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.cache.delete(key));
  }

  private evictLRUEntries(count: number): void {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    for (let i = 0; i < Math.min(count, entries.length); i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  private evictLowPriorityEntries(): void {
    const lowPriorityKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.priority < 2) {
        lowPriorityKeys.push(key);
      }
    }

    lowPriorityKeys.forEach(key => this.cache.delete(key));
  }

  private getCurrentCacheSize(): number {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.size;
    }
    return totalSize;
  }

  private estimateSize(data: any): number {
    if (data instanceof ArrayBuffer) {
      return data.byteLength;
    }
    
    // Rough estimation for other data types
    const jsonString = JSON.stringify(data);
    return new Blob([jsonString]).size;
  }

  private calculateCacheHitRate(): number {
    // Simple implementation - in production would track hits/misses properly
    return Math.min(0.95, this.cache.size / 100);
  }

  private updateMetrics(): void {
    this.metrics.memoryUsage = this.getCurrentCacheSize() / (1024 * 1024);
    this.metrics.cacheHitRate = this.calculateCacheHitRate();
  }

  private getPreloadRules(workflow: string): any[] {
    // Mock preload rules - in real implementation, these would be configurable
    const rules: Record<string, any[]> = {
      'radiology-interpretation': [
        {
          studyInstanceUID: 'mock-study-1',
          priority: 5,
          immediate: true
        }
      ],
      'cardiac-ct-analysis': [
        {
          studyInstanceUID: 'mock-cardiac-study-1',
          priority: 4,
          immediate: false
        }
      ]
    };

    return rules[workflow] || [];
  }

  private shouldPreload(rule: any, context: any): boolean {
    // Simple rule evaluation - in real implementation, this would be more sophisticated
    return true;
  }
}

// Export as default for backwards compatibility
export default PerformanceService;