/**
 * Validation Utilities for EHR Integration
 * 
 * Comprehensive validation functions for EHR configurations, patient data,
 * and other system inputs. Ensures data integrity and compliance with
 * healthcare standards and regulations.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { EHRConfiguration, PatientDemographics, EHRSystemType } from '../types';

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  isValid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
}

/**
 * Validation rule function type
 */
export type ValidationRule<T> = (value: T) => ValidationResult;

// ============================================================================
// EHR Configuration Validation
// ============================================================================

/**
 * Validate EHR configuration
 * @param config EHR configuration to validate
 * @returns Array of validation errors
 */
export function validateEHRConfiguration(config: EHRConfiguration): string[] {
  const errors: string[] = [];

  // Required field validation
  if (!config.id || config.id.trim().length === 0) {
    errors.push('Configuration ID is required');
  }

  if (!config.name || config.name.trim().length === 0) {
    errors.push('Configuration name is required');
  }

  if (!config.systemType) {
    errors.push('System type is required');
  } else if (!isValidEHRSystemType(config.systemType)) {
    errors.push(`Invalid system type: ${config.systemType}`);
  }

  if (!config.baseUrl || !isValidUrl(config.baseUrl)) {
    errors.push('Valid base URL is required');
  }

  if (!config.apiVersion || config.apiVersion.trim().length === 0) {
    errors.push('API version is required');
  }

  // Authentication validation
  const authErrors = validateEHRAuthentication(config.authentication);
  errors.push(...authErrors);

  // Timeout validation
  if (config.timeoutMs <= 0 || config.timeoutMs > 300000) {
    errors.push('Timeout must be between 1ms and 300000ms (5 minutes)');
  }

  // Retry configuration validation
  if (config.retryConfig) {
    const retryErrors = validateRetryConfiguration(config.retryConfig);
    errors.push(...retryErrors);
  }

  return errors;
}

/**
 * Validate EHR authentication configuration
 * @param auth Authentication configuration
 * @returns Array of validation errors
 */
function validateEHRAuthentication(auth: EHRConfiguration['authentication']): string[] {
  const errors: string[] = [];

  if (!auth.type) {
    errors.push('Authentication type is required');
    return errors;
  }

  switch (auth.type) {
    case 'oauth2':
      if (!auth.clientId) {
        errors.push('Client ID is required for OAuth2 authentication');
      }
      if (!auth.clientSecret) {
        errors.push('Client secret is required for OAuth2 authentication');
      }
      if (!auth.tokenEndpoint || !isValidUrl(auth.tokenEndpoint)) {
        errors.push('Valid token endpoint is required for OAuth2 authentication');
      }
      if (auth.scopes && auth.scopes.length === 0) {
        errors.push('At least one scope is required for OAuth2 authentication');
      }
      break;

    case 'apikey':
      if (!auth.apiKey) {
        errors.push('API key is required for API key authentication');
      }
      break;

    case 'basic':
      if (!auth.username) {
        errors.push('Username is required for basic authentication');
      }
      if (!auth.password) {
        errors.push('Password is required for basic authentication');
      }
      break;

    case 'certificate':
      if (!auth.certificatePath) {
        errors.push('Certificate path is required for certificate authentication');
      }
      break;

    case 'jwt':
      // JWT might use client credentials or certificate
      if (!auth.clientId && !auth.certificatePath) {
        errors.push('Either client ID or certificate path is required for JWT authentication');
      }
      break;

    default:
      errors.push(`Unknown authentication type: ${auth.type}`);
      break;
  }

  return errors;
}

/**
 * Validate retry configuration
 * @param retryConfig Retry configuration
 * @returns Array of validation errors
 */
