/**
 * Primary Care Specialty Types
 * 
 * TypeScript interfaces and types specific to primary care practice,
 * extending the base EHR types with primary care-specific data structures.
 */

import { IntakeFormData } from '../../../ehr-integrations/types';

/**
 * Primary care-specific intake form data
 */
export interface PrimaryCareIntakeData extends IntakeFormData {
  /** Primary care-specific data */
  specialtyData: PrimaryCareSpecialtyData;
}

/**
 * Primary care specialty-specific data structure
 */
export interface PrimaryCareSpecialtyData {
  /** Reason for visit */
  visitReason: VisitReason;
  /** Preventive care history */
  preventiveCare: PreventiveCareHistory;
  /** Current health concerns */
  healthConcerns: HealthConcern[];
  /** Lifestyle assessment */
  lifestyleAssessment: LifestyleAssessment;
  /** Mental health screening */
  mentalHealthScreening: MentalHealthScreening;
  /** Immunization history */
  immunizations: Immunization[];
  /** Health maintenance reminders */
  healthMaintenance: HealthMaintenanceItem[];
}

/**
 * Visit reason types
 */
export enum VisitReason {
  ANNUAL_PHYSICAL = 'annual_physical',
  FOLLOW_UP = 'follow_up',
  ACUTE_ILLNESS = 'acute_illness',
  CHRONIC_DISEASE_MANAGEMENT = 'chronic_disease_management',
  PREVENTIVE_CARE = 'preventive_care',
  MEDICATION_MANAGEMENT = 'medication_management',
  REFERRAL_CONSULTATION = 'referral_consultation',
  OTHER = 'other'
}

/**
 * Preventive care history
 */
export interface PreventiveCareHistory {
  /** Last mammogram */
  lastMammogram?: Date;
  /** Last colonoscopy */
  lastColonoscopy?: Date;
  /** Last pap smear */
  lastPapSmear?: Date;
  /** Last bone density scan */
  lastBoneDensity?: Date;
  /** Last skin cancer screening */
  lastSkinScreening?: Date;
  /** Last eye exam */
  lastEyeExam?: Date;
  /** Last dental exam */
  lastDentalExam?: Date;
}

/**
 * Health concern interface
 */
export interface HealthConcern {
  /** Concern description */
  description: string;
  /** Severity level */
  severity: ConcernSeverity;
  /** Duration */
  duration: string;
  /** Impact on daily life */
  impact: ImpactLevel;
  /** Previous treatment */
  previousTreatment?: string;
}

/**
 * Concern severity levels
 */
export enum ConcernSeverity {
  MILD = 'mild',
  MODERATE = 'moderate',
  SEVERE = 'severe'
}

/**
 * Impact levels on daily life
 */
export enum ImpactLevel {
  NONE = 'none',
  MINIMAL = 'minimal',
  MODERATE = 'moderate',
  SIGNIFICANT = 'significant',
  SEVERE = 'severe'
}

/**
 * Lifestyle assessment
 */
export interface LifestyleAssessment {
  /** Diet quality */
  dietQuality: DietQuality;
  /** Exercise frequency */
  exerciseFrequency: ExerciseFrequency;
  /** Sleep quality */
  sleepQuality: SleepQuality;
  /** Stress level */
  stressLevel: StressLevel;
  /** Substance use */
  substanceUse: SubstanceUse;
}

/**
 * Diet quality assessment
 */
export interface DietQuality {
  /** Overall diet rating */
  overallRating: number; // 1-10 scale
  /** Servings of fruits/vegetables per day */
  fruitsVegetables: number;
  /** Fast food frequency per week */
  fastFoodFrequency: number;
  /** Water intake glasses per day */
  waterIntake: number;
  /** Special dietary restrictions */
  dietaryRestrictions?: string[];
}

/**
 * Exercise frequency assessment
 */
export interface ExerciseFrequency {
  /** Days per week of exercise */
  daysPerWeek: number;
  /** Minutes per session */
  minutesPerSession: number;
  /** Types of exercise */
  exerciseTypes: string[];
  /** Exercise limitations */
  limitations?: string[];
}

/**
 * Sleep quality assessment
 */
