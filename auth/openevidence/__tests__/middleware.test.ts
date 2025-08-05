/**
 * @fileoverview OpenEvidence Middleware Tests
 * 
 * Test suite for OpenEvidence authentication middleware functions,
 * including authorization, rate limiting, and audit logging.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express';
import {
  requireOpenEvidenceAuth,
  requirePermissions,
  requireAccessLevel,
  requireInstitutionalAccess,
  requireMFA,
  auditRequest,
  rateLimitBySession,
  requireConsentAgreement,
  openEvidenceCORS,
  OpenEvidenceRequest
} from '../middleware';
import { openEvidenceAuth, OpenEvidenceSession } from '../index';

// Mock the openEvidenceAuth instance
jest.mock('../index', () => ({
  openEvidenceAuth: {
    getSession: jest.fn(),
    updateSessionActivity: jest.fn(),
    terminateSession: jest.fn(),
    hasPermission: jest.fn(),
    hasAccessLevel: jest.fn()
  }
}));

describe('OpenEvidence Middleware', () => {
  let mockRequest: Partial<OpenEvidenceRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockSession: OpenEvidenceSession;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      cookies: {},
      query: {},
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' } as any,
      get: jest.fn(),
      path: '/test',
      method: 'GET'
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      header: jest.fn().mockReturnThis(),
      sendStatus: jest.fn()
    };

    mockNext = jest.fn();

    mockSession = {
      id: 'test-session-123',
      userId: 'user-123',
      token: 'mock-token',
      refreshToken: 'mock-refresh',
      expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
      isActive: true,
      createdAt: new Date(),
      evidenceRole: 'PHYSICIAN',
      accessLevel: 'ADVANCED',
      researchPermissions: ['VIEW_EVIDENCE', 'EXPORT_SUMMARIES'],
      consentVersion: '1.0',
      institutionalId: 'hospital.edu'
    };

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('requireOpenEvidenceAuth', () => {
    it('should authenticate valid session from header', () => {
      mockRequest.headers = { 'x-openevidence-session': 'test-session-123' };
      (openEvidenceAuth.getSession as jest.Mock).mockReturnValue(mockSession);

      requireOpenEvidenceAuth(mockRequest as OpenEvidenceRequest, mockResponse as Response, mockNext);

      expect(openEvidenceAuth.getSession).toHaveBeenCalledWith('test-session-123');
      expect(openEvidenceAuth.updateSessionActivity).toHaveBeenCalledWith('test-session-123');
      expect(mockRequest.openEvidenceSession).toEqual(mockSession);
      expect(mockRequest.sessionId).toBe('test-session-123');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should authenticate valid session from cookie', () => {
      mockRequest.cookies = { openevidence_session: 'test-session-123' };
      (openEvidenceAuth.getSession as jest.Mock).mockReturnValue(mockSession);

      requireOpenEvidenceAuth(mockRequest as OpenEvidenceRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should authenticate valid session from query parameter', () => {
      mockRequest.query = { sessionId: 'test-session-123' };
      (openEvidenceAuth.getSession as jest.Mock).mockReturnValue(mockSession);

      requireOpenEvidenceAuth(mockRequest as OpenEvidenceRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject request without session ID', () => {
      requireOpenEvidenceAuth(mockRequest as OpenEvidenceRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'OpenEvidence session required',
        platform: 'OpenEvidence'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid session', () => {
      mockRequest.headers = { 'x-openevidence-session': 'invalid-session' };
      (openEvidenceAuth.getSession as jest.Mock).mockReturnValue(null);

      requireOpenEvidenceAuth(mockRequest as OpenEvidenceRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'INVALID_SESSION',
        message: 'Invalid or expired OpenEvidence session',
        platform: 'OpenEvidence'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject expired session', () => {
      const expiredSession = {
        ...mockSession,
        expiresAt: new Date(Date.now() - 1000) // 1 second ago
      };

      mockRequest.headers = { 'x-openevidence-session': 'expired-session' };
      (openEvidenceAuth.getSession as jest.Mock).mockReturnValue(expiredSession);

      requireOpenEvidenceAuth(mockRequest as OpenEvidenceRequest, mockResponse as Response, mockNext);

      expect(openEvidenceAuth.terminateSession).toHaveBeenCalledWith('expired-session');
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'SESSION_EXPIRED',
        message: 'OpenEvidence session has expired',
        platform: 'OpenEvidence'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requirePermissions', () => {
    beforeEach(() => {
      mockRequest.openEvidenceSession = mockSession;
      mockRequest.sessionId = 'test-session-123';
    });

    it('should allow access with required permissions', () => {
      (openEvidenceAuth.hasPermission as jest.Mock).mockReturnValue(true);
      const middleware = requirePermissions(['VIEW_EVIDENCE']);

      middleware(mockRequest as OpenEvidenceRequest, mockResponse as Response, mockNext);

      expect(openEvidenceAuth.hasPermission).toHaveBeenCalledWith('test-session-123', 'VIEW_EVIDENCE');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access without required permissions', () => {
      (openEvidenceAuth.hasPermission as jest.Mock).mockReturnValue(false);
      const middleware = requirePermissions(['ADMIN_USERS']);

      middleware(mockRequest as OpenEvidenceRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'INSUFFICIENT_PERMISSIONS',
        message: 'Required permissions not granted',
        requiredPermissions: ['ADMIN_USERS'],
        userPermissions: mockSession.researchPermissions,
        platform: 'OpenEvidence'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should require authentication', () => {
      mockRequest.openEvidenceSession = undefined;
      const middleware = requirePermissions(['VIEW_EVIDENCE']);

      middleware(mockRequest as OpenEvidenceRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireAccessLevel', () => {
    beforeEach(() => {
      mockRequest.openEvidenceSession = mockSession;
      mockRequest.sessionId = 'test-session-123';
    });

    it('should allow access with sufficient access level', () => {
      (openEvidenceAuth.hasAccessLevel as jest.Mock).mockReturnValue(true);
      const middleware = requireAccessLevel('BASIC');

      middleware(mockRequest as OpenEvidenceRequest, mockResponse as Response, mockNext);

      expect(openEvidenceAuth.hasAccessLevel).toHaveBeenCalledWith('test-session-123', 'BASIC');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access with insufficient access level', () => {
      (openEvidenceAuth.hasAccessLevel as jest.Mock).mockReturnValue(false);
      const middleware = requireAccessLevel('INSTITUTIONAL');

      middleware(mockRequest as OpenEvidenceRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'INSUFFICIENT_ACCESS_LEVEL',
        message: 'Required access level not granted',
        requiredLevel: 'INSTITUTIONAL',
        userLevel: mockSession.accessLevel,
        platform: 'OpenEvidence'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireInstitutionalAccess', () => {
    beforeEach(() => {
      mockRequest.openEvidenceSession = mockSession;
    });

    it('should allow access with institutional affiliation', () => {
      requireInstitutionalAccess(mockRequest as OpenEvidenceRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access without institutional affiliation', () => {
      mockRequest.openEvidenceSession = {
        ...mockSession,
        institutionalId: undefined
      };

      requireInstitutionalAccess(mockRequest as OpenEvidenceRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'INSTITUTIONAL_ACCESS_REQUIRED',
        message: 'Institutional affiliation required for this resource',
        platform: 'OpenEvidence'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireMFA', () => {
    beforeEach(() => {
      mockRequest.openEvidenceSession = mockSession;
    });

    it('should allow access with MFA verified', () => {
      mockRequest.headers = { 'x-mfa-verified': 'true' };

      requireMFA(mockRequest as OpenEvidenceRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow access with MFA token', () => {
      mockRequest.openEvidenceSession = {
        ...mockSession,
        token: 'mock-token-mfa_verified'
      };

      requireMFA(mockRequest as OpenEvidenceRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access without MFA', () => {
      requireMFA(mockRequest as OpenEvidenceRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'MFA_REQUIRED',
        message: 'Multi-factor authentication required for this resource',
        mfaSetupUrl: '/auth/mfa/setup',
        platform: 'OpenEvidence'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('auditRequest', () => {
    beforeEach(() => {
      mockRequest.openEvidenceSession = mockSession;
      mockRequest.sessionId = 'test-session-123';
      mockRequest.get = jest.fn().mockReturnValue('Test User Agent');
    });

    it('should log request audit data', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      auditRequest(mockRequest as OpenEvidenceRequest, mockResponse as Response, mockNext);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[OpenEvidence Audit] Request:',
        expect.objectContaining({
          sessionId: 'test-session-123',
          userId: 'user-123',
          method: 'GET',
          path: '/test',
          platform: 'OpenEvidence'
        })
      );

      consoleSpy.mockRestore();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should override res.json to log responses', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const originalJson = mockResponse.json;

      auditRequest(mockRequest as OpenEvidenceRequest, mockResponse as Response, mockNext);

      // Simulate response
      (mockResponse as any).statusCode = 200;
      (mockResponse.json as jest.Mock).call(mockResponse, { success: true });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[OpenEvidence Audit] Response:',
        expect.objectContaining({
          statusCode: 200,
          success: true,
          platform: 'OpenEvidence'
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('rateLimitBySession', () => {
    beforeEach(() => {
      mockRequest.sessionId = 'test-session-123';
    });

    it('should allow requests under the limit', () => {
      const middleware = rateLimitBySession(10, 60000);

      middleware(mockRequest as OpenEvidenceRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should block requests over the limit', () => {
      const middleware = rateLimitBySession(1, 60000);

      // First request should pass
      middleware(mockRequest as OpenEvidenceRequest, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      // Second request should be blocked
      jest.clearAllMocks();
      middleware(mockRequest as OpenEvidenceRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests from this session',
          limit: 1,
          platform: 'OpenEvidence'
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reset rate limit after window expires', (done) => {
      const middleware = rateLimitBySession(1, 10); // 10ms window

      // First request
      middleware(mockRequest as OpenEvidenceRequest, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      // Wait for window to expire
      setTimeout(() => {
        jest.clearAllMocks();
        middleware(mockRequest as OpenEvidenceRequest, mockResponse as Response, mockNext);
        expect(mockNext).toHaveBeenCalledTimes(1);
        done();
      }, 15);
    });
  });

  describe('requireConsentAgreement', () => {
    beforeEach(() => {
      mockRequest.openEvidenceSession = mockSession;
    });

    it('should allow access with valid consent version', () => {
      const middleware = requireConsentAgreement('1.0');

      middleware(mockRequest as OpenEvidenceRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access with outdated consent', () => {
      mockRequest.openEvidenceSession = {
        ...mockSession,
        consentVersion: '0.9'
      };

      const middleware = requireConsentAgreement('1.0');

      middleware(mockRequest as OpenEvidenceRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'CONSENT_AGREEMENT_REQUIRED',
        message: 'Updated consent agreement required',
        userConsentVersion: '0.9',
        requiredVersion: '1.0',
        consentUrl: '/auth/openevidence/consent',
        platform: 'OpenEvidence'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('openEvidenceCORS', () => {
    it('should set CORS headers for allowed origins', () => {
      mockRequest.get = jest.fn().mockReturnValue('https://openevidence.webqx.health');

      openEvidenceCORS(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://openevidence.webqx.health');
      expect(mockResponse.header).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      expect(mockResponse.header).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should not set origin header for disallowed origins', () => {
      mockRequest.get = jest.fn().mockReturnValue('https://malicious-site.com');

      openEvidenceCORS(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.header).not.toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://malicious-site.com');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle OPTIONS requests', () => {
      mockRequest.method = 'OPTIONS';

      openEvidenceCORS(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.sendStatus).toHaveBeenCalledWith(200);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});