/**
 * Enhanced EHR Engine Core
 * 
 * Robust modular EHR engine that integrates FHIR R4, real-time updates,
 * specialty modules, and external EHR systems with comprehensive
 * error handling and security.
 * 
 * @author WebQX Health
 * @version 2.0.0
 */

import { EventEmitter } from 'events';
import { FHIRR4Client, SMARTOnFHIRConfig } from './fhirR4Client';
import { AppointmentBookingService } from './appointmentBookingService';
import { RealTimeUpdateService, RealTimeUpdateEvent, RealTimeEventType } from './realTimeUpdateService';
import { EHRService } from './ehrService';
import { AuditLogger } from './auditLogger';
import {
  FHIRResource,
  FHIRPatient,
  FHIRPractitioner,
  FHIRAppointment,
  FHIRObservation,
  FHIRMedicationRequest,
  FHIRDiagnosticReport,
  FHIR_RESOURCE_TYPES
} from '../types/fhir-r4';
import {
  EHRConfiguration,
  EHRApiResponse,
  EHRApiError
} from '../types';

/**
 * EHR Engine configuration
 */
export interface EHREngineConfig {
  /** FHIR server configuration */
  fhirConfig: {
    baseUrl: string;
    smartConfig?: SMARTOnFHIRConfig;
    timeout?: number;
  };
  /** Real-time updates configuration */
  realTimeConfig?: {
    enableWebSocket?: boolean;
    websocketUrl?: string;
    pollingInterval?: number;
    authToken?: string;
  };
  /** External EHR systems configuration */
  externalSystems?: {
    openEmr?: EHRConfiguration;
    openMrs?: EHRConfiguration;
    epic?: EHRConfiguration;
    cerner?: EHRConfiguration;
  };
  /** Specialty modules configuration */
  specialtyModules?: {
    radiology?: boolean;
    cardiology?: boolean;
    oncology?: boolean;
    primaryCare?: boolean;
  };
  /** Security and compliance settings */
  security?: {
    enableEncryption?: boolean;
    auditLevel?: 'minimal' | 'standard' | 'comprehensive';
    accessControl?: boolean;
  };
  /** Performance and scaling settings */
  performance?: {
    maxConcurrentOperations?: number;
    cacheTimeout?: number;
    batchSize?: number;
  };
}

/**
 * EHR Engine operation result
 */
export interface EHREngineResult<T = any> {
  success: boolean;
  data?: T;
  error?: EHRApiError;
  metadata?: {
    operationId: string;
    timestamp: Date;
    duration: number;
    source: string;
  };
}

/**
 * Specialty module interface
 */
export interface SpecialtyModule {
  name: string;
  version: string;
  initialize(engine: EHREngineCore): Promise<void>;
  processResource(resource: FHIRResource): Promise<FHIRResource>;
  getCapabilities(): string[];
}

/**
 * External EHR connector interface
 */
export interface ExternalEHRConnector {
  systemType: string;
  connect(config: EHRConfiguration): Promise<boolean>;
  disconnect(): Promise<void>;
  syncPatientData(patientId: string): Promise<FHIRResource[]>;
  createResource(resource: FHIRResource): Promise<FHIRResource>;
  updateResource(resource: FHIRResource): Promise<FHIRResource>;
  deleteResource(resourceType: string, resourceId: string): Promise<boolean>;
}

/**
 * Enhanced EHR Engine Core
 * 
 * Provides a comprehensive EHR integration platform with:
 * - FHIR R4 compliance and SMART on FHIR OAuth2
 * - Real-time data synchronization via WebSockets
 * - Modular specialty integration
 * - External EHR system connectivity
 * - Comprehensive audit logging and error handling
 */
export class EHREngineCore extends EventEmitter {
  private config: EHREngineConfig;
  private fhirClient: FHIRR4Client;
  private appointmentService: AppointmentBookingService;
  private realTimeService: RealTimeUpdateService;
  private ehrService: EHRService;
  private auditLogger: AuditLogger;
  private specialtyModules: Map<string, SpecialtyModule> = new Map();
  private externalConnectors: Map<string, ExternalEHRConnector> = new Map();
  private activeOperations: Map<string, any> = new Map();
  private isInitialized = false;

