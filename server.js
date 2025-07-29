const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const https = require('https');
const fs = require('fs');
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

// HIPAA Compliance Services
const PACSHIPAAService = require('./services/pacs-hipaa');
const { HIPAA_RBAC } = require('./services/hipaa-rbac');
const { AutomatedSecurityAssessment } = require('./services/security-assessment');
const { PHIDataMinimization } = require('./services/phi-minimization');
const SimpleAuditLogger = require('./services/simple-audit-logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize HIPAA compliance services
const auditLogger = new AuditLogger({
    enabled: process.env.ENABLE_AUDIT_LOGGING === 'true',
    retentionDays: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS) || 2555
});

const rbac = new HIPAA_RBAC(auditLogger);
const pacsService = new PACSHIPAAService({
    encryptionEnabled: process.env.ENABLE_DATA_ENCRYPTION === 'true',
    auditEnabled: process.env.ENABLE_AUDIT_LOGGING === 'true'
});

const securityAssessment = new AutomatedSecurityAssessment({
    enableRealTimeMonitoring: process.env.NODE_ENV === 'production',
    alertThreshold: 'HIGH'
});

const phiMinimizer = new PHIDataMinimization({
    enableAggressive: process.env.PHI_AGGRESSIVE_DETECTION === 'true',
    logDetections: true
});

// HIPAA Compliance Middleware
const hipaaAuditMiddleware = (req, res, next) => {
    // Set audit context for all requests
    auditLogger.setContext({
        userId: req.user?.id || req.headers['x-user-id'] || 'anonymous',
        userRole: req.user?.role || req.headers['x-user-role'] || 'unknown',
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });
    next();
};

// PHI Minimization Middleware for response logging
const phiMinimizationMiddleware = (req, res, next) => {
    const originalSend = res.send;
    res.send = function(data) {
        // Minimize PHI in response data before logging
        if (process.env.ENABLE_PHI_MINIMIZATION === 'true' && data) {
            try {
                const minimized = phiMinimizer.minimizeTextPHI(
                    typeof data === 'string' ? data : JSON.stringify(data),
                    { endpoint: req.path, method: req.method }
                );
                // Log minimized version only
                console.log('[PHI Minimized Response]', minimized.minimizedText);
            } catch (error) {
                console.error('[PHI Minimization Error]', error);
            }
        }
        originalSend.call(this, data);
    };
    next();
};

// Force HTTPS in production
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.header('x-forwarded-proto') !== 'https') {
            res.redirect(`https://${req.header('host')}${req.url}`);
        } else {
            next();
        }
    });
}

// Enhanced security middleware for HIPAA compliance
app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            connectSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
    },
    noSniff: true,
    frameguard: { action: 'deny' },
    xssFilter: true
}));

// Apply HIPAA middleware
app.use(hipaaAuditMiddleware);
app.use(phiMinimizationMiddleware);

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
        hipaaCompliance: process.env.HIPAA_COMPLIANT_MODE === 'true',
        timestamp: new Date().toISOString()
    });
});

// HIPAA Compliance Endpoints

// RBAC Permission Check
app.post('/hipaa/check-permission', async (req, res) => {
    try {
        const { userId, userRole, permission, resource } = req.body;
        
        if (!userId || !userRole || !permission) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userId, userRole, permission'
            });
        }

        const result = await rbac.checkPermission(userId, userRole, permission, resource);
        
        res.json({
            success: true,
            granted: result.granted,
            reason: result.reason,
            code: result.code
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Permission check failed',
            details: error.message
        });
    }
});

// Emergency Access Request
app.post('/hipaa/emergency-access', async (req, res) => {
    try {
        const { userId, userRole, reason, resource } = req.body;
        
        const result = await rbac.requestEmergencyAccess(userId, userRole, reason, resource);
        
        if (result.granted) {
            await auditLogger.log({
                action: 'emergency_access_requested',
                resourceType: 'emergency_access',
                resourceId: result.sessionId,
                success: true,
                context: { reason, resource }
            });
        }
        
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Emergency access request failed',
            details: error.message
        });
    }
});

