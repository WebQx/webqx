/**
 * @fileoverview OttehrVoiceTranscription Component
 * 
 * Enhanced voice transcription component that integrates with Ottehr services
 * to provide healthcare-specific audio transcription and workflow integration.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  WhisperOttehrIntegration, 
  AudioTranscriptionRequest, 
  HealthcareTranscriptionResult,
  WhisperOttehrConfig 
} from '../../services/whisperOttehrIntegration';

/**
 * Props interface for the OttehrVoiceTranscription component
 */
export interface OttehrVoiceTranscriptionProps {
  /** Patient ID for healthcare context */
  patientId?: string;
  /** Type of medical encounter */
  encounterType?: 'consultation' | 'prescription' | 'discharge' | 'emergency';
  /** Medical specialty context */
  specialty?: 'general' | 'cardiology' | 'pharmacy' | 'emergency' | 'surgery';
  /** Enable automatic translation */
  enableTranslation?: boolean;
  /** Target language for translation */
  targetLanguage?: string;
  /** Custom medical prompt */
  customPrompt?: string;
  /** Integration configuration override */
  integrationConfig?: Partial<WhisperOttehrConfig>;
  /** Callback when transcription is completed */
  onTranscriptionComplete?: (result: HealthcareTranscriptionResult) => void;
  /** Callback when transcription fails */
  onError?: (error: Error) => void;
  /** Callback when Ottehr order is created */
  onOrderCreated?: (orderId: string, result: HealthcareTranscriptionResult) => void;
  /** Enable creating Ottehr orders from transcriptions */
  enableOrderCreation?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Accessibility label */
  ariaLabel?: string;
}

/**
 * Transcription state interface
 */
interface TranscriptionState {
  isRecording: boolean;
  isProcessing: boolean;
  isTranscribing: boolean;
  currentResult: HealthcareTranscriptionResult | null;
  error: string | null;
  loadingMessage: string;
  audioLevel: number;
}

/**
 * OttehrVoiceTranscription component provides healthcare-integrated voice transcription
 */
