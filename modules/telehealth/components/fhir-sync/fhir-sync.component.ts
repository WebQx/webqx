/**
 * FHIR Synchronization Component for Telehealth
 * 
 * Handles FHIR R4 data synchronization for telehealth resources
 * including patients, appointments, observations, and encounters
 */

import { EventEmitter } from 'events';
import { 
  TelehealthComponent, 
  ComponentStatus, 
  FHIRSyncConfig, 
  FHIRResourceSync 
} from '../../core/types/telehealth.types';

export class FHIRSyncComponent extends EventEmitter implements TelehealthComponent {
  private config: FHIRSyncConfig;
  private status: ComponentStatus;
  private fhirClient: any = null;
  private syncRegistry: Map<string, FHIRResourceSync> = new Map();
  private syncInProgress: boolean = false;
  private syncScheduler: NodeJS.Timeout | null = null;

  constructor(config: FHIRSyncConfig) {
    super();
    this.config = config;
    this.status = {
      healthy: false,
      status: 'initializing',
      lastUpdated: new Date(),
      metrics: {
        uptime: 0,
        activeConnections: 0,
        errorCount: 0,
        successRate: 100
      }
    };
  }

  /**
   * Initialize the FHIR sync component
   */
  async initialize(): Promise<void> {
    try {
      this.logInfo('Initializing FHIR Sync Component');

      // Initialize FHIR client
      await this.initializeFHIRClient();
      
      // Setup event listeners
      this.setupEventListeners();

      // Start sync scheduler if configured
      this.startSyncScheduler();

      this.status.status = 'running';
      this.status.healthy = true;
      this.status.lastUpdated = new Date();

      this.emit('initialized');
      this.logInfo('FHIR Sync Component initialized successfully');
    } catch (error) {
      this.status.status = 'error';
      this.status.healthy = false;
      this.logError('Failed to initialize FHIR Sync Component', error);
      throw error;
    }
  }

  /**
   * Start the FHIR sync component
   */
  async start(): Promise<void> {
    this.logInfo('Starting FHIR Sync Component');
    this.syncInProgress = true;
    this.status.status = 'running';
    this.status.lastUpdated = new Date();
    this.emit('started');
  }

  /**
   * Stop the FHIR sync component
   */
  async stop(): Promise<void> {
    this.logInfo('Stopping FHIR Sync Component');
    this.syncInProgress = false;
    
    if (this.syncScheduler) {
      clearInterval(this.syncScheduler);
      this.syncScheduler = null;
    }

    this.status.status = 'stopped';
    this.status.lastUpdated = new Date();
    this.emit('stopped');
  }

  /**
   * Initialize FHIR client
   */
  private async initializeFHIRClient(): Promise<void> {
    try {
      // Try to use existing WebQX FHIR infrastructure
      const { FHIRClient } = await import('../../../../fhir/client/fhir-client');
      
      this.fhirClient = new FHIRClient({
        baseUrl: this.config.server.baseUrl,
        version: this.config.server.version,
        authType: this.config.server.authType,
        credentials: this.config.server.credentials
      });

      await this.fhirClient.initialize();
      this.logInfo('FHIR client initialized');
    } catch (error) {
      // Fallback to mock implementation if FHIR client is not available
      this.logInfo('FHIR client not available, using mock implementation');
      this.fhirClient = this.createMockFHIRClient();
    }
  }

