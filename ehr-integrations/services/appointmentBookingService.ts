/**
 * Real-time Appointment Booking Service
 * 
 * Comprehensive service for managing appointment booking with real-time
 * availability checking, conflict resolution, and FHIR R4 integration.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { FHIRR4Client, SMARTOnFHIRConfig, OAuth2TokenResponse } from './fhirR4Client';
import {
  FHIRAppointment,
  FHIRSlot,
  FHIRBundle,
  FHIRPatient,
  FHIRPractitioner,
  FHIRSchedule,
  FHIRReference,
  FHIRCodeableConcept,
  FHIRAppointmentParticipant,
  FHIRAppointmentStatus,
  FHIRApiResponse,
  FHIRCreateAppointmentRequest,
  FHIRUpdateAppointmentRequest
} from '../types/fhir-r4';

/**
 * Appointment booking configuration
 */
export interface AppointmentBookingConfig {
  /** FHIR R4 client configuration */
  fhirConfig: {
    baseUrl: string;
    smartConfig?: SMARTOnFHIRConfig;
  };
  /** Real-time update configuration */
  realTimeConfig?: {
    /** Enable WebSocket for real-time updates */
    enableWebSocket?: boolean;
    /** WebSocket endpoint URL */
    wsEndpoint?: string;
    /** Polling interval in milliseconds if WebSocket not available */
    pollingInterval?: number;
    /** Maximum polling duration in milliseconds */
    maxPollingDuration?: number;
  };
  /** Booking constraints */
  constraints?: {
    /** Minimum advance booking time in minutes */
    minAdvanceBooking?: number;
    /** Maximum advance booking time in days */
    maxAdvanceBooking?: number;
    /** Allow overbooking */
    allowOverbooking?: boolean;
    /** Required participant types */
    requiredParticipants?: string[];
  };
  /** Notification settings */
  notifications?: {
    /** Enable email notifications */
    enableEmail?: boolean;
    /** Enable SMS notifications */
    enableSMS?: boolean;
    /** Custom notification endpoint */
    customEndpoint?: string;
  };
}

/**
 * Appointment slot availability
 */
export interface SlotAvailability {
  /** The slot resource */
  slot: FHIRSlot;
  /** Whether the slot is available */
  available: boolean;
  /** Reason if not available */
  unavailableReason?: string;
  /** Associated schedule */
  schedule?: FHIRSchedule;
  /** Associated practitioner */
  practitioner?: FHIRPractitioner;
  /** Duration in minutes */
  durationMinutes: number;
  /** Service types available */
  serviceTypes?: FHIRCodeableConcept[];
}

/**
 * Appointment booking request
 */
export interface AppointmentBookingRequest {
  /** Patient reference or resource */
  patient: FHIRReference | FHIRPatient;
  /** Practitioner reference (optional) */
  practitioner?: FHIRReference;
  /** Preferred start time */
  startTime: string;
  /** Duration in minutes */
  durationMinutes: number;
  /** Service type */
  serviceType?: FHIRCodeableConcept;
  /** Reason for appointment */
  reasonCode?: FHIRCodeableConcept[];
  /** Additional comments */
  comment?: string;
  /** Priority (1-10, where 1 is highest) */
  priority?: number;
  /** Allow alternative times if preferred not available */
  allowAlternatives?: boolean;
  /** Alternative time range in minutes */
  alternativeRange?: number;
}

/**
 * Appointment booking result
 */
export interface AppointmentBookingResult {
  /** Success status */
  success: boolean;
  /** Created appointment */
  appointment?: FHIRAppointment;
  /** Alternative slots if primary not available */
  alternatives?: SlotAvailability[];
  /** Error details */
  error?: {
    code: string;
    message: string;
    details?: string;
  };
  /** Booking confirmation details */
  confirmation?: {
    confirmationNumber: string;
    instructions?: string;
    nextSteps?: string[];
  };
}

/**
 * Real-time update event
 */
