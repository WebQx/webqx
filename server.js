#!/usr/bin/env node
/** Root startup wrapper with test-friendly export */

// When running under Jest, export a minimal Express app with the endpoints
// used by integration tests instead of spawning background servers.
if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
  const express = require('express');
  const cookieParser = require('cookie-parser');
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Minimal OAuth authorize stub
  app.get('/oauth/authorize', (req, res) => {
    const q = req.query || {};
    const redirect = `https://auth.webqx.health/authorize?response_type=${encodeURIComponent(q.response_type || 'code')}&client_id=${encodeURIComponent(q.client_id || 'test')}`;
    res.redirect(302, redirect);
  });

  // OAuth2 authentication middleware
  const { authenticateToken } = require('./auth/oauth2/middleware');
  
  // Production authentication - only provide dev token in development
  if (process.env.NODE_ENV === 'development') {
    app.get('/dev/token', (_req, res) => {
      res.json({ access_token: 'dev-token', token_type: 'Bearer', expires_in: 3600 });
    });
  }

  // Use proper OAuth2 authentication middleware instead of mock
  app.use(authenticateToken);

  // Mount Telepsychiatry-related routes with error handling
  try { 
    const sessionRoutes = require('./routes/session');
    app.use('/session', sessionRoutes); 
  } catch (e) { 
    console.warn('Session routes not available:', e.message);
  }
  try { 
    const consentRoutes = require('./routes/consent');
    app.use('/consent', consentRoutes); 
  } catch (e) { 
    console.warn('Consent routes not available:', e.message);
  }
  try { 
    const workflowRoutes = require('./routes/workflow');
    app.use('/workflow', workflowRoutes); 
  } catch (e) { 
    console.warn('Workflow routes not available:', e.message);
  }
  try { 
    const emrRoutes = require('./routes/emr');
    app.use('/emr', emrRoutes); 
  } catch (e) { 
    console.warn('EMR routes not available:', e.message);
  }
  try { 
    const analyticsRoutes = require('./routes/analytics');
    app.use('/analytics', analyticsRoutes); 
  } catch (e) { 
    console.warn('Analytics routes not available:', e.message);
  }
  try { 
    const chatRoutes = require('./routes/chat');
    app.use('/chat', chatRoutes); 
  } catch (e) { 
    console.warn('Chat routes not available:', e.message);
  }
  try { 
    const uiRoutes = require('./routes/ui');
    app.use('/ui', uiRoutes); 
  } catch (e) { 
    console.warn('UI routes not available:', e.message);
  }

  module.exports = app;
} else {
  (async () => {
    const startTime = Date.now();
    console.log('🏥 WebQX Root Entrypoint Initializing...');
    try {
      const UnifiedServer = require('./core/unified-server.js');
      const unified = new UnifiedServer();
      await unified.start();
      console.log(`✅ WebQX Healthcare Platform Gateway started (${Date.now() - startTime}ms)`);
    } catch (e) {
      console.warn('⚠️ Platform gateway failed:', e.message);
      try {
        const Legacy = require('./core/start-webqx-server.js');
        const mgr = new Legacy();
        await mgr.start();
        console.log(`✅ Legacy orchestrator started (${Date.now() - startTime}ms)`);
      } catch (e2) {
        console.error('❌ Startup failed (unified + legacy).');
        console.error('Primary:', e);
        console.error('Fallback:', e2);
        process.exit(1);
      }
    }
  })();
}
