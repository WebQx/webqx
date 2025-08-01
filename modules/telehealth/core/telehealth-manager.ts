/**
 * WebQX™ Telehealth Manager
 * 
 * Central orchestrator for telehealth components supporting both
 * standalone and full-suite deployment modes.
 */

import { EventEmitter } from 'events';
import { TelehealthConfig, ComponentStatus, DeploymentMode, TelehealthComponent } from './types/telehealth.types';

export class TelehealthManager extends EventEmitter {
  private config: TelehealthConfig;
  private components: Map<string, TelehealthComponent> = new Map();
  private deploymentMode: DeploymentMode;
  private isInitialized: boolean = false;

  constructor(config: TelehealthConfig) {
    super();
    this.config = config;
    this.deploymentMode = config.deploymentMode || 'full-suite';
  }

  /**
   * Initialize the telehealth manager and load components
   */
  async initialize(): Promise<void> {
    try {
      this.logInfo('Initializing Telehealth Manager', { 
        deploymentMode: this.deploymentMode,
        enabledComponents: this.config.enabledComponents 
      });

      if (this.deploymentMode === 'full-suite') {
        await this.initializeFullSuite();
      } else {
        await this.initializeStandaloneComponents();
      }

      this.isInitialized = true;
      this.emit('initialized', { deploymentMode: this.deploymentMode });
      
      this.logInfo('Telehealth Manager initialization complete');
    } catch (error) {
      this.logError('Failed to initialize Telehealth Manager', error);
      throw error;
    }
  }

  /**
   * Initialize all components for full-suite deployment
   */
  private async initializeFullSuite(): Promise<void> {
    const componentsToLoad = [
      'video-consultation',
      'messaging', 
      'ehr-integration',
      'fhir-sync'
    ];

    for (const componentName of componentsToLoad) {
      if (this.config.enabledComponents.includes(componentName)) {
        await this.loadComponent(componentName);
      }
    }

    // Setup cross-component communication
    await this.setupComponentInteroperability();
  }

  /**
   * Initialize only specified standalone components
   */
  private async initializeStandaloneComponents(): Promise<void> {
    for (const componentName of this.config.enabledComponents) {
      await this.loadComponent(componentName);
    }
  }

  /**
   * Load and initialize a specific component
   */
  private async loadComponent(componentName: string): Promise<void> {
    try {
      this.logInfo(`Loading component: ${componentName}`);

      // Dynamic import based on component name
      let ComponentClass;
      switch (componentName) {
        case 'video-consultation':
          const { VideoConsultationComponent } = await import('../components/video-consultation/video-consultation.component');
          ComponentClass = VideoConsultationComponent;
          break;
        case 'messaging':
          const { MessagingComponent } = await import('../components/messaging/messaging.component');
          ComponentClass = MessagingComponent;
          break;
        case 'ehr-integration':
          const { EHRIntegrationComponent } = await import('../components/ehr-integration/ehr-integration.component');
          ComponentClass = EHRIntegrationComponent;
          break;
        case 'fhir-sync':
          const { FHIRSyncComponent } = await import('../components/fhir-sync/fhir-sync.component');
          ComponentClass = FHIRSyncComponent;
          break;
        default:
          throw new Error(`Unknown component: ${componentName}`);
      }

      const componentConfig = this.config.components[componentName] || {};
      const component = new ComponentClass(componentConfig);
      
      await component.initialize();
      this.components.set(componentName, component);

      this.logInfo(`Component loaded successfully: ${componentName}`);
    } catch (error) {
      this.logError(`Failed to load component: ${componentName}`, error);
      throw error;
    }
  }

  /**
   * Setup interoperability between components in full-suite mode
   */
  private async setupComponentInteroperability(): Promise<void> {
    if (this.deploymentMode !== 'full-suite') return;

    this.logInfo('Setting up component interoperability');

    // Setup event forwarding between components
    this.components.forEach((component, name) => {
      component.on('*', (eventName: string, data: any) => {
        this.emit(`component:${name}:${eventName}`, data);
        
        // Forward relevant events to other components
        this.forwardEventToComponents(name, eventName, data);
      });
    });

    // Setup specific integrations
    await this.setupVideoMessagingIntegration();
    await this.setupEHRDataFlow();
  }

