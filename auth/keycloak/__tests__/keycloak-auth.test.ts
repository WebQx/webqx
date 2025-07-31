/**
 * WebQX™ Keycloak Authentication Provider Tests
 * 
 * Test suite for Keycloak authentication provider functionality.
 */

import { KeycloakProviderConfig } from '../types';
import { mapKeycloakRoles, tokenToUser } from '../middleware';

// Mock dependencies
jest.mock('jwks-rsa');
jest.mock('jsonwebtoken');
jest.mock('keycloak-js');
jest.mock('keycloak-connect');

describe('KeycloakAuthProvider', () => {
  let mockConfig: KeycloakProviderConfig;

  beforeEach(() => {
    mockConfig = {
      keycloak: {
        realm: 'test-realm',
        url: 'http://localhost:8080/auth',
        clientId: 'test-client',
        clientSecret: 'test-secret',
        publicClient: false,
        bearerOnly: true,
      },
      roleMappings: [
        {
          keycloakRole: 'healthcare-provider',
          webqxRole: 'PROVIDER',
          permissions: ['read:patient_records', 'write:prescriptions'],
        },
        {
          keycloakRole: 'patient',
          webqxRole: 'PATIENT',
          permissions: ['read:own_records', 'create:appointments'],
        },
      ],
      enableProviderVerification: true,
      enableAuditLogging: true,
      tokenValidation: {
        checkTokenType: true,
        checkAudience: true,
        allowedAudiences: ['test-client'],
        minimumTokenAge: 0,
        maximumTokenAge: 3600,
      },
    };
  });

  describe('configuration', () => {
    it('should create configuration object with correct structure', () => {
      expect(mockConfig.keycloak).toBeDefined();
      expect(mockConfig.keycloak.realm).toBe('test-realm');
      expect(mockConfig.keycloak.clientId).toBe('test-client');
      expect(mockConfig.roleMappings).toHaveLength(2);
      expect(mockConfig.enableProviderVerification).toBe(true);
    });

    it('should have valid role mappings', () => {
      const providerMapping = mockConfig.roleMappings.find(m => m.keycloakRole === 'healthcare-provider');
      expect(providerMapping).toBeDefined();
      expect(providerMapping?.webqxRole).toBe('PROVIDER');
      expect(providerMapping?.permissions).toContain('read:patient_records');
    });
  });
});

describe('Token Validation', () => {
  it('should validate token structure', async () => {
    // Mock the JWT validation
    const mockJwt = require('jsonwebtoken');
    const mockJwksClient = require('jwks-rsa');
    
    mockJwksClient.mockImplementation(() => ({
      getSigningKey: jest.fn().mockResolvedValue({
        getPublicKey: () => 'mock-public-key'
      })
    }));

    mockJwt.decode.mockReturnValue({
      header: { kid: 'key-id' }
    });

    mockJwt.verify.mockReturnValue({
      sub: 'user-123',
      email: 'test@example.com',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    });

    const token = 'mock.jwt.token';
    const result = await validateKeycloakToken(
      token,
      'http://localhost:8080/auth',
      'test-realm',
      'test-client'
    );

    expect(result).toBeDefined();
    expect(result?.sub).toBe('user-123');
  });
});

describe('Role Mapping', () => {
  const mockRoleMappings = [
    {
      keycloakRole: 'healthcare-provider',
      webqxRole: 'PROVIDER' as const,
      permissions: ['read:patient_records', 'write:prescriptions'],
    },
    {
      keycloakRole: 'primary-care-physician',
      webqxRole: 'PROVIDER' as const,
      specialty: 'PRIMARY_CARE' as const,
      permissions: ['read:patient_records', 'write:prescriptions'],
    },
    {
      keycloakRole: 'patient',
      webqxRole: 'PATIENT' as const,
      permissions: ['read:own_records', 'create:appointments'],
    },
  ];

  it('should map healthcare provider role correctly', () => {
    const tokenParsed = {
      realm_access: { roles: ['healthcare-provider'] },
      resource_access: {}
    } as any;

    const result = mapKeycloakRoles(tokenParsed, mockRoleMappings);

    expect(result.role).toBe('PROVIDER');
    expect(result.permissions).toContain('read:patient_records');
    expect(result.permissions).toContain('write:prescriptions');
  });

  it('should map specialty-specific role with higher priority', () => {
    const tokenParsed = {
      realm_access: { roles: ['healthcare-provider', 'primary-care-physician'] },
      resource_access: {}
    } as any;

    const result = mapKeycloakRoles(tokenParsed, mockRoleMappings);

    expect(result.role).toBe('PROVIDER');
    expect(result.specialty).toBe('PRIMARY_CARE');
  });

  it('should default to patient role for unmapped roles', () => {
    const tokenParsed = {
      realm_access: { roles: ['unknown-role'] },
      resource_access: {}
    } as any;

    const result = mapKeycloakRoles(tokenParsed, mockRoleMappings);

    expect(result.role).toBe('PATIENT');
    expect(result.permissions).toContain('read:own_records');
  });

  it('should handle client-specific roles', () => {
    const tokenParsed = {
      realm_access: { roles: [] },
      resource_access: {
        'test-client': { roles: ['healthcare-provider'] }
      }
    } as any;

    const result = mapKeycloakRoles(tokenParsed, mockRoleMappings);

    expect(result.role).toBe('PROVIDER');
  });
});

describe('User Mapping', () => {
  const mockRoleMappings = [
    {
      keycloakRole: 'healthcare-provider',
      webqxRole: 'PROVIDER' as const,
      permissions: ['read:patient_records', 'write:prescriptions'],
    },
  ];

  it('should convert token to user object correctly', () => {
    const tokenParsed = {
      sub: 'user-123',
      preferred_username: 'john.doe',
      email: 'john.doe@example.com',
      given_name: 'John',
      family_name: 'Doe',
      email_verified: true,
      realm_access: { roles: ['healthcare-provider'] },
      resource_access: {},
      npi_number: '1234567890',
      medical_license: 'MD123456',
      specialty: 'PRIMARY_CARE',
      provider_verification_status: 'VERIFIED',
    } as any;

    const user = tokenToUser(tokenParsed, mockRoleMappings);

    expect(user.id).toBe('user-123');
    expect(user.username).toBe('john.doe');
    expect(user.email).toBe('john.doe@example.com');
    expect(user.firstName).toBe('John');
    expect(user.lastName).toBe('Doe');
    expect(user.emailVerified).toBe(true);
    expect(user.webqxRole).toBe('PROVIDER');
    expect(user.npiNumber).toBe('1234567890');
    expect(user.medicalLicense).toBe('MD123456');
    expect(user.verificationStatus).toBe('VERIFIED');
  });

  it('should handle missing optional fields', () => {
    const tokenParsed = {
      sub: 'user-456',
      email: 'patient@example.com',
      realm_access: { roles: [] },
      resource_access: {},
    } as any;

    const user = tokenToUser(tokenParsed, mockRoleMappings);

    expect(user.id).toBe('user-456');
    expect(user.email).toBe('patient@example.com');
    expect(user.firstName).toBeUndefined();
    expect(user.lastName).toBeUndefined();
    expect(user.emailVerified).toBe(false);
    expect(user.webqxRole).toBe('PATIENT'); // Default role
    expect(user.verificationStatus).toBe('PENDING'); // Default verification status
  });
});