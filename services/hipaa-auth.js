/**
 * HIPAA-Compliant Authentication Service
 * 
 * Provides comprehensive authentication features required for HIPAA compliance:
 * - Strong password policies
 * - Two-factor authentication (2FA)
 * - Account lockout protection
 * - Session management
 * - Password rotation policies
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

/**
 * Password policy configuration
 */
const PASSWORD_POLICY = {
    minLength: 12,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    forbidCommonPasswords: true,
    forbidPersonalInfo: true,
    maxAge: 90, // days
    historyCount: 12, // previous passwords to remember
    lockoutThreshold: 5, // failed attempts before lockout
    lockoutDuration: 30, // minutes
};

/**
 * Session configuration
 */
const SESSION_CONFIG = {
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
    refreshThreshold: 30 * 60 * 1000, // 30 minutes
    maxConcurrentSessions: 3,
    requireFreshAuthFor: ['admin', 'sensitive_data_access'],
};

/**
 * In-memory stores (in production, use Redis or database)
 */
const userStore = new Map();
const sessionStore = new Map();
const loginAttempts = new Map();
const passwordHistory = new Map();

/**
 * HIPAA Authentication Service
 */
class HIPAAAuthService {
    constructor() {
        this.jwtSecret = process.env.JWT_SECRET || 'webqx-hipaa-secret-key-change-in-production';
        this.applicationName = 'WebQX Health';
        this.issuer = 'webqx-health.com';
    }