function validateRetryConfiguration(retryConfig: EHRConfiguration['retryConfig']): string[] {
  const errors: string[] = [];

  if (retryConfig.maxAttempts < 0 || retryConfig.maxAttempts > 10) {
    errors.push('Max retry attempts must be between 0 and 10');
  }

  if (retryConfig.initialDelayMs < 0 || retryConfig.initialDelayMs > 60000) {
    errors.push('Initial retry delay must be between 0 and 60000ms (1 minute)');
  }

  if (retryConfig.backoffMultiplier < 1 || retryConfig.backoffMultiplier > 10) {
    errors.push('Backoff multiplier must be between 1 and 10');
  }

  if (retryConfig.maxDelayMs < retryConfig.initialDelayMs) {
    errors.push('Max delay must be greater than or equal to initial delay');
  }

  if (retryConfig.maxDelayMs > 300000) {
    errors.push('Max delay cannot exceed 300000ms (5 minutes)');
  }

  return errors;
}

// ============================================================================
// Patient Data Validation
// ============================================================================

/**
 * Validate patient medical record number
 * @param mrn Medical record number
 * @returns Whether MRN is valid
 */
export function validatePatientMrn(mrn: string): boolean {
  if (!mrn || typeof mrn !== 'string') {
    return false;
  }

  // MRN should be alphanumeric, at least 3 characters, max 20 characters
  const mrnRegex = /^[A-Za-z0-9]{3,20}$/;
  return mrnRegex.test(mrn.trim());
}

/**
 * Validate patient demographics
 * @param demographics Patient demographics
 * @returns Validation result
 */
