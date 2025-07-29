/**
 * SSO API Routes
 * Express routes for SSO authentication endpoints
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const ssoService = require('../plugins/sso-integration-service');
const auditLogger = require('../plugins/audit/audit-logger');

const router = express.Router();

// Rate limiting for authentication endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per windowMs
    message: {
        error: 'Too many authentication attempts, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Apply rate limiting to auth routes
router.use('/auth/', authLimiter);

/**
 * Get available SSO providers
 */
router.get('/providers', (req, res) => {
    try {
        const providers = ssoService.getAvailableProviders();
        const configStatus = ssoService.getConfigurationStatus();
        
        res.json({
            success: true,
            providers: providers,
            configuration: configStatus,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve providers',
            details: error.message
        });
    }
});

/**
 * Start OAuth2 authentication flow
 */
router.post('/auth/oauth2/:provider', (req, res) => {
    try {
        const { provider } = req.params;
        const { returnUrl, scopes } = req.body;
        
        const requestData = {
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            returnUrl: returnUrl
        };

        const authFlow = ssoService.startAuthFlow('oauth2', provider, {
            returnUrl: returnUrl,
            scopes: scopes,
            ...requestData
        });

        res.json({
            success: true,
            authUrl: authFlow.authUrl,
            state: authFlow.state,
            provider: authFlow.provider,
            type: 'oauth2'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: 'Failed to start OAuth2 authentication',
            details: error.message
        });
    }
});

/**
 * Start SAML authentication flow
 */
router.post('/auth/saml/:provider', (req, res) => {
    try {
        const { provider } = req.params;
        const { returnUrl } = req.body;
        
        const requestData = {
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            returnUrl: returnUrl
        };

        const authFlow = ssoService.startAuthFlow('saml', provider, {
            returnUrl: returnUrl,
            ...requestData
        });

        res.json({
            success: true,
            authUrl: authFlow.authUrl,
            relayState: authFlow.relayState,
            requestId: authFlow.requestId,
            provider: provider,
            type: 'saml'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: 'Failed to start SAML authentication',
            details: error.message
        });
    }
});

/**
 * Handle OAuth2 callback
 */
router.get('/auth/oauth2/:provider/callback', async (req, res) => {
    try {
        const { provider } = req.params;
        const { code, state, error } = req.query;
        
        const requestData = {
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent')
        };

        const authResult = await ssoService.handleAuthCallback('oauth2', {
            code,
            state,
            error
        }, requestData);

        if (authResult.success) {
            // Set secure session cookie
            res.cookie('webqx_session', authResult.session.sessionId, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 8 * 60 * 60 * 1000 // 8 hours
            });

            // Redirect to return URL or default dashboard
            const returnUrl = authResult.returnUrl || '/dashboard';
            res.redirect(`${returnUrl}?auth=success&provider=${provider}`);
        } else {
            res.redirect(`/login?error=auth_failed&provider=${provider}`);
        }
    } catch (error) {
        console.error('OAuth2 callback error:', error);
        res.redirect(`/login?error=auth_error&details=${encodeURIComponent(error.message)}`);
    }
});

/**
 * Handle SAML callback
 */
router.post('/auth/saml/:provider/callback', async (req, res) => {
    try {
        const { provider } = req.params;
        const { SAMLResponse, RelayState } = req.body;
        
        const requestData = {
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent')
        };

        const authResult = await ssoService.handleAuthCallback('saml', {
            SAMLResponse,
            RelayState
        }, requestData);

        if (authResult.success) {
            // Set secure session cookie
            res.cookie('webqx_session', authResult.session.sessionId, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 8 * 60 * 60 * 1000 // 8 hours
            });

            // Redirect to return URL or default dashboard
            const returnUrl = authResult.returnUrl || '/dashboard';
            res.redirect(`${returnUrl}?auth=success&provider=${provider}`);
        } else {
            res.redirect(`/login?error=auth_failed&provider=${provider}`);
        }
    } catch (error) {
        console.error('SAML callback error:', error);
        res.redirect(`/login?error=auth_error&details=${encodeURIComponent(error.message)}`);
    }
});

/**
 * Validate session and get user info
 */
router.get('/session/validate', (req, res) => {
    try {
        const sessionId = req.cookies.webqx_session || req.headers['x-session-id'];
        
        if (!sessionId) {
            return res.status(401).json({
                valid: false,
                error: 'No session ID provided'
            });
        }

        const requestData = {
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent')
        };

        const validation = ssoService.validateSessionAndPermissions(
            sessionId,
            'Session',
            'read',
            requestData
        );

        if (validation.valid) {
            res.json({
                valid: true,
                user: validation.session,
                needsRenewal: validation.needsRenewal,
                timeUntilExpiry: validation.timeUntilExpiry
            });
        } else {
            res.status(401).json({
                valid: false,
                reason: validation.session?.reason || 'Invalid session'
            });
        }
    } catch (error) {
        res.status(500).json({
            valid: false,
            error: 'Session validation error',
            details: error.message
        });
    }
});

