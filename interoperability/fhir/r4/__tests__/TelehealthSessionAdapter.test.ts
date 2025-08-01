/**
 * @fileoverview Tests for Telehealth Session FHIR Adapter
 * 
 * Comprehensive tests for the telehealth session adapter covering
 * all FHIR resource mappings and integrations.
 */

import { 
  TelehealthSessionFHIRAdapter,
  TelehealthAdapterConfig,
  TelehealthSessionMetadata,
  TelehealthPatientConsent
} from '../adapters/TelehealthSessionAdapter';
import { PostVisitSummaryPayload } from '../resources/Communication';
import { WhisperService } from '../../../../services/whisperService';
import { OpenEMRIntegration } from '../../../../ehr-integrations/openemr/services/integration';
import { FHIRR4Service } from '../services/FHIRR4Service';

// Mock dependencies
jest.mock('../../../../services/whisperService');
jest.mock('../../../../ehr-integrations/openemr/services/integration');
jest.mock('../services/FHIRR4Service');

const MockedWhisperService = WhisperService as jest.MockedClass<typeof WhisperService>;
const MockedOpenEMRIntegration = OpenEMRIntegration as jest.MockedClass<typeof OpenEMRIntegration>;
const MockedFHIRR4Service = FHIRR4Service as jest.MockedClass<typeof FHIRR4Service>;

