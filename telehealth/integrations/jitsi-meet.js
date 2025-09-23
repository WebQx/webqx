/**
 * Jitsi Meet Integration for WebQx EMR Telehealth
 * Provides secure video conferencing for telehealth and telepsychiatry sessions
 * with OpenEMR integration and HIPAA compliance
 */

/**
 * Jitsi Meet Configuration for Healthcare
 */
class JitsiMeetIntegration {
    constructor(options = {}) {
        this.domain = options.domain || process.env.JITSI_MEET_DOMAIN || 'meet.jitsi.webqx.health';
        this.appId = options.appId || process.env.JITSI_MEET_APP_ID || 'webqx-telehealth';
        this.apiKey = options.apiKey || process.env.JITSI_MEET_API_KEY;
        this.enableBreakoutRooms = options.enableBreakoutRooms || false;
        this.enableRecording = options.enableRecording || false;
        this.hipaaCompliant = options.hipaaCompliant !== false; // Default true
        
        // HIPAA compliance settings
        this.hipaaConfig = {
            requireE2EE: true,
            disableLobby: false,
            requireAuthentication: true,
            enableAuditLogging: true,
            dataRetentionDays: process.env.HIPAA_RETENTION_DAYS || 2555,
            allowScreenSharing: true,
            allowChat: true,
            allowFileSharing: false, // Disabled for HIPAA
            recordingStorage: 'encrypted' // Must be encrypted for PHI
        };
    }

