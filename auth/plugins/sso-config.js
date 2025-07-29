/**
 * SSO Configuration Management
 * Centralized configuration for all SSO authentication plugins
 */

/**
 * Default SSO configuration
 */
const DEFAULT_SSO_CONFIG = {
    // OAuth2 Providers
    oauth2: {
        google: {
            enabled: false,
            clientId: process.env.GOOGLE_CLIENT_ID || '',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
            redirectUri: process.env.GOOGLE_REDIRECT_URI || '/auth/oauth2/google/callback',
            scopes: ['openid', 'profile', 'email'],
            userInfoEndpoint: 'https://www.googleapis.com/oauth2/v2/userinfo'
        },
        microsoft: {
            enabled: false,
            clientId: process.env.MICROSOFT_CLIENT_ID || '',
            clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
            redirectUri: process.env.MICROSOFT_REDIRECT_URI || '/auth/oauth2/microsoft/callback',
            tenant: process.env.MICROSOFT_TENANT || 'common',
            scopes: ['openid', 'profile', 'email'],
            authority: 'https://login.microsoftonline.com'
        },
        okta: {
            enabled: false,
            clientId: process.env.OKTA_CLIENT_ID || '',
            clientSecret: process.env.OKTA_CLIENT_SECRET || '',
            redirectUri: process.env.OKTA_REDIRECT_URI || '/auth/oauth2/okta/callback',
            domain: process.env.OKTA_DOMAIN || '',
            scopes: ['openid', 'profile', 'email']
        }
    },
    
    // SAML Providers
    saml: {
        azureAd: {
            enabled: false,
            entityId: process.env.SAML_AZURE_ENTITY_ID || '',
            ssoUrl: process.env.SAML_AZURE_SSO_URL || '',
            certificate: process.env.SAML_AZURE_CERTIFICATE || '',
            attributeMapping: {
                email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
                firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
                lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
                roles: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'
            }
        },
        oneLogin: {
            enabled: false,
            entityId: process.env.SAML_ONELOGIN_ENTITY_ID || '',
            ssoUrl: process.env.SAML_ONELOGIN_SSO_URL || '',
            certificate: process.env.SAML_ONELOGIN_CERTIFICATE || '',
            attributeMapping: {
                email: 'User.Email',
                firstName: 'User.FirstName',
                lastName: 'User.LastName',
                roles: 'User.Role'
            }
        },
        pingIdentity: {
            enabled: false,
            entityId: process.env.SAML_PING_ENTITY_ID || '',
            ssoUrl: process.env.SAML_PING_SSO_URL || '',
            certificate: process.env.SAML_PING_CERTIFICATE || '',
            attributeMapping: {
                email: 'mail',
                firstName: 'givenName',
                lastName: 'sn',
                roles: 'memberOf'
            }
        }
    },
    
    // Session Configuration
    session: {
        timeoutMinutes: parseInt(process.env.SESSION_TIMEOUT_MINUTES) || 480, // 8 hours default
        renewalThresholdMinutes: parseInt(process.env.SESSION_RENEWAL_THRESHOLD_MINUTES) || 30,
        maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS) || 3,
        secureLogout: true,
        clearExternalSessions: true
    },
    
    // Audit Configuration
    audit: {
        enabled: true,
        logSuccessfulLogins: true,
        logFailedLogins: true,
        logLogouts: true,
        logSessionEvents: true,
        retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS) || 90,
        externalLogging: {
            enabled: false,
            endpoint: process.env.AUDIT_EXTERNAL_ENDPOINT || '',
            apiKey: process.env.AUDIT_EXTERNAL_API_KEY || ''
        }
    },
    
    // RBAC Configuration
    rbac: {
        defaultRole: 'patient',
        roleMapping: {
            // Standard healthcare roles
            'admin': ['admin', 'administrator', 'sysadmin'],
            'physician': ['doctor', 'physician', 'md', 'do'],
            'nurse': ['nurse', 'rn', 'lpn', 'nursing'],
            'patient': ['patient', 'user', 'member'],
            'staff': ['staff', 'clerk', 'receptionist'],
            'pharmacist': ['pharmacist', 'pharmd', 'pharm'],
            'technician': ['tech', 'technician', 'assistant']
        },
        permissions: {
            admin: ['*'],
            physician: ['patient:read', 'patient:write', 'appointment:read', 'appointment:write', 'prescription:write'],
            nurse: ['patient:read', 'patient:write', 'appointment:read', 'appointment:write'],
            patient: ['patient:read-own', 'appointment:read-own', 'prescription:read-own'],
            staff: ['patient:read', 'appointment:read', 'appointment:write'],
            pharmacist: ['prescription:read', 'prescription:write', 'patient:read'],
            technician: ['patient:read', 'appointment:read']
        }
    }
};

