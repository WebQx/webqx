const { handler } = require('../lambda');

describe('Lambda Handler', () => {
  it('should handle GET /health request', async () => {
    const event = {
      httpMethod: 'GET',
      path: '/health',
      headers: {},
      queryStringParameters: null,
      body: null,
      isBase64Encoded: false
    };

    const context = {
      awsRequestId: 'test-request-id',
      functionName: 'webqx-test-function',
      functionVersion: '$LATEST',
      remainingTimeInMillis: 30000
    };

    // Set Lambda environment variables for testing
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'webqx-test-function';
    process.env.AWS_LAMBDA_FUNCTION_VERSION = '$LATEST';
    process.env.AWS_REGION = 'us-east-1';
    process.env.STAGE = 'test';

    const result = await handler(event, context);

    expect(result.statusCode).toBe(200);
    
    const body = JSON.parse(result.body);
    expect(body.status).toBe('healthy');
    expect(body.service).toBe('WebQX Healthcare Platform');
    expect(body.runtime).toBe('lambda');
    expect(body.lambda).toBeDefined();
    expect(body.lambda.functionName).toBe('webqx-test-function');

    // Clean up environment variables
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    delete process.env.AWS_LAMBDA_FUNCTION_VERSION;
    delete process.env.AWS_REGION;
    delete process.env.STAGE;
  });

  it('should handle GET / request', async () => {
    const event = {
      httpMethod: 'GET',
      path: '/',
      headers: {
        'Accept': 'text/html'
      },
      queryStringParameters: null,
      body: null,
      isBase64Encoded: false
    };

    const context = {
      awsRequestId: 'test-request-id',
      functionName: 'webqx-test-function',
      functionVersion: '$LATEST',
      remainingTimeInMillis: 30000
    };

    const result = await handler(event, context);

    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toContain('text/html');
  });

  it('should handle POST requests', async () => {
    const event = {
      httpMethod: 'POST',
      path: '/api/whisper/translate',
      headers: {
        'Content-Type': 'application/json'
      },
      queryStringParameters: null,
      body: JSON.stringify({
        text: 'Take 2 tablets daily',
        targetLang: 'es'
      }),
      isBase64Encoded: false
    };

    const context = {
      awsRequestId: 'test-request-id',
      functionName: 'webqx-test-function',
      functionVersion: '$LATEST',
      remainingTimeInMillis: 30000
    };

    const result = await handler(event, context);

    expect(result.statusCode).toBe(200);
    
    const body = JSON.parse(result.body);
    expect(body.translatedText).toBeDefined();
    expect(body.targetLanguage).toBe('es');
  });
});