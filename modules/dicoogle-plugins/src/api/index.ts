/**
 * Main API Router for Dicoogle PACS Plugins
 * 
 * Combines all plugin APIs and provides centralized routing and middleware
 */

import { Router } from 'express';
import { Express } from 'express';
import { 
  addRequestId,
  corsHandler,
  errorHandler,
  authenticateToken,
  AuthenticatedRequest,
  requirePermissions,
  auditLog,
} from './middleware/auth';
import { cachingService } from '../services/caching';
import { configManager } from '../config';

// Import route modules
import filteringRoutes from './routes/filtering';
import indexingRoutes from './routes/indexing';

const router = Router();

/**
 * Apply global middleware
 */
router.use(corsHandler);
router.use(addRequestId);
router.use(authenticateToken);

/**
 * Health check endpoint
 */
router.get('/health',
  auditLog('health_check'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const config = configManager.getConfig();
      const cacheStats = await cachingService.getStats();
      
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        services: {
          filtering: {
            enabled: config.filtering.enabled,
            status: 'operational',
          },
          indexing: {
            enabled: config.indexing.enabled,
            status: 'operational',
          },
          caching: {
            enabled: config.performance.caching.enabled,
            provider: config.performance.caching.provider,
            stats: cacheStats,
          },
        },
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          nodeVersion: process.version,
        },
      };

      res.json({
        success: true,
        data: health,
      });

    } catch (error) {
      res.status(503).json({
        success: false,
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * Configuration endpoint
 */
router.get('/config',
  requirePermissions('pacs:system:monitor'),
  auditLog('get_config'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const config = configManager.getConfig();
      
      // Remove sensitive information
      const safeConfig = {
        server: {
          host: config.server.host,
          port: config.server.port,
          protocol: config.server.protocol,
          apiPath: config.server.apiPath,
        },
        auth: {
          enabled: config.auth.enabled,
          provider: config.auth.provider,
        },
        indexing: {
          enabled: config.indexing.enabled,
          maxConcurrentIndexing: config.indexing.maxConcurrentIndexing,
          batchSize: config.indexing.batchSize,
          preprocessingEnabled: config.indexing.preprocessingEnabled,
        },
        filtering: {
          enabled: config.filtering.enabled,
          maxResultsPerQuery: config.filtering.maxResultsPerQuery,
          cacheEnabled: config.filtering.cacheEnabled,
          allowedOperators: config.filtering.allowedOperators,
        },
        performance: {
          caching: {
            enabled: config.performance.caching.enabled,
            provider: config.performance.caching.provider,
            maxMemoryMB: config.performance.caching.maxMemoryMB,
            ttlSeconds: config.performance.caching.ttlSeconds,
          },
          optimization: config.performance.optimization,
        },
        security: {
          enableAuditLogging: config.security.enableAuditLogging,
          enableRoleBasedAccess: config.security.enableRoleBasedAccess,
          allowedRoles: config.security.allowedRoles,
          rateLimiting: config.security.rateLimiting,
        },
      };

      res.json({
        success: true,
        data: safeConfig,
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'GET_CONFIG_ERROR',
      });
    }
  }
);

/**
 * System statistics endpoint
 */
router.get('/statistics',
  requirePermissions('pacs:system:monitor'),
  auditLog('get_system_statistics'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const cacheStats = await cachingService.getStats();
      
      const statistics = {
        timestamp: new Date().toISOString(),
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
        },
        cache: cacheStats,
        performance: {
          // Performance metrics would be collected from actual usage
          avgResponseTime: 0,
          requestsPerSecond: 0,
          errorRate: 0,
        },
      };

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
 * Cache management endpoints
 */
router.post('/cache/clear',
  requirePermissions('pacs:system:admin'),
  auditLog('clear_cache'),
  async (req: AuthenticatedRequest, res) => {
    try {
      await cachingService.clear();

      res.json({
        success: true,
        message: 'Cache cleared successfully',
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'CLEAR_CACHE_ERROR',
      });
    }
  }
);

router.get('/cache/stats',
  requirePermissions('pacs:system:monitor'),
  auditLog('get_cache_stats'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const stats = await cachingService.getStats();

      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'GET_CACHE_STATS_ERROR',
      });
    }
  }
);

