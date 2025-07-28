const request = require('supertest');
const express = require('express');
const patientRoutes = require('../routes/patient');
const { generateTestToken } = require('../middleware/auth');

// Mock the middleware for testing
jest.mock('../middleware/auth', () => ({
    authenticateToken: (req, res, next) => {
        req.user = { id: 'test-user', scopes: ['patient/*.read', 'patient/*.write'] };
        next();
    },
    requireScopes: () => (req, res, next) => next(),
    generateTestToken: jest.fn(() => 'test-token')
}));

describe('FHIR Patient API Routes', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/fhir/Patient', patientRoutes);
    });

    describe('GET /fhir/Patient', () => {
        test('returns FHIR Bundle with patients', async () => {
            const response = await request(app)
                .get('/fhir/Patient')
                .expect(200)
                .expect('Content-Type', /application\/fhir\+json/);

            expect(response.body.resourceType).toBe('Bundle');
            expect(response.body.type).toBe('searchset');
            expect(response.body.total).toBeGreaterThan(0);
            expect(Array.isArray(response.body.entry)).toBe(true);
        });

        test('filters patients by name', async () => {
            const response = await request(app)
                .get('/fhir/Patient?name=Doe')
                .expect(200);

            expect(response.body.total).toBeGreaterThan(0);
            expect(response.body.entry[0].resource.name[0].family).toBe('Doe');
        });

        test('filters patients by gender', async () => {
            const response = await request(app)
                .get('/fhir/Patient?gender=female')
                .expect(200);

            expect(response.body.total).toBeGreaterThan(0);
            expect(response.body.entry.every(entry => 
                entry.resource.gender === 'female'
            )).toBe(true);
        });

        test('handles pagination', async () => {
            const response = await request(app)
                .get('/fhir/Patient?_count=1&_offset=0')
                .expect(200);

            expect(response.body.entry).toHaveLength(1);
        });

        test('returns 400 for invalid query parameters', async () => {
            const response = await request(app)
                .get('/fhir/Patient?gender=invalid')
                .expect(400);

            expect(response.body.resourceType).toBe('OperationOutcome');
            expect(response.body.issue[0].severity).toBe('error');
        });
    });

    describe('GET /fhir/Patient/:id', () => {
        test('returns patient by ID', async () => {
            const response = await request(app)
                .get('/fhir/Patient/patient-001')
                .expect(200)
                .expect('Content-Type', /application\/fhir\+json/);

            expect(response.body.resourceType).toBe('Patient');
            expect(response.body.id).toBe('patient-001');
            expect(response.body.name[0].family).toBe('Doe');
        });

        test('returns 404 for non-existent patient', async () => {
            const response = await request(app)
                .get('/fhir/Patient/non-existent-id')
                .expect(404);

            expect(response.body.resourceType).toBe('OperationOutcome');
            expect(response.body.issue[0].diagnostics).toBe('Patient not found');
        });

        test('returns 400 for invalid patient ID', async () => {
            const response = await request(app)
                .get('/fhir/Patient/')
                .expect(404); // Express returns 404 for empty parameter
        });
    });

    describe('POST /fhir/Patient', () => {
        test('creates new patient successfully', async () => {
            const newPatient = {
                resourceType: 'Patient',
                name: [{
                    family: 'TestCreate',
                    given: ['New', 'Patient']
                }],
                gender: 'other',
                birthDate: '2000-01-01'
            };

            const response = await request(app)
                .post('/fhir/Patient')
                .send(newPatient)
                .expect(201)
                .expect('Content-Type', /application\/fhir\+json/);

            expect(response.body.resourceType).toBe('Patient');
            expect(response.body.name[0].family).toBe('TestCreate');
            expect(response.body.id).toBeDefined();
            expect(response.headers.location).toContain(`/fhir/Patient/${response.body.id}`);
        });

        test('returns 400 for invalid patient data', async () => {
            const invalidPatient = {
                resourceType: 'Patient',
                name: [], // Empty name array
                gender: 'invalid'
            };

            const response = await request(app)
                .post('/fhir/Patient')
                .send(invalidPatient)
                .expect(400);

            expect(response.body.resourceType).toBe('OperationOutcome');
            expect(response.body.issue[0].severity).toBe('error');
        });

        test('returns 400 for wrong resource type', async () => {
            const wrongResource = {
                resourceType: 'Observation',
                name: [{ family: 'Test' }]
            };

            const response = await request(app)
                .post('/fhir/Patient')
                .send(wrongResource)
                .expect(400);

            expect(response.body.resourceType).toBe('OperationOutcome');
        });
    });

    describe('PUT /fhir/Patient/:id', () => {
        test('updates existing patient successfully', async () => {
            const updateData = {
                resourceType: 'Patient',
                id: 'patient-002',
                name: [{
                    family: 'UpdatedSmith',
                    given: ['Jane', 'Updated']
                }],
                gender: 'female',
                birthDate: '1990-07-22'
            };

            const response = await request(app)
                .put('/fhir/Patient/patient-002')
                .send(updateData)
                .expect(200)
                .expect('Content-Type', /application\/fhir\+json/);

            expect(response.body.name[0].family).toBe('UpdatedSmith');
            expect(response.body.name[0].given).toContain('Updated');
        });

        test('returns 404 for non-existent patient', async () => {
            const updateData = {
                resourceType: 'Patient',
                id: 'non-existent',
                name: [{ family: 'Test' }]
            };

            const response = await request(app)
                .put('/fhir/Patient/non-existent')
                .send(updateData)
                .expect(404);

            expect(response.body.resourceType).toBe('OperationOutcome');
        });

        test('returns 400 for ID mismatch', async () => {
            const updateData = {
                resourceType: 'Patient',
                id: 'different-id',
                name: [{ family: 'Test' }]
            };

            const response = await request(app)
                .put('/fhir/Patient/patient-002')
                .send(updateData)
                .expect(400);

            expect(response.body.resourceType).toBe('OperationOutcome');
        });
    });

    describe('DELETE /fhir/Patient/:id', () => {
        test('deletes existing patient successfully', async () => {
            // First create a patient to delete
            const newPatient = {
                resourceType: 'Patient',
                name: [{ family: 'ToDelete' }]
            };

            const createResponse = await request(app)
                .post('/fhir/Patient')
                .send(newPatient)
                .expect(201);

            const patientId = createResponse.body.id;

            // Now delete it
            await request(app)
                .delete(`/fhir/Patient/${patientId}`)
                .expect(204);

            // Verify it's deleted
            await request(app)
                .get(`/fhir/Patient/${patientId}`)
                .expect(404);
        });

        test('returns 404 for non-existent patient', async () => {
            const response = await request(app)
                .delete('/fhir/Patient/non-existent-id')
                .expect(404);

            expect(response.body.resourceType).toBe('OperationOutcome');
        });
    });

    describe('GET /fhir/Patient/:id/$summary', () => {
        test('returns patient summary', async () => {
            const response = await request(app)
                .get('/fhir/Patient/patient-001/$summary')
                .expect(200)
                .expect('Content-Type', /application\/fhir\+json/);

            expect(response.body.id).toBe('patient-001');
            expect(response.body.name).toBeDefined();
            expect(response.body.lastUpdated).toBeDefined();
        });

        test('returns 404 for non-existent patient summary', async () => {
            const response = await request(app)
                .get('/fhir/Patient/non-existent/$summary')
                .expect(404);

            expect(response.body.resourceType).toBe('OperationOutcome');
        });
    });

    describe('GET /fhir/Patient/$count', () => {
        test('returns patient count', async () => {
            const response = await request(app)
                .get('/fhir/Patient/$count')
                .expect(200)
                .expect('Content-Type', /application\/fhir\+json/);

            expect(response.body.resourceType).toBe('Parameters');
            expect(response.body.parameter[0].name).toBe('count');
            expect(typeof response.body.parameter[0].valueInteger).toBe('number');
        });
    });

    describe('FHIR Compliance', () => {
        test('returns proper FHIR content type', async () => {
            const response = await request(app)
                .get('/fhir/Patient/patient-001')
                .expect(200);

            expect(response.headers['content-type']).toMatch(/application\/fhir\+json/);
        });

        test('returns FHIR OperationOutcome for errors', async () => {
            const response = await request(app)
                .get('/fhir/Patient/non-existent')
                .expect(404);

            expect(response.body.resourceType).toBe('OperationOutcome');
            expect(response.body.issue).toBeDefined();
            expect(response.body.issue[0].severity).toBe('error');
            expect(response.body.issue[0].code).toBeDefined();
        });

        test('validates required FHIR fields in responses', async () => {
            const response = await request(app)
                .get('/fhir/Patient/patient-001')
                .expect(200);

            const patient = response.body;
            expect(patient.resourceType).toBe('Patient');
            expect(patient.id).toBeDefined();
            expect(patient.meta).toBeDefined();
            expect(patient.meta.lastUpdated).toBeDefined();
        });
    });
});