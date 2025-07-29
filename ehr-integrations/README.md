# EHR Integrations

This directory houses ready-to-deploy integrations with popular open-source EHR (Electronic Health Record) systems. The modular architecture allows for easy addition of new EHR system integrations while maintaining consistency and interoperability.

## Overview

The EHR integrations provide standardized interfaces for connecting WebQX™ with various open-source EHR systems. Each integration implements common patterns for:

- Authentication and authorization
- FHIR R4 compliance where supported
- Data synchronization and mapping
- Audit logging and compliance
- Error handling and validation

## Supported EHR Systems

### Ready-to-Deploy Integrations

- **[OpenEMR](./openemr/)** - Full-featured electronic health records and medical practice management
- **[OpenMRS](./openmrs/)** - Enterprise electronic medical record system platform  
- **[LibreHealth](./librehealth/)** - Open source health IT tools and systems
- **[GNU Health](./gnuhealth/)** - Hospital and health information system
- **[HospitalRun](./hospitalrun/)** - Modern hospital information system for developing world

### Generic Standards Support

- **[FHIR R4](./README-FHIR-R4.md)** - HL7 FHIR R4 specification compliance with SMART on FHIR
- **HL7 Messaging** - Traditional HL7 v2.x message processing
- **OpenEHR** - Archetype-based electronic health records

## Architecture

Each EHR integration follows a consistent modular structure:

```
ehr-integrations/
├── README.md                 # This file
├── README-FHIR-R4.md        # FHIR R4 specific documentation
├── index.ts                 # Main exports
├── types/                   # Shared type definitions
├── utils/                   # Common utilities
├── services/                # Generic services
├── components/              # React components
├── __tests__/              # Tests
└── {ehr-system}/           # Specific EHR integrations
    ├── README.md           # Setup and usage guide
    ├── index.ts            # EHR-specific exports
    ├── services/           # Integration services
    ├── types/              # EHR-specific types
    ├── utils/              # Helper functions
    ├── config/             # Configuration templates
    └── examples/           # Usage examples
```

## Quick Start

### 1. Choose Your EHR System

Select the EHR system you want to integrate with and follow its specific setup guide:

```bash
# Example: OpenEMR integration
cd ehr-integrations/openemr
cat README.md
```

### 2. Basic Integration Setup

```typescript
import { createEHRIntegration } from './ehr-integrations';

// Example: OpenEMR integration
const ehrIntegration = createEHRIntegration('openemr', {
  baseUrl: 'https://your-openemr-instance.com',
  credentials: {
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret'
  },
  apiVersion: '7.0.2'
});

// Initialize connection
await ehrIntegration.initialize();

// Test connection
const status = await ehrIntegration.getStatus();
console.log('EHR Status:', status);
```

### 3. FHIR R4 Integration

For EHR systems supporting FHIR R4:

```typescript
import { FHIRR4Client } from './ehr-integrations';

const fhirClient = new FHIRR4Client({
  baseUrl: 'https://your-ehr-fhir-endpoint.com',
  smartConfig: {
    fhirBaseUrl: 'https://your-ehr-fhir-endpoint.com',
    clientId: 'your-fhir-client-id',
    redirectUri: 'https://yourapp.com/callback',
    scopes: ['patient/Patient.read', 'patient/Appointment.read']
  }
});
```

## Configuration

### Environment Variables

```bash
# General EHR configuration
EHR_SYSTEM=openemr
EHR_BASE_URL=https://your-ehr-instance.com
EHR_API_VERSION=latest

# Authentication
EHR_CLIENT_ID=your-client-id
EHR_CLIENT_SECRET=your-client-secret
EHR_OAUTH_REDIRECT_URI=https://yourapp.com/callback

# FHIR Configuration (if supported)
FHIR_BASE_URL=https://your-ehr-fhir-endpoint.com
FHIR_VERSION=4.0.1

# Security and Compliance
ENABLE_AUDIT_LOGGING=true
ENCRYPTION_KEY=your-encryption-key
HIPAA_COMPLIANCE_MODE=true

# Data Sync Settings
SYNC_INTERVAL_MINUTES=15
MAX_CONCURRENT_SYNCS=3
ENABLE_REAL_TIME_SYNC=true
```

