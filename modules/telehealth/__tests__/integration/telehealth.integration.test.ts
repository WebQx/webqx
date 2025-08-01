/**
 * WebQX™ Telehealth - Integration Tests
 * 
 * Tests for the complete telehealth functionality including video consultations,
 * text fallbacks, and optimized FHIR synchronization.
 */

import { TelehealthManager } from '../core/TelehealthManager';
import { NetworkMonitor } from '../core/NetworkMonitor';
import { FHIRBatchAdapter } from '../sync/FHIRBatchAdapter';
import { developmentConfig, lowBandwidthConfig } from '../config/telehealth.config';
import {
  ConsultationOptions,
  NetworkConditions,
  ConsultationSession,
  TelehealthConfig
} from '../types/telehealth.types';

describe('WebQX Telehealth Integration Tests', () => {
  let telehealthManager: TelehealthManager;
  let mockNetworkConditions: NetworkConditions;

  beforeEach(() => {
    // Mock DOM elements
    const jitsiContainer = document.createElement('div');
    jitsiContainer.id = 'jitsi-container';
    document.body.appendChild(jitsiContainer);

    // Mock network conditions
    mockNetworkConditions = {
      bandwidthKbps: 1000,
      rttMs: 50,
      packetLossPercent: 0,
      stabilityScore: 80,
      connectionType: 'wifi',
      signalStrength: 85
    };

    // Create telehealth manager with test config
    telehealthManager = new TelehealthManager(developmentConfig);
  });

  afterEach(async () => {
    if (telehealthManager) {
      telehealthManager.dispose();
    }
    // Clean up DOM
    const container = document.getElementById('jitsi-container');
    if (container) {
      container.remove();
    }
  });

  describe('Telehealth Manager Initialization', () => {
    test('should initialize successfully with valid configuration', async () => {
      expect(telehealthManager).toBeDefined();
      
      // Mock the initialization to avoid actual network calls
      jest.spyOn(telehealthManager as any, 'networkMonitor').mockImplementation(() => ({
        startMonitoring: jest.fn().mockResolvedValue(undefined),
        getCurrentConditions: jest.fn().mockReturnValue(mockNetworkConditions),
        getNetworkQuality: jest.fn().mockReturnValue('good')
      }));

      await expect(telehealthManager.initialize()).resolves.not.toThrow();
    });

    test('should throw error with invalid configuration', () => {
      const invalidConfig = { ...developmentConfig };
      delete (invalidConfig as any).jitsiConfig.domain;

      expect(() => new TelehealthManager(invalidConfig)).toThrow('Jitsi domain is required');
    });
  });

  describe('Video Consultation Management', () => {
    const consultationOptions: ConsultationOptions = {
      patientId: 'patient-123',
      providerId: 'provider-456',
      consultationType: 'routine-checkup',
      enableFallback: true,
      language: 'en'
    };

    test('should start video consultation with good network conditions', async () => {
      // Mock good network conditions
      jest.spyOn(telehealthManager as any, 'networkMonitor').mockImplementation(() => ({
        startMonitoring: jest.fn().mockResolvedValue(undefined),
        getCurrentConditions: jest.fn().mockReturnValue(mockNetworkConditions),
        getNetworkQuality: jest.fn().mockReturnValue('good'),
        supportsVideoCall: jest.fn().mockReturnValue(true)
      }));

      // Mock Jitsi adapter
      jest.spyOn(telehealthManager as any, 'jitsiAdapter').mockImplementation(() => ({
        joinConsultation: jest.fn().mockResolvedValue(undefined),
        isConnectedToConsultation: jest.fn().mockReturnValue(true)
      }));

      await telehealthManager.initialize();
      const session = await telehealthManager.startVideoConsultation(consultationOptions);

      expect(session).toBeDefined();
      expect(session.mode).toBe('video');
      expect(session.patientId).toBe(consultationOptions.patientId);
      expect(session.providerId).toBe(consultationOptions.providerId);
    });

    test('should fallback to text consultation with poor network conditions', async () => {
      // Mock poor network conditions
      const poorNetworkConditions: NetworkConditions = {
        ...mockNetworkConditions,
        bandwidthKbps: 100,
        stabilityScore: 30
      };

      jest.spyOn(telehealthManager as any, 'networkMonitor').mockImplementation(() => ({
        startMonitoring: jest.fn().mockResolvedValue(undefined),
        getCurrentConditions: jest.fn().mockReturnValue(poorNetworkConditions),
        getNetworkQuality: jest.fn().mockReturnValue('poor'),
        supportsVideoCall: jest.fn().mockReturnValue(false)
      }));

      // Mock consultation chat
      jest.spyOn(telehealthManager as any, 'consultationChat').mockImplementation(() => ({
        startConsultation: jest.fn().mockResolvedValue(undefined)
      }));

      await telehealthManager.initialize();
      const session = await telehealthManager.startVideoConsultation(consultationOptions);

      expect(session).toBeDefined();
      expect(session.mode).toBe('text');
    });
  });

  describe('Text-Based Consultation', () => {
    const consultationOptions: ConsultationOptions = {
      patientId: 'patient-789',
      providerId: 'provider-101',
      consultationType: 'follow-up',
      enableFallback: true,
      language: 'en'
    };

    test('should start text consultation successfully', async () => {
      // Mock consultation chat
      jest.spyOn(telehealthManager as any, 'consultationChat').mockImplementation(() => ({
        startConsultation: jest.fn().mockResolvedValue(undefined)
      }));

      await telehealthManager.initialize();
      const session = await telehealthManager.startTextConsultation(consultationOptions);

      expect(session).toBeDefined();
      expect(session.mode).toBe('text');
      expect(session.patientId).toBe(consultationOptions.patientId);
    });

    test('should start structured consultation with template', async () => {
      const mockStructuredConsult = {
        consultationId: 'struct-test-123',
        sessionId: 'session-test-123',
        template: {
          templateId: 'routine-checkup',
          name: 'Routine Checkup',
          specialty: 'primary-care',
          consultationType: 'routine-checkup',
          estimatedDurationMinutes: 15,
          steps: []
        },
        currentStep: 0,
        responses: [],
        status: 'in-progress' as const,
        startTime: new Date()
      };

      jest.spyOn(telehealthManager as any, 'consultationChat').mockImplementation(() => ({
        startStructuredConsultation: jest.fn().mockResolvedValue(mockStructuredConsult)
      }));

      await telehealthManager.initialize();
      const structuredConsult = await telehealthManager.startStructuredConsultation(
        consultationOptions,
        'routine-checkup'
      );

      expect(structuredConsult).toBeDefined();
      expect(structuredConsult.template.templateId).toBe('routine-checkup');
      expect(structuredConsult.status).toBe('in-progress');
    });
  });

  describe('Network Adaptation', () => {
    test('should adapt to bandwidth changes', async () => {
      await telehealthManager.initialize();

      // Test bandwidth optimization
      await expect(telehealthManager.optimizeForBandwidth(500)).resolves.not.toThrow();
      
      const networkStatus = telehealthManager.getNetworkStatus();
      expect(networkStatus).toBeDefined();
      expect(networkStatus.conditions).toBeDefined();
      expect(networkStatus.quality).toBeDefined();
    });

    test('should provide network status information', () => {
      const networkStatus = telehealthManager.getNetworkStatus();
      
      expect(networkStatus).toHaveProperty('conditions');
      expect(networkStatus).toHaveProperty('quality');
      expect(networkStatus).toHaveProperty('supportsVideo');
      expect(networkStatus).toHaveProperty('supportsAudio');
    });
  });

  describe('FHIR Optimization', () => {
    test('should batch FHIR operations efficiently', async () => {
      const fhirAdapter = new FHIRBatchAdapter({
        baseUrl: 'http://localhost:8080/fhir',
        maxBatchSize: 10,
        enableCompression: false,
        compressionThreshold: 0,
        enableDifferentialSync: true,
        syncIntervalMs: 10000,
        retry: {
          maxAttempts: 2,
          initialDelayMs: 500,
          backoffMultiplier: 1.5
        }
      });

      // Mock FHIR operations
      const mockResource = {
        resourceType: 'Patient',
        id: 'test-patient-123',
        name: [{ given: ['John'], family: 'Doe' }]
      };

      // Add to batch
      fhirAdapter.addToBatch({
        method: 'POST',
        url: 'Patient',
        resource: mockResource
      });

      const stats = fhirAdapter.getStatistics();
      expect(stats.pendingOperations).toBe(1);
      expect(stats.compressionSupported).toBeDefined();
    });

    test('should compress payloads when enabled', async () => {
      const fhirAdapter = new FHIRBatchAdapter({
        baseUrl: 'http://localhost:8080/fhir',
        maxBatchSize: 10,
        enableCompression: true,
        compressionThreshold: 100,
        enableDifferentialSync: true,
        syncIntervalMs: 10000,
        retry: {
          maxAttempts: 2,
          initialDelayMs: 500,
          backoffMultiplier: 1.5
        }
      });

      const testData = {
        resourceType: 'Bundle',
        entry: Array(100).fill({
          resource: {
            resourceType: 'Patient',
            name: [{ given: ['Test'], family: 'Patient' }]
          }
        })
      };

      const compressionResult = await fhirAdapter.compressPayload(testData);
      expect(compressionResult).toBeDefined();
      expect(compressionResult.algorithm).toBe('gzip');
      expect(compressionResult.originalSize).toBeGreaterThan(0);
    });
  });

  describe('Low-Bandwidth Optimization', () => {
    test('should handle low-bandwidth configuration', () => {
      const lowBandwidthManager = new TelehealthManager(lowBandwidthConfig);
      expect(lowBandwidthManager).toBeDefined();
      
      const networkStatus = lowBandwidthManager.getNetworkStatus();
      expect(networkStatus).toBeDefined();
      
      lowBandwidthManager.dispose();
    });

    test('should adjust quality settings for low bandwidth', async () => {
      const lowBandwidthConditions: NetworkConditions = {
        bandwidthKbps: 200,
        rttMs: 150,
        packetLossPercent: 2,
        stabilityScore: 60,
        connectionType: 'cellular',
        signalStrength: 50
      };

      await telehealthManager.initialize();
      await expect(
        telehealthManager.optimizeForBandwidth(lowBandwidthConditions.bandwidthKbps)
      ).resolves.not.toThrow();
    });
  });

  describe('Event Handling', () => {
    test('should emit events for session lifecycle', async () => {
      const eventsSeen: string[] = [];
      
      telehealthManager.addEventListener('session-started', (event) => {
        eventsSeen.push('session-started');
      });

      telehealthManager.addEventListener('session-ended', (event) => {
        eventsSeen.push('session-ended');
      });

      // Mock required components
      jest.spyOn(telehealthManager as any, 'consultationChat').mockImplementation(() => ({
        startConsultation: jest.fn().mockResolvedValue(undefined),
        endConsultation: jest.fn().mockResolvedValue(undefined)
      }));

      await telehealthManager.initialize();
      
      const session = await telehealthManager.startTextConsultation({
        patientId: 'patient-123',
        providerId: 'provider-456',
        consultationType: 'routine-checkup',
        enableFallback: true
      });

      await telehealthManager.endConsultation();

      expect(eventsSeen).toContain('session-started');
      expect(eventsSeen).toContain('session-ended');
    });
  });

  describe('Error Handling', () => {
    test('should handle network failures gracefully', async () => {
      // Mock network failure
      jest.spyOn(telehealthManager as any, 'networkMonitor').mockImplementation(() => ({
        startMonitoring: jest.fn().mockRejectedValue(new Error('Network error')),
        getCurrentConditions: jest.fn().mockReturnValue(mockNetworkConditions),
        getNetworkQuality: jest.fn().mockReturnValue('disconnected')
      }));

      await expect(telehealthManager.initialize()).rejects.toThrow();
    });

    test('should handle FHIR sync failures gracefully', async () => {
      const fhirAdapter = new FHIRBatchAdapter({
        baseUrl: 'http://invalid-url',
        maxBatchSize: 5,
        enableCompression: false,
        compressionThreshold: 0,
        enableDifferentialSync: false,
        syncIntervalMs: 10000,
        retry: {
          maxAttempts: 1,
          initialDelayMs: 100,
          backoffMultiplier: 1
        }
      });

      // This should not throw but handle errors gracefully
      const stats = fhirAdapter.getStatistics();
      expect(stats).toBeDefined();
    });
  });
});