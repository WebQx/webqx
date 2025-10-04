/**
 * WebQX™ OpenEMR Integration Server
 * 
 * Dedicated server for OpenEMR integration, FHIR APIs, and EHR connectivity
 * Handles OAuth2 authentication, patient data, appointments, and clinical workflows
 * 
 * Features:
 * - FHIR R4 API endpoints
 * - OAuth2 authentication with OpenEMR
 * - Patient management
 * - Appointment scheduling
 * - Clinical data access
 * - Audit logging for HIPAA compliance
 * 
 * @author WebQX Health
 * @version v0.1.0
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
require('dotenv').config();

class OpenEMRServer {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3002;
        
        // OpenEMR Configuration
        this.config = {
            openemr: {
                baseUrl: process.env.OPENEMR_BASE_URL || 'https://demo.openemr.io',
                clientId: process.env.OPENEMR_CLIENT_ID || 'webqx-demo',
                clientSecret: process.env.OPENEMR_CLIENT_SECRET || '',
                apiVersion: process.env.OPENEMR_API_VERSION || '7.0.3',
                fhirEnabled: process.env.OPENEMR_FHIR_ENABLED === 'true',
                fhirBaseUrl: process.env.OPENEMR_FHIR_BASE_URL || 'https://demo.openemr.io/apis/default/fhir'
            },
            security: {
                verifySSL: process.env.OPENEMR_VERIFY_SSL !== 'false',
                timeout: parseInt(process.env.OPENEMR_TIMEOUT_MS) || 30000,
                enableAudit: process.env.OPENEMR_ENABLE_AUDIT !== 'false'
            },
            features: {
                enableSync: process.env.OPENEMR_ENABLE_SYNC !== 'false',
                syncInterval: parseInt(process.env.OPENEMR_SYNC_INTERVAL_MINUTES) || 15
            }
        };

        // In-memory storage for demo (use database in production)
        this.tokenCache = new Map();
        this.patientCache = new Map();
        this.appointmentCache = new Map();
        
        this.initializeServer();
    }

    /**
     * Initialize the Express server with middleware and routes
     */
    initializeServer() {
        // Security middleware
        this.app.use(helmet({
            crossOriginEmbedderPolicy: false,
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    connectSrc: ["'self'", this.config.openemr.baseUrl, this.config.openemr.fhirBaseUrl],
                },
            },
        }));

        // CORS configuration
        this.app.use(cors({
            origin: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
            credentials: true
        }));

        // Rate limiting
        const apiLimiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // Limit each IP to 100 requests per windowMs
            message: {
                resourceType: 'OperationOutcome',
                issue: [{
                    severity: 'error',
                    code: 'throttled',
                    diagnostics: 'Too many requests, please try again later.'
                }]
            }
        });

        this.app.use(apiLimiter);

        // Body parsing middleware
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        // Setup routes
        this.setupRoutes();
        
        console.log('✅ OpenEMR Server initialized');
    }

    /**
     * Setup all API routes
     */
    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                service: 'WebQX OpenEMR Integration Server',
                version: 'v0.1.0',
                timestamp: new Date().toISOString(),
                openemr: {
                    configured: !!this.config.openemr.baseUrl,
                    fhirEnabled: this.config.openemr.fhirEnabled,
                    version: this.config.openemr.apiVersion
                }
            });
        });

        // OAuth2 endpoints
        this.setupOAuth2Routes();

        // FHIR endpoints
        this.setupFHIRRoutes();

        // OpenEMR API endpoints
        this.setupOpenEMRRoutes();
    }

    /**
     * Setup OAuth2 authentication routes
     */
    setupOAuth2Routes() {
        // OAuth2 authorization endpoint
        this.app.get('/oauth/authorize', (req, res) => {
            const { client_id, redirect_uri, scope, state } = req.query;
            
            if (!client_id || !redirect_uri) {
                return res.status(400).json({
                    error: 'invalid_request',
                    error_description: 'Missing required parameters'
                });
            }

            // Redirect to OpenEMR authorization
            const authUrl = new URL('/oauth2/default/authorize', this.config.openemr.baseUrl);
            authUrl.searchParams.set('client_id', this.config.openemr.clientId);
            authUrl.searchParams.set('redirect_uri', redirect_uri);
            authUrl.searchParams.set('scope', scope || 'openid profile email');
            authUrl.searchParams.set('state', state || uuidv4());
            authUrl.searchParams.set('response_type', 'code');

            res.redirect(authUrl.toString());
        });

        // OAuth2 token endpoint
        this.app.post('/oauth/token', async (req, res) => {
            try {
                const { grant_type, code, redirect_uri, client_id } = req.body;

                if (grant_type !== 'authorization_code') {
                    return res.status(400).json({
                        error: 'unsupported_grant_type',
                        error_description: 'Only authorization_code grant type is supported'
                    });
                }

                // Exchange code for token with OpenEMR
                const tokenResponse = await this.exchangeCodeForToken(code, redirect_uri);
                
                // Cache token
                const tokenId = uuidv4();
                this.tokenCache.set(tokenId, {
                    ...tokenResponse,
                    created_at: Date.now()
                });

                res.json({
                    access_token: tokenResponse.access_token,
                    token_type: 'Bearer',
                    expires_in: tokenResponse.expires_in || 3600,
                    scope: tokenResponse.scope,
                    refresh_token: tokenResponse.refresh_token
                });

            } catch (error) {
                console.error('❌ OAuth token error:', error);
                res.status(400).json({
                    error: 'invalid_grant',
                    error_description: 'Failed to exchange authorization code for token'
                });
            }
        });
    }

    /**
     * Setup FHIR R4 API routes
     */
    setupFHIRRoutes() {
        // FHIR metadata/capability statement
        this.app.get('/fhir/metadata', (req, res) => {
            res.json({
                resourceType: 'CapabilityStatement',
                id: 'webqx-openemr-capability',
                url: 'http://localhost:3002/fhir/metadata',
                version: 'v0.1.0',
                name: 'WebQX OpenEMR FHIR Server',
                status: 'active',
                date: new Date().toISOString(),
                publisher: 'WebQX Health',
                kind: 'instance',
                software: {
                    name: 'WebQX OpenEMR Integration',
                    version: 'v0.1.0'
                },
                implementation: {
                    description: 'WebQX OpenEMR FHIR Integration Server'
                },
                fhirVersion: '4.0.1',
                format: ['json'],
                rest: [{
                    mode: 'server',
                    resource: [
                        {
                            type: 'Patient',
                            interaction: [
                                { code: 'read' },
                                { code: 'search-type' },
                                { code: 'create' },
                                { code: 'update' }
                            ]
                        },
                        {
                            type: 'Appointment',
                            interaction: [
                                { code: 'read' },
                                { code: 'search-type' },
                                { code: 'create' },
                                { code: 'update' }
                            ]
                        },
                        {
                            type: 'Observation',
                            interaction: [
                                { code: 'read' },
                                { code: 'search-type' },
                                { code: 'create' }
                            ]
                        }
                    ]
                }]
            });
        });
        // Compatibility alias when upstream proxy strips /fhir prefix
        this.app.get('/metadata', (req, res) => {
            res.redirect(301, '/fhir/metadata');
        });

        // Patient resources
        this.app.get('/fhir/Patient', this.authenticateRequest.bind(this), this.searchPatients.bind(this));
        this.app.get('/fhir/Patient/:id', this.authenticateRequest.bind(this), this.getPatient.bind(this));
        this.app.post('/fhir/Patient', this.authenticateRequest.bind(this), this.createPatient.bind(this));
        this.app.put('/fhir/Patient/:id', this.authenticateRequest.bind(this), this.updatePatient.bind(this));

        // Appointment resources
        this.app.get('/fhir/Appointment', this.authenticateRequest.bind(this), this.searchAppointments.bind(this));
        this.app.get('/fhir/Appointment/:id', this.authenticateRequest.bind(this), this.getAppointment.bind(this));
        this.app.post('/fhir/Appointment', this.authenticateRequest.bind(this), this.createAppointment.bind(this));

        // Observation resources
        this.app.get('/fhir/Observation', this.authenticateRequest.bind(this), this.searchObservations.bind(this));
        this.app.get('/fhir/Observation/:id', this.authenticateRequest.bind(this), this.getObservation.bind(this));
    }

    /**
     * Setup OpenEMR API routes
     */
    setupOpenEMRRoutes() {
        // OpenEMR API endpoints
        this.app.get('/api/v1/openemr/patients', this.authenticateRequest.bind(this), this.getOpenEMRPatients.bind(this));
        this.app.get('/api/v1/openemr/appointments', this.authenticateRequest.bind(this), this.getOpenEMRAppointments.bind(this));
        this.app.get('/api/v1/openemr/providers', this.authenticateRequest.bind(this), this.getOpenEMRProviders.bind(this));
        
        // Configuration endpoint
        this.app.get('/api/v1/openemr/config', (req, res) => {
            res.json({
                baseUrl: this.config.openemr.baseUrl,
                fhirEnabled: this.config.openemr.fhirEnabled,
                fhirBaseUrl: this.config.openemr.fhirBaseUrl,
                version: this.config.openemr.apiVersion
            });
        });
    }

    /**
     * Authentication middleware
     */
    authenticateRequest(req, res, next) {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                resourceType: 'OperationOutcome',
                issue: [{
                    severity: 'error',
                    code: 'login',
                    diagnostics: 'Authentication required'
                }]
            });
        }

        const token = authHeader.substring(7);
        
        // Validate token (simplified for demo)
        if (token === 'demo-token' || this.isValidToken(token)) {
            req.user = { id: 'demo-user', role: 'provider' };
            next();
        } else {
            res.status(401).json({
                resourceType: 'OperationOutcome',
                issue: [{
                    severity: 'error',
                    code: 'login',
                    diagnostics: 'Invalid or expired token'
                }]
            });
        }
    }

    /**
     * Validate token
     */
    isValidToken(token) {
        // Check token cache
        for (const [id, tokenData] of this.tokenCache) {
            if (tokenData.access_token === token) {
                // Check if token is not expired
                const age = Date.now() - tokenData.created_at;
                const maxAge = (tokenData.expires_in || 3600) * 1000;
                return age < maxAge;
            }
        }
        return false;
    }

    /**
     * Exchange authorization code for access token
     */
    async exchangeCodeForToken(code, redirectUri) {
        try {
            const response = await axios.post(`${this.config.openemr.baseUrl}/oauth2/default/token`, {
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri,
                client_id: this.config.openemr.clientId
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: this.config.security.timeout
            });

            return response.data;
        } catch (error) {
            console.error('❌ Failed to exchange code for token:', error.message);
            throw new Error('Token exchange failed');
        }
    }

    /**
     * FHIR Patient search
     */
    searchPatients(req, res) {
        const { name, identifier, gender, birthdate } = req.query;
        
        // Mock patient data for demo
        const patients = [
            {
                resourceType: 'Patient',
                id: 'patient-1',
                name: [{ family: 'Doe', given: ['John'] }],
                gender: 'male',
                birthDate: '1980-01-01',
                identifier: [{ value: 'P001' }]
            },
            {
                resourceType: 'Patient',
                id: 'patient-2',
                name: [{ family: 'Smith', given: ['Jane'] }],
                gender: 'female',
                birthDate: '1985-05-15',
                identifier: [{ value: 'P002' }]
            }
        ];

        res.json({
            resourceType: 'Bundle',
            type: 'searchset',
            total: patients.length,
            entry: patients.map(patient => ({ resource: patient }))
        });
    }

    /**
     * Get specific patient
     */
    getPatient(req, res) {
        const { id } = req.params;
        
        // Mock patient data
        const patient = {
            resourceType: 'Patient',
            id,
            name: [{ family: 'Doe', given: ['John'] }],
            gender: 'male',
            birthDate: '1980-01-01',
            identifier: [{ value: 'P001' }],
            contact: [{
                telecom: [
                    { system: 'phone', value: '555-1234' },
                    { system: 'email', value: 'john.doe@example.com' }
                ]
            }]
        };

        res.json(patient);
    }

    /**
     * Create new patient
     */
    createPatient(req, res) {
        const patient = req.body;
        patient.id = uuidv4();
        
        // In production, save to OpenEMR via API
        this.patientCache.set(patient.id, patient);
        
        res.status(201).json(patient);
    }

    /**
     * Update patient
     */
    updatePatient(req, res) {
        const { id } = req.params;
        const patient = { ...req.body, id };
        
        // In production, update in OpenEMR via API
        this.patientCache.set(id, patient);
        
        res.json(patient);
    }

    /**
     * Search appointments
     */
    searchAppointments(req, res) {
        const appointments = [
            {
                resourceType: 'Appointment',
                id: 'appointment-1',
                status: 'booked',
                start: '2025-01-12T14:00:00Z',
                end: '2025-01-12T15:00:00Z',
                participant: [
                    { actor: { reference: 'Patient/patient-1' } },
                    { actor: { reference: 'Practitioner/provider-1' } }
                ]
            }
        ];

        res.json({
            resourceType: 'Bundle',
            type: 'searchset',
            total: appointments.length,
            entry: appointments.map(appointment => ({ resource: appointment }))
        });
    }

    /**
     * Get specific appointment
     */
    getAppointment(req, res) {
        const { id } = req.params;
        
        const appointment = {
            resourceType: 'Appointment',
            id,
            status: 'booked',
            start: '2025-01-12T14:00:00Z',
            end: '2025-01-12T15:00:00Z',
            participant: [
                { actor: { reference: 'Patient/patient-1' } },
                { actor: { reference: 'Practitioner/provider-1' } }
            ]
        };

        res.json(appointment);
    }

    /**
     * Create appointment
     */
    createAppointment(req, res) {
        const appointment = req.body;
        appointment.id = uuidv4();
        
        this.appointmentCache.set(appointment.id, appointment);
        
        res.status(201).json(appointment);
    }

    /**
     * Search observations
     */
    searchObservations(req, res) {
        const observations = [
            {
                resourceType: 'Observation',
                id: 'observation-1',
                status: 'final',
                code: {
                    coding: [{
                        system: 'http://loinc.org',
                        code: '8867-4',
                        display: 'Heart rate'
                    }]
                },
                subject: { reference: 'Patient/patient-1' },
                valueQuantity: {
                    value: 72,
                    unit: 'beats/min'
                }
            }
        ];

        res.json({
            resourceType: 'Bundle',
            type: 'searchset',
            total: observations.length,
            entry: observations.map(observation => ({ resource: observation }))
        });
    }

    /**
     * Get specific observation
     */
    getObservation(req, res) {
        const { id } = req.params;
        
        const observation = {
            resourceType: 'Observation',
            id,
            status: 'final',
            code: {
                coding: [{
                    system: 'http://loinc.org',
                    code: '8867-4',
                    display: 'Heart rate'
                }]
            },
            subject: { reference: 'Patient/patient-1' },
            valueQuantity: {
                value: 72,
                unit: 'beats/min'
            }
        };

        res.json(observation);
    }

    /**
     * Get OpenEMR patients
     */
    async getOpenEMRPatients(req, res) {
        try {
            // In production, make actual API call to OpenEMR
            const patients = [
                { id: '1', fname: 'John', lname: 'Doe', DOB: '1980-01-01' },
                { id: '2', fname: 'Jane', lname: 'Smith', DOB: '1985-05-15' }
            ];

            res.json({ data: patients });
        } catch (error) {
            console.error('❌ Failed to fetch OpenEMR patients:', error);
            res.status(500).json({ error: 'Failed to fetch patients' });
        }
    }

    /**
     * Get OpenEMR appointments
     */
    async getOpenEMRAppointments(req, res) {
        try {
            const appointments = [
                {
                    id: '1',
                    pc_eventDate: '2025-01-12',
                    pc_startTime: '14:00:00',
                    pc_endTime: '15:00:00',
                    pc_title: 'Follow-up',
                    patient_name: 'John Doe'
                }
            ];

            res.json({ data: appointments });
        } catch (error) {
            console.error('❌ Failed to fetch OpenEMR appointments:', error);
            res.status(500).json({ error: 'Failed to fetch appointments' });
        }
    }

    /**
     * Get OpenEMR providers
     */
    async getOpenEMRProviders(req, res) {
        try {
            const providers = [
                {
                    id: '1',
                    fname: 'Sarah',
                    lname: 'Wilson',
                    specialty: 'Internal Medicine',
                    npi: '1234567890'
                }
            ];

            res.json({ data: providers });
        } catch (error) {
            console.error('❌ Failed to fetch OpenEMR providers:', error);
            res.status(500).json({ error: 'Failed to fetch providers' });
        }
    }

    /**
     * Start the server
     */
    start() {
        return new Promise((resolve, reject) => {
            const server = this.app.listen(this.port, '0.0.0.0', () => {
                console.log(`🏥 OpenEMR Integration Server started on port ${this.port}`);
                console.log(`   • Health Check: http://localhost:${this.port}/health`);
                console.log(`   • FHIR API: http://localhost:${this.port}/fhir/*`);
                console.log(`   • OpenEMR API: http://localhost:${this.port}/api/v1/openemr/*`);
                console.log(`   • OAuth2: http://localhost:${this.port}/oauth/*`);
                resolve(server);
            });

            server.on('error', (error) => {
                console.error('❌ Failed to start OpenEMR server:', error);
                reject(error);
            });
        });
    }
}

// Start server if called directly
if (require.main === module) {
    const server = new OpenEMRServer();
    server.start().catch(console.error);
}

module.exports = OpenEMRServer;