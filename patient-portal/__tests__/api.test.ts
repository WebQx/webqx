/*
 * Copyright (c) 2025 WebQx. All rights reserved.
 * Unauthorized copying of this file, via any medium, is strictly prohibited.
 * Proprietary and confidential.
 */

/**
 * Unit tests for API utilities
 * 
 * Tests for the translateMedicationInfo function and related utilities
 */

import { 
  translateMedicationInfo, 
  TranslationError, 
  setApiBaseUrl, 
  getApiConfig,
  TranslationRequest,
  TranslationResponse 
} from '../utils/api';

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('API Utilities', () => {
  beforeEach(() => {
    // Reset mocks and configuration before each test
    mockFetch.mockReset();
    setApiBaseUrl('http://localhost:3000');
  });

  describe('translateMedicationInfo', () => {
    describe('Input Validation', () => {
      it('should throw error for empty text', async () => {
        await expect(translateMedicationInfo('', 'es')).rejects.toThrow(TranslationError);
        await expect(translateMedicationInfo('', 'es')).rejects.toThrow('Text parameter is required');
      });

      it('should throw error for non-string text', async () => {
        await expect(translateMedicationInfo(123 as any, 'es')).rejects.toThrow(TranslationError);
        await expect(translateMedicationInfo(null as any, 'es')).rejects.toThrow(TranslationError);
        await expect(translateMedicationInfo(undefined as any, 'es')).rejects.toThrow(TranslationError);
      });

      it('should throw error for whitespace-only text', async () => {
        await expect(translateMedicationInfo('   ', 'es')).rejects.toThrow(TranslationError);
        await expect(translateMedicationInfo('\t\n', 'es')).rejects.toThrow(TranslationError);
      });

      it('should throw error for empty target language', async () => {
        await expect(translateMedicationInfo('Take 2 tablets', '')).rejects.toThrow(TranslationError);
        await expect(translateMedicationInfo('Take 2 tablets', '')).rejects.toThrow('Target language parameter is required');
      });

      it('should throw error for non-string target language', async () => {
        await expect(translateMedicationInfo('Take 2 tablets', 123 as any)).rejects.toThrow(TranslationError);
        await expect(translateMedicationInfo('Take 2 tablets', null as any)).rejects.toThrow(TranslationError);
        await expect(translateMedicationInfo('Take 2 tablets', undefined as any)).rejects.toThrow(TranslationError);
      });

      it('should throw error for invalid language code format', async () => {
        await expect(translateMedicationInfo('Take 2 tablets', 'invalid')).rejects.toThrow(TranslationError);
        await expect(translateMedicationInfo('Take 2 tablets', 'toolong')).rejects.toThrow(TranslationError);
        await expect(translateMedicationInfo('Take 2 tablets', 'x')).rejects.toThrow(TranslationError);
        await expect(translateMedicationInfo('Take 2 tablets', '123')).rejects.toThrow(TranslationError);
      });

      it('should accept valid language codes', async () => {
        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({
            translatedText: 'Tomar 2 tabletas',
            targetLanguage: 'es'
          })
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        // Should not throw for valid language codes
        await expect(translateMedicationInfo('Take 2 tablets', 'es')).resolves.toBeDefined();
        await expect(translateMedicationInfo('Take 2 tablets', 'fr')).resolves.toBeDefined();
        await expect(translateMedicationInfo('Take 2 tablets', 'en-US')).resolves.toBeDefined();
      });
    });

    describe('HTTP Request Handling', () => {
      it('should make POST request with correct headers and body', async () => {
        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({
            translatedText: 'Tomar 2 tabletas al día',
            sourceLanguage: 'en',
            targetLanguage: 'es',
            confidence: 0.95
          })
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        await translateMedicationInfo('Take 2 tablets daily', 'es');

        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3000/api/whisper/translate',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              text: 'Take 2 tablets daily',
              targetLang: 'es'
            })
          }
        );
      });

      it('should trim input text and normalize language code', async () => {
        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({
            translatedText: 'Tomar 2 tabletas',
            targetLanguage: 'es'
          })
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        await translateMedicationInfo('  Take 2 tablets  ', 'es');

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: JSON.stringify({
              text: 'Take 2 tablets',
              targetLang: 'es'
            })
          })
        );
      });

      it('should use configurable base URL', async () => {
        setApiBaseUrl('https://api.example.com');
        
        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({
            translatedText: 'Test',
            targetLanguage: 'es'
          })
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        await translateMedicationInfo('Test', 'es');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.example.com/api/whisper/translate',
          expect.any(Object)
        );
      });
    });

    describe('Success Response Handling', () => {
      it('should return translation response for successful request', async () => {
        const mockResponseData = {
          translatedText: 'Tomar 2 tabletas al día',
          sourceLanguage: 'en',
          targetLanguage: 'es',
          confidence: 0.95
        };
        
        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue(mockResponseData)
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        const result = await translateMedicationInfo('Take 2 tablets daily', 'es');

        expect(result).toEqual(mockResponseData);
      });

      it('should handle response with minimal required fields', async () => {
        const mockResponseData = {
          translatedText: 'Tomar 2 tabletas al día'
        };
        
        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue(mockResponseData)
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        const result = await translateMedicationInfo('Take 2 tablets daily', 'es');

        expect(result).toEqual({
          translatedText: 'Tomar 2 tabletas al día',
          sourceLanguage: undefined,
          targetLanguage: 'es', // Should default to requested language
          confidence: undefined
        });
      });
    });

    describe('Error Response Handling', () => {
      it('should throw TranslationError for HTTP error responses', async () => {
        const mockResponse = {
          ok: false,
          status: 400,
          json: jest.fn().mockResolvedValue({
            message: 'Invalid request',
            code: 'INVALID_REQUEST'
          })
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        await expect(translateMedicationInfo('Test', 'es')).rejects.toThrow(TranslationError);
        
        try {
          await translateMedicationInfo('Test', 'es');
        } catch (error) {
          expect(error).toBeInstanceOf(TranslationError);
          const translationError = error as TranslationError;
          expect(translationError.message).toBe('Invalid request');
          expect(translationError.code).toBe('INVALID_REQUEST');
          expect(translationError.status).toBe(400);
        }
      });

      it('should handle HTTP errors without JSON error details', async () => {
        const mockResponse = {
          ok: false,
          status: 500,
          json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        await expect(translateMedicationInfo('Test', 'es')).rejects.toThrow(TranslationError);
        
        try {
          await translateMedicationInfo('Test', 'es');
        } catch (error) {
          expect(error).toBeInstanceOf(TranslationError);
          const translationError = error as TranslationError;
          expect(translationError.message).toContain('HTTP error! status: 500');
          expect(translationError.status).toBe(500);
        }
      });

      it('should throw TranslationError for invalid JSON response', async () => {
        const mockResponse = {
          ok: true,
          json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        await expect(translateMedicationInfo('Test', 'es')).rejects.toThrow(TranslationError);
        
        try {
          await translateMedicationInfo('Test', 'es');
        } catch (error) {
          expect(error).toBeInstanceOf(TranslationError);
          const translationError = error as TranslationError;
          expect(translationError.message).toBe('Invalid JSON response from server');
          expect(translationError.code).toBe('INVALID_RESPONSE');
        }
      });

      it('should throw TranslationError for invalid response format', async () => {
        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue(null)
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        await expect(translateMedicationInfo('Test', 'es')).rejects.toThrow(TranslationError);
        
        try {
          await translateMedicationInfo('Test', 'es');
        } catch (error) {
          expect(error).toBeInstanceOf(TranslationError);
          const translationError = error as TranslationError;
          expect(translationError.message).toBe('Invalid response format from server');
          expect(translationError.code).toBe('INVALID_RESPONSE_FORMAT');
        }
      });

      it('should throw TranslationError for missing translated text', async () => {
        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({
            sourceLanguage: 'en',
            targetLanguage: 'es'
          })
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        await expect(translateMedicationInfo('Test', 'es')).rejects.toThrow(TranslationError);
        
        try {
          await translateMedicationInfo('Test', 'es');
        } catch (error) {
          expect(error).toBeInstanceOf(TranslationError);
          const translationError = error as TranslationError;
          expect(translationError.message).toBe('Missing or invalid translated text in response');
          expect(translationError.code).toBe('MISSING_TRANSLATED_TEXT');
        }
      });

      it('should handle network errors', async () => {
        mockFetch.mockRejectedValue(new TypeError('fetch failed'));

        await expect(translateMedicationInfo('Test', 'es')).rejects.toThrow(TranslationError);
        
        try {
          await translateMedicationInfo('Test', 'es');
        } catch (error) {
          expect(error).toBeInstanceOf(TranslationError);
          const translationError = error as TranslationError;
          expect(translationError.message).toContain('Network error');
          expect(translationError.code).toBe('NETWORK_ERROR');
        }
      });

      it('should handle unexpected errors', async () => {
        mockFetch.mockRejectedValue(new Error('Unexpected error'));

        await expect(translateMedicationInfo('Test', 'es')).rejects.toThrow(TranslationError);
        
        try {
          await translateMedicationInfo('Test', 'es');
        } catch (error) {
          expect(error).toBeInstanceOf(TranslationError);
          const translationError = error as TranslationError;
          expect(translationError.message).toContain('Unexpected error during translation');
          expect(translationError.code).toBe('UNEXPECTED_ERROR');
        }
      });
    });
  });

  describe('Configuration Functions', () => {
    describe('setApiBaseUrl', () => {
      it('should update the API base URL', () => {
        const newBaseUrl = 'https://new-api.example.com';
        setApiBaseUrl(newBaseUrl);
        
        const config = getApiConfig();
        expect(config.baseUrl).toBe(newBaseUrl);
      });
    });

    describe('getApiConfig', () => {
      it('should return current API configuration', () => {
        setApiBaseUrl('https://test.example.com');
        
        const config = getApiConfig();
        expect(config).toEqual({
          baseUrl: 'https://test.example.com',
          endpoints: {
            whisperTranslate: '/api/whisper/translate'
          }
        });
      });

      it('should return a copy of the configuration (not reference)', () => {
        const config1 = getApiConfig();
        const config2 = getApiConfig();
        
        expect(config1).toEqual(config2);
        expect(config1).not.toBe(config2); // Different objects
        
        // Modifying returned config should not affect internal config
        config1.baseUrl = 'modified';
        expect(getApiConfig().baseUrl).not.toBe('modified');
      });
    });
  });

  describe('TranslationError', () => {
    it('should create error with message only', () => {
      const error = new TranslationError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('TranslationError');
      expect(error.code).toBeUndefined();
      expect(error.status).toBeUndefined();
    });

    it('should create error with message and code', () => {
      const error = new TranslationError('Test error', 'TEST_CODE');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.status).toBeUndefined();
    });

    it('should create error with message, code, and status', () => {
      const error = new TranslationError('Test error', 'TEST_CODE', 400);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.status).toBe(400);
    });

    it('should be instance of Error', () => {
      const error = new TranslationError('Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(TranslationError);
    });
  });
});