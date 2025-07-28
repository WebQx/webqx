/**
 * API Utilities for WebQX Patient Portal
 * 
 * This module contains utility functions for making API calls
 * with proper error handling, type safety, and validation.
 */

/**
 * Configuration for API endpoints
 */
const API_CONFIG = {
  baseUrl: process.env.REACT_APP_API_BASE_URL || '',
  endpoints: {
    whisperTranslate: '/api/whisper/translate'
  }
};

/**
 * Interface for translation request parameters
 */
export interface TranslationRequest {
  /** Text to be translated */
  text: string;
  /** Target language code (e.g., 'en', 'es', 'fr') */
  targetLang: string;
}

/**
 * Interface for translation response
 */
export interface TranslationResponse {
  /** Translated text */
  translatedText: string;
  /** Source language detected */
  sourceLanguage?: string;
  /** Target language used */
  targetLanguage: string;
  /** Confidence score (0-1) */
  confidence?: number;
}

/**
 * Interface for API error response
 */
export interface ApiError {
  /** Error message */
  message: string;
  /** Error code */
  code?: string;
  /** HTTP status code */
  status?: number;
}

/**
 * Custom error class for API errors
 */
export class TranslationError extends Error {
  public readonly code?: string;
  public readonly status?: number;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = 'TranslationError';
    this.code = code;
    this.status = status;
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TranslationError);
    }
    
    // Set the prototype explicitly to ensure instanceof works correctly
    Object.setPrototypeOf(this, TranslationError.prototype);
  }
}

/**
 * Validates input parameters for translation request
 * @param text - Text to validate
 * @param targetLang - Target language to validate
 * @throws {TranslationError} When validation fails
 */
function validateTranslationInput(text: string, targetLang: string): void {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new TranslationError('Text parameter is required and must be a non-empty string', 'INVALID_TEXT');
  }

  if (!targetLang || typeof targetLang !== 'string' || targetLang.trim().length === 0) {
    throw new TranslationError('Target language parameter is required and must be a non-empty string', 'INVALID_TARGET_LANG');
  }

  // Basic language code validation (2-3 character codes)
  const langCodePattern = /^[a-z]{2,3}(-[A-Z]{2})?$/;
  if (!langCodePattern.test(targetLang.trim())) {
    throw new TranslationError('Target language must be a valid language code (e.g., "en", "es", "fr")', 'INVALID_LANG_CODE');
  }
}

/**
 * Translates medication information using the Whisper API
 * 
 * This function sends a POST request to the /api/whisper/translate endpoint
 * to translate medication-related text from one language to another.
 * 
 * @param text - The medication information text to translate
 * @param targetLang - The target language code (e.g., 'en', 'es', 'fr')
 * @returns Promise that resolves to the translation response
 * @throws {TranslationError} When validation fails or API request fails
 * 
 * @example
 * ```typescript
 * try {
 *   const result = await translateMedicationInfo('Take 2 tablets daily', 'es');
 *   console.log(result.translatedText); // "Tomar 2 tabletas al día"
 * } catch (error) {
 *   if (error instanceof TranslationError) {
 *     console.error('Translation error:', error.message);
 *   }
 * }
 * ```
 */
export async function translateMedicationInfo(
  text: string,
  targetLang: string
): Promise<TranslationResponse> {
  // Validate input parameters
  validateTranslationInput(text, targetLang);

  // Prepare request data
  const requestData: TranslationRequest = {
    text: text.trim(),
    targetLang: targetLang.trim().toLowerCase()
  };

  // Construct full URL
  const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.whisperTranslate}`;

  try {
    // Make the API request
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestData)
    });

    // Check if response is ok
    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      let errorCode = 'HTTP_ERROR';

      // Try to extract error details from response
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        }
        if (errorData.code) {
          errorCode = errorData.code;
        }
      } catch {
        // If we can't parse error response, use default message
      }

      throw new TranslationError(errorMessage, errorCode, response.status);
    }

    // Parse and validate response
    let responseData: any;
    try {
      responseData = await response.json();
    } catch (error) {
      throw new TranslationError('Invalid JSON response from server', 'INVALID_RESPONSE');
    }

    // Validate response structure
    if (!responseData || typeof responseData !== 'object') {
      throw new TranslationError('Invalid response format from server', 'INVALID_RESPONSE_FORMAT');
    }

    if (!responseData.translatedText || typeof responseData.translatedText !== 'string') {
      throw new TranslationError('Missing or invalid translated text in response', 'MISSING_TRANSLATED_TEXT');
    }

    // Return properly typed response
    const translationResponse: TranslationResponse = {
      translatedText: responseData.translatedText,
      sourceLanguage: responseData.sourceLanguage,
      targetLanguage: responseData.targetLanguage || targetLang,
      confidence: responseData.confidence
    };

    return translationResponse;

  } catch (error) {
    // Re-throw TranslationError as-is
    if (error instanceof TranslationError) {
      throw error;
    }

    // Handle network errors and other fetch errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new TranslationError('Network error: Unable to connect to translation service', 'NETWORK_ERROR');
    }

    // Handle other unexpected errors
    throw new TranslationError(
      `Unexpected error during translation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'UNEXPECTED_ERROR'
    );
  }
}

/**
 * Configuration helper to set the API base URL
 * Useful for testing or different environments
 * 
 * @param baseUrl - The base URL for API requests
 */
export function setApiBaseUrl(baseUrl: string): void {
  API_CONFIG.baseUrl = baseUrl;
}

/**
 * Get current API configuration
 * @returns Current API configuration object
 */
export function getApiConfig() {
  return { ...API_CONFIG };
}