# FHIR R4 Integration with Real-time Appointment Booking

This document describes the comprehensive FHIR R4 integration system implemented in WebQX™, including real-time appointment booking capabilities and SMART on FHIR OAuth2 security.

## Overview

The FHIR R4 integration provides:

- **Full FHIR R4 Compliance**: Complete implementation of HL7 FHIR R4 specification
- **SMART on FHIR OAuth2**: Secure authentication and authorization 
- **Real-time Appointment Booking**: Interactive appointment scheduling with live availability
- **WebSocket/Polling Updates**: Real-time status updates and notifications
- **Comprehensive Validation**: Input validation and error handling
- **Accessibility Support**: WCAG 2.1 AA compliant components

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 Patient Portal UI                       │
├─────────────────────────────────────────────────────────┤
│          AppointmentBookingComponent                    │
├─────────────────────────────────────────────────────────┤
│         AppointmentBookingService                       │
├─────────────────────────────────────────────────────────┤
│              FHIRR4Client                              │
├─────────────────────────────────────────────────────────┤
│         SMART on FHIR OAuth2 Layer                     │
├─────────────────────────────────────────────────────────┤
│              FHIR R4 Server                            │
└─────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Basic Setup

```typescript
import { 
  createFHIRClient, 
  createBookingService, 
  createSMARTConfig,
  SMART_SCOPES 
} from './ehr-integrations';

// Create SMART on FHIR configuration
const smartConfig = createSMARTConfig(
  'https://fhir.hospital.com',
  'your-client-id',
  'https://yourapp.com/callback',
  [
    SMART_SCOPES.PATIENT_READ,
    SMART_SCOPES.PATIENT_APPOINTMENT_READ,
    SMART_SCOPES.PATIENT_APPOINTMENT_WRITE
  ]
);

// Create FHIR client
const fhirClient = createFHIRClient(
  'https://fhir.hospital.com',
  smartConfig
);

// Create booking service
const bookingService = createBookingService({
  baseUrl: 'https://fhir.hospital.com',
  smartConfig
});
```

### 2. Authentication Flow

```typescript
// 1. Get authorization URL
const authUrl = fhirClient.getAuthorizationUrl();
window.location.href = authUrl;

// 2. Handle callback (in your callback handler)
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');
const state = urlParams.get('state');

if (code) {
  const tokenResponse = await fhirClient.exchangeCodeForToken(code, state);
  console.log('Authentication successful:', tokenResponse);
}
```

### 3. Booking an Appointment

```typescript
// Initialize the service
await bookingService.initialize();

// Get available slots
const availableSlots = await bookingService.getAvailableSlots(
  '2024-01-15T08:00:00Z', // Start time
  '2024-01-15T18:00:00Z', // End time
  'General Consultation',  // Service type (optional)
  'Practitioner/123'      // Practitioner ID (optional)
);

// Book appointment
const bookingRequest = {
  patient: { reference: 'Patient/patient-123' },
  startTime: '2024-01-15T10:00:00Z',
  durationMinutes: 30,
  serviceType: { text: 'General Consultation' },
  reasonCode: [{ text: 'Annual checkup' }]
};

const result = await bookingService.bookAppointment(bookingRequest);

if (result.success) {
  console.log('Appointment booked:', result.appointment);
  console.log('Confirmation:', result.confirmation);
} else {
  console.error('Booking failed:', result.error);
  if (result.alternatives) {
    console.log('Alternative times:', result.alternatives);
  }
}
```

## React Component Usage

### AppointmentBookingComponent

