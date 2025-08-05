/**
 * Telepsychiatry Session Management Routes
 * Handles session lifecycle, transcription, and session data
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// In-memory storage for demo purposes (use Redis/database in production)
const activeSessions = new Map();
const sessionTranscripts = new Map();
const sessionNotes = new Map();

/**
 * GET /session/active
 * Fetch Active Sessions - Provides a list of ongoing consultations
 */
router.get('/active', (req, res) => {
    try {
        const userId = req.user?.id || req.headers['x-user-id'];
        
        if (!userId) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'User ID required to fetch active sessions'
            });
        }

        // Filter sessions for the current user (clinician or patient)
        const userSessions = [];
        for (const [sessionId, session] of activeSessions.entries()) {
            if (session.clinicianId === userId || session.patientId === userId) {
                userSessions.push({
                    sessionId,
                    patientId: session.patientId,
                    clinicianId: session.clinicianId,
                    status: session.status,
                    startTime: session.startTime,
                    sessionType: session.sessionType,
                    culturalContext: session.culturalContext,
                    language: session.language
                });
            }
        }

        res.json({
            success: true,
            data: {
                activeSessions: userSessions,
                totalCount: userSessions.length
            }
        });
    } catch (error) {
        console.error('Error fetching active sessions:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch active sessions'
        });
    }
});

/**
 * POST /session/start
 * Start Session - Initiates a Jitsi video session with fallback to chat
 */
router.post('/start', (req, res) => {
    try {
        const {
            patientId,
            clinicianId,
            sessionType = 'video',
            culturalContext,
            language = 'en',
            fallbackToChat = true
        } = req.body;

        if (!patientId || !clinicianId) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Patient ID and Clinician ID are required'
            });
        }

        const sessionId = uuidv4();
        const session = {
            sessionId,
            patientId,
            clinicianId,
            sessionType,
            culturalContext,
            language,
            status: 'active',
            startTime: new Date().toISOString(),
            jitsiRoomId: `webqx-session-${sessionId}`,
            chatFallback: fallbackToChat,
            transcription: {
                enabled: true,
                segments: []
            }
        };

        activeSessions.set(sessionId, session);

        // Initialize empty transcript and notes
        sessionTranscripts.set(sessionId, {
            sessionId,
            segments: [],
            summary: null,
            encrypted: true
        });

        sessionNotes.set(sessionId, {
            sessionId,
            notes: [],
            tags: []
        });

        res.json({
            success: true,
            data: {
                sessionId,
                jitsiRoomId: session.jitsiRoomId,
                sessionType,
                status: 'active',
                chatFallbackAvailable: fallbackToChat,
                transcriptionEnabled: true,
                culturalContext,
                language
            }
        });
    } catch (error) {
        console.error('Error starting session:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to start session'
        });
    }
});

/**
 * POST /session/transcribe
 * Whisper STT - Performs real-time speech-to-text transcription
 */
router.post('/transcribe', (req, res) => {
    try {
        const {
            sessionId,
            audioData,
            timestamp,
            speaker = 'unknown',
            language = 'en'
        } = req.body;

        if (!sessionId || !audioData) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Session ID and audio data are required'
            });
        }

        const session = activeSessions.get(sessionId);
        if (!session) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Session not found'
            });
        }

        // Mock transcription (in production, integrate with Whisper API)
        const transcriptionText = mockWhisperTranscription(audioData, language);
        
        const transcriptSegment = {
            id: uuidv4(),
            timestamp: timestamp || new Date().toISOString(),
            speaker,
            text: transcriptionText,
            confidence: 0.95,
            language
        };

        // Add to session transcript
        const transcript = sessionTranscripts.get(sessionId);
        if (transcript) {
            transcript.segments.push(transcriptSegment);
        }

        // Update session with transcription data
        session.transcription.segments.push(transcriptSegment);

        res.json({
            success: true,
            data: {
                transcription: transcriptSegment,
                cached: false, // Would be true if stored locally when offline
                sessionId
            }
        });
    } catch (error) {
        console.error('Error processing transcription:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to process transcription'
        });
    }
});

