/**
 * @fileoverview Whisper-Ottehr Integration Service
 * 
 * This service provides seamless integration between Whisper speech recognition
 * and Ottehr healthcare services, enabling audio transcription and translation
 * capabilities within the Ottehr workflow.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { WhisperService, WhisperResponse, WhisperError } from './whisperService';
import { OttehrService, OttehrConfig, OttehrNotification, OttehrApiResponse } from './ottehrService';

/**
 * Configuration interface for the integration service
 */
export interface WhisperOttehrConfig {
  /** Whisper service configuration */
  whisper?: {
    apiUrl?: string;
    timeout?: number;
    maxFileSize?: number;
    allowedFileTypes?: string[];
  };
  /** Ottehr service configuration */
  ottehr?: OttehrConfig;
  /** Integration-specific settings */
  integration?: {
    /** Enable automatic transcription for all audio inputs */
    autoTranscribe?: boolean;
    /** Enable automatic translation */
    autoTranslate?: boolean;
    /** Default target language for translations */
    defaultTargetLanguage?: string;
    /** Enable notifications for transcription events */
    enableNotifications?: boolean;
    /** Medical specialty for context-aware transcription */
    medicalSpecialty?: 'general' | 'cardiology' | 'pharmacy' | 'emergency' | 'surgery';
    /** Enable HIPAA compliant processing */
    hipaaCompliant?: boolean;
  };
}

/**
 * Enhanced transcription result with healthcare context
 */
export interface HealthcareTranscriptionResult extends WhisperResponse {
  /** Medical specialty context */
  specialty?: string;
  /** Detected medical terms */
  medicalTerms?: string[];
  /** Confidence scores for medical terminology */
  medicalConfidence?: number;
  /** Patient context if available */
  patientContext?: {
    patientId?: string;
    encounterType?: string;
    timestamp?: string;
  };
  /** Translation result if enabled */
  translation?: {
    text: string;
    targetLanguage: string;
    confidence: number;
  };
}

/**
 * Audio transcription request interface
 */
export interface AudioTranscriptionRequest {
  /** Audio file to transcribe */
  audioFile: File;
  /** Patient context */
  patientId?: string;
  /** Encounter type */
  encounterType?: 'consultation' | 'prescription' | 'discharge' | 'emergency';
  /** Target language for translation */
  targetLanguage?: string;
  /** Medical specialty context */
  specialty?: string;
  /** Custom prompt for medical context */
  customPrompt?: string;
}

/**
 * WhisperOttehrIntegration class provides seamless integration between
 * Whisper speech recognition and Ottehr healthcare services
 */
export class WhisperOttehrIntegration extends EventEmitter {
  private whisperService: WhisperService;
  private ottehrService: OttehrService;
  private config: Required<WhisperOttehrConfig>;

