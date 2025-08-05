/**
 * ISO/IEC 27001-specific Types
 * 
 * Types and interfaces for ISO/IEC 27001 compliance in healthcare systems
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { ComplianceContext, ComplianceResponse } from './compliance';

/**
 * ISO 27001 Information Security Management System (ISMS)
 */
export interface ISMSConfiguration {
  /** Configuration ID */
  id: string;
  
  /** ISMS scope definition */
  scope: {
    description: string;
    inclusions: string[];
    exclusions: string[];
    boundaries: string[];
  };
  
  /** Information security policy */
  policy: {
    version: string;
    approvedBy: string;
    approvedDate: Date;
    nextReviewDate: Date;
    objectives: string[];
  };
  
  /** Risk management configuration */
  riskManagement: {
    riskAcceptanceCriteria: RiskAcceptanceCriteria;
    riskAssessmentMethod: string;
    riskTreatmentOptions: RiskTreatmentOption[];
  };
  
  /** Control objectives */
  controlObjectives: ControlObjective[];
  
  /** Status */
  status: 'active' | 'under_review' | 'pending_approval';
  
  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;
}

export interface RiskAcceptanceCriteria {
  /** Maximum acceptable risk level */
  maxRiskLevel: 'low' | 'medium' | 'high';
  
  /** Risk matrix thresholds */
  riskMatrix: {
    probability: { low: number; medium: number; high: number };
    impact: { low: number; medium: number; high: number };
  };
  
  /** Business justification requirements */
  justificationRequired: boolean;
  approvalRequired: boolean;
}

export type RiskTreatmentOption = 'accept' | 'avoid' | 'mitigate' | 'transfer';

/**
 * ISO 27001 Risk Assessment
 */
export interface RiskAssessment {
  /** Unique assessment ID */
  id: string;
  
  /** Assessment details */
  name: string;
  description: string;
  scope: string;
  
  /** Assessment methodology */
  methodology: string;
  assessmentCriteria: string;
  
  /** Assets being assessed */
  assets: InformationAsset[];
  
  /** Identified threats */
  threats: SecurityThreat[];
  
  /** Vulnerabilities identified */
  vulnerabilities: SecurityVulnerability[];
  
  /** Risk scenarios */
  riskScenarios: RiskScenario[];
  
  /** Overall risk level */
  overallRiskLevel: RiskLevel;
  
  /** Assessor information */
  assessedBy: string;
  reviewedBy?: string;
  approvedBy?: string;
  
  /** Timeline */
  assessmentDate: Date;
  reviewDate?: Date;
  approvalDate?: Date;
  nextAssessmentDate: Date;
  
  /** Status */
  status: 'draft' | 'under_review' | 'approved' | 'outdated';
  
  /** Additional metadata */
  metadata: Record<string, unknown>;
  
  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;
}

export interface InformationAsset {
  /** Asset ID */
  id: string;
  
  /** Asset details */
  name: string;
  description: string;
  type: AssetType;
  
  /** Classification */
  classification: DataClassification;
  criticality: 'low' | 'medium' | 'high' | 'critical';
  
  /** Owner and custodian */
  owner: string;
  custodian: string;
  
  /** Location */
  location: 'on_premise' | 'cloud' | 'hybrid';
  cloudProvider?: string;
  
  /** Security controls */
  securityControls: SecurityControl[];
}

export type AssetType = 
  | 'data'
  | 'software'
  | 'hardware'
  | 'network'
  | 'personnel'
  | 'facilities'
  | 'organization';

export type DataClassification = 'public' | 'internal' | 'confidential' | 'restricted';

export interface SecurityThreat {
  /** Threat ID */
  id: string;
  
  /** Threat details */
  name: string;
  description: string;
  category: ThreatCategory;
  
  /** Source of threat */
  source: ThreatSource;
  
  /** Likelihood assessment */
  likelihood: RiskLevel;
  likelihoodJustification: string;
  
