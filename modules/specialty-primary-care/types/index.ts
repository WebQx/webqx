/**
 * Primary Care Module Types
 * 
 * TypeScript type definitions for primary care specialty module
 * including patient management, preventive care, and chronic disease management.
 */

// ============================================================================
// Core Primary Care Types
// ============================================================================

/**
 * Primary care appointment types
 */
export type PrimaryCareAppointmentType = 
  | 'annual_physical'
  | 'follow_up'
  | 'acute_care'
  | 'preventive_screening'
  | 'chronic_disease_management'
  | 'immunization'
  | 'wellness_visit'
  | 'telehealth_consultation';

/**
 * Care priority levels
 */
export type CarePriority = 'routine' | 'urgent' | 'emergent' | 'follow_up';

/**
 * Preventive care status
 */
export type PreventiveCareStatus = 'due' | 'overdue' | 'completed' | 'not_applicable' | 'deferred';

// ============================================================================
// Patient Management Types
// ============================================================================

/**
 * Primary care patient profile
 */
export interface PrimaryCarePatient {
  /** Basic patient information */
  patientId: string;
  /** Medical record number */
  mrn: string;
  /** Patient demographics */
  demographics: {
    name: string;
    dateOfBirth: Date;
    gender: 'male' | 'female' | 'other' | 'unknown';
    phoneNumber?: string;
    email?: string;
    emergencyContact?: {
      name: string;
      relationship: string;
      phone: string;
    };
  };
  /** Primary care provider */
  primaryProvider: {
    providerId: string;
    name: string;
    npi: string;
  };
  /** Care team members */
  careTeam: CareTeamMember[];
  /** Risk stratification */
  riskLevel: 'low' | 'moderate' | 'high';
  /** Active chronic conditions */
  chronicConditions: ChronicCondition[];
  /** Preventive care status */
  preventiveCareStatus: PreventiveCareItem[];
  /** Last visit date */
  lastVisitDate?: Date;
  /** Next scheduled visit */
  nextVisitDate?: Date;
  /** Care gaps */
  careGaps: CareGap[];
}

/**
 * Care team member
 */
export interface CareTeamMember {
  /** Member ID */
  id: string;
  /** Member name */
  name: string;
  /** Role in care team */
  role: 'primary_physician' | 'nurse' | 'care_coordinator' | 'specialist' | 'pharmacist' | 'social_worker';
  /** Contact information */
  contact: {
    phone?: string;
    email?: string;
  };
  /** Whether actively involved in care */
  isActive: boolean;
}

// ============================================================================
// Chronic Disease Management Types
// ============================================================================

/**
 * Chronic condition
 */
export interface ChronicCondition {
  /** Condition ID */
  id: string;
  /** ICD-10 code */
  icd10Code: string;
  /** Condition name */
  name: string;
  /** Date of diagnosis */
  diagnosisDate: Date;
  /** Current status */
  status: 'active' | 'controlled' | 'uncontrolled' | 'remission' | 'resolved';
  /** Severity level */
  severity: 'mild' | 'moderate' | 'severe';
  /** Management goals */
  goals: ConditionGoal[];
  /** Monitoring parameters */
  monitoringParameters: MonitoringParameter[];
  /** Current medications */
  medications: ConditionMedication[];
  /** Last assessment date */
  lastAssessmentDate?: Date;
  /** Next assessment due */
  nextAssessmentDue?: Date;
}

/**
 * Condition management goal
 */
export interface ConditionGoal {
  /** Goal ID */
  id: string;
  /** Goal description */
  description: string;
  /** Target value */
  targetValue: string;
  /** Current value */
  currentValue?: string;
  /** Target date */
  targetDate?: Date;
  /** Achievement status */
  status: 'not_started' | 'in_progress' | 'achieved' | 'not_achieved';
  /** Progress notes */
  progressNotes?: string;
}

/**
 * Monitoring parameter
 */
