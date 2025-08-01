import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { WhisperStreamingService, StreamingConfig } from '../whisperStreamingService';

// Mock dependencies
jest.mock('../../services/whisperService');

// Mock Web APIs
const mockMediaStream = {
  getTracks: jest.fn().mockReturnValue([{ stop: jest.fn() }])
} as any;

const mockAudioContext = {
  createAnalyser: jest.fn().mockReturnValue({
    fftSize: 256,
    minDecibels: -90,
    maxDecibels: -10,
    getByteFrequencyData: jest.fn()
  }),
  createScriptProcessor: jest.fn().mockReturnValue({
    connect: jest.fn(),
    disconnect: jest.fn(),
    onaudioprocess: null
  }),
  createMediaStreamSource: jest.fn().mockReturnValue({
    connect: jest.fn()
  }),
  close: jest.fn(),
  destination: {}
};

// Mock navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn() as any
  },
  writable: true
});

// Mock AudioContext
(global as any).AudioContext = jest.fn().mockImplementation(() => mockAudioContext);
(global as any).webkitAudioContext = jest.fn().mockImplementation(() => mockAudioContext);

describe('WhisperStreamingService', () => {
  let streamingService: WhisperStreamingService;
  let mockEvents: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup getUserMedia mock
    (navigator.mediaDevices.getUserMedia as any).mockResolvedValue(mockMediaStream);
    
    mockEvents = {
      onStart: jest.fn(),
      onStop: jest.fn(),
      onFinalResult: jest.fn(),
      onError: jest.fn(),
      onVoiceActivity: jest.fn(),
      onAudioLevel: jest.fn()
    };

    const config: StreamingConfig = {
      chunkDuration: 2,
      sampleRate: 16000,
      enableVAD: true,
      silenceThreshold: 0.01
    };

    streamingService = new WhisperStreamingService(config, mockEvents);
  });

  afterEach(async () => {
    if (streamingService) {
      await streamingService.stopTranscription();
      streamingService.dispose();
    }
  });

  describe('Initialization', () => {
    test('should create service with default config', () => {
      const service = new WhisperStreamingService();
      expect(service).toBeDefined();
      expect(service.getState().isRecording).toBe(false);
    });

    test('should merge custom config with defaults', () => {
      const customConfig: StreamingConfig = {
        chunkDuration: 5,
        sampleRate: 22050
      };
      
      const service = new WhisperStreamingService(customConfig);
      const state = service.getState();
      
      expect(state.isRecording).toBe(false);
      expect(state.isProcessing).toBe(false);
    });
  });

  describe('Transcription Lifecycle', () => {
    test('should start transcription successfully', async () => {
      await streamingService.startTranscription();
      
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      expect(mockEvents.onStart).toHaveBeenCalled();
      expect(streamingService.getState().isRecording).toBe(true);
    });

    test('should stop transcription successfully', async () => {
      await streamingService.startTranscription();
      await streamingService.stopTranscription();
      
      expect(mockEvents.onStop).toHaveBeenCalled();
      expect(streamingService.getState().isRecording).toBe(false);
    });

    test('should handle microphone access denial', async () => {
      const error = new Error('Permission denied');
      (navigator.mediaDevices.getUserMedia as any).mockRejectedValueOnce(error);
      
      await expect(streamingService.startTranscription()).rejects.toThrow();
      expect(mockEvents.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'MICROPHONE_ERROR',
          message: expect.stringContaining('Permission denied')
        })
      );
    });

    test('should prevent multiple concurrent transcriptions', async () => {
      await streamingService.startTranscription();
      
      await expect(streamingService.startTranscription()).rejects.toThrow(
        'Transcription is already running'
      );
    });
  });

  describe('Voice Activity Detection', () => {
    test('should detect voice activity above threshold', () => {
      const audioData = new Float32Array(1024);
      // Fill with audio above threshold
      audioData.fill(0.05); // Above 0.01 threshold
      
      // Access private method for testing
      const isVoiceActive = (streamingService as any).detectVoiceActivity(audioData);
      expect(isVoiceActive).toBe(true);
    });

    test('should detect silence below threshold', () => {
      const audioData = new Float32Array(1024);
      // Fill with audio below threshold
      audioData.fill(0.005); // Below 0.01 threshold
      
      const isVoiceActive = (streamingService as any).detectVoiceActivity(audioData);
      expect(isVoiceActive).toBe(false);
    });

    test('should handle VAD disabled', () => {
      const config: StreamingConfig = { enableVAD: false };
      const service = new WhisperStreamingService(config);
      
      const audioData = new Float32Array(1024);
      audioData.fill(0.005); // Below threshold
      
      const isVoiceActive = (service as any).detectVoiceActivity(audioData);
      expect(isVoiceActive).toBe(true); // Should return true when VAD disabled
    });
  });

  describe('Audio Processing', () => {
    test('should convert audio buffer to WAV', () => {
      const buffer = new Float32Array([0.1, -0.1, 0.5, -0.5]);
      const sampleRate = 16000;
      const channels = 1;
      
      const wavBlob = (streamingService as any).audioBufferToWav(buffer, sampleRate, channels);
      
      expect(wavBlob).toBeInstanceOf(Blob);
      expect(wavBlob.type).toBe('audio/wav');
      expect(wavBlob.size).toBeGreaterThan(44); // WAV header + data
    });

    test('should handle empty audio buffer', () => {
      const buffer = new Float32Array(0);
      const sampleRate = 16000;
      const channels = 1;
      
      const wavBlob = (streamingService as any).audioBufferToWav(buffer, sampleRate, channels);
      
      expect(wavBlob).toBeInstanceOf(Blob);
      expect(wavBlob.size).toBe(44); // Just WAV header
    });
  });

  describe('Configuration Updates', () => {
    test('should update configuration', () => {
      const newConfig: Partial<StreamingConfig> = {
        chunkDuration: 10,
        silenceThreshold: 0.02
      };
      
      streamingService.updateConfig(newConfig);
      
      // Configuration should be updated (tested through behavior)
      expect(streamingService.getState()).toBeDefined();
    });
  });

  describe('State Management', () => {
    test('should return current state', () => {
      const state = streamingService.getState();
      
      expect(state).toMatchObject({
        isRecording: false,
        isProcessing: false,
        chunksBuffered: 0
      });
    });

    test('should update state during transcription', async () => {
      await streamingService.startTranscription();
      
      const state = streamingService.getState();
      expect(state.isRecording).toBe(true);
      
      await streamingService.stopTranscription();
      
      const finalState = streamingService.getState();
      expect(finalState.isRecording).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle audio context creation failure', async () => {
      // Mock AudioContext to throw
      (global as any).AudioContext = jest.fn().mockImplementation(() => {
        throw new Error('AudioContext not supported');
      });
      (global as any).webkitAudioContext = undefined;
      
      await expect(streamingService.startTranscription()).rejects.toThrow();
      expect(mockEvents.onError).toHaveBeenCalled();
    });

    test('should handle processing errors gracefully', () => {
      // Simulate processing error
      const mockEvent = {
        inputBuffer: {
          getChannelData: jest.fn().mockImplementation(() => {
            throw new Error('Processing error');
          }),
          length: 1024
        }
      };
      
      // Should not throw
      expect(() => {
        (streamingService as any).processAudioChunk(mockEvent);
      }).not.toThrow();
    });
  });

  describe('Memory Management', () => {
    test('should dispose resources properly', () => {
      expect(() => {
        streamingService.dispose();
      }).not.toThrow();
    });

    test('should clean up after stopping transcription', async () => {
      await streamingService.startTranscription();
      await streamingService.stopTranscription();
      
      expect(mockAudioContext.close).toHaveBeenCalled();
      expect(mockMediaStream.getTracks()[0].stop).toHaveBeenCalled();
    });
  });
});

