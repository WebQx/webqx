/**
 * OHIF Viewer Service - Clinical Dashboard Integration
 * WebQX™ Healthcare Platform
 * 
 * Integrates with OHIF Viewer for clinical dashboards,
 * radiology and cardiology layouts, and AI overlays.
 */

import { PACS_CONFIG } from '../index';
import {
  DICOMStudy,
  ViewerConfig,
  PatientViewerConfig,
  PacsServiceResponse
} from '../types/pacsTypes';

export interface OHIFViewerSession {
  sessionId: string;
  studyInstanceUID: string;
  viewerUrl: string;
  config: ViewerConfig;
  expiresAt: string;
  userType: 'provider' | 'patient';
}

export interface AnnotationData {
  annotationId: string;
  studyInstanceUID: string;
  seriesInstanceUID: string;
  imageInstanceUID: string;
  annotationType: 'measurement' | 'text' | 'arrow' | 'circle' | 'rectangle';
  coordinates: number[];
  text?: string;
  measurements?: {
    length?: number;
    area?: number;
    angle?: number;
    unit: string;
  };
  createdBy: string;
  createdAt: string;
  modifiedAt?: string;
}

export class OHIFViewerService {
  private baseUrl: string;
  private activeSessions: Map<string, OHIFViewerSession> = new Map();

  constructor() {
    this.baseUrl = PACS_CONFIG.ohif.baseUrl;
  }

