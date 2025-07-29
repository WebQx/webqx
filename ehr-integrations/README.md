# WebQX EHR Engine - Robust Modular Healthcare Integration

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE.md)
[![FHIR R4](https://img.shields.io/badge/FHIR-R4%20(4.0.1)-green.svg)](https://hl7.org/fhir/R4/)
[![SMART on FHIR](https://img.shields.io/badge/SMART%20on%20FHIR-OAuth2-orange.svg)](https://smarthealthit.org/)

## Overview

The WebQX EHR Engine is a comprehensive, production-ready electronic health record integration platform designed for seamless interoperability with existing healthcare systems. Built with FHIR R4 compliance, SMART on FHIR OAuth2 security, and real-time data synchronization capabilities.

## 🚀 Key Features

### ✅ FHIR R4 Compliance
- **Complete Resource Support**: Patient, Practitioner, Appointment, Observation, MedicationRequest, DiagnosticReport, and more
- **Standards Compliance**: Full HL7 FHIR R4 (4.0.1) implementation
- **Resource Validation**: Built-in validation and type safety
- **Batch Operations**: Support for FHIR bundles and transactions

### 🔐 SMART on FHIR OAuth2
- **Secure Authentication**: OAuth2 with PKCE for client applications
- **Scope Management**: Granular permission control (patient/*.read, patient/*.write, etc.)
- **Launch Contexts**: Support for EHR launch and standalone launch scenarios
- **Token Management**: Automatic token refresh and secure storage

### 📡 Real-Time Data Synchronization
- **WebSocket Primary**: Low-latency real-time updates via WebSockets
- **Polling Fallback**: Automatic fallback to polling for compatibility
- **Event Filtering**: Subscription-based event filtering by patient, resource type, or EHR system
- **Reconnection Logic**: Automatic reconnection with exponential backoff

### 🔌 External EHR System Integration
- **OpenEMR Connector**: Full OAuth2 authentication and CRUD operations
- **OpenMRS Connector**: Session-based authentication with comprehensive data mapping
- **Standardized Interface**: Extensible connector architecture for additional EHR systems
- **Data Synchronization**: Bidirectional sync with conflict resolution

### 🧩 Modular Architecture
- **Specialty Modules**: Plugin system for radiology, cardiology, oncology, and more
- **Configuration-Driven**: Environment-specific configurations (dev/staging/prod)
- **Scalable Design**: Horizontal scaling support with load balancing
- **Event-Driven**: Comprehensive event system for integration points

### 🛡️ Security & Compliance
- **Data Encryption**: Sensitive data encryption at rest and in transit
- **Audit Logging**: Comprehensive audit trails for all operations
- **Access Control**: Role-based access control (RBAC) support
- **HIPAA Ready**: Built with healthcare compliance requirements in mind

## 📦 Installation

```bash
npm install webqx-healthcare-platform
```

## 🏃‍♂️ Quick Start

```typescript
import { createEHREngine, EHREngineConfig } from 'webqx-healthcare-platform/ehr-integrations';

// Configure the EHR Engine
const config: EHREngineConfig = {
  fhirConfig: {
    baseUrl: 'https://your-fhir-server.com/fhir',
    smartConfig: {
      fhirBaseUrl: 'https://your-fhir-server.com/fhir',
      clientId: 'your-client-id',
      redirectUri: 'https://your-app.com/callback',
      scopes: ['patient/*.read', 'patient/*.write', 'launch']
    }
  },
  realTimeConfig: {
    enableWebSocket: true,
    websocketUrl: 'wss://your-app.com/realtime',
    pollingInterval: 30000
  },
  security: {
    auditLevel: 'comprehensive',
    enableEncryption: true
  }
};

// Initialize and start the engine
const ehrEngine = createEHREngine(config);
await ehrEngine.initialize();

// Create a patient
const patient = {
  resourceType: 'Patient',
  name: [{ use: 'official', family: 'Doe', given: ['John'] }],
  gender: 'male',
  birthDate: '1980-01-01'
};

const result = await ehrEngine.createResource(patient);
console.log('Patient created:', result.data);
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     WebQX EHR Engine Core                      │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   FHIR R4       │  │  Real-Time      │  │   Security &    │  │
│  │   Client        │  │  Updates        │  │   Audit         │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   External      │  │   Specialty     │  │   Appointment   │  │
│  │   Connectors    │  │   Modules       │  │   Booking       │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         ↓                    ↓                    ↓
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│     OpenEMR     │  │    OpenMRS      │  │   Epic/Cerner   │
│   Connector     │  │   Connector     │  │   Connectors    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## 📖 Documentation

- **[Comprehensive Integration Guide](docs/EHR_ENGINE_GUIDE.md)** - Complete documentation (27k+ words)
- **[API Reference](docs/EHR_ENGINE_GUIDE.md#api-reference)** - Detailed API documentation
- **[Configuration Examples](docs/EHR_ENGINE_GUIDE.md#configuration-examples)** - Environment-specific configurations
- **[Troubleshooting Guide](docs/EHR_ENGINE_GUIDE.md#troubleshooting)** - Common issues and solutions

## 🎯 Use Cases

### Healthcare Organizations
- **Multi-EHR Integration**: Connect Epic, Cerner, OpenEMR, and OpenMRS systems
- **Real-Time Monitoring**: Live patient data updates across all systems
- **Specialty Workflows**: Radiology, cardiology, and oncology integrations
- **Compliance Reporting**: Automated audit trails and compliance monitoring

### Healthcare Applications
- **Patient Portals**: Unified view of patient data from multiple sources
- **Clinical Decision Support**: Real-time alerts and recommendations
- **Telehealth Platforms**: Seamless integration with existing EHR workflows
- **Mobile Health Apps**: FHIR-compliant data access with OAuth2 security

### Healthcare Networks
- **HIE Integration**: Health Information Exchange connectivity
- **Care Coordination**: Cross-system patient data sharing
- **Population Health**: Aggregated analytics across multiple EHR systems
- **Quality Reporting**: Automated quality measure reporting

## 🔧 Available Connectors

### OpenEMR Connector
```typescript
import { OpenEMRConnector } from 'webqx-healthcare-platform/ehr-integrations/connectors';

const openEmrConnector = new OpenEMRConnector();
ehrEngine.registerExternalConnector(openEmrConnector);

// Sync patient data
const result = await ehrEngine.syncPatientFromExternal('OpenEMR', 'patient-123');
```

### OpenMRS Connector
```typescript
import { OpenMRSConnector } from 'webqx-healthcare-platform/ehr-integrations/connectors';

const openMrsConnector = new OpenMRSConnector();
ehrEngine.registerExternalConnector(openMrsConnector);

// Sync patient data including programs and visits
const result = await ehrEngine.syncPatientFromExternal('OpenMRS', 'patient-456');
```

## 📡 Real-Time Updates

```typescript
// Subscribe to patient updates
const subscriptionId = ehrEngine.subscribeToRealTimeUpdates(
  ['resource_created', 'resource_updated', 'observation_added'],
  (event) => {
    console.log('Real-time event:', event);
    
    // Handle critical observations
    if (event.type === 'observation_added' && event.data?.critical) {
      alert('Critical observation detected!');
    }
  },
  { 
    patientId: 'patient-123',
    resourceType: 'Observation'
  }
);
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Run EHR engine tests specifically
npm test -- ehr-integrations/__tests__/ehrEngineCore.test.ts

# Run with coverage
npm run test:coverage
```

## 🎬 Demo

Run the interactive demo to see the EHR engine in action:

```bash
# Run the demo script
npx ts-node ehr-integrations/demo/ehrEngineDemo.ts
```

The demo will:
- Initialize the EHR engine
- Create and manage patient records
- Add clinical observations
- Simulate real-time events
- Demonstrate external system synchronization

## 🚀 Production Deployment

### Environment Configuration

```typescript
// Production configuration
const prodConfig: EHREngineConfig = {
  fhirConfig: {
    baseUrl: process.env.FHIR_SERVER_URL,
    smartConfig: {
      clientId: process.env.FHIR_CLIENT_ID,
      clientSecret: process.env.FHIR_CLIENT_SECRET,
      scopes: ['patient/*.read', 'patient/*.write', 'launch', 'launch/patient']
    }
  },
  realTimeConfig: {
    enableWebSocket: true,
    websocketUrl: process.env.WEBSOCKET_URL,
    authToken: process.env.WEBSOCKET_AUTH_TOKEN
  },
  security: {
    auditLevel: 'comprehensive',
    enableEncryption: true,
    accessControl: true
  },
  performance: {
    maxConcurrentOperations: 10,
    cacheTimeout: 300000,
    batchSize: 50
  }
};
```

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
        - name: FHIR_SERVER_URL
          valueFrom:
            secretKeyRef:
              name: ehr-config
              key: fhir-server-url
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/WebQx/webqx.git
cd webqx

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Type checking
npm run type-check
```

## 📋 Requirements

- **Node.js**: 16.0.0 or higher
- **TypeScript**: 5.8.3 or higher
- **FHIR Server**: R4 (4.0.1) compatible
- **WebSocket Support**: For real-time updates (optional)

## 🔒 Security

The WebQX EHR Engine implements multiple layers of security:

- **Authentication**: SMART on FHIR OAuth2 with PKCE
- **Authorization**: Granular scope-based permissions
- **Encryption**: Data encryption at rest and in transit
- **Audit Logging**: Comprehensive audit trails
- **Access Control**: Role-based access control (RBAC)

For security issues, please email [security@webqx.health](mailto:security@webqx.health).

## 📜 License

This project is licensed under the Apache License 2.0 - see the [LICENSE.md](LICENSE.md) file for details.

## 🌟 Enterprise Support

For enterprise support, custom integrations, and consulting services:

- **Email**: [enterprise@webqx.health](mailto:enterprise@webqx.health)
- **Website**: [https://webqx.health](https://webqx.health)
- **Documentation**: [https://docs.webqx.health](https://docs.webqx.health)

## 🏆 Standards Compliance

- ✅ **HL7 FHIR R4** (4.0.1)
- ✅ **SMART on FHIR** 
- ✅ **OAuth 2.0** / **OpenID Connect**
- ✅ **WCAG 2.1 AA** (Accessibility)
- ✅ **HIPAA Ready** (Healthcare compliance)

---

**Built with ❤️ by the WebQX Health team for the global healthcare community.**