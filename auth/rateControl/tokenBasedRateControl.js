/**
 * Token-Based Rate Control for Premium Users
 * Implements token bucket algorithm for premium user rate limiting
 */

const { getConfig } = require('../oauth2/config');

/**
 * TokenBasedRateControl class for managing premium user rate limiting
 */
class TokenBasedRateControl {
    constructor() {
        this.config = getConfig();
        
        // Token buckets for users - in production, use Redis for persistence
        this.tokenBuckets = new Map();
        
        // Configuration for token limits and refill rates
        this.tokenConfig = {
            premium: {
                maxTokens: parseInt(process.env.PREMIUM_RATE_TOKENS_MAX) || 1000,
                refillRate: parseInt(process.env.PREMIUM_RATE_TOKENS_REFILL_RATE) || 100, // tokens per hour
                refillInterval: parseInt(process.env.PREMIUM_RATE_REFILL_INTERVAL) || 3600, // seconds (1 hour)
                burstLimit: parseInt(process.env.PREMIUM_RATE_BURST_LIMIT) || 200 // burst allowance
            },
            premiumPlus: {
                maxTokens: parseInt(process.env.PREMIUM_PLUS_RATE_TOKENS_MAX) || 2000,
                refillRate: parseInt(process.env.PREMIUM_PLUS_RATE_TOKENS_REFILL_RATE) || 200,
                refillInterval: parseInt(process.env.PREMIUM_PLUS_RATE_REFILL_INTERVAL) || 3600,
                burstLimit: parseInt(process.env.PREMIUM_PLUS_RATE_BURST_LIMIT) || 400
            }
        };

        // Start the token refill process
        this.startTokenRefillProcess();

        // Track statistics
        this.stats = {
            tokenAllocations: 0,
            tokenConsumptions: 0,
            rateLimitHits: 0,
            premiumUsersActive: 0
        };
    }

    /**
     * Allocate tokens to a premium user
     * @param {string} userId - User identifier
     * @param {string} userType - Type of premium user (premium, premiumPlus)
     * @returns {Object} Token allocation result
     */
    allocateTokens(userId, userType = 'premium') {
        try {
            if (!this.isPremiumUser(userType)) {
                return {
                    success: false,
                    error: 'User is not eligible for token-based rate control',
                    errorCode: 'NOT_PREMIUM_USER'
                };
            }

            const config = this.tokenConfig[userType];
            if (!config) {
                return {
                    success: false,
                    error: 'Invalid premium user type',
                    errorCode: 'INVALID_USER_TYPE'
                };
            }

            const now = Date.now();
            let bucket = this.tokenBuckets.get(userId);

            if (!bucket) {
                // Create new token bucket for user
                bucket = {
                    userId,
                    userType,
                    tokens: config.maxTokens,
                    lastRefill: now,
                    createdAt: now,
                    totalConsumed: 0,
                    totalRefilled: config.maxTokens
                };
                this.tokenBuckets.set(userId, bucket);
                this.stats.tokenAllocations++;
            }

            // Perform refill if needed
            this.refillTokens(bucket, config, now);

            return {
                success: true,
                bucket: {
                    userId: bucket.userId,
                    userType: bucket.userType,
                    tokensAvailable: bucket.tokens,
                    maxTokens: config.maxTokens,
                    lastRefill: bucket.lastRefill,
                    refillRate: config.refillRate
                }
            };

        } catch (error) {
            console.error('Token allocation error:', error);
            return {
                success: false,
                error: 'Failed to allocate tokens',
                errorCode: 'ALLOCATION_ERROR'
            };
        }
    }

