/**
 * Core PACS Service
 * 
 * Main orchestration service for PACS integration, coordinating between
 * Orthanc, Dicoogle, OHIF, and PostDICOM services.
 */

import {
  PACSConfiguration,
  DICOMStudy,
  PACSSearchRequest,
  PACSSearchResponse,
  PACSUploadRequest,
  PACSUploadResponse,
  PACSTranscriptionRequest,
  PACSTranscriptionResponse,
  PACSAuditEvent,
  PACSMetrics,
  PACSServiceError,
  MedicalSpecialty
} from '../types';

import { OrthancService } from './orthancService';
import { DicoogleService } from './dicoogleService';
import { OHIFService } from './ohifService';
import { PostDICOMService } from './postdicomService';
import { DICOMWebService } from './dicomWebService';

export class PACSService {
  private orthancService: OrthancService;
  private dicoogleService: DicoogleService;
  private ohifService: OHIFService;
  private postdicomService: PostDICOMService;
  private dicomWebService: DICOMWebService;
  private configuration: PACSConfiguration;
  private auditEvents: PACSAuditEvent[] = [];

  constructor(configuration: PACSConfiguration) {
    this.configuration = configuration;
    this.initializeServices();
  }

  private initializeServices(): void {
    this.orthancService = new OrthancService(this.configuration.orthancConfig);
    this.dicoogleService = new DicoogleService(this.configuration.dicoogleConfig);
    this.ohifService = new OHIFService(this.configuration.ohifConfig);
    this.postdicomService = new PostDICOMService(this.configuration.postdicomConfig);
    this.dicomWebService = new DICOMWebService({
      orthancService: this.orthancService,
      dicoogleService: this.dicoogleService
    });
  }

  /**
   * Search for DICOM studies across all configured PACS
   */
  async searchStudies(request: PACSSearchRequest, userId: string, userRole: string): Promise<PACSSearchResponse> {
    const startTime = Date.now();
    
    try {
      this.auditEvent('access', 'study', 'search', userId, userRole, true);

      // Primary search through Dicoogle for advanced indexing
      let studies: DICOMStudy[] = [];
      
      if (this.configuration.dicoogleConfig) {
        studies = await this.dicoogleService.searchStudies(request);
      } else {
        // Fallback to Orthanc search
        studies = await this.orthancService.searchStudies(request);
      }

      // Apply specialty-specific filtering
      if (request.specialty && request.specialty.length > 0) {
        studies = this.filterBySpecialty(studies, request.specialty);
      }

      // Sort by study date (most recent first)
      studies.sort((a, b) => new Date(b.studyDate).getTime() - new Date(a.studyDate).getTime());

      // Apply pagination
      const offset = request.offset || 0;
      const limit = request.limit || 50;
      const paginatedStudies = studies.slice(offset, offset + limit);

      const searchTime = Date.now() - startTime;

      return {
        studies: paginatedStudies,
        totalCount: studies.length,
        offset,
        limit,
        searchTime
      };

    } catch (error) {
      this.auditEvent('access', 'study', 'search', userId, userRole, false, { error: error.message });
      throw new PACSServiceError('SEARCH_FAILED', `Failed to search studies: ${error.message}`, { request });
    }
  }

  /**
   * Upload DICOM files to PACS
   */
  async uploadStudy(request: PACSUploadRequest, userId: string, userRole: string): Promise<PACSUploadResponse> {
    try {
      this.auditEvent('upload', 'study', request.studyDescription || 'unknown', userId, userRole, true);

      // Primary upload to Orthanc
      const orthancResult = await this.orthancService.uploadFiles(request.files);
      
      // Sync to PostDICOM if cloud storage is enabled
      if (this.configuration.postdicomConfig.enableCloudStorage) {
        await this.postdicomService.syncStudy(orthancResult.studyInstanceUID);
      }

      // Index in Dicoogle for searchability
      if (orthancResult.success) {
        await this.dicoogleService.indexStudy(orthancResult.studyInstanceUID);
      }

      return {
        success: orthancResult.success,
        studyInstanceUID: orthancResult.studyInstanceUID,
        message: orthancResult.success ? 'Study uploaded successfully' : 'Upload failed',
        uploadedCount: orthancResult.uploadedCount,
        failedCount: orthancResult.failedCount,
        errors: orthancResult.errors
      };

    } catch (error) {
      this.auditEvent('upload', 'study', 'failed', userId, userRole, false, { error: error.message });
      throw new PACSServiceError('UPLOAD_FAILED', `Failed to upload study: ${error.message}`, { request });
    }
  }

  /**
   * Get OHIF viewer URL for a study
   */
  async getViewerUrl(studyInstanceUID: string, specialty: MedicalSpecialty, userId: string, userRole: string): Promise<string> {
    try {
      this.auditEvent('view', 'study', studyInstanceUID, userId, userRole, true);

      // Get specialty-specific viewer configuration
      const viewerConfig = this.getSpecialtyViewerConfig(specialty);
      
      return this.ohifService.generateViewerUrl(studyInstanceUID, viewerConfig);

    } catch (error) {
      this.auditEvent('view', 'study', studyInstanceUID, userId, userRole, false, { error: error.message });
      throw new PACSServiceError('VIEWER_FAILED', `Failed to generate viewer URL: ${error.message}`, { studyInstanceUID });
    }
  }

