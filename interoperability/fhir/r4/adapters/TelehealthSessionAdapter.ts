/**
 * Telehealth Session FHIR Adapter
 * 
 * Synchronizes OpenEMR telehealth sessions with WebQx using FHIR resources.
 * Maps telehealth session metadata to FHIR resources for interoperability.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { FHIREncounter, TelehealthEncounterContext, EncounterStatus } from '../resources/Encounter';
import { FHIRConsent, TelehealthConsentContext, TELEHEALTH_CONSENT_CATEGORIES } from '../resources/Consent';
import { FHIRCommunication, PostVisitSummaryPayload, TELEHEALTH_COMMUNICATION_CATEGORIES } from '../resources/Communication';
import { FHIRDocumentReference, AmbientDocumentationContext, CLINICAL_NOTE_TYPES } from '../resources/DocumentReference';
import { WhisperService, WhisperResponse } from '../../../../services/whisperService';
import { OpenEMRIntegration } from '../../../../ehr-integrations/openemr/services/integration';
import { FHIRR4Service } from '../services/FHIRR4Service';
import type { 
  OpenEMRConfig, 
  OpenEMROperationResult,
  OpenEMRPatient,
  OpenEMREncounter
} from '../../../../ehr-integrations/openemr/types';

/**
 * Configuration for the telehealth session adapter
 */
export interface TelehealthAdapterConfig {
  /** OpenEMR integration configuration */
  openemr: OpenEMRConfig;
  /** FHIR R4 service configuration */
  fhir: {
    baseUrl: string;
    timeout?: number;
    authentication?: {
      type: 'bearer' | 'basic' | 'oauth2';
      token?: string;
      username?: string;
      password?: string;
    };
  };
  /** Whisper service configuration */
  whisper?: {
    timeout?: number;
    maxFileSize?: number;
    enableAmbientCapture?: boolean;
  };
  /** Adapter features */
  features?: {
    enableConsentManagement?: boolean;
    enableAmbientDocumentation?: boolean;
    enablePostVisitSummary?: boolean;
    enableAuditLogging?: boolean;
  };
}

/**
 * Telehealth session metadata
 */
export interface TelehealthSessionMetadata {
  /** Unique session identifier */
  sessionId: string;
  /** Patient identifier in OpenEMR */
  patientId: string;
  /** Provider identifier in OpenEMR */
  providerId: string;
  /** Session type */
  sessionType: 'video' | 'audio' | 'chat' | 'mixed';
  /** Scheduled start time */
  scheduledStart: string;
  /** Scheduled end time */
  scheduledEnd: string;
  /** Actual start time */
  actualStart?: string;
  /** Actual end time */
  actualEnd?: string;
  /** Current session status */
  status: EncounterStatus;
  /** Technical context */
  technicalContext: TelehealthEncounterContext;
  /** Associated appointment ID */
  appointmentId?: string;
  /** Chief complaint or reason for visit */
  reasonForVisit?: string;
}

/**
 * Patient consent for telehealth session
 */
export interface TelehealthPatientConsent {
  /** Patient identifier */
  patientId: string;
  /** Consent given timestamp */
  consentTimestamp: string;
  /** Consent context */
  consentContext: TelehealthConsentContext;
  /** Digital signature or consent method */
  consentMethod: 'digital-signature' | 'verbal' | 'click-through' | 'checkbox';
  /** IP address for audit trail */
  ipAddress?: string;
  /** User agent for audit trail */
  userAgent?: string;
}

/**
 * Ambient documentation result from Whisper
 */
export interface AmbientDocumentationResult {
  /** Session identifier */
  sessionId: string;
  /** Transcription result */
  transcription: WhisperResponse;
  /** Processing context */
  context: AmbientDocumentationContext;
  /** Structured clinical content */
  structuredContent?: {
    chiefComplaint?: string;
    historyOfPresentIllness?: string;
    reviewOfSystems?: string;
    physicalExam?: string;
    assessment?: string;
    plan?: string;
  };
  /** Post-processing flags */
  postProcessing: {
    phiRedacted: boolean;
    medicalTermsCorrected: boolean;
    structureApplied: boolean;
  };
}

/**
 * Telehealth Session FHIR Adapter
 * 
 * Provides seamless synchronization between OpenEMR telehealth sessions
 * and FHIR resources for interoperability and standards compliance.
 */
