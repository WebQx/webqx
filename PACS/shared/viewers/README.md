# PACS Imaging Viewers

This document provides comprehensive documentation for the PACS imaging viewer components implemented in `PACS/shared/viewers/`.

## Overview

The PACS imaging viewers provide comprehensive DICOM image viewing capabilities for both healthcare providers and patients. The architecture includes shared components that can be configured for different use cases.

## Components

### Core Components

#### DicomViewer
Base DICOM viewer component with essential viewing functionality.

```tsx
import { DicomViewer } from './PACS/shared/viewers';

// Basic usage
<DicomViewer
  studyInstanceUID="1.2.3.4.5"
  config={{
    enableZoom: true,
    enablePan: true,
    enableRotate: true,
    enableBrightnessContrast: true,
    enableMeasurements: false,
    enableAnnotations: false,
    enableCine: true,
    enableFullscreen: true,
    enableMetadataDisplay: true,
    enableWindowLevel: true,
    readOnly: false,
  }}
  onImageLoad={(image) => console.log('Image loaded:', image)}
  onError={(error) => console.error('Viewer error:', error)}
/>
```

#### ViewerControls
Interactive controls for DICOM viewer functionality.

```tsx
import { ViewerControls } from './PACS/shared/viewers';

<ViewerControls
  config={viewerConfig}
  state={viewerState}
  tools={viewerTools}
  onZoom={(factor) => handleZoom(factor)}
  onPan={(delta) => handlePan(delta)}
  onRotate={(angle) => handleRotate(angle)}
  onBrightnessChange={(value) => handleBrightness(value)}
  onContrastChange={(value) => handleContrast(value)}
  onWindowLevel={(center, width) => handleWindowLevel(center, width)}
  onToolSelect={(tool) => handleToolSelect(tool)}
  onReset={() => handleReset()}
  onFullscreen={() => handleFullscreen()}
/>
```

#### MetadataDisplay
Component for displaying DICOM metadata in structured format.

```tsx
import { MetadataDisplay } from './PACS/shared/viewers';

// Full metadata display
<MetadataDisplay
  metadata={dicomMetadata}
  readOnly={false}
  className="provider-metadata"
/>

// Compact view for limited space
<MetadataDisplay
  metadata={dicomMetadata}
  compact={true}
  readOnly={true}
  className="patient-metadata"
/>
```

### Specialized Viewers

#### ProviderViewer
Advanced DICOM viewer for healthcare providers with full functionality.

```tsx
import { ProviderViewer } from './PACS/shared/viewers';

<ProviderViewer
  studyInstanceUID="1.2.3.4.5"
  seriesInstanceUID="1.2.3.4.5.6" // Optional
  onSave={(data) => handleSave(data)}
  onPrint={() => handlePrint()}
  onExport={(format) => handleExport(format)}
  className="provider-viewer-container"
/>
```

**Features:**
- Full zoom, pan, rotate controls
- Brightness/contrast adjustments
- Window level controls
- Measurement tools (distance, angle, area)
- Annotation tools (arrow, text, shapes)
- Metadata display with edit capabilities
- Save/load annotations
- Print and export functionality

#### PatientViewer
Simplified DICOM viewer for patients with basic functionality.

```tsx
import { PatientViewer } from './PACS/shared/viewers';

<PatientViewer
  studyInstanceUID="1.2.3.4.5"
  seriesInstanceUID="1.2.3.4.5.6" // Optional
  onViewComplete={() => handleViewComplete()}
  className="patient-viewer-container"
/>
```

**Features:**
- Basic zoom, pan, rotate controls
- Read-only metadata display
- Simple overlay controls
- Patient-friendly disclaimers
- Usage help information
- View session tracking

## Configuration

### ViewerConfig

```tsx
interface ViewerConfig {
  enableZoom: boolean;
  enablePan: boolean;
  enableRotate: boolean;
  enableBrightnessContrast: boolean;
  enableMeasurements: boolean;
  enableAnnotations: boolean;
  enableCine: boolean;
  enableFullscreen: boolean;
  enableMetadataDisplay: boolean;
  enableWindowLevel: boolean;
  readOnly: boolean;
}
```

### Pre-defined Configurations

```tsx
import { DEFAULT_PROVIDER_CONFIG, DEFAULT_PATIENT_CONFIG } from './PACS/shared/viewers';

// Provider configuration (full features)
const providerConfig = DEFAULT_PROVIDER_CONFIG;

// Patient configuration (simplified)
const patientConfig = DEFAULT_PATIENT_CONFIG;

// Custom configuration
const customConfig = {
  ...DEFAULT_PROVIDER_CONFIG,
  enableMeasurements: false, // Disable measurements
  enableAnnotations: false,  // Disable annotations
};
```

## Data Types

### DicomImage

```tsx
interface DicomImage {
  id: string;
  studyInstanceUID: string;
  seriesInstanceUID: string;
  sopInstanceUID: string;
  imageNumber: number;
  url: string;
  metadata: DicomMetadata;
}
```

### DicomMetadata

```tsx
interface DicomMetadata {
  patientName: string;
  patientId: string;
  studyDate: string;
  studyTime?: string;
  modality: string;
  studyDescription: string;
  seriesDescription: string;
  institutionName?: string;
  physicianName?: string;
  // ... additional DICOM tags
}
```

