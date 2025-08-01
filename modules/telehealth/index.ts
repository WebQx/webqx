// Telehealth Module Exports
// Main components for provider and patient interfaces
export { TelehealthProvider } from './components/TelehealthProvider';
export { TelehealthPatient } from './components/TelehealthPatient';

// Core services
export { AmbientDocumentationService } from './services/AmbientDocumentationService';
export { TelehealthMessagingService } from './services/TelehealthMessagingService';

// FHIR models
export { default as ClinicalNote } from './models/ClinicalNote';

// i18n utilities
export { languageManager, supportedLanguages } from './utils/i18n';
export { default as telehealthI18n, TelehealthLanguageManager } from './utils/i18n';

// Type definitions
export interface TelehealthSession {
  sessionId: string;
  patientId: string;
  providerId: string;
  specialtyContext?: string;
  language?: string;
  enableRealTime?: boolean;
}

export interface PostVisitSummary {
  sessionId: string;
  patientId: string;
  providerId: string;
  visitDate: string;
  summary: string;
  diagnosis?: string[];
  medications?: any[];
  followUpInstructions?: string;
  nextAppointment?: string;
  language?: string;
}

export interface FHIRMessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  deliveryStatus?: 'sent' | 'delivered' | 'failed';
}

export interface AmbientDocumentationResult {
  success: boolean;
  clinicalNote?: any;
  transcriptionText?: string;
  metadata?: any;
  error?: string;
}

// Version information
export const TELEHEALTH_MODULE_VERSION = '1.0.0';

// Default configuration
export const DEFAULT_CONFIG = {
  supportedLanguages: ['en', 'es', 'fr'],
  defaultLanguage: 'en',
  enableTranscription: true,
  enableMessaging: true,
  specialtyContexts: [
    'primary-care',
    'cardiology',
    'radiology',
    'psychiatry',
    'neurology',
    'pulmonology',
    'oncology'
  ]
};