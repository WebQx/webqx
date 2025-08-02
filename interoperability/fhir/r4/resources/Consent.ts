/**
 * FHIR R4 Consent Resource
 * Based on FHIR R4 specification: https://hl7.org/fhir/R4/consent.html
 */

import { 
  FHIRResource, 
  FHIRIdentifier, 
  FHIRCodeableConcept, 
  FHIRReference,
  FHIRPeriod,
  FHIRAttachment
} from '../../common/types/base';

export type ConsentStatus = 
  | 'draft' 
  | 'proposed' 
  | 'active' 
  | 'rejected' 
  | 'inactive' 
  | 'entered-in-error';

export type ConsentScope = 
  | 'adr'        // Advanced Directive
  | 'research'   // Research
  | 'patient-privacy'  // Patient Privacy
  | 'treatment';      // Treatment

export type ConsentCategory = 
  | 'acd'        // Advance Directive
  | 'dnr'        // Do Not Resuscitate
  | 'emrgonly'   // Emergency Only
  | 'hcd'        // Health Care Directive
  | 'npp'        // Notice of Privacy Practices
  | 'polst'      // POLST
  | 'research'   // Research Information Access
  | 'rsdid'      // De-identified Information Access
  | 'rsreid';    // Re-identifiable Information Access

export interface FHIRConsent extends FHIRResource {
  resourceType: 'Consent';
  
  // Identifier for this record (external references)
  identifier?: FHIRIdentifier[];
  
  // Indicates the current state of this consent
  status: ConsentStatus;
  
  // Which of the four areas this resource covers (extensible)
  scope: FHIRCodeableConcept;
  
  // Classification of the consent statement - for indexing/retrieval
  category?: FHIRCodeableConcept[];
  
  // Who the consent applies to
  patient?: FHIRReference;
  
  // When this Consent was created or indexed
  dateTime?: string;
  
  // Who is agreeing to the policy and rules
  performer?: FHIRReference[];
  
  // Custodian of the consent
  organization?: FHIRReference[];
  
  // Source from which this consent is taken
  sourceAttachment?: FHIRAttachment;
  sourceReference?: FHIRReference;
  
  // Policies covered by this consent
  policy?: FHIRConsentPolicy[];
  
  // Regulation that this consents to
  policyRule?: FHIRCodeableConcept;
  
  // Verification of consent
  verification?: FHIRConsentVerification[];
  
  // Constraints to the base Consent.policyRule
  provision?: FHIRConsentProvision;
}

export interface FHIRConsentPolicy {
  // Enforcement source for policy
  authority?: string;
  
  // Specific policy covered by this consent
  uri?: string;
}

export interface FHIRConsentVerification {
  // Has been verified
  verified: boolean;
  
  // Person who verified
  verifiedWith?: FHIRReference;
  
  // When consent verified
  verificationDate?: string;
}

export interface FHIRConsentProvision {
  // deny | permit
  type?: 'deny' | 'permit';
  
  // Timeframe for this rule
  period?: FHIRPeriod;
  
  // Who|what controlled by this rule (or group, by role)
  actor?: FHIRConsentActor[];
  
  // Actions controlled by this rule
  action?: FHIRCodeableConcept[];
  
  // Security Labels that define affected resources
  securityLabel?: FHIRCoding[];
  
  // Context of activities covered by this rule
  purpose?: FHIRCoding[];
  
  // e.g. Resource Type, Profile, CDA, etc.
  class?: FHIRCoding[];
  
  // e.g. LOINC or SNOMED CT code, etc. in the content
  code?: FHIRCodeableConcept[];
  
  // Timeframe for data controlled by this rule
  dataPeriod?: FHIRPeriod;
  
  // Data controlled by this rule
  data?: FHIRConsentData[];
  
  // Nested Exception Rules
  provision?: FHIRConsentProvision[];
}

export interface FHIRConsentActor {
  // How the actor is involved
  role: FHIRCodeableConcept;
  
  // Resource for the actor (or group, by role)
  reference: FHIRReference;
}

export interface FHIRConsentData {
  // instance | related | dependents | authoredby
  meaning: 'instance' | 'related' | 'dependents' | 'authoredby';
  
  // The actual data reference
  reference: FHIRReference;
}

export interface FHIRCoding {
  system?: string;
  version?: string;
  code?: string;
  display?: string;
  userSelected?: boolean;
}

// Consent search parameters
export interface FHIRConsentSearchParams {
  action?: string;
  actor?: string;
  category?: string;
  consentor?: string;
  data?: string;
  date?: string;
  identifier?: string;
  organization?: string;
  patient?: string;
  period?: string;
  purpose?: string;
  scope?: string;
  'security-label'?: string;
  'source-reference'?: string;
  status?: string;
  _id?: string;
  _lastUpdated?: string;
  _profile?: string;
  _security?: string;
  _tag?: string;
  [key: string]: string | string[] | boolean | undefined;
}

// Telehealth-specific consent types
export interface TelehealthConsentContext {
  sessionType: 'video' | 'audio' | 'chat' | 'mixed';
  recordingConsent: boolean;
  dataSharing: {
    allowProviderAccess: boolean;
    allowEmergencyAccess: boolean;
    allowResearchUse: boolean;
  };
  communicationPreferences: {
    preferredContactMethod: 'phone' | 'email' | 'portal' | 'text';
    emergencyContact?: FHIRReference;
  };
  technicalConsent: {
    platformAgreement: boolean;
    dataTransmissionConsent: boolean;
    deviceDataCollection: boolean;
  };
}

// Pre-defined consent categories for telehealth
export const TELEHEALTH_CONSENT_CATEGORIES = {
  SESSION_RECORDING: {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/consentcategorycodes',
      code: 'research',
      display: 'Telehealth Session Recording'
    }]
  } as FHIRCodeableConcept,
  DATA_SHARING: {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/consentcategorycodes',
      code: 'patient-privacy',
      display: 'Telehealth Data Sharing'
    }]
  } as FHIRCodeableConcept,
  EMERGENCY_ACCESS: {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/consentcategorycodes',
      code: 'emrgonly',
      display: 'Emergency Access to Telehealth Data'
    }]
  } as FHIRCodeableConcept,
  PLATFORM_USAGE: {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/consentcategorycodes',
      code: 'treatment',
      display: 'Telehealth Platform Usage'
    }]
  } as FHIRCodeableConcept
} as const;