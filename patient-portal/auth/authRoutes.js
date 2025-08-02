const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { authenticateUser, registerUser, getUserById, verifyToken, updateUserMFA, getUserByEmail } = require('./userService');
const { generateAndSendOTP, verifyOTP, getOTPStatus } = require('./mfaService');
const { 
    createPatientAuthUrl, 
    exchangeCodeForTokens, 
    getUserInfo, 
    determinePatientRole,
    validateConditionalAccess,
    createLogoutUrl 
} = require('./azureEntraConfig');
const { sendSecurityAlert } = require('../services/smsService');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Rate limiting for authentication endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs for auth endpoints
    message: {
        error: 'Too many authentication attempts, please try again later.',
        code: 'TOO_MANY_REQUESTS'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Login endpoint
router.post('/login', 
    authLimiter,
    [
        body('email')
            .isEmail()
            .normalizeEmail()
            .withMessage('Valid email is required'),
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

            const { email, password } = req.body;

            // Authenticate user
            const result = await authenticateUser(email, password);

            if (!result.success) {
                const statusCode = result.code === 'ACCOUNT_LOCKED' ? 423 : 401;
                return res.status(statusCode).json({
                    success: false,
                    error: result.error,
                    code: result.code
                });
            }

            res.json({
                success: true,
                message: 'Login successful',
                user: result.user,
                token: result.token
            });

        } catch (error) {
            console.error('Login endpoint error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
);

// Register endpoint
router.post('/register',
    authLimiter,
    [
        body('name')
            .trim()
            .isLength({ min: 2 })
            .withMessage('Name must be at least 2 characters long'),
        body('email')
            .isEmail()
            .normalizeEmail()
            .withMessage('Valid email is required'),
        body('password')
            .isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters long')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
            .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
        body('phoneNumber')
            .optional()
            .matches(/^\+[1-9]\d{1,14}$/)
            .withMessage('Phone number must be in E.164 format (e.g., +1234567890)')
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

            const { name, email, password, phoneNumber } = req.body;

            // Register user
            const result = await registerUser({ name, email, password, phoneNumber });

            if (!result.success) {
                const statusCode = result.code === 'USER_EXISTS' ? 409 : 400;
                return res.status(statusCode).json({
                    success: false,
                    error: result.error,
                    code: result.code
                });
            }

            res.status(201).json({
                success: true,
                message: 'Registration successful',
                user: result.user
            });

        } catch (error) {
            console.error('Register endpoint error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
);

// Get current user profile
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
            return res.status(401).json({
                success: false,
                error: tokenResult.error,
                code: tokenResult.code
            });
        }

        const user = getUserById(tokenResult.user.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }

        res.json({
            success: true,
            user: user
        });

    } catch (error) {
        console.error('Profile endpoint error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Logout endpoint (for completeness, though JWT is stateless)
router.post('/logout', (req, res) => {
    res.json({
        success: true,
        message: 'Logout successful. Please remove the token from client storage.'
    });
});

// Azure Entra ID OAuth2 login initiation
router.get('/azure/login', (req, res) => {
    try {
        const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/azure/callback`;
        const state = uuidv4(); // Generate state for CSRF protection
        
        // Store state in session for verification
        req.session = req.session || {};
        req.session.azureState = state;
        
        const authUrl = createPatientAuthUrl(redirectUri, state);
        
        res.json({
            success: true,
            authUrl: authUrl,
            message: 'Redirect to this URL for Azure authentication'
        });
    } catch (error) {
        console.error('Azure login initiation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to initiate Azure login',
            code: 'AZURE_LOGIN_INIT_FAILED'
        });
    }
});

// Azure Entra ID OAuth2 callback
router.get('/azure/callback', async (req, res) => {
    try {
        const { code, state, error } = req.query;
        
        if (error) {
            return res.status(400).json({
                success: false,
                error: `Azure authentication error: ${error}`,
                code: 'AZURE_AUTH_ERROR'
            });
        }
        
        if (!code || !state) {
            return res.status(400).json({
                success: false,
                error: 'Missing authorization code or state parameter',
                code: 'MISSING_PARAMETERS'
            });
        }
        
        // Verify state parameter (CSRF protection)
        if (!req.session?.azureState || req.session.azureState !== state) {
            return res.status(400).json({
                success: false,
                error: 'Invalid state parameter',
                code: 'INVALID_STATE'
            });
        }
        
        // Exchange code for tokens
        const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/azure/callback`;
        const tokenResponse = await exchangeCodeForTokens(code, redirectUri);
        
        // Get user information from Microsoft Graph
        const azureUserInfo = await getUserInfo(tokenResponse.access_token);
        
        // Determine patient role based on Azure AD groups
        const patientRole = determinePatientRole(azureUserInfo.groups);
        
        // Validate conditional access compliance
        const complianceStatus = validateConditionalAccess(azureUserInfo, {
            mfaCompleted: true, // Assume MFA completed if using Azure
            deviceCompliant: true, // Would need device info from Azure
            isLegacyAuth: false
        });
        
        if (!complianceStatus.compliant) {
            return res.status(403).json({
                success: false,
                error: 'Conditional access requirements not met',
                violations: complianceStatus.violations,
                code: 'CONDITIONAL_ACCESS_VIOLATION'
            });
        }
        
        // Create or update user in local system
        let localUser = getUserByEmail(azureUserInfo.email);
        
        if (!localUser) {
            // Create new user from Azure information
            const registerResult = await registerUser({
                name: azureUserInfo.name,
                email: azureUserInfo.email,
                password: 'azure_sso_user', // Placeholder, won't be used
                phoneNumber: azureUserInfo.mobilePhone
            });
            
            if (!registerResult.success) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to create user account',
                    code: 'USER_CREATION_FAILED'
                });
            }
            
            localUser = registerResult.user;
        }
        
        // Generate JWT token for local sessions
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            { 
                userId: localUser.id,
                email: localUser.email,
                name: localUser.name,
                azureId: azureUserInfo.id,
                role: patientRole,
                authMethod: 'azure_sso'
            },
            process.env.JWT_SECRET || 'your-secret-key-change-in-production',
            { expiresIn: '24h' }
        );
        
        // Clean up session
        delete req.session.azureState;
        
        res.json({
            success: true,
            message: 'Azure authentication successful',
            user: {
                ...localUser,
                azureId: azureUserInfo.id,
                role: patientRole,
                authMethod: 'azure_sso'
            },
            token: token,
            azureTokens: {
                access_token: tokenResponse.access_token,
                refresh_token: tokenResponse.refresh_token,
                expires_in: tokenResponse.expires_in
            }
        });
        
    } catch (error) {
        console.error('Azure callback error:', error);
        res.status(500).json({
            success: false,
            error: 'Azure authentication failed',
            code: 'AZURE_AUTH_FAILED'
        });
    }
});

// Azure logout
router.post('/azure/logout', (req, res) => {
    try {
        const postLogoutRedirectUri = `${req.protocol}://${req.get('host')}/login`;
        const logoutUrl = createLogoutUrl(postLogoutRedirectUri);
        
        res.json({
            success: true,
            logoutUrl: logoutUrl,
            message: 'Redirect to this URL to complete Azure logout'
        });
    } catch (error) {
        console.error('Azure logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to initiate Azure logout',
            code: 'AZURE_LOGOUT_FAILED'
        });
    }
});

