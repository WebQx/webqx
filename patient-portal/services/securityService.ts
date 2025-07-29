/**
 * @fileoverview Enhanced Security Service for OHIF Viewer
 * 
 * Advanced security features including encryption, audit logging,
 * and compliance monitoring for healthcare regulations.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import CryptoJS from 'crypto-js';

export interface SecurityConfig {
  encryptionKey: string;
  enableDataEncryption: boolean;
  enableAuditLogging: boolean;
  enableSessionTimeout: boolean;
  sessionTimeoutMinutes: number;
  enableIPWhitelist: boolean;
  allowedIPs: string[];
  enableUserAgentValidation: boolean;
  maxConcurrentSessions: number;
}

export interface AuditEvent {
  id: string;
  timestamp: Date;
  userId: string;
  patientId: string;
  sessionId: string;
  eventType: 'access' | 'view' | 'download' | 'print' | 'share' | 'error' | 'security_violation';
  resource: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  riskScore: number;
}

export interface SecurityAlert {
  id: string;
  type: 'unauthorized_access' | 'data_breach' | 'suspicious_activity' | 'compliance_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  description: string;
  userId?: string;
  patientId?: string;
  sessionId?: string;
  metadata: Record<string, any>;
  resolved: boolean;
}

/**
 * Enhanced Security Service for OHIF Viewer
 */
