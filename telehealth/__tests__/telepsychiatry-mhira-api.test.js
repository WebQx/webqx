/**
 * Test file for Telepsychiatry MHIRA Integration API
 * Tests the OpenAPI specification implementation
 */

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');

// Import the routes we're testing
const consentRoutes = require('../../routes/consent');
const emrRoutes = require('../../routes/emr');

// Create test app
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/consent', consentRoutes);
app.use('/emr', emrRoutes);

describe('Telepsychiatry MHIRA Integration API', () => {
  // Mock session for authentication
  const mockSession = 'test-session-123';
  
  beforeEach(() => {
    // Reset any stored data between tests by clearing console warnings
    jest.clearAllMocks();
    // Clear the in-memory storage by requiring fresh modules
    delete require.cache[require.resolve('../../routes/consent')];
    delete require.cache[require.resolve('../../routes/emr')];
  });

  describe('POST /consent/record', () => {
    test('should record GDPR-compliant patient consent', async () => {
      const consentData = {
        patient_id: 'patient-123',
        timestamp: '2024-01-15T10:00:00Z',
        purpose: 'Telepsychiatry consultation and data processing'
      };

      const response = await request(app)
        .post('/consent/record')
        .set('x-session-id', mockSession)
        .send(consentData)
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Consent recorded',
        status: 'recorded'
      });
      expect(response.body.consentId).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });

    test('should validate required fields', async () => {
      const invalidData = {
        patient_id: 'patient-123'
        // Missing timestamp and purpose
      };

      const response = await request(app)
        .post('/consent/record')
        .set('x-session-id', mockSession)
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Valid timestamp is required' }),
          expect.objectContaining({ msg: 'Purpose is required' })
        ])
      );
    });

    test('should require authentication', async () => {
      const consentData = {
        patient_id: 'patient-123',
        timestamp: '2024-01-15T10:00:00Z',
        purpose: 'Telepsychiatry consultation'
      };

      const response = await request(app)
        .post('/consent/record')
        .send(consentData)
        .expect(401);

      expect(response.body.error).toBe('UNAUTHORIZED');
    });

    test('should validate timestamp format', async () => {
      const invalidData = {
        patient_id: 'patient-123',
        timestamp: 'invalid-date',
        purpose: 'Telepsychiatry consultation'
      };

      const response = await request(app)
        .post('/consent/record')
        .set('x-session-id', mockSession)
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Valid timestamp is required' })
        ])
      );
    });
  });

  describe('POST /consent/revoke', () => {
    test('should revoke patient consent', async () => {
      // First record a consent in a single test
      const testPatientId = 'patient-revoke-test-' + Date.now();
      const consentData = {
        patient_id: testPatientId,
        timestamp: '2024-01-15T10:00:00Z',
        purpose: 'Telepsychiatry consultation'
      };

      await request(app)
        .post('/consent/record')
        .set('x-session-id', mockSession)
        .send(consentData)
        .expect(200);

      // Then revoke it in the same test
      const revokeData = {
        patient_id: testPatientId,
        reason: 'Patient withdrew consent'
      };

      const response = await request(app)
        .post('/consent/revoke')
        .set('x-session-id', mockSession)
        .send(revokeData)
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Consent revoked',
        patient_id: testPatientId,
        reason: 'Patient withdrew consent'
      });
      expect(response.body.revokedConsentIds).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });

    test('should validate required fields for revoke', async () => {
      const invalidData = {
        patient_id: 'patient-123'
        // Missing reason
      };

      const response = await request(app)
        .post('/consent/revoke')
        .set('x-session-id', mockSession)
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Reason is required' })
        ])
      );
    });

    test('should handle no active consent to revoke', async () => {
      const revokeData = {
        patient_id: 'non-existent-patient',
        reason: 'Patient withdrew consent'
      };

      const response = await request(app)
        .post('/consent/revoke')
        .set('x-session-id', mockSession)
        .send(revokeData)
        .expect(404);

      expect(response.body.error).toBe('NO_ACTIVE_CONSENT');
    });

    test('should require authentication for revoke', async () => {
      const revokeData = {
        patient_id: 'patient-123',
        reason: 'Patient withdrew consent'
      };

      const response = await request(app)
        .post('/consent/revoke')
        .send(revokeData)
        .expect(401);

      expect(response.body.error).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /emr/export/:id', () => {
    test('should export patient data in FHIR format by default', async () => {
      const response = await request(app)
        .get('/emr/export/patient-123')
        .set('x-session-id', mockSession)
        .expect(200);

      expect(response.headers['content-type']).toContain('application/fhir+json');
      expect(response.body.resourceType).toBe('Bundle');
      expect(response.body.type).toBe('collection');
      expect(response.body.entry).toBeDefined();
      expect(response.body.total).toBeGreaterThan(0);
    });

    test('should export patient data in FHIR format when specified', async () => {
      const response = await request(app)
        .get('/emr/export/patient-123?format=fhir')
        .set('x-session-id', mockSession)
        .expect(200);

      expect(response.headers['content-type']).toContain('application/fhir+json');
      expect(response.body.resourceType).toBe('Bundle');
      expect(response.body.type).toBe('collection');
    });

    test('should export patient data in CSV format when specified', async () => {
      const response = await request(app)
        .get('/emr/export/patient-123?format=csv')
        .set('x-session-id', mockSession)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.text).toContain('"ResourceType","ResourceId","PatientId"');
    });

    test('should validate patient ID format', async () => {
      const response = await request(app)
        .get('/emr/export/invalid@id')
        .set('x-session-id', mockSession)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Valid patient ID is required' })
        ])
      );
    });

    test('should validate format parameter', async () => {
      const response = await request(app)
        .get('/emr/export/patient-123?format=invalid')
        .set('x-session-id', mockSession)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Format must be either "fhir" or "csv"' })
        ])
      );
    });

    test('should require authentication for export', async () => {
      const response = await request(app)
        .get('/emr/export/patient-123')
        .expect(401);

      expect(response.body.error).toBe('UNAUTHORIZED');
    });

    test('should include proper FHIR Bundle structure', async () => {
      const response = await request(app)
        .get('/emr/export/patient-123?format=fhir')
        .set('x-session-id', mockSession)
        .expect(200);

      const bundle = response.body;
      expect(bundle.resourceType).toBe('Bundle');
      expect(bundle.type).toBe('collection');
      expect(bundle.timestamp).toBeDefined();
      expect(bundle.total).toBeDefined();
      expect(bundle.entry).toBeInstanceOf(Array);
      
      // Check that we have patient resource
      const patientEntry = bundle.entry.find(entry => 
        entry.resource && entry.resource.resourceType === 'Patient'
      );
      expect(patientEntry).toBeDefined();
    });

    test('should handle CSV format with proper headers', async () => {
      const response = await request(app)
        .get('/emr/export/patient-123?format=csv')
        .set('x-session-id', mockSession)
        .expect(200);

      const csvContent = response.text;
      const lines = csvContent.split('\n');
      
      // Check CSV headers
      expect(lines[0]).toContain('ResourceType');
      expect(lines[0]).toContain('ResourceId');
      expect(lines[0]).toContain('PatientId');
      expect(lines[0]).toContain('Date');
      expect(lines[0]).toContain('Code');
      expect(lines[0]).toContain('Display');
      expect(lines[0]).toContain('Value');
      expect(lines[0]).toContain('Unit');
      
      // Should have at least patient data
      expect(lines.length).toBeGreaterThan(1);
    });
  });

  describe('GDPR Compliance', () => {
    test('should handle consent lifecycle properly', async () => {
      const patientId = 'gdpr-test-patient-' + Date.now();
      
      // 1. Record consent
      const consentData = {
        patient_id: patientId,
        timestamp: '2024-01-15T10:00:00Z',
        purpose: 'GDPR compliant data processing for telepsychiatry'
      };

      const recordResponse = await request(app)
        .post('/consent/record')
        .set('x-session-id', mockSession)
        .send(consentData)
        .expect(200);
      
      expect(recordResponse.body.message).toBe('Consent recorded');
      
      // 2. Export data (should work with consent)
      const exportResponse = await request(app)
        .get(`/emr/export/${patientId}`)
        .set('x-session-id', mockSession)
        .expect(200);
      
      expect(exportResponse.body.resourceType).toBe('Bundle');
      
      // 3. Revoke consent
      const revokeData = {
        patient_id: patientId,
        reason: 'GDPR Article 7(3) - Right to withdraw consent'
      };

      const revokeResponse = await request(app)
        .post('/consent/revoke')
        .set('x-session-id', mockSession)
        .send(revokeData)
        .expect(200);
      
      expect(revokeResponse.body.message).toBe('Consent revoked');
    });
  });

  describe('FHIR Compliance', () => {
    test('should return valid FHIR Bundle structure', async () => {
      const response = await request(app)
        .get('/emr/export/patient-fhir-test')
        .set('x-session-id', mockSession)
        .expect(200);

      const bundle = response.body;
      
      // Validate FHIR Bundle structure
      expect(bundle.resourceType).toBe('Bundle');
      expect(bundle.id).toBeDefined();
      expect(bundle.type).toBe('collection');
      expect(bundle.timestamp).toBeDefined();
      expect(bundle.total).toBeDefined();
      expect(bundle.entry).toBeInstanceOf(Array);
      
      // Validate entry structure
      bundle.entry.forEach(entry => {
        expect(entry.fullUrl).toBeDefined();
        expect(entry.resource).toBeDefined();
        expect(entry.resource.resourceType).toBeDefined();
        expect(entry.resource.id).toBeDefined();
      });
    });
  });
});