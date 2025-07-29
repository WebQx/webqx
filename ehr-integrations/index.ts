/**
 * EHR Integrations Module
 * 
 * Central hub for Electronic Health Record integrations and management.
 * Provides interfaces for connecting with various EHR systems, managing
 * patient data exchange, and ensuring HIPAA compliance.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

export * from './types';
export * from './services/ehrService';
export * from './services/dataSync';
export * from './services/auditLogger';
export * from './components/EHRIntegrationPanel';
export * from './utils/validation';
export * from './utils/encryption';

// Default export for convenience
export { EHRService as default } from './services/ehrService';