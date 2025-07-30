/**
 * PostDICOM Cache Service
 * Implements intelligent caching and pre-fetching for optimal performance
 */

import {
  ICacheService,
  CacheStats,
  PreFetchRule,
  DICOMStudy,
  DICOMImage,
  PostDICOMError,
  ERROR_CODES,
  CacheConfig
} from '../types/postdicom.types';
import { getPostDICOMConfig } from '../config/postdicom.config';

/**
 * Abstract base class for cache providers
 */
abstract class CacheProvider {
  protected config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = config;
  }

  abstract get<T>(key: string): Promise<T | null>;
  abstract set<T>(key: string, value: T, ttl?: number): Promise<void>;
  abstract delete(key: string): Promise<void>;
  abstract clear(): Promise<void>;
  abstract keys(pattern?: string): Promise<string[]>;
  abstract size(): Promise<number>;
  abstract exists(key: string): Promise<boolean>;
}

/**
 * In-Memory Cache Provider
 */
class MemoryCacheProvider extends CacheProvider {
  private cache = new Map<string, { value: any; expiry: number; size: number }>();
  private totalSize = 0;
  private maxSize: number;

  constructor(config: CacheConfig) {
    super(config);
    this.maxSize = this.parseSize(config.maxCacheSize);
  }

  async get<T>(key: string): Promise<T | null> {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      await this.delete(key);
      return null;
    }

    return item.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const expiry = Date.now() + (ttl || this.config.cacheTTL) * 1000;
    const serialized = JSON.stringify(value);
    const size = new Blob([serialized]).size;

    // Check if we need to evict items
    while (this.totalSize + size > this.maxSize && this.cache.size > 0) {
      await this.evictLRU();
    }

    if (this.cache.has(key)) {
      const oldItem = this.cache.get(key)!;
      this.totalSize -= oldItem.size;
    }

    this.cache.set(key, { value, expiry, size });
    this.totalSize += size;
  }

  async delete(key: string): Promise<void> {
    const item = this.cache.get(key);
    if (item) {
      this.totalSize -= item.size;
      this.cache.delete(key);
    }
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.totalSize = 0;
  }

  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.cache.keys());
    if (!pattern) return allKeys;

    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return allKeys.filter(key => regex.test(key));
  }

  async size(): Promise<number> {
    return this.totalSize;
  }

  async exists(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  private async evictLRU(): Promise<void> {
    // Simple LRU eviction - remove oldest item
    const oldestKey = this.cache.keys().next().value;
    if (oldestKey) {
      await this.delete(oldestKey);
    }
  }

  private parseSize(sizeStr: string): number {
    const units: { [key: string]: number } = {
      'GB': 1024 * 1024 * 1024,
      'MB': 1024 * 1024,
      'KB': 1024
    };

    const match = sizeStr.match(/(\d+)(GB|MB|KB)/);
    if (match) {
      return parseInt(match[1]) * units[match[2]];
    }
    return 1024 * 1024 * 1024; // Default 1GB
  }
}

/**
 * Redis Cache Provider (mock implementation)
 */
class RedisCacheProvider extends CacheProvider {
  private redisClient: any; // Would be Redis client in real implementation

  constructor(config: CacheConfig) {
    super(config);
    this.initializeRedis();
  }

