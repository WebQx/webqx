/**
 * @fileoverview OpenEvidence Authentication Routes
 * 
 * Express routes for handling OpenEvidence authentication endpoints including
 * login, logout, session management, and consent handling.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import express, { Request, Response } from 'express';
import { openEvidenceAuth, OpenEvidenceAuthUtils } from './index';
import { 
  requireOpenEvidenceAuth, 
  requirePermissions,
  auditRequest,
  openEvidenceCORS,
  OpenEvidenceRequest 
} from './middleware';
import { webqxLogin } from '../webqx-login-manager';

const router = express.Router();

// Apply CORS to all routes
router.use(openEvidenceCORS);

// ============================================================================
// Authentication Routes
// ============================================================================

/**
 * POST /auth/openevidence/login
 * Initiate OpenEvidence login via WebQx SSO
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { redirectUrl } = req.body;

    // Check if user is already authenticated with WebQx
    if (webqxLogin.isAuthenticated()) {
      // User is already authenticated, redirect or return success
      res.json({
        success: true,
        message: 'Already authenticated with WebQx',
        requiresRedirect: false,
        platform: 'OpenEvidence'
      });
      return;
    }

    // Initiate WebQx authentication
    await webqxLogin.loginWithKeycloak(redirectUrl || '/openevidence/dashboard');
    
    res.json({
      success: true,
      message: 'Authentication initiated',
      requiresRedirect: true,
      platform: 'OpenEvidence'
    });

  } catch (error) {
    console.error('[OpenEvidence Auth] Login error:', error);
    res.status(500).json({
      success: false,
      error: 'LOGIN_FAILED',
      message: 'Failed to initiate authentication',
      platform: 'OpenEvidence'
    });
  }
});

/**
 * GET /auth/openevidence/callback
 * Handle authentication callback from WebQx/Keycloak
 */
router.get('/callback', async (req: Request, res: Response) => {
  try {
    // Handle Keycloak callback
    const success = await webqxLogin.handleKeycloakCallback();
    
    if (success) {
      // Redirect to OpenEvidence dashboard or original URL
      const redirectUrl = req.query.state as string || '/openevidence/dashboard';
      res.redirect(redirectUrl);
    } else {
      res.redirect('/openevidence/login?error=authentication_failed');
    }

  } catch (error) {
    console.error('[OpenEvidence Auth] Callback error:', error);
    res.redirect('/openevidence/login?error=callback_failed');
  }
});

/**
 * POST /auth/openevidence/logout
 * Logout from OpenEvidence and WebQx
 */
router.post('/logout', requireOpenEvidenceAuth, async (req: OpenEvidenceRequest, res: Response) => {
  try {
    const { redirectUrl } = req.body;
    
    // Terminate OpenEvidence session
    if (req.sessionId) {
      openEvidenceAuth.terminateSession(req.sessionId);
    }
    
    // Logout from WebQx/Keycloak
    await webqxLogin.logout(redirectUrl || '/openevidence/login');
    
    res.json({
      success: true,
      message: 'Logged out successfully',
      platform: 'OpenEvidence'
    });

  } catch (error) {
    console.error('[OpenEvidence Auth] Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'LOGOUT_FAILED',
      message: 'Failed to logout',
      platform: 'OpenEvidence'
    });
  }
});

// ============================================================================
// Session Management Routes
// ============================================================================

/**
 * GET /auth/openevidence/session
 * Get current session information
 */
router.get('/session', requireOpenEvidenceAuth, auditRequest, (req: OpenEvidenceRequest, res: Response) => {
  const session = req.openEvidenceSession;
  if (!session) {
    res.status(401).json({
      error: 'NO_SESSION',
      message: 'No active session found',
      platform: 'OpenEvidence'
    });
    return;
  }

  res.json({
    success: true,
    session: {
      id: session.id,
      userId: session.userId,
      evidenceRole: session.evidenceRole,
      accessLevel: session.accessLevel,
      researchPermissions: session.researchPermissions,
      institutionalId: session.institutionalId,
      consentVersion: session.consentVersion,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      isActive: session.isActive
    },
    platform: 'OpenEvidence'
  });
});

