/**
 * Video Consultation Component
 * 
 * Jitsi-based video consultation implementation for WebQX™ Telehealth
 */

import { EventEmitter } from 'events';
import { 
  TelehealthComponent, 
  ComponentStatus, 
  VideoConsultationConfig, 
  VideoConsultationSession 
} from '../../core/types/telehealth.types';

export class VideoConsultationComponent extends EventEmitter implements TelehealthComponent {
  private config: VideoConsultationConfig;
  private status: ComponentStatus;
  private activeSessions: Map<string, VideoConsultationSession> = new Map();
  private jitsiApi: any = null;

  constructor(config: VideoConsultationConfig) {
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
   * Initialize the video consultation component
   */
  async initialize(): Promise<void> {
    try {
      this.logInfo('Initializing Video Consultation Component');

      // Load Jitsi Meet API if not already loaded
      if (this.config.jitsi && this.config.jitsi.domain) {
        await this.loadJitsiAPI();
      } else {
        // Use mock implementation if no Jitsi config
        this.jitsiApi = {
          JitsiMeetExternalAPI: class MockJitsiAPI {
            constructor(domain: string, options: any) {
              this.domain = domain;
              this.options = options;
            }
            addEventListener(event: string, callback: Function) {}
            removeEventListener(event: string, callback: Function) {}
            executeCommand(command: string, ...args: any[]) {}
            dispose() {}
          }
        };
      }
      
      // Setup event listeners
      this.setupEventListeners();

      this.status.status = 'running';
      this.status.healthy = true;
      this.status.lastUpdated = new Date();

      this.emit('initialized');
      this.logInfo('Video Consultation Component initialized successfully');
    } catch (error) {
      this.status.status = 'error';
      this.status.healthy = false;
      this.logError('Failed to initialize Video Consultation Component', error);
      throw error;
    }
  }

  /**
   * Start the video consultation component
   */
  async start(): Promise<void> {
    this.logInfo('Starting Video Consultation Component');
    this.status.status = 'running';
    this.status.lastUpdated = new Date();
    this.emit('started');
  }

  /**
   * Stop the video consultation component
   */
  async stop(): Promise<void> {
    this.logInfo('Stopping Video Consultation Component');
    
    // End all active sessions
    for (const [sessionId, session] of this.activeSessions) {
      await this.endConsultation(sessionId);
    }

    this.status.status = 'stopped';
    this.status.lastUpdated = new Date();
    this.emit('stopped');
  }

  /**
   * Load Jitsi Meet API
   */
  private async loadJitsiAPI(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        // Server-side: Mock implementation for testing
        this.jitsiApi = {
          JitsiMeetExternalAPI: class MockJitsiAPI {
            constructor(domain: string, options: any) {
              this.domain = domain;
              this.options = options;
            }
            addEventListener(event: string, callback: Function) {}
            removeEventListener(event: string, callback: Function) {}
            executeCommand(command: string, ...args: any[]) {}
            dispose() {}
          }
        };
        resolve();
        return;
      }

      // Client-side: Load actual Jitsi API
      if ((window as any).JitsiMeetExternalAPI) {
        this.jitsiApi = window;
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://${this.config.jitsi.domain}/external_api.js`;
      script.onload = () => {
        this.jitsiApi = window;
        resolve();
      };
      script.onerror = () => {
        reject(new Error('Failed to load Jitsi Meet API'));
      };
      document.head.appendChild(script);
    });
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
   * Create a new video consultation session
   */
  async createConsultation(params: {
    appointmentId: string;
    providerId: string;
    patientId: string;
    consultationType: string;
    specialty: string;
    moderatorId?: string;
  }): Promise<VideoConsultationSession> {
    try {
      const sessionId = `consultation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const roomName = `${params.appointmentId}_${sessionId}`;

      const session: VideoConsultationSession = {
        sessionId,
        roomName,
        participants: {
          providerId: params.providerId,
          patientId: params.patientId,
          moderatorId: params.moderatorId
        },
        startTime: new Date(),
        recording: {
          enabled: this.config.recording.enabled
        },
        metadata: {
          appointmentId: params.appointmentId,
          consultationType: params.consultationType,
          specialty: params.specialty
        }
      };

      this.activeSessions.set(sessionId, session);
      this.updateConnectionCount();

      this.emit('call:started', session);
      this.logInfo(`Video consultation created: ${sessionId}`);

      return session;
    } catch (error) {
      this.status.metrics!.errorCount++;
      this.logError('Failed to create video consultation', error);
      throw error;
    }
  }

  /**
   * Join a video consultation
   */
  async joinConsultation(sessionId: string, participantId: string, participantType: 'provider' | 'patient' | 'moderator'): Promise<{ 
    joinUrl: string; 
    jwtToken?: string; 
    roomConfig: any 
  }> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      const roomConfig = this.generateRoomConfig(session, participantType);
      const joinUrl = this.generateJoinUrl(session.roomName, participantId);
      let jwtToken: string | undefined;

      // Generate JWT token if configured
      if (this.config.jitsi.jwt) {
        jwtToken = this.generateJWTToken(session, participantId, participantType);
      }

      this.emit('participant:joined', { sessionId, participantId });
      this.logInfo(`Participant joined consultation: ${sessionId} - ${participantId}`);

      return { joinUrl, jwtToken, roomConfig };
    } catch (error) {
      this.status.metrics!.errorCount++;
      this.logError('Failed to join video consultation', error);
      throw error;
    }
  }

  /**
   * End a video consultation
   */
  async endConsultation(sessionId: string): Promise<void> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      session.endTime = new Date();
      
      // Stop recording if active
      if (session.recording?.enabled) {
        await this.stopRecording(sessionId);
      }

      this.activeSessions.delete(sessionId);
      this.updateConnectionCount();

      this.emit('call:ended', session);
      this.logInfo(`Video consultation ended: ${sessionId}`);
    } catch (error) {
      this.status.metrics!.errorCount++;
      this.logError('Failed to end video consultation', error);
      throw error;
    }
  }

  /**
   * Start recording for a session
   */
  async startRecording(sessionId: string): Promise<void> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      if (!this.config.recording.enabled) {
        throw new Error('Recording is not enabled in configuration');
      }

      session.recording = {
        enabled: true
      };

      this.emit('recording:started', { sessionId });
      this.logInfo(`Recording started for session: ${sessionId}`);
    } catch (error) {
      this.logError('Failed to start recording', error);
      throw error;
    }
  }

  /**
   * Stop recording for a session
   */
  async stopRecording(sessionId: string): Promise<string> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // Generate recording URL (implementation depends on storage type)
      const recordingUrl = this.generateRecordingUrl(sessionId);
      
      if (session.recording) {
        session.recording.url = recordingUrl;
      }

      this.emit('recording:stopped', { sessionId, url: recordingUrl });
      this.logInfo(`Recording stopped for session: ${sessionId}`);

      return recordingUrl;
    } catch (error) {
      this.logError('Failed to stop recording', error);
      throw error;
    }
  }

  /**
   * Generate room configuration for Jitsi
   */
  private generateRoomConfig(session: VideoConsultationSession, participantType: string): any {
    return {
      roomName: session.roomName,
      width: '100%',
      height: '600px',
      configOverwrite: {
        startWithAudioMuted: participantType === 'patient',
        startWithVideoMuted: false,
        enableWelcomePage: false,
        prejoinPageEnabled: true,
        recording: {
          enabled: this.config.recording.enabled
        },
        analytics: {
          disabled: true // Ensure HIPAA compliance
        },
        p2p: {
          enabled: false // Force through JVB for better control
        }
      },
      interfaceConfigOverwrite: {
        TOOLBAR_BUTTONS: [
          'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
          'fodeviceselection', 'hangup', 'chat', 'recording',
          'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
          'videoquality', 'filmstrip', 'feedback', 'stats', 'shortcuts',
          'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone'
        ],
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        SHOW_BRAND_WATERMARK: false
      }
    };
  }

  /**
   * Generate join URL for a consultation
   */
  private generateJoinUrl(roomName: string, participantId: string): string {
    const baseUrl = `https://${this.config.jitsi.domain}/${roomName}`;
    const params = new URLSearchParams({
      participantId: participantId,
      userInfo: JSON.stringify({
        displayName: participantId,
        id: participantId
      })
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Generate JWT token for authentication (if configured)
   */
  private generateJWTToken(session: VideoConsultationSession, participantId: string, participantType: string): string {
    if (!this.config.jitsi.jwt) {
      throw new Error('JWT configuration not available');
    }

    // This is a simplified JWT generation - in production, use a proper JWT library
    const header = {
      typ: 'JWT',
      alg: 'HS256'
    };

    const payload = {
      iss: this.config.jitsi.appId,
      aud: this.config.jitsi.domain,
      exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour expiry
      room: session.roomName,
      sub: this.config.jitsi.domain,
      context: {
        user: {
          id: participantId,
          name: participantId,
          role: participantType
        },
        features: {
          recording: this.config.recording.enabled && participantType === 'provider',
          livestreaming: false
        }
      }
    };

    // Note: In a real implementation, use a proper JWT library like 'jsonwebtoken'
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    
    return `${encodedHeader}.${encodedPayload}.signature_placeholder`;
  }

  /**
   * Generate recording URL based on storage configuration
   */
  private generateRecordingUrl(sessionId: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `recording_${sessionId}_${timestamp}`;

    switch (this.config.recording.storage) {
      case 's3':
        return `https://s3.amazonaws.com/webqx-recordings/${filename}.mp4`;
      case 'azure':
        return `https://webqxstorage.blob.core.windows.net/recordings/${filename}.mp4`;
      default:
        return `/recordings/${filename}.mp4`;
    }
  }

  /**
   * Update connection count metric
   */
  private updateConnectionCount(): void {
    if (this.status.metrics) {
      this.status.metrics.activeConnections = this.activeSessions.size;
    }
  }

  /**
   * Update health metrics
   */
  private updateHealthMetrics(): void {
    const now = new Date();
    if (this.status.metrics) {
      this.status.metrics.uptime = now.getTime() - this.status.lastUpdated.getTime();
      
      // Calculate success rate (simplified)
      const totalOperations = this.status.metrics.errorCount + 100; // Assume 100 successful operations
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
      case 'patient:selected':
        this.logInfo(`Patient selected for video consultation: ${data.patientId}`);
        break;
      case 'appointment:created':
        this.logInfo(`New appointment created, video consultation may be needed: ${data.appointmentId}`);
        break;
      default:
        // Ignore unknown events
        break;
    }
  }

  /**
   * Get component configuration
   */
  getConfig(): VideoConsultationConfig {
    return { ...this.config };
  }

  /**
   * Update component configuration
   */
  async updateConfig(config: Partial<VideoConsultationConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    this.logInfo('Video consultation configuration updated');
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): VideoConsultationSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): VideoConsultationSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Log info message
   */
  private logInfo(message: string, context?: any): void {
    console.log(`[Video Consultation Component] ${message}`, context || '');
  }

  /**
   * Log error message
   */
  private logError(message: string, error: any): void {
    console.error(`[Video Consultation Component] ${message}`, error);
  }
}