```tsx
import React from 'react';
import { AppointmentBookingComponent } from './patient-portal/components/AppointmentBookingComponent';

function MyApp() {
  const config = {
    fhirConfig: {
      baseUrl: 'https://fhir.hospital.com',
      smartConfig: {
        fhirBaseUrl: 'https://fhir.hospital.com',
        clientId: 'your-client-id',
        redirectUri: 'https://yourapp.com/callback',
        scopes: ['patient/Appointment.read', 'patient/Appointment.write']
      }
    },
    realTimeConfig: {
      enableWebSocket: true,
      pollingInterval: 30000
    }
  };

  const serviceTypes = [
    { text: 'General Consultation' },
    { text: 'Follow-up Visit' },
    { text: 'Preventive Care' }
  ];

  const practitioners = [
    { id: 'prac-1', name: 'Dr. Sarah Johnson', specialty: 'Family Medicine' },
    { id: 'prac-2', name: 'Dr. Michael Chen', specialty: 'Internal Medicine' }
  ];

  return (
    <AppointmentBookingComponent
      config={config}
      serviceTypes={serviceTypes}
      practitioners={practitioners}
      onAppointmentBooked={(appointment) => {
        console.log('Appointment booked:', appointment);
      }}
      onBookingError={(error) => {
        console.error('Booking error:', error);
      }}
      theme={{
        primaryColor: '#3b82f6',
        successColor: '#10b981',
        errorColor: '#ef4444'
      }}
    />
  );
}
```

### Enhanced AppointmentCard

```tsx
import React from 'react';
import { AppointmentCard } from './patient-portal/components/AppointmentCard';

function AppointmentList({ appointments }) {
  return (
    <div className="appointment-list">
      {appointments.map(appointment => (
        <AppointmentCard
          key={appointment.id}
          appointment={appointment}
          interactive={true}
          showRealTimeStatus={true}
          onCancel={async (id) => {
            await bookingService.cancelAppointment(id, 'Patient request');
          }}
          onReschedule={async (id) => {
            // Handle rescheduling logic
          }}
          onViewDetails={(appointment) => {
            // Show appointment details modal
          }}
        />
      ))}
    </div>
  );
}
```

## Real-time Updates

### WebSocket Events

```typescript
// Listen for real-time updates
bookingService.addEventListener('appointment_created', (event) => {
  console.log('New appointment created:', event.resource);
});

bookingService.addEventListener('slot_updated', (event) => {
  console.log('Slot availability changed:', event.resource);
  // Refresh available slots
});

bookingService.addEventListener('appointment_cancelled', (event) => {
  console.log('Appointment cancelled:', event.resource);
  // Update UI
});
```

### Polling Fallback

If WebSocket is not available, the system automatically falls back to polling:

```typescript
const config = {
  fhirConfig: { /* ... */ },
  realTimeConfig: {
    enableWebSocket: false, // Disable WebSocket
    pollingInterval: 30000, // Poll every 30 seconds
    maxPollingDuration: 300000 // Stop polling after 5 minutes
  }
};
```

## FHIR R4 Resources

### Supported Resources

- **Patient**: Patient demographic and contact information
- **Practitioner**: Healthcare provider information
- **Organization**: Healthcare organization details
- **Appointment**: Appointment scheduling and management
- **Schedule**: Provider availability schedules
- **Slot**: Individual time slots for booking
- **Bundle**: Collections of resources for batch operations

### Example: Creating a Patient

```typescript
const patient: FHIRPatient = {
  resourceType: 'Patient',
  identifier: [{
    system: 'http://hospital.com/mrn',
    value: 'MRN123456'
  }],
  name: [{
    use: 'official',
    family: 'Doe',
    given: ['John', 'Michael']
  }],
  gender: 'male',
  birthDate: '1980-01-01',
  telecom: [{
    system: 'phone',
    value: '+1-555-0123',
    use: 'home'
  }],
  address: [{
    use: 'home',
    line: ['123 Main St'],
    city: 'Anytown',
    state: 'CA',
    postalCode: '12345',
    country: 'US'
  }]
};
```

### Example: Searching for Appointments

```typescript
const searchParams = {
  patient: 'Patient/patient-123',
  date: 'ge2024-01-01', // Appointments on or after Jan 1, 2024
  status: ['booked', 'arrived'],
  _sort: 'date',
  _count: 50
};

const response = await fhirClient.searchAppointments(searchParams);

if (response.success && response.data?.entry) {
  const appointments = response.data.entry
    .map(entry => entry.resource as FHIRAppointment)
    .filter(apt => apt.resourceType === 'Appointment');
  
  console.log('Found appointments:', appointments);
}
```

