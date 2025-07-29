/**
 * EHR Integration Utility Functions
 * 
 * Common utility functions for EHR operations with error handling,
 * validation, and data transformation capabilities.
 */

import { EHRError, Patient, Medication, Allergy } from '../types';

/**
 * Validation result interface
 */
export interface ValidationResult {
  /** Whether validation passed */
  isValid: boolean;
  /** Array of validation error messages */
  errors: string[];
  /** Array of validation warnings */
  warnings?: string[];
}

/**
 * Validate patient data for completeness and correctness
 * 
 * @param patient - Patient data to validate
 * @returns Validation result with errors and warnings
 */
export function validatePatientData(patient: Partial<Patient>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required field validation
  if (!patient.firstName?.trim()) {
    errors.push('First name is required');
  }
  
  if (!patient.lastName?.trim()) {
    errors.push('Last name is required');
  }
  
  if (!patient.dateOfBirth) {
    errors.push('Date of birth is required');
  } else {
    // Validate date of birth is not in the future
    if (new Date(patient.dateOfBirth) > new Date()) {
      errors.push('Date of birth cannot be in the future');
    }
    
    // Validate reasonable age range
    const age = calculateAge(patient.dateOfBirth);
    if (age > 150) {
      errors.push('Date of birth indicates an unrealistic age');
    }
    if (age < 0) {
      errors.push('Date of birth cannot be in the future');
    }
  }
  
  if (!patient.mrn?.trim()) {
    errors.push('Medical record number (MRN) is required');
  }

  // Format validation
  if (patient.email && !isValidEmail(patient.email)) {
    errors.push('Email address format is invalid');
  }
  
  if (patient.phone && !isValidPhoneNumber(patient.phone)) {
    warnings.push('Phone number format may be invalid');
  }

  // Address validation
  if (patient.address) {
    if (!patient.address.street1?.trim()) {
      errors.push('Street address is required when address is provided');
    }
    if (!patient.address.city?.trim()) {
      errors.push('City is required when address is provided');
    }
    if (!patient.address.state?.trim()) {
      errors.push('State is required when address is provided');
    }
    if (!patient.address.postalCode?.trim()) {
      errors.push('Postal code is required when address is provided');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate medication data
 * 
 * @param medications - Array of medications to validate
 * @returns Validation result
 */
export function validateMedications(medications: Medication[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  medications.forEach((medication, index) => {
    const prefix = `Medication ${index + 1}:`;
    
    if (!medication.name?.trim()) {
      errors.push(`${prefix} Name is required`);
    }
    
    if (!medication.dosage?.trim()) {
      errors.push(`${prefix} Dosage is required`);
    }
    
    if (!medication.frequency?.trim()) {
      errors.push(`${prefix} Frequency is required`);
    }
    
    if (!medication.route?.trim()) {
      errors.push(`${prefix} Route of administration is required`);
    }

    // Date validation
    if (medication.startDate && medication.endDate) {
      if (new Date(medication.endDate) <= new Date(medication.startDate)) {
        errors.push(`${prefix} End date must be after start date`);
      }
    }
    
    if (medication.endDate && new Date(medication.endDate) > new Date()) {
      warnings.push(`${prefix} End date is in the future`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate allergy data
 * 
 * @param allergies - Array of allergies to validate
 * @returns Validation result
 */
export function validateAllergies(allergies: Allergy[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  allergies.forEach((allergy, index) => {
    const prefix = `Allergy ${index + 1}:`;
    
    if (!allergy.allergen?.trim()) {
      errors.push(`${prefix} Allergen name is required`);
    }
    
    if (!allergy.reaction?.trim()) {
      errors.push(`${prefix} Reaction description is required`);
    }
    
    if (!allergy.severity) {
      errors.push(`${prefix} Severity level is required`);
    }

    // Date validation
    if (allergy.identifiedDate && new Date(allergy.identifiedDate) > new Date()) {
      warnings.push(`${prefix} Identification date is in the future`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Calculate age from date of birth
 * 
 * @param dateOfBirth - Date of birth
 * @returns Age in years
 */
export function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Validate email address format
 * 
 * @param email - Email address to validate
 * @returns True if valid email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate phone number format (US format)
 * 
 * @param phone - Phone number to validate
 * @returns True if valid phone format
 */
export function isValidPhoneNumber(phone: string): boolean {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Check for valid US phone number (10 or 11 digits)
  return digits.length === 10 || (digits.length === 11 && digits[0] === '1');
}

/**
 * Format phone number for display
 * 
 * @param phone - Raw phone number
 * @returns Formatted phone number string
 */
export function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  
  if (digits.length === 11 && digits[0] === '1') {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  
  return phone; // Return original if can't format
}

/**
 * Sanitize string input to prevent XSS and ensure clean data
 * 
 * @param input - String to sanitize
 * @returns Sanitized string
 */
export function sanitizeString(input: string): string {
  if (!input) return '';
  
  return input
    .trim()
    .replace(/[<>\"'&]/g, '') // Remove potentially dangerous characters
    .substring(0, 1000); // Limit length
}

/**
 * Generate unique identifier for EHR records
 * 
 * @param prefix - Optional prefix for the ID
 * @returns Unique identifier string
 */
export function generateEHRId(prefix: string = 'ehr'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Format date for EHR display
 * 
 * @param date - Date to format
 * @param includeTime - Whether to include time in the format
 * @returns Formatted date string
 */
export function formatEHRDate(date: Date, includeTime: boolean = false): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  };
  
  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.hour12 = true;
  }
  
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

/**
 * Create standardized error message for user display
 * 
 * @param error - EHR error object
 * @returns User-friendly error message
 */
export function createUserFriendlyErrorMessage(error: EHRError): string {
  // Map technical error codes to user-friendly messages
  const errorMessages: Record<string, string> = {
    'INVALID_PATIENT_ID': 'Please provide a valid patient identifier.',
    'MISSING_REQUIRED_FIELDS': 'Please fill in all required fields before proceeding.',
    'API_REQUEST_FAILED': 'We are experiencing technical difficulties. Please try again in a few moments.',
    'NETWORK_ERROR': 'Connection problem detected. Please check your internet connection and try again.',
    'TIMEOUT_ERROR': 'The operation is taking longer than expected. Please try again.',
    'AUTHENTICATION_FAILED': 'Authentication error. Please log in again.',
    'AUTHORIZATION_FAILED': 'You do not have permission to perform this action.',
    'RESOURCE_NOT_FOUND': 'The requested information could not be found.',
    'VALIDATION_ERROR': 'Please check your input and correct any errors.',
    'DUPLICATE_RECORD': 'A record with this information already exists.',
    'SYSTEM_MAINTENANCE': 'The system is currently under maintenance. Please try again later.'
  };
  
  const userMessage = errorMessages[error.code];
  if (userMessage) {
    return userMessage;
  }
  
  // Fallback to sanitized error message
  return sanitizeString(error.message) || 'An unexpected error occurred. Please try again.';
}

/**
 * Retry operation with exponential backoff
 * 
 * @param operation - Async operation to retry
 * @param maxAttempts - Maximum number of retry attempts
 * @param baseDelay - Base delay in milliseconds
 * @returns Promise with operation result
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt === maxAttempts) {
        throw lastError;
      }
      
      // Wait with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Debounce function for search and input operations
 * 
 * @param func - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Deep clone object to avoid mutation issues
 * 
 * @param obj - Object to clone
 * @returns Deep cloned object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as unknown as T;
  }
  
  const cloned = {} as T;
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  
  return cloned;
}