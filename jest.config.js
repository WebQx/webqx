module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/patient-portal', '<rootDir>/services', '<rootDir>/ehr-integrations', '<rootDir>/modules', '<rootDir>/fhir', '<rootDir>/PACS'],
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
    'PACS/**/*.{ts,tsx}',
    '!patient-portal/**/*.d.ts',
    '!services/**/*.d.ts',
    '!ehr-integrations/**/*.d.ts',
    '!modules/**/*.d.ts',
    '!fhir/**/*.d.ts',
    '!PACS/**/*.d.ts',
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
      testMatch: ['<rootDir>/patient-portal/**/*.(test|spec).+(ts|tsx|js)', '<rootDir>/services/**/*.(test|spec).+(ts|tsx|js)', '<rootDir>/ehr-integrations/**/*.(test|spec).+(ts|tsx|js)', '<rootDir>/modules/**/*.(test|spec).+(ts|tsx|js)', '<rootDir>/PACS/**/*.(test|spec).+(ts|tsx|js)'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest'
      },
      globals: {
        'ts-jest': {
          tsconfig: {
            jsx: 'react-jsx'
          }
        }
      }
    },
    {
      displayName: 'fhir',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/fhir/**/*.(test|spec).+(js)'],
      transform: {
        '^.+\\.js$': 'babel-jest'
      }
    }
  ]
};