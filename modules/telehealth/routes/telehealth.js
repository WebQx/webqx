/**
 * Telehealth API Routes
 * Handles telehealth session management endpoints
 */

const express = require('express');
const router = express.Router();

/**
 * Create telehealth routes with service dependency injection
 * @param {TelehealthService} telehealthService - Telehealth service instance
 * @param {Function} authenticateToken - Token authentication middleware
 * @returns {express.Router} Configured router
 */
function createTelehealthRoutes(telehealthService, authenticateToken) {
    
    /**
     * Initialize a new telehealth session
     * POST /api/telehealth/initialize
     */
    router.post('/initialize', authenticateToken, async (req, res) => {
        try {
            const {
                patientId,
                appointmentId,
                encounterData,
                sessionOptions
            } = req.body;

            // Get practitioner ID from authenticated token
            const practitionerId = req.user?.sub || req.user?.id;
            const providerToken = req.headers.authorization?.replace('Bearer ', '');

            if (!practitionerId) {
                return res.status(401).json({
                    success: false,
                    error: 'Practitioner identification required'
                });
            }

            if (!patientId) {
                return res.status(400).json({
                    success: false,
                    error: 'Patient ID is required'
                });
            }

            const result = await telehealthService.initializeSession({
                patientId,
                practitionerId,
                appointmentId,
                encounterData,
                providerToken,
                sessionOptions
            });

            res.json(result);

        } catch (error) {
            console.error('Telehealth initialization error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    /**
     * Start a telehealth session
     * POST /api/telehealth/sessions/:sessionId/start
     */
    router.post('/sessions/:sessionId/start', authenticateToken, async (req, res) => {
        try {
            const { sessionId } = req.params;
            const participantId = req.user?.sub || req.user?.id;
            const token = req.headers.authorization?.replace('Bearer ', '');

            const result = await telehealthService.startSession(sessionId, participantId, token);
            res.json(result);

        } catch (error) {
            console.error('Session start error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    /**
     * Join a telehealth session
     * POST /api/telehealth/sessions/:sessionId/join
     */
    router.post('/sessions/:sessionId/join', async (req, res) => {
        try {
            const { sessionId } = req.params;
            const { participantId, participantType, accessCode } = req.body;

            // Basic validation for patient access
            if (!participantId) {
                return res.status(400).json({
                    success: false,
                    error: 'Participant ID is required'
                });
            }

            const participant = {
                id: participantId,
                type: participantType || 'patient',
                accessCode
            };

            const result = await telehealthService.joinSession(sessionId, participant);
            res.json(result);

        } catch (error) {
            console.error('Session join error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    /**
     * End a telehealth session
     * POST /api/telehealth/sessions/:sessionId/end
     */
    router.post('/sessions/:sessionId/end', authenticateToken, async (req, res) => {
        try {
            const { sessionId } = req.params;
            const { reason } = req.body;

            const result = await telehealthService.endSession(sessionId, reason);
            res.json(result);

        } catch (error) {
            console.error('Session end error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    /**
     * Get session status
     * GET /api/telehealth/sessions/:sessionId/status
     */
    router.get('/sessions/:sessionId/status', async (req, res) => {
        try {
            const { sessionId } = req.params;
            const status = telehealthService.getSessionStatus(sessionId);
            
            if (!status.found) {
                return res.status(404).json({
                    success: false,
                    error: 'Session not found'
                });
            }

            res.json({
                success: true,
                ...status
            });

        } catch (error) {
            console.error('Session status error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    /**
     * Get provider's active sessions
     * GET /api/telehealth/provider/sessions
     */
    router.get('/provider/sessions', authenticateToken, async (req, res) => {
        try {
            const providerId = req.user?.sub || req.user?.id;
            const sessions = telehealthService.getProviderSessions(providerId);

            res.json({
                success: true,
                sessions
            });

        } catch (error) {
            console.error('Provider sessions error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    /**
     * Quick telehealth session creation for immediate consultations
     * POST /api/telehealth/quick-session
     */
    router.post('/quick-session', authenticateToken, async (req, res) => {
        try {
            const {
                patientId,
                reasonCode,
                appointmentId,
                sessionType = 'video-call'
            } = req.body;

            const practitionerId = req.user?.sub || req.user?.id;
            const providerToken = req.headers.authorization?.replace('Bearer ', '');

            if (!patientId) {
                return res.status(400).json({
                    success: false,
                    error: 'Patient ID is required'
                });
            }

            // Initialize session
            const initResult = await telehealthService.initializeSession({
                patientId,
                practitionerId,
                appointmentId,
                encounterData: { reasonCode },
                providerToken,
                sessionOptions: { sessionType }
            });

            if (!initResult.success) {
                return res.status(500).json(initResult);
            }

            // Immediately start the session
            const startResult = await telehealthService.startSession(
                initResult.sessionId, 
                practitionerId, 
                providerToken
            );

            res.json({
                success: true,
                sessionId: initResult.sessionId,
                encounterId: initResult.encounterId,
                sessionUrl: startResult.sessionUrl,
                status: startResult.status,
                encounter: initResult.encounter
            });

        } catch (error) {
            console.error('Quick session creation error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    /**
     * Get telehealth session by encounter ID
     * GET /api/telehealth/encounter/:encounterId/session
     */
    router.get('/encounter/:encounterId/session', authenticateToken, async (req, res) => {
        try {
            const { encounterId } = req.params;
            
            // Find session by encounter ID
            const sessions = telehealthService.activeSessions;
            let foundSession = null;
            
            for (const [sessionId, session] of sessions.entries()) {
                if (session.encounter.id === encounterId) {
                    foundSession = {
                        sessionId,
                        ...telehealthService.getSessionStatus(sessionId)
                    };
                    break;
                }
            }

            if (!foundSession) {
                return res.status(404).json({
                    success: false,
                    error: 'No active session found for this encounter'
                });
            }

            res.json({
                success: true,
                session: foundSession
            });

        } catch (error) {
            console.error('Encounter session lookup error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    return router;
}

module.exports = createTelehealthRoutes;