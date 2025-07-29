/**
 * EHR Integration Types
 * 
 * Core TypeScript interfaces and types for EHR system integration.
 * These types ensure type safety and consistency across all EHR operations.
 */

/**
 * Base error interface for all EHR operations
 */
export interface EHRError {
  /** Error code for programmatic handling */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Optional error details for debugging */
  details?: Record<string, any>;
  /** Timestamp when error occurred */
  timestamp: Date;
  /** Operation that caused the error */
  operation: string;
}

/**
 * Loading state interface for async operations
 */
export interface LoadingState {
  /** Whether operation is currently loading */
  isLoading: boolean;
  /** Loading message to display to user */
  message?: string;
  /** Progress percentage (0-100) if available */
  progress?: number;
}

/**
 * Result wrapper for EHR operations
 */
export interface EHRResult<T> {
  /** Operation success status */
  success: boolean;
  /** Result data if successful */
  data?: T;
  /** Error information if failed */
  error?: EHRError;
  /** Loading state */
  loading: LoadingState;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Patient information interface
 */
export interface Patient {
  /** Unique patient identifier */
  id: string;
  /** Patient's first name */
  firstName: string;
  /** Patient's last name */
  lastName: string;
  /** Date of birth */
  dateOfBirth: Date;
  /** Medical record number */
  mrn: string;
  /** Contact email */
  email?: string;
  /** Primary phone number */
  phone?: string;
  /** Patient's address */
  address?: Address;
  /** Emergency contact information */
  emergencyContact?: EmergencyContact;
}

/**
 * Address interface
 */
export interface Address {
  /** Street address line 1 */
  street1: string;
  /** Street address line 2 (optional) */
  street2?: string;
  /** City name */
  city: string;
  /** State or province */
  state: string;
  /** Postal/zip code */
  postalCode: string;
  /** Country code */
  country: string;
}

/**
 * Emergency contact interface
 */
export interface EmergencyContact {
  /** Contact's full name */
  name: string;
  /** Relationship to patient */
  relationship: string;
  /** Primary phone number */
  phone: string;
  /** Secondary phone number */
  alternatePhone?: string;
}

/**
 * Medical provider interface
 */
export interface Provider {
  /** Unique provider identifier */
  id: string;
  /** Provider's first name */
  firstName: string;
  /** Provider's last name */
  lastName: string;
  /** Medical specialty */
  specialty: string;
  /** Professional title */
  title: string;
  /** National Provider Identifier */
  npi: string;
  /** Provider's contact information */
  contact: ProviderContact;
}

/**
 * Provider contact information
 */
export interface ProviderContact {
  /** Office phone number */
  phone: string;
  /** Office email address */
  email: string;
  /** Office address */
  address: Address;
  /** Office fax number */
  fax?: string;
}

/**
 * Appointment interface
 */
export interface Appointment {
  /** Unique appointment identifier */
  id: string;
  /** Patient ID */
  patientId: string;
  /** Provider ID */
  providerId: string;
  /** Appointment date and time */
  dateTime: Date;
  /** Duration in minutes */
  duration: number;
  /** Appointment type */
  type: AppointmentType;
  /** Current status */
  status: AppointmentStatus;
  /** Appointment notes */
  notes?: string;
  /** Reason for visit */
  reason: string;
}

/**
 * Appointment type enumeration
 */
export enum AppointmentType {
  NEW_PATIENT = 'new_patient',
  FOLLOW_UP = 'follow_up',
  CONSULTATION = 'consultation',
  PROCEDURE = 'procedure',
  TELEHEALTH = 'telehealth',
  EMERGENCY = 'emergency'
}

/**
 * Appointment status enumeration
 */
export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  ARRIVED = 'arrived',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show'
}

/**
 * Medical intake form interface
 */
export interface IntakeForm {
  /** Unique form identifier */
  id: string;
  /** Patient ID */
  patientId: string;
  /** Medical specialty this form is for */
  specialty: string;
  /** Form completion status */
  status: IntakeFormStatus;
  /** Form data */
  data: IntakeFormData;
  /** Form submission timestamp */
  submittedAt?: Date;
  /** Provider who reviewed the form */
  reviewedBy?: string;
  /** Review timestamp */
  reviewedAt?: Date;
}

