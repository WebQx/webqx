/**
 * FHIR R4 Client with SMART on FHIR OAuth2 Support
 * 
 * Implementation of a comprehensive FHIR R4 client that supports
 * SMART on FHIR OAuth2 authentication and appointment booking.
 * 
 * @author WebQX Health
 * @version 1.0.0
 * @specification SMART on FHIR and HL7 FHIR R4
 */

import {
  FHIRResource,
  FHIRBundle,
  FHIRPatient,
  FHIRPractitioner,
  FHIRAppointment,
  FHIRSchedule,
  FHIRSlot,
  FHIROrganization,
  FHIROperationOutcome,
  FHIRAppointmentSearchParams,
  FHIRSlotSearchParams,
  FHIRCreateAppointmentRequest,
  FHIRUpdateAppointmentRequest,
  FHIRBatchRequest,
  FHIRApiResponse,
  FHIRAppointmentStatus
} from '../types/fhir-r4';

/**
 * SMART on FHIR OAuth2 Configuration
 */
export interface SMARTOnFHIRConfig {
  /** FHIR base URL */
  fhirBaseUrl: string;
  /** Client ID for OAuth2 */
  clientId: string;
  /** Client secret (for confidential clients) */
  clientSecret?: string;
  /** Redirect URI for OAuth2 flow */
  redirectUri: string;
  /** SMART on FHIR scopes */
  scopes: string[];
  /** Authorization endpoint URL */
  authorizationEndpoint?: string;
  /** Token endpoint URL */
  tokenEndpoint?: string;
  /** SMART capabilities endpoint */
  capabilitiesEndpoint?: string;
  /** Launch context (for EHR launch) */
  launchContext?: string;
  /** State parameter for OAuth2 */
  state?: string;
}

/**
 * OAuth2 Token Response
 */
export interface OAuth2TokenResponse {
  /** Access token */
  access_token: string;
  /** Token type (usually 'Bearer') */
  token_type: string;
  /** Token expiration in seconds */
  expires_in?: number;
  /** Refresh token */
  refresh_token?: string;
  /** Granted scopes */
  scope?: string;
  /** Patient context (SMART on FHIR) */
  patient?: string;
  /** Encounter context (SMART on FHIR) */
  encounter?: string;
  /** Launch context */
  launch?: string;
}

/**
 * SMART Capabilities Response
 */
export interface SMARTCapabilities {
  /** Authorization endpoint */
  authorization_endpoint: string;
  /** Token endpoint */
  token_endpoint: string;
  /** Supported response types */
  response_types_supported?: string[];
  /** Supported grant types */
  grant_types_supported?: string[];
  /** Supported scopes */
  scopes_supported?: string[];
  /** Supported authentication methods */
  token_endpoint_auth_methods_supported?: string[];
  /** Capabilities */
  capabilities?: string[];
}

/**
 * FHIR R4 Client Options
 */
export interface FHIRR4ClientOptions {
  /** Base URL for FHIR server */
  baseUrl: string;
  /** Default timeout in milliseconds */
  timeout?: number;
  /** Default headers */
  headers?: Record<string, string>;
  /** Enable debug logging */
  debug?: boolean;
  /** Retry configuration */
  retry?: {
    attempts: number;
    delay: number;
    backoff: number;
  };
  /** SMART on FHIR configuration */
  smartConfig?: SMARTOnFHIRConfig;
}

/**
 * HTTP Request Configuration
 */
interface RequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers?: Record<string, string>;
  body?: string;
  params?: Record<string, string | string[]>;
}

/**
 * FHIR R4 Client Implementation
 */
export class FHIRR4Client {
  private baseUrl: string;
  private timeout: number;
  private defaultHeaders: Record<string, string>;
  private debug: boolean;
  private retry: { attempts: number; delay: number; backoff: number };
  private smartConfig?: SMARTOnFHIRConfig;
  private accessToken?: string;
  private refreshToken?: string;
  private tokenExpiry?: Date;
  private patientContext?: string;

