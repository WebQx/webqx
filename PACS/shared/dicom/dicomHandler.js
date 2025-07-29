/**
 * DICOM File Handler Service
 * 
 * Shared utilities for handling DICOM files within the PACS ecosystem.
 * Provides functionality for parsing DICOM files, extracting metadata,
 * and extracting image data for rendering.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');

/**
 * DICOM data elements and their tags
 */
const DICOM_TAGS = {
  // Patient Information
  PATIENT_NAME: '00100010',
  PATIENT_ID: '00100020',
  PATIENT_BIRTH_DATE: '00100030',
  PATIENT_SEX: '00100040',
  
  // Study Information
  STUDY_DATE: '00080020',
  STUDY_TIME: '00080030',
  STUDY_DESCRIPTION: '00081030',
  STUDY_INSTANCE_UID: '0020000D',
  
  // Series Information
  SERIES_DATE: '00080021',
  SERIES_TIME: '00080031',
  SERIES_DESCRIPTION: '0008103E',
  SERIES_INSTANCE_UID: '0020000E',
  MODALITY: '00080060',
  
  // Image Information
  INSTANCE_NUMBER: '00200013',
  ROWS: '00280010',
  COLUMNS: '00280011',
  BITS_ALLOCATED: '00280100',
  BITS_STORED: '00280101',
  PIXEL_DATA: '7FE00010',
  
  // Transfer Syntax
  TRANSFER_SYNTAX_UID: '00020010'
};

/**
 * DICOM Value Representations
 */
const VR_TYPES = {
  'AE': { name: 'Application Entity', length: 16 },
  'AS': { name: 'Age String', length: 4 },
  'AT': { name: 'Attribute Tag', length: 4 },
  'CS': { name: 'Code String', length: 16 },
  'DA': { name: 'Date', length: 8 },
  'DS': { name: 'Decimal String', length: 16 },
  'DT': { name: 'Date Time', length: 26 },
  'FL': { name: 'Floating Point Single', length: 4 },
  'FD': { name: 'Floating Point Double', length: 8 },
  'IS': { name: 'Integer String', length: 12 },
  'LO': { name: 'Long String', length: 64 },
  'LT': { name: 'Long Text', length: 10240 },
  'OB': { name: 'Other Byte String', length: -1 },
  'OD': { name: 'Other Double String', length: -1 },
  'OF': { name: 'Other Float String', length: -1 },
  'OW': { name: 'Other Word String', length: -1 },
  'PN': { name: 'Person Name', length: 64 },
  'SH': { name: 'Short String', length: 16 },
  'SL': { name: 'Signed Long', length: 4 },
  'SQ': { name: 'Sequence of Items', length: -1 },
  'SS': { name: 'Signed Short', length: 2 },
  'ST': { name: 'Short Text', length: 1024 },
  'TM': { name: 'Time', length: 16 },
  'UI': { name: 'Unique Identifier', length: 64 },
  'UL': { name: 'Unsigned Long', length: 4 },
  'UN': { name: 'Unknown', length: -1 },
  'UR': { name: 'Universal Resource Identifier', length: -1 },
  'US': { name: 'Unsigned Short', length: 2 },
  'UT': { name: 'Unlimited Text', length: -1 }
};

/**
 * Logger utility for consistent logging across PACS system
 */
class PACSLogger {
  constructor(module = 'DICOMHandler') {
    this.module = module;
  }

