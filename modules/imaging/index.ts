/**
 * WebQX™ OHIF Integration Module Index
 * 
 * Main entry point for the OHIF Viewer integration module,
 * providing comprehensive imaging capabilities for WebQX™ clinical dashboards.
 */

// Import classes for re-export
import DICOMServiceDefault from './services/dicomService';
import ImagingAPIDefault from './services/imagingApi';
import PerformanceServiceDefault from './services/performanceService';
import ImagingRBACDefault from './auth/rbac';
import OHIFViewerDefault from './ohif/components/OHIFViewer';
import WebQXImagingPluginDefault from './ohif/plugins/WebQXImagingPlugin';

// Type definitions
export * from './types';

// Core services
export { DICOMService } from './services/dicomService';
export { ImagingAPI } from './services/imagingApi';
export { PerformanceService } from './services/performanceService';

// Authentication and authorization
export { ImagingRBAC } from './auth/rbac';

// Internationalization
export { default as i18n, t, formatDICOMDate, formatDICOMTime } from './i18n';

// React components
export { OHIFViewer } from './ohif/components/OHIFViewer';

// Custom plugins
export { WebQXImagingPlugin } from './ohif/plugins/WebQXImagingPlugin';

// Utility functions
export { createImagingWorkflow, validateDICOMData } from './utils';

/**
 * Initialize the WebQX™ OHIF Integration Module
 */
export interface ImagingModuleConfig {
  dicomServerUrl: string;
  enableCache?: boolean;
  cacheSize?: number;
  defaultLanguage?: string;
  enablePerformanceMetrics?: boolean;
  maxConcurrentRequests?: number;
  enableAuditLogging?: boolean;
}

/**
 * Initialize the imaging module with configuration
 */
export function initializeImagingModule(config: ImagingModuleConfig): {
  api: ImagingAPIDefault;
  rbac: ImagingRBACDefault;
  plugin: typeof WebQXImagingPluginDefault;
} {
  const api = new ImagingAPIDefault({
    dicomBaseUrl: config.dicomServerUrl,
    enablePerformanceOptimization: config.enableCache !== false,
    cacheSize: config.cacheSize || 512
  });

  const rbac = new ImagingRBACDefault();

  return {
    api,
    rbac,
    plugin: WebQXImagingPluginDefault
  };
}

/**
 * Version information
 */
export const VERSION = '1.0.0';
export const MODULE_NAME = 'WebQX OHIF Integration';
export const COMPATIBLE_OHIF_VERSION = '3.7.x';

/**
 * Module metadata
 */
export const MODULE_INFO = {
  name: MODULE_NAME,
  version: VERSION,
  description: 'OHIF Viewer integration for WebQX™ clinical dashboards',
  author: 'WebQX Health',
  license: 'Apache-2.0',
  compatibleOHIFVersion: COMPATIBLE_OHIF_VERSION,
  features: [
    'Custom Workflow Integration',
    'Role-Based Access Control',
    'Multilingual Support', 
    'Custom Imaging Tools',
    'Performance Optimization',
    'API Enhancements'
  ],
  dependencies: {
    '@ohif/core': '^3.7.0',
    '@ohif/ui': '^3.7.0',
    'react': '^18.0.0',
    'typescript': '^5.0.0'
  }
};

export default {
  VERSION,
  MODULE_NAME,
  MODULE_INFO,
  initializeImagingModule,
  DICOMService: DICOMServiceDefault,
  ImagingAPI: ImagingAPIDefault,
  PerformanceService: PerformanceServiceDefault,
  ImagingRBAC: ImagingRBACDefault,
  OHIFViewer: OHIFViewerDefault,
  WebQXImagingPlugin: WebQXImagingPluginDefault,
  i18n: require('./i18n').default
};