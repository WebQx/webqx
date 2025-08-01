const express = require('express');
const path = require('path');
const TelehealthSessionService = require('../services/sessionService');
const TelehealthNotificationService = require('../services/notificationService');
const Consent = require('../../../fhir/models/Consent');

const router = express.Router();

// Initialize services
const sessionService = new TelehealthSessionService();
const notificationService = new TelehealthNotificationService();

/**
 * Create a new telehealth session
 * POST /api/telehealth/sessions
 */
router.post('/sessions', async (req, res) => {
    try {
        const {
            patientId,
            providerId,
            appointmentId,
            scheduledFor,
            sessionType,
            specialty,
            notes,
            patientEmail,
            patientPhone,
            patientName,
            providerName,
            preferredNotification = 'email',
            sendNotification = true
        } = req.body;

        // Validate required fields
        if (!patientId || !providerId) {
            return res.status(400).json({
                error: 'Patient ID and Provider ID are required',
                code: 'MISSING_REQUIRED_FIELDS'
            });
        }

        // Create session
        const sessionResult = await sessionService.createSession({
            patientId,
            providerId,
            appointmentId,
            scheduledFor,
            sessionType,
            specialty,
            notes,
            patientEmail,
            patientPhone,
            preferredNotification
        });

        // Send notification if requested
        let notificationResult = null;
        if (sendNotification && (patientEmail || patientPhone)) {
            try {
                notificationResult = await notificationService.sendSessionInvitation(
                    {
                        sessionId: sessionResult.sessionId,
                        accessLink: sessionResult.accessLink,
                        scheduledFor: scheduledFor || new Date().toISOString(),
                        expiresAt: sessionResult.expiresAt,
                        sessionEndsAt: sessionResult.sessionEndsAt,
                        metadata: {
                            sessionType,
                            specialty
                        }
                    },
                    {
                        email: patientEmail,
                        phone: patientPhone,
                        patientName,
                        providerName,
                        preferredMethod: preferredNotification,
                        sendBackup: false
                    }
                );
            } catch (notifyError) {
                console.error('[Telehealth API] Notification failed:', notifyError);
                // Don't fail the session creation if notification fails
            }
        }

        console.log(`[Telehealth API] Session created: ${sessionResult.sessionId}`);

        res.status(201).json({
            success: true,
            data: {
                sessionId: sessionResult.sessionId,
                accessLink: sessionResult.accessLink,
                expiresAt: sessionResult.expiresAt,
                sessionEndsAt: sessionResult.sessionEndsAt,
                consentRequired: sessionResult.consentRequired,
                status: sessionResult.status,
                notificationSent: notificationResult?.success || false
            }
        });

    } catch (error) {
        console.error('[Telehealth API] Session creation failed:', error);
        res.status(500).json({
            error: 'Failed to create telehealth session',
            code: 'SESSION_CREATION_FAILED',
            details: error.message
        });
    }
});

/**
 * Validate session access
 * GET /api/telehealth/sessions/validate
 */
router.get('/sessions/validate', async (req, res) => {
    try {
        const { access: accessToken } = req.query;

        if (!accessToken) {
            return res.status(400).json({
                error: 'Access token is required',
                code: 'MISSING_ACCESS_TOKEN'
            });
        }

        const validation = await sessionService.validateSessionAccess(accessToken);

        if (validation.valid) {
            res.json({
                success: true,
                data: {
                    valid: true,
                    session: validation.session
                }
            });
        } else {
            res.status(401).json({
                success: false,
                error: validation.error,
                code: validation.code
            });
        }

    } catch (error) {
        console.error('[Telehealth API] Session validation failed:', error);
        res.status(500).json({
            error: 'Failed to validate session access',
            code: 'VALIDATION_FAILED',
            details: error.message
        });
    }
});

/**
 * Record patient consent
 * POST /api/telehealth/consent
 */
router.post('/consent', async (req, res) => {
    try {
        const {
            accessToken,
            consentGiven,
            timestamp,
            ipAddress,
            userAgent,
            method = 'electronic'
        } = req.body;

        if (!accessToken) {
            return res.status(400).json({
                error: 'Access token is required',
                code: 'MISSING_ACCESS_TOKEN'
            });
        }

        if (!consentGiven) {
            return res.status(400).json({
                error: 'Consent must be given to proceed',
                code: 'CONSENT_REQUIRED'
            });
        }

        // Validate session access first
        const validation = await sessionService.validateSessionAccess(accessToken);
        if (!validation.valid) {
            return res.status(401).json({
                success: false,
                error: validation.error,
                code: validation.code
            });
        }

        // Record consent
        const consentResult = await sessionService.recordConsent(validation.session.id, {
            method,
            ipAddress,
            userAgent,
            timestamp,
            patientName: `Patient ${validation.session.patientId}` // In real implementation, get from patient record
        });

        console.log(`[Telehealth API] Consent recorded for session: ${validation.session.id}`);

        res.json({
            success: true,
            data: {
                consentId: consentResult.consentId,
                status: consentResult.status,
                dateTime: consentResult.dateTime,
                sessionStatus: consentResult.sessionStatus
            }
        });

    } catch (error) {
        console.error('[Telehealth API] Consent recording failed:', error);
        res.status(500).json({
            error: 'Failed to record consent',
            code: 'CONSENT_RECORDING_FAILED',
            details: error.message
        });
    }
});

