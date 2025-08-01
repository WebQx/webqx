/**
 * TypeScript Types for EHR Integration System
 * 
 * Comprehensive type definitions for Electronic Health Record integrations,
 * patient data management, and system interoperability.
 */

// ============================================================================
// Core EHR Types
// ============================================================================

/**
 * Supported EHR system types
 */
export type EHRSystemType = 
  | 'epic' 
  | 'cerner' 
  | 'allscripts' 
  | 'athenahealth'
  | 'nextgen'
  | 'eclinicalworks'
  | 'meditech'
  | 'custom'
  | 'fhir_generic';

/**
 * EHR connection status
 */
export type ConnectionStatus = 
  | 'connected' 
  | 'disconnected' 
  | 'connecting' 
  | 'error' 
  | 'authenticating'
  | 'syncing';

/**
 * Data synchronization status
 */
export type SyncStatus = 
  | 'idle' 
  | 'syncing' 
  | 'completed' 
  | 'failed' 
  | 'partial_success'
  | 'paused';

// ============================================================================
// EHR Configuration and Connection
// ============================================================================

/**
 * EHR system configuration
 */
export interface EHRConfiguration {
  /** Unique identifier for this EHR configuration */
  id: string;
  /** Human-readable name for this EHR connection */
  name: string;
  /** Type of EHR system */
  systemType: EHRSystemType;
  /** Base URL for EHR API endpoints */
  baseUrl: string;
  /** API version */
  apiVersion: string;
  /** Authentication configuration */
  authentication: EHRAuthentication;
  /** Connection timeout in milliseconds */
  timeoutMs: number;
  /** Retry configuration */
  retryConfig: RetryConfiguration;
  /** Whether this connection is active */
  isActive: boolean;
  /** Additional custom settings */
  customSettings?: Record<string, unknown>;
  /** Created timestamp */
  createdAt: Date;
  /** Last updated timestamp */
  updatedAt: Date;
}

/**
 * EHR authentication configuration
 */
export interface EHRAuthentication {
  /** Authentication type */
  type: 'oauth2' | 'apikey' | 'basic' | 'certificate' | 'jwt';
  /** Client ID for OAuth2 */
  clientId?: string;
  /** Client secret for OAuth2 (encrypted) */
  clientSecret?: string;
  /** API key for API key authentication */
  apiKey?: string;
  /** Username for basic authentication */
  username?: string;
  /** Password for basic authentication (encrypted) */
  password?: string;
  /** Token endpoint for OAuth2 */
  tokenEndpoint?: string;
  /** Authorization endpoint for OAuth2 */
  authEndpoint?: string;
  /** Scopes for OAuth2 */
  scopes?: string[];
  /** Certificate path for certificate authentication */
  certificatePath?: string;
}

/**
 * Retry configuration for failed requests
 */
export interface RetryConfiguration {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay between retries in milliseconds */
  initialDelayMs: number;
  /** Backoff multiplier for exponential backoff */
  backoffMultiplier: number;
  /** Maximum delay between retries in milliseconds */
  maxDelayMs: number;
  /** Whether to use jitter to avoid thundering herd */
  useJitter: boolean;
}

// ============================================================================
// Patient and Medical Data Types
// ============================================================================

/**
 * Patient demographic information
 */
export interface PatientDemographics {
  /** Patient's medical record number */
  mrn: string;
  /** First name */
  firstName: string;
  /** Last name */
  lastName: string;
  /** Middle name */
  middleName?: string;
  /** Date of birth */
  dateOfBirth: Date;
  /** Gender */
  gender: 'male' | 'female' | 'other' | 'unknown';
  /** Social Security Number (encrypted) */
  ssn?: string;
  /** Phone number */
  phoneNumber?: string;
  /** Email address */
  email?: string;
  /** Address information */
  address?: PatientAddress;
  /** Emergency contact */
  emergencyContact?: EmergencyContact;
  /** Insurance information */
  insurance?: InsuranceInformation[];
  /** Preferred language */
  preferredLanguage?: string;
  /** Race/ethnicity */
  raceEthnicity?: string;
  /** Marital status */
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed' | 'other';
}

