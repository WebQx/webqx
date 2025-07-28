import { ApiError, RetryConfig, PrescriptionFormData } from './types';

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  backoffMultiplier: 2
};

/**
 * Sleep utility function for delays
 */
const sleep = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generic retry function with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  onRetry?: (attempt: number, error: any) => void
): Promise<T> {
  const { maxAttempts, initialDelay, backoffMultiplier } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config
  };

  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // If it's the last attempt or error is not retryable, throw
      if (attempt === maxAttempts || !isRetryableError(error)) {
        throw createApiError(error, attempt > 1);
      }

      // Calculate delay with exponential backoff
      const delay = initialDelay * Math.pow(backoffMultiplier, attempt - 1);
      
      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt, error);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  throw createApiError(lastError, true);
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: any): boolean {
  // Network errors are usually retryable
  if (error.name === 'NetworkError' || error.code === 'NETWORK_ERROR') {
    return true;
  }

  // Server errors (5xx) are retryable
  if (error.status >= 500 && error.status < 600) {
    return true;
  }

  // Timeout errors are retryable
  if (error.name === 'TimeoutError' || error.code === 'TIMEOUT') {
    return true;
  }

  // Rate limiting is retryable
  if (error.status === 429) {
    return true;
  }

  return false;
}

/**
 * Create a standardized ApiError from various error types
 */
function createApiError(error: any, wasRetried: boolean): ApiError {
  let message = 'An unexpected error occurred';
  let code = 'UNKNOWN_ERROR';
  const retryable = isRetryableError(error);

  if (error.response?.data?.message) {
    message = error.response.data.message;
  } else if (error.message) {
    message = error.message;
  }

  if (error.response?.data?.code) {
    code = error.response.data.code;
  } else if (error.code) {
    code = error.code;
  } else if (error.status) {
    code = `HTTP_${error.status}`;
  }

  // Add context about retry attempts
  if (wasRetried && retryable) {
    message += ' (after multiple attempts)';
  }

  // Add user-friendly error messages
  switch (code) {
    case 'NETWORK_ERROR':
      message = 'Unable to connect to the server. Please check your internet connection and try again.';
      break;
    case 'HTTP_401':
      message = 'Your session has expired. Please log in again.';
      break;
    case 'HTTP_403':
      message = 'You do not have permission to perform this action.';
      break;
    case 'HTTP_404':
      message = 'The requested service is not available. Please try again later.';
      break;
    case 'HTTP_429':
      message = 'Too many requests. Please wait a moment and try again.';
      break;
    case 'HTTP_500':
    case 'HTTP_502':
    case 'HTTP_503':
    case 'HTTP_504':
      message = 'The server is currently experiencing issues. Please try again in a few minutes.';
      break;
    case 'VALIDATION_ERROR':
      message = 'Please check your information and try again.';
      break;
    case 'PRESCRIPTION_NOT_FOUND':
      message = 'The selected prescription could not be found. Please select a different medication.';
      break;
    case 'REFILL_NOT_ALLOWED':
      message = 'This prescription cannot be refilled at this time. Please contact your doctor.';
      break;
    case 'PHARMACY_UNAVAILABLE':
      message = 'The selected pharmacy is currently unavailable. Please choose a different pharmacy.';
      break;
  }

  return {
    message,
    code,
    retryable
  };
}

/**
 * Mock API function for submitting prescription refill requests
 * In a real app, this would make an actual HTTP request
 */
export async function submitPrescriptionRefill(
  data: PrescriptionFormData
): Promise<{ success: boolean; confirmationNumber: string }> {
  // Simulate network delay
  await sleep(Math.random() * 2000 + 1000);

  // Simulate various error conditions for testing
  const randomError = Math.random();
  
  if (randomError < 0.1) {
    // 10% chance of network error
    const error = new Error('Network request failed');
    error.name = 'NetworkError';
    throw error;
  }
  
  if (randomError < 0.15) {
    // 5% chance of server error
    const error = new Error('Internal server error');
    (error as any).status = 500;
    throw error;
  }
  
  if (randomError < 0.2) {
    // 5% chance of validation error
    const error = new Error('Invalid prescription data');
    (error as any).code = 'VALIDATION_ERROR';
    throw error;
  }

  // Success case
  return {
    success: true,
    confirmationNumber: `RX${Date.now()}${Math.floor(Math.random() * 1000)}`
  };
}

/**
 * Mock API function for fetching available medications
 */
export async function fetchMedications(): Promise<any[]> {
  // Simulate network delay
  await sleep(500 + Math.random() * 1000);

  return [
    {
      id: 'med-001',
      name: 'Lisinopril',
      dosage: '10mg',
      frequency: 'Once daily',
      prescribedBy: 'Dr. Smith',
      lastFilled: '2024-02-15',
      refillsRemaining: 3,
      canRefill: true
    },
    {
      id: 'med-002',
      name: 'Metformin',
      dosage: '500mg',
      frequency: 'Twice daily',
      prescribedBy: 'Dr. Johnson',
      lastFilled: '2024-02-10',
      refillsRemaining: 2,
      canRefill: true
    },
    {
      id: 'med-003',
      name: 'Atorvastatin',
      dosage: '20mg',
      frequency: 'Once daily',
      prescribedBy: 'Dr. Williams',
      lastFilled: '2024-01-30',
      refillsRemaining: 0,
      canRefill: false
    },
    {
      id: 'med-004',
      name: 'Amlodipine',
      dosage: '5mg',
      frequency: 'Once daily',
      prescribedBy: 'Dr. Brown',
      lastFilled: '2024-02-20',
      refillsRemaining: 1,
      canRefill: true
    }
  ];
}