/**
 * Get session information
 * GET /api/telehealth/sessions/:sessionId
 */
router.get('/sessions/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = sessionService.getSession(sessionId);

        if (!session) {
            return res.status(404).json({
                error: 'Session not found',
                code: 'SESSION_NOT_FOUND'
            });
        }

        // TODO: Add authorization check to ensure user has access to this session

        res.json({
            success: true,
            data: session
        });

    } catch (error) {
        console.error('[Telehealth API] Get session failed:', error);
        res.status(500).json({
            error: 'Failed to retrieve session',
            code: 'SESSION_RETRIEVAL_FAILED',
            details: error.message
        });
    }
});

/**
 * Get consent record for a session
 * GET /api/telehealth/sessions/:sessionId/consent
 */
router.get('/sessions/:sessionId/consent', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const consentRecord = sessionService.getConsentRecord(sessionId);

        if (!consentRecord) {
            return res.status(404).json({
                error: 'Consent record not found',
                code: 'CONSENT_NOT_FOUND'
            });
        }

        // TODO: Add authorization check to ensure user has access to this consent record

        res.json({
            success: true,
            data: consentRecord
        });

    } catch (error) {
        console.error('[Telehealth API] Get consent failed:', error);
        res.status(500).json({
            error: 'Failed to retrieve consent record',
            code: 'CONSENT_RETRIEVAL_FAILED',
            details: error.message
        });
    }
});

/**
 * Start a telehealth session
 * POST /api/telehealth/sessions/:sessionId/start
 */
router.post('/sessions/:sessionId/start', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { userId } = req.body; // In real implementation, get from authentication middleware

        if (!userId) {
            return res.status(400).json({
                error: 'User ID is required',
                code: 'MISSING_USER_ID'
            });
        }

        const result = await sessionService.startSession(sessionId, userId);

        console.log(`[Telehealth API] Session started: ${sessionId} by ${userId}`);

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('[Telehealth API] Start session failed:', error);
        res.status(500).json({
            error: 'Failed to start session',
            code: 'SESSION_START_FAILED',
            details: error.message
        });
    }
});

/**
 * End a telehealth session
 * POST /api/telehealth/sessions/:sessionId/end
 */
router.post('/sessions/:sessionId/end', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { userId } = req.body; // In real implementation, get from authentication middleware

        if (!userId) {
            return res.status(400).json({
                error: 'User ID is required',
                code: 'MISSING_USER_ID'
            });
        }

        const result = await sessionService.endSession(sessionId, userId);

        console.log(`[Telehealth API] Session ended: ${sessionId} by ${userId}`);

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('[Telehealth API] End session failed:', error);
        res.status(500).json({
            error: 'Failed to end session',
            code: 'SESSION_END_FAILED',
            details: error.message
        });
    }
});

/**
 * Send session reminder
 * POST /api/telehealth/sessions/:sessionId/remind
 */
router.post('/sessions/:sessionId/remind', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = sessionService.getSession(sessionId);

        if (!session) {
            return res.status(404).json({
                error: 'Session not found',
                code: 'SESSION_NOT_FOUND'
            });
        }

        // Send reminder notification
        const notificationResult = await notificationService.sendSessionReminder(
            session,
            {
                email: session.metadata.patientEmail,
                phone: session.metadata.patientPhone
            }
        );

        res.json({
            success: true,
            data: {
                reminderSent: notificationResult.success,
                results: notificationResult.results
            }
        });

    } catch (error) {
        console.error('[Telehealth API] Send reminder failed:', error);
        res.status(500).json({
            error: 'Failed to send reminder',
            code: 'REMINDER_SEND_FAILED',
            details: error.message
        });
    }
});

/**
 * Get service statistics
 * GET /api/telehealth/stats
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = sessionService.getStats();

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('[Telehealth API] Get stats failed:', error);
        res.status(500).json({
            error: 'Failed to retrieve statistics',
            code: 'STATS_RETRIEVAL_FAILED',
            details: error.message
        });
    }
});

module.exports = router;