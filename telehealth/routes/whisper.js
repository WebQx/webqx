/**
 * @fileoverview API Routes for Whisper Medical Transcription
 * 
 * This file defines the API endpoints for the Whisper-based medical
 * transcription service, enabling real-time and batch processing of
 * telehealth audio streams.
 * 
 * @author WebQX Health
 * @version v0.1.0
 */

const express = require('express');
const router = express.Router();
const { RealtimeWhisperService } = require('../services/realtimeWhisperService');
const { authMiddleware } = require('../middleware/auth');

/**
 * POST /api/telehealth/transcribe/realtime
 * 
 * Starts a new real-time transcription session.
 * Expects a WebSocket connection to be established.
 */
router.post('/transcribe/realtime', authMiddleware, (req, res) => {
    const { sessionId, options } = req.body;

    if (!sessionId) {
        return res.status(400).json({
            success: false,
            error: 'SESSION_ID_REQUIRED',
            message: 'A session ID is required to start a transcription session.'
        });
    }

    try {
        // The actual transcription service will be handled via WebSocket,
        // so this endpoint just acknowledges that the session can start.
        res.status(200).json({
            success: true,
            message: 'Real-time transcription session ready to start.',
            websocketUrl: `wss://${req.hostname}/api/telehealth/transcribe/ws/${sessionId}`
        });
    } catch (error) {
        console.error('Failed to initialize real-time transcription session:', error);
        res.status(500).json({
            success: false,
            error: 'INITIALIZATION_FAILED',
            message: 'Could not start the real-time transcription service.'
        });
    }
});

/**
 * WebSocket endpoint for real-time transcription
 * /api/telehealth/transcribe/ws/:sessionId
 */
router.ws('/transcribe/ws/:sessionId', (ws, req) => {
    const { sessionId } = req.params;
    const whisperService = new RealtimeWhisperService(sessionId);

    ws.on('message', (msg) => {
        // Forward audio chunks to the Whisper service
        whisperService.streamAudio(msg);
    });

    whisperService.on('transcription', (transcription) => {
        // Send transcription results back to the client
        ws.send(JSON.stringify({ type: 'TRANSCRIPTION', data: transcription }));
    });

    whisperService.on('error', (error) => {
        // Handle errors and inform the client
        ws.send(JSON.stringify({ type: 'ERROR', data: error }));
    });

    ws.on('close', () => {
        // Clean up the service when the connection is closed
        whisperService.stopTranscription();
    });
});

module.exports = router;
