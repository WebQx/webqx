/**
 * EHR Integration Service
 * 
 * Core service for managing EHR system interactions with comprehensive
 * error handling, logging, and state management.
 * 
 * This service provides:
 * - Standardized error handling with user-friendly messages
 * - Detailed operation logging for audit and debugging
 * - Loading state management for better UX
 * - Type-safe operations with full TypeScript support
 */

import {
  EHRError,
  EHRResult,
  LoadingState,
  Patient,
  Provider,
  Appointment,
  IntakeForm,
  EHRLogEntry
} from '../types';

/**
 * EHR Service configuration interface
 */
export interface EHRServiceConfig {
  /** API endpoint base URL */
  baseUrl: string;
  /** API authentication token */
  authToken: string;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Enable detailed logging */
  enableLogging: boolean;
  /** Retry attempts for failed requests */
  retryAttempts: number;
}

/**
 * EHR Integration Service Class
 * 
 * Provides centralized access to EHR system operations with
 * built-in error handling, logging, and state management.
 */
export class EHRService {
  private config: EHRServiceConfig;
  private logEntries: EHRLogEntry[] = [];

  /**
   * Initialize EHR Service with configuration
   * 
   * @param config - Service configuration options
   */
  constructor(config: EHRServiceConfig) {
    this.config = config;
    this.log('service_initialization', true, 0, {
      baseUrl: config.baseUrl,
      enableLogging: config.enableLogging,
      timeout: config.timeout
    });
  }

  /**
   * Create standardized error object
   * 
   * @param code - Error code for programmatic handling
   * @param message - Human-readable error message
   * @param operation - Operation that caused the error
   * @param details - Additional error details
   * @returns Standardized EHR error object
   */
  private createError(
    code: string,
    message: string,
    operation: string,
    details?: Record<string, any>
  ): EHRError {
    return {
      code,
      message,
      operation,
      details,
      timestamp: new Date()
    };
  }

  /**
   * Log EHR operation for audit and debugging
   * 
   * @param operation - Operation type
   * @param success - Whether operation succeeded
   * @param duration - Operation duration in milliseconds
   * @param metadata - Additional operation metadata
   * @param error - Error details if operation failed
   * @param userId - User who performed the operation
   * @param patientId - Patient ID if applicable
   */
  private log(
    operation: string,
    success: boolean,
    duration: number,
    metadata?: Record<string, any>,
    error?: EHRError,
    userId?: string,
    patientId?: string
  ): void {
    if (!this.config.enableLogging) return;

    const logEntry: EHRLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      operation,
      success,
      duration,
      userId,
      patientId,
      error,
      metadata
    };

    this.logEntries.push(logEntry);

