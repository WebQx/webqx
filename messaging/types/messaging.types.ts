/**
 * WebQX™ Messaging Type Definitions
 * 
 * TypeScript type definitions for the Matrix-based messaging infrastructure.
 * Provides type safety and IntelliSense for healthcare communication features.
 */

// Matrix Client Types
export interface MatrixClientOptions {
  homeserverUrl: string;
  accessToken: string;
  userId: string;
  deviceId?: string;
  enableE2EE?: boolean;
  sessionStore?: any;
  cryptoStore?: any;
}

export interface MatrixMessagingOptions extends MatrixClientOptions {
  enableStrictValidation?: boolean;
  maxMessageLength?: number;
  maxFileSize?: number;
  allowedFileTypes?: string[];
  enableContentScanning?: boolean;
}

// Core Messaging Types
export interface WebQXMessage {
  body: string;
  msgtype: MessageType;
  format?: string;
  formatted_body?: string;
  'webqx.metadata'?: WebQXMessageMetadata;
}

export type MessageType = 
  | 'm.text' 
  | 'm.emote' 
  | 'm.notice' 
  | 'm.file' 
  | 'm.image' 
  | 'm.audio' 
  | 'm.video';

export interface WebQXMessageMetadata {
  patientId?: string;
  providerId?: string;
  specialty?: Specialty;
  timestamp: string;
  urgency?: UrgencyLevel;
  documentType?: DocumentType;
  senderId?: string;
  channelType?: ChannelType;
  messageType?: string;
  clinicalContext?: ClinicalContext;
  caseId?: string;
  consultationId?: string;
}

export type UrgencyLevel = 'low' | 'normal' | 'high' | 'critical';
export type ChannelType = 'patient-provider' | 'provider-admin' | 'specialty' | 'consultation' | 'emergency';

// Specialty Types
export type Specialty = 
  | 'primary-care'
  | 'radiology' 
  | 'cardiology'
  | 'psychiatry'
  | 'oncology'
  | 'pediatrics'
  | 'neurology'
  | 'pulmonology'
  | 'gastroenterology'
  | 'dermatology'
  | 'orthopedics'
  | 'endocrinology'
  | 'obgyn';

export interface SpecialtyConfig {
  displayName: string;
  description: string;
  defaultMembers?: string[];
  retentionDays: number;
  enableFileSharing: boolean;
  allowedFileTypes?: string[];
  requireExtraVerification?: boolean;
  requireParentalConsent?: boolean;
}

// Channel Types
export interface ChannelOptions {
  name: string;
  topic?: string;
  channelType: ChannelType;
  specialty?: Specialty;
  isDirect?: boolean;
  visibility?: 'private' | 'public';
  inviteUsers?: string[];
  disableEncryption?: boolean;
  matrixOptions?: any;
}

export interface ChannelMetadata {
  roomId: string;
  channelType: ChannelType;
  specialty?: Specialty;
  createdBy: string;
  createdAt: string;
  isActive: boolean;
  lastActivity: string;
  memberCount: number;
  messageCount?: number;
}

// Patient-Provider Channel Types
export interface PatientProviderChannelMetadata extends ChannelMetadata {
  patientId: string;
  providerId: string;
  careTeamMembers: CareTeamMember[];
  specialty?: Specialty;
}

export interface CareTeamMember {
  userId: string;
  role: CareTeamRole;
  addedBy: string;
  addedAt: string;
}

export type CareTeamRole = 'primary_care' | 'specialist' | 'nurse' | 'therapist' | 'care_coordinator';

// Admin Channel Types
export interface AdminChannelMetadata extends ChannelMetadata {
  adminId: string;
  department?: string;
  isBroadcast: boolean;
  requiresApproval: boolean;
}

export interface BroadcastMessage {
  broadcastId: string;
  senderId: string;
  broadcastType: BroadcastType;
  department?: string;
  specialty?: Specialty;
  timestamp: string;
  priority: UrgencyLevel;
  expiresAt?: string;
  requiresAck: boolean;
}

export type BroadcastType = 'general' | 'policy' | 'emergency' | 'maintenance' | 'training';

