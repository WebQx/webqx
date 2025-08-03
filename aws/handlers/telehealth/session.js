/**
 * AWS Lambda Handler for Telehealth Session Management
 * HIPAA-compliant video consultation and messaging services
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

// Initialize AWS clients
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDB = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.AWS_REGION });

const SESSIONS_TABLE = process.env.SESSIONS_TABLE;
const TELEHEALTH_BUCKET = process.env.TELEHEALTH_BUCKET;

/**
 * CORS headers for telehealth API
 */
const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,Accept',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Cache-Control': 'no-cache, no-store, must-revalidate'
};

/**
 * Generate session ID
 */
function generateSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create audit log entry
 */
async function createAuditLog(action, sessionId, userId, details = {}) {
  const auditEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    userId: userId || 'system',
    resourceType: 'TelehealthSession',
    resourceId: sessionId,
    action,
    sourceIp: details.sourceIp,
    userAgent: details.userAgent,
    details,
    ttl: Math.floor(Date.now() / 1000) + (2555 * 24 * 60 * 60) // 7 years HIPAA retention
  };

  try {
    await dynamoDB.send(new PutCommand({
      TableName: process.env.AUDIT_LOGS_TABLE,
      Item: auditEntry
    }));
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}

/**
 * Generate WebRTC configuration
 */
function generateWebRTCConfig() {
  return {
    iceServers: [
      {
        urls: [
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302'
        ]
      },
      // In production, add TURN servers for NAT traversal
      ...(process.env.WEBRTC_TURN_SERVERS ? [{
        urls: process.env.WEBRTC_TURN_SERVERS.split(','),
        username: process.env.WEBRTC_TURN_USERNAME,
        credential: process.env.WEBRTC_TURN_PASSWORD
      }] : [])
    ],
    iceCandidatePoolSize: 10
  };
}

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  console.log('Telehealth session event:', JSON.stringify(event, null, 2));

  try {
    const { httpMethod, path, pathParameters, body, requestContext } = event;
    const userId = requestContext?.authorizer?.claims?.sub || 'anonymous';
    const sourceIp = requestContext?.identity?.sourceIp;
    const userAgent = requestContext?.identity?.userAgent;

    // Handle OPTIONS request for CORS
    if (httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: ''
      };
    }

    // Route to appropriate handler
    if (path.includes('/session') && httpMethod === 'POST' && !pathParameters?.sessionId) {
      return await createSession(JSON.parse(body || '{}'), userId, { sourceIp, userAgent });
    } else if (pathParameters?.sessionId && httpMethod === 'GET') {
      return await getSession(pathParameters.sessionId, userId, { sourceIp, userAgent });
    } else if (path.includes('/end') && httpMethod === 'POST') {
      return await endSession(pathParameters.sessionId, JSON.parse(body || '{}'), userId, { sourceIp, userAgent });
    } else if (path.includes('/join') && httpMethod === 'POST') {
      return await joinSession(pathParameters.sessionId, JSON.parse(body || '{}'), userId, { sourceIp, userAgent });
    } else if (path.includes('/leave') && httpMethod === 'POST') {
      return await leaveSession(pathParameters.sessionId, JSON.parse(body || '{}'), userId, { sourceIp, userAgent });
    } else if (path.includes('/message') && httpMethod === 'POST') {
      return await sendMessage(pathParameters.sessionId, JSON.parse(body || '{}'), userId, { sourceIp, userAgent });
    } else {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Endpoint not found' })
      };
    }

  } catch (error) {
    console.error('Error processing telehealth request:', error);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};

/**
 * Create new telehealth session
 */
