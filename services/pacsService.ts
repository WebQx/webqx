/**
 * PACS (Picture Archiving and Communication System) Service
 * Provides DICOM connectivity and medical imaging management for WebQX
 */

import { EventEmitter } from 'events';
import { AuditLogger } from '../ehr-integrations/services/auditLogger';

export interface DICOMImage {
  id: string;
  studyInstanceUID: string;
  seriesInstanceUID: string;
  sopInstanceUID: string;
  patientId: string;
  studyDate: string;
  modality: string;
  bodyPart: string;
  imageUrl: string;
  thumbnailUrl?: string;
  metadata: Record<string, any>;
}

export interface StudyInfo {
  studyInstanceUID: string;
  patientId: string;
  patientName: string;
  studyDate: string;
  studyDescription: string;
  modality: string;
  numberOfSeries: number;
  numberOfImages: number;
  series: SeriesInfo[];
}

export interface SeriesInfo {
  seriesInstanceUID: string;
  seriesNumber: number;
  seriesDescription: string;
  modality: string;
  numberOfImages: number;
  images: DICOMImage[];
}

export interface PACSConfig {
  orthancUrl: string;
  ohifViewerUrl: string;
  username?: string;
  password?: string;
  enableDICOMWeb: boolean;
  maxConcurrentDownloads: number;
  cacheEnabled: boolean;
  auditLogging: boolean;
}

export interface TranscriptionOverlay {
  imageId: string;
  transcription: string;
  language: string;
  confidence: number;
  timestamp: Date;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  speaker?: string;
  annotations?: string[];
}

export class PACSService extends EventEmitter {
  private config: PACSConfig;
  private auditLogger: AuditLogger;
  private cache: Map<string, any> = new Map();

  constructor(config: PACSConfig) {
    super();
    this.config = {
      maxConcurrentDownloads: 3,
      cacheEnabled: true,
      auditLogging: true,
      enableDICOMWeb: true,
      ...config
    };

    if (this.config.auditLogging) {
      this.auditLogger = new AuditLogger({
        enabled: true,
        logToConsole: true,
        maxInMemoryEntries: 1000
      });
    }

    this.logInfo('PACS Service initialized', { config: this.config });
  }

