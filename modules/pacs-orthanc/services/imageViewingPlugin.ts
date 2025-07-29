/**
 * WebQX™ Orthanc PACS Integration - Image Viewing Plugin
 * Scalable image viewing capabilities with optimization and caching
 */

import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import {
  ImageViewingConfig,
  ImagePreview,
  ImageSize,
  PluginConfig,
  HealthStatus
} from '../types';
import { OrthancClient } from '../utils/orthancClient';

export class ImageViewingPlugin extends EventEmitter {
  private config: ImageViewingConfig;
  private pluginConfig: PluginConfig;
  private orthancClient: OrthancClient;
  private imageCache: Map<string, CachedImage> = new Map();
  private processingQueue: Map<string, Promise<ImagePreview>> = new Map();
  private isInitialized = false;

  constructor(
    config: ImageViewingConfig,
    pluginConfig: PluginConfig,
    orthancClient: OrthancClient
  ) {
    super();
    this.config = config;
    this.pluginConfig = pluginConfig;
    this.orthancClient = orthancClient;
  }

  /**
   * Initialize the image viewing plugin
   */
  async initialize(): Promise<void> {
    try {
      // Set up cache management
      this.setupCacheManagement();
      
      // Initialize image processing utilities
      await this.initializeImageProcessing();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      console.log('[Image Viewing Plugin] Successfully initialized');
    } catch (error) {
      this.emit('error', {
        code: 'INITIALIZATION_FAILED',
        message: 'Failed to initialize image viewing plugin',
        details: error,
        timestamp: new Date(),
        pluginName: 'ImageViewingPlugin',
        severity: 'critical'
      });
      throw error;
    }
  }

  /**
   * Get health status of the plugin
   */
  async getHealthStatus(): Promise<HealthStatus> {
    try {
      if (!this.isInitialized) {
        return {
          status: 'unhealthy',
          message: 'Plugin not initialized',
          timestamp: new Date(),
          version: '1.0.0'
        };
      }

      // Check Orthanc connectivity
      const orthancHealth = await this.orthancClient.healthCheck();

      if (!orthancHealth) {
        return {
          status: 'degraded',
          message: 'Orthanc server not accessible',
          details: { orthancHealth },
          timestamp: new Date(),
          version: '1.0.0'
        };
      }

      return {
        status: 'healthy',
        message: 'All systems operational',
        details: {
          orthancHealth,
          cachedImages: this.imageCache.size,
          processingQueue: this.processingQueue.size,
          cacheEnabled: this.config.cacheEnabled,
          thumbnailsEnabled: this.config.enableThumbnails,
          supportedFormats: this.config.imageFormats
        },
        timestamp: new Date(),
        version: '1.0.0'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Health check failed',
        details: error,
        timestamp: new Date(),
        version: '1.0.0'
      };
    }
  }

  /**
   * Get image preview for a DICOM instance
   */
  async getImagePreview(
    instanceId: string,
    requestedSizes?: number[],
    format = 'jpeg',
    userId?: string
  ): Promise<ImagePreview> {
    if (!this.isInitialized) {
      throw new Error('Plugin not initialized');
    }

    // Check if already processing
    const existingRequest = this.processingQueue.get(instanceId);
    if (existingRequest) {
      return existingRequest;
    }

    // Check cache first
    if (this.config.cacheEnabled) {
      const cached = this.getCachedImage(instanceId, requestedSizes, format);
      if (cached) {
        return cached;
      }
    }

    // Create processing promise
    const processingPromise = this.processImagePreview(instanceId, requestedSizes, format, userId);
    this.processingQueue.set(instanceId, processingPromise);

    try {
      const result = await processingPromise;
      return result;
    } finally {
      this.processingQueue.delete(instanceId);
    }
  }

  /**
   * Get thumbnail for a DICOM instance
   */
  async getThumbnail(
    instanceId: string,
    size = 128,
    format = 'jpeg',
    userId?: string
  ): Promise<ImageSize> {
    if (!this.config.enableThumbnails) {
      throw new Error('Thumbnails are disabled');
    }

    const preview = await this.getImagePreview(instanceId, [size], format, userId);
    const thumbnail = preview.sizes.find(s => s.width === size || s.height === size);
    
    if (!thumbnail) {
      throw new Error(`Thumbnail size ${size} not available`);
    }

    return thumbnail;
  }

