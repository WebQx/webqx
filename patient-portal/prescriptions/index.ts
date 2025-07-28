/*
 * Copyright (c) 2025 WebQx. All rights reserved.
 * Unauthorized copying of this file, via any medium, is strictly prohibited.
 * Proprietary and confidential.
 */

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
export { default as ThemeProvider, ThemeToggle, useTheme } from './components/ThemeProvider';
export { default as VoiceControl, useVoiceControl } from './components/VoiceControl';
export { default as PrescriptionSystemDemo } from './components/PrescriptionSystemDemo';

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