/**
 * Tests for TelehealthSessionService
 */

import { TelehealthSessionService } from '../services/TelehealthSessionService';
import { SessionConfiguration, SessionParticipant } from '../types';

// Mock MediaStream for testing
class MockMediaStream {
  tracks: any[] = [];
  
  constructor() {
    // Add some mock tracks
    this.tracks = [
      { kind: 'video', stop: jest.fn() },
      { kind: 'audio', stop: jest.fn() }
    ];
  }
  
  getTracks() { return this.tracks; }
  addTrack(track: any) { this.tracks.push(track); }
  removeTrack(track: any) { this.tracks = this.tracks.filter(t => t !== track); }
}

// Mock navigator.mediaDevices
const mockGetUserMedia = jest.fn();
const mockGetDisplayMedia = jest.fn();

// Set default successful responses
mockGetUserMedia.mockResolvedValue(new MockMediaStream());
mockGetDisplayMedia.mockResolvedValue(new MockMediaStream());

// Mock WebRTC APIs for testing
global.MediaStream = MockMediaStream as any;
global.navigator = {
  mediaDevices: {
    getUserMedia: mockGetUserMedia,
    getDisplayMedia: mockGetDisplayMedia
  }
} as any;

global.RTCPeerConnection = jest.fn().mockImplementation(() => ({
  close: jest.fn(),
  addTrack: jest.fn(),
  removeTrack: jest.fn()
})) as any;

