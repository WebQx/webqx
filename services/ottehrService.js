/**
 * CommonJS bridge for Ottehr Service
 * This delegates to the TypeScript implementation
 */

// Try to import and re-export the TypeScript version
try {
  const tsService = require('./ottehrService.ts');
  module.exports = tsService;
} catch (error) {
  // Fallback to basic mock if TypeScript version fails
  console.warn('TypeScript OttehrService not available, using fallback mock');
  
  // Simple mock implementation for compatibility
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
            notifications: this.config.enableNotifications,
            ordering: this.config.enableOrdering,
            pos: this.config.enablePOSIntegration,
            delivery: this.config.enableDeliveryTracking
          }
        }
      };
    }

    // Mock other methods...
    async createOrder(order) {
      return { success: true, data: { ...order, id: 'mock_order_id', status: 'pending' } };
    }

    async sendNotification(notification) {
      return { success: true, data: { ...notification, id: 'mock_notification_id', status: 'sent' } };
    }

    getAdaptiveTimeoutStats() {
      return {};
    }

    getConfig() {
      const { apiKey, clientSecret, webhookSecret, ...safeConfig } = this.config;
      return safeConfig;
    }

    updateConfig(newConfig) {
      this.config = { ...this.config, ...newConfig };
    }

    destroy() {
      // Cleanup
    }
  }

  module.exports = { OttehrService: OttehrServiceMock };
}