  /** Affected assets */
  affectedAssets: string[];
}

export type ThreatCategory = 
  | 'malicious_attack'
  | 'human_error'
  | 'system_failure'
  | 'natural_disaster'
  | 'supply_chain'
  | 'regulatory_change';

export type ThreatSource = 'internal' | 'external' | 'environmental';

export interface SecurityVulnerability {
  /** Vulnerability ID */
  id: string;
  
  /** Vulnerability details */
  name: string;
  description: string;
  category: VulnerabilityCategory;
  
  /** CVSS score if applicable */
  cvssScore?: number;
  cveId?: string;
  
  /** Affected assets */
  affectedAssets: string[];
  
  /** Ease of exploitation */
  exploitability: RiskLevel;
  
  /** Detection difficulty */
  detectability: 'easy' | 'medium' | 'difficult';
}

export type VulnerabilityCategory = 
  | 'technical'
  | 'physical'
  | 'administrative'
  | 'human_factors';

export interface RiskScenario {
  /** Scenario ID */
  id: string;
  
  /** Scenario description */
  description: string;
  
  /** Related threat and vulnerability */
  threatId: string;
  vulnerabilityId: string;
  affectedAssetId: string;
  
  /** Risk calculation */
  likelihood: RiskLevel;
  impact: ImpactAssessment;
  riskLevel: RiskLevel;
  
  /** Risk treatment */
  treatmentOption: RiskTreatmentOption;
  treatmentJustification?: string;
  
  /** Controls */
  existingControls: SecurityControl[];
  plannedControls: SecurityControl[];
}

export interface ImpactAssessment {
  /** Overall impact level */
  overall: RiskLevel;
  
  /** Specific impact categories */
  confidentiality: RiskLevel;
  integrity: RiskLevel;
  availability: RiskLevel;
  
  /** Business impact */
  financialImpact?: number;
  operationalImpact: string;
  reputationalImpact: RiskLevel;
  legalImpact: RiskLevel;
}

export type RiskLevel = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';

/**
 * ISO 27001 Security Controls
 */
export interface SecurityControl {
  /** Control ID (from ISO 27001 Annex A) */
  id: string;
  
  /** Control details */
  name: string;
  description: string;
  category: ControlCategory;
  
  /** Implementation status */
  implementationStatus: ControlImplementationStatus;
  implementationDate?: Date;
  
  /** Effectiveness assessment */
  effectiveness: 'not_effective' | 'partially_effective' | 'effective' | 'highly_effective';
  lastTestDate?: Date;
  nextTestDate?: Date;
  
  /** Owner and responsibilities */
  controlOwner: string;
  responsible: string[];
  
  /** Documentation */
  procedureDocuments: string[];
  evidenceDocuments: string[];
  
  /** Metrics */
  controlMetrics: ControlMetric[];
  
  /** Status */
  status: 'active' | 'disabled' | 'under_review';
  
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

export type ControlCategory = 
  | 'information_security_policies'
  | 'organization_information_security'
  | 'human_resource_security'
  | 'asset_management'
  | 'access_control'
  | 'cryptography'
  | 'physical_environmental_security'
  | 'operations_security'
  | 'communications_security'
  | 'system_acquisition'
  | 'supplier_relationships'
  | 'information_security_incident'
  | 'business_continuity'
  | 'compliance';

export type ControlImplementationStatus = 
  | 'not_implemented'
  | 'partially_implemented'
  | 'implemented'
  | 'continuously_improving';

export interface ControlMetric {
  /** Metric name */
  name: string;
  
  /** Metric value */
  value: number | string;
  
  /** Target value */
  target?: number | string;
  
  /** Measurement date */
  measurementDate: Date;
  
  /** Status */
  status: 'on_target' | 'below_target' | 'above_target';
}

/**
 * ISO 27001 Control Objective
 */
export interface ControlObjective {
  /** Objective ID */
  id: string;
  
