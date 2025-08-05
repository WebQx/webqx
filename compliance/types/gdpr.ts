/**
 * GDPR-specific Types
 * 
 * Types and interfaces for GDPR compliance in healthcare systems
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { ComplianceContext, ComplianceResponse } from './compliance';

/**
 * GDPR consent types and legal basis
 */
export type ConsentType = 
  | 'data_processing'
  | 'data_sharing'
  | 'marketing_communications'
  | 'research_participation'
  | 'third_party_services'
  | 'analytics_tracking'
  | 'medical_treatment'
  | 'emergency_contact';

export type LegalBasis = 
  | 'consent'
  | 'contract'
  | 'legal_obligation'  
  | 'vital_interests'
  | 'public_task'
  | 'legitimate_interests';

/**
 * GDPR consent record
 */
export interface ConsentRecord {
  /** Unique consent ID */
  id: string;
  
  /** Data subject (patient/user) */
  subjectId: string;
  subjectEmail?: string;
  
  /** Type of consent */
  consentType: ConsentType;
  
  /** Legal basis for processing */
  legalBasis: LegalBasis;
  
  /** Consent details */
  purpose: string;
  dataCategories: DataCategory[];
  processingActivities: string[];
  
  /** Consent status */
  granted: boolean;
  grantedAt?: Date;
  withdrawnAt?: Date;
  
  /** Consent method */
  consentMethod: 'explicit' | 'implicit' | 'opt_in' | 'opt_out';
  captureMethod: 'web_form' | 'email' | 'phone' | 'paper' | 'api';
  
  /** Expiration and renewal */
  expiresAt?: Date;
  renewalRequired: boolean;
  lastRenewedAt?: Date;
  
  /** Version control */
  policyVersion: string;
  consentVersion: string;
  
  /** Audit trail */
  ipAddress?: string;
  userAgent?: string;
  
  /** Additional metadata */
  metadata: Record<string, unknown>;
  
  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;
}

export type DataCategory = 
  | 'personal_identifiers'
  | 'contact_information'
  | 'demographic_data'
  | 'medical_information'
  | 'financial_information'
  | 'location_data'
  | 'device_information'
  | 'usage_analytics'
  | 'biometric_data'
  | 'genetic_data'
  | 'other';

/**
 * GDPR data subject rights request
 */
export interface DataSubjectRequest {
  /** Unique request ID */
  id: string;
  
  /** Request type */
  type: DataSubjectRightType;
  
  /** Data subject information */
  subjectId: string;
  subjectEmail: string;
  subjectName?: string;
  
  /** Request details */
  requestDate: Date;
  description?: string;
  
  /** Specific data categories requested */
  dataCategories?: DataCategory[];
  
  /** Processing activities to stop (for objection requests) */
  processingActivities?: string[];
  
  /** Status tracking */
  status: RequestStatus;
  assignedTo?: string;
  
  /** Response timeline */
  dueDate: Date;
  respondedAt?: Date;
  
  /** Identity verification */
  identityVerified: boolean;
  verificationMethod?: string;
  verifiedBy?: string;
  verifiedAt?: Date;
  
  /** Response details */
  response?: {
    action: 'granted' | 'denied' | 'partially_granted';
    reason?: string;
    dataProvided?: string;
    deletionConfirmed?: boolean;
    rectificationMade?: boolean;
  };
  
  /** Communication log */
  communications: {
    date: Date;
    method: 'email' | 'phone' | 'mail' | 'in_person';
    message: string;
    sentBy: string;
  }[];
  
  /** Additional metadata */
  metadata: Record<string, unknown>;
  
  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;
}

export type DataSubjectRightType = 
  | 'access'           // Right to access personal data
  | 'rectification'    // Right to rectify inaccurate data
  | 'erasure'          // Right to erasure ("right to be forgotten")
  | 'restrict'         // Right to restrict processing
  | 'object'           // Right to object to processing
  | 'portability'      // Right to data portability
  | 'complaint';       // Right to lodge a complaint

export type RequestStatus = 
  | 'submitted'
  | 'identity_verification_required'
  | 'under_review'
  | 'in_progress'
  | 'completed'
  | 'denied'
  | 'partially_completed'
  | 'escalated';

