/**
 * WebQX™ Telehealth Module - Type Definitions
 * 
 * Comprehensive type definitions for telehealth functionality including
 * video consultations, messaging, and optimized FHIR synchronization.
 */

// ============================================================================
// Network and Connection Types
// ============================================================================

export interface NetworkConditions {
  /** Current bandwidth in Kbps */
  bandwidthKbps: number;
  /** Round-trip time in milliseconds */
  rttMs: number;
  /** Packet loss percentage (0-100) */
  packetLossPercent: number;
  /** Connection stability score (0-100) */
  stabilityScore: number;
  /** Connection type (wifi, cellular, ethernet, etc.) */
  connectionType: 'wifi' | 'cellular' | 'ethernet' | 'bluetooth' | 'unknown';
  /** Signal strength for wireless connections (0-100) */
  signalStrength?: number;
}

export interface QualitySettings {
  /** Video resolution */
  resolution: '144p' | '240p' | '360p' | '480p' | '720p' | '1080p';
  /** Video framerate */
  framerate: 15 | 24 | 30 | 60;
  /** Video bitrate in Kbps */
  videoBitrateKbps: number;
  /** Audio bitrate in Kbps */
  audioBitrateKbps: number;
  /** Enable/disable video */
  videoEnabled: boolean;
  /** Enable/disable audio */
  audioEnabled: boolean;
  /** Enable/disable screen sharing */
  screenShareEnabled: boolean;
}

export interface NetworkThresholds {
  /** Minimum bitrate for basic functionality */
  minBitrateKbps: number;
  /** Optimal bitrate for good quality */
  optimalBitrateKbps: number;
  /** Maximum bitrate for best quality */
  maxBitrateKbps: number;
  /** Threshold for fallback to audio-only */
  audioOnlyThresholdKbps: number;
  /** Threshold for fallback to text */
  textFallbackThresholdKbps: number;
}

// ============================================================================
// Consultation and Session Types
// ============================================================================

export interface ConsultationSession {
  /** Unique session identifier */
  sessionId: string;
  /** Patient FHIR ID */
  patientId: string;
  /** Provider FHIR ID */
  providerId: string;
  /** Type of consultation */
  consultationType: 'routine-checkup' | 'follow-up' | 'urgent-care' | 'mental-health' | 'specialty-consult';
  /** Current session status */
  status: 'scheduled' | 'starting' | 'active' | 'paused' | 'ended' | 'failed';
  /** Start time of session */
  startTime: Date;
  /** End time of session */
  endTime?: Date;
  /** Current communication mode */
  mode: 'video' | 'audio' | 'text' | 'hybrid';
  /** Session metadata */
  metadata: {
    /** Appointment ID if applicable */
    appointmentId?: string;
    /** Specialty context */
    specialty?: string;
    /** Priority level */
    priority: 'low' | 'medium' | 'high' | 'urgent';
    /** Language preference */
    language: string;
    /** Patient location/timezone */
    timezone: string;
  };
  /** Quality metrics */
  qualityMetrics: {
    /** Average bandwidth during session */
    avgBandwidthKbps: number;
    /** Connection interruptions count */
    interruptions: number;
    /** Quality degradations count */
    degradations: number;
    /** Fallback events */
    fallbackEvents: FallbackEvent[];
  };
}

export interface FallbackEvent {
  /** When the fallback occurred */
  timestamp: Date;
  /** Reason for fallback */
  reason: 'network-poor' | 'network-failed' | 'device-issue' | 'user-preference';
  /** From which mode */
  fromMode: 'video' | 'audio' | 'text';
  /** To which mode */
  toMode: 'video' | 'audio' | 'text';
  /** Network conditions at time of fallback */
  networkConditions: NetworkConditions;
}

export interface ConsultationOptions {
  /** Patient ID */
  patientId: string;
  /** Provider ID */
  providerId: string;
  /** Type of consultation */
  consultationType: ConsultationSession['consultationType'];
  /** Enable automatic fallback */
  enableFallback: boolean;
  /** Preferred language */
  language?: string;
  /** Enable recording */
  enableRecording?: boolean;
  /** Enable screen sharing */
  enableScreenShare?: boolean;
  /** Custom metadata */
  metadata?: Record<string, any>;
}

// ============================================================================
// Video and Jitsi Types
// ============================================================================

export interface JitsiConfig {
  /** Jitsi domain */
  domain: string;
  /** Application ID */
  appId: string;
  /** JWT app ID for secure rooms */
  jwtAppId?: string;
  /** JWT secret for secure rooms */
  jwtSecret?: string;
  /** Default room options */
  defaultRoomOptions: {
    /** Enable lobby mode */
    enableLobby: boolean;
    /** Require password */
    requirePassword: boolean;
    /** Enable waiting room */
    enableWaitingRoom: boolean;
    /** Maximum participants */
    maxParticipants: number;
  };
  /** Server configuration */
  servers: {
    /** STUN servers */
    stun: string[];
    /** TURN servers */
    turn?: Array<{
      urls: string;
      username?: string;
      credential?: string;
    }>;
  };
}

