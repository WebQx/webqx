/**
 * OAuth2 Module Index
 * Main entry point for OAuth2 functionality in WebQx platform
 */

const OAuth2Client = require('./client');
const TokenValidator = require('./tokenValidator');
const RBACManager = require('./rbac');
const OAuth2Middleware = require('./middleware');
const { getConfig, validateConfig, updateConfig } = require('./config');

/**
 * Create and configure OAuth2 instance
 * @param {Object} options - Configuration options
 * @returns {Object} OAuth2 instance with all components
 */
function createOAuth2Instance(options = {}) {
    // Update configuration if provided
    if (options.config) {
        updateConfig(options.config);
    }

    // Validate configuration
    const validation = validateConfig();
    if (!validation.valid) {
        throw new Error(`OAuth2 configuration error: ${validation.errors.join(', ')}`);
    }

    // Create components
    const client = new OAuth2Client();
    const tokenValidator = new TokenValidator();
    const rbacManager = new RBACManager();
    const middleware = new OAuth2Middleware();

    return {
        client,
        tokenValidator,
        rbacManager,
        middleware,
        config: getConfig(),
        
        // Convenience methods
        authenticate: middleware.authenticate.bind(middleware),
        authorize: middleware.authorize.bind(middleware),
        requireRoles: middleware.requireRoles.bind(middleware),
        
        // Endpoint creators
        createAuthorizationEndpoint: middleware.createAuthorizationEndpoint.bind(middleware),
        createCallbackEndpoint: middleware.createCallbackEndpoint.bind(middleware),
        createRefreshEndpoint: middleware.createRefreshEndpoint.bind(middleware),
        createRevocationEndpoint: middleware.createRevocationEndpoint.bind(middleware),
        createUserInfoEndpoint: middleware.createUserInfoEndpoint.bind(middleware),
        
        // Utility methods
        getStatus: middleware.getStatus.bind(middleware),
        clearCaches: middleware.clearCaches.bind(middleware)
    };
}

/**
 * Create Express router with OAuth2 endpoints
 * @param {Object} oauth2Instance - OAuth2 instance
 * @returns {Object} Express router
 */
function createOAuth2Router(oauth2Instance) {
    const express = require('express');
    const router = express.Router();

    // OAuth2 authorization flow endpoints
    router.get('/authorize', oauth2Instance.createAuthorizationEndpoint());
    router.get('/callback', oauth2Instance.createCallbackEndpoint());
    router.post('/token/refresh', oauth2Instance.createRefreshEndpoint());
    router.post('/token/revoke', oauth2Instance.createRevocationEndpoint());
    
    // User information endpoint
    router.get('/userinfo', oauth2Instance.createUserInfoEndpoint());
    
    // Status and health endpoints
    router.get('/status', (req, res) => {
        res.json(oauth2Instance.getStatus());
    });
    
    // Clear caches endpoint (development only)
    if (process.env.NODE_ENV === 'development') {
        router.post('/clear-caches', (req, res) => {
            oauth2Instance.clearCaches();
            res.json({ success: true, message: 'Caches cleared' });
        });
    }

    return router;
}

/**
 * Backward compatibility with existing FHIR auth
 * Enhances existing FHIR middleware to support OAuth2
 * @param {Object} existingAuth - Existing FHIR auth middleware
 * @param {Object} oauth2Instance - OAuth2 instance
 * @returns {Object} Enhanced auth middleware
 */
function enhanceFHIRAuth(existingAuth, oauth2Instance) {
    const originalAuthenticateToken = existingAuth.authenticateToken;
    const originalRequireScopes = existingAuth.requireScopes;

    // Enhanced token authentication that supports both existing JWT and OAuth2
    const enhancedAuthenticateToken = async (req, res, next) => {
        try {
            // Try OAuth2 authentication first
            const token = oauth2Instance.middleware.extractToken(req);
            if (token) {
                const validation = await oauth2Instance.tokenValidator.validateAccessToken(token);
                if (validation.valid) {
                    req.user = validation.userInfo;
                    req.oauth2User = true;
                    return next();
                }
            }

            // Fallback to existing FHIR auth
            return originalAuthenticateToken(req, res, next);

        } catch (error) {
            console.error('Enhanced FHIR auth error:', error);
            return originalAuthenticateToken(req, res, next);
        }
    };

    // Enhanced scope checking that works with OAuth2 permissions
    const enhancedRequireScopes = (requiredScopes) => {
        return (req, res, next) => {
            try {
                // If OAuth2 user, use RBAC permissions
                if (req.oauth2User && req.user) {
                    const authResult = oauth2Instance.rbacManager.hasAnyPermission(
                        req.user, 
                        requiredScopes,
                        oauth2Instance.middleware.extractContext(req)
                    );

                    if (!authResult.authorized) {
                        return res.status(403).json({
                            resourceType: 'OperationOutcome',
                            issue: [{
                                severity: 'error',
                                code: 'forbidden',
                                diagnostics: `Insufficient permissions. Required: ${requiredScopes.join(' or ')}`
                            }]
                        });
                    }

                    return next();
                }

                // Fallback to existing scope checking
                return originalRequireScopes(requiredScopes)(req, res, next);

            } catch (error) {
                console.error('Enhanced FHIR scope check error:', error);
                return originalRequireScopes(requiredScopes)(req, res, next);
            }
        };
    };

    return {
        ...existingAuth,
        authenticateToken: enhancedAuthenticateToken,
        requireScopes: enhancedRequireScopes,
        // Add OAuth2 specific methods
        oauth2: oauth2Instance
    };
}

/**
 * Create Express app with OAuth2 integration
 * @param {Object} options - Configuration options
 * @returns {Object} Express app with OAuth2 configured
 */
function createOAuth2App(options = {}) {
    const express = require('express');
    const app = express();

    // Create OAuth2 instance
    const oauth2 = createOAuth2Instance(options);

    // Add OAuth2 routes
    app.use('/auth/oauth2', createOAuth2Router(oauth2));

    // Add OAuth2 instance to app
    app.oauth2 = oauth2;

    return app;
}

module.exports = {
    OAuth2Client,
    TokenValidator,
    RBACManager,
    OAuth2Middleware,
    createOAuth2Instance,
    createOAuth2Router,
    createOAuth2App,
    enhanceFHIRAuth,
    getConfig,
    validateConfig,
    updateConfig
};