/**
 * TypeScript definitions for WebQX™ OHIF Viewer Integration
 * 
 * This file contains type definitions for the OHIF viewer integration,
 * including custom plugins, workflows, and API interfaces.
 */

import { StudyMetadata, SeriesMetadata } from '@ohif/core/src/types';

// ============================================================================
// Core Types
// ============================================================================

export interface WebQXUser {
  id: string;
  role: UserRole;
  permissions: Permission[];
  preferences: UserPreferences;
  language: string;
  specialty?: MedicalSpecialty;
}

export type UserRole = 
  | 'admin'
  | 'radiologist' 
  | 'physician'
  | 'technician'
  | 'nurse'
  | 'student'
  | 'patient';

export type Permission = 
  | 'view_images'
  | 'annotate_images'
  | 'measure_images'
  | 'download_images'
  | 'share_studies'
  | 'edit_metadata'
  | 'admin_settings';

export type MedicalSpecialty =
  | 'radiology'
  | 'cardiology'
  | 'oncology'
  | 'neurology'
  | 'orthopedics'
  | 'primary_care'
  | 'emergency'
  | 'pathology';

// ============================================================================
// Workflow Types
// ============================================================================

export interface ImagingWorkflow {
  id: string;
  name: string;
  specialty: MedicalSpecialty;
  steps: WorkflowStep[];
  permissions: Permission[];
  uiConfig: UIConfiguration;
}

export interface WorkflowStep {
  id: string;
  name: string;
  order: number;
  required: boolean;
  tools: string[];
  validations?: ValidationRule[];
}

export interface ValidationRule {
  field: string;
  type: 'required' | 'format' | 'range';
  value?: any;
  message: string;
}

// ============================================================================
// UI Configuration Types
// ============================================================================

export interface UIConfiguration {
  layout: LayoutConfig;
  panels: PanelConfig[];
  tools: ToolConfig[];
  theme: ThemeConfig;
}

export interface LayoutConfig {
  type: 'grid' | 'stack' | 'hanging-protocol';
  rows: number;
  columns: number;
  viewports: ViewportConfig[];
}

export interface ViewportConfig {
  id: string;
  position: { row: number; col: number };
  defaultTool?: string;
  initialSeries?: string;
}

export interface PanelConfig {
  id: string;
  position: 'left' | 'right' | 'top' | 'bottom';
  width?: number;
  height?: number;
  collapsible: boolean;
  defaultCollapsed: boolean;
  components: string[];
}

export interface ToolConfig {
  id: string;
  name: string;
  icon: string;
  category: ToolCategory;
  permissions: Permission[];
  enabled: boolean;
  configuration?: Record<string, any>;
}

export type ToolCategory = 
  | 'measurement'
  | 'annotation'
  | 'manipulation'
  | 'export'
  | 'analysis';

// ============================================================================
// Study & Series Types
// ============================================================================

export interface WebQXStudyMetadata extends StudyMetadata {
  webqxPatientId: string;
  accessibleBy: UserRole[];
  workflow?: string;
  priority: StudyPriority;
  clinicalContext?: ClinicalContext;
  annotations?: StudyAnnotation[];
}

export interface WebQXSeriesMetadata extends SeriesMetadata {
  processingStatus: ProcessingStatus;
  qualityMetrics?: QualityMetrics;
  aiAnalysis?: AIAnalysisResult[];
}

export type StudyPriority = 'urgent' | 'high' | 'normal' | 'low';

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ClinicalContext {
  indication: string;
  clinicalHistory: string;
  referringPhysician: string;
  urgency: StudyPriority;
  specialty: MedicalSpecialty;
}

// ============================================================================
// Annotation Types
// ============================================================================

export interface StudyAnnotation {
  id: string;
  type: AnnotationType;
  authorId: string;
  authorRole: UserRole;
  timestamp: Date;
  content: AnnotationContent;
  visibility: AnnotationVisibility;
  metadata?: Record<string, any>;
}

export type AnnotationType = 
  | 'text'
  | 'arrow'
  | 'circle'
  | 'rectangle'
  | 'polygon'
  | 'measurement'
  | 'markup';

