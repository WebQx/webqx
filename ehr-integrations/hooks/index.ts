/**
 * EHR Integration React Hooks
 * 
 * Custom React hooks for EHR operations with built-in state management,
 * error handling, loading states, and accessibility features.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { EHRResult, Patient, Appointment, IntakeForm, EHRError, LoadingState } from '../types';
import { ehrService } from '../services/EHRService';
import { validatePatientData, createUserFriendlyErrorMessage } from '../utils';

/**
 * Hook result interface with loading state and error handling
 */
export interface EHRHookResult<T> {
  /** Current data */
  data: T | null;
  /** Loading state information */
  loading: LoadingState;
  /** Error information if operation failed */
  error: EHRError | null;
  /** User-friendly error message */
  errorMessage: string;
  /** Whether the operation was successful */
  success: boolean;
  /** Retry the last operation */
  retry: () => Promise<void>;
  /** Clear current error state */
  clearError: () => void;
}

/**
 * Hook for managing patient data operations
 * 
 * @param patientId - Initial patient ID to load
 * @returns Patient management hook result
 */
export function usePatient(patientId?: string): EHRHookResult<Patient> & {
  /** Update patient data */
  updatePatient: (updates: Partial<Patient>) => Promise<void>;
  /** Create new patient */
  createPatient: (patientData: Omit<Patient, 'id'>) => Promise<void>;
  /** Load patient by ID */
  loadPatient: (id: string) => Promise<void>;
} {
  const [data, setData] = useState<Patient | null>(null);
  const [loading, setLoading] = useState<LoadingState>({ isLoading: false });
  const [error, setError] = useState<EHRError | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const lastOperationRef = useRef<() => Promise<void>>();

  /**
   * Handle EHR operation result and update state
   */
  const handleResult = useCallback((result: EHRResult<Patient>) => {
    setLoading(result.loading);
    setSuccess(result.success);
    
    if (result.success && result.data) {
      setData(result.data);
      setError(null);
    } else if (result.error) {
      setError(result.error);
      setData(null);
    }
  }, []);

  /**
   * Load patient by ID
   */
  const loadPatient = useCallback(async (id: string) => {
    if (!id?.trim()) {
      const validationError: EHRError = {
        code: 'INVALID_PATIENT_ID',
        message: 'Patient ID is required',
        operation: 'load_patient',
        timestamp: new Date()
      };
      setError(validationError);
      setLoading({ isLoading: false });
      return;
    }

    setLoading({ isLoading: true, message: 'Loading patient information...' });
    setError(null);
    
    const operation = () => ehrService.getPatient(id, 'current_user');
    lastOperationRef.current = () => operation().then(handleResult);
    
    const result = await operation();
    handleResult(result);
  }, [handleResult]);

  /**
   * Update patient data
   */
  const updatePatient = useCallback(async (updates: Partial<Patient>) => {
    if (!data?.id) {
      const validationError: EHRError = {
        code: 'NO_PATIENT_LOADED',
        message: 'No patient is currently loaded for updates',
        operation: 'update_patient',
        timestamp: new Date()
      };
      setError(validationError);
      return;
    }

    // Validate update data
    const validation = validatePatientData({ ...data, ...updates });
    if (!validation.isValid) {
      const validationError: EHRError = {
        code: 'VALIDATION_ERROR',
        message: validation.errors.join(', '),
        operation: 'update_patient',
        timestamp: new Date(),
        details: { validationErrors: validation.errors, validationWarnings: validation.warnings }
      };
      setError(validationError);
      return;
    }

    setLoading({ isLoading: true, message: 'Updating patient information...' });
    setError(null);
    
    const operation = () => ehrService.updatePatient(data.id, updates, 'current_user');
    lastOperationRef.current = () => operation().then(handleResult);
    
    const result = await operation();
    handleResult(result);
  }, [data, handleResult]);

  /**
   * Create new patient
   */
  const createPatient = useCallback(async (patientData: Omit<Patient, 'id'>) => {
    // Validate patient data
    const validation = validatePatientData(patientData);
    if (!validation.isValid) {
      const validationError: EHRError = {
        code: 'VALIDATION_ERROR',
        message: validation.errors.join(', '),
        operation: 'create_patient',
        timestamp: new Date(),
        details: { validationErrors: validation.errors, validationWarnings: validation.warnings }
      };
      setError(validationError);
      return;
    }

    setLoading({ isLoading: true, message: 'Creating patient record...' });
    setError(null);
    
    const operation = () => ehrService.createPatient(patientData, 'current_user');
    lastOperationRef.current = () => operation().then(handleResult);
    
    const result = await operation();
    handleResult(result);
  }, [handleResult]);

  /**
   * Retry last operation
   */
  const retry = useCallback(async () => {
    if (lastOperationRef.current) {
      await lastOperationRef.current();
    }
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
    setSuccess(false);
  }, []);

  /**
   * Load patient on mount if ID provided
   */
  useEffect(() => {
    if (patientId) {
      loadPatient(patientId);
    }
  }, [patientId, loadPatient]);

  const errorMessage = error ? createUserFriendlyErrorMessage(error) : '';

  return {
    data,
    loading,
    error,
    errorMessage,
    success,
    retry,
    clearError,
    updatePatient,
    createPatient,
    loadPatient
  };
}

