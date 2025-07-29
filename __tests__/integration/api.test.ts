/**
 * Comprehensive API Integration Tests
 * 
 * Tests all API endpoints, authentication, security, and integration points
 * of the WebQx healthcare platform.
 */

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { createTestEnvironment, cleanupTestEnvironment, testConfig } from '../setup/test-environment';
import MockServiceManager from '../mocks/services';

// Import the server app
const app = require('../../server.js');

describe('API Integration Tests', () => {
  let mockServices: MockServiceManager;
  let testToken: string;

  beforeAll(async () => {
    createTestEnvironment();
    mockServices = new MockServiceManager();
    mockServices.setupAllMocks();

    // Generate test JWT token
    testToken = jwt.sign(
      { 
        sub: 'test-user-123',
        scope: 'patient/*.read patient/*.write user/*.read user/*.write',
        iss: 'webqx-test',
        aud: 'webqx-api'
      },
      testConfig.security.jwtSecret,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    mockServices.cleanupAllMocks();
    cleanupTestEnvironment();
  });

  describe('Health Check Endpoint', () => {
    test('GET /health should return system status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'healthy',
        service: 'WebQX Healthcare Platform',
        fhir: 'enabled',
        timestamp: expect.any(String)
      });

      // Validate timestamp format
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

    test('Health check should include proper headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check security headers from Helmet
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('FHIR OAuth2 Endpoints', () => {
    test('GET /oauth/authorize should handle authorization request', async () => {
      const response = await request(app)
        .get('/oauth/authorize')
        .query({
          response_type: 'code',
          client_id: 'test-client',
          redirect_uri: 'https://app.webqx.health/callback',
          scope: 'patient/*.read',
          state: 'test-state-123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('authorizationUrl');
      expect(response.body).toHaveProperty('state');
    });

    test('POST /oauth/token should exchange code for token', async () => {
      const response = await request(app)
        .post('/oauth/token')
        .send({
          grant_type: 'authorization_code',
          code: 'test-auth-code',
          client_id: 'test-client',
          client_secret: 'test-secret',
          redirect_uri: 'https://app.webqx.health/callback'
        })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('token_type', 'Bearer');
      expect(response.body).toHaveProperty('expires_in');
      expect(response.body).toHaveProperty('scope');
    });

    test('POST /oauth/token should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/oauth/token')
        .send({
          grant_type: 'authorization_code',
          code: 'invalid-code',
          client_id: 'invalid-client',
          client_secret: 'invalid-secret'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('invalid_grant');
    });
  });

  describe('FHIR Metadata Endpoint', () => {
    test('GET /fhir/metadata should return capability statement', async () => {
      const response = await request(app)
        .get('/fhir/metadata')
        .expect(200);

      expect(response.body).toHaveProperty('resourceType', 'CapabilityStatement');
      expect(response.body).toHaveProperty('status', 'active');
      expect(response.body).toHaveProperty('fhirVersion');
      expect(response.body).toHaveProperty('rest');

      // Check that it includes required resources
      const resources = response.body.rest[0].resource;
      const resourceTypes = resources.map((r: any) => r.type);
      expect(resourceTypes).toContain('Patient');
      expect(resourceTypes).toContain('Appointment');
    });

    test('Capability statement should include proper security configuration', async () => {
      const response = await request(app)
        .get('/fhir/metadata')
        .expect(200);

      expect(response.body.rest[0]).toHaveProperty('security');
      expect(response.body.rest[0].security).toHaveProperty('service');
    });
  });

  describe('FHIR Patient Resource', () => {
    test('GET /fhir/Patient should require authentication', async () => {
      const response = await request(app)
        .get('/fhir/Patient')
        .expect(401);

      expect(response.body).toHaveProperty('resourceType', 'OperationOutcome');
      expect(response.body.issue[0]).toHaveProperty('severity', 'error');
      expect(response.body.issue[0]).toHaveProperty('code', 'security');
    });

    test('GET /fhir/Patient with valid token should return patient bundle', async () => {
      const response = await request(app)
        .get('/fhir/Patient')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('resourceType', 'Bundle');
      expect(response.body).toHaveProperty('type', 'searchset');
      expect(response.body).toHaveProperty('entry');
      expect(Array.isArray(response.body.entry)).toBe(true);
    });

    test('GET /fhir/Patient/:id should return specific patient', async () => {
      const patientId = 'test-patient-123';
      const response = await request(app)
        .get(`/fhir/Patient/${patientId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('resourceType', 'Patient');
      expect(response.body).toHaveProperty('id', patientId);
      expect(response.body).toHaveProperty('active');
    });

    test('GET /fhir/Patient with search parameters', async () => {
      const response = await request(app)
        .get('/fhir/Patient')
        .query({
          family: 'Doe',
          given: 'John',
          birthdate: '1990-01-01'
        })
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('resourceType', 'Bundle');
      expect(response.body.entry.length).toBeGreaterThan(0);
    });

    test('Should handle invalid patient ID', async () => {
      const response = await request(app)
        .get('/fhir/Patient/invalid-id')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('resourceType', 'OperationOutcome');
      expect(response.body.issue[0]).toHaveProperty('severity', 'error');
      expect(response.body.issue[0]).toHaveProperty('code', 'not-found');
    });
  });

  describe('FHIR Appointment Resource', () => {
    test('POST /fhir/Appointment should create new appointment', async () => {
      const newAppointment = {
        resourceType: 'Appointment',
        status: 'booked',
        start: '2024-02-15T10:00:00Z',
        end: '2024-02-15T10:30:00Z',
        participant: [{
          actor: {
            reference: 'Patient/test-patient-123'
          },
          status: 'accepted'
        }]
      };

      const response = await request(app)
        .post('/fhir/Appointment')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Content-Type', 'application/fhir+json')
        .send(newAppointment)
        .expect(201);

      expect(response.body).toHaveProperty('resourceType', 'Appointment');
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('status', 'booked');
    });

    test('POST /fhir/Appointment should validate required fields', async () => {
      const invalidAppointment = {
        resourceType: 'Appointment',
        // Missing required fields
      };

      const response = await request(app)
        .post('/fhir/Appointment')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Content-Type', 'application/fhir+json')
        .send(invalidAppointment)
        .expect(400);

      expect(response.body).toHaveProperty('resourceType', 'OperationOutcome');
      expect(response.body.issue[0]).toHaveProperty('severity', 'error');
      expect(response.body.issue[0]).toHaveProperty('code', 'required');
    });

    test('GET /fhir/Appointment should return appointment bundle', async () => {
      const response = await request(app)
        .get('/fhir/Appointment')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('resourceType', 'Bundle');
      expect(response.body).toHaveProperty('type', 'searchset');
    });
  });

  describe('Translation API', () => {
    test('POST /api/whisper/translate should translate text', async () => {
      const response = await request(app)
        .post('/api/whisper/translate')
        .send({
          text: 'Take 2 tablets daily',
          targetLang: 'es'
        })
        .expect(200);

      expect(response.body).toHaveProperty('translatedText');
      expect(response.body).toHaveProperty('sourceLanguage', 'en');
      expect(response.body).toHaveProperty('targetLanguage', 'es');
      expect(response.body).toHaveProperty('confidence');
      expect(response.body.confidence).toBeGreaterThan(0);
    });

    test('POST /api/whisper/translate should validate input', async () => {
      const response = await request(app)
        .post('/api/whisper/translate')
        .send({
          text: '',  // Invalid: empty text
          targetLang: 'es'
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('code', 'INVALID_TEXT');
    });

    test('POST /api/whisper/translate should validate language code', async () => {
      const response = await request(app)
        .post('/api/whisper/translate')
        .send({
          text: 'Test text',
          targetLang: 'invalid-lang'  // Invalid language code
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('code', 'INVALID_LANG_CODE');
    });

    test('Should handle known translations', async () => {
      const response = await request(app)
        .post('/api/whisper/translate')
        .send({
          text: 'Take 2 tablets daily',
          targetLang: 'es'
        })
        .expect(200);

      expect(response.body.translatedText).toBe('Tomar 2 tabletas al día');
      expect(response.body.confidence).toBe(0.95);
    });

    test('Should handle fallback translations', async () => {
      const response = await request(app)
        .post('/api/whisper/translate')
        .send({
          text: 'Unknown medical instruction',
          targetLang: 'es'
        })
        .expect(200);

      expect(response.body.translatedText).toContain('[ES]');
      expect(response.body.confidence).toBe(0.75);
    });
  });

  describe('Rate Limiting', () => {
    test('FHIR endpoints should enforce rate limits', async () => {
      // Make multiple rapid requests to test rate limiting
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .get('/fhir/metadata')
          .expect((res) => {
            expect([200, 429]).toContain(res.status);
          })
      );

      await Promise.all(requests);
    });

    test('Rate limit should return proper error format', async () => {
      // First, exhaust the rate limit
      const rapidRequests = Array(101).fill(null).map(() =>
        request(app).get('/fhir/metadata')
      );

      await Promise.allSettled(rapidRequests);

      // This request should be rate limited
      const response = await request(app)
        .get('/fhir/metadata');

      if (response.status === 429) {
        expect(response.body).toHaveProperty('resourceType', 'OperationOutcome');
        expect(response.body.issue[0]).toHaveProperty('code', 'throttled');
      }
    });
  });

  describe('CORS Configuration', () => {
    test('FHIR endpoints should have proper CORS headers', async () => {
      const response = await request(app)
        .options('/fhir/metadata')
        .set('Origin', 'https://app.webqx.health')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
      expect(response.headers).toHaveProperty('access-control-allow-headers');
    });

    test('Should handle preflight requests', async () => {
      const response = await request(app)
        .options('/fhir/Patient')
        .set('Origin', 'https://app.webqx.health')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type,Authorization')
        .expect(204);

      expect(response.headers['access-control-allow-methods']).toContain('POST');
      expect(response.headers['access-control-allow-headers']).toContain('Authorization');
    });
  });

  describe('Security Headers', () => {
    test('All endpoints should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check Helmet security headers
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });

    test('Should prevent clickjacking', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.headers['x-frame-options']).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('Should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/whisper/translate')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    test('Should handle unsupported media type', async () => {
      const response = await request(app)
        .post('/fhir/Patient')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Content-Type', 'text/plain')
        .send('plain text')
        .expect(415);

      expect(response.body).toHaveProperty('resourceType', 'OperationOutcome');
    });

    test('Should handle method not allowed', async () => {
      const response = await request(app)
        .delete('/health')
        .expect(405);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Authentication and Authorization', () => {
    test('Should reject expired tokens', async () => {
      const expiredToken = jwt.sign(
        { sub: 'test-user', scope: 'patient/*.read' },
        testConfig.security.jwtSecret,
        { expiresIn: '-1h' }  // Expired 1 hour ago
      );

      const response = await request(app)
        .get('/fhir/Patient')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('resourceType', 'OperationOutcome');
      expect(response.body.issue[0]).toHaveProperty('code', 'security');
    });

    test('Should reject invalid signatures', async () => {
      const invalidToken = jwt.sign(
        { sub: 'test-user', scope: 'patient/*.read' },
        'wrong-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/fhir/Patient')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('resourceType', 'OperationOutcome');
    });

    test('Should check required scopes', async () => {
      const limitedToken = jwt.sign(
        { sub: 'test-user', scope: 'patient/*.read' },  // No write scope
        testConfig.security.jwtSecret,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .post('/fhir/Appointment')
        .set('Authorization', `Bearer ${limitedToken}`)
        .send({
          resourceType: 'Appointment',
          status: 'booked'
        })
        .expect(403);

      expect(response.body).toHaveProperty('resourceType', 'OperationOutcome');
      expect(response.body.issue[0]).toHaveProperty('code', 'forbidden');
    });
  });

  describe('Static File Serving', () => {
    test('Should serve main page', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/html/);
    });

    test('Should serve patient portal for SPA routes', async () => {
      const response = await request(app)
        .get('/patient/dashboard')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/html/);
    });
  });

  describe('Development Endpoints', () => {
    beforeAll(() => {
      process.env.NODE_ENV = 'development';
    });

    afterAll(() => {
      process.env.NODE_ENV = 'test';
    });

    test('GET /dev/token should provide test token in development', async () => {
      const response = await request(app)
        .get('/dev/token')
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('token_type', 'Bearer');
      expect(response.body).toHaveProperty('expires_in', 3600);
      expect(response.body).toHaveProperty('scope');

      // Verify the token is valid
      const token = response.body.access_token;
      const decoded = jwt.verify(token, testConfig.security.jwtSecret);
      expect(decoded).toHaveProperty('sub');
      expect(decoded).toHaveProperty('scope');
    });
  });
});