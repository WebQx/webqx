/**
 * @fileoverview Telehealth Authentication Middleware
 * 
 * This middleware provides specialized authentication and authorization
 * for telehealth sessions with HIPAA compliance, multi-factor authentication,
 * and role-based access controls.
 * 
 * Features:
 * - Multi-factor authentication
 * - Role-based access control
 * - Session validation
 * - Patient consent verification
 * - Provider license validation
 * - HIPAA audit logging
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const hipaaConfig = require('../config/hipaa');

/**
 * Middleware to authenticate telehealth session participants
 */
function authenticateTelehealthUser(req, res, next) {
    try {
        const token = extractToken(req);
        
        if (!token) {
            return sendAuthError(res, req, 'Authentication token required', 'TOKEN_MISSING');
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Validate token structure for telehealth
        if (!validateTelehealthToken(decoded)) {
            return sendAuthError(res, req, 'Invalid telehealth token structure', 'INVALID_TOKEN_STRUCTURE');
        }

        // Check token expiration with stricter timeouts for telehealth
        if (decoded.exp && Date.now() >= decoded.exp * 1000) {
            return sendAuthError(res, req, 'Token expired', 'TOKEN_EXPIRED');
        }

        // Validate user session
        if (!validateUserSession(decoded)) {
            return sendAuthError(res, req, 'Invalid user session', 'INVALID_SESSION');
        }

        // Add user info to request
        req.telehealthUser = {
            id: decoded.userId,
            role: decoded.role,
            permissions: decoded.permissions || [],
            sessionId: decoded.sessionId,
            mfaVerified: decoded.mfaVerified || false,
            patientConsent: decoded.patientConsent || false,
            licenseVerified: decoded.licenseVerified || false,
            tokenIssuedAt: decoded.iat
        };

        // Log successful authentication
        hipaaConfig.logAuditEvent('TELEHEALTH_AUTH_SUCCESS', {
            sessionId: decoded.sessionId,
            userId: decoded.userId,
            resourceType: 'TelehealthSession',
            action: 'AUTHENTICATE',
            outcome: 'SUCCESS',
            sourceIp: req.ip,
            userAgent: req.get('User-Agent'),
            details: {
                role: decoded.role,
                mfaVerified: decoded.mfaVerified,
                path: req.path
            }
        });

        next();

    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return sendAuthError(res, req, 'Invalid token', 'INVALID_TOKEN');
        } else if (error.name === 'TokenExpiredError') {
            return sendAuthError(res, req, 'Token expired', 'TOKEN_EXPIRED');
        } else {
            console.error('❌ Telehealth authentication error:', error);
            return sendAuthError(res, req, 'Authentication failed', 'AUTH_ERROR');
        }
    }
}

/**
 * Middleware to require multi-factor authentication
 */
function requireMFA(req, res, next) {
    try {
        if (!req.telehealthUser) {
            return sendAuthError(res, req, 'User not authenticated', 'USER_NOT_AUTHENTICATED');
        }

        if (!req.telehealthUser.mfaVerified) {
            hipaaConfig.logAuditEvent('MFA_REQUIRED', {
                sessionId: req.telehealthUser.sessionId,
                userId: req.telehealthUser.id,
                resourceType: 'TelehealthSession',
                action: 'MFA_CHECK',
                outcome: 'FAILURE',
                sourceIp: req.ip,
                details: {
                    path: req.path,
                    reason: 'mfa_not_verified'
                }
            });

            return res.status(403).json({
                error: 'Multi-Factor Authentication Required',
                message: 'MFA verification required for telehealth access',
                code: 'MFA_REQUIRED',
                requiresAction: 'mfa_verification'
            });
        }

        // Log MFA verification
        hipaaConfig.logAuditEvent('MFA_VERIFIED', {
            sessionId: req.telehealthUser.sessionId,
            userId: req.telehealthUser.id,
            resourceType: 'TelehealthSession',
            action: 'MFA_CHECK',
            outcome: 'SUCCESS',
            sourceIp: req.ip,
            details: { path: req.path }
        });

        next();

    } catch (error) {
        console.error('❌ MFA verification error:', error);
        return sendAuthError(res, req, 'MFA verification failed', 'MFA_ERROR');
    }
}

