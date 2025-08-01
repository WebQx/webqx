/**
 * Messaging Component for Telehealth
 * 
 * Integrates with WebQX™ Matrix-based messaging infrastructure
 * for secure healthcare communications
 */

import { EventEmitter } from 'events';
import { 
  TelehealthComponent, 
  ComponentStatus, 
  MessagingConfig, 
  MessagingChannel 
} from '../../core/types/telehealth.types';

export class MessagingComponent extends EventEmitter implements TelehealthComponent {
  private config: MessagingConfig;
  private status: ComponentStatus;
  private matrixClient: any = null;
  private activeChannels: Map<string, MessagingChannel> = new Map();

  constructor(config: MessagingConfig) {
    super();
    this.config = config;
    this.status = {
      healthy: false,
      status: 'initializing',
      lastUpdated: new Date(),
      metrics: {
        uptime: 0,
        activeConnections: 0,
        errorCount: 0,
        successRate: 100
      }
    };
  }

  /**
   * Initialize the messaging component
   */
  async initialize(): Promise<void> {
    try {
      this.logInfo('Initializing Messaging Component');

      // Initialize Matrix client
      await this.initializeMatrixClient();
      
      // Setup event listeners
      this.setupEventListeners();

      this.status.status = 'running';
      this.status.healthy = true;
      this.status.lastUpdated = new Date();

      this.emit('initialized');
      this.logInfo('Messaging Component initialized successfully');
    } catch (error) {
      this.status.status = 'error';
      this.status.healthy = false;
      this.logError('Failed to initialize Messaging Component', error);
      throw error;
    }
  }

  /**
   * Start the messaging component
   */
  async start(): Promise<void> {
    this.logInfo('Starting Messaging Component');
    
    if (this.matrixClient) {
      await this.matrixClient.startClient();
    }

    this.status.status = 'running';
    this.status.lastUpdated = new Date();
    this.emit('started');
  }

  /**
   * Stop the messaging component
   */
  async stop(): Promise<void> {
    this.logInfo('Stopping Messaging Component');
    
    if (this.matrixClient) {
      await this.matrixClient.stopClient();
    }

    this.status.status = 'stopped';
    this.status.lastUpdated = new Date();
    this.emit('stopped');
  }

  /**
   * Initialize Matrix client
   */
  private async initializeMatrixClient(): Promise<void> {
    try {
      // Use existing WebQX Matrix infrastructure
      const { MatrixMessaging } = await import('../../../../messaging/core/matrix-client');
      
      this.matrixClient = new MatrixMessaging({
        homeserverUrl: this.config.matrix.homeserverUrl,
        accessToken: this.config.matrix.accessToken,
        userId: this.config.matrix.userId,
        deviceId: this.config.matrix.deviceId
      });

      // Setup Matrix event handlers
      this.matrixClient.on('Room.timeline', this.handleMatrixMessage.bind(this));
      this.matrixClient.on('RoomMember.membership', this.handleMembershipChange.bind(this));
      
      this.logInfo('Matrix client initialized');
    } catch (error) {
      // Fallback to mock implementation if Matrix client is not available
      this.logInfo('Matrix client not available, using mock implementation');
      this.matrixClient = this.createMockMatrixClient();
    }
  }

  /**
   * Create mock Matrix client for development/testing
   */
  private createMockMatrixClient(): any {
    return {
      startClient: async () => {
        this.logInfo('Mock Matrix client started');
      },
      stopClient: async () => {
        this.logInfo('Mock Matrix client stopped');
      },
      createRoom: async (options: any) => {
        const roomId = `!${Date.now()}:mock.matrix.server`;
        return { room_id: roomId };
      },
      sendMessage: async (roomId: string, content: any) => {
        this.logInfo(`Mock message sent to ${roomId}:`, content);
        return { event_id: `$${Date.now()}` };
      },
      joinRoom: async (roomId: string) => {
        this.logInfo(`Mock joined room: ${roomId}`);
        return {};
      },
      leaveRoom: async (roomId: string) => {
        this.logInfo(`Mock left room: ${roomId}`);
        return {};
      },
      invite: async (roomId: string, userId: string) => {
        this.logInfo(`Mock invited ${userId} to ${roomId}`);
        return {};
      },
      on: (event: string, handler: Function) => {
        // Mock event registration
      }
    };
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Health check interval
    setInterval(() => {
      this.updateHealthMetrics();
    }, this.config.healthCheckInterval || 30000);
  }

