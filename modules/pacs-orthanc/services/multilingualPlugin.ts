/**
 * WebQX™ Orthanc PACS Integration - Multilingual Plugin
 * Multilingual support for DICOM metadata queries and responses
 */

import { EventEmitter } from 'events';
import {
  MultilingualConfig,
  TranslatedMetadata,
  LanguagePreference,
  DicomTags,
  PluginConfig,
  HealthStatus
} from '../types';
import { OrthancClient } from '../utils/orthancClient';

export class MultilingualPlugin extends EventEmitter {
  private config: MultilingualConfig;
  private pluginConfig: PluginConfig;
  private orthancClient: OrthancClient;
  private translationProvider: TranslationProvider;
  private translationCache: Map<string, TranslatedMetadata> = new Map();
  private userPreferences: Map<string, LanguagePreference> = new Map();
  private isInitialized = false;

  // Common DICOM tags that should be translated
  private readonly TRANSLATABLE_TAGS = [
    'StudyDescription',
    'SeriesDescription',
    'ProtocolName',
    'BodyPartExamined',
    'ViewPosition',
    'ImageComments',
    'StudyComments',
    'SeriesComments',
    'ImageType',
    'ContrastBolusAgent',
    'ScanOptions',
    'SequenceName',
    'PatientPosition',
    'AcquisitionContext',
    'ReasonForStudy',
    'ClinicalTrialProtocolName'
  ];

  // Medical terminology mappings for common DICOM values
  private readonly MEDICAL_TERMINOLOGY: Record<string, Record<string, string>> = {
    'en': {
      'HEAD': 'Head',
      'CHEST': 'Chest',
      'ABDOMEN': 'Abdomen',
      'PELVIS': 'Pelvis',
      'EXTREMITY': 'Extremity',
      'SPINE': 'Spine',
      'BRAIN': 'Brain',
      'HEART': 'Heart',
      'LIVER': 'Liver',
      'KIDNEY': 'Kidney',
      'LUNG': 'Lung'
    },
    'es': {
      'HEAD': 'Cabeza',
      'CHEST': 'Tórax',
      'ABDOMEN': 'Abdomen',
      'PELVIS': 'Pelvis',
      'EXTREMITY': 'Extremidad',
      'SPINE': 'Columna vertebral',
      'BRAIN': 'Cerebro',
      'HEART': 'Corazón',
      'LIVER': 'Hígado',
      'KIDNEY': 'Riñón',
      'LUNG': 'Pulmón'
    },
    'fr': {
      'HEAD': 'Tête',
      'CHEST': 'Thorax',
      'ABDOMEN': 'Abdomen',
      'PELVIS': 'Bassin',
      'EXTREMITY': 'Extrémité',
      'SPINE': 'Colonne vertébrale',
      'BRAIN': 'Cerveau',
      'HEART': 'Cœur',
      'LIVER': 'Foie',
      'KIDNEY': 'Rein',
      'LUNG': 'Poumon'
    },
    'de': {
      'HEAD': 'Kopf',
      'CHEST': 'Brustkorb',
      'ABDOMEN': 'Bauch',
      'PELVIS': 'Becken',
      'EXTREMITY': 'Extremität',
      'SPINE': 'Wirbelsäule',
      'BRAIN': 'Gehirn',
      'HEART': 'Herz',
      'LIVER': 'Leber',
      'KIDNEY': 'Niere',
      'LUNG': 'Lunge'
    },
    'it': {
      'HEAD': 'Testa',
      'CHEST': 'Torace',
      'ABDOMEN': 'Addome',
      'PELVIS': 'Bacino',
      'EXTREMITY': 'Estremità',
      'SPINE': 'Colonna vertebrale',
      'BRAIN': 'Cervello',
      'HEART': 'Cuore',
      'LIVER': 'Fegato',
      'KIDNEY': 'Rene',
      'LUNG': 'Polmone'
    },
    'pt': {
      'HEAD': 'Cabeça',
      'CHEST': 'Tórax',
      'ABDOMEN': 'Abdômen',
      'PELVIS': 'Pelve',
      'EXTREMITY': 'Extremidade',
      'SPINE': 'Coluna vertebral',
      'BRAIN': 'Cérebro',
      'HEART': 'Coração',
      'LIVER': 'Fígado',
      'KIDNEY': 'Rim',
      'LUNG': 'Pulmão'
    },
    'zh': {
      'HEAD': '头部',
      'CHEST': '胸部',
      'ABDOMEN': '腹部',
      'PELVIS': '骨盆',
      'EXTREMITY': '四肢',
      'SPINE': '脊柱',
      'BRAIN': '大脑',
      'HEART': '心脏',
      'LIVER': '肝脏',
      'KIDNEY': '肾脏',
      'LUNG': '肺'
    },
    'ja': {
      'HEAD': '頭部',
      'CHEST': '胸部',
      'ABDOMEN': '腹部',
      'PELVIS': '骨盤',
      'EXTREMITY': '四肢',
      'SPINE': '脊椎',
      'BRAIN': '脳',
      'HEART': '心臓',
      'LIVER': '肝臓',
      'KIDNEY': '腎臓',
      'LUNG': '肺'
    },
    'ko': {
      'HEAD': '머리',
      'CHEST': '가슴',
      'ABDOMEN': '복부',
      'PELVIS': '골반',
      'EXTREMITY': '사지',
      'SPINE': '척추',
      'BRAIN': '뇌',
      'HEART': '심장',
      'LIVER': '간',
      'KIDNEY': '신장',
      'LUNG': '폐'
    },
    'ar': {
      'HEAD': 'الرأس',
      'CHEST': 'الصدر',
      'ABDOMEN': 'البطن',
      'PELVIS': 'الحوض',
      'EXTREMITY': 'الأطراف',
      'SPINE': 'العمود الفقري',
      'BRAIN': 'الدماغ',
      'HEART': 'القلب',
      'LIVER': 'الكبد',
      'KIDNEY': 'الكلى',
      'LUNG': 'الرئة'
    }
  };

