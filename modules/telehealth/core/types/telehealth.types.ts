/**
 * WebQX™ Telehealth Module Type Definitions
 */

import { EventEmitter } from 'events';

/**
 * Deployment mode for the telehealth module
 */
export type DeploymentMode = 'full-suite' | 'standalone';

/**
 * Available telehealth components
 */
export type ComponentType = 'video-consultation' | 'messaging' | 'ehr-integration' | 'fhir-sync';

/**
 * Component status information
 */
export interface ComponentStatus {
  healthy: boolean;
  status: 'initializing' | 'running' | 'stopped' | 'error';
  lastUpdated: Date;
  metrics?: {
    uptime: number;
    activeConnections?: number;
    errorCount: number;
    successRate: number;
  };
}

/**
 * Base configuration for telehealth components
 */
export interface BaseComponentConfig {
  enabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  healthCheckInterval: number;
  retryAttempts: number;
  timeout: number;
}

/**
 * Video consultation component configuration
 */
export interface VideoConsultationConfig extends BaseComponentConfig {
  jitsi: {
    domain: string;
    appId: string;
    jwt?: {
      appSecret: string;
      keyId: string;
    };
  };
  recording: {
    enabled: boolean;
    storage: 'local' | 's3' | 'azure';
    retentionDays: number;
  };
  quality: {
    defaultResolution: '720p' | '1080p' | '480p';
    adaptiveBitrate: boolean;
    maxBitrate: number;
  };
}

/**
 * Messaging component configuration
 */
export interface MessagingConfig extends BaseComponentConfig {
  matrix: {
    homeserverUrl: string;
    accessToken: string;
    userId: string;
    deviceId: string;
  };
  encryption: {
    enabled: boolean;
    backupEnabled: boolean;
    crossSigning: boolean;
  };
  channels: {
    autoCreate: boolean;
    defaultPermissions: Record<string, any>;
    retentionDays: number;
  };
}

/**
 * EHR Integration component configuration
 */
export interface EHRIntegrationConfig extends BaseComponentConfig {
  openemr: {
    baseUrl: string;
    apiKey: string;
    clientId: string;
    version: string;
  };
  sync: {
    interval: number;
    batchSize: number;
    conflictResolution: 'latest' | 'manual' | 'merge';
  };
  dataMapping: {
    patientFields: Record<string, string>;
    appointmentFields: Record<string, string>;
    customMappings: Record<string, any>;
  };
  enableDynamicBatchSize?: boolean; // Enable dynamic batch size adjustment
  debug?: boolean; // Enable debug logging
}

/**
 * FHIR Synchronization component configuration
 */
export interface FHIRSyncConfig extends BaseComponentConfig {
  server: {
    baseUrl: string;
    version: 'R4' | 'R5';
    authType: 'none' | 'basic' | 'bearer' | 'oauth2';
    credentials?: {
      username?: string;
      password?: string;
      token?: string;
      clientId?: string;
      clientSecret?: string;
    };
  };
  resources: {
    enabledTypes: string[];
    syncDirection: 'bidirectional' | 'to-fhir' | 'from-fhir';
    validateResources: boolean;
  };
  synchronization: {
    mode: 'real-time' | 'batch' | 'scheduled';
    batchSize: number;
    scheduleExpression?: string;
  };
}

/**
 * Main telehealth configuration
 */
export interface TelehealthConfig {
  deploymentMode: DeploymentMode;
  enabledComponents: ComponentType[];
  components: {
    'video-consultation'?: VideoConsultationConfig;
    'messaging'?: MessagingConfig;
    'ehr-integration'?: EHRIntegrationConfig;
    'fhir-sync'?: FHIRSyncConfig;
  };
  interoperability: {
    eventBus: {
      enabled: boolean;
      maxListeners: number;
    };
    crossComponentAuth: boolean;
    sharedSession: boolean;
  };
  security: {
    encryption: {
      algorithm: string;
      keyRotationDays: number;
    };
    audit: {
      enabled: boolean;
      retentionDays: number;
      includeSuccessEvents: boolean;
    };
    compliance: {
      hipaaMode: boolean;
      auditAllAccess: boolean;
      dataRetentionDays: number;
    };
  };
}

/**
 * Base telehealth component interface
 */
export interface TelehealthComponent extends EventEmitter {
  /**
   * Initialize the component
   */
  initialize(): Promise<void>;

  /**
   * Start the component
   */
  start(): Promise<void>;

  /**
   * Stop the component
   */
  stop(): Promise<void>;

  /**
   * Get component status
   */
  getStatus(): ComponentStatus;

