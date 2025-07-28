const passport = require('passport');
const OAuth2Strategy = require('passport-oauth2');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const auditLogger = require('../security/auditLogger');
const encryption = require('../security/encryption');

/**
 * HIPAA-Compliant Authentication System
 * Implements OAuth2, JWT, and secure session management
 */

class AuthenticationManager {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET;
    this.jwtExpiresIn = '30m'; // 30 minutes for healthcare security
    this.refreshTokenExpiresIn = '7d'; // 7 days
    this.init();
  }

  init() {
    if (!this.jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required for HIPAA compliance');
    }

    this.setupPassportStrategies();
  }

  /**
   * Setup Passport.js strategies for authentication
   */
  setupPassportStrategies() {
    // JWT Strategy for API authentication
    passport.use(new JwtStrategy({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: this.jwtSecret,
      issuer: 'webqx-healthcare',
      audience: 'webqx-api'
    }, async (jwtPayload, done) => {
      try {
        // In production, verify user against database
        const user = await this.getUserById(jwtPayload.sub);
        if (user && user.active) {
          return done(null, user);
        }
        return done(null, false);
      } catch (error) {
        return done(error, false);
      }
    }));

    // OAuth2 Strategy for external authentication providers
    passport.use('oauth2', new OAuth2Strategy({
      authorizationURL: process.env.OAUTH2_AUTH_URL || 'https://auth.webqx.health/oauth2/authorize',
      tokenURL: process.env.OAUTH2_TOKEN_URL || 'https://auth.webqx.health/oauth2/token',
      clientID: process.env.OAUTH2_CLIENT_ID,
      clientSecret: process.env.OAUTH2_CLIENT_SECRET,
      callbackURL: process.env.OAUTH2_CALLBACK_URL || '/auth/oauth2/callback',
      scope: ['openid', 'profile', 'email', 'healthcare:read']
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        // Process OAuth2 profile and create/update user
        const user = await this.processOAuth2Profile(profile, accessToken);
        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }));

    // Serialize user for session
    passport.serializeUser((user, done) => {
      done(null, user.id);
    });

    // Deserialize user from session
    passport.deserializeUser(async (id, done) => {
      try {
        const user = await this.getUserById(id);
        done(null, user);
      } catch (error) {
        done(error, null);
      }
    });
  }

  /**
   * Generate JWT token for authenticated user
   * @param {Object} user - User object
   * @returns {Object} Token data
   */
  generateTokens(user) {
    const payload = {
      sub: user.id,
      iat: Math.floor(Date.now() / 1000),
      iss: 'webqx-healthcare',
      aud: 'webqx-api',
      role: user.role,
      permissions: user.permissions || [],
      sessionId: encryption.generateSecureToken(16)
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn
    });

    const refreshToken = jwt.sign({
      sub: user.id,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000)
    }, this.jwtSecret, {
      expiresIn: this.refreshTokenExpiresIn
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 1800, // 30 minutes in seconds
      scope: user.permissions?.join(' ') || ''
    };
  }

  /**
   * Verify and refresh JWT token
   * @param {string} refreshToken - Refresh token
   * @returns {Object} New token data
   */
  async refreshToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, this.jwtSecret);
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      const user = await this.getUserById(decoded.sub);
      if (!user || !user.active) {
        throw new Error('User not found or inactive');
      }

      return this.generateTokens(user);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Authenticate user with username/password
   * @param {string} username - Username
   * @param {string} password - Password
   * @param {Object} req - Express request object
   * @returns {Object} Authentication result
   */
  async authenticateUser(username, password, req) {
    try {
      // Find user (in production, query database)
      const user = await this.getUserByUsername(username);
      
      if (!user) {
        await this.logFailedAuthentication('USER_NOT_FOUND', username, req);
        throw new Error('Invalid credentials');
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      
      if (!isValidPassword) {
        await this.logFailedAuthentication('INVALID_PASSWORD', username, req);
        throw new Error('Invalid credentials');
      }

      // Check if user is active
      if (!user.active) {
        await this.logFailedAuthentication('USER_INACTIVE', username, req);
        throw new Error('Account is disabled');
      }

      // Check if MFA is required
      if (user.mfaEnabled && !req.body.mfaToken) {
        return {
          success: false,
          requiresMFA: true,
          message: 'Multi-factor authentication required'
        };
      }

      // Verify MFA token if provided
      if (user.mfaEnabled && req.body.mfaToken) {
        const isMFAValid = await this.verifyMFAToken(user.id, req.body.mfaToken);
        if (!isMFAValid) {
          await this.logFailedAuthentication('INVALID_MFA', username, req);
          throw new Error('Invalid MFA token');
        }
      }

      // Generate tokens
      const tokens = this.generateTokens(user);

      // Log successful authentication
      await auditLogger.logUserAction({
        userId: user.id,
        userRole: user.role,
        action: 'USER_LOGIN',
        resource: 'authentication',
        outcome: 'SUCCESS',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        requestId: req.id,
        details: {
          authMethod: user.mfaEnabled ? 'PASSWORD_MFA' : 'PASSWORD',
          loginTime: new Date().toISOString()
        }
      });

      return {
        success: true,
        user: this.sanitizeUser(user),
        tokens
      };
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Log failed authentication attempts
   * @param {string} reason - Failure reason
   * @param {string} username - Attempted username
   * @param {Object} req - Express request object
   */
  async logFailedAuthentication(reason, username, req) {
    await auditLogger.logSecurityEvent({
      event: 'FAILED_LOGIN_ATTEMPT',
      severity: 'WARNING',
      details: {
        reason,
        username,
        timestamp: new Date().toISOString()
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      outcome: 'FAILURE',
      threatLevel: 'MEDIUM'
    });
  }

  /**
   * Process OAuth2 profile and create/update user
   * @param {Object} profile - OAuth2 profile
   * @param {string} accessToken - Access token
   * @returns {Object} User object
   */
  async processOAuth2Profile(profile, accessToken) {
    // In production, this would interact with your user database
    const user = {
      id: profile.id,
      email: profile.emails?.[0]?.value,
      name: profile.displayName,
      provider: 'oauth2',
      role: 'patient', // Default role, should be determined by business logic
      permissions: ['read:own_data', 'write:own_data'],
      active: true,
      mfaEnabled: false
    };

    return user;
  }

  /**
   * Get user by ID (mock implementation)
   * @param {string} userId - User ID
   * @returns {Object} User object
   */
  async getUserById(userId) {
    // Mock implementation - replace with database query
    const mockUsers = {
      'user-123': {
        id: 'user-123',
        username: 'john.doe@webqx.health',
        email: 'john.doe@webqx.health',
        name: 'John Doe',
        role: 'provider',
        permissions: ['read:patient_data', 'write:patient_data', 'prescribe:medications'],
        active: true,
        mfaEnabled: true,
        passwordHash: bcrypt.hashSync('SecurePassword123!', 12)
      },
      'patient-456': {
        id: 'patient-456',
        username: 'jane.patient@email.com',
        email: 'jane.patient@email.com',
        name: 'Jane Patient',
        role: 'patient',
        permissions: ['read:own_data', 'write:own_data'],
        active: true,
        mfaEnabled: false,
        passwordHash: bcrypt.hashSync('PatientPass456!', 12)
      }
    };

    return mockUsers[userId] || null;
  }

  /**
   * Get user by username (mock implementation)
   * @param {string} username - Username
   * @returns {Object} User object
   */
  async getUserByUsername(username) {
    // Mock implementation - replace with database query
    const users = await Promise.all([
      this.getUserById('user-123'),
      this.getUserById('patient-456')
    ]);

    return users.find(user => user && user.username === username) || null;
  }

  /**
   * Verify MFA token
   * @param {string} userId - User ID
   * @param {string} token - MFA token
   * @returns {boolean} Verification result
   */
  async verifyMFAToken(userId, token) {
    // Mock implementation - in production, verify with TOTP/SMS service
    return token === '123456'; // Mock valid token
  }

  /**
   * Remove sensitive information from user object
   * @param {Object} user - User object
   * @returns {Object} Sanitized user object
   */
  sanitizeUser(user) {
    const { passwordHash, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  /**
   * Middleware to require authentication
   * @param {Array} requiredPermissions - Required permissions
   * @returns {Function} Express middleware
   */
  requireAuth(requiredPermissions = []) {
    return (req, res, next) => {
      passport.authenticate('jwt', { session: false }, (err, user, info) => {
        if (err) {
          return next(err);
        }

        if (!user) {
          return res.status(401).json({
            error: 'Authentication required',
            message: 'Valid JWT token required'
          });
        }

        // Check permissions
        if (requiredPermissions.length > 0) {
          const hasPermissions = requiredPermissions.every(permission =>
            user.permissions && user.permissions.includes(permission)
          );

          if (!hasPermissions) {
            return res.status(403).json({
              error: 'Insufficient permissions',
              required: requiredPermissions
            });
          }
        }

        req.user = user;
        next();
      })(req, res, next);
    };
  }
}

module.exports = new AuthenticationManager();