  /**
   * Create a provider viewer session for clinical dashboard
   */
  async createProviderSession(
    studyInstanceUID: string,
    specialty: 'radiology' | 'cardiology' | 'general' = 'general',
    providerId: string
  ): Promise<PacsServiceResponse<OHIFViewerSession>> {
    try {
      const config = this.getProviderViewerConfig(specialty);
      const session = await this.createViewerSession(studyInstanceUID, config, 'provider');
      
      // Store session for tracking
      this.activeSessions.set(session.sessionId, session);

      return {
        success: true,
        data: session,
        metadata: {
          timestamp: new Date().toISOString(),
          requestID: this.generateRequestId(),
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('Failed to create provider viewer session', error);
    }
  }

  /**
   * Create a patient viewer session with restricted access
   */
  async createPatientSession(
    studyInstanceUID: string,
    patientId: string,
    hasConsent: boolean = true
  ): Promise<PacsServiceResponse<OHIFViewerSession>> {
    try {
      if (!hasConsent) {
        throw new Error('Patient consent required for imaging access');
      }

      const config = this.getPatientViewerConfig();
      const session = await this.createViewerSession(studyInstanceUID, config, 'patient');
      
      // Store session for tracking
      this.activeSessions.set(session.sessionId, session);

      return {
        success: true,
        data: session,
        metadata: {
          timestamp: new Date().toISOString(),
          requestID: this.generateRequestId(),
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('Failed to create patient viewer session', error);
    }
  }

  /**
   * Get provider-specific viewer configuration
   */
  private getProviderViewerConfig(specialty: string): ViewerConfig {
    const baseConfig: ViewerConfig = {
      viewerType: 'ohif',
      enableAnnotations: PACS_CONFIG.ohif.enableAnnotations,
      enableMeasurements: true,
      enableAIOverlays: PACS_CONFIG.ohif.enableAIOverlays,
      restrictedMode: false,
      allowedTools: [
        'zoom',
        'pan',
        'brightness',
        'contrast',
        'invert',
        'rotate',
        'flip',
        'length',
        'angle',
        'rectangle',
        'ellipse',
        'freehand',
        'annotation'
      ],
      sessionTimeout: 240 // 4 hours for providers
    };

    // Specialty-specific configurations
    switch (specialty) {
      case 'radiology':
        return {
          ...baseConfig,
          allowedTools: [
            ...baseConfig.allowedTools,
            'magnify',
            'crosshairs',
            'stack',
            'wwwc',
            'probe',
            'cine'
          ],
          watermarkText: 'WebQX™ Radiology Dashboard'
        };

      case 'cardiology':
        return {
          ...baseConfig,
          allowedTools: [
            ...baseConfig.allowedTools,
            'cine',
            'multiframe',
            'ecg',
            'ejectionFraction'
          ],
          watermarkText: 'WebQX™ Cardiology Dashboard'
        };

      default:
        return {
          ...baseConfig,
          watermarkText: 'WebQX™ Clinical Dashboard'
        };
    }
  }

  /**
   * Get patient-specific viewer configuration (restricted)
   */
  private getPatientViewerConfig(): PatientViewerConfig {
    return {
      viewerType: 'ohif',
      enableAnnotations: false,
      enableMeasurements: false,
      enableAIOverlays: false,
      restrictedMode: true,
      allowedTools: ['zoom', 'pan', 'brightness'],
      enableDownload: false,
      enablePrint: false,
      enableShare: true,
      glossaryEnabled: true,
      transcriptionEnabled: true,
      watermarkText: 'WebQX™ Patient Portal - For Educational Use Only',
      sessionTimeout: 60 // 1 hour for patients
    };
  }

  /**
   * Create viewer session
   */
  private async createViewerSession(
    studyInstanceUID: string,
    config: ViewerConfig,
    userType: 'provider' | 'patient'
  ): Promise<OHIFViewerSession> {
    const sessionId = this.generateSessionId();
    const expiresAt = new Date(Date.now() + config.sessionTimeout * 60 * 1000).toISOString();
    
    // Build OHIF viewer URL with configuration
    const viewerUrl = this.buildViewerUrl(studyInstanceUID, sessionId, config);

    return {
      sessionId,
      studyInstanceUID,
      viewerUrl,
      config,
      expiresAt,
      userType
    };
  }

  /**
   * Build OHIF viewer URL with study and configuration
   */
  private buildViewerUrl(studyInstanceUID: string, sessionId: string, config: ViewerConfig): string {
    const params = new URLSearchParams({
      StudyInstanceUIDs: studyInstanceUID,
      sessionId,
      restrictedMode: config.restrictedMode.toString(),
      enableAnnotations: config.enableAnnotations.toString(),
      enableMeasurements: config.enableMeasurements.toString(),
      enableAIOverlays: config.enableAIOverlays.toString(),
      allowedTools: config.allowedTools.join(','),
      watermark: config.watermarkText || ''
    });

    return `${this.baseUrl}?${params.toString()}`;
  }

  /**
   * Save annotation data
   */
  async saveAnnotation(
    annotation: Omit<AnnotationData, 'annotationId' | 'createdAt'>
  ): Promise<PacsServiceResponse<AnnotationData>> {
    try {
      const fullAnnotation: AnnotationData = {
        ...annotation,
        annotationId: this.generateAnnotationId(),
        createdAt: new Date().toISOString()
      };

      // In a real implementation, this would save to a database
      // For now, we'll simulate saving
      console.log('Saving annotation:', fullAnnotation);

      return {
        success: true,
        data: fullAnnotation,
        metadata: {
          timestamp: new Date().toISOString(),
          requestID: this.generateRequestId(),
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('Failed to save annotation', error);
    }
  }

  /**
   * Get annotations for a study
   */
  async getStudyAnnotations(studyInstanceUID: string): Promise<PacsServiceResponse<AnnotationData[]>> {
    try {
      // In a real implementation, this would fetch from a database
      // For now, return empty array
      const annotations: AnnotationData[] = [];

      return {
        success: true,
        data: annotations,
        metadata: {
          timestamp: new Date().toISOString(),
          requestID: this.generateRequestId(),
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('Failed to get study annotations', error);
    }
  }

  /**
   * Close viewer session
   */
  async closeSession(sessionId: string): Promise<PacsServiceResponse<void>> {
    try {
      this.activeSessions.delete(sessionId);

      return {
        success: true,
        metadata: {
          timestamp: new Date().toISOString(),
          requestID: this.generateRequestId(),
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('Failed to close session', error);
    }
  }

  /**
   * Get active sessions (for monitoring)
   */
  getActiveSessions(): OHIFViewerSession[] {
    const now = new Date();
    
    // Clean up expired sessions
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (new Date(session.expiresAt) < now) {
        this.activeSessions.delete(sessionId);
      }
    }

    return Array.from(this.activeSessions.values());
  }

  /**
   * Enable AI overlay for a session
   */
  async enableAIOverlay(
    sessionId: string,
    overlayType: 'lesion_detection' | 'organ_segmentation' | 'pathology_highlighting'
  ): Promise<PacsServiceResponse<void>> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      if (session.userType === 'patient') {
        throw new Error('AI overlays not available for patient sessions');
      }

      // In a real implementation, this would trigger AI processing
      console.log(`Enabling AI overlay ${overlayType} for session ${sessionId}`);

      return {
        success: true,
        metadata: {
          timestamp: new Date().toISOString(),
          requestID: this.generateRequestId(),
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('Failed to enable AI overlay', error);
    }
  }

  /**
   * Helper methods
   */
  private generateSessionId(): string {
    return `ohif_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAnnotationId(): string {
    return `annotation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRequestId(): string {
    return `ohif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleError(message: string, error: any): PacsServiceResponse<never> {
    console.error(message, error);
    return {
      success: false,
      error: {
        code: 'OHIF_ERROR',
        message,
        details: error.message || error
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestID: this.generateRequestId(),
        processingTime: Date.now()
      }
    };
  }
}