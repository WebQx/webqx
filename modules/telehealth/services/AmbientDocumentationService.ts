import { WhisperService } from '../../../services/whisperService';
import { WhisperStreamingService } from '../../../services/whisperStreamingService';
const ClinicalNote = require('../models/ClinicalNote');

/**
 * Interface for transcription session configuration
 */
interface TranscriptionSession {
  sessionId: string;
  patientId: string;
  providerId: string;
  specialtyContext?: string;
  language?: string;
  enableRealTime?: boolean;
}

/**
 * Interface for transcription result with clinical note
 */
interface AmbientDocumentationResult {
  success: boolean;
  clinicalNote?: any;
  transcriptionText?: string;
  metadata?: any;
  error?: string;
}

/**
 * Ambient Documentation Service
 * 
 * Integrates Whisper transcription with FHIR ClinicalNote creation
 * for telehealth sessions, providing ambient clinical documentation.
 */
export class AmbientDocumentationService {
  private whisperService: WhisperService;
  private streamingService: WhisperStreamingService | null = null;
  private activeSessions: Map<string, TranscriptionSession> = new Map();

  constructor() {
    this.whisperService = new WhisperService({
      timeout: 60000,
      maxFileSize: 50 * 1024 * 1024 // 50MB for clinical sessions
    });
  }

  /**
   * Starts an ambient documentation session for a telehealth encounter
   * @param session - Session configuration
   * @returns Promise<boolean> - Success status
   */
  async startSession(session: TranscriptionSession): Promise<boolean> {
    try {
      this.activeSessions.set(session.sessionId, session);

      if (session.enableRealTime) {
        await this.initializeRealTimeTranscription(session);
      }

      return true;
    } catch (error) {
      console.error('[Ambient Documentation] Failed to start session:', error);
      return false;
    }
  }

  /**
   * Initializes real-time transcription for a session
   * @param session - Session configuration
   */
  private async initializeRealTimeTranscription(session: TranscriptionSession): Promise<void> {
    const specialtyPrompts = this.getSpecialtyPrompts(session.specialtyContext);
    
    this.streamingService = new WhisperStreamingService({
      chunkDuration: 3,
      enableVAD: true,
      language: session.language || 'auto',
      continuous: true
    }, {
      onFinalResult: async (text: string, confidence: number, language: string) => {
        await this.handleRealTimeTranscription(session.sessionId, text, {
          confidence,
          language,
          timestamp: new Date().toISOString()
        });
      },
      onError: (error: Error) => {
        console.error('[Ambient Documentation] Real-time transcription error:', error);
      }
    });

    // Set medical context for better transcription accuracy
    if (specialtyPrompts.prompt) {
      (this.streamingService as any).setPrompt(specialtyPrompts.prompt);
    }

    await this.streamingService.startTranscription();
  }

  /**
   * Handles real-time transcription segments
   * @param sessionId - Session ID
   * @param text - Transcribed text
   * @param metadata - Transcription metadata
   */
  private async handleRealTimeTranscription(sessionId: string, text: string, metadata: any): Promise<void> {
    // Store real-time segments for later clinical note creation
    // In a production system, this would be stored in a database
    console.log(`[Session ${sessionId}] Real-time transcription:`, text);
    
    // Optionally create interim clinical notes or accumulate for final note
    // This could trigger live documentation updates in the provider interface
  }

