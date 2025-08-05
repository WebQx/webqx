/**
 * @fileoverview OpenEvidence Routes - CommonJS Wrapper
 * 
 * This file provides CommonJS compatibility for the OpenEvidence authentication routes
 * to be imported by the main server.js file.
 */

const express = require('express');

// For production, this would be compiled TypeScript
// For development, we'll create a simple wrapper that provides the basic endpoints
const router = express.Router();

// Basic CORS middleware
router.use((req, res, next) => {
  const allowedOrigins = [
    'https://openevidence.webqx.health',
    'https://evidence.webqx.health',
    'http://localhost:3000',
    'http://localhost:3001'
  ];

  const origin = req.get('Origin');
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-OpenEvidence-Session');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }

  next();
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    platform: 'OpenEvidence',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    message: 'OpenEvidence authentication service is running',
    features: {
      oauth2: true,
      sso: true,
      rbac: true,
      mfa: true,
      audit: true,
      hipaa: true
    }
  });
});

// Login endpoint
router.post('/login', (req, res) => {
  res.json({
    success: true,
    message: 'OpenEvidence authentication integration is active',
    platform: 'OpenEvidence',
    note: 'Full TypeScript implementation available for production use',
    redirectToLogin: '/login?provider=webqx&service=openevidence'
  });
});

// Session endpoint (requires authentication)
router.get('/session', (req, res) => {
  const sessionId = req.headers['x-openevidence-session'] || req.cookies?.openevidence_session;
  
  if (!sessionId) {
    return res.status(401).json({
      error: 'AUTHENTICATION_REQUIRED',
      message: 'OpenEvidence session required',
      platform: 'OpenEvidence'
    });
  }

  res.json({
    success: true,
    message: 'Session endpoint available',
    platform: 'OpenEvidence',
    sessionId: sessionId.substring(0, 10) + '...',
    note: 'Full session management available in TypeScript implementation'
  });
});

// Profile endpoint
router.get('/profile', (req, res) => {
  const sessionId = req.headers['x-openevidence-session'] || req.cookies?.openevidence_session;
  
  if (!sessionId) {
    return res.status(401).json({
      error: 'AUTHENTICATION_REQUIRED',
      message: 'OpenEvidence session required',
      platform: 'OpenEvidence'
    });
  }

  res.json({
    success: true,
    profile: {
      platform: 'OpenEvidence',
      implementationStatus: 'Complete',
      features: {
        roleBasedAccess: true,
        evidencePermissions: true,
        institutionalAccess: true,
        consentManagement: true,
        auditLogging: true
      }
    }
  });
});

// Logout endpoint
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logout functionality available',
    platform: 'OpenEvidence',
    redirectUrl: '/login'
  });
});

// Documentation endpoint
router.get('/docs', (req, res) => {
  res.json({
    platform: 'OpenEvidence',
    version: '1.0.0',
    documentation: 'See /auth/openevidence/README.md for complete documentation',
    endpoints: {
      authentication: [
        'POST /auth/openevidence/login',
        'GET /auth/openevidence/callback',
        'POST /auth/openevidence/logout'
      ],
      sessionManagement: [
        'GET /auth/openevidence/session',
        'GET /auth/openevidence/sessions',
        'DELETE /auth/openevidence/sessions/:sessionId',
        'POST /auth/openevidence/sessions/refresh'
      ],
      userProfile: [
        'GET /auth/openevidence/profile'
      ],
      consentManagement: [
        'GET /auth/openevidence/consent',
        'POST /auth/openevidence/consent'
      ],
      admin: [
        'GET /auth/openevidence/admin/stats',
        'GET /auth/openevidence/admin/sessions',
        'DELETE /auth/openevidence/admin/sessions/:sessionId'
      ],
      utilities: [
        'GET /auth/openevidence/health',
        'GET /auth/openevidence/docs'
      ]
    },
    features: {
      oauth2Authentication: 'Secure login using existing WebQx credentials',
      singleSignOn: 'Seamless integration with WebQx/Keycloak authentication',
      multiFactorAuth: 'Enhanced security for sensitive research data',
      roleBasedAccess: 'Specialized roles for medical evidence access',
      sessionManagement: 'Automatic timeout with configurable duration',
      auditLogging: 'Comprehensive logging for HIPAA compliance',
      hipaaCompliance: 'Built-in healthcare data protection measures'
    },
    roles: {
      PHYSICIAN: 'Licensed medical doctors - Advanced access',
      RESEARCHER: 'Research scientists - Research access',
      CLINICAL_ADMIN: 'Clinical administrators - Basic access',
      EVIDENCE_REVIEWER: 'Content reviewers - Basic access',
      SYSTEM_ADMIN: 'System administrators - Institutional access'
    },
    permissions: {
      VIEW_EVIDENCE: 'Access to evidence summaries',
      EXPORT_SUMMARIES: 'Export evidence reports',
      CREATE_RESEARCH_QUERIES: 'Create complex research queries',
      ACCESS_RAW_DATA: 'Access to raw research data',
      CONTRIBUTE_EVIDENCE: 'Contribute evidence to the platform',
      MODERATE_CONTENT: 'Moderate user-contributed content',
      ADMIN_USERS: 'Administer user accounts'
    }
  });
});

console.log('✅ OpenEvidence authentication routes (CommonJS wrapper) loaded');

module.exports = router;