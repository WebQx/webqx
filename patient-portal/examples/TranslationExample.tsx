/**
 * Example usage of the translateMedicationInfo function
 * 
 * This file demonstrates how to use the translateMedicationInfo function
 * with proper error handling and type safety.
 */

import React from 'react';
import { 
  translateMedicationInfo, 
  TranslationError, 
  setApiBaseUrl 
} from '../utils/api';

/**
 * Example component showing how to use the translation function
 */
export class MedicationTranslator {
  constructor() {
    // Set the base URL for development/production
    setApiBaseUrl(process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000');
  }

  /**
   * Translate medication instructions with error handling
   */
  async translateInstructions(text: string, targetLanguage: string): Promise<string> {
    try {
      const result = await translateMedicationInfo(text, targetLanguage);
      
      console.log(`Translation successful:`, {
        original: text,
        translated: result.translatedText,
        sourceLanguage: result.sourceLanguage,
        targetLanguage: result.targetLanguage,
        confidence: result.confidence
      });
      
      return result.translatedText;
      
    } catch (error) {
      if (error instanceof TranslationError) {
        // Handle different types of translation errors
        switch (error.code) {
          case 'INVALID_TEXT':
          case 'INVALID_TARGET_LANG':
          case 'INVALID_LANG_CODE':
            console.error('Input validation error:', error.message);
            throw new Error('Please check your input and try again.');
            
          case 'NETWORK_ERROR':
            console.error('Network error:', error.message);
            throw new Error('Translation service is temporarily unavailable. Please try again later.');
            
          case 'HTTP_ERROR':
            console.error('Server error:', error.message, 'Status:', error.status);
            if (error.status === 429) {
              throw new Error('Too many translation requests. Please wait and try again.');
            } else if (error.status && error.status >= 500) {
              throw new Error('Translation service is experiencing issues. Please try again later.');
            } else {
              throw new Error('Translation request failed. Please check your input.');
            }
            
          case 'INVALID_RESPONSE':
          case 'INVALID_RESPONSE_FORMAT':
          case 'MISSING_TRANSLATED_TEXT':
            console.error('Response parsing error:', error.message);
            throw new Error('Unexpected response from translation service. Please try again.');
            
          default:
            console.error('Unknown translation error:', error.message, 'Code:', error.code);
            throw new Error('Translation failed due to an unexpected error.');
        }
      } else {
        // Handle unexpected errors
        console.error('Unexpected error during translation:', error);
        throw new Error('An unexpected error occurred. Please try again.');
      }
    }
  }

  /**
   * Batch translate multiple medication instructions
   */
  async batchTranslate(
    instructions: string[], 
    targetLanguage: string
  ): Promise<{ original: string; translated: string; success: boolean; error?: string }[]> {
    const results = [];
    
    for (const instruction of instructions) {
      try {
        const translated = await this.translateInstructions(instruction, targetLanguage);
        results.push({
          original: instruction,
          translated,
          success: true
        });
      } catch (error) {
        results.push({
          original: instruction,
          translated: instruction, // Fallback to original
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return results;
  }
}

/**
 * Example usage scenarios
 */
export async function exampleUsage() {
  const translator = new MedicationTranslator();
  
  try {
    // Basic translation
    const spanish = await translator.translateInstructions(
      'Take 2 tablets daily with food', 
      'es'
    );
    console.log('Spanish translation:', spanish);
    
    // French translation
    const french = await translator.translateInstructions(
      'May cause drowsiness', 
      'fr'
    );
    console.log('French translation:', french);
    
    // Batch translation
    const instructions = [
      'Take 2 tablets daily',
      'Take with food',
      'Do not exceed 4 doses per day',
      'May cause drowsiness'
    ];
    
    const batchResults = await translator.batchTranslate(instructions, 'de');
    console.log('Batch translation results:', batchResults);
    
  } catch (error) {
    console.error('Translation example failed:', error);
  }
}

// Example React component usage
export function MedicationInstructions({ 
  instructions, 
  patientLanguage 
}: { 
  instructions: string; 
  patientLanguage: string;
}) {
  const [translatedText, setTranslatedText] = React.useState<string>('');
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  
  const translator = new MedicationTranslator();
  
  const handleTranslate = async () => {
    if (!instructions.trim() || !patientLanguage.trim()) {
      setError('Please provide both instructions and target language');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await translator.translateInstructions(instructions, patientLanguage);
      setTranslatedText(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Translation failed');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="medication-instructions">
      <div className="original-instructions">
        <h3>Original Instructions:</h3>
        <p>{instructions}</p>
      </div>
      
      <button 
        onClick={handleTranslate} 
        disabled={isLoading}
        className="translate-button"
      >
        {isLoading ? 'Translating...' : `Translate to ${patientLanguage.toUpperCase()}`}
      </button>
      
      {error && (
        <div className="error-message" role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {translatedText && !error && (
        <div className="translated-instructions">
          <h3>Translated Instructions ({patientLanguage.toUpperCase()}):</h3>
          <p>{translatedText}</p>
        </div>
      )}
    </div>
  );
}