// MFA endpoints

// Generate and send OTP
router.post('/mfa/generate-otp',
    authLimiter,
    [
        body('identifier')
            .notEmpty()
            .withMessage('User identifier (email or user ID) is required')
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

            const { identifier } = req.body;
            const result = await generateAndSendOTP(identifier);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json({
                success: true,
                message: result.message,
                expiresAt: result.expiresAt,
                phoneNumber: result.phoneNumber
            });

        } catch (error) {
            console.error('OTP generation endpoint error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
);

// Verify OTP
router.post('/mfa/verify-otp',
    authLimiter,
    [
        body('userId')
            .notEmpty()
            .withMessage('User ID is required'),
        body('otp')
            .isLength({ min: 6, max: 6 })
            .isNumeric()
            .withMessage('OTP must be a 6-digit number')
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

            const { userId, otp } = req.body;
            const result = verifyOTP(userId, otp);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json({
                success: true,
                message: result.message
            });

        } catch (error) {
            console.error('OTP verification endpoint error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
);

// Enable/disable MFA for user
router.post('/mfa/toggle',
    [
        body('enabled')
            .isBoolean()
            .withMessage('Enabled must be a boolean value')
    ],
    async (req, res) => {
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
                return res.status(401).json({
                    success: false,
                    error: tokenResult.error,
                    code: tokenResult.code
                });
            }

            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: errors.array(),
                    code: 'VALIDATION_ERROR'
                });
            }

            const { enabled } = req.body;
            const result = updateUserMFA(tokenResult.user.userId, enabled);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json({
                success: true,
                message: `MFA ${enabled ? 'enabled' : 'disabled'} successfully`,
                user: result.user
            });

        } catch (error) {
            console.error('MFA toggle endpoint error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
);

// Get OTP status (for debugging/testing)
router.get('/mfa/status/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const status = getOTPStatus(userId);
        
        res.json({
            success: true,
            status: status
        });
    } catch (error) {
        console.error('OTP status endpoint error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

module.exports = router;