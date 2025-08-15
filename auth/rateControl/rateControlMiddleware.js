/**
 * Rate Control Middleware for Premium Users
 * Integrates token-based rate control with OAuth2 authentication
 */

const rateLimit = require('express-rate-limit');
const TokenBasedRateControl = require('./tokenBasedRateControl');

/**
 * RateControlMiddleware class for managing both token-based and standard rate limiting
 */
class RateControlMiddleware {
    constructor() {
        this.tokenRateControl = new TokenBasedRateControl();
    }

    /**
     * Create rate control middleware that manages both premium and standard users
     * @param {Object} options - Rate control options
     * @returns {Function} Express middleware function
     */
    manageRateControl(options = {}) {
        const {
            standardRateLimit = {
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: 100, // limit each IP to 100 requests per windowMs
                message: {
                    error: 'Too many requests from this IP, please try again later.',
                    code: 'RATE_LIMIT_EXCEEDED'
                },
                standardHeaders: true,
                legacyHeaders: false
            },
            tokenCosts = {}, // Service-specific token costs
            enableTokenBasedRateControl = process.env.TOKEN_BASED_RATE_CONTROL_ENABLED !== 'false'
        } = options;

        // Create standard rate limiter for non-premium users
        const standardLimiter = rateLimit(standardRateLimit);

        return async (req, res, next) => {
            try {
                // Extract user information from OAuth2 middleware
                const user = req.user;
                const userType = this.extractUserType(user);

                if (!enableTokenBasedRateControl || !user || !this.tokenRateControl.isPremiumUser(userType)) {
                    // Apply standard rate limiting for non-premium users
                    return this.applyStandardRateLimits(standardLimiter, req, res, next);
                }

                // Apply token-based rate control for premium users
                const tokenCost = this.getTokenCost(req, tokenCosts);
                const context = this.extractContext(req);
                
                const consumptionResult = this.tokenRateControl.consumeTokensOnServiceAccess(
                    user.userId,
                    userType,
                    tokenCost,
                    context
                );

                if (!consumptionResult.success) {
                    if (consumptionResult.fallbackToStandardRateLimit) {
                        // Fallback to standard rate limiting if token-based fails
                        return this.applyStandardRateLimits(standardLimiter, req, res, next);
                    }

                    // Return token rate limit error
                    return this.sendTokenRateLimitError(res, consumptionResult);
                }

                // Add token information to response headers
                this.addTokenHeaders(res, consumptionResult);

                // Add token usage info to request for downstream middleware
                req.tokenUsage = {
                    tokensConsumed: consumptionResult.tokensConsumed,
                    tokensRemaining: consumptionResult.tokensRemaining,
                    resetTime: consumptionResult.resetTime,
                    userType: userType
                };

                next();

            } catch (error) {
                console.error('Rate control middleware error:', error);
                // Fallback to standard rate limiting on error
                return this.applyStandardRateLimits(standardLimiter, req, res, next);
            }
        };
    }

    /**
     * Apply standard rate limits for non-premium users
     * @param {Function} limiter - Express rate limiter
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     * @param {Function} next - Next middleware function
     */
    applyStandardRateLimits(limiter, req, res, next) {
        // Add custom header to indicate standard rate limiting is being used
        res.set('X-Rate-Limit-Type', 'standard');
        return limiter(req, res, next);
    }

    /**
     * Extract user type from user object
     * @param {Object} user - User object from OAuth2 middleware
     * @returns {string|null} User type or null
     */
    extractUserType(user) {
        if (!user) return null;

        // Check roles for premium user types
        if (user.roles && Array.isArray(user.roles)) {
            if (user.roles.includes('premiumPlus') || user.roles.includes('premium_plus')) {
                return 'premiumPlus';
            }
            if (user.roles.includes('premium')) {
                return 'premium';
            }
        }

        // Check custom claims for user type
        if (user.userType) {
            return user.userType;
        }

        // Check subscription tier
        if (user.subscriptionTier) {
            return user.subscriptionTier;
        }

        return null;
    }

    /**
     * Get token cost for the current request
     * @param {Object} req - Express request
     * @param {Object} tokenCosts - Service-specific token costs
     * @returns {number} Token cost
     */
    getTokenCost(req, tokenCosts) {
        const path = req.path;
        const method = req.method;

        // Check for path-specific costs
        for (const [pattern, cost] of Object.entries(tokenCosts)) {
            if (path.match(new RegExp(pattern))) {
                return typeof cost === 'object' ? (cost[method.toLowerCase()] || cost.default || 1) : cost;
            }
        }

        // Default costs based on HTTP method
        const defaultCosts = {
            GET: 1,
            POST: 2,
            PUT: 2,
            DELETE: 3,
            PATCH: 2
        };

        return defaultCosts[method] || 1;
    }

