/**
 * Dicoogle Service - Advanced DICOM Search Integration
 * WebQX™ Healthcare Platform
 * 
 * Integrates with Dicoogle for advanced DICOM search,
 * indexing engine, and modular SDK plugins.
 */

import { PACS_CONFIG } from '../index';
import {
  DICOMSearchCriteria,
  DICOMSearchResult,
  DICOMStudy,
  PacsServiceResponse
} from '../types/pacsTypes';

export interface DicoogleQuery {
  queryString: string;
  filters: {
    modality?: string[];
    bodyPart?: string[];
    dateRange?: {
      from: string;
      to: string;
    };
    keywords?: string[];
  };
  limit?: number;
  offset?: number;
}

export interface IndexingStatus {
  indexName: string;
  totalDocuments: number;
  indexedDocuments: number;
  lastIndexUpdate: string;
  indexingActive: boolean;
  errorCount: number;
}

export class DicoogleService {
  private baseUrl: string;
  private searchTimeout: number;

  constructor() {
    this.baseUrl = PACS_CONFIG.dicoogle.baseUrl;
    this.searchTimeout = PACS_CONFIG.dicoogle.searchTimeout;
  }

  /**
   * Advanced DICOM search using Dicoogle's query language
   */
  async advancedSearch(query: DicoogleQuery): Promise<PacsServiceResponse<DICOMSearchResult>> {
    try {
      const searchParams = this.buildDicoogleQuery(query);
      const response = await this.makeRequest('/search', {
        method: 'POST',
        body: JSON.stringify(searchParams)
      });

      const searchResult = await response.json();
      const studies = this.transformSearchResults(searchResult);

      const result: DICOMSearchResult = {
        studies,
        totalCount: searchResult.numResults || studies.length,
        searchTime: searchResult.elapsedTime || 0,
        nextOffset: query.offset && query.limit ? 
          query.offset + query.limit : undefined
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
      return this.handleError('Advanced search failed', error);
    }
  }

  /**
   * Search by tags with specialty filters
   */
  async searchByTags(
    tags: Record<string, string>,
    specialty?: 'radiology' | 'cardiology' | 'oncology'
  ): Promise<PacsServiceResponse<DICOMSearchResult>> {
    try {
      const query = this.buildTagQuery(tags, specialty);
      return await this.advancedSearch(query);
    } catch (error) {
      return this.handleError('Tag search failed', error);
    }
  }

  /**
   * Full-text search across DICOM metadata
   */
  async fullTextSearch(
    searchText: string,
    filters?: {
      modality?: string[];
      dateRange?: { from: string; to: string };
    }
  ): Promise<PacsServiceResponse<DICOMSearchResult>> {
    try {
      const query: DicoogleQuery = {
        queryString: searchText,
        filters: filters || {},
        limit: 50
      };

      return await this.advancedSearch(query);
    } catch (error) {
      return this.handleError('Full-text search failed', error);
    }
  }

  /**
   * Get indexing status
   */
  async getIndexingStatus(): Promise<PacsServiceResponse<IndexingStatus[]>> {
    try {
      const response = await this.makeRequest('/index/status');
      const statusData = await response.json();

      const indexStatuses: IndexingStatus[] = statusData.indexes?.map((index: any) => ({
        indexName: index.name,
        totalDocuments: index.totalDocs || 0,
        indexedDocuments: index.indexedDocs || 0,
        lastIndexUpdate: index.lastUpdate || new Date().toISOString(),
        indexingActive: index.isIndexing || false,
        errorCount: index.errors || 0
      })) || [];

      return {
        success: true,
        data: indexStatuses,
        metadata: {
          timestamp: new Date().toISOString(),
          requestID: this.generateRequestId(),
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('Failed to get indexing status', error);
    }
  }

  /**
   * Trigger reindexing for better search performance
   */
  async triggerReindexing(indexName?: string): Promise<PacsServiceResponse<void>> {
    try {
      const endpoint = indexName ? `/index/reindex/${indexName}` : '/index/reindex';
      await this.makeRequest(endpoint, { method: 'POST' });

      return {
        success: true,
        metadata: {
          timestamp: new Date().toISOString(),
          requestID: this.generateRequestId(),
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('Failed to trigger reindexing', error);
    }
  }

  /**
   * Get available search fields and their types
   */
  async getSearchFields(): Promise<PacsServiceResponse<Record<string, string>>> {
    try {
      const response = await this.makeRequest('/search/fields');
      const fields = await response.json();

      return {
        success: true,
        data: fields,
        metadata: {
          timestamp: new Date().toISOString(),
          requestID: this.generateRequestId(),
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('Failed to get search fields', error);
    }
  }

  /**
   * Search with AI-enhanced filters
   */
  async aiEnhancedSearch(
    naturalLanguageQuery: string,
    contextSpecialty?: string
  ): Promise<PacsServiceResponse<DICOMSearchResult>> {
    try {
      // Convert natural language to structured query
      const structuredQuery = await this.parseNaturalLanguageQuery(
        naturalLanguageQuery,
        contextSpecialty
      );

      return await this.advancedSearch(structuredQuery);
    } catch (error) {
      return this.handleError('AI-enhanced search failed', error);
    }
  }

  /**
   * Private helper methods
   */
  private buildDicoogleQuery(query: DicoogleQuery): any {
    const dicoogleQuery: any = {
      query: query.queryString || '*',
      keyword: query.filters.keywords?.join(' ') || '',
      size: query.limit || 50,
      from: query.offset || 0
    };

    // Add filters
    if (query.filters.modality?.length) {
      dicoogleQuery.modality = query.filters.modality;
    }

    if (query.filters.bodyPart?.length) {
      dicoogleQuery.bodyPart = query.filters.bodyPart;
    }

    if (query.filters.dateRange) {
      dicoogleQuery.studyDate = `${query.filters.dateRange.from}-${query.filters.dateRange.to}`;
    }

    return dicoogleQuery;
  }

  private buildTagQuery(
    tags: Record<string, string>,
    specialty?: string
  ): DicoogleQuery {
    let queryString = Object.entries(tags)
      .map(([tag, value]) => `${tag}:${value}`)
      .join(' AND ');

    // Add specialty-specific filters
    const filters: any = {};
    
    if (specialty) {
      switch (specialty) {
        case 'radiology':
          filters.modality = ['CR', 'CT', 'MR', 'XA', 'RF', 'MG', 'DX'];
          break;
        case 'cardiology':
          filters.modality = ['XA', 'CR', 'CT', 'MR', 'US'];
          filters.bodyPart = ['CHEST', 'HEART'];
          break;
        case 'oncology':
          filters.modality = ['CT', 'MR', 'PT', 'NM'];
          break;
      }
    }

    return {
      queryString,
      filters,
      limit: 100
    };
  }

  private transformSearchResults(searchResult: any): DICOMStudy[] {
    if (!searchResult.results) {
      return [];
    }

    return searchResult.results.map((result: any) => ({
      studyInstanceUID: result.StudyInstanceUID || result.studyUID || '',
      patientID: result.PatientID || 'Unknown',
      patientName: result.PatientName || 'Unknown',
      studyDate: result.StudyDate || '',
      studyTime: result.StudyTime || '',
      modality: result.Modality || result.ModalitiesInStudy || '',
      studyDescription: result.StudyDescription || '',
      accessionNumber: result.AccessionNumber || '',
      referringPhysician: result.ReferringPhysicianName || '',
      seriesCount: parseInt(result.NumberOfStudyRelatedSeries) || 0,
      imageCount: parseInt(result.NumberOfStudyRelatedInstances) || 0,
      studySize: this.estimateStudySize(result)
    }));
  }

  private async parseNaturalLanguageQuery(
    query: string,
    specialty?: string
  ): Promise<DicoogleQuery> {
    // Simplified NLP processing - in a real implementation,
    // this would use more sophisticated AI/NLP services
    const lowerQuery = query.toLowerCase();
    
    const filters: any = {};
    let queryString = query;

    // Extract modality mentions
    const modalityMentions = {
      'ct scan': 'CT',
      'mri': 'MR',
      'x-ray': 'CR',
      'xray': 'CR',
      'ultrasound': 'US',
      'mammogram': 'MG',
      'pet scan': 'PT'
    };

    for (const [mention, modality] of Object.entries(modalityMentions)) {
      if (lowerQuery.includes(mention)) {
        filters.modality = [modality];
        break;
      }
    }

    // Extract body part mentions
    const bodyPartMentions = {
      'chest': 'CHEST',
      'head': 'HEAD',
      'abdomen': 'ABDOMEN',
      'pelvis': 'PELVIS',
      'spine': 'SPINE',
      'heart': 'HEART',
      'brain': 'BRAIN'
    };

    for (const [mention, bodyPart] of Object.entries(bodyPartMentions)) {
      if (lowerQuery.includes(mention)) {
        filters.bodyPart = [bodyPart];
        break;
      }
    }

    // Extract date mentions (simplified)
    const dateMatches = query.match(/(\d{4}-\d{2}-\d{2})/g);
    if (dateMatches && dateMatches.length >= 2) {
      filters.dateRange = {
        from: dateMatches[0],
        to: dateMatches[1]
      };
    }

    return {
      queryString: queryString,
      filters,
      limit: 50
    };
  }

  private estimateStudySize(result: any): number {
    const instanceCount = parseInt(result.NumberOfStudyRelatedInstances) || 0;
    const avgInstanceSize = 512 * 1024; // 512 KB average
    return instanceCount * avgInstanceSize;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.searchTimeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private generateRequestId(): string {
    return `dicoogle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleError(message: string, error: any): PacsServiceResponse<never> {
    console.error(message, error);
    return {
      success: false,
      error: {
        code: 'DICOOGLE_ERROR',
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