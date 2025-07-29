/**
 * PACS Type Definitions
 * WebQX™ Healthcare Platform
 */

// DICOM Study and Series Types
export interface DICOMStudy {
  studyInstanceUID: string;
  patientID: string;
  patientName: string;
  studyDate: string;
  studyTime: string;
  modality: string;
  studyDescription: string;
  accessionNumber: string;
  referringPhysician: string;
  seriesCount: number;
  imageCount: number;
  studySize: number; // in bytes
}

export interface DICOMSeries {
  seriesInstanceUID: string;
  studyInstanceUID: string;
  seriesNumber: number;
  modality: string;
  seriesDescription: string;
  bodyPart: string;
  imageCount: number;
  seriesDate: string;
  seriesTime: string;
}

export interface DICOMImage {
  sopInstanceUID: string;
  seriesInstanceUID: string;
  instanceNumber: number;
  imageType: string;
  acquisitionDate: string;
  acquisitionTime: string;
  rows: number;
  columns: number;
  pixelSpacing?: number[];
  windowCenter?: number;
  windowWidth?: number;
}

// Patient Access and Consent Types
export interface PatientConsent {
  patientID: string;
  consentType: 'imaging_access' | 'data_sharing' | 'research_participation';
  consentStatus: 'granted' | 'denied' | 'pending' | 'expired';
  consentDate: string;
  expirationDate?: string;
  consentDocument?: string;
  witnessID?: string;
  revokedDate?: string;
  revokedReason?: string;
}

export interface ImagingAccessRequest {
  requestID: string;
  patientID: string;
  requesterID: string;
  requesterType: 'patient' | 'provider' | 'family_member' | 'researcher';
  studyInstanceUID: string;
  accessType: 'view' | 'download' | 'share';
  requestDate: string;
  justification: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  approverID?: string;
  approvalDate?: string;
  expirationDate?: string;
  denialReason?: string;
}

// Viewer Configuration Types
export interface ViewerConfig {
  viewerType: 'ohif' | 'cornerstone' | 'dwv';
  enableAnnotations: boolean;
  enableMeasurements: boolean;
  enableAIOverlays: boolean;
  restrictedMode: boolean;
  allowedTools: string[];
  watermarkText?: string;
  sessionTimeout: number; // in minutes
}

export interface PatientViewerConfig extends ViewerConfig {
  restrictedMode: true;
  allowedTools: ['zoom', 'pan', 'brightness'];
  enableDownload: false;
  enablePrint: false;
  enableShare: boolean;
  glossaryEnabled: boolean;
  transcriptionEnabled: boolean;
}

// Audit and Compliance Types
export interface PacsAuditEvent {
  eventID: string;
  eventType: 'study_access' | 'image_view' | 'consent_change' | 'data_export' | 'login' | 'logout';
  timestamp: string;
  userID: string;
  userType: 'patient' | 'provider' | 'admin' | 'system';
  patientID?: string;
  studyInstanceUID?: string;
  seriesInstanceUID?: string;
  sopInstanceUID?: string;
  ipAddress: string;
  userAgent: string;
  sessionID: string;
  additionalData?: Record<string, any>;
  complianceFlags: {
    hipaaCompliant: boolean;
    gdprCompliant: boolean;
    auditRetention: number; // days
  };
}

// Search and Filtering Types
export interface DICOMSearchCriteria {
  patientID?: string;
  patientName?: string;
  studyDate?: {
    from: string;
    to: string;
  };
  modality?: string[];
  studyDescription?: string;
  accessionNumber?: string;
  referringPhysician?: string;
  bodyPart?: string;
  limit?: number;
  offset?: number;
}

export interface DICOMSearchResult {
  studies: DICOMStudy[];
  totalCount: number;
  searchTime: number; // in milliseconds
  nextOffset?: number;
}

// Service Response Types
export interface PacsServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: string;
    requestID: string;
    processingTime: number;
  };
}

// Multilingual Support Types
export interface ImagingGlossaryTerm {
  termID: string;
  term: string;
  definition: string;
  category: 'anatomy' | 'pathology' | 'procedure' | 'general';
  language: string;
  audioUrl?: string;
  imageUrl?: string;
  relatedTerms?: string[];
}

export interface TranscriptionOverlay {
  overlayID: string;
  studyInstanceUID: string;
  language: string;
  transcriptionText: string;
  audioUrl: string;
  timestamp: string;
  speaker: 'radiologist' | 'physician' | 'technician';
  confidence: number; // 0-1
  corrections?: {
    originalText: string;
    correctedText: string;
    correctionDate: string;
    correctorID: string;
  }[];
}