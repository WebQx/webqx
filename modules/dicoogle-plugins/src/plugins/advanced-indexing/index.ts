/**
 * Advanced Indexing Plugin for Dicoogle PACS
 * 
 * Provides custom indexing capabilities for DICOM metadata beyond default fields
 * Supports preprocessing pipelines and configurable indexing strategies
 */

import { EventEmitter } from 'events';
import { configManager } from '../../config';
import { cachingService } from '../caching';
import {
  STANDARD_DICOM_TAGS,
  DICOM_DATA_TYPES,
  validateDicomTag,
  validateDicomValue,
  sanitizeInput,
} from '../../utils';

/**
 * Indexing field configuration
 */
export interface IndexingFieldConfig {
  tag: string;
  name: string;
  dataType: keyof typeof DICOM_DATA_TYPES;
  indexed: boolean;
  searchable: boolean;
  faceted: boolean;
  preprocessing?: PreprocessingConfig[];
  weight?: number;
  specialty?: string[];
}

/**
 * Preprocessing configuration for metadata fields
 */
export interface PreprocessingConfig {
  type: 'normalize' | 'extract' | 'transform' | 'validate' | 'anonymize';
  params?: Record<string, any>;
  enabled: boolean;
  order: number;
}

/**
 * Index statistics
 */
export interface IndexStatistics {
  totalDocuments: number;
  totalFields: number;
  indexSize: string;
  lastUpdated: Date;
  indexingRate: number; // documents per second
  fieldStatistics: FieldStatistics[];
}

/**
 * Field statistics
 */
export interface FieldStatistics {
  field: string;
  uniqueValues: number;
  nullValues: number;
  avgLength: number;
  mostCommonValues: Array<{ value: string; count: number; }>;
}

/**
 * Indexing job status
 */
export interface IndexingJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  type: 'full' | 'incremental' | 'field-specific';
  startTime?: Date;
  endTime?: Date;
  progress: {
    processed: number;
    total: number;
    percentage: number;
  };
  errors: string[];
  config: IndexingJobConfig;
}

/**
 * Indexing job configuration
 */
export interface IndexingJobConfig {
  fields?: string[];
  batchSize: number;
  maxConcurrency: number;
  enablePreprocessing: boolean;
  forceReindex: boolean;
  organizationId?: string;
  filters?: Record<string, any>;
}

/**
 * Specialty-specific field configurations
 */
const SPECIALTY_FIELD_CONFIGS: Record<string, IndexingFieldConfig[]> = {
  radiology: [
    {
      tag: '00080008', // Image Type
      name: 'Image Type',
      dataType: 'CS',
      indexed: true,
      searchable: true,
      faceted: true,
      weight: 0.8,
      specialty: ['radiology'],
    },
    {
      tag: '00181030', // Protocol Name
      name: 'Protocol Name',
      dataType: 'LO',
      indexed: true,
      searchable: true,
      faceted: true,
      weight: 0.9,
      specialty: ['radiology'],
    },
    {
      tag: '00280030', // Pixel Spacing
      name: 'Pixel Spacing',
      dataType: 'DS',
      indexed: true,
      searchable: false,
      faceted: false,
      weight: 0.3,
      specialty: ['radiology'],
    },
  ],
  cardiology: [
    {
      tag: '00181063', // Frame Time
      name: 'Frame Time',
      dataType: 'DS',
      indexed: true,
      searchable: false,
      faceted: false,
      weight: 0.5,
      specialty: ['cardiology'],
    },
    {
      tag: '00181068', // Frame Time Vector
      name: 'Frame Time Vector',
      dataType: 'DS',
      indexed: true,
      searchable: false,
      faceted: false,
      weight: 0.4,
      specialty: ['cardiology'],
    },
  ],
  oncology: [
    {
      tag: '00120062', // Patient Identity Removed
      name: 'Patient Identity Removed',
      dataType: 'CS',
      indexed: true,
      searchable: true,
      faceted: true,
      weight: 0.7,
      specialty: ['oncology'],
    },
    {
      tag: '00120063', // De-identification Method
      name: 'De-identification Method',
      dataType: 'LO',
      indexed: true,
      searchable: true,
      faceted: false,
      weight: 0.6,
      specialty: ['oncology'],
    },
  ],
};

/**
 * Built-in preprocessing functions
 */
