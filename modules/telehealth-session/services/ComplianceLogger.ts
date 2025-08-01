/**
 * ComplianceLogger - Handles audit logging and compliance tracking for telehealth sessions
 * Ensures HIPAA compliance and provides detailed session tracking
 */

import { SessionEvent, TelehealthError, ComplianceSettings } from '../types';

export class ComplianceLogger {
  private events: SessionEvent[] = [];
  private config: ComplianceSettings;
  private sessionId: string;

  constructor(sessionId: string, config: ComplianceSettings) {
    this.sessionId = sessionId;
    this.config = config;
    this.logEvent({
      id: this.generateEventId(),
      sessionId,
      timestamp: new Date(),
      type: 'session_started',
      complianceLevel: 'high',
      data: { config }
    });
  }

  /**
   * Log a session event for compliance tracking
   */
  logEvent(event: Omit<SessionEvent, 'id'> & { id?: string }): void {
    if (!this.config.enableAuditLogging) {
      return;
    }

    const fullEvent: SessionEvent = {
      id: event.id || this.generateEventId(),
      sessionId: this.sessionId,
      timestamp: new Date(),
      ...event
    };

    this.events.push(fullEvent);

    // Log to console for immediate visibility (in production, this would go to a secure logging service)
    if (this.config.logLevel !== 'minimal') {
      console.log('[Telehealth Compliance]', fullEvent);
    }

    // In a real implementation, this would also:
    // - Send to external audit logging service
    // - Store in encrypted database
    // - Trigger compliance monitoring alerts if needed
  }

  /**
   * Log participant consent events
   */
  logConsent(participantId: string, consentType: 'recording' | 'data_sharing' | 'session_participation', granted: boolean): void {
    this.logEvent({
      type: granted ? 'consent_given' : 'consent_revoked',
      participantId,
      complianceLevel: 'high',
      data: { consentType, granted }
    });
  }

  /**
   * Log technical issues for compliance and troubleshooting
   */
  logTechnicalIssue(participantId: string, error: TelehealthError): void {
    this.logEvent({
      type: 'technical_issue',
      participantId,
      complianceLevel: 'medium',
      data: { error }
    });
  }

  /**
   * Log session ending with summary data
   */
  logSessionEnd(duration: number, participantCount: number, reason: 'normal' | 'timeout' | 'error' | 'provider_ended'): void {
    this.logEvent({
      type: 'session_ended',
      complianceLevel: 'high',
      data: { 
        duration, 
        participantCount, 
        reason,
        totalEvents: this.events.length 
      }
    });
  }

  /**
   * Get session events for audit purposes
   */
  getSessionEvents(): SessionEvent[] {
    return [...this.events]; // Return copy to prevent modification
  }

  /**
   * Get compliance summary for the session
   */
  getComplianceSummary(): {
    totalEvents: number;
    highComplianceEvents: number;
    consentEvents: number;
    technicalIssues: number;
    sessionDuration?: number;
  } {
    const highComplianceEvents = this.events.filter(e => e.complianceLevel === 'high').length;
    const consentEvents = this.events.filter(e => e.type === 'consent_given' || e.type === 'consent_revoked').length;
    const technicalIssues = this.events.filter(e => e.type === 'technical_issue').length;

    const sessionStart = this.events.find(e => e.type === 'session_started')?.timestamp;
    const sessionEnd = this.events.find(e => e.type === 'session_ended')?.timestamp;
    const sessionDuration = sessionStart && sessionEnd ? 
      Math.floor((sessionEnd.getTime() - sessionStart.getTime()) / 1000) : undefined;

    return {
      totalEvents: this.events.length,
      highComplianceEvents,
      consentEvents,
      technicalIssues,
      sessionDuration
    };
  }

  /**
   * Export session data for compliance reporting
   */
  exportComplianceData(): {
    sessionId: string;
    config: ComplianceSettings;
    events: SessionEvent[];
    summary: ReturnType<ComplianceLogger['getComplianceSummary']>;
    exportedAt: Date;
  } {
    return {
      sessionId: this.sessionId,
      config: this.config,
      events: this.getSessionEvents(),
      summary: this.getComplianceSummary(),
      exportedAt: new Date()
    };
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}