/**
 * API Routes for Dicoogle Advanced Indexing
 * 
 * RESTful endpoints for managing custom DICOM metadata indexing
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
  advancedIndexingService,
  IndexingFieldConfig,
  IndexingJobConfig,
  PreprocessingConfig,
} from '../../plugins/advanced-indexing';

const router = Router();

/**
 * Get all indexing field configurations
 */
router.get('/fields',
  requirePermissions('pacs:index:read'),
  auditLog('get_indexing_fields'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { specialty } = req.query;

      let fields;
      if (specialty) {
        fields = advancedIndexingService.getFieldsForSpecialty(specialty as string);
      } else {
        fields = advancedIndexingService.getIndexingFields();
      }

      res.json({
        success: true,
        data: fields,
        total: fields.length,
        filter: { specialty },
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'GET_FIELDS_ERROR',
      });
    }
  }
);

/**
 * Get indexing field configuration by tag
 */
router.get('/fields/:tag',
  requirePermissions('pacs:index:read'),
  auditLog('get_indexing_field'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { tag } = req.params;
      
      const fields = advancedIndexingService.getIndexingFields();
      const field = fields.find(f => f.tag === tag);

      if (!field) {
        return res.status(404).json({
          success: false,
          error: `Field configuration not found: ${tag}`,
          code: 'FIELD_NOT_FOUND',
        });
      }

      res.json({
        success: true,
        data: field,
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'GET_FIELD_ERROR',
      });
    }
  }
);

/**
 * Create or update indexing field configuration
 */
router.put('/fields/:tag',
  requirePermissions('pacs:index:configure'),
  auditLog('update_indexing_field'),
  validateRequest({
    required: ['name', 'dataType'],
    types: {
      name: 'string',
      dataType: 'string',
      indexed: 'boolean',
      searchable: 'boolean',
      faceted: 'boolean',
      weight: 'number',
    }
  }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { tag } = req.params;
      const { 
        name, 
        dataType, 
        indexed = true, 
        searchable = true, 
        faceted = false,
        preprocessing,
        weight = 1.0,
        specialty
      } = req.body;

      const fieldConfig: IndexingFieldConfig = {
        tag,
        name,
        dataType,
        indexed,
        searchable,
        faceted,
        preprocessing: preprocessing as PreprocessingConfig[],
        weight,
        specialty,
      };

      await advancedIndexingService.updateFieldConfig(fieldConfig);

      res.json({
        success: true,
        data: fieldConfig,
        message: 'Field configuration updated successfully',
      });

    } catch (error) {
      const statusCode = error.message.includes('validation') ? 400 : 500;
      res.status(statusCode).json({
        success: false,
        error: error.message,
        code: 'UPDATE_FIELD_ERROR',
      });
    }
  }
);

/**
 * Delete indexing field configuration
 */
router.delete('/fields/:tag',
  requirePermissions('pacs:index:configure'),
  auditLog('delete_indexing_field'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { tag } = req.params;

      await advancedIndexingService.removeFieldConfig(tag);

      res.json({
        success: true,
        message: `Field configuration removed: ${tag}`,
      });

    } catch (error) {
      const statusCode = error.message.includes('not found') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: error.message,
        code: 'DELETE_FIELD_ERROR',
      });
    }
  }
);

/**
 * Start full indexing job
 */
router.post('/jobs/full',
  requirePermissions('pacs:index:manage'),
  requireOrganizationAccess,
  rateLimit({ windowMs: 3600000, maxRequests: 5 }), // 5 requests per hour
  auditLog('start_full_indexing'),
  validateRequest({
    types: {
      batchSize: 'number',
      maxConcurrency: 'number',
      enablePreprocessing: 'boolean',
      forceReindex: 'boolean',
    }
  }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const config: Partial<IndexingJobConfig> = {
        ...req.body,
        organizationId: req.organizationId,
      };

      const jobId = await advancedIndexingService.startFullIndexing(config);

      res.json({
        success: true,
        data: {
          jobId,
          type: 'full',
          config,
        },
        message: 'Full indexing job started successfully',
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'START_FULL_INDEXING_ERROR',
      });
    }
  }
);

