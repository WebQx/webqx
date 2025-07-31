/**
 * @fileoverview Ottehr Service Tests
 * 
 * Unit tests for the Ottehr integration service covering all major functionality
 * including authentication, ordering, notifications, POS, and delivery tracking.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { 
  OttehrService, 
  type OttehrConfig, 
  type OttehrOrder, 
  type OttehrNotification,
  type OttehrPOSTransaction,
  type OttehrApiResponse
} from '../ottehrService';

// Mock fetch globally
global.fetch = jest.fn();

describe('OttehrService', () => {
  let ottehrService: OttehrService;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockClear();
    
    const config: OttehrConfig = {
      apiBaseUrl: 'https://api.ottehr.test',
      apiKey: 'test_api_key',
      enableOrdering: true,
      enableNotifications: true,
      enablePOSIntegration: true,
      enableDeliveryTracking: true
    };
    
    ottehrService = new OttehrService(config);
  });

  afterEach(() => {
    ottehrService.destroy();
  });

  describe('Configuration', () => {
    it('should initialize with default configuration', () => {
      const service = new OttehrService();
      const config = service.getConfig();
      
      expect(config.timeout).toBe(30000);
      expect(config.environment).toBe('sandbox');
    });

    it('should merge custom configuration with defaults', () => {
      const customConfig: OttehrConfig = {
        timeout: 60000,
        environment: 'production'
      };
      
      const service = new OttehrService(customConfig);
      const config = service.getConfig();
      
      expect(config.timeout).toBe(60000);
      expect(config.environment).toBe('production');
      
      service.destroy();
    });

    it('should throw error if no authentication is configured', () => {
      expect(() => {
        new OttehrService({ apiBaseUrl: 'https://api.test.com' });
      }).toThrow('Either API key or OAuth client credentials must be configured');
    });
  });

  describe('Authentication', () => {
    it('should authenticate with API key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'test_api_key', token_type: 'ApiKey' })
      } as Response);

      const result = await ottehrService.authenticate();
      
      expect(result.accessToken).toBe('test_api_key');
      expect(result.tokenType).toBe('ApiKey');
    });

    it('should authenticate with OAuth2 client credentials', async () => {
      const service = new OttehrService({
        apiBaseUrl: 'https://api.ottehr.test',
        clientId: 'test_client',
        clientSecret: 'test_secret'
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'oauth_token',
          token_type: 'Bearer',
          expires_in: 3600
        })
      } as Response);

      const result = await service.authenticate();
      
      expect(result.accessToken).toBe('oauth_token');
      expect(result.tokenType).toBe('Bearer');
      expect(result.expiresIn).toBe(3600);
      
      service.destroy();
    });

    it('should handle authentication errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: { message: 'Invalid credentials' } })
      } as Response);

      await expect(ottehrService.authenticate()).rejects.toMatchObject({
        code: 'HTTP_ERROR',
        message: expect.stringContaining('Invalid credentials')
      });
    });
  });

  describe('Order Management', () => {
    const mockOrder: Omit<OttehrOrder, 'id' | 'createdAt' | 'updatedAt'> = {
      customerId: 'customer_123',
      items: [
        {
          productId: 'product_1',
          name: 'Test Product',
          quantity: 2,
          unitPrice: 10.00,
          totalPrice: 20.00
        }
      ],
      totalAmount: 20.00,
      currency: 'USD',
      status: 'pending'
    };

    beforeEach(() => {
      // Mock HTTP responses for order operations
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/orders')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                ...mockOrder,
                id: 'order_123',
                status: url.includes('status') ? 'confirmed' : mockOrder.status,
                createdAt: '2025-01-30T12:00:00Z',
                updatedAt: '2025-01-30T12:00:00Z'
              }
            })
          } as Response);
        }
        return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
      });
    });

    it('should create order successfully', async () => {
      const result = await ottehrService.createOrder(mockOrder);
      
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('order_123');
      expect(result.data?.customerId).toBe('customer_123');
    });

    it('should get order by ID', async () => {
      const result = await ottehrService.getOrder('order_123');
      
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('order_123');
    });

    it('should update order status', async () => {
      const result = await ottehrService.updateOrderStatus('order_123', 'confirmed');
      
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('confirmed');
    });

    it('should throw error if ordering is disabled', async () => {
      const service = new OttehrService({
        apiKey: 'test_key',
        enableOrdering: false
      });

      await expect(service.createOrder(mockOrder)).rejects.toThrow('Ordering module is not enabled');
      
      service.destroy();
    });
  });

  describe('Notification Management', () => {
    const mockNotification: Omit<OttehrNotification, 'id' | 'createdAt'> = {
      type: 'order_update',
      recipientId: 'customer_123',
      title: 'Order Update',
      message: 'Your order has been confirmed',
      channels: ['email', 'sms'],
      status: 'pending'
    };

    beforeEach(() => {
      // Mock HTTP responses for notification operations
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/notifications')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                ...mockNotification,
                id: 'notification_123',
                status: url.includes('notification_123') ? 'sent' : 'pending',
                createdAt: '2025-01-30T12:00:00Z'
              }
            })
          } as Response);
        }
        return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
      });
    });

    it('should send notification successfully', async () => {
      const result = await ottehrService.sendNotification(mockNotification);
      
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('notification_123');
    });

    it('should get notification status', async () => {
      const result = await ottehrService.getNotificationStatus('notification_123');
      
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('sent');
    });

    it('should throw error if notifications are disabled', async () => {
      const service = new OttehrService({
        apiKey: 'test_key',
        enableNotifications: false
      });

      await expect(service.sendNotification(mockNotification)).rejects.toThrow('Notifications module is not enabled');
      
      service.destroy();
    });
  });

  describe('POS Integration', () => {
    const mockTransaction: Omit<OttehrPOSTransaction, 'id' | 'createdAt'> = {
      amount: 25.50,
      currency: 'USD',
      paymentMethod: 'card',
      status: 'pending',
      customerId: 'customer_123',
      terminalId: 'terminal_1'
    };

    beforeEach(() => {
      // Mock successful authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'test_api_key', token_type: 'ApiKey' })
      } as Response);
    });

    it('should process POS transaction successfully', async () => {
      const mockResponse: OttehrApiResponse<OttehrPOSTransaction> = {
        success: true,
        data: {
          ...mockTransaction,
          id: 'transaction_123',
          status: 'completed',
          createdAt: '2025-01-30T12:00:00Z'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await ottehrService.processPOSTransaction(mockTransaction);
      
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('transaction_123');
      expect(result.data?.status).toBe('completed');
    });

    it('should throw error if POS integration is disabled', async () => {
      const service = new OttehrService({
        apiKey: 'test_key',
        enablePOSIntegration: false
      });

      await expect(service.processPOSTransaction(mockTransaction)).rejects.toThrow('POS integration module is not enabled');
      
      service.destroy();
    });
  });

  describe('Delivery Tracking', () => {
    beforeEach(() => {
      // Mock successful authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'test_api_key', token_type: 'ApiKey' })
      } as Response);
    });

    it('should track delivery successfully', async () => {
      const mockResponse: OttehrApiResponse = {
        success: true,
        data: {
          id: 'delivery_123',
          orderId: 'order_123',
          status: 'in_transit',
          estimatedDeliveryTime: '2025-01-30T14:00:00Z'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await ottehrService.trackDelivery('order_123');
      
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('in_transit');
    });

    it('should update delivery status', async () => {
      const mockResponse: OttehrApiResponse = {
        success: true,
        data: {
          id: 'delivery_123',
          orderId: 'order_123',
          status: 'delivered'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await ottehrService.updateDeliveryStatus('delivery_123', 'delivered');
      
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('delivered');
    });

    it('should throw error if delivery tracking is disabled', async () => {
      const service = new OttehrService({
        apiKey: 'test_key',
        enableDeliveryTracking: false
      });

      await expect(service.trackDelivery('order_123')).rejects.toThrow('Delivery tracking module is not enabled');
      
      service.destroy();
    });
  });

  describe('Webhook Processing', () => {
    it('should validate webhook signature', () => {
      const service = new OttehrService({
        apiKey: 'test_key',
        webhookSecret: 'secret123'
      });

      const payload = '{"eventType":"order.created","data":{"id":"order_123"}}';
      const signature = 'sha256=' + Buffer.from('secret123' + payload).toString('base64');
      
      const isValid = service.validateWebhookSignature(payload, signature);
      expect(isValid).toBe(true);
      
      service.destroy();
    });

    it('should process order webhook events', async () => {
      const mockPayload = {
        eventType: 'order.created',
        data: { id: 'order_123', customerId: 'customer_123' }
      };

      const signature = 'valid_signature';
      jest.spyOn(ottehrService, 'validateWebhookSignature').mockReturnValue(true);

      const eventSpy = jest.fn();
      ottehrService.on('orderWebhook', eventSpy);

      const result = await ottehrService.processWebhook(mockPayload, signature);
      
      expect(result.success).toBe(true);
      expect(eventSpy).toHaveBeenCalledWith({
        eventType: 'order.created',
        data: mockPayload.data
      });
    });

    it('should reject webhooks with invalid signatures', async () => {
      const mockPayload = {
        eventType: 'order.created',
        data: { id: 'order_123' }
      };

      jest.spyOn(ottehrService, 'validateWebhookSignature').mockReturnValue(false);

      const result = await ottehrService.processWebhook(mockPayload, 'invalid_signature');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid webhook signature');
    });
  });

  describe('Health Check', () => {
    it('should perform health check successfully', async () => {
      // Mock successful authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'test_api_key', token_type: 'ApiKey' })
      } as Response);

      const mockResponse: OttehrApiResponse = {
        success: true,
        data: {
          status: 'healthy',
          timestamp: '2025-01-30T12:00:00Z',
          modules: {
            ordering: true,
            notifications: true,
            pos: true,
            delivery: true
          }
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await ottehrService.getHealthStatus();
      
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('healthy');
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts', async () => {
      const service = new OttehrService({
        apiKey: 'test_key',
        timeout: 100 // Very short timeout
      });

      mockFetch.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );

      await expect(service.authenticate()).rejects.toMatchObject({
        code: 'TIMEOUT_ERROR'
      });
      
      service.destroy();
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network connection failed'));

      await expect(ottehrService.authenticate()).rejects.toMatchObject({
        code: 'NETWORK_ERROR'
      });
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ message: 'Server temporarily unavailable' })
      } as Response);

      await expect(ottehrService.authenticate()).rejects.toMatchObject({
        code: 'HTTP_ERROR',
        statusCode: 500
      });
    });
  });

  describe('Event Emission', () => {
    beforeEach(() => {
      // Mock successful authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'test_api_key', token_type: 'ApiKey' })
      } as Response);
    });

    it('should emit events for successful operations', async () => {
      const orderSpy = jest.fn();
      ottehrService.on('orderCreated', orderSpy);

      const mockResponse: OttehrApiResponse<OttehrOrder> = {
        success: true,
        data: {
          id: 'order_123',
          customerId: 'customer_123',
          items: [],
          totalAmount: 20.00,
          currency: 'USD'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      await ottehrService.createOrder({
        customerId: 'customer_123',
        items: [],
        totalAmount: 20.00,
        currency: 'USD'
      });

      expect(orderSpy).toHaveBeenCalledWith(mockResponse.data);
    });
  });
});