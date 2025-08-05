/**
 * Mock ChatEHR Server
 * Simulates ChatEHR API endpoints for development and testing
 * Provides realistic responses for consultation requests, appointments, and messaging
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

class MockChatEHRServer {
    constructor(port = 4000) {
        this.app = express();
        this.port = port;
        this.data = {
            consultations: new Map(),
            appointments: new Map(),
            messages: new Map(),
            users: new Map()
        };

        this.setupMiddleware();
        this.setupRoutes();
        this.seedTestData();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        
        // Request logging
        this.app.use((req, res, next) => {
            console.log(`[Mock ChatEHR] ${req.method} ${req.path}`, {
                body: req.body,
                query: req.query,
                timestamp: new Date().toISOString()
            });
            next();
        });

        // Mock authentication middleware
        this.app.use((req, res, next) => {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                req.authenticated = true;
                req.apiKey = authHeader.split(' ')[1];
            }
            next();
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/v1/health', (req, res) => {
            res.json({
                status: 'healthy',
                service: 'Mock ChatEHR',
                version: '1.0.0',
                timestamp: new Date().toISOString()
            });
        });

        // Consultations endpoints
        this.app.post('/v1/consultations', this.createConsultation.bind(this));
        this.app.get('/v1/consultations', this.getConsultations.bind(this));
        this.app.get('/v1/consultations/:id', this.getConsultation.bind(this));
        this.app.put('/v1/consultations/:id', this.updateConsultation.bind(this));

        // Appointments endpoints
        this.app.get('/v1/appointments', this.getAppointments.bind(this));
        this.app.post('/v1/appointments', this.createAppointment.bind(this));
        this.app.put('/v1/appointments/:id', this.updateAppointment.bind(this));

        // Messages endpoints
        this.app.post('/v1/messages', this.sendMessage.bind(this));
        this.app.get('/v1/messages', this.getMessages.bind(this));

        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Not Found',
                message: `Endpoint ${req.method} ${req.originalUrl} not found`,
                availableEndpoints: [
                    'GET /v1/health',
                    'POST /v1/consultations',
                    'GET /v1/consultations',
                    'PUT /v1/consultations/:id',
                    'GET /v1/appointments',
                    'POST /v1/appointments',
                    'POST /v1/messages',
                    'GET /v1/messages'
                ]
            });
        });
    }

    // Consultation endpoints
    createConsultation(req, res) {
        try {
            const consultation = {
                id: uuidv4(),
                patientId: req.body.patientId,
                physicianId: req.body.physicianId || null,
                specialty: req.body.specialty,
                urgency: req.body.urgency || 'routine',
                description: req.body.description,
                status: 'pending',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                metadata: req.body.metadata || {}
            };

            this.data.consultations.set(consultation.id, consultation);

            res.status(201).json(consultation);
        } catch (error) {
            res.status(500).json({
                error: 'Internal Server Error',
                message: error.message
            });
        }
    }

    getConsultations(req, res) {
        try {
            const { patientId, physicianId, status, specialty, limit = 20, offset = 0 } = req.query;
            
            let consultations = Array.from(this.data.consultations.values());

            // Apply filters
            if (patientId) {
                consultations = consultations.filter(c => c.patientId === patientId);
            }
            if (physicianId) {
                consultations = consultations.filter(c => c.physicianId === physicianId);
            }
            if (status) {
                consultations = consultations.filter(c => c.status === status);
            }
            if (specialty) {
                consultations = consultations.filter(c => c.specialty === specialty);
            }

            // Sort by creation date (newest first)
            consultations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            // Apply pagination
            const start = parseInt(offset);
            const end = start + parseInt(limit);
            const paginatedConsultations = consultations.slice(start, end);

            res.set('X-Total-Count', consultations.length.toString());
            res.json(paginatedConsultations);
        } catch (error) {
            res.status(500).json({
                error: 'Internal Server Error',
                message: error.message
            });
        }
    }

    getConsultation(req, res) {
        try {
            const consultation = this.data.consultations.get(req.params.id);
            
            if (!consultation) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: 'Consultation not found'
                });
            }

            res.json(consultation);
        } catch (error) {
            res.status(500).json({
                error: 'Internal Server Error',
                message: error.message
            });
        }
    }

    updateConsultation(req, res) {
        try {
            const consultation = this.data.consultations.get(req.params.id);
            
            if (!consultation) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: 'Consultation not found'
                });
            }

            // Update consultation
            const updatedConsultation = {
                ...consultation,
                ...req.body,
                updatedAt: new Date().toISOString()
            };

            this.data.consultations.set(req.params.id, updatedConsultation);
            res.json(updatedConsultation);
        } catch (error) {
            res.status(500).json({
                error: 'Internal Server Error',
                message: error.message
            });
        }
    }

    // Appointment endpoints
    getAppointments(req, res) {
        try {
            const { patientId, physicianId, startDate, endDate } = req.query;
            
            let appointments = Array.from(this.data.appointments.values());

            // Apply filters
            if (patientId) {
                appointments = appointments.filter(a => a.patientId === patientId);
            }
            if (physicianId) {
                appointments = appointments.filter(a => a.physicianId === physicianId);
            }
            if (startDate) {
                appointments = appointments.filter(a => a.dateTime >= startDate);
            }
            if (endDate) {
                appointments = appointments.filter(a => a.dateTime <= endDate);
            }

            // Sort by date
            appointments.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

            res.json(appointments);
        } catch (error) {
            res.status(500).json({
                error: 'Internal Server Error',
                message: error.message
            });
        }
    }

    createAppointment(req, res) {
        try {
            const appointment = {
                id: uuidv4(),
                patientId: req.body.patientId,
                physicianId: req.body.physicianId,
                consultationId: req.body.consultationId,
                dateTime: req.body.dateTime,
                duration: req.body.duration || 30,
                type: req.body.type || 'consultation',
                status: req.body.status || 'scheduled',
                notes: req.body.notes || '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            this.data.appointments.set(appointment.id, appointment);
            res.status(201).json(appointment);
        } catch (error) {
            res.status(500).json({
                error: 'Internal Server Error',
                message: error.message
            });
        }
    }

    updateAppointment(req, res) {
        try {
            const appointment = this.data.appointments.get(req.params.id);
            
            if (!appointment) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: 'Appointment not found'
                });
            }

            const updatedAppointment = {
                ...appointment,
                ...req.body,
                updatedAt: new Date().toISOString()
            };

            this.data.appointments.set(req.params.id, updatedAppointment);
            res.json(updatedAppointment);
        } catch (error) {
            res.status(500).json({
                error: 'Internal Server Error',
                message: error.message
            });
        }
    }

    // Message endpoints
    sendMessage(req, res) {
        try {
            const message = {
                id: uuidv4(),
                fromId: req.body.fromId,
                toId: req.body.toId,
                consultationId: req.body.consultationId,
                content: req.body.content,
                type: req.body.type || 'text',
                timestamp: new Date().toISOString(),
                metadata: req.body.metadata || {}
            };

            // Store message in consultation-specific list
            const consultationMessages = this.data.messages.get(message.consultationId) || [];
            consultationMessages.push(message);
            this.data.messages.set(message.consultationId, consultationMessages);

            res.status(201).json(message);
        } catch (error) {
            res.status(500).json({
                error: 'Internal Server Error',
                message: error.message
            });
        }
    }

    getMessages(req, res) {
        try {
            const { consultationId, userId, limit = 50, offset = 0 } = req.query;

            if (!consultationId) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'consultationId is required'
                });
            }

            let messages = this.data.messages.get(consultationId) || [];

            // Filter messages for user access control
            if (userId) {
                messages = messages.filter(m => m.fromId === userId || m.toId === userId);
            }

            // Sort by timestamp (oldest first for chat display)
            messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            // Apply pagination
            const start = parseInt(offset);
            const end = start + parseInt(limit);
            const paginatedMessages = messages.slice(start, end);

            res.set('X-Total-Count', messages.length.toString());
            res.json(paginatedMessages);
        } catch (error) {
            res.status(500).json({
                error: 'Internal Server Error',
                message: error.message
            });
        }
    }

    seedTestData() {
        // Seed some test consultations
        const testConsultations = [
            {
                id: 'consultation-1',
                patientId: 'patient-123',
                physicianId: 'physician-456',
                specialty: 'cardiology',
                urgency: 'routine',
                description: 'Chest pain and irregular heartbeat',
                status: 'assigned',
                createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
                metadata: { source: 'webqx' }
            },
            {
                id: 'consultation-2',
                patientId: 'patient-789',
                physicianId: null,
                specialty: 'dermatology',
                urgency: 'urgent',
                description: 'Suspicious mole on back',
                status: 'pending',
                createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
                metadata: { source: 'webqx' }
            }
        ];

        testConsultations.forEach(consultation => {
            this.data.consultations.set(consultation.id, consultation);
        });

        // Seed some test appointments
        const testAppointments = [
            {
                id: 'appointment-1',
                patientId: 'patient-123',
                physicianId: 'physician-456',
                consultationId: 'consultation-1',
                dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
                duration: 30,
                type: 'consultation',
                status: 'scheduled',
                notes: 'Follow-up for cardiology consultation',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'appointment-2',
                patientId: 'patient-789',
                physicianId: 'physician-789',
                consultationId: 'consultation-2',
                dateTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
                duration: 45,
                type: 'consultation',
                status: 'scheduled',
                notes: 'Dermatology consultation for mole examination',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];

        testAppointments.forEach(appointment => {
            this.data.appointments.set(appointment.id, appointment);
        });

        // Seed some test messages
        const testMessages = [
            {
                id: 'message-1',
                fromId: 'patient-123',
                toId: 'physician-456',
                consultationId: 'consultation-1',
                content: 'Hello Dr. Smith, I wanted to follow up on my chest pain.',
                type: 'text',
                timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                metadata: { senderRole: 'patient' }
            },
            {
                id: 'message-2',
                fromId: 'physician-456',
                toId: 'patient-123',
                consultationId: 'consultation-1',
                content: 'Hi John, thank you for the follow-up. How has the pain been since our last appointment?',
                type: 'text',
                timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
                metadata: { senderRole: 'physician' }
            }
        ];

        testMessages.forEach(message => {
            const consultationMessages = this.data.messages.get(message.consultationId) || [];
            consultationMessages.push(message);
            this.data.messages.set(message.consultationId, consultationMessages);
        });

        console.log('[Mock ChatEHR] Test data seeded:', {
            consultations: this.data.consultations.size,
            appointments: this.data.appointments.size,
            messages: Array.from(this.data.messages.values()).reduce((total, msgs) => total + msgs.length, 0)
        });
    }

    start() {
        return new Promise((resolve) => {
            this.server = this.app.listen(this.port, () => {
                console.log(`[Mock ChatEHR Server] Running on port ${this.port}`);
                console.log(`[Mock ChatEHR Server] Health check: http://localhost:${this.port}/v1/health`);
                resolve();
            });
        });
    }

    stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    console.log('[Mock ChatEHR Server] Server stopped');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

// Allow running as standalone server
if (require.main === module) {
    const mockServer = new MockChatEHRServer(process.env.MOCK_CHATEHR_PORT || 4000);
    mockServer.start();

    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n[Mock ChatEHR Server] Shutting down gracefully...');
        await mockServer.stop();
        process.exit(0);
    });
}

module.exports = MockChatEHRServer;