    /**
     * Consume tokens for service access
     * @param {string} userId - User identifier
     * @param {string} userType - Type of premium user
     * @param {number} tokenCost - Number of tokens to consume (default: 1)
     * @param {Object} context - Request context for logging
     * @returns {Object} Token consumption result
     */
    consumeTokensOnServiceAccess(userId, userType, tokenCost = 1, context = {}) {
        try {
            if (!this.isPremiumUser(userType)) {
                return {
                    success: false,
                    error: 'User is not eligible for token-based rate control',
                    errorCode: 'NOT_PREMIUM_USER',
                    fallbackToStandardRateLimit: true
                };
            }

            const bucket = this.tokenBuckets.get(userId);
            if (!bucket) {
                // Try to allocate tokens first
                const allocation = this.allocateTokens(userId, userType);
                if (!allocation.success) {
                    return allocation;
                }
                return this.consumeTokensOnServiceAccess(userId, userType, tokenCost, context);
            }

            const config = this.tokenConfig[userType];
            const now = Date.now();

            // Perform refill before consumption
            this.refillTokens(bucket, config, now);

            // Check if enough tokens are available
            if (bucket.tokens < tokenCost) {
                this.stats.rateLimitHits++;
                
                // Log rate limit hit
                console.warn('Token rate limit exceeded', {
                    userId,
                    userType,
                    tokensRequested: tokenCost,
                    tokensAvailable: bucket.tokens,
                    context: {
                        path: context.path,
                        method: context.method,
                        timestamp: new Date().toISOString()
                    }
                });

                return {
                    success: false,
                    error: 'Token rate limit exceeded',
                    errorCode: 'TOKEN_RATE_LIMIT_EXCEEDED',
                    tokensAvailable: bucket.tokens,
                    tokensRequested: tokenCost,
                    resetTime: this.getNextRefillTime(bucket, config)
                };
            }

            // Consume tokens
            bucket.tokens -= tokenCost;
            bucket.totalConsumed += tokenCost;
            this.stats.tokenConsumptions++;

            // Log successful consumption
            console.info('Tokens consumed successfully', {
                userId,
                userType,
                tokensConsumed: tokenCost,
                tokensRemaining: bucket.tokens,
                context: {
                    path: context.path,
                    method: context.method,
                    timestamp: new Date().toISOString()
                }
            });

            return {
                success: true,
                tokensConsumed: tokenCost,
                tokensRemaining: bucket.tokens,
                maxTokens: config.maxTokens,
                resetTime: this.getNextRefillTime(bucket, config)
            };

        } catch (error) {
            console.error('Token consumption error:', error);
            return {
                success: false,
                error: 'Failed to consume tokens',
                errorCode: 'CONSUMPTION_ERROR',
                fallbackToStandardRateLimit: true
            };
        }
    }

    /**
     * Check if user is a premium user
     * @param {string} userType - User type from token claims
     * @returns {boolean} True if user is premium
     */
    isPremiumUser(userType) {
        return userType != null && this.tokenConfig.hasOwnProperty(userType);
    }

    /**
     * Refill tokens for a bucket based on time elapsed
     * @param {Object} bucket - Token bucket
     * @param {Object} config - Token configuration
     * @param {number} now - Current timestamp
     */
    refillTokens(bucket, config, now) {
        const timeSinceLastRefill = now - bucket.lastRefill;
        const refillIntervalMs = config.refillInterval * 1000;

        if (timeSinceLastRefill >= refillIntervalMs) {
            const intervalsElapsed = Math.floor(timeSinceLastRefill / refillIntervalMs);
            const tokensToAdd = intervalsElapsed * config.refillRate;
            
            bucket.tokens = Math.min(bucket.tokens + tokensToAdd, config.maxTokens);
            bucket.lastRefill = now;
            bucket.totalRefilled += tokensToAdd;

            console.debug('Tokens refilled', {
                userId: bucket.userId,
                tokensAdded: tokensToAdd,
                newTotal: bucket.tokens,
                intervalsElapsed
            });
        }
    }

    /**
     * Get next refill time for a bucket
     * @param {Object} bucket - Token bucket
     * @param {Object} config - Token configuration
     * @returns {number} Next refill timestamp
     */
    getNextRefillTime(bucket, config) {
        const refillIntervalMs = config.refillInterval * 1000;
        return bucket.lastRefill + refillIntervalMs;
    }

