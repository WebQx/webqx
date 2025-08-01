/**
 * OAuth2 Client Implementation
 * Handles OAuth2 authorization flow with central IDP
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getConfig } = require('./config');

/**
 * OAuth2 Client class for handling authorization flow
 */
class OAuth2Client {
    constructor() {
        this.config = getConfig();
        // In-memory stores (use Redis in production)
        this.stateStore = new Map();
        this.codeVerifierStore = new Map();
        this.tokenCache = new Map();
    }

    /**
     * Generate authorization URL for OAuth2 flow
     * @param {Object} options - Authorization options
     * @returns {Object} Authorization URL and state
     */
    generateAuthorizationUrl(options = {}) {
        try {
            const {
                scope = this.config.client.scope,
                redirectUri = this.config.client.redirectUri,
                state: customState,
                nonce: customNonce
            } = options;

            // Generate state parameter for CSRF protection
            const state = customState || crypto.randomBytes(32).toString('hex');
            
            // Generate nonce for ID token validation
            const nonce = customNonce || crypto.randomBytes(16).toString('hex');

            // Store state for validation
            this.stateStore.set(state, {
                timestamp: Date.now(),
                redirectUri,
                nonce
            });

            // Clean up expired states (older than 10 minutes)
            this.cleanupExpiredStates();

            const authUrl = new URL(this.config.idp.authorizationEndpoint);
            authUrl.searchParams.set('client_id', this.config.client.clientId);
            authUrl.searchParams.set('response_type', this.config.client.responseType);
            authUrl.searchParams.set('scope', scope);
            authUrl.searchParams.set('redirect_uri', redirectUri);
            authUrl.searchParams.set('state', state);
            authUrl.searchParams.set('nonce', nonce);

            // Add PKCE parameters if enabled
            let codeVerifier = null;
            if (this.config.security.pkceEnabled) {
                codeVerifier = crypto.randomBytes(32).toString('base64url');
                const codeChallenge = crypto.createHash('sha256')
                    .update(codeVerifier)
                    .digest('base64url');
                
                authUrl.searchParams.set('code_challenge', codeChallenge);
                authUrl.searchParams.set('code_challenge_method', this.config.security.pkceMethod);
                
                // Store code verifier for token exchange
                this.codeVerifierStore.set(state, codeVerifier);
            }

            return {
                authorizationUrl: authUrl.toString(),
                state,
                nonce,
                codeVerifier // Include for client-side storage if needed
            };

        } catch (error) {
            throw new Error(`Failed to generate authorization URL: ${error.message}`);
        }
    }

    /**
     * Exchange authorization code for tokens
     * @param {Object} params - Authorization callback parameters
     * @returns {Object} Token response with user info
     */
    async exchangeCodeForTokens(params) {
        try {
            const { code, state, redirectUri } = params;

            if (!code) {
                throw new Error('Authorization code is required');
            }

            // Validate state parameter
            if (this.config.security.stateValidation) {
                const stateData = this.stateStore.get(state);
                if (!stateData) {
                    throw new Error('Invalid or expired state parameter');
                }
                
                // Remove used state
                this.stateStore.delete(state);
                
                // Validate state age (max 10 minutes)
                if (Date.now() - stateData.timestamp > 600000) {
                    throw new Error('State parameter has expired');
                }
            }

            // Prepare token request
            const tokenRequestBody = new URLSearchParams({
                grant_type: this.config.client.grantType,
                code: code,
                client_id: this.config.client.clientId,
                redirect_uri: redirectUri || this.config.client.redirectUri
            });

            // Add client secret if configured
            if (this.config.client.clientSecret) {
                tokenRequestBody.set('client_secret', this.config.client.clientSecret);
            }

            // Add PKCE code verifier if enabled
            if (this.config.security.pkceEnabled) {
                const codeVerifier = this.codeVerifierStore.get(state);
                if (codeVerifier) {
                    tokenRequestBody.set('code_verifier', codeVerifier);
                    this.codeVerifierStore.delete(state);
                }
            }

            // Mock mode for development/testing
            if (this.config.development.enableMockMode) {
                return this.generateMockTokenResponse();
            }

            // Make token request to IDP
            const tokenResponse = await this.makeTokenRequest(tokenRequestBody);
            
            // Validate and parse response
            const tokenData = await this.validateTokenResponse(tokenResponse);
            
            // Cache tokens if enabled
            if (this.config.token.cacheEnabled && tokenData.access_token) {
                this.cacheToken(tokenData.access_token, tokenData);
            }

            return tokenData;

        } catch (error) {
            throw new Error(`Token exchange failed: ${error.message}`);
        }
    }

    /**
     * Make HTTP request to token endpoint
     * @param {URLSearchParams} body - Request body
     * @returns {Object} Response data
     */
    async makeTokenRequest(body) {
        // Note: In a real implementation, you would use fetch() or axios
        // For this demo, we'll simulate the request
        
        if (this.config.development.enableMockMode) {
            return this.generateMockTokenResponse();
        }

        // Simulated token endpoint response
        // In production, replace with actual HTTP request:
        /*
        const response = await fetch(this.config.idp.tokenEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: body.toString()
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Token endpoint error: ${errorData.error_description || errorData.error}`);
        }

        return await response.json();
        */

        // For demo purposes, return mock response
        return this.generateMockTokenResponse();
    }

