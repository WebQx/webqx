const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { authenticateUser, registerUser, getUserById, verifyToken } = require('./userService');

const router = express.Router();

// Rate limiting for authentication endpoints (disabled in test environment)
const authLimiter = process.env.NODE_ENV === 'test' 
    ? (req, res, next) => next() // Skip rate limiting in tests
    : rateLimit({
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
            .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
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

            const { name, email, password } = req.body;

            // Register user
            const result = await registerUser({ name, email, password });

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

module.exports = router;