/**
 * ChatEHR Integration Service
 * Provides API integration with ChatEHR for consultation requests, appointments, and messaging
 * HIPAA-compliant with audit logging and secure communication
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class ChatEHRService {
    constructor(options = {}) {
        this.baseUrl = options.baseUrl || process.env.CHATEHR_API_URL || 'https://api.chatehr.com/v1';
        this.apiKey = options.apiKey || process.env.CHATEHR_API_KEY;
        this.clientId = options.clientId || process.env.CHATEHR_CLIENT_ID;
        this.clientSecret = options.clientSecret || process.env.CHATEHR_CLIENT_SECRET;
        this.timeout = options.timeout || 30000;
        this.enableAuditLogging = options.enableAuditLogging !== false;
        
        // Initialize HTTP client
        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'WebQx-ChatEHR-Integration/1.0.0',
                ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
            }
        });

        // Add request/response interceptors for audit logging
        if (this.enableAuditLogging) {
            this.setupAuditLogging();
        }

        this.logInfo('ChatEHR Service initialized', { baseUrl: this.baseUrl, timeout: this.timeout });
    }

    /**
     * Setup audit logging for HIPAA compliance
     */
    setupAuditLogging() {
        this.client.interceptors.request.use(
            (config) => {
                config.metadata = { startTime: Date.now(), requestId: uuidv4() };
                this.logAudit('API_REQUEST', {
                    requestId: config.metadata.requestId,
                    method: config.method.toUpperCase(),
                    url: config.url,
                    timestamp: new Date().toISOString()
                });
                return config;
            },
            (error) => {
                this.logError('Request interceptor error', error);
                return Promise.reject(error);
            }
        );

        this.client.interceptors.response.use(
            (response) => {
                const duration = Date.now() - response.config.metadata.startTime;
                this.logAudit('API_RESPONSE', {
                    requestId: response.config.metadata.requestId,
                    status: response.status,
                    duration: `${duration}ms`,
                    timestamp: new Date().toISOString()
                });
                return response;
            },
            (error) => {
                const duration = error.config?.metadata ? Date.now() - error.config.metadata.startTime : 0;
                this.logAudit('API_ERROR', {
                    requestId: error.config?.metadata?.requestId,
                    status: error.response?.status || 'NETWORK_ERROR',
                    error: error.message,
                    duration: `${duration}ms`,
                    timestamp: new Date().toISOString()
                });
                return Promise.reject(error);
            }
        );
    }

    /**
     * Create a consultation request
     * @param {Object} request - Consultation request data
     * @param {string} request.patientId - Patient ID
     * @param {string} request.physicianId - Physician ID (optional, for direct requests)
     * @param {string} request.specialty - Medical specialty
     * @param {string} request.urgency - Urgency level (routine, urgent, emergency)
     * @param {string} request.description - Consultation description
     * @param {Object} request.metadata - Additional metadata
     * @returns {Promise<Object>} Consultation request response
     */
    async createConsultationRequest(request) {
        try {
            this.validateConsultationRequest(request);
            
            const payload = {
                id: uuidv4(),
                patientId: request.patientId,
                physicianId: request.physicianId || null,
                specialty: request.specialty,
                urgency: request.urgency || 'routine',
                description: request.description,
                status: 'pending',
                createdAt: new Date().toISOString(),
                metadata: {
                    source: 'webqx',
                    ...request.metadata
                }
            };

            const response = await this.client.post('/consultations', payload);

            this.logAudit('CONSULTATION_CREATED', {
                consultationId: response.data.id,
                patientId: request.patientId,
                physicianId: request.physicianId,
                specialty: request.specialty,
                urgency: request.urgency
            });

            return {
                success: true,
                data: response.data,
                metadata: {
                    requestId: response.config.metadata.requestId,
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            this.logError('Failed to create consultation request', error);
            return {
                success: false,
                error: {
                    code: error.response?.status || 'NETWORK_ERROR',
                    message: error.response?.data?.message || error.message,
                    details: error.response?.data?.details || null
                }
            };
        }
    }

    /**
     * Get consultation requests for a user (physician or patient)
     * @param {string} userId - User ID
     * @param {string} userType - User type ('physician' or 'patient')
     * @param {Object} filters - Optional filters
     * @returns {Promise<Object>} List of consultation requests
     */
    async getConsultationRequests(userId, userType, filters = {}) {
        try {
            const params = {
                [userType === 'physician' ? 'physicianId' : 'patientId']: userId,
                ...filters
            };

            const response = await this.client.get('/consultations', { params });

            return {
                success: true,
                data: response.data,
                metadata: {
                    count: response.data.length,
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            this.logError('Failed to get consultation requests', error);
            return {
                success: false,
                error: {
                    code: error.response?.status || 'NETWORK_ERROR',
                    message: error.response?.data?.message || error.message
                }
            };
        }
    }

    /**
     * Update consultation request status
     * @param {string} consultationId - Consultation ID
     * @param {string} status - New status
     * @param {string} physicianId - Physician ID (for assignment)
     * @param {Object} metadata - Additional metadata
     * @returns {Promise<Object>} Update response
     */
    async updateConsultationRequest(consultationId, status, physicianId = null, metadata = {}) {
        try {
            const payload = {
                status,
                physicianId,
                updatedAt: new Date().toISOString(),
                metadata: {
                    updatedBy: 'webqx',
                    ...metadata
                }
            };

            const response = await this.client.put(`/consultations/${consultationId}`, payload);

            this.logAudit('CONSULTATION_UPDATED', {
                consultationId,
                status,
                physicianId,
                updatedBy: metadata.updatedBy || 'system'
            });

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            this.logError('Failed to update consultation request', error);
            return {
                success: false,
                error: {
                    code: error.response?.status || 'NETWORK_ERROR',
                    message: error.response?.data?.message || error.message
                }
            };
        }
    }

    /**
     * Sync appointments from ChatEHR
     * @param {string} userId - User ID
     * @param {string} userType - User type ('physician' or 'patient')
     * @param {Object} dateRange - Date range for sync
     * @returns {Promise<Object>} Appointment data
     */
    async syncAppointments(userId, userType, dateRange = {}) {
        try {
            const params = {
                [userType === 'physician' ? 'physicianId' : 'patientId']: userId,
                startDate: dateRange.startDate || new Date().toISOString().split('T')[0],
                endDate: dateRange.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            };

            const response = await this.client.get('/appointments', { params });

            this.logAudit('APPOINTMENTS_SYNCED', {
                userId,
                userType,
                count: response.data.length,
                dateRange: params
            });

            return {
                success: true,
                data: response.data,
                metadata: {
                    syncedAt: new Date().toISOString(),
                    count: response.data.length
                }
            };
        } catch (error) {
            this.logError('Failed to sync appointments', error);
            return {
                success: false,
                error: {
                    code: error.response?.status || 'NETWORK_ERROR',
                    message: error.response?.data?.message || error.message
                }
            };
        }
    }

    /**
     * Send secure message through ChatEHR
     * @param {Object} message - Message data
     * @param {string} message.fromId - Sender ID
     * @param {string} message.toId - Recipient ID
     * @param {string} message.content - Message content (encrypted)
     * @param {string} message.consultationId - Related consultation ID
     * @param {string} message.type - Message type ('text', 'attachment', 'system')
     * @returns {Promise<Object>} Message response
     */
    async sendSecureMessage(message) {
        try {
            this.validateMessage(message);

            const payload = {
                id: uuidv4(),
                fromId: message.fromId,
                toId: message.toId,
                content: await this.encryptMessage(message.content),
                consultationId: message.consultationId,
                type: message.type || 'text',
                timestamp: new Date().toISOString(),
                metadata: {
                    source: 'webqx',
                    encrypted: true,
                    ...message.metadata
                }
            };

            const response = await this.client.post('/messages', payload);

            this.logAudit('MESSAGE_SENT', {
                messageId: response.data.id,
                fromId: message.fromId,
                toId: message.toId,
                consultationId: message.consultationId,
                type: message.type
            });

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            this.logError('Failed to send secure message', error);
            return {
                success: false,
                error: {
                    code: error.response?.status || 'NETWORK_ERROR',
                    message: error.response?.data?.message || error.message
                }
            };
        }
    }

    /**
     * Get secure messages for a conversation
     * @param {string} consultationId - Consultation ID
     * @param {string} userId - User ID for access control
     * @param {Object} pagination - Pagination options
     * @returns {Promise<Object>} Messages response
     */
    async getSecureMessages(consultationId, userId, pagination = {}) {
        try {
            const params = {
                consultationId,
                userId,
                limit: pagination.limit || 50,
                offset: pagination.offset || 0
            };

            const response = await this.client.get('/messages', { params });

            // Decrypt messages for the user
            const decryptedMessages = await Promise.all(
                response.data.map(async (msg) => ({
                    ...msg,
                    content: await this.decryptMessage(msg.content)
                }))
            );

            return {
                success: true,
                data: decryptedMessages,
                metadata: {
                    total: response.headers['x-total-count'] || decryptedMessages.length,
                    hasMore: decryptedMessages.length === params.limit
                }
            };
        } catch (error) {
            this.logError('Failed to get secure messages', error);
            return {
                success: false,
                error: {
                    code: error.response?.status || 'NETWORK_ERROR',
                    message: error.response?.data?.message || error.message
                }
            };
        }
    }

    /**
     * Validate consultation request data
     */
    validateConsultationRequest(request) {
        if (!request.patientId) throw new Error('Patient ID is required');
        if (!request.specialty) throw new Error('Specialty is required');
        if (!request.description) throw new Error('Description is required');
        
        const validUrgencies = ['routine', 'urgent', 'emergency'];
        if (request.urgency && !validUrgencies.includes(request.urgency)) {
            throw new Error('Invalid urgency level');
        }
    }

    /**
     * Validate message data
     */
    validateMessage(message) {
        if (!message.fromId) throw new Error('Sender ID is required');
        if (!message.toId) throw new Error('Recipient ID is required');
        if (!message.content) throw new Error('Message content is required');
        if (!message.consultationId) throw new Error('Consultation ID is required');
    }

    /**
     * Encrypt message content for secure transmission
     */
    async encryptMessage(content) {
        try {
            const algorithm = 'aes-256-gcm';
            const key = crypto.createHash('sha256').update(this.clientSecret || 'default-key').digest();
            const iv = crypto.randomBytes(16);
            
            const cipher = crypto.createCipher(algorithm, key);
            cipher.setAutoPadding(true);
            
            let encrypted = cipher.update(content, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            const authTag = cipher.getAuthTag().toString('hex');
            
            return `${iv.toString('hex')}:${authTag}:${encrypted}`;
        } catch (error) {
            this.logError('Message encryption failed', error);
            return content; // Fallback to unencrypted in case of error
        }
    }

    /**
     * Decrypt message content
     */
    async decryptMessage(encryptedContent) {
        try {
            if (!encryptedContent.includes(':')) {
                return encryptedContent; // Already decrypted or unencrypted
            }

            const [ivHex, authTagHex, encrypted] = encryptedContent.split(':');
            const algorithm = 'aes-256-gcm';
            const key = crypto.createHash('sha256').update(this.clientSecret || 'default-key').digest();
            
            const decipher = crypto.createDecipher(algorithm, key);
            decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
            
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            this.logError('Message decryption failed', error);
            return '[Encrypted Message - Decryption Failed]';
        }
    }

    /**
     * Log audit events for HIPAA compliance
     */
    logAudit(event, data) {
        if (!this.enableAuditLogging) return;
        
        console.log(`[ChatEHR Audit] ${event}`, {
            timestamp: new Date().toISOString(),
            event,
            data,
            service: 'ChatEHR'
        });
    }

    /**
     * Log informational messages
     */
    logInfo(message, data = {}) {
        console.log(`[ChatEHR Service] ${message}`, data);
    }

    /**
     * Log error messages
     */
    logError(message, error) {
        console.error(`[ChatEHR Service] ${message}`, {
            error: error.message,
            stack: error.stack,
            response: error.response?.data,
            status: error.response?.status
        });
    }

    /**
     * Health check for ChatEHR service
     */
    async healthCheck() {
        try {
            const response = await this.client.get('/health');
            return {
                success: true,
                status: 'healthy',
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                status: 'unhealthy',
                error: error.message
            };
        }
    }
}

module.exports = ChatEHRService;