/**
 * Patient address information
 */
export interface PatientAddress {
  /** Street address line 1 */
  street1: string;
  /** Street address line 2 */
  street2?: string;
  /** City */
  city: string;
  /** State or province */
  state: string;
  /** ZIP or postal code */
  zipCode: string;
  /** Country */
  country: string;
  /** Address type */
  type: 'home' | 'work' | 'temporary' | 'other';
}

/**
 * Emergency contact information
 */
export interface EmergencyContact {
  /** Contact's name */
  name: string;
  /** Relationship to patient */
  relationship: string;
  /** Phone number */
  phoneNumber: string;
  /** Email address */
  email?: string;
}

/**
 * Insurance information
 */
export interface InsuranceInformation {
  /** Insurance provider name */
  providerName: string;
  /** Policy number */
  policyNumber: string;
  /** Group number */
  groupNumber?: string;
  /** Subscriber ID */
  subscriberId: string;
  /** Whether this is primary insurance */
  isPrimary: boolean;
  /** Coverage effective date */
  effectiveDate: Date;
  /** Coverage end date */
  endDate?: Date;
}

// ============================================================================
// Medical Record Types
// ============================================================================

/**
 * Complete medical record
 */
export interface MedicalRecord {
  /** Patient demographics */
  patient: PatientDemographics;
  /** Medical encounters */
  encounters: MedicalEncounter[];
  /** Diagnoses */
  diagnoses: Diagnosis[];
  /** Medications */
  medications: Medication[];
  /** Allergies */
  allergies: Allergy[];
  /** Vital signs */
  vitals: VitalSigns[];
  /** Laboratory results */
  labResults: LabResult[];
  /** Procedures */
  procedures: Procedure[];
  /** Care plans */
  carePlans: CarePlan[];
  /** Last sync timestamp */
  lastSynced: Date;
}

/**
 * Medical encounter
 */
export interface MedicalEncounter {
  /** Unique encounter ID */
  id: string;
  /** Encounter date */
  date: Date;
  /** Encounter type */
  type: 'inpatient' | 'outpatient' | 'emergency' | 'urgent_care' | 'telehealth';
  /** Healthcare provider */
  provider: HealthcareProvider;
  /** Chief complaint */
  chiefComplaint?: string;
  /** Assessment and plan */
  assessmentPlan?: string;
  /** Status */
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  /** Location */
  location?: string;
  /** Duration in minutes */
  durationMinutes?: number;
}

/**
 * Healthcare provider information
 */
export interface HealthcareProvider {
  /** Provider ID */
  id: string;
  /** Provider name */
  name: string;
  /** Medical specialty */
  specialty: string;
  /** License number */
  licenseNumber: string;
  /** NPI (National Provider Identifier) */
  npi: string;
  /** Contact information */
  contact?: {
    email?: string;
    phone?: string;
  };
}

/**
 * Medical diagnosis
 */
export interface Diagnosis {
  /** Diagnosis ID */
  id: string;
  /** ICD-10 code */
  icd10Code: string;
  /** Diagnosis description */
  description: string;
  /** Date of diagnosis */
  dateOfDiagnosis: Date;
  /** Diagnosing provider */
  provider: HealthcareProvider;
  /** Diagnosis status */
  status: 'active' | 'resolved' | 'inactive' | 'rule_out';
  /** Severity */
  severity?: 'mild' | 'moderate' | 'severe';
}

/**
 * Medication information
 */
export interface Medication {
  /** Medication ID */
  id: string;
  /** Medication name */
  name: string;
  /** RxCUI code */
  rxcui?: string;
  /** NDC code */
  ndc?: string;
  /** Dosage */
  dosage: string;
  /** Frequency */
  frequency: string;
  /** Route of administration */
  route: string;
  /** Start date */
  startDate: Date;
  /** End date */
  endDate?: Date;
  /** Prescribing provider */
  prescriber: HealthcareProvider;
  /** Instructions */
  instructions?: string;
  /** Status */
  status: 'active' | 'discontinued' | 'completed' | 'suspended';
}

/**
 * Allergy information
 */
