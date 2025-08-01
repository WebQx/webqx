/**
 * @fileoverview Telehealth Service with FHIR Integration
 * 
 * This service provides comprehensive telehealth functionality with FHIR R4 integration,
 * supporting Comlink video sessions and Jitsi fallback for open-source compatibility.
 * Includes accessibility features and elegant user experience design.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { EventEmitter } from 'events';

/**
 * Configuration interface for the Telehealth service
 */
export interface TelehealthConfig {
  /** FHIR server base URL */
  fhirServerUrl: string;
  /** FHIR authentication token */
  fhirAuthToken?: string;
  /** Comlink API configuration */
  comlink?: {
    apiKey: string;
    apiSecret: string;
    baseUrl?: string;
    environment?: 'sandbox' | 'production';
  };
  /** Jitsi configuration for fallback */
  jitsi?: {
    domain?: string;
    appId?: string;
    jwt?: string;
    enableAudioOnly?: boolean;
    enableScreenSharing?: boolean;
  };
  /** Preferred video provider */
  preferredProvider?: 'comlink' | 'jitsi' | 'auto';
  /** Session timeout in milliseconds */
  sessionTimeoutMs?: number;
  /** Enable automatic FHIR resource creation */
  enableFHIRIntegration?: boolean;
  /** Accessibility options */
  accessibility?: {
    enableCaptions?: boolean;
    enableHighContrast?: boolean;
    enableKeyboardNavigation?: boolean;
    screenReaderAnnouncements?: boolean;
  };
}

/**
 * Telehealth session interface
 */
export interface TelehealthSession {
  /** Unique session ID */
  id: string;
  /** Associated FHIR Appointment ID */
  appointmentId?: string;
  /** Patient ID */
  patientId: string;
  /** Provider ID */
  providerId: string;
  /** Session status */
  status: 'scheduled' | 'active' | 'ended' | 'cancelled' | 'failed';
  /** Video provider used */
  provider: 'comlink' | 'jitsi';
  /** Session start time */
  startTime?: Date;
  /** Session end time */
  endTime?: Date;
  /** Session metadata */
  metadata?: {
    appointmentType?: string;
    specialty?: string;
    duration?: number;
    quality?: 'high' | 'medium' | 'low';
    recording?: boolean;
  };
  /** Session URLs */
  urls?: {
    patient?: string;
    provider?: string;
    recording?: string;
  };
  /** FHIR Encounter resource ID */
  encounterId?: string;
}

/**
 * Session launch request interface
 */
export interface SessionLaunchRequest {
  /** Patient ID */
  patientId: string;
  /** Provider ID */
  providerId: string;
  /** Associated appointment ID (optional) */
  appointmentId?: string;
  /** Session type */
  sessionType?: 'consultation' | 'follow-up' | 'emergency' | 'second-opinion';
  /** Specialty */
  specialty?: string;
  /** Preferred provider */
  preferredProvider?: 'comlink' | 'jitsi';
  /** Session options */
  options?: {
    enableRecording?: boolean;
    enableCaptions?: boolean;
    audioOnly?: boolean;
    maxDuration?: number;
  };
}

/**
 * Session join response interface
 */
export interface SessionJoinResponse {
  /** Success indicator */
  success: boolean;
  /** Session information */
  session?: TelehealthSession;
  /** Join URL for the user */
  joinUrl?: string;
  /** Error information if failed */
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * FHIR Appointment resource for telehealth
 */
export interface FHIRTelehealthAppointment {
  resourceType: 'Appointment';
  id?: string;
  status: 'proposed' | 'pending' | 'booked' | 'arrived' | 'fulfilled' | 'cancelled' | 'noshow' | 'entered-in-error' | 'checked-in' | 'waitlist';
  serviceCategory?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  }>;
  serviceType?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  }>;
  appointmentType?: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  };
  description?: string;
  start?: string;
  end?: string;
  minutesDuration?: number;
  participant: Array<{
    type?: Array<{
      coding: Array<{
        system: string;
        code: string;
        display: string;
      }>;
    }>;
    actor: {
      reference: string;
      display?: string;
    };
    required?: 'required' | 'optional' | 'information-only';
    status: 'accepted' | 'declined' | 'tentative' | 'needs-action';
  }>;
  extension?: Array<{
    url: string;
    valueString?: string;
    valueBoolean?: boolean;
    valueReference?: {
      reference: string;
    };
  }>;
}

