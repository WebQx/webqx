/**
 * WebQX Telehealth Module
 * Provides telehealth session management with OAuth2 authentication
 */

const { v4: uuidv4 } = require('uuid');
const Encounter = require('../../fhir/models/Encounter');

class TelehealthService {
    constructor(oauth2Client) {
        this.oauth2Client = oauth2Client;
        this.activeSessions = new Map(); // In production, use Redis or database
        this.sessionTimers = new Map();
    }

    /**
     * Initialize a telehealth session
     * @param {Object} params - Session parameters
     * @returns {Object} Session initialization result
     */
    async initializeSession(params) {
        try {
            const {
                patientId,
                practitionerId,
                appointmentId,
                encounterData,
                providerToken,
                sessionOptions = {}
            } = params;

            // Validate OAuth2 token
            const tokenValidation = await this.validateProviderToken(providerToken);
            if (!tokenValidation.valid) {
                throw new Error('Invalid provider authentication token');
            }

            // Create or use existing encounter
            let encounter;
            if (encounterData && encounterData.encounterId) {
                // Use existing encounter
                encounter = await this.getEncounter(encounterData.encounterId);
                if (!encounter) {
                    throw new Error(`Encounter ${encounterData.encounterId} not found`);
                }
            } else {
                // Create new encounter for telehealth session
                encounter = Encounter.createTelehealth({
                    patientId,
                    practitionerId,
                    appointmentId,
                    reasonCode: encounterData?.reasonCode,
                    serviceType: encounterData?.serviceType
                });
            }

            // Generate unique session ID
            const sessionId = uuidv4();
            
            // Create session configuration
            const sessionConfig = {
                sessionId,
                encounterId: encounter.id,
                patientId,
                practitionerId,
                appointmentId,
                status: 'initializing',
                createdAt: new Date().toISOString(),
                provider: tokenValidation.provider,
                sessionType: sessionOptions.sessionType || 'video-call',
                maxDuration: sessionOptions.maxDuration || 3600, // 1 hour default
                autoEnd: sessionOptions.autoEnd !== false,
                features: {
                    video: sessionOptions.video !== false,
                    audio: sessionOptions.audio !== false,
                    chat: sessionOptions.chat !== false,
                    screenShare: sessionOptions.screenShare !== false,
                    fileShare: sessionOptions.fileShare !== false,
                    recording: sessionOptions.recording === true
                }
            };

            // Generate session URL
            const sessionUrl = this.generateSessionUrl(sessionConfig);
            encounter.setTelehealthUrl(sessionUrl);

            // Store session data
            this.activeSessions.set(sessionId, {
                config: sessionConfig,
                encounter: encounter,
                participants: new Map(),
                startTime: null,
                events: []
            });

            // Set auto-cleanup timer
            if (sessionConfig.autoEnd && sessionConfig.maxDuration) {
                const timer = setTimeout(() => {
                    this.endSession(sessionId, 'timeout');
                }, sessionConfig.maxDuration * 1000);
                
                this.sessionTimers.set(sessionId, timer);
            }

            return {
                success: true,
                sessionId,
                encounterId: encounter.id,
                sessionUrl,
                sessionConfig: {
                    sessionId,
                    encounterId: encounter.id,
                    sessionType: sessionConfig.sessionType,
                    features: sessionConfig.features,
                    maxDuration: sessionConfig.maxDuration
                },
                encounter: encounter.toJSON()
            };

        } catch (error) {
            console.error('Telehealth session initialization failed:', error);
            throw new Error(`Failed to initialize telehealth session: ${error.message}`);
        }
    }

    /**
     * Start a telehealth session
     * @param {string} sessionId - Session ID
     * @param {string} participantId - Participant (practitioner) ID
     * @param {string} token - OAuth2 token
     * @returns {Object} Session start result
     */
    async startSession(sessionId, participantId, token) {
        try {
            // Validate token
            const tokenValidation = await this.validateProviderToken(token);
            if (!tokenValidation.valid) {
                throw new Error('Invalid authentication token');
            }

            const session = this.activeSessions.get(sessionId);
            if (!session) {
                throw new Error('Session not found');
            }

            // Verify participant authorization
            if (session.config.practitionerId !== participantId) {
                throw new Error('Unauthorized to start this session');
            }

            // Start the encounter
            session.encounter.start();
            session.startTime = new Date().toISOString();
            session.config.status = 'active';

            // Add participant
            session.participants.set(participantId, {
                id: participantId,
                type: 'practitioner',
                joinedAt: new Date().toISOString(),
                status: 'connected'
            });

            // Log event
            session.events.push({
                type: 'session_started',
                timestamp: new Date().toISOString(),
                participantId,
                data: { sessionId }
            });

            return {
                success: true,
                sessionId,
                status: 'active',
                startTime: session.startTime,
                sessionUrl: session.encounter.getTelehealthSession()?.url,
                participants: Array.from(session.participants.values())
            };

        } catch (error) {
            console.error('Failed to start telehealth session:', error);
            throw error;
        }
    }

    /**
     * Join a telehealth session (for patients or additional participants)
     * @param {string} sessionId - Session ID
     * @param {Object} participant - Participant information
     * @returns {Object} Join result
     */
    async joinSession(sessionId, participant) {
        try {
            const session = this.activeSessions.get(sessionId);
            if (!session) {
                throw new Error('Session not found');
            }

            if (session.config.status !== 'active') {
                throw new Error('Session is not active');
            }

            // Validate participant
            const isAuthorized = await this.validateParticipant(session, participant);
            if (!isAuthorized) {
                throw new Error('Unauthorized to join this session');
            }

            // Add participant
            session.participants.set(participant.id, {
                id: participant.id,
                type: participant.type || 'patient',
                joinedAt: new Date().toISOString(),
                status: 'connected'
            });

            // Log event
            session.events.push({
                type: 'participant_joined',
                timestamp: new Date().toISOString(),
                participantId: participant.id,
                data: { participantType: participant.type }
            });

            return {
                success: true,
                sessionId,
                sessionUrl: session.encounter.getTelehealthSession()?.url,
                participants: Array.from(session.participants.values())
            };

        } catch (error) {
            console.error('Failed to join telehealth session:', error);
            throw error;
        }
    }

