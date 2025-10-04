const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Rate limiting for provider authentication endpoints
const providerAuthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs for auth endpoints
    message: {
        error: 'Too many authentication attempts, please try again later.',
        code: 'TOO_MANY_REQUESTS'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Mock provider database (in production, use a real database)
const providers = new Map();
const sessions = new Map();
const lockedAccounts = new Map();

const OPENEMR_SCOPE_FALLBACK = 'openid fhirUser patient/Patient.read patient/Appointment.read patient/Appointment.write patient/Encounter.read user/Practitioner.read';
const OPENEMR_TOKEN_TTL_FALLBACK = 3600; // seconds

function loadOpenEMRConfig() {
    const baseUrlRaw = (process.env.OPENEMR_BASE_URL || '').trim();
    const clientId = (process.env.OPENEMR_CLIENT_ID || '').trim();
    const clientSecret = (process.env.OPENEMR_CLIENT_SECRET || '').trim();
    const scope = (process.env.OPENEMR_SSO_SCOPES || process.env.OPENEMR_SCOPE || OPENEMR_SCOPE_FALLBACK).trim();

    const issuer = (process.env.CENTRAL_IDP_ISSUER || process.env.KEYCLOAK_ISSUER || '').trim();
    const explicitUserInfo = (process.env.CENTRAL_IDP_USERINFO_URL || process.env.KEYCLOAK_USERINFO_URL || '').trim();
    const userInfoUrl = explicitUserInfo || (issuer ? `${issuer.replace(/\/$/, '')}/protocol/openid-connect/userinfo` : '');

    return {
        enabled: Boolean(baseUrlRaw && clientId && clientSecret),
        baseUrl: baseUrlRaw ? baseUrlRaw.replace(/\/$/, '') : '',
        clientId,
        clientSecret,
        scope,
        userInfoUrl
    };
}

async function validateCentralToken(accessToken, userInfoUrl) {
    if (!accessToken) {
        return { valid: false, reason: 'MISSING_TOKEN' };
    }
    if (!userInfoUrl) {
        // Without a userinfo endpoint we optimistically trust the token
        return { valid: true, claims: null, reason: 'USERINFO_UNAVAILABLE' };
    }

    try {
        const response = await fetch(userInfoUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) {
            return {
                valid: false,
                reason: `USERINFO_${response.status}`,
                payload: await safeJson(response)
            };
        }

        const claims = await response.json().catch(() => null);
        return { valid: true, claims };
    } catch (error) {
        return {
            valid: false,
            reason: 'USERINFO_ERROR',
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

async function safeJson(response) {
    try {
        return await response.json();
    } catch (_) {
        return null;
    }
}

async function requestOpenEMRTokens(config, scopeOverride) {
    const tokenUrl = `${config.baseUrl}/oauth2/default/token`;
    const scope = (scopeOverride && scopeOverride.trim()) || config.scope || OPENEMR_SCOPE_FALLBACK;

    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`
        },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            scope
        })
    });

    if (!response.ok) {
        const payload = await safeJson(response);
        const message = payload?.error_description || response.statusText;
        throw new Error(message || 'OpenEMR token request failed');
    }

    const data = await response.json();
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        tokenType: data.token_type || 'Bearer',
        expiresIn: typeof data.expires_in === 'number' ? data.expires_in : OPENEMR_TOKEN_TTL_FALLBACK,
        scope: data.scope || scope,
        idToken: data.id_token
    };
}

function maskToken(token) {
    if (!token || token.length <= 8) return token;
    return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

async function bridgeOpenEMRSession({ account, tokenData }) {
    const config = loadOpenEMRConfig();
    if (!config.enabled) {
        return {
            enabled: false,
            reason: 'NOT_CONFIGURED'
        };
    }

    const accessToken = tokenData?.access_token;
    const validation = await validateCentralToken(accessToken, config.userInfoUrl);
    if (!validation.valid && validation.reason !== 'USERINFO_UNAVAILABLE') {
        return {
            enabled: false,
            reason: validation.reason || 'TOKEN_INVALID',
            details: validation.error || validation.payload || null
        };
    }

    try {
        const tokens = await requestOpenEMRTokens(config, tokenData?.scope);
        const obtainedAt = new Date();
        const expiresAt = new Date(obtainedAt.getTime() + (tokens.expiresIn || OPENEMR_TOKEN_TTL_FALLBACK) * 1000);

        return {
            enabled: true,
            baseUrl: config.baseUrl,
            tokens,
            obtainedAt: obtainedAt.toISOString(),
            expiresAt: expiresAt.toISOString(),
            user: {
                openemrUserId: account.id,
                email: account.email,
                name: account.name
            },
            validation
        };
    } catch (error) {
        return {
            enabled: false,
            reason: 'OPENEMR_TOKEN_EXCHANGE_FAILED',
            details: error instanceof Error ? error.message : String(error)
        };
    }
}

// Initialize sample providers
providers.set('dr.smith@hospital.com', {
    id: uuidv4(),
    username: 'dr.smith@hospital.com',
    email: 'dr.smith@hospital.com',
    name: 'Dr. Sarah Smith',
    password: '$2b$10$hwH7BAAY1G6v779fk0smmuFZcS..gxGdyPsuExGoxoML7gfdMwwue', // password123
    roles: ['physician', 'administrator'],
    specialty: 'Internal Medicine',
    npi: '1234567890',
    licenseNumber: 'MD123456',
    isActive: true,
    failedAttempts: 0,
    lastLogin: null,
    createdAt: new Date(),
    licenseState: 'CA',
    dea: 'AS1234567'
});

providers.set('nurse.johnson@hospital.com', {
    id: uuidv4(),
    username: 'nurse.johnson@hospital.com',
    email: 'nurse.johnson@hospital.com',
    name: 'Jennifer Johnson, RN',
    password: '$2b$10$hwH7BAAY1G6v779fk0smmuFZcS..gxGdyPsuExGoxoML7gfdMwwue', // password123
    roles: ['nurse'],
    specialty: 'Critical Care',
    licenseNumber: 'RN987654',
    isActive: true,
    failedAttempts: 0,
    lastLogin: null,
    createdAt: new Date(),
    licenseState: 'CA'
});

providers.set('pharm.davis@hospital.com', {
    id: uuidv4(),
    username: 'pharm.davis@hospital.com',
    email: 'pharm.davis@hospital.com',
    name: 'Michael Davis, PharmD',
    password: '$2b$10$hwH7BAAY1G6v779fk0smmuFZcS..gxGdyPsuExGoxoML7gfdMwwue', // password123
    roles: ['pharmacist'],
    specialty: 'Clinical Pharmacy',
    licenseNumber: 'PharmD456789',
    isActive: true,
    failedAttempts: 0,
    lastLogin: null,
    createdAt: new Date(),
    licenseState: 'CA'
});

// Helper functions
function validateProvider(username, password) {
    const provider = providers.get(username) || [...providers.values()].find(p => p.username === username);
    
    if (!provider) {
        return { success: false, error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' };
    }
    
    if (!provider.isActive) {
        return { success: false, error: 'Account is suspended', code: 'ACCOUNT_SUSPENDED' };
    }
    
    // Check if account is locked
    if (lockedAccounts.has(provider.id)) {
        const lockInfo = lockedAccounts.get(provider.id);
        if (Date.now() < lockInfo.unlockTime) {
            return { success: false, error: 'Account is temporarily locked', code: 'ACCOUNT_LOCKED' };
        } else {
            // Unlock account
            lockedAccounts.delete(provider.id);
            provider.failedAttempts = 0;
        }
    }
    
    return { success: true, provider };
}

function lockAccount(providerId, attempts = 0) {
    const lockDuration = Math.min(5 * Math.pow(2, attempts), 60) * 60 * 1000; // Exponential backoff, max 1 hour
    lockedAccounts.set(providerId, {
        unlockTime: Date.now() + lockDuration,
        attempts
    });
}

function generateToken(provider) {
    const payload = {
        userId: provider.id,
        username: provider.username,
        email: provider.email,
        roles: provider.roles,
        type: 'provider'
    };
    
    return jwt.sign(payload, process.env.JWT_SECRET || 'webqx-provider-secret', {
        expiresIn: '8h', // 8 hour session
        issuer: 'webqx-provider-portal',
        audience: 'webqx-healthcare'
    });
}

function verifyToken(token) {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'webqx-provider-secret');
        if (decoded.type !== 'provider') {
            return { success: false, error: 'Invalid token type', code: 'INVALID_TOKEN' };
        }
        return { success: true, user: decoded };
    } catch (error) {
        return { success: false, error: 'Invalid or expired token', code: 'INVALID_TOKEN' };
    }
}

// Provider login endpoint
router.post('/login',
    providerAuthLimiter,
    [
        body('username')
            .trim()
            .isLength({ min: 1 })
            .withMessage('Username or email is required'),
        body('password')
            .isLength({ min: 1 })
            .withMessage('Password is required')
    ],
    async (req, res) => {
        try {
            // Check validation errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: errors.array(),
                    code: 'VALIDATION_ERROR'
                });
            }

            const { username, password } = req.body;

            // Validate provider
            const validation = validateProvider(username);
            if (!validation.success) {
                return res.status(validation.code === 'ACCOUNT_LOCKED' ? 423 : 401).json(validation);
            }

            const provider = validation.provider;

            // Check password
            const passwordMatch = await bcrypt.compare(password, provider.password);
            
            if (!passwordMatch) {
                provider.failedAttempts = (provider.failedAttempts || 0) + 1;
                
                if (provider.failedAttempts >= 5) {
                    lockAccount(provider.id, provider.failedAttempts - 5);
                    return res.status(423).json({
                        success: false,
                        error: 'Too many failed attempts. Account is temporarily locked.',
                        code: 'ACCOUNT_LOCKED'
                    });
                }
                
                return res.status(401).json({
                    success: false,
                    error: 'Invalid credentials',
                    code: 'INVALID_CREDENTIALS'
                });
            }

            // Reset failed attempts on successful login
            provider.failedAttempts = 0;
            provider.lastLogin = new Date();

            // Generate token
            const token = generateToken(provider);

            // Set HttpOnly session cookie for server-side protection
            try {
                const isProd = (process.env.NODE_ENV === 'production');
                res.cookie('provider_token', token, {
                    httpOnly: true,
                    secure: isProd,
                    sameSite: 'lax',
                    maxAge: 8 * 60 * 60 * 1000, // 8 hours
                    path: '/'
                });
            } catch (_) { /* ignore cookie set errors */ }

            // Create session
            const sessionId = uuidv4();
            sessions.set(sessionId, {
                providerId: provider.id,
                token,
                createdAt: new Date(),
                lastActivity: new Date(),
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            // Return success response
            res.json({
                success: true,
                message: 'Login successful',
                token,
                user: {
                    id: provider.id,
                    username: provider.username,
                    email: provider.email,
                    name: provider.name,
                    roles: provider.roles,
                    specialty: provider.specialty,
                    npi: provider.npi,
                    licenseNumber: provider.licenseNumber,
                    licenseState: provider.licenseState
                },
                session: {
                    id: sessionId,
                    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000) // 8 hours
                }
            });

        } catch (error) {
            console.error('Provider login error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
);

// Provider token verification endpoint
router.get('/verify', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Authorization token required',
                code: 'NO_TOKEN'
            });
        }

        const token = authHeader.substring(7);
        const tokenResult = verifyToken(token);

        if (!tokenResult.success) {
            return res.status(401).json(tokenResult);
        }

        // Get current provider data
        const provider = [...providers.values()].find(p => p.id === tokenResult.user.userId);
        if (!provider || !provider.isActive) {
            return res.status(404).json({
                success: false,
                error: 'Provider not found or inactive',
                code: 'PROVIDER_NOT_FOUND'
            });
        }

        res.json({
            success: true,
            user: {
                id: provider.id,
                username: provider.username,
                email: provider.email,
                name: provider.name,
                roles: provider.roles,
                specialty: provider.specialty,
                npi: provider.npi,
                licenseNumber: provider.licenseNumber,
                licenseState: provider.licenseState
            }
        });

    } catch (error) {
        console.error('Provider verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Provider profile endpoint
router.get('/profile', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Authorization token required',
                code: 'NO_TOKEN'
            });
        }

        const token = authHeader.substring(7);
        const tokenResult = verifyToken(token);

        if (!tokenResult.success) {
            return res.status(401).json(tokenResult);
        }

        const provider = [...providers.values()].find(p => p.id === tokenResult.user.userId);
        if (!provider) {
            return res.status(404).json({
                success: false,
                error: 'Provider not found',
                code: 'PROVIDER_NOT_FOUND'
            });
        }

        res.json({
            success: true,
            user: {
                id: provider.id,
                username: provider.username,
                email: provider.email,
                name: provider.name,
                roles: provider.roles,
                specialty: provider.specialty,
                npi: provider.npi,
                licenseNumber: provider.licenseNumber,
                licenseState: provider.licenseState,
                dea: provider.dea,
                lastLogin: provider.lastLogin,
                createdAt: provider.createdAt
            }
        });

    } catch (error) {
        console.error('Provider profile error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Provider forgot password endpoint
router.post('/forgot-password',
    providerAuthLimiter,
    [
        body('email')
            .isEmail()
            .normalizeEmail()
            .withMessage('Valid email is required')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: errors.array(),
                    code: 'VALIDATION_ERROR'
                });
            }

            const { email } = req.body;
            
            // Always return success for security (don't reveal if email exists)
            // In production, send actual email
            console.log(`Password reset requested for provider email: ${email}`);
            
            // Simulate email sending delay
            await new Promise(resolve => setTimeout(resolve, 1000));

            res.json({
                success: true,
                message: 'If an account with that email exists, password reset instructions have been sent.'
            });

        } catch (error) {
            console.error('Provider forgot password error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
);

// Provider logout endpoint
router.post('/logout', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const tokenResult = verifyToken(token);
            
            if (tokenResult.success) {
                // Find and remove session
                for (const [sessionId, session] of sessions.entries()) {
                    if (session.token === token) {
                        sessions.delete(sessionId);
                        break;
                    }
                }
            }
        }

        // Clear server-side auth cookie
        try { res.clearCookie('provider_token', { path: '/' }); } catch {}

        res.json({
            success: true,
            message: 'Logout successful'
        });

    } catch (error) {
        console.error('Provider logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// SSO login endpoint (placeholder for SSO integration)
router.post('/sso-login', async (req, res) => {
    try {
        const { provider, tokenData, userInfo } = req.body;

        if (!provider || !userInfo) {
            return res.status(400).json({ success: false, error: 'Missing provider or user info', code: 'BAD_REQUEST' });
        }

        const email = (userInfo.email || '').toLowerCase();
        const externalId = userInfo.sub || userInfo.id;

        // Try to find an existing provider by email first
        let account = email ? providers.get(email) : null;

        // If not found by email, try by externalId (scan map)
        if (!account && externalId) {
            account = [...providers.values()].find(p => p.externalId === externalId && p.ssoProvider === provider) || null;
        }

        const displayName = userInfo.name || userInfo.display_name || [userInfo.given_name, userInfo.family_name].filter(Boolean).join(' ') || 'Healthcare Professional';

        if (!account) {
            // Create a new provider account (Just-In-Time provisioning)
            const randomPassword = await bcrypt.hash(uuidv4(), 10);
            account = {
                id: uuidv4(),
                username: email || (externalId ? `${provider}:${externalId}` : `sso:${uuidv4()}`),
                email: email || undefined,
                name: displayName,
                password: randomPassword,
                roles: ['physician'], // Default; in production derive from org/policy mapping
                specialty: 'General Practice',
                isActive: true,
                failedAttempts: 0,
                createdAt: new Date(),
                lastLogin: new Date(),
                ssoProvider: provider,
                externalId
            };

            // Store by primary key (email if present, otherwise username)
            providers.set(account.email || account.username, account);
        } else {
            // Update existing account metadata
            account.name = account.name || displayName;
            account.ssoProvider = provider;
            account.externalId = externalId || account.externalId;
            account.isActive = true;
            account.lastLogin = new Date();
        }

        const openemrBridge = await bridgeOpenEMRSession({ account, tokenData });

        // Generate token and set cookie
        const token = generateToken(account);
        const isProd = (process.env.NODE_ENV === 'production');
        try {
            res.cookie('provider_token', token, {
                httpOnly: true,
                secure: isProd,
                sameSite: 'lax',
                maxAge: 8 * 60 * 60 * 1000, // 8 hours
                path: '/'
            });
        } catch {}

        if (openemrBridge.enabled && openemrBridge.tokens?.accessToken) {
            const openemrMaxAge = (openemrBridge.tokens.expiresIn || OPENEMR_TOKEN_TTL_FALLBACK) * 1000;
            try {
                res.cookie('openemr_access_token', openemrBridge.tokens.accessToken, {
                    httpOnly: true,
                    secure: isProd,
                    sameSite: 'lax',
                    maxAge: openemrMaxAge,
                    path: '/'
                });
                if (openemrBridge.tokens.refreshToken) {
                    res.cookie('openemr_refresh_token', openemrBridge.tokens.refreshToken, {
                        httpOnly: true,
                        secure: isProd,
                        sameSite: 'lax',
                        maxAge: 7 * 24 * 60 * 60 * 1000,
                        path: '/'
                    });
                }
            } catch {}

            console.log('[OpenEMR][SSO] Tokens issued for provider', {
                provider: account.email || account.username,
                scope: openemrBridge.tokens.scope,
                expiresAt: openemrBridge.expiresAt,
                maskedAccessToken: maskToken(openemrBridge.tokens.accessToken)
            });
        } else if (!openemrBridge.enabled) {
            console.warn('[OpenEMR][SSO] Bridge unavailable', {
                provider: account.email || account.username,
                reason: openemrBridge.reason,
                details: openemrBridge.details
            });
        }

        const sessionId = uuidv4();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
        const expiresAtIso = expiresAt.toISOString();

        sessions.set(sessionId, {
            providerId: account.id,
            token,
            createdAt: now,
            lastActivity: now,
             expiresAt,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            ssoProvider: provider,
            openemr: openemrBridge.enabled ? {
                baseUrl: openemrBridge.baseUrl,
                tokens: openemrBridge.tokens,
                obtainedAt: openemrBridge.obtainedAt,
                expiresAt: openemrBridge.expiresAt
            } : null
        });

        return res.json({
            success: true,
            message: 'SSO login successful',
            token,
            user: {
                id: account.id,
                username: account.username,
                email: account.email,
                name: account.name,
                roles: account.roles,
                specialty: account.specialty,
                licenseNumber: account.licenseNumber,
                licenseState: account.licenseState,
                ssoProvider: account.ssoProvider
            },
            session: {
                id: sessionId,
                expiresAt: expiresAtIso,
                ssoProvider: provider,
                openemr: openemrBridge.enabled ? {
                    enabled: true,
                    baseUrl: openemrBridge.baseUrl,
                    scope: openemrBridge.tokens?.scope,
                    expiresAt: openemrBridge.expiresAt,
                    obtainedAt: openemrBridge.obtainedAt
                } : {
                    enabled: false,
                    reason: openemrBridge.reason
                }
            },
            openemr: openemrBridge
        });

    } catch (error) {
        console.error('Provider SSO login error:', error);
        res.status(500).json({
            success: false,
            error: 'SSO authentication failed',
            code: 'SSO_ERROR'
        });
    }
});

module.exports = router;