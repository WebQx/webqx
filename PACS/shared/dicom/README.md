# DICOM Handler Utilities

This module provides shared utilities for handling DICOM files within the PACS ecosystem. It includes functionality for parsing DICOM files, extracting metadata, and extracting image data for rendering.

## Features

- **DICOM File Validation**: Validates DICOM file format and structure
- **Metadata Extraction**: Extracts patient information, study details, series information, and image metadata
- **Image Data Extraction**: Extracts pixel data for rendering purposes
- **Error Logging**: Comprehensive logging for debugging and error tracking
- **Batch Processing**: Process multiple DICOM files efficiently

## Usage

### Basic Usage

```javascript
const { DICOMHandler } = require('./dicomHandler');

const handler = new DICOMHandler();

// Process a single DICOM file
async function processDICOM() {
  try {
    const result = await handler.processDICOMFile('/path/to/dicom/file.dcm');
    console.log('Patient Name:', result.metadata.patient.name);
    console.log('Study Date:', result.metadata.study.date);
    console.log('Image Dimensions:', result.imageData?.imageInfo.width, 'x', result.imageData?.imageInfo.height);
  } catch (error) {
    console.error('Error processing DICOM:', error);
  }
}
```

### Metadata Extraction

```javascript
const { DICOMHandler } = require('./dicomHandler');

const handler = new DICOMHandler();

// Extract metadata only
async function extractMetadata() {
  const buffer = await handler.readDICOMFile('/path/to/file.dcm');
  const metadata = handler.parseMetadata(buffer);
  
  console.log('Patient Info:', metadata.patient);
  console.log('Study Info:', metadata.study);
  console.log('Series Info:', metadata.series);
}
```

### Image Data Extraction

```javascript
const { DICOMHandler } = require('./dicomHandler');

const handler = new DICOMHandler();

// Extract image data for rendering
async function extractImageData() {
  const buffer = await handler.readDICOMFile('/path/to/file.dcm');
  const imageData = handler.extractImageData(buffer);
  
  console.log('Image Width:', imageData.imageInfo.width);
  console.log('Image Height:', imageData.imageInfo.height);
  console.log('Bits Allocated:', imageData.imageInfo.bitsAllocated);
  
  // Use imageData.pixelData for rendering
}
```

### Batch Processing

```javascript
const { DICOMHandler } = require('./dicomHandler');

const handler = new DICOMHandler();

// Process multiple files
async function batchProcess() {
  const filePaths = [
    '/path/to/file1.dcm',
    '/path/to/file2.dcm',
    '/path/to/file3.dcm'
  ];
  
  const results = await handler.batchProcessDICOMFiles(filePaths);
  
  results.forEach(result => {
    if (result.isValid) {
      console.log(`✓ ${result.filePath}: ${result.metadata.patient.name}`);
    } else {
      console.log(`✗ ${result.filePath}: ${result.error}`);
    }
  });
}
```

## API Reference

### DICOMHandler Class

#### Methods

- `isValidDICOM(buffer)` - Validates if buffer is a valid DICOM file
- `readDICOMFile(filePath)` - Reads DICOM file from disk
- `parseMetadata(buffer)` - Extracts metadata from DICOM buffer
- `extractImageData(buffer)` - Extracts pixel data and image information
- `processDICOMFile(filePath)` - Complete processing of a DICOM file
- `batchProcessDICOMFiles(filePaths)` - Process multiple DICOM files

#### Metadata Structure

The extracted metadata follows this structure:

```javascript
{
  patient: {
    name: 'Patient Name',
    id: 'Patient ID',
    birthDate: 'YYYY-MM-DD',
    sex: 'M/F'
  },
  study: {
    date: 'YYYY-MM-DD',
    time: 'HH:MM:SS',
    description: 'Study Description',
    instanceUID: 'Study Instance UID'
  },
  series: {
    date: 'YYYY-MM-DD',
    time: 'HH:MM:SS',
    description: 'Series Description',
    instanceUID: 'Series Instance UID',
    modality: 'CT/MR/CR/etc'
  },
  image: {
    instanceNumber: 'Instance Number',
    rows: 'Number of Rows',
    columns: 'Number of Columns',
    bitsAllocated: 'Bits Allocated',
    bitsStored: 'Bits Stored'
  }
}
```

### PACSLogger Class

Provides consistent logging across the PACS system:

- `info(message, context)` - Log informational messages
- `error(message, error, context)` - Log errors with stack traces
- `warn(message, context)` - Log warnings
- `debug(message, context)` - Log debug information

## Supported DICOM Tags

The handler currently supports extraction of the following DICOM tags:

### Patient Information
- Patient Name (0010,0010)
- Patient ID (0010,0020)
- Patient Birth Date (0010,0030)
- Patient Sex (0010,0040)

### Study Information
- Study Date (0008,0020)
- Study Time (0008,0030)
- Study Description (0008,1030)
- Study Instance UID (0020,000D)

### Series Information
- Series Date (0008,0021)
- Series Time (0008,0031)
- Series Description (0008,103E)
- Series Instance UID (0020,000E)
- Modality (0008,0060)

### Image Information
- Instance Number (0020,0013)
- Rows (0028,0010)
- Columns (0028,0011)
- Bits Allocated (0028,0100)
- Bits Stored (0028,0101)
- Pixel Data (7FE0,0010)

## Error Handling

The handler provides comprehensive error handling and logging:

- Invalid DICOM files are detected and logged
- Parsing errors are caught and logged with context
- File I/O errors are handled gracefully
- All errors include timestamps and contextual information

## Dependencies

This module uses only Node.js built-in modules:
- `fs` - File system operations
- `path` - Path utilities

No external dependencies are required, making it lightweight and easy to integrate.

## Integration with PACS Ecosystem

This module is designed to be reusable across different parts of the PACS ecosystem:

- **DICOM Storage**: Use for storing and indexing DICOM files
- **Image Viewers**: Extract image data for rendering
- **Worklist Management**: Extract patient and study information
- **Audit Systems**: Comprehensive logging for compliance
- **Data Migration**: Batch processing capabilities for large datasets