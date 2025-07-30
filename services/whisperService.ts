/**
 * @fileoverview Whisper Speech-to-Text Service
 * 
 * This service provides functionality for transcribing audio files using the Whisper API.
 * It includes comprehensive error handling, file validation, timeout management,
 * and loading state tracking for a robust user experience.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

/**
 * Configuration interface for the Whisper service
 */
export interface WhisperConfig {
  /** API base URL (defaults to environment variable) */
  apiUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Maximum file size in bytes (default: 25MB) */
  maxFileSize?: number;
  /** Allowed file types for transcription */
  allowedFileTypes?: string[];
}

/**
 * Response interface for successful transcription
 */
export interface WhisperResponse {
  /** Transcribed text */
  text: string;
  /** Processing duration in seconds */
  duration?: number;
  /** Language detected */
  language?: string;
  /** Confidence score (0-1) */
  confidence?: number;
}

/**
 * Error interface for detailed error information
 */
export interface WhisperError {
  /** Error message */
  message: string;
  /** Error code */
  code: string;
  /** Additional error details */
  details?: any;
}

/**
 * Loading state interface
 */
export interface LoadingState {
  /** Whether transcription is in progress */
  isLoading: boolean;
  /** Current progress message */
  message?: string;
  /** Progress percentage (0-100) */
  progress?: number;
}

/**
 * File validation result interface
 */
export interface ValidationResult {
  /** Whether the file is valid */
  isValid: boolean;
  /** Error message if invalid */
  error?: string;
}

/**
 * Default configuration for the Whisper service
 */
const DEFAULT_CONFIG: Required<WhisperConfig> = {
  apiUrl: (typeof process !== 'undefined' && process.env?.WHISPER_API_URL) || 'https://api.openai.com/v1/audio/transcriptions',
  timeout: 30000, // 30 seconds
  maxFileSize: 25 * 1024 * 1024, // 25MB
  allowedFileTypes: [
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/webm',
    'audio/ogg',
    'audio/flac',
    'audio/m4a',
    'audio/x-m4a'
  ]
};

/**
 * WhisperService class provides comprehensive audio transcription functionality
 * with robust error handling, file validation, and loading state management.
 */
export class WhisperService {
  private config: Required<WhisperConfig>;
  private loadingState: LoadingState = { isLoading: false };
  private loadingCallbacks: Set<(state: LoadingState) => void> = new Set();

  /**
   * Creates a new WhisperService instance
   * @param config - Optional configuration overrides
   */
  constructor(config: WhisperConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Validate API URL is configured
    if (!this.config.apiUrl) {
      throw new Error('Whisper API URL must be configured via WHISPER_API_URL environment variable or config');
    }
  }

  /**
   * Validates a file before transcription
   * @param file - The file to validate
   * @returns Validation result with error details if invalid
   */
  public validateFile(file: File): ValidationResult {
    // Check if file exists
    if (!file) {
      return {
        isValid: false,
        error: 'No file provided for validation'
      };
    }

    // Check file size
    if (file.size > this.config.maxFileSize) {
      const maxSizeMB = Math.round(this.config.maxFileSize / (1024 * 1024));
      return {
        isValid: false,
        error: `File size exceeds maximum limit of ${maxSizeMB}MB. Current size: ${Math.round(file.size / (1024 * 1024))}MB`
      };
    }

    // Check file type
    if (this.config.allowedFileTypes.indexOf(file.type) === -1) {
      return {
        isValid: false,
        error: `Unsupported file type: ${file.type}. Supported types: ${this.config.allowedFileTypes.join(', ')}`
      };
    }

    // Check if file is empty
    if (file.size === 0) {
      return {
        isValid: false,
        error: 'File appears to be empty'
      };
    }

    return { isValid: true };
  }

  /**
   * Subscribes to loading state changes
   * @param callback - Function to call when loading state changes
   * @returns Unsubscribe function
   */
  public onLoadingStateChange(callback: (state: LoadingState) => void): () => void {
    this.loadingCallbacks.add(callback);
    // Return unsubscribe function
    return () => {
      this.loadingCallbacks.delete(callback);
    };
  }

  /**
   * Gets current loading state
   * @returns Current loading state
   */
  public getLoadingState(): LoadingState {
    return { ...this.loadingState };
  }

  /**
   * Updates loading state and notifies subscribers
   * @param state - New loading state
   */
  private updateLoadingState(state: Partial<LoadingState>): void {
    this.loadingState = { ...this.loadingState, ...state };
    this.loadingCallbacks.forEach(callback => {
      try {
        callback(this.loadingState);
      } catch (error) {
        console.error('Error in loading state callback:', error);
      }
    });
  }

  /**
   * Transcribes an audio file using the Whisper API
   * @param file - Audio file to transcribe
   * @param options - Additional options for transcription
   * @returns Promise resolving to transcription result
   * @throws WhisperError on validation or API errors
   */
  public async transcribeAudio(
    file: File,
    options: {
      language?: string;
      prompt?: string;
      temperature?: number;
    } = {}
  ): Promise<WhisperResponse> {
    // Validate file first
    const validation = this.validateFile(file);
    if (!validation.isValid) {
      const error: WhisperError = {
        message: validation.error || 'File validation failed',
        code: 'VALIDATION_ERROR'
      };
      throw error;
    }

    // Create AbortController for timeout handling
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, this.config.timeout);

