/**
 * Data Minimization Service
 * 
 * Implements HIPAA-compliant data minimization practices including
 * PHI retention policies, secure data anonymization, and automated
 * data lifecycle management.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { EHRApiResponse, EHRApiError, PatientDemographics } from '../types';
import { EncryptionService } from '../utils/encryption';

/**
 * Data classification levels
 */
export type DataClassification = 
  | 'public'
  | 'internal'
  | 'confidential'
  | 'restricted'
  | 'phi_identifiable'
  | 'phi_limited'
  | 'phi_de_identified';

/**
 * Data retention policies
 */
export interface RetentionPolicy {
  /** Policy identifier */
  id: string;
  /** Policy name */
  name: string;
  /** Data classification this policy applies to */
  classification: DataClassification;
  /** Retention period in days */
  retentionDays: number;
  /** Auto-delete after retention period */
  autoDelete: boolean;
  /** Auto-anonymize before deletion */
  autoAnonymize: boolean;
  /** Anonymization method */
  anonymizationMethod?: 'k_anonymity' | 'differential_privacy' | 'pseudonymization' | 'generalization';
  /** Legal basis for retention */
  legalBasis: string;
  /** Created date */
  createdDate: Date;
  /** Last updated */
  updatedDate: Date;
  /** Policy active status */
  isActive: boolean;
}

/**
 * Data record with lifecycle metadata
 */
export interface DataRecord {
  /** Record identifier */
  id: string;
  /** Data classification */
  classification: DataClassification;
  /** Patient MRN (if applicable) */
  patientMrn?: string;
  /** Record creation date */
  createdDate: Date;
  /** Last access date */
  lastAccessDate?: Date;
  /** Access count */
  accessCount: number;
  /** Data content (encrypted) */
  content: string;
  /** Retention policy ID */
  retentionPolicyId: string;
  /** Scheduled deletion date */
  scheduledDeletionDate?: Date;
  /** Anonymization status */
  anonymizationStatus: 'original' | 'anonymized' | 'deleted';
  /** Anonymization date */
  anonymizationDate?: Date;
  /** Data purpose */
  purpose: 'treatment' | 'payment' | 'operations' | 'research' | 'quality_assurance';
  /** Minimum necessary justification */
  minimumNecessaryJustification?: string;
}

/**
 * Anonymization configuration
 */
export interface AnonymizationConfig {
  /** Method to use */
  method: 'k_anonymity' | 'differential_privacy' | 'pseudonymization' | 'generalization';
  /** K value for k-anonymity */
  kValue?: number;
  /** Epsilon for differential privacy */
  epsilon?: number;
  /** Fields to anonymize */
  fieldsToAnonymize: string[];
  /** Fields to remove completely */
  fieldsToRemove: string[];
  /** Fields to generalize */
  fieldsToGeneralize?: Record<string, 'date_year' | 'age_range' | 'zip_3digit' | 'state_only'>;
  /** Preserve utility for analysis */
  preserveUtility: boolean;
}

/**
 * Anonymization result
 */
export interface AnonymizationResult {
  /** Original record ID */
  originalId: string;
  /** Anonymized record ID */
  anonymizedId: string;
  /** Anonymization method used */
  method: string;
  /** Fields that were anonymized */
  anonymizedFields: string[];
  /** Fields that were removed */
  removedFields: string[];
  /** Anonymization timestamp */
  timestamp: Date;
  /** Utility preservation score (0-1) */
  utilityScore?: number;
}

/**
 * Data minimization metrics
 */
export interface DataMinimizationMetrics {
  /** Total records under management */
  totalRecords: number;
  /** Records by classification */
  recordsByClassification: Record<DataClassification, number>;
  /** Records anonymized */
  recordsAnonymized: number;
  /** Records deleted */
  recordsDeleted: number;
  /** Average retention days */
  averageRetentionDays: number;
  /** Data size reduction percentage */
  dataSizeReduction: number;
  /** Compliance score (0-100) */
  complianceScore: number;
}

/**
 * Data Minimization Service Implementation
 */
export class DataMinimizationService {
  private encryptionService: EncryptionService;
  private retentionPolicies: Map<string, RetentionPolicy> = new Map();
  private dataRecords: Map<string, DataRecord> = new Map();
  private anonymizationResults: AnonymizationResult[] = [];

  constructor(encryptionService?: EncryptionService) {
    this.encryptionService = encryptionService || new EncryptionService();
    this.initializeDefaultPolicies();
  }

