/**
 * LGPD-specific Types
 * 
 * Types and interfaces for LGPD (Lei Geral de Proteção de Dados) compliance in healthcare systems
 * LGPD is Brazil's data protection law, similar to GDPR but with specific requirements
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { ComplianceContext, ComplianceResponse } from './compliance';

/**
 * LGPD consent types and legal basis (adapted from GDPR for Brazilian requirements)
 */
export type LGPDConsentType = 
  | 'dados_pessoais'           // Personal data processing
  | 'dados_sensiveis'          // Sensitive data processing  
  | 'compartilhamento_dados'   // Data sharing
  | 'comunicacoes_marketing'   // Marketing communications
  | 'participacao_pesquisa'    // Research participation
  | 'servicos_terceiros'       // Third-party services
  | 'tratamento_medico'        // Medical treatment
  | 'contato_emergencia';      // Emergency contact

export type LGPDLegalBasis = 
  | 'consentimento'            // Consent
  | 'cumprimento_obrigacao'    // Legal obligation
  | 'administracao_publica'    // Public administration
  | 'estudos_orgao_pesquisa'   // Research studies
  | 'execucao_contrato'        // Contract execution
  | 'exercicio_direitos'       // Exercise of rights
  | 'protecao_vida'            // Protection of life
  | 'tutela_saude'             // Health protection
  | 'interesse_legitimo'       // Legitimate interest
  | 'protecao_credito';        // Credit protection

/**
 * LGPD consent record (similar to GDPR but with Brazilian-specific fields)
 */
export interface LGPDConsentRecord {
  /** Unique consent ID */
  id: string;
  
  /** Data subject (titular dos dados) */
  subjectId: string;
  subjectEmail?: string;
  subjectCPF?: string;  // Brazilian tax ID
  
  /** Type of consent */
  consentType: LGPDConsentType;
  
  /** Legal basis for processing */
  legalBasis: LGPDLegalBasis;
  
  /** Consent details */
  granted: boolean;
  consentText: string;
  explicitConsent: boolean;  // LGPD requires explicit consent for sensitive data
  
  /** Pseudonymization requirements */
  pseudonymizationRequired: boolean;
  pseudonymizationApplied: boolean;
  
  /** Consent metadata */
  grantedAt: Date;
  withdrawnAt?: Date;
  expiresAt?: Date;
  
  /** Audit trail */
  ipAddress: string;
  userAgent: string;
  language: 'pt-BR' | 'en';  // Portuguese is primary language for LGPD
  
  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * LGPD data subject request types
 */
export type LGPDDataSubjectRightType = 
  | 'confirmacao_existencia'      // Confirmation of data existence
  | 'acesso_dados'               // Data access
  | 'correcao_dados'             // Data correction
  | 'anonimizacao'               // Anonymization
  | 'bloqueio_dados'             // Data blocking
  | 'eliminacao_dados'           // Data elimination/erasure
  | 'portabilidade_dados'        // Data portability
  | 'eliminacao_consentimento'   // Consent withdrawal
  | 'informacao_uso_publico'     // Information about public use
  | 'informacao_compartilhamento'; // Information about data sharing

export type LGPDRequestStatus = 
  | 'submetido'      // Submitted
  | 'em_analise'     // Under review
  | 'aprovado'       // Approved
  | 'rejeitado'      // Rejected
  | 'concluido'      // Completed
  | 'cancelado';     // Canceled

/**
 * LGPD data subject request
 */
export interface LGPDDataSubjectRequest {
  /** Unique request ID */
  id: string;
  
  /** Data subject information */
  subjectId: string;
  subjectCPF?: string;
  subjectEmail: string;
  subjectName: string;
  
  /** Request details */
  type: LGPDDataSubjectRightType;
  description: string;
  status: LGPDRequestStatus;
  
  /** LGPD-specific requirements */
  identityVerified: boolean;
  identityVerificationMethod?: string;
  
  /** Response timeline (LGPD: 15 days, extendable to 30) */
  submittedAt: Date;
  dueDate: Date;
  respondedAt?: Date;
  
  /** Request resolution */
  response?: {
    action: 'granted' | 'denied' | 'partial';
    reason?: string;
    evidence?: string;
  };
  