  /**
   * Handle external events from other components
   */
  handleExternalEvent(eventName: string, data: any): Promise<void>;

  /**
   * Get component configuration
   */
  getConfig(): BaseComponentConfig;

  /**
   * Update component configuration
   */
  updateConfig(config: Partial<BaseComponentConfig>): Promise<void>;
}

/**
 * Video consultation session data
 */
export interface VideoConsultationSession {
  sessionId: string;
  roomName: string;
  participants: {
    providerId: string;
    patientId: string;
    moderatorId?: string;
  };
  startTime: Date;
  endTime?: Date;
  recording?: {
    enabled: boolean;
    url?: string;
  };
  metadata: {
    appointmentId?: string;
    consultationType: string;
    specialty: string;
  };
}

/**
 * Messaging channel data
 */
export interface MessagingChannel {
  channelId: string;
  type: 'consultation' | 'administrative' | 'emergency';
  participants: string[];
  createdAt: Date;
  lastActivity: Date;
  archived: boolean;
  metadata: {
    consultationId?: string;
    appointmentId?: string;
    specialty?: string;
  };
}

/**
 * EHR synchronization event
 */
export interface EHRSyncEvent {
  eventId: string;
  eventType: 'create' | 'update' | 'delete';
  resourceType: string;
  resourceId: string;
  timestamp: Date;
  source: 'webqx' | 'openemr' | 'external';
  data: any;
  status: 'pending' | 'success' | 'failed' | 'conflict';
}

/**
 * FHIR resource sync data
 */
export interface FHIRResourceSync {
  resourceType: string;
  resourceId: string;
  version: string;
  lastModified: Date;
  syncStatus: 'synced' | 'pending' | 'conflict' | 'error';
  direction: 'to-fhir' | 'from-fhir';
  conflictData?: {
    localVersion: any;
    remoteVersion: any;
    resolutionStrategy: string;
  };
}

/**
 * Telehealth event types
 */
export interface TelehealthEvents {
  // Manager events
  'initialized': { deploymentMode: DeploymentMode };
  'shutdown': {};
  'component:loaded': { componentName: string };
  'component:error': { componentName: string; error: Error };

  // Video consultation events
  'video:call:started': VideoConsultationSession;
  'video:call:ended': VideoConsultationSession;
  'video:participant:joined': { sessionId: string; participantId: string };
  'video:participant:left': { sessionId: string; participantId: string };
  'video:recording:started': { sessionId: string };
  'video:recording:stopped': { sessionId: string; url: string };

  // Messaging events
  'messaging:channel:created': MessagingChannel;
  'messaging:channel:archived': { channelId: string };
  'messaging:message:sent': { channelId: string; messageId: string; senderId: string };
  'messaging:message:received': { channelId: string; messageId: string; content: string };

  // EHR integration events
  'ehr:sync:started': { resourceType: string; resourceId: string };
  'ehr:sync:completed': EHRSyncEvent;
  'ehr:sync:failed': { event: EHRSyncEvent; error: Error };
  'ehr:data:updated': { resourceType: string; resourceId: string; data: any };

  // FHIR sync events
  'fhir:sync:started': { resourceType: string; resourceId: string };
  'fhir:sync:completed': FHIRResourceSync;
  'fhir:sync:conflict': { sync: FHIRResourceSync; conflictType: string };
  'fhir:resource:received': { resourceType: string; resource: any };

  // Cross-component events
  'patient:selected': { patientId: string; context: string };
  'appointment:created': { appointmentId: string; patientId: string; providerId: string };
  'consultation:started': { consultationId: string; type: 'video' | 'messaging' | 'hybrid' };
  'consultation:ended': { consultationId: string; duration: number; outcome: string };
  'consultation:notes': { consultationId: string; notes: string; providerId: string };
}

/**
 * Component deployment manifest
 */
export interface DeploymentManifest {
  name: string;
  version: string;
  type: 'standalone' | 'full-suite';
  components: ComponentType[];
  dependencies: {
    required: string[];
    optional: string[];
  };
  environment: {
    [key: string]: string | number | boolean;
  };
  resources: {
    cpu: string;
    memory: string;
    storage?: string;
  };
  healthCheck: {
    path: string;
    interval: number;
    timeout: number;
  };
}

/**
 * Component registry entry
 */
export interface ComponentRegistryEntry {
  name: ComponentType;
  version: string;
  description: string;
  dependencies: string[];
  endpoints: {
    health: string;
    metrics: string;
    api?: string;
  };
  status: ComponentStatus;
  lastDeployed: Date;
}