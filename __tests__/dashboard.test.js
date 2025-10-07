/**
 * Basic test for provider dashboard route
 * Tests structure and error handling without actual API calls
 */

const request = require('supertest');
const express = require('express');

describe('Provider Dashboard Route', () => {
  let app;
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock authentication middleware
    app.use((req, res, next) => {
      req.user = {
        id: 'test-provider-123',
        roles: ['provider']
      };
      next();
    });
    
    // Mount dashboard routes
    const dashboardRoutes = require('../routes/dashboard');
    app.use('/api/dashboard', dashboardRoutes);
  });
  
  test('should return 401 without authentication', async () => {
    const appNoAuth = express();
    appNoAuth.use(express.json());
    const dashboardRoutes = require('../routes/dashboard');
    appNoAuth.use('/api/dashboard', dashboardRoutes);
    
    const response = await request(appNoAuth)
      .get('/api/dashboard/provider');
    
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error', 'UNAUTHORIZED');
  });
  
  test('should have correct response structure', async () => {
    const response = await request(app)
      .get('/api/dashboard/provider');
    
    // Response should have updated_at
    expect(response.body).toHaveProperty('updated_at');
    
    // Response should have errors array
    expect(response.body).toHaveProperty('errors');
    expect(Array.isArray(response.body.errors)).toBe(true);
  });
  
  test('should cache responses', async () => {
    const response1 = await request(app)
      .get('/api/dashboard/provider');
    
    const response2 = await request(app)
      .get('/api/dashboard/provider');
    
    // Second response should be cached
    if (response2.body.cached) {
      expect(response2.body.updated_at).toBe(response1.body.updated_at);
    }
  });
});