  /**
   * Transcribe audio or text for a study report
   */
  async transcribeReport(request: PACSTranscriptionRequest, userId: string, userRole: string): Promise<PACSTranscriptionResponse> {
    try {
      this.auditEvent('modify', 'report', request.studyInstanceUID, userId, userRole, true);

      // TODO: Integrate with existing Whisper service
      // For now, return a mock response
      const transcriptionId = `trans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      return {
        success: true,
        transcriptionId,
        transcribedText: request.textContent || 'Transcription service integration pending',
        confidence: 0.95,
        language: request.language,
        timestamp: new Date(),
        reviewRequired: request.reportType === 'preliminary'
      };

    } catch (error) {
      this.auditEvent('modify', 'report', request.studyInstanceUID, userId, userRole, false, { error: error.message });
      throw new PACSServiceError('TRANSCRIPTION_FAILED', `Failed to transcribe report: ${error.message}`, { request });
    }
  }

  /**
   * Get PACS system metrics
   */
  async getMetrics(): Promise<PACSMetrics> {
    try {
      const orthancStats = await this.orthancService.getStatistics();
      
      return {
        totalStudies: orthancStats.studies || 0,
        totalSeries: orthancStats.series || 0,
        totalInstances: orthancStats.instances || 0,
        storageUsedGB: orthancStats.storageGB || 0,
        activeUsers: this.getActiveUsersCount(),
        averageResponseTimeMs: this.calculateAverageResponseTime(),
        errorRate: this.calculateErrorRate(),
        uptime: process.uptime()
      };

    } catch (error) {
      throw new PACSServiceError('METRICS_FAILED', `Failed to get metrics: ${error.message}`);
    }
  }

  /**
   * Get audit events
   */
  getAuditEvents(filter?: { 
    eventType?: string; 
    userId?: string; 
    fromDate?: Date; 
    toDate?: Date; 
  }): PACSAuditEvent[] {
    let events = this.auditEvents;

    if (filter) {
      events = events.filter(event => {
        if (filter.eventType && event.eventType !== filter.eventType) return false;
        if (filter.userId && event.userId !== filter.userId) return false;
        if (filter.fromDate && event.timestamp < filter.fromDate) return false;
        if (filter.toDate && event.timestamp > filter.toDate) return false;
        return true;
      });
    }

    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Test PACS connectivity
   */
  async testConnectivity(): Promise<{ [service: string]: boolean }> {
    const results: { [service: string]: boolean } = {};

    try {
      results.orthanc = await this.orthancService.testConnection();
    } catch {
      results.orthanc = false;
    }

    try {
      results.dicoogle = await this.dicoogleService.testConnection();
    } catch {
      results.dicoogle = false;
    }

    try {
      results.postdicom = await this.postdicomService.testConnection();
    } catch {
      results.postdicom = false;
    }

    return results;
  }

  // Private helper methods

  private auditEvent(
    eventType: PACSAuditEvent['eventType'],
    resourceType: PACSAuditEvent['resourceType'],
    resourceId: string,
    userId: string,
    userRole: string,
    success: boolean,
    details?: Record<string, any>
  ): void {
    if (!this.configuration.security.auditLogging) return;

    const auditEvent: PACSAuditEvent = {
      eventType,
      resourceType,
      resourceId,
      userId,
      userRole,
      timestamp: new Date(),
      ipAddress: 'unknown', // Will be set by middleware
      userAgent: 'unknown', // Will be set by middleware
      success,
      details
    };

    this.auditEvents.push(auditEvent);

    // Keep only recent events in memory (for performance)
    if (this.auditEvents.length > 10000) {
      this.auditEvents = this.auditEvents.slice(-5000);
    }
  }

  private filterBySpecialty(studies: DICOMStudy[], specialties: MedicalSpecialty[]): DICOMStudy[] {
    return studies.filter(study => specialties.includes(study.specialty));
  }

  private getSpecialtyViewerConfig(specialty: MedicalSpecialty): any {
    const workflow = this.configuration.specialtyWorkflows.find(w => w.specialty === specialty);
    return workflow?.viewerSettings || this.configuration.ohifConfig.viewerPresets[0];
  }

  private getActiveUsersCount(): number {
    const recentEvents = this.auditEvents.filter(
      event => event.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );
    const uniqueUsers = new Set(recentEvents.map(event => event.userId));
    return uniqueUsers.size;
  }

  private calculateAverageResponseTime(): number {
    // This would be calculated from actual response times in a real implementation
    return 250; // Mock value
  }

  private calculateErrorRate(): number {
    const recentEvents = this.auditEvents.filter(
      event => event.timestamp > new Date(Date.now() - 60 * 60 * 1000)
    );
    
    if (recentEvents.length === 0) return 0;
    
    const errorCount = recentEvents.filter(event => !event.success).length;
    return (errorCount / recentEvents.length) * 100;
  }
}