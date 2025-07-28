const express = require('express');
const path = require('path');
require('dotenv').config();

// HIPAA-Compliant Security Imports
const security = require('./middleware/security');
const auditLogger = require('./security/auditLogger');
const encryption = require('./security/encryption');
const auth = require('./security/authentication');
const fhirService = require('./services/fhirService');
const complianceValidator = require('./security/complianceValidator');
const passport = require('passport');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for accurate IP addresses in load balancer environments
app.set('trust proxy', 1);

// HIPAA-Compliant Security Middleware (Applied in order)
app.use(security.requestId); // Add unique request ID for tracking
app.use(security.securityHeaders); // Security headers (CSP, HSTS, etc.)
app.use(security.cors); // CORS configuration
app.use(security.compression); // Secure compression
app.use(security.securityLogger); // Security logging
app.use(security.generalRateLimit); // Rate limiting
app.use(security.validateHeaders); // Header validation

// Middleware for parsing JSON bodies with size limits
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// Session configuration for HIPAA compliance
app.use(session({
  secret: process.env.SESSION_SECRET || 'webqx-session-secret-change-in-production',
  name: 'webqx.sid',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    maxAge: 30 * 60 * 1000, // 30 minutes
    sameSite: 'strict'
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Serve static files
app.use(express.static(path.join(__dirname, '.')));

// Authentication Routes
app.post('/api/auth/login', security.authRateLimit, async (req, res) => {
    try {
        const { username, password, mfaToken } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                error: 'Missing credentials',
                message: 'Username and password are required'
            });
        }

        const result = await auth.authenticateUser(username, password, req);
        
        if (result.requiresMFA) {
            return res.status(200).json({
                requiresMFA: true,
                message: 'Multi-factor authentication required'
            });
        }

        res.status(200).json({
            success: true,
            user: result.user,
            tokens: result.tokens
        });
        
    } catch (error) {
        res.status(401).json({
            error: 'Authentication failed',
            message: error.message
        });
    }
});

app.post('/api/auth/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
            return res.status(400).json({
                error: 'Missing refresh token'
            });
        }

        const tokens = await auth.refreshToken(refreshToken);
        res.status(200).json(tokens);
        
    } catch (error) {
        res.status(401).json({
            error: 'Token refresh failed',
            message: error.message
        });
    }
});

app.post('/api/auth/logout', auth.requireAuth(), async (req, res) => {
    try {
        // Log logout event
        await auditLogger.logUserAction({
            userId: req.user.id,
            userRole: req.user.role,
            action: 'USER_LOGOUT',
            resource: 'authentication',
            outcome: 'SUCCESS',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            requestId: req.id
        });

        // Destroy session
        req.logout((err) => {
            if (err) {
                console.error('Logout error:', err);
            }
        });

        res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });
        
    } catch (error) {
        res.status(500).json({
            error: 'Logout failed',
            message: error.message
        });
    }
});

// OAuth2 Routes
app.get('/auth/oauth2', passport.authenticate('oauth2'));

app.get('/auth/oauth2/callback', 
    passport.authenticate('oauth2', { failureRedirect: '/login' }),
    async (req, res) => {
        // Log OAuth2 login
        await auditLogger.logUserAction({
            userId: req.user.id,
            userRole: req.user.role,
            action: 'OAUTH2_LOGIN',
            resource: 'authentication',
            outcome: 'SUCCESS',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            requestId: req.id,
            details: { provider: 'oauth2' }
        });

        // Redirect to dashboard or generate tokens for SPA
        res.redirect('/dashboard');
    }
);

// FHIR API Routes (HIPAA-Compliant)
app.post('/api/fhir/patient', auth.requireAuth(['write:patient_data']), async (req, res) => {
    try {
        const userContext = {
            id: req.user.id,
            role: req.user.role,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            requestId: req.id
        };

        const patient = await fhirService.createPatient(req.body, userContext);
        
        res.status(201).json({
            success: true,
            patient,
            message: 'Patient created successfully'
        });
        
    } catch (error) {
        res.status(400).json({
            error: 'Patient creation failed',
            message: error.message
        });
    }
});

app.get('/api/fhir/patient/:id', auth.requireAuth(['read:patient_data']), async (req, res) => {
    try {
        const userContext = {
            id: req.user.id,
            role: req.user.role,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            requestId: req.id
        };

        const patient = await fhirService.getPatient(req.params.id, userContext);
        
        res.status(200).json({
            success: true,
            patient
        });
        
    } catch (error) {
        res.status(404).json({
            error: 'Patient not found',
            message: error.message
        });
    }
});

app.get('/api/fhir/patient', auth.requireAuth(['read:patient_data']), async (req, res) => {
    try {
        const userContext = {
            id: req.user.id,
            role: req.user.role,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            requestId: req.id
        };

        const searchResults = await fhirService.searchPatients(req.query, userContext);
        
        res.status(200).json({
            success: true,
            results: searchResults
        });
        
    } catch (error) {
        res.status(400).json({
            error: 'Patient search failed',
            message: error.message
        });
    }
});

