/**
 * EHR Integration Module - Main Export File
 * 
 * Comprehensive Electronic Health Record integration system with
 * FHIR R4 support, real-time appointment booking, and OAuth2 security.
 * 
 * @author WebQX Health
 * @version 2.0.0
 */

// ============================================================================
// Type Definitions
// ============================================================================

// Core EHR Types (Legacy)
export * from './types/index';

// FHIR R4 Types and Resources
export * from './types/fhir-r4';

// ============================================================================
// Services
// ============================================================================

// Legacy EHR Service
export { EHRService } from './services/ehrService';
export { AuditLogger } from './services/auditLogger';
export { DataSyncService } from './services/dataSync';

// FHIR R4 Services
export { FHIRR4Client } from './services/fhirR4Client';
export { AppointmentBookingService } from './services/appointmentBookingService';

// Service Types
export type {
  SMARTOnFHIRConfig,
  OAuth2TokenResponse,
  FHIRR4ClientOptions
} from './services/fhirR4Client';

export type {
  AppointmentBookingConfig,
  AppointmentBookingRequest,
  AppointmentBookingResult,
  SlotAvailability,
  RealTimeUpdateEvent,
  RealTimeEventListener
} from './services/appointmentBookingService';

// ============================================================================
// Components
// ============================================================================

// Legacy Components
export { EHRIntegrationPanel } from './components/EHRIntegrationPanel';

// Component Types
export type { EHRIntegrationPanelProps } from './components/EHRIntegrationPanel';

// ============================================================================
// Utilities
// ============================================================================

export * from './utils/validation';
export * from './utils/encryption';

// ============================================================================
// Default Configuration Objects
// ============================================================================

/**
 * Default FHIR R4 client configuration
 */
export const DEFAULT_FHIR_CONFIG = {
  timeout: 30000,
  headers: {
    'Content-Type': 'application/fhir+json',
    'Accept': 'application/fhir+json'
  },
  debug: false,
  retry: {
    attempts: 3,
    delay: 1000,
    backoff: 2
  }
};

/**
 * Default appointment booking configuration
 */
export const DEFAULT_BOOKING_CONFIG = {
  realTimeConfig: {
    enableWebSocket: true,
    pollingInterval: 30000,
    maxPollingDuration: 300000
  },
  constraints: {
    minAdvanceBooking: 60, // 1 hour
    maxAdvanceBooking: 90, // 90 days
    allowOverbooking: false,
    requiredParticipants: ['patient']
  },
  notifications: {
    enableEmail: true,
    enableSMS: false
  }
};

/**
 * SMART on FHIR scope definitions
 */
export const SMART_SCOPES = {
  // Patient-facing scopes
  PATIENT_READ: 'patient/*.read',
  PATIENT_WRITE: 'patient/*.write',
  PATIENT_APPOINTMENT_READ: 'patient/Appointment.read',
  PATIENT_APPOINTMENT_WRITE: 'patient/Appointment.write',
  PATIENT_SCHEDULE_READ: 'patient/Schedule.read',
  PATIENT_SLOT_READ: 'patient/Slot.read',
  
  // User-facing scopes
  USER_READ: 'user/*.read',
  USER_WRITE: 'user/*.write',
  USER_APPOINTMENT_READ: 'user/Appointment.read',
  USER_APPOINTMENT_WRITE: 'user/Appointment.write',
  
  // System-facing scopes
  SYSTEM_READ: 'system/*.read',
  SYSTEM_WRITE: 'system/*.write',
  
  // Launch contexts
  LAUNCH: 'launch',
  LAUNCH_PATIENT: 'launch/patient',
  LAUNCH_ENCOUNTER: 'launch/encounter',
  
  // OpenID Connect
  OPENID: 'openid',
  PROFILE: 'profile',
  EMAIL: 'email'
};

/**
 * FHIR R4 appointment status codes
 */
export const APPOINTMENT_STATUS = {
  PROPOSED: 'proposed' as const,
  PENDING: 'pending' as const,
  BOOKED: 'booked' as const,
  ARRIVED: 'arrived' as const,
  FULFILLED: 'fulfilled' as const,
  CANCELLED: 'cancelled' as const,
  NOSHOW: 'noshow' as const,
  ENTERED_IN_ERROR: 'entered-in-error' as const,
  CHECKED_IN: 'checked-in' as const,
  WAITLIST: 'waitlist' as const
};

/**
 * FHIR R4 slot status codes
 */