  constructor(
    config: MultilingualConfig,
    pluginConfig: PluginConfig,
    orthancClient: OrthancClient
  ) {
    super();
    this.config = config;
    this.pluginConfig = pluginConfig;
    this.orthancClient = orthancClient;
    this.translationProvider = this.createTranslationProvider();
  }

  /**
   * Initialize the multilingual plugin
   */
  async initialize(): Promise<void> {
    try {
      // Initialize translation provider
      await this.translationProvider.initialize();
      
      // Load user preferences
      await this.loadUserPreferences();
      
      // Set up cache management
      this.setupCacheManagement();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      console.log('[Multilingual Plugin] Successfully initialized');
    } catch (error) {
      this.emit('error', {
        code: 'INITIALIZATION_FAILED',
        message: 'Failed to initialize multilingual plugin',
        details: error,
        timestamp: new Date(),
        pluginName: 'MultilingualPlugin',
        severity: 'critical'
      });
      throw error;
    }
  }

  /**
   * Get health status of the plugin
   */
  async getHealthStatus(): Promise<HealthStatus> {
    try {
      if (!this.isInitialized) {
        return {
          status: 'unhealthy',
          message: 'Plugin not initialized',
          timestamp: new Date(),
          version: '1.0.0'
        };
      }

      // Check translation provider health
      const providerHealth = await this.translationProvider.healthCheck();
      
      // Check Orthanc connectivity
      const orthancHealth = await this.orthancClient.healthCheck();

      if (!orthancHealth) {
        return {
          status: 'degraded',
          message: 'Orthanc server not accessible',
          details: { orthancHealth, providerHealth },
          timestamp: new Date(),
          version: '1.0.0'
        };
      }

      if (!providerHealth) {
        return {
          status: 'degraded',
          message: 'Translation provider not accessible',
          details: { orthancHealth, providerHealth },
          timestamp: new Date(),
          version: '1.0.0'
        };
      }

      return {
        status: 'healthy',
        message: 'All systems operational',
        details: {
          orthancHealth,
          providerHealth,
          supportedLanguages: this.config.supportedLanguages,
          cachedTranslations: this.translationCache.size,
          userPreferences: this.userPreferences.size,
          translationProvider: this.config.translationProvider
        },
        timestamp: new Date(),
        version: '1.0.0'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Health check failed',
        details: error,
        timestamp: new Date(),
        version: '1.0.0'
      };
    }
  }

