/**
 * @fileoverview Video Conferencing Routes for Telehealth
 * 
 * This module provides API routes for secure video conferencing functionality
 * including session management, participant controls, and WebRTC signaling.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, param, query, validationResult } = require('express-validator');
const SecureVideoService = require('../services/videoService');
const { telehealthAuth } = require('../middleware/authMiddleware');
const { telehealthTLSMiddleware } = require('../middleware/tlsMiddleware');
const hipaaConfig = require('../config/hipaa');

const router = express.Router();

// Apply TLS middleware to all video routes
router.use(telehealthTLSMiddleware());

// Rate limiting for video endpoints
const videoRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Limit each IP to 50 requests per windowMs
    message: {
        error: 'Too Many Requests',
        message: 'Video API rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false
});

router.use(videoRateLimit);

// Store active video services
const activeVideoServices = new Map();

/**
 * POST /telehealth/video/session/start
 * Start a new video session
 */
router.post('/session/start',
    telehealthAuth({ requireMFA: true, requireConsent: true }),
    [
        body('sessionType').isIn(['consultation', 'follow-up', 'emergency', 'group']),
        body('maxParticipants').optional().isInt({ min: 2, max: 10 }),
        body('recordingEnabled').optional().isBoolean(),
        body('transcriptionEnabled').optional().isBoolean(),
        body('quality').optional().isIn(['low', 'medium', 'high', 'hd']),
        body('language').optional().isLength({ min: 2, max: 5 })
    ],
    async (req, res) => {
        try {
            // Validate input
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: 'Invalid input parameters',
                    details: errors.array()
                });
            }

            const {
                sessionType = 'consultation',
                maxParticipants = 2,
                recordingEnabled = false,
                transcriptionEnabled = false,
                quality = 'medium',
                language = 'en'
            } = req.body;

            const sessionId = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Create video service instance
            const videoService = new SecureVideoService(sessionId, {
                maxParticipants,
                recordingEnabled,
                transcriptionEnabled,
                quality,
                language,
                sessionType
            });

            // Start the session
            const sessionInfo = await videoService.startSession(
                req.telehealthUser.id,
                req.telehealthUser.role
            );

            // Store active service
            activeVideoServices.set(sessionId, videoService);

            // Set up service event handlers
            setupVideoServiceEvents(videoService, sessionId);

            // Log session creation
            hipaaConfig.logAuditEvent('VIDEO_SESSION_CREATED', {
                sessionId,
                userId: req.telehealthUser.id,
                resourceType: 'VideoSession',
                resourceId: sessionId,
                action: 'CREATE_SESSION',
                details: {
                    sessionType,
                    recordingEnabled,
                    transcriptionEnabled,
                    quality,
                    userRole: req.telehealthUser.role
                }
            });

            res.status(201).json({
                success: true,
                message: 'Video session started successfully',
                data: {
                    sessionId,
                    sessionType,
                    startedAt: new Date().toISOString(),
                    createdBy: req.telehealthUser.id,
                    settings: {
                        recordingEnabled,
                        transcriptionEnabled,
                        quality,
                        language,
                        maxParticipants
                    },
                    ...sessionInfo
                }
            });

        } catch (error) {
            console.error('❌ Failed to start video session:', error);
            
            hipaaConfig.logAuditEvent('VIDEO_SESSION_START_FAILED', {
                sessionId: req.body.sessionId || 'unknown',
                userId: req.telehealthUser.id,
                resourceType: 'VideoSession',
                action: 'CREATE_SESSION',
                outcome: 'FAILURE',
                details: { error: error.message }
            });

            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to start video session',
                code: 'SESSION_START_FAILED'
            });
        }
    }
);

/**
 * POST /telehealth/video/session/:sessionId/join
 * Join an existing video session
 */