export const SLOT_STATUS = {
  FREE: 'free' as const,
  BUSY: 'busy' as const,
  BUSY_UNAVAILABLE: 'busy-unavailable' as const,
  BUSY_TENTATIVE: 'busy-tentative' as const,
  ENTERED_IN_ERROR: 'entered-in-error' as const
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a basic SMART on FHIR configuration
 */
export function createSMARTConfig(
  fhirBaseUrl: string,
  clientId: string,
  redirectUri: string,
  scopes: string[] = [SMART_SCOPES.PATIENT_READ]
): SMARTOnFHIRConfig {
  return {
    fhirBaseUrl,
    clientId,
    redirectUri,
    scopes,
    authorizationEndpoint: `${fhirBaseUrl}/oauth2/authorize`,
    tokenEndpoint: `${fhirBaseUrl}/oauth2/token`,
    capabilitiesEndpoint: `${fhirBaseUrl}/.well-known/smart_configuration`
  };
}

/**
 * Create a FHIR R4 client with sensible defaults
 */
export function createFHIRClient(
  baseUrl: string,
  smartConfig?: SMARTOnFHIRConfig,
  options?: Partial<FHIRR4ClientOptions>
): FHIRR4Client {
  return new FHIRR4Client({
    baseUrl,
    smartConfig,
    ...DEFAULT_FHIR_CONFIG,
    ...options
  });
}

/**
 * Create an appointment booking service with sensible defaults
 */
export function createBookingService(
  fhirConfig: { baseUrl: string; smartConfig?: SMARTOnFHIRConfig },
  options?: Partial<AppointmentBookingConfig>
): AppointmentBookingService {
  const config: AppointmentBookingConfig = {
    fhirConfig,
    ...DEFAULT_BOOKING_CONFIG,
    ...options
  };
  
  return new AppointmentBookingService(config);
}

/**
 * Validate FHIR R4 resource
 */
export function validateFHIRResource(resource: any): boolean {
  return (
    resource &&
    typeof resource === 'object' &&
    typeof resource.resourceType === 'string' &&
    resource.resourceType.length > 0
  );
}

/**
 * Extract patient ID from FHIR reference
 */
export function extractPatientId(reference: string): string | null {
  const match = reference.match(/^Patient\/(.+)$/);
  return match ? match[1] : null;
}

/**
 * Extract practitioner ID from FHIR reference
 */
export function extractPractitionerId(reference: string): string | null {
  const match = reference.match(/^Practitioner\/(.+)$/);
  return match ? match[1] : null;
}

/**
 * Format FHIR date for display
 */
export function formatFHIRDate(fhirDate: string): string {
  try {
    const date = new Date(fhirDate);
    return date.toLocaleDateString();
  } catch {
    return fhirDate;
  }
}

/**
 * Format FHIR datetime for display
 */
export function formatFHIRDateTime(fhirDateTime: string): string {
  try {
    const date = new Date(fhirDateTime);
    return date.toLocaleString();
  } catch {
    return fhirDateTime;
  }
}

/**
 * Get human-readable name from FHIR HumanName array
 */
export function formatFHIRName(names: any[]): string {
  if (!names || names.length === 0) return 'Unknown';
  
  const name = names.find(n => n.use === 'official') || names[0];
  
  const parts = [];
  if (name.prefix) parts.push(...name.prefix);
  if (name.given) parts.push(...name.given);
  if (name.family) parts.push(name.family);
  if (name.suffix) parts.push(...name.suffix);
  
  return parts.join(' ') || name.text || 'Unknown';
}

// ============================================================================
// Module Information
// ============================================================================

export const MODULE_INFO = {
  name: 'WebQX EHR Integration',
  version: '2.0.0',
  description: 'Comprehensive EHR integration with FHIR R4 and real-time appointment booking',
  author: 'WebQX Health',
  capabilities: [
    'FHIR R4 Resource Management',
    'SMART on FHIR OAuth2 Authentication',
    'Real-time Appointment Booking',
    'WebSocket/Polling Updates',
    'Comprehensive Validation',
    'Audit Logging',
    'Multi-EHR Support',
    'Accessibility Compliance'
  ],
  standards: [
    'HL7 FHIR R4 (4.0.1)',
    'SMART on FHIR',
    'OAuth 2.0',
    'OpenID Connect',
    'WCAG 2.1 AA'
  ]
} as const;

export default {
  // Services
  FHIRR4Client,
  AppointmentBookingService,
  EHRService,
  
  // Components
  EHRIntegrationPanel,
  
  // Utilities
  createSMARTConfig,
  createFHIRClient,
  createBookingService,
  validateFHIRResource,
  formatFHIRName,
  formatFHIRDate,
  formatFHIRDateTime,
  
  // Constants
  SMART_SCOPES,
  APPOINTMENT_STATUS,
  SLOT_STATUS,
  MODULE_INFO
};