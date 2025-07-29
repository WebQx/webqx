# WebQX PACS Module

This module provides comprehensive Picture Archiving and Communication System (PACS) integration for the WebQX healthcare platform, enabling both provider panel management and patient portal access to medical imaging.

## 🎯 Overview

The PACS module integrates medical imaging functionality with WebQX's existing healthcare platform, providing:

- **Provider Panel Integration**: Complete imaging workflow management for healthcare providers
- **Patient Portal Access**: Secure patient access to their medical imaging studies
- **Multi-PACS Support**: Integration with Orthanc, OHIF, Dicoogle, and PostDICOM
- **DICOM Compliance**: Full DICOM standard support with validation and metadata extraction
- **Educational Features**: Patient-friendly explanations and educational content

## 🏗️ Architecture

```
PACS/
├── types/                    # TypeScript type definitions
│   └── index.ts             # DICOM, PACS, and workflow types
├── services/                # Core business logic services
│   ├── pacsService.ts       # Main PACS operations service
│   ├── dicomService.ts      # DICOM file handling service
│   └── imagingWorkflowService.ts # Clinical workflow management
├── components/              # React UI components
│   ├── provider/            # Provider-facing components
│   │   └── PACSProviderDashboard.tsx
│   ├── patient/             # Patient-facing components
│   │   └── PACSPatientViewer.tsx
│   └── integrations/        # Integration components
│       ├── PatientPortalIntegration.tsx
│       └── ProviderPanelIntegration.tsx
├── utils/                   # Utility functions
│   ├── dicomValidation.ts   # DICOM validation utilities
│   └── imagingUtils.ts      # Imaging data manipulation
├── config/                  # Configuration files
│   └── pacsConfig.ts        # PACS server configuration
├── __tests__/               # Test files
│   └── pacsIntegration.test.ts
└── index.ts                 # Module entry point
```

## 🚀 Quick Start

### 1. Import the Module

```typescript
import { 
  PACSService, 
  PACSProviderDashboard, 
  PACSPatientViewer 
} from './PACS';
```

### 2. Provider Integration

```tsx
import { ProviderPanelPACSIntegration } from './PACS/components/integrations/ProviderPanelIntegration';

function ProviderDashboard({ providerID, isAuthenticated }) {
  return (
    <ProviderPanelPACSIntegration
      providerID={providerID}
      isAuthenticated={isAuthenticated}
      specialty="radiology"
    />
  );
}
```

### 3. Patient Integration

```tsx
import { PatientPortalPACSIntegration } from './PACS/components/integrations/PatientPortalIntegration';

function PatientPortal({ patientID, isAuthenticated }) {
  return (
    <PatientPortalPACSIntegration
      patientID={patientID}
      isAuthenticated={isAuthenticated}
    />
  );
}
```

### 4. Basic Service Usage

```typescript
import { PACSService, ImagingWorkflowService } from './PACS';

const pacsService = new PACSService();
const workflowService = new ImagingWorkflowService(pacsService);

// Search for studies
const studies = await pacsService.searchStudies({
  patientID: 'PAT001',
  modality: ['CT', 'MR']
});

// Create imaging order
const order = await workflowService.createImagingOrder({
  patientID: 'PAT001',
  providerID: 'PROV001',
  orderDate: '2024-01-15',
  modality: 'CT',
  bodyPart: 'Chest',
  clinicalIndication: 'Shortness of breath',
  urgency: 'routine'
});
```

## 🔧 Configuration

### PACS Server Configuration

Configure PACS servers via environment variables:

```bash
# Orthanc Configuration
ORTHANC_URL=http://localhost
ORTHANC_PORT=8042
ORTHANC_USERNAME=orthanc
ORTHANC_PASSWORD=orthanc
ORTHANC_ENABLED=true

# OHIF Viewer Configuration
OHIF_URL=http://localhost
OHIF_PORT=3000
OHIF_ENABLED=true

# Dicoogle Configuration
DICOOGLE_URL=http://localhost
DICOOGLE_PORT=8080
DICOOGLE_USERNAME=admin
DICOOGLE_PASSWORD=admin
DICOOGLE_ENABLED=true

# PostDICOM Configuration
POSTDICOM_URL=https://api.postdicom.com
POSTDICOM_API_KEY=your_api_key
POSTDICOM_ENABLED=false

# General PACS Settings
PACS_PRIMARY_SERVER=orthanc-primary
PACS_PATIENT_ACCESS_ENABLED=true
PACS_REQUIRE_CONSENT=true
PACS_AUDIT_LOGGING_ENABLED=true
```

### Custom Server Configuration

```typescript
import { PACSService } from './PACS';

const customServers = [
  {
    id: 'custom-pacs',
    name: 'Custom PACS Server',
    type: 'orthanc',
    baseUrl: 'https://your-pacs-server.com',
    port: 443,
    protocol: 'https',
    authentication: {
      type: 'api-key',
      credentials: {
        apiKey: 'your-api-key'
      }
    },
    capabilities: {
      dicomStore: true,
      dicomQuery: true,
      dicomRetrieve: true,
      webViewer: true,
      thumbnailGeneration: true,
      metadataExtraction: true,
      anonymization: true
    },
    isActive: true
  }
];

const pacsService = new PACSService(customServers);
```

## 🔐 Security Features

### Patient Access Control