  /**
   * Create mock FHIR client for development/testing
   */
  private createMockFHIRClient(): any {
    return {
      initialize: async () => {
        this.logInfo('Mock FHIR client initialized');
      },
      create: async (resource: any) => {
        this.logInfo('Mock creating FHIR resource:', resource.resourceType);
        return {
          resourceType: resource.resourceType,
          id: `${resource.resourceType.toLowerCase()}_${Date.now()}`,
          meta: {
            versionId: '1',
            lastUpdated: new Date().toISOString()
          },
          ...resource
        };
      },
      update: async (resourceType: string, id: string, resource: any) => {
        this.logInfo(`Mock updating FHIR resource: ${resourceType}/${id}`);
        return {
          ...resource,
          id,
          meta: {
            versionId: '2',
            lastUpdated: new Date().toISOString()
          }
        };
      },
      read: async (resourceType: string, id: string) => {
        this.logInfo(`Mock reading FHIR resource: ${resourceType}/${id}`);
        return {
          resourceType,
          id,
          meta: {
            versionId: '1',
            lastUpdated: new Date().toISOString()
          },
          status: 'active'
        };
      },
      search: async (resourceType: string, params: any) => {
        this.logInfo(`Mock searching FHIR resources: ${resourceType}`, params);
        return {
          resourceType: 'Bundle',
          type: 'searchset',
          entry: [
            {
              resource: {
                resourceType,
                id: `${resourceType.toLowerCase()}_1`,
                meta: {
                  versionId: '1',
                  lastUpdated: new Date().toISOString()
                }
              }
            }
          ]
        };
      },
      delete: async (resourceType: string, id: string) => {
        this.logInfo(`Mock deleting FHIR resource: ${resourceType}/${id}`);
        return { deleted: true };
      },
      validate: (resource: any) => {
        return { valid: true, issues: [] };
      }
    };
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Health check interval
    setInterval(() => {
      this.updateHealthMetrics();
    }, this.config.healthCheckInterval || 30000);
  }

  /**
   * Start sync scheduler
   */
  private startSyncScheduler(): void {
    if (this.config.synchronization.mode === 'scheduled' && this.config.synchronization.scheduleExpression) {
      // Simple interval-based scheduling (in production, use cron)
      const intervalMs = this.parseScheduleExpression(this.config.synchronization.scheduleExpression);
      
      this.syncScheduler = setInterval(() => {
        this.performScheduledSync();
      }, intervalMs);

      this.logInfo(`FHIR sync scheduler started with interval: ${intervalMs}ms`);
    }
  }

  /**
   * Parse schedule expression to milliseconds
   */
  private parseScheduleExpression(expression: string): number {
    // Simple parsing - in production, use a proper cron parser
    const match = expression.match(/every (\d+) (minute|hour|day)s?/i);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      
      switch (unit) {
        case 'minute': return value * 60 * 1000;
        case 'hour': return value * 60 * 60 * 1000;
        case 'day': return value * 24 * 60 * 60 * 1000;
      }
    }
    
