/**
 * FHIR R4 Patient Resource
 * Based on FHIR R4 specification: https://hl7.org/fhir/R4/patient.html
 */

import { 
  FHIRResource, 
  FHIRIdentifier, 
  FHIRHumanName, 
  FHIRContactPoint, 
  FHIRAddress,
  FHIRReference,
  FHIRCodeableConcept,
  FHIRPeriod,
  FHIRSearchParameters
} from '../../common/types/base';

export interface FHIRPatient extends FHIRResource {
  resourceType: 'Patient';
  
  // Business identifiers
  identifier?: FHIRIdentifier[];
  
  // Whether this patient record is in active use
  active?: boolean;
  
  // A name associated with the patient
  name?: FHIRHumanName[];
  
  // A contact detail for the individual
  telecom?: FHIRContactPoint[];
  
  // Administrative Gender
  gender?: 'male' | 'female' | 'other' | 'unknown';
  
  // The date of birth for the individual
  birthDate?: string;
  
  // Indicates if the individual is deceased
  deceasedBoolean?: boolean;
  deceasedDateTime?: string;
  
  // An address for the individual
  address?: FHIRAddress[];
  
  // Marital (civil) status
  maritalStatus?: FHIRCodeableConcept;
  
  // Whether patient is part of a multiple birth
  multipleBirthBoolean?: boolean;
  multipleBirthInteger?: number;
  
  // Image of the patient
  photo?: FHIRAttachment[];
  
  // A contact party for the patient
  contact?: FHIRPatientContact[];
  
  // A language which may be used to communicate with the patient
  communication?: FHIRPatientCommunication[];
  
  // Patient's nominated primary care provider
  generalPractitioner?: FHIRReference[];
  
  // Organization that is the custodian of the patient record
  managingOrganization?: FHIRReference;
  
  // Link to another patient resource
  link?: FHIRPatientLink[];
}

export interface FHIRAttachment {
  contentType?: string;
  language?: string;
  data?: string;
  url?: string;
  size?: number;
  hash?: string;
  title?: string;
  creation?: string;
}

export interface FHIRPatientContact {
  relationship?: FHIRCodeableConcept[];
  name?: FHIRHumanName;
  telecom?: FHIRContactPoint[];
  address?: FHIRAddress;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  organization?: FHIRReference;
  period?: FHIRPeriod;
}

export interface FHIRPatientCommunication {
  language: FHIRCodeableConcept;
  preferred?: boolean;
}

export interface FHIRPatientLink {
  other: FHIRReference;
  type: 'replaced-by' | 'replaces' | 'refer' | 'seealso';
}

// Patient search parameters
export interface FHIRPatientSearchParams {
  active?: boolean | string;
  'address-city'?: string;
  'address-country'?: string;
  'address-postalcode'?: string;
  'address-state'?: string;
  'address-use'?: string;
  address?: string;
  birthdate?: string;
  'death-date'?: string;
  deceased?: boolean | string;
  email?: string;
  family?: string;
  gender?: string;
  'general-practitioner'?: string;
  given?: string;
  identifier?: string;
  language?: string;
  link?: string;
  name?: string;
  organization?: string;
  phone?: string;
  phonetic?: string;
  telecom?: string;
  _id?: string;
  _lastUpdated?: string;
  _profile?: string;
  _security?: string;
  _tag?: string;
  [key: string]: string | string[] | boolean | undefined;
}