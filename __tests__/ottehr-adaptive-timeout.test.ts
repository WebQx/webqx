/**
 * @fileoverview Integration tests for OttehrService with Adaptive Timeouts
 * 
 * Tests the integration of adaptive timeout functionality with the OttehrService,
 * ensuring proper timeout adjustment and error handling.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { OttehrService } from '../services/ottehrService.ts';

// Mock fetch for testing
global.fetch = jest.fn();

describe('OttehrService with Adaptive Timeouts', () => {
  let ottehrService: OttehrService;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockClear();
    
    ottehrService = new OttehrService({
      apiBaseUrl: 'https://test-api.ottehr.com',
      apiKey: 'test-api-key',
      timeout: 30000,
      enableOrdering: true,
      enableNotifications: true
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('adaptive timeout integration', () => {
    it('should use fallback timeout for first request', async () => {
      // Mock successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ data: 'test' })
      } as Response);

      // First request should use fallback timeout (30000ms)
      const result = await ottehrService.getHealthStatus();
      
      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should adapt timeout based on response times', async () => {
      // Mock multiple successful responses with different durations
      const responses = [
        { duration: 5000, data: { status: 'healthy' } },
        { duration: 7000, data: { status: 'healthy' } },
        { duration: 6000, data: { status: 'healthy' } }
      ];

      for (const response of responses) {
        mockFetch.mockImplementationOnce(async () => {
          // Simulate response time
          await new Promise(resolve => setTimeout(resolve, 10));
          
          return {
            ok: true,
            status: 200,
            headers: new Map([['content-type', 'application/json']]),
            json: async () => response.data
          } as Response;
        });

        await ottehrService.getHealthStatus();
      }

      // Check that adaptive timeout stats are being tracked
      const stats = ottehrService.getAdaptiveTimeoutStats();
      expect(Object.keys(stats)).toContain('ottehr_/health');
      
      const healthStats = stats['ottehr_/health'];
      expect(healthStats.sampleCount).toBe(3);
      expect(healthStats.adjustmentCount).toBe(3);
    });

    it('should handle timeout errors gracefully', async () => {
      // Mock timeout error
      mockFetch.mockImplementationOnce(() => {
        const abortError = new Error('The operation was aborted');
        abortError.name = 'AbortError';
        return Promise.reject(abortError);
      });

      const result = await ottehrService.getHealthStatus();
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TIMEOUT_ERROR');
      expect(result.error?.message).toContain('timed out');
    });

    it('should track failed responses for timeout adjustment', async () => {
      // Mock a few successful responses
      for (let i = 0; i < 3; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          json: async () => ({ status: 'healthy' })
        } as Response);

        await ottehrService.getHealthStatus();
      }

      // Mock a failed response (timeout)
      mockFetch.mockImplementationOnce(() => {
        const abortError = new Error('The operation was aborted');
        abortError.name = 'AbortError';
        return Promise.reject(abortError);
      });

      const result = await ottehrService.getHealthStatus();
      expect(result.success).toBe(false);

      // Check that both successful and failed responses are tracked
      const stats = ottehrService.getAdaptiveTimeoutStats();
      const healthStats = stats['ottehr_/health'];
      expect(healthStats.sampleCount).toBe(4); // 3 successful + 1 failed
    });

    it('should handle network errors appropriately', async () => {
      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await ottehrService.getHealthStatus();
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NETWORK_ERROR');
      expect(result.error?.message).toBe('Network error');
    });

    it('should handle HTTP error responses', async () => {
      // Mock HTTP error response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ message: 'Server error' })
      } as Response);

      const result = await ottehrService.getHealthStatus();
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('HTTP_ERROR');
      expect(result.error?.statusCode).toBe(500);
    });

    it('should provide comprehensive timeout statistics', async () => {
      // Make requests to different endpoints
      const endpoints = ['/health', '/orders', '/notifications'];
      
      for (const endpoint of endpoints) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          json: async () => ({ data: 'test' })
        } as Response);

        if (endpoint === '/health') {
          await ottehrService.getHealthStatus();
        } else if (endpoint === '/orders') {
          await ottehrService.createOrder({
            customerId: 'test-customer',
            items: [{
              productId: 'test-product',
              name: 'Test Product',
              quantity: 1,
              unitPrice: 10.00,
              totalPrice: 10.00
            }],
            totalAmount: 10.00,
            currency: 'USD'
          });
        } else if (endpoint === '/notifications') {
          await ottehrService.sendNotification({
            type: 'system_alert',
            recipientId: 'test-recipient',
            title: 'Test Notification',
            message: 'Test message',
            channels: ['email']
          });
        }
      }

      const stats = ottehrService.getAdaptiveTimeoutStats();
      
      // Should have stats for all three endpoints
      expect(Object.keys(stats)).toHaveLength(3);
      expect(stats).toHaveProperty('ottehr_/health');
      expect(stats).toHaveProperty('ottehr_/orders');
      expect(stats).toHaveProperty('ottehr_/notifications');

      // Each endpoint should have proper statistics
      Object.values(stats).forEach((endpointStats: any) => {
        expect(endpointStats).toHaveProperty('currentTimeout');
        expect(endpointStats).toHaveProperty('adjustmentCount');
        expect(endpointStats).toHaveProperty('sampleCount');
        expect(endpointStats).toHaveProperty('avgResponseTime');
        expect(endpointStats.sampleCount).toBe(1);
        expect(endpointStats.adjustmentCount).toBe(1);
      });
    });
  });

  describe('backward compatibility', () => {
    it('should maintain existing timeout behavior when adaptive timeout fails', async () => {
      // Create service with specific timeout
      const serviceWithCustomTimeout = new OttehrService({
        apiBaseUrl: 'https://test-api.ottehr.com',
        apiKey: 'test-api-key',
        timeout: 45000 // Custom timeout
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ status: 'healthy' })
      } as Response);

      // First request should use the configured timeout as fallback
      await serviceWithCustomTimeout.getHealthStatus();
      
      // The adaptive timeout manager should use the configured timeout as fallback
      const stats = serviceWithCustomTimeout.getAdaptiveTimeoutStats();
      const healthStats = stats['ottehr_/health'];
      expect(healthStats.currentTimeout).toBeGreaterThan(0);
    });

    it('should work with existing environment variables', () => {
      // Test that existing OTTEHR_TIMEOUT environment variable is respected
      const originalTimeout = process.env.OTTEHR_TIMEOUT;
      process.env.OTTEHR_TIMEOUT = '60000';

      const serviceWithEnvTimeout = new OttehrService();
      
      // Should use environment variable timeout as fallback
      expect(serviceWithEnvTimeout.getConfig().timeout).toBe(60000);

      // Restore original environment
      if (originalTimeout) {
        process.env.OTTEHR_TIMEOUT = originalTimeout;
      } else {
        delete process.env.OTTEHR_TIMEOUT;
      }
    });
  });

  describe('HIPAA compliance', () => {
    it('should not log sensitive data in timeout adjustments', async () => {
      // Mock console.log to capture logs
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ 
          patientData: 'sensitive-info',
          ssn: '123-45-6789'
        })
      } as Response);

      await ottehrService.getHealthStatus();

      // Check that logs don't contain sensitive data
      const logCalls = consoleSpy.mock.calls;
      logCalls.forEach(call => {
        const logMessage = call.join(' ');
        expect(logMessage).not.toContain('sensitive-info');
        expect(logMessage).not.toContain('123-45-6789');
        expect(logMessage).not.toContain('patientData');
      });

      consoleSpy.mockRestore();
    });

    it('should maintain audit trail for timeout adjustments', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ status: 'healthy' })
      } as Response);

      await ottehrService.getHealthStatus();

      const stats = ottehrService.getAdaptiveTimeoutStats();
      
      // Verify that timeout adjustments are tracked for audit purposes
      expect(Object.keys(stats).length).toBeGreaterThan(0);
      Object.values(stats).forEach((endpointStats: any) => {
        expect(endpointStats.adjustmentCount).toBeGreaterThan(0);
        // lastAdjusted should be a timestamp for audit trail
        expect(typeof endpointStats.lastAdjusted).toBe('number');
      });
    });
  });
});