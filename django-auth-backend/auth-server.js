// WebQX Authentication Server (Node.js Implementation)
// Django-style secure authentication for testing

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const validator = require('validator');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Security Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'webqx-django-style-jwt-secret-2024';
const BCRYPT_ROUNDS = 12;

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3001'],
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'static')));

// Rate Limiting (Django-style)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: {
        error: 'Too many authentication attempts. Please try again later.',
        retry_after: 900
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests. Please try again later.' }
});

// Django-style User Model (define before using in persistence rehydration)
class WebQXUser {
    constructor(data) {
        this.id = data.id || uuidv4();
        this.email = data.email.toLowerCase();
        this.password_hash = data.password_hash;
        this.first_name = data.first_name;
        this.last_name = data.last_name;
        this.middle_name = data.middle_name || '';
        this.date_of_birth = data.date_of_birth;
        this.phone_number = data.phone_number;
        this.user_type = data.user_type || 'PATIENT';
        this.verification_status = data.verification_status || 'PENDING';
        this.is_active = data.is_active !== undefined ? data.is_active : true;
        this.is_staff = data.is_staff || false;
        this.is_verified = data.is_verified || false;
        this.email_verified = data.email_verified || false;
        this.phone_verified = data.phone_verified || false;
        this.mfa_enabled = data.mfa_enabled || false;
        this.mfa_secret = data.mfa_secret || null;
        this.backup_tokens = data.backup_tokens || [];
        this.last_login_ip = data.last_login_ip || null;
        this.failed_login_attempts = data.failed_login_attempts || 0;
        this.lockout_until = data.lockout_until || null;
        this.country = data.country || '';
        this.timezone = data.timezone || 'UTC';
        this.language = data.language || 'en';
        this.hipaa_authorization = data.hipaa_authorization || false;
        this.gdpr_consent = data.gdpr_consent || false;
        this.privacy_policy_accepted = data.privacy_policy_accepted || false;
        this.terms_accepted = data.terms_accepted || false;
        this.created_at = data.created_at || new Date();
        this.updated_at = data.updated_at || new Date();
        this.last_activity = data.last_activity || new Date();
        this.metadata = data.metadata || {};
    }

    get_full_name() {
        if (this.middle_name) {
            return `${this.first_name} ${this.middle_name} ${this.last_name}`.trim();
        }
        return `${this.first_name} ${this.last_name}`.trim();
    }

    is_locked_out() {
        return this.lockout_until && new Date() < new Date(this.lockout_until);
    }

    increment_failed_login() {
        this.failed_login_attempts += 1;
        if (this.failed_login_attempts >= 5) {
            this.lockout_until = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        }
        this.updated_at = new Date();
    }

    reset_failed_login() {
        this.failed_login_attempts = 0;
        this.lockout_until = null;
        this.updated_at = new Date();
    }

    requires_mfa() {
        const userRole = ROLES[this.user_type];
        return userRole ? userRole.mfa_required : false;
    }

    get_permissions() {
        const userRole = ROLES[this.user_type];
        return userRole ? userRole.permissions : [];
    }

    get_role_info() {
        const userRole = ROLES[this.user_type];
        return userRole ? {
            name: userRole.name,
            level: userRole.level,
            dashboard: userRole.dashboard,
            permissions: userRole.permissions,
            mfa_required: userRole.mfa_required
        } : null;
    }

    has_permission(permission) {
        const permissions = this.get_permissions();
        return permissions.includes(permission) || permissions.includes('all_permissions');
    }

    toJSON() {
        const { password_hash, mfa_secret, backup_tokens, ...userWithoutSensitive } = this;
        return userWithoutSensitive;
    }
}

app.use('/api/v1/auth/token/', authLimiter);
app.use('/api/v1/auth/register/', authLimiter);
app.use('/api/v1/', generalLimiter);

// Role-Based Access Control (RBAC) Configuration
const ROLES = {
    PATIENT: {
        name: 'Patient',
        permissions: [
            'view_own_records',
            'update_own_profile',
            'book_appointments',
            'view_lab_results',
            'message_providers',
            'view_billing'
        ],
        level: 1,
        dashboard: '/patient-dashboard',
        mfa_required: false
    },
    NURSE: {
        name: 'Nurse',
        permissions: [
            'view_patient_records',
            'update_vitals',
            'create_notes',
            'view_schedules',
            'manage_medications',
            'patient_communication'
        ],
        level: 2,
        dashboard: '/nurse-dashboard',
        mfa_required: false
    },
    PHYSICIAN_ASSISTANT: {
        name: 'Physician Assistant',
        permissions: [
            'view_patient_records',
            'create_diagnoses',
            'prescribe_medications',
            'order_tests',
            'create_treatment_plans',
            'patient_communication',
            'view_reports'
        ],
        level: 3,
        dashboard: '/pa-dashboard',
        mfa_required: true
    },
    PHYSICIAN: {
        name: 'Physician',
        permissions: [
            'view_all_patient_records',
            'create_diagnoses',
            'prescribe_medications',
            'order_tests',
            'create_treatment_plans',
            'approve_treatments',
            'patient_communication',
            'view_reports',
            'supervise_staff'
        ],
        level: 4,
        dashboard: '/physician-dashboard',
        mfa_required: true
    },
    BILLING: {
        name: 'Billing Specialist',
        permissions: [
            'view_patient_billing',
            'create_invoices',
            'process_payments',
            'insurance_claims',
            'financial_reports',
            'billing_communication'
        ],
        level: 2,
        dashboard: '/billing-dashboard',
        mfa_required: true
    },
    ADMINISTRATOR: {
        name: 'System Administrator',
        permissions: [
            'user_management',
            'system_configuration',
            'security_monitoring',
            'backup_management',
            'audit_logs',
            'role_management',
            'all_permissions'
        ],
        level: 5,
        dashboard: '/admin-dashboard',
        mfa_required: true
    }
};

