/**
 * Auth Proxy Middleware for OpenEMR Integration
 * 
 * Provides authentication proxy middleware that handles token validation,
 * role-based access control, and secure request forwarding for OpenEMR.
 * 
 * Features:
 * - Token validation and refresh
 * - Role-based access control (RBAC)
 * - Request context injection
 * - Session management
 * - Audit logging
 * - Security headers
 */

import { Request, Response, NextFunction } from 'express';
import type { 
  User, 
  AuthSession, 
  Permission,
  UserRole,
  AccessControlRequest,
  AccessControlResult,
  AuthAuditEvent 
} from '../../../auth/types';

import type { 
  OpenEMRTokens, 
  OpenEMROperationResult,
  OpenEMRAuditEvent 
} from '../types';

import { OAuth2Connector } from '../connectors/oauth2-connector';

export interface AuthProxyConfig {
  // Token Configuration
  token: {
    validateOnEachRequest: boolean;
    refreshThresholdSeconds: number;
    cacheTokens: boolean;
    cacheTtlSeconds: number;
  };
  
  // Session Configuration
  session: {
    enableSessionManagement: boolean;
    sessionTimeoutSeconds: number;
    enableConcurrentSessions: boolean;
    maxConcurrentSessions: number;
  };
  
  // Access Control Configuration
  accessControl: {
    enableRBAC: boolean;
    enableResourceLevelAccess: boolean;
    enablePatientContext: boolean;
    enableProviderContext: boolean;
  };
  
  // Security Configuration
  security: {
    enableSecurityHeaders: boolean;
    enableCSRFProtection: boolean;
    enableRequestValidation: boolean;
    maxRequestSize: number;
  };
  
  // Audit Configuration
  audit: {
    enabled: boolean;
    logAllRequests: boolean;
    logFailedAuth: boolean;
    logPermissionDenied: boolean;
  };
}

export interface AuthProxyRequest extends Request {
  user?: User;
  session?: AuthSession;
  openemrTokens?: OpenEMRTokens;
  requestId?: string;
  patientContext?: string;
  providerContext?: string;
  accessControl?: AccessControlResult;
}

export interface SessionStore {
  get(sessionId: string): Promise<AuthSession | null>;
  set(sessionId: string, session: AuthSession): Promise<void>;
  delete(sessionId: string): Promise<void>;
  cleanup(): Promise<void>;
}

export interface AccessControlProvider {
  checkAccess(request: AccessControlRequest): Promise<AccessControlResult>;
  getUserPermissions(userId: string): Promise<Permission[]>;
  checkResourceAccess(userId: string, resourceType: string, resourceId: string): Promise<boolean>;
}

/**
 * In-memory session store implementation
 */
class InMemorySessionStore implements SessionStore {
  private sessions: Map<string, AuthSession> = new Map();

  async get(sessionId: string): Promise<AuthSession | null> {
    const session = this.sessions.get(sessionId);
    if (session && session.expiresAt > new Date()) {
      return session;
    }
    if (session) {
      this.sessions.delete(sessionId);
    }
    return null;
  }

  async set(sessionId: string, session: AuthSession): Promise<void> {
    this.sessions.set(sessionId, session);
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async cleanup(): Promise<void> {
    const now = new Date();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt <= now) {
        this.sessions.delete(sessionId);
      }
    }
  }
}

/**
 * Default access control provider implementation
 */
class DefaultAccessControlProvider implements AccessControlProvider {
  async checkAccess(request: AccessControlRequest): Promise<AccessControlResult> {
    // Simplified implementation - in production, this would integrate with a proper RBAC system
    return {
      granted: true,
      reason: 'Default access granted'
    };
  }

  async getUserPermissions(userId: string): Promise<Permission[]> {
    // Return default permissions - in production, this would query the permission system
    return ['read:patient_records'];
  }

  async checkResourceAccess(userId: string, resourceType: string, resourceId: string): Promise<boolean> {
    // Simplified check - in production, this would check resource-level permissions
    return true;
  }
}

/**
 * Auth Proxy Middleware for OpenEMR Integration
 */
