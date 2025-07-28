/**
 * TypeScript type definitions for the PrescriptionForm component
 * These types ensure type safety for the RxNorm API integration and component props
 */

/**
 * Individual medication item from RxNorm API response
 */
export interface MedicationItem {
  /** Unique RxNorm Concept Unique Identifier */
  rxcui: string;
  /** Primary name of the medication */
  name: string;
  /** Alternative name or synonym for the medication */
  synonym?: string;
  /** Strength information (e.g., "10mg", "500mg") */
  strength?: string;
  /** Dosage form (e.g., "tablet", "capsule", "liquid") */
  doseForm?: string;
  /** Whether this medication has been added to EHR */
  isAdded?: boolean;
}

/**
 * Mock RxNorm API response structure
 */
export interface RxNormResponse {
  /** Array of medication results */
  drugGroup: {
    /** Concept group containing medication details */
    conceptGroup: Array<{
      /** Time taken for the search (in milliseconds) */
      tty: string;
      /** Array of medication concepts */
      conceptProperties: Array<{
        /** RxNorm Concept Unique Identifier */
        rxcui: string;
        /** Medication name */
        name: string;
        /** Alternative name */
        synonym?: string;
        /** Strength information */
        strength?: string;
        /** Dosage form */
        doseForm?: string;
      }>;
    }>;
  };
}

/**
 * Search state for managing API calls and UI state
 */
export interface SearchState {
  /** Current search query */
  query: string;
  /** Whether a search is currently in progress */
  isLoading: boolean;
  /** Array of search results */
  results: MedicationItem[];
  /** Error message if search failed */
  error: string | null;
  /** Number of retry attempts made */
  retryCount: number;
  /** Whether user has been notified of success */
  notification: string | null;
}

/**
 * Props for the main PrescriptionForm component
 */
export interface PrescriptionFormProps {
  /** CSS class name for additional styling */
  className?: string;
  /** Callback when a medication is successfully added to EHR */
  onMedicationAdded?: (medication: MedicationItem) => void;
  /** Callback when search is performed */
  onSearch?: (query: string) => void;
  /** Whether to show debug information */
  debug?: boolean;
  /** Maximum number of retry attempts for failed API calls */
  maxRetries?: number;
  /** Initial search query */
  initialQuery?: string;
  /** Whether the form is disabled */
  disabled?: boolean;
}

/**
 * Props for the SearchInput sub-component
 */
export interface SearchInputProps {
  /** Current search value */
  value: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
  /** Callback when search is submitted */
  onSubmit: () => void;
  /** Whether search is in progress */
  isLoading: boolean;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Placeholder text for the input */
  placeholder?: string;
  /** ARIA label for accessibility */
  ariaLabel?: string;
}

/**
 * Props for the MedicationResults sub-component
 */
export interface MedicationResultsProps {
  /** Array of medication results to display */
  results: MedicationItem[];
  /** Whether search is in progress */
  isLoading: boolean;
  /** Callback when "Add to EHR" button is clicked */
  onAddToEHR: (medication: MedicationItem) => void;
  /** Whether the component is disabled */
  disabled?: boolean;
}

/**
 * Props for the LoadingIndicator sub-component
 */
export interface LoadingIndicatorProps {
  /** Whether to show the loading indicator */
  isLoading: boolean;
  /** Custom loading message */
  message?: string;
  /** Whether to show animation */
  animated?: boolean;
  /** Size of the loading indicator */
  size?: 'small' | 'medium' | 'large';
}

/**
 * Props for the ErrorMessage sub-component
 */
export interface ErrorMessageProps {
  /** Error message to display */
  error: string | null;
  /** Callback when retry button is clicked */
  onRetry?: () => void;
  /** Number of retry attempts made */
  retryCount?: number;
  /** Maximum number of retries allowed */
  maxRetries?: number;
  /** Whether to show the retry button */
  showRetry?: boolean;
}

/**
 * Props for the NotificationMessage sub-component
 */
export interface NotificationMessageProps {
  /** Notification message to display */
  message: string | null;
  /** Type of notification */
  type?: 'success' | 'info' | 'warning' | 'error';
  /** Callback when notification is dismissed */
  onDismiss?: () => void;
  /** Auto-dismiss timeout in milliseconds */
  autoHideDelay?: number;
}

/**
 * Return type for the useRxNormSearch custom hook
 */
export interface UseRxNormSearchReturn {
  /** Current search state */
  searchState: SearchState;
  /** Function to perform a search */
  performSearch: (query: string) => Promise<void>;
  /** Function to retry the last failed search */
  retrySearch: () => Promise<void>;
  /** Function to add a medication to EHR */
  addToEHR: (medication: MedicationItem) => void;
  /** Function to clear error state */
  clearError: () => void;
  /** Function to clear notification */
  clearNotification: () => void;
  /** Function to reset search state */
  resetSearch: () => void;
}

/**
 * Configuration options for the mock RxNorm service
 */
export interface RxNormServiceConfig {
  /** Base URL for the API (for future real implementation) */
  baseUrl?: string;
  /** API timeout in milliseconds */
  timeout?: number;
  /** Whether to use mock data */
  useMockData?: boolean;
  /** Delay for mock API responses (to simulate network latency) */
  mockDelay?: number;
  /** Probability of mock API failure (for testing error handling) */
  mockFailureRate?: number;
}