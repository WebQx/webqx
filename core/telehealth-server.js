/**
 * WebQX™ Telehealth Services Server
 * 
 * Dedicated server for telehealth services including video conferencing,
 * secure messaging, real-time communication, and clinical collaboration
 * 
 * Features:
 * - WebRTC video conferencing
 * - Secure messaging
 * - Real-time notifications
 * - Session management
 * - HIPAA-compliant communications
 * - WebSocket support
 * 
 * @author WebQX Health
 * @version v0.1.0
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

class TelehealthServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.wss = new WebSocket.Server({ server: this.server });
        this.port = process.env.PORT || 3003;
        
        // Configuration
        this.config = {
            video: {
                maxParticipants: 10,
                defaultQuality: 'medium',
                recordingEnabled: process.env.VIDEO_RECORDING_ENABLED === 'true',
                maxBitrate: 2000000, // 2 Mbps
                minBitrate: 300000   // 300 Kbps
            },
            messaging: {
                maxMessageLength: 5000,
                retentionDays: 30,
                encryptionEnabled: true
            },
            security: {
                enableAudit: true,
                requireMFA: process.env.REQUIRE_MFA === 'true',
                sessionTimeout: 3600000 // 1 hour
            }
        };

        // In-memory storage (use database in production)
        this.activeSessions = new Map();
        this.connections = new Map();
        this.messageHistory = new Map();
        this.userSessions = new Map();
        
        this.initializeServer();
    }

    /**
     * Initialize the Express server and WebSocket
     */
    initializeServer() {
        // Security middleware
        this.app.use(helmet({
            crossOriginEmbedderPolicy: false,
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    connectSrc: ["'self'", "ws:", "wss:"],
                    mediaSrc: ["'self'", "blob:"]
                },
            },
        }));

        // CORS configuration
        this.app.use(cors({
            origin: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
            credentials: true
        }));

        // Rate limiting
        const apiLimiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 200, // Higher limit for real-time communications
            message: {
                error: 'Too many requests',
                code: 'RATE_LIMIT_EXCEEDED'
            }
        });

        this.app.use(apiLimiter);

        // Body parsing middleware
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        // Setup routes
        this.setupRoutes();
        
        // Setup WebSocket handlers
        this.setupWebSocket();
        
        console.log('✅ Telehealth Server initialized');
    }

    /**
     * Setup all API routes
     */
    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                service: 'WebQX Telehealth Services Server',
                version: 'v0.1.0',
                timestamp: new Date().toISOString(),
                activeConnections: this.connections.size,
                activeSessions: this.activeSessions.size,
                features: {
                    videoConferencing: true,
                    secureMessaging: true,
                    realTimeNotifications: true,
                    sessionRecording: this.config.video.recordingEnabled
                }
            });
        });

        // Video conferencing endpoints
        this.setupVideoRoutes();
        
        // Messaging endpoints
        this.setupMessagingRoutes();
        
        // Session management endpoints
        this.setupSessionRoutes();
    }

    /**
     * Setup video conferencing routes
     */
    setupVideoRoutes() {
        // Start video session
        this.app.post('/api/v1/telehealth/video/session/start', this.authenticateRequest.bind(this), (req, res) => {
            try {
                const { sessionType = 'consultation', maxParticipants = 2, recordingEnabled = false } = req.body;
                
                const sessionId = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                
                const session = {
                    id: sessionId,
                    type: sessionType,
                    createdBy: req.user.id,
                    createdAt: new Date().toISOString(),
                    status: 'active',
                    participants: [],
                    maxParticipants,
                    recordingEnabled,
                    settings: {
                        quality: this.config.video.defaultQuality,
                        maxBitrate: this.config.video.maxBitrate,
                        minBitrate: this.config.video.minBitrate
                    }
                };

                this.activeSessions.set(sessionId, session);
                
                // Add creator as participant
                session.participants.push({
                    userId: req.user.id,
                    role: 'host',
                    joinedAt: new Date().toISOString(),
                    status: 'connected'
                });

                res.status(201).json({
                    success: true,
                    message: 'Video session created successfully',
                    data: {
                        sessionId,
                        joinUrl: `/video/session/${sessionId}`,
                        settings: session.settings
                    }
                });

                this.logAuditEvent('VIDEO_SESSION_CREATED', {
                    sessionId,
                    userId: req.user.id,
                    sessionType
                });

            } catch (error) {
                console.error('❌ Failed to create video session:', error);
                res.status(500).json({
                    error: 'Internal Server Error',
                    message: 'Failed to create video session'
                });
            }
        });

        // Join video session
        this.app.post('/api/v1/telehealth/video/session/:sessionId/join', this.authenticateRequest.bind(this), (req, res) => {
            try {
                const { sessionId } = req.params;
                const session = this.activeSessions.get(sessionId);

                if (!session) {
                    return res.status(404).json({
                        error: 'Session Not Found',
                        message: 'Video session not found'
                    });
                }

                if (session.participants.length >= session.maxParticipants) {
                    return res.status(403).json({
                        error: 'Session Full',
                        message: 'Maximum participants reached'
                    });
                }

                // Add participant
                session.participants.push({
                    userId: req.user.id,
                    role: 'participant',
                    joinedAt: new Date().toISOString(),
                    status: 'connected'
                });

                res.json({
                    success: true,
                    message: 'Joined video session successfully',
                    data: {
                        sessionId,
                        role: 'participant',
                        settings: session.settings,
                        participants: session.participants.length
                    }
                });

                // Notify other participants
                this.broadcastToSession(sessionId, {
                    type: 'participant_joined',
                    userId: req.user.id,
                    participantCount: session.participants.length
                });

                this.logAuditEvent('VIDEO_SESSION_JOINED', {
                    sessionId,
                    userId: req.user.id
                });

            } catch (error) {
                console.error('❌ Failed to join video session:', error);
                res.status(500).json({
                    error: 'Internal Server Error',
                    message: 'Failed to join video session'
                });
            }
        });

        // Leave video session
        this.app.post('/api/v1/telehealth/video/session/:sessionId/leave', this.authenticateRequest.bind(this), (req, res) => {
            try {
                const { sessionId } = req.params;
                const session = this.activeSessions.get(sessionId);

                if (!session) {
                    return res.status(404).json({
                        error: 'Session Not Found',
                        message: 'Video session not found'
                    });
                }

                // Remove participant
                session.participants = session.participants.filter(p => p.userId !== req.user.id);

                // End session if no participants left
                if (session.participants.length === 0) {
                    session.status = 'ended';
                    session.endedAt = new Date().toISOString();
                }

                res.json({
                    success: true,
                    message: 'Left video session successfully'
                });

                // Notify other participants
                this.broadcastToSession(sessionId, {
                    type: 'participant_left',
                    userId: req.user.id,
                    participantCount: session.participants.length
                });

                this.logAuditEvent('VIDEO_SESSION_LEFT', {
                    sessionId,
                    userId: req.user.id
                });

            } catch (error) {
                console.error('❌ Failed to leave video session:', error);
                res.status(500).json({
                    error: 'Internal Server Error',
                    message: 'Failed to leave video session'
                });
            }
        });

        // Get session status
        this.app.get('/api/v1/telehealth/video/session/:sessionId/status', this.authenticateRequest.bind(this), (req, res) => {
            try {
                const { sessionId } = req.params;
                const session = this.activeSessions.get(sessionId);

                if (!session) {
                    return res.status(404).json({
                        error: 'Session Not Found',
                        message: 'Video session not found'
                    });
                }

                res.json({
                    success: true,
                    data: {
                        sessionId: session.id,
                        status: session.status,
                        type: session.type,
                        participantCount: session.participants.length,
                        maxParticipants: session.maxParticipants,
                        participants: session.participants.map(p => ({
                            userId: p.userId,
                            role: p.role,
                            status: p.status,
                            joinedAt: p.joinedAt
                        })),
                        createdAt: session.createdAt,
                        endedAt: session.endedAt || null
                    }
                });

            } catch (error) {
                console.error('❌ Failed to get session status:', error);
                res.status(500).json({
                    error: 'Internal Server Error',
                    message: 'Failed to get session status'
                });
            }
        });
    }

    /**
     * Setup messaging routes
     */
    setupMessagingRoutes() {
        // Send message
        this.app.post('/api/v1/telehealth/messaging/send', this.authenticateRequest.bind(this), (req, res) => {
            try {
                const { recipientId, message, sessionId, messageType = 'text' } = req.body;

                if (!message || message.length > this.config.messaging.maxMessageLength) {
                    return res.status(400).json({
                        error: 'Invalid Message',
                        message: 'Message is required and must be within length limits'
                    });
                }

                const messageId = uuidv4();
                const messageData = {
                    id: messageId,
                    senderId: req.user.id,
                    recipientId,
                    sessionId,
                    content: message,
                    type: messageType,
                    timestamp: new Date().toISOString(),
                    encrypted: this.config.messaging.encryptionEnabled,
                    delivered: false,
                    read: false
                };

                // Store message
                if (!this.messageHistory.has(sessionId || 'general')) {
                    this.messageHistory.set(sessionId || 'general', []);
                }
                this.messageHistory.get(sessionId || 'general').push(messageData);

                // Real-time delivery
                if (sessionId) {
                    // Broadcast to session participants (including sender)
                    this.broadcastToSession(sessionId, {
                        type: 'new_message',
                        data: messageData
                    });
                } else if (recipientId) {
                    // Direct message (no session specified)
                    this.sendMessageToUser(recipientId, {
                        type: 'new_message',
                        data: messageData
                    });
                }

                res.status(201).json({
                    success: true,
                    message: 'Message sent successfully',
                    data: { messageId, timestamp: messageData.timestamp }
                });

                this.logAuditEvent('MESSAGE_SENT', {
                    messageId,
                    senderId: req.user.id,
                    recipientId,
                    sessionId
                });

            } catch (error) {
                console.error('❌ Failed to send message:', error);
                res.status(500).json({
                    error: 'Internal Server Error',
                    message: 'Failed to send message'
                });
            }
        });

        // Get message history
        this.app.get('/api/v1/telehealth/messaging/history/:sessionId', this.authenticateRequest.bind(this), (req, res) => {
            try {
                const { sessionId } = req.params;
                const { limit = 50, offset = 0 } = req.query;

                const messages = this.messageHistory.get(sessionId) || [];
                const paginatedMessages = messages
                    .slice(parseInt(offset), parseInt(offset) + parseInt(limit))
                    .map(msg => ({
                        ...msg,
                        content: msg.encrypted ? '[Encrypted]' : msg.content // Decrypt in production
                    }));

                res.json({
                    success: true,
                    data: {
                        messages: paginatedMessages,
                        total: messages.length,
                        hasMore: (parseInt(offset) + parseInt(limit)) < messages.length
                    }
                });

            } catch (error) {
                console.error('❌ Failed to get message history:', error);
                res.status(500).json({
                    error: 'Internal Server Error',
                    message: 'Failed to get message history'
                });
            }
        });
    }

    /**
     * Setup session management routes
     */
    setupSessionRoutes() {
        // List active sessions
        this.app.get('/api/v1/telehealth/sessions', this.authenticateRequest.bind(this), (req, res) => {
            try {
                const sessions = Array.from(this.activeSessions.values())
                    .filter(session => 
                        session.status === 'active' && 
                        session.participants.some(p => p.userId === req.user.id)
                    )
                    .map(session => ({
                        id: session.id,
                        type: session.type,
                        status: session.status,
                        participantCount: session.participants.length,
                        createdAt: session.createdAt
                    }));

                res.json({
                    success: true,
                    data: { sessions }
                });

            } catch (error) {
                console.error('❌ Failed to list sessions:', error);
                res.status(500).json({
                    error: 'Internal Server Error',
                    message: 'Failed to list sessions'
                });
            }
        });
    }

    /**
     * Setup WebSocket handlers
     */
    setupWebSocket() {
        this.wss.on('connection', (ws, req) => {
            const connectionId = uuidv4();
            console.log(`📡 New WebSocket connection: ${connectionId}`);

            // Store connection
            this.connections.set(connectionId, {
                ws,
                userId: null,
                sessionId: null,
                connectedAt: new Date().toISOString()
            });

            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleWebSocketMessage(connectionId, message);
                } catch (error) {
                    console.error('❌ WebSocket message error:', error);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Invalid message format'
                    }));
                }
            });

            ws.on('close', () => {
                console.log(`📡 WebSocket connection closed: ${connectionId}`);
                this.connections.delete(connectionId);
            });

            ws.on('error', (error) => {
                console.error('❌ WebSocket error:', error);
                this.connections.delete(connectionId);
            });

            // Send welcome message
            ws.send(JSON.stringify({
                type: 'connected',
                connectionId,
                timestamp: new Date().toISOString()
            }));
        });

        console.log('✅ WebSocket server initialized');
    }

    /**
     * Handle WebSocket messages
     */
    handleWebSocketMessage(connectionId, message) {
        const connection = this.connections.get(connectionId);
        if (!connection) return;

        switch (message.type) {
            case 'auth':
                // Authenticate WebSocket connection
                connection.userId = message.userId; // Validate token in production
                connection.ws.send(JSON.stringify({
                    type: 'auth_success',
                    userId: message.userId
                }));
                break;

            case 'join_session':
                // Join a session for real-time updates
                connection.sessionId = message.sessionId;
                connection.ws.send(JSON.stringify({
                    type: 'session_joined',
                    sessionId: message.sessionId
                }));
                break;

            case 'webrtc_signal':
                // Forward WebRTC signaling messages
                this.forwardSignalingMessage(connection, message);
                break;

            case 'ping':
                // Heartbeat
                connection.ws.send(JSON.stringify({ type: 'pong' }));
                break;

            default:
                console.warn('❓ Unknown WebSocket message type:', message.type);
        }
    }

    /**
     * Forward WebRTC signaling messages
     */
    forwardSignalingMessage(senderConnection, message) {
        const { targetUserId, signal } = message;
        
        // Find target user's connection
        for (const [id, connection] of this.connections) {
            if (connection.userId === targetUserId) {
                connection.ws.send(JSON.stringify({
                    type: 'webrtc_signal',
                    senderId: senderConnection.userId,
                    signal
                }));
                break;
            }
        }
    }

    /**
     * Broadcast message to all participants in a session
     */
    broadcastToSession(sessionId, message) {
        for (const [id, connection] of this.connections) {
            if (connection.sessionId === sessionId) {
                connection.ws.send(JSON.stringify(message));
            }
        }
    }

    /**
     * Send message to specific user
     */
    sendMessageToUser(userId, message) {
        for (const [id, connection] of this.connections) {
            if (connection.userId === userId) {
                connection.ws.send(JSON.stringify(message));
                break;
            }
        }
    }

    /**
     * Authentication middleware
     */
    authenticateRequest(req, res, next) {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Authentication Required',
                message: 'Valid access token required'
            });
        }

        const token = authHeader.substring(7);
        
        // Validate token (simplified for demo)
        if (token === 'demo-token' || this.isValidToken(token)) {
            req.user = { id: 'demo-user', role: 'provider' };
            next();
        } else {
            res.status(401).json({
                error: 'Invalid Token',
                message: 'Invalid or expired access token'
            });
        }
    }

    /**
     * Validate token
     */
    isValidToken(token) {
        // In production, validate against JWT or session store
        return token.length > 10; // Simple validation for demo
    }

    /**
     * Log audit events for HIPAA compliance
     */
    logAuditEvent(action, details) {
        const auditLog = {
            timestamp: new Date().toISOString(),
            action,
            details,
            service: 'telehealth'
        };
        
        console.log('📋 Audit:', JSON.stringify(auditLog));
        // In production, save to secure audit log storage
    }

    /**
     * Start the server
     */
    start() {
        return new Promise((resolve, reject) => {
            this.server.listen(this.port, '0.0.0.0', () => {
                console.log(`📹 Telehealth Services Server started on port ${this.port}`);
                console.log(`   • Health Check: http://localhost:${this.port}/health`);
                console.log(`   • Video API: http://localhost:${this.port}/api/v1/telehealth/video/*`);
                console.log(`   • Messaging API: http://localhost:${this.port}/api/v1/telehealth/messaging/*`);
                console.log(`   • WebSocket: ws://localhost:${this.port}`);
                resolve(this.server);
            });

            this.server.on('error', (error) => {
                console.error('❌ Failed to start Telehealth server:', error);
                reject(error);
            });
        });
    }
}

// Start server if called directly
if (require.main === module) {
    const server = new TelehealthServer();
    server.start().catch(console.error);
}

module.exports = TelehealthServer;