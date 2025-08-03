/**
 * Tests for GitHub webhook Lambda function
 */

const { handler } = require('../src/index');

// Mock event data
const mockPushEvent = {
    body: JSON.stringify({
        ref: 'refs/heads/main',
        repository: {
            full_name: 'WebQx/webqx',
            name: 'webqx'
        },
        commits: [
            {
                id: 'abc123',
                message: 'Add new feature',
                author: { name: 'Test User' }
            }
        ],
        pusher: {
            name: 'testuser'
        }
    }),
    headers: {
        'X-GitHub-Event': 'push',
        'X-GitHub-Delivery': '12345678-1234-1234-1234-123456789012'
    }
};

const mockPullRequestEvent = {
    body: JSON.stringify({
        action: 'opened',
        repository: {
            full_name: 'WebQx/webqx',
            name: 'webqx'
        },
        pull_request: {
            number: 42,
            title: 'Add Lambda webhook handler',
            user: {
                login: 'testuser'
            },
            merged: false
        }
    }),
    headers: {
        'X-GitHub-Event': 'pull_request',
        'X-GitHub-Delivery': '12345678-1234-1234-1234-123456789012'
    }
};

const mockIssuesEvent = {
    body: JSON.stringify({
        action: 'opened',
        repository: {
            full_name: 'WebQx/webqx',
            name: 'webqx'
        },
        issue: {
            number: 123,
            title: 'Bug report: Lambda function error',
            user: {
                login: 'testuser'
            }
        }
    }),
    headers: {
        'X-GitHub-Event': 'issues',
        'X-GitHub-Delivery': '12345678-1234-1234-1234-123456789012'
    }
};

const mockPingEvent = {
    body: JSON.stringify({
        zen: 'Responsive is better than fast.',
        repository: {
            full_name: 'WebQx/webqx'
        }
    }),
    headers: {
        'X-GitHub-Event': 'ping',
        'X-GitHub-Delivery': '12345678-1234-1234-1234-123456789012'
    }
};

const mockContext = {
    getRemainingTimeInMillis: () => 30000,
    functionName: 'webqx-github-webhook',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:webqx-github-webhook',
    memoryLimitInMB: '256',
    awsRequestId: 'test-request-id'
};

