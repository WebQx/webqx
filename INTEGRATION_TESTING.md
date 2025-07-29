# WebQx Healthcare Platform Integration Testing

This document describes the comprehensive integration testing setup for the WebQx healthcare platform, which validates the functionality and reliability of all integrated APIs, modules, and services.

## 🎯 Overview

The integration testing suite covers:

- **API Endpoints**: All FHIR, OAuth2, and custom API endpoints
- **Security**: JWT authentication, encryption, session management, and HIPAA compliance
- **Database**: PostgreSQL connections, CRUD operations, and transactions
- **External Services**: FHIR servers, AI/NLP services, healthcare systems, and messaging
- **Configuration**: Environment variables and service configurations

## 📁 Test Structure

```
__tests__/
├── setup/
│   └── test-environment.ts     # Test environment configuration
├── mocks/
│   └── services.ts             # Mock implementations for external services
└── integration/
    ├── api.test.ts             # API endpoint integration tests
    ├── security.test.ts        # Security and authentication tests
    ├── database.test.ts        # Database integration tests
    ├── external-services.test.ts # External service integration tests
    ├── configuration.test.ts   # Configuration validation tests
    └── comprehensive.test.ts   # Master integration test suite
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL (for database tests)
- Jest testing framework
- TypeScript support

### Installation

```bash
# Install dependencies
npm install

# Install additional testing dependencies
npm install --save-dev nock @types/nock @types/dotenv
```

### Configuration

1. Copy the test environment configuration:
```bash
cp .env.test .env
```

2. Update test configuration in `.env.test` with your test-specific values:
```env
# Test Database
TEST_DATABASE_URL=postgresql://test:test@localhost:5432/webqx_test

# Test API Keys (use test/sandbox keys)
TEST_OPENAI_API_KEY=your-test-openai-key
TEST_FHIR_CLIENT_ID=your-test-fhir-client
```

## 🧪 Running Tests

### All Integration Tests
```bash
npm test -- --testPathPatterns="__tests__/integration"
```

### Specific Test Suites
```bash
# API integration tests
npm test -- __tests__/integration/api.test.ts

# Security tests
npm test -- __tests__/integration/security.test.ts

# Database tests
npm test -- __tests__/integration/database.test.ts

# External services tests
npm test -- __tests__/integration/external-services.test.ts

