/**
 * WebQX™ Orthanc PACS Integration - Indexing and Search Plugin
 * Advanced metadata indexing and search capabilities for DICOM files
 */

import { EventEmitter } from 'events';
import {
  SearchQuery,
  SearchResult,
  SearchFacets,
  IndexedMetadata,
  DicomStudy,
  DicomEvent,
  PluginConfig,
  HealthStatus
} from '../types';
import { OrthancClient } from '../utils/orthancClient';

export class IndexingPlugin extends EventEmitter {
  private pluginConfig: PluginConfig;
  private orthancClient: OrthancClient;
  private searchProvider: SearchProvider;
  private indexedStudies: Map<string, IndexedMetadata> = new Map();
  private isInitialized = false;
  private indexingQueue: string[] = [];
  private isProcessingQueue = false;

  constructor(
    databaseType: 'postgresql' | 'mongodb',
    databaseConfig: any,
    pluginConfig: PluginConfig,
    orthancClient: OrthancClient
  ) {
    super();
    this.pluginConfig = pluginConfig;
    this.orthancClient = orthancClient;
    this.searchProvider = this.createSearchProvider(databaseType, databaseConfig);
  }

  /**
   * Initialize the indexing plugin
   */
  async initialize(): Promise<void> {
    try {
      // Initialize search provider
      await this.searchProvider.initialize();
      
      // Load existing index
      await this.loadExistingIndex();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Start background indexing
      this.startBackgroundIndexing();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      console.log('[Indexing Plugin] Successfully initialized');
    } catch (error) {
      this.emit('error', {
        code: 'INITIALIZATION_FAILED',
        message: 'Failed to initialize indexing plugin',
        details: error,
        timestamp: new Date(),
        pluginName: 'IndexingPlugin',
        severity: 'critical'
      });
      throw error;
    }
  }

  /**
   * Get health status of the plugin
   */
  async getHealthStatus(): Promise<HealthStatus> {
    try {
      if (!this.isInitialized) {
        return {
          status: 'unhealthy',
          message: 'Plugin not initialized',
          timestamp: new Date(),
          version: '1.0.0'
        };
      }

      // Check search provider health
      const providerHealth = await this.searchProvider.healthCheck();
      
      // Check Orthanc connectivity
      const orthancHealth = await this.orthancClient.healthCheck();

      if (!orthancHealth) {
        return {
          status: 'degraded',
          message: 'Orthanc server not accessible',
          details: { orthancHealth, providerHealth },
          timestamp: new Date(),
          version: '1.0.0'
        };
      }

      if (!providerHealth) {
        return {
          status: 'degraded',
          message: 'Search provider not accessible',
          details: { orthancHealth, providerHealth },
          timestamp: new Date(),
          version: '1.0.0'
        };
      }

      return {
        status: 'healthy',
        message: 'All systems operational',
        details: {
          orthancHealth,
          providerHealth,
          indexedStudies: this.indexedStudies.size,
          queueLength: this.indexingQueue.length,
          isProcessingQueue: this.isProcessingQueue
        },
        timestamp: new Date(),
        version: '1.0.0'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Health check failed',
        details: error,
        timestamp: new Date(),
        version: '1.0.0'
      };
    }
  }

