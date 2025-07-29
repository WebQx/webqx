/**
 * Primary Care Specialty Module
 * 
 * Comprehensive primary care module providing interfaces for general medical care,
 * preventive services, chronic disease management, and patient coordination.
 * Integrates with EHR systems and provides specialized workflows for primary care.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

export * from './types';
export * from './components/PrimaryCareInterface';
export * from './components/ChronicDiseaseManager';
export * from './components/PreventiveCareScheduler';
export * from './services/primaryCareService';
export * from './services/chronicDiseaseService';
export * from './utils/primaryCareValidation';

// Default export for convenience
export { PrimaryCareService as default } from './services/primaryCareService';