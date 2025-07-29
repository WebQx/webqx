/**
 * Orthanc PACS Service
 * 
 * Service for integrating with Orthanc DICOM server for storage and management.
 * Provides DICOM web services and basic PACS operations.
 */

import { 
  OrthancConfiguration, 
  DICOMStudy, 
  PACSSearchRequest, 
  PACSServiceError,
  MedicalSpecialty 
} from '../types';

export interface OrthancUploadResult {
  success: boolean;
  studyInstanceUID?: string;
  uploadedCount: number;
  failedCount: number;
  errors?: string[];
}

export interface OrthancStatistics {
  studies: number;
  series: number;
  instances: number;
  storageGB: number;
  version: string;
}

export class OrthancService {
  private config: OrthancConfiguration;
  private baseUrl: string;

  constructor(config: OrthancConfiguration) {
    this.config = config;
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Test connection to Orthanc server
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.makeRequest('GET', '/system');
      return response.Name === 'Orthanc';
    } catch (error) {
      return false;
    }
  }

  /**
   * Search for studies in Orthanc
   */
  async searchStudies(request: PACSSearchRequest): Promise<DICOMStudy[]> {
    try {
      const studies: DICOMStudy[] = [];
      
      // Get all studies from Orthanc
      const studyIds = await this.makeRequest('GET', '/studies');
      
      for (const studyId of studyIds) {
        const studyInfo = await this.makeRequest('GET', `/studies/${studyId}`);
        const studyTags = studyInfo.MainDicomTags || {};
        const patientTags = studyInfo.PatientMainDicomTags || {};
        
        // Apply filters
        if (request.patientID && patientTags.PatientID !== request.patientID) continue;
        if (request.patientName && !patientTags.PatientName?.includes(request.patientName)) continue;
        if (request.accessionNumber && studyTags.AccessionNumber !== request.accessionNumber) continue;
        if (request.modality && request.modality.length > 0) {
          const studyModalities = await this.getStudyModalities(studyId);
          if (!request.modality.some(mod => studyModalities.includes(mod))) continue;
        }
        
        // Apply date filter
        if (request.studyDate) {
          const studyDate = studyTags.StudyDate;
          if (studyDate) {
            if (request.studyDate.from && studyDate < request.studyDate.from.replace(/-/g, '')) continue;
            if (request.studyDate.to && studyDate > request.studyDate.to.replace(/-/g, '')) continue;
          }
        }

        const study: DICOMStudy = {
          studyInstanceUID: studyTags.StudyInstanceUID || '',
          patientID: patientTags.PatientID || '',
          patientName: patientTags.PatientName || '',
          studyDate: this.formatDate(studyTags.StudyDate) || '',
          studyTime: studyTags.StudyTime,
          studyDescription: studyTags.StudyDescription,
          modality: await this.getPrimaryModality(studyId),
          accessionNumber: studyTags.AccessionNumber,
          referringPhysician: studyTags.ReferringPhysicianName,
          specialty: this.inferSpecialtyFromModality(await this.getPrimaryModality(studyId)),
          seriesCount: studyInfo.Series?.length || 0,
          instanceCount: await this.getStudyInstanceCount(studyId),
          status: 'completed',
          createdAt: new Date(studyInfo.LastUpdate || Date.now()),
          updatedAt: new Date(studyInfo.LastUpdate || Date.now())
        };

        studies.push(study);
      }

      return studies;

    } catch (error) {
      throw new PACSServiceError('ORTHANC_SEARCH_FAILED', `Orthanc search failed: ${error.message}`);
    }
  }

  /**
   * Upload DICOM files to Orthanc
   */
  async uploadFiles(files: File[]): Promise<OrthancUploadResult> {
    try {
      let uploadedCount = 0;
      let failedCount = 0;
      const errors: string[] = [];
      let studyInstanceUID: string | undefined;

      for (const file of files) {
        try {
          const formData = new FormData();
          formData.append('file', file);

          const response = await fetch(`${this.baseUrl}/instances`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: formData
          });

          if (response.ok) {
            uploadedCount++;
            if (!studyInstanceUID) {
              const result = await response.json();
              // Extract study UID from the response
              const instanceInfo = await this.makeRequest('GET', `/instances/${result.ID}`);
              studyInstanceUID = instanceInfo.MainDicomTags?.StudyInstanceUID;
            }
          } else {
            failedCount++;
            errors.push(`Failed to upload ${file.name}: ${response.statusText}`);
          }
        } catch (error) {
          failedCount++;
          errors.push(`Failed to upload ${file.name}: ${error.message}`);
        }
      }

      return {
        success: uploadedCount > 0,
        studyInstanceUID,
        uploadedCount,
        failedCount,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      throw new PACSServiceError('ORTHANC_UPLOAD_FAILED', `Orthanc upload failed: ${error.message}`);
    }
  }

  /**
   * Get Orthanc system statistics
   */
  async getStatistics(): Promise<OrthancStatistics> {
    try {
      const systemInfo = await this.makeRequest('GET', '/system');
      const statistics = await this.makeRequest('GET', '/statistics');

      return {
        studies: statistics.CountStudies || 0,
        series: statistics.CountSeries || 0,
        instances: statistics.CountInstances || 0,
        storageGB: (statistics.TotalDiskSize || 0) / (1024 * 1024 * 1024),
        version: systemInfo.Version || 'unknown'
      };

    } catch (error) {
      throw new PACSServiceError('ORTHANC_STATS_FAILED', `Failed to get Orthanc statistics: ${error.message}`);
    }
  }

  /**
   * Get WADO-RS URL for accessing DICOM data
   */
  getWadoRsUrl(): string {
    return `${this.baseUrl}/wado`;
  }

  /**
   * Get QIDO-RS URL for querying DICOM data
   */
  getQidoRsUrl(): string {
    return `${this.baseUrl}/qido-rs`;
  }

  /**
   * Get study information by Study Instance UID
   */
  async getStudyInfo(studyInstanceUID: string): Promise<any> {
    try {
      // Find study by UID
      const studies = await this.makeRequest('GET', '/studies');
      
      for (const studyId of studies) {
        const studyInfo = await this.makeRequest('GET', `/studies/${studyId}`);
        if (studyInfo.MainDicomTags?.StudyInstanceUID === studyInstanceUID) {
          return studyInfo;
        }
      }
      
      throw new Error('Study not found');

    } catch (error) {
      throw new PACSServiceError('ORTHANC_STUDY_NOT_FOUND', `Study not found: ${error.message}`);
    }
  }

  // Private helper methods

  private async makeRequest(method: string, path: string, body?: any): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text();
      }

    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    } else if (this.config.username && this.config.password) {
      const credentials = btoa(`${this.config.username}:${this.config.password}`);
      headers['Authorization'] = `Basic ${credentials}`;
    }

    return headers;
  }

  private async getStudyModalities(studyId: string): Promise<string[]> {
    try {
      const studyInfo = await this.makeRequest('GET', `/studies/${studyId}`);
      const modalities = new Set<string>();

      for (const seriesId of studyInfo.Series || []) {
        const seriesInfo = await this.makeRequest('GET', `/series/${seriesId}`);
        const modality = seriesInfo.MainDicomTags?.Modality;
        if (modality) {
          modalities.add(modality);
        }
      }

      return Array.from(modalities);
    } catch {
      return [];
    }
  }

  private async getPrimaryModality(studyId: string): Promise<string> {
    const modalities = await this.getStudyModalities(studyId);
    return modalities[0] || 'OT'; // OT = Other
  }

  private async getStudyInstanceCount(studyId: string): Promise<number> {
    try {
      const studyInfo = await this.makeRequest('GET', `/studies/${studyId}`);
      let instanceCount = 0;

      for (const seriesId of studyInfo.Series || []) {
        const seriesInfo = await this.makeRequest('GET', `/series/${seriesId}`);
        instanceCount += seriesInfo.Instances?.length || 0;
      }

      return instanceCount;
    } catch {
      return 0;
    }
  }

  private formatDate(dicomDate?: string): string {
    if (!dicomDate || dicomDate.length !== 8) return '';
    
    const year = dicomDate.substring(0, 4);
    const month = dicomDate.substring(4, 6);
    const day = dicomDate.substring(6, 8);
    
    return `${year}-${month}-${day}`;
  }

  private inferSpecialtyFromModality(modality: string): MedicalSpecialty {
    const modalityToSpecialty: Record<string, MedicalSpecialty> = {
      'CT': 'radiology',
      'MR': 'radiology',
      'XA': 'cardiology',
      'ES': 'cardiology',
      'ECG': 'cardiology',
      'US': 'radiology',
      'CR': 'radiology',
      'DR': 'radiology',
      'DX': 'radiology',
      'MG': 'radiology',
      'PT': 'oncology',
      'NM': 'radiology',
      'RF': 'radiology',
      'OT': 'primary-care'
    };

    return modalityToSpecialty[modality] || 'primary-care';
  }
}