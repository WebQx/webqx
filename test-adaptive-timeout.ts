/**
 * Manual test script for adaptive timeout functionality
 * This demonstrates how the adaptive timeout works with real-world scenarios
 */

import { AdaptiveTimeoutManager } from './utils/adaptive-timeout';

async function testAdaptiveTimeout() {
  console.log('=== Adaptive Timeout Manual Test ===\n');
  
  const manager = new AdaptiveTimeoutManager({
    minTimeoutMs: 10000,   // 10 seconds minimum
    maxTimeoutMs: 60000,   // 60 seconds maximum
    timeoutMultiplier: 2,  // 2x average response time
    maxSamples: 10,        // Keep last 10 samples
    fallbackTimeoutMs: 30000, // 30 second fallback
    enableLogging: true
  });

  const endpoint = 'test_api_endpoint';

  // Test 1: Initial request with no data (should use fallback)
  console.log('Test 1: Initial request with no historical data');
  let timeout = manager.getAdaptiveTimeout(endpoint);
  console.log(`Timeout: ${timeout}ms (expected: 30000ms)\n`);

  // Test 2: Record some fast response times
  console.log('Test 2: Recording fast response times (3-5 seconds)');
  const fastTimes = [3000, 4000, 3500, 4500, 3200];
  for (const time of fastTimes) {
    manager.recordResponseTime(endpoint, time, true);
    console.log(`Recorded: ${time}ms`);
  }
  
  timeout = manager.getAdaptiveTimeout(endpoint);
  const avgFast = fastTimes.reduce((sum, time) => sum + time, 0) / fastTimes.length;
  console.log(`Average response time: ${avgFast}ms`);
  console.log(`Calculated timeout: ${timeout}ms (expected: ${Math.max(avgFast * 2, 10000)}ms)\n`);

  // Test 3: Record some slow response times
  console.log('Test 3: Recording slow response times (20-25 seconds)');
  const slowTimes = [20000, 22000, 25000, 21000, 23000];
  for (const time of slowTimes) {
    manager.recordResponseTime(endpoint, time, true);
    console.log(`Recorded: ${time}ms`);
  }
  
  timeout = manager.getAdaptiveTimeout(endpoint);
  // Average should now include both fast and slow times (last 10 samples)
  const allTimes = [...fastTimes, ...slowTimes];
  const avgAll = allTimes.reduce((sum, time) => sum + time, 0) / allTimes.length;
  console.log(`Average response time: ${avgAll}ms`);
  console.log(`Calculated timeout: ${timeout}ms (expected: ${Math.min(avgAll * 2, 60000)}ms)\n`);

  // Test 4: Record some failed requests
  console.log('Test 4: Recording failed requests (timeouts)');
  manager.recordResponseTime(endpoint, 45000, false); // Failed after 45s
  manager.recordResponseTime(endpoint, 35000, false); // Failed after 35s
  
  timeout = manager.getAdaptiveTimeout(endpoint);
  console.log(`Timeout after failures: ${timeout}ms (should only consider successful requests)\n`);

  // Test 5: Show statistics
  console.log('Test 5: Endpoint statistics');
  const stats = manager.getEndpointStats(endpoint);
  if (stats) {
    console.log(`Total samples: ${stats.responseTimes.length}`);
    console.log(`Successful samples: ${stats.responseTimes.filter(r => r.success).length}`);
    console.log(`Failed samples: ${stats.responseTimes.filter(r => !r.success).length}`);
    console.log(`Current timeout: ${stats.currentTimeout}ms`);
    console.log(`Adjustment count: ${stats.adjustmentCount}`);
    console.log(`Last adjusted: ${new Date(stats.lastAdjusted).toISOString()}\n`);
  }

  // Test 6: Test with multiple endpoints
  console.log('Test 6: Multiple endpoints');
  const endpoints = ['api/users', 'api/orders', 'api/reports'];
  
  for (const ep of endpoints) {
    // Simulate different response characteristics for each endpoint
    const basetime = Math.random() * 10000 + 5000; // 5-15 seconds base
    for (let i = 0; i < 5; i++) {
      const responseTime = basetime + (Math.random() * 2000 - 1000); // ±1 second variance
      manager.recordResponseTime(ep, responseTime, true);
    }
    
    const epTimeout = manager.getAdaptiveTimeout(ep);
    console.log(`${ep}: ${epTimeout}ms timeout`);
  }

  console.log('\nAll endpoint statistics:');
  const allStats = manager.getAllStats();
  allStats.forEach((stats, endpoint) => {
    const avgResponseTime = stats.responseTimes.length > 0 
      ? Math.round(stats.responseTimes.reduce((sum, r) => sum + r.duration, 0) / stats.responseTimes.length)
      : 0;
    console.log(`  ${endpoint}: avg=${avgResponseTime}ms, timeout=${stats.currentTimeout}ms, samples=${stats.responseTimes.length}`);
  });

  console.log('\n=== Test Complete ===');
}

// Run the test if this file is executed directly
if (require.main === module) {
  testAdaptiveTimeout().catch(console.error);
}

export { testAdaptiveTimeout };