/**
 * @fileoverview Whisper Real-time Streaming Transcription Service
 * 
 * This service provides real-time audio transcription capabilities using
 * the Web Audio API and Whisper API for continuous speech recognition
 * in healthcare environments with enhanced multilingual support.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { WhisperService, WhisperResponse, WhisperError, WhisperConfig } from './whisperService';

/**
 * Configuration for real-time streaming
 */
export interface StreamingConfig extends WhisperConfig {
  /** Minimum chunk duration in seconds before sending to API */
  chunkDuration?: number;
  /** Audio sample rate */
  sampleRate?: number;
  /** Audio channels (1 = mono, 2 = stereo) */
  channels?: number;
  /** Enable voice activity detection */
  enableVAD?: boolean;
  /** Silence threshold for VAD (0-1) */
  silenceThreshold?: number;
  /** Maximum silence duration before stopping transcription (ms) */
  maxSilenceDuration?: number;
  /** Enable continuous transcription */
  continuous?: boolean;
  /** Language for transcription (auto-detect if not specified) */
  language?: string;
}

/**
 * Real-time transcription event types
 */
export interface StreamingEvents {
  /** Called when transcription starts */
  onStart?: () => void;
  /** Called when transcription stops */
  onStop?: () => void;
  /** Called when interim results are available */
  onInterimResult?: (text: string, confidence: number) => void;
  /** Called when final results are available */
  onFinalResult?: (text: string, confidence: number, language?: string) => void;
  /** Called when an error occurs */
  onError?: (error: WhisperError) => void;
  /** Called when voice activity is detected */
  onVoiceActivity?: (isActive: boolean) => void;
  /** Called with audio level updates */
  onAudioLevel?: (level: number) => void;
}

/**
 * Audio processing state
 */
interface AudioState {
  isRecording: boolean;
  isProcessing: boolean;
  audioContext: AudioContext | null;
  mediaStream: MediaStream | null;
  processor: ScriptProcessorNode | null;
  analyzer: AnalyserNode | null;
  chunks: Float32Array[];
  lastVoiceActivity: number;
  currentLanguage?: string;
}

/**
 * Default configuration for streaming
 */
const DEFAULT_STREAMING_CONFIG: Required<StreamingConfig> = {
  apiUrl: (typeof process !== 'undefined' && process.env?.WHISPER_API_URL) || 'https://api.openai.com/v1/audio/transcriptions',
  timeout: 30000,
  maxFileSize: 25 * 1024 * 1024,
  allowedFileTypes: ['audio/wav'],
  chunkDuration: 3, // 3 seconds
  sampleRate: 16000, // 16kHz for optimal Whisper performance
  channels: 1, // mono
  enableVAD: true,
  silenceThreshold: 0.01,
  maxSilenceDuration: 2000, // 2 seconds
  continuous: true,
  language: 'auto'
};

/**
 * WhisperStreamingService provides real-time audio transcription
 * with voice activity detection and multilingual support
 */
export class WhisperStreamingService {
  private config: Required<StreamingConfig>;
  private whisperService: WhisperService;
  private audioState: AudioState;
  private events: StreamingEvents;
  private vadWorker: Worker | null = null;

  constructor(config: StreamingConfig = {}, events: StreamingEvents = {}) {
    this.config = { ...DEFAULT_STREAMING_CONFIG, ...config };
    this.events = events;
    this.whisperService = new WhisperService(config);
    
    this.audioState = {
      isRecording: false,
      isProcessing: false,
      audioContext: null,
      mediaStream: null,
      processor: null,
      analyzer: null,
      chunks: [],
      lastVoiceActivity: Date.now()
    };

    this.initializeVAD();
  }

  /**
   * Initialize Voice Activity Detection
   */
  private initializeVAD(): void {
    if (!this.config.enableVAD || typeof Worker === 'undefined') {
      return;
    }

    // Simple inline VAD logic (in production, use a proper VAD library)
    // This is a simplified version for demonstration
  }