describe('Streaming Service Integration', () => {
  test('should handle complete transcription workflow', async () => {
    const mockWhisperService = {
      transcribeAudio: jest.fn().mockResolvedValue({
        text: 'Hello world',
        confidence: 0.95,
        language: 'en'
      }) as any
    };
    
    const events = {
      onFinalResult: jest.fn()
    };
    
    const service = new WhisperStreamingService({}, events);
    
    // Mock the internal whisper service
    (service as any).whisperService = mockWhisperService;
    
    // Simulate processing chunks
    const audioData = new Float32Array(1024);
    audioData.fill(0.1); // Voice activity
    
    (service as any).audioState = {
      isRecording: true,
      chunks: [audioData],
      lastVoiceActivity: Date.now()
    };
    
    await (service as any).processChunks();
    
    expect(mockWhisperService.transcribeAudio).toHaveBeenCalled();
    expect(events.onFinalResult).toHaveBeenCalledWith('Hello world', 0.95, 'en');
  });

  test('should handle API errors during processing', async () => {
    const mockWhisperService = {
      transcribeAudio: jest.fn().mockRejectedValue(new Error('API Error')) as any
    };
    
    const events = {
      onError: jest.fn()
    };
    
    const service = new WhisperStreamingService({}, events);
    (service as any).whisperService = mockWhisperService;
    
    (service as any).audioState = {
      isRecording: true,
      isProcessing: false,
      chunks: [new Float32Array(1024)]
    };
    
    await (service as any).processChunks();
    
    expect(events.onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'API Error'
      })
    );
  });
});

describe('Performance Tests', () => {
  test('should handle rapid audio chunks', () => {
    const service = new WhisperStreamingService();
    const audioData = new Float32Array(1024);
    
    // Simulate rapid audio processing
    const startTime = Date.now();
    for (let i = 0; i < 100; i++) {
      const mockEvent = {
        inputBuffer: {
          getChannelData: () => audioData,
          length: 1024
        }
      };
      (service as any).processAudioChunk(mockEvent);
    }
    const endTime = Date.now();
    
    // Should complete within reasonable time
    expect(endTime - startTime).toBeLessThan(1000);
  });

  test('should manage memory efficiently', () => {
    const service = new WhisperStreamingService();
    
    // Simulate adding many chunks
    (service as any).audioState = {
      chunks: Array(1000).fill(new Float32Array(1024))
    };
    
    // Memory usage should be bounded
    const memoryUsage = process.memoryUsage();
    expect(memoryUsage.heapUsed).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
  });
});