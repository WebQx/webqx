/**
 * PACS (Picture Archiving and Communication System) Module
 * 
 * Comprehensive PACS integration module providing medical imaging workflows
 * for both provider panel management and patient portal access.
 * Supports DICOM standards and integrates with multiple PACS servers including
 * Orthanc, OHIF, Dicoogle, and PostDICOM.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

export * from './types';
export * from './services/pacsService';
export * from './services/dicomService';
export * from './services/imagingWorkflowService';
export * from './components/provider/PACSProviderDashboard';
export * from './components/patient/PACSPatientViewer';
export * from './utils/dicomValidation';
export * from './utils/imagingUtils';

// Default export for convenience
export { PACSService as default } from './services/pacsService';