/**
 * OAuth2 Authentication Plugin
 * Supports Google, Microsoft, and Okta identity providers
 */

const crypto = require('crypto');
const { URLSearchParams } = require('url');
const { getProviderConfig, validateProviderConfig, mapRole } = require('../sso-config');
const auditLogger = require('../audit/audit-logger');

/**
 * OAuth2 Provider implementations
 */
class OAuth2Provider {
    constructor(providerName) {
        this.providerName = providerName;
        this.config = getProviderConfig('oauth2', providerName);
        
        if (!this.config) {
            throw new Error(`OAuth2 provider '${providerName}' not found`);
        }
        
        const validation = validateProviderConfig('oauth2', providerName);
        if (!validation.valid) {
            throw new Error(`Invalid OAuth2 configuration for '${providerName}': ${validation.errors.join(', ')}`);
        }
    }

    /**
     * Generate authorization URL
     * @param {string} state - CSRF state parameter
     * @param {Array} scopes - OAuth2 scopes (optional)
     * @returns {string} Authorization URL
     */
    getAuthorizationUrl(state, scopes = null) {
        const authUrl = this.getAuthorizationEndpoint();
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            response_type: 'code',
            redirect_uri: this.config.redirectUri,
            scope: (scopes || this.config.scopes).join(' '),
            state: state
        });

        // Provider-specific parameters
        if (this.providerName === 'microsoft') {
            params.set('response_mode', 'query');
        }

        return `${authUrl}?${params.toString()}`;
    }

    /**
     * Exchange authorization code for access token
     * @param {string} code - Authorization code
     * @param {string} state - CSRF state parameter
     * @returns {Promise<Object>} Token response
     */
    async exchangeCodeForToken(code, state) {
        const tokenUrl = this.getTokenEndpoint();
        
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            code: code,
            redirect_uri: this.config.redirectUri
        });

        try {
            // In a real implementation, this would make an HTTP request
            // For now, we'll simulate the response
            const response = await this.simulateTokenExchange(code, state);
            
            auditLogger.logSuccess('oauth2_token_exchange', {
                provider: this.providerName,
                state: state,
                timestamp: new Date().toISOString()
            });

            return response;
        } catch (error) {
            auditLogger.logFailure('oauth2_token_exchange', {
                provider: this.providerName,
                error: error.message,
                state: state,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    /**
     * Get user information using access token
     * @param {string} accessToken - OAuth2 access token
     * @returns {Promise<Object>} User information
     */
    async getUserInfo(accessToken) {
        try {
            // In a real implementation, this would make an HTTP request to the user info endpoint
            // For now, we'll simulate the response
            const userInfo = await this.simulateUserInfoFetch(accessToken);
            
            auditLogger.logSuccess('oauth2_user_info', {
                provider: this.providerName,
                userId: userInfo.id,
                email: userInfo.email,
                timestamp: new Date().toISOString()
            });

            return userInfo;
        } catch (error) {
            auditLogger.logFailure('oauth2_user_info', {
                provider: this.providerName,
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    /**
     * Get authorization endpoint URL
     * @returns {string} Authorization endpoint
     */
    getAuthorizationEndpoint() {
        switch (this.providerName) {
            case 'google':
                return 'https://accounts.google.com/o/oauth2/v2/auth';
            case 'microsoft':
                return `${this.config.authority}/${this.config.tenant}/oauth2/v2.0/authorize`;
            case 'okta':
                return `https://${this.config.domain}/oauth2/v1/authorize`;
            default:
                throw new Error(`Unknown OAuth2 provider: ${this.providerName}`);
        }
    }

    /**
     * Get token endpoint URL
     * @returns {string} Token endpoint
     */
    getTokenEndpoint() {
        switch (this.providerName) {
            case 'google':
                return 'https://oauth2.googleapis.com/token';
            case 'microsoft':
                return `${this.config.authority}/${this.config.tenant}/oauth2/v2.0/token`;
            case 'okta':
                return `https://${this.config.domain}/oauth2/v1/token`;
            default:
                throw new Error(`Unknown OAuth2 provider: ${this.providerName}`);
        }
    }

    /**
     * Simulate token exchange (for demo purposes)
     * In production, this would make actual HTTP requests
     */
    async simulateTokenExchange(code, state) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 100));

        return {
            access_token: crypto.randomBytes(32).toString('hex'),
            token_type: 'Bearer',
            expires_in: 3600,
            refresh_token: crypto.randomBytes(32).toString('hex'),
            scope: this.config.scopes.join(' ')
        };
    }

    /**
     * Simulate user info fetch (for demo purposes)
     * In production, this would make actual HTTP requests
     */
    async simulateUserInfoFetch(accessToken) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 100));

        const baseUser = {
            id: crypto.randomBytes(16).toString('hex'),
            email: `demo-user@${this.providerName}-example.com`,
            verified_email: true,
            name: `Demo User (${this.providerName})`,
            given_name: 'Demo',
            family_name: 'User',
            picture: `https://via.placeholder.com/150?text=${this.providerName}`,
            locale: 'en'
        };

        // Provider-specific user information format
        switch (this.providerName) {
            case 'google':
                return {
                    ...baseUser,
                    hd: 'webqx-health.example.com' // Google Workspace domain
                };
            
            case 'microsoft':
                return {
                    ...baseUser,
                    '@odata.context': 'https://graph.microsoft.com/v1.0/$metadata#users/$entity',
                    userPrincipalName: baseUser.email,
                    displayName: baseUser.name,
                    givenName: baseUser.given_name,
                    surname: baseUser.family_name,
                    jobTitle: 'Healthcare Professional',
                    officeLocation: 'WebQX Health Demo'
                };
            
            case 'okta':
                return {
                    ...baseUser,
                    sub: baseUser.id,
                    nickname: baseUser.given_name.toLowerCase(),
                    preferred_username: baseUser.email,
                    updated_at: Math.floor(Date.now() / 1000),
                    groups: ['healthcare-users', 'patient-portal-access']
                };
            
            default:
                return baseUser;
        }
    }
}