export class SecurityService {
  private config: SecurityConfig;
  private auditEvents: AuditEvent[] = [];
  private securityAlerts: SecurityAlert[] = [];
  private activeSessions = new Map<string, { userId: string; lastActivity: Date; ipAddress: string }>();

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = {
      encryptionKey: process.env.ENCRYPTION_KEY || 'webqx-default-key-change-in-production',
      enableDataEncryption: true,
      enableAuditLogging: true,
      enableSessionTimeout: true,
      sessionTimeoutMinutes: 30,
      enableIPWhitelist: false,
      allowedIPs: [],
      enableUserAgentValidation: true,
      maxConcurrentSessions: 3,
      ...config,
    };
  }

  /**
   * Encrypt sensitive data before transmission/storage
   */
  encryptData(data: any): string {
    if (!this.config.enableDataEncryption) {
      return JSON.stringify(data);
    }

    try {
      const jsonString = JSON.stringify(data);
      return CryptoJS.AES.encrypt(jsonString, this.config.encryptionKey).toString();
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Data encryption failed');
    }
  }

  /**
   * Decrypt data after transmission/retrieval
   */
  decryptData(encryptedData: string): any {
    if (!this.config.enableDataEncryption) {
      return JSON.parse(encryptedData);
    }

    try {
      const bytes = CryptoJS.AES.decrypt(encryptedData, this.config.encryptionKey);
      const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
      return JSON.parse(decryptedString);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Data decryption failed');
    }
  }

  /**
   * Validate session security
   */
  validateSession(sessionId: string, userId: string, ipAddress: string, userAgent: string): boolean {
    // Check IP whitelist
    if (this.config.enableIPWhitelist && !this.config.allowedIPs.includes(ipAddress)) {
      this.createSecurityAlert({
        type: 'unauthorized_access',
        severity: 'high',
        description: `Access attempt from non-whitelisted IP: ${ipAddress}`,
        userId,
        sessionId,
        metadata: { ipAddress, userAgent },
      });
      return false;
    }

    // Check session timeout
    if (this.config.enableSessionTimeout) {
      const session = this.activeSessions.get(sessionId);
      if (session) {
        const timeSinceLastActivity = Date.now() - session.lastActivity.getTime();
        const timeoutMs = this.config.sessionTimeoutMinutes * 60 * 1000;
        
        if (timeSinceLastActivity > timeoutMs) {
          this.createSecurityAlert({
            type: 'compliance_violation',
            severity: 'medium',
            description: `Session timeout exceeded for user ${userId}`,
            userId,
            sessionId,
            metadata: { timeSinceLastActivity, timeoutMs },
          });
          this.activeSessions.delete(sessionId);
          return false;
        }
      }
    }

    // Check concurrent sessions
    const userSessions = Array.from(this.activeSessions.entries())
      .filter(([_, session]) => session.userId === userId);
    
    if (userSessions.length > this.config.maxConcurrentSessions) {
      this.createSecurityAlert({
        type: 'suspicious_activity',
        severity: 'medium',
        description: `Concurrent session limit exceeded for user ${userId}`,
        userId,
        sessionId,
        metadata: { activeSessionCount: userSessions.length, maxAllowed: this.config.maxConcurrentSessions },
      });
      return false;
    }

    // Update session activity
    this.activeSessions.set(sessionId, {
      userId,
      lastActivity: new Date(),
      ipAddress,
    });

    return true;
  }

  /**
   * Log audit event
   */
  logAuditEvent(event: Omit<AuditEvent, 'id' | 'timestamp' | 'riskScore'>): void {
    if (!this.config.enableAuditLogging) {
      return;
    }

    const auditEvent: AuditEvent = {
      ...event,
      id: this.generateId(),
      timestamp: new Date(),
      riskScore: this.calculateRiskScore(event),
    };

    this.auditEvents.push(auditEvent);

    // Check for suspicious activity
    if (auditEvent.riskScore > 0.7) {
      this.createSecurityAlert({
        type: 'suspicious_activity',
        severity: auditEvent.riskScore > 0.9 ? 'critical' : 'high',
        description: `High-risk activity detected: ${event.eventType} on ${event.resource}`,
        userId: event.userId,
        patientId: event.patientId,
        sessionId: event.sessionId,
        metadata: { riskScore: auditEvent.riskScore, event: auditEvent },
      });
    }

    // Keep only last 10000 audit events
    if (this.auditEvents.length > 10000) {
      this.auditEvents = this.auditEvents.slice(-10000);
    }

    // Send to external audit service
    this.sendToExternalAuditService(auditEvent);
  }

  /**
   * Calculate risk score for audit event
   */
  private calculateRiskScore(event: any): number {
    let riskScore = 0;

    // Base risk by event type
    const eventRisks = {
      'access': 0.1,
      'view': 0.2,
      'download': 0.8,
      'print': 0.6,
      'share': 0.9,
      'error': 0.4,
      'security_violation': 1.0,
    };
    riskScore += eventRisks[event.eventType] || 0.3;

    // Time-based risk (higher during off-hours)
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      riskScore += 0.2;
    }

    // Frequency-based risk
    const recentEvents = this.auditEvents
      .filter(e => e.userId === event.userId && Date.now() - e.timestamp.getTime() < 300000) // 5 minutes
      .length;
    
    if (recentEvents > 10) {
      riskScore += 0.3;
    }

    // IP-based risk (if IP changed recently)
    const userSessions = Array.from(this.activeSessions.entries())
      .filter(([_, session]) => session.userId === event.userId);
    
    const uniqueIPs = new Set(userSessions.map(([_, session]) => session.ipAddress));
    if (uniqueIPs.size > 1) {
      riskScore += 0.4;
    }

    return Math.min(riskScore, 1.0);
  }

  /**
   * Create security alert
   */
  private createSecurityAlert(alertData: Omit<SecurityAlert, 'id' | 'timestamp' | 'resolved'>): void {
    const alert: SecurityAlert = {
      ...alertData,
      id: this.generateId(),
      timestamp: new Date(),
      resolved: false,
    };

    this.securityAlerts.push(alert);

    // Notify security team for critical alerts
    if (alert.severity === 'critical') {
      this.notifySecurityTeam(alert);
    }

    // Keep only last 1000 alerts
    if (this.securityAlerts.length > 1000) {
      this.securityAlerts = this.securityAlerts.slice(-1000);
    }
  }

  /**
   * Get audit events
   */
  getAuditEvents(filters?: { 
    userId?: string; 
    patientId?: string; 
    eventType?: string; 
    startDate?: Date; 
    endDate?: Date; 
    limit?: number;
  }): AuditEvent[] {
    let events = [...this.auditEvents];

    if (filters) {
      if (filters.userId) {
        events = events.filter(e => e.userId === filters.userId);
      }
      if (filters.patientId) {
        events = events.filter(e => e.patientId === filters.patientId);
      }
      if (filters.eventType) {
        events = events.filter(e => e.eventType === filters.eventType);
      }
      if (filters.startDate) {
        events = events.filter(e => e.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        events = events.filter(e => e.timestamp <= filters.endDate!);
      }
    }

    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    if (filters?.limit) {
      events = events.slice(0, filters.limit);
    }

    return events;
  }

  /**
   * Get security alerts
   */
  getSecurityAlerts(unresolved = false): SecurityAlert[] {
    let alerts = [...this.securityAlerts];
    
    if (unresolved) {
      alerts = alerts.filter(alert => !alert.resolved);
    }
    
    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Resolve security alert
   */
  resolveSecurityAlert(alertId: string, resolvedBy: string): boolean {
    const alertIndex = this.securityAlerts.findIndex(alert => alert.id === alertId);
    
    if (alertIndex === -1) {
      return false;
    }

    this.securityAlerts[alertIndex].resolved = true;
    this.securityAlerts[alertIndex].metadata.resolvedBy = resolvedBy;
    this.securityAlerts[alertIndex].metadata.resolvedAt = new Date();

    return true;
  }

  /**
   * Validate HIPAA compliance
   */
  validateHIPAACompliance(sessionData: any): { compliant: boolean; violations: string[] } {
    const violations: string[] = [];

    // Check encryption
    if (!this.config.enableDataEncryption) {
      violations.push('Data encryption is disabled');
    }

    // Check audit logging
    if (!this.config.enableAuditLogging) {
      violations.push('Audit logging is disabled');
    }

    // Check session timeout
    if (!this.config.enableSessionTimeout || this.config.sessionTimeoutMinutes > 60) {
      violations.push('Session timeout exceeds recommended 60 minutes');
    }

    // Check for minimum password requirements (if provided)
    if (sessionData.passwordComplexity && sessionData.passwordComplexity < 0.8) {
      violations.push('Password does not meet complexity requirements');
    }

    // Check access controls
    if (!sessionData.roleBasedAccess) {
      violations.push('Role-based access control not implemented');
    }

    return {
      compliant: violations.length === 0,
      violations,
    };
  }

  /**
   * Generate secure random ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Send audit event to external service
   */
  private async sendToExternalAuditService(event: AuditEvent): Promise<void> {
    try {
      // In production, send to external SIEM or audit service
      await fetch('/api/audit/external', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify(event),
      });
    } catch (error) {
      console.error('Failed to send audit event to external service:', error);
    }
  }

  /**
   * Notify security team of critical alerts
   */
  private async notifySecurityTeam(alert: SecurityAlert): Promise<void> {
    try {
      await fetch('/api/security/alerts/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify(alert),
      });
    } catch (error) {
      console.error('Failed to notify security team:', error);
    }
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): void {
    const now = Date.now();
    const timeoutMs = this.config.sessionTimeoutMinutes * 60 * 1000;

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (now - session.lastActivity.getTime() > timeoutMs) {
        this.activeSessions.delete(sessionId);
      }
    }
  }

  /**
   * Get security configuration
   */
  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  /**
   * Update security configuration
   */
  updateConfig(updates: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

// Create singleton instance
export const securityService = new SecurityService();