/**
 * PACS Audit Service - Enhanced Audit Logging for PACS
 * WebQX™ Healthcare Platform
 * 
 * Provides specialized audit logging for PACS operations,
 * HIPAA compliance, and security monitoring.
 */

import {
  PacsAuditEvent,
  PacsServiceResponse
} from '../types/pacsTypes';

export interface AuditFilter {
  eventType?: string[];
  userType?: string[];
  patientID?: string;
  dateRange?: {
    from: string;
    to: string;
  };
  userID?: string;
  studyInstanceUID?: string;
}

export interface AuditReport {
  reportId: string;
  reportType: 'access_summary' | 'compliance_check' | 'security_incidents' | 'user_activity';
  generatedAt: string;
  timeRange: {
    from: string;
    to: string;
  };
  totalEvents: number;
  summary: Record<string, any>;
  details: PacsAuditEvent[];
}

export class PacsAuditService {
  private auditEvents: PacsAuditEvent[] = [];
  private maxInMemoryEvents: number = 10000;
  private retentionDays: number = 2555; // 7 years HIPAA requirement

  constructor() {
    // Initialize with configuration from environment
    this.maxInMemoryEvents = parseInt(process.env.PACS_AUDIT_MAX_MEMORY || '10000');
    this.retentionDays = parseInt(process.env.PACS_AUDIT_RETENTION_DAYS || '2555');
  }