  /**
   * Handle DICOM events for indexing
   */
  async handleDicomEvent(event: DicomEvent): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Plugin not initialized');
    }

    switch (event.type) {
      case 'study_created':
      case 'study_updated':
        if (event.studyId) {
          await this.queueStudyForIndexing(event.studyId);
        }
        break;
      case 'instance_uploaded':
        if (event.studyId) {
          await this.queueStudyForIndexing(event.studyId);
        }
        break;
      case 'study_deleted':
        if (event.studyId) {
          await this.removeStudyFromIndex(event.studyId);
        }
        break;
    }
  }

  /**
   * Search for studies based on query
   */
  async searchStudies(query: SearchQuery): Promise<SearchResult> {
    if (!this.isInitialized) {
      throw new Error('Plugin not initialized');
    }

    const startTime = Date.now();

    try {
      // Use search provider for advanced search
      const searchResults = await this.searchProvider.search(query);
      
      // Convert search results to DicomStudy objects
      const studies: DicomStudy[] = [];
      
      for (const studyId of searchResults.studyIds) {
        const study = await this.orthancClient.convertToStudy(studyId);
        if (study) {
          studies.push(study);
        }
      }

      const executionTime = Date.now() - startTime;

      const result: SearchResult = {
        total: searchResults.total,
        studies,
        facets: searchResults.facets,
        executionTimeMs: executionTime
      };

      this.emit('search_completed', { query, result, executionTimeMs: executionTime });

      return result;
    } catch (error) {
      this.emit('error', {
        code: 'SEARCH_FAILED',
        message: 'Search operation failed',
        details: { query, error },
        timestamp: new Date(),
        pluginName: 'IndexingPlugin',
        severity: 'medium'
      });
      throw error;
    }
  }

  /**
   * Get search suggestions based on partial input
   */
  async getSearchSuggestions(
    field: string, 
    partialValue: string, 
    limit = 10
  ): Promise<string[]> {
    return this.searchProvider.getSuggestions(field, partialValue, limit);
  }

  /**
   * Get search facets for building search UI
   */
  async getSearchFacets(): Promise<SearchFacets> {
    return this.searchProvider.getFacets();
  }

  /**
   * Re-index all studies
   */
  async reindexAll(): Promise<void> {
    console.log('[Indexing Plugin] Starting full re-index');
    
    // Get all studies from Orthanc
    const studiesResponse = await this.orthancClient.getAllStudies();
    if (!studiesResponse.success || !studiesResponse.data) {
      throw new Error('Failed to get studies from Orthanc');
    }

    // Clear existing index
    await this.searchProvider.clearIndex();
    this.indexedStudies.clear();

    // Queue all studies for indexing
    for (const studyId of studiesResponse.data) {
      this.indexingQueue.push(studyId);
    }

    console.log(`[Indexing Plugin] Queued ${this.indexingQueue.length} studies for re-indexing`);
  }

  /**
   * Get indexing statistics
   */
  async getIndexingStats(): Promise<any> {
    return {
      totalIndexedStudies: this.indexedStudies.size,
      queueLength: this.indexingQueue.length,
      isProcessingQueue: this.isProcessingQueue,
      lastIndexedAt: this.getLastIndexedTime(),
      indexSize: await this.searchProvider.getIndexSize(),
      searchProviderStats: await this.searchProvider.getStats()
    };
  }

  private createSearchProvider(type: 'postgresql' | 'mongodb', config: any): SearchProvider {
    switch (type) {
      case 'postgresql':
        return new PostgreSQLSearchProvider(config);
      case 'mongodb':
        return new MongoDBSearchProvider(config);
      default:
        throw new Error(`Unsupported search provider: ${type}`);
    }
  }

  private async loadExistingIndex(): Promise<void> {
    try {
      const indexData = await this.searchProvider.loadIndex();
      for (const item of indexData) {
        this.indexedStudies.set(item.studyId, item);
      }
      console.log(`[Indexing Plugin] Loaded ${this.indexedStudies.size} indexed studies`);
    } catch (error) {
      console.warn('[Indexing Plugin] Failed to load existing index:', error);
    }
  }

  private setupEventListeners(): void {
    // Monitor Orthanc changes for new studies
    setInterval(async () => {
      try {
        await this.monitorOrthancChanges();
      } catch (error) {
        console.error('Error monitoring Orthanc changes:', error);
      }
    }, 30000); // Check every 30 seconds
  }

  private startBackgroundIndexing(): void {
    setInterval(async () => {
      if (!this.isProcessingQueue && this.indexingQueue.length > 0) {
        await this.processIndexingQueue();
      }
    }, 5000); // Process queue every 5 seconds
  }

  private async queueStudyForIndexing(studyId: string): Promise<void> {
    if (!this.indexingQueue.includes(studyId)) {
      this.indexingQueue.push(studyId);
    }
  }

  private async processIndexingQueue(): Promise<void> {
    if (this.isProcessingQueue || this.indexingQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      // Process up to 5 studies at a time
      const studiesToProcess = this.indexingQueue.splice(0, 5);
      
      const indexingPromises = studiesToProcess.map(studyId => 
        this.indexStudy(studyId).catch(error => {
          console.error(`Failed to index study ${studyId}:`, error);
        })
      );

      await Promise.all(indexingPromises);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private async indexStudy(studyId: string): Promise<void> {
    try {
      // Get study metadata from Orthanc
      const study = await this.orthancClient.convertToStudy(studyId);
      if (!study) {
        throw new Error(`Could not convert study ${studyId}`);
      }

      // Extract searchable text from metadata
      const searchableText = this.extractSearchableText(study);
      
      // Create indexed metadata
      const indexedMetadata: IndexedMetadata = {
        studyId,
        patientId: study.patientId,
        extractedText: searchableText,
        keyValuePairs: this.extractKeyValuePairs(study),
        indexedAt: new Date(),
        searchableText,
        facetValues: this.extractFacetValues(study)
      };

      // Save to search provider
      await this.searchProvider.indexStudy(indexedMetadata);
      
      // Update local cache
      this.indexedStudies.set(studyId, indexedMetadata);

      this.emit('study_indexed', { studyId, metadata: indexedMetadata });
      
    } catch (error) {
      this.emit('error', {
        code: 'INDEXING_FAILED',
        message: `Failed to index study ${studyId}`,
        details: error,
        timestamp: new Date(),
        pluginName: 'IndexingPlugin',
        severity: 'medium'
      });
      throw error;
    }
  }

  private async removeStudyFromIndex(studyId: string): Promise<void> {
    try {
      await this.searchProvider.removeStudy(studyId);
      this.indexedStudies.delete(studyId);
      this.emit('study_removed', { studyId });
    } catch (error) {
      console.error(`Failed to remove study ${studyId} from index:`, error);
    }
  }

  private extractSearchableText(study: DicomStudy): string {
    const searchableFields = [
      study.tags.PatientName,
      study.tags.PatientID,
      study.studyDescription,
      study.tags.StudyDescription,
      study.referringPhysician,
      study.tags.ReferringPhysicianName,
      study.accessionNumber,
      study.tags.AccessionNumber,
      study.institution,
      study.tags.InstitutionName
    ];

    return searchableFields
      .filter(field => field && typeof field === 'string')
      .join(' ')
      .toLowerCase();
  }

  private extractKeyValuePairs(study: DicomStudy): Record<string, any> {
    return {
      patientId: study.patientId,
      patientName: study.tags.PatientName,
      studyDate: study.studyDate,
      studyTime: study.studyTime,
      modality: study.modality,
      institution: study.institution,
      accessionNumber: study.accessionNumber,
      numberOfSeries: study.numberOfSeries,
      numberOfInstances: study.numberOfInstances,
      ...study.tags
    };
  }

  private extractFacetValues(study: DicomStudy): Record<string, string[]> {
    return {
      modality: [study.modality],
      institution: study.institution ? [study.institution] : [],
      dateRange: this.getDateRange(study.studyDate),
      patientSex: study.tags.PatientSex ? [study.tags.PatientSex] : []
    };
  }

  private getDateRange(studyDate: string): string[] {
    if (!studyDate) return [];
    
    const year = studyDate.substring(0, 4);
    const month = studyDate.substring(4, 6);
    
    return [
      `${year}`,
      `${year}-${month}`,
      this.getQuarter(studyDate),
      this.getAgeRange(studyDate)
    ];
  }

  private getQuarter(studyDate: string): string {
    const month = parseInt(studyDate.substring(4, 6));
    const year = studyDate.substring(0, 4);
    const quarter = Math.ceil(month / 3);
    return `${year}-Q${quarter}`;
  }

  private getAgeRange(studyDate: string): string {
    const studyYear = parseInt(studyDate.substring(0, 4));
    const currentYear = new Date().getFullYear();
    const age = currentYear - studyYear;
    
    if (age < 1) return 'recent';
    if (age < 2) return '1-year';
    if (age < 5) return '2-5-years';
    if (age < 10) return '5-10-years';
    return 'older';
  }

  private async monitorOrthancChanges(): Promise<void> {
    // Implementation would monitor Orthanc changes feed
    // and queue new studies for indexing
  }

  private getLastIndexedTime(): Date | null {
    let lastTime: Date | null = null;
    for (const metadata of this.indexedStudies.values()) {
      if (!lastTime || metadata.indexedAt > lastTime) {
        lastTime = metadata.indexedAt;
      }
    }
    return lastTime;
  }
}

// Abstract base class for search providers
abstract class SearchProvider {
  protected config: any;

  constructor(config: any) {
    this.config = config;
  }

  abstract initialize(): Promise<void>;
  abstract healthCheck(): Promise<boolean>;
  abstract indexStudy(metadata: IndexedMetadata): Promise<void>;
  abstract removeStudy(studyId: string): Promise<void>;
  abstract search(query: SearchQuery): Promise<{ studyIds: string[]; total: number; facets?: SearchFacets }>;
  abstract getSuggestions(field: string, partialValue: string, limit: number): Promise<string[]>;
  abstract getFacets(): Promise<SearchFacets>;
  abstract loadIndex(): Promise<IndexedMetadata[]>;
  abstract clearIndex(): Promise<void>;
  abstract getIndexSize(): Promise<number>;
  abstract getStats(): Promise<any>;
}

// PostgreSQL Search Provider
class PostgreSQLSearchProvider extends SearchProvider {
  async initialize(): Promise<void> {
    console.log('[PostgreSQL Search] Initialized PostgreSQL search provider');
    // PostgreSQL initialization would go here
  }

  async healthCheck(): Promise<boolean> {
    return true; // Simplified for demo
  }

  async indexStudy(metadata: IndexedMetadata): Promise<void> {
    console.log(`[PostgreSQL Search] Indexing study: ${metadata.studyId}`);
    // PostgreSQL insert/update implementation
  }

  async removeStudy(studyId: string): Promise<void> {
    console.log(`[PostgreSQL Search] Removing study: ${studyId}`);
    // PostgreSQL delete implementation
  }

  async search(query: SearchQuery): Promise<{ studyIds: string[]; total: number; facets?: SearchFacets }> {
    console.log('[PostgreSQL Search] Executing search query:', query);
    // PostgreSQL search implementation
    return {
      studyIds: [],
      total: 0,
      facets: {
        modalities: {},
        institutions: {},
        dateRanges: {}
      }
    };
  }

  async getSuggestions(field: string, partialValue: string, limit: number): Promise<string[]> {
    console.log(`[PostgreSQL Search] Getting suggestions for ${field}: ${partialValue}`);
    return [];
  }

  async getFacets(): Promise<SearchFacets> {
    return {
      modalities: {},
      institutions: {},
      dateRanges: {}
    };
  }

  async loadIndex(): Promise<IndexedMetadata[]> {
    return [];
  }

  async clearIndex(): Promise<void> {
    console.log('[PostgreSQL Search] Clearing index');
  }

  async getIndexSize(): Promise<number> {
    return 0;
  }

  async getStats(): Promise<any> {
    return {};
  }
}

// MongoDB Search Provider
class MongoDBSearchProvider extends SearchProvider {
  async initialize(): Promise<void> {
    console.log('[MongoDB Search] Initialized MongoDB search provider');
    // MongoDB initialization would go here
  }

  async healthCheck(): Promise<boolean> {
    return true; // Simplified for demo
  }

  async indexStudy(metadata: IndexedMetadata): Promise<void> {
    console.log(`[MongoDB Search] Indexing study: ${metadata.studyId}`);
    // MongoDB insert/update implementation
  }

  async removeStudy(studyId: string): Promise<void> {
    console.log(`[MongoDB Search] Removing study: ${studyId}`);
    // MongoDB delete implementation
  }

  async search(query: SearchQuery): Promise<{ studyIds: string[]; total: number; facets?: SearchFacets }> {
    console.log('[MongoDB Search] Executing search query:', query);
    // MongoDB search implementation
    return {
      studyIds: [],
      total: 0,
      facets: {
        modalities: {},
        institutions: {},
        dateRanges: {}
      }
    };
  }

  async getSuggestions(field: string, partialValue: string, limit: number): Promise<string[]> {
    console.log(`[MongoDB Search] Getting suggestions for ${field}: ${partialValue}`);
    return [];
  }

  async getFacets(): Promise<SearchFacets> {
    return {
      modalities: {},
      institutions: {},
      dateRanges: {}
    };
  }

  async loadIndex(): Promise<IndexedMetadata[]> {
    return [];
  }

  async clearIndex(): Promise<void> {
    console.log('[MongoDB Search] Clearing index');
  }

  async getIndexSize(): Promise<number> {
    return 0;
  }

  async getStats(): Promise<any> {
    return {};
  }
}