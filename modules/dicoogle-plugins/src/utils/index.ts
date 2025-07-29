/**
 * Utility functions for Dicoogle PACS plugins
 * 
 * Common utilities for DICOM metadata handling, validation, and formatting
 */

import { createHash } from 'crypto';

/**
 * DICOM data types and their validation patterns
 */
export const DICOM_DATA_TYPES = {
  AE: { name: 'Application Entity', pattern: /^.{1,16}$/ },
  AS: { name: 'Age String', pattern: /^\d{3}[DWMY]$/ },
  AT: { name: 'Attribute Tag', pattern: /^[0-9A-F]{8}$/ },
  CS: { name: 'Code String', pattern: /^[A-Z0-9_\s]{1,16}$/ },
  DA: { name: 'Date', pattern: /^\d{8}$/ },
  DS: { name: 'Decimal String', pattern: /^[-+]?\d*\.?\d*$/ },
  DT: { name: 'Date Time', pattern: /^\d{8}(\d{6}(\.\d{6})?)?([+-]\d{4})?$/ },
  FL: { name: 'Floating Point Single', pattern: /^[-+]?\d*\.?\d*([eE][-+]?\d+)?$/ },
  FD: { name: 'Floating Point Double', pattern: /^[-+]?\d*\.?\d*([eE][-+]?\d+)?$/ },
  IS: { name: 'Integer String', pattern: /^[-+]?\d+$/ },
  LO: { name: 'Long String', pattern: /^.{1,64}$/ },
  LT: { name: 'Long Text', pattern: /^.{1,10240}$/ },
  OB: { name: 'Other Byte String', pattern: /./ },
  OD: { name: 'Other Double String', pattern: /./ },
  OF: { name: 'Other Float String', pattern: /./ },
  OL: { name: 'Other Long String', pattern: /./ },
  OW: { name: 'Other Word String', pattern: /./ },
  PN: { name: 'Person Name', pattern: /^.{1,64}$/ },
  SH: { name: 'Short String', pattern: /^.{1,16}$/ },
  SL: { name: 'Signed Long', pattern: /^[-+]?\d+$/ },
  SQ: { name: 'Sequence of Items', pattern: /./ },
  SS: { name: 'Signed Short', pattern: /^[-+]?\d+$/ },
  ST: { name: 'Short Text', pattern: /^.{1,1024}$/ },
  TM: { name: 'Time', pattern: /^\d{2}(\d{2}(\d{2}(\.\d{6})?)?)?$/ },
  UC: { name: 'Unlimited Characters', pattern: /./ },
  UI: { name: 'Unique Identifier', pattern: /^[0-9.]{1,64}$/ },
  UL: { name: 'Unsigned Long', pattern: /^\d+$/ },
  UN: { name: 'Unknown', pattern: /./ },
  UR: { name: 'Universal Resource Identifier', pattern: /./ },
  US: { name: 'Unsigned Short', pattern: /^\d+$/ },
  UT: { name: 'Unlimited Text', pattern: /./ },
} as const;

/**
 * Standard DICOM tags commonly used in filtering and indexing
 */
export const STANDARD_DICOM_TAGS = {
  // Patient Information
  PATIENT_ID: '00100020',
  PATIENT_NAME: '00100010',
  PATIENT_BIRTH_DATE: '00100030',
  PATIENT_SEX: '00100040',
  PATIENT_AGE: '00101010',
  
  // Study Information
  STUDY_INSTANCE_UID: '0020000D',
  STUDY_DATE: '00080020',
  STUDY_TIME: '00080030',
  STUDY_ID: '00200010',
  STUDY_DESCRIPTION: '00081030',
  ACCESSION_NUMBER: '00080050',
  
  // Series Information
  SERIES_INSTANCE_UID: '0020000E',
  SERIES_NUMBER: '00200011',
  SERIES_DATE: '00080021',
  SERIES_TIME: '00080031',
  SERIES_DESCRIPTION: '0008103E',
  MODALITY: '00080060',
  
  // Instance Information
  SOP_INSTANCE_UID: '00080018',
  INSTANCE_NUMBER: '00200013',
  IMAGE_TYPE: '00080008',
  ACQUISITION_DATE: '00080022',
  ACQUISITION_TIME: '00080032',
  
  // Equipment Information
  MANUFACTURER: '00080070',
  MANUFACTURER_MODEL_NAME: '00081090',
  STATION_NAME: '00081010',
  SOFTWARE_VERSIONS: '00181020',
} as const;

