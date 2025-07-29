/**
 * Tests for Dicoogle Metadata Filtering Plugin
 */

import { metadataFilteringService } from '../src/plugins/metadata-filter';
import { 
  ComplexFilter, 
  FilterCondition, 
  QueryOperator, 
  LogicalOperator,
  PaginationParams,
  SortParams 
} from '../src/utils';

describe('Metadata Filtering Plugin', () => {
  const mockContext = {
    userId: 'test-user',
    userRoles: ['provider'],
    organizationId: 'test-org',
    timestamp: Date.now(),
    queryId: 'test-query-123',
  };

  describe('Filter Building', () => {
    test('should build simple filter correctly', () => {
      const filter = metadataFilteringService.buildSimpleFilter(
        '00100020', // Patient ID
        QueryOperator.EQUALS,
        'PAT123'
      );

      expect(filter).toBeDefined();
      expect(filter.conditions).toHaveLength(1);
      expect(filter.conditions[0].field).toBe('00100020');
      expect(filter.conditions[0].operator).toBe(QueryOperator.EQUALS);
      expect(filter.conditions[0].value).toBe('PAT123');
      expect(filter.logical).toBe(LogicalOperator.AND);
    });

    test('should combine multiple filters', () => {
      const filter1 = metadataFilteringService.buildSimpleFilter(
        '00100020', // Patient ID
        QueryOperator.EQUALS,
        'PAT123'
      );

      const filter2 = metadataFilteringService.buildSimpleFilter(
        '00080060', // Modality
        QueryOperator.EQUALS,
        'CT'
      );

      const combinedFilter = metadataFilteringService.combineFilters(
        [filter1, filter2],
        LogicalOperator.AND
      );

      expect(combinedFilter).toBeDefined();
      expect(combinedFilter.groups).toHaveLength(2);
      expect(combinedFilter.logical).toBe(LogicalOperator.AND);
    });

    test('should validate filter input correctly', () => {
      const validFilter: ComplexFilter = {
        conditions: [{
          field: '00100020',
          operator: QueryOperator.EQUALS,
          value: 'PAT123',
        }],
        logical: LogicalOperator.AND,
      };

      const validation = metadataFilteringService.validateUserInput(validFilter);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should reject invalid filter input', () => {
      const invalidFilter = {
        conditions: [{
          field: 'invalid-tag',
          operator: 'INVALID_OPERATOR',
          value: 'test',
        }],
        logical: 'INVALID_LOGICAL',
      };

      const validation = metadataFilteringService.validateUserInput(invalidFilter);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Filter Templates', () => {
    test('should return available filter templates', () => {
      const templates = metadataFilteringService.getFilterTemplates();
      
      expect(templates).toBeDefined();
      expect(Object.keys(templates).length).toBeGreaterThan(0);
      expect(templates.TODAY_STUDIES).toBeDefined();
      expect(templates.CT_STUDIES).toBeDefined();
    });

    test('should create filter from template', () => {
      const filter = metadataFilteringService.createFilterFromTemplate('CT_STUDIES');
      
      expect(filter).toBeDefined();
      expect(filter.conditions).toHaveLength(1);
      expect(filter.conditions[0].value).toBe('CT');
    });

    test('should create filter from template with overrides', () => {
      const overrides = {
        conditions: [{
          field: '00080060',
          operator: QueryOperator.EQUALS,
          value: 'MR',
        }],
      };

      const filter = metadataFilteringService.createFilterFromTemplate(
        'CT_STUDIES',
        overrides
      );
      
      expect(filter).toBeDefined();
      expect(filter.conditions).toHaveLength(1);
      expect(filter.conditions[0].value).toBe('MR');
    });
  });

  describe('Query Execution', () => {
    test('should execute basic filter query', async () => {
      const filter: ComplexFilter = {
        conditions: [{
          field: '00100020',
          operator: QueryOperator.EQUALS,
          value: 'PAT123',
        }],
        logical: LogicalOperator.AND,
      };

      const result = await metadataFilteringService.executeFilter(
        filter,
        mockContext
      );

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.totalCount).toBeGreaterThanOrEqual(0);
      expect(result.filter).toEqual(filter);
    });

    test('should execute filter query with pagination', async () => {
      const filter: ComplexFilter = {
        conditions: [{
          field: '00080060',
          operator: QueryOperator.EQUALS,
          value: 'CT',
        }],
        logical: LogicalOperator.AND,
      };

      const pagination: PaginationParams = {
        page: 1,
        limit: 10,
      };

      const result = await metadataFilteringService.executeFilter(
        filter,
        mockContext,
        pagination
      );

      expect(result).toBeDefined();
      expect(result.data.length).toBeLessThanOrEqual(10);
      expect(result.pagination).toEqual(pagination);
      expect(result.metadata.currentPage).toBe(1);
    });

    test('should execute filter query with sorting', async () => {
      const filter: ComplexFilter = {
        conditions: [{
          field: '00080060',
          operator: QueryOperator.EQUALS,
          value: 'CT',
        }],
        logical: LogicalOperator.AND,
      };

      const sort: SortParams = {
        field: 'studyDate',
        direction: 'DESC',
      };

      const result = await metadataFilteringService.executeFilter(
        filter,
        mockContext,
        undefined,
        sort
      );

      expect(result).toBeDefined();
      expect(result.sort).toEqual(sort);
    });

    test('should handle complex filter with multiple conditions', async () => {
      const filter: ComplexFilter = {
        conditions: [
          {
            field: '00080060',
            operator: QueryOperator.EQUALS,
            value: 'CT',
          },
          {
            field: '00080020',
            operator: QueryOperator.RANGE,
            value: { start: '20240101', end: '20240131' },
          },
        ],
        logical: LogicalOperator.AND,
      };

      const result = await metadataFilteringService.executeFilter(
        filter,
        mockContext
      );

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.filter).toEqual(filter);
    });
  });

  describe('Utility Functions', () => {
    test('should return supported operators', () => {
      const operators = metadataFilteringService.getSupportedOperators();
      
      expect(operators).toBeDefined();
      expect(operators.length).toBeGreaterThan(0);
      expect(operators).toContain(QueryOperator.EQUALS);
      expect(operators).toContain(QueryOperator.CONTAINS);
    });

    test('should return standard DICOM tags', () => {
      const tags = metadataFilteringService.getStandardDicomTags();
      
      expect(tags).toBeDefined();
      expect(Object.keys(tags).length).toBeGreaterThan(0);
      expect(tags.PATIENT_ID).toBeDefined();
      expect(tags.STUDY_INSTANCE_UID).toBeDefined();
    });

    test('should return supported modalities', () => {
      const modalities = metadataFilteringService.getSupportedModalities();
      
      expect(modalities).toBeDefined();
      expect(Object.keys(modalities).length).toBeGreaterThan(0);
      expect(modalities.CT).toBeDefined();
      expect(modalities.MR).toBeDefined();
    });

    test('should generate filter suggestions', async () => {
      const suggestions = await metadataFilteringService.generateFilterSuggestions(
        'patient',
        mockContext
      );

      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    test('should throw error for invalid filter', async () => {
      const invalidFilter = {
        conditions: [],
        logical: LogicalOperator.AND,
      } as ComplexFilter;

      await expect(
        metadataFilteringService.executeFilter(invalidFilter, mockContext)
      ).rejects.toThrow();
    });

    test('should handle unknown filter template', () => {
      expect(() => {
        metadataFilteringService.createFilterFromTemplate('UNKNOWN_TEMPLATE' as any);
      }).toThrow();
    });

    test('should validate filter conditions', () => {
      expect(() => {
        metadataFilteringService.buildSimpleFilter(
          'invalid-tag',
          QueryOperator.EQUALS,
          'value'
        );
      }).toThrow();
    });
  });
});