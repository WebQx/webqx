/**
 * @fileoverview OpenEvidence Authentication Middleware
 * 
 * Express middleware for handling OpenEvidence authentication, authorization,
 * session management, and audit logging.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express';
import { openEvidenceAuth, OpenEvidenceSession, ResearchPermission, EvidenceAccessLevel } from './index';

// ============================================================================
// Extended Request Interface
// ============================================================================

export interface OpenEvidenceRequest extends Request {
  openEvidenceSession?: OpenEvidenceSession;
  openEvidenceUser?: any;
  sessionId?: string;
}

// ============================================================================
// Middleware Functions
// ============================================================================

/**
 * Middleware to require OpenEvidence authentication
 */
export function requireOpenEvidenceAuth(req: OpenEvidenceRequest, res: Response, next: NextFunction): void {
  const sessionId = req.headers['x-openevidence-session'] as string || 
                   req.cookies?.openevidence_session ||
                   req.query.sessionId as string;

  if (!sessionId) {
    res.status(401).json({
      error: 'AUTHENTICATION_REQUIRED',
      message: 'OpenEvidence session required',
      platform: 'OpenEvidence'
    });
    return;
  }

  const session = openEvidenceAuth.getSession(sessionId);
  if (!session || !session.isActive) {
    res.status(401).json({
      error: 'INVALID_SESSION',
      message: 'Invalid or expired OpenEvidence session',
      platform: 'OpenEvidence'
    });
    return;
  }

  // Check session expiration
  if (session.expiresAt < new Date()) {
    openEvidenceAuth.terminateSession(sessionId);
    res.status(401).json({
      error: 'SESSION_EXPIRED',
      message: 'OpenEvidence session has expired',
      platform: 'OpenEvidence'
    });
    return;
  }

  // Update session activity
  openEvidenceAuth.updateSessionActivity(sessionId);

  // Set request properties
  req.openEvidenceSession = session;
  req.sessionId = sessionId;
  
  // Update session metadata
  session.ipAddress = req.ip || req.connection.remoteAddress || '';
  session.userAgent = req.get('User-Agent') || '';

  next();
}

/**
 * Middleware to require specific research permissions
 */
