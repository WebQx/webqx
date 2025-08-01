const request = require('supertest');
const express = require('express');

// Import the server setup
const app = express();
app.use(express.json());

// Import routes
const patientRoutes = require('../routes/patient');
const observationRoutes = require('../routes/observation');

// Set up test routes
app.use('/fhir/Patient', patientRoutes);
app.use('/fhir/Observation', observationRoutes);

describe('FHIR Mock Server', () => {
  describe('Patient Resource', () => {
    test('should get all patients', async () => {
      const response = await request(app)
        .get('/fhir/Patient')
        .expect(200);

      expect(response.body.resourceType).toBe('Bundle');
      expect(response.body.type).toBe('searchset');
      expect(response.body.total).toBeGreaterThan(0);
      expect(response.body.entry).toBeDefined();
      expect(Array.isArray(response.body.entry)).toBe(true);
    });

    test('should get patient by ID', async () => {
      const response = await request(app)
        .get('/fhir/Patient/patient-001')
        .expect(200);

      expect(response.body.resourceType).toBe('Patient');
      expect(response.body.id).toBe('patient-001');
      expect(response.body.name).toBeDefined();
    });

    test('should create a new patient', async () => {
      const newPatient = {
        resourceType: 'Patient',
        name: [{
          use: 'official',
          family: 'Test',
          given: ['Mock', 'Patient']
        }],
        gender: 'other',
        birthDate: '1995-05-15'
      };

      const response = await request(app)
        .post('/fhir/Patient')
        .send(newPatient)
        .expect(201);

      expect(response.body.resourceType).toBe('Patient');
      expect(response.body.id).toBeDefined();
      expect(response.body.name[0].family).toBe('Test');
    });

    test('should return 404 for non-existent patient', async () => {
      await request(app)
        .get('/fhir/Patient/non-existent')
        .expect(404);
    });
  });

  describe('Observation Resource', () => {
    test('should get all observations', async () => {
      const response = await request(app)
        .get('/fhir/Observation')
        .expect(200);

      expect(response.body.resourceType).toBe('Bundle');
      expect(response.body.type).toBe('searchset');
      expect(response.body.total).toBeGreaterThan(0);
    });

    test('should get observation by ID', async () => {
      const response = await request(app)
        .get('/fhir/Observation/observation-001')
        .expect(200);

      expect(response.body.resourceType).toBe('Observation');
      expect(response.body.id).toBe('observation-001');
      expect(response.body.status).toBe('final');
    });

    test('should create a new observation', async () => {
      const newObservation = {
        resourceType: 'Observation',
        status: 'final',
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '29463-7',
            display: 'Body weight'
          }]
        },
        subject: {
          reference: 'Patient/patient-001'
        },
        valueQuantity: {
          value: 70,
          unit: 'kg',
          system: 'http://unitsofmeasure.org',
          code: 'kg'
        }
      };

      const response = await request(app)
        .post('/fhir/Observation')
        .send(newObservation)
        .expect(201);

      expect(response.body.resourceType).toBe('Observation');
      expect(response.body.id).toBeDefined();
      expect(response.body.status).toBe('final');
    });

    test('should search observations by patient', async () => {
      const response = await request(app)
        .get('/fhir/Observation?patient=patient-001')
        .expect(200);

      expect(response.body.resourceType).toBe('Bundle');
      expect(response.body.entry.length).toBeGreaterThan(0);
    });
  });
});