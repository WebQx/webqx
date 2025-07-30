/**
 * Batch Transcription Overlay Service Tests
 */

import { BatchTranscriptionOverlayService, BatchOverlayConfig } from '../batchTranscriptionOverlayService';
import { PACSService } from '../pacsService';
import { WhisperService } from '../whisperService';

// Mock dependencies
jest.mock('../pacsService');
jest.mock('../whisperService');
jest.mock('../../ehr-integrations/services/auditLogger');

describe('BatchTranscriptionOverlayService', () => {
  let overlayService: BatchTranscriptionOverlayService;
  let mockPACSService: jest.Mocked<PACSService>;
  let mockWhisperService: jest.Mocked<WhisperService>;
  let mockConfig: BatchOverlayConfig;

  beforeEach(() => {
    mockConfig = {
      maxConcurrentProcessing: 2,
      supportedLanguages: ['en', 'es', 'fr'],
      defaultLanguage: 'en',
      overlayOpacity: 0.8,
      fontSizes: { small: 12, medium: 16, large: 20 },
      auditLogging: true,
      autoSaveEnabled: true
    };

    mockPACSService = new PACSService({} as any) as jest.Mocked<PACSService>;
    mockWhisperService = new WhisperService({} as any) as jest.Mocked<WhisperService>;

    overlayService = new BatchTranscriptionOverlayService(
      mockConfig,
      mockPACSService,
      mockWhisperService
    );

    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with correct config', () => {
      expect(overlayService).toBeInstanceOf(BatchTranscriptionOverlayService);
      expect(overlayService.getSupportedLanguages()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'en', name: 'English' }),
          expect.objectContaining({ code: 'es', name: 'Spanish' }),
          expect.objectContaining({ code: 'fr', name: 'French' })
        ])
      );
    });

    test('should use default config values', () => {
      const minimalConfig = {} as BatchOverlayConfig;
      const service = new BatchTranscriptionOverlayService(
        minimalConfig,
        mockPACSService,
        mockWhisperService
      );
      expect(service).toBeInstanceOf(BatchTranscriptionOverlayService);
    });
  });

  describe('Batch Job Management', () => {
    test('should create batch job successfully', async () => {
      const imageIds = ['image-1', 'image-2'];
      const audioFiles = [
        { imageId: 'image-1', audioFile: Buffer.from('audio1'), language: 'en' },
        { imageId: 'image-2', audioFile: Buffer.from('audio2'), language: 'es' }
      ];

      const jobId = await overlayService.createBatchJob(
        'Test Job',
        imageIds,
        audioFiles
      );

      expect(jobId).toMatch(/^batch_\d+_/);
      
      const job = overlayService.getJobStatus(jobId);
      expect(job).not.toBeNull();
      expect(job!.name).toBe('Test Job');
      expect(job!.status).toBe('pending');
      expect(job!.imageIds).toEqual(imageIds);
      expect(job!.audioFiles).toHaveLength(2);
    });

    test('should emit jobCreated event', (done) => {
      overlayService.on('jobCreated', (data) => {
        expect(data.jobId).toMatch(/^batch_\d+_/);
        expect(data.job.name).toBe('Test Job');
        done();
      });

      overlayService.createBatchJob(
        'Test Job',
        ['image-1'],
        [{ imageId: 'image-1', audioFile: Buffer.from('audio1') }]
      );
    });
  });

  describe('Batch Job Processing', () => {
    test('should process batch job successfully', async () => {
      // Mock Whisper service response
      mockWhisperService.transcribeAudio.mockResolvedValue({
        text: 'Normal chest X-ray showing clear lung fields',
        language: 'en',
        segments: [{ speaker: 'radiologist' }]
      } as any);

      const audioFiles = [
        { imageId: 'image-1', audioFile: Buffer.from('audio1'), language: 'en' }
      ];

      const jobId = await overlayService.createBatchJob(
        'Test Job',
        ['image-1'],
        audioFiles
      );

      // Process the job
      await overlayService.processBatchJob(jobId);

      const job = overlayService.getJobStatus(jobId);
      expect(job!.status).toBe('completed');
      expect(job!.progress).toBe(100);
      expect(job!.results).toHaveLength(1);
      expect(job!.results[0].transcription).toBe('Normal chest X-ray showing clear lung fields');
    });

    test('should handle processing errors gracefully', async () => {
      mockWhisperService.transcribeAudio.mockRejectedValue(new Error('Transcription failed'));

      const audioFiles = [
        { imageId: 'image-1', audioFile: Buffer.from('audio1'), language: 'en' }
      ];

      const jobId = await overlayService.createBatchJob(
        'Test Job',
        ['image-1'],
        audioFiles
      );

      await overlayService.processBatchJob(jobId);

      const job = overlayService.getJobStatus(jobId);
      expect(job!.status).toBe('failed');
      expect(job!.errors).toHaveLength(1);
      expect(job!.errors[0]).toContain('Error processing image-1');
    });

    test('should emit progress events during processing', (done) => {
      let progressEvents = 0;

      overlayService.on('jobProgress', (data) => {
        progressEvents++;
        expect(data.progress).toBeGreaterThan(0);
        if (progressEvents === 1) {
          done();
        }
      });

      mockWhisperService.transcribeAudio.mockResolvedValue({
        text: 'Test transcription',
        language: 'en'
      } as any);

      const audioFiles = [
        { imageId: 'image-1', audioFile: Buffer.from('audio1'), language: 'en' }
      ];

      overlayService.createBatchJob('Test Job', ['image-1'], audioFiles)
        .then(jobId => overlayService.processBatchJob(jobId));
    });

    test('should respect maxConcurrentProcessing limit', async () => {
      mockWhisperService.transcribeAudio.mockImplementation(
        () => new Promise(resolve => 
          setTimeout(() => resolve({ text: 'Test', language: 'en' } as any), 100)
        )
      );

      const audioFiles = [
        { imageId: 'image-1', audioFile: Buffer.from('audio1'), language: 'en' },
        { imageId: 'image-2', audioFile: Buffer.from('audio2'), language: 'en' },
        { imageId: 'image-3', audioFile: Buffer.from('audio3'), language: 'en' }
      ];

      const jobId = await overlayService.createBatchJob(
        'Test Job',
        ['image-1', 'image-2', 'image-3'],
        audioFiles
      );

      const startTime = Date.now();
      await overlayService.processBatchJob(jobId);
      const endTime = Date.now();

      // With maxConcurrentProcessing = 2, it should take at least 2 batches
      expect(endTime - startTime).toBeGreaterThan(150); // Allow for processing time
    });
  });

  describe('Job Status Management', () => {
    test('should return job status correctly', async () => {
      const jobId = await overlayService.createBatchJob(
        'Test Job',
        ['image-1'],
        [{ imageId: 'image-1', audioFile: Buffer.from('audio1') }]
      );

      const status = overlayService.getJobStatus(jobId);
      expect(status).not.toBeNull();
      expect(status!.id).toBe(jobId);
      expect(status!.status).toBe('pending');
    });

    test('should return null for non-existent job', () => {
      const status = overlayService.getJobStatus('non-existent');
      expect(status).toBeNull();
    });

    test('should get all jobs', async () => {
      const jobId1 = await overlayService.createBatchJob('Job 1', ['image-1'], []);
      const jobId2 = await overlayService.createBatchJob('Job 2', ['image-2'], []);

      const allJobs = overlayService.getAllJobs();
      expect(allJobs).toHaveLength(2);
      expect(allJobs.map(job => job.id)).toContain(jobId1);
      expect(allJobs.map(job => job.id)).toContain(jobId2);
    });
  });

  describe('Job Control', () => {
    test('should cancel processing job', async () => {
      const jobId = await overlayService.createBatchJob(
        'Test Job',
        ['image-1'],
        [{ imageId: 'image-1', audioFile: Buffer.from('audio1') }]
      );

      // Start processing but don't await
      const job = overlayService.getJobStatus(jobId)!;
      job.status = 'processing';

      const cancelled = overlayService.cancelJob(jobId);
      expect(cancelled).toBe(true);

      const updatedJob = overlayService.getJobStatus(jobId);
      expect(updatedJob!.status).toBe('failed');
      expect(updatedJob!.errors).toContain('Job cancelled by user');
    });

    test('should not cancel non-processing job', async () => {
      const jobId = await overlayService.createBatchJob(
        'Test Job',
        ['image-1'],
        [{ imageId: 'image-1', audioFile: Buffer.from('audio1') }]
      );

      const cancelled = overlayService.cancelJob(jobId);
      expect(cancelled).toBe(false);
    });

    test('should delete job and cleanup overlays', async () => {
      mockWhisperService.transcribeAudio.mockResolvedValue({
        text: 'Test transcription',
        language: 'en'
      } as any);

      const jobId = await overlayService.createBatchJob(
        'Test Job',
        ['image-1'],
        [{ imageId: 'image-1', audioFile: Buffer.from('audio1') }]
      );

      await overlayService.processBatchJob(jobId);

      const deleted = overlayService.deleteJob(jobId);
      expect(deleted).toBe(true);

      const job = overlayService.getJobStatus(jobId);
      expect(job).toBeNull();

      const overlays = overlayService.getImageOverlays('image-1');
      expect(overlays).toHaveLength(0);
    });
  });

  describe('Overlay Management', () => {
    test('should apply overlay to image', async () => {
      const overlay = {
        imageId: 'image-1',
        transcription: 'Test transcription',
        language: 'en',
        confidence: 0.95,
        timestamp: new Date(),
        position: { x: 10, y: 10, width: 300, height: 100 }
      };

      const settings = {
        position: 'bottom-left' as const,
        fontSize: 'medium' as const,
        backgroundColor: 'rgba(0,0,0,0.8)',
        textColor: '#ffffff',
        opacity: 0.9,
        padding: 10,
        borderRadius: 5,
        maxWidth: 300,
        showSpeaker: true,
        showTimestamp: true,
        showConfidence: false
      };

      const result = await overlayService.applyOverlayToImage('image-1', overlay, settings);
      
      expect(result.success).toBe(true);
      expect(result.overlayImageUrl).toContain('/api/pacs/images/image-1/overlay/');
    });

    test('should get image overlays', async () => {
      mockWhisperService.transcribeAudio.mockResolvedValue({
        text: 'Test transcription',
        language: 'en'
      } as any);

      const jobId = await overlayService.createBatchJob(
        'Test Job',
        ['image-1'],
        [{ imageId: 'image-1', audioFile: Buffer.from('audio1') }]
      );

      await overlayService.processBatchJob(jobId);

      const overlays = overlayService.getImageOverlays('image-1');
      expect(overlays).toHaveLength(1);
      expect(overlays[0].transcription).toBe('Test transcription');
    });
  });

  describe('Language Support', () => {
    test('should return supported languages with metadata', () => {
      const languages = overlayService.getSupportedLanguages();
      
      expect(languages).toEqual(
        expect.arrayContaining([
          { code: 'en', name: 'English', rtl: false },
          { code: 'es', name: 'Spanish', rtl: false },
          { code: 'fr', name: 'French', rtl: false }
        ])
      );
    });

    test('should handle unknown language codes', () => {
      const customConfig = {
        ...mockConfig,
        supportedLanguages: ['en', 'unknown']
      };

      const service = new BatchTranscriptionOverlayService(
        customConfig,
        mockPACSService,
        mockWhisperService
      );

      const languages = service.getSupportedLanguages();
      
      expect(languages).toContainEqual({
        code: 'unknown',
        name: 'UNKNOWN',
        rtl: false
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle job not found error', async () => {
      await expect(overlayService.processBatchJob('non-existent'))
        .rejects.toThrow('Job non-existent not found');
    });

    test('should handle job not in pending status', async () => {
      const jobId = await overlayService.createBatchJob(
        'Test Job',
        ['image-1'],
        [{ imageId: 'image-1', audioFile: Buffer.from('audio1') }]
      );

      // Manually set status to completed
      const job = overlayService.getJobStatus(jobId)!;
      job.status = 'completed';

      await expect(overlayService.processBatchJob(jobId))
        .rejects.toThrow(`Job ${jobId} is not in pending status`);
    });
  });

  describe('Events', () => {
    test('should emit jobStarted event', (done) => {
      overlayService.on('jobStarted', (data) => {
        expect(data.jobId).toMatch(/^batch_\d+_/);
        expect(data.job.status).toBe('processing');
        done();
      });

      mockWhisperService.transcribeAudio.mockResolvedValue({
        text: 'Test',
        language: 'en'
      } as any);

      overlayService.createBatchJob(
        'Test Job',
        ['image-1'],
        [{ imageId: 'image-1', audioFile: Buffer.from('audio1') }]
      ).then(jobId => overlayService.processBatchJob(jobId));
    });

    test('should emit jobCompleted event', (done) => {
      overlayService.on('jobCompleted', (data) => {
        expect(data.jobId).toMatch(/^batch_\d+_/);
        expect(data.job.status).toBe('completed');
        done();
      });

      mockWhisperService.transcribeAudio.mockResolvedValue({
        text: 'Test',
        language: 'en'
      } as any);

      overlayService.createBatchJob(
        'Test Job',
        ['image-1'],
        [{ imageId: 'image-1', audioFile: Buffer.from('audio1') }]
      ).then(jobId => overlayService.processBatchJob(jobId));
    });

    test('should emit jobFailed event on error', (done) => {
      overlayService.on('jobFailed', (data) => {
        expect(data.jobId).toMatch(/^batch_\d+_/);
        expect(data.job.status).toBe('failed');
        expect(data.error).toBeDefined();
        done();
      });

      mockWhisperService.transcribeAudio.mockRejectedValue(new Error('Processing failed'));

      overlayService.createBatchJob(
        'Test Job',
        ['image-1'],
        [{ imageId: 'image-1', audioFile: Buffer.from('audio1') }]
      ).then(jobId => overlayService.processBatchJob(jobId));
    });
  });
});