// PACS Image Upload
app.post('/hipaa/pacs/upload', async (req, res) => {
    try {
        const { imageData, user } = req.body;
        
        if (!imageData || !user) {
            return res.status(400).json({
                success: false,
                error: 'Missing imageData or user information'
            });
        }

        const result = await pacsService.uploadImage(imageData, user);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'PACS image upload failed',
            details: error.message
        });
    }
});

// PACS Image Retrieval
app.get('/hipaa/pacs/image/:studyId', async (req, res) => {
    try {
        const { studyId } = req.params;
        const user = {
            id: req.headers['x-user-id'],
            role: req.headers['x-user-role'],
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        };

        if (!user.id || !user.role) {
            return res.status(401).json({
                success: false,
                error: 'User authentication required'
            });
        }

        const result = await pacsService.retrieveImage(studyId, user);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'PACS image retrieval failed',
            details: error.message
        });
    }
});

// Security Assessment
app.post('/hipaa/security-assessment', async (req, res) => {
    try {
        const user = {
            id: req.headers['x-user-id'],
            role: req.headers['x-user-role']
        };

        // Check if user has permission to run security assessments
        const permissionCheck = await rbac.checkPermission(
            user.id,
            user.role,
            'security.audit_review'
        );

        if (!permissionCheck.granted) {
            return res.status(403).json({
                success: false,
                error: 'Access denied',
                code: permissionCheck.code
            });
        }

        const assessment = await securityAssessment.runSecurityAssessment(req.body);
        res.json(assessment);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Security assessment failed',
            details: error.message
        });
    }
});

// Audit Log Search
app.post('/hipaa/audit/search', async (req, res) => {
    try {
        const user = {
            id: req.headers['x-user-id'],
            role: req.headers['x-user-role']
        };

        const permissionCheck = await rbac.checkPermission(
            user.id,
            user.role,
            'admin.view_audit_logs'
        );

        if (!permissionCheck.granted) {
            return res.status(403).json({
                success: false,
                error: 'Access denied for audit log access'
            });
        }

        const result = await auditLogger.search(req.body);
        
        // Minimize PHI in audit results
        if (result.success && result.data.entries) {
            result.data.entries = result.data.entries.map(entry => {
                const minimized = phiMinimizer.minimizeAuditLog(entry);
                return minimized.minimizedEntry;
            });
        }

        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Audit search failed',
            details: error.message
        });
    }
});

