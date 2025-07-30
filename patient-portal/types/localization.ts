/**
 * Localization types and interfaces for WebQX Patient Portal
 */

export type SupportedLanguage = 'en' | 'es' | 'fr' | 'de' | 'zh';

export interface LocalizationTexts {
  // Header texts
  portalTitle: string;
  portalTagline: string;
  welcomeBack: string;
  languageLabel: string;
  
  // Section titles
  appointments: string;
  quickActions: string;
  healthOverview: string;
  healthEducation: string;
  emergencyInfo: string;
  
  // Quick action buttons
  scheduleAppointment: string;
  viewLabResults: string;
  messageProvider: string;
  refillPrescription: string;
  
  // Health overview
  recentVitals: string;
  healthAlerts: string;
  
  // Emergency
  emergencyNotice: string;
  urgentCare: string;
}

export interface LanguageOption {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
}