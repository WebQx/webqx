/**
 * ParticipantManager - Manages session participants, invitations, and permissions
 * Handles third-party participants like interpreters and caregivers
 */

import { SessionParticipant, SessionInvitation, ParticipantPermissions, TelehealthError } from '../types';
import { ComplianceLogger } from './ComplianceLogger';

export class ParticipantManager {
  private participants: Map<string, SessionParticipant> = new Map();
  private invitations: Map<string, SessionInvitation> = new Map();
  private sessionId: string;
  private complianceLogger: ComplianceLogger;
  private maxParticipants: number;

  constructor(sessionId: string, complianceLogger: ComplianceLogger, maxParticipants: number = 10) {
    this.sessionId = sessionId;
    this.complianceLogger = complianceLogger;
    this.maxParticipants = maxParticipants;
  }

  /**
   * Add a participant to the session
   */
  async addParticipant(participant: Omit<SessionParticipant, 'isConnected' | 'joinedAt'>): Promise<{ success: boolean; error?: TelehealthError }> {
    try {
      // Check if session is at capacity
      if (this.participants.size >= this.maxParticipants) {
        return {
          success: false,
          error: {
            code: 'SESSION_FULL',
            message: 'Session has reached maximum participant capacity',
            type: 'validation',
            retryable: false
          }
        };
      }

      // Check if participant already exists
      if (this.participants.has(participant.id)) {
        return {
          success: false,
          error: {
            code: 'PARTICIPANT_EXISTS',
            message: 'Participant is already in the session',
            type: 'validation',
            retryable: false
          }
        };
      }

      const fullParticipant: SessionParticipant = {
        ...participant,
        isConnected: true,
        joinedAt: new Date(),
        permissions: this.getDefaultPermissions(participant.role)
      };

      this.participants.set(participant.id, fullParticipant);

      this.complianceLogger.logEvent({
        type: 'participant_joined',
        participantId: participant.id,
        complianceLevel: 'high',
        data: { participantRole: participant.role, participantName: participant.name }
      });

      return { success: true };
    } catch (error) {
      const telehealthError: TelehealthError = {
        code: 'PARTICIPANT_ADD_FAILED',
        message: 'Failed to add participant to session',
        type: 'technical',
        retryable: true,
        details: { error }
      };

      this.complianceLogger.logTechnicalIssue(participant?.id || 'unknown', telehealthError);
      return { success: false, error: telehealthError };
    }
  }

  /**
   * Remove a participant from the session
   */
  async removeParticipant(participantId: string): Promise<{ success: boolean; error?: TelehealthError }> {
    try {
      const participant = this.participants.get(participantId);
      if (!participant) {
        return {
          success: false,
          error: {
            code: 'PARTICIPANT_NOT_FOUND',
            message: 'Participant not found in session',
            type: 'validation',
            retryable: false
          }
        };
      }

      // Update participant as left
      participant.isConnected = false;
      participant.leftAt = new Date();

      this.complianceLogger.logEvent({
        type: 'participant_left',
        participantId,
        complianceLevel: 'high',
        data: { 
          participantRole: participant.role, 
          sessionDuration: participant.joinedAt ? Date.now() - participant.joinedAt.getTime() : 0
        }
      });

      return { success: true };
    } catch (error) {
      const telehealthError: TelehealthError = {
        code: 'PARTICIPANT_REMOVE_FAILED',
        message: 'Failed to remove participant from session',
        type: 'technical',
        retryable: true,
        details: { error }
      };

      this.complianceLogger.logTechnicalIssue(participantId, telehealthError);
      return { success: false, error: telehealthError };
    }
  }

