/**
 * Dynamic Rate Limiting Monitor Route
 * Provides endpoints to monitor and manage dynamic rate limiting across the application
 */

const express = require('express');
const { createDynamicRateLimit } = require('../middleware/dynamicRateLimit');

const router = express.Router();

// Create a monitor-specific rate limiter
const monitorRateLimit = createDynamicRateLimit({
    configType: 'api',
    endpointName: 'rate-limit-monitor',
    enableLogging: true
});

// Apply rate limiting to monitor routes
router.use(monitorRateLimit);

/**
 * GET /rate-limit-monitor/global-stats
 * Get global rate limiting statistics across all endpoints
 */
router.get('/global-stats', (req, res) => {
    try {
        const globalStats = monitorRateLimit.getAllStats();
        
        res.json({
            success: true,
            data: {
                ...globalStats,
                timestamp: new Date().toISOString(),
                summary: {
                    totalEndpoints: Object.keys(globalStats.endpoints).length,
                    averageLimit: Object.values(globalStats.endpoints).reduce((sum, endpoint) => 
                        sum + endpoint.currentLimit, 0) / Object.keys(globalStats.endpoints).length || 0,
                    totalTrafficPoints: Object.values(globalStats.endpoints).reduce((sum, endpoint) => 
                        sum + endpoint.totalDataPoints, 0)
                }
            }
        });
    } catch (error) {
        console.error('[Rate Limit Monitor] Error getting global stats:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'MONITOR_ERROR',
                message: 'Failed to retrieve global rate limiting statistics'
            }
        });
    }
});

/**
 * GET /rate-limit-monitor/endpoint/:endpointName
 * Get statistics for a specific endpoint
 */
router.get('/endpoint/:endpointName', (req, res) => {
    try {
        const { endpointName } = req.params;
        const globalStats = monitorRateLimit.getAllStats();
        const endpointStats = globalStats.endpoints[endpointName];
        
        if (!endpointStats) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'ENDPOINT_NOT_FOUND',
                    message: `No rate limiting data found for endpoint: ${endpointName}`
                }
            });
        }
        
        res.json({
            success: true,
            data: {
                endpoint: endpointName,
                ...endpointStats,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('[Rate Limit Monitor] Error getting endpoint stats:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'MONITOR_ERROR',
                message: 'Failed to retrieve endpoint statistics'
            }
        });
    }
});

/**
 * POST /rate-limit-monitor/force-adjustment
 * Force rate limit adjustment analysis for all endpoints
 */
router.post('/force-adjustment', (req, res) => {
    try {
        monitorRateLimit.forceAdjustment();
        
        res.json({
            success: true,
            message: 'Rate limit adjustment analysis triggered successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[Rate Limit Monitor] Error forcing adjustment:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'ADJUSTMENT_ERROR',
                message: 'Failed to force rate limit adjustment'
            }
        });
    }
});

/**
 * GET /rate-limit-monitor/health
 * Health check for rate limiting monitoring system
 */
router.get('/health', (req, res) => {
    try {
        const stats = monitorRateLimit.getStats();
        const isHealthy = stats.monitoringActive && stats.currentLimit > 0;
        
        res.status(isHealthy ? 200 : 503).json({
            success: isHealthy,
            status: isHealthy ? 'healthy' : 'unhealthy',
            service: 'Dynamic Rate Limiting Monitor',
            data: {
                monitoringActive: stats.monitoringActive,
                currentLimit: stats.currentLimit,
                endpointName: stats.endpoint
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[Rate Limit Monitor] Health check error:', error);
        res.status(503).json({
            success: false,
            status: 'unhealthy',
            service: 'Dynamic Rate Limiting Monitor',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /rate-limit-monitor/config
 * Get current rate limiting configuration
 */
router.get('/config', (req, res) => {
    try {
        const globalStats = monitorRateLimit.getAllStats();
        
        res.json({
            success: true,
            data: {
                config: globalStats.config,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('[Rate Limit Monitor] Error getting config:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'CONFIG_ERROR',
                message: 'Failed to retrieve rate limiting configuration'
            }
        });
    }
});

/**
 * PUT /rate-limit-monitor/config
 * Update global rate limiting configuration
 */
router.put('/config', (req, res) => {
    try {
        const newConfig = req.body;
        
        // Validate configuration
        const validKeys = [
            'lowTrafficThreshold', 'highTrafficThreshold',
            'minRateLimit', 'maxRateLimit', 'defaultRateLimit',
            'adjustmentSensitivity', 'enablePrediction'
        ];
        
        const invalidKeys = Object.keys(newConfig).filter(key => !validKeys.includes(key));
        if (invalidKeys.length > 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_CONFIG',
                    message: `Invalid configuration keys: ${invalidKeys.join(', ')}`,
                    validKeys
                }
            });
        }
        
        monitorRateLimit.updateConfig(newConfig);
        
        res.json({
            success: true,
            message: 'Rate limiting configuration updated successfully',
            data: {
                updatedConfig: newConfig,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('[Rate Limit Monitor] Error updating config:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'CONFIG_UPDATE_ERROR',
                message: 'Failed to update rate limiting configuration'
            }
        });
    }
});

module.exports = router;