app.post('/api/fhir/medication-request', auth.requireAuth(['prescribe:medications']), async (req, res) => {
    try {
        const userContext = {
            id: req.user.id,
            role: req.user.role,
            practitionerId: req.user.practitionerId,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            requestId: req.id
        };

        const medicationRequest = await fhirService.createMedicationRequest(req.body, userContext);
        
        res.status(201).json({
            success: true,
            medicationRequest,
            message: 'Prescription created successfully'
        });
        
    } catch (error) {
        res.status(400).json({
            error: 'Prescription creation failed',
            message: error.message
        });
    }
});

app.post('/api/fhir/observation', auth.requireAuth(['write:patient_data']), async (req, res) => {
    try {
        const userContext = {
            id: req.user.id,
            role: req.user.role,
            practitionerId: req.user.practitionerId,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            requestId: req.id
        };

        const observation = await fhirService.createObservation(req.body, userContext);
        
        res.status(201).json({
            success: true,
            observation,
            message: 'Observation recorded successfully'
        });
        
    } catch (error) {
        res.status(400).json({
            error: 'Observation creation failed',
            message: error.message
        });
    }
});

// HIPAA Compliance Testing Endpoints
app.get('/api/compliance/test', auth.requireAuth(['admin']), async (req, res) => {
    try {
        const results = await complianceValidator.runComplianceTests();
        
        res.status(200).json({
            success: true,
            compliance: results
        });
        
    } catch (error) {
        res.status(500).json({
            error: 'Compliance test failed',
            message: error.message
        });
    }
});

app.get('/api/compliance/report', auth.requireAuth(['admin']), async (req, res) => {
    try {
        const results = await complianceValidator.runComplianceTests();
        const htmlReport = complianceValidator.generateComplianceReport();
        
        res.setHeader('Content-Type', 'text/html');
        res.status(200).send(htmlReport);
        
    } catch (error) {
        res.status(500).json({
            error: 'Compliance report generation failed',
            message: error.message
        });
    }
});

// Health check endpoint for Railway with enhanced security
app.get('/health', (req, res) => {
    // Log health check access
    auditLogger.logSystemEvent({
        event: 'HEALTH_CHECK_ACCESS',
        component: 'WebQX_Server',
        severity: 'INFO',
        details: {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
        }
    });

    res.status(200).json({ 
        status: 'healthy', 
        service: 'WebQX Healthcare Platform',
        timestamp: new Date().toISOString(),
        security: {
            encryption: 'AES-256-GCM',
            auditLogging: 'Enabled',
            rateLimit: 'Active',
            hipaaCompliant: true
        },
        version: '1.0.0'
    });
});

