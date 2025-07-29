# WebQX™ Orthanc PACS Integration

A comprehensive PACS integration module that extends Orthanc's capabilities for the WebQX healthcare platform.

## Overview

This module provides specialized plugins to integrate Orthanc with the WebQX ecosystem, offering:

1. **Cloud Storage Integration** - Scalable cloud storage for DICOM files
2. **Custom Indexing and Search** - Advanced metadata indexing and search capabilities
3. **Role-Based Access Control (RBAC)** - Secure access control for DICOM files
4. **Multilingual Support** - Internationalized metadata queries and responses
5. **Scalable Image Viewing** - Enhanced imaging preview capabilities

## Architecture

The module is built as TypeScript services that communicate with Orthanc via REST API, providing:

- Seamless integration with WebQX's existing infrastructure
- Easy testing and maintenance
- Compliance with healthcare data standards
- High performance and scalability

## Services

### Cloud Storage Plugin (`services/cloudStoragePlugin.ts`)
- Supports AWS S3, Azure Blob Storage, and Google Cloud Storage
- Configurable storage bucket paths and retention policies
- Automatic DICOM file archiving and retrieval

### Indexing Plugin (`services/indexingPlugin.ts`)
- Indexes DICOM metadata into PostgreSQL or MongoDB
- Provides advanced search API for metadata queries
- Optimized for fast retrieval and complex filtering

### RBAC Plugin (`services/rbacPlugin.ts`)
- Enforces role-based access control for DICOM files
- Integrates with WebQX's user management system
- Provides fine-grained permission control

### Multilingual Plugin (`services/multilingualPlugin.ts`)
- Supports multilingual metadata queries and responses
- Integrates with WebQX's i18n infrastructure
- Provides translated DICOM metadata

### Image Viewing Plugin (`services/imageViewingPlugin.ts`)
- Generates lightweight, scalable image previews
- Optimizes images for PACS viewers
- Provides caching and performance optimization

## Configuration

Configuration is managed through `config/` directory with environment-specific settings for each plugin.

## Testing

Comprehensive test suites are provided in `__tests__/` directory, covering:
- Unit tests for each service
- Integration tests for Orthanc communication
- Performance and load testing
- Healthcare compliance validation