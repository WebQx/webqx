/**
 * DICOM Validation Utilities
 * 
 * Utilities for validating DICOM data, tags, and study information.
 */

import { DICOMStudy, DICOMSeries, DICOMInstance, MedicalSpecialty } from '../types';

export class DICOMValidator {
  /**
   * Validate Study Instance UID format
   */
  static validateStudyInstanceUID(uid: string): boolean {
    if (!uid || typeof uid !== 'string') return false;
    
    // DICOM UID format: numbers and dots, max 64 characters
    const uidPattern = /^[0-9.]+$/;
    return uidPattern.test(uid) && uid.length <= 64 && uid.length > 0;
  }

  /**
   * Validate Series Instance UID format
   */
  static validateSeriesInstanceUID(uid: string): boolean {
    return this.validateStudyInstanceUID(uid); // Same format
  }

  /**
   * Validate SOP Instance UID format
   */
  static validateSOPInstanceUID(uid: string): boolean {
    return this.validateStudyInstanceUID(uid); // Same format
  }

  /**
   * Validate Patient ID format
   */
  static validatePatientID(patientID: string): boolean {
    if (!patientID || typeof patientID !== 'string') return false;
    
    // Patient ID can contain alphanumeric characters, hyphens, and underscores
    const patientIDPattern = /^[A-Za-z0-9_-]+$/;
    return patientIDPattern.test(patientID) && patientID.length <= 64;
  }

  /**
   * Validate DICOM date format (YYYYMMDD)
   */
  static validateDICOMDate(date: string): boolean {
    if (!date || typeof date !== 'string') return false;
    
    // DICOM date format: YYYYMMDD
    const datePattern = /^\d{8}$/;
    if (!datePattern.test(date)) return false;
    
    const year = parseInt(date.substring(0, 4));
    const month = parseInt(date.substring(4, 6));
    const day = parseInt(date.substring(6, 8));
    
    // Basic date validation
    if (year < 1900 || year > 2100) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    
    return true;
  }

  /**
   * Validate DICOM time format (HHMMSS or HHMMSS.FFFFFF)
   */
  static validateDICOMTime(time: string): boolean {
    if (!time || typeof time !== 'string') return false;
    
    // DICOM time format: HHMMSS or HHMMSS.FFFFFF
    const timePattern = /^\d{6}(\.\d{1,6})?$/;
    if (!timePattern.test(time)) return false;
    
    const hours = parseInt(time.substring(0, 2));
    const minutes = parseInt(time.substring(2, 4));
    const seconds = parseInt(time.substring(4, 6));
    
    if (hours > 23 || minutes > 59 || seconds > 59) return false;
    
    return true;
  }

  /**
   * Validate modality code
   */
  static validateModality(modality: string): boolean {
    if (!modality || typeof modality !== 'string') return false;
    
    const validModalities = [
      'CR', 'CT', 'MR', 'NM', 'US', 'OT', 'BI', 'CD', 'DD', 'DG',
      'ES', 'LS', 'PT', 'RG', 'ST', 'TG', 'XA', 'RF', 'RTIMAGE',
      'RTDOSE', 'RTSTRUCT', 'RTPLAN', 'RTRECORD', 'HC', 'DX', 'MG',
      'IO', 'PX', 'GM', 'SM', 'XC', 'PR', 'AU', 'EPS', 'HD', 'SR',
      'IVUS', 'OP', 'SMR', 'ECG', 'RESP', 'KO', 'SEG', 'REG'
    ];
    
    return validModalities.includes(modality.toUpperCase());
  }

