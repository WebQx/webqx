/**
 * AWS Lambda function to handle GitHub webhook events for WebQx/webqx repository
 * 
 * This function processes GitHub webhook payloads and responds to specific events:
 * - push events
 * - pull_request events  
 * - issues events
 * 
 * Features:
 * - GitHub webhook signature verification
 * - Event filtering and processing
 * - Structured logging
 * - Error handling
 */

const crypto = require('crypto');

// Configuration from environment variables (accessed dynamically for testing)
const getGitHubWebhookSecret = () => process.env.GITHUB_WEBHOOK_SECRET;
const getSlackWebhookUrl = () => process.env.SLACK_WEBHOOK_URL;

/**
 * Verify GitHub webhook signature
 * @param {string} payload - Raw request body
 * @param {string} signature - GitHub signature header
 * @returns {boolean} - True if signature is valid
 */
function verifyGitHubSignature(payload, signature) {
    const GITHUB_WEBHOOK_SECRET = getGitHubWebhookSecret();
    
    if (!GITHUB_WEBHOOK_SECRET) {
        console.warn('GITHUB_WEBHOOK_SECRET not configured - skipping signature verification');
        return true; // Allow in development/testing
    }
    
    if (!signature) {
        return false;
    }
    
    const expectedSignature = crypto
        .createHmac('sha256', GITHUB_WEBHOOK_SECRET)
        .update(payload, 'utf8')
        .digest('hex');
    
    const providedSignature = signature.replace('sha256=', '');
    
    return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(providedSignature, 'hex')
    );
}

/**
 * Handle push events
 * @param {Object} payload - GitHub push event payload
 * @returns {Object} - Processing result
 */
async function handlePushEvent(payload) {
    const { ref, repository, commits, pusher } = payload;
    
    console.log(`Push event received for ${repository.full_name}`);
    console.log(`Branch: ${ref}`);
    console.log(`Pusher: ${pusher.name}`);
    console.log(`Commits: ${commits.length}`);
    
    // Process based on branch
    if (ref === 'refs/heads/main' || ref === 'refs/heads/master') {
        console.log('Push to main branch detected');
        
        // Example actions for main branch push:
        // - Trigger CI/CD pipeline
        // - Send notifications
        // - Update deployment status
        
        return {
            action: 'main_branch_push',
            processed: true,
            commits: commits.length,
            message: `Processed ${commits.length} commits to main branch`
        };
    }
    
    return {
        action: 'feature_branch_push',
        processed: true,
        branch: ref.replace('refs/heads/', ''),
        message: 'Feature branch push processed'
    };
}

/**
 * Handle pull request events
 * @param {Object} payload - GitHub pull request event payload
 * @returns {Object} - Processing result
 */
async function handlePullRequestEvent(payload) {
    const { action, pull_request, repository } = payload;
    
    console.log(`Pull request ${action} for ${repository.full_name}`);
    console.log(`PR #${pull_request.number}: ${pull_request.title}`);
    console.log(`Author: ${pull_request.user.login}`);
    
    switch (action) {
        case 'opened':
            console.log('New pull request opened');
            // Example actions:
            // - Run automated checks
            // - Add labels
            // - Request reviews
            break;
            
        case 'closed':
            if (pull_request.merged) {
                console.log('Pull request merged');
                // Example actions:
                // - Trigger deployment
                // - Update release notes
                // - Clean up feature branch
            } else {
                console.log('Pull request closed without merging');
            }
            break;
            
        case 'synchronize':
            console.log('Pull request updated with new commits');
            // Example actions:
            // - Re-run CI checks
            // - Update review status
            break;
            
        default:
            console.log(`Unhandled PR action: ${action}`);
    }
    
    return {
        action: `pull_request_${action}`,
        processed: true,
        pr_number: pull_request.number,
        message: `Pull request ${action} processed`
    };
}

/**
 * Handle issues events
 * @param {Object} payload - GitHub issues event payload
 * @returns {Object} - Processing result
 */
