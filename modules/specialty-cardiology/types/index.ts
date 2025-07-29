/**
 * Cardiology Specialty Types
 * 
 * TypeScript interfaces and types specific to cardiology practice,
 * extending the base EHR types with cardiology-specific data structures.
 */

import { IntakeFormData, Medication, AllergySeverity } from '../../../ehr-integrations/types';

/**
 * Cardiology-specific intake form data
 */
export interface CardiologyIntakeData extends IntakeFormData {
  /** Cardiology-specific data */
  specialtyData: CardiologySpecialtyData;
}

/**
 * Cardiology specialty-specific data structure
 */
export interface CardiologySpecialtyData {
  /** Cardiovascular symptoms */
  cardiovascularSymptoms: CardiovascularSymptoms;
  /** Risk factors assessment */
  riskFactors: CardiacRiskFactors;
  /** Previous cardiac procedures */
  previousProcedures: PreviousCardiacProcedure[];
  /** Current cardiac medications */
  cardiacMedications: CardiacMedication[];
  /** Vital signs */
  vitalSigns: VitalSigns;
  /** Exercise tolerance */
  exerciseTolerance: ExerciseTolerance;
  /** Additional notes */
  additionalNotes?: string;
}

/**
 * Cardiovascular symptoms assessment
 */
export interface CardiovascularSymptoms {
  /** Chest pain or discomfort */
  chestPain: SymptomDetails;
  /** Shortness of breath */
  shortnessOfBreath: SymptomDetails;
  /** Heart palpitations */
  palpitations: SymptomDetails;
  /** Dizziness or lightheadedness */
  dizziness: SymptomDetails;
  /** Fatigue */
  fatigue: SymptomDetails;
  /** Swelling in legs/ankles */
  edema: SymptomDetails;
  /** Syncope (fainting) */
  syncope: SymptomDetails;
}

/**
 * Symptom details structure
 */
export interface SymptomDetails {
  /** Whether symptom is present */
  present: boolean;
  /** Severity rating (1-10) */
  severity?: number;
  /** Frequency of occurrence */
  frequency?: SymptomFrequency;
  /** Duration of episodes */
  duration?: string;
  /** Triggering factors */
  triggers?: string[];
  /** Additional description */
  description?: string;
}

/**
 * Symptom frequency enumeration
 */
export enum SymptomFrequency {
  NEVER = 'never',
  RARELY = 'rarely',
  OCCASIONALLY = 'occasionally',
  FREQUENTLY = 'frequently',
  CONSTANTLY = 'constantly'
}

/**
 * Cardiac risk factors assessment
 */
export interface CardiacRiskFactors {
  /** Hypertension */
  hypertension: RiskFactorDetail;
  /** Diabetes mellitus */
  diabetes: RiskFactorDetail;
  /** High cholesterol */
  highCholesterol: RiskFactorDetail;
  /** Smoking history */
  smokingHistory: SmokingRiskFactor;
  /** Family history of heart disease */
  familyHeartDisease: FamilyHistoryDetail;
  /** Obesity */
  obesity: RiskFactorDetail;
  /** Physical inactivity */
  physicalInactivity: RiskFactorDetail;
  /** Stress levels */
  stress: StressAssessment;
}

/**
 * Risk factor detail structure
 */
export interface RiskFactorDetail {
  /** Whether risk factor is present */
  present: boolean;
  /** Date of diagnosis */
  diagnosisDate?: Date;
  /** Current control status */
  controlled?: boolean;
  /** Treatment notes */
  treatment?: string;
}

/**
 * Smoking-specific risk factor
 */
export interface SmokingRiskFactor extends RiskFactorDetail {
  /** Smoking status */
  status: 'never' | 'former' | 'current';
  /** Packs per day (if current/former smoker) */
  packsPerDay?: number;
  /** Years smoked */
  yearsSmoked?: number;
  /** Quit date (if former smoker) */
  quitDate?: Date;
}

/**
 * Family history detail
 */
export interface FamilyHistoryDetail {
  /** Whether family history is present */
  present: boolean;
  /** Affected relatives */
  relatives?: FamilyRelative[];
}

/**
 * Family relative with heart disease
 */
export interface FamilyRelative {
  /** Relationship to patient */
  relationship: string;
  /** Type of heart condition */
  condition: string;
  /** Age at diagnosis */
  ageAtDiagnosis?: number;
}

/**
 * Stress assessment
 */
export interface StressAssessment {
  /** Stress level (1-10) */
  level: number;
  /** Stress sources */
  sources?: string[];
  /** Coping mechanisms */
  copingMechanisms?: string[];
}

/**
 * Previous cardiac procedure
 */
export interface PreviousCardiacProcedure {
  /** Procedure name */
  name: string;
  /** Procedure type */
  type: ProcedureType;
  /** Date performed */
  date: Date;
  /** Performing institution */
  institution?: string;
  /** Procedure outcome */
  outcome?: string;
  /** Complications */
  complications?: string;
}

/**
 * Cardiac procedure types
 */
export enum ProcedureType {
  DIAGNOSTIC = 'diagnostic',
  INTERVENTIONAL = 'interventional',
  SURGICAL = 'surgical',
  DEVICE_IMPLANTATION = 'device_implantation'
}

/**
 * Cardiac medication structure
 */
