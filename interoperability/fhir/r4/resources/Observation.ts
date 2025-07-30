/**
 * FHIR R4 Observation Resource
 * Based on FHIR R4 specification: https://hl7.org/fhir/R4/observation.html
 */

import { 
  FHIRResource, 
  FHIRIdentifier, 
  FHIRCodeableConcept, 
  FHIRReference,
  FHIRQuantity,
  FHIRPeriod,
  FHIRRange,
  FHIRRatio,
  FHIRSampledData,
  FHIRAttachment
} from '../../common/types/base';

export type ObservationStatus = 
  | 'registered' 
  | 'preliminary' 
  | 'final' 
  | 'amended' 
  | 'corrected' 
  | 'cancelled' 
  | 'entered-in-error' 
  | 'unknown';

export interface FHIRObservation extends FHIRResource {
  resourceType: 'Observation';
  
  // Business identifiers
  identifier?: FHIRIdentifier[];
  
  // Instantiates FHIR protocol or definition
  basedOn?: FHIRReference[];
  
  // Part of referenced event
  partOf?: FHIRReference[];
  
  // Status of the result value
  status: ObservationStatus;
  
  // Classification of type of observation
  category?: FHIRCodeableConcept[];
  
  // Type of observation (code / type)
  code: FHIRCodeableConcept;
  
  // Who and/or what the observation is about
  subject?: FHIRReference;
  
  // What the observation is about, when it is not about the subject of record
  focus?: FHIRReference[];
  
  // Healthcare event during which this observation is made
  encounter?: FHIRReference;
  
  // Clinically relevant time/time-period for observation
  effectiveDateTime?: string;
  effectivePeriod?: FHIRPeriod;
  effectiveTiming?: any; // Timing
  effectiveInstant?: string;
  
  // Date/Time this version was made available
  issued?: string;
  
  // Who is responsible for the observation
  performer?: FHIRReference[];
  
  // Actual result
  valueQuantity?: FHIRQuantity;
  valueCodeableConcept?: FHIRCodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueRange?: FHIRRange;
  valueRatio?: FHIRRatio;
  valueSampledData?: FHIRSampledData;
  valueTime?: string;
  valueDateTime?: string;
  valuePeriod?: FHIRPeriod;
  valueAttachment?: FHIRAttachment;
  
  // Why the result is missing
  dataAbsentReason?: FHIRCodeableConcept;
  
  // High, low, normal, etc.
  interpretation?: FHIRCodeableConcept[];
  
  // Comments about the observation
  note?: FHIRAnnotation[];
  
  // Observed body part
  bodySite?: FHIRCodeableConcept;
  
  // How it was done
  method?: FHIRCodeableConcept;
  
  // Specimen used for this observation
  specimen?: FHIRReference;
  
  // (Measurement) Device
  device?: FHIRReference;
  
  // Provides guide for interpretation
  referenceRange?: FHIRObservationReferenceRange[];
  
  // Related resource that belongs to the Observation group
  hasMember?: FHIRReference[];
  
  // Related measurements the observation is made from
  derivedFrom?: FHIRReference[];
  
  // Component results
  component?: FHIRObservationComponent[];
}

export interface FHIRObservationReferenceRange {
  // Low Range, if relevant
  low?: FHIRQuantity;
  
  // High Range, if relevant
  high?: FHIRQuantity;
  
  // Reference range qualifier
  type?: FHIRCodeableConcept;
  
  // Applicable age range, if relevant
  appliesTo?: FHIRCodeableConcept[];
  
  // Applicable age range, if relevant
  age?: FHIRRange;
  
  // Text based reference range in an observation
  text?: string;
}

export interface FHIRObservationComponent {
  // Type of component observation (code / type)
  code: FHIRCodeableConcept;
  
  // Actual component result
  valueQuantity?: FHIRQuantity;
  valueCodeableConcept?: FHIRCodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueRange?: FHIRRange;
  valueRatio?: FHIRRatio;
  valueSampledData?: FHIRSampledData;
  valueTime?: string;
  valueDateTime?: string;
  valuePeriod?: FHIRPeriod;
  valueAttachment?: FHIRAttachment;
  
  // Why the component result is missing
  dataAbsentReason?: FHIRCodeableConcept;
  
  // High, low, normal, etc.
  interpretation?: FHIRCodeableConcept[];
  
  // Provides guide for interpretation of component result
  referenceRange?: FHIRObservationReferenceRange[];
}

export interface FHIRAnnotation {
  // Individual responsible for the annotation
  authorReference?: FHIRReference;
  authorString?: string;
  
  // When the annotation was made
  time?: string;
  
  // The annotation - text content (as markdown)
  text: string;
}

// Observation search parameters
export interface FHIRObservationSearchParams {
  'based-on'?: string;
  category?: string;
  code?: string;
  'code-value-concept'?: string;
  'code-value-date'?: string;
  'code-value-quantity'?: string;
  'code-value-string'?: string;
  'combo-code'?: string;
  'combo-code-value-concept'?: string;
  'combo-code-value-quantity'?: string;
  'combo-data-absent-reason'?: string;
  'combo-value-concept'?: string;
  'combo-value-quantity'?: string;
  'component-code'?: string;
  'component-code-value-concept'?: string;
  'component-code-value-quantity'?: string;
  'component-data-absent-reason'?: string;
  'component-value-concept'?: string;
  'component-value-quantity'?: string;
  'data-absent-reason'?: string;
  date?: string;
  'derived-from'?: string;
  device?: string;
  encounter?: string;
  focus?: string;
  'has-member'?: string;
  identifier?: string;
  method?: string;
  'part-of'?: string;
  patient?: string;
  performer?: string;
  specimen?: string;
  status?: string;
  subject?: string;
  'value-concept'?: string;
  'value-date'?: string;
  'value-quantity'?: string;
  'value-string'?: string;
  _id?: string;
  _lastUpdated?: string;
  _profile?: string;
  _security?: string;
  _tag?: string;
  [key: string]: string | string[] | boolean | undefined;
}

// Lab result specific interfaces for better type safety
export interface LabResult {
  id: string;
  patientId: string;
  patientName: string;
  testName: string;
  testCode: string;
  value: string | number;
  unit?: string;
  normalRange?: string;
  status: ObservationStatus;
  interpretation?: 'normal' | 'high' | 'low' | 'critical' | 'abnormal';
  collectionDate: string;
  resultDate: string;
  performingLab?: string;
}

export interface LabResultsGroup {
  patientId: string;
  patientName: string;
  collectionDate: string;
  results: LabResult[];
  status: 'complete' | 'partial' | 'pending';
}