async function handleIssuesEvent(payload) {
    const { action, issue, repository } = payload;
    
    console.log(`Issue ${action} for ${repository.full_name}`);
    console.log(`Issue #${issue.number}: ${issue.title}`);
    console.log(`Author: ${issue.user.login}`);
    
    switch (action) {
        case 'opened':
            console.log('New issue opened');
            // Example actions:
            // - Add labels based on content
            // - Assign to team members
            // - Send notifications
            break;
            
        case 'closed':
            console.log('Issue closed');
            // Example actions:
            // - Update project metrics
            // - Send closure notifications
            break;
            
        case 'labeled':
            console.log(`Issue labeled: ${payload.label?.name}`);
            // Example actions:
            // - Trigger automations based on labels
            // - Update project boards
            break;
            
        default:
            console.log(`Unhandled issue action: ${action}`);
    }
    
    return {
        action: `issues_${action}`,
        processed: true,
        issue_number: issue.number,
        message: `Issue ${action} processed`
    };
}

/**
 * Send notification to Slack (optional)
 * @param {Object} eventData - Event processing result
 */
async function sendSlackNotification(eventData) {
    const SLACK_WEBHOOK_URL = getSlackWebhookUrl();
    
    if (!SLACK_WEBHOOK_URL) {
        return;
    }
    
    try {
        const response = await fetch(SLACK_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: `GitHub Event Processed: ${eventData.message}`,
                attachments: [
                    {
                        color: 'good',
                        fields: [
                            {
                                title: 'Action',
                                value: eventData.action,
                                short: true
                            },
                            {
                                title: 'Repository',
                                value: 'WebQx/webqx',
                                short: true
                            }
                        ]
                    }
                ]
            })
        });
        
        if (!response.ok) {
            console.error('Failed to send Slack notification:', response.statusText);
        }
    } catch (error) {
        console.error('Error sending Slack notification:', error);
    }
}

/**
 * Main Lambda handler function
 * @param {Object} event - AWS Lambda event object
 * @param {Object} context - AWS Lambda context object
 * @returns {Object} - Lambda response
 */
exports.handler = async (event, context) => {
    console.log('GitHub webhook received');
    console.log('Event:', JSON.stringify(event, null, 2));
    
    try {
        // Parse the request
        const body = event.body;
        const headers = event.headers || {};
        
        // Get GitHub headers
        const githubEvent = headers['X-GitHub-Event'] || headers['x-github-event'];
        const githubSignature = headers['X-Hub-Signature-256'] || headers['x-hub-signature-256'];
        const githubDelivery = headers['X-GitHub-Delivery'] || headers['x-github-delivery'];
        
        console.log(`GitHub Event: ${githubEvent}`);
        console.log(`GitHub Delivery: ${githubDelivery}`);
        
        // Verify signature
        if (!verifyGitHubSignature(body, githubSignature)) {
            console.error('Invalid GitHub signature');
            return {
                statusCode: 401,
                body: JSON.stringify({ error: 'Invalid signature' })
            };
        }
        
        // Parse payload
        let payload;
        try {
            payload = typeof body === 'string' ? JSON.parse(body) : body;
        } catch (error) {
            console.error('Failed to parse payload:', error);
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Invalid JSON payload' })
            };
        }
        
        // Verify repository
        if (payload.repository?.full_name !== 'WebQx/webqx') {
            console.log(`Ignoring event for repository: ${payload.repository?.full_name}`);
            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'Event ignored - wrong repository' })
            };
        }
        
        // Process event based on type
        let result;
        switch (githubEvent) {
            case 'push':
                result = await handlePushEvent(payload);
                break;
                
            case 'pull_request':
                result = await handlePullRequestEvent(payload);
                break;
                
            case 'issues':
                result = await handleIssuesEvent(payload);
                break;
                
            case 'ping':
                console.log('GitHub ping event received');
                result = {
                    action: 'ping',
                    processed: true,
                    message: 'Webhook ping received successfully'
                };
                break;
                
            default:
                console.log(`Unhandled GitHub event: ${githubEvent}`);
                result = {
                    action: 'unhandled',
                    processed: false,
                    event: githubEvent,
                    message: `Event type ${githubEvent} not handled`
                };
        }
        
        // Send notification if configured
        if (result.processed) {
            await sendSlackNotification(result);
        }
        
        console.log('Processing result:', result);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: 'Webhook processed successfully',
                result: result
            })
        };
        
    } catch (error) {
        console.error('Error processing webhook:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message
            })
        };
    }
};