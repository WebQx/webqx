/**
 * DICOM Handler Tests
 * 
 * Test suite for DICOM file handling utilities
 */

const fs = require('fs');
const path = require('path');
const { DICOMHandler, PACSLogger, DICOM_TAGS, VR_TYPES } = require('../dicomHandler');

describe('DICOMHandler', () => {
  let handler;
  let mockDICOMBuffer;

  beforeEach(() => {
    handler = new DICOMHandler();
    
    // Create a mock DICOM buffer for testing
    mockDICOMBuffer = createMockDICOMBuffer();
  });

  describe('Constructor', () => {
    test('should initialize with logger', () => {
      expect(handler).toBeInstanceOf(DICOMHandler);
      expect(handler.logger).toBeInstanceOf(PACSLogger);
    });
  });

  describe('isValidDICOM', () => {
    test('should return true for valid DICOM buffer', () => {
      const result = handler.isValidDICOM(mockDICOMBuffer);
      expect(result).toBe(true);
    });

    test('should return false for buffer without DICM prefix', () => {
      const invalidBuffer = Buffer.alloc(200);
      const result = handler.isValidDICOM(invalidBuffer);
      expect(result).toBe(false);
    });

    test('should return false for buffer too small', () => {
      const smallBuffer = Buffer.alloc(100);
      const result = handler.isValidDICOM(smallBuffer);
      expect(result).toBe(false);
    });

    test('should return false for null buffer', () => {
      const result = handler.isValidDICOM(null);
      expect(result).toBe(false);
    });
  });

  describe('parseDataElement', () => {
    test('should parse data element correctly', () => {
      const element = handler.parseDataElement(mockDICOMBuffer, 132);
      expect(element).toHaveProperty('tag');
      expect(element).toHaveProperty('vr');
      expect(element).toHaveProperty('length');
      expect(element).toHaveProperty('value');
      expect(element).toHaveProperty('nextOffset');
    });

    test('should return null for invalid offset', () => {
      const element = handler.parseDataElement(mockDICOMBuffer, mockDICOMBuffer.length);
      expect(element).toBeNull();
    });
  });

  describe('parseValue', () => {
    test('should parse person name correctly', () => {
      const buffer = Buffer.from('Doe^John^^^', 'utf8');
      const value = handler.parseValue(buffer, 'PN', DICOM_TAGS.PATIENT_NAME);
      expect(value).toBe('Doe^John^^^');
    });

    test('should parse date correctly', () => {
      const buffer = Buffer.from('20240115', 'ascii');
      const value = handler.parseValue(buffer, 'DA', DICOM_TAGS.STUDY_DATE);
      expect(value).toBe('2024-01-15');
    });

    test('should parse time correctly', () => {
      const buffer = Buffer.from('143045', 'ascii');
      const value = handler.parseValue(buffer, 'TM', DICOM_TAGS.STUDY_TIME);
      expect(value).toBe('14:30:45');
    });

    test('should parse unsigned short correctly', () => {
      const buffer = Buffer.alloc(2);
      buffer.writeUInt16LE(512, 0);
      const value = handler.parseValue(buffer, 'US', DICOM_TAGS.ROWS);
      expect(value).toBe(512);
    });

    test('should handle pixel data', () => {
      const buffer = Buffer.alloc(1000);
      const value = handler.parseValue(buffer, 'OW', DICOM_TAGS.PIXEL_DATA);
      expect(value).toHaveProperty('type', 'pixel_data');
      expect(value).toHaveProperty('length', 1000);
    });

    test('should handle empty buffer', () => {
      const buffer = Buffer.alloc(0);
      const value = handler.parseValue(buffer, 'PN', DICOM_TAGS.PATIENT_NAME);
      expect(value).toBeNull();
    });
  });

  describe('getTagName', () => {
    test('should return correct tag name for patient name', () => {
      const tagName = handler.getTagName(DICOM_TAGS.PATIENT_NAME);
      expect(tagName).toBe('patientName');
    });

    test('should return correct tag name for study date', () => {
      const tagName = handler.getTagName(DICOM_TAGS.STUDY_DATE);
      expect(tagName).toBe('studyDate');
    });

    test('should return null for unknown tag', () => {
      const tagName = handler.getTagName('12345678');
      expect(tagName).toBeNull();
    });

    test('should handle case insensitive tags', () => {
      const tagName = handler.getTagName(DICOM_TAGS.PATIENT_NAME.toLowerCase());
      expect(tagName).toBe('patientName');
    });
  });

  describe('formatMetadata', () => {
    test('should format metadata correctly', () => {
      const rawMetadata = {
        patientName: 'Doe^John^^^',
        patientId: '12345',
        studyDate: '2024-01-15',
        modality: 'CT'
      };

      const formatted = handler.formatMetadata(rawMetadata);

      expect(formatted).toHaveProperty('patient');
      expect(formatted).toHaveProperty('study');
      expect(formatted).toHaveProperty('series');
      expect(formatted).toHaveProperty('image');
      expect(formatted.patient.name).toBe('Doe^John^^^');
      expect(formatted.patient.id).toBe('12345');
      expect(formatted.study.date).toBe('2024-01-15');
      expect(formatted.series.modality).toBe('CT');
    });

    test('should handle empty metadata', () => {
      const formatted = handler.formatMetadata({});
      expect(formatted.patient.name).toBe('Unknown');
      expect(formatted.patient.id).toBe('Unknown');
      expect(formatted.study.description).toBe('Unknown');
    });
  });

  describe('parseMetadata', () => {
    test('should parse metadata from valid DICOM buffer', () => {
      const metadata = handler.parseMetadata(mockDICOMBuffer);
      expect(metadata).toHaveProperty('patient');
      expect(metadata).toHaveProperty('study');
      expect(metadata).toHaveProperty('series');
      expect(metadata).toHaveProperty('image');
    });

    test('should throw error for invalid DICOM buffer', () => {
      const invalidBuffer = Buffer.alloc(200);
      expect(() => {
        handler.parseMetadata(invalidBuffer);
      }).toThrow('Invalid DICOM file buffer');
    });
  });

  describe('extractImageData', () => {
    test('should extract image data from valid DICOM buffer', () => {
      const imageData = handler.extractImageData(mockDICOMBuffer);
      expect(imageData).toHaveProperty('pixelData');
      expect(imageData).toHaveProperty('imageInfo');
      expect(imageData).toHaveProperty('metadata');
    });

    test('should throw error for DICOM without pixel data', () => {
      const bufferWithoutPixelData = createMockDICOMBufferWithoutPixelData();
      expect(() => {
        handler.extractImageData(bufferWithoutPixelData);
      }).toThrow('No pixel data found in DICOM file');
    });
  });

  describe('readDICOMFile', () => {
    let tempFilePath;

    beforeEach(() => {
      tempFilePath = path.join(__dirname, 'temp_test.dcm');
    });

    afterEach(() => {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    });

    test('should read valid DICOM file', async () => {
      fs.writeFileSync(tempFilePath, mockDICOMBuffer);
      
      const buffer = await handler.readDICOMFile(tempFilePath);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBe(mockDICOMBuffer.length);
    });

    test('should throw error for non-existent file', async () => {
      await expect(handler.readDICOMFile('/non/existent/file.dcm'))
        .rejects.toThrow('DICOM file not found');
    });

    test('should throw error for invalid DICOM file', async () => {
      const invalidBuffer = Buffer.alloc(200);
      fs.writeFileSync(tempFilePath, invalidBuffer);
      
      await expect(handler.readDICOMFile(tempFilePath))
        .rejects.toThrow('Invalid DICOM file');
    });
  });

  describe('processDICOMFile', () => {
    let tempFilePath;

    beforeEach(() => {
      tempFilePath = path.join(__dirname, 'temp_test.dcm');
    });

    afterEach(() => {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    });

    test('should process valid DICOM file', async () => {
      fs.writeFileSync(tempFilePath, mockDICOMBuffer);
      
      const result = await handler.processDICOMFile(tempFilePath);
      expect(result.isValid).toBe(true);
      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('imageData');
      expect(result).toHaveProperty('processedAt');
    });

    test('should handle invalid DICOM file gracefully', async () => {
      const invalidBuffer = Buffer.alloc(200);
      fs.writeFileSync(tempFilePath, invalidBuffer);
      
      const result = await handler.processDICOMFile(tempFilePath);
      expect(result.isValid).toBe(false);
      expect(result).toHaveProperty('error');
    });
  });

  describe('batchProcessDICOMFiles', () => {
    let tempFilePaths;

    beforeEach(() => {
      tempFilePaths = [
        path.join(__dirname, 'temp_test1.dcm'),
        path.join(__dirname, 'temp_test2.dcm'),
        path.join(__dirname, 'temp_invalid.dcm')
      ];
    });

    afterEach(() => {
      tempFilePaths.forEach(filePath => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    });

    test('should process multiple files', async () => {
      // Create valid DICOM files
      fs.writeFileSync(tempFilePaths[0], mockDICOMBuffer);
      fs.writeFileSync(tempFilePaths[1], mockDICOMBuffer);
      
      // Create invalid DICOM file
      const invalidBuffer = Buffer.alloc(200);
      fs.writeFileSync(tempFilePaths[2], invalidBuffer);
      
      const results = await handler.batchProcessDICOMFiles(tempFilePaths);
      
      expect(results).toHaveLength(3);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(true);
      expect(results[2].isValid).toBe(false);
    });

    test('should handle empty file list', async () => {
      const results = await handler.batchProcessDICOMFiles([]);
      expect(results).toHaveLength(0);
    });
  });
});

describe('PACSLogger', () => {
  let logger;
  let consoleSpy;

  beforeEach(() => {
    logger = new PACSLogger('TestModule');
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      debug: jest.spyOn(console, 'debug').mockImplementation()
    };
  });

  afterEach(() => {
    Object.values(consoleSpy).forEach(spy => spy.mockRestore());
  });

  test('should log info messages', () => {
    logger.info('Test message', { key: 'value' });
    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('[TestModule] INFO: Test message'),
      { key: 'value' }
    );
  });

  test('should log error messages', () => {
    const error = new Error('Test error');
    logger.error('Error occurred', error, { context: 'test' });
    expect(consoleSpy.error).toHaveBeenCalledWith(
      expect.stringContaining('[TestModule] ERROR: Error occurred'),
      expect.objectContaining({
        error: 'Test error',
        stack: expect.any(String),
        context: 'test'
      })
    );
  });

  test('should log warnings', () => {
    logger.warn('Warning message');
    expect(consoleSpy.warn).toHaveBeenCalledWith(
      expect.stringContaining('[TestModule] WARN: Warning message'),
      {}
    );
  });

  test('should log debug messages', () => {
    logger.debug('Debug info');
    expect(consoleSpy.debug).toHaveBeenCalledWith(
      expect.stringContaining('[TestModule] DEBUG: Debug info'),
      {}
    );
  });
});

