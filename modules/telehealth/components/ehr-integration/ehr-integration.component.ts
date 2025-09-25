/**
 * EHR Integration Component for Telehealth
 * 
 * Integrates with existing WebQX™ EHR infrastructure,
 * specifically OpenEMR and other supported systems
 */

import { EventEmitter } from 'events';
import { 
  TelehealthComponent, 
  ComponentStatus, 
  EHRIntegrationConfig, 
  EHRSyncEvent 
} from '../../core/types/telehealth.types';
import { DynamicBatchManager } from '../../../../services/dynamicBatchManager';
import { ServerLoadMonitor } from '../../../../services/serverLoadMonitor';

export class EHRIntegrationComponent extends EventEmitter implements TelehealthComponent {
  private config: EHRIntegrationConfig;
  private status: ComponentStatus;
  private ehrService: any = null;
  private syncQueue: Map<string, EHRSyncEvent> = new Map();
  private syncInProgress: boolean = false;
  private dynamicBatchManager?: DynamicBatchManager;

  constructor(config: EHRIntegrationConfig) {
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

    // Initialize dynamic batch management if enabled
    if (this.config.enableDynamicBatchSize) {
      this.initializeDynamicBatchManager();
    }
  }

  /**
   * Initialize the EHR integration component
   */
  async initialize(): Promise<void> {
    try {
      this.logInfo('Initializing EHR Integration Component');

      // Initialize EHR service using existing WebQX infrastructure
      await this.initializeEHRService();
      
      // Setup event listeners
      this.setupEventListeners();

      // Start sync process
      this.startSyncProcess();

      this.status.status = 'running';
      this.status.healthy = true;
      this.status.lastUpdated = new Date();

      this.emit('initialized');
      this.logInfo('EHR Integration Component initialized successfully');
    } catch (error) {
      this.status.status = 'error';
      this.status.healthy = false;
      this.logError('Failed to initialize EHR Integration Component', error);
      throw error;
    }
  }

  /**
   * Start the EHR integration component
   */
  async start(): Promise<void> {
    this.logInfo('Starting EHR Integration Component');
    this.status.status = 'running';
    this.status.lastUpdated = new Date();
    this.emit('started');
  }

  /**
   * Stop the EHR integration component
   */
  async stop(): Promise<void> {
    this.logInfo('Stopping EHR Integration Component');
    this.syncInProgress = false;
    this.status.status = 'stopped';
    this.status.lastUpdated = new Date();
    this.emit('stopped');
  }

  /**
   * Initialize EHR service
   */
  private async initializeEHRService(): Promise<void> {
    try {
      // Use existing WebQX EHR infrastructure
      const { EHRService } = await import('../../../../ehr-integrations/services/ehrService');
      
      this.ehrService = new EHRService({
        baseUrl: this.config.openemr.baseUrl,
        defaultTimeoutMs: this.config.timeout || 5000,
        enableAuditLogging: true,
        enableAutoRetry: true,
        maxConcurrentOperations: 3
      });

      // Setup EHR configuration
      await this.ehrService.addConfiguration({
        configId: 'telehealth-openemr',
        systemType: 'openemr',
        baseUrl: this.config.openemr.baseUrl,
        credentials: {
          apiKey: this.config.openemr.apiKey,
          clientId: this.config.openemr.clientId
        },
        settings: {
          version: this.config.openemr.version,
          timeout: this.config.timeout
        }
      });

      this.logInfo('EHR service initialized');
    } catch (error) {
      // Fallback to mock implementation if EHR service is not available
      this.logInfo('EHR service not available, using mock implementation');
      this.ehrService = this.createMockEHRService();
    }
  }

