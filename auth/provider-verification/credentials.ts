/**
 * Provider Credentials Management for WebQX™
 * 
 * Comprehensive credential management system for healthcare providers
 * including certifications, privileges, and ongoing monitoring.
 */

import {
  Provider,
  BoardCertification,
  HospitalPrivilege,
  MedicalSpecialty,
  ProviderVerificationStatus
} from '../types';

export interface CredentialDocument {
  id: string;
  providerId: string;
  type: CredentialType;
  documentName: string;
  issueDate: Date;
  expirationDate?: Date;
  issuingAuthority: string;
  documentNumber: string;
  status: CredentialStatus;
  verificationDate?: Date;
  attachmentUrl?: string;
  metadata: Record<string, any>;
}

export type CredentialType = 
  | 'MEDICAL_LICENSE'
  | 'BOARD_CERTIFICATION'
  | 'DEA_REGISTRATION'
  | 'NPI_CERTIFICATE'
  | 'HOSPITAL_PRIVILEGE'
  | 'CME_CERTIFICATE'
  | 'MALPRACTICE_INSURANCE'
  | 'BACKGROUND_CHECK'
  | 'IMMUNIZATION_RECORD'
  | 'SPECIALTY_CERTIFICATION';

export type CredentialStatus = 
  | 'PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'EXPIRED'
  | 'REVOKED'
  | 'SUSPENDED'
  | 'RENEWAL_REQUIRED';

export interface CredentialAlert {
  id: string;
  providerId: string;
  credentialId: string;
  alertType: 'EXPIRATION_WARNING' | 'RENEWAL_REQUIRED' | 'VERIFICATION_FAILED';
  message: string;
  daysUntilExpiration?: number;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  createdAt: Date;
  acknowledged: boolean;
}

/**
 * Provider credentials management service
 */
export class ProviderCredentialsManager {
  private credentials: Map<string, CredentialDocument[]>;
  private alerts: Map<string, CredentialAlert[]>;

  constructor() {
    this.credentials = new Map();
    this.alerts = new Map();
  }

