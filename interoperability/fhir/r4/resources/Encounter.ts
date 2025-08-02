/**
 * FHIR R4 Encounter Resource
 * Based on FHIR R4 specification: https://hl7.org/fhir/R4/encounter.html
 */

import { 
  FHIRResource, 
  FHIRIdentifier, 
  FHIRCodeableConcept, 
  FHIRReference,
  FHIRPeriod
} from '../../common/types/base';

export type EncounterStatus = 
  | 'planned' 
  | 'arrived' 
  | 'triaged' 
  | 'in-progress' 
  | 'onleave' 
  | 'finished' 
  | 'cancelled' 
  | 'entered-in-error' 
  | 'unknown';

export type EncounterClass = 
  | 'AMB'    // ambulatory
  | 'EMER'   // emergency
  | 'FLD'    // field
  | 'HH'     // home health
  | 'IMP'    // inpatient encounter
  | 'ACUTE'  // inpatient acute
  | 'NONAC'  // inpatient non-acute
  | 'OBSENC' // observation encounter
  | 'PRENC'  // pre-admission
  | 'SS'     // short stay
  | 'VR';    // virtual (telehealth)

export interface FHIREncounter extends FHIRResource {
  resourceType: 'Encounter';
  
  // Business identifiers
  identifier?: FHIRIdentifier[];
  
  // Current state of the encounter
  status: EncounterStatus;
  
  // List of past encounter statuses
  statusHistory?: FHIREncounterStatusHistory[];
  
  // Concepts representing classification of patient encounter
  class: FHIRCoding;
  
  // List of past encounter classes
  classHistory?: FHIREncounterClassHistory[];
  
  // Specific type of encounter
  type?: FHIRCodeableConcept[];
  
  // Specific type of service
  serviceType?: FHIRCodeableConcept;
  
  // Indicates the urgency of the encounter
  priority?: FHIRCodeableConcept;
  
  // The patient present at the encounter
  subject?: FHIRReference;
  
  // Episode(s) of care that this encounter should be recorded against
  episodeOfCare?: FHIRReference[];
  
  // The ServiceRequest that initiated this encounter
  basedOn?: FHIRReference[];
  
  // List of participants involved in the encounter
  participant?: FHIREncounterParticipant[];
  
  // The appointment that scheduled this encounter
  appointment?: FHIRReference[];
  
  // The start and end time of the encounter
  period?: FHIRPeriod;
  
  // Quantity of time the encounter lasted
  length?: FHIRDuration;
  
  // Coded reason the encounter takes place
  reasonCode?: FHIRCodeableConcept[];
  
  // Reason the encounter takes place (reference)
  reasonReference?: FHIRReference[];
  
  // The list of diagnosis relevant to this encounter
  diagnosis?: FHIREncounterDiagnosis[];
  
  // The set of accounts that may be used for billing for this Encounter
  account?: FHIRReference[];
  
  // Details about the admission to a healthcare service
  hospitalization?: FHIREncounterHospitalization;
  
  // List of locations where the patient has been
  location?: FHIREncounterLocation[];
  
  // The organization (facility) responsible for this encounter
  serviceProvider?: FHIRReference;
  
  // Another Encounter this encounter is part of
  partOf?: FHIRReference;
}

export interface FHIREncounterStatusHistory {
  // planned | arrived | triaged | in-progress | onleave | finished | cancelled | entered-in-error | unknown
  status: EncounterStatus;
  
  // The time that the episode was in the specified status
  period: FHIRPeriod;
}

export interface FHIREncounterClassHistory {
  // inpatient | outpatient | ambulatory | emergency +
  class: FHIRCoding;
  
  // The time that the episode was in the specified class
  period: FHIRPeriod;
}

export interface FHIREncounterParticipant {
  // Role of participant in encounter
  type?: FHIRCodeableConcept[];
  
  // Period of time during the encounter participant was present
  period?: FHIRPeriod;
  
  // Persons involved in the encounter other than the patient
  individual?: FHIRReference;
}

export interface FHIREncounterDiagnosis {
  // The diagnosis or procedure relevant to the encounter
  condition: FHIRReference;
  
  // Role that this diagnosis has within the encounter
  use?: FHIRCodeableConcept;
  
  // Ranking of the diagnosis (for each role type)
  rank?: number;
}

export interface FHIREncounterHospitalization {
  // Pre-admission identifier
  preAdmissionIdentifier?: FHIRIdentifier;
  
  // The location from which the patient came before admission
  origin?: FHIRReference;
  
  // From where patient was admitted (physician referral, transfer)
  admitSource?: FHIRCodeableConcept;
  
  // The type of hospital re-admission that has occurred
  reAdmission?: FHIRCodeableConcept;
  
  // Diet preferences reported by the patient
  dietPreference?: FHIRCodeableConcept[];
  
  // Special courtesies (VIP, board member)
  specialCourtesy?: FHIRCodeableConcept[];
  
  // Wheelchair, translator, stretcher, etc.
  specialArrangement?: FHIRCodeableConcept[];
  
  // Location to which the patient is discharged
  destination?: FHIRReference;
  
  // Category or kind of location after discharge
  dischargeDisposition?: FHIRCodeableConcept;
}

export interface FHIREncounterLocation {
  // Location the encounter takes place
  location: FHIRReference;
  
  // planned | active | reserved | completed
  status?: 'planned' | 'active' | 'reserved' | 'completed';
  
  // The physical type of the location
  physicalType?: FHIRCodeableConcept;
  
  // Time period during which the patient was present at the location
  period?: FHIRPeriod;
}

export interface FHIRCoding {
  system?: string;
  version?: string;
  code?: string;
  display?: string;
  userSelected?: boolean;
}

export interface FHIRDuration {
  value?: number;
  comparator?: '<' | '<=' | '>=' | '>';
  unit?: string;
  system?: string;
  code?: string;
}

// Encounter search parameters
export interface FHIREncounterSearchParams {
  account?: string;
  appointment?: string;
  'based-on'?: string;
  class?: string;
  date?: string;
  diagnosis?: string;
  'episode-of-care'?: string;
  identifier?: string;
  length?: string;
  location?: string;
  'location-period'?: string;
  'part-of'?: string;
  participant?: string;
  'participant-type'?: string;
  patient?: string;
  practitioner?: string;
  'reason-code'?: string;
  'reason-reference'?: string;
  'service-provider'?: string;
  'special-arrangement'?: string;
  status?: string;
  subject?: string;
  type?: string;
  _id?: string;
  _lastUpdated?: string;
  _profile?: string;
  _security?: string;
  _tag?: string;
  [key: string]: string | string[] | boolean | undefined;
}

// Telehealth-specific encounter context
export interface TelehealthEncounterContext {
  sessionId: string;
  platformType: 'video' | 'audio' | 'chat' | 'mixed';
  connectionQuality?: 'excellent' | 'good' | 'fair' | 'poor';
  technicalIssues?: string[];
  recordingConsent?: boolean;
  sessionRecordingId?: string;
}