router.post('/session/:sessionId/join',
    telehealthAuth({ requireMFA: true, requireConsent: true }),
    [
        param('sessionId').isLength({ min: 10, max: 100 }),
        body('displayName').optional().isLength({ min: 1, max: 50 }),
        body('audioEnabled').optional().isBoolean(),
        body('videoEnabled').optional().isBoolean()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: 'Invalid input parameters',
                    details: errors.array()
                });
            }

            const { sessionId } = req.params;
            const {
                displayName = req.telehealthUser.name || `User_${req.telehealthUser.id}`,
                audioEnabled = true,
                videoEnabled = true
            } = req.body;

            // Get video service
            const videoService = activeVideoServices.get(sessionId);
            if (!videoService) {
                return res.status(404).json({
                    error: 'Session Not Found',
                    message: 'Video session not found or has ended',
                    code: 'SESSION_NOT_FOUND'
                });
            }

            // Join the session
            const sessionInfo = await videoService.joinSession(
                req.telehealthUser.id,
                req.telehealthUser.role
            );

            // Log session join
            hipaaConfig.logAuditEvent('VIDEO_SESSION_JOINED', {
                sessionId,
                userId: req.telehealthUser.id,
                resourceType: 'VideoSession',
                resourceId: sessionId,
                action: 'JOIN_SESSION',
                details: {
                    userRole: req.telehealthUser.role,
                    displayName,
                    audioEnabled,
                    videoEnabled
                }
            });

            res.json({
                success: true,
                message: 'Successfully joined video session',
                data: {
                    sessionId,
                    participantId: req.telehealthUser.id,
                    joinedAt: new Date().toISOString(),
                    displayName,
                    mediaSettings: {
                        audioEnabled,
                        videoEnabled
                    },
                    ...sessionInfo
                }
            });

        } catch (error) {
            console.error('❌ Failed to join video session:', error);
            
            hipaaConfig.logAuditEvent('VIDEO_SESSION_JOIN_FAILED', {
                sessionId: req.params.sessionId,
                userId: req.telehealthUser.id,
                resourceType: 'VideoSession',
                action: 'JOIN_SESSION',
                outcome: 'FAILURE',
                details: { error: error.message }
            });

            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to join video session',
                code: 'SESSION_JOIN_FAILED'
            });
        }
    }
);

/**
 * POST /telehealth/video/session/:sessionId/leave
 * Leave a video session
 */
router.post('/session/:sessionId/leave',
    telehealthAuth(),
    [
        param('sessionId').isLength({ min: 10, max: 100 })
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: 'Invalid session ID',
                    details: errors.array()
                });
            }

            const { sessionId } = req.params;

            // Get video service
            const videoService = activeVideoServices.get(sessionId);
            if (!videoService) {
                return res.status(404).json({
                    error: 'Session Not Found',
                    message: 'Video session not found',
                    code: 'SESSION_NOT_FOUND'
                });
            }

            // Leave the session
            await videoService.leaveSession(req.telehealthUser.id);

            // Log session leave
            hipaaConfig.logAuditEvent('VIDEO_SESSION_LEFT', {
                sessionId,
                userId: req.telehealthUser.id,
                resourceType: 'VideoSession',
                resourceId: sessionId,
                action: 'LEAVE_SESSION',
                details: {
                    userRole: req.telehealthUser.role
                }
            });

            res.json({
                success: true,
                message: 'Successfully left video session',
                data: {
                    sessionId,
                    participantId: req.telehealthUser.id,
                    leftAt: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('❌ Failed to leave video session:', error);
            
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to leave video session',
                code: 'SESSION_LEAVE_FAILED'
            });
        }
    }
);

/**
 * POST /telehealth/video/session/:sessionId/end
 * End a video session
 */