    /**
     * Start the token refill process (runs periodically)
     */
    startTokenRefillProcess() {
        const refillCheckInterval = 60 * 1000; // Check every minute

        this.refillInterval = setInterval(() => {
            const now = Date.now();
            let activeUsers = 0;

            for (const [userId, bucket] of this.tokenBuckets) {
                const config = this.tokenConfig[bucket.userType];
                if (config) {
                    this.refillTokens(bucket, config, now);
                    activeUsers++;
                }
            }

            this.stats.premiumUsersActive = activeUsers;

            // Clean up old buckets (older than 24 hours with no activity)
            const cleanupThreshold = 24 * 60 * 60 * 1000; // 24 hours
            for (const [userId, bucket] of this.tokenBuckets) {
                if (now - bucket.lastRefill > cleanupThreshold) {
                    this.tokenBuckets.delete(userId);
                    console.debug('Cleaned up inactive token bucket', { userId });
                }
            }

        }, refillCheckInterval);
    }

    /**
     * Stop the token refill process (for cleanup/testing)
     */
    stopTokenRefillProcess() {
        if (this.refillInterval) {
            clearInterval(this.refillInterval);
            this.refillInterval = null;
        }
    }

    /**
     * Get token usage statistics for a user
     * @param {string} userId - User identifier
     * @returns {Object} Token usage statistics
     */
    getTokenUsageStats(userId) {
        const bucket = this.tokenBuckets.get(userId);
        if (!bucket) {
            return null;
        }

        const config = this.tokenConfig[bucket.userType];
        return {
            userId: bucket.userId,
            userType: bucket.userType,
            tokensAvailable: bucket.tokens,
            maxTokens: config.maxTokens,
            totalConsumed: bucket.totalConsumed,
            totalRefilled: bucket.totalRefilled,
            utilizationRate: (bucket.totalConsumed / bucket.totalRefilled) * 100,
            nextRefillTime: this.getNextRefillTime(bucket, config),
            createdAt: bucket.createdAt,
            lastRefill: bucket.lastRefill
        };
    }

    /**
     * Get overall system statistics
     * @returns {Object} System statistics
     */
    getSystemStats() {
        return {
            ...this.stats,
            totalBuckets: this.tokenBuckets.size,
            configuredTiers: Object.keys(this.tokenConfig),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Manually adjust tokens for a user (admin function)
     * @param {string} userId - User identifier
     * @param {number} adjustment - Token adjustment (positive or negative)
     * @param {string} reason - Reason for adjustment
     * @returns {Object} Adjustment result
     */
    adjustTokens(userId, adjustment, reason = 'Manual adjustment') {
        const bucket = this.tokenBuckets.get(userId);
        if (!bucket) {
            return {
                success: false,
                error: 'User bucket not found',
                errorCode: 'BUCKET_NOT_FOUND'
            };
        }

        const config = this.tokenConfig[bucket.userType];
        const oldTokens = bucket.tokens;
        bucket.tokens = Math.max(0, Math.min(bucket.tokens + adjustment, config.maxTokens));

        console.info('Token adjustment applied', {
            userId,
            adjustment,
            reason,
            oldTokens,
            newTokens: bucket.tokens,
            adminAction: true
        });

        return {
            success: true,
            oldTokens,
            newTokens: bucket.tokens,
            adjustment,
            reason
        };
    }

    /**
     * Clear all token buckets (admin function)
     */
    clearAllTokens() {
        const count = this.tokenBuckets.size;
        this.tokenBuckets.clear();
        
        console.warn('All token buckets cleared', {
            bucketsCleared: count,
            adminAction: true,
            timestamp: new Date().toISOString()
        });

        return {
            success: true,
            bucketsCleared: count
        };
    }
}

module.exports = TokenBasedRateControl;