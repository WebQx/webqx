module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/__tests__', '<rootDir>/patient-portal', '<rootDir>/services', '<rootDir>/ehr-integrations', '<rootDir>/modules', '<rootDir>/fhir', '<rootDir>/openehr', '<rootDir>/auth', '<rootDir>/interoperability', '<rootDir>/sso', '<rootDir>/telehealth', '<rootDir>/compliance'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx'
      }
    }]
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    '__tests__/**/*.{ts,tsx}',
    'utils/**/*.{ts,tsx}',
    'patient-portal/**/*.{ts,tsx}',
    'services/**/*.{ts,tsx}',
    'ehr-integrations/**/*.{ts,tsx}',
    'modules/**/*.{ts,tsx}',
    'compliance/**/*.{ts,tsx}',
    'fhir/**/*.{js}',
    'sso/**/*.{ts,tsx}',
    'openehr/**/*.{js}',
    'auth/**/*.{ts,tsx}',
    'interoperability/**/*.{ts,tsx}',
    'telehealth/**/*.{js}',
    '!__tests__/**/*.d.ts',
    '!utils/**/*.d.ts',
    '!patient-portal/**/*.d.ts',
    '!services/**/*.d.ts',
    '!ehr-integrations/**/*.d.ts',
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
    '\\.(css|less|scss)$': 'identity-obj-proxy'
  },
  testEnvironmentOptions: {
    node: true
  },
  projects: [
    {
      displayName: 'frontend',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/__tests__/**/*.(test|spec).+(ts|tsx|js)', '<rootDir>/patient-portal/**/*.(test|spec).+(ts|tsx|js)', '<rootDir>/services/**/*.(test|spec).+(ts|tsx|js)', '<rootDir>/ehr-integrations/**/*.(test|spec).+(ts|tsx|js)', '<rootDir>/modules/**/*.(test|spec).+(ts|tsx|js)', '<rootDir>/compliance/**/*.(test|spec).+(ts|tsx|js)', '<rootDir>/interoperability/**/*.(test|spec).+(ts|tsx|js)', '<rootDir>/sso/**/*.(test|spec).+(ts|tsx|js)'],
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
      displayName: 'auth',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/auth/**/*.(test|spec).+(ts|js)'],
      transform: {
        '^.+\\.(ts)$': 'ts-jest',
        '^.+\\.js$': 'babel-jest'
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
      displayName: 'openehr',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/openehr/**/*.(test|spec).+(js)'],
      transform: {
        '^.+\\.js$': 'babel-jest'
      }
    },
    {
      displayName: 'telehealth',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/telehealth/**/*.(test|spec).+(js)'],
      transform: {
        '^.+\\.js$': 'babel-jest'
      }
    },
    {
      displayName: 'auth',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/patient-portal/__tests__/auth.test.js', '<rootDir>/patient-portal/__tests__/userService.test.js'],
      transform: {
        '^.+\\.js$': 'babel-jest'
      }
    }
  ]
};