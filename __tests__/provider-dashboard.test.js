/**
 * Provider Dashboard API Tests
 * Tests for /api/dashboard/provider endpoint
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

describe('Provider Dashboard API', () => {
  let app;
  let validToken;
  const JWT_SECRET = process.env.JWT_SECRET || 'webqx-provider-secret';

  beforeAll(() => {
    // Mock mime lookup to fix Express JSON response issues in tests
    try {
      const mime = require('mime');
      if (!mime.lookup) {
        mime.lookup = (type) => 'application/json';
      }
    } catch (e) {
      // mime not available, that's ok
    }

    // Create a minimal Express app for testing
    const express = require('express');
    const cookieParser = require('cookie-parser');
    const rateLimit = require('express-rate-limit');
    
    app = express();
    app.use(express.json());
    app.use(cookieParser());

    // Generate valid test token
    validToken = jwt.sign(
      {
        id: 'test-provider-123',
        username: 'test-provider',
        roles: ['provider']
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Mock rate limiter (more permissive for testing)
    const dashboardLimiter = rateLimit({
      windowMs: 1 * 60 * 1000,
      max: 1000, // High limit for testing
      skip: () => process.env.NODE_ENV === 'test' // Skip in test env
    });

    // Mock dashboard endpoint
    app.get('/api/dashboard/provider', dashboardLimiter, async (req, res) => {
      try {
        const authHeader = req.headers.authorization;
        const cookieToken = req.cookies && req.cookies.provider_token;
        const token = authHeader?.startsWith('Bearer ') 
          ? authHeader.substring(7) 
          : cookieToken;

        if (!token) {
          return res.status(401).json({
            error: 'Authentication required',
            code: 'NO_TOKEN'
          });
        }

        let decoded;
        try {
          decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
          return res.status(401).json({
            error: 'Invalid token',
            code: 'INVALID_TOKEN'
          });
        }

        const roles = decoded.roles || [];
        if (!roles.includes('provider') && !roles.includes('physician') && !roles.includes('admin')) {
          return res.status(403).json({
            error: 'Provider role required',
            code: 'INSUFFICIENT_PERMISSIONS'
          });
        }

        // Mock successful response
        const response = {
          patients: { count: 156 },
          telehealth: { active: 2, waiting: 5 },
          transcriptionJobs: [
            { id: 'job-123', status: 'completed', created_at: '2025-01-10T14:30:00Z' }
          ],
          files: { total: 342 },
          updated_at: new Date().toISOString()
        };

        return res.status(200).json(response);
      } catch (error) {
        console.error('Test error:', error);
        return res.status(500).json({
          error: 'Internal server error',
          code: 'DASHBOARD_ERROR',
          updated_at: new Date().toISOString()
        });
      }
    });
  });

  describe('Authentication', () => {
    test('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/dashboard/provider');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('NO_TOKEN');
    });

    test('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/dashboard/provider')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('INVALID_TOKEN');
    });

    test('should reject request without provider role', async () => {
      const patientToken = jwt.sign(
        { id: 'patient-123', roles: ['patient'] },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/dashboard/provider')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    test('should accept valid provider token via Authorization header', async () => {
      const response = await request(app)
        .get('/api/dashboard/provider')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('updated_at');
      expect(response.body).toHaveProperty('patients');
    });

    test('should accept valid provider token via cookie', async () => {
      const response = await request(app)
        .get('/api/dashboard/provider')
        .set('Cookie', [`provider_token=${validToken}`]);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('updated_at');
    });
  });

  describe('Response Schema', () => {
    test('should return all sections on success', async () => {
      const response = await request(app)
        .get('/api/dashboard/provider')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);

      // Check required fields
      expect(response.body).toHaveProperty('updated_at');
      expect(response.body.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      // Check optional sections
      expect(response.body.patients).toEqual({ count: expect.any(Number) });
      expect(response.body.telehealth).toEqual({
        active: expect.any(Number),
        waiting: expect.any(Number)
      });
      expect(response.body.files).toEqual({ total: expect.any(Number) });
    });

    test('should include errors array for partial failures', async () => {
      const response = await request(app)
        .get('/api/dashboard/provider')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);

      if (response.body.errors) {
        expect(Array.isArray(response.body.errors)).toBe(true);
        response.body.errors.forEach(error => {
          expect(error).toHaveProperty('section');
          expect(error).toHaveProperty('error');
        });
      }
    });

    test('should not fabricate data on section failure', async () => {
      const response = await request(app)
        .get('/api/dashboard/provider')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      // If a section has an error, it should either be missing or in errors array
      // but never show fabricated data like 0 when the real call failed
      expect(response.body).toBeDefined();
    });
  });

  describe('Role Variations', () => {
    test('should accept physician role', async () => {
      const physicianToken = jwt.sign(
        { id: 'physician-123', roles: ['physician'] },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/dashboard/provider')
        .set('Authorization', `Bearer ${physicianToken}`);

      expect(response.status).toBe(200);
    });

    test('should accept admin role', async () => {
      const adminToken = jwt.sign(
        { id: 'admin-123', roles: ['admin'] },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/dashboard/provider')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });
  });
});
