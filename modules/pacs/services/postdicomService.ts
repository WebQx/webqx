/**
 * PostDICOM Service - HIPAA-Compliant Cloud Storage
 * WebQX™ Healthcare Platform
 * 
 * Integrates with PostDICOM for cloud storage with HIPAA compliance,
 * providing upload, view, and delete operations.
 */

import { PACS_CONFIG } from '../index';
import {
  DICOMStudy,
  PacsServiceResponse
} from '../types/pacsTypes';

export interface PostDICOMUploadResponse {
  studyId: string;
  uploadUrl: string;
  fileIds: string[];
  uploadStatus: 'pending' | 'uploading' | 'completed' | 'failed';
  uploadProgress: number;
  estimatedTimeRemaining?: number;
}

export interface PostDICOMStorageInfo {
  totalStorage: number; // bytes
  usedStorage: number; // bytes
  availableStorage: number; // bytes
  storageQuota: number; // bytes
  filesCount: number;
  studiesCount: number;
}

export interface PostDICOMShareLink {
  shareId: string;
  studyId: string;
  shareUrl: string;
  expiresAt: string;
  accessType: 'view' | 'download';
  passwordProtected: boolean;
  accessCount: number;
  maxAccess?: number;
}

export class PostDICOMService {
  private apiUrl: string;
  private apiKey: string;
  private enableEncryption: boolean;

  constructor() {
    this.apiUrl = PACS_CONFIG.postdicom.apiUrl;
    this.apiKey = PACS_CONFIG.postdicom.apiKey;
    this.enableEncryption = PACS_CONFIG.postdicom.enableEncryption;
  }

