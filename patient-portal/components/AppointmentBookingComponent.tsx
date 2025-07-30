/**
 * Interactive Appointment Booking Component
 * 
 * React component for booking appointments with real-time availability,
 * FHIR R4 integration, and comprehensive accessibility support.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AppointmentBookingService,
  AppointmentBookingConfig,
  AppointmentBookingRequest,
  AppointmentBookingResult,
  SlotAvailability,
  RealTimeUpdateEvent
} from '../../services/appointmentBookingService';
import {
  FHIRAppointment,
  FHIRCodeableConcept,
  FHIRReference,
  FHIRPatient
} from '../../types/fhir-r4';

/**
 * Component props interface
 */
export interface AppointmentBookingComponentProps {
  /** Booking service configuration */
  config: AppointmentBookingConfig;
  /** Patient information */
  patient?: FHIRPatient;
  /** Available service types */
  serviceTypes?: FHIRCodeableConcept[];
  /** Available practitioners */
  practitioners?: Array<{
    id: string;
    name: string;
    specialty?: string;
    photo?: string;
  }>;
  /** Callback when appointment is booked */
  onAppointmentBooked?: (appointment: FHIRAppointment) => void;
  /** Callback when booking fails */
  onBookingError?: (error: { code: string; message: string }) => void;
  /** Custom CSS class */
  className?: string;
  /** Component ID for accessibility */
  id?: string;
  /** Theme configuration */
  theme?: {
    primaryColor?: string;
    secondaryColor?: string;
    borderRadius?: string;
    fontFamily?: string;
  };
  /** Initial date for calendar */
  initialDate?: Date;
  /** Minimum selectable date */
  minDate?: Date;
  /** Maximum selectable date */
  maxDate?: Date;
}

/**
 * Booking step types
 */
type BookingStep = 'service' | 'practitioner' | 'datetime' | 'confirmation' | 'complete';

/**
 * Time slot interface
 */
interface TimeSlot {
  time: string;
  available: boolean;
  slot?: SlotAvailability;
  reason?: string;
}

/**
 * Interactive Appointment Booking Component
 */
