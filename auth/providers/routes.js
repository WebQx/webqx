const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Rate limiting for provider authentication endpoints
const providerAuthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs for auth endpoints
    message: {
        error: 'Too many authentication attempts, please try again later.',
        code: 'TOO_MANY_REQUESTS'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Mock provider database (in production, use a real database)
const providers = new Map();
const sessions = new Map();
const lockedAccounts = new Map();

// Initialize sample providers
providers.set('dr.smith@hospital.com', {
    id: uuidv4(),
    username: 'dr.smith@hospital.com',
    email: 'dr.smith@hospital.com',
    name: 'Dr. Sarah Smith',
    password: '$2b$10$hwH7BAAY1G6v779fk0smmuFZcS..gxGdyPsuExGoxoML7gfdMwwue', // password123
    roles: ['physician', 'administrator'],
    specialty: 'Internal Medicine',
    npi: '1234567890',
    licenseNumber: 'MD123456',
    isActive: true,
    failedAttempts: 0,
    lastLogin: null,
    createdAt: new Date(),
    licenseState: 'CA',
    dea: 'AS1234567'
});

providers.set('nurse.johnson@hospital.com', {
    id: uuidv4(),
    username: 'nurse.johnson@hospital.com',
    email: 'nurse.johnson@hospital.com',
    name: 'Jennifer Johnson, RN',
    password: '$2b$10$hwH7BAAY1G6v779fk0smmuFZcS..gxGdyPsuExGoxoML7gfdMwwue', // password123
    roles: ['nurse'],
    specialty: 'Critical Care',
    licenseNumber: 'RN987654',
    isActive: true,
    failedAttempts: 0,
    lastLogin: null,
    createdAt: new Date(),
    licenseState: 'CA'
});

providers.set('pharm.davis@hospital.com', {
    id: uuidv4(),
    username: 'pharm.davis@hospital.com',
    email: 'pharm.davis@hospital.com',
    name: 'Michael Davis, PharmD',
    password: '$2b$10$hwH7BAAY1G6v779fk0smmuFZcS..gxGdyPsuExGoxoML7gfdMwwue', // password123
    roles: ['pharmacist'],
    specialty: 'Clinical Pharmacy',
    licenseNumber: 'PharmD456789',
    isActive: true,
    failedAttempts: 0,
    lastLogin: null,
    createdAt: new Date(),
    licenseState: 'CA'
});

// Helper functions
function validateProvider(username, password) {
    const provider = providers.get(username) || [...providers.values()].find(p => p.username === username);
    
    if (!provider) {
        return { success: false, error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' };
    }
    
    if (!provider.isActive) {
        return { success: false, error: 'Account is suspended', code: 'ACCOUNT_SUSPENDED' };
    }
    
    // Check if account is locked
    if (lockedAccounts.has(provider.id)) {
        const lockInfo = lockedAccounts.get(provider.id);
        if (Date.now() < lockInfo.unlockTime) {
            return { success: false, error: 'Account is temporarily locked', code: 'ACCOUNT_LOCKED' };
        } else {
            // Unlock account
            lockedAccounts.delete(provider.id);
            provider.failedAttempts = 0;
        }
    }
    
    return { success: true, provider };
}

function lockAccount(providerId, attempts = 0) {
    const lockDuration = Math.min(5 * Math.pow(2, attempts), 60) * 60 * 1000; // Exponential backoff, max 1 hour
    lockedAccounts.set(providerId, {
        unlockTime: Date.now() + lockDuration,
        attempts
    });
}

function generateToken(provider) {
    const payload = {
        userId: provider.id,
        username: provider.username,
        email: provider.email,
        roles: provider.roles,
        type: 'provider'
    };
    
    return jwt.sign(payload, process.env.JWT_SECRET || 'webqx-provider-secret', {
        expiresIn: '8h', // 8 hour session
        issuer: 'webqx-provider-portal',
        audience: 'webqx-healthcare'
    });
}

function verifyToken(token) {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'webqx-provider-secret');
        if (decoded.type !== 'provider') {
            return { success: false, error: 'Invalid token type', code: 'INVALID_TOKEN' };
        }
        return { success: true, user: decoded };
    } catch (error) {
        return { success: false, error: 'Invalid or expired token', code: 'INVALID_TOKEN' };
    }
}

