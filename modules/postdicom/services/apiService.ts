/**
 * PostDICOM API Service
 * Handles communication with PostDICOM cloud service and local API endpoints
 */

import {
  DICOMStudy,
  DICOMSeries,
  DICOMImage,
  StudySearchParams,
  APIResponse,
  PostDICOMAPIConfig,
  PostDICOMError,
  ERROR_CODES
} from '../types/postdicom.types';
import { getPostDICOMConfig } from '../config/postdicom.config';
import PostDICOMCacheService from './cacheService';
import PostDICOMRBACService from './rbacService';

/**
 * HTTP client interface for API requests
 */
interface HTTPClient {
  get<T>(url: string, config?: any): Promise<APIResponse<T>>;
  post<T>(url: string, data?: any, config?: any): Promise<APIResponse<T>>;
  put<T>(url: string, data?: any, config?: any): Promise<APIResponse<T>>;
  delete<T>(url: string, config?: any): Promise<APIResponse<T>>;
}

/**
 * Mock HTTP Client implementation
 * In a real application, this would use axios or fetch
 */
class MockHTTPClient implements HTTPClient {
  private config: PostDICOMAPIConfig;
  private requestCount = 0;

  constructor(config: PostDICOMAPIConfig) {
    this.config = config;
  }

  async get<T>(url: string, config?: any): Promise<APIResponse<T>> {
    return this.makeRequest('GET', url, null, config);
  }

  async post<T>(url: string, data?: any, config?: any): Promise<APIResponse<T>> {
    return this.makeRequest('POST', url, data, config);
  }

  async put<T>(url: string, data?: any, config?: any): Promise<APIResponse<T>> {
    return this.makeRequest('PUT', url, data, config);
  }

  async delete<T>(url: string, config?: any): Promise<APIResponse<T>> {
    return this.makeRequest('DELETE', url, null, config);
  }

  private async makeRequest<T>(method: string, url: string, data?: any, config?: any): Promise<APIResponse<T>> {
    this.requestCount++;
    
    // Check rate limiting
    if (this.requestCount > this.config.rateLimitPerMinute) {
      throw new PostDICOMError(
        'Rate limit exceeded',
        ERROR_CODES.NETWORK_ERROR,
        429
      );
    }

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Mock responses based on URL patterns
    if (url.includes('/studies')) {
      return this.mockStudyResponse<T>(method, url, data);
    } else if (url.includes('/images')) {
      return this.mockImageResponse<T>(method, url, data);
    } else if (url.includes('/search')) {
      return this.mockSearchResponse<T>(method, url, data);
    }

    // Default success response
    return {
      success: true,
      data: {} as T
    };
  }

  private mockStudyResponse<T>(method: string, url: string, data?: any): APIResponse<T> {
    const mockStudy: DICOMStudy = {
      studyInstanceUID: '1.2.826.0.1.3680043.8.498.12345',
      patientID: 'PAT-12345',
      patientName: 'Doe^John',
      studyDate: '2024-01-15',
      studyDescription: 'CT Chest with Contrast',
      modality: 'CT',
      seriesCount: 3,
      imageCount: 150,
      studySize: 52428800, // 50MB
      accessLevel: 'restricted',
      createdAt: new Date('2024-01-15T10:00:00Z'),
      updatedAt: new Date('2024-01-15T10:30:00Z')
    };

    if (method === 'GET') {
      if (url.includes('/studies/')) {
        return { success: true, data: mockStudy as T };
      } else {
        return { 
          success: true, 
          data: [mockStudy] as T,
          metadata: {
            totalCount: 1,
            pageSize: 10,
            currentPage: 1,
            hasMore: false
          }
        };
      }
    }

    return { success: true, data: mockStudy as T };
  }