/**
 * API documentation endpoint
 */
router.get('/docs',
  auditLog('get_api_docs'),
  (req: AuthenticatedRequest, res) => {
    const apiDocs = {
      title: 'Dicoogle PACS Plugins API',
      version: '1.0.0',
      description: 'RESTful API for advanced DICOM metadata filtering and indexing',
      baseUrl: '/api/dicoogle',
      endpoints: {
        filtering: {
          basePath: '/filtering',
          endpoints: [
            'GET /operators - Get supported query operators',
            'GET /tags - Get standard DICOM tags',
            'GET /modalities - Get supported modalities',
            'GET /templates - Get filter templates',
            'POST /query - Execute filter query',
            'POST /query/advanced - Execute advanced query',
            'POST /templates/:name - Create filter from template',
            'POST /build/simple - Build simple filter',
            'POST /build/combine - Combine filters',
            'POST /validate - Validate filter',
            'GET /suggestions - Get filter suggestions',
            'GET /statistics - Get query statistics',
          ],
        },
        indexing: {
          basePath: '/indexing',
          endpoints: [
            'GET /fields - Get indexing fields',
            'GET /fields/:tag - Get field configuration',
            'PUT /fields/:tag - Update field configuration',
            'DELETE /fields/:tag - Delete field configuration',
            'POST /jobs/full - Start full indexing',
            'POST /jobs/incremental - Start incremental indexing',
            'GET /jobs/:id - Get job status',
            'POST /jobs/:id/cancel - Cancel job',
            'GET /statistics - Get index statistics',
            'GET /statistics/fields/:tag - Get field statistics',
            'POST /optimize - Optimize index',
            'POST /backup - Backup index',
            'POST /restore - Restore index',
            'POST /fields/:tag/test-preprocessing - Test preprocessing',
            'GET /preprocessing/functions - Get preprocessing functions',
          ],
        },
        system: {
          basePath: '/',
          endpoints: [
            'GET /health - Health check',
            'GET /config - Get configuration',
            'GET /statistics - Get system statistics',
            'POST /cache/clear - Clear cache',
            'GET /cache/stats - Get cache statistics',
            'GET /docs - API documentation',
          ],
        },
      },
      authentication: {
        type: 'Bearer Token',
        header: 'Authorization: Bearer <token>',
        description: 'JWT token from WebQX authentication system',
      },
      permissions: {
        'pacs:query:basic': 'Basic DICOM query operations',
        'pacs:query:advanced': 'Advanced query with custom filters',
        'pacs:index:read': 'Read index configuration and statistics',
        'pacs:index:configure': 'Configure indexing fields and settings',
        'pacs:index:manage': 'Start, stop, and manage indexing jobs',
        'pacs:index:admin': 'Full index administration',
        'pacs:system:monitor': 'Monitor system performance',
        'pacs:system:admin': 'Full system administration',
      },
    };

    res.json({
      success: true,
      data: apiDocs,
    });
  }
);

/**
 * Mount route modules
 */
router.use('/filtering', filteringRoutes);
router.use('/indexing', indexingRoutes);

/**
 * 404 handler for undefined routes
 */
router.use('*', (req: AuthenticatedRequest, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    code: 'ENDPOINT_NOT_FOUND',
    path: req.originalUrl,
    method: req.method,
  });
});

/**
 * Apply error handling middleware
 */
router.use(errorHandler);

/**
 * Mount the router on an Express app
 */
export function mountDicoogleAPI(app: Express, basePath: string = '/api/dicoogle'): void {
  app.use(basePath, router);
  
  console.log(`[Dicoogle API] Mounted at ${basePath}`);
  console.log(`[Dicoogle API] Available endpoints:`);
  console.log(`  GET    ${basePath}/health`);
  console.log(`  GET    ${basePath}/docs`);
  console.log(`  GET    ${basePath}/config`);
  console.log(`  GET    ${basePath}/statistics`);
  console.log(`  POST   ${basePath}/filtering/query`);
  console.log(`  GET    ${basePath}/indexing/fields`);
  console.log(`  POST   ${basePath}/indexing/jobs/full`);
  console.log(`  ... and more (see /docs endpoint for full list)`);
}

export default router;