export interface MonitoringParameter {
  /** Parameter ID */
  id: string;
  /** Parameter name */
  name: string;
  /** Parameter type */
  type: 'vital_sign' | 'lab_value' | 'symptom_score' | 'functional_assessment';
  /** Target range */
  targetRange: {
    min?: number;
    max?: number;
    unit: string;
  };
  /** Monitoring frequency */
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually' | 'as_needed';
  /** Last measured value */
  lastValue?: {
    value: number;
    date: Date;
    unit: string;
  };
  /** Next measurement due */
  nextDue?: Date;
}

/**
 * Condition-specific medication
 */
export interface ConditionMedication {
  /** Medication ID */
  id: string;
  /** Medication name */
  name: string;
  /** Dosage */
  dosage: string;
  /** Frequency */
  frequency: string;
  /** Start date */
  startDate: Date;
  /** End date */
  endDate?: Date;
  /** Adherence status */
  adherence: 'good' | 'fair' | 'poor' | 'unknown';
  /** Last refill date */
  lastRefillDate?: Date;
  /** Days supply remaining */
  daysSupplyRemaining?: number;
}

// ============================================================================
// Preventive Care Types
// ============================================================================

/**
 * Preventive care item
 */
export interface PreventiveCareItem {
  /** Item ID */
  id: string;
  /** Care item name */
  name: string;
  /** Category */
  category: 'screening' | 'immunization' | 'counseling' | 'assessment';
  /** Applicable age range */
  ageRange: {
    min: number;
    max: number;
  };
  /** Gender specificity */
  gender?: 'male' | 'female';
  /** Frequency */
  frequency: string;
  /** Status for this patient */
  status: PreventiveCareStatus;
  /** Last completed date */
  lastCompletedDate?: Date;
  /** Next due date */
  nextDueDate?: Date;
  /** Overdue days */
  overdueDays?: number;
  /** Clinical guidelines reference */
  guidelines: string[];
}

/**
 * Care gap
 */
export interface CareGap {
  /** Gap ID */
  id: string;
  /** Gap type */
  type: 'preventive_care' | 'chronic_disease_monitoring' | 'medication_adherence' | 'follow_up_overdue';
  /** Priority level */
  priority: CarePriority;
  /** Description */
  description: string;
  /** Recommended action */
  recommendedAction: string;
  /** Days overdue */
  daysOverdue: number;
  /** Related condition */
  relatedCondition?: string;
  /** Closure date */
  closureDate?: Date;
}

// ============================================================================
// Appointment and Visit Types
// ============================================================================

/**
 * Primary care appointment
 */
export interface PrimaryCareAppointment {
  /** Appointment ID */
  id: string;
  /** Patient ID */
  patientId: string;
  /** Provider ID */
  providerId: string;
  /** Appointment type */
  type: PrimaryCareAppointmentType;
  /** Scheduled date and time */
  scheduledDateTime: Date;
  /** Duration in minutes */
  durationMinutes: number;
  /** Status */
  status: 'scheduled' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  /** Chief complaint */
  chiefComplaint?: string;
  /** Visit reason */
  visitReason: string;
  /** Pre-visit checklist */
  preVisitChecklist: PreVisitItem[];
  /** Required preparations */
  preparations?: string[];
  /** Location */
  location: {
    type: 'in_person' | 'telehealth';
    details: string;
  };
}

/**
 * Pre-visit checklist item
 */
export interface PreVisitItem {
  /** Item ID */
  id: string;
  /** Item description */
  description: string;
  /** Whether completed */
  completed: boolean;
  /** Completion date */
  completionDate?: Date;
  /** Required for visit */
  required: boolean;
}

/**
 * Visit summary
 */
