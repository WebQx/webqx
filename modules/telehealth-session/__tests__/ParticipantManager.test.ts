/**
 * Tests for ParticipantManager
 */

import { ParticipantManager } from '../services/ParticipantManager';
import { ComplianceLogger } from '../services/ComplianceLogger';
import { SessionParticipant, ComplianceSettings } from '../types';

describe('ParticipantManager', () => {
  let participantManager: ParticipantManager;
  let complianceLogger: ComplianceLogger;

  const mockComplianceConfig: ComplianceSettings = {
    enableAuditLogging: true,
    enableConsentTracking: true,
    enableDataRetention: true,
    retentionPeriodDays: 2555,
    enableEncryption: true,
    logLevel: 'standard'
  };

  beforeEach(() => {
    // Mock console.log to avoid output during tests
    jest.spyOn(console, 'log').mockImplementation();
    
    complianceLogger = new ComplianceLogger('test-session-123', mockComplianceConfig);
    participantManager = new ParticipantManager('test-session-123', complianceLogger, 5);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Adding Participants', () => {
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

    it('should add participants successfully with correct permissions', async () => {
      const providerResult = await participantManager.addParticipant(mockProvider);
      expect(providerResult.success).toBe(true);

      const patientResult = await participantManager.addParticipant(mockPatient);
      expect(patientResult.success).toBe(true);

      const participants = participantManager.getParticipants();
      expect(participants).toHaveLength(2);

      const provider = participants.find(p => p.role === 'provider');
      const patient = participants.find(p => p.role === 'patient');

      expect(provider?.permissions.canEndSession).toBe(true);
      expect(provider?.permissions.canMuteOthers).toBe(true);
      expect(patient?.permissions.canEndSession).toBe(false);
      expect(patient?.permissions.canMuteOthers).toBe(false);
    });

    it('should prevent duplicate participants', async () => {
      const firstResult = await participantManager.addParticipant(mockProvider);
      expect(firstResult.success).toBe(true);

      const duplicateResult = await participantManager.addParticipant(mockProvider);
      expect(duplicateResult.success).toBe(false);
      expect(duplicateResult.error?.code).toBe('PARTICIPANT_EXISTS');
    });

    it('should enforce maximum participant limit', async () => {
      const limitedManager = new ParticipantManager('test-session', complianceLogger, 1);

      const firstResult = await limitedManager.addParticipant(mockProvider);
      expect(firstResult.success).toBe(true);

      const secondResult = await limitedManager.addParticipant(mockPatient);
      expect(secondResult.success).toBe(false);
      expect(secondResult.error?.code).toBe('SESSION_FULL');
    });

    it('should set correct default permissions for different roles', async () => {
      const roles: Array<{ role: SessionParticipant['role'], canEndSession: boolean, canMuteOthers: boolean }> = [
        { role: 'provider', canEndSession: true, canMuteOthers: true },
        { role: 'specialist', canEndSession: false, canMuteOthers: true },
        { role: 'patient', canEndSession: false, canMuteOthers: false },
        { role: 'interpreter', canEndSession: false, canMuteOthers: false },
        { role: 'caregiver', canEndSession: false, canMuteOthers: false }
      ];

      for (const { role, canEndSession, canMuteOthers } of roles) {
        const participant = {
          id: `${role}-123`,
          name: `Test ${role}`,
          role
        };

        await participantManager.addParticipant(participant);
        const added = participantManager.getParticipant(participant.id);

        expect(added?.permissions.canEndSession).toBe(canEndSession);
        expect(added?.permissions.canMuteOthers).toBe(canMuteOthers);
      }
    });
  });

  describe('Removing Participants', () => {
    beforeEach(async () => {
      await participantManager.addParticipant({
        id: 'provider-123',
        name: 'Dr. Smith',
        role: 'provider'
      });
    });

    it('should remove participants successfully', async () => {
      const removeResult = await participantManager.removeParticipant('provider-123');
      expect(removeResult.success).toBe(true);

      const participant = participantManager.getParticipant('provider-123');
      expect(participant?.isConnected).toBe(false);
      expect(participant?.leftAt).toBeInstanceOf(Date);
    });

    it('should handle removing non-existent participants', async () => {
      const removeResult = await participantManager.removeParticipant('non-existent');
      expect(removeResult.success).toBe(false);
      expect(removeResult.error?.code).toBe('PARTICIPANT_NOT_FOUND');
    });
  });

  describe('Participant Invitations', () => {
    beforeEach(async () => {
      await participantManager.addParticipant({
        id: 'provider-123',
        name: 'Dr. Smith',
        role: 'provider'
      });
    });

    it('should send invitations successfully', async () => {
      const inviteResult = await participantManager.inviteParticipant(
        'provider-123',
        'interpreter@service.com',
        'Maria Interpreter',
        'interpreter',
        'Please join for Spanish interpretation'
      );

      expect(inviteResult.success).toBe(true);
      expect(inviteResult.invitationId).toBeDefined();

      const invitations = participantManager.getPendingInvitations();
      expect(invitations).toHaveLength(1);
      expect(invitations[0].inviteeEmail).toBe('interpreter@service.com');
      expect(invitations[0].role).toBe('interpreter');
      expect(invitations[0].status).toBe('pending');
    });

    it('should enforce invitation permissions', async () => {
      await participantManager.addParticipant({
        id: 'patient-456',
        name: 'John Doe',
        role: 'patient'
      });

      const inviteResult = await participantManager.inviteParticipant(
        'patient-456', // Patient cannot invite
        'someone@email.com',
        'Someone',
        'caregiver'
      );

      expect(inviteResult.success).toBe(false);
      expect(inviteResult.error?.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should accept invitations and add participants', async () => {
      const inviteResult = await participantManager.inviteParticipant(
        'provider-123',
        'caregiver@family.com',
        'Jane Caregiver',
        'caregiver'
      );

      expect(inviteResult.success).toBe(true);

      const acceptResult = await participantManager.acceptInvitation(
        inviteResult.invitationId!,
        'caregiver-789'
      );

      expect(acceptResult.success).toBe(true);

      const participants = participantManager.getParticipants();
      const caregiver = participants.find(p => p.role === 'caregiver');
      expect(caregiver).toBeDefined();
      expect(caregiver?.name).toBe('Jane Caregiver');
    });

    it('should handle non-existent invitations', async () => {
      const acceptResult = await participantManager.acceptInvitation(
        'non-existent-invitation',
        'participant-123'
      );

      expect(acceptResult.success).toBe(false);
      expect(acceptResult.error?.code).toBe('INVITATION_NOT_FOUND');
    });

    it('should handle already processed invitations', async () => {
      const inviteResult = await participantManager.inviteParticipant(
        'provider-123',
        'test@email.com',
        'Test User',
        'caregiver'
      );

      // Accept first time
      await participantManager.acceptInvitation(
        inviteResult.invitationId!,
        'participant-123'
      );

      // Try to accept again
      const secondAcceptResult = await participantManager.acceptInvitation(
        inviteResult.invitationId!,
        'participant-456'
      );

      expect(secondAcceptResult.success).toBe(false);
      expect(secondAcceptResult.error?.code).toBe('INVITATION_ALREADY_PROCESSED');
    });

    it('should handle expired invitations', async () => {
      const inviteResult = await participantManager.inviteParticipant(
        'provider-123',
        'test@email.com',
        'Test User',
        'caregiver'
      );

      // Manually expire the invitation
      const invitations = participantManager.getPendingInvitations();
      const invitation = invitations.find(inv => inv.id === inviteResult.invitationId);
      if (invitation) {
        invitation.expiresAt = new Date(Date.now() - 1000); // Expired 1 second ago
      }

      const acceptResult = await participantManager.acceptInvitation(
        inviteResult.invitationId!,
        'participant-123'
      );

      expect(acceptResult.success).toBe(false);
      expect(acceptResult.error?.code).toBe('INVITATION_EXPIRED');
    });
  });

  describe('Permission Management', () => {
    beforeEach(async () => {
      await participantManager.addParticipant({
        id: 'provider-123',
        name: 'Dr. Smith',
        role: 'provider'
      });
    });

    it('should update participant permissions', async () => {
      const updateResult = await participantManager.updateParticipantPermissions(
        'provider-123',
        { canRecordSession: false }
      );

      expect(updateResult.success).toBe(true);

      const participant = participantManager.getParticipant('provider-123');
      expect(participant?.permissions.canRecordSession).toBe(false);
      // Other permissions should remain unchanged
      expect(participant?.permissions.canEndSession).toBe(true);
    });

    it('should handle updating permissions for non-existent participants', async () => {
      const updateResult = await participantManager.updateParticipantPermissions(
        'non-existent',
        { canRecordSession: false }
      );

      expect(updateResult.success).toBe(false);
      expect(updateResult.error?.code).toBe('PARTICIPANT_NOT_FOUND');
    });
  });

  describe('Participant Queries', () => {
    beforeEach(async () => {
      await participantManager.addParticipant({
        id: 'provider-123',
        name: 'Dr. Smith',
        role: 'provider'
      });

      await participantManager.addParticipant({
        id: 'patient-456',
        name: 'John Doe',
        role: 'patient'
      });

      // Remove one participant
      await participantManager.removeParticipant('patient-456');
    });

    it('should return all participants', () => {
      const participants = participantManager.getParticipants();
      expect(participants).toHaveLength(2);
    });

    it('should return only connected participants', () => {
      const connected = participantManager.getConnectedParticipants();
      expect(connected).toHaveLength(1);
      expect(connected[0].id).toBe('provider-123');
    });

    it('should get specific participant by ID', () => {
      const provider = participantManager.getParticipant('provider-123');
      expect(provider).toBeDefined();
      expect(provider?.name).toBe('Dr. Smith');

      const nonExistent = participantManager.getParticipant('non-existent');
      expect(nonExistent).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully during participant operations', async () => {
      // Mock console.log to avoid output
      jest.spyOn(console, 'log').mockImplementation();
      
      try {
        // Simulate an error in the addParticipant method by calling with undefined
        const result = await participantManager.addParticipant(undefined as any);
        expect(result.success).toBe(false);
        expect(result.error?.type).toBe('technical');
        expect(result.error?.retryable).toBe(true);
      } finally {
        jest.restoreAllMocks();
      }
    });
  });
});