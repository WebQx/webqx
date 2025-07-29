import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  whisperService, 
  WhisperResponse, 
  WhisperError, 
  LoadingState 
} from '../../services/whisperService';
import { 
  WhisperStreamingService,
  StreamingConfig 
} from '../../services/whisperStreamingService';
import { whisperTranslator } from '../prescriptions/services/whisperTranslator';

/**
 * Enhanced Voice Transcription Component
 * 
 * Supports both file upload transcription and real-time streaming transcription
 * with multilingual support, accessibility features, and healthcare compliance.
 */
interface EnhancedVoiceTranscriptionProps {
  /** CSS class name for styling */
  className?: string;
  /** Callback when transcription is completed */
  onTranscriptionComplete?: (text: string, language?: string) => void;
  /** Callback when an error occurs */
  onError?: (error: string) => void;
  /** Enable real-time streaming transcription */
  enableRealTime?: boolean;
  /** Enable multilingual support */
  enableMultilingual?: boolean;
  /** Target language for translation (if different from detected) */
  targetLanguage?: string;
  /** Healthcare specialty for medical vocabulary enhancement */
  medicalSpecialty?: 'general' | 'cardiology' | 'pharmacy' | 'emergency';
  /** Enable accessibility features */
  enableAccessibility?: boolean;
  /** Enable audio visualization */
  enableVisualization?: boolean;
}

interface TranscriptionHistory {
  id: string;
  text: string;
  language: string;
  confidence: number;
  timestamp: Date;
  type: 'file' | 'realtime';
}

