/**
 * Telehealth Module Integration Tests
 * 
 * Tests for the WebQX™ Telehealth Module components
 */

import { TelehealthManager } from '../core/telehealth-manager';
import { TelehealthConfig } from '../core/types/telehealth.types';

describe('Telehealth Module Integration', () => {
  let telehealthManager: TelehealthManager;
  let mockConfig: TelehealthConfig;

  beforeEach(() => {
    mockConfig = {
      deploymentMode: 'full-suite',
      enabledComponents: ['video-consultation', 'messaging', 'ehr-integration', 'fhir-sync'],
      components: {
        'video-consultation': {
          enabled: true,
          logLevel: 'info',
          healthCheckInterval: 30000,
          retryAttempts: 3,
          timeout: 5000,
          jitsi: {
            domain: 'meet.jitsi.org',
            appId: 'test-app',
            jwt: {
              appSecret: 'test-secret',
              keyId: 'test-key'
            }
          },
          recording: {
            enabled: false,
            storage: 'local',
            retentionDays: 30
          },
          quality: {
            defaultResolution: '720p',
            adaptiveBitrate: true,
            maxBitrate: 2000000
          }
        },
        'messaging': {
          enabled: true,
          logLevel: 'info',
          healthCheckInterval: 30000,
          retryAttempts: 3,
          timeout: 5000,
          matrix: {
            homeserverUrl: 'https://matrix.org',
            accessToken: 'test-token',
            userId: '@test:matrix.org',
            deviceId: 'TEST_DEVICE'
          },
          encryption: {
            enabled: true,
            backupEnabled: true,
            crossSigning: true
          },
          channels: {
            autoCreate: true,
            defaultPermissions: {},
            retentionDays: 2555
          }
        },
        'ehr-integration': {
          enabled: true,
          logLevel: 'info',
          healthCheckInterval: 30000,
          retryAttempts: 3,
          timeout: 5000,
          openemr: {
            baseUrl: 'https://test-openemr.com',
            apiKey: 'test-api-key',
            clientId: 'test-client',
            version: '7.0.2'
          },
          sync: {
            interval: 60000,
            batchSize: 50,
            conflictResolution: 'latest'
          },
          dataMapping: {
            patientFields: { id: 'pid', name: 'fname' },
            appointmentFields: { id: 'appointment_id' },
            customMappings: {}
          }
        },
        'fhir-sync': {
          enabled: true,
          logLevel: 'info',
          healthCheckInterval: 30000,
          retryAttempts: 3,
          timeout: 5000,
          server: {
            baseUrl: 'https://test-fhir.com/fhir/R4',
            version: 'R4',
            authType: 'none'
          },
          resources: {
            enabledTypes: ['Patient', 'Appointment', 'Encounter'],
            syncDirection: 'bidirectional',
            validateResources: true
          },
          synchronization: {
            mode: 'real-time',
            batchSize: 100
          }
        }
      },
      interoperability: {
        eventBus: {
          enabled: true,
          maxListeners: 100
        },
        crossComponentAuth: true,
        sharedSession: true
      },
      security: {
        encryption: {
          algorithm: 'aes-256-gcm',
          keyRotationDays: 90
        },
        audit: {
          enabled: true,
          retentionDays: 2555,
          includeSuccessEvents: true
        },
        compliance: {
          hipaaMode: true,
          auditAllAccess: true,
          dataRetentionDays: 2555
        }
      }
    };

    telehealthManager = new TelehealthManager(mockConfig);
  });

  afterEach(async () => {
    if (telehealthManager.isReady()) {
      await telehealthManager.shutdown();
    }
  });

  describe('Telehealth Manager Initialization', () => {
    it('should initialize successfully in full-suite mode', async () => {
      await telehealthManager.initialize();
      
      expect(telehealthManager.isReady()).toBe(true);
      
      const health = telehealthManager.getHealthStatus();
      expect(health.healthy).toBe(true);
      expect(health.deploymentMode).toBe('full-suite');
      expect(Object.keys(health.components)).toHaveLength(4);
    });

    it('should initialize successfully in standalone mode', async () => {
      mockConfig.deploymentMode = 'standalone';
      mockConfig.enabledComponents = ['video-consultation'];
      
      const standaloneManager = new TelehealthManager(mockConfig);
      await standaloneManager.initialize();
      
      expect(standaloneManager.isReady()).toBe(true);
      
      const health = standaloneManager.getHealthStatus();
      expect(health.healthy).toBe(true);
      expect(health.deploymentMode).toBe('standalone');
      expect(Object.keys(health.components)).toHaveLength(1);
      
      await standaloneManager.shutdown();
    });

    it('should handle initialization errors gracefully', async () => {
      // Provide invalid configuration
      mockConfig.components = {};
      
      const invalidManager = new TelehealthManager(mockConfig);
      
      await expect(invalidManager.initialize()).rejects.toThrow();
      expect(invalidManager.isReady()).toBe(false);
    });
  });

  describe('Component Management', () => {
    beforeEach(async () => {
      await telehealthManager.initialize();
    });

    it('should provide access to individual components', () => {
      const videoComponent = telehealthManager.getComponent('video-consultation');
      const messagingComponent = telehealthManager.getComponent('messaging');
      const ehrComponent = telehealthManager.getComponent('ehr-integration');
      const fhirComponent = telehealthManager.getComponent('fhir-sync');

      expect(videoComponent).toBeDefined();
      expect(messagingComponent).toBeDefined();
      expect(ehrComponent).toBeDefined();
      expect(fhirComponent).toBeDefined();
    });

    it('should return undefined for non-existent components', () => {
      const nonExistentComponent = telehealthManager.getComponent('non-existent');
      expect(nonExistentComponent).toBeUndefined();
    });

    it('should provide component status information', () => {
      const componentStatus = telehealthManager.getComponentStatus();
      
      expect(componentStatus).toHaveProperty('video-consultation');
      expect(componentStatus).toHaveProperty('messaging');
      expect(componentStatus).toHaveProperty('ehr-integration');
      expect(componentStatus).toHaveProperty('fhir-sync');

      Object.values(componentStatus).forEach(status => {
        expect(status).toHaveProperty('healthy');
        expect(status).toHaveProperty('status');
        expect(status).toHaveProperty('lastUpdated');
        expect(status).toHaveProperty('metrics');
      });
    });
  });

  describe('Component Interoperability', () => {
    beforeEach(async () => {
      await telehealthManager.initialize();
    });

    it('should handle cross-component events', async () => {
      const videoComponent = telehealthManager.getComponent('video-consultation');
      const messagingComponent = telehealthManager.getComponent('messaging');

      expect(videoComponent).toBeDefined();
      expect(messagingComponent).toBeDefined();

      // Mock event handling
      const handleExternalEventSpy = jest.spyOn(messagingComponent!, 'handleExternalEvent');
      
      // Simulate video consultation start
      videoComponent!.emit('call:started', {
        sessionId: 'test-session',
        roomName: 'test-room',
        participants: {
          providerId: 'provider-1',
          patientId: 'patient-1'
        },
        startTime: new Date(),
        metadata: {
          consultationType: 'video',
          specialty: 'general'
        }
      });

      // Allow event propagation
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(handleExternalEventSpy).toHaveBeenCalled();
    });

    it('should support patient selection workflow', async () => {
      const ehrComponent = telehealthManager.getComponent('ehr-integration');
      const fhirComponent = telehealthManager.getComponent('fhir-sync');

      expect(ehrComponent).toBeDefined();
      expect(fhirComponent).toBeDefined();

      const ehrEventSpy = jest.spyOn(ehrComponent!, 'handleExternalEvent');
      const fhirEventSpy = jest.spyOn(fhirComponent!, 'handleExternalEvent');

      // Simulate patient selection
      telehealthManager.emit('patient:selected', {
        patientId: 'patient-123',
        context: 'consultation'
      });

      // Allow event propagation
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(ehrEventSpy).toHaveBeenCalledWith('patient:selected', {
        patientId: 'patient-123',
        context: 'consultation'
      });

      expect(fhirEventSpy).toHaveBeenCalledWith('patient:selected', {
        patientId: 'patient-123',
        context: 'consultation'
      });
    });
  });

  describe('Health Checks and Monitoring', () => {
    beforeEach(async () => {
      await telehealthManager.initialize();
    });

    it('should provide comprehensive health status', () => {
      const health = telehealthManager.getHealthStatus();

      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('components');
      expect(health).toHaveProperty('deploymentMode');

      expect(health.healthy).toBe(true);
      expect(health.deploymentMode).toBe('full-suite');
      expect(Object.keys(health.components)).toContain('video-consultation');
      expect(Object.keys(health.components)).toContain('messaging');
      expect(Object.keys(health.components)).toContain('ehr-integration');
      expect(Object.keys(health.components)).toContain('fhir-sync');
    });

    it('should detect unhealthy components', async () => {
      // Simulate component failure
      const videoComponent = telehealthManager.getComponent('video-consultation');
      if (videoComponent) {
        // Force component to unhealthy state
        (videoComponent as any).status.healthy = false;
        (videoComponent as any).status.status = 'error';
      }

      const health = telehealthManager.getHealthStatus();
      expect(health.healthy).toBe(false);
      expect(health.components['video-consultation'].healthy).toBe(false);
    });
  });

  describe('Deployment Mode Support', () => {
    it('should support full-suite deployment with all components', async () => {
      const fullSuiteConfig = { ...mockConfig };
      fullSuiteConfig.deploymentMode = 'full-suite';
      fullSuiteConfig.enabledComponents = ['video-consultation', 'messaging', 'ehr-integration', 'fhir-sync'];

      const fullSuiteManager = new TelehealthManager(fullSuiteConfig);
      await fullSuiteManager.initialize();

      const health = fullSuiteManager.getHealthStatus();
      expect(health.deploymentMode).toBe('full-suite');
      expect(Object.keys(health.components)).toHaveLength(4);

      await fullSuiteManager.shutdown();
    });

    it('should support standalone video consultation deployment', async () => {
      const standaloneConfig = { ...mockConfig };
      standaloneConfig.deploymentMode = 'standalone';
      standaloneConfig.enabledComponents = ['video-consultation'];

      const standaloneManager = new TelehealthManager(standaloneConfig);
      await standaloneManager.initialize();

      const health = standaloneManager.getHealthStatus();
      expect(health.deploymentMode).toBe('standalone');
      expect(Object.keys(health.components)).toHaveLength(1);
      expect(health.components).toHaveProperty('video-consultation');

      await standaloneManager.shutdown();
    });

    it('should support standalone messaging deployment', async () => {
      const standaloneConfig = { ...mockConfig };
      standaloneConfig.deploymentMode = 'standalone';
      standaloneConfig.enabledComponents = ['messaging'];

      const standaloneManager = new TelehealthManager(standaloneConfig);
      await standaloneManager.initialize();

      const health = standaloneManager.getHealthStatus();
      expect(health.deploymentMode).toBe('standalone');
      expect(Object.keys(health.components)).toHaveLength(1);
      expect(health.components).toHaveProperty('messaging');

      await standaloneManager.shutdown();
    });

    it('should support mixed component deployments', async () => {
      const mixedConfig = { ...mockConfig };
      mixedConfig.deploymentMode = 'standalone';
      mixedConfig.enabledComponents = ['video-consultation', 'ehr-integration'];

      const mixedManager = new TelehealthManager(mixedConfig);
      await mixedManager.initialize();

      const health = mixedManager.getHealthStatus();
      expect(health.deploymentMode).toBe('standalone');
      expect(Object.keys(health.components)).toHaveLength(2);
      expect(health.components).toHaveProperty('video-consultation');
      expect(health.components).toHaveProperty('ehr-integration');
      expect(health.components).not.toHaveProperty('messaging');
      expect(health.components).not.toHaveProperty('fhir-sync');

      await mixedManager.shutdown();
    });
  });

  describe('Graceful Shutdown', () => {
    it('should shutdown all components gracefully', async () => {
      await telehealthManager.initialize();
      expect(telehealthManager.isReady()).toBe(true);

      await telehealthManager.shutdown();
      expect(telehealthManager.isReady()).toBe(false);

      const health = telehealthManager.getHealthStatus();
      expect(health.healthy).toBe(false);
    });

    it('should emit shutdown event', async () => {
      await telehealthManager.initialize();

      const shutdownPromise = new Promise((resolve) => {
        telehealthManager.once('shutdown', resolve);
      });

      telehealthManager.shutdown();
      await shutdownPromise;

      expect(telehealthManager.isReady()).toBe(false);
    });
  });
});