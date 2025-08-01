/**
 * @fileoverview Whisper-OpenEMR Integration Service
 * 
 * This service integrates OpenAI Whisper speech recognition with OpenEMR,
 * enabling healthcare providers to dictate clinical notes, patient interactions,
 * and other medical documentation directly into OpenEMR fields.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { WhisperService, WhisperResponse, WhisperError } from '../../../services/whisperService';
import { WhisperStreamingService } from '../../../services/whisperStreamingService';
import { OpenEMRIntegration } from './integration';
import type { 
  OpenEMRConfig, 
  OpenEMROperationResult,
  OpenEMRPatient,
  OpenEMREncounter
} from '../types';

/**
 * Configuration for Whisper-OpenEMR integration
 */
export interface WhisperOpenEMRConfig {
  /** OpenEMR configuration */
  openemr: OpenEMRConfig;
  /** Whisper service configuration */
  whisper?: {
    timeout?: number;
    maxFileSize?: number;
    allowedFileTypes?: string[];
  };
  /** Clinical transcription settings */
  clinical?: {
    /** Enable medical vocabulary enhancement */
    useMedicalVocabulary?: boolean;
    /** Default language for transcription */
    defaultLanguage?: string;
    /** Temperature setting for medical accuracy (lower = more consistent) */
    medicalTemperature?: number;
    /** Enable automatic de-identification of PHI */
    enablePHIProtection?: boolean;
  };
  /** Integration features */
  features?: {
    /** Enable real-time streaming transcription */
    enableStreaming?: boolean;
    /** Auto-save transcriptions to encounter notes */
    autoSaveToEncounter?: boolean;
    /** Enable audit logging for transcriptions */
    enableAuditLogging?: boolean;
  };
}

/**
 * Clinical transcription context
 */
export interface ClinicalTranscriptionContext {
  /** Patient ID */
  patientId: string;
  /** Encounter ID (optional) */
  encounterId?: string;
  /** Provider ID */
  providerId: string;
  /** Transcription type */
  transcriptionType: 'encounter_note' | 'history' | 'assessment' | 'plan' | 'medication_note' | 'general';
  /** Additional context for medical vocabulary */
  clinicalContext?: string;
}

/**
 * Transcription result with clinical metadata
 */
export interface ClinicalTranscriptionResult {
  /** Transcribed text */
  text: string;
  /** Original transcription response */
  whisperResponse: WhisperResponse;
  /** Clinical context used */
  context: ClinicalTranscriptionContext;
  /** Timestamp */
  timestamp: Date;
  /** Encounter ID where saved (if applicable) */
  savedToEncounterId?: string;
  /** Any PHI protection applied */
  phiProtectionApplied?: boolean;
}

/**
 * Medical vocabulary prompts for different clinical contexts
 */
const MEDICAL_VOCABULARY_PROMPTS = {
  encounter_note: 'Clinical encounter note with medical terms including chief complaint, history of present illness, examination findings, assessment, and plan',
  history: 'Patient medical history including past medical history, family history, social history, medications, and allergies',
  assessment: 'Clinical assessment and diagnosis with medical terminology, differential diagnosis, and clinical reasoning',
  plan: 'Treatment plan including medications with dosages, procedures, follow-up instructions, and patient education',
  medication_note: 'Medication administration, dosages, side effects, drug interactions, and pharmacy instructions',
  general: 'General medical documentation with healthcare terminology and clinical abbreviations'
};

/**
 * Whisper-OpenEMR Integration Service
 * 
 * Provides seamless integration between Whisper speech recognition and OpenEMR
 * for clinical documentation and patient interaction recording.
 */
export class WhisperOpenEMRIntegration {
  private whisperService: WhisperService;
  private streamingService?: WhisperStreamingService;
  private openemrService: OpenEMRIntegration;
  private config: WhisperOpenEMRConfig;

  constructor(config: WhisperOpenEMRConfig) {
    this.config = {
      ...config,
      clinical: {
        useMedicalVocabulary: true,
        defaultLanguage: 'en',
        medicalTemperature: 0.1, // Lower temperature for medical accuracy
        enablePHIProtection: true,
        ...config.clinical
      },
      features: {
        enableStreaming: true,
        autoSaveToEncounter: true,
        enableAuditLogging: true,
        ...config.features
      }
    };

    // Initialize services
    this.whisperService = new WhisperService(this.config.whisper);
    this.openemrService = new OpenEMRIntegration(this.config.openemr);

    // Initialize streaming service if enabled
    if (this.config.features?.enableStreaming) {
      this.streamingService = new WhisperStreamingService({
        language: this.config.clinical?.defaultLanguage || 'en'
      });
    }
  }

  /**
   * Initialize the integration
   */
  async initialize(): Promise<void> {
    await this.openemrService.initialize();
    this.log('Whisper-OpenEMR integration initialized successfully');
  }

