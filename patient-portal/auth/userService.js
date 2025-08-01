const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// In-memory user store for demo purposes
// In production, this would be replaced with a database
const users = new Map();

// Default test users
const initializeTestUsers = async () => {
    const testUsers = [
        {
            id: uuidv4(),
            name: 'John Doe',
            email: 'john.doe@example.com',
            password: 'password123',
            phoneNumber: '+1-555-0123',
            mfaEnabled: true,
            accountStatus: 'active'
        },
        {
            id: uuidv4(),
            name: 'Jane Smith',
            email: 'jane.smith@example.com',
            password: 'password123',
            phoneNumber: '+1-555-0456',
            mfaEnabled: false,
            accountStatus: 'active'
        },
        {
            id: uuidv4(),
            name: 'Locked User',
            email: 'locked@example.com',
            password: 'password123',
            phoneNumber: '+1-555-0789',
            mfaEnabled: true,
            accountStatus: 'locked'
        }
    ];

    for (const user of testUsers) {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        users.set(user.email, {
            ...user,
            password: hashedPassword
        });
    }
    
    console.log('🔐 Test users initialized for patient portal');
};

// Initialize test users on module load
initializeTestUsers();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Authenticate user with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Object} Authentication result
 */
const authenticateUser = async (email, password) => {
    try {
        // Input validation
        if (!email || !password) {
            return {
                success: false,
                error: 'Email and password are required',
                code: 'MISSING_CREDENTIALS'
            };
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return {
                success: false,
                error: 'Invalid email format',
                code: 'INVALID_EMAIL'
            };
        }

        // Find user
        const user = users.get(email.toLowerCase());
        if (!user) {
            return {
                success: false,
                error: 'Invalid credentials',
                code: 'INVALID_CREDENTIALS'
            };
        }

        // Check account status
        if (user.accountStatus === 'locked') {
            return {
                success: false,
                error: 'Account is locked. Please contact support.',
                code: 'ACCOUNT_LOCKED'
            };
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return {
                success: false,
                error: 'Invalid credentials',
                code: 'INVALID_CREDENTIALS'
            };
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user.id, 
                email: user.email,
                name: user.name 
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        return {
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phoneNumber: user.phoneNumber,
                mfaEnabled: user.mfaEnabled,
                accountStatus: user.accountStatus
            },
            token
        };

    } catch (error) {
        console.error('Authentication error:', error);
        return {
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        };
    }
};

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Object} Verification result
 */
const verifyToken = (token) => {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return {
            success: true,
            user: decoded
        };
    } catch (error) {
        return {
            success: false,
            error: 'Invalid or expired token',
            code: 'INVALID_TOKEN'
        };
    }
};

/**
 * Register a new user
 * @param {Object} userData - User data
 * @returns {Object} Registration result
 */
const registerUser = async (userData) => {
    try {
        const { name, email, password, phoneNumber } = userData;

        // Input validation
        if (!name || !email || !password) {
            return {
                success: false,
                error: 'Name, email, and password are required',
                code: 'MISSING_FIELDS'
            };
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return {
                success: false,
                error: 'Invalid email format',
                code: 'INVALID_EMAIL'
            };
        }

        // Validate phone number format if provided
        if (phoneNumber) {
            const phoneRegex = /^\+[1-9]\d{1,14}$/; // E.164 format
            if (!phoneRegex.test(phoneNumber)) {
                return {
                    success: false,
                    error: 'Invalid phone number format. Use E.164 format (e.g., +1234567890)',
                    code: 'INVALID_PHONE'
                };
            }
        }

        // Check password strength
        if (password.length < 8) {
            return {
                success: false,
                error: 'Password must be at least 8 characters long',
                code: 'WEAK_PASSWORD'
            };
        }

        // Check if user already exists
        if (users.has(email.toLowerCase())) {
            return {
                success: false,
                error: 'User with this email already exists',
                code: 'USER_EXISTS'
            };
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const newUser = {
            id: uuidv4(),
            name: name.trim(),
            email: email.toLowerCase(),
            password: hashedPassword,
            phoneNumber: phoneNumber || null,
            mfaEnabled: false, // Default to false, can be enabled later
            accountStatus: 'active'
        };

        users.set(newUser.email, newUser);

        return {
            success: true,
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                phoneNumber: newUser.phoneNumber,
                mfaEnabled: newUser.mfaEnabled,
                accountStatus: newUser.accountStatus
            }
        };

    } catch (error) {
        console.error('Registration error:', error);
        return {
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        };
    }
};

/**
 * Get user by ID
 * @param {string} userId - User ID
 * @returns {Object} User data or null
 */
const getUserById = (userId) => {
    for (const user of users.values()) {
        if (user.id === userId) {
            return {
                id: user.id,
                name: user.name,
                email: user.email,
                phoneNumber: user.phoneNumber,
                mfaEnabled: user.mfaEnabled,
                accountStatus: user.accountStatus
            };
        }
    }
    return null;
};

/**
 * Update user MFA settings
 * @param {string} userId - User ID
 * @param {boolean} enabled - MFA enabled status
 * @returns {Object} Update result
 */
const updateUserMFA = (userId, enabled) => {
    for (const [email, user] of users.entries()) {
        if (user.id === userId) {
            user.mfaEnabled = enabled;
            users.set(email, user);
            return {
                success: true,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    mfaEnabled: user.mfaEnabled,
                    accountStatus: user.accountStatus
                }
            };
        }
    }
    return {
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
    };
};

/**
 * Get user by email
 * @param {string} email - User email
 * @returns {Object} User data or null
 */
const getUserByEmail = (email) => {
    const user = users.get(email.toLowerCase());
    if (user) {
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            phoneNumber: user.phoneNumber,
            mfaEnabled: user.mfaEnabled,
            accountStatus: user.accountStatus
        };
    }
    return null;
};

module.exports = {
    authenticateUser,
    verifyToken,
    registerUser,
    getUserById,
    updateUserMFA,
    getUserByEmail
};