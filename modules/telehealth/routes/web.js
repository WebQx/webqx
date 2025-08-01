const express = require('express');
const path = require('path');
const TelehealthSessionService = require('../services/sessionService');

const router = express.Router();
const sessionService = new TelehealthSessionService();

/**
 * Telehealth session join page - displays consent form
 * GET /telehealth/join?access=<token>
 */
router.get('/join', async (req, res) => {
    try {
        const { access: accessToken } = req.query;

        if (!accessToken) {
            return res.status(400).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Invalid Link - WebQX Telehealth</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
                        .error-container { background: white; padding: 40px; border-radius: 10px; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        .error-icon { font-size: 48px; margin-bottom: 20px; }
                        h1 { color: #e53e3e; margin-bottom: 20px; }
                        p { color: #666; line-height: 1.6; }
                        .btn { background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
                    </style>
                </head>
                <body>
                    <div class="error-container">
                        <div class="error-icon">❌</div>
                        <h1>Invalid Session Link</h1>
                        <p>The telehealth session link you used is invalid or malformed.</p>
                        <p>Please contact your healthcare provider for a new session link.</p>
                        <a href="/" class="btn">Return to Home</a>
                    </div>
                </body>
                </html>
            `);
        }

        // Validate the session access token
        const validation = await sessionService.validateSessionAccess(accessToken);
        
        if (!validation.valid) {
            let errorMessage = 'This session link is no longer valid.';
            let errorDetails = '';
            
            switch (validation.code) {
                case 'LINK_EXPIRED':
                    errorMessage = 'Session Link Expired';
                    errorDetails = 'This telehealth session link has expired. Please contact your healthcare provider for a new link.';
                    break;
                case 'SESSION_NOT_FOUND':
                    errorMessage = 'Session Not Found';
                    errorDetails = 'The telehealth session could not be found. Please verify the link or contact your healthcare provider.';
                    break;
                case 'SESSION_ENDED':
                    errorMessage = 'Session Ended';
                    errorDetails = 'This telehealth session has already ended.';
                    break;
                case 'INVALID_TOKEN':
                    errorMessage = 'Invalid Access';
                    errorDetails = 'The session link is invalid. Please contact your healthcare provider for assistance.';
                    break;
                default:
                    errorDetails = validation.error || 'Please contact your healthcare provider for assistance.';
            }

            return res.status(401).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${errorMessage} - WebQX Telehealth</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
                        .error-container { background: white; padding: 40px; border-radius: 10px; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        .error-icon { font-size: 48px; margin-bottom: 20px; }
                        h1 { color: #e53e3e; margin-bottom: 20px; }
                        p { color: #666; line-height: 1.6; margin-bottom: 15px; }
                        .btn { background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
                    </style>
                </head>
                <body>
                    <div class="error-container">
                        <div class="error-icon">⏰</div>
                        <h1>${errorMessage}</h1>
                        <p>${errorDetails}</p>
                        <a href="/" class="btn">Return to Home</a>
                    </div>
                </body>
                </html>
            `);
        }

        // If consent is already given, redirect to session
        if (validation.session.consentStatus === 'given') {
            return res.redirect(`/telehealth/session?token=${encodeURIComponent(accessToken)}`);
        }

        // Serve the consent page
        const consentPagePath = path.join(__dirname, '..', 'components', 'consent.html');
        
        // Read the consent page and inject session data
        const fs = require('fs');
        let consentPage = fs.readFileSync(consentPagePath, 'utf8');
        
        // Inject session data into the page
        const sessionDataScript = `
            <script>
                window.SESSION_DATA = ${JSON.stringify({
                    sessionId: validation.session.id,
                    providerName: 'Healthcare Provider', // TODO: Get from actual provider data
                    sessionType: validation.session.sessionType || 'Consultation',
                    specialty: validation.session.specialty,
                    scheduledTime: new Date().toLocaleString() // TODO: Get actual scheduled time
                })};
            </script>
        `;
        
        // Insert the script before the closing head tag
        consentPage = consentPage.replace('</head>', sessionDataScript + '</head>');
        
        res.send(consentPage);

    } catch (error) {
        console.error('[Telehealth Web] Join page error:', error);
        res.status(500).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Error - WebQX Telehealth</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
                    .error-container { background: white; padding: 40px; border-radius: 10px; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .error-icon { font-size: 48px; margin-bottom: 20px; }
                    h1 { color: #e53e3e; margin-bottom: 20px; }
                    p { color: #666; line-height: 1.6; }
                    .btn { background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="error-container">
                    <div class="error-icon">⚠️</div>
                    <h1>System Error</h1>
                    <p>An error occurred while processing your request. Please try again later or contact support.</p>
                    <a href="/" class="btn">Return to Home</a>
                </div>
            </body>
            </html>
        `);
    }
});

/**
 * Telehealth session interface - the actual video session
 * GET /telehealth/session?token=<token>
 */
router.get('/session', async (req, res) => {
    try {
        const { token: accessToken } = req.query;

        if (!accessToken) {
            return res.redirect('/telehealth/join');
        }

        // Validate the session access token
        const validation = await sessionService.validateSessionAccess(accessToken);
        
        if (!validation.valid) {
            return res.redirect(`/telehealth/join?access=${encodeURIComponent(accessToken)}`);
        }

        // Check if consent is required and not given
        if (validation.session.consentRequired && validation.session.consentStatus !== 'given') {
            return res.redirect(`/telehealth/join?access=${encodeURIComponent(accessToken)}`);
        }

        // Serve the telehealth session interface
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Telehealth Session - WebQX</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        background: #1a1a1a;
                        color: white;
                        height: 100vh;
                        overflow: hidden;
                    }
                    .session-container {
                        display: flex;
                        flex-direction: column;
                        height: 100vh;
                    }
                    .session-header {
                        background: #2563eb;
                        padding: 15px 20px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        flex-shrink: 0;
                    }
                    .session-info h1 {
                        font-size: 18px;
                        margin-bottom: 5px;
                    }
                    .session-info p {
                        font-size: 14px;
                        opacity: 0.9;
                    }
                    .session-status {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .status-indicator {
                        width: 12px;
                        height: 12px;
                        border-radius: 50%;
                        background: #16a34a;
                        animation: pulse 2s infinite;
                    }
                    @keyframes pulse {
                        0% { transform: scale(1); }
                        50% { transform: scale(1.2); }
                        100% { transform: scale(1); }
                    }
                    .video-area {
                        flex: 1;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        background: #0f172a;
                        position: relative;
                    }
                    .video-placeholder {
                        text-align: center;
                        color: #64748b;
                    }
                    .video-placeholder h2 {
                        font-size: 24px;
                        margin-bottom: 15px;
                    }
                    .video-placeholder p {
                        font-size: 16px;
                        margin-bottom: 10px;
                    }
                    .session-controls {
                        background: #1e293b;
                        padding: 20px;
                        display: flex;
                        justify-content: center;
                        gap: 15px;
                        flex-shrink: 0;
                    }
                    .control-btn {
                        padding: 12px 24px;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 600;
                        transition: all 0.3s;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    .btn-primary {
                        background: #16a34a;
                        color: white;
                    }
                    .btn-primary:hover {
                        background: #15803d;
                    }
                    .btn-danger {
                        background: #dc2626;
                        color: white;
                    }
                    .btn-danger:hover {
                        background: #b91c1c;
                    }
                    .btn-secondary {
                        background: #475569;
                        color: white;
                    }
                    .btn-secondary:hover {
                        background: #334155;
                    }
                    .loading {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .spinner {
                        width: 20px;
                        height: 20px;
                        border: 2px solid #64748b;
                        border-top: 2px solid #2563eb;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            </head>
            <body>
                <div class="session-container">
                    <div class="session-header">
                        <div class="session-info">
                            <h1>🏥 WebQX Telehealth Session</h1>
                            <p>Session ID: ${validation.session.id}</p>
                        </div>
                        <div class="session-status">
                            <div class="status-indicator"></div>
                            <span>Connected</span>
                        </div>
                    </div>
                    
                    <div class="video-area">
                        <div class="video-placeholder">
                            <h2>📹 Video Session Ready</h2>
                            <p>This is a demonstration interface for the telehealth session.</p>
                            <p>In a production environment, this would integrate with video conferencing technology.</p>
                            <div class="loading" style="justify-content: center; margin-top: 20px;">
                                <div class="spinner"></div>
                                <span>Connecting to video session...</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="session-controls">
                        <button class="control-btn btn-primary" onclick="startSession()">
                            ▶️ Start Session
                        </button>
                        <button class="control-btn btn-secondary" onclick="toggleMute()">
                            🔇 Mute
                        </button>
                        <button class="control-btn btn-secondary" onclick="toggleVideo()">
                            📹 Video Off
                        </button>
                        <button class="control-btn btn-danger" onclick="endSession()">
                            📞 End Session
                        </button>
                    </div>
                </div>

                <script>
                    const sessionData = ${JSON.stringify(validation.session)};
                    
                    async function startSession() {
                        try {
                            const response = await fetch(\`/api/telehealth/sessions/\${sessionData.id}/start\`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userId: sessionData.patientId })
                            });
                            
                            if (response.ok) {
                                alert('Session started successfully!');
                            } else {
                                alert('Failed to start session');
                            }
                        } catch (error) {
                            console.error('Error starting session:', error);
                            alert('Error starting session');
                        }
                    }
                    
                    async function endSession() {
                        if (confirm('Are you sure you want to end this session?')) {
                            try {
                                const response = await fetch(\`/api/telehealth/sessions/\${sessionData.id}/end\`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ userId: sessionData.providerId })
                                });
                                
                                if (response.ok) {
                                    alert('Session ended successfully!');
                                    window.location.href = '/';
                                } else {
                                    alert('Failed to end session');
                                }
                            } catch (error) {
                                console.error('Error ending session:', error);
                                alert('Error ending session');
                            }
                        }
                    }
                    
                    function toggleMute() {
                        alert('Mute toggle - would integrate with video conferencing API');
                    }
                    
                    function toggleVideo() {
                        alert('Video toggle - would integrate with video conferencing API');
                    }
                    
                    // Auto-logout for security
                    setTimeout(() => {
                        alert('Session timed out for security. Redirecting...');
                        window.location.href = '/';
                    }, 2 * 60 * 60 * 1000); // 2 hours
                </script>
            </body>
            </html>
        `);

    } catch (error) {
        console.error('[Telehealth Web] Session page error:', error);
        res.status(500).send('An error occurred. Please try again later.');
    }
});

module.exports = router;