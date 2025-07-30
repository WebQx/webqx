# OpenMRS Integration

This module provides ready-to-deploy integration with OpenMRS (Open Medical Record System), a leading open-source medical record system platform designed for use in developing countries.

## Overview

OpenMRS is a software platform and reference application which enables the design of a customized medical records system with no programming knowledge. This integration provides:

- **REST API Integration** with OpenMRS Web Services
- **FHIR R4 Support** (OpenMRS 3.x and later)
- **Patient Management** for demographics and clinical data
- **Visit and Encounter Management** for clinical workflows
- **Concept Dictionary** access for standardized terminology
- **Location and Provider Management** for organizational structure

## Prerequisites

- OpenMRS 2.3+ (recommended: OpenMRS 3.x for full FHIR support)
- REST Web Services module installed and configured
- FHIR2 module (for FHIR R4 support in OpenMRS 3.x)
- API authentication configured

## Quick Start

### 1. OpenMRS Setup

1. **Install REST Web Services Module**:
   - In OpenMRS administration, go to Manage Modules
   - Install the "REST Web Services" module
   - Configure authentication settings

2. **Configure Authentication**:
   - Create a user account for API access
   - Assign appropriate roles and privileges
   - For OAuth2 (OpenMRS 3.x), configure OAuth2 clients

3. **Enable FHIR (Optional)**:
   - Install FHIR2 module for OpenMRS 3.x
   - Configure FHIR endpoint settings

### 2. Integration Setup

```typescript
import { OpenMRSIntegration } from '../ehr-integrations/openmrs';

const openmrs = new OpenMRSIntegration({
  baseUrl: 'https://your-openmrs-instance.com/openmrs',
  apiVersion: '2.4',
  authentication: {
    type: 'basic', // or 'oauth2' for OpenMRS 3.x
    username: 'your-username',
    password: 'your-password',
    // For OAuth2:
    // clientId: 'your-client-id',
    // clientSecret: 'your-client-secret'
  },
  fhir: {
    enabled: true, // OpenMRS 3.x only
    baseUrl: 'https://your-openmrs-instance.com/openmrs/ws/fhir2/R4'
  }
});

// Initialize the integration
await openmrs.initialize();
```

### 3. Basic Usage

```typescript
// Get patient by UUID
const patient = await openmrs.getPatient('patient-uuid');

// Search patients
const patients = await openmrs.searchPatients({
  q: 'John Smith',
  limit: 10
});

// Create a visit
const visit = await openmrs.createVisit({
  patient: 'patient-uuid',
  visitType: 'visit-type-uuid',
  location: 'location-uuid',
  startDatetime: '2024-01-15T10:00:00.000Z'
});

// Create an encounter
const encounter = await openmrs.createEncounter({
  patient: 'patient-uuid',
  visit: 'visit-uuid',
  encounterType: 'encounter-type-uuid',
  encounterDatetime: '2024-01-15T10:00:00.000Z'
});
```

## Features

### Patient Management
- Patient registration and updates
- Patient search with flexible criteria
- Patient identifier management
- Demographic data handling

### Clinical Workflows
- Visit management (admission, discharge)
- Encounter creation and management
- Observation recording
- Order management

### System Integration
- Concept dictionary access
- Location and provider data
- User management
- System metadata

### FHIR R4 Support (OpenMRS 3.x)
- Standards-compliant FHIR endpoints
- Patient, Encounter, Observation resources
- FHIR search capabilities

## Configuration

### Environment Variables

```bash
# OpenMRS Instance
OPENMRS_BASE_URL=https://your-openmrs-instance.com/openmrs
OPENMRS_API_VERSION=2.4

# Authentication
OPENMRS_AUTH_TYPE=basic
OPENMRS_USERNAME=your-username
OPENMRS_PASSWORD=your-password

# OAuth2 (OpenMRS 3.x)
OPENMRS_CLIENT_ID=your-client-id
OPENMRS_CLIENT_SECRET=your-client-secret

# FHIR Configuration
OPENMRS_FHIR_ENABLED=true
OPENMRS_FHIR_BASE_URL=https://your-openmrs-instance.com/openmrs/ws/fhir2/R4

# Security
OPENMRS_VERIFY_SSL=true
OPENMRS_TIMEOUT_MS=30000
```

## API Reference

### Patient Operations

