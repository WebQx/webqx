/**
 * Real-Time Update Service with WebSocket and Polling Fallback
 * 
 * Provides real-time data synchronization for EHR data using WebSockets
 * with intelligent fallback to polling for compatibility and resilience.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { FHIRResource } from '../types/fhir-r4';

/**
 * Real-time update event types
 */
export type RealTimeEventType = 
  | 'resource_created'
  | 'resource_updated'
  | 'resource_deleted'
  | 'appointment_booked'
  | 'appointment_cancelled'
  | 'patient_updated'
  | 'observation_added'
  | 'medication_prescribed'
  | 'sync_started'
  | 'sync_completed'
  | 'connection_established'
  | 'connection_lost'
  | 'error_occurred';

/**
 * Real-time update payload
 */
export interface RealTimeUpdateEvent {
  /** Event type */
  type: RealTimeEventType;
  /** Resource type that was updated */
  resourceType?: string;
  /** Resource ID that was updated */
  resourceId?: string;
  /** Patient ID associated with the update */
  patientId?: string;
  /** EHR system that generated the update */
  ehrSystem?: string;
  /** Timestamp of the update */
  timestamp: Date;
  /** Additional event data */
  data?: Record<string, unknown>;
  /** Event metadata */
  metadata?: {
    source?: string;
    version?: string;
    correlationId?: string;
  };
}

/**
 * WebSocket connection status
 */
export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';

/**
 * Real-time subscription configuration
 */
export interface RealTimeSubscription {
  /** Subscription ID */
  id: string;
  /** Event types to subscribe to */
  eventTypes: RealTimeEventType[];
  /** Patient ID filter (optional) */
  patientId?: string;
  /** Resource type filter (optional) */
  resourceType?: string;
  /** EHR system filter (optional) */
  ehrSystem?: string;
  /** Callback function for updates */
  callback: (event: RealTimeUpdateEvent) => void;
  /** Subscription metadata */
  metadata?: {
    subscribedAt: Date;
    lastEventReceived?: Date;
    eventCount: number;
  };
}

/**
 * Real-time service configuration
 */
export interface RealTimeServiceConfig {
  /** WebSocket server URL */
  websocketUrl?: string;
  /** Enable WebSocket connection */
  enableWebSocket?: boolean;
  /** Polling interval in milliseconds */
  pollingInterval?: number;
  /** Maximum polling duration in milliseconds */
  maxPollingDuration?: number;
  /** WebSocket reconnection attempts */
  maxReconnectAttempts?: number;
  /** Reconnection delay in milliseconds */
  reconnectDelay?: number;
  /** Authentication token for WebSocket */
  authToken?: string;
  /** Subscription filters */
  defaultFilters?: {
    patientId?: string;
    resourceTypes?: string[];
    ehrSystems?: string[];
  };
}

/**
 * Real-Time Update Service
 * 
 * Manages real-time data synchronization using WebSockets with intelligent
 * fallback to polling when WebSocket connections are unavailable.
 */
export class RealTimeUpdateService extends EventEmitter {
  private config: Required<RealTimeServiceConfig>;
  private websocket: WebSocket | null = null;
  private websocketStatus: WebSocketStatus = 'disconnected';
  private pollingInterval: NodeJS.Timeout | null = null;
  private subscriptions: Map<string, RealTimeSubscription> = new Map();
  private reconnectAttempts = 0;
  private lastPollingTime = new Date();
  private isPollingActive = false;

  constructor(config: RealTimeServiceConfig = {}) {
    super();
    
    this.config = {
      websocketUrl: config.websocketUrl || 'ws://localhost:8080/realtime',
      enableWebSocket: config.enableWebSocket ?? true,
      pollingInterval: config.pollingInterval || 30000, // 30 seconds
      maxPollingDuration: config.maxPollingDuration || 300000, // 5 minutes
      maxReconnectAttempts: config.maxReconnectAttempts || 5,
      reconnectDelay: config.reconnectDelay || 5000, // 5 seconds
      authToken: config.authToken || '',
      defaultFilters: config.defaultFilters || {}
    };

    this.logInfo('Real-Time Update Service initialized', {
      websocketEnabled: this.config.enableWebSocket,
      pollingInterval: this.config.pollingInterval
    });
  }

  /**
   * Start real-time updates
   */
  async start(): Promise<void> {
    this.logInfo('Starting real-time update service');

    if (this.config.enableWebSocket) {
      await this.connectWebSocket();
    } else {
      this.startPolling();
    }

    this.emit('service_started');
  }

  /**
   * Stop real-time updates
   */
  async stop(): Promise<void> {
    this.logInfo('Stopping real-time update service');

    this.disconnectWebSocket();
    this.stopPolling();
    this.subscriptions.clear();

    this.emit('service_stopped');
  }