  /**
   * Get image in specific format and quality
   */
  async getOptimizedImage(
    instanceId: string,
    maxSize?: number,
    format = 'jpeg',
    quality?: number,
    userId?: string
  ): Promise<{ url: string; mimeType: string; fileSize: number }> {
    const effectiveMaxSize = maxSize || this.config.maxPreviewSize;
    const effectiveQuality = quality || this.config.compressionQuality;

    // Get image from Orthanc
    const imageResponse = await this.orthancClient.getInstanceImage(instanceId, format, effectiveQuality);
    if (!imageResponse.success || !imageResponse.data) {
      throw new Error(`Failed to get image for instance ${instanceId}`);
    }

    // Process and optimize image
    const optimizedImage = await this.optimizeImage(
      imageResponse.data,
      effectiveMaxSize,
      format,
      effectiveQuality,
      userId
    );

    // Generate URL (in real implementation, this would be a proper URL)
    const url = this.generateImageUrl(instanceId, effectiveMaxSize, format, effectiveQuality);

    return {
      url,
      mimeType: `image/${format}`,
      fileSize: optimizedImage.byteLength
    };
  }

  /**
   * Get image with watermark (if enabled)
   */
  async getWatermarkedImage(
    instanceId: string,
    size?: number,
    format = 'jpeg',
    userId?: string
  ): Promise<ImageSize> {
    if (!this.config.watermarkEnabled) {
      return this.getOptimizedImage(instanceId, size, format, undefined, userId);
    }

    // Get base image
    const baseImage = await this.getOptimizedImage(instanceId, size, format, undefined, userId);
    
    // Apply watermark
    const watermarkedImage = await this.applyWatermark(baseImage, userId);
    
    return watermarkedImage;
  }

  /**
   * Check if download is allowed for user
   */
  canDownloadImage(userId?: string): boolean {
    if (!this.config.allowDownload) {
      return false;
    }

    // Additional user-specific download checks could go here
    return true;
  }

  /**
   * Get image download URL
   */
  async getDownloadUrl(
    instanceId: string,
    format = 'jpeg',
    userId?: string
  ): Promise<string> {
    if (!this.canDownloadImage(userId)) {
      throw new Error('Download not allowed for this user');
    }

    // Log download access
    this.emit('image_download_requested', {
      instanceId,
      format,
      userId,
      timestamp: new Date()
    });

    return this.generateDownloadUrl(instanceId, format);
  }

  /**
   * Get image metadata and available sizes
   */
  async getImageInfo(instanceId: string): Promise<{
    originalSize: { width: number; height: number };
    availableSizes: number[];
    supportedFormats: string[];
    downloadAllowed: boolean;
  }> {
    // Get original image to determine dimensions
    const imageResponse = await this.orthancClient.getInstanceImage(instanceId);
    if (!imageResponse.success || !imageResponse.data) {
      throw new Error(`Failed to get image for instance ${instanceId}`);
    }

    // In a real implementation, you would parse the image to get dimensions
    const originalSize = { width: 512, height: 512 }; // Placeholder

    return {
      originalSize,
      availableSizes: this.config.thumbnailSizes,
      supportedFormats: this.config.imageFormats,
      downloadAllowed: this.config.allowDownload
    };
  }

  /**
   * Prefetch images for better performance
   */
  async prefetchImages(instanceIds: string[], sizes?: number[]): Promise<void> {
    const prefetchPromises = instanceIds.map(async (instanceId) => {
      try {
        await this.getImagePreview(instanceId, sizes);
      } catch (error) {
        console.warn(`Failed to prefetch image ${instanceId}:`, error);
      }
    });

    await Promise.all(prefetchPromises);
  }

