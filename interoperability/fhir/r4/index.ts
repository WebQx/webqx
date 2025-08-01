/**
 * FHIR R4 Telehealth Integration Exports
 * 
 * Exports all FHIR resources and adapters for telehealth integration
 */

// Core FHIR Resources
export * from './resources/Patient';
export * from './resources/Observation';
export * from './resources/Encounter';
export * from './resources/Consent';
export * from './resources/Communication';
export * from './resources/DocumentReference';

// Services
export * from './services/FHIRR4Service';

// Adapters
export * from './adapters/TelehealthSessionAdapter';

// Common types
export * from '../common/types/base';