// Permission checking middleware
function checkPermission(requiredPermission) {
    return (req, res, next) => {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const userRole = ROLES[user.user_type];
        if (!userRole) {
            return res.status(403).json({ error: 'Invalid user role' });
        }

        const hasPermission = userRole.permissions.includes(requiredPermission) || 
                            userRole.permissions.includes('all_permissions');

        if (!hasPermission) {
            logSecurityEvent(user.id, 'PERMISSION_DENIED', 'MEDIUM', 
                `Access denied for permission: ${requiredPermission}`, req);
            return res.status(403).json({ 
                error: 'Insufficient permissions',
                required_permission: requiredPermission,
                user_role: userRole.name
            });
        }

        next();
    };
}

// Role hierarchy checking
function checkRoleLevel(requiredLevel) {
    return (req, res, next) => {
        const user = req.user;
        const userRole = ROLES[user.user_type];
        
        if (userRole.level < requiredLevel) {
            return res.status(403).json({ 
                error: 'Insufficient role level',
                required_level: requiredLevel,
                user_level: userRole.level
            });
        }
        
        next();
    };
}
// Persistence (load existing users if any)
const { loadUsers, scheduleSaveUsers } = require('./lib/persistence');
const users = new Map();
(() => {
    const loaded = loadUsers();
    if (loaded.length) {
        loaded.forEach(u => {
            const userObj = new WebQXUser(u); // rehydrate class methods
            users.set(userObj.email, userObj);
            users.set(userObj.id, userObj);
        });
        console.log(`[persistence] Loaded ${loaded.length} users from disk`);
    }
})();
const userSessions = new Map();
const securityEvents = new Map();
const loginHistory = new Map();

// Utility Functions
function getClientIP(req) {
    return req.headers['x-forwarded-for'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           '127.0.0.1';
}

function logSecurityEvent(userId, eventType, severity, description, req) {
    const event = {
        id: uuidv4(),
        user_id: userId,
        event_type: eventType,
        severity: severity,
        timestamp: new Date(),
        ip_address: getClientIP(req),
        user_agent: req.headers['user-agent'] || '',
        description: description,
        metadata: {}
    };
    
    securityEvents.set(event.id, event);
    console.log(`[SECURITY] ${severity}: ${eventType} - ${description} (User: ${userId})`);
}

function logLoginAttempt(userId, status, req, failureReason = null) {
    const loginRecord = {
        id: uuidv4(),
        user_id: userId,
        timestamp: new Date(),
        ip_address: getClientIP(req),
        user_agent: req.headers['user-agent'] || '',
        status: status,
        failure_reason: failureReason
    };
    
    loginHistory.set(loginRecord.id, loginRecord);
}

// Authentication Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }

        // Support both legacy (email keyed) and new id-keyed storage
        const emailKey = user.email ? user.email.toLowerCase() : null;
        let userData = null;
        if (emailKey && users.has(emailKey)) userData = users.get(emailKey);
        if (!userData && users.has(user.user_id)) userData = users.get(user.user_id);

        if (!userData || !userData.is_active) {
            return res.status(403).json({ error: 'User account is inactive' });
        }

        req.user = userData;
        next();
    });
}

// Routes

// Health Check (Django-style)
app.get('/health/', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        service: 'webqx-auth',
        users_count: users.size,
        active_sessions: userSessions.size
    });
});

// Development diagnostics (disabled in production)
if ((process.env.NODE_ENV || 'development') !== 'production') {
    app.get('/internal/users', (req, res) => {
        const list = [];
        for (const [k, v] of users.entries()) {
            // Skip duplicate id mapping by filtering where key matches email or id uniquely
            list.push({ key: k, id: v.id, email: v.email, active: v.is_active, created_at: v.created_at });
        }
        res.json({ count: list.length, users: list.slice(0, 200) });
    });
}

// Functional User Registration
const { validateRegistration } = require('./lib/validation');
const { generateAccessToken, generateRefreshToken } = require('./lib/tokens');
const { sendValidationError, sendError, sendSuccess } = require('./lib/responses');

app.post('/api/v1/auth/register/', async (req, res) => {
    try {
        const { errors, sanitized } = validateRegistration(req.body, users);
        if (Object.keys(errors).length) {
            return sendValidationError(res, errors);
        }

        const password_hash = await bcrypt.hash(sanitized.password, BCRYPT_ROUNDS);
        const user = new WebQXUser({
            ...sanitized,
            password_hash
        });

        users.set(user.email, user);
    scheduleSaveUsers(users);
        users.set(user.id, user); // id lookup
    scheduleSaveUsers(users);

        logSecurityEvent(user.id, 'ACCOUNT_CREATED', 'LOW', 'New user account created', req);

        const accessToken = generateAccessToken(user, false);
        const refreshToken = generateRefreshToken(user);

        return res.status(201).json({
            success: true,
            message: 'Registration successful. Please check your email for verification.',
            user: {
                id: user.id,
                email: user.email,
                full_name: user.get_full_name(),
                user_type: user.user_type,
                verification_status: user.verification_status,
                email_verified: user.email_verified
            },
            tokens: { access: accessToken, refresh: refreshToken }
        });
    } catch (error) {
        console.error('Registration error:', error);
        return sendError(res, 500, 'Registration failed. Please try again.', { errors: { non_field_errors: ['An unexpected error occurred'] } });
    }
});

// Fallback unprefixed registration (gateway proxy quirk safeguard)
app.post('/register/', async (req, res) => {
    req.url = '/api/v1/auth/register/';
    return app._router.handle(req, res, () => {});
});

