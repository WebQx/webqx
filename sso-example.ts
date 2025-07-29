/**
 * Example SSO integration for WebQX™ Healthcare Platform
 * This file demonstrates how to integrate the SSO module with an Express.js application
 */

import express from 'express';
import { SSOManager } from './sso';

const app = express();

// Parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize SSO Manager
const sso = new SSOManager({
  secretKey: process.env.SSO_SECRET_KEY || 'your-256-bit-secret-key-here-minimum-32-chars',
  sessionTimeout: 3600000, // 1 hour
  auditEnabled: true,
  providers: {
    oauth2: {
      azure: {
        provider: 'azure',
        clientId: process.env.AZURE_CLIENT_ID || 'your-azure-client-id',
        clientSecret: process.env.AZURE_CLIENT_SECRET || 'your-azure-client-secret',
        redirectUri: process.env.AZURE_REDIRECT_URI || 'https://localhost:3000/auth/oauth2/azure/callback',
        scope: ['openid', 'profile', 'email', 'User.Read'],
        tenant: process.env.AZURE_TENANT_ID || 'your-tenant-id'
      },
      google: {
        provider: 'google',
        clientId: process.env.GOOGLE_CLIENT_ID || 'your-google-client-id.googleusercontent.com',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'your-google-client-secret',
        redirectUri: process.env.GOOGLE_REDIRECT_URI || 'https://localhost:3000/auth/oauth2/google/callback',
        scope: ['openid', 'profile', 'email']
      }
    },
    saml: {
      azure: {
        provider: 'azure',
        entryPoint: process.env.AZURE_SAML_ENTRY_POINT || 'https://login.microsoftonline.com/your-tenant/saml2',
        issuer: process.env.SAML_ISSUER || 'https://your-app.com',
        cert: process.env.AZURE_SAML_CERT || 'your-azure-saml-certificate'
      }
    }
  }
});

// ============================================================================
// Authentication Routes
// ============================================================================

// OAuth2 Routes
app.get('/auth/oauth2/:provider', (req, res) => {
  try {
    const provider = req.params.provider;
    const redirectUri = req.query.redirect as string;
    
    const authUrl = sso.getOAuth2AuthUrl(provider, redirectUri);
    res.redirect(authUrl);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/auth/oauth2/:provider/callback', async (req, res) => {
  try {
    const provider = req.params.provider;
    const { user, token, session } = await sso.handleOAuth2Callback(provider, req);
    
    // Set secure HTTP-only cookie
    res.cookie('sso_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000 // 1 hour
    });
    
    // Redirect to dashboard or original destination
    const redirectUrl = req.query.state as string || '/dashboard';
    res.redirect(redirectUrl);
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed', message: error.message });
  }
});

// SAML Routes
app.get('/auth/saml/:provider', (req, res) => {
  try {
    const provider = req.params.provider;
    const relayState = req.query.relay_state as string;
    
    const authUrl = sso.getSAMLAuthUrl(provider, relayState);
    res.redirect(authUrl);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/auth/saml/:provider/callback', async (req, res) => {
  try {
    const provider = req.params.provider;
    const { user, token, session } = await sso.handleSAMLCallback(provider, req);
    
    // Set secure HTTP-only cookie
    res.cookie('sso_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000 // 1 hour
    });
    
    // Redirect to dashboard or relay state destination
    const redirectUrl = req.body.RelayState || '/dashboard';
    res.redirect(redirectUrl);
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed', message: error.message });
  }
});

// Logout
app.post('/auth/logout', sso.logout, (req, res) => {
  res.clearCookie('sso_token');
  res.json({ message: 'Logged out successfully' });
});

// ============================================================================
// Protected Routes Examples
// ============================================================================

// Basic protected route
app.get('/dashboard', sso.requireAuth, (req, res) => {
  res.json({
    message: 'Welcome to the dashboard',
    user: req.user
  });
});

// Role-based protected route (for healthcare providers)
app.get('/provider/patients', sso.requireRoles(['provider', 'physician', 'nurse']), (req, res) => {
  res.json({
    message: 'Patient list for healthcare providers',
    user: req.user,
    data: {
      patients: [
        { id: '1', name: 'John Doe', lastVisit: '2024-01-15' },
        { id: '2', name: 'Jane Smith', lastVisit: '2024-01-14' }
      ]
    }
  });
});

// Group-based protected route (for administrative staff)
app.get('/admin/reports', sso.requireGroups(['administrators', 'management']), (req, res) => {
  res.json({
    message: 'Administrative reports',
    user: req.user,
    data: {
      reports: [
        { name: 'Monthly Patient Report', type: 'patient_stats' },
        { name: 'Provider Utilization', type: 'provider_stats' }
      ]
    }
  });
});

// Optional authentication route (public but enhanced if authenticated)
app.get('/health-resources', sso.optionalAuth, (req, res) => {
  const baseResources = [
    { title: 'General Health Tips', category: 'wellness', public: true },
    { title: 'Exercise Guidelines', category: 'fitness', public: true }
  ];

  const personalizedResources = req.user ? [
    { title: 'Your Care Plan', category: 'personal', public: false },
    { title: 'Medication Reminders', category: 'personal', public: false }
  ] : [];

  res.json({
    message: 'Health resources',
    user: req.user,
    resources: [...baseResources, ...personalizedResources]
  });
});

// ============================================================================
// API Information Routes
// ============================================================================

// Get authentication providers
app.get('/auth/providers', (req, res) => {
  const providers = sso.getSupportedProviders();
  res.json({
    oauth2: providers.oauth2,
    saml: providers.saml
  });
});

// Get provider health status
app.get('/auth/health', async (req, res) => {
  const health = await sso.getProviderHealth();
  res.json(health);
});

// Refresh token
app.post('/auth/refresh', async (req, res) => {
  try {
    const { token } = req.body;
    const newToken = await sso.refreshToken(token);
    
    res.cookie('sso_token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000
    });
    
    res.json({ message: 'Token refreshed successfully' });
  } catch (error) {
    res.status(401).json({ error: 'Token refresh failed', message: error.message });
  }
});

// Get user profile from token
app.get('/auth/profile', sso.requireAuth, (req, res) => {
  res.json({
    user: req.user,
    session: {
      provider: req.session?.provider,
      protocol: req.session?.protocol,
      createdAt: req.session?.createdAt,
      expiresAt: req.session?.expiresAt
    }
  });
});

// ============================================================================
// Error Handling
// ============================================================================

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('SSO Error:', err);
  
  res.status(err.statusCode || 500).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================================================
// Server Startup
// ============================================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 WebQX™ Healthcare Platform with SSO running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`🔐 OAuth2 Providers: ${JSON.stringify(sso.getSupportedProviders().oauth2)}`);
  console.log(`🔒 SAML Providers: ${JSON.stringify(sso.getSupportedProviders().saml)}`);
});

export default app;