  private initializeRedis(): void {
    // Mock Redis client
    this.redisClient = {
      get: async (key: string) => null,
      set: async (key: string, value: string, ttl?: number) => {},
      del: async (key: string) => {},
      flushall: async () => {},
      keys: async (pattern: string) => [],
      exists: async (key: string) => false,
      memory: { usage: async () => 0 }
    };
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      throw new PostDICOMError(
        `Redis cache get error: ${error.message}`,
        ERROR_CODES.CACHE_ERROR,
        500
      );
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.redisClient.set(key, serialized, ttl || this.config.cacheTTL);
    } catch (error) {
      throw new PostDICOMError(
        `Redis cache set error: ${error.message}`,
        ERROR_CODES.CACHE_ERROR,
        500
      );
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redisClient.del(key);
    } catch (error) {
      throw new PostDICOMError(
        `Redis cache delete error: ${error.message}`,
        ERROR_CODES.CACHE_ERROR,
        500
      );
    }
  }

  async clear(): Promise<void> {
    try {
      await this.redisClient.flushall();
    } catch (error) {
      throw new PostDICOMError(
        `Redis cache clear error: ${error.message}`,
        ERROR_CODES.CACHE_ERROR,
        500
      );
    }
  }

  async keys(pattern?: string): Promise<string[]> {
    try {
      return await this.redisClient.keys(pattern || '*');
    } catch (error) {
      throw new PostDICOMError(
        `Redis cache keys error: ${error.message}`,
        ERROR_CODES.CACHE_ERROR,
        500
      );
    }
  }

  async size(): Promise<number> {
    try {
      return await this.redisClient.memory.usage();
    } catch (error) {
      return 0;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      return await this.redisClient.exists(key) === 1;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Filesystem Cache Provider
 */
class FilesystemCacheProvider extends CacheProvider {
  private cacheDir: string;
  private fs: any; // Would be fs module in Node.js

  constructor(config: CacheConfig) {
    super(config);
    this.cacheDir = process.env.POSTDICOM_CACHE_DIR || '/tmp/postdicom-cache';
    this.initializeFilesystem();
  }

  private initializeFilesystem(): void {
    // Mock filesystem operations
    this.fs = {
      readFile: async (path: string) => '{}',
      writeFile: async (path: string, data: string) => {},
      unlink: async (path: string) => {},
      readdir: async (dir: string) => [],
      stat: async (path: string) => ({ size: 1024, mtime: new Date() }),
      mkdir: async (dir: string) => {}
    };
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const filePath = this.getFilePath(key);
      const data = await this.fs.readFile(filePath);
      const parsed = JSON.parse(data);
      
      if (Date.now() > parsed.expiry) {
        await this.delete(key);
        return null;
      }
      
      return parsed.value;
    } catch (error) {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const expiry = Date.now() + (ttl || this.config.cacheTTL) * 1000;
      const data = JSON.stringify({ value, expiry });
      const filePath = this.getFilePath(key);
      
      await this.fs.writeFile(filePath, data);
    } catch (error) {
      throw new PostDICOMError(
        `Filesystem cache set error: ${error.message}`,
        ERROR_CODES.CACHE_ERROR,
        500
      );
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = this.getFilePath(key);
      await this.fs.unlink(filePath);
    } catch (error) {
      // File might not exist, ignore error
    }
  }

  async clear(): Promise<void> {
    try {
      const files = await this.fs.readdir(this.cacheDir);
      await Promise.all(files.map((file: string) => 
        this.fs.unlink(`${this.cacheDir}/${file}`)
      ));
    } catch (error) {
      throw new PostDICOMError(
        `Filesystem cache clear error: ${error.message}`,
        ERROR_CODES.CACHE_ERROR,
        500
      );
    }
  }

  async keys(pattern?: string): Promise<string[]> {
    try {
      const files = await this.fs.readdir(this.cacheDir);
      const keys = files.map((file: string) => file.replace('.json', ''));
      
      if (!pattern) return keys;
      
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return keys.filter(key => regex.test(key));
    } catch (error) {
      return [];
    }
  }

  async size(): Promise<number> {
    try {
      const files = await this.fs.readdir(this.cacheDir);
      let totalSize = 0;
      
      for (const file of files) {
        const stat = await this.fs.stat(`${this.cacheDir}/${file}`);
        totalSize += stat.size;
      }
      
      return totalSize;
    } catch (error) {
      return 0;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(key);
      await this.fs.stat(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  private getFilePath(key: string): string {
    const safeKey = key.replace(/[^a-zA-Z0-9-_]/g, '_');
    return `${this.cacheDir}/${safeKey}.json`;
  }
}

/**
 * PostDICOM Cache Service
 * Main service implementing intelligent caching and pre-fetching
 */
export class PostDICOMCacheService implements ICacheService {
  private provider: CacheProvider;
  private config: CacheConfig;
  private stats = {
    requests: 0,
    hits: 0,
    misses: 0,
    writes: 0,
    deletes: 0
  };

  constructor(customConfig?: Partial<CacheConfig>) {
    const fullConfig = getPostDICOMConfig();
    this.config = { ...fullConfig.performance, ...customConfig };
    this.provider = this.createProvider();
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    this.stats.requests++;
    
    const value = await this.provider.get<T>(key);
    if (value !== null) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }
    
    return value;
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.stats.writes++;
    await this.provider.set(key, value, ttl);
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    this.stats.deletes++;
    await this.provider.delete(key);
  }

  /**
   * Clear entire cache
   */
  async clear(): Promise<void> {
    await this.provider.clear();
    this.resetStats();
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const totalRequests = this.stats.requests;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;
    const missRate = totalRequests > 0 ? this.stats.misses / totalRequests : 0;
    
    const cacheSize = await this.provider.size();
    const keys = await this.provider.keys();
    
    return {
      hitRate,
      missRate,
      totalRequests,
      cacheSize,
      itemCount: keys.length,
      oldestItem: new Date(), // Mock data
      newestItem: new Date()
    };
  }

  /**
   * Execute pre-fetching based on rules
   */
  async preFetch(rules: PreFetchRule[]): Promise<void> {
    if (!this.config.preFetchEnabled) {
      return;
    }

    const activeRules = rules.filter(rule => rule.enabled);
    activeRules.sort((a, b) => a.priority - b.priority);

    for (const rule of activeRules) {
      try {
        await this.executePreFetchRule(rule);
      } catch (error) {
        console.warn(`Pre-fetch rule '${rule.name}' failed:`, error.message);
      }
    }
  }

  /**
   * Cache DICOM study metadata
   */
  async cacheStudyMetadata(study: DICOMStudy): Promise<void> {
    const key = `study:metadata:${study.studyInstanceUID}`;
    await this.set(key, study, this.config.cacheTTL);
  }

  /**
   * Cache DICOM image data
   */
  async cacheImageData(sopInstanceUID: string, imageData: Buffer): Promise<void> {
    const key = `image:data:${sopInstanceUID}`;
    
    // Only cache if image is smaller than 10MB to avoid memory issues
    if (imageData.length <= 10 * 1024 * 1024) {
      await this.set(key, imageData.toString('base64'), this.config.cacheTTL);
    }
  }

  /**
   * Get cached study metadata
   */
  async getCachedStudyMetadata(studyInstanceUID: string): Promise<DICOMStudy | null> {
    const key = `study:metadata:${studyInstanceUID}`;
    return await this.get<DICOMStudy>(key);
  }

  /**
   * Get cached image data
   */
  async getCachedImageData(sopInstanceUID: string): Promise<Buffer | null> {
    const key = `image:data:${sopInstanceUID}`;
    const base64Data = await this.get<string>(key);
    
    if (base64Data) {
      return Buffer.from(base64Data, 'base64');
    }
    
    return null;
  }

  /**
   * Cache search results
   */
  async cacheSearchResults(searchKey: string, results: any[], ttl?: number): Promise<void> {
    const key = `search:${searchKey}`;
    await this.set(key, results, ttl || this.config.cacheTTL / 2); // Shorter TTL for search results
  }

  /**
   * Get cached search results
   */
  async getCachedSearchResults(searchKey: string): Promise<any[] | null> {
    const key = `search:${searchKey}`;
    return await this.get<any[]>(key);
  }

  /**
   * Invalidate cache for a specific study
   */
  async invalidateStudy(studyInstanceUID: string): Promise<void> {
    const patterns = [
      `study:metadata:${studyInstanceUID}`,
      `study:series:${studyInstanceUID}:*`,
      `image:data:${studyInstanceUID}:*`
    ];

    for (const pattern of patterns) {
      const keys = await this.provider.keys(pattern);
      await Promise.all(keys.map(key => this.delete(key)));
    }
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUpCache(studyInstanceUIDs: string[]): Promise<void> {
    // This would typically fetch data from storage and cache it
    console.log(`Warming up cache for ${studyInstanceUIDs.length} studies`);
    
    for (const studyUID of studyInstanceUIDs) {
      try {
        // Mock: In real implementation, fetch from storage service
        const mockStudy: DICOMStudy = {
          studyInstanceUID: studyUID,
          patientID: 'patient-123',
          patientName: 'Mock Patient',
          studyDate: new Date().toISOString().split('T')[0],
          modality: 'CT',
          seriesCount: 1,
          imageCount: 10,
          studySize: 1024000,
          accessLevel: 'restricted',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await this.cacheStudyMetadata(mockStudy);
      } catch (error) {
        console.warn(`Failed to warm up cache for study ${studyUID}:`, error.message);
      }
    }
  }

  // Private helper methods

  private createProvider(): CacheProvider {
    switch (this.config.cacheProvider) {
      case 'memory':
        return new MemoryCacheProvider(this.config);
      case 'redis':
        return new RedisCacheProvider(this.config);
      case 'filesystem':
        return new FilesystemCacheProvider(this.config);
      default:
        throw new PostDICOMError(
          `Unsupported cache provider: ${this.config.cacheProvider}`,
          ERROR_CODES.CACHE_ERROR,
          500
        );
    }
  }

  private async executePreFetchRule(rule: PreFetchRule): Promise<void> {
    // Mock implementation of pre-fetch rule execution
    console.log(`Executing pre-fetch rule: ${rule.name}`);
    
    // In a real implementation, this would:
    // 1. Query the database based on the rule condition
    // 2. Fetch the top priority images/studies
    // 3. Cache them proactively
    
    // For now, just log the rule execution
    const mockStudyUIDs = Array.from({ length: Math.min(rule.maxImages, 10) }, 
      (_, i) => `prefetch-study-${i + 1}`);
    
    await this.warmUpCache(mockStudyUIDs);
  }

  private resetStats(): void {
    this.stats = {
      requests: 0,
      hits: 0,
      misses: 0,
      writes: 0,
      deletes: 0
    };
  }
}

export default PostDICOMCacheService;