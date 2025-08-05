/**
 * Telepsychiatry Chat Routes
 * Handles chat fallback system for low-bandwidth environments
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// In-memory storage for demo purposes (use Redis/database in production)
const chatSessions = new Map();
const chatMessages = new Map();

/**
 * POST /chat/session/start
 * Start a new chat session (fallback for video)
 */
router.post('/session/start', (req, res) => {
    try {
        const {
            patientId,
            clinicianId,
            fallbackReason = 'low_bandwidth',
            language = 'en',
            culturalContext
        } = req.body;

        if (!patientId || !clinicianId) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Patient ID and Clinician ID are required'
            });
        }

        const chatSessionId = uuidv4();
        const chatSession = {
            chatSessionId,
            patientId,
            clinicianId,
            fallbackReason,
            language,
            culturalContext,
            status: 'active',
            startTime: new Date().toISOString(),
            messageCount: 0,
            participants: [
                { id: patientId, role: 'patient', status: 'connected' },
                { id: clinicianId, role: 'clinician', status: 'connected' }
            ]
        };

        chatSessions.set(chatSessionId, chatSession);
        chatMessages.set(chatSessionId, []);

        // Send initial system message
        const welcomeMessage = {
            id: uuidv4(),
            chatSessionId,
            senderId: 'system',
            senderRole: 'system',
            content: getWelcomeMessage(language, culturalContext),
            timestamp: new Date().toISOString(),
            messageType: 'system'
        };

        chatMessages.get(chatSessionId).push(welcomeMessage);

        res.json({
            success: true,
            data: {
                chatSessionId,
                status: 'active',
                fallbackReason,
                participants: chatSession.participants,
                welcomeMessage: welcomeMessage.content,
                language,
                culturalContext
            }
        });
    } catch (error) {
        console.error('Error starting chat session:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to start chat session'
        });
    }
});

/**
 * POST /chat/session/:id/message
 * Send a message in the chat session
 */
router.post('/session/:id/message', (req, res) => {
    try {
        const { id: chatSessionId } = req.params;
        const {
            senderId,
            content,
            messageType = 'text',
            attachments,
            replyToId
        } = req.body;

        if (!senderId || !content) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Sender ID and content are required'
            });
        }

        const chatSession = chatSessions.get(chatSessionId);
        if (!chatSession) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Chat session not found'
            });
        }

        if (chatSession.status !== 'active') {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Chat session is not active'
            });
        }

        // Validate sender is participant
        const participant = chatSession.participants.find(p => p.id === senderId);
        if (!participant) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Sender is not a participant in this chat session'
            });
        }

        const messageId = uuidv4();
        const message = {
            id: messageId,
            chatSessionId,
            senderId,
            senderRole: participant.role,
            content,
            messageType,
            attachments,
            replyToId,
            timestamp: new Date().toISOString(),
            status: 'sent'
        };

        chatMessages.get(chatSessionId).push(message);
        chatSession.messageCount++;
        chatSession.lastActivity = new Date().toISOString();

        res.json({
            success: true,
            data: {
                messageId,
                chatSessionId,
                timestamp: message.timestamp,
                status: 'sent',
                messageCount: chatSession.messageCount
            }
        });
    } catch (error) {
        console.error('Error sending chat message:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to send chat message'
        });
    }
});

/**
 * GET /chat/session/:id/messages
 * Get messages from a chat session
 */
router.get('/session/:id/messages', (req, res) => {
    try {
        const { id: chatSessionId } = req.params;
        const {
            limit = 100,
            offset = 0,
            since
        } = req.query;

        const chatSession = chatSessions.get(chatSessionId);
        if (!chatSession) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Chat session not found'
            });
        }

        let messages = chatMessages.get(chatSessionId) || [];

        // Filter by timestamp if 'since' provided
        if (since) {
            const sinceDate = new Date(since);
            messages = messages.filter(msg => new Date(msg.timestamp) > sinceDate);
        }

        // Apply pagination
        const startIndex = parseInt(offset);
        const endIndex = startIndex + parseInt(limit);
        const paginatedMessages = messages.slice(startIndex, endIndex);

        res.json({
            success: true,
            data: {
                chatSessionId,
                messages: paginatedMessages,
                pagination: {
                    total: messages.length,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: endIndex < messages.length
                },
                sessionInfo: {
                    status: chatSession.status,
                    startTime: chatSession.startTime,
                    messageCount: chatSession.messageCount,
                    participants: chatSession.participants
                }
            }
        });
    } catch (error) {
        console.error('Error retrieving chat messages:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to retrieve chat messages'
        });
    }
});

/**
 * PUT /chat/session/:id/end
 * End a chat session
 */
router.put('/session/:id/end', (req, res) => {
    try {
        const { id: chatSessionId } = req.params;
        const { endedBy, reason } = req.body;

        const chatSession = chatSessions.get(chatSessionId);
        if (!chatSession) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Chat session not found'
            });
        }

        chatSession.status = 'ended';
        chatSession.endTime = new Date().toISOString();
        chatSession.endedBy = endedBy;
        chatSession.endReason = reason;

        // Add system message about session end
        const endMessage = {
            id: uuidv4(),
            chatSessionId,
            senderId: 'system',
            senderRole: 'system',
            content: getSessionEndMessage(chatSession.language),
            timestamp: new Date().toISOString(),
            messageType: 'system'
        };

        chatMessages.get(chatSessionId).push(endMessage);

        res.json({
            success: true,
            data: {
                chatSessionId,
                status: 'ended',
                endTime: chatSession.endTime,
                duration: calculateDuration(chatSession.startTime, chatSession.endTime),
                messageCount: chatSession.messageCount
            }
        });
    } catch (error) {
        console.error('Error ending chat session:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to end chat session'
        });
    }
});

