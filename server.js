const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// FHIR imports
const patientRoutes = require('./fhir/routes/patient');
const appointmentRoutes = require('./fhir/routes/appointment');
const { 
    authenticateToken, 
    requireScopes, 
    createAuthEndpoint, 
    createTokenEndpoint, 
    createCapabilityEndpoint,
    generateTestToken
} = require('./fhir/middleware/auth');

// PACS imports
const pacsRoutes = require('./routes/pacs');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    crossOriginEmbedderPolicy: false, // Allow embedding for development
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Allow inline scripts and eval for demo
            styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles
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

// Serve static files
app.use(express.static(path.join(__dirname, '.')));

// Health check endpoint for Railway
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy', 
        service: 'WebQX Healthcare Platform',
        fhir: 'enabled',
        pacs: 'enabled',
        timestamp: new Date().toISOString()
    });
});

// FHIR OAuth2 endpoints
app.get('/oauth/authorize', createAuthEndpoint());
app.post('/oauth/token', createTokenEndpoint());

// FHIR metadata/capability statement
app.get('/fhir/metadata', createCapabilityEndpoint());

// FHIR Patient resource routes with authentication
app.use('/fhir/Patient', authenticateToken, requireScopes(['patient/*.read', 'patient/*.write']), patientRoutes);

// FHIR Appointment resource routes with authentication
app.use('/fhir/Appointment', authenticateToken, requireScopes(['user/*.read', 'user/*.write', 'patient/*.read']), appointmentRoutes);

// PACS routes with authentication
app.use('/api/pacs', authenticateToken, requireScopes(['user/*.read', 'user/*.write']), pacsRoutes);

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

// Serve the main patient portal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Catch all other routes and serve the patient portal
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 WebQX Healthcare Platform is running on port ${PORT}`);
    console.log(`🩺 Patient Portal available at http://localhost:${PORT}`);
    console.log(`💊 Health check endpoint: http://localhost:${PORT}/health`);
});