// Enhanced Translation API endpoint with security and audit logging
app.post('/api/whisper/translate', security.apiRateLimit, async (req, res) => {
    try {
        const { text, targetLang } = req.body;
        const userId = req.user?.id || 'anonymous';
        const sessionId = req.sessionID || req.id;

        // Log API access for audit trail
        await auditLogger.logUserAction({
            userId,
            userRole: req.user?.role || 'anonymous',
            sessionId,
            action: 'TRANSLATION_REQUEST',
            resource: 'whisper_api',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            requestId: req.id,
            details: {
                targetLanguage: targetLang,
                textLength: text?.length || 0
            }
        });

        // Validate request body
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            await auditLogger.logUserAction({
                userId,
                sessionId,
                action: 'TRANSLATION_REQUEST',
                resource: 'whisper_api',
                outcome: 'FAILURE',
                details: { error: 'Invalid text parameter' },
                ipAddress: req.ip,
                requestId: req.id
            });

            return res.status(400).json({
                message: 'Text parameter is required and must be a non-empty string',
                code: 'INVALID_TEXT',
                requestId: req.id
            });
        }

        if (!targetLang || typeof targetLang !== 'string' || targetLang.trim().length === 0) {
            await auditLogger.logUserAction({
                userId,
                sessionId,
                action: 'TRANSLATION_REQUEST',
                resource: 'whisper_api',
                outcome: 'FAILURE',
                details: { error: 'Invalid target language parameter' },
                ipAddress: req.ip,
                requestId: req.id
            });

            return res.status(400).json({
                message: 'Target language parameter is required and must be a non-empty string',
                code: 'INVALID_TARGET_LANG',
                requestId: req.id
            });
        }

        // Basic language code validation
        const langCodePattern = /^[a-z]{2,3}(-[A-Z]{2})?$/;
        if (!langCodePattern.test(targetLang.trim())) {
            await auditLogger.logUserAction({
                userId,
                sessionId,
                action: 'TRANSLATION_REQUEST',
                resource: 'whisper_api',
                outcome: 'FAILURE',
                details: { error: 'Invalid language code format' },
                ipAddress: req.ip,
                requestId: req.id
            });

            return res.status(400).json({
                message: 'Target language must be a valid language code (e.g., "en", "es", "fr")',
                code: 'INVALID_LANG_CODE',
                requestId: req.id
            });
        }

        // Mock translation service (in real implementation, this would call an actual translation API)
        const translations = {
            'es': {
                'Take 2 tablets daily': 'Tomar 2 tabletas al día',
                'Take with food': 'Tomar con comida',
                'Do not exceed 4 doses per day': 'No exceder 4 dosis por día',
                'May cause drowsiness': 'Puede causar somnolencia'
            },
            'fr': {
                'Take 2 tablets daily': 'Prendre 2 comprimés par jour',
                'Take with food': 'Prendre avec de la nourriture',
                'Do not exceed 4 doses per day': 'Ne pas dépasser 4 doses par jour',
                'May cause drowsiness': 'Peut causer de la somnolence'
            },
            'de': {
                'Take 2 tablets daily': 'Nehmen Sie täglich 2 Tabletten',
                'Take with food': 'Mit dem Essen einnehmen',
                'Do not exceed 4 doses per day': 'Nicht mehr als 4 Dosen pro Tag überschreiten',
                'May cause drowsiness': 'Kann Schläfrigkeit verursachen'
            }
        };

        const normalizedText = text.trim();
        const normalizedLang = targetLang.trim().toLowerCase();

        // Check if we have a translation for this text and language
        let translatedText = normalizedText; // Default to original text
        let confidence = 0.95;

        if (translations[normalizedLang] && translations[normalizedLang][normalizedText]) {
            translatedText = translations[normalizedLang][normalizedText];
        } else {
            // Simulate a basic translation by adding language-specific prefix
            const prefixes = {
                'es': '[ES] ',
                'fr': '[FR] ',
                'de': '[DE] ',
                'it': '[IT] ',
                'pt': '[PT] '
            };
            
            if (prefixes[normalizedLang]) {
                translatedText = prefixes[normalizedLang] + normalizedText;
                confidence = 0.75; // Lower confidence for fallback translation
            }
        }

        // Return successful translation response with enhanced security
        const response = {
            translatedText,
            sourceLanguage: 'en', // Assume English source for now
            targetLanguage: normalizedLang,
            confidence,
            requestId: req.id,
            timestamp: new Date().toISOString()
        };

        // Log successful translation
        await auditLogger.logUserAction({
            userId,
            sessionId,
            action: 'TRANSLATION_REQUEST',
            resource: 'whisper_api',
            outcome: 'SUCCESS',
            details: {
                targetLanguage: normalizedLang,
                confidence,
                textLength: normalizedText.length
            },
            ipAddress: req.ip,
            requestId: req.id
        });

        res.status(200).json(response);

    } catch (error) {
        console.error('Translation API error:', error);
        
        // Log error for audit trail
        await auditLogger.logUserAction({
            userId: req.user?.id || 'anonymous',
            sessionId: req.sessionID || req.id,
            action: 'TRANSLATION_REQUEST',
            resource: 'whisper_api',
            outcome: 'ERROR',
            details: { error: error.message },
            ipAddress: req.ip,
            requestId: req.id
        });

        res.status(500).json({
            message: 'Internal server error during translation',
            code: 'INTERNAL_ERROR',
            requestId: req.id
        });
    }
});

// Serve the main patient portal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Catch all other routes and serve the patient portal
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// HIPAA-Compliant Error Handling
app.use(security.securityErrorHandler);

// Graceful shutdown handling
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    
    await auditLogger.logSystemEvent({
        event: 'SERVER_SHUTDOWN',
        component: 'WebQX_Server',
        severity: 'INFO',
        details: { reason: 'SIGTERM' }
    });
    
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully');
    
    await auditLogger.logSystemEvent({
        event: 'SERVER_SHUTDOWN',
        component: 'WebQX_Server',
        severity: 'INFO',
        details: { reason: 'SIGINT' }
    });
    
    process.exit(0);
});

app.listen(PORT, '0.0.0.0', async () => {
    // Log server startup
    await auditLogger.logSystemEvent({
        event: 'SERVER_STARTUP',
        component: 'WebQX_Server',
        severity: 'INFO',
        details: {
            port: PORT,
            environment: process.env.NODE_ENV || 'development',
            securityEnabled: true,
            encryptionEnabled: true
        }
    });

    console.log(`🌐 WebQX Healthcare Platform is running on port ${PORT}`);
    console.log(`🩺 Patient Portal available at http://localhost:${PORT}`);
    console.log(`💊 Health check endpoint: http://localhost:${PORT}/health`);
    console.log(`🔒 HIPAA-compliant security: ENABLED`);
    console.log(`🔐 AES-256 encryption: ENABLED`);
    console.log(`📝 Audit logging: ENABLED`);
});