export interface Allergy {
  /** Allergy ID */
  id: string;
  /** Allergen name */
  allergen: string;
  /** Allergy category */
  category: 'medication' | 'food' | 'environmental' | 'other';
  /** Reaction description */
  reaction: string;
  /** Severity */
  severity: 'mild' | 'moderate' | 'severe' | 'life_threatening';
  /** Date identified */
  dateIdentified: Date;
  /** Status */
  status: 'active' | 'inactive' | 'resolved';
}

/**
 * Vital signs
 */
export interface VitalSigns {
  /** Measurement ID */
  id: string;
  /** Date and time of measurement */
  dateTime: Date;
  /** Blood pressure systolic */
  systolicBP?: number;
  /** Blood pressure diastolic */
  diastolicBP?: number;
  /** Heart rate (beats per minute) */
  heartRate?: number;
  /** Respiratory rate (breaths per minute) */
  respiratoryRate?: number;
  /** Temperature (Fahrenheit) */
  temperature?: number;
  /** Oxygen saturation percentage */
  oxygenSaturation?: number;
  /** Weight (pounds) */
  weight?: number;
  /** Height (inches) */
  height?: number;
  /** BMI */
  bmi?: number;
  /** Pain scale (0-10) */
  painScale?: number;
}

/**
 * Laboratory result
 */
export interface LabResult {
  /** Lab result ID */
  id: string;
  /** Test name */
  testName: string;
  /** LOINC code */
  loincCode?: string;
  /** Result value */
  value: string;
  /** Unit of measurement */
  unit: string;
  /** Reference range */
  referenceRange: string;
  /** Result status */
  status: 'normal' | 'abnormal' | 'critical' | 'pending';
  /** Date collected */
  dateCollected: Date;
  /** Date resulted */
  dateResulted?: Date;
  /** Ordering provider */
  orderingProvider: HealthcareProvider;
}

/**
 * Medical procedure
 */
export interface Procedure {
  /** Procedure ID */
  id: string;
  /** Procedure name */
  name: string;
  /** CPT code */
  cptCode?: string;
  /** ICD-10 procedure code */
  icd10ProcedureCode?: string;
  /** Date performed */
  datePerformed: Date;
  /** Performing provider */
  provider: HealthcareProvider;
  /** Procedure notes */
  notes?: string;
  /** Status */
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
}

/**
 * Care plan
 */
export interface CarePlan {
  /** Care plan ID */
  id: string;
  /** Plan title */
  title: string;
  /** Description */
  description: string;
  /** Start date */
  startDate: Date;
  /** End date */
  endDate?: Date;
  /** Goals */
  goals: CareGoal[];
  /** Activities */
  activities: CareActivity[];
  /** Status */
  status: 'active' | 'completed' | 'cancelled' | 'suspended';
  /** Care team members */
  careTeam: HealthcareProvider[];
}

/**
 * Care goal
 */
export interface CareGoal {
  /** Goal ID */
  id: string;
  /** Goal description */
  description: string;
  /** Target date */
  targetDate?: Date;
  /** Status */
  status: 'proposed' | 'accepted' | 'active' | 'completed' | 'cancelled';
  /** Progress notes */
  progressNotes?: string;
}

/**
 * Care activity
 */
export interface CareActivity {
  /** Activity ID */
  id: string;
  /** Activity description */
  description: string;
  /** Scheduled date */
  scheduledDate?: Date;
  /** Status */
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  /** Assigned provider */
  assignedProvider?: HealthcareProvider;
}

// ============================================================================
// API and Integration Types
// ============================================================================

/**
 * EHR API response wrapper
 */
export interface EHRApiResponse<T = unknown> {
  /** Success status */
  success: boolean;
  /** Response data */
  data?: T;
  /** Error information */
  error?: EHRApiError;
  /** Response metadata */
  metadata?: {
    requestId: string;
    timestamp: Date;
    processingTimeMs: number;
    rateLimitRemaining?: number;
    rateLimitReset?: Date;
  };
}

/**
 * EHR API error
 */
export interface EHRApiError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Detailed error description */
  details?: string;
  /** HTTP status code */
  statusCode?: number;
  /** Whether the error is retryable */
  retryable: boolean;
  /** Suggested retry delay in milliseconds */
  retryAfterMs?: number;
}

