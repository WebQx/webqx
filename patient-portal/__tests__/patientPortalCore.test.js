/**
 * Core Patient Portal Authentication Tests
 * Focus on email/phone login and MFA functionality
 */

const { authenticateUser, registerUser, getUserById, updateUserMFA, getUserByEmail } = require('../auth/userService');
const { generateAndSendOTP, verifyOTP, getOTPStatus } = require('../auth/mfaService');

// Mock environment variables
process.env.JWT_SECRET = 'test-secret-key-for-patient-portal-testing';

describe('Patient Portal Core Authentication', () => {
    describe('User Registration with Phone Number', () => {
        test('should register user with valid phone number', async () => {
            const userData = {
                name: 'Test Patient',
                email: 'testpatient1@example.com',
                password: 'SecurePass123',
                phoneNumber: '+1234567890'
            };

            const result = await registerUser(userData);

            expect(result.success).toBe(true);
            expect(result.user.phoneNumber).toBe('+1234567890');
            expect(result.user.mfaEnabled).toBe(false);
        });

        test('should register user without phone number', async () => {
            const userData = {
                name: 'Test Patient No Phone',
                email: 'nophone1@example.com',
                password: 'SecurePass123'
            };

            const result = await registerUser(userData);

            expect(result.success).toBe(true);
            expect(result.user.phoneNumber).toBeNull();
            expect(result.user.mfaEnabled).toBe(false);
        });

        test('should reject invalid email format', async () => {
            const userData = {
                name: 'Test Patient',
                email: 'invalid-email',
                password: 'SecurePass123'
            };

            const result = await registerUser(userData);

            expect(result.success).toBe(false);
            expect(result.code).toBe('INVALID_EMAIL');
        });

        test('should reject weak password', async () => {
            const userData = {
                name: 'Test Patient',
                email: 'weak@example.com',
                password: '123'
            };

            const result = await registerUser(userData);

            expect(result.success).toBe(false);
            expect(result.code).toBe('WEAK_PASSWORD');
        });

        test('should reject invalid phone number format', async () => {
            const userData = {
                name: 'Test Patient',
                email: 'invalidphone@example.com',
                password: 'SecurePass123',
                phoneNumber: '123-456-7890' // Invalid E.164 format
            };

            const result = await registerUser(userData);

            expect(result.success).toBe(false);
            expect(result.code).toBe('INVALID_PHONE');
        });
    });

    describe('User Authentication', () => {
        beforeAll(async () => {
            // Create test users
            await registerUser({
                name: 'Auth Test User',
                email: 'authtest@example.com',
                password: 'SecurePass123',
                phoneNumber: '+1987654321'
            });
        });

        test('should authenticate user with correct credentials', async () => {
            const result = await authenticateUser('authtest@example.com', 'SecurePass123');

            expect(result.success).toBe(true);
            expect(result.user.email).toBe('authtest@example.com');
            expect(result.user.phoneNumber).toBe('+1987654321');
            expect(result.token).toBeDefined();
        });

        test('should reject invalid credentials', async () => {
            const result = await authenticateUser('authtest@example.com', 'wrongpassword');

            expect(result.success).toBe(false);
            expect(result.code).toBe('INVALID_CREDENTIALS');
        });

        test('should reject non-existent user', async () => {
            const result = await authenticateUser('nonexistent@example.com', 'password');

            expect(result.success).toBe(false);
            expect(result.code).toBe('INVALID_CREDENTIALS');
        });
    });

    describe('MFA Functionality', () => {
        let testUser;

        beforeAll(async () => {
            const result = await registerUser({
                name: 'MFA Test User',
                email: 'mfatest@example.com',
                password: 'SecurePass123',
                phoneNumber: '+1555123456'
            });
            testUser = result.user;
        });

        test('should enable MFA for user', () => {
            const result = updateUserMFA(testUser.id, true);

            expect(result.success).toBe(true);
            expect(result.user.mfaEnabled).toBe(true);
        });

        test('should disable MFA for user', () => {
            const result = updateUserMFA(testUser.id, false);

            expect(result.success).toBe(true);
            expect(result.user.mfaEnabled).toBe(false);
        });

        test('should generate OTP for user with phone number', async () => {
            const result = await generateAndSendOTP(testUser.email);

            expect(result.success).toBe(true);
            expect(result.message).toBe('OTP sent successfully');
            expect(result.phoneNumber).toMatch(/^\+\d{1,3}\*\*\*\*\d{4}$/);
            expect(result.expiresAt).toBeDefined();
        });

        test('should fail to generate OTP for user without phone', async () => {
            const result = await generateAndSendOTP('nophone1@example.com');

            expect(result.success).toBe(false);
            expect(result.code).toBe('NO_PHONE_NUMBER');
        });

        test('should track OTP status', async () => {
            await generateAndSendOTP(testUser.email);
            const status = getOTPStatus(testUser.id);

            expect(status.exists).toBe(true);
            expect(status.attempts).toBe(0);
            expect(status.maxAttempts).toBe(3);
            expect(status.isExpired).toBe(false);
        });

        test('should reject invalid OTP', () => {
            const result = verifyOTP(testUser.id, '000000');

            expect(result.success).toBe(false);
            expect(result.code).toBe('INVALID_OTP');
            expect(result.attemptsRemaining).toBe(2);
        });

        test('should reject OTP for non-existent user', () => {
            const result = verifyOTP('non-existent-id', '123456');

            expect(result.success).toBe(false);
            expect(result.code).toBe('OTP_NOT_FOUND');
        });
    });

    describe('User Management', () => {
        let testUser;

        beforeAll(async () => {
            const result = await registerUser({
                name: 'User Mgmt Test',
                email: 'usermgmt@example.com',
                password: 'SecurePass123',
                phoneNumber: '+1444555666'
            });
            testUser = result.user;
        });

        test('should get user by ID', () => {
            const user = getUserById(testUser.id);

            expect(user).toBeDefined();
            expect(user.email).toBe('usermgmt@example.com');
            expect(user.phoneNumber).toBe('+1444555666');
        });

        test('should get user by email', () => {
            const user = getUserByEmail('usermgmt@example.com');

            expect(user).toBeDefined();
            expect(user.id).toBe(testUser.id);
            expect(user.phoneNumber).toBe('+1444555666');
        });

        test('should return null for non-existent user ID', () => {
            const user = getUserById('non-existent-id');
            expect(user).toBeNull();
        });

        test('should return null for non-existent email', () => {
            const user = getUserByEmail('nonexistent@example.com');
            expect(user).toBeNull();
        });
    });
});