export interface CardiacMedication extends Medication {
  /** Medication category */
  category: CardiacMedicationCategory;
  /** Target condition */
  targetCondition?: string;
  /** Effectiveness assessment */
  effectiveness?: EffectivenessRating;
  /** Side effects experienced */
  sideEffects?: string[];
}

/**
 * Cardiac medication categories
 */
export enum CardiacMedicationCategory {
  ACE_INHIBITOR = 'ace_inhibitor',
  ARB = 'arb',
  BETA_BLOCKER = 'beta_blocker',
  CALCIUM_CHANNEL_BLOCKER = 'calcium_channel_blocker',
  DIURETIC = 'diuretic',
  STATIN = 'statin',
  ANTIPLATELET = 'antiplatelet',
  ANTICOAGULANT = 'anticoagulant',
  ANTIARRHYTHMIC = 'antiarrhythmic',
  VASODILATOR = 'vasodilator',
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

/**
 * Vital signs structure
 */
export interface VitalSigns {
  /** Blood pressure */
  bloodPressure: BloodPressure;
  /** Heart rate */
  heartRate: number;
  /** Weight */
  weight?: number;
  /** Height */
  height?: number;
  /** BMI */
  bmi?: number;
  /** Measurement date */
  measurementDate: Date;
}

/**
 * Blood pressure structure
 */
export interface BloodPressure {
  /** Systolic pressure */
  systolic: number;
  /** Diastolic pressure */
  diastolic: number;
  /** Measurement position */
  position?: 'sitting' | 'standing' | 'lying';
  /** Measurement arm */
  arm?: 'left' | 'right';
}

/**
 * Exercise tolerance assessment
 */
export interface ExerciseTolerance {
  /** Current exercise level */
  currentLevel: ExerciseLevel;
  /** Limitations */
  limitations?: ExerciseLimitation[];
  /** Symptoms during exercise */
  exerciseSymptoms?: string[];
  /** Exercise capacity assessment */
  capacityAssessment?: string;
}

/**
 * Exercise levels
 */
export enum ExerciseLevel {
  SEDENTARY = 'sedentary',
  LIGHT = 'light',
  MODERATE = 'moderate',
  VIGOROUS = 'vigorous'
}

/**
 * Exercise limitations
 */
export enum ExerciseLimitation {
  CHEST_PAIN = 'chest_pain',
  SHORTNESS_OF_BREATH = 'shortness_of_breath',
  FATIGUE = 'fatigue',
  DIZZINESS = 'dizziness',
  JOINT_PAIN = 'joint_pain',
  OTHER = 'other'
}

/**
 * Cardiology assessment result
 */
export interface CardiologyAssessment {
  /** Patient ID */
  patientId: string;
  /** Assessment date */
  assessmentDate: Date;
  /** Risk stratification */
  riskStratification: RiskStratification;
  /** Recommended follow-up */
  recommendedFollowUp: FollowUpRecommendation;
  /** Diagnostic recommendations */
  diagnosticRecommendations: DiagnosticRecommendation[];
  /** Treatment recommendations */
  treatmentRecommendations: TreatmentRecommendation[];
  /** Lifestyle recommendations */
  lifestyleRecommendations: LifestyleRecommendation[];
}

/**
 * Risk stratification levels
 */
export enum RiskStratification {
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

/**
 * Follow-up recommendation
 */
export interface FollowUpRecommendation {
  /** Recommended timeframe */
  timeframe: string;
  /** Follow-up type */
  type: FollowUpType;
  /** Specific instructions */
  instructions?: string;
}

/**
 * Follow-up types
 */
export enum FollowUpType {
  ROUTINE = 'routine',
  URGENT = 'urgent',
  SPECIALIST = 'specialist',
  DIAGNOSTIC = 'diagnostic'
}

/**
 * Diagnostic recommendation
 */
export interface DiagnosticRecommendation {
  /** Test name */
  testName: string;
  /** Priority level */
  priority: RecommendationPriority;
  /** Reason for test */
  reason: string;
  /** Timing recommendation */
  timing?: string;
}

/**
 * Treatment recommendation
 */
export interface TreatmentRecommendation {
  /** Treatment type */
  type: TreatmentType;
  /** Specific treatment */
  treatment: string;
  /** Priority level */
  priority: RecommendationPriority;
  /** Rationale */
  rationale: string;
}

/**
 * Lifestyle recommendation
 */
export interface LifestyleRecommendation {
  /** Recommendation category */
  category: LifestyleCategory;
  /** Specific recommendation */
  recommendation: string;
  /** Priority level */
  priority: RecommendationPriority;
}

/**
 * Recommendation priority levels
 */
export enum RecommendationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

/**
 * Treatment types
 */
export enum TreatmentType {
  MEDICATION = 'medication',
  PROCEDURE = 'procedure',
  SURGERY = 'surgery',
  DEVICE = 'device',
  LIFESTYLE = 'lifestyle'
}

/**
 * Lifestyle categories
 */
export enum LifestyleCategory {
  DIET = 'diet',
  EXERCISE = 'exercise',
  SMOKING_CESSATION = 'smoking_cessation',
  STRESS_MANAGEMENT = 'stress_management',
  WEIGHT_MANAGEMENT = 'weight_management',
  MEDICATION_COMPLIANCE = 'medication_compliance'
}