  /**
   * Invite a third-party participant (interpreter, caregiver, etc.)
   */
  async inviteParticipant(
    invitedBy: string,
    inviteeEmail: string,
    inviteeName: string,
    role: SessionParticipant['role'],
    message?: string
  ): Promise<{ success: boolean; invitationId?: string; error?: TelehealthError }> {
    try {
      const invitedByParticipant = this.participants.get(invitedBy);
      if (!invitedByParticipant || !invitedByParticipant.permissions.canInviteParticipants) {
        return {
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Participant does not have permission to invite others',
            type: 'permission',
            retryable: false
          }
        };
      }

      const invitationId = this.generateInvitationId();
      const invitation: SessionInvitation = {
        id: invitationId,
        sessionId: this.sessionId,
        invitedBy,
        inviteeEmail,
        inviteeName,
        role,
        message,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        status: 'pending'
      };

      this.invitations.set(invitationId, invitation);

      this.complianceLogger.logEvent({
        type: 'invitation_sent',
        participantId: invitedBy,
        complianceLevel: 'medium',
        data: { 
          inviteeEmail, 
          inviteeName, 
          role, 
          invitationId 
        }
      });

      // In a real implementation, this would send an email or notification
      console.log(`[Telehealth] Invitation sent to ${inviteeEmail} for session ${this.sessionId}`);

      return { success: true, invitationId };
    } catch (error) {
      const telehealthError: TelehealthError = {
        code: 'INVITATION_FAILED',
        message: 'Failed to send invitation',
        type: 'technical',
        retryable: true,
        details: { error }
      };

      this.complianceLogger.logTechnicalIssue(invitedBy, telehealthError);
      return { success: false, error: telehealthError };
    }
  }

  /**
   * Accept an invitation and join the session
   */
  async acceptInvitation(invitationId: string, participantId: string): Promise<{ success: boolean; error?: TelehealthError }> {
    try {
      const invitation = this.invitations.get(invitationId);
      if (!invitation) {
        return {
          success: false,
          error: {
            code: 'INVITATION_NOT_FOUND',
            message: 'Invitation not found',
            type: 'validation',
            retryable: false
          }
        };
      }

      if (invitation.status !== 'pending') {
        return {
          success: false,
          error: {
            code: 'INVITATION_ALREADY_PROCESSED',
            message: 'Invitation has already been processed',
            type: 'validation',
            retryable: false
          }
        };
      }

      if (invitation.expiresAt < new Date()) {
        invitation.status = 'expired';
        return {
          success: false,
          error: {
            code: 'INVITATION_EXPIRED',
            message: 'Invitation has expired',
            type: 'validation',
            retryable: false
          }
        };
      }

      // Accept invitation
      invitation.status = 'accepted';
      invitation.acceptedAt = new Date();

      // Add participant to session
      const addResult = await this.addParticipant({
        id: participantId,
        name: invitation.inviteeName,
        role: invitation.role,
        email: invitation.inviteeEmail
      });

      return addResult;
    } catch (error) {
      const telehealthError: TelehealthError = {
        code: 'INVITATION_ACCEPT_FAILED',
        message: 'Failed to accept invitation',
        type: 'technical',
        retryable: true,
        details: { error }
      };

      this.complianceLogger.logTechnicalIssue(participantId, telehealthError);
      return { success: false, error: telehealthError };
    }
  }

  /**
   * Update participant permissions
   */
  async updateParticipantPermissions(participantId: string, permissions: Partial<ParticipantPermissions>): Promise<{ success: boolean; error?: TelehealthError }> {
    try {
      const participant = this.participants.get(participantId);
      if (!participant) {
        return {
          success: false,
          error: {
            code: 'PARTICIPANT_NOT_FOUND',
            message: 'Participant not found',
            type: 'validation',
            retryable: false
          }
        };
      }

      participant.permissions = { ...participant.permissions, ...permissions };

      this.complianceLogger.logEvent({
        type: 'participant_permissions_updated',
        participantId,
        complianceLevel: 'medium',
        data: { updatedPermissions: permissions }
      });

      return { success: true };
    } catch (error) {
      const telehealthError: TelehealthError = {
        code: 'PERMISSION_UPDATE_FAILED',
        message: 'Failed to update participant permissions',
        type: 'technical',
        retryable: true,
        details: { error }
      };

      this.complianceLogger.logTechnicalIssue(participantId, telehealthError);
      return { success: false, error: telehealthError };
    }
  }

  /**
   * Get all participants in the session
   */
  getParticipants(): SessionParticipant[] {
    return Array.from(this.participants.values());
  }

  /**
   * Get connected participants only
   */
  getConnectedParticipants(): SessionParticipant[] {
    return this.getParticipants().filter(p => p.isConnected);
  }

  /**
   * Get pending invitations
   */
  getPendingInvitations(): SessionInvitation[] {
    return Array.from(this.invitations.values()).filter(inv => inv.status === 'pending');
  }

  /**
   * Get participant by ID
   */
  getParticipant(participantId: string): SessionParticipant | undefined {
    return this.participants.get(participantId);
  }

  private getDefaultPermissions(role: SessionParticipant['role']): ParticipantPermissions {
    switch (role) {
      case 'provider':
        return {
          canShareScreen: true,
          canMuteOthers: true,
          canInviteParticipants: true,
          canEndSession: true,
          canRecordSession: true,
          canAccessMedicalRecords: true
        };
      case 'patient':
        return {
          canShareScreen: true,
          canMuteOthers: false,
          canInviteParticipants: false,
          canEndSession: false,
          canRecordSession: false,
          canAccessMedicalRecords: false
        };
      case 'interpreter':
        return {
          canShareScreen: false,
          canMuteOthers: false,
          canInviteParticipants: false,
          canEndSession: false,
          canRecordSession: false,
          canAccessMedicalRecords: false
        };
      case 'caregiver':
        return {
          canShareScreen: false,
          canMuteOthers: false,
          canInviteParticipants: false,
          canEndSession: false,
          canRecordSession: false,
          canAccessMedicalRecords: false
        };
      case 'specialist':
        return {
          canShareScreen: true,
          canMuteOthers: true,
          canInviteParticipants: true,
          canEndSession: false,
          canRecordSession: true,
          canAccessMedicalRecords: true
        };
      default:
        return {
          canShareScreen: false,
          canMuteOthers: false,
          canInviteParticipants: false,
          canEndSession: false,
          canRecordSession: false,
          canAccessMedicalRecords: false
        };
    }
  }

  private generateInvitationId(): string {
    return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}