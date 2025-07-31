/**
 * @fileoverview Tests for WhisperOttehrIntegration service
 */

import { WhisperOttehrIntegration, WhisperOttehrConfig, AudioTranscriptionRequest } from '../whisperOttehrIntegration';

// Mock the dependent services
jest.mock('../whisperService');
jest.mock('../ottehrService');

// Import mocked constructors
import { WhisperService } from '../whisperService';
import { OttehrService } from '../ottehrService';

const MockedWhisperService = WhisperService as jest.MockedClass<typeof WhisperService>;
const MockedOttehrService = OttehrService as jest.MockedClass<typeof OttehrService>;

describe('WhisperOttehrIntegration', () => {
  let integration: WhisperOttehrIntegration;
  let mockWhisperService: jest.Mocked<WhisperService>;
  let mockOttehrService: jest.Mocked<OttehrService>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockWhisperService = {
      validateFile: jest.fn(),
      transcribeAudio: jest.fn(),
      onLoadingStateChange: jest.fn(),
      updateConfig: jest.fn(),
      getConfig: jest.fn(),
      getLoadingState: jest.fn()
    } as any;

    mockOttehrService = {
      authenticate: jest.fn(),
      createOrder: jest.fn(),
      sendNotification: jest.fn(),
      getHealthStatus: jest.fn(),
      updateConfig: jest.fn(),
      getConfig: jest.fn(),
      destroy: jest.fn(),
      on: jest.fn(),
      removeAllListeners: jest.fn()
    } as any;

    // Mock constructors to return our mock instances
    MockedWhisperService.mockImplementation(() => mockWhisperService);
    MockedOttehrService.mockImplementation(() => mockOttehrService);

    // Create integration instance
    integration = new WhisperOttehrIntegration({
      whisper: {
        apiUrl: 'https://api.openai.com/v1/audio/transcriptions',
        timeout: 30000
      },
      ottehr: {
        apiBaseUrl: 'https://api.ottehr.com',
        apiKey: 'test-api-key'
      },
      integration: {
        autoTranscribe: true,
        medicalSpecialty: 'cardiology'
      }
    });
  });

  afterEach(() => {
    integration.destroy();
  });

  describe('Initialization', () => {
    it('should create integration with default configuration', () => {
      const defaultIntegration = new WhisperOttehrIntegration();
      expect(defaultIntegration).toBeInstanceOf(WhisperOttehrIntegration);
      defaultIntegration.destroy();
    });

    it('should initialize services with provided configuration', () => {
      expect(MockedWhisperService).toHaveBeenCalledWith({
        apiUrl: 'https://api.openai.com/v1/audio/transcriptions',
        timeout: 30000,
        maxFileSize: 25 * 1024 * 1024,
        allowedFileTypes: expect.any(Array)
      });

      expect(MockedOttehrService).toHaveBeenCalledWith({
        apiBaseUrl: 'https://api.ottehr.com',
        apiKey: 'test-api-key',
        clientId: '',
        clientSecret: '',
        environment: 'sandbox',
        webhookSecret: '',
        timeout: 30000,
        enableNotifications: true,
        enableOrdering: true,
        enablePOSIntegration: true,
        enableDeliveryTracking: true
      });
    });

    it('should set up event forwarding from services', () => {
      expect(mockOttehrService.on).toHaveBeenCalledWith('orderCreated', expect.any(Function));
      expect(mockOttehrService.on).toHaveBeenCalledWith('notificationSent', expect.any(Function));
      expect(mockOttehrService.on).toHaveBeenCalledWith('authenticated', expect.any(Function));
      expect(mockWhisperService.onLoadingStateChange).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('Configuration Validation', () => {
    it('should validate valid configuration', () => {
      const result = integration.validateConfiguration();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing Whisper API URL', () => {
      const invalidIntegration = new WhisperOttehrIntegration({
        whisper: { apiUrl: '' },
        ottehr: { apiKey: 'test-key' }
      });

      const result = invalidIntegration.validateConfiguration();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Whisper API URL is required');
      invalidIntegration.destroy();
    });

    it('should detect missing Ottehr credentials', () => {
      const invalidIntegration = new WhisperOttehrIntegration({
        whisper: { apiUrl: 'https://api.openai.com/v1/audio/transcriptions' },
        ottehr: { apiKey: '', clientId: '', clientSecret: '' }
      });

      const result = invalidIntegration.validateConfiguration();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Either Ottehr API key or OAuth client credentials are required');
      invalidIntegration.destroy();
    });
  });

  describe('Healthcare Transcription', () => {
    const mockAudioFile = new File(['mock audio data'], 'test.wav', { type: 'audio/wav' });
    
    beforeEach(() => {
      mockWhisperService.validateFile.mockReturnValue({ isValid: true });
      mockWhisperService.transcribeAudio.mockResolvedValue({
        text: 'The patient is experiencing chest pain and shortness of breath.',
        language: 'en',
        confidence: 0.95,
        duration: 5.2
      });
      mockOttehrService.sendNotification.mockResolvedValue({
        success: true,
        data: { id: 'notification-123' }
      });
    });

    it('should transcribe audio with healthcare context', async () => {
      const request: AudioTranscriptionRequest = {
        audioFile: mockAudioFile,
        patientId: 'patient-123',
        encounterType: 'consultation',
        specialty: 'cardiology'
      };

      const result = await integration.transcribeWithHealthcareContext(request);

      expect(mockWhisperService.validateFile).toHaveBeenCalledWith(mockAudioFile);
      expect(mockWhisperService.transcribeAudio).toHaveBeenCalledWith(
        mockAudioFile,
        {
          prompt: expect.stringContaining('cardiovascular terms'),
          temperature: 0.1,
          language: 'auto'
        }
      );

      expect(result.text).toBe('The patient is experiencing chest pain and shortness of breath.');
      expect(result.specialty).toBe('cardiology');
      expect(result.medicalTerms).toEqual(expect.arrayContaining(['chest pain', 'shortness of breath']));
      expect(result.patientContext).toEqual({
        patientId: 'patient-123',
        encounterType: 'consultation',
        timestamp: expect.any(String)
      });
    });

    it('should handle audio file validation errors', async () => {
      mockWhisperService.validateFile.mockReturnValue({
        isValid: false,
        error: 'File too large'
      });

      const request: AudioTranscriptionRequest = {
        audioFile: mockAudioFile
      };

      await expect(integration.transcribeWithHealthcareContext(request))
        .rejects.toThrow('Audio file validation failed: File too large');
    });

    it('should generate medical prompts for different specialties', async () => {
      const request: AudioTranscriptionRequest = {
        audioFile: mockAudioFile,
        specialty: 'pharmacy'
      };

      await integration.transcribeWithHealthcareContext(request);

      expect(mockWhisperService.transcribeAudio).toHaveBeenCalledWith(
        mockAudioFile,
        {
          prompt: expect.stringContaining('medications, dosages, drug interactions'),
          temperature: 0.1,
          language: 'auto'
        }
      );
    });

    it('should use custom prompt when provided', async () => {
      const customPrompt = 'Emergency medical consultation with trauma terminology';
      const request: AudioTranscriptionRequest = {
        audioFile: mockAudioFile,
        customPrompt
      };

      await integration.transcribeWithHealthcareContext(request);

      expect(mockWhisperService.transcribeAudio).toHaveBeenCalledWith(
        mockAudioFile,
        {
          prompt: customPrompt,
          temperature: 0.1,
          language: 'auto'
        }
      );
    });

    it('should extract medical terms from transcription', async () => {
      mockWhisperService.transcribeAudio.mockResolvedValue({
        text: 'Patient has hypertension, diabetes, and allergic reaction to medication.',
        language: 'en',
        confidence: 0.92
      });

      const request: AudioTranscriptionRequest = {
        audioFile: mockAudioFile
      };

      const result = await integration.transcribeWithHealthcareContext(request);

      expect(result.medicalTerms).toEqual(
        expect.arrayContaining(['hypertension', 'diabetes', 'allergic reaction', 'medication'])
      );
      expect(result.medicalConfidence).toBeGreaterThan(0.5);
    });

    it('should send notification when enabled and patient ID provided', async () => {
      const request: AudioTranscriptionRequest = {
        audioFile: mockAudioFile,
        patientId: 'patient-123'
      };

      await integration.transcribeWithHealthcareContext(request);

      expect(mockOttehrService.sendNotification).toHaveBeenCalledWith({
        type: 'system_alert',
        recipientId: 'patient-123',
        title: 'Audio Transcription Completed',
        message: expect.stringContaining('Audio transcription completed'),
        data: expect.objectContaining({
          transcriptionId: expect.any(String),
          textLength: expect.any(Number),
          medicalTermsCount: expect.any(Number)
        }),
        channels: ['in_app']
      });
    });

    it('should not send notification when disabled', async () => {
      const noNotificationIntegration = new WhisperOttehrIntegration({
        integration: { enableNotifications: false }
      });

      const request: AudioTranscriptionRequest = {
        audioFile: mockAudioFile,
        patientId: 'patient-123'
      };

      await noNotificationIntegration.transcribeWithHealthcareContext(request);

      expect(mockOttehrService.sendNotification).not.toHaveBeenCalled();
      noNotificationIntegration.destroy();
    });
  });

  describe('Translation Features', () => {
    const mockAudioFile = new File(['mock audio data'], 'test.wav', { type: 'audio/wav' });

    beforeEach(() => {
      mockWhisperService.validateFile.mockReturnValue({ isValid: true });
    });

    it('should translate when auto-translate is enabled', async () => {
      const translationIntegration = new WhisperOttehrIntegration({
        integration: { autoTranslate: true, defaultTargetLanguage: 'es' }
      });

      mockWhisperService.transcribeAudio.mockResolvedValue({
        text: 'The patient is experiencing chest pain',
        language: 'en',
        confidence: 0.95
      });

      const request: AudioTranscriptionRequest = {
        audioFile: mockAudioFile
      };

      const result = await translationIntegration.transcribeWithHealthcareContext(request);

      expect(result.translation).toBeDefined();
      expect(result.translation?.targetLanguage).toBe('es');
      translationIntegration.destroy();
    });

    it('should not translate when source and target languages are the same', async () => {
      const translationIntegration = new WhisperOttehrIntegration({
        integration: { autoTranslate: true, defaultTargetLanguage: 'en' }
      });

      mockWhisperService.transcribeAudio.mockResolvedValue({
        text: 'The patient is experiencing chest pain',
        language: 'en',
        confidence: 0.95
      });

      const request: AudioTranscriptionRequest = {
        audioFile: mockAudioFile
      };

      const result = await translationIntegration.transcribeWithHealthcareContext(request);

      expect(result.translation).toBeUndefined();
      translationIntegration.destroy();
    });

    it('should use request target language over default', async () => {
      mockWhisperService.transcribeAudio.mockResolvedValue({
        text: 'The patient is experiencing chest pain',
        language: 'en',
        confidence: 0.95
      });

      const request: AudioTranscriptionRequest = {
        audioFile: mockAudioFile,
        targetLanguage: 'fr'
      };

      const result = await integration.transcribeWithHealthcareContext(request);

      expect(result.translation).toBeDefined();
      expect(result.translation?.targetLanguage).toBe('fr');
    });
  });

  describe('Ottehr Integration', () => {
    it('should create order with transcription data', async () => {
      const transcriptionResult = {
        text: 'Patient consultation recording',
        language: 'en',
        confidence: 0.95,
        specialty: 'general',
        medicalTerms: ['consultation'],
        medicalConfidence: 0.8,
        patientContext: {
          patientId: 'patient-123',
          encounterType: 'consultation' as const,
          timestamp: '2024-01-01T00:00:00Z'
        }
      };

      mockOttehrService.createOrder.mockResolvedValue({
        success: true,
        data: { id: 'order-123' }
      });

      const result = await integration.createOrderWithTranscription('order-123', transcriptionResult);

      expect(mockOttehrService.createOrder).toHaveBeenCalledWith({
        customerId: 'patient-123',
        items: [],
        totalAmount: 0,
        currency: 'USD',
        metadata: {
          transcriptionData: {
            text: 'Patient consultation recording',
            language: 'en',
            confidence: 0.95,
            medicalTerms: ['consultation'],
            specialty: 'general'
          },
          encounterType: 'consultation',
          timestamp: '2024-01-01T00:00:00Z'
        }
      });

      expect(result.success).toBe(true);
    });

    it('should get patient transcription history', async () => {
      const history = await integration.getPatientTranscriptionHistory('patient-123');
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('Health Status', () => {
    it('should check health status of all services', async () => {
      mockOttehrService.getHealthStatus.mockResolvedValue({
        success: true,
        data: { status: 'healthy', timestamp: '2024-01-01T00:00:00Z', modules: {} }
      });

      const health = await integration.getHealthStatus();

      expect(health.whisper.status).toBe('healthy');
      expect(health.ottehr.status).toBe('healthy');
      expect(health.integration.status).toBe('healthy');
      expect(health.integration.configValid).toBe(true);
    });

    it('should detect Ottehr service errors', async () => {
      mockOttehrService.getHealthStatus.mockResolvedValue({
        success: false,
        error: { message: 'Authentication failed', code: 'AUTH_ERROR' }
      });

      const health = await integration.getHealthStatus();

      expect(health.ottehr.status).toBe('error');
      expect(health.ottehr.error).toBe('Authentication failed');
    });

    it('should detect configuration errors', async () => {
      const invalidIntegration = new WhisperOttehrIntegration({
        whisper: { apiUrl: '' },
        ottehr: { apiKey: '' }
      });

      mockOttehrService.getHealthStatus.mockResolvedValue({
        success: true,
        data: { status: 'healthy', timestamp: '2024-01-01T00:00:00Z', modules: {} }
      });

      const health = await invalidIntegration.getHealthStatus();

      expect(health.integration.status).toBe('error');
      expect(health.integration.configValid).toBe(false);
      invalidIntegration.destroy();
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      const newConfig = {
        whisper: { timeout: 60000 },
        ottehr: { timeout: 45000 },
        integration: { autoTranslate: false }
      };

      integration.updateConfiguration(newConfig);

      expect(mockWhisperService.updateConfig).toHaveBeenCalledWith({ timeout: 60000 });
      expect(mockOttehrService.updateConfig).toHaveBeenCalledWith({ timeout: 45000 });
    });

    it('should get configuration without sensitive data', () => {
      mockOttehrService.getConfig.mockReturnValue({
        apiBaseUrl: 'https://api.ottehr.com',
        environment: 'sandbox',
        timeout: 30000,
        enableNotifications: true,
        enableOrdering: true,
        enablePOSIntegration: true,
        enableDeliveryTracking: true
      });

      const config = integration.getConfiguration();

      expect(config.whisper).toBeDefined();
      expect(config.integration).toBeDefined();
      expect(config.ottehr).toBeDefined();
      expect(config.ottehr).not.toHaveProperty('apiKey');
      expect(config.ottehr).not.toHaveProperty('clientSecret');
      expect(config.ottehr).not.toHaveProperty('webhookSecret');
    });
  });

  describe('Event Handling', () => {
    it('should emit transcription completed event', async () => {
      const mockAudioFile = new File(['mock audio data'], 'test.wav', { type: 'audio/wav' });
      mockWhisperService.validateFile.mockReturnValue({ isValid: true });
      mockWhisperService.transcribeAudio.mockResolvedValue({
        text: 'Test transcription',
        language: 'en',
        confidence: 0.95
      });

      const eventSpy = jest.fn();
      integration.on('transcriptionCompleted', eventSpy);

      const request: AudioTranscriptionRequest = {
        audioFile: mockAudioFile
      };

      await integration.transcribeWithHealthcareContext(request);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Test transcription',
          language: 'en',
          confidence: 0.95
        })
      );
    });

    it('should emit transcription error event', async () => {
      const mockAudioFile = new File(['mock audio data'], 'test.wav', { type: 'audio/wav' });
      mockWhisperService.validateFile.mockReturnValue({ isValid: true });
      mockWhisperService.transcribeAudio.mockRejectedValue(new Error('API Error'));

      const eventSpy = jest.fn();
      integration.on('transcriptionError', eventSpy);

      const request: AudioTranscriptionRequest = {
        audioFile: mockAudioFile
      };

      await expect(integration.transcribeWithHealthcareContext(request)).rejects.toThrow();
      expect(eventSpy).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up resources on destroy', () => {
      integration.destroy();

      expect(mockOttehrService.destroy).toHaveBeenCalled();
      expect(mockWhisperService.updateConfig).toHaveBeenCalledWith({ timeout: 0 });
    });
  });
});

describe('Default Integration Instance', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should create default instance when environment variables are set', () => {
    process.env.WHISPER_API_URL = 'https://api.openai.com/v1/audio/transcriptions';
    process.env.OTTEHR_API_KEY = 'test-api-key';

    // Re-import to trigger default instance creation
    jest.isolateModules(() => {
      const { whisperOttehrIntegration } = require('../whisperOttehrIntegration');
      expect(whisperOttehrIntegration).toBeTruthy();
    });
  });

  it('should not create default instance when environment variables are missing', () => {
    // Clear environment variables
    const originalEnv = process.env.WHISPER_API_URL;
    const originalOttehrEnv = process.env.OTTEHR_API_KEY;
    
    delete process.env.WHISPER_API_URL;
    delete process.env.OTTEHR_API_KEY;

    // Re-import to trigger default instance creation
    jest.isolateModules(() => {
      const { whisperOttehrIntegration } = require('../whisperOttehrIntegration');
      expect(whisperOttehrIntegration).toBeNull();
    });
    
    // Restore environment variables
    if (originalEnv) process.env.WHISPER_API_URL = originalEnv;
    if (originalOttehrEnv) process.env.OTTEHR_API_KEY = originalOttehrEnv;
  });
});