router.post('/session/:sessionId/end',
    telehealthAuth({ roles: ['provider', 'doctor', 'admin'] }),
    [
        param('sessionId').isLength({ min: 10, max: 100 })
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: 'Invalid session ID',
                    details: errors.array()
                });
            }

            const { sessionId } = req.params;

            // Get video service
            const videoService = activeVideoServices.get(sessionId);
            if (!videoService) {
                return res.status(404).json({
                    error: 'Session Not Found',
                    message: 'Video session not found',
                    code: 'SESSION_NOT_FOUND'
                });
            }

            // End the session
            await videoService.endSession();

            // Remove from active services
            activeVideoServices.delete(sessionId);

            // Log session end
            hipaaConfig.logAuditEvent('VIDEO_SESSION_ENDED', {
                sessionId,
                userId: req.telehealthUser.id,
                resourceType: 'VideoSession',
                resourceId: sessionId,
                action: 'END_SESSION',
                details: {
                    endedBy: req.telehealthUser.id,
                    userRole: req.telehealthUser.role
                }
            });

            res.json({
                success: true,
                message: 'Video session ended successfully',
                data: {
                    sessionId,
                    endedAt: new Date().toISOString(),
                    endedBy: req.telehealthUser.id
                }
            });

        } catch (error) {
            console.error('❌ Failed to end video session:', error);
            
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to end video session',
                code: 'SESSION_END_FAILED'
            });
        }
    }
);

/**
 * GET /telehealth/video/session/:sessionId/status
 * Get video session status
 */
router.get('/session/:sessionId/status',
    telehealthAuth(),
    [
        param('sessionId').isLength({ min: 10, max: 100 })
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: 'Invalid session ID',
                    details: errors.array()
                });
            }

            const { sessionId } = req.params;

            // Get video service
            const videoService = activeVideoServices.get(sessionId);
            if (!videoService) {
                return res.status(404).json({
                    error: 'Session Not Found',
                    message: 'Video session not found',
                    code: 'SESSION_NOT_FOUND'
                });
            }

            // Get session statistics
            const statistics = videoService.getSessionStatistics();

            res.json({
                success: true,
                message: 'Session status retrieved successfully',
                data: statistics
            });

        } catch (error) {
            console.error('❌ Failed to get session status:', error);
            
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to get session status',
                code: 'STATUS_RETRIEVAL_FAILED'
            });
        }
    }
);

/**
 * POST /telehealth/video/session/:sessionId/recording/start
 * Start recording a video session
 */
router.post('/session/:sessionId/recording/start',
    telehealthAuth({ roles: ['provider', 'doctor'] }),
    [
        param('sessionId').isLength({ min: 10, max: 100 }),
        body('encryptRecording').optional().isBoolean(),
        body('consentConfirmed').isBoolean()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: 'Invalid parameters',
                    details: errors.array()
                });
            }

            const { sessionId } = req.params;
            const { encryptRecording = true, consentConfirmed } = req.body;

            if (!consentConfirmed) {
                return res.status(400).json({
                    error: 'Consent Required',
                    message: 'Patient consent must be confirmed before recording',
                    code: 'CONSENT_NOT_CONFIRMED'
                });
            }

            // Get video service
            const videoService = activeVideoServices.get(sessionId);
            if (!videoService) {
                return res.status(404).json({
                    error: 'Session Not Found',
                    message: 'Video session not found',
                    code: 'SESSION_NOT_FOUND'
                });
            }

            // Start recording
            await videoService.startRecording(req.telehealthUser.id, null);

            // Log recording start
            hipaaConfig.logAuditEvent('VIDEO_RECORDING_STARTED', {
                sessionId,
                userId: req.telehealthUser.id,
                resourceType: 'VideoRecording',
                action: 'START_RECORDING',
                details: {
                    encryptRecording,
                    consentConfirmed,
                    startedBy: req.telehealthUser.id
                }
            });

            res.json({
                success: true,
                message: 'Recording started successfully',
                data: {
                    sessionId,
                    recordingStarted: true,
                    startedAt: new Date().toISOString(),
                    encrypted: encryptRecording
                }
            });

        } catch (error) {
            console.error('❌ Failed to start recording:', error);
            
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to start recording',
                code: 'RECORDING_START_FAILED'
            });
        }
    }
);