/**
 * Query operators for metadata filtering
 */
export enum QueryOperator {
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
  CONTAINS = 'CONTAINS',
  NOT_CONTAINS = 'NOT_CONTAINS',
  STARTS_WITH = 'STARTS_WITH',
  ENDS_WITH = 'ENDS_WITH',
  RANGE = 'RANGE',
  GREATER_THAN = 'GREATER_THAN',
  LESS_THAN = 'LESS_THAN',
  EXISTS = 'EXISTS',
  NOT_EXISTS = 'NOT_EXISTS',
  IN = 'IN',
  NOT_IN = 'NOT_IN',
}

/**
 * Logical operators for combining filter conditions
 */
export enum LogicalOperator {
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',
}

/**
 * Filter condition interface
 */
export interface FilterCondition {
  field: string;
  operator: QueryOperator;
  value: any;
  dataType?: keyof typeof DICOM_DATA_TYPES;
}

/**
 * Complex filter with logical operators
 */
export interface ComplexFilter {
  conditions: FilterCondition[];
  logical: LogicalOperator;
  groups?: ComplexFilter[];
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
  offset?: number;
}

/**
 * Sort parameters
 */
export interface SortParams {
  field: string;
  direction: 'ASC' | 'DESC';
}

/**
 * Query result metadata
 */
export interface QueryResultMetadata {
  totalCount: number;
  pageCount: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  executionTimeMs: number;
  cacheHit: boolean;
}

/**
 * Validate DICOM tag format
 */
export function validateDicomTag(tag: string): boolean {
  return /^[0-9A-F]{8}$/i.test(tag);
}

/**
 * Validate DICOM value based on data type
 */
export function validateDicomValue(value: any, dataType: keyof typeof DICOM_DATA_TYPES): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  const type = DICOM_DATA_TYPES[dataType];
  if (!type) {
    return false;
  }

  const stringValue = String(value);
  return type.pattern.test(stringValue);
}

/**
 * Format DICOM tag for display
 */
export function formatDicomTag(tag: string): string {
  if (!validateDicomTag(tag)) {
    throw new Error(`Invalid DICOM tag format: ${tag}`);
  }
  
  const upperTag = tag.toUpperCase();
  return `(${upperTag.slice(0, 4)},${upperTag.slice(4)})`;
}

/**
 * Parse DICOM date to JavaScript Date
 */
export function parseDicomDate(dicomDate: string): Date | null {
  if (!dicomDate || !/^\d{8}$/.test(dicomDate)) {
    return null;
  }
  
  const year = parseInt(dicomDate.slice(0, 4), 10);
  const month = parseInt(dicomDate.slice(4, 6), 10) - 1; // JavaScript months are 0-indexed
  const day = parseInt(dicomDate.slice(6, 8), 10);
  
  return new Date(year, month, day);
}

/**
 * Parse DICOM time to time object
 */
export function parseDicomTime(dicomTime: string): { hours: number; minutes: number; seconds: number; } | null {
  if (!dicomTime || !/^\d{2}(\d{2}(\d{2}(\.\d{6})?)?)?$/.test(dicomTime)) {
    return null;
  }
  
  const hours = parseInt(dicomTime.slice(0, 2), 10);
  const minutes = dicomTime.length >= 4 ? parseInt(dicomTime.slice(2, 4), 10) : 0;
  const seconds = dicomTime.length >= 6 ? parseInt(dicomTime.slice(4, 6), 10) : 0;
  
  return { hours, minutes, seconds };
}

