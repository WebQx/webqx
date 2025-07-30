/**
 * WebQX™ Provider-Admin Channel Management
 * 
 * Manages secure communications between healthcare providers and administrators.
 * Handles policy updates, system notifications, and administrative communications.
 */

const { AuditLogger } = require('../utils/audit');
const { MessageValidator } = require('../utils/validation');

class ProviderAdminChannel {
  constructor(matrixClient, options = {}) {
    this.client = matrixClient;
    this.auditLogger = new AuditLogger();
    this.validator = new MessageValidator();
    
    this.options = {
      enableEncryption: options.enableEncryption !== false,
      enableBroadcast: options.enableBroadcast !== false,
      maxParticipants: options.maxParticipants || 500,
      messageRetentionDays: options.messageRetentionDays || 2555,
      requireAdminApproval: options.requireAdminApproval !== false,
      ...options
    };

    this.adminChannels = new Map();
    this.broadcastChannels = new Map();
    this.pendingMessages = new Map(); // For admin approval workflow
  }

  /**
   * Create a provider-admin channel
   */
  async createProviderAdminChannel(adminId, options = {}) {
    try {
      // Validate admin ID
      const adminValidation = this.validator.validateUserId(adminId);
      if (!adminValidation.isValid) {
        throw new Error('Invalid admin ID format');
      }

      const channelType = options.channelType || 'general_admin';
      const channelName = this.generateAdminChannelName(channelType, options);

      // Configure channel options
      const channelOptions = {
        name: channelName,
        topic: options.topic || `Administrative communications - ${channelType}`,
        channelType: 'provider-admin',
        visibility: 'private',
        inviteUsers: [adminId],
        disableEncryption: !this.options.enableEncryption,
        matrixOptions: {
          preset: 'private',
          creation_content: {
            'm.federate': false // Disable federation for admin communications
          }
        }
      };

      // Add initial providers if specified
      if (options.initialProviders && Array.isArray(options.initialProviders)) {
        channelOptions.inviteUsers.push(...options.initialProviders);
      }

      // Create the channel
      const roomId = await this.client.createChannel(channelName, channelOptions);

      // Store channel metadata
      const channelMetadata = {
        roomId,
        adminId,
        channelType,
        department: options.department,
        specialty: options.specialty,
        isBroadcast: options.isBroadcast || false,
        requiresApproval: options.requiresApproval || this.options.requireAdminApproval,
        createdAt: new Date().toISOString(),
        isActive: true,
        lastActivity: new Date().toISOString(),
        memberCount: channelOptions.inviteUsers.length
      };

      this.adminChannels.set(roomId, channelMetadata);

      if (channelMetadata.isBroadcast) {
        this.broadcastChannels.set(roomId, channelMetadata);
      }

      // Set up channel permissions
      await this.configureAdminChannelPermissions(roomId, channelMetadata);

      // Send welcome message
      if (options.sendWelcomeMessage !== false) {
        await this.sendAdminWelcomeMessage(roomId, channelMetadata);
      }

      this.auditLogger.log('channel', 'Provider-admin channel created', {
        roomId,
        adminId,
        channelType,
        department: options.department,
        isBroadcast: channelMetadata.isBroadcast,
        encrypted: this.options.enableEncryption
      });

      return roomId;

    } catch (error) {
      this.auditLogger.logError('Failed to create provider-admin channel', {
        adminId,
        channelType: options.channelType,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Send administrative message
   */
  async sendAdminMessage(roomId, senderId, message, options = {}) {
    try {
      const channel = this.adminChannels.get(roomId);
      if (!channel) {
        throw new Error('Admin channel not found');
      }

      if (!this.hasAdminChannelAccess(senderId, channel)) {
        throw new Error('Access denied to admin channel');
      }

      // Check if message requires approval
      if (channel.requiresApproval && !this.isAdmin(senderId)) {
        return await this.submitMessageForApproval(roomId, senderId, message, options);
      }

      // Prepare message content
      const messageContent = {
        body: message,
        msgtype: options.msgtype || 'm.text',
        'webqx.admin_metadata': {
          adminId: channel.adminId,
          channelType: channel.channelType,
          department: channel.department,
          timestamp: new Date().toISOString(),
          senderId,
          messageType: options.messageType || 'general',
          priority: options.priority || 'normal',
          requiresAck: options.requiresAck || false
        }
      };

      // Add policy reference if applicable
      if (options.policyId) {
        messageContent['webqx.admin_metadata'].policyId = options.policyId;
        messageContent['webqx.admin_metadata'].policyVersion = options.policyVersion;
      }

      // Send the message
      const eventId = await this.client.sendMessage(roomId, message, {
        ...options,
        content: messageContent
      });

      // Update channel activity
      this.updateAdminChannelActivity(roomId);

      // Handle acknowledgment requirements
      if (options.requiresAck) {
        await this.trackAcknowledgmentRequirement(roomId, eventId, messageContent);
      }

      this.auditLogger.log('admin_message', 'Administrative message sent', {
        roomId,
        eventId,
        senderId,
        messageType: options.messageType,
        priority: options.priority,
        requiresAck: options.requiresAck,
        channelType: channel.channelType
      });

      return eventId;

    } catch (error) {
      this.auditLogger.logError('Failed to send admin message', {
        roomId,
        senderId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Broadcast message to all providers
   */
  async broadcastToProviders(senderId, message, options = {}) {
    try {
      if (!this.isAdmin(senderId)) {
        throw new Error('Only admins can send broadcast messages');
      }

      // Find or create broadcast channel
      let broadcastRoomId = options.broadcastRoomId;
      if (!broadcastRoomId) {
        broadcastRoomId = await this.findOrCreateBroadcastChannel(senderId, options);
      }

      // Prepare broadcast message
      const broadcastContent = {
        body: message,
        msgtype: 'm.notice',
        'webqx.broadcast_metadata': {
          broadcastId: `broadcast_${Date.now()}`,
          senderId,
          broadcastType: options.broadcastType || 'general',
          department: options.department,
          specialty: options.specialty,
          timestamp: new Date().toISOString(),
          priority: options.priority || 'normal',
          expiresAt: options.expiresAt,
          requiresAck: options.requiresAck || false
        }
      };

      // Send broadcast message
      const eventId = await this.client.sendMessage(broadcastRoomId, message, {
        ...options,
        content: broadcastContent
      });

      // Track broadcast metrics
      await this.trackBroadcastMetrics(broadcastRoomId, eventId, broadcastContent);

      this.auditLogger.log('broadcast', 'Message broadcast to providers', {
        broadcastRoomId,
        eventId,
        senderId,
        broadcastType: options.broadcastType,
        department: options.department,
        priority: options.priority
      });

      return {
        eventId,
        broadcastRoomId,
        broadcastId: broadcastContent['webqx.broadcast_metadata'].broadcastId
      };

    } catch (error) {
      this.auditLogger.logError('Failed to broadcast message', {
        senderId,
        broadcastType: options.broadcastType,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Send policy update notification
   */
  async sendPolicyUpdate(policyId, policyVersion, updateDetails, options = {}) {
    try {
      const senderId = options.senderId;
      if (!senderId || !this.isAdmin(senderId)) {
        throw new Error('Policy updates can only be sent by administrators');
      }

      const policyMessage = this.formatPolicyUpdateMessage(policyId, policyVersion, updateDetails);

      const broadcastOptions = {
        ...options,
        messageType: 'policy_update',
        broadcastType: 'policy',
        priority: 'high',
        requiresAck: true,
        policyId,
        policyVersion
      };

      const result = await this.broadcastToProviders(senderId, policyMessage, broadcastOptions);

      this.auditLogger.log('policy', 'Policy update broadcast', {
        policyId,
        policyVersion,
        broadcastId: result.broadcastId,
        eventId: result.eventId,
        senderId
      });

      return result;

    } catch (error) {
      this.auditLogger.logError('Failed to send policy update', {
        policyId,
        policyVersion,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Add providers to admin channel
   */
  async addProvidersToChannel(roomId, providerIds, addedBy) {
    try {
      const channel = this.adminChannels.get(roomId);
      if (!channel) {
        throw new Error('Admin channel not found');
      }

      if (!this.canManageAdminChannel(addedBy, channel)) {
        throw new Error('Insufficient permissions to add providers');
      }

      const addedProviders = [];
      
      for (const providerId of providerIds) {
        try {
          await this.client.client.invite(roomId, providerId);
          addedProviders.push(providerId);
          
          this.auditLogger.log('membership', 'Provider added to admin channel', {
            roomId,
            providerId,
            addedBy,
            channelType: channel.channelType
          });
        } catch (error) {
          this.auditLogger.logWarning('Failed to add provider to admin channel', {
            roomId,
            providerId,
            error: error.message
          });
        }
      }

      // Update member count
      channel.memberCount += addedProviders.length;
      this.adminChannels.set(roomId, channel);

      return addedProviders;

    } catch (error) {
      this.auditLogger.logError('Failed to add providers to admin channel', {
        roomId,
        addedBy,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Submit message for admin approval
   */
  async submitMessageForApproval(roomId, senderId, message, options = {}) {
    try {
      const approvalId = `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const pendingMessage = {
        approvalId,
        roomId,
        senderId,
        message,
        options,
        submittedAt: new Date().toISOString(),
        status: 'pending',
        approvedBy: null,
        approvedAt: null
      };

      this.pendingMessages.set(approvalId, pendingMessage);

      // Notify admins about pending message
      await this.notifyAdminsOfPendingMessage(roomId, pendingMessage);

      this.auditLogger.log('approval', 'Message submitted for admin approval', {
        approvalId,
        roomId,
        senderId,
        messageLength: message.length
      });

      return { approvalId, status: 'pending' };

    } catch (error) {
      this.auditLogger.logError('Failed to submit message for approval', {
        roomId,
        senderId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Approve pending message
   */
  async approvePendingMessage(approvalId, adminId, approved = true, reason = '') {
    try {
      const pendingMessage = this.pendingMessages.get(approvalId);
      if (!pendingMessage) {
        throw new Error('Pending message not found');
      }

      if (!this.isAdmin(adminId)) {
        throw new Error('Only admins can approve messages');
      }

      pendingMessage.status = approved ? 'approved' : 'rejected';
      pendingMessage.approvedBy = adminId;
      pendingMessage.approvedAt = new Date().toISOString();
      pendingMessage.approvalReason = reason;

      if (approved) {
        // Send the approved message
        const eventId = await this.sendAdminMessage(
          pendingMessage.roomId,
          pendingMessage.senderId,
          pendingMessage.message,
          {
            ...pendingMessage.options,
            approvedBy: adminId,
            approvalId
          }
        );

        pendingMessage.eventId = eventId;
      }

      this.pendingMessages.set(approvalId, pendingMessage);

      this.auditLogger.log('approval', `Message ${approved ? 'approved' : 'rejected'}`, {
        approvalId,
        adminId,
        approved,
        reason,
        originalSender: pendingMessage.senderId
      });

      return pendingMessage;

    } catch (error) {
      this.auditLogger.logError('Failed to process message approval', {
        approvalId,
        adminId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get admin channels for a user
   */
  getAdminChannelsForUser(userId) {
    const channels = [];
    
    for (const [roomId, channel] of this.adminChannels) {
      if (this.hasAdminChannelAccess(userId, channel) && channel.isActive) {
        channels.push({
          roomId,
          channelType: channel.channelType,
          department: channel.department,
          specialty: channel.specialty,
          isBroadcast: channel.isBroadcast,
          memberCount: channel.memberCount,
          createdAt: channel.createdAt,
          lastActivity: channel.lastActivity
        });
      }
    }

    return channels.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
  }

  /**
   * Helper methods
   */

  generateAdminChannelName(channelType, options) {
    const department = options.department ? ` - ${options.department}` : '';
    const specialty = options.specialty ? ` (${options.specialty})` : '';
    
    const typeNames = {
      'general_admin': 'General Administration',
      'policy_updates': 'Policy Updates',
      'system_notifications': 'System Notifications',
      'emergency_alerts': 'Emergency Alerts',
      'department_admin': `Department Administration${department}`,
      'specialty_admin': `Specialty Administration${specialty}`
    };

    return typeNames[channelType] || `Admin - ${channelType}`;
  }

  async findOrCreateBroadcastChannel(adminId, options) {
    // Look for existing broadcast channel
    for (const [roomId, channel] of this.broadcastChannels) {
      if (channel.channelType === (options.broadcastType || 'general') &&
          channel.department === options.department &&
          channel.specialty === options.specialty) {
        return roomId;
      }
    }

    // Create new broadcast channel
    return await this.createProviderAdminChannel(adminId, {
      channelType: `broadcast_${options.broadcastType || 'general'}`,
      department: options.department,
      specialty: options.specialty,
      isBroadcast: true,
      topic: `Broadcast channel for ${options.broadcastType || 'general'} announcements`
    });
  }

  formatPolicyUpdateMessage(policyId, policyVersion, updateDetails) {
    return `
📋 **POLICY UPDATE NOTIFICATION**

**Policy ID:** ${policyId}
**Version:** ${policyVersion}
**Effective Date:** ${updateDetails.effectiveDate || 'Immediate'}

**Summary:** ${updateDetails.summary}

**Key Changes:**
${updateDetails.changes.map(change => `• ${change}`).join('\n')}

**Action Required:** ${updateDetails.actionRequired || 'Review and acknowledge'}
**Deadline:** ${updateDetails.deadline || 'Within 7 days'}

Please review the full policy document and acknowledge receipt.
    `.trim();
  }

  hasAdminChannelAccess(userId, channel) {
    return this.isAdmin(userId) || 
           this.isProvider(userId) ||
           userId === channel.adminId;
  }

  canManageAdminChannel(userId, channel) {
    return this.isAdmin(userId) || userId === channel.adminId;
  }

  isAdmin(userId) {
    // This would integrate with WebQX™'s user management system
    return userId.includes('admin') || userId.includes('administrator');
  }

  isProvider(userId) {
    return userId.includes('provider') || userId.includes('doctor') || userId.includes('nurse');
  }

  updateAdminChannelActivity(roomId) {
    const channel = this.adminChannels.get(roomId);
    if (channel) {
      channel.lastActivity = new Date().toISOString();
      this.adminChannels.set(roomId, channel);
    }
  }

  async configureAdminChannelPermissions(roomId, channel) {
    const powerLevels = {
      users: {},
      events: {
        'm.room.name': 100,
        'm.room.topic': 100,
        'm.room.avatar': 100,
        'm.room.encryption': 100
      },
      users_default: 0,
      events_default: channel.isBroadcast ? 50 : 0, // Broadcast channels restrict posting
      state_default: 100,
      ban: 100,
      kick: 100,
      redact: 50,
      invite: 50
    };

    // Admin has full permissions
    powerLevels.users[channel.adminId] = 100;

    try {
      await this.client.client.sendStateEvent(roomId, 'm.room.power_levels', powerLevels);
    } catch (error) {
      this.auditLogger.logWarning('Failed to set admin channel permissions', {
        roomId,
        error: error.message
      });
    }
  }

  async sendAdminWelcomeMessage(roomId, channel) {
    const welcomeMessage = `
🏛️ **Administrative Communication Channel**

**Channel Type:** ${channel.channelType}
${channel.department ? `**Department:** ${channel.department}` : ''}
${channel.specialty ? `**Specialty:** ${channel.specialty}` : ''}

This channel is for administrative communications including:
• Policy updates and announcements
• System notifications
• Department communications
• Emergency alerts

${channel.requiresApproval ? '⚠️ Messages in this channel require admin approval before posting.' : ''}
${channel.isBroadcast ? '📢 This is a broadcast channel for announcements.' : ''}

Please keep communications professional and relevant.
    `.trim();

    await this.client.sendMessage(roomId, welcomeMessage, {
      msgtype: 'm.notice',
      'webqx.admin_metadata': {
        messageType: 'welcome',
        channelType: 'provider-admin',
        timestamp: new Date().toISOString()
      }
    });
  }

  async notifyAdminsOfPendingMessage(roomId, pendingMessage) {
    // This would send notifications to admins about pending approvals
    // Implementation would depend on notification system
  }

  async trackAcknowledgmentRequirement(roomId, eventId, messageContent) {
    // Track messages that require acknowledgment
    // Implementation would depend on acknowledgment tracking system
  }

  async trackBroadcastMetrics(roomId, eventId, broadcastContent) {
    // Track broadcast delivery and engagement metrics
    // Implementation would depend on metrics system
  }

  /**
   * Get admin channel statistics
   */
  getAdminChannelStats() {
    const activeChannels = Array.from(this.adminChannels.values()).filter(c => c.isActive);
    const broadcastChannels = Array.from(this.broadcastChannels.values()).filter(c => c.isActive);

    const channelTypeCounts = {};
    activeChannels.forEach(channel => {
      const type = channel.channelType;
      channelTypeCounts[type] = (channelTypeCounts[type] || 0) + 1;
    });

    return {
      totalAdminChannels: this.adminChannels.size,
      activeChannels: activeChannels.length,
      broadcastChannels: broadcastChannels.length,
      pendingApprovals: Array.from(this.pendingMessages.values()).filter(m => m.status === 'pending').length,
      channelTypeDistribution: channelTypeCounts,
      totalMembers: activeChannels.reduce((sum, c) => sum + c.memberCount, 0)
    };
  }
}

module.exports = { ProviderAdminChannel };