export interface JitsiMeetAPI {
  /** Join a meeting */
  join(roomName: string, options: any): Promise<void>;
  /** Leave the current meeting */
  leave(): Promise<void>;
  /** Set video quality */
  setVideoQuality(quality: number): void;
  /** Get video quality */
  getVideoQuality(): number;
  /** Set audio muted */
  setAudioMuted(muted: boolean): void;
  /** Set video muted */
  setVideoMuted(muted: boolean): void;
  /** Start screen sharing */
  startScreenShare(): Promise<void>;
  /** Stop screen sharing */
  stopScreenShare(): Promise<void>;
  /** Get connection statistics */
  getConnectionStats(): Promise<any>;
  /** Add event listener */
  addEventListener(event: string, listener: Function): void;
  /** Remove event listener */
  removeEventListener(event: string, listener: Function): void;
}

export interface VideoCallMetrics {
  /** Current video quality */
  videoQuality: QualitySettings['resolution'];
  /** Current framerate */
  framerate: number;
  /** Video bitrate */
  videoBitrate: number;
  /** Audio bitrate */
  audioBitrate: number;
  /** Packet loss percentage */
  packetLoss: number;
  /** Jitter in milliseconds */
  jitter: number;
  /** Round-trip time */
  rtt: number;
  /** Number of participants */
  participantCount: number;
  /** Connection state */
  connectionState: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
}

// ============================================================================
// Messaging and Text Consultation Types
// ============================================================================

export interface ConsultationMessage {
  /** Message ID */
  messageId: string;
  /** Session ID */
  sessionId: string;
  /** Sender ID (patient or provider) */
  senderId: string;
  /** Sender role */
  senderRole: 'patient' | 'provider' | 'admin' | 'system';
  /** Message type */
  type: 'text' | 'voice' | 'image' | 'document' | 'vital-signs' | 'prescription' | 'system';
  /** Message content */
  content: string;
  /** Timestamp */
  timestamp: Date;
  /** Message metadata */
  metadata?: {
    /** Attachment URLs */
    attachments?: string[];
    /** Voice note duration */
    voiceDurationMs?: number;
    /** Medical context */
    medicalContext?: {
      /** Related FHIR resources */
      relatedResources?: string[];
      /** Clinical tags */
      tags?: string[];
      /** Urgency level */
      urgency?: 'low' | 'medium' | 'high';
    };
  };
  /** Delivery status */
  deliveryStatus: 'sending' | 'delivered' | 'read' | 'failed';
  /** Encryption status */
  encrypted: boolean;
}

export interface StructuredConsultation {
  /** Consultation ID */
  consultationId: string;
  /** Session ID */
  sessionId: string;
  /** Consultation template/workflow */
  template: ConsultationTemplate;
  /** Current step in the workflow */
  currentStep: number;
  /** Responses to workflow steps */
  responses: StructuredResponse[];
  /** Overall status */
  status: 'in-progress' | 'completed' | 'abandoned';
  /** Start time */
  startTime: Date;
  /** Completion time */
  completionTime?: Date;
}

export interface ConsultationTemplate {
  /** Template ID */
  templateId: string;
  /** Template name */
  name: string;
  /** Specialty it belongs to */
  specialty: string;
  /** Consultation type */
  consultationType: string;
  /** Workflow steps */
  steps: ConsultationStep[];
  /** Estimated duration */
  estimatedDurationMinutes: number;
}

export interface ConsultationStep {
  /** Step ID */
  stepId: string;
  /** Step title */
  title: string;
  /** Step description */
  description: string;
  /** Type of response expected */
  responseType: 'text' | 'multiple-choice' | 'numeric' | 'date' | 'file-upload' | 'vital-signs';
  /** Whether step is required */
  required: boolean;
  /** Options for multiple-choice */
  options?: string[];
  /** Validation rules */
  validation?: {
    /** Minimum length for text */
    minLength?: number;
    /** Maximum length for text */
    maxLength?: number;
    /** Numeric range */
    numericRange?: { min: number; max: number };
    /** Pattern for validation */
    pattern?: string;
  };
}

export interface StructuredResponse {
  /** Step ID this response is for */
  stepId: string;
  /** Response value */
  value: string | number | Date | string[];
  /** Timestamp of response */
  timestamp: Date;
  /** Provider notes/comments */
  providerNotes?: string;
}

// ============================================================================
// FHIR Optimization Types
// ============================================================================

export interface FHIRBatchConfig {
  /** Maximum batch size */
  maxBatchSize: number;
  /** Enable compression */
  enableCompression: boolean;
  /** Compression threshold in bytes */
  compressionThreshold: number;
  /** Enable differential sync */
  enableDifferentialSync: boolean;
  /** Sync interval in milliseconds */
  syncIntervalMs: number;
  /** Retry configuration */
  retry: {
    /** Maximum retry attempts */
    maxAttempts: number;
    /** Initial delay in milliseconds */
    initialDelayMs: number;
    /** Backoff multiplier */
    backoffMultiplier: number;
  };
}