/**
 * Get SSO configuration for a specific provider
 * @param {string} type - 'oauth2' or 'saml'
 * @param {string} provider - Provider name
 * @returns {Object} Provider configuration
 */
function getProviderConfig(type, provider) {
    return DEFAULT_SSO_CONFIG[type]?.[provider] || null;
}

/**
 * Get all enabled providers
 * @returns {Object} Enabled providers by type
 */
function getEnabledProviders() {
    const enabled = {
        oauth2: [],
        saml: []
    };
    
    // Check OAuth2 providers
    Object.keys(DEFAULT_SSO_CONFIG.oauth2).forEach(provider => {
        if (DEFAULT_SSO_CONFIG.oauth2[provider].enabled) {
            enabled.oauth2.push(provider);
        }
    });
    
    // Check SAML providers
    Object.keys(DEFAULT_SSO_CONFIG.saml).forEach(provider => {
        if (DEFAULT_SSO_CONFIG.saml[provider].enabled) {
            enabled.saml.push(provider);
        }
    });
    
    return enabled;
}

/**
 * Validate provider configuration
 * @param {string} type - 'oauth2' or 'saml'
 * @param {string} provider - Provider name
 * @returns {Object} Validation result
 */
function validateProviderConfig(type, provider) {
    const config = getProviderConfig(type, provider);
    if (!config) {
        return { valid: false, errors: ['Provider not found'] };
    }
    
    const errors = [];
    
    if (type === 'oauth2') {
        if (!config.clientId) errors.push('Client ID is required');
        if (!config.clientSecret) errors.push('Client Secret is required');
        if (!config.redirectUri) errors.push('Redirect URI is required');
    } else if (type === 'saml') {
        if (!config.entityId) errors.push('Entity ID is required');
        if (!config.ssoUrl) errors.push('SSO URL is required');
        if (!config.certificate) errors.push('Certificate is required');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Get session configuration
 * @returns {Object} Session configuration
 */
function getSessionConfig() {
    return DEFAULT_SSO_CONFIG.session;
}

/**
 * Get audit configuration
 * @returns {Object} Audit configuration
 */
function getAuditConfig() {
    return DEFAULT_SSO_CONFIG.audit;
}

/**
 * Get RBAC configuration
 * @returns {Object} RBAC configuration
 */
function getRBACConfig() {
    return DEFAULT_SSO_CONFIG.rbac;
}

/**
 * Map external role to internal role
 * @param {string} externalRole - Role from identity provider
 * @returns {string} Internal role
 */
function mapRole(externalRole) {
    const rbacConfig = getRBACConfig();
    const lowerRole = externalRole.toLowerCase();
    
    for (const [internalRole, externalRoles] of Object.entries(rbacConfig.roleMapping)) {
        if (externalRoles.includes(lowerRole)) {
            return internalRole;
        }
    }
    
    return rbacConfig.defaultRole;
}

/**
 * Get permissions for a role
 * @param {string} role - Internal role
 * @returns {Array} List of permissions
 */
function getRolePermissions(role) {
    const rbacConfig = getRBACConfig();
    return rbacConfig.permissions[role] || rbacConfig.permissions[rbacConfig.defaultRole];
}

module.exports = {
    DEFAULT_SSO_CONFIG,
    getProviderConfig,
    getEnabledProviders,
    validateProviderConfig,
    getSessionConfig,
    getAuditConfig,
    getRBACConfig,
    mapRole,
    getRolePermissions
};