const crypto = require('crypto');
const { handler, healthCheck } = require('./index');
const { validateWebhookSignature, parseWebhookEvent, extractRepositoryInfo } = require('./lib/webhookUtils');

// Mock AWS Lambda context
const mockContext = {
    awsRequestId: 'test-request-id',
    functionName: 'webqx-github-webhooks-test',
    functionVersion: '1'
};

// Test webhook secret
const TEST_SECRET = 'test-webhook-secret-for-unit-tests';

// Helper function to create valid GitHub signature
function createGitHubSignature(payload, secret) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload, 'utf8');
    return `sha256=${hmac.digest('hex')}`;
}

// Mock environment
process.env.WEBHOOK_SECRET = TEST_SECRET;

describe('GitHub Webhooks Lambda Handler', () => {
    beforeEach(() => {
        // Clear console.log/error mocks
        jest.clearAllMocks();
        
        // Mock console methods to avoid output during tests
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    describe('Webhook Signature Validation', () => {
        test('should validate correct HMAC-SHA256 signature', () => {
            const payload = '{"test": "data"}';
            const signature = createGitHubSignature(payload, TEST_SECRET);
            
            const isValid = validateWebhookSignature(payload, signature, TEST_SECRET);
            
            expect(isValid).toBe(true);
        });

        test('should reject invalid signature', () => {
            const payload = '{"test": "data"}';
            const invalidSignature = 'sha256=invalid-signature';
            
            const isValid = validateWebhookSignature(payload, invalidSignature, TEST_SECRET);
            
            expect(isValid).toBe(false);
        });

        test('should reject signature without sha256 prefix', () => {
            const payload = '{"test": "data"}';
            const signature = 'invalid-format-signature';
            
            const isValid = validateWebhookSignature(payload, signature, TEST_SECRET);
            
            expect(isValid).toBe(false);
        });

        test('should handle missing parameters gracefully', () => {
            expect(validateWebhookSignature(null, 'sig', 'secret')).toBe(false);
            expect(validateWebhookSignature('payload', null, 'secret')).toBe(false);
            expect(validateWebhookSignature('payload', 'sig', null)).toBe(false);
        });
    });

    describe('Payload Parsing', () => {
        test('should parse JSON string payload', () => {
            const jsonString = '{"action": "opened", "number": 123}';
            const parsed = parseWebhookEvent(jsonString);
            
            expect(parsed).toEqual({ action: 'opened', number: 123 });
        });

        test('should return object payload as-is', () => {
            const objectPayload = { action: 'closed', number: 456 };
            const parsed = parseWebhookEvent(objectPayload);
            
            expect(parsed).toEqual(objectPayload);
        });

        test('should throw error for invalid JSON', () => {
            const invalidJson = '{"invalid": json}';
            
            expect(() => parseWebhookEvent(invalidJson)).toThrow();
        });
    });

    describe('Repository Information Extraction', () => {
        test('should extract repository information correctly', () => {
            const payload = {
                repository: {
                    id: 123456,
                    name: 'webqx',
                    full_name: 'WebQx/webqx',
                    private: false,
                    default_branch: 'main',
                    html_url: 'https://github.com/WebQx/webqx',
                    clone_url: 'https://github.com/WebQx/webqx.git',
                    owner: {
                        login: 'WebQx'
                    }
                }
            };

            const repoInfo = extractRepositoryInfo(payload);

            expect(repoInfo).toEqual({
                id: 123456,
                name: 'webqx',
                fullName: 'WebQx/webqx',
                owner: 'WebQx',
                private: false,
                defaultBranch: 'main',
                url: 'https://github.com/WebQx/webqx',
                cloneUrl: 'https://github.com/WebQx/webqx.git'
            });
        });

        test('should return null for missing repository', () => {
            const payload = {};
            const repoInfo = extractRepositoryInfo(payload);
            
            expect(repoInfo).toBeNull();
        });
    });

    describe('Lambda Handler', () => {
        test('should process valid push webhook', async () => {
            const payload = {
                ref: 'refs/heads/main',
                commits: [
                    {
                        id: 'abc123',
                        message: 'Update patient portal',
                        added: ['patient-portal/new-file.js'],
                        modified: ['package.json'],
                        removed: []
                    }
                ],
                repository: {
                    id: 123456,
                    name: 'webqx',
                    full_name: 'WebQx/webqx',
                    default_branch: 'main'
                },
                sender: {
                    id: 789,
                    login: 'developer'
                }
            };

            const payloadString = JSON.stringify(payload);
            const signature = createGitHubSignature(payloadString, TEST_SECRET);

            const event = {
                headers: {
                    'x-github-event': 'push',
                    'x-github-delivery': 'test-delivery-id',
                    'x-hub-signature-256': signature
                },
                body: payloadString
            };

            const response = await handler(event, mockContext);

            expect(response.statusCode).toBe(200);
            
            const responseBody = JSON.parse(response.body);
            expect(responseBody.message).toBe('Webhook processed successfully');
            expect(responseBody.event).toBe('push');
            expect(responseBody.delivery).toBe('test-delivery-id');
        });

        test('should process valid pull request webhook', async () => {
            const payload = {
                action: 'opened',
                number: 123,
                pull_request: {
                    id: 456789,
                    number: 123,
                    title: 'Add telehealth module',
                    head: { ref: 'feature/telehealth' },
                    base: { ref: 'main' }
                },
                repository: {
                    id: 123456,
                    name: 'webqx',
                    full_name: 'WebQx/webqx'
                },
                sender: {
                    id: 789,
                    login: 'developer'
                }
            };

            const payloadString = JSON.stringify(payload);
            const signature = createGitHubSignature(payloadString, TEST_SECRET);

            const event = {
                headers: {
                    'x-github-event': 'pull_request',
                    'x-github-delivery': 'test-delivery-id-2',
                    'x-hub-signature-256': signature
                },
                body: payloadString
            };

            const response = await handler(event, mockContext);

            expect(response.statusCode).toBe(200);
            
            const responseBody = JSON.parse(response.body);
            expect(responseBody.event).toBe('pull_request');
            expect(responseBody.result.action).toBe('pull-request-opened');
        });

        test('should handle ping event', async () => {
            const payload = {
                zen: 'Mind your words, they are important.',
                hook_id: 123456,
                repository: {
                    id: 123456,
                    name: 'webqx',
                    full_name: 'WebQx/webqx'
                },
                sender: {
                    id: 789,
                    login: 'system'
                }
            };

            const payloadString = JSON.stringify(payload);
            const signature = createGitHubSignature(payloadString, TEST_SECRET);

            const event = {
                headers: {
                    'x-github-event': 'ping',
                    'x-github-delivery': 'ping-delivery-id',
                    'x-hub-signature-256': signature
                },
                body: payloadString
            };

            const response = await handler(event, mockContext);

            expect(response.statusCode).toBe(200);
            
            const responseBody = JSON.parse(response.body);
            expect(responseBody.event).toBe('ping');
            expect(responseBody.result.action).toBe('ping-received');
        });

        test('should reject webhook with invalid signature', async () => {
            const payload = { test: 'data' };
            const payloadString = JSON.stringify(payload);

            const event = {
                headers: {
                    'x-github-event': 'push',
                    'x-github-delivery': 'test-delivery-id',
                    'x-hub-signature-256': 'sha256=invalid-signature'
                },
                body: payloadString
            };

            const response = await handler(event, mockContext);

            expect(response.statusCode).toBe(401);
            
            const responseBody = JSON.parse(response.body);
            expect(responseBody.error).toBe('Invalid signature');
        });

        test('should reject webhook without signature when secret is configured', async () => {
            const payload = { test: 'data' };
            const payloadString = JSON.stringify(payload);

            const event = {
                headers: {
                    'x-github-event': 'push',
                    'x-github-delivery': 'test-delivery-id'
                    // Missing x-hub-signature-256
                },
                body: payloadString
            };

            const response = await handler(event, mockContext);

            expect(response.statusCode).toBe(401);
            
            const responseBody = JSON.parse(response.body);
            expect(responseBody.error).toBe('Missing signature');
        });

        test('should reject webhook without GitHub event header', async () => {
            const payload = { test: 'data' };
            const payloadString = JSON.stringify(payload);

            const event = {
                headers: {
                    'x-github-delivery': 'test-delivery-id'
                    // Missing x-github-event
                },
                body: payloadString
            };

            const response = await handler(event, mockContext);

            expect(response.statusCode).toBe(400);
            
            const responseBody = JSON.parse(response.body);
            expect(responseBody.error).toBe('Missing X-GitHub-Event header');
        });

        test('should reject webhook without body', async () => {
            const event = {
                headers: {
                    'x-github-event': 'push',
                    'x-github-delivery': 'test-delivery-id'
                }
                // Missing body
            };

            const response = await handler(event, mockContext);

            expect(response.statusCode).toBe(400);
            
            const responseBody = JSON.parse(response.body);
            expect(responseBody.error).toBe('Missing request body');
        });

        test('should handle invalid JSON payload', async () => {
            const invalidJson = '{"invalid": json}';
            const signature = createGitHubSignature(invalidJson, TEST_SECRET);

            const event = {
                headers: {
                    'x-github-event': 'push',
                    'x-github-delivery': 'test-delivery-id',
                    'x-hub-signature-256': signature
                },
                body: invalidJson
            };

            const response = await handler(event, mockContext);

            expect(response.statusCode).toBe(400);
            
            const responseBody = JSON.parse(response.body);
            expect(responseBody.error).toBe('Invalid JSON payload');
        });
    });

    describe('Health Check Handler', () => {
        test('should return healthy status', async () => {
            const response = await healthCheck({}, mockContext);

            expect(response.statusCode).toBe(200);
            
            const responseBody = JSON.parse(response.body);
            expect(responseBody.status).toBe('healthy');
            expect(responseBody.service).toBe('webqx-github-webhooks');
            expect(responseBody.version).toBe('1.0.0');
            expect(responseBody.requestId).toBe(mockContext.awsRequestId);
            expect(responseBody.timestamp).toBeDefined();
        });
    });

    describe('Response Format', () => {
        test('should return consistent response format', async () => {
            const payload = {
                repository: {
                    id: 123456,
                    name: 'webqx',
                    full_name: 'WebQx/webqx'
                },
                sender: {
                    id: 789,
                    login: 'developer'
                }
            };

            const payloadString = JSON.stringify(payload);
            const signature = createGitHubSignature(payloadString, TEST_SECRET);

            const event = {
                headers: {
                    'x-github-event': 'ping',
                    'x-github-delivery': 'test-delivery-id',
                    'x-hub-signature-256': signature
                },
                body: payloadString
            };

            const response = await handler(event, mockContext);

            expect(response).toHaveProperty('statusCode');
            expect(response).toHaveProperty('headers');
            expect(response).toHaveProperty('body');
            
            expect(response.headers).toHaveProperty('Content-Type', 'application/json');
            expect(response.headers).toHaveProperty('X-Powered-By', 'WebQX-Webhooks/1.0.0');
            
            // Ensure body is valid JSON
            expect(() => JSON.parse(response.body)).not.toThrow();
        });
    });

    describe('Case-Insensitive Headers', () => {
        test('should handle uppercase GitHub headers', async () => {
            const payload = {
                repository: {
                    id: 123456,
                    name: 'webqx',
                    full_name: 'WebQx/webqx'
                },
                sender: {
                    id: 789,
                    login: 'developer'
                }
            };

            const payloadString = JSON.stringify(payload);
            const signature = createGitHubSignature(payloadString, TEST_SECRET);

            const event = {
                headers: {
                    'X-GitHub-Event': 'ping', // Uppercase
                    'X-GitHub-Delivery': 'test-delivery-id', // Uppercase
                    'X-Hub-Signature-256': signature // Uppercase
                },
                body: payloadString
            };

            const response = await handler(event, mockContext);

            expect(response.statusCode).toBe(200);
        });
    });

    describe('Environment Configuration', () => {
        test('should work without webhook secret configured', async () => {
            // Temporarily remove webhook secret
            const originalSecret = process.env.WEBHOOK_SECRET;
            delete process.env.WEBHOOK_SECRET;

            const payload = {
                repository: {
                    id: 123456,
                    name: 'webqx',
                    full_name: 'WebQx/webqx'
                },
                sender: {
                    id: 789,
                    login: 'developer'
                }
            };

            const event = {
                headers: {
                    'x-github-event': 'ping',
                    'x-github-delivery': 'test-delivery-id'
                    // No signature header
                },
                body: JSON.stringify(payload)
            };

            const response = await handler(event, mockContext);

            expect(response.statusCode).toBe(200);
            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining('No webhook secret configured')
            );

            // Restore webhook secret
            process.env.WEBHOOK_SECRET = originalSecret;
        });
    });
});