    /**
     * End a telehealth session
     * @param {string} sessionId - Session ID
     * @param {string} reason - End reason
     * @returns {Object} End result
     */
    async endSession(sessionId, reason = 'normal_end') {
        try {
            const session = this.activeSessions.get(sessionId);
            if (!session) {
                throw new Error('Session not found');
            }

            // End the encounter
            session.encounter.end();
            session.config.status = 'completed';

            // Calculate session duration
            const duration = session.startTime ? 
                Math.round((new Date() - new Date(session.startTime)) / 1000) : 0;

            // Log final event
            session.events.push({
                type: 'session_ended',
                timestamp: new Date().toISOString(),
                data: { reason, duration }
            });

            // Clear timer if exists
            if (this.sessionTimers.has(sessionId)) {
                clearTimeout(this.sessionTimers.get(sessionId));
                this.sessionTimers.delete(sessionId);
            }

            // Create session summary
            const summary = {
                sessionId,
                encounterId: session.encounter.id,
                duration,
                participants: Array.from(session.participants.values()),
                events: session.events,
                endReason: reason,
                encounter: session.encounter.toJSON()
            };

            // Clean up active session
            this.activeSessions.delete(sessionId);

            return {
                success: true,
                summary
            };

        } catch (error) {
            console.error('Failed to end telehealth session:', error);
            throw error;
        }
    }

    /**
     * Get session status
     * @param {string} sessionId - Session ID
     * @returns {Object} Session status
     */
    getSessionStatus(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            return { found: false };
        }

        return {
            found: true,
            sessionId,
            status: session.config.status,
            encounterId: session.encounter.id,
            participants: Array.from(session.participants.values()),
            startTime: session.startTime,
            telehealthSession: session.encounter.getTelehealthSession()
        };
    }

    /**
     * Validate provider OAuth2 token
     * @param {string} token - OAuth2 token
     * @returns {Object} Validation result
     */
    async validateProviderToken(token) {
        try {
            if (!token) {
                return { valid: false, error: 'Token required' };
            }

            // In a real implementation, validate with OAuth2 provider
            // For demo purposes, we'll use a simplified validation
            if (this.oauth2Client) {
                const cached = this.oauth2Client.getCachedToken(token);
                if (cached) {
                    return {
                        valid: true,
                        provider: {
                            id: cached.sub || 'unknown',
                            name: cached.name || 'Provider',
                            role: cached.role || 'practitioner'
                        }
                    };
                }
            }

            // Mock validation for development
            if (token.startsWith('mock_') || process.env.NODE_ENV === 'development') {
                return {
                    valid: true,
                    provider: {
                        id: 'mock-provider-123',
                        name: 'Dr. Test Provider',
                        role: 'practitioner'
                    }
                };
            }

            return { valid: false, error: 'Invalid token' };

        } catch (error) {
            console.error('Token validation error:', error);
            return { valid: false, error: error.message };
        }
    }

    /**
     * Validate participant authorization
     * @param {Object} session - Session data
     * @param {Object} participant - Participant data
     * @returns {boolean} Authorization result
     */
    async validateParticipant(session, participant) {
        // Check if participant is the patient in the encounter
        if (participant.type === 'patient' && session.config.patientId === participant.id) {
            return true;
        }

        // Check if participant is the practitioner
        if (participant.type === 'practitioner' && session.config.practitionerId === participant.id) {
            return true;
        }

        // Additional authorization logic can be added here
        return false;
    }

    /**
     * Generate session URL
     * @param {Object} sessionConfig - Session configuration
     * @returns {string} Session URL
     */
    generateSessionUrl(sessionConfig) {
        const baseUrl = process.env.TELEHEALTH_BASE_URL || 'https://telehealth.webqx.org';
        return `${baseUrl}/session/${sessionConfig.sessionId}?features=${encodeURIComponent(JSON.stringify(sessionConfig.features))}`;
    }

    /**
     * Get encounter (mock implementation)
     * @param {string} encounterId - Encounter ID
     * @returns {Object|null} Encounter data
     */
    async getEncounter(encounterId) {
        // In a real implementation, this would fetch from a database
        // For demo purposes, return null (will create new encounter)
        return null;
    }

    /**
     * Get active sessions for a provider
     * @param {string} providerId - Provider ID
     * @returns {Array} Active sessions
     */
    getProviderSessions(providerId) {
        const sessions = [];
        for (const [sessionId, session] of this.activeSessions.entries()) {
            if (session.config.practitionerId === providerId) {
                sessions.push({
                    sessionId,
                    status: session.config.status,
                    encounterId: session.encounter.id,
                    patientId: session.config.patientId,
                    startTime: session.startTime,
                    participants: Array.from(session.participants.values())
                });
            }
        }
        return sessions;
    }

    /**
     * Cleanup expired sessions
     */
    cleanupExpiredSessions() {
        const now = new Date();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        for (const [sessionId, session] of this.activeSessions.entries()) {
            const age = now - new Date(session.config.createdAt);
            if (age > maxAge) {
                this.endSession(sessionId, 'expired');
            }
        }
    }
}

module.exports = TelehealthService;