/**
 * Session Management API Routes for Telepsychiatry Platform
 * 
 * Handles video consultation sessions with Jitsi integration,
 * transcription services with Whisper, and encrypted transcript storage
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const crypto = require('crypto');

const router = express.Router();

// In-memory storage for demo purposes (use database in production)
const activeSessions = new Map();
const transcriptStorage = new Map();
const sessionHistory = [];

// Middleware to validate session/auth
const requireAuth = (req, res, next) => {
  const sessionId = req.cookies?.sessionId || req.headers['x-session-id'] || req.headers.authorization?.replace('Bearer ', '');
  
  if (!sessionId) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication required'
    });
  }
  
  // Mock user for demo - in real implementation, validate with userService
  req.user = { id: 'user-123', role: 'PROVIDER', name: 'Dr. Smith' };
  next();
};

// Generate secure room name for Jitsi
const generateSecureRoomName = () => {
  const timestamp = Date.now();
  const randomBytes = crypto.randomBytes(8).toString('hex');
  return `telepsych_${timestamp}_${randomBytes}`;
};

// Encrypt transcript data
const encryptTranscript = (transcript) => {
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from(process.env.TRANSCRIPT_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'), 'hex');
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipher(algorithm, key);
  let encrypted = cipher.update(JSON.stringify(transcript), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    algorithm
  };
};

/**
 * POST /session/start
 * Initiates a new Jitsi video session for telepsychiatry consultation
 */
router.post('/start',
  requireAuth,
  [
    body('patientId')
      .notEmpty()
      .withMessage('Patient ID is required'),
    body('sessionType')
      .isIn(['consultation', 'followup', 'emergency', 'group_therapy'])
      .withMessage('Valid session type is required'),
    body('duration')
      .optional()
      .isInt({ min: 15, max: 180 })
      .withMessage('Duration must be between 15 and 180 minutes'),
    body('recordingEnabled')
      .optional()
      .isBoolean()
      .withMessage('Recording enabled must be a boolean'),
    body('transcriptionEnabled')
      .optional()
      .isBoolean()
      .withMessage('Transcription enabled must be a boolean')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: errors.array()
        });
      }

      const {
        patientId,
        sessionType,
        duration = 60,
        recordingEnabled = false,
        transcriptionEnabled = true
      } = req.body;

      const sessionId = `session_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      const roomName = generateSecureRoomName();
      const startTime = new Date().toISOString();

      // Create Jitsi meeting configuration
      const jitsiConfig = {
        domain: process.env.JITSI_DOMAIN || 'meet.jit.si',
        roomName: roomName,
        displayName: req.user.name,
        email: req.user.email,
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        enableRecording: recordingEnabled,
        enableTranscription: transcriptionEnabled,
        moderatorPassword: crypto.randomBytes(12).toString('hex'),
        // Security settings for healthcare
        requireDisplayName: true,
        enableLobby: true,
        enablePassword: true,
        roomPassword: crypto.randomBytes(8).toString('hex')
      };

      const session = {
        id: sessionId,
        patientId,
        providerId: req.user.id,
        sessionType,
        duration,
        startTime,
        status: 'active',
        jitsiConfig,
        participants: [
          {
            id: req.user.id,
            name: req.user.name,
            role: 'moderator',
            joinedAt: startTime
          }
        ],
        recordingEnabled,
        transcriptionEnabled,
        createdAt: startTime
      };

      activeSessions.set(sessionId, session);

      // Generate secure meeting URL
      const meetingUrl = `https://${jitsiConfig.domain}/${roomName}?` + 
        `displayName=${encodeURIComponent(jitsiConfig.displayName)}&` +
        `password=${jitsiConfig.roomPassword}&` +
        `config.startWithAudioMuted=${jitsiConfig.startWithAudioMuted}&` +
        `config.startWithVideoMuted=${jitsiConfig.startWithVideoMuted}&` +
        `config.requireDisplayName=${jitsiConfig.requireDisplayName}&` +
        `config.enableLobby=${jitsiConfig.enableLobby}`;

      res.status(201).json({
        sessionId,
        roomName,
        meetingUrl,
        duration,
        startTime,
        status: 'active',
        features: {
          recordingEnabled,
          transcriptionEnabled,
          lobbyEnabled: true,
          passwordProtected: true
        },
        moderator: {
          password: jitsiConfig.moderatorPassword
        },
        // Patient join information (to be sent separately via secure channel)
        patientJoinInfo: {
          patientUrl: meetingUrl,
          roomPassword: jitsiConfig.roomPassword,
          expiresAt: new Date(Date.now() + duration * 60 * 1000).toISOString()
        }
      });

    } catch (error) {
      console.error('[Session API] Start session error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to start video session'
      });
    }
  }
);

