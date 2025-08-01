/**
 * Test file for Telehealth Service and Encounter Model
 */

const TelehealthService = require('../modules/telehealth/TelehealthService');
const Encounter = require('../fhir/models/Encounter');

describe('Telehealth Integration', () => {
    let telehealthService;
    let mockOAuth2Client;

    beforeEach(() => {
        mockOAuth2Client = {
            getCachedToken: jest.fn(() => ({
                sub: 'test-provider-123',
                name: 'Dr. Test Provider',
                role: 'practitioner'
            }))
        };
        telehealthService = new TelehealthService(mockOAuth2Client);
    });

    afterEach(() => {
        // Clean up any active sessions
        telehealthService.activeSessions.clear();
        telehealthService.sessionTimers.clear();
    });

    describe('Encounter Model', () => {
        test('should create telehealth encounter with required fields', () => {
            const encounter = Encounter.createTelehealth({
                patientId: 'patient-123',
                practitionerId: 'practitioner-456',
                appointmentId: 'appointment-789'
            });

            expect(encounter).toBeInstanceOf(Encounter);
            expect(encounter.resourceType).toBe('Encounter');
            expect(encounter.status).toBe('planned');
            expect(encounter.class.code).toBe('VR'); // Virtual
            expect(encounter.subject.reference).toBe('Patient/patient-123');
            expect(encounter.participant).toHaveLength(1);
            expect(encounter.participant[0].individual.reference).toBe('Practitioner/practitioner-456');
        });

        test('should validate encounter successfully', () => {
            const encounter = Encounter.createTelehealth({
                patientId: 'patient-123',
                practitionerId: 'practitioner-456'
            });

            const validation = encounter.validate();
            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        test('should start and end encounter', () => {
            const encounter = Encounter.createTelehealth({
                patientId: 'patient-123',
                practitionerId: 'practitioner-456'
            });

            // Start encounter
            encounter.start();
            expect(encounter.status).toBe('in-progress');
            expect(encounter.period.start).toBeDefined();

            // End encounter
            encounter.end();
            expect(encounter.status).toBe('finished');
            expect(encounter.period.end).toBeDefined();
        });

        test('should set telehealth URL', () => {
            const encounter = Encounter.createTelehealth({
                patientId: 'patient-123',
                practitionerId: 'practitioner-456'
            });

            const sessionUrl = 'https://telehealth.webqx.org/session/test-session-123';
            encounter.setTelehealthUrl(sessionUrl);

            const telehealthSession = encounter.getTelehealthSession();
            expect(telehealthSession.url).toBe(sessionUrl);
        });
    });

    describe('TelehealthService', () => {
        test('should initialize telehealth session', async () => {
            const sessionParams = {
                patientId: 'patient-123',
                practitionerId: 'practitioner-456',
                appointmentId: 'appointment-789',
                providerToken: 'mock_token_123',
                sessionOptions: {
                    sessionType: 'video-call'
                }
            };

            const result = await telehealthService.initializeSession(sessionParams);

            expect(result.success).toBe(true);
            expect(result.sessionId).toBeDefined();
            expect(result.encounterId).toBeDefined();
            expect(result.sessionUrl).toBeDefined();
            expect(result.encounter).toBeDefined();
            expect(result.encounter.resourceType).toBe('Encounter');
        });

        test('should start telehealth session', async () => {
            // First initialize a session
            const sessionParams = {
                patientId: 'patient-123',
                practitionerId: 'practitioner-456',
                providerToken: 'mock_token_123'
            };

            const initResult = await telehealthService.initializeSession(sessionParams);
            
            // Then start the session
            const startResult = await telehealthService.startSession(
                initResult.sessionId,
                'practitioner-456',
                'mock_token_123'
            );

            expect(startResult.success).toBe(true);
            expect(startResult.status).toBe('active');
            expect(startResult.sessionId).toBe(initResult.sessionId);
            expect(startResult.participants).toHaveLength(1);
        });

        test('should end telehealth session', async () => {
            // Initialize and start session
            const sessionParams = {
                patientId: 'patient-123',
                practitionerId: 'practitioner-456',
                providerToken: 'mock_token_123'
            };

            const initResult = await telehealthService.initializeSession(sessionParams);
            await telehealthService.startSession(initResult.sessionId, 'practitioner-456', 'mock_token_123');
            
            // End the session
            const endResult = await telehealthService.endSession(initResult.sessionId, 'normal_end');

            expect(endResult.success).toBe(true);
            expect(endResult.summary).toBeDefined();
            expect(endResult.summary.sessionId).toBe(initResult.sessionId);
            expect(endResult.summary.endReason).toBe('normal_end');
        });

        test('should get session status', async () => {
            const sessionParams = {
                patientId: 'patient-123',
                practitionerId: 'practitioner-456',
                providerToken: 'mock_token_123'
            };

            const initResult = await telehealthService.initializeSession(sessionParams);
            const status = telehealthService.getSessionStatus(initResult.sessionId);

            expect(status.found).toBe(true);
            expect(status.sessionId).toBe(initResult.sessionId);
            expect(status.status).toBe('initializing');
        });

        test('should validate provider token', async () => {
            const validation = await telehealthService.validateProviderToken('mock_token_123');

            expect(validation.valid).toBe(true);
            expect(validation.provider).toBeDefined();
            expect(validation.provider.id).toBe('mock-provider-123');
        });

        test('should fail with invalid token', async () => {
            const validation = await telehealthService.validateProviderToken('invalid_token');

            expect(validation.valid).toBe(false);
            expect(validation.error).toBeDefined();
        });

        test('should get provider sessions', async () => {
            const providerId = 'practitioner-456';
            
            // Create a session
            const sessionParams = {
                patientId: 'patient-123',
                practitionerId: providerId,
                providerToken: 'mock_token_123'
            };

            await telehealthService.initializeSession(sessionParams);
            
            const sessions = telehealthService.getProviderSessions(providerId);
            expect(sessions).toHaveLength(1);
            expect(sessions[0].patientId).toBe('patient-123');
        });

        test('should handle session not found error', () => {
            const status = telehealthService.getSessionStatus('non-existent-session');
            expect(status.found).toBe(false);
        });
    });

    describe('OAuth2 Integration', () => {
        test('should use OAuth2 client for token validation', async () => {
            const token = 'test_token_123';
            mockOAuth2Client.getCachedToken.mockReturnValue({
                sub: 'provider-123',
                name: 'Dr. Test',
                role: 'physician'
            });

            const validation = await telehealthService.validateProviderToken(token);

            expect(mockOAuth2Client.getCachedToken).toHaveBeenCalledWith(token);
            expect(validation.valid).toBe(true);
            expect(validation.provider.name).toBe('Dr. Test');
        });

        test('should handle missing OAuth2 client gracefully', async () => {
            const serviceWithoutOAuth = new TelehealthService(null);
            const validation = await serviceWithoutOAuth.validateProviderToken('mock_token_123');

            expect(validation.valid).toBe(true); // Should fall back to mock validation
        });
    });

    describe('Error Handling', () => {
        test('should handle missing patient ID', async () => {
            const sessionParams = {
                practitionerId: 'practitioner-456',
                providerToken: 'mock_token_123'
            };

            await expect(telehealthService.initializeSession(sessionParams))
                .rejects.toThrow();
        });

        test('should handle unauthorized session start', async () => {
            const sessionParams = {
                patientId: 'patient-123',
                practitionerId: 'practitioner-456',
                providerToken: 'mock_token_123'
            };

            const initResult = await telehealthService.initializeSession(sessionParams);
            
            await expect(telehealthService.startSession(
                initResult.sessionId,
                'different-practitioner',
                'mock_token_123'
            )).rejects.toThrow('Unauthorized to start this session');
        });
    });
});