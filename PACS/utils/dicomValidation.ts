/**
 * DICOM Validation Utilities
 * 
 * Validation functions for DICOM data, UIDs, and PACS operations.
 */

import { DICOMMetadata, ImagingOrder, ImagingReport } from '../types';

export class DICOMValidation {
  
  /**
   * Validate DICOM Study Instance UID
   */
  static validateStudyInstanceUID(uid: string): boolean {
    // DICOM UIDs must be 1-64 characters, contain only digits and dots
    // Must start and end with a digit, dots cannot be consecutive
    const uidPattern = /^[0-9]+(\.[0-9]+)*$/;
    
    if (!uid || uid.length === 0 || uid.length > 64) {
      return false;
    }
    
    if (!uidPattern.test(uid)) {
      return false;
    }
    
    // Check for consecutive dots
    if (uid.includes('..')) {
      return false;
    }
    
    // Must not start or end with dot
    if (uid.startsWith('.') || uid.endsWith('.')) {
      return false;
    }
    
    return true;
  }

  /**
   * Validate DICOM Series Instance UID
   */
  static validateSeriesInstanceUID(uid: string): boolean {
    return this.validateStudyInstanceUID(uid); // Same validation rules
  }

  /**
   * Validate DICOM SOP Instance UID
   */
  static validateSOPInstanceUID(uid: string): boolean {
    return this.validateStudyInstanceUID(uid); // Same validation rules
  }

  /**
   * Validate Patient ID format
   */
  static validatePatientID(patientID: string): boolean {
    if (!patientID || patientID.trim().length === 0) {
      return false;
    }
    
    // Patient ID should be alphanumeric, max 64 characters
    const patientIDPattern = /^[A-Za-z0-9\-_]{1,64}$/;
    return patientIDPattern.test(patientID.trim());
  }

  /**
   * Validate DICOM Date format (YYYYMMDD)
   */
  static validateDICOMDate(date: string): boolean {
    if (!date || date.length !== 8) {
      return false;
    }
    
    const datePattern = /^\d{8}$/;
    if (!datePattern.test(date)) {
      return false;
    }
    
    const year = parseInt(date.substring(0, 4));
    const month = parseInt(date.substring(4, 6));
    const day = parseInt(date.substring(6, 8));
    
    // Basic date validation
    if (year < 1900 || year > 2100) {
      return false;
    }
    
    if (month < 1 || month > 12) {
      return false;
    }
    
    if (day < 1 || day > 31) {
      return false;
    }
    
    // Create date object to validate
    const dateObj = new Date(year, month - 1, day);
    return dateObj.getFullYear() === year && 
           dateObj.getMonth() === month - 1 && 
           dateObj.getDate() === day;
  }

  /**
   * Validate DICOM Time format (HHMMSS or HHMMSS.FFFFFF)
   */
  static validateDICOMTime(time: string): boolean {
    if (!time) {
      return false;
    }
    
    // Allow HHMMSS or HHMMSS.FFFFFF format
    const timePattern = /^([01]\d|2[0-3])([0-5]\d)([0-5]\d)(\.\d{1,6})?$/;
    return timePattern.test(time);
  }

  /**
   * Validate DICOM Modality
   */
  static validateModality(modality: string): boolean {
    const validModalities = [
      'CT', 'MR', 'XR', 'US', 'MG', 'PT', 'NM', 'RF', 'DX', 'CR', 'MX',
      'IO', 'PX', 'GM', 'SM', 'XA', 'BI', 'DG', 'ES', 'LS', 'OP', 'OT',
      'SC', 'ST', 'TG', 'RTIMAGE', 'RTDOSE', 'RTSTRUCT', 'RTPLAN', 
      'RTRECORD', 'HC', 'DX', 'ECG', 'EPS', 'HD', 'AU', 'EEG', 'EMG',
      'EOG', 'EP', 'GM', 'IO', 'IVOCT', 'IVUS', 'KER', 'LEN', 'OAM',
      'OCT', 'OPM', 'OPT', 'OPV', 'OSS', 'PLAN', 'PX', 'REG', 'RESP',
      'RWV', 'SEG', 'SM', 'SMR', 'SR', 'SRF', 'STAIN', 'VA', 'XC'
    ];
    
    return validModalities.includes(modality.toUpperCase());
  }

