/**
 * WebQX™ Orthanc PACS Integration - Orthanc Client Utility
 * Base client for communicating with Orthanc DICOM server
 */

import { OrthancConfig, OrthancResponse, DicomStudy, DicomSeries, DicomInstance, DicomTags } from '../types';

export class OrthancClient {
  private config: OrthancConfig;
  private baseURL: string;
  private authHeader?: string;

  constructor(config: OrthancConfig) {
    this.config = config;
    this.baseURL = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    
    if (config.username && config.password) {
      const credentials = Buffer.from(`${config.username}:${config.password}`).toString('base64');
      this.authHeader = `Basic ${credentials}`;
    }
  }

  /**
   * Make HTTP request to Orthanc API
   */
  private async makeRequest<T>(
    method: string,
    endpoint: string,
    data?: any,
    retryCount = 0
  ): Promise<OrthancResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (this.authHeader) {
      headers['Authorization'] = this.authHeader;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();
      let responseData: T | undefined;

      try {
        responseData = responseText ? JSON.parse(responseText) : undefined;
      } catch {
        // If response is not JSON, treat as plain text
        responseData = responseText as unknown as T;
      }

      const result: OrthancResponse<T> = {
        success: response.ok,
        data: responseData,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
        statusCode: response.status,
        headers: Object.fromEntries(response.headers.entries())
      };

      if (!response.ok && retryCount < this.config.retryAttempts) {
        await this.delay(this.config.retryDelay * Math.pow(2, retryCount));
        return this.makeRequest<T>(method, endpoint, data, retryCount + 1);
      }

      return result;
    } catch (error) {
      if (retryCount < this.config.retryAttempts) {
        await this.delay(this.config.retryDelay * Math.pow(2, retryCount));
        return this.makeRequest<T>(method, endpoint, data, retryCount + 1);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 0,
        headers: {}
      };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get system information from Orthanc
   */
  async getSystemInfo(): Promise<OrthancResponse<any>> {
    return this.makeRequest('GET', '/system');
  }

  /**
   * Check if Orthanc is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.makeRequest('GET', '/system');
      return response.success;
    } catch {
      return false;
    }
  }

  /**
   * Get all studies
   */
  async getAllStudies(): Promise<OrthancResponse<string[]>> {
    return this.makeRequest<string[]>('GET', '/studies');
  }

  /**
   * Get study information
   */
  async getStudy(studyId: string): Promise<OrthancResponse<any>> {
    return this.makeRequest('GET', `/studies/${studyId}`);
  }

  /**
   * Get study metadata (DICOM tags)
   */
  async getStudyTags(studyId: string): Promise<OrthancResponse<DicomTags>> {
    return this.makeRequest<DicomTags>('GET', `/studies/${studyId}/tags?simplify`);
  }

  /**
   * Get series in a study
   */
  async getStudySeries(studyId: string): Promise<OrthancResponse<string[]>> {
    return this.makeRequest<string[]>('GET', `/studies/${studyId}/series`);
  }

  /**
   * Get series information
   */
  async getSeries(seriesId: string): Promise<OrthancResponse<any>> {
    return this.makeRequest('GET', `/series/${seriesId}`);
  }

  /**
   * Get series metadata (DICOM tags)
   */
  async getSeriesTags(seriesId: string): Promise<OrthancResponse<DicomTags>> {
    return this.makeRequest<DicomTags>('GET', `/series/${seriesId}/tags?simplify`);
  }

  /**
   * Get instances in a series
   */
  async getSeriesInstances(seriesId: string): Promise<OrthancResponse<string[]>> {
    return this.makeRequest<string[]>('GET', `/series/${seriesId}/instances`);
  }

  /**
   * Get instance information
   */
  async getInstance(instanceId: string): Promise<OrthancResponse<any>> {
    return this.makeRequest('GET', `/instances/${instanceId}`);
  }

  /**
   * Get instance metadata (DICOM tags)
   */
  async getInstanceTags(instanceId: string): Promise<OrthancResponse<DicomTags>> {
    return this.makeRequest<DicomTags>('GET', `/instances/${instanceId}/tags?simplify`);
  }

  /**
   * Get instance preview image
   */
  async getInstancePreview(instanceId: string, quality?: number): Promise<OrthancResponse<ArrayBuffer>> {
    const qualityParam = quality ? `?quality=${quality}` : '';
    const response = await fetch(`${this.baseURL}/instances/${instanceId}/preview${qualityParam}`, {
      headers: this.authHeader ? { 'Authorization': this.authHeader } : {}
    });

    return {
      success: response.ok,
      data: response.ok ? await response.arrayBuffer() : undefined,
      error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
      statusCode: response.status,
      headers: Object.fromEntries(response.headers.entries())
    };
  }

  /**
   * Get instance image in specific format
   */
  async getInstanceImage(
    instanceId: string, 
    format: 'jpeg' | 'png' | 'webp' = 'jpeg',
    quality?: number
  ): Promise<OrthancResponse<ArrayBuffer>> {
    let endpoint = `/instances/${instanceId}/image-uint8`;
    const params = new URLSearchParams();
    
    if (quality) {
      params.append('quality', quality.toString());
    }
    
    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      headers: {
        ...this.authHeader ? { 'Authorization': this.authHeader } : {},
        'Accept': `image/${format}`
      }
    });

