/**
 * OAuth2 Middleware Integration
 * Main middleware that integrates OAuth2 client, token validation, and RBAC
 */

const OAuth2Client = require('./client');
const TokenValidator = require('./tokenValidator');
const RBACManager = require('./rbac');
const { getConfig } = require('./config');

/**
 * OAuth2 Middleware class
 */
class OAuth2Middleware {
    constructor() {
        this.config = getConfig();
        this.client = new OAuth2Client();
        this.tokenValidator = new TokenValidator();
        this.rbacManager = new RBACManager();
    }

    /**
     * Create authentication middleware
     * @param {Object} options - Middleware options
     * @returns {Function} Express middleware function
     */
    authenticate(options = {}) {
        return async (req, res, next) => {
            try {
                const {
                    skipPaths = [],
                    skipMethods = [],
                    requireAuth = true
                } = options;

                // Skip authentication for certain paths or methods
                if (skipPaths.includes(req.path) || skipMethods.includes(req.method)) {
                    return next();
                }

                // Development mode bypass
                if (process.env.NODE_ENV === 'development' && !requireAuth) {
                    req.user = this.config.development.mockUserClaims;
                    return next();
                }

                // Extract token from request
                const token = this.extractToken(req);
                if (!token) {
                    return this.sendAuthError(res, 'Authentication required', 'MISSING_TOKEN', 401);
                }

                // Validate token
                const validation = await this.tokenValidator.validateAccessToken(token);
                if (!validation.valid) {
                    return this.sendAuthError(res, validation.error, validation.errorCode, 401);
                }

                // Attach user information to request
                req.user = validation.userInfo;
                req.tokenPayload = validation.payload;
                req.tokenInfo = {
                    expiresAt: validation.expiresAt,
                    issuedAt: validation.issuedAt,
                    type: validation.tokenType
                };

                next();

            } catch (error) {
                console.error('OAuth2 authentication error:', error);
                return this.sendAuthError(res, 'Authentication failed', 'AUTH_ERROR', 500);
            }
        };
    }