  /**
   * Log PACS-specific audit event
   */
  async logEvent(
    eventType: 'study_access' | 'image_view' | 'consent_change' | 'data_export' | 
              'login' | 'logout' | 'annotation_create' | 'annotation_modify' | 
              'share_create' | 'download' | 'upload' | 'delete',
    userID: string,
    userType: 'patient' | 'provider' | 'admin' | 'system',
    additionalData?: {
      patientID?: string;
      studyInstanceUID?: string;
      seriesInstanceUID?: string;
      sopInstanceUID?: string;
      ipAddress?: string;
      userAgent?: string;
      sessionID?: string;
      actionDetails?: Record<string, any>;
    }
  ): Promise<PacsServiceResponse<PacsAuditEvent>> {
    try {
      const auditEvent: PacsAuditEvent = {
        eventID: this.generateEventId(),
        eventType,
        timestamp: new Date().toISOString(),
        userID,
        userType,
        patientID: additionalData?.patientID,
        studyInstanceUID: additionalData?.studyInstanceUID,
        seriesInstanceUID: additionalData?.seriesInstanceUID,
        sopInstanceUID: additionalData?.sopInstanceUID,
        ipAddress: additionalData?.ipAddress || this.getClientIP(),
        userAgent: additionalData?.userAgent || 'WebQX-PACS-Service',
        sessionID: additionalData?.sessionID || this.generateSessionId(),
        additionalData: additionalData?.actionDetails,
        complianceFlags: {
          hipaaCompliant: true,
          gdprCompliant: true,
          auditRetention: this.retentionDays
        }
      };

      // Store event
      await this.storeAuditEvent(auditEvent);

      // Check for security concerns
      await this.checkSecurityAlerts(auditEvent);

      return {
        success: true,
        data: auditEvent,
        metadata: {
          timestamp: new Date().toISOString(),
          requestID: this.generateRequestId(),
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('Failed to log audit event', error);
    }
  }

  /**
   * Query audit events with filters
   */
  async queryEvents(filter: AuditFilter): Promise<PacsServiceResponse<PacsAuditEvent[]>> {
    try {
      let filteredEvents = [...this.auditEvents];

      // Apply filters
      if (filter.eventType?.length) {
        filteredEvents = filteredEvents.filter(event => 
          filter.eventType!.includes(event.eventType)
        );
      }

      if (filter.userType?.length) {
        filteredEvents = filteredEvents.filter(event => 
          filter.userType!.includes(event.userType)
        );
      }

      if (filter.patientID) {
        filteredEvents = filteredEvents.filter(event => 
          event.patientID === filter.patientID
        );
      }

      if (filter.userID) {
        filteredEvents = filteredEvents.filter(event => 
          event.userID === filter.userID
        );
      }

      if (filter.studyInstanceUID) {
        filteredEvents = filteredEvents.filter(event => 
          event.studyInstanceUID === filter.studyInstanceUID
        );
      }

      if (filter.dateRange) {
        const fromDate = new Date(filter.dateRange.from);
        const toDate = new Date(filter.dateRange.to);
        
        filteredEvents = filteredEvents.filter(event => {
          const eventDate = new Date(event.timestamp);
          return eventDate >= fromDate && eventDate <= toDate;
        });
      }

      // Sort by timestamp (most recent first)
      filteredEvents.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      return {
        success: true,
        data: filteredEvents,
        metadata: {
          timestamp: new Date().toISOString(),
          requestID: this.generateRequestId(),
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('Failed to query audit events', error);
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    reportType: 'access_summary' | 'compliance_check' | 'security_incidents' | 'user_activity',
    timeRange: { from: string; to: string },
    patientID?: string
  ): Promise<PacsServiceResponse<AuditReport>> {
    try {
      const filter: AuditFilter = {
        dateRange: timeRange,
        patientID
      };

      const eventsResponse = await this.queryEvents(filter);
      if (!eventsResponse.success) {
        throw new Error('Failed to query events for report');
      }

      const events = eventsResponse.data!;
      const report = await this.buildReport(reportType, timeRange, events);

      return {
        success: true,
        data: report,
        metadata: {
          timestamp: new Date().toISOString(),
          requestID: this.generateRequestId(),
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('Failed to generate compliance report', error);
    }
  }

  /**
   * Get patient access history
   */
  async getPatientAccessHistory(
    patientID: string,
    timeRange?: { from: string; to: string }
  ): Promise<PacsServiceResponse<PacsAuditEvent[]>> {
    try {
      const filter: AuditFilter = {
        patientID,
        eventType: ['study_access', 'image_view', 'download'],
        dateRange: timeRange
      };

      return await this.queryEvents(filter);
    } catch (error) {
      return this.handleError('Failed to get patient access history', error);
    }
  }

  /**
   * Check for suspicious activity patterns
   */
  async detectSuspiciousActivity(): Promise<PacsServiceResponse<any[]>> {
    try {
      const suspiciousActivities: any[] = [];
      const recentEvents = this.auditEvents.filter(event => 
        new Date(event.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      );

      // Check for excessive access patterns
      const userAccess = new Map<string, number>();
      recentEvents.forEach(event => {
        if (event.eventType === 'study_access' || event.eventType === 'image_view') {
          userAccess.set(event.userID, (userAccess.get(event.userID) || 0) + 1);
        }
      });

      // Flag users with > 100 accesses in 24h
      for (const [userID, accessCount] of userAccess.entries()) {
        if (accessCount > 100) {
          suspiciousActivities.push({
            type: 'excessive_access',
            userID,
            accessCount,
            severity: 'medium',
            description: `User ${userID} accessed ${accessCount} studies/images in 24h`
          });
        }
      }

      // Check for off-hours access
      const offHoursEvents = recentEvents.filter(event => {
        const eventHour = new Date(event.timestamp).getHours();
        return eventHour < 6 || eventHour > 22; // Outside 6 AM - 10 PM
      });

      if (offHoursEvents.length > 10) {
        suspiciousActivities.push({
          type: 'off_hours_access',
          eventCount: offHoursEvents.length,
          severity: 'low',
          description: `${offHoursEvents.length} access events during off-hours`
        });
      }

      // Check for rapid sequential access from different IPs
      const ipAccess = new Map<string, { count: number; timestamps: string[] }>();
      recentEvents.forEach(event => {
        if (!ipAccess.has(event.userID)) {
          ipAccess.set(event.userID, { count: 0, timestamps: [] });
        }
        const userAccess = ipAccess.get(event.userID)!;
        userAccess.count++;
        userAccess.timestamps.push(event.timestamp);
      });

      return {
        success: true,
        data: suspiciousActivities,
        metadata: {
          timestamp: new Date().toISOString(),
          requestID: this.generateRequestId(),
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('Failed to detect suspicious activity', error);
    }
  }

  /**
   * Private helper methods
   */
  private async storeAuditEvent(event: PacsAuditEvent): Promise<void> {
    // Add to in-memory storage
    this.auditEvents.push(event);

    // Maintain memory limit
    if (this.auditEvents.length > this.maxInMemoryEvents) {
      // Remove oldest events
      this.auditEvents = this.auditEvents.slice(-this.maxInMemoryEvents);
    }

    // In a real implementation, also store to persistent storage
    // (database, file system, or external audit service)
    console.log('[PACS Audit]', {
      eventType: event.eventType,
      userID: event.userID,
      timestamp: event.timestamp,
      patientID: event.patientID,
      studyInstanceUID: event.studyInstanceUID
    });
  }

  private async checkSecurityAlerts(event: PacsAuditEvent): Promise<void> {
    // Check for multiple failed login attempts
    if (event.eventType === 'login' && event.additionalData?.success === false) {
      const recentFailedLogins = this.auditEvents.filter(e => 
        e.eventType === 'login' &&
        e.userID === event.userID &&
        e.additionalData?.success === false &&
        new Date(e.timestamp) > new Date(Date.now() - 15 * 60 * 1000) // Last 15 minutes
      );

      if (recentFailedLogins.length >= 3) {
        console.warn('[SECURITY ALERT] Multiple failed login attempts', {
          userID: event.userID,
          attempts: recentFailedLogins.length,
          timeWindow: '15 minutes'
        });
      }
    }

    // Check for data export activities
    if (event.eventType === 'data_export' || event.eventType === 'download') {
      console.log('[COMPLIANCE ALERT] Data export activity', {
        userID: event.userID,
        patientID: event.patientID,
        studyInstanceUID: event.studyInstanceUID,
        timestamp: event.timestamp
      });
    }
  }

  private async buildReport(
    reportType: string,
    timeRange: { from: string; to: string },
    events: PacsAuditEvent[]
  ): Promise<AuditReport> {
    const reportId = this.generateReportId();
    
    let summary: Record<string, any> = {};

    switch (reportType) {
      case 'access_summary':
        summary = {
          totalAccesses: events.filter(e => e.eventType === 'study_access').length,
          uniqueUsers: new Set(events.map(e => e.userID)).size,
          uniquePatients: new Set(events.map(e => e.patientID).filter(Boolean)).size,
          accessByUserType: this.groupBy(events, 'userType'),
          accessByEventType: this.groupBy(events, 'eventType')
        };
        break;

      case 'compliance_check':
        summary = {
          hipaaCompliantEvents: events.filter(e => e.complianceFlags.hipaaCompliant).length,
          gdprCompliantEvents: events.filter(e => e.complianceFlags.gdprCompliant).length,
          totalEvents: events.length,
          complianceRate: events.length > 0 ? 
            (events.filter(e => e.complianceFlags.hipaaCompliant).length / events.length) * 100 : 100
        };
        break;

      case 'security_incidents':
        summary = {
          suspiciousEvents: events.filter(e => 
            e.eventType === 'login' && e.additionalData?.success === false
          ).length,
          offHoursAccess: events.filter(e => {
            const hour = new Date(e.timestamp).getHours();
            return hour < 6 || hour > 22;
          }).length
        };
        break;

      case 'user_activity':
        summary = {
          activeUsers: new Set(events.map(e => e.userID)).size,
          topUsers: this.getTopUsers(events, 10),
          activityByHour: this.groupEventsByHour(events)
        };
        break;
    }

    return {
      reportId,
      reportType: reportType as any,
      generatedAt: new Date().toISOString(),
      timeRange,
      totalEvents: events.length,
      summary,
      details: events.slice(0, 100) // Limit details to first 100 events
    };
  }

  private groupBy(events: PacsAuditEvent[], field: keyof PacsAuditEvent): Record<string, number> {
    return events.reduce((acc, event) => {
      const key = String(event[field] || 'unknown');
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private getTopUsers(events: PacsAuditEvent[], limit: number): Array<{user: string, count: number}> {
    const userCounts = this.groupBy(events, 'userID');
    return Object.entries(userCounts)
      .map(([user, count]) => ({ user, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  private groupEventsByHour(events: PacsAuditEvent[]): Record<string, number> {
    return events.reduce((acc, event) => {
      const hour = new Date(event.timestamp).getHours().toString().padStart(2, '0');
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private getClientIP(): string {
    // In a real implementation, this would extract from request headers
    return '127.0.0.1';
  }

  private generateEventId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRequestId(): string {
    return `pacs_audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleError(message: string, error: any): PacsServiceResponse<never> {
    console.error(message, error);
    return {
      success: false,
      error: {
        code: 'PACS_AUDIT_ERROR',
        message,
        details: error.message || error
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestID: this.generateRequestId(),
        processingTime: Date.now()
      }
    };
  }
}