export interface RealTimeUpdateEvent {
  /** Event type */
  type: 'slot_updated' | 'appointment_created' | 'appointment_updated' | 'appointment_cancelled';
  /** Event timestamp */
  timestamp: string;
  /** Resource ID that changed */
  resourceId: string;
  /** Resource type */
  resourceType: 'Slot' | 'Appointment' | 'Schedule';
  /** Updated resource */
  resource?: FHIRSlot | FHIRAppointment | FHIRSchedule;
  /** Change details */
  changes?: {
    field: string;
    oldValue?: any;
    newValue?: any;
  }[];
}

/**
 * Event listener for real-time updates
 */
export type RealTimeEventListener = (event: RealTimeUpdateEvent) => void;

/**
 * Real-time Appointment Booking Service
 */
export class AppointmentBookingService {
  private fhirClient: FHIRR4Client;
  private config: AppointmentBookingConfig;
  private eventListeners: Map<string, RealTimeEventListener[]> = new Map();
  private wsConnection?: WebSocket;
  private pollingInterval?: NodeJS.Timeout;
  private isConnected = false;

  constructor(config: AppointmentBookingConfig) {
    this.config = config;
    this.fhirClient = new FHIRR4Client({
      baseUrl: config.fhirConfig.baseUrl,
      smartConfig: config.fhirConfig.smartConfig,
      debug: true
    });

    this.initializeEventListeners();
  }

  // ============================================================================
  // Authentication and Initialization
  // ============================================================================

  /**
   * Initialize SMART on FHIR authentication
   */
  async initialize(): Promise<void> {
    if (this.config.fhirConfig.smartConfig) {
      // Discover SMART capabilities
      try {
        const capabilities = await this.fhirClient.discoverCapabilities();
        console.log('[Appointment Service] SMART capabilities discovered:', capabilities);
      } catch (error) {
        console.warn('[Appointment Service] Could not discover SMART capabilities:', error);
      }
    }

    // Initialize real-time updates
    if (this.config.realTimeConfig?.enableWebSocket) {
      await this.initializeWebSocket();
    } else if (this.config.realTimeConfig?.pollingInterval) {
      this.initializePolling();
    }
  }

  /**
   * Authenticate with SMART on FHIR
   */
  async authenticate(code?: string, state?: string): Promise<OAuth2TokenResponse | string> {
    if (!this.config.fhirConfig.smartConfig) {
      throw new Error('SMART configuration not provided');
    }

    if (code) {
      // Exchange code for token
      return await this.fhirClient.exchangeCodeForToken(code, state);
    } else {
      // Return authorization URL
      return this.fhirClient.getAuthorizationUrl();
    }
  }

  /**
   * Set access token manually
   */
  setAccessToken(token: string, expiresIn?: number): void {
    this.fhirClient.setAccessToken(token, expiresIn);
  }

  // ============================================================================
  // Slot Availability Methods
  // ============================================================================

  /**
   * Get available slots for a date range
   */
  async getAvailableSlots(
    startDate: string,
    endDate: string,
    serviceType?: string,
    practitionerId?: string
  ): Promise<SlotAvailability[]> {
    try {
      const response = await this.fhirClient.getAvailableSlots(
        startDate,
        endDate,
        serviceType,
        practitionerId
      );

      if (!response.success || !response.data) {
        throw new Error('Failed to fetch available slots');
      }

      const slots: SlotAvailability[] = [];
      
      if (response.data.entry) {
        for (const entry of response.data.entry) {
          if (entry.resource?.resourceType === 'Slot') {
            const slot = entry.resource as FHIRSlot;
            const availability = await this.evaluateSlotAvailability(slot);
            slots.push(availability);
          }
        }
      }

      return slots.filter(slot => slot.available);
    } catch (error) {
      console.error('[Appointment Service] Error fetching available slots:', error);
      return [];
    }
  }

