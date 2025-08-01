/**
 * WebQX™ Telehealth Manager
 * 
 * Main coordinator for telehealth functionality including video consultations,
 * text-based fallbacks, and optimized FHIR synchronization for low-bandwidth environments.
 */

import { NetworkMonitor, NetworkMonitorConfig } from './NetworkMonitor';
import { JitsiAdapter, JitsiAdapterConfig } from '../video/JitsiAdapter';
import { FHIRBatchAdapter, FHIROptimizationConfig } from '../sync/FHIRBatchAdapter';
import { ConsultationChat, ConsultationChatConfig } from '../messaging/ConsultationChat';
import {
  TelehealthConfig,
  ConsultationSession,
  ConsultationOptions,
  NetworkConditions,
  NetworkQuality,
  ConsultationMode,
  FallbackEvent,
  TelehealthEvent,
  EventCallback,
  TelehealthError,
  StructuredConsultation,
  ConsultationTemplate
} from '../types/telehealth.types';

export class TelehealthManager {
  private config: TelehealthConfig;
  private networkMonitor: NetworkMonitor;
  private jitsiAdapter: JitsiAdapter;
  private fhirAdapter: FHIRBatchAdapter;
  private consultationChat: ConsultationChat;
  private currentSession?: ConsultationSession;
  private eventListeners: Map<string, EventCallback[]> = new Map();
  private isInitialized: boolean = false;
  private fallbackInProgress: boolean = false;

  constructor(config: TelehealthConfig) {
    this.config = config;
    this.validateConfig();
    this.initializeComponents();
  }

  /**
   * Initialize the telehealth manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Start network monitoring
      await this.networkMonitor.startMonitoring();

      // Set up event handlers
      this.setupEventHandlers();

      // Initialize FHIR adapter with current network conditions
      const networkConditions = this.networkMonitor.getCurrentConditions();
      this.optimizeFHIRForNetwork(networkConditions);

      this.isInitialized = true;

      this.emitEvent({
        type: 'telehealth-initialized',
        timestamp: new Date(),
        sessionId: 'system',
        data: {
          networkQuality: this.networkMonitor.getNetworkQuality(),
          networkConditions
        }
      });

    } catch (error) {
      throw new TelehealthError(
        `Failed to initialize telehealth manager: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          name: 'InitializationError',
          code: 'INITIALIZATION_FAILED',
          category: 'config',
          recoverable: true,
          context: { config: this.config }
        }
      );
    }
  }

  /**
   * Start a video consultation
   */
  async startVideoConsultation(options: ConsultationOptions): Promise<ConsultationSession> {
    await this.ensureInitialized();

    const networkQuality = this.networkMonitor.getNetworkQuality();
    
    // Check if network supports video
    if (!this.networkMonitor.supportsVideoCall('low')) {
      if (options.enableFallback) {
        return await this.startTextConsultation(options);
      } else {
        throw new TelehealthError(
          'Network conditions do not support video calling',
          {
            name: 'NetworkInsufficientError',
            code: 'NETWORK_INSUFFICIENT_FOR_VIDEO',
            category: 'network',
            recoverable: true,
            context: { 
              networkQuality,
              networkConditions: this.networkMonitor.getCurrentConditions()
            }
          }
        );
      }
    }

    const session = this.createConsultationSession(options, 'video');
    this.currentSession = session;

    try {
      // Join video consultation
      await this.jitsiAdapter.joinConsultation(session);

      // Start FHIR synchronization for the session
      await this.startSessionDataSync(session);

      this.emitEvent({
        type: 'session-started',
        timestamp: new Date(),
        sessionId: session.sessionId,
        data: session
      });

      return session;

    } catch (error) {
      // If video fails and fallback is enabled, try text consultation
      if (options.enableFallback) {
        return await this.handleVideoFallback(session, error);
      }
      throw error;
    }
  }