/**
 * Start incremental indexing job
 */
router.post('/jobs/incremental',
  requirePermissions('pacs:index:manage'),
  requireOrganizationAccess,
  rateLimit({ windowMs: 900000, maxRequests: 10 }), // 10 requests per 15 minutes
  auditLog('start_incremental_indexing'),
  validateRequest({
    required: ['since'],
    types: {
      since: 'string',
      batchSize: 'number',
      maxConcurrency: 'number',
      enablePreprocessing: 'boolean',
    }
  }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { since, ...configOptions } = req.body;
      
      const sinceDate = new Date(since);
      if (isNaN(sinceDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format for "since" parameter',
          code: 'INVALID_DATE_FORMAT',
        });
      }

      const config: Partial<IndexingJobConfig> = {
        ...configOptions,
        organizationId: req.organizationId,
      };

      const jobId = await advancedIndexingService.startIncrementalIndexing(sinceDate, config);

      res.json({
        success: true,
        data: {
          jobId,
          type: 'incremental',
          since: sinceDate.toISOString(),
          config,
        },
        message: 'Incremental indexing job started successfully',
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'START_INCREMENTAL_INDEXING_ERROR',
      });
    }
  }
);

/**
 * Get indexing job status
 */
router.get('/jobs/:jobId',
  requirePermissions('pacs:index:read'),
  auditLog('get_job_status'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId } = req.params;

      const job = advancedIndexingService.getJobStatus(jobId);

      if (!job) {
        return res.status(404).json({
          success: false,
          error: `Job not found: ${jobId}`,
          code: 'JOB_NOT_FOUND',
        });
      }

      res.json({
        success: true,
        data: job,
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'GET_JOB_STATUS_ERROR',
      });
    }
  }
);

/**
 * Cancel indexing job
 */
router.post('/jobs/:jobId/cancel',
  requirePermissions('pacs:index:manage'),
  auditLog('cancel_indexing_job'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId } = req.params;

      await advancedIndexingService.cancelJob(jobId);

      res.json({
        success: true,
        message: `Job cancelled: ${jobId}`,
      });

    } catch (error) {
      const statusCode = error.message.includes('not found') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: error.message,
        code: 'CANCEL_JOB_ERROR',
      });
    }
  }
);

/**
 * Get index statistics
 */
router.get('/statistics',
  requirePermissions('pacs:index:read'),
  auditLog('get_index_statistics'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const statistics = await advancedIndexingService.getIndexStatistics();

      res.json({
        success: true,
        data: statistics,
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'GET_STATISTICS_ERROR',
      });
    }
  }
);

/**
 * Get field statistics
 */
router.get('/statistics/fields/:tag',
  requirePermissions('pacs:index:read'),
  auditLog('get_field_statistics'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { tag } = req.params;

      const statistics = await advancedIndexingService.getFieldStatistics(tag);

      if (!statistics) {
        return res.status(404).json({
          success: false,
          error: `Field statistics not found: ${tag}`,
          code: 'FIELD_STATISTICS_NOT_FOUND',
        });
      }

      res.json({
        success: true,
        data: statistics,
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'GET_FIELD_STATISTICS_ERROR',
      });
    }
  }
);

/**
 * Optimize index
 */
router.post('/optimize',
  requirePermissions('pacs:index:admin'),
  rateLimit({ windowMs: 7200000, maxRequests: 2 }), // 2 requests per 2 hours
  auditLog('optimize_index'),
  async (req: AuthenticatedRequest, res) => {
    try {
      await advancedIndexingService.optimizeIndex();

      res.json({
        success: true,
        message: 'Index optimization completed successfully',
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'OPTIMIZE_INDEX_ERROR',
      });
    }
  }
);

/**
 * Backup index
 */
