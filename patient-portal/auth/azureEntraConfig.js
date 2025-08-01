/**
 * Azure Entra ID Configuration for Patient Access Portal
 * Implements Microsoft's healthcare ecosystem integration with MFA and conditional access
 */

const { ClientSecretCredential } = require('@azure/identity');
const { Client } = require('@microsoft/microsoft-graph-client');

// Configuration for Azure Entra ID in healthcare context
const azureConfig = {
    // Patient Portal specific configuration
    patient: {
        tenantId: process.env.AZURE_PATIENT_TENANT_ID || process.env.AZURE_TENANT_ID,
        clientId: process.env.AZURE_PATIENT_CLIENT_ID || process.env.AZURE_CLIENT_ID,
        clientSecret: process.env.AZURE_PATIENT_CLIENT_SECRET || process.env.AZURE_CLIENT_SECRET,
        authority: process.env.AZURE_PATIENT_AUTHORITY || `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || 'common'}`,
        
        // Healthcare-specific scopes
        scopes: [
            'openid',
            'profile',
            'email',
            'User.Read',
            'User.Read.All',
            'Directory.Read.All' // For group membership
        ],
        
        // Conditional Access and MFA settings
        conditionalAccess: {
            requireMFA: true,
            requireCompliantDevice: false, // Set to true for stricter security
            requireHybridAzureADJoin: false,
            blockLegacyAuth: true,
            requirePasswordChange: false
        },
        
        // Healthcare compliance settings
        compliance: {
            enableAuditLogging: true,
            logRetentionDays: 2555, // 7 years for healthcare compliance
            enableDataLossePrevention: true,
            requireSecureTransfer: true
        },
        
        // Patient-specific roles and groups
        healthcareRoles: {
            patient: 'Patient',
            guardian: 'Guardian',
            proxy: 'HealthcareProxy',
            emergency: 'EmergencyContact'
        }
    },
    
    // Provider Portal specific configuration (for reference)
    provider: {
        tenantId: process.env.AZURE_PROVIDER_TENANT_ID || process.env.AZURE_TENANT_ID,
        clientId: process.env.AZURE_PROVIDER_CLIENT_ID || process.env.AZURE_CLIENT_ID,
        clientSecret: process.env.AZURE_PROVIDER_CLIENT_SECRET || process.env.AZURE_CLIENT_SECRET,
        authority: process.env.AZURE_PROVIDER_AUTHORITY || `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || 'common'}`,
        
        scopes: [
            'openid',
            'profile',
            'email',
            'User.Read',
            'User.Read.All',
            'Directory.Read.All',
            'Group.Read.All',
            'Application.Read.All'
        ]
    }
};

/**
 * Create Azure Entra ID authentication URL for patients
 * @param {string} redirectUri - Redirect URI after authentication
 * @param {string} state - State parameter for CSRF protection
 * @returns {string} Authentication URL
 */
const createPatientAuthUrl = (redirectUri, state) => {
    const config = azureConfig.patient;
    const params = new URLSearchParams({
        client_id: config.clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        scope: config.scopes.join(' '),
        state: state,
        response_mode: 'query',
        prompt: 'select_account', // Allow account selection
        // Force MFA if configured
        ...(config.conditionalAccess.requireMFA && { acr_values: 'mfa' })
    });

    return `${config.authority}/oauth2/v2.0/authorize?${params.toString()}`;
};

/**
 * Exchange authorization code for tokens
 * @param {string} code - Authorization code
 * @param {string} redirectUri - Redirect URI
 * @returns {Promise<Object>} Token response
 */
const exchangeCodeForTokens = async (code, redirectUri) => {
    try {
        const config = azureConfig.patient;
        const tokenEndpoint = `${config.authority}/oauth2/v2.0/token`;
        
        const body = new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code: code,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
        });

        const response = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body.toString()
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Token exchange failed: ${errorData.error_description || errorData.error}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Azure token exchange error:', error);
        throw error;
    }
};

/**
 * Get user information from Microsoft Graph
 * @param {string} accessToken - Access token
 * @returns {Promise<Object>} User information
 */
