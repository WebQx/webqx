/**
 * @fileoverview Unit Tests for Whisper-OpenEMR Integration
 * 
 * Comprehensive test suite covering the Whisper-OpenEMR integration service,
 * including clinical transcription, configuration validation, and error handling.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { jest } from '@jest/globals';
import { WhisperOpenEMRIntegration, ClinicalTranscriptionContext } from '../services/whisperIntegration';
import { createConfig, validateConfig } from '../config/whisperConfig';

// Mock dependencies
jest.mock('../../../services/whisperService');
jest.mock('../../../services/whisperStreamingService');
jest.mock('../services/integration');

describe('WhisperOpenEMRIntegration', () => {
  let integration: WhisperOpenEMRIntegration;
  let mockConfig: any;

  beforeEach(() => {
    // Create mock configuration
    mockConfig = createConfig('development', 'general', {
      openemr: {
        baseUrl: 'http://test-openemr.local',
        oauth: {
          clientId: 'test-client',
          clientSecret: 'test-secret',
          redirectUri: 'http://localhost:3000/callback',
          scopes: ['openid', 'patient/Patient.read']
        },
        debug: true
      }
    });

    integration = new WhisperOpenEMRIntegration(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize successfully with valid configuration', async () => {
      const mockOpenEMRIntegration = {
        initialize: jest.fn().mockResolvedValue(undefined)
      };

      (integration as any).openemrService = mockOpenEMRIntegration;

      await expect(integration.initialize()).resolves.not.toThrow();
      expect(mockOpenEMRIntegration.initialize).toHaveBeenCalled();
    });

    test('should throw error when OpenEMR initialization fails', async () => {
      const mockOpenEMRIntegration = {
        initialize: jest.fn().mockRejectedValue(new Error('OpenEMR connection failed'))
      };

      (integration as any).openemrService = mockOpenEMRIntegration;

      await expect(integration.initialize()).rejects.toThrow('OpenEMR connection failed');
    });
  });

  describe('Clinical Audio Transcription', () => {
    let mockAudioFile: File;
    let clinicalContext: ClinicalTranscriptionContext;

    beforeEach(() => {
      mockAudioFile = new File(['audio data'], 'test.wav', { type: 'audio/wav' });
      clinicalContext = {
        patientId: 'patient-123',
        encounterId: 'encounter-456',
        providerId: 'provider-789',
        transcriptionType: 'encounter_note',
        clinicalContext: 'Annual checkup'
      };

      // Mock OpenEMR service
      (integration as any).openemrService = {
        getPatient: jest.fn().mockResolvedValue({
          success: true,
          data: { id: 'patient-123', name: 'John Doe' }
        })
      };

      // Mock Whisper service
      (integration as any).whisperService = {
        transcribeAudio: jest.fn().mockResolvedValue({
          text: 'Patient presents with chief complaint of headache.',
          confidence: 0.95,
          language: 'en',
          duration: 5.2
        })
      };
    });

    test('should successfully transcribe clinical audio', async () => {
      const result = await integration.transcribeClinicalAudio(mockAudioFile, clinicalContext);

      expect(result).toMatchObject({
        text: 'Patient presents with chief complaint of headache.',
        context: clinicalContext,
        whisperResponse: expect.objectContaining({
          text: 'Patient presents with chief complaint of headache.',
          confidence: 0.95
        })
      });

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    test('should throw error when patient not found', async () => {
      (integration as any).openemrService.getPatient.mockResolvedValue({
        success: false,
        error: { message: 'Patient not found' }
      });

      await expect(
        integration.transcribeClinicalAudio(mockAudioFile, clinicalContext)
      ).rejects.toThrow('Patient not found in OpenEMR: patient-123');
    });

    test('should apply PHI protection when enabled', async () => {
      const configWithPHI = {
        ...mockConfig,
        clinical: {
          ...mockConfig.clinical,
          enablePHIProtection: true
        }
      };

      const integrationWithPHI = new WhisperOpenEMRIntegration(configWithPHI);
      (integrationWithPHI as any).openemrService = (integration as any).openemrService;
      (integrationWithPHI as any).whisperService = {
        transcribeAudio: jest.fn().mockResolvedValue({
          text: 'Patient John Doe, SSN 123-45-6789, has headache.',
          confidence: 0.95,
          language: 'en'
        })
      };

      const result = await integrationWithPHI.transcribeClinicalAudio(mockAudioFile, clinicalContext);

      expect(result.text).toContain('[REDACTED]');
      expect(result.phiProtectionApplied).toBe(true);
    });

    test('should use medical vocabulary prompts for different transcription types', async () => {
      const assessmentContext = {
        ...clinicalContext,
        transcriptionType: 'assessment' as const
      };

      await integration.transcribeClinicalAudio(mockAudioFile, assessmentContext);

      expect((integration as any).whisperService.transcribeAudio).toHaveBeenCalledWith(
        mockAudioFile,
        expect.objectContaining({
          prompt: expect.stringContaining('Clinical assessment and diagnosis')
        })
      );
    });

    test('should auto-save to encounter when enabled and encounter ID provided', async () => {
      const configWithAutoSave = {
        ...mockConfig,
        features: {
          ...mockConfig.features,
          autoSaveToEncounter: true
        }
      };

      const integrationWithAutoSave = new WhisperOpenEMRIntegration(configWithAutoSave);
      (integrationWithAutoSave as any).openemrService = (integration as any).openemrService;
      (integrationWithAutoSave as any).whisperService = (integration as any).whisperService;

      const saveToEncounterSpy = jest.spyOn(integrationWithAutoSave, 'saveTranscriptionToEncounter')
        .mockResolvedValue({ success: true });

      const result = await integrationWithAutoSave.transcribeClinicalAudio(mockAudioFile, clinicalContext);

      expect(saveToEncounterSpy).toHaveBeenCalledWith(
        expect.objectContaining({ text: expect.any(String) }),
        'encounter-456'
      );
      expect(result.savedToEncounterId).toBe('encounter-456');
    });
  });

  describe('Streaming Transcription', () => {
    let clinicalContext: ClinicalTranscriptionContext;
    let mockCallbacks: any;

    beforeEach(() => {
      clinicalContext = {
        patientId: 'patient-123',
        providerId: 'provider-789',
        transcriptionType: 'encounter_note'
      };

      mockCallbacks = {
        onTranscription: jest.fn(),
        onError: jest.fn(),
        onStateChange: jest.fn()
      };

      // Mock services
      (integration as any).openemrService = {
        getPatient: jest.fn().mockResolvedValue({
          success: true,
          data: { id: 'patient-123' }
        })
      };

      (integration as any).streamingService = {
        startTranscription: jest.fn().mockResolvedValue(undefined),
        stopTranscription: jest.fn().mockResolvedValue(undefined),
        onFinalResult: null,
        onError: null
      };
    });

    test('should start streaming transcription successfully', async () => {
      await integration.startStreamingTranscription(clinicalContext, mockCallbacks);

      expect((integration as any).streamingService.startTranscription).toHaveBeenCalled();
      expect(mockCallbacks.onStateChange).toHaveBeenCalledWith(true);
    });

    test('should stop streaming transcription', async () => {
      await integration.stopStreamingTranscription();

      expect((integration as any).streamingService.stopTranscription).toHaveBeenCalled();
    });

    test('should handle streaming errors gracefully', async () => {
      const streamError = new Error('Streaming failed');
      (integration as any).streamingService.startTranscription.mockRejectedValue(streamError);

      await integration.startStreamingTranscription(clinicalContext, mockCallbacks);

      expect(mockCallbacks.onError).toHaveBeenCalledWith(streamError);
    });

    test('should throw error when streaming is not enabled', async () => {
      const configWithoutStreaming = {
        ...mockConfig,
        features: {
          ...mockConfig.features,
          enableStreaming: false
        }
      };

      const integrationWithoutStreaming = new WhisperOpenEMRIntegration(configWithoutStreaming);

      await expect(
        integrationWithoutStreaming.startStreamingTranscription(clinicalContext, mockCallbacks)
      ).rejects.toThrow('Streaming transcription is not enabled');
    });
  });

  describe('Encounter Note Management', () => {
    test('should save transcription to encounter note', async () => {
      const mockTranscription = {
        text: 'Clinical assessment complete.',
        whisperResponse: { text: 'Clinical assessment complete.', confidence: 0.9, language: 'en' },
        context: {
          patientId: 'patient-123',
          encounterId: 'encounter-456',
          providerId: 'provider-789',
          transcriptionType: 'assessment' as const
        },
        timestamp: new Date()
      };

      const saveEncounterNoteSpy = jest.spyOn(integration as any, 'saveEncounterNote')
        .mockResolvedValue({ success: true });

      const result = await integration.saveTranscriptionToEncounter(mockTranscription, 'encounter-456');

      expect(result.success).toBe(true);
      expect(saveEncounterNoteSpy).toHaveBeenCalledWith(
        'encounter-456',
        expect.stringContaining('Clinical assessment complete.'),
        'assessment'
      );
    });

    test('should format clinical notes properly', async () => {
      const mockTranscription = {
        text: 'Patient reports improvement.',
        whisperResponse: { text: 'Patient reports improvement.', confidence: 0.85, language: 'en' },
        context: {
          patientId: 'patient-123',
          providerId: 'provider-789',
          transcriptionType: 'plan' as const
        },
        timestamp: new Date('2024-01-15T10:30:00Z')
      };

      const formattedNote = (integration as any).formatClinicalNote(mockTranscription);

      expect(formattedNote).toContain('[PLAN - Voice Transcription - 2024-01-15T10:30:00.000Z]');
      expect(formattedNote).toContain('Patient reports improvement.');
    });
  });

  describe('PHI Protection', () => {
    test('should identify and redact SSN patterns', () => {
      const textWithSSN = 'Patient SSN is 123-45-6789 and lives at home.';
      const { text: protectedText, applied } = (integration as any).applyPHIProtection(textWithSSN);

      expect(protectedText).toContain('[REDACTED]');
      expect(protectedText).not.toContain('123-45-6789');
      expect(applied).toBe(true);
    });

    test('should identify and redact email addresses', () => {
      const textWithEmail = 'Contact patient at john.doe@email.com for follow-up.';
      const { text: protectedText, applied } = (integration as any).applyPHIProtection(textWithEmail);

      expect(protectedText).toContain('[REDACTED]');
      expect(protectedText).not.toContain('john.doe@email.com');
      expect(applied).toBe(true);
    });

    test('should not modify text without PHI', () => {
      const cleanText = 'Patient presents with headache and fever.';
      const { text: protectedText, applied } = (integration as any).applyPHIProtection(cleanText);

      expect(protectedText).toBe(cleanText);
      expect(applied).toBe(false);
    });
  });

  describe('Medical Vocabulary', () => {
    test('should return correct prompt for encounter notes', () => {
      const prompt = (integration as any).getMedicalVocabularyPrompt('encounter_note');
      expect(prompt).toContain('Clinical encounter note');
      expect(prompt).toContain('assessment');
      expect(prompt).toContain('plan');
    });

    test('should return correct prompt for medication notes', () => {
      const prompt = (integration as any).getMedicalVocabularyPrompt('medication_note');
      expect(prompt).toContain('Medication administration');
      expect(prompt).toContain('dosages');
      expect(prompt).toContain('drug interactions');
    });

    test('should return general prompt for unknown type', () => {
      const prompt = (integration as any).getMedicalVocabularyPrompt('unknown_type');
      expect(prompt).toContain('General medical documentation');
    });
  });
});

describe('Configuration Management', () => {
  describe('Configuration Creation', () => {
    test('should create development configuration', () => {
      const config = createConfig('development');
      
      expect(config.openemr.debug).toBe(true);
      expect(config.openemr.security?.verifySSL).toBe(false);
      expect(config.features?.enableAuditLogging).toBe(true);
    });

    test('should create production configuration', () => {
      const config = createConfig('production');
      
      expect(config.openemr.debug).toBe(false);
      expect(config.openemr.security?.verifySSL).toBe(true);
      expect(config.openemr.security?.timeout).toBe(45000);
    });

    test('should apply multilingual use case modifications', () => {
      const config = createConfig('development', 'multilingual');
      
      expect(config.clinical?.defaultLanguage).toBe('auto');
      expect(config.clinical?.medicalTemperature).toBe(0.2);
    });

    test('should apply emergency use case modifications', () => {
      const config = createConfig('production', 'emergency');
      
      expect(config.whisper?.timeout).toBe(30000);
      expect(config.openemr.security?.timeout).toBe(20000);
      expect(config.openemr.features?.syncInterval).toBe(5);
    });

    test('should apply custom overrides', () => {
      const customOverrides = {
        whisper: {
          maxFileSize: 100 * 1024 * 1024 // 100MB
        },
        clinical: {
          medicalTemperature: 0.3
        }
      };

      const config = createConfig('development', 'general', customOverrides);
      
      expect(config.whisper?.maxFileSize).toBe(100 * 1024 * 1024);
      expect(config.clinical?.medicalTemperature).toBe(0.3);
    });
  });

  describe('Configuration Validation', () => {
    test('should validate valid configuration', () => {
      const validConfig = createConfig('development');
      const validation = validateConfig(validConfig);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect missing OpenEMR base URL', () => {
      const invalidConfig = createConfig('development');
      delete (invalidConfig.openemr as any).baseUrl;
      
      const validation = validateConfig(invalidConfig);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('OpenEMR base URL is required');
    });

    test('should detect missing OAuth configuration', () => {
      const invalidConfig = createConfig('development');
      delete (invalidConfig.openemr.oauth as any).clientId;
      delete (invalidConfig.openemr.oauth as any).clientSecret;
      
      const validation = validateConfig(invalidConfig);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('OpenEMR OAuth client ID is required');
      expect(validation.errors).toContain('OpenEMR OAuth client secret is required');
    });

    test('should detect invalid medical temperature', () => {
      const invalidConfig = createConfig('development');
      invalidConfig.clinical!.medicalTemperature = 1.5; // Invalid: > 1
      
      const validation = validateConfig(invalidConfig);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Medical temperature should be between 0 and 1');
    });

    test('should detect invalid timeout values', () => {
      const invalidConfig = createConfig('development');
      invalidConfig.whisper!.timeout = 1000; // Invalid: < 5000
      
      const validation = validateConfig(invalidConfig);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Whisper timeout should be at least 5 seconds');
    });

    test('should detect invalid file size', () => {
      const invalidConfig = createConfig('development');
      invalidConfig.whisper!.maxFileSize = 500 * 1024; // Invalid: < 1MB
      
      const validation = validateConfig(invalidConfig);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Whisper max file size should be at least 1MB');
    });
  });
});

describe('Error Handling', () => {
  test('should handle network errors gracefully', async () => {
    const integration = new WhisperOpenEMRIntegration(createConfig('development'));
    
    (integration as any).openemrService = {
      getPatient: jest.fn().mockRejectedValue(new Error('Network error'))
    };

    const mockFile = new File(['audio'], 'test.wav', { type: 'audio/wav' });
    const context = {
      patientId: 'patient-123',
      providerId: 'provider-789',
      transcriptionType: 'encounter_note' as const
    };

    await expect(
      integration.transcribeClinicalAudio(mockFile, context)
    ).rejects.toThrow('Network error');
  });

  test('should handle Whisper API errors', async () => {
    const integration = new WhisperOpenEMRIntegration(createConfig('development'));
    
    (integration as any).openemrService = {
      getPatient: jest.fn().mockResolvedValue({ success: true, data: {} })
    };
    
    (integration as any).whisperService = {
      transcribeAudio: jest.fn().mockRejectedValue(new Error('Whisper API error'))
    };

    const mockFile = new File(['audio'], 'test.wav', { type: 'audio/wav' });
    const context = {
      patientId: 'patient-123',
      providerId: 'provider-789',
      transcriptionType: 'encounter_note' as const
    };

    await expect(
      integration.transcribeClinicalAudio(mockFile, context)
    ).rejects.toThrow('Whisper API error');
  });
});

describe('Audit Logging', () => {
  test('should log transcription events when audit logging is enabled', async () => {
    const configWithAudit = createConfig('development', 'general', {
      features: { enableAuditLogging: true }
    });
    
    const integration = new WhisperOpenEMRIntegration(configWithAudit);
    const auditLogSpy = jest.spyOn(integration as any, 'auditLog');
    
    (integration as any).openemrService = {
      getPatient: jest.fn().mockResolvedValue({ success: true, data: {} })
    };
    
    (integration as any).whisperService = {
      transcribeAudio: jest.fn().mockResolvedValue({
        text: 'Test transcription',
        confidence: 0.9,
        language: 'en'
      })
    };

    const mockFile = new File(['audio'], 'test.wav', { type: 'audio/wav' });
    const context = {
      patientId: 'patient-123',
      providerId: 'provider-789',
      transcriptionType: 'encounter_note' as const
    };

    await integration.transcribeClinicalAudio(mockFile, context);

    expect(auditLogSpy).toHaveBeenCalledWith(
      'clinical_transcription_completed',
      expect.objectContaining({
        patientId: 'patient-123',
        transcriptionType: 'encounter_note'
      })
    );
  });
});

export {};