## Error Handling

### Validation Errors

```typescript
const result = await bookingService.bookAppointment({
  patient: undefined, // Missing required field
  startTime: '',      // Invalid time
  durationMinutes: 0  // Invalid duration
});

if (!result.success) {
  console.log('Validation error:', result.error);
  // Error: { code: 'VALIDATION_ERROR', message: 'Patient is required' }
}
```

### FHIR Operation Outcomes

```typescript
const response = await fhirClient.getPatient('nonexistent-id');

if (!response.success && response.outcome) {
  response.outcome.issue.forEach(issue => {
    console.log(`${issue.severity}: ${issue.diagnostics}`);
  });
}
```

### Network and Authentication Errors

```typescript
try {
  const response = await fhirClient.searchAppointments({});
} catch (error) {
  if (error.message.includes('expired')) {
    // Token expired - refresh or re-authenticate
    await fhirClient.refreshAccessToken();
  } else if (error.message.includes('Network')) {
    // Network error - retry with backoff
    console.error('Network error, retrying...');
  }
}
```

## Security Considerations

### SMART on FHIR Scopes

Use the minimum required scopes:

```typescript
// Patient-facing app scopes
const patientScopes = [
  'patient/Patient.read',
  'patient/Appointment.read',
  'patient/Appointment.write',
  'patient/Schedule.read',
  'patient/Slot.read'
];

// Provider-facing app scopes  
const providerScopes = [
  'user/Patient.read',
  'user/Appointment.read',
  'user/Appointment.write',
  'user/Schedule.read',
  'user/Slot.read'
];
```

### Token Management

```typescript
// Check token expiry before requests
if (!fhirClient.isAuthenticated()) {
  // Redirect to authentication
  window.location.href = fhirClient.getAuthorizationUrl();
}

// Automatic token refresh
fhirClient.addEventListener('token_expired', async () => {
  try {
    await fhirClient.refreshAccessToken();
  } catch (error) {
    // Refresh failed - need full re-authentication
    window.location.href = fhirClient.getAuthorizationUrl();
  }
});
```

### Data Protection

- All sensitive data is encrypted in transit (HTTPS/WSS)
- OAuth2 tokens are stored securely
- Patient data access is logged for audit trails
- FHIR Bundle operations are atomic when using transactions

## Testing

### Unit Tests

```typescript
import { FHIRR4Client, AppointmentBookingService } from './ehr-integrations';

describe('FHIR R4 Integration', () => {
  test('should authenticate with SMART on FHIR', async () => {
    const client = new FHIRR4Client({
      baseUrl: 'https://test-fhir.example.com',
      smartConfig: mockSmartConfig
    });

    const tokenResponse = await client.exchangeCodeForToken('test-code');
    expect(tokenResponse.access_token).toBeDefined();
  });

  test('should book appointment successfully', async () => {
    const service = new AppointmentBookingService(mockConfig);
    const result = await service.bookAppointment(validRequest);
    
    expect(result.success).toBe(true);
    expect(result.appointment?.status).toBe('booked');
  });
});
```

### Integration Tests

```typescript
describe('End-to-End Booking Flow', () => {
  test('should complete full booking workflow', async () => {
    // 1. Initialize service
    await bookingService.initialize();
    
    // 2. Authenticate
    const tokenResponse = await bookingService.authenticate(authCode);
    expect(tokenResponse.access_token).toBeDefined();
    
    // 3. Get available slots
    const slots = await bookingService.getAvailableSlots(startDate, endDate);
    expect(slots.length).toBeGreaterThan(0);
    
    // 4. Book appointment
    const result = await bookingService.bookAppointment(request);
    expect(result.success).toBe(true);
    
    // 5. Verify appointment created
    const appointment = await fhirClient.getAppointment(result.appointment.id);
    expect(appointment.success).toBe(true);
  });
});
```

## Performance Optimization

### Caching

```typescript
// Enable client-side caching
const fhirClient = new FHIRR4Client({
  baseUrl: 'https://fhir.hospital.com',
  smartConfig,
  cache: {
    enabled: true,
    ttl: 300000, // 5 minutes
    maxSize: 100 // Maximum cached responses
  }
});
```