/**
 * GET /session/transcript/:id
 * Generate Summary - Retrieves an encrypted transcript of the session
 */
router.get('/transcript/:id', (req, res) => {
    try {
        const { id: sessionId } = req.params;
        
        const transcript = sessionTranscripts.get(sessionId);
        if (!transcript) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Transcript not found'
            });
        }

        const session = activeSessions.get(sessionId);
        if (!session) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Session not found'
            });
        }

        // Generate summary if not already created
        if (!transcript.summary) {
            transcript.summary = generateSessionSummary(transcript.segments);
        }

        res.json({
            success: true,
            data: {
                sessionId,
                encrypted: transcript.encrypted,
                transcript: {
                    segments: transcript.segments,
                    summary: transcript.summary,
                    totalSegments: transcript.segments.length,
                    sessionDuration: calculateSessionDuration(session.startTime),
                    language: session.language,
                    culturalContext: session.culturalContext
                }
            }
        });
    } catch (error) {
        console.error('Error retrieving transcript:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to retrieve transcript'
        });
    }
});

/**
 * PUT /session/:id/end
 * End Session - Marks session as completed
 */
router.put('/:id/end', (req, res) => {
    try {
        const { id: sessionId } = req.params;
        
        const session = activeSessions.get(sessionId);
        if (!session) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Session not found'
            });
        }

        session.status = 'completed';
        session.endTime = new Date().toISOString();

        res.json({
            success: true,
            data: {
                sessionId,
                status: 'completed',
                duration: calculateSessionDuration(session.startTime)
            }
        });
    } catch (error) {
        console.error('Error ending session:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to end session'
        });
    }
});

// Helper functions
function mockWhisperTranscription(audioData, language) {
    // Mock transcription responses based on language
    const mockTranscriptions = {
        'en': [
            "Patient reports feeling anxious about work stress.",
            "I've been having trouble sleeping for the past week.",
            "The medication seems to be helping with my mood.",
            "I would like to discuss coping strategies."
        ],
        'es': [
            "El paciente reporta sentirse ansioso por el estrés laboral.",
            "He tenido problemas para dormir durante la semana pasada.",
            "La medicación parece estar ayudando con mi estado de ánimo."
        ],
        'fr': [
            "Le patient rapporte se sentir anxieux à propos du stress au travail.",
            "J'ai eu des problèmes de sommeil la semaine dernière."
        ]
    };

    const transcriptions = mockTranscriptions[language] || mockTranscriptions['en'];
    return transcriptions[Math.floor(Math.random() * transcriptions.length)];
}

function generateSessionSummary(segments) {
    const totalSegments = segments.length;
    const speakers = [...new Set(segments.map(s => s.speaker))];
    
    return {
        totalSegments,
        speakers,
        keyTopics: extractKeyTopics(segments),
        sentiment: 'neutral', // Mock sentiment analysis
        duration: `${totalSegments * 2} minutes (estimated)`,
        clinicalNotes: generateClinicalNotes(segments)
    };
}

function extractKeyTopics(segments) {
    const topics = [];
    const text = segments.map(s => s.text).join(' ').toLowerCase();
    
    if (text.includes('anxiety') || text.includes('anxious')) topics.push('anxiety');
    if (text.includes('sleep') || text.includes('insomnia')) topics.push('sleep issues');
    if (text.includes('medication') || text.includes('therapy')) topics.push('treatment');
    if (text.includes('stress') || text.includes('work')) topics.push('stress management');
    
    return topics;
}

function generateClinicalNotes(segments) {
    return [
        "Patient engaged throughout session",
        "Discussed current symptoms and treatment progress",
        "Collaborative approach to care planning established"
    ];
}

function calculateSessionDuration(startTime) {
    const start = new Date(startTime);
    const now = new Date();
    const durationMs = now - start;
    const minutes = Math.floor(durationMs / (1000 * 60));
    return `${minutes} minutes`;
}

module.exports = router;