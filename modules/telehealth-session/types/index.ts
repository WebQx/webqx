/**
 * Type definitions for telehealth session module
 */

export interface SessionParticipant {
  id: string;
  name: string;
  role: 'provider' | 'patient' | 'interpreter' | 'caregiver' | 'specialist';
  email?: string;
  phone?: string;
  avatar?: string;
  isConnected: boolean;
  joinedAt?: Date;
  leftAt?: Date;
  permissions: ParticipantPermissions;
}

export interface ParticipantPermissions {
  canShareScreen: boolean;
  canMuteOthers: boolean;
  canInviteParticipants: boolean;
  canEndSession: boolean;
  canRecordSession: boolean;
  canAccessMedicalRecords: boolean;
}

export interface SessionConfiguration {
  id: string;
  patientId: string;
  providerId: string;
  appointmentId?: string;
  sessionType: 'consultation' | 'follow-up' | 'emergency' | 'interpretation';
  maxParticipants: number;
  recordingEnabled: boolean;
  transcriptionEnabled: boolean;
  encryptionEnabled: boolean;
  allowScreenSharing: boolean;
  allowThirdPartyParticipants: boolean;
  sessionTimeout: number; // in minutes
  compliance: ComplianceSettings;
}

export interface ComplianceSettings {
  enableAuditLogging: boolean;
  enableConsentTracking: boolean;
  enableDataRetention: boolean;
  retentionPeriodDays: number;
  enableEncryption: boolean;
  logLevel: 'minimal' | 'standard' | 'detailed';
}

export interface SessionState {
  id: string;
  status: 'waiting' | 'active' | 'paused' | 'ended' | 'error';
  participants: SessionParticipant[];
  startTime?: Date;
  endTime?: Date;
  duration?: number; // in seconds
  isMinimized: boolean;
  isRecording: boolean;
  hasActiveScreenShare: boolean;
  currentSpeaker?: string;
  configuration: SessionConfiguration;
}

export interface MediaSettings {
  video: {
    enabled: boolean;
    resolution: '720p' | '1080p' | '4k';
    frameRate: number;
    bitrate: number;
  };
  audio: {
    enabled: boolean;
    noiseReduction: boolean;
    echoCancellation: boolean;
    autoGainControl: boolean;
  };
  screenShare: {
    enabled: boolean;
    includeAudio: boolean;
    quality: 'low' | 'medium' | 'high';
  };
}

export interface SessionInvitation {
  id: string;
  sessionId: string;
  invitedBy: string;
  inviteeEmail: string;
  inviteeName: string;
  role: SessionParticipant['role'];
  message?: string;
  expiresAt: Date;
  acceptedAt?: Date;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
}

export interface SessionEvent {
  id: string;
  sessionId: string;
  timestamp: Date;
  type: 'participant_joined' | 'participant_left' | 'screen_share_started' | 'screen_share_stopped' | 
        'recording_started' | 'recording_stopped' | 'session_paused' | 'session_resumed' | 
        'session_ended' | 'participant_muted' | 'participant_unmuted' | 'invitation_sent' |
        'technical_issue' | 'consent_given' | 'consent_revoked';
  participantId?: string;
  data?: Record<string, unknown>;
  complianceLevel: 'low' | 'medium' | 'high';
}

export interface TelehealthError {
  code: string;
  message: string;
  type: 'connection' | 'permission' | 'technical' | 'compliance' | 'validation';
  retryable: boolean;
  details?: Record<string, unknown>;
}

export interface SessionAnalytics {
  sessionId: string;
  totalDuration: number;
  participantCount: number;
  averageConnectionQuality: number;
  technicalIssuesCount: number;
  recordingDuration?: number;
  transcriptionAccuracy?: number;
  complianceScore: number;
}