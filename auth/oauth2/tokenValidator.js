/**
 * OAuth2 Token Validator
 * Handles OAuth2 token validation with robust error handling
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getConfig } = require('./config');

/**
 * OAuth2 Token Validator class
 */
class TokenValidator {
    constructor() {
        this.config = getConfig();
        // Cache for JWKS (JSON Web Key Set)
        this.jwksCache = new Map();
        this.jwksCacheExpiry = new Map();
        // Cache for validated tokens
        this.validatedTokenCache = new Map();
    }

    /**
     * Validate OAuth2 access token
     * @param {string} token - Access token to validate
     * @param {Object} options - Validation options
     * @returns {Object} Validation result
     */
    async validateAccessToken(token, options = {}) {
        try {
            if (!token) {
                return {
                    valid: false,
                    error: 'Token is required',
                    errorCode: 'MISSING_TOKEN'
                };
            }

            // Remove Bearer prefix if present
            if (token.startsWith('Bearer ')) {
                token = token.substring(7);
            }

            // Check cache first
            const cached = this.getValidatedTokenFromCache(token);
            if (cached) {
                return cached;
            }

            // Mock mode validation for development
            if (this.config.development.enableMockMode) {
                return this.validateMockToken(token);
            }

            // Decode token header to get algorithm and key ID
            const header = this.decodeTokenHeader(token);
            if (!header) {
                return {
                    valid: false,
                    error: 'Invalid token format',
                    errorCode: 'INVALID_FORMAT'
                };
            }

            // Validate algorithm
            if (!this.config.security.allowedAlgorithms.includes(header.alg)) {
                return {
                    valid: false,
                    error: `Unsupported algorithm: ${header.alg}`,
                    errorCode: 'UNSUPPORTED_ALGORITHM'
                };
            }

            // Get public key for verification
            const publicKey = await this.getPublicKey(header.kid, header.alg);
            if (!publicKey) {
                return {
                    valid: false,
                    error: 'Unable to retrieve public key',
                    errorCode: 'KEY_RETRIEVAL_FAILED'
                };
            }

            // Verify token signature and decode payload
            const payload = await this.verifyTokenSignature(token, publicKey, header.alg);
            if (!payload) {
                return {
                    valid: false,
                    error: 'Token signature verification failed',
                    errorCode: 'SIGNATURE_VERIFICATION_FAILED'
                };
            }

            // Validate token claims
            const claimsValidation = this.validateTokenClaims(payload, options);
            if (!claimsValidation.valid) {
                return claimsValidation;
            }

            // Extract user information and permissions
            const userInfo = this.extractUserInfo(payload);
            
            const result = {
                valid: true,
                payload,
                userInfo,
                tokenType: 'access_token',
                expiresAt: payload.exp * 1000,
                issuedAt: payload.iat * 1000
            };

            // Cache the validation result
            this.cacheValidatedToken(token, result);

            return result;

        } catch (error) {
            console.error('Token validation error:', error);
            return {
                valid: false,
                error: 'Token validation failed',
                errorCode: 'VALIDATION_ERROR',
                details: error.message
            };
        }
    }

    /**
     * Validate ID token (for OpenID Connect)
     * @param {string} idToken - ID token to validate
     * @param {Object} options - Validation options
     * @returns {Object} Validation result
     */
    async validateIdToken(idToken, options = {}) {
        try {
            const { nonce } = options;

            const validation = await this.validateAccessToken(idToken, {
                ...options,
                tokenType: 'id_token'
            });

            if (!validation.valid) {
                return validation;
            }

            // Additional ID token specific validations
            const payload = validation.payload;

            // Validate nonce if provided
            if (this.config.security.nonceValidation && nonce) {
                if (payload.nonce !== nonce) {
                    return {
                        valid: false,
                        error: 'Nonce mismatch',
                        errorCode: 'NONCE_MISMATCH'
                    };
                }
            }

            // Validate auth_time if present
            if (payload.auth_time) {
                const authTime = payload.auth_time * 1000;
                const maxAge = options.maxAge || 86400; // 24 hours default
                if (Date.now() - authTime > maxAge * 1000) {
                    return {
                        valid: false,
                        error: 'Authentication too old',
                        errorCode: 'AUTH_TIME_EXCEEDED'
                    };
                }
            }

            return {
                ...validation,
                tokenType: 'id_token'
            };

        } catch (error) {
            console.error('ID token validation error:', error);
            return {
                valid: false,
                error: 'ID token validation failed',
                errorCode: 'ID_TOKEN_VALIDATION_ERROR',
                details: error.message
            };
        }
    }

    /**
     * Decode token header without verification
     * @param {string} token - JWT token
     * @returns {Object|null} Decoded header or null
     */
    decodeTokenHeader(token) {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) {
                return null;
            }