const getUserInfo = async (accessToken) => {
    try {
        const credential = new ClientSecretCredential(
            azureConfig.patient.tenantId,
            azureConfig.patient.clientId,
            azureConfig.patient.clientSecret
        );

        const graphClient = Client.initWithMiddleware({
            authProvider: {
                getAccessToken: async () => accessToken
            }
        });

        // Get basic user info
        const user = await graphClient.api('/me').get();
        
        // Get user's group memberships for role determination
        const groups = await graphClient.api('/me/memberOf').get();
        
        // Get user's manager (for healthcare proxy scenarios)
        let manager = null;
        try {
            manager = await graphClient.api('/me/manager').get();
        } catch {
            // Manager might not exist, which is fine
        }

        return {
            id: user.id,
            email: user.mail || user.userPrincipalName,
            name: user.displayName,
            firstName: user.givenName,
            lastName: user.surname,
            jobTitle: user.jobTitle,
            department: user.department,
            officeLocation: user.officeLocation,
            businessPhones: user.businessPhones,
            mobilePhone: user.mobilePhone,
            groups: groups.value.map(group => ({
                id: group.id,
                name: group.displayName,
                type: group['@odata.type']
            })),
            manager: manager ? {
                id: manager.id,
                name: manager.displayName,
                email: manager.mail || manager.userPrincipalName
            } : null,
            lastSignInDateTime: user.lastSignInDateTime,
            createdDateTime: user.createdDateTime
        };
    } catch (error) {
        console.error('Azure user info retrieval error:', error);
        throw error;
    }
};

/**
 * Determine patient role based on Azure AD groups
 * @param {Array} groups - User's Azure AD groups
 * @returns {string} Patient role
 */
const determinePatientRole = (groups) => {
    const roleMapping = azureConfig.patient.healthcareRoles;
    
    // Check for specific healthcare roles
    for (const group of groups) {
        const groupName = group.name.toLowerCase();
        
        if (groupName.includes('guardian') || groupName.includes('parent')) {
            return roleMapping.guardian;
        }
        if (groupName.includes('proxy') || groupName.includes('healthcare_proxy')) {
            return roleMapping.proxy;
        }
        if (groupName.includes('emergency') || groupName.includes('emergency_contact')) {
            return roleMapping.emergency;
        }
    }
    
    // Default to patient role
    return roleMapping.patient;
};

/**
 * Validate conditional access compliance
 * @param {Object} userInfo - User information from Azure AD
 * @param {Object} signInContext - Sign-in context
 * @returns {Object} Compliance status
 */
const validateConditionalAccess = (userInfo, signInContext = {}) => {
    const config = azureConfig.patient.conditionalAccess;
    const violations = [];
    
    // Check MFA requirement
    if (config.requireMFA && !signInContext.mfaCompleted) {
        violations.push({
            type: 'MFA_REQUIRED',
            message: 'Multi-factor authentication is required for patient access'
        });
    }
    
    // Check device compliance (if applicable)
    if (config.requireCompliantDevice && !signInContext.deviceCompliant) {
        violations.push({
            type: 'DEVICE_COMPLIANCE_REQUIRED',
            message: 'Access from compliant device is required'
        });
    }
    
    // Check for legacy authentication
    if (config.blockLegacyAuth && signInContext.isLegacyAuth) {
        violations.push({
            type: 'LEGACY_AUTH_BLOCKED',
            message: 'Legacy authentication methods are not allowed'
        });
    }
    
    return {
        compliant: violations.length === 0,
        violations: violations
    };
};

/**
 * Create logout URL for Azure Entra ID
 * @param {string} postLogoutRedirectUri - URL to redirect after logout
 * @returns {string} Logout URL
 */
const createLogoutUrl = (postLogoutRedirectUri) => {
    const config = azureConfig.patient;
    const params = new URLSearchParams({
        post_logout_redirect_uri: postLogoutRedirectUri
    });
    
    return `${config.authority}/oauth2/v2.0/logout?${params.toString()}`;
};

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object>} New token response
 */
const refreshAccessToken = async (refreshToken) => {
    try {
        const config = azureConfig.patient;
        const tokenEndpoint = `${config.authority}/oauth2/v2.0/token`;
        
        const body = new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
            scope: config.scopes.join(' ')
        });

        const response = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body.toString()
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Token refresh failed: ${errorData.error_description || errorData.error}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Azure token refresh error:', error);
        throw error;
    }
};

module.exports = {
    azureConfig,
    createPatientAuthUrl,
    exchangeCodeForTokens,
    getUserInfo,
    determinePatientRole,
    validateConditionalAccess,
    createLogoutUrl,
    refreshAccessToken
};