/**
 * Lambda-optimized dependency loader
 * Provides conditional loading for heavy optional dependencies
 */

const logger = console;

/**
 * Safely load optional dependencies with fallback
 */
function loadOptionalDependency(moduleName, fallback = null) {
    try {
        return require(moduleName);
    } catch (error) {
        if (process.env.NODE_ENV === 'development') {
            logger.warn(`Optional dependency '${moduleName}' not available:`, error.message);
        }
        return fallback;
    }
}

/**
 * Load Azure dependencies conditionally
 */
function loadAzureDependencies() {
    const azureIdentity = loadOptionalDependency('@azure/identity');
    const graphClient = loadOptionalDependency('@microsoft/microsoft-graph-client');
    
    if (!azureIdentity || !graphClient) {
        return null;
    }
    
    return { azureIdentity, graphClient };
}

/**
 * Load Keycloak dependencies conditionally
 */
function loadKeycloakDependencies() {
    const keycloakConnect = loadOptionalDependency('keycloak-connect');
    const keycloakJs = loadOptionalDependency('keycloak-js');
    
    if (!keycloakConnect) {
        return null;
    }
    
    return { keycloakConnect, keycloakJs };
}

/**
 * Load Redis dependencies conditionally
 */
function loadRedisDependencies() {
    const redis = loadOptionalDependency('redis');
    const connectRedis = loadOptionalDependency('connect-redis');
    
    if (!redis) {
        return null;
    }
    
    return { redis, connectRedis };
}

/**
 * Load session and rate limiting middleware conditionally
 */
function loadSessionMiddleware() {
    const session = loadOptionalDependency('express-session');
    const rateLimit = loadOptionalDependency('express-rate-limit');
    
    return { session, rateLimit };
}

/**
 * Load Argon2 as fallback to bcrypt
 */
function loadPasswordHasher() {
    const bcrypt = require('bcrypt'); // Always available
    const argon2 = loadOptionalDependency('argon2');
    
    return {
        bcrypt,
        argon2,
        hash: async (password, rounds = 10) => {
            if (argon2 && process.env.PREFER_ARGON2 === 'true') {
                return argon2.hash(password);
            }
            return bcrypt.hash(password, rounds);
        },
        compare: async (password, hash) => {
            // Try argon2 first if available and hash looks like argon2
            if (argon2 && hash.startsWith('$argon2')) {
                return argon2.verify(hash, password);
            }
            return bcrypt.compare(password, hash);
        }
    };
}

/**
 * Create lightweight authentication middleware for Lambda
 */
function createLightweightAuth() {
    const jwt = require('jsonwebtoken');
    
    return {
        authenticateToken: (req, res, next) => {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            
            if (!token) {
                return res.status(401).json({ error: 'Access token required' });
            }
            
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                req.user = decoded;
                next();
            } catch (error) {
                return res.status(403).json({ error: 'Invalid or expired token' });
            }
        },
        generateToken: (payload, expiresIn = '1h') => {
            return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
        }
    };
}

/**
 * Feature flags for optional modules
 */
const featureFlags = {
    azure: () => !!process.env.AZURE_TENANT_ID && !!loadAzureDependencies(),
    keycloak: () => !!process.env.KEYCLOAK_URL && !!loadKeycloakDependencies(),
    redis: () => !!process.env.REDIS_URL && !!loadRedisDependencies(),
    telehealth: () => {
        try {
            require('./modules/telehealth/TelehealthService');
            return true;
        } catch {
            return false;
        }
    },
    postdicom: () => {
        try {
            require('./modules/postdicom/routes/dicom.js');
            return true;
        } catch {
            return false;
        }
    },
    openehr: () => {
        try {
            require('./openehr/routes/ehr');
            return true;
        } catch {
            return false;
        }
    }
};

module.exports = {
    loadOptionalDependency,
    loadAzureDependencies,
    loadKeycloakDependencies,
    loadRedisDependencies,
    loadSessionMiddleware,
    loadPasswordHasher,
    createLightweightAuth,
    featureFlags
};