/**
 * Imaging API Service for WebQX™ OHIF Integration
 * 
 * Provides high-level API interface for imaging operations,
 * integrating DICOM service, performance optimization, and WebQX™ features.
 */

import { 
  ImagingAPIRequest, 
  ImagingAPIResponse, 
  WebQXStudyMetadata, 
  WebQXSeriesMetadata,
  WebQXUser,
  StudyAnnotation,
  ImagingWorkflow,
  PerformanceMetrics
} from '../types';

import DICOMService from './dicomService';
import PerformanceService from './performanceService';

export class ImagingAPI {
  private dicomService: DICOMService;
  private performanceService: PerformanceService;
  private workflows: Map<string, ImagingWorkflow> = new Map();

  constructor(config: {
    dicomBaseUrl: string;
    enablePerformanceOptimization?: boolean;
    cacheSize?: number;
  }) {
    // Initialize DICOM service
    this.dicomService = new DICOMService({
      baseUrl: config.dicomBaseUrl,
      cacheConfig: {
        maxSize: config.cacheSize || 512,
        ttl: 3600, // 1 hour
        strategy: 'lru',
        compression: true
      }
    });

    // Initialize performance service
    this.performanceService = new PerformanceService({
      maxSize: config.cacheSize || 512,
      ttl: 3600,
      strategy: 'lru',
      compression: true
    });

    this.initializeWorkflows();
  }