describe('TelehealthSessionFHIRAdapter', () => {
  let adapter: TelehealthSessionFHIRAdapter;
  let mockConfig: TelehealthAdapterConfig;
  let mockOpenEMRService: jest.Mocked<OpenEMRIntegration>;
  let mockFHIRService: jest.Mocked<FHIRR4Service>;
  let mockWhisperService: jest.Mocked<WhisperService>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock configuration
    mockConfig = {
      openemr: {
        baseUrl: 'https://test-openemr.webqx.health',
        apiVersion: '7.0.2',
        oauth: {
          clientId: 'test-client',
          clientSecret: 'test-secret',
          redirectUri: 'https://test.webqx.health/callback',
          scopes: ['openid', 'fhirUser']
        },
        fhir: {
          enabled: true,
          baseUrl: 'https://test-openemr.webqx.health/apis/default/fhir'
        },
        security: {
          verifySSL: true,
          timeout: 30000
        },
        features: {
          enableAudit: true,
          enableSync: true,
          syncInterval: 15
        }
      },
      fhir: {
        baseUrl: 'https://test-fhir.webqx.health',
        timeout: 30000,
        authentication: {
          type: 'bearer',
          token: 'test-token'
        }
      },
      whisper: {
        timeout: 60000,
        maxFileSize: 25 * 1024 * 1024,
        enableAmbientCapture: true
      },
      features: {
        enableConsentManagement: true,
        enableAmbientDocumentation: true,
        enablePostVisitSummary: true,
        enableAuditLogging: true
      }
    };

    // Mock service instances
    mockOpenEMRService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getPatient: jest.fn().mockResolvedValue({
        success: true,
        data: {
          id: 'patient-123',
          name: 'John Doe',
          birthDate: '1990-01-01'
        }
      })
    } as any;

    mockFHIRService = {
      create: jest.fn().mockResolvedValue({
        status: 201,
        data: { id: 'created-resource-id' }
      })
    } as any;

    mockWhisperService = {
      transcribeAudio: jest.fn().mockResolvedValue({
        text: 'Patient presents with chest pain. Physical examination reveals normal heart sounds.',
        confidence: 0.92,
        language: 'en'
      })
    } as any;

    // Mock constructors
    MockedOpenEMRIntegration.mockImplementation(() => mockOpenEMRService);
    MockedFHIRR4Service.mockImplementation(() => mockFHIRService);
    MockedWhisperService.mockImplementation(() => mockWhisperService);

    // Create adapter instance
    adapter = new TelehealthSessionFHIRAdapter(mockConfig);
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await expect(adapter.initialize()).resolves.not.toThrow();
      expect(mockOpenEMRService.initialize).toHaveBeenCalledTimes(1);
    });

    it('should create services with correct configurations', () => {
      expect(MockedOpenEMRIntegration).toHaveBeenCalledWith(mockConfig.openemr);
      expect(MockedFHIRR4Service).toHaveBeenCalledWith(mockConfig.fhir);
      expect(MockedWhisperService).toHaveBeenCalledWith(mockConfig.whisper);
    });
  });

  describe('Session to Encounter Mapping', () => {
    let mockSessionMetadata: TelehealthSessionMetadata;

    beforeEach(() => {
      mockSessionMetadata = {
        sessionId: 'session-123',
        patientId: 'patient-123',
        providerId: 'provider-456',
        sessionType: 'video',
        scheduledStart: '2024-01-15T10:00:00Z',
        scheduledEnd: '2024-01-15T10:30:00Z',
        actualStart: '2024-01-15T10:02:00Z',
        actualEnd: '2024-01-15T10:28:00Z',
        status: 'finished',
        technicalContext: {
          sessionId: 'session-123',
          platformType: 'video',
          connectionQuality: 'good',
          technicalIssues: [],
          recordingConsent: true,
          sessionRecordingId: 'recording-789'
        },
        appointmentId: 'appointment-456',
        reasonForVisit: 'Routine checkup'
      };
    });

    it('should successfully map session metadata to FHIR Encounter', async () => {
      const result = await adapter.mapSessionToEncounter(mockSessionMetadata);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.resourceType).toBe('Encounter');
      expect(result.data?.id).toBe('telehealth-session-123');
      expect(result.data?.status).toBe('finished');
      expect(result.data?.class.code).toBe('VR'); // Virtual encounter
      expect(result.data?.subject?.reference).toBe('Patient/patient-123');
      expect(mockOpenEMRService.getPatient).toHaveBeenCalledWith('patient-123');
      expect(mockFHIRService.create).toHaveBeenCalledTimes(1);
    });

    it('should handle patient not found error', async () => {
      mockOpenEMRService.getPatient.mockResolvedValue({
        success: false,
        error: { code: 'PATIENT_NOT_FOUND', message: 'Patient not found' }
      });

      const result = await adapter.mapSessionToEncounter(mockSessionMetadata);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ENCOUNTER_MAPPING_FAILED');
      expect(mockFHIRService.create).not.toHaveBeenCalled();
    });

    it('should include telehealth-specific encounter details', async () => {
      await adapter.mapSessionToEncounter(mockSessionMetadata);

      const createCall = mockFHIRService.create.mock.calls[0][0];
      expect(createCall.type?.[0]?.coding?.[0]?.code).toBe('448337001'); // Telemedicine consultation
      expect(createCall.location?.[0]?.physicalType?.coding?.[0]?.code).toBe('ve'); // Virtual
    });
  });

  describe('Patient Consent Mapping', () => {
    let mockPatientConsent: TelehealthPatientConsent;

    beforeEach(() => {
      mockPatientConsent = {
        patientId: 'patient-123',
        consentTimestamp: '2024-01-15T09:55:00Z',
        consentContext: {
          sessionType: 'video',
          recordingConsent: true,
          dataSharing: {
            allowProviderAccess: true,
            allowEmergencyAccess: true,
            allowResearchUse: false
          },
          communicationPreferences: {
            preferredContactMethod: 'email'
          },
          technicalConsent: {
            platformAgreement: true,
            dataTransmissionConsent: true,
            deviceDataCollection: true
          }
        },
        consentMethod: 'digital-signature',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      };
    });

    it('should successfully map patient consent to FHIR Consent', async () => {
      const result = await adapter.mapPatientConsentToFHIR(mockPatientConsent);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.resourceType).toBe('Consent');
      expect(result.data?.status).toBe('active');
      expect(result.data?.patient?.reference).toBe('Patient/patient-123');
      expect(result.data?.verification?.[0]?.verified).toBe(true);
      expect(mockFHIRService.create).toHaveBeenCalledTimes(1);
    });

    it('should handle disabled consent management', async () => {
      const configWithoutConsent = {
        ...mockConfig,
        features: { ...mockConfig.features, enableConsentManagement: false }
      };
      const adapterWithoutConsent = new TelehealthSessionFHIRAdapter(configWithoutConsent);

      const result = await adapterWithoutConsent.mapPatientConsentToFHIR(mockPatientConsent);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONSENT_MANAGEMENT_DISABLED');
      expect(mockFHIRService.create).not.toHaveBeenCalled();
    });

    it('should include recording consent in categories when enabled', async () => {
      await adapter.mapPatientConsentToFHIR(mockPatientConsent);

      const createCall = mockFHIRService.create.mock.calls[0][0];
      const categories = createCall.category?.map((cat: any) => cat.code || cat.coding?.[0]?.code);
      expect(categories).toContain('research'); // Recording consent category
    });
  });

  describe('Post-Visit Summary Creation', () => {
    let mockSummaryPayload: PostVisitSummaryPayload;

    beforeEach(() => {
      mockSummaryPayload = {
        visitSummary: {
          encounterDate: '2024-01-15',
          duration: '30 minutes',
          provider: 'Dr. Jane Smith',
          visitType: 'Telehealth Consultation',
          chiefComplaint: 'Routine checkup'
        },
        clinicalSummary: {
          assessment: ['Patient appears healthy', 'Vital signs normal'],
          treatmentPlan: ['Continue current medications', 'Follow up in 6 months'],
          medications: [
            {
              name: 'Lisinopril',
              dosage: '10mg',
              instructions: 'Take once daily with food'
            }
          ]
        },
        followUpInstructions: {
          nextAppointment: '2024-07-15',
          labWork: ['Annual blood work'],
          specialInstructions: ['Monitor blood pressure weekly']
        },
        emergencyContact: {
          name: 'Emergency Department',
          phone: '911',
          whenToCall: ['Chest pain', 'Difficulty breathing', 'Severe allergic reaction']
        }
      };
    });

    it('should successfully create post-visit summary communication', async () => {
      const result = await adapter.createPostVisitSummary(
        'session-123',
        'patient-123',
        'provider-456',
        mockSummaryPayload
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.resourceType).toBe('Communication');
      expect(result.data?.status).toBe('completed');
      expect(result.data?.subject?.reference).toBe('Patient/patient-123');
      expect(result.data?.encounter?.reference).toBe('Encounter/telehealth-session-123');
      expect(mockFHIRService.create).toHaveBeenCalledTimes(1);
    });

    it('should handle disabled post-visit summary', async () => {
      const configWithoutSummary = {
        ...mockConfig,
        features: { ...mockConfig.features, enablePostVisitSummary: false }
      };
      const adapterWithoutSummary = new TelehealthSessionFHIRAdapter(configWithoutSummary);

      const result = await adapterWithoutSummary.createPostVisitSummary(
        'session-123',
        'patient-123',
        'provider-456',
        mockSummaryPayload
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('POST_VISIT_SUMMARY_DISABLED');
    });

    it('should format summary content properly', async () => {
      await adapter.createPostVisitSummary(
        'session-123',
        'patient-123',
        'provider-456',
        mockSummaryPayload
      );

      const createCall = mockFHIRService.create.mock.calls[0][0];
      const summaryContent = createCall.payload?.[0]?.contentString;
      expect(summaryContent).toContain('# Post-Visit Summary');
      expect(summaryContent).toContain('Dr. Jane Smith');
      expect(summaryContent).toContain('Lisinopril');
      expect(summaryContent).toContain('Annual blood work');
    });
  });

  describe('Ambient Documentation Processing', () => {
    let mockAudioFile: File;

    beforeEach(() => {
      // Create a mock File object
      const audioBlob = new Blob(['fake audio data'], { type: 'audio/wav' });
      mockAudioFile = new File([audioBlob], 'session-audio.wav', { type: 'audio/wav' });
    });

    it('should successfully process ambient documentation', async () => {
      const result = await adapter.processAmbientDocumentation(
        'session-123',
        'patient-123',
        'provider-456',
        mockAudioFile
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.resourceType).toBe('DocumentReference');
      expect(result.data?.subject?.reference).toBe('Patient/patient-123');
      expect(result.data?.context?.encounter?.[0]?.reference).toBe('Encounter/telehealth-session-123');
      expect(mockWhisperService.transcribeAudio).toHaveBeenCalledWith(
        mockAudioFile,
        expect.objectContaining({
          language: 'en',
          temperature: 0.1
        })
      );
      expect(mockFHIRService.create).toHaveBeenCalledTimes(1);
    });

    it('should handle disabled ambient documentation', async () => {
      const configWithoutAmbient = {
        ...mockConfig,
        features: { ...mockConfig.features, enableAmbientDocumentation: false }
      };
      const adapterWithoutAmbient = new TelehealthSessionFHIRAdapter(configWithoutAmbient);

      const result = await adapterWithoutAmbient.processAmbientDocumentation(
        'session-123',
        'patient-123',
        'provider-456',
        mockAudioFile
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AMBIENT_DOCUMENTATION_DISABLED');
    });

    it('should apply post-processing to transcription', async () => {
      // Mock transcription with PHI
      mockWhisperService.transcribeAudio.mockResolvedValue({
        text: 'Patient John Doe, SSN 123-45-6789, reports chest pain. Phone: 555-123-4567.',
        confidence: 0.88,
        language: 'en'
      });

      await adapter.processAmbientDocumentation(
        'session-123',
        'patient-123',
        'provider-456',
        mockAudioFile
      );

      const createCall = mockFHIRService.create.mock.calls[0][0];
      const documentContent = Buffer.from(createCall.content[0].attachment.data, 'base64').toString();
      
      // Check that PHI has been redacted
      expect(documentContent).toContain('[SSN_REDACTED]');
      expect(documentContent).toContain('[PHONE_REDACTED]');
      expect(documentContent).not.toContain('123-45-6789');
      expect(documentContent).not.toContain('555-123-4567');
    });

    it('should handle Whisper transcription errors', async () => {
      mockWhisperService.transcribeAudio.mockRejectedValue(new Error('Transcription failed'));

      const result = await adapter.processAmbientDocumentation(
        'session-123',
        'patient-123',
        'provider-456',
        mockAudioFile
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AMBIENT_DOCUMENTATION_FAILED');
    });
  });

  describe('Error Handling', () => {
    it('should handle FHIR service errors gracefully', async () => {
      mockFHIRService.create.mockRejectedValue(new Error('FHIR server unavailable'));

      const sessionMetadata: TelehealthSessionMetadata = {
        sessionId: 'session-123',
        patientId: 'patient-123',
        providerId: 'provider-456',
        sessionType: 'video',
        scheduledStart: '2024-01-15T10:00:00Z',
        scheduledEnd: '2024-01-15T10:30:00Z',
        status: 'finished',
        technicalContext: {
          sessionId: 'session-123',
          platformType: 'video',
          connectionQuality: 'good',
          technicalIssues: [],
          recordingConsent: true
        }
      };

      const result = await adapter.mapSessionToEncounter(sessionMetadata);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ENCOUNTER_MAPPING_FAILED');
      expect(result.error?.message).toContain('FHIR server unavailable');
    });

    it('should handle OpenEMR service errors gracefully', async () => {
      mockOpenEMRService.initialize.mockRejectedValue(new Error('OpenEMR connection failed'));

      await expect(adapter.initialize()).rejects.toThrow('OpenEMR connection failed');
    });
  });

  describe('Audit Logging', () => {
    it('should log audit events when enabled', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const sessionMetadata: TelehealthSessionMetadata = {
        sessionId: 'session-123',
        patientId: 'patient-123',
        providerId: 'provider-456',
        sessionType: 'video',
        scheduledStart: '2024-01-15T10:00:00Z',
        scheduledEnd: '2024-01-15T10:30:00Z',
        status: 'finished',
        technicalContext: {
          sessionId: 'session-123',
          platformType: 'video',
          connectionQuality: 'good',
          technicalIssues: [],
          recordingConsent: true
        }
      };

      await adapter.mapSessionToEncounter(sessionMetadata);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AUDIT] encounter_mapped'),
        expect.objectContaining({
          sessionId: 'session-123',
          patientId: 'patient-123'
        })
      );

      consoleSpy.mockRestore();
    });

    it('should not log audit events when disabled', async () => {
      const configWithoutAudit = {
        ...mockConfig,
        features: { ...mockConfig.features, enableAuditLogging: false }
      };
      const adapterWithoutAudit = new TelehealthSessionFHIRAdapter(configWithoutAudit);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const sessionMetadata: TelehealthSessionMetadata = {
        sessionId: 'session-123',
        patientId: 'patient-123',
        providerId: 'provider-456',
        sessionType: 'video',
        scheduledStart: '2024-01-15T10:00:00Z',
        scheduledEnd: '2024-01-15T10:30:00Z',
        status: 'finished',
        technicalContext: {
          sessionId: 'session-123',
          platformType: 'video',
          connectionQuality: 'good',
          technicalIssues: [],
          recordingConsent: true
        }
      };

      await adapterWithoutAudit.mapSessionToEncounter(sessionMetadata);

      const auditCalls = consoleSpy.mock.calls.filter(call => 
        call[0]?.includes('[AUDIT]')
      );
      expect(auditCalls).toHaveLength(0);

      consoleSpy.mockRestore();
    });
  });
});