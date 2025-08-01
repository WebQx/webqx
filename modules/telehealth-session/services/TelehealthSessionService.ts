/**
 * TelehealthSessionService - Main service that orchestrates telehealth sessions
 * Provides a unified interface for session management, participants, and compliance
 */

import { SessionConfiguration, SessionState, SessionParticipant, SessionInvitation, TelehealthError, SessionAnalytics } from '../types';
import { SessionManager } from './SessionManager';
import { ParticipantManager } from './ParticipantManager';
import { ComplianceLogger } from './ComplianceLogger';

export class TelehealthSessionService {
  private sessionManager: SessionManager;
  private participantManager: ParticipantManager;
  private complianceLogger: ComplianceLogger;

  constructor(configuration: SessionConfiguration) {
    this.sessionManager = new SessionManager(configuration);
    this.participantManager = this.sessionManager.getParticipantManager();
    this.complianceLogger = this.sessionManager.getComplianceLogger();
  }

  /**
   * Start a new telehealth session
   */
  async startSession(): Promise<{ success: boolean; sessionState?: SessionState; error?: TelehealthError }> {
    try {
      const initResult = await this.sessionManager.initializeSession();
      if (!initResult.success) {
        return { success: false, error: initResult.error };
      }

      const sessionState = this.sessionManager.getSessionState();
      return { success: true, sessionState };
    } catch (error) {
      const telehealthError: TelehealthError = {
        code: 'SESSION_START_FAILED',
        message: 'Failed to start telehealth session',
        type: 'technical',
        retryable: true,
        details: { error }
      };

      return { success: false, error: telehealthError };
    }
  }

  /**
   * End the current session
   */
  async endSession(reason?: 'normal' | 'timeout' | 'error' | 'provider_ended'): Promise<{ success: boolean; analytics?: SessionAnalytics; error?: TelehealthError }> {
    try {
      const endResult = await this.sessionManager.endSession(reason);
      if (!endResult.success) {
        return { success: false, error: endResult.error };
      }

      const analytics = this.generateSessionAnalytics();
      return { success: true, analytics };
    } catch (error) {
      const telehealthError: TelehealthError = {
        code: 'SESSION_END_FAILED',
        message: 'Failed to end telehealth session',
        type: 'technical',
        retryable: false,
        details: { error }
      };

      return { success: false, error: telehealthError };
    }
  }

  /**
   * Add a participant to the session
   */
  async addParticipant(participant: Omit<SessionParticipant, 'isConnected' | 'joinedAt' | 'permissions'>): Promise<{ success: boolean; error?: TelehealthError }> {
    return await this.participantManager.addParticipant(participant);
  }

  /**
   * Remove a participant from the session
   */
  async removeParticipant(participantId: string): Promise<{ success: boolean; error?: TelehealthError }> {
    return await this.participantManager.removeParticipant(participantId);
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
    return await this.participantManager.inviteParticipant(invitedBy, inviteeEmail, inviteeName, role, message);
  }

  /**
   * Accept an invitation and join the session
   */
  async acceptInvitation(invitationId: string, participantId: string): Promise<{ success: boolean; error?: TelehealthError }> {
    return await this.participantManager.acceptInvitation(invitationId, participantId);
  }

  /**
   * Start screen sharing
   */
  async startScreenShare(participantId: string): Promise<{ success: boolean; error?: TelehealthError }> {
    return await this.sessionManager.startScreenShare(participantId);
  }

  /**
   * Stop screen sharing
   */
  async stopScreenShare(): Promise<{ success: boolean; error?: TelehealthError }> {
    return await this.sessionManager.stopScreenShare();
  }

  /**
   * Start session recording
   */
  async startRecording(participantId: string): Promise<{ success: boolean; error?: TelehealthError }> {
    return await this.sessionManager.startRecording(participantId);
  }

  /**
   * Stop session recording
   */
  async stopRecording(): Promise<{ success: boolean; error?: TelehealthError }> {
    return await this.sessionManager.stopRecording();
  }

  /**
   * Minimize session for note-taking
   */
  minimizeSession(): void {
    this.sessionManager.minimizeSession();
  }

  /**
   * Maximize session window
   */
  maximizeSession(): void {
    this.sessionManager.maximizeSession();
  }

  /**
   * Pause the session
   */
  async pauseSession(): Promise<{ success: boolean; error?: TelehealthError }> {
    return await this.sessionManager.pauseSession();
  }

  /**
   * Resume the session
   */
  async resumeSession(): Promise<{ success: boolean; error?: TelehealthError }> {
    return await this.sessionManager.resumeSession();
  }

