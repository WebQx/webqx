/**
 * PACS Integration Module
 * 
 * Comprehensive PACS integration module providing DICOM storage, management,
 * and viewing capabilities. Integrates Orthanc, Dicoogle, OHIF, and PostDICOM
 * for robust imaging workflows with specialty-aware configurations.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

export * from './types';
export * from './services/pacsService';
export * from './services/orthancService';
export * from './services/dicoogleService';
export * from './services/ohifService';
export * from './services/postdicomService';
export * from './services/dicomWebService';
export * from './utils/dicomValidation';
export * from './utils/specialtyWorkflows';

// Default export for convenience
export { PACSService as default } from './services/pacsService';