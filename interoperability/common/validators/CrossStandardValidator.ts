/**
 * Cross-Standard Data Validator
 * Provides validation utilities for different healthcare standards
 */

import { FHIRResource } from '../../fhir/common/types/base';
import { OpenEHRComposition } from '../../openehr/services/OpenEHRService';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
  severity: 'error' | 'fatal';
}

export interface ValidationWarning {
  path: string;
  message: string;
  code: string;
}

export class CrossStandardValidator {
  /**
   * Validate FHIR resource
   */
  static validateFHIRResource(resource: FHIRResource): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Basic FHIR validation
    if (!resource.resourceType) {
      errors.push({
        path: 'resourceType',
        message: 'resourceType is required',
        code: 'FHIR_MISSING_RESOURCE_TYPE',
        severity: 'error',
      });
    }

    // Validate meta if present
    if (resource.meta) {
      if (resource.meta.lastUpdated && !this.isValidDateTime(resource.meta.lastUpdated)) {
        errors.push({
          path: 'meta.lastUpdated',
          message: 'Invalid datetime format',
          code: 'FHIR_INVALID_DATETIME',
          severity: 'error',
        });
      }
    }

    // Validate language code if present
    if (resource.language && !this.isValidLanguageCode(resource.language)) {
      warnings.push({
        path: 'language',
        message: 'Language code should follow BCP 47',
        code: 'FHIR_INVALID_LANGUAGE',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate openEHR composition
   */
  static validateOpenEHRComposition(composition: OpenEHRComposition): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Basic openEHR validation
    if (!composition.archetype_node_id) {
      errors.push({
        path: 'archetype_node_id',
        message: 'archetype_node_id is required',
        code: 'OPENEHR_MISSING_ARCHETYPE_ID',
        severity: 'error',
      });
    }

    if (!composition.name || !composition.name.value) {
      errors.push({
        path: 'name.value',
        message: 'Composition name is required',
        code: 'OPENEHR_MISSING_NAME',
        severity: 'error',
      });
    }

    if (!composition.composer || !composition.composer.name) {
      errors.push({
        path: 'composer.name',
        message: 'Composer name is required',
        code: 'OPENEHR_MISSING_COMPOSER',
        severity: 'error',
      });
    }

    // Validate language code
    if (composition.language && !this.isValidLanguageCode(composition.language.code_string)) {
      warnings.push({
        path: 'language.code_string',
        message: 'Language code should follow ISO 639-1',
        code: 'OPENEHR_INVALID_LANGUAGE',
      });
    }

    // Validate territory code
    if (composition.territory && !this.isValidTerritoryCode(composition.territory.code_string)) {
      warnings.push({
        path: 'territory.code_string',
        message: 'Territory code should follow ISO 3166-1',
        code: 'OPENEHR_INVALID_TERRITORY',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate healthcare identifier
   */
  static validateHealthcareIdentifier(identifier: string, system?: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!identifier || identifier.trim().length === 0) {
      errors.push({
        path: 'identifier',
        message: 'Identifier cannot be empty',
        code: 'INVALID_IDENTIFIER_EMPTY',
        severity: 'error',
      });
    }

    // System-specific validation
    if (system) {
      switch (system.toLowerCase()) {
        case 'ssn':
        case 'social_security':
          if (!this.isValidSSN(identifier)) {
            errors.push({
              path: 'identifier',
              message: 'Invalid Social Security Number format',
              code: 'INVALID_SSN_FORMAT',
              severity: 'error',
            });
          }
          break;
        case 'mrn':
        case 'medical_record_number':
          if (!this.isValidMRN(identifier)) {
            warnings.push({
              path: 'identifier',
              message: 'Medical Record Number format may not be standard',
              code: 'NONSTANDARD_MRN_FORMAT',
            });
          }
          break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate clinical coding
   */
  static validateClinicalCoding(code: string, system: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!code || code.trim().length === 0) {
      errors.push({
        path: 'code',
        message: 'Code cannot be empty',
        code: 'INVALID_CODE_EMPTY',
        severity: 'error',
      });
    }

    if (!system || system.trim().length === 0) {
      errors.push({
        path: 'system',
        message: 'Code system cannot be empty',
        code: 'INVALID_SYSTEM_EMPTY',
        severity: 'error',
      });
    }

    // System-specific validation
    if (system && code) {
      switch (system.toLowerCase()) {
        case 'http://snomed.info/sct':
        case 'snomed':
          if (!this.isValidSNOMEDCode(code)) {
            errors.push({
              path: 'code',
              message: 'Invalid SNOMED CT code format',
              code: 'INVALID_SNOMED_FORMAT',
              severity: 'error',
            });
          }
          break;
        case 'http://hl7.org/fhir/sid/icd-10':
        case 'icd-10':
          if (!this.isValidICD10Code(code)) {
            errors.push({
              path: 'code',
              message: 'Invalid ICD-10 code format',
              code: 'INVALID_ICD10_FORMAT',
              severity: 'error',
            });
          }
          break;
        case 'http://loinc.org':
        case 'loinc':
          if (!this.isValidLOINCCode(code)) {
            errors.push({
              path: 'code',
              message: 'Invalid LOINC code format',
              code: 'INVALID_LOINC_FORMAT',
              severity: 'error',
            });
          }
          break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // Utility validation methods
  private static isValidDateTime(dateTime: string): boolean {
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/;
    return iso8601Regex.test(dateTime);
  }

  private static isValidLanguageCode(code: string): boolean {
    // Basic check for BCP 47 language tags
    const bcp47Regex = /^[a-z]{2,3}(?:-[A-Z]{2})?(?:-[a-z]+)*$/;
    return bcp47Regex.test(code);
  }

  private static isValidTerritoryCode(code: string): boolean {
    // Basic check for ISO 3166-1 alpha-2 country codes
    const iso3166Regex = /^[A-Z]{2}$/;
    return iso3166Regex.test(code);
  }

  private static isValidSSN(ssn: string): boolean {
    // Basic SSN format validation (XXX-XX-XXXX)
    const ssnRegex = /^\d{3}-\d{2}-\d{4}$/;
    return ssnRegex.test(ssn);
  }

  private static isValidMRN(mrn: string): boolean {
    // Basic MRN validation - alphanumeric, 4-20 characters
    const mrnRegex = /^[A-Za-z0-9]{4,20}$/;
    return mrnRegex.test(mrn);
  }

  private static isValidSNOMEDCode(code: string): boolean {
    // SNOMED CT codes are numeric, 6-18 digits
    const snomedRegex = /^\d{6,18}$/;
    return snomedRegex.test(code);
  }

  private static isValidICD10Code(code: string): boolean {
    // ICD-10 codes format: A00-Z99.XXX
    const icd10Regex = /^[A-Z]\d{2}(?:\.\d{1,3})?$/;
    return icd10Regex.test(code);
  }

  private static isValidLOINCCode(code: string): boolean {
    // LOINC codes format: NNNNN-N
    const loincRegex = /^\d{4,5}-\d$/;
    return loincRegex.test(code);
  }
}