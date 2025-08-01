const TelehealthSessionService = require('../services/sessionService');

describe('Telehealth Session Service', () => {
    let sessionService;

    beforeEach(() => {
        sessionService = new TelehealthSessionService({
            linkExpirationMinutes: 60,
            sessionDurationMinutes: 120,
            enableConsent: true,
            baseUrl: 'https://test.webqx.health'
        });
    });

    describe('Session Creation', () => {
        test('should create a new telehealth session', async () => {
            const sessionData = {
                patientId: 'patient-123',
                providerId: 'provider-456',
                sessionType: 'consultation',
                specialty: 'cardiology',
                patientEmail: 'patient@example.com'
            };

            const result = await sessionService.createSession(sessionData);

            expect(result.sessionId).toBeDefined();
            expect(result.accessLink).toBeDefined();
            expect(result.accessLink).toContain('https://test.webqx.health/telehealth/join');
            expect(result.expiresAt).toBeDefined();
            expect(result.consentRequired).toBe(true);
            expect(result.status).toBe('scheduled');
        });

        test('should fail without required fields', async () => {
            const sessionData = {
                // Missing patientId and providerId
                sessionType: 'consultation'
            };

            await expect(sessionService.createSession(sessionData))
                .rejects.toThrow('Patient ID and Provider ID are required');
        });

        test('should create session with consent disabled', async () => {
            const noConsentService = new TelehealthSessionService({
                enableConsent: false
            });

            const sessionData = {
                patientId: 'patient-123',
                providerId: 'provider-456'
            };

            const result = await noConsentService.createSession(sessionData);

            expect(result.consentRequired).toBe(false);
        });
    });

    describe('Session Access Validation', () => {
        test('should validate a valid session access link', async () => {
            // Create a session first
            const sessionData = {
                patientId: 'patient-123',
                providerId: 'provider-456'
            };

            const createResult = await sessionService.createSession(sessionData);
            
            // Extract access token from link
            const url = new URL(createResult.accessLink);
            const accessToken = url.searchParams.get('access');

            // Validate access
            const validation = await sessionService.validateSessionAccess(accessToken);

            expect(validation.valid).toBe(true);
            expect(validation.session.id).toBe(createResult.sessionId);
            expect(validation.session.patientId).toBe('patient-123');
            expect(validation.session.providerId).toBe('provider-456');
        });

        test('should reject invalid access token', async () => {
            const validation = await sessionService.validateSessionAccess('invalid-token');

            expect(validation.valid).toBe(false);
            expect(validation.error).toBeDefined();
            expect(validation.code).toBe('INVALID_FORMAT');
        });

        test('should reject expired session link', async () => {
            // Create a service with very short expiration
            const shortExpiryService = new TelehealthSessionService({
                linkExpirationMinutes: 0.001 // ~60ms
            });

            const sessionData = {
                patientId: 'patient-123',
                providerId: 'provider-456'
            };

            const createResult = await shortExpiryService.createSession(sessionData);
            
            // Wait for expiration
            await new Promise(resolve => setTimeout(resolve, 100));

            const url = new URL(createResult.accessLink);
            const accessToken = url.searchParams.get('access');

            const validation = await shortExpiryService.validateSessionAccess(accessToken);

            expect(validation.valid).toBe(false);
            expect(validation.code).toBe('LINK_EXPIRED');
        });
    });

    describe('Consent Management', () => {
        test('should record patient consent', async () => {
            const sessionData = {
                patientId: 'patient-123',
                providerId: 'provider-456'
            };

            const createResult = await sessionService.createSession(sessionData);
            
            const consentData = {
                method: 'electronic',
                ipAddress: '192.168.1.1',
                userAgent: 'Mozilla/5.0...',
                patientName: 'John Doe'
            };

            const consentResult = await sessionService.recordConsent(createResult.sessionId, consentData);

            expect(consentResult.consentId).toBeDefined();
            expect(consentResult.status).toBe('recorded');
            expect(consentResult.sessionStatus).toBe('ready');

            // Verify consent record exists
            const consentRecord = sessionService.getConsentRecord(createResult.sessionId);
            expect(consentRecord).toBeDefined();
            expect(consentRecord.resourceType).toBe('Consent');
            expect(consentRecord.status).toBe('active');
        });

        test('should fail to record consent for non-existent session', async () => {
            const consentData = {
                method: 'electronic',
                patientName: 'John Doe'
            };

            await expect(sessionService.recordConsent('non-existent', consentData))
                .rejects.toThrow('Session not found');
        });
    });

    describe('Session Management', () => {
        test('should start a session', async () => {
            const sessionData = {
                patientId: 'patient-123',
                providerId: 'provider-456'
            };

            const createResult = await sessionService.createSession(sessionData);

            // Record consent first
            await sessionService.recordConsent(createResult.sessionId, {
                method: 'electronic',
                patientName: 'John Doe'
            });

            // Start session
            const startResult = await sessionService.startSession(createResult.sessionId, 'patient-123');

            expect(startResult.sessionId).toBe(createResult.sessionId);
            expect(startResult.status).toBe('active');
            expect(startResult.startedBy).toBe('patient-123');
            expect(startResult.startedAt).toBeDefined();
        });

        test('should fail to start session without consent', async () => {
            const sessionData = {
                patientId: 'patient-123',
                providerId: 'provider-456'
            };

            const createResult = await sessionService.createSession(sessionData);

            await expect(sessionService.startSession(createResult.sessionId, 'patient-123'))
                .rejects.toThrow('Patient consent required before starting session');
        });

        test('should end a session', async () => {
            const sessionData = {
                patientId: 'patient-123',
                providerId: 'provider-456'
            };

            const createResult = await sessionService.createSession(sessionData);

            // Record consent and start session
            await sessionService.recordConsent(createResult.sessionId, {
                method: 'electronic',
                patientName: 'John Doe'
            });

            await sessionService.startSession(createResult.sessionId, 'patient-123');

            // Wait a moment to ensure duration > 0
            await new Promise(resolve => setTimeout(resolve, 10));

            // End session
            const endResult = await sessionService.endSession(createResult.sessionId, 'provider-456');

            expect(endResult.sessionId).toBe(createResult.sessionId);
            expect(endResult.status).toBe('ended');
            expect(endResult.endedBy).toBe('provider-456');
            expect(endResult.duration).toBeGreaterThanOrEqual(0);
        });

        test('should only allow provider to end session', async () => {
            const sessionData = {
                patientId: 'patient-123',
                providerId: 'provider-456'
            };

            const createResult = await sessionService.createSession(sessionData);

            await expect(sessionService.endSession(createResult.sessionId, 'patient-123'))
                .rejects.toThrow('Only the provider can end the session');
        });
    });

    describe('Session Retrieval', () => {
        test('should retrieve session information', async () => {
            const sessionData = {
                patientId: 'patient-123',
                providerId: 'provider-456',
                sessionType: 'consultation',
                specialty: 'cardiology'
            };

            const createResult = await sessionService.createSession(sessionData);
            const session = sessionService.getSession(createResult.sessionId);

            expect(session).toBeDefined();
            expect(session.id).toBe(createResult.sessionId);
            expect(session.patientId).toBe('patient-123');
            expect(session.providerId).toBe('provider-456');
            expect(session.metadata.sessionType).toBe('consultation');
            expect(session.metadata.specialty).toBe('cardiology');
        });

        test('should return null for non-existent session', () => {
            const session = sessionService.getSession('non-existent');
            expect(session).toBeNull();
        });
    });

    describe('Statistics', () => {
        test('should return service statistics', async () => {
            // Create a few sessions
            await sessionService.createSession({
                patientId: 'patient-1',
                providerId: 'provider-1'
            });

            await sessionService.createSession({
                patientId: 'patient-2',
                providerId: 'provider-1'
            });

            const stats = sessionService.getStats();

            expect(stats.totalSessions).toBe(2);
            expect(stats.scheduledSessions).toBe(2);
            expect(stats.activeSessions).toBe(0);
            expect(stats.consentRecords).toBe(0);
            expect(stats.consentGivenRate).toBe(0);
        });
    });

    describe('Cleanup', () => {
        test('should clean up expired sessions', async () => {
            // Create a service with very short expiration
            const shortExpiryService = new TelehealthSessionService({
                linkExpirationMinutes: 0.001 // ~60ms
            });

            const sessionData = {
                patientId: 'patient-123',
                providerId: 'provider-456'
            };

            const createResult = await shortExpiryService.createSession(sessionData);

            // Wait for expiration
            await new Promise(resolve => setTimeout(resolve, 100));

            // Clean up
            shortExpiryService.cleanupExpiredSessions();

            // Session should be removed
            const session = shortExpiryService.getSession(createResult.sessionId);
            expect(session).toBeNull();
        });
    });
});