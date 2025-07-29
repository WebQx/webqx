const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// HIPAA Compliance imports
const HIPAAAuthService = require('./services/hipaa-auth');
const HIPAARBACService = require('./services/hipaa-rbac');
const HIPAABackupService = require('./services/hipaa-backup');
const HIPAATamperProofAuditService = require('./services/hipaa-audit');

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

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize HIPAA Authentication Service
const hipaaAuth = new HIPAAAuthService();
const hipaaRBAC = new HIPAARBACService();
const hipaaBackup = new HIPAABackupService();
const hipaaAudit = new HIPAATamperProofAuditService();

// HIPAA Compliance: Force HTTPS in production
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.header('x-forwarded-proto') !== 'https') {
            return res.redirect(`https://${req.header('host')}${req.url}`);
        }
        next();
    });
}

// Enhanced security middleware for HIPAA compliance
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
    // HIPAA Compliance: Enhanced security headers
    hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
    },
    noSniff: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true
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
        hipaaCompliance: 'enabled',
        timestamp: new Date().toISOString()
    });
});

// ============================================================================
// HIPAA-Compliant Access Control Endpoints
// ============================================================================

// Assign role to user
app.post('/rbac/assign-role', async (req, res) => {
    try {
        const { userId, roleId, assignedBy, expiresAt, scope, justification } = req.body;
        
        const result = await hipaaRBAC.assignRole(userId, roleId, {
            assignedBy,
            expiresAt,
            scope,
            justification
        });
        
        // Audit the role assignment
        await hipaaAudit.logEvent({
            eventType: 'ROLE_ASSIGNED',
            userId: assignedBy,
            action: 'assign_role',
            outcome: result.success ? 'success' : 'failure',
            details: { targetUserId: userId, roleId, justification },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });
        
        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'ROLE_ASSIGNMENT_ERROR',
            message: 'Failed to assign role',
            details: error.message
        });
    }
});

// Check user permissions
app.post('/rbac/check-permission', async (req, res) => {
    try {
        const { userId, permission, context } = req.body;
        
        const result = await hipaaRBAC.checkPermission(userId, permission, context);
        
        // Audit permission check
        await hipaaAudit.logEvent({
            eventType: result.granted ? 'PERMISSION_GRANTED' : 'PERMISSION_DENIED',
            userId,
            action: 'check_permission',
            outcome: 'success',
            details: { permission, context, granted: result.granted },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });
        
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({
            granted: false,
            error: 'PERMISSION_CHECK_ERROR',
            message: 'Failed to check permission',
            details: error.message
        });
    }
});

// Request elevated access (emergency/break-glass)
app.post('/rbac/request-elevated-access', async (req, res) => {
    try {
        const { userId, context, justification, requestedPermissions } = req.body;
        
        const result = await hipaaRBAC.requestElevatedAccess(userId, context, {
            justification,
            requestedPermissions
        });
        
        // Audit elevated access request
        await hipaaAudit.logEvent({
            eventType: 'SECURITY_ALERT',
            userId,
            action: 'request_elevated_access',
            outcome: result.success ? 'success' : 'failure',
            details: { context, justification, requestedPermissions },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });
        
        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'ELEVATED_ACCESS_REQUEST_ERROR',
            message: 'Failed to request elevated access',
            details: error.message
        });
    }
});

// ============================================================================
// HIPAA-Compliant Backup and Disaster Recovery Endpoints
// ============================================================================

// Create backup
app.post('/backup/create', async (req, res) => {
    try {
        const { type, dataTypes, priority, description } = req.body;
        
        const result = await hipaaBackup.createBackup({
            type,
            dataTypes,
            priority,
            description
        });
        
        // Audit backup creation
        await hipaaAudit.logEvent({
            eventType: 'BACKUP_CREATED',
            userId: req.user?.id || 'system',
            action: 'create_backup',
            outcome: result.success ? 'success' : 'failure',
            details: { type, dataTypes, backupId: result.backupId },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });
        
        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'BACKUP_CREATION_ERROR',
            message: 'Failed to create backup',
            details: error.message
        });
    }
});

// Get backup status
app.get('/backup/status', async (req, res) => {
    try {
        const result = await hipaaBackup.getBackupStatus();
        
        // Audit backup status access
        await hipaaAudit.logEvent({
            eventType: 'SYSTEM_CONFIGURATION_CHANGED',
            userId: req.user?.id || 'system',
            action: 'view_backup_status',
            outcome: 'success',
            details: { requestType: 'backup_status' },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });
        
        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'BACKUP_STATUS_ERROR',
            message: 'Failed to get backup status',
            details: error.message
        });
    }
});

// Execute disaster recovery
app.post('/backup/disaster-recovery', async (req, res) => {
    try {
        const { scenario, targetRTO, targetRPO, skipNonCritical } = req.body;
        
        const result = await hipaaBackup.executeDisasterRecovery({
            scenario,
            targetRTO,
            targetRPO,
            skipNonCritical
        });
        
        // Audit disaster recovery execution
        await hipaaAudit.logEvent({
            eventType: 'SECURITY_ALERT',
            userId: req.user?.id || 'system',
            action: 'execute_disaster_recovery',
            outcome: result.success ? 'success' : 'failure',
            details: { scenario, recoveryId: result.recoveryId },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });
        
        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'DISASTER_RECOVERY_ERROR',
            message: 'Failed to execute disaster recovery',
            details: error.message
        });
    }
});

// ============================================================================
// HIPAA-Compliant Audit and Compliance Endpoints
// ============================================================================

// Search audit logs
app.post('/audit/search', async (req, res) => {
    try {
        const criteria = req.body;
        
        const result = await hipaaAudit.searchAuditLogs(criteria);
        
        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'AUDIT_SEARCH_ERROR',
            message: 'Failed to search audit logs',
            details: error.message
        });
    }
});

