const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const Consent = require('../../../fhir/models/Consent');

/**
 * Telehealth Session Management Service
 * Handles secure session creation, link generation, and consent management
 */
class TelehealthSessionService {
    constructor(options = {}) {
        this.options = {
            linkExpirationMinutes: options.linkExpirationMinutes || 120, // 2 hours default
            sessionDurationMinutes: options.sessionDurationMinutes || 120, // 2 hours default
            enableConsent: options.enableConsent !== false,
            baseUrl: options.baseUrl || process.env.WEBQX_BASE_URL || 'https://webqx.health',
            encryptionKey: options.encryptionKey || process.env.TELEHEALTH_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'),
            ...options
        };
        
        this.activeSessions = new Map();
        this.consentRecords = new Map();
        this.sessionLinks = new Map();
    }

    /**
     * Creates a new telehealth session
     * @param {Object} sessionData - Session creation data
     * @returns {Object} Session details with secure access link
     */
    async createSession(sessionData) {
        try {
            const sessionId = uuidv4();
            const linkToken = this.generateSecureToken();
            const now = new Date();
            const expiresAt = new Date(now.getTime() + this.options.linkExpirationMinutes * 60 * 1000);
            const sessionEndsAt = new Date(now.getTime() + this.options.sessionDurationMinutes * 60 * 1000);

            // Validate required fields
            if (!sessionData.patientId || !sessionData.providerId) {
                throw new Error('Patient ID and Provider ID are required');
            }

            const session = {
                id: sessionId,
                patientId: sessionData.patientId,
                providerId: sessionData.providerId,
                appointmentId: sessionData.appointmentId,
                status: 'scheduled',
                createdAt: now.toISOString(),
                scheduledFor: sessionData.scheduledFor || now.toISOString(),
                expiresAt: expiresAt.toISOString(),
                sessionEndsAt: sessionEndsAt.toISOString(),
                linkToken,
                consentRequired: this.options.enableConsent,
                consentStatus: this.options.enableConsent ? 'pending' : 'not_required',
                metadata: {
                    sessionType: sessionData.sessionType || 'consultation',
                    specialty: sessionData.specialty,
                    notes: sessionData.notes,
                    patientEmail: sessionData.patientEmail,
                    patientPhone: sessionData.patientPhone,
                    preferredNotification: sessionData.preferredNotification || 'email'
                }
            };

            // Generate secure access link
            const accessLink = this.generateAccessLink(sessionId, linkToken);
            session.accessLink = accessLink;

            // Store session
            this.activeSessions.set(sessionId, session);
            this.sessionLinks.set(linkToken, sessionId);

            return {
                sessionId,
                accessLink,
                expiresAt: session.expiresAt,
                sessionEndsAt: session.sessionEndsAt,
                consentRequired: session.consentRequired,
                status: session.status
            };

        } catch (error) {
            console.error('[Telehealth Service] Failed to create session:', error);
            throw error;
        }
    }

    /**
     * Generates a secure access link for the session
     * @param {string} sessionId - Session ID
     * @param {string} linkToken - Secure token
     * @returns {string} Secure access link
     */
    generateAccessLink(sessionId, linkToken) {
        const encryptedParams = this.encryptLinkData({
            sessionId,
            token: linkToken,
            timestamp: Date.now()
        });
        
        return `${this.options.baseUrl}/telehealth/join?access=${encryptedParams}`;
    }

