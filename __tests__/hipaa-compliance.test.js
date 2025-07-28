/**
 * HIPAA Compliance Test Suite
 * Tests for security and compliance features
 */

// Set up environment variables for testing
process.env.JWT_SECRET = 'test-jwt-secret-for-hipaa-compliance-testing-minimum-32-chars';
process.env.SESSION_SECRET = 'test-session-secret-for-testing';
process.env.ENCRYPTION_KEY = 'dGVzdC1lbmNyeXB0aW9uLWtleS1mb3ItdGVzdGluZw==';
process.env.AUDIT_LOG_DIR = './logs/audit';
process.env.AUDIT_LOG_RETENTION_DAYS = '2555';
process.env.NODE_ENV = 'test';
process.env.OAUTH2_CLIENT_ID = 'test-client-id';
process.env.OAUTH2_CLIENT_SECRET = 'test-client-secret';

const encryption = require('../security/encryption');
const auditLogger = require('../security/auditLogger');
const complianceValidator = require('../security/complianceValidator');
const auth = require('../security/authentication');

describe('HIPAA Compliance Features', () => {
  describe('Encryption', () => {
    test('should encrypt and decrypt PHI data correctly', () => {
      const sensitiveData = 'Patient John Doe, DOB: 01/01/1980, SSN: 123-45-6789';
      const context = 'PHI_TEST';
      
      const encrypted = encryption.encryptPHI(sensitiveData, context);
      
      expect(encrypted).toBeDefined();
      expect(encrypted.encrypted).toBeDefined();
      expect(encrypted.salt).toBeDefined();
      expect(encrypted.authTag).toBeDefined();
      expect(encrypted.algorithm).toBe('aes-256-gcm');
      
      const decrypted = encryption.decryptPHI(encrypted, context);
      expect(decrypted).toBe(sensitiveData);
    });

    test('should generate secure tokens', () => {
      const token1 = encryption.generateSecureToken();
      const token2 = encryption.generateSecureToken();
      
      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(64); // 32 bytes = 64 hex chars
    });

    test('should hash and verify passwords securely', () => {
      const password = 'SecurePassword123!';
      const hash = encryption.hashSensitive(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      
      const isValid = encryption.verifySensitive(password, hash);
      expect(isValid).toBe(true);
      
      const isInvalid = encryption.verifySensitive('wrongpassword', hash);
      expect(isInvalid).toBe(false);
    });

    test('should create and verify HMAC signatures', () => {
      const data = 'Important healthcare data';
      const signature = encryption.createSignature(data);
      
      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      
      const isValid = encryption.verifySignature(data, signature);
      expect(isValid).toBe(true);
      
      const isInvalid = encryption.verifySignature('tampered data', signature);
      expect(isInvalid).toBe(false);
    });
  });

  describe('Audit Logging', () => {
    test('should log user actions', async () => {
      const auditData = {
        userId: 'test-user-123',
        userRole: 'provider',
        sessionId: 'test-session-456',
        action: 'PATIENT_RECORD_ACCESS',
        resource: 'patient_record',
        resourceId: 'patient-789',
        ipAddress: '192.168.1.100',
        userAgent: 'Test User Agent',
        requestId: 'req-123',
        outcome: 'SUCCESS'
      };

      // This should not throw an error
      await expect(auditLogger.logUserAction(auditData)).resolves.not.toThrow();
    });

    test('should log PHI access', async () => {
      const phiData = {
        userId: 'test-provider-123',
        userRole: 'provider',
        sessionId: 'test-session-789',
        action: 'READ',
        patientId: 'patient-456',
        dataType: 'MEDICAL_RECORD',
        accessReason: 'Patient appointment',
        ipAddress: '10.0.0.100',
        userAgent: 'Test PHI Access',
        requestId: 'req-456'
      };

      // This should not throw an error
      await expect(auditLogger.logPHIAccess(phiData)).resolves.not.toThrow();
    });

    test('should log security events', async () => {
      const securityData = {
        event: 'FAILED_LOGIN_ATTEMPT',
        userId: 'test-user-123',
        ipAddress: '192.168.1.100',
        userAgent: 'Test Security Event',
        outcome: 'FAILURE',
        severity: 'WARNING',
        details: { reason: 'Invalid password' }
      };

      // This should not throw an error
      await expect(auditLogger.logSecurityEvent(securityData)).resolves.not.toThrow();
    });

    test('should log system events', async () => {
      const eventData = {
        event: 'DATABASE_CONNECTION',
        component: 'Database',
        outcome: 'SUCCESS',
        details: { connectionTime: '125ms' }
      };

      // This should not throw an error
      await expect(auditLogger.logSystemEvent(eventData)).resolves.not.toThrow();
    });
  });

  describe('Authentication', () => {
    test('should generate JWT tokens', () => {
      const user = {
        id: 'test-user-123',
        role: 'provider',
        permissions: ['read:patient_data', 'write:patient_data']
      };

      const tokens = auth.generateTokens(user);
      
      expect(tokens).toBeDefined();
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.tokenType).toBe('Bearer');
      expect(tokens.expiresIn).toBe(1800); // 30 minutes
    });

    test('should sanitize user data', () => {
      const user = {
        id: 'test-user-123',
        username: 'test.user@example.com',
        passwordHash: '$2b$12$hashedpassword',
        role: 'provider',
        active: true
      };

      const sanitized = auth.sanitizeUser(user);
      
      expect(sanitized).toBeDefined();
      expect(sanitized.id).toBe(user.id);
      expect(sanitized.username).toBe(user.username);
      expect(sanitized.role).toBe(user.role);
      expect(sanitized.passwordHash).toBeUndefined();
    });

    test('should create authentication middleware', () => {
      const middleware = auth.requireAuth(['read:patient_data']);
      
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });
  });

  describe('Compliance Validation', () => {
    test('should run compliance tests', async () => {
      const results = await complianceValidator.runComplianceTests();
      
      expect(results).toBeDefined();
      expect(results.timestamp).toBeDefined();
      expect(results.totalTests).toBeGreaterThan(0);
      expect(results.tests).toBeDefined();
      expect(typeof results.overall).toBe('string');
      expect(['FULLY_COMPLIANT', 'COMPLIANT_WITH_WARNINGS', 'PARTIALLY_COMPLIANT', 'NON_COMPLIANT'])
        .toContain(results.overall);
    }, 30000); // 30 second timeout for compliance tests

    test('should generate HTML compliance report', async () => {
      await complianceValidator.runComplianceTests();
      const htmlReport = complianceValidator.generateComplianceReport();
      
      expect(htmlReport).toBeDefined();
      expect(typeof htmlReport).toBe('string');
      expect(htmlReport).toContain('<!DOCTYPE html>');
      expect(htmlReport).toContain('HIPAA Compliance Report');
      expect(htmlReport).toContain('Overall Compliance Status');
    });

    test('should validate individual compliance checks', async () => {
      const validator = complianceValidator;
      
      // Test encryption at rest
      const encryptionResult = await validator.testEncryptionAtRest();
      expect(encryptionResult).toBeDefined();
      expect(encryptionResult.status).toBeDefined();
      expect(['PASS', 'FAIL', 'WARNING']).toContain(encryptionResult.status);
      
      // Test access control
      const accessControlResult = await validator.testAccessControl();
      expect(accessControlResult).toBeDefined();
      expect(accessControlResult.status).toBeDefined();
      expect(['PASS', 'FAIL', 'WARNING']).toContain(accessControlResult.status);
      
      // Test audit logging
      const auditResult = await validator.testAuditLogging();
      expect(auditResult).toBeDefined();
      expect(auditResult.status).toBeDefined();
      expect(['PASS', 'FAIL', 'WARNING']).toContain(auditResult.status);
    });
  });

  describe('Security Headers and Middleware', () => {
    test('should load security middleware without errors', () => {
      expect(() => {
        const security = require('../middleware/security');
        expect(security).toBeDefined();
        expect(security.securityHeaders).toBeDefined();
        expect(security.generalRateLimit).toBeDefined();
        expect(security.authRateLimit).toBeDefined();
        expect(security.apiRateLimit).toBeDefined();
        expect(security.cors).toBeDefined();
        expect(security.compression).toBeDefined();
        expect(security.securityErrorHandler).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('FHIR Integration', () => {
    test('should load FHIR service without errors', () => {
      expect(() => {
        const fhirService = require('../services/fhirService');
        expect(fhirService).toBeDefined();
        expect(typeof fhirService.generateMRN).toBe('function');
        expect(typeof fhirService.getLanguageDisplay).toBe('function');
      }).not.toThrow();
    });

    test('should generate medical record numbers', () => {
      const fhirService = require('../services/fhirService');
      const mrn1 = fhirService.generateMRN();
      const mrn2 = fhirService.generateMRN();
      
      expect(mrn1).toBeDefined();
      expect(mrn2).toBeDefined();
      expect(mrn1).not.toBe(mrn2);
      expect(mrn1).toMatch(/^WQX/);
      expect(mrn2).toMatch(/^WQX/);
    });

    test('should handle language display names', () => {
      const fhirService = require('../services/fhirService');
      
      expect(fhirService.getLanguageDisplay('en')).toBe('English');
      expect(fhirService.getLanguageDisplay('es')).toBe('Spanish');
      expect(fhirService.getLanguageDisplay('fr')).toBe('French');
      expect(fhirService.getLanguageDisplay('unknown')).toBe('unknown');
    });
  });
});