  private mockImageResponse<T>(method: string, url: string, data?: any): APIResponse<T> {
    const mockImage: DICOMImage = {
      sopInstanceUID: '1.2.826.0.1.3680043.8.498.67890',
      seriesInstanceUID: '1.2.826.0.1.3680043.8.498.54321',
      instanceNumber: 1,
      imageType: 'ORIGINAL\\PRIMARY\\AXIAL',
      rows: 512,
      columns: 512,
      bitsAllocated: 16,
      imageSize: 524288, // 512KB
      transferSyntax: '1.2.840.10008.1.2.1',
      storageUrl: 'https://s3.amazonaws.com/webqx-dicom/image.dcm',
      thumbnailUrl: 'https://s3.amazonaws.com/webqx-dicom/thumbnail.jpg',
      metadata: {
        windowCenter: 40,
        windowWidth: 400,
        sliceThickness: 5.0
      }
    };

    return { success: true, data: mockImage as T };
  }

  private mockSearchResponse<T>(method: string, url: string, data?: any): APIResponse<T> {
    const mockResults = [
      {
        studyInstanceUID: '1.2.826.0.1.3680043.8.498.12345',
        patientID: 'PAT-12345',
        studyDate: '2024-01-15',
        modality: 'CT',
        studyDescription: 'CT Chest with Contrast'
      },
      {
        studyInstanceUID: '1.2.826.0.1.3680043.8.498.12346',
        patientID: 'PAT-12346',
        studyDate: '2024-01-14',
        modality: 'MRI',
        studyDescription: 'MRI Brain without Contrast'
      }
    ];

    return {
      success: true,
      data: mockResults as T,
      metadata: {
        totalCount: 2,
        pageSize: 10,
        currentPage: 1,
        hasMore: false
      }
    };
  }
}

/**
 * PostDICOM API Service
 * Main service for accessing PostDICOM cloud services and local endpoints
 */
export class PostDICOMAPIService {
  private config: PostDICOMAPIConfig;
  private httpClient: HTTPClient;
  private cacheService: PostDICOMCacheService;
  private rbacService: PostDICOMRBACService;
  private retryCount = 0;

  constructor(
    customConfig?: Partial<PostDICOMAPIConfig>,
    cacheService?: PostDICOMCacheService,
    rbacService?: PostDICOMRBACService
  ) {
    const fullConfig = getPostDICOMConfig();
    this.config = { ...fullConfig.api, ...customConfig };
    this.httpClient = new MockHTTPClient(this.config);
    this.cacheService = cacheService || new PostDICOMCacheService();
    this.rbacService = rbacService || new PostDICOMRBACService();
  }

