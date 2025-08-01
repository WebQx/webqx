const request = require('supertest');
const express = require('express');

// Import the server setup
const app = express();
app.use(express.json());

// Import routes
const ehrRoutes = require('../routes/ehr');
const compositionRoutes = require('../routes/composition');
const queryRoutes = require('../routes/query');

// Set up test routes
app.use('/openehr/v1/ehr', ehrRoutes);
app.use('/openehr/v1', compositionRoutes);
app.use('/openehr/v1/query', queryRoutes);

describe('openEHR Mock Server', () => {
  describe('EHR Resource', () => {
    test('should get EHR by ID', async () => {
      const response = await request(app)
        .get('/openehr/v1/ehr/ehr-001')
        .expect(200);

      expect(response.body.ehr_id).toBe('ehr-001');
      expect(response.body.system_id).toBe('webqx.health');
      expect(response.body.ehr_status).toBeDefined();
    });

    test('should create a new EHR', async () => {
      const newEHR = {
        subject_id: 'test-patient-123'
      };

      const response = await request(app)
        .post('/openehr/v1/ehr')
        .send(newEHR)
        .expect(201);

      expect(response.body.ehr_id).toBeDefined();
      expect(response.body.system_id).toBe('webqx.health');
      expect(response.body.ehr_status.subject.external_ref.id.value).toBe('test-patient-123');
    });

    test('should get EHR status', async () => {
      const response = await request(app)
        .get('/openehr/v1/ehr/ehr-001/ehr_status')
        .expect(200);

      expect(response.body.archetype_node_id).toBe('openEHR-EHR-EHR_STATUS.generic.v1');
      expect(response.body.subject).toBeDefined();
    });

    test('should return 404 for non-existent EHR', async () => {
      await request(app)
        .get('/openehr/v1/ehr/non-existent')
        .expect(404);
    });
  });

  describe('Composition Resource', () => {
    test('should get all compositions', async () => {
      const response = await request(app)
        .get('/openehr/v1/composition')
        .expect(200);

      expect(response.body.total).toBeGreaterThan(0);
      expect(response.body.compositions).toBeDefined();
      expect(Array.isArray(response.body.compositions)).toBe(true);
    });

    test('should get composition by UID', async () => {
      const response = await request(app)
        .get('/openehr/v1/composition/comp-001::webqx.health::1')
        .expect(200);

      expect(response.body.uid).toBe('comp-001::webqx.health::1');
      expect(response.body.name.value).toBe('Patient Encounter');
      expect(response.body.composer.name).toBe('Dr. Sarah Johnson');
    });

    test('should create a new composition', async () => {
      const newComposition = {
        name: { value: 'Test Composition' },
        composer: { name: 'Test Composer' },
        archetype_node_id: 'openEHR-EHR-COMPOSITION.test.v1',
        content: []
      };

      const response = await request(app)
        .post('/openehr/v1/ehr/ehr-001/composition')
        .set('openEHR-TEMPLATE_ID', 'test.template')
        .send(newComposition)
        .expect(201);

      expect(response.body.uid).toBeDefined();
      expect(response.body.name.value).toBe('Test Composition');
      expect(response.body.composer.name).toBe('Test Composer');
    });

    test('should search compositions by EHR', async () => {
      const response = await request(app)
        .get('/openehr/v1/composition?ehr_id=ehr-001')
        .expect(200);

      expect(response.body.total).toBeGreaterThan(0);
      expect(response.body.compositions).toBeDefined();
    });

    test('should return 404 for non-existent composition', async () => {
      await request(app)
        .get('/openehr/v1/composition/non-existent::uid::1')
        .expect(404);
    });
  });

  describe('AQL Query', () => {
    test('should execute AQL query via POST', async () => {
      const aqlQuery = {
        q: 'SELECT c FROM COMPOSITION c'
      };

      const response = await request(app)
        .post('/openehr/v1/query/aql')
        .send(aqlQuery)
        .expect(200);

      expect(response.body.meta).toBeDefined();
      expect(response.body.q).toBe('SELECT c FROM COMPOSITION c');
      expect(response.body.rows).toBeDefined();
      expect(Array.isArray(response.body.rows)).toBe(true);
    });

    test('should execute AQL query via GET', async () => {
      const response = await request(app)
        .get('/openehr/v1/query/aql?q=SELECT%20c%20FROM%20COMPOSITION%20c')
        .expect(200);

      expect(response.body.meta).toBeDefined();
      expect(response.body.q).toBe('SELECT c FROM COMPOSITION c');
    });

    test('should return 400 for invalid AQL query', async () => {
      await request(app)
        .post('/openehr/v1/query/aql')
        .send({})
        .expect(400);
    });
  });
});