/**
 * OAuth2 Configuration Management
 * Handles OAuth2 client configuration for WebQx platform
 */

require('dotenv').config();

/**
 * OAuth2 Configuration Object
 */
const oauth2Config = {
    // Central IDP Configuration
    idp: {
        issuer: process.env.OAUTH2_ISSUER || 'https://auth.webqx.health',
        authorizationEndpoint: process.env.OAUTH2_AUTH_ENDPOINT || 'https://auth.webqx.health/oauth2/authorize',
        tokenEndpoint: process.env.OAUTH2_TOKEN_ENDPOINT || 'https://auth.webqx.health/oauth2/token',
        userInfoEndpoint: process.env.OAUTH2_USERINFO_ENDPOINT || 'https://auth.webqx.health/oauth2/userinfo',
        jwksUri: process.env.OAUTH2_JWKS_URI || 'https://auth.webqx.health/.well-known/jwks.json',
        revocationEndpoint: process.env.OAUTH2_REVOCATION_ENDPOINT || 'https://auth.webqx.health/oauth2/revoke'
    },

    // Client Configuration
    client: {
        clientId: process.env.OAUTH2_CLIENT_ID || 'webqx-healthcare-platform',
        clientSecret: process.env.OAUTH2_CLIENT_SECRET || '',
        redirectUri: process.env.OAUTH2_REDIRECT_URI || 'http://localhost:3000/auth/oauth2/callback',
        scope: process.env.OAUTH2_SCOPE || 'openid profile email patient/*.read patient/*.write user/*.read',
        responseType: 'code',
        grantType: 'authorization_code'
    },

    // Token Configuration
    token: {
        // Cache tokens for performance (in-memory for demo, use Redis in production)
        cacheEnabled: process.env.OAUTH2_TOKEN_CACHE_ENABLED === 'true' || false,
        cacheTtl: parseInt(process.env.OAUTH2_TOKEN_CACHE_TTL) || 300, // 5 minutes
        // Token validation settings
        validateAudience: process.env.OAUTH2_VALIDATE_AUDIENCE !== 'false',
        validateIssuer: process.env.OAUTH2_VALIDATE_ISSUER !== 'false',
        clockTolerance: parseInt(process.env.OAUTH2_CLOCK_TOLERANCE) || 60, // seconds
        // Refresh token settings
        enableRefresh: process.env.OAUTH2_ENABLE_REFRESH !== 'false',
        refreshThreshold: parseInt(process.env.OAUTH2_REFRESH_THRESHOLD) || 300 // seconds before expiry
    },

    // RBAC Configuration
    rbac: {
        enabled: process.env.OAUTH2_RBAC_ENABLED !== 'false',
        // Claim mappings for role-based access control
        claimMappings: {
            roles: process.env.OAUTH2_ROLES_CLAIM || 'roles',
            permissions: process.env.OAUTH2_PERMISSIONS_CLAIM || 'permissions',
            groups: process.env.OAUTH2_GROUPS_CLAIM || 'groups',
            patientId: process.env.OAUTH2_PATIENT_ID_CLAIM || 'patient_id',
            userId: process.env.OAUTH2_USER_ID_CLAIM || 'sub',
            email: process.env.OAUTH2_EMAIL_CLAIM || 'email',
            name: process.env.OAUTH2_NAME_CLAIM || 'name'
        },
        // Default roles if not specified in token
        defaultRoles: (process.env.OAUTH2_DEFAULT_ROLES || 'patient').split(','),
        // Role hierarchy
        roleHierarchy: {
            'super_admin': ['admin', 'provider', 'patient'],
            'admin': ['provider', 'patient'],
            'provider': ['patient'],
            'patient': []
        }
    },

    // Security Configuration
    security: {
        // JWT signature algorithms to accept
        allowedAlgorithms: (process.env.OAUTH2_ALLOWED_ALGORITHMS || 'RS256,RS384,RS512').split(','),
        // PKCE settings
        pkceEnabled: process.env.OAUTH2_PKCE_ENABLED !== 'false',
        pkceMethod: process.env.OAUTH2_PKCE_METHOD || 'S256',
        // State parameter validation
        stateValidation: process.env.OAUTH2_STATE_VALIDATION !== 'false',
        // Nonce validation for ID tokens
        nonceValidation: process.env.OAUTH2_NONCE_VALIDATION !== 'false'
    },

    // Development/Testing Configuration
    development: {
        // Skip signature verification in development (NOT for production)
        skipSignatureVerification: process.env.NODE_ENV === 'development' && process.env.OAUTH2_SKIP_SIGNATURE_VERIFICATION === 'true',
        // Mock OAuth2 responses for testing
        enableMockMode: process.env.NODE_ENV === 'development' && process.env.OAUTH2_MOCK_MODE === 'true',
        // Test user claims for mock mode
        mockUserClaims: {
            sub: 'test-user-123',
            email: 'test@webqx.health',
            name: 'Test User',
            roles: ['patient', 'provider'],
            permissions: ['patient:read', 'patient:write', 'observation:read'],
            patient_id: 'patient-123'
        }
    }
};

/**
 * Validate OAuth2 configuration
 * @returns {Object} Validation result
 */
function validateConfig() {
    const errors = [];
    
    // Required fields in production
    if (process.env.NODE_ENV === 'production') {
        if (!oauth2Config.client.clientSecret) {
            errors.push('OAUTH2_CLIENT_SECRET is required in production');
        }
        if (!oauth2Config.idp.issuer || oauth2Config.idp.issuer === 'https://auth.webqx.health') {
            errors.push('OAUTH2_ISSUER must be configured for production');
        }
    }
    
    // URL validation
    const urlFields = [
        'idp.issuer', 'idp.authorizationEndpoint', 'idp.tokenEndpoint', 
        'idp.userInfoEndpoint', 'idp.jwksUri', 'client.redirectUri'
    ];
    
    urlFields.forEach(field => {
        const value = getNestedValue(oauth2Config, field);
        if (value && !isValidUrl(value)) {
            errors.push(`Invalid URL format for ${field}: ${value}`);
        }
    });
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Helper function to get nested object values
 * @param {Object} obj - Object to search
 * @param {string} path - Dot notation path
 * @returns {*} Value or undefined
 */
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
}

/**
 * Helper function to validate URLs
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid URL
 */
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Get OAuth2 configuration with validation
 * @returns {Object} Configuration object
 * @throws {Error} If configuration is invalid
 */
function getConfig() {
    const validation = validateConfig();
    if (!validation.valid) {
        throw new Error(`OAuth2 configuration errors: ${validation.errors.join(', ')}`);
    }
    return oauth2Config;
}

/**
 * Update configuration at runtime (for testing)
 * @param {Object} updates - Configuration updates
 */
function updateConfig(updates) {
    if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
        throw new Error('Configuration updates only allowed in development/test environments');
    }
    
    Object.assign(oauth2Config, updates);
}

module.exports = {
    getConfig,
    validateConfig,
    updateConfig,
    oauth2Config
};