  /**
   * Create mock EHR service for development/testing
   */
  private createMockEHRService(): any {
    return {
      getPatient: async (patientId: string) => {
        this.logInfo(`Mock getting patient: ${patientId}`);
        return {
          success: true,
          data: {
            id: patientId,
            name: 'John Doe',
            birthDate: '1990-01-01',
            gender: 'male',
            phone: '555-0123',
            email: 'john.doe@example.com'
          }
        };
      },
      createAppointment: async (appointmentData: any) => {
        this.logInfo('Mock creating appointment:', appointmentData);
        return {
          success: true,
          data: {
            id: `apt_${Date.now()}`,
            ...appointmentData,
            status: 'scheduled'
          }
        };
      },
      updatePatientNotes: async (patientId: string, notes: string) => {
        this.logInfo(`Mock updating patient notes: ${patientId}`);
        return {
          success: true,
          data: {
            noteId: `note_${Date.now()}`,
            patientId,
            notes,
            timestamp: new Date()
          }
        };
      },
      getAppointments: async (filters: any) => {
        this.logInfo('Mock getting appointments:', filters);
        return {
          success: true,
          data: [
            {
              id: 'apt_1',
              patientId: filters.patientId,
              providerId: 'prov_1',
              date: new Date(),
              type: 'consultation',
              status: 'scheduled'
            }
          ]
        };
      },
      syncData: async (syncEvent: EHRSyncEvent) => {
        this.logInfo('Mock syncing data:', syncEvent);
        return {
          success: true,
          data: { ...syncEvent, status: 'success' }
        };
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

    // Sync interval
    setInterval(() => {
      this.processSyncQueue();
    }, this.config.sync.interval || 60000);
  }

  /**
   * Start sync process
   */
  private startSyncProcess(): void {
    this.syncInProgress = true;
    this.logInfo('EHR sync process started');
  }

  /**
   * Process sync queue
   */
  private async processSyncQueue(): Promise<void> {
    if (!this.syncInProgress || this.syncQueue.size === 0) {
      return;
    }

    this.logInfo(`Processing sync queue: ${this.syncQueue.size} items`);

    const batchSize = this.getDynamicBatchSize();
    const events = Array.from(this.syncQueue.values()).slice(0, batchSize);

    this.logInfo(`Processing ${events.length} sync events with batch size: ${batchSize}`);

    for (const syncEvent of events) {
      try {
        await this.processSyncEvent(syncEvent);
        this.syncQueue.delete(syncEvent.eventId);
        
        this.emit('sync:completed', syncEvent);
      } catch (error) {
        syncEvent.status = 'failed';
        this.emit('sync:failed', { event: syncEvent, error });
        this.status.metrics!.errorCount++;
      }
    }
  }

  /**
   * Process individual sync event
   */
  private async processSyncEvent(syncEvent: EHRSyncEvent): Promise<void> {
    this.emit('sync:started', { 
      resourceType: syncEvent.resourceType, 
      resourceId: syncEvent.resourceId 
    });

    switch (syncEvent.eventType) {
      case 'create':
        await this.createResource(syncEvent);
        break;
      case 'update':
        await this.updateResource(syncEvent);
        break;
      case 'delete':
        await this.deleteResource(syncEvent);
        break;
    }

    syncEvent.status = 'success';
    this.logInfo(`Sync event processed: ${syncEvent.eventId}`);
  }

  /**
   * Create resource in EHR
   */
  private async createResource(syncEvent: EHRSyncEvent): Promise<void> {
    const result = await this.ehrService.syncData(syncEvent);
    if (!result.success) {
      throw new Error(`Failed to create resource: ${result.error}`);
    }
  }

  /**
   * Update resource in EHR
   */
  private async updateResource(syncEvent: EHRSyncEvent): Promise<void> {
    const result = await this.ehrService.syncData(syncEvent);
    if (!result.success) {
      throw new Error(`Failed to update resource: ${result.error}`);
    }
  }

  /**
   * Delete resource from EHR
   */
  private async deleteResource(syncEvent: EHRSyncEvent): Promise<void> {
    const result = await this.ehrService.syncData(syncEvent);
    if (!result.success) {
      throw new Error(`Failed to delete resource: ${result.error}`);
    }
  }

  /**
   * Get patient data
   */
  async getPatient(patientId: string): Promise<any> {
    try {
      const result = await this.ehrService.getPatient(patientId);
      if (!result.success) {
        throw new Error(`Failed to get patient: ${result.error}`);
      }

      this.logInfo(`Patient data retrieved: ${patientId}`);
      return result.data;
    } catch (error) {
      this.status.metrics!.errorCount++;
      this.logError('Failed to get patient data', error);
      throw error;
    }
  }

  /**
   * Create telehealth appointment
   */
  async createTelehealthAppointment(appointmentData: {
    patientId: string;
    providerId: string;
    scheduledDate: Date;
    type: 'video' | 'messaging' | 'hybrid';
    specialty: string;
    notes?: string;
  }): Promise<any> {
    try {
      const ehrAppointmentData = this.mapTelehealthToEHR(appointmentData);
      const result = await this.ehrService.createAppointment(ehrAppointmentData);
      
      if (!result.success) {
        throw new Error(`Failed to create appointment: ${result.error}`);
      }

      // Add to sync queue for FHIR sync
      this.addToSyncQueue({
        eventId: `apt_create_${Date.now()}`,
        eventType: 'create',
        resourceType: 'Appointment',
        resourceId: result.data.id,
        timestamp: new Date(),
        source: 'webqx',
        data: result.data,
        status: 'pending'
      });

      this.emit('appointment:created', result.data);
      this.logInfo(`Telehealth appointment created: ${result.data.id}`);
      
      return result.data;
    } catch (error) {
      this.status.metrics!.errorCount++;
      this.logError('Failed to create telehealth appointment', error);
      throw error;
    }
  }

  /**
   * Update consultation notes
   */
  async updateConsultationNotes(consultationId: string, patientId: string, notes: string, providerId: string): Promise<void> {
    try {
      const noteData = {
        consultationId,
        patientId,
        providerId,
        notes,
        timestamp: new Date(),
        type: 'telehealth_consultation'
      };

      const result = await this.ehrService.updatePatientNotes(patientId, JSON.stringify(noteData));
      
      if (!result.success) {
        throw new Error(`Failed to update consultation notes: ${result.error}`);
      }

      // Add to sync queue
      this.addToSyncQueue({
        eventId: `notes_update_${Date.now()}`,
        eventType: 'update',
        resourceType: 'DocumentReference',
        resourceId: result.data.noteId,
        timestamp: new Date(),
        source: 'webqx',
        data: noteData,
        status: 'pending'
      });

      this.emit('consultation:notes', { consultationId, notes, providerId });
      this.logInfo(`Consultation notes updated: ${consultationId}`);
    } catch (error) {
      this.status.metrics!.errorCount++;
      this.logError('Failed to update consultation notes', error);
      throw error;
    }
  }

  /**
   * Get patient appointments
   */
  async getPatientAppointments(patientId: string, includeCompleted: boolean = false): Promise<any[]> {
    try {
      const filters = {
        patientId,
        includeCompleted,
        type: 'telehealth'
      };

      const result = await this.ehrService.getAppointments(filters);
      
      if (!result.success) {
        throw new Error(`Failed to get appointments: ${result.error}`);
      }

      this.logInfo(`Retrieved ${result.data.length} appointments for patient: ${patientId}`);
      return result.data;
    } catch (error) {
      this.status.metrics!.errorCount++;
      this.logError('Failed to get patient appointments', error);
      throw error;
    }
  }

  /**
   * Update from FHIR data
   */
  async updateFromFHIR(fhirData: any): Promise<void> {
    try {
      const ehrData = this.mapFHIRToEHR(fhirData);
      
      const syncEvent: EHRSyncEvent = {
        eventId: `fhir_update_${Date.now()}`,
        eventType: 'update',
        resourceType: fhirData.resourceType,
        resourceId: fhirData.id,
        timestamp: new Date(),
        source: 'external',
        data: ehrData,
        status: 'pending'
      };

      this.addToSyncQueue(syncEvent);
      this.logInfo(`FHIR data queued for EHR update: ${fhirData.resourceType}/${fhirData.id}`);
    } catch (error) {
      this.logError('Failed to update from FHIR data', error);
      throw error;
    }
  }

  /**
   * Map telehealth appointment data to EHR format
   */
  private mapTelehealthToEHR(appointmentData: any): any {
    return {
      patient_id: appointmentData.patientId,
      provider_id: appointmentData.providerId,
      appointment_date: appointmentData.scheduledDate.toISOString(),
      appointment_type: 'telehealth',
      consultation_type: appointmentData.type,
      specialty: appointmentData.specialty,
      notes: appointmentData.notes || '',
      status: 'scheduled',
      telehealth_enabled: true
    };
  }

  /**
   * Map FHIR data to EHR format
   */
  private mapFHIRToEHR(fhirData: any): any {
    // Apply configured data mappings
    const mappings = this.config.dataMapping;
    const ehrData: any = {};

    if (fhirData.resourceType === 'Patient') {
      Object.entries(mappings.patientFields || {}).forEach(([fhirField, ehrField]) => {
        if (fhirData[fhirField]) {
          ehrData[ehrField] = fhirData[fhirField];
        }
      });
    } else if (fhirData.resourceType === 'Appointment') {
      Object.entries(mappings.appointmentFields || {}).forEach(([fhirField, ehrField]) => {
        if (fhirData[fhirField]) {
          ehrData[ehrField] = fhirData[fhirField];
        }
      });
    }

    // Apply custom mappings
    Object.entries(mappings.customMappings || {}).forEach(([fhirPath, ehrField]) => {
      const value = this.getNestedValue(fhirData, fhirPath);
      if (value !== undefined) {
        ehrData[ehrField] = value;
      }
    });

    return ehrData;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Add event to sync queue
   */
  private addToSyncQueue(syncEvent: EHRSyncEvent): void {
    this.syncQueue.set(syncEvent.eventId, syncEvent);
    this.logInfo(`Added to sync queue: ${syncEvent.eventId}`);
  }

  /**
   * Update health metrics
   */
  private updateHealthMetrics(): void {
    const now = new Date();
    if (this.status.metrics) {
      this.status.metrics.uptime = now.getTime() - this.status.lastUpdated.getTime();
      this.status.metrics.activeConnections = this.syncQueue.size;
      
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
      case 'consultation:notes':
        await this.updateConsultationNotes(
          data.consultationId, 
          data.patientId, 
          data.notes, 
          data.providerId
        );
        break;
      case 'appointment:created':
        this.emit('data:updated', {
          resourceType: 'Appointment',
          resourceId: data.appointmentId,
          data: data
        });
        break;
      case 'patient:selected':
        this.logInfo(`Patient selected for EHR integration: ${data.patientId}`);
        break;
      default:
        // Ignore unknown events
        break;
    }
  }

  /**
   * Get component configuration
   */
  getConfig(): EHRIntegrationConfig {
    return { ...this.config };
  }

  /**
   * Update component configuration
   */
  async updateConfig(config: Partial<EHRIntegrationConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    this.logInfo('EHR integration configuration updated');
  }

  /**
   * Get sync queue status
   */
  getSyncQueueStatus(): { pending: number; processing: boolean } {
    return {
      pending: this.syncQueue.size,
      processing: this.syncInProgress
    };
  }

  /**
   * Initialize dynamic batch manager
   */
  private initializeDynamicBatchManager(): void {
    const serverLoadMonitor = new ServerLoadMonitor({
      pollingInterval: 5000,
      enableLogging: this.config.debug || false
    });

    this.dynamicBatchManager = new DynamicBatchManager(
      serverLoadMonitor,
      {
        minBatchSize: 1,
        maxBatchSize: (this.config.sync.batchSize || 10) * 2,
        defaultBatchSize: this.config.sync.batchSize || 10,
        lowLoadThreshold: 50,
        highLoadThreshold: 80
      },
      this.config.debug || false
    );

    // Register the sync operation
    this.dynamicBatchManager.registerOperation('ehr-sync', this.config.sync.batchSize || 10);

    // Listen for batch size adjustments
    this.dynamicBatchManager.on('batchSizeAdjusted', (event) => {
      this.logInfo('Batch size adjusted for EHR sync', event);
    });

    // Start monitoring
    this.dynamicBatchManager.start();
  }

  /**
   * Get current batch size (dynamic or static)
   */
  private getDynamicBatchSize(): number {
    if (this.dynamicBatchManager) {
      try {
        return this.dynamicBatchManager.getBatchSize('ehr-sync');
      } catch (error) {
        this.logError('Failed to get dynamic batch size, using fallback', error);
        return this.dynamicBatchManager.getFallbackBatchSize('ehr-sync');
      }
    }
    return this.config.sync.batchSize || 10;
  }

  /**
   * Get EHR integration statistics
   */
  public getIntegrationStatistics(): any {
    const baseStats = {
      queueSize: this.syncQueue.size,
      syncInProgress: this.syncInProgress,
      currentBatchSize: this.getDynamicBatchSize(),
      dynamicBatchEnabled: !!this.dynamicBatchManager,
      errorCount: this.status.metrics?.errorCount || 0,
      successRate: this.status.metrics?.successRate || 0
    };

    if (this.dynamicBatchManager) {
      return {
        ...baseStats,
        dynamicBatchStats: this.dynamicBatchManager.getStatistics()
      };
    }

    return baseStats;
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    if (this.dynamicBatchManager) {
      this.dynamicBatchManager.stop();
    }
    this.removeAllListeners();
    this.syncQueue.clear();
  }

  /**
   * Log info message
   */
  private logInfo(message: string, context?: any): void {
    console.log(`[EHR Integration Component] ${message}`, context || '');
  }

  /**
   * Log error message
   */
  private logError(message: string, error: any): void {
    console.error(`[EHR Integration Component] ${message}`, error);
  }
}