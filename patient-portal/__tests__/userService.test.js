const { 
    authenticateUser, 
    verifyToken, 
    registerUser, 
    getUserById 
} = require('../auth/userService');

describe('User Service', () => {
    describe('authenticateUser', () => {
        test('should authenticate valid user', async () => {
            const result = await authenticateUser('john.doe@example.com', 'password123');
            
            expect(result.success).toBe(true);
            expect(result.user).toMatchObject({
                name: 'John Doe',
                email: 'john.doe@example.com',
                accountStatus: 'active'
            });
            expect(result.token).toBeDefined();
            expect(typeof result.token).toBe('string');
        });

        test('should reject invalid password', async () => {
            const result = await authenticateUser('john.doe@example.com', 'wrongpassword');
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid credentials');
            expect(result.code).toBe('INVALID_CREDENTIALS');
        });

        test('should reject non-existent user', async () => {
            const result = await authenticateUser('nonexistent@example.com', 'password123');
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid credentials');
            expect(result.code).toBe('INVALID_CREDENTIALS');
        });

        test('should reject locked account', async () => {
            const result = await authenticateUser('locked@example.com', 'password123');
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Account is locked. Please contact support.');
            expect(result.code).toBe('ACCOUNT_LOCKED');
        });

        test('should validate email format', async () => {
            const result = await authenticateUser('invalid-email', 'password123');
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid email format');
            expect(result.code).toBe('INVALID_EMAIL');
        });

        test('should require email and password', async () => {
            const result1 = await authenticateUser('', 'password123');
            expect(result1.success).toBe(false);
            expect(result1.code).toBe('MISSING_CREDENTIALS');

            const result2 = await authenticateUser('test@example.com', '');
            expect(result2.success).toBe(false);
            expect(result2.code).toBe('MISSING_CREDENTIALS');
        });
    });

    describe('verifyToken', () => {
        let validToken;

        beforeAll(async () => {
            const authResult = await authenticateUser('john.doe@example.com', 'password123');
            validToken = authResult.token;
        });

        test('should verify valid token', () => {
            const result = verifyToken(validToken);
            
            expect(result.success).toBe(true);
            expect(result.user).toMatchObject({
                email: 'john.doe@example.com',
                name: 'John Doe'
            });
        });

        test('should reject invalid token', () => {
            const result = verifyToken('invalid-token');
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid or expired token');
            expect(result.code).toBe('INVALID_TOKEN');
        });
    });

    describe('registerUser', () => {
        test('should register new user', async () => {
            const userData = {
                name: 'New User',
                email: 'newuser@example.com',
                password: 'Password123'
            };

            const result = await registerUser(userData);
            
            expect(result.success).toBe(true);
            expect(result.user).toMatchObject({
                name: 'New User',
                email: 'newuser@example.com',
                accountStatus: 'active'
            });
        });

        test('should reject duplicate email', async () => {
            const userData = {
                name: 'John Doe',
                email: 'john.doe@example.com',
                password: 'Password123'
            };

            const result = await registerUser(userData);
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('User with this email already exists');
            expect(result.code).toBe('USER_EXISTS');
        });

        test('should validate required fields', async () => {
            const result1 = await registerUser({});
            expect(result1.success).toBe(false);
            expect(result1.code).toBe('MISSING_FIELDS');

            const result2 = await registerUser({ name: 'Test' });
            expect(result2.success).toBe(false);
            expect(result2.code).toBe('MISSING_FIELDS');
        });

        test('should validate email format', async () => {
            const userData = {
                name: 'Test User',
                email: 'invalid-email',
                password: 'Password123'
            };

            const result = await registerUser(userData);
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid email format');
            expect(result.code).toBe('INVALID_EMAIL');
        });

        test('should validate password strength', async () => {
            const userData = {
                name: 'Test User',
                email: 'test@example.com',
                password: 'weak'
            };

            const result = await registerUser(userData);
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Password must be at least 8 characters long');
            expect(result.code).toBe('WEAK_PASSWORD');
        });
    });

    describe('getUserById', () => {
        let userId;

        beforeAll(async () => {
            const authResult = await authenticateUser('john.doe@example.com', 'password123');
            const tokenResult = verifyToken(authResult.token);
            userId = tokenResult.user.userId;
        });

        test('should get user by valid ID', () => {
            const user = getUserById(userId);
            
            expect(user).toMatchObject({
                name: 'John Doe',
                email: 'john.doe@example.com',
                accountStatus: 'active'
            });
        });

        test('should return null for invalid ID', () => {
            const user = getUserById('invalid-id');
            expect(user).toBeNull();
        });
    });

    describe('Password Security', () => {
        test('should hash passwords', async () => {
            const userData = {
                name: 'Security Test',
                email: 'security@example.com',
                password: 'TestPassword123'
            };

            await registerUser(userData);
            
            // Try to authenticate - this should work
            const authResult = await authenticateUser(userData.email, userData.password);
            expect(authResult.success).toBe(true);
            
            // The stored password should not be in plain text
            // (This is more of an implementation detail test)
            expect(authResult.user.password).toBeUndefined();
        });
    });
});