/**
 * GET /session/active
 * Lists ongoing consultations for the current provider
 */
router.get('/active',
  requireAuth,
  [
    query('providerId')
      .optional()
      .isString()
      .withMessage('Provider ID must be a string'),
    query('sessionType')
      .optional()
      .isIn(['consultation', 'followup', 'emergency', 'group_therapy'])
      .withMessage('Invalid session type'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: errors.array()
        });
      }

      const { providerId, sessionType, limit = 20 } = req.query;

      // Filter active sessions
      const sessions = Array.from(activeSessions.values()).filter(session => {
        if (session.status !== 'active') return false;
        if (providerId && session.providerId !== providerId) return false;
        if (sessionType && session.sessionType !== sessionType) return false;
        
        // Check if session has exceeded duration
        const now = new Date();
        const startTime = new Date(session.startTime);
        const durationMs = session.duration * 60 * 1000;
        if (now - startTime > durationMs) {
          // Mark session as expired
          session.status = 'expired';
          return false;
        }
        
        return true;
      });

      // Sort by start time (most recent first)
      sessions.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

      // Apply limit
      const limitedSessions = sessions.slice(0, parseInt(limit));

      // Sanitize response to remove sensitive information
      const sanitizedSessions = limitedSessions.map(session => ({
        sessionId: session.id,
        patientId: session.patientId,
        sessionType: session.sessionType,
        startTime: session.startTime,
        duration: session.duration,
        status: session.status,
        participantCount: session.participants.length,
        features: {
          recordingEnabled: session.recordingEnabled,
          transcriptionEnabled: session.transcriptionEnabled
        },
        timeRemaining: Math.max(0, session.duration * 60 - (Date.now() - new Date(session.startTime)) / 1000)
      }));

      res.json({
        sessions: sanitizedSessions,
        total: sessions.length,
        active: sanitizedSessions.length,
        summary: {
          byType: {
            consultation: sessions.filter(s => s.sessionType === 'consultation').length,
            followup: sessions.filter(s => s.sessionType === 'followup').length,
            emergency: sessions.filter(s => s.sessionType === 'emergency').length,
            group_therapy: sessions.filter(s => s.sessionType === 'group_therapy').length
          },
          totalParticipants: sessions.reduce((sum, session) => sum + session.participants.length, 0)
        }
      });

    } catch (error) {
      console.error('[Session API] Get active sessions error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to retrieve active sessions'
      });
    }
  }
);

/**
 * POST /session/transcribe
 * Uses Whisper for speech-to-text (STT) transcription
 */
