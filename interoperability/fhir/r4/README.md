# FHIR R4 Implementation with Telehealth Integration

This directory contains the FHIR R4 (Fast Healthcare Interoperability Resources Release 4) implementation for WebQX™, including comprehensive telehealth session synchronization with OpenEMR.

## Directory Structure

- `resources/` - FHIR R4 resource type definitions and schemas
  - `Patient.ts` - Patient resource definition
  - `Observation.ts` - Observation resource definition
  - `Encounter.ts` - Encounter resource for telehealth sessions
  - `Consent.ts` - Consent resource for patient agreements
  - `Communication.ts` - Communication resource for post-visit summaries
  - `DocumentReference.ts` - DocumentReference for ambient documentation
- `services/` - Service implementations for FHIR R4 operations
  - `FHIRR4Service.ts` - Core FHIR R4 service
- `adapters/` - Integration adapters
  - `TelehealthSessionAdapter.ts` - OpenEMR telehealth session synchronization
- `examples/` - Sample FHIR R4 resources and usage examples
  - `TelehealthAdapterExamples.ts` - Complete telehealth workflow examples
- `__tests__/` - Comprehensive test coverage
  - `TelehealthSessionAdapter.test.ts` - Adapter functionality tests
  - `FHIRResources.test.ts` - Resource validation tests

## Key Features

- ✅ **Full FHIR R4 compliance** with HL7 standards
- ✅ **OpenEMR Integration** for seamless EHR synchronization
- ✅ **Telehealth Session Mapping** to FHIR Encounter resources
- ✅ **Patient Consent Management** using FHIR Consent resources
- ✅ **Post-Visit Communications** via FHIR Communication resources
- ✅ **Ambient Documentation** through Whisper AI integration
- ✅ **PHI Protection** with automatic redaction
- ✅ **Comprehensive Audit Logging** for compliance
- ✅ **Robust Error Handling** and recovery
- ✅ **Extensive Test Coverage** with Jest

## Telehealth Session FHIR Adapter

The centerpiece of this implementation is the `TelehealthSessionFHIRAdapter` which provides:

### 1. Session Metadata → FHIR Encounter
Maps telehealth session metadata to FHIR `Encounter` resources:
- Virtual encounter classification
- Session timing and duration
- Technical context and quality metrics
- Provider and patient references

### 2. Patient Agreement → FHIR Consent  
Represents patient consent using FHIR `Consent` resources:
- Recording consent preferences
- Data sharing agreements
- Platform usage terms
- Emergency access permissions

### 3. Post-Visit Summaries → FHIR Communication
Handles post-visit summaries using FHIR `Communication` resources:
- Visit summary with clinical details
- Follow-up instructions
- Medication information
- Emergency contact details

### 4. Ambient Documentation → FHIR DocumentReference
Integrates Whisper AI transcription as FHIR `DocumentReference` resources:
- AI-powered ambient documentation
- Automatic PHI redaction
- Medical terminology correction
- Structured clinical narratives

## Quick Start

```typescript
import { TelehealthSessionFHIRAdapter } from './adapters/TelehealthSessionAdapter';

// Configure the adapter
const config = {
  openemr: {
    baseUrl: 'https://your-openemr.domain.com',
    oauth: { /* OAuth config */ },
    fhir: { enabled: true }
  },
  fhir: {
    baseUrl: 'https://your-fhir-server.com',
    authentication: { type: 'bearer', token: 'your-token' }
  },
  features: {
    enableConsentManagement: true,
    enableAmbientDocumentation: true,
    enablePostVisitSummary: true
  }
};

// Initialize and use
const adapter = new TelehealthSessionFHIRAdapter(config);
await adapter.initialize();

// Map session to FHIR Encounter
const encounterResult = await adapter.mapSessionToEncounter(sessionMetadata);

// Record patient consent
const consentResult = await adapter.mapPatientConsentToFHIR(patientConsent);

// Create post-visit summary
const summaryResult = await adapter.createPostVisitSummary(
  sessionId, patientId, providerId, summaryPayload
);

// Process ambient documentation
const ambientResult = await adapter.processAmbientDocumentation(
  sessionId, patientId, providerId, audioFile
);
```

## Testing

Run the comprehensive test suite:

```bash
# Run all FHIR R4 tests
npm test -- --testPathPatterns="interoperability/fhir/r4/__tests__"

# Run specific test files
npm test -- interoperability/fhir/r4/__tests__/TelehealthSessionAdapter.test.ts
npm test -- interoperability/fhir/r4/__tests__/FHIRResources.test.ts
```

## Examples

See `examples/TelehealthAdapterExamples.ts` for complete usage examples including:
- Complete telehealth workflow
- Emergency telehealth sessions  
- Batch processing multiple sessions
- Error handling scenarios

## Integration Requirements

### OpenEMR
- Version 7.0.2 or higher
- FHIR R4 endpoints enabled
- OAuth2 authentication configured
- Patient and Practitioner resources available

### FHIR Server
- FHIR R4 compliant server
- Support for Encounter, Consent, Communication, DocumentReference resources
- Authentication (Bearer token, Basic auth, or OAuth2)

### Whisper AI
- OpenAI Whisper service integration
- Audio file processing capabilities
- Medical terminology optimization

## Compliance & Security

- **FHIR R4 Compliance**: Full adherence to HL7 FHIR R4 specifications
- **HIPAA Compliance**: PHI protection and comprehensive audit logging
- **Data Encryption**: All transmissions encrypted in transit
- **Consent Management**: Granular patient consent tracking
- **Audit Trail**: Complete audit logging for all operations

For detailed documentation, see the full README in this directory.