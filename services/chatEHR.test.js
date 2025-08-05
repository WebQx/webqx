/**
 * ChatEHR Integration Tests
 * Tests for ChatEHR service, routes, and API endpoints
 */

const request = require('supertest');
const express = require('express');
const ChatEHRService = require('../services/chatEHRService');
const MockChatEHRServer = require('../services/mockChatEHRServer');
const chatEHRRoutes = require('../routes/chatehr');

describe('ChatEHR Integration', () => {
    let app;
    let mockServer;
    let chatEHRService;

    beforeAll(async () => {
        // Start mock ChatEHR server for testing
        mockServer = new MockChatEHRServer(4001);
        await mockServer.start();

        // Create Express app for testing routes
        app = express();
        app.use(express.json());
        
        // Mock authentication middleware
        app.use((req, res, next) => {
            req.user = {
                id: 'test-user-123',
                roles: ['patient'],
                name: 'Test User'
            };
            next();
        });

        app.use('/api/chatehr', chatEHRRoutes);

        // Initialize ChatEHR service with test configuration
        chatEHRService = new ChatEHRService({
            baseUrl: 'http://localhost:4001/v1',
            apiKey: 'test-api-key',
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
            enableAuditLogging: false // Disable for tests
        });
    });

    afterAll(async () => {
        if (mockServer) {
            await mockServer.stop();
        }
    });

    describe('ChatEHRService', () => {
        describe('createConsultationRequest', () => {
            it('should create a consultation request successfully', async () => {
                const request = {
                    patientId: 'patient-test-123',
                    specialty: 'cardiology',
                    urgency: 'routine',
                    description: 'Test consultation request',
                    metadata: { test: true }
                };

                const result = await chatEHRService.createConsultationRequest(request);

                expect(result.success).toBe(true);
                expect(result.data).toBeDefined();
                expect(result.data.id).toBeDefined();
                expect(result.data.patientId).toBe(request.patientId);
                expect(result.data.specialty).toBe(request.specialty);
                expect(result.data.urgency).toBe(request.urgency);
                expect(result.data.description).toBe(request.description);
                expect(result.data.status).toBe('pending');
            });

            it('should validate required fields', async () => {
                const incompleteRequest = {
                    patientId: 'patient-test-123'
                    // Missing specialty and description
                };

                const result = await chatEHRService.createConsultationRequest(incompleteRequest);

                expect(result.success).toBe(false);
                expect(result.error).toBeDefined();
                expect(result.error.message).toContain('required');
            });

            it('should validate urgency level', async () => {
                const request = {
                    patientId: 'patient-test-123',
                    specialty: 'cardiology',
                    urgency: 'invalid-urgency',
                    description: 'Test consultation request'
                };

                const result = await chatEHRService.createConsultationRequest(request);

                expect(result.success).toBe(false);
                expect(result.error).toBeDefined();
                expect(result.error.message).toContain('Invalid urgency level');
            });
        });

        describe('getConsultationRequests', () => {
            it('should get consultation requests for a patient', async () => {
                const result = await chatEHRService.getConsultationRequests('patient-123', 'patient');

                expect(result.success).toBe(true);
                expect(result.data).toBeDefined();
                expect(Array.isArray(result.data)).toBe(true);
                expect(result.metadata).toBeDefined();
                expect(result.metadata.count).toBeDefined();
            });

            it('should get consultation requests for a physician', async () => {
                const result = await chatEHRService.getConsultationRequests('physician-456', 'physician');

                expect(result.success).toBe(true);
                expect(result.data).toBeDefined();
                expect(Array.isArray(result.data)).toBe(true);
            });

            it('should handle filters', async () => {
                const filters = {
                    status: 'pending',
                    specialty: 'cardiology'
                };

                const result = await chatEHRService.getConsultationRequests('patient-123', 'patient', filters);

                expect(result.success).toBe(true);
                expect(result.data).toBeDefined();
            });
        });

        describe('updateConsultationRequest', () => {
            it('should update consultation status', async () => {
                // First create a consultation
                const createRequest = {
                    patientId: 'patient-test-456',
                    specialty: 'dermatology',
                    urgency: 'urgent',
                    description: 'Test consultation for update'
                };

                const createResult = await chatEHRService.createConsultationRequest(createRequest);
                expect(createResult.success).toBe(true);

                const consultationId = createResult.data.id;

                // Update the consultation
                const updateResult = await chatEHRService.updateConsultationRequest(
                    consultationId,
                    'assigned',
                    'physician-789',
                    { notes: 'Assigned to physician' }
                );

                expect(updateResult.success).toBe(true);
                expect(updateResult.data).toBeDefined();
                expect(updateResult.data.status).toBe('assigned');
                expect(updateResult.data.physicianId).toBe('physician-789');
            });
        });

        describe('syncAppointments', () => {
            it('should sync appointments for a patient', async () => {
                const result = await chatEHRService.syncAppointments('patient-123', 'patient');

                expect(result.success).toBe(true);
                expect(result.data).toBeDefined();
                expect(Array.isArray(result.data)).toBe(true);
                expect(result.metadata).toBeDefined();
                expect(result.metadata.syncedAt).toBeDefined();
            });

            it('should sync appointments for a physician', async () => {
                const result = await chatEHRService.syncAppointments('physician-456', 'physician');

                expect(result.success).toBe(true);
                expect(result.data).toBeDefined();
                expect(Array.isArray(result.data)).toBe(true);
            });

            it('should handle date range filters', async () => {
                const dateRange = {
                    startDate: '2024-01-01',
                    endDate: '2024-12-31'
                };

                const result = await chatEHRService.syncAppointments('patient-123', 'patient', dateRange);

                expect(result.success).toBe(true);
                expect(result.data).toBeDefined();
            });
        });

        describe('sendSecureMessage', () => {
            it('should send a secure message', async () => {
                const message = {
                    fromId: 'patient-123',
                    toId: 'physician-456',
                    content: 'Test secure message',
                    consultationId: 'consultation-1',
                    type: 'text'
                };

                const result = await chatEHRService.sendSecureMessage(message);

                expect(result.success).toBe(true);
                expect(result.data).toBeDefined();
                expect(result.data.id).toBeDefined();
                expect(result.data.fromId).toBe(message.fromId);
                expect(result.data.toId).toBe(message.toId);
                expect(result.data.consultationId).toBe(message.consultationId);
            });

            it('should validate message fields', async () => {
                const incompleteMessage = {
                    fromId: 'patient-123'
                    // Missing required fields
                };

                const result = await chatEHRService.sendSecureMessage(incompleteMessage);

                expect(result.success).toBe(false);
                expect(result.error).toBeDefined();
                expect(result.error.message).toContain('required');
            });
        });

        describe('getSecureMessages', () => {
            it('should get messages for a consultation', async () => {
                const result = await chatEHRService.getSecureMessages('consultation-1', 'patient-123');

                expect(result.success).toBe(true);
                expect(result.data).toBeDefined();
                expect(Array.isArray(result.data)).toBe(true);
                expect(result.metadata).toBeDefined();
            });

            it('should handle pagination', async () => {
                const pagination = {
                    limit: 10,
                    offset: 0
                };

                const result = await chatEHRService.getSecureMessages('consultation-1', 'patient-123', pagination);

                expect(result.success).toBe(true);
                expect(result.data).toBeDefined();
                expect(result.metadata.hasMore).toBeDefined();
            });
        });

        describe('healthCheck', () => {
            it('should perform health check', async () => {
                const result = await chatEHRService.healthCheck();

                expect(result.success).toBe(true);
                expect(result.status).toBe('healthy');
                expect(result.data).toBeDefined();
            });
        });
    });

    describe('ChatEHR Routes', () => {
        describe('POST /api/chatehr/consultations', () => {
            it('should create a consultation request', async () => {
                const requestData = {
                    patientId: 'test-user-123',
                    specialty: 'cardiology',
                    urgency: 'routine',
                    description: 'Test consultation via API'
                };

                const response = await request(app)
                    .post('/api/chatehr/consultations')
                    .send(requestData)
                    .expect(201);

                expect(response.body.success).toBe(true);
                expect(response.body.data).toBeDefined();
                expect(response.body.data.patientId).toBe(requestData.patientId);
                expect(response.body.data.specialty).toBe(requestData.specialty);
            });

            it('should validate request data', async () => {
                const invalidRequest = {
                    patientId: 'test-user-123'
                    // Missing required fields
                };

                const response = await request(app)
                    .post('/api/chatehr/consultations')
                    .send(invalidRequest)
                    .expect(400);

                expect(response.body.success).toBe(false);
                expect(response.body.error).toBeDefined();
                expect(response.body.error.code).toBe('VALIDATION_ERROR');
            });

            it('should enforce patient access control', async () => {
                const requestData = {
                    patientId: 'different-patient-456', // Different from authenticated user
                    specialty: 'cardiology',
                    urgency: 'routine',
                    description: 'Test consultation'
                };

                const response = await request(app)
                    .post('/api/chatehr/consultations')
                    .send(requestData)
                    .expect(403);

                expect(response.body.success).toBe(false);
                expect(response.body.error.code).toBe('FORBIDDEN');
            });
        });

        describe('GET /api/chatehr/consultations', () => {
            it('should get consultation requests', async () => {
                const response = await request(app)
                    .get('/api/chatehr/consultations')
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.data).toBeDefined();
                expect(Array.isArray(response.body.data)).toBe(true);
            });

            it('should handle query filters', async () => {
                const response = await request(app)
                    .get('/api/chatehr/consultations')
                    .query({
                        status: 'pending',
                        specialty: 'cardiology',
                        limit: 10
                    })
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.data).toBeDefined();
            });
        });

        describe('PUT /api/chatehr/consultations/:consultationId', () => {
            it('should require physician role', async () => {
                const response = await request(app)
                    .put('/api/chatehr/consultations/test-consultation-id')
                    .send({ status: 'assigned' })
                    .expect(403);

                expect(response.body.success).toBe(false);
                expect(response.body.error.code).toBe('FORBIDDEN');
            });
        });

        describe('GET /api/chatehr/appointments', () => {
            it('should sync appointments', async () => {
                const response = await request(app)
                    .get('/api/chatehr/appointments')
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.data).toBeDefined();
                expect(Array.isArray(response.body.data)).toBe(true);
            });

            it('should handle date range filters', async () => {
                const response = await request(app)
                    .get('/api/chatehr/appointments')
                    .query({
                        startDate: '2024-01-01',
                        endDate: '2024-12-31'
                    })
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.data).toBeDefined();
            });
        });

        describe('POST /api/chatehr/messages', () => {
            it('should send a secure message', async () => {
                const messageData = {
                    toId: 'physician-456',
                    content: 'Test message via API',
                    consultationId: 'consultation-1',
                    type: 'text'
                };

                const response = await request(app)
                    .post('/api/chatehr/messages')
                    .send(messageData)
                    .expect(201);

                expect(response.body.success).toBe(true);
                expect(response.body.data).toBeDefined();
                expect(response.body.data.fromId).toBe('test-user-123');
                expect(response.body.data.toId).toBe(messageData.toId);
            });

            it('should validate message data', async () => {
                const invalidMessage = {
                    toId: 'physician-456'
                    // Missing content and consultationId
                };

                const response = await request(app)
                    .post('/api/chatehr/messages')
                    .send(invalidMessage)
                    .expect(400);

                expect(response.body.success).toBe(false);
                expect(response.body.error.code).toBe('VALIDATION_ERROR');
            });
        });

        describe('GET /api/chatehr/messages/:consultationId', () => {
            it('should get messages for a consultation', async () => {
                const response = await request(app)
                    .get('/api/chatehr/messages/consultation-1')
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.data).toBeDefined();
                expect(Array.isArray(response.body.data)).toBe(true);
            });

            it('should handle pagination', async () => {
                const response = await request(app)
                    .get('/api/chatehr/messages/consultation-1')
                    .query({
                        limit: 10,
                        offset: 0
                    })
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.data).toBeDefined();
            });

            it('should validate consultation ID format', async () => {
                const response = await request(app)
                    .get('/api/chatehr/messages/invalid-id')
                    .expect(400);

                expect(response.body.success).toBe(false);
                expect(response.body.error.code).toBe('VALIDATION_ERROR');
            });
        });

        describe('GET /api/chatehr/health', () => {
            it('should return health status', async () => {
                const response = await request(app)
                    .get('/api/chatehr/health')
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.status).toBe('healthy');
                expect(response.body.service).toBe('ChatEHR');
            });
        });

        describe('GET /api/chatehr/specialties', () => {
            it('should return available specialties', async () => {
                const response = await request(app)
                    .get('/api/chatehr/specialties')
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.data).toBeDefined();
                expect(Array.isArray(response.body.data)).toBe(true);
                expect(response.body.data.length).toBeGreaterThan(0);

                // Check specialty structure
                const specialty = response.body.data[0];
                expect(specialty.code).toBeDefined();
                expect(specialty.name).toBeDefined();
                expect(specialty.description).toBeDefined();
            });
        });
    });

    describe('Mock ChatEHR Server', () => {
        it('should respond to health check', async () => {
            const response = await request('http://localhost:4001')
                .get('/v1/health')
                .expect(200);

            expect(response.body.status).toBe('healthy');
            expect(response.body.service).toBe('Mock ChatEHR');
        });

        it('should handle consultation creation', async () => {
            const consultationData = {
                patientId: 'test-patient-123',
                specialty: 'cardiology',
                urgency: 'routine',
                description: 'Test consultation for mock server'
            };

            const response = await request('http://localhost:4001')
                .post('/v1/consultations')
                .send(consultationData)
                .expect(201);

            expect(response.body.id).toBeDefined();
            expect(response.body.patientId).toBe(consultationData.patientId);
            expect(response.body.status).toBe('pending');
        });

        it('should return 404 for unknown endpoints', async () => {
            const response = await request('http://localhost:4001')
                .get('/v1/unknown-endpoint')
                .expect(404);

            expect(response.body.error).toBe('Not Found');
            expect(response.body.availableEndpoints).toBeDefined();
        });
    });

    describe('Integration Security', () => {
        it('should handle rate limiting', async () => {
            // This test would be more comprehensive in a real environment
            // For now, just verify the rate limiting middleware is applied
            const response = await request(app)
                .get('/api/chatehr/health')
                .expect(200);

            expect(response.headers['x-ratelimit-limit']).toBeDefined();
        });

        it('should require authentication', async () => {
            // Create app without auth middleware
            const unauthenticatedApp = express();
            unauthenticatedApp.use(express.json());
            unauthenticatedApp.use('/api/chatehr', chatEHRRoutes);

            const response = await request(unauthenticatedApp)
                .get('/api/chatehr/consultations')
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.error.code).toBe('UNAUTHORIZED');
        });
    });

    describe('Error Handling', () => {
        it('should handle service unavailable', async () => {
            // Create service with invalid URL
            const invalidService = new ChatEHRService({
                baseUrl: 'http://invalid-url:9999/v1',
                enableAuditLogging: false
            });

            const result = await invalidService.healthCheck();

            expect(result.success).toBe(false);
            expect(result.status).toBe('unhealthy');
            expect(result.error).toBeDefined();
        });

        it('should handle network timeouts', async () => {
            // Create service with very short timeout
            const timeoutService = new ChatEHRService({
                baseUrl: 'http://localhost:4001/v1',
                timeout: 1, // 1ms timeout
                enableAuditLogging: false
            });

            const result = await timeoutService.getConsultationRequests('patient-123', 'patient');

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });
});

describe('Message Encryption', () => {
    let chatEHRService;

    beforeEach(() => {
        chatEHRService = new ChatEHRService({
            clientSecret: 'test-encryption-key',
            enableAuditLogging: false
        });
    });

    it('should encrypt and decrypt messages', async () => {
        const originalMessage = 'This is a sensitive medical message';

        const encrypted = await chatEHRService.encryptMessage(originalMessage);
        expect(encrypted).not.toBe(originalMessage);
        expect(encrypted).toContain(':'); // Should have format: iv:authTag:encrypted

        const decrypted = await chatEHRService.decryptMessage(encrypted);
        expect(decrypted).toBe(originalMessage);
    });

    it('should handle decryption failures gracefully', async () => {
        const invalidEncrypted = 'invalid:encrypted:message';

        const result = await chatEHRService.decryptMessage(invalidEncrypted);
        expect(result).toBe('[Encrypted Message - Decryption Failed]');
    });

    it('should handle unencrypted messages', async () => {
        const plainMessage = 'Plain text message';

        const result = await chatEHRService.decryptMessage(plainMessage);
        expect(result).toBe(plainMessage);
    });
});