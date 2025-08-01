import { SSOAuditEvent } from '../types/common';

/**
 * Audit logging utilities for SSO events
 * Provides comprehensive logging for compliance and security monitoring
 */
export class AuditLogger {
  private events: SSOAuditEvent[] = [];
  private maxEvents: number;
  private logToConsole: boolean;
  private logToFile: boolean;
  private logFilePath?: string;

  constructor(options: {
    maxEvents?: number;
    logToConsole?: boolean;
    logToFile?: boolean;
    logFilePath?: string;
  } = {}) {
    this.maxEvents = options.maxEvents || 10000;
    this.logToConsole = options.logToConsole || false;
    this.logToFile = options.logToFile || false;
    this.logFilePath = options.logFilePath;
  }

  /**
   * Log an SSO audit event
   */
  logEvent(event: Omit<SSOAuditEvent, 'timestamp'>): void {
    const auditEvent: SSOAuditEvent = {
      ...event,
      timestamp: new Date()
    };

    // Add to in-memory storage
    this.events.push(auditEvent);

    // Maintain max events limit
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Log to console if enabled
    if (this.logToConsole) {
      console.log('[SSO Audit]', JSON.stringify(auditEvent, null, 2));
    }

    // Log to file if enabled
    if (this.logToFile && this.logFilePath) {
      this.writeToFile(auditEvent);
    }
  }

  /**
   * Log successful login
   */
  logLoginSuccess(
    provider: string,
    protocol: 'oauth2' | 'saml',
    userId: string,
    sessionId: string,
    request?: { ip?: string; userAgent?: string }
  ): void {
    this.logEvent({
      event: 'login_success',
      provider,
      protocol,
      userId,
      sessionId,
      ip: request?.ip,
      userAgent: request?.userAgent
    });
  }

  /**
   * Log failed login attempt
   */
  logLoginFailure(
    provider: string,
    protocol: 'oauth2' | 'saml',
    reason: string,
    request?: { ip?: string; userAgent?: string; userId?: string }
  ): void {
    this.logEvent({
      event: 'login_failure',
      provider,
      protocol,
      userId: request?.userId,
      ip: request?.ip,
      userAgent: request?.userAgent,
      metadata: { reason }
    });
  }

  /**
   * Log login attempt
   */
  logLoginAttempt(
    provider: string,
    protocol: 'oauth2' | 'saml',
    request?: { ip?: string; userAgent?: string; userId?: string }
  ): void {
    this.logEvent({
      event: 'login_attempt',
      provider,
      protocol,
      userId: request?.userId,
      ip: request?.ip,
      userAgent: request?.userAgent
    });
  }

  /**
   * Log logout
   */
  logLogout(
    provider: string,
    protocol: 'oauth2' | 'saml',
    userId: string,
    sessionId: string,
    request?: { ip?: string; userAgent?: string }
  ): void {
    this.logEvent({
      event: 'logout',
      provider,
      protocol,
      userId,
      sessionId,
      ip: request?.ip,
      userAgent: request?.userAgent
    });
  }

  /**
   * Log session expiration
   */
  logSessionExpired(
    provider: string,
    protocol: 'oauth2' | 'saml',
    userId: string,
    sessionId: string
  ): void {
    this.logEvent({
      event: 'session_expired',
      provider,
      protocol,
      userId,
      sessionId
    });
  }