  /** Communication log */
  communications: Array<{
    timestamp: Date;
    type: 'request' | 'response' | 'clarification';
    content: string;
    sender: 'subject' | 'controller';
  }>;
  
  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;
}

/**
 * LGPD data categories (similar to GDPR but with Brazilian context)
 */
export type LGPDDataCategory = 
  | 'dados_identificacao'        // Identification data
  | 'dados_contato'             // Contact data
  | 'dados_demograficos'        // Demographic data
  | 'dados_financeiros'         // Financial data
  | 'dados_saude'               // Health data (sensitive)
  | 'dados_biometricos'         // Biometric data (sensitive)
  | 'dados_geneticos'           // Genetic data (sensitive)
  | 'dados_origem_racial'       // Racial origin (sensitive)
  | 'dados_religiosos'          // Religious data (sensitive)
  | 'dados_politicos'           // Political data (sensitive)
  | 'dados_localizacao'         // Location data
  | 'dados_comportamentais';    // Behavioral data

/**
 * LGPD breach notification
 */
export interface LGPDBreach {
  /** Unique breach ID */
  id: string;
  
  /** Breach details */
  occurredAt: Date;
  detectedAt: Date;
  description: string;
  
  /** Risk assessment */
  riskToIndividuals: 'baixo' | 'medio' | 'alto';  // Low, Medium, High
  approximateIndividualsAffected: number;
  dataCategories: LGPDDataCategory[];
  
  /** ANPD (Brazilian DPA) notification */
  anpdNotification: {
    required: boolean;
    notified: boolean;
    notificationDate?: Date;
    notificationReference?: string;
  };
  
  /** Individual notification */
  individualNotification: {
    required: boolean;
    notified: boolean;
    notificationMethod?: 'email' | 'correio' | 'publicacao';  // Email, Mail, Publication
    notificationDate?: Date;
  };
  
  /** Remedial actions */
  remedialActions: string[];
  preventiveMeasures: string[];
  
  /** Brazilian-specific fields */
  localLawEnforcement: {
    notified: boolean;
    notificationDate?: Date;
    caseNumber?: string;
  };
  
  /** Status tracking */
  status: 'identificado' | 'investigando' | 'resolvido';  // Identified, Investigating, Resolved
  
  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * LGPD Service interface
 */
export interface LGPDService {
  /**
   * Record consent from data subject
   */
  recordConsent(
    context: ComplianceContext,
    consent: Omit<LGPDConsentRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ComplianceResponse<{ consentId: string }>>;

  /**
   * Withdraw consent
   */
  withdrawConsent(
    context: ComplianceContext,
    consentId: string,
    reason?: string
  ): Promise<ComplianceResponse<{ success: boolean }>>;

  /**
   * Check if valid consent exists
   */
  checkConsent(
    context: ComplianceContext,
    subjectId: string,
    consentType: LGPDConsentType
  ): Promise<ComplianceResponse<{ hasValidConsent: boolean; consentRecord?: LGPDConsentRecord }>>;

  /**
   * Handle data subject rights request
   */
  handleDataSubjectRequest(
    context: ComplianceContext,
    request: Omit<LGPDDataSubjectRequest, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ComplianceResponse<{ requestId: string }>>;

  /**
   * Process data elimination request (similar to GDPR right to erasure)
   */
  processEliminationRequest(
    context: ComplianceContext,
    requestId: string
  ): Promise<ComplianceResponse<{ deletedRecords: number; pendingDeletions: string[] }>>;

  /**
   * Apply pseudonymization to data
   */
  applyPseudonymization(
    context: ComplianceContext,
    dataType: LGPDDataCategory,
    dataId: string
  ): Promise<ComplianceResponse<{ pseudonymized: boolean; pseudonymId?: string }>>;

  /**
   * Export personal data (data portability)
   */
  exportPersonalData(
    context: ComplianceContext,
    subjectId: string,
    format: 'json' | 'csv' | 'xml'
  ): Promise<ComplianceResponse<{ exportId: string; downloadUrl: string }>>;

  /**
   * Record LGPD breach
   */
  recordBreach(
    context: ComplianceContext,
    breach: Omit<LGPDBreach, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ComplianceResponse<{ breachId: string }>>;

  /**
   * Generate LGPD compliance report
   */
  generateComplianceReport(
    context: ComplianceContext,
    reportType: 'resumo' | 'detalhado' | 'incidentes',  // Summary, Detailed, Incidents
    period: { startDate: Date; endDate: Date }
  ): Promise<ComplianceResponse<{ reportId: string; downloadUrl?: string }>>;
}