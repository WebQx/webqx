/**
 * API Routes for Dicoogle Metadata Filtering
 * 
 * RESTful endpoints for advanced DICOM metadata filtering and query operations
 */

import { Router } from 'express';
import { 
  AuthenticatedRequest,
  requirePermissions,
  requireOrganizationAccess,
  rateLimit,
  auditLog,
  validateRequest,
} from '../middleware/auth';
import { 
  metadataFilteringService,
  QueryResult,
  FILTER_TEMPLATES,
} from '../../plugins/metadata-filter';
import { 
  ComplexFilter,
  PaginationParams,
  SortParams,
  QueryOperator,
  LogicalOperator,
} from '../../utils';

const router = Router();

/**
 * Get supported query operators
 */
router.get('/operators',
  requirePermissions('pacs:query:basic'),
  auditLog('get_query_operators'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const operators = metadataFilteringService.getSupportedOperators();
      res.json({
        success: true,
        data: operators.map(op => ({
          value: op,
          label: op.replace(/_/g, ' ').toLowerCase(),
        })),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'GET_OPERATORS_ERROR',
      });
    }
  }
);

/**
 * Get standard DICOM tags for filtering
 */
router.get('/tags',
  requirePermissions('pacs:query:basic'),
  auditLog('get_dicom_tags'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const tags = metadataFilteringService.getStandardDicomTags();
      res.json({
        success: true,
        data: Object.entries(tags).map(([name, tag]) => ({
          tag,
          name: name.replace(/_/g, ' '),
          label: name.replace(/_/g, ' ').toLowerCase(),
        })),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'GET_TAGS_ERROR',
      });
    }
  }
);

/**
 * Get supported modalities
 */
router.get('/modalities',
  requirePermissions('pacs:query:basic'),
  auditLog('get_modalities'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const modalities = metadataFilteringService.getSupportedModalities();
      res.json({
        success: true,
        data: Object.entries(modalities).map(([code, description]) => ({
          code,
          description,
        })),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'GET_MODALITIES_ERROR',
      });
    }
  }
);

/**
 * Get available filter templates
 */
router.get('/templates',
  requirePermissions('pacs:query:basic'),
  auditLog('get_filter_templates'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const templates = metadataFilteringService.getFilterTemplates();
      res.json({
        success: true,
        data: Object.entries(templates).map(([name, filter]) => ({
          name,
          label: name.replace(/_/g, ' ').toLowerCase(),
          filter,
        })),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'GET_TEMPLATES_ERROR',
      });
    }
  }
);

/**
 * Execute a filter query
 */
router.post('/query',
  requirePermissions('pacs:query:basic'),
  requireOrganizationAccess,
  rateLimit({ windowMs: 900000, maxRequests: 100 }), // 100 requests per 15 minutes
  auditLog('execute_filter_query'),
  validateRequest({
    required: ['filter'],
    types: {
      filter: 'object',
      pagination: 'object',
      sort: 'object',
    }
  }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { filter, pagination, sort } = req.body;

      // Validate filter
      const validation = metadataFilteringService.validateUserInput(filter);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid filter configuration',
          code: 'INVALID_FILTER',
          details: validation.errors,
        });
      }

      // Create execution context
      const context = {
        userId: req.user!.userId,
        userRoles: req.user!.roles,
        organizationId: req.organizationId,
        timestamp: Date.now(),
        queryId: req.requestId,
      };

      // Execute the filter
      const result = await metadataFilteringService.executeFilter(
        filter as ComplexFilter,
        context,
        pagination as PaginationParams,
        sort as SortParams
      );

      res.json({
        success: true,
        data: result.data,
        metadata: result.metadata,
        filter: result.filter,
        pagination: result.pagination,
        sort: result.sort,
      });

    } catch (error) {
      const statusCode = error.message.includes('permissions') ? 403 : 500;
      res.status(statusCode).json({
        success: false,
        error: error.message,
        code: 'QUERY_EXECUTION_ERROR',
      });
    }
  }
);

/**
 * Execute advanced query with complex filtering
 */
router.post('/query/advanced',
  requirePermissions('pacs:query:advanced'),
  requireOrganizationAccess,
  rateLimit({ windowMs: 900000, maxRequests: 50 }), // 50 requests per 15 minutes
  auditLog('execute_advanced_query'),
  validateRequest({
    required: ['filter'],
    types: {
      filter: 'object',
      pagination: 'object',
      sort: 'object',
    }
  }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { filter, pagination, sort, options } = req.body;

      // Advanced queries support additional options
      const enhancedContext = {
        userId: req.user!.userId,
        userRoles: req.user!.roles,
        organizationId: req.organizationId,
        timestamp: Date.now(),
        queryId: req.requestId,
        options: options || {},
      };

      const result = await metadataFilteringService.executeFilter(
        filter as ComplexFilter,
        enhancedContext,
        pagination as PaginationParams,
        sort as SortParams
      );

      res.json({
        success: true,
        data: result.data,
        metadata: result.metadata,
        filter: result.filter,
        pagination: result.pagination,
        sort: result.sort,
        executionContext: {
          queryId: enhancedContext.queryId,
          executionTime: result.metadata.executionTimeMs,
          cacheHit: result.metadata.cacheHit,
        },
      });

    } catch (error) {
      const statusCode = error.message.includes('permissions') ? 403 : 500;
      res.status(statusCode).json({
        success: false,
        error: error.message,
        code: 'ADVANCED_QUERY_ERROR',
      });
    }
  }
);

