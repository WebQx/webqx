/**
 * Telehealth Module Types
 * 
 * TypeScript type definitions for telehealth session management,
 * including session states, invitation system, and portal integration.
 */

import { FHIRAppointment, FHIRPatient, FHIRPractitioner } from '../../ehr-integrations/types/fhir-r4';

// ============================================================================
// Core Telehealth Types
// ============================================================================

/**
 * Telehealth session status
 */
export type TelehealthSessionStatus = 
  | 'scheduled'
  | 'invitation_sent'
  | 'ready_to_start'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

/**
 * Session launch method
 */
export type SessionLaunchMethod = 
  | 'provider_initiated'
  | 'patient_portal'
  | 'email_invitation'
  | 'direct_link';

/**
 * Video platform types
 */
export type VideoPlatform = 
  | 'webrtc_native'
  | 'zoom'
  | 'teams'
  | 'webex'
  | 'custom';

// ============================================================================
// Telehealth Session Types
// ============================================================================

/**
 * Telehealth session configuration
 */
export interface TelehealthSession {
  /** Unique session ID */
  id: string;
  /** Associated appointment ID */
  appointmentId: string;
  /** Session status */
  status: TelehealthSessionStatus;
  /** Patient information */
  patient: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  /** Provider information */
  provider: {
    id: string;
    name: string;
    email: string;
  };
  /** Scheduled session time */
  scheduledDateTime: Date;
  /** Session duration in minutes */
  durationMinutes: number;
  /** Video platform configuration */
  platform: {
    type: VideoPlatform;
    meetingId?: string;
    joinUrl?: string;
    hostKey?: string;
    password?: string;
  };
  /** Session access URLs */
  accessUrls: {
    patient: string;
    provider: string;
    waiting_room?: string;
  };
  /** Session settings */
  settings: {
    recordingEnabled: boolean;
    chatEnabled: boolean;
    screenShareEnabled: boolean;
    waitingRoomEnabled: boolean;
    requiresPassword: boolean;
  };
  /** Creation and update timestamps */
  createdAt: Date;
  updatedAt: Date;
  /** Session start and end times (actual) */
  actualStartTime?: Date;
  actualEndTime?: Date;
  /** Session notes */
  notes?: string;
}

/**
 * Session invitation details
 */
export interface SessionInvitation {
  /** Invitation ID */
  id: string;
  /** Session ID */
  sessionId: string;
  /** Patient email */
  patientEmail: string;
  /** Invitation token for security */
  invitationToken: string;
  /** Email invitation status */
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'expired';
  /** Invitation URLs */
  invitationUrl: string;
  /** Email content */
  emailContent: {
    subject: string;
    htmlBody: string;
    textBody: string;
  };
  /** Timestamps */
  sentAt?: Date;
  expiresAt: Date;
  openedAt?: Date;
  clickedAt?: Date;
}

/**
 * Session creation request
 */
export interface CreateSessionRequest {
  /** Appointment ID to convert to telehealth */
  appointmentId: string;
  /** Video platform preference */
  platform?: VideoPlatform;
  /** Session settings */
  settings?: Partial<TelehealthSession['settings']>;
  /** Auto-send invitation */
  autoSendInvitation?: boolean;
  /** Custom invitation message */
  customMessage?: string;
}

/**
 * Session launch request
 */
export interface SessionLaunchRequest {
  /** Session ID */
  sessionId: string;
  /** User role launching the session */
  userRole: 'patient' | 'provider';
  /** User ID */
  userId: string;
  /** Launch method used */
  launchMethod: SessionLaunchMethod;
  /** Optional invitation token (for email launches) */
  invitationToken?: string;
}

/**
 * Session launch response
 */
export interface SessionLaunchResponse {
  /** Success status */
  success: boolean;
  /** Session access information */
  sessionAccess?: {
    joinUrl: string;
    displayName: string;
    userRole: 'patient' | 'provider';
    sessionId: string;
    expiresAt: Date;
  };
  /** Error information */
  error?: {
    code: string;
    message: string;
    details?: string;
  };
  /** Waiting room information */
  waitingRoom?: {
    enabled: boolean;
    estimatedWaitTime?: number;
    position?: number;
  };
}

// ============================================================================
// Provider Dashboard Types
// ============================================================================

/**
 * Patient search criteria for telehealth scheduling
 */
export interface PatientSearchCriteria {
  /** Search text (name, MRN, email) */
  searchText?: string;
  /** Date of birth */
  dateOfBirth?: Date;
  /** Medical record number */
  mrn?: string;
  /** Provider ID (for filtering assigned patients) */
  providerId?: string;
  /** Page size and number */
  pageSize?: number;
  page?: number;
}

/**
 * Patient search result
 */
