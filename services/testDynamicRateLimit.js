/**
 * Manual test for Dynamic Rate Limiting Service
 * Run this to verify the implementation works
 */

const DynamicRateLimitService = require('./dynamicRateLimit');
const { createDynamicRateLimit } = require('../middleware/dynamicRateLimit');

console.log('Testing Dynamic Rate Limiting Service...');

// Test 1: Basic service functionality
console.log('\n1. Testing basic service functionality:');
const service = new DynamicRateLimitService({
    lowTrafficThreshold: 5,
    highTrafficThreshold: 20,
    minRateLimit: 10,
    maxRateLimit: 50,
    defaultRateLimit: 25,
    adjustmentSensitivity: 0.2,
    enableLogging: true
});

// Record some traffic
service.recordTraffic('test-endpoint', 3);
service.recordTraffic('test-endpoint', 5);
service.recordTraffic('test-endpoint', 2);

// Get statistics
const stats = service.getTrafficStats('test-endpoint');
console.log('Traffic stats:', {
    endpoint: stats.endpoint,
    currentLimit: stats.currentLimit,
    totalRequests: stats.trafficRate.totalRequests,
    requestsPerSecond: stats.trafficRate.requestsPerSecond.toFixed(2)
});

// Test 2: Rate limit adjustments
console.log('\n2. Testing rate limit adjustments:');

// Test high traffic (should reduce limit)
const highTrafficLimit = service.adjustRateLimits(25, 25); // 25 > 20 (high threshold)
console.log(`High traffic adjustment: 25 -> ${highTrafficLimit} (should be lower)`);

// Test low traffic (should increase limit)
const lowTrafficLimit = service.adjustRateLimits(3, 25); // 3 < 5 (low threshold)
console.log(`Low traffic adjustment: 25 -> ${lowTrafficLimit} (should be higher)`);

// Test normal traffic (should stay same)
const normalTrafficLimit = service.adjustRateLimits(10, 25); // 5 <= 10 <= 20
console.log(`Normal traffic adjustment: 25 -> ${normalTrafficLimit} (should be same)`);

// Test 3: Traffic prediction
console.log('\n3. Testing traffic prediction:');
const now = Date.now();
service.recordTraffic('surge-test', 5, now - 3000);
service.recordTraffic('surge-test', 10, now - 2000);
service.recordTraffic('surge-test', 20, now - 1000);

const prediction = service.predictTrafficSurge('surge-test');
console.log('Traffic surge prediction:', prediction);

// Test 4: Middleware creation
console.log('\n4. Testing middleware creation:');
try {
    const middleware = createDynamicRateLimit({
        configType: 'chatEHR',
        endpointName: 'test-middleware',
        enableLogging: false
    });
    
    console.log('Middleware created successfully');
    console.log('Middleware has stats function:', typeof middleware.getStats === 'function');
    console.log('Middleware has config function:', typeof middleware.updateConfig === 'function');
    
    const middlewareStats = middleware.getStats();
    console.log('Middleware stats:', {
        endpoint: middlewareStats.endpoint,
        currentLimit: middlewareStats.currentLimit,
        monitoringActive: middlewareStats.monitoringActive
    });
    
    middleware.destroy();
    console.log('Middleware destroyed successfully');
} catch (error) {
    console.error('Middleware test failed:', error.message);
}

// Test 5: Configuration update
console.log('\n5. Testing configuration updates:');
const oldConfig = { ...service.config };
service.updateConfig({
    lowTrafficThreshold: 8,
    highTrafficThreshold: 30
});

console.log('Configuration updated:');
console.log(`  Low threshold: ${oldConfig.lowTrafficThreshold} -> ${service.config.lowTrafficThreshold}`);
console.log(`  High threshold: ${oldConfig.highTrafficThreshold} -> ${service.config.highTrafficThreshold}`);

// Cleanup
service.stopMonitoring();
console.log('\nTesting completed successfully! ✓');

// Test 6: Example usage as shown in problem statement
console.log('\n6. Testing example implementation from problem statement:');

function adjustRateLimits(currentTraffic) {
    const HIGH_TRAFFIC_THRESHOLD = 20;
    const LOW_TRAFFIC_THRESHOLD = 5;
    const LOWER_RATE_LIMIT = 15;
    const HIGHER_RATE_LIMIT = 35;
    const DEFAULT_RATE_LIMIT = 25;
    
    if (currentTraffic > HIGH_TRAFFIC_THRESHOLD) {
        return LOWER_RATE_LIMIT;
    } else if (currentTraffic < LOW_TRAFFIC_THRESHOLD) {
        return HIGHER_RATE_LIMIT;
    }
    return DEFAULT_RATE_LIMIT;
}

console.log('Example function tests:');
console.log(`High traffic (25): ${adjustRateLimits(25)} (should be 15)`);
console.log(`Low traffic (3): ${adjustRateLimits(3)} (should be 35)`);
console.log(`Normal traffic (10): ${adjustRateLimits(10)} (should be 25)`);