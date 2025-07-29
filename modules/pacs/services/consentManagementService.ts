/**
 * Consent Management Service - Patient Imaging Access Control
 * WebQX™ Healthcare Platform
 * 
 * Manages patient consent for imaging access, audit trails,
 * and compliance with healthcare regulations.
 */

import {
  PatientConsent,
  ImagingAccessRequest,
  PacsAuditEvent,
  PacsServiceResponse
} from '../types/pacsTypes';

export interface ConsentTemplate {
  templateId: string;
  templateName: string;
  consentType: 'imaging_access' | 'data_sharing' | 'research_participation';
  language: string;
  content: string;
  version: string;
  effectiveDate: string;
  expirationDate?: string;
  requiredFields: string[];
}

export class ConsentManagementService {
  private consents: Map<string, PatientConsent[]> = new Map();
  private accessRequests: Map<string, ImagingAccessRequest> = new Map();
  private consentTemplates: Map<string, ConsentTemplate> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
  }

  /**
   * Grant patient consent for imaging access
   */
  async grantConsent(
    patientID: string,
    consentType: 'imaging_access' | 'data_sharing' | 'research_participation',
    consentDocument?: string,
    witnessID?: string
  ): Promise<PacsServiceResponse<PatientConsent>> {
    try {
      const consent: PatientConsent = {
        patientID,
        consentType,
        consentStatus: 'granted',
        consentDate: new Date().toISOString(),
        expirationDate: this.calculateExpirationDate(consentType),
        consentDocument,
        witnessID
      };

      // Store consent
      const patientConsents = this.consents.get(patientID) || [];
      
      // Revoke any existing consent of the same type
      const updatedConsents = patientConsents.filter(c => c.consentType !== consentType);
      updatedConsents.push(consent);
      this.consents.set(patientID, updatedConsents);

      // Create audit event
      await this.createAuditEvent({
        eventType: 'consent_change',
        userID: patientID,
        userType: 'patient',
        patientID,
        additionalData: {
          action: 'grant',
          consentType,
          witnessID
        }
      });

      return {
        success: true,
        data: consent,
        metadata: {
          timestamp: new Date().toISOString(),
          requestID: this.generateRequestId(),
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('Failed to grant consent', error);
    }
  }

  /**
   * Revoke patient consent
   */
  async revokeConsent(
    patientID: string,
    consentType: 'imaging_access' | 'data_sharing' | 'research_participation',
    reason: string
  ): Promise<PacsServiceResponse<PatientConsent>> {
    try {
      const patientConsents = this.consents.get(patientID) || [];
      const existingConsent = patientConsents.find(c => c.consentType === consentType);

      if (!existingConsent) {
        throw new Error('No existing consent found to revoke');
      }

      // Update consent status
      const revokedConsent: PatientConsent = {
        ...existingConsent,
        consentStatus: 'denied',
        revokedDate: new Date().toISOString(),
        revokedReason: reason
      };

      // Update stored consent
      const updatedConsents = patientConsents.filter(c => c.consentType !== consentType);
      updatedConsents.push(revokedConsent);
      this.consents.set(patientID, updatedConsents);

      // Create audit event
      await this.createAuditEvent({
        eventType: 'consent_change',
        userID: patientID,
        userType: 'patient',
        patientID,
        additionalData: {
          action: 'revoke',
          consentType,
          reason
        }
      });

      return {
        success: true,
        data: revokedConsent,
        metadata: {
          timestamp: new Date().toISOString(),
          requestID: this.generateRequestId(),
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('Failed to revoke consent', error);
    }
  }

  /**
   * Check if patient has valid consent
   */
  async hasValidConsent(
    patientID: string,
    consentType: 'imaging_access' | 'data_sharing' | 'research_participation'
  ): Promise<PacsServiceResponse<boolean>> {
    try {
      const patientConsents = this.consents.get(patientID) || [];
      const consent = patientConsents.find(c => c.consentType === consentType);

      if (!consent || consent.consentStatus !== 'granted') {
        return {
          success: true,
          data: false,
          metadata: {
            timestamp: new Date().toISOString(),
            requestID: this.generateRequestId(),
            processingTime: Date.now()
          }
        };
      }

      // Check if consent has expired
      const isExpired = consent.expirationDate && 
        new Date(consent.expirationDate) < new Date();

      return {
        success: true,
        data: !isExpired,
        metadata: {
          timestamp: new Date().toISOString(),
          requestID: this.generateRequestId(),
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('Failed to check consent status', error);
    }
  }

  /**
   * Create imaging access request
   */
  async createAccessRequest(
    patientID: string,
    requesterID: string,
    requesterType: 'patient' | 'provider' | 'family_member' | 'researcher',
    studyInstanceUID: string,
    accessType: 'view' | 'download' | 'share',
    justification: string
  ): Promise<PacsServiceResponse<ImagingAccessRequest>> {
    try {
      const request: ImagingAccessRequest = {
        requestID: this.generateRequestId(),
        patientID,
        requesterID,
        requesterType,
        studyInstanceUID,
        accessType,
        requestDate: new Date().toISOString(),
        justification,
        status: 'pending',
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      };

      this.accessRequests.set(request.requestID, request);

      // Create audit event
      await this.createAuditEvent({
        eventType: 'study_access',
        userID: requesterID,
        userType: requesterType,
        patientID,
        studyInstanceUID,
        additionalData: {
          action: 'request_access',
          accessType,
          justification
        }
      });

      return {
        success: true,
        data: request,
        metadata: {
          timestamp: new Date().toISOString(),
          requestID: request.requestID,
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('Failed to create access request', error);
    }
  }

  /**
   * Approve access request
   */
  async approveAccessRequest(
    requestID: string,
    approverID: string
  ): Promise<PacsServiceResponse<ImagingAccessRequest>> {
    try {
      const request = this.accessRequests.get(requestID);
      if (!request) {
        throw new Error('Access request not found');
      }

      const updatedRequest: ImagingAccessRequest = {
        ...request,
        status: 'approved',
        approverID,
        approvalDate: new Date().toISOString()
      };

      this.accessRequests.set(requestID, updatedRequest);

      // Create audit event
      await this.createAuditEvent({
        eventType: 'study_access',
        userID: approverID,
        userType: 'provider',
        patientID: request.patientID,
        studyInstanceUID: request.studyInstanceUID,
        additionalData: {
          action: 'approve_access',
          requestID,
          requesterID: request.requesterID
        }
      });

      return {
        success: true,
        data: updatedRequest,
        metadata: {
          timestamp: new Date().toISOString(),
          requestID: this.generateRequestId(),
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('Failed to approve access request', error);
    }
  }

  /**
   * Deny access request
   */
  async denyAccessRequest(
    requestID: string,
    approverID: string,
    denialReason: string
  ): Promise<PacsServiceResponse<ImagingAccessRequest>> {
    try {
      const request = this.accessRequests.get(requestID);
      if (!request) {
        throw new Error('Access request not found');
      }

      const updatedRequest: ImagingAccessRequest = {
        ...request,
        status: 'denied',
        approverID,
        approvalDate: new Date().toISOString(),
        denialReason
      };

      this.accessRequests.set(requestID, updatedRequest);

      // Create audit event
      await this.createAuditEvent({
        eventType: 'study_access',
        userID: approverID,
        userType: 'provider',
        patientID: request.patientID,
        studyInstanceUID: request.studyInstanceUID,
        additionalData: {
          action: 'deny_access',
          requestID,
          requesterID: request.requesterID,
          denialReason
        }
      });

      return {
        success: true,
        data: updatedRequest,
        metadata: {
          timestamp: new Date().toISOString(),
          requestID: this.generateRequestId(),
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('Failed to deny access request', error);
    }
  }

  /**
   * Get patient consents
   */
  async getPatientConsents(patientID: string): Promise<PacsServiceResponse<PatientConsent[]>> {
    try {
      const consents = this.consents.get(patientID) || [];
      
      return {
        success: true,
        data: consents,
        metadata: {
          timestamp: new Date().toISOString(),
          requestID: this.generateRequestId(),
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('Failed to get patient consents', error);
    }
  }

  /**
   * Get consent templates
   */
  async getConsentTemplates(language: string = 'en'): Promise<PacsServiceResponse<ConsentTemplate[]>> {
    try {
      const templates = Array.from(this.consentTemplates.values())
        .filter(template => template.language === language);

      return {
        success: true,
        data: templates,
        metadata: {
          timestamp: new Date().toISOString(),
          requestID: this.generateRequestId(),
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return this.handleError('Failed to get consent templates', error);
    }
  }

  /**
   * Private helper methods
   */
  private calculateExpirationDate(consentType: string): string {
    const now = new Date();
    let expirationMonths = 12; // Default 1 year

    switch (consentType) {
      case 'imaging_access':
        expirationMonths = 24; // 2 years
        break;
      case 'data_sharing':
        expirationMonths = 12; // 1 year
        break;
      case 'research_participation':
        expirationMonths = 36; // 3 years
        break;
    }

    now.setMonth(now.getMonth() + expirationMonths);
    return now.toISOString();
  }

  private async createAuditEvent(eventData: Partial<PacsAuditEvent>): Promise<void> {
    const auditEvent: PacsAuditEvent = {
      eventID: this.generateRequestId(),
      eventType: eventData.eventType || 'consent_change',
      timestamp: new Date().toISOString(),
      userID: eventData.userID || 'system',
      userType: eventData.userType || 'system',
      patientID: eventData.patientID,
      studyInstanceUID: eventData.studyInstanceUID,
      ipAddress: '127.0.0.1', // Would be extracted from request in real implementation
      userAgent: 'WebQX-PACS-Service',
      sessionID: this.generateSessionId(),
      additionalData: eventData.additionalData,
      complianceFlags: {
        hipaaCompliant: true,
        gdprCompliant: true,
        auditRetention: 2555 // 7 years
      }
    };

    // In a real implementation, this would be sent to audit logging service
    console.log('Audit Event:', auditEvent);
  }

  private initializeDefaultTemplates(): void {
    const templates: ConsentTemplate[] = [
      {
        templateId: 'imaging_access_en',
        templateName: 'Imaging Access Consent',
        consentType: 'imaging_access',
        language: 'en',
        content: 'I consent to accessing my medical imaging studies through the WebQX™ platform...',
        version: '1.0',
        effectiveDate: new Date().toISOString(),
        requiredFields: ['patientSignature', 'date']
      },
      {
        templateId: 'imaging_access_es',
        templateName: 'Consentimiento de Acceso a Imágenes',
        consentType: 'imaging_access',
        language: 'es',
        content: 'Consiento en acceder a mis estudios de imágenes médicas a través de la plataforma WebQX™...',
        version: '1.0',
        effectiveDate: new Date().toISOString(),
        requiredFields: ['patientSignature', 'date']
      }
    ];

    templates.forEach(template => {
      this.consentTemplates.set(template.templateId, template);
    });
  }

  private generateRequestId(): string {
    return `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleError(message: string, error: any): PacsServiceResponse<never> {
    console.error(message, error);
    return {
      success: false,
      error: {
        code: 'CONSENT_ERROR',
        message,
        details: error.message || error
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestID: this.generateRequestId(),
        processingTime: Date.now()
      }
    };
  }
}