// Consultation Types
export interface ConsultationMetadata extends ChannelMetadata {
  consultationId: string;
  primarySpecialty: Specialty;
  consultingSpecialty: Specialty;
  requestedBy: string;
  patientId?: string;
  caseId?: string;
  urgency: UrgencyLevel;
  consultationReason?: string;
  status: ConsultationStatus;
  expectedResponseTime: string;
  participants: ConsultationParticipant[];
  acceptedAt?: string;
  acceptedBy?: string;
  completedAt?: string;
  completedBy?: string;
  recommendations?: string;
  followUpRequired?: boolean;
  followUpDate?: string;
}

export type ConsultationStatus = 'pending' | 'active' | 'completed' | 'cancelled';

export interface ConsultationParticipant {
  userId: string;
  role: ConsultationRole;
  specialty: Specialty;
  addedBy: string;
  addedAt: string;
}

export type ConsultationRole = 'requester' | 'consultant' | 'observer' | 'supervisor';

// File and Document Types
export interface WebQXFile {
  name: string;
  size: number;
  type: string;
  lastModified?: number;
}

export interface FileUploadOptions {
  filename?: string;
  patientId?: string;
  providerId?: string;
  isHealthcareDocument?: boolean;
  documentType?: DocumentType;
  senderId?: string;
  specialty?: Specialty;
  consultationId?: string;
}

export type DocumentType = 
  | 'lab_result'
  | 'prescription'
  | 'imaging'
  | 'chart_note'
  | 'consent_form'
  | 'insurance_card'
  | 'referral'
  | 'specialty_document'
  | 'general';

// Clinical Context Types
export interface ClinicalContext {
  diagnosisCode?: string;
  procedureCode?: string;
  visitType?: string;
  chiefComplaint?: string;
  symptoms?: string[];
  medications?: string[];
  allergies?: string[];
}

export interface ImagingResult {
  studyId: string;
  modality: ImagingModality;
  bodyPart: string;
  findings?: string;
  impression?: string;
  recommendations?: string;
  urgency: UrgencyLevel;
}

export type ImagingModality = 'CT' | 'MRI' | 'X-RAY' | 'ULTRASOUND' | 'MAMMOGRAM' | 'PET' | 'NUCLEAR';

export interface LabResult {
  testId: string;
  testName: string;
  value: string;
  referenceRange?: string;
  status: LabStatus;
  collectedAt: string;
  resultedAt: string;
}

export type LabStatus = 'normal' | 'abnormal' | 'critical' | 'pending';

// Encryption Types
export interface EncryptionOptions {
  enableDeviceVerification?: boolean;
  enableCrossSigning?: boolean;
  keyBackupEnabled?: boolean;
}

export interface EncryptionStatus {
  isEncrypted: boolean;
  algorithm?: string;
  rotationPeriodMs?: number;
  rotationPeriodMsgs?: number;
}

export interface DeviceTrustInfo {
  verified: boolean;
  verifiedAt: string;
}

// Validation Types
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedContent?: any;
  sanitizedData?: any;
}

export interface ValidationOptions {
  requirePatientId?: boolean;
  requireProviderId?: boolean;
  allowCritical?: boolean;
  isHealthcareDocument?: boolean;
  documentType?: DocumentType;
  patientId?: string;
}

// Audit Types
export interface AuditEntry {
  timestamp: string;
  sessionId: string;
  category: AuditCategory;
  event: string;
  severity: AuditSeverity;
  details: Record<string, any>;
  source: string;
  version: string;
  id: string;
}

export type AuditCategory = 
  | 'info' 
  | 'warning' 
  | 'error' 
  | 'security' 
  | 'compliance' 
  | 'system' 
  | 'channel' 
  | 'message' 
  | 'file' 
  | 'membership' 
  | 'crypto' 
  | 'sync' 
  | 'plugin' 
  | 'policy' 
  | 'admin_message' 
  | 'broadcast' 
  | 'approval' 
  | 'specialty_channel' 
  | 'specialty_message' 
  | 'specialty_document' 
  | 'consultation';

export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface AuditStats {
  totalLogs: number;
  sessionId: string;
  sessionStartTime: string;
  last24Hours: number;
  lastHour: number;
  categoryCounts: Record<string, number>;
  severityCounts: Record<string, number>;
  oldestLog?: string;
  newestLog?: string;
}

