/**
 * PACS (Picture Archiving and Communication System) Module
 * WebQX™ Healthcare Platform - PACS Integration
 * 
 * This module provides comprehensive DICOM management, imaging viewer,
 * and clinical dashboard functionality for healthcare providers.
 */

export { OrthancService } from './services/orthancService';
export { DicoogleService } from './services/dicoogleService';
export { OHIFViewerService } from './services/ohifViewerService';
export { PostDICOMService } from './services/postdicomService';
export { PacsAuditService } from './services/pacsAuditService';
export { ConsentManagementService } from './services/consentManagementService';

export * from './types/pacsTypes';
export * from './components/ImagingViewer';
export * from './components/ClinicalDashboard';
export * from './components/PatientImagingPortal';

// PACS Module Configuration
export const PACS_CONFIG = {
  orthanc: {
    baseUrl: process.env.ORTHANC_URL || 'http://localhost:8042',
    username: process.env.ORTHANC_USERNAME || 'orthanc',
    password: process.env.ORTHANC_PASSWORD || 'orthanc',
    enableCompression: true,
    maxConcurrentStudies: 10
  },
  dicoogle: {
    baseUrl: process.env.DICOOGLE_URL || 'http://localhost:8080',
    indexingEnabled: true,
    searchTimeout: 30000
  },
  ohif: {
    baseUrl: process.env.OHIF_VIEWER_URL || 'http://localhost:3000/viewer',
    enableAnnotations: true,
    enableAIOverlays: true,
    restrictedMode: false
  },
  postdicom: {
    apiUrl: process.env.POSTDICOM_API_URL || 'https://api.postdicom.com',
    apiKey: process.env.POSTDICOM_API_KEY || '',
    enableEncryption: true,
    hipaaCompliant: true
  }
};