/**
 * GDPR data processing activity
 */
export interface ProcessingActivity {
  /** Unique activity ID */
  id: string;
  
  /** Activity name and description */
  name: string;
  description: string;
  
  /** Controller and processor details */
  controller: {
    name: string;
    contactEmail: string;
    dpoContact?: string;
  };
  
  processors?: {
    name: string;
    contactEmail: string;
    location: string;
  }[];
  
  /** Legal basis */
  legalBasis: LegalBasis[];
  purposes: string[];
  
  /** Data categories */
  dataCategories: DataCategory[];
  dataSubjectCategories: string[];
  
  /** Recipients */
  recipients?: string[];
  thirdCountryTransfers?: {
    country: string;
    adequacyDecision: boolean;
    safeguards?: string;
  }[];
  
  /** Retention */
  retentionPeriod: string;
  deletionCriteria: string;
  
  /** Security measures */
  technicalMeasures: string[];
  organizationalMeasures: string[];
  
  /** Risk assessment */
  riskLevel: 'low' | 'medium' | 'high';
  riskMitigation?: string[];
  
  /** Status */
  status: 'active' | 'suspended' | 'terminated';
  
  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;
}

/**
 * GDPR breach notification
 */
export interface GDPRBreach {
  /** Unique breach ID */
  id: string;
  
  /** Breach details */
  description: string;
  natureOfBreach: string;
  
  /** Affected data */
  dataCategories: DataCategory[];
  approximateRecordsAffected: number;
  approximateIndividualsAffected: number;
  
  /** Breach timeline */
  breachDate: Date;
  discoveryDate: Date;
  
  /** Risk assessment */
  riskToIndividuals: 'low' | 'medium' | 'high';
  likelyConsequences: string;
  
  /** Containment measures */
  containmentMeasures: string[];
  containmentDate?: Date;
  
  /** Notification requirements */
  supervisoryAuthorityNotification: {
    required: boolean;
    notified: boolean;
    notificationDate?: Date;
    referenceNumber?: string;
  };
  
  individualNotification: {
    required: boolean;
    notified: boolean;
    notificationDate?: Date;
    notificationMethod?: string;
  };
  
  /** Recovery measures */
  recoveryMeasures: string[];
  preventiveMeasures: string[];
  
  /** Status */
  status: 'identified' | 'investigating' | 'contained' | 'resolved';
  
  /** Additional metadata */
  metadata: Record<string, unknown>;
  
  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;
}

/**
 * GDPR service interface
 */
export interface GDPRService {
  /**
   * Record consent from data subject
   */
  recordConsent(context: ComplianceContext, consent: Omit<ConsentRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ComplianceResponse<{ consentId: string }>>;
  
  /**
   * Withdraw consent
   */
  withdrawConsent(context: ComplianceContext, consentId: string, reason?: string): Promise<ComplianceResponse<{ success: boolean }>>;
  
  /**
   * Check if valid consent exists
   */
  checkConsent(context: ComplianceContext, subjectId: string, consentType: ConsentType): Promise<ComplianceResponse<{ hasValidConsent: boolean; consentRecord?: ConsentRecord }>>;
  
  /**
   * Handle data subject rights request
   */
  handleDataSubjectRequest(context: ComplianceContext, request: Omit<DataSubjectRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<ComplianceResponse<{ requestId: string }>>;
  
  /**
   * Process right to erasure request
   */
  processErasureRequest(context: ComplianceContext, requestId: string): Promise<ComplianceResponse<{ deletedRecords: number; pendingDeletions: string[] }>>;
  
  /**
   * Export personal data (data portability)
   */
  exportPersonalData(context: ComplianceContext, subjectId: string, format: 'json' | 'csv' | 'xml'): Promise<ComplianceResponse<{ exportId: string; downloadUrl: string }>>;
  
  /**
   * Record GDPR breach
   */
  recordBreach(context: ComplianceContext, breach: Omit<GDPRBreach, 'id' | 'createdAt' | 'updatedAt'>): Promise<ComplianceResponse<{ breachId: string }>>;
}