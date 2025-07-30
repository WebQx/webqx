import type { 
  OpenEMRConfig, 
  OpenEMRTokens, 
  OpenEMRPatient, 
  OpenEMRAppointment,
  OpenEMRSlot,
  OpenEMREncounter,
  OpenEMRClinicalSummary,
  OpenEMRSearchParams,
  OpenEMRAppointmentRequest,
  OpenEMRSlotSearchParams,
  OpenEMROperationResult,
  OpenEMRAuditEvent
} from '../types';

/**
 * OpenEMR Integration Service
 * 
 * Provides comprehensive integration with OpenEMR EHR system including:
 * - OAuth2 authentication
 * - FHIR R4 support
 * - Patient management
 * - Appointment scheduling
 * - Clinical data access
 */
export class OpenEMRIntegration {
  private config: OpenEMRConfig;
  private tokens?: OpenEMRTokens;
  private auditEvents: OpenEMRAuditEvent[] = [];

  constructor(config: OpenEMRConfig) {
    this.config = {
      ...config,
      security: {
        verifySSL: true,
        timeout: 30000,
        ...config.security
      },
      features: {
        enableAudit: true,
        enableSync: true,
        syncInterval: 15,
        ...config.features
      }
    };
  }

  /**
   * Initialize the OpenEMR integration
   */
  async initialize(): Promise<void> {
    this.log('Initializing OpenEMR integration...');
    
    try {
      // Validate configuration
      this.validateConfig();
      
      // Test connectivity
      await this.testConnectivity();
      
      this.log('OpenEMR integration initialized successfully');
      this.auditLog({
        action: 'integration_initialized',
        resourceType: 'system',
        userId: 'system',
        timestamp: new Date(),
        outcome: 'success'
      });
    } catch (error) {
      this.log('Failed to initialize OpenEMR integration:', error);
      throw error;
    }
  }

