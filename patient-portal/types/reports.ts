/**
 * @fileoverview Types for medical reports and annotations
 * 
 * Defines TypeScript interfaces for the annotated report access feature
 * including FHIR-compliant report structures and annotation metadata.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

// FHIR-compliant diagnostic report structure
export interface DiagnosticReport {
  id: string;
  resourceType: 'DiagnosticReport';
  status: 'registered' | 'partial' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'appended' | 'cancelled' | 'entered-in-error' | 'unknown';
  category: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  }>;
  code: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  };
  subject: {
    reference: string;
  };
  effectiveDateTime: string;
  issued: string;
  result?: Array<{
    reference: string;
  }>;
  presentedForm: Array<{
    contentType: string;
    data: string; // Base64 encoded content
  }>;
  annotations?: TermAnnotation[];
}

// Annotation information for medical terms within reports
export interface TermAnnotation {
  termId: string;
  positions: Array<{
    start: number;
    end: number;
  }>;
  glossaryRef: string;
}

// Medical glossary term definition
export interface MedicalGlossaryTerm {
  id: string;
  term: string;
  category: string;
  definition: string;
  plainLanguage: string;
  normalRange?: string;
  examples?: string[];
  relatedTerms?: string[];
  audioUrl?: string;
  imageUrl?: string;
  lastUpdated: string;
}

// Glossary category grouping
export interface GlossaryCategory {
  id: string;
  name: string;
  description: string;
  termCount: number;
}

// Report access and viewing configuration
export interface ReportViewerConfig {
  showAnnotations: boolean;
  enableGlossary: boolean;
  language: string;
  accessLevel: 'patient' | 'provider' | 'admin';
  auditLogging: boolean;
}

// API response types
export interface ReportSearchResponse {
  resourceType: 'Bundle';
  type: 'searchset';
  total: number;
  entry: Array<{
    resource: DiagnosticReport;
    fullUrl: string;
  }>;
}

export interface GlossarySearchResponse {
  terms: MedicalGlossaryTerm[];
  categories: GlossaryCategory[];
  total: number;
  offset: number;
  count: number;
  language: string;
}

// Component prop types
export interface AnnotatedReportViewerProps {
  reportId: string;
  config?: Partial<ReportViewerConfig>;
  onTermSelect?: (term: MedicalGlossaryTerm) => void;
  onError?: (error: Error) => void;
  className?: string;
}

export interface MedicalGlossaryProps {
  searchTerm?: string;
  category?: string;
  language?: string;
  onTermSelect?: (term: MedicalGlossaryTerm) => void;
  className?: string;
  embedded?: boolean;
}

// Error types
export interface ReportAccessError {
  code: 'NOT_FOUND' | 'ACCESS_DENIED' | 'NETWORK_ERROR' | 'PARSE_ERROR';
  message: string;
  details?: any;
}

// Audit logging types
export interface ReportAccessLog {
  userId: string;
  reportId: string;
  action: 'view' | 'download' | 'print' | 'annotate';
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface GlossaryAccessLog {
  userId: string;
  termId: string;
  action: 'view' | 'audio' | 'search';
  timestamp: string;
  searchQuery?: string;
}