  /**
   * Start a text-based consultation
   */
  async startTextConsultation(options: ConsultationOptions): Promise<ConsultationSession> {
    await this.ensureInitialized();

    const session = this.createConsultationSession(options, 'text');
    this.currentSession = session;

    try {
      // Start text consultation
      await this.consultationChat.startConsultation(session);

      // Start FHIR synchronization for the session
      await this.startSessionDataSync(session);

      this.emitEvent({
        type: 'session-started',
        timestamp: new Date(),
        sessionId: session.sessionId,
        data: session
      });

      return session;

    } catch (error) {
      throw new TelehealthError(
        `Failed to start text consultation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          name: 'TextConsultationError',
          code: 'TEXT_CONSULTATION_FAILED',
          category: 'sync',
          recoverable: true,
          context: { options }
        }
      );
    }
  }

  /**
   * Start a structured consultation with a template
   */
  async startStructuredConsultation(
    options: ConsultationOptions,
    templateId: string
  ): Promise<StructuredConsultation> {
    await this.ensureInitialized();

    const session = this.createConsultationSession(options, 'text');
    this.currentSession = session;

    try {
      // Start structured consultation
      const structuredConsult = await this.consultationChat.startStructuredConsultation(
        session,
        templateId
      );

      // Start FHIR synchronization for the session
      await this.startSessionDataSync(session);

      this.emitEvent({
        type: 'session-started',
        timestamp: new Date(),
        sessionId: session.sessionId,
        data: session
      });

      return structuredConsult;

    } catch (error) {
      throw new TelehealthError(
        `Failed to start structured consultation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          name: 'StructuredConsultationError',
          code: 'STRUCTURED_CONSULTATION_FAILED',
          category: 'sync',
          recoverable: true,
          context: { options, templateId }
        }
      );
    }
  }

  /**
   * End the current consultation
   */
  async endConsultation(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    const session = this.currentSession;
    session.status = 'ended';
    session.endTime = new Date();

    try {
      // End video consultation if active
      if (session.mode === 'video' || session.mode === 'hybrid') {
        if (this.jitsiAdapter.isConnectedToConsultation()) {
          await this.jitsiAdapter.leaveConsultation();
        }
      }

      // End text consultation if active
      if (session.mode === 'text' || session.mode === 'hybrid') {
        await this.consultationChat.endConsultation();
      }

      // Perform final data sync
      await this.finalizeSessionDataSync(session);

      this.emitEvent({
        type: 'session-ended',
        timestamp: new Date(),
        sessionId: session.sessionId,
        data: session
      });

      this.currentSession = undefined;

    } catch (error) {
      console.error('Error ending consultation:', error);
    }
  }

  /**
   * Switch consultation mode (e.g., from video to text)
   */
  async switchMode(newMode: ConsultationMode): Promise<void> {
    if (!this.currentSession || this.currentSession.mode === newMode) {
      return;
    }

    const oldMode = this.currentSession.mode;
    
    try {
      if (newMode === 'video') {
        if (!this.networkMonitor.supportsVideoCall('low')) {
          throw new TelehealthError(
            'Network conditions do not support video calling',
            {
              name: 'NetworkInsufficientError',
              code: 'NETWORK_INSUFFICIENT_FOR_VIDEO',
              category: 'network',
              recoverable: true
            }
          );
        }
        await this.jitsiAdapter.joinConsultation(this.currentSession);
      } else if (oldMode === 'video') {
        await this.jitsiAdapter.leaveConsultation();
      }

      this.currentSession.mode = newMode;

      this.emitEvent({
        type: 'mode-switched',
        timestamp: new Date(),
        sessionId: this.currentSession.sessionId,
        data: {
          oldMode,
          newMode,
          reason: 'manual'
        }
      });

    } catch (error) {
      throw new TelehealthError(
        `Failed to switch mode: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          name: 'ModeSwitchError',
          code: 'MODE_SWITCH_FAILED',
          category: 'video',
          recoverable: true,
          context: { oldMode, newMode }
        }
      );
    }
  }

  /**
   * Get current network status
   */
  getNetworkStatus(): {
    conditions: NetworkConditions;
    quality: NetworkQuality;
    supportsVideo: boolean;
    supportsAudio: boolean;
  } {
    const conditions = this.networkMonitor.getCurrentConditions();
    const quality = this.networkMonitor.getNetworkQuality();
    
    return {
      conditions,
      quality,
      supportsVideo: this.networkMonitor.supportsVideoCall('low'),
      supportsAudio: this.networkMonitor.supportsAudioCall()
    };
  }

  /**
   * Get current consultation session
   */
  getCurrentSession(): ConsultationSession | undefined {
    return this.currentSession;
  }

  /**
   * Optimize for specific bandwidth
   */
  async optimizeForBandwidth(bandwidthKbps: number): Promise<void> {
    const networkConditions: NetworkConditions = {
      bandwidthKbps,
      rttMs: this.networkMonitor.getCurrentConditions().rttMs,
      packetLossPercent: this.networkMonitor.getCurrentConditions().packetLossPercent,
      stabilityScore: this.networkMonitor.getCurrentConditions().stabilityScore,
      connectionType: this.networkMonitor.getCurrentConditions().connectionType,
      signalStrength: this.networkMonitor.getCurrentConditions().signalStrength
    };

    // Adjust video quality if in video mode
    if (this.currentSession?.mode === 'video' || this.currentSession?.mode === 'hybrid') {
      this.jitsiAdapter.adjustQualityForNetwork(networkConditions);
    }

    // Optimize FHIR operations
    this.optimizeFHIRForNetwork(networkConditions);
  }

  /**
   * Add event listener
   */
  addEventListener(eventType: string, callback: EventCallback): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(eventType: string, callback: EventCallback): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Get performance statistics
   */
  getStatistics(): {
    network: ReturnType<NetworkMonitor['getCurrentConditions']>;
    fhir: ReturnType<FHIRBatchAdapter['getStatistics']>;
    video: any;
    session?: ConsultationSession;
  } {
    return {
      network: this.networkMonitor.getCurrentConditions(),
      fhir: this.fhirAdapter.getStatistics(),
      video: this.jitsiAdapter.isConnectedToConsultation() 
        ? this.jitsiAdapter.getCurrentMetrics() 
        : null,
      session: this.currentSession
    };
  }

  /**
   * Dispose of the manager and clean up resources
   */
  dispose(): void {
    // Stop network monitoring
    this.networkMonitor.stopMonitoring();

    // Clean up video adapter
    this.jitsiAdapter.dispose();

    // End any active consultation
    if (this.currentSession) {
      this.endConsultation().catch(error => {
        console.error('Error ending consultation during disposal:', error);
      });
    }

    // Clear event listeners
    this.eventListeners.clear();

    this.isInitialized = false;
  }

  // Private methods

  private validateConfig(): void {
    if (!this.config.jitsiConfig?.domain) {
      throw new TelehealthError('Jitsi domain is required', {
        name: 'ConfigurationError',
        code: 'MISSING_JITSI_DOMAIN',
        category: 'config',
        recoverable: false
      });
    }

    if (!this.config.fhirConfig?.baseUrl) {
      throw new TelehealthError('FHIR base URL is required', {
        name: 'ConfigurationError',
        code: 'MISSING_FHIR_URL',
        category: 'config',
        recoverable: false
      });
    }
  }

  private initializeComponents(): void {
    // Initialize network monitor
    const networkConfig: NetworkMonitorConfig = {
      monitoringIntervalMs: 5000,
      thresholds: this.config.networkThresholds,
      enableConnectionTypeDetection: true,
      enableBandwidthEstimation: true,
      bandwidthTest: {
        testFileSizeKB: 100,
        timeoutMs: 10000
      },
      rttTest: {
        testUrl: this.config.fhirConfig.baseUrl + '/metadata',
        pingCount: 3
      }
    };
    this.networkMonitor = new NetworkMonitor(networkConfig);

    // Initialize Jitsi adapter
    const jitsiConfig: JitsiAdapterConfig = {
      ...this.config.jitsiConfig,
      containerId: 'jitsi-container',
      enableAdaptiveBitrate: true,
      qualityAdjustmentIntervalMs: 10000,
      enableAutoFallback: true,
      healthcareFeatures: {
        enableWaitingRoom: true,
        enableRecording: this.config.recordingConfig?.enableRecording || false,
        enableScreenSharing: true,
        maxConsultationMinutes: 120
      }
    };
    this.jitsiAdapter = new JitsiAdapter(jitsiConfig);

    // Initialize FHIR adapter
    const fhirConfig: FHIROptimizationConfig = {
      ...this.config.fhirConfig,
      cache: {
        enabled: true,
        maxSize: 1000,
        ttlSeconds: 3600
      },
      offline: {
        enabled: true,
        maxOfflineOperations: 500,
        syncOnReconnect: true
      }
    };
    this.fhirAdapter = new FHIRBatchAdapter(fhirConfig);

    // Initialize consultation chat
    const chatConfig: ConsultationChatConfig = {
      matrixConfig: this.config.messagingConfig ? {
        homeserverUrl: this.config.messagingConfig.matrixServer || 'https://matrix.webqx.health',
        accessToken: 'placeholder-token',
        userId: '@telehealth:webqx.health',
        deviceId: 'telehealth-device'
      } : {
        homeserverUrl: 'https://matrix.webqx.health',
        accessToken: 'placeholder-token',
        userId: '@telehealth:webqx.health',
        deviceId: 'telehealth-device'
      },
      messageConfig: {
        enableE2EE: this.config.messagingConfig?.enableE2EE || true,
        maxMessageLength: 4000,
        enableVoiceMessages: true,
        enableFileAttachments: true,
        maxFileSizeMB: 10
      },
      templates: this.getConsultationTemplates(),
      autoSaveIntervalSeconds: 30
    };
    this.consultationChat = new ConsultationChat(chatConfig);
  }

  private setupEventHandlers(): void {
    // Network event handlers
    this.networkMonitor.addEventListener('network-change', (event) => {
      this.handleNetworkChange(event.data);
    });

    this.networkMonitor.addEventListener('bandwidth-change', (event) => {
      this.handleBandwidthChange(event.data);
    });

    // Video event handlers
    this.jitsiAdapter.addEventListener('video-quality-change', (event) => {
      this.emitEvent({
        type: 'video-quality-changed',
        timestamp: new Date(),
        sessionId: this.currentSession?.sessionId || 'unknown',
        data: event.data
      });
    });

    // Message event handlers
    this.consultationChat.addEventListener('message-sent', (event) => {
      this.emitEvent({
        type: 'message-sent',
        timestamp: new Date(),
        sessionId: event.sessionId,
        data: event.data
      });
    });
  }

  private async handleNetworkChange(networkConditions: NetworkConditions): Promise<void> {
    if (!this.currentSession) return;

    const quality = this.networkMonitor.getNetworkQuality();

    // Check if we need to fallback due to poor network
    if (this.currentSession.mode === 'video' && quality === 'poor' && !this.fallbackInProgress) {
      await this.triggerAutomaticFallback('network-poor');
    }

    // Optimize FHIR operations for current conditions
    this.optimizeFHIRForNetwork(networkConditions);

    // Adjust video quality if in video mode
    if (this.currentSession.mode === 'video' || this.currentSession.mode === 'hybrid') {
      this.jitsiAdapter.adjustQualityForNetwork(networkConditions);
    }
  }

  private async handleBandwidthChange(networkConditions: NetworkConditions): Promise<void> {
    const bandwidth = networkConditions.bandwidthKbps;

    // Auto-optimize for new bandwidth
    await this.optimizeForBandwidth(bandwidth);

    this.emitEvent({
      type: 'bandwidth-optimized',
      timestamp: new Date(),
      sessionId: this.currentSession?.sessionId || 'system',
      data: { bandwidth, networkConditions }
    });
  }

  private async triggerAutomaticFallback(reason: FallbackEvent['reason']): Promise<void> {
    if (!this.currentSession || this.fallbackInProgress) return;

    this.fallbackInProgress = true;
    const oldMode = this.currentSession.mode;

    try {
      const fallbackEvent: FallbackEvent = {
        timestamp: new Date(),
        reason,
        fromMode: oldMode,
        toMode: 'text',
        networkConditions: this.networkMonitor.getCurrentConditions()
      };

      // Add fallback event to session
      this.currentSession.qualityMetrics.fallbackEvents.push(fallbackEvent);

      // Switch to text mode
      await this.switchMode('text');

      this.emitEvent({
        type: 'fallback-triggered',
        timestamp: new Date(),
        sessionId: this.currentSession.sessionId,
        data: fallbackEvent
      });

    } catch (error) {
      console.error('Automatic fallback failed:', error);
    } finally {
      this.fallbackInProgress = false;
    }
  }

  private async handleVideoFallback(session: ConsultationSession, videoError: unknown): Promise<ConsultationSession> {
    const fallbackEvent: FallbackEvent = {
      timestamp: new Date(),
      reason: 'network-failed',
      fromMode: 'video',
      toMode: 'text',
      networkConditions: this.networkMonitor.getCurrentConditions()
    };

    session.mode = 'text';
    session.qualityMetrics.fallbackEvents.push(fallbackEvent);

    // Start text consultation
    await this.consultationChat.startConsultation(session);

    this.emitEvent({
      type: 'fallback-triggered',
      timestamp: new Date(),
      sessionId: session.sessionId,
      data: fallbackEvent
    });

    return session;
  }

  private createConsultationSession(options: ConsultationOptions, mode: ConsultationMode): ConsultationSession {
    return {
      sessionId: this.generateSessionId(),
      patientId: options.patientId,
      providerId: options.providerId,
      consultationType: options.consultationType,
      status: 'starting',
      startTime: new Date(),
      mode,
      metadata: {
        appointmentId: options.metadata?.appointmentId,
        specialty: options.metadata?.specialty,
        priority: options.metadata?.priority || 'medium',
        language: options.language || 'en',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      qualityMetrics: {
        avgBandwidthKbps: this.networkMonitor.getCurrentConditions().bandwidthKbps,
        interruptions: 0,
        degradations: 0,
        fallbackEvents: []
      }
    };
  }

  private async startSessionDataSync(session: ConsultationSession): Promise<void> {
    // Sync patient and provider data
    const resourceTypes = ['Patient', 'Practitioner', 'Appointment', 'Observation'];
    
    try {
      await this.fhirAdapter.syncResources(resourceTypes, session.patientId);
    } catch (error) {
      console.warn('Failed to sync session data:', error);
    }
  }

  private async finalizeSessionDataSync(session: ConsultationSession): Promise<void> {
    try {
      // Execute any pending FHIR operations
      await this.fhirAdapter.executeBatch();

      // Create a consultation record
      const consultationRecord = this.createConsultationRecord(session);
      await this.fhirAdapter.createResource(consultationRecord);

    } catch (error) {
      console.warn('Failed to finalize session data sync:', error);
    }
  }

  private createConsultationRecord(session: ConsultationSession): any {
    return {
      resourceType: 'Encounter',
      status: 'finished',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'VR',
        display: 'virtual'
      },
      type: [{
        coding: [{
          system: 'http://snomed.info/sct',
          code: '11429006',
          display: 'Consultation'
        }]
      }],
      subject: {
        reference: `Patient/${session.patientId}`
      },
      participant: [{
        individual: {
          reference: `Practitioner/${session.providerId}`
        }
      }],
      period: {
        start: session.startTime.toISOString(),
        end: session.endTime?.toISOString()
      },
      reasonCode: [{
        text: session.consultationType
      }]
    };
  }

  private optimizeFHIRForNetwork(networkConditions: NetworkConditions): void {
    // Adjust batch size based on bandwidth
    const bandwidth = networkConditions.bandwidthKbps;
    let batchSize = this.config.fhirConfig.maxBatchSize;

    if (bandwidth < 500) {
      batchSize = Math.max(5, Math.floor(batchSize * 0.25));
    } else if (bandwidth < 1000) {
      batchSize = Math.max(10, Math.floor(batchSize * 0.5));
    }

    // Update FHIR adapter configuration
    // Note: In a real implementation, you'd need a way to update the config
  }

  private getConsultationTemplates(): ConsultationTemplate[] {
    // Return default consultation templates
    // In a real implementation, these would be loaded from configuration
    return [
      {
        templateId: 'routine-checkup',
        name: 'Routine Checkup',
        specialty: 'primary-care',
        consultationType: 'routine-checkup',
        estimatedDurationMinutes: 15,
        steps: [
          {
            stepId: 'chief-complaint',
            title: 'Chief Complaint',
            description: 'What brings you in today?',
            responseType: 'text',
            required: true,
            validation: {
              minLength: 10,
              maxLength: 500
            }
          },
          {
            stepId: 'pain-scale',
            title: 'Pain Level',
            description: 'On a scale of 1-10, how would you rate your pain?',
            responseType: 'numeric',
            required: false,
            validation: {
              numericRange: { min: 1, max: 10 }
            }
          }
        ]
      }
    ];
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  private emitEvent(event: TelehealthEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('Error in telehealth event listener:', error);
        }
      });
    }
  }
}