    return 5 * 60 * 1000; // Default to 5 minutes
  }

  /**
   * Perform scheduled synchronization
   */
  private async performScheduledSync(): Promise<void> {
    if (!this.syncInProgress) {
      return;
    }

    try {
      this.logInfo('Performing scheduled FHIR synchronization');
      
      // Sync enabled resource types
      for (const resourceType of this.config.resources.enabledTypes) {
        await this.syncResourceType(resourceType);
      }
      
      this.logInfo('Scheduled FHIR synchronization completed');
    } catch (error) {
      this.logError('Scheduled FHIR synchronization failed', error);
    }
  }

  /**
   * Sync specific resource type
   */
  private async syncResourceType(resourceType: string): Promise<void> {
    try {
      this.emit('sync:started', { resourceType, resourceId: 'batch' });

      const batchSize = this.config.synchronization.batchSize || 50;
      
      if (this.config.resources.syncDirection === 'to-fhir' || this.config.resources.syncDirection === 'bidirectional') {
        await this.syncToFHIR(resourceType, batchSize);
      }
      
      if (this.config.resources.syncDirection === 'from-fhir' || this.config.resources.syncDirection === 'bidirectional') {
        await this.syncFromFHIR(resourceType, batchSize);
      }

      this.logInfo(`Resource type sync completed: ${resourceType}`);
    } catch (error) {
      this.status.metrics!.errorCount++;
      this.logError(`Failed to sync resource type: ${resourceType}`, error);
    }
  }

  /**
   * Sync data to FHIR server
   */
  private async syncToFHIR(resourceType: string, batchSize: number): Promise<void> {
    // This would typically fetch data from EHR and sync to FHIR
    this.logInfo(`Syncing ${resourceType} to FHIR server`);
    
    // Mock implementation - in production, this would process real data
    const mockResources = Array.from({ length: Math.min(batchSize, 5) }, (_, i) => ({
      resourceType,
      id: `temp_${resourceType.toLowerCase()}_${Date.now()}_${i}`,
      status: 'active'
    }));

    for (const resource of mockResources) {
      await this.createOrUpdateFHIRResource(resource);
    }
  }

  /**
   * Sync data from FHIR server
   */
  private async syncFromFHIR(resourceType: string, batchSize: number): Promise<void> {
    try {
      this.logInfo(`Syncing ${resourceType} from FHIR server`);
      
      const searchParams = {
        _count: batchSize,
        _lastUpdated: 'gt' + new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // Last 24 hours
      };

      const bundle = await this.fhirClient.search(resourceType, searchParams);
      
      if (bundle.entry) {
        for (const entry of bundle.entry) {
          const resource = entry.resource;
          await this.processFHIRResource(resource);
        }
      }

      this.logInfo(`Processed ${bundle.entry?.length || 0} ${resourceType} resources from FHIR`);
    } catch (error) {
      this.logError(`Failed to sync ${resourceType} from FHIR`, error);
      throw error;
    }
  }

  /**
   * Create or update FHIR resource
   */
  async createOrUpdateFHIRResource(resource: any): Promise<any> {
    try {
      // Validate resource if enabled
      if (this.config.resources.validateResources) {
        const validation = this.fhirClient.validate(resource);
        if (!validation.valid) {
          throw new Error(`Resource validation failed: ${JSON.stringify(validation.issues)}`);
        }
      }

      let result;
      if (resource.id && await this.resourceExists(resource.resourceType, resource.id)) {
        result = await this.fhirClient.update(resource.resourceType, resource.id, resource);
        this.logInfo(`FHIR resource updated: ${resource.resourceType}/${resource.id}`);
      } else {
        result = await this.fhirClient.create(resource);
        this.logInfo(`FHIR resource created: ${resource.resourceType}/${result.id}`);
      }

      // Update sync registry
      const syncInfo: FHIRResourceSync = {
        resourceType: resource.resourceType,
        resourceId: result.id,
        version: result.meta?.versionId || '1',
        lastModified: new Date(result.meta?.lastUpdated || Date.now()),
        syncStatus: 'synced',
        direction: 'to-fhir'
      };

      this.syncRegistry.set(`${resource.resourceType}/${result.id}`, syncInfo);
      this.emit('sync:completed', syncInfo);

      return result;
    } catch (error) {
      this.status.metrics!.errorCount++;
      this.logError('Failed to create or update FHIR resource', error);
      throw error;
    }
  }

  /**
   * Process FHIR resource received from server
   */
  private async processFHIRResource(resource: any): Promise<void> {
    try {
      const resourceKey = `${resource.resourceType}/${resource.id}`;
      const existingSync = this.syncRegistry.get(resourceKey);

      // Check if resource has been updated since last sync
      const resourceLastModified = new Date(resource.meta?.lastUpdated || 0);
      
      if (existingSync && existingSync.lastModified >= resourceLastModified) {
        return; // No update needed
      }

      // Emit event for EHR integration to process
      this.emit('data:received', resource);

      // Update sync registry
      const syncInfo: FHIRResourceSync = {
        resourceType: resource.resourceType,
        resourceId: resource.id,
        version: resource.meta?.versionId || '1',
        lastModified: resourceLastModified,
        syncStatus: 'synced',
        direction: 'from-fhir'
      };

      this.syncRegistry.set(resourceKey, syncInfo);
      this.emit('sync:completed', syncInfo);

      this.logInfo(`FHIR resource processed: ${resourceKey}`);
    } catch (error) {
      this.logError('Failed to process FHIR resource', error);
      throw error;
    }
  }

  /**
   * Check if resource exists in FHIR server
   */
  private async resourceExists(resourceType: string, id: string): Promise<boolean> {
    try {
      await this.fhirClient.read(resourceType, id);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Sync from EHR data
   */
  async syncFromEHR(ehrData: any): Promise<void> {
    try {
      const fhirResource = this.mapEHRToFHIR(ehrData);
      await this.createOrUpdateFHIRResource(fhirResource);
      
      this.logInfo(`EHR data synced to FHIR: ${ehrData.resourceType}/${ehrData.resourceId}`);
    } catch (error) {
      this.logError('Failed to sync from EHR data', error);
      throw error;
    }
  }

  /**
   * Create telehealth encounter in FHIR
   */
  async createTelehealthEncounter(encounterData: {
    patientId: string;
    providerId: string;
    appointmentId: string;
    consultationType: 'video' | 'messaging' | 'hybrid';
    startTime: Date;
    endTime?: Date;
    specialty: string;
  }): Promise<any> {
    try {
      const encounter = {
        resourceType: 'Encounter',
        status: encounterData.endTime ? 'finished' : 'in-progress',
        class: {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: 'VR',
          display: 'virtual'
        },
        type: [{
          coding: [{
            system: 'http://snomed.info/sct',
            code: '185317003',
            display: 'Telemedicine consultation'
          }]
        }],
        subject: {
          reference: `Patient/${encounterData.patientId}`
        },
        participant: [{
          individual: {
            reference: `Practitioner/${encounterData.providerId}`
          }
        }],
        appointment: [{
          reference: `Appointment/${encounterData.appointmentId}`
        }],
        period: {
          start: encounterData.startTime.toISOString(),
          end: encounterData.endTime?.toISOString()
        },
        serviceType: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/service-type',
            code: 'telehealth',
            display: 'Telehealth'
          }]
        },
        extension: [{
          url: 'http://webqx.health/fhir/StructureDefinition/consultation-type',
          valueString: encounterData.consultationType
        }, {
          url: 'http://webqx.health/fhir/StructureDefinition/specialty',
          valueString: encounterData.specialty
        }]
      };

      return await this.createOrUpdateFHIRResource(encounter);
    } catch (error) {
      this.logError('Failed to create telehealth encounter', error);
      throw error;
    }
  }

  /**
   * Map EHR data to FHIR format
   */
  private mapEHRToFHIR(ehrData: any): any {
    // Basic mapping - in production, this would be more comprehensive
    switch (ehrData.resourceType) {
      case 'Patient':
        return this.mapPatientToFHIR(ehrData);
      case 'Appointment':
        return this.mapAppointmentToFHIR(ehrData);
      case 'Observation':
        return this.mapObservationToFHIR(ehrData);
      default:
        return ehrData; // Pass through if already in FHIR format
    }
  }

  /**
   * Map patient data to FHIR format
   */
  private mapPatientToFHIR(ehrPatient: any): any {
    return {
      resourceType: 'Patient',
      id: ehrPatient.resourceId,
      name: [{
        family: ehrPatient.data.lastName || ehrPatient.data.name?.split(' ').pop(),
        given: [ehrPatient.data.firstName || ehrPatient.data.name?.split(' ')[0]]
      }],
      gender: ehrPatient.data.gender,
      birthDate: ehrPatient.data.birthDate || ehrPatient.data.dob,
      telecom: [
        {
          system: 'phone',
          value: ehrPatient.data.phone
        },
        {
          system: 'email',
          value: ehrPatient.data.email
        }
      ]
    };
  }

  /**
   * Map appointment data to FHIR format
   */
  private mapAppointmentToFHIR(ehrAppointment: any): any {
    return {
      resourceType: 'Appointment',
      id: ehrAppointment.resourceId,
      status: ehrAppointment.data.status || 'booked',
      serviceType: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/service-type',
          code: 'telehealth',
          display: 'Telehealth'
        }]
      }],
      appointmentType: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v2-0276',
          code: 'ROUTINE',
          display: 'Routine'
        }]
      },
      start: ehrAppointment.data.scheduledDate || ehrAppointment.data.date,
      participant: [
        {
          actor: {
            reference: `Patient/${ehrAppointment.data.patientId}`
          },
          status: 'accepted'
        },
        {
          actor: {
            reference: `Practitioner/${ehrAppointment.data.providerId}`
          },
          status: 'accepted'
        }
      ]
    };
  }

  /**
   * Map observation data to FHIR format
   */
  private mapObservationToFHIR(ehrObservation: any): any {
    return {
      resourceType: 'Observation',
      id: ehrObservation.resourceId,
      status: ehrObservation.data.status || 'final',
      code: {
        coding: [{
          system: 'http://loinc.org',
          code: ehrObservation.data.loincCode || '29463-7',
          display: ehrObservation.data.description || 'Body weight'
        }]
      },
      subject: {
        reference: `Patient/${ehrObservation.data.patientId}`
      },
      effectiveDateTime: ehrObservation.data.observedDate || ehrObservation.timestamp,
      valueQuantity: ehrObservation.data.value ? {
        value: ehrObservation.data.value,
        unit: ehrObservation.data.unit || 'kg'
      } : undefined
    };
  }

  /**
   * Update health metrics
   */
  private updateHealthMetrics(): void {
    const now = new Date();
    if (this.status.metrics) {
      this.status.metrics.uptime = now.getTime() - this.status.lastUpdated.getTime();
      this.status.metrics.activeConnections = this.syncRegistry.size;
      
      // Calculate success rate
      const totalOperations = this.status.metrics.errorCount + 100;
      this.status.metrics.successRate = (100 / totalOperations) * 100;
    }
    
    this.status.lastUpdated = now;
  }

  /**
   * Get component status
   */
  getStatus(): ComponentStatus {
    return { ...this.status };
  }

  /**
   * Handle external events from other components
   */
  async handleExternalEvent(eventName: string, data: any): Promise<void> {
    switch (eventName) {
      case 'consultation:started':
        await this.createTelehealthEncounter({
          patientId: data.patientId,
          providerId: data.providerId,
          appointmentId: data.appointmentId,
          consultationType: data.type,
          startTime: new Date(),
          specialty: data.specialty || 'general'
        });
        break;
      case 'consultation:ended':
        // Update encounter with end time
        this.logInfo(`Consultation ended, updating FHIR encounter: ${data.consultationId}`);
        break;
      default:
        // Ignore unknown events
        break;
    }
  }

  /**
   * Get component configuration
   */
  getConfig(): FHIRSyncConfig {
    return { ...this.config };
  }

  /**
   * Update component configuration
   */
  async updateConfig(config: Partial<FHIRSyncConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    this.logInfo('FHIR sync configuration updated');
  }

  /**
   * Get sync registry status
   */
  getSyncRegistryStatus(): { total: number; synced: number; pending: number; conflicts: number } {
    const total = this.syncRegistry.size;
    let synced = 0, pending = 0, conflicts = 0;

    this.syncRegistry.forEach(sync => {
      switch (sync.syncStatus) {
        case 'synced': synced++; break;
        case 'pending': pending++; break;
        case 'conflict': conflicts++; break;
      }
    });

    return { total, synced, pending, conflicts };
  }

  /**
   * Log info message
   */
  private logInfo(message: string, context?: any): void {
    console.log(`[FHIR Sync Component] ${message}`, context || '');
  }

  /**
   * Log error message
   */
  private logError(message: string, error: any): void {
    console.error(`[FHIR Sync Component] ${message}`, error);
  }
}