export interface SleepQuality {
  /** Average hours per night */
  hoursPerNight: number;
  /** Sleep quality rating */
  qualityRating: number; // 1-10 scale
  /** Sleep difficulties */
  difficulties: SleepDifficulty[];
  /** Sleep aid use */
  sleepAidUse: boolean;
}

/**
 * Sleep difficulties
 */
export enum SleepDifficulty {
  FALLING_ASLEEP = 'falling_asleep',
  STAYING_ASLEEP = 'staying_asleep',
  EARLY_WAKING = 'early_waking',
  SNORING = 'snoring',
  SLEEP_APNEA = 'sleep_apnea',
  RESTLESS_LEGS = 'restless_legs',
  NIGHTMARES = 'nightmares'
}

/**
 * Stress levels
 */
export enum StressLevel {
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

/**
 * Substance use assessment
 */
export interface SubstanceUse {
  /** Alcohol consumption */
  alcohol: AlcoholUse;
  /** Tobacco use */
  tobacco: TobaccoUse;
  /** Recreational drug use */
  recreationalDrugs: boolean;
  /** Caffeine intake */
  caffeineIntake: CaffeineIntake;
}

/**
 * Alcohol use details
 */
export interface AlcoholUse {
  /** Current use status */
  currentUse: boolean;
  /** Drinks per week */
  drinksPerWeek?: number;
  /** Binge drinking frequency */
  bingeDrinking?: BingeDrinkingFrequency;
}

/**
 * Tobacco use details
 */
export interface TobaccoUse {
  /** Current use status */
  currentUse: boolean;
  /** Type of tobacco */
  tobaccoType?: TobaccoType[];
  /** Packs per day */
  packsPerDay?: number;
  /** Years of use */
  yearsOfUse?: number;
  /** Quit attempts */
  quitAttempts?: number;
}

/**
 * Tobacco types
 */
export enum TobaccoType {
  CIGARETTES = 'cigarettes',
  CIGARS = 'cigars',
  PIPE = 'pipe',
  CHEWING_TOBACCO = 'chewing_tobacco',
  E_CIGARETTES = 'e_cigarettes'
}

/**
 * Binge drinking frequency
 */
export enum BingeDrinkingFrequency {
  NEVER = 'never',
  MONTHLY = 'monthly',
  WEEKLY = 'weekly',
  DAILY = 'daily'
}

/**
 * Caffeine intake levels
 */
export enum CaffeineIntake {
  NONE = 'none',
  LOW = 'low', // 1-2 cups per day
  MODERATE = 'moderate', // 3-4 cups per day
  HIGH = 'high' // 5+ cups per day
}

/**
 * Mental health screening
 */
export interface MentalHealthScreening {
  /** Depression screening score */
  depressionScore?: number;
  /** Anxiety screening score */
  anxietyScore?: number;
  /** Current mental health concerns */
  currentConcerns: string[];
  /** Previous mental health treatment */
  previousTreatment: boolean;
  /** Current mental health treatment */
  currentTreatment: boolean;
  /** Suicidal ideation screening */
  suicidalIdeation: boolean;
}

/**
 * Immunization record
 */
export interface Immunization {
  /** Vaccine name */
  vaccine: string;
  /** Date administered */
  dateAdministered: Date;
  /** Lot number */
  lotNumber?: string;
  /** Administering provider */
  provider?: string;
  /** Adverse reactions */
  adverseReactions?: string;
}

/**
 * Health maintenance item
 */
export interface HealthMaintenanceItem {
  /** Item description */
  description: string;
  /** Due date */
  dueDate: Date;
  /** Priority level */
  priority: MaintenancePriority;
  /** Category */
  category: MaintenanceCategory;
  /** Completion status */
  completed: boolean;
  /** Completion date */
  completionDate?: Date;
}

/**
 * Maintenance priority levels
 */
export enum MaintenancePriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

/**
 * Maintenance categories
 */
export enum MaintenanceCategory {
  SCREENING = 'screening',
  IMMUNIZATION = 'immunization',
  LABORATORY = 'laboratory',
  IMAGING = 'imaging',
  SPECIALIST_REFERRAL = 'specialist_referral',
  LIFESTYLE_COUNSELING = 'lifestyle_counseling'
}