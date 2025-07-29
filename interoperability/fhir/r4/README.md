# FHIR R4 Implementation

This directory contains the FHIR R4 (Fast Healthcare Interoperability Resources Release 4) implementation for WebQX™.

## Directory Structure

- `resources/` - FHIR R4 resource type definitions and schemas
- `services/` - Service implementations for FHIR R4 operations
- `validators/` - Validation utilities for FHIR R4 resources
- `examples/` - Sample FHIR R4 resources and usage examples

## Key Features

- Full FHIR R4 compliance
- Resource validation
- Search capabilities
- Batch operations
- SMART on FHIR support

## Usage

```typescript
import { PatientResource } from './resources/Patient';
import { FHIRR4Service } from './services/FHIRR4Service';

const service = new FHIRR4Service();
const patient = await service.getPatient('patient-id');
```

See the main interoperability README for more details.