// Verify audit chain integrity
app.post('/audit/verify-integrity', async (req, res) => {
    try {
        const { startIndex, endIndex } = req.body;
        
        const result = await hipaaAudit.verifyChainIntegrity({ startIndex, endIndex });
        
        // Audit the verification request
        await hipaaAudit.logEvent({
            eventType: 'AUDIT_LOG_ACCESSED',
            userId: req.user?.id || 'system',
            action: 'verify_chain_integrity',
            outcome: result.success ? 'success' : 'failure',
            details: { startIndex, endIndex, verified: result.verification?.verified },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });
        
        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'INTEGRITY_VERIFICATION_ERROR',
            message: 'Failed to verify audit chain integrity',
            details: error.message
        });
    }
});

// Generate compliance report
app.post('/compliance/report', async (req, res) => {
    try {
        const { startDate, endDate, reportType, includePatientAccess, includeSecurityEvents, includeAdminActions } = req.body;
        
        const result = await hipaaAudit.generateComplianceReport({
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            reportType,
            includePatientAccess,
            includeSecurityEvents,
            includeAdminActions
        });
        
        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'COMPLIANCE_REPORT_ERROR',
            message: 'Failed to generate compliance report',
            details: error.message
        });
    }
});

// ============================================================================
// HIPAA-Compliant Patient Data Access Logging
// ============================================================================

// Middleware to log patient data access
const logPatientDataAccess = async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
        // Log patient data access
        if (req.path.includes('/Patient/') || req.path.includes('/patient/')) {
            const patientId = req.params.id || req.body?.id || 'unknown';
            
            hipaaAudit.logEvent({
                eventType: req.method === 'GET' ? 'PATIENT_RECORD_VIEWED' : 'PATIENT_RECORD_MODIFIED',
                userId: req.user?.id || 'anonymous',
                patientId,
                resourceType: 'Patient',
                resourceId: patientId,
                action: req.method.toLowerCase(),
                outcome: res.statusCode < 400 ? 'success' : 'failure',
                details: {
                    method: req.method,
                    path: req.path,
                    statusCode: res.statusCode
                },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                sessionId: req.user?.sessionId
            }).catch(err => console.error('Failed to log patient access:', err));
        }
        
        originalSend.call(this, data);
    };
    
    next();
};

// Apply patient data access logging to FHIR endpoints
app.use('/fhir/Patient', logPatientDataAccess);

// ============================================================================
// HIPAA-Compliant Authentication Endpoints
// ============================================================================

// User registration with HIPAA-compliant password policies
app.post('/auth/register', async (req, res) => {
    try {
        const result = await hipaaAuth.registerUser(req.body);
        
        if (result.success) {
            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                user: result.user,
                twoFactorSetup: result.twoFactorSetup
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error,
                message: result.message,
                details: result.details
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'REGISTRATION_FAILED',
            message: 'User registration failed',
            details: error.message
        });
    }
});

// Enhanced authentication with 2FA support
app.post('/auth/login', async (req, res) => {
    try {
        const credentials = {
            ...req.body,
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent')
        };
        
        const result = await hipaaAuth.authenticate(credentials);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                message: 'Authentication successful',
                user: result.user,
                session: result.session,
                warnings: result.warnings
            });
        } else {
            res.status(401).json({
                success: false,
                error: result.error,
                message: result.message,
                lockoutUntil: result.lockoutUntil
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'AUTHENTICATION_FAILED',
            message: 'Authentication failed',
            details: error.message
        });
    }
});

// Enable two-factor authentication
app.post('/auth/2fa/enable', async (req, res) => {
    try {
        const { username, token } = req.body;
        
        if (!username || !token) {
            return res.status(400).json({
                success: false,
                error: 'MISSING_PARAMETERS',
                message: 'Username and token are required'
            });
        }
        
        const result = await hipaaAuth.enableTwoFactor(username, token);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                message: result.message,
                backupCodes: result.backupCodes
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error,
                message: result.message
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: '2FA_ENABLE_FAILED',
            message: 'Failed to enable two-factor authentication',
            details: error.message
        });
    }
});

// Change password with policy validation
app.post('/auth/change-password', async (req, res) => {
    try {
        const { username, currentPassword, newPassword } = req.body;
        
        if (!username || !currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'MISSING_PARAMETERS',
                message: 'Username, current password, and new password are required'
            });
        }
        
        const result = await hipaaAuth.changePassword(username, currentPassword, newPassword);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                message: result.message
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error,
                message: result.message,
                details: result.details
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'PASSWORD_CHANGE_FAILED',
            message: 'Failed to change password',
            details: error.message
        });
    }
});

// Session validation endpoint
app.post('/auth/validate', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                valid: false,
                error: 'NO_TOKEN',
                message: 'No token provided'
            });
        }
        
        const result = await hipaaAuth.validateSession(token);
        
        res.status(result.valid ? 200 : 401).json(result);
    } catch (error) {
        res.status(500).json({
            valid: false,
            error: 'VALIDATION_FAILED',
            message: 'Session validation failed',
            details: error.message
        });
    }
});

// Logout endpoint
app.post('/auth/logout', async (req, res) => {
    try {
        const { sessionId } = req.body;
        
        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'MISSING_SESSION_ID',
                message: 'Session ID is required'
            });
        }
        
        const result = await hipaaAuth.logout(sessionId);
        
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'LOGOUT_FAILED',
            message: 'Logout failed',
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

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 WebQX Healthcare Platform is running on port ${PORT}`);
    console.log(`🩺 Patient Portal available at http://localhost:${PORT}`);
    console.log(`💊 Health check endpoint: http://localhost:${PORT}/health`);
});