            const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
            return header;
        } catch (error) {
            return null;
        }
    }

    /**
     * Get public key for token verification
     * @param {string} keyId - Key ID from token header
     * @param {string} algorithm - Token algorithm
     * @returns {string|null} Public key or null
     */
    async getPublicKey(keyId, algorithm) {
        try {
            // Skip signature verification in development if configured
            if (this.config.development.skipSignatureVerification) {
                return 'mock-public-key';
            }

            // Check cache first
            const cacheKey = `${keyId}-${algorithm}`;
            const cached = this.jwksCache.get(cacheKey);
            const expiry = this.jwksCacheExpiry.get(cacheKey);

            if (cached && expiry && Date.now() < expiry) {
                return cached;
            }

            // Fetch JWKS from IDP
            const jwks = await this.fetchJWKS();
            if (!jwks || !jwks.keys) {
                return null;
            }

            // Find matching key
            const key = jwks.keys.find(k => 
                k.kid === keyId && 
                k.alg === algorithm && 
                k.use === 'sig'
            );

            if (!key) {
                return null;
            }

            // Convert JWK to PEM format (simplified for RSA)
            const publicKey = this.jwkToPem(key);

            // Cache the key for 1 hour
            this.jwksCache.set(cacheKey, publicKey);
            this.jwksCacheExpiry.set(cacheKey, Date.now() + 3600000);

            return publicKey;

        } catch (error) {
            console.error('Public key retrieval error:', error);
            return null;
        }
    }

    /**
     * Fetch JWKS from IDP
     * @returns {Object|null} JWKS or null
     */
    async fetchJWKS() {
        try {
            // Mock JWKS for development
            if (this.config.development.enableMockMode) {
                return {
                    keys: [{
                        kid: 'mock-key-id',
                        alg: 'RS256',
                        use: 'sig',
                        kty: 'RSA',
                        n: 'mock-modulus',
                        e: 'AQAB'
                    }]
                };
            }

            // In production, fetch actual JWKS:
            /*
            const response = await fetch(this.config.idp.jwksUri);
            if (!response.ok) {
                throw new Error(`JWKS fetch failed: ${response.status}`);
            }
            return await response.json();
            */

            // Return mock for demo
            return {
                keys: [{
                    kid: 'demo-key-id',
                    alg: 'RS256',
                    use: 'sig',
                    kty: 'RSA',
                    n: 'demo-modulus',
                    e: 'AQAB'
                }]
            };

        } catch (error) {
            console.error('JWKS fetch error:', error);
            return null;
        }
    }

    /**
     * Convert JWK to PEM format (simplified implementation)
     * @param {Object} jwk - JSON Web Key
     * @returns {string} PEM formatted key
     */
    jwkToPem(jwk) {
        // This is a simplified implementation
        // In production, use a library like 'jwk-to-pem'
        if (this.config.development.enableMockMode || this.config.development.skipSignatureVerification) {
            return 'mock-public-key';
        }

        // For real implementation, convert JWK to PEM
        // return jwkToPem(jwk);
        return 'demo-public-key';
    }

    /**
     * Verify token signature
     * @param {string} token - JWT token
     * @param {string} publicKey - Public key for verification
     * @param {string} algorithm - Token algorithm
     * @returns {Object|null} Decoded payload or null
     */
    async verifyTokenSignature(token, publicKey, algorithm) {
        try {
            // Skip verification in development if configured
            if (this.config.development.skipSignatureVerification) {
                return jwt.decode(token);
            }

            // In production, verify with actual public key
            // For demo, use mock verification
            if (this.config.development.enableMockMode) {
                return jwt.decode(token);
            }

            // Real verification would be:
            // return jwt.verify(token, publicKey, { algorithm });
            
            // For demo, decode without verification
            return jwt.decode(token);

        } catch (error) {
            console.error('Token signature verification error:', error);
            return null;
        }
    }

    /**
     * Validate token claims
     * @param {Object} payload - Token payload
     * @param {Object} options - Validation options
     * @returns {Object} Validation result
     */
    validateTokenClaims(payload, options = {}) {
        const now = Math.floor(Date.now() / 1000);
        const clockTolerance = this.config.token.clockTolerance;

        // Check expiration
        if (payload.exp && payload.exp < (now - clockTolerance)) {
            return {
                valid: false,
                error: 'Token has expired',
                errorCode: 'TOKEN_EXPIRED'
            };
        }

        // Check not before
        if (payload.nbf && payload.nbf > (now + clockTolerance)) {
            return {
                valid: false,
                error: 'Token not yet valid',
                errorCode: 'TOKEN_NOT_YET_VALID'
            };
        }

        // Check issued at
        if (payload.iat && payload.iat > (now + clockTolerance)) {
            return {
                valid: false,
                error: 'Token issued in the future',
                errorCode: 'TOKEN_ISSUED_IN_FUTURE'
            };
        }

        // Validate issuer
        if (this.config.token.validateIssuer && payload.iss !== this.config.idp.issuer) {
            return {
                valid: false,
                error: 'Invalid issuer',
                errorCode: 'INVALID_ISSUER'
            };
        }

        // Validate audience
        if (this.config.token.validateAudience) {
            const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
            if (!audience.includes(this.config.client.clientId)) {
                return {
                    valid: false,
                    error: 'Invalid audience',
                    errorCode: 'INVALID_AUDIENCE'
                };
            }
        }

        return { valid: true };
    }

    /**
     * Extract user information from token payload
     * @param {Object} payload - Token payload
     * @returns {Object} User information
     */
    extractUserInfo(payload) {
        const claimMappings = this.config.rbac.claimMappings;
        
        return {
            userId: payload[claimMappings.userId] || payload.sub,
            email: payload[claimMappings.email] || payload.email,
            name: payload[claimMappings.name] || payload.name,
            roles: payload[claimMappings.roles] || this.config.rbac.defaultRoles,
            permissions: payload[claimMappings.permissions] || [],
            groups: payload[claimMappings.groups] || [],
            patientId: payload[claimMappings.patientId],
            // Additional standard claims
            sub: payload.sub,
            iss: payload.iss,
            aud: payload.aud,
            exp: payload.exp,
            iat: payload.iat,
            // Custom claims
            customClaims: this.extractCustomClaims(payload)
        };
    }

    /**
     * Extract custom claims from token
     * @param {Object} payload - Token payload
     * @returns {Object} Custom claims
     */
    extractCustomClaims(payload) {
        const standardClaims = new Set([
            'sub', 'iss', 'aud', 'exp', 'iat', 'nbf', 'jti', 'azp',
            'name', 'email', 'email_verified', 'given_name', 'family_name',
            'picture', 'locale', 'updated_at', 'nonce', 'auth_time'
        ]);

        const customClaims = {};
        Object.keys(payload).forEach(key => {
            if (!standardClaims.has(key) && !key.startsWith('_')) {
                customClaims[key] = payload[key];
            }
        });

        return customClaims;
    }

    /**
     * Validate mock token for development
     * @param {string} token - Token to validate
     * @returns {Object} Validation result
     */
    validateMockToken(token) {
        try {
            const payload = jwt.decode(token);
            if (!payload) {
                return {
                    valid: false,
                    error: 'Invalid mock token format',
                    errorCode: 'INVALID_MOCK_TOKEN'
                };
            }

            const userInfo = this.extractUserInfo(payload);
            
            return {
                valid: true,
                payload,
                userInfo,
                tokenType: 'access_token',
                expiresAt: payload.exp * 1000,
                issuedAt: payload.iat * 1000,
                mockToken: true
            };

        } catch (error) {
            return {
                valid: false,
                error: 'Mock token validation failed',
                errorCode: 'MOCK_TOKEN_ERROR',
                details: error.message
            };
        }
    }

    /**
     * Cache validated token result
     * @param {string} token - Token
     * @param {Object} result - Validation result
     */
    cacheValidatedToken(token, result) {
        if (!this.config.token.cacheEnabled) return;

        const cacheEntry = {
            ...result,
            cachedAt: Date.now()
        };

        this.validatedTokenCache.set(token, cacheEntry);

        // Set cleanup timer
        const ttl = Math.min(
            this.config.token.cacheTtl * 1000,
            (result.expiresAt - Date.now()) || this.config.token.cacheTtl * 1000
        );

        setTimeout(() => {
            this.validatedTokenCache.delete(token);
        }, ttl);
    }

    /**
     * Get validated token from cache
     * @param {string} token - Token
     * @returns {Object|null} Cached result or null
     */
    getValidatedTokenFromCache(token) {
        if (!this.config.token.cacheEnabled) return null;

        const cached = this.validatedTokenCache.get(token);
        if (!cached) return null;

        // Check if token has expired
        if (Date.now() >= cached.expiresAt) {
            this.validatedTokenCache.delete(token);
            return null;
        }

        // Check cache age
        const age = Date.now() - cached.cachedAt;
        if (age > this.config.token.cacheTtl * 1000) {
            this.validatedTokenCache.delete(token);
            return null;
        }

        return cached;
    }

    /**
     * Clear validation cache
     */
    clearCache() {
        this.validatedTokenCache.clear();
        this.jwksCache.clear();
        this.jwksCacheExpiry.clear();
    }

    /**
     * Get validation statistics
     * @returns {Object} Validation statistics
     */
    getValidationStats() {
        return {
            cachedTokens: this.validatedTokenCache.size,
            cachedKeys: this.jwksCache.size,
            config: {
                cacheEnabled: this.config.token.cacheEnabled,
                cacheTtl: this.config.token.cacheTtl,
                mockMode: this.config.development.enableMockMode
            }
        };
    }
}

module.exports = TokenValidator;