router.post('/transcribe',
  requireAuth,
  [
    body('sessionId')
      .notEmpty()
      .matches(/^session_\d+_[a-f0-9]+$/)
      .withMessage('Valid session ID is required'),
    body('audioData')
      .notEmpty()
      .withMessage('Audio data is required'),
    body('audioFormat')
      .isIn(['wav', 'mp3', 'webm', 'ogg'])
      .withMessage('Supported audio format is required'),
    body('language')
      .optional()
      .isLength({ min: 2, max: 5 })
      .withMessage('Language code must be 2-5 characters'),
    body('speakerId')
      .optional()
      .isString()
      .withMessage('Speaker ID must be a string')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: errors.array()
        });
      }

      const {
        sessionId,
        audioData,
        audioFormat,
        language = 'en',
        speakerId = 'unknown'
      } = req.body;

      // Validate session exists and is active
      const session = activeSessions.get(sessionId);
      if (!session) {
        return res.status(404).json({
          error: 'SESSION_NOT_FOUND',
          message: 'Session not found or has ended'
        });
      }

      if (!session.transcriptionEnabled) {
        return res.status(403).json({
          error: 'TRANSCRIPTION_DISABLED',
          message: 'Transcription is not enabled for this session'
        });
      }

      // Mock Whisper STT processing (in real implementation, call Whisper API)
      const mockTranscription = {
        text: "This is a sample transcription of the audio data provided. In a real implementation, this would be processed by Whisper STT service.",
        confidence: 0.95,
        language: language,
        duration: 30.5, // seconds
        segments: [
          {
            start: 0.0,
            end: 15.2,
            text: "This is a sample transcription of the audio data provided.",
            confidence: 0.97
          },
          {
            start: 15.2,
            end: 30.5,
            text: "In a real implementation, this would be processed by Whisper STT service.",
            confidence: 0.93
          }
        ]
      };

      const transcriptId = `transcript_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      const timestamp = new Date().toISOString();

      const transcriptData = {
        id: transcriptId,
        sessionId,
        speakerId,
        audioFormat,
        language,
        transcription: mockTranscription,
        timestamp,
        processingTime: 2.3, // seconds
        metadata: {
          audioLength: mockTranscription.duration,
          audioSize: Buffer.byteLength(audioData, 'base64'),
          processingModel: 'whisper-large-v2',
          confidence: mockTranscription.confidence
        }
      };

      // Encrypt and store transcript
      const encryptedTranscript = encryptTranscript(transcriptData);
      transcriptStorage.set(transcriptId, encryptedTranscript);

      res.status(201).json({
        transcriptId,
        sessionId,
        status: 'completed',
        confidence: mockTranscription.confidence,
        language: mockTranscription.language,
        duration: mockTranscription.duration,
        segmentCount: mockTranscription.segments.length,
        timestamp,
        processingTime: transcriptData.processingTime,
        // Return actual transcribed text for immediate use
        text: mockTranscription.text,
        segments: mockTranscription.segments
      });

    } catch (error) {
      console.error('[Session API] Transcription error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to process audio transcription',
        details: error.message
      });
    }
  }
);

/**
 * GET /session/transcript/:id
 * Retrieves encrypted transcripts by ID
 */
router.get('/transcript/:id',
  requireAuth,
  [
    param('id')
      .notEmpty()
      .matches(/^transcript_\d+_[a-f0-9]+$/)
      .withMessage('Invalid transcript ID format')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid transcript ID',
          details: errors.array()
        });
      }

      const { id } = req.params;
      const encryptedTranscript = transcriptStorage.get(id);

      if (!encryptedTranscript) {
        return res.status(404).json({
          error: 'TRANSCRIPT_NOT_FOUND',
          message: 'Transcript not found'
        });
      }

      // Decrypt transcript (mock decryption for demo)
      try {
        const transcriptData = JSON.parse(encryptedTranscript.encrypted || '{}');
        
        // Verify user has access to this transcript's session
        const session = activeSessions.get(transcriptData.sessionId);
        if (!session || session.providerId !== req.user.id) {
          return res.status(403).json({
            error: 'ACCESS_DENIED',
            message: 'You do not have access to this transcript'
          });
        }

        // Return decrypted transcript
        res.json({
          transcriptId: transcriptData.id,
          sessionId: transcriptData.sessionId,
          speakerId: transcriptData.speakerId,
          language: transcriptData.language,
          timestamp: transcriptData.timestamp,
          transcription: {
            text: transcriptData.transcription.text,
            confidence: transcriptData.transcription.confidence,
            duration: transcriptData.transcription.duration,
            segments: transcriptData.transcription.segments
          },
          metadata: transcriptData.metadata
        });

      } catch (decryptError) {
        console.error('Transcript decryption error:', decryptError);
        res.status(500).json({
          error: 'DECRYPTION_ERROR',
          message: 'Failed to decrypt transcript'
        });
      }

    } catch (error) {
      console.error('[Session API] Retrieve transcript error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to retrieve transcript'
      });
    }
  }
);

/**
 * POST /session/:sessionId/end
 * Ends a video consultation session
 */
router.post('/:sessionId/end',
  requireAuth,
  [
    param('sessionId')
      .notEmpty()
      .matches(/^session_\d+_[a-f0-9]+$/)
      .withMessage('Valid session ID is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid session ID',
          details: errors.array()
        });
      }

      const { sessionId } = req.params;
      const session = activeSessions.get(sessionId);

      if (!session) {
        return res.status(404).json({
          error: 'SESSION_NOT_FOUND',
          message: 'Session not found'
        });
      }

      if (session.providerId !== req.user.id) {
        return res.status(403).json({
          error: 'ACCESS_DENIED',
          message: 'You do not have permission to end this session'
        });
      }

      // End the session
      const endTime = new Date().toISOString();
      const actualDuration = (new Date(endTime) - new Date(session.startTime)) / 1000 / 60; // minutes

      session.status = 'ended';
      session.endTime = endTime;
      session.actualDuration = actualDuration;

      // Move to history
      sessionHistory.push({ ...session });

      res.json({
        sessionId,
        status: 'ended',
        endTime,
        duration: {
          scheduled: session.duration,
          actual: Math.round(actualDuration * 100) / 100
        },
        summary: {
          participants: session.participants.length,
          recordingEnabled: session.recordingEnabled,
          transcriptionEnabled: session.transcriptionEnabled
        }
      });

    } catch (error) {
      console.error('[Session API] End session error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to end session'
      });
    }
  }
);

module.exports = router;