  /**
   * Processes uploaded audio file and creates clinical note
   * @param audioFile - Audio file to transcribe
   * @param session - Session configuration
   * @returns Promise<AmbientDocumentationResult>
   */
  async processAudioFile(audioFile: File, session: TranscriptionSession): Promise<AmbientDocumentationResult> {
    try {
      const specialtyPrompts = this.getSpecialtyPrompts(session.specialtyContext);
      
      // Transcribe audio using Whisper
      const transcriptionResult = await this.whisperService.transcribeAudio(audioFile, {
        language: session.language || 'auto',
        temperature: 0.1, // Lower temperature for medical accuracy
        prompt: specialtyPrompts.prompt
      });

      if (!transcriptionResult.success) {
        return {
          success: false,
          error: transcriptionResult.error || 'Transcription failed'
        };
      }

      // Create FHIR ClinicalNote from transcription
      const clinicalNote = await this.createClinicalNote(
        transcriptionResult.text,
        session,
        {
          confidence: transcriptionResult.confidence,
          language: transcriptionResult.language,
          processingTime: transcriptionResult.processingTime,
          model: 'whisper-1',
          segments: transcriptionResult.segments || []
        }
      );

      return {
        success: true,
        clinicalNote: clinicalNote.toJSON(),
        transcriptionText: transcriptionResult.text,
        metadata: {
          confidence: transcriptionResult.confidence,
          language: transcriptionResult.language,
          processingTime: transcriptionResult.processingTime
        }
      };

    } catch (error) {
      console.error('[Ambient Documentation] Audio processing failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Creates a FHIR ClinicalNote from transcription text
   * @param transcriptionText - Transcribed text
   * @param session - Session configuration
   * @param transcriptionMetadata - Metadata from transcription
   * @returns ClinicalNote instance
   */
  private async createClinicalNote(
    transcriptionText: string,
    session: TranscriptionSession,
    transcriptionMetadata: any
  ): Promise<any> {
    const clinicalNote = ClinicalNote.fromTranscription(transcriptionText, {
      patientId: session.patientId,
      authorId: session.providerId,
      sessionId: session.sessionId,
      description: `Ambient clinical documentation from telehealth session - ${session.specialtyContext || 'General'}`,
      transcriptionMetadata
    });

    // Add specialty-specific structured content if available
    const structuredContent = await this.extractStructuredContent(transcriptionText, session.specialtyContext);
    if (structuredContent) {
      clinicalNote.setStructuredContent(structuredContent);
    }

    // Validate the clinical note
    const validation = clinicalNote.validate();
    if (!validation.isValid) {
      throw new Error(`Clinical note validation failed: ${validation.errors.join(', ')}`);
    }

    return clinicalNote;
  }

  /**
   * Extracts structured clinical data from transcription text
   * @param transcriptionText - Raw transcription text
   * @param specialtyContext - Medical specialty context
   * @returns Promise<Object|null> - Structured clinical data
   */
  private async extractStructuredContent(transcriptionText: string, specialtyContext?: string): Promise<any | null> {
    // This is a placeholder for NLP processing to extract structured data
    // In a production system, this could use medical NLP libraries or AI services
    
    const keywords = {
      symptoms: this.extractKeywords(transcriptionText, ['pain', 'fever', 'cough', 'fatigue', 'nausea']),
      diagnosis: this.extractKeywords(transcriptionText, ['diagnosed', 'condition', 'disorder', 'disease']),
      medications: this.extractKeywords(transcriptionText, ['prescribed', 'medication', 'drug', 'dosage']),
      plan: this.extractKeywords(transcriptionText, ['follow up', 'return', 'schedule', 'continue', 'discontinue'])
    };

    // Only return structured content if meaningful data was extracted
    const hasContent = Object.values(keywords).some(arr => arr.length > 0);
    
    return hasContent ? {
      extractedKeywords: keywords,
      specialtyContext,
      extractedAt: new Date().toISOString(),
      confidence: 'low' // Placeholder - would be determined by NLP analysis
    } : null;
  }

  /**
   * Simple keyword extraction helper
   * @param text - Text to search
   * @param keywords - Keywords to find
   * @returns Array of found keywords with context
   */
  private extractKeywords(text: string, keywords: string[]): any[] {
    const found: any[] = [];
    const lowerText = text.toLowerCase();
    
    keywords.forEach(keyword => {
      const index = lowerText.indexOf(keyword.toLowerCase());
      if (index !== -1) {
        // Extract context around the keyword
        const start = Math.max(0, index - 50);
        const end = Math.min(text.length, index + keyword.length + 50);
        const context = text.substring(start, end).trim();
        
        found.push({
          keyword,
          context,
          position: index
        });
      }
    });
    
    return found;
  }

  /**
   * Gets specialty-specific prompts for better transcription accuracy
   * @param specialtyContext - Medical specialty
   * @returns Object with prompt and keywords
   */
  private getSpecialtyPrompts(specialtyContext?: string): { prompt: string; keywords: string[] } {
    const prompts: { [key: string]: { prompt: string; keywords: string[] } } = {
      'primary-care': {
        prompt: 'Medical consultation with terms like vital signs, symptoms, physical examination, assessment, and treatment plan',
        keywords: ['blood pressure', 'temperature', 'heart rate', 'respiratory rate', 'chief complaint']
      },
      'cardiology': {
        prompt: 'Cardiology consultation with terms like chest pain, heart murmur, ECG, echocardiogram, arrhythmia, and cardiac catheterization',
        keywords: ['chest pain', 'palpitations', 'shortness of breath', 'ECG', 'echocardiogram']
      },
      'radiology': {
        prompt: 'Radiology consultation with terms like X-ray, CT scan, MRI, ultrasound, imaging findings, and radiological interpretation',
        keywords: ['CT scan', 'MRI', 'X-ray', 'ultrasound', 'contrast', 'imaging']
      },
      'psychiatry': {
        prompt: 'Psychiatric consultation with terms like mood, anxiety, depression, mental status, medication, and therapy',
        keywords: ['mood', 'anxiety', 'depression', 'therapy', 'mental health', 'medication']
      }
    };

    return prompts[specialtyContext || ''] || {
      prompt: 'Medical consultation with clinical terms, diagnosis, symptoms, and treatment',
      keywords: ['patient', 'symptoms', 'diagnosis', 'treatment', 'medication']
    };
  }

  /**
   * Ends an ambient documentation session
   * @param sessionId - Session ID to end
   * @returns Promise<boolean> - Success status
   */
  async endSession(sessionId: string): Promise<boolean> {
    try {
      if (this.streamingService) {
        await this.streamingService.stopTranscription();
        this.streamingService = null;
      }

      this.activeSessions.delete(sessionId);
      return true;
    } catch (error) {
      console.error('[Ambient Documentation] Failed to end session:', error);
      return false;
    }
  }

  /**
   * Gets active session information
   * @param sessionId - Session ID
   * @returns TranscriptionSession or null
   */
  getSession(sessionId: string): TranscriptionSession | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Lists all active sessions
   * @returns Array of active sessions
   */
  getActiveSessions(): TranscriptionSession[] {
    return Array.from(this.activeSessions.values());
  }
}