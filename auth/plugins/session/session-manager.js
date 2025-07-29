/**
 * Enhanced Session Management
 * Handles session timeout, re-authentication, and secure logout
 */

const crypto = require('crypto');
const { getSessionConfig } = require('../sso-config');
const auditLogger = require('../audit/audit-logger');

/**
 * Session Manager Class
 */
class SessionManager {
    constructor() {
        this.config = getSessionConfig();
        this.sessions = new Map(); // In production, use Redis or database
        this.userSessions = new Map(); // Track sessions per user
        
        // Start cleanup interval
        this.startCleanupInterval();
    }

    /**
     * Create a new session
     * @param {Object} user - User information
     * @param {Object} authData - Authentication data
     * @returns {Object} Session information
     */
    createSession(user, authData) {
        const sessionId = this.generateSessionId();
        const now = Date.now();
        
        const session = {
            id: sessionId,
            userId: user.id,
            email: user.email,
            role: user.role,
            roles: user.roles || [user.role],
            provider: authData.provider,
            providerUserId: authData.providerUserId,
            sessionIndex: authData.sessionIndex, // For SAML
            createdAt: now,
            lastActivity: now,
            expiresAt: now + (this.config.timeoutMinutes * 60 * 1000),
            ip: authData.ip,
            userAgent: authData.userAgent,
            isActive: true,
            renewalCount: 0,
            metadata: {
                loginMethod: authData.loginMethod || 'sso',
                deviceFingerprint: this.generateDeviceFingerprint(authData),
                location: authData.location
            }
        };

        // Check concurrent session limit
        this.enforceConcurrentSessionLimit(user.id, sessionId);
        
        // Store session
        this.sessions.set(sessionId, session);
        
        // Track user sessions
        if (!this.userSessions.has(user.id)) {
            this.userSessions.set(user.id, new Set());
        }
        this.userSessions.get(user.id).add(sessionId);

        auditLogger.logSuccess('session_created', {
            sessionId: sessionId,
            userId: user.id,
            email: user.email,
            provider: authData.provider,
            ip: authData.ip,
            userAgent: authData.userAgent,
            timestamp: new Date().toISOString()
        });

        return {
            sessionId,
            expiresAt: session.expiresAt,
            renewalThreshold: session.expiresAt - (this.config.renewalThresholdMinutes * 60 * 1000)
        };
    }

    /**
     * Validate and refresh session
     * @param {string} sessionId - Session ID
     * @param {Object} requestData - Request data for validation
     * @returns {Object} Session validation result
     */
    validateSession(sessionId, requestData = {}) {
        const session = this.sessions.get(sessionId);
        
        if (!session) {
            auditLogger.logFailure('session_validation_failed', {
                sessionId: sessionId,
                reason: 'Session not found',
                ip: requestData.ip,
                timestamp: new Date().toISOString()
            });
            return { valid: false, reason: 'Session not found' };
        }

        const now = Date.now();

        // Check if session is expired
        if (now > session.expiresAt) {
            this.invalidateSession(sessionId, 'expired');
            auditLogger.logFailure('session_validation_failed', {
                sessionId: sessionId,
                userId: session.userId,
                reason: 'Session expired',
                ip: requestData.ip,
                timestamp: new Date().toISOString()
            });
            return { valid: false, reason: 'Session expired' };
        }

        // Check if session is active
        if (!session.isActive) {
            auditLogger.logFailure('session_validation_failed', {
                sessionId: sessionId,
                userId: session.userId,
                reason: 'Session inactive',
                ip: requestData.ip,
                timestamp: new Date().toISOString()
            });
            return { valid: false, reason: 'Session inactive' };
        }

        // Validate IP and device fingerprint (optional security check)
        if (this.config.strictValidation) {
            if (requestData.ip && session.ip !== requestData.ip) {
                auditLogger.logSecurity('session_ip_mismatch', {
                    sessionId: sessionId,
                    userId: session.userId,
                    originalIp: session.ip,
                    currentIp: requestData.ip,
                    timestamp: new Date().toISOString()
                });
                // Don't fail validation for IP changes in demo mode
                // In production, you might want to invalidate or require re-auth
            }
        }

        // Update last activity
        session.lastActivity = now;

        // Check if renewal is needed
        const renewalThreshold = session.expiresAt - (this.config.renewalThresholdMinutes * 60 * 1000);
        const needsRenewal = now > renewalThreshold;

        auditLogger.logInfo('session_validated', {
            sessionId: sessionId,
            userId: session.userId,
            needsRenewal: needsRenewal,
            ip: requestData.ip,
            timestamp: new Date().toISOString()
        });

        return {
            valid: true,
            session: this.sanitizeSession(session),
            needsRenewal: needsRenewal,
            timeUntilExpiry: session.expiresAt - now
        };
    }

