/**
 * @fileoverview Enhanced Whisper Translation Service
 * 
 * This service extends the existing Whisper functionality to provide
 * multilingual transcription and translation capabilities, integrating
 * with UI locale settings for telehealth sessions.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { WhisperService, WhisperResponse, WhisperError } from '../../services/whisperService';
import { supportedLanguages, defaultLanguage } from '../../patient-portal/i18n/config';

/**
 * Translation service configuration
 */
export interface TranslationConfig {
  /** Translation API URL */
  translationApiUrl?: string;
  /** Translation API key */
  translationApiKey?: string;
  /** Supported target languages */
  supportedLanguages?: string[];
  /** Default target language */
  defaultTargetLanguage?: string;
  /** Enable automatic language detection */
  enableAutoDetection?: boolean;
  /** Confidence threshold for translations */
  confidenceThreshold?: number;
}

/**
 * Translation response interface
 */
export interface TranslationResponse {
  /** Translated text */
  translatedText: string;
  /** Source language detected */
  sourceLanguage: string;
  /** Target language */
  targetLanguage: string;
  /** Translation confidence score (0-1) */
  confidence: number;
  /** Translation engine used */
  engine: string;
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Enhanced Whisper response with translations
 */
export interface EnhancedWhisperResponse extends WhisperResponse {
  /** Original transcription */
  originalText: string;
  /** Source language detected */
  detectedLanguage: string;
  /** Available translations */
  translations: { [languageCode: string]: TranslationResponse };
  /** UI locale at time of processing */
  uiLocale: string;
  /** Recommended translation based on UI locale */
  recommendedTranslation?: string;
}

/**
 * Default translation configuration
 */
const DEFAULT_TRANSLATION_CONFIG: Required<TranslationConfig> = {
  translationApiUrl: (typeof process !== 'undefined' && process.env?.TRANSLATION_API_URL) || 'https://api.openai.com/v1/chat/completions',
  translationApiKey: (typeof process !== 'undefined' && process.env?.OPENAI_API_KEY) || '',
  supportedLanguages: supportedLanguages.map(lang => lang.code),
  defaultTargetLanguage: defaultLanguage,
  enableAutoDetection: true,
  confidenceThreshold: 0.7
};

/**
 * Enhanced Whisper service with translation capabilities
 */
export class WhisperTranslationService extends WhisperService {
  private translationConfig: Required<TranslationConfig>;

  /**
   * Creates a new WhisperTranslationService instance
   * @param whisperConfig - Whisper service configuration
   * @param translationConfig - Translation configuration
   */
  constructor(
    whisperConfig?: any,
    translationConfig: TranslationConfig = {}
  ) {
    super(whisperConfig);
    this.translationConfig = { ...DEFAULT_TRANSLATION_CONFIG, ...translationConfig };
    
    // Validate translation API configuration
    if (!this.translationConfig.translationApiKey) {
      console.warn('Translation API key not configured. Translation features will be limited.');
    }
  }

  /**
   * Get current UI locale from browser or i18n config
   * @returns Current locale code
   */
  private getCurrentLocale(): string {
    // Try to get from localStorage (i18n config)
    if (typeof localStorage !== 'undefined') {
      const storedLanguage = localStorage.getItem('webqx-language');
      if (storedLanguage) {
        return storedLanguage;
      }
    }

    // Try to get from browser
    if (typeof navigator !== 'undefined') {
      const browserLang = navigator.language.split('-')[0];
      if (this.translationConfig.supportedLanguages.includes(browserLang)) {
        return browserLang;
      }
    }

    return this.translationConfig.defaultTargetLanguage;
  }

