/**
 * Tests for Updated Batch Transcription Overlay Service with Dynamic Batch Sizing
 */

import { BatchTranscriptionOverlayService, BatchOverlayConfig } from '../batchTranscriptionOverlayService';

// Mock dependencies
const mockPACSService = {
  getImage: jest.fn(),
  saveOverlay: jest.fn()
};

const mockWhisperService = {
  transcribe: jest.fn()
};

const mockAuditLogger = {
  log: jest.fn()
};

// Mock dynamic batch manager modules
jest.mock('../serverLoadMonitor');
jest.mock('../dynamicBatchManager');

describe('BatchTranscriptionOverlayService with Dynamic Batch Sizing', () => {
  let service: BatchTranscriptionOverlayService;
  let config: BatchOverlayConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    
    config = {
      maxConcurrentProcessing: 5,
      supportedLanguages: ['en', 'es'],
      defaultLanguage: 'en',
      overlayOpacity: 0.8,
      fontSizes: { small: 12, medium: 16, large: 20 },
      auditLogging: true,
      autoSaveEnabled: true,
      enableDynamicBatchSize: false // Start with disabled
    };

    service = new BatchTranscriptionOverlayService(
      config,
      mockPACSService as any,
      mockWhisperService as any
    );
  });

  afterEach(() => {
    service.destroy();
  });

  describe('static batch processing', () => {
    test('should use fixed batch size when dynamic sizing is disabled', () => {
      const batchSize = service['getDynamicBatchSize']();
      expect(batchSize).toBe(5); // Should use maxConcurrentProcessing
    });

    test('should provide statistics without dynamic batch info', () => {
      const stats = service.getBatchStatistics();
      expect(stats.dynamicBatchEnabled).toBe(false);
      expect(stats.currentBatchSize).toBe(5);
      expect(stats.dynamicBatchStats).toBeUndefined();
    });
  });

  describe('dynamic batch processing', () => {
    beforeEach(() => {
      // Enable dynamic batch sizing
      config.enableDynamicBatchSize = true;
      service = new BatchTranscriptionOverlayService(
        config,
        mockPACSService as any,
        mockWhisperService as any
      );
    });

    test('should initialize dynamic batch manager when enabled', () => {
      expect(service['dynamicBatchManager']).toBeDefined();
    });

    test('should use dynamic batch size when available', () => {
      // Mock dynamic batch manager to return specific size
      const mockGetBatchSize = jest.fn().mockReturnValue(8);
      service['dynamicBatchManager'] = {
        getBatchSize: mockGetBatchSize,
        getFallbackBatchSize: jest.fn().mockReturnValue(5),
        registerOperation: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        on: jest.fn(),
        getStatistics: jest.fn().mockReturnValue({
          operations: ['transcription'],
          currentBatchSizes: { transcription: 8 },
          lastServerLoad: 45,
          totalAdjustments: 2
        })
      } as any;

      const batchSize = service['getDynamicBatchSize']();
      expect(batchSize).toBe(8);
      expect(mockGetBatchSize).toHaveBeenCalledWith('transcription');
    });

    test('should use fallback batch size when dynamic sizing fails', () => {
      const mockGetBatchSize = jest.fn().mockImplementation(() => {
        throw new Error('Server monitoring error');
      });
      const mockGetFallbackBatchSize = jest.fn().mockReturnValue(5);
      
      service['dynamicBatchManager'] = {
        getBatchSize: mockGetBatchSize,
        getFallbackBatchSize: mockGetFallbackBatchSize,
        registerOperation: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        on: jest.fn(),
        getStatistics: jest.fn()
      } as any;

      const batchSize = service['getDynamicBatchSize']();
      expect(batchSize).toBe(5);
      expect(mockGetFallbackBatchSize).toHaveBeenCalledWith('transcription');
    });

    test('should provide comprehensive statistics with dynamic batch info', () => {
      service['dynamicBatchManager'] = {
        getStatistics: jest.fn().mockReturnValue({
          operations: ['transcription'],
          currentBatchSizes: { transcription: 8 },
          lastServerLoad: 45,
          totalAdjustments: 2
        }),
        getBatchSize: jest.fn().mockReturnValue(8),
        stop: jest.fn(), // Add missing stop method
        registerOperation: jest.fn(),
        start: jest.fn(),
        on: jest.fn()
      } as any;

      const stats = service.getBatchStatistics();
      expect(stats.dynamicBatchEnabled).toBe(true);
      expect(stats.currentBatchSize).toBe(8);
      expect(stats.dynamicBatchStats).toBeDefined();
      expect(stats.dynamicBatchStats.operations).toContain('transcription');
    });

    test('should properly cleanup dynamic batch manager on destroy', () => {
      const mockStop = jest.fn();
      service['dynamicBatchManager'] = {
        stop: mockStop,
        registerOperation: jest.fn(),
        start: jest.fn(),
        on: jest.fn(),
        getBatchSize: jest.fn(),
        getStatistics: jest.fn()
      } as any;

      service.destroy();
      expect(mockStop).toHaveBeenCalled();
    });
  });

  describe('batch job processing integration', () => {
    test('should create and process batch job with dynamic sizing', async () => {
      // Enable dynamic batch sizing
      config.enableDynamicBatchSize = true;
      service = new BatchTranscriptionOverlayService(
        config,
        mockPACSService as any,
        mockWhisperService as any
      );

      // Mock dynamic batch manager
      const mockGetBatchSize = jest.fn().mockReturnValue(3);
      service['dynamicBatchManager'] = {
        getBatchSize: mockGetBatchSize,
        getFallbackBatchSize: jest.fn(),
        registerOperation: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        on: jest.fn(),
        getStatistics: jest.fn()
      } as any;

      // Mock successful transcription
      mockWhisperService.transcribe.mockResolvedValue({
        text: 'Test transcription',
        confidence: 0.95,
        language: 'en'
      });

      mockPACSService.getImage.mockResolvedValue({
        id: 'image1',
        metadata: { width: 512, height: 512 }
      });

      // Create test audio files
      const audioFiles = [
        { imageId: 'image1', audioFile: Buffer.from('audio1') },
        { imageId: 'image2', audioFile: Buffer.from('audio2') },
        { imageId: 'image3', audioFile: Buffer.from('audio3') },
        { imageId: 'image4', audioFile: Buffer.from('audio4') },
        { imageId: 'image5', audioFile: Buffer.from('audio5') }
      ];

      // Create batch job
      const jobId = await service.createBatchJob(
        'test-job',
        ['image1', 'image2', 'image3', 'image4', 'image5'],
        audioFiles
      );

      expect(jobId).toBeDefined();

      // Mock the processAudioForImage method to avoid complex mocking
      service['processAudioForImage'] = jest.fn().mockResolvedValue({
        id: 'overlay1',
        text: 'Test transcription',
        confidence: 0.95,
        language: 'en',
        timestamp: new Date(),
        position: { x: 10, y: 10, width: 300, height: 100 },
        imageId: 'image1'
      });

      // Process the job (this should use dynamic batch size of 3)
      await service.processBatchJob(jobId);

      // Verify that dynamic batch size was used
      expect(mockGetBatchSize).toHaveBeenCalledWith('transcription');

      // Verify job completed
      const job = service['jobs'].get(jobId);
      expect(job?.status).toBe('completed');
      expect(job?.results).toHaveLength(5);
    });

    test('should handle errors gracefully during dynamic batch processing', async () => {
      config.enableDynamicBatchSize = true;
      service = new BatchTranscriptionOverlayService(
        config,
        mockPACSService as any,
        mockWhisperService as any
      );

      // Mock dynamic batch manager that throws error
      service['dynamicBatchManager'] = {
        getBatchSize: jest.fn().mockImplementation(() => {
          throw new Error('Monitoring failure');
        }),
        getFallbackBatchSize: jest.fn().mockReturnValue(2),
        registerOperation: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        on: jest.fn(),
        getStatistics: jest.fn()
      } as any;

      // Should fallback to safe batch size
      const batchSize = service['getDynamicBatchSize']();
      expect(batchSize).toBe(2);
    });
  });

  describe('configuration validation', () => {
    test('should handle missing optional configuration properties', () => {
      const minimalConfig: BatchOverlayConfig = {
        maxConcurrentProcessing: 3,
        supportedLanguages: ['en'],
        defaultLanguage: 'en',
        overlayOpacity: 0.8,
        fontSizes: { small: 12, medium: 16, large: 20 },
        auditLogging: false,
        autoSaveEnabled: false
        // enableDynamicBatchSize is optional
      };

      const minimalService = new BatchTranscriptionOverlayService(
        minimalConfig,
        mockPACSService as any,
        mockWhisperService as any
      );

      expect(minimalService['dynamicBatchManager']).toBeUndefined();
      expect(minimalService['getDynamicBatchSize']()).toBe(3);

      minimalService.destroy();
    });

    test('should respect enableDynamicBatchSize=false explicitly', () => {
      const explicitConfig: BatchOverlayConfig = {
        ...config,
        enableDynamicBatchSize: false
      };

      const explicitService = new BatchTranscriptionOverlayService(
        explicitConfig,
        mockPACSService as any,
        mockWhisperService as any
      );

      expect(explicitService['dynamicBatchManager']).toBeUndefined();
      explicitService.destroy();
    });
  });
});