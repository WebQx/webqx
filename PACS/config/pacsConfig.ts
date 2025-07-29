/**
 * PACS Server Configuration
 * 
 * Default configuration for PACS servers and imaging services.
 * These can be overridden via environment variables or admin console.
 */

import { PACSServerConfig } from '../types';

export const defaultPACSServers: PACSServerConfig[] = [
  {
    id: 'orthanc-primary',
    name: 'Orthanc Primary PACS',
    type: 'orthanc',
    baseUrl: process.env.ORTHANC_URL || 'http://localhost',
    port: parseInt(process.env.ORTHANC_PORT || '8042'),
    protocol: (process.env.ORTHANC_PROTOCOL as 'http' | 'https') || 'http',
    authentication: {
      type: 'basic',
      credentials: {
        username: process.env.ORTHANC_USERNAME || 'orthanc',
        password: process.env.ORTHANC_PASSWORD || 'orthanc'
      }
    },
    capabilities: {
      dicomStore: true,
      dicomQuery: true,
      dicomRetrieve: true,
      webViewer: true,
      thumbnailGeneration: true,
      metadataExtraction: true,
      anonymization: true
    },
    isActive: process.env.ORTHANC_ENABLED !== 'false'
  },
  {
    id: 'ohif-viewer',
    name: 'OHIF DICOM Viewer',
    type: 'ohif',
    baseUrl: process.env.OHIF_URL || 'http://localhost',
    port: parseInt(process.env.OHIF_PORT || '3000'),
    protocol: (process.env.OHIF_PROTOCOL as 'http' | 'https') || 'http',
    authentication: {
      type: 'none'
    },
    capabilities: {
      dicomStore: false,
      dicomQuery: false,
      dicomRetrieve: false,
      webViewer: true,
      thumbnailGeneration: true,
      metadataExtraction: false,
      anonymization: false
    },
    isActive: process.env.OHIF_ENABLED !== 'false'
  },
  {
    id: 'dicoogle-search',
    name: 'Dicoogle Indexing Server',
    type: 'dicoogle',
    baseUrl: process.env.DICOOGLE_URL || 'http://localhost',
    port: parseInt(process.env.DICOOGLE_PORT || '8080'),
    protocol: (process.env.DICOOGLE_PROTOCOL as 'http' | 'https') || 'http',
    authentication: {
      type: 'basic',
      credentials: {
        username: process.env.DICOOGLE_USERNAME || 'admin',
        password: process.env.DICOOGLE_PASSWORD || 'admin'
      }
    },
    capabilities: {
      dicomStore: true,
      dicomQuery: true,
      dicomRetrieve: true,
      webViewer: false,
      thumbnailGeneration: false,
      metadataExtraction: true,
      anonymization: false
    },
    isActive: process.env.DICOOGLE_ENABLED !== 'false'
  },
  {
    id: 'postdicom-cloud',
    name: 'PostDICOM Cloud Storage',
    type: 'postdicom',
    baseUrl: process.env.POSTDICOM_URL || 'https://api.postdicom.com',
    port: 443,
    protocol: 'https',
    authentication: {
      type: 'api-key',
      credentials: {
        apiKey: process.env.POSTDICOM_API_KEY || ''
      }
    },
    capabilities: {
      dicomStore: true,
      dicomQuery: true,
      dicomRetrieve: true,
      webViewer: true,
      thumbnailGeneration: true,
      metadataExtraction: true,
      anonymization: true
    },
    isActive: process.env.POSTDICOM_ENABLED === 'true'
  }
];

export const pacsConfig = {
  // Default server for operations
  primaryServer: process.env.PACS_PRIMARY_SERVER || 'orthanc-primary',
  
  // Viewer configuration
  defaultViewer: process.env.PACS_DEFAULT_VIEWER || 'ohif',
  
  // Security settings
  enablePatientAccess: process.env.PACS_PATIENT_ACCESS_ENABLED !== 'false',
  requireConsentForPatientAccess: process.env.PACS_REQUIRE_CONSENT !== 'false',
  patientAccessExpiry: process.env.PACS_PATIENT_ACCESS_EXPIRY || '30d',
  
  // Performance settings
  maxConcurrentConnections: parseInt(process.env.PACS_MAX_CONNECTIONS || '10'),
  connectionTimeout: parseInt(process.env.PACS_CONNECTION_TIMEOUT || '30000'),
  requestTimeout: parseInt(process.env.PACS_REQUEST_TIMEOUT || '60000'),
  
  // Caching
  enableThumbnailCache: process.env.PACS_THUMBNAIL_CACHE_ENABLED !== 'false',
  thumbnailCacheTTL: parseInt(process.env.PACS_THUMBNAIL_CACHE_TTL || '86400'),
  
  // Logging and auditing
  enableAuditLogging: process.env.PACS_AUDIT_LOGGING_ENABLED !== 'false',
  logLevel: process.env.PACS_LOG_LEVEL || 'info',
  
  // Integration settings
  enableFHIRIntegration: process.env.PACS_FHIR_INTEGRATION_ENABLED === 'true',
  fhirEndpoint: process.env.PACS_FHIR_ENDPOINT || '',
  
  // Specialty-specific settings
  enableSpecialtyFiltering: process.env.PACS_SPECIALTY_FILTERING_ENABLED !== 'false',
  specialtyMappings: {
    'radiology': ['CT', 'MR', 'XA', 'RF', 'US', 'MG', 'DX'],
    'cardiology': ['CT', 'MR', 'XA', 'US', 'ECG'],
    'oncology': ['CT', 'MR', 'PT', 'NM', 'RT'],
    'orthopedics': ['CT', 'MR', 'DX', 'CR'],
    'neurology': ['CT', 'MR', 'PT', 'US']
  }
};

export default {
  servers: defaultPACSServers,
  config: pacsConfig
};