export interface PatientSearchResult {
  /** Patient basic information */
  id: string;
  mrn: string;
  name: string;
  dateOfBirth: Date;
  email?: string;
  phone?: string;
  /** Last appointment info */
  lastAppointment?: {
    date: Date;
    provider: string;
    type: string;
  };
  /** Upcoming appointments */
  upcomingAppointments: number;
}

/**
 * Telehealth visit scheduling request
 */
export interface ScheduleTelehealthRequest {
  /** Patient ID */
  patientId: string;
  /** Provider ID */
  providerId: string;
  /** Scheduled date and time */
  scheduledDateTime: Date;
  /** Duration in minutes */
  durationMinutes: number;
  /** Visit reason */
  reason: string;
  /** Visit type */
  visitType: string;
  /** Priority level */
  priority?: 'routine' | 'urgent' | 'emergent';
  /** Additional notes */
  notes?: string;
  /** Platform preference */
  platform?: VideoPlatform;
  /** Auto-send invitation */
  autoSendInvitation?: boolean;
}

// ============================================================================
// Patient Portal Types
// ============================================================================

/**
 * Patient appointment with telehealth info
 */
export interface PatientAppointmentWithTelehealth {
  /** Basic appointment info */
  appointmentId: string;
  type: string;
  scheduledDateTime: Date;
  provider: {
    name: string;
    specialty: string;
  };
  status: string;
  /** Telehealth session info (if applicable) */
  telehealthSession?: {
    sessionId: string;
    status: TelehealthSessionStatus;
    joinUrl?: string;
    canJoin: boolean;
    joinAvailableAt?: Date;
    sessionNotes?: string;
  };
}

/**
 * Session join validation
 */
export interface SessionJoinValidation {
  /** Whether user can join */
  canJoin: boolean;
  /** Reason if cannot join */
  reason?: string;
  /** When session becomes available */
  availableAt?: Date;
  /** Required actions before joining */
  requiredActions?: string[];
  /** Technical requirements check */
  technicalRequirements?: {
    browserSupported: boolean;
    cameraAccess: boolean;
    microphoneAccess: boolean;
    internetConnection: boolean;
  };
}

// ============================================================================
// Email Invitation Types
// ============================================================================

/**
 * Email template data
 */
export interface EmailTemplateData {
  /** Patient name */
  patientName: string;
  /** Provider name */
  providerName: string;
  /** Appointment date and time */
  appointmentDateTime: string;
  /** Session join URL */
  joinUrl: string;
  /** Additional instructions */
  instructions?: string;
  /** Custom message from provider */
  customMessage?: string;
  /** Support contact information */
  supportInfo: {
    phone: string;
    email: string;
    helpUrl: string;
  };
}

/**
 * Email sending configuration
 */
export interface EmailConfig {
  /** SMTP configuration */
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  /** Email templates */
  templates: {
    invitation: string;
    reminder: string;
    cancellation: string;
  };
  /** From address */
  fromAddress: string;
  /** Default support info */
  defaultSupportInfo: EmailTemplateData['supportInfo'];
}

// ============================================================================
// Service Configuration Types
// ============================================================================

/**
 * Telehealth service configuration
 */
export interface TelehealthServiceConfig {
  /** Video platform configurations */
  platforms: {
    [K in VideoPlatform]?: {
      enabled: boolean;
      apiKey?: string;
      apiSecret?: string;
      sdkConfig?: Record<string, unknown>;
    };
  };
  /** Session defaults */
  sessionDefaults: {
    durationMinutes: number;
    platform: VideoPlatform;
    settings: TelehealthSession['settings'];
  };
  /** Security settings */
  security: {
    tokenExpirationMinutes: number;
    requirePasswordForSessions: boolean;
    allowRecording: boolean;
    maxSessionDurationMinutes: number;
  };
  /** Email configuration */
  email: EmailConfig;
  /** Database connection */
  database: {
    connectionString: string;
    sessionTableName: string;
    invitationTableName: string;
  };
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * API response wrapper
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
 * Paginated response
 */
export interface PaginatedResponse<T> {
  /** Items in current page */
  items: T[];
  /** Total number of items */
  total: number;
  /** Current page number */
  page: number;
  /** Page size */
  pageSize: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there are more pages */
  hasMore: boolean;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Telehealth session events
 */
export type TelehealthSessionEvent = 
  | 'session_created'
  | 'session_scheduled'
  | 'invitation_sent'
  | 'session_started'
  | 'participant_joined'
  | 'participant_left'
  | 'session_ended'
  | 'session_cancelled';

/**
 * Session event data
 */
export interface SessionEventData {
  /** Event type */
  event: TelehealthSessionEvent;
  /** Session ID */
  sessionId: string;
  /** Event timestamp */
  timestamp: Date;
  /** User who triggered the event */
  userId?: string;
  /** User role */
  userRole?: 'patient' | 'provider';
  /** Additional event data */
  data?: Record<string, unknown>;
}