  /**
   * Get studies for a patient
   */
  async getStudies(patientId: string): Promise<StudyInfo[]> {
    try {
      this.auditLogger?.logAccess('PACS_STUDY_ACCESS', {
        patientId,
        action: 'GET_STUDIES',
        timestamp: new Date().toISOString()
      });

      const cacheKey = `studies_${patientId}`;
      if (this.config.cacheEnabled && this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      const url = `${this.config.orthancUrl}/patients/${patientId}/studies`;
      const response = await this.makeRequest(url);
      
      const studies: StudyInfo[] = await Promise.all(
        response.map(async (studyId: string) => {
          const studyData = await this.getStudyDetails(studyId);
          return studyData;
        })
      );

      if (this.config.cacheEnabled) {
        this.cache.set(cacheKey, studies);
      }

      this.emit('studiesRetrieved', { patientId, count: studies.length });
      return studies;

    } catch (error) {
      this.auditLogger?.logError('PACS_STUDY_ERROR', {
        patientId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw new Error(`Failed to retrieve studies for patient ${patientId}: ${error.message}`);
    }
  }

  /**
   * Get detailed study information
   */
  async getStudyDetails(studyInstanceUID: string): Promise<StudyInfo> {
    try {
      const url = `${this.config.orthancUrl}/studies/${studyInstanceUID}`;
      const studyData = await this.makeRequest(url);
      
      const seriesData = await Promise.all(
        studyData.Series.map(async (seriesId: string) => {
          return await this.getSeriesDetails(seriesId);
        })
      );

      return {
        studyInstanceUID: studyData.MainDicomTags.StudyInstanceUID,
        patientId: studyData.PatientMainDicomTags.PatientID,
        patientName: studyData.PatientMainDicomTags.PatientName,
        studyDate: studyData.MainDicomTags.StudyDate,
        studyDescription: studyData.MainDicomTags.StudyDescription || '',
        modality: studyData.MainDicomTags.Modality || 'Unknown',
        numberOfSeries: seriesData.length,
        numberOfImages: seriesData.reduce((total, series) => total + series.numberOfImages, 0),
        series: seriesData
      };

    } catch (error) {
      throw new Error(`Failed to get study details: ${error.message}`);
    }
  }

  /**
   * Get series information
   */
  async getSeriesDetails(seriesInstanceUID: string): Promise<SeriesInfo> {
    try {
      const url = `${this.config.orthancUrl}/series/${seriesInstanceUID}`;
      const seriesData = await this.makeRequest(url);
      
      const images: DICOMImage[] = await Promise.all(
        seriesData.Instances.map(async (instanceId: string) => {
          return await this.getImageDetails(instanceId);
        })
      );

      return {
        seriesInstanceUID: seriesData.MainDicomTags.SeriesInstanceUID,
        seriesNumber: parseInt(seriesData.MainDicomTags.SeriesNumber) || 0,
        seriesDescription: seriesData.MainDicomTags.SeriesDescription || '',
        modality: seriesData.MainDicomTags.Modality || 'Unknown',
        numberOfImages: images.length,
        images
      };

    } catch (error) {
      throw new Error(`Failed to get series details: ${error.message}`);
    }
  }

  /**
   * Get DICOM image details
   */
  async getImageDetails(sopInstanceUID: string): Promise<DICOMImage> {
    try {
      const url = `${this.config.orthancUrl}/instances/${sopInstanceUID}`;
      const imageData = await this.makeRequest(url);
      
      return {
        id: sopInstanceUID,
        studyInstanceUID: imageData.MainDicomTags.StudyInstanceUID,
        seriesInstanceUID: imageData.MainDicomTags.SeriesInstanceUID,
        sopInstanceUID: imageData.MainDicomTags.SOPInstanceUID,
        patientId: imageData.PatientMainDicomTags?.PatientID || '',
        studyDate: imageData.MainDicomTags.StudyDate || '',
        modality: imageData.MainDicomTags.Modality || 'Unknown',
        bodyPart: imageData.MainDicomTags.BodyPartExamined || '',
        imageUrl: `${this.config.orthancUrl}/instances/${sopInstanceUID}/preview`,
        thumbnailUrl: `${this.config.orthancUrl}/instances/${sopInstanceUID}/preview?size=150`,
        metadata: imageData
      };

    } catch (error) {
      throw new Error(`Failed to get image details: ${error.message}`);
    }
  }

  /**
   * Get OHIF viewer URL for a study
   */
  getViewerUrl(studyInstanceUID: string): string {
    const orthancStudiesUrl = encodeURIComponent(
      `${this.config.orthancUrl}/dicom-web/studies`
    );
    return `${this.config.ohifViewerUrl}?url=${orthancStudiesUrl}&StudyInstanceUIDs=${studyInstanceUID}`;
  }

  /**
   * Search for studies by criteria
   */
  async searchStudies(criteria: {
    patientId?: string;
    patientName?: string;
    studyDate?: string;
    modality?: string;
    studyDescription?: string;
  }): Promise<StudyInfo[]> {
    try {
      this.auditLogger?.logAccess('PACS_STUDY_SEARCH', {
        criteria,
        timestamp: new Date().toISOString()
      });

      const searchParams = new URLSearchParams();
      
      Object.entries(criteria).forEach(([key, value]) => {
        if (value) {
          searchParams.append(key, value);
        }
      });

      const url = `${this.config.orthancUrl}/tools/find`;
      const response = await this.makeRequest(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Level: 'Study',
          Query: Object.fromEntries(searchParams)
        })
      });

      const studies = await Promise.all(
        response.map(async (studyId: string) => {
          return await this.getStudyDetails(studyId);
        })
      );

      return studies;

    } catch (error) {
      this.auditLogger?.logError('PACS_SEARCH_ERROR', {
        criteria,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Upload DICOM file
   */
  async uploadDICOM(file: Buffer, filename: string): Promise<{ success: boolean; instanceId?: string }> {
    try {
      this.auditLogger?.log({
        action: 'system_backup',
        resourceType: 'dicom_file',
        resourceId: filename,
        success: true,
        context: {
          operation: 'pacs_dicom_upload',
          filename,
          size: file.length,
          timestamp: new Date().toISOString()
        }
      });

      const url = `${this.config.orthancUrl}/instances`;
      const response = await this.makeRequest(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/dicom' },
        body: file
      });

      this.emit('dicomUploaded', { filename, instanceId: response.ID });
      return { success: true, instanceId: response.ID };

    } catch (error) {
      this.auditLogger?.logError('PACS_UPLOAD_ERROR', {
        filename,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      return { success: false };
    }
  }

  /**
   * Check PACS connectivity
   */
  async checkConnectivity(): Promise<{ connected: boolean; version?: string; error?: string }> {
    try {
      const url = `${this.config.orthancUrl}/system`;
      const response = await this.makeRequest(url);
      
      return {
        connected: true,
        version: response.Version
      };

    } catch (error) {
      return {
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Make HTTP request to PACS server
   */
  private async makeRequest(url: string, options: RequestInit = {}): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>
    };

    if (this.config.username && this.config.password) {
      const auth = btoa(`${this.config.username}:${this.config.password}`);
      headers['Authorization'] = `Basic ${auth}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }

    return await response.arrayBuffer();
  }

  /**
   * Logging utility
   */
  private logInfo(message: string, data?: any): void {
    if (this.config.auditLogging) {
      console.log(`[PACS Service] ${message}`, data);
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.emit('cacheCleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

export default PACSService;