    /**
     * Extract context for token consumption logging
     * @param {Object} req - Express request
     * @returns {Object} Context object
     */
    extractContext(req) {
        return {
            path: req.path,
            method: req.method,
            userAgent: req.get('User-Agent'),
            ipAddress: req.ip,
            requestId: req.id || req.headers['x-request-id']
        };
    }

    /**
     * Send token rate limit error response
     * @param {Object} res - Express response
     * @param {Object} result - Token consumption result
     */
    sendTokenRateLimitError(res, result) {
        const resetTime = new Date(result.resetTime || Date.now() + 3600000); // 1 hour default
        
        res.set({
            'X-Rate-Limit-Type': 'token-based',
            'X-Rate-Limit-Limit': result.maxTokens || 'N/A',
            'X-Rate-Limit-Remaining': result.tokensAvailable || 0,
            'X-Rate-Limit-Reset': Math.ceil(resetTime.getTime() / 1000),
            'Retry-After': Math.ceil((resetTime.getTime() - Date.now()) / 1000)
        });

        res.status(429).json({
            success: false,
            error: {
                code: result.errorCode || 'TOKEN_RATE_LIMIT_EXCEEDED',
                message: result.error || 'Token rate limit exceeded',
                tokensAvailable: result.tokensAvailable || 0,
                tokensRequested: result.tokensRequested || 1,
                resetTime: resetTime.toISOString(),
                retryAfterSeconds: Math.ceil((resetTime.getTime() - Date.now()) / 1000)
            }
        });
    }

    /**
     * Add token information to response headers
     * @param {Object} res - Express response
     * @param {Object} result - Token consumption result
     */
    addTokenHeaders(res, result) {
        const resetTime = new Date(result.resetTime);
        
        res.set({
            'X-Rate-Limit-Type': 'token-based',
            'X-Rate-Limit-Limit': result.maxTokens,
            'X-Rate-Limit-Remaining': result.tokensRemaining,
            'X-Rate-Limit-Reset': Math.ceil(resetTime.getTime() / 1000),
            'X-Token-Consumed': result.tokensConsumed
        });
    }

    /**
     * Create admin endpoint for token management
     * @returns {Function} Express route handler
     */
    createTokenManagementEndpoint() {
        return (req, res) => {
            try {
                const { action, userId, adjustment, reason } = req.body;

                switch (action) {
                    case 'getStats':
                        if (userId) {
                            const userStats = this.tokenRateControl.getTokenUsageStats(userId);
                            return res.json({ success: true, userStats });
                        } else {
                            const systemStats = this.tokenRateControl.getSystemStats();
                            return res.json({ success: true, systemStats });
                        }

                    case 'adjustTokens':
                        if (!userId || typeof adjustment !== 'number') {
                            return res.status(400).json({
                                success: false,
                                error: 'userId and adjustment are required'
                            });
                        }
                        const adjustResult = this.tokenRateControl.adjustTokens(userId, adjustment, reason);
                        return res.json({ success: true, result: adjustResult });

                    case 'clearTokens':
                        if (userId) {
                            // Clear specific user's tokens
                            const clearResult = this.tokenRateControl.adjustTokens(userId, -Infinity, 'Admin clear');
                            return res.json({ success: true, result: clearResult });
                        } else {
                            // Clear all tokens
                            const clearAllResult = this.tokenRateControl.clearAllTokens();
                            return res.json({ success: true, result: clearAllResult });
                        }

                    default:
                        return res.status(400).json({
                            success: false,
                            error: 'Invalid action. Supported actions: getStats, adjustTokens, clearTokens'
                        });
                }

            } catch (error) {
                console.error('Token management endpoint error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Internal server error'
                });
            }
        };
    }

    /**
     * Create token usage statistics endpoint
     * @returns {Function} Express route handler
     */
    createTokenStatsEndpoint() {
        return (req, res) => {
            try {
                const user = req.user;
                if (!user) {
                    return res.status(401).json({
                        success: false,
                        error: 'Authentication required'
                    });
                }

                const userStats = this.tokenRateControl.getTokenUsageStats(user.userId);
                if (!userStats) {
                    return res.json({
                        success: true,
                        message: 'No token usage data available',
                        userType: this.extractUserType(user),
                        isPremiumUser: this.tokenRateControl.isPremiumUser(this.extractUserType(user))
                    });
                }

                res.json({
                    success: true,
                    userStats: {
                        ...userStats,
                        utilizationRate: Math.round(userStats.utilizationRate * 100) / 100,
                        nextRefillTime: new Date(userStats.nextRefillTime).toISOString()
                    }
                });

            } catch (error) {
                console.error('Token stats endpoint error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to retrieve token statistics'
                });
            }
        };
    }

    /**
     * Get rate control status and configuration
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            tokenBasedRateControl: {
                enabled: process.env.TOKEN_BASED_RATE_CONTROL_ENABLED !== 'false',
                stats: this.tokenRateControl.getSystemStats(),
                supportedTiers: Object.keys(this.tokenRateControl.tokenConfig)
            },
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = RateControlMiddleware;