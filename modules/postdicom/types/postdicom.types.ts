/**
 * TypeScript type definitions for PostDICOM integration module
 * Defines interfaces and types for medical imaging workflows
 */

// Cloud Storage Provider Types
export type CloudProvider = 'aws' | 'gcp' | 'azure';

export interface CloudCredentials {
  accessKey?: string;
  secretKey?: string;
  region?: string;
  projectId?: string; // GCP
  tenantId?: string;  // Azure
  clientId?: string;  // Azure
  clientSecret?: string; // Azure
}

export interface StorageConfig {
  provider: CloudProvider;
  credentials: CloudCredentials;
  bucketName: string;
  encryption: boolean;
  retentionDays: number;
  compressionLevel?: number;
}

// DICOM Study and Image Types
export interface DICOMStudy {
  studyInstanceUID: string;
  patientID: string;
  patientName: string;
  studyDate: string;
  studyTime?: string;
  studyDescription?: string;
  modality: string;
  seriesCount: number;
  imageCount: number;
  studySize: number; // in bytes
  accessLevel: AccessLevel;
  createdAt: Date;
  updatedAt: Date;
}

export interface DICOMSeries {
  seriesInstanceUID: string;
  studyInstanceUID: string;
  seriesNumber: number;
  modality: string;
  seriesDescription?: string;
  imageCount: number;
  bodyPart?: string;
  acquisitionDate?: string;
}

export interface DICOMImage {
  sopInstanceUID: string;
  seriesInstanceUID: string;
  instanceNumber: number;
  imageType: string;
  rows: number;
  columns: number;
  bitsAllocated: number;
  imageSize: number; // in bytes
  compressionType?: string;
  transferSyntax: string;
  storageUrl: string;
  thumbnailUrl?: string;
  metadata: Record<string, any>;
}

// Access Control Types
export type UserRole = 'patient' | 'provider' | 'radiologist' | 'admin' | 'researcher';
export type AccessLevel = 'public' | 'restricted' | 'confidential' | 'top-secret';

export interface UserPermissions {
  userId: string;
  role: UserRole;
  specialties: string[];
  accessLevels: AccessLevel[];
  canView: boolean;
  canDownload: boolean;
  canShare: boolean;
  canDelete: boolean;
  canAnnotate: boolean;
}

export interface AccessControlConfig {
  enableRBAC: boolean;
  defaultAccessLevel: AccessLevel;
  auditLogging: boolean;
  sessionTimeout: number; // in minutes
  maxConcurrentSessions: number;
}

// API Configuration Types
export interface PostDICOMAPIConfig {
  baseUrl: string;
  apiKey: string;
  version: string;
  timeout: number; // in milliseconds
  retryAttempts: number;
  rateLimitPerMinute: number;
}

// Performance and Caching Types
export interface CacheConfig {
  enableCaching: boolean;
  cacheProvider: 'memory' | 'redis' | 'filesystem';
  maxCacheSize: string; // e.g., '10GB'
  cacheTTL: number; // in seconds
  preFetchEnabled: boolean;
  preFetchRules: PreFetchRule[];
}

export interface PreFetchRule {
  name: string;
  condition: string; // e.g., 'specialty === radiology'
  priority: number;
  maxImages: number;
  enabled: boolean;
}

// Main Configuration Type
export interface PostDICOMConfig {
  storage: StorageConfig;
  api: PostDICOMAPIConfig;
  accessControl: AccessControlConfig;
  performance: CacheConfig;
  compliance: ComplianceConfig;
}

export interface ComplianceConfig {
  enableHIPAALogging: boolean;
  dataRetentionDays: number;
  encryptionAtRest: boolean;
  encryptionInTransit: boolean;
  auditLogRetentionDays: number;
  anonymizeExports: boolean;
}

// API Request/Response Types
export interface StudySearchParams {
  patientID?: string;
  studyDate?: string;
  studyDateRange?: {
    start: string;
    end: string;
  };
  modality?: string;
  specialty?: string;
  accessLevel?: AccessLevel;
  limit?: number;
  offset?: number;
  sortBy?: 'studyDate' | 'patientName' | 'modality';
  sortOrder?: 'asc' | 'desc';
}

export interface StudyUploadRequest {
  files: File[];
  patientID: string;
  studyDescription?: string;
  modality: string;
  accessLevel: AccessLevel;
  metadata?: Record<string, any>;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    totalCount?: number;
    pageSize?: number;
    currentPage?: number;
    hasMore?: boolean;
  };
}

// Audit and Logging Types
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId: string;
  userRole: UserRole;
  action: string;
  resourceType: 'study' | 'series' | 'image';
  resourceId: string;
  patientID: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

// Dashboard Component Props Types
export interface DICOMViewerProps {
  studyInstanceUID: string;
  seriesInstanceUID?: string;
  sopInstanceUID?: string;
  viewerConfig?: ViewerConfig;
  onImageLoad?: (image: DICOMImage) => void;
  onError?: (error: Error) => void;
}

export interface ViewerConfig {
  enableMeasurements: boolean;
  enableAnnotations: boolean;
  enableZoom: boolean;
  enablePan: boolean;
  enableRotation: boolean;
  enableWindowLevel: boolean;
  showThumbnails: boolean;
  showMetadata: boolean;
}

export interface ImageLibraryProps {
  patientID?: string;
  searchParams?: StudySearchParams;
  onStudySelect?: (study: DICOMStudy) => void;
  onImageSelect?: (image: DICOMImage) => void;
  showUploadButton?: boolean;
  userPermissions: UserPermissions;
}

export interface AdminPanelProps {
  config: PostDICOMConfig;
  onConfigUpdate: (config: PostDICOMConfig) => Promise<void>;
  auditLogs: AuditLogEntry[];
  userPermissions: UserPermissions;
}

// Service Interface Types
export interface IStorageService {
  uploadStudy(request: StudyUploadRequest): Promise<APIResponse<DICOMStudy>>;
  downloadImage(sopInstanceUID: string): Promise<APIResponse<Blob>>;
  deleteStudy(studyInstanceUID: string): Promise<APIResponse<void>>;
  getStorageStats(): Promise<APIResponse<StorageStats>>;
  validateRetentionPolicy(): Promise<APIResponse<RetentionReport>>;
}

export interface StorageStats {
  totalStudies: number;
  totalImages: number;
  totalSize: number; // in bytes
  storageUtilization: number; // percentage
  oldestStudy: Date;
  newestStudy: Date;
}

export interface RetentionReport {
  eligibleForDeletion: DICOMStudy[];
  totalSizeToDelete: number;
  estimatedSavings: number;
}

export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  getStats(): Promise<CacheStats>;
  preFetch(rules: PreFetchRule[]): Promise<void>;
}

export interface CacheStats {
  hitRate: number;
  missRate: number;
  totalRequests: number;
  cacheSize: number; // in bytes
  itemCount: number;
  oldestItem: Date;
  newestItem: Date;
}

// Error Types
export class PostDICOMError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'PostDICOMError';
  }
}

export const ERROR_CODES = {
  INVALID_DICOM_FILE: 'INVALID_DICOM_FILE',
  STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',
  ACCESS_DENIED: 'ACCESS_DENIED',
  STUDY_NOT_FOUND: 'STUDY_NOT_FOUND',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  CACHE_ERROR: 'CACHE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  COMPLIANCE_VIOLATION: 'COMPLIANCE_VIOLATION',
  RETENTION_POLICY_ERROR: 'RETENTION_POLICY_ERROR'
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];