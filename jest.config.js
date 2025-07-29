module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/patient-portal', '<rootDir>/services', '<rootDir>/modules', '<rootDir>/auth', '<rootDir>/ehr-integrations', '<rootDir>/interoperability'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'patient-portal/**/*.{ts,tsx}',
    'services/**/*.{ts,tsx}',
    'modules/**/*.{ts,tsx}',
    'auth/**/*.{ts,tsx}',
    'ehr-integrations/**/*.{ts,tsx}',
    'interoperability/**/*.{ts,tsx}',
    '!patient-portal/**/*.d.ts',
    '!services/**/*.d.ts',
    '!modules/**/*.d.ts',
    '!auth/**/*.d.ts',
    '!ehr-integrations/**/*.d.ts',
    '!interoperability/**/*.d.ts',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '\\.(css|less|scss)$': 'identity-obj-proxy'
  },
  globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react-jsx'
      }
    }
  }
};