async function createSession(sessionData, userId, details) {
  try {
    const { patientId, providerId, sessionType = 'video', scheduledTime, appointmentId } = sessionData;

    if (!patientId || !providerId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Patient ID and Provider ID are required' })
      };
    }

    const sessionId = generateSessionId();
    const now = new Date().toISOString();

    const session = {
      sessionId,
      patientId,
      providerId,
      sessionType,
      status: 'scheduled',
      createdAt: now,
      sessionDateTime: scheduledTime || now,
      appointmentId,
      participants: [],
      messages: [],
      webrtcConfig: generateWebRTCConfig(),
      settings: {
        recordingEnabled: false,
        chatEnabled: true,
        screenShareEnabled: true,
        maxParticipants: 5
      },
      metadata: {
        createdBy: userId,
        lastUpdated: now,
        version: 1
      },
      ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days retention
    };

    await dynamoDB.send(new PutCommand({
      TableName: SESSIONS_TABLE,
      Item: session,
      ConditionExpression: 'attribute_not_exists(sessionId)'
    }));

    // Create audit log
    await createAuditLog('create', sessionId, userId, details);

    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify({
        sessionId,
        status: session.status,
        webrtcConfig: session.webrtcConfig,
        joinUrl: `/telehealth/session/${sessionId}/join`,
        createdAt: session.createdAt
      })
    };

  } catch (error) {
    console.error('Error creating telehealth session:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Failed to create session',
        message: error.message
      })
    };
  }
}

/**
 * Get telehealth session details
 */
async function getSession(sessionId, userId, details) {
  try {
    const result = await dynamoDB.send(new GetCommand({
      TableName: SESSIONS_TABLE,
      Key: { sessionId }
    }));

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Session not found' })
      };
    }

    const session = result.Item;

    // Check if user has access to this session
    const hasAccess = session.patientId === userId ||
                     session.providerId === userId ||
                     session.participants.some(p => p.userId === userId) ||
                     details.isAdmin;

    if (!hasAccess) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Access denied to this session' })
      };
    }

    // Create audit log
    await createAuditLog('read', sessionId, userId, details);

    // Return session data (excluding sensitive information for non-participants)
    const responseData = {
      sessionId: session.sessionId,
      status: session.status,
      sessionType: session.sessionType,
      sessionDateTime: session.sessionDateTime,
      participants: session.participants,
      settings: session.settings,
      webrtcConfig: session.webrtcConfig,
      createdAt: session.createdAt
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(responseData)
    };

  } catch (error) {
    console.error('Error getting telehealth session:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Failed to get session',
        message: error.message
      })
    };
  }
}

/**
 * Join telehealth session
 */