  /**
   * Search for DICOM studies
   */
  async searchStudies(params: StudySearchParams): Promise<APIResponse<DICOMStudy[]>> {
    try {
      // Generate cache key for search
      const cacheKey = this.generateSearchCacheKey(params);
      
      // Check cache first
      const cachedResults = await this.cacheService.getCachedSearchResults(cacheKey);
      if (cachedResults) {
        return {
          success: true,
          data: cachedResults
        };
      }

      // Build query parameters
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (typeof value === 'object') {
            queryParams.append(key, JSON.stringify(value));
          } else {
            queryParams.append(key, value.toString());
          }
        }
      });

      const url = `${this.config.baseUrl}/${this.config.version}/studies?${queryParams.toString()}`;
      
      const response = await this.makeRequestWithRetry<DICOMStudy[]>('GET', url);
      
      // Cache the results
      if (response.success && response.data) {
        await this.cacheService.cacheSearchResults(cacheKey, response.data);
      }

      return response;

    } catch (error) {
      return this.handleError<DICOMStudy[]>(error);
    }
  }

  /**
   * Get specific DICOM study by UID
   */
  async getStudy(studyInstanceUID: string): Promise<APIResponse<DICOMStudy>> {
    try {
      // Check cache first
      const cachedStudy = await this.cacheService.getCachedStudyMetadata(studyInstanceUID);
      if (cachedStudy) {
        return {
          success: true,
          data: cachedStudy
        };
      }

      const url = `${this.config.baseUrl}/${this.config.version}/studies/${studyInstanceUID}`;
      const response = await this.makeRequestWithRetry<DICOMStudy>('GET', url);

      // Cache the study metadata
      if (response.success && response.data) {
        await this.cacheService.cacheStudyMetadata(response.data);
      }

      return response;

    } catch (error) {
      return this.handleError<DICOMStudy>(error);
    }
  }

  /**
   * Get series within a study
   */
  async getStudySeries(studyInstanceUID: string): Promise<APIResponse<DICOMSeries[]>> {
    try {
      const url = `${this.config.baseUrl}/${this.config.version}/studies/${studyInstanceUID}/series`;
      return await this.makeRequestWithRetry<DICOMSeries[]>('GET', url);

    } catch (error) {
      return this.handleError<DICOMSeries[]>(error);
    }
  }

  /**
   * Get images within a series
   */
  async getSeriesImages(
    studyInstanceUID: string,
    seriesInstanceUID: string
  ): Promise<APIResponse<DICOMImage[]>> {
    try {
      const url = `${this.config.baseUrl}/${this.config.version}/studies/${studyInstanceUID}/series/${seriesInstanceUID}/images`;
      return await this.makeRequestWithRetry<DICOMImage[]>('GET', url);

    } catch (error) {
      return this.handleError<DICOMImage[]>(error);
    }
  }

  /**
   * Get DICOM image data
   */
  async getImageData(sopInstanceUID: string): Promise<APIResponse<ArrayBuffer>> {
    try {
      // Check cache first
      const cachedImage = await this.cacheService.getCachedImageData(sopInstanceUID);
      if (cachedImage) {
        return {
          success: true,
          data: cachedImage.buffer
        };
      }

      const url = `${this.config.baseUrl}/${this.config.version}/images/${sopInstanceUID}/data`;
      const response = await this.makeRequestWithRetry<ArrayBuffer>('GET', url, {
        responseType: 'arraybuffer'
      });

      // Cache the image data if successful
      if (response.success && response.data) {
        const buffer = Buffer.from(response.data);
        await this.cacheService.cacheImageData(sopInstanceUID, buffer);
      }

      return response;

    } catch (error) {
      return this.handleError<ArrayBuffer>(error);
    }
  }

  /**
   * Get image metadata only (without pixel data)
   */
  async getImageMetadata(sopInstanceUID: string): Promise<APIResponse<DICOMImage>> {
    try {
      const url = `${this.config.baseUrl}/${this.config.version}/images/${sopInstanceUID}/metadata`;
      return await this.makeRequestWithRetry<DICOMImage>('GET', url);

    } catch (error) {
      return this.handleError<DICOMImage>(error);
    }
  }

  /**
   * Upload DICOM study
   */
  async uploadStudy(
    files: File[],
    metadata: any
  ): Promise<APIResponse<{ studyInstanceUID: string; uploadId: string }>> {
    try {
      const formData = new FormData();
      
      files.forEach((file, index) => {
        formData.append(`files[${index}]`, file);
      });
      
      formData.append('metadata', JSON.stringify(metadata));

      const url = `${this.config.baseUrl}/${this.config.version}/studies/upload`;
      
      const response = await this.makeRequestWithRetry<{
        studyInstanceUID: string;
        uploadId: string;
      }>('POST', url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      return response;

    } catch (error) {
      return this.handleError<{ studyInstanceUID: string; uploadId: string }>(error);
    }
  }

  /**
   * Delete DICOM study (admin only)
   */
  async deleteStudy(studyInstanceUID: string): Promise<APIResponse<void>> {
    try {
      const url = `${this.config.baseUrl}/${this.config.version}/studies/${studyInstanceUID}`;
      const response = await this.makeRequestWithRetry<void>('DELETE', url);

      // Invalidate cache for this study
      if (response.success) {
        await this.cacheService.invalidateStudy(studyInstanceUID);
      }

      return response;

    } catch (error) {
      return this.handleError<void>(error);
    }
  }

  /**
   * Get PostDICOM service health status
   */
  async getServiceHealth(): Promise<APIResponse<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    version: string;
    uptime: number;
    services: { [key: string]: boolean };
  }>> {
    try {
      const url = `${this.config.baseUrl}/health`;
      return await this.makeRequestWithRetry('GET', url);

    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Get API usage statistics
   */
  async getUsageStats(): Promise<APIResponse<{
    requestCount: number;
    dataTransferred: number;
    storageUsed: number;
    activeUsers: number;
    peakUsage: Date;
  }>> {
    try {
      const url = `${this.config.baseUrl}/${this.config.version}/stats/usage`;
      return await this.makeRequestWithRetry('GET', url);

    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Generate pre-signed URL for direct access
   */
  async generatePreSignedUrl(
    sopInstanceUID: string,
    expiresIn: number = 3600
  ): Promise<APIResponse<{ url: string; expiresAt: Date }>> {
    try {
      const url = `${this.config.baseUrl}/${this.config.version}/images/${sopInstanceUID}/presigned-url`;
      
      return await this.makeRequestWithRetry('POST', url, {
        expiresIn
      });

    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Batch operations for multiple studies
   */
  async batchOperation(
    operation: 'download' | 'delete' | 'archive',
    studyInstanceUIDs: string[]
  ): Promise<APIResponse<{ batchId: string; status: string }>> {
    try {
      const url = `${this.config.baseUrl}/${this.config.version}/batch/${operation}`;
      
      return await this.makeRequestWithRetry('POST', url, {
        studyInstanceUIDs
      });

    } catch (error) {
      return this.handleError(error);
    }
  }

  // Private helper methods

  private async makeRequestWithRetry<T>(
    method: string,
    url: string,
    data?: any,
    config?: any
  ): Promise<APIResponse<T>> {
    let lastError: Error;

    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      try {
        // Add authentication headers
        const requestConfig = {
          ...config,
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'WebQX-PostDICOM/1.0.0',
            ...config?.headers
          },
          timeout: this.config.timeout
        };

        let response: APIResponse<T>;

        switch (method.toUpperCase()) {
          case 'GET':
            response = await this.httpClient.get<T>(url, requestConfig);
            break;
          case 'POST':
            response = await this.httpClient.post<T>(url, data, requestConfig);
            break;
          case 'PUT':
            response = await this.httpClient.put<T>(url, data, requestConfig);
            break;
          case 'DELETE':
            response = await this.httpClient.delete<T>(url, requestConfig);
            break;
          default:
            throw new Error(`Unsupported HTTP method: ${method}`);
        }

        // Reset retry count on success
        this.retryCount = 0;
        return response;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry for certain error types
        if (error instanceof Error && 'statusCode' in error) {
          const statusCode = (error as any).statusCode;
          if (statusCode === 401 || statusCode === 403 || statusCode === 404) {
            break;
          }
        }

        // Exponential backoff
        if (attempt < this.config.retryAttempts) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s, 8s...
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  private handleError<T>(error: any): APIResponse<T> {
    let errorCode: string = ERROR_CODES.NETWORK_ERROR;
    let statusCode = 500;

    if (error && typeof error === 'object' && error.statusCode) {
      statusCode = error.statusCode;
      
      switch (statusCode) {
        case 401:
          errorCode = ERROR_CODES.INVALID_CREDENTIALS;
          break;
        case 403:
          errorCode = ERROR_CODES.ACCESS_DENIED;
          break;
        case 404:
          errorCode = ERROR_CODES.STUDY_NOT_FOUND;
          break;
        case 429:
          errorCode = ERROR_CODES.NETWORK_ERROR;
          break;
      }
    }

    return {
      success: false,
      error: {
        code: (error && typeof error === 'object' && error.code) || errorCode,
        message: (error instanceof Error ? error.message : String(error)) || 'Unknown API error',
        details: {
          statusCode,
          timestamp: new Date().toISOString(),
          retryAfter: error && typeof error === 'object' ? error.retryAfter : undefined
        }
      }
    };
  }

  private generateSearchCacheKey(params: StudySearchParams): string {
    // Create a deterministic cache key from search parameters
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${JSON.stringify(params[key as keyof StudySearchParams])}`)
      .join('|');
    
    return `search:${Buffer.from(sortedParams).toString('base64')}`;
  }
}

export default PostDICOMAPIService;