/**
 * Middleware to validate user roles for telehealth access
 */
function requireRole(allowedRoles) {
    return (req, res, next) => {
        try {
            if (!req.telehealthUser) {
                return sendAuthError(res, req, 'User not authenticated', 'USER_NOT_AUTHENTICATED');
            }

            const userRole = req.telehealthUser.role;
            
            if (!allowedRoles.includes(userRole)) {
                hipaaConfig.logAuditEvent('ROLE_ACCESS_DENIED', {
                    sessionId: req.telehealthUser.sessionId,
                    userId: req.telehealthUser.id,
                    resourceType: 'TelehealthSession',
                    action: 'ROLE_CHECK',
                    outcome: 'FAILURE',
                    sourceIp: req.ip,
                    details: {
                        userRole,
                        allowedRoles,
                        path: req.path,
                        reason: 'insufficient_role'
                    }
                });

                return res.status(403).json({
                    error: 'Access Denied',
                    message: `Role '${userRole}' not authorized for this resource`,
                    code: 'INSUFFICIENT_ROLE',
                    allowedRoles
                });
            }

            // Log successful role validation
            hipaaConfig.logAuditEvent('ROLE_ACCESS_GRANTED', {
                sessionId: req.telehealthUser.sessionId,
                userId: req.telehealthUser.id,
                resourceType: 'TelehealthSession',
                action: 'ROLE_CHECK',
                outcome: 'SUCCESS',
                sourceIp: req.ip,
                details: {
                    userRole,
                    path: req.path
                }
            });

            next();

        } catch (error) {
            console.error('❌ Role validation error:', error);
            return sendAuthError(res, req, 'Role validation failed', 'ROLE_ERROR');
        }
    };
}

/**
 * Middleware to validate provider licenses
 */
function validateProviderLicense(req, res, next) {
    try {
        if (!req.telehealthUser) {
            return sendAuthError(res, req, 'User not authenticated', 'USER_NOT_AUTHENTICATED');
        }

        const userRole = req.telehealthUser.role;
        
        // Only check license for providers
        if (!['provider', 'doctor', 'nurse', 'physician_assistant'].includes(userRole)) {
            return next();
        }

        if (!req.telehealthUser.licenseVerified) {
            hipaaConfig.logAuditEvent('LICENSE_NOT_VERIFIED', {
                sessionId: req.telehealthUser.sessionId,
                userId: req.telehealthUser.id,
                resourceType: 'TelehealthSession',
                action: 'LICENSE_CHECK',
                outcome: 'FAILURE',
                sourceIp: req.ip,
                details: {
                    userRole,
                    path: req.path,
                    reason: 'license_not_verified'
                }
            });

            return res.status(403).json({
                error: 'License Verification Required',
                message: 'Valid medical license required for provider access',
                code: 'LICENSE_VERIFICATION_REQUIRED',
                requiresAction: 'license_verification'
            });
        }

        // In a real implementation, we would validate against a license database
        // For now, we trust the token claim but log the access
        hipaaConfig.logAuditEvent('LICENSE_VERIFIED', {
            sessionId: req.telehealthUser.sessionId,
            userId: req.telehealthUser.id,
            resourceType: 'TelehealthSession',
            action: 'LICENSE_CHECK',
            outcome: 'SUCCESS',
            sourceIp: req.ip,
            details: {
                userRole,
                path: req.path
            }
        });

        next();

    } catch (error) {
        console.error('❌ License validation error:', error);
        return sendAuthError(res, req, 'License validation failed', 'LICENSE_ERROR');
    }
}

/**
 * Middleware to validate patient consent
 */