  /**
   * Create or update data record with classification
   * @param data Data content
   * @param classification Data classification level
   * @param purpose Purpose for data collection
   * @param patientMrn Patient MRN if applicable
   * @param justification Minimum necessary justification
   * @returns Promise resolving to record creation result
   */
  async createDataRecord(
    data: any,
    classification: DataClassification,
    purpose: 'treatment' | 'payment' | 'operations' | 'research' | 'quality_assurance',
    patientMrn?: string,
    justification?: string
  ): Promise<EHRApiResponse<{ recordId: string; retentionDate: Date }>> {
    try {
      // Find applicable retention policy
      const policy = this.findRetentionPolicy(classification);
      if (!policy) {
        return {
          success: false,
          error: {
            code: 'NO_RETENTION_POLICY',
            message: 'No retention policy found for data classification',
            retryable: false
          }
        };
      }

      // Encrypt the data content
      const encryptedContent = await this.encryptionService.encrypt(JSON.stringify(data));
      
      // Calculate scheduled deletion date
      const scheduledDeletionDate = new Date();
      scheduledDeletionDate.setDate(scheduledDeletionDate.getDate() + policy.retentionDays);

      // Create data record
      const recordId = this.generateRecordId();
      const record: DataRecord = {
        id: recordId,
        classification,
        patientMrn,
        createdDate: new Date(),
        accessCount: 0,
        content: JSON.stringify(encryptedContent),
        retentionPolicyId: policy.id,
        scheduledDeletionDate,
        anonymizationStatus: 'original',
        purpose,
        minimumNecessaryJustification: justification
      };

      this.dataRecords.set(recordId, record);

      return {
        success: true,
        data: {
          recordId,
          retentionDate: scheduledDeletionDate
        }
      };

    } catch (error) {
      const apiError: EHRApiError = {
        code: 'DATA_RECORD_CREATION_ERROR',
        message: 'Failed to create data record',
        details: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };

      return { success: false, error: apiError };
    }
  }

  /**
   * Access data record with audit trail
   * @param recordId Record identifier
   * @param accessorId User accessing the data
   * @param accessPurpose Purpose for access
   * @returns Promise resolving to data content
   */
  async accessDataRecord(
    recordId: string,
    accessorId: string,
    accessPurpose: string
  ): Promise<EHRApiResponse<{ data: any; classification: DataClassification }>> {
    try {
      const record = this.dataRecords.get(recordId);
      if (!record) {
        return {
          success: false,
          error: {
            code: 'RECORD_NOT_FOUND',
            message: 'Data record not found',
            retryable: false
          }
        };
      }

      // Check if record has been deleted or anonymized inappropriately
      if (record.anonymizationStatus === 'deleted') {
        return {
          success: false,
          error: {
            code: 'RECORD_DELETED',
            message: 'Data record has been deleted',
            retryable: false
          }
        };
      }

      // Update access metadata
      record.lastAccessDate = new Date();
      record.accessCount += 1;
      this.dataRecords.set(recordId, record);

      // Decrypt and return data
      const encryptedData = JSON.parse(record.content);
      const decryptedContent = await this.encryptionService.decrypt(encryptedData);
      const data = JSON.parse(decryptedContent);

      return {
        success: true,
        data: {
          data,
          classification: record.classification
        }
      };

    } catch (error) {
      const apiError: EHRApiError = {
        code: 'DATA_ACCESS_ERROR',
        message: 'Failed to access data record',
        details: error instanceof Error ? error.message : 'Unknown access error',
        retryable: true
      };

      return { success: false, error: apiError };
    }
  }

