/**
 * Dynamic Rate Limiting Middleware
 * Integrates dynamic rate limiting with express-rate-limit
 */

const rateLimit = require('express-rate-limit');
const DynamicRateLimitService = require('../services/dynamicRateLimit');
const dynamicRateLimitConfig = require('../config/dynamicRateLimit');

class DynamicRateLimitMiddleware {
    constructor(options = {}) {
        // Determine configuration based on endpoint type
        const configType = options.configType || 'default';
        const baseConfig = dynamicRateLimitConfig[configType] || dynamicRateLimitConfig.default;
        
        // Merge with custom options
        this.config = { ...baseConfig, ...options };
        
        // Initialize dynamic rate limit service
        this.dynamicService = new DynamicRateLimitService(this.config);
        
        // Start monitoring
        this.dynamicService.startMonitoring();
        
        // Track endpoint name for statistics
        this.endpointName = options.endpointName || 'unknown';
        
        if (this.config.enableLogging) {
            console.log(`[Dynamic Rate Limit Middleware] Initialized for ${this.endpointName}`, {
                configType,
                config: this.config
            });
        }
        
        // Set up error handling
        this.dynamicService.on('error', (error) => {
            console.error(`[Dynamic Rate Limit Middleware] Error in ${this.endpointName}:`, error);
        });
        
        // Log rate limit changes
        this.dynamicService.on('rate-limit-changed', (change) => {
            if (this.config.logRateLimitChanges) {
                console.log(`[Dynamic Rate Limit Middleware] ${this.endpointName} limit changed:`, {
                    from: change.oldLimit,
                    to: change.newLimit,
                    reason: change.reason,
                    trafficRate: change.trafficRate.requestsPerSecond.toFixed(2) + ' req/s'
                });
            }
        });
    }
    
    /**
     * Create express-rate-limit middleware with dynamic limits
     */
    createMiddleware() {
        const self = this;
        
        return rateLimit({
            windowMs: this.config.trafficAnalysisWindowMs,
            max: (req) => {
                // Record traffic for this request
                self.dynamicService.recordTraffic(self.endpointName);
                
                // Return current dynamic limit
                return self.dynamicService.getCurrentRateLimit(self.endpointName);
            },
            message: (req) => {
                const currentLimit = self.dynamicService.getCurrentRateLimit(self.endpointName);
                const stats = self.dynamicService.getTrafficStats(self.endpointName);
                
                return {
                    error: `Too many requests from this IP for ${self.endpointName}, please try again later.`,
                    code: 'DYNAMIC_RATE_LIMIT_EXCEEDED',
                    currentLimit,
                    trafficRate: stats.trafficRate.requestsPerSecond,
                    retryAfter: Math.ceil(this.config.trafficAnalysisWindowMs / 1000),
                    endpoint: self.endpointName
                };
            },
            standardHeaders: true,
            legacyHeaders: false,
            // Custom key generator to include endpoint tracking
            keyGenerator: (req) => {
                const key = req.ip || req.connection.remoteAddress;
                // Also record traffic by IP for more granular tracking
                self.dynamicService.recordTraffic(`${self.endpointName}:${key}`);
                return key;
            },
            // Skip successful head requests
            skip: (req) => req.method === 'HEAD',
            // Handler for when limit is exceeded
            handler: (req, res) => {
                const stats = self.dynamicService.getTrafficStats(self.endpointName);
                
                // Log rate limit exceeded event
                if (self.config.enableLogging) {
                    console.warn(`[Dynamic Rate Limit Middleware] Rate limit exceeded for ${self.endpointName}`, {
                        ip: req.ip,
                        currentLimit: stats.currentLimit,
                        trafficRate: stats.trafficRate.requestsPerSecond,
                        userAgent: req.get('User-Agent')
                    });
                }
                
                res.status(429).json({
                    success: false,
                    error: {
                        code: 'DYNAMIC_RATE_LIMIT_EXCEEDED',
                        message: `Too many requests for ${self.endpointName}. Current limit: ${stats.currentLimit} requests per window.`,
                        currentLimit: stats.currentLimit,
                        windowMs: self.config.trafficAnalysisWindowMs,
                        trafficRate: Math.round(stats.trafficRate.requestsPerSecond * 100) / 100,
                        retryAfter: Math.ceil(self.config.trafficAnalysisWindowMs / 1000),
                        endpoint: self.endpointName,
                        timestamp: new Date().toISOString()
                    }
                });
            }
        });
    }
    
    /**
     * Get current traffic statistics
     */
    getStats() {
        return this.dynamicService.getTrafficStats(this.endpointName);
    }
    
    /**
     * Get all traffic statistics from the service
     */
    getAllStats() {
        return this.dynamicService.getAllTrafficStats();
    }
    
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.dynamicService.updateConfig(this.config);
    }
    
    /**
     * Force a rate limit adjustment
     */
    forceAdjustment() {
        this.dynamicService.analyzeTrafficAndAdjustLimits();
    }
    
    /**
     * Reset traffic data
     */
    reset() {
        this.dynamicService.reset();
    }
    
    /**
     * Stop monitoring (cleanup)
     */
    destroy() {
        this.dynamicService.stopMonitoring();
        this.dynamicService.removeAllListeners();
    }
}

/**
 * Factory function to create dynamic rate limit middleware
 */
function createDynamicRateLimit(options = {}) {
    const middleware = new DynamicRateLimitMiddleware(options);
    const expressMiddleware = middleware.createMiddleware();
    
    // Attach service methods to the middleware for external access
    expressMiddleware.getStats = () => middleware.getStats();
    expressMiddleware.getAllStats = () => middleware.getAllStats();
    expressMiddleware.updateConfig = (config) => middleware.updateConfig(config);
    expressMiddleware.forceAdjustment = () => middleware.forceAdjustment();
    expressMiddleware.reset = () => middleware.reset();
    expressMiddleware.destroy = () => middleware.destroy();
    
    return expressMiddleware;
}

module.exports = {
    DynamicRateLimitMiddleware,
    createDynamicRateLimit
};