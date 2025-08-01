/**
 * HIPAA-Compliant Authentication API Routes
 * 
 * Secure authentication endpoints for WebQX patient portal
 * with rate limiting, audit logging, and session management.
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import { userService } from '../services/userService';
import { AuthCredentials, CreateUserData } from '../types';

const router = express.Router();

// Rate limiting for authentication endpoints
const authLimiter = rateLimit({
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
const strictAuthLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 failed attempts per hour
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many failed authentication attempts. Account temporarily restricted.',
    retryAfter: 60 * 60 // 1 hour in seconds
  }
});

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

      const credentials: AuthCredentials = { email, password, mfaCode };
      
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
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/)
      .withMessage('Password must contain uppercase, lowercase, number, and special character'),
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

      const userData: CreateUserData & { password: string } = {
        email,
        password,
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

    const user = await userService.verifySession(sessionId as string);

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
 * PUT /auth/password
 * Update user password
 */
router.put('/password',
  [
    body('currentPassword')
      .isLength({ min: 1 })
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/)
      .withMessage('Password must contain uppercase, lowercase, number, and special character')
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

      const sessionId = req.cookies.sessionId || req.headers['x-session-id'];
      if (!sessionId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required'
          }
        });
      }

      const user = await userService.verifySession(sessionId as string);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_SESSION',
            message: 'Session is invalid or expired'
          }
        });
      }

      const { currentPassword, newPassword } = req.body;
      const success = await userService.updatePassword(user.id, currentPassword, newPassword);

      if (success) {
        res.json({
          success: true,
          message: 'Password updated successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PASSWORD',
            message: 'Current password is incorrect'
          }
        });
      }

    } catch (error) {
      console.error('[Auth API] Password update error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred during password update'
        }
      });
    }
  }
);

/**
 * GET /auth/audit-logs
 * Get audit logs for current user (admin only for all logs)
 */
router.get('/audit-logs', async (req, res) => {
  try {
    const sessionId = req.cookies.sessionId || req.headers['x-session-id'];
    if (!sessionId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required'
        }
      });
    }

    const user = await userService.verifySession(sessionId as string);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_SESSION',
          message: 'Session is invalid or expired'
        }
      });
    }

    // Only allow admins to see all logs, others see only their own
    const userId = user.role === 'ADMIN' ? undefined : user.id;
    const auditLogs = userService.getAuditLogs(userId);

    res.json({
      success: true,
      auditLogs,
      totalCount: auditLogs.length
    });

  } catch (error) {
    console.error('[Auth API] Audit logs error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while retrieving audit logs'
      }
    });
  }
});

export default router;