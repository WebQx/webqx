/**
 * WhisperTranslator Service for real-time translations
 * Provides multi-language support for the prescription system
 */

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
}

export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
  rtl: boolean;
}

export interface TranslationError {
  code: string;
  message: string;
  retryable: boolean;
}

class WhisperTranslator {
  private readonly apiUrl = '/api/translate'; // Internal API endpoint
  private cache = new Map<string, TranslationResult>();
  private readonly cacheTimeout = 10 * 60 * 1000; // 10 minutes

  // Supported languages for medical translations
  private readonly supportedLanguages: SupportedLanguage[] = [
    { code: 'en', name: 'English', nativeName: 'English', rtl: false },
    { code: 'es', name: 'Spanish', nativeName: 'Español', rtl: false },
    { code: 'fr', name: 'French', nativeName: 'Français', rtl: false },
    { code: 'de', name: 'German', nativeName: 'Deutsch', rtl: false },
    { code: 'it', name: 'Italian', nativeName: 'Italiano', rtl: false },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português', rtl: false },
    { code: 'zh', name: 'Chinese', nativeName: '中文', rtl: false },
    { code: 'ja', name: 'Japanese', nativeName: '日本語', rtl: false },
    { code: 'ko', name: 'Korean', nativeName: '한국어', rtl: false },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', rtl: true },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', rtl: false },
    { code: 'ru', name: 'Russian', nativeName: 'Русский', rtl: false }
  ];

  /**
   * Get all supported languages
   */
  getSupportedLanguages(): SupportedLanguage[] {
    return [...this.supportedLanguages];
  }

  /**
   * Get language by code
   */
  getLanguageByCode(code: string): SupportedLanguage | null {
    return this.supportedLanguages.find(lang => lang.code === code) || null;
  }

  /**
   * Generate cache key for translation
   */
  private getCacheKey(text: string, sourceLanguage: string, targetLanguage: string): string {
    return `${sourceLanguage}_${targetLanguage}_${text.slice(0, 50)}`;
  }

  /**
   * Implement retry logic for translation API calls
   */
  private async translateWithRetry(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    maxRetries = 3
  ): Promise<TranslationResult> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Mock translation implementation
        // In production, this would call actual translation service
        const mockTranslation = await this.mockTranslate(text, sourceLanguage, targetLanguage);
        return mockTranslation;
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries) {
          console.warn(`Translation attempt ${attempt} failed, retrying...`);
          await this.delay(Math.pow(2, attempt) * 1000); // Exponential backoff
        }
      }
    }
    
    throw new Error(`Translation failed after ${maxRetries} attempts: ${lastError!.message}`);
  }

  /**
   * Mock translation service (replace with actual service in production)
   */
  private async mockTranslate(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<TranslationResult> {
    // Simulate API delay
    await this.delay(200 + Math.random() * 300);
    
    // Mock translation mappings for common medical terms
    const mockTranslations: { [key: string]: { [key: string]: { [key: string]: string } } } = {
      'en': {
        'es': {
          'prescription': 'prescripción',
          'medication': 'medicamento',
          'dosage': 'dosificación',
          'side effects': 'efectos secundarios',
          'take with food': 'tomar con comida',
          'twice daily': 'dos veces al día'
        },
        'fr': {
          'prescription': 'ordonnance',
          'medication': 'médicament',
          'dosage': 'posologie',
          'side effects': 'effets secondaires',
          'take with food': 'prendre avec de la nourriture',
          'twice daily': 'deux fois par jour'
        }
      }
    };

    let translatedText = text;
    
    // Simple mock translation logic
    if (sourceLanguage !== targetLanguage) {
      const translations = mockTranslations[sourceLanguage]?.[targetLanguage];
      if (translations) {
        Object.keys(translations).forEach(key => {
          translatedText = translatedText.replace(
            new RegExp(key, 'gi'),
            translations[key]
          );
        });
      } else {
        // Fallback: add language prefix to indicate translation
        translatedText = `[${targetLanguage.toUpperCase()}] ${text}`;
      }
    }

    return {
      originalText: text,
      translatedText,
      sourceLanguage,
      targetLanguage,
      confidence: 0.85 + Math.random() * 0.15 // Mock confidence score
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Translate text with caching
   */
  async translate(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<TranslationResult> {
    if (!text.trim()) {
      throw new Error('Text cannot be empty');
    }

    if (sourceLanguage === targetLanguage) {
      return {
        originalText: text,
        translatedText: text,
        sourceLanguage,
        targetLanguage,
        confidence: 1.0
      };
    }

    const cacheKey = this.getCacheKey(text, sourceLanguage, targetLanguage);
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - this.getCacheTimestamp(cacheKey) < this.cacheTimeout) {
      return cached;
    }

    try {
      const result = await this.translateWithRetry(text, sourceLanguage, targetLanguage);
      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Translation error:', error);
      throw new Error(`Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Translate multiple texts in batch
   */
  async translateBatch(
    texts: string[],
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<TranslationResult[]> {
    try {
      const promises = texts.map(text => 
        this.translate(text, sourceLanguage, targetLanguage)
      );
      
      return await Promise.all(promises);
    } catch (error) {
      console.error('Batch translation error:', error);
      throw new Error(`Batch translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect language of text
   */
  async detectLanguage(text: string): Promise<{ language: string; confidence: number }> {
    // Mock language detection
    await this.delay(100);
    
    // Simple heuristic for common languages
    const patterns: { [key: string]: RegExp } = {
      'es': /\b(el|la|los|las|de|y|en|un|es|se|no|te|lo|le|da|su|por|son|con|para|una|tienen|él|del|las)\b/gi,
      'fr': /\b(le|la|les|de|et|en|un|est|se|ne|te|le|lui|du|des|les|pour|une|ont|il|du|aux)\b/gi,
      'de': /\b(der|die|das|und|in|den|von|zu|mit|sich|auf|für|als|sie|wird|dem|ein|einer|einem)\b/gi,
      'ar': /[\u0600-\u06FF]/,
      'zh': /[\u4e00-\u9fff]/,
      'ja': /[\u3040-\u309f\u30a0-\u30ff]/,
      'ko': /[\uac00-\ud7af]/,
      'ru': /[\u0400-\u04FF]/
    };

    for (const [lang, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) {
        return { language: lang, confidence: 0.8 };
      }
    }

    return { language: 'en', confidence: 0.6 }; // Default to English
  }

  /**
   * Get cache timestamp (mock implementation)
   */
  private getCacheTimestamp(key: string): number {
    // In a real implementation, you'd store timestamps with cache entries
    return Date.now() - Math.random() * this.cacheTimeout;
  }

  /**
   * Clear translation cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; languages: string[] } {
    const languages = new Set<string>();
    this.cache.forEach((value) => {
      languages.add(value.sourceLanguage);
      languages.add(value.targetLanguage);
    });
    
    return {
      size: this.cache.size,
      languages: Array.from(languages)
    };
  }

  /**
   * Validate language code
   */
  isLanguageSupported(languageCode: string): boolean {
    return this.supportedLanguages.some(lang => lang.code === languageCode);
  }
}

export const whisperTranslator = new WhisperTranslator();
export default whisperTranslator;