    /**
     * Generate mock token response for development/testing
     * @returns {Object} Mock token response
     */
    generateMockTokenResponse() {
        const mockClaims = {
            ...this.config.development.mockUserClaims,
            iss: this.config.idp.issuer,
            aud: this.config.client.clientId,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
        };

        // Generate mock JWT (not cryptographically secure, for demo only)
        const mockToken = jwt.sign(mockClaims, 'mock-secret', { algorithm: 'HS256' });

        return {
            access_token: mockToken,
            token_type: 'Bearer',
            expires_in: 3600,
            scope: this.config.client.scope,
            id_token: mockToken, // In real implementation, this would be different
            refresh_token: crypto.randomBytes(32).toString('hex')
        };
    }

    /**
     * Validate token response from IDP
     * @param {Object} tokenResponse - Response from token endpoint
     * @returns {Object} Validated token data
     */
    async validateTokenResponse(tokenResponse) {
        if (!tokenResponse.access_token) {
            throw new Error('Access token not received');
        }

        if (tokenResponse.token_type !== 'Bearer') {
            throw new Error('Unsupported token type');
        }

        // Validate token expiration
        const expiresIn = parseInt(tokenResponse.expires_in);
        if (isNaN(expiresIn) || expiresIn <= 0) {
            throw new Error('Invalid token expiration');
        }

        return {
            ...tokenResponse,
            expires_at: Date.now() + (expiresIn * 1000),
            received_at: Date.now()
        };
    }

    /**
     * Refresh access token using refresh token
     * @param {string} refreshToken - Refresh token
     * @returns {Object} New token data
     */
    async refreshAccessToken(refreshToken) {
        try {
            if (!refreshToken) {
                throw new Error('Refresh token is required');
            }

            const refreshRequestBody = new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: this.config.client.clientId
            });

            if (this.config.client.clientSecret) {
                refreshRequestBody.set('client_secret', this.config.client.clientSecret);
            }

            // Mock mode for development
            if (this.config.development.enableMockMode) {
                return this.generateMockTokenResponse();
            }

            // In production, make actual HTTP request to token endpoint
            const tokenResponse = await this.makeTokenRequest(refreshRequestBody);
            const tokenData = await this.validateTokenResponse(tokenResponse);

            // Update token cache
            if (this.config.token.cacheEnabled && tokenData.access_token) {
                this.cacheToken(tokenData.access_token, tokenData);
            }

            return tokenData;

        } catch (error) {
            throw new Error(`Token refresh failed: ${error.message}`);
        }
    }

    /**
     * Revoke tokens
     * @param {string} token - Token to revoke
     * @param {string} tokenTypeHint - Type of token ('access_token' or 'refresh_token')
     * @returns {boolean} Success status
     */
    async revokeToken(token, tokenTypeHint = 'access_token') {
        try {
            if (!token) {
                throw new Error('Token is required for revocation');
            }

            // Remove from cache
            this.tokenCache.delete(token);

            // Mock mode for development
            if (this.config.development.enableMockMode) {
                return true;
            }

            // In production, make actual HTTP request to revocation endpoint
            /*
            const revokeRequestBody = new URLSearchParams({
                token: token,
                token_type_hint: tokenTypeHint,
                client_id: this.config.client.clientId
            });

            if (this.config.client.clientSecret) {
                revokeRequestBody.set('client_secret', this.config.client.clientSecret);
            }

            const response = await fetch(this.config.idp.revocationEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: revokeRequestBody.toString()
            });

            return response.ok;
            */

            return true; // Mock success

        } catch (error) {
            console.error('Token revocation error:', error);
            throw error; // Re-throw for proper error handling
        }
    }

    /**
     * Cache token data
     * @param {string} token - Access token
     * @param {Object} tokenData - Token data to cache
     */
    cacheToken(token, tokenData) {
        const cacheEntry = {
            ...tokenData,
            cached_at: Date.now()
        };
        
        this.tokenCache.set(token, cacheEntry);
        
        // Set cleanup timer
        setTimeout(() => {
            this.tokenCache.delete(token);
        }, this.config.token.cacheTtl * 1000);
    }

    /**
     * Get cached token data
     * @param {string} token - Access token
     * @returns {Object|null} Cached token data or null
     */
    getCachedToken(token) {
        const cached = this.tokenCache.get(token);
        if (!cached) return null;

        // Check if cache entry is still valid
        const age = Date.now() - cached.cached_at;
        if (age > this.config.token.cacheTtl * 1000) {
            this.tokenCache.delete(token);
            return null;
        }

        return cached;
    }

    /**
     * Clean up expired state parameters
     */
    cleanupExpiredStates() {
        const now = Date.now();
        const maxAge = 600000; // 10 minutes

        for (const [state, data] of this.stateStore.entries()) {
            if (now - data.timestamp > maxAge) {
                this.stateStore.delete(state);
                this.codeVerifierStore.delete(state);
            }
        }
    }

    /**
     * Get OAuth2 client configuration
     * @returns {Object} Client configuration
     */
    getClientConfig() {
        return {
            clientId: this.config.client.clientId,
            scope: this.config.client.scope,
            redirectUri: this.config.client.redirectUri,
            authorizationEndpoint: this.config.idp.authorizationEndpoint,
            tokenEndpoint: this.config.idp.tokenEndpoint
        };
    }
}

module.exports = OAuth2Client;