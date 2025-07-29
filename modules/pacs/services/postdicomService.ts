/**
 * PostDICOM Cloud PACS Service
 * 
 * Service for integrating with PostDICOM for cloud-based PACS functionalities.
 */

import { 
  PostDICOMConfiguration, 
  DICOMStudy, 
  PACSServiceError 
} from '../types';

export class PostDICOMService {
  private config: PostDICOMConfiguration;
  private baseUrl: string;

  constructor(config: PostDICOMConfiguration) {
    this.config = config;
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Test connection to PostDICOM service
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.makeRequest('GET', '/api/v1/health');
      return response.status === 'healthy';
    } catch (error) {
      return false;
    }
  }

  /**
   * Sync study to PostDICOM cloud storage
   */
  async syncStudy(studyInstanceUID: string): Promise<void> {
    if (!this.config.enableCloudStorage) {
      return; // Cloud storage disabled
    }

    try {
      await this.makeRequest('POST', `/api/v1/studies/${studyInstanceUID}/sync`, {
        organizationId: this.config.organizationId,
        syncMetadata: true,
        syncImages: true
      });
    } catch (error) {
      throw new PACSServiceError('POSTDICOM_SYNC_FAILED', `Failed to sync study to PostDICOM: ${error.message}`);
    }
  }

  /**
   * Upload study directly to PostDICOM
   */
  async uploadStudy(files: File[], metadata: any): Promise<{ success: boolean; studyInstanceUID?: string }> {
    try {
      if (!this.config.enableCloudStorage) {
        throw new Error('Cloud storage is disabled');
      }

      const formData = new FormData();
      
      // Add files
      files.forEach((file, index) => {
        formData.append(`file_${index}`, file);
      });

      // Add metadata
      formData.append('metadata', JSON.stringify({
        organizationId: this.config.organizationId,
        ...metadata
      }));

      const response = await fetch(`${this.baseUrl}/api/v1/studies/upload`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        studyInstanceUID: result.studyInstanceUID
      };

    } catch (error) {
      throw new PACSServiceError('POSTDICOM_UPLOAD_FAILED', `Failed to upload to PostDICOM: ${error.message}`);
    }
  }

  /**
   * Get cloud storage statistics
   */
  async getCloudStats(): Promise<any> {
    try {
      return await this.makeRequest('GET', '/api/v1/organizations/' + this.config.organizationId + '/stats');
    } catch (error) {
      throw new PACSServiceError('POSTDICOM_STATS_FAILED', `Failed to get PostDICOM stats: ${error.message}`);
    }
  }

  /**
   * Get shareable link for study
   */
  async getShareableLink(studyInstanceUID: string, expiresInHours = 24): Promise<string> {
    try {
      const response = await this.makeRequest('POST', `/api/v1/studies/${studyInstanceUID}/share`, {
        expiresIn: expiresInHours * 3600,
        permissions: ['view']
      });

      return response.shareUrl;
    } catch (error) {
      throw new PACSServiceError('POSTDICOM_SHARE_FAILED', `Failed to create shareable link: ${error.message}`);
    }
  }

  /**
   * Search studies in PostDICOM cloud
   */
  async searchCloudStudies(query: any): Promise<DICOMStudy[]> {
    try {
      const response = await this.makeRequest('POST', '/api/v1/studies/search', {
        organizationId: this.config.organizationId,
        ...query
      });

      return this.convertPostDICOMResultsToStudies(response.studies || []);
    } catch (error) {
      throw new PACSServiceError('POSTDICOM_SEARCH_FAILED', `Failed to search PostDICOM: ${error.message}`);
    }
  }

  /**
   * Get download URL for study
   */
  async getDownloadUrl(studyInstanceUID: string): Promise<string> {
    try {
      const response = await this.makeRequest('GET', `/api/v1/studies/${studyInstanceUID}/download-url`);
      return response.downloadUrl;
    } catch (error) {
      throw new PACSServiceError('POSTDICOM_DOWNLOAD_FAILED', `Failed to get download URL: ${error.message}`);
    }
  }

  /**
   * Delete study from cloud storage
   */
  async deleteStudy(studyInstanceUID: string): Promise<void> {
    try {
      await this.makeRequest('DELETE', `/api/v1/studies/${studyInstanceUID}`);
    } catch (error) {
      throw new PACSServiceError('POSTDICOM_DELETE_FAILED', `Failed to delete study: ${error.message}`);
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

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

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
    return {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'X-Organization-ID': this.config.organizationId
    };
  }

  private convertPostDICOMResultsToStudies(results: any[]): DICOMStudy[] {
    return results.map(result => ({
      studyInstanceUID: result.studyInstanceUID || '',
      patientID: result.patientID || '',
      patientName: result.patientName || '',
      studyDate: result.studyDate || '',
      studyTime: result.studyTime,
      studyDescription: result.studyDescription,
      modality: result.modality || 'OT',
      accessionNumber: result.accessionNumber,
      referringPhysician: result.referringPhysician,
      specialty: this.inferSpecialtyFromModality(result.modality || 'OT'),
      seriesCount: result.seriesCount || 0,
      instanceCount: result.instanceCount || 0,
      status: result.status || 'completed',
      createdAt: new Date(result.createdAt || Date.now()),
      updatedAt: new Date(result.updatedAt || Date.now())
    }));
  }

  private inferSpecialtyFromModality(modality: string): any {
    const modalityToSpecialty: Record<string, any> = {
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