/**
 * POST /telehealth/video/session/:sessionId/recording/stop
 * Stop recording a video session
 */
router.post('/session/:sessionId/recording/stop',
    telehealthAuth({ roles: ['provider', 'doctor'] }),
    [
        param('sessionId').isLength({ min: 10, max: 100 })
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: 'Invalid session ID',
                    details: errors.array()
                });
            }

            const { sessionId } = req.params;

            // Get video service
            const videoService = activeVideoServices.get(sessionId);
            if (!videoService) {
                return res.status(404).json({
                    error: 'Session Not Found',
                    message: 'Video session not found',
                    code: 'SESSION_NOT_FOUND'
                });
            }

            // Stop recording
            await videoService.stopRecording(req.telehealthUser.id);

            // Log recording stop
            hipaaConfig.logAuditEvent('VIDEO_RECORDING_STOPPED', {
                sessionId,
                userId: req.telehealthUser.id,
                resourceType: 'VideoRecording',
                action: 'STOP_RECORDING',
                details: {
                    stoppedBy: req.telehealthUser.id
                }
            });

            res.json({
                success: true,
                message: 'Recording stopped successfully',
                data: {
                    sessionId,
                    recordingStopped: true,
                    stoppedAt: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('❌ Failed to stop recording:', error);
            
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to stop recording',
                code: 'RECORDING_STOP_FAILED'
            });
        }
    }
);

/**
 * GET /telehealth/video/sessions
 * List active video sessions (admin only)
 */
router.get('/sessions',
    telehealthAuth({ roles: ['admin'] }),
    [
        query('limit').optional().isInt({ min: 1, max: 100 }),
        query('offset').optional().isInt({ min: 0 }),
        query('status').optional().isIn(['active', 'ended', 'all'])
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: 'Invalid query parameters',
                    details: errors.array()
                });
            }

            const {
                limit = 20,
                offset = 0,
                status = 'active'
            } = req.query;

            // Get active sessions
            const sessions = [];
            for (const [sessionId, videoService] of activeVideoServices.entries()) {
                const statistics = videoService.getSessionStatistics();
                sessions.push({
                    sessionId,
                    ...statistics
                });
            }

            // Apply pagination
            const paginatedSessions = sessions.slice(offset, offset + limit);

            res.json({
                success: true,
                message: 'Sessions retrieved successfully',
                data: {
                    sessions: paginatedSessions,
                    pagination: {
                        total: sessions.length,
                        limit: parseInt(limit),
                        offset: parseInt(offset),
                        hasMore: offset + limit < sessions.length
                    }
                }
            });

        } catch (error) {
            console.error('❌ Failed to list sessions:', error);
            
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to list sessions',
                code: 'SESSIONS_LIST_FAILED'
            });
        }
    }
);

/**
 * Setup event handlers for video service
 */
function setupVideoServiceEvents(videoService, sessionId) {
    videoService.on('sessionEnded', () => {
        activeVideoServices.delete(sessionId);
        console.log(`🏁 Video session ${sessionId} ended and cleaned up`);
    });

    videoService.on('error', (error) => {
        console.error(`❌ Video service error for session ${sessionId}:`, error);
        
        hipaaConfig.logAuditEvent('VIDEO_SERVICE_ERROR', {
            sessionId,
            resourceType: 'VideoService',
            action: 'SERVICE_ERROR',
            outcome: 'FAILURE',
            details: {
                error: error.message,
                errorType: error.error?.name || 'unknown'
            }
        });
    });

    videoService.on('qualityUpdate', (data) => {
        console.log(`📊 Quality update for session ${sessionId}:`, data.stats);
    });

    videoService.on('participantJoined', (data) => {
        console.log(`👥 Participant joined session ${sessionId}:`, data.participantId);
    });

    videoService.on('participantLeft', (data) => {
        console.log(`👋 Participant left session ${sessionId}:`, data.participantId);
    });
}

module.exports = router;