# Configuration validation
npm test -- __tests__/integration/configuration.test.ts
```

### With Coverage
```bash
npm test -- --testPathPatterns="__tests__/integration" --coverage
```

### Watch Mode
```bash
npm test -- --testPathPatterns="__tests__/integration" --watch
```

## 📊 Test Coverage

### API Endpoints
- ✅ Health check (`/health`)
- ✅ OAuth2 endpoints (`/oauth/authorize`, `/oauth/token`)
- ✅ FHIR metadata (`/fhir/metadata`)
- ✅ FHIR Patient resource (`/fhir/Patient`)
- ✅ FHIR Appointment resource (`/fhir/Appointment`)
- ✅ Translation API (`/api/whisper/translate`)
- ✅ Rate limiting and CORS
- ✅ Security headers

### Security & Authentication
- ✅ JWT token generation and validation
- ✅ Token expiration and signature verification
- ✅ Scope-based authorization
- ✅ Encryption/decryption of sensitive data
- ✅ Session management
- ✅ Input validation and sanitization
- ✅ Audit logging
- ✅ HIPAA compliance measures

### Database Operations
- ✅ Connection management
- ✅ Patient data CRUD operations
- ✅ Appointment management
- ✅ Medical records storage
- ✅ Transaction handling
- ✅ Data integrity validation
- ✅ Performance testing
- ✅ Security controls

### External Service Integrations
- ✅ **FHIR R4 Server**: Patient search, resource creation, capability statements
- ✅ **OpenAI/Whisper**: Audio transcription, chat completions
- ✅ **Firebase**: Authentication, Firestore operations
- ✅ **Epic Integration**: Patient search, OAuth2 authentication
- ✅ **Cerner Integration**: Lab results retrieval
- ✅ **Allscripts Integration**: Medication lists
- ✅ **Matrix Messaging**: Secure message sending
- ✅ **Medplum Messaging**: Communication resources
- ✅ **Email/SMTP**: Email sending and receiving
- ✅ **Pharmacy APIs**: Location search
- ✅ **Lab Results APIs**: Results retrieval

## 🔧 Mock Services

The test suite includes comprehensive mock implementations for all external services to ensure:

- **Isolation**: Tests don't depend on external service availability
- **Consistency**: Predictable responses for reliable testing
- **Speed**: Fast test execution without network delays
- **Cost-effectiveness**: No API charges for test runs

### Available Mocks
- `MockFHIRServer`: FHIR R4 server simulation
- `MockOpenAIService`: OpenAI/Whisper API simulation
- `MockFirebaseService`: Firebase authentication and Firestore
- `MockHealthcareIntegrations`: Epic, Cerner, Allscripts APIs
- `MockEmailService`: SMTP email service simulation
- `MockDatabaseService`: PostgreSQL database simulation
- `MockMessagingServices`: Matrix and Medplum messaging

## 🏗️ CI/CD Integration

### GitHub Actions Workflow

The repository includes a comprehensive CI/CD workflow (`.github/workflows/ci-cd.yml`) that:

1. **Linting & Type Checking**: Validates code quality
2. **Unit Tests**: Runs component-level tests
3. **Integration Tests**: Executes full integration test suite
4. **Security Scanning**: Performs security vulnerability checks
5. **API Testing**: Tests live API endpoints
6. **Performance Testing**: Validates system performance
7. **Docker Building**: Creates and tests Docker images
8. **Deployment**: Stages and production deployments

### Environment-Specific Testing
- **Development**: Basic smoke tests
- **Staging**: Full integration test suite
- **Production**: Smoke tests and monitoring

## 📈 Test Metrics

### Coverage Targets
- **Branches**: 70% minimum
- **Functions**: 70% minimum
- **Lines**: 70% minimum
- **Statements**: 70% minimum

### Performance Targets
- **Test Suite Execution**: < 5 minutes
- **Individual Test**: < 30 seconds
- **API Response Time**: < 2 seconds
- **Database Query Time**: < 500ms

## 🔒 Security & Compliance

### HIPAA Compliance Testing
- ✅ Audit logging validation
- ✅ Data encryption verification
- ✅ Access control testing
- ✅ Data retention policy validation
- ✅ Backup and recovery testing
- ✅ Incident response procedures

### Healthcare Standards
- ✅ FHIR R4 compliance
- ✅ HL7 message validation
- ✅ Healthcare interoperability standards
- ✅ Data integrity checks

## 🛠️ Development Guidelines

### Adding New Tests

1. **API Endpoint Tests**: Add to `api.test.ts`
```typescript
test('Should handle new endpoint', async () => {
  const response = await request(app)
    .get('/new-endpoint')
    .expect(200);
  
  expect(response.body).toHaveProperty('expected_field');
});
```

2. **External Service Tests**: Add to `external-services.test.ts`
```typescript
test('Should integrate with new service', async () => {
  const mockService = mockServices.getService('newService');
  // Test integration logic
});
```

3. **Security Tests**: Add to `security.test.ts`
```typescript
test('Should validate new security feature', () => {
  // Test security implementation
});
```

### Mock Service Guidelines

When adding new external service mocks:

1. Create mock class in `__tests__/mocks/services.ts`
2. Implement realistic response structures
3. Include error scenarios
4. Add to `MockServiceManager`
5. Document expected behavior

### Environment Configuration

Add new environment variables to:
- `.env.test`: Test-specific values
- `test-environment.ts`: Configuration interface
- `configuration.test.ts`: Validation tests

## 🐛 Troubleshooting

### Common Issues

1. **Tests failing due to missing environment variables**
   ```bash
   # Copy and update test environment
   cp .env.test .env
   # Update with your test values
   ```

2. **Database connection errors**
   ```bash
   # Ensure PostgreSQL is running
   brew services start postgresql
   # Or with Docker
   docker run -d --name test-postgres -e POSTGRES_PASSWORD=test -p 5432:5432 postgres
   ```

3. **Mock service setup issues**
   ```bash
   # Clear Jest cache
   npm test -- --clearCache
   # Reinstall dependencies
   rm -rf node_modules && npm install
   ```

### Debug Mode

Run tests with verbose output:
```bash
npm test -- --testPathPatterns="__tests__/integration" --verbose
```

Enable debug logging:
```bash
DEBUG=* npm test -- __tests__/integration/api.test.ts
```

## 📚 Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [FHIR R4 Specification](https://hl7.org/fhir/R4/)
- [HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html)
- [Healthcare Interoperability Standards](https://www.healthit.gov/topic/interoperability)

## 🤝 Contributing

1. Write tests for new features
2. Ensure all tests pass
3. Maintain test coverage above 70%
4. Update documentation
5. Follow security best practices

## 📄 License

This testing framework is part of the WebQx Healthcare Platform and follows the same licensing terms.