/**
 * Hook for managing appointment operations
 * 
 * @returns Appointment management hook result
 */
export function useAppointments(): EHRHookResult<Appointment[]> & {
  /** Schedule new appointment */
  scheduleAppointment: (appointment: Omit<Appointment, 'id'>) => Promise<void>;
  /** Cancel appointment */
  cancelAppointment: (appointmentId: string) => Promise<void>;
} {
  const [data, setData] = useState<Appointment[] | null>(null);
  const [loading, setLoading] = useState<LoadingState>({ isLoading: false });
  const [error, setError] = useState<EHRError | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const lastOperationRef = useRef<() => Promise<void>>();

  /**
   * Schedule new appointment
   */
  const scheduleAppointment = useCallback(async (appointment: Omit<Appointment, 'id'>) => {
    // Validate appointment data
    if (!appointment.patientId?.trim()) {
      const validationError: EHRError = {
        code: 'INVALID_PATIENT_ID',
        message: 'Patient ID is required for appointment scheduling',
        operation: 'schedule_appointment',
        timestamp: new Date()
      };
      setError(validationError);
      return;
    }

    if (!appointment.providerId?.trim()) {
      const validationError: EHRError = {
        code: 'INVALID_PROVIDER_ID',
        message: 'Provider ID is required for appointment scheduling',
        operation: 'schedule_appointment',
        timestamp: new Date()
      };
      setError(validationError);
      return;
    }

    if (new Date(appointment.dateTime) <= new Date()) {
      const validationError: EHRError = {
        code: 'INVALID_APPOINTMENT_TIME',
        message: 'Appointment time must be in the future',
        operation: 'schedule_appointment',
        timestamp: new Date()
      };
      setError(validationError);
      return;
    }

    setLoading({ isLoading: true, message: 'Scheduling appointment...' });
    setError(null);
    
    const operation = async () => {
      const result = await ehrService.scheduleAppointment(appointment, 'current_user');
      
      setLoading(result.loading);
      setSuccess(result.success);
      
      if (result.success && result.data) {
        // Add new appointment to the list
        setData(prev => prev ? [...prev, result.data!] : [result.data!]);
        setError(null);
      } else if (result.error) {
        setError(result.error);
      }
    };
    
    lastOperationRef.current = operation;
    await operation();
  }, []);

  /**
   * Cancel appointment (placeholder implementation)
   */
  const cancelAppointment = useCallback(async (appointmentId: string) => {
    if (!appointmentId?.trim()) {
      const validationError: EHRError = {
        code: 'INVALID_APPOINTMENT_ID',
        message: 'Appointment ID is required for cancellation',
        operation: 'cancel_appointment',
        timestamp: new Date()
      };
      setError(validationError);
      return;
    }

    setLoading({ isLoading: true, message: 'Cancelling appointment...' });
    setError(null);
    
    const operation = async () => {
      // Simulate cancellation operation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Remove appointment from list
      setData(prev => prev ? prev.filter(apt => apt.id !== appointmentId) : null);
      setLoading({ isLoading: false });
      setSuccess(true);
    };
    
    lastOperationRef.current = operation;
    await operation();
  }, []);

  /**
   * Retry last operation
   */
  const retry = useCallback(async () => {
    if (lastOperationRef.current) {
      await lastOperationRef.current();
    }
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
    setSuccess(false);
  }, []);

  const errorMessage = error ? createUserFriendlyErrorMessage(error) : '';

  return {
    data,
    loading,
    error,
    errorMessage,
    success,
    retry,
    clearError,
    scheduleAppointment,
    cancelAppointment
  };
}

