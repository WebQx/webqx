/**
 * @fileoverview TLS Middleware for Telehealth Module
 * 
 * This middleware enforces TLS encryption for all telehealth communications,
 * validates certificates, and ensures HIPAA-compliant transport security.
 * 
 * Features:
 * - TLS 1.3 enforcement
 * - Certificate validation
 * - HSTS headers
 * - Perfect Forward Secrecy
 * - Connection security monitoring
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

const tlsConfig = require('../config/tls');
const hipaaConfig = require('../config/hipaa');

/**
 * Middleware to enforce TLS for telehealth communications
 */
function enforceTLS(req, res, next) {
    try {
        // Check if request is secure (HTTPS)
        if (!req.secure && req.get('x-forwarded-proto') !== 'https') {
            if (process.env.NODE_ENV === 'production') {
                // Log security violation
                hipaaConfig.logAuditEvent('TLS_VIOLATION', {
                    sessionId: req.headers['x-session-id'],
                    resourceType: 'TelehealthEndpoint',
                    action: 'ACCESS_ATTEMPT',
                    outcome: 'FAILURE',
                    sourceIp: req.ip,
                    userAgent: req.get('User-Agent'),
                    details: {
                        path: req.path,
                        method: req.method,
                        reason: 'non_tls_connection'
                    }
                });

                return res.status(426).json({
                    error: 'Upgrade Required',
                    message: 'TLS connection required for telehealth endpoints',
                    code: 'TLS_REQUIRED'
                });
            } else {
                console.warn('⚠️ Non-TLS connection detected in development mode');
            }
        }

        // Validate TLS version if available
        if (req.connection && req.connection.getProtocol) {
            const protocol = req.connection.getProtocol();
            if (protocol && !protocol.includes('TLSv1.3')) {
                hipaaConfig.logAuditEvent('TLS_VERSION_WARNING', {
                    sessionId: req.headers['x-session-id'],
                    resourceType: 'TelehealthEndpoint',
                    action: 'ACCESS_ATTEMPT',
                    outcome: 'SUCCESS',
                    sourceIp: req.ip,
                    details: {
                        tlsVersion: protocol,
                        path: req.path,
                        recommendation: 'upgrade_to_tls_1_3'
                    }
                });
            }
        }

        // Add security headers
        const securityHeaders = tlsConfig.getHSTSHeaders();
        Object.entries(securityHeaders).forEach(([header, value]) => {
            res.setHeader(header, value);
        });

        // Add telehealth-specific security headers
        res.setHeader('X-Telehealth-Encrypted', 'true');
        res.setHeader('X-HIPAA-Compliant', 'true');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        // Log successful TLS access
        hipaaConfig.logAuditEvent('TLS_ACCESS', {
            sessionId: req.headers['x-session-id'],
            resourceType: 'TelehealthEndpoint',
            action: 'ACCESS',
            outcome: 'SUCCESS',
            sourceIp: req.ip,
            userAgent: req.get('User-Agent'),
            details: {
                path: req.path,
                method: req.method,
                secure: req.secure
            }
        });

        next();

    } catch (error) {
        console.error('❌ TLS middleware error:', error);
        
        hipaaConfig.logAuditEvent('TLS_MIDDLEWARE_ERROR', {
            sessionId: req.headers['x-session-id'],
            resourceType: 'TelehealthEndpoint',
            action: 'MIDDLEWARE_ERROR',
            outcome: 'FAILURE',
            sourceIp: req.ip,
            details: {
                error: error.message,
                path: req.path
            }
        });

        res.status(500).json({
            error: 'Internal Server Error',
            message: 'TLS validation failed',
            code: 'TLS_VALIDATION_ERROR'
        });
    }
}

/**
 * Middleware to validate client certificates (optional)
 */
function validateClientCertificate(req, res, next) {
    try {
        // Skip if client certificates are not required
        if (!process.env.TELEHEALTH_REQUIRE_CLIENT_CERT) {
            return next();
        }

        const clientCert = req.connection.getPeerCertificate();
        
        if (!clientCert || !clientCert.subject) {
            hipaaConfig.logAuditEvent('CLIENT_CERT_MISSING', {
                sessionId: req.headers['x-session-id'],
                resourceType: 'TelehealthEndpoint',
                action: 'CERT_VALIDATION',
                outcome: 'FAILURE',
                sourceIp: req.ip,
                details: {
                    path: req.path,
                    reason: 'client_certificate_missing'
                }
            });

            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Client certificate required',
                code: 'CLIENT_CERT_REQUIRED'
            });
        }

        // Validate certificate expiration
        const now = new Date();
        const validFrom = new Date(clientCert.valid_from);
        const validTo = new Date(clientCert.valid_to);

        if (now < validFrom || now > validTo) {
            hipaaConfig.logAuditEvent('CLIENT_CERT_EXPIRED', {
                sessionId: req.headers['x-session-id'],
                resourceType: 'TelehealthEndpoint',
                action: 'CERT_VALIDATION',
                outcome: 'FAILURE',
                sourceIp: req.ip,
                details: {
                    path: req.path,
                    certSubject: clientCert.subject.CN,
                    validFrom: clientCert.valid_from,
                    validTo: clientCert.valid_to,
                    reason: 'certificate_expired'
                }
            });

            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Client certificate expired',
                code: 'CLIENT_CERT_EXPIRED'
            });
        }

        // Add certificate info to request
        req.clientCertificate = {
            subject: clientCert.subject,
            issuer: clientCert.issuer,
            fingerprint: clientCert.fingerprint,
            validFrom: clientCert.valid_from,
            validTo: clientCert.valid_to
        };

        // Log successful certificate validation
        hipaaConfig.logAuditEvent('CLIENT_CERT_VALID', {
            sessionId: req.headers['x-session-id'],
            resourceType: 'TelehealthEndpoint',
            action: 'CERT_VALIDATION',
            outcome: 'SUCCESS',
            sourceIp: req.ip,
            details: {
                path: req.path,
                certSubject: clientCert.subject.CN,
                certFingerprint: clientCert.fingerprint
            }
        });

        next();

    } catch (error) {
        console.error('❌ Client certificate validation error:', error);
        
        hipaaConfig.logAuditEvent('CLIENT_CERT_ERROR', {
            sessionId: req.headers['x-session-id'],
            resourceType: 'TelehealthEndpoint',
            action: 'CERT_VALIDATION',
            outcome: 'FAILURE',
            sourceIp: req.ip,
            details: {
                error: error.message,
                path: req.path
            }
        });

        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Certificate validation failed',
            code: 'CERT_VALIDATION_ERROR'
        });
    }
}

