# OpenEMR Integration

This module provides ready-to-deploy integration with OpenEMR, a full-featured electronic health records and medical practice management solution.

## Overview

OpenEMR is one of the most popular open-source EHR systems, used by healthcare organizations worldwide. This integration provides:

- **OAuth2 Authentication** with OpenEMR's REST API
- **FHIR R4 Support** for standards-compliant data exchange
- **Patient Management** for demographics and clinical data
- **Appointment Scheduling** with real-time availability
- **Clinical Data Access** including notes, orders, and results
- **Billing Integration** for practice management

## Prerequisites

- OpenEMR 7.0.0 or higher (recommended for full FHIR support)
- API access enabled in OpenEMR administration
- OAuth2 client registration in OpenEMR

## Quick Start

### 1. OpenEMR Setup

First, configure your OpenEMR instance:

1. **Enable API Access**:
   - Go to Administration → Globals → Connectors
   - Enable "Enable REST API"
   - Enable "Enable FHIR REST API" (for FHIR support)

2. **Register OAuth2 Client**:
   - Go to Administration → System → API Clients
   - Create new client with appropriate scopes
   - Note the Client ID and Client Secret

3. **Configure Scopes**:
   - `openid` - Required for OpenID Connect
   - `fhirUser` - FHIR user identity
   - `patient/Patient.read` - Read patient data
   - `patient/Appointment.read` - Read appointments
   - `patient/Appointment.write` - Create/update appointments

### 2. Integration Setup

```typescript
import { OpenEMRIntegration } from '../ehr-integrations/openemr';

const openemr = new OpenEMRIntegration({
  baseUrl: 'https://your-openemr-instance.com',
  apiVersion: '7.0.2',
  oauth: {
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret',
    redirectUri: 'https://yourapp.com/callback',
    scopes: [
      'openid',
      'fhirUser', 
      'patient/Patient.read',
      'patient/Appointment.read',
      'patient/Appointment.write'
    ]
  },
  fhir: {
    enabled: true,
    baseUrl: 'https://your-openemr-instance.com/apis/default/fhir'
  }
});

// Initialize the integration
await openemr.initialize();
```

### 3. Authentication Flow

```typescript
// 1. Get authorization URL
const authUrl = openemr.getAuthorizationUrl();
window.location.href = authUrl;

// 2. Handle callback
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');
const state = urlParams.get('state');

if (code) {
  const tokens = await openemr.exchangeCodeForTokens(code, state);
  console.log('Authentication successful:', tokens);
}

// 3. Access patient data
const patient = await openemr.getPatient('patient-123');
console.log('Patient data:', patient);
```

## API Reference

### Core Methods

#### Patient Management

```typescript
// Get patient by ID
const patient = await openemr.getPatient('patient-123');

// Search patients
const patients = await openemr.searchPatients({
  family: 'Smith',
  given: 'John',
  birthdate: '1980-01-01'
});

// Update patient
await openemr.updatePatient('patient-123', {
  telecom: [{
    system: 'phone',
    value: '+1-555-0123',
    use: 'home'
  }]
});
```

#### Appointment Management

```typescript
// Get available appointment slots
const slots = await openemr.getAvailableSlots({
  start: '2024-01-15T08:00:00Z',
  end: '2024-01-15T18:00:00Z',
  practitioner: 'practitioner-123'
});

// Book appointment
const appointment = await openemr.bookAppointment({
  patient: 'patient-123',
  practitioner: 'practitioner-123', 
  start: '2024-01-15T10:00:00Z',
  duration: 30,
  serviceType: 'General Consultation',
  reason: 'Annual checkup'
});

// Get patient appointments
const appointments = await openemr.getPatientAppointments('patient-123', {
  from: '2024-01-01',
  to: '2024-12-31'
});
```

#### Clinical Data

```typescript
// Get clinical summary
const summary = await openemr.getClinicalSummary('patient-123');

// Get encounters
const encounters = await openemr.getEncounters('patient-123');

// Get medications
const medications = await openemr.getMedications('patient-123');

// Get lab results
const labResults = await openemr.getLabResults('patient-123');
```