/**
 * GET /chat/session/:id/status
 * Get chat session status and participants
 */
router.get('/session/:id/status', (req, res) => {
    try {
        const { id: chatSessionId } = req.params;

        const chatSession = chatSessions.get(chatSessionId);
        if (!chatSession) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Chat session not found'
            });
        }

        res.json({
            success: true,
            data: {
                chatSessionId,
                status: chatSession.status,
                startTime: chatSession.startTime,
                endTime: chatSession.endTime,
                messageCount: chatSession.messageCount,
                lastActivity: chatSession.lastActivity,
                participants: chatSession.participants,
                fallbackReason: chatSession.fallbackReason,
                language: chatSession.language,
                culturalContext: chatSession.culturalContext
            }
        });
    } catch (error) {
        console.error('Error retrieving chat session status:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to retrieve chat session status'
        });
    }
});

/**
 * POST /chat/session/:id/typing
 * Send typing indicator
 */
router.post('/session/:id/typing', (req, res) => {
    try {
        const { id: chatSessionId } = req.params;
        const { senderId, isTyping = true } = req.body;

        const chatSession = chatSessions.get(chatSessionId);
        if (!chatSession) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Chat session not found'
            });
        }

        // Update participant typing status
        const participant = chatSession.participants.find(p => p.id === senderId);
        if (participant) {
            participant.isTyping = isTyping;
            participant.lastTyping = new Date().toISOString();
        }

        res.json({
            success: true,
            data: {
                chatSessionId,
                senderId,
                isTyping,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error updating typing status:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to update typing status'
        });
    }
});

// Helper functions
function getWelcomeMessage(language, culturalContext) {
    const messages = {
        'en': {
            'hispanic': 'Welcome to your secure chat session. Please feel free to communicate in the language you are most comfortable with.',
            'asian': 'Welcome to your confidential chat session. We respect your privacy and cultural preferences.',
            'african_american': 'Welcome to your secure chat session. This is a safe space for open and honest communication.',
            'default': 'Welcome to your secure chat session. Feel free to share your thoughts and concerns.'
        },
        'es': {
            'hispanic': 'Bienvenido a su sesión de chat segura. Siéntase libre de comunicarse en el idioma con el que se sienta más cómodo.',
            'default': 'Bienvenido a su sesión de chat segura. Comparta sus pensamientos y preocupaciones.'
        },
        'fr': {
            'default': 'Bienvenue à votre session de chat sécurisée. N\'hésitez pas à partager vos pensées et préoccupations.'
        }
    };

    const langMessages = messages[language] || messages['en'];
    return langMessages[culturalContext] || langMessages['default'] || langMessages[Object.keys(langMessages)[0]];
}

function getSessionEndMessage(language) {
    const messages = {
        'en': 'Chat session has ended. Thank you for your participation. Please reach out if you need further support.',
        'es': 'La sesión de chat ha terminado. Gracias por su participación. Póngase en contacto si necesita más apoyo.',
        'fr': 'La session de chat est terminée. Merci pour votre participation. N\'hésitez pas à nous contacter si vous avez besoin d\'un soutien supplémentaire.'
    };

    return messages[language] || messages['en'];
}

function calculateDuration(startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = end - start;
    const minutes = Math.floor(durationMs / (1000 * 60));
    return `${minutes} minutes`;
}

// Initialize sample chat session for demo
function initializeSampleChatSession() {
    const sampleSessionId = 'chat-sample-123';
    const sampleSession = {
        chatSessionId: sampleSessionId,
        patientId: 'patient-123',
        clinicianId: 'clinician-456',
        fallbackReason: 'low_bandwidth',
        language: 'en',
        culturalContext: 'hispanic',
        status: 'active',
        startTime: new Date().toISOString(),
        messageCount: 3,
        participants: [
            { id: 'patient-123', role: 'patient', status: 'connected' },
            { id: 'clinician-456', role: 'clinician', status: 'connected' }
        ]
    };

    chatSessions.set(sampleSessionId, sampleSession);

    const sampleMessages = [
        {
            id: uuidv4(),
            chatSessionId: sampleSessionId,
            senderId: 'system',
            senderRole: 'system',
            content: 'Welcome to your secure chat session. Please feel free to communicate in the language you are most comfortable with.',
            timestamp: new Date(Date.now() - 300000).toISOString(),
            messageType: 'system'
        },
        {
            id: uuidv4(),
            chatSessionId: sampleSessionId,
            senderId: 'clinician-456',
            senderRole: 'clinician',
            content: 'Hello! I\'m Dr. Smith. How are you feeling today?',
            timestamp: new Date(Date.now() - 240000).toISOString(),
            messageType: 'text'
        },
        {
            id: uuidv4(),
            chatSessionId: sampleSessionId,
            senderId: 'patient-123',
            senderRole: 'patient',
            content: 'Hi Dr. Smith. I\'ve been feeling quite anxious lately, especially about work.',
            timestamp: new Date(Date.now() - 180000).toISOString(),
            messageType: 'text'
        }
    ];

    chatMessages.set(sampleSessionId, sampleMessages);
}

// Initialize sample data
initializeSampleChatSession();

module.exports = router;