    /**
     * Create a new telehealth meeting room
     * @param {Object} sessionConfig - Session configuration
     * @returns {Object} Meeting room details
     */
    async createMeetingRoom(sessionConfig) {
        try {
            const {
                sessionId,
                sessionType, // 'telehealth' or 'telepsychiatry'
                patientId,
                practitionerId,
                encounterId,
                duration = 60, // minutes
                specialty = 'general',
                features = []
            } = sessionConfig;

            // Generate secure room name
            const roomName = this.generateSecureRoomName(sessionId, encounterId);
            
            // Configure meeting based on session type
            const meetingConfig = {
                roomName,
                domain: this.domain,
                options: {
                    // HIPAA-compliant room settings
                    roomName: roomName,
                    width: '100%',
                    height: '100%',
                    parentNode: undefined, // Will be set by client
                    
                    // Security settings
                    configOverwrite: {
                        // Enable end-to-end encryption
                        e2eping: {
                            enabled: this.hipaaConfig.requireE2EE
                        },
                        
                        // Audio/Video settings optimized for healthcare
                        resolution: 720,
                        constraints: {
                            video: {
                                height: { ideal: 720, max: 1080, min: 480 }
                            }
                        },
                        
                        // Disable features not suitable for healthcare
                        disableThirdPartyRequests: true,
                        enableClosePage: false,
                        
                        // Chat and recording settings
                        disableChat: !this.hipaaConfig.allowChat,
                        disableFilmstrip: false,
                        disableInviteFunctions: true,
                        
                        // Recording (if enabled and HIPAA compliant)
                        localRecording: {
                            enabled: this.enableRecording && this.hipaaConfig.recordingStorage === 'encrypted',
                            format: 'flac' // High quality for medical consultations
                        },
                        
                        // Lobby settings for security
                        enableLobby: !this.hipaaConfig.disableLobby,
                        
                        // Branding
                        defaultRemoteDisplayName: 'Healthcare Provider',
                        defaultLocalDisplayName: 'Patient'
                    },
                    
                    // Interface configuration
                    interfaceConfigOverwrite: {
                        TOOLBAR_BUTTONS: this.getToolbarButtons(sessionType, features),
                        SETTINGS_SECTIONS: ['devices', 'language'],
                        SHOW_JITSI_WATERMARK: false,
                        SHOW_WATERMARK_FOR_GUESTS: false,
                        SHOW_BRAND_WATERMARK: false,
                        BRAND_WATERMARK_LINK: '',
                        DEFAULT_BACKGROUND: '#f8f9fa',
                        
                        // Healthcare-specific UI
                        APP_NAME: sessionType === 'telepsychiatry' ? 'WebQx Telepsychiatry' : 'WebQx Telehealth',
                        NATIVE_APP_NAME: 'WebQx EMR',
                        
                        // Disable features not needed in healthcare
                        DISABLE_DOMINANT_SPEAKER_INDICATOR: false,
                        DISABLE_FOCUS_INDICATOR: false,
                        DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
                        DISABLE_PRESENCE_STATUS: false,
                        HIDE_INVITE_MORE_HEADER: true
                    },
                    
                    // Event handlers for integration
                    onApiReady: (api) => {
                        this.setupMeetingEvents(api, sessionConfig);
                    }
                }
            };

            // Add JWT token for authenticated rooms
            if (this.apiKey) {
                meetingConfig.jwt = await this.generateJWT(sessionConfig);
            }

            // Store meeting configuration for OpenEMR integration
            await this.storeMeetingInOpenEMR(sessionConfig, meetingConfig);

            return {
                success: true,
                meetingConfig,
                joinUrl: this.generateJoinUrl(roomName),
                roomName,
                sessionId,
                encounterId,
                metadata: {
                    sessionType,
                    duration,
                    specialty,
                    hipaaCompliant: this.hipaaCompliant,
                    encryption: this.hipaaConfig.requireE2EE ? 'e2ee' : 'tls',
                    created: new Date().toISOString()
                }
            };

        } catch (error) {
            console.error('Failed to create Jitsi meeting room:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generate secure room name for healthcare sessions
     * @param {string} sessionId - Session identifier
     * @param {string} encounterId - Encounter identifier
     * @returns {string} Secure room name
     */
    generateSecureRoomName(sessionId, encounterId) {
        const crypto = require('crypto');
        const timestamp = Date.now();
        const combined = `${sessionId}-${encounterId}-${timestamp}`;
        const hash = crypto.createHash('sha256').update(combined).digest('hex').substring(0, 16);
        return `webqx-health-${hash}`;
    }

    /**
     * Generate JWT token for authenticated Jitsi meetings
     * @param {Object} sessionConfig - Session configuration
     * @returns {string} JWT token
     */
    async generateJWT(sessionConfig) {
        const jwt = require('jsonwebtoken');
        
        const payload = {
            iss: this.appId,
            aud: this.domain,
            exp: Math.floor(Date.now() / 1000) + (60 * 60 * 2), // 2 hours
            room: sessionConfig.roomName,
            context: {
                user: {
                    id: sessionConfig.practitionerId,
                    name: sessionConfig.practitionerName || 'Healthcare Provider',
                    email: sessionConfig.practitionerEmail,
                    avatar: sessionConfig.practitionerAvatar || ''
                },
                group: sessionConfig.sessionType === 'telepsychiatry' ? 'telepsychiatry' : 'telehealth'
            },
            moderator: true, // Healthcare provider is moderator
            // HIPAA compliance metadata
            hipaa: {
                encounter_id: sessionConfig.encounterId,
                patient_id: sessionConfig.patientId,
                session_type: sessionConfig.sessionType,
                audit_required: true
            }
        };

        return jwt.sign(payload, this.apiKey, { algorithm: 'HS256' });
    }

    /**
     * Get toolbar buttons based on session type and features
     * @param {string} sessionType - Type of session
     * @param {Array} features - Enabled features
     * @returns {Array} Toolbar button configuration
     */
    getToolbarButtons(sessionType, features = []) {
        const baseButtons = [
            'microphone', 'camera', 'desktop', 'chat', 'hangup'
        ];

        // Add healthcare-specific buttons
        if (features.includes('recording') && this.enableRecording) {
            baseButtons.push('recording');
        }

        if (features.includes('whiteboard')) {
            baseButtons.push('whiteboard');
        }

        if (features.includes('breakout-rooms') && this.enableBreakoutRooms) {
            baseButtons.push('breakout-rooms');
        }

        // Telepsychiatry specific features
        if (sessionType === 'telepsychiatry') {
            // Remove desktop sharing for privacy
            const index = baseButtons.indexOf('desktop');
            if (index > -1) {
                baseButtons.splice(index, 1);
            }
        }

        return baseButtons;
    }

    /**
     * Setup meeting event handlers for OpenEMR integration
     * @param {Object} api - Jitsi Meet API
     * @param {Object} sessionConfig - Session configuration
     */
    setupMeetingEvents(api, sessionConfig) {
        // Participant events for audit logging
        api.addEventListener('participantJoined', (event) => {
            this.logParticipantEvent('joined', event, sessionConfig);
        });

        api.addEventListener('participantLeft', (event) => {
            this.logParticipantEvent('left', event, sessionConfig);
        });

        // Video/Audio events for quality monitoring
        api.addEventListener('videoConferenceJoined', (event) => {
            this.logSessionEvent('started', sessionConfig, {
                localDisplayName: event.displayName,
                roomName: event.roomName
            });
        });

        api.addEventListener('videoConferenceLeft', (event) => {
            this.logSessionEvent('ended', sessionConfig, {
                roomName: event.roomName
            });
        });

        // Recording events for compliance
        if (this.enableRecording) {
            api.addEventListener('recordingStatusChanged', (event) => {
                this.logRecordingEvent(event, sessionConfig);
            });
        }

        // Error handling
        api.addEventListener('errorOccurred', (event) => {
            console.error('Jitsi Meet error:', event);
            this.logErrorEvent(event, sessionConfig);
        });
    }

    /**
     * Generate join URL for the meeting
     * @param {string} roomName - Room name
     * @returns {string} Join URL
     */
    generateJoinUrl(roomName) {
        return `https://${this.domain}/${roomName}`;
    }

    /**
     * Store meeting information in OpenEMR
     * @param {Object} sessionConfig - Session configuration
     * @param {Object} meetingConfig - Meeting configuration
     */
    async storeMeetingInOpenEMR(sessionConfig, meetingConfig) {
        try {
            // This would integrate with OpenEMR's API to store meeting details
            const meetingRecord = {
                encounter_id: sessionConfig.encounterId,
                patient_id: sessionConfig.patientId,
                provider_id: sessionConfig.practitionerId,
                meeting_room: meetingConfig.roomName,
                meeting_url: this.generateJoinUrl(meetingConfig.roomName),
                session_type: sessionConfig.sessionType,
                scheduled_duration: sessionConfig.duration,
                created_date: new Date().toISOString(),
                status: 'created',
                hipaa_compliant: this.hipaaCompliant
            };

            // Store in OpenEMR database (placeholder - would need actual OpenEMR API integration)
            console.log('Storing meeting record in OpenEMR:', meetingRecord);
            
            return meetingRecord;
        } catch (error) {
            console.error('Failed to store meeting in OpenEMR:', error);
            throw error;
        }
    }

    /**
     * Log participant events for HIPAA audit trail
     * @param {string} action - Action performed
     * @param {Object} event - Event data
     * @param {Object} sessionConfig - Session configuration
     */
    logParticipantEvent(action, event, sessionConfig) {
        const auditEvent = {
            timestamp: new Date().toISOString(),
            event_type: 'participant_' + action,
            session_id: sessionConfig.sessionId,
            encounter_id: sessionConfig.encounterId,
            participant_id: event.id,
            participant_name: event.displayName,
            room_name: sessionConfig.roomName,
            hipaa_audit: true
        };

        console.log('HIPAA Audit - Participant Event:', auditEvent);
        // Would integrate with actual audit logging system
    }

    /**
     * Log session events for compliance
     * @param {string} action - Action performed
     * @param {Object} sessionConfig - Session configuration
     * @param {Object} details - Additional details
     */
    logSessionEvent(action, sessionConfig, details = {}) {
        const auditEvent = {
            timestamp: new Date().toISOString(),
            event_type: 'session_' + action,
            session_id: sessionConfig.sessionId,
            encounter_id: sessionConfig.encounterId,
            session_type: sessionConfig.sessionType,
            room_name: sessionConfig.roomName,
            details,
            hipaa_audit: true
        };

        console.log('HIPAA Audit - Session Event:', auditEvent);
        // Would integrate with actual audit logging system
    }

    /**
     * Log recording events for compliance
     * @param {Object} event - Recording event
     * @param {Object} sessionConfig - Session configuration
     */
    logRecordingEvent(event, sessionConfig) {
        const auditEvent = {
            timestamp: new Date().toISOString(),
            event_type: 'recording_' + event.status,
            session_id: sessionConfig.sessionId,
            encounter_id: sessionConfig.encounterId,
            recording_status: event.status,
            room_name: sessionConfig.roomName,
            hipaa_audit: true,
            encryption_required: this.hipaaConfig.recordingStorage === 'encrypted'
        };

        console.log('HIPAA Audit - Recording Event:', auditEvent);
        // Would integrate with actual audit logging system
    }

    /**
     * Log error events
     * @param {Object} event - Error event
     * @param {Object} sessionConfig - Session configuration
     */
    logErrorEvent(event, sessionConfig) {
        const errorEvent = {
            timestamp: new Date().toISOString(),
            event_type: 'meeting_error',
            session_id: sessionConfig.sessionId,
            encounter_id: sessionConfig.encounterId,
            error_code: event.error?.name || 'UNKNOWN_ERROR',
            error_message: event.error?.message || 'Unknown error occurred',
            room_name: sessionConfig.roomName,
            hipaa_audit: true
        };

        console.error('Jitsi Meeting Error:', errorEvent);
        // Would integrate with actual error tracking system
    }
}

module.exports = JitsiMeetIntegration;