  /**
   * Validate complete DICOM metadata object
   */
  static validateDICOMMetadata(metadata: DICOMMetadata): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.validateStudyInstanceUID(metadata.studyInstanceUID)) {
      errors.push('Invalid Study Instance UID');
    }

    if (!this.validateSeriesInstanceUID(metadata.seriesInstanceUID)) {
      errors.push('Invalid Series Instance UID');
    }

    if (!this.validateSOPInstanceUID(metadata.sopInstanceUID)) {
      errors.push('Invalid SOP Instance UID');
    }

    if (!this.validatePatientID(metadata.patientID)) {
      errors.push('Invalid Patient ID');
    }

    if (!this.validateDICOMDate(metadata.studyDate)) {
      errors.push('Invalid Study Date format');
    }

    if (!this.validateDICOMTime(metadata.studyTime)) {
      errors.push('Invalid Study Time format');
    }

    if (!this.validateModality(metadata.modality)) {
      errors.push('Invalid or unsupported Modality');
    }

    if (!metadata.patientName || metadata.patientName.trim().length === 0) {
      errors.push('Patient Name is required');
    }

    if (!metadata.studyDescription || metadata.studyDescription.trim().length === 0) {
      errors.push('Study Description is required');
    }

    if (metadata.instanceNumber < 1) {
      errors.push('Instance Number must be greater than 0');
    }

    if (metadata.numberOfImages < 1) {
      errors.push('Number of Images must be greater than 0');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate imaging order data
   */
  static validateImagingOrder(order: Omit<ImagingOrder, 'orderID' | 'status'>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.validatePatientID(order.patientID)) {
      errors.push('Invalid Patient ID');
    }

    if (!order.providerID || order.providerID.trim().length === 0) {
      errors.push('Provider ID is required');
    }

    if (!this.validateDICOMDate(order.orderDate.replace(/-/g, ''))) {
      // Convert YYYY-MM-DD to YYYYMMDD for validation
      errors.push('Invalid Order Date format');
    }

    if (!this.validateModality(order.modality)) {
      errors.push('Invalid Modality');
    }

    if (!order.bodyPart || order.bodyPart.trim().length === 0) {
      errors.push('Body Part is required');
    }

    if (!order.clinicalIndication || order.clinicalIndication.trim().length === 0) {
      errors.push('Clinical Indication is required');
    }

    if (!['routine', 'urgent', 'stat'].includes(order.urgency)) {
      errors.push('Invalid Urgency level');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate imaging report data
   */
  static validateImagingReport(report: Omit<ImagingReport, 'reportID'>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.validateStudyInstanceUID(report.studyInstanceUID)) {
      errors.push('Invalid Study Instance UID');
    }

    if (!this.validatePatientID(report.patientID)) {
      errors.push('Invalid Patient ID');
    }

    if (!report.radiologistID || report.radiologistID.trim().length === 0) {
      errors.push('Radiologist ID is required');
    }

    if (!this.validateDICOMDate(report.reportDate.replace(/-/g, ''))) {
      errors.push('Invalid Report Date format');
    }

    if (!report.findings || report.findings.trim().length === 0) {
      errors.push('Findings are required');
    }

    if (!report.impression || report.impression.trim().length === 0) {
      errors.push('Impression is required');
    }

    if (!['preliminary', 'final', 'addendum'].includes(report.status)) {
      errors.push('Invalid Report Status');
    }

    if (typeof report.isAbnormal !== 'boolean') {
      errors.push('isAbnormal must be a boolean value');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize patient name for DICOM format
   */
  static sanitizePatientName(name: string): string {
    // DICOM patient names should use ^ as separator for name components
    // Format: Family^Given^Middle^Prefix^Suffix
    return name.trim()
               .replace(/[^\w\s\^]/g, '') // Remove special characters except ^
               .replace(/\s+/g, ' ')     // Normalize spaces
               .toUpperCase();           // Convert to uppercase
  }

  /**
   * Generate random DICOM UID for testing
   */
  static generateTestUID(): string {
    const root = '1.2.840.113619.2.5'; // Test root OID
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000000).toString();
    return `${root}.${timestamp}.${random}`;
  }

  /**
   * Check if UID is in test range
   */
  static isTestUID(uid: string): boolean {
    return uid.startsWith('1.2.840.113619.2.5') || 
           uid.startsWith('2.25'); // UUID-derived UIDs
  }

  /**
   * Validate DICOM tag format (GGGG,EEEE)
   */
  static validateDICOMTag(tag: string): boolean {
    const tagPattern = /^[0-9A-Fa-f]{4},[0-9A-Fa-f]{4}$/;
    return tagPattern.test(tag);
  }

  /**
   * Normalize DICOM tag format
   */
  static normalizeDICOMTag(tag: string): string {
    // Convert (GGGG,EEEE) or GGGGEEEE to GGGG,EEEE format
    const cleaned = tag.replace(/[()]/g, ''); // Remove parentheses
    
    if (cleaned.length === 8 && !cleaned.includes(',')) {
      // GGGGEEEE format
      return `${cleaned.substring(0, 4)},${cleaned.substring(4, 8)}`.toUpperCase();
    } else if (cleaned.includes(',')) {
      // GGGG,EEEE format
      return cleaned.toUpperCase();
    }
    
    return tag; // Return as-is if format is unclear
  }
}