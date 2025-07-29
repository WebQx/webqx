/**
 * DICOM Handler Usage Examples
 * 
 * Demonstrates how to use the DICOM utilities in various scenarios
 */

const { DICOMHandler } = require('./dicomHandler');
const fs = require('fs');
const path = require('path');

// Example 1: Basic DICOM file processing
async function basicDICOMProcessing() {
  console.log('=== Basic DICOM Processing Example ===');
  
  const handler = new DICOMHandler();
  
  // Note: This is an example - you would use real DICOM file paths
  const filePath = '/path/to/your/dicom/file.dcm';
  
  try {
    // Check if file exists (for demo purposes, we'll skip actual processing)
    if (!fs.existsSync(filePath)) {
      console.log('Example file does not exist, creating mock demo...');
      await demonstrateWithMockData(handler);
      return;
    }
    
    // Process the DICOM file
    const result = await handler.processDICOMFile(filePath);
    
    if (result.isValid) {
      console.log('✓ File processed successfully');
      console.log('Patient:', result.metadata.patient.name);
      console.log('Study Date:', result.metadata.study.date);
      console.log('Modality:', result.metadata.series.modality);
      
      if (result.imageData) {
        console.log('Image Dimensions:', 
          result.imageData.imageInfo.width, 'x', 
          result.imageData.imageInfo.height);
      }
    } else {
      console.log('✗ File processing failed:', result.error);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Example 2: Batch processing multiple DICOM files
async function batchDICOMProcessing() {
  console.log('\n=== Batch DICOM Processing Example ===');
  
  const handler = new DICOMHandler();
  
  // Example file paths - in real usage, these would be actual DICOM files
  const filePaths = [
    '/path/to/dicom1.dcm',
    '/path/to/dicom2.dcm',
    '/path/to/dicom3.dcm'
  ];
  
  try {
    console.log('Processing', filePaths.length, 'files...');
    
    // For demo purposes, we'll show how the API would be used
    console.log('Note: This is a demonstration of the API structure');
    console.log('File paths provided:', filePaths);
    
    // In real usage:
    // const results = await handler.batchProcessDICOMFiles(filePaths);
    // 
    // results.forEach((result, index) => {
    //   if (result.isValid) {
    //     console.log(`✓ File ${index + 1}: ${result.metadata.patient.name}`);
    //   } else {
    //     console.log(`✗ File ${index + 1}: ${result.error}`);
    //   }
    // });
    
  } catch (error) {
    console.error('Batch processing error:', error.message);
  }
}

// Example 3: Metadata extraction for indexing
async function metadataExtractionExample() {
  console.log('\n=== Metadata Extraction Example ===');
  
  const handler = new DICOMHandler();
  
  // This demonstrates how you might extract metadata for database indexing
  await demonstrateMetadataExtraction(handler);
}

// Example 4: Image data extraction for rendering
async function imageDataExtractionExample() {
  console.log('\n=== Image Data Extraction Example ===');
  
  const handler = new DICOMHandler();
  
  // This demonstrates image data extraction for rendering purposes
  await demonstrateImageDataExtraction(handler);
}

// Example 5: Error handling and logging
async function errorHandlingExample() {
  console.log('\n=== Error Handling Example ===');
  
  const handler = new DICOMHandler();
  
  // Demonstrate error handling with invalid files
  const invalidFilePath = '/non/existent/file.dcm';
  
  try {
    const result = await handler.processDICOMFile(invalidFilePath);
    console.log('Result for invalid file:', {
      isValid: result.isValid,
      error: result.error,
      processedAt: result.processedAt
    });
  } catch (error) {
    console.log('Caught error (as expected):', error.message);
  }
}

// Demo functions using mock data

async function demonstrateWithMockData(handler) {
  console.log('Creating mock DICOM data for demonstration...');
  
  // Create a mock DICOM buffer (this is what the real buffer would look like)
  const mockBuffer = createMockDICOMBuffer();
  
  // Validate the buffer
  const isValid = handler.isValidDICOM(mockBuffer);
  console.log('Mock DICOM buffer is valid:', isValid);
  
  if (isValid) {
    // Parse metadata
    const metadata = handler.parseMetadata(mockBuffer);
    console.log('Extracted metadata:', JSON.stringify(metadata, null, 2));
    
    // Extract image data
    try {
      const imageData = handler.extractImageData(mockBuffer);
      console.log('Image info:', {
        width: imageData.imageInfo.width,
        height: imageData.imageInfo.height,
        bitsAllocated: imageData.imageInfo.bitsAllocated,
        pixelDataSize: imageData.pixelData.length
      });
    } catch (error) {
      console.log('Image extraction note:', error.message);
    }
  }
}

async function demonstrateMetadataExtraction(handler) {
  console.log('Demonstrating metadata extraction for database indexing...');
  
  const mockBuffer = createMockDICOMBuffer();
  
  if (handler.isValidDICOM(mockBuffer)) {
    const metadata = handler.parseMetadata(mockBuffer);
    
    // Show how metadata would be used for database indexing
    const databaseRecord = {
      patient_name: metadata.patient.name,
      patient_id: metadata.patient.id,
      study_date: metadata.study.date,
      study_description: metadata.study.description,
      modality: metadata.series.modality,
      series_description: metadata.series.description,
      image_rows: metadata.image.rows,
      image_columns: metadata.image.columns,
      indexed_at: new Date().toISOString()
    };
    
    console.log('Database record structure:', JSON.stringify(databaseRecord, null, 2));
  }
}

async function demonstrateImageDataExtraction(handler) {
  console.log('Demonstrating image data extraction for rendering...');
  
  const mockBuffer = createMockDICOMBuffer();
  
  if (handler.isValidDICOM(mockBuffer)) {
    try {
      const imageData = handler.extractImageData(mockBuffer);
      
      // Show how image data would be prepared for rendering
      const renderingInfo = {
        imageBuffer: imageData.pixelData,
        width: imageData.imageInfo.width,
        height: imageData.imageInfo.height,
        bitsPerPixel: imageData.imageInfo.bitsAllocated,
        pixelRepresentation: 'unsigned', // This would be extracted from DICOM
        photometricInterpretation: 'MONOCHROME2', // This would be extracted from DICOM
        windowCenter: 512, // This would be extracted from DICOM
        windowWidth: 1024, // This would be extracted from DICOM
        rescaleIntercept: 0, // This would be extracted from DICOM
        rescaleSlope: 1 // This would be extracted from DICOM
      };
      
      console.log('Rendering preparation info:', {
        ...renderingInfo,
        imageBuffer: `Buffer(${renderingInfo.imageBuffer.length} bytes)`
      });
      
      // In a real application, you would pass this to a canvas or WebGL renderer
      console.log('Note: In a real application, the pixel data would be passed to a rendering engine');
      
    } catch (error) {
      console.log('Image extraction note:', error.message);
    }
  }
}

// Helper function to create mock DICOM data for demonstration
function createMockDICOMBuffer() {
  const buffer = Buffer.alloc(1000);
  
  // Write DICOM prefix at offset 128
  buffer.write('DICM', 128, 'ascii');
  
  // Write some mock data elements
  let offset = 132;
  
  // Patient Name (0010,0010) - PN
  buffer.writeUInt16LE(0x0010, offset);
  buffer.writeUInt16LE(0x0010, offset + 2);
  buffer.write('PN', offset + 4, 'ascii');
  buffer.writeUInt16LE(12, offset + 6);
  buffer.write('Doe^John^^^', offset + 8, 'utf8');
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
  
  // Add some mock pixel data
  for (let i = 0; i < 100; i++) {
    buffer.writeUInt8(Math.floor(Math.random() * 256), offset + 12 + i);
  }
  
  return buffer;
}

// Run all examples
async function runAllExamples() {
  console.log('DICOM Handler Usage Examples');
  console.log('============================\n');
  
  await basicDICOMProcessing();
  await batchDICOMProcessing();
  await metadataExtractionExample();
  await imageDataExtractionExample();
  await errorHandlingExample();
  
  console.log('\n=== Examples completed ===');
  console.log('For integration into PACS systems:');
  console.log('1. Use in DICOM storage services for metadata indexing');
  console.log('2. Use in image viewers for pixel data extraction');
  console.log('3. Use in worklist management for patient/study information');
  console.log('4. Use in audit systems for comprehensive logging');
  console.log('5. Use in data migration tools for batch processing');
}

// Export for use in other modules
module.exports = {
  basicDICOMProcessing,
  batchDICOMProcessing,
  metadataExtractionExample,
  imageDataExtractionExample,
  errorHandlingExample,
  runAllExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}