    /**
     * Renew session
     * @param {string} sessionId - Session ID
     * @param {Object} requestData - Request data
     * @returns {Object} Renewal result
     */
    renewSession(sessionId, requestData = {}) {
        const session = this.sessions.get(sessionId);
        
        if (!session || !session.isActive) {
            auditLogger.logFailure('session_renewal_failed', {
                sessionId: sessionId,
                reason: 'Session not found or inactive',
                ip: requestData.ip,
                timestamp: new Date().toISOString()
            });
            return { success: false, reason: 'Session not found or inactive' };
        }

        const now = Date.now();
        
        // Check if session is still within renewal window
        const renewalThreshold = session.expiresAt - (this.config.renewalThresholdMinutes * 60 * 1000);
        if (now < renewalThreshold) {
            return { 
                success: false, 
                reason: 'Session does not need renewal yet',
                timeUntilRenewal: renewalThreshold - now
            };
        }

        // Extend session
        session.expiresAt = now + (this.config.timeoutMinutes * 60 * 1000);
        session.lastActivity = now;
        session.renewalCount++;

        auditLogger.logSuccess('session_renewed', {
            sessionId: sessionId,
            userId: session.userId,
            renewalCount: session.renewalCount,
            newExpiresAt: new Date(session.expiresAt).toISOString(),
            ip: requestData.ip,
            timestamp: new Date().toISOString()
        });

        return {
            success: true,
            expiresAt: session.expiresAt,
            renewalThreshold: session.expiresAt - (this.config.renewalThresholdMinutes * 60 * 1000)
        };
    }

    /**
     * Invalidate session
     * @param {string} sessionId - Session ID
     * @param {string} reason - Reason for invalidation
     * @param {Object} requestData - Request data
     */
    invalidateSession(sessionId, reason = 'manual', requestData = {}) {
        const session = this.sessions.get(sessionId);
        
        if (session) {
            // Mark as inactive
            session.isActive = false;
            session.invalidatedAt = Date.now();
            session.invalidationReason = reason;

            // Remove from user sessions
            if (this.userSessions.has(session.userId)) {
                this.userSessions.get(session.userId).delete(sessionId);
                
                // Clean up empty user session sets
                if (this.userSessions.get(session.userId).size === 0) {
                    this.userSessions.delete(session.userId);
                }
            }

            auditLogger.logSuccess('session_invalidated', {
                sessionId: sessionId,
                userId: session.userId,
                reason: reason,
                ip: requestData.ip,
                timestamp: new Date().toISOString()
            });
        }

        // Remove from sessions map
        this.sessions.delete(sessionId);
    }