    /**
     * Create authorization middleware for permissions
     * @param {string|Array<string>} permissions - Required permissions
     * @param {Object} options - Authorization options
     * @returns {Function} Express middleware function
     */
    authorize(permissions, options = {}) {
        const {
            requireAll = false, // If true, user must have ALL permissions
            contextExtractor = null // Function to extract context from request
        } = options;

        return (req, res, next) => {
            try {
                if (!req.user) {
                    return this.sendAuthError(res, 'User not authenticated', 'NOT_AUTHENTICATED', 401);
                }

                // Extract context for resource-specific authorization
                const context = contextExtractor ? contextExtractor(req) : this.extractContext(req);

                // Normalize permissions
                const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];

                // Check permissions
                let authResult;
                if (requireAll) {
                    authResult = this.rbacManager.hasAllPermissions(req.user, requiredPermissions, context);
                } else {
                    authResult = this.rbacManager.hasAnyPermission(req.user, requiredPermissions, context);
                }

                if (!authResult.authorized) {
                    return this.sendAuthError(res, authResult.reason, authResult.errorCode, 403, {
                        requiredPermissions: requiredPermissions,
                        userPermissions: this.rbacManager.getUserPermissions(req.user)
                    });
                }

                // Attach authorization info to request
                req.authz = {
                    permissions: requiredPermissions,
                    context,
                    result: authResult
                };

                next();

            } catch (error) {
                console.error('OAuth2 authorization error:', error);
                return this.sendAuthError(res, 'Authorization failed', 'AUTHZ_ERROR', 500);
            }
        };
    }

    /**
     * Create role-based authorization middleware
     * @param {string|Array<string>} roles - Required roles
     * @param {Object} options - Authorization options
     * @returns {Function} Express middleware function
     */
    requireRoles(roles, options = {}) {
        return (req, res, next) => {
            try {
                if (!req.user) {
                    return this.sendAuthError(res, 'User not authenticated', 'NOT_AUTHENTICATED', 401);
                }

                const requiredRoles = Array.isArray(roles) ? roles : [roles];
                const authResult = this.rbacManager.hasRole(req.user, requiredRoles);

                if (!authResult.authorized) {
                    return this.sendAuthError(res, authResult.reason, authResult.errorCode, 403, {
                        requiredRoles,
                        userRoles: req.user.roles
                    });
                }

                // Attach role authorization info
                req.authz = {
                    ...req.authz,
                    roles: requiredRoles,
                    roleResult: authResult
                };

                next();

            } catch (error) {
                console.error('Role authorization error:', error);
                return this.sendAuthError(res, 'Role authorization failed', 'ROLE_AUTHZ_ERROR', 500);
            }
        };
    }

    /**
     * Create OAuth2 authorization endpoint
     * @returns {Function} Express route handler
     */
    createAuthorizationEndpoint() {
        return (req, res) => {
            try {
                const {
                    scope,
                    redirect_uri,
                    state,
                    nonce
                } = req.query;

                const authUrl = this.client.generateAuthorizationUrl({
                    scope,
                    redirectUri: redirect_uri,
                    state,
                    nonce
                });

                res.redirect(authUrl.authorizationUrl);

            } catch (error) {
                console.error('Authorization endpoint error:', error);
                res.status(400).json({
                    error: 'invalid_request',
                    error_description: error.message
                });
            }
        };
    }

    /**
     * Create OAuth2 callback endpoint
     * @returns {Function} Express route handler
     */
    createCallbackEndpoint() {
        return async (req, res) => {
            try {
                const {
                    code,
                    state,
                    error,
                    error_description
                } = req.query;

                // Handle authorization errors
                if (error) {
                    return res.status(400).json({
                        error,
                        error_description: error_description || 'Authorization failed'
                    });
                }

                // Exchange code for tokens
                const tokenData = await this.client.exchangeCodeForTokens({
                    code,
                    state,
                    redirectUri: req.query.redirect_uri
                });

                // Validate the received token
                const validation = await this.tokenValidator.validateAccessToken(tokenData.access_token);
                if (!validation.valid) {
                    return res.status(400).json({
                        error: 'invalid_token',
                        error_description: validation.error
                    });
                }

                // In a real application, you might:
                // 1. Create a session
                // 2. Store tokens securely
                // 3. Redirect to the application

                res.json({
                    success: true,
                    user: validation.userInfo,
                    // Don't expose actual tokens in production
                    ...(process.env.NODE_ENV === 'development' && {
                        tokens: {
                            access_token: tokenData.access_token,
                            token_type: tokenData.token_type,
                            expires_in: tokenData.expires_in
                        }
                    })
                });

            } catch (error) {
                console.error('Callback endpoint error:', error);
                res.status(500).json({
                    error: 'server_error',
                    error_description: 'Token exchange failed'
                });
            }
        };
    }

    /**
     * Create token refresh endpoint
     * @returns {Function} Express route handler
     */
    createRefreshEndpoint() {
        return async (req, res) => {
            try {
                const { refresh_token } = req.body;

                if (!refresh_token) {
                    return res.status(400).json({
                        error: 'invalid_request',
                        error_description: 'Refresh token is required'
                    });
                }

                const tokenData = await this.client.refreshAccessToken(refresh_token);

                res.json({
                    access_token: tokenData.access_token,
                    token_type: tokenData.token_type,
                    expires_in: tokenData.expires_in,
                    ...(tokenData.refresh_token && { refresh_token: tokenData.refresh_token })
                });

            } catch (error) {
                console.error('Token refresh error:', error);
                res.status(400).json({
                    error: 'invalid_grant',
                    error_description: error.message
                });
            }
        };
    }

    /**
     * Create token revocation endpoint
     * @returns {Function} Express route handler
     */
    createRevocationEndpoint() {
        return async (req, res) => {
            try {
                const { token, token_type_hint } = req.body;

                if (!token) {
                    return res.status(400).json({
                        error: 'invalid_request',
                        error_description: 'Token is required'
                    });
                }

                const success = await this.client.revokeToken(token, token_type_hint);

                if (success) {
                    res.status(200).json({ revoked: true });
                } else {
                    res.status(400).json({
                        error: 'invalid_token',
                        error_description: 'Token revocation failed'
                    });
                }

            } catch (error) {
                console.error('Token revocation error:', error);
                res.status(500).json({
                    error: 'server_error',
                    error_description: 'Revocation failed'
                });
            }
        };
    }

    /**
     * Create user info endpoint
     * @returns {Function} Express route handler
     */
    createUserInfoEndpoint() {
        return this.authenticate({ requireAuth: true }), (req, res) => {
            try {
                // Return user information from validated token
                const userInfo = {
                    sub: req.user.userId,
                    email: req.user.email,
                    name: req.user.name,
                    roles: req.user.roles,
                    permissions: this.rbacManager.getUserPermissions(req.user),
                    // Don't expose sensitive claims
                    ...(process.env.NODE_ENV === 'development' && {
                        debug: {
                            allClaims: req.user,
                            tokenInfo: req.tokenInfo
                        }
                    })
                };

                res.json(userInfo);

            } catch (error) {
                console.error('User info endpoint error:', error);
                res.status(500).json({
                    error: 'server_error',
                    error_description: 'Failed to retrieve user information'
                });
            }
        };
    }

    /**
     * Extract token from request
     * @param {Object} req - Express request object
     * @returns {string|null} Extracted token or null
     */
    extractToken(req) {
        // Check Authorization header
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }

        // Check query parameter (not recommended for production)
        if (req.query.access_token) {
            return req.query.access_token;
        }

        // Check cookie (if using cookie-based auth)
        if (req.cookies && req.cookies.access_token) {
            return req.cookies.access_token;
        }

        return null;
    }

    /**
     * Extract context from request for authorization
     * @param {Object} req - Express request object
     * @returns {Object} Context object
     */
    extractContext(req) {
        return {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            method: req.method,
            path: req.path,
            // Extract resource IDs from URL parameters
            resourceId: req.params.id || req.params.resourceId,
            patientId: req.params.patientId || req.body.patientId,
            organizationId: req.params.organizationId || req.body.organizationId,
            // Additional context
            requestId: req.id || req.headers['x-request-id'],
            sessionId: req.sessionID
        };
    }

    /**
     * Send authentication/authorization error response
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     * @param {string} errorCode - Error code
     * @param {number} statusCode - HTTP status code
     * @param {Object} additional - Additional error details
     */
    sendAuthError(res, message, errorCode, statusCode, additional = {}) {
        const error = {
            error: errorCode,
            error_description: message,
            timestamp: new Date().toISOString(),
            ...additional
        };

        // For FHIR compatibility
        if (req.path && req.path.startsWith('/fhir')) {
            res.status(statusCode).json({
                resourceType: 'OperationOutcome',
                issue: [{
                    severity: 'error',
                    code: errorCode.toLowerCase(),
                    diagnostics: message
                }]
            });
        } else {
            res.status(statusCode).json(error);
        }
    }

    /**
     * Get OAuth2 status and statistics
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            oauth2: {
                enabled: true,
                mockMode: this.config.development.enableMockMode,
                issuer: this.config.idp.issuer
            },
            rbac: this.rbacManager.getRBACStats(),
            tokenValidator: this.tokenValidator.getValidationStats(),
            client: this.client.getClientConfig()
        };
    }

    /**
     * Clear all caches
     */
    clearCaches() {
        this.tokenValidator.clearCache();
        this.rbacManager.clearCache();
    }
}

module.exports = OAuth2Middleware;