/**
 * FHIR Encounter resource for telehealth sessions
 */
export interface FHIRTelehealthEncounter {
  resourceType: 'Encounter';
  id?: string;
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown';
  class: {
    system: string;
    code: string;
    display: string;
  };
  type?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  }>;
  subject: {
    reference: string;
    display?: string;
  };
  participant?: Array<{
    type?: Array<{
      coding: Array<{
        system: string;
        code: string;
        display: string;
      }>;
    }>;
    individual?: {
      reference: string;
      display?: string;
    };
  }>;
  appointment?: Array<{
    reference: string;
  }>;
  period?: {
    start?: string;
    end?: string;
  };
  extension?: Array<{
    url: string;
    valueString?: string;
    valueBoolean?: boolean;
  }>;
}

/**
 * Default configuration for the Telehealth service
 */
const DEFAULT_CONFIG: Partial<TelehealthConfig> = {
  preferredProvider: 'auto',
  sessionTimeoutMs: 7200000, // 2 hours
  enableFHIRIntegration: true,
  comlink: {
    baseUrl: 'https://api.comlink.dev',
    environment: 'sandbox'
  },
  jitsi: {
    domain: 'meet.jit.si',
    enableAudioOnly: false,
    enableScreenSharing: true
  },
  accessibility: {
    enableCaptions: true,
    enableHighContrast: false,
    enableKeyboardNavigation: true,
    screenReaderAnnouncements: true
  }
};

/**
 * TelehealthService class provides comprehensive telehealth functionality
 * with FHIR integration and multiple video provider support
 */
export class TelehealthService extends EventEmitter {
  private config: TelehealthConfig;
  private activeSessions: Map<string, TelehealthSession> = new Map();

  /**
   * Creates a new TelehealthService instance
   * @param config - Service configuration
   */
  constructor(config: TelehealthConfig) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Validate required configuration
    if (!this.config.fhirServerUrl) {
      throw new Error('FHIR server URL must be configured');
    }

    if (this.config.preferredProvider === 'comlink' && !this.config.comlink?.apiKey) {
      throw new Error('Comlink API key must be configured when using Comlink as preferred provider');
    }

