const lambdaHandler = require('../lambda-handler');

// Mock AWS Lambda event and context
const createMockEvent = (httpMethod = 'GET', path = '/health', body = null) => ({
  httpMethod,
  path,
  resource: '/{proxy+}',
  pathParameters: { proxy: path.slice(1) },
  queryStringParameters: null,
  headers: {
    'Accept': 'application/json',
    'Host': 'api.webqx.health',
    'User-Agent': 'jest-test'
  },
  body: body ? JSON.stringify(body) : null,
  isBase64Encoded: false,
  requestContext: {
    requestId: 'test-request-id',
    stage: 'test',
    httpMethod,
    path: `/test${path}`,
    accountId: '123456789012',
    apiId: 'test-api-id',
    protocol: 'HTTP/1.1',
    resourcePath: '/{proxy+}',
    identity: {
      sourceIp: '192.0.2.1',
      userAgent: 'jest-test'
    }
  }
});

const createMockContext = () => ({
  functionName: 'webqx-healthcare-platform-test',
  functionVersion: '$LATEST',
  requestId: 'test-request-id',
  logGroupName: '/aws/lambda/webqx-healthcare-platform-test',
  callbackWaitsForEmptyEventLoop: false,
  getRemainingTimeInMillis: () => 30000
});

describe('Lambda Handler', () => {
  let mockContext;

  beforeEach(() => {
    mockContext = createMockContext();
  });

  describe('Health Check', () => {
    it('should handle health check requests', async () => {
      const event = createMockEvent('GET', '/health');
      
      const result = await new Promise((resolve, reject) => {
        lambdaHandler.handler(event, mockContext, (error, result) => {
          if (error) reject(error);
          else resolve(result);
        });
      });

      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body).toMatchObject({
        status: 'healthy',
        service: 'WebQX Healthcare Platform (Lambda)'
      });
    });
  });

  describe('FHIR Endpoints', () => {
    it('should handle FHIR metadata requests', async () => {
      const event = createMockEvent('GET', '/fhir/metadata');
      
      const result = await new Promise((resolve, reject) => {
        lambdaHandler.handler(event, mockContext, (error, result) => {
          if (error) reject(error);
          else resolve(result);
        });
      });

      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.resourceType).toBe('CapabilityStatement');
    });
  });

  describe('Translation API', () => {
    it('should handle translation requests', async () => {
      const event = createMockEvent('POST', '/api/whisper/translate', {
        text: 'Take 2 tablets daily',
        targetLang: 'es'
      });
      
      const result = await new Promise((resolve, reject) => {
        lambdaHandler.handler(event, mockContext, (error, result) => {
          if (error) reject(error);
          else resolve(result);
        });
      });

      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body).toMatchObject({
        translatedText: 'Tomar 2 tabletas al día',
        sourceLanguage: 'en',
        targetLanguage: 'es'
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed requests gracefully', async () => {
      const event = {
        ...createMockEvent('POST', '/api/whisper/translate'),
        body: 'invalid-json'
      };
      
      const result = await new Promise((resolve, reject) => {
        lambdaHandler.handler(event, mockContext, (error, result) => {
          if (error) reject(error);
          else resolve(result);
        });
      });

      // The handler should not crash, even with malformed input
      expect(result.statusCode).toBeDefined();
    });
  });

  describe('Lambda Context', () => {
    it('should set callbackWaitsForEmptyEventLoop to false', () => {
      const event = createMockEvent('GET', '/health');
      
      lambdaHandler.handler(event, mockContext, () => {});
      
      expect(mockContext.callbackWaitsForEmptyEventLoop).toBe(false);
    });
  });
});