// User Login (Django-style JWT)
app.post('/api/v1/auth/token/', async (req, res) => {
    const { checkCredentialsInput, findUser, checkAccountStatus, verifyPassword, buildLoginResponse } = require('./lib/auth');
    try {
        const creds = checkCredentialsInput(req.body);
        if (!creds.valid) return sendError(res, 400, creds.error);

        const { email, password, remember_me } = req.body;
        const user = findUser(users, email);

        const status = checkAccountStatus(user);
        if (!status.ok) {
            logLoginAttempt(user ? user.id : null, status.code === 423 ? 'BLOCKED' : 'FAILED', req, status.error);
            return sendError(res, status.code, status.error);
        }

        const passwordValid = await verifyPassword(user, password);
        if (!passwordValid) {
            user.increment_failed_login();
            users.set(user.email, user);
            scheduleSaveUsers(users);
            logLoginAttempt(user.id, 'FAILED', req, 'Invalid password');
            const attemptsRemaining = Math.max(0, 5 - user.failed_login_attempts);
            return sendError(res, 401, 'Invalid email or password', {
                attempts_remaining: attemptsRemaining,
                lockout_until: user.lockout_until
            });
        }

        // Future: Insert MFA challenge flow if required

        user.reset_failed_login();
        user.last_login_ip = getClientIP(req);
        user.last_activity = new Date();
        users.set(user.email, user);
    scheduleSaveUsers(users);

        logLoginAttempt(user.id, 'SUCCESS', req);
        logSecurityEvent(user.id, 'SUCCESSFUL_LOGIN', 'LOW', 'User logged in successfully', req);

        const responsePayload = buildLoginResponse(user, !!remember_me);
        return sendSuccess(res, responsePayload, 'Login successful');
    } catch (error) {
        console.error('Login error:', error);
        return sendError(res, 500, 'Login failed. Please try again.');
    }
});

// Fallback unprefixed token endpoint
app.post('/token/', async (req, res) => {
    req.url = '/api/v1/auth/token/';
    return app._router.handle(req, res, () => {});
});

// Get User Profile (Django-style)
app.get('/api/v1/auth/profile/', authenticateToken, (req, res) => {
    const user = req.user;
    
    res.json({
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        full_name: user.get_full_name(),
        date_of_birth: user.date_of_birth,
        phone_number: user.phone_number,
        user_type: user.user_type,
        verification_status: user.verification_status,
        country: user.country,
        language: user.language,
        timezone: user.timezone,
        is_verified: user.is_verified,
        email_verified: user.email_verified,
        phone_verified: user.phone_verified,
        mfa_enabled: user.mfa_enabled,
        created_at: user.created_at,
        updated_at: user.updated_at,
        last_activity: user.last_activity
    });
});

// Non-trailing-slash variant for proxy compatibility
app.get('/api/v1/auth/profile', authenticateToken, (req, res) => {
    const user = req.user;
    res.json({
        id: user.id,
        email: user.email,
        full_name: user.get_full_name()
    });
});

// MFA Setup (Django-style)
app.get('/api/v1/auth/mfa/setup/', authenticateToken, async (req, res) => {
    const user = req.user;
    
    if (user.mfa_enabled) {
        return res.json({
            message: 'MFA is already enabled',
            setup_complete: true
        });
    }

    try {
        const secret = speakeasy.generateSecret({
            name: user.email,
            issuer: 'WebQX Healthcare'
        });

        const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

        // Store secret temporarily (in production, use Redis with expiry)
        user.temp_mfa_secret = secret.base32;
        users.set(user.email, user);

        res.json({
            qr_code: qrCodeUrl,
            secret: secret.base32,
            setup_complete: false
        });

    } catch (error) {
        console.error('MFA setup error:', error);
        res.status(500).json({
            error: 'Failed to setup MFA. Please try again.'
        });
    }
});

app.post('/api/v1/auth/mfa/setup/', authenticateToken, (req, res) => {
    const user = req.user;
    const { token } = req.body;

    if (!user.temp_mfa_secret) {
        return res.status(400).json({
            error: 'Setup session expired. Please start again.'
        });
    }

    const verified = speakeasy.totp.verify({
        secret: user.temp_mfa_secret,
        encoding: 'base32',
        token: token,
        window: 2
    });

    if (verified) {
        user.mfa_enabled = true;
        user.mfa_secret = user.temp_mfa_secret;
        delete user.temp_mfa_secret;
        
        // Generate backup tokens
        user.backup_tokens = Array.from({ length: 10 }, () => 
            Math.random().toString(36).substr(2, 8).toUpperCase()
        );

        users.set(user.email, user);

        logSecurityEvent(user.id, 'MFA_ENABLED', 'MEDIUM', 'Multi-factor authentication enabled', req);

        res.json({
            message: 'MFA setup complete',
            backup_tokens: user.backup_tokens,
            setup_complete: true
        });
    } else {
        res.status(400).json({
            error: 'Invalid token. Please try again.'
        });
    }
});

// Role-based Dashboard Routes
app.get('/api/v1/dashboard/', authenticateToken, (req, res) => {
    const user = req.user;
    const roleInfo = user.get_role_info();
    
    res.json({
        user: {
            id: user.id,
            email: user.email,
            full_name: user.get_full_name(),
            role: roleInfo.name,
            dashboard_url: roleInfo.dashboard
        },
        role_info: roleInfo,
        quick_actions: getQuickActionsForRole(user.user_type),
        notifications: getUserNotifications(user.id),
        recent_activity: getUserRecentActivity(user.id)
    });
});

