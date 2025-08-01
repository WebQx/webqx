/**
 * Test suite for Firebase Authentication Provider
 */

import FirebaseAuthProvider from '../firebase';
import { AuthCredentials, CreateUserData, AuthProviderConfig } from '../types';

describe('FirebaseAuthProvider', () => {
  let authProvider: FirebaseAuthProvider;
  
  beforeEach(() => {
    authProvider = new FirebaseAuthProvider();
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid configuration', async () => {
      const config: AuthProviderConfig = {
        apiKey: 'test-api-key',
        domain: 'test.firebaseapp.com',
        projectId: 'test-project'
      };

      await expect(authProvider.initialize(config)).resolves.not.toThrow();
    });

    it('should throw error with incomplete configuration', async () => {
      const config: AuthProviderConfig = {
        apiKey: 'test-api-key'
        // Missing domain and projectId
      };

      await expect(authProvider.initialize(config)).rejects.toThrow(
        'Firebase configuration is incomplete'
      );
    });
  });

  describe('Authentication', () => {
    beforeEach(async () => {
      const config: AuthProviderConfig = {
        apiKey: 'test-api-key',
        domain: 'test.firebaseapp.com',
        projectId: 'test-project'
      };
      await authProvider.initialize(config);
    });

    it('should authenticate user with valid credentials', async () => {
      const credentials: AuthCredentials = {
        email: 'doctor@example.com',
        password: 'validPassword123',
        mfaCode: '123456'
      };

      const result = await authProvider.authenticate(credentials);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe(credentials.email);
      expect(result.session).toBeDefined();
    });

    it('should require MFA when not provided', async () => {
      const credentials: AuthCredentials = {
        email: 'doctor@example.com',
        password: 'validPassword123'
        // No MFA code
      };

      const result = await authProvider.authenticate(credentials);

      expect(result.success).toBe(false);
      expect(result.requiresMFA).toBe(true);
      expect(result.error?.code).toBe('MFA_REQUIRED');
    });

    it('should reject invalid credentials', async () => {
      const credentials: AuthCredentials = {
        email: '',
        password: ''
      };

      const result = await authProvider.authenticate(credentials);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('User Creation', () => {
    beforeEach(async () => {
      const config: AuthProviderConfig = {
        apiKey: 'test-api-key',
        domain: 'test.firebaseapp.com',
        projectId: 'test-project'
      };
      await authProvider.initialize(config);
    });

    it('should create new user successfully', async () => {
      const userData: CreateUserData = {
        email: 'newdoctor@example.com',
        firstName: 'Dr. Jane',
        lastName: 'Doe',
        role: 'PROVIDER',
        specialty: 'CARDIOLOGY'
      };

      const user = await authProvider.createUser(userData);

      expect(user.email).toBe(userData.email);
      expect(user.firstName).toBe(userData.firstName);
      expect(user.lastName).toBe(userData.lastName);
      expect(user.role).toBe(userData.role);
      expect(user.specialty).toBe(userData.specialty);
      expect(user.isVerified).toBe(false); // New users start unverified
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      const config: AuthProviderConfig = {
        apiKey: 'test-api-key',
        domain: 'test.firebaseapp.com',
        projectId: 'test-project'
      };
      await authProvider.initialize(config);
    });

    it('should verify valid session token', async () => {
      const user = await authProvider.verifySession('valid_token');

      expect(user).toBeDefined();
      expect(user?.email).toBe('doctor@example.com');
    });

    it('should return null for invalid session token', async () => {
      const user = await authProvider.verifySession('invalid_token');

      expect(user).toBeNull();
    });

    it('should revoke session successfully', async () => {
      await expect(authProvider.revokeSession('session_123')).resolves.not.toThrow();
    });

    it('should refresh token successfully', async () => {
      const session = await authProvider.refreshToken('refresh_token_123');

      expect(session).toBeDefined();
      expect(session.token).toBeDefined();
      expect(session.refreshToken).toBeDefined();
      expect(session.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when not initialized', async () => {
      const credentials: AuthCredentials = {
        email: 'test@example.com',
        password: 'password'
      };

      await expect(authProvider.authenticate(credentials)).rejects.toThrow(
        'Firebase provider not initialized'
      );
    });
  });
});