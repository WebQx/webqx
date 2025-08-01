const request = require('supertest');
const express = require('express');
const authRoutes = require('../auth/authRoutes');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

// Add a setup to wait for user initialization
beforeAll(async () => {
    // Wait for test users to be initialized
    await new Promise(resolve => setTimeout(resolve, 100));
});

describe('Authentication API', () => {
    describe('POST /api/auth/login', () => {
        test('should login with valid credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'john.doe@example.com',
                    password: 'password123'
                });

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                success: true,
                message: 'Login successful',
                user: {
                    name: 'John Doe',
                    email: 'john.doe@example.com',
                    accountStatus: 'active'
                }
            });
            expect(response.body.token).toBeDefined();
            expect(typeof response.body.token).toBe('string');
        });

        test('should reject invalid credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'john.doe@example.com',
                    password: 'wrongpassword'
                });

            expect(response.status).toBe(401);
            expect(response.body).toMatchObject({
                success: false,
                error: 'Invalid credentials',
                code: 'INVALID_CREDENTIALS'
            });
        });

        test('should reject non-existent user', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'nonexistent@example.com',
                    password: 'password123'
                });

            expect(response.status).toBe(401);
            expect(response.body).toMatchObject({
                success: false,
                error: 'Invalid credentials',
                code: 'INVALID_CREDENTIALS'
            });
        });

        test('should reject locked account', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'locked@example.com',
                    password: 'password123'
                });

            expect(response.status).toBe(423);
            expect(response.body).toMatchObject({
                success: false,
                error: 'Account is locked. Please contact support.',
                code: 'ACCOUNT_LOCKED'
            });
        });

        test('should validate email format', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'invalid-email',
                    password: 'password123'
                });

            expect(response.status).toBe(400);
            expect(response.body).toMatchObject({
                success: false,
                error: 'Validation failed',
                code: 'VALIDATION_ERROR'
            });
        });

        test('should require email and password', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({});

            expect(response.status).toBe(400);
            expect(response.body).toMatchObject({
                success: false,
                error: 'Validation failed',
                code: 'VALIDATION_ERROR'
            });
        });
    });

    describe('POST /api/auth/register', () => {
        test('should register new user with valid data', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Test User',
                    email: 'test.user@example.com',
                    password: 'Password123'
                });

            expect(response.status).toBe(201);
            expect(response.body).toMatchObject({
                success: true,
                message: 'Registration successful',
                user: {
                    name: 'Test User',
                    email: 'test.user@example.com',
                    accountStatus: 'active'
                }
            });
        });

        test('should reject registration with existing email', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'John Doe',
                    email: 'john.doe@example.com',
                    password: 'Password123'
                });

            expect(response.status).toBe(409);
            expect(response.body).toMatchObject({
                success: false,
                error: 'User with this email already exists',
                code: 'USER_EXISTS'
            });
        });

        test('should validate password strength', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Test User',
                    email: 'weak.password@example.com',
                    password: 'weak'
                });

            expect(response.status).toBe(400);
            expect(response.body).toMatchObject({
                success: false,
                error: 'Validation failed',
                code: 'VALIDATION_ERROR'
            });
        });

        test('should require all fields', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Test User'
                    // Missing email and password
                });

            expect(response.status).toBe(400);
            expect(response.body).toMatchObject({
                success: false,
                error: 'Validation failed',
                code: 'VALIDATION_ERROR'
            });
        });
    });

    describe('GET /api/auth/profile', () => {
        let authToken;

        beforeAll(async () => {
            // Get auth token for testing
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'john.doe@example.com',
                    password: 'password123'
                });
            authToken = loginResponse.body.token;
        });

        test('should get user profile with valid token', async () => {
            const response = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                success: true,
                user: {
                    name: 'John Doe',
                    email: 'john.doe@example.com',
                    accountStatus: 'active'
                }
            });
        });

        test('should reject request without token', async () => {
            const response = await request(app)
                .get('/api/auth/profile');

            expect(response.status).toBe(401);
            expect(response.body).toMatchObject({
                success: false,
                error: 'Authorization token required',
                code: 'NO_TOKEN'
            });
        });

        test('should reject request with invalid token', async () => {
            const response = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', 'Bearer invalid-token');

            expect(response.status).toBe(401);
            expect(response.body).toMatchObject({
                success: false,
                code: 'INVALID_TOKEN'
            });
        });
    });

    describe('POST /api/auth/logout', () => {
        test('should logout successfully', async () => {
            const response = await request(app)
                .post('/api/auth/logout');

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                success: true,
                message: 'Logout successful. Please remove the token from client storage.'
            });
        });
    });

    describe('Rate Limiting', () => {
        test('should enforce rate limiting on login attempts', async () => {
            // Skip this test in test environment since rate limiting is disabled for testing
            if (process.env.NODE_ENV === 'test') {
                console.log('Skipping rate limiting test in test environment');
                return;
            }

            // Make multiple login attempts to trigger rate limiting
            const requests = [];
            for (let i = 0; i < 6; i++) {
                requests.push(
                    request(app)
                        .post('/api/auth/login')
                        .send({
                            email: 'test@example.com',
                            password: 'wrongpassword'
                        })
                );
            }

            const responses = await Promise.all(requests);
            
            // The last request should be rate limited
            const lastResponse = responses[responses.length - 1];
            expect(lastResponse.status).toBe(429);
            expect(lastResponse.body).toMatchObject({
                error: 'Too many authentication attempts, please try again later.',
                code: 'TOO_MANY_REQUESTS'
            });
        }, 10000); // Increase timeout for rate limiting test
    });
});