/**
 * Hook for managing intake form operations
 * 
 * @returns Intake form management hook result
 */
export function useIntakeForm(): EHRHookResult<IntakeForm> & {
  /** Submit intake form */
  submitForm: (form: IntakeForm) => Promise<void>;
  /** Save form as draft */
  saveDraft: (form: IntakeForm) => Promise<void>;
} {
  const [data, setData] = useState<IntakeForm | null>(null);
  const [loading, setLoading] = useState<LoadingState>({ isLoading: false });
  const [error, setError] = useState<EHRError | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const lastOperationRef = useRef<() => Promise<void>>();

  /**
   * Submit intake form
   */
  const submitForm = useCallback(async (form: IntakeForm) => {
    // Validate form data
    if (!form.patientId?.trim()) {
      const validationError: EHRError = {
        code: 'INVALID_PATIENT_ID',
        message: 'Patient ID is required for form submission',
        operation: 'submit_intake_form',
        timestamp: new Date()
      };
      setError(validationError);
      return;
    }

    if (!form.data?.chiefComplaint?.trim()) {
      const validationError: EHRError = {
        code: 'MISSING_CHIEF_COMPLAINT',
        message: 'Chief complaint is required for form submission',
        operation: 'submit_intake_form',
        timestamp: new Date()
      };
      setError(validationError);
      return;
    }

    setLoading({ isLoading: true, message: 'Submitting intake form...' });
    setError(null);
    
    const operation = async () => {
      const result = await ehrService.submitIntakeForm(form, 'current_user');
      
      setLoading(result.loading);
      setSuccess(result.success);
      
      if (result.success && result.data) {
        setData(result.data);
        setError(null);
      } else if (result.error) {
        setError(result.error);
      }
    };
    
    lastOperationRef.current = operation;
    await operation();
  }, []);

  /**
   * Save form as draft
   */
  const saveDraft = useCallback(async (form: IntakeForm) => {
    setLoading({ isLoading: true, message: 'Saving draft...' });
    setError(null);
    
    const operation = async () => {
      // Simulate saving draft
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setData({ ...form, status: 'draft' as any });
      setLoading({ isLoading: false });
      setSuccess(true);
    };
    
    lastOperationRef.current = operation;
    await operation();
  }, []);

  /**
   * Retry last operation
   */
  const retry = useCallback(async () => {
    if (lastOperationRef.current) {
      await lastOperationRef.current();
    }
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
    setSuccess(false);
  }, []);

  const errorMessage = error ? createUserFriendlyErrorMessage(error) : '';

  return {
    data,
    loading,
    error,
    errorMessage,
    success,
    retry,
    clearError,
    submitForm,
    saveDraft
  };
}

/**
 * Hook for EHR service health monitoring
 * 
 * @returns Service health status
 */
export function useEHRHealth() {
  const [healthStatus, setHealthStatus] = useState(ehrService.getHealthStatus());
  const [isMonitoring, setIsMonitoring] = useState(false);

  /**
   * Start health monitoring
   */
  const startMonitoring = useCallback(() => {
    if (isMonitoring) return;
    
    setIsMonitoring(true);
    
    const interval = setInterval(() => {
      setHealthStatus(ehrService.getHealthStatus());
    }, 30000); // Update every 30 seconds
    
    return () => {
      clearInterval(interval);
      setIsMonitoring(false);
    };
  }, [isMonitoring]);

  /**
   * Get current health status
   */
  const refreshHealth = useCallback(() => {
    setHealthStatus(ehrService.getHealthStatus());
  }, []);

  useEffect(() => {
    const cleanup = startMonitoring();
    return cleanup;
  }, [startMonitoring]);

  return {
    healthStatus,
    isMonitoring,
    refreshHealth
  };
}