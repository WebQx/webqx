/**
 * PACS and DICOM Type Definitions
 * 
 * Type definitions for Picture Archiving and Communication System (PACS)
 * operations, DICOM data structures, and imaging workflows.
 */

// DICOM Data Types
export interface DICOMMetadata {
  studyInstanceUID: string;
  seriesInstanceUID: string;
  sopInstanceUID: string;
  patientID: string;
  patientName: string;
  studyDate: string;
  studyTime: string;
  modality: string;
  studyDescription: string;
  seriesDescription: string;
  instanceNumber: number;
  numberOfImages: number;
}

export interface DICOMStudy {
  studyInstanceUID: string;
  patientID: string;
  patientName: string;
  studyDate: string;
  studyTime: string;
  studyDescription: string;
  numberOfSeries: number;
  numberOfImages: number;
  modalities: string[];
  series: DICOMSeries[];
}

export interface DICOMSeries {
  seriesInstanceUID: string;
  studyInstanceUID: string;
  seriesNumber: number;
  modality: string;
  seriesDescription: string;
  numberOfImages: number;
  instances: DICOMInstance[];
}

export interface DICOMInstance {
  sopInstanceUID: string;
  seriesInstanceUID: string;
  instanceNumber: number;
  imageUrl?: string;
  thumbnailUrl?: string;
}

// PACS Server Configuration
export interface PACSServerConfig {
  id: string;
  name: string;
  type: 'orthanc' | 'ohif' | 'dicoogle' | 'postdicom' | 'custom';
  baseUrl: string;
  port: number;
  protocol: 'http' | 'https';
  authentication: {
    type: 'basic' | 'oauth' | 'api-key' | 'none';
    credentials?: {
      username?: string;
      password?: string;
      apiKey?: string;
      token?: string;
    };
  };
  capabilities: PACSCapabilities;
  isActive: boolean;
}

export interface PACSCapabilities {
  dicomStore: boolean;
  dicomQuery: boolean;
  dicomRetrieve: boolean;
  webViewer: boolean;
  thumbnailGeneration: boolean;
  metadataExtraction: boolean;
  anonymization: boolean;
}

// Imaging Workflow Types
export interface ImagingOrder {
  orderID: string;
  patientID: string;
  providerID: string;
  orderDate: string;
  modality: string;
  bodyPart: string;
  clinicalIndication: string;
  urgency: 'routine' | 'urgent' | 'stat';
  status: 'ordered' | 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  instructions?: string;
}

export interface ImagingReport {
  reportID: string;
  studyInstanceUID: string;
  patientID: string;
  radiologistID: string;
  reportDate: string;
  findings: string;
  impression: string;
  recommendations?: string;
  status: 'preliminary' | 'final' | 'addendum';
  isAbnormal: boolean;
}

// Patient Access Types
export interface PatientImagingAccess {
  patientID: string;
  studyInstanceUID: string;
  accessType: 'view' | 'download' | 'share';
  consentGiven: boolean;
  consentDate?: string;
  accessExpiry?: string;
  sharedWith?: string[];
}

export interface ImagingSession {
  sessionID: string;
  patientID: string;
  studyInstanceUID: string;
  viewerType: 'ohif' | 'cornerstone' | 'weasis';
  startTime: string;
  endTime?: string;
  actions: ImagingAction[];
}

export interface ImagingAction {
  timestamp: string;
  action: 'view' | 'zoom' | 'pan' | 'window-level' | 'measurement' | 'annotation';
  details?: Record<string, unknown>;
}

// Provider Interface Types
export interface ProviderImagingWorkflow {
  workflowID: string;
  providerID: string;
  patientID: string;
  orders: ImagingOrder[];
  studies: DICOMStudy[];
  reports: ImagingReport[];
  status: 'active' | 'completed' | 'pending-review';
  lastUpdated: string;
}

// Search and Filter Types
export interface ImagingSearchCriteria {
  patientID?: string;
  patientName?: string;
  studyDate?: {
    from: string;
    to: string;
  };
  modality?: string[];
  studyDescription?: string;
  accessionNumber?: string;
  limit?: number;
  offset?: number;
}

export interface ImagingSearchResult {
  total: number;
  studies: DICOMStudy[];
  hasMore: boolean;
}

// PACS Service Response Types
export interface PACSResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  metadata?: {
    requestId: string;
    timestamp: string;
    server: string;
  };
}

// Export main types for external use
export type PACSServiceConfig = PACSServerConfig;
export type ImagingData = DICOMStudy;
export type ViewerSession = ImagingSession;