### Integration Profiles

Each EHR system supports multiple integration profiles:

- **Basic Profile**: Core patient and appointment data
- **Clinical Profile**: Full clinical data including notes, orders, results
- **Administrative Profile**: Billing, insurance, and administrative data
- **FHIR Profile**: Standards-compliant FHIR R4 interface

## Development

### Adding a New EHR Integration

1. **Create directory structure**:
```bash
mkdir ehr-integrations/new-ehr-system
cd ehr-integrations/new-ehr-system
mkdir services types utils config examples
```

2. **Implement core interfaces**:
```typescript
// services/integration.ts
export class NewEHRIntegration implements EHRIntegrationInterface {
  async initialize(): Promise<void> { /* ... */ }
  async authenticate(): Promise<AuthResult> { /* ... */ }
  async getPatient(id: string): Promise<Patient> { /* ... */ }
  // ... implement other required methods
}
```

3. **Add to main exports**:
```typescript
// ehr-integrations/index.ts
export * from './new-ehr-system';
```

### Testing

Run tests for all integrations:

```bash
npm test -- ehr-integrations/
```

Run tests for specific EHR system:

```bash
npm test -- ehr-integrations/openemr/
```

### Type Safety

All integrations are built with TypeScript for type safety:

```typescript
import type { 
  EHRIntegrationConfig,
  PatientData,
  AppointmentData 
} from './types';
```

## Security and Compliance

### Data Protection

- All data transmission uses TLS 1.3 encryption
- OAuth2/OpenID Connect for secure authentication
- Role-based access control (RBAC)
- Audit logging for all operations
- HIPAA-compliant data handling

### Authentication Methods

Each EHR system supports appropriate authentication:

- **OAuth2/OpenID Connect** (preferred)
- **API Keys** (when OAuth not available)
- **SAML 2.0** (enterprise deployments)
- **Certificate-based** authentication

### Audit and Compliance

```typescript
// Automatic audit logging
await ehrIntegration.auditLog({
  action: 'patient_data_access',
  resourceId: 'patient-123',
  userId: 'provider-456',
  timestamp: new Date(),
  metadata: { /* additional context */ }
});
```

## Deployment

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --production

COPY ehr-integrations/ ./ehr-integrations/
COPY . .

EXPOSE 3000
CMD ["npm", "start"]
```

### Health Checks

```typescript
// Health check endpoint
app.get('/health/ehr', async (req, res) => {
  const status = await ehrIntegration.getStatus();
  if (status.healthy) {
    res.json({ status: 'healthy', ehr: status });
  } else {
    res.status(503).json({ status: 'unhealthy', ehr: status });
  }
});
```

## Support

### Documentation

- [OpenEMR Integration Guide](./openemr/README.md)
- [OpenMRS Integration Guide](./openmrs/README.md)
- [LibreHealth Integration Guide](./librehealth/README.md)
- [GNU Health Integration Guide](./gnuhealth/README.md)
- [HospitalRun Integration Guide](./hospitalrun/README.md)
- [FHIR R4 Integration Guide](./README-FHIR-R4.md)

### Community

- [WebQX GitHub Discussions](https://github.com/WebQx/webqx/discussions)
- [EHR Integration Examples](./examples/)
- [API Reference Documentation](../docs/api-reference.md)

### Getting Help

1. Check the specific EHR system documentation
2. Review the examples directory
3. Search existing GitHub issues
4. Create a new issue with detailed information

## License

This integration framework is licensed under the Apache License 2.0. See [LICENSE.md](../LICENSE.md) for details.

Individual EHR systems may have their own licensing requirements. Please review each system's documentation before deployment.

---

**Built with ❤️ by the WebQX team**  
*"Interoperability through modular design"*