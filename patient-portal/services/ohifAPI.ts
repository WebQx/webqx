/**
 * @fileoverview OHIF Viewer API Service
 * 
 * Enhanced API service for OHIF viewer integration with WebQX platform.
 * Provides secure, authenticated access to imaging data with audit logging
 * and performance optimizations.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { ImagingStudy, ViewerConfig } from '../components/imaging/SecureImagingViewer';

export interface OHIFConfiguration {
  viewerUrl: string;
  apiEndpoint: string;
  enableAnnotations: boolean;
  enableMeasurements: boolean;
  patientMode: boolean;
  theme: 'light' | 'dark' | 'auto';
  language: string;
  customizations?: {
    branding?: {
      logoUrl?: string;
      organizationName?: string;
      primaryColor?: string;
      secondaryColor?: string;
    };
    features?: {
      enableDownload?: boolean;
      enablePrint?: boolean;
      enableShare?: boolean;
      enableFullscreen?: boolean;
    };
  };
}

export interface StudyMetadata {
  studyInstanceUID: string;
  seriesInstanceUIDs: string[];
  patientId: string;
  studyDate: string;
  studyTime?: string;
  modality: string;
  studyDescription: string;
  seriesCount: number;
  instanceCount: number;
  studySize: number;
}

export interface ViewerSession {
  sessionId: string;
  studyId: string;
  patientId: string;
  startTime: Date;
  lastActivity: Date;
  viewerConfig: OHIFConfiguration;
  auditTrail: ViewerAuditEvent[];
}

export interface ViewerAuditEvent {
  eventType: 'viewer_open' | 'study_load' | 'tool_use' | 'viewer_close' | 'error';
  timestamp: Date;
  details: {
    action?: string;
    toolUsed?: string;
    error?: string;
    metadata?: any;
  };
}

export interface PerformanceMetrics {
  initialLoadTime: number;
  imageLoadTimes: number[];
  averageImageLoadTime: number;
  totalStudySize: number;
  cacheHitRate: number;
  networkRequests: number;
  errorCount: number;
}

/**
 * Enhanced OHIF API service with security and performance features
 */
export class OHIFAPIService {
  private baseUrl: string;
  private authToken: string | null = null;
  private activeSessions = new Map<string, ViewerSession>();
  private performanceMetrics = new Map<string, PerformanceMetrics>();

  constructor(baseUrl: string = '/api/imaging') {
    this.baseUrl = baseUrl;
    this.authToken = localStorage.getItem('authToken');
  }

  /**
   * Initialize OHIF viewer session with security and audit logging
   */
  async initializeViewerSession(
    studyId: string,
    patientId: string,
    config: Partial<OHIFConfiguration> = {}
  ): Promise<ViewerSession> {
    const sessionId = this.generateSessionId();
    
    // Default OHIF configuration for patient portal
    const defaultConfig: OHIFConfiguration = {
      viewerUrl: '/ohif/viewer',
      apiEndpoint: `${this.baseUrl}/dicom-web`,
      enableAnnotations: false, // Disabled for patient portal
      enableMeasurements: false, // Disabled for patient portal
      patientMode: true,
      theme: 'light',
      language: localStorage.getItem('i18nextLng') || 'en',
      customizations: {
        branding: {
          organizationName: 'WebQX Health',
          primaryColor: '#2563eb',
          secondaryColor: '#64748b',
        },
        features: {
          enableDownload: false, // Restricted for patients
          enablePrint: true,
          enableShare: false, // Controlled sharing only
          enableFullscreen: true,
        },
      },
    };

    const viewerConfig = { ...defaultConfig, ...config };
    
    const session: ViewerSession = {
      sessionId,
      studyId,
      patientId,
      startTime: new Date(),
      lastActivity: new Date(),
      viewerConfig,
      auditTrail: [],
    };

    // Log session start
    await this.logAuditEvent(session, {
      eventType: 'viewer_open',
      timestamp: new Date(),
      details: {
        action: 'session_start',
        metadata: {
          studyId,
          patientId,
          config: viewerConfig,
        },
      },
    });

    this.activeSessions.set(sessionId, session);
    return session;
  }

  /**
   * Get OHIF viewer URL with embedded configuration
   */
  getViewerUrl(session: ViewerSession, studyMetadata: StudyMetadata): string {
    const config = session.viewerConfig;
    const baseUrl = new URL(config.viewerUrl, window.location.origin);
    
    // Add study parameters
    baseUrl.searchParams.set('studyInstanceUIDs', studyMetadata.studyInstanceUID);
    baseUrl.searchParams.set('patientId', session.patientId);
    baseUrl.searchParams.set('sessionId', session.sessionId);
    
    // Add configuration
    baseUrl.searchParams.set('patientMode', config.patientMode.toString());
    baseUrl.searchParams.set('enableAnnotations', config.enableAnnotations.toString());
    baseUrl.searchParams.set('enableMeasurements', config.enableMeasurements.toString());
    baseUrl.searchParams.set('theme', config.theme);
    baseUrl.searchParams.set('language', config.language);
    
    // Add customizations
    if (config.customizations) {
      baseUrl.searchParams.set('customizations', JSON.stringify(config.customizations));
    }

    return baseUrl.toString();
  }

