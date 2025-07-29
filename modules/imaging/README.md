# WebQX™ OHIF Viewer Integration Module

A comprehensive DICOM imaging solution integrating OHIF Viewer with WebQX™ clinical dashboards.

## Overview

This module provides seamless integration of the OHIF (Open Health Imaging Foundation) Viewer into the WebQX™ healthcare platform, enabling:

- **Custom Workflow Integration**: Embedded OHIF Viewer in clinical dashboards
- **Role-Based Access Control**: Secure imaging access based on user roles
- **Multilingual Support**: Localized UI and metadata display
- **Custom Imaging Tools**: Annotations, measurements, and markup tools
- **Performance Optimization**: Efficient loading and caching for large datasets
- **Enhanced APIs**: Seamless interaction with WebQX™ components

## Features

### 1. Custom Workflow Integration
- Embedded OHIF Viewer component for WebQX™ dashboards
- Direct access to imaging studies from patient records
- Specialty-specific imaging workflows

### 2. Role-Based Access Control (RBAC)
- Integration with WebQX™ authentication system
- Fine-grained permissions for imaging access
- Audit logging for compliance

### 3. Multilingual Support
- Localized DICOM metadata display
- Multi-language UI elements
- Synchronized with WebQX™ language settings

### 4. Custom Imaging Tools
- Advanced annotation tools
- Measurement and markup capabilities
- DICOM-compliant image processing

### 5. Performance Optimization
- Progressive image loading
- Intelligent caching mechanisms
- Optimized rendering for large datasets

### 6. API Enhancements
- RESTful APIs for imaging operations
- WebSocket support for real-time updates
- Integration endpoints for clinical workflows

## Directory Structure

```
modules/imaging/
├── ohif/                          # OHIF Viewer integration
│   ├── components/                # React components
│   ├── plugins/                   # Custom OHIF plugins
│   ├── viewers/                   # Viewer configurations
│   └── workflows/                 # Clinical workflow definitions
├── services/                      # Imaging services
│   ├── dicomService.ts           # DICOM operations
│   ├── imagingApi.ts             # API service layer
│   └── performanceService.ts     # Optimization utilities
├── auth/                         # RBAC implementation
├── i18n/                         # Multilingual support
├── types/                        # TypeScript definitions
└── __tests__/                    # Test suite
```

## Getting Started

### Installation

```bash
# Install OHIF dependencies
npm install @ohif/core @ohif/ui @ohif/viewer

# Install imaging-specific dependencies
npm install cornerstone-core cornerstone-tools dicom-parser
```

### Basic Usage

```typescript
import { OHIFViewer } from './ohif/components/OHIFViewer';
import { ImagingWorkflow } from './workflows/ImagingWorkflow';

// Embed OHIF Viewer in dashboard
<OHIFViewer
  studyInstanceUID="1.2.840..."
  userRole="radiologist"
  language="en-US"
  workflow="radiology"
/>
```

## Integration with WebQX™

The OHIF integration leverages existing WebQX™ infrastructure:

- **Authentication**: Uses WebQX™ auth services and JWT tokens
- **Localization**: Integrates with i18next for multilingual support
- **Audit Logging**: Extends WebQX™ audit system for imaging operations
- **APIs**: Follows WebQX™ API patterns and conventions

## Compliance & Security

- DICOM compliance maintained
- HIPAA-ready audit logging
- Secure image transmission (TLS)
- Access control integration
- Data retention policies

## Development

See individual component documentation in respective directories for detailed development guidelines.