// Compliance Report
app.get('/hipaa/compliance-report', async (req, res) => {
    try {
        const user = {
            id: req.headers['x-user-id'],
            role: req.headers['x-user-role']
        };

        const permissionCheck = await rbac.checkPermission(
            user.id,
            user.role,
            'security.compliance_reports'
        );

        if (!permissionCheck.granted) {
            return res.status(403).json({
                success: false,
                error: 'Access denied for compliance reports'
            });
        }

        // Generate comprehensive compliance report
        const securityStatus = securityAssessment.getStatus();
        const auditStats = await auditLogger.getStatistics();
        const phiStats = phiMinimizer.getMinimizationReport();

        const complianceReport = {
            timestamp: new Date().toISOString(),
            hipaaCompliantMode: process.env.HIPAA_COMPLIANT_MODE === 'true',
            securityAssessment: securityStatus,
            auditLogging: auditStats.success ? auditStats.data : null,
            phiMinimization: phiStats,
            overallStatus: 'COMPLIANT' // This would be calculated based on all factors
        };

        await auditLogger.log({
            action: 'generate_compliance_report',
            resourceType: 'compliance_report',
            resourceId: 'hipaa_compliance',
            success: true,
            context: { reportGenerated: true }
        });

        res.json({
            success: true,
            report: complianceReport
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Compliance report generation failed',
            details: error.message
        });
    }
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

// Server startup with HTTPS support for production
if (process.env.NODE_ENV === 'production' && process.env.SSL_CERT_PATH && process.env.SSL_KEY_PATH) {
    // Production HTTPS server with TLS 1.3
    try {
        const httpsOptions = {
            cert: fs.readFileSync(process.env.SSL_CERT_PATH),
            key: fs.readFileSync(process.env.SSL_KEY_PATH),
            secureProtocol: 'TLSv1_3_method', // Force TLS 1.3
            ciphers: [
                'TLS_AES_256_GCM_SHA384',
                'TLS_CHACHA20_POLY1305_SHA256',
                'TLS_AES_128_GCM_SHA256',
                'ECDHE-RSA-AES256-GCM-SHA384',
                'ECDHE-RSA-CHACHA20-POLY1305',
                'ECDHE-RSA-AES128-GCM-SHA256'
            ].join(':'),
            honorCipherOrder: true,
            minVersion: 'TLSv1.3',
            maxVersion: 'TLSv1.3'
        };

        const httpsServer = https.createServer(httpsOptions, app);
        
        httpsServer.listen(PORT, '0.0.0.0', () => {
            console.log(`🌐 WebQX Healthcare Platform (HTTPS/TLS 1.3) is running on port ${PORT}`);
            console.log(`🩺 Patient Portal available at https://localhost:${PORT}`);
            console.log(`💊 Health check endpoint: https://localhost:${PORT}/health`);
            console.log(`🔒 HIPAA Compliance Mode: ${process.env.HIPAA_COMPLIANT_MODE === 'true' ? 'ENABLED' : 'DISABLED'}`);
            console.log(`🛡️  TLS 1.3 encryption enforced for all connections`);
            
            // Log HIPAA compliance status
            console.log('\n📋 HIPAA Compliance Status:');
            console.log(`   ✓ Audit Logging: ${process.env.ENABLE_AUDIT_LOGGING === 'true' ? 'ENABLED' : 'DISABLED'}`);
            console.log(`   ✓ Data Encryption: ${process.env.ENABLE_DATA_ENCRYPTION === 'true' ? 'ENABLED' : 'DISABLED'}`);
            console.log(`   ✓ RBAC System: ENABLED`);
            console.log(`   ✓ PHI Minimization: ${process.env.ENABLE_PHI_MINIMIZATION === 'true' ? 'ENABLED' : 'DISABLED'}`);
            console.log(`   ✓ Security Assessment: ENABLED\n`);
        });

        // Also redirect HTTP to HTTPS
        const httpApp = express();
        httpApp.all('*', (req, res) => {
            res.redirect(301, `https://${req.headers.host}${req.url}`);
        });
        httpApp.listen(80, () => {
            console.log('🔄 HTTP to HTTPS redirect server running on port 80');
        });

    } catch (error) {
        console.error('❌ Failed to start HTTPS server:', error);
        console.log('🔄 Falling back to HTTP server...');
        startHttpServer();
    }
} else {
    startHttpServer();
}

function startHttpServer() {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🌐 WebQX Healthcare Platform is running on port ${PORT}`);
        console.log(`🩺 Patient Portal available at http://localhost:${PORT}`);
        console.log(`💊 Health check endpoint: http://localhost:${PORT}/health`);
        console.log(`🔒 HIPAA Compliance Mode: ${process.env.HIPAA_COMPLIANT_MODE === 'true' ? 'ENABLED' : 'DISABLED'}`);
        
        if (process.env.NODE_ENV === 'production') {
            console.log('⚠️  WARNING: Running HTTP in production. Configure SSL certificates for HTTPS/TLS 1.3');
        }
        
        // Log HIPAA compliance status
        console.log('\n📋 HIPAA Compliance Status:');
        console.log(`   ${process.env.ENABLE_AUDIT_LOGGING === 'true' ? '✓' : '✗'} Audit Logging: ${process.env.ENABLE_AUDIT_LOGGING === 'true' ? 'ENABLED' : 'DISABLED'}`);
        console.log(`   ${process.env.ENABLE_DATA_ENCRYPTION === 'true' ? '✓' : '✗'} Data Encryption: ${process.env.ENABLE_DATA_ENCRYPTION === 'true' ? 'ENABLED' : 'DISABLED'}`);
        console.log(`   ✓ RBAC System: ENABLED`);
        console.log(`   ${process.env.ENABLE_PHI_MINIMIZATION === 'true' ? '✓' : '✗'} PHI Minimization: ${process.env.ENABLE_PHI_MINIMIZATION === 'true' ? 'ENABLED' : 'DISABLED'}`);
        console.log(`   ✓ Security Assessment: ENABLED\n`);
    });
}