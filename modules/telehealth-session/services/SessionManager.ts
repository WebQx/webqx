/**
 * SessionManager - Core session management with WebRTC capabilities
 * Handles session state, media controls, and screen sharing
 */

import { SessionState, SessionConfiguration, MediaSettings, TelehealthError } from '../types';
import { ComplianceLogger } from './ComplianceLogger';
import { ParticipantManager } from './ParticipantManager';

export class SessionManager {
  private sessionState: SessionState;
  private complianceLogger: ComplianceLogger;
  private participantManager: ParticipantManager;
  private mediaSettings: MediaSettings;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private screenShareStream: MediaStream | null = null;
  private isInitialized = false;

  constructor(configuration: SessionConfiguration) {
    this.sessionState = {
      id: configuration.id,
      status: 'waiting',
      participants: [],
      isMinimized: false,
      isRecording: false,
      hasActiveScreenShare: false,
      configuration
    };

    this.complianceLogger = new ComplianceLogger(configuration.id, configuration.compliance);
    this.participantManager = new ParticipantManager(configuration.id, this.complianceLogger, configuration.maxParticipants);

    this.mediaSettings = {
      video: {
        enabled: true,
        resolution: '720p',
        frameRate: 30,
        bitrate: 1000000
      },
      audio: {
        enabled: true,
        noiseReduction: true,
        echoCancellation: true,
        autoGainControl: true
      },
      screenShare: {
        enabled: configuration.allowScreenSharing,
        includeAudio: true,
        quality: 'medium'
      }
    };
  }

  /**
   * Initialize the session and prepare media
   */
  async initializeSession(): Promise<{ success: boolean; error?: TelehealthError }> {
    try {
      if (this.isInitialized) {
        return { success: true };
      }

      // Request user media permissions
      const mediaResult = await this.initializeMedia();
      if (!mediaResult.success) {
        return mediaResult;
      }

      this.sessionState.status = 'active';
      this.sessionState.startTime = new Date();
      this.isInitialized = true;

      this.complianceLogger.logEvent({
        type: 'session_started',
        complianceLevel: 'high',
        data: { 
          configuration: this.sessionState.configuration,
          mediaSettings: this.mediaSettings
        }
      });

      return { success: true };
    } catch (error) {
      const telehealthError: TelehealthError = {
        code: 'SESSION_INIT_FAILED',
        message: 'Failed to initialize session',
        type: 'technical',
        retryable: true,
        details: { error }
      };

      this.complianceLogger.logTechnicalIssue('system', telehealthError);
      return { success: false, error: telehealthError };
    }
  }

