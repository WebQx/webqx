const express = require('express');
const supertest = require('supertest');
const app = require('../server-lambda');

describe('Lambda Server', () => {
  let request;

  beforeAll(() => {
    request = supertest(app);
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        service: 'WebQX Healthcare Platform (Lambda)',
        fhir: 'enabled',
        openehr: 'enabled'
      });

      expect(response.body.lambda).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('FHIR Endpoints', () => {
    it('should return FHIR capability statement', async () => {
      const response = await request
        .get('/fhir/metadata')
        .expect(200);

      expect(response.body.resourceType).toBe('CapabilityStatement');
    });

    it('should require authentication for patient endpoints', async () => {
      await request
        .get('/fhir/Patient')
        .expect(401);
    });
  });

  describe('Translation API', () => {
    it('should translate text to Spanish', async () => {
      const response = await request
        .post('/api/whisper/translate')
        .send({
          text: 'Take 2 tablets daily',
          targetLang: 'es'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        translatedText: 'Tomar 2 tabletas al día',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        confidence: 0.95
      });
    });

    it('should validate input parameters', async () => {
      await request
        .post('/api/whisper/translate')
        .send({
          text: '',
          targetLang: 'es'
        })
        .expect(400);
    });
  });

  describe('Static Files', () => {
    it('should serve the main page', async () => {
      const response = await request
        .get('/')
        .expect(200);

      expect(response.text).toContain('html');
    });

    it('should serve login page', async () => {
      const response = await request
        .get('/login')
        .expect(200);

      expect(response.text).toContain('html');
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 routes gracefully', async () => {
      await request
        .get('/nonexistent-endpoint')
        .expect(200); // Falls back to index.html for SPA routing
    });
  });
});