/**
 * HIPAA Compliance Test Suite
 * 
 * Tests all HIPAA compliance features including:
 * - Strong authentication with 2FA
 * - Role-based access control
 * - Data encryption
 * - Audit logging
 * - Backup and disaster recovery
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

const request = require('supertest');
const { expect } = require('@jest/globals');

// Mock services for testing
const HIPAAAuthService = require('../services/hipaa-auth');
const HIPAARBACService = require('../services/hipaa-rbac');
const HIPAABackupService = require('../services/hipaa-backup');
const HIPAATamperProofAuditService = require('../services/hipaa-audit');

describe('HIPAA Compliance Suite', () => {
    let authService;
    let rbacService;
    let backupService;
    let auditService;

    beforeEach(() => {
        authService = new HIPAAAuthService();
        rbacService = new HIPAARBACService();
        backupService = new HIPAABackupService();
        auditService = new HIPAATamperProofAuditService();
    });

    describe('Authentication and 2FA', () => {
        test('should enforce strong password policy', async () => {
            const weakPasswords = [
                'password',
                '123456',
                'abc123',
                'password123',
                'short'
            ];

            for (const password of weakPasswords) {
                const result = await authService.registerUser({
                    username: 'testuser',
                    email: 'test@example.com',
                    password: password,
                    role: 'PATIENT',
                    firstName: 'Test',
                    lastName: 'User'
                });

                expect(result.success).toBe(false);
                expect(result.error).toBe('PASSWORD_POLICY_VIOLATION');
            }
        });

        test('should accept strong password', async () => {
            const strongPassword = 'StrongP@ssw0rd2024!Complex';
            
            const result = await authService.registerUser({
                username: 'testuser',
                email: 'test@example.com',
                password: strongPassword,
                role: 'PATIENT',
                firstName: 'Test',
                lastName: 'User'
            });

            expect(result.success).toBe(true);
            expect(result.user).toBeDefined();
            expect(result.twoFactorSetup).toBeDefined();
            expect(result.twoFactorSetup.secret).toBeDefined();
            expect(result.twoFactorSetup.qrCode).toBeDefined();
        });

        test('should enforce account lockout after failed attempts', async () => {
            const username = 'lockouttest';
            const password = 'StrongP@ssw0rd2024!Complex';
            
            // Register user first
            await authService.registerUser({
                username,
                email: 'lockout@example.com',
                password,
                role: 'NURSE',
                firstName: 'Lockout',
                lastName: 'Test'
            });

            // Attempt login with wrong password multiple times
            for (let i = 0; i < 6; i++) {
                const result = await authService.authenticate({
                    username,
                    password: 'wrongpassword',
                    ipAddress: '192.168.1.100',
                    userAgent: 'Test Agent'
                });

                if (i < 4) {
                    expect(result.success).toBe(false);
                    expect(result.error).toBe('INVALID_CREDENTIALS');
                } else {
                    expect(result.success).toBe(false);
                    expect(result.error).toBe('ACCOUNT_LOCKED');
                    expect(result.lockoutUntil).toBeDefined();
                }
            }
        });
    });

    describe('Role-Based Access Control (RBAC)', () => {
        test('should assign and verify user roles', async () => {
            const userId = 'user123';
            const roleId = 'DOCTOR';

            const assignResult = await rbacService.assignRole(userId, roleId, {
                assignedBy: 'admin',
                justification: 'Medical practitioner onboarding'
            });

            expect(assignResult.success).toBe(true);
            expect(assignResult.assignment).toBeDefined();

            // Verify user has role
            const userRoles = await rbacService.getUserRoles(userId);
            expect(userRoles.length).toBe(1);
            expect(userRoles[0].roleId).toBe(roleId);
        });

        test('should check permissions correctly', async () => {
            const userId = 'user123';
            const roleId = 'DOCTOR';

            // Assign doctor role
            await rbacService.assignRole(userId, roleId, {
                assignedBy: 'admin'
            });

            // Test permission check for doctor
            const patientReadResult = await rbacService.checkPermission(userId, 'patient.read');
            expect(patientReadResult.granted).toBe(true);

            const adminPermissionResult = await rbacService.checkPermission(userId, 'admin.users');
            expect(adminPermissionResult.granted).toBe(false);
        });

        test('should handle emergency access requests', async () => {
            const userId = 'user123';
            
            // Assign nurse role (level 70, can request emergency access)
            await rbacService.assignRole(userId, 'NURSE', {
                assignedBy: 'admin'
            });

            const emergencyRequest = await rbacService.requestElevatedAccess(userId, 'emergency', {
                justification: 'Critical patient condition requires immediate access',
                requestedPermissions: ['patient.read', 'medical_record.read']
            });

            expect(emergencyRequest.success).toBe(true);
            expect(emergencyRequest.status).toBe('APPROVED'); // Auto-approved for emergency
            expect(emergencyRequest.expiresAt).toBeDefined();
        });
    });

    describe('Tamper-Proof Audit Logging', () => {
        test('should log audit events with integrity protection', async () => {
            const auditEvent = {
                eventType: 'PATIENT_RECORD_VIEWED',
                userId: 'doctor123',
                patientId: 'patient456',
                resourceType: 'Patient',
                resourceId: 'patient456',
                action: 'view',
                outcome: 'success',
                details: {
                    method: 'GET',
                    requestId: 'req123'
                },
                ipAddress: '192.168.1.100',
                userAgent: 'Mozilla/5.0...',
                sessionId: 'sess123'
            };

            const result = await auditService.logEvent(auditEvent);

            expect(result.success).toBe(true);
            expect(result.auditId).toBeDefined();
            expect(result.timestamp).toBeDefined();
            expect(result.chainIndex).toBeDefined();
        });

        test('should verify audit chain integrity', async () => {
            // Log several events to create a chain
            const events = [
                {
                    eventType: 'LOGIN_SUCCESS',
                    userId: 'user1',
                    action: 'login',
                    outcome: 'success'
                },
                {
                    eventType: 'PATIENT_RECORD_VIEWED',
                    userId: 'user1',
                    patientId: 'patient1',
                    action: 'view',
                    outcome: 'success'
                },
                {
                    eventType: 'LOGOUT',
                    userId: 'user1',
                    action: 'logout',
                    outcome: 'success'
                }
            ];

            for (const event of events) {
                await auditService.logEvent(event);
            }

            // Verify chain integrity
            const verificationResult = await auditService.verifyChainIntegrity();

            expect(verificationResult.success).toBe(true);
            expect(verificationResult.verification.verified).toBe(true);
            expect(verificationResult.verification.verifiedEntries).toBeGreaterThan(0);
            expect(verificationResult.verification.signatureFailures).toHaveLength(0);
            expect(verificationResult.verification.chainBreaks).toHaveLength(0);
        });

        test('should generate compliance reports', async () => {
            // Log various events for compliance reporting
            const events = [
                { eventType: 'PATIENT_RECORD_VIEWED', userId: 'doctor1', category: 'patient_access' },
                { eventType: 'SECURITY_ALERT', userId: 'system', category: 'security' },
                { eventType: 'ROLE_ASSIGNED', userId: 'admin1', category: 'administration' }
            ];

            for (const event of events) {
                await auditService.logEvent(event);
            }

            const reportResult = await auditService.generateComplianceReport({
                reportType: 'full',
                includePatientAccess: true,
                includeSecurityEvents: true,
                includeAdminActions: true
            });

            expect(reportResult.success).toBe(true);
            expect(reportResult.report).toBeDefined();
            expect(reportResult.report.summary).toBeDefined();
            expect(reportResult.report.compliance).toBeDefined();
        });
    });

    describe('Data Encryption', () => {
        test('should encrypt and decrypt patient data', async () => {
            const { EncryptionService } = require('../ehr-integrations/utils/encryption');
            const encryptionService = new EncryptionService();

            const sensitiveData = 'Patient SSN: 123-45-6789';
            const encrypted = await encryptionService.encrypt(sensitiveData);

            expect(encrypted).toBeDefined();
            expect(encrypted.data).toBeDefined();
            expect(encrypted.salt).toBeDefined();
            expect(encrypted.iv).toBeDefined();
            expect(encrypted.algorithm).toBe('aes-256-gcm');

            const decrypted = await encryptionService.decrypt(encrypted);
            expect(decrypted).toBe(sensitiveData);
        });
    });

    describe('Backup and Disaster Recovery', () => {
        test('should create backup successfully', async () => {
            const backupOptions = {
                type: 'manual',
                dataTypes: ['patient_data', 'audit_logs'],
                priority: 'high',
                description: 'Test backup for compliance verification'
            };

            const result = await backupService.createBackup(backupOptions);

            expect(result.success).toBe(true);
            expect(result.backupId).toBeDefined();
            expect(result.details.dataTypes).toEqual(backupOptions.dataTypes);
            expect(result.details.totalSize).toBeGreaterThan(0);
            expect(result.details.compressedSize).toBeGreaterThan(0);
            expect(result.details.duration).toBeGreaterThan(0);
        });

        test('should get backup status', async () => {
            const result = await backupService.getBackupStatus();

            expect(result.success).toBe(true);
            expect(result.status).toBeDefined();
            expect(result.status.overallHealth).toBeDefined();
            expect(result.status.statistics).toBeDefined();
            expect(result.status.storage).toBeDefined();
            expect(result.status.verification).toBeDefined();
        });
    });
});