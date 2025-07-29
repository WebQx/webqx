/**
 * Metadata Filtering Plugin for Dicoogle PACS
 * 
 * Provides dynamic filtering of DICOM metadata with advanced query capabilities
 * Supports complex logical operations and user-friendly interface
 */

import { EventEmitter } from 'events';
import { configManager } from '../../config';
import { cachingService } from '../caching';
import {
  ComplexFilter,
  FilterCondition,
  QueryOperator,
  LogicalOperator,
  PaginationParams,
  SortParams,
  QueryResultMetadata,
  validateComplexFilter,
  validateFilterCondition,
  sanitizeInput,
  STANDARD_DICOM_TAGS,
} from '../../utils';

/**
 * Query result interface
 */
export interface QueryResult<T = any> {
  data: T[];
  metadata: QueryResultMetadata;
  filter: ComplexFilter;
  pagination?: PaginationParams;
  sort?: SortParams;
}

/**
 * Filter execution context
 */
interface FilterExecutionContext {
  userId: string;
  userRoles: string[];
  organizationId?: string;
  timestamp: number;
  queryId: string;
}

/**
 * Supported modalities for specialty-specific filtering
 */
export const SUPPORTED_MODALITIES = {
  CR: 'Computed Radiography',
  CT: 'Computed Tomography',
  MR: 'Magnetic Resonance',
  US: 'Ultrasound',
  XA: 'X-Ray Angiography',
  RF: 'Radiofluoroscopy',
  DX: 'Digital Radiography',
  MG: 'Mammography',
  PT: 'Positron Emission Tomography',
  NM: 'Nuclear Medicine',
  ES: 'Endoscopy',
  OP: 'Ophthalmic Photography',
  SC: 'Secondary Capture',
  OT: 'Other',
} as const;

/**
 * Pre-defined filter templates for common use cases
 */
export const FILTER_TEMPLATES = {
  TODAY_STUDIES: {
    conditions: [{
      field: STANDARD_DICOM_TAGS.STUDY_DATE,
      operator: QueryOperator.EQUALS,
      value: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
    }],
    logical: LogicalOperator.AND,
  },
  RECENT_STUDIES: {
    conditions: [{
      field: STANDARD_DICOM_TAGS.STUDY_DATE,
      operator: QueryOperator.RANGE,
      value: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10).replace(/-/g, ''),
        end: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
      },
    }],
    logical: LogicalOperator.AND,
  },
  CT_STUDIES: {
    conditions: [{
      field: STANDARD_DICOM_TAGS.MODALITY,
      operator: QueryOperator.EQUALS,
      value: 'CT',
    }],
    logical: LogicalOperator.AND,
  },
  MR_STUDIES: {
    conditions: [{
      field: STANDARD_DICOM_TAGS.MODALITY,
      operator: QueryOperator.EQUALS,
      value: 'MR',
    }],
    logical: LogicalOperator.AND,
  },
  EMERGENCY_STUDIES: {
    conditions: [{
      field: STANDARD_DICOM_TAGS.STUDY_DESCRIPTION,
      operator: QueryOperator.CONTAINS,
      value: 'EMERGENCY',
    }],
    logical: LogicalOperator.AND,
  },
} as const;

/**
 * Main metadata filtering service
 */
