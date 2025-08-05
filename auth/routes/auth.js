/**
 * HIPAA-Compliant Authentication API Routes (JavaScript version)
 * 
 * Secure authentication endpoints for WebQX patient portal
 * with conditional rate limiting, audit logging, and session management.
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { userService } = require('../services/userService.js');

const router = express.Router();

// Conditional rate limiting for authentication endpoints
let authLimiter;
let strictAuthLimiter;
try {
  const rateLimit = require('express-rate-limit');
  authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs for auth endpoints
    message: {
      error: 'TOO_MANY_REQUESTS',
    message: 'Too many authentication attempts. Please try again later.',
    retryAfter: 15 * 60 // 15 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for successful requests
  skipSuccessfulRequests: true
});

// More restrictive rate limiting for failed attempts
strictAuthLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 failed attempts per hour
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many failed authentication attempts. Account temporarily restricted.',
    retryAfter: 60 * 60 // 1 hour in seconds
  }
});
} catch (error) {
  console.warn('Rate limiting not available, using passthrough middleware');
  authLimiter = (req, res, next) => next();
  strictAuthLimiter = (req, res, next) => next();
}

/**
 * POST /auth/login
 * Authenticate user with email and password
 */
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
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: errors.array()
          }
        });
      }

      const { email, password, mfaCode } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';
      const userAgent = req.get('User-Agent') || 'Unknown';

      // Simple base64 decryption (matches frontend encryption)
      let decryptedPassword = password;
      try {
        decryptedPassword = Buffer.from(password, 'base64').toString('utf-8');
      } catch (e) {
        // If decryption fails, use original password
        decryptedPassword = password;
      }

      const credentials = { email, password: decryptedPassword, mfaCode };
      
      const result = await userService.authenticateUser(credentials, ipAddress, userAgent);

      if (result.success && result.session) {
        // Set secure session cookie
        res.cookie('sessionId', result.session.id, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        res.json({
          success: true,
          user: result.user,
          sessionId: result.session.id,
          expiresAt: result.session.expiresAt
        });
      } else {
        // Apply stricter rate limiting on failed attempts
        strictAuthLimiter(req, res, () => {
          res.status(401).json({
            success: false,
            error: result.error
          });
        });
      }

    } catch (error) {
      console.error('[Auth API] Login error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An internal error occurred during authentication'
        }
      });
    }
  }
);

/**
 * POST /auth/register
 * Register a new user account
 */
router.post('/register',
  authLimiter,
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('firstName')
      .isLength({ min: 1 })
      .trim()
      .withMessage('First name is required'),
    body('lastName')
      .isLength({ min: 1 })
      .trim()
      .withMessage('Last name is required'),
    body('role')
      .isIn(['PATIENT', 'PROVIDER', 'NURSE', 'ADMIN', 'STAFF'])
      .withMessage('Valid role is required')
  ],
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: errors.array()
          }
        });
      }

      const { email, password, firstName, lastName, role, specialty } = req.body;

      // Simple base64 decryption (matches frontend encryption)
      let decryptedPassword = password;
      try {
        decryptedPassword = Buffer.from(password, 'base64').toString('utf-8');
      } catch (e) {
        // If decryption fails, use original password
        decryptedPassword = password;
      }

      const userData = {
        email,
        password: decryptedPassword,
        firstName,
        lastName,
        role,
        specialty
      };

      const user = await userService.createUser(userData);

      res.status(201).json({
        success: true,
        user,
        message: 'User account created successfully'
      });

    } catch (error) {
      console.error('[Auth API] Registration error:', error);
      
      if (error instanceof Error && error.message.includes('already exists')) {
        res.status(409).json({
          success: false,
          error: {
            code: 'USER_EXISTS',
            message: 'An account with this email already exists'
          }
        });
      } else if (error instanceof Error && error.message.includes('Password must')) {
        res.status(400).json({
          success: false,
          error: {
            code: 'PASSWORD_POLICY_VIOLATION',
            message: error.message
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An error occurred during registration'
          }
        });
      }
    }
  }
);

/**
 * POST /auth/logout
 * Logout user and invalidate session
 */
router.post('/logout', async (req, res) => {
  try {
    const sessionId = req.cookies.sessionId || req.body.sessionId;

    if (sessionId) {
      await userService.logout(sessionId);
    }

    // Clear session cookie
    res.clearCookie('sessionId');

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('[Auth API] Logout error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during logout'
      }
    });
  }
});

/**
 * GET /auth/verify
 * Verify current session
 */
router.get('/verify', async (req, res) => {
  try {
    const sessionId = req.cookies.sessionId || req.headers['x-session-id'];

    if (!sessionId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_SESSION',
          message: 'No active session found'
        }
      });
    }

    const user = await userService.verifySession(sessionId);

    if (user) {
      res.json({
        success: true,
        user,
        authenticated: true
      });
    } else {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_SESSION',
          message: 'Session is invalid or expired'
        },
        authenticated: false
      });
    }

  } catch (error) {
    console.error('[Auth API] Session verification error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during session verification'
      }
    });
  }
});

/**
 * GET /auth/me
 * Returns user role and session metadata for Telepsychiatry API
 */
router.get('/me', async (req, res) => {
  try {
    const sessionId = req.cookies.sessionId || req.headers['x-session-id'] || req.headers.authorization?.replace('Bearer ', '');

    if (!sessionId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'No active session found'
      });
    }

    const user = await userService.verifySession(sessionId);

    if (!user) {
      return res.status(401).json({
        error: 'INVALID_SESSION',
        message: 'Session is invalid or expired'
      });
    }

    // Return user role and session metadata in Telepsychiatry API format
    res.json({
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      specialty: user.specialty || null,
      sessionId: sessionId,
      sessionMetadata: {
        createdAt: user.createdAt,
        lastActiveAt: new Date().toISOString(),
        ipAddress: req.ip || req.connection.remoteAddress || '127.0.0.1',
        userAgent: req.get('User-Agent') || 'Unknown',
        permissions: user.permissions || [],
        isActive: true,
        sessionType: 'telepsychiatry'
      }
    });

  } catch (error) {
    console.error('[Auth API] /me endpoint error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'An error occurred while retrieving user information'
    });
  }
});

module.exports = router;