    /**
     * Invalidate all sessions for a user
     * @param {string} userId - User ID
     * @param {string} reason - Reason for invalidation
     * @param {string} exceptSessionId - Session ID to exclude from invalidation
     */
    invalidateUserSessions(userId, reason = 'logout_all', exceptSessionId = null) {
        const userSessionIds = this.userSessions.get(userId);
        
        if (userSessionIds) {
            for (const sessionId of userSessionIds) {
                if (sessionId !== exceptSessionId) {
                    this.invalidateSession(sessionId, reason);
                }
            }
        }

        auditLogger.logSuccess('user_sessions_invalidated', {
            userId: userId,
            reason: reason,
            exceptSessionId: exceptSessionId,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Handle secure logout
     * @param {string} sessionId - Session ID
     * @param {Object} options - Logout options
     * @returns {Promise<Object>} Logout result
     */
    async handleSecureLogout(sessionId, options = {}) {
        const session = this.sessions.get(sessionId);
        
        if (!session) {
            return { success: false, reason: 'Session not found' };
        }

        const logoutData = {
            sessionId: sessionId,
            userId: session.userId,
            provider: session.provider,
            providerUserId: session.providerUserId,
            sessionIndex: session.sessionIndex
        };

        // Invalidate local session
        this.invalidateSession(sessionId, 'logout', options.requestData);

        // If configured to clear external sessions, prepare external logout
        if (this.config.clearExternalSessions) {
            // For SAML providers, we need to initiate SLO (Single Logout)
            if (session.provider && session.sessionIndex) {
                logoutData.requiresExternalLogout = true;
                logoutData.externalLogoutUrl = await this.getExternalLogoutUrl(session);
            }
        }

        // Optionally invalidate all user sessions
        if (options.logoutAllDevices) {
            this.invalidateUserSessions(session.userId, 'logout_all_devices', sessionId);
        }

        auditLogger.logSuccess('secure_logout_completed', {
            sessionId: sessionId,
            userId: session.userId,
            provider: session.provider,
            logoutAllDevices: options.logoutAllDevices || false,
            clearExternalSessions: this.config.clearExternalSessions,
            timestamp: new Date().toISOString()
        });

        return {
            success: true,
            ...logoutData
        };
    }

    /**
     * Get external logout URL for SSO providers
     * @param {Object} session - Session data
     * @returns {Promise<string>} External logout URL
     */
    async getExternalLogoutUrl(session) {
        // This would integrate with the SAML or OAuth2 logout endpoints
        // For demo purposes, we'll simulate this
        if (session.provider === 'saml') {
            return `https://sso.example.com/logout?session=${session.sessionIndex}`;
        } else if (session.provider === 'oauth2') {
            return `https://oauth.example.com/logout?client_id=${session.providerUserId}`;
        }
        
        return null;
    }

    /**
     * Enforce concurrent session limit
     * @param {string} userId - User ID
     * @param {string} newSessionId - New session ID
     */
    enforceConcurrentSessionLimit(userId, newSessionId) {
        const userSessionIds = this.userSessions.get(userId);
        
        if (userSessionIds && userSessionIds.size >= this.config.maxConcurrentSessions) {
            // Find oldest session to invalidate
            let oldestSession = null;
            let oldestTime = Date.now();
            
            for (const sessionId of userSessionIds) {
                const session = this.sessions.get(sessionId);
                if (session && session.createdAt < oldestTime) {
                    oldestTime = session.createdAt;
                    oldestSession = sessionId;
                }
            }
            
            if (oldestSession) {
                this.invalidateSession(oldestSession, 'concurrent_limit_exceeded');
                
                auditLogger.logInfo('concurrent_session_limit_enforced', {
                    userId: userId,
                    invalidatedSession: oldestSession,
                    newSession: newSessionId,
                    maxSessions: this.config.maxConcurrentSessions,
                    timestamp: new Date().toISOString()
                });
            }
        }
    }

    /**
     * Generate session ID
     * @returns {string} Session ID
     */
    generateSessionId() {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Generate device fingerprint
     * @param {Object} authData - Authentication data
     * @returns {string} Device fingerprint
     */
    generateDeviceFingerprint(authData) {
        const data = [
            authData.userAgent || '',
            authData.acceptLanguage || '',
            authData.timezone || '',
            authData.screenResolution || ''
        ].join('|');
        
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    /**
     * Sanitize session data for client response
     * @param {Object} session - Session data
     * @returns {Object} Sanitized session data
     */
    sanitizeSession(session) {
        return {
            id: session.id,
            userId: session.userId,
            email: session.email,
            role: session.role,
            roles: session.roles,
            provider: session.provider,
            createdAt: session.createdAt,
            lastActivity: session.lastActivity,
            expiresAt: session.expiresAt,
            renewalCount: session.renewalCount
        };
    }

    /**
     * Get session statistics
     * @returns {Object} Session statistics
     */
    getSessionStats() {
        const now = Date.now();
        const activeSessions = [];
        
        for (const session of this.sessions.values()) {
            if (session.isActive && session.expiresAt > now) {
                activeSessions.push(session);
            }
        }

        return {
            totalActiveSessions: activeSessions.length,
            totalUsers: this.userSessions.size,
            sessionsByProvider: this.groupBy(activeSessions, 'provider'),
            sessionsByRole: this.groupBy(activeSessions, 'role'),
            averageSessionAge: this.calculateAverageAge(activeSessions),
            upcomingExpirations: this.getUpcomingExpirations(activeSessions)
        };
    }

    /**
     * Group sessions by field
     * @param {Array} sessions - Sessions array
     * @param {string} field - Field to group by
     * @returns {Object} Grouped sessions
     */
    groupBy(sessions, field) {
        return sessions.reduce((groups, session) => {
            const key = session[field] || 'unknown';
            groups[key] = (groups[key] || 0) + 1;
            return groups;
        }, {});
    }

    /**
     * Calculate average session age
     * @param {Array} sessions - Sessions array
     * @returns {number} Average age in minutes
     */
    calculateAverageAge(sessions) {
        if (sessions.length === 0) return 0;
        
        const now = Date.now();
        const totalAge = sessions.reduce((sum, session) => {
            return sum + (now - session.createdAt);
        }, 0);
        
        return Math.round(totalAge / sessions.length / 60000); // Convert to minutes
    }

    /**
     * Get sessions expiring soon
     * @param {Array} sessions - Sessions array
     * @returns {Array} Sessions expiring in next 30 minutes
     */
    getUpcomingExpirations(sessions) {
        const now = Date.now();
        const thirtyMinutes = 30 * 60 * 1000;
        
        return sessions.filter(session => 
            session.expiresAt - now <= thirtyMinutes
        ).length;
    }

    /**
     * Start cleanup interval for expired sessions
     */
    startCleanupInterval() {
        // Clean up every 5 minutes
        setInterval(() => {
            this.cleanupExpiredSessions();
        }, 5 * 60 * 1000);
    }

    /**
     * Clean up expired and invalid sessions
     */
    cleanupExpiredSessions() {
        const now = Date.now();
        let cleanedCount = 0;

        for (const [sessionId, session] of this.sessions.entries()) {
            if (!session.isActive || session.expiresAt <= now) {
                this.invalidateSession(sessionId, 'cleanup');
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            auditLogger.logInfo('session_cleanup_completed', {
                cleanedSessions: cleanedCount,
                timestamp: new Date().toISOString()
            });
        }
    }
}

// Create singleton instance
const sessionManager = new SessionManager();

module.exports = sessionManager;