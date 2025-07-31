/**
 * WebQX™ OpenEMR Keycloak Integration Tests
 * 
 * Integration test suite for OpenEMR-Keycloak authentication flow.
 */

import request from 'supertest';
import express from 'express';
import { OpenEMRKeycloakIntegration, createOpenEMRKeycloakIntegration } from '../keycloak-integration';
import { OAuth2Connector } from '../connectors/oauth2-connector';
import { KeycloakUser } from '../../../auth/keycloak/types';

// Mock OAuth2 connector
class MockOAuth2Connector extends OAuth2Connector {
  async initialize(): Promise<void> {
    // Mock initialization
  }

  async validateCentralToken(token: string): Promise<any> {
    if (token === 'valid-keycloak-token') {
      return {
        valid: true,
        claims: {
          sub: 'user-123',
          email: 'provider@example.com',
          given_name: 'John',
          family_name: 'Doe',
          realm_access: { roles: ['healthcare-provider'] },
        }
      };
    }
    return { valid: false, error: 'Invalid token' };
  }

  async exchangeForOpenEMRTokens(request: any): Promise<any> {
    return {
      success: true,
      openemrTokens: {
        accessToken: 'openemr-access-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
      }
    };
  }
}

describe('OpenEMR Keycloak Integration', () => {
  let app: express.Application;
  let integration: OpenEMRKeycloakIntegration;
  let mockOAuth2Connector: MockOAuth2Connector;

  beforeAll(async () => {
    // Setup test application
    app = express();
    app.use(express.json());

    // Create mock OAuth2 connector
    mockOAuth2Connector = new MockOAuth2Connector({
      openemrBaseUrl: 'http://test-openemr.com',
      centralIdpIssuer: 'http://localhost:8080/auth/realms/test-realm',
      openemrClientId: 'test-client',
      openemrClientSecret: 'test-secret'
    });

    // Create integration instance
    integration = createOpenEMRKeycloakIntegration(mockOAuth2Connector, {
      integration: {
        enableTokenExchange: true,
        enableRoleMapping: true,
        enableProviderVerification: false, // Disable for testing
        defaultPatientAccess: false,
        auditAllRequests: false,
      }
    });

    await integration.initialize();

    // Setup test routes
    const authMiddleware = integration.createAuthenticationMiddleware();
    
    app.get('/api/patient/:id', ...authMiddleware, (req, res) => {
      const context = integration.getUserContext(req);
      res.json({
        patient: { id: req.params.id },
        user: context.keycloakUser,
        tokens: context.tokens
      });
    });

    app.get('/api/provider/patients', 
      ...authMiddleware,
      integration.createRoleMiddleware(['PROVIDER', 'NURSE']),
      (req, res) => {
        res.json({ patients: ['patient-1', 'patient-2'] });
      }
    );

    app.get('/api/specialty/cardiology',
      ...authMiddleware,
      integration.createSpecialtyMiddleware(['CARDIOLOGY']),
      (req, res) => {
        res.json({ cardiology_data: 'sensitive' });
      }
    );
  });

  describe('Authentication Middleware', () => {
    it('should authenticate valid Keycloak token', async () => {
      const response = await request(app)
        .get('/api/patient/123')
        .set('Authorization', 'Bearer valid-keycloak-token')
        .expect(200);

      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('provider@example.com');
      expect(response.body.tokens).toBeDefined();
      expect(response.body.tokens.accessToken).toBe('openemr-access-token');
    });

    it('should reject missing authorization header', async () => {
      await request(app)
        .get('/api/patient/123')
        .expect(401);
    });

    it('should reject invalid token format', async () => {
      await request(app)
        .get('/api/patient/123')
        .set('Authorization', 'Invalid token')
        .expect(401);
    });

    it('should reject invalid Keycloak token', async () => {
      await request(app)
        .get('/api/patient/123')
        .set('Authorization', 'Bearer invalid-keycloak-token')
        .expect(401);
    });
  });

  describe('Role-based Access Control', () => {
    it('should allow provider access to provider endpoints', async () => {
      // Mock provider token
      jest.spyOn(mockOAuth2Connector, 'validateCentralToken')
        .mockResolvedValue({
          valid: true,
          claims: {
            sub: 'provider-123',
            email: 'provider@example.com',
            realm_access: { roles: ['healthcare-provider'] },
          }
        });

      await request(app)
        .get('/api/provider/patients')
        .set('Authorization', 'Bearer valid-provider-token')
        .expect(200);
    });

    it('should deny patient access to provider endpoints', async () => {
      // Mock patient token
      jest.spyOn(mockOAuth2Connector, 'validateCentralToken')
        .mockResolvedValue({
          valid: true,
          claims: {
            sub: 'patient-123',
            email: 'patient@example.com',
            realm_access: { roles: ['patient'] },
          }
        });

      await request(app)
        .get('/api/provider/patients')
        .set('Authorization', 'Bearer valid-patient-token')
        .expect(403);
    });

    it('should allow nurse access to provider endpoints', async () => {
      // Mock nurse token
      jest.spyOn(mockOAuth2Connector, 'validateCentralToken')
        .mockResolvedValue({
          valid: true,
          claims: {
            sub: 'nurse-123',
            email: 'nurse@example.com',
            realm_access: { roles: ['nurse'] },
          }
        });

      await request(app)
        .get('/api/provider/patients')
        .set('Authorization', 'Bearer valid-nurse-token')
        .expect(200);
    });
  });

  describe('Specialty-based Access Control', () => {
    it('should allow cardiology access to cardiology specialists', async () => {
      // Mock cardiologist token
      jest.spyOn(mockOAuth2Connector, 'validateCentralToken')
        .mockResolvedValue({
          valid: true,
          claims: {
            sub: 'cardio-123',
            email: 'cardio@example.com',
            realm_access: { roles: ['specialist-physician'] },
            specialty: 'CARDIOLOGY',
          }
        });

      await request(app)
        .get('/api/specialty/cardiology')
        .set('Authorization', 'Bearer valid-cardio-token')
        .expect(200);
    });

    it('should deny non-cardiology access to cardiology endpoints', async () => {
      // Mock primary care token
      jest.spyOn(mockOAuth2Connector, 'validateCentralToken')
        .mockResolvedValue({
          valid: true,
          claims: {
            sub: 'primary-123',
            email: 'primary@example.com',
            realm_access: { roles: ['primary-care-physician'] },
            specialty: 'PRIMARY_CARE',
          }
        });

      await request(app)
        .get('/api/specialty/cardiology')
        .set('Authorization', 'Bearer valid-primary-token')
        .expect(403);
    });
  });

  describe('Patient Access Validation', () => {
    it('should validate patient can access own records', async () => {
      const mockKeycloakUser: KeycloakUser = {
        id: 'patient-123',
        username: 'patient123',
        email: 'patient@example.com',
        emailVerified: true,
        roles: ['patient'],
        groups: [],
        attributes: {},
        webqxRole: 'PATIENT',
        verificationStatus: 'VERIFIED',
      };

      // Mock request with patient user
      const mockReq = {
        keycloakUser: mockKeycloakUser,
        openemrUser: {
          id: 'patient-123',
          email: 'patient@example.com',
          role: 'PATIENT',
        },
      } as any;

      const result = await integration.validatePatientAccess(mockReq, 'patient-123');
      expect(result.hasAccess).toBe(true);
    });

    it('should deny patient access to other patient records', async () => {
      const mockKeycloakUser: KeycloakUser = {
        id: 'patient-123',
        username: 'patient123',
        email: 'patient@example.com',
        emailVerified: true,
        roles: ['patient'],
        groups: [],
        attributes: {},
        webqxRole: 'PATIENT',
        verificationStatus: 'VERIFIED',
      };

      const mockReq = {
        keycloakUser: mockKeycloakUser,
        openemrUser: {
          id: 'patient-123',
          email: 'patient@example.com',
          role: 'PATIENT',
        },
      } as any;

      const result = await integration.validatePatientAccess(mockReq, 'patient-456');
      expect(result.hasAccess).toBe(false);
      expect(result.reason).toContain('own records');
    });

    it('should allow provider access to any patient records', async () => {
      const mockKeycloakUser: KeycloakUser = {
        id: 'provider-123',
        username: 'provider123',
        email: 'provider@example.com',
        emailVerified: true,
        roles: ['healthcare-provider'],
        groups: [],
        attributes: {},
        webqxRole: 'PROVIDER',
        verificationStatus: 'VERIFIED',
      };

      const mockReq = {
        keycloakUser: mockKeycloakUser,
        openemrUser: {
          id: 'provider-123',
          email: 'provider@example.com',
          role: 'PROVIDER',
        },
      } as any;

      const result = await integration.validatePatientAccess(mockReq, 'patient-456');
      expect(result.hasAccess).toBe(true);
    });
  });

  describe('Token Exchange', () => {
    it('should exchange Keycloak token for OpenEMR tokens', async () => {
      const mockKeycloakUser: KeycloakUser = {
        id: 'user-123',
        username: 'user123',
        email: 'user@example.com',
        emailVerified: true,
        roles: ['healthcare-provider'],
        groups: [],
        attributes: {},
        webqxRole: 'PROVIDER',
        verificationStatus: 'VERIFIED',
      };

      // Create a private method test by accessing it through the integration object
      const result = await (integration as any).exchangeTokens('valid-keycloak-token', mockKeycloakUser);

      expect(result.success).toBe(true);
      expect(result.openemrTokens).toBeDefined();
      expect(result.openemrTokens.accessToken).toBe('openemr-access-token');
    });

    it('should handle token exchange failure', async () => {
      // Mock failure
      jest.spyOn(mockOAuth2Connector, 'exchangeForOpenEMRTokens')
        .mockResolvedValue({ success: false, error: 'Exchange failed' });

      const mockKeycloakUser: KeycloakUser = {
        id: 'user-123',
        username: 'user123',
        email: 'user@example.com',
        emailVerified: true,
        roles: ['healthcare-provider'],
        groups: [],
        attributes: {},
        webqxRole: 'PROVIDER',
        verificationStatus: 'VERIFIED',
      };

      const result = await (integration as any).exchangeTokens('invalid-token', mockKeycloakUser);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Configuration', () => {
    it('should return integration configuration', () => {
      const config = integration.getConfig();
      
      expect(config.keycloak).toBeDefined();
      expect(config.openemr).toBeDefined();
      expect(config.integration).toBeDefined();
      expect(config.integration.enableTokenExchange).toBe(true);
      expect(config.integration.enableRoleMapping).toBe(true);
    });
  });
});