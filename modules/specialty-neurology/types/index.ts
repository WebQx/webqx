/**
 * Neurology Specialty Types
 * 
 * TypeScript interfaces and types specific to neurology practice,
 * extending the base EHR types with neurology-specific data structures.
 */

import { IntakeFormData } from '../../../ehr-integrations/types';

/**
 * Neurology-specific intake form data
 */
export interface NeurologyIntakeData extends IntakeFormData {
  /** Neurology-specific data */
  specialtyData: NeurologySpecialtyData;
}

/**
 * Neurology specialty-specific data structure
 */
export interface NeurologySpecialtyData {
  /** Assessment findings */
  assessmentFindings: AssessmentFindings;
  /** Specialty-specific symptoms */
  specialtySymptoms: SpecialtySymptoms;
  /** Current treatments */
  currentTreatments: Treatment[];
  /** Additional specialty notes */
  specialtyNotes?: string;
}

/**
 * Assessment findings for neurology
 */
export interface AssessmentFindings {
  /** Primary findings */
  primaryFindings: string[];
  /** Secondary findings */
  secondaryFindings: string[];
  /** Clinical observations */
  clinicalObservations: string;
}

/**
 * Specialty-specific symptoms
 */
export interface SpecialtySymptoms {
  /** Current symptoms */
  currentSymptoms: SymptomDetail[];
  /** Symptom duration */
  symptomDuration: string;
  /** Severity assessment */
  severityAssessment: SeverityLevel;
}

/**
 * Symptom detail interface
 */
export interface SymptomDetail {
  /** Symptom name */
  name: string;
  /** Symptom description */
  description: string;
  /** Severity level */
  severity: SeverityLevel;
  /** Onset date */
  onsetDate?: Date;
}

/**
 * Severity levels
 */
export enum SeverityLevel {
  MILD = 'mild',
  MODERATE = 'moderate',
  SEVERE = 'severe'
}

/**
 * Treatment interface
 */
export interface Treatment {
  /** Treatment name */
  name: string;
  /** Treatment type */
  type: TreatmentType;
  /** Start date */
  startDate: Date;
  /** End date */
  endDate?: Date;
  /** Effectiveness */
  effectiveness?: EffectivenessRating;
}

/**
 * Treatment types
 */
export enum TreatmentType {
  MEDICATION = 'medication',
  THERAPY = 'therapy',
  PROCEDURE = 'procedure',
  SURGERY = 'surgery',
  OTHER = 'other'
}

/**
 * Effectiveness rating
 */
export enum EffectivenessRating {
  VERY_EFFECTIVE = 'very_effective',
  EFFECTIVE = 'effective',
  SOMEWHAT_EFFECTIVE = 'somewhat_effective',
  NOT_EFFECTIVE = 'not_effective',
  UNKNOWN = 'unknown'
}