// Provider login endpoint
router.post('/login',
    providerAuthLimiter,
    [
        body('username')
            .trim()
            .isLength({ min: 1 })
            .withMessage('Username or email is required'),
        body('password')
            .isLength({ min: 1 })
            .withMessage('Password is required')
    ],
    async (req, res) => {
        try {
            // Check validation errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: errors.array(),
                    code: 'VALIDATION_ERROR'
                });
            }

            const { username, password } = req.body;

            // Validate provider
            const validation = validateProvider(username);
            if (!validation.success) {
                return res.status(validation.code === 'ACCOUNT_LOCKED' ? 423 : 401).json(validation);
            }

            const provider = validation.provider;

            // Check password
            const passwordMatch = await bcrypt.compare(password, provider.password);
            
            if (!passwordMatch) {
                provider.failedAttempts = (provider.failedAttempts || 0) + 1;
                
                if (provider.failedAttempts >= 5) {
                    lockAccount(provider.id, provider.failedAttempts - 5);
                    return res.status(423).json({
                        success: false,
                        error: 'Too many failed attempts. Account is temporarily locked.',
                        code: 'ACCOUNT_LOCKED'
                    });
                }
                
                return res.status(401).json({
                    success: false,
                    error: 'Invalid credentials',
                    code: 'INVALID_CREDENTIALS'
                });
            }

            // Reset failed attempts on successful login
            provider.failedAttempts = 0;
            provider.lastLogin = new Date();

            // Generate token
            const token = generateToken(provider);

            // Create session
            const sessionId = uuidv4();
            sessions.set(sessionId, {
                providerId: provider.id,
                token,
                createdAt: new Date(),
                lastActivity: new Date(),
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            // Return success response
            res.json({
                success: true,
                message: 'Login successful',
                token,
                user: {
                    id: provider.id,
                    username: provider.username,
                    email: provider.email,
                    name: provider.name,
                    roles: provider.roles,
                    specialty: provider.specialty,
                    npi: provider.npi,
                    licenseNumber: provider.licenseNumber,
                    licenseState: provider.licenseState
                },
                session: {
                    id: sessionId,
                    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000) // 8 hours
                }
            });

        } catch (error) {
            console.error('Provider login error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
);

// Provider token verification endpoint
router.get('/verify', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Authorization token required',
                code: 'NO_TOKEN'
            });
        }

        const token = authHeader.substring(7);
        const tokenResult = verifyToken(token);

        if (!tokenResult.success) {
            return res.status(401).json(tokenResult);
        }

        // Get current provider data
        const provider = [...providers.values()].find(p => p.id === tokenResult.user.userId);
        if (!provider || !provider.isActive) {
            return res.status(404).json({
                success: false,
                error: 'Provider not found or inactive',
                code: 'PROVIDER_NOT_FOUND'
            });
        }

        res.json({
            success: true,
            user: {
                id: provider.id,
                username: provider.username,
                email: provider.email,
                name: provider.name,
                roles: provider.roles,
                specialty: provider.specialty,
                npi: provider.npi,
                licenseNumber: provider.licenseNumber,
                licenseState: provider.licenseState
            }
        });

    } catch (error) {
        console.error('Provider verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Provider profile endpoint
router.get('/profile', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Authorization token required',
                code: 'NO_TOKEN'
            });
        }

        const token = authHeader.substring(7);
        const tokenResult = verifyToken(token);

        if (!tokenResult.success) {
            return res.status(401).json(tokenResult);
        }

        const provider = [...providers.values()].find(p => p.id === tokenResult.user.userId);
        if (!provider) {
            return res.status(404).json({
                success: false,
                error: 'Provider not found',
                code: 'PROVIDER_NOT_FOUND'
            });
        }

        res.json({
            success: true,
            user: {
                id: provider.id,
                username: provider.username,
                email: provider.email,
                name: provider.name,
                roles: provider.roles,
                specialty: provider.specialty,
                npi: provider.npi,
                licenseNumber: provider.licenseNumber,
                licenseState: provider.licenseState,
                dea: provider.dea,
                lastLogin: provider.lastLogin,
                createdAt: provider.createdAt
            }
        });

    } catch (error) {
        console.error('Provider profile error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Provider forgot password endpoint
router.post('/forgot-password',
    providerAuthLimiter,
    [
        body('email')
            .isEmail()
            .normalizeEmail()
            .withMessage('Valid email is required')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: errors.array(),
                    code: 'VALIDATION_ERROR'
                });
            }

            const { email } = req.body;
            
            // Always return success for security (don't reveal if email exists)
            // In production, send actual email
            console.log(`Password reset requested for provider email: ${email}`);
            
            // Simulate email sending delay
            await new Promise(resolve => setTimeout(resolve, 1000));

            res.json({
                success: true,
                message: 'If an account with that email exists, password reset instructions have been sent.'
            });

        } catch (error) {
            console.error('Provider forgot password error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
);

// Provider logout endpoint
router.post('/logout', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const tokenResult = verifyToken(token);
            
            if (tokenResult.success) {
                // Find and remove session
                for (const [sessionId, session] of sessions.entries()) {
                    if (session.token === token) {
                        sessions.delete(sessionId);
                        break;
                    }
                }
            }
        }

        res.json({
            success: true,
            message: 'Logout successful'
        });

    } catch (error) {
        console.error('Provider logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// SSO login endpoint (placeholder for SSO integration)
router.post('/sso-login', async (req, res) => {
    try {
        const { provider, tokenData, userInfo } = req.body;
        
        // In production, validate the SSO token and user info
        // For now, return a mock response
        console.log(`SSO login attempt with ${provider}:`, { tokenData, userInfo });
        
        // Mock SSO user data
        const ssoUser = {
            id: uuidv4(),
            username: userInfo.email,
            email: userInfo.email,
            name: userInfo.name || userInfo.display_name,
            roles: ['physician'], // Default role, should be determined by organization mapping
            specialty: 'General Practice',
            isActive: true,
            ssoProvider: provider,
            externalId: userInfo.sub || userInfo.id
        };
        
        const token = generateToken(ssoUser);
        
        res.json({
            success: true,
            message: 'SSO login successful',
            token,
            user: ssoUser
        });
        
    } catch (error) {
        console.error('Provider SSO login error:', error);
        res.status(500).json({
            success: false,
            error: 'SSO authentication failed',
            code: 'SSO_ERROR'
        });
    }
});

module.exports = router;