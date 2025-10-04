/**
 * Provider SSO configuration loader
 * Normalises environment variables for Microsoft, Google, Apple and Keycloak providers
 * and performs production-grade validation so we fail fast when secrets are missing.
 */

const PLACEHOLDER_PATTERNS = [
    /^your[-_]/i,
    /^changeme$/i,
    /^placeholder/i,
    /^example/i
];

const REQUIRED_HTTPS = ['tokenUrl', 'userInfoUrl'];

function isPlaceholder(value) {
    if (!value) return true;
    const cleaned = String(value).trim();
    if (!cleaned) return true;
    return PLACEHOLDER_PATTERNS.some(pattern => pattern.test(cleaned));
}

function ensureHttps(url) {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

function normaliseConfig() {
    return {
        keycloak: {
            tokenUrl: process.env.KEYCLOAK_TOKEN_URL || 'https://keycloak.webqx.health/auth/realms/webqx-healthcare/protocol/openid-connect/token',
            userInfoUrl: process.env.KEYCLOAK_USERINFO_URL || 'https://keycloak.webqx.health/auth/realms/webqx-healthcare/protocol/openid-connect/userinfo',
            clientId: process.env.KEYCLOAK_CLIENT_ID || 'webqx-provider-portal',
            clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || ''
        },
        microsoft: {
            tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
            userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
            clientId: process.env.AZURE_CLIENT_ID || '',
            clientSecret: process.env.AZURE_CLIENT_SECRET || ''
        },
        google: {
            tokenUrl: 'https://oauth2.googleapis.com/token',
            userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
            clientId: process.env.GOOGLE_CLIENT_ID || '',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || ''
        },
        apple: {
            tokenUrl: 'https://appleid.apple.com/auth/token',
            userInfoUrl: null,
            clientId: process.env.APPLE_CLIENT_ID || '',
            clientSecret: process.env.APPLE_CLIENT_SECRET || ''
        },
        'smart-fhir': {
            tokenUrl: process.env.FHIR_TOKEN_URL || 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
            userInfoUrl: process.env.FHIR_USERINFO_URL || 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/Practitioner',
            clientId: process.env.FHIR_CLIENT_ID || '',
            clientSecret: process.env.FHIR_CLIENT_SECRET || ''
        }
    };
}

function validateConfig(configs) {
    const isProduction = String(process.env.NODE_ENV).toLowerCase() === 'production';
    const warnings = [];
    const errors = [];

    const REQUIRED_FIELDS = {
        keycloak: ['clientId', 'clientSecret', 'tokenUrl', 'userInfoUrl'],
        microsoft: ['clientId', 'clientSecret'],
        google: ['clientId', 'clientSecret'],
        apple: ['clientId', 'clientSecret']
    };

    for (const [provider, cfg] of Object.entries(configs)) {
        const requiredFields = REQUIRED_FIELDS[provider] || [];
        requiredFields.forEach(field => {
            const value = cfg[field];
            const missing = isPlaceholder(value) || !String(value || '').trim();
            if (missing) {
                const message = `${provider.toUpperCase()}_${field.toUpperCase()} is not configured`;
                if (isProduction) {
                    errors.push(message);
                } else {
                    warnings.push(message);
                }
            }
        });

        REQUIRED_HTTPS.forEach(field => {
            if (cfg[field] && !ensureHttps(cfg[field])) {
                const message = `${provider.toUpperCase()}_${field.toUpperCase()} must use https`; 
                if (isProduction) {
                    errors.push(message);
                } else {
                    warnings.push(message);
                }
            }
        });
    }

    if (errors.length && isProduction) {
        throw new Error(`Provider SSO environment variables are incomplete: ${errors.join('; ')}`);
    }

    return { configs, warnings };
}

function getSSOConfigs() {
    const configs = normaliseConfig();
    const { warnings } = validateConfig(configs);
    warnings.forEach(w => console.warn(`[SSO][WARN] ${w}`));
    return configs;
}

module.exports = {
    getSSOConfigs
};