  /**
   * Mute/unmute a participant
   */
  async muteParticipant(participantId: string, muted: boolean, mutedBy: string): Promise<{ success: boolean; error?: TelehealthError }> {
    try {
      const mutedByParticipant = this.participantManager.getParticipant(mutedBy);
      if (!mutedByParticipant || !mutedByParticipant.permissions.canMuteOthers) {
        return {
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Participant does not have permission to mute others',
            type: 'permission',
            retryable: false
          }
        };
      }

      this.complianceLogger.logEvent({
        type: muted ? 'participant_muted' : 'participant_unmuted',
        participantId,
        complianceLevel: 'medium',
        data: { mutedBy, muted }
      });

      // In a real implementation, this would control the actual media stream
      console.log(`[Telehealth] Participant ${participantId} ${muted ? 'muted' : 'unmuted'} by ${mutedBy}`);

      return { success: true };
    } catch (error) {
      const telehealthError: TelehealthError = {
        code: 'MUTE_OPERATION_FAILED',
        message: 'Failed to mute/unmute participant',
        type: 'technical',
        retryable: true,
        details: { error }
      };

      this.complianceLogger.logTechnicalIssue(participantId, telehealthError);
      return { success: false, error: telehealthError };
    }
  }

  /**
   * Get current session state
   */
  getSessionState(): SessionState {
    return this.sessionManager.getSessionState();
  }

  /**
   * Get all participants
   */
  getParticipants(): SessionParticipant[] {
    return this.participantManager.getParticipants();
  }

  /**
   * Get connected participants only
   */
  getConnectedParticipants(): SessionParticipant[] {
    return this.participantManager.getConnectedParticipants();
  }

  /**
   * Get pending invitations
   */
  getPendingInvitations(): SessionInvitation[] {
    return this.participantManager.getPendingInvitations();
  }

  /**
   * Get session compliance data
   */
  getComplianceData(): ReturnType<ComplianceLogger['exportComplianceData']> {
    return this.complianceLogger.exportComplianceData();
  }

  /**
   * Get session analytics
   */
  getSessionAnalytics(): SessionAnalytics {
    return this.generateSessionAnalytics();
  }

  /**
   * Get local media stream (for UI rendering)
   */
  getLocalMediaStream(): MediaStream | null {
    return this.sessionManager.getLocalStream();
  }

  /**
   * Get screen share stream (for UI rendering)
   */
  getScreenShareStream(): MediaStream | null {
    return this.sessionManager.getScreenShareStream();
  }

  /**
   * Check if session is ready for participants
   */
  isSessionReady(): boolean {
    const state = this.getSessionState();
    return state.status === 'active' || state.status === 'waiting';
  }

  /**
   * Check if participant can perform action
   */
  canParticipantPerformAction(participantId: string, action: keyof SessionParticipant['permissions']): boolean {
    const participant = this.participantManager.getParticipant(participantId);
    return participant ? participant.permissions[action] : false;
  }

  /**
   * Log technical issue
   */
  logTechnicalIssue(participantId: string, error: TelehealthError): void {
    this.complianceLogger.logTechnicalIssue(participantId, error);
  }

  /**
   * Log consent event
   */
  logConsent(participantId: string, consentType: 'recording' | 'data_sharing' | 'session_participation', granted: boolean): void {
    this.complianceLogger.logConsent(participantId, consentType, granted);
  }

  private generateSessionAnalytics(): SessionAnalytics {
    const sessionState = this.getSessionState();
    const complianceSummary = this.complianceLogger.getComplianceSummary();
    const participants = this.getParticipants();

    return {
      sessionId: sessionState.id,
      totalDuration: sessionState.duration || 0,
      participantCount: participants.length,
      averageConnectionQuality: 85, // Would be calculated from actual connection metrics
      technicalIssuesCount: complianceSummary.technicalIssues,
      recordingDuration: sessionState.isRecording ? sessionState.duration : undefined,
      transcriptionAccuracy: sessionState.configuration.transcriptionEnabled ? 95 : undefined,
      complianceScore: this.calculateComplianceScore(complianceSummary, sessionState)
    };
  }

  private calculateComplianceScore(
    summary: ReturnType<ComplianceLogger['getComplianceSummary']>, 
    sessionState: SessionState
  ): number {
    let score = 100;

    // Deduct points for technical issues
    score -= summary.technicalIssues * 5;

    // Deduct points if required consent events are missing
    if (sessionState.configuration.recordingEnabled && summary.consentEvents === 0) {
      score -= 20;
    }

    // Deduct points for short sessions (might indicate technical problems)
    if (summary.sessionDuration && summary.sessionDuration < 300) { // Less than 5 minutes
      score -= 10;
    }

    // Ensure score doesn't go below 0
    return Math.max(0, score);
  }
}