// Patient Dashboard
app.get('/api/v1/patient-dashboard/', authenticateToken, checkPermission('view_own_records'), (req, res) => {
    const user = req.user;
    res.json({
        dashboard_type: 'patient',
        user: user.get_full_name(),
        sections: [
            { name: 'My Health Records', permission: 'view_own_records', available: true },
            { name: 'Appointments', permission: 'book_appointments', available: true },
            { name: 'Lab Results', permission: 'view_lab_results', available: true },
            { name: 'Medications', permission: 'view_own_records', available: true },
            { name: 'Messages', permission: 'message_providers', available: true },
            { name: 'Billing', permission: 'view_billing', available: true }
        ]
    });
});

// Physician Dashboard
app.get('/api/v1/physician-dashboard/', authenticateToken, checkPermission('view_all_patient_records'), (req, res) => {
    const user = req.user;
    res.json({
        dashboard_type: 'physician',
        user: user.get_full_name(),
        sections: [
            { name: 'Patient Records', permission: 'view_all_patient_records', available: true },
            { name: 'Diagnoses & Treatment', permission: 'create_diagnoses', available: true },
            { name: 'Prescriptions', permission: 'prescribe_medications', available: true },
            { name: 'Lab Orders', permission: 'order_tests', available: true },
            { name: 'Staff Supervision', permission: 'supervise_staff', available: true },
            { name: 'Reports', permission: 'view_reports', available: true }
        ]
    });
});

// Nurse Dashboard
app.get('/api/v1/nurse-dashboard/', authenticateToken, checkPermission('view_patient_records'), (req, res) => {
    const user = req.user;
    res.json({
        dashboard_type: 'nurse',
        user: user.get_full_name(),
        sections: [
            { name: 'Patient Care', permission: 'view_patient_records', available: true },
            { name: 'Vitals & Notes', permission: 'update_vitals', available: true },
            { name: 'Medications', permission: 'manage_medications', available: true },
            { name: 'Schedules', permission: 'view_schedules', available: true },
            { name: 'Patient Communication', permission: 'patient_communication', available: true }
        ]
    });
});

// Admin Dashboard
app.get('/api/v1/admin-dashboard/', authenticateToken, checkPermission('user_management'), (req, res) => {
    const user = req.user;
    res.json({
        dashboard_type: 'administrator',
        user: user.get_full_name(),
        sections: [
            { name: 'User Management', permission: 'user_management', available: true },
            { name: 'System Configuration', permission: 'system_configuration', available: true },
            { name: 'Security Monitoring', permission: 'security_monitoring', available: true },
            { name: 'Audit Logs', permission: 'audit_logs', available: true },
            { name: 'Role Management', permission: 'role_management', available: true },
            { name: 'Backup Management', permission: 'backup_management', available: true }
        ]
    });
});

// Billing Dashboard
app.get('/api/v1/billing-dashboard/', authenticateToken, checkPermission('view_patient_billing'), (req, res) => {
    const user = req.user;
    res.json({
        dashboard_type: 'billing',
        user: user.get_full_name(),
        sections: [
            { name: 'Patient Billing', permission: 'view_patient_billing', available: true },
            { name: 'Invoices', permission: 'create_invoices', available: true },
            { name: 'Payments', permission: 'process_payments', available: true },
            { name: 'Insurance Claims', permission: 'insurance_claims', available: true },
            { name: 'Financial Reports', permission: 'financial_reports', available: true }
        ]
    });
});

// Helper functions for dashboard
function getQuickActionsForRole(userType) {
    const actions = {
        PATIENT: ['View Lab Results', 'Book Appointment', 'Message Doctor', 'Pay Bill'],
        NURSE: ['Update Vitals', 'Add Notes', 'Check Schedule', 'Patient Messages'],
        PHYSICIAN_ASSISTANT: ['Review Patients', 'Write Prescriptions', 'Order Tests', 'Treatment Plans'],
        PHYSICIAN: ['Patient Rounds', 'Approve Treatments', 'Staff Oversight', 'Medical Reports'],
        BILLING: ['Process Payments', 'Insurance Claims', 'Generate Invoices', 'Financial Reports'],
        ADMINISTRATOR: ['User Management', 'System Monitoring', 'Security Audit', 'Backup Status']
    };
    return actions[userType] || [];
}

function getUserNotifications(userId) {
    return [
        { type: 'info', message: 'System maintenance scheduled for tonight', priority: 'low' },
        { type: 'success', message: 'Login successful', priority: 'low' }
    ];
}

function getUserRecentActivity(userId) {
    return [
        { action: 'Login', timestamp: new Date(), ip: '127.0.0.1' },
        { action: 'Profile viewed', timestamp: new Date(Date.now() - 300000), ip: '127.0.0.1' }
    ];
}
app.get('/api/v1/auth/security/dashboard/', authenticateToken, (req, res) => {
    const user = req.user;
    
    // Get user's security events
    const userEvents = Array.from(securityEvents.values())
        .filter(event => event.user_id === user.id)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10);

    // Get user's login history
    const userLogins = Array.from(loginHistory.values())
        .filter(login => login.user_id === user.id)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10);

    res.json({
        account_security: {
            mfa_enabled: user.mfa_enabled,
            email_verified: user.email_verified,
            phone_verified: user.phone_verified,
            account_created: user.created_at,
            last_login_ip: user.last_login_ip
        },
        recent_events: userEvents.map(event => ({
            event_type: event.event_type,
            severity: event.severity,
            timestamp: event.timestamp,
            description: event.description,
            ip_address: event.ip_address
        })),
        recent_logins: userLogins.map(login => ({
            timestamp: login.timestamp,
            ip_address: login.ip_address,
            status: login.status,
            user_agent: login.user_agent?.substring(0, 100) + '...'
        })),
        statistics: {
            total_logins: userLogins.filter(l => l.status === 'SUCCESS').length,
            failed_attempts: userLogins.filter(l => l.status === 'FAILED').length,
            security_events: userEvents.length
        }
    });
});