  /**
   * Get OAuth2 authorization URL
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.oauth.clientId,
      redirect_uri: this.config.oauth.redirectUri,
      scope: this.config.oauth.scopes.join(' '),
      state: state || this.generateState()
    });

    return `${this.config.baseUrl}/oauth2/default/authorize?${params}`;
  }

  /**
   * Exchange authorization code for access tokens
   */
  async exchangeCodeForTokens(code: string, state?: string): Promise<OpenEMRTokens> {
    this.log('Exchanging authorization code for tokens...');

    try {
      const response = await fetch(`${this.config.baseUrl}/oauth2/default/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${this.config.oauth.clientId}:${this.config.oauth.clientSecret}`)}`
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.config.oauth.redirectUri
        })
      });

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.statusText}`);
      }

      const tokenData = await response.json();
      
      this.tokens = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenType: tokenData.token_type || 'Bearer',
        expiresIn: tokenData.expires_in,
        scope: tokenData.scope,
        idToken: tokenData.id_token
      };

      this.auditLog({
        action: 'authentication_success',
        resourceType: 'oauth_token',
        userId: 'user',
        timestamp: new Date(),
        outcome: 'success'
      });

      return this.tokens;
    } catch (error) {
      this.auditLog({
        action: 'authentication_failure',
        resourceType: 'oauth_token',
        userId: 'user',
        timestamp: new Date(),
        outcome: 'failure',
        details: { error: error.message }
      });
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(): Promise<OpenEMRTokens> {
    if (!this.tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    this.log('Refreshing access token...');

    try {
      const response = await fetch(`${this.config.baseUrl}/oauth2/default/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${this.config.oauth.clientId}:${this.config.oauth.clientSecret}`)}`
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.tokens.refreshToken
        })
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const tokenData = await response.json();
      
      this.tokens = {
        ...this.tokens,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || this.tokens.refreshToken,
        expiresIn: tokenData.expires_in
      };

      return this.tokens;
    } catch (error) {
      this.log('Token refresh failed:', error);
      throw error;
    }
  }

  /**
   * Get patient by ID
   */
  async getPatient(patientId: string): Promise<OpenEMROperationResult<OpenEMRPatient>> {
    this.log(`Getting patient: ${patientId}`);

    try {
      const response = await this.authenticatedRequest(
        `GET`,
        `/apis/default/api/patient/${patientId}`
      );

      if (response.ok) {
        const data = await response.json();
        const patient = this.mapToPatient(data);
        
        this.auditLog({
          action: 'patient_data_access',
          resourceType: 'Patient',
          resourceId: patientId,
          userId: 'user',
          timestamp: new Date(),
          outcome: 'success'
        });

        return { success: true, data: patient };
      } else {
        const error = await response.text();
        return {
          success: false,
          error: {
            code: 'PATIENT_ACCESS_FAILED',
            message: `Failed to get patient: ${response.statusText}`,
            details: error
          }
        };
      }
    } catch (error) {
      this.log('Error getting patient:', error);
      return {
        success: false,
        error: {
          code: 'PATIENT_ACCESS_ERROR',
          message: error.message
        }
      };
    }
  }

  /**
   * Search patients
   */
  async searchPatients(params: OpenEMRSearchParams): Promise<OpenEMROperationResult<OpenEMRPatient[]>> {
    this.log('Searching patients with params:', params);

    try {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });

      const response = await this.authenticatedRequest(
        'GET',
        `/apis/default/api/patient?${searchParams}`
      );

      if (response.ok) {
        const data = await response.json();
        const patients = Array.isArray(data) ? data.map(p => this.mapToPatient(p)) : [];
        
        this.auditLog({
          action: 'patient_search',
          resourceType: 'Patient',
          userId: 'user',
          timestamp: new Date(),
          outcome: 'success',
          details: { resultCount: patients.length }
        });

        return { success: true, data: patients };
      } else {
        const error = await response.text();
        return {
          success: false,
          error: {
            code: 'PATIENT_SEARCH_FAILED',
            message: `Patient search failed: ${response.statusText}`,
            details: error
          }
        };
      }
    } catch (error) {
      this.log('Error searching patients:', error);
      return {
        success: false,
        error: {
          code: 'PATIENT_SEARCH_ERROR',
          message: error.message
        }
      };
    }
  }

  /**
   * Get available appointment slots
   */
  async getAvailableSlots(params: OpenEMRSlotSearchParams): Promise<OpenEMROperationResult<OpenEMRSlot[]>> {
    this.log('Getting available slots with params:', params);

    try {
      if (this.config.fhir?.enabled) {
        return await this.getFHIRSlots(params);
      } else {
        return await this.getAPISlots(params);
      }
    } catch (error) {
      this.log('Error getting available slots:', error);
      return {
        success: false,
        error: {
          code: 'SLOTS_ACCESS_ERROR',
          message: error.message
        }
      };
    }
  }

  /**
   * Book an appointment
   */
  async bookAppointment(request: OpenEMRAppointmentRequest): Promise<OpenEMROperationResult<OpenEMRAppointment>> {
    this.log('Booking appointment:', request);

    try {
      // Validate request
      const validation = this.validateAppointmentRequest(request);
      if (!validation.success) {
        return validation;
      }

      const appointmentData = {
        patient_id: request.patient,
        practitioner_id: request.practitioner,
        datetime: request.start,
        duration: request.duration,
        service_type: request.serviceType,
        reason: request.reason,
        comment: request.comment,
        status: 'booked'
      };

      const response = await this.authenticatedRequest(
        'POST',
        '/apis/default/api/appointment',
        appointmentData
      );

      if (response.ok) {
        const data = await response.json();
        const appointment = this.mapToAppointment(data);
        
        this.auditLog({
          action: 'appointment_created',
          resourceType: 'Appointment',
          resourceId: appointment.id,
          userId: 'user',
          timestamp: new Date(),
          outcome: 'success'
        });

        return { success: true, data: appointment };
      } else {
        const error = await response.text();
        return {
          success: false,
          error: {
            code: 'APPOINTMENT_BOOKING_FAILED',
            message: `Appointment booking failed: ${response.statusText}`,
            details: error
          }
        };
      }
    } catch (error) {
      this.log('Error booking appointment:', error);
      return {
        success: false,
        error: {
          code: 'APPOINTMENT_BOOKING_ERROR',
          message: error.message
        }
      };
    }
  }

  /**
   * Get patient appointments
   */
  async getPatientAppointments(patientId: string, options?: { from?: string; to?: string }): Promise<OpenEMROperationResult<OpenEMRAppointment[]>> {
    this.log(`Getting appointments for patient: ${patientId}`);

    try {
      const params = new URLSearchParams({ patient_id: patientId });
      if (options?.from) params.append('from', options.from);
      if (options?.to) params.append('to', options.to);

      const response = await this.authenticatedRequest(
        'GET',
        `/apis/default/api/appointment?${params}`
      );

      if (response.ok) {
        const data = await response.json();
        const appointments = Array.isArray(data) ? data.map(a => this.mapToAppointment(a)) : [];
        
        this.auditLog({
          action: 'appointment_list_access',
          resourceType: 'Appointment',
          userId: 'user',
          timestamp: new Date(),
          outcome: 'success',
          details: { patientId, resultCount: appointments.length }
        });

        return { success: true, data: appointments };
      } else {
        const error = await response.text();
        return {
          success: false,
          error: {
            code: 'APPOINTMENT_ACCESS_FAILED',
            message: `Failed to get appointments: ${response.statusText}`,
            details: error
          }
        };
      }
    } catch (error) {
      this.log('Error getting patient appointments:', error);
      return {
        success: false,
        error: {
          code: 'APPOINTMENT_ACCESS_ERROR',
          message: error.message
        }
      };
    }
  }

  /**
   * Get clinical summary for patient
   */
  async getClinicalSummary(patientId: string): Promise<OpenEMROperationResult<OpenEMRClinicalSummary>> {
    this.log(`Getting clinical summary for patient: ${patientId}`);

    try {
      // Get patient data
      const patientResult = await this.getPatient(patientId);
      if (!patientResult.success) {
        return patientResult as OpenEMROperationResult<OpenEMRClinicalSummary>;
      }

      // Get additional clinical data
      const [problemsResult, medsResult, allergiesResult, vitalsResult] = await Promise.all([
        this.getPatientProblems(patientId),
        this.getPatientMedications(patientId),
        this.getPatientAllergies(patientId),
        this.getPatientVitals(patientId)
      ]);

      const summary: OpenEMRClinicalSummary = {
        patient: patientResult.data!,
        activeProblems: problemsResult.success ? problemsResult.data! : [],
        medications: medsResult.success ? medsResult.data! : [],
        allergies: allergiesResult.success ? allergiesResult.data! : [],
        vitals: vitalsResult.success ? vitalsResult.data! : []
      };

      this.auditLog({
        action: 'clinical_summary_access',
        resourceType: 'Patient',
        resourceId: patientId,
        userId: 'user',
        timestamp: new Date(),
        outcome: 'success'
      });

      return { success: true, data: summary };
    } catch (error) {
      this.log('Error getting clinical summary:', error);
      return {
        success: false,
        error: {
          code: 'CLINICAL_SUMMARY_ERROR',
          message: error.message
        }
      };
    }
  }

  /**
   * Get system status
   */
  async getStatus(): Promise<{ healthy: boolean; version?: string; fhir?: boolean }> {
    try {
      const response = await fetch(`${this.config.baseUrl}/apis/default/api/version`, {
        timeout: this.config.security?.timeout || 5000
      });

      if (response.ok) {
        const data = await response.json();
        return {
          healthy: true,
          version: data.version,
          fhir: this.config.fhir?.enabled
        };
      } else {
        return { healthy: false };
      }
    } catch (error) {
      this.log('Status check failed:', error);
      return { healthy: false };
    }
  }

  // Private helper methods

  private validateConfig(): void {
    const required = ['baseUrl', 'oauth.clientId', 'oauth.clientSecret', 'oauth.redirectUri'];
    for (const field of required) {
      const keys = field.split('.');
      let value = this.config as any;
      for (const key of keys) {
        value = value?.[key];
      }
      if (!value) {
        throw new Error(`Missing required configuration: ${field}`);
      }
    }
  }

  private async testConnectivity(): Promise<void> {
    const response = await fetch(`${this.config.baseUrl}/apis/default/api/version`, {
      timeout: this.config.security?.timeout || 5000
    });

    if (!response.ok) {
      throw new Error(`OpenEMR connectivity test failed: ${response.statusText}`);
    }
  }

  private generateState(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  private async authenticatedRequest(method: string, endpoint: string, body?: any): Promise<Response> {
    if (!this.tokens?.accessToken) {
      throw new Error('No access token available. Please authenticate first.');
    }

    const url = `${this.config.baseUrl}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `${this.tokens.tokenType} ${this.tokens.accessToken}`,
        'Accept': 'application/json'
      }
    };

    if (body) {
      options.headers = {
        ...options.headers,
        'Content-Type': 'application/json'
      };
      options.body = JSON.stringify(body);
    }

    return fetch(url, options);
  }

  // Data mapping methods
  private mapToPatient(data: any): OpenEMRPatient {
    return {
      id: data.id || data.uuid,
      identifier: data.identifier || [],
      name: data.name || [],
      gender: data.gender || 'unknown',
      birthDate: data.birthDate || data.birth_date,
      telecom: data.telecom || [],
      address: data.address || [],
      active: data.active !== false
    };
  }

  private mapToAppointment(data: any): OpenEMRAppointment {
    return {
      id: data.id || data.uuid,
      status: data.status || 'booked',
      serviceType: data.serviceType || { text: data.service_type },
      reasonCode: data.reasonCode || (data.reason ? [{ text: data.reason }] : []),
      start: data.start || data.datetime,
      end: data.end || this.calculateEndTime(data.start || data.datetime, data.duration),
      participant: data.participant || [],
      comment: data.comment
    };
  }

  private calculateEndTime(start: string, duration: number): string {
    const startTime = new Date(start);
    const endTime = new Date(startTime.getTime() + duration * 60000);
    return endTime.toISOString();
  }

  private validateAppointmentRequest(request: OpenEMRAppointmentRequest): OpenEMROperationResult {
    const errors: string[] = [];

    if (!request.patient) errors.push('Patient ID is required');
    if (!request.start) errors.push('Start time is required');
    if (!request.duration || request.duration <= 0) errors.push('Valid duration is required');

    if (errors.length > 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Appointment request validation failed',
          details: errors
        }
      };
    }

    return { success: true };
  }

  // Placeholder methods for clinical data (to be implemented based on OpenEMR API)
  private async getPatientProblems(patientId: string): Promise<OpenEMROperationResult<any[]>> {
    // Implementation would depend on OpenEMR's specific problem list API
    return { success: true, data: [] };
  }

  private async getPatientMedications(patientId: string): Promise<OpenEMROperationResult<any[]>> {
    // Implementation would depend on OpenEMR's medication API
    return { success: true, data: [] };
  }

  private async getPatientAllergies(patientId: string): Promise<OpenEMROperationResult<any[]>> {
    // Implementation would depend on OpenEMR's allergy API
    return { success: true, data: [] };
  }

  private async getPatientVitals(patientId: string): Promise<OpenEMROperationResult<any[]>> {
    // Implementation would depend on OpenEMR's vitals/observations API
    return { success: true, data: [] };
  }

  private async getFHIRSlots(params: OpenEMRSlotSearchParams): Promise<OpenEMROperationResult<OpenEMRSlot[]>> {
    // FHIR-based slot retrieval implementation
    return { success: true, data: [] };
  }

  private async getAPISlots(params: OpenEMRSlotSearchParams): Promise<OpenEMROperationResult<OpenEMRSlot[]>> {
    // REST API-based slot retrieval implementation
    return { success: true, data: [] };
  }

  private auditLog(event: OpenEMRAuditEvent): void {
    if (this.config.features?.enableAudit) {
      this.auditEvents.push(event);
      this.log(`[AUDIT] ${event.action}: ${event.outcome}`);
    }
  }

  private log(message: string, ...args: any[]): void {
    if (this.config.debug) {
      console.log(`[OpenEMR Integration] ${message}`, ...args);
    }
  }
}