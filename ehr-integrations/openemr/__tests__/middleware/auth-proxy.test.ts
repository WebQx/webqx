/**
 * Unit Tests for Auth Proxy Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { AuthProxyMiddleware, AuthProxyConfig, AuthProxyRequest } from '../../middleware/auth-proxy';
import { OAuth2Connector } from '../../connectors/oauth2-connector';

// Mock OAuth2Connector
jest.mock('../../connectors/oauth2-connector');

describe('AuthProxyMiddleware', () => {
  let authProxy: AuthProxyMiddleware;
  let mockOAuth2Connector: jest.Mocked<OAuth2Connector>;
  let mockConfig: AuthProxyConfig;
  let mockReq: Partial<AuthProxyRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockConfig = {
      token: {
        validateOnEachRequest: true,
        refreshThresholdSeconds: 300,
        cacheTokens: true,
        cacheTtlSeconds: 300
      },
      session: {
        enableSessionManagement: true,
        sessionTimeoutSeconds: 3600,
        enableConcurrentSessions: true,
        maxConcurrentSessions: 5
      },
      accessControl: {
        enableRBAC: true,
        enableResourceLevelAccess: true,
        enablePatientContext: true,
        enableProviderContext: true
      },
      security: {
        enableSecurityHeaders: true,
        enableCSRFProtection: false,
        enableRequestValidation: true,
        maxRequestSize: 10485760
      },
      audit: {
        enabled: true,
        logAllRequests: true,
        logFailedAuth: true,
        logPermissionDenied: true
      }
    };

    mockOAuth2Connector = new OAuth2Connector({} as any) as jest.Mocked<OAuth2Connector>;
    authProxy = new AuthProxyMiddleware(mockConfig, mockOAuth2Connector);

    mockReq = {
      headers: {},
      params: {},
      query: {},
      method: 'GET',
      path: '/api/patient/123',
      ip: '127.0.0.1'
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();
  });

  describe('Authentication Middleware', () => {
    it('should authenticate valid token successfully', async () => {
      mockReq.headers = {
        authorization: 'Bearer valid-token'
      };

      // Mock token validation
      mockOAuth2Connector.validateCentralToken.mockResolvedValue({
        valid: true,
        claims: {
          sub: 'user-123',
          email: 'test@test.com',
          given_name: 'Test',
          family_name: 'User',
          role: 'provider'
        }
      });

      // Mock token exchange
      mockOAuth2Connector.exchangeForOpenEMRTokens.mockResolvedValue({
        success: true,
        openemrTokens: {
          accessToken: 'openemr-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
          scope: 'openid'
        }
      });

      const middleware = authProxy.authenticate();
      await middleware(mockReq as AuthProxyRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user?.id).toBe('user-123');
      expect(mockReq.openemrTokens).toBeDefined();
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    });

    it('should reject request without authorization header', async () => {
      mockReq.headers = {};

      const middleware = authProxy.authenticate();
      await middleware(mockReq as AuthProxyRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing or invalid authorization header' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid token', async () => {
      mockReq.headers = {
        authorization: 'Bearer invalid-token'
      };

      mockOAuth2Connector.validateCentralToken.mockResolvedValue({
        valid: false,
        error: 'Token expired'
      });

      const middleware = authProxy.authenticate();
      await middleware(mockReq as AuthProxyRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ 
        error: 'Token expired', 
        details: 'Token expired' 
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle OpenEMR token exchange failure', async () => {
      mockReq.headers = {
        authorization: 'Bearer valid-token'
      };

      mockOAuth2Connector.validateCentralToken.mockResolvedValue({
        valid: true,
        claims: { sub: 'user-123', email: 'test@test.com' }
      });

      mockOAuth2Connector.exchangeForOpenEMRTokens.mockResolvedValue({
        success: false,
        error: { code: 'EXCHANGE_FAILED' as const, message: 'Exchange failed' }
      });

      const middleware = authProxy.authenticate();
      await middleware(mockReq as AuthProxyRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to obtain OpenEMR access' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should add security headers when enabled', async () => {
      mockReq.headers = {
        authorization: 'Bearer valid-token'
      };

      mockOAuth2Connector.validateCentralToken.mockResolvedValue({
        valid: true,
        claims: { sub: 'user-123', email: 'test@test.com' }
      });

      mockOAuth2Connector.exchangeForOpenEMRTokens.mockResolvedValue({
        success: true,
        openemrTokens: {
          accessToken: 'openemr-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
          scope: 'openid'
        }
      });

      const middleware = authProxy.authenticate();
      await middleware(mockReq as AuthProxyRequest, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
    });
  });

  describe('Authorization Middleware', () => {
    beforeEach(() => {
      mockReq.user = {
        id: 'user-123',
        email: 'test@test.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'PROVIDER',
        isVerified: true,
        mfaEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });

    it('should authorize user with correct role', async () => {
      const middleware = authProxy.authorize(['PROVIDER'], []);
      await middleware(mockReq as AuthProxyRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject user with incorrect role', async () => {
      const middleware = authProxy.authorize(['ADMIN'], []);
      await middleware(mockReq as AuthProxyRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Insufficient role privileges',
        required: ['ADMIN'],
        actual: 'PROVIDER'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should authorize user with correct permissions', async () => {
      // Mock the access control provider to return required permissions
      const middleware = authProxy.authorize([], ['read:patient_records']);
      
      // Since we use a default implementation that returns the permissions,
      // this should pass for PROVIDER role
      await middleware(mockReq as AuthProxyRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject unauthenticated request', async () => {
      delete mockReq.user;

      const middleware = authProxy.authorize(['PROVIDER'], []);
      await middleware(mockReq as AuthProxyRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Patient Context Middleware', () => {
    it('should extract patient context from params', () => {
      mockReq.params = { patientId: 'patient-123' };

      const middleware = authProxy.requirePatientContext();
      middleware(mockReq as AuthProxyRequest, mockRes as Response, mockNext);

      expect(mockReq.patientContext).toBe('patient-123');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should extract patient context from id param', () => {
      mockReq.params = { id: 'patient-456' };

      const middleware = authProxy.requirePatientContext();
      middleware(mockReq as AuthProxyRequest, mockRes as Response, mockNext);

      expect(mockReq.patientContext).toBe('patient-456');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should extract patient context from query', () => {
      mockReq.query = { patient: 'patient-789' };

      const middleware = authProxy.requirePatientContext();
      middleware(mockReq as AuthProxyRequest, mockRes as Response, mockNext);

      expect(mockReq.patientContext).toBe('patient-789');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject request without patient context', () => {
      mockReq.params = {};
      mockReq.query = {};

      const middleware = authProxy.requirePatientContext();
      middleware(mockReq as AuthProxyRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Patient context required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should skip patient context when disabled', () => {
      mockConfig.accessControl.enablePatientContext = false;
      authProxy = new AuthProxyMiddleware(mockConfig, mockOAuth2Connector);

      const middleware = authProxy.requirePatientContext();
      middleware(mockReq as AuthProxyRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Provider Context Middleware', () => {
    beforeEach(() => {
      mockReq.user = {
        id: 'provider-123',
        email: 'provider@test.com',
        firstName: 'Provider',
        lastName: 'User',
        role: 'PROVIDER',
        isVerified: true,
        mfaEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });

    it('should extract provider context from params', () => {
      mockReq.params = { providerId: 'provider-456' };

      const middleware = authProxy.requireProviderContext();
      middleware(mockReq as AuthProxyRequest, mockRes as Response, mockNext);

      expect(mockReq.providerContext).toBe('provider-456');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should use user ID as provider context when not specified', () => {
      mockReq.params = {};
      mockReq.query = {};

      const middleware = authProxy.requireProviderContext();
      middleware(mockReq as AuthProxyRequest, mockRes as Response, mockNext);

      expect(mockReq.providerContext).toBe('provider-123');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject request without provider context when user not available', () => {
      delete mockReq.user;
      mockReq.params = {};
      mockReq.query = {};

      const middleware = authProxy.requireProviderContext();
      middleware(mockReq as AuthProxyRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Provider context required' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Request Validation Middleware', () => {
    it('should validate request size', () => {
      mockReq.headers = {
        'content-length': '1000000' // 1MB - within limit
      };

      const middleware = authProxy.validateRequest();
      middleware(mockReq as AuthProxyRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject request that is too large', () => {
      mockReq.headers = {
        'content-length': '20971520' // 20MB - exceeds limit
      };

      const middleware = authProxy.validateRequest();
      middleware(mockReq as AuthProxyRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(413);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Request too large' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should skip validation when disabled', () => {
      mockConfig.security.enableRequestValidation = false;
      authProxy = new AuthProxyMiddleware(mockConfig, mockOAuth2Connector);

      mockReq.headers = {
        'content-length': '20971520' // Large request
      };

      const middleware = authProxy.validateRequest();
      middleware(mockReq as AuthProxyRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Session Management', () => {
    it('should handle session management when enabled', async () => {
      mockReq.session = {
        id: 'session-123',
        userId: 'user-123',
        token: 'token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 3600000),
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        isActive: true,
        createdAt: new Date()
      };

      const middleware = authProxy.manageSession();
      await middleware(mockReq as AuthProxyRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip session management when disabled', async () => {
      mockConfig.session.enableSessionManagement = false;
      authProxy = new AuthProxyMiddleware(mockConfig, mockOAuth2Connector);

      const middleware = authProxy.manageSession();
      await middleware(mockReq as AuthProxyRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle missing session gracefully', async () => {
      delete mockReq.session;

      const middleware = authProxy.manageSession();
      await middleware(mockReq as AuthProxyRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors gracefully', async () => {
      mockReq.headers = {
        authorization: 'Bearer valid-token'
      };

      mockOAuth2Connector.validateCentralToken.mockRejectedValue(new Error('Network error'));

      const middleware = authProxy.authenticate();
      await middleware(mockReq as AuthProxyRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authentication failed' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle authorization errors gracefully', async () => {
      mockReq.user = {
        id: 'user-123',
        email: 'test@test.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'PROVIDER',
        isVerified: true,
        mfaEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock the access control provider to throw an error
      const middleware = authProxy.authorize([], ['read:patient_records']);
      
      // Override the getUserPermissions method to throw an error
      const originalGetUserPermissions = (authProxy as any).accessControlProvider.getUserPermissions;
      (authProxy as any).accessControlProvider.getUserPermissions = jest.fn().mockRejectedValue(new Error('Database error'));

      await middleware(mockReq as AuthProxyRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authorization failed' });
      expect(mockNext).not.toHaveBeenCalled();

      // Restore original method
      (authProxy as any).accessControlProvider.getUserPermissions = originalGetUserPermissions;
    });
  });
});