  /**
   * Creates a new WhisperOttehrIntegration instance
   * @param config - Integration configuration
   */
  constructor(config: WhisperOttehrConfig = {}) {
    super();

    // Initialize default configuration
    this.config = {
      whisper: {
        apiUrl: config.whisper?.apiUrl || process.env.WHISPER_API_URL || 'https://api.openai.com/v1/audio/transcriptions',
        timeout: config.whisper?.timeout || 30000,
        maxFileSize: config.whisper?.maxFileSize || 25 * 1024 * 1024,
        allowedFileTypes: config.whisper?.allowedFileTypes || [
          'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/flac', 'audio/m4a'
        ]
      },
      ottehr: {
        apiBaseUrl: config.ottehr?.apiBaseUrl || process.env.OTTEHR_API_BASE_URL || 'https://api.ottehr.com',
        apiKey: config.ottehr?.apiKey || process.env.OTTEHR_API_KEY || '',
        clientId: config.ottehr?.clientId || process.env.OTTEHR_CLIENT_ID || '',
        clientSecret: config.ottehr?.clientSecret || process.env.OTTEHR_CLIENT_SECRET || '',
        environment: config.ottehr?.environment || process.env.OTTEHR_ENVIRONMENT || 'sandbox',
        webhookSecret: config.ottehr?.webhookSecret || process.env.OTTEHR_WEBHOOK_SECRET || '',
        timeout: config.ottehr?.timeout || 30000,
        enableNotifications: config.ottehr?.enableNotifications !== false,
        enableOrdering: config.ottehr?.enableOrdering !== false,
        enablePOSIntegration: config.ottehr?.enablePOSIntegration !== false,
        enableDeliveryTracking: config.ottehr?.enableDeliveryTracking !== false
      },
      integration: {
        autoTranscribe: config.integration?.autoTranscribe !== false,
        autoTranslate: config.integration?.autoTranslate || false,
        defaultTargetLanguage: config.integration?.defaultTargetLanguage || 'en',
        enableNotifications: config.integration?.enableNotifications !== false,
        medicalSpecialty: config.integration?.medicalSpecialty || 'general',
        hipaaCompliant: config.integration?.hipaaCompliant !== false
      }
    };

    // Initialize services
    this.whisperService = new WhisperService(this.config.whisper);
    this.ottehrService = new OttehrService(this.config.ottehr);

    // Set up event forwarding
    this.setupEventForwarding();

    this.logInfo('WhisperOttehr Integration initialized', {
      autoTranscribe: this.config.integration.autoTranscribe,
      autoTranslate: this.config.integration.autoTranslate,
      medicalSpecialty: this.config.integration.medicalSpecialty,
      hipaaCompliant: this.config.integration.hipaaCompliant
    });
  }

  /**
   * Set up event forwarding between services
   */
  private setupEventForwarding(): void {
    // Forward Ottehr events
    this.ottehrService.on('orderCreated', (data) => this.emit('ottehrOrderCreated', data));
    this.ottehrService.on('notificationSent', (data) => this.emit('ottehrNotificationSent', data));
    this.ottehrService.on('authenticated', (data) => this.emit('ottehrAuthenticated', data));

    // Forward Whisper loading state events
    this.whisperService.onLoadingStateChange((state) => {
      this.emit('whisperLoadingStateChanged', state);
    });
  }