  /**
   * Transcribe audio file in clinical context
   */
  async transcribeClinicalAudio(
    audioFile: File,
    context: ClinicalTranscriptionContext
  ): Promise<ClinicalTranscriptionResult> {
    this.log('Starting clinical audio transcription', { 
      patientId: context.patientId, 
      type: context.transcriptionType 
    });

    try {
      // Validate patient exists in OpenEMR
      const patientResult = await this.openemrService.getPatient(context.patientId);
      if (!patientResult.success) {
        throw new Error(`Patient not found in OpenEMR: ${context.patientId}`);
      }

      // Prepare transcription options with medical vocabulary
      const transcriptionOptions = this.prepareMedicalTranscriptionOptions(context);

      // Perform transcription
      const whisperResponse = await this.whisperService.transcribeAudio(
        audioFile,
        transcriptionOptions
      );

      // Apply PHI protection if enabled
      let finalText = whisperResponse.text;
      let phiProtectionApplied = false;

      if (this.config.clinical?.enablePHIProtection) {
        const { text: protectedText, applied } = this.applyPHIProtection(whisperResponse.text);
        finalText = protectedText;
        phiProtectionApplied = applied;
      }

      // Create result
      const result: ClinicalTranscriptionResult = {
        text: finalText,
        whisperResponse,
        context,
        timestamp: new Date(),
        phiProtectionApplied
      };

      // Auto-save to encounter if enabled
      if (this.config.features?.autoSaveToEncounter && context.encounterId) {
        await this.saveTranscriptionToEncounter(result, context.encounterId);
        result.savedToEncounterId = context.encounterId;
      }

      // Audit logging
      if (this.config.features?.enableAuditLogging) {
        this.auditLog('clinical_transcription_completed', {
          patientId: context.patientId,
          transcriptionType: context.transcriptionType,
          textLength: finalText.length,
          phiProtectionApplied
        });
      }

      this.log('Clinical transcription completed successfully');
      return result;

    } catch (error) {
      this.log('Clinical transcription failed:', error);
      
      if (this.config.features?.enableAuditLogging) {
        this.auditLog('clinical_transcription_failed', {
          patientId: context.patientId,
          error: error.message
        });
      }

      throw error;
    }
  }

  /**
   * Start real-time clinical transcription
   */
  async startStreamingTranscription(
    context: ClinicalTranscriptionContext,
    callbacks: {
      onTranscription?: (text: string, isFinal: boolean) => void;
      onError?: (error: Error) => void;
      onStateChange?: (isRecording: boolean) => void;
    }
  ): Promise<void> {
    if (!this.streamingService) {
      throw new Error('Streaming transcription is not enabled');
    }

    this.log('Starting streaming clinical transcription', { 
      patientId: context.patientId, 
      type: context.transcriptionType 
    });

    try {
      // Validate patient exists
      const patientResult = await this.openemrService.getPatient(context.patientId);
      if (!patientResult.success) {
        throw new Error(`Patient not found in OpenEMR: ${context.patientId}`);
      }

      // Configure streaming service with medical vocabulary
      const prompt = this.getMedicalVocabularyPrompt(context.transcriptionType);
      
      // Start streaming with clinical context
      await this.streamingService.startTranscription();

      // Set up event handlers
      this.streamingService.onFinalResult = (text: string, confidence: number, language: string) => {
        let finalText = text;
        
        // Apply PHI protection if enabled
        if (this.config.clinical?.enablePHIProtection) {
          const { text: protectedText } = this.applyPHIProtection(text);
          finalText = protectedText;
        }

        callbacks.onTranscription?.(finalText, true);

        // Auto-save if enabled and encounter ID provided
        if (this.config.features?.autoSaveToEncounter && context.encounterId) {
          this.saveStreamingTranscriptionToEncounter(finalText, context, confidence, language);
        }
      };

      this.streamingService.onError = (error: Error) => {
        this.log('Streaming transcription error:', error);
        callbacks.onError?.(error);
      };

      callbacks.onStateChange?.(true);

    } catch (error) {
      this.log('Failed to start streaming transcription:', error);
      callbacks.onError?.(error as Error);
    }
  }

  /**
   * Stop streaming transcription
   */
  async stopStreamingTranscription(): Promise<void> {
    if (!this.streamingService) {
      return;
    }

    await this.streamingService.stopTranscription();
    this.log('Stopped streaming clinical transcription');
  }