  /**
   * Get audit events with optional filtering
   */
  getEvents(filter?: {
    event?: SSOAuditEvent['event'];
    provider?: string;
    protocol?: 'oauth2' | 'saml';
    userId?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
  }): SSOAuditEvent[] {
    let filteredEvents = [...this.events];

    if (filter) {
      if (filter.event) {
        filteredEvents = filteredEvents.filter(e => e.event === filter.event);
      }
      if (filter.provider) {
        filteredEvents = filteredEvents.filter(e => e.provider === filter.provider);
      }
      if (filter.protocol) {
        filteredEvents = filteredEvents.filter(e => e.protocol === filter.protocol);
      }
      if (filter.userId) {
        filteredEvents = filteredEvents.filter(e => e.userId === filter.userId);
      }
      if (filter.fromDate) {
        filteredEvents = filteredEvents.filter(e => e.timestamp >= filter.fromDate!);
      }
      if (filter.toDate) {
        filteredEvents = filteredEvents.filter(e => e.timestamp <= filter.toDate!);
      }
      if (filter.limit) {
        filteredEvents = filteredEvents.slice(-filter.limit);
      }
    }

    return filteredEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get login statistics
   */
  getLoginStatistics(timeframe?: { fromDate?: Date; toDate?: Date }): {
    totalAttempts: number;
    successfulLogins: number;
    failedLogins: number;
    successRate: number;
    providerBreakdown: Record<string, { attempts: number; successes: number; failures: number }>;
  } {
    const events = this.getEvents({
      fromDate: timeframe?.fromDate,
      toDate: timeframe?.toDate
    });

    const loginEvents = events.filter(e => 
      e.event === 'login_attempt' || 
      e.event === 'login_success' || 
      e.event === 'login_failure'
    );

    const totalAttempts = loginEvents.filter(e => e.event === 'login_attempt').length;
    const successfulLogins = loginEvents.filter(e => e.event === 'login_success').length;
    const failedLogins = loginEvents.filter(e => e.event === 'login_failure').length;
    const successRate = totalAttempts > 0 ? (successfulLogins / totalAttempts) * 100 : 0;

    const providerBreakdown: Record<string, { attempts: number; successes: number; failures: number }> = {};

    loginEvents.forEach(event => {
      if (!providerBreakdown[event.provider]) {
        providerBreakdown[event.provider] = { attempts: 0, successes: 0, failures: 0 };
      }

      if (event.event === 'login_attempt') {
        providerBreakdown[event.provider].attempts++;
      } else if (event.event === 'login_success') {
        providerBreakdown[event.provider].successes++;
      } else if (event.event === 'login_failure') {
        providerBreakdown[event.provider].failures++;
      }
    });

    return {
      totalAttempts,
      successfulLogins,
      failedLogins,
      successRate,
      providerBreakdown
    };
  }

  /**
   * Export audit log as JSON
   */
  exportAsJSON(filter?: Parameters<typeof this.getEvents>[0]): string {
    const events = this.getEvents(filter);
    return JSON.stringify(events, null, 2);
  }

  /**
   * Export audit log as CSV
   */
  exportAsCSV(filter?: Parameters<typeof this.getEvents>[0]): string {
    const events = this.getEvents(filter);
    
    if (events.length === 0) {
      return 'timestamp,event,provider,protocol,userId,sessionId,ip,userAgent,metadata\n';
    }

    const header = 'timestamp,event,provider,protocol,userId,sessionId,ip,userAgent,metadata\n';
    const rows = events.map(event => {
      const metadata = event.metadata ? JSON.stringify(event.metadata).replace(/"/g, '""') : '';
      return [
        event.timestamp.toISOString(),
        event.event,
        event.provider,
        event.protocol,
        event.userId || '',
        event.sessionId || '',
        event.ip || '',
        event.userAgent || '',
        `"${metadata}"`
      ].join(',');
    });

    return header + rows.join('\n');
  }

  /**
   * Clear audit log
   */
  clearLog(): void {
    this.events = [];
  }

  /**
   * Write audit event to file
   */
  private async writeToFile(event: SSOAuditEvent): Promise<void> {
    if (!this.logFilePath) return;

    try {
      const fs = await import('fs');
      const logLine = JSON.stringify(event) + '\n';
      fs.appendFileSync(this.logFilePath, logLine, 'utf8');
    } catch (error) {
      console.error('Failed to write audit log to file:', error);
    }
  }
}