### Measurements and Annotations

```tsx
interface Measurement {
  id: string;
  type: 'distance' | 'angle' | 'area' | 'ellipse';
  points: Array<{ x: number; y: number }>;
  value: number;
  unit: string;
  label?: string;
  color?: string;
  createdAt: Date;
  createdBy: string;
}

interface Annotation {
  id: string;
  type: 'arrow' | 'text' | 'freehand' | 'rectangle' | 'circle';
  points: Array<{ x: number; y: number }>;
  text?: string;
  color: string;
  strokeWidth: number;
  createdAt: Date;
  createdBy: string;
}
```

## API Integration

### Expected Backend Endpoints

The viewers expect the following API endpoints:

#### Load Images
```
GET /api/dicom/studies/{studyInstanceUID}/images
GET /api/dicom/series/{seriesInstanceUID}/images
```

Response format:
```json
[
  {
    "id": "image1",
    "studyInstanceUID": "1.2.3.4.5",
    "seriesInstanceUID": "1.2.3.4.5.6",
    "sopInstanceUID": "1.2.3.4.5.6.7",
    "imageNumber": 1,
    "url": "https://example.com/dicom/image1.dcm",
    "metadata": {
      "patientName": "John Doe",
      "patientId": "PAT001",
      "studyDate": "20231201",
      "modality": "CT",
      "studyDescription": "Chest CT",
      "seriesDescription": "Axial"
    }
  }
]
```

#### Save Annotations
```
POST /api/dicom/studies/{studyInstanceUID}/annotations
```

Request body:
```json
{
  "measurements": [...],
  "annotations": [...]
}
```

#### Viewing Session Tracking
```
POST /api/imaging/viewing-session
```

Request body:
```json
{
  "studyInstanceUID": "1.2.3.4.5",
  "seriesInstanceUID": "1.2.3.4.5.6",
  "viewDuration": 120000,
  "timestamp": "2023-12-01T10:30:00Z"
}
```

## Integration Examples

### Patient Portal Integration

```tsx
import React from 'react';
import { PatientViewer } from '../PACS/shared/viewers';
import '../PACS/shared/viewers/styles.css';

export const PatientImagingPage: React.FC = () => {
  const studyId = useParams().studyId;
  
  return (
    <div className="patient-imaging-page">
      <PatientViewer
        studyInstanceUID={studyId}
        onViewComplete={() => {
          // Track completion, show feedback
          console.log('Patient completed viewing');
        }}
      />
    </div>
  );
};
```

### Provider Dashboard Integration

```tsx
import React from 'react';
import { ProviderViewer } from '../PACS/shared/viewers';
import '../PACS/shared/viewers/styles.css';

export const ProviderImagingPage: React.FC = () => {
  const { studyId, seriesId } = useParams();
  
  const handleSave = (data) => {
    // Save annotations to backend
    console.log('Saving annotations:', data);
  };
  
  const handleExport = (format) => {
    // Handle export functionality
    console.log('Exporting as:', format);
  };
  
  return (
    <div className="provider-imaging-page">
      <ProviderViewer
        studyInstanceUID={studyId}
        seriesInstanceUID={seriesId}
        onSave={handleSave}
        onExport={handleExport}
      />
    </div>
  );
};
```

## Styling

The components include comprehensive CSS styles in `styles.css`. Key classes:

- `.dicom-viewer` - Base viewer container
- `.provider-viewer` - Provider viewer layout
- `.patient-viewer` - Patient viewer layout
- `.viewer-controls` - Controls panel
- `.metadata-display` - Metadata panel
- `.simple-controls` - Patient overlay controls

### Customization

```css
/* Override default styles */
.custom-viewer .dicom-viewer {
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.custom-viewer .viewer-controls {
  background-color: #f0f4f8;
}
```

## Testing

The components include comprehensive test coverage:

```bash
# Run PACS viewer tests
npm test -- PACS

# Run specific test file
npm test -- DicomViewer.test.tsx
```

Test files:
- `DicomViewer.test.tsx` - Core viewer functionality
- `ProviderViewer.test.tsx` - Provider-specific features
- `PatientViewer.test.tsx` - Patient-specific features
- `MetadataDisplay.test.tsx` - Metadata display functionality

## Browser Support

The viewers are designed to work with modern browsers that support:
- Canvas 2D context
- ES6+ JavaScript
- CSS Grid and Flexbox
- HTML5 file APIs

## Performance Considerations

- Images are loaded asynchronously
- Canvas rendering is optimized for performance
- Large datasets should implement pagination
- Consider using Web Workers for heavy image processing

## Security

- All API calls include authentication headers
- Patient viewers have restricted functionality
- Sensitive metadata can be filtered based on user role
- Audit logging is recommended for all viewing sessions

## Troubleshooting

### Common Issues

1. **Canvas not rendering**: Ensure browser supports Canvas 2D context
2. **Images not loading**: Check API endpoints and authentication
3. **Performance issues**: Implement image caching and pagination
4. **Mobile responsiveness**: Test on various screen sizes

### Debug Mode

Enable debug logging:

```tsx
<DicomViewer
  studyInstanceUID="1.2.3.4.5"
  config={config}
  onError={(error) => {
    console.error('Viewer error:', error);
    // Send to error tracking service
  }}
/>
```