  /**
   * End the session with proper cleanup
   */
  async endSession(reason: 'normal' | 'timeout' | 'error' | 'provider_ended' = 'normal'): Promise<{ success: boolean; error?: TelehealthError }> {
    try {
      this.sessionState.status = 'ended';
      this.sessionState.endTime = new Date();

      if (this.sessionState.startTime) {
        this.sessionState.duration = Math.floor((this.sessionState.endTime.getTime() - this.sessionState.startTime.getTime()) / 1000);
      }

      // Stop recording if active
      if (this.sessionState.isRecording) {
        await this.stopRecording();
      }

      // Stop screen sharing if active
      if (this.sessionState.hasActiveScreenShare) {
        await this.stopScreenShare();
      }

      // Close all peer connections
      this.peerConnections.forEach(pc => pc.close());
      this.peerConnections.clear();

      // Stop local media streams
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }

      // Remove all participants
      const connectedParticipants = this.participantManager.getConnectedParticipants();
      for (const participant of connectedParticipants) {
        await this.participantManager.removeParticipant(participant.id);
      }

      this.complianceLogger.logSessionEnd(
        this.sessionState.duration || 0,
        connectedParticipants.length,
        reason
      );

      return { success: true };
    } catch (error) {
      const telehealthError: TelehealthError = {
        code: 'SESSION_END_FAILED',
        message: 'Failed to properly end session',
        type: 'technical',
        retryable: false,
        details: { error }
      };

      this.complianceLogger.logTechnicalIssue('system', telehealthError);
      return { success: false, error: telehealthError };
    }
  }

  /**
   * Start screen sharing
   */
  async startScreenShare(participantId: string): Promise<{ success: boolean; error?: TelehealthError }> {
    try {
      const participant = this.participantManager.getParticipant(participantId);
      if (!participant || !participant.permissions.canShareScreen) {
        return {
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Participant does not have screen sharing permissions',
            type: 'permission',
            retryable: false
          }
        };
      }

      if (this.sessionState.hasActiveScreenShare) {
        return {
          success: false,
          error: {
            code: 'SCREEN_SHARE_ACTIVE',
            message: 'Screen sharing is already active',
            type: 'validation',
            retryable: false
          }
        };
      }

      // Get screen capture stream
      this.screenShareStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: this.mediaSettings.screenShare.includeAudio
      });

      this.sessionState.hasActiveScreenShare = true;

      this.complianceLogger.logEvent({
        type: 'screen_share_started',
        participantId,
        complianceLevel: 'medium',
        data: { includeAudio: this.mediaSettings.screenShare.includeAudio }
      });

      return { success: true };
    } catch (error) {
      const telehealthError: TelehealthError = {
        code: 'SCREEN_SHARE_FAILED',
        message: 'Failed to start screen sharing',
        type: 'technical',
        retryable: true,
        details: { error }
      };

      this.complianceLogger.logTechnicalIssue(participantId, telehealthError);
      return { success: false, error: telehealthError };
    }
  }

  /**
   * Stop screen sharing
   */
  async stopScreenShare(): Promise<{ success: boolean; error?: TelehealthError }> {
    try {
      if (this.screenShareStream) {
        this.screenShareStream.getTracks().forEach(track => track.stop());
        this.screenShareStream = null;
      }

      this.sessionState.hasActiveScreenShare = false;

      this.complianceLogger.logEvent({
        type: 'screen_share_stopped',
        complianceLevel: 'medium'
      });

      return { success: true };
    } catch (error) {
      const telehealthError: TelehealthError = {
        code: 'SCREEN_SHARE_STOP_FAILED',
        message: 'Failed to stop screen sharing',
        type: 'technical',
        retryable: true,
        details: { error }
      };

      this.complianceLogger.logTechnicalIssue('system', telehealthError);
      return { success: false, error: telehealthError };
    }
  }

  /**
   * Start session recording
   */
  async startRecording(participantId: string): Promise<{ success: boolean; error?: TelehealthError }> {
    try {
      const participant = this.participantManager.getParticipant(participantId);
      if (!participant || !participant.permissions.canRecordSession) {
        return {
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Participant does not have recording permissions',
            type: 'permission',
            retryable: false
          }
        };
      }

      if (!this.sessionState.configuration.recordingEnabled) {
        return {
          success: false,
          error: {
            code: 'RECORDING_DISABLED',
            message: 'Recording is disabled for this session',
            type: 'validation',
            retryable: false
          }
        };
      }

      // Log consent requirement
      this.complianceLogger.logConsent(participantId, 'recording', true);

      this.sessionState.isRecording = true;

      this.complianceLogger.logEvent({
        type: 'recording_started',
        participantId,
        complianceLevel: 'high',
        data: { recordingEnabled: true }
      });

      // In a real implementation, this would start actual recording
      console.log('[Telehealth] Recording started for session', this.sessionState.id);

      return { success: true };
    } catch (error) {
      const telehealthError: TelehealthError = {
        code: 'RECORDING_START_FAILED',
        message: 'Failed to start recording',
        type: 'technical',
        retryable: true,
        details: { error }
      };

      this.complianceLogger.logTechnicalIssue(participantId, telehealthError);
      return { success: false, error: telehealthError };
    }
  }

  /**
   * Stop session recording
   */
  async stopRecording(): Promise<{ success: boolean; error?: TelehealthError }> {
    try {
      this.sessionState.isRecording = false;

      this.complianceLogger.logEvent({
        type: 'recording_stopped',
        complianceLevel: 'high'
      });

      // In a real implementation, this would stop actual recording and save the file
      console.log('[Telehealth] Recording stopped for session', this.sessionState.id);

      return { success: true };
    } catch (error) {
      const telehealthError: TelehealthError = {
        code: 'RECORDING_STOP_FAILED',
        message: 'Failed to stop recording',
        type: 'technical',
        retryable: true,
        details: { error }
      };

      this.complianceLogger.logTechnicalIssue('system', telehealthError);
      return { success: false, error: telehealthError };
    }
  }

  /**
   * Minimize session window
   */
  minimizeSession(): void {
    this.sessionState.isMinimized = true;
    this.complianceLogger.logEvent({
      type: 'session_minimized',
      complianceLevel: 'low'
    });
  }

  /**
   * Maximize session window
   */
  maximizeSession(): void {
    this.sessionState.isMinimized = false;
    this.complianceLogger.logEvent({
      type: 'session_maximized',
      complianceLevel: 'low'
    });
  }

  /**
   * Pause the session
   */
  async pauseSession(): Promise<{ success: boolean; error?: TelehealthError }> {
    try {
      this.sessionState.status = 'paused';

      this.complianceLogger.logEvent({
        type: 'session_paused',
        complianceLevel: 'medium'
      });

      return { success: true };
    } catch (error) {
      const telehealthError: TelehealthError = {
        code: 'SESSION_PAUSE_FAILED',
        message: 'Failed to pause session',
        type: 'technical',
        retryable: true,
        details: { error }
      };

      this.complianceLogger.logTechnicalIssue('system', telehealthError);
      return { success: false, error: telehealthError };
    }
  }

  /**
   * Resume the session
   */
  async resumeSession(): Promise<{ success: boolean; error?: TelehealthError }> {
    try {
      this.sessionState.status = 'active';

      this.complianceLogger.logEvent({
        type: 'session_resumed',
        complianceLevel: 'medium'
      });

      return { success: true };
    } catch (error) {
      const telehealthError: TelehealthError = {
        code: 'SESSION_RESUME_FAILED',
        message: 'Failed to resume session',
        type: 'technical',
        retryable: true,
        details: { error }
      };

      this.complianceLogger.logTechnicalIssue('system', telehealthError);
      return { success: false, error: telehealthError };
    }
  }

  /**
   * Update media settings
   */
  async updateMediaSettings(settings: Partial<MediaSettings>): Promise<{ success: boolean; error?: TelehealthError }> {
    try {
      this.mediaSettings = { ...this.mediaSettings, ...settings };

      this.complianceLogger.logEvent({
        type: 'media_settings_updated',
        complianceLevel: 'low',
        data: { updatedSettings: settings }
      });

      return { success: true };
    } catch (error) {
      const telehealthError: TelehealthError = {
        code: 'MEDIA_SETTINGS_UPDATE_FAILED',
        message: 'Failed to update media settings',
        type: 'technical',
        retryable: true,
        details: { error }
      };

      this.complianceLogger.logTechnicalIssue('system', telehealthError);
      return { success: false, error: telehealthError };
    }
  }

  /**
   * Get current session state
   */
  getSessionState(): SessionState {
    return {
      ...this.sessionState,
      participants: this.participantManager.getParticipants()
    };
  }

  /**
   * Get participant manager instance
   */
  getParticipantManager(): ParticipantManager {
    return this.participantManager;
  }

  /**
   * Get compliance logger instance
   */
  getComplianceLogger(): ComplianceLogger {
    return this.complianceLogger;
  }

  /**
   * Get media settings
   */
  getMediaSettings(): MediaSettings {
    return { ...this.mediaSettings };
  }

  /**
   * Get local media stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Get screen share stream
   */
  getScreenShareStream(): MediaStream | null {
    return this.screenShareStream;
  }

  private async initializeMedia(): Promise<{ success: boolean; error?: TelehealthError }> {
    try {
      const constraints = {
        video: this.mediaSettings.video.enabled ? {
          width: this.getVideoResolution().width,
          height: this.getVideoResolution().height,
          frameRate: this.mediaSettings.video.frameRate
        } : false,
        audio: this.mediaSettings.audio.enabled ? {
          noiseSuppression: this.mediaSettings.audio.noiseReduction,
          echoCancellation: this.mediaSettings.audio.echoCancellation,
          autoGainControl: this.mediaSettings.audio.autoGainControl
        } : false
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'MEDIA_PERMISSION_DENIED',
          message: 'Failed to access camera and microphone',
          type: 'permission',
          retryable: true,
          details: { error }
        }
      };
    }
  }

  private getVideoResolution(): { width: number; height: number } {
    switch (this.mediaSettings.video.resolution) {
      case '720p':
        return { width: 1280, height: 720 };
      case '1080p':
        return { width: 1920, height: 1080 };
      case '4k':
        return { width: 3840, height: 2160 };
      default:
        return { width: 1280, height: 720 };
    }
  }
}