```typescript
// Get patient
const patient = await openmrs.getPatient(uuid);

// Search patients
const results = await openmrs.searchPatients({
  q: 'search term',
  identifier: 'patient-id',
  limit: 50,
  startIndex: 0
});

// Create patient
const newPatient = await openmrs.createPatient({
  person: {
    names: [{
      givenName: 'John',
      familyName: 'Doe'
    }],
    gender: 'M',
    birthdate: '1980-01-01'
  },
  identifiers: [{
    identifier: 'MRN-12345',
    identifierType: 'identifier-type-uuid',
    location: 'location-uuid'
  }]
});
```

### Visit and Encounter Management

```typescript
// Create visit
const visit = await openmrs.createVisit({
  patient: 'patient-uuid',
  visitType: 'visit-type-uuid',
  location: 'location-uuid',
  startDatetime: new Date().toISOString()
});

// Create encounter
const encounter = await openmrs.createEncounter({
  patient: 'patient-uuid',
  visit: 'visit-uuid',
  encounterType: 'encounter-type-uuid',
  location: 'location-uuid',
  encounterDatetime: new Date().toISOString(),
  obs: [
    {
      concept: 'concept-uuid',
      value: 'observation-value'
    }
  ]
});
```

### Clinical Data

```typescript
// Record observations
const obs = await openmrs.createObservation({
  person: 'patient-uuid',
  concept: 'concept-uuid',
  value: 120,
  obsDatetime: new Date().toISOString()
});

// Get patient observations
const observations = await openmrs.getPatientObservations('patient-uuid');

// Create order
const order = await openmrs.createOrder({
  patient: 'patient-uuid',
  concept: 'concept-uuid',
  orderer: 'provider-uuid',
  orderType: 'order-type-uuid'
});
```

## OpenMRS Version Compatibility

| OpenMRS Version | REST API | FHIR Support | Authentication | Notes |
|----------------|----------|--------------|----------------|-------|
| 3.x            | ✅ Full  | ✅ R4        | OAuth2 + Basic | Recommended |
| 2.6+           | ✅ Full  | ⚠️ Limited   | Basic Auth     | Stable |
| 2.3-2.5        | ✅ Core  | ❌ None      | Basic Auth     | Legacy |
| < 2.3          | ❌ None  | ❌ None      | N/A            | Not supported |

## Deployment

### Docker Setup

```yaml
version: '3.8'
services:
  webqx:
    build: .
    environment:
      - OPENMRS_BASE_URL=http://openmrs:8080/openmrs
      - OPENMRS_USERNAME=admin
      - OPENMRS_PASSWORD=Admin123
    depends_on:
      - openmrs

  openmrs:
    image: openmrs/openmrs-reference-application-3-gateway:latest
    ports:
      - "8080:8080"
    environment:
      - DB_DATABASE=openmrs
      - DB_HOST=mysql
      - DB_USERNAME=openmrs
      - DB_PASSWORD=openmrs
    depends_on:
      - mysql

  mysql:
    image: mysql:8.0
    environment:
      - MYSQL_DATABASE=openmrs
      - MYSQL_USER=openmrs
      - MYSQL_PASSWORD=openmrs
      - MYSQL_ROOT_PASSWORD=root
```

## Testing

### Integration Tests

```typescript
describe('OpenMRS Integration', () => {
  let openmrs: OpenMRSIntegration;

  beforeEach(async () => {
    openmrs = new OpenMRSIntegration(testConfig);
    await openmrs.initialize();
  });

  test('should authenticate successfully', async () => {
    const status = await openmrs.getStatus();
    expect(status.authenticated).toBe(true);
  });

  test('should get patient data', async () => {
    const patient = await openmrs.getPatient('test-uuid');
    expect(patient.uuid).toBe('test-uuid');
  });
});
```

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Verify username/password or OAuth2 credentials
   - Check user roles and privileges in OpenMRS
   - Ensure REST Web Services module is installed

2. **FHIR Endpoints Not Found**
   - Verify FHIR2 module is installed (OpenMRS 3.x)
   - Check FHIR base URL configuration
   - Ensure proper FHIR module configuration

3. **Permission Denied**
   - Check user privileges in OpenMRS
   - Verify API access is enabled for the user
   - Review role-based access control settings

## Support

- [OpenMRS Documentation](https://wiki.openmrs.org/)
- [REST Web Services Documentation](https://wiki.openmrs.org/display/docs/REST+Web+Services)
- [FHIR2 Module Documentation](https://wiki.openmrs.org/display/projects/FHIR+Module)
- [WebQX Integration Support](https://github.com/WebQx/webqx/discussions)

## License

This OpenMRS integration is licensed under the Apache License 2.0. OpenMRS itself is licensed under MPL 2.0. See respective license files for details.