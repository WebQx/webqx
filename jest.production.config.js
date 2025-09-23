/**
 * Production Test Configuration
 * 
 * This configuration is used for testing production-like scenarios
 * without relying on mocks or development shortcuts.
 */

module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/patient-portal', '<rootDir>/services', '<rootDir>/modules', '<rootDir>/fhir', '<rootDir>/openehr', '<rootDir>/auth', '<rootDir>/interoperability', '<rootDir>/sso', '<rootDir>/telehealth', '<rootDir>/compliance'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
  },
  // Transform ES modules in node_modules
  transformIgnorePatterns: [
    'node_modules/(?!(jose|jwks-rsa|@azure/identity|@azure/core-|@azure/logger|amqplib)/)'
  ],
  // Force resolving dependencies (like react/react-dom) from the root only
  moduleDirectories: ['<rootDir>/node_modules'],
  testPathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/portal/dist/', '<rootDir>/coverage/'],
  watchPathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/portal/dist/', '<rootDir>/coverage/'],
  setupFiles: ['<rootDir>/jest.polyfills.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js', '<rootDir>/jest.production.setup.js'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  modulePathIgnorePatterns: ['<rootDir>/patient-portal/node_modules', '<rootDir>/dist'],
  collectCoverageFrom: [
    'patient-portal/**/*.{ts,tsx}',
    'services/**/*.{ts,tsx}',
    'modules/**/*.{ts,tsx}',
    'compliance/**/*.{ts,tsx}',
    'fhir/**/*.{js}',
    'sso/**/*.{ts,tsx}',
    'openehr/**/*.{js}',
    'auth/**/*.{ts,tsx}',
    'interoperability/**/*.{ts,tsx}',
  'telehealth/**/*.{js}',
    '!patient-portal/**/*.d.ts',
    '!services/**/*.d.ts',
    '!modules/**/*.d.ts',
    '!compliance/**/*.d.ts',
    '!fhir/**/*.d.ts',
    '!sso/**/*.d.ts',
    '!openehr/**/*.d.ts',
    '!auth/**/*.d.ts',
    '!interoperability/**/*.d.ts',
    '!telehealth/**/*.d.ts',
  ],
  moduleNameMapper: {
    '\\.(css|less|scss)$': 'identity-obj-proxy',
    '^\\.\\.\\/\\.\\.\\/prescriptions/services/whisperTranslator$': '<rootDir>/patient-portal/prescriptions/services/whisperTranslator.ts',
    '^react$': require.resolve('react'),
    '^react/jsx-runtime$': require.resolve('react/jsx-runtime'),
    '^react-dom$': require.resolve('react-dom'),
    '^react-dom/client$': require.resolve('react-dom/client')
  },
  testEnvironmentOptions: {
    node: true
  },
  // Global test configuration for production scenarios
  globals: {
    NODE_ENV: 'production',
    OAUTH2_ISSUER: 'https://auth.webqx.health',
    FHIR_BASE_URL: 'https://emr.webqx.health/apis/default/fhir',
    CHATEHR_API_URL: 'https://api.openai.com/v1',
    RABBITMQ_URL: 'amqp://localhost:5672',
    HIPAA_COMPLIANT_MODE: 'true'
  },
  // Increase timeout for production-like tests that may involve real network calls
  testTimeout: 30000,
  // Retry flaky tests once
  retryTimes: 1
};