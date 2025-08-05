/**
 * HIPAA-specific Types
 * 
 * Types and interfaces for HIPAA compliance in healthcare systems
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { ComplianceContext, ComplianceResponse } from './compliance';

/**
 * PHI (Protected Health Information) classification
 */
export type PHIType = 
  | 'name'
  | 'address'
  | 'date_of_birth'
  | 'ssn'
  | 'medical_record_number'
  | 'account_number'
  | 'certificate_number'
  | 'vehicle_identifier'
  | 'device_identifier'
  | 'web_url'
  | 'ip_address'
  | 'biometric_identifier'
  | 'photograph'
  | 'medical_information'
  | 'other';

/**
 * HIPAA-compliant audit entry for PHI access
 */
export interface PHIAccessLog {
  /** Unique log entry ID */
  id: string;
  
  /** Timestamp of PHI access */
  timestamp: Date;
  
  /** User accessing PHI */
  userId: string;
  userRole: string;
  userName?: string;
  
  /** Patient whose PHI was accessed */
  patientId: string;
  patientMRN?: string;
  
  /** Type of PHI accessed */
  phiType: PHIType[];
  
  /** Action performed */
  action: PHIAction;
  
  /** Purpose of access */
  purpose: PHIPurpose;
  
  /** Access method */
  accessMethod: 'direct' | 'api' | 'export' | 'report';
  
  /** System/application used */
  systemId: string;
  
  /** Network information */
  ipAddress: string;
  userAgent: string;
  
  /** Success status */
  success: boolean;
  errorMessage?: string;
  
  /** Authorization details */
  authorization: {
    granted: boolean;
    grantedBy?: string;
    grantedAt?: Date;
    reason?: string;
  };
  
  /** Additional context */
  context: Record<string, unknown>;
}

export type PHIAction = 
  | 'view'
  | 'create'
  | 'update'
  | 'delete'
  | 'export'
  | 'print'
  | 'email'
  | 'share'
  | 'copy';

export type PHIPurpose = 
  | 'treatment'
  | 'payment'
  | 'healthcare_operations'
  | 'research'
  | 'public_health'
  | 'quality_assurance'
  | 'patient_request'
  | 'legal_requirement'
  | 'emergency'
  | 'other';

/**
 * Business Associate Agreement (BAA) management
 */
export interface BusinessAssociateAgreement {
  /** Unique BAA ID */
  id: string;
  
  /** Business associate organization */
  organizationName: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone?: string;
  
  /** Agreement details */
  agreementType: 'standard' | 'custom';
  signedDate: Date;
  effectiveDate: Date;
  expirationDate: Date;
  
  /** Services covered */
  servicesDescription: string;
  phiTypesAccessed: PHIType[];
  
  /** Status */
  status: 'active' | 'expired' | 'terminated' | 'pending';
  
  /** Document references */
  documentUrl?: string;
  signatureHash?: string;
  
  /** Compliance tracking */
  lastAuditDate?: Date;
  nextAuditDate?: Date;
  complianceStatus: 'compliant' | 'non_compliant' | 'under_review';
  
  /** Additional metadata */
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * HIPAA breach detection and notification
 */
export interface HIPAABreach {
  /** Unique breach ID */
  id: string;
  
  /** Breach detection timestamp */
  detectedAt: Date;
  
  /** Estimated breach occurrence time */
  occurredAt: Date;
  
  /** Breach type */
  type: BreachType;
  
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  /** Description of the breach */
  description: string;
  
  /** Affected patients */
  affectedPatients: {
    patientId: string;
    patientMRN?: string;
    phiTypesAffected: PHIType[];
  }[];
  
  /** Estimated number of individuals affected */
  individualCount: number;
  
  /** Cause of breach */
  cause: BreachCause;
  
  /** Discovery method */
  discoveryMethod: string;
  
  /** Current status */
  status: BreachStatus;
  
  /** Mitigation steps */
  mitigationSteps: string[];
  
  /** Notification requirements */
  notifications: {
    patientsNotified: boolean;
    patientsNotifiedAt?: Date;
    ochsNotified: boolean;  // Office for Civil Rights
    ochsNotifiedAt?: Date;
    mediaNotified: boolean;
    mediaNotifiedAt?: Date;
  };
  
  /** Investigation details */
  investigation: {
    assignedTo?: string;
    status: 'pending' | 'in_progress' | 'completed';
    findings?: string;
    rootCause?: string;
    preventiveMeasures?: string[];
  };
  
  /** Additional context */
  metadata: Record<string, unknown>;
}

export type BreachType = 
  | 'unauthorized_access'
  | 'unauthorized_disclosure'
  | 'data_theft'
  | 'system_compromise'
  | 'improper_disposal'
  | 'lost_device'
  | 'misdirected_communication'
  | 'hacking_incident'
  | 'malware_attack'
  | 'other';

export type BreachCause = 
  | 'human_error'
  | 'system_malfunction'
  | 'malicious_attack'
  | 'inadequate_safeguards'
  | 'policy_violation'
  | 'vendor_error'
  | 'natural_disaster'
  | 'other';

export type BreachStatus = 
  | 'detected'
  | 'investigating'
  | 'contained'
  | 'mitigated'
  | 'resolved'
  | 'reported_to_authorities';

/**
 * HIPAA service interface
 */
export interface HIPAAService {
  /**
   * Log PHI access for audit purposes
   */
  logPHIAccess(context: ComplianceContext, phiAccess: Omit<PHIAccessLog, 'id' | 'timestamp'>): Promise<ComplianceResponse<{ logId: string }>>;
  
  /**
   * Check if user has authorization to access PHI
   */
  checkPHIAuthorization(context: ComplianceContext, patientId: string, action: PHIAction, purpose: PHIPurpose): Promise<ComplianceResponse<{ authorized: boolean; reason?: string }>>;
  
  /**
   * Record a potential HIPAA breach
   */
  recordBreach(context: ComplianceContext, breach: Omit<HIPAABreach, 'id' | 'detectedAt' | 'status'>): Promise<ComplianceResponse<{ breachId: string }>>;
  
  /**
   * Generate HIPAA audit report
   */
  generateAuditReport(context: ComplianceContext, criteria: {
    startDate: Date;
    endDate: Date;
    patientId?: string;
    userId?: string;
    phiType?: PHIType;
  }): Promise<ComplianceResponse<{ reportId: string; downloadUrl?: string }>>;
  
  /**
   * Manage Business Associate Agreements
   */
  manageBBA(context: ComplianceContext, action: 'create' | 'update' | 'terminate', baa: Partial<BusinessAssociateAgreement>): Promise<ComplianceResponse<{ baaId: string }>>;
}