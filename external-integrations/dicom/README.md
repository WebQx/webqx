# DICOM Integration Module

This module provides DICOM (Digital Imaging and Communications in Medicine) integration for medical imaging within the WebQx EHR system.

## Purpose

Enables seamless integration with medical imaging systems, providing DICOM communication, image storage, and viewing capabilities for radiology and other imaging departments.

## Features

- **DICOM Communication** - C-STORE, C-FIND, C-MOVE, and C-GET operations
- **Image Storage** - DICOM file management and archival
- **Metadata Extraction** - DICOM tag parsing and indexing
- **Image Conversion** - Format conversion and compression
- **Quality Assurance** - Image validation and integrity checking
- **Anonymization** - PHI removal and de-identification

## Initial Setup

1. Configure DICOM network settings (AE titles, ports, hosts)
2. Set up image storage directories and backup policies
3. Configure modality worklist integration
4. Set up image viewing and display protocols
5. Implement anonymization and privacy controls
6. Test connectivity with imaging modalities and PACS

## Supported DICOM Services

- **Storage** - Image and document storage (C-STORE)
- **Query/Retrieve** - Patient and study searches (C-FIND, C-MOVE)
- **Worklist** - Modality worklist management (C-FIND)
- **Print** - DICOM printing services (N-ACTION)
- **Storage Commitment** - Image storage verification (N-ACTION)

## Imaging Modalities

- **CT** - Computed Tomography
- **MR** - Magnetic Resonance
- **CR/DX** - Computed/Digital Radiography
- **US** - Ultrasound
- **NM** - Nuclear Medicine
- **PET** - Positron Emission Tomography
- **MG** - Mammography
- **XA** - X-Ray Angiography

## Configuration

```javascript
// Example DICOM configuration
const dicomConfig = {
  applicationEntity: {
    title: 'WEBQX_SCP',
    port: 11112,
    host: '0.0.0.0'
  },
  storage: {
    path: '/var/dicom/storage',
    compression: 'jpeg2000',
    backup: true
  },
  anonymization: {
    enabled: true,
    keepPatientId: false,
    replaceStudyDate: true
  }
};
```

## Standards Compliance

Fully compliant with DICOM 3.0 standard and IHE imaging profiles including XDS-I and PIX.