  /**
   * Clear image cache
   */
  clearCache(): void {
    this.imageCache.clear();
    this.emit('cache_cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    memoryUsage: number;
    hitRate: number;
    oldestEntry: Date | null;
  } {
    let totalSize = 0;
    let oldestEntry: Date | null = null;

    for (const cached of this.imageCache.values()) {
      totalSize += cached.fileSize;
      if (!oldestEntry || cached.cachedAt < oldestEntry) {
        oldestEntry = cached.cachedAt;
      }
    }

    return {
      size: this.imageCache.size,
      memoryUsage: totalSize,
      hitRate: 0, // Would track hit rate in real implementation
      oldestEntry
    };
  }

  private async processImagePreview(
    instanceId: string,
    requestedSizes?: number[],
    format = 'jpeg',
    userId?: string
  ): Promise<ImagePreview> {
    try {
      // Get original image from Orthanc
      const imageResponse = await this.orthancClient.getInstancePreview(instanceId);
      if (!imageResponse.success || !imageResponse.data) {
        throw new Error(`Failed to get preview for instance ${instanceId}`);
      }

      // Determine sizes to generate
      const sizes = requestedSizes || this.config.thumbnailSizes;
      const imageSizes: ImageSize[] = [];

      // Generate different sizes
      for (const size of sizes) {
        const resizedImage = await this.resizeImage(imageResponse.data, size, format);
        const url = this.generateImageUrl(instanceId, size, format);
        
        imageSizes.push({
          width: size,
          height: size, // Simplified - would calculate actual dimensions
          url,
          fileSize: resizedImage.byteLength,
          mimeType: `image/${format}`
        });
      }

      // Generate cache key
      const cacheKey = this.generateCacheKey(instanceId, sizes, format);

      // Create preview object
      const preview: ImagePreview = {
        instanceId,
        sizes: imageSizes,
        format,
        generatedAt: new Date(),
        cacheKey,
        watermarked: this.config.watermarkEnabled,
        downloadAllowed: this.config.allowDownload
      };

      // Cache the preview
      if (this.config.cacheEnabled) {
        this.cacheImage(instanceId, preview, imageResponse.data.byteLength);
      }

      this.emit('image_processed', {
        instanceId,
        sizes: sizes.length,
        format,
        userId,
        processingTimeMs: Date.now() - Date.now() // Simplified
      });

      return preview;
    } catch (error) {
      this.emit('error', {
        code: 'IMAGE_PROCESSING_FAILED',
        message: `Failed to process image preview for instance ${instanceId}`,
        details: error,
        timestamp: new Date(),
        pluginName: 'ImageViewingPlugin',
        severity: 'medium'
      });
      throw error;
    }
  }

  private async resizeImage(
    imageData: ArrayBuffer,
    targetSize: number,
    format: string
  ): Promise<ArrayBuffer> {
    // In a real implementation, this would use an image processing library
    // like Sharp, ImageMagick, or Canvas API to resize the image
    console.log(`[Image Viewing] Resizing image to ${targetSize}px in ${format} format`);
    
    // Return original data for now (simplified)
    return imageData;
  }

  private async optimizeImage(
    imageData: ArrayBuffer,
    maxSize: number,
    format: string,
    quality: number,
    userId?: string
  ): Promise<ArrayBuffer> {
    // In a real implementation, this would:
    // 1. Resize image if larger than maxSize
    // 2. Apply compression based on quality setting
    // 3. Convert to requested format
    // 4. Apply any user-specific optimizations
    
    console.log(`[Image Viewing] Optimizing image: maxSize=${maxSize}, format=${format}, quality=${quality}`);
    
    return imageData; // Simplified
  }

  private async applyWatermark(
    image: { url: string; mimeType: string; fileSize: number },
    userId?: string
  ): Promise<ImageSize> {
    // In a real implementation, this would apply a watermark to the image
    console.log(`[Image Viewing] Applying watermark to image for user ${userId}`);
    
    return {
      width: 512, // Simplified
      height: 512,
      url: image.url,
      fileSize: image.fileSize,
      mimeType: image.mimeType
    };
  }

  private getCachedImage(
    instanceId: string,
    sizes?: number[],
    format = 'jpeg'
  ): ImagePreview | null {
    const cacheKey = this.generateCacheKey(instanceId, sizes || this.config.thumbnailSizes, format);
    const cached = this.imageCache.get(cacheKey);

    if (cached) {
      // Check if cache is still valid
      const now = new Date();
      const cacheAge = now.getTime() - cached.cachedAt.getTime();
      const maxAge = this.config.cacheExpirationHours * 60 * 60 * 1000;

      if (cacheAge < maxAge) {
        return cached.preview;
      } else {
        // Remove expired cache entry
        this.imageCache.delete(cacheKey);
      }
    }

    return null;
  }

  private cacheImage(instanceId: string, preview: ImagePreview, fileSize: number): void {
    const cached: CachedImage = {
      preview,
      fileSize,
      cachedAt: new Date()
    };

    this.imageCache.set(preview.cacheKey, cached);

    // Emit cache event
    this.emit('image_cached', {
      instanceId,
      cacheKey: preview.cacheKey,
      fileSize,
      cacheSize: this.imageCache.size
    });
  }

  private generateCacheKey(instanceId: string, sizes: number[], format: string): string {
    const sizeStr = sizes.sort().join(',');
    const data = `${instanceId}:${sizeStr}:${format}`;
    return createHash('md5').update(data).digest('hex');
  }

  private generateImageUrl(
    instanceId: string,
    size?: number,
    format = 'jpeg',
    quality?: number
  ): string {
    // In a real implementation, this would generate a proper URL
    // that can be used to access the image through the WebQX API
    const params = new URLSearchParams();
    if (size) params.append('size', size.toString());
    if (format !== 'jpeg') params.append('format', format);
    if (quality) params.append('quality', quality.toString());

    const queryString = params.toString() ? `?${params.toString()}` : '';
    return `/api/pacs/images/${instanceId}${queryString}`;
  }

  private generateDownloadUrl(instanceId: string, format = 'jpeg'): string {
    return `/api/pacs/images/${instanceId}/download?format=${format}`;
  }

  private async initializeImageProcessing(): Promise<void> {
    // Initialize image processing libraries and validate capabilities
    console.log('[Image Viewing Plugin] Initializing image processing capabilities');
    
    // In a real implementation, you would:
    // 1. Check if image processing libraries are available
    // 2. Validate supported formats
    // 3. Set up image processing workers if needed
    // 4. Test basic image operations
  }

  private setupCacheManagement(): void {
    if (this.config.cacheEnabled) {
      // Clean up expired cache entries every hour
      setInterval(() => {
        this.cleanupExpiredCache();
      }, 60 * 60 * 1000);

      // Monitor cache size and clean up if needed
      setInterval(() => {
        this.manageCacheSize();
      }, 15 * 60 * 1000); // Every 15 minutes
    }
  }

  private cleanupExpiredCache(): void {
    const now = new Date();
    const maxAge = this.config.cacheExpirationHours * 60 * 60 * 1000;
    const expiredKeys: string[] = [];

    for (const [key, cached] of this.imageCache.entries()) {
      const cacheAge = now.getTime() - cached.cachedAt.getTime();
      if (cacheAge > maxAge) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.imageCache.delete(key);
    }

    if (expiredKeys.length > 0) {
      this.emit('cache_cleaned', {
        expiredEntries: expiredKeys.length,
        remainingEntries: this.imageCache.size
      });
    }
  }

  private manageCacheSize(): void {
    const maxCacheEntries = 1000; // Configurable limit
    const maxMemoryUsage = 100 * 1024 * 1024; // 100MB limit

    const stats = this.getCacheStats();

    // Remove oldest entries if cache is too large
    if (this.imageCache.size > maxCacheEntries || stats.memoryUsage > maxMemoryUsage) {
      const entriesToRemove = Math.max(
        this.imageCache.size - maxCacheEntries,
        Math.ceil(this.imageCache.size * 0.1) // Remove 10% of entries
      );

      // Sort by cache date and remove oldest
      const sortedEntries = Array.from(this.imageCache.entries())
        .sort(([, a], [, b]) => a.cachedAt.getTime() - b.cachedAt.getTime());

      for (let i = 0; i < entriesToRemove && i < sortedEntries.length; i++) {
        const [key] = sortedEntries[i];
        this.imageCache.delete(key);
      }

      this.emit('cache_size_managed', {
        removedEntries: entriesToRemove,
        remainingEntries: this.imageCache.size,
        memoryUsage: this.getCacheStats().memoryUsage
      });
    }
  }
}

interface CachedImage {
  preview: ImagePreview;
  fileSize: number;
  cachedAt: Date;
}