/**
 * Renew session
 */
router.post('/session/renew', (req, res) => {
    try {
        const sessionId = req.cookies.webqx_session || req.headers['x-session-id'];
        
        if (!sessionId) {
            return res.status(401).json({
                success: false,
                error: 'No session ID provided'
            });
        }

        const requestData = {
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent')
        };

        const renewalResult = ssoService.renewSession(sessionId, requestData);
        
        res.json(renewalResult);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Session renewal error',
            details: error.message
        });
    }
});

/**
 * Logout
 */
router.post('/auth/logout', async (req, res) => {
    try {
        const sessionId = req.cookies.webqx_session || req.headers['x-session-id'];
        const { logoutAllDevices } = req.body;
        
        if (!sessionId) {
            return res.status(401).json({
                success: false,
                error: 'No session ID provided'
            });
        }

        const requestData = {
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent')
        };

        const logoutResult = await ssoService.handleLogout(sessionId, {
            logoutAllDevices: logoutAllDevices
        }, requestData);

        // Clear session cookie
        res.clearCookie('webqx_session');

        res.json({
            success: true,
            externalLogout: logoutResult.externalLogout,
            message: 'Logout successful'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Logout error',
            details: error.message
        });
    }
});

/**
 * Check permissions for resource access
 */
router.post('/permissions/check', (req, res) => {
    try {
        const sessionId = req.cookies.webqx_session || req.headers['x-session-id'];
        const { resource, action } = req.body;
        
        if (!sessionId) {
            return res.status(401).json({
                granted: false,
                error: 'No session ID provided'
            });
        }

        const requestData = {
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent')
        };

        const validation = ssoService.validateSessionAndPermissions(
            sessionId,
            resource,
            action,
            requestData
        );

        res.json({
            granted: validation.granted,
            valid: validation.valid,
            permission: validation.permission,
            session: validation.session
        });
    } catch (error) {
        res.status(500).json({
            granted: false,
            error: 'Permission check error',
            details: error.message
        });
    }
});

/**
 * Get SAML metadata for a provider
 */
router.get('/saml/:provider/metadata', (req, res) => {
    try {
        const { provider } = req.params;
        const metadata = ssoService.samlService.getSPMetadata(provider);
        
        res.set('Content-Type', 'application/xml');
        res.send(metadata);
    } catch (error) {
        res.status(404).json({
            success: false,
            error: 'Metadata not found',
            details: error.message
        });
    }
});

/**
 * Get authentication statistics (admin only)
 */
router.get('/admin/stats', (req, res) => {
    try {
        const sessionId = req.cookies.webqx_session || req.headers['x-session-id'];
        
        if (!sessionId) {
            return res.status(401).json({
                error: 'Authentication required'
            });
        }

        const requestData = {
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent')
        };

        // Check admin permissions
        const validation = ssoService.validateSessionAndPermissions(
            sessionId,
            'Administration',
            'read',
            requestData
        );

        if (!validation.granted) {
            return res.status(403).json({
                error: 'Insufficient permissions'
            });
        }

        const stats = ssoService.getAuthStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to retrieve statistics',
            details: error.message
        });
    }
});

/**
 * Get audit logs (admin only)
 */
router.get('/admin/audit', (req, res) => {
    try {
        const sessionId = req.cookies.webqx_session || req.headers['x-session-id'];
        const { timeWindow, eventType, level } = req.query;
        
        if (!sessionId) {
            return res.status(401).json({
                error: 'Authentication required'
            });
        }

        const requestData = {
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent')
        };

        // Check admin permissions
        const validation = ssoService.validateSessionAndPermissions(
            sessionId,
            'AuditLog',
            'read',
            requestData
        );

        if (!validation.granted) {
            return res.status(403).json({
                error: 'Insufficient permissions'
            });
        }

        const auditStats = auditLogger.getAuditStats({ 
            timeWindow: parseInt(timeWindow) || 24 
        });
        const securityAlerts = auditLogger.getSecurityAlerts({ 
            timeWindow: parseInt(timeWindow) || 24 
        });

        res.json({
            stats: auditStats,
            securityAlerts: securityAlerts,
            filters: {
                timeWindow: timeWindow || 24,
                eventType: eventType,
                level: level
            }
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to retrieve audit logs',
            details: error.message
        });
    }
});

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
    try {
        const health = ssoService.healthCheck();
        res.json(health);
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Configuration status endpoint
 */
router.get('/config/status', (req, res) => {
    try {
        const status = ssoService.getConfigurationStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to retrieve configuration status',
            details: error.message
        });
    }
});

module.exports = router;