  constructor(options: FHIRR4ClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = options.timeout || 30000;
    this.defaultHeaders = {
      'Content-Type': 'application/fhir+json',
      'Accept': 'application/fhir+json',
      ...options.headers
    };
    this.debug = options.debug || false;
    this.retry = options.retry || { attempts: 3, delay: 1000, backoff: 2 };
    this.smartConfig = options.smartConfig;

    if (this.debug) {
      console.log('[FHIR R4 Client] Initialized with base URL:', this.baseUrl);
    }
  }

  // ============================================================================
  // SMART on FHIR OAuth2 Methods
  // ============================================================================

  /**
   * Discover SMART capabilities
   */
  async discoverCapabilities(): Promise<SMARTCapabilities> {
    if (!this.smartConfig) {
      throw new Error('SMART configuration not provided');
    }

    const capabilitiesUrl = this.smartConfig.capabilitiesEndpoint || 
                           `${this.baseUrl}/.well-known/smart_configuration`;

    try {
      const response = await this.makeRequest({
        method: 'GET',
        url: capabilitiesUrl
      });

      return JSON.parse(response.body);
    } catch (error) {
      throw new Error(`Failed to discover SMART capabilities: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get authorization URL for OAuth2 flow
   */
  getAuthorizationUrl(): string {
    if (!this.smartConfig) {
      throw new Error('SMART configuration not provided');
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.smartConfig.clientId,
      redirect_uri: this.smartConfig.redirectUri,
      scope: this.smartConfig.scopes.join(' '),
      state: this.smartConfig.state || this.generateState(),
      aud: this.baseUrl
    });

    if (this.smartConfig.launchContext) {
      params.append('launch', this.smartConfig.launchContext);
    }

    const authUrl = this.smartConfig.authorizationEndpoint || 
                   `${this.baseUrl}/oauth2/authorize`;

    return `${authUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string, state?: string): Promise<OAuth2TokenResponse> {
    if (!this.smartConfig) {
      throw new Error('SMART configuration not provided');
    }

    const tokenUrl = this.smartConfig.tokenEndpoint || 
                    `${this.baseUrl}/oauth2/token`;

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.smartConfig.redirectUri,
      client_id: this.smartConfig.clientId
    });

    if (this.smartConfig.clientSecret) {
      body.append('client_secret', this.smartConfig.clientSecret);
    }

    try {
      const response = await this.makeRequest({
        method: 'POST',
        url: tokenUrl,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: body.toString()
      });

      const tokenResponse: OAuth2TokenResponse = JSON.parse(response.body);
      
      // Store tokens
      this.accessToken = tokenResponse.access_token;
      this.refreshToken = tokenResponse.refresh_token;
      this.patientContext = tokenResponse.patient;
      
      if (tokenResponse.expires_in) {
        this.tokenExpiry = new Date(Date.now() + tokenResponse.expires_in * 1000);
      }

      if (this.debug) {
        console.log('[FHIR R4 Client] Token exchange successful');
      }

      return tokenResponse;
    } catch (error) {
      throw new Error(`Token exchange failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<OAuth2TokenResponse> {
    if (!this.smartConfig || !this.refreshToken) {
      throw new Error('Refresh token not available');
    }

    const tokenUrl = this.smartConfig.tokenEndpoint || 
                    `${this.baseUrl}/oauth2/token`;

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
      client_id: this.smartConfig.clientId
    });

    if (this.smartConfig.clientSecret) {
      body.append('client_secret', this.smartConfig.clientSecret);
    }

    try {
      const response = await this.makeRequest({
        method: 'POST',
        url: tokenUrl,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: body.toString()
      });

      const tokenResponse: OAuth2TokenResponse = JSON.parse(response.body);
      
      // Update tokens
      this.accessToken = tokenResponse.access_token;
      if (tokenResponse.refresh_token) {
        this.refreshToken = tokenResponse.refresh_token;
      }
      
      if (tokenResponse.expires_in) {
        this.tokenExpiry = new Date(Date.now() + tokenResponse.expires_in * 1000);
      }

      if (this.debug) {
        console.log('[FHIR R4 Client] Token refresh successful');
      }

      return tokenResponse;
    } catch (error) {
      throw new Error(`Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Set access token manually
   */
  setAccessToken(token: string, expiresIn?: number): void {
    this.accessToken = token;
    if (expiresIn) {
      this.tokenExpiry = new Date(Date.now() + expiresIn * 1000);
    }
  }

  /**
   * Check if token is expired and refresh if needed
   */
  private async ensureValidToken(): Promise<void> {
    if (!this.accessToken) {
      throw new Error('No access token available. Please authenticate first.');
    }

    if (this.tokenExpiry && new Date() >= this.tokenExpiry) {
      if (this.refreshToken) {
        await this.refreshAccessToken();
      } else {
        throw new Error('Access token expired and no refresh token available');
      }
    }
  }

  // ============================================================================
  // Patient Resource Methods
  // ============================================================================

  /**
   * Get patient by ID
   */
  async getPatient(id: string): Promise<FHIRApiResponse<FHIRPatient>> {
    await this.ensureValidToken();
    
    try {
      const response = await this.makeAuthenticatedRequest({
        method: 'GET',
        url: `${this.baseUrl}/Patient/${id}`
      });

      return {
        success: true,
        data: JSON.parse(response.body) as FHIRPatient,
        statusCode: response.status
      };
    } catch (error) {
      return this.handleError<FHIRPatient>(error);
    }
  }

  /**
   * Search patients
   */
  async searchPatients(params: Record<string, string | string[]>): Promise<FHIRApiResponse<FHIRBundle>> {
    await this.ensureValidToken();
    
    try {
      const response = await this.makeAuthenticatedRequest({
        method: 'GET',
        url: `${this.baseUrl}/Patient`,
        params
      });

      return {
        success: true,
        data: JSON.parse(response.body) as FHIRBundle,
        statusCode: response.status
      };
    } catch (error) {
      return this.handleError<FHIRBundle>(error);
    }
  }

  /**
   * Get current patient context (from SMART launch)
   */
  async getCurrentPatient(): Promise<FHIRApiResponse<FHIRPatient>> {
    if (!this.patientContext) {
      return {
        success: false,
        outcome: {
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'not-found',
            diagnostics: 'No patient context available'
          }]
        }
      };
    }

    return this.getPatient(this.patientContext);
  }

  // ============================================================================
  // Appointment Resource Methods
  // ============================================================================

  /**
   * Search appointments
   */
  async searchAppointments(params: FHIRAppointmentSearchParams): Promise<FHIRApiResponse<FHIRBundle>> {
    await this.ensureValidToken();
    
    try {
      const response = await this.makeAuthenticatedRequest({
        method: 'GET',
        url: `${this.baseUrl}/Appointment`,
        params: params as Record<string, string | string[]>
      });

      return {
        success: true,
        data: JSON.parse(response.body) as FHIRBundle,
        statusCode: response.status
      };
    } catch (error) {
      return this.handleError<FHIRBundle>(error);
    }
  }

  /**
   * Get appointment by ID
   */
  async getAppointment(id: string): Promise<FHIRApiResponse<FHIRAppointment>> {
    await this.ensureValidToken();
    
    try {
      const response = await this.makeAuthenticatedRequest({
        method: 'GET',
        url: `${this.baseUrl}/Appointment/${id}`
      });

      return {
        success: true,
        data: JSON.parse(response.body) as FHIRAppointment,
        statusCode: response.status
      };
    } catch (error) {
      return this.handleError<FHIRAppointment>(error);
    }
  }

  /**
   * Create new appointment
   */
  async createAppointment(request: FHIRCreateAppointmentRequest): Promise<FHIRApiResponse<FHIRAppointment>> {
    await this.ensureValidToken();
    
    try {
      const headers: Record<string, string> = {};
      if (request.ifNoneExist) {
        headers['If-None-Exist'] = request.ifNoneExist;
      }

      const response = await this.makeAuthenticatedRequest({
        method: 'POST',
        url: `${this.baseUrl}/Appointment`,
        headers,
        body: JSON.stringify(request.appointment)
      });

      return {
        success: true,
        data: JSON.parse(response.body) as FHIRAppointment,
        statusCode: response.status,
        headers: response.headers
      };
    } catch (error) {
      return this.handleError<FHIRAppointment>(error);
    }
  }

  /**
   * Update existing appointment
   */
  async updateAppointment(request: FHIRUpdateAppointmentRequest): Promise<FHIRApiResponse<FHIRAppointment>> {
    await this.ensureValidToken();
    
    try {
      const headers: Record<string, string> = {};
      if (request.ifMatch) {
        headers['If-Match'] = request.ifMatch;
      }

      const response = await this.makeAuthenticatedRequest({
        method: 'PUT',
        url: `${this.baseUrl}/Appointment/${request.id}`,
        headers,
        body: JSON.stringify(request.appointment)
      });

      return {
        success: true,
        data: JSON.parse(response.body) as FHIRAppointment,
        statusCode: response.status,
        headers: response.headers
      };
    } catch (error) {
      return this.handleError<FHIRAppointment>(error);
    }
  }

  /**
   * Cancel appointment
   */
  async cancelAppointment(id: string, reason?: string): Promise<FHIRApiResponse<FHIRAppointment>> {
    const appointment = await this.getAppointment(id);
    if (!appointment.success || !appointment.data) {
      return appointment;
    }

    const updatedAppointment: FHIRAppointment = {
      ...appointment.data,
      status: 'cancelled'
    };

    if (reason) {
      updatedAppointment.cancelationReason = {
        text: reason
      };
    }

    return this.updateAppointment({
      id,
      appointment: updatedAppointment
    });
  }

  // ============================================================================
  // Schedule and Slot Methods
  // ============================================================================

  /**
   * Search schedules
   */
  async searchSchedules(params: Record<string, string | string[]>): Promise<FHIRApiResponse<FHIRBundle>> {
    await this.ensureValidToken();
    
    try {
      const response = await this.makeAuthenticatedRequest({
        method: 'GET',
        url: `${this.baseUrl}/Schedule`,
        params
      });

      return {
        success: true,
        data: JSON.parse(response.body) as FHIRBundle,
        statusCode: response.status
      };
    } catch (error) {
      return this.handleError<FHIRBundle>(error);
    }
  }

  /**
   * Search available slots
   */
  async searchSlots(params: FHIRSlotSearchParams): Promise<FHIRApiResponse<FHIRBundle>> {
    await this.ensureValidToken();
    
    try {
      const response = await this.makeAuthenticatedRequest({
        method: 'GET',
        url: `${this.baseUrl}/Slot`,
        params: params as Record<string, string | string[]>
      });

      return {
        success: true,
        data: JSON.parse(response.body) as FHIRBundle,
        statusCode: response.status
      };
    } catch (error) {
      return this.handleError<FHIRBundle>(error);
    }
  }

  /**
   * Get available slots for appointment booking
   */
  async getAvailableSlots(
    start: string,
    end: string,
    serviceType?: string,
    practitioner?: string
  ): Promise<FHIRApiResponse<FHIRBundle>> {
    const params: FHIRSlotSearchParams = {
      status: 'free',
      start: `ge${start}`,
      _count: 50
    };

    if (serviceType) {
      params['service-type'] = serviceType;
    }

    // Add practitioner search if specified
    // Note: This might require searching schedules first
    return this.searchSlots(params);
  }

  // ============================================================================
  // Batch Operations
  // ============================================================================

  /**
   * Execute batch/transaction request
   */
  async batch(request: FHIRBatchRequest): Promise<FHIRApiResponse<FHIRBundle>> {
    await this.ensureValidToken();
    
    try {
      const response = await this.makeAuthenticatedRequest({
        method: 'POST',
        url: this.baseUrl,
        body: JSON.stringify(request.bundle)
      });

      return {
        success: true,
        data: JSON.parse(response.body) as FHIRBundle,
        statusCode: response.status
      };
    } catch (error) {
      return this.handleError<FHIRBundle>(error);
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Make authenticated HTTP request
   */
  private async makeAuthenticatedRequest(config: RequestConfig): Promise<{ body: string; status: number; headers: Record<string, string> }> {
    const headers = {
      ...this.defaultHeaders,
      ...config.headers
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    return this.makeRequest({
      ...config,
      headers
    });
  }

  /**
   * Make HTTP request with retry logic
   */
  private async makeRequest(config: RequestConfig): Promise<{ body: string; status: number; headers: Record<string, string> }> {
    let url = config.url;
    
    // Add query parameters
    if (config.params) {
      const params = new URLSearchParams();
      Object.entries(config.params).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(v => params.append(key, v));
        } else {
          params.append(key, value);
        }
      });
      url += (url.includes('?') ? '&' : '?') + params.toString();
    }

    const requestInit: RequestInit = {
      method: config.method,
      headers: config.headers,
      body: config.body
    };

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retry.attempts; attempt++) {
      try {
        if (this.debug) {
          console.log(`[FHIR R4 Client] ${config.method} ${url} (attempt ${attempt})`);
        }

        const response = await fetch(url, requestInit);
        const body = await response.text();
        
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}\n${body}`);
        }

        if (this.debug) {
          console.log(`[FHIR R4 Client] Response ${response.status} for ${config.method} ${url}`);
        }

        return {
          body,
          status: response.status,
          headers: responseHeaders
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < this.retry.attempts) {
          const delay = this.retry.delay * Math.pow(this.retry.backoff, attempt - 1);
          if (this.debug) {
            console.log(`[FHIR R4 Client] Request failed, retrying in ${delay}ms:`, lastError.message);
          }
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Request failed after all retry attempts');
  }

  /**
   * Handle and format errors
   */
  private handleError<T = any>(error: unknown): FHIRApiResponse<T> {
    let errorMessage = 'Unknown error';
    let operationOutcome: FHIROperationOutcome | undefined;

    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Try to parse FHIR OperationOutcome from error
      try {
        const errorBody = error.message.split('\n').slice(1).join('\n');
        if (errorBody.trim()) {
          const parsed = JSON.parse(errorBody);
          if (parsed.resourceType === 'OperationOutcome') {
            operationOutcome = parsed as FHIROperationOutcome;
          }
        }
      } catch {
        // Not a FHIR error response
      }
    }

    if (!operationOutcome) {
      operationOutcome = {
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'exception',
          diagnostics: errorMessage
        }]
      };
    }

    if (this.debug) {
      console.error('[FHIR R4 Client] Error:', errorMessage);
    }

    return {
      success: false,
      outcome: operationOutcome
    };
  }

  /**
   * Generate random state parameter for OAuth2
   */
  private generateState(): string {
    return Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  }

  // ============================================================================
  // Core FHIR Resource Methods
  // ============================================================================

  /**
   * Get FHIR server capabilities
   */
  async getCapabilities(): Promise<FHIRApiResponse<any>> {
    try {
      const response = await this.makeRequest({
        method: 'GET',
        url: `${this.baseUrl}/metadata`
      });

      return {
        success: true,
        data: JSON.parse(response.body),
        statusCode: response.status
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Create a FHIR resource
   */
  async createResource<T extends FHIRResource>(resource: T): Promise<FHIRApiResponse<T>> {
    await this.ensureValidToken();
    
    try {
      const response = await this.makeAuthenticatedRequest({
        method: 'POST',
        url: `${this.baseUrl}/${resource.resourceType}`,
        body: JSON.stringify(resource)
      });

      return {
        success: true,
        data: JSON.parse(response.body) as T,
        statusCode: response.status,
        headers: response.headers
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Get a FHIR resource by type and ID
   */
  async getResource<T extends FHIRResource>(resourceType: string, resourceId: string): Promise<FHIRApiResponse<T>> {
    await this.ensureValidToken();
    
    try {
      const response = await this.makeAuthenticatedRequest({
        method: 'GET',
        url: `${this.baseUrl}/${resourceType}/${resourceId}`
      });

      return {
        success: true,
        data: JSON.parse(response.body) as T,
        statusCode: response.status,
        headers: response.headers
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Update a FHIR resource
   */
  async updateResource<T extends FHIRResource>(resource: T): Promise<FHIRApiResponse<T>> {
    await this.ensureValidToken();
    
    if (!resource.id) {
      return this.handleError(new Error('Resource ID is required for update'));
    }

    try {
      const response = await this.makeAuthenticatedRequest({
        method: 'PUT',
        url: `${this.baseUrl}/${resource.resourceType}/${resource.id}`,
        body: JSON.stringify(resource)
      });

      return {
        success: true,
        data: JSON.parse(response.body) as T,
        statusCode: response.status,
        headers: response.headers
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Delete a FHIR resource
   */
  async deleteResource(resourceType: string, resourceId: string): Promise<FHIRApiResponse<any>> {
    await this.ensureValidToken();
    
    try {
      const response = await this.makeAuthenticatedRequest({
        method: 'DELETE',
        url: `${this.baseUrl}/${resourceType}/${resourceId}`
      });

      return {
        success: true,
        statusCode: response.status,
        headers: response.headers
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Search FHIR resources
   */
  async searchResources(resourceType: string, params: Record<string, string | string[]>): Promise<FHIRApiResponse<FHIRBundle>> {
    await this.ensureValidToken();
    
    try {
      const response = await this.makeAuthenticatedRequest({
        method: 'GET',
        url: `${this.baseUrl}/${resourceType}`,
        params
      });

      return {
        success: true,
        data: JSON.parse(response.body) as FHIRBundle,
        statusCode: response.status,
        headers: response.headers
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Submit a FHIR bundle (batch/transaction)
   */
  async submitBundle(bundle: FHIRBundle): Promise<FHIRApiResponse<FHIRBundle>> {
    await this.ensureValidToken();
    
    try {
      const response = await this.makeAuthenticatedRequest({
        method: 'POST',
        url: `${this.baseUrl}`,
        body: JSON.stringify(bundle)
      });

      return {
        success: true,
        data: JSON.parse(response.body) as FHIRBundle,
        statusCode: response.status,
        headers: response.headers
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Create or update a resource (upsert)
   */
  async createOrUpdateResource<T extends FHIRResource>(resource: T): Promise<FHIRApiResponse<T>> {
    if (resource.id) {
      // Try update first
      const updateResult = await this.updateResource(resource);
      if (updateResult.success) {
        return updateResult;
      }
    }
    
    // Fall back to create
    return this.createResource(resource);
  }

  // ============================================================================
  // Public Utility Methods
  // ============================================================================

  /**
   * Get patient context from current session
   */
  getPatientContext(): string | undefined {
    return this.patientContext;
  }

  /**
   * Check if client is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.accessToken && (!this.tokenExpiry || new Date() < this.tokenExpiry);
  }

  /**
   * Clear authentication
   */
  clearAuth(): void {
    this.accessToken = undefined;
    this.refreshToken = undefined;
    this.tokenExpiry = undefined;
    this.patientContext = undefined;
  }

  /**
   * Get base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}

export default FHIRR4Client;