    this.logInfo('Telehealth Service initialized', {
      fhirIntegration: this.config.enableFHIRIntegration,
      preferredProvider: this.config.preferredProvider,
      accessibility: this.config.accessibility
    });
  }

  /**
   * Launch a new telehealth session
   */
  async launchSession(request: SessionLaunchRequest): Promise<SessionJoinResponse> {
    try {
      this.logInfo('Launching telehealth session', { 
        patientId: request.patientId,
        providerId: request.providerId,
        sessionType: request.sessionType 
      });

      // Determine video provider
      const provider = await this.selectProvider(request.preferredProvider);
      
      // Generate session ID
      const sessionId = this.generateSessionId();

      // Create FHIR resources if enabled
      let appointmentId = request.appointmentId;
      let encounterId: string | undefined;

      if (this.config.enableFHIRIntegration) {
        if (!appointmentId) {
          appointmentId = await this.createFHIRAppointment(request);
        }
        encounterId = await this.createFHIREncounter(request, appointmentId);
      }

      // Create session object
      const session: TelehealthSession = {
        id: sessionId,
        appointmentId,
        encounterId,
        patientId: request.patientId,
        providerId: request.providerId,
        status: 'scheduled',
        provider,
        metadata: {
          appointmentType: request.sessionType,
          specialty: request.specialty,
          recording: request.options?.enableRecording || false,
          quality: 'high'
        }
      };

      // Launch session with selected provider
      const urls = await this.createProviderSession(session, request.options);
      session.urls = urls;
      session.status = 'active';
      session.startTime = new Date();

      // Store active session
      this.activeSessions.set(sessionId, session);

      // Emit session started event
      this.emit('sessionStarted', session);

      this.logInfo('Telehealth session launched successfully', { 
        sessionId, 
        provider,
        appointmentId,
        encounterId 
      });

      return {
        success: true,
        session,
        joinUrl: urls.patient
      };

    } catch (error) {
      this.logError('Failed to launch telehealth session', error);
      return {
        success: false,
        error: {
          code: 'SESSION_LAUNCH_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error
        }
      };
    }
  }

  /**
   * Join an existing telehealth session
   */
  async joinSession(sessionId: string, userType: 'patient' | 'provider'): Promise<SessionJoinResponse> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      if (session.status !== 'active') {
        throw new Error(`Session is ${session.status}, cannot join`);
      }

      const joinUrl = userType === 'patient' ? session.urls?.patient : session.urls?.provider;
      if (!joinUrl) {
        throw new Error('Join URL not available');
      }

      this.logInfo('User joining telehealth session', { sessionId, userType });

      return {
        success: true,
        session,
        joinUrl
      };

    } catch (error) {
      this.logError('Failed to join telehealth session', error);
      return {
        success: false,
        error: {
          code: 'SESSION_JOIN_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * End a telehealth session
   */
  async endSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      session.status = 'ended';
      session.endTime = new Date();

      // Update FHIR Encounter if enabled
      if (this.config.enableFHIRIntegration && session.encounterId) {
        await this.updateFHIREncounter(session.encounterId, 'finished', session.endTime);
      }

      // Clean up provider session
      await this.cleanupProviderSession(session);

      // Remove from active sessions
      this.activeSessions.delete(sessionId);

      // Emit session ended event
      this.emit('sessionEnded', session);

      this.logInfo('Telehealth session ended', { sessionId });

      return { success: true };

    } catch (error) {
      this.logError('Failed to end telehealth session', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get session status
   */
  getSessionStatus(sessionId: string): TelehealthSession | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * List active sessions for a patient or provider
   */
  getActiveSessions(userId: string, userType: 'patient' | 'provider'): TelehealthSession[] {
    const sessions: TelehealthSession[] = [];
    
    for (const session of this.activeSessions.values()) {
      if (session.status === 'active') {
        if ((userType === 'patient' && session.patientId === userId) ||
            (userType === 'provider' && session.providerId === userId)) {
          sessions.push(session);
        }
      }
    }

    return sessions;
  }

  /**
   * Select appropriate video provider based on configuration and availability
   */
  private async selectProvider(preferredProvider?: 'comlink' | 'jitsi'): Promise<'comlink' | 'jitsi'> {
    const preference = preferredProvider || this.config.preferredProvider;

    if (preference === 'comlink' && this.config.comlink?.apiKey) {
      // Test Comlink availability
      if (await this.testComlinkAvailability()) {
        return 'comlink';
      }
    }

    if (preference === 'jitsi') {
      return 'jitsi';
    }

    // Auto-select: prefer Comlink if available, fallback to Jitsi
    if (preference === 'auto') {
      if (this.config.comlink?.apiKey && await this.testComlinkAvailability()) {
        return 'comlink';
      }
      return 'jitsi';
    }

    // Default fallback
    return 'jitsi';
  }

  /**
   * Test Comlink service availability
   */
  private async testComlinkAvailability(): Promise<boolean> {
    try {
      // Simple health check for Comlink
      const response = await fetch(`${this.config.comlink?.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.comlink?.apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      });
      
      return response.ok;
    } catch (error) {
      this.logError('Comlink availability test failed', error);
      return false;
    }
  }

  /**
   * Create session with the selected provider
   */
  private async createProviderSession(
    session: TelehealthSession, 
    options?: SessionLaunchRequest['options']
  ): Promise<{ patient?: string; provider?: string }> {
    
    if (session.provider === 'comlink') {
      return this.createComlinkSession(session, options);
    } else {
      return this.createJitsiSession(session, options);
    }
  }

  /**
   * Create Comlink video session
   */
  private async createComlinkSession(
    session: TelehealthSession,
    options?: SessionLaunchRequest['options']
  ): Promise<{ patient?: string; provider?: string }> {
    
    const comlinkConfig = this.config.comlink!;
    
    try {
      const response = await fetch(`${comlinkConfig.baseUrl}/sessions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${comlinkConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: session.id,
          participants: [
            {
              id: session.patientId,
              role: 'patient',
              name: `Patient ${session.patientId}`
            },
            {
              id: session.providerId,
              role: 'provider',
              name: `Provider ${session.providerId}`
            }
          ],
          options: {
            enableRecording: options?.enableRecording || false,
            enableCaptions: this.config.accessibility?.enableCaptions || false,
            audioOnly: options?.audioOnly || false,
            maxDuration: options?.maxDuration || this.config.sessionTimeoutMs
          },
          metadata: session.metadata
        })
      });

      if (!response.ok) {
        throw new Error(`Comlink API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        patient: data.participantUrls?.patient || data.joinUrl,
        provider: data.participantUrls?.provider || data.joinUrl
      };

    } catch (error) {
      this.logError('Failed to create Comlink session', error);
      // Fallback to Jitsi
      this.logInfo('Falling back to Jitsi for session', { sessionId: session.id });
      session.provider = 'jitsi';
      return this.createJitsiSession(session, options);
    }
  }

  /**
   * Create Jitsi video session
   */
  private async createJitsiSession(
    session: TelehealthSession,
    options?: SessionLaunchRequest['options']
  ): Promise<{ patient?: string; provider?: string }> {
    
    const jitsiConfig = this.config.jitsi!;
    const roomName = `webqx-session-${session.id}`;
    const baseUrl = `https://${jitsiConfig.domain}/${roomName}`;
    
    // Build Jitsi URL with configuration options
    const urlParams = new URLSearchParams();
    
    if (jitsiConfig.jwt) {
      urlParams.append('jwt', jitsiConfig.jwt);
    }
    
    if (options?.audioOnly || jitsiConfig.enableAudioOnly) {
      urlParams.append('config.startAudioOnly', 'true');
    }
    
    if (this.config.accessibility?.enableCaptions) {
      urlParams.append('config.transcribingEnabled', 'true');
    }
    
    if (!jitsiConfig.enableScreenSharing) {
      urlParams.append('config.disableDeepLinking', 'true');
    }

    // Add accessibility features
    if (this.config.accessibility?.enableKeyboardNavigation) {
      urlParams.append('config.enableClosePage', 'false');
    }

    const queryString = urlParams.toString();
    const finalUrl = queryString ? `${baseUrl}?${queryString}` : baseUrl;

    return {
      patient: `${finalUrl}&userInfo.displayName=Patient`,
      provider: `${finalUrl}&userInfo.displayName=Provider`
    };
  }

  /**
   * Create FHIR Appointment resource
   */
  private async createFHIRAppointment(request: SessionLaunchRequest): Promise<string> {
    const appointment: FHIRTelehealthAppointment = {
      resourceType: 'Appointment',
      status: 'booked',
      serviceCategory: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/service-category',
          code: 'gp',
          display: 'General Practice'
        }]
      }],
      serviceType: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/service-type',
          code: '124',
          display: 'General Practice'
        }]
      }],
      appointmentType: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v2-0276',
          code: 'ROUTINE',
          display: 'Routine appointment - default if not valued'
        }]
      },
      description: `Telehealth ${request.sessionType || 'consultation'} session`,
      start: new Date().toISOString(),
      minutesDuration: request.options?.maxDuration ? Math.floor(request.options.maxDuration / 60000) : 60,
      participant: [
        {
          type: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
              code: 'SBJ',
              display: 'subject'
            }]
          }],
          actor: {
            reference: `Patient/${request.patientId}`,
            display: 'Patient'
          },
          required: 'required',
          status: 'accepted'
        },
        {
          type: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
              code: 'PPRF',
              display: 'primary performer'
            }]
          }],
          actor: {
            reference: `Practitioner/${request.providerId}`,
            display: 'Provider'
          },
          required: 'required',
          status: 'accepted'
        }
      ],
      extension: [{
        url: 'http://webqx.health/fhir/StructureDefinition/telehealth-session',
        valueBoolean: true
      }]
    };

    const response = await this.makeFHIRRequest('/Appointment', 'POST', appointment);
    return response.id;
  }

  /**
   * Create FHIR Encounter resource
   */
  private async createFHIREncounter(request: SessionLaunchRequest, appointmentId: string): Promise<string> {
    const encounter: FHIRTelehealthEncounter = {
      resourceType: 'Encounter',
      status: 'planned',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'VR',
        display: 'virtual'
      },
      type: [{
        coding: [{
          system: 'http://snomed.info/sct',
          code: '185317003',
          display: 'Telephone consultation'
        }]
      }],
      subject: {
        reference: `Patient/${request.patientId}`,
        display: 'Patient'
      },
      participant: [{
        type: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
            code: 'PPRF',
            display: 'primary performer'
          }]
        }],
        individual: {
          reference: `Practitioner/${request.providerId}`,
          display: 'Provider'
        }
      }],
      appointment: [{
        reference: `Appointment/${appointmentId}`
      }],
      period: {
        start: new Date().toISOString()
      },
      extension: [{
        url: 'http://webqx.health/fhir/StructureDefinition/telehealth-provider',
        valueString: 'webqx-telehealth'
      }]
    };

    const response = await this.makeFHIRRequest('/Encounter', 'POST', encounter);
    return response.id;
  }

  /**
   * Update FHIR Encounter resource
   */
  private async updateFHIREncounter(encounterId: string, status: string, endTime?: Date): Promise<void> {
    const updateData = {
      status,
      ...(endTime && {
        period: {
          end: endTime.toISOString()
        }
      })
    };

    await this.makeFHIRRequest(`/Encounter/${encounterId}`, 'PATCH', updateData);
  }

  /**
   * Make FHIR API request
   */
  private async makeFHIRRequest(endpoint: string, method: string, data?: any): Promise<any> {
    const url = `${this.config.fhirServerUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/fhir+json',
      'Accept': 'application/fhir+json'
    };

    if (this.config.fhirAuthToken) {
      headers['Authorization'] = `Bearer ${this.config.fhirAuthToken}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined
    });

    if (!response.ok) {
      throw new Error(`FHIR API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Cleanup provider-specific session resources
   */
  private async cleanupProviderSession(session: TelehealthSession): Promise<void> {
    try {
      if (session.provider === 'comlink' && this.config.comlink?.apiKey) {
        await fetch(`${this.config.comlink.baseUrl}/sessions/${session.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.config.comlink.apiKey}`,
            'Content-Type': 'application/json'
          }
        });
      }
      // Jitsi sessions don't require cleanup
    } catch (error) {
      this.logError('Failed to cleanup provider session', error);
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `webqx-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Logging utility
   */
  private logInfo(message: string, data?: any): void {
    console.log(`[Telehealth Service] ${message}`, data || '');
  }

  /**
   * Error logging utility
   */
  private logError(message: string, error?: any): void {
    console.error(`[Telehealth Service] ${message}`, error || '');
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // End all active sessions
    for (const sessionId of this.activeSessions.keys()) {
      this.endSession(sessionId);
    }
    
    this.removeAllListeners();
    this.logInfo('Service destroyed');
  }
}

export default TelehealthService;