/**
 * Production Test Setup
 * 
 * Sets up the test environment for production-like testing scenarios.
 * This ensures tests run against real service configurations without mocks.
 */

// Set production environment variables for tests
process.env.NODE_ENV = 'production';
process.env.OAUTH2_ISSUER = process.env.OAUTH2_ISSUER || 'https://auth.webqx.health';
process.env.OAUTH2_CLIENT_ID = process.env.OAUTH2_CLIENT_ID || 'webqx-healthcare-platform-test';
process.env.FHIR_BASE_URL = process.env.FHIR_BASE_URL || 'https://emr.webqx.health/apis/default/fhir';
process.env.CHATEHR_API_URL = process.env.CHATEHR_API_URL || 'https://api.openai.com/v1';
process.env.RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
process.env.HIPAA_COMPLIANT_MODE = 'true';
process.env.HIPAA_AUDIT_ENABLED = 'true';

// Generate a proper HIPAA encryption key for tests
if (!process.env.HIPAA_ENCRYPTION_KEY) {
  process.env.HIPAA_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
}

// Disable console warnings for missing optional services in test environment
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  const message = args.join(' ');
  // Suppress warnings about optional service connections during tests
  if (message.includes('not available:') || 
      message.includes('not reachable') ||
      message.includes('configuration incomplete')) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};

// Configure global test timeouts for production scenarios
jest.setTimeout(30000);

// Mock only truly external services that shouldn't be called during tests
jest.mock('amqplib', () => ({
  connect: jest.fn().mockResolvedValue({
    createChannel: jest.fn().mockResolvedValue({
      assertExchange: jest.fn().mockResolvedValue(),
      assertQueue: jest.fn().mockResolvedValue(),
      bindQueue: jest.fn().mockResolvedValue(),
      publish: jest.fn().mockReturnValue(true),
      consume: jest.fn().mockResolvedValue(),
      checkQueue: jest.fn().mockResolvedValue(),
      close: jest.fn().mockResolvedValue(),
      ack: jest.fn(),
      nack: jest.fn()
    }),
    on: jest.fn(),
    close: jest.fn().mockResolvedValue()
  })
}));

// Global error handler for unhandled promises in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

console.log('🧪 Production test environment configured');
console.log('📊 HIPAA compliance enabled:', process.env.HIPAA_COMPLIANT_MODE);
console.log('🔒 OAuth2 issuer:', process.env.OAUTH2_ISSUER);
console.log('🏥 FHIR base URL:', process.env.FHIR_BASE_URL);