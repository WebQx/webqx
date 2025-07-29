# Modules Directory

This directory contains all specialty modules and specialized functionality for the WebQx EHR system.

## Overview

The modules directory houses medical specialty-specific implementations, transcription services, and specialized clinical tools that extend the core EHR functionality.

## Directory Structure

### Specialty Modules
- **specialty-primary-care/** - General practice and family medicine
- **specialty-radiology/** - Medical imaging and radiology services
- **specialty-cardiology/** - Cardiovascular medicine and procedures
- **specialty-oncology/** - Cancer care and treatment protocols
- **specialty-neurology/** - Neurological conditions and treatments
- **specialty-pulmonology/** - Respiratory medicine and pulmonary care
- **specialty-pediatrics/** - Pediatric medicine and child healthcare
- **specialty-psychiatry/** - Mental health and psychiatric services
- **specialty-endocrinology/** - Hormone and metabolic disorders
- **specialty-orthopedics/** - Musculoskeletal system and surgery
- **specialty-gastroenterology/** - Digestive system disorders
- **specialty-dermatology/** - Skin conditions and dermatologic care
- **specialty-obgyn/** - Obstetrics and gynecology services

### Specialized Services
- **transcription/** - Medical transcription and voice recognition
- **postdicom/** - DICOM imaging and PACS integration

## Module Standards

All specialty modules follow these standards:

### Structure
- **services/** - Core business logic and APIs
- **types/** - TypeScript interfaces and data models
- **components/** - UI components specific to the specialty
- **__tests__/** - Unit and integration tests
- **README.md** - Module documentation and setup instructions

### Features
- **Clinical Workflows** - Specialty-specific patient care workflows
- **Templates** - Documentation templates and forms
- **Decision Support** - Clinical guidelines and alerts
- **Reporting** - Specialty-specific reports and analytics
- **Integration** - External system and device integrations

## Getting Started

1. Choose the appropriate specialty module for your use case
2. Review the module's README.md for specific setup instructions
3. Configure specialty-specific settings and integrations
4. Test the module with sample data
5. Train users on specialty-specific workflows

## Development Guidelines

- Each module should be self-contained and independently deployable
- Use shared core services for common functionality
- Follow healthcare interoperability standards (HL7 FHIR, DICOM)
- Implement comprehensive testing and documentation
- Ensure compliance with medical specialty requirements