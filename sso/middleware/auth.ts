import { Request, Response, NextFunction } from 'express';
import { SSOUser, SSOSession, SSOAuthenticationError, SSOSessionError } from '../types/common';
import { JWTUtils } from '../utils/jwt';
import { AuditLogger } from '../utils/audit';

/**
 * Express middleware for SSO authentication
 */
export class AuthMiddleware {
  private jwtUtils: JWTUtils;
  private auditLogger: AuditLogger;
  private sessionStore: Map<string, SSOSession>;

  constructor(secretKey: string, options: {
    auditLogger?: AuditLogger;
    sessionStore?: Map<string, SSOSession>;
  } = {}) {
    this.jwtUtils = new JWTUtils(secretKey);
    this.auditLogger = options.auditLogger || new AuditLogger();
    this.sessionStore = options.sessionStore || new Map();
  }

  /**
   * Middleware to require authentication
   */
  requireAuth = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const token = this.extractToken(req);
      
      if (!token) {
        throw new SSOAuthenticationError('Missing authentication token');
      }

      // Verify and decode token
      const decoded = this.jwtUtils.verifyToken(token);
      
      // Check session validity
      const session = this.sessionStore.get(decoded.sessionId);
      if (!session || this.isSessionExpired(session)) {
        this.auditLogger.logSessionExpired(
          session?.provider || 'unknown',
          session?.protocol || 'oauth2' as 'oauth2' | 'saml',
          decoded.sub,
          decoded.sessionId
        );
        throw new SSOSessionError('Session expired or invalid');
      }

      // Update last activity
      session.lastActivity = new Date();
      this.sessionStore.set(decoded.sessionId, session);

      // Attach user and session to request
      req.user = this.jwtUtils.getUserFromToken(token);
      req.session = session;

      next();
    } catch (error) {
      this.handleAuthError(error, req, res);
    }
  };

  /**
   * Middleware to optionally authenticate (user may or may not be logged in)
   */
  optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const token = this.extractToken(req);
      
      if (token) {
        const decoded = this.jwtUtils.verifyToken(token);
        const session = this.sessionStore.get(decoded.sessionId);
        
        if (session && !this.isSessionExpired(session)) {
          // Update last activity
          session.lastActivity = new Date();
          this.sessionStore.set(decoded.sessionId, session);

          // Attach user and session to request
          req.user = this.jwtUtils.getUserFromToken(token);
          req.session = session;
        }
      }

      next();
    } catch {
      // Ignore errors for optional auth
      next();
    }
  };

  /**
   * Middleware to require specific roles
   */
  requireRoles = (roles: string | string[]) => {
    const requiredRoles = Array.isArray(roles) ? roles : [roles];
    
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        if (!req.user) {
          throw new SSOAuthenticationError('Authentication required');
        }

        const userRoles = req.user.roles || [];
        const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

        if (!hasRequiredRole) {
          throw new SSOAuthenticationError(`Access denied. Required roles: ${requiredRoles.join(', ')}`);
        }

        next();
      } catch (error) {
        this.handleAuthError(error, req, res);
      }
    };
  };

  /**
   * Middleware to require specific groups
   */
  requireGroups = (groups: string | string[]) => {
    const requiredGroups = Array.isArray(groups) ? groups : [groups];
    
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        if (!req.user) {
          throw new SSOAuthenticationError('Authentication required');
        }

        const userGroups = req.user.groups || [];
        const hasRequiredGroup = requiredGroups.some(group => userGroups.includes(group));

        if (!hasRequiredGroup) {
          throw new SSOAuthenticationError(`Access denied. Required groups: ${requiredGroups.join(', ')}`);
        }

        next();
      } catch (error) {
        this.handleAuthError(error, req, res);
      }
    };
  };

  /**
   * Middleware to create session after successful authentication
   */
  createSession = (user: SSOUser, provider: string, protocol: 'oauth2' | 'saml'): SSOSession => {
    const sessionId = this.generateSessionId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (60 * 60 * 1000)); // 1 hour

    const session: SSOSession = {
      sessionId,
      userId: user.id,
      provider,
      protocol,
      createdAt: now,
      expiresAt,
      lastActivity: now,
      metadata: user.metadata
    };

    this.sessionStore.set(sessionId, session);
    
    this.auditLogger.logLoginSuccess(
      provider,
      protocol,
      user.id,
      sessionId,
      { ip: '', userAgent: '' } // These would be populated from request
    );

    return session;
  };

  /**
   * Middleware to logout and destroy session
   */
  logout = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const token = this.extractToken(req);
      
      if (token) {
        const decoded = this.jwtUtils.verifyToken(token);
        const session = this.sessionStore.get(decoded.sessionId);
        
        if (session) {
          this.auditLogger.logLogout(
            session.provider,
            session.protocol,
            session.userId,
            session.sessionId,
            { ip: req.ip, userAgent: req.get('User-Agent') }
          );
          
          this.sessionStore.delete(decoded.sessionId);
        }
      }

      // Clear authentication cookie/header
      res.clearCookie('sso_token');
      req.user = undefined;
      req.session = undefined;

      next();
    } catch (error) {
      this.handleAuthError(error, req, res);
    }
  };

  /**
   * Extract token from request
   */
  private extractToken(req: Request): string | null {
    // Try Authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try cookie
    const cookieToken = req.cookies?.sso_token;
    if (cookieToken) {
      return cookieToken;
    }

    // Try query parameter (not recommended for production)
    const queryToken = req.query.token as string;
    if (queryToken) {
      return queryToken;
    }

    return null;
  }

  /**
   * Check if session is expired
   */
  private isSessionExpired(session: SSOSession): boolean {
    return new Date() >= session.expiresAt;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return 'sess_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  /**
   * Handle authentication errors
   */
  private handleAuthError(error: any, req: Request, res: Response): void {
    if (error instanceof SSOAuthenticationError || error instanceof SSOSessionError) {
      res.status(401).json({
        error: 'Authentication failed',
        message: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    }
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): void {
    const now = new Date();
    
    for (const [sessionId, session] of Array.from(this.sessionStore.entries())) {
      if (now >= session.expiresAt) {
        this.auditLogger.logSessionExpired(
          session.provider,
          session.protocol,
          session.userId,
          session.sessionId
        );
        this.sessionStore.delete(sessionId);
      }
    }
  }
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: SSOUser;
      session?: SSOSession;
    }
  }
}