  /**
   * Upload DICOM files to cloud storage
   */
  async uploadStudy(
    files: File[],
    metadata?: {
      studyDescription?: string;
      patientInfo?: {
        patientId: string;
        patientName: string;
      };
    }
  ): Promise<PacsServiceResponse<PostDICOMUploadResponse>> {
    try {
      if (!this.apiKey) {
        throw new Error('PostDICOM API key not configured');
      }

      // Initialize upload session
      const uploadSession = await this.initializeUpload(files, metadata);
      
      // Upload files
      const uploadResult = await this.performUpload(uploadSession.uploadUrl, files);

      return {
        success: true,
        data: {
          studyId: uploadSession.studyId,
          uploadUrl: uploadSession.uploadUrl,
          fileIds: uploadResult.fileIds,
          uploadStatus: 'completed',
          uploadProgress: 100
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestID: this.generateRequestId(),
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('Failed to upload study', error);
    }
  }

  /**
   * Get study information from cloud storage
   */
  async getStudy(studyId: string): Promise<PacsServiceResponse<DICOMStudy>> {
    try {
      const response = await this.makeRequest(`/studies/${studyId}`);
      const studyData = await response.json();

      const study: DICOMStudy = {
        studyInstanceUID: studyData.studyInstanceUID,
        patientID: studyData.patientID || 'Unknown',
        patientName: studyData.patientName || 'Unknown',
        studyDate: studyData.studyDate || '',
        studyTime: studyData.studyTime || '',
        modality: studyData.modality || '',
        studyDescription: studyData.studyDescription || '',
        accessionNumber: studyData.accessionNumber || '',
        referringPhysician: studyData.referringPhysician || '',
        seriesCount: studyData.seriesCount || 0,
        imageCount: studyData.imageCount || 0,
        studySize: studyData.studySize || 0
      };

      return {
        success: true,
        data: study,
        metadata: {
          timestamp: new Date().toISOString(),
          requestID: this.generateRequestId(),
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('Failed to get study', error);
    }
  }

  /**
   * List all studies in cloud storage
   */
  async listStudies(
    filters?: {
      patientId?: string;
      dateRange?: { from: string; to: string };
      modality?: string;
    }
  ): Promise<PacsServiceResponse<DICOMStudy[]>> {
    try {
      const queryParams = new URLSearchParams();
      
      if (filters?.patientId) {
        queryParams.append('patientId', filters.patientId);
      }
      if (filters?.dateRange) {
        queryParams.append('dateFrom', filters.dateRange.from);
        queryParams.append('dateTo', filters.dateRange.to);
      }
      if (filters?.modality) {
        queryParams.append('modality', filters.modality);
      }

      const response = await this.makeRequest(`/studies?${queryParams.toString()}`);
      const studiesData = await response.json();

      const studies: DICOMStudy[] = studiesData.studies?.map((study: any) => ({
        studyInstanceUID: study.studyInstanceUID,
        patientID: study.patientID || 'Unknown',
        patientName: study.patientName || 'Unknown',
        studyDate: study.studyDate || '',
        studyTime: study.studyTime || '',
        modality: study.modality || '',
        studyDescription: study.studyDescription || '',
        accessionNumber: study.accessionNumber || '',
        referringPhysician: study.referringPhysician || '',
        seriesCount: study.seriesCount || 0,
        imageCount: study.imageCount || 0,
        studySize: study.studySize || 0
      })) || [];

      return {
        success: true,
        data: studies,
        metadata: {
          timestamp: new Date().toISOString(),
          requestID: this.generateRequestId(),
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('Failed to list studies', error);
    }
  }

  /**
   * Delete study from cloud storage
   */
  async deleteStudy(studyId: string): Promise<PacsServiceResponse<void>> {
    try {
      await this.makeRequest(`/studies/${studyId}`, {
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
   * Create secure share link for study
   */
  async createShareLink(
    studyId: string,
    options: {
      accessType: 'view' | 'download';
      expiresInHours: number;
      password?: string;
      maxAccess?: number;
    }
  ): Promise<PacsServiceResponse<PostDICOMShareLink>> {
    try {
      const shareData = {
        studyId,
        accessType: options.accessType,
        expiresAt: new Date(Date.now() + options.expiresInHours * 60 * 60 * 1000).toISOString(),
        password: options.password,
        maxAccess: options.maxAccess
      };

      const response = await this.makeRequest('/shares', {
        method: 'POST',
        body: JSON.stringify(shareData)
      });

      const shareResult = await response.json();

      const shareLink: PostDICOMShareLink = {
        shareId: shareResult.shareId,
        studyId: studyId,
        shareUrl: shareResult.shareUrl,
        expiresAt: shareData.expiresAt,
        accessType: options.accessType,
        passwordProtected: !!options.password,
        accessCount: 0,
        maxAccess: options.maxAccess
      };

      return {
        success: true,
        data: shareLink,
        metadata: {
          timestamp: new Date().toISOString(),
          requestID: this.generateRequestId(),
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('Failed to create share link', error);
    }
  }

  /**
   * Get storage usage information
   */
  async getStorageInfo(): Promise<PacsServiceResponse<PostDICOMStorageInfo>> {
    try {
      const response = await this.makeRequest('/storage/usage');
      const storageData = await response.json();

      const storageInfo: PostDICOMStorageInfo = {
        totalStorage: storageData.totalStorage || 0,
        usedStorage: storageData.usedStorage || 0,
        availableStorage: storageData.availableStorage || 0,
        storageQuota: storageData.storageQuota || 0,
        filesCount: storageData.filesCount || 0,
        studiesCount: storageData.studiesCount || 0
      };

      return {
        success: true,
        data: storageInfo,
        metadata: {
          timestamp: new Date().toISOString(),
          requestID: this.generateRequestId(),
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('Failed to get storage info', error);
    }
  }

  /**
   * Download study files
   */
  async downloadStudy(studyId: string): Promise<PacsServiceResponse<Blob>> {
    try {
      const response = await this.makeRequest(`/studies/${studyId}/download`);
      const studyBlob = await response.blob();

      return {
        success: true,
        data: studyBlob,
        metadata: {
          timestamp: new Date().toISOString(),
          requestID: this.generateRequestId(),
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('Failed to download study', error);
    }
  }

  /**
   * Private helper methods
   */
  private async initializeUpload(
    files: File[],
    metadata?: any
  ): Promise<{ studyId: string; uploadUrl: string }> {
    const uploadData = {
      fileCount: files.length,
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
      metadata: metadata || {},
      encryption: this.enableEncryption
    };

    const response = await this.makeRequest('/upload/initialize', {
      method: 'POST',
      body: JSON.stringify(uploadData)
    });

    const result = await response.json();
    return {
      studyId: result.studyId,
      uploadUrl: result.uploadUrl
    };
  }

  private async performUpload(
    uploadUrl: string,
    files: File[]
  ): Promise<{ fileIds: string[] }> {
    const fileIds: string[] = [];

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Upload-Encryption': this.enableEncryption.toString()
        }
      });

      if (!response.ok) {
        throw new Error(`Upload failed for file ${file.name}`);
      }

      const result = await response.json();
      fileIds.push(result.fileId);
    }

    return { fileIds };
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.apiUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'X-HIPAA-Compliant': 'true',
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

  private generateRequestId(): string {
    return `postdicom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleError(message: string, error: any): PacsServiceResponse<never> {
    console.error(message, error);
    return {
      success: false,
      error: {
        code: 'POSTDICOM_ERROR',
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