describe('SMS Service Integration', () => {
    const smsService = require('../services/smsService');

    test('should format phone number correctly', () => {
        expect(smsService.formatPhoneNumber('1234567890')).toBe('+11234567890');
        expect(smsService.formatPhoneNumber('+11234567890')).toBe('+11234567890');
        expect(smsService.formatPhoneNumber('11234567890')).toBe('+11234567890');
    });

    test('should send appointment confirmation SMS', async () => {
        const appointmentData = {
            patientPhone: '+1234567890',
            doctorName: 'Dr. Smith',
            appointmentDate: '2024-02-15',
            appointmentTime: '2:00 PM',
            location: 'Main Clinic',
            appointmentId: 'apt-123'
        };

        const result = await smsService.sendAppointmentConfirmation(appointmentData);
        
        expect(result.success).toBe(true);
        expect(result.trackingId).toBeDefined();
        expect(result.message).toBe('Appointment confirmation sent');
    });

    test('should send secure message alert', async () => {
        const messageData = {
            patientPhone: '+1234567890',
            senderName: 'Dr. Johnson',
            portalUrl: 'https://portal.webqx.health',
            messageId: 'msg-456'
        };

        const result = await smsService.sendSecureMessageAlert(messageData);
        
        expect(result.success).toBe(true);
        expect(result.trackingId).toBeDefined();
    });

    test('should track message delivery status', async () => {
        const appointmentData = {
            patientPhone: '+1234567890',
            doctorName: 'Dr. Brown',
            appointmentDate: '2024-02-20',
            appointmentTime: '10:00 AM',
            location: 'Specialty Clinic',
            appointmentId: 'apt-789'
        };

        const result = await smsService.sendAppointmentConfirmation(appointmentData);
        const status = smsService.getMessageStatus(result.trackingId);
        
        expect(status.found).toBe(true);
        expect(status.type).toBe('appointment_confirmation');
        expect(status.status).toBe('sent');
    });

    test('should calculate message statistics', async () => {
        const stats = smsService.getMessageStats();
        
        expect(stats.total).toBeGreaterThan(0);
        expect(stats.sent).toBeGreaterThan(0);
        expect(stats.successRate).toBeDefined();
        expect(stats.byType).toBeDefined();
        expect(stats.byPriority).toBeDefined();
    });
});