    return {
      success: response.ok,
      data: response.ok ? await response.arrayBuffer() : undefined,
      error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
      statusCode: response.status,
      headers: Object.fromEntries(response.headers.entries())
    };
  }

  /**
   * Download DICOM file
   */
  async downloadDicomFile(instanceId: string): Promise<OrthancResponse<ArrayBuffer>> {
    const response = await fetch(`${this.baseURL}/instances/${instanceId}/file`, {
      headers: this.authHeader ? { 'Authorization': this.authHeader } : {}
    });

    return {
      success: response.ok,
      data: response.ok ? await response.arrayBuffer() : undefined,
      error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
      statusCode: response.status,
      headers: Object.fromEntries(response.headers.entries())
    };
  }

  /**
   * Search for studies using Orthanc's tools/find endpoint
   */
  async searchStudies(query: Record<string, any>): Promise<OrthancResponse<string[]>> {
    return this.makeRequest<string[]>('POST', '/tools/find', {
      Level: 'Study',
      Query: query,
      Expand: false
    });
  }

  /**
   * Search for series using Orthanc's tools/find endpoint
   */
  async searchSeries(query: Record<string, any>): Promise<OrthancResponse<string[]>> {
    return this.makeRequest<string[]>('POST', '/tools/find', {
      Level: 'Series',
      Query: query,
      Expand: false
    });
  }

  /**
   * Search for instances using Orthanc's tools/find endpoint
   */
  async searchInstances(query: Record<string, any>): Promise<OrthancResponse<string[]>> {
    return this.makeRequest<string[]>('POST', '/tools/find', {
      Level: 'Instance',
      Query: query,
      Expand: false
    });
  }

  /**
   * Delete a study
   */
  async deleteStudy(studyId: string): Promise<OrthancResponse<any>> {
    return this.makeRequest('DELETE', `/studies/${studyId}`);
  }

  /**
   * Delete a series
   */
  async deleteSeries(seriesId: string): Promise<OrthancResponse<any>> {
    return this.makeRequest('DELETE', `/series/${seriesId}`);
  }

  /**
   * Delete an instance
   */
  async deleteInstance(instanceId: string): Promise<OrthancResponse<any>> {
    return this.makeRequest('DELETE', `/instances/${instanceId}`);
  }

  /**
   * Get changes feed (for monitoring new uploads)
   */
  async getChanges(since?: number, limit?: number): Promise<OrthancResponse<any>> {
    const params = new URLSearchParams();
    if (since !== undefined) params.append('since', since.toString());
    if (limit !== undefined) params.append('limit', limit.toString());
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.makeRequest('GET', `/changes${query}`);
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<OrthancResponse<any>> {
    return this.makeRequest('GET', '/statistics');
  }

  /**
   * Convert study data to DicomStudy interface
   */
  async convertToStudy(studyId: string): Promise<DicomStudy | null> {
    try {
      const [studyResponse, tagsResponse, seriesResponse] = await Promise.all([
        this.getStudy(studyId),
        this.getStudyTags(studyId),
        this.getStudySeries(studyId)
      ]);

      if (!studyResponse.success || !tagsResponse.success || !seriesResponse.success) {
        return null;
      }

      const tags = tagsResponse.data || {};
      const seriesIds = seriesResponse.data || [];

      // Count total instances across all series
      let totalInstances = 0;
      for (const seriesId of seriesIds) {
        const seriesInfo = await this.getSeries(seriesId);
        if (seriesInfo.success && seriesInfo.data) {
          totalInstances += seriesInfo.data.Instances?.length || 0;
        }
      }

      return {
        id: studyId,
        patientId: tags.PatientID || '',
        studyInstanceUID: tags.StudyInstanceUID || '',
        studyDate: tags.StudyDate || '',
        studyTime: tags.StudyTime,
        studyDescription: tags.StudyDescription,
        modality: tags.Modality || 'UNKNOWN',
        institution: tags.InstitutionName,
        referringPhysician: tags.ReferringPhysicianName,
        accessionNumber: tags.AccessionNumber,
        numberOfSeries: seriesIds.length,
        numberOfInstances: totalInstances,
        metadata: studyResponse.data || {},
        tags
      };
    } catch {
      return null;
    }
  }
}