  constructor(config: EHREngineConfig) {
    super();
    this.config = config;

    // Initialize core services
    this.fhirClient = new FHIRR4Client({
      baseUrl: config.fhirConfig.baseUrl,
      smartConfig: config.fhirConfig.smartConfig,
      timeout: config.fhirConfig.timeout || 30000
    });

    this.appointmentService = new AppointmentBookingService({
      fhirConfig: config.fhirConfig,
      realTimeConfig: config.realTimeConfig || {}
    });

    this.realTimeService = new RealTimeUpdateService(config.realTimeConfig);

    this.ehrService = new EHRService({
      enableAuditLogging: config.security?.auditLevel !== 'minimal',
      maxConcurrentOperations: config.performance?.maxConcurrentOperations || 10
    });

    this.auditLogger = new AuditLogger({
      enabled: config.security?.auditLevel !== undefined,
      logLevel: this.mapAuditLevel(config.security?.auditLevel || 'standard')
    });

    this.setupEventHandlers();
    this.logInfo('EHR Engine Core initialized', { version: '2.0.0' });
  }

  /**
   * Initialize the EHR engine and all its components
   */
  async initialize(): Promise<EHREngineResult<boolean>> {
    const operationId = this.generateOperationId();
    const startTime = Date.now();

    try {
      this.logInfo('Initializing EHR Engine Core', { operationId });

      // Initialize FHIR client capabilities
      await this.fhirClient.getCapabilities();

      // Initialize real-time service
      await this.realTimeService.start();

      // Initialize external EHR connections
      await this.initializeExternalSystems();

      // Initialize specialty modules
      await this.initializeSpecialtyModules();

      // Setup real-time event subscriptions
      this.setupRealTimeSubscriptions();

      this.isInitialized = true;
      
      const duration = Date.now() - startTime;
      this.logInfo('EHR Engine Core initialization completed', { operationId, duration });

      await this.auditLogger.log({
        action: 'initialize_engine',
        resourceType: 'ehr_engine',
        resourceId: 'core',
        success: true,
        context: { duration, version: '2.0.0' }
      });

      this.emit('engine_initialized');

      return {
        success: true,
        data: true,
        metadata: {
          operationId,
          timestamp: new Date(),
          duration,
          source: 'EHREngineCore'
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const apiError: EHRApiError = {
        code: 'ENGINE_INITIALIZATION_FAILED',
        message: 'Failed to initialize EHR Engine',
        details: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };

      this.logError('EHR Engine initialization failed', error, { operationId });

      await this.auditLogger.log({
        action: 'initialize_engine',
        resourceType: 'ehr_engine',
        resourceId: 'core',
        success: false,
        context: { error: apiError.message, duration }
      });

      return {
        success: false,
        error: apiError,
        metadata: {
          operationId,
          timestamp: new Date(),
          duration,
          source: 'EHREngineCore'
        }
      };
    }
  }

  /**
   * Shutdown the EHR engine gracefully
   */
  async shutdown(): Promise<void> {
    this.logInfo('Shutting down EHR Engine Core');

    // Stop real-time service
    await this.realTimeService.stop();

    // Disconnect external systems
    for (const connector of this.externalConnectors.values()) {
      await connector.disconnect();
    }

    // Cancel active operations
    this.activeOperations.clear();

    this.isInitialized = false;
    this.emit('engine_shutdown');

    this.logInfo('EHR Engine Core shutdown completed');
  }

  // ============================================================================
  // FHIR Resource Management
  // ============================================================================

  /**
   * Create a FHIR resource
   */
  async createResource<T extends FHIRResource>(resource: T): Promise<EHREngineResult<T>> {
    const operationId = this.generateOperationId();
    const startTime = Date.now();

    try {
      this.validateInitialized();
      
      // Process resource through specialty modules
      const processedResource = await this.processResourceThroughModules(resource);

      // Create resource via FHIR client
      const response = await this.fhirClient.createResource(processedResource);

      if (response.success && response.data) {
        // Trigger real-time update
        this.realTimeService.publishEvent({
          type: 'resource_created',
          resourceType: resource.resourceType,
          resourceId: response.data.id,
          patientId: this.extractPatientId(resource),
          timestamp: new Date(),
          data: { resource: response.data }
        });

        // Audit log
        await this.auditLogger.log({
          action: 'create_resource',
          resourceType: resource.resourceType.toLowerCase(),
          resourceId: response.data.id,
          success: true,
          context: { operationId }
        });
      }

      const duration = Date.now() - startTime;
      return {
        success: response.success,
        data: response.data,
        error: response.outcome ? this.mapOperationOutcomeToError(response.outcome) : undefined,
        metadata: {
          operationId,
          timestamp: new Date(),
          duration,
          source: 'FHIR'
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const apiError: EHRApiError = {
        code: 'RESOURCE_CREATE_FAILED',
        message: 'Failed to create FHIR resource',
        details: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };

      this.logError('Failed to create resource', error, { operationId, resourceType: resource.resourceType });

      return {
        success: false,
        error: apiError,
        metadata: {
          operationId,
          timestamp: new Date(),
          duration,
          source: 'FHIR'
        }
      };
    }
  }

  /**
   * Update a FHIR resource
   */
  async updateResource<T extends FHIRResource>(resource: T): Promise<EHREngineResult<T>> {
    const operationId = this.generateOperationId();
    const startTime = Date.now();

    try {
      this.validateInitialized();

      if (!resource.id) {
        throw new Error('Resource ID is required for update');
      }

      // Process resource through specialty modules
      const processedResource = await this.processResourceThroughModules(resource);

      // Update resource via FHIR client
      const response = await this.fhirClient.updateResource(processedResource);

      if (response.success && response.data) {
        // Trigger real-time update
        this.realTimeService.publishEvent({
          type: 'resource_updated',
          resourceType: resource.resourceType,
          resourceId: resource.id,
          patientId: this.extractPatientId(resource),
          timestamp: new Date(),
          data: { resource: response.data }
        });

        // Audit log
        await this.auditLogger.log({
          action: 'update_resource',
          resourceType: resource.resourceType.toLowerCase(),
          resourceId: resource.id,
          success: true,
          context: { operationId }
        });
      }

      const duration = Date.now() - startTime;
      return {
        success: response.success,
        data: response.data,
        error: response.outcome ? this.mapOperationOutcomeToError(response.outcome) : undefined,
        metadata: {
          operationId,
          timestamp: new Date(),
          duration,
          source: 'FHIR'
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const apiError: EHRApiError = {
        code: 'RESOURCE_UPDATE_FAILED',
        message: 'Failed to update FHIR resource',
        details: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };

      this.logError('Failed to update resource', error, { operationId, resourceType: resource.resourceType });

      return {
        success: false,
        error: apiError,
        metadata: {
          operationId,
          timestamp: new Date(),
          duration,
          source: 'FHIR'
        }
      };
    }
  }

  /**
   * Get a FHIR resource by ID
   */
  async getResource<T extends FHIRResource>(resourceType: string, resourceId: string): Promise<EHREngineResult<T>> {
    const operationId = this.generateOperationId();
    const startTime = Date.now();

    try {
      this.validateInitialized();

      // Get resource via FHIR client
      const response = await this.fhirClient.getResource(resourceType, resourceId);

      // Audit log
      await this.auditLogger.log({
        action: 'view_resource',
        resourceType: resourceType.toLowerCase(),
        resourceId,
        success: response.success,
        context: { operationId }
      });

      const duration = Date.now() - startTime;
      return {
        success: response.success,
        data: response.data as T,
        error: response.outcome ? this.mapOperationOutcomeToError(response.outcome) : undefined,
        metadata: {
          operationId,
          timestamp: new Date(),
          duration,
          source: 'FHIR'
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const apiError: EHRApiError = {
        code: 'RESOURCE_RETRIEVAL_FAILED',
        message: 'Failed to retrieve FHIR resource',
        details: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };

      this.logError('Failed to retrieve resource', error, { operationId, resourceType, resourceId });

      return {
        success: false,
        error: apiError,
        metadata: {
          operationId,
          timestamp: new Date(),
          duration,
          source: 'FHIR'
        }
      };
    }
  }

  /**
   * Delete a FHIR resource
   */
  async deleteResource(resourceType: string, resourceId: string): Promise<EHREngineResult<boolean>> {
    const operationId = this.generateOperationId();
    const startTime = Date.now();

    try {
      this.validateInitialized();

      // Delete resource via FHIR client
      const response = await this.fhirClient.deleteResource(resourceType, resourceId);

      if (response.success) {
        // Trigger real-time update
        this.realTimeService.publishEvent({
          type: 'resource_deleted',
          resourceType,
          resourceId,
          timestamp: new Date(),
          data: { deleted: true }
        });

        // Audit log
        await this.auditLogger.log({
          action: 'delete_resource',
          resourceType: resourceType.toLowerCase(),
          resourceId,
          success: true,
          context: { operationId }
        });
      }

      const duration = Date.now() - startTime;
      return {
        success: response.success,
        data: response.success,
        error: response.outcome ? this.mapOperationOutcomeToError(response.outcome) : undefined,
        metadata: {
          operationId,
          timestamp: new Date(),
          duration,
          source: 'FHIR'
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const apiError: EHRApiError = {
        code: 'RESOURCE_DELETE_FAILED',
        message: 'Failed to delete FHIR resource',
        details: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };

      this.logError('Failed to delete resource', error, { operationId, resourceType, resourceId });

      return {
        success: false,
        error: apiError,
        metadata: {
          operationId,
          timestamp: new Date(),
          duration,
          source: 'FHIR'
        }
      };
    }
  }

  // ============================================================================
  // Specialty Module Management
  // ============================================================================

  /**
   * Register a specialty module
   */
  async registerSpecialtyModule(module: SpecialtyModule): Promise<boolean> {
    try {
      await module.initialize(this);
      this.specialtyModules.set(module.name, module);
      
      this.logInfo('Specialty module registered', { 
        name: module.name, 
        version: module.version,
        capabilities: module.getCapabilities()
      });

      this.emit('specialty_module_registered', { module: module.name });
      return true;

    } catch (error) {
      this.logError('Failed to register specialty module', error, { moduleName: module.name });
      return false;
    }
  }

  /**
   * Unregister a specialty module
   */
  unregisterSpecialtyModule(moduleName: string): boolean {
    const removed = this.specialtyModules.delete(moduleName);
    if (removed) {
      this.logInfo('Specialty module unregistered', { name: moduleName });
      this.emit('specialty_module_unregistered', { module: moduleName });
    }
    return removed;
  }

  /**
   * Get registered specialty modules
   */
  getSpecialtyModules(): SpecialtyModule[] {
    return Array.from(this.specialtyModules.values());
  }

  // ============================================================================
  // External EHR System Management
  // ============================================================================

  /**
   * Register an external EHR connector
   */
  registerExternalConnector(connector: ExternalEHRConnector): void {
    this.externalConnectors.set(connector.systemType, connector);
    this.logInfo('External EHR connector registered', { systemType: connector.systemType });
  }

  /**
   * Sync patient data from external EHR system
   */
  async syncPatientFromExternal(systemType: string, patientId: string): Promise<EHREngineResult<FHIRResource[]>> {
    const operationId = this.generateOperationId();
    const startTime = Date.now();

    try {
      const connector = this.externalConnectors.get(systemType);
      if (!connector) {
        throw new Error(`External connector not found: ${systemType}`);
      }

      const resources = await connector.syncPatientData(patientId);

      // Process each resource through specialty modules and create/update in FHIR
      const processedResources: FHIRResource[] = [];
      for (const resource of resources) {
        const processed = await this.processResourceThroughModules(resource);
        const result = await this.fhirClient.createOrUpdateResource(processed);
        if (result.success && result.data) {
          processedResources.push(result.data);
        }
      }

      // Trigger real-time update
      this.realTimeService.publishEvent({
        type: 'sync_completed',
        patientId,
        ehrSystem: systemType,
        timestamp: new Date(),
        data: { resourceCount: processedResources.length }
      });

      const duration = Date.now() - startTime;
      return {
        success: true,
        data: processedResources,
        metadata: {
          operationId,
          timestamp: new Date(),
          duration,
          source: systemType
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const apiError: EHRApiError = {
        code: 'EXTERNAL_SYNC_FAILED',
        message: 'Failed to sync patient data from external system',
        details: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };

      this.logError('External sync failed', error, { operationId, systemType, patientId });

      return {
        success: false,
        error: apiError,
        metadata: {
          operationId,
          timestamp: new Date(),
          duration,
          source: systemType
        }
      };
    }
  }

  // ============================================================================
  // Real-time Updates
  // ============================================================================

  /**
   * Subscribe to real-time updates
   */
  subscribeToRealTimeUpdates(eventTypes: RealTimeEventType[], callback: (event: RealTimeUpdateEvent) => void, filters?: {
    patientId?: string;
    resourceType?: string;
    ehrSystem?: string;
  }): string {
    return this.realTimeService.subscribe({
      eventTypes,
      callback,
      ...filters
    });
  }

  /**
   * Unsubscribe from real-time updates
   */
  unsubscribeFromRealTimeUpdates(subscriptionId: string): boolean {
    return this.realTimeService.unsubscribe(subscriptionId);
  }

  /**
   * Get real-time connection status
   */
  getRealTimeStatus(): string {
    return this.realTimeService.getConnectionStatus();
  }

  // ============================================================================
  // Utility and Helper Methods
  // ============================================================================

  private validateInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('EHR Engine not initialized. Call initialize() first.');
    }
  }

  private async initializeExternalSystems(): Promise<void> {
    if (!this.config.externalSystems) return;

    for (const [systemType, config] of Object.entries(this.config.externalSystems)) {
      if (config) {
        // In a real implementation, you would create specific connectors
        // for each EHR system (OpenEMR, OpenMRS, Epic, Cerner, etc.)
        this.logInfo('External EHR system configured', { systemType });
      }
    }
  }

  private async initializeSpecialtyModules(): Promise<void> {
    if (!this.config.specialtyModules) return;

    for (const [specialty, enabled] of Object.entries(this.config.specialtyModules)) {
      if (enabled) {
        // In a real implementation, you would load and initialize
        // actual specialty modules from the modules directory
        this.logInfo('Specialty module enabled', { specialty });
      }
    }
  }

  private setupRealTimeSubscriptions(): void {
    // Subscribe to all relevant events for audit logging
    this.realTimeService.subscribe({
      eventTypes: [
        'resource_created',
        'resource_updated',
        'resource_deleted',
        'appointment_booked',
        'appointment_cancelled'
      ],
      callback: async (event) => {
        await this.auditLogger.log({
          action: event.type,
          resourceType: event.resourceType || 'unknown',
          resourceId: event.resourceId || 'unknown',
          patientMrn: event.patientId,
          success: true,
          context: { realTimeEvent: true, ehrSystem: event.ehrSystem }
        });
      }
    });
  }

  private setupEventHandlers(): void {
    this.realTimeService.on('connection_established', () => {
      this.emit('real_time_connected');
    });

    this.realTimeService.on('connection_lost', () => {
      this.emit('real_time_disconnected');
    });

    this.realTimeService.on('real_time_event', (event: RealTimeUpdateEvent) => {
      this.emit('real_time_update', event);
    });
  }

  private async processResourceThroughModules<T extends FHIRResource>(resource: T): Promise<T> {
    let processedResource = resource;

    for (const module of this.specialtyModules.values()) {
      try {
        processedResource = await module.processResource(processedResource) as T;
      } catch (error) {
        this.logError('Specialty module processing failed', error, { 
          moduleName: module.name,
          resourceType: resource.resourceType
        });
        // Continue with other modules even if one fails
      }
    }

    return processedResource;
  }

  private extractPatientId(resource: FHIRResource): string | undefined {
    // Extract patient ID from various FHIR resources
    if (resource.resourceType === 'Patient') {
      return resource.id;
    }
    
    if ('subject' in resource && resource.subject) {
      const ref = resource.subject as any;
      if (ref.reference && ref.reference.startsWith('Patient/')) {
        return ref.reference.replace('Patient/', '');
      }
    }

    if ('patient' in resource && resource.patient) {
      const ref = resource.patient as any;
      if (ref.reference && ref.reference.startsWith('Patient/')) {
        return ref.reference.replace('Patient/', '');
      }
    }

    return undefined;
  }

  private mapOperationOutcomeToError(outcome: any): EHRApiError {
    return {
      code: outcome.issue?.[0]?.code || 'OPERATION_FAILED',
      message: outcome.issue?.[0]?.details?.text || 'Operation failed',
      details: outcome.issue?.[0]?.diagnostics,
      retryable: outcome.issue?.[0]?.severity !== 'fatal'
    };
  }

  private mapAuditLevel(level: string): string {
    const mapping: Record<string, string> = {
      'minimal': 'ERROR',
      'standard': 'INFO',
      'comprehensive': 'DEBUG'
    };
    return mapping[level] || 'INFO';
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private logInfo(message: string, context?: Record<string, unknown>): void {
    console.log(`[EHR Engine Core] ${message}`, context || {});
  }

  private logError(message: string, error: unknown, context?: Record<string, unknown>): void {
    console.error(`[EHR Engine Core] ${message}`, {
      error: error instanceof Error ? error.message : error,
      context: context || {}
    });
  }
}

/**
 * Create an EHR Engine instance with the provided configuration
 */
export function createEHREngine(config: EHREngineConfig): EHREngineCore {
  return new EHREngineCore(config);
}

export default EHREngineCore;