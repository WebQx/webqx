/**
 * Batch Transcription Overlay Service
 * Integrates Whisper transcription with PACS imaging for multilingual medical overlays
 */

import { EventEmitter } from 'events';
import { PACSService, DICOMImage, TranscriptionOverlay } from './pacsService';
import { WhisperService } from './whisperService';
import { AuditLogger } from '../ehr-integrations/services/auditLogger';

export interface BatchOverlayConfig {
  maxConcurrentProcessing: number;
  supportedLanguages: string[];
  defaultLanguage: string;
  overlayOpacity: number;
  fontSizes: {
    small: number;
    medium: number;
    large: number;
  };
  auditLogging: boolean;
  autoSaveEnabled: boolean;
}

export interface BatchJob {
  id: string;
  name: string;
  imageIds: string[];
  audioFiles: { imageId: string; audioFile: File | Buffer; language?: string }[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  startTime?: Date;
  endTime?: Date;
  results: TranscriptionOverlay[];
  errors: string[];
}

export interface OverlaySettings {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'custom';
  customPosition?: { x: number; y: number };
  fontSize: 'small' | 'medium' | 'large';
  backgroundColor: string;
  textColor: string;
  opacity: number;
  padding: number;
  borderRadius: number;
  maxWidth: number;
  showSpeaker: boolean;
  showTimestamp: boolean;
  showConfidence: boolean;
}

export class BatchTranscriptionOverlayService extends EventEmitter {
  private config: BatchOverlayConfig;
  private pacsService: PACSService;
  private whisperService: WhisperService;
  private auditLogger?: AuditLogger;
  private jobs: Map<string, BatchJob> = new Map();
  private overlayStorage: Map<string, TranscriptionOverlay[]> = new Map();

  constructor(
    config: BatchOverlayConfig,
    pacsService: PACSService,
    whisperService: WhisperService
  ) {
    super();
    this.config = {
      maxConcurrentProcessing: config.maxConcurrentProcessing ?? 3,
      supportedLanguages: config.supportedLanguages ?? ['en', 'es', 'fr', 'de', 'zh', 'ja', 'ko', 'ar', 'hi', 'pt', 'it', 'ru'],
      defaultLanguage: config.defaultLanguage ?? 'en',
      overlayOpacity: config.overlayOpacity ?? 0.8,
      fontSizes: config.fontSizes ?? { small: 12, medium: 16, large: 20 },
      auditLogging: config.auditLogging ?? true,
      autoSaveEnabled: config.autoSaveEnabled ?? true
    };

    this.pacsService = pacsService;
    this.whisperService = whisperService;

    if (this.config.auditLogging) {
      this.auditLogger = new AuditLogger({
        enabled: true,
        logToConsole: true,
        maxInMemoryEntries: 1000
      });
    }

    this.logInfo('Batch Transcription Overlay Service initialized', { config: this.config });
  }

  /**
   * Create a new batch transcription job
   */
  async createBatchJob(
    name: string,
    imageIds: string[],
    audioFiles: { imageId: string; audioFile: File | Buffer; language?: string }[]
  ): Promise<string> {
    const jobId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job: BatchJob = {
      id: jobId,
      name,
      imageIds,
      audioFiles,
      status: 'pending',
      progress: 0,
      results: [],
      errors: []
    };

    this.jobs.set(jobId, job);

    this.auditLogger?.log({
      action: 'system_backup', // Using closest available action for batch job operations
      resourceType: 'batch_transcription_job',
      resourceId: jobId,
      success: true,
      context: {
        jobName: name,
        imageCount: imageIds.length,
        audioFileCount: audioFiles.length,
        timestamp: new Date().toISOString()
      }
    });

    this.emit('jobCreated', { jobId, job });
    return jobId;
  }

  /**
   * Start processing a batch job
   */
  async processBatchJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status !== 'pending') {
      throw new Error(`Job ${jobId} is not in pending status`);
    }

    job.status = 'processing';
    job.startTime = new Date();
    job.progress = 0;

    this.auditLogger?.log({
      action: 'system_backup',
      resourceType: 'batch_transcription_job',
      resourceId: jobId,
      success: true,
      context: {
        operation: 'job_started',
        timestamp: new Date().toISOString()
      }
    });

    this.emit('jobStarted', { jobId, job });