  info(message, context = {}) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${this.module}] INFO: ${message}`, context);
  }

  error(message, error = null, context = {}) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [${this.module}] ERROR: ${message}`, {
      error: error?.message || error,
      stack: error?.stack,
      ...context
    });
  }

  warn(message, context = {}) {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [${this.module}] WARN: ${message}`, context);
  }

  debug(message, context = {}) {
    const timestamp = new Date().toISOString();
    console.debug(`[${timestamp}] [${this.module}] DEBUG: ${message}`, context);
  }
}

/**
 * DICOM File Handler Class
 */
class DICOMHandler {
  constructor() {
    this.logger = new PACSLogger('DICOMHandler');
    this.logger.info('DICOM Handler initialized');
  }

  /**
   * Validate if file is a valid DICOM file
   * @param {Buffer} buffer - File buffer
   * @returns {boolean} - True if valid DICOM file
   */
  isValidDICOM(buffer) {
    try {
      if (!buffer || buffer.length < 132) {
        return false;
      }

      // Check for DICOM prefix at offset 128
      const prefix = buffer.subarray(128, 132).toString('ascii');
      return prefix === 'DICM';
    } catch (error) {
      this.logger.error('Error validating DICOM file', error);
      return false;
    }
  }

  /**
   * Read DICOM file from path
   * @param {string} filePath - Path to DICOM file
   * @returns {Promise<Buffer>} - File buffer
   */
  async readDICOMFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`DICOM file not found: ${filePath}`);
      }

      const buffer = await fs.promises.readFile(filePath);
      
      if (!this.isValidDICOM(buffer)) {
        throw new Error(`Invalid DICOM file: ${filePath}`);
      }

      this.logger.info('DICOM file read successfully', { filePath, size: buffer.length });
      return buffer;
    } catch (error) {
      this.logger.error('Failed to read DICOM file', error, { filePath });
      throw error;
    }
  }

  /**
   * Parse DICOM metadata from buffer
   * @param {Buffer} buffer - DICOM file buffer
   * @returns {Object} - Parsed metadata
   */
  parseMetadata(buffer) {
    try {
      if (!this.isValidDICOM(buffer)) {
        throw new Error('Invalid DICOM file buffer');
      }

      const metadata = {};
      let offset = 132; // Start after DICOM prefix

      // Parse data elements
      while (offset < buffer.length - 8) {
        try {
          const element = this.parseDataElement(buffer, offset);
          if (!element) break;

          const tagKey = this.getTagName(element.tag);
          if (tagKey) {
            metadata[tagKey] = element.value;
          }

          offset = element.nextOffset;
          
          // Stop if we've read enough for basic metadata
          if (offset > buffer.length * 0.1) break;
        } catch (elementError) {
          this.logger.warn('Error parsing data element, skipping', elementError, { offset });
          offset += 8; // Try to continue
        }
      }

      this.logger.info('DICOM metadata parsed successfully', { elementCount: Object.keys(metadata).length });
      return this.formatMetadata(metadata);
    } catch (error) {
      this.logger.error('Failed to parse DICOM metadata', error);
      throw error;
    }
  }

  /**
   * Parse a single DICOM data element
   * @param {Buffer} buffer - DICOM buffer
   * @param {number} offset - Current offset
   * @returns {Object} - Parsed element
   */
  parseDataElement(buffer, offset) {
    if (offset + 8 > buffer.length) {
      return null;
    }

    // Read tag (group, element)
    const group = buffer.readUInt16LE(offset);
    const element = buffer.readUInt16LE(offset + 2);
    const tag = group.toString(16).padStart(4, '0') + element.toString(16).padStart(4, '0');

    let vr = '';
    let length = 0;
    let valueOffset = offset + 8;

    // Try to determine if this is explicit VR
    const possibleVR = buffer.subarray(offset + 4, offset + 6).toString('ascii');
    if (VR_TYPES[possibleVR]) {
      vr = possibleVR;
      // Explicit VR
      if (['OB', 'OD', 'OF', 'OL', 'OW', 'SQ', 'UC', 'UR', 'UT', 'UN'].includes(vr)) {
        // Long form
        length = buffer.readUInt32LE(offset + 8);
        valueOffset = offset + 12;
      } else {
        // Short form
        length = buffer.readUInt16LE(offset + 6);
        valueOffset = offset + 8;
      }
    } else {
      // Implicit VR - read length as 32-bit
      length = buffer.readUInt32LE(offset + 4);
      valueOffset = offset + 8;
    }

    // Read value
    let value = null;
    if (length > 0 && valueOffset + length <= buffer.length) {
      const valueBuffer = buffer.subarray(valueOffset, valueOffset + length);
      value = this.parseValue(valueBuffer, vr, tag);
    }

    return {
      tag,
      vr,
      length,
      value,
      nextOffset: valueOffset + length
    };
  }

  /**
   * Parse value based on VR type
   * @param {Buffer} buffer - Value buffer
   * @param {string} vr - Value representation
   * @param {string} tag - DICOM tag
   * @returns {*} - Parsed value
   */
  parseValue(buffer, vr, tag) {
    try {
      if (!buffer || buffer.length === 0) {
        return null;
      }

      switch (vr) {
        case 'PN': // Person Name
        case 'LO': // Long String
        case 'SH': // Short String
        case 'CS': // Code String
        case 'UI': // Unique Identifier
        case 'ST': // Short Text
        case 'LT': // Long Text
          return buffer.toString('utf8').trim().replace(/\0/g, '');
        
        case 'DA': // Date
          const dateStr = buffer.toString('ascii').trim();
          if (dateStr.length === 8) {
            return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
          }
          return dateStr;
        
        case 'TM': // Time
          const timeStr = buffer.toString('ascii').trim();
          if (timeStr.length >= 6) {
            return `${timeStr.substring(0, 2)}:${timeStr.substring(2, 4)}:${timeStr.substring(4, 6)}`;
          }
          return timeStr;
        
        case 'IS': // Integer String
        case 'DS': // Decimal String
          return buffer.toString('ascii').trim();
        
        case 'US': // Unsigned Short
          return buffer.readUInt16LE(0);
        
        case 'UL': // Unsigned Long
          return buffer.readUInt32LE(0);
        
        case 'SS': // Signed Short
          return buffer.readInt16LE(0);
        
        case 'SL': // Signed Long
          return buffer.readInt32LE(0);
        
        case 'OW': // Other Word String (pixel data)
        case 'OB': // Other Byte String (pixel data)
          if (tag === DICOM_TAGS.PIXEL_DATA) {
            return { type: 'pixel_data', length: buffer.length };
          }
          return buffer;
        
        default:
          return buffer.toString('utf8').trim().replace(/\0/g, '');
      }
    } catch (error) {
      this.logger.warn('Error parsing value', error, { vr, tag });
      return buffer.toString('utf8').trim().replace(/\0/g, '');
    }
  }

  /**
   * Get readable tag name from tag
   * @param {string} tag - DICOM tag
   * @returns {string|null} - Tag name
   */
  getTagName(tag) {
    const tagMap = {
      [DICOM_TAGS.PATIENT_NAME]: 'patientName',
      [DICOM_TAGS.PATIENT_ID]: 'patientId',
      [DICOM_TAGS.PATIENT_BIRTH_DATE]: 'patientBirthDate',
      [DICOM_TAGS.PATIENT_SEX]: 'patientSex',
      [DICOM_TAGS.STUDY_DATE]: 'studyDate',
      [DICOM_TAGS.STUDY_TIME]: 'studyTime',
      [DICOM_TAGS.STUDY_DESCRIPTION]: 'studyDescription',
      [DICOM_TAGS.STUDY_INSTANCE_UID]: 'studyInstanceUID',
      [DICOM_TAGS.SERIES_DATE]: 'seriesDate',
      [DICOM_TAGS.SERIES_TIME]: 'seriesTime',
      [DICOM_TAGS.SERIES_DESCRIPTION]: 'seriesDescription',
      [DICOM_TAGS.SERIES_INSTANCE_UID]: 'seriesInstanceUID',
      [DICOM_TAGS.MODALITY]: 'modality',
      [DICOM_TAGS.INSTANCE_NUMBER]: 'instanceNumber',
      [DICOM_TAGS.ROWS]: 'rows',
      [DICOM_TAGS.COLUMNS]: 'columns',
      [DICOM_TAGS.BITS_ALLOCATED]: 'bitsAllocated',
      [DICOM_TAGS.BITS_STORED]: 'bitsStored',
      [DICOM_TAGS.PIXEL_DATA]: 'pixelData'
    };

    return tagMap[tag.toUpperCase()] || null;
  }

  /**
   * Format metadata for consistent output
   * @param {Object} rawMetadata - Raw parsed metadata
   * @returns {Object} - Formatted metadata
   */
  formatMetadata(rawMetadata) {
    return {
      patient: {
        name: rawMetadata.patientName || 'Unknown',
        id: rawMetadata.patientId || 'Unknown',
        birthDate: rawMetadata.patientBirthDate || null,
        sex: rawMetadata.patientSex || 'Unknown'
      },
      study: {
        date: rawMetadata.studyDate || null,
        time: rawMetadata.studyTime || null,
        description: rawMetadata.studyDescription || 'Unknown',
        instanceUID: rawMetadata.studyInstanceUID || null
      },
      series: {
        date: rawMetadata.seriesDate || null,
        time: rawMetadata.seriesTime || null,
        description: rawMetadata.seriesDescription || 'Unknown',
        instanceUID: rawMetadata.seriesInstanceUID || null,
        modality: rawMetadata.modality || 'Unknown'
      },
      image: {
        instanceNumber: rawMetadata.instanceNumber || null,
        rows: rawMetadata.rows || null,
        columns: rawMetadata.columns || null,
        bitsAllocated: rawMetadata.bitsAllocated || null,
        bitsStored: rawMetadata.bitsStored || null
      },
      pixelData: rawMetadata.pixelData || null
    };
  }

  /**
   * Extract image data from DICOM file
   * @param {Buffer} buffer - DICOM file buffer
   * @returns {Object} - Image data and metadata
   */
  extractImageData(buffer) {
    try {
      if (!this.isValidDICOM(buffer)) {
        throw new Error('Invalid DICOM file buffer');
      }

      const metadata = this.parseMetadata(buffer);
      let pixelData = null;
      let offset = 132;

      // Find pixel data element
      while (offset < buffer.length - 8) {
        try {
          const element = this.parseDataElement(buffer, offset);
          if (!element) break;

          if (element.tag.toUpperCase() === DICOM_TAGS.PIXEL_DATA) {
            const valueOffset = offset + (element.nextOffset - offset - element.length);
            pixelData = buffer.subarray(valueOffset, valueOffset + element.length);
            break;
          }

          offset = element.nextOffset;
        } catch (error) {
          offset += 8;
        }
      }

      if (!pixelData) {
        throw new Error('No pixel data found in DICOM file');
      }

      const imageInfo = {
        width: metadata.image.columns,
        height: metadata.image.rows,
        bitsAllocated: metadata.image.bitsAllocated,
        bitsStored: metadata.image.bitsStored,
        pixelDataLength: pixelData.length,
        metadata: metadata
      };

      this.logger.info('Image data extracted successfully', {
        width: imageInfo.width,
        height: imageInfo.height,
        pixelDataSize: pixelData.length
      });

      return {
        pixelData,
        imageInfo,
        metadata
      };
    } catch (error) {
      this.logger.error('Failed to extract image data', error);
      throw error;
    }
  }

  /**
   * Process DICOM file and return complete information
   * @param {string} filePath - Path to DICOM file
   * @returns {Promise<Object>} - Complete DICOM information
   */
  async processDICOMFile(filePath) {
    try {
      this.logger.info('Processing DICOM file', { filePath });

      const buffer = await this.readDICOMFile(filePath);
      const metadata = this.parseMetadata(buffer);
      
      let imageData = null;
      try {
        imageData = this.extractImageData(buffer);
      } catch (imageError) {
        this.logger.warn('Could not extract image data', imageError);
      }

      const result = {
        filePath,
        fileSize: buffer.length,
        isValid: true,
        metadata,
        imageData,
        processedAt: new Date().toISOString()
      };

      this.logger.info('DICOM file processed successfully', {
        filePath,
        hasImageData: !!imageData,
        patientName: metadata.patient.name
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to process DICOM file', error, { filePath });
      
      return {
        filePath,
        isValid: false,
        error: error.message,
        processedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Batch process multiple DICOM files
   * @param {string[]} filePaths - Array of file paths
   * @returns {Promise<Object[]>} - Array of processing results
   */
  async batchProcessDICOMFiles(filePaths) {
    this.logger.info('Starting batch processing', { fileCount: filePaths.length });

    const results = [];
    const errors = [];

    for (const filePath of filePaths) {
      try {
        const result = await this.processDICOMFile(filePath);
        results.push(result);
      } catch (error) {
        const errorResult = {
          filePath,
          isValid: false,
          error: error.message,
          processedAt: new Date().toISOString()
        };
        results.push(errorResult);
        errors.push({ filePath, error: error.message });
      }
    }

    this.logger.info('Batch processing completed', {
      totalFiles: filePaths.length,
      successful: results.filter(r => r.isValid).length,
      failed: errors.length
    });

    if (errors.length > 0) {
      this.logger.warn('Some files failed to process', { errors });
    }

    return results;
  }
}

module.exports = {
  DICOMHandler,
  PACSLogger,
  DICOM_TAGS,
  VR_TYPES
};