/**
 * WebQX™ Matrix Client Configuration
 * 
 * Core Matrix protocol client for secure healthcare communications.
 * Provides encrypted messaging infrastructure with HIPAA compliance features.
 */

const { MatrixClient, createClient } = require('matrix-js-sdk');
const { AuditLogger } = require('../utils/audit');
const { MessageValidator } = require('../utils/validation');
const config = require('./config');

class MatrixMessaging {
  constructor(options = {}) {
    this.options = {
      homeserverUrl: options.homeserverUrl || config.MATRIX_HOMESERVER_URL,
      accessToken: options.accessToken || config.MATRIX_ACCESS_TOKEN,
      userId: options.userId || config.MATRIX_USER_ID,
      deviceId: options.deviceId || config.MATRIX_DEVICE_ID,
      enableE2EE: options.enableE2EE !== false && config.MATRIX_ENABLE_E2EE,
      ...options
    };

    this.client = null;
    this.isStarted = false;
    this.auditLogger = new AuditLogger();
    this.validator = new MessageValidator();
    this.plugins = new Map();
    this.channels = new Map();
  }

  /**
   * Initialize Matrix client and start sync
   */
  async start() {
    try {
      // Create Matrix client
      this.client = createClient({
        baseUrl: this.options.homeserverUrl,
        accessToken: this.options.accessToken,
        userId: this.options.userId,
        deviceId: this.options.deviceId,
        sessionStore: new MatrixInMemoryStore(),
        cryptoStore: new MatrixInMemoryStore(),
        verificationMethods: [
          'm.sas.v1'  // Short Authentication String verification
        ]
      });

      // Set up event handlers
      this.setupEventHandlers();

      // Initialize encryption if enabled
      if (this.options.enableE2EE) {
        await this.initializeEncryption();
      }

      // Start syncing with homeserver
      await this.client.startClient({ initialSyncLimit: 10 });

      this.isStarted = true;
      this.auditLogger.log('system', 'Matrix client started successfully', {
        userId: this.options.userId,
        homeserver: this.options.homeserverUrl,
        encryptionEnabled: this.options.enableE2EE
      });

      return true;
    } catch (error) {
      this.auditLogger.log('error', 'Failed to start Matrix client', {
        error: error.message,
        userId: this.options.userId
      });
      throw error;
    }
  }

  /**
   * Stop Matrix client
   */
  async stop() {
    if (this.client && this.isStarted) {
      this.client.stopClient();
      this.isStarted = false;
      this.auditLogger.log('system', 'Matrix client stopped');
    }
  }

  /**
   * Set up event handlers for Matrix events
   */
  setupEventHandlers() {
    // Handle incoming messages
    this.client.on('Room.timeline', async (event, room, toStartOfTimeline) => {
      if (event.getType() !== 'm.room.message' || toStartOfTimeline) return;

      await this.handleIncomingMessage(event, room);
    });

    // Handle room membership changes
    this.client.on('RoomMember.membership', async (event, member) => {
      await this.handleMembershipChange(event, member);
    });

    // Handle encryption events
    this.client.on('Event.decrypted', async (event) => {
      await this.handleDecryptedEvent(event);
    });

    // Handle sync state changes
    this.client.on('sync', (state, prevState, data) => {
      this.auditLogger.log('sync', `Sync state: ${state}`, {
        prevState,
        nextBatch: data?.nextBatch
      });
    });
  }

  /**
   * Initialize end-to-end encryption
   */
  async initializeEncryption() {
    if (!this.client.isCryptoEnabled()) {
      await this.client.initCrypto();
    }

    // Set up cross-signing if not already done
    if (!this.client.getCrossSigningId()) {
      this.auditLogger.log('crypto', 'Setting up cross-signing');
      // Note: In production, this would require user interaction
      // for security key verification
    }

    this.auditLogger.log('crypto', 'Encryption initialized');
  }