export const AppointmentBookingComponent: React.FC<AppointmentBookingComponentProps> = ({
  config,
  patient,
  serviceTypes = [],
  practitioners = [],
  onAppointmentBooked,
  onBookingError,
  className = '',
  id = 'appointment-booking',
  theme = {},
  initialDate = new Date(),
  minDate = new Date(),
  maxDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days from now
}) => {
  // ============================================================================
  // State Management
  // ============================================================================

  const [currentStep, setCurrentStep] = useState<BookingStep>('service');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingService, setBookingService] = useState<AppointmentBookingService | null>(null);
  
  // Booking form state
  const [selectedService, setSelectedService] = useState<FHIRCodeableConcept | null>(null);
  const [selectedPractitioner, setSelectedPractitioner] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SlotAvailability | null>(null);
  const [duration, setDuration] = useState<number>(30);
  const [appointmentReason, setAppointmentReason] = useState<string>('');
  const [additionalComments, setAdditionalComments] = useState<string>('');
  
  // Availability state
  const [availableSlots, setAvailableSlots] = useState<SlotAvailability[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  
  // Booking result state
  const [bookingResult, setBookingResult] = useState<AppointmentBookingResult | null>(null);
  const [showAlternatives, setShowAlternatives] = useState(false);

  // Refs for accessibility
  const alertRef = useRef<HTMLDivElement>(null);
  const stepHeaderRef = useRef<HTMLDivElement>(null);

  // ============================================================================
  // Effects
  // ============================================================================

  /**
   * Initialize booking service
   */
  useEffect(() => {
    const initializeService = async () => {
      try {
        setLoading(true);
        const service = new AppointmentBookingService(config);
        await service.initialize();
        
        // Set up real-time event listeners
        service.addEventListener('slot_updated', handleSlotUpdate);
        service.addEventListener('appointment_created', handleAppointmentCreated);
        
        setBookingService(service);
        announceToScreenReader('Appointment booking system initialized');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to initialize booking service';
        setError(errorMessage);
        onBookingError?.({ code: 'INIT_ERROR', message: errorMessage });
      } finally {
        setLoading(false);
      }
    };

    initializeService();

    return () => {
      if (bookingService) {
        bookingService.disconnect();
      }
    };
  }, [config]);

  /**
   * Load available slots when date or practitioner changes
   */
  useEffect(() => {
    if (bookingService && selectedDate && currentStep === 'datetime') {
      loadAvailableSlots();
    }
  }, [bookingService, selectedDate, selectedPractitioner, selectedService]);

  /**
   * Focus management for accessibility
   */
  useEffect(() => {
    if (stepHeaderRef.current) {
      stepHeaderRef.current.focus();
    }
  }, [currentStep]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle real-time slot updates
   */
  const handleSlotUpdate = useCallback((event: RealTimeUpdateEvent) => {
    if (event.type === 'slot_updated' && event.resource) {
      // Refresh available slots if currently viewing them
      if (currentStep === 'datetime') {
        loadAvailableSlots();
      }
      announceToScreenReader('Available time slots have been updated');
    }
  }, [currentStep]);

  /**
   * Handle appointment creation events
   */
  const handleAppointmentCreated = useCallback((event: RealTimeUpdateEvent) => {
    if (event.type === 'appointment_created') {
      // Refresh slots as availability may have changed
      if (currentStep === 'datetime') {
        loadAvailableSlots();
      }
    }
  }, [currentStep]);

  /**
   * Handle service type selection
   */
  const handleServiceSelection = useCallback((service: FHIRCodeableConcept) => {
    setSelectedService(service);
    setError(null);
    
    // Set default duration based on service type
    if (service.text?.toLowerCase().includes('consultation')) {
      setDuration(30);
    } else if (service.text?.toLowerCase().includes('checkup')) {
      setDuration(45);
    } else if (service.text?.toLowerCase().includes('procedure')) {
      setDuration(60);
    }
    
    announceToScreenReader(`Selected service: ${service.text || service.coding?.[0]?.display || 'Unknown service'}`);
  }, []);

  /**
   * Handle practitioner selection
   */
  const handlePractitionerSelection = useCallback((practitionerId: string) => {
    setSelectedPractitioner(practitionerId);
    setError(null);
    
    const practitioner = practitioners.find(p => p.id === practitionerId);
    announceToScreenReader(`Selected practitioner: ${practitioner?.name || 'Unknown practitioner'}`);
  }, [practitioners]);

  /**
   * Handle date selection
   */
  const handleDateSelection = useCallback((date: Date) => {
    setSelectedDate(date);
    setSelectedTime(null);
    setSelectedSlot(null);
    setError(null);
    
    announceToScreenReader(`Selected date: ${date.toLocaleDateString()}`);
  }, []);

  /**
   * Handle time slot selection
   */
  const handleTimeSelection = useCallback((time: string, slot: SlotAvailability | null) => {
    setSelectedTime(time);
    setSelectedSlot(slot);
    setError(null);
    
    announceToScreenReader(`Selected time: ${time}`);
  }, []);

  /**
   * Handle step navigation
   */
  const handleStepChange = useCallback((step: BookingStep) => {
    // Validate current step before proceeding
    const validationError = validateCurrentStep();
    if (validationError) {
      setError(validationError);
      announceToScreenReader(`Error: ${validationError}`);
      return;
    }

    setCurrentStep(step);
    setError(null);
    
    announceToScreenReader(`Navigated to ${step} step`);
  }, [currentStep, selectedService, selectedPractitioner, selectedDate, selectedTime]);

  /**
   * Handle appointment booking submission
   */
  const handleBookAppointment = useCallback(async () => {
    if (!bookingService || !patient || !selectedService || !selectedDate || !selectedTime) {
      setError('Missing required information');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const startDateTime = new Date(selectedDate);
      const [hours, minutes] = selectedTime.split(':').map(Number);
      startDateTime.setHours(hours, minutes, 0, 0);

      const request: AppointmentBookingRequest = {
        patient: { reference: `Patient/${patient.id}` },
        startTime: startDateTime.toISOString(),
        durationMinutes: duration,
        serviceType: selectedService,
        allowAlternatives: true,
        alternativeRange: 120 // 2 hours
      };

      if (selectedPractitioner) {
        request.practitioner = { reference: `Practitioner/${selectedPractitioner}` };
      }

      if (appointmentReason) {
        request.reasonCode = [{
          text: appointmentReason
        }];
      }

      if (additionalComments) {
        request.comment = additionalComments;
      }

      const result = await bookingService.bookAppointment(request);
      setBookingResult(result);

      if (result.success && result.appointment) {
        setCurrentStep('complete');
        onAppointmentBooked?.(result.appointment);
        announceToScreenReader('Appointment booked successfully');
      } else {
        if (result.alternatives && result.alternatives.length > 0) {
          setShowAlternatives(true);
          announceToScreenReader(`Preferred time not available. ${result.alternatives.length} alternative times found.`);
        } else {
          setError(result.error?.message || 'Failed to book appointment');
          onBookingError?.(result.error || { code: 'UNKNOWN', message: 'Failed to book appointment' });
          announceToScreenReader(`Booking failed: ${result.error?.message || 'Unknown error'}`);
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      onBookingError?.({ code: 'BOOKING_ERROR', message: errorMessage });
      announceToScreenReader(`Booking error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [bookingService, patient, selectedService, selectedPractitioner, selectedDate, selectedTime, duration, appointmentReason, additionalComments, onAppointmentBooked, onBookingError]);

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Load available slots for selected date
   */
  const loadAvailableSlots = useCallback(async () => {
    if (!bookingService) return;

    try {
      setLoadingSlots(true);
      
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const slots = await bookingService.getAvailableSlots(
        startOfDay.toISOString(),
        endOfDay.toISOString(),
        selectedService?.text,
        selectedPractitioner
      );

      setAvailableSlots(slots);
      
      // Generate time slots for display
      const times = generateTimeSlots(slots);
      setTimeSlots(times);
      
      announceToScreenReader(`${slots.length} available time slots found for ${selectedDate.toLocaleDateString()}`);
      
    } catch (error) {
      console.error('Error loading slots:', error);
      setError('Failed to load available time slots');
      announceToScreenReader('Failed to load available time slots');
    } finally {
      setLoadingSlots(false);
    }
  }, [bookingService, selectedDate, selectedService, selectedPractitioner]);

  /**
   * Generate time slots for display
   */
  const generateTimeSlots = useCallback((slots: SlotAvailability[]): TimeSlot[] => {
    const times: TimeSlot[] = [];
    const startHour = 8; // 8 AM
    const endHour = 17; // 5 PM
    const intervalMinutes = 30;

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += intervalMinutes) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        
        // Check if this time has an available slot
        const availableSlot = slots.find(slot => {
          const slotTime = new Date(slot.slot.start);
          return slotTime.getHours() === hour && slotTime.getMinutes() === minute;
        });

        times.push({
          time: timeString,
          available: !!availableSlot,
          slot: availableSlot,
          reason: availableSlot ? undefined : 'No available slot'
        });
      }
    }

    return times;
  }, []);

  /**
   * Validate current step
   */
  const validateCurrentStep = useCallback((): string | null => {
    switch (currentStep) {
      case 'service':
        return !selectedService ? 'Please select a service type' : null;
      case 'practitioner':
        return practitioners.length > 0 && !selectedPractitioner ? 'Please select a practitioner' : null;
      case 'datetime':
        if (!selectedDate) return 'Please select a date';
        if (!selectedTime) return 'Please select a time';
        return null;
      case 'confirmation':
        return null;
      default:
        return null;
    }
  }, [currentStep, selectedService, selectedPractitioner, selectedDate, selectedTime, practitioners]);

  /**
   * Announce message to screen readers
   */
  const announceToScreenReader = useCallback((message: string) => {
    if (alertRef.current) {
      alertRef.current.textContent = message;
      // Clear after delay
      setTimeout(() => {
        if (alertRef.current) {
          alertRef.current.textContent = '';
        }
      }, 1000);
    }
  }, []);

  /**
   * Get theme styles
   */
  const getThemeStyles = useCallback(() => {
    return {
      '--primary-color': theme.primaryColor || '#3b82f6',
      '--secondary-color': theme.secondaryColor || '#e5e7eb',
      '--border-radius': theme.borderRadius || '0.5rem',
      '--font-family': theme.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    } as React.CSSProperties;
  }, [theme]);

  // ============================================================================
  // Render Functions
  // ============================================================================

  /**
   * Render step indicator
   */
  const renderStepIndicator = () => {
    const steps = [
      { key: 'service', label: 'Service', icon: '🏥' },
      { key: 'practitioner', label: 'Provider', icon: '👨‍⚕️' },
      { key: 'datetime', label: 'Date & Time', icon: '📅' },
      { key: 'confirmation', label: 'Confirm', icon: '✅' },
      { key: 'complete', label: 'Complete', icon: '🎉' }
    ];

    const currentIndex = steps.findIndex(step => step.key === currentStep);

    return (
      <div 
        className="step-indicator"
        role="progressbar"
        aria-valuenow={currentIndex + 1}
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-label={`Booking progress: step ${currentIndex + 1} of ${steps.length}`}
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '2rem',
          padding: '1rem'
        }}
      >
        {steps.map((step, index) => (
          <div
            key={step.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              opacity: index <= currentIndex ? 1 : 0.5
            }}
          >
            <div
              style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '50%',
                backgroundColor: index <= currentIndex ? 'var(--primary-color)' : 'var(--secondary-color)',
                color: index <= currentIndex ? 'white' : '#6b7280',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                fontWeight: '600'
              }}
            >
              {step.icon}
            </div>
            <div
              style={{
                marginLeft: '0.5rem',
                marginRight: '2rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: index <= currentIndex ? 'var(--primary-color)' : '#6b7280'
              }}
            >
              {step.label}
            </div>
            {index < steps.length - 1 && (
              <div
                style={{
                  width: '2rem',
                  height: '2px',
                  backgroundColor: index < currentIndex ? 'var(--primary-color)' : 'var(--secondary-color)',
                  marginRight: '2rem'
                }}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  /**
   * Render service selection step
   */
  const renderServiceStep = () => (
    <div className="service-step">
      <h2 
        ref={stepHeaderRef}
        tabIndex={-1}
        style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: '600' }}
      >
        Select Service Type
      </h2>
      
      <div 
        role="radiogroup"
        aria-labelledby="service-selection"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1rem'
        }}
      >
        {serviceTypes.map((service, index) => (
          <button
            key={index}
            role="radio"
            aria-checked={selectedService === service}
            onClick={() => handleServiceSelection(service)}
            style={{
              padding: '1.5rem',
              border: `2px solid ${selectedService === service ? 'var(--primary-color)' : 'var(--secondary-color)'}`,
              borderRadius: 'var(--border-radius)',
              backgroundColor: selectedService === service ? 'rgba(59, 130, 246, 0.1)' : 'white',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s ease'
            }}
          >
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem', fontWeight: '600' }}>
              {service.text || service.coding?.[0]?.display || 'Unknown Service'}
            </h3>
            {service.coding?.[0]?.system && (
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
                Code: {service.coding[0].code}
              </p>
            )}
          </button>
        ))}
      </div>

      <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => handleStepChange('practitioner')}
          disabled={!selectedService}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: selectedService ? 'var(--primary-color)' : '#d1d5db',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--border-radius)',
            cursor: selectedService ? 'pointer' : 'not-allowed',
            fontSize: '1rem',
            fontWeight: '500'
          }}
        >
          Next: Select Provider
        </button>
      </div>
    </div>
  );

  /**
   * Render practitioner selection step
   */
  const renderPractitionerStep = () => (
    <div className="practitioner-step">
      <h2 
        ref={stepHeaderRef}
        tabIndex={-1}
        style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: '600' }}
      >
        Select Healthcare Provider
      </h2>

      {practitioners.length === 0 ? (
        <div style={{ 
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: '#f9fafb',
          borderRadius: 'var(--border-radius)',
          border: '2px dashed #d1d5db'
        }}>
          <p style={{ margin: 0, color: '#6b7280' }}>
            Any available provider will be assigned based on your selected time slot.
          </p>
        </div>
      ) : (
        <div 
          role="radiogroup"
          aria-labelledby="practitioner-selection"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1rem'
          }}
        >
          {practitioners.map((practitioner) => (
            <button
              key={practitioner.id}
              role="radio"
              aria-checked={selectedPractitioner === practitioner.id}
              onClick={() => handlePractitionerSelection(practitioner.id)}
              style={{
                padding: '1.5rem',
                border: `2px solid ${selectedPractitioner === practitioner.id ? 'var(--primary-color)' : 'var(--secondary-color)'}`,
                borderRadius: 'var(--border-radius)',
                backgroundColor: selectedPractitioner === practitioner.id ? 'rgba(59, 130, 246, 0.1)' : 'white',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                transition: 'all 0.2s ease'
              }}
            >
              {practitioner.photo && (
                <img
                  src={practitioner.photo}
                  alt={`Photo of ${practitioner.name}`}
                  style={{
                    width: '3rem',
                    height: '3rem',
                    borderRadius: '50%',
                    objectFit: 'cover'
                  }}
                />
              )}
              <div>
                <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.125rem', fontWeight: '600' }}>
                  {practitioner.name}
                </h3>
                {practitioner.specialty && (
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
                    {practitioner.specialty}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between' }}>
        <button
          onClick={() => handleStepChange('service')}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: 'transparent',
            color: 'var(--primary-color)',
            border: '2px solid var(--primary-color)',
            borderRadius: 'var(--border-radius)',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '500'
          }}
        >
          Back: Select Service
        </button>
        <button
          onClick={() => handleStepChange('datetime')}
          disabled={practitioners.length > 0 && !selectedPractitioner}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: (practitioners.length === 0 || selectedPractitioner) ? 'var(--primary-color)' : '#d1d5db',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--border-radius)',
            cursor: (practitioners.length === 0 || selectedPractitioner) ? 'pointer' : 'not-allowed',
            fontSize: '1rem',
            fontWeight: '500'
          }}
        >
          Next: Select Date & Time
        </button>
      </div>
    </div>
  );

  /**
   * Render date and time selection step
   */
  const renderDateTimeStep = () => (
    <div className="datetime-step">
      <h2 
        ref={stepHeaderRef}
        tabIndex={-1}
        style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: '600' }}
      >
        Select Date & Time
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Date picker */}
        <div>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem', fontWeight: '600' }}>
            Choose Date
          </h3>
          <input
            type="date"
            value={selectedDate.toISOString().split('T')[0]}
            min={minDate.toISOString().split('T')[0]}
            max={maxDate.toISOString().split('T')[0]}
            onChange={(e) => handleDateSelection(new Date(e.target.value))}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '2px solid var(--secondary-color)',
              borderRadius: 'var(--border-radius)',
              fontSize: '1rem'
            }}
          />
        </div>

        {/* Time picker */}
        <div>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem', fontWeight: '600' }}>
            Available Times
          </h3>
          
          {loadingSlots ? (
            <div style={{ 
              padding: '2rem',
              textAlign: 'center',
              color: '#6b7280'
            }}>
              Loading available times...
            </div>
          ) : (
            <div 
              role="radiogroup"
              aria-labelledby="time-selection"
              style={{
                maxHeight: '20rem',
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                gap: '0.5rem'
              }}
            >
              {timeSlots.map((timeSlot) => (
                <button
                  key={timeSlot.time}
                  role="radio"
                  aria-checked={selectedTime === timeSlot.time}
                  disabled={!timeSlot.available}
                  onClick={() => handleTimeSelection(timeSlot.time, timeSlot.slot || null)}
                  title={timeSlot.available ? `Book appointment at ${timeSlot.time}` : timeSlot.reason}
                  style={{
                    padding: '0.75rem 0.5rem',
                    border: `2px solid ${selectedTime === timeSlot.time ? 'var(--primary-color)' : 'var(--secondary-color)'}`,
                    borderRadius: 'var(--border-radius)',
                    backgroundColor: timeSlot.available 
                      ? (selectedTime === timeSlot.time ? 'rgba(59, 130, 246, 0.1)' : 'white')
                      : '#f3f4f6',
                    color: timeSlot.available ? '#1f2937' : '#9ca3af',
                    cursor: timeSlot.available ? 'pointer' : 'not-allowed',
                    fontSize: '0.875rem',
                    fontWeight: selectedTime === timeSlot.time ? '600' : '400',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {timeSlot.time}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Duration and reason */}
      <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        <div>
          <label 
            htmlFor="duration"
            style={{ display: 'block', marginBottom: '0.5rem', fontSize: '1rem', fontWeight: '500' }}
          >
            Duration (minutes)
          </label>
          <select
            id="duration"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '2px solid var(--secondary-color)',
              borderRadius: 'var(--border-radius)',
              fontSize: '1rem'
            }}
          >
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={45}>45 minutes</option>
            <option value={60}>1 hour</option>
            <option value={90}>1.5 hours</option>
            <option value={120}>2 hours</option>
          </select>
        </div>

        <div>
          <label 
            htmlFor="reason"
            style={{ display: 'block', marginBottom: '0.5rem', fontSize: '1rem', fontWeight: '500' }}
          >
            Reason for Visit
          </label>
          <input
            id="reason"
            type="text"
            value={appointmentReason}
            onChange={(e) => setAppointmentReason(e.target.value)}
            placeholder="Brief description of the reason for your visit"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '2px solid var(--secondary-color)',
              borderRadius: 'var(--border-radius)',
              fontSize: '1rem'
            }}
          />
        </div>
      </div>

      <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between' }}>
        <button
          onClick={() => handleStepChange('practitioner')}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: 'transparent',
            color: 'var(--primary-color)',
            border: '2px solid var(--primary-color)',
            borderRadius: 'var(--border-radius)',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '500'
          }}
        >
          Back: Select Provider
        </button>
        <button
          onClick={() => handleStepChange('confirmation')}
          disabled={!selectedDate || !selectedTime}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: (selectedDate && selectedTime) ? 'var(--primary-color)' : '#d1d5db',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--border-radius)',
            cursor: (selectedDate && selectedTime) ? 'pointer' : 'not-allowed',
            fontSize: '1rem',
            fontWeight: '500'
          }}
        >
          Next: Confirm Details
        </button>
      </div>
    </div>
  );

  /**
   * Render confirmation step
   */
  const renderConfirmationStep = () => {
    const practitioner = practitioners.find(p => p.id === selectedPractitioner);
    const appointmentDateTime = new Date(selectedDate);
    const [hours, minutes] = (selectedTime || '').split(':').map(Number);
    appointmentDateTime.setHours(hours, minutes, 0, 0);

    return (
      <div className="confirmation-step">
        <h2 
          ref={stepHeaderRef}
          tabIndex={-1}
          style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: '600' }}
        >
          Confirm Your Appointment
        </h2>

        <div style={{
          padding: '2rem',
          backgroundColor: '#f9fafb',
          borderRadius: 'var(--border-radius)',
          border: '1px solid var(--secondary-color)',
          marginBottom: '2rem'
        }}>
          <div style={{ marginBottom: '1rem' }}>
            <strong>Service:</strong> {selectedService?.text || 'Unknown Service'}
          </div>
          
          {practitioner && (
            <div style={{ marginBottom: '1rem' }}>
              <strong>Provider:</strong> {practitioner.name}
              {practitioner.specialty && ` (${practitioner.specialty})`}
            </div>
          )}
          
          <div style={{ marginBottom: '1rem' }}>
            <strong>Date & Time:</strong> {appointmentDateTime.toLocaleString()}
          </div>
          
          <div style={{ marginBottom: '1rem' }}>
            <strong>Duration:</strong> {duration} minutes
          </div>
          
          {appointmentReason && (
            <div style={{ marginBottom: '1rem' }}>
              <strong>Reason:</strong> {appointmentReason}
            </div>
          )}
          
          {patient && (
            <div>
              <strong>Patient:</strong> {patient.name?.[0]?.given?.[0]} {patient.name?.[0]?.family}
            </div>
          )}
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <label 
            htmlFor="comments"
            style={{ display: 'block', marginBottom: '0.5rem', fontSize: '1rem', fontWeight: '500' }}
          >
            Additional Comments (Optional)
          </label>
          <textarea
            id="comments"
            value={additionalComments}
            onChange={(e) => setAdditionalComments(e.target.value)}
            placeholder="Any additional information or special requests"
            rows={3}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '2px solid var(--secondary-color)',
              borderRadius: 'var(--border-radius)',
              fontSize: '1rem',
              resize: 'vertical'
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button
            onClick={() => handleStepChange('datetime')}
            disabled={loading}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'transparent',
              color: 'var(--primary-color)',
              border: '2px solid var(--primary-color)',
              borderRadius: 'var(--border-radius)',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: '500',
              opacity: loading ? 0.6 : 1
            }}
          >
            Back: Change Date/Time
          </button>
          <button
            onClick={handleBookAppointment}
            disabled={loading}
            style={{
              padding: '0.75rem 2rem',
              backgroundColor: loading ? '#d1d5db' : 'var(--primary-color)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--border-radius)',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {loading && (
              <div
                style={{
                  width: '1rem',
                  height: '1rem',
                  border: '2px solid transparent',
                  borderTop: '2px solid white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}
              />
            )}
            {loading ? 'Booking...' : 'Book Appointment'}
          </button>
        </div>
      </div>
    );
  };

  /**
   * Render completion step
   */
  const renderCompleteStep = () => {
    if (!bookingResult?.success || !bookingResult.appointment) {
      return null;
    }

    return (
      <div className="complete-step" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
        
        <h2 
          ref={stepHeaderRef}
          tabIndex={-1}
          style={{ marginBottom: '1rem', fontSize: '2rem', fontWeight: '700', color: 'var(--primary-color)' }}
        >
          Appointment Booked Successfully!
        </h2>

        {bookingResult.confirmation && (
          <div style={{
            padding: '2rem',
            backgroundColor: '#f0f9ff',
            borderRadius: 'var(--border-radius)',
            border: '1px solid #bae6fd',
            marginBottom: '2rem'
          }}>
            <div style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: '600' }}>
              Confirmation Number: {bookingResult.confirmation.confirmationNumber}
            </div>
            
            {bookingResult.confirmation.instructions && (
              <div style={{ marginBottom: '1rem', fontSize: '1rem' }}>
                📋 {bookingResult.confirmation.instructions}
              </div>
            )}
            
            {bookingResult.confirmation.nextSteps && (
              <div>
                <h3 style={{ marginBottom: '0.5rem', fontSize: '1.125rem', fontWeight: '600' }}>
                  Next Steps:
                </h3>
                <ul style={{ textAlign: 'left', paddingLeft: '1.5rem' }}>
                  {bookingResult.confirmation.nextSteps.map((step, index) => (
                    <li key={index} style={{ marginBottom: '0.25rem' }}>
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button
            onClick={() => {
              // Reset form for new booking
              setCurrentStep('service');
              setSelectedService(null);
              setSelectedPractitioner(null);
              setSelectedDate(new Date());
              setSelectedTime(null);
              setAppointmentReason('');
              setAdditionalComments('');
              setBookingResult(null);
            }}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'transparent',
              color: 'var(--primary-color)',
              border: '2px solid var(--primary-color)',
              borderRadius: 'var(--border-radius)',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '500'
            }}
          >
            Book Another Appointment
          </button>
          
          <button
            onClick={() => window.print()}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'var(--primary-color)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--border-radius)',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '500'
            }}
          >
            Print Confirmation
          </button>
        </div>
      </div>
    );
  };

  /**
   * Render alternative times if primary booking failed
   */
  const renderAlternatives = () => {
    if (!showAlternatives || !bookingResult?.alternatives) {
      return null;
    }

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: 'var(--border-radius)',
          padding: '2rem',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '80%',
          overflow: 'auto'
        }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: '600' }}>
            Alternative Time Slots
          </h3>
          
          <p style={{ marginBottom: '1.5rem', color: '#6b7280' }}>
            Your preferred time wasn't available. Here are some alternative options:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
            {bookingResult.alternatives.map((alternative, index) => (
              <button
                key={index}
                onClick={() => {
                  const slotTime = new Date(alternative.slot.start);
                  setSelectedDate(slotTime);
                  setSelectedTime(`${slotTime.getHours().toString().padStart(2, '0')}:${slotTime.getMinutes().toString().padStart(2, '0')}`);
                  setSelectedSlot(alternative);
                  setShowAlternatives(false);
                  setCurrentStep('confirmation');
                }}
                style={{
                  padding: '1rem',
                  border: '2px solid var(--secondary-color)',
                  borderRadius: 'var(--border-radius)',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.borderColor = 'var(--primary-color)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.borderColor = 'var(--secondary-color)';
                }}
              >
                <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                  {new Date(alternative.slot.start).toLocaleDateString()} at{' '}
                  {new Date(alternative.slot.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  Duration: {alternative.durationMinutes} minutes
                </div>
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <button
              onClick={() => setShowAlternatives(false)}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: 'transparent',
                color: '#6b7280',
                border: '2px solid #d1d5db',
                borderRadius: 'var(--border-radius)',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  if (loading && !bookingService) {
    return (
      <div 
        className={`appointment-booking-loading ${className}`}
        style={{
          ...getThemeStyles(),
          padding: '3rem',
          textAlign: 'center',
          backgroundColor: 'white',
          borderRadius: 'var(--border-radius)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}
      >
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
        <div style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
          Initializing Appointment Booking
        </div>
        <div style={{ color: '#6b7280' }}>
          Please wait while we set up the booking system...
        </div>
      </div>
    );
  }

  return (
    <div 
      id={id}
      className={`appointment-booking-component ${className}`}
      style={{
        ...getThemeStyles(),
        fontFamily: 'var(--font-family)',
        maxWidth: '800px',
        margin: '0 auto',
        padding: '2rem',
        backgroundColor: 'white',
        borderRadius: 'var(--border-radius)',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}
    >
      {/* Screen Reader Announcements */}
      <div
        ref={alertRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          left: '-10000px',
          width: '1px',
          height: '1px',
          overflow: 'hidden'
        }}
      />

      {/* Header */}
      <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 style={{ 
          margin: '0 0 0.5rem 0', 
          fontSize: '2.5rem', 
          fontWeight: '700',
          color: 'var(--primary-color)'
        }}>
          Book Your Appointment
        </h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '1.125rem' }}>
          Schedule your healthcare appointment in just a few simple steps
        </p>
      </header>

      {/* Error Display */}
      {error && (
        <div
          role="alert"
          style={{
            marginBottom: '2rem',
            padding: '1rem',
            backgroundColor: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: 'var(--border-radius)',
            color: '#dc2626'
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Step Indicator */}
      {renderStepIndicator()}

      {/* Step Content */}
      {currentStep === 'service' && renderServiceStep()}
      {currentStep === 'practitioner' && renderPractitionerStep()}
      {currentStep === 'datetime' && renderDateTimeStep()}
      {currentStep === 'confirmation' && renderConfirmationStep()}
      {currentStep === 'complete' && renderCompleteStep()}

      {/* Alternative Times Modal */}
      {renderAlternatives()}

      {/* CSS for animations */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .appointment-booking-component button:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .appointment-booking-component button:focus {
          outline: 2px solid var(--primary-color);
          outline-offset: 2px;
        }
        
        @media (max-width: 768px) {
          .appointment-booking-component {
            padding: 1rem;
          }
          
          .datetime-step > div:first-child {
            grid-template-columns: 1fr;
          }
          
          .step-indicator {
            flex-direction: column;
            align-items: center;
          }
          
          .step-indicator > div {
            margin-bottom: 1rem;
          }
        }
      `}</style>
    </div>
  );
};

export default AppointmentBookingComponent;