  /**
   * Anonymize data record
   * @param recordId Record identifier
   * @param config Anonymization configuration
   * @returns Promise resolving to anonymization result
   */
  async anonymizeRecord(
    recordId: string,
    config: AnonymizationConfig
  ): Promise<EHRApiResponse<{ result: AnonymizationResult }>> {
    try {
      const record = this.dataRecords.get(recordId);
      if (!record) {
        return {
          success: false,
          error: {
            code: 'RECORD_NOT_FOUND',
            message: 'Data record not found',
            retryable: false
          }
        };
      }

      if (record.anonymizationStatus !== 'original') {
        return {
          success: false,
          error: {
            code: 'ALREADY_ANONYMIZED',
            message: 'Record has already been anonymized',
            retryable: false
          }
        };
      }

      // Decrypt original data
      const encryptedData = JSON.parse(record.content);
      const originalData = JSON.parse(await this.encryptionService.decrypt(encryptedData));

      // Perform anonymization based on method
      const anonymizedData = await this.performAnonymization(originalData, config);

      // Create new anonymized record
      const anonymizedId = this.generateRecordId();
      const encryptedAnonymizedContent = await this.encryptionService.encrypt(JSON.stringify(anonymizedData));

      const anonymizedRecord: DataRecord = {
        ...record,
        id: anonymizedId,
        content: JSON.stringify(encryptedAnonymizedContent),
        anonymizationStatus: 'anonymized',
        anonymizationDate: new Date(),
        classification: 'phi_de_identified'
      };

      // Store anonymized record
      this.dataRecords.set(anonymizedId, anonymizedRecord);

      // Update original record status
      record.anonymizationStatus = 'anonymized';
      record.anonymizationDate = new Date();
      this.dataRecords.set(recordId, record);

      // Create anonymization result
      const result: AnonymizationResult = {
        originalId: recordId,
        anonymizedId,
        method: config.method,
        anonymizedFields: config.fieldsToAnonymize,
        removedFields: config.fieldsToRemove,
        timestamp: new Date(),
        utilityScore: this.calculateUtilityScore(originalData, anonymizedData)
      };

      this.anonymizationResults.push(result);

      return {
        success: true,
        data: { result }
      };

    } catch (error) {
      const apiError: EHRApiError = {
        code: 'ANONYMIZATION_ERROR',
        message: 'Failed to anonymize data record',
        details: error instanceof Error ? error.message : 'Unknown anonymization error',
        retryable: true
      };

      return { success: false, error: apiError };
    }
  }