/**
 * GET /auth/openevidence/sessions
 * Get all active sessions for the current user
 */
router.get('/sessions', requireOpenEvidenceAuth, auditRequest, (req: OpenEvidenceRequest, res: Response) => {
  const session = req.openEvidenceSession;
  if (!session) {
    res.status(401).json({
      error: 'NO_SESSION',
      message: 'No active session found',
      platform: 'OpenEvidence'
    });
    return;
  }

  const userSessions = openEvidenceAuth.getUserSessions(session.userId);
  
  res.json({
    success: true,
    sessions: userSessions.map(s => ({
      id: s.id,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      isActive: s.isActive,
      isCurrent: s.id === session.id
    })),
    platform: 'OpenEvidence'
  });
});

/**
 * DELETE /auth/openevidence/sessions/:sessionId
 * Terminate a specific session
 */
router.delete('/sessions/:sessionId', requireOpenEvidenceAuth, auditRequest, (req: OpenEvidenceRequest, res: Response) => {
  const { sessionId } = req.params;
  const currentSession = req.openEvidenceSession;
  
  if (!currentSession) {
    res.status(401).json({
      error: 'NO_SESSION',
      message: 'No active session found',
      platform: 'OpenEvidence'
    });
    return;
  }

  // Check if user owns the session or has admin privileges
  const targetSession = openEvidenceAuth.getSession(sessionId);
  if (!targetSession) {
    res.status(404).json({
      error: 'SESSION_NOT_FOUND',
      message: 'Session not found',
      platform: 'OpenEvidence'
    });
    return;
  }

  const canTerminate = targetSession.userId === currentSession.userId || 
                      currentSession.researchPermissions.includes('ADMIN_USERS');

  if (!canTerminate) {
    res.status(403).json({
      error: 'INSUFFICIENT_PERMISSIONS',
      message: 'Cannot terminate this session',
      platform: 'OpenEvidence'
    });
    return;
  }

  openEvidenceAuth.terminateSession(sessionId);
  
  res.json({
    success: true,
    message: 'Session terminated successfully',
    sessionId,
    platform: 'OpenEvidence'
  });
});

/**
 * POST /auth/openevidence/sessions/refresh
 * Refresh current session
 */
router.post('/sessions/refresh', requireOpenEvidenceAuth, (req: OpenEvidenceRequest, res: Response) => {
  const session = req.openEvidenceSession;
  if (!session) {
    res.status(401).json({
      error: 'NO_SESSION',
      message: 'No active session found',
      platform: 'OpenEvidence'
    });
    return;
  }

  // Update session activity (extends timeout)
  openEvidenceAuth.updateSessionActivity(req.sessionId!);
  
  res.json({
    success: true,
    message: 'Session refreshed successfully',
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours from now
    platform: 'OpenEvidence'
  });
});

// ============================================================================
// Consent Management Routes
// ============================================================================

/**
 * GET /auth/openevidence/consent
 * Get current consent information
 */
router.get('/consent', requireOpenEvidenceAuth, (req: OpenEvidenceRequest, res: Response) => {
  const session = req.openEvidenceSession;
  if (!session) {
    res.status(401).json({
      error: 'NO_SESSION',
      message: 'No active session found',
      platform: 'OpenEvidence'
    });
    return;
  }

  res.json({
    success: true,
    consent: {
      version: session.consentVersion,
      agreedAt: session.createdAt,
      currentVersion: '1.0',
      requiresUpdate: session.consentVersion < '1.0'
    },
    platform: 'OpenEvidence'
  });
});

/**
 * POST /auth/openevidence/consent
 * Update consent agreement
 */