    try {
      // Update loading state
      this.updateLoadingState({
        isLoading: true,
        message: 'Preparing file for transcription...',
        progress: 10
      });

      // Prepare form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('model', 'whisper-1');

      // Add optional parameters
      if (options.language) {
        formData.append('language', options.language);
      }
      if (options.prompt) {
        formData.append('prompt', options.prompt);
      }
      if (options.temperature !== undefined) {
        formData.append('temperature', options.temperature.toString());
      }

      this.updateLoadingState({
        message: 'Uploading file to transcription service...',
        progress: 30
      });

      // Get API key from environment
      const apiKey = (typeof process !== 'undefined' && process.env?.WHISPER_API_KEY) || '';
      if (!apiKey) {
        throw new Error('WHISPER_API_KEY environment variable is required');
      }

      this.updateLoadingState({
        message: 'Processing audio transcription...',
        progress: 60
      });

      // Make API request
      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
        signal: abortController.signal
      });

      this.updateLoadingState({
        message: 'Finalizing transcription...',
        progress: 90
      });

      // Clear timeout since request completed
      clearTimeout(timeoutId);

      // Handle HTTP errors
      if (!response.ok) {
        let errorMessage = `HTTP Error: ${response.status} ${response.statusText}`;
        let errorCode = 'HTTP_ERROR';
        let errorDetails: any = {};

        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error.message || errorMessage;
            errorCode = errorData.error.code || errorCode;
            errorDetails = errorData.error;
          }
        } catch (parseError) {
          // If we can't parse error response, use default message
          console.warn('Could not parse error response:', parseError);
        }

        const error: WhisperError = {
          message: errorMessage,
          code: errorCode,
          details: errorDetails
        };
        throw error;
      }

      // Parse successful response
      const data = await response.json();

      // Validate response structure
      if (!data.text) {
        const error: WhisperError = {
          message: 'Invalid response from Whisper API: missing transcription text',
          code: 'INVALID_RESPONSE',
          details: data
        };
        throw error;
      }

      this.updateLoadingState({
        message: 'Transcription completed successfully',
        progress: 100
      });

      // Prepare response
      const result: WhisperResponse = {
        text: data.text,
        duration: data.duration,
        language: data.language,
        confidence: data.confidence
      };

      // Reset loading state after a brief delay
      setTimeout(() => {
        this.updateLoadingState({
          isLoading: false,
          message: undefined,
          progress: undefined
        });
      }, 1000);

      return result;

    } catch (error) {
      // Clear timeout
      clearTimeout(timeoutId);

      // Reset loading state
      this.updateLoadingState({
        isLoading: false,
        message: undefined,
        progress: undefined
      });

      // Handle different error types
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          const timeoutError: WhisperError = {
            message: `Request timed out after ${this.config.timeout / 1000} seconds`,
            code: 'TIMEOUT_ERROR'
          };
          throw timeoutError;
        }

        if (error.message.includes('WHISPER_API_KEY')) {
          const configError: WhisperError = {
            message: 'Whisper API key is not configured. Please set WHISPER_API_KEY environment variable.',
            code: 'CONFIG_ERROR'
          };
          throw configError;
        }

        // Network or other errors
        const networkError: WhisperError = {
          message: `Network error: ${error.message}`,
          code: 'NETWORK_ERROR',
          details: error
        };
        throw networkError;
      }

      // Re-throw WhisperError instances
      if (error && typeof error === 'object' && 'code' in error) {
        throw error;
      }

      // Unknown error
      const unknownError: WhisperError = {
        message: 'An unknown error occurred during transcription',
        code: 'UNKNOWN_ERROR',
        details: error
      };
      throw unknownError;
    }
  }

  /**
   * Updates the service configuration
   * @param newConfig - Configuration updates
   */
  public updateConfig(newConfig: Partial<WhisperConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Gets the current service configuration
   * @returns Current configuration
   */
  public getConfig(): Required<WhisperConfig> {
    return { ...this.config };
  }
}

/**
 * Default WhisperService instance for easy importing
 */
export const whisperService = new WhisperService();

/**
 * Convenience function for quick transcription without instantiating the service
 * @param file - Audio file to transcribe
 * @param options - Transcription options
 * @returns Promise resolving to transcription result
 */
export async function transcribeAudio(
  file: File,
  options?: {
    language?: string;
    prompt?: string;
    temperature?: number;
  }
): Promise<WhisperResponse> {
  return whisperService.transcribeAudio(file, options);
}

/**
 * Convenience function for file validation
 * @param file - File to validate
 * @returns Validation result
 */
export function validateAudioFile(file: File): ValidationResult {
  return whisperService.validateFile(file);
}

export default whisperService;