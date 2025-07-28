/*
 * Copyright (c) 2025 WebQx. All rights reserved.
 * Unauthorized copying of this file, via any medium, is strictly prohibited.
 * Proprietary and confidential.
 */

/**
 * Pharmacy Service - WebQX Healthcare Platform
 * 
 * This module provides pharmacy-related functionality including
 * fetching pharmacy options based on RxCUI codes.
 * 
 * Enhanced with:
 * - Strong TypeScript typing
 * - Robust error handling
 * - Input validation
 * - Timeout mechanism
 * - Comprehensive documentation
 */

/** Services offered by a pharmacy */
export type PharmacyService = 
  | 'prescription_filling'
  | 'consultation'
  | 'delivery'
  | 'immunizations'
  | '24hr_service'
  | 'compounding'
  | 'drive_through'
  | 'health_screening';

/** Pharmacy store information interface */
export interface PharmacyStore {
  /** Unique identifier for the pharmacy store */
  id: string;
  /** Display name of the pharmacy */
  name: string;
  /** Full address of the pharmacy location */
  address: string;
  /** Contact phone number */
  phone: string;
  /** Operating hours description */
  hours: string;
  /** Array of RxCUI codes that this pharmacy can fulfill */
  rxcui: string[];
  /** Services offered by this pharmacy */
  services: PharmacyService[];
  /** Customer rating (0-5 stars) */
  rating: number;
  /** Distance from patient location */
  distance: string;
}

/** Configuration options for the fetch operation */
export interface FetchPharmacyOptions {
  /** Timeout in milliseconds (default: 5000) */
  timeout?: number;
  /** Base URL for the API (default: current origin) */
  baseUrl?: string;
}

/** Custom error class for pharmacy service errors */
export class PharmacyServiceError extends Error {
  public readonly name = 'PharmacyServiceError';
  
  constructor(
    message: string,
    public readonly code: 'NETWORK_ERROR' | 'INVALID_JSON' | 'TIMEOUT' | 'VALIDATION_ERROR' | 'FILE_NOT_FOUND',
    public readonly originalError?: Error
  ) {
    super(message);
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, PharmacyServiceError.prototype);
  }
}

/**
 * Validates the rxcui parameter
 * @param rxcui - The RxCUI code to validate
 * @throws {PharmacyServiceError} When validation fails
 */
function validateRxcui(rxcui: string): void {
  if (typeof rxcui !== 'string') {
    throw new PharmacyServiceError(
      'RxCUI must be a string',
      'VALIDATION_ERROR'
    );
  }
  
  if (!rxcui.trim()) {
    throw new PharmacyServiceError(
      'RxCUI cannot be empty or whitespace only',
      'VALIDATION_ERROR'
    );
  }
  
  // Basic format validation - RxCUI should be numeric
  if (!/^\d+$/.test(rxcui.trim())) {
    throw new PharmacyServiceError(
      'RxCUI must contain only numeric characters',
      'VALIDATION_ERROR'
    );
  }
}

/**
 * Creates a fetch request with timeout support
 * @param url - The URL to fetch
 * @param timeout - Timeout in milliseconds
 * @returns Promise that resolves to Response or rejects on timeout
 */
function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      reject(new PharmacyServiceError(
        `Request timed out after ${timeout}ms`,
        'TIMEOUT'
      ));
    }, timeout);

    fetch(url, { signal: controller.signal })
      .then(response => {
        clearTimeout(timeoutId);
        resolve(response);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          reject(new PharmacyServiceError(
            `Request timed out after ${timeout}ms`,
            'TIMEOUT'
          ));
        } else {
          reject(error);
        }
      });
  });
}

