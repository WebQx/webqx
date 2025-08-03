const crypto = require('crypto');

/**
 * Validates GitHub webhook signature using HMAC-SHA256
 * @param {string} payload - The raw webhook payload
 * @param {string} signature - The X-Hub-Signature-256 header value
 * @param {string} secret - The webhook secret
 * @returns {boolean} True if signature is valid
 */
function validateWebhookSignature(payload, signature, secret) {
    if (!payload || !signature || !secret) {
        return false;
    }

    // GitHub signature format: "sha256=<hash>"
    if (!signature.startsWith('sha256=')) {
        return false;
    }

    const expectedSignature = signature.substring(7); // Remove "sha256=" prefix
    
    // Calculate HMAC-SHA256 hash
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload, 'utf8');
    const calculatedSignature = hmac.digest('hex');

    // Use crypto.timingSafeEqual to prevent timing attacks
    if (expectedSignature.length !== calculatedSignature.length) {
        return false;
    }

    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const calculatedBuffer = Buffer.from(calculatedSignature, 'hex');

    return crypto.timingSafeEqual(expectedBuffer, calculatedBuffer);
}

/**
 * Parses webhook event payload
 * @param {string} body - Raw request body
 * @returns {Object} Parsed webhook payload
 */
function parseWebhookEvent(body) {
    if (typeof body === 'string') {
        return JSON.parse(body);
    }
    return body;
}

/**
 * Extracts repository information from webhook payload
 * @param {Object} payload - Webhook payload
 * @returns {Object} Repository information
 */
function extractRepositoryInfo(payload) {
    const repo = payload.repository;
    if (!repo) {
        return null;
    }

    return {
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner?.login,
        private: repo.private,
        defaultBranch: repo.default_branch,
        url: repo.html_url,
        cloneUrl: repo.clone_url
    };
}

/**
 * Extracts sender information from webhook payload
 * @param {Object} payload - Webhook payload
 * @returns {Object} Sender information
 */
function extractSenderInfo(payload) {
    const sender = payload.sender;
    if (!sender) {
        return null;
    }

    return {
        id: sender.id,
        login: sender.login,
        type: sender.type,
        url: sender.html_url,
        avatarUrl: sender.avatar_url
    };
}

/**
 * Sanitizes webhook payload for logging (removes sensitive data)
 * @param {Object} payload - Webhook payload
 * @returns {Object} Sanitized payload
 */
function sanitizePayloadForLogging(payload) {
    // Create a copy to avoid modifying original
    const sanitized = JSON.parse(JSON.stringify(payload));
    
    // Remove potentially sensitive fields
    const sensitiveFields = [
        'installation.access_tokens_url',
        'installation.repositories_url',
        'repository.clone_url',
        'repository.ssh_url'
    ];

    sensitiveFields.forEach(field => {
        const parts = field.split('.');
        let obj = sanitized;
        for (let i = 0; i < parts.length - 1; i++) {
            if (obj[parts[i]]) {
                obj = obj[parts[i]];
            } else {
                return; // Field doesn't exist
            }
        }
        if (obj[parts[parts.length - 1]]) {
            obj[parts[parts.length - 1]] = '[REDACTED]';
        }
    });

    return sanitized;
}

/**
 * Validates required webhook payload structure
 * @param {Object} payload - Webhook payload
 * @returns {Object} Validation result with isValid and errors
 */
function validateWebhookPayload(payload) {
    const errors = [];

    if (!payload) {
        errors.push('Payload is required');
        return { isValid: false, errors };
    }

    if (!payload.repository) {
        errors.push('Repository information is required');
    }

    if (!payload.sender) {
        errors.push('Sender information is required');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

module.exports = {
    validateWebhookSignature,
    parseWebhookEvent,
    extractRepositoryInfo,
    extractSenderInfo,
    sanitizePayloadForLogging,
    validateWebhookPayload
};