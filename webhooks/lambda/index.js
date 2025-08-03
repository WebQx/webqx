const crypto = require('crypto');
const { validateWebhookSignature, parseWebhookEvent } = require('./lib/webhookUtils');
const { processWebhookEvent } = require('./lib/eventProcessor');

/**
 * AWS Lambda handler for GitHub webhooks
 * Processes incoming webhook events from GitHub with proper security validation
 */
exports.handler = async (event, context) => {
    console.log('🚀 Lambda function invoked', {
        requestId: context.awsRequestId,
        functionName: context.functionName,
        functionVersion: context.functionVersion
    });

    try {
        // Parse the incoming event
        const { headers, body } = event;
        
        if (!body) {
            return createResponse(400, { error: 'Missing request body' });
        }

        // Get GitHub event type and delivery ID
        const githubEvent = headers['x-github-event'] || headers['X-GitHub-Event'];
        const githubDelivery = headers['x-github-delivery'] || headers['X-GitHub-Delivery'];
        const githubSignature = headers['x-hub-signature-256'] || headers['X-Hub-Signature-256'];

        console.log('📨 Webhook received', {
            event: githubEvent,
            delivery: githubDelivery,
            hasSignature: !!githubSignature
        });

        if (!githubEvent) {
            return createResponse(400, { error: 'Missing X-GitHub-Event header' });
        }

        // Verify webhook signature for security
        const webhookSecret = process.env.WEBHOOK_SECRET;
        if (webhookSecret && githubSignature) {
            const isValid = validateWebhookSignature(body, githubSignature, webhookSecret);
            if (!isValid) {
                console.error('❌ Invalid webhook signature');
                return createResponse(401, { error: 'Invalid signature' });
            }
            console.log('✅ Webhook signature verified');
        } else if (webhookSecret) {
            console.error('❌ Webhook secret configured but no signature provided');
            return createResponse(401, { error: 'Missing signature' });
        } else {
            console.warn('⚠️ No webhook secret configured - signature verification disabled');
        }

        // Parse the webhook payload
        let payload;
        try {
            payload = parseWebhookEvent(body);
        } catch (parseError) {
            console.error('❌ Failed to parse webhook payload:', parseError);
            return createResponse(400, { error: 'Invalid JSON payload' });
        }

        // Process the webhook event
        const result = await processWebhookEvent(githubEvent, payload, {
            delivery: githubDelivery,
            requestId: context.awsRequestId
        });

        console.log('✅ Webhook processed successfully', {
            event: githubEvent,
            delivery: githubDelivery,
            result: result.summary
        });

        return createResponse(200, {
            message: 'Webhook processed successfully',
            event: githubEvent,
            delivery: githubDelivery,
            result: result.summary
        });

    } catch (error) {
        console.error('❌ Lambda function error:', error);
        
        return createResponse(500, {
            error: 'Internal server error',
            message: error.message,
            requestId: context.awsRequestId
        });
    }
};

/**
 * Create a standardized HTTP response
 */
function createResponse(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'X-Powered-By': 'WebQX-Webhooks/1.0.0'
        },
        body: JSON.stringify(body, null, 2)
    };
}

/**
 * Health check endpoint for monitoring
 */
exports.healthCheck = async (event, context) => {
    return createResponse(200, {
        status: 'healthy',
        service: 'webqx-github-webhooks',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId
    });
};