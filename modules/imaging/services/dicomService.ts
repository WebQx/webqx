/**
 * DICOM Service for WebQX™ OHIF Integration
 * 
 * Provides core DICOM operations, metadata handling, and study management
 * integrated with WebQX™ authentication and audit systems.
 */

import { 
  WebQXStudyMetadata, 
  WebQXSeriesMetadata, 
  ImagingAPIRequest, 
  ImagingAPIResponse,
  WebQXUser,
  Permission,
  CacheConfiguration,
  PerformanceMetrics 
} from '../types';

export class DICOMService {
  private baseUrl: string;
  private cacheConfig: CacheConfiguration;
  private cache: Map<string, any> = new Map();
  private metrics: PerformanceMetrics = {
    loadTime: 0,
    renderTime: 0,
    memoryUsage: 0,
    networkLatency: 0,
    cacheHitRate: 0
  };

  constructor(config: {
    baseUrl: string;
    cacheConfig: CacheConfiguration;
    enableMetrics?: boolean;
  }) {
    this.baseUrl = config.baseUrl;
    this.cacheConfig = config.cacheConfig;
  }

  /**
   * Retrieve study metadata with user-based access control
   */
  async getStudyMetadata(
    studyInstanceUID: string, 
    user: WebQXUser
  ): Promise<ImagingAPIResponse<WebQXStudyMetadata>> {
    const startTime = performance.now();
    
    try {
      // Check cache first
      const cacheKey = `study:${studyInstanceUID}:${user.id}`;
      if (this.cache.has(cacheKey)) {
        this.updateMetrics('cacheHit', performance.now() - startTime);
        return {
          success: true,
          data: this.cache.get(cacheKey),
          metadata: {
            requestId: this.generateRequestId(),
            timestamp: new Date(),
            processingTime: performance.now() - startTime,
            cacheHit: true
          }
        };
      }

      // Validate user permissions
      if (!this.hasPermission(user, 'view_images')) {
        return {
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'User does not have permission to view images'
          }
        };
      }

      // Fetch from DICOM server
      const response = await fetch(`${this.baseUrl}/studies/${studyInstanceUID}`, {
        headers: {
          'Authorization': `Bearer ${user.id}`, // In real implementation, use JWT
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`DICOM server error: ${response.status}`);
      }

      const studyData = await response.json();
      const enhancedStudyData = this.enhanceStudyMetadata(studyData, user);

      // Cache the result
      this.cache.set(cacheKey, enhancedStudyData);

      this.updateMetrics('networkRequest', performance.now() - startTime);

      return {
        success: true,
        data: enhancedStudyData,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date(),
          processingTime: performance.now() - startTime,
          cacheHit: false
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'DICOM_SERVICE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: { studyInstanceUID, userId: user.id }
        }
      };
    }
  }

  /**
   * Retrieve series metadata for a specific study
   */
  async getSeriesMetadata(
    studyInstanceUID: string,
    seriesInstanceUID: string,
    user: WebQXUser
  ): Promise<ImagingAPIResponse<WebQXSeriesMetadata>> {
    const startTime = performance.now();

    try {
      const cacheKey = `series:${seriesInstanceUID}:${user.id}`;
      
      if (this.cache.has(cacheKey)) {
        return {
          success: true,
          data: this.cache.get(cacheKey),
          metadata: {
            requestId: this.generateRequestId(),
            timestamp: new Date(),
            processingTime: performance.now() - startTime,
            cacheHit: true
          }
        };
      }

      if (!this.hasPermission(user, 'view_images')) {
        return {
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'User does not have permission to view images'
          }
        };
      }

      const response = await fetch(
        `${this.baseUrl}/studies/${studyInstanceUID}/series/${seriesInstanceUID}`,
        {
          headers: {
            'Authorization': `Bearer ${user.id}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`DICOM server error: ${response.status}`);
      }

      const seriesData = await response.json();
      const enhancedSeriesData = this.enhanceSeriesMetadata(seriesData);

      this.cache.set(cacheKey, enhancedSeriesData);

      return {
        success: true,
        data: enhancedSeriesData,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date(),
          processingTime: performance.now() - startTime,
          cacheHit: false
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'DICOM_SERVICE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Search for studies based on criteria with RBAC filtering
   */
  async searchStudies(
    criteria: {
      patientId?: string;
      patientName?: string;
      studyDate?: string;
      modality?: string;
      specialty?: string;
    },
    user: WebQXUser
  ): Promise<ImagingAPIResponse<WebQXStudyMetadata[]>> {
    const startTime = performance.now();

    try {
      if (!this.hasPermission(user, 'view_images')) {
        return {
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'User does not have permission to search studies'
          }
        };
      }

      const queryParams = new URLSearchParams();
      Object.entries(criteria).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });

      // Add role-based filtering
      queryParams.append('userRole', user.role);
      if (user.specialty) {
        queryParams.append('specialty', user.specialty);
      }

      const response = await fetch(`${this.baseUrl}/studies/search?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${user.id}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const studies = await response.json();
      const enhancedStudies = studies.map((study: any) => 
        this.enhanceStudyMetadata(study, user)
      );

      return {
        success: true,
        data: enhancedStudies,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date(),
          processingTime: performance.now() - startTime,
          cacheHit: false
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SEARCH_ERROR',
          message: error instanceof Error ? error.message : 'Search failed'
        }
      };
    }
  }

  /**
   * Get image data for specific instance
   */
  async getImageData(
    studyInstanceUID: string,
    seriesInstanceUID: string,
    imageInstanceUID: string,
    user: WebQXUser
  ): Promise<ImagingAPIResponse<ArrayBuffer>> {
    const startTime = performance.now();

    try {
      if (!this.hasPermission(user, 'view_images')) {
        return {
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'User does not have permission to view images'
          }
        };
      }

      const cacheKey = `image:${imageInstanceUID}`;
      if (this.cache.has(cacheKey)) {
        return {
          success: true,
          data: this.cache.get(cacheKey),
          metadata: {
            requestId: this.generateRequestId(),
            timestamp: new Date(),
            processingTime: performance.now() - startTime,
            cacheHit: true
          }
        };
      }

      const response = await fetch(
        `${this.baseUrl}/studies/${studyInstanceUID}/series/${seriesInstanceUID}/instances/${imageInstanceUID}`,
        {
          headers: {
            'Authorization': `Bearer ${user.id}`,
            'Accept': 'application/dicom'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      const imageData = await response.arrayBuffer();
      
      // Cache with size limit
      if (imageData.byteLength < this.cacheConfig.maxSize * 1024 * 1024) {
        this.cache.set(cacheKey, imageData);
      }

      return {
        success: true,
        data: imageData,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date(),
          processingTime: performance.now() - startTime,
          cacheHit: false
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'IMAGE_FETCH_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch image'
        }
      };
    }
  }

  /**
   * Clear cache entries based on strategy
   */
  clearCache(strategy: 'all' | 'expired' | 'user', userId?: string): void {
    switch (strategy) {
      case 'all':
        this.cache.clear();
        break;
      case 'expired':
        // Implementation would check TTL
        break;
      case 'user':
        if (userId) {
          const keysToDelete = Array.from(this.cache.keys())
            .filter(key => key.includes(userId));
          keysToDelete.forEach(key => this.cache.delete(key));
        }
        break;
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  // Private helper methods

  private enhanceStudyMetadata(study: any, user: WebQXUser): WebQXStudyMetadata {
    return {
      ...study,
      webqxPatientId: study.patientId || '',
      accessibleBy: this.getAccessibleRoles(study, user),
      workflow: this.determineWorkflow(study, user),
      priority: study.priority || 'normal',
      clinicalContext: study.clinicalContext,
      annotations: study.annotations || []
    };
  }

  private enhanceSeriesMetadata(series: any): WebQXSeriesMetadata {
    return {
      ...series,
      processingStatus: series.processingStatus || 'completed',
      qualityMetrics: series.qualityMetrics,
      aiAnalysis: series.aiAnalysis || []
    };
  }

  private hasPermission(user: WebQXUser, permission: Permission): boolean {
    return user.permissions.includes(permission);
  }

  private getAccessibleRoles(study: any, user: WebQXUser): string[] {
    // Default accessibility based on study type and user role
    const baseRoles = ['radiologist', 'physician'];
    if (user.specialty === 'radiology') {
      baseRoles.push('technician');
    }
    return baseRoles;
  }

  private determineWorkflow(study: any, user: WebQXUser): string | undefined {
    // Determine workflow based on study modality and user specialty
    const modality = study.modality;
    const specialty = user.specialty;

    if (specialty === 'radiology') {
      return 'radiology-interpretation';
    } else if (specialty === 'cardiology' && modality === 'CT') {
      return 'cardiac-ct-analysis';
    }
    
    return 'general-viewing';
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateMetrics(type: 'cacheHit' | 'networkRequest', duration: number): void {
    if (type === 'cacheHit') {
      this.metrics.cacheHitRate = (this.metrics.cacheHitRate + 1) / 2; // Simple running average
    }
    this.metrics.loadTime = duration;
    this.metrics.networkLatency = type === 'networkRequest' ? duration : this.metrics.networkLatency;
  }
}

// Export as default for backwards compatibility
export default DICOMService;