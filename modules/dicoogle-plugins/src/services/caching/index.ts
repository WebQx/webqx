/**
 * Caching Service for Dicoogle PACS Plugins
 * 
 * Provides high-performance caching for DICOM query results and metadata
 * Supports both in-memory and Redis backends for scalability
 */

import { EventEmitter } from 'events';
import { configManager } from '../config';
import { generateCacheKey } from '../utils';

/**
 * Cache entry interface
 */
interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

/**
 * Cache statistics interface
 */
interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
  memoryUsageBytes: number;
  hitRate: number;
  evictions: number;
}

/**
 * Cache provider interface
 */
interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  getStats(): Promise<CacheStats>;
  close(): Promise<void>;
}

/**
 * In-memory cache provider with LRU eviction
 */
class MemoryCacheProvider implements CacheProvider {
  private cache = new Map<string, CacheEntry>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    entries: 0,
    memoryUsageBytes: 0,
    hitRate: 0,
    evictions: 0,
  };
  private maxMemoryBytes: number;
  private defaultTtl: number;

  constructor(maxMemoryMB: number, defaultTtlSeconds: number) {
    this.maxMemoryBytes = maxMemoryMB * 1024 * 1024;
    this.defaultTtl = defaultTtlSeconds * 1000;
    
    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }
    
    // Check if expired
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.entries--;
      this.updateHitRate();
      return null;
    }
    
    // Update access tracking
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    this.stats.hits++;
    this.updateHitRate();
    
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const effectiveTtl = ttl ? ttl * 1000 : this.defaultTtl;
    
    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl: effectiveTtl,
      accessCount: 0,
      lastAccessed: Date.now(),
    };
    
    // Check memory limits and evict if necessary
    await this.ensureMemoryLimit();
    
    this.cache.set(key, entry);
    this.stats.entries = this.cache.size;
    this.updateMemoryUsage();
  }

  async delete(key: string): Promise<void> {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.entries = this.cache.size;
      this.updateMemoryUsage();
    }
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.stats.entries = 0;
    this.stats.memoryUsageBytes = 0;
  }

  async getStats(): Promise<CacheStats> {
    this.updateMemoryUsage();
    return { ...this.stats };
  }

  async close(): Promise<void> {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    this.stats.entries = this.cache.size;
    this.updateMemoryUsage();
  }

  private async ensureMemoryLimit(): Promise<void> {
    this.updateMemoryUsage();
    
    while (this.stats.memoryUsageBytes > this.maxMemoryBytes && this.cache.size > 0) {
      // Find LRU entry
      let oldestKey = '';
      let oldestTime = Date.now();
      
      for (const [key, entry] of this.cache.entries()) {
        if (entry.lastAccessed < oldestTime) {
          oldestTime = entry.lastAccessed;
          oldestKey = key;
        }
      }
      
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.stats.evictions++;
      } else {
        break;
      }
    }
    
    this.stats.entries = this.cache.size;
    this.updateMemoryUsage();
  }

  private updateMemoryUsage(): void {
    let totalBytes = 0;
    
    for (const entry of this.cache.values()) {
      // Rough estimation of memory usage
      totalBytes += JSON.stringify(entry).length * 2; // UTF-16 encoding
    }
    
    this.stats.memoryUsageBytes = totalBytes;
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

/**
 * Redis cache provider (placeholder for Redis integration)
 */
class RedisCacheProvider implements CacheProvider {
  private client: any; // Redis client placeholder
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    entries: 0,
    memoryUsageBytes: 0,
    hitRate: 0,
    evictions: 0,
  };

  constructor(redisConfig: any) {
    // Initialize Redis client (implementation would depend on redis library)
    // This is a placeholder for the actual Redis implementation
    console.log('Redis cache provider initialized with config:', redisConfig);
  }

  async get<T>(key: string): Promise<T | null> {
    // Redis implementation placeholder
    this.stats.misses++;
    return null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // Redis implementation placeholder
  }

  async delete(key: string): Promise<void> {
    // Redis implementation placeholder
  }

  async clear(): Promise<void> {
    // Redis implementation placeholder
  }

  async getStats(): Promise<CacheStats> {
    return { ...this.stats };
  }

  async close(): Promise<void> {
    // Close Redis connection
  }
}

/**
 * Main caching service
 */