/**
 * Format JavaScript Date to DICOM date string
 */
export function formatToDicomDate(date: Date): string {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
  return `${year}${month}${day}`;
}

/**
 * Generate cache key for query results
 */
export function generateCacheKey(filter: ComplexFilter, pagination?: PaginationParams, sort?: SortParams): string {
  const content = JSON.stringify({ filter, pagination, sort });
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Sanitize user input for DICOM queries
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Remove potentially dangerous characters
  return input
    .replace(/[<>;"']/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .trim()
    .slice(0, 1000); // Limit length
}

/**
 * Validate filter condition
 */
export function validateFilterCondition(condition: FilterCondition): string[] {
  const errors: string[] = [];
  
  if (!condition.field) {
    errors.push('Field is required');
  } else if (!validateDicomTag(condition.field) && !Object.values(STANDARD_DICOM_TAGS).includes(condition.field)) {
    errors.push('Invalid DICOM tag format');
  }
  
  if (!Object.values(QueryOperator).includes(condition.operator)) {
    errors.push('Invalid query operator');
  }
  
  if (condition.value === null || condition.value === undefined) {
    if (condition.operator !== QueryOperator.EXISTS && condition.operator !== QueryOperator.NOT_EXISTS) {
      errors.push('Value is required for this operator');
    }
  }
  
  if (condition.dataType && !DICOM_DATA_TYPES[condition.dataType]) {
    errors.push('Invalid DICOM data type');
  }
  
  if (condition.dataType && condition.value !== null && condition.value !== undefined) {
    if (!validateDicomValue(condition.value, condition.dataType)) {
      errors.push(`Value does not match DICOM data type ${condition.dataType}`);
    }
  }
  
  return errors;
}

/**
 * Validate complex filter
 */
export function validateComplexFilter(filter: ComplexFilter): string[] {
  const errors: string[] = [];
  
  if (!filter.conditions || !Array.isArray(filter.conditions)) {
    errors.push('Conditions array is required');
    return errors;
  }
  
  if (filter.conditions.length === 0) {
    errors.push('At least one condition is required');
  }
  
  if (!Object.values(LogicalOperator).includes(filter.logical)) {
    errors.push('Invalid logical operator');
  }
  
  // Validate each condition
  filter.conditions.forEach((condition, index) => {
    const conditionErrors = validateFilterCondition(condition);
    conditionErrors.forEach(error => {
      errors.push(`Condition ${index + 1}: ${error}`);
    });
  });
  
  // Validate nested groups recursively
  if (filter.groups) {
    filter.groups.forEach((group, index) => {
      const groupErrors = validateComplexFilter(group);
      groupErrors.forEach(error => {
        errors.push(`Group ${index + 1}: ${error}`);
      });
    });
  }
  
  return errors;
}

/**
 * Convert filter to query string for debugging
 */
export function filterToQueryString(filter: ComplexFilter): string {
  const conditionStrings = filter.conditions.map(condition => {
    return `${condition.field} ${condition.operator} ${condition.value}`;
  });
  
  const groupStrings = filter.groups?.map(group => {
    return `(${filterToQueryString(group)})`;
  }) || [];
  
  const allParts = [...conditionStrings, ...groupStrings];
  return allParts.join(` ${filter.logical} `);
}

/**
 * Deep clone object utility
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any;
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as any;
  }
  
  if (typeof obj === 'object') {
    const cloned = {} as any;
    Object.keys(obj).forEach(key => {
      cloned[key] = deepClone((obj as any)[key]);
    });
    return cloned;
  }
  
  return obj;
}

/**
 * Throttle function execution
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return function(this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Debounce function execution
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return function(this: any, ...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}