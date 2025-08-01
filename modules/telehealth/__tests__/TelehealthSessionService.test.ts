/**
 * Telehealth Session Service Tests
 * 
 * Test suite for telehealth session management functionality
 * including session creation, validation, and launching.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import {
  TelehealthSessionService,
  CreateSessionRequest,
  SessionLaunchRequest,
  TelehealthServiceConfig
} from '../services/TelehealthSessionService';

describe('TelehealthSessionService', () => {
  let service: TelehealthSessionService;
  let mockConfig: TelehealthServiceConfig;

  beforeEach(() => {
    mockConfig = {
      platforms: {
        webrtc_native: {
          enabled: true,
          apiKey: 'test-key',
          sdkConfig: {}
        },
        zoom: {
          enabled: true,
          apiKey: 'zoom-key',
          apiSecret: 'zoom-secret'
        }
      },
      sessionDefaults: {
        durationMinutes: 30,
        platform: 'webrtc_native',
        settings: {
          recordingEnabled: false,
          chatEnabled: true,
          screenShareEnabled: true,
          waitingRoomEnabled: true,
          requiresPassword: false
        }
      },
      security: {
        tokenExpirationMinutes: 60,
        requirePasswordForSessions: false,
        allowRecording: true,
        maxSessionDurationMinutes: 240
      },
      email: {
        smtp: {
          host: 'smtp.test.com',
          port: 587,
          secure: false,
          auth: {
            user: 'test@example.com',
            pass: 'password'
          }
        },
        templates: {
          invitation: 'invitation-template',
          reminder: 'reminder-template',
          cancellation: 'cancellation-template'
        },
        fromAddress: 'noreply@webqx.com',
        defaultSupportInfo: {
          phone: '555-123-HELP',
          email: 'support@webqx.com',
          helpUrl: 'https://help.webqx.com'
        }
      },
      database: {
        connectionString: 'test://connection',
        sessionTableName: 'telehealth_sessions',
        invitationTableName: 'telehealth_invitations'
      }
    };

    service = new TelehealthSessionService(mockConfig);
  });

  describe('Session Creation', () => {
    it('should create a telehealth session successfully', async () => {
      const request: CreateSessionRequest = {
        appointmentId: 'apt-123',
        platform: 'webrtc_native',
        autoSendInvitation: true,
        customMessage: 'Looking forward to our session!'
      };

      const result = await service.createSession(request);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.appointmentId).toBe('apt-123');
      expect(result.data?.platform.type).toBe('webrtc_native');
      expect(result.data?.status).toBe('scheduled');
    });

    it('should fail with invalid appointment ID', async () => {
      const request: CreateSessionRequest = {
        appointmentId: '',
        platform: 'webrtc_native'
      };

      const result = await service.createSession(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.message).toContain('Appointment ID is required');
    });

    it('should fail with disabled platform', async () => {
      // Disable zoom platform
      mockConfig.platforms.zoom!.enabled = false;
      service = new TelehealthSessionService(mockConfig);

      const request: CreateSessionRequest = {
        appointmentId: 'apt-123',
        platform: 'zoom'
      };

      const result = await service.createSession(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.message).toContain('Platform zoom is not enabled');
    });
  });

  describe('Session Retrieval', () => {
    it('should retrieve existing session', async () => {
      // First create a session
      const createRequest: CreateSessionRequest = {
        appointmentId: 'apt-123',
        platform: 'webrtc_native'
      };

      const createResult = await service.createSession(createRequest);
      expect(createResult.success).toBe(true);

      const sessionId = createResult.data!.id;

      // Now retrieve it
      const getResult = await service.getSession(sessionId);

      expect(getResult.success).toBe(true);
      expect(getResult.data?.id).toBe(sessionId);
      expect(getResult.data?.appointmentId).toBe('apt-123');
    });

    it('should fail to retrieve non-existent session', async () => {
      const result = await service.getSession('non-existent-session');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SESSION_NOT_FOUND');
    });
  });

  describe('Session Launch', () => {
    let sessionId: string;

    beforeEach(async () => {
      // Create a session for testing
      const createRequest: CreateSessionRequest = {
        appointmentId: 'apt-123',
        platform: 'webrtc_native'
      };

      const createResult = await service.createSession(createRequest);
      sessionId = createResult.data!.id;
    });

    it('should launch session for authorized patient', async () => {
      const launchRequest: SessionLaunchRequest = {
        sessionId,
        userRole: 'patient',
        userId: 'patient-1', // This matches the mock patient ID
        launchMethod: 'patient_portal'
      };

      const result = await service.launchSession(launchRequest);

      expect(result.success).toBe(true);
      expect(result.sessionAccess).toBeDefined();
      expect(result.sessionAccess?.userRole).toBe('patient');
      expect(result.sessionAccess?.sessionId).toBe(sessionId);
      expect(result.sessionAccess?.joinUrl).toContain(sessionId);
    });

    it('should launch session for authorized provider', async () => {
      const launchRequest: SessionLaunchRequest = {
        sessionId,
        userRole: 'provider',
        userId: 'provider-1', // This matches the mock provider ID
        launchMethod: 'provider_initiated'
      };

      const result = await service.launchSession(launchRequest);

      expect(result.success).toBe(true);
      expect(result.sessionAccess).toBeDefined();
      expect(result.sessionAccess?.userRole).toBe('provider');
    });

    it('should fail for non-existent session', async () => {
      const launchRequest: SessionLaunchRequest = {
        sessionId: 'non-existent',
        userRole: 'patient',
        userId: 'patient-1',
        launchMethod: 'patient_portal'
      };

      const result = await service.launchSession(launchRequest);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SESSION_NOT_FOUND');
    });
  });

  describe('Session Status Updates', () => {
    let sessionId: string;

    beforeEach(async () => {
      // Create a session for testing
      const createRequest: CreateSessionRequest = {
        appointmentId: 'apt-123',
        platform: 'webrtc_native'
      };

      const createResult = await service.createSession(createRequest);
      sessionId = createResult.data!.id;
    });

    it('should update session status successfully', async () => {
      const result = await service.updateSessionStatus(sessionId, 'in_progress');

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('in_progress');
      expect(result.data?.actualStartTime).toBeDefined();
    });

    it('should update session with notes', async () => {
      const notes = 'Session completed successfully';
      const result = await service.updateSessionStatus(sessionId, 'completed', notes);

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('completed');
      expect(result.data?.notes).toBe(notes);
      expect(result.data?.actualEndTime).toBeDefined();
    });

    it('should fail to update non-existent session', async () => {
      const result = await service.updateSessionStatus('non-existent', 'completed');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SESSION_NOT_FOUND');
    });
  });

  describe('Provider Sessions', () => {
    beforeEach(async () => {
      // Create multiple sessions for testing
      const requests = [
        { appointmentId: 'apt-1', platform: 'webrtc_native' as const },
        { appointmentId: 'apt-2', platform: 'zoom' as const }
      ];

      for (const request of requests) {
        await service.createSession(request);
      }
    });

    it('should retrieve sessions for provider', async () => {
      const result = await service.getProviderSessions('provider-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data!.length).toBeGreaterThan(0);
    });

    it('should filter sessions by status', async () => {
      const result = await service.getProviderSessions('provider-1', 'scheduled');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.every(session => session.status === 'scheduled')).toBe(true);
    });

    it('should get today\'s sessions', async () => {
      const result = await service.getTodaysSessions('provider-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe('Patient Sessions', () => {
    beforeEach(async () => {
      // Create a session for testing
      const request: CreateSessionRequest = {
        appointmentId: 'apt-123',
        platform: 'webrtc_native'
      };

      await service.createSession(request);
    });

    it('should retrieve sessions for patient', async () => {
      const result = await service.getPatientSessions('patient-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe('Event Management', () => {
    it('should add and remove event listeners', () => {
      const mockListener = jest.fn();

      service.addEventListener('session_created', mockListener);
      
      // Verify listener was added (this would need access to internal state)
      // For now, just test that the method doesn't throw
      expect(() => {
        service.removeEventListener('session_created', mockListener);
      }).not.toThrow();
    });
  });
});