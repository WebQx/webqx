const express = require('express');
const jwt = require('jsonwebtoken');

// For demo: reuse provider SSO exchange/userinfo endpoints by proxying to /api/auth/sso
// and implement a patient-facing finalize endpoint that performs JIT provisioning
// using the existing patient-portal userService.

const { registerUser, getUserByEmail, verifyToken } = require('../../patient-portal/auth/userService');

const router = express.Router();

// Finalize SSO for patients: create/reuse local account and issue JWT
router.post('/sso-login', async (req, res) => {
  try {
    const { provider, userInfo } = req.body || {};
    if (!provider || !userInfo || !userInfo.email) {
      return res.status(400).json({ success: false, error: 'Missing provider or email from SSO', code: 'BAD_REQUEST' });
    }

    const email = String(userInfo.email).toLowerCase();

    let user = getUserByEmail(email);
    if (!user) {
      // JIT provision a new patient account
      const displayName = userInfo.name || `${userInfo.given_name || ''} ${userInfo.family_name || ''}`.trim() || 'New Patient';
      const reg = await registerUser({ name: displayName, email, password: `sso_${provider}_placeholder` });
      if (!reg.success) {
        return res.status(500).json({ success: false, error: 'Failed to create user', code: 'USER_CREATION_FAILED' });
      }
      user = reg.user;
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name, type: 'patient', provider },
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      { expiresIn: '24h', issuer: 'webqx-patient-portal', audience: 'webqx-healthcare' }
    );

    try {
      const isProd = (process.env.NODE_ENV === 'production');
      res.cookie('patient_token', token, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/',
      });
    } catch (_) {}

    res.json({ success: true, token, user: { ...user, role: 'patient' } });
  } catch (err) {
    console.error('Patient SSO finalize error:', err);
    res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// Simple verify route for patients
router.get('/verify', (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ success: false, error: 'NO_TOKEN' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
    if (decoded.type && decoded.type !== 'patient') {
      return res.status(401).json({ success: false, error: 'INVALID_TOKEN_TYPE' });
    }
    return res.json({ success: true, user: decoded });
  } catch (e) {
    return res.status(401).json({ success: false, error: 'INVALID_TOKEN' });
  }
});

module.exports = router;
