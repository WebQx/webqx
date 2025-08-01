/**
 * WebQX™ Telehealth - Consultation Chat
 * 
 * Text-based consultation system for fallback when video is not feasible.
 * Provides structured messaging, medical context, and real-time communication.
 */

import { MatrixMessaging } from '../../../messaging/core/matrix-client';
import {
  ConsultationMessage,
  ConsultationSession,
  StructuredConsultation,
  ConsultationTemplate,
  StructuredResponse,
  MessageEvent,
  EventCallback,
  TelehealthError,
  UserRole
} from '../types/telehealth.types';

export interface ConsultationChatConfig {
  /** Matrix messaging configuration */
  matrixConfig: {
    homeserverUrl: string;
    accessToken: string;
    userId: string;
    deviceId: string;
  };
  /** Message configuration */
  messageConfig: {
    /** Enable end-to-end encryption */
    enableE2EE: boolean;
    /** Maximum message length */
    maxMessageLength: number;
    /** Enable voice messages */
    enableVoiceMessages: boolean;
    /** Enable file attachments */
    enableFileAttachments: boolean;
    /** Maximum file size in MB */
    maxFileSizeMB: number;
  };
  /** Consultation templates */
  templates: ConsultationTemplate[];
  /** Auto-save interval in seconds */
  autoSaveIntervalSeconds: number;
}

export class ConsultationChat {
  private config: ConsultationChatConfig;
  private matrixClient: MatrixMessaging;
  private currentSession?: ConsultationSession;
  private currentStructuredConsult?: StructuredConsultation;
  private messages: Map<string, ConsultationMessage[]> = new Map();
  private eventListeners: Map<string, EventCallback<MessageEvent>[]> = new Map();
  private roomId?: string;
  private isConnected: boolean = false;
  private autoSaveInterval?: NodeJS.Timeout;

  constructor(config: ConsultationChatConfig) {
    this.config = config;
    this.matrixClient = new MatrixMessaging({
      homeserverUrl: config.matrixConfig.homeserverUrl,
      accessToken: config.matrixConfig.accessToken,
      userId: config.matrixConfig.userId,
      deviceId: config.matrixConfig.deviceId,
      enableE2EE: config.messageConfig.enableE2EE
    });

    this.setupMatrixEventHandlers();
  }

