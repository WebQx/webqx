/**
 * PACS Integration Types
 * 
 * TypeScript definitions for PACS integration including DICOM entities,
 * specialty workflows, and service configurations.
 */

// DICOM Study and Series Types
export interface DICOMStudy {
  studyInstanceUID: string;
  patientID: string;
  patientName: string;
  studyDate: string;
  studyTime?: string;
  studyDescription?: string;
  modality: string;
  accessionNumber?: string;
  referringPhysician?: string;
  specialty: MedicalSpecialty;
  seriesCount: number;
  instanceCount: number;
  status: StudyStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface DICOMSeries {
  seriesInstanceUID: string;
  studyInstanceUID: string;
  seriesNumber: number;
  seriesDescription?: string;
  modality: string;
  instanceCount: number;
  bodyPart?: string;
  viewPosition?: string;
  protocolName?: string;
}

export interface DICOMInstance {
  sopInstanceUID: string;
  seriesInstanceUID: string;
  instanceNumber: number;
  sopClassUID: string;
  transferSyntaxUID?: string;
  imageType?: string[];
  rows?: number;
  columns?: number;
  bitsAllocated?: number;
  bitsStored?: number;
  pixelSpacing?: [number, number];
  windowCenter?: number;
  windowWidth?: number;
}

// Medical Specialty Types
export type MedicalSpecialty = 
  | 'radiology' 
  | 'cardiology' 
  | 'orthopedics' 
  | 'neurology' 
  | 'oncology' 
  | 'pulmonology' 
  | 'gastroenterology' 
  | 'pediatrics' 
  | 'emergency' 
  | 'primary-care';

export type StudyStatus = 
  | 'pending' 
  | 'in-progress' 
  | 'completed' 
  | 'reported' 
  | 'verified' 
  | 'cancelled';

// PACS Service Configuration
export interface PACSConfiguration {
  orthancConfig: OrthancConfiguration;
  dicoogleConfig: DicoogleConfiguration;
  ohifConfig: OHIFConfiguration;
  postdicomConfig: PostDICOMConfiguration;
  specialtyWorkflows: SpecialtyWorkflowConfiguration[];
  security: PACSSecurityConfiguration;
  performance: PACSPerformanceConfiguration;
}

export interface OrthancConfiguration {
  baseUrl: string;
  username?: string;
  password?: string;
  apiKey?: string;
  storageDirectory?: string;
  maxConnections: number;
  timeoutMs: number;
  enableDicomWeb: boolean;
  plugins: string[];
}

export interface DicoogleConfiguration {
  baseUrl: string;
  indexPath: string;
  queryTimeoutMs: number;
  maxResults: number;
  enableAdvancedSearch: boolean;
  searchProviders: string[];
}

export interface OHIFConfiguration {
  baseUrl: string;
  wadoRsRoot: string;
  qidoRsRoot: string;
  enableMeasurements: boolean;
  enableAnnotations: boolean;
  defaultLayout: string;
  viewerPresets: ViewerPreset[];
}

export interface PostDICOMConfiguration {
  apiKey: string;
  baseUrl: string;
  organizationId: string;
  enableCloudStorage: boolean;
  syncIntervalMs: number;
  maxUploadSizeMB: number;
}

export interface PACSSecurityConfiguration {
  enableEncryption: boolean;
  encryptionAlgorithm: string;
  requireAuthentication: boolean;
  allowedRoles: string[];
  auditLogging: boolean;
  dataRetentionDays: number;
}

export interface PACSPerformanceConfiguration {
  enableCaching: boolean;
  cacheTimeoutMs: number;
  maxCacheSizeMB: number;
  enablePrefetching: boolean;
  compressionLevel: number;
  thumbnailSize: [number, number];
}

// Specialty Workflow Types
export interface SpecialtyWorkflowConfiguration {
  specialty: MedicalSpecialty;
  name: string;
  description: string;
  defaultModalitities: string[];
  requiredFields: string[];
  customTags: DICOMTag[];
  reportTemplate?: string;
  autoProcessingRules: ProcessingRule[];
  viewerSettings: SpecialtyViewerSettings;
}

export interface DICOMTag {
  group: string;
  element: string;
  vr: string; // Value Representation
  name: string;
  description?: string;
  required: boolean;
  defaultValue?: any;
}

export interface ProcessingRule {
  name: string;
  condition: string;
  action: string;
  parameters?: Record<string, any>;
}

export interface SpecialtyViewerSettings {
  defaultWindowing: WindowingPreset[];
  enabledTools: string[];
  layoutPreference: string;
  measurementUnits: string;
  annotationSettings: AnnotationSettings;
}

export interface WindowingPreset {
  name: string;
  windowCenter: number;
  windowWidth: number;
  modalityLUT?: string;
}

export interface AnnotationSettings {
  enableRuler: boolean;
  enableAngle: boolean;
  enableFreehand: boolean;
  enableText: boolean;
  defaultColor: string;
  defaultThickness: number;
}

export interface ViewerPreset {
  name: string;
  specialty: MedicalSpecialty;
  layout: string;
  tools: string[];
  windowing: WindowingPreset[];
}

// API Response Types
export interface PACSSearchRequest {
  patientID?: string;
  patientName?: string;
  studyDate?: {
    from?: string;
    to?: string;
  };
  modality?: string[];
  specialty?: MedicalSpecialty[];
  accessionNumber?: string;
  studyDescription?: string;
  limit?: number;
  offset?: number;
}

export interface PACSSearchResponse {
  studies: DICOMStudy[];
  totalCount: number;
  offset: number;
  limit: number;
  searchTime: number;
}

export interface PACSUploadRequest {
  files: File[];
  patientID: string;
  studyDescription?: string;
  specialty: MedicalSpecialty;
  metadata?: Record<string, any>;
}

export interface PACSUploadResponse {
  success: boolean;
  studyInstanceUID?: string;
  message: string;
  uploadedCount: number;
  failedCount: number;
  errors?: string[];
}

// Transcription Types for PACS Integration
export interface PACSTranscriptionRequest {
  studyInstanceUID: string;
  audioData?: Blob;
  textContent?: string;
  language: string;
  specialty: MedicalSpecialty;
  reportType: 'preliminary' | 'final' | 'addendum';
}

export interface PACSTranscriptionResponse {
  success: boolean;
  transcriptionId: string;
  transcribedText?: string;
  confidence?: number;
  language: string;
  timestamp: Date;
  reviewRequired: boolean;
}

// Audit and Monitoring Types
export interface PACSAuditEvent {
  eventType: 'access' | 'upload' | 'download' | 'view' | 'modify' | 'delete';
  resourceType: 'study' | 'series' | 'instance' | 'report';
  resourceId: string;
  userId: string;
  userRole: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  details?: Record<string, any>;
}

export interface PACSMetrics {
  totalStudies: number;
  totalSeries: number;
  totalInstances: number;
  storageUsedGB: number;
  activeUsers: number;
  averageResponseTimeMs: number;
  errorRate: number;
  uptime: number;
}

// Error Types
export interface PACSError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
  requestId?: string;
}

export class PACSServiceError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, any>;
  public readonly timestamp: Date;

  constructor(code: string, message: string, details?: Record<string, any>) {
    super(message);
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
    this.name = 'PACSServiceError';
  }
}