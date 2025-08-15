/**
 * Token-Based Rate Control Tests
 * Unit and integration tests for premium user rate limiting
 */

const TokenBasedRateControl = require('../tokenBasedRateControl');

describe('TokenBasedRateControl', () => {
    let tokenRateControl;

    beforeEach(() => {
        // Reset environment variables for consistent testing
        process.env.PREMIUM_RATE_TOKENS_MAX = '1000';
        process.env.PREMIUM_RATE_TOKENS_REFILL_RATE = '100';
        process.env.PREMIUM_RATE_REFILL_INTERVAL = '3600';
        process.env.PREMIUM_RATE_BURST_LIMIT = '200';

        tokenRateControl = new TokenBasedRateControl();
    });

    afterEach(() => {
        // Clean up tokens after each test
        tokenRateControl.clearAllTokens();
        // Stop the refill process to prevent hanging
        tokenRateControl.stopTokenRefillProcess();
    });

    describe('allocateTokens', () => {
        test('should allocate tokens for premium user', () => {
            const userId = 'test-premium-user-1';
            const userType = 'premium';

            const result = tokenRateControl.allocateTokens(userId, userType);

            expect(result.success).toBe(true);
            expect(result.bucket.userId).toBe(userId);
            expect(result.bucket.userType).toBe(userType);
            expect(result.bucket.tokensAvailable).toBe(1000);
            expect(result.bucket.maxTokens).toBe(1000);
        });

        test('should reject allocation for non-premium user', () => {
            const userId = 'test-regular-user-1';
            const userType = 'regular';

            const result = tokenRateControl.allocateTokens(userId, userType);

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('NOT_PREMIUM_USER');
        });

        test('should allocate different token amounts for different premium tiers', () => {
            const premiumUserId = 'premium-user';
            const premiumPlusUserId = 'premium-plus-user';

            const premiumResult = tokenRateControl.allocateTokens(premiumUserId, 'premium');
            const premiumPlusResult = tokenRateControl.allocateTokens(premiumPlusUserId, 'premiumPlus');

            expect(premiumResult.success).toBe(true);
            expect(premiumPlusResult.success).toBe(true);
            expect(premiumResult.bucket.maxTokens).toBe(1000);
            expect(premiumPlusResult.bucket.maxTokens).toBe(2000);
        });
    });

    describe('consumeTokensOnServiceAccess', () => {
        beforeEach(() => {
            // Pre-allocate tokens for testing
            tokenRateControl.allocateTokens('test-premium-user', 'premium');
        });

        test('should consume tokens successfully for premium user', () => {
            const userId = 'test-premium-user';
            const userType = 'premium';
            const tokenCost = 5;

            const result = tokenRateControl.consumeTokensOnServiceAccess(
                userId, 
                userType, 
                tokenCost, 
                { path: '/test', method: 'POST' }
            );

            expect(result.success).toBe(true);
            expect(result.tokensConsumed).toBe(tokenCost);
            expect(result.tokensRemaining).toBe(1000 - tokenCost);
        });

        test('should reject consumption when insufficient tokens', () => {
            const userId = 'test-premium-user';
            const userType = 'premium';
            
            // First, consume most tokens
            tokenRateControl.consumeTokensOnServiceAccess(userId, userType, 999, {});
            
            // Then try to consume more than available
            const result = tokenRateControl.consumeTokensOnServiceAccess(userId, userType, 5, {});

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('TOKEN_RATE_LIMIT_EXCEEDED');
            expect(result.tokensAvailable).toBe(1);
            expect(result.tokensRequested).toBe(5);
        });

        test('should fallback for non-premium user', () => {
            const userId = 'regular-user';
            const userType = 'regular';

            const result = tokenRateControl.consumeTokensOnServiceAccess(userId, userType, 1, {});

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('NOT_PREMIUM_USER');
            expect(result.fallbackToStandardRateLimit).toBe(true);
        });

        test('should auto-allocate tokens for premium user without bucket', () => {
            const userId = 'new-premium-user';
            const userType = 'premium';

            const result = tokenRateControl.consumeTokensOnServiceAccess(userId, userType, 1, {});

            expect(result.success).toBe(true);
            expect(result.tokensConsumed).toBe(1);
            expect(result.tokensRemaining).toBe(999);
        });
    });

    describe('token refill mechanism', () => {
        test('should refill tokens after time interval', () => {
            const userId = 'test-premium-user';
            const userType = 'premium';

            // Allocate and consume some tokens
            tokenRateControl.allocateTokens(userId, userType);
            tokenRateControl.consumeTokensOnServiceAccess(userId, userType, 500, {});

            // Get the bucket to manipulate time
            const bucket = tokenRateControl.tokenBuckets.get(userId);
            expect(bucket.tokens).toBe(500);

            // Simulate time passing (1 hour)
            const config = tokenRateControl.tokenConfig.premium;
            bucket.lastRefill = Date.now() - (config.refillInterval * 1000);

            // Trigger refill by consuming tokens
            const result = tokenRateControl.consumeTokensOnServiceAccess(userId, userType, 1, {});

            expect(result.success).toBe(true);
            expect(result.tokensRemaining).toBe(599); // 500 - 1 + 100 refill
        });
    });

    describe('token usage statistics', () => {
        test('should track token usage statistics', () => {
            const userId = 'test-premium-user';
            const userType = 'premium';

            // Allocate and consume tokens
            tokenRateControl.allocateTokens(userId, userType);
            tokenRateControl.consumeTokensOnServiceAccess(userId, userType, 100, {});
            tokenRateControl.consumeTokensOnServiceAccess(userId, userType, 50, {});

            const stats = tokenRateControl.getTokenUsageStats(userId);

            expect(stats).toBeDefined();
            expect(stats.userId).toBe(userId);
            expect(stats.userType).toBe(userType);
            expect(stats.totalConsumed).toBe(150);
            expect(stats.tokensAvailable).toBe(850);
            expect(stats.utilizationRate).toBe(15); // 150/1000 * 100
        });

        test('should return null for non-existent user', () => {
            const stats = tokenRateControl.getTokenUsageStats('non-existent-user');
            expect(stats).toBeNull();
        });
    });

    describe('system statistics', () => {
        test('should provide system-wide statistics', () => {
            // Create a few users
            tokenRateControl.allocateTokens('user1', 'premium');
            tokenRateControl.allocateTokens('user2', 'premiumPlus');
            tokenRateControl.consumeTokensOnServiceAccess('user1', 'premium', 10, {});

            const systemStats = tokenRateControl.getSystemStats();

            expect(systemStats.tokenAllocations).toBe(2);
            expect(systemStats.tokenConsumptions).toBe(1);
            expect(systemStats.totalBuckets).toBe(2);
            expect(systemStats.configuredTiers).toEqual(['premium', 'premiumPlus']);
        });
    });

    describe('manual token adjustment', () => {
        test('should allow manual token adjustment', () => {
            const userId = 'test-premium-user';
            tokenRateControl.allocateTokens(userId, 'premium');

            const adjustResult = tokenRateControl.adjustTokens(userId, 500, 'Test adjustment');

            expect(adjustResult.success).toBe(true);
            expect(adjustResult.oldTokens).toBe(1000);
            expect(adjustResult.newTokens).toBe(1000); // Capped at max
            expect(adjustResult.adjustment).toBe(500);
        });

        test('should handle negative adjustments', () => {
            const userId = 'test-premium-user';
            tokenRateControl.allocateTokens(userId, 'premium');

            const adjustResult = tokenRateControl.adjustTokens(userId, -200, 'Penalty');

            expect(adjustResult.success).toBe(true);
            expect(adjustResult.oldTokens).toBe(1000);
            expect(adjustResult.newTokens).toBe(800);
        });

        test('should return error for non-existent user', () => {
            const adjustResult = tokenRateControl.adjustTokens('non-existent', 100, 'Test');

            expect(adjustResult.success).toBe(false);
            expect(adjustResult.errorCode).toBe('BUCKET_NOT_FOUND');
        });
    });

    describe('premium user type detection', () => {
        test('should correctly identify premium users', () => {
            expect(tokenRateControl.isPremiumUser('premium')).toBe(true);
            expect(tokenRateControl.isPremiumUser('premiumPlus')).toBe(true);
            expect(tokenRateControl.isPremiumUser('regular')).toBe(false);
            expect(tokenRateControl.isPremiumUser(null)).toBe(false);
            expect(tokenRateControl.isPremiumUser(undefined)).toBe(false);
        });
    });

    describe('cleanup mechanism', () => {
        test('should clean up old inactive buckets', () => {
            const userId = 'test-premium-user';
            tokenRateControl.allocateTokens(userId, 'premium');

            // Simulate old bucket
            const bucket = tokenRateControl.tokenBuckets.get(userId);
            bucket.lastRefill = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago

            // Manually trigger cleanup (normally happens in interval)
            const now = Date.now();
            const cleanupThreshold = 24 * 60 * 60 * 1000; // 24 hours
            
            for (const [id, bucketItem] of tokenRateControl.tokenBuckets) {
                if (now - bucketItem.lastRefill > cleanupThreshold) {
                    tokenRateControl.tokenBuckets.delete(id);
                }
            }

            expect(tokenRateControl.tokenBuckets.has(userId)).toBe(false);
        });
    });
});