router.post('/backup',
  requirePermissions('pacs:index:admin'),
  rateLimit({ windowMs: 3600000, maxRequests: 3 }), // 3 requests per hour
  auditLog('backup_index'),
  validateRequest({
    required: ['destination'],
    types: {
      destination: 'string',
    }
  }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { destination } = req.body;

      await advancedIndexingService.backupIndex(destination);

      res.json({
        success: true,
        message: `Index backup completed to: ${destination}`,
        destination,
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'BACKUP_INDEX_ERROR',
      });
    }
  }
);

/**
 * Restore index from backup
 */
router.post('/restore',
  requirePermissions('pacs:index:admin'),
  rateLimit({ windowMs: 3600000, maxRequests: 2 }), // 2 requests per hour
  auditLog('restore_index'),
  validateRequest({
    required: ['source'],
    types: {
      source: 'string',
    }
  }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { source } = req.body;

      await advancedIndexingService.restoreIndex(source);

      res.json({
        success: true,
        message: `Index restored from: ${source}`,
        source,
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'RESTORE_INDEX_ERROR',
      });
    }
  }
);

/**
 * Test preprocessing pipeline for a field
 */
router.post('/fields/:tag/test-preprocessing',
  requirePermissions('pacs:index:configure'),
  auditLog('test_preprocessing'),
  validateRequest({
    required: ['metadata', 'preprocessing'],
    types: {
      metadata: 'object',
      preprocessing: 'object',
    }
  }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { tag } = req.params;
      const { metadata, preprocessing } = req.body;

      // Get current field configuration
      const fields = advancedIndexingService.getIndexingFields();
      const fieldConfig = fields.find(f => f.tag === tag);

      if (!fieldConfig) {
        return res.status(404).json({
          success: false,
          error: `Field configuration not found: ${tag}`,
          code: 'FIELD_NOT_FOUND',
        });
      }

      // Create temporary field config with test preprocessing
      const testConfig: IndexingFieldConfig = {
        ...fieldConfig,
        preprocessing: preprocessing as PreprocessingConfig[],
      };

      // Test the preprocessing
      const originalValue = metadata[tag];
      const processedValue = await advancedIndexingService.preprocessMetadata(metadata, testConfig);

      res.json({
        success: true,
        data: {
          tag,
          originalValue,
          processedValue,
          preprocessing,
        },
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'TEST_PREPROCESSING_ERROR',
      });
    }
  }
);

/**
 * Get available preprocessing functions
 */
router.get('/preprocessing/functions',
  requirePermissions('pacs:index:read'),
  auditLog('get_preprocessing_functions'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const functions = [
        {
          type: 'normalize',
          name: 'Normalize',
          description: 'Convert to uppercase and trim whitespace',
          parameters: [],
        },
        {
          type: 'extract',
          name: 'Extract',
          description: 'Extract text using regular expressions',
          parameters: [
            { name: 'pattern', type: 'string', required: true, description: 'Regular expression pattern' },
            { name: 'flags', type: 'string', required: false, description: 'Regular expression flags' },
          ],
        },
        {
          type: 'transform',
          name: 'Transform',
          description: 'Transform values using a mapping',
          parameters: [
            { name: 'mapping', type: 'object', required: true, description: 'Value mapping object' },
          ],
        },
        {
          type: 'validate',
          name: 'Validate',
          description: 'Validate values against a pattern',
          parameters: [
            { name: 'pattern', type: 'string', required: true, description: 'Validation pattern' },
          ],
        },
        {
          type: 'anonymize',
          name: 'Anonymize',
          description: 'Anonymize sensitive data',
          parameters: [
            { name: 'method', type: 'string', required: true, description: 'Anonymization method (hash|replace)' },
            { name: 'replacement', type: 'string', required: false, description: 'Replacement value for replace method' },
          ],
        },
      ];

      res.json({
        success: true,
        data: functions,
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'GET_PREPROCESSING_FUNCTIONS_ERROR',
      });
    }
  }
);

export default router;