export function requirePermissions(permissions: ResearchPermission[]) {
  return (req: OpenEvidenceRequest, res: Response, next: NextFunction): void => {
    if (!req.openEvidenceSession) {
      res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'OpenEvidence authentication required',
        platform: 'OpenEvidence'
      });
      return;
    }

    const hasPermissions = permissions.every(permission => 
      openEvidenceAuth.hasPermission(req.sessionId!, permission)
    );

    if (!hasPermissions) {
      auditAccessDenied(req, 'INSUFFICIENT_PERMISSIONS', { requiredPermissions: permissions });
      res.status(403).json({
        error: 'INSUFFICIENT_PERMISSIONS',
        message: 'Required permissions not granted',
        requiredPermissions: permissions,
        userPermissions: req.openEvidenceSession.researchPermissions,
        platform: 'OpenEvidence'
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to require specific access level
 */
export function requireAccessLevel(level: EvidenceAccessLevel) {
  return (req: OpenEvidenceRequest, res: Response, next: NextFunction): void => {
    if (!req.openEvidenceSession) {
      res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'OpenEvidence authentication required',
        platform: 'OpenEvidence'
      });
      return;
    }

    const hasAccess = openEvidenceAuth.hasAccessLevel(req.sessionId!, level);

    if (!hasAccess) {
      auditAccessDenied(req, 'INSUFFICIENT_ACCESS_LEVEL', { requiredLevel: level });
      res.status(403).json({
        error: 'INSUFFICIENT_ACCESS_LEVEL',
        message: 'Required access level not granted',
        requiredLevel: level,
        userLevel: req.openEvidenceSession.accessLevel,
        platform: 'OpenEvidence'
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to require institutional affiliation
 */
export function requireInstitutionalAccess(req: OpenEvidenceRequest, res: Response, next: NextFunction): void {
  if (!req.openEvidenceSession) {
    res.status(401).json({
      error: 'AUTHENTICATION_REQUIRED',
      message: 'OpenEvidence authentication required',
      platform: 'OpenEvidence'
    });
    return;
  }

  if (!req.openEvidenceSession.institutionalId) {
    auditAccessDenied(req, 'NO_INSTITUTIONAL_AFFILIATION');
    res.status(403).json({
      error: 'INSTITUTIONAL_ACCESS_REQUIRED',
      message: 'Institutional affiliation required for this resource',
      platform: 'OpenEvidence'
    });
    return;
  }

  next();
}

/**
 * Middleware for MFA requirement (integrates with WebQx MFA)
 */
export function requireMFA(req: OpenEvidenceRequest, res: Response, next: NextFunction): void {
  if (!req.openEvidenceSession) {
    res.status(401).json({
      error: 'AUTHENTICATION_REQUIRED',
      message: 'OpenEvidence authentication required',
      platform: 'OpenEvidence'
    });
    return;
  }

  // Check if MFA was verified in the underlying WebQx session
  const mfaVerified = req.headers['x-mfa-verified'] === 'true' || 
                     req.openEvidenceSession.token.includes('mfa_verified');

  if (!mfaVerified) {
    auditAccessDenied(req, 'MFA_REQUIRED');
    res.status(403).json({
      error: 'MFA_REQUIRED',
      message: 'Multi-factor authentication required for this resource',
      mfaSetupUrl: '/auth/mfa/setup',
      platform: 'OpenEvidence'
    });
    return;
  }

  next();
}

/**
 * Middleware for audit logging
 */
export function auditRequest(req: OpenEvidenceRequest, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  
  // Log request
  const auditData = {
    timestamp: new Date().toISOString(),
    sessionId: req.sessionId,
    userId: req.openEvidenceSession?.userId,
    method: req.method,
    path: req.path,
    query: req.query,
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    platform: 'OpenEvidence'
  };

  console.log('[OpenEvidence Audit] Request:', auditData);

  // Override res.json to log responses
  const originalJson = res.json;
  res.json = function(body: any) {
    const responseTime = Date.now() - startTime;
    
    console.log('[OpenEvidence Audit] Response:', {
      ...auditData,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      success: res.statusCode < 400
    });

    return originalJson.call(this, body);
  };

  next();
}

/**
 * Middleware for rate limiting per session
 */
export function rateLimitBySession(maxRequests: number = 100, windowMs: number = 60000) {
  const requestCounts = new Map<string, { count: number; resetTime: number }>();

  return (req: OpenEvidenceRequest, res: Response, next: NextFunction): void => {
    if (!req.sessionId) {
      next();
      return;
    }

    const now = Date.now();
    const sessionData = requestCounts.get(req.sessionId);

    if (!sessionData || now > sessionData.resetTime) {
      requestCounts.set(req.sessionId, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    if (sessionData.count >= maxRequests) {
      auditAccessDenied(req, 'RATE_LIMIT_EXCEEDED', { 
        requests: sessionData.count, 
        limit: maxRequests,
        windowMs 
      });
      
      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this session',
        limit: maxRequests,
        windowMs,
        retryAfter: Math.ceil((sessionData.resetTime - now) / 1000),
        platform: 'OpenEvidence'
      });
      return;
    }

    sessionData.count++;
    next();
  };
}

/**
 * Middleware to validate consent agreement
 */
export function requireConsentAgreement(requiredVersion: string = '1.0') {
  return (req: OpenEvidenceRequest, res: Response, next: NextFunction): void => {
    if (!req.openEvidenceSession) {
      res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'OpenEvidence authentication required',
        platform: 'OpenEvidence'
      });
      return;
    }

    const userConsentVersion = req.openEvidenceSession.consentVersion;
    if (userConsentVersion < requiredVersion) {
      auditAccessDenied(req, 'CONSENT_OUTDATED', { 
        userVersion: userConsentVersion, 
        requiredVersion 
      });
      
      res.status(403).json({
        error: 'CONSENT_AGREEMENT_REQUIRED',
        message: 'Updated consent agreement required',
        userConsentVersion,
        requiredVersion,
        consentUrl: '/auth/openevidence/consent',
        platform: 'OpenEvidence'
      });
      return;
    }

    next();
  };
}

/**
 * Middleware for CORS specifically for OpenEvidence
 */
export function openEvidenceCORS(req: Request, res: Response, next: NextFunction): void {
  const allowedOrigins = [
    'https://openevidence.webqx.health',
    'https://evidence.webqx.health',
    'http://localhost:3000',
    'http://localhost:3001'
  ];

  const origin = req.get('Origin');
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-OpenEvidence-Session');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }

  next();
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Log access denied events for audit purposes
 */
function auditAccessDenied(req: OpenEvidenceRequest, reason: string, metadata?: any): void {
  const auditData = {
    timestamp: new Date().toISOString(),
    event: 'ACCESS_DENIED',
    reason,
    sessionId: req.sessionId,
    userId: req.openEvidenceSession?.userId,
    path: req.path,
    method: req.method,
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    metadata: metadata || {},
    platform: 'OpenEvidence'
  };

  console.warn('[OpenEvidence Security] Access denied:', auditData);
}

/**
 * Create authentication error response
 */
export function createAuthErrorResponse(error: string, message: string, statusCode: number = 401) {
  return {
    error,
    message,
    platform: 'OpenEvidence',
    timestamp: new Date().toISOString()
  };
}

/**
 * Middleware composition utility
 */
export function composeMiddleware(...middlewares: Function[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    let index = 0;

    function dispatch(i: number): void {
      if (i <= index) return;
      index = i;

      let fn = middlewares[i];
      if (i === middlewares.length) fn = next;

      if (!fn) return;

      try {
        fn(req, res, dispatch.bind(null, i + 1));
      } catch (err) {
        next(err);
      }
    }

    dispatch(0);
  };
}

// ============================================================================
// Pre-composed Middleware Stacks
// ============================================================================

/**
 * Basic OpenEvidence authentication stack
 */
export const basicAuth = composeMiddleware(
  openEvidenceCORS,
  requireOpenEvidenceAuth,
  auditRequest
);

/**
 * Research-level authentication stack
 */
export const researchAuth = composeMiddleware(
  openEvidenceCORS,
  requireOpenEvidenceAuth,
  requireAccessLevel('RESEARCH'),
  requireConsentAgreement('1.0'),
  auditRequest,
  rateLimitBySession(50, 60000)
);

/**
 * Admin-level authentication stack
 */
export const adminAuth = composeMiddleware(
  openEvidenceCORS,
  requireOpenEvidenceAuth,
  requirePermissions(['ADMIN_USERS']),
  requireMFA,
  auditRequest,
  rateLimitBySession(200, 60000)
);

/**
 * Institutional access stack
 */
export const institutionalAuth = composeMiddleware(
  openEvidenceCORS,
  requireOpenEvidenceAuth,
  requireInstitutionalAccess,
  requireAccessLevel('INSTITUTIONAL'),
  requireConsentAgreement('1.0'),
  auditRequest,
  rateLimitBySession(100, 60000)
);

export default {
  requireOpenEvidenceAuth,
  requirePermissions,
  requireAccessLevel,
  requireInstitutionalAccess,
  requireMFA,
  auditRequest,
  rateLimitBySession,
  requireConsentAgreement,
  openEvidenceCORS,
  basicAuth,
  researchAuth,
  adminAuth,
  institutionalAuth
};