  /**
   * Translate DICOM metadata to target language
   */
  async translateMetadata(
    metadata: DicomTags,
    targetLanguage: string,
    userId?: string
  ): Promise<DicomTags> {
    if (!this.isInitialized) {
      throw new Error('Plugin not initialized');
    }

    // Use user preference if available
    if (userId) {
      const userPref = this.userPreferences.get(userId);
      if (userPref) {
        targetLanguage = userPref.preferredLanguage;
      }
    }

    // Return original if target language is default
    if (targetLanguage === this.config.defaultLanguage) {
      return metadata;
    }

    // Check if target language is supported
    if (!this.config.supportedLanguages.includes(targetLanguage)) {
      console.warn(`[Multilingual Plugin] Unsupported language: ${targetLanguage}`);
      return metadata;
    }

    const translatedMetadata: DicomTags = { ...metadata };

    try {
      // Translate each translatable tag
      for (const tag of this.TRANSLATABLE_TAGS) {
        const originalValue = metadata[tag];
        if (originalValue && typeof originalValue === 'string') {
          const translatedValue = await this.translateValue(
            originalValue,
            this.config.defaultLanguage,
            targetLanguage,
            tag
          );
          
          if (translatedValue !== originalValue) {
            translatedMetadata[tag] = translatedValue;
          }
        }
      }

      this.emit('metadata_translated', {
        originalLanguage: this.config.defaultLanguage,
        targetLanguage,
        userId,
        tagCount: this.TRANSLATABLE_TAGS.length
      });

      return translatedMetadata;
    } catch (error) {
      this.emit('error', {
        code: 'TRANSLATION_FAILED',
        message: 'Failed to translate metadata',
        details: { error, targetLanguage, userId },
        timestamp: new Date(),
        pluginName: 'MultilingualPlugin',
        severity: 'medium'
      });
      
      // Return original metadata on error
      return metadata;
    }
  }

  /**
   * Get study metadata in user's preferred language
   */
  async getLocalizedStudyMetadata(studyId: string, userId?: string): Promise<DicomTags> {
    const tagsResponse = await this.orthancClient.getStudyTags(studyId);
    if (!tagsResponse.success || !tagsResponse.data) {
      throw new Error(`Failed to get study tags for ${studyId}`);
    }

    const userPref = userId ? this.userPreferences.get(userId) : null;
    const targetLanguage = userPref?.preferredLanguage || this.config.defaultLanguage;

    return this.translateMetadata(tagsResponse.data, targetLanguage, userId);
  }

  /**
   * Get series metadata in user's preferred language
   */
  async getLocalizedSeriesMetadata(seriesId: string, userId?: string): Promise<DicomTags> {
    const tagsResponse = await this.orthancClient.getSeriesTags(seriesId);
    if (!tagsResponse.success || !tagsResponse.data) {
      throw new Error(`Failed to get series tags for ${seriesId}`);
    }

    const userPref = userId ? this.userPreferences.get(userId) : null;
    const targetLanguage = userPref?.preferredLanguage || this.config.defaultLanguage;

    return this.translateMetadata(tagsResponse.data, targetLanguage, userId);
  }

  /**
   * Get instance metadata in user's preferred language
   */
  async getLocalizedInstanceMetadata(instanceId: string, userId?: string): Promise<DicomTags> {
    const tagsResponse = await this.orthancClient.getInstanceTags(instanceId);
    if (!tagsResponse.success || !tagsResponse.data) {
      throw new Error(`Failed to get instance tags for ${instanceId}`);
    }

    const userPref = userId ? this.userPreferences.get(userId) : null;
    const targetLanguage = userPref?.preferredLanguage || this.config.defaultLanguage;

    return this.translateMetadata(tagsResponse.data, targetLanguage, userId);
  }