  /**
   * Handle Matrix message events
   */
  private handleMatrixMessage(event: any, room: any): void {
    if (event.getType() === 'm.room.message') {
      const content = event.getContent();
      const senderId = event.getSender();
      const roomId = room.roomId;

      this.emit('message:received', {
        channelId: roomId,
        messageId: event.getId(),
        content: content.body,
        senderId,
        timestamp: new Date(event.getTs())
      });

      this.logInfo(`Message received in room ${roomId} from ${senderId}`);
    }
  }

  /**
   * Handle Matrix membership changes
   */
  private handleMembershipChange(event: any, member: any): void {
    const membership = member.membership;
    const userId = member.userId;
    const roomId = member.roomId;

    if (membership === 'join') {
      this.emit('participant:joined', { channelId: roomId, participantId: userId });
    } else if (membership === 'leave') {
      this.emit('participant:left', { channelId: roomId, participantId: userId });
    }
  }

  /**
   * Create a consultation channel
   */
  async createConsultationChannel(consultationId: string): Promise<MessagingChannel> {
    try {
      const channelId = `consultation_${consultationId}`;
      const roomOptions = {
        name: `Consultation ${consultationId}`,
        topic: 'Secure healthcare consultation channel',
        preset: 'private_chat',
        is_direct: false,
        power_level_content_override: {
          events_default: 50,
          users_default: 0,
          state_default: 50,
          ban: 50,
          kick: 50,
          redact: 50,
          invite: 50
        }
      };

      const result = await this.matrixClient.createRoom(roomOptions);
      const matrixRoomId = result.room_id;

      const channel: MessagingChannel = {
        channelId: matrixRoomId,
        type: 'consultation',
        participants: [],
        createdAt: new Date(),
        lastActivity: new Date(),
        archived: false,
        metadata: {
          consultationId
        }
      };

      this.activeChannels.set(channelId, channel);
      this.updateConnectionCount();

      this.emit('channel:created', channel);
      this.logInfo(`Consultation channel created: ${channelId}`);

      return channel;
    } catch (error) {
      this.status.metrics!.errorCount++;
      this.logError('Failed to create consultation channel', error);
      throw error;
    }
  }

  /**
   * Add participant to channel
   */
  async addParticipant(channelId: string, participantId: string): Promise<void> {
    try {
      const channel = this.activeChannels.get(channelId);
      if (!channel) {
        throw new Error(`Channel not found: ${channelId}`);
      }

      await this.matrixClient.invite(channel.channelId, participantId);
      
      if (!channel.participants.includes(participantId)) {
        channel.participants.push(participantId);
        channel.lastActivity = new Date();
      }

      this.emit('participant:added', { channelId, participantId });
      this.logInfo(`Participant added to channel: ${channelId} - ${participantId}`);
    } catch (error) {
      this.status.metrics!.errorCount++;
      this.logError('Failed to add participant to channel', error);
      throw error;
    }
  }

  /**
   * Send message to channel
   */
  async sendMessage(channelId: string, content: string, senderId: string, messageType: 'text' | 'file' | 'image' = 'text'): Promise<string> {
    try {
      const channel = this.activeChannels.get(channelId);
      if (!channel) {
        throw new Error(`Channel not found: ${channelId}`);
      }

      const messageContent = {
        msgtype: messageType === 'text' ? 'm.text' : 'm.file',
        body: content,
        sender: senderId,
        timestamp: new Date().toISOString()
      };

      const result = await this.matrixClient.sendMessage(channel.channelId, messageContent);
      const messageId = result.event_id;

      channel.lastActivity = new Date();

      this.emit('message:sent', {
        channelId: channel.channelId,
        messageId,
        senderId,
        content,
        type: messageType
      });

      this.logInfo(`Message sent to channel: ${channelId} - ${messageId}`);
      return messageId;
    } catch (error) {
      this.status.metrics!.errorCount++;
      this.logError('Failed to send message', error);
      throw error;
    }
  }

  /**
   * Archive a channel
   */
  async archiveChannel(channelId: string): Promise<void> {
    try {
      const channel = this.activeChannels.get(channelId);
      if (!channel) {
        throw new Error(`Channel not found: ${channelId}`);
      }

      // In Matrix, we can't delete rooms, so we leave them instead
      await this.matrixClient.leaveRoom(channel.channelId);
      
      channel.archived = true;
      channel.lastActivity = new Date();

      this.emit('channel:archived', { channelId });
      this.logInfo(`Channel archived: ${channelId}`);
    } catch (error) {
      this.status.metrics!.errorCount++;
      this.logError('Failed to archive channel', error);
      throw error;
    }
  }

