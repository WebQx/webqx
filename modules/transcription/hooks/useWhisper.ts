import { useState, useCallback } from 'react';
import { TranscriptionOptions, UseWhisperReturn } from '../types';

/**
 * Hook for voice transcription using Whisper
 * Provides a simple interface for recording and transcribing audio
 */
export const useWhisper = (language: string = "en"): UseWhisperReturn => {
  const [transcript, setTranscript] = useState<string>("");
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const startRecording = useCallback(() => {
    setError(null);
    setIsRecording(true);
    
    // Simulate recording functionality
    // In a real implementation, this would interact with the browser's MediaRecorder API
    // and the whisper service from /services/whisperService.ts
    
    // For demonstration, we'll simulate a transcript after 3 seconds
    setTimeout(() => {
      setTranscript("Patient reports chest pain and shortness of breath. Symptoms started this morning.");
      setIsRecording(false);
    }, 3000);
  }, []);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
  }, []);

  return {
    startRecording,
    stopRecording,
    transcript,
    isRecording,
    error
  };
};