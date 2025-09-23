/**
 * WebQx EMR Telehealth Integration Configuration
 * Integrates Jitsi Meet with OpenEMR for secure telehealth sessions
 */

const JitsiMeetIntegration = require('./integrations/jitsi-meet');

/**
 * Telehealth Integration Manager
 * Handles complete telehealth workflow integration with OpenEMR
 */
class TelehealthIntegrationManager {
    constructor(options = {}) {
        this.openEMRConfig = {
            baseUrl: process.env.OPENEMR_BASE_URL || 'http://localhost/openemr',
            apiUrl: process.env.OPENEMR_API_URL || 'http://localhost/openemr/apis/default',
            clientId: process.env.OPENEMR_CLIENT_ID,
            clientSecret: process.env.OPENEMR_CLIENT_SECRET,
            scope: 'openid api:default api:encounter api:patient api:write'
        };

        this.jitsiIntegration = new JitsiMeetIntegration({
            domain: process.env.JITSI_MEET_DOMAIN || 'meet.jitsi.webqx.health',
            appId: process.env.JITSI_MEET_APP_ID || 'webqx-telehealth',
            apiKey: process.env.JITSI_MEET_API_KEY,
            hipaaCompliant: true,
            enableRecording: process.env.ENABLE_TELEHEALTH_RECORDING === 'true',
            enableBreakoutRooms: false
        });

        this.webhookEndpoint = process.env.TELEHEALTH_WEBHOOK_URL || 'https://emr.webqx.health/webhooks/telehealth';
    }