/**
 * Intake form status enumeration
 */
export enum IntakeFormStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  REVIEWED = 'reviewed',
  REQUIRES_UPDATE = 'requires_update'
}

/**
 * Generic intake form data interface
 */
export interface IntakeFormData {
  /** Chief complaint */
  chiefComplaint: string;
  /** History of present illness */
  historyOfPresentIllness: string;
  /** Current medications */
  medications: Medication[];
  /** Known allergies */
  allergies: Allergy[];
  /** Family medical history */
  familyHistory: FamilyHistory[];
  /** Social history */
  socialHistory: SocialHistory;
  /** Review of systems */
  reviewOfSystems: ReviewOfSystems;
  /** Additional specialty-specific data */
  specialtyData?: Record<string, any>;
}

/**
 * Medication interface
 */
export interface Medication {
  /** Medication name */
  name: string;
  /** Dosage amount */
  dosage: string;
  /** Frequency of administration */
  frequency: string;
  /** Route of administration */
  route: string;
  /** Reason for taking medication */
  reason?: string;
  /** Start date */
  startDate?: Date;
  /** End date if discontinued */
  endDate?: Date;
}

/**
 * Allergy interface
 */
export interface Allergy {
  /** Allergen name */
  allergen: string;
  /** Type of allergic reaction */
  reaction: string;
  /** Severity level */
  severity: AllergySeverity;
  /** Date allergy was identified */
  identifiedDate?: Date;
}

/**
 * Allergy severity enumeration
 */
export enum AllergySeverity {
  MILD = 'mild',
  MODERATE = 'moderate',
  SEVERE = 'severe',
  LIFE_THREATENING = 'life_threatening'
}

/**
 * Family history interface
 */
export interface FamilyHistory {
  /** Relationship to patient */
  relationship: string;
  /** Medical condition */
  condition: string;
  /** Age at onset if known */
  ageAtOnset?: number;
  /** Additional notes */
  notes?: string;
}

/**
 * Social history interface
 */
export interface SocialHistory {
  /** Smoking status */
  smokingStatus: SmokingStatus;
  /** Alcohol consumption */
  alcoholUse: AlcoholUse;
  /** Exercise habits */
  exerciseHabits: string;
  /** Occupation */
  occupation: string;
  /** Marital status */
  maritalStatus: string;
  /** Number of children */
  children?: number;
}

/**
 * Smoking status enumeration
 */
export enum SmokingStatus {
  NEVER = 'never',
  FORMER = 'former',
  CURRENT = 'current',
  UNKNOWN = 'unknown'
}

/**
 * Alcohol use enumeration
 */
export enum AlcoholUse {
  NONE = 'none',
  OCCASIONAL = 'occasional',
  MODERATE = 'moderate',
  HEAVY = 'heavy'
}

/**
 * Review of systems interface
 */
export interface ReviewOfSystems {
  /** Constitutional symptoms */
  constitutional: boolean;
  /** Cardiovascular symptoms */
  cardiovascular: boolean;
  /** Respiratory symptoms */
  respiratory: boolean;
  /** Gastrointestinal symptoms */
  gastrointestinal: boolean;
  /** Neurological symptoms */
  neurological: boolean;
  /** Additional system reviews */
  other: Record<string, boolean>;
  /** Detailed notes for positive findings */
  notes?: string;
}

/**
 * Logging interface for EHR operations
 */
export interface EHRLogEntry {
  /** Unique log entry identifier */
  id: string;
  /** Timestamp of the operation */
  timestamp: Date;
  /** Operation type */
  operation: string;
  /** Operation success status */
  success: boolean;
  /** Duration of operation in milliseconds */
  duration: number;
  /** User who performed the operation */
  userId?: string;
  /** Patient ID if applicable */
  patientId?: string;
  /** Error details if operation failed */
  error?: EHRError;
  /** Additional operation metadata */
  metadata?: Record<string, any>;
}