export interface VisitSummary {
  /** Visit ID */
  id: string;
  /** Appointment ID */
  appointmentId: string;
  /** Visit date */
  visitDate: Date;
  /** Duration in minutes */
  durationMinutes: number;
  /** Assessment */
  assessment: string;
  /** Plan */
  plan: string;
  /** Diagnoses addressed */
  diagnoses: VisitDiagnosis[];
  /** Procedures performed */
  procedures: VisitProcedure[];
  /** Medications prescribed/reviewed */
  medications: VisitMedication[];
  /** Orders placed */
  orders: VisitOrder[];
  /** Follow-up instructions */
  followUpInstructions: string;
  /** Next appointment recommended */
  nextAppointmentRecommended?: {
    timeframe: string;
    type: PrimaryCareAppointmentType;
    reason: string;
  };
}

/**
 * Visit diagnosis
 */
export interface VisitDiagnosis {
  /** Diagnosis ID */
  id: string;
  /** ICD-10 code */
  icd10Code: string;
  /** Diagnosis description */
  description: string;
  /** Whether primary diagnosis */
  isPrimary: boolean;
  /** Status */
  status: 'new' | 'existing' | 'resolved';
}

/**
 * Visit procedure
 */
export interface VisitProcedure {
  /** Procedure ID */
  id: string;
  /** CPT code */
  cptCode: string;
  /** Procedure description */
  description: string;
  /** Provider who performed */
  performedBy: string;
  /** Results */
  results?: string;
}

/**
 * Visit medication
 */
export interface VisitMedication {
  /** Medication ID */
  id: string;
  /** Medication name */
  name: string;
  /** Action taken */
  action: 'prescribed' | 'continued' | 'discontinued' | 'modified' | 'reviewed';
  /** Dosage */
  dosage: string;
  /** Frequency */
  frequency: string;
  /** Duration */
  duration?: string;
  /** Instructions */
  instructions?: string;
}

/**
 * Visit order
 */
export interface VisitOrder {
  /** Order ID */
  id: string;
  /** Order type */
  type: 'lab' | 'imaging' | 'referral' | 'dme' | 'therapy';
  /** Order description */
  description: string;
  /** Urgency */
  urgency: 'routine' | 'urgent' | 'stat';
  /** Clinical indication */
  indication: string;
  /** Special instructions */
  instructions?: string;
}

// ============================================================================
// Care Management Types
// ============================================================================

/**
 * Care plan
 */
export interface PrimaryCarePlan {
  /** Plan ID */
  id: string;
  /** Patient ID */
  patientId: string;
  /** Plan name */
  name: string;
  /** Start date */
  startDate: Date;
  /** End date */
  endDate?: Date;
  /** Goals */
  goals: CarePlanGoal[];
  /** Interventions */
  interventions: CarePlanIntervention[];
  /** Team members */
  teamMembers: string[];
  /** Status */
  status: 'active' | 'completed' | 'cancelled' | 'on_hold';
  /** Review frequency */
  reviewFrequency: string;
  /** Last review date */
  lastReviewDate?: Date;
  /** Next review due */
  nextReviewDue?: Date;
}

/**
 * Care plan goal
 */
export interface CarePlanGoal {
  /** Goal ID */
  id: string;
  /** Goal description */
  description: string;
  /** Measurable outcome */
  measurableOutcome: string;
  /** Target date */
  targetDate: Date;
  /** Status */
  status: 'not_started' | 'in_progress' | 'achieved' | 'not_achieved' | 'modified';
  /** Progress percentage */
  progressPercent: number;
  /** Notes */
  notes?: string;
}

/**
 * Care plan intervention
 */
export interface CarePlanIntervention {
  /** Intervention ID */
  id: string;
  /** Intervention type */
  type: 'medication' | 'lifestyle' | 'monitoring' | 'education' | 'referral' | 'procedure';
  /** Description */
  description: string;
  /** Frequency */
  frequency: string;
  /** Responsible party */
  responsibleParty: string;
  /** Start date */
  startDate: Date;
  /** End date */
  endDate?: Date;
  /** Status */
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  /** Outcome */
  outcome?: string;
}