/**
 * Build filter from template
 */
router.post('/templates/:templateName',
  requirePermissions('pacs:query:basic'),
  auditLog('create_filter_from_template'),
  validateRequest({
    types: {
      overrides: 'object',
    }
  }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { templateName } = req.params;
      const { overrides } = req.body;

      if (!FILTER_TEMPLATES[templateName as keyof typeof FILTER_TEMPLATES]) {
        return res.status(404).json({
          success: false,
          error: `Template not found: ${templateName}`,
          code: 'TEMPLATE_NOT_FOUND',
        });
      }

      const filter = metadataFilteringService.createFilterFromTemplate(
        templateName as keyof typeof FILTER_TEMPLATES,
        overrides
      );

      res.json({
        success: true,
        data: {
          templateName,
          filter,
          overrides,
        },
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'TEMPLATE_CREATE_ERROR',
      });
    }
  }
);

/**
 * Build simple filter
 */
router.post('/build/simple',
  requirePermissions('pacs:query:basic'),
  auditLog('build_simple_filter'),
  validateRequest({
    required: ['field', 'operator', 'value'],
    types: {
      field: 'string',
      operator: 'string',
      value: 'string',
      dataType: 'string',
    }
  }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { field, operator, value, dataType } = req.body;

      // Validate operator
      if (!Object.values(QueryOperator).includes(operator)) {
        return res.status(400).json({
          success: false,
          error: `Invalid operator: ${operator}`,
          code: 'INVALID_OPERATOR',
        });
      }

      const filter = metadataFilteringService.buildSimpleFilter(
        field,
        operator as QueryOperator,
        value,
        dataType
      );

      res.json({
        success: true,
        data: {
          filter,
          input: { field, operator, value, dataType },
        },
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'SIMPLE_FILTER_BUILD_ERROR',
      });
    }
  }
);

/**
 * Combine multiple filters
 */
router.post('/build/combine',
  requirePermissions('pacs:query:advanced'),
  auditLog('combine_filters'),
  validateRequest({
    required: ['filters', 'logical'],
    types: {
      filters: 'object',
      logical: 'string',
    }
  }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { filters, logical } = req.body;

      // Validate logical operator
      if (!Object.values(LogicalOperator).includes(logical)) {
        return res.status(400).json({
          success: false,
          error: `Invalid logical operator: ${logical}`,
          code: 'INVALID_LOGICAL_OPERATOR',
        });
      }

      // Validate filters array
      if (!Array.isArray(filters) || filters.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Filters must be a non-empty array',
          code: 'INVALID_FILTERS_ARRAY',
        });
      }

      const combinedFilter = metadataFilteringService.combineFilters(
        filters as ComplexFilter[],
        logical as LogicalOperator
      );

      res.json({
        success: true,
        data: {
          combinedFilter,
          input: { filters, logical },
        },
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'FILTER_COMBINE_ERROR',
      });
    }
  }
);

/**
 * Validate filter configuration
 */
router.post('/validate',
  requirePermissions('pacs:query:basic'),
  auditLog('validate_filter'),
  validateRequest({
    required: ['filter'],
    types: {
      filter: 'object',
    }
  }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { filter } = req.body;

      const validation = metadataFilteringService.validateUserInput(filter);

      res.json({
        success: true,
        data: {
          isValid: validation.isValid,
          errors: validation.errors,
          filter,
        },
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'FILTER_VALIDATION_ERROR',
      });
    }
  }
);

/**
 * Get filter suggestions for autocomplete
 */
router.get('/suggestions',
  requirePermissions('pacs:query:basic'),
  auditLog('get_filter_suggestions'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { partial = '' } = req.query;

      const context = {
        userId: req.user!.userId,
        userRoles: req.user!.roles,
        organizationId: req.organizationId,
        timestamp: Date.now(),
        queryId: req.requestId,
      };

      const suggestions = await metadataFilteringService.generateFilterSuggestions(
        partial as string,
        context
      );

      res.json({
        success: true,
        data: suggestions,
        query: { partial },
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'SUGGESTIONS_ERROR',
      });
    }
  }
);

/**
 * Get query statistics
 */
router.get('/statistics',
  requirePermissions('pacs:system:monitor'),
  auditLog('get_query_statistics'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { startDate, endDate } = req.query;

      const timeRange = {
        start: startDate ? new Date(startDate as string) : new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate as string) : new Date(),
      };

      const context = {
        userId: req.user!.userId,
        userRoles: req.user!.roles,
        organizationId: req.organizationId,
        timestamp: Date.now(),
        queryId: req.requestId,
      };

      const statistics = await metadataFilteringService.getQueryStatistics(timeRange, context);

      res.json({
        success: true,
        data: statistics,
        timeRange,
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'STATISTICS_ERROR',
      });
    }
  }
);

export default router;