export function validatePatientDemographics(demographics: PatientDemographics): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!demographics.mrn || !validatePatientMrn(demographics.mrn)) {
    errors.push('Valid medical record number is required');
  }

  if (!demographics.firstName || demographics.firstName.trim().length === 0) {
    errors.push('First name is required');
  } else if (demographics.firstName.length > 50) {
    errors.push('First name cannot exceed 50 characters');
  }

  if (!demographics.lastName || demographics.lastName.trim().length === 0) {
    errors.push('Last name is required');
  } else if (demographics.lastName.length > 50) {
    errors.push('Last name cannot exceed 50 characters');
  }

  if (!demographics.dateOfBirth) {
    errors.push('Date of birth is required');
  } else if (!isValidDate(demographics.dateOfBirth)) {
    errors.push('Valid date of birth is required');
  } else if (demographics.dateOfBirth > new Date()) {
    errors.push('Date of birth cannot be in the future');
  } else if (isAgeOver(demographics.dateOfBirth, 150)) {
    warnings.push('Patient age appears to be over 150 years');
  }

  if (!demographics.gender) {
    errors.push('Gender is required');
  } else if (!['male', 'female', 'other', 'unknown'].includes(demographics.gender)) {
    errors.push('Invalid gender value');
  }

  // Optional field validation
  if (demographics.ssn && !validateSSN(demographics.ssn)) {
    errors.push('Invalid Social Security Number format');
  }

  if (demographics.phoneNumber && !validatePhoneNumber(demographics.phoneNumber)) {
    warnings.push('Phone number format may be invalid');
  }

  if (demographics.email && !validateEmail(demographics.email)) {
    errors.push('Invalid email address format');
  }

  // Address validation
  if (demographics.address) {
    const addressErrors = validateAddress(demographics.address);
    errors.push(...addressErrors);
  }

  // Emergency contact validation
  if (demographics.emergencyContact) {
    const contactErrors = validateEmergencyContact(demographics.emergencyContact);
    errors.push(...contactErrors);
  }

  // Insurance validation
  if (demographics.insurance && demographics.insurance.length > 0) {
    const insuranceErrors = validateInsurance(demographics.insurance);
    errors.push(...insuranceErrors);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate patient address
 * @param address Patient address
 * @returns Array of validation errors
 */
function validateAddress(address: PatientDemographics['address']): string[] {
  const errors: string[] = [];

  if (!address) return errors;

  if (!address.street1 || address.street1.trim().length === 0) {
    errors.push('Street address is required');
  }

  if (!address.city || address.city.trim().length === 0) {
    errors.push('City is required');
  }

  if (!address.state || address.state.trim().length === 0) {
    errors.push('State is required');
  }

  if (!address.zipCode || !validateZipCode(address.zipCode)) {
    errors.push('Valid ZIP code is required');
  }

  if (!address.country || address.country.trim().length === 0) {
    errors.push('Country is required');
  }

  if (!address.type || !['home', 'work', 'temporary', 'other'].includes(address.type)) {
    errors.push('Valid address type is required');
  }

  return errors;
}

/**
 * Validate emergency contact
 * @param contact Emergency contact
 * @returns Array of validation errors
 */
function validateEmergencyContact(contact: PatientDemographics['emergencyContact']): string[] {
  const errors: string[] = [];

  if (!contact) return errors;

  if (!contact.name || contact.name.trim().length === 0) {
    errors.push('Emergency contact name is required');
  }

  if (!contact.relationship || contact.relationship.trim().length === 0) {
    errors.push('Emergency contact relationship is required');
  }

  if (!contact.phoneNumber || !validatePhoneNumber(contact.phoneNumber)) {
    errors.push('Valid emergency contact phone number is required');
  }

  if (contact.email && !validateEmail(contact.email)) {
    errors.push('Invalid emergency contact email format');
  }

  return errors;
}

/**
 * Validate insurance information
 * @param insurance Array of insurance information
 * @returns Array of validation errors
 */
function validateInsurance(insurance: NonNullable<PatientDemographics['insurance']>): string[] {
  const errors: string[] = [];

  if (insurance.length === 0) {
    return errors;
  }

  const primaryInsurances = insurance.filter(ins => ins.isPrimary);
  if (primaryInsurances.length === 0) {
    errors.push('At least one primary insurance is required');
  } else if (primaryInsurances.length > 1) {
    errors.push('Only one primary insurance is allowed');
  }

  insurance.forEach((ins, index) => {
    if (!ins.providerName || ins.providerName.trim().length === 0) {
      errors.push(`Insurance ${index + 1}: Provider name is required`);
    }

    if (!ins.policyNumber || ins.policyNumber.trim().length === 0) {
      errors.push(`Insurance ${index + 1}: Policy number is required`);
    }

    if (!ins.subscriberId || ins.subscriberId.trim().length === 0) {
      errors.push(`Insurance ${index + 1}: Subscriber ID is required`);
    }

    if (!ins.effectiveDate || !isValidDate(ins.effectiveDate)) {
      errors.push(`Insurance ${index + 1}: Valid effective date is required`);
    }

    if (ins.endDate && (!isValidDate(ins.endDate) || ins.endDate <= ins.effectiveDate)) {
      errors.push(`Insurance ${index + 1}: End date must be after effective date`);
    }
  });

  return errors;
}

// ============================================================================
// Medical Data Validation
// ============================================================================

/**
 * Validate ICD-10 code format
 * @param code ICD-10 code
 * @returns Whether code is valid format
 */
export function validateICD10Code(code: string): boolean {
  if (!code || typeof code !== 'string') {
    return false;
  }

  // Basic ICD-10 format: 3-7 characters, letter followed by numbers and possibly letters
  const icd10Regex = /^[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$/;
  return icd10Regex.test(code.trim().toUpperCase());
}

/**
 * Validate CPT code format
 * @param code CPT code
 * @returns Whether code is valid format
 */
export function validateCPTCode(code: string): boolean {
  if (!code || typeof code !== 'string') {
    return false;
  }

  // CPT codes are 5 digits
  const cptRegex = /^[0-9]{5}$/;
  return cptRegex.test(code.trim());
}

/**
 * Validate RxCUI code format
 * @param code RxCUI code
 * @returns Whether code is valid format
 */
export function validateRxCUICode(code: string): boolean {
  if (!code || typeof code !== 'string') {
    return false;
  }

  // RxCUI codes are numeric, typically 1-8 digits
  const rxcuiRegex = /^[0-9]{1,8}$/;
  return rxcuiRegex.test(code.trim());
}

/**
 * Validate LOINC code format
 * @param code LOINC code
 * @returns Whether code is valid format
 */
export function validateLOINCCode(code: string): boolean {
  if (!code || typeof code !== 'string') {
    return false;
  }

  // LOINC codes: 1-5 digits, dash, 1 check digit
  const loincRegex = /^[0-9]{1,5}-[0-9]$/;
  return loincRegex.test(code.trim());
}

/**
 * Validate NPI (National Provider Identifier)
 * @param npi NPI number
 * @returns Whether NPI is valid
 */
export function validateNPI(npi: string): boolean {
  if (!npi || typeof npi !== 'string') {
    return false;
  }

  const cleanNPI = npi.replace(/\D/g, '');
  
  // NPI must be exactly 10 digits
  if (cleanNPI.length !== 10) {
    return false;
  }

  // Luhn algorithm check
  return luhnCheck(cleanNPI);
}

// ============================================================================
// General Validation Utilities
// ============================================================================

/**
 * Check if value is a valid URL
 * @param url URL to validate
 * @returns Whether URL is valid
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if value is a valid email
 * @param email Email to validate
 * @returns Whether email is valid
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if value is a valid phone number
 * @param phone Phone number to validate
 * @returns Whether phone number is valid
 */
export function validatePhoneNumber(phone: string): boolean {
  // Remove all non-digits
  const cleanPhone = phone.replace(/\D/g, '');
  
  // US phone numbers: 10 digits, optionally with country code
  return cleanPhone.length === 10 || (cleanPhone.length === 11 && cleanPhone.startsWith('1'));
}

/**
 * Check if value is a valid SSN
 * @param ssn SSN to validate
 * @returns Whether SSN is valid format
 */
export function validateSSN(ssn: string): boolean {
  // Remove all non-digits
  const cleanSSN = ssn.replace(/\D/g, '');
  
  // SSN must be exactly 9 digits
  if (cleanSSN.length !== 9) {
    return false;
  }
  
  // Check for invalid patterns
  const invalidPatterns = [
    '000000000', // All zeros
    '111111111', // All ones
    '123456789', // Sequential
    '987654321'  // Reverse sequential
  ];
  
  if (invalidPatterns.includes(cleanSSN)) {
    return false;
  }
  
  // First 3 digits cannot be 000, 666, or 900-999
  const area = cleanSSN.substring(0, 3);
  if (area === '000' || area === '666' || parseInt(area) >= 900) {
    return false;
  }
  
  // Middle 2 digits cannot be 00
  const group = cleanSSN.substring(3, 5);
  if (group === '00') {
    return false;
  }
  
  // Last 4 digits cannot be 0000
  const serial = cleanSSN.substring(5, 9);
  if (serial === '0000') {
    return false;
  }
  
  return true;
}

/**
 * Check if value is a valid ZIP code
 * @param zipCode ZIP code to validate
 * @returns Whether ZIP code is valid
 */
export function validateZipCode(zipCode: string): boolean {
  // US ZIP codes: 5 digits or 5+4 format
  const zipRegex = /^\d{5}(-\d{4})?$/;
  return zipRegex.test(zipCode.trim());
}

/**
 * Check if date is valid
 * @param date Date to validate
 * @returns Whether date is valid
 */
export function isValidDate(date: Date): boolean {
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Check if person is over a certain age
 * @param dateOfBirth Date of birth
 * @param age Age to check
 * @returns Whether person is over the specified age
 */
export function isAgeOver(dateOfBirth: Date, age: number): boolean {
  const today = new Date();
  const ageDate = new Date(today.getFullYear() - age, today.getMonth(), today.getDate());
  return dateOfBirth < ageDate;
}

/**
 * Check if EHR system type is valid
 * @param systemType System type to validate
 * @returns Whether system type is valid
 */
export function isValidEHRSystemType(systemType: string): systemType is EHRSystemType {
  const validTypes: EHRSystemType[] = [
    'epic', 'cerner', 'allscripts', 'athenahealth', 'nextgen',
    'eclinicalworks', 'meditech', 'custom', 'fhir_generic'
  ];
  return validTypes.includes(systemType as EHRSystemType);
}

/**
 * Luhn algorithm for validating identification numbers
 * @param value Number string to validate
 * @returns Whether number passes Luhn check
 */
function luhnCheck(value: string): boolean {
  let sum = 0;
  let alternate = false;

  for (let i = value.length - 1; i >= 0; i--) {
    let digit = parseInt(value[i]);

    if (alternate) {
      digit *= 2;
      if (digit > 9) {
        digit = Math.floor(digit / 10) + (digit % 10);
      }
    }

    sum += digit;
    alternate = !alternate;
  }

  return sum % 10 === 0;
}

// ============================================================================
// Composite Validation Functions
// ============================================================================

/**
 * Validate multiple values with rules
 * @param values Object with values to validate
 * @param rules Object with validation rules
 * @returns Combined validation result
 */
export function validateWithRules<T extends Record<string, unknown>>(
  values: T,
  rules: Partial<Record<keyof T, ValidationRule<T[keyof T]>>>
): ValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  Object.keys(rules).forEach(key => {
    const rule = rules[key];
    const value = values[key];

    if (rule) {
      const result = rule(value);
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
    }
  });

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings
  };
}

/**
 * Create a required field validation rule
 * @param fieldName Name of the field
 * @returns Validation rule function
 */
export function required(fieldName: string): ValidationRule<unknown> {
  return (value: unknown): ValidationResult => {
    const isValid = value !== null && value !== undefined && 
                   (typeof value !== 'string' || value.trim().length > 0);
    
    return {
      isValid,
      errors: isValid ? [] : [`${fieldName} is required`],
      warnings: []
    };
  };
}

/**
 * Create a string length validation rule
 * @param fieldName Name of the field
 * @param minLength Minimum length
 * @param maxLength Maximum length
 * @returns Validation rule function
 */
export function stringLength(
  fieldName: string, 
  minLength: number, 
  maxLength: number
): ValidationRule<string> {
  return (value: string): ValidationResult => {
    const errors: string[] = [];
    
    if (typeof value !== 'string') {
      errors.push(`${fieldName} must be a string`);
    } else if (value.length < minLength) {
      errors.push(`${fieldName} must be at least ${minLength} characters long`);
    } else if (value.length > maxLength) {
      errors.push(`${fieldName} cannot exceed ${maxLength} characters`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  };
}

/**
 * Create a regex pattern validation rule
 * @param fieldName Name of the field
 * @param pattern Regex pattern
 * @param errorMessage Error message for validation failure
 * @returns Validation rule function
 */
export function pattern(
  fieldName: string,
  pattern: RegExp,
  errorMessage: string
): ValidationRule<string> {
  return (value: string): ValidationResult => {
    const isValid = typeof value === 'string' && pattern.test(value);
    
    return {
      isValid,
      errors: isValid ? [] : [`${fieldName}: ${errorMessage}`],
      warnings: []
    };
  };
}

export default {
  validateEHRConfiguration,
  validatePatientMrn,
  validatePatientDemographics,
  validateICD10Code,
  validateCPTCode,
  validateRxCUICode,
  validateLOINCCode,
  validateNPI,
  isValidUrl,
  validateEmail,
  validatePhoneNumber,
  validateSSN,
  validateZipCode,
  isValidDate,
  isAgeOver,
  isValidEHRSystemType,
  validateWithRules,
  required,
  stringLength,
  pattern
};