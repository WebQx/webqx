/**
 * Types for transcription functionality
 */

export interface TranscriptionOptions {
  language: string;
  model?: string;
}

export interface UseWhisperReturn {
  startRecording: () => void;
  stopRecording: () => void;
  transcript: string;
  isRecording: boolean;
  error: string | null;
}