/**
 * OAuth2 Authentication Service
 */
class OAuth2AuthService {
    constructor() {
        this.providers = new Map();
        this.stateStore = new Map(); // In production, use Redis or database
        
        // Initialize enabled providers
        this.initializeProviders();
    }

    /**
     * Initialize OAuth2 providers
     */
    initializeProviders() {
        const providerNames = ['google', 'microsoft', 'okta'];
        
        providerNames.forEach(providerName => {
            try {
                const config = getProviderConfig('oauth2', providerName);
                if (config && config.enabled) {
                    const provider = new OAuth2Provider(providerName);
                    this.providers.set(providerName, provider);
                    console.log(`OAuth2 provider '${providerName}' initialized successfully`);
                }
            } catch (error) {
                console.warn(`Failed to initialize OAuth2 provider '${providerName}':`, error.message);
            }
        });
    }

    /**
     * Get available OAuth2 providers
     * @returns {Array} List of available provider names
     */
    getAvailableProviders() {
        return Array.from(this.providers.keys());
    }

    /**
     * Start OAuth2 authentication flow
     * @param {string} providerName - Provider name
     * @param {Object} options - Authentication options
     * @returns {Object} Authentication flow details
     */
    startAuthFlow(providerName, options = {}) {
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new Error(`OAuth2 provider '${providerName}' not available`);
        }

        // Generate CSRF state
        const state = crypto.randomBytes(32).toString('hex');
        
        // Store state with metadata
        this.stateStore.set(state, {
            provider: providerName,
            timestamp: Date.now(),
            returnUrl: options.returnUrl || '/',
            scopes: options.scopes
        });

        // Clean up old states (older than 10 minutes)
        this.cleanupStates();

        const authUrl = provider.getAuthorizationUrl(state, options.scopes);

        auditLogger.logInfo('oauth2_auth_started', {
            provider: providerName,
            state: state,
            timestamp: new Date().toISOString()
        });