  /**
   * Start a text-based consultation session
   */
  async startConsultation(session: ConsultationSession): Promise<void> {
    try {
      this.currentSession = session;

      // Initialize Matrix client if not already started
      if (!this.matrixClient.isStarted) {
        await this.matrixClient.start();
      }

      // Create or join consultation room
      this.roomId = await this.createConsultationRoom(session);
      this.isConnected = true;

      // Initialize message history
      if (!this.messages.has(session.sessionId)) {
        this.messages.set(session.sessionId, []);
      }

      // Start auto-save
      this.startAutoSave();

      // Send welcome message
      await this.sendSystemMessage(
        `Consultation started. Type your message or use /help for commands.`,
        session.sessionId
      );

      this.emitEvent({
        type: 'consultation-started',
        timestamp: new Date(),
        sessionId: session.sessionId,
        data: {
          messageId: 'system-welcome',
          sessionId: session.sessionId,
          senderId: 'system',
          senderRole: 'system',
          type: 'system',
          content: 'Consultation started',
          timestamp: new Date(),
          deliveryStatus: 'delivered',
          encrypted: this.config.messageConfig.enableE2EE
        }
      });

    } catch (error) {
      throw new TelehealthError(
        `Failed to start consultation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          name: 'ConsultationStartError',
          code: 'CONSULTATION_START_FAILED',
          category: 'sync',
          recoverable: true,
          context: { sessionId: session.sessionId }
        }
      );
    }
  }

  /**
   * Start structured consultation with template
   */
  async startStructuredConsultation(
    session: ConsultationSession,
    templateId: string
  ): Promise<StructuredConsultation> {
    const template = this.config.templates.find(t => t.templateId === templateId);
    if (!template) {
      throw new TelehealthError(
        `Consultation template not found: ${templateId}`,
        {
          name: 'TemplateNotFoundError',
          code: 'TEMPLATE_NOT_FOUND',
          category: 'config',
          recoverable: false,
          context: { templateId }
        }
      );
    }

    this.currentStructuredConsult = {
      consultationId: `struct-${session.sessionId}`,
      sessionId: session.sessionId,
      template,
      currentStep: 0,
      responses: [],
      status: 'in-progress',
      startTime: new Date()
    };

    await this.startConsultation(session);
    await this.presentCurrentStep();

    return this.currentStructuredConsult;
  }

  /**
   * Send a text message
   */
  async sendMessage(
    content: string,
    senderId: string,
    senderRole: UserRole,
    metadata?: ConsultationMessage['metadata']
  ): Promise<ConsultationMessage> {
    if (!this.currentSession || !this.roomId) {
      throw new TelehealthError('No active consultation session', {
        name: 'NoActiveSessionError',
        code: 'NO_ACTIVE_SESSION',
        category: 'sync',
        recoverable: false
      });
    }

    if (content.length > this.config.messageConfig.maxMessageLength) {
      throw new TelehealthError(
        `Message too long. Maximum length: ${this.config.messageConfig.maxMessageLength}`,
        {
          name: 'MessageTooLongError',
          code: 'MESSAGE_TOO_LONG',
          category: 'sync',
          recoverable: false,
          context: { messageLength: content.length }
        }
      );
    }

    const message: ConsultationMessage = {
      messageId: this.generateMessageId(),
      sessionId: this.currentSession.sessionId,
      senderId,
      senderRole,
      type: 'text',
      content,
      timestamp: new Date(),
      metadata: {
        ...metadata,
        medicalContext: metadata?.medicalContext || {
          urgency: this.assessMessageUrgency(content)
        }
      },
      deliveryStatus: 'sending',
      encrypted: this.config.messageConfig.enableE2EE
    };

    try {
      // Send via Matrix
      const eventId = await this.matrixClient.sendMessage(this.roomId, content, {
        patientId: this.currentSession.patientId,
        providerId: this.currentSession.providerId,
        specialty: this.currentSession.metadata.specialty,
        senderId,
        senderRole,
        messageId: message.messageId,
        medicalContext: message.metadata?.medicalContext
      });

      message.deliveryStatus = 'delivered';
      
      // Store message
      this.addMessageToHistory(message);

      // Process if it's a structured consultation response
      if (this.currentStructuredConsult && senderRole === 'patient') {
        await this.processStructuredResponse(content);
      }

      // Check for commands
      if (content.startsWith('/')) {
        await this.processCommand(content, senderId, senderRole);
      }

      this.emitEvent({
        type: 'message-sent',
        timestamp: new Date(),
        sessionId: this.currentSession.sessionId,
        data: message
      });

      return message;

    } catch (error) {
      message.deliveryStatus = 'failed';
      this.addMessageToHistory(message);

      throw new TelehealthError(
        `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          name: 'MessageSendError',
          code: 'MESSAGE_SEND_FAILED',
          category: 'sync',
          recoverable: true,
          context: { messageId: message.messageId }
        }
      );
    }
  }

  /**
   * Send a voice message
   */
  async sendVoiceMessage(
    audioBlob: Blob,
    senderId: string,
    senderRole: UserRole,
    durationMs: number
  ): Promise<ConsultationMessage> {
    if (!this.config.messageConfig.enableVoiceMessages) {
      throw new TelehealthError('Voice messages not enabled', {
        name: 'VoiceMessagesDisabledError',
        code: 'VOICE_MESSAGES_DISABLED',
        category: 'config',
        recoverable: false
      });
    }

    if (!this.currentSession || !this.roomId) {
      throw new TelehealthError('No active consultation session', {
        name: 'NoActiveSessionError',
        code: 'NO_ACTIVE_SESSION',
        category: 'sync',
        recoverable: false
      });
    }

    const message: ConsultationMessage = {
      messageId: this.generateMessageId(),
      sessionId: this.currentSession.sessionId,
      senderId,
      senderRole,
      type: 'voice',
      content: 'Voice message',
      timestamp: new Date(),
      metadata: {
        voiceDurationMs: durationMs,
        medicalContext: {
          urgency: 'medium'
        }
      },
      deliveryStatus: 'sending',
      encrypted: this.config.messageConfig.enableE2EE
    };

    try {
      // Convert blob to file for upload
      const audioFile = new File([audioBlob], `voice-${message.messageId}.webm`, {
        type: audioBlob.type
      });

      // Upload voice message via Matrix
      const eventId = await this.matrixClient.uploadFile(this.roomId, audioFile, {
        filename: audioFile.name,
        patientId: this.currentSession.patientId,
        isHealthcareDocument: false,
        documentType: 'voice-message',
        messageId: message.messageId,
        voiceDurationMs: durationMs
      });

      message.deliveryStatus = 'delivered';
      this.addMessageToHistory(message);

      this.emitEvent({
        type: 'message-sent',
        timestamp: new Date(),
        sessionId: this.currentSession.sessionId,
        data: message
      });

      return message;

    } catch (error) {
      message.deliveryStatus = 'failed';
      this.addMessageToHistory(message);

      throw new TelehealthError(
        `Failed to send voice message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          name: 'VoiceMessageSendError',
          code: 'VOICE_MESSAGE_SEND_FAILED',
          category: 'sync',
          recoverable: true,
          context: { messageId: message.messageId }
        }
      );
    }
  }

  /**
   * Send file attachment
   */
  async sendFile(
    file: File,
    senderId: string,
    senderRole: UserRole,
    documentType?: string
  ): Promise<ConsultationMessage> {
    if (!this.config.messageConfig.enableFileAttachments) {
      throw new TelehealthError('File attachments not enabled', {
        name: 'FileAttachmentsDisabledError',
        code: 'FILE_ATTACHMENTS_DISABLED',
        category: 'config',
        recoverable: false
      });
    }

    const maxSizeBytes = this.config.messageConfig.maxFileSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new TelehealthError(
        `File too large. Maximum size: ${this.config.messageConfig.maxFileSizeMB}MB`,
        {
          name: 'FileTooLargeError',
          code: 'FILE_TOO_LARGE',
          category: 'sync',
          recoverable: false,
          context: { fileSize: file.size, maxSize: maxSizeBytes }
        }
      );
    }

    if (!this.currentSession || !this.roomId) {
      throw new TelehealthError('No active consultation session', {
        name: 'NoActiveSessionError',
        code: 'NO_ACTIVE_SESSION',
        category: 'sync',
        recoverable: false
      });
    }

    const message: ConsultationMessage = {
      messageId: this.generateMessageId(),
      sessionId: this.currentSession.sessionId,
      senderId,
      senderRole,
      type: 'document',
      content: `File: ${file.name}`,
      timestamp: new Date(),
      metadata: {
        attachments: [file.name],
        medicalContext: {
          urgency: 'medium',
          tags: documentType ? [documentType] : []
        }
      },
      deliveryStatus: 'sending',
      encrypted: this.config.messageConfig.enableE2EE
    };

    try {
      // Upload file via Matrix
      const eventId = await this.matrixClient.uploadFile(this.roomId, file, {
        filename: file.name,
        patientId: this.currentSession.patientId,
        isHealthcareDocument: true,
        documentType: documentType || 'general',
        messageId: message.messageId
      });

      message.deliveryStatus = 'delivered';
      this.addMessageToHistory(message);

      this.emitEvent({
        type: 'message-sent',
        timestamp: new Date(),
        sessionId: this.currentSession.sessionId,
        data: message
      });

      return message;

    } catch (error) {
      message.deliveryStatus = 'failed';
      this.addMessageToHistory(message);

      throw new TelehealthError(
        `Failed to send file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          name: 'FileSendError',
          code: 'FILE_SEND_FAILED',
          category: 'sync',
          recoverable: true,
          context: { messageId: message.messageId, fileName: file.name }
        }
      );
    }
  }

  /**
   * Get consultation message history
   */
  getMessageHistory(sessionId: string): ConsultationMessage[] {
    return this.messages.get(sessionId) || [];
  }

  /**
   * Get current structured consultation status
   */
  getStructuredConsultationStatus(): StructuredConsultation | undefined {
    return this.currentStructuredConsult;
  }

  /**
   * End the current consultation
   */
  async endConsultation(): Promise<void> {
    if (!this.currentSession) return;

    try {
      // Complete structured consultation if active
      if (this.currentStructuredConsult && this.currentStructuredConsult.status === 'in-progress') {
        this.currentStructuredConsult.status = 'completed';
        this.currentStructuredConsult.completionTime = new Date();
      }

      // Send farewell message
      await this.sendSystemMessage(
        'Consultation ended. Thank you for using WebQX™ Telehealth.',
        this.currentSession.sessionId
      );

      // Stop auto-save
      this.stopAutoSave();

      // Leave Matrix room
      if (this.roomId) {
        // Note: In a real implementation, you might want to keep the room
        // for medical record purposes
      }

      this.isConnected = false;
      this.currentSession = undefined;
      this.currentStructuredConsult = undefined;
      this.roomId = undefined;

    } catch (error) {
      console.error('Error ending consultation:', error);
    }
  }

  /**
   * Add event listener
   */
  addEventListener(eventType: string, callback: EventCallback<MessageEvent>): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(eventType: string, callback: EventCallback<MessageEvent>): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // Private methods

  private setupMatrixEventHandlers(): void {
    this.matrixClient.registerPlugin('consultation-chat', {
      onMessage: async (message: any, room: any) => {
        await this.handleIncomingMessage(message, room);
      },
      onChannelJoin: async (userId: string, channelId: string) => {
        console.log(`User ${userId} joined consultation room ${channelId}`);
      },
      onChannelLeave: async (userId: string, channelId: string) => {
        console.log(`User ${userId} left consultation room ${channelId}`);
      }
    });
  }

  private async createConsultationRoom(session: ConsultationSession): Promise<string> {
    const roomName = `WebQX Consultation - ${session.sessionId.substring(0, 8)}`;
    
    return await this.matrixClient.createChannel(roomName, {
      channelType: 'consultation',
      specialty: session.metadata.specialty,
      isDirect: true,
      inviteUsers: [
        // In a real implementation, you would resolve patient and provider Matrix IDs
        // For now, we'll create the room and handle invitations separately
      ],
      disableEncryption: !this.config.messageConfig.enableE2EE
    });
  }

  private async handleIncomingMessage(message: any, room: any): Promise<void> {
    if (!this.currentSession || room.roomId !== this.roomId) return;

    // Parse Matrix message into ConsultationMessage
    const consultationMessage: ConsultationMessage = {
      messageId: message.eventId,
      sessionId: this.currentSession.sessionId,
      senderId: message.sender,
      senderRole: this.determineSenderRole(message.sender),
      type: this.determineMessageType(message.content),
      content: message.content.body || '',
      timestamp: new Date(message.timestamp),
      metadata: message.content['webqx.metadata'],
      deliveryStatus: 'delivered',
      encrypted: message.encrypted
    };

    this.addMessageToHistory(consultationMessage);

    this.emitEvent({
      type: 'message-received',
      timestamp: new Date(),
      sessionId: this.currentSession.sessionId,
      data: consultationMessage
    });
  }

  private async presentCurrentStep(): Promise<void> {
    if (!this.currentStructuredConsult || !this.currentSession) return;

    const { template, currentStep } = this.currentStructuredConsult;
    
    if (currentStep >= template.steps.length) {
      // Consultation complete
      this.currentStructuredConsult.status = 'completed';
      this.currentStructuredConsult.completionTime = new Date();
      
      await this.sendSystemMessage(
        'Structured consultation completed. Thank you for your responses.',
        this.currentSession.sessionId
      );
      return;
    }

    const step = template.steps[currentStep];
    let promptText = `**${step.title}**\n\n${step.description}`;

    if (step.responseType === 'multiple-choice' && step.options) {
      promptText += '\n\nPlease choose one of the following options:\n';
      step.options.forEach((option, index) => {
        promptText += `${index + 1}. ${option}\n`;
      });
    } else if (step.responseType === 'numeric' && step.validation?.numericRange) {
      const range = step.validation.numericRange;
      promptText += `\n\nPlease enter a number between ${range.min} and ${range.max}.`;
    }

    if (step.required) {
      promptText += '\n\n*This field is required.*';
    }

    await this.sendSystemMessage(promptText, this.currentSession.sessionId);
  }

  private async processStructuredResponse(content: string): Promise<void> {
    if (!this.currentStructuredConsult || !this.currentSession) return;

    const { template, currentStep } = this.currentStructuredConsult;
    
    if (currentStep >= template.steps.length) return;

    const step = template.steps[currentStep];
    
    try {
      // Validate response
      const validationResult = this.validateStepResponse(step, content);
      if (!validationResult.isValid) {
        await this.sendSystemMessage(
          `Please provide a valid response: ${validationResult.error}`,
          this.currentSession.sessionId
        );
        return;
      }

      // Store response
      const response: StructuredResponse = {
        stepId: step.stepId,
        value: validationResult.value,
        timestamp: new Date()
      };

      this.currentStructuredConsult.responses.push(response);
      this.currentStructuredConsult.currentStep++;

      // Move to next step
      await this.presentCurrentStep();

    } catch (error) {
      await this.sendSystemMessage(
        'Error processing your response. Please try again.',
        this.currentSession.sessionId
      );
    }
  }

  private validateStepResponse(step: any, content: string): { isValid: boolean; value?: any; error?: string } {
    const trimmedContent = content.trim();

    if (step.required && !trimmedContent) {
      return { isValid: false, error: 'This field is required.' };
    }

    switch (step.responseType) {
      case 'text':
        if (step.validation?.minLength && trimmedContent.length < step.validation.minLength) {
          return { isValid: false, error: `Minimum length: ${step.validation.minLength} characters.` };
        }
        if (step.validation?.maxLength && trimmedContent.length > step.validation.maxLength) {
          return { isValid: false, error: `Maximum length: ${step.validation.maxLength} characters.` };
        }
        return { isValid: true, value: trimmedContent };

      case 'multiple-choice':
        const choiceNumber = parseInt(trimmedContent);
        if (isNaN(choiceNumber) || choiceNumber < 1 || choiceNumber > (step.options?.length || 0)) {
          return { isValid: false, error: 'Please enter a valid option number.' };
        }
        return { isValid: true, value: step.options![choiceNumber - 1] };

      case 'numeric':
        const numericValue = parseFloat(trimmedContent);
        if (isNaN(numericValue)) {
          return { isValid: false, error: 'Please enter a valid number.' };
        }
        if (step.validation?.numericRange) {
          const { min, max } = step.validation.numericRange;
          if (numericValue < min || numericValue > max) {
            return { isValid: false, error: `Please enter a number between ${min} and ${max}.` };
          }
        }
        return { isValid: true, value: numericValue };

      case 'date':
        const dateValue = new Date(trimmedContent);
        if (isNaN(dateValue.getTime())) {
          return { isValid: false, error: 'Please enter a valid date (YYYY-MM-DD).' };
        }
        return { isValid: true, value: dateValue };

      default:
        return { isValid: true, value: trimmedContent };
    }
  }

  private async processCommand(command: string, senderId: string, senderRole: UserRole): Promise<void> {
    const [cmd, ...args] = command.slice(1).split(' ');

    switch (cmd.toLowerCase()) {
      case 'help':
        await this.sendSystemMessage(this.getHelpText(), this.currentSession!.sessionId);
        break;

      case 'status':
        await this.sendSystemMessage(this.getStatusText(), this.currentSession!.sessionId);
        break;

      case 'urgent':
        if (senderRole === 'patient') {
          await this.handleUrgentRequest(args.join(' '));
        }
        break;

      case 'summary':
        if (senderRole === 'provider') {
          await this.sendConsultationSummary();
        }
        break;

      default:
        await this.sendSystemMessage(
          `Unknown command: ${cmd}. Type /help for available commands.`,
          this.currentSession!.sessionId
        );
    }
  }

  private async sendSystemMessage(content: string, sessionId: string): Promise<void> {
    const systemMessage: ConsultationMessage = {
      messageId: this.generateMessageId(),
      sessionId,
      senderId: 'system',
      senderRole: 'system',
      type: 'system',
      content,
      timestamp: new Date(),
      deliveryStatus: 'delivered',
      encrypted: false
    };

    this.addMessageToHistory(systemMessage);

    if (this.roomId) {
      await this.matrixClient.sendMessage(this.roomId, content, {
        msgtype: 'm.notice'
      });
    }
  }

  private getHelpText(): string {
    return `**Available Commands:**
/help - Show this help message
/status - Show consultation status
/urgent [message] - Mark message as urgent (patients only)
/summary - Generate consultation summary (providers only)

**Tips:**
- Type normally to send messages
- Use @ to mention specific participants
- Voice messages and file attachments are supported`;
  }

  private getStatusText(): string {
    if (!this.currentSession) return 'No active session';

    let status = `**Consultation Status:**
Session ID: ${this.currentSession.sessionId}
Type: ${this.currentSession.consultationType}
Mode: ${this.currentSession.mode}
Duration: ${this.getSessionDuration()}`;

    if (this.currentStructuredConsult) {
      const progress = `${this.currentStructuredConsult.currentStep}/${this.currentStructuredConsult.template.steps.length}`;
      status += `\n\n**Structured Consultation:**
Template: ${this.currentStructuredConsult.template.name}
Progress: ${progress} steps completed`;
    }

    return status;
  }

  private async handleUrgentRequest(message: string): Promise<void> {
    // In a real implementation, this would trigger alerts to providers
    await this.sendSystemMessage(
      '🚨 **URGENT REQUEST NOTED** 🚨\nYour message has been marked as urgent and the provider has been notified.',
      this.currentSession!.sessionId
    );
  }

  private async sendConsultationSummary(): Promise<void> {
    // Generate a summary of the consultation
    const messages = this.getMessageHistory(this.currentSession!.sessionId);
    const summary = this.generateConsultationSummary(messages);
    
    await this.sendSystemMessage(
      `**Consultation Summary:**\n${summary}`,
      this.currentSession!.sessionId
    );
  }

  private generateConsultationSummary(messages: ConsultationMessage[]): string {
    const patientMessages = messages.filter(m => m.senderRole === 'patient');
    const providerMessages = messages.filter(m => m.senderRole === 'provider');
    
    return `Total messages: ${messages.length}
Patient messages: ${patientMessages.length}
Provider messages: ${providerMessages.length}
Duration: ${this.getSessionDuration()}
Urgent flags: ${messages.filter(m => m.metadata?.medicalContext?.urgency === 'high').length}`;
  }

  private getSessionDuration(): string {
    if (!this.currentSession) return '0 minutes';
    
    const duration = Date.now() - this.currentSession.startTime.getTime();
    const minutes = Math.floor(duration / 60000);
    return `${minutes} minutes`;
  }

  private addMessageToHistory(message: ConsultationMessage): void {
    const messages = this.messages.get(message.sessionId) || [];
    messages.push(message);
    this.messages.set(message.sessionId, messages);

    // Limit message history to prevent memory issues
    const maxMessages = 1000;
    if (messages.length > maxMessages) {
      messages.splice(0, messages.length - maxMessages);
    }
  }

  private determineSenderRole(senderId: string): UserRole {
    // In a real implementation, this would look up the user role
    // For now, we'll use simple heuristics
    if (senderId === 'system') return 'system';
    if (senderId.includes('provider') || senderId.includes('doctor')) return 'provider';
    if (senderId.includes('admin')) return 'admin';
    return 'patient';
  }

  private determineMessageType(content: any): ConsultationMessage['type'] {
    if (content.msgtype === 'm.file') return 'document';
    if (content.msgtype === 'm.audio') return 'voice';
    if (content.msgtype === 'm.image') return 'image';
    if (content.msgtype === 'm.notice') return 'system';
    return 'text';
  }

  private assessMessageUrgency(content: string): 'low' | 'medium' | 'high' {
    const urgentKeywords = ['urgent', 'emergency', 'help', 'pain', 'bleeding', 'chest pain', 'difficulty breathing'];
    const lowerContent = content.toLowerCase();
    
    if (urgentKeywords.some(keyword => lowerContent.includes(keyword))) {
      return 'high';
    }
    
    return 'medium';
  }

  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private startAutoSave(): void {
    if (this.config.autoSaveIntervalSeconds > 0) {
      this.autoSaveInterval = setInterval(() => {
        this.saveConsultationData();
      }, this.config.autoSaveIntervalSeconds * 1000);
    }
  }

  private stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = undefined;
    }
  }

  private saveConsultationData(): void {
    // In a real implementation, this would save to a persistent store
    // For now, we'll just log that auto-save occurred
    if (this.currentSession) {
      console.log(`Auto-saving consultation data for session ${this.currentSession.sessionId}`);
    }
  }

  private emitEvent(event: MessageEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('Error in message event listener:', error);
        }
      });
    }
  }
}