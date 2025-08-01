/**
 * Telehealth Module Types
 * 
 * TypeScript type definitions for telehealth functionality including 
 * Jitsi integration, session management, and analytics.
 */

import { v4 as uuid } from 'uuid';

// ============================================================================
// Core Telehealth Types
// ============================================================================

/**
 * Telehealth session status
 */
export type TelehealthSessionStatus = 
  | 'scheduled'
  | 'waiting_room'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

/**
 * Session participant types
 */
export type ParticipantType = 'patient' | 'provider' | 'caregiver' | 'observer';

/**
 * Session recording status
 */
export type RecordingStatus = 'not_recorded' | 'recording' | 'recorded' | 'failed';

// ============================================================================
// Jitsi Integration Types
// ============================================================================

/**
 * Jitsi room configuration
 */
export interface JitsiRoomConfig {
  /** Unique room name generated from patient UUID */
  roomName: string;
  /** Display name for the room */
  displayName: string;
  /** Room password for additional security */
  password?: string;
  /** Maximum number of participants */
  maxParticipants?: number;
  /** Enable recording */
  enableRecording?: boolean;
  /** Room expiration time */
  expiresAt?: Date;
  /** Room configuration options */
  options?: JitsiRoomOptions;
}

/**
 * Jitsi room options
 */
export interface JitsiRoomOptions {
  /** Enable lobby/waiting room */
  enableLobby?: boolean;
  /** Require password to join */
  requirePassword?: boolean;
  /** Enable chat */
  enableChat?: boolean;
  /** Enable screen sharing */
  enableScreenSharing?: boolean;
  /** Enable audio mute/unmute */
  enableAudioMute?: boolean;
  /** Enable video mute/unmute */
  enableVideoMute?: boolean;
  /** Background blur/replacement */
  enableBackgroundFeatures?: boolean;
  /** Noise suppression */
  enableNoiseSuppression?: boolean;
}

/**
 * Jitsi room link information
 */
export interface JitsiRoomLink {
  /** Full Jitsi room URL */
  roomUrl: string;
  /** Room name/ID */
  roomName: string;
  /** Join link for web clients */
  webLink: string;
  /** Join link for mobile apps */
  mobileLink?: string;
  /** Room access token if applicable */
  accessToken?: string;
  /** Link expiration time */
  expiresAt?: Date;
}

// ============================================================================
// Telehealth Session Types
// ============================================================================

/**
 * Core telehealth session information
 */
export interface TelehealthSession {
  /** Unique session ID */
  id: string;
  /** Patient UUID (used for Jitsi room generation) */
  patientId: string;
  /** Provider ID */
  providerId: string;
  /** Session status */
  status: TelehealthSessionStatus;
  /** Scheduled start time */
  scheduledStartTime: Date;
  /** Actual start time */
  actualStartTime?: Date;
  /** Session end time */
  endTime?: Date;
  /** Session duration in minutes */
  durationMinutes?: number;
  /** Jitsi room configuration */
  jitsiRoom: JitsiRoomConfig;
  /** Session participants */
  participants: SessionParticipant[];
  /** Session metadata */
  metadata: SessionMetadata;
  /** Recording information */
  recording?: SessionRecording;
  /** Session notes */
  notes?: string;
  /** Session chief complaint */
  chiefComplaint?: string;
  /** Associated appointment ID */
  appointmentId?: string;
}

/**
 * Session participant information
 */
export interface SessionParticipant {
  /** Participant ID */
  id: string;
  /** Participant type */
  type: ParticipantType;
  /** Participant name */
  name: string;
  /** Email address */
  email?: string;
  /** Join time */
  joinedAt?: Date;
  /** Leave time */
  leftAt?: Date;
  /** Connection quality metrics */
  connectionQuality?: ConnectionQuality;
  /** Device information */
  deviceInfo?: DeviceInfo;
}

/**
 * Session metadata for analytics
 */
export interface SessionMetadata {
  /** Session creation timestamp */
  createdAt: Date;
  /** Last updated timestamp */
  updatedAt: Date;
  /** Session language/locale */
  locale: string;
  /** Time zone */
  timeZone: string;
  /** Session quality metrics */
  qualityMetrics?: QualityMetrics;
  /** Technical session info */
  technicalInfo?: TechnicalSessionInfo;
  /** Compliance and audit info */
  auditInfo?: AuditInfo;
}

/**
 * Session recording information
 */
export interface SessionRecording {
  /** Recording ID */
  id: string;
  /** Recording status */
  status: RecordingStatus;
  /** Recording start time */
  startTime?: Date;
  /** Recording end time */
  endTime?: Date;
  /** Recording file URL */
  fileUrl?: string;
  /** Recording file size in bytes */
  fileSizeBytes?: number;
  /** Recording duration in seconds */
  durationSeconds?: number;
  /** Transcription if available */
  transcription?: RecordingTranscription;
  /** Recording consent information */
  consent: RecordingConsent;
}

/**
 * Recording transcription information
 */
