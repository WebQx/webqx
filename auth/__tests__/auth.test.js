/**
 * Unit Tests for HIPAA-Compliant Secure Authentication System
 * 
 * Tests the user service, authentication routes, and security features
 * of the WebQX patient portal authentication system.
 */

const request = require('supertest');
const express = require('express');
const { userService } = require('../services/userService.js');
const authRoutes = require('../routes/auth.js');

// Create test app
const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

describe('HIPAA-Compliant Authentication System', () => {
  
  beforeEach(() => {
    // Clear all data before each test for isolation
    userService.clearAll();
  });

  describe('User Registration', () => {
    
    test('should create a new user with valid data', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'VGVzdFBhc3N3b3JkMTIzIQ==', // Base64 encoded "TestPassword123!"
        firstName: 'John',
        lastName: 'Doe',
        role: 'PATIENT'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.firstName).toBe(userData.firstName);
      expect(response.body.user.lastName).toBe(userData.lastName);
      expect(response.body.user.role).toBe(userData.role);
      expect(response.body.user.passwordHash).toBeUndefined(); // Should not return password hash
    });

    test('should reject registration with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'VGVzdFBhc3N3b3JkMTIzIQ==',
        firstName: 'John',
        lastName: 'Doe',
        role: 'PATIENT'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should reject registration with weak password', async () => {
      const userData = {
        email: 'test2@example.com',
        password: btoa('weak'), // Base64 encoded weak password
        firstName: 'John',
        lastName: 'Doe',
        role: 'PATIENT'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PASSWORD_POLICY_VIOLATION');
    });

    test('should reject duplicate email registration', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'VGVzdFBhc3N3b3JkMTIzIQ==',
        firstName: 'John',
        lastName: 'Doe',
        role: 'PATIENT'
      };

      // First registration should succeed
      await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(201);

      // Second registration with same email should fail
      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('USER_EXISTS');
    });

  });

  describe('User Authentication', () => {
    
    beforeEach(async () => {
      // Create a test user for authentication tests
      await userService.createUser({
        email: 'auth-test@example.com',
        password: 'TestPassword123!',
        firstName: 'Auth',
        lastName: 'Test',
        role: 'PATIENT'
      });
    });

    test('should authenticate user with valid credentials', async () => {
      const credentials = {
        email: 'auth-test@example.com',
        password: 'VGVzdFBhc3N3b3JkMTIzIQ==' // Base64 encoded "TestPassword123!"
      };

      const response = await request(app)
        .post('/auth/login')
        .send(credentials)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.sessionId).toBeDefined();
      expect(response.body.expiresAt).toBeDefined();
    });

    test('should reject authentication with invalid email', async () => {
      const credentials = {
        email: 'nonexistent@example.com',
        password: 'VGVzdFBhc3N3b3JkMTIzIQ=='
      };

      const response = await request(app)
        .post('/auth/login')
        .send(credentials)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    test('should reject authentication with invalid password', async () => {
      const credentials = {
        email: 'auth-test@example.com',
        password: btoa('WrongPassword123!') // Base64 encoded wrong password
      };

      const response = await request(app)
        .post('/auth/login')
        .send(credentials)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    test('should lock account after multiple failed attempts', async () => {
      const credentials = {
        email: 'auth-test@example.com',
        password: btoa('WrongPassword') // Base64 encoded wrong password
      };

      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/auth/login')
          .send(credentials)
          .expect(401);
      }

      // 6th attempt should result in account lockout
      const response = await request(app)
        .post('/auth/login')
        .send(credentials)
        .expect(401);

      expect(response.body.error.code).toBe('ACCOUNT_LOCKED');
    });

  });

  describe('Session Management', () => {
    
    let sessionId;
    
    beforeEach(async () => {
      // Create a test user and login to get session
      await userService.createUser({
        email: 'session-test@example.com',
        password: 'TestPassword123!',
        firstName: 'Session',
        lastName: 'Test',
        role: 'PATIENT'
      });

      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: 'session-test@example.com',
          password: 'VGVzdFBhc3N3b3JkMTIzIQ=='
        });

      sessionId = loginResponse.body.sessionId;
    });

    test('should verify valid session', async () => {
      const response = await request(app)
        .get('/auth/verify')
        .set('x-session-id', sessionId)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.authenticated).toBe(true);
      expect(response.body.user).toBeDefined();
    });

    test('should reject invalid session', async () => {
      const response = await request(app)
        .get('/auth/verify')
        .set('x-session-id', 'invalid-session-id')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.authenticated).toBe(false);
    });

    test('should logout and invalidate session', async () => {
      // Logout
      await request(app)
        .post('/auth/logout')
        .send({ sessionId })
        .expect(200);

      // Try to verify the session after logout
      const response = await request(app)
        .get('/auth/verify')
        .set('x-session-id', sessionId)
        .expect(401);

      expect(response.body.authenticated).toBe(false);
    });

  });

  describe('Security Features', () => {
    
    test('should enforce rate limiting on authentication endpoints', async () => {
      const credentials = {
        email: 'rate-test@example.com',
        password: 'VGVzdFBhc3N3b3JkMTIzIQ=='
      };

      // Make multiple requests quickly to trigger rate limiting
      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .post('/auth/login')
            .send(credentials)
        );
      }

      const responses = await Promise.all(requests);
      
      // At least one response should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 10000); // Increase timeout for this test

    test('should validate input data', async () => {
      const invalidData = {
        email: '', // Missing email
        password: '', // Missing password
        firstName: '',
        lastName: '',
        role: 'INVALID_ROLE'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toBeDefined();
      expect(response.body.error.details.length).toBeGreaterThan(0);
    });

  });

  describe('Password Security', () => {
    
    test('should hash passwords securely', async () => {
      const user = await userService.createUser({
        email: 'password-test@example.com',
        password: 'TestPassword123!',
        firstName: 'Password',
        lastName: 'Test',
        role: 'PATIENT'
      });

      // Password hash should not be returned in user object
      expect(user.passwordHash).toBeUndefined();
      
      // But authentication should still work
      const authResult = await userService.authenticateUser(
        {
          email: 'password-test@example.com',
          password: 'TestPassword123!'
        },
        '127.0.0.1',
        'test-agent'
      );

      expect(authResult.success).toBe(true);
    });

    test('should enforce strong password policy', () => {
      const weakPasswords = [
        'short',           // Too short
        'nouppercase123!', // No uppercase
        'NOLOWERCASE123!', // No lowercase
        'NoNumbers!',      // No numbers
        'NoSpecialChars123' // No special characters
      ];

      weakPasswords.forEach(password => {
        expect(() => {
          userService.validatePassword(password);
        }).toThrow();
      });
    });

  });

  describe('Audit Logging', () => {
    
    test('should log authentication events', async () => {
      const initialLogCount = userService.getAuditLogs().length;
      
      // Create user (should generate log)
      await userService.createUser({
        email: 'audit-test@example.com',
        password: 'TestPassword123!',
        firstName: 'Audit',
        lastName: 'Test',
        role: 'PATIENT'
      });

      // Authenticate user (should generate log)
      await userService.authenticateUser(
        {
          email: 'audit-test@example.com',
          password: 'TestPassword123!'
        },
        '127.0.0.1',
        'test-agent'
      );

      const finalLogCount = userService.getAuditLogs().length;
      expect(finalLogCount).toBeGreaterThan(initialLogCount);
      
      // Check that audit logs contain required fields
      const logs = userService.getAuditLogs();
      const latestLog = logs[logs.length - 1];
      
      expect(latestLog.id).toBeDefined();
      expect(latestLog.eventType).toBeDefined();
      expect(latestLog.timestamp).toBeDefined();
      expect(latestLog.ipAddress).toBeDefined();
      expect(latestLog.userAgent).toBeDefined();
      expect(latestLog.success).toBeDefined();
      
      // Verify sensitive data is not logged
      expect(latestLog.details.password).toBeUndefined();
      expect(latestLog.details.passwordHash).toBeUndefined();
    });

  });

});

// Export for CI/CD integration
module.exports = {
  testSuite: 'HIPAA-Compliant Authentication System',
  coverage: {
    userRegistration: true,
    userAuthentication: true,
    sessionManagement: true,
    securityFeatures: true,
    passwordSecurity: true,
    auditLogging: true
  }
};