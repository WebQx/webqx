import { AmbientDocumentationService } from '../services/AmbientDocumentationService';

// Mock the WhisperService and WhisperStreamingService
jest.mock('../../../services/whisperService', () => ({
  WhisperService: jest.fn().mockImplementation(() => ({
    transcribeAudio: jest.fn()
  }))
}));

jest.mock('../../../services/whisperStreamingService', () => ({
  WhisperStreamingService: jest.fn().mockImplementation(() => ({
    startTranscription: jest.fn(),
    stopTranscription: jest.fn()
  }))
}));

// Mock ClinicalNote
jest.mock('../models/ClinicalNote', () => ({
  fromTranscription: jest.fn()
}));

const ClinicalNote = require('../models/ClinicalNote');

describe('AmbientDocumentationService', () => {
  let service: AmbientDocumentationService;
  let mockWhisperService: any;
  let mockStreamingService: any;

  beforeEach(() => {
    service = new AmbientDocumentationService();
    mockWhisperService = (service as any).whisperService;
    jest.clearAllMocks();
  });

  describe('Session Management', () => {
    it('should start a session successfully', async () => {
      const session = {
        sessionId: 'session-123',
        patientId: 'patient-456',
        providerId: 'provider-789',
        specialtyContext: 'primary-care',
        language: 'en',
        enableRealTime: false
      };

      const result = await service.startSession(session);

      expect(result).toBe(true);
      expect(service.getSession('session-123')).toEqual(session);
    });

    it('should handle session initialization failure', async () => {
      const session = {
        sessionId: 'session-123',
        patientId: 'patient-456',
        providerId: 'provider-789',
        enableRealTime: true
      };

      // Mock streaming service to throw error during construction
      const { WhisperStreamingService } = require('../../../services/whisperStreamingService');
      const originalImplementation = WhisperStreamingService;
      WhisperStreamingService.mockImplementation(() => {
        throw new Error('Streaming initialization failed');
      });

      const result = await service.startSession(session);

      expect(result).toBe(false);
      
      // Restore original implementation
      WhisperStreamingService.mockImplementation(originalImplementation);
    });

    it('should end a session successfully', async () => {
      const session = {
        sessionId: 'session-123',
        patientId: 'patient-456',
        providerId: 'provider-789'
      };

      await service.startSession(session);
      const result = await service.endSession('session-123');

      expect(result).toBe(true);
      expect(service.getSession('session-123')).toBeNull();
    });

    it('should list active sessions', async () => {
      const session1 = {
        sessionId: 'session-1',
        patientId: 'patient-1',
        providerId: 'provider-1'
      };
      const session2 = {
        sessionId: 'session-2',
        patientId: 'patient-2',
        providerId: 'provider-2'
      };

      await service.startSession(session1);
      await service.startSession(session2);

      const activeSessions = service.getActiveSessions();
      expect(activeSessions).toHaveLength(2);
      expect(activeSessions).toContainEqual(session1);
      expect(activeSessions).toContainEqual(session2);
    });
  });

  describe('Audio File Processing', () => {
    it('should process audio file successfully', async () => {
      const mockAudioFile = new File(['audio content'], 'test.mp3', { type: 'audio/mpeg' });
      const session = {
        sessionId: 'session-123',
        patientId: 'patient-456',
        providerId: 'provider-789',
        specialtyContext: 'cardiology',
        language: 'en'
      };

      // Mock successful transcription
      mockWhisperService.transcribeAudio.mockResolvedValue({
        success: true,
        text: 'Patient presents with chest pain and shortness of breath.',
        confidence: 0.95,
        language: 'en',
        processingTime: 1500,
        segments: [{ start: 0, end: 5, text: 'Patient presents' }]
      });

      // Mock clinical note creation
      const mockClinicalNote = {
        id: 'note-123',
        resourceType: 'DocumentReference',
        toJSON: jest.fn().mockReturnValue({ id: 'note-123', resourceType: 'DocumentReference' }),
        validate: jest.fn().mockReturnValue({ isValid: true, errors: [] })
      };
      ClinicalNote.fromTranscription.mockReturnValue(mockClinicalNote);

      const result = await service.processAudioFile(mockAudioFile, session);

      expect(result.success).toBe(true);
      expect(result.transcriptionText).toBe('Patient presents with chest pain and shortness of breath.');
      expect(result.clinicalNote).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.confidence).toBe(0.95);
      expect(result.metadata.language).toBe('en');

      // Verify Whisper service was called with correct parameters
      expect(mockWhisperService.transcribeAudio).toHaveBeenCalledWith(mockAudioFile, {
        language: 'en',
        temperature: 0.1,
        prompt: expect.stringContaining('chest pain')
      });

      // Verify clinical note was created with correct parameters
      expect(ClinicalNote.fromTranscription).toHaveBeenCalledWith(
        'Patient presents with chest pain and shortness of breath.',
        expect.objectContaining({
          patientId: 'patient-456',
          authorId: 'provider-789',
          sessionId: 'session-123'
        })
      );
    });

    it('should handle transcription failure', async () => {
      const mockAudioFile = new File(['audio content'], 'test.mp3', { type: 'audio/mpeg' });
      const session = {
        sessionId: 'session-123',
        patientId: 'patient-456',
        providerId: 'provider-789'
      };

      // Mock failed transcription
      mockWhisperService.transcribeAudio.mockResolvedValue({
        success: false,
        error: 'Audio processing failed'
      });

      const result = await service.processAudioFile(mockAudioFile, session);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Audio processing failed');
    });

    it('should handle clinical note validation failure', async () => {
      const mockAudioFile = new File(['audio content'], 'test.mp3', { type: 'audio/mpeg' });
      const session = {
        sessionId: 'session-123',
        patientId: 'patient-456',
        providerId: 'provider-789'
      };

      // Mock successful transcription
      mockWhisperService.transcribeAudio.mockResolvedValue({
        success: true,
        text: 'Test transcription',
        confidence: 0.95
      });

      // Mock clinical note with validation failure
      const mockClinicalNote = {
        validate: jest.fn().mockReturnValue({
          isValid: false,
          errors: ['Subject is required']
        })
      };
      ClinicalNote.fromTranscription.mockReturnValue(mockClinicalNote);

      const result = await service.processAudioFile(mockAudioFile, session);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Clinical note validation failed');
    });
  });

  describe('Specialty Context', () => {
    it('should use correct prompts for different specialties', async () => {
      const mockAudioFile = new File(['audio content'], 'test.mp3', { type: 'audio/mpeg' });
      
      // Test cardiology specialty
      const cardiologySession = {
        sessionId: 'session-cardio',
        patientId: 'patient-456',
        providerId: 'provider-789',
        specialtyContext: 'cardiology'
      };

      mockWhisperService.transcribeAudio.mockResolvedValue({
        success: true,
        text: 'Test',
        confidence: 0.95
      });

      const mockClinicalNote = {
        validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
        toJSON: jest.fn().mockReturnValue({})
      };
      ClinicalNote.fromTranscription.mockReturnValue(mockClinicalNote);

      await service.processAudioFile(mockAudioFile, cardiologySession);

      expect(mockWhisperService.transcribeAudio).toHaveBeenCalledWith(
        mockAudioFile,
        expect.objectContaining({
          prompt: expect.stringContaining('chest pain')
        })
      );

      // Test radiology specialty
      const radiologySession = {
        ...cardiologySession,
        specialtyContext: 'radiology'
      };

      await service.processAudioFile(mockAudioFile, radiologySession);

      expect(mockWhisperService.transcribeAudio).toHaveBeenCalledWith(
        mockAudioFile,
        expect.objectContaining({
          prompt: expect.stringContaining('X-ray')
        })
      );
    });

    it('should use default prompt for unknown specialty', async () => {
      const mockAudioFile = new File(['audio content'], 'test.mp3', { type: 'audio/mpeg' });
      const session = {
        sessionId: 'session-123',
        patientId: 'patient-456',
        providerId: 'provider-789',
        specialtyContext: 'unknown-specialty'
      };

      mockWhisperService.transcribeAudio.mockResolvedValue({
        success: true,
        text: 'Test',
        confidence: 0.95
      });

      const mockClinicalNote = {
        validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
        toJSON: jest.fn().mockReturnValue({})
      };
      ClinicalNote.fromTranscription.mockReturnValue(mockClinicalNote);

      await service.processAudioFile(mockAudioFile, session);

      expect(mockWhisperService.transcribeAudio).toHaveBeenCalledWith(
        mockAudioFile,
        expect.objectContaining({
          prompt: expect.stringContaining('Medical consultation')
        })
      );
    });
  });

  describe('Structured Content Extraction', () => {
    it('should extract keywords from transcription text', async () => {
      const service = new AmbientDocumentationService();
      const transcriptionText = 'Patient complains of chest pain and shortness of breath. Diagnosed with hypertension. Prescribed medication for blood pressure control.';
      
      // Access the private method for testing
      const extractStructuredContent = (service as any).extractStructuredContent.bind(service);
      const result = await extractStructuredContent(transcriptionText, 'cardiology');

      expect(result).toBeDefined();
      expect(result.extractedKeywords.symptoms).toContain(
        expect.objectContaining({ keyword: 'pain' })
      );
      expect(result.extractedKeywords.diagnosis).toContain(
        expect.objectContaining({ keyword: 'diagnosed' })
      );
      expect(result.extractedKeywords.medications).toContain(
        expect.objectContaining({ keyword: 'medication' })
      );
      expect(result.specialtyContext).toBe('cardiology');
    });

    it('should return null for text without meaningful keywords', async () => {
      const service = new AmbientDocumentationService();
      const transcriptionText = 'Hello how are you today weather is nice.';
      
      const extractStructuredContent = (service as any).extractStructuredContent.bind(service);
      const result = await extractStructuredContent(transcriptionText);

      expect(result).toBeNull();
    });
  });

  describe('Real-time Transcription', () => {
    it('should start real-time transcription when enabled', async () => {
      const { WhisperStreamingService } = require('../../../services/whisperStreamingService');
      const mockStreamingInstance = {
        startTranscription: jest.fn().mockResolvedValue(true),
        stopTranscription: jest.fn().mockResolvedValue(true)
      };
      WhisperStreamingService.mockReturnValue(mockStreamingInstance);

      const session = {
        sessionId: 'session-123',
        patientId: 'patient-456',
        providerId: 'provider-789',
        enableRealTime: true,
        language: 'es'
      };

      const result = await service.startSession(session);

      expect(result).toBe(true);
      expect(WhisperStreamingService).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'es',
          continuous: true,
          enableVAD: true
        }),
        expect.objectContaining({
          onFinalResult: expect.any(Function),
          onError: expect.any(Function)
        })
      );
      expect(mockStreamingInstance.startTranscription).toHaveBeenCalled();
    });

    it('should handle real-time transcription errors', async () => {
      // Create a new service instance to avoid interference
      const newService = new AmbientDocumentationService();
      
      const session = {
        sessionId: 'session-123',
        patientId: 'patient-456',
        providerId: 'provider-789',
        enableRealTime: true
      };

      const result = await newService.startSession(session);

      // The service should handle the error gracefully and return false
      expect(result).toBe(false);
    });
  });
});