describe('GitHub Webhook Lambda Handler', () => {
    
    beforeEach(() => {
        // Clear environment variables
        delete process.env.GITHUB_WEBHOOK_SECRET;
        delete process.env.SLACK_WEBHOOK_URL;
        
        // Mock console methods
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });
    
    afterEach(() => {
        jest.restoreAllMocks();
    });
    
    describe('Push Events', () => {
        test('should handle push to main branch', async () => {
            const response = await handler(mockPushEvent, mockContext);
            
            expect(response.statusCode).toBe(200);
            
            const body = JSON.parse(response.body);
            expect(body.message).toBe('Webhook processed successfully');
            expect(body.result.action).toBe('main_branch_push');
            expect(body.result.processed).toBe(true);
        });
        
        test('should handle push to feature branch', async () => {
            const featureBranchEvent = {
                ...mockPushEvent,
                body: JSON.stringify({
                    ...JSON.parse(mockPushEvent.body),
                    ref: 'refs/heads/feature/new-feature'
                })
            };
            
            const response = await handler(featureBranchEvent, mockContext);
            
            expect(response.statusCode).toBe(200);
            
            const body = JSON.parse(response.body);
            expect(body.result.action).toBe('feature_branch_push');
            expect(body.result.branch).toBe('feature/new-feature');
        });
    });
    
    describe('Pull Request Events', () => {
        test('should handle pull request opened', async () => {
            const response = await handler(mockPullRequestEvent, mockContext);
            
            expect(response.statusCode).toBe(200);
            
            const body = JSON.parse(response.body);
            expect(body.result.action).toBe('pull_request_opened');
            expect(body.result.pr_number).toBe(42);
            expect(body.result.processed).toBe(true);
        });
        
        test('should handle pull request merged', async () => {
            const mergedPrEvent = {
                ...mockPullRequestEvent,
                body: JSON.stringify({
                    ...JSON.parse(mockPullRequestEvent.body),
                    action: 'closed',
                    pull_request: {
                        ...JSON.parse(mockPullRequestEvent.body).pull_request,
                        merged: true
                    }
                })
            };
            
            const response = await handler(mergedPrEvent, mockContext);
            
            expect(response.statusCode).toBe(200);
            
            const body = JSON.parse(response.body);
            expect(body.result.action).toBe('pull_request_closed');
            expect(body.result.processed).toBe(true);
        });
    });
    
    describe('Issues Events', () => {
        test('should handle issue opened', async () => {
            const response = await handler(mockIssuesEvent, mockContext);
            
            expect(response.statusCode).toBe(200);
            
            const body = JSON.parse(response.body);
            expect(body.result.action).toBe('issues_opened');
            expect(body.result.issue_number).toBe(123);
            expect(body.result.processed).toBe(true);
        });
    });
    
    describe('Ping Events', () => {
        test('should handle GitHub ping event', async () => {
            const response = await handler(mockPingEvent, mockContext);
            
            expect(response.statusCode).toBe(200);
            
            const body = JSON.parse(response.body);
            expect(body.result.action).toBe('ping');
            expect(body.result.processed).toBe(true);
        });
    });
    
    describe('Error Handling', () => {
        test('should handle invalid JSON payload', async () => {
            const invalidEvent = {
                ...mockPushEvent,
                body: 'invalid json'
            };
            
            const response = await handler(invalidEvent, mockContext);
            
            expect(response.statusCode).toBe(400);
            
            const body = JSON.parse(response.body);
            expect(body.error).toBe('Invalid JSON payload');
        });
        
        test('should ignore events from other repositories', async () => {
            const otherRepoEvent = {
                ...mockPushEvent,
                body: JSON.stringify({
                    ...JSON.parse(mockPushEvent.body),
                    repository: {
                        full_name: 'other/repo'
                    }
                })
            };
            
            const response = await handler(otherRepoEvent, mockContext);
            
            expect(response.statusCode).toBe(200);
            
            const body = JSON.parse(response.body);
            expect(body.message).toBe('Event ignored - wrong repository');
        });
        
        test('should handle unrecognized GitHub events', async () => {
            const unknownEvent = {
                ...mockPushEvent,
                headers: {
                    ...mockPushEvent.headers,
                    'X-GitHub-Event': 'unknown_event'
                }
            };
            
            const response = await handler(unknownEvent, mockContext);
            
            expect(response.statusCode).toBe(200);
            
            const body = JSON.parse(response.body);
            expect(body.result.action).toBe('unhandled');
            expect(body.result.processed).toBe(false);
            expect(body.result.event).toBe('unknown_event');
        });
        
        test('should handle signature verification when secret is configured', async () => {
            process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';
            
            const eventWithoutSignature = {
                ...mockPushEvent,
                headers: {
                    'X-GitHub-Event': mockPushEvent.headers['X-GitHub-Event'],
                    'X-GitHub-Delivery': mockPushEvent.headers['X-GitHub-Delivery']
                    // No X-Hub-Signature-256 header
                }
            };
            
            const response = await handler(eventWithoutSignature, mockContext);
            
            expect(response.statusCode).toBe(401);
            
            const body = JSON.parse(response.body);
            expect(body.error).toBe('Invalid signature');
        });
    });
    
    describe('Environment Configuration', () => {
        test('should work without GITHUB_WEBHOOK_SECRET in development', async () => {
            // No secret configured - should work in development mode
            const response = await handler(mockPushEvent, mockContext);
            
            expect(response.statusCode).toBe(200);
            expect(console.warn).toHaveBeenCalledWith(
                'GITHUB_WEBHOOK_SECRET not configured - skipping signature verification'
            );
        });
        
        test('should not send Slack notifications when URL not configured', async () => {
            // SLACK_WEBHOOK_URL not set
            const response = await handler(mockPushEvent, mockContext);
            
            expect(response.statusCode).toBe(200);
            // Should complete successfully without trying to send Slack notification
        });
    });
    
    describe('Case Sensitivity', () => {
        test('should handle lowercase GitHub headers', async () => {
            const lowercaseHeaderEvent = {
                ...mockPushEvent,
                headers: {
                    'x-github-event': 'push',
                    'x-github-delivery': '12345678-1234-1234-1234-123456789012'
                }
            };
            
            const response = await handler(lowercaseHeaderEvent, mockContext);
            
            expect(response.statusCode).toBe(200);
            
            const body = JSON.parse(response.body);
            expect(body.result.action).toBe('main_branch_push');
        });
    });
});