import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import locale files
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';

/**
 * Telehealth Module i18n Configuration
 * 
 * Provides multilingual support for the telehealth module with medical terminology
 * optimized for different languages and regions.
 */
const telehealthI18n = i18n.createInstance();

// Language resources
const resources = {
  en: {
    translation: en
  },
  es: {
    translation: es
  },
  fr: {
    translation: fr
  }
  // Additional languages can be added here
};

// Supported languages with metadata
export const supportedLanguages = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    rtl: false,
    medicalTermsSupport: 'extensive'
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    rtl: false,
    medicalTermsSupport: 'comprehensive'
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    rtl: false,
    medicalTermsSupport: 'medical'
  }
];

// Initialize i18n
telehealthI18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',
    
    // Language detection options
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'webqx-telehealth-language'
    },

    interpolation: {
      escapeValue: false // React already escapes values
    },

    // Namespace configuration
    defaultNS: 'translation',
    ns: ['translation'],

    // Key separator
    keySeparator: '.',
    nsSeparator: ':',

    // React i18next options
    react: {
      useSuspense: false,
      bindI18n: 'languageChanged',
      bindI18nStore: '',
      transEmptyNodeValue: '',
      transSupportBasicHtmlNodes: true,
      transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'em']
    }
  });

/**
 * Language switching utility
 */
export class TelehealthLanguageManager {
  private i18nInstance = telehealthI18n;

  /**
   * Changes the current language
   * @param languageCode - Language code to switch to
   */
  async changeLanguage(languageCode: string): Promise<void> {
    try {
      await this.i18nInstance.changeLanguage(languageCode);
      
      // Store language preference
      localStorage.setItem('webqx-telehealth-language', languageCode);
      
      // Emit custom event for components to react to language change
      window.dispatchEvent(new CustomEvent('telehealthLanguageChanged', {
        detail: { language: languageCode }
      }));
      
      console.log('[Telehealth i18n] Language changed to:', languageCode);
    } catch (error) {
      console.error('[Telehealth i18n] Failed to change language:', error);
    }
  }

  /**
   * Gets the current language
   */
  getCurrentLanguage(): string {
    return this.i18nInstance.language || 'en';
  }

  /**
   * Gets supported languages
   */
  getSupportedLanguages() {
    return supportedLanguages;
  }

  /**
   * Checks if a language is supported
   */
  isLanguageSupported(languageCode: string): boolean {
    return supportedLanguages.some(lang => lang.code === languageCode);
  }

  /**
   * Gets language metadata
   */
  getLanguageMetadata(languageCode: string) {
    return supportedLanguages.find(lang => lang.code === languageCode);
  }

  /**
   * Translates a key with optional interpolation
   */
  translate(key: string, options?: any): string {
    return this.i18nInstance.t(key, options);
  }

  /**
   * Gets available languages for the current user based on preferences
   */
  getRecommendedLanguages(): string[] {
    const browserLanguages = navigator.languages || [navigator.language];
    const supported = supportedLanguages.map(lang => lang.code);
    
    return browserLanguages
      .map(lang => lang.split('-')[0]) // Extract language code
      .filter(lang => supported.includes(lang))
      .slice(0, 3); // Limit to top 3 recommendations
  }

  /**
   * Auto-detects language from browser/system preferences
   */
  async autoDetectLanguage(): Promise<string> {
    const detectedLanguage = this.i18nInstance.services.languageDetector.detect();
    const languageCode = Array.isArray(detectedLanguage) ? detectedLanguage[0] : detectedLanguage;
    const finalLanguage = languageCode.split('-')[0]; // Extract base language code
    
    if (this.isLanguageSupported(finalLanguage)) {
      await this.changeLanguage(finalLanguage);
      return finalLanguage;
    }
    
    return 'en'; // Fallback to English
  }
}

// Create singleton instance
export const languageManager = new TelehealthLanguageManager();

// Export i18n instance for React components
export default telehealthI18n;