async function joinSession(sessionId, joinData, userId, details) {
  try {
    const { displayName, role = 'participant' } = joinData;

    // Get current session
    const result = await dynamoDB.send(new GetCommand({
      TableName: SESSIONS_TABLE,
      Key: { sessionId }
    }));

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Session not found' })
      };
    }

    const session = result.Item;

    // Check if session is active
    if (session.status !== 'active' && session.status !== 'scheduled') {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Session is not available for joining' })
      };
    }

    // Check if user is already in session
    const existingParticipant = session.participants.find(p => p.userId === userId);
    if (existingParticipant) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'Already in session',
          participantId: existingParticipant.participantId,
          webrtcConfig: session.webrtcConfig
        })
      };
    }

    // Add participant
    const participantId = `participant-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const participant = {
      participantId,
      userId,
      displayName: displayName || 'Anonymous',
      role,
      joinedAt: new Date().toISOString(),
      status: 'connected'
    };

    const updatedParticipants = [...session.participants, participant];

    // Update session
    await dynamoDB.send(new UpdateCommand({
      TableName: SESSIONS_TABLE,
      Key: { sessionId },
      UpdateExpression: 'SET participants = :participants, #status = :status, metadata.lastUpdated = :lastUpdated',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':participants': updatedParticipants,
        ':status': 'active',
        ':lastUpdated': new Date().toISOString()
      }
    }));

    // Create audit log
    await createAuditLog('join', sessionId, userId, { ...details, displayName, role });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        participantId,
        sessionId,
        webrtcConfig: session.webrtcConfig,
        settings: session.settings,
        participants: updatedParticipants.map(p => ({
          participantId: p.participantId,
          displayName: p.displayName,
          role: p.role,
          status: p.status
        }))
      })
    };

  } catch (error) {
    console.error('Error joining telehealth session:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Failed to join session',
        message: error.message
      })
    };
  }
}

/**
 * Leave telehealth session
 */
async function leaveSession(sessionId, leaveData, userId, details) {
  try {
    // Get current session
    const result = await dynamoDB.send(new GetCommand({
      TableName: SESSIONS_TABLE,
      Key: { sessionId }
    }));

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Session not found' })
      };
    }

    const session = result.Item;

    // Remove participant
    const updatedParticipants = session.participants.filter(p => p.userId !== userId);

    // Update session
    await dynamoDB.send(new UpdateCommand({
      TableName: SESSIONS_TABLE,
      Key: { sessionId },
      UpdateExpression: 'SET participants = :participants, metadata.lastUpdated = :lastUpdated',
      ExpressionAttributeValues: {
        ':participants': updatedParticipants,
        ':lastUpdated': new Date().toISOString()
      }
    }));

    // Create audit log
    await createAuditLog('leave', sessionId, userId, details);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Left session successfully',
        remainingParticipants: updatedParticipants.length
      })
    };

  } catch (error) {
    console.error('Error leaving telehealth session:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Failed to leave session',
        message: error.message
      })
    };
  }
}

/**
 * End telehealth session
 */
async function endSession(sessionId, endData, userId, details) {
  try {
    const { summary, duration } = endData;

    // Get current session
    const result = await dynamoDB.send(new GetCommand({
      TableName: SESSIONS_TABLE,
      Key: { sessionId }
    }));

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Session not found' })
      };
    }

    const session = result.Item;

    // Check if user can end session (provider or session creator)
    if (session.providerId !== userId && session.metadata.createdBy !== userId) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Not authorized to end this session' })
      };
    }

    const endTime = new Date().toISOString();

    // Update session status
    await dynamoDB.send(new UpdateCommand({
      TableName: SESSIONS_TABLE,
      Key: { sessionId },
      UpdateExpression: 'SET #status = :status, endedAt = :endedAt, summary = :summary, duration = :duration, metadata.lastUpdated = :lastUpdated',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'completed',
        ':endedAt': endTime,
        ':summary': summary || '',
        ':duration': duration || null,
        ':lastUpdated': endTime
      }
    }));

    // Create audit log
    await createAuditLog('end', sessionId, userId, { ...details, summary, duration });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Session ended successfully',
        sessionId,
        endedAt: endTime,
        summary
      })
    };

  } catch (error) {
    console.error('Error ending telehealth session:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Failed to end session',
        message: error.message
      })
    };
  }
}

/**
 * Send message in telehealth session
 */
async function sendMessage(sessionId, messageData, userId, details) {
  try {
    const { message, messageType = 'text' } = messageData;

    if (!message || message.trim().length === 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Message content is required' })
      };
    }

    // Get current session
    const result = await dynamoDB.send(new GetCommand({
      TableName: SESSIONS_TABLE,
      Key: { sessionId }
    }));

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Session not found' })
      };
    }

    const session = result.Item;

    // Check if user is participant
    const participant = session.participants.find(p => p.userId === userId);
    if (!participant) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Not a participant in this session' })
      };
    }

    const messageObj = {
      messageId: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      userId,
      senderName: participant.displayName,
      message: message.trim(),
      messageType,
      timestamp: new Date().toISOString()
    };

    const updatedMessages = [...(session.messages || []), messageObj];

    // Update session with new message
    await dynamoDB.send(new UpdateCommand({
      TableName: SESSIONS_TABLE,
      Key: { sessionId },
      UpdateExpression: 'SET messages = :messages, metadata.lastUpdated = :lastUpdated',
      ExpressionAttributeValues: {
        ':messages': updatedMessages,
        ':lastUpdated': new Date().toISOString()
      }
    }));

    // Create audit log
    await createAuditLog('message', sessionId, userId, { ...details, messageType });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        messageId: messageObj.messageId,
        timestamp: messageObj.timestamp,
        message: 'Message sent successfully'
      })
    };

  } catch (error) {
    console.error('Error sending message:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Failed to send message',
        message: error.message
      })
    };
  }
}