  /**
   * Start real-time transcription
   */
  async startTranscription(): Promise<void> {
    if (this.audioState.isRecording) {
      throw new Error('Transcription is already running');
    }

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channels,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.config.sampleRate
      });

      // Create analyzer for volume detection
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 256;
      analyzer.minDecibels = -90;
      analyzer.maxDecibels = -10;

      // Create script processor for audio data
      const processor = audioContext.createScriptProcessor(4096, this.config.channels, this.config.channels);
      
      // Connect audio nodes
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyzer);
      source.connect(processor);
      processor.connect(audioContext.destination);

      // Set up audio state
      this.audioState = {
        ...this.audioState,
        isRecording: true,
        audioContext,
        mediaStream: stream,
        processor,
        analyzer,
        chunks: [],
        lastVoiceActivity: Date.now()
      };

      // Set up audio processing
      processor.onaudioprocess = (event) => {
        this.processAudioChunk(event);
      };

      // Start monitoring audio levels
      this.startAudioLevelMonitoring();

      this.events.onStart?.();

    } catch (error) {
      const whisperError: WhisperError = {
        message: `Failed to start transcription: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: 'MICROPHONE_ERROR'
      };
      this.events.onError?.(whisperError);
      throw whisperError;
    }
  }

  /**
   * Stop real-time transcription
   */
  async stopTranscription(): Promise<void> {
    if (!this.audioState.isRecording) {
      return;
    }

    // Process any remaining audio chunks
    if (this.audioState.chunks.length > 0) {
      await this.processChunks();
    }

    // Clean up audio resources
    if (this.audioState.processor) {
      this.audioState.processor.disconnect();
    }
    
    if (this.audioState.audioContext) {
      await this.audioState.audioContext.close();
    }
    
    if (this.audioState.mediaStream) {
      this.audioState.mediaStream.getTracks().forEach(track => track.stop());
    }

    this.audioState = {
      isRecording: false,
      isProcessing: false,
      audioContext: null,
      mediaStream: null,
      processor: null,
      analyzer: null,
      chunks: [],
      lastVoiceActivity: Date.now()
    };

    this.events.onStop?.();
  }

  /**
   * Process audio chunk and detect voice activity
   */
  private processAudioChunk(event: AudioProcessingEvent): void {
    if (!this.audioState.isRecording) return;

    const inputBuffer = event.inputBuffer;
    const inputData = inputBuffer.getChannelData(0);
    
    // Voice Activity Detection
    const isVoiceActive = this.detectVoiceActivity(inputData);
    
    if (isVoiceActive) {
      // Add chunk to buffer
      this.audioState.chunks.push(new Float32Array(inputData));
      this.audioState.lastVoiceActivity = Date.now();
      this.events.onVoiceActivity?.(true);
    } else {
      this.events.onVoiceActivity?.(false);
      
      // Check if we should process accumulated chunks
      const silenceDuration = Date.now() - this.audioState.lastVoiceActivity;
      if (silenceDuration > this.config.maxSilenceDuration && this.audioState.chunks.length > 0) {
        this.processChunks();
      }
    }

    // Check if chunk duration threshold is reached
    const totalDuration = this.audioState.chunks.length * (inputBuffer.length / this.config.sampleRate);
    if (totalDuration >= this.config.chunkDuration) {
      this.processChunks();
    }
  }

  /**
   * Simple voice activity detection
   */
  private detectVoiceActivity(audioData: Float32Array): boolean {
    if (!this.config.enableVAD) {
      return true; // Always process if VAD is disabled
    }

    // Calculate RMS (Root Mean Square) for volume level
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    const rms = Math.sqrt(sum / audioData.length);
    
    return rms > this.config.silenceThreshold;
  }

  /**
   * Start monitoring audio levels for UI feedback
   */
  private startAudioLevelMonitoring(): void {
    if (!this.audioState.analyzer) return;

    const dataArray = new Uint8Array(this.audioState.analyzer.frequencyBinCount);
    
    const updateLevel = () => {
      if (!this.audioState.isRecording || !this.audioState.analyzer) return;
      
      this.audioState.analyzer.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const level = average / 255; // Normalize to 0-1
      
      this.events.onAudioLevel?.(level);
      
      requestAnimationFrame(updateLevel);
    };
    
    updateLevel();
  }

  /**
   * Process accumulated audio chunks
   */
  private async processChunks(): Promise<void> {
    if (this.audioState.chunks.length === 0 || this.audioState.isProcessing) {
      return;
    }

    this.audioState.isProcessing = true;

    try {
      // Combine chunks into single audio buffer
      const totalLength = this.audioState.chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const combinedBuffer = new Float32Array(totalLength);
      
      let offset = 0;
      for (const chunk of this.audioState.chunks) {
        combinedBuffer.set(chunk, offset);
        offset += chunk.length;
      }

      // Convert to WAV blob
      const wavBlob = this.audioBufferToWav(combinedBuffer, this.config.sampleRate, this.config.channels);
      
      // Create File object for Whisper API
      const audioFile = new File([wavBlob], 'audio.wav', { type: 'audio/wav' });

      // Send to Whisper API
      const result = await this.whisperService.transcribeAudio(audioFile, {
        language: this.config.language === 'auto' ? undefined : this.config.language,
        temperature: 0.2 // Lower temperature for more focused results
      });

      // Emit results
      if (result.text.trim()) {
        this.events.onFinalResult?.(result.text, result.confidence || 0.9, result.language);
        
        // Update current language if detected
        if (result.language) {
          this.audioState.currentLanguage = result.language;
        }
      }

      // Clear processed chunks
      this.audioState.chunks = [];

    } catch (error) {
      const whisperError = error as WhisperError;
      this.events.onError?.(whisperError);
    } finally {
      this.audioState.isProcessing = false;
    }
  }

  /**
   * Convert audio buffer to WAV format
   */
  private audioBufferToWav(buffer: Float32Array, sampleRate: number, channels: number): Blob {
    const length = buffer.length;
    const arrayBuffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);
    
    // Convert float32 to int16
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, buffer[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  /**
   * Get current transcription state
   */
  getState(): {
    isRecording: boolean;
    isProcessing: boolean;
    currentLanguage?: string;
    chunksBuffered: number;
  } {
    return {
      isRecording: this.audioState.isRecording,
      isProcessing: this.audioState.isProcessing,
      currentLanguage: this.audioState.currentLanguage,
      chunksBuffered: this.audioState.chunks.length
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<StreamingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.whisperService.updateConfig(newConfig);
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopTranscription();
    if (this.vadWorker) {
      this.vadWorker.terminate();
    }
  }
}

/**
 * Default streaming service instance
 */
export const whisperStreamingService = new WhisperStreamingService();

/**
 * Convenience function for starting real-time transcription
 */
export async function startRealTimeTranscription(
  config?: StreamingConfig,
  events?: StreamingEvents
): Promise<WhisperStreamingService> {
  const service = new WhisperStreamingService(config, events);
  await service.startTranscription();
  return service;
}

export default WhisperStreamingService;