router.post('/consent', requireOpenEvidenceAuth, (req: OpenEvidenceRequest, res: Response) => {
  const { version, agreed } = req.body;
  const session = req.openEvidenceSession;
  
  if (!session) {
    res.status(401).json({
      error: 'NO_SESSION',
      message: 'No active session found',
      platform: 'OpenEvidence'
    });
    return;
  }

  if (!agreed) {
    res.status(400).json({
      error: 'CONSENT_REQUIRED',
      message: 'Consent agreement is required',
      platform: 'OpenEvidence'
    });
    return;
  }

  // Update consent version in session
  session.consentVersion = version || '1.0';
  
  console.log(`[OpenEvidence Auth] Consent updated for user ${session.userId}: ${session.consentVersion}`);
  
  res.json({
    success: true,
    message: 'Consent updated successfully',
    version: session.consentVersion,
    platform: 'OpenEvidence'
  });
});

// ============================================================================
// User Profile Routes
// ============================================================================

/**
 * GET /auth/openevidence/profile
 * Get OpenEvidence user profile
 */
router.get('/profile', requireOpenEvidenceAuth, auditRequest, async (req: OpenEvidenceRequest, res: Response) => {
  try {
    const session = req.openEvidenceSession;
    if (!session) {
      res.status(401).json({
        error: 'NO_SESSION',
        message: 'No active session found',
        platform: 'OpenEvidence'
      });
      return;
    }

    // Get user info from WebQx
    const webqxUser = webqxLogin.getCurrentUser();
    if (!webqxUser) {
      res.status(401).json({
        error: 'USER_NOT_FOUND',
        message: 'User information not available',
        platform: 'OpenEvidence'
      });
      return;
    }

    const profile = {
      id: session.userId,
      email: webqxUser.email,
      name: webqxUser.preferred_username || webqxUser.name,
      openEvidenceRole: session.evidenceRole,
      accessLevel: session.accessLevel,
      researchPermissions: session.researchPermissions,
      institutionalAffiliation: session.institutionalId,
      lastAccess: new Date(),
      platform: 'OpenEvidence'
    };

    res.json({
      success: true,
      profile,
      platform: 'OpenEvidence'
    });

  } catch (error) {
    console.error('[OpenEvidence Auth] Profile error:', error);
    res.status(500).json({
      error: 'PROFILE_ERROR',
      message: 'Failed to retrieve profile',
      platform: 'OpenEvidence'
    });
  }
});

// ============================================================================
// Admin Routes
// ============================================================================

/**
 * GET /auth/openevidence/admin/stats
 * Get authentication statistics (admin only)
 */
router.get('/admin/stats', requireOpenEvidenceAuth, requirePermissions(['ADMIN_USERS']), auditRequest, (req: Request, res: Response) => {
  const stats = openEvidenceAuth.getSessionStats();
  
  res.json({
    success: true,
    stats,
    timestamp: new Date().toISOString(),
    platform: 'OpenEvidence'
  });
});

/**
 * GET /auth/openevidence/admin/sessions
 * Get all active sessions (admin only)
 */
router.get('/admin/sessions', requireOpenEvidenceAuth, requirePermissions(['ADMIN_USERS']), auditRequest, (req: Request, res: Response) => {
  const allSessions = Array.from((openEvidenceAuth as any).activeSessions.values());
  
  res.json({
    success: true,
    sessions: allSessions.map(session => ({
      id: session.id,
      userId: session.userId,
      evidenceRole: session.evidenceRole,
      accessLevel: session.accessLevel,
      institutionalId: session.institutionalId,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      isActive: session.isActive
    })),
    platform: 'OpenEvidence'
  });
});

/**
 * DELETE /auth/openevidence/admin/sessions/:sessionId
 * Terminate any session (admin only)
 */
router.delete('/admin/sessions/:sessionId', requireOpenEvidenceAuth, requirePermissions(['ADMIN_USERS']), auditRequest, (req: Request, res: Response) => {
  const { sessionId } = req.params;
  
  openEvidenceAuth.terminateSession(sessionId);
  
  res.json({
    success: true,
    message: 'Session terminated by admin',
    sessionId,
    platform: 'OpenEvidence'
  });
});

// ============================================================================
// Health Check Route
// ============================================================================

/**
 * GET /auth/openevidence/health
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  const stats = openEvidenceAuth.getSessionStats();
  
  res.json({
    status: 'healthy',
    platform: 'OpenEvidence',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    activeSessions: stats.totalActiveSessions,
    uptime: process.uptime()
  });
});

export default router;