export interface RecordingTranscription {
  /** Transcription ID */
  id: string;
  /** Transcribed text */
  text: string;
  /** Original language detected */
  originalLanguage: string;
  /** Translations to other languages */
  translations?: { [languageCode: string]: string };
  /** Confidence score (0-1) */
  confidence?: number;
  /** Processing timestamp */
  processedAt: Date;
  /** Whisper service metadata */
  whisperMetadata?: WhisperTranscriptionMetadata;
}

/**
 * Whisper transcription metadata
 */
export interface WhisperTranscriptionMetadata {
  /** Whisper model used */
  model: string;
  /** Processing duration */
  processingDurationMs: number;
  /** File size processed */
  fileSizeBytes: number;
  /** Audio duration */
  audioDurationSeconds: number;
  /** Language detected by Whisper */
  detectedLanguage: string;
  /** Confidence scores by segment */
  segmentConfidences?: number[];
}

/**
 * Recording consent information
 */
export interface RecordingConsent {
  /** Whether consent was obtained */
  consentObtained: boolean;
  /** Consent timestamp */
  consentTimestamp?: Date;
  /** Who provided consent */
  consentProvidedBy?: string;
  /** Consent method */
  consentMethod?: 'verbal' | 'digital_signature' | 'checkbox';
  /** Consent expiration */
  consentExpiresAt?: Date;
}

// ============================================================================
// Quality and Technical Metrics
// ============================================================================

/**
 * Connection quality metrics
 */
export interface ConnectionQuality {
  /** Audio quality score (0-5) */
  audioQuality: number;
  /** Video quality score (0-5) */
  videoQuality: number;
  /** Network latency in ms */
  latencyMs: number;
  /** Packet loss percentage */
  packetLossPercent: number;
  /** Bandwidth usage in kbps */
  bandwidthKbps: number;
  /** Connection stability score (0-1) */
  stabilityScore: number;
}

/**
 * Device information
 */
export interface DeviceInfo {
  /** Device type */
  deviceType: 'desktop' | 'mobile' | 'tablet';
  /** Operating system */
  operatingSystem: string;
  /** Browser information */
  browser: string;
  /** Camera capabilities */
  cameraInfo?: {
    hasCamera: boolean;
    resolution?: string;
    frameRate?: number;
  };
  /** Microphone capabilities */
  microphoneInfo?: {
    hasMicrophone: boolean;
    audioDevices?: string[];
  };
  /** Network information */
  networkInfo?: {
    connectionType: string;
    downlinkSpeed?: number;
    uplinkSpeed?: number;
  };
}

/**
 * Session quality metrics
 */
export interface QualityMetrics {
  /** Overall session quality score (0-5) */
  overallQuality: number;
  /** Audio quality metrics */
  audioMetrics: {
    averageQuality: number;
    dropouts: number;
    noiseLevel: number;
  };
  /** Video quality metrics */
  videoMetrics: {
    averageQuality: number;
    freezes: number;
    resolution: string;
    frameRate: number;
  };
  /** Network performance */
  networkMetrics: {
    averageLatency: number;
    maxLatency: number;
    averagePacketLoss: number;
    maxPacketLoss: number;
    disconnections: number;
  };
}

/**
 * Technical session information
 */
export interface TechnicalSessionInfo {
  /** Jitsi server used */
  jitsiServer: string;
  /** Protocol version */
  protocolVersion: string;
  /** Codec information */
  codecInfo: {
    audioCodec: string;
    videoCodec: string;
  };
  /** Server region */
  serverRegion: string;
  /** Load balancer info */
  loadBalancer?: string;
}

/**
 * Audit information for compliance
 */
export interface AuditInfo {
  /** HIPAA compliance flags */
  hipaaCompliant: boolean;
  /** Data encryption status */
  encrypted: boolean;
  /** Audit trail entries */
  auditTrail: AuditEntry[];
  /** Compliance officer approval */
  complianceApproval?: {
    approvedBy: string;
    approvedAt: Date;
    notes?: string;
  };
}

/**
 * Individual audit trail entry
 */
export interface AuditEntry {
  /** Entry ID */
  id: string;
  /** Action performed */
  action: string;
  /** Who performed the action */
  performedBy: string;
  /** When the action was performed */
  timestamp: Date;
  /** Additional details */
  details?: Record<string, unknown>;
  /** IP address */
  ipAddress?: string;
  /** User agent */
  userAgent?: string;
}

// ============================================================================
// Dashboard and Analytics Types
// ============================================================================

/**
 * Telehealth dashboard data
 */
export interface TelehealthDashboardData {
  /** Summary statistics */
  summary: DashboardSummary;
  /** Recent sessions */
  recentSessions: TelehealthSession[];
  /** Usage analytics */
  analytics: UsageAnalytics;
  /** Quality insights */
  qualityInsights: QualityInsights;
  /** Provider performance */
  providerMetrics?: ProviderTelehealthMetrics;
}

/**
 * Dashboard summary statistics
 */
export interface DashboardSummary {
  /** Total sessions */
  totalSessions: number;
  /** Sessions today */
  sessionsToday: number;
  /** Sessions this week */
  sessionsThisWeek: number;
  /** Sessions this month */
  sessionsThisMonth: number;
  /** Average session duration */
  averageSessionDuration: number;
  /** No-show rate */
  noShowRate: number;
  /** Completion rate */
  completionRate: number;
  /** Patient satisfaction score */
  patientSatisfaction?: number;
}