describe('Constants', () => {
  test('DICOM_TAGS should be defined', () => {
    expect(DICOM_TAGS).toBeDefined();
    expect(DICOM_TAGS.PATIENT_NAME).toBe('00100010');
    expect(DICOM_TAGS.STUDY_DATE).toBe('00080020');
    expect(DICOM_TAGS.PIXEL_DATA).toBe('7FE00010');
  });

  test('VR_TYPES should be defined', () => {
    expect(VR_TYPES).toBeDefined();
    expect(VR_TYPES.PN).toHaveProperty('name', 'Person Name');
    expect(VR_TYPES.DA).toHaveProperty('name', 'Date');
    expect(VR_TYPES.US).toHaveProperty('length', 2);
  });
});

// Helper functions for creating mock DICOM data

function createMockDICOMBuffer() {
  const buffer = Buffer.alloc(1000);
  
  // Write DICOM prefix at offset 128
  buffer.write('DICM', 128, 'ascii');
  
  // Write some mock data elements after the prefix
  let offset = 132;
  
  // Patient Name (0010,0010) - PN
  buffer.writeUInt16LE(0x0010, offset); // Group
  buffer.writeUInt16LE(0x0010, offset + 2); // Element
  buffer.write('PN', offset + 4, 'ascii'); // VR
  buffer.writeUInt16LE(12, offset + 6); // Length
  buffer.write('Doe^John^^^', offset + 8, 'utf8'); // Value
  offset += 20;
  
  // Study Date (0008,0020) - DA
  buffer.writeUInt16LE(0x0008, offset);
  buffer.writeUInt16LE(0x0020, offset + 2);
  buffer.write('DA', offset + 4, 'ascii');
  buffer.writeUInt16LE(8, offset + 6);
  buffer.write('20240115', offset + 8, 'ascii');
  offset += 16;
  
  // Rows (0028,0010) - US
  buffer.writeUInt16LE(0x0028, offset);
  buffer.writeUInt16LE(0x0010, offset + 2);
  buffer.write('US', offset + 4, 'ascii');
  buffer.writeUInt16LE(2, offset + 6);
  buffer.writeUInt16LE(512, offset + 8);
  offset += 10;
  
  // Columns (0028,0011) - US
  buffer.writeUInt16LE(0x0028, offset);
  buffer.writeUInt16LE(0x0011, offset + 2);
  buffer.write('US', offset + 4, 'ascii');
  buffer.writeUInt16LE(2, offset + 6);
  buffer.writeUInt16LE(512, offset + 8);
  offset += 10;
  
  // Pixel Data (7FE0,0010) - OW
  buffer.writeUInt16LE(0x7FE0, offset);
  buffer.writeUInt16LE(0x0010, offset + 2);
  buffer.write('OW', offset + 4, 'ascii');
  buffer.writeUInt16LE(0, offset + 6); // Reserved
  buffer.writeUInt32LE(100, offset + 8); // Length
  // Add some pixel data
  for (let i = 0; i < 100; i++) {
    buffer.writeUInt8(i % 256, offset + 12 + i);
  }
  
  return buffer;
}

function createMockDICOMBufferWithoutPixelData() {
  const buffer = Buffer.alloc(500);
  
  // Write DICOM prefix at offset 128
  buffer.write('DICM', 128, 'ascii');
  
  // Write some mock data elements but no pixel data
  let offset = 132;
  
  // Patient Name (0010,0010) - PN
  buffer.writeUInt16LE(0x0010, offset);
  buffer.writeUInt16LE(0x0010, offset + 2);
  buffer.write('PN', offset + 4, 'ascii');
  buffer.writeUInt16LE(12, offset + 6);
  buffer.write('Doe^John^^^', offset + 8, 'utf8');
  
  return buffer;
}