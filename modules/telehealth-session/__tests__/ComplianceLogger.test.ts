/**
 * Tests for ComplianceLogger
 */

import { ComplianceLogger } from '../services/ComplianceLogger';
import { ComplianceSettings, TelehealthError } from '../types';

describe('ComplianceLogger', () => {
  let complianceLogger: ComplianceLogger;
  let mockConfig: ComplianceSettings;

  beforeEach(() => {
    mockConfig = {
      enableAuditLogging: true,
      enableConsentTracking: true,
      enableDataRetention: true,
      retentionPeriodDays: 2555,
      enableEncryption: true,
      logLevel: 'standard'
    };

    // Mock console.log to avoid output during tests
    jest.spyOn(console, 'log').mockImplementation();
    
    complianceLogger = new ComplianceLogger('test-session-123', mockConfig);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Event Logging', () => {
    it('should log events when audit logging is enabled', () => {
      complianceLogger.logEvent({
        type: 'participant_joined',
        participantId: 'participant-123',
        complianceLevel: 'high',
        data: { test: 'data' }
      });

      const events = complianceLogger.getSessionEvents();
      expect(events).toHaveLength(2); // Initial session_started + new event
      
      const participantEvent = events.find(e => e.type === 'participant_joined');
      expect(participantEvent).toBeDefined();
      expect(participantEvent?.participantId).toBe('participant-123');
      expect(participantEvent?.complianceLevel).toBe('high');
    });

    it('should not log events when audit logging is disabled', () => {
      const disabledConfig = { ...mockConfig, enableAuditLogging: false };
      const disabledLogger = new ComplianceLogger('test-session', disabledConfig);

      disabledLogger.logEvent({
        type: 'participant_joined',
        participantId: 'participant-123',
        complianceLevel: 'high'
      });

      const events = disabledLogger.getSessionEvents();
      expect(events).toHaveLength(0); // No events should be logged
    });

    it('should log consent events correctly', () => {
      complianceLogger.logConsent('participant-123', 'recording', true);
      complianceLogger.logConsent('participant-456', 'data_sharing', false);

      const events = complianceLogger.getSessionEvents();
      const consentEvents = events.filter(e => e.type === 'consent_given' || e.type === 'consent_revoked');
      
      expect(consentEvents).toHaveLength(2);
      expect(consentEvents[0].type).toBe('consent_given');
      expect(consentEvents[1].type).toBe('consent_revoked');
    });

    it('should log technical issues', () => {
      const mockError: TelehealthError = {
        code: 'CONNECTION_FAILED',
        message: 'Failed to establish connection',
        type: 'technical',
        retryable: true
      };

      complianceLogger.logTechnicalIssue('participant-123', mockError);

      const events = complianceLogger.getSessionEvents();
      const technicalEvent = events.find(e => e.type === 'technical_issue');
      
      expect(technicalEvent).toBeDefined();
      expect(technicalEvent?.data?.error).toEqual(mockError);
    });

    it('should log session end with summary', () => {
      complianceLogger.logSessionEnd(1800, 3, 'normal'); // 30 minutes, 3 participants

      const events = complianceLogger.getSessionEvents();
      const endEvent = events.find(e => e.type === 'session_ended');
      
      expect(endEvent).toBeDefined();
      expect(endEvent?.data?.duration).toBe(1800);
      expect(endEvent?.data?.participantCount).toBe(3);
      expect(endEvent?.data?.reason).toBe('normal');
    });
  });

  describe('Compliance Summary', () => {
    it('should provide accurate compliance summary', () => {
      // Add some test events
      complianceLogger.logConsent('p1', 'recording', true);
      complianceLogger.logEvent({
        type: 'participant_joined',
        participantId: 'p1',
        complianceLevel: 'high'
      });
      complianceLogger.logTechnicalIssue('p1', {
        code: 'TEST_ERROR',
        message: 'Test',
        type: 'technical',
        retryable: true
      });

      const summary = complianceLogger.getComplianceSummary();
      
      expect(summary.totalEvents).toBeGreaterThan(1);
      expect(summary.highComplianceEvents).toBeGreaterThan(0);
      expect(summary.consentEvents).toBe(1);
      expect(summary.technicalIssues).toBe(1);
    });

    it('should calculate session duration when both start and end events exist', () => {
      // Simulate some time passing by manually adding a start event in the past
      const pastTime = new Date(Date.now() - 5000); // 5 seconds ago
      complianceLogger.logEvent({
        type: 'session_started',
        timestamp: pastTime,
        complianceLevel: 'high'
      });
      
      // End the session
      complianceLogger.logSessionEnd(1200, 2, 'normal');

      const summary = complianceLogger.getComplianceSummary();
      expect(summary.sessionDuration).toBeDefined();
      expect(summary.sessionDuration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Data Export', () => {
    it('should export complete compliance data', () => {
      complianceLogger.logConsent('p1', 'recording', true);
      complianceLogger.logSessionEnd(900, 2, 'normal');

      const exportData = complianceLogger.exportComplianceData();
      
      expect(exportData.sessionId).toBe('test-session-123');
      expect(exportData.config).toEqual(mockConfig);
      expect(exportData.events).toHaveLength(3); // start + consent + end
      expect(exportData.summary).toBeDefined();
      expect(exportData.exportedAt).toBeInstanceOf(Date);
    });

    it('should return copy of events to prevent modification', () => {
      const events1 = complianceLogger.getSessionEvents();
      const events2 = complianceLogger.getSessionEvents();
      
      // Modifying one shouldn't affect the other
      events1.push({
        id: 'fake-event',
        sessionId: 'fake',
        timestamp: new Date(),
        type: 'participant_joined',
        complianceLevel: 'low'
      });

      expect(events2).not.toEqual(events1);
    });
  });

  describe('Event ID Generation', () => {
    it('should generate unique event IDs', () => {
      complianceLogger.logEvent({
        type: 'participant_joined',
        complianceLevel: 'medium'
      });
      
      complianceLogger.logEvent({
        type: 'participant_left',
        complianceLevel: 'medium'
      });

      const events = complianceLogger.getSessionEvents();
      const eventIds = events.map(e => e.id);
      const uniqueIds = new Set(eventIds);
      
      expect(uniqueIds.size).toBe(eventIds.length); // All IDs should be unique
    });
  });

  describe('Log Levels', () => {
    it('should respect minimal log level setting', () => {
      const minimalConfig = { ...mockConfig, logLevel: 'minimal' as const };
      
      // Clear previous console.log calls
      (console.log as jest.Mock).mockClear();
      
      const minimalLogger = new ComplianceLogger('test-session', minimalConfig);
      
      // The initial session_started event should still be logged but not to console with minimal level
      minimalLogger.logEvent({
        type: 'participant_joined',
        complianceLevel: 'medium'
      });

      // For minimal logging, should only have the constructor call, not the new event
      const logCalls = (console.log as jest.Mock).mock.calls;
      const eventLogCalls = logCalls.filter(call => 
        call[0] === '[Telehealth Compliance]' && 
        call[1]?.type === 'participant_joined'
      );
      expect(eventLogCalls).toHaveLength(0);
    });

    it('should log to console for standard and detailed levels', () => {
      complianceLogger.logEvent({
        type: 'participant_joined',
        complianceLevel: 'medium'
      });

      expect(console.log).toHaveBeenCalled();
    });
  });
});