// Plugin Types
export interface MessagingPlugin {
  name: string;
  version: string;
  enabled: boolean;
  onMessage?(message: WebQXMessage, channel: any): Promise<void>;
  onChannelJoin?(userId: string, channelId: string): Promise<void>;
  onChannelLeave?(userId: string, channelId: string): Promise<void>;
  onEncryptedMessage?(event: any): Promise<void>;
  onFileUpload?(file: WebQXFile, options: FileUploadOptions): Promise<void>;
  onAuditEvent?(entry: AuditEntry): Promise<void>;
}

export interface PluginConfig {
  enabled: boolean;
  config: Record<string, any>;
}

// Whisper Integration Types
export interface WhisperIntegrationConfig extends PluginConfig {
  config: {
    supportedLanguages: string[];
    maxAudioDurationMinutes: number;
    autoTranscribe: boolean;
  };
}

// EHR Integration Types
export interface EHRIntegrationConfig extends PluginConfig {
  config: {
    ehrSystems: string[];
    syncPatientData: boolean;
    autoCreateChannels: boolean;
  };
}

// FHIR Integration Types
export interface FHIRMessagingConfig extends PluginConfig {
  config: {
    fhirServerUrl: string;
    messageFormat: string;
    validateMessages: boolean;
  };
}

// Configuration Types
export interface WebQXMessagingConfig {
  MATRIX_HOMESERVER_URL: string;
  MATRIX_ACCESS_TOKEN: string;
  MATRIX_USER_ID: string;
  MATRIX_DEVICE_ID: string;
  MATRIX_ENABLE_E2EE: boolean;
  MATRIX_VERIFY_DEVICES: boolean;
  MATRIX_AUDIT_ENABLED: boolean;
  MATRIX_AUDIT_RETENTION_DAYS: number;
  WEBQX_EHR_INTEGRATION: boolean;
  WEBQX_WHISPER_INTEGRATION: boolean;
  WEBQX_FHIR_INTEGRATION: boolean;
  CHANNEL_DEFAULT_ENCRYPTION: boolean;
  MAX_FILE_SIZE_MB: number;
  ALLOWED_FILE_TYPES: string[];
  SPECIALTY_CHANNELS: Record<Specialty, SpecialtyConfig>;
  PLUGINS: Record<string, PluginConfig>;
}

// Status and Health Types
export interface MessagingStatus {
  isStarted: boolean;
  isConnected: boolean;
  userId: string;
  deviceId: string;
  encryptionEnabled: boolean;
  activeChannels: number;
  registeredPlugins: string[];
}

export interface ChannelStats {
  totalChannels: number;
  activeChannels: number;
  archivedChannels?: number;
  uniquePatients?: number;
  uniqueProviders?: number;
  specialtyDistribution?: Record<string, number>;
  averageCareTeamSize?: number;
}

export interface ConsultationStats {
  totalConsultations: number;
  activeConsultations: number;
  consultationStatsByStatus: Record<ConsultationStatus, number>;
  averageResponseTime: number; // in minutes
}

// Error Types
export interface MessagingError extends Error {
  code?: string;
  category?: 'validation' | 'permission' | 'network' | 'encryption' | 'configuration';
  details?: Record<string, any>;
}

// Event Types
export interface MessageEvent {
  eventId: string;
  roomId: string;
  sender: string;
  content: WebQXMessage;
  timestamp: string;
  encrypted: boolean;
}

export interface MembershipEvent {
  roomId: string;
  userId: string;
  membership: 'join' | 'leave' | 'invite' | 'ban';
  prevMembership?: string;
  timestamp: string;
}

// Utility Types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = 
  Pick<T, Exclude<keyof T, Keys>> & {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

// Re-exports for convenience
export { MatrixMessaging } from '../core/matrix-client';
export { EncryptionManager } from '../core/encryption';
export { AuditLogger } from '../utils/audit';
export { MessageValidator } from '../utils/validation';
export { PatientProviderChannel } from '../channels/patient-provider';
export { ProviderAdminChannel } from '../channels/provider-admin';
export { SpecialtyChannels } from '../channels/specialty-channels';