export const OttehrVoiceTranscription: React.FC<OttehrVoiceTranscriptionProps> = ({
  patientId,
  encounterType = 'consultation',
  specialty = 'general',
  enableTranslation = false,
  targetLanguage = 'en',
  customPrompt,
  integrationConfig,
  onTranscriptionComplete,
  onError,
  onOrderCreated,
  enableOrderCreation = false,
  className = '',
  ariaLabel = 'Healthcare voice transcription'
}) => {
  // Component state
  const [state, setState] = useState<TranscriptionState>({
    isRecording: false,
    isProcessing: false,
    isTranscribing: false,
    currentResult: null,
    error: null,
    loadingMessage: '',
    audioLevel: 0
  });

  // Refs
  const integrationRef = useRef<WhisperOttehrIntegration | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize integration service
  useEffect(() => {
    try {
      integrationRef.current = new WhisperOttehrIntegration(integrationConfig);
      
      // Set up event listeners
      integrationRef.current.on('transcriptionCompleted', handleTranscriptionCompleted);
      integrationRef.current.on('transcriptionError', handleTranscriptionError);
      integrationRef.current.on('whisperLoadingStateChanged', handleLoadingStateChanged);
      integrationRef.current.on('orderWithTranscriptionCreated', handleOrderCreated);

      return () => {
        if (integrationRef.current) {
          integrationRef.current.removeAllListeners();
          integrationRef.current.destroy();
        }
      };
    } catch (error) {
      console.error('Failed to initialize WhisperOttehr integration:', error);
      setState(prev => ({
        ...prev,
        error: `Integration initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }));
    }
  }, [integrationConfig]);

  // Event handlers
  const handleTranscriptionCompleted = useCallback((result: HealthcareTranscriptionResult) => {
    setState(prev => ({
      ...prev,
      currentResult: result,
      isTranscribing: false,
      isProcessing: false,
      error: null
    }));
    
    onTranscriptionComplete?.(result);
    announceToScreenReader(`Transcription completed. ${result.medicalTerms?.length || 0} medical terms identified.`);
  }, [onTranscriptionComplete]);

  const handleTranscriptionError = useCallback((error: Error) => {
    setState(prev => ({
      ...prev,
      error: error.message,
      isTranscribing: false,
      isProcessing: false,
      isRecording: false
    }));
    
    onError?.(error);
    announceToScreenReader(`Transcription failed: ${error.message}`);
  }, [onError]);

  const handleLoadingStateChanged = useCallback((loadingState: any) => {
    setState(prev => ({
      ...prev,
      isTranscribing: loadingState.isLoading,
      loadingMessage: loadingState.message || 'Processing...'
    }));
  }, []);

  const handleOrderCreated = useCallback((data: any) => {
    const { orderId, transcriptionResult } = data;
    onOrderCreated?.(orderId, transcriptionResult);
    announceToScreenReader(`Ottehr order ${orderId} created successfully`);
  }, [onOrderCreated]);

  // Accessibility function
  const announceToScreenReader = useCallback((message: string) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    document.body.appendChild(announcement);
    
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }, []);

  // Audio visualization
  const startAudioVisualization = useCallback((stream: MediaStream) => {
    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVisualization = () => {
        if (analyserRef.current && state.isRecording) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
          setState(prev => ({ ...prev, audioLevel: average / 255 }));
          animationFrameRef.current = requestAnimationFrame(updateVisualization);
        }
      };

      updateVisualization();
    } catch (error) {
      console.warn('Audio visualization failed:', error);
    }
  }, [state.isRecording]);

  const stopAudioVisualization = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setState(prev => ({ ...prev, audioLevel: 0 }));
  }, []);

  // Recording functions
  const startRecording = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null, isProcessing: true }));
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: mediaRecorderRef.current?.mimeType || 'audio/wav' 
        });
        processAudioRecording(audioBlob);
        stream.getTracks().forEach(track => track.stop());
        stopAudioVisualization();
      };

      mediaRecorderRef.current.start(1000); // Collect data every second
      startAudioVisualization(stream);

      setState(prev => ({
        ...prev,
        isRecording: true,
        isProcessing: false
      }));

      announceToScreenReader('Recording started. Speak now.');

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Failed to start recording: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isProcessing: false
      }));
      announceToScreenReader('Failed to start recording. Please check microphone permissions.');
    }
  }, [startAudioVisualization, stopAudioVisualization]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    setState(prev => ({
      ...prev,
      isRecording: false,
      isProcessing: true
    }));

    announceToScreenReader('Recording stopped. Processing audio...');
  }, []);

  const processAudioRecording = useCallback(async (audioBlob: Blob) => {
    if (!integrationRef.current) {
      setState(prev => ({ ...prev, error: 'Integration service not available', isProcessing: false }));
      return;
    }

    try {
      const audioFile = new File([audioBlob], 'recording.webm', { type: audioBlob.type });
      
      const request: AudioTranscriptionRequest = {
        audioFile,
        patientId,
        encounterType,
        specialty,
        targetLanguage: enableTranslation ? targetLanguage : undefined,
        customPrompt
      };

      const result = await integrationRef.current.transcribeWithHealthcareContext(request);
      
      // The result is handled by the event listener
      // No need to manually update state here
      
    } catch (error) {
      // Error is handled by the event listener
      console.error('Processing failed:', error);
    }
  }, [patientId, encounterType, specialty, enableTranslation, targetLanguage, customPrompt]);

  // File upload handling
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !integrationRef.current) {
      return;
    }

    setState(prev => ({ ...prev, error: null, isProcessing: true }));

    try {
      const request: AudioTranscriptionRequest = {
        audioFile: file,
        patientId,
        encounterType,
        specialty,
        targetLanguage: enableTranslation ? targetLanguage : undefined,
        customPrompt
      };

      await integrationRef.current.transcribeWithHealthcareContext(request);
      
    } catch (error) {
      // Error is handled by the event listener
      console.error('File processing failed:', error);
    }

    // Reset file input
    event.target.value = '';
  }, [patientId, encounterType, specialty, enableTranslation, targetLanguage, customPrompt]);

  // Order creation
  const createOrder = useCallback(async () => {
    if (!state.currentResult || !integrationRef.current) {
      return;
    }

    try {
      setState(prev => ({ ...prev, isProcessing: true }));
      
      const orderId = `order_${Date.now()}`;
      await integrationRef.current.createOrderWithTranscription(orderId, state.currentResult);
      
      setState(prev => ({ ...prev, isProcessing: false }));
      
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Failed to create order: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isProcessing: false
      }));
    }
  }, [state.currentResult]);

  // Copy to clipboard
  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      announceToScreenReader('Text copied to clipboard');
    } catch (error) {
      console.error('Copy failed:', error);
    }
  }, []);

  // Clear results
  const clearResults = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentResult: null,
      error: null
    }));
    announceToScreenReader('Results cleared');
  }, []);

  // Render audio level visualization
  const renderAudioVisualization = () => {
    if (!state.isRecording) return null;

    const bars = Array.from({ length: 20 }, (_, i) => (
      <div
        key={i}
        className="audio-bar"
        style={{
          height: `${10 + (state.audioLevel * 40)}px`,
          animationDelay: `${i * 0.1}s`
        }}
      />
    ));

    return (
      <div className="audio-visualization" aria-hidden="true">
        {bars}
      </div>
    );
  };

  // Render transcription result
  const renderTranscriptionResult = () => {
    if (!state.currentResult) return null;

    return (
      <div className="transcription-result" role="region" aria-label="Transcription results">
        <div className="result-metadata">
          <span>Language: {state.currentResult.language?.toUpperCase()}</span>
          <span>Confidence: {Math.round((state.currentResult.confidence || 0) * 100)}%</span>
          <span>Medical Terms: {state.currentResult.medicalTerms?.length || 0}</span>
          <span>Specialty: {state.currentResult.specialty}</span>
          {state.currentResult.patientContext && (
            <span>Patient: {state.currentResult.patientContext.patientId}</span>
          )}
        </div>
        
        <div className="transcription-text" tabIndex={0}>
          {state.currentResult.text}
        </div>
        
        {state.currentResult.medicalTerms && state.currentResult.medicalTerms.length > 0 && (
          <div className="medical-terms">
            <h4>Detected Medical Terms:</h4>
            <div className="terms-list">
              {state.currentResult.medicalTerms.map((term, index) => (
                <span key={index} className="medical-term">{term}</span>
              ))}
            </div>
          </div>
        )}
        
        {state.currentResult.translation && (
          <div className="translation-result">
            <h4>Translation ({state.currentResult.translation.targetLanguage.toUpperCase()}):</h4>
            <div className="translation-text" tabIndex={0}>
              {state.currentResult.translation.text}
            </div>
            <div className="translation-confidence">
              Confidence: {Math.round(state.currentResult.translation.confidence * 100)}%
            </div>
          </div>
        )}
        
        <div className="result-actions">
          <button
            type="button"
            onClick={() => copyToClipboard(state.currentResult!.text)}
            className="btn btn-secondary"
            aria-label="Copy transcription to clipboard"
          >
            📋 Copy Text
          </button>
          
          {state.currentResult.translation && (
            <button
              type="button"
              onClick={() => copyToClipboard(state.currentResult!.translation!.text)}
              className="btn btn-secondary"
              aria-label="Copy translation to clipboard"
            >
              🌐 Copy Translation
            </button>
          )}
          
          {enableOrderCreation && (
            <button
              type="button"
              onClick={createOrder}
              disabled={state.isProcessing}
              className="btn btn-primary"
              aria-label="Create Ottehr order from transcription"
            >
              {state.isProcessing ? '⏳ Creating...' : '📋 Create Order'}
            </button>
          )}
          
          <button
            type="button"
            onClick={clearResults}
            className="btn btn-outline"
            aria-label="Clear results"
          >
            🗑️ Clear
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={`ottehr-voice-transcription ${className}`} role="region" aria-label={ariaLabel}>
      {/* Header */}
      <div className="transcription-header">
        <h3>🎤 Healthcare Voice Transcription</h3>
        <div className="context-info">
          {patientId && <span className="patient-id">Patient: {patientId}</span>}
          <span className="encounter-type">Type: {encounterType}</span>
          <span className="specialty">Specialty: {specialty}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="transcription-controls">
        <div className="recording-controls">
          <button
            type="button"
            onClick={state.isRecording ? stopRecording : startRecording}
            disabled={state.isProcessing}
            className={`record-button ${state.isRecording ? 'recording' : ''}`}
            aria-label={state.isRecording ? 'Stop recording' : 'Start recording'}
            aria-pressed={state.isRecording}
          >
            {state.isRecording ? '🛑 Stop Recording' : '🎤 Start Recording'}
          </button>
          
          <div className="file-upload">
            <input
              type="file"
              id="audio-file-input"
              accept="audio/*"
              onChange={handleFileUpload}
              disabled={state.isProcessing || state.isRecording}
              className="file-input"
              aria-label="Upload audio file for transcription"
            />
            <label htmlFor="audio-file-input" className="file-upload-label">
              📁 Upload Audio File
            </label>
          </div>
        </div>

        {/* Audio Visualization */}
        {renderAudioVisualization()}
      </div>

      {/* Status Messages */}
      {state.isProcessing && (
        <div className="processing-status" role="status" aria-live="polite">
          <div className="spinner" aria-hidden="true"></div>
          <span>{state.loadingMessage || 'Processing...'}</span>
        </div>
      )}

      {state.error && (
        <div className="error-message" role="alert" aria-live="assertive">
          <span className="error-icon" aria-hidden="true">⚠️</span>
          {state.error}
        </div>
      )}

      {/* Results */}
      {renderTranscriptionResult()}

      {/* HIPAA Compliance Notice */}
      <div className="compliance-notice">
        <span className="compliance-icon" aria-hidden="true">🔒</span>
        <span>HIPAA compliant processing • Data encrypted • No permanent storage</span>
      </div>

      {/* CSS Styles */}
      <style jsx>{`
        .ottehr-voice-transcription {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .transcription-header h3 {
          margin: 0 0 10px 0;
          color: #2c3e50;
          font-size: 1.25rem;
        }

        .context-info {
          display: flex;
          gap: 15px;
          flex-wrap: wrap;
          margin-bottom: 20px;
          font-size: 0.875rem;
          color: #666;
        }

        .context-info span {
          padding: 4px 8px;
          background: #f8f9fa;
          border-radius: 4px;
          border: 1px solid #e9ecef;
        }

        .transcription-controls {
          margin-bottom: 20px;
        }

        .recording-controls {
          display: flex;
          gap: 15px;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 15px;
        }

        .record-button {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          min-width: 200px;
        }

        .record-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
        }

        .record-button.recording {
          background: linear-gradient(135deg, #ff6b6b, #ee5a52);
          animation: pulse 2s infinite;
        }

        .record-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); }
        }

        .file-input {
          display: none;
        }

        .file-upload-label {
          padding: 12px 24px;
          border: 2px dashed #667eea;
          border-radius: 8px;
          background: #f8f9fa;
          color: #667eea;
          cursor: pointer;
          transition: all 0.3s ease;
          display: inline-block;
        }

        .file-upload-label:hover {
          background: #e3f2fd;
          border-color: #1976d2;
        }

        .audio-visualization {
          display: flex;
          justify-content: center;
          align-items: end;
          height: 60px;
          gap: 2px;
          margin: 15px 0;
          padding: 10px;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .audio-bar {
          width: 3px;
          background: linear-gradient(to top, #667eea, #764ba2);
          border-radius: 2px;
          transition: height 0.1s ease;
        }

        .processing-status {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 15px;
          background: #e3f2fd;
          border-radius: 8px;
          margin-bottom: 15px;
        }

        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid #e3f2fd;
          border-top: 2px solid #1976d2;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 15px;
          background: #ffe6e6;
          color: #d32f2f;
          border-radius: 8px;
          margin-bottom: 15px;
          border-left: 4px solid #d32f2f;
        }

        .transcription-result {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 15px;
          border-left: 4px solid #667eea;
        }

        .result-metadata {
          display: flex;
          gap: 15px;
          flex-wrap: wrap;
          margin-bottom: 15px;
          font-size: 0.875rem;
          color: #666;
        }

        .transcription-text {
          font-size: 1.1rem;
          line-height: 1.6;
          color: #2c3e50;
          margin-bottom: 15px;
          padding: 15px;
          background: white;
          border-radius: 6px;
          min-height: 60px;
        }

        .medical-terms {
          margin-bottom: 15px;
        }

        .medical-terms h4 {
          margin: 0 0 10px 0;
          font-size: 1rem;
          color: #2c3e50;
        }

        .terms-list {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .medical-term {
          padding: 4px 8px;
          background: #e8f5e8;
          color: #2e7d32;
          border-radius: 12px;
          font-size: 0.875rem;
          border: 1px solid #4caf50;
        }

        .translation-result {
          margin-bottom: 15px;
          padding: 15px;
          background: #fff3e0;
          border-radius: 6px;
          border-left: 4px solid #ff9800;
        }

        .translation-result h4 {
          margin: 0 0 10px 0;
          color: #ef6c00;
        }

        .translation-text {
          font-style: italic;
          color: #bf360c;
          margin-bottom: 10px;
        }

        .translation-confidence {
          font-size: 0.875rem;
          color: #666;
        }

        .result-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-primary {
          background: #667eea;
          color: white;
        }

        .btn-secondary {
          background: #6c757d;
          color: white;
        }

        .btn-outline {
          background: transparent;
          color: #6c757d;
          border: 1px solid #6c757d;
        }

        .btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .compliance-notice {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 20px;
          padding: 10px;
          background: #e8f5e8;
          color: #2e7d32;
          border-radius: 6px;
          font-size: 0.875rem;
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        @media (max-width: 768px) {
          .ottehr-voice-transcription {
            padding: 15px;
          }
          
          .recording-controls {
            flex-direction: column;
            align-items: stretch;
          }
          
          .record-button {
            min-width: auto;
          }
          
          .result-actions {
            flex-direction: column;
          }
          
          .context-info {
            flex-direction: column;
            gap: 8px;
          }
        }
      `}</style>
    </div>
  );
};

export default OttehrVoiceTranscription;