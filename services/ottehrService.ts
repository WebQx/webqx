/**
 * @fileoverview Ottehr Integration Service
 * 
 * This service provides comprehensive integration with Ottehr's modules including
 * API integration for online ordering channels, POS platforms, delivery service
 * providers, and notifications with robust error handling and authentication.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { AdaptiveTimeoutManager } from '../utils/adaptive-timeout';

/**
 * Configuration interface for the Ottehr service
 */
export interface OttehrConfig {
  /** API base URL (defaults to environment variable) */
  apiBaseUrl?: string;
  /** API key for authentication */
  apiKey?: string;
  /** OAuth client ID */
  clientId?: string;
  /** OAuth client secret */
  clientSecret?: string;
  /** Environment (sandbox/production) */
  environment?: string;
  /** Webhook secret for validating incoming webhooks */
  webhookSecret?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Enable notifications module */
  enableNotifications?: boolean;
  /** Enable ordering module */
  enableOrdering?: boolean;
  /** Enable POS integration */
  enablePOSIntegration?: boolean;
  /** Enable delivery tracking */
  enableDeliveryTracking?: boolean;
}

/**
 * Authentication response interface
 */
export interface OttehrAuthResponse {
  /** Access token */
  accessToken: string;
  /** Token type (usually 'Bearer') */
  tokenType: string;
  /** Token expiration time in seconds */
  expiresIn: number;
  /** Refresh token for renewing access */
  refreshToken?: string;
  /** Scope of the token */
  scope?: string;
}

/**
 * Order interface for Ottehr ordering system
 */
export interface OttehrOrder {
  /** Unique order ID */
  id?: string;
  /** Patient/customer ID */
  customerId: string;
  /** Array of order items */
  items: OttehrOrderItem[];
  /** Total order amount */
  totalAmount: number;
  /** Currency code */
  currency: string;
  /** Order status */
  status?: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  /** Delivery address */
  deliveryAddress?: OttehrAddress;
  /** Special instructions */
  instructions?: string;
  /** Order metadata */
  metadata?: Record<string, any>;
  /** Created timestamp */
  createdAt?: string;
  /** Updated timestamp */
  updatedAt?: string;
}

/**
 * Order item interface
 */
export interface OttehrOrderItem {
  /** Product/service ID */
  productId: string;
  /** Product name */
  name: string;
  /** Quantity ordered */
  quantity: number;
  /** Unit price */
  unitPrice: number;
  /** Total price for this item */
  totalPrice: number;
  /** Item-specific options */
  options?: Record<string, any>;
}

/**
 * Address interface
 */
export interface OttehrAddress {
  /** Street address line 1 */
  street1: string;
  /** Street address line 2 (optional) */
  street2?: string;
  /** City */
  city: string;
  /** State/province */
  state: string;
  /** Postal/ZIP code */
  postalCode: string;
  /** Country code */
  country: string;
  /** Delivery instructions */
  instructions?: string;
}

/**
 * Notification interface
 */
export interface OttehrNotification {
  /** Notification ID */
  id?: string;
  /** Notification type */
  type: 'order_update' | 'delivery_status' | 'appointment_reminder' | 'payment_confirmation' | 'system_alert';
  /** Recipient ID */
  recipientId: string;
  /** Notification title */
  title: string;
  /** Notification message */
  message: string;
  /** Notification data */
  data?: Record<string, any>;
  /** Delivery channels */
  channels: ('sms' | 'email' | 'push' | 'in_app')[];
  /** Scheduled send time */
  scheduledAt?: string;
  /** Notification status */
  status?: 'pending' | 'sent' | 'delivered' | 'failed';
  /** Created timestamp */
  createdAt?: string;
}

/**
 * Delivery tracking interface
 */
export interface OttehrDelivery {
  /** Delivery ID */
  id?: string;
  /** Associated order ID */
  orderId: string;
  /** Delivery status */
  status: 'pending' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed';
  /** Driver information */
  driver?: {
    id: string;
    name: string;
    phone: string;
    vehicleInfo?: string;
  };
  /** Estimated delivery time */
  estimatedDeliveryTime?: string;
  /** Actual delivery time */
  actualDeliveryTime?: string;
  /** Delivery location */
  location?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  /** Tracking events */
  events?: OttehrDeliveryEvent[];
}

/**
 * Delivery event interface
 */
