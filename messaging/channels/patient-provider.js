/**
 * WebQX™ Patient-Provider Channel Management
 * 
 * Manages secure communications between patients and healthcare providers.
 * Provides HIPAA-compliant messaging with proper access controls and audit trails.
 */

const { AuditLogger } = require('../utils/audit');
const { MessageValidator } = require('../utils/validation');

class PatientProviderChannel {
  constructor(matrixClient, options = {}) {
    this.client = matrixClient;
    this.auditLogger = new AuditLogger();
    this.validator = new MessageValidator();
    
    this.options = {
      enableEncryption: options.enableEncryption !== false,
      requireProviderVerification: options.requireProviderVerification !== false,
      enableFileSharing: options.enableFileSharing !== false,
      maxParticipants: options.maxParticipants || 10, // Patient + care team
      messageRetentionDays: options.messageRetentionDays || 2555, // 7 years
      ...options
    };

    this.activeChannels = new Map();
    this.patientProviderMappings = new Map();
  }

  /**
   * Create a patient-provider channel
   */
  async createPatientProviderChannel(patientId, providerId, options = {}) {
    try {
      // Validate patient and provider IDs
      const patientValidation = this.validator.validateUserId(patientId);
      const providerValidation = this.validator.validateUserId(providerId);

      if (!patientValidation.isValid || !providerValidation.isValid) {
        throw new Error('Invalid patient or provider ID format');
      }

      // Check if channel already exists
      const existingChannel = this.findExistingChannel(patientId, providerId);
      if (existingChannel && !options.allowDuplicate) {
        this.auditLogger.logInfo('Returning existing patient-provider channel', {
          patientId,
          providerId,
          channelId: existingChannel.roomId
        });
        return existingChannel.roomId;
      }

      // Create channel name
      const channelName = this.generateChannelName(patientId, providerId, options);

      // Configure channel options
      const channelOptions = {
        name: channelName,
        topic: `Secure communication between patient and healthcare provider`,
        channelType: 'patient-provider',
        isDirect: true,
        visibility: 'private',
        inviteUsers: [patientId, providerId],
        disableEncryption: !this.options.enableEncryption,
        specialty: options.specialty,
        matrixOptions: {
          preset: 'private_chat',
          is_direct: true,
          creation_content: {
            'm.federate': false // Disable federation for healthcare data
          }
        }
      };

      // Add care team members if specified
      if (options.careTeamMembers && Array.isArray(options.careTeamMembers)) {
        channelOptions.inviteUsers.push(...options.careTeamMembers);
        channelOptions.isDirect = false;
        channelOptions.matrixOptions.preset = 'private';
      }

      // Create the channel
      const roomId = await this.client.createChannel(channelName, channelOptions);

      // Store channel metadata
      const channelMetadata = {
        roomId,
        patientId,
        providerId,
        careTeamMembers: options.careTeamMembers || [],
        specialty: options.specialty,
        createdAt: new Date().toISOString(),
        isActive: true,
        channelType: 'patient-provider',
        lastActivity: new Date().toISOString()
      };

      this.activeChannels.set(roomId, channelMetadata);
      this.updatePatientProviderMapping(patientId, providerId, roomId);

      // Set up channel permissions
      await this.configureChannelPermissions(roomId, channelMetadata);

      // Send welcome message
      if (options.sendWelcomeMessage !== false) {
        await this.sendWelcomeMessage(roomId, channelMetadata);
      }

      this.auditLogger.log('channel', 'Patient-provider channel created', {
        roomId,
        patientId,
        providerId,
        specialty: options.specialty,
        careTeamSize: channelMetadata.careTeamMembers.length,
        encrypted: this.options.enableEncryption
      });

      return roomId;

    } catch (error) {
      this.auditLogger.logError('Failed to create patient-provider channel', {
        patientId,
        providerId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Send a message in a patient-provider channel
   */
  async sendMessage(roomId, senderId, message, options = {}) {
    try {
      // Validate channel exists and sender has access
      const channel = this.activeChannels.get(roomId);
      if (!channel) {
        throw new Error('Channel not found');
      }

      if (!this.hasChannelAccess(senderId, channel)) {
        throw new Error('Access denied to channel');
      }

      // Prepare message content with healthcare metadata
      const messageContent = {
        body: message,
        msgtype: options.msgtype || 'm.text',
        'webqx.metadata': {
          patientId: channel.patientId,
          providerId: channel.providerId,
          specialty: channel.specialty,
          timestamp: new Date().toISOString(),
          senderId,
          channelType: 'patient-provider',
          urgency: options.urgency || 'normal'
        }
      };

      // Add provider verification if required
      if (this.options.requireProviderVerification && this.isProvider(senderId)) {
        messageContent['webqx.metadata'].providerVerified = true;
        messageContent['webqx.metadata'].verificationMethod = 'digital_signature';
      }

      // Send the message
      const eventId = await this.client.sendMessage(roomId, message, {
        ...options,
        patientId: channel.patientId,
        providerId: channel.providerId,
        specialty: channel.specialty,
        content: messageContent
      });

      // Update channel activity
      this.updateChannelActivity(roomId);

      this.auditLogger.log('message', 'Patient-provider message sent', {
        roomId,
        eventId,
        senderId,
        patientId: channel.patientId,
        providerId: channel.providerId,
        urgency: options.urgency,
        messageLength: message.length
      });

      return eventId;

    } catch (error) {
      this.auditLogger.logError('Failed to send patient-provider message', {
        roomId,
        senderId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Share a file in a patient-provider channel
   */
  async shareFile(roomId, senderId, file, options = {}) {
    try {
      if (!this.options.enableFileSharing) {
        throw new Error('File sharing is disabled for patient-provider channels');
      }

      const channel = this.activeChannels.get(roomId);
      if (!channel) {
        throw new Error('Channel not found');
      }

      if (!this.hasChannelAccess(senderId, channel)) {
        throw new Error('Access denied to channel');
      }

      // Upload file with healthcare context
      const eventId = await this.client.uploadFile(roomId, file, {
        ...options,
        patientId: channel.patientId,
        providerId: channel.providerId,
        isHealthcareDocument: true,
        documentType: options.documentType || 'general',
        senderId
      });

      this.updateChannelActivity(roomId);

      this.auditLogger.log('file', 'Healthcare document shared', {
        roomId,
        eventId,
        senderId,
        filename: file.name,
        fileSize: file.size,
        documentType: options.documentType,
        patientId: channel.patientId,
        providerId: channel.providerId
      });

      return eventId;

    } catch (error) {
      this.auditLogger.logError('Failed to share file in patient-provider channel', {
        roomId,
        senderId,
        filename: file.name,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Add care team member to channel
   */
  async addCareTeamMember(roomId, memberId, addedBy, role = 'care_team') {
    try {
      const channel = this.activeChannels.get(roomId);
      if (!channel) {
        throw new Error('Channel not found');
      }

      // Verify that the person adding has permission (usually the provider)
      if (!this.canManageChannel(addedBy, channel)) {
        throw new Error('Insufficient permissions to add care team members');
      }

      // Check team size limit
      if (channel.careTeamMembers.length >= this.options.maxParticipants - 2) {
        throw new Error('Maximum care team size reached');
      }

      // Invite the care team member
      await this.client.client.invite(roomId, memberId);

      // Update channel metadata
      channel.careTeamMembers.push({
        userId: memberId,
        role,
        addedBy,
        addedAt: new Date().toISOString()
      });

      this.activeChannels.set(roomId, channel);

      this.auditLogger.log('membership', 'Care team member added', {
        roomId,
        memberId,
        addedBy,
        role,
        patientId: channel.patientId,
        providerId: channel.providerId
      });

      return true;

    } catch (error) {
      this.auditLogger.logError('Failed to add care team member', {
        roomId,
        memberId,
        addedBy,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get patient's channels
   */
  getPatientChannels(patientId) {
    const channels = [];
    
    for (const [roomId, channel] of this.activeChannels) {
      if (channel.patientId === patientId && channel.isActive) {
        channels.push({
          roomId,
          providerId: channel.providerId,
          specialty: channel.specialty,
          careTeamSize: channel.careTeamMembers.length,
          createdAt: channel.createdAt,
          lastActivity: channel.lastActivity
        });
      }
    }

    return channels.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
  }

  /**
   * Get provider's channels
   */
  getProviderChannels(providerId) {
    const channels = [];
    
    for (const [roomId, channel] of this.activeChannels) {
      if (channel.providerId === providerId && channel.isActive) {
        channels.push({
          roomId,
          patientId: channel.patientId,
          specialty: channel.specialty,
          careTeamSize: channel.careTeamMembers.length,
          createdAt: channel.createdAt,
          lastActivity: channel.lastActivity
        });
      }
    }

    return channels.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
  }

  /**
   * Archive a channel
   */
  async archiveChannel(roomId, archivedBy, reason = 'Treatment completed') {
    try {
      const channel = this.activeChannels.get(roomId);
      if (!channel) {
        throw new Error('Channel not found');
      }

      if (!this.canManageChannel(archivedBy, channel)) {
        throw new Error('Insufficient permissions to archive channel');
      }

      // Send archive notification
      await this.client.sendMessage(roomId, 
        `This channel has been archived. Reason: ${reason}`, {
          msgtype: 'm.notice',
          'webqx.metadata': {
            action: 'channel_archived',
            archivedBy,
            reason,
            timestamp: new Date().toISOString()
          }
        }
      );

      // Update channel status
      channel.isActive = false;
      channel.archivedAt = new Date().toISOString();
      channel.archivedBy = archivedBy;
      channel.archiveReason = reason;

      this.activeChannels.set(roomId, channel);

      this.auditLogger.log('channel', 'Patient-provider channel archived', {
        roomId,
        archivedBy,
        reason,
        patientId: channel.patientId,
        providerId: channel.providerId
      });

      return true;

    } catch (error) {
      this.auditLogger.logError('Failed to archive channel', {
        roomId,
        archivedBy,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Helper methods
   */

  generateChannelName(patientId, providerId, options) {
    const patientName = options.patientName || `Patient-${patientId.substring(1, 7)}`;
    const providerName = options.providerName || `Provider-${providerId.substring(1, 7)}`;
    const specialty = options.specialty ? ` (${options.specialty})` : '';
    
    return `${patientName} ↔ ${providerName}${specialty}`;
  }

  findExistingChannel(patientId, providerId) {
    for (const [roomId, channel] of this.activeChannels) {
      if (channel.patientId === patientId && 
          channel.providerId === providerId && 
          channel.isActive) {
        return channel;
      }
    }
    return null;
  }

  updatePatientProviderMapping(patientId, providerId, roomId) {
    const key = `${patientId}:${providerId}`;
    const mapping = this.patientProviderMappings.get(key) || { channels: [] };
    mapping.channels.push(roomId);
    this.patientProviderMappings.set(key, mapping);
  }

  hasChannelAccess(userId, channel) {
    return userId === channel.patientId || 
           userId === channel.providerId ||
           channel.careTeamMembers.some(member => member.userId === userId);
  }

  canManageChannel(userId, channel) {
    // Only providers can manage channels
    return userId === channel.providerId;
  }

  isProvider(userId) {
    // This would integrate with WebQX™'s user management system
    return userId.includes('provider') || userId.includes('doctor') || userId.includes('nurse');
  }

  updateChannelActivity(roomId) {
    const channel = this.activeChannels.get(roomId);
    if (channel) {
      channel.lastActivity = new Date().toISOString();
      this.activeChannels.set(roomId, channel);
    }
  }

  async configureChannelPermissions(roomId, channel) {
    // Set room power levels for healthcare context
    const powerLevels = {
      users: {},
      events: {
        'm.room.name': 50,
        'm.room.topic': 50,
        'm.room.avatar': 50,
        'm.room.encryption': 100 // Only admin can change encryption
      },
      users_default: 0,
      events_default: 0,
      state_default: 50,
      ban: 50,
      kick: 50,
      redact: 50,
      invite: 25
    };

    // Provider has elevated permissions
    powerLevels.users[channel.providerId] = 50;
    
    // Patient has basic permissions
    powerLevels.users[channel.patientId] = 25;

    // Care team members have limited permissions
    channel.careTeamMembers.forEach(member => {
      powerLevels.users[member.userId] = 25;
    });

    try {
      await this.client.client.sendStateEvent(roomId, 'm.room.power_levels', powerLevels);
    } catch (error) {
      this.auditLogger.logWarning('Failed to set channel permissions', {
        roomId,
        error: error.message
      });
    }
  }

  async sendWelcomeMessage(roomId, channel) {
    const welcomeMessage = `
🏥 **Welcome to your secure healthcare communication channel**

This is a private, encrypted channel for communication between:
• Patient: ${channel.patientId}
• Provider: ${channel.providerId}
${channel.specialty ? `• Specialty: ${channel.specialty}` : ''}

**Important:**
• All messages are encrypted and HIPAA-compliant
• This channel is for healthcare-related communications only
• Emergency situations should use appropriate emergency services
${this.options.enableFileSharing ? '• You can securely share healthcare documents' : ''}

Your privacy and security are our top priorities.
    `.trim();

    await this.client.sendMessage(roomId, welcomeMessage, {
      msgtype: 'm.notice',
      'webqx.metadata': {
        messageType: 'welcome',
        channelType: 'patient-provider',
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Get channel statistics
   */
  getChannelStats() {
    const activeChannels = Array.from(this.activeChannels.values()).filter(c => c.isActive);
    const archivedChannels = Array.from(this.activeChannels.values()).filter(c => !c.isActive);

    const specialtyCounts = {};
    activeChannels.forEach(channel => {
      const specialty = channel.specialty || 'general';
      specialtyCounts[specialty] = (specialtyCounts[specialty] || 0) + 1;
    });

    return {
      totalChannels: this.activeChannels.size,
      activeChannels: activeChannels.length,
      archivedChannels: archivedChannels.length,
      uniquePatients: new Set(activeChannels.map(c => c.patientId)).size,
      uniqueProviders: new Set(activeChannels.map(c => c.providerId)).size,
      specialtyDistribution: specialtyCounts,
      averageCareTeamSize: activeChannels.length > 0 ? 
        activeChannels.reduce((sum, c) => sum + c.careTeamMembers.length, 0) / activeChannels.length : 0
    };
  }
}

module.exports = { PatientProviderChannel };