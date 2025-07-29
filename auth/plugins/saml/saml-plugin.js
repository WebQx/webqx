/**
 * SAML Authentication Plugin
 * Supports Azure AD, OneLogin, and Ping Identity providers
 */

const crypto = require('crypto');
const { getProviderConfig, validateProviderConfig, mapRole } = require('../sso-config');
const auditLogger = require('../audit/audit-logger');

/**
 * SAML Provider implementations
 */
class SAMLProvider {
    constructor(providerName) {
        this.providerName = providerName;
        this.config = getProviderConfig('saml', providerName);
        
        if (!this.config) {
            throw new Error(`SAML provider '${providerName}' not found`);
        }
        
        const validation = validateProviderConfig('saml', providerName);
        if (!validation.valid) {
            throw new Error(`Invalid SAML configuration for '${providerName}': ${validation.errors.join(', ')}`);
        }
    }

    /**
     * Generate SAML authentication request
     * @param {string} relayState - RelayState parameter
     * @returns {Object} SAML request details
     */
    generateAuthRequest(relayState) {
        const requestId = this.generateRequestId();
        const timestamp = new Date().toISOString();
        
        // Generate SAML AuthnRequest XML
        const authnRequest = this.buildAuthnRequest(requestId, timestamp);
        
        // In a real implementation, this would be properly signed and base64 encoded
        const encodedRequest = Buffer.from(authnRequest).toString('base64');
        
        auditLogger.logInfo('saml_auth_request_generated', {
            provider: this.providerName,
            requestId: requestId,
            relayState: relayState,
            timestamp: timestamp
        });

        return {
            requestId,
            authUrl: this.buildAuthUrl(encodedRequest, relayState),
            relayState,
            timestamp
        };
    }