  /**
   * Evaluate if a slot is available for booking
   */
  private async evaluateSlotAvailability(slot: FHIRSlot): Promise<SlotAvailability> {
    const availability: SlotAvailability = {
      slot,
      available: slot.status === 'free',
      durationMinutes: this.calculateSlotDuration(slot)
    };

    // Check constraints
    if (this.config.constraints) {
      const now = new Date();
      const slotStart = new Date(slot.start);
      
      // Check minimum advance booking
      if (this.config.constraints.minAdvanceBooking) {
        const minTime = new Date(now.getTime() + this.config.constraints.minAdvanceBooking * 60000);
        if (slotStart < minTime) {
          availability.available = false;
          availability.unavailableReason = 'Insufficient advance notice required';
        }
      }
      
      // Check maximum advance booking
      if (this.config.constraints.maxAdvanceBooking) {
        const maxTime = new Date(now.getTime() + this.config.constraints.maxAdvanceBooking * 24 * 60 * 60000);
        if (slotStart > maxTime) {
          availability.available = false;
          availability.unavailableReason = 'Too far in advance';
        }
      }
    }

    // Check for conflicts
    if (availability.available) {
      const hasConflict = await this.checkSlotConflicts(slot);
      if (hasConflict) {
        availability.available = false;
        availability.unavailableReason = 'Scheduling conflict detected';
      }
    }

    return availability;
  }

  /**
   * Check for scheduling conflicts
   */
  private async checkSlotConflicts(slot: FHIRSlot): Promise<boolean> {
    try {
      // Search for existing appointments that overlap with this slot
      const response = await this.fhirClient.searchAppointments({
        date: `ge${slot.start}`,
        status: ['booked', 'arrived', 'fulfilled'],
        _count: 100
      });

      if (!response.success || !response.data?.entry) {
        return false;
      }

      const slotStart = new Date(slot.start);
      const slotEnd = new Date(slot.end);

      for (const entry of response.data.entry) {
        if (entry.resource?.resourceType === 'Appointment') {
          const appointment = entry.resource as FHIRAppointment;
          
          if (appointment.start && appointment.end) {
            const appointmentStart = new Date(appointment.start);
            const appointmentEnd = new Date(appointment.end);
            
            // Check for overlap
            if (appointmentStart < slotEnd && appointmentEnd > slotStart) {
              return true; // Conflict found
            }
          }
        }
      }

      return false;
    } catch (error) {
      console.error('[Appointment Service] Error checking conflicts:', error);
      return true; // Assume conflict if we can't check
    }
  }

  /**
   * Calculate slot duration in minutes
   */
  private calculateSlotDuration(slot: FHIRSlot): number {
    const start = new Date(slot.start);
    const end = new Date(slot.end);
    return Math.round((end.getTime() - start.getTime()) / 60000);
  }

  // ============================================================================
  // Appointment Booking Methods
  // ============================================================================

