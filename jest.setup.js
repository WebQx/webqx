require('@testing-library/jest-dom');

// Polyfill for TextEncoder/TextDecoder (needed for authentication system)
const { TextEncoder, TextDecoder } = require('util');

// Make them globally available
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Set up environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.BCRYPT_ROUNDS = '10';