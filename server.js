const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Import secure authentication routes
const authRoutes = require('./auth/routes/auth.js');

// FHIR imports
const patientRoutes = require('./fhir/routes/patient');
const appointmentRoutes = require('./fhir/routes/appointment');
const observationRoutes = require('./fhir/routes/observation');
const existingFHIRAuth = require('./fhir/middleware/auth');

// OAuth2 imports
const { createOAuth2Instance, enhanceFHIRAuth, createOAuth2Router } = require('./auth/oauth2');

// Initialize OAuth2
let oauth2Instance;
let enhancedAuth;

try {
    oauth2Instance = createOAuth2Instance();
    enhancedAuth = enhanceFHIRAuth(existingFHIRAuth, oauth2Instance);
    console.log('✅ OAuth2 authentication system initialized');
} catch (error) {
    console.warn('⚠️ OAuth2 initialization failed, using fallback auth:', error.message);
    enhancedAuth = existingFHIRAuth;
}

// Extract auth functions (now enhanced with OAuth2 support)
const { 
    authenticateToken, 
    requireScopes, 
    createAuthEndpoint, 
    createTokenEndpoint, 
    createCapabilityEndpoint,
    generateTestToken
} = enhancedAuth;

// PostDICOM imports
const postdicomRouter = require('./modules/postdicom/routes/dicom.js');

// openEHR imports
const openEHREHRRoutes = require('./openehr/routes/ehr');
const openEHRCompositionRoutes = require('./openehr/routes/composition');
const openEHRQueryRoutes = require('./openehr/routes/query');

// Patient Portal Authentication imports
const patientPortalAuthRoutes = require('./patient-portal/auth/authRoutes');

// Provider Portal Authentication imports
const providerAuthRoutes = require('./auth/providers/routes');
const providerSSORoutes = require('./auth/providers/sso-routes');