export const EnhancedVoiceTranscription: React.FC<EnhancedVoiceTranscriptionProps> = ({
  className = "",
  onTranscriptionComplete,
  onError,
  enableRealTime = false,
  enableMultilingual = true,
  targetLanguage,
  medicalSpecialty = 'general',
  enableAccessibility = true,
  enableVisualization = false
}) => {
  // Core state
  const [transcriptionResult, setTranscriptionResult] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loadingState, setLoadingState] = useState<LoadingState>({ isLoading: false });
  
  // Real-time state
  const [isRealTimeActive, setIsRealTimeActive] = useState(false);
  const [streamingService, setStreamingService] = useState<WhisperStreamingService | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [voiceActivity, setVoiceActivity] = useState(false);
  
  // Multilingual state
  const [detectedLanguage, setDetectedLanguage] = useState<string>('en');
  const [translatedText, setTranslatedText] = useState<string>('');
  const [supportedLanguages, setSupportedLanguages] = useState<any[]>([]);
  
  // History and accessibility
  const [transcriptionHistory, setTranscriptionHistory] = useState<TranscriptionHistory[]>([]);
  const [currentMode, setCurrentMode] = useState<'file' | 'realtime'>('file');
  const liveRegionRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Medical vocabulary prompts
  const medicalPrompts = {
    general: 'Medical consultation with basic healthcare terminology',
    cardiology: 'Cardiology consultation with terms like hypertension, myocardial infarction, echocardiogram, stent, arrhythmia',
    pharmacy: 'Pharmacy consultation with prescription terms: dosage, frequency, contraindications, side effects, refills',
    emergency: 'Emergency medical consultation with trauma, triage, vital signs, resuscitation, intubation'
  };

  // Initialize multilingual support
  useEffect(() => {
    if (enableMultilingual) {
      const languages = whisperTranslator.getSupportedLanguages();
      setSupportedLanguages(languages);
    }
  }, [enableMultilingual]);

  // Subscribe to loading state changes
  useEffect(() => {
    const unsubscribe = whisperService.onLoadingStateChange(setLoadingState);
    return unsubscribe;
  }, []);

  // Accessibility announcements
  const announceToScreenReader = useCallback((message: string) => {
    if (enableAccessibility && liveRegionRef.current) {
      liveRegionRef.current.textContent = message;
    }
  }, [enableAccessibility]);

  // Handle file-based transcription
  const handleFileTranscription = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Clear previous results
    setError("");
    setTranscriptionResult("");
    setTranslatedText("");

    try {
      announceToScreenReader("Starting file transcription...");

      // Validate file first
      const validation = whisperService.validateFile(file);
      if (!validation.isValid) {
        const errorMsg = validation.error || 'File validation failed';
        setError(errorMsg);
        onError?.(errorMsg);
        announceToScreenReader(`Error: ${errorMsg}`);
        return;
      }

      // Transcribe with medical context
      const result: WhisperResponse = await whisperService.transcribeAudio(file, {
        prompt: medicalPrompts[medicalSpecialty],
        temperature: 0.1, // Lower temperature for medical accuracy
        language: detectedLanguage === 'auto' ? undefined : detectedLanguage
      });
      
      setTranscriptionResult(result.text);
      
      // Detect and set language
      let finalLanguage = result.language || 'en';
      if (enableMultilingual && result.text) {
        const detection = await whisperTranslator.detectLanguage(result.text);
        finalLanguage = detection.language;
        setDetectedLanguage(finalLanguage);
      }

      // Translate if needed
      if (targetLanguage && targetLanguage !== finalLanguage) {
        try {
          const translation = await whisperTranslator.translate(
            result.text, 
            finalLanguage, 
            targetLanguage
          );
          setTranslatedText(translation.translatedText);
        } catch (translationError) {
          console.warn('Translation failed:', translationError);
        }
      }

      // Add to history
      const historyEntry: TranscriptionHistory = {
        id: Date.now().toString(),
        text: result.text,
        language: finalLanguage,
        confidence: result.confidence || 0.9,
        timestamp: new Date(),
        type: 'file'
      };
      setTranscriptionHistory(prev => [historyEntry, ...prev.slice(0, 9)]); // Keep last 10

      onTranscriptionComplete?.(result.text, finalLanguage);
      announceToScreenReader(`Transcription completed. Detected language: ${finalLanguage}`);

    } catch (err) {
      const whisperError = err as WhisperError;
      const errorMessage = whisperError.message || 'An unknown error occurred';
      setError(errorMessage);
      onError?.(errorMessage);
      announceToScreenReader(`Transcription failed: ${errorMessage}`);
    }

    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onTranscriptionComplete, onError, medicalSpecialty, detectedLanguage, enableMultilingual, targetLanguage, announceToScreenReader]);

  // Start real-time transcription
  const startRealTimeTranscription = useCallback(async () => {
    if (isRealTimeActive) return;

    try {
      announceToScreenReader("Starting real-time transcription...");

      const streamingConfig: StreamingConfig = {
        chunkDuration: 3,
        sampleRate: 16000,
        enableVAD: true,
        silenceThreshold: 0.01,
        maxSilenceDuration: 2000,
        language: detectedLanguage === 'auto' ? 'auto' : detectedLanguage
      };

      const service = new WhisperStreamingService(streamingConfig, {
        onStart: () => {
          setIsRealTimeActive(true);
          announceToScreenReader("Real-time transcription started. Speak now.");
        },
        onStop: () => {
          setIsRealTimeActive(false);
          setAudioLevel(0);
          setVoiceActivity(false);
          announceToScreenReader("Real-time transcription stopped.");
        },
        onFinalResult: async (text, confidence, language) => {
          setTranscriptionResult(prev => prev + (prev ? ' ' : '') + text);
          
          // Handle multilingual
          if (language && language !== detectedLanguage) {
            setDetectedLanguage(language);
          }

          // Translate if needed
          if (targetLanguage && language && targetLanguage !== language) {
            try {
              const translation = await whisperTranslator.translate(text, language, targetLanguage);
              setTranslatedText(prev => prev + (prev ? ' ' : '') + translation.translatedText);
            } catch (translationError) {
              console.warn('Real-time translation failed:', translationError);
            }
          }

          // Add to history
          const historyEntry: TranscriptionHistory = {
            id: Date.now().toString(),
            text,
            language: language || 'en',
            confidence: confidence,
            timestamp: new Date(),
            type: 'realtime'
          };
          setTranscriptionHistory(prev => [historyEntry, ...prev.slice(0, 9)]);

          onTranscriptionComplete?.(text, language);
          announceToScreenReader(`New transcription: ${text}`);
        },
        onError: (error) => {
          setError(error.message);
          onError?.(error.message);
          announceToScreenReader(`Error: ${error.message}`);
        },
        onVoiceActivity: (isActive) => {
          setVoiceActivity(isActive);
        },
        onAudioLevel: (level) => {
          setAudioLevel(level);
        }
      });

      await service.startTranscription();
      setStreamingService(service);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start real-time transcription';
      setError(errorMessage);
      onError?.(errorMessage);
      announceToScreenReader(`Failed to start: ${errorMessage}`);
    }
  }, [isRealTimeActive, detectedLanguage, targetLanguage, onTranscriptionComplete, onError, announceToScreenReader]);

  // Stop real-time transcription
  const stopRealTimeTranscription = useCallback(async () => {
    if (streamingService) {
      await streamingService.stopTranscription();
      setStreamingService(null);
    }
  }, [streamingService]);

  // Clear all results
  const clearResults = useCallback(() => {
    setTranscriptionResult("");
    setTranslatedText("");
    setError("");
    announceToScreenReader("Results cleared");
  }, [announceToScreenReader]);

  // Copy to clipboard
  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      announceToScreenReader("Text copied to clipboard");
    } catch (error) {
      announceToScreenReader("Failed to copy text");
    }
  }, [announceToScreenReader]);

  // Language selector
  const LanguageSelector = () => {
    if (!enableMultilingual) return null;

    return (
      <div className="language-selector">
        <label htmlFor="language-select">Language:</label>
        <select 
          id="language-select"
          value={detectedLanguage}
          onChange={(e) => setDetectedLanguage(e.target.value)}
          aria-label="Select transcription language"
        >
          <option value="auto">Auto-detect</option>
          {supportedLanguages.map(lang => (
            <option key={lang.code} value={lang.code}>
              {lang.name} ({lang.nativeName})
            </option>
          ))}
        </select>
      </div>
    );
  };

  // Audio visualization
  const AudioVisualization = () => {
    if (!enableVisualization || !isRealTimeActive) return null;

    return (
      <div className="audio-visualization">
        <div className="audio-level-container">
          <div 
            className="audio-level-bar"
            style={{ width: `${audioLevel * 100}%` }}
            aria-label={`Audio level: ${Math.round(audioLevel * 100)}%`}
          />
        </div>
        <div className={`voice-activity-indicator ${voiceActivity ? 'active' : ''}`}>
          {voiceActivity ? '🎤 Speaking' : '🔇 Silent'}
        </div>
      </div>
    );
  };

  // Transcription history
  const TranscriptionHistory = () => {
    if (transcriptionHistory.length === 0) return null;

    return (
      <details className="transcription-history">
        <summary>Recent Transcriptions ({transcriptionHistory.length})</summary>
        <div className="history-list">
          {transcriptionHistory.map(entry => (
            <div key={entry.id} className="history-entry">
              <div className="history-header">
                <span className="history-type">{entry.type}</span>
                <span className="history-language">{entry.language}</span>
                <span className="history-confidence">{Math.round(entry.confidence * 100)}%</span>
                <span className="history-time">{entry.timestamp.toLocaleTimeString()}</span>
              </div>
              <div className="history-text">{entry.text}</div>
            </div>
          ))}
        </div>
      </details>
    );
  };

  return (
    <div 
      className={`enhanced-voice-transcription ${className}`}
      role="region"
      aria-label="Enhanced Voice Transcription Tool"
    >
      {/* Screen reader announcements */}
      {enableAccessibility && (
        <div 
          ref={liveRegionRef}
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        />
      )}

      <div className="transcription-header">
        <h3>🎤 Voice Transcription</h3>
        <p>
          {enableRealTime 
            ? "Upload audio files or use real-time transcription for speech-to-text conversion"
            : "Upload an audio file to convert speech to text"
          }
        </p>
      </div>

      {/* Mode selector */}
      {enableRealTime && (
        <div className="mode-selector" role="tablist">
          <button
            role="tab"
            aria-selected={currentMode === 'file'}
            onClick={() => setCurrentMode('file')}
            className={`mode-tab ${currentMode === 'file' ? 'active' : ''}`}
          >
            📁 File Upload
          </button>
          <button
            role="tab"
            aria-selected={currentMode === 'realtime'}
            onClick={() => setCurrentMode('realtime')}
            className={`mode-tab ${currentMode === 'realtime' ? 'active' : ''}`}
          >
            🎙️ Real-time
          </button>
        </div>
      )}

      {/* Language selector */}
      <LanguageSelector />

      {/* File upload mode */}
      {currentMode === 'file' && (
        <div className="file-upload-section">
          <label htmlFor="audio-file-input" className="upload-label">
            Choose Audio File
          </label>
          <input
            ref={fileInputRef}
            id="audio-file-input"
            type="file"
            accept="audio/*"
            onChange={handleFileTranscription}
            disabled={loadingState.isLoading}
            className="audio-file-input"
            aria-describedby="file-help"
          />
          <div id="file-help" className="help-text">
            Supported formats: MP3, MP4, WAV, WebM, OGG, FLAC, M4A (max 25MB)
          </div>
        </div>
      )}

      {/* Real-time mode */}
      {currentMode === 'realtime' && enableRealTime && (
        <div className="realtime-section">
          <div className="realtime-controls">
            <button
              onClick={isRealTimeActive ? stopRealTimeTranscription : startRealTimeTranscription}
              className={`realtime-button ${isRealTimeActive ? 'recording' : ''}`}
              aria-label={isRealTimeActive ? 'Stop real-time transcription' : 'Start real-time transcription'}
            >
              {isRealTimeActive ? '🛑 Stop Recording' : '🎤 Start Recording'}
            </button>
          </div>
          
          <AudioVisualization />
        </div>
      )}

      {/* Loading State */}
      {loadingState.isLoading && (
        <div className="loading-state" role="status" aria-live="polite">
          <div className="loading-spinner" aria-hidden="true">⏳</div>
          <div className="loading-message">
            {loadingState.message || 'Processing...'}
          </div>
          {loadingState.progress !== undefined && (
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${loadingState.progress}%` }}
                aria-label={`Progress: ${loadingState.progress}%`}
              />
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="error-message" role="alert">
          <strong>❌ Error:</strong> {error}
        </div>
      )}

      {/* Transcription Results */}
      {transcriptionResult && (
        <div className="transcription-results">
          <div className="result-header">
            <h4>📝 Transcription Result</h4>
            <div className="result-metadata">
              {detectedLanguage !== 'auto' && (
                <span className="detected-language">
                  Language: {supportedLanguages.find(l => l.code === detectedLanguage)?.name || detectedLanguage}
                </span>
              )}
            </div>
            <button 
              onClick={clearResults}
              className="clear-button"
              aria-label="Clear transcription results"
            >
              Clear
            </button>
          </div>
          
          <div className="result-text" role="region" aria-label="Transcribed text">
            {transcriptionResult}
          </div>
          
          {translatedText && (
            <div className="translation-result">
              <h5>🌐 Translation ({targetLanguage}):</h5>
              <div className="translated-text">{translatedText}</div>
            </div>
          )}
          
          <div className="result-actions">
            <button 
              onClick={() => copyToClipboard(transcriptionResult)}
              className="copy-button"
              aria-label="Copy transcription to clipboard"
            >
              📋 Copy Original
            </button>
            
            {translatedText && (
              <button 
                onClick={() => copyToClipboard(translatedText)}
                className="copy-translation-button"
                aria-label="Copy translation to clipboard"
              >
                📋 Copy Translation
              </button>
            )}
          </div>
        </div>
      )}

      {/* Transcription History */}
      <TranscriptionHistory />

      {/* Service Information */}
      <div className="service-info">
        <details>
          <summary>ℹ️ About Voice Transcription</summary>
          <div className="info-content">
            <p>
              This service uses advanced AI to convert speech to text with medical vocabulary enhancement. 
              Your audio files are processed securely and comply with healthcare data protection standards.
            </p>
            <ul>
              <li>Supports multiple audio formats and languages</li>
              <li>Optimized for medical and healthcare terminology</li>
              <li>Real-time transcription with voice activity detection</li>
              <li>HIPAA-compliant processing with audit logging</li>
              <li>Accessibility features for users with disabilities</li>
              {enableMultilingual && (
                <li>Multilingual support with automatic language detection</li>
              )}
            </ul>
          </div>
        </details>
      </div>
    </div>
  );
};

export default EnhancedVoiceTranscription;