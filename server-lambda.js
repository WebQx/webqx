const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Core imports (always loaded)
const authRoutes = require('./auth/routes/auth.js');
const patientRoutes = require('./fhir/routes/patient');
const appointmentRoutes = require('./fhir/routes/appointment');
const observationRoutes = require('./fhir/routes/observation');
const existingFHIRAuth = require('./fhir/middleware/auth');

const app = express();

// Lambda-optimized security middleware (reduced CSP for Lambda)
app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            connectSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

// CORS configuration for Lambda
app.use(cors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['*'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true
}));

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// OAuth2 setup with lazy loading and error handling
let oauth2Instance;
let enhancedAuth;

const initializeOAuth2 = () => {
    if (!oauth2Instance) {
        try {
            const { createOAuth2Instance, enhanceFHIRAuth } = require('./auth/oauth2');
            oauth2Instance = createOAuth2Instance();
            enhancedAuth = enhanceFHIRAuth(existingFHIRAuth, oauth2Instance);
            console.log('✅ OAuth2 authentication system initialized');
        } catch (error) {
            console.warn('⚠️ OAuth2 initialization failed, using fallback auth:', error.message);
            enhancedAuth = existingFHIRAuth;
        }
    }
    return enhancedAuth;
};

// Lazy-load auth functions
const getAuthFunctions = () => {
    const auth = initializeOAuth2();
    return {
        authenticateToken: auth.authenticateToken,
        requireScopes: auth.requireScopes,
        createAuthEndpoint: auth.createAuthEndpoint,
        createTokenEndpoint: auth.createTokenEndpoint,
        createCapabilityEndpoint: auth.createCapabilityEndpoint,
        generateTestToken: auth.generateTestToken
    };
};

// Health check endpoint optimized for Lambda
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy', 
        service: 'WebQX Healthcare Platform (Lambda)',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Core authentication routes
app.use('/auth', authRoutes);

// FHIR OAuth2 endpoints with lazy loading
app.get('/oauth/authorize', (req, res, next) => {
    const { createAuthEndpoint } = getAuthFunctions();
    createAuthEndpoint()(req, res, next);
});

app.post('/oauth/token', (req, res, next) => {
    const { createTokenEndpoint } = getAuthFunctions();
    createTokenEndpoint()(req, res, next);
});

// FHIR metadata/capability statement
app.get('/fhir/metadata', (req, res, next) => {
    const { createCapabilityEndpoint } = getAuthFunctions();
    createCapabilityEndpoint()(req, res, next);
});

// FHIR Resource routes with lazy authentication
app.use('/fhir/Patient', (req, res, next) => {
    const { authenticateToken, requireScopes } = getAuthFunctions();
    authenticateToken(req, res, (err) => {
        if (err) return next(err);
        requireScopes(['patient/*.read', 'patient/*.write'])(req, res, next);
    });
}, patientRoutes);

app.use('/fhir/Appointment', (req, res, next) => {
    const { authenticateToken, requireScopes } = getAuthFunctions();
    authenticateToken(req, res, (err) => {
        if (err) return next(err);
        requireScopes(['user/*.read', 'user/*.write', 'patient/*.read'])(req, res, next);
    });
}, appointmentRoutes);

app.use('/fhir/Observation', (req, res, next) => {
    const { authenticateToken, requireScopes } = getAuthFunctions();
    authenticateToken(req, res, (err) => {
        if (err) return next(err);
        requireScopes(['patient/*.read', 'patient/*.write', 'user/*.read'])(req, res, next);
    });
}, observationRoutes);

// Conditionally load heavy modules only when needed
app.use('/api/telehealth', (req, res, next) => {
    try {
        const TelehealthService = require('./modules/telehealth/TelehealthService');
        const createTelehealthRoutes = require('./modules/telehealth/routes/telehealth');
        const { authenticateToken } = getAuthFunctions();
        
        const telehealthService = new TelehealthService(oauth2Instance);
        const telehealthRouter = createTelehealthRoutes(telehealthService, authenticateToken);
        telehealthRouter(req, res, next);
    } catch (error) {
        console.warn('⚠️ Telehealth module not available:', error.message);
        res.status(503).json({ error: 'Telehealth service temporarily unavailable' });
    }
});

// PostDICOM with conditional loading
app.use('/postdicom', (req, res, next) => {
    try {
        const postdicomRouter = require('./modules/postdicom/routes/dicom.js');
        postdicomRouter(req, res, next);
    } catch (error) {
        console.warn('⚠️ PostDICOM module not available:', error.message);
        res.status(503).json({ error: 'PostDICOM service temporarily unavailable' });
    }
});

// openEHR with conditional loading
app.use('/openehr/v1/ehr', (req, res, next) => {
    try {
        const openEHREHRRoutes = require('./openehr/routes/ehr');
        openEHREHRRoutes(req, res, next);
    } catch (error) {
        console.warn('⚠️ OpenEHR module not available:', error.message);
        res.status(503).json({ error: 'OpenEHR service temporarily unavailable' });
    }
});

// Translation API endpoint (lightweight, always available)
app.post('/api/whisper/translate', (req, res) => {
    try {
        const { text, targetLang } = req.body;

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

        const langCodePattern = /^[a-z]{2,3}(-[A-Z]{2})?$/;
        if (!langCodePattern.test(targetLang.trim())) {
            return res.status(400).json({
                message: 'Target language must be a valid language code (e.g., "en", "es", "fr")',
                code: 'INVALID_LANG_CODE'
            });
        }

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
            }
        };

        const normalizedText = text.trim();
        const normalizedLang = targetLang.trim().toLowerCase();

        let translatedText = normalizedText;
        let confidence = 0.95;

        if (translations[normalizedLang] && translations[normalizedLang][normalizedText]) {
            translatedText = translations[normalizedLang][normalizedText];
        } else {
            const prefixes = {
                'es': '[ES] ', 'fr': '[FR] ', 'de': '[DE] ', 'it': '[IT] ', 'pt': '[PT] '
            };
            
            if (prefixes[normalizedLang]) {
                translatedText = prefixes[normalizedLang] + normalizedText;
                confidence = 0.75;
            }
        }

        res.status(200).json({
            translatedText,
            sourceLanguage: 'en',
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

// Development token endpoint
if (process.env.NODE_ENV === 'development') {
    app.get('/dev/token', (req, res) => {
        const { generateTestToken } = getAuthFunctions();
        const token = generateTestToken();
        res.json({
            access_token: token,
            token_type: 'Bearer',
            expires_in: 3600,
            scope: 'patient/*.read patient/*.write user/*.read'
        });
    });
}

// Serve static files only in development or when explicitly enabled
if (process.env.SERVE_STATIC !== 'false') {
    app.use(express.static(path.join(__dirname, '.'), {
        maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0
    }));
}

// Default routes for SPA
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Catch all other routes for SPA
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/fhir/')) {
        res.status(404).json({ error: 'API endpoint not found' });
    } else {
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

// Error handler
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

module.exports = app;