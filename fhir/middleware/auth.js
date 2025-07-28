const jwt = require('jsonwebtoken');

/**
 * OAuth2 and FHIR Security Middleware
 * Implements basic JWT-based authentication for FHIR endpoints
 */

// JWT Secret (in production, this should come from environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'webqx-fhir-secret-key-change-in-production';

/**
 * Mock OAuth2 token store (in production, use proper token management)
 */
const tokenStore = new Map();

/**
 * Generate a JWT token for testing
 * @param {Object} payload - Token payload
 * @returns {string} JWT token
 */
function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { 
        expiresIn: '1h',
        issuer: 'webqx-fhir-server',
        audience: 'webqx-fhir-api'
    });
}

/**
 * Middleware to authenticate FHIR requests
 */
function authenticateToken(req, res, next) {
    // Skip authentication for health check and some read operations in development
    if (process.env.NODE_ENV === 'development' && req.method === 'GET') {
        return next();
    }
    
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
        return res.status(401).json({
            resourceType: 'OperationOutcome',
            issue: [{
                severity: 'error',
                code: 'login',
                diagnostics: 'Access token required'
            }]
        });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({
                resourceType: 'OperationOutcome',
                issue: [{
                    severity: 'error',
                    code: 'forbidden',
                    diagnostics: 'Invalid or expired token'
                }]
            });
        }
        
        req.user = user;
        next();
    });
}

/**
 * Middleware to check FHIR scopes
 * @param {Array<string>} requiredScopes - Required FHIR scopes
 */
function requireScopes(requiredScopes) {
    return (req, res, next) => {
        if (process.env.NODE_ENV === 'development') {
            return next(); // Skip scope checking in development
        }
        
        const userScopes = req.user?.scopes || [];
        const hasRequiredScope = requiredScopes.some(scope => 
            userScopes.includes(scope) || userScopes.includes('*')
        );
        
        if (!hasRequiredScope) {
            return res.status(403).json({
                resourceType: 'OperationOutcome',
                issue: [{
                    severity: 'error',
                    code: 'forbidden',
                    diagnostics: `Insufficient scope. Required: ${requiredScopes.join(' or ')}`
                }]
            });
        }
        
        next();
    };
}

/**
 * SMART on FHIR authorization endpoint (simplified)
 */
function createAuthEndpoint() {
    return (req, res) => {
        // In a real implementation, this would handle the full OAuth2 flow
        const { client_id, response_type, scope, redirect_uri, state } = req.query;
        
        // Basic validation
        if (!client_id || !redirect_uri || response_type !== 'code') {
            return res.status(400).json({
                error: 'invalid_request',
                error_description: 'Missing or invalid parameters'
            });
        }
        
        // Generate authorization code (simplified)
        const authCode = jwt.sign({
            client_id,
            scope: scope || 'patient/*.read',
            redirect_uri
        }, JWT_SECRET, { expiresIn: '10m' });
        
        // Redirect with authorization code
        const redirectUrl = new URL(redirect_uri);
        redirectUrl.searchParams.set('code', authCode);
        if (state) redirectUrl.searchParams.set('state', state);
        
        res.redirect(redirectUrl.toString());
    };
}

/**
 * Token endpoint for OAuth2
 */
function createTokenEndpoint() {
    return (req, res) => {
        const { grant_type, code, client_id, client_secret, redirect_uri } = req.body;
        
        if (grant_type !== 'authorization_code') {
            return res.status(400).json({
                error: 'unsupported_grant_type',
                error_description: 'Only authorization_code grant type is supported'
            });
        }
        
        try {
            // Verify authorization code
            const authData = jwt.verify(code, JWT_SECRET);
            
            if (authData.client_id !== client_id || authData.redirect_uri !== redirect_uri) {
                return res.status(400).json({
                    error: 'invalid_grant',
                    error_description: 'Invalid authorization code'
                });
            }
            
            // Generate access token
            const accessToken = generateToken({
                client_id,
                scopes: authData.scope.split(' '),
                type: 'access_token'
            });
            
            // Generate refresh token
            const refreshToken = generateToken({
                client_id,
                type: 'refresh_token'
            });
            
            res.json({
                access_token: accessToken,
                token_type: 'Bearer',
                expires_in: 3600,
                refresh_token: refreshToken,
                scope: authData.scope
            });
            
        } catch (error) {
            res.status(400).json({
                error: 'invalid_grant',
                error_description: 'Invalid or expired authorization code'
            });
        }
    };
}

