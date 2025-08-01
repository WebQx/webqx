/**
 * Session Utilities Tests
 * 
 * Test suite for telehealth session utility functions
 * including token validation, session timing, and formatting.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import {
  generateSessionToken,
  validateSessionToken,
  canJoinSession,
  getSessionStatusText,
  getSessionStatusClass,
  formatSessionDuration,
  formatSessionDateTime,
  getTimeUntilSession,
  isSessionStartingSoon,
  canCancelSession,
  validateSessionConfig,
  extractSessionIdFromUrl,
  sanitizeSessionText
} from '../utils/sessionUtils';

import { TelehealthSession } from '../types';

describe('Session Utilities', () => {
  describe('Token Management', () => {
    it('should generate valid session token', () => {
      const token = generateSessionToken('session-123', 'user-456', 'patient', 60);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should validate correct session token', () => {
      const token = generateSessionToken('session-123', 'user-456', 'patient', 60);
      const validation = validateSessionToken(token);
      
      expect(validation.isValid).toBe(true);
      expect(validation.payload).toBeDefined();
      expect(validation.payload.sessionId).toBe('session-123');
      expect(validation.payload.userId).toBe('user-456');
      expect(validation.payload.userRole).toBe('patient');
    });

    it('should reject invalid token format', () => {
      const validation = validateSessionToken('invalid-token');
      
      expect(validation.isValid).toBe(false);
      expect(validation.error).toBeDefined();
    });

    it('should reject expired token', () => {
      // Generate token with negative expiration (already expired)
      const token = generateSessionToken('session-123', 'user-456', 'patient', -1);
      const validation = validateSessionToken(token);
      
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('expired');
    });
  });

  describe('Session Join Validation', () => {
    const createMockSession = (overrides: Partial<TelehealthSession> = {}): TelehealthSession => ({
      id: 'session-123',
      appointmentId: 'apt-123',
      status: 'scheduled',
      patient: { id: 'patient-1', name: 'John Doe', email: 'john@example.com' },
      provider: { id: 'provider-1', name: 'Dr. Smith', email: 'dr@example.com' },
      scheduledDateTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      durationMinutes: 30,
      platform: {
        type: 'webrtc_native',
        joinUrl: '/session/123',
        meetingId: 'meeting-123'
      },
      accessUrls: {
        patient: '/session/123?role=patient',
        provider: '/session/123?role=provider'
      },
      settings: {
        recordingEnabled: false,
        chatEnabled: true,
        screenShareEnabled: true,
        waitingRoomEnabled: true,
        requiresPassword: false
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    });

    it('should allow joining when session is in early join window', () => {
      const session = createMockSession({
        scheduledDateTime: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
      });
      
      const validation = canJoinSession(session);
      
      expect(validation.canJoin).toBe(true);
    });

    it('should prevent joining when too early', () => {
      const session = createMockSession({
        scheduledDateTime: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes from now
      });
      
      const validation = canJoinSession(session);
      
      expect(validation.canJoin).toBe(false);
      expect(validation.reason).toContain('not yet available');
      expect(validation.availableAt).toBeDefined();
    });

    it('should prevent joining cancelled session', () => {
      const session = createMockSession({
        status: 'cancelled'
      });
      
      const validation = canJoinSession(session);
      
      expect(validation.canJoin).toBe(false);
      expect(validation.reason).toContain('cancelled');
    });

    it('should prevent joining completed session', () => {
      const session = createMockSession({
        status: 'completed'
      });
      
      const validation = canJoinSession(session);
      
      expect(validation.canJoin).toBe(false);
      expect(validation.reason).toContain('completed');
    });

    it('should prevent joining when session window has passed', () => {
      const session = createMockSession({
        scheduledDateTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        durationMinutes: 30 // session ended 1.5 hours ago, well past 30-min grace period
      });
      
      const validation = canJoinSession(session);
      
      expect(validation.canJoin).toBe(false);
      expect(validation.reason).toContain('window has passed');
    });
  });

  describe('Status and Display Functions', () => {
    it('should return correct status text', () => {
      expect(getSessionStatusText('scheduled')).toBe('Scheduled');
      expect(getSessionStatusText('in_progress')).toBe('In Progress');
      expect(getSessionStatusText('completed')).toBe('Completed');
      expect(getSessionStatusText('cancelled')).toBe('Cancelled');
    });

    it('should return correct status CSS classes', () => {
      expect(getSessionStatusClass('scheduled')).toBe('status-scheduled');
      expect(getSessionStatusClass('ready_to_start')).toBe('status-ready');
      expect(getSessionStatusClass('in_progress')).toBe('status-active');
      expect(getSessionStatusClass('completed')).toBe('status-completed');
    });

    it('should format session duration correctly', () => {
      expect(formatSessionDuration(15)).toBe('15 minutes');
      expect(formatSessionDuration(30)).toBe('30 minutes');
      expect(formatSessionDuration(60)).toBe('1 hour');
      expect(formatSessionDuration(90)).toBe('1 hour 30 minutes');
      expect(formatSessionDuration(120)).toBe('2 hours');
    });

    it('should format session date and time', () => {
      const date = new Date('2024-03-15T14:30:00.000Z');
      const formatted = formatSessionDateTime(date);
      
      expect(formatted).toContain('Friday');
      expect(formatted).toContain('March');
      expect(formatted).toContain('15');
      expect(formatted).toContain('2024');
    });
  });

  describe('Time Calculations', () => {
    it('should calculate time until future session', () => {
      const futureDate = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
      const timeUntil = getTimeUntilSession(futureDate);
      
      expect(timeUntil.isPast).toBe(false);
      expect(timeUntil.timeText).toContain('in 30 minute');
      expect(timeUntil.minutes).toBe(30);
    });

    it('should calculate time for past session', () => {
      const pastDate = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
      const timeUntil = getTimeUntilSession(pastDate);
      
      expect(timeUntil.isPast).toBe(true);
      expect(timeUntil.timeText).toContain('30 minute');
      expect(timeUntil.timeText).toContain('ago');
    });

    it('should identify sessions starting soon', () => {
      const soonDate = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
      const laterDate = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
      
      expect(isSessionStartingSoon(soonDate)).toBe(true);
      expect(isSessionStartingSoon(laterDate)).toBe(false);
    });
  });

  describe('Session Management', () => {
    const createMockSession = (overrides: Partial<TelehealthSession> = {}): TelehealthSession => ({
      id: 'session-123',
      appointmentId: 'apt-123',
      status: 'scheduled',
      patient: { id: 'patient-1', name: 'John Doe', email: 'john@example.com' },
      provider: { id: 'provider-1', name: 'Dr. Smith', email: 'dr@example.com' },
      scheduledDateTime: new Date(Date.now() + 48 * 60 * 60 * 1000), // 2 days from now
      durationMinutes: 30,
      platform: {
        type: 'webrtc_native',
        joinUrl: '/session/123',
        meetingId: 'meeting-123'
      },
      accessUrls: {
        patient: '/session/123?role=patient',
        provider: '/session/123?role=provider'
      },
      settings: {
        recordingEnabled: false,
        chatEnabled: true,
        screenShareEnabled: true,
        waitingRoomEnabled: true,
        requiresPassword: false
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    });

    it('should allow cancellation of future session', () => {
      const session = createMockSession();
      expect(canCancelSession(session)).toBe(true);
    });

    it('should prevent cancellation of session within 24 hours', () => {
      const session = createMockSession({
        scheduledDateTime: new Date(Date.now() + 12 * 60 * 60 * 1000) // 12 hours from now
      });
      expect(canCancelSession(session)).toBe(false);
    });

    it('should prevent cancellation of completed session', () => {
      const session = createMockSession({
        status: 'completed'
      });
      expect(canCancelSession(session)).toBe(false);
    });
  });

  describe('Validation', () => {
    it('should validate correct session configuration', () => {
      const sessionConfig = {
        patient: { id: 'patient-1', name: 'John Doe' },
        provider: { id: 'provider-1', name: 'Dr. Smith' },
        scheduledDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        durationMinutes: 30,
        platform: { type: 'webrtc_native' as const }
      };
      
      const validation = validateSessionConfig(sessionConfig);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject session without patient', () => {
      const sessionConfig = {
        provider: { id: 'provider-1', name: 'Dr. Smith' },
        scheduledDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        durationMinutes: 30,
        platform: { type: 'webrtc_native' as const }
      };
      
      const validation = validateSessionConfig(sessionConfig);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Patient information is required');
    });

    it('should reject session in the past', () => {
      const sessionConfig = {
        patient: { id: 'patient-1', name: 'John Doe' },
        provider: { id: 'provider-1', name: 'Dr. Smith' },
        scheduledDateTime: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        durationMinutes: 30,
        platform: { type: 'webrtc_native' as const }
      };
      
      const validation = validateSessionConfig(sessionConfig);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Session must be scheduled in the future');
    });

    it('should reject session with excessive duration', () => {
      const sessionConfig = {
        patient: { id: 'patient-1', name: 'John Doe' },
        provider: { id: 'provider-1', name: 'Dr. Smith' },
        scheduledDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        durationMinutes: 300, // 5 hours
        platform: { type: 'webrtc_native' as const }
      };
      
      const validation = validateSessionConfig(sessionConfig);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Session duration cannot exceed 4 hours');
    });
  });

  describe('URL and Text Processing', () => {
    it('should extract session ID from various URL formats', () => {
      const urls = [
        '/telehealth/session/abc-123-def',
        '/telehealth/invitation/abc-123-def',
        'https://example.com/session?sessionId=abc-123-def',
        '/api/telehealth/sessions/abc-123-def'
      ];
      
      urls.forEach(url => {
        const sessionId = extractSessionIdFromUrl(url);
        expect(sessionId).toBe('abc-123-def');
      });
    });

    it('should return null for URLs without session ID', () => {
      const urls = [
        '/telehealth/dashboard',
        '/patient-portal',
        'https://example.com/other-page'
      ];
      
      urls.forEach(url => {
        const sessionId = extractSessionIdFromUrl(url);
        expect(sessionId).toBeNull();
      });
    });

    it('should sanitize session text', () => {
      const maliciousText = '<script>alert("xss")</script>Some notes <b>here</b>';
      const sanitized = sanitizeSessionText(maliciousText);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('<b>');
      expect(sanitized).not.toContain('javascript:');
      expect(sanitized).toBe('Some notes here');
    });

    it('should limit text length', () => {
      const longText = 'a'.repeat(2000);
      const sanitized = sanitizeSessionText(longText);
      
      expect(sanitized.length).toBeLessThanOrEqual(1000);
    });
  });
});