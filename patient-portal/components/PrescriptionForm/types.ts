/**
 * Types and interfaces for PrescriptionForm component
 */

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  prescribedBy: string;
  lastFilled?: string;
  refillsRemaining: number;
  canRefill: boolean;
}

export interface PrescriptionFormData {
  medicationId: string;
  quantity: number;
  pharmacyId: string;
  instructions?: string;
  urgency: 'routine' | 'urgent';
}

export interface ApiError {
  message: string;
  code: string;
  retryable: boolean;
}

export interface LoadingState {
  isLoading: boolean;
  loadingMessage: string;
  progress?: number;
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  backoffMultiplier: number;
}

export interface PrescriptionFormProps {
  /** Available medications for refill */
  medications?: Medication[];
  /** Callback when form is submitted successfully */
  onSuccess?: (data: PrescriptionFormData) => void;
  /** Callback when form submission fails */
  onError?: (error: ApiError) => void;
  /** Callback when form is cancelled */
  onCancel?: () => void;
  /** Whether the form should be initially visible */
  initiallyVisible?: boolean;
  /** CSS class name for styling */
  className?: string;
  /** Configuration for retry mechanism */
  retryConfig?: Partial<RetryConfig>;
}

export interface FormStepProps {
  /** Current step data */
  data: Partial<PrescriptionFormData>;
  /** Callback to update form data */
  onDataChange: (data: Partial<PrescriptionFormData>) => void;
  /** Available medications */
  medications: Medication[];
  /** Loading state */
  loading: LoadingState;
  /** Any errors to display */
  error?: ApiError | null;
  /** Callback to go to next step */
  onNext?: () => void;
  /** Callback to go to previous step */
  onPrevious?: () => void;
  /** Whether this is the last step */
  isLastStep?: boolean;
}