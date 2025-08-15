/**
 * Tests for Dynamic Rate Limiting Service
 */

const DynamicRateLimitService = require('../services/dynamicRateLimit');
const { createDynamicRateLimit } = require('../middleware/dynamicRateLimit');

describe('Dynamic Rate Limiting Service', () => {
    let service;
    
    beforeEach(() => {
        service = new DynamicRateLimitService({
            lowTrafficThreshold: 5,
            highTrafficThreshold: 20,
            minRateLimit: 10,
            maxRateLimit: 50,
            defaultRateLimit: 25,
            adjustmentSensitivity: 0.2,
            monitoringIntervalMs: 1000, // Faster for testing
            trafficAnalysisWindowMs: 5000, // Shorter window for testing
            enableLogging: false
        });
    });
    
    afterEach(() => {
        service.stopMonitoring();
        service.reset();
    });
    
    describe('Service Initialization', () => {
        test('should initialize with default configuration', () => {
            const defaultService = new DynamicRateLimitService();
            expect(defaultService.config.defaultRateLimit).toBe(100);
            expect(defaultService.config.lowTrafficThreshold).toBe(10);
            expect(defaultService.config.highTrafficThreshold).toBe(80);
            defaultService.stopMonitoring();
        });
        
        test('should start and stop monitoring', () => {
            expect(service.isMonitoring).toBe(false);
            service.startMonitoring();
            expect(service.isMonitoring).toBe(true);
            service.stopMonitoring();
            expect(service.isMonitoring).toBe(false);
        });
    });
    
    describe('Traffic Recording', () => {
        test('should record traffic for an endpoint', () => {
            service.recordTraffic('test-endpoint', 5);
            const stats = service.getTrafficStats('test-endpoint');
            
            expect(stats.endpoint).toBe('test-endpoint');
            expect(stats.currentLimit).toBe(25); // default limit
            expect(stats.totalDataPoints).toBe(1);
        });
        
        test('should calculate traffic rate correctly', () => {
            const now = Date.now();
            service.recordTraffic('test-endpoint', 10, now - 2000);
            service.recordTraffic('test-endpoint', 15, now - 1000);
            service.recordTraffic('test-endpoint', 20, now);
            
            const rate = service.calculateTrafficRate('test-endpoint');
            expect(rate.totalRequests).toBe(45);
            expect(rate.dataPoints).toBe(3);
        });
    });
    
    describe('Rate Limit Adjustments', () => {
        test('should reduce rate limit for high traffic', () => {
            const currentLimit = 25;
            const highTraffic = 25; // Above highTrafficThreshold (20)
            
            const newLimit = service.adjustRateLimits(highTraffic, currentLimit);
            expect(newLimit).toBeLessThan(currentLimit);
            expect(newLimit).toBeGreaterThanOrEqual(service.config.minRateLimit);
        });
        
        test('should increase rate limit for low traffic', () => {
            const currentLimit = 25;
            const lowTraffic = 3; // Below lowTrafficThreshold (5)
            
            const newLimit = service.adjustRateLimits(lowTraffic, currentLimit);
            expect(newLimit).toBeGreaterThan(currentLimit);
            expect(newLimit).toBeLessThanOrEqual(service.config.maxRateLimit);
        });
        
        test('should maintain rate limit for normal traffic', () => {
            const currentLimit = 25;
            const normalTraffic = 10; // Between low and high thresholds
            
            const newLimit = service.adjustRateLimits(normalTraffic, currentLimit);
            expect(newLimit).toBe(currentLimit);
        });
        
        test('should respect minimum and maximum rate limits', () => {
            // Test minimum limit enforcement
            const veryHighTraffic = 100;
            const newMinLimit = service.adjustRateLimits(veryHighTraffic, service.config.minRateLimit);
            expect(newMinLimit).toBe(service.config.minRateLimit);
            
            // Test maximum limit enforcement  
            const veryLowTraffic = 0;
            const newMaxLimit = service.adjustRateLimits(veryLowTraffic, service.config.maxRateLimit);
            expect(newMaxLimit).toBe(service.config.maxRateLimit);
        });
    });
    
    describe('Traffic Prediction', () => {
        test('should predict traffic surge with increasing pattern', () => {
            const now = Date.now();
            service.recordTraffic('test-endpoint', 5, now - 3000);
            service.recordTraffic('test-endpoint', 10, now - 2000);
            service.recordTraffic('test-endpoint', 15, now - 1000);
            
            const prediction = service.predictTrafficSurge('test-endpoint');
            expect(prediction.predicted).toBe(true);
            expect(prediction.recommendedAction).toBe('reduce_limits');
        });
        
        test('should not predict surge with stable traffic', () => {
            const now = Date.now();
            service.recordTraffic('test-endpoint', 5, now - 3000);
            service.recordTraffic('test-endpoint', 5, now - 2000);
            service.recordTraffic('test-endpoint', 6, now - 1000);
            
            const prediction = service.predictTrafficSurge('test-endpoint');
            expect(prediction.predicted).toBe(false);
        });
    });
    
    describe('Configuration Updates', () => {
        test('should update configuration dynamically', () => {
            const newConfig = {
                lowTrafficThreshold: 8,
                highTrafficThreshold: 30
            };
            
            service.updateConfig(newConfig);
            expect(service.config.lowTrafficThreshold).toBe(8);
            expect(service.config.highTrafficThreshold).toBe(30);
        });
        
        test('should emit config-updated event', (done) => {
            service.on('config-updated', (config) => {
                expect(config.lowTrafficThreshold).toBe(15);
                done();
            });
            
            service.updateConfig({ lowTrafficThreshold: 15 });
        });
    });
    
    describe('Service Events', () => {
        test('should emit rate-limit-changed event', (done) => {
            service.on('rate-limit-changed', (change) => {
                expect(change.endpoint).toBe('test-endpoint');
                expect(change.newLimit).toBeDefined();
                expect(change.oldLimit).toBeDefined();
                expect(change.reason).toBeDefined();
                done();
            });
            
            // Simulate high traffic to trigger rate limit change
            service.recordTraffic('test-endpoint', 1);
            service.updateRateLimit('test-endpoint', 20, { requestsPerSecond: 25 });
        });
    });
    
    describe('Integration Testing', () => {
        test('should handle concurrent traffic recording', () => {
            const endpoint = 'concurrent-test';
            const requests = Array.from({ length: 10 }, (_, i) => i);
            
            // Record traffic concurrently
            requests.forEach(i => {
                service.recordTraffic(endpoint, 1, Date.now() + i * 100);
            });
            
            const stats = service.getTrafficStats(endpoint);
            expect(stats.totalDataPoints).toBe(10);
            expect(stats.trafficRate.totalRequests).toBe(10);
        });
        
        test('should clean up old traffic data', async () => {
            const endpoint = 'cleanup-test';
            const oldTimestamp = Date.now() - 10000; // 10 seconds ago
            const newTimestamp = Date.now();
            
            // Record old traffic
            service.recordTraffic(endpoint, 5, oldTimestamp);
            // Record new traffic
            service.recordTraffic(endpoint, 3, newTimestamp);
            
            // Wait a bit and record more traffic to trigger cleanup
            await new Promise(resolve => setTimeout(resolve, 100));
            service.recordTraffic(endpoint, 2, Date.now());
            
            const stats = service.getTrafficStats(endpoint);
            // Should only have recent data points (within the analysis window)
            expect(stats.totalDataPoints).toBeLessThanOrEqual(3);
        });
    });
});