export class AuthProxyMiddleware {
  private config: AuthProxyConfig;
  private oauth2Connector: OAuth2Connector;
  private sessionStore: SessionStore;
  private accessControlProvider: AccessControlProvider;
  private tokenCache: Map<string, { tokens: OpenEMRTokens; expiresAt: number }>;
  private auditEvents: AuthAuditEvent[] = [];

  constructor(
    config: AuthProxyConfig,
    oauth2Connector: OAuth2Connector,
    sessionStore?: SessionStore,
    accessControlProvider?: AccessControlProvider
  ) {
    this.config = config;
    this.oauth2Connector = oauth2Connector;
    this.sessionStore = sessionStore || new InMemorySessionStore();
    this.accessControlProvider = accessControlProvider || new DefaultAccessControlProvider();
    this.tokenCache = new Map();
    
    // Start cleanup task for sessions
    if (this.config.session.enableSessionManagement) {
      setInterval(() => this.sessionStore.cleanup(), 60000); // Cleanup every minute
    }
  }

  /**
   * Main authentication middleware
   */
  authenticate() {
    return async (req: AuthProxyRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Add request ID
        req.requestId = this.generateRequestId();
        
        // Add security headers
        if (this.config.security.enableSecurityHeaders) {
          this.addSecurityHeaders(res);
        }
        
        // Extract and validate token
        const authResult = await this.extractAndValidateToken(req);
        if (!authResult.success) {
          this.auditAuthFailure(req, authResult.error!);
          res.status(401).json({ error: authResult.error!.message });
          return;
        }
        
        req.user = authResult.user!;
        req.session = authResult.session!;
        
        // Get or exchange for OpenEMR tokens
        const tokenResult = await this.getOpenEMRTokens(req);
        if (!tokenResult.success) {
          this.auditAuthFailure(req, tokenResult.error!);
          res.status(500).json({ error: 'Failed to obtain OpenEMR access' });
          return;
        }
        
        req.openemrTokens = tokenResult.data!;
        
        // Extract context information
        this.extractContextInformation(req);
        
        this.auditAuthSuccess(req);
        next();
      } catch (error) {
        this.log('Authentication error:', error);
        res.status(500).json({ error: 'Authentication failed' });
      }
    };
  }

  /**
   * Role-based authorization middleware
   */
  authorize(requiredRoles: UserRole[] = [], requiredPermissions: Permission[] = []) {
    return async (req: AuthProxyRequest, res: Response, next: NextFunction): Promise<void> => {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      try {
        // Check role-based access
        if (requiredRoles.length > 0 && !requiredRoles.includes(req.user.role)) {
          this.auditPermissionDenied(req, 'role', { requiredRoles, userRole: req.user.role });
          res.status(403).json({ 
            error: 'Insufficient role privileges',
            required: requiredRoles,
            actual: req.user.role
          });
          return;
        }

        // Check permission-based access
        if (requiredPermissions.length > 0 && this.config.accessControl.enableRBAC) {
          const userPermissions = await this.accessControlProvider.getUserPermissions(req.user.id);
          const hasPermissions = requiredPermissions.every(perm => userPermissions.includes(perm));
          
          if (!hasPermissions) {
            this.auditPermissionDenied(req, 'permission', { requiredPermissions, userPermissions });
            res.status(403).json({ 
              error: 'Insufficient permissions',
              required: requiredPermissions,
              actual: userPermissions
            });
            return;
          }
        }

        // Check resource-level access if enabled
        if (this.config.accessControl.enableResourceLevelAccess) {
          const accessControlRequest: AccessControlRequest = {
            userId: req.user.id,
            resource: this.extractResourceFromRequest(req),
            action: this.mapMethodToAction(req.method),
            context: {
              patientId: req.patientContext,
              specialty: req.user.specialty
            }
          };

          const accessResult = await this.accessControlProvider.checkAccess(accessControlRequest);
          req.accessControl = accessResult;
          
          if (!accessResult.granted) {
            this.auditPermissionDenied(req, 'resource', { reason: accessResult.reason });
            res.status(403).json({ 
              error: 'Access denied to resource',
              reason: accessResult.reason
            });
            return;
          }
        }

        next();
      } catch (error) {
        this.log('Authorization error:', error);
        res.status(500).json({ error: 'Authorization failed' });
      }
    };
  }

  /**
   * Patient context middleware - ensures access is scoped to specific patient
   */
  requirePatientContext() {
    return (req: AuthProxyRequest, res: Response, next: NextFunction): void => {
      if (!this.config.accessControl.enablePatientContext) {
        next();
        return;
      }

      const patientId = req.params.patientId || req.params.id || req.query.patient;
      if (!patientId) {
        res.status(400).json({ error: 'Patient context required' });
        return;
      }

      req.patientContext = patientId as string;
      next();
    };
  }

  /**
   * Provider context middleware - ensures access is scoped to specific provider
   */
  requireProviderContext() {
    return (req: AuthProxyRequest, res: Response, next: NextFunction): void => {
      if (!this.config.accessControl.enableProviderContext) {
        next();
        return;
      }

      const providerId = req.params.providerId || req.query.provider || req.user?.id;
      if (!providerId) {
        res.status(400).json({ error: 'Provider context required' });
        return;
      }

      req.providerContext = providerId as string;
      next();
    };
  }

  /**
   * Request validation middleware
   */
  validateRequest() {
    return (req: AuthProxyRequest, res: Response, next: NextFunction): void => {
      if (!this.config.security.enableRequestValidation) {
        next();
        return;
      }

      // Check request size
      const contentLength = parseInt(req.headers['content-length'] || '0');
      if (contentLength > this.config.security.maxRequestSize) {
        res.status(413).json({ error: 'Request too large' });
        return;
      }

      // Add custom validation logic here
      next();
    };
  }

  /**
   * Session management middleware
   */
  manageSession() {
    return async (req: AuthProxyRequest, res: Response, next: NextFunction): Promise<void> => {
      if (!this.config.session.enableSessionManagement || !req.session) {
        next();
        return;
      }

      try {
        // Check if session exists in store
        const storedSession = await this.sessionStore.get(req.session.id);
        if (!storedSession) {
          res.status(401).json({ error: 'Session not found' });
          return;
        }

        // Update session activity
        storedSession.updatedAt = new Date();
        await this.sessionStore.set(req.session.id, storedSession);

        next();
      } catch (error) {
        this.log('Session management error:', error);
        next();
      }
    };
  }

  // Private helper methods

  private async extractAndValidateToken(req: AuthProxyRequest): Promise<{ success: boolean; user?: User; session?: AuthSession; error?: any }> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { 
        success: false, 
        error: { code: 'MISSING_TOKEN', message: 'Missing or invalid authorization header' }
      };
    }

    const token = authHeader.substring(7);

    // Validate token with central IDP
    const validation = await this.oauth2Connector.validateCentralToken(token);
    if (!validation.valid) {
      return { 
        success: false, 
        error: { code: 'INVALID_TOKEN', message: validation.error || 'Invalid token' }
      };
    }

    // Map token claims to user
    const user = this.mapClaimsToUser(validation.claims!);
    
    // Create or retrieve session
    const session = await this.getOrCreateSession(user, token, req);

    return { success: true, user, session };
  }

  private async getOpenEMRTokens(req: AuthProxyRequest): Promise<OpenEMROperationResult<OpenEMRTokens>> {
    const cacheKey = req.user!.id;
    
    // Check cache first
    if (this.config.token.cacheTokens) {
      const cached = this.tokenCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return { success: true, data: cached.tokens };
      }
    }

    // Exchange tokens
    const exchangeResult = await this.oauth2Connector.exchangeForOpenEMRTokens({
      centralIdpToken: req.session!.token,
      userContext: req.user!
    });

    if (exchangeResult.success && this.config.token.cacheTokens) {
      // Cache the tokens
      this.tokenCache.set(cacheKey, {
        tokens: exchangeResult.openemrTokens!,
        expiresAt: Date.now() + (this.config.token.cacheTtlSeconds * 1000)
      });
    }

    return {
      success: exchangeResult.success,
      data: exchangeResult.openemrTokens,
      error: exchangeResult.error
    };
  }

  private async getOrCreateSession(user: User, token: string, req: AuthProxyRequest): Promise<AuthSession> {
    const sessionId = this.generateSessionId();
    
    const session: AuthSession = {
      id: sessionId,
      userId: user.id,
      token: token,
      refreshToken: '', // Would be set from OAuth2 response
      expiresAt: new Date(Date.now() + (this.config.session.sessionTimeoutSeconds * 1000)),
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      isActive: true,
      createdAt: new Date()
    };

    if (this.config.session.enableSessionManagement) {
      await this.sessionStore.set(sessionId, session);
    }

    return session;
  }

  private extractContextInformation(req: AuthProxyRequest): void {
    // Extract patient context
    if (this.config.accessControl.enablePatientContext) {
      req.patientContext = req.params.patientId || req.params.id || req.query.patient as string;
    }

    // Extract provider context
    if (this.config.accessControl.enableProviderContext) {
      req.providerContext = req.params.providerId || req.query.provider as string || req.user?.id;
    }
  }

  private addSecurityHeaders(res: Response): void {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  }

  private extractResourceFromRequest(req: AuthProxyRequest): string {
    const pathParts = req.path.split('/');
    return pathParts[1] || 'unknown'; // First path segment as resource type
  }

  private mapMethodToAction(method: string): string {
    const methodMap: Record<string, string> = {
      'GET': 'read',
      'POST': 'create',
      'PUT': 'update',
      'PATCH': 'update',
      'DELETE': 'delete'
    };
    return methodMap[method] || 'unknown';
  }

  private mapClaimsToUser(claims: any): User {
    return {
      id: claims.sub,
      email: claims.email,
      firstName: claims.given_name || '',
      lastName: claims.family_name || '',
      role: this.mapRole(claims.role),
      specialty: claims.specialty,
      isVerified: claims.email_verified === true,
      mfaEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private mapRole(role: string): UserRole {
    const roleMapping: Record<string, UserRole> = {
      'patient': 'PATIENT',
      'provider': 'PROVIDER',
      'nurse': 'NURSE',
      'admin': 'ADMIN',
      'staff': 'STAFF',
      'resident': 'RESIDENT',
      'fellow': 'FELLOW',
      'attending': 'ATTENDING'
    };
    
    return roleMapping[role?.toLowerCase()] || 'PATIENT';
  }

  private generateRequestId(): string {
    return 'req_' + Math.random().toString(36).substring(2, 15);
  }

  private generateSessionId(): string {
    return 'sess_' + Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  private auditAuthSuccess(req: AuthProxyRequest): void {
    if (this.config.audit.enabled && this.config.audit.logAllRequests) {
      this.auditLog({
        id: this.generateRequestId(),
        eventType: 'LOGIN_SUCCESS',
        userId: req.user?.id,
        sessionId: req.session?.id,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        success: true,
        details: { requestId: req.requestId },
        timestamp: new Date()
      });
    }
  }

  private auditAuthFailure(req: AuthProxyRequest, error: any): void {
    if (this.config.audit.enabled && this.config.audit.logFailedAuth) {
      this.auditLog({
        id: this.generateRequestId(),
        eventType: 'LOGIN_FAILURE',
        userId: req.user?.id,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        success: false,
        details: { error: error.message, requestId: req.requestId },
        timestamp: new Date()
      });
    }
  }

  private auditPermissionDenied(req: AuthProxyRequest, type: string, details: any): void {
    if (this.config.audit.enabled && this.config.audit.logPermissionDenied) {
      this.auditLog({
        id: this.generateRequestId(),
        eventType: 'PERMISSION_DENIED',
        userId: req.user?.id,
        sessionId: req.session?.id,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        success: false,
        details: { type, ...details, requestId: req.requestId },
        timestamp: new Date()
      });
    }
  }

  private auditLog(event: AuthAuditEvent): void {
    this.auditEvents.push(event);
    this.log(`[AUDIT] ${event.eventType}: ${event.success ? 'SUCCESS' : 'FAILURE'}`);
  }

  private log(message: string, ...args: any[]): void {
    console.log(`[Auth Proxy] ${message}`, ...args);
  }
}