  /**
   * Save transcription directly to encounter notes
   */
  async saveTranscriptionToEncounter(
    transcription: ClinicalTranscriptionResult,
    encounterId: string
  ): Promise<OpenEMROperationResult<void>> {
    this.log(`Saving transcription to encounter: ${encounterId}`);

    try {
      // Format clinical note
      const clinicalNote = this.formatClinicalNote(transcription);

      // Save using OpenEMR API (implementation depends on OpenEMR's note API)
      // This is a placeholder - actual implementation would use OpenEMR's specific endpoints
      const result = await this.saveEncounterNote(encounterId, clinicalNote, transcription.context.transcriptionType);

      if (this.config.features?.enableAuditLogging) {
        this.auditLog('transcription_saved_to_encounter', {
          encounterId,
          patientId: transcription.context.patientId,
          transcriptionType: transcription.context.transcriptionType
        });
      }

      return result;

    } catch (error) {
      this.log('Failed to save transcription to encounter:', error);
      return {
        success: false,
        error: {
          code: 'ENCOUNTER_SAVE_FAILED',
          message: error.message
        }
      };
    }
  }

  /**
   * Get transcription history for a patient
   */
  async getPatientTranscriptionHistory(
    patientId: string,
    options?: {
      fromDate?: Date;
      toDate?: Date;
      transcriptionType?: string;
      limit?: number;
    }
  ): Promise<ClinicalTranscriptionResult[]> {
    // Implementation would depend on how transcriptions are stored in OpenEMR
    // This is a placeholder for the actual implementation
    this.log(`Getting transcription history for patient: ${patientId}`);
    return [];
  }

  // Private helper methods

  private prepareMedicalTranscriptionOptions(context: ClinicalTranscriptionContext) {
    const options: any = {
      language: this.config.clinical?.defaultLanguage || 'en',
      temperature: this.config.clinical?.medicalTemperature || 0.1
    };

    // Add medical vocabulary prompt if enabled
    if (this.config.clinical?.useMedicalVocabulary) {
      options.prompt = this.getMedicalVocabularyPrompt(context.transcriptionType);
      
      // Add clinical context if provided
      if (context.clinicalContext) {
        options.prompt += `. Additional context: ${context.clinicalContext}`;
      }
    }

    return options;
  }

  private getMedicalVocabularyPrompt(transcriptionType: string): string {
    return MEDICAL_VOCABULARY_PROMPTS[transcriptionType as keyof typeof MEDICAL_VOCABULARY_PROMPTS] || 
           MEDICAL_VOCABULARY_PROMPTS.general;
  }

  private applyPHIProtection(text: string): { text: string; applied: boolean } {
    // Basic PHI protection - in production, this would be more sophisticated
    let protectedText = text;
    let applied = false;

    // Common PHI patterns to redact (simplified)
    const phiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/g, // SSN pattern
      /\b\d{10,}\b/g, // Phone numbers (simplified)
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email addresses
    ];

    phiPatterns.forEach(pattern => {
      if (pattern.test(protectedText)) {
        protectedText = protectedText.replace(pattern, '[REDACTED]');
        applied = true;
      }
    });

    return { text: protectedText, applied };
  }

  private formatClinicalNote(transcription: ClinicalTranscriptionResult): string {
    const timestamp = transcription.timestamp.toISOString();
    const type = transcription.context.transcriptionType.replace('_', ' ').toUpperCase();
    
    return `[${type} - Voice Transcription - ${timestamp}]\n${transcription.text}\n\n`;
  }

  private async saveEncounterNote(
    encounterId: string, 
    note: string, 
    type: string
  ): Promise<OpenEMROperationResult<void>> {
    // Placeholder implementation - actual implementation would use OpenEMR's note API
    // This would typically be a POST to something like /apis/default/api/encounter/{encounterId}/note
    
    try {
      // Example implementation structure:
      const noteData = {
        encounter_id: encounterId,
        note_type: type,
        note_text: note,
        created_by: 'whisper_integration',
        created_date: new Date().toISOString()
      };

      // In real implementation, this would be an authenticated request to OpenEMR
      // const response = await this.openemrService.authenticatedRequest(
      //   'POST',
      //   `/apis/default/api/encounter/${encounterId}/note`,
      //   noteData
      // );

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NOTE_SAVE_FAILED',
          message: error.message
        }
      };
    }
  }

  private async saveStreamingTranscriptionToEncounter(
    text: string,
    context: ClinicalTranscriptionContext,
    confidence: number,
    language: string
  ): Promise<void> {
    // Auto-save streaming transcription (debounced in real implementation)
    const result: ClinicalTranscriptionResult = {
      text,
      whisperResponse: { text, confidence, language },
      context,
      timestamp: new Date()
    };

    if (context.encounterId) {
      await this.saveTranscriptionToEncounter(result, context.encounterId);
    }
  }

  private auditLog(action: string, details: any): void {
    if (this.config.features?.enableAuditLogging) {
      this.log(`[AUDIT] ${action}:`, details);
      // In production, this would send to a proper audit logging system
    }
  }

  private log(message: string, ...args: any[]): void {
    if (this.config.openemr.debug) {
      console.log(`[Whisper-OpenEMR Integration] ${message}`, ...args);
    }
  }
}

export default WhisperOpenEMRIntegration;