/**
 * Data synchronization operation
 */
export interface SyncOperation {
  /** Operation ID */
  id: string;
  /** EHR configuration ID */
  ehrConfigId: string;
  /** Patient MRN */
  patientMrn: string;
  /** Sync type */
  type: 'full' | 'incremental' | 'targeted';
  /** Data types to sync */
  dataTypes: SyncDataType[];
  /** Operation status */
  status: SyncStatus;
  /** Start timestamp */
  startedAt: Date;
  /** Completion timestamp */
  completedAt?: Date;
  /** Progress percentage (0-100) */
  progressPercent: number;
  /** Records processed */
  recordsProcessed: number;
  /** Records total */
  recordsTotal: number;
  /** Errors encountered */
  errors: SyncError[];
  /** Success message */
  successMessage?: string;
}

/**
 * Synchronizable data types
 */
export type SyncDataType = 
  | 'demographics'
  | 'encounters'
  | 'diagnoses'
  | 'medications'
  | 'allergies'
  | 'vitals'
  | 'lab_results'
  | 'procedures'
  | 'care_plans'
  | 'all';

/**
 * Synchronization error
 */
export interface SyncError {
  /** Error ID */
  id: string;
  /** Data type that failed */
  dataType: SyncDataType;
  /** Record ID that failed */
  recordId?: string;
  /** Error message */
  message: string;
  /** Error details */
  details?: string;
  /** Whether the error is retryable */
  retryable: boolean;
  /** Timestamp */
  timestamp: Date;
}

// ============================================================================
// Audit and Logging Types
// ============================================================================

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  /** Log entry ID */
  id: string;
  /** Timestamp */
  timestamp: Date;
  /** User ID who performed the action */
  userId: string;
  /** User role */
  userRole: string;
  /** Action performed */
  action: AuditAction;
  /** Resource type affected */
  resourceType: string;
  /** Resource ID affected */
  resourceId: string;
  /** Patient MRN (if applicable) */
  patientMrn?: string;
  /** EHR system involved */
  ehrSystem?: string;
  /** IP address */
  ipAddress: string;
  /** User agent */
  userAgent: string;
  /** Additional context */
  context?: Record<string, unknown>;
  /** Whether the action was successful */
  success: boolean;
  /** Error message if action failed */
  errorMessage?: string;
}

/**
 * Auditable actions
 */
export type AuditAction = 
  | 'login'
  | 'logout'
  | 'view_patient_data'
  | 'edit_patient_data'
  | 'create_patient'
  | 'delete_patient'
  | 'sync_ehr_data'
  | 'export_data'
  | 'configure_ehr'
  | 'access_audit_logs'
  | 'system_backup'
  | 'system_restore'
  | 'user_management'
  | 'permission_change';

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Loading state for UI components
 */
export interface LoadingState {
  /** Whether currently loading */
  isLoading: boolean;
  /** Loading message */
  message?: string;
  /** Progress percentage (0-100) */
  progress?: number;
}

/**
 * Error state for UI components
 */
export interface ErrorState {
  /** Whether there is an error */
  hasError: boolean;
  /** Error message */
  message?: string;
  /** Error code */
  code?: string;
  /** Whether the error is retryable */
  retryable?: boolean;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  /** Page number (1-based) */
  page: number;
  /** Number of items per page */
  pageSize: number;
  /** Total number of items */
  total?: number;
  /** Sort field */
  sortField?: string;
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
}

/**
 * Filter criteria for data queries
 */
export interface FilterCriteria {
  /** Date range filter */
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  /** Provider filter */
  providerId?: string;
  /** Specialty filter */
  specialty?: string;
  /** Status filter */
  status?: string;
  /** Search text */
  searchText?: string;
  /** Custom filters */
  customFilters?: Record<string, unknown>;
}

// Re-export data sync types
export type { SyncProgress, SyncConfiguration, SyncConflict, SyncResult } from '../services/dataSync';

// Re-export PACS Clinical Sync types
export * from './pacs-clinical-sync';