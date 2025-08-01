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
// export * from './components/PrimaryCareInterface'; // TODO: Component not yet implemented
// export * from './components/ChronicDiseaseManager'; // TODO: Component not yet implemented  
// export * from './components/PreventiveCareScheduler'; // TODO: Component not yet implemented
export * from './services/primaryCareService';
// export * from './services/chronicDiseaseService'; // TODO: Service not yet implemented
// export * from './utils/primaryCareValidation'; // TODO: Utilities not yet implemented

// Default export for convenience
export { PrimaryCareService as default } from './services/primaryCareService';