export interface BatchOperation {
  /** Operation type */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** Resource URL */
  url: string;
  /** Resource data for POST/PUT */
  resource?: any;
  /** If-Match header for conditional operations */
  ifMatch?: string;
  /** If-None-Match header */
  ifNoneMatch?: string;
}

export interface BatchResponse {
  /** Success status */
  success: boolean;
  /** Response status code */
  statusCode: number;
  /** Response data */
  data?: any;
  /** Error information */
  error?: {
    /** Error code */
    code: string;
    /** Error message */
    message: string;
    /** Additional details */
    details?: any;
  };
}

export interface SyncMetadata {
  /** Last sync timestamp */
  lastSync: Date;
  /** Resources to sync */
  resources: string[];
  /** Change tracking */
  changes: {
    /** Added resource IDs */
    added: string[];
    /** Modified resource IDs */
    modified: string[];
    /** Deleted resource IDs */
    deleted: string[];
  };
  /** Sync priority */
  priority: 'low' | 'medium' | 'high';
}

export interface CompressionResult {
  /** Original size in bytes */
  originalSize: number;
  /** Compressed size in bytes */
  compressedSize: number;
  /** Compression ratio */
  compressionRatio: number;
  /** Compression algorithm used */
  algorithm: 'gzip' | 'deflate' | 'brotli';
  /** Time taken to compress in milliseconds */
  compressionTimeMs: number;
}

// ============================================================================
// Main Configuration Types
// ============================================================================

export interface TelehealthConfig {
  /** Jitsi configuration */
  jitsiConfig: JitsiConfig;
  /** Network thresholds */
  networkThresholds: NetworkThresholds;
  /** FHIR configuration */
  fhirConfig: FHIRBatchConfig & {
    /** FHIR server base URL */
    baseUrl: string;
    /** Authentication configuration */
    auth?: {
      /** OAuth2 token */
      accessToken?: string;
      /** Token refresh callback */
      refreshToken?: () => Promise<string>;
    };
  };
  /** Messaging configuration */
  messagingConfig?: {
    /** Matrix homeserver URL */
    matrixServer?: string;
    /** Enable end-to-end encryption */
    enableE2EE: boolean;
    /** Message retention period in days */
    messageRetentionDays: number;
  };
  /** Recording configuration */
  recordingConfig?: {
    /** Enable session recording */
    enableRecording: boolean;
    /** Storage provider */
    storageProvider: 'local' | 's3' | 'azure' | 'gcp';
    /** Storage configuration */
    storageConfig: Record<string, any>;
    /** Retention period in days */
    retentionDays: number;
  };
  /** Compliance configuration */
  complianceConfig: {
    /** Enable audit logging */
    enableAuditLogging: boolean;
    /** Audit log retention in days */
    auditRetentionDays: number;
    /** Enable consent tracking */
    enableConsentTracking: boolean;
    /** Data encryption requirements */
    encryptionRequired: boolean;
  };
}

// ============================================================================
// Event Types
// ============================================================================

export interface TelehealthEvent {
  /** Event type */
  type: string;
  /** Event timestamp */
  timestamp: Date;
  /** Session ID */
  sessionId: string;
  /** Event data */
  data: any;
}

export interface NetworkEvent extends TelehealthEvent {
  type: 'network-change' | 'bandwidth-change' | 'connection-lost' | 'connection-restored' | 'network-monitoring-started' | 'network-monitoring-stopped';
  data: NetworkConditions;
}

export interface VideoEvent extends TelehealthEvent {
  type: 'video-quality-change' | 'video-started' | 'video-stopped' | 'screen-share-started' | 'screen-share-stopped';
  data: VideoCallMetrics | QualitySettings;
}

export interface MessageEvent extends TelehealthEvent {
  type: 'message-sent' | 'message-received' | 'message-delivered' | 'message-read';
  data: ConsultationMessage;
}

export interface SessionEvent extends TelehealthEvent {
  type: 'session-started' | 'session-ended' | 'session-paused' | 'session-resumed' | 'fallback-triggered';
  data: ConsultationSession | FallbackEvent;
}

// ============================================================================
// Utility Types
// ============================================================================

export type EventCallback<T extends TelehealthEvent = TelehealthEvent> = (event: T) => void;

export type NetworkQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'disconnected';

export type ConsultationMode = 'video' | 'audio' | 'text' | 'hybrid';

export type UserRole = 'patient' | 'provider' | 'admin' | 'system';

// ============================================================================
// Error Types
// ============================================================================

export class TelehealthError extends Error {
  /** Error code */
  code: string;
  /** Error category */
  category: 'network' | 'video' | 'audio' | 'sync' | 'auth' | 'config' | 'unknown';
  /** Whether error is recoverable */
  recoverable: boolean;
  /** Additional error context */
  context?: Record<string, any>;

  constructor(message: string, options: {
    name: string;
    code: string;
    category: TelehealthError['category'];
    recoverable: boolean;
    context?: Record<string, any>;
  }) {
    super(message);
    this.name = options.name;
    this.code = options.code;
    this.category = options.category;
    this.recoverable = options.recoverable;
    this.context = options.context;
  }
}