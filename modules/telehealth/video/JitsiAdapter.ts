/**
 * WebQX™ Telehealth - Jitsi Meet Adapter
 * 
 * Integration with Jitsi Meet for video consultations with healthcare-specific
 * features, adaptive bitrate streaming, and low-bandwidth optimizations.
 */

import {
  JitsiConfig,
  JitsiMeetAPI,
  VideoCallMetrics,
  QualitySettings,
  NetworkConditions,
  ConsultationSession,
  VideoEvent,
  EventCallback,
  TelehealthError
} from '../types/telehealth.types';

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
    JitsiMeetJS: any;
  }
}

export interface JitsiAdapterConfig extends JitsiConfig {
  /** Container element ID for Jitsi */
  containerId: string;
  /** Enable adaptive bitrate */
  enableAdaptiveBitrate: boolean;
  /** Quality adjustment interval in ms */
  qualityAdjustmentIntervalMs: number;
  /** Enable automatic fallback */
  enableAutoFallback: boolean;
  /** Healthcare-specific features */
  healthcareFeatures: {
    /** Enable waiting room for patients */
    enableWaitingRoom: boolean;
    /** Enable recording for consultations */
    enableRecording: boolean;
    /** Enable screen sharing for medical documents */
    enableScreenSharing: boolean;
    /** Maximum consultation duration in minutes */
    maxConsultationMinutes: number;
  };
}

export class JitsiAdapter {
  private config: JitsiAdapterConfig;
  private jitsiAPI?: JitsiMeetAPI;
  private isConnected: boolean = false;
  private currentQuality: QualitySettings;
  private currentMetrics: VideoCallMetrics;
  private eventListeners: Map<string, EventCallback<VideoEvent>[]> = new Map();
  private qualityAdjustmentInterval?: NodeJS.Timeout;
  private connectionStatsInterval?: NodeJS.Timeout;
  private networkConditions?: NetworkConditions;
  private isInWaitingRoom: boolean = false;
  private recordingStarted: boolean = false;

  constructor(config: JitsiAdapterConfig) {
    this.config = config;
    this.currentQuality = this.getDefaultQualitySettings();
    this.currentMetrics = this.getDefaultMetrics();
    this.loadJitsiAPI();
  }