### FHIR R4 Methods

When FHIR is enabled, you can use standard FHIR operations:

```typescript
// FHIR Patient operations
const fhirPatient = await openemr.fhir.getPatient('patient-123');
const patientBundle = await openemr.fhir.searchPatients({
  family: 'Smith',
  birthdate: 'eq1980-01-01'
});

// FHIR Appointment operations
const fhirAppointment = await openemr.fhir.createAppointment({
  resourceType: 'Appointment',
  status: 'booked',
  participant: [
    { actor: { reference: 'Patient/patient-123' } },
    { actor: { reference: 'Practitioner/practitioner-123' } }
  ],
  start: '2024-01-15T10:00:00Z',
  end: '2024-01-15T10:30:00Z'
});
```

## Configuration

### Environment Variables

```bash
# OpenEMR Instance
OPENEMR_BASE_URL=https://your-openemr-instance.com
OPENEMR_API_VERSION=7.0.2

# OAuth2 Configuration
OPENEMR_CLIENT_ID=your-client-id
OPENEMR_CLIENT_SECRET=your-client-secret
OPENEMR_REDIRECT_URI=https://yourapp.com/callback

# FHIR Configuration
OPENEMR_FHIR_ENABLED=true
OPENEMR_FHIR_BASE_URL=https://your-openemr-instance.com/apis/default/fhir

# Security
OPENEMR_VERIFY_SSL=true
OPENEMR_TIMEOUT_MS=30000

# Features
OPENEMR_ENABLE_AUDIT=true
OPENEMR_ENABLE_SYNC=true
OPENEMR_SYNC_INTERVAL_MINUTES=15
```

### Configuration File

```typescript
// config/openemr.config.ts
export const openemrConfig = {
  baseUrl: process.env.OPENEMR_BASE_URL || 'https://localhost',
  apiVersion: process.env.OPENEMR_API_VERSION || '7.0.2',
  oauth: {
    clientId: process.env.OPENEMR_CLIENT_ID!,
    clientSecret: process.env.OPENEMR_CLIENT_SECRET!,
    redirectUri: process.env.OPENEMR_REDIRECT_URI!,
    scopes: [
      'openid',
      'fhirUser',
      'patient/Patient.read',
      'patient/Appointment.read',
      'patient/Appointment.write',
      'patient/Encounter.read',
      'patient/Observation.read'
    ]
  },
  fhir: {
    enabled: process.env.OPENEMR_FHIR_ENABLED === 'true',
    baseUrl: process.env.OPENEMR_FHIR_BASE_URL
  },
  security: {
    verifySSL: process.env.OPENEMR_VERIFY_SSL !== 'false',
    timeout: parseInt(process.env.OPENEMR_TIMEOUT_MS || '30000')
  },
  features: {
    enableAudit: process.env.OPENEMR_ENABLE_AUDIT === 'true',
    enableSync: process.env.OPENEMR_ENABLE_SYNC === 'true',
    syncInterval: parseInt(process.env.OPENEMR_SYNC_INTERVAL_MINUTES || '15')
  }
};
```

## Error Handling

### Common Error Scenarios

```typescript
try {
  const patient = await openemr.getPatient('patient-123');
} catch (error) {
  if (error.code === 'PATIENT_NOT_FOUND') {
    console.log('Patient does not exist');
  } else if (error.code === 'UNAUTHORIZED') {
    // Token expired or invalid
    await openemr.refreshAccessToken();
  } else if (error.code === 'RATE_LIMITED') {
    // Too many requests
    await new Promise(resolve => setTimeout(resolve, 5000));
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Validation Errors

```typescript
// Appointment booking with validation
const result = await openemr.bookAppointment({
  patient: 'patient-123',
  start: '2024-01-15T10:00:00Z',
  // Missing required fields
});

