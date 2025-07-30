import React, { useState, useCallback } from 'react';
import { whisperService, WhisperResponse, WhisperError, LoadingState } from '../../services/whisperService';

/**
 * Voice Transcription Component
 * 
 * This component demonstrates how to use the WhisperService for audio transcription
 * in a React application with proper loading states and error handling.
 */
interface VoiceTranscriptionProps {
  /** CSS class name for styling */
  className?: string;
  /** Callback when transcription is completed */
  onTranscriptionComplete?: (text: string) => void;
  /** Callback when an error occurs */
  onError?: (error: string) => void;
}

export const VoiceTranscription: React.FC<VoiceTranscriptionProps> = ({
  className = "",
  onTranscriptionComplete,
  onError
}) => {
  const [transcriptionResult, setTranscriptionResult] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loadingState, setLoadingState] = useState<LoadingState>({ isLoading: false });

  // Subscribe to loading state changes
  React.useEffect(() => {
    const unsubscribe = whisperService.onLoadingStateChange(setLoadingState);
    return unsubscribe;
  }, []);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Clear previous results
    setError("");
    setTranscriptionResult("");

    try {
      // Validate file first
      const validation = whisperService.validateFile(file);
      if (!validation.isValid) {
        const errorMsg = validation.error || 'File validation failed';
        setError(errorMsg);
        onError?.(errorMsg);
        return;
      }

      // Transcribe the audio
      const result: WhisperResponse = await whisperService.transcribeAudio(file);
      
      setTranscriptionResult(result.text);
      onTranscriptionComplete?.(result.text);

    } catch (err) {
      const whisperError = err as WhisperError;
      const errorMessage = whisperError.message || 'An unknown error occurred';
      setError(errorMessage);
      onError?.(errorMessage);
    }
  }, [onTranscriptionComplete, onError]);

  const clearResults = useCallback(() => {
    setTranscriptionResult("");
    setError("");
  }, []);

  return (
    <div 
      className={`voice-transcription ${className}`}
      role="region"
      aria-label="Voice Transcription Tool"
    >
      <div className="voice-transcription-header">
        <h3>🎤 Voice Transcription</h3>
        <p>Upload an audio file to convert speech to text</p>
      </div>

      <div className="voice-transcription-upload">
        <label htmlFor="audio-file-input" className="upload-label">
          Choose Audio File
        </label>
        <input
          id="audio-file-input"
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          disabled={loadingState.isLoading}
          className="audio-file-input"
          aria-describedby="file-help"
        />
        <div id="file-help" className="help-text">
          Supported formats: MP3, MP4, WAV, WebM, OGG, FLAC, M4A (max 25MB)
        </div>
      </div>

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

      {/* Transcription Result */}
      {transcriptionResult && (
        <div className="transcription-result">
          <div className="result-header">
            <h4>📝 Transcription Result</h4>
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
          <div className="result-actions">
            <button 
              onClick={() => navigator.clipboard.writeText(transcriptionResult)}
              className="copy-button"
              aria-label="Copy transcription to clipboard"
            >
              📋 Copy to Clipboard
            </button>
          </div>
        </div>
      )}

      {/* Service Information */}
      <div className="service-info">
        <details>
          <summary>ℹ️ About Voice Transcription</summary>
          <div className="info-content">
            <p>
              This service uses advanced AI to convert speech to text. 
              Your audio files are processed securely and are not stored permanently.
            </p>
            <ul>
              <li>Supports multiple audio formats</li>
              <li>Handles various languages and accents</li>
              <li>Optimized for medical and healthcare terminology</li>
              <li>HIPAA-compliant processing</li>
            </ul>
          </div>
        </details>
      </div>
    </div>
  );
};

export default VoiceTranscription;