  /**
   * Join a video consultation room
   */
  async joinConsultation(consultation: ConsultationSession): Promise<void> {
    try {
      if (this.isConnected) {
        await this.leaveConsultation();
      }

      const roomName = this.generateRoomName(consultation);
      const roomOptions = this.buildRoomOptions(consultation);

      await this.initializeJitsiMeet(roomName, roomOptions);
      this.setupEventListeners();
      
      if (this.config.enableAdaptiveBitrate) {
        this.startQualityMonitoring();
      }

      this.isConnected = true;

      this.emitEvent({
        type: 'video-started',
        timestamp: new Date(),
        sessionId: consultation.sessionId,
        data: this.currentMetrics
      });

    } catch (error) {
      throw new TelehealthError(
        `Failed to join consultation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          name: 'JitsiConnectionError',
          code: 'JOIN_FAILED',
          category: 'video',
          recoverable: true,
          context: { 
            consultationId: consultation.sessionId,
            roomName: this.generateRoomName(consultation)
          }
        }
      );
    }
  }

  /**
   * Leave the current consultation
   */
  async leaveConsultation(): Promise<void> {
    try {
      this.stopQualityMonitoring();
      
      if (this.jitsiAPI) {
        await this.jitsiAPI.leave();
        this.jitsiAPI = undefined;
      }

      this.isConnected = false;
      this.isInWaitingRoom = false;
      this.recordingStarted = false;

      this.emitEvent({
        type: 'video-stopped',
        timestamp: new Date(),
        sessionId: 'current',
        data: this.currentMetrics
      });

    } catch (error) {
      console.error('Error leaving consultation:', error);
    }
  }

  /**
   * Adjust video quality based on network conditions
   */
  adjustQualityForNetwork(networkConditions: NetworkConditions): void {
    this.networkConditions = networkConditions;
    
    const recommendedQuality = this.calculateOptimalQuality(networkConditions);
    this.setVideoQuality(recommendedQuality);
  }

  /**
   * Set video quality manually
   */
  setVideoQuality(quality: Partial<QualitySettings>): void {
    if (!this.jitsiAPI) return;

    const newQuality: QualitySettings = {
      ...this.currentQuality,
      ...quality
    };

    try {
      // Apply video settings
      if (quality.videoBitrateKbps !== undefined) {
        this.jitsiAPI.setVideoQuality(this.mapResolutionToQuality(newQuality.resolution));
      }

      // Toggle video/audio based on settings
      if (quality.videoEnabled !== undefined && quality.videoEnabled !== this.currentQuality.videoEnabled) {
        this.jitsiAPI.setVideoMuted(!quality.videoEnabled);
      }

      if (quality.audioEnabled !== undefined && quality.audioEnabled !== this.currentQuality.audioEnabled) {
        this.jitsiAPI.setAudioMuted(!quality.audioEnabled);
      }

      this.currentQuality = newQuality;

      this.emitEvent({
        type: 'video-quality-change',
        timestamp: new Date(),
        sessionId: 'current',
        data: newQuality
      });

    } catch (error) {
      console.error('Error setting video quality:', error);
    }
  }

  /**
   * Start screen sharing
   */
  async startScreenShare(): Promise<void> {
    if (!this.jitsiAPI) {
      throw new Error('Not connected to consultation');
    }

    try {
      await this.jitsiAPI.startScreenShare();
      
      this.emitEvent({
        type: 'screen-share-started',
        timestamp: new Date(),
        sessionId: 'current',
        data: this.currentMetrics
      });

    } catch (error) {
      throw new TelehealthError(
        `Failed to start screen sharing: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          name: 'ScreenShareError',
          code: 'SCREEN_SHARE_FAILED',
          category: 'video',
          recoverable: true
        }
      );
    }
  }

  /**
   * Stop screen sharing
   */
  async stopScreenShare(): Promise<void> {
    if (!this.jitsiAPI) return;

    try {
      await this.jitsiAPI.stopScreenShare();
      
      this.emitEvent({
        type: 'screen-share-stopped',
        timestamp: new Date(),
        sessionId: 'current',
        data: this.currentMetrics
      });

    } catch (error) {
      console.error('Error stopping screen share:', error);
    }
  }

  /**
   * Start recording the consultation
   */
  async startRecording(): Promise<void> {
    if (!this.jitsiAPI || !this.config.healthcareFeatures.enableRecording) {
      throw new Error('Recording not available');
    }

    try {
      // Execute recording command
      await this.jitsiAPI.executeCommand('startRecording', {
        mode: 'file',
        dropboxToken: undefined
      });

      this.recordingStarted = true;

    } catch (error) {
      throw new TelehealthError(
        `Failed to start recording: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          name: 'RecordingError',
          code: 'RECORDING_START_FAILED',
          category: 'video',
          recoverable: true
        }
      );
    }
  }

  /**
   * Stop recording the consultation
   */
  async stopRecording(): Promise<void> {
    if (!this.jitsiAPI || !this.recordingStarted) return;

    try {
      await this.jitsiAPI.executeCommand('stopRecording', 'file');
      this.recordingStarted = false;
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  }

  /**
   * Get current video call metrics
   */
  getCurrentMetrics(): VideoCallMetrics {
    return { ...this.currentMetrics };
  }

  /**
   * Check if currently connected to a consultation
   */
  isConnectedToConsultation(): boolean {
    return this.isConnected;
  }

  /**
   * Add event listener
   */
  addEventListener(eventType: string, callback: EventCallback<VideoEvent>): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(eventType: string, callback: EventCallback<VideoEvent>): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Dispose of the adapter and clean up resources
   */
  dispose(): void {
    this.stopQualityMonitoring();
    
    if (this.isConnected) {
      this.leaveConsultation();
    }

    this.eventListeners.clear();
  }

  // Private methods

  private async loadJitsiAPI(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.JitsiMeetExternalAPI) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://${this.config.domain}/external_api.js`;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Jitsi Meet API'));
      document.head.appendChild(script);
    });
  }

  private async initializeJitsiMeet(roomName: string, options: any): Promise<void> {
    if (!window.JitsiMeetExternalAPI) {
      throw new Error('Jitsi Meet API not loaded');
    }

    this.jitsiAPI = new window.JitsiMeetExternalAPI(this.config.domain, {
      roomName,
      parentNode: document.getElementById(this.config.containerId),
      ...options
    });

    // Wait for conference joined
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 30000);

      this.jitsiAPI!.addEventListener('videoConferenceJoined', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.jitsiAPI!.addEventListener('videoConferenceLeft', () => {
        clearTimeout(timeout);
        reject(new Error('Conference left before joining'));
      });
    });
  }

  private generateRoomName(consultation: ConsultationSession): string {
    // Generate secure room name
    const sanitizedPatientId = consultation.patientId.replace(/[^a-zA-Z0-9]/g, '');
    const sanitizedProviderId = consultation.providerId.replace(/[^a-zA-Z0-9]/g, '');
    return `webqx-consult-${sanitizedPatientId}-${sanitizedProviderId}-${consultation.sessionId}`;
  }

  private buildRoomOptions(consultation: ConsultationSession): any {
    const options: any = {
      width: '100%',
      height: '100%',
      configOverwrite: {
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        enableWelcomePage: false,
        enableClosePage: false,
        disableDeepLinking: true,
        defaultLanguage: consultation.metadata.language || 'en',
        resolution: this.mapResolutionToJitsiResolution(this.currentQuality.resolution),
        constraints: {
          video: {
            height: {
              ideal: this.getIdealHeight(this.currentQuality.resolution),
              max: 720,
              min: 144
            },
            width: {
              ideal: this.getIdealWidth(this.currentQuality.resolution),
              max: 1280,
              min: 256
            }
          }
        }
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        BRAND_WATERMARK_LINK: '',
        SHOW_BRAND_WATERMARK: true,
        BRAND_WATERMARK_LINK: 'https://webqx.health',
        DEFAULT_BACKGROUND: '#2c3e50',
        TOOLBAR_BUTTONS: [
          'microphone', 'camera', 'closedcaptions', 'desktop',
          'fullscreen', 'fodeviceselection', 'hangup', 'profile',
          'chat', 'livestreaming', 'etherpad', 'sharedvideo', 'settings',
          'raisehand', 'videoquality', 'filmstrip', 'invite',
          'feedback', 'stats', 'shortcuts', 'tileview', 'videobackgroundblur',
          'download', 'help', 'mute-everyone'
        ].filter(button => {
          // Filter buttons based on healthcare features
          if (button === 'desktop' && !this.config.healthcareFeatures.enableScreenSharing) return false;
          if (button === 'livestreaming' && !this.config.healthcareFeatures.enableRecording) return false;
          return true;
        })
      },
      userInfo: {
        displayName: this.getDisplayName(consultation),
        email: ''
      }
    };

    // Add JWT token if configured
    if (this.config.jwtSecret && this.config.jwtAppId) {
      options.jwt = this.generateJWT(consultation);
    }

    // Configure waiting room
    if (this.config.healthcareFeatures.enableWaitingRoom) {
      options.configOverwrite.enableLobby = true;
    }

    return options;
  }

  private setupEventListeners(): void {
    if (!this.jitsiAPI) return;

    // Connection events
    this.jitsiAPI.addEventListener('videoConferenceJoined', () => {
      this.updateMetrics();
      this.startConnectionStatsMonitoring();
    });

    this.jitsiAPI.addEventListener('videoConferenceLeft', () => {
      this.isConnected = false;
      this.stopConnectionStatsMonitoring();
    });

    // Quality events
    this.jitsiAPI.addEventListener('videoQualityChanged', (event: any) => {
      this.handleQualityChange(event);
    });

    // Participant events
    this.jitsiAPI.addEventListener('participantJoined', () => {
      this.updateMetrics();
    });

    this.jitsiAPI.addEventListener('participantLeft', () => {
      this.updateMetrics();
    });

    // Recording events
    this.jitsiAPI.addEventListener('recordingStatusChanged', (event: any) => {
      this.recordingStarted = event.on;
    });

    // Screen sharing events
    this.jitsiAPI.addEventListener('screenSharingStatusChanged', (event: any) => {
      const eventType = event.on ? 'screen-share-started' : 'screen-share-stopped';
      this.emitEvent({
        type: eventType,
        timestamp: new Date(),
        sessionId: 'current',
        data: this.currentMetrics
      });
    });

    // Audio/video mute events
    this.jitsiAPI.addEventListener('audioMuteStatusChanged', (event: any) => {
      this.currentQuality.audioEnabled = !event.muted;
    });

    this.jitsiAPI.addEventListener('videoMuteStatusChanged', (event: any) => {
      this.currentQuality.videoEnabled = !event.muted;
    });
  }

  private startQualityMonitoring(): void {
    this.qualityAdjustmentInterval = setInterval(() => {
      this.monitorAndAdjustQuality();
    }, this.config.qualityAdjustmentIntervalMs);
  }

  private stopQualityMonitoring(): void {
    if (this.qualityAdjustmentInterval) {
      clearInterval(this.qualityAdjustmentInterval);
      this.qualityAdjustmentInterval = undefined;
    }
  }

  private startConnectionStatsMonitoring(): void {
    this.connectionStatsInterval = setInterval(async () => {
      await this.updateConnectionStats();
    }, 5000); // Update every 5 seconds
  }

  private stopConnectionStatsMonitoring(): void {
    if (this.connectionStatsInterval) {
      clearInterval(this.connectionStatsInterval);
      this.connectionStatsInterval = undefined;
    }
  }

  private async updateConnectionStats(): Promise<void> {
    if (!this.jitsiAPI) return;

    try {
      const stats = await this.jitsiAPI.getConnectionStats();
      this.parseConnectionStats(stats);
    } catch (error) {
      console.warn('Failed to get connection stats:', error);
    }
  }

  private parseConnectionStats(stats: any): void {
    if (!stats) return;

    // Update metrics based on connection stats
    this.currentMetrics = {
      ...this.currentMetrics,
      videoBitrate: stats.bitrate?.video || this.currentMetrics.videoBitrate,
      audioBitrate: stats.bitrate?.audio || this.currentMetrics.audioBitrate,
      packetLoss: stats.packetLoss?.total || this.currentMetrics.packetLoss,
      jitter: stats.jitter || this.currentMetrics.jitter,
      rtt: stats.rtt || this.currentMetrics.rtt,
      connectionState: this.mapConnectionState(stats.connectionState)
    };
  }

  private monitorAndAdjustQuality(): void {
    if (!this.networkConditions) return;

    const optimalQuality = this.calculateOptimalQuality(this.networkConditions);
    
    // Only adjust if there's a significant difference
    if (this.shouldAdjustQuality(optimalQuality)) {
      this.setVideoQuality(optimalQuality);
    }
  }

  private calculateOptimalQuality(networkConditions: NetworkConditions): Partial<QualitySettings> {
    const bandwidth = networkConditions.bandwidthKbps;
    const rtt = networkConditions.rttMs;
    const packetLoss = networkConditions.packetLossPercent;

    // Calculate optimal settings based on network conditions
    let resolution: QualitySettings['resolution'] = '144p';
    let videoBitrate = 100;
    let audioBitrate = 32;
    let framerate: QualitySettings['framerate'] = 15;

    if (bandwidth > 2000 && rtt < 100 && packetLoss < 1) {
      resolution = '720p';
      videoBitrate = 1500;
      audioBitrate = 128;
      framerate = 30;
    } else if (bandwidth > 1000 && rtt < 200 && packetLoss < 2) {
      resolution = '480p';
      videoBitrate = 800;
      audioBitrate = 96;
      framerate = 24;
    } else if (bandwidth > 500 && rtt < 300 && packetLoss < 3) {
      resolution = '360p';
      videoBitrate = 400;
      audioBitrate = 64;
      framerate = 15;
    } else if (bandwidth > 250) {
      resolution = '240p';
      videoBitrate = 200;
      audioBitrate = 48;
      framerate = 15;
    }

    return {
      resolution,
      videoBitrateKbps: videoBitrate,
      audioBitrateKbps: audioBitrate,
      framerate,
      videoEnabled: bandwidth > 256,
      audioEnabled: true
    };
  }

  private shouldAdjustQuality(newQuality: Partial<QualitySettings>): boolean {
    if (newQuality.resolution && newQuality.resolution !== this.currentQuality.resolution) {
      return true;
    }
    
    if (newQuality.videoEnabled !== undefined && newQuality.videoEnabled !== this.currentQuality.videoEnabled) {
      return true;
    }

    return false;
  }

  private handleQualityChange(event: any): void {
    this.updateMetrics();
    
    this.emitEvent({
      type: 'video-quality-change',
      timestamp: new Date(),
      sessionId: 'current',
      data: this.currentQuality
    });
  }

  private updateMetrics(): void {
    this.currentMetrics = {
      ...this.currentMetrics,
      videoQuality: this.currentQuality.resolution,
      framerate: this.currentQuality.framerate,
      participantCount: this.getParticipantCount()
    };
  }

  private getParticipantCount(): number {
    if (!this.jitsiAPI) return 0;
    try {
      return this.jitsiAPI.getParticipantsInfo().length;
    } catch {
      return 1; // At least the current user
    }
  }

  private mapResolutionToQuality(resolution: QualitySettings['resolution']): number {
    const qualityMap = {
      '144p': 10,
      '240p': 20,
      '360p': 30,
      '480p': 40,
      '720p': 50,
      '1080p': 60
    };
    return qualityMap[resolution] || 30;
  }

  private mapResolutionToJitsiResolution(resolution: QualitySettings['resolution']): number {
    const resolutionMap = {
      '144p': 144,
      '240p': 240,
      '360p': 360,
      '480p': 480,
      '720p': 720,
      '1080p': 1080
    };
    return resolutionMap[resolution] || 360;
  }

  private getIdealHeight(resolution: QualitySettings['resolution']): number {
    return this.mapResolutionToJitsiResolution(resolution);
  }

  private getIdealWidth(resolution: QualitySettings['resolution']): number {
    const height = this.getIdealHeight(resolution);
    return Math.round(height * (16/9)); // 16:9 aspect ratio
  }

  private mapConnectionState(state: string): VideoCallMetrics['connectionState'] {
    switch (state) {
      case 'connecting': return 'connecting';
      case 'connected': return 'connected';
      case 'reconnecting': return 'reconnecting';
      case 'disconnected': return 'disconnected';
      default: return 'disconnected';
    }
  }

  private getDisplayName(consultation: ConsultationSession): string {
    // Return appropriate display name based on user role
    return `WebQX User - ${consultation.sessionId.substring(0, 8)}`;
  }

  private generateJWT(consultation: ConsultationSession): string {
    // In a real implementation, this would generate a proper JWT
    // For now, return a placeholder
    return 'placeholder-jwt-token';
  }

  private getDefaultQualitySettings(): QualitySettings {
    return {
      resolution: '360p',
      framerate: 24,
      videoBitrateKbps: 400,
      audioBitrateKbps: 64,
      videoEnabled: true,
      audioEnabled: true,
      screenShareEnabled: false
    };
  }

  private getDefaultMetrics(): VideoCallMetrics {
    return {
      videoQuality: '360p',
      framerate: 24,
      videoBitrate: 400,
      audioBitrate: 64,
      packetLoss: 0,
      jitter: 0,
      rtt: 0,
      participantCount: 0,
      connectionState: 'disconnected'
    };
  }

  private emitEvent(event: VideoEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('Error in video event listener:', error);
        }
      });
    }
  }
}