### Batch Operations

```typescript
// Use FHIR Bundle for multiple operations
const bundle: FHIRBundle = {
  resourceType: 'Bundle',
  type: 'transaction',
  entry: [
    {
      request: { method: 'POST', url: 'Appointment' },
      resource: appointment1
    },
    {
      request: { method: 'POST', url: 'Appointment' },
      resource: appointment2
    }
  ]
};

const result = await fhirClient.batch({ bundle });
```

### Pagination

```typescript
// Handle large result sets with pagination
const searchParams = {
  patient: 'Patient/123',
  _count: 20,        // Results per page
  _offset: 0         // Starting offset
};

let allAppointments = [];
let hasMore = true;

while (hasMore) {
  const response = await fhirClient.searchAppointments(searchParams);
  if (response.success && response.data?.entry) {
    allAppointments.push(...response.data.entry);
    
    // Check if there are more results
    hasMore = response.data.entry.length === searchParams._count;
    searchParams._offset += searchParams._count;
  } else {
    hasMore = false;
  }
}
```

## Deployment

### Environment Configuration

```bash
# FHIR Server Configuration
FHIR_BASE_URL=https://fhir.hospital.com
FHIR_VERSION=4.0.1

# SMART on FHIR OAuth2
OAUTH2_CLIENT_ID=your-client-id
OAUTH2_CLIENT_SECRET=your-client-secret
OAUTH2_REDIRECT_URI=https://yourapp.com/callback

# Real-time Updates
WEBSOCKET_ENDPOINT=wss://realtime.hospital.com/fhir
POLLING_INTERVAL=30000
ENABLE_WEBSOCKET=true

# Security
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-encryption-key
```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

### Health Checks

```typescript
// FHIR server health check
app.get('/health/fhir', async (req, res) => {
  try {
    const response = await fetch(`${process.env.FHIR_BASE_URL}/metadata`);
    if (response.ok) {
      res.json({ status: 'healthy', fhir: 'connected' });
    } else {
      res.status(503).json({ status: 'unhealthy', fhir: 'disconnected' });
    }
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});
```

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   ```typescript
   // Check SMART capabilities
   const capabilities = await fhirClient.discoverCapabilities();
   console.log('Supported scopes:', capabilities.scopes_supported);
   ```

2. **CORS Issues**
   ```javascript
   // Ensure FHIR server allows your origin
   // Check browser developer tools for CORS errors
   ```

3. **Token Expiry**
   ```typescript
   // Implement automatic token refresh
   fhirClient.on('token_expired', async () => {
     await fhirClient.refreshAccessToken();
   });
   ```

4. **WebSocket Connection Issues**
   ```typescript
   // Fall back to polling if WebSocket fails
   const config = {
     realTimeConfig: {
       enableWebSocket: true,
       pollingInterval: 30000 // Fallback polling
     }
   };
   ```

### Debug Mode

```typescript
// Enable debug logging
const fhirClient = new FHIRR4Client({
  baseUrl: 'https://fhir.hospital.com',
  debug: true // Enables detailed logging
});

// Check network requests in browser developer tools
```

## Standards Compliance

- **HL7 FHIR R4 (4.0.1)**: Full compliance with FHIR R4 specification
- **SMART on FHIR**: Implementation Guide v1.0.0
- **OAuth 2.0**: RFC 6749 compliance
- **OpenID Connect**: Core 1.0 specification
- **WCAG 2.1 AA**: Web accessibility guidelines
- **HIPAA**: Healthcare data protection compliance

## Support and Resources

- [HL7 FHIR R4 Documentation](https://www.hl7.org/fhir/R4/)
- [SMART on FHIR Implementation Guide](https://hl7.org/fhir/smart-app-launch/)
- [OAuth 2.0 Specification](https://tools.ietf.org/html/rfc6749)
- [WebQX Integration Examples](./examples/)
- [API Reference](./api-reference.md)

## License

This implementation is licensed under the Apache License 2.0. See [LICENSE.md](../LICENSE.md) for details.