    /**
     * Register a new user with HIPAA-compliant password requirements
     * @param {Object} userData User registration data
     * @returns {Promise<Object>} Registration result
     */
    async registerUser(userData) {
        const { username, email, password, role, firstName, lastName } = userData;

        try {
            // Validate password policy
            const passwordValidation = this.validatePassword(password, { username, email, firstName, lastName });
            if (!passwordValidation.valid) {
                return {
                    success: false,
                    error: 'PASSWORD_POLICY_VIOLATION',
                    message: 'Password does not meet security requirements',
                    details: passwordValidation.errors
                };
            }

            // Check if user already exists
            if (userStore.has(username) || this.findUserByEmail(email)) {
                return {
                    success: false,
                    error: 'USER_EXISTS',
                    message: 'User already exists'
                };
            }

            // Hash password
            const passwordHash = await bcrypt.hash(password, 12);

            // Generate 2FA secret
            const twoFactorSecret = speakeasy.generateSecret({
                name: `${this.applicationName} (${username})`,
                issuer: this.issuer,
                length: 32
            });

            // Create user record
            const user = {
                id: this.generateUserId(),
                username,
                email,
                passwordHash,
                role,
                firstName,
                lastName,
                twoFactorSecret: twoFactorSecret.base32,
                twoFactorEnabled: false,
                createdAt: new Date(),
                lastPasswordChange: new Date(),
                loginAttempts: 0,
                lockedUntil: null,
                mustChangePassword: false,
                sessions: new Set(),
                lastLogin: null,
                ipAddresses: new Set(),
                auditLog: []
            };

            userStore.set(username, user);
            passwordHistory.set(username, [passwordHash]);

            // Generate QR code for 2FA setup
            const qrCodeUrl = await QRCode.toDataURL(twoFactorSecret.otpauth_url);

            return {
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    twoFactorEnabled: user.twoFactorEnabled,
                    mustChangePassword: user.mustChangePassword
                },
                twoFactorSetup: {
                    secret: twoFactorSecret.base32,
                    qrCode: qrCodeUrl,
                    manualEntryKey: twoFactorSecret.base32,
                    backupCodes: this.generateBackupCodes()
                }
            };

        } catch (error) {
            return {
                success: false,
                error: 'REGISTRATION_ERROR',
                message: 'User registration failed',
                details: error.message
            };
        }
    }

    /**
     * Authenticate user with 2FA support
     * @param {Object} credentials Authentication credentials
     * @returns {Promise<Object>} Authentication result
     */
    async authenticate(credentials) {
        const { username, password, twoFactorToken, ipAddress, userAgent } = credentials;

        try {
            // Check if account is locked
            const lockoutCheck = this.checkAccountLockout(username);
            if (lockoutCheck.locked) {
                return {
                    success: false,
                    error: 'ACCOUNT_LOCKED',
                    message: 'Account is temporarily locked due to too many failed attempts',
                    lockoutUntil: lockoutCheck.lockoutUntil
                };
            }

            // Get user
            const user = userStore.get(username);
            if (!user) {
                this.recordFailedLogin(username, ipAddress);
                return {
                    success: false,
                    error: 'INVALID_CREDENTIALS',
                    message: 'Invalid username or password'
                };
            }

            // Verify password
            const passwordValid = await bcrypt.compare(password, user.passwordHash);
            if (!passwordValid) {
                this.recordFailedLogin(username, ipAddress);
                return {
                    success: false,
                    error: 'INVALID_CREDENTIALS',
                    message: 'Invalid username or password'
                };
            }

            // Check 2FA if enabled
            if (user.twoFactorEnabled) {
                if (!twoFactorToken) {
                    return {
                        success: false,
                        error: 'TWO_FACTOR_REQUIRED',
                        message: 'Two-factor authentication token required'
                    };
                }

                const twoFactorValid = speakeasy.totp.verify({
                    secret: user.twoFactorSecret,
                    encoding: 'base32',
                    token: twoFactorToken,
                    window: 2 // Allow 2 windows for clock drift
                });

                if (!twoFactorValid) {
                    this.recordFailedLogin(username, ipAddress);
                    return {
                        success: false,
                        error: 'INVALID_TWO_FACTOR',
                        message: 'Invalid two-factor authentication token'
                    };
                }
            }

            // Check password age
            const passwordAge = (new Date() - user.lastPasswordChange) / (1000 * 60 * 60 * 24);
            if (passwordAge > PASSWORD_POLICY.maxAge) {
                user.mustChangePassword = true;
            }

            // Clear failed login attempts
            this.clearFailedLogins(username);

            // Create session
            const session = await this.createSession(user, { ipAddress, userAgent });

            // Update user login info
            user.lastLogin = new Date();
            user.ipAddresses.add(ipAddress);
            user.sessions.add(session.sessionId);

            // Audit log
            this.addAuditEntry(user, 'LOGIN_SUCCESS', { ipAddress, userAgent, sessionId: session.sessionId });

            return {
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    twoFactorEnabled: user.twoFactorEnabled,
                    mustChangePassword: user.mustChangePassword,
                    lastLogin: user.lastLogin
                },
                session: {
                    accessToken: session.accessToken,
                    refreshToken: session.refreshToken,
                    expiresAt: session.expiresAt,
                    sessionId: session.sessionId
                },
                warnings: passwordAge > PASSWORD_POLICY.maxAge - 7 ? 
                    [`Password will expire in ${Math.ceil(PASSWORD_POLICY.maxAge - passwordAge)} days`] : []
            };

        } catch (error) {
            return {
                success: false,
                error: 'AUTHENTICATION_ERROR',
                message: 'Authentication failed',
                details: error.message
            };
        }
    }

    /**
     * Enable two-factor authentication for user
     * @param {string} username Username
     * @param {string} token TOTP token for verification
     * @returns {Promise<Object>} Enable 2FA result
     */
    async enableTwoFactor(username, token) {
        try {
            const user = userStore.get(username);
            if (!user) {
                return {
                    success: false,
                    error: 'USER_NOT_FOUND',
                    message: 'User not found'
                };
            }

            // Verify the token
            const tokenValid = speakeasy.totp.verify({
                secret: user.twoFactorSecret,
                encoding: 'base32',
                token: token,
                window: 2
            });

            if (!tokenValid) {
                return {
                    success: false,
                    error: 'INVALID_TOKEN',
                    message: 'Invalid two-factor authentication token'
                };
            }

            // Enable 2FA
            user.twoFactorEnabled = true;
            
            // Generate backup codes
            const backupCodes = this.generateBackupCodes();
            user.backupCodes = backupCodes.map(code => bcrypt.hashSync(code, 10));

            // Audit log
            this.addAuditEntry(user, 'TWO_FACTOR_ENABLED');

            return {
                success: true,
                message: 'Two-factor authentication enabled successfully',
                backupCodes: backupCodes
            };

        } catch (error) {
            return {
                success: false,
                error: 'TWO_FACTOR_ERROR',
                message: 'Failed to enable two-factor authentication',
                details: error.message
            };
        }
    }

    /**
     * Change user password with policy validation
     * @param {string} username Username
     * @param {string} currentPassword Current password
     * @param {string} newPassword New password
     * @returns {Promise<Object>} Password change result
     */
    async changePassword(username, currentPassword, newPassword) {
        try {
            const user = userStore.get(username);
            if (!user) {
                return {
                    success: false,
                    error: 'USER_NOT_FOUND',
                    message: 'User not found'
                };
            }

            // Verify current password
            const currentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
            if (!currentPasswordValid) {
                return {
                    success: false,
                    error: 'INVALID_CURRENT_PASSWORD',
                    message: 'Current password is incorrect'
                };
            }

            // Validate new password policy
            const passwordValidation = this.validatePassword(newPassword, user);
            if (!passwordValidation.valid) {
                return {
                    success: false,
                    error: 'PASSWORD_POLICY_VIOLATION',
                    message: 'New password does not meet security requirements',
                    details: passwordValidation.errors
                };
            }

            // Check password history
            const userHistory = passwordHistory.get(username) || [];
            for (const oldPasswordHash of userHistory) {
                if (await bcrypt.compare(newPassword, oldPasswordHash)) {
                    return {
                        success: false,
                        error: 'PASSWORD_REUSE',
                        message: `Cannot reuse any of the last ${PASSWORD_POLICY.historyCount} passwords`
                    };
                }
            }

            // Hash new password
            const newPasswordHash = await bcrypt.hash(newPassword, 12);

            // Update user
            user.passwordHash = newPasswordHash;
            user.lastPasswordChange = new Date();
            user.mustChangePassword = false;

            // Update password history
            userHistory.push(newPasswordHash);
            if (userHistory.length > PASSWORD_POLICY.historyCount) {
                userHistory.shift();
            }
            passwordHistory.set(username, userHistory);

            // Invalidate all sessions except current one
            user.sessions.clear();

            // Audit log
            this.addAuditEntry(user, 'PASSWORD_CHANGED');

            return {
                success: true,
                message: 'Password changed successfully'
            };

        } catch (error) {
            return {
                success: false,
                error: 'PASSWORD_CHANGE_ERROR',
                message: 'Failed to change password',
                details: error.message
            };
        }
    }

    /**
     * Validate session token
     * @param {string} token JWT token
     * @returns {Promise<Object>} Session validation result
     */
    async validateSession(token) {
        try {
            const decoded = jwt.verify(token, this.jwtSecret);
            const session = sessionStore.get(decoded.sessionId);

            if (!session || session.expiresAt < new Date()) {
                return {
                    valid: false,
                    error: 'SESSION_EXPIRED',
                    message: 'Session has expired'
                };
            }

            const user = userStore.get(session.username);
            if (!user || !user.sessions.has(session.sessionId)) {
                return {
                    valid: false,
                    error: 'SESSION_INVALID',
                    message: 'Session is invalid'
                };
            }

            // Check if refresh is needed
            const timeUntilExpiry = session.expiresAt - new Date();
            const shouldRefresh = timeUntilExpiry < SESSION_CONFIG.refreshThreshold;

            return {
                valid: true,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    firstName: user.firstName,
                    lastName: user.lastName
                },
                session: {
                    sessionId: session.sessionId,
                    expiresAt: session.expiresAt,
                    shouldRefresh
                }
            };

        } catch (error) {
            return {
                valid: false,
                error: 'TOKEN_INVALID',
                message: 'Invalid token'
            };
        }
    }

    /**
     * Logout user and invalidate session
     * @param {string} sessionId Session ID
     * @returns {Promise<Object>} Logout result
     */
    async logout(sessionId) {
        try {
            const session = sessionStore.get(sessionId);
            if (session) {
                const user = userStore.get(session.username);
                if (user) {
                    user.sessions.delete(sessionId);
                    this.addAuditEntry(user, 'LOGOUT', { sessionId });
                }
                sessionStore.delete(sessionId);
            }

            return {
                success: true,
                message: 'Logged out successfully'
            };

        } catch (error) {
            return {
                success: false,
                error: 'LOGOUT_ERROR',
                message: 'Failed to logout',
                details: error.message
            };
        }
    }

    // ============================================================================
    // Private Helper Methods
    // ============================================================================

    /**
     * Validate password against policy
     * @param {string} password Password to validate
     * @param {Object} userInfo User information for personal info check
     * @returns {Object} Validation result
     */
    validatePassword(password, userInfo = {}) {
        const errors = [];

        // Length check
        if (password.length < PASSWORD_POLICY.minLength) {
            errors.push(`Password must be at least ${PASSWORD_POLICY.minLength} characters long`);
        }
        if (password.length > PASSWORD_POLICY.maxLength) {
            errors.push(`Password must be no more than ${PASSWORD_POLICY.maxLength} characters long`);
        }

        // Character requirements
        if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }
        if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }
        if (PASSWORD_POLICY.requireNumbers && !/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }
        if (PASSWORD_POLICY.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }

        // Common password check
        if (PASSWORD_POLICY.forbidCommonPasswords && this.isCommonPassword(password)) {
            errors.push('Password is too common, please choose a more unique password');
        }

        // Personal info check
        if (PASSWORD_POLICY.forbidPersonalInfo && this.containsPersonalInfo(password, userInfo)) {
            errors.push('Password must not contain personal information');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Check if password contains personal information
     * @param {string} password Password to check
     * @param {Object} userInfo User information
     * @returns {boolean} Whether password contains personal info
     */
    containsPersonalInfo(password, userInfo) {
        const lowerPassword = password.toLowerCase();
        const personalData = [
            userInfo.username,
            userInfo.email?.split('@')[0],
            userInfo.firstName,
            userInfo.lastName
        ].filter(Boolean).map(info => info.toLowerCase());

        return personalData.some(info => lowerPassword.includes(info));
    }

    /**
     * Check if password is commonly used
     * @param {string} password Password to check
     * @returns {boolean} Whether password is common
     */
    isCommonPassword(password) {
        const commonPasswords = [
            'password', 'password123', '123456', '123456789', 'qwerty',
            'abc123', 'password1', 'admin', 'letmein', 'welcome',
            'monkey', '1234567890', 'iloveyou', 'princess', 'rockyou'
        ];
        return commonPasswords.includes(password.toLowerCase());
    }

    /**
     * Check account lockout status
     * @param {string} username Username to check
     * @returns {Object} Lockout status
     */
    checkAccountLockout(username) {
        const user = userStore.get(username);
        if (!user || !user.lockedUntil) {
            return { locked: false };
        }

        if (user.lockedUntil > new Date()) {
            return {
                locked: true,
                lockoutUntil: user.lockedUntil
            };
        }

        // Lockout expired, clear it
        user.lockedUntil = null;
        user.loginAttempts = 0;
        return { locked: false };
    }

    /**
     * Record failed login attempt
     * @param {string} username Username
     * @param {string} ipAddress IP address
     */
    recordFailedLogin(username, ipAddress) {
        const user = userStore.get(username);
        if (user) {
            user.loginAttempts = (user.loginAttempts || 0) + 1;
            
            if (user.loginAttempts >= PASSWORD_POLICY.lockoutThreshold) {
                user.lockedUntil = new Date(Date.now() + PASSWORD_POLICY.lockoutDuration * 60 * 1000);
                this.addAuditEntry(user, 'ACCOUNT_LOCKED', { ipAddress, attempts: user.loginAttempts });
            } else {
                this.addAuditEntry(user, 'LOGIN_FAILED', { ipAddress, attempts: user.loginAttempts });
            }
        }

        // Track by IP as well
        const ipAttempts = loginAttempts.get(ipAddress) || { count: 0, firstAttempt: new Date() };
        ipAttempts.count++;
        ipAttempts.lastAttempt = new Date();
        loginAttempts.set(ipAddress, ipAttempts);
    }

    /**
     * Clear failed login attempts
     * @param {string} username Username
     */
    clearFailedLogins(username) {
        const user = userStore.get(username);
        if (user) {
            user.loginAttempts = 0;
            user.lockedUntil = null;
        }
    }

    /**
     * Create new session
     * @param {Object} user User object
     * @param {Object} sessionInfo Session information
     * @returns {Promise<Object>} Session object
     */
    async createSession(user, sessionInfo) {
        const sessionId = this.generateSessionId();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + SESSION_CONFIG.maxAge);

        const session = {
            sessionId,
            username: user.username,
            userId: user.id,
            createdAt: now,
            expiresAt,
            ipAddress: sessionInfo.ipAddress,
            userAgent: sessionInfo.userAgent,
            lastActivity: now
        };

        // Limit concurrent sessions
        if (user.sessions.size >= SESSION_CONFIG.maxConcurrentSessions) {
            const oldestSession = Array.from(user.sessions)[0];
            user.sessions.delete(oldestSession);
            sessionStore.delete(oldestSession);
        }

        sessionStore.set(sessionId, session);

        // Create JWT tokens
        const accessToken = jwt.sign(
            {
                sessionId,
                userId: user.id,
                username: user.username,
                role: user.role,
                type: 'access'
            },
            this.jwtSecret,
            {
                expiresIn: '8h',
                issuer: this.issuer,
                audience: 'webqx-api'
            }
        );

        const refreshToken = jwt.sign(
            {
                sessionId,
                userId: user.id,
                username: user.username,
                type: 'refresh'
            },
            this.jwtSecret,
            {
                expiresIn: '7d',
                issuer: this.issuer,
                audience: 'webqx-api'
            }
        );

        return {
            sessionId,
            accessToken,
            refreshToken,
            expiresAt
        };
    }

    /**
     * Generate backup codes for 2FA
     * @returns {Array<string>} Backup codes
     */
    generateBackupCodes() {
        const codes = [];
        for (let i = 0; i < 10; i++) {
            codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
        }
        return codes;
    }

    /**
     * Generate unique user ID
     * @returns {string} User ID
     */
    generateUserId() {
        return 'user_' + crypto.randomBytes(16).toString('hex');
    }

    /**
     * Generate unique session ID
     * @returns {string} Session ID
     */
    generateSessionId() {
        return 'sess_' + crypto.randomBytes(32).toString('hex');
    }

    /**
     * Find user by email
     * @param {string} email Email address
     * @returns {Object|null} User object or null
     */
    findUserByEmail(email) {
        for (const user of userStore.values()) {
            if (user.email === email) {
                return user;
            }
        }
        return null;
    }

    /**
     * Add audit entry for user
     * @param {Object} user User object
     * @param {string} action Action type
     * @param {Object} details Additional details
     */
    addAuditEntry(user, action, details = {}) {
        user.auditLog.push({
            id: crypto.randomBytes(8).toString('hex'),
            action,
            timestamp: new Date(),
            details: { ...details }
        });

        // Keep only last 100 entries per user
        if (user.auditLog.length > 100) {
            user.auditLog = user.auditLog.slice(-100);
        }
    }
}

module.exports = HIPAAAuthService;