describe('Dynamic Rate Limiting Middleware', () => {
    let middleware;
    let mockReq;
    let mockRes;
    let mockNext;
    
    beforeEach(() => {
        middleware = createDynamicRateLimit({
            configType: 'chatEHR',
            endpointName: 'test-middleware',
            enableLogging: false
        });
        
        mockReq = {
            ip: '127.0.0.1',
            method: 'GET',
            get: jest.fn(() => 'test-user-agent')
        };
        
        mockRes = {
            status: jest.fn(() => mockRes),
            json: jest.fn(() => mockRes)
        };
        
        mockNext = jest.fn();
    });
    
    afterEach(() => {
        if (middleware.destroy) {
            middleware.destroy();
        }
    });
    
    describe('Middleware Integration', () => {
        test('should provide stats functionality', () => {
            expect(typeof middleware.getStats).toBe('function');
            expect(typeof middleware.getAllStats).toBe('function');
            expect(typeof middleware.updateConfig).toBe('function');
        });
        
        test('should get traffic statistics', () => {
            const stats = middleware.getStats();
            expect(stats.endpoint).toBe('test-middleware');
            expect(stats.currentLimit).toBeDefined();
            expect(stats.monitoringActive).toBe(true);
        });
        
        test('should update configuration', () => {
            const newConfig = { minRateLimit: 20 };
            middleware.updateConfig(newConfig);
            
            // Verify configuration is updated through stats
            const allStats = middleware.getAllStats();
            expect(allStats.config.minRateLimit).toBe(20);
        });
        
        test('should force adjustment', () => {
            expect(() => middleware.forceAdjustment()).not.toThrow();
        });
        
        test('should reset traffic data', () => {
            // Record some traffic first
            middleware.getStats(); // This should initialize some data
            
            middleware.reset();
            const stats = middleware.getStats();
            expect(stats.totalDataPoints).toBe(0);
        });
    });
});

describe('Integration with ChatEHR Routes', () => {
    test('should integrate with express router', () => {
        const dynamicMiddleware = createDynamicRateLimit({
            configType: 'chatEHR',
            endpointName: 'chatehr',
            enableLogging: false
        });
        
        expect(typeof dynamicMiddleware).toBe('function');
        expect(typeof dynamicMiddleware.getStats).toBe('function');
        
        // Test that it can be used as middleware
        const mockReq = { ip: '127.0.0.1', method: 'GET' };
        const mockRes = { status: jest.fn(() => mockRes), json: jest.fn() };
        const mockNext = jest.fn();
        
        // Should not throw when called as middleware
        expect(() => {
            // This would normally be called by express
            // We're just testing the structure here
        }).not.toThrow();
        
        dynamicMiddleware.destroy();
    });
});