  /**
   * Set user language preference
   */
  async setUserLanguagePreference(preference: LanguagePreference): Promise<void> {
    // Validate language
    if (!this.config.supportedLanguages.includes(preference.preferredLanguage)) {
      throw new Error(`Unsupported language: ${preference.preferredLanguage}`);
    }

    this.userPreferences.set(preference.userId, preference);
    await this.saveUserPreferences();

    this.emit('user_preference_updated', preference);
  }

  /**
   * Get user language preference
   */
  getUserLanguagePreference(userId: string): LanguagePreference | null {
    return this.userPreferences.get(userId) || null;
  }

  /**
   * Get available languages
   */
  getSupportedLanguages(): string[] {
    return [...this.config.supportedLanguages];
  }

  /**
   * Auto-detect language from text
   */
  async detectLanguage(text: string): Promise<string> {
    if (!this.config.autoDetectLanguage) {
      return this.config.defaultLanguage;
    }

    try {
      return await this.translationProvider.detectLanguage(text);
    } catch (error) {
      console.warn('[Multilingual Plugin] Language detection failed:', error);
      return this.config.defaultLanguage;
    }
  }

  /**
   * Translate search query to target language
   */
  async translateSearchQuery(query: any, targetLanguage: string): Promise<any> {
    const translatedQuery = { ...query };

    // Translate text-based search fields
    if (query.studyDescription) {
      translatedQuery.studyDescription = await this.translateValue(
        query.studyDescription,
        this.config.defaultLanguage,
        targetLanguage,
        'StudyDescription'
      );
    }

    if (query.patientName) {
      // Note: Patient names typically shouldn't be translated
      // but we might normalize them for search
      translatedQuery.patientName = query.patientName;
    }

    if (query.fullTextSearch) {
      translatedQuery.fullTextSearch = await this.translateValue(
        query.fullTextSearch,
        this.config.defaultLanguage,
        targetLanguage,
        'fullTextSearch'
      );
    }

    return translatedQuery;
  }

  /**
   * Get localized date/time format for user
   */
  getLocalizedDateFormat(userId: string): { dateFormat: string; timeFormat: string; numberFormat: string } {
    const userPref = this.userPreferences.get(userId);
    
    if (userPref) {
      return {
        dateFormat: userPref.dateFormat,
        timeFormat: userPref.timeFormat,
        numberFormat: userPref.numberFormat
      };
    }

    // Default formats based on language
    const language = this.config.defaultLanguage;
    return this.getDefaultFormatsForLanguage(language);
  }

  /**
   * Format date according to user preference
   */
  formatDate(date: string, userId?: string): string {
    if (!date) return '';

    const formats = userId ? this.getLocalizedDateFormat(userId) : 
                    this.getDefaultFormatsForLanguage(this.config.defaultLanguage);

    // Parse DICOM date (YYYYMMDD)
    if (date.length === 8) {
      const year = date.substring(0, 4);
      const month = date.substring(4, 6);
      const day = date.substring(6, 8);

      switch (formats.dateFormat) {
        case 'DD/MM/YYYY':
          return `${day}/${month}/${year}`;
        case 'MM/DD/YYYY':
          return `${month}/${day}/${year}`;
        case 'YYYY-MM-DD':
          return `${year}-${month}-${day}`;
        case 'DD.MM.YYYY':
          return `${day}.${month}.${year}`;
        default:
          return `${year}-${month}-${day}`;
      }
    }

    return date;
  }

  /**
   * Format time according to user preference
   */
  formatTime(time: string, userId?: string): string {
    if (!time) return '';

    const formats = userId ? this.getLocalizedDateFormat(userId) : 
                    this.getDefaultFormatsForLanguage(this.config.defaultLanguage);

    // Parse DICOM time (HHMMSS.ffffff)
    if (time.length >= 6) {
      const hour = time.substring(0, 2);
      const minute = time.substring(2, 4);
      const second = time.substring(4, 6);

      if (formats.timeFormat === '12h') {
        const hourNum = parseInt(hour);
        const hour12 = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
        const ampm = hourNum >= 12 ? 'PM' : 'AM';
        return `${hour12}:${minute}:${second} ${ampm}`;
      } else {
        return `${hour}:${minute}:${second}`;
      }
    }

    return time;
  }

