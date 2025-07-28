/*
 * Copyright (c) 2025 WebQx. All rights reserved.
 * Unauthorized copying of this file, via any medium, is strictly prohibited.
 * Proprietary and confidential.
 */

/**
 * Type declarations for WebQX Prescription System
 * Includes browser API extensions and custom types
 */

import React from 'react';

export interface Medication {
  id: string;
  name: string;
  rxcui: string;
  genericName?: string;
  brandNames?: string[];
  dosageForm: string;
  strength: string;
  route: string;
  category: string;
}

export interface PrescriptionForm {
  id?: string;
  patientId: string;
  medicationId: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  refills: number;
  instructions: string;
  substitutionAllowed: boolean;
  priority: 'ROUTINE' | 'URGENT' | 'STAT';
  language: string;
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: 'M' | 'F' | 'O';
  allergies?: string[];
  currentMedications?: string[];
  medicalConditions?: string[];
}

export interface Prescriber {
  id: string;
  firstName: string;
  lastName: string;
  license: string;
  speciality: string;
  npi: string;
  dea?: string;
}

export interface FavoriteMedication {
  id: string;
  userId: string;
  medication: Medication;
  commonDosage?: string;
  commonFrequency?: string;
  notes?: string;
  addedDate: Date;
}

export interface RecentSearch {
  id: string;
  userId: string;
  searchTerm: string;
  resultCount: number;
  timestamp: Date;
}

export interface UserPreferences {
  userId: string;
  language: string;
  theme: 'light' | 'dark' | 'auto';
  autoTranslate: boolean;
  showTooltips: boolean;
  accessibilityMode: boolean;
  voiceControl: boolean;
}

export interface UITheme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    success: string;
    warning: string;
    error: string;
  };
  fonts: {
    primary: string;
    secondary: string;
    mono: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
}

export interface AccessibilityFeatures {
  screenReader: boolean;
  highContrast: boolean;
  largeText: boolean;
  keyboardNavigation: boolean;
  voiceControl: boolean;
  reducedMotion: boolean;
}

export interface ErrorInfo {
  code: string;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp: Date;
  context?: Record<string, any>;
  retryable: boolean;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  key: string;
}

export interface ServiceMetrics {
  serviceName: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastError?: ErrorInfo;
  uptime: number;
}

export interface SearchFilters {
  category?: string;
  dosageForm?: string;
  route?: string;
  prescription?: boolean;
  otc?: boolean;
}

export interface SearchResult {
  medication: Medication;
  relevanceScore: number;
  matchedFields: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TooltipContent {
  id: string;
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  trigger: 'hover' | 'click' | 'focus';
}

// Enums
export enum PrescriptionStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED'
}

export enum MedicationCategory {
  ANALGESIC = 'ANALGESIC',
  ANTIBIOTIC = 'ANTIBIOTIC',
  ANTIHYPERTENSIVE = 'ANTIHYPERTENSIVE',
  ANTIDIABETIC = 'ANTIDIABETIC',
  CARDIOVASCULAR = 'CARDIOVASCULAR',
  RESPIRATORY = 'RESPIRATORY',
  GASTROINTESTINAL = 'GASTROINTESTINAL',
  NEUROLOGICAL = 'NEUROLOGICAL',
  PSYCHIATRIC = 'PSYCHIATRIC',
  DERMATOLOGICAL = 'DERMATOLOGICAL',
  OTHER = 'OTHER'
}

export enum DosageForm {
  TABLET = 'TABLET',
  CAPSULE = 'CAPSULE',
  LIQUID = 'LIQUID',
  INJECTION = 'INJECTION',
  CREAM = 'CREAM',
  OINTMENT = 'OINTMENT',
  DROPS = 'DROPS',
  INHALER = 'INHALER',
  PATCH = 'PATCH',
  SUPPOSITORY = 'SUPPOSITORY'
}

export enum AdministrationRoute {
  ORAL = 'ORAL',
  TOPICAL = 'TOPICAL',
  INTRAVENOUS = 'INTRAVENOUS',
  INTRAMUSCULAR = 'INTRAMUSCULAR',
  SUBCUTANEOUS = 'SUBCUTANEOUS',
  INHALATION = 'INHALATION',
  NASAL = 'NASAL',
  OPHTHALMIC = 'OPHTHALMIC',
  OTIC = 'OTIC',
  RECTAL = 'RECTAL'
}

// Utility types
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Component prop types
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
  'data-testid'?: string;
}

export interface FormFieldProps extends BaseComponentProps {
  label: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  tooltip?: TooltipContent;
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  group?: string;
}

export interface AsyncSelectProps {
  loadOptions: (inputValue: string) => Promise<SelectOption[]>;
  placeholder: string;
  value?: SelectOption;
  onChange: (option: SelectOption | null) => void;
  isLoading?: boolean;
  debounceMs?: number;
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  errors?: string[];
  metadata?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Context types
export interface PrescriptionContextValue {
  currentPrescription: PrescriptionForm | null;
  setCurrentPrescription: (prescription: PrescriptionForm | null) => void;
  favorites: FavoriteMedication[];
  recentSearches: RecentSearch[];
  addToFavorites: (medication: Medication) => Promise<void>;
  removeFromFavorites: (medicationId: string) => Promise<void>;
  clearRecentSearches: () => void;
}

export interface LanguageContextValue {
  currentLanguage: string;
  supportedLanguages: Array<{ code: string; name: string; nativeName: string }>;
  changeLanguage: (languageCode: string) => void;
  translate: (text: string, targetLanguage?: string) => Promise<string>;
  isTranslating: boolean;
}

export interface ThemeContextValue {
  theme: UITheme;
  themeName: 'light' | 'dark';
  toggleTheme: () => void;
  setTheme: (themeName: 'light' | 'dark') => void;
}

export interface AccessibilityContextValue {
  features: AccessibilityFeatures;
  updateFeatures: (features: Partial<AccessibilityFeatures>) => void;
  announceToScreenReader: (message: string) => void;
}

// Hook types
export interface UseAsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  execute: (...args: any[]) => Promise<void>;
  reset: () => void;
}

export interface UseDebounce<T> {
  debouncedValue: T;
  isDebouncing: boolean;
}

export interface UsePagination {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  setPageSize: (size: number) => void;
}

// Test types
export interface MockData {
  medications: Medication[];
  prescriptions: PrescriptionForm[];
  patients: Patient[];
  prescribers: Prescriber[];
}

export interface TestUtils {
  renderWithProviders: (component: React.ReactElement) => any;
  createMockMedication: (overrides?: Partial<Medication>) => Medication;
  createMockPrescription: (overrides?: Partial<PrescriptionForm>) => PrescriptionForm;
  waitForAsyncOperation: () => Promise<void>;
}