describe('TelehealthSessionService', () => {
  let service: TelehealthSessionService;
  let mockConfig: SessionConfiguration;

  beforeEach(() => {
    mockConfig = {
      id: 'test-session-123',
      patientId: 'patient-456',
      providerId: 'provider-789',
      sessionType: 'consultation',
      maxParticipants: 5,
      recordingEnabled: true,
      transcriptionEnabled: false,
      encryptionEnabled: true,
      allowScreenSharing: true,
      allowThirdPartyParticipants: true,
      sessionTimeout: 60,
      compliance: {
        enableAuditLogging: true,
        enableConsentTracking: true,
        enableDataRetention: true,
        retentionPeriodDays: 2555,
        enableEncryption: true,
        logLevel: 'minimal' // Use minimal logging for tests
      }
    };

    // Mock console.log to reduce test output noise
    jest.spyOn(console, 'log').mockImplementation();

    service = new TelehealthSessionService(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Reset mock functions
    mockGetUserMedia.mockResolvedValue(new MockMediaStream());
    mockGetDisplayMedia.mockResolvedValue(new MockMediaStream());
  });

  describe('Session Management', () => {
    it('should start a session successfully', async () => {
      // Temporarily disable console.log mocking to see errors
      console.log.mockRestore?.();
      
      const result = await service.startSession();
      
      if (!result.success) {
        console.log('Error details:', result.error);
      }

      expect(result.success).toBe(true);
      expect(result.sessionState).toBeDefined();
      expect(result.sessionState?.status).toBe('active');
      expect(result.sessionState?.id).toBe(mockConfig.id);
    });

    it('should end a session successfully', async () => {
      await service.startSession();
      const result = await service.endSession('normal');

      expect(result.success).toBe(true);
      expect(result.analytics).toBeDefined();
      expect(result.analytics?.sessionId).toBe(mockConfig.id);
    });

    it('should minimize and maximize session', () => {
      service.minimizeSession();
      let state = service.getSessionState();
      expect(state.isMinimized).toBe(true);

      service.maximizeSession();
      state = service.getSessionState();
      expect(state.isMinimized).toBe(false);
    });

    it('should pause and resume session', async () => {
      await service.startSession();
      
      const pauseResult = await service.pauseSession();
      expect(pauseResult.success).toBe(true);
      expect(service.getSessionState().status).toBe('paused');

      const resumeResult = await service.resumeSession();
      expect(resumeResult.success).toBe(true);
      expect(service.getSessionState().status).toBe('active');
    });
  });

  describe('Participant Management', () => {
    const mockProvider: Omit<SessionParticipant, 'isConnected' | 'joinedAt' | 'permissions'> = {
      id: 'provider-123',
      name: 'Dr. Smith',
      role: 'provider',
      email: 'dr.smith@hospital.com'
    };

    const mockPatient: Omit<SessionParticipant, 'isConnected' | 'joinedAt' | 'permissions'> = {
      id: 'patient-456',
      name: 'John Doe',
      role: 'patient',
      email: 'john.doe@email.com'
    };

    it('should add participants successfully', async () => {
      const providerResult = await service.addParticipant(mockProvider);
      expect(providerResult.success).toBe(true);

      const patientResult = await service.addParticipant(mockPatient);
      expect(patientResult.success).toBe(true);

      const participants = service.getParticipants();
      expect(participants).toHaveLength(2);
      expect(participants[0].permissions.canEndSession).toBe(true); // Provider permissions
      expect(participants[1].permissions.canEndSession).toBe(false); // Patient permissions
    });

    it('should remove participants successfully', async () => {
      await service.addParticipant(mockProvider);
      await service.addParticipant(mockPatient);

      const removeResult = await service.removeParticipant(mockPatient.id);
      expect(removeResult.success).toBe(true);

      const participants = service.getConnectedParticipants();
      expect(participants).toHaveLength(1);
      expect(participants[0].id).toBe(mockProvider.id);
    });

    it('should prevent adding participants beyond max limit', async () => {
      const config = { ...mockConfig, maxParticipants: 1 };
      const limitedService = new TelehealthSessionService(config);

      const firstResult = await limitedService.addParticipant(mockProvider);
      expect(firstResult.success).toBe(true);

      const secondResult = await limitedService.addParticipant(mockPatient);
      expect(secondResult.success).toBe(false);
      expect(secondResult.error?.code).toBe('SESSION_FULL');
    });

    it('should handle third-party participant invitations', async () => {
      await service.addParticipant(mockProvider);

      const inviteResult = await service.inviteParticipant(
        mockProvider.id,
        'interpreter@service.com',
        'Maria Interpreter',
        'interpreter',
        'Please join for Spanish interpretation'
      );

      expect(inviteResult.success).toBe(true);
      expect(inviteResult.invitationId).toBeDefined();

      const invitations = service.getPendingInvitations();
      expect(invitations).toHaveLength(1);
      expect(invitations[0].role).toBe('interpreter');
    });

    it('should accept invitations and add participants', async () => {
      await service.addParticipant(mockProvider);

      const inviteResult = await service.inviteParticipant(
        mockProvider.id,
        'caregiver@family.com',
        'Jane Caregiver',
        'caregiver'
      );

      expect(inviteResult.success).toBe(true);

      const acceptResult = await service.acceptInvitation(
        inviteResult.invitationId!,
        'caregiver-789'
      );

      expect(acceptResult.success).toBe(true);

      const participants = service.getParticipants();
      expect(participants).toHaveLength(2);
      expect(participants.find(p => p.role === 'caregiver')).toBeDefined();
    });
  });

  describe('Media Controls', () => {
    beforeEach(async () => {
      const mockProvider: Omit<SessionParticipant, 'isConnected' | 'joinedAt' | 'permissions'> = {
        id: 'provider-123',
        name: 'Dr. Smith',
        role: 'provider'
      };
      await service.startSession(); // Initialize session first
      await service.addParticipant(mockProvider);
    });

    it('should start and stop screen sharing', async () => {
      const startResult = await service.startScreenShare('provider-123');
      expect(startResult.success).toBe(true);
      expect(service.getSessionState().hasActiveScreenShare).toBe(true);

      const stopResult = await service.stopScreenShare();
      expect(stopResult.success).toBe(true);
      expect(service.getSessionState().hasActiveScreenShare).toBe(false);
    });

    it('should start and stop recording', async () => {
      const startResult = await service.startRecording('provider-123');
      expect(startResult.success).toBe(true);
      expect(service.getSessionState().isRecording).toBe(true);

      const stopResult = await service.stopRecording();
      expect(stopResult.success).toBe(true);
      expect(service.getSessionState().isRecording).toBe(false);
    });

    it('should enforce permissions for screen sharing', async () => {
      const mockPatient: Omit<SessionParticipant, 'isConnected' | 'joinedAt' | 'permissions'> = {
        id: 'patient-456',
        name: 'John Doe',
        role: 'patient'
      };
      await service.addParticipant(mockPatient);

      // Patient cannot start screen sharing by default
      const result = await service.startScreenShare('patient-456');
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should handle muting participants', async () => {
      const mockPatient: Omit<SessionParticipant, 'isConnected' | 'joinedAt' | 'permissions'> = {
        id: 'patient-456',
        name: 'John Doe',
        role: 'patient'
      };
      await service.addParticipant(mockPatient);

      const muteResult = await service.muteParticipant('patient-456', true, 'provider-123');
      expect(muteResult.success).toBe(true);

      const unmuteResult = await service.muteParticipant('patient-456', false, 'provider-123');
      expect(unmuteResult.success).toBe(true);
    });
  });

  describe('Compliance and Analytics', () => {
    it('should track compliance events', async () => {
      await service.startSession();
      await service.addParticipant({
        id: 'provider-123',
        name: 'Dr. Smith',
        role: 'provider'
      });

      service.logConsent('provider-123', 'recording', true);
      await service.startRecording('provider-123');
      await service.endSession();

      const complianceData = service.getComplianceData();
      expect(complianceData.events.length).toBeGreaterThan(0);
      expect(complianceData.summary.consentEvents).toBeGreaterThan(0);
    });

    it('should generate session analytics', async () => {
      await service.startSession();
      await service.addParticipant({
        id: 'provider-123',
        name: 'Dr. Smith',
        role: 'provider'
      });
      await service.endSession();

      const analytics = service.getSessionAnalytics();
      expect(analytics.sessionId).toBe(mockConfig.id);
      expect(analytics.participantCount).toBe(1);
      expect(analytics.complianceScore).toBeGreaterThan(0);
    });

    it('should provide session readiness status', async () => {
      // Session starts in 'waiting' status which is considered ready
      expect(service.isSessionReady()).toBe(true);

      // Start and then end the session
      await service.startSession();
      await service.endSession();
      
      // Ended status should not be ready
      expect(service.isSessionReady()).toBe(false);
    });

    it('should check participant permissions', async () => {
      await service.addParticipant({
        id: 'provider-123',
        name: 'Dr. Smith',
        role: 'provider'
      });

      expect(service.canParticipantPerformAction('provider-123', 'canEndSession')).toBe(true);
      expect(service.canParticipantPerformAction('provider-123', 'canRecordSession')).toBe(true);

      await service.addParticipant({
        id: 'patient-456',
        name: 'John Doe',
        role: 'patient'
      });

      expect(service.canParticipantPerformAction('patient-456', 'canEndSession')).toBe(false);
      expect(service.canParticipantPerformAction('patient-456', 'canMuteOthers')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid participant operations', async () => {
      const removeResult = await service.removeParticipant('non-existent-id');
      expect(removeResult.success).toBe(false);
      expect(removeResult.error?.code).toBe('PARTICIPANT_NOT_FOUND');
    });

    it('should handle permission violations', async () => {
      await service.addParticipant({
        id: 'patient-456',
        name: 'John Doe',
        role: 'patient'
      });

      // Patient trying to invite others (not allowed)
      const inviteResult = await service.inviteParticipant(
        'patient-456',
        'someone@email.com',
        'Someone',
        'interpreter'
      );

      expect(inviteResult.success).toBe(false);
      expect(inviteResult.error?.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should log technical issues', () => {
      const mockError = {
        code: 'TEST_ERROR',
        message: 'Test error message',
        type: 'technical' as const,
        retryable: true
      };

      expect(() => {
        service.logTechnicalIssue('test-participant', mockError);
      }).not.toThrow();

      const complianceData = service.getComplianceData();
      expect(complianceData.summary.technicalIssues).toBeGreaterThan(0);
    });
  });
});