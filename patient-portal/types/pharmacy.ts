/**
 * TypeScript interfaces for Pharmacy-related data types
 */

/** Represents a pharmacy store with location and pricing information */
export interface PharmacyStore {
  /** Unique identifier for the pharmacy */
  id: string;
  /** Name of the pharmacy */
  name: string;
  /** Current status of the pharmacy (e.g., 'Open', 'Closed', 'Limited Hours') */
  status: string;
  /** Price of the medication at this pharmacy in USD */
  price: number;
  /** Distance from the patient's location in miles */
  distance: number;
  /** Street address of the pharmacy */
  address?: string;
  /** Phone number of the pharmacy */
  phone?: string;
  /** Whether this pharmacy offers the best price */
  isBestPrice?: boolean;
  /** Whether this is the closest pharmacy */
  isClosest?: boolean;
}

/** Props for the PharmacyLocator component */
export interface PharmacyLocatorProps {
  /** RxCUI (RxNorm Concept Unique Identifier) for the medication */
  rxcui: string;
  /** Optional CSS class name for styling */
  className?: string;
}

/** API response structure for pharmacy options */
export interface PharmacyApiResponse {
  /** Array of pharmacy stores */
  stores: PharmacyStore[];
  /** Timestamp of when the data was last updated */
  lastUpdated: string;
  /** Success status of the API call */
  success: boolean;
}

/** Error structure for pharmacy API failures */
export interface PharmacyApiError {
  /** Error message */
  message: string;
  /** Error code if available */
  code?: string;
  /** Additional error details */
  details?: string;
}