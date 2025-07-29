# WebQX PACS Ecosystem

A comprehensive Picture Archiving and Communication System (PACS) ecosystem for the WebQX healthcare platform, designed to handle medical imaging workflows for both providers and patients.

## 📁 Folder Structure

```
PACS/
├── provider_panel/          # Provider-specific imaging tools
│   └── imagingViewer.js     # Advanced imaging viewer for healthcare providers
├── patient_portal/          # Patient-friendly imaging components  
│   └── imageViewer.js       # Simplified image viewer for patients
└── shared/                  # Shared utilities and resources
    ├── dicom/              # DICOM handling utilities
    │   └── dicomHandler.js  # DICOM file parsing and extraction
    └── api/                # DICOM API services
        └── dicomApi.js      # APIs for uploading and retrieving DICOM files
```

## 🚀 Features

### Provider Panel (`PACS/provider_panel/`)
- **Advanced Imaging Viewer** (`imagingViewer.js`)
  - Multi-planar reconstruction (MPR) support
  - Professional annotation tools (arrows, text, shapes)
  - Precision measurement tools (distance, area, angles)
  - Window/level adjustments for optimal contrast
  - Zoom, pan, rotate, and flip functionality
  - Keyboard shortcuts for efficient workflow
  - Export capabilities with annotations
  - DICOM metadata display
  - Multi-series navigation

### Patient Portal (`PACS/patient_portal/`)
- **Patient-Friendly Image Viewer** (`imageViewer.js`)
  - Simplified, intuitive interface
  - Accessibility features and screen reader support
  - Multilingual support (English, Spanish, extensible)
  - Patient-friendly medical terminology
  - Zoom and basic navigation tools
  - Educational overlays and help system
  - Privacy-focused design with anonymized data display
  - Responsive design for mobile devices

### Shared Resources (`PACS/shared/`)
- **DICOM Handler** (`shared/dicom/dicomHandler.js`)
  - DICOM file validation and parsing
  - Metadata extraction with comprehensive tag support
  - Image data processing for display
  - DICOM anonymization capabilities
  - File size and format validation
  - Error handling and logging

- **DICOM API** (`shared/api/dicomApi.js`)
  - RESTful API for DICOM operations
  - Upload with progress tracking
  - Study, series, and instance retrieval
  - Advanced search and filtering
  - Authentication and authorization
  - Chunked upload for large files
  - Comprehensive error handling

## 🛠️ Basic Usage

### DICOM Handler
```javascript
const { createDicomHandler } = require('./PACS/shared/dicom/dicomHandler.js');

// Create handler with custom configuration
const dicomHandler = createDicomHandler({
  maxFileSize: 100 * 1024 * 1024, // 100MB
  timeout: 30000
});

// Validate DICOM file
const isValid = await dicomHandler.validateDicomFile(file);

// Extract metadata
const metadata = await dicomHandler.extractMetadata(file);

// Process image data
const imageData = await dicomHandler.processImageData(file);
```

### DICOM API
```javascript
const { createDicomApi } = require('./PACS/shared/api/dicomApi.js');

// Create API client
const dicomApi = createDicomApi({
  baseUrl: '/api/v1/dicom',
  timeout: 30000
});

// Set authentication token
dicomApi.setAuthToken('your-jwt-token');

// Upload DICOM file
const uploadResult = await dicomApi.uploadDicomFile(file, metadata, progressCallback);

// Get patient studies
const studies = await dicomApi.getPatientStudies('patient-123');

// Search studies
const searchResults = await dicomApi.searchStudies({
  patientId: 'patient-123',
  modality: 'CT',
  studyDate: '20240101-20241231'
});
```

### Provider Imaging Viewer
```javascript
const { createProviderImagingViewer } = require('./PACS/provider_panel/imagingViewer.js');

// Create viewer instance
const viewer = createProviderImagingViewer({
  containerId: 'imaging-viewer',
  width: 800,
  height: 600,
  enableAnnotations: true,
  enableMeasurements: true
});

// Initialize viewer
await viewer.initialize();

// Load study
await viewer.loadStudy(studyData);

// Add annotation
const annotation = viewer.addAnnotation('arrow', coordinates, 'Finding here');

// Add measurement
const measurement = viewer.addMeasurement('distance', [point1, point2]);
```

### Patient Image Viewer
```javascript
const { createPatientImageViewer } = require('./PACS/patient_portal/imageViewer.js');

// Create patient viewer
const patientViewer = createPatientImageViewer({
  containerId: 'patient-viewer',
  width: 600,
  height: 500,
  language: 'en',
  accessibilityMode: false
});

// Initialize viewer
await patientViewer.initialize();

// Load image (anonymized for patient)
await patientViewer.loadImage(anonymizedImageData);

// Basic interactions
patientViewer.zoom('in');
patientViewer.resetView();
patientViewer.showHelp();
```

## 🌐 Multilingual Support

The patient viewer supports multiple languages:
- **English** (en) - Default
- **Spanish** (es) - Full translation
- **Extensible** - Easy to add new languages

```javascript
// Switch language
patientViewer.setLanguage('es'); // Switch to Spanish
```

## ♿ Accessibility Features

- **ARIA labels** and semantic HTML structure
- **Keyboard navigation** with standard shortcuts
- **Screen reader compatibility** with live announcements
- **High contrast mode** for better visibility
- **Focus management** for keyboard users
- **Voice announcements** for zoom and interaction feedback

## 🔒 Security & Privacy

- **Patient data anonymization** for patient portal viewing
- **Authentication required** for provider tools
- **Audit logging** for all DICOM operations
- **HIPAA-compliant** design patterns
- **Secure file handling** with validation
- **Role-based access control** support

## 🧪 Testing

The PACS ecosystem includes comprehensive testing capabilities:

```javascript
// Test all modules
const { testPACSModules } = require('./test-pacs-basic.js');
const success = await testPACSModules();
```

## 📋 Requirements

- **Node.js** 16.0.0 or higher
- **Modern browser** with HTML5 Canvas support
- **File API support** for file handling
- **Fetch API** for network requests

## 🔌 Integration

The PACS ecosystem is designed to integrate seamlessly with:
- **WebQX Patient Portal** - Direct integration with existing patient workflows
- **WebQX Provider Panel** - Enhanced EHR integration
- **FHIR R4** - Standard healthcare data exchange
- **HL7 messaging** - Hospital system integration
- **Orthanc PACS** - Open-source DICOM server
- **OHIF Viewer** - Advanced web-based DICOM viewer

## 🚧 Development Roadmap

- [ ] **Real DICOM parsing** - Integration with dicom-parser library
- [ ] **3D volume rendering** - Support for CT/MRI volume visualization
- [ ] **AI integration** - Computer-aided diagnosis tools
- [ ] **Mobile optimization** - Enhanced mobile viewer experience
- [ ] **Offline capabilities** - Local caching and offline viewing
- [ ] **Real-time collaboration** - Multi-user annotation and measurement sharing

## 📄 License

This PACS ecosystem is part of the WebQX Healthcare Platform and is licensed under the Apache 2.0 License. See the main repository LICENSE.md for details.

---

**WebQX Health** - *"Care equity begins with code equity."*