  /**
   * Validate complete DICOM study object
   */
  static validateDICOMStudy(study: Partial<DICOMStudy>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields validation
    if (!this.validateStudyInstanceUID(study.studyInstanceUID || '')) {
      errors.push('Invalid or missing Study Instance UID');
    }

    if (!this.validatePatientID(study.patientID || '')) {
      errors.push('Invalid or missing Patient ID');
    }

    if (!study.patientName || study.patientName.trim().length === 0) {
      errors.push('Patient name is required');
    }

    if (!this.validateDICOMDate(study.studyDate?.replace(/-/g, '') || '')) {
      errors.push('Invalid or missing study date');
    }

    if (study.studyTime && !this.validateDICOMTime(study.studyTime)) {
      errors.push('Invalid study time format');
    }

    if (!this.validateModality(study.modality || '')) {
      errors.push('Invalid or missing modality');
    }

    if (!this.validateMedicalSpecialty(study.specialty)) {
      errors.push('Invalid or missing medical specialty');
    }

    if (typeof study.seriesCount !== 'number' || study.seriesCount < 0) {
      errors.push('Series count must be a non-negative number');
    }

    if (typeof study.instanceCount !== 'number' || study.instanceCount < 0) {
      errors.push('Instance count must be a non-negative number');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate DICOM series object
   */
  static validateDICOMSeries(series: Partial<DICOMSeries>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.validateSeriesInstanceUID(series.seriesInstanceUID || '')) {
      errors.push('Invalid or missing Series Instance UID');
    }

    if (!this.validateStudyInstanceUID(series.studyInstanceUID || '')) {
      errors.push('Invalid or missing Study Instance UID');
    }

    if (typeof series.seriesNumber !== 'number' || series.seriesNumber < 0) {
      errors.push('Series number must be a non-negative number');
    }

    if (!this.validateModality(series.modality || '')) {
      errors.push('Invalid or missing modality');
    }

    if (typeof series.instanceCount !== 'number' || series.instanceCount < 0) {
      errors.push('Instance count must be a non-negative number');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate DICOM instance object
   */
  static validateDICOMInstance(instance: Partial<DICOMInstance>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.validateSOPInstanceUID(instance.sopInstanceUID || '')) {
      errors.push('Invalid or missing SOP Instance UID');
    }

    if (!this.validateSeriesInstanceUID(instance.seriesInstanceUID || '')) {
      errors.push('Invalid or missing Series Instance UID');
    }

    if (typeof instance.instanceNumber !== 'number' || instance.instanceNumber < 0) {
      errors.push('Instance number must be a non-negative number');
    }

    if (!instance.sopClassUID || instance.sopClassUID.trim().length === 0) {
      errors.push('SOP Class UID is required');
    }

    // Validate image-specific fields if present
    if (instance.rows !== undefined && (typeof instance.rows !== 'number' || instance.rows <= 0)) {
      errors.push('Rows must be a positive number');
    }

    if (instance.columns !== undefined && (typeof instance.columns !== 'number' || instance.columns <= 0)) {
      errors.push('Columns must be a positive number');
    }

    if (instance.bitsAllocated !== undefined && ![8, 16, 32].includes(instance.bitsAllocated)) {
      errors.push('Bits allocated must be 8, 16, or 32');
    }

    if (instance.bitsStored !== undefined && instance.bitsAllocated !== undefined) {
      if (instance.bitsStored > instance.bitsAllocated) {
        errors.push('Bits stored cannot exceed bits allocated');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate medical specialty
   */
  static validateMedicalSpecialty(specialty: any): specialty is MedicalSpecialty {
    const validSpecialties: MedicalSpecialty[] = [
      'radiology', 'cardiology', 'orthopedics', 'neurology', 'oncology',
      'pulmonology', 'gastroenterology', 'pediatrics', 'emergency', 'primary-care'
    ];

    return typeof specialty === 'string' && validSpecialties.includes(specialty as MedicalSpecialty);
  }

  /**
   * Validate file as potential DICOM file
   */
  static validateDICOMFile(file: File): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check file size (reasonable limits)
    const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
    const minSize = 128; // 128 bytes minimum

    if (file.size > maxSize) {
      errors.push(`File size ${file.size} exceeds maximum allowed size of ${maxSize} bytes`);
    }

    if (file.size < minSize) {
      errors.push(`File size ${file.size} is below minimum required size of ${minSize} bytes`);
    }

    // Check file extension (optional, as DICOM files may not have extensions)
    const validExtensions = ['.dcm', '.dicom', '.ima', '.img', ''];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (file.name.includes('.') && !validExtensions.includes(fileExtension)) {
      // This is a warning, not an error, as DICOM files may not follow naming conventions
      console.warn(`File ${file.name} has unusual extension for DICOM file`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize and validate search parameters
   */
  static validateSearchParameters(params: any): { valid: boolean; errors: string[]; sanitized: any } {
    const errors: string[] = [];
    const sanitized: any = {};

    // Patient ID
    if (params.patientID !== undefined) {
      if (this.validatePatientID(params.patientID)) {
        sanitized.patientID = params.patientID.trim();
      } else {
        errors.push('Invalid Patient ID format');
      }
    }

    // Patient Name
    if (params.patientName !== undefined) {
      if (typeof params.patientName === 'string' && params.patientName.trim().length > 0) {
        sanitized.patientName = params.patientName.trim();
      } else {
        errors.push('Patient name must be a non-empty string');
      }
    }

    // Study Date Range
    if (params.studyDate !== undefined) {
      const dateRange = params.studyDate;
      if (typeof dateRange === 'object') {
        const sanitizedDateRange: any = {};
        
        if (dateRange.from && this.validateDICOMDate(dateRange.from.replace(/-/g, ''))) {
          sanitizedDateRange.from = dateRange.from;
        } else if (dateRange.from) {
          errors.push('Invalid from date format');
        }
        
        if (dateRange.to && this.validateDICOMDate(dateRange.to.replace(/-/g, ''))) {
          sanitizedDateRange.to = dateRange.to;
        } else if (dateRange.to) {
          errors.push('Invalid to date format');
        }
        
        if (Object.keys(sanitizedDateRange).length > 0) {
          sanitized.studyDate = sanitizedDateRange;
        }
      } else {
        errors.push('Study date must be an object with from/to properties');
      }
    }

    // Modality
    if (params.modality !== undefined) {
      if (Array.isArray(params.modality)) {
        const validModalities = params.modality.filter(m => this.validateModality(m));
        if (validModalities.length > 0) {
          sanitized.modality = validModalities;
        }
        if (validModalities.length !== params.modality.length) {
          errors.push('Some modalities are invalid');
        }
      } else {
        errors.push('Modality must be an array');
      }
    }

    // Specialty
    if (params.specialty !== undefined) {
      if (Array.isArray(params.specialty)) {
        const validSpecialties = params.specialty.filter(s => this.validateMedicalSpecialty(s));
        if (validSpecialties.length > 0) {
          sanitized.specialty = validSpecialties;
        }
        if (validSpecialties.length !== params.specialty.length) {
          errors.push('Some specialties are invalid');
        }
      } else {
        errors.push('Specialty must be an array');
      }
    }

    // Pagination
    if (params.limit !== undefined) {
      const limit = parseInt(params.limit);
      if (isNaN(limit) || limit < 1 || limit > 1000) {
        errors.push('Limit must be a number between 1 and 1000');
      } else {
        sanitized.limit = limit;
      }
    }

    if (params.offset !== undefined) {
      const offset = parseInt(params.offset);
      if (isNaN(offset) || offset < 0) {
        errors.push('Offset must be a non-negative number');
      } else {
        sanitized.offset = offset;
      }
    }

    // Accession Number
    if (params.accessionNumber !== undefined) {
      if (typeof params.accessionNumber === 'string' && params.accessionNumber.trim().length > 0) {
        sanitized.accessionNumber = params.accessionNumber.trim();
      } else {
        errors.push('Accession number must be a non-empty string');
      }
    }

    // Study Description
    if (params.studyDescription !== undefined) {
      if (typeof params.studyDescription === 'string' && params.studyDescription.trim().length > 0) {
        sanitized.studyDescription = params.studyDescription.trim();
      } else {
        errors.push('Study description must be a non-empty string');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized
    };
  }
}