export class MetadataFilteringService extends EventEmitter {
  private config: any;
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.config = configManager.getSection('filtering');
    this.initialize();
  }

  /**
   * Initialize the filtering service
   */
  private async initialize(): Promise<void> {
    if (!this.config.enabled) {
      this.emit('service:disabled');
      return;
    }

    try {
      // Initialize any required connections or resources
      this.isInitialized = true;
      this.emit('service:initialized');
    } catch (error) {
      this.emit('service:error', { operation: 'initialize', error });
      throw error;
    }
  }

  /**
   * Execute a complex filter query
   */
  async executeFilter(
    filter: ComplexFilter,
    context: FilterExecutionContext,
    pagination?: PaginationParams,
    sort?: SortParams
  ): Promise<QueryResult> {
    if (!this.isInitialized) {
      throw new Error('Filtering service not initialized');
    }

    const startTime = Date.now();
    
    try {
      // Validate filter
      const validationErrors = validateComplexFilter(filter);
      if (validationErrors.length > 0) {
        throw new Error(`Filter validation failed: ${validationErrors.join(', ')}`);
      }

      // Check user permissions
      await this.checkUserPermissions(context, filter);

      // Try to get cached result first
      const cacheKey = this.generateCacheKey(filter, pagination, sort, context);
      let cachedResult = await cachingService.getCachedQueryResult(filter, pagination, sort);
      
      if (cachedResult) {
        this.emit('query:cache_hit', { queryId: context.queryId, cacheKey });
        return {
          ...cachedResult,
          metadata: {
            ...cachedResult.metadata,
            cacheHit: true,
            executionTimeMs: Date.now() - startTime,
          }
        };
      }

      // Execute the actual query
      const result = await this.performQuery(filter, pagination, sort, context);
      
      // Cache the result
      if (this.config.cacheEnabled) {
        await cachingService.cacheQueryResult(
          filter,
          pagination,
          sort,
          result,
          this.config.cacheTimeoutMs / 1000
        );
      }

      const executionTime = Date.now() - startTime;
      this.emit('query:executed', {
        queryId: context.queryId,
        executionTimeMs: executionTime,
        resultCount: result.data.length,
        cached: false,
      });

      return {
        ...result,
        metadata: {
          ...result.metadata,
          executionTimeMs: executionTime,
          cacheHit: false,
        }
      };

    } catch (error) {
      this.emit('query:error', {
        queryId: context.queryId,
        error: error.message,
        filter,
      });
      throw error;
    }
  }

  /**
   * Get available filter templates
   */
  getFilterTemplates(): Record<string, ComplexFilter> {
    return { ...FILTER_TEMPLATES };
  }

  /**
   * Create a filter from template
   */
  createFilterFromTemplate(templateName: keyof typeof FILTER_TEMPLATES, overrides?: Partial<ComplexFilter>): ComplexFilter {
    const template = FILTER_TEMPLATES[templateName];
    if (!template) {
      throw new Error(`Unknown filter template: ${templateName}`);
    }

    return {
      ...template,
      ...overrides,
    };
  }

  /**
   * Build a simple filter condition
   */
  buildSimpleFilter(
    field: string,
    operator: QueryOperator,
    value: any,
    dataType?: string
  ): ComplexFilter {
    const condition: FilterCondition = {
      field: sanitizeInput(field),
      operator,
      value: this.sanitizeValue(value),
      dataType: dataType as any,
    };

    const validationErrors = validateFilterCondition(condition);
    if (validationErrors.length > 0) {
      throw new Error(`Invalid filter condition: ${validationErrors.join(', ')}`);
    }

    return {
      conditions: [condition],
      logical: LogicalOperator.AND,
    };
  }

  /**
   * Combine multiple filters with logical operators
   */
  combineFilters(filters: ComplexFilter[], logical: LogicalOperator): ComplexFilter {
    if (filters.length === 0) {
      throw new Error('At least one filter is required');
    }

    if (filters.length === 1) {
      return filters[0];
    }

    return {
      conditions: [],
      logical,
      groups: filters,
    };
  }

  /**
   * Get supported query operators
   */
  getSupportedOperators(): QueryOperator[] {
    return Object.values(QueryOperator);
  }

  /**
   * Get standard DICOM tags for filtering
   */
  getStandardDicomTags(): Record<string, string> {
    return { ...STANDARD_DICOM_TAGS };
  }

  /**
   * Get supported modalities
   */
  getSupportedModalities(): Record<string, string> {
    return { ...SUPPORTED_MODALITIES };
  }

  /**
   * Validate user input for filter creation
   */
  validateUserInput(input: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      if (!input || typeof input !== 'object') {
        errors.push('Invalid input format');
        return { isValid: false, errors };
      }

      // Validate as ComplexFilter
      const validationErrors = validateComplexFilter(input as ComplexFilter);
      errors.push(...validationErrors);

      return {
        isValid: errors.length === 0,
        errors,
      };
    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
      return { isValid: false, errors };
    }
  }

  /**
   * Generate suggestions for filter autocomplete
   */
  async generateFilterSuggestions(
    partialField: string,
    context: FilterExecutionContext
  ): Promise<Array<{ field: string; label: string; dataType: string; }>> {
    const suggestions: Array<{ field: string; label: string; dataType: string; }> = [];
    
    // Add standard DICOM tags that match the partial input
    Object.entries(STANDARD_DICOM_TAGS).forEach(([name, tag]) => {
      if (name.toLowerCase().includes(partialField.toLowerCase()) || 
          tag.includes(partialField)) {
        suggestions.push({
          field: tag,
          label: name.replace(/_/g, ' ').toLowerCase(),
          dataType: this.getDataTypeForTag(tag),
        });
      }
    });

    // Limit suggestions for performance
    return suggestions.slice(0, 20);
  }

  /**
   * Get query statistics
   */
  async getQueryStatistics(
    timeRange: { start: Date; end: Date },
    context: FilterExecutionContext
  ): Promise<{
    totalQueries: number;
    avgExecutionTime: number;
    cacheHitRate: number;
    mostUsedFilters: Array<{ filter: string; count: number; }>;
  }> {
    // This would integrate with the audit/analytics system
    // For now, return mock data
    return {
      totalQueries: 0,
      avgExecutionTime: 0,
      cacheHitRate: 0,
      mostUsedFilters: [],
    };
  }

  /**
   * Check user permissions for filter execution
   */
  private async checkUserPermissions(
    context: FilterExecutionContext,
    filter: ComplexFilter
  ): Promise<void> {
    const securityConfig = configManager.getSection('security');
    
    if (!securityConfig.enableRoleBasedAccess) {
      return; // RBAC disabled
    }

    // Check if user has required roles
    const hasValidRole = context.userRoles.some(role => 
      securityConfig.allowedRoles.includes(role)
    );

    if (!hasValidRole) {
      throw new Error('Insufficient permissions to execute this filter');
    }

    // Additional permission checks could be added here
    // e.g., field-level permissions, organization-level access, etc.
  }

  /**
   * Perform the actual query execution
   */
  private async performQuery(
    filter: ComplexFilter,
    pagination?: PaginationParams,
    sort?: SortParams,
    context?: FilterExecutionContext
  ): Promise<QueryResult> {
    // This is where the actual Dicoogle API integration would happen
    // For now, we'll return mock data that represents the expected structure
    
    const mockData = this.generateMockData(filter, pagination);
    const totalCount = mockData.length;
    
    // Apply pagination
    let paginatedData = mockData;
    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit;
      paginatedData = mockData.slice(offset, offset + pagination.limit);
    }

    // Apply sorting
    if (sort) {
      paginatedData = this.applySorting(paginatedData, sort);
    }

    const metadata: QueryResultMetadata = {
      totalCount,
      pageCount: pagination ? Math.ceil(totalCount / pagination.limit) : 1,
      currentPage: pagination?.page || 1,
      hasNextPage: pagination ? (pagination.page * pagination.limit) < totalCount : false,
      hasPreviousPage: pagination ? pagination.page > 1 : false,
      executionTimeMs: 0, // Will be set by caller
      cacheHit: false,
    };

    return {
      data: paginatedData,
      metadata,
      filter,
      pagination,
      sort,
    };
  }

  /**
   * Generate cache key for the query
   */
  private generateCacheKey(
    filter: ComplexFilter,
    pagination?: PaginationParams,
    sort?: SortParams,
    context?: FilterExecutionContext
  ): string {
    const keyData = {
      filter,
      pagination,
      sort,
      userId: context?.userId,
      organizationId: context?.organizationId,
    };
    
    return JSON.stringify(keyData);
  }

  /**
   * Sanitize filter values
   */
  private sanitizeValue(value: any): any {
    if (typeof value === 'string') {
      return sanitizeInput(value);
    }
    
    if (Array.isArray(value)) {
      return value.map(v => this.sanitizeValue(v));
    }
    
    if (value && typeof value === 'object') {
      const sanitized: any = {};
      Object.keys(value).forEach(key => {
        sanitized[key] = this.sanitizeValue(value[key]);
      });
      return sanitized;
    }
    
    return value;
  }

  /**
   * Get data type for a DICOM tag
   */
  private getDataTypeForTag(tag: string): string {
    // This would normally look up the data type from a DICOM dictionary
    // For now, return common types based on common tags
    const commonTypes: Record<string, string> = {
      [STANDARD_DICOM_TAGS.PATIENT_ID]: 'LO',
      [STANDARD_DICOM_TAGS.PATIENT_NAME]: 'PN',
      [STANDARD_DICOM_TAGS.STUDY_DATE]: 'DA',
      [STANDARD_DICOM_TAGS.STUDY_TIME]: 'TM',
      [STANDARD_DICOM_TAGS.MODALITY]: 'CS',
      [STANDARD_DICOM_TAGS.STUDY_DESCRIPTION]: 'LO',
    };
    
    return commonTypes[tag] || 'LO';
  }

  /**
   * Generate mock data for testing
   */
  private generateMockData(filter: ComplexFilter, pagination?: PaginationParams): any[] {
    // Generate mock DICOM study data
    const mockStudies = [];
    const studyCount = pagination?.limit || 50;
    
    for (let i = 0; i < studyCount; i++) {
      mockStudies.push({
        studyInstanceUID: `1.2.3.4.5.${Date.now()}.${i}`,
        patientID: `PAT${String(i).padStart(4, '0')}`,
        patientName: `Patient^Test${i}`,
        studyDate: '20240115',
        studyTime: '120000',
        modality: 'CT',
        studyDescription: 'Test Study',
        seriesCount: Math.floor(Math.random() * 5) + 1,
        instanceCount: Math.floor(Math.random() * 100) + 10,
      });
    }
    
    return mockStudies;
  }

  /**
   * Apply sorting to query results
   */
  private applySorting(data: any[], sort: SortParams): any[] {
    return data.sort((a, b) => {
      const aValue = a[sort.field];
      const bValue = b[sort.field];
      
      if (aValue < bValue) {
        return sort.direction === 'ASC' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sort.direction === 'ASC' ? 1 : -1;
      }
      return 0;
    });
  }
}

/**
 * Global metadata filtering service instance
 */
export const metadataFilteringService = new MetadataFilteringService();