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
const { URL } = require('url');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
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
        this.persistencePath = process.env.TELEHEALTH_DATA_PATH || path.join(process.cwd(), 'telehealth-data.json');
        this.dirty = false;
        
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
        // Load persisted state
        this.loadPersistedState();
        // Periodic flush
        setInterval(()=>{ if(this.dirty) this.persistState(); }, 10000).unref();
        
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
                const { sessionType = 'consultation', maxParticipants = 2, recordingEnabled = false, allowedParticipants = [] } = req.body;
                
                const sessionId = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                
                // Normalize allowedParticipants (ensure array of unique strings excluding creator if present twice)
                const normalizedAllowed = Array.isArray(allowedParticipants)
                    ? [...new Set(allowedParticipants.filter(p => typeof p === 'string' && p.trim() && p !== req.user.id))]
                    : [];

                const session = {
                    id: sessionId,
                    type: sessionType,
                    createdBy: req.user.id,
                    createdAt: new Date().toISOString(),
                    status: 'active',
                    participants: [],
                    maxParticipants,
                    recordingEnabled,
                    allowedParticipants: normalizedAllowed, // Access control list (empty => open only to creator until invites)
                    settings: {
                        quality: this.config.video.defaultQuality,
                        maxBitrate: this.config.video.maxBitrate,
                        minBitrate: this.config.video.minBitrate
                    }
                };

                this.activeSessions.set(sessionId, session);
                this.dirty = true;
                
                // Add creator as participant
                session.participants.push({
                    userId: req.user.id,
                    role: 'host',
                    joinedAt: new Date().toISOString(),
                    status: 'connected'
                });
                this.dirty = true;

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

                // Access control: only creator or explicitly allowed users may join (if ACL defined)
                const aclDefined = Array.isArray(session.allowedParticipants);
                if (aclDefined && session.allowedParticipants.length > 0 && session.createdBy !== req.user.id && !session.allowedParticipants.includes(req.user.id)) {
                    this.logAuditEvent('VIDEO_SESSION_ACCESS_DENIED', { sessionId, userId: req.user.id, reason: 'not_in_allowed_participants' });
                    return res.status(403).json({
                        error: 'Access Denied',
                        message: 'You are not allowed to join this session'
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
                this.dirty = true;

                res.json({
                    success: true,
                    message: 'Joined video session successfully',
                    data: {
                        sessionId,
                        role: 'participant',
                        settings: session.settings,
                        participants: session.participants.length,
                        allowedParticipants: session.allowedParticipants
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
                this.dirty = true;

                // End session if no participants left
                if (session.participants.length === 0) {
                    session.status = 'ended';
                    session.endedAt = new Date().toISOString();
                    this.dirty = true;
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
                        allowedParticipants: session.allowedParticipants || [],
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

        // Invite (add allowed participant)
        this.app.post('/api/v1/telehealth/video/session/:sessionId/invite', this.authenticateRequest.bind(this), (req, res) => {
            try {
                const { sessionId } = req.params;
                const { userId } = req.body;
                const session = this.activeSessions.get(sessionId);
                if (!session) {
                    return res.status(404).json({ error: 'Session Not Found', message: 'Video session not found' });
                }
                if (session.createdBy !== req.user.id) {
                    return res.status(403).json({ error: 'Forbidden', message: 'Only session creator can invite' });
                }
                if (!userId || typeof userId !== 'string') {
                    return res.status(400).json({ error: 'Invalid userId', message: 'userId required' });
                }
                if (!Array.isArray(session.allowedParticipants)) session.allowedParticipants = [];
                if (!session.allowedParticipants.includes(userId)) {
                    session.allowedParticipants.push(userId);
                    this.dirty = true;
                }
                this.logAuditEvent('VIDEO_SESSION_INVITE', { sessionId, invited: userId, by: req.user.id });
                res.json({ success: true, data: { sessionId, allowedParticipants: session.allowedParticipants } });
            } catch (error) {
                console.error('❌ Failed to invite participant:', error);
                res.status(500).json({ error: 'Internal Server Error', message: 'Failed to invite participant' });
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
                this.dirty = true;

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
                const { limit = 50, offset = 0, since } = req.query;

                let messages = this.messageHistory.get(sessionId) || [];
                // Filter by since timestamp if provided
                if (since) {
                    const sinceDate = new Date(since);
                    if (!isNaN(sinceDate.getTime())) {
                        messages = messages.filter(m => new Date(m.timestamp) > sinceDate);
                    }
                }
                const total = messages.length;
                const paginated = messages
                    .slice(parseInt(offset), parseInt(offset) + parseInt(limit))
                    .map(msg => ({
                        ...msg,
                        content: msg.encrypted ? '[Encrypted]' : msg.content
                    }));

                this.logAuditEvent('MESSAGE_HISTORY_FETCH', { sessionId, count: paginated.length, since: since || null, userId: req.user.id });
                res.json({
                    success: true,
                    data: {
                        messages: paginated,
                        total,
                        hasMore: (parseInt(offset) + parseInt(limit)) < total
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
                        createdAt: session.createdAt,
                        allowed: session.allowedParticipants && session.allowedParticipants.length > 0 ? 'restricted' : 'open'
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
            // Attempt token extraction from query param (?token=) for early auth
            let initialUserId = null;
            let authenticated = false;
            try {
                const fullUrl = new URL(req.url, 'http://localhost');
                const token = fullUrl.searchParams.get('token');
                if (token) {
                    const parsed = this.parseToken(token);
                    if (parsed && parsed.userId) {
                        initialUserId = parsed.userId;
                        authenticated = true;
                        this.logAuditEvent('WS_AUTH_QUERY_SUCCESS', { userId: initialUserId, connectionId });
                    } else {
                        this.logAuditEvent('WS_AUTH_QUERY_FAILED', { reason: 'parse_failed', connectionId });
                    }
                }
            } catch (e) {
                console.warn('WS query parse failed:', e.message);
            }

            this.connections.set(connectionId, {
                ws,
                userId: initialUserId,
                sessionId: null,
                connectedAt: new Date().toISOString(),
                authenticated
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
                authenticated,
                userId: initialUserId,
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
                if (connection.authenticated) {
                    // Already auth via query
                    connection.ws.send(JSON.stringify({ type: 'auth_success', userId: connection.userId, already:true }));
                    return;
                }
                if (!message.token) {
                    connection.ws.send(JSON.stringify({ type: 'error', message: 'Missing token' }));
                    return;
                }
                const parsed = this.parseToken(message.token);
                if (!parsed || !parsed.userId) {
                    connection.ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
                    this.logAuditEvent('WS_AUTH_FAILED', { connectionId });
                    try { connection.ws.close(); } catch {}
                    return;
                }
                connection.userId = parsed.userId;
                connection.authenticated = true;
                this.logAuditEvent('WS_AUTH_SUCCESS', { userId: parsed.userId, connectionId });
                connection.ws.send(JSON.stringify({ type: 'auth_success', userId: parsed.userId }));
                break;

            case 'join_session':
                if (!connection.authenticated) {
                    connection.ws.send(JSON.stringify({ type: 'error', message: 'Authenticate first' }));
                    return;
                }
                if (!message.sessionId) {
                    connection.ws.send(JSON.stringify({ type: 'error', message: 'sessionId required' }));
                    return;
                }
                const session = this.activeSessions.get(message.sessionId);
                if (!session) {
                    connection.ws.send(JSON.stringify({ type: 'error', message: 'Session not found' }));
                    return;
                }
                // Enforce ACL: user must be creator or in allowedParticipants
                const aclDefined = Array.isArray(session.allowedParticipants) && session.allowedParticipants.length > 0;
                if (aclDefined && session.createdBy !== connection.userId && !session.allowedParticipants.includes(connection.userId)) {
                    this.logAuditEvent('WS_SESSION_ACCESS_DENIED', { sessionId: session.id, userId: connection.userId });
                    connection.ws.send(JSON.stringify({ type: 'error', message: 'Access denied to session' }));
                    return;
                }
                // Ensure participant exists or add
                if (!session.participants.some(p => p.userId === connection.userId)) {
                    if (session.participants.length >= session.maxParticipants) {
                        connection.ws.send(JSON.stringify({ type: 'error', message: 'Session full' }));
                        return;
                    }
                    session.participants.push({
                        userId: connection.userId,
                        role: 'participant',
                        joinedAt: new Date().toISOString(),
                        status: 'connected'
                    });
                    this.dirty = true;
                    this.broadcastToSession(session.id, { type: 'participant_joined', userId: connection.userId, participantCount: session.participants.length });
                }
                connection.sessionId = session.id;
                connection.ws.send(JSON.stringify({ type: 'session_joined', sessionId: session.id }));
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
        for (const [, connection] of this.connections) {
            if (connection.sessionId === sessionId && connection.authenticated) {
                try { connection.ws.send(JSON.stringify(message)); } catch {}
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
        // In production, validate JWT signature; here basic length check
        return token && token.length > 20;
    }

    /**
     * Parse a bearer/JWT-like token into a minimal identity (demo only)
     */
    parseToken(token) {
        if (!this.isValidToken(token)) return null;
        // Attempt JWT decode (no signature verify in demo)
        try {
            if (token.split('.').length === 3) {
                const payloadB64 = token.split('.')[1];
                const json = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));
                const userId = json.sub || json.userId || json.email || json.preferred_username || 'user';
                return { userId };
            }
        } catch { /* ignore decode errors */ }
        // Fallback: derive pseudo id from prefix of hash
        return { userId: 'user_' + token.slice(0,8) };
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

    /** Persist sessions and messages to disk (simplistic JSON) */
    persistState(){
        try {
            const data = {
                sessions: Array.from(this.activeSessions.values()),
                messages: Array.from(this.messageHistory.entries()).map(([k,v])=>({ key:k, messages:v }))
            };
            fs.writeFileSync(this.persistencePath, JSON.stringify(data,null,2));
            this.dirty = false;
            this.logAuditEvent('STATE_PERSISTED', { sessions: data.sessions.length, buckets: data.messages.length });
        } catch(e){ console.warn('Persist failed:', e.message); }
    }
    loadPersistedState(){
        try {
            if(!fs.existsSync(this.persistencePath)) return;
            const raw = fs.readFileSync(this.persistencePath,'utf8');
            const data = JSON.parse(raw);
            (data.sessions||[]).forEach(s=> this.activeSessions.set(s.id, s));
            (data.messages||[]).forEach(bucket=> this.messageHistory.set(bucket.key, bucket.messages));
            this.logAuditEvent('STATE_LOADED', { sessions: this.activeSessions.size, buckets: this.messageHistory.size });
        } catch(e){ console.warn('Load persisted state failed:', e.message); }
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