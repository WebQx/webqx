/**
 * Core Compliance Types
 * 
 * Common types and interfaces used across all compliance modules
 * Extends existing WebQX types for seamless integration
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

export interface ComplianceConfig {
  /** HIPAA compliance configuration */
  hipaa: {
    enabled: boolean;
    strictMode: boolean;
    breachNotificationEmail?: string;
    phiRetentionDays: number;
    auditRetentionDays: number;
  };
  
  /** GDPR compliance configuration */
  gdpr: {
    enabled: boolean;
    region: 'EU' | 'UK' | 'GLOBAL';
    dataProcessingLegalBasis: string;
    consentExpiryDays: number;
    erasureTimeframeDays: number;
  };
  
  /** ISO/IEC 27001 compliance configuration */
  iso27001: {
    enabled: boolean;
    auditLevel: 'basic' | 'detailed' | 'comprehensive';
    riskAssessmentInterval: number;
    incidentResponseEnabled: boolean;
  };
}

export interface ComplianceAuditEntry {
  /** Unique audit entry ID */
  id: string;
  
  /** Timestamp of the event */
  timestamp: Date;
  
  /** Compliance standard (HIPAA, GDPR, ISO27001) */
  standard: ComplianceStandard;
  
  /** Type of compliance event */
  eventType: ComplianceEventType;
  
  /** User performing the action */
  userId: string;
  
  /** User role */
  userRole: string;
  
  /** Resource being accessed */
  resourceType: string;
  resourceId: string;
  
  /** Patient identifier if applicable */
  patientId?: string;
  
  /** IP address */
  ipAddress: string;
  
  /** User agent */
  userAgent: string;
  
  /** Action details */
  action: string;
  
  /** Success status */
  success: boolean;
  
  /** Error message if failed */
  errorMessage?: string;
  
  /** Additional context */
  context: Record<string, unknown>;
  
  /** Data sensitivity level */
  sensitivityLevel: DataSensitivityLevel;
  
  /** Compliance risk level */
  riskLevel: ComplianceRiskLevel;
}

export type ComplianceStandard = 'HIPAA' | 'GDPR' | 'ISO27001';

export type ComplianceEventType = 
  // HIPAA events
  | 'phi_access'
  | 'phi_modification'
  | 'phi_export'
  | 'phi_deletion'
  | 'breach_detected'
  | 'baa_signed'
  | 'baa_expired'
  
  // GDPR events
  | 'consent_granted'
  | 'consent_withdrawn'
  | 'data_export_request'
  | 'right_to_erasure'
  | 'data_processing'
  | 'cross_border_transfer'
  
  // ISO27001 events
  | 'access_control_audit'
  | 'encryption_policy_applied'
  | 'security_incident'
  | 'risk_assessment'
  | 'cloud_activity';

export type DataSensitivityLevel = 'public' | 'internal' | 'confidential' | 'restricted';

export type ComplianceRiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Base compliance response interface
 */
export interface ComplianceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ComplianceError;
  auditId?: string;
  complianceChecks?: ComplianceCheck[];
}

export interface ComplianceError {
  code: string;
  message: string;
  details?: string;
  standard: ComplianceStandard;
  severity: 'low' | 'medium' | 'high' | 'critical';
  remediation?: string;
}

export interface ComplianceCheck {
  standard: ComplianceStandard;
  requirement: string;
  status: 'passed' | 'failed' | 'warning';
  details?: string;
}

/**
 * Context information for compliance operations
 */
export interface ComplianceContext {
  userId: string;
  userRole: string;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  requestId: string;
  timestamp?: Date;
  
  /** Additional context specific to the operation */
  operationContext?: Record<string, unknown>;
}

/**
 * Configuration for compliance services
 */
export interface ComplianceServiceConfig {
  /** Whether the service is enabled */
  enabled: boolean;
  
  /** Logging configuration */
  logging: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
    destination: 'console' | 'file' | 'external';
  };
  
  /** Notification configuration */
  notifications: {
    enabled: boolean;
    channels: ('email' | 'sms' | 'webhook')[];
    recipients: string[];
  };
  
  /** Data retention configuration */
  retention: {
    auditLogDays: number;
    consentRecordDays: number;
    incidentRecordDays: number;
  };
}