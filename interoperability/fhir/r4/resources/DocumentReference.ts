/**
 * FHIR R4 DocumentReference Resource
 * Based on FHIR R4 specification: https://hl7.org/fhir/R4/documentreference.html
 */

import { 
  FHIRResource, 
  FHIRIdentifier, 
  FHIRCodeableConcept, 
  FHIRReference,
  FHIRPeriod,
  FHIRAttachment
} from '../../common/types/base';

export type DocumentReferenceStatus = 
  | 'current' 
  | 'superseded' 
  | 'entered-in-error';

export type DocumentReferenceDocStatus = 
  | 'preliminary' 
  | 'final' 
  | 'amended' 
  | 'entered-in-error';

export interface FHIRDocumentReference extends FHIRResource {
  resourceType: 'DocumentReference';
  
  // Master Version Specific Identifier
  masterIdentifier?: FHIRIdentifier;
  
  // Other identifiers for the document
  identifier?: FHIRIdentifier[];
  
  // Current state of the document
  status: DocumentReferenceStatus;
  
  // Current state of the document
  docStatus?: DocumentReferenceDocStatus;
  
  // Kind of document (LOINC if possible)
  type?: FHIRCodeableConcept;
  
  // Categorization of document
  category?: FHIRCodeableConcept[];
  
  // Who/what is the subject of the document
  subject?: FHIRReference;
  
  // When this document reference was created
  date?: string;
  
  // Who and/or what authored the document
  author?: FHIRReference[];
  
  // Who/what authenticated the document
  authenticator?: FHIRReference;
  
  // Organization which maintains the document
  custodian?: FHIRReference;
  
  // Relationships to other documents
  relatesTo?: FHIRDocumentReferenceRelatesTo[];
  
  // Human-readable description
  description?: string;
  
  // Document security-tags
  securityLabel?: FHIRCodeableConcept[];
  
  // Document referenced
  content: FHIRDocumentReferenceContent[];
  
  // Clinical context of document
  context?: FHIRDocumentReferenceContext;
}

export interface FHIRDocumentReferenceRelatesTo {
  // replaces | transforms | signs | appends
  code: 'replaces' | 'transforms' | 'signs' | 'appends';
  
  // Target of the relationship
  target: FHIRReference;
}

export interface FHIRDocumentReferenceContent {
  // Where to access the document
  attachment: FHIRAttachment;
  
  // Format/content rules for the document
  format?: FHIRCoding;
}

export interface FHIRDocumentReferenceContext {
  // Context of the document content
  encounter?: FHIRReference[];
  
  // Main clinical acts documented
  event?: FHIRCodeableConcept[];
  
  // Time of service that is being documented
  period?: FHIRPeriod;
  
  // Kind of facility where patient was seen
  facilityType?: FHIRCodeableConcept;
  
  // Additional details about where the content was created
  practiceSetting?: FHIRCodeableConcept;
  
  // Patient demographics from source
  sourcePatientInfo?: FHIRReference;
  
  // Related identifiers or resources
  related?: FHIRReference[];
}

export interface FHIRCoding {
  system?: string;
  version?: string;
  code?: string;
  display?: string;
  userSelected?: boolean;
}

// DocumentReference search parameters
export interface FHIRDocumentReferenceSearchParams {
  authenticator?: string;
  author?: string;
  category?: string;
  'content-type'?: string;
  custodian?: string;
  date?: string;
  description?: string;
  encounter?: string;
  event?: string;
  facility?: string;
  format?: string;
  identifier?: string;
  language?: string;
  location?: string;
  patient?: string;
  period?: string;
  'related-id'?: string;
  'related-ref'?: string;
  relatesto?: string;
  relation?: string;
  'security-label'?: string;
  setting?: string;
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

// Clinical note specific types
export interface ClinicalNoteContext {
  noteType: 'encounter' | 'progress' | 'consultation' | 'discharge' | 'operative' | 'pathology' | 'radiology' | 'ambient';
  author: {
    type: 'physician' | 'nurse' | 'therapist' | 'ai-assistant' | 'automated';
    reference: FHIRReference;
  };
  transcriptionMethod?: 'typed' | 'dictated' | 'voice-recognition' | 'ai-ambient';
  confidenceScore?: number; // For AI-generated content
  reviewStatus: 'unreviewed' | 'reviewed' | 'approved' | 'rejected';
  reviewedBy?: FHIRReference;
  reviewDate?: string;
}

// Ambient documentation specific types
export interface AmbientDocumentationContext {
  sessionId: string;
  transcriptionEngine: 'whisper' | 'other';
  audioQuality: 'excellent' | 'good' | 'fair' | 'poor';
  speakerIdentification: boolean;
  speakerCount: number;
  sessionDuration: string; // ISO 8601 duration
  processingTimestamp: string;
  confidenceMetrics: {
    overallConfidence: number;
    segmentConfidences?: number[];
    lowConfidenceSegments?: {
      start: number;
      end: number;
      confidence: number;
    }[];
  };
  postProcessing: {
    phiRedaction: boolean;
    medicalTermCorrection: boolean;
    structuralFormatting: boolean;
  };
}

// Pre-defined document types for clinical notes
export const CLINICAL_NOTE_TYPES = {
  ENCOUNTER_NOTE: {
    system: 'http://loinc.org',
    code: '34109-9',
    display: 'Note'
  },
  PROGRESS_NOTE: {
    system: 'http://loinc.org',
    code: '11506-3',
    display: 'Progress note'
  },
  CONSULTATION_NOTE: {
    system: 'http://loinc.org',
    code: '11488-4',
    display: 'Consultation note'
  },
  DISCHARGE_SUMMARY: {
    system: 'http://loinc.org',
    code: '18842-5',
    display: 'Discharge summary'
  },
  AMBIENT_DOCUMENTATION: {
    system: 'http://loinc.org',
    code: '34109-9',
    display: 'Ambient clinical documentation'
  },
  TELEHEALTH_NOTE: {
    system: 'http://loinc.org',
    code: '34109-9',
    display: 'Telehealth encounter note'
  }
} as const;

// Categories for clinical notes
export const CLINICAL_NOTE_CATEGORIES = {
  CLINICAL_NOTE: {
    system: 'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category',
    code: 'clinical-note',
    display: 'Clinical Note'
  },
  AI_GENERATED: {
    system: 'http://terminology.hl7.org/CodeSystem/document-type',
    code: 'ai-generated',
    display: 'AI Generated Documentation'
  },
  AMBIENT_CAPTURE: {
    system: 'http://terminology.hl7.org/CodeSystem/document-type',
    code: 'ambient-capture',
    display: 'Ambient Audio Capture Documentation'
  }
} as const;

// Formats for clinical documentation
export const CLINICAL_NOTE_FORMATS = {
  PLAIN_TEXT: {
    system: 'http://ihe.net/fhir/ValueSet/IHE.FormatCode.codesystem',
    code: 'urn:ihe:iti:xds:2017:mimeTypeSufficient',
    display: 'Plain Text'
  },
  MARKDOWN: {
    system: 'http://ihe.net/fhir/ValueSet/IHE.FormatCode.codesystem',
    code: 'text/markdown',
    display: 'Markdown'
  },
  STRUCTURED_SOAP: {
    system: 'http://ihe.net/fhir/ValueSet/IHE.FormatCode.codesystem',
    code: 'soap-note',
    display: 'SOAP Note Format'
  },
  CLINICAL_NARRATIVE: {
    system: 'http://ihe.net/fhir/ValueSet/IHE.FormatCode.codesystem',
    code: 'clinical-narrative',
    display: 'Clinical Narrative'
  }
} as const;