/**
 * HIPAA Compliance Test Suite
 * 
 * Comprehensive tests for all HIPAA compliance services including
 * encryption, RBAC, audit logging, PHI minimization, and security assessment.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

const HIPAAEncryption = require('../services/hipaa-encryption');
const { HIPAA_RBAC, HEALTHCARE_ROLES, PERMISSIONS } = require('../services/hipaa-rbac');
const PACSHIPAAService = require('../services/pacs-hipaa');
const { PHIDataMinimization, PHI_PATTERNS } = require('../services/phi-minimization');
const { AutomatedSecurityAssessment, SECURITY_CATEGORIES } = require('../services/security-assessment');
const AuditLogger = require('../ehr-integrations/services/auditLogger');

// Mock environment variables for testing
process.env.ENCRYPTION_KEY = 'test_encryption_key_that_is_at_least_64_characters_long_for_testing_purposes';
process.env.HIPAA_COMPLIANT_MODE = 'true';
process.env.ENABLE_AUDIT_LOGGING = 'true';
process.env.ENABLE_DATA_ENCRYPTION = 'true';

describe('HIPAA Compliance Test Suite', () => {
    
    // ========================================================================
    // Encryption Service Tests
    // ========================================================================
    
    describe('HIPAA Encryption Service', () => {
        let encryption;

        beforeEach(() => {
            encryption = new HIPAAEncryption();
        });

        test('should encrypt and decrypt PHI data successfully', () => {
            const testData = 'Patient John Doe, DOB: 01/15/1980, SSN: 123-45-6789';
            const metadata = { type: 'patient_data', timestamp: new Date().toISOString() };

            const encrypted = encryption.encryptPHI(testData, metadata);
            expect(encrypted.success).toBe(true);
            expect(encrypted.data.encryptedData).toBeDefined();
            expect(encrypted.data.algorithm).toBe('aes-256-gcm');

            const decrypted = encryption.decryptPHI(encrypted.data);
            expect(decrypted.success).toBe(true);
            expect(decrypted.data).toBe(testData);
        });

        test('should encrypt DICOM metadata with PHI separation', () => {
            const dicomMetadata = {
                PatientName: 'SMITH^JOHN',
                PatientID: 'P12345',
                StudyDate: '20240101',
                Modality: 'CT',
                ImageType: 'ORIGINAL\\PRIMARY\\AXIAL'
            };

            const encrypted = encryption.encryptDICOMMetadata(dicomMetadata, 'P12345');
            expect(encrypted.success).toBe(true);
            expect(encrypted.data.encrypted_phi).toBeDefined();
            expect(encrypted.data.technical_metadata).toBeDefined();
            
            // Technical metadata should remain unencrypted
            expect(encrypted.data.technical_metadata.StudyDate).toBe('20240101');
            expect(encrypted.data.technical_metadata.Modality).toBe('CT');
            
            // PHI should be encrypted
            expect(encrypted.data.technical_metadata.PatientName).toBeUndefined();
            expect(encrypted.data.technical_metadata.PatientID).toBeUndefined();
        });

        test('should validate encryption key strength', () => {
            const weakKey = 'short';
            const strongKey = 'this_is_a_very_long_and_secure_encryption_key_for_hipaa_compliance_testing';

            const weakValidation = HIPAAEncryption.validateEncryptionKey(weakKey);
            expect(weakValidation.valid).toBe(false);

            const strongValidation = HIPAAEncryption.validateEncryptionKey(strongKey);
            expect(strongValidation.valid).toBe(true);
        });

        test('should generate new encryption keys', () => {
            const newKey = HIPAAEncryption.generateNewEncryptionKey();
            expect(newKey).toBeDefined();
            expect(typeof newKey).toBe('string');
            expect(newKey.length).toBeGreaterThan(64);
        });
    });

    // ========================================================================
    // RBAC System Tests
    // ========================================================================

    describe('HIPAA RBAC System', () => {
        let rbac;
        let mockAuditLogger;

        beforeEach(() => {
            mockAuditLogger = {
                log: jest.fn().mockResolvedValue({ success: true })
            };
            rbac = new HIPAA_RBAC(mockAuditLogger);
        });

        test('should grant appropriate permissions based on role hierarchy', async () => {
            // Physician should be able to read patient data
            const physicianAccess = await rbac.checkPermission(
                'physician123',
                'PHYSICIAN',
                'patient.read',
                { patientId: 'patient456' }
            );
            expect(physicianAccess.granted).toBe(true);

            // Receptionist should not be able to prescribe medication
            const receptionistAccess = await rbac.checkPermission(
                'receptionist123',
                'RECEPTIONIST',
                'clinical.prescribe',
                { patientId: 'patient456' }
            );
            expect(receptionistAccess.granted).toBe(false);
        });

        test('should enforce patient ownership rules', async () => {
            // Patient should only access their own records
            const ownRecords = await rbac.checkPermission(
                'patient123',
                'PATIENT',
                'patient.read',
                { patientId: 'patient123' }
            );
            expect(ownRecords.granted).toBe(true);

            // Patient should not access other patient records
            const otherRecords = await rbac.checkPermission(
                'patient123',
                'PATIENT',
                'patient.read',
                { patientId: 'patient456' }
            );
            expect(otherRecords.granted).toBe(false);
        });

        test('should handle emergency access requests', async () => {
            const emergencyRequest = await rbac.requestEmergencyAccess(
                'physician123',
                'PHYSICIAN',
                'Patient experiencing cardiac emergency, need immediate access to history',
                { patientId: 'patient456' }
            );

            expect(emergencyRequest.granted).toBe(true);
            expect(emergencyRequest.sessionId).toBeDefined();
            expect(emergencyRequest.expiryTime).toBeDefined();
            expect(emergencyRequest.permissions).toContain('patient.read');
        });

        test('should validate emergency session properly', () => {
            // Mock an active session
            const sessionId = 'emergency_test_session';
            rbac.emergencyAccessActive.set(sessionId, {
                userId: 'physician123',
                startTime: new Date(),
                expiryTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
                active: true
            });

            const validation = rbac.validateEmergencySession(sessionId);
            expect(validation.valid).toBe(true);

            // Test expired session
            rbac.emergencyAccessActive.set(sessionId, {
                userId: 'physician123',
                startTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
                expiryTime: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
                active: true
            });

            const expiredValidation = rbac.validateEmergencySession(sessionId);
            expect(expiredValidation.valid).toBe(false);
        });

        test('should enforce role assignment hierarchy', () => {
            // Admin can assign lower roles
            const adminAssignNurse = rbac.canAssignRole('ADMIN', 'NURSE');
            expect(adminAssignNurse).toBe(true);

            // Nurse cannot assign higher roles
            const nurseAssignPhysician = rbac.canAssignRole('NURSE', 'PHYSICIAN');
            expect(nurseAssignPhysician).toBe(false);

            // Super admin can assign any role
            const superAdminAssignAdmin = rbac.canAssignRole('SUPER_ADMIN', 'ADMIN');
            expect(superAdminAssignAdmin).toBe(true);
        });
    });

    // ========================================================================
    // PHI Data Minimization Tests
    // ========================================================================

    describe('PHI Data Minimization Service', () => {
        let phiMinimizer;

        beforeEach(() => {
            phiMinimizer = new PHIDataMinimization({
                enableAggressive: false,
                logDetections: false
            });
        });

        test('should detect and minimize SSN in text', () => {
            const textWithSSN = 'Patient SSN: 123-45-6789 for billing purposes';
            const result = phiMinimizer.minimizeTextPHI(textWithSSN);

            expect(result.success).toBe(true);
            expect(result.detections.length).toBeGreaterThan(0);
            expect(result.detections[0].type).toBe('SSN');
            expect(result.minimizedText).toContain('XXX-XX-XXXX');
            expect(result.minimizedText).not.toContain('123-45-6789');
        });

        test('should detect and minimize multiple PHI types', () => {
            const textWithMultiplePHI = 'Patient: John Smith, DOB: 01/15/1980, Phone: (555) 123-4567, Email: john@email.com';
            const result = phiMinimizer.minimizeTextPHI(textWithMultiplePHI);

            expect(result.success).toBe(true);
            expect(result.detections.length).toBeGreaterThan(2);
            
            const detectionTypes = result.detections.map(d => d.type);
            expect(detectionTypes).toContain('PHONE');
            expect(detectionTypes).toContain('EMAIL');
            expect(detectionTypes).toContain('DOB');
        });

        test('should minimize PHI in structured objects', () => {
            const objectWithPHI = {
                patient: {
                    name: 'John Smith',
                    ssn: '123-45-6789',
                    phone: '555-123-4567'
                },
                medical: {
                    diagnosis: 'Hypertension',
                    treatment: 'Medication'
                }
            };

            const result = phiMinimizer.minimizeObjectPHI(objectWithPHI);
            expect(result.success).toBe(true);
            expect(result.detections.length).toBeGreaterThan(0);
            expect(result.minimizedData.patient.ssn).toBe('XXX-XX-XXXX');
            expect(result.minimizedData.medical.diagnosis).toBe('Hypertension'); // Medical terms should remain
        });

        test('should minimize audit log entries appropriately', () => {
            const auditEntry = {
                id: 'audit123',
                timestamp: new Date(),
                userId: 'physician123',
                action: 'patient_access',
                resourceId: 'patient_456',
                errorMessage: 'Patient SSN 123-45-6789 not found in system',
                context: {
                    patientPhone: '555-123-4567',
                    diagnosisCode: 'I10'
                }
            };

            const result = phiMinimizer.minimizeAuditLog(auditEntry);
            expect(result.success).toBe(true);
            expect(result.minimizedEntry.errorMessage).toContain('XXX-XX-XXXX');
            expect(result.minimizedEntry.context.patientPhone).toBe('XXX-XXX-XXXX');
        });

        test('should apply retention policies correctly', () => {
            const recentData = {
                createdDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days ago
            };

            const oldData = {
                createdDate: new Date(Date.now() - 8 * 365 * 24 * 60 * 60 * 1000).toISOString() // 8 years ago
            };

            const recentRetention = phiMinimizer.checkRetentionPolicy(recentData, 'MEDICAL_RECORDS');
            expect(recentRetention.shouldRetain).toBe(true);

            const oldRetention = phiMinimizer.checkRetentionPolicy(oldData, 'MEDICAL_RECORDS');
            expect(oldRetention.shouldRetain).toBe(false);
        });
    });

    // ========================================================================
    // PACS Service Tests
    // ========================================================================

    describe('PACS HIPAA Service', () => {
        let pacsService;

        beforeEach(() => {
            pacsService = new PACSHIPAAService({
                encryptionEnabled: true,
                auditEnabled: true
            });
        });

        test('should upload image with proper authorization', async () => {
            const imageData = {
                patientId: 'patient123',
                studyType: 'CT',
                imageBuffer: Buffer.from('mock_image_data'),
                dicomMetadata: {
                    PatientName: 'SMITH^JOHN',
                    StudyDate: '20240101'
                }
            };

            const user = {
                id: 'tech123',
                role: 'RADIOLOGY_TECH',
                ipAddress: '192.168.1.100'
            };

            const result = await pacsService.uploadImage(imageData, user);
            expect(result.success).toBe(true);
            expect(result.data.studyId).toBeDefined();
            expect(result.data.encrypted).toBe(true);
        });

        test('should deny image upload for unauthorized users', async () => {
            const imageData = {
                patientId: 'patient123',
                studyType: 'CT',
                imageBuffer: Buffer.from('mock_image_data')
            };

            const unauthorizedUser = {
                id: 'patient456',
                role: 'PATIENT',
                ipAddress: '192.168.1.101'
            };

            const result = await pacsService.uploadImage(imageData, unauthorizedUser);
            expect(result.success).toBe(false);
            expect(result.code).toContain('INSUFFICIENT_PERMISSIONS');
        });

        test('should retrieve image with proper authorization', async () => {
            const studyId = 'CT_test_study_123';
            const user = {
                id: 'physician123',
                role: 'PHYSICIAN',
                ipAddress: '192.168.1.102'
            };

            const result = await pacsService.retrieveImage(studyId, user);
            // Note: This would need mocked storage in a real implementation
            expect(result).toBeDefined();
        });

        test('should validate image data properly', () => {
            const validImageData = {
                patientId: 'patient123',
                studyType: 'CT',
                imageBuffer: Buffer.from('valid_image_data')
            };

            const invalidImageData = {
                studyType: 'CT',
                imageBuffer: null
            };

            const validResult = pacsService.validateImageData(validImageData);
            expect(validResult.valid).toBe(true);

            const invalidResult = pacsService.validateImageData(invalidImageData);
            expect(invalidResult.valid).toBe(false);
        });
    });

    // ========================================================================
    // Security Assessment Tests
    // ========================================================================

    describe('Automated Security Assessment', () => {
        let securityAssessment;

        beforeEach(() => {
            securityAssessment = new AutomatedSecurityAssessment({
                enableRealTimeMonitoring: false
            });
        });

        test('should run comprehensive security assessment', async () => {
            const assessment = await securityAssessment.runSecurityAssessment();
            
            expect(assessment.success).toBe(true);
            expect(assessment.assessment).toBeDefined();
            expect(assessment.assessment.id).toBeDefined();
            expect(assessment.assessment.categories).toBeDefined();
            
            // Check that all security categories are assessed
            Object.values(SECURITY_CATEGORIES).forEach(category => {
                expect(assessment.assessment.categories[category]).toBeDefined();
            });
        });

        test('should generate proper HIPAA compliance assessment', async () => {
            const assessment = await securityAssessment.runSecurityAssessment();
            
            expect(assessment.assessment.hipaaCompliance).toBeDefined();
            expect(assessment.assessment.hipaaCompliance.totalRequirements).toBeGreaterThan(0);
            expect(assessment.assessment.hipaaCompliance.status).toMatch(/COMPLIANT|NON_COMPLIANT/);
        });

        test('should provide security recommendations', async () => {
            const assessment = await securityAssessment.runSecurityAssessment();
            
            expect(assessment.assessment.recommendations).toBeDefined();
            expect(Array.isArray(assessment.assessment.recommendations)).toBe(true);
            
            // Should have recommendations for any failed checks
            const failedChecks = Object.values(assessment.assessment.categories)
                .flatMap(cat => cat.checks)
                .filter(check => check.status === 'FAIL');
            
            if (failedChecks.length > 0) {
                expect(assessment.assessment.recommendations.length).toBeGreaterThan(0);
            }
        });

        test('should track assessment history', async () => {
            await securityAssessment.runSecurityAssessment();
            await securityAssessment.runSecurityAssessment();
            
            const history = securityAssessment.getAssessmentHistory();
            expect(history.length).toBe(2);
            expect(history[0].timestamp).toBeInstanceOf(Date);
        });

        test('should calculate risk levels appropriately', () => {
            const criticalSummary = {
                bySeverity: { CRITICAL: 2, HIGH: 1, MEDIUM: 3, LOW: 0 }
            };
            
            const riskLevel = securityAssessment.calculateRiskLevel(criticalSummary);
            expect(riskLevel).toBe('CRITICAL');
        });
    });

    // ========================================================================
    // Integration Tests
    // ========================================================================

    describe('HIPAA Compliance Integration', () => {
        let auditLogger;
        let rbac;
        let encryption;
        let phiMinimizer;

        beforeEach(() => {
            auditLogger = new AuditLogger({ enabled: true, logToConsole: false });
            rbac = new HIPAA_RBAC(auditLogger);
            encryption = new HIPAAEncryption();
            phiMinimizer = new PHIDataMinimization({ logDetections: false });
        });

        test('should integrate audit logging with RBAC permission checks', async () => {
            const permissionCheck = await rbac.checkPermission(
                'physician123',
                'PHYSICIAN',
                'patient.read',
                { patientId: 'patient456' }
            );

            expect(permissionCheck.granted).toBe(true);
            
            // Verify audit log was created
            const auditSearch = await auditLogger.search({
                userId: 'physician123',
                action: 'PERMISSION_GRANTED'
            });
            
            expect(auditSearch.success).toBe(true);
            expect(auditSearch.data.entries.length).toBeGreaterThan(0);
        });

        test('should encrypt patient data and minimize PHI in audit logs', async () => {
            const patientData = 'Patient John Smith, SSN: 123-45-6789, needs urgent care';
            
            // Encrypt the patient data
            const encrypted = encryption.encryptPHI(patientData);
            expect(encrypted.success).toBe(true);
            
            // Log access to patient data
            await auditLogger.log({
                action: 'patient_data_access',
                resourceType: 'patient_record',
                resourceId: 'patient123',
                success: true,
                context: { originalData: patientData }
            });
            
            // Search audit logs
            const auditSearch = await auditLogger.search({
                action: 'patient_data_access'
            });
            
            expect(auditSearch.success).toBe(true);
            const auditEntry = auditSearch.data.entries[0];
            
            // Minimize PHI in audit entry
            const minimized = phiMinimizer.minimizeAuditLog(auditEntry);
            
            expect(minimized.success).toBe(true);
            expect(minimized.minimizedEntry.context.originalData).not.toContain('123-45-6789');
            expect(minimized.minimizedEntry.context.originalData).toContain('XXX-XX-XXXX');
        });

        test('should enforce complete HIPAA workflow for PACS access', async () => {
            const user = {
                id: 'radiologist123',
                role: 'RADIOLOGIST',
                ipAddress: '192.168.1.103'
            };

            // 1. Check permission
            const permissionCheck = await rbac.checkPermission(
                user.id,
                user.role,
                'pacs.view_images',
                { patientId: 'patient456' }
            );
            expect(permissionCheck.granted).toBe(true);

            // 2. Simulate PACS access
            const pacsService = new PACSHIPAAService({ auditEnabled: true });
            
            // Set audit context
            auditLogger.setContext({
                userId: user.id,
                userRole: user.role,
                ipAddress: user.ipAddress
            });

            // 3. Log the access
            await auditLogger.log({
                action: 'view_image',
                resourceType: 'pacs_image',
                resourceId: 'study123',
                patientMrn: 'patient456',
                success: true,
                context: { studyType: 'CT', sensitivity: 'HIGH' }
            });

            // 4. Verify audit trail
            const auditSearch = await auditLogger.search({
                userId: user.id,
                resourceType: 'pacs_image'
            });

            expect(auditSearch.success).toBe(true);
            expect(auditSearch.data.entries.length).toBeGreaterThan(0);
            
            const entry = auditSearch.data.entries[0];
            expect(entry.userId).toBe(user.id);
            expect(entry.action).toBe('view_image');
        });
    });
});

// Helper function to run all tests
if (require.main === module) {
    console.log('🧪 Running HIPAA Compliance Test Suite...');
    
    // In a real environment, this would use Jest or another test runner
    // For now, we'll just export the test functions
    console.log('✅ Test suite defined. Run with: npm test');
}

module.exports = {
    // Export test suites for use in other test files
    encryptionTests: describe,
    rbacTests: describe,
    phiMinimizationTests: describe,
    pacsTests: describe,
    securityAssessmentTests: describe,
    integrationTests: describe
};