/**
 * Fetches mock pharmacy options based on RxCUI code
 * 
 * This function retrieves pharmacy stores that can fulfill prescriptions
 * for the given RxCUI (RxNorm Concept Unique Identifier) code.
 * 
 * Enhanced Features:
 * - Strong TypeScript typing with proper interfaces
 * - Input validation for rxcui parameter
 * - Robust error handling for network and parsing errors
 * - Configurable timeout mechanism
 * - Graceful handling of missing or malformed data files
 * 
 * @param rxcui - The RxCUI code to search for (must be non-empty string of digits)
 * @param options - Configuration options for the fetch operation
 * @returns Promise resolving to array of matching pharmacy stores
 * @throws {PharmacyServiceError} For validation errors, network issues, or timeout
 * 
 * @example
 * ```typescript
 * try {
 *   const pharmacies = await fetchMockPharmacyOptions('123456');
 *   console.log(`Found ${pharmacies.length} pharmacies`);
 * } catch (error) {
 *   if (error instanceof PharmacyServiceError) {
 *     console.error(`Pharmacy service error: ${error.message}`);
 *   }
 * }
 * ```
 */
export async function fetchMockPharmacyOptions(
  rxcui: string,
  options: FetchPharmacyOptions = {}
): Promise<PharmacyStore[]> {
  // Validate input parameters
  validateRxcui(rxcui);
  
  // Set default options
  const {
    timeout = 5000,
    baseUrl = ''
  } = options;
  
  // Construct URL for mock data
  const url = `${baseUrl}/mockStores.json`;
  
  try {
    // Fetch with timeout support
    const response = await fetchWithTimeout(url, timeout);
    
    // Check if response is ok
    if (!response.ok) {
      if (response.status === 404) {
        throw new PharmacyServiceError(
          'Mock stores data file not found. Please ensure mockStores.json is available.',
          'FILE_NOT_FOUND'
        );
      }
      throw new PharmacyServiceError(
        `HTTP Error: ${response.status} ${response.statusText}`,
        'NETWORK_ERROR'
      );
    }
    
    // Parse JSON response
    let stores: PharmacyStore[];
    try {
      stores = await response.json();
    } catch (parseError) {
      throw new PharmacyServiceError(
        'Invalid JSON response from mock stores data file',
        'INVALID_JSON',
        parseError as Error
      );
    }
    
    // Validate that stores is an array
    if (!Array.isArray(stores)) {
      throw new PharmacyServiceError(
        'Mock stores data must be an array',
        'INVALID_JSON'
      );
    }
    
    // Filter stores that have the requested rxcui
    const normalizedRxcui = rxcui.trim();
    const matchingStores = stores.filter((store: PharmacyStore) => {
      // Validate store structure
      if (!store || typeof store !== 'object' || !Array.isArray(store.rxcui)) {
        return false;
      }
      
      // Check if any of the store's rxcui codes match
      return store.rxcui.includes(normalizedRxcui);
    });
    
    return matchingStores;
    
  } catch (error) {
    // Re-throw PharmacyServiceError as-is
    if (error instanceof PharmacyServiceError) {
      throw error;
    }
    
    // Wrap other errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new PharmacyServiceError(
        'Network error: Unable to connect to pharmacy service',
        'NETWORK_ERROR',
        error
      );
    }
    
    // Generic error fallback
    throw new PharmacyServiceError(
      `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'NETWORK_ERROR',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Helper function to get all available pharmacy stores (for debugging/testing)
 * @param options - Configuration options for the fetch operation
 * @returns Promise resolving to all pharmacy stores
 */
export async function getAllMockPharmacyStores(
  options: FetchPharmacyOptions = {}
): Promise<PharmacyStore[]> {
  const {
    timeout = 5000,
    baseUrl = ''
  } = options;
  
  const url = `${baseUrl}/mockStores.json`;
  
  try {
    const response = await fetchWithTimeout(url, timeout);
    
    if (!response.ok) {
      throw new PharmacyServiceError(
        `HTTP Error: ${response.status} ${response.statusText}`,
        'NETWORK_ERROR'
      );
    }
    
    const stores: PharmacyStore[] = await response.json();
    
    if (!Array.isArray(stores)) {
      throw new PharmacyServiceError(
        'Mock stores data must be an array',
        'INVALID_JSON'
      );
    }
    
    return stores;
    
  } catch (error) {
    if (error instanceof PharmacyServiceError) {
      throw error;
    }
    
    throw new PharmacyServiceError(
      `Failed to fetch all pharmacy stores: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'NETWORK_ERROR',
      error instanceof Error ? error : undefined
    );
  }
}