  /**
   * Detect language of text using OpenAI API
   * @param text - Text to analyze
   * @returns Promise resolving to detected language
   */
  private async detectLanguage(text: string): Promise<string> {
    if (!this.translationConfig.enableAutoDetection || !this.translationConfig.translationApiKey) {
      return 'unknown';
    }

    try {
      const response = await fetch(this.translationConfig.translationApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.translationConfig.translationApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a language detection system. Respond only with the ISO 639-1 language code (e.g., "en", "es", "fr") for the given text. If uncertain, respond with "unknown".'
            },
            {
              role: 'user',
              content: `Detect the language of this text: "${text.substring(0, 200)}"`
            }
          ],
          max_tokens: 10,
          temperature: 0
        })
      });

      if (!response.ok) {
        console.warn('Language detection failed:', response.statusText);
        return 'unknown';
      }

      const data = await response.json();
      const detectedLang = data.choices?.[0]?.message?.content?.trim().toLowerCase();
      
      // Validate detected language is supported
      if (detectedLang && this.translationConfig.supportedLanguages.includes(detectedLang)) {
        return detectedLang;
      }

      return 'unknown';
    } catch (error) {
      console.warn('Language detection error:', error);
      return 'unknown';
    }
  }

  /**
   * Translate text to target language using OpenAI API
   * @param text - Text to translate
   * @param sourceLanguage - Source language code
   * @param targetLanguage - Target language code
   * @returns Promise resolving to translation response
   */
  private async translateText(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<TranslationResponse> {
    const startTime = Date.now();

    if (!this.translationConfig.translationApiKey) {
      throw new Error('Translation API key not configured');
    }

    if (sourceLanguage === targetLanguage) {
      return {
        translatedText: text,
        sourceLanguage,
        targetLanguage,
        confidence: 1.0,
        engine: 'passthrough',
        processingTimeMs: Date.now() - startTime
      };
    }

    try {
      const languageNames: { [key: string]: string } = {
        'en': 'English',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'pt': 'Portuguese',
        'zh': 'Chinese',
        'ar': 'Arabic',
        'hi': 'Hindi',
        'ja': 'Japanese'
      };

      const sourceLangName = languageNames[sourceLanguage] || sourceLanguage;
      const targetLangName = languageNames[targetLanguage] || targetLanguage;

      const response = await fetch(this.translationConfig.translationApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.translationConfig.translationApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `You are a professional medical translator. Translate the following text from ${sourceLangName} to ${targetLangName}. Maintain medical accuracy and terminology. Respond only with the translation.`
            },
            {
              role: 'user',
              content: text
            }
          ],
          max_tokens: Math.max(text.length * 2, 500),
          temperature: 0.1
        })
      });

      if (!response.ok) {
        throw new Error(`Translation API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const translatedText = data.choices?.[0]?.message?.content?.trim();

      if (!translatedText) {
        throw new Error('Invalid translation response');
      }

      return {
        translatedText,
        sourceLanguage,
        targetLanguage,
        confidence: 0.85, // Estimated confidence for OpenAI translations
        engine: 'openai-gpt',
        processingTimeMs: Date.now() - startTime
      };
    } catch (error) {
      throw new Error(`Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Enhanced transcription with automatic translation
   * @param file - Audio file to transcribe
   * @param options - Transcription and translation options
   * @returns Promise resolving to enhanced transcription result
   */
  public async transcribeAndTranslate(
    file: File,
    options: {
      language?: string;
      prompt?: string;
      temperature?: number;
      targetLanguages?: string[];
      forceTranslation?: boolean;
    } = {}
  ): Promise<EnhancedWhisperResponse> {
    try {
      // Get current UI locale
      const uiLocale = this.getCurrentLocale();

      // Perform original transcription
      const whisperResult = await this.transcribeAudio(file, {
        language: options.language,
        prompt: options.prompt,
        temperature: options.temperature
      });

      // Detect language of transcribed text
      const detectedLanguage = options.language || await this.detectLanguage(whisperResult.text);

      // Determine target languages for translation
      let targetLanguages = options.targetLanguages || [];
      
      // If no target languages specified, use UI locale if different from detected language
      if (targetLanguages.length === 0) {
        if (detectedLanguage !== uiLocale || options.forceTranslation) {
          targetLanguages = [uiLocale];
        }
      }

      // Add default language if not already included
      if (!targetLanguages.includes(this.translationConfig.defaultTargetLanguage)) {
        targetLanguages.push(this.translationConfig.defaultTargetLanguage);
      }

      // Remove duplicates and filter out source language unless forced
      targetLanguages = [...new Set(targetLanguages)];
      if (!options.forceTranslation) {
        targetLanguages = targetLanguages.filter(lang => lang !== detectedLanguage);
      }

      // Perform translations
      const translations: { [languageCode: string]: TranslationResponse } = {};
      
      for (const targetLang of targetLanguages) {
        try {
          const translation = await this.translateText(
            whisperResult.text,
            detectedLanguage,
            targetLang
          );
          
          // Only include translations that meet confidence threshold
          if (translation.confidence >= this.translationConfig.confidenceThreshold) {
            translations[targetLang] = translation;
          }
        } catch (error) {
          console.warn(`Translation to ${targetLang} failed:`, error);
          // Continue with other translations
        }
      }

      // Determine recommended translation based on UI locale
      const recommendedTranslation = translations[uiLocale]?.translatedText;

      const enhancedResult: EnhancedWhisperResponse = {
        ...whisperResult,
        originalText: whisperResult.text,
        detectedLanguage,
        translations,
        uiLocale,
        recommendedTranslation,
        // Update main text to recommended translation if available and different
        text: recommendedTranslation && recommendedTranslation !== whisperResult.text 
          ? recommendedTranslation 
          : whisperResult.text
      };

      return enhancedResult;
    } catch (error) {
      const whisperError: WhisperError = {
        message: `Enhanced transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: 'ENHANCED_TRANSCRIPTION_ERROR',
        details: error
      };
      throw whisperError;
    }
  }

  /**
   * Translate existing transcription text
   * @param text - Text to translate
   * @param targetLanguage - Target language code
   * @param sourceLanguage - Optional source language (will be detected if not provided)
   * @returns Promise resolving to translation result
   */
  public async translateTranscription(
    text: string,
    targetLanguage?: string,
    sourceLanguage?: string
  ): Promise<TranslationResponse> {
    const actualTargetLanguage = targetLanguage || this.getCurrentLocale();
    const actualSourceLanguage = sourceLanguage || await this.detectLanguage(text);

    return this.translateText(text, actualSourceLanguage, actualTargetLanguage);
  }

  /**
   * Get supported languages with their native names
   * @returns Array of supported language information
   */
  public getSupportedLanguages(): Array<{ code: string; name: string; nativeName: string }> {
    return supportedLanguages.filter(lang => 
      this.translationConfig.supportedLanguages.includes(lang.code)
    );
  }

  /**
   * Update translation configuration
   * @param newConfig - Configuration updates
   */
  public updateTranslationConfig(newConfig: Partial<TranslationConfig>): void {
    this.translationConfig = { ...this.translationConfig, ...newConfig };
  }

  /**
   * Get current translation configuration
   * @returns Current translation configuration
   */
  public getTranslationConfig(): Required<TranslationConfig> {
    return { ...this.translationConfig };
  }

  /**
   * Check if translation is available for a language pair
   * @param sourceLanguage - Source language code
   * @param targetLanguage - Target language code
   * @returns Whether translation is supported
   */
  public isTranslationSupported(sourceLanguage: string, targetLanguage: string): boolean {
    return this.translationConfig.supportedLanguages.includes(sourceLanguage) &&
           this.translationConfig.supportedLanguages.includes(targetLanguage) &&
           !!this.translationConfig.translationApiKey;
  }

  /**
   * Get recommended target language based on UI locale
   * @param detectedLanguage - Detected source language
   * @returns Recommended target language
   */
  public getRecommendedTargetLanguage(detectedLanguage: string): string {
    const uiLocale = this.getCurrentLocale();
    
    // If detected language is different from UI locale, recommend UI locale
    if (detectedLanguage !== uiLocale && this.translationConfig.supportedLanguages.includes(uiLocale)) {
      return uiLocale;
    }

    // Otherwise, recommend default target language
    return this.translationConfig.defaultTargetLanguage;
  }
}

/**
 * Default WhisperTranslationService instance for easy importing
 */
export const whisperTranslationService = new WhisperTranslationService();

/**
 * Convenience function for transcription with automatic translation
 * @param file - Audio file to transcribe
 * @param options - Transcription and translation options
 * @returns Promise resolving to enhanced transcription result
 */
export async function transcribeAndTranslateAudio(
  file: File,
  options: {
    language?: string;
    targetLanguages?: string[];
    forceTranslation?: boolean;
  } = {}
): Promise<EnhancedWhisperResponse> {
  return whisperTranslationService.transcribeAndTranslate(file, options);
}

/**
 * Convenience function for translating existing text
 * @param text - Text to translate
 * @param targetLanguage - Target language (defaults to current UI locale)
 * @returns Promise resolving to translation result
 */
export async function translateText(
  text: string,
  targetLanguage?: string
): Promise<TranslationResponse> {
  return whisperTranslationService.translateTranscription(text, targetLanguage);
}

export default whisperTranslationService;