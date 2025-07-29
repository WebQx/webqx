# WebQX EHR Engine - Robust Modular Healthcare Integration

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE.md)
[![FHIR R4](https://img.shields.io/badge/FHIR-R4%20(4.0.1)-green.svg)](https://hl7.org/fhir/R4/)
[![SMART on FHIR](https://img.shields.io/badge/SMART%20on%20FHIR-OAuth2-orange.svg)](https://smarthealthit.org/)

## Overview

The WebQX EHR Engine is a comprehensive, production-ready electronic health record integration platform designed for seamless interoperability with existing healthcare systems. This directory houses ready-to-deploy integrations with popular open-source EHR (Electronic Health Record) systems. The modular architecture allows for easy addition of new EHR system integrations while maintaining consistency and interoperability.

Built with FHIR R4 compliance, SMART on FHIR OAuth2 security, and real-time data synchronization capabilities.

## 🚀 Key Features

### ✅ FHIR R4 Compliance
- **Complete Resource Support**: Patient, Practitioner, Appointment, Observation, MedicationRequest, DiagnosticReport, and more
- **SMART on FHIR OAuth2**: Secure authorization flows for healthcare applications
- **Bulk Data API**: Efficient data export and synchronization capabilities
- **Terminology Services**: CodeSystem, ValueSet, and ConceptMap support

### 🔗 Multi-EHR Connectivity
- **OpenEMR**: Full-featured electronic health records and medical practice management
- **OpenMRS**: Enterprise electronic medical record system platform  
- **LibreHealth**: Open source health IT tools and systems
- **GNU Health**: Hospital and health information system
- **HospitalRun**: Modern hospital information system for developing world

### 🛡️ Enterprise Security
- **OAuth 2.0 / OpenID Connect**: Industry-standard authentication
- **Role-Based Access Control**: Healthcare-specific permission management
- **Audit Logging**: Comprehensive compliance tracking
- **Data Encryption**: End-to-end encryption for sensitive health data

### ⚡ Real-Time Operations
- **WebSocket Connections**: Live data streaming and notifications
- **Event-Driven Architecture**: Reactive data synchronization
- **Queue Management**: Reliable background processing
- **Auto-Scaling**: Kubernetes-ready deployment architecture

### 🏥 Healthcare-Specific Features
- **HL7 FHIR R4**: Complete implementation with validation
- **Clinical Decision Support**: Rule engine integration
- **Patient Portal Integration**: Secure patient access workflows
- **Provider Workflow**: Clinical documentation and order management

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
├── index.ts                 # Main exports and EHR engine core
├── types/                   # Shared type definitions
├── utils/                   # Common utilities
├── services/                # Generic services (FHIR client, audit logging)
├── connectors/              # EHR-specific connectors
├── demo/                    # Demo applications and examples
├── __tests__/              # Comprehensive test suite
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

### 1. Installation

```bash
npm install @webqx/ehr-integrations
```

### 2. Basic EHR Engine Setup

```typescript
import { EHREngineCore } from './ehr-integrations';

// Initialize the EHR Engine
const ehrEngine = new EHREngineCore({
  defaultEHR: 'openemr',
  fhirBaseUrl: 'https://your-ehr-fhir-endpoint.com',
  enableRealTimeSync: true,
  auditLogging: true
});

// Start the engine
await ehrEngine.initialize();

// Get available EHR systems
const systems = ehrEngine.getAvailableEHRSystems();
console.log('Available EHR systems:', systems);
```

### 3. EHR System Integration

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

### 4. FHIR R4 Integration

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

# Performance
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://user:pass@localhost/webqx
MAX_CONCURRENT_CONNECTIONS=100
```

### Integration Profiles

Each EHR system supports multiple integration profiles:

- **Basic Profile**: Core patient and appointment data
- **Clinical Profile**: Full clinical data including notes, orders, results
- **Administrative Profile**: Billing, insurance, and administrative data
- **FHIR Profile**: Standards-compliant FHIR R4 interface
- **Real-Time Profile**: Live data streaming and notifications

## 🛠️ Development

### Adding a New EHR Integration

1. Create a new directory for the EHR system:

```bash
mkdir ehr-integrations/new-ehr-system
cd ehr-integrations/new-ehr-system
```

2. Copy the template structure:

```bash
cp -r ../openemr/template/* ./
```

3. Implement the required interfaces:

```typescript
// Implement BaseEHRConnector
export class NewEHRConnector extends BaseEHRConnector {
  async initialize(): Promise<void> {
    // Implementation
  }
  
  async getPatient(id: string): Promise<Patient> {
    // Implementation
  }
  
  // ... other required methods
}
```

4. Update the main index to include your integration:

```typescript
// ehr-integrations/index.ts
import { NewEHRConnector } from './new-ehr-system';

export const EHR_SYSTEMS = {
  // ... existing systems
  'new-ehr-system': NewEHRConnector
};
```

### Testing

Run the test suite for EHR integrations:

```bash
npm test ehr-integrations
```

Create integration-specific tests:

```typescript
describe('NewEHRConnector', () => {
  it('should connect to the EHR system', async () => {
    const connector = new NewEHRConnector(mockConfig);
    await expect(connector.initialize()).resolves.not.toThrow();
  });
});
```

## Common Integration Patterns

### Authentication Flow

```typescript
// OAuth2 flow example
const ehrConnector = new OpenEMRConnector({
  clientId: process.env.EHR_CLIENT_ID,
  clientSecret: process.env.EHR_CLIENT_SECRET,
  baseUrl: process.env.EHR_BASE_URL
});

// 1. Get authorization URL
const authUrl = await ehrConnector.getAuthorizationUrl();

// 2. Redirect user to authorization URL
// 3. Handle callback with authorization code
const tokens = await ehrConnector.exchangeCodeForTokens(code);

// 4. Use tokens for API calls
ehrConnector.setTokens(tokens);
```

### Data Mapping

```typescript
// FHIR to WebQX mapping example
const mapFhirPatientToWebQX = (fhirPatient: FhirPatient): WebQXPatient => {
  return {
    id: fhirPatient.id,
    name: {
      first: fhirPatient.name?.[0]?.given?.[0],
      last: fhirPatient.name?.[0]?.family
    },
    birthDate: fhirPatient.birthDate,
    gender: fhirPatient.gender,
    contact: {
      phone: fhirPatient.telecom?.find(t => t.system === 'phone')?.value,
      email: fhirPatient.telecom?.find(t => t.system === 'email')?.value
    },
    address: mapFhirAddressToWebQX(fhirPatient.address?.[0])
  };
};
```

### Error Handling

```typescript
try {
  const patient = await ehrConnector.getPatient(patientId);
  return patient;
} catch (error) {
  if (error instanceof EHRConnectionError) {
    // Handle connection errors
    logger.error('EHR connection failed', { error: error.message });
    throw new ServiceUnavailableError('EHR system temporarily unavailable');
  } else if (error instanceof EHRAuthError) {
    // Handle authentication errors
    logger.warn('EHR authentication failed', { error: error.message });
    throw new UnauthorizedError('EHR authentication failed');
  } else {
    // Handle unexpected errors
    logger.error('Unexpected EHR error', { error });
    throw error;
  }
}
```

### Audit Logging

```typescript
// Log all EHR interactions for compliance
await auditLogger.log({
  action: 'patient.read',
  userId: currentUser.id,
  patientId: patient.id,
  ehrSystem: 'openemr',
  timestamp: new Date(),
  metadata: { /* additional context */ }
});
```

## 🚀 Deployment

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Health Checks

```typescript
// Health check endpoint
app.get('/health/ehr-integrations', async (req, res) => {
  try {
    const healthStatus = await ehrEngine.getHealthStatus();
    res.json({
      status: 'healthy',
      ehrSystems: healthStatus.ehrSystems,
      fhirEndpoints: healthStatus.fhirEndpoints,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webqx-ehr-engine
spec:
  replicas: 3
  selector:
    matchLabels:
      app: webqx-ehr-engine
  template:
    metadata:
      labels:
        app: webqx-ehr-engine
    spec:
      containers:
      - name: ehr-engine
        image: webqx/ehr-engine:latest
        ports:
        - containerPort: 3000
        env:
        - name: EHR_SYSTEM
          value: "openemr"
        - name: FHIR_BASE_URL
          valueFrom:
            secretKeyRef:
              name: ehr-config
              key: fhir-base-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health/ehr-integrations
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ehr-integrations
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: webqx-ehr-engine-service
spec:
  selector:
    app: webqx-ehr-engine
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP
```

### Environment Configuration

```yaml
# docker-compose.yml
version: '3.8'
services:
  ehr-engine:
    build: .
    ports:
      - "3000:3000"
    environment:
      - EHR_SYSTEM=openemr
      - FHIR_BASE_URL=https://demo.openemr.io/fhir
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://postgres:password@db:5432/webqx
    depends_on:
      - redis
      - db
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: webqx
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## 📊 Monitoring & Analytics

### Performance Metrics

```typescript
// Integration performance tracking
const metrics = await ehrEngine.getMetrics();
console.log({
  totalRequests: metrics.totalRequests,
  averageResponseTime: metrics.averageResponseTime,
  errorRate: metrics.errorRate,
  ehrSystemStatus: metrics.ehrSystemStatus,
  fhirComplianceScore: metrics.fhirComplianceScore
});
```

### Real-Time Monitoring

```typescript
// Set up monitoring dashboard
ehrEngine.on('request', (event) => {
  console.log(`EHR request: ${event.method} ${event.url}`);
});

ehrEngine.on('error', (error) => {
  console.error('EHR integration error:', error);
});

ehrEngine.on('connection', (status) => {
  console.log('EHR connection status:', status);
});
```

## 🔐 Security & Compliance

### HIPAA Compliance Features

- **Data Encryption**: AES-256 encryption for data at rest and TLS 1.3 for data in transit
- **Access Controls**: Role-based access with healthcare-specific permissions
- **Audit Logging**: Comprehensive logging of all data access and modifications
- **Data Minimization**: Only requested data is retrieved and stored
- **Secure Communication**: All EHR communications use secure protocols

### Security Best Practices

```typescript
// Secure configuration example
const ehrEngine = new EHREngineCore({
  encryption: {
    algorithm: 'aes-256-gcm',
    keyRotationDays: 30
  },
  authentication: {
    requireMFA: true,
    sessionTimeout: 3600000, // 1 hour
    maxFailedAttempts: 3
  },
  compliance: {
    enableHIPAA: true,
    auditRetentionDays: 2555, // 7 years
    dataMinimization: true
  }
});
```

## 📚 Documentation & Resources

### API Documentation
- **Core API**: [https://docs.webqx.health/ehr-engine](https://docs.webqx.health/ehr-engine)
- **FHIR Endpoints**: [https://docs.webqx.health/fhir](https://docs.webqx.health/fhir)
- **EHR Connectors**: [https://docs.webqx.health/connectors](https://docs.webqx.health/connectors)

### Integration Guides
- **OpenEMR**: [./openemr/README.md](./openemr/README.md)
- **OpenMRS**: [./openmrs/README.md](./openmrs/README.md)
- **LibreHealth**: [./librehealth/README.md](./librehealth/README.md)
- **GNU Health**: [./gnuhealth/README.md](./gnuhealth/README.md)
- **HospitalRun**: [./hospitalrun/README.md](./hospitalrun/README.md)

### Community & Support
- **GitHub Issues**: [https://github.com/WebQx/webqx/issues](https://github.com/WebQx/webqx/issues)
- **Community Forum**: [https://community.webqx.health](https://community.webqx.health)
- **Documentation**: [https://docs.webqx.health](https://docs.webqx.health)

## 🏆 Standards Compliance

- ✅ **HL7 FHIR R4** (4.0.1)
- ✅ **SMART on FHIR** 
- ✅ **OAuth 2.0** / **OpenID Connect**
- ✅ **WCAG 2.1 AA** (Accessibility)
- ✅ **HIPAA Ready** (Healthcare compliance)

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE.md](LICENSE.md) file for details.

Individual EHR systems may have their own licensing requirements. Please review each system's documentation before deployment.

---

**Built with ❤️ by the WebQX Health team for the global healthcare community.**