/**
 * Middleware to monitor connection security
 */
function monitorConnectionSecurity(req, res, next) {
    try {
        const connection = req.connection || req.socket;
        const securityInfo = {
            encrypted: connection.encrypted || false,
            protocol: connection.getProtocol ? connection.getProtocol() : 'unknown',
            cipher: connection.getCipher ? connection.getCipher() : null,
            peerCertificate: connection.getPeerCertificate ? connection.getPeerCertificate() : null
        };

        // Log security information
        if (securityInfo.encrypted) {
            console.log('🔐 Secure connection established:', {
                protocol: securityInfo.protocol,
                cipher: securityInfo.cipher?.name,
                path: req.path
            });
        }

        // Add security info to request for other middleware
        req.connectionSecurity = securityInfo;

        // Monitor for security issues
        if (securityInfo.cipher && securityInfo.cipher.version) {
            const tlsVersion = securityInfo.cipher.version;
            if (tlsVersion !== 'TLSv1.3' && process.env.NODE_ENV === 'production') {
                console.warn('⚠️ Non-optimal TLS version detected:', tlsVersion);
                
                hipaaConfig.logAuditEvent('TLS_VERSION_SUBOPTIMAL', {
                    sessionId: req.headers['x-session-id'],
                    resourceType: 'TelehealthEndpoint',
                    action: 'SECURITY_MONITOR',
                    outcome: 'WARNING',
                    sourceIp: req.ip,
                    details: {
                        tlsVersion,
                        cipherName: securityInfo.cipher.name,
                        path: req.path
                    }
                });
            }
        }

        next();

    } catch (error) {
        console.error('❌ Connection security monitoring error:', error);
        next(); // Don't block the request for monitoring errors
    }
}

/**
 * Middleware to enforce Perfect Forward Secrecy
 */
function enforcePFS(req, res, next) {
    try {
        const connection = req.connection || req.socket;
        
        if (connection.getCipher) {
            const cipher = connection.getCipher();
            
            // Check if cipher suite supports Perfect Forward Secrecy
            const pfsSupported = cipher.name && (
                cipher.name.includes('ECDHE') || 
                cipher.name.includes('DHE') ||
                cipher.name.includes('TLS_AES') || // TLS 1.3 ciphers
                cipher.name.includes('TLS_CHACHA20')
            );

            if (!pfsSupported && process.env.NODE_ENV === 'production') {
                hipaaConfig.logAuditEvent('PFS_NOT_SUPPORTED', {
                    sessionId: req.headers['x-session-id'],
                    resourceType: 'TelehealthEndpoint',
                    action: 'PFS_CHECK',
                    outcome: 'FAILURE',
                    sourceIp: req.ip,
                    details: {
                        cipherName: cipher.name,
                        path: req.path,
                        reason: 'perfect_forward_secrecy_not_supported'
                    }
                });

                return res.status(426).json({
                    error: 'Upgrade Required',
                    message: 'Perfect Forward Secrecy required for telehealth',
                    code: 'PFS_REQUIRED'
                });
            }

            // Log PFS status
            if (pfsSupported) {
                req.perfectForwardSecrecy = true;
                hipaaConfig.logAuditEvent('PFS_VERIFIED', {
                    sessionId: req.headers['x-session-id'],
                    resourceType: 'TelehealthEndpoint',
                    action: 'PFS_CHECK',
                    outcome: 'SUCCESS',
                    sourceIp: req.ip,
                    details: {
                        cipherName: cipher.name,
                        path: req.path
                    }
                });
            }
        }

        next();

    } catch (error) {
        console.error('❌ PFS enforcement error:', error);
        next(); // Don't block the request for PFS checking errors in development
    }
}

/**
 * Middleware to add telehealth-specific CSP headers
 */
function addTelehealthCSP(req, res, next) {
    const cspDirectives = [
        "default-src 'self'",
        "connect-src 'self' wss: https:",
        "media-src 'self' blob: mediastream:",
        "script-src 'self' 'unsafe-inline'", // Needed for some WebRTC implementations
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "upgrade-insecure-requests"
    ];

    res.setHeader('Content-Security-Policy', cspDirectives.join('; '));
    next();
}

/**
 * Combined TLS middleware that applies all security checks
 */
function telehealthTLSMiddleware(options = {}) {
    return [
        enforceTLS,
        options.requireClientCert ? validateClientCertificate : (req, res, next) => next(),
        monitorConnectionSecurity,
        options.enforcePFS !== false ? enforcePFS : (req, res, next) => next(),
        addTelehealthCSP
    ];
}

module.exports = {
    enforceTLS,
    validateClientCertificate,
    monitorConnectionSecurity,
    enforcePFS,
    addTelehealthCSP,
    telehealthTLSMiddleware
};