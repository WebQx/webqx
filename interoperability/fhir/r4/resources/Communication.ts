/**
 * FHIR R4 Communication Resource
 * Based on FHIR R4 specification: https://hl7.org/fhir/R4/communication.html
 */

import { 
  FHIRResource, 
  FHIRIdentifier, 
  FHIRCodeableConcept, 
  FHIRReference,
  FHIRAttachment
} from '../../common/types/base';

export type CommunicationStatus = 
  | 'preparation' 
  | 'in-progress' 
  | 'not-done' 
  | 'on-hold' 
  | 'stopped' 
  | 'completed' 
  | 'entered-in-error' 
  | 'unknown';

export type CommunicationPriority = 
  | 'routine' 
  | 'urgent' 
  | 'asap' 
  | 'stat';

export interface FHIRCommunication extends FHIRResource {
  resourceType: 'Communication';
  
  // Business identifiers
  identifier?: FHIRIdentifier[];
  
  // Instantiates FHIR protocol or definition
  instantiatesCanonical?: string[];
  instantiatesUri?: string[];
  
  // Request fulfilled by this communication
  basedOn?: FHIRReference[];
  
  // Part of this action
  partOf?: FHIRReference[];
  
  // Message delivery medium
  inResponseTo?: FHIRReference[];
  
  // Current state of the communication
  status: CommunicationStatus;
  
  // Reason for current status
  statusReason?: FHIRCodeableConcept;
  
  // Message category
  category?: FHIRCodeableConcept[];
  
  // Characterizes how quickly the planned or in progress communication must be addressed
  priority?: CommunicationPriority;
  
  // A channel of communication
  medium?: FHIRCodeableConcept[];
  
  // Focus of message
  subject?: FHIRReference;
  
  // Description of the purpose/content
  topic?: FHIRCodeableConcept;
  
  // Resources that pertain to this communication
  about?: FHIRReference[];
  
  // Encounter created as part of
  encounter?: FHIRReference;
  
  // When sent
  sent?: string;
  
  // When received
  received?: string;
  
  // Message recipient
  recipient?: FHIRReference[];
  
  // Message sender
  sender?: FHIRReference;
  
  // Coded reason the communication happened
  reasonCode?: FHIRCodeableConcept[];
  
  // Why the communication happened
  reasonReference?: FHIRReference[];
  
  // Message payload
  payload?: FHIRCommunicationPayload[];
  
  // Comments made about the communication
  note?: FHIRAnnotation[];
}

export interface FHIRCommunicationPayload {
  // Message part content
  contentString?: string;
  contentAttachment?: FHIRAttachment;
  contentReference?: FHIRReference;
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

// Communication search parameters
export interface FHIRCommunicationSearchParams {
  'based-on'?: string;
  category?: string;
  encounter?: string;
  identifier?: string;
  'instantiates-canonical'?: string;
  'instantiates-uri'?: string;
  medium?: string;
  'part-of'?: string;
  patient?: string;
  received?: string;
  recipient?: string;
  sender?: string;
  sent?: string;
  status?: string;
  subject?: string;
  _id?: string;
  _lastUpdated?: string;
  _profile?: string;
  _security?: string;
  _tag?: string;
  [key: string]: string | string[] | boolean | undefined;
}

// Telehealth-specific communication types
export interface TelehealthCommunicationContext {
  communicationType: 'pre-visit' | 'during-visit' | 'post-visit' | 'follow-up';
  deliveryMethod: 'email' | 'sms' | 'portal' | 'phone' | 'video-chat' | 'in-app';
  automatedGeneration: boolean;
  templateUsed?: string;
  languagePreference?: string;
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  readConfirmationRequired: boolean;
  encryptionRequired: boolean;
}

// Pre-defined communication categories for telehealth
export const TELEHEALTH_COMMUNICATION_CATEGORIES = {
  PRE_VISIT_REMINDER: {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/communication-category',
      code: 'notification',
      display: 'Pre-Visit Reminder'
    }]
  } as FHIRCodeableConcept,
  POST_VISIT_SUMMARY: {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/communication-category',
      code: 'instruction',
      display: 'Post-Visit Summary'
    }]
  } as FHIRCodeableConcept,
  TECHNICAL_SUPPORT: {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/communication-category',
      code: 'notification',
      display: 'Technical Support'
    }]
  } as FHIRCodeableConcept,
  FOLLOW_UP_CARE: {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/communication-category',
      code: 'reminder',
      display: 'Follow-up Care Instructions'
    }]
  } as FHIRCodeableConcept,
  APPOINTMENT_CHANGE: {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/communication-category',
      code: 'notification',
      display: 'Appointment Change Notification'
    }]
  } as FHIRCodeableConcept,
  PRESCRIPTION_INFORMATION: {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/communication-category',
      code: 'instruction',
      display: 'Prescription Information'
    }]
  } as FHIRCodeableConcept,
  TEST_RESULTS: {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/communication-category',
      code: 'alert',
      display: 'Test Results Notification'
    }]
  } as FHIRCodeableConcept,
  EDUCATION_MATERIAL: {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/communication-category',
      code: 'instruction',
      display: 'Patient Education Material'
    }]
  } as FHIRCodeableConcept
} as const;

// Communication medium codes for telehealth
export const TELEHEALTH_COMMUNICATION_MEDIUM = {
  VIDEO_CALL: {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationMode',
    code: 'VIDEOCONF',
    display: 'Video Conference'
  },
  AUDIO_CALL: {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationMode',
    code: 'PHONE',
    display: 'Telephone'
  },
  SECURE_MESSAGE: {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationMode',
    code: 'WRITTEN',
    display: 'Secure Message'
  },
  EMAIL: {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationMode',
    code: 'MAILWRIT',
    display: 'Email'
  },
  SMS: {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationMode',
    code: 'WRITTEN',
    display: 'SMS Text Message'
  },
  PATIENT_PORTAL: {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationMode',
    code: 'ELECTRONIC',
    display: 'Patient Portal'
  }
} as const;

// Post-visit summary payload structure
export interface PostVisitSummaryPayload {
  visitSummary: {
    encounterDate: string;
    duration: string;
    provider: string;
    visitType: string;
    chiefComplaint?: string;
  };
  clinicalSummary?: {
    assessment: string[];
    treatmentPlan: string[];
    medications?: {
      name: string;
      dosage: string;
      instructions: string;
    }[];
  };
  followUpInstructions?: {
    nextAppointment?: string;
    labWork?: string[];
    specialInstructions?: string[];
  };
  educationalResources?: {
    title: string;
    url?: string;
    description?: string;
  }[];
  emergencyContact?: {
    name: string;
    phone: string;
    whenToCall: string[];
  };
  technicalNotes?: {
    connectionQuality: string;
    technicalIssues?: string[];
    recordingInfo?: string;
  };
}