  /**
   * Book an appointment
   */
  async bookAppointment(request: AppointmentBookingRequest): Promise<AppointmentBookingResult> {
    try {
      // Validate request
      const validationError = this.validateBookingRequest(request);
      if (validationError) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validationError
          }
        };
      }

      // Find available slot
      const slot = await this.findBestSlot(request);
      if (!slot) {
        const alternatives = await this.findAlternativeSlots(request);
        return {
          success: false,
          alternatives,
          error: {
            code: 'NO_AVAILABLE_SLOTS',
            message: 'No available slots found for the requested time'
          }
        };
      }

      // Create appointment
      const appointment = await this.createAppointmentFromRequest(request, slot);
      const createResponse = await this.fhirClient.createAppointment({
        appointment
      });

      if (!createResponse.success || !createResponse.data) {
        return {
          success: false,
          error: {
            code: 'CREATE_FAILED',
            message: 'Failed to create appointment',
            details: createResponse.outcome?.issue?.[0]?.diagnostics
          }
        };
      }

      // Generate confirmation
      const confirmation = this.generateConfirmation(createResponse.data);

      // Send notifications
      await this.sendNotifications(createResponse.data);

      // Emit real-time event
      this.emitEvent('appointment_created', {
        type: 'appointment_created',
        timestamp: new Date().toISOString(),
        resourceId: createResponse.data.id!,
        resourceType: 'Appointment',
        resource: createResponse.data
      });

      return {
        success: true,
        appointment: createResponse.data,
        confirmation
      };

    } catch (error) {
      console.error('[Appointment Service] Booking error:', error);
      return {
        success: false,
        error: {
          code: 'BOOKING_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        }
      };
    }
  }

  /**
   * Update an existing appointment
   */
  async updateAppointment(
    appointmentId: string,
    updates: Partial<FHIRAppointment>
  ): Promise<AppointmentBookingResult> {
    try {
      // Get current appointment
      const currentResponse = await this.fhirClient.getAppointment(appointmentId);
      if (!currentResponse.success || !currentResponse.data) {
        return {
          success: false,
          error: {
            code: 'APPOINTMENT_NOT_FOUND',
            message: 'Appointment not found'
          }
        };
      }

      // Merge updates
      const updatedAppointment: FHIRAppointment = {
        ...currentResponse.data,
        ...updates,
        id: appointmentId // Ensure ID doesn't change
      };

      // Validate update
      if (updates.start || updates.end) {
        // Check availability for new time
        const hasConflict = await this.checkTimeConflict(updatedAppointment);
        if (hasConflict) {
          return {
            success: false,
            error: {
              code: 'TIME_CONFLICT',
              message: 'New appointment time conflicts with existing appointments'
            }
          };
        }
      }

      // Update appointment
      const updateResponse = await this.fhirClient.updateAppointment({
        id: appointmentId,
        appointment: updatedAppointment
      });

      if (!updateResponse.success || !updateResponse.data) {
        return {
          success: false,
          error: {
            code: 'UPDATE_FAILED',
            message: 'Failed to update appointment',
            details: updateResponse.outcome?.issue?.[0]?.diagnostics
          }
        };
      }

      // Send notifications for significant changes
      if (updates.start || updates.end || updates.status) {
        await this.sendNotifications(updateResponse.data);
      }

      // Emit real-time event
      this.emitEvent('appointment_updated', {
        type: 'appointment_updated',
        timestamp: new Date().toISOString(),
        resourceId: appointmentId,
        resourceType: 'Appointment',
        resource: updateResponse.data
      });

      return {
        success: true,
        appointment: updateResponse.data
      };

    } catch (error) {
      console.error('[Appointment Service] Update error:', error);
      return {
        success: false,
        error: {
          code: 'UPDATE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        }
      };
    }
  }

  /**
   * Cancel an appointment
   */
  async cancelAppointment(appointmentId: string, reason?: string): Promise<AppointmentBookingResult> {
    try {
      const cancelResponse = await this.fhirClient.cancelAppointment(appointmentId, reason);
      
      if (!cancelResponse.success || !cancelResponse.data) {
        return {
          success: false,
          error: {
            code: 'CANCEL_FAILED',
            message: 'Failed to cancel appointment',
            details: cancelResponse.outcome?.issue?.[0]?.diagnostics
          }
        };
      }

      // Send cancellation notifications
      await this.sendNotifications(cancelResponse.data);

      // Emit real-time event
      this.emitEvent('appointment_cancelled', {
        type: 'appointment_cancelled',
        timestamp: new Date().toISOString(),
        resourceId: appointmentId,
        resourceType: 'Appointment',
        resource: cancelResponse.data
      });

      return {
        success: true,
        appointment: cancelResponse.data
      };

    } catch (error) {
      console.error('[Appointment Service] Cancel error:', error);
      return {
        success: false,
        error: {
          code: 'CANCEL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        }
      };
    }
  }

  // ============================================================================
  // Real-time Update Methods
  // ============================================================================

  /**
   * Add event listener for real-time updates
   */
  addEventListener(eventType: string, listener: RealTimeEventListener): void {
    const listeners = this.eventListeners.get(eventType) || [];
    listeners.push(listener);
    this.eventListeners.set(eventType, listeners);
  }

  /**
   * Remove event listener
   */
  removeEventListener(eventType: string, listener: RealTimeEventListener): void {
    const listeners = this.eventListeners.get(eventType) || [];
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
      this.eventListeners.set(eventType, listeners);
    }
  }

  /**
   * Emit event to listeners
   */
  private emitEvent(eventType: string, event: RealTimeUpdateEvent): void {
    const listeners = this.eventListeners.get(eventType) || [];
    listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[Appointment Service] Event listener error:', error);
      }
    });

    // Also emit to 'all' listeners
    const allListeners = this.eventListeners.get('all') || [];
    allListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[Appointment Service] All event listener error:', error);
      }
    });
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Initialize event listener maps
   */
  private initializeEventListeners(): void {
    this.eventListeners.set('slot_updated', []);
    this.eventListeners.set('appointment_created', []);
    this.eventListeners.set('appointment_updated', []);
    this.eventListeners.set('appointment_cancelled', []);
    this.eventListeners.set('all', []);
  }

  /**
   * Initialize WebSocket connection for real-time updates
   */
  private async initializeWebSocket(): Promise<void> {
    if (!this.config.realTimeConfig?.wsEndpoint) {
      console.warn('[Appointment Service] WebSocket endpoint not configured');
      return;
    }

    try {
      this.wsConnection = new WebSocket(this.config.realTimeConfig.wsEndpoint);
      
      this.wsConnection.onopen = () => {
        console.log('[Appointment Service] WebSocket connected');
        this.isConnected = true;
      };

      this.wsConnection.onmessage = (event) => {
        try {
          const updateEvent: RealTimeUpdateEvent = JSON.parse(event.data);
          this.emitEvent(updateEvent.type, updateEvent);
        } catch (error) {
          console.error('[Appointment Service] WebSocket message error:', error);
        }
      };

      this.wsConnection.onclose = () => {
        console.log('[Appointment Service] WebSocket disconnected');
        this.isConnected = false;
        // Attempt to reconnect after delay
        setTimeout(() => this.initializeWebSocket(), 5000);
      };

      this.wsConnection.onerror = (error) => {
        console.error('[Appointment Service] WebSocket error:', error);
      };

    } catch (error) {
      console.error('[Appointment Service] WebSocket initialization error:', error);
    }
  }

  /**
   * Initialize polling for updates
   */
  private initializePolling(): void {
    if (!this.config.realTimeConfig?.pollingInterval) {
      return;
    }

    this.pollingInterval = setInterval(async () => {
      try {
        await this.pollForUpdates();
      } catch (error) {
        console.error('[Appointment Service] Polling error:', error);
      }
    }, this.config.realTimeConfig.pollingInterval);
  }

  /**
   * Poll for updates (fallback when WebSocket not available)
   */
  private async pollForUpdates(): Promise<void> {
    // Implementation would check for recent changes
    // This is a simplified version
    const lastHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    try {
      const response = await this.fhirClient.searchAppointments({
        _lastUpdated: `ge${lastHour}`,
        _count: 100
      });

      if (response.success && response.data?.entry) {
        for (const entry of response.data.entry) {
          if (entry.resource?.resourceType === 'Appointment') {
            // Emit update event for changed appointments
            this.emitEvent('appointment_updated', {
              type: 'appointment_updated',
              timestamp: new Date().toISOString(),
              resourceId: entry.resource.id!,
              resourceType: 'Appointment',
              resource: entry.resource as FHIRAppointment
            });
          }
        }
      }
    } catch (error) {
      console.error('[Appointment Service] Polling error:', error);
    }
  }

  /**
   * Validate booking request
   */
  private validateBookingRequest(request: AppointmentBookingRequest): string | null {
    if (!request.patient) {
      return 'Patient is required';
    }

    if (!request.startTime) {
      return 'Start time is required';
    }

    if (!request.durationMinutes || request.durationMinutes <= 0) {
      return 'Valid duration is required';
    }

    const startTime = new Date(request.startTime);
    if (isNaN(startTime.getTime())) {
      return 'Invalid start time format';
    }

    const now = new Date();
    if (startTime <= now) {
      return 'Start time must be in the future';
    }

    return null;
  }

  /**
   * Find best available slot for request
   */
  private async findBestSlot(request: AppointmentBookingRequest): Promise<SlotAvailability | null> {
    const endTime = new Date(new Date(request.startTime).getTime() + request.durationMinutes * 60000).toISOString();
    
    const slots = await this.getAvailableSlots(
      request.startTime,
      endTime,
      request.serviceType?.text,
      request.practitioner?.reference
    );

    return slots.find(slot => slot.available) || null;
  }

  /**
   * Find alternative slots if preferred time not available
   */
  private async findAlternativeSlots(request: AppointmentBookingRequest): Promise<SlotAvailability[]> {
    if (!request.allowAlternatives || !request.alternativeRange) {
      return [];
    }

    const originalStart = new Date(request.startTime);
    const rangeMs = request.alternativeRange * 60000;
    
    const searchStart = new Date(originalStart.getTime() - rangeMs).toISOString();
    const searchEnd = new Date(originalStart.getTime() + rangeMs).toISOString();

    return await this.getAvailableSlots(
      searchStart,
      searchEnd,
      request.serviceType?.text,
      request.practitioner?.reference
    );
  }

  /**
   * Create appointment resource from booking request
   */
  private async createAppointmentFromRequest(
    request: AppointmentBookingRequest,
    slot: SlotAvailability
  ): Promise<FHIRAppointment> {
    const endTime = new Date(new Date(request.startTime).getTime() + request.durationMinutes * 60000).toISOString();

    const participants: FHIRAppointmentParticipant[] = [
      {
        actor: typeof request.patient === 'object' && 'id' in request.patient 
          ? { reference: `Patient/${request.patient.id}` }
          : request.patient as FHIRReference,
        status: 'accepted',
        required: 'required'
      }
    ];

    if (request.practitioner) {
      participants.push({
        actor: request.practitioner,
        status: 'accepted',
        required: 'required'
      });
    }

    const appointment: FHIRAppointment = {
      resourceType: 'Appointment',
      status: 'booked',
      start: request.startTime,
      end: endTime,
      minutesDuration: request.durationMinutes,
      participant: participants,
      slot: [{ reference: `Slot/${slot.slot.id}` }]
    };

    if (request.serviceType) {
      appointment.serviceType = [request.serviceType];
    }

    if (request.reasonCode) {
      appointment.reasonCode = request.reasonCode;
    }

    if (request.comment) {
      appointment.comment = request.comment;
    }

    if (request.priority) {
      appointment.priority = request.priority;
    }

    return appointment;
  }

  /**
   * Check for time conflicts with new appointment time
   */
  private async checkTimeConflict(appointment: FHIRAppointment): Promise<boolean> {
    if (!appointment.start || !appointment.end) {
      return false;
    }

    // Implementation would check for conflicts similar to checkSlotConflicts
    return false; // Simplified for now
  }

  /**
   * Generate confirmation details
   */
  private generateConfirmation(appointment: FHIRAppointment): { confirmationNumber: string; instructions?: string; nextSteps?: string[] } {
    return {
      confirmationNumber: `APT-${appointment.id}-${Date.now().toString().slice(-6)}`,
      instructions: 'Please arrive 15 minutes before your appointment time.',
      nextSteps: [
        'You will receive a reminder 24 hours before your appointment',
        'Bring a valid ID and insurance card',
        'Complete any required forms online before your visit'
      ]
    };
  }

  /**
   * Send notifications for appointment changes
   */
  private async sendNotifications(appointment: FHIRAppointment): Promise<void> {
    if (!this.config.notifications) {
      return;
    }

    try {
      // Implementation would send actual notifications
      console.log(`[Appointment Service] Sending notifications for appointment ${appointment.id}`);
      
      if (this.config.notifications.enableEmail) {
        // Send email notification
      }
      
      if (this.config.notifications.enableSMS) {
        // Send SMS notification
      }
      
      if (this.config.notifications.customEndpoint) {
        // Call custom notification endpoint
      }
    } catch (error) {
      console.error('[Appointment Service] Notification error:', error);
    }
  }

  // ============================================================================
  // Cleanup Methods
  // ============================================================================

  /**
   * Disconnect and cleanup resources
   */
  disconnect(): void {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = undefined;
    }

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }

    this.isConnected = false;
    this.eventListeners.clear();
  }

  /**
   * Get connection status
   */
  isConnectedToRealTime(): boolean {
    return this.isConnected;
  }
}

export default AppointmentBookingService;