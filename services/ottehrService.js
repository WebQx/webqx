/**
 * CommonJS bridge for Ottehr Service
 * This allows importing the TypeScript service from JavaScript files
 */

// For development/runtime, we'll create a simple mock that demonstrates the structure
// In production, this would be the transpiled TypeScript

class OttehrServiceMock {
  constructor(config = {}) {
    this.config = {
      apiBaseUrl: config.apiBaseUrl || process.env.OTTEHR_API_BASE_URL || 'https://api.ottehr.com',
      apiKey: config.apiKey || process.env.OTTEHR_API_KEY,
      clientId: config.clientId || process.env.OTTEHR_CLIENT_ID,
      clientSecret: config.clientSecret || process.env.OTTEHR_CLIENT_SECRET,
      environment: config.environment || process.env.OTTEHR_ENVIRONMENT || 'sandbox',
      webhookSecret: config.webhookSecret || process.env.OTTEHR_WEBHOOK_SECRET,
      timeout: parseInt(config.timeout || process.env.OTTEHR_TIMEOUT || '30000'),
      enableOrdering: config.enableOrdering !== undefined ? config.enableOrdering : process.env.OTTEHR_ENABLE_ORDERING === 'true',
      enableNotifications: config.enableNotifications !== undefined ? config.enableNotifications : process.env.OTTEHR_ENABLE_NOTIFICATIONS === 'true',
      enablePOSIntegration: config.enablePOSIntegration !== undefined ? config.enablePOSIntegration : process.env.OTTEHR_ENABLE_POS_INTEGRATION === 'true',
      enableDeliveryTracking: config.enableDeliveryTracking !== undefined ? config.enableDeliveryTracking : process.env.OTTEHR_ENABLE_DELIVERY_TRACKING === 'true'
    };

    // Validate configuration
    if (!this.config.apiKey && !this.config.clientId) {
      throw new Error('Either API key or OAuth client credentials must be configured');
    }

    console.log('[Ottehr Service Mock] Initialized with configuration:', {
      environment: this.config.environment,
      hasApiKey: !!this.config.apiKey,
      hasOAuth: !!(this.config.clientId && this.config.clientSecret),
      modules: {
        ordering: this.config.enableOrdering,
        notifications: this.config.enableNotifications,
        pos: this.config.enablePOSIntegration,
        delivery: this.config.enableDeliveryTracking
      }
    });
  }

  // Mock implementations that return appropriate responses
  async authenticate() {
    return {
      accessToken: this.config.apiKey || 'mock_token',
      tokenType: this.config.apiKey ? 'ApiKey' : 'Bearer',
      expiresIn: this.config.apiKey ? 0 : 3600
    };
  }

  async getHealthStatus() {
    return {
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        modules: {
          ordering: this.config.enableOrdering,
          notifications: this.config.enableNotifications,
          pos: this.config.enablePOSIntegration,
          delivery: this.config.enableDeliveryTracking
        }
      }
    };
  }

  async createOrder(order) {
    if (!this.config.enableOrdering) {
      throw new Error('Ordering module is not enabled');
    }

    return {
      success: true,
      data: {
        id: `order_${Date.now()}`,
        ...order,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
  }

  async getOrder(orderId) {
    if (!this.config.enableOrdering) {
      throw new Error('Ordering module is not enabled');
    }

    return {
      success: true,
      data: {
        id: orderId,
        customerId: 'mock_customer',
        items: [],
        totalAmount: 0,
        currency: 'USD',
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
  }

  async updateOrderStatus(orderId, status) {
    if (!this.config.enableOrdering) {
      throw new Error('Ordering module is not enabled');
    }

    return {
      success: true,
      data: {
        id: orderId,
        status: status,
        updatedAt: new Date().toISOString()
      }
    };
  }

  async sendNotification(notification) {
    if (!this.config.enableNotifications) {
      throw new Error('Notifications module is not enabled');
    }

    return {
      success: true,
      data: {
        id: `notification_${Date.now()}`,
        ...notification,
        status: 'sent',
        createdAt: new Date().toISOString()
      }
    };
  }

  async getNotificationStatus(notificationId) {
    if (!this.config.enableNotifications) {
      throw new Error('Notifications module is not enabled');
    }

    return {
      success: true,
      data: {
        id: notificationId,
        status: 'delivered',
        createdAt: new Date().toISOString()
      }
    };
  }

  async processPOSTransaction(transaction) {
    if (!this.config.enablePOSIntegration) {
      throw new Error('POS integration module is not enabled');
    }

    return {
      success: true,
      data: {
        id: `transaction_${Date.now()}`,
        ...transaction,
        status: 'completed',
        createdAt: new Date().toISOString()
      }
    };
  }

  async trackDelivery(orderId) {
    if (!this.config.enableDeliveryTracking) {
      throw new Error('Delivery tracking module is not enabled');
    }

    return {
      success: true,
      data: {
        id: `delivery_${Date.now()}`,
        orderId: orderId,
        status: 'in_transit',
        estimatedDeliveryTime: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
      }
    };
  }

  async updateDeliveryStatus(deliveryId, status, location) {
    if (!this.config.enableDeliveryTracking) {
      throw new Error('Delivery tracking module is not enabled');
    }

    return {
      success: true,
      data: {
        id: deliveryId,
        status: status,
        location: location,
        updatedAt: new Date().toISOString()
      }
    };
  }

  validateWebhookSignature(payload, signature) {
    if (!this.config.webhookSecret) {
      console.warn('[Ottehr Service Mock] Webhook secret not configured');
      return false;
    }
    // Simple validation for mock
    return signature === `mock_signature_${payload.length}`;
  }

  async processWebhook(payload, signature) {
    if (!this.validateWebhookSignature(JSON.stringify(payload), signature)) {
      return { success: false, error: 'Invalid webhook signature' };
    }

    console.log('[Ottehr Service Mock] Processing webhook:', payload.eventType);
    return { success: true };
  }

  getConfig() {
    const { apiKey, clientSecret, webhookSecret, ...safeConfig } = this.config;
    return safeConfig;
  }

  destroy() {
    console.log('[Ottehr Service Mock] Service destroyed');
  }
}

module.exports = {
  OttehrService: OttehrServiceMock
};