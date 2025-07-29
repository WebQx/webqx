/**
 * SSO Integration Service
 * Main service that orchestrates OAuth2, SAML, RBAC, session management, and audit logging
 */

const { OAuth2AuthService } = require('./oauth2/oauth2-plugin');
const { SAMLAuthService } = require('./saml/saml-plugin');
const sessionManager = require('./session/session-manager');
const rbacManager = require('./rbac/rbac-manager');
const auditLogger = require('./audit/audit-logger');
const { getEnabledProviders } = require('./sso-config');

/**
 * SSO Integration Service Class
 */
class SSOIntegrationService {
    constructor() {
        this.oauth2Service = new OAuth2AuthService();
        this.samlService = new SAMLAuthService();
        this.isInitialized = false;
        
        this.initialize();
    }

    /**
     * Initialize the SSO service
     */
    initialize() {
        try {
            const enabledProviders = getEnabledProviders();
            
            console.log('🔐 Initializing WebQX SSO Integration Service...');
            console.log(`📋 OAuth2 Providers: ${enabledProviders.oauth2.join(', ') || 'None'}`);
            console.log(`📋 SAML Providers: ${enabledProviders.saml.join(', ') || 'None'}`);
            
            this.isInitialized = true;
            
            auditLogger.logSuccess('sso_service_initialized', {
                oauth2Providers: enabledProviders.oauth2,
                samlProviders: enabledProviders.saml,
                timestamp: new Date().toISOString()
            });

            console.log('✅ SSO Integration Service initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize SSO Integration Service:', error);
            auditLogger.logFailure('sso_service_initialization_failed', {
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Get all available authentication providers
     * @returns {Object} Available providers by type
     */
    getAvailableProviders() {
        return {
            oauth2: this.oauth2Service.getAvailableProviders(),
            saml: this.samlService.getAvailableProviders()
        };
    }

    /**
     * Start authentication flow
     * @param {string} type - Authentication type ('oauth2' or 'saml')
     * @param {string} provider - Provider name
     * @param {Object} options - Authentication options
     * @returns {Object} Authentication flow details
     */
    startAuthFlow(type, provider, options = {}) {
        if (!this.isInitialized) {
            throw new Error('SSO service not initialized');
        }

        let authFlow;
        
        try {
            if (type === 'oauth2') {
                authFlow = this.oauth2Service.startAuthFlow(provider, options);
            } else if (type === 'saml') {
                authFlow = this.samlService.startAuthFlow(provider, options);
            } else {
                throw new Error(`Unsupported authentication type: ${type}`);
            }

            auditLogger.logInfo('auth_flow_started', {
                type: type,
                provider: provider,
                flowId: authFlow.state || authFlow.relayState,
                ip: options.ip,
                userAgent: options.userAgent,
                timestamp: new Date().toISOString()
            });

            return {
                ...authFlow,
                type: type
            };
        } catch (error) {
            auditLogger.logFailure('auth_flow_start_failed', {
                type: type,
                provider: provider,
                error: error.message,
                ip: options.ip,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    /**
     * Handle authentication callback
     * @param {string} type - Authentication type
     * @param {Object} callbackData - Callback data
     * @param {Object} requestData - Request metadata
     * @returns {Promise<Object>} Complete authentication result
     */
    async handleAuthCallback(type, callbackData, requestData = {}) {
        if (!this.isInitialized) {
            throw new Error('SSO service not initialized');
        }

        let authResult;
        
        try {
            // Process authentication based on type
            if (type === 'oauth2') {
                authResult = await this.oauth2Service.handleCallback(
                    callbackData.code,
                    callbackData.state,
                    callbackData.error
                );
            } else if (type === 'saml') {
                authResult = await this.samlService.handleCallback(
                    callbackData.SAMLResponse,
                    callbackData.RelayState
                );
            } else {
                throw new Error(`Unsupported authentication type: ${type}`);
            }

            if (!authResult.success) {
                throw new Error('Authentication failed');
            }

            // Map roles using RBAC manager
            const roleMappingResult = rbacManager.mapExternalRoles(
                authResult.user.roles || [authResult.user.role],
                authResult.provider
            );

            // Update user with mapped roles
            authResult.user.role = roleMappingResult.primaryRole;
            authResult.user.roles = roleMappingResult.allRoles;

            // Create session
            const sessionInfo = sessionManager.createSession(authResult.user, {
                provider: authResult.provider,
                providerUserId: authResult.user.providerUserId,
                sessionIndex: authResult.user.sessionIndex,
                loginMethod: type,
                ip: requestData.ip,
                userAgent: requestData.userAgent,
                location: requestData.location
            });

            // Generate WebQX JWT token
            const webqxToken = await this.generateWebQXToken(authResult.user, sessionInfo);

            auditLogger.logSuccess('auth_callback_completed', {
                type: type,
                provider: authResult.provider,
                userId: authResult.user.id,
                email: authResult.user.email,
                role: authResult.user.role,
                sessionId: sessionInfo.sessionId,
                ip: requestData.ip,
                timestamp: new Date().toISOString()
            });

            return {
                success: true,
                user: authResult.user,
                session: sessionInfo,
                token: webqxToken,
                provider: authResult.provider,
                type: type,
                returnUrl: authResult.returnUrl,
                roleMappingResult: roleMappingResult
            };

        } catch (error) {
            auditLogger.logFailure('auth_callback_failed', {
                type: type,
                error: error.message,
                ip: requestData.ip,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    /**
     * Validate session and check permissions
     * @param {string} sessionId - Session ID
     * @param {string} resource - Resource being accessed
     * @param {string} action - Action being performed
     * @param {Object} requestData - Request metadata
     * @returns {Object} Validation result
     */
    validateSessionAndPermissions(sessionId, resource, action, requestData = {}) {
        try {
            // Validate session
            const sessionValidation = sessionManager.validateSession(sessionId, requestData);
            
            if (!sessionValidation.valid) {
                auditLogger.logFailure('session_validation_failed', {
                    sessionId: sessionId,
                    reason: sessionValidation.reason,
                    resource: resource,
                    action: action,
                    ip: requestData.ip,
                    timestamp: new Date().toISOString()
                });
                return sessionValidation;
            }

            const user = sessionValidation.session;

            // Check permissions
            const permissionCheck = rbacManager.checkPermission(user, resource, action, requestData);
            
            if (!permissionCheck.granted) {
                auditLogger.logFailure('permission_denied', {
                    sessionId: sessionId,
                    userId: user.userId,
                    resource: resource,
                    action: action,
                    reason: permissionCheck.reason,
                    ip: requestData.ip,
                    timestamp: new Date().toISOString()
                });
            }

            return {
                valid: sessionValidation.valid,
                granted: permissionCheck.granted,
                session: sessionValidation.session,
                permission: permissionCheck,
                needsRenewal: sessionValidation.needsRenewal,
                timeUntilExpiry: sessionValidation.timeUntilExpiry
            };

        } catch (error) {
            auditLogger.logFailure('validation_error', {
                sessionId: sessionId,
                resource: resource,
                action: action,
                error: error.message,
                ip: requestData.ip,
                timestamp: new Date().toISOString()
            });
            
            return {
                valid: false,
                granted: false,
                error: error.message
            };
        }
    }

    /**
     * Renew session
     * @param {string} sessionId - Session ID
     * @param {Object} requestData - Request metadata
     * @returns {Object} Renewal result
     */
    renewSession(sessionId, requestData = {}) {
        try {
            const renewalResult = sessionManager.renewSession(sessionId, requestData);
            
            if (renewalResult.success) {
                auditLogger.logSuccess('session_renewed', {
                    sessionId: sessionId,
                    newExpiresAt: new Date(renewalResult.expiresAt).toISOString(),
                    ip: requestData.ip,
                    timestamp: new Date().toISOString()
                });
            }

            return renewalResult;
        } catch (error) {
            auditLogger.logFailure('session_renewal_failed', {
                sessionId: sessionId,
                error: error.message,
                ip: requestData.ip,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    /**
     * Handle logout
     * @param {string} sessionId - Session ID
     * @param {Object} options - Logout options
     * @param {Object} requestData - Request metadata
     * @returns {Promise<Object>} Logout result
     */
    async handleLogout(sessionId, options = {}, requestData = {}) {
        try {
            const logoutResult = await sessionManager.handleSecureLogout(sessionId, {
                ...options,
                requestData: requestData
            });

            if (logoutResult.success && logoutResult.requiresExternalLogout) {
                // Handle external SSO logout if needed
                const externalLogoutInfo = await this.handleExternalLogout(
                    logoutResult.provider,
                    logoutResult.providerUserId,
                    logoutResult.sessionIndex
                );
                
                logoutResult.externalLogout = externalLogoutInfo;
            }

            auditLogger.logSuccess('logout_completed', {
                sessionId: sessionId,
                userId: logoutResult.userId,
                provider: logoutResult.provider,
                logoutAllDevices: options.logoutAllDevices || false,
                externalLogout: logoutResult.requiresExternalLogout,
                ip: requestData.ip,
                timestamp: new Date().toISOString()
            });

            return logoutResult;
        } catch (error) {
            auditLogger.logFailure('logout_failed', {
                sessionId: sessionId,
                error: error.message,
                ip: requestData.ip,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    /**
     * Handle external SSO logout
     * @param {string} provider - Provider name
     * @param {string} providerUserId - Provider user ID
     * @param {string} sessionIndex - Session index (for SAML)
     * @returns {Promise<Object>} External logout info
     */
    async handleExternalLogout(provider, providerUserId, sessionIndex) {
        try {
            // For SAML providers, generate logout request
            if (sessionIndex) {
                const logoutRequest = this.samlService.generateLogoutRequest(
                    provider,
                    providerUserId,
                    sessionIndex
                );
                return {
                    type: 'saml',
                    logoutUrl: logoutRequest.logoutUrl,
                    requestId: logoutRequest.requestId
                };
            }

            // For OAuth2 providers, return logout URL
            return {
                type: 'oauth2',
                logoutUrl: this.getOAuth2LogoutUrl(provider),
                message: 'Please complete logout at identity provider'
            };
        } catch (error) {
            console.warn('Failed to generate external logout:', error);
            return {
                type: 'manual',
                message: 'Please manually logout from your identity provider'
            };
        }
    }

    /**
     * Get OAuth2 logout URL
     * @param {string} provider - Provider name
     * @returns {string} Logout URL
     */
    getOAuth2LogoutUrl(provider) {
        const logoutUrls = {
            'google': 'https://accounts.google.com/logout',
            'microsoft': 'https://login.microsoftonline.com/common/oauth2/v2.0/logout',
            'okta': 'https://dev-example.okta.com/login/signout'
        };

        return logoutUrls[provider] || null;
    }

    /**
     * Generate WebQX JWT token
     * @param {Object} user - User information
     * @param {Object} sessionInfo - Session information
     * @returns {Promise<string>} JWT token
     */
    async generateWebQXToken(user, sessionInfo) {
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'webqx-fhir-secret-key-change-in-production';

        const payload = {
            sessionId: sessionInfo.sessionId,
            userId: user.id,
            email: user.email,
            role: user.role,
            roles: user.roles,
            provider: user.provider,
            scopes: this.generateFHIRScopes(user),
            iss: 'webqx-sso-service',
            aud: 'webqx-fhir-api',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(sessionInfo.expiresAt / 1000)
        };

        return jwt.sign(payload, JWT_SECRET);
    }

    /**
     * Generate FHIR scopes based on user role
     * @param {Object} user - User information
     * @returns {Array} FHIR scopes
     */
    generateFHIRScopes(user) {
        const roleScopeMapping = {
            'admin': ['*'],
            'physician': ['patient/*.read', 'patient/*.write', 'user/*.read'],
            'nurse': ['patient/*.read', 'patient/*.write', 'user/*.read'],
            'patient': ['patient/*.read'],
            'staff': ['patient/*.read', 'user/*.read'],
            'pharmacist': ['patient/*.read', 'user/*.read'],
            'technician': ['patient/*.read']
        };

        return roleScopeMapping[user.role] || ['patient/*.read'];
    }

    /**
     * Get authentication statistics
     * @returns {Object} Authentication statistics
     */
    getAuthStats() {
        const sessionStats = sessionManager.getSessionStats();
        const roleStats = rbacManager.getRoleStats();
        const auditStats = auditLogger.getAuditStats();
        const securityAlerts = auditLogger.getSecurityAlerts();

        return {
            sessions: sessionStats,
            roles: roleStats,
            audit: auditStats,
            security: {
                alerts: securityAlerts.length,
                recentAlerts: securityAlerts.slice(0, 5)
            },
            providers: this.getAvailableProviders(),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get SSO configuration status
     * @returns {Object} Configuration status
     */
    getConfigurationStatus() {
        const enabledProviders = getEnabledProviders();
        
        return {
            initialized: this.isInitialized,
            oauth2: {
                enabled: enabledProviders.oauth2.length > 0,
                providers: enabledProviders.oauth2,
                available: this.oauth2Service.getAvailableProviders()
            },
            saml: {
                enabled: enabledProviders.saml.length > 0,
                providers: enabledProviders.saml,
                available: this.samlService.getAvailableProviders()
            },
            features: {
                sessionManagement: true,
                rbac: true,
                auditLogging: true,
                multiProvider: true
            }
        };
    }

    /**
     * Health check for SSO service
     * @returns {Object} Health status
     */
    healthCheck() {
        const status = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                oauth2: 'healthy',
                saml: 'healthy',
                sessionManager: 'healthy',
                rbacManager: 'healthy',
                auditLogger: 'healthy'
            }
        };

        try {
            // Test each service
            this.oauth2Service.getAvailableProviders();
            this.samlService.getAvailableProviders();
            sessionManager.getSessionStats();
            rbacManager.getRoleStats();
            auditLogger.getAuditStats();
        } catch (error) {
            status.status = 'unhealthy';
            status.error = error.message;
        }

        return status;
    }
}

// Create singleton instance
const ssoIntegrationService = new SSOIntegrationService();

module.exports = ssoIntegrationService;