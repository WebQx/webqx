/**
 * @fileoverview Clinical Voice Transcription Component
 * 
 * React component for voice transcription in clinical contexts within OpenEMR workflows.
 * Provides healthcare providers with an intuitive interface for recording and transcribing
 * clinical notes, patient interactions, and medical documentation.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { WhisperOpenEMRIntegration, ClinicalTranscriptionContext, ClinicalTranscriptionResult } from '../services/whisperIntegration';

export interface ClinicalVoiceTranscriptionProps {
  /** Patient ID for the current clinical session */
  patientId: string;
  /** Encounter ID (optional) */
  encounterId?: string;
  /** Provider ID */
  providerId: string;
  /** Type of clinical transcription */
  transcriptionType: 'encounter_note' | 'history' | 'assessment' | 'plan' | 'medication_note' | 'general';
  /** Integration service instance */
  integrationService: WhisperOpenEMRIntegration;
  /** Additional clinical context */
  clinicalContext?: string;
  /** Callback when transcription is completed */
  onTranscriptionComplete?: (result: ClinicalTranscriptionResult) => void;
  /** Callback for errors */
  onError?: (error: Error) => void;
  /** Enable real-time streaming transcription */
  enableStreaming?: boolean;
  /** Custom styling classes */
  className?: string;
}

