/**
 * @fileoverview Imaging Cache Service
 * 
 * High-performance caching system for DICOM imaging studies with
 * intelligent pre-fetching and memory management for patient portals.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { ImagingStudy } from '../components/imaging/SecureImagingViewer';

export interface CacheConfig {
  maxCacheSize: number; // Maximum cache size in MB
  maxStudyAge: number; // Maximum age of cached studies in minutes
  prefetchEnabled: boolean;
  prefetchLimit: number; // Number of studies to prefetch
  compressionEnabled: boolean;
}

export interface CachedStudy {
  study: ImagingStudy;
  cachedAt: Date;
  lastAccessed: Date;
  size: number; // Size in bytes
  preloadData?: {
    thumbnails: string[];
    metadata: any;
  };
}

export interface StudyMetrics {
  cacheHitRate: number;
  averageLoadTime: number;
  totalCachedStudies: number;
  totalCacheSize: number;
}

/**
 * High-performance imaging cache with intelligent pre-fetching
 */
export class ImagingCacheService {
  private cache = new Map<string, CachedStudy>();
  private config: CacheConfig;
  private metrics: StudyMetrics = {
    cacheHitRate: 0,
    averageLoadTime: 0,
    totalCachedStudies: 0,
    totalCacheSize: 0,
  };
  private accessLog: { studyId: string; timestamp: Date; hit: boolean }[] = [];

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxCacheSize: 500, // 500MB default
      maxStudyAge: 60, // 1 hour default
      prefetchEnabled: true,
      prefetchLimit: 5,
      compressionEnabled: true,
      ...config,
    };

    // Start cleanup interval
    setInterval(() => this.cleanup(), 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Get study from cache or API with intelligent prefetching
   */
  async getStudy(studyId: string, patientId: string): Promise<ImagingStudy> {
    const startTime = Date.now();
    
    // Check cache first
    const cached = this.cache.get(studyId);
    if (cached && this.isValidCacheEntry(cached)) {
      cached.lastAccessed = new Date();
      this.logAccess(studyId, true);
      
      // Trigger background prefetch for related studies
      if (this.config.prefetchEnabled) {
        this.prefetchRelatedStudies(patientId, studyId);
      }
      
      return cached.study;
    }

    // Cache miss - fetch from API
    try {
      const study = await this.fetchStudyFromAPI(studyId);
      
      // Cache the study
      await this.cacheStudy(studyId, study);
      
      // Prefetch related studies in background
      if (this.config.prefetchEnabled) {
        this.prefetchRelatedStudies(patientId, studyId);
      }
      
      this.logAccess(studyId, false);
      this.updateLoadTimeMetrics(Date.now() - startTime);
      
      return study;
    } catch (error) {
      this.logAccess(studyId, false);
      throw error;
    }
  }

  /**
   * Prefetch related studies for improved performance
   */
  private async prefetchRelatedStudies(patientId: string, currentStudyId: string): Promise<void> {
    try {
      const relatedStudies = await this.getRelatedStudyIds(patientId, currentStudyId);
      const prefetchPromises = relatedStudies
        .slice(0, this.config.prefetchLimit)
        .filter(id => !this.cache.has(id))
        .map(id => this.prefetchStudy(id));
      
      // Run prefetching in background without awaiting
      Promise.all(prefetchPromises).catch(error => {
        console.warn('Prefetch error:', error);
      });
    } catch (error) {
      console.warn('Failed to prefetch related studies:', error);
    }
  }

  /**
   * Prefetch individual study without blocking
   */
  private async prefetchStudy(studyId: string): Promise<void> {
    try {
      const study = await this.fetchStudyFromAPI(studyId);
      await this.cacheStudy(studyId, study, true); // Mark as prefetched
    } catch (error) {
      // Silently fail prefetch to avoid disrupting user experience
      console.debug(`Prefetch failed for study ${studyId}:`, error);
    }
  }

  /**
   * Cache study with compression and size management
   */
  private async cacheStudy(studyId: string, study: ImagingStudy, isPrefetch = false): Promise<void> {
    const studySize = this.calculateStudySize(study);
    
    // Check if we need to make space
    if (this.getTotalCacheSize() + studySize > this.config.maxCacheSize * 1024 * 1024) {
      await this.makeSpace(studySize);
    }

    // Create cache entry
    const cachedStudy: CachedStudy = {
      study: this.config.compressionEnabled ? this.compressStudy(study) : study,
      cachedAt: new Date(),
      lastAccessed: new Date(),
      size: studySize,
    };

    // Add preload data for better performance
    if (!isPrefetch) {
      cachedStudy.preloadData = await this.generatePreloadData(study);
    }

    this.cache.set(studyId, cachedStudy);
    this.updateCacheMetrics();
  }

  /**
   * Fetch study from API with retry logic
   */
  private async fetchStudyFromAPI(studyId: string): Promise<ImagingStudy> {
    const maxRetries = 3;
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(`/api/imaging/studies/${studyId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          },
        });

        if (!response.ok) {
          throw new Error(`API request failed: ${response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxRetries) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError!;
  }

  /**
   * Get related study IDs for prefetching
   */
  private async getRelatedStudyIds(patientId: string, currentStudyId: string): Promise<string[]> {
    try {
      const response = await fetch(`/api/imaging/patients/${patientId}/studies?exclude=${currentStudyId}&limit=${this.config.prefetchLimit}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return [];
      }

      const studies = await response.json();
      return studies.map((study: ImagingStudy) => study.id);
    } catch {
      return [];
    }
  }

  /**
   * Generate preload data for faster initial rendering
   */
  private async generatePreloadData(study: ImagingStudy): Promise<{ thumbnails: string[]; metadata: any }> {
    try {
      // Generate thumbnail URLs
      const thumbnails = await this.generateThumbnails(study);
      
      // Extract essential metadata
      const metadata = {
        seriesCount: study.seriesCount,
        instanceCount: study.instanceCount,
        modality: study.modality,
        studyDate: study.studyDate,
      };

      return { thumbnails, metadata };
    } catch {
      return { thumbnails: [], metadata: {} };
    }
  }

  /**
   * Generate thumbnail URLs for quick preview
   */
  private async generateThumbnails(study: ImagingStudy): Promise<string[]> {
    try {
      const response = await fetch(`/api/imaging/studies/${study.id}/thumbnails`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (!response.ok) {
        return [];
      }

      const thumbnailData = await response.json();
      return thumbnailData.thumbnails || [];
    } catch {
      return [];
    }
  }

  /**
   * Compress study data to save memory
   */
  private compressStudy(study: ImagingStudy): ImagingStudy {
    // Simple compression by removing unnecessary fields for cached version
    const compressed = { ...study };
    
    // Remove large fields that can be fetched on demand
    delete compressed.thumbnailUrl;
    
    return compressed;
  }

  /**
   * Check if cache entry is valid
   */
  private isValidCacheEntry(cached: CachedStudy): boolean {
    const ageMinutes = (Date.now() - cached.cachedAt.getTime()) / (1000 * 60);
    return ageMinutes < this.config.maxStudyAge;
  }

  /**
   * Calculate study size in bytes
   */
  private calculateStudySize(study: ImagingStudy): number {
    return JSON.stringify(study).length * 2; // Rough estimate (UTF-16)
  }

  /**
   * Get total cache size in bytes
   */
  private getTotalCacheSize(): number {
    let total = 0;
    for (const cached of this.cache.values()) {
      total += cached.size;
    }
    return total;
  }

  /**
   * Make space in cache by removing old/least accessed entries
   */
  private async makeSpace(requiredSize: number): Promise<void> {
    const entries = Array.from(this.cache.entries());
    
    // Sort by last accessed time (oldest first)
    entries.sort((a, b) => a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime());
    
    let freedSpace = 0;
    for (const [studyId, cached] of entries) {
      if (freedSpace >= requiredSize) {
        break;
      }
      
      this.cache.delete(studyId);
      freedSpace += cached.size;
    }
    
    this.updateCacheMetrics();
  }

  /**
   * Clean up expired cache entries
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = this.config.maxStudyAge * 60 * 1000; // Convert to milliseconds
    
    for (const [studyId, cached] of this.cache.entries()) {
      if (now - cached.cachedAt.getTime() > maxAge) {
        this.cache.delete(studyId);
      }
    }
    
    this.updateCacheMetrics();
  }

  /**
   * Log cache access for metrics
   */
  private logAccess(studyId: string, hit: boolean): void {
    this.accessLog.push({
      studyId,
      timestamp: new Date(),
      hit,
    });
    
    // Keep only last 1000 entries
    if (this.accessLog.length > 1000) {
      this.accessLog = this.accessLog.slice(-1000);
    }
    
    this.updateCacheHitRate();
  }

  /**
   * Update cache hit rate metrics
   */
  private updateCacheHitRate(): void {
    if (this.accessLog.length === 0) {
      this.metrics.cacheHitRate = 0;
      return;
    }
    
    const hits = this.accessLog.filter(log => log.hit).length;
    this.metrics.cacheHitRate = hits / this.accessLog.length;
  }

  /**
   * Update load time metrics
   */
  private updateLoadTimeMetrics(loadTime: number): void {
    // Simple moving average
    const alpha = 0.1; // Smoothing factor
    this.metrics.averageLoadTime = this.metrics.averageLoadTime * (1 - alpha) + loadTime * alpha;
  }

  /**
   * Update cache size metrics
   */
  private updateCacheMetrics(): void {
    this.metrics.totalCachedStudies = this.cache.size;
    this.metrics.totalCacheSize = this.getTotalCacheSize();
  }

  /**
   * Get current cache metrics
   */
  getMetrics(): StudyMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear all cached studies
   */
  clearCache(): void {
    this.cache.clear();
    this.updateCacheMetrics();
  }

  /**
   * Get cache configuration
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * Update cache configuration
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Create singleton instance
export const imagingCache = new ImagingCacheService();