/**
 * FHIR capability statement endpoint
 */
function createCapabilityEndpoint() {
    return (req, res) => {
        const baseUrl = `${req.protocol}://${req.get('host')}/fhir`;
        
        const capability = {
            resourceType: 'CapabilityStatement',
            id: 'webqx-fhir-server',
            url: `${baseUrl}/metadata`,
            version: '1.0.0',
            name: 'WebQX FHIR Server',
            title: 'WebQX Healthcare Platform FHIR R4 Server',
            status: 'active',
            date: new Date().toISOString(),
            publisher: 'WebQX Health',
            description: 'FHIR R4 server for WebQX healthcare platform with full interoperability support',
            kind: 'instance',
            software: {
                name: 'WebQX FHIR Server',
                version: '1.0.0'
            },
            implementation: {
                description: 'WebQX FHIR R4 Server',
                url: baseUrl
            },
            fhirVersion: '4.0.1',
            format: ['application/fhir+json', 'application/json'],
            rest: [{
                mode: 'server',
                security: {
                    cors: true,
                    service: [{
                        coding: [{
                            system: 'http://terminology.hl7.org/CodeSystem/restful-security-service',
                            code: 'OAuth',
                            display: 'OAuth2'
                        }]
                    }],
                    description: 'OAuth2 with SMART on FHIR extensions'
                },
                resource: [{
                    type: 'Patient',
                    profile: 'http://hl7.org/fhir/StructureDefinition/Patient',
                    interaction: [
                        { code: 'read' },
                        { code: 'create' },
                        { code: 'update' },
                        { code: 'delete' },
                        { code: 'search-type' }
                    ],
                    searchParam: [
                        { name: 'name', type: 'string' },
                        { name: 'gender', type: 'token' },
                        { name: 'birthdate', type: 'date' },
                        { name: 'active', type: 'token' },
                        { name: 'identifier', type: 'token' }
                    ]
                }, {
                    type: 'Appointment',
                    profile: 'http://hl7.org/fhir/StructureDefinition/Appointment',
                    interaction: [
                        { code: 'read' },
                        { code: 'create' },
                        { code: 'update' },
                        { code: 'delete' },
                        { code: 'search-type' }
                    ],
                    searchParam: [
                        { name: 'patient', type: 'reference' },
                        { name: 'practitioner', type: 'reference' },
                        { name: 'status', type: 'token' },
                        { name: 'date', type: 'date' },
                        { name: 'service-type', type: 'token' }
                    ],
                    operation: [
                        { name: 'book', definition: 'http://hl7.org/fhir/OperationDefinition/Appointment-book' },
                        { name: 'cancel', definition: 'http://hl7.org/fhir/OperationDefinition/Appointment-cancel' }
                    ]
                }]
            }]
        };
        
        res.set('Content-Type', 'application/fhir+json; charset=utf-8');
        res.json(capability);
    };
}

/**
 * Generate test token for development
 */
function generateTestToken() {
    return generateToken({
        client_id: 'webqx-test-client',
        scopes: ['patient/*.read', 'patient/*.write', 'user/*.read'],
        type: 'access_token',
        user: 'test-user'
    });
}

module.exports = {
    authenticateToken,
    requireScopes,
    generateToken,
    generateTestToken,
    createAuthEndpoint,
    createTokenEndpoint,
    createCapabilityEndpoint
};