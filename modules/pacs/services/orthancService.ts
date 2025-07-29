/**
 * Orthanc Service - DICOM Management Integration
 * WebQX™ Healthcare Platform
 * 
 * Integrates with Orthanc server for DICOM file management,
 * REST API operations, and metadata handling.
 */

import { PACS_CONFIG } from '../index';
import {
  DICOMStudy,
  DICOMSeries,
  DICOMImage,
  DICOMSearchCriteria,
  DICOMSearchResult,
  PacsServiceResponse
} from '../types/pacsTypes';

export class OrthancService {
  private baseUrl: string;
  private auth: string;
  private maxConcurrentStudies: number;

  constructor() {
    this.baseUrl = PACS_CONFIG.orthanc.baseUrl;
    this.auth = Buffer.from(
      `${PACS_CONFIG.orthanc.username}:${PACS_CONFIG.orthanc.password}`
    ).toString('base64');
    this.maxConcurrentStudies = PACS_CONFIG.orthanc.maxConcurrentStudies;
  }

  /**
   * Get all studies from Orthanc
   */
  async getStudies(): Promise<PacsServiceResponse<DICOMStudy[]>> {
    try {
      const response = await this.makeRequest('/studies');
      const studyIds = await response.json() as string[];
      
      // Get detailed information for each study
      const studies = await Promise.all(
        studyIds.slice(0, this.maxConcurrentStudies).map(id => this.getStudyDetails(id))
      );

      return {
        success: true,
        data: studies.filter(study => study !== null) as DICOMStudy[],
        metadata: {
          timestamp: new Date().toISOString(),
          requestID: this.generateRequestId(),
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('Failed to retrieve studies', error);
    }
  }

  /**
   * Search studies by criteria
   */
  async searchStudies(criteria: DICOMSearchCriteria): Promise<PacsServiceResponse<DICOMSearchResult>> {
    try {
      const searchParams = this.buildSearchParams(criteria);
      const response = await this.makeRequest('/tools/find', {
        method: 'POST',
        body: JSON.stringify(searchParams)
      });

      const studyIds = await response.json() as string[];
      const studies = await Promise.all(
        studyIds.map(id => this.getStudyDetails(id))
      );

      const result: DICOMSearchResult = {
        studies: studies.filter(study => study !== null) as DICOMStudy[],
        totalCount: studyIds.length,
        searchTime: Date.now(),
        nextOffset: criteria.offset && criteria.limit ? 
          criteria.offset + criteria.limit : undefined
      };

      return {
        success: true,
        data: result,
        metadata: {
          timestamp: new Date().toISOString(),
          requestID: this.generateRequestId(),
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('Failed to search studies', error);
    }
  }

  /**
   * Get detailed study information
   */
  private async getStudyDetails(studyId: string): Promise<DICOMStudy | null> {
    try {
      const response = await this.makeRequest(`/studies/${studyId}`);
      const studyData = await response.json();

      return {
        studyInstanceUID: studyData.MainDicomTags?.StudyInstanceUID || studyId,
        patientID: studyData.PatientMainDicomTags?.PatientID || 'Unknown',
        patientName: studyData.PatientMainDicomTags?.PatientName || 'Unknown',
        studyDate: studyData.MainDicomTags?.StudyDate || '',
        studyTime: studyData.MainDicomTags?.StudyTime || '',
        modality: studyData.MainDicomTags?.ModalitiesInStudy || '',
        studyDescription: studyData.MainDicomTags?.StudyDescription || '',
        accessionNumber: studyData.MainDicomTags?.AccessionNumber || '',
        referringPhysician: studyData.MainDicomTags?.ReferringPhysicianName || '',
        seriesCount: studyData.Series?.length || 0,
        imageCount: studyData.Instances?.length || 0,
        studySize: this.calculateStudySize(studyData)
      };
    } catch (error) {
      console.error(`Failed to get study details for ${studyId}:`, error);
      return null;
    }
  }

  /**
   * Get series for a study
   */
  async getStudySeries(studyInstanceUID: string): Promise<PacsServiceResponse<DICOMSeries[]>> {
    try {
      const response = await this.makeRequest(`/studies/${studyInstanceUID}/series`);
      const seriesIds = await response.json() as string[];
      
      const series = await Promise.all(
        seriesIds.map(id => this.getSeriesDetails(id))
      );

      return {
        success: true,
        data: series.filter(s => s !== null) as DICOMSeries[],
        metadata: {
          timestamp: new Date().toISOString(),
          requestID: this.generateRequestId(),
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('Failed to retrieve series', error);
    }
  }

  /**
   * Get series details
   */
  private async getSeriesDetails(seriesId: string): Promise<DICOMSeries | null> {
    try {
      const response = await this.makeRequest(`/series/${seriesId}`);
      const seriesData = await response.json();

      return {
        seriesInstanceUID: seriesData.MainDicomTags?.SeriesInstanceUID || seriesId,
        studyInstanceUID: seriesData.ParentStudy || '',
        seriesNumber: parseInt(seriesData.MainDicomTags?.SeriesNumber) || 0,
        modality: seriesData.MainDicomTags?.Modality || '',
        seriesDescription: seriesData.MainDicomTags?.SeriesDescription || '',
        bodyPart: seriesData.MainDicomTags?.BodyPartExamined || '',
        imageCount: seriesData.Instances?.length || 0,
        seriesDate: seriesData.MainDicomTags?.SeriesDate || '',
        seriesTime: seriesData.MainDicomTags?.SeriesTime || ''
      };
    } catch (error) {
      console.error(`Failed to get series details for ${seriesId}:`, error);
      return null;
    }
  }

  /**
   * Upload DICOM file
   */
  async uploadDicom(file: ArrayBuffer): Promise<PacsServiceResponse<{ instanceId: string }>> {
    try {
      const response = await this.makeRequest('/instances', {
        method: 'POST',
        body: file,
        headers: {
          'Content-Type': 'application/dicom'
        }
      });

      const result = await response.json();
      
      return {
        success: true,
        data: { instanceId: result.ID },
        metadata: {
          timestamp: new Date().toISOString(),
          requestID: this.generateRequestId(),
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('Failed to upload DICOM file', error);
    }
  }

  /**
   * Delete study
   */
  async deleteStudy(studyInstanceUID: string): Promise<PacsServiceResponse<void>> {
    try {
      await this.makeRequest(`/studies/${studyInstanceUID}`, {
        method: 'DELETE'
      });

      return {
        success: true,
        metadata: {
          timestamp: new Date().toISOString(),
          requestID: this.generateRequestId(),
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('Failed to delete study', error);
    }
  }

  /**
   * Get DICOM instance as image
   */
  async getInstanceImage(instanceId: string, frame: number = 0): Promise<PacsServiceResponse<Blob>> {
    try {
      const response = await this.makeRequest(`/instances/${instanceId}/frames/${frame}/image-uint8`);
      const imageBlob = await response.blob();

      return {
        success: true,
        data: imageBlob,
        metadata: {
          timestamp: new Date().toISOString(),
          requestID: this.generateRequestId(),
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('Failed to get instance image', error);
    }
  }

  /**
   * Private helper methods
   */
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Basic ${this.auth}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  }

  private buildSearchParams(criteria: DICOMSearchCriteria): any {
    const params: any = {
      Level: 'Study',
      Expand: true,
      Query: {}
    };

    if (criteria.patientID) {
      params.Query.PatientID = criteria.patientID;
    }
    if (criteria.patientName) {
      params.Query.PatientName = `*${criteria.patientName}*`;
    }
    if (criteria.studyDate) {
      params.Query.StudyDate = `${criteria.studyDate.from}-${criteria.studyDate.to}`;
    }
    if (criteria.modality?.length) {
      params.Query.ModalitiesInStudy = criteria.modality.join('\\');
    }
    if (criteria.studyDescription) {
      params.Query.StudyDescription = `*${criteria.studyDescription}*`;
    }
    if (criteria.accessionNumber) {
      params.Query.AccessionNumber = criteria.accessionNumber;
    }

    if (criteria.limit) {
      params.Limit = criteria.limit;
    }
    if (criteria.offset) {
      params.Since = criteria.offset;
    }

    return params;
  }

  private calculateStudySize(studyData: any): number {
    // Estimate study size based on instance count and typical image sizes
    const instanceCount = studyData.Instances?.length || 0;
    const avgInstanceSize = 512 * 1024; // 512 KB average
    return instanceCount * avgInstanceSize;
  }

  private generateRequestId(): string {
    return `orthanc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleError(message: string, error: any): PacsServiceResponse<never> {
    console.error(message, error);
    return {
      success: false,
      error: {
        code: 'ORTHANC_ERROR',
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