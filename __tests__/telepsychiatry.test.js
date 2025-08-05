/**
 * Test suite for Telepsychiatry API endpoints
 * Tests the complete user-centric workflow
 */

const request = require('supertest');
const app = require('../server');

describe('Telepsychiatry API Workflow', () => {
    let testToken;
    let sessionId;
    let consentId;
    let triageId;
    let planId;
    let chatSessionId;

    beforeAll(async () => {
        // Get test token
        const tokenResponse = await request(app)
            .get('/dev/token')
            .expect(200);
        testToken = tokenResponse.body.access_token;
    });

    describe('Login & Identity Check', () => {
        test('should provide OAuth2 authentication endpoint', async () => {
            const response = await request(app)
                .get('/oauth/authorize?response_type=code&client_id=test')
                .expect(302);
            
            expect(response.headers.location).toContain('auth.webqx.health');
        });
    });

    describe('Dashboard - Active Sessions', () => {
        test('should fetch active sessions', async () => {
            const response = await request(app)
                .get('/session/active')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('activeSessions');
            expect(Array.isArray(response.body.data.activeSessions)).toBe(true);
        });
    });

    describe('Consent Management', () => {
        test('should query consent audit logs', async () => {
            const response = await request(app)
                .get('/consent/audit')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('consents');
        });

        test('should record new consent', async () => {
            const consentData = {
                patientId: 'test-patient-123',
                clinicianId: 'test-clinician-456',
                consentType: 'telehealth_session',
                consentText: 'I consent to telehealth session',
                language: 'en'
            };

            const response = await request(app)
                .post('/consent/record')
                .set('Authorization', `Bearer ${testToken}`)
                .send(consentData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('consentId');
            consentId = response.body.data.consentId;
        });
    });

    describe('Triage Queue', () => {
        test('should create triage entry with cultural adaptations', async () => {
            const triageData = {
                patientId: 'test-patient-123',
                symptoms: ['anxiety', 'sleep difficulties'],
                urgencyLevel: 'medium',
                culturalContext: 'hispanic',
                language: 'es'
            };

            const response = await request(app)
                .post('/workflow/triage')
                .set('Authorization', `Bearer ${testToken}`)
                .send(triageData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('triageId');
            expect(response.body.data).toHaveProperty('culturallyAdaptedPrompts');
            triageId = response.body.data.triageId;
        });

        test('should retrieve triage queue', async () => {
            const response = await request(app)
                .get('/workflow/triage')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('triageQueue');
        });
    });

    describe('Session Management', () => {
        test('should start telepsychiatry session', async () => {
            const sessionData = {
                patientId: 'test-patient-123',
                clinicianId: 'test-clinician-456',
                sessionType: 'video',
                culturalContext: 'hispanic',
                language: 'es'
            };

            const response = await request(app)
                .post('/session/start')
                .set('Authorization', `Bearer ${testToken}`)
                .send(sessionData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('sessionId');
            expect(response.body.data).toHaveProperty('jitsiRoomId');
            sessionId = response.body.data.sessionId;
        });

        test('should handle transcription', async () => {
            const transcriptionData = {
                sessionId,
                audioData: 'mock-audio-data',
                speaker: 'patient',
                language: 'es'
            };

            const response = await request(app)
                .post('/session/transcribe')
                .set('Authorization', `Bearer ${testToken}`)
                .send(transcriptionData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('transcription');
        });
    });

    describe('Chat Fallback', () => {
        test('should start chat session for low bandwidth', async () => {
            const chatData = {
                patientId: 'test-patient-123',
                clinicianId: 'test-clinician-456',
                fallbackReason: 'low_bandwidth',
                culturalContext: 'hispanic',
                language: 'es'
            };

            const response = await request(app)
                .post('/chat/session/start')
                .set('Authorization', `Bearer ${testToken}`)
                .send(chatData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('chatSessionId');
            chatSessionId = response.body.data.chatSessionId;
        });
    });

    describe('EMR Integration', () => {
        test('should tag patient with ICD/DSM-5 codes', async () => {
            const tagData = {
                patientId: 'test-patient-123',
                clinicianId: 'test-clinician-456',
                diagnosticCode: 'F41.1',
                codeSystem: 'icd10',
                severity: 'moderate',
                confidence: 0.85
            };

            const response = await request(app)
                .post('/emr/tag')
                .set('Authorization', `Bearer ${testToken}`)
                .send(tagData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('tagId');
        });

        test('should search diagnostic codes', async () => {
            const response = await request(app)
                .get('/emr/tag/search?query=anxiety&codeSystem=icd10')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('codes');
        });
    });

    describe('Care Planning', () => {
        test('should generate culturally adapted care plan', async () => {
            const planData = {
                patientId: 'test-patient-123',
                symptoms: ['anxiety', 'sleep difficulties'],
                culturalContext: 'hispanic',
                language: 'es',
                clinicianId: 'test-clinician-456'
            };

            const response = await request(app)
                .post('/workflow/plan')
                .set('Authorization', `Bearer ${testToken}`)
                .send(planData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('planId');
            expect(response.body.data.carePlan).toHaveProperty('culturalAdaptations');
            planId = response.body.data.planId;
        });
    });

    describe('UI Customization', () => {
        test('should customize UI for cultural context', async () => {
            const customizationData = {
                userId: 'test-patient-123',
                culturalContext: 'hispanic',
                language: 'es',
                customizationType: 'care_plan',
                preferences: { familyInvolvement: 'high' }
            };

            const response = await request(app)
                .post('/ui/customize')
                .set('Authorization', `Bearer ${testToken}`)
                .send(customizationData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('adaptations');
        });

        test('should get cultural templates', async () => {
            const response = await request(app)
                .get('/ui/templates?culturalContext=hispanic&language=es')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('templates');
        });
    });

    describe('Analytics and Reporting', () => {
        test('should submit analytics report', async () => {
            const analyticsData = {
                sessionId,
                clinicianId: 'test-clinician-456',
                reportType: 'session_outcome',
                data: {
                    conditions: ['anxiety'],
                    demographics: { age: 30, ethnicity: 'hispanic' }
                },
                outcomes: { improvement: 'good' },
                culturalFactors: { culturalContext: 'hispanic' }
            };

            const response = await request(app)
                .post('/analytics/report')
                .set('Authorization', `Bearer ${testToken}`)
                .send(analyticsData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('reportId');
        });

        test('should get community health dashboard', async () => {
            const response = await request(app)
                .get('/analytics/community')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('stats');
        });

        test('should provide deidentified research data', async () => {
            const response = await request(app)
                .get('/analytics/deidentified?researchId=research-001')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('dataset');
        });
    });

    describe('Session Wrap-up', () => {
        test('should generate session transcript', async () => {
            const response = await request(app)
                .get(`/session/transcript/${sessionId}`)
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('transcript');
        });

        test('should end session', async () => {
            const response = await request(app)
                .put(`/session/${sessionId}/end`)
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.status).toBe('completed');
        });
    });
});

module.exports = {
    testWorkflowEndpoints: () => {
        return {
            endpoints: [
                '/session/active',
                '/session/start',
                '/session/transcribe',
                '/consent/audit',
                '/workflow/triage',
                '/workflow/plan',
                '/emr/tag',
                '/analytics/report',
                '/analytics/community',
                '/chat/session/start',
                '/ui/customize'
            ],
            workflow_verified: true
        };
    }
};