  /** Objective details */
  name: string;
  description: string;
  category: ControlCategory;
  
  /** Related controls */
  controls: string[];
  
  /** Success criteria */
  successCriteria: string[];
  
  /** Status */
  status: 'not_started' | 'in_progress' | 'achieved' | 'needs_improvement';
  
  /** Ownership */
  owner: string;
  
  /** Timeline */
  targetDate?: Date;
  achievedDate?: Date;
}

/**
 * ISO 27001 Security Incident
 */
export interface SecurityIncident {
  /** Unique incident ID */
  id: string;
  
  /** Incident details */
  title: string;
  description: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  
  /** Detection */
  detectedAt: Date;
  detectedBy: string;
  detectionMethod: 'automated' | 'manual' | 'external_report';
  
  /** Classification */
  classification: 'security_incident' | 'security_event' | 'false_positive';
  
  /** Impact assessment */
  impactAssessment: ImpactAssessment;
  affectedAssets: string[];
  
  /** Response team */
  incidentResponseTeam: string[];
  assignedTo: string;
  
  /** Timeline */
  containmentTime?: Date;
  resolutionTime?: Date;
  
  /** Response actions */
  responseActions: {
    action: string;
    performedBy: string;
    performedAt: Date;
    result: string;
  }[];
  
  /** Root cause analysis */
  rootCause?: string;
  contributingFactors?: string[];
  
  /** Lessons learned */
  lessonsLearned?: string;
  preventiveMeasures?: string[];
  
  /** Status */
  status: IncidentStatus;
  
  /** Communication */
  stakeholdersNotified: boolean;
  externalReporting: {
    required: boolean;
    reportedTo?: string[];
    reportedAt?: Date;
  };
  
  /** Additional metadata */
  metadata: Record<string, unknown>;
  
  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;
}

export type IncidentCategory = 
  | 'data_breach'
  | 'unauthorized_access'
  | 'malware'
  | 'denial_of_service'
  | 'social_engineering'
  | 'physical_security'
  | 'system_compromise'
  | 'policy_violation'
  | 'other';

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export type IncidentStatus = 
  | 'new'
  | 'investigating'
  | 'contained'
  | 'resolved'
  | 'closed'
  | 'false_positive';

/**
 * ISO 27001 service interface
 */
export interface ISO27001Service {
  /**
   * Conduct risk assessment
   */
  conductRiskAssessment(context: ComplianceContext, assessment: Omit<RiskAssessment, 'id' | 'createdAt' | 'updatedAt'>): Promise<ComplianceResponse<{ assessmentId: string }>>;
  
  /**
   * Implement security control
   */
  implementSecurityControl(context: ComplianceContext, control: Omit<SecurityControl, 'metadata'>): Promise<ComplianceResponse<{ controlId: string }>>;
  
  /**
   * Record security incident
   */
  recordSecurityIncident(context: ComplianceContext, incident: Omit<SecurityIncident, 'id' | 'createdAt' | 'updatedAt'>): Promise<ComplianceResponse<{ incidentId: string }>>;
  
  /**
   * Audit access controls
   */
  auditAccessControls(context: ComplianceContext, scope?: string[]): Promise<ComplianceResponse<{ 
    auditId: string; 
    findings: { controlId: string; status: string; issues: string[] }[] 
  }>>;
  
  /**
   * Log cloud activity for risk monitoring
   */
  logCloudActivity(context: ComplianceContext, activity: {
    service: string;
    action: string;
    resource: string;
    riskLevel: RiskLevel;
    metadata?: Record<string, unknown>;
  }): Promise<ComplianceResponse<{ logId: string }>>;
  
  /**
   * Generate compliance report
   */
  generateComplianceReport(context: ComplianceContext, reportType: 'risk_assessment' | 'control_effectiveness' | 'incident_summary'): Promise<ComplianceResponse<{ reportId: string; downloadUrl?: string }>>;
}