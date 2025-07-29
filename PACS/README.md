# PACS DICOM API Documentation

## Overview

The PACS (Picture Archiving and Communication System) DICOM API provides RESTful endpoints for uploading and retrieving medical images in DICOM format. This API is part of the WebQX Healthcare Platform and follows best practices for security and performance.

## API Endpoints

### 1. Upload DICOM File

**Endpoint:** `POST /api/dicom/upload`

**Description:** Upload a DICOM file and extract metadata

**Content-Type:** `multipart/form-data`

**Parameters:**
- `dicomFile` (file): The DICOM file to upload

**Response (Success - 201):**
```json
{
  "success": true,
  "data": {
    "id": "unique-file-id",
    "filename": "generated-filename.dcm",
    "originalName": "original-filename.dcm",
    "fileSize": 1024,
    "uploadedAt": "2024-01-15T10:30:00.000Z",
    "metadata": {
      "patientName": "SMITH^JOHN",
      "patientId": "12345",
      "studyDate": "20240115",
      "studyTime": "103000",
      "modality": "CT",
      "studyDescription": "Chest CT",
      "seriesDescription": "Axial images",
      "instanceNumber": "1",
      "sopInstanceUID": "1.2.3.4.5.6.7.8.9",
      "studyInstanceUID": "1.2.3.4.5.6.7.8",
      "seriesInstanceUID": "1.2.3.4.5.6.7.8.9.10"
    }
  }
}
```

**Response (Error - 400):**
```json
{
  "error": {
    "code": 400,
    "message": "Invalid DICOM file: missing DICM prefix",
    "type": "DICOM_API_ERROR"
  }
}
```

### 2. Retrieve DICOM File

**Endpoint:** `GET /api/dicom/{id}`

**Description:** Download a DICOM file by its unique ID

**Parameters:**
- `id` (path): The unique ID of the DICOM file

**Response:** 
- Content-Type: `application/dicom`
- Content-Disposition: `attachment; filename="original-filename.dcm"`
- X-DICOM-Metadata: JSON string containing metadata

### 3. Get DICOM Metadata

**Endpoint:** `GET /api/dicom/{id}/metadata`

**Description:** Retrieve only the metadata for a DICOM file

**Parameters:**
- `id` (path): The unique ID of the DICOM file

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "id": "unique-file-id",
    "filename": "generated-filename.dcm",
    "originalName": "original-filename.dcm",
    "fileSize": 1024,
    "uploadedAt": "2024-01-15T10:30:00.000Z",
    "metadata": {
      "patientName": "SMITH^JOHN",
      "patientId": "12345",
      "studyDate": "20240115",
      "modality": "CT"
    }
  }
}
```

### 4. List All DICOM Files

**Endpoint:** `GET /api/dicom`

**Description:** Get a list of all uploaded DICOM files

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "total": 2,
    "dicomFiles": [
      {
        "id": "unique-file-id-1",
        "filename": "generated-filename-1.dcm",
        "originalName": "scan1.dcm",
        "fileSize": 1024,
        "uploadedAt": "2024-01-15T10:30:00.000Z",
        "patientName": "SMITH^JOHN",
        "studyDate": "20240115",
        "modality": "CT"
      },
      {
        "id": "unique-file-id-2",
        "filename": "generated-filename-2.dcm",
        "originalName": "scan2.dcm",
        "fileSize": 2048,
        "uploadedAt": "2024-01-15T11:00:00.000Z",
        "patientName": "DOE^JANE",
        "studyDate": "20240115",
        "modality": "MR"
      }
    ]
  }
}
```

### 5. Delete DICOM File

**Endpoint:** `DELETE /api/dicom/{id}`

**Description:** Delete a DICOM file and its metadata

**Parameters:**
- `id` (path): The unique ID of the DICOM file

**Response (Success - 204):** No content

## Usage Examples

### Upload a DICOM file using curl

```bash
curl -X POST http://localhost:3000/api/dicom/upload \
  -F "dicomFile=@/path/to/your/file.dcm" \
  -H "Content-Type: multipart/form-data"
```

### Download a DICOM file

```bash
curl -X GET http://localhost:3000/api/dicom/{file-id} \
  -o downloaded-file.dcm
```

### Get metadata only

```bash
curl -X GET http://localhost:3000/api/dicom/{file-id}/metadata
```

### List all files

```bash
curl -X GET http://localhost:3000/api/dicom
```

## Security Features

1. **File Validation:** Only DICOM files are accepted (validated by DICM header)
2. **File Size Limits:** Maximum upload size is 100MB
3. **Unique File Names:** Generated using UUIDs to prevent conflicts
4. **Error Handling:** Comprehensive error messages for debugging
5. **Metadata Extraction:** Safe parsing with fallback for corrupted files

## Error Codes

- `400` - Bad Request (invalid file, missing parameters)
- `404` - Not Found (file doesn't exist)
- `500` - Internal Server Error (processing error)

## Technical Implementation

- **Framework:** Express.js
- **File Upload:** Multer middleware
- **DICOM Parsing:** dicom-parser library
- **Validation:** express-validator
- **Storage:** Local filesystem (uploads/dicom/)
- **Metadata Storage:** In-memory Map (can be extended to database)

## Testing

Run the PACS API tests:

```bash
npm test -- --testPathPatterns=PACS
```

## File Structure

```
PACS/
├── shared/
│   └── api/
│       └── dicomApi.js          # Main API implementation
└── __tests__/
    └── dicomApi.test.js         # Comprehensive test suite
```

## Future Enhancements

1. Database integration for metadata persistence
2. DICOM networking (C-STORE, C-FIND)
3. Image viewer integration
4. Advanced query capabilities
5. Cloud storage support
6. Authentication and authorization
7. Audit logging