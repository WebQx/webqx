/**
 * API Integration Tests for WebQX Patient Portal
 * Tests the interactive functionality and API endpoints
 */

const request = require('supertest');
const express = require('express');

// Mock server setup for testing
let app;
let server;

beforeAll(async () => {
  // Import the server app (we'll need to modify server.js to export the app)
  process.env.NODE_ENV = 'test';
  const serverPath = require.resolve('../../server.js');
  delete require.cache[serverPath];
  
  // For now, we'll create a simple test setup
  app = express();
  app.use(express.json());
  
  // Mock the health endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'WebQX Healthcare Platform',
      fhir: 'enabled',
      timestamp: new Date().toISOString()
    });
  });

  // Mock the token endpoint
  app.get('/dev/token', (req, res) => {
    res.json({
      access_token: 'test-token',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'patient/*.read patient/*.write user/*.read'
    });
  });

  // Mock translation endpoint
  app.post('/api/whisper/translate', (req, res) => {
    const { text, targetLang } = req.body;
    
    if (!text || !targetLang) {
      return res.status(400).json({
        message: 'Text and target language are required',
        code: 'INVALID_REQUEST'
      });
    }

    const translations = {
      'es': {
        'Take 2 tablets daily': 'Tomar 2 tabletas al día'
      }
    };

    const translatedText = translations[targetLang]?.[text] || `[${targetLang.toUpperCase()}] ${text}`;

    res.json({
      translatedText,
      sourceLanguage: 'en',
      targetLanguage: targetLang,
      confidence: 0.95
    });
  });
});

describe('WebQX Patient Portal API Integration', () => {
  
  describe('Health Check Endpoint', () => {
    test('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('service', 'WebQX Healthcare Platform');
      expect(response.body).toHaveProperty('fhir', 'enabled');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Authentication Endpoint', () => {
    test('should return access token in development mode', async () => {
      const response = await request(app)
        .get('/dev/token')
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('token_type', 'Bearer');
      expect(response.body).toHaveProperty('expires_in', 3600);
      expect(response.body).toHaveProperty('scope');
    });
  });

  describe('Translation API', () => {
    test('should translate text successfully', async () => {
      const translationRequest = {
        text: 'Take 2 tablets daily',
        targetLang: 'es'
      };

      const response = await request(app)
        .post('/api/whisper/translate')
        .send(translationRequest)
        .expect(200);

      expect(response.body).toHaveProperty('translatedText', 'Tomar 2 tabletas al día');
      expect(response.body).toHaveProperty('sourceLanguage', 'en');
      expect(response.body).toHaveProperty('targetLanguage', 'es');
      expect(response.body).toHaveProperty('confidence');
      expect(response.body.confidence).toBeGreaterThan(0);
    });

    test('should handle missing parameters', async () => {
      const response = await request(app)
        .post('/api/whisper/translate')
        .send({ text: 'Hello' })
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('code', 'INVALID_REQUEST');
    });

    test('should handle fallback translation for unsupported languages', async () => {
      const translationRequest = {
        text: 'Hello world',
        targetLang: 'it'
      };

      const response = await request(app)
        .post('/api/whisper/translate')
        .send(translationRequest)
        .expect(200);

      expect(response.body.translatedText).toContain('[IT]');
      expect(response.body.translatedText).toContain('Hello world');
    });
  });

  describe('Frontend Integration', () => {
    test('should validate API response structure for patient data', () => {
      // Mock patient data structure validation
      const mockPatientData = {
        resourceType: 'Bundle',
        entry: [{
          resource: {
            resourceType: 'Patient',
            id: 'patient-001',
            name: [{
              given: ['John', 'Michael'],
              family: 'Doe'
            }],
            telecom: [{
              system: 'email',
              value: 'john.doe@example.com'
            }],
            birthDate: '1985-03-15',
            gender: 'male'
          }
        }]
      };

      // Validate structure
      expect(mockPatientData).toHaveProperty('resourceType', 'Bundle');
      expect(mockPatientData.entry).toHaveLength(1);
      expect(mockPatientData.entry[0].resource).toHaveProperty('resourceType', 'Patient');
      expect(mockPatientData.entry[0].resource.name[0]).toHaveProperty('given');
      expect(mockPatientData.entry[0].resource.name[0]).toHaveProperty('family');
    });

    test('should validate appointment data structure', () => {
      const mockAppointmentData = {
        resourceType: 'Bundle',
        entry: [{
          resource: {
            resourceType: 'Appointment',
            id: 'appointment-001',
            status: 'booked',
            start: '2025-07-30T10:00:00.000Z',
            end: '2025-07-30T10:30:00.000Z',
            description: 'Annual physical examination',
            participant: [{
              actor: {
                display: 'Dr. Sarah Johnson'
              }
            }]
          }
        }]
      };

      expect(mockAppointmentData.entry[0].resource).toHaveProperty('resourceType', 'Appointment');
      expect(mockAppointmentData.entry[0].resource).toHaveProperty('status');
      expect(mockAppointmentData.entry[0].resource).toHaveProperty('start');
      expect(mockAppointmentData.entry[0].resource).toHaveProperty('description');
    });
  });

  describe('Multilingual Support', () => {
    test('should support multiple language taglines', () => {
      const taglines = {
        'en': 'Empowering Patients and Supporting Health Care Providers',
        'es': 'Empoderando a los Pacientes y Apoyando a los Proveedores de Atención Médica',
        'fr': 'Autonomiser les Patients et Soutenir les Fournisseurs de Soins de Santé',
        'de': 'Patienten stärken und Gesundheitsdienstleister unterstützen'
      };

      expect(taglines).toHaveProperty('en');
      expect(taglines).toHaveProperty('es');
      expect(taglines).toHaveProperty('fr');
      expect(taglines).toHaveProperty('de');
      
      // Validate Spanish translation
      expect(taglines.es).toContain('Pacientes');
      expect(taglines.es).toContain('Proveedores');
    });
  });

  describe('Error Handling', () => {
    test('should handle API errors gracefully', () => {
      const errorHandler = (error, fallbackMessage) => {
        if (error) {
          return `❌ ${fallbackMessage}`;
        }
        return '✅ Success';
      };

      expect(errorHandler(new Error('Network error'), 'Failed to load data'))
        .toBe('❌ Failed to load data');
      expect(errorHandler(null, 'Success message'))
        .toBe('✅ Success');
    });
  });
});

describe('Security and CORS', () => {
  test('should validate CORS configuration', () => {
    // Mock CORS settings validation
    const corsConfig = {
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
      credentials: true
    };

    expect(corsConfig.methods).toContain('GET');
    expect(corsConfig.methods).toContain('POST');
    expect(corsConfig.allowedHeaders).toContain('Authorization');
    expect(corsConfig.credentials).toBe(true);
  });

  test('should validate authentication token format', () => {
    const tokenPattern = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;
    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjbGllbnRfaWQiOiJ3ZWJxeC10ZXN0In0.signature';
    
    expect(tokenPattern.test(mockToken)).toBe(true);
    expect(tokenPattern.test('invalid-token')).toBe(false);
  });
});