function validatePatientConsent(req, res, next) {
    try {
        if (!req.telehealthUser) {
            return sendAuthError(res, req, 'User not authenticated', 'USER_NOT_AUTHENTICATED');
        }

        const userRole = req.telehealthUser.role;
        
        // Check consent for patients
        if (userRole === 'patient' && !req.telehealthUser.patientConsent) {
            hipaaConfig.logAuditEvent('PATIENT_CONSENT_MISSING', {
                sessionId: req.telehealthUser.sessionId,
                userId: req.telehealthUser.id,
                resourceType: 'TelehealthSession',
                action: 'CONSENT_CHECK',
                outcome: 'FAILURE',
                sourceIp: req.ip,
                details: {
                    path: req.path,
                    reason: 'patient_consent_not_provided'
                }
            });

            return res.status(403).json({
                error: 'Patient Consent Required',
                message: 'Patient consent required for telehealth session',
                code: 'PATIENT_CONSENT_REQUIRED',
                requiresAction: 'consent_agreement'
            });
        }

        // For providers, validate they have consent to access patient data
        if (['provider', 'doctor', 'nurse'].includes(userRole)) {
            const patientId = req.params.patientId || req.query.patientId || req.body.patientId;
            
            if (patientId && !validateProviderPatientConsent(req.telehealthUser.id, patientId)) {
                hipaaConfig.logAuditEvent('PROVIDER_CONSENT_MISSING', {
                    sessionId: req.telehealthUser.sessionId,
                    userId: req.telehealthUser.id,
                    resourceType: 'TelehealthSession',
                    action: 'CONSENT_CHECK',
                    outcome: 'FAILURE',
                    sourceIp: req.ip,
                    details: {
                        patientId,
                        path: req.path,
                        reason: 'provider_patient_consent_not_found'
                    }
                });

                return res.status(403).json({
                    error: 'Patient Access Not Authorized',
                    message: 'Provider not authorized to access this patient',
                    code: 'PROVIDER_ACCESS_DENIED'
                });
            }
        }

        // Log successful consent validation
        hipaaConfig.logAuditEvent('CONSENT_VERIFIED', {
            sessionId: req.telehealthUser.sessionId,
            userId: req.telehealthUser.id,
            resourceType: 'TelehealthSession',
            action: 'CONSENT_CHECK',
            outcome: 'SUCCESS',
            sourceIp: req.ip,
            details: {
                userRole,
                path: req.path
            }
        });

        next();

    } catch (error) {
        console.error('❌ Consent validation error:', error);
        return sendAuthError(res, req, 'Consent validation failed', 'CONSENT_ERROR');
    }
}

/**
 * Middleware to validate telehealth session access
 */
function validateSessionAccess(req, res, next) {
    try {
        if (!req.telehealthUser) {
            return sendAuthError(res, req, 'User not authenticated', 'USER_NOT_AUTHENTICATED');
        }

        const requestedSessionId = req.params.sessionId || req.query.sessionId || req.headers['x-session-id'];
        const userSessionId = req.telehealthUser.sessionId;

        // Check if user is accessing their own session or has permission
        if (requestedSessionId && requestedSessionId !== userSessionId) {
            // Check if user has permission to access other sessions (e.g., admin)
            if (!req.telehealthUser.permissions.includes('access_all_sessions') && 
                !req.telehealthUser.permissions.includes('admin')) {
                
                hipaaConfig.logAuditEvent('SESSION_ACCESS_DENIED', {
                    sessionId: userSessionId,
                    userId: req.telehealthUser.id,
                    resourceType: 'TelehealthSession',
                    action: 'SESSION_ACCESS',
                    outcome: 'FAILURE',
                    sourceIp: req.ip,
                    details: {
                        requestedSessionId,
                        userSessionId,
                        path: req.path,
                        reason: 'unauthorized_session_access'
                    }
                });

                return res.status(403).json({
                    error: 'Session Access Denied',
                    message: 'Not authorized to access this session',
                    code: 'SESSION_ACCESS_DENIED'
                });
            }
        }

        // Validate session is still active
        if (!validateSessionStatus(userSessionId)) {
            hipaaConfig.logAuditEvent('SESSION_EXPIRED', {
                sessionId: userSessionId,
                userId: req.telehealthUser.id,
                resourceType: 'TelehealthSession',
                action: 'SESSION_ACCESS',
                outcome: 'FAILURE',
                sourceIp: req.ip,
                details: {
                    path: req.path,
                    reason: 'session_expired_or_invalid'
                }
            });

            return res.status(401).json({
                error: 'Session Expired',
                message: 'Telehealth session has expired or is invalid',
                code: 'SESSION_EXPIRED'
            });
        }

        // Log successful session access
        hipaaConfig.logAuditEvent('SESSION_ACCESS_GRANTED', {
            sessionId: userSessionId,
            userId: req.telehealthUser.id,
            resourceType: 'TelehealthSession',
            action: 'SESSION_ACCESS',
            outcome: 'SUCCESS',
            sourceIp: req.ip,
            details: {
                requestedSessionId: requestedSessionId || userSessionId,
                path: req.path
            }
        });

        next();

    } catch (error) {
        console.error('❌ Session validation error:', error);
        return sendAuthError(res, req, 'Session validation failed', 'SESSION_ERROR');
    }
}