    /**
     * Process SAML response
     * @param {string} samlResponse - Base64 encoded SAML response
     * @param {string} relayState - RelayState parameter
     * @returns {Promise<Object>} Processed user information
     */
    async processSAMLResponse(samlResponse, relayState) {
        try {
            // In a real implementation, this would:
            // 1. Decode and parse the SAML response
            // 2. Verify signatures and certificates
            // 3. Validate timestamps and conditions
            // 4. Extract assertions and attributes
            
            // For demo purposes, we'll simulate this process
            const decodedResponse = Buffer.from(samlResponse, 'base64').toString('utf8');
            const userInfo = await this.simulateSAMLResponseProcessing(decodedResponse, relayState);
            
            auditLogger.logSuccess('saml_response_processed', {
                provider: this.providerName,
                userId: userInfo.nameId,
                email: userInfo.email,
                relayState: relayState,
                timestamp: new Date().toISOString()
            });

            return userInfo;
        } catch (error) {
            auditLogger.logFailure('saml_response_processing_failed', {
                provider: this.providerName,
                error: error.message,
                relayState: relayState,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    /**
     * Build SAML AuthnRequest XML
     * @param {string} requestId - Request ID
     * @param {string} timestamp - Timestamp
     * @returns {string} SAML AuthnRequest XML
     */
    buildAuthnRequest(requestId, timestamp) {
        const spEntityId = this.getServiceProviderEntityId();
        const acsUrl = this.getAssertionConsumerServiceUrl();
        
        return `<?xml version="1.0" encoding="UTF-8"?>
<samlp:AuthnRequest 
    xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
    xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
    ID="${requestId}"
    Version="2.0"
    IssueInstant="${timestamp}"
    Destination="${this.config.ssoUrl}"
    AssertionConsumerServiceURL="${acsUrl}"
    ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
    <saml:Issuer>${spEntityId}</saml:Issuer>
    <samlp:NameIDPolicy 
        Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
        AllowCreate="true"/>
    <samlp:RequestedAuthnContext Comparison="exact">
        <saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef>
    </samlp:RequestedAuthnContext>
</samlp:AuthnRequest>`;
    }

    /**
     * Build authentication URL
     * @param {string} encodedRequest - Base64 encoded SAML request
     * @param {string} relayState - RelayState parameter
     * @returns {string} Authentication URL
     */
    buildAuthUrl(encodedRequest, relayState) {
        const params = new URLSearchParams({
            SAMLRequest: encodedRequest,
            RelayState: relayState || ''
        });

        return `${this.config.ssoUrl}?${params.toString()}`;
    }

    /**
     * Simulate SAML response processing (for demo purposes)
     * In production, this would parse and validate actual SAML XML
     */
    async simulateSAMLResponseProcessing(samlResponse, relayState) {
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 200));

        // Generate demo user data based on provider
        const baseUser = {
            nameId: `demo-user-${this.providerName}@webqx-health.example.com`,
            sessionIndex: crypto.randomBytes(16).toString('hex'),
            issuer: this.config.entityId,
            notBefore: new Date().toISOString(),
            notOnOrAfter: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 hours
            attributes: this.generateDemoAttributes()
        };

        return baseUser;
    }

    /**
     * Generate demo SAML attributes based on provider
     * @returns {Object} Demo attributes
     */
    generateDemoAttributes() {
        const mapping = this.config.attributeMapping;
        
        switch (this.providerName) {
            case 'azureAd':
                return {
                    [mapping.email]: 'demo.user@webqx-health.example.com',
                    [mapping.firstName]: 'Demo',
                    [mapping.lastName]: 'User',
                    [mapping.roles]: 'Healthcare User,Patient Portal Access',
                    'http://schemas.microsoft.com/identity/claims/tenantid': 'demo-tenant-id',
                    'http://schemas.microsoft.com/identity/claims/objectidentifier': crypto.randomBytes(16).toString('hex')
                };
            
            case 'oneLogin':
                return {
                    [mapping.email]: 'demo.user@webqx-health.example.com',
                    [mapping.firstName]: 'Demo',
                    [mapping.lastName]: 'User',
                    [mapping.roles]: 'healthcare-user',
                    'User.Department': 'Healthcare',
                    'User.Title': 'Healthcare Professional'
                };
            
            case 'pingIdentity':
                return {
                    [mapping.email]: 'demo.user@webqx-health.example.com',
                    [mapping.firstName]: 'Demo',
                    [mapping.lastName]: 'User',
                    [mapping.roles]: 'cn=healthcare-users,ou=groups,dc=webqx,dc=health',
                    'department': 'Healthcare Services',
                    'title': 'Healthcare Professional'
                };
            
            default:
                return {
                    email: 'demo.user@webqx-health.example.com',
                    firstName: 'Demo',
                    lastName: 'User',
                    role: 'user'
                };
        }
    }

    /**
     * Extract user information from SAML attributes
     * @param {Object} attributes - SAML attributes
     * @returns {Object} Extracted user information
     */
    extractUserInfo(attributes) {
        const mapping = this.config.attributeMapping;
        
        const userInfo = {
            email: this.getAttributeValue(attributes, mapping.email),
            firstName: this.getAttributeValue(attributes, mapping.firstName),
            lastName: this.getAttributeValue(attributes, mapping.lastName),
            roles: this.getAttributeValue(attributes, mapping.roles)
        };

        // Parse roles
        let roles = [];
        if (userInfo.roles) {
            if (Array.isArray(userInfo.roles)) {
                roles = userInfo.roles;
            } else {
                roles = userInfo.roles.split(',').map(r => r.trim());
            }
        }

        // Map roles to internal roles
        const mappedRoles = roles.map(role => mapRole(role)).filter(Boolean);
        if (mappedRoles.length === 0) {
            mappedRoles.push('patient'); // Default role
        }

        return {
            email: userInfo.email,
            name: `${userInfo.firstName} ${userInfo.lastName}`.trim(),
            firstName: userInfo.firstName,
            lastName: userInfo.lastName,
            role: mappedRoles[0], // Primary role
            roles: mappedRoles,
            provider: this.providerName,
            attributes: attributes
        };
    }

    /**
     * Get attribute value from SAML attributes
     * @param {Object} attributes - SAML attributes
     * @param {string} attributeName - Attribute name
     * @returns {string|Array} Attribute value
     */
    getAttributeValue(attributes, attributeName) {
        const value = attributes[attributeName];
        if (Array.isArray(value)) {
            return value.length === 1 ? value[0] : value;
        }
        return value;
    }

    /**
     * Generate SAML request ID
     * @returns {string} Request ID
     */
    generateRequestId() {
        return '_' + crypto.randomBytes(16).toString('hex');
    }

    /**
     * Get Service Provider entity ID
     * @returns {string} SP entity ID
     */
    getServiceProviderEntityId() {
        return process.env.SAML_SP_ENTITY_ID || 'https://webqx-health.example.com';
    }

    /**
     * Get Assertion Consumer Service URL
     * @returns {string} ACS URL
     */
    getAssertionConsumerServiceUrl() {
        return process.env.SAML_ACS_URL || `https://webqx-health.example.com/auth/saml/${this.providerName}/callback`;
    }

    /**
     * Generate SP metadata XML
     * @returns {string} SP metadata XML
     */
    generateSPMetadata() {
        const spEntityId = this.getServiceProviderEntityId();
        const acsUrl = this.getAssertionConsumerServiceUrl();
        
        return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor 
    xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
    entityID="${spEntityId}">
    <md:SPSSODescriptor 
        protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol"
        WantAssertionsSigned="true">
        <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
        <md:AssertionConsumerService 
            Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
            Location="${acsUrl}"
            index="0"/>
    </md:SPSSODescriptor>
</md:EntityDescriptor>`;
    }
}

/**
 * SAML Authentication Service
 */
class SAMLAuthService {
    constructor() {
        this.providers = new Map();
        this.requestStore = new Map(); // In production, use Redis or database
        
        // Initialize enabled providers
        this.initializeProviders();
    }

    /**
     * Initialize SAML providers
     */
    initializeProviders() {
        const providerNames = ['azureAd', 'oneLogin', 'pingIdentity'];
        
        providerNames.forEach(providerName => {
            try {
                const config = getProviderConfig('saml', providerName);
                if (config && config.enabled) {
                    const provider = new SAMLProvider(providerName);
                    this.providers.set(providerName, provider);
                    console.log(`SAML provider '${providerName}' initialized successfully`);
                }
            } catch (error) {
                console.warn(`Failed to initialize SAML provider '${providerName}':`, error.message);
            }
        });
    }

    /**
     * Get available SAML providers
     * @returns {Array} List of available provider names
     */
    getAvailableProviders() {
        return Array.from(this.providers.keys());
    }

    /**
     * Start SAML authentication flow
     * @param {string} providerName - Provider name
     * @param {Object} options - Authentication options
     * @returns {Object} Authentication flow details
     */
    startAuthFlow(providerName, options = {}) {
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new Error(`SAML provider '${providerName}' not available`);
        }

        // Generate RelayState
        const relayState = crypto.randomBytes(32).toString('hex');
        
        // Generate SAML request
        const authRequest = provider.generateAuthRequest(relayState);
        
        // Store request data
        this.requestStore.set(relayState, {
            provider: providerName,
            requestId: authRequest.requestId,
            timestamp: Date.now(),
            returnUrl: options.returnUrl || '/'
        });

        // Clean up old requests
        this.cleanupRequests();

        auditLogger.logInfo('saml_auth_started', {
            provider: providerName,
            requestId: authRequest.requestId,
            relayState: relayState,
            timestamp: new Date().toISOString()
        });

        return authRequest;
    }

    /**
     * Handle SAML callback
     * @param {string} samlResponse - Base64 encoded SAML response
     * @param {string} relayState - RelayState parameter
     * @returns {Promise<Object>} Authentication result
     */
    async handleCallback(samlResponse, relayState) {
        if (!samlResponse || !relayState) {
            auditLogger.logFailure('saml_callback', {
                error: 'Missing SAML response or RelayState',
                relayState: relayState,
                timestamp: new Date().toISOString()
            });
            throw new Error('Missing SAML response or RelayState parameter');
        }

        // Verify RelayState
        const requestData = this.requestStore.get(relayState);
        if (!requestData) {
            auditLogger.logFailure('saml_callback', {
                error: 'Invalid or expired RelayState',
                relayState: relayState,
                timestamp: new Date().toISOString()
            });
            throw new Error('Invalid or expired RelayState parameter');
        }

        // Remove used RelayState
        this.requestStore.delete(relayState);

        const provider = this.providers.get(requestData.provider);
        if (!provider) {
            throw new Error(`SAML provider '${requestData.provider}' not available`);
        }

        try {
            // Process SAML response
            const samlData = await provider.processSAMLResponse(samlResponse, relayState);
            
            // Extract user information
            const userInfo = provider.extractUserInfo(samlData.attributes);
            
            // Map user information to internal format
            const mappedUser = this.mapUserInfo(userInfo, samlData, requestData.provider);

            auditLogger.logSuccess('saml_login_success', {
                provider: requestData.provider,
                userId: mappedUser.id,
                email: mappedUser.email,
                role: mappedUser.role,
                sessionIndex: samlData.sessionIndex,
                timestamp: new Date().toISOString()
            });

            return {
                success: true,
                user: mappedUser,
                samlData: samlData,
                provider: requestData.provider,
                returnUrl: requestData.returnUrl
            };

        } catch (error) {
            auditLogger.logFailure('saml_login_failed', {
                provider: requestData.provider,
                error: error.message,
                relayState: relayState,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    /**
     * Map SAML user info to internal format
     * @param {Object} userInfo - User info from SAML
     * @param {Object} samlData - SAML response data
     * @param {string} providerName - Provider name
     * @returns {Object} Mapped user information
     */
    mapUserInfo(userInfo, samlData, providerName) {
        return {
            id: samlData.nameId,
            email: userInfo.email,
            emailVerified: true, // SAML assertions are typically verified
            name: userInfo.name,
            firstName: userInfo.firstName,
            lastName: userInfo.lastName,
            role: userInfo.role,
            roles: userInfo.roles,
            provider: providerName,
            providerUserId: samlData.nameId,
            sessionIndex: samlData.sessionIndex,
            lastLogin: new Date().toISOString(),
            samlAttributes: userInfo.attributes
        };
    }

    /**
     * Generate logout request
     * @param {string} providerName - Provider name
     * @param {string} nameId - User's name ID
     * @param {string} sessionIndex - SAML session index
     * @returns {Object} Logout request details
     */
    generateLogoutRequest(providerName, nameId, sessionIndex) {
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new Error(`SAML provider '${providerName}' not available`);
        }

        const requestId = provider.generateRequestId();
        const timestamp = new Date().toISOString();
        
        // Generate SAML LogoutRequest XML
        const logoutRequest = this.buildLogoutRequest(requestId, timestamp, nameId, sessionIndex, provider);
        
        // In a real implementation, this would be properly signed and base64 encoded
        const encodedRequest = Buffer.from(logoutRequest).toString('base64');
        
        const logoutUrl = this.buildLogoutUrl(provider, encodedRequest);

        auditLogger.logInfo('saml_logout_request_generated', {
            provider: providerName,
            requestId: requestId,
            nameId: nameId,
            sessionIndex: sessionIndex,
            timestamp: timestamp
        });

        return {
            requestId,
            logoutUrl,
            timestamp
        };
    }

    /**
     * Build SAML LogoutRequest XML
     * @param {string} requestId - Request ID
     * @param {string} timestamp - Timestamp
     * @param {string} nameId - User's name ID
     * @param {string} sessionIndex - Session index
     * @param {SAMLProvider} provider - SAML provider
     * @returns {string} SAML LogoutRequest XML
     */
    buildLogoutRequest(requestId, timestamp, nameId, sessionIndex, provider) {
        const spEntityId = provider.getServiceProviderEntityId();
        const sloUrl = this.getSingleLogoutServiceUrl(provider.providerName);
        
        return `<?xml version="1.0" encoding="UTF-8"?>
<samlp:LogoutRequest 
    xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
    xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
    ID="${requestId}"
    Version="2.0"
    IssueInstant="${timestamp}"
    Destination="${sloUrl}">
    <saml:Issuer>${spEntityId}</saml:Issuer>
    <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${nameId}</saml:NameID>
    <samlp:SessionIndex>${sessionIndex}</samlp:SessionIndex>
</samlp:LogoutRequest>`;
    }

    /**
     * Build logout URL
     * @param {SAMLProvider} provider - SAML provider
     * @param {string} encodedRequest - Base64 encoded logout request
     * @returns {string} Logout URL
     */
    buildLogoutUrl(provider, encodedRequest) {
        const sloUrl = this.getSingleLogoutServiceUrl(provider.providerName);
        const params = new URLSearchParams({
            SAMLRequest: encodedRequest
        });

        return `${sloUrl}?${params.toString()}`;
    }

    /**
     * Get Single Logout Service URL for provider
     * @param {string} providerName - Provider name
     * @returns {string} SLO URL
     */
    getSingleLogoutServiceUrl(providerName) {
        const config = getProviderConfig('saml', providerName);
        return config.sloUrl || config.ssoUrl; // Fallback to SSO URL if SLO not specified
    }

    /**
     * Get SP metadata for a provider
     * @param {string} providerName - Provider name
     * @returns {string} SP metadata XML
     */
    getSPMetadata(providerName) {
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new Error(`SAML provider '${providerName}' not available`);
        }

        return provider.generateSPMetadata();
    }

    /**
     * Clean up expired requests
     */
    cleanupRequests() {
        const now = Date.now();
        const maxAge = 10 * 60 * 1000; // 10 minutes

        for (const [relayState, data] of this.requestStore.entries()) {
            if (now - data.timestamp > maxAge) {
                this.requestStore.delete(relayState);
            }
        }
    }
}

module.exports = {
    SAMLProvider,
    SAMLAuthService
};