    /**
     * Validates a session access link
     * @param {string} accessToken - Encrypted access token from link
     * @returns {Object} Validation result with session info
     */
    async validateSessionAccess(accessToken) {
        try {
            // Decrypt the access token
            const linkData = this.decryptLinkData(accessToken);
            const { sessionId, token, timestamp } = linkData;

            // Check if link has expired
            const linkAge = Date.now() - timestamp;
            const maxAge = this.options.linkExpirationMinutes * 60 * 1000;
            
            if (linkAge > maxAge) {
                return {
                    valid: false,
                    error: 'Session link has expired',
                    code: 'LINK_EXPIRED'
                };
            }

            // Verify session exists
            const session = this.activeSessions.get(sessionId);
            if (!session) {
                return {
                    valid: false,
                    error: 'Session not found',
                    code: 'SESSION_NOT_FOUND'
                };
            }

            // Verify token matches
            if (session.linkToken !== token) {
                return {
                    valid: false,
                    error: 'Invalid access token',
                    code: 'INVALID_TOKEN'
                };
            }

            // Check session status
            if (session.status === 'ended' || session.status === 'cancelled') {
                return {
                    valid: false,
                    error: 'Session has ended',
                    code: 'SESSION_ENDED'
                };
            }

            return {
                valid: true,
                session: {
                    id: session.id,
                    patientId: session.patientId,
                    providerId: session.providerId,
                    consentRequired: session.consentRequired,
                    consentStatus: session.consentStatus,
                    sessionType: session.metadata.sessionType,
                    specialty: session.metadata.specialty
                }
            };

        } catch (error) {
            console.error('[Telehealth Service] Failed to validate session access:', error);
            return {
                valid: false,
                error: 'Invalid access token format',
                code: 'INVALID_FORMAT'
            };
        }
    }

    /**
     * Records patient consent for telehealth session
     * @param {string} sessionId - Session ID
     * @param {Object} consentData - Consent details
     * @returns {Object} Consent record
     */
    async recordConsent(sessionId, consentData) {
        try {
            const session = this.activeSessions.get(sessionId);
            if (!session) {
                throw new Error('Session not found');
            }

            // Create FHIR Consent resource
            const consent = Consent.createTelehealthConsent({
                sessionId,
                patientReference: {
                    reference: `Patient/${session.patientId}`,
                    display: consentData.patientName
                },
                sessionPeriod: {
                    start: session.scheduledFor,
                    end: session.sessionEndsAt
                },
                consentMethod: consentData.method || 'electronic',
                ipAddress: consentData.ipAddress,
                userAgent: consentData.userAgent,
                performer: [{
                    reference: `Patient/${session.patientId}`,
                    display: consentData.patientName
                }]
            });

            // Add verification
            consent.addVerification({
                verified: true,
                verifiedWith: {
                    reference: `Patient/${session.patientId}`,
                    display: consentData.patientName
                },
                verificationDate: new Date().toISOString()
            });

            // Store consent record
            this.consentRecords.set(sessionId, consent);

            // Update session status
            session.consentStatus = 'given';
            session.consentDateTime = new Date().toISOString();
            session.status = 'ready';
            this.activeSessions.set(sessionId, session);

            console.log(`[Telehealth Service] Consent recorded for session ${sessionId}`);

            return {
                consentId: consent.id,
                status: 'recorded',
                dateTime: consent.dateTime,
                sessionStatus: session.status
            };

        } catch (error) {
            console.error('[Telehealth Service] Failed to record consent:', error);
            throw error;
        }
    }

    /**
     * Retrieves session information
     * @param {string} sessionId - Session ID
     * @returns {Object} Session details
     */
    getSession(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            return null;
        }