  /**
   * Add credential document for provider
   */
  async addCredential(credential: Omit<CredentialDocument, 'id'>): Promise<string> {
    const credentialId = `cred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newCredential: CredentialDocument = {
      ...credential,
      id: credentialId
    };

    const providerCredentials = this.credentials.get(credential.providerId) || [];
    providerCredentials.push(newCredential);
    this.credentials.set(credential.providerId, providerCredentials);

    console.log(`[Credentials] Added ${credential.type} for provider ${credential.providerId}`);

    // Check if credential needs verification
    if (newCredential.status === 'PENDING_VERIFICATION') {
      await this.scheduleVerification(credentialId);
    }

    return credentialId;
  }

  /**
   * Update credential status
   */
  async updateCredentialStatus(
    credentialId: string, 
    status: CredentialStatus,
    verificationDate?: Date
  ): Promise<void> {
    for (const [providerId, credentials] of Array.from(this.credentials.entries())) {
      const credential = credentials.find(c => c.id === credentialId);
      
      if (credential) {
        credential.status = status;
        if (verificationDate) {
          credential.verificationDate = verificationDate;
        }

        console.log(`[Credentials] Updated credential ${credentialId} status to ${status}`);

        // Generate alerts for status changes
        await this.handleStatusChange(credential, status);
        return;
      }
    }

    throw new Error(`Credential ${credentialId} not found`);
  }

  /**
   * Get all credentials for a provider
   */
  getProviderCredentials(providerId: string): CredentialDocument[] {
    return this.credentials.get(providerId) || [];
  }

  /**
   * Get credentials by type
   */
  getCredentialsByType(providerId: string, type: CredentialType): CredentialDocument[] {
    const providerCredentials = this.getProviderCredentials(providerId);
    return providerCredentials.filter(c => c.type === type);
  }

  /**
   * Check credential compliance for provider
   */
  async checkComplianceStatus(providerId: string): Promise<{
    isCompliant: boolean;
    missingCredentials: CredentialType[];
    expiringCredentials: CredentialDocument[];
    expiredCredentials: CredentialDocument[];
  }> {
    const credentials = this.getProviderCredentials(providerId);
    const requiredCredentials = this.getRequiredCredentials();
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));

    // Check for missing required credentials
    const missingCredentials = requiredCredentials.filter(required => 
      !credentials.some(c => c.type === required && c.status === 'VERIFIED')
    );

    // Check for expiring credentials (within 30 days)
    const expiringCredentials = credentials.filter(c => 
      c.expirationDate && 
      c.expirationDate <= thirtyDaysFromNow && 
      c.expirationDate > now &&
      c.status === 'VERIFIED'
    );

    // Check for expired credentials
    const expiredCredentials = credentials.filter(c => 
      c.expirationDate && 
      c.expirationDate <= now
    );

    const isCompliant = missingCredentials.length === 0 && 
                       expiredCredentials.length === 0;

    console.log(`[Credentials] Compliance check for ${providerId}: ${isCompliant ? 'COMPLIANT' : 'NON-COMPLIANT'}`);

    return {
      isCompliant,
      missingCredentials,
      expiringCredentials,
      expiredCredentials
    };
  }

  /**
   * Generate credential alerts
   */
  async generateAlerts(providerId: string): Promise<CredentialAlert[]> {
    const credentials = this.getProviderCredentials(providerId);
    const alerts: CredentialAlert[] = [];
    const now = new Date();

    for (const credential of credentials) {
      if (!credential.expirationDate) continue;

      const daysUntilExpiration = Math.ceil(
        (credential.expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Generate expiration warnings
      if (daysUntilExpiration <= 90 && daysUntilExpiration > 0) {
        const urgency = this.getExpirationUrgency(daysUntilExpiration);
        const alertType = daysUntilExpiration <= 30 ? 'RENEWAL_REQUIRED' : 'EXPIRATION_WARNING';

        alerts.push({
          id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          providerId,
          credentialId: credential.id,
          alertType,
          message: this.generateExpirationMessage(credential, daysUntilExpiration),
          daysUntilExpiration,
          urgency,
          createdAt: new Date(),
          acknowledged: false
        });
      }

      // Generate alerts for expired credentials
      if (daysUntilExpiration <= 0) {
        alerts.push({
          id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          providerId,
          credentialId: credential.id,
          alertType: 'VERIFICATION_FAILED',
          message: `${credential.type} has expired and requires immediate renewal`,
          daysUntilExpiration,
          urgency: 'CRITICAL',
          createdAt: new Date(),
          acknowledged: false
        });
      }
    }

    // Store alerts
    this.alerts.set(providerId, alerts);
    
    console.log(`[Credentials] Generated ${alerts.length} alerts for provider ${providerId}`);
    
    return alerts;
  }

  /**
   * Get provider alerts
   */
  getProviderAlerts(providerId: string): CredentialAlert[] {
    return this.alerts.get(providerId) || [];
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string): Promise<void> {
    for (const [providerId, alerts] of Array.from(this.alerts.entries())) {
      const alert = alerts.find(a => a.id === alertId);
      
      if (alert) {
        alert.acknowledged = true;
        console.log(`[Credentials] Alert ${alertId} acknowledged`);
        return;
      }
    }

    throw new Error(`Alert ${alertId} not found`);
  }

  /**
   * Monitor credentials for expiration
   */
  async monitorCredentials(): Promise<void> {
    console.log('[Credentials] Starting credential monitoring');

    for (const [providerId] of Array.from(this.credentials.entries())) {
      await this.generateAlerts(providerId);
    }

    console.log('[Credentials] Credential monitoring complete');
  }

  /**
   * Generate credential summary report
   */
  async generateCredentialReport(providerId: string): Promise<{
    providerId: string;
    totalCredentials: number;
    verifiedCredentials: number;
    pendingCredentials: number;
    expiredCredentials: number;
    complianceStatus: boolean;
    alerts: CredentialAlert[];
  }> {
    const credentials = this.getProviderCredentials(providerId);
    const alerts = this.getProviderAlerts(providerId);
    const compliance = await this.checkComplianceStatus(providerId);

    const verifiedCredentials = credentials.filter(c => c.status === 'VERIFIED').length;
    const pendingCredentials = credentials.filter(c => c.status === 'PENDING_VERIFICATION').length;
    const expiredCredentials = compliance.expiredCredentials.length;

    return {
      providerId,
      totalCredentials: credentials.length,
      verifiedCredentials,
      pendingCredentials,
      expiredCredentials,
      complianceStatus: compliance.isCompliant,
      alerts: alerts.filter(a => !a.acknowledged)
    };
  }

  /**
   * Get required credentials for healthcare providers
   */
  private getRequiredCredentials(): CredentialType[] {
    return [
      'MEDICAL_LICENSE',
      'BOARD_CERTIFICATION',
      'NPI_CERTIFICATE',
      'MALPRACTICE_INSURANCE',
      'BACKGROUND_CHECK'
    ];
  }

  /**
   * Handle credential status changes
   */
  private async handleStatusChange(
    credential: CredentialDocument, 
    newStatus: CredentialStatus
  ): Promise<void> {
    if (newStatus === 'EXPIRED' || newStatus === 'REVOKED') {
      // Generate critical alert
      const alert: CredentialAlert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        providerId: credential.providerId,
        credentialId: credential.id,
        alertType: 'VERIFICATION_FAILED',
        message: `${credential.type} status changed to ${newStatus}`,
        urgency: 'CRITICAL',
        createdAt: new Date(),
        acknowledged: false
      };

      const providerAlerts = this.alerts.get(credential.providerId) || [];
      providerAlerts.push(alert);
      this.alerts.set(credential.providerId, providerAlerts);
    }
  }

  /**
   * Schedule credential verification
   */
  private async scheduleVerification(credentialId: string): Promise<void> {
    // In real implementation, this would schedule a verification task
    console.log(`[Credentials] Scheduled verification for credential ${credentialId}`);
  }

  /**
   * Get expiration urgency level
   */
  private getExpirationUrgency(daysUntilExpiration: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (daysUntilExpiration <= 7) return 'CRITICAL';
    if (daysUntilExpiration <= 30) return 'HIGH';
    if (daysUntilExpiration <= 60) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Generate expiration message
   */
  private generateExpirationMessage(credential: CredentialDocument, daysUntilExpiration: number): string {
    const credentialName = credential.type.replace(/_/g, ' ').toLowerCase();
    
    if (daysUntilExpiration <= 7) {
      return `Your ${credentialName} expires in ${daysUntilExpiration} days. Immediate action required.`;
    } else if (daysUntilExpiration <= 30) {
      return `Your ${credentialName} expires in ${daysUntilExpiration} days. Please begin renewal process.`;
    } else {
      return `Your ${credentialName} expires in ${daysUntilExpiration} days. Consider starting renewal process.`;
    }
  }
}

export default ProviderCredentialsManager;