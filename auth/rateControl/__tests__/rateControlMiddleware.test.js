/**
 * Rate Control Middleware Integration Tests
 * Tests the integration between token-based rate control and OAuth2 middleware
 */

const express = require('express');
const request = require('supertest');
const RateControlMiddleware = require('../rateControlMiddleware');

describe('RateControlMiddleware Integration', () => {
    let app;
    let rateControlMiddleware;

    beforeEach(() => {
        // Set up test environment
        process.env.TOKEN_BASED_RATE_CONTROL_ENABLED = 'true';
        process.env.PREMIUM_RATE_TOKENS_MAX = '100';
        process.env.PREMIUM_RATE_TOKENS_REFILL_RATE = '10';

        rateControlMiddleware = new RateControlMiddleware();
        app = express();
        app.use(express.json());

        // Mock OAuth2 middleware to add user to request
        app.use((req, res, next) => {
            const authHeader = req.headers.authorization;
            if (authHeader === 'Bearer premium-user-token') {
                req.user = {
                    userId: 'premium-user-123',
                    email: 'premium@example.com',
                    roles: ['premium'],
                    userType: 'premium'
                };
            } else if (authHeader === 'Bearer premium-plus-user-token') {
                req.user = {
                    userId: 'premium-plus-user-123',
                    email: 'premiumplus@example.com',
                    roles: ['premiumPlus'],
                    userType: 'premiumPlus'
                };
            } else if (authHeader === 'Bearer regular-user-token') {
                req.user = {
                    userId: 'regular-user-123',
                    email: 'regular@example.com',
                    roles: ['patient'],
                    userType: 'regular'
                };
            }
            next();
        });

        // Apply rate control middleware
        const rateConfig = {
            standardRateLimit: {
                windowMs: 60 * 1000, // 1 minute for testing
                max: 5, // 5 requests per minute
                message: { error: 'Rate limit exceeded', code: 'RATE_LIMIT_EXCEEDED' }
            },
            tokenCosts: {
                '/api/test/expensive': 10,
                '/api/test/.*': 2
            }
        };
        app.use('/api/test', rateControlMiddleware.manageRateControl(rateConfig));

        // Test endpoints
        app.get('/api/test/simple', (req, res) => {
            res.json({ success: true, message: 'Simple endpoint accessed', tokenUsage: req.tokenUsage });
        });

        app.post('/api/test/expensive', (req, res) => {
            res.json({ success: true, message: 'Expensive endpoint accessed', tokenUsage: req.tokenUsage });
        });

        app.get('/api/test/stats', rateControlMiddleware.createTokenStatsEndpoint());
        
        // Admin endpoint with mock authentication
        app.use('/admin', (req, res, next) => {
            if (req.headers.authorization !== 'Bearer admin-token') {
                return res.status(401).json({ error: 'Admin authentication required' });
            }
            next();
        });
        app.post('/admin/tokens', rateControlMiddleware.createTokenManagementEndpoint());
    });

    afterEach(() => {
        // Clean up
        if (rateControlMiddleware && rateControlMiddleware.tokenRateControl) {
            rateControlMiddleware.tokenRateControl.clearAllTokens();
            rateControlMiddleware.tokenRateControl.stopTokenRefillProcess();
        }
    });

    describe('Premium User Token-Based Rate Control', () => {
        test('should allow premium user access with token consumption', async () => {
            const response = await request(app)
                .get('/api/test/simple')
                .set('Authorization', 'Bearer premium-user-token')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.tokenUsage).toBeDefined();
            expect(response.body.tokenUsage.tokensConsumed).toBe(2);
            expect(response.body.tokenUsage.tokensRemaining).toBe(98);
            expect(response.body.tokenUsage.userType).toBe('premium');

            // Check headers
            expect(response.headers['x-rate-limit-type']).toBe('token-based');
            expect(response.headers['x-rate-limit-remaining']).toBe('98');
            expect(response.headers['x-token-consumed']).toBe('2');
        });

        test('should consume different token amounts for different endpoints', async () => {
            // First request to expensive endpoint
            const expensiveResponse = await request(app)
                .post('/api/test/expensive')
                .set('Authorization', 'Bearer premium-user-token')
                .expect(200);

            expect(expensiveResponse.body.tokenUsage.tokensConsumed).toBe(10);
            expect(expensiveResponse.body.tokenUsage.tokensRemaining).toBe(90);

            // Second request to simple endpoint
            const simpleResponse = await request(app)
                .get('/api/test/simple')
                .set('Authorization', 'Bearer premium-user-token')
                .expect(200);

            expect(simpleResponse.body.tokenUsage.tokensConsumed).toBe(2);
            expect(simpleResponse.body.tokenUsage.tokensRemaining).toBe(88);
        });

        test('should reject when premium user exceeds token limit', async () => {
            // Consume most tokens first
            for (let i = 0; i < 9; i++) {
                await request(app)
                    .post('/api/test/expensive')
                    .set('Authorization', 'Bearer premium-user-token')
                    .expect(200);
            }

            // This should fail due to insufficient tokens (90 consumed, 10 remaining, need 10)
            const response = await request(app)
                .post('/api/test/expensive')
                .set('Authorization', 'Bearer premium-user-token')
                .expect(429);

            expect(response.body.success).toBe(false);
            expect(response.body.error.code).toBe('TOKEN_RATE_LIMIT_EXCEEDED');
            expect(response.body.error.tokensAvailable).toBe(10);
            expect(response.body.error.tokensRequested).toBe(10);

            // Check rate limit headers
            expect(response.headers['x-rate-limit-type']).toBe('token-based');
            expect(response.headers['retry-after']).toBeDefined();
        });

        test('should differentiate between premium tiers', async () => {
            // Premium user request
            const premiumResponse = await request(app)
                .get('/api/test/simple')
                .set('Authorization', 'Bearer premium-user-token')
                .expect(200);

            // Premium Plus user request
            const premiumPlusResponse = await request(app)
                .get('/api/test/simple')
                .set('Authorization', 'Bearer premium-plus-user-token')
                .expect(200);

            expect(premiumResponse.body.tokenUsage.userType).toBe('premium');
            expect(premiumPlusResponse.body.tokenUsage.userType).toBe('premiumPlus');

            // Premium Plus users should have more tokens initially
            expect(parseInt(premiumPlusResponse.headers['x-rate-limit-limit'])).toBeGreaterThan(
                parseInt(premiumResponse.headers['x-rate-limit-limit'])
            );
        });
    });

    describe('Standard Rate Control Fallback', () => {
        test('should apply standard rate limiting for regular users', async () => {
            const response = await request(app)
                .get('/api/test/simple')
                .set('Authorization', 'Bearer regular-user-token')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.tokenUsage).toBeUndefined();
            expect(response.headers['x-rate-limit-type']).toBe('standard');
        });

        test('should apply standard rate limiting for unauthenticated users', async () => {
            const response = await request(app)
                .get('/api/test/simple')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.tokenUsage).toBeUndefined();
            expect(response.headers['x-rate-limit-type']).toBe('standard');
        });

        test('should enforce standard rate limits for regular users', async () => {
            // Make 5 requests (the limit for standard users)
            for (let i = 0; i < 5; i++) {
                await request(app)
                    .get('/api/test/simple')
                    .set('Authorization', 'Bearer regular-user-token')
                    .expect(200);
            }

            // 6th request should be rate limited
            const response = await request(app)
                .get('/api/test/simple')
                .set('Authorization', 'Bearer regular-user-token')
                .expect(429);

            expect(response.body.code).toBe('RATE_LIMIT_EXCEEDED');
        });
    });

    describe('Token Statistics Endpoint', () => {
        test('should return token stats for premium user', async () => {
            // First, make some requests to generate usage
            await request(app)
                .get('/api/test/simple')
                .set('Authorization', 'Bearer premium-user-token');
            await request(app)
                .post('/api/test/expensive')
                .set('Authorization', 'Bearer premium-user-token');

            const response = await request(app)
                .get('/api/test/stats')
                .set('Authorization', 'Bearer premium-user-token')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.userStats).toBeDefined();
            expect(response.body.userStats.userId).toBe('premium-user-123');
            expect(response.body.userStats.totalConsumed).toBe(12); // 2 + 10
            expect(response.body.userStats.tokensAvailable).toBe(88);
        });

        test('should return appropriate message for regular user', async () => {
            const response = await request(app)
                .get('/api/test/stats')
                .set('Authorization', 'Bearer regular-user-token')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('No token usage data available');
            expect(response.body.isPremiumUser).toBe(false);
        });

        test('should require authentication', async () => {
            await request(app)
                .get('/api/test/stats')
                .expect(401);
        });
    });

    describe('Admin Token Management', () => {
        test('should provide system statistics', async () => {
            // Generate some activity first
            await request(app)
                .get('/api/test/simple')
                .set('Authorization', 'Bearer premium-user-token');
            await request(app)
                .get('/api/test/simple')
                .set('Authorization', 'Bearer premium-plus-user-token');

            const response = await request(app)
                .post('/admin/tokens')
                .set('Authorization', 'Bearer admin-token')
                .send({ action: 'getStats' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.systemStats).toBeDefined();
            expect(response.body.systemStats.totalBuckets).toBe(2);
            expect(response.body.systemStats.tokenConsumptions).toBe(2);
        });

        test('should allow token adjustment', async () => {
            // First, create a bucket by making a request
            await request(app)
                .get('/api/test/simple')
                .set('Authorization', 'Bearer premium-user-token');

            const response = await request(app)
                .post('/admin/tokens')
                .set('Authorization', 'Bearer admin-token')
                .send({
                    action: 'adjustTokens',
                    userId: 'premium-user-123',
                    adjustment: 50,
                    reason: 'Test adjustment'
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.result.success).toBe(true);
            expect(response.body.result.oldTokens).toBe(98);
            expect(response.body.result.newTokens).toBe(100); // Capped at max
        });

        test('should require admin authentication', async () => {
            await request(app)
                .post('/admin/tokens')
                .send({ action: 'getStats' })
                .expect(401);
        });
    });

    describe('Error Handling', () => {
        test('should handle missing user gracefully', async () => {
            // Mock a scenario where token-based rate control fails
            const originalManageRateControl = rateControlMiddleware.manageRateControl;
            rateControlMiddleware.manageRateControl = () => {
                return (req, res, next) => {
                    // Simulate an error in token-based rate control
                    throw new Error('Simulated error');
                };
            };

            // Should fallback to standard rate limiting
            const response = await request(app)
                .get('/api/test/simple')
                .set('Authorization', 'Bearer premium-user-token');

            // Should still work due to error handling
            expect(response.status).toBeLessThan(500);

            // Restore original method
            rateControlMiddleware.manageRateControl = originalManageRateControl;
        });
    });

    describe('Configuration Validation', () => {
        test('should handle disabled token-based rate control', async () => {
            process.env.TOKEN_BASED_RATE_CONTROL_ENABLED = 'false';
            
            const newRateControl = new RateControlMiddleware();
            const testApp = express();
            testApp.use(express.json());
            
            // Mock user
            testApp.use((req, res, next) => {
                req.user = {
                    userId: 'premium-user-123',
                    roles: ['premium'],
                    userType: 'premium'
                };
                next();
            });

            testApp.use('/test', newRateControl.manageRateControl({
                enableTokenBasedRateControl: false
            }));
            
            testApp.get('/test/endpoint', (req, res) => {
                res.json({ success: true, tokenUsage: req.tokenUsage });
            });

            const response = await request(testApp)
                .get('/test/endpoint')
                .expect(200);

            // Should use standard rate limiting even for premium user
            expect(response.body.tokenUsage).toBeUndefined();
        });
    });
});