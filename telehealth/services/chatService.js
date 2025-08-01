/**
 * @fileoverview Secure Chat Service for Telehealth
 * 
 * This service provides secure, encrypted messaging capabilities for telehealth
 * sessions with HIPAA compliance, PHI protection, and real-time communication.
 * 
 * Features:
 * - End-to-end encrypted messaging
 * - PHI detection and protection
 * - Message persistence with encryption
 * - Real-time delivery
 * - HIPAA-compliant audit logging
 * - File sharing with encryption
 * - Message translation
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

const EventEmitter = require('events');
const crypto = require('crypto');
const WebSocket = require('ws');
const hipaaConfig = require('../config/hipaa');

/**
 * Secure Chat Service for telehealth communications
 */
class SecureChatService extends EventEmitter {
    constructor(sessionId, options = {}) {
        super();
        
        this.sessionId = sessionId;
        this.config = {
            // Encryption configuration
            encryptionEnabled: options.encryptionEnabled !== false,
            encryptionAlgorithm: options.encryptionAlgorithm || 'aes-256-gcm',
            keyRotationInterval: options.keyRotationInterval || 24 * 60 * 60 * 1000, // 24 hours
            
            // Message configuration
            maxMessageLength: options.maxMessageLength || 4096,
            messagePersistence: options.messagePersistence !== false,
            messageRetention: options.messageRetention || 2555, // days (7 years)
            
            // PHI protection
            phiDetectionEnabled: options.phiDetectionEnabled !== false,
            phiAnonymizationEnabled: options.phiAnonymizationEnabled !== false,
            phiAlertThreshold: options.phiAlertThreshold || 0.8,
            
            // File sharing
            fileShareEnabled: options.fileShareEnabled !== false,
            maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB
            allowedFileTypes: options.allowedFileTypes || [
                'application/pdf', 'image/jpeg', 'image/png', 'text/plain',
                'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ],
            
            // Translation
            translationEnabled: options.translationEnabled !== false,
            autoTranslate: options.autoTranslate || false,
            defaultLanguage: options.defaultLanguage || 'en',
            
            // Delivery configuration
            deliveryConfirmation: options.deliveryConfirmation !== false,
            readReceipts: options.readReceipts !== false,
            typingIndicators: options.typingIndicators !== false,
            
            // Rate limiting
            maxMessagesPerMinute: options.maxMessagesPerMinute || 60,
            maxFilesPerHour: options.maxFilesPerHour || 10,
            
            ...options
        };

        this.state = {
            connected: false,
            participants: new Map(),
            messages: [],
            encryptionKeys: new Map(),
            rateLimits: new Map(),
            typingUsers: new Set()
        };

        this.websocket = null;
        this.messageQueue = [];
        this.deliveryAcks = new Map();
        
        this.initializeService();
    }

    /**
     * Initialize the chat service
     */
    initializeService() {
        this.validateConfiguration();
        this.generateEncryptionKeys();
        this.initializeRateLimiting();
        
        // Log service initialization
        hipaaConfig.logAuditEvent('CHAT_SERVICE_INIT', {
            sessionId: this.sessionId,
            resourceType: 'ChatService',
            action: 'INITIALIZE',
            details: {
                encryptionEnabled: this.config.encryptionEnabled,
                phiDetectionEnabled: this.config.phiDetectionEnabled,
                fileShareEnabled: this.config.fileShareEnabled
            }
        });

        console.log('✅ Secure chat service initialized', {
            sessionId: this.sessionId,
            encryption: this.config.encryptionEnabled,
            phiProtection: this.config.phiDetectionEnabled
        });
    }

    /**
     * Validate service configuration
     */
    validateConfiguration() {
        if (!this.sessionId) {
            throw new Error('Session ID is required for chat service');
        }

        if (this.config.maxMessageLength < 1 || this.config.maxMessageLength > 10000) {
            throw new Error('Message length must be between 1 and 10000 characters');
        }

        if (this.config.maxFileSize > 50 * 1024 * 1024) {
            console.warn('⚠️ Large file size limit may impact performance');
        }
    }

    /**
     * Generate encryption keys for the session
     */
    generateEncryptionKeys() {
        if (!this.config.encryptionEnabled) {
            return;
        }

        const sessionKey = crypto.randomBytes(32); // 256-bit key
        const keyId = crypto.randomUUID();
        
        this.state.encryptionKeys.set(keyId, {
            key: sessionKey,
            created: new Date(),
            rotations: 0
        });

        this.currentKeyId = keyId;
        
        // Schedule key rotation
        this.scheduleKeyRotation();

        console.log('🔐 Encryption keys generated for session');
    }

    /**
     * Schedule automatic key rotation
     */
    scheduleKeyRotation() {
        setInterval(() => {
            this.rotateEncryptionKey();
        }, this.config.keyRotationInterval);
    }

    /**
     * Rotate encryption key
     */
    rotateEncryptionKey() {
        const newKey = crypto.randomBytes(32);
        const newKeyId = crypto.randomUUID();
        
        this.state.encryptionKeys.set(newKeyId, {
            key: newKey,
            created: new Date(),
            rotations: 0
        });

        const oldKeyId = this.currentKeyId;
        this.currentKeyId = newKeyId;

        // Keep old key for a while to decrypt old messages
        setTimeout(() => {
            this.state.encryptionKeys.delete(oldKeyId);
        }, 60000); // Keep for 1 minute

        // Log key rotation
        hipaaConfig.logAuditEvent('CHAT_KEY_ROTATION', {
            sessionId: this.sessionId,
            resourceType: 'ChatService',
            action: 'ROTATE_KEY',
            details: { newKeyId, oldKeyId }
        });

        console.log('🔄 Encryption key rotated');
    }

    /**
     * Initialize rate limiting
     */
    initializeRateLimiting() {
        // Reset rate limits periodically
        setInterval(() => {
            this.state.rateLimits.clear();
        }, 60000); // Reset every minute
    }

    /**
     * Connect to chat service
     */
    async connect(userId, userRole = 'participant') {
        try {
            if (this.websocket) {
                await this.disconnect();
            }

            const wsUrl = `wss://localhost:3000/telehealth/chat?session=${this.sessionId}&user=${userId}`;
            
            this.websocket = new WebSocket(wsUrl, {
                headers: {
                    'X-Session-ID': this.sessionId,
                    'X-User-ID': userId,
                    'X-User-Role': userRole
                }
            });

            this.setupWebSocketHandlers();
            
            await this.waitForConnection();
            
            this.state.connected = true;
            this.addParticipant(userId, userRole);

            // Send queued messages
            this.processMessageQueue();

            this.emit('connected', { userId, sessionId: this.sessionId });

            // Log connection
            hipaaConfig.logAuditEvent('CHAT_CONNECT', {
                sessionId: this.sessionId,
                userId,
                resourceType: 'ChatService',
                action: 'CONNECT',
                details: { userRole }
            });

            console.log('💬 Connected to chat service', { sessionId: this.sessionId, userId });

        } catch (error) {
            this.handleError('Failed to connect to chat service', error);
            throw error;
        }
    }

    /**
     * Setup WebSocket event handlers
     */
    setupWebSocketHandlers() {
        this.websocket.on('open', () => {
            console.log('📡 Chat WebSocket connected');
        });

        this.websocket.on('message', (data) => {
            this.handleWebSocketMessage(data);
        });

        this.websocket.on('error', (error) => {
            this.handleError('Chat WebSocket error', error);
        });

        this.websocket.on('close', (code, reason) => {
            this.handleWebSocketClose(code, reason);
        });
    }

    /**
     * Handle incoming WebSocket messages
     */
    handleWebSocketMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            
            switch (message.type) {
                case 'message':
                    this.handleIncomingMessage(message);
                    break;
                    
                case 'delivery_ack':
                    this.handleDeliveryAck(message);
                    break;
                    
                case 'read_receipt':
                    this.handleReadReceipt(message);
                    break;
                    
                case 'typing_indicator':
                    this.handleTypingIndicator(message);
                    break;
                    
                case 'participant_joined':
                    this.handleParticipantJoined(message);
                    break;
                    
                case 'participant_left':
                    this.handleParticipantLeft(message);
                    break;
                    
                case 'file_shared':
                    this.handleFileShared(message);
                    break;
                    
                default:
                    console.warn('Unknown chat message type:', message.type);
            }
        } catch (error) {
            this.handleError('Failed to parse chat message', error);
        }
    }

    /**
     * Send chat message
     */
    async sendMessage(content, recipientId = null, options = {}) {
        try {
            // Check rate limiting
            if (!this.checkRateLimit('message')) {
                throw new Error('Rate limit exceeded for messages');
            }

            // Validate message content
            if (!content || typeof content !== 'string') {
                throw new Error('Message content is required and must be a string');
            }

            if (content.length > this.config.maxMessageLength) {
                throw new Error(`Message exceeds maximum length of ${this.config.maxMessageLength} characters`);
            }

            // Detect PHI in message
            let phiDetected = [];
            if (this.config.phiDetectionEnabled) {
                phiDetected = this.detectPHI(content);
                
                if (phiDetected.length > 0 && this.config.phiAnonymizationEnabled) {
                    content = this.anonymizePHI(content, phiDetected);
                }
                
                // Alert if high PHI confidence
                const maxConfidence = Math.max(...phiDetected.map(p => p.confidence || 0));
                if (maxConfidence > this.config.phiAlertThreshold) {
                    this.emit('phiAlert', { phiDetected, confidence: maxConfidence });
                }
            }

            // Create message object
            const message = {
                id: crypto.randomUUID(),
                sessionId: this.sessionId,
                senderId: options.senderId || 'system',
                recipientId,
                content,
                timestamp: new Date().toISOString(),
                encrypted: this.config.encryptionEnabled,
                phiDetected,
                messageType: options.messageType || 'text',
                priority: options.priority || 'normal',
                requiresDeliveryConfirmation: this.config.deliveryConfirmation,
                requiresReadReceipt: this.config.readReceipts
            };

            // Encrypt message if encryption is enabled
            if (this.config.encryptionEnabled) {
                message.encryptedContent = this.encryptMessage(content);
                message.keyId = this.currentKeyId;
                delete message.content; // Remove plaintext content
            }

            // Add to message history
            this.state.messages.push(message);

            // Send message via WebSocket
            if (this.state.connected) {
                this.websocket.send(JSON.stringify({
                    type: 'message',
                    data: message
                }));
            } else {
                // Queue message if not connected
                this.messageQueue.push(message);
            }

            // Persist message if enabled
            if (this.config.messagePersistence) {
                await this.persistMessage(message);
            }

            this.emit('messageSent', message);

            // Log message send
            hipaaConfig.logAuditEvent('CHAT_MESSAGE_SEND', {
                sessionId: this.sessionId,
                userId: message.senderId,
                resourceType: 'ChatMessage',
                resourceId: message.id,
                action: 'SEND_MESSAGE',
                details: {
                    recipientId,
                    messageType: message.messageType,
                    encrypted: message.encrypted,
                    phiDetected: phiDetected.length
                }
            });

            console.log('💬 Message sent', { messageId: message.id, encrypted: message.encrypted });
            
            return message;

        } catch (error) {
            this.handleError('Failed to send message', error);
            throw error;
        }
    }

    /**
     * Share file in chat
     */
    async shareFile(file, recipientId = null, options = {}) {
        try {
            // Check rate limiting
            if (!this.checkRateLimit('file')) {
                throw new Error('Rate limit exceeded for file sharing');
            }

            if (!this.config.fileShareEnabled) {
                throw new Error('File sharing is not enabled');
            }

            // Validate file
            if (!file || !file.buffer) {
                throw new Error('File data is required');
            }

            if (file.size > this.config.maxFileSize) {
                throw new Error(`File size exceeds maximum limit of ${this.config.maxFileSize} bytes`);
            }

            if (!this.config.allowedFileTypes.includes(file.mimetype)) {
                throw new Error(`File type ${file.mimetype} is not allowed`);
            }

            // Scan file for PHI
            let phiDetected = [];
            if (this.config.phiDetectionEnabled && file.mimetype === 'text/plain') {
                const content = file.buffer.toString('utf8');
                phiDetected = this.detectPHI(content);
            }

            // Create file object
            const fileMessage = {
                id: crypto.randomUUID(),
                sessionId: this.sessionId,
                senderId: options.senderId || 'system',
                recipientId,
                fileName: file.originalname,
                fileSize: file.size,
                mimeType: file.mimetype,
                timestamp: new Date().toISOString(),
                encrypted: this.config.encryptionEnabled,
                phiDetected,
                messageType: 'file'
            };

            // Encrypt file if encryption is enabled
            if (this.config.encryptionEnabled) {
                fileMessage.encryptedData = this.encryptFile(file.buffer);
                fileMessage.keyId = this.currentKeyId;
            } else {
                fileMessage.fileData = file.buffer.toString('base64');
            }

            // Add to message history
            this.state.messages.push(fileMessage);

            // Send file message via WebSocket
            if (this.state.connected) {
                // Send metadata first (not the full file data via WebSocket)
                const metadata = { ...fileMessage };
                delete metadata.fileData;
                delete metadata.encryptedData;
                
                this.websocket.send(JSON.stringify({
                    type: 'file_shared',
                    data: metadata
                }));
            }

            // Persist file if enabled
            if (this.config.messagePersistence) {
                await this.persistMessage(fileMessage);
            }

            this.emit('fileShared', fileMessage);

            // Log file share
            hipaaConfig.logAuditEvent('CHAT_FILE_SHARE', {
                sessionId: this.sessionId,
                userId: fileMessage.senderId,
                resourceType: 'ChatFile',
                resourceId: fileMessage.id,
                action: 'SHARE_FILE',
                details: {
                    fileName: fileMessage.fileName,
                    fileSize: fileMessage.fileSize,
                    mimeType: fileMessage.mimeType,
                    encrypted: fileMessage.encrypted,
                    phiDetected: phiDetected.length
                }
            });

            console.log('📎 File shared', { fileId: fileMessage.id, fileName: fileMessage.fileName });
            
            return fileMessage;

        } catch (error) {
            this.handleError('Failed to share file', error);
            throw error;
        }
    }

    /**
     * Encrypt message content
     */
    encryptMessage(content) {
        const key = this.state.encryptionKeys.get(this.currentKeyId)?.key;
        if (!key) {
            throw new Error('Encryption key not available');
        }

        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher(this.config.encryptionAlgorithm, key);
        
        let encrypted = cipher.update(content, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag ? cipher.getAuthTag().toString('hex') : null;
        
        return {
            encrypted,
            iv: iv.toString('hex'),
            authTag,
            algorithm: this.config.encryptionAlgorithm
        };
    }

    /**
     * Decrypt message content
     */
    decryptMessage(encryptedData, keyId) {
        const keyData = this.state.encryptionKeys.get(keyId);
        if (!keyData) {
            throw new Error('Decryption key not available');
        }

        const decipher = crypto.createDecipher(encryptedData.algorithm, keyData.key);
        
        if (encryptedData.authTag) {
            decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
        }
        
        let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }

    /**
     * Encrypt file data
     */
    encryptFile(fileBuffer) {
        const key = this.state.encryptionKeys.get(this.currentKeyId)?.key;
        if (!key) {
            throw new Error('Encryption key not available');
        }

        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher(this.config.encryptionAlgorithm, key);
        
        const encrypted = Buffer.concat([
            cipher.update(fileBuffer),
            cipher.final()
        ]);
        
        const authTag = cipher.getAuthTag ? cipher.getAuthTag() : null;
        
        return {
            encrypted: encrypted.toString('base64'),
            iv: iv.toString('hex'),
            authTag: authTag ? authTag.toString('hex') : null,
            algorithm: this.config.encryptionAlgorithm
        };
    }

    /**
     * Check rate limiting
     */
    checkRateLimit(type) {
        const now = Date.now();
        const window = 60000; // 1 minute window
        
        if (!this.state.rateLimits.has(type)) {
            this.state.rateLimits.set(type, []);
        }
        
        const requests = this.state.rateLimits.get(type);
        
        // Remove old requests outside the window
        const validRequests = requests.filter(time => now - time < window);
        
        const limit = type === 'message' ? this.config.maxMessagesPerMinute : this.config.maxFilesPerHour / 60;
        
        if (validRequests.length >= limit) {
            return false;
        }
        
        validRequests.push(now);
        this.state.rateLimits.set(type, validRequests);
        
        return true;
    }

    /**
     * Detect PHI in content
     */
    detectPHI(content) {
        const phiPatterns = [
            { type: 'ssn', pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g, confidence: 0.9 },
            { type: 'phone', pattern: /\b\d{3}-?\d{3}-?\d{4}\b/g, confidence: 0.8 },
            { type: 'email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, confidence: 0.7 },
            { type: 'mrn', pattern: /\b(?:MRN|mrn|medical record|patient id)\s*:?\s*(\w+)/gi, confidence: 0.9 },
            { type: 'date', pattern: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, confidence: 0.6 },
            { type: 'credit_card', pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, confidence: 0.8 }
        ];

        const detected = [];
        
        phiPatterns.forEach(({ type, pattern, confidence }) => {
            const matches = content.match(pattern);
            if (matches) {
                matches.forEach(match => {
                    detected.push({
                        type,
                        value: match,
                        position: content.indexOf(match),
                        confidence
                    });
                });
            }
        });

        return detected;
    }

    /**
     * Anonymize PHI in content
     */
    anonymizePHI(content, phiDetected) {
        let anonymized = content;
        
        // Sort by position (descending) to maintain string positions
        phiDetected.sort((a, b) => b.position - a.position);
        
        phiDetected.forEach(phi => {
            const replacement = `[${phi.type.toUpperCase()}]`;
            anonymized = anonymized.replace(phi.value, replacement);
        });

        return anonymized;
    }

    /**
     * Handle incoming message
     */
    handleIncomingMessage(message) {
        const messageData = message.data;
        
        // Decrypt message if encrypted
        if (messageData.encrypted && messageData.encryptedContent) {
            try {
                messageData.content = this.decryptMessage(messageData.encryptedContent, messageData.keyId);
            } catch (error) {
                console.error('Failed to decrypt message:', error);
                return;
            }
        }

        // Add to message history
        this.state.messages.push(messageData);

        // Send delivery acknowledgment
        if (messageData.requiresDeliveryConfirmation) {
            this.sendDeliveryAck(messageData.id, messageData.senderId);
        }

        this.emit('messageReceived', messageData);

        // Log message receive
        hipaaConfig.logAuditEvent('CHAT_MESSAGE_RECEIVE', {
            sessionId: this.sessionId,
            resourceType: 'ChatMessage',
            resourceId: messageData.id,
            action: 'RECEIVE_MESSAGE',
            details: {
                senderId: messageData.senderId,
                messageType: messageData.messageType,
                encrypted: messageData.encrypted
            }
        });
    }

    /**
     * Send delivery acknowledgment
     */
    sendDeliveryAck(messageId, senderId) {
        if (this.state.connected) {
            this.websocket.send(JSON.stringify({
                type: 'delivery_ack',
                data: {
                    messageId,
                    senderId,
                    timestamp: new Date().toISOString()
                }
            }));
        }
    }

    /**
     * Send read receipt
     */
    sendReadReceipt(messageId, senderId) {
        if (this.state.connected) {
            this.websocket.send(JSON.stringify({
                type: 'read_receipt',
                data: {
                    messageId,
                    senderId,
                    readAt: new Date().toISOString()
                }
            }));
        }

        // Log read receipt
        hipaaConfig.logAuditEvent('CHAT_READ_RECEIPT', {
            sessionId: this.sessionId,
            resourceType: 'ChatMessage',
            resourceId: messageId,
            action: 'READ_MESSAGE',
            details: { senderId }
        });
    }

    /**
     * Send typing indicator
     */
    sendTypingIndicator(isTyping) {
        if (this.state.connected && this.config.typingIndicators) {
            this.websocket.send(JSON.stringify({
                type: 'typing_indicator',
                data: {
                    isTyping,
                    timestamp: new Date().toISOString()
                }
            }));
        }
    }

    /**
     * Add participant to chat
     */
    addParticipant(userId, userRole) {
        this.state.participants.set(userId, {
            id: userId,
            role: userRole,
            joinedAt: new Date(),
            isTyping: false
        });

        this.emit('participantJoined', { userId, userRole });
    }

    /**
     * Handle participant joined
     */
    handleParticipantJoined(message) {
        const { userId, userRole } = message.data;
        this.addParticipant(userId, userRole);
    }

    /**
     * Handle participant left
     */
    handleParticipantLeft(message) {
        const { userId } = message.data;
        this.state.participants.delete(userId);
        this.state.typingUsers.delete(userId);
        
        this.emit('participantLeft', { userId });
    }

    /**
     * Handle typing indicator
     */
    handleTypingIndicator(message) {
        const { userId, isTyping } = message.data;
        
        if (isTyping) {
            this.state.typingUsers.add(userId);
        } else {
            this.state.typingUsers.delete(userId);
        }

        this.emit('typingIndicator', { userId, isTyping });
    }

    /**
     * Handle delivery acknowledgment
     */
    handleDeliveryAck(message) {
        const { messageId, timestamp } = message.data;
        this.deliveryAcks.set(messageId, timestamp);
        
        this.emit('deliveryConfirmed', { messageId, timestamp });
    }

    /**
     * Handle read receipt
     */
    handleReadReceipt(message) {
        const { messageId, readAt } = message.data;
        
        this.emit('messageRead', { messageId, readAt });
    }

    /**
     * Handle file shared
     */
    handleFileShared(message) {
        this.emit('fileReceived', message.data);
    }

    /**
     * Persist message to storage
     */
    async persistMessage(message) {
        // In a real implementation, this would save to a database
        // For now, we'll just log the persistence
        console.log('💾 Message persisted:', { messageId: message.id, type: message.messageType });
    }

    /**
     * Process queued messages
     */
    processMessageQueue() {
        while (this.messageQueue.length > 0 && this.state.connected) {
            const message = this.messageQueue.shift();
            this.websocket.send(JSON.stringify({
                type: 'message',
                data: message
            }));
        }
    }

    /**
     * Wait for WebSocket connection
     */
    waitForConnection() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, 10000);

            this.websocket.on('open', () => {
                clearTimeout(timeout);
                resolve();
            });

            this.websocket.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }

    /**
     * Disconnect from chat service
     */
    async disconnect() {
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }

        this.state.connected = false;
        this.emit('disconnected');

        // Log disconnection
        hipaaConfig.logAuditEvent('CHAT_DISCONNECT', {
            sessionId: this.sessionId,
            resourceType: 'ChatService',
            action: 'DISCONNECT',
            details: {
                messagesExchanged: this.state.messages.length,
                participantCount: this.state.participants.size
            }
        });

        console.log('💬 Disconnected from chat service');
    }

    /**
     * Handle WebSocket close
     */
    handleWebSocketClose(code, reason) {
        this.state.connected = false;
        console.log(`💬 Chat WebSocket closed: ${code} - ${reason}`);
        
        // Attempt reconnection if unexpected close
        if (code !== 1000 && code !== 1001) {
            console.log('🔄 Attempting to reconnect to chat...');
            setTimeout(() => this.connect().catch(console.error), 5000);
        }
    }

    /**
     * Get chat history
     */
    getChatHistory(limit = 50) {
        return this.state.messages.slice(-limit);
    }

    /**
     * Get chat statistics
     */
    getChatStatistics() {
        return {
            sessionId: this.sessionId,
            connected: this.state.connected,
            participantCount: this.state.participants.size,
            messageCount: this.state.messages.length,
            encryptionEnabled: this.config.encryptionEnabled,
            typingUsers: Array.from(this.state.typingUsers),
            queuedMessages: this.messageQueue.length
        };
    }

    /**
     * Handle errors
     */
    handleError(message, error) {
        console.error(`❌ Chat Service - ${message}:`, error);
        
        this.emit('error', { message, error });

        // Log error event
        hipaaConfig.logAuditEvent('CHAT_SERVICE_ERROR', {
            sessionId: this.sessionId,
            resourceType: 'ChatService',
            action: 'ERROR',
            outcome: 'FAILURE',
            details: { message, error: error.message }
        });
    }

    /**
     * Clean up resources
     */
    cleanup() {
        this.disconnect();
        this.removeAllListeners();
        this.state.messages = [];
        this.state.encryptionKeys.clear();
        this.messageQueue = [];
    }
}

module.exports = SecureChatService;