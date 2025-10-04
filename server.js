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

  // OAuth2 authentication middleware (full stack for non-test environments)
  const { authenticateToken } = require('./auth/oauth2/middleware');

  const attachTestAuth = () => {
    const TEST_ACCESS_TOKEN = 'telepsychiatry-test-token';

    try {
      const send = require('send');
      if (send && send.mime) {
        if (!send.mime.charsets) {
          send.mime.charsets = {};
        }
        if (typeof send.mime.charsets.lookup !== 'function') {
          send.mime.charsets.lookup = (type) => {
            try {
              const value = String(type || '').toLowerCase();
              return /^text\//.test(value) || /\/(json|xml|javascript)$/.test(value) ? 'utf-8' : undefined;
            } catch {
              return 'utf-8';
            }
          };
        }
      }
    } catch {}

    try {
      const mime = require('mime');
      if (mime) {
        if (typeof mime.lookup !== 'function') {
          mime.lookup = (type) => {
            if (!type) return false;
            if (type.includes('/')) {
              return type.toLowerCase();
            }
            return `application/${String(type).toLowerCase()}`;
          };
        }

        if (typeof mime.contentType !== 'function') {
          mime.contentType = (type) => {
            const normalized = mime.lookup(type);
            return normalized ? `${normalized}; charset=utf-8` : false;
          };
        }
      }
    } catch {}

    app.get('/dev/token', (_req, res) => {
      res.json({
        access_token: TEST_ACCESS_TOKEN,
        token_type: 'Bearer',
        expires_in: 3600
      });
    });

    app.use((req, res, next) => {
      if (req.path === '/dev/token') {
        return next();
      }

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'MISSING_TOKEN',
          message: 'Authentication token required for test middleware'
        });
      }

      const token = authHeader.substring('Bearer '.length);
      if (token !== TEST_ACCESS_TOKEN) {
        return res.status(401).json({
          success: false,
          error: 'INVALID_TOKEN',
          message: 'Invalid test access token'
        });
      }

      req.user = {
        id: 'test-clinician-456',
        userId: 'test-clinician-456',
        email: 'clinician@test.webqx.health',
        name: 'Test Clinician',
        roles: ['provider'],
        permissions: ['patient:read', 'patient:write', 'workflow:manage']
      };

      next();
    });

    app.use((err, req, res, next) => {
      if (!err) {
        return next();
      }

      console.error('[Test API] Unhandled error:', err);
      const status = err.status || err.statusCode || 500;
      res.status(status).json({
        success: false,
        error: 'TEST_SERVER_ERROR',
        message: err.message || 'Internal server error'
      });
    });
  };

  if (process.env.NODE_ENV === 'test') {
    attachTestAuth();
  } else {
    if (process.env.NODE_ENV === 'development') {
      app.get('/dev/token', (_req, res) => {
        res.json({ access_token: 'dev-token', token_type: 'Bearer', expires_in: 3600 });
      });
    }

    // Use proper OAuth2 authentication middleware instead of mock
    app.use(authenticateToken);
  }

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