  private async translateValue(
    value: string,
    sourceLanguage: string,
    targetLanguage: string,
    context: string
  ): Promise<string> {
    // Check cache first
    const cacheKey = `${value}:${sourceLanguage}:${targetLanguage}:${context}`;
    const cached = this.translationCache.get(cacheKey);
    
    if (cached && this.config.cacheTranslations) {
      return cached.translations[targetLanguage]?.[value] || value;
    }

    // Try medical terminology mapping first
    const terminologyTranslation = this.translateMedicalTerminology(value, targetLanguage);
    if (terminologyTranslation !== value) {
      return terminologyTranslation;
    }

    // Use translation provider for complex text
    try {
      const translatedValue = await this.translationProvider.translate(
        value,
        sourceLanguage,
        targetLanguage
      );

      // Cache the translation
      if (this.config.cacheTranslations) {
        const translatedMetadata: TranslatedMetadata = {
          originalLanguage: sourceLanguage,
          translations: {
            [targetLanguage]: { [value]: translatedValue }
          },
          translatedAt: new Date(),
          translationProvider: this.config.translationProvider
        };

        this.translationCache.set(cacheKey, translatedMetadata);
      }

      return translatedValue;
    } catch (error) {
      console.warn(`[Multilingual Plugin] Translation failed for "${value}":`, error);
      return value; // Return original on error
    }
  }

  private translateMedicalTerminology(value: string, targetLanguage: string): string {
    const upperValue = value.toUpperCase();
    const terminology = this.MEDICAL_TERMINOLOGY[targetLanguage];
    
    if (terminology && terminology[upperValue]) {
      return terminology[upperValue];
    }

    return value;
  }

  private createTranslationProvider(): TranslationProvider {
    switch (this.config.translationProvider) {
      case 'google':
        return new GoogleTranslationProvider(this.config);
      case 'azure':
        return new AzureTranslationProvider(this.config);
      case 'aws':
        return new AWSTranslationProvider(this.config);
      case 'local':
        return new LocalTranslationProvider(this.config);
      default:
        return new LocalTranslationProvider(this.config);
    }
  }

  private async loadUserPreferences(): Promise<void> {
    // Implementation would load user preferences from persistent storage
    console.log('[Multilingual Plugin] Loading user preferences');
  }

  private async saveUserPreferences(): Promise<void> {
    // Implementation would save user preferences to persistent storage
    console.log('[Multilingual Plugin] Saving user preferences');
  }

  private setupCacheManagement(): void {
    if (this.config.cacheTranslations) {
      // Clean up old cache entries every hour
      setInterval(() => {
        this.cleanupTranslationCache();
      }, 60 * 60 * 1000);
    }
  }

  private cleanupTranslationCache(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7); // Keep cache for 7 days

    for (const [key, metadata] of this.translationCache.entries()) {
      if (metadata.translatedAt < cutoffDate) {
        this.translationCache.delete(key);
      }
    }
  }

  private getDefaultFormatsForLanguage(language: string): { dateFormat: string; timeFormat: string; numberFormat: string } {
    const formats: Record<string, any> = {
      'en': { dateFormat: 'MM/DD/YYYY', timeFormat: '12h', numberFormat: 'en-US' },
      'es': { dateFormat: 'DD/MM/YYYY', timeFormat: '24h', numberFormat: 'es-ES' },
      'fr': { dateFormat: 'DD/MM/YYYY', timeFormat: '24h', numberFormat: 'fr-FR' },
      'de': { dateFormat: 'DD.MM.YYYY', timeFormat: '24h', numberFormat: 'de-DE' },
      'it': { dateFormat: 'DD/MM/YYYY', timeFormat: '24h', numberFormat: 'it-IT' },
      'pt': { dateFormat: 'DD/MM/YYYY', timeFormat: '24h', numberFormat: 'pt-PT' },
      'zh': { dateFormat: 'YYYY-MM-DD', timeFormat: '24h', numberFormat: 'zh-CN' },
      'ja': { dateFormat: 'YYYY-MM-DD', timeFormat: '24h', numberFormat: 'ja-JP' },
      'ko': { dateFormat: 'YYYY-MM-DD', timeFormat: '24h', numberFormat: 'ko-KR' },
      'ar': { dateFormat: 'DD/MM/YYYY', timeFormat: '12h', numberFormat: 'ar-SA' }
    };

    return formats[language] || formats['en'];
  }
}

