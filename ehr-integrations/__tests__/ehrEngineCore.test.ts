/**
 * EHR Engine Integration Tests
 * 
 * Tests for the core EHR engine functionality, real-time updates,
 * and external connector integration.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { EHREngineCore, EHREngineConfig, createEHREngine } from '../services/ehrEngineCore';
import { RealTimeUpdateService, RealTimeEventType } from '../services/realTimeUpdateService';
import { OpenEMRConnector } from '../connectors/openEmrConnector';
import { FHIRPatient, FHIRObservation } from '../types/fhir-r4';

describe('EHR Engine Integration', () => {
  let ehrEngine: EHREngineCore;
  
  const mockConfig: EHREngineConfig = {
    fhirConfig: {
      baseUrl: 'http://localhost:8080/fhir',
      timeout: 5000
    },
    realTimeConfig: {
      enableWebSocket: false, // Use polling for tests
      pollingInterval: 10000
    },
    security: {
      auditLevel: 'standard'
    }
  };

  beforeEach(() => {
    ehrEngine = createEHREngine(mockConfig);
  });

  afterEach(async () => {
    if (ehrEngine) {
      await ehrEngine.shutdown();
    }
  });

  describe('Engine Initialization', () => {
    test('should initialize successfully with valid config', async () => {
      const result = await ehrEngine.initialize();
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
      expect(result.metadata?.operationId).toBeDefined();
    }, 10000);

    test('should handle initialization errors gracefully', async () => {
      // Test with invalid config
      const invalidEngine = createEHREngine({
        fhirConfig: {
          baseUrl: 'invalid-url',
          timeout: 1000
        }
      });

      const result = await invalidEngine.initialize();
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('ENGINE_INITIALIZATION_FAILED');
    });
  });

  describe('FHIR Resource Management', () => {
    beforeEach(async () => {
      await ehrEngine.initialize();
      // Set test authentication token
      ehrEngine.fhirClient.setAccessToken('test-token-for-integration-tests', 3600);
    });

    test('should create FHIR patient resource', async () => {
      const mockPatient: FHIRPatient = {
        resourceType: 'Patient',
        name: [
          {
            use: 'official',
            family: 'Doe',
            given: ['John']
          }
        ],
        gender: 'male',
        birthDate: '1980-01-01'
      };

      const result = await ehrEngine.createResource(mockPatient);
      
      expect(result.success).toBe(true);
      expect(result.data?.resourceType).toBe('Patient');
      expect(result.metadata?.operationId).toBeDefined();
    });

    test('should update FHIR patient resource', async () => {
      const mockPatient: FHIRPatient = {
        resourceType: 'Patient',
        id: 'patient-123',
        name: [
          {
            use: 'official',
            family: 'Smith',
            given: ['Jane']
          }
        ],
        gender: 'female',
        birthDate: '1985-06-15'
      };

      const result = await ehrEngine.updateResource(mockPatient);
      
      expect(result.success).toBe(true);
      expect(result.data?.resourceType).toBe('Patient');
    });

    test('should retrieve FHIR resource by ID', async () => {
      const result = await ehrEngine.getResource('Patient', 'patient-123');
      
      expect(result.success).toBe(true);
      expect(result.data?.resourceType).toBe('Patient');
      expect(result.data?.id).toBe('patient-123');
    });

    test('should delete FHIR resource', async () => {
      const result = await ehrEngine.deleteResource('Patient', 'patient-123');
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    test('should handle resource creation errors', async () => {
      const invalidPatient = {
        resourceType: 'InvalidResource',
        // Missing required fields
      } as any;

      const result = await ehrEngine.createResource(invalidPatient);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Real-Time Updates', () => {
    beforeEach(async () => {
      await ehrEngine.initialize();
    });

    test('should subscribe to real-time updates', (done) => {
      const eventTypes: RealTimeEventType[] = ['resource_created', 'resource_updated'];
      
      const subscriptionId = ehrEngine.subscribeToRealTimeUpdates(
        eventTypes,
        (event) => {
          expect(event.type).toEqual(expect.stringMatching(/resource_(created|updated)/));
          expect(event.timestamp).toBeInstanceOf(Date);
          
          ehrEngine.unsubscribeFromRealTimeUpdates(subscriptionId);
          done();
        }
      );

      expect(subscriptionId).toBeDefined();
      expect(typeof subscriptionId).toBe('string');

      // Simulate an event
      setTimeout(() => {
        ehrEngine.realTimeService.publishEvent({
          type: 'resource_created',
          resourceType: 'Patient',
          resourceId: 'patient-123',
          timestamp: new Date(),
          data: { test: true }
        });
      }, 100);
    });

    test('should unsubscribe from real-time updates', () => {
      const subscriptionId = ehrEngine.subscribeToRealTimeUpdates(
        ['resource_created'],
        () => {}
      );

      const unsubscribed = ehrEngine.unsubscribeFromRealTimeUpdates(subscriptionId);
      expect(unsubscribed).toBe(true);

      // Try to unsubscribe again
      const unsubscribedAgain = ehrEngine.unsubscribeFromRealTimeUpdates(subscriptionId);
      expect(unsubscribedAgain).toBe(false);
    });

    test('should filter events by patient ID', (done) => {
      const targetPatientId = 'patient-456';
      
      const subscriptionId = ehrEngine.subscribeToRealTimeUpdates(
        ['observation_added'],
        (event) => {
          expect(event.patientId).toBe(targetPatientId);
          
          ehrEngine.unsubscribeFromRealTimeUpdates(subscriptionId);
          done();
        },
        { patientId: targetPatientId }
      );

      // Simulate events for different patients
      setTimeout(() => {
        // This should not trigger the callback
        ehrEngine.realTimeService.publishEvent({
          type: 'observation_added',
          patientId: 'patient-123',
          timestamp: new Date()
        });

        // This should trigger the callback
        ehrEngine.realTimeService.publishEvent({
          type: 'observation_added',
          patientId: targetPatientId,
          timestamp: new Date()
        });
      }, 100);
    });
  });

  describe('External EHR Integration', () => {
    beforeEach(async () => {
      await ehrEngine.initialize();
    });

    test('should register external connector', () => {
      const openEmrConnector = new OpenEMRConnector();
      
      ehrEngine.registerExternalConnector(openEmrConnector);
      
      // Verify connector is registered (this would be internal state)
      expect(ehrEngine.externalConnectors?.has('OpenEMR')).toBe(true);
    });

    test('should sync patient data from external system', async () => {
      const openEmrConnector = new OpenEMRConnector();
      ehrEngine.registerExternalConnector(openEmrConnector);

      // Mock the sync method to return test data
      jest.spyOn(openEmrConnector, 'syncPatientData').mockResolvedValue([
        {
          resourceType: 'Patient',
          id: 'patient-from-openemr',
          name: [{ family: 'Doe', given: ['John'] }]
        } as FHIRPatient,
        {
          resourceType: 'Observation',
          id: 'obs-from-openemr',
          status: 'final',
          code: { text: 'Blood Pressure' },
          subject: { reference: 'Patient/patient-from-openemr' }
        } as FHIRObservation
      ]);

      const result = await ehrEngine.syncPatientFromExternal('OpenEMR', 'patient-123');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].resourceType).toBe('Patient');
      expect(result.data?.[1].resourceType).toBe('Observation');
    });

    test('should handle external sync errors', async () => {
      const result = await ehrEngine.syncPatientFromExternal('NonExistentSystem', 'patient-123');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('EXTERNAL_SYNC_FAILED');
    });
  });

  describe('Specialty Module Integration', () => {
    beforeEach(async () => {
      await ehrEngine.initialize();
    });

    test('should register specialty module', async () => {
      const mockModule = {
        name: 'test-module',
        version: '1.0.0',
        initialize: jest.fn().mockResolvedValue(undefined),
        processResource: jest.fn().mockImplementation((resource) => resource),
        getCapabilities: jest.fn().mockReturnValue(['test-capability'])
      };

      const registered = await ehrEngine.registerSpecialtyModule(mockModule);
      
      expect(registered).toBe(true);
      expect(mockModule.initialize).toHaveBeenCalledWith(ehrEngine);
    });

    test('should process resources through specialty modules', async () => {
      const mockModule = {
        name: 'enhancement-module',
        version: '1.0.0',
        initialize: jest.fn().mockResolvedValue(undefined),
        processResource: jest.fn().mockImplementation((resource) => ({
          ...resource,
          enhanced: true
        })),
        getCapabilities: jest.fn().mockReturnValue(['enhancement'])
      };

      await ehrEngine.registerSpecialtyModule(mockModule);

      const mockPatient: FHIRPatient = {
        resourceType: 'Patient',
        name: [{ family: 'Test', given: ['Patient'] }]
      };

      const result = await ehrEngine.createResource(mockPatient);
      
      expect(result.success).toBe(true);
      expect(mockModule.processResource).toHaveBeenCalledWith(mockPatient);
    });

    test('should handle module registration errors', async () => {
      const faultyModule = {
        name: 'faulty-module',
        version: '1.0.0',
        initialize: jest.fn().mockRejectedValue(new Error('Initialization failed')),
        processResource: jest.fn(),
        getCapabilities: jest.fn().mockReturnValue([])
      };

      const registered = await ehrEngine.registerSpecialtyModule(faultyModule);
      
      expect(registered).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle engine not initialized error', async () => {
      // Don't initialize the engine
      const mockPatient: FHIRPatient = {
        resourceType: 'Patient',
        name: [{ family: 'Test' }]
      };

      const result = await ehrEngine.createResource(mockPatient);
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('not initialized');
    });

    test('should provide detailed error information', async () => {
      await ehrEngine.initialize();

      // Try to update a resource without ID
      const invalidResource: FHIRPatient = {
        resourceType: 'Patient',
        // No ID for update
        name: [{ family: 'Test' }]
      };

      const result = await ehrEngine.updateResource(invalidResource);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.details).toBeDefined();
      expect(result.metadata?.operationId).toBeDefined();
    });
  });

  describe('Performance and Scaling', () => {
    beforeEach(async () => {
      await ehrEngine.initialize();
    });

    test('should handle concurrent operations', async () => {
      const operations = [];
      
      for (let i = 0; i < 5; i++) {
        const patient: FHIRPatient = {
          resourceType: 'Patient',
          name: [{ family: 'Patient', given: [`${i}`] }]
        };
        
        operations.push(ehrEngine.createResource(patient));
      }

      const results = await Promise.all(operations);
      
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.data?.resourceType).toBe('Patient');
      });
    });

    test('should track operation metadata', async () => {
      const mockPatient: FHIRPatient = {
        resourceType: 'Patient',
        name: [{ family: 'Test' }]
      };

      const result = await ehrEngine.createResource(mockPatient);
      
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.operationId).toBeDefined();
      expect(result.metadata?.timestamp).toBeInstanceOf(Date);
      expect(result.metadata?.duration).toBeGreaterThanOrEqual(0);
      expect(result.metadata?.source).toBe('FHIR');
    });
  });
});

describe('Real-Time Update Service Standalone', () => {
  let realTimeService: RealTimeUpdateService;

  beforeEach(() => {
    realTimeService = new RealTimeUpdateService({
      enableWebSocket: false,
      pollingInterval: 5000
    });
  });

  afterEach(async () => {
    await realTimeService.stop();
  });

  test('should start and stop service', async () => {
    await realTimeService.start();
    expect(realTimeService.getConnectionStatus()).toBe('disconnected'); // WebSocket disabled

    await realTimeService.stop();
    // Service should be stopped
  });

  test('should manage subscriptions', () => {
    const subscriptionId = realTimeService.subscribe({
      eventTypes: ['resource_created'],
      callback: () => {}
    });

    expect(subscriptionId).toBeDefined();
    expect(realTimeService.getSubscriptions()).toHaveLength(1);

    const unsubscribed = realTimeService.unsubscribe(subscriptionId);
    expect(unsubscribed).toBe(true);
    expect(realTimeService.getSubscriptions()).toHaveLength(0);
  });

  test('should trigger polling updates', async () => {
    await realTimeService.start();
    
    // This should complete without error
    await realTimeService.triggerPollingUpdate();
  });
});