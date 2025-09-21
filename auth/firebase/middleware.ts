/**
 * Firebase Authentication Middleware for WebQX™
 * 
 * Express.js middleware for Firebase authentication with healthcare-specific
 * security features and audit logging.
 */

import { Request, Response, NextFunction } from 'express';
import { User, AuthError, UserRole, MedicalSpecialty, AuthAuditEvent } from '../types';
import FirebaseAuthProvider from './index';

// Local request augmentation to avoid global collisions with SSO middleware
export interface FirebaseAuthRequest extends Request {
  firebaseUser?: User;
  firebaseAuthToken?: string;
}

export class FirebaseAuthMiddleware {
  private authProvider: FirebaseAuthProvider;
  private auditEnabled: boolean;

  constructor(authProvider: FirebaseAuthProvider, options: { enableAudit?: boolean } = {}) {
    this.authProvider = authProvider;
    this.auditEnabled = options.enableAudit !== false;
  }

  /**
   * Middleware to require authentication
   */
  requireAuth = async (req: FirebaseAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = this.extractToken(req);
      
      if (!token) {
        const error: AuthError = {
          code: 'INVALID_TOKEN',
          message: 'Authentication token is required'
        };
        
        await this.logAuthEvent(req, {
          eventType: 'PERMISSION_DENIED',
          success: false,
          details: { reason: 'Missing token', path: req.path }
        });

        res.status(401).json({ error });
        return;
      }

  const user = await this.authProvider.verifySession(token);
      
      if (!user) {
        const error: AuthError = {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired authentication token'
        };

        await this.logAuthEvent(req, {
          eventType: 'PERMISSION_DENIED',
          success: false,
          details: { reason: 'Invalid token', path: req.path }
        });

        res.status(401).json({ error });
        return;
      }

  req.firebaseUser = user;
  req.firebaseAuthToken = token;
      
      await this.logAuthEvent(req, {
        eventType: 'LOGIN_SUCCESS',
        userId: user.id,
        success: true,
        details: { path: req.path, method: req.method }
      });

      next();

    } catch (error) {
      console.error('[Firebase Middleware] Authentication error:', error);
      
      const authError: AuthError = {
        code: 'UNKNOWN_ERROR',
        message: 'Authentication failed'
      };

      res.status(500).json({ error: authError });
    }
  };

  /**
   * Middleware to require specific user role
   */
  requireRole = (requiredRole: UserRole) => {
    return async (req: FirebaseAuthRequest, res: Response, next: NextFunction): Promise<void> => {
      if (!req.firebaseUser) {
        const error: AuthError = {
          code: 'PERMISSION_DENIED',
          message: 'Authentication required'
        };
        res.status(401).json({ error });
        return;
      }

      if (req.firebaseUser.role !== requiredRole) {
        const error: AuthError = {
          code: 'PERMISSION_DENIED',
          message: `Access denied. Required role: ${requiredRole}`
        };

        await this.logAuthEvent(req, {
          eventType: 'PERMISSION_DENIED',
          userId: req.firebaseUser.id,
          success: false,
          details: { 
            userRole: req.firebaseUser.role, 
            requiredRole, 
            path: req.path 
          }
        });

        res.status(403).json({ error });
        return;
      }

      next();
    };
  };

  /**
   * Middleware to require specific medical specialty access
   */
  requireSpecialty = (requiredSpecialty: MedicalSpecialty) => {
    return async (req: FirebaseAuthRequest, res: Response, next: NextFunction): Promise<void> => {
      if (!req.firebaseUser) {
        const error: AuthError = {
          code: 'PERMISSION_DENIED',
          message: 'Authentication required'
        };
        res.status(401).json({ error });
        return;
      }

      if (req.firebaseUser.specialty !== requiredSpecialty) {
        const error: AuthError = {
          code: 'SPECIALTY_ACCESS_DENIED',
          message: `Access denied. Required specialty: ${requiredSpecialty}`
        };

        await this.logAuthEvent(req, {
          eventType: 'PERMISSION_DENIED',
          userId: req.firebaseUser.id,
          success: false,
          details: { 
            userSpecialty: req.firebaseUser.specialty, 
            requiredSpecialty, 
            path: req.path 
          }
        });

        res.status(403).json({ error });
        return;
      }

      next();
    };
  };

  /**
   * Middleware to require verified provider status
   */
  requireVerifiedProvider = async (req: FirebaseAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.firebaseUser) {
      const error: AuthError = {
        code: 'PERMISSION_DENIED',
        message: 'Authentication required'
      };
      res.status(401).json({ error });
      return;
    }

    // Check if user is a provider
    const providerRoles: UserRole[] = ['PROVIDER', 'RESIDENT', 'FELLOW', 'ATTENDING'];
    if (!providerRoles.includes(req.firebaseUser.role)) {
      const error: AuthError = {
        code: 'PERMISSION_DENIED',
        message: 'Provider role required'
      };

      await this.logAuthEvent(req, {
        eventType: 'PERMISSION_DENIED',
        userId: req.firebaseUser.id,
        success: false,
        details: { 
          reason: 'Not a provider', 
          userRole: req.firebaseUser.role, 
          path: req.path 
        }
      });

      res.status(403).json({ error });
      return;
    }

    // Check if provider is verified
    if (!req.firebaseUser.isVerified) {
      const error: AuthError = {
        code: 'PROVIDER_NOT_VERIFIED',
        message: 'Provider verification required'
      };

      await this.logAuthEvent(req, {
        eventType: 'PERMISSION_DENIED',
        userId: req.firebaseUser.id,
        success: false,
        details: { 
          reason: 'Provider not verified', 
          path: req.path 
        }
      });

      res.status(403).json({ error });
      return;
    }

    next();
  };

  /**
   * Middleware for audit logging of requests
   */
  auditRequest = async (req: FirebaseAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!this.auditEnabled) {
      next();
      return;
    }

    // Log the request
    await this.logAuthEvent(req, {
      eventType: 'LOGIN_SUCCESS', // Using as general access event
      userId: req.firebaseUser?.id,
      success: true,
      details: {
        method: req.method,
        path: req.path,
        query: req.query,
        headers: this.sanitizeHeaders(req.headers),
        timestamp: new Date().toISOString()
      }
    });

    next();
  };

  /**
   * Extract authentication token from request
   */
  private extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Also check for token in cookies
    const cookieToken = req.cookies?.auth_token;
    if (cookieToken) {
      return cookieToken;
    }

    return null;
  }

  /**
   * Log authentication event for audit purposes
   */
  private async logAuthEvent(req: FirebaseAuthRequest, event: Partial<AuthAuditEvent>): Promise<void> {
    if (!this.auditEnabled) {
      return;
    }

    const auditEvent: AuthAuditEvent = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      eventType: event.eventType!,
      userId: event.userId || req.firebaseUser?.id,
      // Use any to avoid coupling to SSO Request augmentation
      sessionId: (req as any).session?.id,
      ipAddress: this.getClientIP(req),
      userAgent: req.headers['user-agent'] || 'Unknown',
      success: event.success || false,
      details: {
        ...event.details,
        method: req.method,
        path: req.path,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date()
    };

    // In real implementation, store in audit database
    console.log('[Firebase Middleware] Audit Event:', JSON.stringify(auditEvent, null, 2));
  }

  /**
   * Get client IP address from request
   */
  private getClientIP(req: Request): string {
    return (req.headers['x-forwarded-for'] as string) || 
           req.socket.remoteAddress || 
           '127.0.0.1';
  }

  /**
   * Sanitize headers for logging (remove sensitive information)
   */
  private sanitizeHeaders(headers: any): any {
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
    const sanitized = { ...headers };
    
    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });

    return sanitized;
  }
}

/**
 * Create Firebase middleware instance
 */
export function createFirebaseMiddleware(
  authProvider: FirebaseAuthProvider, 
  options: { enableAudit?: boolean } = {}
): FirebaseAuthMiddleware {
  return new FirebaseAuthMiddleware(authProvider, options);
}

export default FirebaseAuthMiddleware;