const PREPROCESSING_FUNCTIONS = {
  normalize: (value: string, params?: Record<string, any>) => {
    return value?.toString().trim().toUpperCase();
  },
  
  extract: (value: string, params?: Record<string, any>) => {
    if (params?.pattern) {
      const regex = new RegExp(params.pattern, params.flags || 'i');
      const match = value?.toString().match(regex);
      return match ? match[1] || match[0] : value;
    }
    return value;
  },
  
  transform: (value: string, params?: Record<string, any>) => {
    if (params?.mapping && typeof params.mapping === 'object') {
      return params.mapping[value] || value;
    }
    return value;
  },
  
  validate: (value: string, params?: Record<string, any>) => {
    if (params?.pattern) {
      const regex = new RegExp(params.pattern);
      return regex.test(value?.toString()) ? value : null;
    }
    return value;
  },
  
  anonymize: (value: string, params?: Record<string, any>) => {
    if (params?.method === 'hash') {
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(value?.toString() || '').digest('hex').substring(0, 8);
    }
    if (params?.method === 'replace') {
      return params.replacement || 'ANONYMIZED';
    }
    return value;
  },
};

/**
 * Advanced indexing service
 */
export class AdvancedIndexingService extends EventEmitter {
  private config: any;
  private fieldConfigs: Map<string, IndexingFieldConfig> = new Map();
  private activeJobs: Map<string, IndexingJob> = new Map();
  private indexStats: IndexStatistics | null = null;
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.config = configManager.getSection('indexing');
    this.initialize();
  }

  /**
   * Initialize the indexing service
   */
  private async initialize(): Promise<void> {
    if (!this.config.enabled) {
      this.emit('service:disabled');
      return;
    }

    try {
      // Load default field configurations
      await this.loadDefaultFieldConfigs();
      
      // Load custom field configurations
      await this.loadCustomFieldConfigs();
      
      this.isInitialized = true;
      this.emit('service:initialized');
    } catch (error) {
      this.emit('service:error', { operation: 'initialize', error });
      throw error;
    }
  }

  /**
   * Get all configured indexing fields
   */
  getIndexingFields(): IndexingFieldConfig[] {
    return Array.from(this.fieldConfigs.values());
  }

  /**
   * Get indexing fields for a specific specialty
   */
  getFieldsForSpecialty(specialty: string): IndexingFieldConfig[] {
    return this.getIndexingFields().filter(field => 
      !field.specialty || field.specialty.includes(specialty)
    );
  }

  /**
   * Add or update a field configuration
   */
  async updateFieldConfig(config: IndexingFieldConfig): Promise<void> {
    // Validate field configuration
    const validationErrors = this.validateFieldConfig(config);
    if (validationErrors.length > 0) {
      throw new Error(`Invalid field configuration: ${validationErrors.join(', ')}`);
    }

    this.fieldConfigs.set(config.tag, config);
    
    // Trigger reindexing for this field if already indexed
    if (config.indexed) {
      await this.scheduleFieldReindexing(config.tag);
    }

    this.emit('field:config_updated', { tag: config.tag, config });
  }

  /**
   * Remove a field configuration
   */
  async removeFieldConfig(tag: string): Promise<void> {
    const config = this.fieldConfigs.get(tag);
    if (!config) {
      throw new Error(`Field configuration not found: ${tag}`);
    }

    this.fieldConfigs.delete(tag);
    
    // Remove from index
    await this.removeFieldFromIndex(tag);
    
    this.emit('field:config_removed', { tag });
  }

  /**
   * Start a full indexing job
   */
  async startFullIndexing(config?: Partial<IndexingJobConfig>): Promise<string> {
    const jobConfig: IndexingJobConfig = {
      batchSize: config?.batchSize || this.config.batchSize,
      maxConcurrency: config?.maxConcurrency || this.config.maxConcurrentIndexing,
      enablePreprocessing: config?.enablePreprocessing ?? this.config.preprocessingEnabled,
      forceReindex: config?.forceReindex || false,
      organizationId: config?.organizationId,
      filters: config?.filters,
    };

    const job: IndexingJob = {
      id: this.generateJobId(),
      status: 'pending',
      type: 'full',
      progress: { processed: 0, total: 0, percentage: 0 },
      errors: [],
      config: jobConfig,
    };

    this.activeJobs.set(job.id, job);
    
    // Start the indexing process asynchronously
    this.executeIndexingJob(job.id).catch(error => {
      this.handleJobError(job.id, error);
    });

    this.emit('job:started', { jobId: job.id, type: job.type });
    return job.id;
  }

  /**
   * Start incremental indexing for new/modified data
   */
  async startIncrementalIndexing(
    since: Date,
    config?: Partial<IndexingJobConfig>
  ): Promise<string> {
    const jobConfig: IndexingJobConfig = {
      batchSize: config?.batchSize || this.config.batchSize,
      maxConcurrency: config?.maxConcurrency || this.config.maxConcurrentIndexing,
      enablePreprocessing: config?.enablePreprocessing ?? this.config.preprocessingEnabled,
      forceReindex: false,
      organizationId: config?.organizationId,
      filters: { ...config?.filters, modifiedSince: since.toISOString() },
    };

    const job: IndexingJob = {
      id: this.generateJobId(),
      status: 'pending',
      type: 'incremental',
      progress: { processed: 0, total: 0, percentage: 0 },
      errors: [],
      config: jobConfig,
    };

    this.activeJobs.set(job.id, job);
    
    // Start the indexing process asynchronously
    this.executeIndexingJob(job.id).catch(error => {
      this.handleJobError(job.id, error);
    });

    this.emit('job:started', { jobId: job.id, type: job.type });
    return job.id;
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): IndexingJob | null {
    return this.activeJobs.get(jobId) || null;
  }

  /**
   * Cancel a running job
   */
  async cancelJob(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      throw new Error(`Cannot cancel job in status: ${job.status}`);
    }

    job.status = 'cancelled';
    job.endTime = new Date();
    
    this.emit('job:cancelled', { jobId });
  }

  /**
   * Get index statistics
   */
  async getIndexStatistics(): Promise<IndexStatistics> {
    // In a real implementation, this would query the actual index
    // For now, return cached stats or generate mock data
    if (this.indexStats) {
      return this.indexStats;
    }

    // Generate mock statistics
    this.indexStats = {
      totalDocuments: 10000,
      totalFields: this.fieldConfigs.size,
      indexSize: '2.5 GB',
      lastUpdated: new Date(),
      indexingRate: 150, // documents per second
      fieldStatistics: this.generateMockFieldStatistics(),
    };

    return this.indexStats;
  }

  /**
   * Get field statistics for a specific field
   */
  async getFieldStatistics(tag: string): Promise<FieldStatistics | null> {
    const stats = await this.getIndexStatistics();
    return stats.fieldStatistics.find(fs => fs.field === tag) || null;
  }

  /**
   * Optimize index for better performance
   */
  async optimizeIndex(): Promise<void> {
    this.emit('index:optimization_started');
    
    try {
      // Index optimization logic would go here
      // For now, just simulate the process
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      this.emit('index:optimization_completed');
    } catch (error) {
      this.emit('index:optimization_failed', { error });
      throw error;
    }
  }

  /**
   * Backup index data
   */
  async backupIndex(destination: string): Promise<void> {
    this.emit('index:backup_started', { destination });
    
    try {
      // Backup logic would go here
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      this.emit('index:backup_completed', { destination });
    } catch (error) {
      this.emit('index:backup_failed', { destination, error });
      throw error;
    }
  }

  /**
   * Restore index from backup
   */
  async restoreIndex(source: string): Promise<void> {
    this.emit('index:restore_started', { source });
    
    try {
      // Restore logic would go here
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      // Clear current field configs and reload
      this.fieldConfigs.clear();
      await this.loadDefaultFieldConfigs();
      await this.loadCustomFieldConfigs();
      
      this.emit('index:restore_completed', { source });
    } catch (error) {
      this.emit('index:restore_failed', { source, error });
      throw error;
    }
  }

  /**
   * Process DICOM metadata through preprocessing pipeline
   */
  async preprocessMetadata(
    metadata: Record<string, any>,
    fieldConfig: IndexingFieldConfig
  ): Promise<any> {
    if (!fieldConfig.preprocessing || !this.config.preprocessingEnabled) {
      return metadata[fieldConfig.tag];
    }

    let value = metadata[fieldConfig.tag];
    
    // Sort preprocessing steps by order
    const sortedSteps = fieldConfig.preprocessing
      .filter(step => step.enabled)
      .sort((a, b) => a.order - b.order);

    for (const step of sortedSteps) {
      const processor = PREPROCESSING_FUNCTIONS[step.type];
      if (processor) {
        try {
          value = processor(value, step.params);
        } catch (error) {
          this.emit('preprocessing:error', {
            field: fieldConfig.tag,
            step: step.type,
            error: error.message,
          });
          // Continue with original value on error
          break;
        }
      }
    }

    return value;
  }

  /**
   * Load default field configurations
   */
  private async loadDefaultFieldConfigs(): Promise<void> {
    // Load standard DICOM tags
    Object.entries(STANDARD_DICOM_TAGS).forEach(([name, tag]) => {
      const config: IndexingFieldConfig = {
        tag,
        name: name.replace(/_/g, ' '),
        dataType: this.getDataTypeForTag(tag),
        indexed: true,
        searchable: true,
        faceted: true,
        weight: 1.0,
      };
      this.fieldConfigs.set(tag, config);
    });

    // Load specialty-specific configurations
    Object.values(SPECIALTY_FIELD_CONFIGS).flat().forEach(config => {
      this.fieldConfigs.set(config.tag, config);
    });
  }

  /**
   * Load custom field configurations from external source
   */
  private async loadCustomFieldConfigs(): Promise<void> {
    // Load custom fields from configuration
    if (this.config.customFields && Array.isArray(this.config.customFields)) {
      for (const fieldTag of this.config.customFields) {
        if (validateDicomTag(fieldTag) && !this.fieldConfigs.has(fieldTag)) {
          const config: IndexingFieldConfig = {
            tag: fieldTag,
            name: `Custom Field ${fieldTag}`,
            dataType: 'LO', // Default to Long String
            indexed: true,
            searchable: true,
            faceted: false,
            weight: 0.5,
          };
          this.fieldConfigs.set(fieldTag, config);
        }
      }
    }
  }

  /**
   * Validate field configuration
   */
  private validateFieldConfig(config: IndexingFieldConfig): string[] {
    const errors: string[] = [];

    if (!config.tag || !validateDicomTag(config.tag)) {
      errors.push('Invalid DICOM tag format');
    }

    if (!config.name || config.name.trim().length === 0) {
      errors.push('Field name is required');
    }

    if (!config.dataType || !DICOM_DATA_TYPES[config.dataType]) {
      errors.push('Invalid DICOM data type');
    }

    if (config.weight !== undefined && (config.weight < 0 || config.weight > 1)) {
      errors.push('Weight must be between 0 and 1');
    }

    if (config.preprocessing) {
      config.preprocessing.forEach((step, index) => {
        if (!PREPROCESSING_FUNCTIONS[step.type]) {
          errors.push(`Invalid preprocessing type at step ${index + 1}: ${step.type}`);
        }
        if (step.order < 0) {
          errors.push(`Invalid preprocessing order at step ${index + 1}`);
        }
      });
    }

    return errors;
  }

  /**
   * Execute an indexing job
   */
  private async executeIndexingJob(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    job.status = 'running';
    job.startTime = new Date();
    
    try {
      // Simulate indexing process
      const totalItems = 1000; // This would come from actual data source
      job.progress.total = totalItems;

      for (let i = 0; i < totalItems; i++) {
        if (job.status === 'cancelled') {
          break;
        }

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 10));
        
        job.progress.processed = i + 1;
        job.progress.percentage = Math.round((job.progress.processed / job.progress.total) * 100);
        
        if (i % 100 === 0) {
          this.emit('job:progress', { jobId, progress: job.progress });
        }
      }

      if (job.status !== 'cancelled') {
        job.status = 'completed';
        this.emit('job:completed', { jobId });
      }

    } catch (error) {
      job.status = 'failed';
      job.errors.push(error.message);
      this.emit('job:failed', { jobId, error: error.message });
      throw error;
    } finally {
      job.endTime = new Date();
    }
  }

  /**
   * Handle job errors
   */
  private handleJobError(jobId: string, error: Error): void {
    const job = this.activeJobs.get(jobId);
    if (job) {
      job.status = 'failed';
      job.errors.push(error.message);
      job.endTime = new Date();
    }
    
    this.emit('job:error', { jobId, error: error.message });
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Schedule field reindexing
   */
  private async scheduleFieldReindexing(tag: string): Promise<void> {
    // Implementation would schedule reindexing for specific field
    this.emit('field:reindex_scheduled', { tag });
  }

  /**
   * Remove field from index
   */
  private async removeFieldFromIndex(tag: string): Promise<void> {
    // Implementation would remove field from actual index
    this.emit('field:removed_from_index', { tag });
  }

  /**
   * Get data type for DICOM tag
   */
  private getDataTypeForTag(tag: string): keyof typeof DICOM_DATA_TYPES {
    // Common data type mappings
    const dataTypes: Record<string, keyof typeof DICOM_DATA_TYPES> = {
      [STANDARD_DICOM_TAGS.PATIENT_ID]: 'LO',
      [STANDARD_DICOM_TAGS.PATIENT_NAME]: 'PN',
      [STANDARD_DICOM_TAGS.STUDY_DATE]: 'DA',
      [STANDARD_DICOM_TAGS.STUDY_TIME]: 'TM',
      [STANDARD_DICOM_TAGS.MODALITY]: 'CS',
    };
    
    return dataTypes[tag] || 'LO';
  }

  /**
   * Generate mock field statistics
   */
  private generateMockFieldStatistics(): FieldStatistics[] {
    return Array.from(this.fieldConfigs.values()).map(config => ({
      field: config.tag,
      uniqueValues: Math.floor(Math.random() * 1000) + 10,
      nullValues: Math.floor(Math.random() * 100),
      avgLength: Math.floor(Math.random() * 50) + 5,
      mostCommonValues: [
        { value: 'Value1', count: Math.floor(Math.random() * 500) + 100 },
        { value: 'Value2', count: Math.floor(Math.random() * 300) + 50 },
        { value: 'Value3', count: Math.floor(Math.random() * 200) + 25 },
      ],
    }));
  }
}

/**
 * Global advanced indexing service instance
 */
export const advancedIndexingService = new AdvancedIndexingService();