export class CachingService extends EventEmitter {
  private provider: CacheProvider;
  private enabled: boolean;
  private keyPrefix: string = 'dicoogle:';

  constructor() {
    super();
    
    const config = configManager.getConfig();
    this.enabled = config.performance.caching.enabled;
    
    if (this.enabled) {
      this.initializeProvider(config.performance.caching);
    } else {
      // Null provider for when caching is disabled
      this.provider = new MemoryCacheProvider(0, 0);
    }
  }

  /**
   * Initialize the appropriate cache provider
   */
  private initializeProvider(config: any): void {
    switch (config.provider) {
      case 'redis':
        this.provider = new RedisCacheProvider(config.redisConfig);
        break;
      case 'memory':
      default:
        this.provider = new MemoryCacheProvider(config.maxMemoryMB, config.ttlSeconds);
        break;
    }
  }

  /**
   * Get cached value
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      const result = await this.provider.get<T>(this.keyPrefix + key);
      this.emit('cache:access', { key, hit: result !== null });
      return result;
    } catch (error) {
      this.emit('cache:error', { operation: 'get', key, error });
      return null;
    }
  }

  /**
   * Set cached value
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      await this.provider.set(this.keyPrefix + key, value, ttl);
      this.emit('cache:set', { key, ttl });
    } catch (error) {
      this.emit('cache:error', { operation: 'set', key, error });
    }
  }

  /**
   * Delete cached value
   */
  async delete(key: string): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      await this.provider.delete(this.keyPrefix + key);
      this.emit('cache:delete', { key });
    } catch (error) {
      this.emit('cache:error', { operation: 'delete', key, error });
    }
  }

  /**
   * Clear all cached values
   */
  async clear(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      await this.provider.clear();
      this.emit('cache:clear');
    } catch (error) {
      this.emit('cache:error', { operation: 'clear', error });
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    if (!this.enabled) {
      return {
        hits: 0,
        misses: 0,
        entries: 0,
        memoryUsageBytes: 0,
        hitRate: 0,
        evictions: 0,
      };
    }

    return await this.provider.getStats();
  }

  /**
   * Cache query results with automatic key generation
   */
  async cacheQueryResult<T>(
    filter: any,
    pagination: any,
    sort: any,
    result: T,
    ttl?: number
  ): Promise<void> {
    const key = generateCacheKey(filter, pagination, sort);
    await this.set(`query:${key}`, result, ttl);
  }

  /**
   * Get cached query result
   */
  async getCachedQueryResult<T>(
    filter: any,
    pagination: any,
    sort: any
  ): Promise<T | null> {
    const key = generateCacheKey(filter, pagination, sort);
    return await this.get<T>(`query:${key}`);
  }

  /**
   * Cache metadata with TTL based on data type
   */
  async cacheMetadata<T>(
    type: 'patient' | 'study' | 'series' | 'instance',
    id: string,
    metadata: T,
    customTtl?: number
  ): Promise<void> {
    const ttl = customTtl || this.getDefaultTtlForType(type);
    await this.set(`metadata:${type}:${id}`, metadata, ttl);
  }

  /**
   * Get cached metadata
   */
  async getCachedMetadata<T>(
    type: 'patient' | 'study' | 'series' | 'instance',
    id: string
  ): Promise<T | null> {
    return await this.get<T>(`metadata:${type}:${id}`);
  }

  /**
   * Invalidate cache entries by pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    // This would require pattern matching implementation
    // For now, we'll just emit an event for monitoring
    this.emit('cache:invalidate_pattern', { pattern });
  }

  /**
   * Close the caching service
   */
  async close(): Promise<void> {
    if (this.provider) {
      await this.provider.close();
    }
  }

  /**
   * Get default TTL based on data type
   */
  private getDefaultTtlForType(type: string): number {
    const defaultTtls = {
      patient: 3600,    // 1 hour
      study: 1800,      // 30 minutes
      series: 900,      // 15 minutes
      instance: 300,    // 5 minutes
    };
    
    return defaultTtls[type as keyof typeof defaultTtls] || 300;
  }

  /**
   * Enable or disable caching at runtime
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.emit('cache:enabled_changed', { enabled });
  }

  /**
   * Check if caching is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

/**
 * Global caching service instance
 */
export const cachingService = new CachingService();