  /**
   * Get channel history
   */
  async getChannelHistory(channelId: string, limit: number = 50): Promise<any[]> {
    try {
      const channel = this.activeChannels.get(channelId);
      if (!channel) {
        throw new Error(`Channel not found: ${channelId}`);
      }

      // In a real implementation, this would fetch from Matrix room timeline
      this.logInfo(`Fetching channel history: ${channelId} (limit: ${limit})`);
      
      // Return mock history for now
      return [
        {
          messageId: 'msg1',
          content: 'Welcome to the consultation',
          senderId: 'provider@webqx.health',
          timestamp: new Date(),
          type: 'text'
        }
      ];
    } catch (error) {
      this.logError('Failed to get channel history', error);
      throw error;
    }
  }

  /**
   * Create emergency channel
   */
  async createEmergencyChannel(emergencyId: string, participants: string[]): Promise<MessagingChannel> {
    try {
      const channelId = `emergency_${emergencyId}`;
      const roomOptions = {
        name: `Emergency ${emergencyId}`,
        topic: 'URGENT: Emergency healthcare communication',
        preset: 'private_chat',
        is_direct: false,
        initial_state: [
          {
            type: 'm.room.power_levels',
            content: {
              events_default: 0, // Allow all participants to send messages
              users_default: 50,
              state_default: 50
            }
          }
        ]
      };

      const result = await this.matrixClient.createRoom(roomOptions);
      const matrixRoomId = result.room_id;

      const channel: MessagingChannel = {
        channelId: matrixRoomId,
        type: 'emergency',
        participants: [],
        createdAt: new Date(),
        lastActivity: new Date(),
        archived: false,
        metadata: {
          emergencyId,
          priority: 'high'
        }
      };

      // Add all participants
      for (const participantId of participants) {
        await this.addParticipant(channelId, participantId);
      }

      this.activeChannels.set(channelId, channel);
      this.updateConnectionCount();

      this.emit('emergency:channel:created', channel);
      this.logInfo(`Emergency channel created: ${channelId}`);

      return channel;
    } catch (error) {
      this.status.metrics!.errorCount++;
      this.logError('Failed to create emergency channel', error);
      throw error;
    }
  }

  /**
   * Update connection count metric
   */
  private updateConnectionCount(): void {
    if (this.status.metrics) {
      this.status.metrics.activeConnections = this.activeChannels.size;
    }
  }

  /**
   * Update health metrics
   */
  private updateHealthMetrics(): void {
    const now = new Date();
    if (this.status.metrics) {
      this.status.metrics.uptime = now.getTime() - this.status.lastUpdated.getTime();
      
      // Calculate success rate (simplified)
      const totalOperations = this.status.metrics.errorCount + 100;
      this.status.metrics.successRate = (100 / totalOperations) * 100;
    }
    
    this.status.lastUpdated = now;
  }

  /**
   * Get component status
   */
  getStatus(): ComponentStatus {
    return { ...this.status };
  }

  /**
   * Handle external events from other components
   */
  async handleExternalEvent(eventName: string, data: any): Promise<void> {
    switch (eventName) {
      case 'consultation:started':
        if (data.type === 'video' || data.type === 'hybrid') {
          await this.createConsultationChannel(data.consultationId);
        }
        break;
      case 'patient:selected':
        this.logInfo(`Patient selected for messaging: ${data.patientId}`);
        break;
      default:
        // Ignore unknown events
        break;
    }
  }

  /**
   * Get component configuration
   */
  getConfig(): MessagingConfig {
    return { ...this.config };
  }

  /**
   * Update component configuration
   */
  async updateConfig(config: Partial<MessagingConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    this.logInfo('Messaging configuration updated');
  }

  /**
   * Get active channels
   */
  getActiveChannels(): MessagingChannel[] {
    return Array.from(this.activeChannels.values()).filter(channel => !channel.archived);
  }

  /**
   * Get channel by ID
   */
  getChannel(channelId: string): MessagingChannel | undefined {
    return this.activeChannels.get(channelId);
  }

  /**
   * Log info message
   */
  private logInfo(message: string, context?: any): void {
    console.log(`[Messaging Component] ${message}`, context || '');
  }

  /**
   * Log error message
   */
  private logError(message: string, error: any): void {
    console.error(`[Messaging Component] ${message}`, error);
  }
}