- **Consent Management**: Requires explicit patient consent for image access
- **Time-Limited Access**: Configurable access expiry periods
- **Audit Logging**: Complete audit trail of all access attempts
- **Role-Based Access**: Different access levels for providers and patients

### DICOM Security

- **Data Anonymization**: Built-in DICOM anonymization capabilities
- **Secure Transport**: TLS encryption for all PACS communications
- **Access Validation**: Comprehensive validation of all requests

## 📊 Features

### Provider Panel Features

- **Imaging Worklist**: Active order management and tracking
- **Study Search**: Advanced search with multiple criteria
- **Report Management**: Create and manage imaging reports
- **Order Management**: Complete order lifecycle management
- **Multi-PACS Support**: Connect to multiple PACS servers
- **Specialty Filtering**: Modality filtering by medical specialty

### Patient Portal Features

- **Secure Viewing**: Patient-specific study access with consent
- **Educational Content**: Medical terminology explanations
- **Report Access**: Patient-friendly report summaries
- **Study History**: Complete imaging history with timeline
- **Download Control**: Configurable download permissions
- **Share Functionality**: Secure sharing with other providers

### DICOM Features

- **Metadata Extraction**: Complete DICOM tag parsing
- **Format Validation**: DICOM file format validation
- **Thumbnail Generation**: Automatic thumbnail creation
- **Format Conversion**: Convert DICOM to web formats
- **Anonymization**: Remove patient identifiers
- **Transfer Syntax Support**: Multiple DICOM transfer syntaxes

## 🧪 Testing

Run the PACS integration tests:

```bash
npm test -- PACS/__tests__/pacsIntegration.test.ts
```

The test suite covers:
- PACS service operations
- DICOM file handling
- Imaging workflow management
- Validation utilities
- Integration scenarios

## 🔌 Integration Points

### Patient Portal Integration

The PACS module integrates with the existing patient portal through:

- **Authentication**: Uses existing patient authentication
- **Navigation**: Adds "My Images" section to patient menu
- **Notifications**: Integrates with patient notification system
- **Consent Management**: Links with patient consent framework

### Provider Panel Integration

Provider integration includes:

- **EHR Integration**: Links with existing EHR workflows
- **Order Management**: Integrates with clinical order systems
- **Reporting**: Connects with reporting workflows
- **Specialty Modules**: Enhances specialty-specific workflows

### Admin Console Integration

Admin features include:

- **PACS Server Management**: Configure and monitor PACS servers
- **Access Control**: Manage patient and provider access
- **Audit Reporting**: Generate access and usage reports
- **System Monitoring**: Health checks and performance monitoring

## 📈 Performance Considerations

### Caching

- **Thumbnail Caching**: Automatic thumbnail caching with TTL
- **Metadata Caching**: Study metadata caching for faster access
- **Session Management**: Efficient viewer session management

### Scalability

- **Connection Pooling**: Managed PACS server connections
- **Load Balancing**: Multiple PACS server support
- **Async Operations**: Non-blocking DICOM operations

## 🌐 FHIR Integration

The PACS module supports FHIR integration for:

- **ImagingStudy Resources**: Map DICOM studies to FHIR ImagingStudy
- **DiagnosticReport Integration**: Link imaging reports to FHIR
- **Patient Resource Linking**: Connect to FHIR Patient resources
- **Observation Mapping**: Map imaging findings to FHIR Observations

## 📚 API Reference

### PACSService

```typescript
class PACSService {
  searchStudies(criteria: ImagingSearchCriteria): Promise<PACSResponse<ImagingSearchResult>>
  getStudyDetails(studyInstanceUID: string): Promise<PACSResponse<DICOMStudy>>
  createPatientSession(patientID: string, studyInstanceUID: string): Promise<PACSResponse<ImagingSession>>
  getViewerURL(studyInstanceUID: string, sessionID?: string): string
  testConnection(serverId: string): Promise<PACSResponse<boolean>>
}
```

### ImagingWorkflowService

```typescript
class ImagingWorkflowService {
  createImagingOrder(orderData: Omit<ImagingOrder, 'orderID' | 'status'>): Promise<PACSResponse<ImagingOrder>>
  updateOrderStatus(orderID: string, status: ImagingOrder['status']): Promise<PACSResponse<ImagingOrder>>
  createImagingReport(reportData: Omit<ImagingReport, 'reportID'>): Promise<PACSResponse<ImagingReport>>
  grantPatientAccess(patientID: string, studyInstanceUID: string, accessType: string, providerID: string): Promise<PACSResponse<PatientImagingAccess>>
}
```

### DICOMService

```typescript
class DICOMService {
  parseDICOMMetadata(dicomData: ArrayBuffer): Promise<PACSResponse<DICOMMetadata>>
  validateDICOMFile(dicomData: ArrayBuffer): Promise<PACSResponse<boolean>>
  generateThumbnail(dicomData: ArrayBuffer): Promise<PACSResponse<string>>
  convertToWebFormat(dicomData: ArrayBuffer, format: string): Promise<PACSResponse<string>>
}
```

## 🤝 Contributing

When contributing to the PACS module:

1. Follow existing code patterns and TypeScript conventions
2. Add comprehensive tests for new functionality
3. Update documentation for API changes
4. Ensure DICOM compliance for all imaging operations
5. Test with multiple PACS server configurations

## 📄 License

This PACS module is part of the WebQX healthcare platform and follows the same Apache 2.0 license terms.