// Ottehr Integration imports
const ottehrRoutes = require('./auth/ottehr/routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    crossOriginEmbedderPolicy: false, // Allow embedding for development
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.tailwindcss.com"], // Allow TailwindCSS
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"], // Allow inline styles and TailwindCSS
            connectSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

// CORS configuration for FHIR
app.use('/fhir', cors({
    origin: true, // Allow all origins in development
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true
}));

// Rate limiting for FHIR endpoints
const fhirLimiter = rateLimit({
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

app.use('/fhir', fhirLimiter);

// Middleware for parsing JSON bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Secure authentication routes
app.use('/auth', authRoutes);

// Serve static files
app.use(express.static(path.join(__dirname, '.')));

// Health check endpoint for Railway
app.get('/health', (req, res) => {
    const healthData = { 
        status: 'healthy', 
        service: 'WebQX Healthcare Platform',
        fhir: 'enabled',
        openehr: 'enabled',
        oauth2: oauth2Instance ? 'enabled' : 'fallback',
        telepsychiatry: {
            session_management: 'enabled',
            consent_tracking: 'enabled',
            workflow_triage: 'enabled',
            emr_integration: 'enabled',
            analytics: 'enabled',
            chat_fallback: 'enabled',
            ui_customization: 'enabled'
        },
        endpoints: {
            session: ['/session/active', '/session/start', '/session/transcribe', '/session/transcript/:id'],
            consent: ['/consent/audit', '/consent/record', '/consent/:id'],
            workflow: ['/workflow/triage', '/workflow/plan'],
            emr: ['/emr/tag', '/emr/records/:id'],
            analytics: ['/analytics/report', '/analytics/community', '/analytics/deidentified'],
            chat: ['/chat/session/start', '/chat/session/:id/message'],
            ui: ['/ui/customize', '/ui/templates', '/ui/preferences']
        },
        timestamp: new Date().toISOString()
    };

    // Add OAuth2 status if available
    if (oauth2Instance) {
        try {
            healthData.oauth2Status = oauth2Instance.getStatus();
        } catch (error) {
            healthData.oauth2Status = { error: error.message };
        }
    }

    res.status(200).json(healthData);
});

// FHIR OAuth2 endpoints (existing)
app.get('/oauth/authorize', createAuthEndpoint());
app.post('/oauth/token', createTokenEndpoint());

// New OAuth2 endpoints
if (oauth2Instance) {
    app.use('/auth/oauth2', createOAuth2Router(oauth2Instance));
    console.log('✅ OAuth2 endpoints mounted at /auth/oauth2');
}

// FHIR metadata/capability statement
app.get('/fhir/metadata', createCapabilityEndpoint());

// FHIR Patient resource routes with authentication
app.use('/fhir/Patient', authenticateToken, requireScopes(['patient/*.read', 'patient/*.write']), patientRoutes);

// FHIR Appointment resource routes with authentication
app.use('/fhir/Appointment', authenticateToken, requireScopes(['user/*.read', 'user/*.write', 'patient/*.read']), appointmentRoutes);

// FHIR Observation resource routes with authentication
app.use('/fhir/Observation', authenticateToken, requireScopes(['patient/*.read', 'patient/*.write', 'user/*.read']), observationRoutes);

// Telehealth API routes
const TelehealthService = require('./modules/telehealth/TelehealthService');
const createTelehealthRoutes = require('./modules/telehealth/routes/telehealth');
const telehealthService = new TelehealthService(oauth2Instance);
app.use('/api/telehealth', createTelehealthRoutes(telehealthService, authenticateToken));

// PostDICOM API routes
app.use('/postdicom', postdicomRouter);

// openEHR API routes (no authentication for demo purposes)
app.use('/openehr/v1/ehr', openEHREHRRoutes);
app.use('/openehr/v1', openEHRCompositionRoutes);
app.use('/openehr/v1/query', openEHRQueryRoutes);

// Patient Portal Authentication routes
app.use('/api/auth', patientPortalAuthRoutes);

// Provider Portal Authentication routes
app.use('/api/auth/provider', providerAuthRoutes);
app.use('/api/auth/sso', providerSSORoutes);

// OpenEvidence Authentication routes
try {
    const openEvidenceAuthRoutes = require('./auth/openevidence/routes');
    app.use('/auth/openevidence', openEvidenceAuthRoutes);
    console.log('✅ OpenEvidence authentication routes loaded');
} catch (error) {
    console.warn('⚠️ OpenEvidence authentication routes not available:', error.message);
}

// Ottehr API routes
app.use('/api/ottehr', ottehrRoutes);

// Telepsychiatry API routes
const sessionRoutes = require('./routes/session');
const consentRoutes = require('./routes/consent');
const workflowRoutes = require('./routes/workflow');
const emrRoutes = require('./routes/emr');
const analyticsRoutes = require('./routes/analytics');
const chatRoutes = require('./routes/chat');
const uiRoutes = require('./routes/ui');

// Mount telepsychiatry routes with authentication
app.use('/session', authenticateToken, sessionRoutes);
app.use('/consent', authenticateToken, consentRoutes);
app.use('/workflow', authenticateToken, workflowRoutes);
app.use('/emr', authenticateToken, emrRoutes);
app.use('/analytics', authenticateToken, analyticsRoutes);
app.use('/chat', authenticateToken, chatRoutes);
app.use('/ui', authenticateToken, uiRoutes);

console.log('✅ Telepsychiatry API routes loaded');

// Test routes (development only)
if (process.env.NODE_ENV === 'development') {
    const testRoutes = require('./routes/test');
    app.use('/test', testRoutes);
    console.log('✅ Test routes loaded for development');
}

// Telehealth API routes
try {
    const telehealthVideoRoutes = require('./telehealth/routes/video');
    app.use('/telehealth/video', telehealthVideoRoutes);
    console.log('✅ Telehealth video routes loaded');
} catch (error) {
    console.warn('⚠️ Telehealth routes not available:', error.message);
}



// Serve login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Authentication middleware for patient portal
const authenticatePortalAccess = (req, res, next) => {
    // Skip authentication for login page and auth API
    if (req.path === '/login' || req.path.startsWith('/api/auth')) {
        return next();
    }
    
    // For demo purposes, allow access without authentication
    // In production, you would check for valid session/token
    next();
};

// Development endpoint to get test token
if (process.env.NODE_ENV === 'development') {
    app.get('/dev/token', (req, res) => {
        const token = generateTestToken();
        res.json({
            access_token: token,
            token_type: 'Bearer',
            expires_in: 3600,
            scope: 'patient/*.read patient/*.write user/*.read'
        });
    });
}

// Translation API endpoint
app.post('/api/whisper/translate', (req, res) => {
    try {
        const { text, targetLang } = req.body;

        // Validate request body
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            return res.status(400).json({
                message: 'Text parameter is required and must be a non-empty string',
                code: 'INVALID_TEXT'
            });
        }

        if (!targetLang || typeof targetLang !== 'string' || targetLang.trim().length === 0) {
            return res.status(400).json({
                message: 'Target language parameter is required and must be a non-empty string',
                code: 'INVALID_TARGET_LANG'
            });
        }

        // Basic language code validation
        const langCodePattern = /^[a-z]{2,3}(-[A-Z]{2})?$/;
        if (!langCodePattern.test(targetLang.trim())) {
            return res.status(400).json({
                message: 'Target language must be a valid language code (e.g., "en", "es", "fr")',
                code: 'INVALID_LANG_CODE'
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

        // Return successful translation response
        res.status(200).json({
            translatedText,
            sourceLanguage: 'en', // Assume English source for now
            targetLanguage: normalizedLang,
            confidence
        });

    } catch (error) {
        console.error('Translation API error:', error);
        res.status(500).json({
            message: 'Internal server error during translation',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Serve the login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Serve the main patient portal (only for root path)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Catch all other routes and serve the patient portal (moved to end)
app.get('*', (req, res) => {
    // Only serve index.html for paths that don't start with /api, /fhir, etc.
    if (!req.path.startsWith('/api') && 
        !req.path.startsWith('/fhir') && 
        !req.path.startsWith('/openehr') &&
        !req.path.startsWith('/session') &&
        !req.path.startsWith('/consent') &&
        !req.path.startsWith('/workflow') &&
        !req.path.startsWith('/emr') &&
        !req.path.startsWith('/analytics') &&
        !req.path.startsWith('/chat') &&
        !req.path.startsWith('/ui') &&
        !req.path.startsWith('/test') &&
        !req.path.startsWith('/health') &&
        !req.path.startsWith('/oauth') &&
        !req.path.startsWith('/auth') &&
        !req.path.startsWith('/dev') &&
        !req.path.startsWith('/postdicom') &&
        !req.path.startsWith('/telehealth')) {
        res.sendFile(path.join(__dirname, 'index.html'));
    } else {
        res.status(404).json({ error: 'Not Found', message: 'API endpoint not found' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 WebQX Healthcare Platform is running on port ${PORT}`);
    console.log(`🩺 Patient Portal available at http://localhost:${PORT}`);
    console.log(`💊 Health check endpoint: http://localhost:${PORT}/health`);
});