    // In a real implementation, this would send logs to a logging service
    console.log(`[EHR Service] ${operation}: ${success ? 'SUCCESS' : 'FAILURE'}`, {
      duration: `${duration}ms`,
      userId,
      patientId,
      error: error?.message,
      metadata
    });
  }

  /**
   * Simulate API request with error handling and retries
   * 
   * @param endpoint - API endpoint to call
   * @param method - HTTP method
   * @param data - Request payload
   * @param operation - Operation name for logging
   * @param userId - User performing the operation
   * @returns Promise with result wrapper
   */
  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    data?: any,
    operation: string = 'api_request',
    userId?: string
  ): Promise<EHRResult<T>> {
    const startTime = Date.now();
    let lastError: EHRError | undefined;

    // Simulate loading state
    const loadingState: LoadingState = {
      isLoading: true,
      message: `Processing ${operation}...`
    };

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));

        // Simulate occasional failures for demonstration
        const failureRate = 0.1; // 10% failure rate
        if (Math.random() < failureRate) {
          throw new Error('Simulated network error');
        }

        // Simulate successful response
        const mockData = this.generateMockData<T>(endpoint, method, data);
        const duration = Date.now() - startTime;

        this.log(operation, true, duration, {
          endpoint,
          method,
          attempt,
          dataSize: JSON.stringify(data || {}).length
        }, undefined, userId);

        return {
          success: true,
          data: mockData,
          loading: { isLoading: false },
          metadata: {
            endpoint,
            method,
            attempt,
            duration
          }
        };

      } catch (error) {
        const duration = Date.now() - startTime;
        lastError = this.createError(
          'API_REQUEST_FAILED',
          `Failed to ${operation}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          operation,
          {
            endpoint,
            method,
            attempt,
            maxAttempts: this.config.retryAttempts
          }
        );

        this.log(operation, false, duration, {
          endpoint,
          method,
          attempt,
          maxAttempts: this.config.retryAttempts
        }, lastError, userId);

        // If this was the last attempt, return the error
        if (attempt === this.config.retryAttempts) {
          break;
        }

        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      }
    }

    return {
      success: false,
      error: lastError,
      loading: { isLoading: false },
      metadata: {
        endpoint,
        method,
        totalAttempts: this.config.retryAttempts
      }
    };
  }

  /**
   * Generate mock data for demonstration purposes
   * In a real implementation, this would be actual API responses
   */
  private generateMockData<T>(endpoint: string, method: string, data?: any): T {
    // This is a simplified mock data generator
    // In reality, this would be actual API responses
    if (endpoint.includes('patients')) {
      return {
        id: 'patient_123',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: new Date('1980-01-01'),
        mrn: 'MRN123456'
      } as unknown as T;
    }

    return {} as T;
  }

  /**
   * Fetch patient information by ID
   * 
   * @param patientId - Unique patient identifier
   * @param userId - User requesting the information
   * @returns Promise with patient data result
   */
  async getPatient(patientId: string, userId?: string): Promise<EHRResult<Patient>> {
    if (!patientId?.trim()) {
      const error = this.createError(
        'INVALID_PATIENT_ID',
        'Patient ID is required and cannot be empty',
        'get_patient'
      );

      this.log('get_patient', false, 0, { patientId }, error, userId);

      return {
        success: false,
        error,
        loading: { isLoading: false }
      };
    }

    return this.makeRequest<Patient>(
      `/patients/${patientId}`,
      'GET',
      undefined,
      'get_patient',
      userId
    );
  }

  /**
   * Create new patient record
   * 
   * @param patientData - Patient information to create
   * @param userId - User creating the patient
   * @returns Promise with created patient result
   */
  async createPatient(patientData: Omit<Patient, 'id'>, userId?: string): Promise<EHRResult<Patient>> {
    // Validate required fields
    const requiredFields = ['firstName', 'lastName', 'dateOfBirth', 'mrn'];
    const missingFields = requiredFields.filter(field => !patientData[field as keyof typeof patientData]);

    if (missingFields.length > 0) {
      const error = this.createError(
        'MISSING_REQUIRED_FIELDS',
        `Missing required fields: ${missingFields.join(', ')}`,
        'create_patient',
        { missingFields, providedData: Object.keys(patientData) }
      );

      this.log('create_patient', false, 0, { missingFields }, error, userId);

      return {
        success: false,
        error,
        loading: { isLoading: false }
      };
    }

    return this.makeRequest<Patient>(
      '/patients',
      'POST',
      patientData,
      'create_patient',
      userId
    );
  }

  /**
   * Update existing patient record
   * 
   * @param patientId - Patient ID to update
   * @param updates - Patient data updates
   * @param userId - User performing the update
   * @returns Promise with updated patient result
   */
  async updatePatient(
    patientId: string,
    updates: Partial<Patient>,
    userId?: string
  ): Promise<EHRResult<Patient>> {
    if (!patientId?.trim()) {
      const error = this.createError(
        'INVALID_PATIENT_ID',
        'Patient ID is required for updates',
        'update_patient'
      );

      this.log('update_patient', false, 0, { patientId, updates }, error, userId, patientId);

      return {
        success: false,
        error,
        loading: { isLoading: false }
      };
    }

    if (!updates || Object.keys(updates).length === 0) {
      const error = this.createError(
        'NO_UPDATES_PROVIDED',
        'No update data provided',
        'update_patient'
      );

      this.log('update_patient', false, 0, { patientId, updates }, error, userId, patientId);

      return {
        success: false,
        error,
        loading: { isLoading: false }
      };
    }

    return this.makeRequest<Patient>(
      `/patients/${patientId}`,
      'PUT',
      updates,
      'update_patient',
      userId
    );
  }

  /**
   * Submit intake form for a patient
   * 
   * @param intakeForm - Intake form data to submit
   * @param userId - User submitting the form
   * @returns Promise with submission result
   */
  async submitIntakeForm(intakeForm: IntakeForm, userId?: string): Promise<EHRResult<IntakeForm>> {
    // Validate intake form data
    if (!intakeForm.patientId?.trim()) {
      const error = this.createError(
        'INVALID_PATIENT_ID',
        'Patient ID is required for intake form submission',
        'submit_intake_form'
      );

      this.log('submit_intake_form', false, 0, { formId: intakeForm.id }, error, userId, intakeForm.patientId);

      return {
        success: false,
        error,
        loading: { isLoading: false }
      };
    }

    if (!intakeForm.data?.chiefComplaint?.trim()) {
      const error = this.createError(
        'MISSING_CHIEF_COMPLAINT',
        'Chief complaint is required for intake form submission',
        'submit_intake_form'
      );

      this.log('submit_intake_form', false, 0, { formId: intakeForm.id }, error, userId, intakeForm.patientId);

      return {
        success: false,
        error,
        loading: { isLoading: false }
      };
    }

    return this.makeRequest<IntakeForm>(
      '/intake-forms',
      'POST',
      intakeForm,
      'submit_intake_form',
      userId
    );
  }

  /**
   * Schedule new appointment
   * 
   * @param appointment - Appointment data to schedule
   * @param userId - User scheduling the appointment
   * @returns Promise with scheduled appointment result
   */
  async scheduleAppointment(appointment: Omit<Appointment, 'id'>, userId?: string): Promise<EHRResult<Appointment>> {
    // Validate appointment data
    const requiredFields = ['patientId', 'providerId', 'dateTime', 'duration', 'reason'];
    const missingFields = requiredFields.filter(field => !appointment[field as keyof typeof appointment]);

    if (missingFields.length > 0) {
      const error = this.createError(
        'MISSING_REQUIRED_FIELDS',
        `Missing required fields for appointment: ${missingFields.join(', ')}`,
        'schedule_appointment',
        { missingFields }
      );

      this.log('schedule_appointment', false, 0, { missingFields }, error, userId, appointment.patientId);

      return {
        success: false,
        error,
        loading: { isLoading: false }
      };
    }

    // Validate appointment time is in the future
    if (new Date(appointment.dateTime) <= new Date()) {
      const error = this.createError(
        'INVALID_APPOINTMENT_TIME',
        'Appointment time must be in the future',
        'schedule_appointment'
      );

      this.log('schedule_appointment', false, 0, { appointmentTime: appointment.dateTime }, error, userId, appointment.patientId);

      return {
        success: false,
        error,
        loading: { isLoading: false }
      };
    }

    return this.makeRequest<Appointment>(
      '/appointments',
      'POST',
      appointment,
      'schedule_appointment',
      userId
    );
  }

  /**
   * Get audit log entries for operations
   * 
   * @param limit - Maximum number of entries to return
   * @param operation - Filter by specific operation type
   * @returns Array of log entries
   */
  getAuditLog(limit: number = 100, operation?: string): EHRLogEntry[] {
    let entries = [...this.logEntries];

    if (operation) {
      entries = entries.filter(entry => entry.operation === operation);
    }

    return entries
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get service health status
   * 
   * @returns Service health information
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    totalOperations: number;
    successRate: number;
    averageResponseTime: number;
    lastError?: EHRError;
  } {
    const totalOps = this.logEntries.length;
    const successfulOps = this.logEntries.filter(entry => entry.success).length;
    const successRate = totalOps > 0 ? (successfulOps / totalOps) * 100 : 100;
    
    const responseTimes = this.logEntries
      .filter(entry => entry.success)
      .map(entry => entry.duration);
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;

    const lastError = this.logEntries
      .filter(entry => !entry.success)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]?.error;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (successRate < 95) status = 'degraded';
    if (successRate < 80) status = 'unhealthy';

    return {
      status,
      totalOperations: totalOps,
      successRate: Math.round(successRate * 100) / 100,
      averageResponseTime: Math.round(averageResponseTime * 100) / 100,
      lastError
    };
  }
}

/**
 * Default EHR service configuration
 */
export const DEFAULT_EHR_CONFIG: EHRServiceConfig = {
  baseUrl: process.env.EHR_API_URL || 'https://api.ehr.example.com/v1',
  authToken: process.env.EHR_AUTH_TOKEN || 'demo-token',
  timeout: 30000, // 30 seconds
  enableLogging: true,
  retryAttempts: 3
};

/**
 * Singleton EHR service instance
 */
export const ehrService = new EHRService(DEFAULT_EHR_CONFIG);