    try {
      const totalItems = job.audioFiles.length;
      let completedItems = 0;

      // Process audio files in batches based on maxConcurrentProcessing
      for (let i = 0; i < job.audioFiles.length; i += this.config.maxConcurrentProcessing) {
        const batch = job.audioFiles.slice(i, i + this.config.maxConcurrentProcessing);
        
        const batchPromises = batch.map(async (audioItem) => {
          try {
            const overlay = await this.processAudioForImage(
              audioItem.imageId,
              audioItem.audioFile,
              audioItem.language || this.config.defaultLanguage
            );
            
            job.results.push(overlay);
            completedItems++;
            job.progress = Math.round((completedItems / totalItems) * 100);
            
            this.emit('jobProgress', { jobId, progress: job.progress, overlay });
            
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            job.errors.push(`Error processing ${audioItem.imageId}: ${errorMessage}`);
            this.auditLogger?.log({
              action: 'system_backup',
              resourceType: 'batch_transcription_item',
              resourceId: audioItem.imageId,
              success: false,
              errorMessage,
              context: {
                operation: 'batch_item_error',
                jobId,
                imageId: audioItem.imageId,
                error: errorMessage,
                timestamp: new Date().toISOString()
              }
            });
          }
        });

        await Promise.all(batchPromises);
      }

      job.status = job.errors.length > 0 ? 'failed' : 'completed';
      job.endTime = new Date();
      job.progress = 100;

      if (this.config.autoSaveEnabled) {
        await this.saveOverlaysToStorage(jobId, job.results);
      }

      this.auditLogger?.log({
        action: 'system_backup',
        resourceType: 'batch_transcription_job',
        resourceId: jobId,
        success: job.status === 'completed',
        context: {
          operation: job.status === 'completed' ? 'job_completed' : 'job_failed',
          status: job.status,
          resultCount: job.results.length,
          errorCount: job.errors.length,
          duration: job.endTime.getTime() - job.startTime!.getTime(),
          timestamp: new Date().toISOString()
        }
      });

      if (job.status === 'failed') {
        this.emit('jobFailed', { jobId, job, error: new Error(`Job failed with ${job.errors.length} errors`) });
      } else {
        this.emit('jobCompleted', { jobId, job });
      }

    } catch (error) {
      job.status = 'failed';
      job.endTime = new Date();
      const errorMessage = error instanceof Error ? error.message : String(error);
      job.errors.push(`Job failed: ${errorMessage}`);

      this.auditLogger?.log({
        action: 'system_backup',
        resourceType: 'batch_transcription_job',
        resourceId: jobId,
        success: false,
        errorMessage,
        context: {
          operation: 'job_failed',
          error: errorMessage,
          timestamp: new Date().toISOString()
        }
      });

      this.emit('jobFailed', { jobId, job, error });
    }
  }

  /**
   * Process audio file for a specific image
   */
  private async processAudioForImage(
    imageId: string,
    audioFile: File | Buffer,
    language: string
  ): Promise<TranscriptionOverlay> {
    try {
      // Transcribe audio using Whisper service
      const transcriptionResult = await this.whisperService.transcribeAudio(audioFile, {
        language: language === 'auto' ? undefined : language,
        temperature: 0.2,
        prompt: 'Medical imaging description with anatomical and clinical terminology'
      });

      // Create overlay data
      const overlay: TranscriptionOverlay = {
        imageId,
        transcription: transcriptionResult.text,
        language: transcriptionResult.language || language,
        confidence: this.calculateConfidence(transcriptionResult),
        timestamp: new Date(),
        position: this.getDefaultOverlayPosition(),
        speaker: 'Unknown', // WhisperResponse doesn't include segment info
        annotations: this.extractMedicalTerms(transcriptionResult.text)
      };

      return overlay;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to process audio for image ${imageId}: ${errorMessage}`);
    }
  }

  /**
   * Apply overlay to image with custom settings
   */
  async applyOverlayToImage(
    imageId: string,
    overlay: TranscriptionOverlay,
    settings: OverlaySettings
  ): Promise<{ success: boolean; overlayImageUrl?: string }> {
    try {
      this.auditLogger?.log({
        action: 'edit_patient_data',
        resourceType: 'transcription_overlay',
        resourceId: `${imageId}_${overlay.timestamp.getTime()}`,
        success: true,
        context: {
          operation: 'overlay_applied',
          imageId,
          overlayId: `${imageId}_${overlay.timestamp.getTime()}`,
          language: overlay.language,
          timestamp: new Date().toISOString()
        }
      });

      // In a real implementation, this would use image processing libraries
      // to overlay text on the DICOM image. For now, we'll simulate this.
      const overlayImageUrl = this.generateOverlayImageUrl(imageId, overlay, settings);

      return {
        success: true,
        overlayImageUrl
      };

    } catch (error) {
      this.auditLogger?.log({
        action: 'edit_patient_data',
        resourceType: 'OVERLAY_GENERATION',
        resourceId: imageId,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        context: {
          imageId,
          timestamp: new Date().toISOString()
        }
      });

      return { success: false };
    }
  }

  /**
   * Get all overlays for an image
   */
  getImageOverlays(imageId: string): TranscriptionOverlay[] {
    return this.overlayStorage.get(imageId) || [];
  }

  /**
   * Save overlays to storage
   */
  private async saveOverlaysToStorage(jobId: string, overlays: TranscriptionOverlay[]): Promise<void> {
    overlays.forEach(overlay => {
      const existingOverlays = this.overlayStorage.get(overlay.imageId) || [];
      existingOverlays.push(overlay);
      this.overlayStorage.set(overlay.imageId, existingOverlays);
    });

    this.auditLogger?.log({
      action: 'system_backup',
      resourceType: 'transcription_overlay_storage',
      resourceId: jobId,
      success: true,
      context: {
        operation: 'overlays_saved',
        overlayCount: overlays.length,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): BatchJob | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Get all jobs
   */
  getAllJobs(): BatchJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'processing') {
      return false;
    }

    job.status = 'failed';
    job.endTime = new Date();
    job.errors.push('Job cancelled by user');

    this.auditLogger?.log({
      action: 'system_backup',
      resourceType: 'batch_transcription_job',
      resourceId: jobId,
      success: false,
      context: {
        operation: 'job_cancelled',
        timestamp: new Date().toISOString()
      }
    });

    this.emit('jobCancelled', { jobId, job });
    return true;
  }

  /**
   * Delete a job and its results
   */
  deleteJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    // Remove overlays from storage
    job.results.forEach(overlay => {
      const overlays = this.overlayStorage.get(overlay.imageId) || [];
      const filtered = overlays.filter(o => o.timestamp !== overlay.timestamp);
      this.overlayStorage.set(overlay.imageId, filtered);
    });

    this.jobs.delete(jobId);

    this.auditLogger?.log({
      action: 'delete_patient',
      resourceType: 'batch_transcription_job',
      resourceId: jobId,
      success: true,
      context: {
        operation: 'job_deleted',
        timestamp: new Date().toISOString()
      }
    });

    this.emit('jobDeleted', { jobId });
    return true;
  }

  /**
   * Generate supported languages list
   */
  getSupportedLanguages(): { code: string; name: string; rtl: boolean }[] {
    const languageMap: { [key: string]: { name: string; rtl: boolean } } = {
      'en': { name: 'English', rtl: false },
      'es': { name: 'Spanish', rtl: false },
      'fr': { name: 'French', rtl: false },
      'de': { name: 'German', rtl: false },
      'zh': { name: 'Chinese', rtl: false },
      'ja': { name: 'Japanese', rtl: false },
      'ko': { name: 'Korean', rtl: false },
      'ar': { name: 'Arabic', rtl: true },
      'hi': { name: 'Hindi', rtl: false },
      'pt': { name: 'Portuguese', rtl: false },
      'it': { name: 'Italian', rtl: false },
      'ru': { name: 'Russian', rtl: false }
    };

    return this.config.supportedLanguages.map(code => ({
      code,
      ...languageMap[code] || { name: code.toUpperCase(), rtl: false }
    }));
  }

  /**
   * Helper methods
   */
  private calculateConfidence(transcriptionResult: any): number {
    // Simulate confidence calculation based on transcription quality
    const textLength = transcriptionResult.text.length;
    const baseConfidence = textLength > 50 ? 0.9 : 0.7;
    return Math.min(0.99, baseConfidence + Math.random() * 0.1);
  }

  private getDefaultOverlayPosition(): { x: number; y: number; width: number; height: number } {
    return {
      x: 10,
      y: 10,
      width: 300,
      height: 100
    };
  }

  private extractMedicalTerms(text: string): string[] {
    // Simple medical term extraction - in production, this would use NLP
    const medicalKeywords = [
      'diagnosis', 'symptoms', 'treatment', 'anatomy', 'pathology',
      'fracture', 'lesion', 'mass', 'normal', 'abnormal', 'findings'
    ];
    
    return medicalKeywords.filter(term => 
      text.toLowerCase().includes(term)
    );
  }

  private generateOverlayImageUrl(
    imageId: string,
    overlay: TranscriptionOverlay,
    settings: OverlaySettings
  ): string {
    // In production, this would generate an actual overlay image
    const timestamp = overlay.timestamp.getTime();
    return `/api/pacs/images/${imageId}/overlay/${timestamp}`;
  }

  private logInfo(message: string, data?: any): void {
    if (this.config.auditLogging) {
      console.log(`[Batch Overlay Service] ${message}`, data);
    }
  }
}

export default BatchTranscriptionOverlayService;