  /**
   * Execute automated data lifecycle management
   * @returns Promise resolving to lifecycle execution result
   */
  async executeDataLifecycle(): Promise<EHRApiResponse<{
    processed: number;
    anonymized: number;
    deleted: number;
    errors: string[];
  }>> {
    try {
      let processed = 0;
      let anonymized = 0;
      let deleted = 0;
      const errors: string[] = [];

      const now = new Date();

      for (const [recordId, record] of this.dataRecords.entries()) {
        try {
          if (record.scheduledDeletionDate && record.scheduledDeletionDate <= now) {
            const policy = this.retentionPolicies.get(record.retentionPolicyId);
            
            if (policy?.autoAnonymize && record.anonymizationStatus === 'original') {
              // Auto-anonymize before deletion
              const config: AnonymizationConfig = {
                method: policy.anonymizationMethod || 'generalization',
                fieldsToAnonymize: this.getDefaultAnonymizationFields(record.classification),
                fieldsToRemove: this.getDefaultRemovalFields(record.classification),
                preserveUtility: true
              };

              const anonymizeResult = await this.anonymizeRecord(recordId, config);
              if (anonymizeResult.success) {
                anonymized++;
              } else {
                errors.push(`Failed to anonymize record ${recordId}: ${anonymizeResult.error?.message}`);
              }
            }

            if (policy?.autoDelete) {
              // Mark for deletion
              record.anonymizationStatus = 'deleted';
              this.dataRecords.set(recordId, record);
              deleted++;
            }
          }
          processed++;

        } catch (error) {
          errors.push(`Error processing record ${recordId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return {
        success: true,
        data: {
          processed,
          anonymized,
          deleted,
          errors
        }
      };

    } catch (error) {
      const apiError: EHRApiError = {
        code: 'LIFECYCLE_EXECUTION_ERROR',
        message: 'Failed to execute data lifecycle management',
        details: error instanceof Error ? error.message : 'Unknown lifecycle error',
        retryable: true
      };

      return { success: false, error: apiError };
    }
  }

  /**
   * Generate data minimization metrics report
   * @returns Promise resolving to metrics
   */
  async generateMetrics(): Promise<EHRApiResponse<{ metrics: DataMinimizationMetrics }>> {
    try {
      const totalRecords = this.dataRecords.size;
      const recordsByClassification: Record<DataClassification, number> = {
        'public': 0,
        'internal': 0,
        'confidential': 0,
        'restricted': 0,
        'phi_identifiable': 0,
        'phi_limited': 0,
        'phi_de_identified': 0
      };

      let recordsAnonymized = 0;
      let recordsDeleted = 0;
      let totalRetentionDays = 0;

      for (const record of this.dataRecords.values()) {
        recordsByClassification[record.classification]++;
        
        if (record.anonymizationStatus === 'anonymized') {
          recordsAnonymized++;
        } else if (record.anonymizationStatus === 'deleted') {
          recordsDeleted++;
        }

        const policy = this.retentionPolicies.get(record.retentionPolicyId);
        if (policy) {
          totalRetentionDays += policy.retentionDays;
        }
      }

      const averageRetentionDays = totalRecords > 0 ? totalRetentionDays / totalRecords : 0;
      const dataSizeReduction = ((recordsAnonymized + recordsDeleted) / totalRecords) * 100;
      const complianceScore = this.calculateComplianceScore();

      const metrics: DataMinimizationMetrics = {
        totalRecords,
        recordsByClassification,
        recordsAnonymized,
        recordsDeleted,
        averageRetentionDays,
        dataSizeReduction,
        complianceScore
      };

      return {
        success: true,
        data: { metrics }
      };

    } catch (error) {
      const apiError: EHRApiError = {
        code: 'METRICS_GENERATION_ERROR',
        message: 'Failed to generate data minimization metrics',
        details: error instanceof Error ? error.message : 'Unknown metrics error',
        retryable: true
      };

      return { success: false, error: apiError };
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Initialize default retention policies
   */
  private initializeDefaultPolicies(): void {
    // PHI Identifiable - 6 years per HIPAA
    this.retentionPolicies.set('phi_identifiable_policy', {
      id: 'phi_identifiable_policy',
      name: 'PHI Identifiable Data Retention',
      classification: 'phi_identifiable',
      retentionDays: 2190, // 6 years
      autoDelete: false,
      autoAnonymize: true,
      anonymizationMethod: 'k_anonymity',
      legalBasis: 'HIPAA minimum retention requirement',
      createdDate: new Date(),
      updatedDate: new Date(),
      isActive: true
    });

    // PHI Limited Dataset - 2 years
    this.retentionPolicies.set('phi_limited_policy', {
      id: 'phi_limited_policy',
      name: 'PHI Limited Dataset Retention',
      classification: 'phi_limited',
      retentionDays: 730, // 2 years
      autoDelete: false,
      autoAnonymize: true,
      anonymizationMethod: 'generalization',
      legalBasis: 'Research and quality assurance',
      createdDate: new Date(),
      updatedDate: new Date(),
      isActive: true
    });

    // De-identified - 10 years for research
    this.retentionPolicies.set('phi_deidentified_policy', {
      id: 'phi_deidentified_policy',
      name: 'De-identified Data Retention',
      classification: 'phi_de_identified',
      retentionDays: 3650, // 10 years
      autoDelete: true,
      autoAnonymize: false,
      legalBasis: 'Research value preservation',
      createdDate: new Date(),
      updatedDate: new Date(),
      isActive: true
    });
  }

  /**
   * Find applicable retention policy for classification
   * @param classification Data classification
   * @returns Retention policy or null
   */
  private findRetentionPolicy(classification: DataClassification): RetentionPolicy | null {
    for (const policy of this.retentionPolicies.values()) {
      if (policy.classification === classification && policy.isActive) {
        return policy;
      }
    }
    return null;
  }

  /**
   * Perform data anonymization based on method
   * @param data Original data
   * @param config Anonymization configuration
   * @returns Anonymized data
   */
  private async performAnonymization(data: any, config: AnonymizationConfig): Promise<any> {
    const anonymizedData = { ...data };

    // Remove specified fields
    for (const field of config.fieldsToRemove) {
      delete anonymizedData[field];
    }

    // Anonymize specified fields based on method
    for (const field of config.fieldsToAnonymize) {
      if (anonymizedData[field] !== undefined) {
        switch (config.method) {
          case 'pseudonymization':
            anonymizedData[field] = this.pseudonymize(anonymizedData[field]);
            break;
          case 'generalization':
            anonymizedData[field] = this.generalize(field, anonymizedData[field], config.fieldsToGeneralize?.[field]);
            break;
          case 'k_anonymity':
            anonymizedData[field] = this.applyKAnonymity(anonymizedData[field], config.kValue || 5);
            break;
          case 'differential_privacy':
            anonymizedData[field] = this.applyDifferentialPrivacy(anonymizedData[field], config.epsilon || 1.0);
            break;
        }
      }
    }

    return anonymizedData;
  }

  /**
   * Pseudonymize a value
   * @param value Original value
   * @returns Pseudonymized value
   */
  private pseudonymize(value: any): string {
    // Simple pseudonymization - in production, use proper techniques
    return `PSEUDO_${this.encryptionService.generateRandomString(8)}`;
  }

  /**
   * Generalize a value based on type
   * @param field Field name
   * @param value Original value
   * @param method Generalization method
   * @returns Generalized value
   */
  private generalize(field: string, value: any, method?: string): any {
    if (!method) {
      return `[${field.toUpperCase()}_GENERALIZED]`;
    }

    switch (method) {
      case 'date_year':
        if (value instanceof Date) {
          return value.getFullYear();
        }
        return new Date(value).getFullYear();
      
      case 'age_range':
        const age = typeof value === 'number' ? value : parseInt(value);
        if (age < 18) return '0-17';
        if (age < 30) return '18-29';
        if (age < 50) return '30-49';
        if (age < 70) return '50-69';
        return '70+';
      
      case 'zip_3digit':
        return typeof value === 'string' ? value.substring(0, 3) + 'XX' : 'XXXXX';
      
      case 'state_only':
        // Extract state from address if it's an address field
        return '[STATE_ONLY]';
      
      default:
        return `[GENERALIZED_${method.toUpperCase()}]`;
    }
  }

  /**
   * Apply k-anonymity to value
   * @param value Original value
   * @param k K value
   * @returns K-anonymous value
   */
  private applyKAnonymity(value: any, k: number): any {
    // Simplified k-anonymity - group values into buckets
    return `[K_ANONYMOUS_BUCKET_${Math.floor(Math.random() * k)}]`;
  }

  /**
   * Apply differential privacy to value
   * @param value Original value
   * @param epsilon Privacy parameter
   * @returns Differentially private value
   */
  private applyDifferentialPrivacy(value: any, epsilon: number): any {
    // Simplified differential privacy - add Laplace noise
    if (typeof value === 'number') {
      const noise = this.laplaceNoise(1 / epsilon);
      return Math.round(value + noise);
    }
    return `[DP_PROTECTED]`;
  }

  /**
   * Generate Laplace noise
   * @param scale Scale parameter
   * @returns Random noise
   */
  private laplaceNoise(scale: number): number {
    const u = Math.random() - 0.5;
    return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  }

  /**
   * Calculate utility preservation score
   * @param original Original data
   * @param anonymized Anonymized data
   * @returns Utility score (0-1)
   */
  private calculateUtilityScore(original: any, anonymized: any): number {
    const originalFields = Object.keys(original);
    const anonymizedFields = Object.keys(anonymized);
    
    // Simple utility score based on field preservation
    const preservedFields = anonymizedFields.length;
    const totalFields = originalFields.length;
    
    return totalFields > 0 ? preservedFields / totalFields : 0;
  }

  /**
   * Get default fields to anonymize for classification
   * @param classification Data classification
   * @returns Fields to anonymize
   */
  private getDefaultAnonymizationFields(classification: DataClassification): string[] {
    switch (classification) {
      case 'phi_identifiable':
        return ['firstName', 'lastName', 'ssn', 'dateOfBirth', 'address', 'phone', 'email'];
      case 'phi_limited':
        return ['firstName', 'lastName', 'ssn'];
      default:
        return [];
    }
  }

  /**
   * Get default fields to remove for classification
   * @param classification Data classification
   * @returns Fields to remove
   */
  private getDefaultRemovalFields(classification: DataClassification): string[] {
    switch (classification) {
      case 'phi_identifiable':
        return ['ssn', 'driverLicense', 'passport'];
      default:
        return [];
    }
  }

  /**
   * Calculate overall compliance score
   * @returns Compliance score (0-100)
   */
  private calculateComplianceScore(): number {
    // Simplified compliance calculation
    const totalRecords = this.dataRecords.size;
    if (totalRecords === 0) return 100;

    let compliantRecords = 0;
    const now = new Date();

    for (const record of this.dataRecords.values()) {
      const policy = this.retentionPolicies.get(record.retentionPolicyId);
      if (!policy) continue;

      // Check if record is within retention period or properly managed
      const isWithinRetention = !record.scheduledDeletionDate || record.scheduledDeletionDate > now;
      const isProperlyAnonymized = record.anonymizationStatus === 'anonymized' && record.classification === 'phi_de_identified';
      const isProperlyDeleted = record.anonymizationStatus === 'deleted';

      if (isWithinRetention || isProperlyAnonymized || isProperlyDeleted) {
        compliantRecords++;
      }
    }

    return Math.round((compliantRecords / totalRecords) * 100);
  }

  /**
   * Generate unique record ID
   * @returns Record ID
   */
  private generateRecordId(): string {
    return `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default DataMinimizationService;