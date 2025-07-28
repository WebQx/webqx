import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enTranslations from './locales/en.json';
import esTranslations from './locales/es.json';
import frTranslations from './locales/fr.json';
import zhTranslations from './locales/zh.json';
import arTranslations from './locales/ar.json';
import hiTranslations from './locales/hi.json';
import ruTranslations from './locales/ru.json';
import deTranslations from './locales/de.json';

export const supportedLanguages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' }
];

export const defaultLanguage = 'en';

const resources = {
  en: { translation: enTranslations },
  es: { translation: esTranslations },
  fr: { translation: frTranslations },
  zh: { translation: zhTranslations },
  ar: { translation: arTranslations },
  hi: { translation: hiTranslations },
  ru: { translation: ruTranslations },
  de: { translation: deTranslations }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: defaultLanguage,
    lng: localStorage.getItem('webqx-language') || defaultLanguage,
    
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'webqx-language',
    },
    
    react: {
      useSuspense: false, // Disable suspense for easier testing
    },
  });

export default i18n;