/**
 * Usage analytics data
 */
export interface UsageAnalytics {
  /** Sessions by day/week/month */
  sessionsByPeriod: {
    period: string;
    count: number;
    date: Date;
  }[];
  /** Sessions by hour of day */
  sessionsByHour: { hour: number; count: number }[];
  /** Device type distribution */
  deviceTypes: { type: string; count: number; percentage: number }[];
  /** Geographic distribution */
  geographicData?: { region: string; count: number }[];
  /** Language/locale distribution */
  localeDistribution: { locale: string; count: number; percentage: number }[];
}

/**
 * Quality insights data
 */
export interface QualityInsights {
  /** Average quality score over time */
  qualityTrend: {
    date: Date;
    score: number;
  }[];
  /** Common quality issues */
  commonIssues: {
    issue: string;
    frequency: number;
    impact: 'low' | 'medium' | 'high';
  }[];
  /** Quality by device type */
  qualityByDevice: {
    deviceType: string;
    averageQuality: number;
    sampleSize: number;
  }[];
  /** Network performance trends */
  networkTrends: {
    date: Date;
    averageLatency: number;
    averagePacketLoss: number;
  }[];
}

/**
 * Provider telehealth performance metrics
 */
export interface ProviderTelehealthMetrics {
  /** Provider ID */
  providerId: string;
  /** Reporting period */
  reportingPeriod: {
    startDate: Date;
    endDate: Date;
  };
  /** Session statistics */
  sessionStats: {
    totalSessions: number;
    completedSessions: number;
    cancelledSessions: number;
    noShowSessions: number;
    averageDuration: number;
  };
  /** Quality metrics */
  qualityMetrics: {
    averageQuality: number;
    patientSatisfaction: number;
    technicalIssues: number;
  };
  /** Efficiency metrics */
  efficiencyMetrics: {
    onTimeStartRate: number;
    sessionUtilization: number;
    patientWaitTime: number;
  };
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Telehealth API response wrapper
 */
export interface TelehealthApiResponse<T = unknown> {
  /** Success status */
  success: boolean;
  /** Response data */
  data?: T;
  /** Error information */
  error?: {
    code: string;
    message: string;
    details?: string;
  };
  /** Response metadata */
  metadata?: {
    requestId: string;
    timestamp: Date;
    processingTimeMs: number;
  };
}

/**
 * Session creation request
 */
export interface CreateSessionRequest {
  /** Patient ID */
  patientId: string;
  /** Provider ID */
  providerId: string;
  /** Scheduled start time */
  scheduledStartTime: Date;
  /** Session duration in minutes */
  durationMinutes: number;
  /** Chief complaint */
  chiefComplaint?: string;
  /** Session notes */
  notes?: string;
  /** Room configuration */
  roomConfig?: Partial<JitsiRoomOptions>;
  /** Recording settings */
  recordingConfig?: {
    enabled: boolean;
    requireConsent: boolean;
  };
  /** Associated appointment ID */
  appointmentId?: string;
}

/**
 * Session search criteria
 */
export interface SessionSearchCriteria {
  /** Patient ID filter */
  patientId?: string;
  /** Provider ID filter */
  providerId?: string;
  /** Status filter */
  status?: TelehealthSessionStatus[];
  /** Date range filter */
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  /** Search text */
  searchText?: string;
  /** Pagination */
  page?: number;
  /** Page size */
  pageSize?: number;
  /** Sort options */
  sortBy?: 'scheduledStartTime' | 'actualStartTime' | 'durationMinutes' | 'status';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// Utility Functions and Helpers
// ============================================================================

/**
 * Generate a secure Jitsi room name from patient UUID
 */
export function generateRoomName(patientId: string, sessionId?: string): string {
  // Create a deterministic but secure room name
  const baseId = sessionId || uuid();
  const timestamp = new Date().getTime();
  return `webqx-${patientId.slice(0, 8)}-${baseId.slice(0, 8)}-${timestamp.toString(36)}`;
}

/**
 * Validate telehealth session data
 */
export function validateSession(session: Partial<TelehealthSession>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!session.patientId) {
    errors.push('Patient ID is required');
  }

  if (!session.providerId) {
    errors.push('Provider ID is required');
  }

  if (!session.scheduledStartTime) {
    errors.push('Scheduled start time is required');
  }

  if (session.scheduledStartTime && session.scheduledStartTime < new Date()) {
    errors.push('Scheduled start time cannot be in the past');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Calculate session duration in minutes
 */
export function calculateSessionDuration(startTime: Date, endTime: Date): number {
  return Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
}

/**
 * Generate session summary for display
 */
export function generateSessionSummary(session: TelehealthSession): string {
  const duration = session.durationMinutes || 0;
  const participants = session.participants.length;
  const status = session.status.replace('_', ' ').toLowerCase();
  
  return `${duration} min session with ${participants} participant${participants !== 1 ? 's' : ''} - ${status}`;
}