export class TelehealthSessionFHIRAdapter {
  private openemrService: OpenEMRIntegration;
  private fhirService: FHIRR4Service;
  private whisperService?: WhisperService;
  private config: TelehealthAdapterConfig;

  constructor(config: TelehealthAdapterConfig) {
    this.config = {
      ...config,
      features: {
        enableConsentManagement: true,
        enableAmbientDocumentation: true,
        enablePostVisitSummary: true,
        enableAuditLogging: true,
        ...config.features
      }
    };

    // Initialize services
    this.openemrService = new OpenEMRIntegration(this.config.openemr);
    this.fhirService = new FHIRR4Service(this.config.fhir);
    
    if (this.config.whisper && this.config.features?.enableAmbientDocumentation) {
      this.whisperService = new WhisperService(this.config.whisper);
    }
  }

  /**
   * Initialize the adapter
   */
  async initialize(): Promise<void> {
    await this.openemrService.initialize();
    this.log('Telehealth Session FHIR Adapter initialized successfully');
  }

  /**
   * Map telehealth session metadata to FHIR Encounter resource
   */
  async mapSessionToEncounter(
    sessionMetadata: TelehealthSessionMetadata
  ): Promise<OpenEMROperationResult<FHIREncounter>> {
    this.log('Mapping telehealth session to FHIR Encounter', { sessionId: sessionMetadata.sessionId });

    try {
      // Validate patient exists in OpenEMR
      const patientResult = await this.openemrService.getPatient(sessionMetadata.patientId);
      if (!patientResult.success) {
        throw new Error(`Patient not found in OpenEMR: ${sessionMetadata.patientId}`);
      }

      // Create FHIR Encounter resource
      const encounter: FHIREncounter = {
        resourceType: 'Encounter',
        id: `telehealth-${sessionMetadata.sessionId}`,
        identifier: [
          {
            use: 'official',
            system: 'http://webqx.health/telehealth-sessions',
            value: sessionMetadata.sessionId
          }
        ],
        status: sessionMetadata.status,
        class: {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: 'VR', // Virtual encounter
          display: 'Virtual'
        },
        type: [
          {
            coding: [
              {
                system: 'http://snomed.info/sct',
                code: '448337001',
                display: 'Telemedicine consultation'
              }
            ],
            text: 'Telehealth consultation'
          }
        ],
        subject: {
          reference: `Patient/${sessionMetadata.patientId}`,
          display: patientResult.data?.name || 'Unknown Patient'
        },
        participant: [
          {
            type: [
              {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
                    code: 'PPRF',
                    display: 'Primary Performer'
                  }
                ]
              }
            ],
            individual: {
              reference: `Practitioner/${sessionMetadata.providerId}`
            }
          }
        ],
        period: {
          start: sessionMetadata.actualStart || sessionMetadata.scheduledStart,
          end: sessionMetadata.actualEnd || sessionMetadata.scheduledEnd
        },
        reasonCode: sessionMetadata.reasonForVisit ? [
          {
            text: sessionMetadata.reasonForVisit
          }
        ] : undefined,
        location: [
          {
            location: {
              reference: 'Location/virtual-telehealth',
              display: 'Virtual Telehealth Platform'
            },
            status: 'active',
            physicalType: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/location-physical-type',
                  code: 've',
                  display: 'Virtual'
                }
              ]
            }
          }
        ]
      };

      // Save to FHIR server
      const fhirResult = await this.fhirService.create(encounter);
      
      if (this.config.features?.enableAuditLogging) {
        this.auditLog('encounter_mapped', {
          sessionId: sessionMetadata.sessionId,
          patientId: sessionMetadata.patientId,
          encounterId: encounter.id
        });
      }

      return {
        success: true,
        data: encounter
      };

    } catch (error) {
      this.log('Failed to map session to encounter:', error);
      return {
        success: false,
        error: {
          code: 'ENCOUNTER_MAPPING_FAILED',
          message: error.message
        }
      };
    }
  }

  /**
   * Represent patient agreement using FHIR Consent resource
   */
  async mapPatientConsentToFHIR(
    patientConsent: TelehealthPatientConsent
  ): Promise<OpenEMROperationResult<FHIRConsent>> {
    if (!this.config.features?.enableConsentManagement) {
      return {
        success: false,
        error: {
          code: 'CONSENT_MANAGEMENT_DISABLED',
          message: 'Consent management is not enabled'
        }
      };
    }

    this.log('Mapping patient consent to FHIR Consent', { patientId: patientConsent.patientId });

    try {
      // Create FHIR Consent resource
      const consent: FHIRConsent = {
        resourceType: 'Consent',
        id: `telehealth-consent-${patientConsent.patientId}-${Date.now()}`,
        identifier: [
          {
            use: 'official',
            system: 'http://webqx.health/telehealth-consents',
            value: `${patientConsent.patientId}-${patientConsent.consentTimestamp}`
          }
        ],
        status: 'active',
        scope: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/consentscope',
              code: 'treatment',
              display: 'Treatment'
            }
          ]
        },
        category: [
          TELEHEALTH_CONSENT_CATEGORIES.PLATFORM_USAGE,
          ...(patientConsent.consentContext.recordingConsent ? [TELEHEALTH_CONSENT_CATEGORIES.SESSION_RECORDING] : []),
          ...(patientConsent.consentContext.dataSharing.allowProviderAccess ? [TELEHEALTH_CONSENT_CATEGORIES.DATA_SHARING] : [])
        ],
        patient: {
          reference: `Patient/${patientConsent.patientId}`
        },
        dateTime: patientConsent.consentTimestamp,
        performer: [
          {
            reference: `Patient/${patientConsent.patientId}`
          }
        ],
        verification: [
          {
            verified: true,
            verifiedWith: {
              reference: `Patient/${patientConsent.patientId}`
            },
            verificationDate: patientConsent.consentTimestamp
          }
        ],
        provision: {
          type: 'permit',
          action: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/consentaction',
                  code: 'access',
                  display: 'Access'
                }
              ]
            },
            ...(patientConsent.consentContext.recordingConsent ? [
              {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/consentaction',
                    code: 'collect',
                    display: 'Collect'
                  }
                ]
              }
            ] : [])
          ]
        }
      };

      // Save to FHIR server
      const fhirResult = await this.fhirService.create(consent);
      
      if (this.config.features?.enableAuditLogging) {
        this.auditLog('consent_mapped', {
          patientId: patientConsent.patientId,
          consentId: consent.id,
          consentMethod: patientConsent.consentMethod
        });
      }

      return {
        success: true,
        data: consent
      };

    } catch (error) {
      this.log('Failed to map patient consent to FHIR:', error);
      return {
        success: false,
        error: {
          code: 'CONSENT_MAPPING_FAILED',
          message: error.message
        }
      };
    }
  }

  /**
   * Handle post-visit summaries using FHIR Communication resource
   */
  async createPostVisitSummary(
    sessionId: string,
    patientId: string,
    providerId: string,
    summaryPayload: PostVisitSummaryPayload
  ): Promise<OpenEMROperationResult<FHIRCommunication>> {
    if (!this.config.features?.enablePostVisitSummary) {
      return {
        success: false,
        error: {
          code: 'POST_VISIT_SUMMARY_DISABLED',
          message: 'Post-visit summary is not enabled'
        }
      };
    }

    this.log('Creating post-visit summary communication', { sessionId, patientId });

    try {
      // Format summary content
      const summaryContent = this.formatPostVisitSummary(summaryPayload);

      // Create FHIR Communication resource
      const communication: FHIRCommunication = {
        resourceType: 'Communication',
        id: `post-visit-${sessionId}`,
        identifier: [
          {
            use: 'official',
            system: 'http://webqx.health/post-visit-summaries',
            value: `${sessionId}-summary`
          }
        ],
        status: 'completed',
        category: [TELEHEALTH_COMMUNICATION_CATEGORIES.POST_VISIT_SUMMARY],
        medium: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationMode',
                code: 'WRITTEN',
                display: 'Written'
              }
            ]
          }
        ],
        subject: {
          reference: `Patient/${patientId}`
        },
        encounter: {
          reference: `Encounter/telehealth-${sessionId}`
        },
        sent: new Date().toISOString(),
        recipient: [
          {
            reference: `Patient/${patientId}`
          }
        ],
        sender: {
          reference: `Practitioner/${providerId}`
        },
        payload: [
          {
            contentString: summaryContent
          }
        ]
      };

      // Save to FHIR server
      const fhirResult = await this.fhirService.create(communication);
      
      if (this.config.features?.enableAuditLogging) {
        this.auditLog('post_visit_summary_created', {
          sessionId,
          patientId,
          communicationId: communication.id
        });
      }

      return {
        success: true,
        data: communication
      };

    } catch (error) {
      this.log('Failed to create post-visit summary:', error);
      return {
        success: false,
        error: {
          code: 'POST_VISIT_SUMMARY_FAILED',
          message: error.message
        }
      };
    }
  }

  /**
   * Integrate ambient documentation via Whisper and format as FHIR DocumentReference
   */
  async processAmbientDocumentation(
    sessionId: string,
    patientId: string,
    providerId: string,
    audioFile: File,
    context: Partial<AmbientDocumentationContext> = {}
  ): Promise<OpenEMROperationResult<FHIRDocumentReference>> {
    if (!this.config.features?.enableAmbientDocumentation || !this.whisperService) {
      return {
        success: false,
        error: {
          code: 'AMBIENT_DOCUMENTATION_DISABLED',
          message: 'Ambient documentation is not enabled or Whisper service is not available'
        }
      };
    }

    this.log('Processing ambient documentation', { sessionId, patientId });

    try {
      // Transcribe audio using Whisper
      const transcriptionResult = await this.whisperService.transcribeAudio(audioFile, {
        language: 'en',
        temperature: 0.1, // Lower temperature for medical accuracy
        prompt: 'Medical consultation with patient. Include clinical terms, medications, procedures, and medical history.'
      });

      // Create ambient documentation context
      const ambientContext: AmbientDocumentationContext = {
        sessionId,
        transcriptionEngine: 'whisper',
        audioQuality: 'good', // Could be determined from audio analysis
        speakerIdentification: false,
        speakerCount: 2, // Typically patient and provider
        sessionDuration: 'PT30M', // Could be calculated from audio duration
        processingTimestamp: new Date().toISOString(),
        confidenceMetrics: {
          overallConfidence: transcriptionResult.confidence || 0.85
        },
        postProcessing: {
          phiRedaction: true,
          medicalTermCorrection: true,
          structuralFormatting: true
        },
        ...context
      };

      // Apply post-processing
      const processedContent = this.postProcessAmbientDocumentation(
        transcriptionResult.text,
        ambientContext
      );

      // Create FHIR DocumentReference
      const documentReference: FHIRDocumentReference = {
        resourceType: 'DocumentReference',
        id: `ambient-doc-${sessionId}`,
        identifier: [
          {
            use: 'official',
            system: 'http://webqx.health/ambient-documentation',
            value: `${sessionId}-ambient`
          }
        ],
        status: 'current',
        docStatus: 'preliminary',
        type: CLINICAL_NOTE_TYPES.AMBIENT_DOCUMENTATION,
        category: [
          {
            coding: [
              {
                system: 'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category',
                code: 'clinical-note',
                display: 'Clinical Note'
              }
            ]
          }
        ],
        subject: {
          reference: `Patient/${patientId}`
        },
        date: new Date().toISOString(),
        author: [
          {
            reference: `Practitioner/${providerId}`
          },
          {
            display: 'AI Ambient Documentation System'
          }
        ],
        description: 'AI-generated ambient documentation from telehealth session',
        content: [
          {
            attachment: {
              contentType: 'text/plain',
              data: Buffer.from(processedContent).toString('base64'),
              title: `Ambient Documentation - Session ${sessionId}`,
              creation: new Date().toISOString()
            }
          }
        ],
        context: {
          encounter: [
            {
              reference: `Encounter/telehealth-${sessionId}`
            }
          ],
          period: {
            start: new Date().toISOString()
          }
        }
      };

      // Save to FHIR server
      const fhirResult = await this.fhirService.create(documentReference);
      
      if (this.config.features?.enableAuditLogging) {
        this.auditLog('ambient_documentation_processed', {
          sessionId,
          patientId,
          documentId: documentReference.id,
          transcriptionConfidence: transcriptionResult.confidence
        });
      }

      return {
        success: true,
        data: documentReference
      };

    } catch (error) {
      this.log('Failed to process ambient documentation:', error);
      return {
        success: false,
        error: {
          code: 'AMBIENT_DOCUMENTATION_FAILED',
          message: error.message
        }
      };
    }
  }

  // Private helper methods

  private formatPostVisitSummary(payload: PostVisitSummaryPayload): string {
    let summary = `# Post-Visit Summary\n\n`;
    
    // Visit information
    summary += `## Visit Information\n`;
    summary += `**Date:** ${payload.visitSummary.encounterDate}\n`;
    summary += `**Duration:** ${payload.visitSummary.duration}\n`;
    summary += `**Provider:** ${payload.visitSummary.provider}\n`;
    summary += `**Visit Type:** ${payload.visitSummary.visitType}\n`;
    if (payload.visitSummary.chiefComplaint) {
      summary += `**Chief Complaint:** ${payload.visitSummary.chiefComplaint}\n`;
    }
    summary += `\n`;

    // Clinical summary
    if (payload.clinicalSummary) {
      summary += `## Clinical Summary\n`;
      if (payload.clinicalSummary.assessment.length > 0) {
        summary += `**Assessment:**\n`;
        payload.clinicalSummary.assessment.forEach(item => {
          summary += `- ${item}\n`;
        });
      }
      if (payload.clinicalSummary.treatmentPlan.length > 0) {
        summary += `**Treatment Plan:**\n`;
        payload.clinicalSummary.treatmentPlan.forEach(item => {
          summary += `- ${item}\n`;
        });
      }
      if (payload.clinicalSummary.medications) {
        summary += `**Medications:**\n`;
        payload.clinicalSummary.medications.forEach(med => {
          summary += `- ${med.name} (${med.dosage}) - ${med.instructions}\n`;
        });
      }
      summary += `\n`;
    }

    // Follow-up instructions
    if (payload.followUpInstructions) {
      summary += `## Follow-up Instructions\n`;
      if (payload.followUpInstructions.nextAppointment) {
        summary += `**Next Appointment:** ${payload.followUpInstructions.nextAppointment}\n`;
      }
      if (payload.followUpInstructions.labWork) {
        summary += `**Lab Work Required:**\n`;
        payload.followUpInstructions.labWork.forEach(lab => {
          summary += `- ${lab}\n`;
        });
      }
      if (payload.followUpInstructions.specialInstructions) {
        summary += `**Special Instructions:**\n`;
        payload.followUpInstructions.specialInstructions.forEach(instruction => {
          summary += `- ${instruction}\n`;
        });
      }
      summary += `\n`;
    }

    // Emergency contact
    if (payload.emergencyContact) {
      summary += `## Emergency Contact\n`;
      summary += `**Name:** ${payload.emergencyContact.name}\n`;
      summary += `**Phone:** ${payload.emergencyContact.phone}\n`;
      summary += `**When to Call:**\n`;
      payload.emergencyContact.whenToCall.forEach(reason => {
        summary += `- ${reason}\n`;
      });
      summary += `\n`;
    }

    return summary;
  }

  private postProcessAmbientDocumentation(
    rawText: string,
    context: AmbientDocumentationContext
  ): string {
    let processed = rawText;

    // Apply PHI redaction if enabled
    if (context.postProcessing.phiRedaction) {
      processed = this.redactPHI(processed);
    }

    // Apply medical term correction if enabled
    if (context.postProcessing.medicalTermCorrection) {
      processed = this.correctMedicalTerms(processed);
    }

    // Apply structural formatting if enabled
    if (context.postProcessing.structuralFormatting) {
      processed = this.applyStructuralFormatting(processed);
    }

    return processed;
  }

  private redactPHI(text: string): string {
    // Basic PHI redaction - in production, this would be more sophisticated
    return text
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN_REDACTED]')
      .replace(/\b\d{3}-\d{3}-\d{4}\b/g, '[PHONE_REDACTED]')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]');
  }

  private correctMedicalTerms(text: string): string {
    // Basic medical term correction - in production, this would use a medical dictionary
    return text
      .replace(/\bblood pressure\b/gi, 'blood pressure')
      .replace(/\btemperature\b/gi, 'temperature')
      .replace(/\bheartrate\b/gi, 'heart rate');
  }

  private applyStructuralFormatting(text: string): string {
    // Basic structural formatting - in production, this would be more sophisticated
    let formatted = text;
    
    // Add section headers if not present
    if (!formatted.includes('Chief Complaint:')) {
      formatted = `Chief Complaint:\n${formatted}`;
    }
    
    return formatted;
  }

  private auditLog(action: string, details: any): void {
    if (this.config.features?.enableAuditLogging) {
      this.log(`[AUDIT] ${action}:`, details);
      // In production, this would send to a proper audit logging system
    }
  }

  private log(message: string, ...args: any[]): void {
    console.log(`[Telehealth FHIR Adapter] ${message}`, ...args);
  }
}

export default TelehealthSessionFHIRAdapter;