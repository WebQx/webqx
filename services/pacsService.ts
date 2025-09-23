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
  /**
   * DICOMweb base URL (QIDO-RS/WADO-RS/STOW-RS root)
   * Example (dcm4chee): https://example.com/dcm4chee-arc/aets/DCM4CHEE/rs
   */
  dicomwebBaseUrl: string;
  /**
   * Backwards-compat: if provided, will be translated to dicomwebBaseUrl when possible
   * Example (Orthanc): https://orthanc.local -> dicom-web
   */
  orthancUrl?: string;
  /** OHIF viewer base URL */
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
  private auditLogger?: AuditLogger;
  private cache: Map<string, any> = new Map();
  private baseUrl: string = '';

  constructor(config: PACSConfig) {
    super();
    // Normalize configuration and maintain backward compatibility
    this.config = {
      ...config,
      maxConcurrentDownloads: config.maxConcurrentDownloads ?? 3,
      cacheEnabled: config.cacheEnabled ?? true,
      auditLogging: config.auditLogging ?? true,
      enableDICOMWeb: config.enableDICOMWeb ?? true
    };

    // If only orthancUrl provided, construct a DICOMweb base from it
    if (!this.config.dicomwebBaseUrl && this.config.orthancUrl) {
      const trimmed = this.config.orthancUrl.replace(/\/$/, '');
      // Orthanc DICOMweb is typically exposed at /dicom-web
      this.config.dicomwebBaseUrl = `${trimmed}/dicom-web`;
    }

    this.baseUrl = (this.config.dicomwebBaseUrl || '').replace(/\/$/, '');

    if (this.config.auditLogging) {
      this.auditLogger = new AuditLogger({
        enabled: true,
        logToConsole: true,
        maxInMemoryEntries: 1000
      });
    }

    this.logInfo('PACS Service initialized', { config: { ...this.config, orthancUrl: undefined } });
  }

  // --- DICOMweb helpers ---
  private getTag(ds: any, tag: string): any {
    if (!ds) return undefined;
    const e = ds[tag];
    if (!e) return undefined;
    if (Array.isArray(e.Value)) return e.Value[0];
    return e.Value ?? e;
  }

  private toString(v: any): string { return (v === undefined || v === null) ? '' : String(v); }

  private studyFromQido(ds: any): StudyInfo {
    const StudyInstanceUID = this.toString(this.getTag(ds, '0020000D'));
    const PatientID = this.toString(this.getTag(ds, '00100020'));
    const PatientName = this.toString(this.getTag(ds, '00100010'));
    const StudyDate = this.toString(this.getTag(ds, '00080020'));
    const StudyDescription = this.toString(this.getTag(ds, '00081030'));
    // ModalitiesInStudy can be an array
    const Modalities = this.getTag(ds, '00080061');
    const modality = Array.isArray(Modalities?.Value) ? Modalities.Value.join(',') : this.toString(Modalities);
    const NumberOfStudyRelatedSeries = Number(this.getTag(ds, '00201206')) || 0;
    const NumberOfStudyRelatedInstances = Number(this.getTag(ds, '00201208')) || 0;
    return {
      studyInstanceUID: StudyInstanceUID,
      patientId: PatientID,
      patientName: PatientName,
      studyDate: StudyDate,
      studyDescription: StudyDescription,
      modality: modality || 'Unknown',
      numberOfSeries: NumberOfStudyRelatedSeries,
      numberOfImages: NumberOfStudyRelatedInstances,
      series: []
    };
  }

  private seriesFromQido(ds: any): SeriesInfo {
    const SeriesInstanceUID = this.toString(this.getTag(ds, '0020000E'));
    const SeriesNumber = Number(this.getTag(ds, '00200011')) || 0;
    const SeriesDescription = this.toString(this.getTag(ds, '0008103E'));
    const Modality = this.toString(this.getTag(ds, '00080060')) || 'Unknown';
    const NumberOfSeriesRelatedInstances = Number(this.getTag(ds, '00201209')) || 0;
    return {
      seriesInstanceUID: SeriesInstanceUID,
      seriesNumber: SeriesNumber,
      seriesDescription: SeriesDescription,
      modality: Modality,
      numberOfImages: NumberOfSeriesRelatedInstances,
      images: []
    };
  }

  private imageFromQido(ds: any): DICOMImage {
    const StudyInstanceUID = this.toString(this.getTag(ds, '0020000D'));
    const SeriesInstanceUID = this.toString(this.getTag(ds, '0020000E'));
    const SOPInstanceUID = this.toString(this.getTag(ds, '00080018'));
    const PatientID = this.toString(this.getTag(ds, '00100020'));
    const StudyDate = this.toString(this.getTag(ds, '00080020'));
    const Modality = this.toString(this.getTag(ds, '00080060')) || 'Unknown';
    const BodyPart = this.toString(this.getTag(ds, '00180015'));
    const base = this.baseUrl;
    return {
      id: SOPInstanceUID,
      studyInstanceUID: StudyInstanceUID,
      seriesInstanceUID: SeriesInstanceUID,
      sopInstanceUID: SOPInstanceUID,
      patientId: PatientID,
      studyDate: StudyDate,
      modality: Modality,
      bodyPart: BodyPart,
      imageUrl: `${base}/studies/${StudyInstanceUID}/series/${SeriesInstanceUID}/instances/${SOPInstanceUID}/rendered`,
      thumbnailUrl: `${base}/studies/${StudyInstanceUID}/series/${SeriesInstanceUID}/instances/${SOPInstanceUID}/thumbnail`,
      metadata: ds
    };
  }

  /**
   * Get studies for a patient
   */
  async getStudies(patientId: string): Promise<StudyInfo[]> {
    try {
      await this.auditLogger?.log({
        action: 'view_patient_data',
        resourceType: 'PACS_STUDY',
        resourceId: patientId,
        patientMrn: patientId,
        success: true,
        context: {
          action: 'GET_STUDIES',
          timestamp: new Date().toISOString()
        }
      });

      const cacheKey = `studies_${patientId}`;
      if (this.config.cacheEnabled && this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      // QIDO-RS search by PatientID
      const url = `${this.baseUrl}/studies?PatientID=${encodeURIComponent(patientId)}&includefield=all`;
      const response = await this.makeRequest(url, { headers: { 'Accept': 'application/dicom+json' } });
      const studies: StudyInfo[] = (Array.isArray(response) ? response : [])
        .map((ds: any) => this.studyFromQido(ds));

      if (this.config.cacheEnabled) {
        this.cache.set(cacheKey, studies);
      }

      this.emit('studiesRetrieved', { patientId, count: studies.length });
      return studies;

    } catch (error) {
      await this.auditLogger?.log({
        action: 'view_patient_data',
        resourceType: 'PACS_STUDY',
        resourceId: patientId,
        patientMrn: patientId,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        context: {
          action: 'GET_STUDIES_ERROR',
          timestamp: new Date().toISOString()
        }
      });
      throw new Error(`Failed to retrieve studies for patient ${patientId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get detailed study information
   */
  async getStudyDetails(studyInstanceUID: string): Promise<StudyInfo> {
    try {
      // QIDO-RS for study record
      const studyUrl = `${this.baseUrl}/studies?StudyInstanceUID=${encodeURIComponent(studyInstanceUID)}&includefield=all`;
      const studyResp = await this.makeRequest(studyUrl, { headers: { 'Accept': 'application/dicom+json' } });
      const study = (Array.isArray(studyResp) && studyResp[0]) ? this.studyFromQido(studyResp[0]) : {
        studyInstanceUID,
        patientId: '',
        patientName: '',
        studyDate: '',
        studyDescription: '',
        modality: 'Unknown',
        numberOfSeries: 0,
        numberOfImages: 0,
        series: []
      } as StudyInfo;

      // QIDO-RS list series for study
      const seriesUrl = `${this.baseUrl}/studies/${encodeURIComponent(studyInstanceUID)}/series?includefield=all`;
      const seriesResp = await this.makeRequest(seriesUrl, { headers: { 'Accept': 'application/dicom+json' } });
      const seriesList: SeriesInfo[] = (Array.isArray(seriesResp) ? seriesResp : []).map((ds: any) => this.seriesFromQido(ds));

      // For each series, get instances count and a few images
      const seriesWithImages: SeriesInfo[] = await Promise.all(seriesList.map(async (s) => {
        try {
          const instUrl = `${this.baseUrl}/studies/${encodeURIComponent(studyInstanceUID)}/series/${encodeURIComponent(s.seriesInstanceUID)}/instances?includefield=all`;
          const instResp = await this.makeRequest(instUrl, { headers: { 'Accept': 'application/dicom+json' } });
          const images: DICOMImage[] = (Array.isArray(instResp) ? instResp : []).map((ds: any) => this.imageFromQido(ds));
          return { ...s, numberOfImages: images.length || s.numberOfImages, images };
        } catch (_) {
          return s;
        }
      }));

      return {
        ...study,
        numberOfSeries: seriesWithImages.length,
        numberOfImages: seriesWithImages.reduce((acc, si) => acc + (si.numberOfImages || 0), 0),
        series: seriesWithImages
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get study details: ${errorMessage}`);
    }
  }

  /**
   * Get series information
   */
  async getSeriesDetails(seriesInstanceUID: string): Promise<SeriesInfo> {
    try {
      // QIDO-RS lookup by SeriesInstanceUID
      const url = `${this.baseUrl}/series?SeriesInstanceUID=${encodeURIComponent(seriesInstanceUID)}&includefield=all`;
      const resp = await this.makeRequest(url, { headers: { 'Accept': 'application/dicom+json' } });
      const series = (Array.isArray(resp) && resp[0]) ? this.seriesFromQido(resp[0]) : {
        seriesInstanceUID: seriesInstanceUID,
        seriesNumber: 0,
        seriesDescription: '',
        modality: 'Unknown',
        numberOfImages: 0,
        images: []
      } as SeriesInfo;

      // Get instances
      // We also need StudyInstanceUID to build URLs for images; fetch via instances list
      const instUrl = `${this.baseUrl}/series/${encodeURIComponent(seriesInstanceUID)}/instances?includefield=all`;
      const instResp = await this.makeRequest(instUrl, { headers: { 'Accept': 'application/dicom+json' } });
      const images: DICOMImage[] = (Array.isArray(instResp) ? instResp : []).map((ds: any) => this.imageFromQido(ds));
      return { ...series, numberOfImages: images.length, images };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get series details: ${errorMessage}`);
    }
  }

  /**
   * Get DICOM image details
   */
  async getImageDetails(sopInstanceUID: string): Promise<DICOMImage> {
    try {
      // QIDO-RS: Instances by SOPInstanceUID
      const url = `${this.baseUrl}/instances?SOPInstanceUID=${encodeURIComponent(sopInstanceUID)}&includefield=all`;
      const resp = await this.makeRequest(url, { headers: { 'Accept': 'application/dicom+json' } });
      if (Array.isArray(resp) && resp[0]) {
        return this.imageFromQido(resp[0]);
      }
      throw new Error('Instance not found');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get image details: ${errorMessage}`);
    }
  }

  /**
   * Get OHIF viewer URL for a study
   */
  getViewerUrl(studyInstanceUID: string): string {
    const qidoStudiesUrl = encodeURIComponent(`${this.baseUrl}/studies`);
    return `${this.config.ohifViewerUrl}?url=${qidoStudiesUrl}&StudyInstanceUIDs=${encodeURIComponent(studyInstanceUID)}`;
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
      await this.auditLogger?.log({
        action: 'view_patient_data',
        resourceType: 'PACS_STUDY_SEARCH',
        resourceId: 'search_operation',
        success: true,
        context: {
          criteria,
          timestamp: new Date().toISOString()
        }
      });

      // Map friendly keys to QIDO query parameters
      const params = new URLSearchParams();
      if (criteria.patientId) params.set('PatientID', criteria.patientId);
      if (criteria.patientName) params.set('PatientName', criteria.patientName);
      if (criteria.studyDate) params.set('StudyDate', criteria.studyDate);
      if (criteria.modality) params.set('Modality', criteria.modality);
      if (criteria.studyDescription) params.set('StudyDescription', criteria.studyDescription);
      params.set('includefield', 'all');

      const url = `${this.baseUrl}/studies?${params.toString()}`;
      const response = await this.makeRequest(url, { headers: { 'Accept': 'application/dicom+json' } });

      const studies: StudyInfo[] = (Array.isArray(response) ? response : []).map((ds: any) => this.studyFromQido(ds));

      return studies;

    } catch (error) {
      await this.auditLogger?.log({
        action: 'view_patient_data',
        resourceType: 'PACS_STUDY_SEARCH',
        resourceId: 'search_operation',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        context: {
          criteria,
          timestamp: new Date().toISOString()
        }
      });
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

      // STOW-RS single instance upload (some servers require multipart/related)
      const url = `${this.baseUrl}/studies`;
      const response = await this.makeRequest(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/dicom', 'Accept': 'application/dicom+json' },
        // Cast Buffer to BodyInit for Node.js fetch
        body: (file as unknown as any)
      });

      await this.auditLogger?.log({
        action: 'edit_patient_data',
        resourceType: 'DICOM_UPLOAD',
        resourceId: filename,
        success: true,
        context: {
          filename,
          instanceId: (response && response[0] && (response[0]['00080018']?.Value?.[0])) || undefined,
          timestamp: new Date().toISOString()
        }
      });

      const instanceId = (response && response[0] && (response[0]['00080018']?.Value?.[0])) || undefined;
      this.emit('dicomUploaded', { filename, instanceId });
      return { success: true, instanceId };

    } catch (error) {
      await this.auditLogger?.log({
        action: 'edit_patient_data',
        resourceType: 'DICOM_UPLOAD',
        resourceId: filename,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        context: {
          filename,
          timestamp: new Date().toISOString()
        }
      });
      return { success: false };
    }
  }

  /**
   * Check PACS connectivity
   */
  async checkConnectivity(): Promise<{ connected: boolean; version?: string; error?: string }> {
    try {
      // Lightweight QIDO probe
      const url = `${this.baseUrl}/studies?limit=1`;
      await this.makeRequest(url, { headers: { 'Accept': 'application/dicom+json' } });
      return { connected: true };

    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Make HTTP request to PACS server
   */
  private async makeRequest(url: string, options: RequestInit = {}): Promise<any> {
    const headers: Record<string, string> = {
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
    if (contentType && (contentType.includes('application/json') || contentType.includes('application/dicom+json'))) {
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