// ============================================================================
// Communication Types
// ============================================================================

/**
 * Patient communication
 */
export interface PatientCommunication {
  /** Communication ID */
  id: string;
  /** Patient ID */
  patientId: string;
  /** Communication type */
  type: 'phone_call' | 'secure_message' | 'email' | 'letter' | 'portal_message';
  /** Direction */
  direction: 'inbound' | 'outbound';
  /** Subject */
  subject: string;
  /** Content */
  content: string;
  /** Sender */
  sender: {
    id: string;
    name: string;
    role: string;
  };
  /** Recipient */
  recipient: {
    id: string;
    name: string;
    role: string;
  };
  /** Timestamp */
  timestamp: Date;
  /** Status */
  status: 'sent' | 'delivered' | 'read' | 'replied' | 'failed';
  /** Priority */
  priority: 'routine' | 'urgent' | 'emergent';
  /** Related appointment */
  relatedAppointmentId?: string;
  /** Related condition */
  relatedConditionId?: string;
}

// ============================================================================
// Quality Metrics Types
// ============================================================================

/**
 * Quality measure
 */
export interface QualityMeasure {
  /** Measure ID */
  id: string;
  /** Measure name */
  name: string;
  /** Description */
  description: string;
  /** Category */
  category: 'clinical_quality' | 'patient_safety' | 'care_coordination' | 'patient_experience';
  /** Numerator description */
  numerator: string;
  /** Denominator description */
  denominator: string;
  /** Target percentage */
  target: number;
  /** Current value */
  currentValue?: number;
  /** Last calculated date */
  lastCalculated?: Date;
  /** Trend */
  trend: 'improving' | 'stable' | 'declining' | 'unknown';
}

/**
 * Provider performance metrics
 */
export interface ProviderMetrics {
  /** Provider ID */
  providerId: string;
  /** Reporting period */
  reportingPeriod: {
    startDate: Date;
    endDate: Date;
  };
  /** Quality measures */
  qualityMeasures: QualityMeasure[];
  /** Patient satisfaction scores */
  patientSatisfaction: {
    overallRating: number;
    communicationRating: number;
    accessRating: number;
    careQualityRating: number;
    recommendationRate: number;
  };
  /** Productivity metrics */
  productivity: {
    patientsSeenPerDay: number;
    appointmentUtilization: number;
    averageVisitDuration: number;
    noShowRate: number;
  };
}

// ============================================================================
// API and Service Types
// ============================================================================

/**
 * Primary care service response
 */
export interface PrimaryCareApiResponse<T = unknown> {
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
 * Search criteria for patients
 */
export interface PatientSearchCriteria {
  /** Search text */
  searchText?: string;
  /** Date of birth */
  dateOfBirth?: Date;
  /** Medical record number */
  mrn?: string;
  /** Provider ID */
  providerId?: string;
  /** Risk level */
  riskLevel?: 'low' | 'moderate' | 'high';
  /** Has chronic conditions */
  hasChronicConditions?: boolean;
  /** Has care gaps */
  hasCareGaps?: boolean;
  /** Last visit date range */
  lastVisitDateRange?: {
    startDate: Date;
    endDate: Date;
  };
  /** Page number */
  page?: number;
  /** Page size */
  pageSize?: number;
}

/**
 * Loading state for UI components
 */
export interface PrimaryLoadingState {
  /** Whether currently loading */
  isLoading: boolean;
  /** Loading message */
  message?: string;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Operation type */
  operation?: string;
}

/**
 * Error state for UI components
 */
export interface PrimaryErrorState {
  /** Whether there is an error */
  hasError: boolean;
  /** Error message */
  message?: string;
  /** Error code */
  code?: string;
  /** Whether the error is retryable */
  retryable?: boolean;
  /** Suggested action */
  suggestedAction?: string;
}