        return {
            authUrl,
            state,
            provider: providerName
        };
    }

    /**
     * Handle OAuth2 callback
     * @param {string} code - Authorization code
     * @param {string} state - CSRF state parameter
     * @param {string} error - OAuth2 error (if any)
     * @returns {Promise<Object>} Authentication result
     */
    async handleCallback(code, state, error) {
        if (error) {
            auditLogger.logFailure('oauth2_callback', {
                error: error,
                state: state,
                timestamp: new Date().toISOString()
            });
            throw new Error(`OAuth2 authentication failed: ${error}`);
        }

        if (!code || !state) {
            auditLogger.logFailure('oauth2_callback', {
                error: 'Missing code or state parameter',
                state: state,
                timestamp: new Date().toISOString()
            });
            throw new Error('Missing authorization code or state parameter');
        }

        // Verify state
        const stateData = this.stateStore.get(state);
        if (!stateData) {
            auditLogger.logFailure('oauth2_callback', {
                error: 'Invalid or expired state',
                state: state,
                timestamp: new Date().toISOString()
            });
            throw new Error('Invalid or expired state parameter');
        }

        // Remove used state
        this.stateStore.delete(state);

        const provider = this.providers.get(stateData.provider);
        if (!provider) {
            throw new Error(`OAuth2 provider '${stateData.provider}' not available`);
        }

        try {
            // Exchange code for token
            const tokenResponse = await provider.exchangeCodeForToken(code, state);
            
            // Get user information
            const userInfo = await provider.getUserInfo(tokenResponse.access_token);
            
            // Map user information to internal format
            const mappedUser = this.mapUserInfo(userInfo, stateData.provider);

            auditLogger.logSuccess('oauth2_login_success', {
                provider: stateData.provider,
                userId: mappedUser.id,
                email: mappedUser.email,
                role: mappedUser.role,
                timestamp: new Date().toISOString()
            });

            return {
                success: true,
                user: mappedUser,
                tokens: tokenResponse,
                provider: stateData.provider,
                returnUrl: stateData.returnUrl
            };

        } catch (error) {
            auditLogger.logFailure('oauth2_login_failed', {
                provider: stateData.provider,
                error: error.message,
                state: state,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    /**
     * Map external user info to internal format
     * @param {Object} userInfo - User info from provider
     * @param {string} providerName - Provider name
     * @returns {Object} Mapped user information
     */
    mapUserInfo(userInfo, providerName) {
        // Extract roles/groups from user info
        let roles = [];
        
        switch (providerName) {
            case 'google':
                // Google doesn't typically provide roles in basic user info
                // In production, you might query Groups API or use custom claims
                roles = ['patient']; // Default role
                break;
            
            case 'microsoft':
                // Microsoft Graph can provide job title, department, etc.
                if (userInfo.jobTitle) {
                    roles.push(mapRole(userInfo.jobTitle));
                }
                break;
            
            case 'okta':
                // Okta provides groups in user info
                if (userInfo.groups) {
                    roles = userInfo.groups.map(group => mapRole(group));
                }
                break;
        }

        // Default to patient role if no roles found
        if (roles.length === 0) {
            roles = ['patient'];
        }

        return {
            id: userInfo.id || userInfo.sub,
            email: userInfo.email,
            emailVerified: userInfo.verified_email || userInfo.email_verified || false,
            name: userInfo.name || userInfo.displayName,
            firstName: userInfo.given_name || userInfo.givenName,
            lastName: userInfo.family_name || userInfo.surname,
            picture: userInfo.picture,
            locale: userInfo.locale,
            role: roles[0], // Primary role
            roles: roles,
            provider: providerName,
            providerUserId: userInfo.id || userInfo.sub,
            lastLogin: new Date().toISOString()
        };
    }

    /**
     * Clean up expired states
     */
    cleanupStates() {
        const now = Date.now();
        const maxAge = 10 * 60 * 1000; // 10 minutes

        for (const [state, data] of this.stateStore.entries()) {
            if (now - data.timestamp > maxAge) {
                this.stateStore.delete(state);
            }
        }
    }

    /**
     * Refresh OAuth2 token
     * @param {string} refreshToken - Refresh token
     * @param {string} providerName - Provider name
     * @returns {Promise<Object>} New token response
     */
    async refreshToken(refreshToken, providerName) {
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new Error(`OAuth2 provider '${providerName}' not available`);
        }

        // In a real implementation, this would make an HTTP request to refresh the token
        // For now, we'll simulate the response
        auditLogger.logInfo('oauth2_token_refresh', {
            provider: providerName,
            timestamp: new Date().toISOString()
        });

        return {
            access_token: crypto.randomBytes(32).toString('hex'),
            token_type: 'Bearer',
            expires_in: 3600,
            refresh_token: refreshToken // Keep the same refresh token for simplicity
        };
    }
}

module.exports = {
    OAuth2Provider,
    OAuth2AuthService
};