  /**
   * Subscribe to real-time updates
   */
  subscribe(subscription: Omit<RealTimeSubscription, 'id' | 'metadata'>): string {
    const subscriptionId = this.generateSubscriptionId();
    
    const fullSubscription: RealTimeSubscription = {
      ...subscription,
      id: subscriptionId,
      metadata: {
        subscribedAt: new Date(),
        eventCount: 0
      }
    };

    this.subscriptions.set(subscriptionId, fullSubscription);

    this.logInfo('Real-time subscription created', {
      subscriptionId,
      eventTypes: subscription.eventTypes,
      patientId: subscription.patientId,
      resourceType: subscription.resourceType
    });

    // If WebSocket is connected, send subscription to server
    if (this.websocketStatus === 'connected' && this.websocket) {
      this.sendWebSocketMessage({
        type: 'subscribe',
        subscriptionId,
        eventTypes: subscription.eventTypes,
        filters: {
          patientId: subscription.patientId,
          resourceType: subscription.resourceType,
          ehrSystem: subscription.ehrSystem
        }
      });
    }

    return subscriptionId;
  }

  /**
   * Unsubscribe from real-time updates
   */
  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    this.subscriptions.delete(subscriptionId);

    this.logInfo('Real-time subscription removed', {
      subscriptionId,
      eventCount: subscription.metadata?.eventCount || 0
    });

    // If WebSocket is connected, send unsubscribe to server
    if (this.websocketStatus === 'connected' && this.websocket) {
      this.sendWebSocketMessage({
        type: 'unsubscribe',
        subscriptionId
      });
    }

