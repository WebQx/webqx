/**
 * WebQX™ Specialty Channel Management
 * 
 * Manages specialty-specific communication channels for different medical specialties.
 * Provides workflow-aware messaging with specialty-specific features and integrations.
 */

const { AuditLogger } = require('../utils/audit');
const { MessageValidator } = require('../utils/validation');
const config = require('../core/config');

class SpecialtyChannels {
  constructor(matrixClient, options = {}) {
    this.client = matrixClient;
    this.auditLogger = new AuditLogger();
    this.validator = new MessageValidator();
    
    this.options = {
      enableEncryption: options.enableEncryption !== false,
      enableSpecialtyBots: options.enableSpecialtyBots !== false,
      maxChannelMembers: options.maxChannelMembers || 50,
      enableCrossSpecialtyConsults: options.enableCrossSpecialtyConsults !== false,
      ...options
    };

    this.specialtyChannels = new Map();
    this.consultChannels = new Map();
    this.specialtyConfigs = config.SPECIALTY_CHANNELS;
  }

  /**
   * Create a specialty-specific channel
   */
  async createSpecialtyChannel(specialty, createdBy, options = {}) {
    try {
      // Validate specialty
      if (!this.specialtyConfigs[specialty]) {
        throw new Error(`Unsupported specialty: ${specialty}`);
      }

      const specialtyConfig = this.specialtyConfigs[specialty];
      const channelName = options.channelName || this.generateSpecialtyChannelName(specialty, options);

      // Configure channel options
      const channelOptions = {
        name: channelName,
        topic: options.topic || specialtyConfig.description,
        channelType: 'specialty',
        specialty: specialty,
        visibility: 'private',
        inviteUsers: [createdBy, ...(specialtyConfig.defaultMembers || [])],
        disableEncryption: !this.options.enableEncryption,
        matrixOptions: {
          preset: 'private',
          creation_content: {
            'm.federate': false,
            'webqx.specialty': specialty,
            'webqx.specialty_config': specialtyConfig
          }
        }
      };

      // Add initial team members if specified
      if (options.teamMembers && Array.isArray(options.teamMembers)) {
        channelOptions.inviteUsers.push(...options.teamMembers);
      }

      // Create the channel
      const roomId = await this.client.createChannel(channelName, channelOptions);

      // Store channel metadata
      const channelMetadata = {
        roomId,
        specialty,
        specialtyConfig,
        createdBy,
        channelType: options.channelType || 'general',
        department: options.department,
        isMultidisciplinary: options.isMultidisciplinary || false,
        consultationType: options.consultationType,
        patientCaseId: options.patientCaseId,
        createdAt: new Date().toISOString(),
        isActive: true,
        lastActivity: new Date().toISOString(),
        memberCount: channelOptions.inviteUsers.length,
        messageCount: 0,
        consultationCount: 0
      };

      this.specialtyChannels.set(roomId, channelMetadata);

      // Set up specialty-specific permissions and features
      await this.configureSpecialtyChannel(roomId, channelMetadata);

      // Add specialty bot if enabled
      if (this.options.enableSpecialtyBots && specialtyConfig.defaultMembers) {
        await this.initializeSpecialtyBot(roomId, specialty, channelMetadata);
      }

      this.auditLogger.log('specialty_channel', 'Specialty channel created', {
        roomId,
        specialty,
        createdBy,
        channelType: channelMetadata.channelType,
        isMultidisciplinary: channelMetadata.isMultidisciplinary,
        encrypted: this.options.enableEncryption
      });

      return roomId;

    } catch (error) {
      this.auditLogger.logError('Failed to create specialty channel', {
        specialty,
        createdBy,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create a cross-specialty consultation channel
   */
  async createConsultationChannel(primarySpecialty, consultingSpecialty, requestedBy, options = {}) {
    try {
      if (!this.options.enableCrossSpecialtyConsults) {
        throw new Error('Cross-specialty consultations are disabled');
      }

      // Validate specialties
      if (!this.specialtyConfigs[primarySpecialty] || !this.specialtyConfigs[consultingSpecialty]) {
        throw new Error('Invalid specialty for consultation');
      }

      const consultationId = `consult_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const channelName = `${primarySpecialty} ↔ ${consultingSpecialty} Consultation`;

      const channelOptions = {
        name: channelName,
        topic: `Cross-specialty consultation: ${primarySpecialty} consulting ${consultingSpecialty}`,
        channelType: 'consultation',
        specialty: primarySpecialty,
        consultingSpecialty: consultingSpecialty,
        visibility: 'private',
        inviteUsers: [requestedBy],
        disableEncryption: !this.options.enableEncryption,
        matrixOptions: {
          preset: 'private',
          creation_content: {
            'm.federate': false,
            'webqx.consultation_id': consultationId,
            'webqx.primary_specialty': primarySpecialty,
            'webqx.consulting_specialty': consultingSpecialty
          }
        }
      };

      const roomId = await this.client.createChannel(channelName, channelOptions);

      const consultationMetadata = {
        roomId,
        consultationId,
        primarySpecialty,
        consultingSpecialty,
        requestedBy,
        patientId: options.patientId,
        caseId: options.caseId,
        urgency: options.urgency || 'routine',
        consultationReason: options.reason,
        status: 'pending',
        createdAt: new Date().toISOString(),
        isActive: true,
        lastActivity: new Date().toISOString(),
        expectedResponseTime: this.calculateExpectedResponseTime(options.urgency),
        participants: [requestedBy]
      };

      this.consultChannels.set(roomId, consultationMetadata);

      // Send consultation request
      await this.sendConsultationRequest(roomId, consultationMetadata);

      this.auditLogger.log('consultation', 'Cross-specialty consultation created', {
        consultationId,
        roomId,
        primarySpecialty,
        consultingSpecialty,
        requestedBy,
        urgency: options.urgency,
        patientId: options.patientId
      });

      return { roomId, consultationId };

    } catch (error) {
      this.auditLogger.logError('Failed to create consultation channel', {
        primarySpecialty,
        consultingSpecialty,
        requestedBy,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Send a specialty-specific message
   */
  async sendSpecialtyMessage(roomId, senderId, message, options = {}) {
    try {
      const channel = this.specialtyChannels.get(roomId) || this.consultChannels.get(roomId);
      if (!channel) {
        throw new Error('Specialty channel not found');
      }

      // Prepare specialty-specific message content
      const messageContent = {
        body: message,
        msgtype: options.msgtype || 'm.text',
        'webqx.specialty_metadata': {
          specialty: channel.specialty || channel.primarySpecialty,
          consultingSpecialty: channel.consultingSpecialty,
          channelType: channel.channelType || 'consultation',
          timestamp: new Date().toISOString(),
          senderId,
          messageType: options.messageType || 'general',
          clinicalContext: options.clinicalContext,
          patientId: options.patientId || channel.patientId,
          caseId: options.caseId || channel.caseId,
          urgency: options.urgency || 'normal'
        }
      };

      // Add specialty-specific fields
      if (options.imagingResults) {
        messageContent['webqx.specialty_metadata'].imagingResults = options.imagingResults;
      }

      if (options.labResults) {
        messageContent['webqx.specialty_metadata'].labResults = options.labResults;
      }

      if (options.clinicalRecommendation) {
        messageContent['webqx.specialty_metadata'].clinicalRecommendation = options.clinicalRecommendation;
      }

      // Send the message
      const eventId = await this.client.sendMessage(roomId, message, {
        ...options,
        content: messageContent
      });

      // Update channel activity and stats
      this.updateSpecialtyChannelActivity(roomId);
      channel.messageCount = (channel.messageCount || 0) + 1;

      this.auditLogger.log('specialty_message', 'Specialty message sent', {
        roomId,
        eventId,
        senderId,
        specialty: channel.specialty || channel.primarySpecialty,
        messageType: options.messageType,
        urgency: options.urgency,
        hasImaging: !!options.imagingResults,
        hasLabResults: !!options.labResults
      });

      return eventId;

    } catch (error) {
      this.auditLogger.logError('Failed to send specialty message', {
        roomId,
        senderId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Share medical imaging or documents
   */
  async shareSpecialtyDocument(roomId, senderId, file, options = {}) {
    try {
      const channel = this.specialtyChannels.get(roomId) || this.consultChannels.get(roomId);
      if (!channel) {
        throw new Error('Specialty channel not found');
      }

      const specialty = channel.specialty || channel.primarySpecialty;
      const specialtyConfig = this.specialtyConfigs[specialty];

      // Validate file type for specialty
      if (specialtyConfig.allowedFileTypes && 
          !specialtyConfig.allowedFileTypes.includes(this.getFileExtension(file.name))) {
        throw new Error(`File type not allowed for ${specialty} specialty`);
      }

      // Upload file with specialty context
      const eventId = await this.client.uploadFile(roomId, file, {
        ...options,
        patientId: options.patientId || channel.patientId,
        isHealthcareDocument: true,
        documentType: options.documentType || 'specialty_document',
        specialty: specialty,
        consultationId: channel.consultationId,
        senderId
      });

      this.auditLogger.log('specialty_document', 'Specialty document shared', {
        roomId,
        eventId,
        senderId,
        filename: file.name,
        fileSize: file.size,
        documentType: options.documentType,
        specialty: specialty,
        consultationId: channel.consultationId
      });

      return eventId;

    } catch (error) {
      this.auditLogger.logError('Failed to share specialty document', {
        roomId,
        senderId,
        filename: file.name,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Add specialist to consultation
   */
  async addSpecialistToConsultation(roomId, specialistId, addedBy, role = 'consultant') {
    try {
      const consultation = this.consultChannels.get(roomId);
      if (!consultation) {
        throw new Error('Consultation channel not found');
      }

      // Validate specialist credentials for the specialty
      if (!await this.validateSpecialistCredentials(specialistId, consultation.consultingSpecialty)) {
        throw new Error('Specialist not qualified for this consultation');
      }

      // Invite specialist to the consultation
      await this.client.client.invite(roomId, specialistId);

      // Update consultation metadata
      consultation.participants.push({
        userId: specialistId,
        role: role,
        specialty: consultation.consultingSpecialty,
        addedBy: addedBy,
        addedAt: new Date().toISOString()
      });

      // Update consultation status if this is the first consultant
      if (consultation.status === 'pending' && role === 'consultant') {
        consultation.status = 'active';
        consultation.acceptedAt = new Date().toISOString();
        consultation.acceptedBy = specialistId;
      }

      this.consultChannels.set(roomId, consultation);

      // Send notification about specialist joining
      await this.client.sendMessage(roomId, 
        `${role === 'consultant' ? 'Consultant' : 'Specialist'} ${specialistId} has joined the consultation.`,
        {
          msgtype: 'm.notice',
          'webqx.specialty_metadata': {
            action: 'specialist_joined',
            specialistId,
            role,
            specialty: consultation.consultingSpecialty,
            timestamp: new Date().toISOString()
          }
        }
      );

      this.auditLogger.log('consultation', 'Specialist added to consultation', {
        roomId,
        consultationId: consultation.consultationId,
        specialistId,
        addedBy,
        role,
        specialty: consultation.consultingSpecialty
      });

      return true;

    } catch (error) {
      this.auditLogger.logError('Failed to add specialist to consultation', {
        roomId,
        specialistId,
        addedBy,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Complete consultation
   */
  async completeConsultation(roomId, completedBy, recommendations, options = {}) {
    try {
      const consultation = this.consultChannels.get(roomId);
      if (!consultation) {
        throw new Error('Consultation channel not found');
      }

      // Update consultation status
      consultation.status = 'completed';
      consultation.completedAt = new Date().toISOString();
      consultation.completedBy = completedBy;
      consultation.recommendations = recommendations;
      consultation.followUpRequired = options.followUpRequired || false;
      consultation.followUpDate = options.followUpDate;

      this.consultChannels.set(roomId, consultation);

      // Send completion summary
      const summaryMessage = this.formatConsultationSummary(consultation, recommendations);
      await this.client.sendMessage(roomId, summaryMessage, {
        msgtype: 'm.notice',
        'webqx.specialty_metadata': {
          action: 'consultation_completed',
          consultationId: consultation.consultationId,
          completedBy,
          recommendations,
          followUpRequired: options.followUpRequired,
          timestamp: new Date().toISOString()
        }
      });

      this.auditLogger.log('consultation', 'Consultation completed', {
        roomId,
        consultationId: consultation.consultationId,
        completedBy,
        primarySpecialty: consultation.primarySpecialty,
        consultingSpecialty: consultation.consultingSpecialty,
        followUpRequired: options.followUpRequired
      });

      return consultation;

    } catch (error) {
      this.auditLogger.logError('Failed to complete consultation', {
        roomId,
        completedBy,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get specialty channels for a user
   */
  getSpecialtyChannelsForUser(userId, specialty = null) {
    const channels = [];
    
    for (const [roomId, channel] of this.specialtyChannels) {
      if (channel.isActive && 
          (specialty === null || channel.specialty === specialty)) {
        // Check if user has access (simplified - would integrate with proper access control)
        channels.push({
          roomId,
          specialty: channel.specialty,
          channelType: channel.channelType,
          department: channel.department,
          memberCount: channel.memberCount,
          messageCount: channel.messageCount,
          createdAt: channel.createdAt,
          lastActivity: channel.lastActivity
        });
      }
    }

    return channels.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
  }

  /**
   * Get active consultations for a user
   */
  getActiveConsultationsForUser(userId, specialty = null) {
    const consultations = [];
    
    for (const [roomId, consultation] of this.consultChannels) {
      if (consultation.isActive && 
          consultation.status !== 'completed' &&
          (specialty === null || 
           consultation.primarySpecialty === specialty || 
           consultation.consultingSpecialty === specialty)) {
        
        // Check if user is involved in the consultation
        const isParticipant = consultation.participants.some(p => 
          p.userId === userId || userId === consultation.requestedBy
        );
        
        if (isParticipant) {
          consultations.push({
            roomId,
            consultationId: consultation.consultationId,
            primarySpecialty: consultation.primarySpecialty,
            consultingSpecialty: consultation.consultingSpecialty,
            urgency: consultation.urgency,
            status: consultation.status,
            createdAt: consultation.createdAt,
            expectedResponseTime: consultation.expectedResponseTime,
            patientId: consultation.patientId
          });
        }
      }
    }

    return consultations.sort((a, b) => {
      // Sort by urgency first, then by creation date
      const urgencyOrder = { 'critical': 0, 'urgent': 1, 'routine': 2 };
      const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
  }

  /**
   * Helper methods
   */

  generateSpecialtyChannelName(specialty, options) {
    const specialtyConfig = this.specialtyConfigs[specialty];
    const baseName = specialtyConfig.displayName;
    
    if (options.department) {
      return `${baseName} - ${options.department}`;
    }
    
    if (options.channelType === 'case_discussion') {
      return `${baseName} Case Discussion`;
    }
    
    if (options.channelType === 'journal_club') {
      return `${baseName} Journal Club`;
    }
    
    return baseName;
  }

  calculateExpectedResponseTime(urgency) {
    const responseTimes = {
      'critical': 15, // 15 minutes
      'urgent': 120,  // 2 hours
      'routine': 1440 // 24 hours
    };
    
    const minutes = responseTimes[urgency] || responseTimes['routine'];
    const responseTime = new Date();
    responseTime.setMinutes(responseTime.getMinutes() + minutes);
    
    return responseTime.toISOString();
  }

  async validateSpecialistCredentials(specialistId, specialty) {
    // This would integrate with credentialing system
    // For now, simplified check
    return specialistId.includes(specialty.replace('-', ''));
  }

  formatConsultationSummary(consultation, recommendations) {
    return `
📋 **CONSULTATION COMPLETED**

**Consultation ID:** ${consultation.consultationId}
**Primary Specialty:** ${consultation.primarySpecialty}
**Consulting Specialty:** ${consultation.consultingSpecialty}
**Duration:** ${this.calculateConsultationDuration(consultation)}

**Recommendations:**
${recommendations}

**Follow-up Required:** ${consultation.followUpRequired ? 'Yes' : 'No'}
${consultation.followUpDate ? `**Follow-up Date:** ${consultation.followUpDate}` : ''}

This consultation is now complete.
    `.trim();
  }

  calculateConsultationDuration(consultation) {
    const start = new Date(consultation.createdAt);
    const end = new Date(consultation.completedAt);
    const durationMs = end - start;
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  updateSpecialtyChannelActivity(roomId) {
    const channel = this.specialtyChannels.get(roomId) || this.consultChannels.get(roomId);
    if (channel) {
      channel.lastActivity = new Date().toISOString();
      if (this.specialtyChannels.has(roomId)) {
        this.specialtyChannels.set(roomId, channel);
      } else {
        this.consultChannels.set(roomId, channel);
      }
    }
  }

  getFileExtension(filename) {
    return filename.split('.').pop()?.toLowerCase() || '';
  }

  async configureSpecialtyChannel(roomId, channel) {
    // Set specialty-specific permissions and features
    const specialtyConfig = channel.specialtyConfig;
    
    const powerLevels = {
      users: {},
      events: {
        'm.room.name': 50,
        'm.room.topic': 50,
        'm.room.encryption': 100
      },
      users_default: 25,
      events_default: 0,
      state_default: 50,
      ban: 50,
      kick: 50,
      redact: 25,
      invite: 25
    };

    // Creator has elevated permissions
    powerLevels.users[channel.createdBy] = 50;

    try {
      await this.client.client.sendStateEvent(roomId, 'm.room.power_levels', powerLevels);
    } catch (error) {
      this.auditLogger.logWarning('Failed to set specialty channel permissions', {
        roomId,
        specialty: channel.specialty,
        error: error.message
      });
    }
  }

  async initializeSpecialtyBot(roomId, specialty, channel) {
    const specialtyConfig = channel.specialtyConfig;
    
    if (specialtyConfig.defaultMembers && specialtyConfig.defaultMembers.length > 0) {
      // Send bot introduction message
      const botIntroMessage = `
🤖 **${specialtyConfig.displayName} Assistant**

Welcome to the ${specialtyConfig.displayName} channel. I'm here to help with:
• Clinical decision support
• Protocol reminders
• Research updates
• Documentation assistance

Type \`!help\` for available commands.
      `.trim();

      // This would be sent by the specialty bot
      // Implementation would depend on bot framework
    }
  }

  async sendConsultationRequest(roomId, consultation) {
    const requestMessage = `
🩺 **CONSULTATION REQUEST**

**Consultation ID:** ${consultation.consultationId}
**From:** ${consultation.primarySpecialty}
**To:** ${consultation.consultingSpecialty}
**Urgency:** ${consultation.urgency.toUpperCase()}
**Patient:** ${consultation.patientId || 'Not specified'}

**Reason for Consultation:**
${consultation.consultationReason || 'Not specified'}

**Expected Response Time:** ${new Date(consultation.expectedResponseTime).toLocaleString()}

Please join this channel to provide consultation.
    `.trim();

    await this.client.sendMessage(roomId, requestMessage, {
      msgtype: 'm.notice',
      'webqx.specialty_metadata': {
        action: 'consultation_request',
        consultationId: consultation.consultationId,
        urgency: consultation.urgency,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Get specialty channel statistics
   */
  getSpecialtyChannelStats() {
    const activeSpecialtyChannels = Array.from(this.specialtyChannels.values()).filter(c => c.isActive);
    const activeConsultations = Array.from(this.consultChannels.values()).filter(c => c.isActive && c.status !== 'completed');
    
    const specialtyCounts = {};
    activeSpecialtyChannels.forEach(channel => {
      const specialty = channel.specialty;
      specialtyCounts[specialty] = (specialtyCounts[specialty] || 0) + 1;
    });

    const consultationStats = {
      pending: 0,
      active: 0,
      completed: 0
    };

    Array.from(this.consultChannels.values()).forEach(consultation => {
      consultationStats[consultation.status] = (consultationStats[consultation.status] || 0) + 1;
    });

    return {
      totalSpecialtyChannels: this.specialtyChannels.size,
      activeSpecialtyChannels: activeSpecialtyChannels.length,
      totalConsultations: this.consultChannels.size,
      activeConsultations: activeConsultations.length,
      specialtyDistribution: specialtyCounts,
      consultationStatsByStatus: consultationStats,
      totalMessages: activeSpecialtyChannels.reduce((sum, c) => sum + c.messageCount, 0),
      averageResponseTime: this.calculateAverageResponseTime()
    };
  }

  calculateAverageResponseTime() {
    const completedConsultations = Array.from(this.consultChannels.values())
      .filter(c => c.status === 'completed' && c.acceptedAt);
    
    if (completedConsultations.length === 0) return 0;
    
    const totalResponseTime = completedConsultations.reduce((sum, consultation) => {
      const requestTime = new Date(consultation.createdAt);
      const responseTime = new Date(consultation.acceptedAt);
      return sum + (responseTime - requestTime);
    }, 0);
    
    return Math.round(totalResponseTime / completedConsultations.length / (1000 * 60)); // Average in minutes
  }
}

module.exports = { SpecialtyChannels };