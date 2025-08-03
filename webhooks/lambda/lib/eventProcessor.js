const { extractRepositoryInfo, extractSenderInfo, sanitizePayloadForLogging, validateWebhookPayload } = require('./webhookUtils');

/**
 * Main event processor that routes webhook events to appropriate handlers
 * @param {string} eventType - GitHub event type (push, pull_request, etc.)
 * @param {Object} payload - Webhook payload
 * @param {Object} context - Additional context (delivery ID, request ID, etc.)
 * @returns {Object} Processing result
 */
async function processWebhookEvent(eventType, payload, context = {}) {
    console.log(`🔄 Processing ${eventType} event`, {
        delivery: context.delivery,
        requestId: context.requestId
    });

    // Validate payload structure
    const validation = validateWebhookPayload(payload);
    if (!validation.isValid) {
        throw new Error(`Invalid payload: ${validation.errors.join(', ')}`);
    }

    // Extract common information
    const repositoryInfo = extractRepositoryInfo(payload);
    const senderInfo = extractSenderInfo(payload);

    console.log('📊 Event context', {
        repository: repositoryInfo?.fullName,
        sender: senderInfo?.login,
        eventType
    });

    // Route to specific event handler
    let result;
    switch (eventType) {
        case 'push':
            result = await handlePushEvent(payload, context);
            break;
        case 'pull_request':
            result = await handlePullRequestEvent(payload, context);
            break;
        case 'issues':
            result = await handleIssuesEvent(payload, context);
            break;
        case 'release':
            result = await handleReleaseEvent(payload, context);
            break;
        case 'workflow_run':
            result = await handleWorkflowRunEvent(payload, context);
            break;
        case 'deployment':
            result = await handleDeploymentEvent(payload, context);
            break;
        case 'ping':
            result = await handlePingEvent(payload, context);
            break;
        default:
            result = await handleGenericEvent(eventType, payload, context);
    }

    return {
        eventType,
        repository: repositoryInfo,
        sender: senderInfo,
        summary: result,
        timestamp: new Date().toISOString()
    };
}

/**
 * Handle push events (code pushes to repository)
 */
async function handlePushEvent(payload, context) {
    const { ref, commits, pusher, repository } = payload;
    const branch = ref.replace('refs/heads/', '');
    
    console.log(`📥 Push to ${repository.full_name}/${branch}`, {
        commits: commits?.length || 0,
        pusher: pusher?.name
    });

    // Example processing logic - customize based on your needs
    const actions = [];

    // Check if this is the main/master branch
    if (branch === repository.default_branch) {
        actions.push('trigger-production-deployment');
        console.log('🚀 Main branch push detected - triggering production deployment');
    }

    // Check for specific file changes
    if (commits) {
        const hasDocChanges = commits.some(commit => 
            commit.added?.some(file => file.includes('.md')) ||
            commit.modified?.some(file => file.includes('.md'))
        );
        
        if (hasDocChanges) {
            actions.push('update-documentation');
            console.log('📚 Documentation changes detected');
        }

        const hasConfigChanges = commits.some(commit =>
            commit.added?.some(file => file.includes('package.json') || file.includes('.yml') || file.includes('.yaml')) ||
            commit.modified?.some(file => file.includes('package.json') || file.includes('.yml') || file.includes('.yaml'))
        );

        if (hasConfigChanges) {
            actions.push('security-scan');
            console.log('🔐 Configuration changes detected - triggering security scan');
        }
    }

    return {
        action: 'push-processed',
        branch,
        commitCount: commits?.length || 0,
        triggeredActions: actions
    };
}

/**
 * Handle pull request events
 */
