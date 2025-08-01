/**
 * @jest-environment jsdom
 */

import { WhisperTranslationService } from '../../../services/whisperTranslationService';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock as any;

// Mock navigator
const navigatorMock = {
  language: 'en-US'
};
global.navigator = navigatorMock as any;

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('WhisperTranslationService', () => {
  let service: WhisperTranslationService;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    mockFetch.mockClear();

    // Create service instance
    service = new WhisperTranslationService(
      { apiUrl: 'https://api.openai.com/v1/audio/transcriptions' },
      { 
        translationApiUrl: 'https://api.openai.com/v1/chat/completions',
        translationApiKey: 'test-api-key',
        supportedLanguages: ['en', 'es', 'fr'],
        defaultTargetLanguage: 'en'
      }
    );
  });

  describe('getCurrentLocale', () => {
    it('should get locale from localStorage', () => {
      localStorageMock.getItem.mockReturnValue('es');
      
      // Access private method via any for testing
      const locale = (service as any).getCurrentLocale();
      
      expect(locale).toBe('es');
      expect(localStorageMock.getItem).toHaveBeenCalledWith('webqx-language');
    });

    it('should fall back to browser language', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const locale = (service as any).getCurrentLocale();
      
      expect(locale).toBe('en'); // from navigator.language 'en-US'
    });

    it('should fall back to default language', () => {
      localStorageMock.getItem.mockReturnValue(null);
      navigatorMock.language = 'zh-CN'; // unsupported language
      
      const locale = (service as any).getCurrentLocale();
      
      expect(locale).toBe('en'); // default target language
    });
  });

  describe('detectLanguage', () => {
    it('should detect language using OpenAI API', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'es'
            }
          }]
        })
      };
      mockFetch.mockResolvedValue(mockResponse);

      const language = await (service as any).detectLanguage('Hola, ¿cómo estás?');

      expect(language).toBe('es');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key'
          })
        })
      );
    });

    it('should return unknown for unsupported detected language', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'zh' // unsupported language
            }
          }]
        })
      };
      mockFetch.mockResolvedValue(mockResponse);

      const language = await (service as any).detectLanguage('你好');

      expect(language).toBe('unknown');
    });

    it('should return unknown on API error', async () => {
      mockFetch.mockRejectedValue(new Error('API Error'));

      const language = await (service as any).detectLanguage('Hello world');

      expect(language).toBe('unknown');
    });

    it('should return unknown when API key not configured', async () => {
      const serviceWithoutKey = new WhisperTranslationService(
        {},
        { translationApiKey: '' }
      );

      const language = await (serviceWithoutKey as any).detectLanguage('Hello');

      expect(language).toBe('unknown');
    });
  });

  describe('translateText', () => {
    it('should translate text using OpenAI API', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'Hello, how are you?'
            }
          }]
        })
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await (service as any).translateText('Hola, ¿cómo estás?', 'es', 'en');

      expect(result.translatedText).toBe('Hello, how are you?');
      expect(result.sourceLanguage).toBe('es');
      expect(result.targetLanguage).toBe('en');
      expect(result.confidence).toBe(0.85);
      expect(result.engine).toBe('openai-gpt');
      expect(typeof result.processingTimeMs).toBe('number');
    });

    it('should return original text when source equals target language', async () => {
      const originalText = 'Hello world';
      
      const result = await (service as any).translateText(originalText, 'en', 'en');

      expect(result.translatedText).toBe(originalText);
      expect(result.sourceLanguage).toBe('en');
      expect(result.targetLanguage).toBe('en');
      expect(result.confidence).toBe(1.0);
      expect(result.engine).toBe('passthrough');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw error when API key not configured', async () => {
      const serviceWithoutKey = new WhisperTranslationService(
        {},
        { translationApiKey: '' }
      );

      await expect(
        (serviceWithoutKey as any).translateText('Hello', 'en', 'es')
      ).rejects.toThrow('Translation API key not configured');
    });

    it('should throw error on API failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      });

      await expect(
        (service as any).translateText('Hello', 'en', 'es')
      ).rejects.toThrow('Translation failed: Translation API error: 400 Bad Request');
    });
  });

  describe('translateTranscription', () => {
    it('should translate transcription with automatic language detection', async () => {
      // Mock language detection
      const mockDetectResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'es'
            }
          }]
        })
      };

      // Mock translation
      const mockTranslateResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'Hello, how are you?'
            }
          }]
        })
      };

      mockFetch
        .mockResolvedValueOnce(mockDetectResponse)  // Language detection
        .mockResolvedValueOnce(mockTranslateResponse); // Translation

      const result = await service.translateTranscription('Hola, ¿cómo estás?', 'en');

      expect(result.translatedText).toBe('Hello, how are you?');
      expect(result.sourceLanguage).toBe('es');
      expect(result.targetLanguage).toBe('en');
    });

    it('should use provided source language', async () => {
      const mockTranslateResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'Hello, how are you?'
            }
          }]
        })
      };

      mockFetch.mockResolvedValue(mockTranslateResponse);

      const result = await service.translateTranscription('Hola, ¿cómo estás?', 'en', 'es');

      expect(result.sourceLanguage).toBe('es');
      expect(result.targetLanguage).toBe('en');
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only translation, no detection
    });

    it('should use current locale as default target language', async () => {
      localStorageMock.getItem.mockReturnValue('fr');

      const mockDetectResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'en'
            }
          }]
        })
      };

      const mockTranslateResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'Bonjour, comment allez-vous?'
            }
          }]
        })
      };

      mockFetch
        .mockResolvedValueOnce(mockDetectResponse)
        .mockResolvedValueOnce(mockTranslateResponse);

      const result = await service.translateTranscription('Hello, how are you?');

      expect(result.targetLanguage).toBe('fr');
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return supported languages', () => {
      const languages = service.getSupportedLanguages();

      expect(languages).toEqual([
        { code: 'en', name: 'English', nativeName: 'English' },
        { code: 'es', name: 'Spanish', nativeName: 'Español' }
      ]);
    });
  });

  describe('isTranslationSupported', () => {
    it('should return true for supported language pair', () => {
      const isSupported = service.isTranslationSupported('en', 'es');
      expect(isSupported).toBe(true);
    });

    it('should return false for unsupported language', () => {
      const isSupported = service.isTranslationSupported('en', 'zh');
      expect(isSupported).toBe(false);
    });

    it('should return false when API key not configured', () => {
      const serviceWithoutKey = new WhisperTranslationService(
        {},
        { translationApiKey: '' }
      );

      const isSupported = serviceWithoutKey.isTranslationSupported('en', 'es');
      expect(isSupported).toBe(false);
    });
  });

  describe('getRecommendedTargetLanguage', () => {
    it('should recommend UI locale when different from detected language', () => {
      localStorageMock.getItem.mockReturnValue('es');

      const recommended = service.getRecommendedTargetLanguage('en');

      expect(recommended).toBe('es');
    });

    it('should recommend default language when UI locale same as detected', () => {
      localStorageMock.getItem.mockReturnValue('en');

      const recommended = service.getRecommendedTargetLanguage('en');

      expect(recommended).toBe('en'); // default target language
    });

    it('should recommend default language when UI locale not supported', () => {
      localStorageMock.getItem.mockReturnValue('zh');

      const recommended = service.getRecommendedTargetLanguage('en');

      expect(recommended).toBe('en'); // default target language
    });
  });

  describe('configuration management', () => {
    it('should update translation configuration', () => {
      const newConfig = {
        supportedLanguages: ['en', 'es', 'fr', 'de'],
        confidenceThreshold: 0.8
      };

      service.updateTranslationConfig(newConfig);
      const config = service.getTranslationConfig();

      expect(config.supportedLanguages).toEqual(['en', 'es', 'fr', 'de']);
      expect(config.confidenceThreshold).toBe(0.8);
    });

    it('should return current configuration', () => {
      const config = service.getTranslationConfig();

      expect(config.translationApiUrl).toBe('https://api.openai.com/v1/chat/completions');
      expect(config.translationApiKey).toBe('test-api-key');
      expect(config.supportedLanguages).toEqual(['en', 'es', 'fr']);
      expect(config.defaultTargetLanguage).toBe('en');
    });
  });
});