export interface AnnotationContent {
  text?: string;
  coordinates: number[];
  measurements?: MeasurementData;
  style?: AnnotationStyle;
}

export interface MeasurementData {
  value: number;
  unit: string;
  type: MeasurementType;
  accuracy?: number;
}

export type MeasurementType = 
  | 'length'
  | 'area'
  | 'volume'
  | 'angle'
  | 'density'
  | 'time';

export interface AnnotationStyle {
  color: string;
  thickness: number;
  opacity: number;
  font?: string;
}

export type AnnotationVisibility = 'public' | 'private' | 'role-restricted';

// ============================================================================
// Performance & Optimization Types
// ============================================================================

export interface CacheConfiguration {
  maxSize: number; // in MB
  ttl: number; // in seconds
  strategy: CacheStrategy;
  compression: boolean;
}

export type CacheStrategy = 'lru' | 'lfu' | 'ttl' | 'manual';

export interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  memoryUsage: number;
  networkLatency: number;
  cacheHitRate: number;
}

export interface QualityMetrics {
  imageQuality: number; // 0-1 scale
  compression: number;
  artifacts: string[];
  resolution: { width: number; height: number };
}

// ============================================================================
// API Types
// ============================================================================

export interface ImagingAPIRequest {
  studyInstanceUID: string;
  seriesInstanceUID?: string;
  imageInstanceUID?: string;
  userId: string;
  sessionId?: string;
  parameters?: Record<string, any>;
}

export interface ImagingAPIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: APIError;
  metadata?: ResponseMetadata;
}

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface ResponseMetadata {
  requestId: string;
  timestamp: Date;
  processingTime: number;
  cacheHit: boolean;
}

// ============================================================================
// AI Analysis Types
// ============================================================================

export interface AIAnalysisResult {
  id: string;
  algorithm: string;
  version: string;
  confidence: number;
  findings: AIFinding[];
  processingTime: number;
  timestamp: Date;
}

export interface AIFinding {
  type: string;
  description: string;
  confidence: number;
  location?: number[];
  severity?: 'low' | 'medium' | 'high' | 'critical';
  recommendations?: string[];
}

// ============================================================================
// Internationalization Types
// ============================================================================

export interface LocalizationConfig {
  defaultLanguage: string;
  supportedLanguages: string[];
  fallbackLanguage: string;
  namespaces: string[];
}

export interface TranslationResources {
  [language: string]: {
    [namespace: string]: Record<string, string>;
  };
}

// ============================================================================
// Plugin Types
// ============================================================================

export interface WebQXPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  dependencies: string[];
  configuration: PluginConfiguration;
  lifecycle: PluginLifecycle;
}

export interface PluginConfiguration {
  enabled: boolean;
  settings: Record<string, any>;
  permissions: Permission[];
  autoStart: boolean;
}

export interface PluginLifecycle {
  initialize?: () => Promise<void>;
  activate?: () => Promise<void>;
  deactivate?: () => Promise<void>;
  destroy?: () => Promise<void>;
}

// ============================================================================
// Theme Types
// ============================================================================

export interface ThemeConfig {
  name: string;
  colors: ColorScheme;
  typography: TypographyConfig;
  spacing: SpacingConfig;
  animations: AnimationConfig;
}

export interface ColorScheme {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  border: string;
  accent: string;
  warning: string;
  error: string;
  success: string;
}

export interface TypographyConfig {
  fontFamily: string;
  fontSize: Record<string, string>;
  fontWeight: Record<string, number>;
  lineHeight: Record<string, number>;
}

export interface SpacingConfig {
  unit: number;
  scale: number[];
}

export interface AnimationConfig {
  duration: Record<string, number>;
  easing: Record<string, string>;
}

// ============================================================================
// User Preferences Types
// ============================================================================

export interface UserPreferences {
  language: string;
  theme: string;
  defaultLayout: string;
  autoSave: boolean;
  notifications: NotificationPreferences;
  performance: PerformancePreferences;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sound: boolean;
  types: string[];
}

export interface PerformancePreferences {
  imageQuality: 'low' | 'medium' | 'high';
  cacheSize: number;
  prefetchEnabled: boolean;
  compressionLevel: number;
}