        return {
            id: session.id,
            patientId: session.patientId,
            providerId: session.providerId,
            appointmentId: session.appointmentId,
            status: session.status,
            consentStatus: session.consentStatus,
            createdAt: session.createdAt,
            scheduledFor: session.scheduledFor,
            expiresAt: session.expiresAt,
            sessionEndsAt: session.sessionEndsAt,
            metadata: session.metadata
        };
    }

    /**
     * Gets consent record for a session
     * @param {string} sessionId - Session ID
     * @returns {Object} FHIR Consent resource
     */
    getConsentRecord(sessionId) {
        const consent = this.consentRecords.get(sessionId);
        return consent ? consent.toJSON() : null;
    }

    /**
     * Starts a telehealth session
     * @param {string} sessionId - Session ID
     * @param {string} userId - User starting the session
     * @returns {Object} Session start result
     */
    async startSession(sessionId, userId) {
        try {
            const session = this.activeSessions.get(sessionId);
            if (!session) {
                throw new Error('Session not found');
            }

            // Verify user has access to this session
            if (userId !== session.patientId && userId !== session.providerId) {
                throw new Error('Access denied to session');
            }

            // Check consent if required
            if (session.consentRequired && session.consentStatus !== 'given') {
                throw new Error('Patient consent required before starting session');
            }

            // Update session status
            session.status = 'active';
            session.startedAt = new Date().toISOString();
            session.startedBy = userId;
            this.activeSessions.set(sessionId, session);

            console.log(`[Telehealth Service] Session ${sessionId} started by ${userId}`);

            return {
                sessionId,
                status: session.status,
                startedAt: session.startedAt,
                startedBy: session.startedBy
            };

        } catch (error) {
            console.error('[Telehealth Service] Failed to start session:', error);
            throw error;
        }
    }

    /**
     * Ends a telehealth session
     * @param {string} sessionId - Session ID
     * @param {string} userId - User ending the session
     * @returns {Object} Session end result
     */
    async endSession(sessionId, userId) {
        try {
            const session = this.activeSessions.get(sessionId);
            if (!session) {
                throw new Error('Session not found');
            }

            // Verify user can end this session
            if (userId !== session.providerId) {
                throw new Error('Only the provider can end the session');
            }

            // Update session status
            session.status = 'ended';
            session.endedAt = new Date().toISOString();
            session.endedBy = userId;
            this.activeSessions.set(sessionId, session);

            console.log(`[Telehealth Service] Session ${sessionId} ended by ${userId}`);

            return {
                sessionId,
                status: session.status,
                endedAt: session.endedAt,
                endedBy: session.endedBy,
                duration: session.startedAt ? 
                    Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000) : 
                    0
            };

        } catch (error) {
            console.error('[Telehealth Service] Failed to end session:', error);
            throw error;
        }
    }

    /**
     * Helper methods
     */

    generateSecureToken() {
        return crypto.randomBytes(32).toString('base64url');
    }

    encryptLinkData(data) {
        const algorithm = 'aes-256-gcm';
        const key = Buffer.from(this.options.encryptionKey, 'hex');
        const iv = crypto.randomBytes(16);
        
        const cipher = crypto.createCipher('aes-256-cbc', key);
        
        let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
        encrypted += cipher.final('base64');
        
        return Buffer.concat([
            iv,
            Buffer.from(encrypted, 'base64')
        ]).toString('base64url');
    }

    decryptLinkData(encryptedData) {
        const key = Buffer.from(this.options.encryptionKey, 'hex');
        
        const buffer = Buffer.from(encryptedData, 'base64url');
        const iv = buffer.slice(0, 16);
        const encrypted = buffer.slice(16);
        
        const decipher = crypto.createDecipher('aes-256-cbc', key);
        
        let decrypted = decipher.update(encrypted, null, 'utf8');
        decrypted += decipher.final('utf8');
        
        return JSON.parse(decrypted);
    }

    /**
     * Clean up expired sessions
     */
    cleanupExpiredSessions() {
        const now = new Date();
        
        for (const [sessionId, session] of this.activeSessions) {
            if (new Date(session.expiresAt) < now && session.status !== 'active') {
                console.log(`[Telehealth Service] Cleaning up expired session ${sessionId}`);
                this.activeSessions.delete(sessionId);
                this.sessionLinks.delete(session.linkToken);
                
                // Keep consent records for compliance
                // Don't delete from this.consentRecords
            }
        }
    }

    /**
     * Get service statistics
     */
    getStats() {
        const sessions = Array.from(this.activeSessions.values());
        
        return {
            totalSessions: sessions.length,
            activeSessions: sessions.filter(s => s.status === 'active').length,
            scheduledSessions: sessions.filter(s => s.status === 'scheduled').length,
            readySessions: sessions.filter(s => s.status === 'ready').length,
            endedSessions: sessions.filter(s => s.status === 'ended').length,
            consentRecords: this.consentRecords.size,
            consentGivenRate: sessions.filter(s => s.consentStatus === 'given').length / Math.max(sessions.length, 1)
        };
    }
}

module.exports = TelehealthSessionService;