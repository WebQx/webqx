/**
 * Main exports for the Prescription System
 * Provides comprehensive prescription management with enhanced features
 */

// Services
export { default as rxnormService } from './services/rxnormService';
export { default as whisperTranslator } from './services/whisperTranslator';
export { default as ehrExporter } from './services/ehrExporter';

// Components
export { default as MedicationSearch } from './components/MedicationSearch';
export { default as PrescriptionForm } from './components/PrescriptionForm';
export { default as LanguageToggle } from './components/LanguageToggle';
export { default as FormField } from './components/FormField';
export { default as Tooltip } from './components/Tooltip';

// Hooks
export * from './hooks';

// Types
export * from './types';

// Service Types
export type {
  DrugInfo,
  DrugInteraction,
  FDAWarning
} from './services/rxnormService';

export type {
  TranslationResult,
  SupportedLanguage,
  TranslationError
} from './services/whisperTranslator';

export type {
  PrescriptionData,
  ExportFormat,
  ExportOptions,
  PrescriptionSummary
} from './services/ehrExporter';