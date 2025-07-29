/**
 * Dicoogle PACS Service
 * 
 * Service for integrating with Dicoogle for advanced DICOM search and indexing.
 */

import { 
  DicoogleConfiguration, 
  DICOMStudy, 
  PACSSearchRequest, 
  PACSServiceError 
} from '../types';

export class DicoogleService {
  private config: DicoogleConfiguration;
  private baseUrl: string;

  constructor(config: DicoogleConfiguration) {
    this.config = config;
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Test connection to Dicoogle server
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.makeRequest('GET', '/');
      return response.includes('Dicoogle') || response.status === 'ok';
    } catch (error) {
      return false;
    }
  }

  /**
   * Search for studies using Dicoogle's advanced search capabilities
   */
  async searchStudies(request: PACSSearchRequest): Promise<DICOMStudy[]> {
    try {
      const query = this.buildDicoogleQuery(request);
      const searchResponse = await this.makeRequest('GET', `/search?query=${encodeURIComponent(query)}&maxResults=${request.limit || 100}`);
      
      return this.convertDicoogleResultsToStudies(searchResponse.results || []);

    } catch (error) {
      throw new PACSServiceError('DICOOGLE_SEARCH_FAILED', `Dicoogle search failed: ${error.message}`);
    }
  }

  /**
   * Index a study in Dicoogle for searchability
   */
  async indexStudy(studyInstanceUID: string): Promise<void> {
    try {
      await this.makeRequest('POST', '/index', {
        studyInstanceUID,
        action: 'index'
      });
    } catch (error) {
      throw new PACSServiceError('DICOOGLE_INDEX_FAILED', `Failed to index study: ${error.message}`);
    }
  }

  /**
   * Perform advanced metadata search
   */
  async searchMetadata(query: string): Promise<any[]> {
    try {
      const response = await this.makeRequest('GET', `/search?query=${encodeURIComponent(query)}`);
      return response.results || [];
    } catch (error) {
      throw new PACSServiceError('DICOOGLE_METADATA_SEARCH_FAILED', `Metadata search failed: ${error.message}`);
    }
  }

  // Private helper methods

  private buildDicoogleQuery(request: PACSSearchRequest): string {
    const conditions: string[] = [];

    if (request.patientID) {
      conditions.push(`PatientID:${request.patientID}`);
    }

    if (request.patientName) {
      conditions.push(`PatientName:*${request.patientName}*`);
    }

    if (request.accessionNumber) {
      conditions.push(`AccessionNumber:${request.accessionNumber}`);
    }

    if (request.studyDescription) {
      conditions.push(`StudyDescription:*${request.studyDescription}*`);
    }

    if (request.modality && request.modality.length > 0) {
      const modalityQuery = request.modality.map(m => `Modality:${m}`).join(' OR ');
      conditions.push(`(${modalityQuery})`);
    }

    if (request.studyDate) {
      if (request.studyDate.from && request.studyDate.to) {
        conditions.push(`StudyDate:[${request.studyDate.from.replace(/-/g, '')} TO ${request.studyDate.to.replace(/-/g, '')}]`);
      } else if (request.studyDate.from) {
        conditions.push(`StudyDate:[${request.studyDate.from.replace(/-/g, '')} TO *]`);
      } else if (request.studyDate.to) {
        conditions.push(`StudyDate:[* TO ${request.studyDate.to.replace(/-/g, '')}]`);
      }
    }

    return conditions.length > 0 ? conditions.join(' AND ') : '*:*';
  }

  private convertDicoogleResultsToStudies(results: any[]): DICOMStudy[] {
    return results.map(result => {
      const tags = result.fields || result;
      
      return {
        studyInstanceUID: tags.StudyInstanceUID || '',
        patientID: tags.PatientID || '',
        patientName: tags.PatientName || '',
        studyDate: this.formatDate(tags.StudyDate) || '',
        studyTime: tags.StudyTime,
        studyDescription: tags.StudyDescription,
        modality: tags.Modality || 'OT',
        accessionNumber: tags.AccessionNumber,
        referringPhysician: tags.ReferringPhysicianName,
        specialty: this.inferSpecialtyFromModality(tags.Modality || 'OT'),
        seriesCount: parseInt(tags.NumberOfStudyRelatedSeries) || 0,
        instanceCount: parseInt(tags.NumberOfStudyRelatedInstances) || 0,
        status: 'completed',
        createdAt: new Date(tags.StudyDate ? this.parseDate(tags.StudyDate) : Date.now()),
        updatedAt: new Date(tags.StudyDate ? this.parseDate(tags.StudyDate) : Date.now())
      };
    });
  }

  private async makeRequest(method: string, path: string, body?: any): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.queryTimeoutMs);

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

  private formatDate(dicomDate?: string): string {
    if (!dicomDate || dicomDate.length !== 8) return '';
    
    const year = dicomDate.substring(0, 4);
    const month = dicomDate.substring(4, 6);
    const day = dicomDate.substring(6, 8);
    
    return `${year}-${month}-${day}`;
  }

  private parseDate(dicomDate: string): number {
    if (!dicomDate || dicomDate.length !== 8) return Date.now();
    
    const year = parseInt(dicomDate.substring(0, 4));
    const month = parseInt(dicomDate.substring(4, 6)) - 1; // Month is 0-indexed
    const day = parseInt(dicomDate.substring(6, 8));
    
    return new Date(year, month, day).getTime();
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