  /**
   * Get study metadata for OHIF viewer
   */
  async getStudyMetadata(studyId: string): Promise<StudyMetadata> {
    const response = await this.authenticatedFetch(`${this.baseUrl}/studies/${studyId}/metadata`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch study metadata: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get DICOM-WEB compatible study data
   */
  async getDICOMWebStudy(studyInstanceUID: string): Promise<any> {
    const response = await this.authenticatedFetch(
      `${this.baseUrl}/dicom-web/studies/${studyInstanceUID}`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch DICOM-WEB study: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get DICOM-WEB series data
   */
  async getDICOMWebSeries(studyInstanceUID: string, seriesInstanceUID?: string): Promise<any> {
    let url = `${this.baseUrl}/dicom-web/studies/${studyInstanceUID}/series`;
    if (seriesInstanceUID) {
      url += `/${seriesInstanceUID}`;
    }
    
    const response = await this.authenticatedFetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch DICOM-WEB series: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get DICOM-WEB instances data
   */
  async getDICOMWebInstances(
    studyInstanceUID: string,
    seriesInstanceUID: string,
    sopInstanceUID?: string
  ): Promise<any> {
    let url = `${this.baseUrl}/dicom-web/studies/${studyInstanceUID}/series/${seriesInstanceUID}/instances`;
    if (sopInstanceUID) {
      url += `/${sopInstanceUID}`;
    }
    
    const response = await this.authenticatedFetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch DICOM-WEB instances: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get WADO-URI image data
   */
  async getWADOURI(
    studyInstanceUID: string,
    seriesInstanceUID: string,
    sopInstanceUID: string,
    params: Record<string, string> = {}
  ): Promise<Blob> {
    const url = new URL(`${this.baseUrl}/wado`);
    url.searchParams.set('requestType', 'WADO');
    url.searchParams.set('studyUID', studyInstanceUID);
    url.searchParams.set('seriesUID', seriesInstanceUID);
    url.searchParams.set('objectUID', sopInstanceUID);
    
    // Add additional parameters
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    
    const response = await this.authenticatedFetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`Failed to fetch WADO-URI image: ${response.statusText}`);
    }

    return await response.blob();
  }

  /**
   * Track viewer performance metrics
   */
  trackPerformanceMetric(sessionId: string, metric: Partial<PerformanceMetrics>): void {
    const existing = this.performanceMetrics.get(sessionId) || {
      initialLoadTime: 0,
      imageLoadTimes: [],
      averageImageLoadTime: 0,
      totalStudySize: 0,
      cacheHitRate: 0,
      networkRequests: 0,
      errorCount: 0,
    };

    const updated = { ...existing, ...metric };
    
    // Calculate average if new image load time is provided
    if (metric.imageLoadTimes && metric.imageLoadTimes.length > 0) {
      updated.imageLoadTimes = [...existing.imageLoadTimes, ...metric.imageLoadTimes];
      updated.averageImageLoadTime = updated.imageLoadTimes.reduce((a, b) => a + b, 0) / updated.imageLoadTimes.length;
    }

    this.performanceMetrics.set(sessionId, updated);
  }

  /**
   * Get performance metrics for session
   */
  getPerformanceMetrics(sessionId: string): PerformanceMetrics | null {
    return this.performanceMetrics.get(sessionId) || null;
  }

  /**
   * Log audit event for viewer session
   */
  async logAuditEvent(session: ViewerSession, event: ViewerAuditEvent): Promise<void> {
    session.auditTrail.push(event);
    session.lastActivity = new Date();

    // Send audit event to server
    try {
      await this.authenticatedFetch(`${this.baseUrl}/audit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: session.sessionId,
          patientId: session.patientId,
          studyId: session.studyId,
          event,
        }),
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }

  /**
   * Close viewer session
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return;
    }

    // Log session end
    await this.logAuditEvent(session, {
      eventType: 'viewer_close',
      timestamp: new Date(),
      details: {
        action: 'session_end',
        metadata: {
          duration: Date.now() - session.startTime.getTime(),
          auditEventCount: session.auditTrail.length,
        },
      },
    });

    this.activeSessions.delete(sessionId);
    this.performanceMetrics.delete(sessionId);
  }

  /**
   * Get active session
   */
  getSession(sessionId: string): ViewerSession | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Update viewer configuration
   */
  async updateViewerConfig(
    sessionId: string,
    configUpdates: Partial<OHIFConfiguration>
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.viewerConfig = { ...session.viewerConfig, ...configUpdates };
    session.lastActivity = new Date();

    // Log configuration change
    await this.logAuditEvent(session, {
      eventType: 'tool_use',
      timestamp: new Date(),
      details: {
        action: 'config_update',
        metadata: configUpdates,
      },
    });
  }

  /**
   * Perform authenticated fetch with automatic token refresh
   */
  private async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = {
      'Authorization': `Bearer ${this.authToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle token refresh if needed
    if (response.status === 401) {
      await this.refreshToken();
      
      // Retry with new token
      return fetch(url, {
        ...options,
        headers: {
          ...headers,
          'Authorization': `Bearer ${this.authToken}`,
        },
      });
    }

    return response;
  }

  /**
   * Refresh authentication token
   */
  private async refreshToken(): Promise<void> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const { accessToken } = await response.json();
    this.authToken = accessToken;
    localStorage.setItem('authToken', accessToken);
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `ohif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Create singleton instance
export const ohifAPI = new OHIFAPIService();