  /**
   * Create a new room/channel
   */
  async createChannel(name, options = {}) {
    try {
      const roomOptions = {
        name,
        topic: options.topic || `WebQX™ ${name}`,
        visibility: options.visibility || 'private',
        preset: options.preset || 'private_chat',
        is_direct: options.isDirect || false,
        invite: options.inviteUsers || [],
        ...options.matrixOptions
      };

      // Enable encryption for healthcare communications
      if (this.options.enableE2EE && !options.disableEncryption) {
        roomOptions.initial_state = [
          {
            type: 'm.room.encryption',
            content: {
              algorithm: 'm.megolm.v1.aes-sha2'
            }
          }
        ];
      }

      const response = await this.client.createRoom(roomOptions);
      const roomId = response.room_id;

      this.channels.set(roomId, {
        name,
        type: options.channelType || 'general',
        createdAt: new Date().toISOString(),
        specialtyConfig: options.specialty || null
      });

      this.auditLogger.log('channel', 'Channel created', {
        roomId,
        name,
        type: options.channelType,
        encrypted: this.options.enableE2EE && !options.disableEncryption
      });

      return roomId;
    } catch (error) {
      this.auditLogger.log('error', 'Failed to create channel', {
        name,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Send a message to a channel
   */
  async sendMessage(roomId, message, options = {}) {
    try {
      // Validate message content
      const validationResult = this.validator.validateMessage(message, options);
      if (!validationResult.isValid) {
        throw new Error(`Message validation failed: ${validationResult.errors.join(', ')}`);
      }

      const content = {
        msgtype: options.msgtype || 'm.text',
        body: message,
        ...options.content
      };

      // Add metadata for healthcare context
      if (options.patientId || options.providerId || options.specialty) {
        content['webqx.metadata'] = {
          patientId: options.patientId,
          providerId: options.providerId,
          specialty: options.specialty,
          timestamp: new Date().toISOString()
        };
      }

      const response = await this.client.sendEvent(roomId, 'm.room.message', content);

      this.auditLogger.log('message', 'Message sent', {
        roomId,
        eventId: response.event_id,
        messageLength: message.length,
        specialty: options.specialty,
        encrypted: this.client.isRoomEncrypted(roomId)
      });

      return response.event_id;
    } catch (error) {
      this.auditLogger.log('error', 'Failed to send message', {
        roomId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Upload a file to a channel
   */
  async uploadFile(roomId, file, options = {}) {
    try {
      // Validate file
      const fileValidation = this.validator.validateFile(file, options);
      if (!fileValidation.isValid) {
        throw new Error(`File validation failed: ${fileValidation.errors.join(', ')}`);
      }

      // Upload file to Matrix content repository
      const uploadResponse = await this.client.uploadContent(file, {
        name: options.filename || file.name,
        type: file.type,
        onlyContentUri: false
      });

      // Send file message
      const content = {
        msgtype: 'm.file',
        body: options.filename || file.name,
        url: uploadResponse.content_uri,
        info: {
          size: file.size,
          mimetype: file.type
        }
      };

      // Add healthcare metadata
      if (options.patientId || options.isHealthcareDocument) {
        content['webqx.file_metadata'] = {
          patientId: options.patientId,
          documentType: options.documentType,
          isHealthcareDocument: options.isHealthcareDocument || false,
          uploadedAt: new Date().toISOString()
        };
      }

      const response = await this.client.sendEvent(roomId, 'm.room.message', content);

      this.auditLogger.log('file', 'File uploaded', {
        roomId,
        eventId: response.event_id,
        filename: options.filename || file.name,
        fileSize: file.size,
        mimeType: file.type,
        isHealthcareDocument: options.isHealthcareDocument || false
      });

      return response.event_id;
    } catch (error) {
      this.auditLogger.log('error', 'Failed to upload file', {
        roomId,
        filename: options.filename || file.name,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle incoming message events
   */
  async handleIncomingMessage(event, room) {
    const message = {
      eventId: event.getId(),
      roomId: room.roomId,
      sender: event.getSender(),
      content: event.getContent(),
      timestamp: new Date(event.getTs()).toISOString(),
      encrypted: event.isEncrypted()
    };

    // Log message reception
    this.auditLogger.log('message', 'Message received', {
      roomId: room.roomId,
      eventId: event.getId(),
      sender: event.getSender(),
      encrypted: event.isEncrypted()
    });

    // Process through plugins
    for (const [pluginName, plugin] of this.plugins) {
      try {
        await plugin.onMessage(message, room);
      } catch (error) {
        this.auditLogger.log('error', `Plugin ${pluginName} failed to process message`, {
          error: error.message,
          eventId: event.getId()
        });
      }
    }
  }

  /**
   * Handle membership change events
   */
  async handleMembershipChange(event, member) {
    const change = {
      roomId: member.roomId,
      userId: member.userId,
      membership: member.membership,
      prevMembership: member.events.member?.getContent().membership,
      timestamp: new Date(event.getTs()).toISOString()
    };

    this.auditLogger.log('membership', 'Membership changed', change);

    // Process through plugins
    for (const [pluginName, plugin] of this.plugins) {
      try {
        if (change.membership === 'join' && plugin.onChannelJoin) {
          await plugin.onChannelJoin(change.userId, change.roomId);
        } else if (change.membership === 'leave' && plugin.onChannelLeave) {
          await plugin.onChannelLeave(change.userId, change.roomId);
        }
      } catch (error) {
        this.auditLogger.log('error', `Plugin ${pluginName} failed to process membership change`, {
          error: error.message,
          userId: change.userId,
          roomId: change.roomId
        });
      }
    }
  }

  /**
   * Handle decrypted events
   */
  async handleDecryptedEvent(event) {
    this.auditLogger.log('crypto', 'Event decrypted', {
      eventId: event.getId(),
      roomId: event.getRoomId(),
      eventType: event.getType()
    });

    // Process through plugins
    for (const [pluginName, plugin] of this.plugins) {
      try {
        if (plugin.onEncryptedMessage) {
          await plugin.onEncryptedMessage(event);
        }
      } catch (error) {
        this.auditLogger.log('error', `Plugin ${pluginName} failed to process encrypted message`, {
          error: error.message,
          eventId: event.getId()
        });
      }
    }
  }

  /**
   * Register a plugin
   */
  registerPlugin(name, plugin) {
    this.plugins.set(name, plugin);
    this.auditLogger.log('plugin', 'Plugin registered', { name });
  }

  /**
   * Unregister a plugin
   */
  unregisterPlugin(name) {
    this.plugins.delete(name);
    this.auditLogger.log('plugin', 'Plugin unregistered', { name });
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isStarted: this.isStarted,
      isConnected: this.client?.getSyncState() === 'SYNCING',
      userId: this.options.userId,
      deviceId: this.options.deviceId,
      encryptionEnabled: this.options.enableE2EE,
      activeChannels: this.channels.size,
      registeredPlugins: Array.from(this.plugins.keys())
    };
  }
}

module.exports = { MatrixMessaging };