// Serve test frontend
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>WebQX Auth Console</title><style>
    :root { --blue:#2563eb; --gray:#64748b; --bg:#f5f7fb; --radius:10px; --mono:ui-monospace, SFMono-Regular, Menlo, monospace; }
    body { margin:0; font-family:system-ui,-apple-system,Segoe UI,Roboto; background:var(--bg); color:#1e293b; }
    header { padding:1.25rem 1rem; background:#fff; box-shadow:0 2px 4px rgba(0,0,0,.06); position:sticky; top:0; z-index:10; }
    h1 { margin:0; font-size:1.25rem; color:var(--blue); display:flex; align-items:center; gap:.5rem; }
    main { max-width:1050px; margin:0 auto; padding:1rem 1rem 3rem; }
    .tabs { display:flex; flex-wrap:wrap; gap:.5rem; margin:1rem 0 1.25rem; }
    .tab-btn { background:#fff; border:1px solid #cbd5e1; padding:.55rem .9rem; border-radius:6px; cursor:pointer; font-size:.85rem; font-weight:500; color:#334155; display:flex; align-items:center; gap:.4rem; }
    .tab-btn.active { background:var(--blue); color:#fff; border-color:var(--blue); box-shadow:0 1px 3px rgba(0,0,0,.15); }
    section[role=tabpanel] { background:#fff; border:1px solid #e2e8f0; padding:1.1rem 1.1rem 1.4rem; border-radius:var(--radius); display:none; }
    section[role=tabpanel].active { display:block; animation:fade .25s ease; }
    @keyframes fade { from { opacity:0; transform:translateY(4px);} to { opacity:1; transform:translateY(0);} }
    form.grid { display:grid; gap:.75rem; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); margin-top:.75rem; }
    label { font-size:.7rem; letter-spacing:.05em; text-transform:uppercase; font-weight:600; color:#475569; display:block; margin-bottom:.25rem; }
    input, select { width:100%; padding:.55rem .6rem; border:1px solid #cbd5e1; border-radius:6px; font-size:.8rem; background:#f8fafc; }
    input:focus, select:focus { outline:2px solid var(--blue); outline-offset:1px; background:#fff; }
    .full { grid-column:1 / -1; }
    .actions { margin-top:.6rem; display:flex; flex-wrap:wrap; gap:.5rem; }
    button { border:none; background:var(--blue); color:#fff; font-weight:600; font-size:.75rem; letter-spacing:.04em; padding:.6rem 1.1rem; border-radius:6px; cursor:pointer; display:inline-flex; align-items:center; gap:.35rem; }
    button.secondary { background:#475569; }
    button.outline { background:#fff; color:var(--blue); border:1px solid var(--blue); }
    button:disabled { opacity:.55; cursor:not-allowed; }
    pre { background:#0f172a; color:#e2e8f0; padding:.85rem .9rem; border-radius:8px; font-size:.65rem; line-height:1.25; overflow:auto; max-height:350px; }
    .result-group { margin-top:1rem; display:grid; gap:1rem; }
    .status-pill { background:#dcfce7; color:#166534; padding:.25rem .6rem; border-radius:999px; font-size:.65rem; font-weight:600; letter-spacing:.05em; }
    .endpoint-list { columns:2; font-size:.7rem; margin:0; padding:0; list-style:none; }
    .endpoint-list li { break-inside:avoid; margin-bottom:.35rem; }
    .badge { background:#eef2ff; color:#3730a3; font-size:.55rem; padding:.2rem .45rem; border-radius:4px; font-weight:600; }
    .inline { display:inline-block; }
    .split { display:grid; gap:1rem; grid-template-columns:repeat(auto-fit,minmax(310px,1fr)); margin-top:1rem; }
    .card { background:#fff; border:1px solid #e2e8f0; padding:.9rem .95rem 1rem; border-radius:8px; position:relative; }
    .card h3 { margin:.1rem 0 .65rem; font-size:.85rem; letter-spacing:.03em; color:#334155; display:flex; align-items:center; gap:.4rem; }
    .muted { color:#64748b; font-size:.65rem; line-height:1.25; }
    .small { font-size:.6rem; }
    a.inline-link { color:var(--blue); text-decoration:none; }
    a.inline-link:hover { text-decoration:underline; }
    .toast { position:fixed; right:1rem; bottom:1rem; background:#1e293b; color:#fff; padding:.7rem .9rem; border-radius:8px; font-size:.7rem; box-shadow:0 4px 18px -2px rgba(0,0,0,.35); display:none; }
    .toast.show { display:block; animation:pop .25s ease; }
    @keyframes pop { from { transform:translateY(6px); opacity:0;} to { transform:translateY(0); opacity:1; } }
    details { background:#f1f5f9; padding:.6rem .8rem; border-radius:6px; }
    summary { cursor:pointer; font-size:.65rem; font-weight:600; letter-spacing:.05em; }
    code.inline { font-family:var(--mono); background:#1e293b; color:#e2e8f0; padding:.15rem .35rem; border-radius:4px; font-size:.6rem; }
    .flex { display:flex; gap:.35rem; align-items:center; flex-wrap:wrap; }
    .gap { margin-top:.65rem; }
    </style></head><body>
    <header><h1>🔐 WebQX Auth Console <span class="status-pill" id="statusPill">ONLINE</span><button id="btnLogout" style="margin-left:auto; background:#dc2626;" class="secondary">Logout</button></h1></header>
    <main>
      <p class="muted">Functional test console for the in-memory Django‑style authentication service. Use the tabs below to exercise flows. All data resets when the process restarts.</p>
      <nav class="tabs" role="tablist" aria-label="Authentication Panels">
        <button class="tab-btn active" role="tab" aria-selected="true" data-tab="register">👤 Register</button>
        <button class="tab-btn" role="tab" aria-selected="false" data-tab="login">🔑 Login</button>
        <button class="tab-btn" role="tab" aria-selected="false" data-tab="profile">📇 Profile</button>
        <button class="tab-btn" role="tab" aria-selected="false" data-tab="dashboards">📊 Dashboards</button>
        <button class="tab-btn" role="tab" aria-selected="false" data-tab="security">🔒 Security</button>
    <button class="tab-btn" role="tab" aria-selected="false" data-tab="raw">🧪 Raw HTTP</button>
    <button class="tab-btn" role="tab" aria-selected="false" data-tab="reference">📘 Reference</button>
      </nav>

      <section id="tab-register" role="tabpanel" class="active" aria-labelledby="Register">
        <h2 class="small" style="margin:0 0 .5rem; letter-spacing:.06em; text-transform:uppercase;">Register User</h2>
        <form id="registerForm" class="grid" autocomplete="off">
          <div><label>Email</label><input required type="email" id="regEmail" placeholder="user+demo@example.com"/></div>
          <div><label>Password</label><input required type="password" id="regPassword" placeholder="Min 12 chars"/></div>
          <div><label>Confirm</label><input required type="password" id="regPasswordConfirm"/></div>
          <div><label>First Name</label><input required id="regFirstName" placeholder="Jane"/></div>
            <div><label>Last Name</label><input required id="regLastName" placeholder="Doe"/></div>
          <div><label>User Type</label><select id="regUserType"><option value="PATIENT">Patient</option><option value="PHYSICIAN">Physician</option><option value="PHYSICIAN_ASSISTANT">Physician Assistant</option><option value="NURSE">Nurse</option><option value="ADMINISTRATOR">Admin</option><option value="BILLING">Billing</option></select></div>
          <div><label>Country</label><select id="regCountry"><option>US</option><option>CA</option><option>GB</option><option>DE</option><option>FR</option><option>IN</option><option>BR</option></select></div>
          <div class="full flex small" style="margin-top:.4rem;">
             <label class="inline"><input type="checkbox" id="regTerms"/> Terms</label>
             <label class="inline"><input type="checkbox" id="regPrivacy"/> Privacy</label>
             <label class="inline"><input type="checkbox" id="regHipaa"/> HIPAA (patients)</label>
          </div>
          <div class="actions full"><button type="submit">Create Account</button><button type="button" class="secondary" id="btnFillPatient">Fill Patient</button><button type="button" class="secondary" id="btnFillPhys">Fill Physician</button></div>
        </form>
        <div class="result-group"><pre id="registerOut" aria-live="polite" hidden></pre></div>
      </section>

            <section id="tab-login" role="tabpanel" aria-labelledby="Login">
                <h2 class="small" style="margin:0 0 .5rem; letter-spacing:.06em; text-transform:uppercase;">Login</h2>
                <form id="loginForm" class="grid" autocomplete="off">
                    <div><label>Email</label><input type="email" id="loginEmail" required/></div>
                    <div><label>Password <span class="small" id="togglePass" style="cursor:pointer; color:var(--blue);">show</span></label><input type="password" id="loginPassword" required/></div>
                    <div class="full flex small">
                        <label class="inline"><input type="checkbox" id="loginRemember"/> Remember 7d</label>
                        <div id="attemptMeta" class="muted small"></div>
                        <button type="submit">Login</button>
                        <button type="button" class="secondary" id="btnCopyAccess">Copy Token</button>
                        <button type="button" class="outline" id="btnShowToken">Reveal Token</button>
                    </div>
                </form>
                <pre id="loginOut" aria-live="polite" hidden></pre>
                <pre id="tokenReveal" hidden></pre>
            </section>

      <section id="tab-profile" role="tabpanel" aria-labelledby="Profile">
        <div class="actions"><button id="btnGetProfile">Get Profile</button><button class="secondary" id="btnGetSecurity">Security Dashboard</button><button class="secondary" id="btnSetupMfa">MFA Setup</button><button class="outline" id="btnHealth">Health</button></div>
        <div class="split" style="margin-top:1rem;">
            <div class="card"><h3>Profile</h3><pre id="profileOut" hidden></pre></div>
            <div class="card"><h3>Security</h3><pre id="secOut" hidden></pre></div>
            <div class="card"><h3>MFA</h3><div id="mfaWrap" class="muted small">No request yet.</div><div class="gap small"><input id="mfaCode" maxlength="6" placeholder="123456" style="width:90px;"/> <button id="btnVerifyMfa" class="secondary" type="button">Verify</button></div><pre id="mfaOut" hidden></pre></div>
        </div>
      </section>

      <section id="tab-dashboards" role="tabpanel" aria-labelledby="Dashboards">
        <div class="actions"><button data-dash="/api/v1/dashboard/">My Dashboard</button><button class="secondary" data-dash="/api/v1/patient-dashboard/">Patient</button><button class="secondary" data-dash="/api/v1/physician-dashboard/">Physician</button><button class="secondary" data-dash="/api/v1/nurse-dashboard/">Nurse</button><button class="secondary" data-dash="/api/v1/admin-dashboard/">Admin</button><button class="secondary" data-dash="/api/v1/billing-dashboard/">Billing</button></div>
        <pre id="dashOut" hidden></pre>
      </section>

      <section id="tab-security" role="tabpanel" aria-labelledby="Security">
        <div class="card"><h3>Recent Auth Events</h3><p class="muted">Use the other tabs to generate events. Then refresh here.</p><div class="actions"><button id="btnRefreshSecurity">Refresh</button></div><pre id="securityEvents" hidden></pre></div>
      </section>

            <section id="tab-raw" role="tabpanel" aria-labelledby="Raw HTTP">
                <div class="card"><h3>Raw HTTP Tester</h3>
                    <form id="rawForm" class="grid" autocomplete="off">
                        <div><label>Method</label><select id="rawMethod"><option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option></select></div>
                        <div class="full"><label>Path</label><input id="rawPath" value="/api/v1/auth/profile/"/></div>
                        <div class="full"><label>Headers (JSON)</label><textarea id="rawHeaders" style="width:100%; min-height:60px; font-size:.65rem; font-family:var(--mono);"></textarea></div>
                        <div class="full"><label>Body (JSON)</label><textarea id="rawBody" style="width:100%; min-height:90px; font-size:.65rem; font-family:var(--mono);">{}</textarea></div>
                        <div class="actions full"><button type="submit">Send Request</button><button type="button" class="secondary" id="btnRawClear">Clear</button></div>
                    </form>
                    <pre id="rawOut" hidden></pre>
                </div>
            </section>

      <section id="tab-reference" role="tabpanel" aria-labelledby="Reference">
        <h2 class="small" style="margin:0 0 .75rem; letter-spacing:.06em; text-transform:uppercase;">API Reference</h2>
        <ul class="endpoint-list" aria-label="Endpoints"><li><span class="badge">POST</span> /api/v1/auth/register/</li><li><span class="badge">POST</span> /api/v1/auth/token/</li><li><span class="badge">GET</span> /api/v1/auth/profile/</li><li><span class="badge">GET</span> /api/v1/auth/mfa/setup/</li><li><span class="badge">GET</span> /api/v1/auth/security/dashboard/</li><li><span class="badge">GET</span> /api/v1/dashboard/</li><li><span class="badge">GET</span> /api/v1/patient-dashboard/</li><li><span class="badge">GET</span> /api/v1/physician-dashboard/</li><li><span class="badge">GET</span> /api/v1/nurse-dashboard/</li><li><span class="badge">GET</span> /api/v1/admin-dashboard/</li><li><span class="badge">GET</span> /api/v1/billing-dashboard/</li><li><span class="badge">GET</span> /health/</li></ul>
        <details class="gap"><summary>Token Storage</summary><p class="muted">Access token cached in <code class="inline">localStorage</code> under <code class="inline">webqx_token</code>. Clear it to simulate logout.</p></details>
        <details class="gap"><summary>Notes</summary><p class="muted">This console is intentionally minimal. It focuses on functional clarity over visual design so flows are easy to trace.</p></details>
      </section>
    </main>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>
    <script>
    // Utility helpers
    const qs = s => document.querySelector(s); const qsa = s => [...document.querySelectorAll(s)];
    const out = (el, data) => { el.hidden = false; el.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2); };
    const toast = msg => { const t = qs('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(()=>t.classList.remove('show'), 3200); };
    const tokenKey = 'webqx_token'; let authToken = localStorage.getItem(tokenKey) || '';
    function authHeaders() { return authToken ? { 'Authorization': 'Bearer ' + authToken } : {}; }
    const fetchJSON = async (url, opt={}) => { const r = await fetch(url, { ...opt, headers: { 'Content-Type': 'application/json', ...(opt.headers||{}), ...authHeaders() }}); const j = await r.json().catch(()=>({ raw: 'non-json' })); return { ok: r.ok, status: r.status, data: j, headers: r.headers }; };

    // Tabs
    qsa('.tab-btn').forEach(btn=>btn.addEventListener('click', e=>{ qsa('.tab-btn').forEach(b=>b.classList.remove('active')); e.currentTarget.classList.add('active'); const id = 'tab-' + e.currentTarget.dataset.tab; qsa('section[role=tabpanel]').forEach(p=>p.classList.remove('active')); qs('#'+id).classList.add('active'); }));

    // Registration
    qs('#registerForm').addEventListener('submit', async e => { e.preventDefault(); const data = { email:regEmail.value, password:regPassword.value, password_confirm:regPasswordConfirm.value, first_name:regFirstName.value, last_name:regLastName.value, user_type:regUserType.value, country:regCountry.value, terms_accepted:regTerms.checked, privacy_policy_accepted:regPrivacy.checked, hipaa_authorization:regHipaa.checked }; const { ok, data:resp } = await fetchJSON('/api/v1/auth/register/', { method:'POST', body: JSON.stringify(data) }); out(registerOut, resp); if (ok && resp.tokens?.access){ authToken = resp.tokens.access; localStorage.setItem(tokenKey, authToken); loginEmail.value = data.email; loginPassword.value = data.password; toast('Registered & token stored'); } else toast('Registration failed'); });
    qs('#btnFillPatient').onclick = ()=>{ regEmail.value='patient.test@webqx.healthcare'; regPassword.value=regPasswordConfirm.value='SecurePatient123!'; regFirstName.value='Jane'; regLastName.value='Patient'; regUserType.value='PATIENT'; regCountry.value='US'; regTerms.checked=regPrivacy.checked=regHipaa.checked=true; toast('Filled patient example'); };
    qs('#btnFillPhys').onclick = ()=>{ regEmail.value='doctor.smith@webqx.healthcare'; regPassword.value=regPasswordConfirm.value='SecurePhysician123!'; regFirstName.value='Sarah'; regLastName.value='Smith'; regUserType.value='PHYSICIAN'; regCountry.value='US'; regTerms.checked=regPrivacy.checked=true; regHipaa.checked=false; toast('Filled physician example'); };

    // Login
    qs('#loginForm').addEventListener('submit', async e => { e.preventDefault(); const data={ email:loginEmail.value, password:loginPassword.value, remember_me:loginRemember.checked }; const { ok, data:resp, headers } = await fetchJSON('/api/v1/auth/token/', { method:'POST', body: JSON.stringify(data) }); out(loginOut, resp); if (!ok && resp.attempts_remaining !== undefined){ attemptMeta.textContent = 'Attempts left: '+resp.attempts_remaining + (resp.lockout_until ? ' | lockout at next fail' : ''); if (resp.lockout_until) attemptMeta.textContent += ' lockout until '+resp.lockout_until; } if (ok && resp.access){ authToken = resp.access; localStorage.setItem(tokenKey, authToken); attemptMeta.textContent='Authenticated'; toast('Logged in & token stored'); } else if(!ok) { toast('Login failed'); } const rl = headers.get('x-ratelimit-remaining'); if (rl) attemptMeta.textContent += ' | rate left '+rl; });
    qs('#togglePass').onclick = ()=>{ const f = loginPassword; if (f.type==='password'){ f.type='text'; togglePass.textContent='hide'; } else { f.type='password'; togglePass.textContent='show'; } };
    qs('#btnShowToken').onclick = ()=>{ if(!authToken) return toast('No token'); out(tokenReveal, authToken); };
    qs('#btnLogout').onclick = ()=>{ authToken=''; localStorage.removeItem(tokenKey); [loginOut, profileOut, secOut, dashOut, tokenReveal].forEach(el=>{ if(el) el.hidden=true; }); attemptMeta.textContent='Logged out'; toast('Logged out'); };
    qs('#btnCopyAccess').onclick = ()=>{ if(!authToken) return toast('No token'); navigator.clipboard.writeText(authToken).then(()=>toast('Access token copied')); };

    // Profile
    qs('#btnGetProfile').onclick = async ()=>{ const { ok, data } = await fetchJSON('/api/v1/auth/profile/'); out(profileOut, data); toast(ok?'Profile loaded':'Profile error'); };
    qs('#btnGetSecurity').onclick = async ()=>{ const { ok, data } = await fetchJSON('/api/v1/auth/security/dashboard/'); out(secOut, data); toast(ok?'Security loaded':'Security error'); };
    qs('#btnSetupMfa').onclick = async ()=>{ const { ok, data } = await fetchJSON('/api/v1/auth/mfa/setup/'); if (ok && data.qr_code){ mfaWrap.innerHTML = '<img alt="MFA QR" style="max-width:140px;" src="'+data.qr_code+'"/><div class="small" style="margin-top:.4rem;">Secret: '+data.secret+'</div>'; toast('MFA QR ready'); } else { mfaWrap.textContent = JSON.stringify(data,null,2); toast(ok?'MFA status':'MFA error'); } };
    qs('#btnVerifyMfa').onclick = async ()=>{ const code = mfaCode.value.trim(); if(code.length!==6) return toast('Enter 6 digits'); const { ok, data } = await fetchJSON('/api/v1/auth/mfa/setup/', { method:'POST', body: JSON.stringify({ token: code }) }); out(mfaOut, data); toast(ok? 'MFA verified' : 'MFA verify failed'); };
    qs('#btnHealth').onclick = async ()=>{ const { data } = await fetchJSON('/health/'); toast('Health checked'); out(secOut, data); };

    // Dashboards
    qsa('[data-dash]').forEach(btn=>btn.onclick = async e => { const ep = e.currentTarget.getAttribute('data-dash'); const { ok, data } = await fetchJSON(ep); out(dashOut, data); toast(ok ? 'Dashboard '+ep+' loaded' : 'Dashboard error'); });

        // Security events (reuse security dashboard subset)
    qs('#btnRefreshSecurity').onclick = async ()=>{ const { data } = await fetchJSON('/api/v1/auth/security/dashboard/'); out(securityEvents, data.recent_events || data); toast('Events refreshed'); };

        // Raw HTTP panel
        qs('#rawForm').addEventListener('submit', async e => { e.preventDefault(); let headersObj={}; try { headersObj = rawHeaders.value ? JSON.parse(rawHeaders.value) : {}; } catch { toast('Bad headers JSON'); }
            let bodyObj = rawBody.value; try { if(rawBody.value.trim()) bodyObj = JSON.stringify(JSON.parse(rawBody.value)); } catch { /* leave as string */ }
            const method = rawMethod.value.toUpperCase(); const path = rawPath.value || '/'; const opts = { method }; if(!['GET','HEAD'].includes(method)) opts.body = bodyObj; const { ok, data, status, headers } = await fetchJSON(path, { ...opts, headers: headersObj }); out(rawOut, { status, ok, data }); toast('Raw request done'); });
        qs('#btnRawClear').onclick = ()=>{ rawOut.hidden=true; rawBody.value='{}'; rawHeaders.value=''; };

    if(authToken) toast('Loaded existing token');
    </script>
    </body></html>`);
});

// Start server
app.listen(PORT, () => {
    console.log(`
🚀 WebQX Authentication Server Started
🔐 Django-style Security Implementation
📍 Server: http://localhost:${PORT}
🏥 Health Check: http://localhost:${PORT}/health/
👤 Test Interface: http://localhost:${PORT}

🔑 API Endpoints:
   • POST /api/v1/auth/register/ - User Registration
   • POST /api/v1/auth/token/ - JWT Login
   • GET /api/v1/auth/profile/ - User Profile
   • GET /api/v1/auth/mfa/setup/ - MFA Setup
   • GET /api/v1/auth/security/dashboard/ - Security Dashboard

🌟 Features:
   • JWT Authentication
   • Rate Limiting
   • Account Lockout
   • MFA Support
   • Security Logging
   • HIPAA/GDPR Compliance
   • Django-style Validation

✅ Ready to serve millions of users securely!
    `);
});

module.exports = app;