/**
 * Utility function to extract token from request
 */
function extractToken(req) {
    // Try Authorization header first
    let token = req.headers.authorization;
    if (token && token.startsWith('Bearer ')) {
        return token.slice(7);
    }

    // Try query parameter
    token = req.query.token;
    if (token) {
        return token;
    }

    // Try cookie
    token = req.cookies?.auth_token;
    if (token) {
        return token;
    }

    return null;
}

/**
 * Validate telehealth token structure
 */
function validateTelehealthToken(decoded) {
    const requiredFields = ['userId', 'role', 'sessionId', 'iat'];
    
    for (const field of requiredFields) {
        if (!decoded[field]) {
            return false;
        }
    }

    // Validate role
    const validRoles = ['patient', 'provider', 'doctor', 'nurse', 'physician_assistant', 'admin'];
    if (!validRoles.includes(decoded.role)) {
        return false;
    }

    // Validate session ID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decoded.sessionId)) {
        return false;
    }

    return true;
}

/**
 * Validate user session (placeholder)
 */
function validateUserSession(decoded) {
    // In a real implementation, this would check against a session store
    // For now, we'll do basic validation
    
    const tokenAge = Date.now() - (decoded.iat * 1000);
    const maxAge = parseInt(process.env.SESSION_TIMEOUT_MINUTES || '60') * 60 * 1000;
    
    return tokenAge < maxAge;
}

/**
 * Validate provider-patient consent (placeholder)
 */
function validateProviderPatientConsent(providerId, patientId) {
    // In a real implementation, this would check a consent database
    // For now, we'll return true to allow development
    return true;
}

/**
 * Validate session status (placeholder)
 */
function validateSessionStatus(sessionId) {
    // In a real implementation, this would check session store
    // For now, we'll return true to allow development
    return true;
}

/**
 * Send authentication error response
 */
function sendAuthError(res, req, message, code) {
    // Log authentication failure
    hipaaConfig.logAuditEvent('TELEHEALTH_AUTH_FAILURE', {
        sessionId: req.headers['x-session-id'],
        resourceType: 'TelehealthSession',
        action: 'AUTHENTICATE',
        outcome: 'FAILURE',
        sourceIp: req.ip,
        userAgent: req.get('User-Agent'),
        details: {
            path: req.path,
            method: req.method,
            reason: code,
            message
        }
    });

    return res.status(401).json({
        error: 'Authentication Failed',
        message,
        code
    });
}

/**
 * Combined telehealth authentication middleware
 */
function telehealthAuth(options = {}) {
    const middleware = [authenticateTelehealthUser];
    
    if (options.requireMFA !== false) {
        middleware.push(requireMFA);
    }
    
    if (options.requireLicense) {
        middleware.push(validateProviderLicense);
    }
    
    if (options.requireConsent !== false) {
        middleware.push(validatePatientConsent);
    }
    
    if (options.validateSession !== false) {
        middleware.push(validateSessionAccess);
    }
    
    if (options.roles) {
        middleware.push(requireRole(options.roles));
    }

    return middleware;
}

module.exports = {
    authenticateTelehealthUser,
    requireMFA,
    requireRole,
    validateProviderLicense,
    validatePatientConsent,
    validateSessionAccess,
    telehealthAuth
};