async function handlePullRequestEvent(payload, context) {
    const { action, pull_request, repository } = payload;
    
    console.log(`🔀 Pull request ${action}`, {
        number: pull_request.number,
        title: pull_request.title,
        from: pull_request.head.ref,
        to: pull_request.base.ref
    });

    const actions = [];

    if (action === 'opened') {
        actions.push('run-ci-checks', 'assign-reviewers');
        console.log('✨ New PR opened - triggering CI checks');
    } else if (action === 'closed' && pull_request.merged) {
        actions.push('cleanup-feature-branch');
        console.log('🎉 PR merged - cleaning up feature branch');
    } else if (action === 'synchronize') {
        actions.push('run-ci-checks');
        console.log('🔄 PR updated - re-running CI checks');
    }

    return {
        action: `pull-request-${action}`,
        prNumber: pull_request.number,
        triggeredActions: actions
    };
}

/**
 * Handle issues events
 */
async function handleIssuesEvent(payload, context) {
    const { action, issue, repository } = payload;
    
    console.log(`🐛 Issue ${action}`, {
        number: issue.number,
        title: issue.title,
        labels: issue.labels?.map(l => l.name)
    });

    const actions = [];

    if (action === 'opened') {
        actions.push('triage-issue', 'notify-maintainers');
    } else if (action === 'labeled') {
        const criticalLabels = ['critical', 'security', 'bug'];
        const hasCritical = issue.labels?.some(label => 
            criticalLabels.includes(label.name.toLowerCase())
        );
        
        if (hasCritical) {
            actions.push('escalate-critical-issue');
        }
    }

    return {
        action: `issue-${action}`,
        issueNumber: issue.number,
        triggeredActions: actions
    };
}

/**
 * Handle release events
 */
async function handleReleaseEvent(payload, context) {
    const { action, release, repository } = payload;
    
    console.log(`🎁 Release ${action}`, {
        tag: release.tag_name,
        name: release.name,
        prerelease: release.prerelease
    });

    const actions = [];

    if (action === 'published' && !release.prerelease) {
        actions.push('deploy-to-production', 'update-changelog', 'notify-users');
    }

    return {
        action: `release-${action}`,
        version: release.tag_name,
        triggeredActions: actions
    };
}

/**
 * Handle workflow run events
 */
async function handleWorkflowRunEvent(payload, context) {
    const { action, workflow_run, repository } = payload;
    
    console.log(`⚙️ Workflow ${action}`, {
        name: workflow_run.name,
        conclusion: workflow_run.conclusion,
        status: workflow_run.status
    });

    const actions = [];

    if (action === 'completed') {
        if (workflow_run.conclusion === 'failure') {
            actions.push('notify-failure', 'create-incident');
        } else if (workflow_run.conclusion === 'success') {
            actions.push('update-status-check');
        }
    }

    return {
        action: `workflow-${action}`,
        workflowName: workflow_run.name,
        conclusion: workflow_run.conclusion,
        triggeredActions: actions
    };
}

/**
 * Handle deployment events
 */
async function handleDeploymentEvent(payload, context) {
    const { deployment, repository } = payload;
    
    console.log(`🚀 Deployment event`, {
        environment: deployment.environment,
        ref: deployment.ref,
        task: deployment.task
    });

    return {
        action: 'deployment-received',
        environment: deployment.environment,
        triggeredActions: ['update-deployment-status']
    };
}

/**
 * Handle ping events (webhook test)
 */
async function handlePingEvent(payload, context) {
    console.log('🏓 Ping event received - webhook is working!');
    
    return {
        action: 'ping-received',
        triggeredActions: ['confirm-webhook-setup']
    };
}

/**
 * Handle unknown/generic events
 */
async function handleGenericEvent(eventType, payload, context) {
    console.log(`📦 Generic event: ${eventType}`);
    
    return {
        action: `${eventType}-received`,
        triggeredActions: ['log-event']
    };
}

module.exports = {
    processWebhookEvent,
    handlePushEvent,
    handlePullRequestEvent,
    handleIssuesEvent,
    handleReleaseEvent,
    handleWorkflowRunEvent,
    handleDeploymentEvent,
    handlePingEvent,
    handleGenericEvent
};