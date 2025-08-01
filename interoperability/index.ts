/**
 * WebQX™ Interoperability Module
 * Main entry point for healthcare standards integration
 */

// FHIR R4 exports
export { FHIRR4Service } from './fhir/r4/services/FHIRR4Service';
export type { 
  FHIRR4Config, 
  FHIRResponse, 
  FHIRSearchResponse 
} from './fhir/r4/services/FHIRR4Service';
export type { 
  FHIRPatient, 
  FHIRPatientSearchParams 
} from './fhir/r4/resources/Patient';

// FHIR Common types
export type {
  FHIRResource,
  FHIRMeta,
  FHIRCoding,
  FHIRIdentifier,
  FHIRCodeableConcept,
  FHIRPeriod,
  FHIRReference,
  FHIRHumanName,
  FHIRContactPoint,
  FHIRAddress,
  FHIRBundle,
  FHIRSearchParameters,
  FHIROperationOutcome
} from './fhir/common/types/base';

// openEHR exports
export { OpenEHRService } from './openehr/services/OpenEHRService';
export type {
  OpenEHRConfig,
  OpenEHRComposition,
  OpenEHRTemplate,
  OpenEHRArchetype,
  OpenEHRAQLQuery,
  OpenEHRAQLResult
} from './openehr/services/OpenEHRService';

// Common utilities
export { CrossStandardValidator } from './common/validators/CrossStandardValidator';
export type {
  ValidationResult,
  ValidationError,
  ValidationWarning
} from './common/validators/CrossStandardValidator';

export { 
  FHIRToOpenEHRTransformer,
  OpenEHRToFHIRTransformer 
} from './common/transformers/FHIRToOpenEHR';
export type {
  TransformationOptions as InteropTransformationOptions,
  TransformationResult as InteropTransformationResult
} from './common/transformers/FHIRToOpenEHR';

// Constants and configurations
export const INTEROP_VERSION = '1.0.0';
export const SUPPORTED_STANDARDS = {
  FHIR: {
    versions: ['R4', 'R5'],
    current: 'R4'
  },
  OPENEHR: {
    versions: ['1.0.2', '1.0.3', '1.0.4'],
    current: '1.0.4'
  },
  HL7V2: {
    versions: ['2.5', '2.6', '2.7', '2.8'],
    current: '2.8'
  }
};

// Import types for factory functions
import { FHIRR4Service, FHIRR4Config } from './fhir/r4/services/FHIRR4Service';
import { OpenEHRService, OpenEHRConfig } from './openehr/services/OpenEHRService';
import { CrossStandardValidator } from './common/validators/CrossStandardValidator';
import { 
  FHIRToOpenEHRTransformer, 
  OpenEHRToFHIRTransformer,
  TransformationOptions,
  TransformationResult
} from './common/transformers/FHIRToOpenEHR';
import { FHIRPatient } from './fhir/r4/resources/Patient';
import { OpenEHRComposition } from './openehr/services/OpenEHRService';

// Factory functions for easy service initialization
export function createFHIRService(config: {
  baseUrl: string;
  authToken?: string;
  timeout?: number;
}): FHIRR4Service {
  const fhirConfig: FHIRR4Config = {
    baseUrl: config.baseUrl,
    timeout: config.timeout || 30000,
    headers: {
      'Content-Type': 'application/fhir+json',
      'Accept': 'application/fhir+json',
    },
    authentication: config.authToken ? {
      type: 'bearer' as const,
      token: config.authToken,
    } : undefined,
  };

  return new FHIRR4Service(fhirConfig);
}

export function createOpenEHRService(config: {
  baseUrl: string;
  username?: string;
  password?: string;
  apiKey?: string;
  timeout?: number;
}): OpenEHRService {
  return new OpenEHRService({
    baseUrl: config.baseUrl,
    username: config.username,
    password: config.password,
    apiKey: config.apiKey,
    timeout: config.timeout || 30000,
  });
}

// Validation helpers
export function validateFHIRResource(resource: any) {
  return CrossStandardValidator.validateFHIRResource(resource);
}

export function validateOpenEHRComposition(composition: any) {
  return CrossStandardValidator.validateOpenEHRComposition(composition);
}

export function validateHealthcareIdentifier(identifier: string, system?: string) {
  return CrossStandardValidator.validateHealthcareIdentifier(identifier, system);
}

export function validateClinicalCoding(code: string, system: string) {
  return CrossStandardValidator.validateClinicalCoding(code, system);
}

// Transformation helpers
export function transformFHIRPatientToOpenEHR(patient: FHIRPatient, options?: TransformationOptions) {
  return FHIRToOpenEHRTransformer.transformPatientToDemographics(patient, options);
}

export function transformOpenEHRToFHIRPatient(composition: OpenEHRComposition, options?: TransformationOptions) {
  return OpenEHRToFHIRTransformer.transformDemographicsToPatient(composition, options);
}

// Re-export types for convenience
export type { FHIRR4Config as FHIRConfig };
export type { OpenEHRConfig as InteropOpenEHRConfig };
export type { TransformationOptions, TransformationResult };