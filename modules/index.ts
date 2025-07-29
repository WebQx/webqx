/**
 * Specialty Modules Index
 * 
 * Central export file for all specialty medical modules in the WebQX platform.
 * Each module implements the same enhancements:
 * - Error handling for EHR system interactions
 * - Loading states for better user experience
 * - Explicit TypeScript types
 * - Accessibility attributes (ARIA labels, etc.)
 * - Detailed logging for operations
 * - Code comments for maintainability
 */

// Cardiology Module
export { CardiologyIntake } from './specialty-cardiology/components/CardiologyIntake';
export type { 
  CardiologyIntakeProps,
  CardiologyIntakeData,
  CardiologySpecialtyData,
  CardiovascularSymptoms,
  CardiacRiskFactors
} from './specialty-cardiology/types';

// Primary Care Module
export { PrimaryCareIntake } from './specialty-primary-care/components/PrimaryCareIntake';
export type { 
  PrimaryCareIntakeProps,
  PrimaryCareIntakeData,
  PrimaryCareSpecialtyData,
  LifestyleAssessment,
  MentalHealthScreening
} from './specialty-primary-care/types';

// Neurology Module
export { NeurologyIntake } from './specialty-neurology/components/NeurologyIntake';
export type { 
  NeurologyIntakeProps,
  NeurologyIntakeData,
  NeurologySpecialtyData
} from './specialty-neurology/types';

// Orthopedics Module
export { OrthopedicsIntake } from './specialty-orthopedics/components/OrthopedicsIntake';
export type { 
  OrthopedicsIntakeProps,
  OrthopedicsIntakeData,
  OrthopedicsSpecialtyData
} from './specialty-orthopedics/types';

// Pediatrics Module
export { PediatricsIntake } from './specialty-pediatrics/components/PediatricsIntake';
export type { 
  PediatricsIntakeProps,
  PediatricsIntakeData,
  PediatricsSpecialtyData
} from './specialty-pediatrics/types';

// Radiology Module
export { RadiologyIntake } from './specialty-radiology/components/RadiologyIntake';
export type { 
  RadiologyIntakeProps,
  RadiologyIntakeData,
  RadiologySpecialtyData
} from './specialty-radiology/types';

// Pulmonology Module
export { PulmonologyIntake } from './specialty-pulmonology/components/PulmonologyIntake';
export type { 
  PulmonologyIntakeProps,
  PulmonologyIntakeData,
  PulmonologySpecialtyData
} from './specialty-pulmonology/types';

// Endocrinology Module
export { EndocrinologyIntake } from './specialty-endocrinology/components/EndocrinologyIntake';
export type { 
  EndocrinologyIntakeProps,
  EndocrinologyIntakeData,
  EndocrinologySpecialtyData
} from './specialty-endocrinology/types';

// Gastroenterology Module
export { GastroenterologyIntake } from './specialty-gastroenterology/components/GastroenterologyIntake';
export type { 
  GastroenterologyIntakeProps,
  GastroenterologyIntakeData,
  GastroenterologySpecialtyData
} from './specialty-gastroenterology/types';

// Dermatology Module
export { DermatologyIntake } from './specialty-dermatology/components/DermatologyIntake';
export type { 
  DermatologyIntakeProps,
  DermatologyIntakeData,
  DermatologySpecialtyData
} from './specialty-dermatology/types';

/**
 * Registry of all available specialty modules
 */
export const SPECIALTY_MODULES = {
  cardiology: {
    name: 'Cardiology',
    description: 'Heart and cardiovascular system care',
    component: 'CardiologyIntake',
    icon: '💗'
  },
  'primary-care': {
    name: 'Primary Care',
    description: 'Comprehensive primary healthcare services',
    component: 'PrimaryCareIntake',
    icon: '🏥'
  },
  neurology: {
    name: 'Neurology',
    description: 'Brain and nervous system conditions',
    component: 'NeurologyIntake',
    icon: '🧠'
  },
  orthopedics: {
    name: 'Orthopedics',
    description: 'Bone, joint, and muscle care',
    component: 'OrthopedicsIntake',
    icon: '🦴'
  },
  pediatrics: {
    name: 'Pediatrics',
    description: 'Children and adolescent healthcare',
    component: 'PediatricsIntake',
    icon: '👶'
  },
  radiology: {
    name: 'Radiology',
    description: 'Medical imaging and diagnostics',
    component: 'RadiologyIntake',
    icon: '📷'
  },
  pulmonology: {
    name: 'Pulmonology',
    description: 'Lung and respiratory system care',
    component: 'PulmonologyIntake',
    icon: '🫁'
  },
  endocrinology: {
    name: 'Endocrinology',
    description: 'Hormones and metabolic disorders',
    component: 'EndocrinologyIntake',
    icon: '⚗️'
  },
  gastroenterology: {
    name: 'Gastroenterology',
    description: 'Digestive system disorders',
    component: 'GastroenterologyIntake',
    icon: '🫃'
  },
  dermatology: {
    name: 'Dermatology',
    description: 'Skin, hair, and nail conditions',
    component: 'DermatologyIntake',
    icon: '🧴'
  }
} as const;

/**
 * Type for specialty module keys
 */
export type SpecialtyKey = keyof typeof SPECIALTY_MODULES;

/**
 * Get specialty module information by key
 */
export function getSpecialtyModule(key: SpecialtyKey) {
  return SPECIALTY_MODULES[key];
}

/**
 * Get all available specialty keys
 */
export function getAvailableSpecialties(): SpecialtyKey[] {
  return Object.keys(SPECIALTY_MODULES) as SpecialtyKey[];
}

/**
 * Check if a specialty key is valid
 */
export function isValidSpecialty(key: string): key is SpecialtyKey {
  return key in SPECIALTY_MODULES;
}

/**
 * Standards and Guidelines for Specialty Modules
 * 
 * All specialty modules in this platform must implement:
 * 
 * 1. **Error Handling**: Comprehensive error handling with user-friendly messages
 *    - Use EHRError interface for consistent error structure
 *    - Implement retry logic for failed operations
 *    - Provide clear error messages to users
 * 
 * 2. **Loading States**: Visual indicators for ongoing operations
 *    - Show loading overlays during form submission
 *    - Disable form interactions during loading
 *    - Provide progress indicators where applicable
 * 
 * 3. **TypeScript Types**: Explicit typing for all functions, props, and state
 *    - Define specialty-specific data interfaces
 *    - Use generics for reusable components
 *    - Implement strict type checking
 * 
 * 4. **Accessibility**: ARIA attributes and compliance with accessibility standards
 *    - Use semantic HTML elements
 *    - Provide aria-labels for all interactive elements
 *    - Implement keyboard navigation support
 *    - Ensure screen reader compatibility
 * 
 * 5. **Logging**: Detailed logging for success/failure status and error details
 *    - Log all user interactions
 *    - Track form submission events
 *    - Monitor error occurrences
 *    - Include contextual metadata
 * 
 * 6. **Code Comments**: Clear documentation for maintainability
 *    - Document all public interfaces
 *    - Explain complex business logic
 *    - Provide usage examples
 *    - Keep comments up to date
 */