    /**
     * Start a complete telehealth session integrated with OpenEMR
     * @param {Object} encounterData - OpenEMR encounter data
     * @param {Object} providerData - Provider information
     * @param {Object} patientData - Patient information
     * @returns {Object} Complete session configuration
     */
    async startTelehealthSession(encounterData, providerData, patientData) {
        try {
            // 1. Validate encounter in OpenEMR
            const encounter = await this.validateOpenEMREncounter(encounterData.encounterId);
            if (!encounter.valid) {
                throw new Error('Invalid encounter: ' + encounter.error);
            }

            // 2. Determine session type based on encounter
            const sessionType = this.determineSessionType(encounter.data);

            // 3. Create Jitsi Meet room configuration
            const sessionConfig = {
                sessionId: this.generateSessionId(),
                sessionType,
                encounterId: encounterData.encounterId,
                patientId: encounter.data.patient_id,
                practitionerId: providerData.providerId,
                practitionerName: providerData.name,
                practitionerEmail: providerData.email,
                patientName: patientData.name,
                duration: encounterData.scheduledDuration || 30,
                specialty: encounter.data.specialty || 'general',
                features: this.getSessionFeatures(sessionType, encounter.data),
                returnUrl: `${this.openEMRConfig.baseUrl}/interface/forms/encounter/index.php?encounter=${encounterData.encounterId}`
            };

            // 4. Create Jitsi Meet room
            const meetingResult = await this.jitsiIntegration.createMeetingRoom(sessionConfig);
            if (!meetingResult.success) {
                throw new Error('Failed to create meeting room: ' + meetingResult.error);
            }

            // 5. Update OpenEMR encounter with telehealth session info
            await this.updateOpenEMREncounter(encounterData.encounterId, {
                telehealth_session_id: sessionConfig.sessionId,
                telehealth_room_name: meetingResult.roomName,
                telehealth_join_url: meetingResult.joinUrl,
                telehealth_type: sessionType,
                telehealth_status: 'scheduled',
                telehealth_provider: providerData.providerId,
                scheduled_start: new Date().toISOString()
            });

            // 6. Create session record for audit trail
            await this.createSessionAuditRecord(sessionConfig, meetingResult);

            // 7. Send notifications if configured
            await this.sendSessionNotifications(sessionConfig, patientData, providerData);

            return {
                success: true,
                sessionConfig: {
                    ...sessionConfig,
                    domain: this.jitsiIntegration.domain,
                    roomName: meetingResult.roomName,
                    joinUrl: meetingResult.joinUrl,
                    jwt: meetingResult.jwt,
                    emrApiEndpoint: this.openEMRConfig.apiUrl,
                    emrToken: await this.getOpenEMRToken()
                },
                meetingConfig: meetingResult.meetingConfig,
                encounter: encounter.data
            };

        } catch (error) {
            console.error('Failed to start telehealth session:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * End telehealth session and update OpenEMR
     * @param {string} sessionId - Session identifier
     * @param {Object} sessionSummary - Session summary data
     */
    async endTelehealthSession(sessionId, sessionSummary) {
        try {
            // 1. Find session record
            const session = await this.getSessionRecord(sessionId);
            if (!session) {
                throw new Error('Session not found');
            }

            // 2. Update OpenEMR encounter with completion data
            await this.updateOpenEMREncounter(session.encounterId, {
                telehealth_status: 'completed',
                telehealth_end_time: new Date().toISOString(),
                telehealth_duration: sessionSummary.duration,
                telehealth_participants: JSON.stringify(sessionSummary.participants),
                telehealth_summary: sessionSummary.notes || ''
            });

            // 3. Create encounter notes if provided
            if (sessionSummary.notes) {
                await this.createEncounterNote(session.encounterId, {
                    note_type: 'telehealth_session_notes',
                    content: sessionSummary.notes,
                    author: sessionSummary.authorId || session.practitionerId,
                    date: new Date().toISOString()
                });
            }

            // 4. Update session audit record
            await this.updateSessionAuditRecord(sessionId, {
                status: 'completed',
                end_time: new Date().toISOString(),
                duration: sessionSummary.duration,
                completion_notes: sessionSummary.notes
            });

            // 5. Handle recording if exists
            if (sessionSummary.recordingUrl) {
                await this.handleSessionRecording(sessionId, sessionSummary.recordingUrl);
            }

            return {
                success: true,
                message: 'Telehealth session completed and recorded in EMR'
            };

        } catch (error) {
            console.error('Failed to end telehealth session:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Validate OpenEMR encounter
     * @param {string} encounterId - Encounter ID
     * @returns {Object} Validation result
     */
    async validateOpenEMREncounter(encounterId) {
        try {
            // This would make an actual API call to OpenEMR
            const response = await fetch(`${this.openEMRConfig.apiUrl}/encounter/${encounterId}`, {
                headers: {
                    'Authorization': `Bearer ${await this.getOpenEMRToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                return {
                    valid: false,
                    error: `OpenEMR API error: ${response.status}`
                };
            }

            const encounterData = await response.json();
            return {
                valid: true,
                data: encounterData
            };

        } catch (error) {
            console.error('OpenEMR encounter validation failed:', error);
            return {
                valid: false,
                error: error.message
            };
        }
    }

    /**
     * Determine session type based on encounter data
     * @param {Object} encounterData - Encounter data from OpenEMR
     * @returns {string} Session type
     */
    determineSessionType(encounterData) {
        const specialty = encounterData.specialty?.toLowerCase() || '';
        const reason = encounterData.reason?.toLowerCase() || '';

        // Check for telepsychiatry indicators
        if (specialty.includes('psychiatry') || 
            specialty.includes('psychology') ||
            specialty.includes('mental health') ||
            reason.includes('mental') ||
            reason.includes('therapy') ||
            reason.includes('counseling')) {
            return 'telepsychiatry';
        }

        return 'telehealth';
    }

    /**
     * Get session features based on type and encounter
     * @param {string} sessionType - Type of session
     * @param {Object} encounterData - Encounter data
     * @returns {Array} Features array
     */
    getSessionFeatures(sessionType, encounterData) {
        const features = ['chat'];

        // Add recording if enabled
        if (this.jitsiIntegration.enableRecording) {
            features.push('recording');
        }

        // Screen sharing (not for telepsychiatry for privacy)
        if (sessionType !== 'telepsychiatry') {
            features.push('screenshare');
        }

        // Whiteboard for educational sessions
        if (encounterData.reason?.toLowerCase().includes('education') ||
            encounterData.reason?.toLowerCase().includes('consultation')) {
            features.push('whiteboard');
        }

        return features;
    }

    /**
     * Generate unique session ID
     * @returns {string} Session ID
     */
    generateSessionId() {
        const crypto = require('crypto');
        const timestamp = Date.now();
        const random = crypto.randomBytes(8).toString('hex');
        return `webqx-session-${timestamp}-${random}`;
    }

    /**
     * Update OpenEMR encounter with telehealth data
     * @param {string} encounterId - Encounter ID
     * @param {Object} data - Update data
     */
    async updateOpenEMREncounter(encounterId, data) {
        try {
            const response = await fetch(`${this.openEMRConfig.apiUrl}/encounter/${encounterId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${await this.getOpenEMRToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`OpenEMR update failed: ${response.status}`);
            }

            return await response.json();

        } catch (error) {
            console.error('Failed to update OpenEMR encounter:', error);
            throw error;
        }
    }

    /**
     * Create encounter note in OpenEMR
     * @param {string} encounterId - Encounter ID
     * @param {Object} noteData - Note data
     */
    async createEncounterNote(encounterId, noteData) {
        try {
            const response = await fetch(`${this.openEMRConfig.apiUrl}/encounter/${encounterId}/notes`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${await this.getOpenEMRToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(noteData)
            });

            if (!response.ok) {
                throw new Error(`OpenEMR note creation failed: ${response.status}`);
            }

            return await response.json();

        } catch (error) {
            console.error('Failed to create encounter note:', error);
            throw error;
        }
    }

    /**
     * Get OpenEMR API token
     * @returns {string} Access token
     */
    async getOpenEMRToken() {
        // Implementation would cache tokens and handle refresh
        // This is a simplified version
        try {
            const response = await fetch(`${this.openEMRConfig.apiUrl}/auth/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    grant_type: 'client_credentials',
                    client_id: this.openEMRConfig.clientId,
                    client_secret: this.openEMRConfig.clientSecret,
                    scope: this.openEMRConfig.scope
                })
            });

            const tokenData = await response.json();
            return tokenData.access_token;

        } catch (error) {
            console.error('Failed to get OpenEMR token:', error);
            throw error;
        }
    }

    /**
     * Create session audit record for HIPAA compliance
     * @param {Object} sessionConfig - Session configuration
     * @param {Object} meetingResult - Meeting creation result
     */
    async createSessionAuditRecord(sessionConfig, meetingResult) {
        const auditRecord = {
            session_id: sessionConfig.sessionId,
            encounter_id: sessionConfig.encounterId,
            patient_id: sessionConfig.patientId,
            provider_id: sessionConfig.practitionerId,
            session_type: sessionConfig.sessionType,
            room_name: meetingResult.roomName,
            created_at: new Date().toISOString(),
            status: 'scheduled',
            hipaa_compliant: true,
            encryption_enabled: true
        };

        console.log('Creating session audit record:', auditRecord);
        // Would store in audit database
        return auditRecord;
    }

    /**
     * Update session audit record
     * @param {string} sessionId - Session ID
     * @param {Object} updateData - Update data
     */
    async updateSessionAuditRecord(sessionId, updateData) {
        console.log('Updating session audit record:', { sessionId, updateData });
        // Would update audit database
    }

    /**
     * Get session record
     * @param {string} sessionId - Session ID
     * @returns {Object} Session data
     */
    async getSessionRecord(sessionId) {
        // Would retrieve from database
        console.log('Getting session record:', sessionId);
        return null; // Placeholder
    }

    /**
     * Handle session recording
     * @param {string} sessionId - Session ID
     * @param {string} recordingUrl - Recording URL
     */
    async handleSessionRecording(sessionId, recordingUrl) {
        console.log('Handling session recording:', { sessionId, recordingUrl });
        // Would handle secure storage of recording with encryption
    }

    /**
     * Send session notifications
     * @param {Object} sessionConfig - Session configuration
     * @param {Object} patientData - Patient data
     * @param {Object} providerData - Provider data
     */
    async sendSessionNotifications(sessionConfig, patientData, providerData) {
        console.log('Sending session notifications:', {
            sessionId: sessionConfig.sessionId,
            patient: patientData.name,
            provider: providerData.name
        });
        // Would send email/SMS notifications
    }
}

module.exports = TelehealthIntegrationManager;