  /**
   * Get study with enhanced WebQX™ features
   */
  async getStudy(
    studyInstanceUID: string, 
    user: WebQXUser,
    options: {
      includeAnnotations?: boolean;
      prefetchSeries?: boolean;
      workflow?: string;
    } = {}
  ): Promise<ImagingAPIResponse<WebQXStudyMetadata>> {
    try {
      // Get study metadata
      const studyResponse = await this.dicomService.getStudyMetadata(studyInstanceUID, user);
      
      if (!studyResponse.success) {
        return studyResponse;
      }

      const study = studyResponse.data!;

      // Apply workflow-specific enhancements
      if (options.workflow) {
        const workflow = this.workflows.get(options.workflow);
        if (workflow) {
          study.workflow = workflow.id;
          
          // Preload workflow-specific data
          await this.performanceService.preloadWorkflowData(
            workflow.id,
            user.id,
            { patientId: study.webqxPatientId }
          );
        }
      }

      // Prefetch series if requested
      if (options.prefetchSeries && study.series) {
        for (const series of study.series) {
          this.performanceService.schedulePrefetch(studyInstanceUID, {
            seriesInstanceUID: series.seriesInstanceUID,
            priority: 3,
            userId: user.id
          });
        }
      }

      // Load annotations if requested
      if (options.includeAnnotations) {
        const annotations = await this.getStudyAnnotations(studyInstanceUID, user);
        if (annotations.success) {
          study.annotations = annotations.data;
        }
      }

      return {
        success: true,
        data: study,
        metadata: studyResponse.metadata
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'API_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: { studyInstanceUID, userId: user.id }
        }
      };
    }
  }

  /**
   * Get series with performance optimization
   */
  async getSeries(
    studyInstanceUID: string,
    seriesInstanceUID: string,
    user: WebQXUser,
    options: {
      preloadImages?: boolean;
      imageQuality?: 'low' | 'medium' | 'high';
    } = {}
  ): Promise<ImagingAPIResponse<WebQXSeriesMetadata>> {
    try {
      const seriesResponse = await this.dicomService.getSeriesMetadata(
        studyInstanceUID,
        seriesInstanceUID,
        user
      );

      if (!seriesResponse.success) {
        return seriesResponse;
      }

      const series = seriesResponse.data!;

      // Optimize based on user preferences
      const userPrefs = this.performanceService.optimizeForUser(user);
      
      // Apply quality settings
      if (options.imageQuality) {
        series.preferredQuality = options.imageQuality;
      } else {
        series.preferredQuality = userPrefs.imageQuality;
      }

      // Preload images if requested and user preferences allow
      if (options.preloadImages && userPrefs.prefetchEnabled) {
        await this.preloadSeriesImages(studyInstanceUID, seriesInstanceUID, user);
      }

      return {
        success: true,
        data: series,
        metadata: seriesResponse.metadata
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'API_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Search studies with advanced filtering and RBAC
   */
  async searchStudies(
    criteria: {
      patientId?: string;
      patientName?: string;
      studyDate?: string;
      modality?: string;
      specialty?: string;
      workflow?: string;
      limit?: number;
      offset?: number;
    },
    user: WebQXUser
  ): Promise<ImagingAPIResponse<WebQXStudyMetadata[]>> {
    try {
      // Apply role-based filtering
      const filteredCriteria = this.applyRoleBasedFiltering(criteria, user);
      
      const searchResponse = await this.dicomService.searchStudies(filteredCriteria, user);
      
      if (!searchResponse.success) {
        return searchResponse;
      }

      let studies = searchResponse.data!;

      // Apply workflow filtering if specified
      if (criteria.workflow) {
        studies = studies.filter(study => study.workflow === criteria.workflow);
      }

      // Apply pagination
      const limit = criteria.limit || 50;
      const offset = criteria.offset || 0;
      studies = studies.slice(offset, offset + limit);

      // Prefetch high-priority studies
      this.prefetchHighPriorityStudies(studies, user);

      return {
        success: true,
        data: studies,
        metadata: searchResponse.metadata
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
   * Save study annotation with audit logging
   */
  async saveAnnotation(
    studyInstanceUID: string,
    annotation: Omit<StudyAnnotation, 'id' | 'timestamp'>,
    user: WebQXUser
  ): Promise<ImagingAPIResponse<StudyAnnotation>> {
    try {
      // Validate user permissions
      if (!user.permissions.includes('annotate_images')) {
        return {
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'User does not have permission to create annotations'
          }
        };
      }

      const fullAnnotation: StudyAnnotation = {
        id: this.generateId(),
        timestamp: new Date(),
        ...annotation
      };

      // In real implementation, save to backend
      const saveResult = await this.mockSaveAnnotation(studyInstanceUID, fullAnnotation);

      if (saveResult) {
        // Log the action for audit
        await this.logAuditEvent('annotation_created', {
          studyInstanceUID,
          annotationId: fullAnnotation.id,
          userId: user.id,
          annotationType: annotation.type
        });

        return {
          success: true,
          data: fullAnnotation,
          metadata: {
            requestId: this.generateId(),
            timestamp: new Date(),
            processingTime: 0,
            cacheHit: false
          }
        };
      }

      throw new Error('Failed to save annotation');

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ANNOTATION_SAVE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to save annotation'
        }
      };
    }
  }

  /**
   * Get study annotations with role-based filtering
   */
  async getStudyAnnotations(
    studyInstanceUID: string,
    user: WebQXUser
  ): Promise<ImagingAPIResponse<StudyAnnotation[]>> {
    try {
      // Mock implementation - in real system, fetch from backend
      const allAnnotations = await this.mockGetAnnotations(studyInstanceUID);
      
      // Filter based on user role and annotation visibility
      const visibleAnnotations = allAnnotations.filter(annotation => {
        if (annotation.visibility === 'public') return true;
        if (annotation.visibility === 'private' && annotation.authorId === user.id) return true;
        if (annotation.visibility === 'role-restricted' && annotation.authorRole === user.role) return true;
        return false;
      });

      return {
        success: true,
        data: visibleAnnotations,
        metadata: {
          requestId: this.generateId(),
          timestamp: new Date(),
          processingTime: 0,
          cacheHit: false
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ANNOTATION_FETCH_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch annotations'
        }
      };
    }
  }

  /**
   * Get performance metrics and system status
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const dicomMetrics = this.dicomService.getMetrics();
    const perfMetrics = this.performanceService.getMetrics();

    return {
      loadTime: (dicomMetrics.loadTime + perfMetrics.loadTime) / 2,
      renderTime: perfMetrics.renderTime,
      memoryUsage: perfMetrics.memoryUsage,
      networkLatency: dicomMetrics.networkLatency,
      cacheHitRate: (dicomMetrics.cacheHitRate + perfMetrics.cacheHitRate) / 2
    };
  }

  /**
   * Clear caches and reset performance state
   */
  clearCaches(strategy: 'all' | 'expired' | 'user', userId?: string): void {
    this.dicomService.clearCache(strategy, userId);
    this.performanceService.clearCache(strategy === 'user' ? 'all' : strategy);
  }

  // Private helper methods

  private async preloadSeriesImages(
    studyInstanceUID: string,
    seriesInstanceUID: string,
    user: WebQXUser
  ): Promise<void> {
    // Mock implementation - in real system, preload first few images
    this.performanceService.schedulePrefetch(studyInstanceUID, {
      seriesInstanceUID,
      priority: 4,
      userId: user.id,
      immediate: true
    });
  }

  private applyRoleBasedFiltering(criteria: any, user: WebQXUser): any {
    const filtered = { ...criteria };

    // Restrict based on user specialty
    if (user.specialty && !filtered.specialty) {
      filtered.specialty = user.specialty;
    }

    // Limit results for certain roles
    if (user.role === 'student') {
      filtered.limit = Math.min(filtered.limit || 10, 10);
    }

    return filtered;
  }

  private prefetchHighPriorityStudies(studies: WebQXStudyMetadata[], user: WebQXUser): void {
    const highPriorityStudies = studies
      .filter(study => study.priority === 'urgent' || study.priority === 'high')
      .slice(0, 3); // Limit to top 3

    highPriorityStudies.forEach(study => {
      this.performanceService.schedulePrefetch(study.studyInstanceUID, {
        priority: study.priority === 'urgent' ? 5 : 4,
        userId: user.id
      });
    });
  }

  private initializeWorkflows(): void {
    // Mock workflow definitions - in real implementation, load from configuration
    const radiologyWorkflow: ImagingWorkflow = {
      id: 'radiology-interpretation',
      name: 'Radiology Interpretation',
      specialty: 'radiology',
      steps: [
        {
          id: 'initial-review',
          name: 'Initial Review',
          order: 1,
          required: true,
          tools: ['windowLevel', 'zoom', 'pan']
        },
        {
          id: 'measurements',
          name: 'Measurements',
          order: 2,
          required: false,
          tools: ['length', 'area', 'angle']
        },
        {
          id: 'annotation',
          name: 'Annotation',
          order: 3,
          required: false,
          tools: ['text', 'arrow', 'circle']
        }
      ],
      permissions: ['view_images', 'annotate_images', 'measure_images'],
      uiConfig: {
        layout: {
          type: 'grid',
          rows: 1,
          columns: 2,
          viewports: []
        },
        panels: [],
        tools: [],
        theme: {
          name: 'radiology-dark',
          colors: {
            primary: '#1976d2',
            secondary: '#424242',
            background: '#121212',
            surface: '#1e1e1e',
            text: '#ffffff',
            border: '#333333',
            accent: '#2196f3',
            warning: '#ff9800',
            error: '#f44336',
            success: '#4caf50'
          },
          typography: {
            fontFamily: 'Roboto',
            fontSize: {},
            fontWeight: {},
            lineHeight: {}
          },
          spacing: {
            unit: 8,
            scale: [0, 4, 8, 16, 24, 32, 40, 48, 56, 64]
          },
          animations: {
            duration: {},
            easing: {}
          }
        }
      }
    };

    this.workflows.set(radiologyWorkflow.id, radiologyWorkflow);
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async mockSaveAnnotation(studyInstanceUID: string, annotation: StudyAnnotation): Promise<boolean> {
    // Mock implementation - in real system, save to backend
    await new Promise(resolve => setTimeout(resolve, 100));
    return true;
  }

  private async mockGetAnnotations(studyInstanceUID: string): Promise<StudyAnnotation[]> {
    // Mock implementation - return sample annotations
    return [
      {
        id: 'annotation-1',
        type: 'text',
        authorId: 'user-1',
        authorRole: 'radiologist',
        timestamp: new Date(),
        content: {
          text: 'Suspicious lesion noted',
          coordinates: [100, 200],
          style: {
            color: '#ff0000',
            thickness: 2,
            opacity: 0.8
          }
        },
        visibility: 'public'
      }
    ];
  }

  private async logAuditEvent(action: string, details: any): Promise<void> {
    // Mock implementation - in real system, log to audit service
    console.log(`Audit Event: ${action}`, details);
  }
}

// Export as default for backwards compatibility
export default ImagingAPI;