/**
 * @fileoverview Simple integration test for OttehrService TypeScript version
 */

describe('OttehrService TypeScript Integration', () => {
  it('should be able to import OttehrService from TypeScript', async () => {
    // Dynamic import to test TypeScript service
    const { OttehrService } = await import('../services/ottehrService');
    
    expect(OttehrService).toBeDefined();
    expect(typeof OttehrService).toBe('function');
    
    // Test that we can instantiate it
    const service = new OttehrService({
      apiBaseUrl: 'https://test-api.ottehr.com',
      apiKey: 'test-key',
      timeout: 30000
    });
    
    expect(service).toBeDefined();
    expect(typeof service.getAdaptiveTimeoutStats).toBe('function');
    
    // Test that adaptive timeout stats method exists and returns expected structure
    const stats = service.getAdaptiveTimeoutStats();
    expect(typeof stats).toBe('object');
  });
});