// Abstract base class for translation providers
abstract class TranslationProvider {
  protected config: MultilingualConfig;

  constructor(config: MultilingualConfig) {
    this.config = config;
  }

  abstract initialize(): Promise<void>;
  abstract healthCheck(): Promise<boolean>;
  abstract translate(text: string, sourceLanguage: string, targetLanguage: string): Promise<string>;
  abstract detectLanguage(text: string): Promise<string>;
}

// Local Translation Provider (using built-in medical terminology)
class LocalTranslationProvider extends TranslationProvider {
  async initialize(): Promise<void> {
    console.log('[Local Translation] Initialized local translation provider');
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  async translate(text: string, sourceLanguage: string, targetLanguage: string): Promise<string> {
    // Simple local translation using medical terminology
    // In a real implementation, this would use a local translation library
    console.log(`[Local Translation] Translating "${text}" from ${sourceLanguage} to ${targetLanguage}`);
    return text; // Return original for now
  }

  async detectLanguage(text: string): Promise<string> {
    // Simple language detection logic
    // In a real implementation, this would use a language detection library
    return this.config.defaultLanguage;
  }
}

// Google Translation Provider
class GoogleTranslationProvider extends TranslationProvider {
  async initialize(): Promise<void> {
    console.log('[Google Translation] Initialized Google translation provider');
  }

  async healthCheck(): Promise<boolean> {
    return true; // Simplified for demo
  }

  async translate(text: string, sourceLanguage: string, targetLanguage: string): Promise<string> {
    console.log(`[Google Translation] Translating "${text}" from ${sourceLanguage} to ${targetLanguage}`);
    // Google Cloud Translation API integration would go here
    return text; // Simplified for demo
  }

  async detectLanguage(text: string): Promise<string> {
    console.log(`[Google Translation] Detecting language for "${text}"`);
    // Google Cloud Language Detection API integration would go here
    return this.config.defaultLanguage;
  }
}

// Azure Translation Provider
class AzureTranslationProvider extends TranslationProvider {
  async initialize(): Promise<void> {
    console.log('[Azure Translation] Initialized Azure translation provider');
  }

  async healthCheck(): Promise<boolean> {
    return true; // Simplified for demo
  }

  async translate(text: string, sourceLanguage: string, targetLanguage: string): Promise<string> {
    console.log(`[Azure Translation] Translating "${text}" from ${sourceLanguage} to ${targetLanguage}`);
    // Azure Cognitive Services Translator integration would go here
    return text; // Simplified for demo
  }

  async detectLanguage(text: string): Promise<string> {
    console.log(`[Azure Translation] Detecting language for "${text}"`);
    // Azure Language Detection API integration would go here
    return this.config.defaultLanguage;
  }
}

// AWS Translation Provider
class AWSTranslationProvider extends TranslationProvider {
  async initialize(): Promise<void> {
    console.log('[AWS Translation] Initialized AWS translation provider');
  }

  async healthCheck(): Promise<boolean> {
    return true; // Simplified for demo
  }

  async translate(text: string, sourceLanguage: string, targetLanguage: string): Promise<string> {
    console.log(`[AWS Translation] Translating "${text}" from ${sourceLanguage} to ${targetLanguage}`);
    // AWS Translate integration would go here
    return text; // Simplified for demo
  }

  async detectLanguage(text: string): Promise<string> {
    console.log(`[AWS Translation] Detecting language for "${text}"`);
    // AWS Comprehend language detection would go here
    return this.config.defaultLanguage;
  }
}