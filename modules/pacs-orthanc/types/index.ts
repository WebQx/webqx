/**
 * WebQX™ Orthanc PACS Integration - Type Definitions
 * Common types and interfaces for all PACS plugins
 */

// DICOM and Orthanc Types
export interface DicomStudy {
  id: string;
  patientId: string;
  studyInstanceUID: string;
  studyDate: string;
  studyTime?: string;
  studyDescription?: string;
  modality: string;
  institution?: string;
  referringPhysician?: string;
  accessionNumber?: string;
  numberOfSeries: number;
  numberOfInstances: number;
  metadata: Record<string, any>;
  tags: DicomTags;
}

export interface DicomSeries {
  id: string;
  studyId: string;
  seriesInstanceUID: string;
  seriesNumber: string;
  seriesDescription?: string;
  modality: string;
  numberOfInstances: number;
  instances: DicomInstance[];
}

export interface DicomInstance {
  id: string;
  seriesId: string;
  sopInstanceUID: string;
  instanceNumber: string;
  imageType?: string;
  acquisitionDate?: string;
  acquisitionTime?: string;
  contentDate?: string;
  contentTime?: string;
  fileSize: number;
  metadata: Record<string, any>;
}

export interface DicomTags {
  PatientName?: string;
  PatientID?: string;
  PatientBirthDate?: string;
  PatientSex?: string;
  StudyInstanceUID?: string;
  SeriesInstanceUID?: string;
  SOPInstanceUID?: string;
  StudyDate?: string;
  StudyTime?: string;
  StudyDescription?: string;
  SeriesDescription?: string;
  Modality?: string;
  InstitutionName?: string;
  ReferringPhysicianName?: string;
  AccessionNumber?: string;
  [key: string]: any;
}

// Cloud Storage Types
export interface CloudStorageConfig {
  provider: 'aws' | 'azure' | 'gcp';
  region: string;
  bucketName: string;
  credentials: CloudStorageCredentials;
  retentionPolicy: RetentionPolicy;
  encryptionEnabled: boolean;
  compressionEnabled: boolean;
  pathTemplate: string; // e.g., "{year}/{month}/{studyId}/{seriesId}"
}

export interface CloudStorageCredentials {
  aws?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
  azure?: {
    accountName: string;
    accountKey: string;
    connectionString?: string;
  };
  gcp?: {
    projectId: string;
    keyFilename?: string;
    credentials?: any;
  };
}

export interface RetentionPolicy {
  defaultRetentionDays: number;
  modalitySpecificRetention: Record<string, number>;
  archiveAfterDays: number;
  deleteAfterDays?: number;
  glacierTransitionDays?: number;
}

export interface StorageMetadata {
  originalPath: string;
  cloudPath: string;
  uploadedAt: Date;
  lastAccessedAt: Date;
  fileSize: number;
  checksum: string;
  isArchived: boolean;
  encryptionKey?: string;
}

// Search and Indexing Types
export interface SearchQuery {
  patientId?: string;
  patientName?: string;
  studyDate?: {
    from?: string;
    to?: string;
  };
  modality?: string[];
  studyDescription?: string;
  accessionNumber?: string;
  institution?: string;
  tags?: Record<string, any>;
  fullTextSearch?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult {
  total: number;
  studies: DicomStudy[];
  facets?: SearchFacets;
  executionTimeMs: number;
}

export interface SearchFacets {
  modalities: Record<string, number>;
  institutions: Record<string, number>;
  dateRanges: Record<string, number>;
}

export interface IndexedMetadata {
  studyId: string;
  patientId: string;
  extractedText: string;
  keyValuePairs: Record<string, any>;
  indexedAt: Date;
  searchableText: string;
  facetValues: Record<string, string[]>;
}

// RBAC Types
export interface RBACConfig {
  enabled: boolean;
  defaultPermissions: Permission[];
  roleHierarchy: Record<string, string[]>;
  auditLogging: boolean;
  sessionTimeout: number;
  mfaRequired: boolean;
}

export interface Permission {
  resource: ResourceType;
  action: ActionType;
  conditions?: PermissionCondition[];
}

export type ResourceType = 
  | 'study'
  | 'series' 
  | 'instance'
  | 'patient'
  | 'modality'
  | 'institution'
  | 'system';

export type ActionType = 
  | 'read'
  | 'write'
  | 'delete'
  | 'download'
  | 'share'
  | 'annotate'
  | 'export'
  | 'admin';

export interface PermissionCondition {
  field: string;
  operator: 'equals' | 'contains' | 'in' | 'not_in' | 'date_range';
  value: any;
}

export interface UserContext {
  userId: string;
  username: string;
  roles: string[];
  permissions: Permission[];
  institutionId?: string;
  departmentId?: string;
  specialties: string[];
  sessionId: string;
  isActive: boolean;
  lastActivity: Date;
}

export interface AccessLog {
  userId: string;
  resource: string;
  action: ActionType;
  allowed: boolean;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  reasoning?: string;
}

// Multilingual Types
export interface MultilingualConfig {
  defaultLanguage: string;
  supportedLanguages: string[];
  autoDetectLanguage: boolean;
  translationProvider: 'google' | 'azure' | 'aws' | 'local';
  cacheTranslations: boolean;
  translationQuality: 'high' | 'medium' | 'fast';
}

export interface TranslatedMetadata {
  originalLanguage: string;
  translations: Record<string, Record<string, string>>;
  translatedAt: Date;
  translationProvider: string;
  confidence?: number;
}

export interface LanguagePreference {
  userId: string;
  preferredLanguage: string;
  fallbackLanguages: string[];
  dateFormat: string;
  timeFormat: string;
  numberFormat: string;
}

// Image Viewing Types
export interface ImageViewingConfig {
  enableThumbnails: boolean;
  thumbnailSizes: number[];
  maxPreviewSize: number;
  imageFormats: string[];
  compressionQuality: number;
  cacheEnabled: boolean;
  cacheExpirationHours: number;
  watermarkEnabled: boolean;
  allowDownload: boolean;
}

export interface ImagePreview {
  instanceId: string;
  sizes: ImageSize[];
  format: string;
  generatedAt: Date;
  cacheKey: string;
  watermarked: boolean;
  downloadAllowed: boolean;
}

export interface ImageSize {
  width: number;
  height: number;
  url: string;
  fileSize: number;
  mimeType: string;
}

// Common Plugin Types
export interface PluginConfig {
  enabled: boolean;
  priority: number;
  dependencies: string[];
  healthCheckEndpoint?: string;
  metrics: PluginMetrics;
}

export interface PluginMetrics {
  enabled: boolean;
  metricsEndpoint: string;
  collectionInterval: number;
  retentionDays: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
  version: string;
}

export interface PluginError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  pluginName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// Orthanc Integration Types
export interface OrthancConfig {
  baseUrl: string;
  username?: string;
  password?: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  ssl: {
    enabled: boolean;
    verifySSL: boolean;
    certPath?: string;
  };
}

export interface OrthancResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode: number;
  headers: Record<string, string>;
}

// Event Types
export interface DicomEvent {
  type: 'study_created' | 'study_updated' | 'study_deleted' | 'instance_uploaded';
  studyId?: string;
  seriesId?: string;
  instanceId?: string;
  metadata: Record<string, any>;
  timestamp: Date;
  source: string;
}

export interface PluginEvent {
  type: 'plugin_enabled' | 'plugin_disabled' | 'plugin_error' | 'health_check';
  pluginName: string;
  data: any;
  timestamp: Date;
}