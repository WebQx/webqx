module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/patient-portal', '<rootDir>/services', '<rootDir>/ehr-integrations', '<rootDir>/modules', '<rootDir>/fhir', '<rootDir>/__tests__'],
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
    'ehr-integrations/**/*.{ts,tsx}',
    'modules/**/*.{ts,tsx}',
    'fhir/**/*.{js}',
    '__tests__/**/*.{ts,tsx}',
    '!patient-portal/**/*.d.ts',
    '!services/**/*.d.ts',
    '!ehr-integrations/**/*.d.ts',
    '!modules/**/*.d.ts',
    '!fhir/**/*.d.ts',
    '!__tests__/**/*.d.ts',
    '!__tests__/setup/**/*',
    '!__tests__/mocks/**/*'
  ],
  moduleNameMapper: {
    '\\.(css|less|scss)$': 'identity-obj-proxy'
  },
  testEnvironmentOptions: {
    node: true
  },
  projects: [
    {
      displayName: 'frontend',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/patient-portal/**/*.(test|spec).+(ts|tsx|js)', '<rootDir>/services/**/*.(test|spec).+(ts|tsx|js)', '<rootDir>/ehr-integrations/**/*.(test|spec).+(ts|tsx|js)', '<rootDir>/modules/**/*.(test|spec).+(ts|tsx|js)'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {
          tsconfig: {
            jsx: 'react-jsx'
          }
        }]
      }
    },
    {
      displayName: 'fhir',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/fhir/**/*.(test|spec).+(js)'],
      transform: {
        '^.+\\.js$': 'babel-jest'
      }
    },
    {
      displayName: 'integration',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/integration/**/*.(test|spec).+(ts|js)'],
      setupFilesAfterEnv: ['<rootDir>/__tests__/setup/test-environment.ts'],
      transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {
          tsconfig: {
            module: 'commonjs',
            target: 'es2020',
            lib: ['es2020'],
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            strict: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true
          }
        }]
      },
      testTimeout: 30000
    }
  ],
  coverageReporters: ['text', 'html', 'lcov', 'json'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};