    return true;
  }

  /**
   * Get current WebSocket connection status
   */
  getConnectionStatus(): WebSocketStatus {
    return this.websocketStatus;
  }

  /**
   * Get active subscriptions
   */
  getSubscriptions(): RealTimeSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Manually trigger polling update
   */
  async triggerPollingUpdate(): Promise<void> {
    if (this.isPollingActive) {
      this.logInfo('Polling update already in progress');
      return;
    }

    await this.performPollingUpdate();
  }

  /**
   * Publish an update event (for testing or manual triggers)
   */
  publishEvent(event: RealTimeUpdateEvent): void {
    this.processIncomingEvent(event);
  }

  // ============================================================================
  // WebSocket Management
  // ============================================================================

  private async connectWebSocket(): Promise<void> {
    if (this.websocketStatus === 'connected' || this.websocketStatus === 'connecting') {
      return;
    }

    this.websocketStatus = 'connecting';
    this.emit('websocket_status_changed', this.websocketStatus);

    try {
      // In browser environment, use WebSocket API
      if (typeof window !== 'undefined') {
        this.websocket = new WebSocket(this.config.websocketUrl);
      } else {
        // In Node.js environment, would use ws library
        this.logInfo('WebSocket not available in Node.js environment, falling back to polling');
        this.startPolling();
        return;
      }

      this.websocket.onopen = () => {
        this.websocketStatus = 'connected';
        this.reconnectAttempts = 0;
        this.stopPolling(); // Stop polling when WebSocket connects
        
        this.logInfo('WebSocket connected successfully');
        this.emit('websocket_status_changed', this.websocketStatus);
        this.emit('connection_established');

        // Send authentication if token provided
        if (this.config.authToken) {
          this.sendWebSocketMessage({
            type: 'authenticate',
            token: this.config.authToken
          });
        }

        // Resubscribe to all active subscriptions
        this.resubscribeAll();
      };

      this.websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (error) {
          this.logError('Failed to parse WebSocket message', error);
        }
      };

      this.websocket.onclose = () => {
        this.websocketStatus = 'disconnected';
        this.emit('websocket_status_changed', this.websocketStatus);
        this.emit('connection_lost');
        
        this.logInfo('WebSocket disconnected');
        
        // Start reconnection attempts
        this.attemptReconnection();
      };

      this.websocket.onerror = (error) => {
        this.websocketStatus = 'error';
        this.emit('websocket_status_changed', this.websocketStatus);
        
        this.logError('WebSocket error occurred', error);
        
        // Start polling as fallback
        this.startPolling();
      };

    } catch (error) {
      this.websocketStatus = 'error';
      this.emit('websocket_status_changed', this.websocketStatus);
      
      this.logError('Failed to create WebSocket connection', error);
      
      // Fallback to polling
      this.startPolling();
    }
  }

  private disconnectWebSocket(): void {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    
    this.websocketStatus = 'disconnected';
    this.emit('websocket_status_changed', this.websocketStatus);
  }

  private attemptReconnection(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.logInfo('Maximum reconnection attempts reached, falling back to polling');
      this.startPolling();
      return;
    }

    this.reconnectAttempts++;
    this.websocketStatus = 'reconnecting';
    this.emit('websocket_status_changed', this.websocketStatus);

    this.logInfo(`Attempting WebSocket reconnection (${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connectWebSocket();
    }, this.config.reconnectDelay);
  }

  private sendWebSocketMessage(message: Record<string, unknown>): void {
    if (this.websocket && this.websocketStatus === 'connected') {
      this.websocket.send(JSON.stringify(message));
    }
  }

  private handleWebSocketMessage(data: any): void {
    switch (data.type) {
      case 'update':
        if (data.event) {
          this.processIncomingEvent({
            ...data.event,
            timestamp: new Date(data.event.timestamp)
          });
        }
        break;
        
      case 'authenticated':
        this.logInfo('WebSocket authentication successful');
        break;
        
      case 'error':
        this.logError('WebSocket server error', data.error);
        break;
        
      default:
        this.logInfo('Unknown WebSocket message type', { type: data.type });
    }
  }

  private resubscribeAll(): void {
    for (const subscription of this.subscriptions.values()) {
      this.sendWebSocketMessage({
        type: 'subscribe',
        subscriptionId: subscription.id,
        eventTypes: subscription.eventTypes,
        filters: {
          patientId: subscription.patientId,
          resourceType: subscription.resourceType,
          ehrSystem: subscription.ehrSystem
        }
      });
    }
  }

  // ============================================================================
  // Polling Management
  // ============================================================================

  private startPolling(): void {
    if (this.pollingInterval) {
      return; // Already polling
    }

    this.logInfo('Starting polling for real-time updates', {
      interval: this.config.pollingInterval
    });

    this.pollingInterval = setInterval(async () => {
      await this.performPollingUpdate();
    }, this.config.pollingInterval);

    this.emit('polling_started');
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.emit('polling_stopped');
      
      this.logInfo('Polling stopped');
    }
  }

  private async performPollingUpdate(): Promise<void> {
    if (this.isPollingActive) {
      return;
    }

    this.isPollingActive = true;
    
    try {
      this.logInfo('Performing polling update');

      // Simulate polling for updates - in real implementation, this would
      // make HTTP requests to check for updates since last polling time
      const mockEvents = await this.fetchUpdatesFromAPI(this.lastPollingTime);
      
      for (const event of mockEvents) {
        this.processIncomingEvent(event);
      }

      this.lastPollingTime = new Date();
      this.emit('polling_update_completed', { eventsReceived: mockEvents.length });

    } catch (error) {
      this.logError('Polling update failed', error);
      this.emit('polling_update_failed', error);
    } finally {
      this.isPollingActive = false;
    }
  }

  private async fetchUpdatesFromAPI(since: Date): Promise<RealTimeUpdateEvent[]> {
    // Mock implementation - in real system, this would make HTTP requests
    // to fetch updates from the EHR system since the last polling time
    
    // For demonstration, return empty array or mock events
    const mockEvents: RealTimeUpdateEvent[] = [];
    
    // Occasionally generate a mock event for testing
    if (Math.random() < 0.1) {
      mockEvents.push({
        type: 'observation_added',
        resourceType: 'Observation',
        resourceId: 'obs-' + Date.now(),
        patientId: 'patient-123',
        ehrSystem: 'OpenEMR',
        timestamp: new Date(),
        data: {
          observationType: 'vital-signs',
          value: '120/80'
        }
      });
    }

    return mockEvents;
  }

  // ============================================================================
  // Event Processing
  // ============================================================================

  private processIncomingEvent(event: RealTimeUpdateEvent): void {
    this.logInfo('Processing incoming real-time event', {
      type: event.type,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      patientId: event.patientId
    });

    // Find matching subscriptions
    const matchingSubscriptions = this.findMatchingSubscriptions(event);

    // Notify all matching subscriptions
    for (const subscription of matchingSubscriptions) {
      try {
        subscription.callback(event);
        
        // Update subscription metadata
        if (subscription.metadata) {
          subscription.metadata.lastEventReceived = new Date();
          subscription.metadata.eventCount++;
        }
      } catch (error) {
        this.logError('Error in subscription callback', error, {
          subscriptionId: subscription.id
        });
      }
    }

    // Emit event for general listeners
    this.emit('real_time_event', event);
  }

  private findMatchingSubscriptions(event: RealTimeUpdateEvent): RealTimeSubscription[] {
    const matching: RealTimeSubscription[] = [];

    for (const subscription of this.subscriptions.values()) {
      // Check event type match
      if (!subscription.eventTypes.includes(event.type)) {
        continue;
      }

      // Check patient ID filter
      if (subscription.patientId && subscription.patientId !== event.patientId) {
        continue;
      }

      // Check resource type filter
      if (subscription.resourceType && subscription.resourceType !== event.resourceType) {
        continue;
      }

      // Check EHR system filter
      if (subscription.ehrSystem && subscription.ehrSystem !== event.ehrSystem) {
        continue;
      }

      matching.push(subscription);
    }

    return matching;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private logInfo(message: string, context?: Record<string, unknown>): void {
    console.log(`[Real-Time Service] ${message}`, context || {});
  }

  private logError(message: string, error: unknown, context?: Record<string, unknown>): void {
    console.error(`[Real-Time Service] ${message}`, {
      error: error instanceof Error ? error.message : error,
      context: context || {}
    });
  }
}

/**
 * Create a real-time update service with default configuration
 */
export function createRealTimeService(config?: RealTimeServiceConfig): RealTimeUpdateService {
  return new RealTimeUpdateService(config);
}

/**
 * Real-time event listener type for convenience
 */
export type RealTimeEventListener = (event: RealTimeUpdateEvent) => void;

export default RealTimeUpdateService;