export interface OttehrDeliveryEvent {
  /** Event timestamp */
  timestamp: string;
  /** Event type */
  type: string;
  /** Event description */
  description: string;
  /** Event location */
  location?: {
    latitude: number;
    longitude: number;
  };
}

/**
 * POS transaction interface
 */
export interface OttehrPOSTransaction {
  /** Transaction ID */
  id?: string;
  /** Transaction amount */
  amount: number;
  /** Currency code */
  currency: string;
  /** Payment method */
  paymentMethod: 'cash' | 'card' | 'digital_wallet' | 'insurance';
  /** Transaction status */
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  /** Associated order ID */
  orderId?: string;
  /** Patient/customer ID */
  customerId: string;
  /** POS terminal ID */
  terminalId: string;
  /** Transaction metadata */
  metadata?: Record<string, any>;
  /** Created timestamp */
  createdAt?: string;
}

/**
 * Error interface for detailed error information
 */
export interface OttehrError {
  /** Error message */
  message: string;
  /** Error code */
  code: string;
  /** HTTP status code */
  statusCode?: number;
  /** Additional error details */
  details?: any;
}

/**
 * API response interface
 */
export interface OttehrApiResponse<T = any> {
  /** Response data */
  data?: T;
  /** Success indicator */
  success: boolean;
  /** Error information if request failed */
  error?: OttehrError;
  /** Response metadata */
  metadata?: {
    requestId?: string;
    timestamp?: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
    };
  };
}

/**
 * Default configuration for the Ottehr service
 */
const DEFAULT_CONFIG: Required<OttehrConfig> = {
  apiBaseUrl: (typeof process !== 'undefined' && process.env?.OTTEHR_API_BASE_URL) || 'https://api.ottehr.com',
  apiKey: (typeof process !== 'undefined' && process.env?.OTTEHR_API_KEY) || '',
  clientId: (typeof process !== 'undefined' && process.env?.OTTEHR_CLIENT_ID) || '',
  clientSecret: (typeof process !== 'undefined' && process.env?.OTTEHR_CLIENT_SECRET) || '',
  environment: (typeof process !== 'undefined' && process.env?.OTTEHR_ENVIRONMENT) || 'sandbox',
  webhookSecret: (typeof process !== 'undefined' && process.env?.OTTEHR_WEBHOOK_SECRET) || '',
  timeout: parseInt((typeof process !== 'undefined' && process.env?.OTTEHR_TIMEOUT) || '30000'),
  enableNotifications: (typeof process !== 'undefined' && process.env?.OTTEHR_ENABLE_NOTIFICATIONS) === 'true',
  enableOrdering: (typeof process !== 'undefined' && process.env?.OTTEHR_ENABLE_ORDERING) === 'true',
  enablePOSIntegration: (typeof process !== 'undefined' && process.env?.OTTEHR_ENABLE_POS_INTEGRATION) === 'true',
  enableDeliveryTracking: (typeof process !== 'undefined' && process.env?.OTTEHR_ENABLE_DELIVERY_TRACKING) === 'true'
};

/**
 * OttehrService class provides comprehensive integration with Ottehr's modules
 * including ordering, notifications, POS, and delivery tracking.
 */
export class OttehrService extends EventEmitter {
  private config: Required<OttehrConfig>;
  private authToken: string | null = null;
  private tokenExpiresAt: number | null = null;
  private adaptiveTimeoutManager: AdaptiveTimeoutManager;

  /**
   * Creates a new OttehrService instance
   * @param config - Optional configuration overrides
   */
  constructor(config: OttehrConfig = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize adaptive timeout manager
    this.adaptiveTimeoutManager = new AdaptiveTimeoutManager({
      fallbackTimeoutMs: this.config.timeout,
      minTimeoutMs: Math.min(this.config.timeout, 30000),
      maxTimeoutMs: Math.max(this.config.timeout * 4, 120000),
      enableLogging: true
    });

    // Validate required configuration
    if (!this.config.apiBaseUrl) {
      throw new Error('Ottehr API base URL must be configured');
    }

    if (!this.config.apiKey && !this.config.clientId) {
      throw new Error('Either API key or OAuth client credentials must be configured');
    }

    this.logInfo('Ottehr Service initialized', { 
      environment: this.config.environment,
      modulesEnabled: {
        notifications: this.config.enableNotifications,
        ordering: this.config.enableOrdering,
        pos: this.config.enablePOSIntegration,
        delivery: this.config.enableDeliveryTracking
      }
    });
  }