  /**
   * Setup integration between video consultations and messaging
   */
  private async setupVideoMessagingIntegration(): Promise<void> {
    const videoComponent = this.components.get('video-consultation');
    const messagingComponent = this.components.get('messaging');

    if (videoComponent && messagingComponent) {
      // When video call starts, create messaging channel
      videoComponent.on('call:started', async (callData) => {
        await messagingComponent.createConsultationChannel(callData.sessionId);
      });

      // When video call ends, archive messaging channel
      videoComponent.on('call:ended', async (callData) => {
        await messagingComponent.archiveChannel(callData.sessionId);
      });
    }
  }

  /**
   * Setup data flow between EHR and FHIR components
   */
  private async setupEHRDataFlow(): Promise<void> {
    const ehrComponent = this.components.get('ehr-integration');
    const fhirComponent = this.components.get('fhir-sync');

    if (ehrComponent && fhirComponent) {
      // When EHR data is updated, sync to FHIR
      ehrComponent.on('data:updated', async (updateData) => {
        await fhirComponent.syncFromEHR(updateData);
      });

      // When FHIR data is received, update EHR
      fhirComponent.on('data:received', async (fhirData) => {
        await ehrComponent.updateFromFHIR(fhirData);
      });
    }
  }

  /**
   * Forward events between components
   */
  private forwardEventToComponents(sourceComponent: string, eventName: string, data: any): void {
    // Define event forwarding rules
    const forwardingRules = {
      'patient:selected': ['video-consultation', 'messaging', 'ehr-integration'],
      'appointment:created': ['video-consultation', 'fhir-sync'],
      'consultation:notes': ['ehr-integration', 'fhir-sync']
    };

    const targetComponents = forwardingRules[eventName as keyof typeof forwardingRules];
    if (targetComponents) {
      targetComponents.forEach(targetName => {
        if (targetName !== sourceComponent) {
          const targetComponent = this.components.get(targetName);
          if (targetComponent) {
            targetComponent.handleExternalEvent(eventName, data);
          }
        }
      });
    }
  }

  /**
   * Get the status of all components
   */
  getComponentStatus(): Record<string, ComponentStatus> {
    const status: Record<string, ComponentStatus> = {};
    
    this.components.forEach((component, name) => {
      status[name] = component.getStatus();
    });

    return status;
  }

  /**
   * Get health status of the telehealth manager
   */
  getHealthStatus(): { healthy: boolean; components: Record<string, ComponentStatus>; deploymentMode: DeploymentMode } {
    const componentStatus = this.getComponentStatus();
    const healthy = Object.values(componentStatus).every(status => status.healthy);

    return {
      healthy: healthy && this.isInitialized,
      components: componentStatus,
      deploymentMode: this.deploymentMode
    };
  }

  /**
   * Start a component if it exists
   */
  async startComponent(componentName: string): Promise<void> {
    const component = this.components.get(componentName);
    if (!component) {
      throw new Error(`Component not found: ${componentName}`);
    }

    await component.start();
    this.logInfo(`Component started: ${componentName}`);
  }

  /**
   * Stop a component if it exists
   */
  async stopComponent(componentName: string): Promise<void> {
    const component = this.components.get(componentName);
    if (!component) {
      throw new Error(`Component not found: ${componentName}`);
    }

    await component.stop();
    this.logInfo(`Component stopped: ${componentName}`);
  }

  /**
   * Gracefully shutdown all components
   */
  async shutdown(): Promise<void> {
    this.logInfo('Shutting down Telehealth Manager');

    for (const [name, component] of this.components) {
      try {
        await component.stop();
        this.logInfo(`Component stopped: ${name}`);
      } catch (error) {
        this.logError(`Error stopping component: ${name}`, error);
      }
    }

    this.components.clear();
    this.isInitialized = false;
    this.emit('shutdown');
  }

  /**
   * Get a specific component instance
   */
  getComponent<T extends TelehealthComponent>(componentName: string): T | undefined {
    return this.components.get(componentName) as T;
  }

  /**
   * Check if manager is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Log info message
   */
  private logInfo(message: string, context?: any): void {
    console.log(`[Telehealth Manager] ${message}`, context || '');
  }

  /**
   * Log error message
   */
  private logError(message: string, error: any): void {
    console.error(`[Telehealth Manager] ${message}`, error);
  }
}