if (!result.success) {
  console.log('Validation errors:', result.errors);
  // Handle validation errors gracefully
}
```

## Testing

### Unit Tests

```typescript
import { OpenEMRIntegration } from '../services/integration';

describe('OpenEMR Integration', () => {
  let openemr: OpenEMRIntegration;

  beforeEach(() => {
    openemr = new OpenEMRIntegration(mockConfig);
  });

  test('should authenticate successfully', async () => {
    const result = await openemr.authenticate('test-code');
    expect(result.accessToken).toBeDefined();
  });

  test('should get patient data', async () => {
    const patient = await openemr.getPatient('patient-123');
    expect(patient.id).toBe('patient-123');
  });
});
```

### Integration Tests

```bash
# Test against OpenEMR demo instance
npm test -- --testNamePattern="OpenEMR Integration"
```

## Deployment

### Docker Compose

```yaml
version: '3.8'
services:
  webqx:
    build: .
    environment:
      - OPENEMR_BASE_URL=https://demo.openemr.io
      - OPENEMR_CLIENT_ID=${OPENEMR_CLIENT_ID}
      - OPENEMR_CLIENT_SECRET=${OPENEMR_CLIENT_SECRET}
      - OPENEMR_FHIR_ENABLED=true
    ports:
      - "3000:3000"
    depends_on:
      - openemr

  openemr:
    image: openemr/openemr:7.0.2
    environment:
      - MYSQL_HOST=mysql
      - MYSQL_ROOT_PASS=root
      - MYSQL_USER=openemr
      - MYSQL_PASS=openemr
      - OE_USER=admin
      - OE_PASS=pass
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - mysql

  mysql:
    image: mariadb:10.6
    environment:
      - MYSQL_ROOT_PASSWORD=root
      - MYSQL_DATABASE=openemr
      - MYSQL_USER=openemr
      - MYSQL_PASSWORD=openemr
```

### Production Considerations

1. **SSL/TLS**: Ensure all communications use HTTPS
2. **Token Storage**: Use secure storage for OAuth tokens
3. **Rate Limiting**: Implement appropriate rate limiting
4. **Monitoring**: Set up health checks and monitoring
5. **Backup**: Regular backup of authentication tokens and configuration

## OpenEMR Version Compatibility

| OpenEMR Version | API Support | FHIR Support | Notes |
|-----------------|-------------|--------------|-------|
| 7.0.0+          | ✅ Full     | ✅ R4        | Recommended |
| 6.1.0+          | ✅ Full     | ⚠️ Limited   | Legacy FHIR |
| 6.0.0+          | ⚠️ Limited  | ❌ None      | REST API only |
| < 6.0.0         | ❌ None     | ❌ None      | Not supported |

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Verify OAuth2 client configuration in OpenEMR
   - Check client ID and secret
   - Ensure redirect URI matches exactly

2. **FHIR Endpoint Not Found**
   - Verify FHIR API is enabled in OpenEMR globals
   - Check FHIR base URL configuration
   - Ensure OpenEMR version supports FHIR

3. **Permission Denied**
   - Verify OAuth2 scopes are properly configured
   - Check user permissions in OpenEMR
   - Ensure API access is enabled for the user

4. **Data Not Syncing**
   - Check network connectivity
   - Verify sync interval configuration
   - Review audit logs for errors

### Debug Mode

```typescript
const openemr = new OpenEMRIntegration({
  ...config,
  debug: true // Enables detailed logging
});
```

## Support

- [OpenEMR Documentation](https://open-emr.org/wiki/index.php/Help_Documentation)
- [OpenEMR FHIR Documentation](https://open-emr.org/wiki/index.php/OpenEMR_Wiki_Home_Page#FHIR)
- [OpenEMR API Documentation](https://open-emr.org/wiki/index.php/OpenEMR_Wiki_Home_Page#API)
- [WebQX Integration Support](https://github.com/WebQx/webqx/discussions)

## License

This OpenEMR integration is licensed under the Apache License 2.0. OpenEMR itself is licensed under GPL. See respective license files for details.