  /**
   * Authenticate with Ottehr API using OAuth2 flow
   */
  async authenticate(): Promise<OttehrAuthResponse> {
    try {
      if (this.config.apiKey) {
        // API Key authentication - no need for OAuth flow
        this.authToken = this.config.apiKey;
        return {
          accessToken: this.config.apiKey,
          tokenType: 'ApiKey',
          expiresIn: 0 // API keys don't expire
        };
      }

      // OAuth2 client credentials flow
      const response = await this.makeRequest('/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          scope: 'ordering notifications pos delivery'
        })
      });

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Authentication failed');
      }

      const authData = response.data as OttehrAuthResponse;
      this.authToken = authData.accessToken;
      this.tokenExpiresAt = Date.now() + (authData.expiresIn * 1000);

      this.emit('authenticated', authData);
      this.logInfo('Successfully authenticated with Ottehr API');

      return authData;

    } catch (error) {
      this.logError('Authentication failed', error);
      const authError: OttehrError = {
        message: error instanceof Error ? error.message : 'Authentication failed',
        code: 'AUTH_ERROR'
      };
      throw authError;
    }
  }

  /**
   * Check if current authentication is valid
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.authToken) {
      await this.authenticate();
      return;
    }

    // Check if token is expired (with 5 minute buffer)
    if (this.tokenExpiresAt && Date.now() > (this.tokenExpiresAt - 300000)) {
      await this.authenticate();
    }
  }

  /**
   * Create a new order
   */
  async createOrder(order: Omit<OttehrOrder, 'id' | 'createdAt' | 'updatedAt'>): Promise<OttehrApiResponse<OttehrOrder>> {
    if (!this.config.enableOrdering) {
      throw new Error('Ordering module is not enabled');
    }

    try {
      await this.ensureAuthenticated();

      const response = await this.makeRequest('/orders', {
        method: 'POST',
        body: JSON.stringify(order)
      });

      if (response.success) {
        this.emit('orderCreated', response.data);
        this.logInfo('Order created successfully', { orderId: response.data?.id });
      }

      return response;

    } catch (error) {
      this.logError('Failed to create order', error);
      throw error;
    }
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string): Promise<OttehrApiResponse<OttehrOrder>> {
    if (!this.config.enableOrdering) {
      throw new Error('Ordering module is not enabled');
    }

    try {
      await this.ensureAuthenticated();
      return await this.makeRequest(`/orders/${orderId}`);
    } catch (error) {
      this.logError('Failed to get order', error);
      throw error;
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: string, status: OttehrOrder['status']): Promise<OttehrApiResponse<OttehrOrder>> {
    if (!this.config.enableOrdering) {
      throw new Error('Ordering module is not enabled');
    }

    try {
      await this.ensureAuthenticated();

      const response = await this.makeRequest(`/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });

      if (response.success) {
        this.emit('orderStatusUpdated', { orderId, status: response.data?.status });
      }

      return response;

    } catch (error) {
      this.logError('Failed to update order status', error);
      throw error;
    }
  }

  /**
   * Send notification
   */
  async sendNotification(notification: Omit<OttehrNotification, 'id' | 'createdAt'>): Promise<OttehrApiResponse<OttehrNotification>> {
    if (!this.config.enableNotifications) {
      throw new Error('Notifications module is not enabled');
    }

    try {
      await this.ensureAuthenticated();

      const response = await this.makeRequest('/notifications', {
        method: 'POST',
        body: JSON.stringify(notification)
      });

      if (response.success) {
        this.emit('notificationSent', response.data);
        this.logInfo('Notification sent successfully', { notificationId: response.data?.id });
      }

      return response;

    } catch (error) {
      this.logError('Failed to send notification', error);
      throw error;
    }
  }

  /**
   * Get notification status
   */
  async getNotificationStatus(notificationId: string): Promise<OttehrApiResponse<OttehrNotification>> {
    if (!this.config.enableNotifications) {
      throw new Error('Notifications module is not enabled');
    }

    try {
      await this.ensureAuthenticated();
      return await this.makeRequest(`/notifications/${notificationId}`);
    } catch (error) {
      this.logError('Failed to get notification status', error);
      throw error;
    }
  }

  /**
   * Process POS transaction
   */
  async processPOSTransaction(transaction: Omit<OttehrPOSTransaction, 'id' | 'createdAt'>): Promise<OttehrApiResponse<OttehrPOSTransaction>> {
    if (!this.config.enablePOSIntegration) {
      throw new Error('POS integration module is not enabled');
    }

    try {
      await this.ensureAuthenticated();

      const response = await this.makeRequest('/pos/transactions', {
        method: 'POST',
        body: JSON.stringify(transaction)
      });

      if (response.success) {
        this.emit('posTransactionProcessed', response.data);
        this.logInfo('POS transaction processed successfully', { transactionId: response.data?.id });
      }

      return response;

    } catch (error) {
      this.logError('Failed to process POS transaction', error);
      throw error;
    }
  }

  /**
   * Track delivery
   */
  async trackDelivery(orderId: string): Promise<OttehrApiResponse<OttehrDelivery>> {
    if (!this.config.enableDeliveryTracking) {
      throw new Error('Delivery tracking module is not enabled');
    }

    try {
      await this.ensureAuthenticated();
      return await this.makeRequest(`/deliveries/track/${orderId}`);
    } catch (error) {
      this.logError('Failed to track delivery', error);
      throw error;
    }
  }

  /**
   * Update delivery status
   */
  async updateDeliveryStatus(deliveryId: string, status: OttehrDelivery['status'], location?: { latitude: number; longitude: number }): Promise<OttehrApiResponse<OttehrDelivery>> {
    if (!this.config.enableDeliveryTracking) {
      throw new Error('Delivery tracking module is not enabled');
    }

    try {
      await this.ensureAuthenticated();

      const response = await this.makeRequest(`/deliveries/${deliveryId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, location })
      });

      if (response.success) {
        this.emit('deliveryStatusUpdated', { deliveryId, status: response.data?.status });
      }

      return response;

    } catch (error) {
      this.logError('Failed to update delivery status', error);
      throw error;
    }
  }

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(payload: string, signature: string): boolean {
    if (!this.config.webhookSecret) {
      this.logError('Webhook secret not configured');
      return false;
    }

    try {
      // Simple HMAC validation (in production, use proper crypto library)
      const expectedSignature = `sha256=${Buffer.from(this.config.webhookSecret + payload).toString('base64')}`;
      return signature === expectedSignature;
    } catch (error) {
      this.logError('Failed to validate webhook signature', error);
      return false;
    }
  }

  /**
   * Process incoming webhook
   */
  async processWebhook(payload: any, signature: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.validateWebhookSignature(JSON.stringify(payload), signature)) {
        return { success: false, error: 'Invalid webhook signature' };
      }

      const { eventType, data } = payload;
      
      switch (eventType) {
        case 'order.created':
        case 'order.updated':
        case 'order.cancelled':
          this.emit('orderWebhook', { eventType, data });
          break;
        case 'delivery.status_changed':
          this.emit('deliveryWebhook', { eventType, data });
          break;
        case 'notification.delivered':
        case 'notification.failed':
          this.emit('notificationWebhook', { eventType, data });
          break;
        case 'pos.transaction_completed':
        case 'pos.transaction_failed':
          this.emit('posWebhook', { eventType, data });
          break;
        default:
          this.logInfo('Unknown webhook event type', { eventType });
      }

      this.logInfo('Webhook processed successfully', { eventType });
      return { success: true };

    } catch (error) {
      this.logError('Failed to process webhook', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<OttehrApiResponse<{ status: string; timestamp: string; modules: Record<string, boolean> }>> {
    try {
      await this.ensureAuthenticated();
      
      const response = await this.makeRequest('/health');
      
      if (response.success) {
        this.logInfo('Health check successful');
      }

      return response;

    } catch (error) {
      this.logError('Health check failed', error);
      throw error;
    }
  }

  /**
   * Make HTTP request to Ottehr API
   */
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<OttehrApiResponse> {
    const url = `${this.config.apiBaseUrl}${endpoint}`;
    const abortController = new AbortController();
    
    // Get adaptive timeout for this endpoint
    const endpointKey = `ottehr_${endpoint.split('?')[0]}`;
    const adaptiveTimeout = this.adaptiveTimeoutManager.getAdaptiveTimeout(endpointKey, this.config.timeout);
    const timeoutId = setTimeout(() => abortController.abort(), adaptiveTimeout);
    
    const startTime = Date.now();

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'WebQX-Healthcare-Platform/1.0.0',
        ...options.headers as Record<string, string>
      };

      if (this.authToken) {
        headers['Authorization'] = this.config.apiKey === this.authToken 
          ? `ApiKey ${this.authToken}`
          : `Bearer ${this.authToken}`;
      }

      const response = await fetch(url, {
        ...options,
        headers,
        signal: abortController.signal
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      const contentType = response.headers.get('content-type');
      let data: any = null;

      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      // Record response time for adaptive timeout calculation
      const success = response.ok;
      this.adaptiveTimeoutManager.recordResponseTime(endpointKey, duration, success);

      if (!response.ok) {
        const error: OttehrError = {
          message: data?.message || `HTTP ${response.status}: ${response.statusText}`,
          code: data?.code || 'HTTP_ERROR',
          statusCode: response.status,
          details: data
        };

        this.logError(`Request failed for ${endpoint}`, {
          status: response.status,
          duration,
          adaptiveTimeout,
          error: error.message
        });

        return {
          success: false,
          error,
          metadata: {
            requestId: response.headers.get('x-request-id') || undefined,
            timestamp: new Date().toISOString()
          }
        };
      }

      this.logInfo(`Request successful for ${endpoint}`, {
        duration,
        adaptiveTimeout,
        status: response.status
      });

      return {
        success: true,
        data,
        metadata: {
          requestId: response.headers.get('x-request-id') || undefined,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      if (error instanceof Error && error.name === 'AbortError') {
        // Record timeout as failed response
        this.adaptiveTimeoutManager.recordResponseTime(endpointKey, duration, false);
        
        const timeoutError: OttehrError = {
          message: `Request timed out after ${adaptiveTimeout / 1000} seconds`,
          code: 'TIMEOUT_ERROR'
        };
        
        this.logError(`Request timeout for ${endpoint}`, {
          duration,
          adaptiveTimeout,
          configuredTimeout: this.config.timeout
        });
        
        return { success: false, error: timeoutError };
      }

      // Record network error
      this.adaptiveTimeoutManager.recordResponseTime(endpointKey, duration, false);

      const networkError: OttehrError = {
        message: error instanceof Error ? error.message : 'Network error',
        code: 'NETWORK_ERROR',
        details: error
      };

      this.logError(`Network error for ${endpoint}`, {
        duration,
        adaptiveTimeout,
        error: networkError.message
      });

      return { success: false, error: networkError };
    }
  }

  /**
   * Get adaptive timeout statistics
   */
  getAdaptiveTimeoutStats(): Record<string, any> {
    const allStats = this.adaptiveTimeoutManager.getAllStats();
    const stats: Record<string, any> = {};
    
    allStats.forEach((endpointStats, endpointKey) => {
      stats[endpointKey] = {
        currentTimeout: endpointStats.currentTimeout,
        adjustmentCount: endpointStats.adjustmentCount,
        lastAdjusted: endpointStats.lastAdjusted,
        sampleCount: endpointStats.responseTimes.length,
        avgResponseTime: endpointStats.responseTimes.length > 0 
          ? Math.round(endpointStats.responseTimes.reduce((sum, r) => sum + r.duration, 0) / endpointStats.responseTimes.length)
          : 0
      };
    });
    
    return stats;
  }

  /**
   * Update service configuration
   */
  updateConfig(newConfig: Partial<OttehrConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logInfo('Configuration updated');
  }

  /**
   * Get current service configuration (without sensitive data)
   */
  getConfig(): Omit<Required<OttehrConfig>, 'apiKey' | 'clientSecret' | 'webhookSecret'> {
    const { apiKey, clientSecret, webhookSecret, ...safeConfig } = this.config;
    return safeConfig;
  }

  /**
   * Logging utility
   */
  private logInfo(message: string, data?: any): void {
    console.log(`[Ottehr Service] ${message}`, data || '');
  }

  /**
   * Error logging utility
   */
  private logError(message: string, error?: any): void {
    console.error(`[Ottehr Service] ${message}`, error || '');
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.removeAllListeners();
    this.authToken = null;
    this.tokenExpiresAt = null;
    this.logInfo('Service destroyed');
  }
}

/**
 * Default OttehrService instance for easy importing
 * Only created if environment variables are available
 */
export let ottehrService: OttehrService | null = null;

// Create default instance only if configuration is available
if (typeof process !== 'undefined' && 
    (process.env?.OTTEHR_API_KEY || (process.env?.OTTEHR_CLIENT_ID && process.env?.OTTEHR_CLIENT_SECRET))) {
  try {
    ottehrService = new OttehrService();
  } catch (error) {
    console.warn('[Ottehr Service] Failed to create default instance:', error.message);
  }
}

export default ottehrService;