export const ClinicalVoiceTranscription: React.FC<ClinicalVoiceTranscriptionProps> = ({
  patientId,
  encounterId,
  providerId,
  transcriptionType,
  integrationService,
  clinicalContext,
  onTranscriptionComplete,
  onError,
  enableStreaming = true,
  className = ''
}) => {
  // State management
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTranscription, setCurrentTranscription] = useState('');
  const [finalTranscription, setFinalTranscription] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [error, setError] = useState<string>('');

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Clinical context for transcription
  const clinicalContextData: ClinicalTranscriptionContext = {
    patientId,
    encounterId,
    providerId,
    transcriptionType,
    clinicalContext
  };

  // Initialize audio level monitoring
  const initializeAudioLevel = useCallback(async (stream: MediaStream) => {
    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      
      const microphone = audioContextRef.current.createMediaStreamSource(stream);
      microphone.connect(analyserRef.current);
      
      analyserRef.current.fftSize = 256;
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      
      const updateAudioLevel = () => {
        if (analyserRef.current && isRecording) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
          setAudioLevel(average / 255);
          animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
        }
      };
      
      updateAudioLevel();
    } catch (error) {
      console.warn('Audio level monitoring not available:', error);
    }
  }, [isRecording]);

  // Start recording
  const startRecording = async () => {
    try {
      setError('');
      setCurrentTranscription('');
      setFinalTranscription('');
      setRecordingDuration(0);

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        }
      });

      // Initialize audio level monitoring
      await initializeAudioLevel(stream);

      // Set up MediaRecorder for file-based transcription
      if (!enableStreaming) {
        mediaRecorderRef.current = new MediaRecorder(stream, {
          mimeType: 'audio/webm'
        });

        audioChunksRef.current = [];
        
        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorderRef.current.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          await processAudioFile(audioBlob);
        };

        mediaRecorderRef.current.start();
      } else {
        // Start streaming transcription
        await integrationService.startStreamingTranscription(clinicalContextData, {
          onTranscription: (text, isFinal) => {
            if (isFinal) {
              setFinalTranscription(prev => prev + ' ' + text);
              setCurrentTranscription('');
            } else {
              setCurrentTranscription(text);
            }
          },
          onError: (streamError) => {
            setError(streamError.message);
            onError?.(streamError);
          },
          onStateChange: (recording) => {
            setIsRecording(recording);
          }
        });
      }

      setIsRecording(true);

      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';
      setError(errorMessage);
      onError?.(error as Error);
    }
  };

  // Stop recording
  const stopRecording = async () => {
    setIsRecording(false);

    // Clear duration timer
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Stop audio level monitoring
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (enableStreaming) {
      await integrationService.stopStreamingTranscription();
    } else if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }

    // Stop media stream
    const stream = mediaRecorderRef.current?.stream;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  // Process recorded audio file
  const processAudioFile = async (audioBlob: Blob) => {
    setIsProcessing(true);
    setError('');

    try {
      // Convert blob to file
      const audioFile = new File([audioBlob], 'clinical_recording.webm', {
        type: 'audio/webm'
      });

      // Transcribe using the integration service
      const result = await integrationService.transcribeClinicalAudio(audioFile, clinicalContextData);
      
      setFinalTranscription(result.text);
      onTranscriptionComplete?.(result);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transcription failed';
      setError(errorMessage);
      onError?.(error as Error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Format recording duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get transcription type display name
  const getTranscriptionTypeDisplayName = (type: string): string => {
    const names = {
      encounter_note: 'Encounter Note',
      history: 'Patient History',
      assessment: 'Clinical Assessment',
      plan: 'Treatment Plan',
      medication_note: 'Medication Note',
      general: 'General Note'
    };
    return names[type as keyof typeof names] || 'Clinical Note';
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <div className={`clinical-voice-transcription ${className}`}>
      {/* Header */}
      <div className="transcription-header">
        <h3 className="transcription-title">
          🎤 Voice Transcription: {getTranscriptionTypeDisplayName(transcriptionType)}
        </h3>
        <div className="patient-info">
          Patient ID: {patientId}
          {encounterId && <span> | Encounter: {encounterId}</span>}
        </div>
      </div>

      {/* Recording Controls */}
      <div className="recording-controls">
        <div className="control-section">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            className={`record-button ${isRecording ? 'recording' : ''} ${isProcessing ? 'processing' : ''}`}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          >
            {isProcessing ? (
              <div className="processing-spinner">⏳</div>
            ) : isRecording ? (
              <div className="stop-icon">⏹️</div>
            ) : (
              <div className="record-icon">🎤</div>
            )}
            <span className="button-text">
              {isProcessing ? 'Processing...' : isRecording ? 'Stop Recording' : 'Start Recording'}
            </span>
          </button>

          {isRecording && (
            <div className="recording-status">
              <div className="duration">
                Duration: {formatDuration(recordingDuration)}
              </div>
              <div className="audio-level-container">
                <div className="audio-level-label">Audio Level:</div>
                <div className="audio-level-bar">
                  <div 
                    className="audio-level-fill"
                    style={{ width: `${audioLevel * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mode indicator */}
        <div className="mode-indicator">
          Mode: {enableStreaming ? 'Real-time Streaming' : 'File Upload'}
        </div>
      </div>

      {/* Transcription Display */}
      <div className="transcription-display">
        {enableStreaming && currentTranscription && (
          <div className="current-transcription">
            <div className="transcription-label">Current (Live):</div>
            <div className="transcription-text interim">{currentTranscription}</div>
          </div>
        )}

        {finalTranscription && (
          <div className="final-transcription">
            <div className="transcription-label">
              {enableStreaming ? 'Transcribed Text:' : 'Final Transcription:'}
            </div>
            <div className="transcription-text final">{finalTranscription}</div>
          </div>
        )}

        {!finalTranscription && !currentTranscription && !isRecording && !isProcessing && (
          <div className="transcription-placeholder">
            Click "Start Recording" to begin voice transcription for clinical documentation.
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message">
          <div className="error-icon">⚠️</div>
          <div className="error-text">{error}</div>
        </div>
      )}

      {/* Clinical Context Info */}
      {clinicalContext && (
        <div className="clinical-context">
          <div className="context-label">Clinical Context:</div>
          <div className="context-text">{clinicalContext}</div>
        </div>
      )}

      {/* Accessibility Information */}
      <div className="accessibility-info" aria-live="polite" style={{ position: 'absolute', left: '-10000px', width: '1px', height: '1px', overflow: 'hidden' }}>
        {isRecording && 'Recording in progress'}
        {isProcessing && 'Processing transcription'}
        {finalTranscription && 'Transcription completed'}
        {error && `Error: ${error}`}
      </div>
    </div>
  );
};

export default ClinicalVoiceTranscription;