  /**
   * Transcribe audio with healthcare context and Ottehr integration
   */
  async transcribeWithHealthcareContext(request: AudioTranscriptionRequest): Promise<HealthcareTranscriptionResult> {
    try {
      this.logInfo('Starting healthcare transcription', { 
        patientId: request.patientId,
        encounterType: request.encounterType,
        specialty: request.specialty 
      });

      // Validate audio file
      const validation = this.whisperService.validateFile(request.audioFile);
      if (!validation.isValid) {
        throw new Error(`Audio file validation failed: ${validation.error}`);
      }

      // Prepare medical context prompt
      const medicalPrompt = this.generateMedicalPrompt(
        request.specialty || this.config.integration.medicalSpecialty || 'general',
        request.encounterType,
        request.customPrompt
      );

      // Perform transcription with medical context
      const transcriptionResult = await this.whisperService.transcribeAudio(request.audioFile, {
        prompt: medicalPrompt,
        temperature: 0.1, // Lower temperature for medical accuracy
        language: 'auto'
      });

      // Enhance result with healthcare context
      const healthcareResult: HealthcareTranscriptionResult = {
        ...transcriptionResult,
        specialty: request.specialty || this.config.integration.medicalSpecialty,
        medicalTerms: this.extractMedicalTerms(transcriptionResult.text),
        medicalConfidence: this.calculateMedicalConfidence(transcriptionResult.text),
        patientContext: request.patientId ? {
          patientId: request.patientId,
          encounterType: request.encounterType,
          timestamp: new Date().toISOString()
        } : undefined
      };

      // Handle translation if enabled
      if (this.config.integration.autoTranslate || request.targetLanguage) {
        const targetLang = request.targetLanguage || this.config.integration.defaultTargetLanguage || 'en';
        if (transcriptionResult.language !== targetLang) {
          const translation = await this.translateText(transcriptionResult.text, transcriptionResult.language || 'auto', targetLang);
          healthcareResult.translation = translation;
        }
      }

      // Send notification through Ottehr if enabled
      if (this.config.integration.enableNotifications && request.patientId) {
        await this.sendTranscriptionNotification(request.patientId, healthcareResult);
      }

      // Emit event for integration listeners
      this.emit('transcriptionCompleted', healthcareResult);

      this.logInfo('Healthcare transcription completed', {
        patientId: request.patientId,
        textLength: healthcareResult.text.length,
        medicalTermsCount: healthcareResult.medicalTerms?.length || 0,
        hasTranslation: !!healthcareResult.translation
      });

      return healthcareResult;

    } catch (error) {
      this.logError('Healthcare transcription failed', error);
      const integrationError = new Error(`Healthcare transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.emit('transcriptionError', integrationError);
      throw integrationError;
    }
  }

  /**
   * Generate medical context prompt based on specialty and encounter type
   */
  private generateMedicalPrompt(specialty: string, encounterType?: string, customPrompt?: string): string {
    if (customPrompt) {
      return customPrompt;
    }

    const basePrompt = 'Medical consultation recording with healthcare terminology including';
    
    const specialtyTerms: Record<string, string> = {
      general: 'symptoms, diagnosis, treatment, medication, vital signs',
      cardiology: 'cardiovascular terms, ECG, blood pressure, heart rate, cardiac symptoms',
      pharmacy: 'medications, dosages, drug interactions, prescriptions, pharmacy terms',
      emergency: 'emergency procedures, trauma terms, urgent care, critical symptoms',
      surgery: 'surgical procedures, anatomical terms, operative notes, post-operative care'
    };

    const encounterTerms: Record<string, string> = {
      consultation: 'patient interview, clinical assessment, medical history',
      prescription: 'medication orders, dosage instructions, drug names',
      discharge: 'discharge instructions, follow-up care, treatment plans',
      emergency: 'emergency protocols, urgent symptoms, immediate care'
    };

    let prompt = `${basePrompt} ${specialtyTerms[specialty] || specialtyTerms.general}`;
    
    if (encounterType && encounterTerms[encounterType]) {
      prompt += `, ${encounterTerms[encounterType]}`;
    }

    return prompt + '.';
  }

  /**
   * Extract medical terms from transcribed text
   */
  private extractMedicalTerms(text: string): string[] {
    const medicalTerms = [
      // Common medical terms
      'diagnosis', 'symptom', 'treatment', 'medication', 'prescription',
      'blood pressure', 'heart rate', 'temperature', 'pain', 'fever',
      'headache', 'chest pain', 'shortness of breath', 'nausea', 'fatigue',
      // Medication-related
      'dosage', 'tablet', 'capsule', 'injection', 'milligram', 'twice daily',
      // Vital signs
      'systolic', 'diastolic', 'pulse', 'oxygen saturation', 'respiratory rate',
      // Common conditions
      'hypertension', 'diabetes', 'infection', 'inflammation', 'allergic reaction'
    ];

    const foundTerms: string[] = [];
    const lowerText = text.toLowerCase();

    medicalTerms.forEach(term => {
      if (lowerText.includes(term.toLowerCase())) {
        foundTerms.push(term);
      }
    });

    return foundTerms;
  }

  /**
   * Calculate confidence score for medical content
   */
  private calculateMedicalConfidence(text: string): number {
    const medicalTerms = this.extractMedicalTerms(text);
    const textLength = text.split(' ').length;
    
    // Base confidence on presence of medical terms
    const medicalTermRatio = medicalTerms.length / Math.max(textLength / 10, 1);
    return Math.min(0.5 + medicalTermRatio * 0.5, 1.0);
  }

  /**
   * Translate text using a mock translation service
   */
  private async translateText(text: string, sourceLanguage: string, targetLanguage: string): Promise<{
    text: string;
    targetLanguage: string;
    confidence: number;
  }> {
    // Mock translation implementation
    // In production, this would integrate with a real translation service
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call

    const mockTranslations: Record<string, Record<string, string>> = {
      'en-es': {
        'The patient is experiencing chest pain': 'El paciente está experimentando dolor en el pecho',
        'Blood pressure is elevated': 'La presión arterial está elevada',
        'Take two tablets twice daily': 'Tome dos tabletas dos veces al día'
      },
      'es-en': {
        'El paciente tiene dolor de cabeza': 'The patient has a headache',
        'Tome la medicina con comida': 'Take the medicine with food'
      }
    };

    const translationKey = `${sourceLanguage}-${targetLanguage}`;
    const translations = mockTranslations[translationKey];
    
    if (translations) {
      // Try exact match first
      const exactMatch = translations[text];
      if (exactMatch) {
        return {
          text: exactMatch,
          targetLanguage,
          confidence: 0.95
        };
      }
      
      // Try partial matches
      for (const [source, target] of Object.entries(translations)) {
        if (text.includes(source)) {
          return {
            text: text.replace(source, target),
            targetLanguage,
            confidence: 0.85
          };
        }
      }
    }

    // Fallback: return original text with low confidence
    return {
      text: `[Translation to ${targetLanguage}] ${text}`,
      targetLanguage,
      confidence: 0.6
    };
  }

  /**
   * Send transcription notification through Ottehr
   */
  private async sendTranscriptionNotification(patientId: string, result: HealthcareTranscriptionResult): Promise<void> {
    try {
      const notification: Omit<OttehrNotification, 'id' | 'createdAt'> = {
        type: 'system_alert',
        recipientId: patientId,
        title: 'Audio Transcription Completed',
        message: `Audio transcription completed for ${result.specialty} encounter. ${result.medicalTerms?.length || 0} medical terms identified.`,
        data: {
          transcriptionId: `transcription_${Date.now()}`,
          textLength: result.text.length,
          medicalTermsCount: result.medicalTerms?.length || 0,
          confidence: result.confidence,
          hasTranslation: !!result.translation
        },
        channels: ['in_app']
      };

      await this.ottehrService.sendNotification(notification);
      this.logInfo('Transcription notification sent', { patientId });

    } catch (error) {
      this.logError('Failed to send transcription notification', error);
      // Don't throw error - notification failure shouldn't break transcription
    }
  }

  /**
   * Create a healthcare order with transcription data
   */
  async createOrderWithTranscription(
    orderId: string,
    transcriptionResult: HealthcareTranscriptionResult
  ): Promise<OttehrApiResponse> {
    try {
      const orderData = {
        customerId: transcriptionResult.patientContext?.patientId || 'unknown',
        items: [],
        totalAmount: 0,
        currency: 'USD',
        metadata: {
          transcriptionData: {
            text: transcriptionResult.text,
            language: transcriptionResult.language,
            confidence: transcriptionResult.confidence,
            medicalTerms: transcriptionResult.medicalTerms,
            specialty: transcriptionResult.specialty,
            translation: transcriptionResult.translation
          },
          encounterType: transcriptionResult.patientContext?.encounterType,
          timestamp: transcriptionResult.patientContext?.timestamp
        }
      };

      const result = await this.ottehrService.createOrder(orderData);
      
      if (result.success) {
        this.emit('orderWithTranscriptionCreated', { orderId, transcriptionResult, orderResult: result });
      }

      return result;

    } catch (error) {
      this.logError('Failed to create order with transcription', error);
      throw error;
    }
  }

  /**
   * Get transcription history for a patient
   */
  async getPatientTranscriptionHistory(patientId: string): Promise<HealthcareTranscriptionResult[]> {
    // Mock implementation - in production this would query a database
    // For now, return empty array
    this.logInfo('Retrieving transcription history', { patientId });
    return [];
  }

  /**
   * Validate integration configuration
   */
  validateConfiguration(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check Whisper configuration
    if (!this.config.whisper.apiUrl || this.config.whisper.apiUrl.trim() === '') {
      errors.push('Whisper API URL is required');
    }

    // Check Ottehr configuration
    if (!this.config.ottehr.apiBaseUrl || this.config.ottehr.apiBaseUrl.trim() === '') {
      errors.push('Ottehr API base URL is required');
    }

    const hasApiKey = this.config.ottehr.apiKey && this.config.ottehr.apiKey.trim() !== '';
    const hasOAuthCreds = this.config.ottehr.clientId && 
                         this.config.ottehr.clientId.trim() !== '' &&
                         this.config.ottehr.clientSecret && 
                         this.config.ottehr.clientSecret.trim() !== '';

    if (!hasApiKey && !hasOAuthCreds) {
      errors.push('Either Ottehr API key or OAuth client credentials are required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get integration health status
   */
  async getHealthStatus(): Promise<{
    whisper: { status: string; error?: string };
    ottehr: { status: string; error?: string };
    integration: { status: string; configValid: boolean };
  }> {
    const health = {
      whisper: { status: 'unknown' as string, error: undefined as string | undefined },
      ottehr: { status: 'unknown' as string, error: undefined as string | undefined },
      integration: { status: 'healthy' as string, configValid: false }
    };

    // Check Whisper service
    try {
      // Simple configuration check for Whisper
      health.whisper.status = this.config.whisper.apiUrl ? 'healthy' : 'error';
      if (!this.config.whisper.apiUrl) {
        health.whisper.error = 'API URL not configured';
      }
    } catch (error) {
      health.whisper.status = 'error';
      health.whisper.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // Check Ottehr service
    try {
      const ottehrHealth = await this.ottehrService.getHealthStatus();
      health.ottehr.status = ottehrHealth.success ? 'healthy' : 'error';
      if (!ottehrHealth.success) {
        health.ottehr.error = ottehrHealth.error?.message || 'Health check failed';
      }
    } catch (error) {
      health.ottehr.status = 'error';
      health.ottehr.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // Check integration configuration
    const configValidation = this.validateConfiguration();
    health.integration.configValid = configValidation.isValid;
    if (!configValidation.isValid) {
      health.integration.status = 'error';
    }

    return health;
  }

  /**
   * Update integration configuration
   */
  updateConfiguration(newConfig: Partial<WhisperOttehrConfig>): void {
    if (newConfig.whisper) {
      this.config.whisper = { ...this.config.whisper, ...newConfig.whisper };
      this.whisperService.updateConfig(newConfig.whisper);
    }

    if (newConfig.ottehr) {
      this.config.ottehr = { ...this.config.ottehr, ...newConfig.ottehr };
      this.ottehrService.updateConfig(newConfig.ottehr);
    }

    if (newConfig.integration) {
      this.config.integration = { ...this.config.integration, ...newConfig.integration };
    }

    this.logInfo('Configuration updated');
  }

  /**
   * Get current configuration (without sensitive data)
   */
  getConfiguration(): Omit<Required<WhisperOttehrConfig>, 'ottehr'> & {
    ottehr: Omit<Required<OttehrConfig>, 'apiKey' | 'clientSecret' | 'webhookSecret'>;
  } {
    return {
      whisper: this.config.whisper,
      integration: this.config.integration,
      ottehr: this.ottehrService.getConfig()
    };
  }

  /**
   * Logging utility
   */
  private logInfo(message: string, data?: any): void {
    console.log(`[WhisperOttehr Integration] ${message}`, data || '');
  }

  /**
   * Error logging utility
   */
  private logError(message: string, error?: any): void {
    console.error(`[WhisperOttehr Integration] ${message}`, error || '');
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.removeAllListeners();
    this.whisperService.updateConfig({ timeout: 0 }); // Cancel any pending requests
    this.ottehrService.destroy();
    this.logInfo('Integration service destroyed');
  }
}

/**
 * Default integration instance for easy importing
 */
export let whisperOttehrIntegration: WhisperOttehrIntegration | null = null;

// Create default instance only if both services are configured
if (typeof process !== 'undefined' && process.env) {
  const hasWhisperConfig = process.env.WHISPER_API_URL;
  const hasOttehrConfig = process.env.OTTEHR_API_KEY || (process.env.OTTEHR_CLIENT_ID && process.env.OTTEHR_CLIENT_SECRET);
  
  if (hasWhisperConfig && hasOttehrConfig) {
    try {
      whisperOttehrIntegration = new WhisperOttehrIntegration();
    } catch (error) {
      console.warn('[WhisperOttehr Integration] Failed to create default instance:', error instanceof Error ? error.message : 'Unknown error');
      whisperOttehrIntegration = null;
    }
  }
}

export default whisperOttehrIntegration;