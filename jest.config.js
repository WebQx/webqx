module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/patient-portal', '<rootDir>/services', '<rootDir>/ehr-integrations', '<rootDir>/modules', '<rootDir>/fhir', '<rootDir>/openehr', '<rootDir>/auth', '<rootDir>/interoperability', '<rootDir>/sso', '<rootDir>/telehealth', '<rootDir>/compliance'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  modulePathIgnorePatterns: ['<rootDir>/patient-portal/node_modules', '<rootDir>/dist'],
  collectCoverageFrom: [
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
    '\\.(css|less|scss)$': 'identity-obj-proxy',
    '^keycloak-js$': '<rootDir>/__mocks__/keycloak-js.js',
    '^@azure/identity$': '<rootDir>/__mocks__/@azure-identity.js',
    '^@microsoft/microsoft-graph-client$': '<rootDir>/__mocks__/@microsoft-microsoft-graph-client.js',
    '^jwks-rsa$': '<rootDir>/__mocks__/jwks-rsa.js',
    '^\\.\.\/\\.\.\/prescriptions/services/whisperTranslator$': '<rootDir>/patient-portal/prescriptions/services/whisperTranslator.ts',
    '^react$': require.resolve('react'),
    '^react/jsx-runtime$': require.resolve('react/jsx-runtime'),
    '^react-dom$': require.resolve('react-dom'),
    '^react-dom/client$': require.resolve('react-dom/client')
  },
  testEnvironmentOptions: {
    node: true
  },
  projects: [
    {
      displayName: 'frontend',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/patient-portal/**/*.(test|spec).+(ts|tsx|js)', '<rootDir>/services/**/*.(test|spec).+(ts|tsx|js)', '<rootDir>/ehr-integrations/**/*.(test|spec).+(ts|tsx|js)', '<rootDir>/modules/**/*.(test|spec).+(ts|tsx|js)', '<rootDir>/compliance/**/*.(test|spec).+(ts|tsx|js)', '<rootDir>/interoperability/**/*.(test|spec).+(ts|tsx|js)', '<rootDir>/sso/**/*.(test|spec).+(ts|tsx|js)'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  modulePathIgnorePatterns: ['<rootDir>/patient-portal/node_modules', '<rootDir>/dist'],
      moduleNameMapper: {
        '\\.(css|less|scss)$': 'identity-obj-proxy',
        '^keycloak-js$': '<rootDir>/__mocks__/keycloak-js.js',
        '^@azure/identity$': '<rootDir>/__mocks__/@azure-identity.js',
        '^@microsoft/microsoft-graph-client$': '<rootDir>/__mocks__/@microsoft-microsoft-graph-client.js',
        '^jwks-rsa$': '<rootDir>/__mocks__/jwks-rsa.js',
        '^\\.\.\/\\.\.\/prescriptions/services/whisperTranslator$': '<rootDir>/patient-portal/prescriptions/services/whisperTranslator.ts',
        '^react$': require.resolve('react'),
        '^react/jsx-runtime$': require.resolve('react/jsx-runtime'),
        '^react-dom$': require.resolve('react-dom'),
        '^react-dom/client$': require.resolve('react-dom/client')
      },
      transform: {
        '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
      }
    },
    {
      displayName: 'auth',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/auth/**/*.(test|spec).+(ts|js)'],
      moduleNameMapper: {
        '\\.(css|less|scss)$': 'identity-obj-proxy',
        '^keycloak-js$': '<rootDir>/__mocks__/keycloak-js.js',
        '^@azure/identity$': '<rootDir>/__mocks__/@azure-identity.js',
        '^@microsoft/microsoft-graph-client$': '<rootDir>/__mocks__/@microsoft-microsoft-graph-client.js',
        '^react$': require.resolve('react'),
        '^react/jsx-runtime$': require.resolve('react/jsx-runtime'),
        '^react-dom$': require.resolve('react-dom'),
        '^react-dom/client$': require.resolve('react-dom/client')
      },
      transform: {
        '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
      }
    },
    {
      displayName: 'fhir',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/fhir/**/*.(test|spec).+(js)'],
      moduleNameMapper: {
        '\\.(css|less|scss)$': 'identity-obj-proxy',
        '^keycloak-js$': '<rootDir>/__mocks__/keycloak-js.js',
        '^@azure/identity$': '<rootDir>/__mocks__/@azure-identity.js',
        '^@microsoft/microsoft-graph-client$': '<rootDir>/__mocks__/@microsoft-microsoft-graph-client.js',
        '^react$': require.resolve('react'),
        '^react/jsx-runtime$': require.resolve('react/jsx-runtime'),
        '^react-dom$': require.resolve('react-dom'),
        '^react-dom/client$': require.resolve('react-dom/client')
      },
      transform: {
        '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
      }
    },
    {
      displayName: 'openehr',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/openehr/**/*.(test|spec).+(js)'],
      moduleNameMapper: {
        '\\.(css|less|scss)$': 'identity-obj-proxy',
        '^keycloak-js$': '<rootDir>/__mocks__/keycloak-js.js',
        '^@azure/identity$': '<rootDir>/__mocks__/@azure-identity.js',
        '^@microsoft/microsoft-graph-client$': '<rootDir>/__mocks__/@microsoft-microsoft-graph-client.js',
        '^react$': require.resolve('react'),
        '^react/jsx-runtime$': require.resolve('react/jsx-runtime'),
        '^react-dom$': require.resolve('react-dom'),
        '^react-dom/client$': require.resolve('react-dom/client')
      },
      transform: {
        '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
      }
    },
    {
      displayName: 'telehealth',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/telehealth/**/*.(test|spec).+(js)'],
      moduleNameMapper: {
        '\\.(css|less|scss)$': 'identity-obj-proxy',
        '^keycloak-js$': '<rootDir>/__mocks__/keycloak-js.js',
        '^@azure/identity$': '<rootDir>/__mocks__/@azure-identity.js',
        '^@microsoft/microsoft-graph-client$': '<rootDir>/__mocks__/@microsoft-microsoft-graph-client.js',
        '^react$': require.resolve('react'),
        '^react/jsx-runtime$': require.resolve('react/jsx-runtime'),
        '^react-dom$': require.resolve('react-dom'),
        '^react-dom/client$': require.resolve('react-dom/client')
      },
      transform: {
        '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
      }
    },
    {
      displayName: 'auth',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/patient-portal/__tests__/auth.test.js', '<rootDir>/patient-portal/__tests__/userService.test.js'],
      moduleNameMapper: {
        '\\.(css|less|scss)$': 'identity-obj-proxy',
        '^keycloak-js$': '<rootDir>/__mocks__/keycloak-js.js',
        '^@azure/identity$': '<rootDir>/__mocks__/@azure-identity.js',
        '^@microsoft/microsoft-graph-client$': '<rootDir>/__mocks__/@microsoft-microsoft-graph-client.js',
        '^react$': require.resolve('react'),
        '^react/jsx-runtime$': require.resolve('react/jsx-runtime'),
        '^react-dom$': require.resolve('react-dom'),
        '^react-dom/client$': require.resolve('react-dom/client')
      },
      transform: {
        '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
      }
    }
  ]
};