# GNU Health Integration

Ready-to-deploy integration with GNU Health, a free health and hospital information system with strong focus on public health and social medicine.

## Overview

GNU Health is a comprehensive health and hospital information system that supports:

- **Hospital Management** with bed management and surgery scheduling
- **Laboratory Information System** (LIS)
- **Health Information System** for epidemiology and public health
- **Electronic Medical Records** with clinical workflows
- **Pharmacy and Medication Management**
- **Socioeconomic Determinants** tracking

## Quick Start

```typescript
import { GNUHealthIntegration } from '../ehr-integrations/gnuhealth';

const gnuhealth = new GNUHealthIntegration({
  baseUrl: 'https://your-gnuhealth-server.com',
  database: 'gnuhealth_demo',
  authentication: {
    username: 'your-username',
    password: 'your-password'
  },
  modules: {
    enableHospital: true,
    enableLIS: true,
    enablePharmacy: true
  }
});

await gnuhealth.initialize();

// Get patient
const patient = await gnuhealth.getPatient('patient-id');

// Get hospital bed status
const beds = await gnuhealth.getBedStatus('ward-id');

// Schedule surgery
const surgery = await gnuhealth.scheduleSurgery({
  patient: 'patient-id',
  procedure: 'procedure-code',
  surgeon: 'surgeon-id',
  datetime: '2024-01-15T14:00:00Z'
});

// Lab test results
const labResults = await gnuhealth.getLabResults('patient-id');
```

## Configuration

```bash
# GNU Health Server
GNUHEALTH_BASE_URL=https://your-gnuhealth-server.com
GNUHEALTH_DATABASE=gnuhealth_production
GNUHEALTH_PORT=8000

# Authentication
GNUHEALTH_USERNAME=your-username
GNUHEALTH_PASSWORD=your-password

# Modules
GNUHEALTH_ENABLE_HOSPITAL=true
GNUHEALTH_ENABLE_LIS=true
GNUHEALTH_ENABLE_PHARMACY=true
GNUHEALTH_ENABLE_GENETICS=false

# Protocols
GNUHEALTH_PROTOCOL=jsonrpc  # or xmlrpc
GNUHEALTH_SSL_VERIFY=true
```

## Features

### Core Health Information System
- **Patient Demographics and Clinical Records**
- **Disease Classification** (ICD-10, ICD-11)
- **Epidemiology and Public Health** tracking
- **Immunization Management**

### Hospital Management
- **Bed and Ward Management**
- **Surgery Scheduling and OR Management**
- **Nursing Care Plans**
- **Discharge Planning**

### Laboratory Information System
- **Lab Test Ordering and Results**
- **Microbiology and Pathology**
- **Quality Control**
- **Equipment Integration**

### Pharmacy Management
- **Medication Dispensing**
- **Drug Interaction Checking**
- **Inventory Management**
- **Prescription Management**

## GNU Health Modules

| Module | Description | Support |
|--------|-------------|---------|
| Core | Base health information system | ✅ Full |
| Hospital | Hospital and ward management | ✅ Full |
| LIS | Laboratory information system | ✅ Full |
| Pharmacy | Medication and pharmacy | ✅ Full |
| Genetics | Genetic information | ⚠️ Limited |
| Radiology | Imaging and PACS | 🚧 Planned |

## Deployment

### Docker Setup

```yaml
version: '3.8'
services:
  webqx:
    build: .
    environment:
      - GNUHEALTH_BASE_URL=http://gnuhealth:8000
      - GNUHEALTH_DATABASE=gnuhealth
      - GNUHEALTH_USERNAME=admin
      - GNUHEALTH_PASSWORD=admin123
    depends_on:
      - gnuhealth

  gnuhealth:
    image: gnuhealth/gnuhealth:latest
    ports:
      - "8000:8000"
    environment:
      - POSTGRES_DB=gnuhealth
      - POSTGRES_USER=gnuhealth
      - POSTGRES_PASSWORD=gnuhealth
    depends_on:
      - postgres

  postgres:
    image: postgres:13
    environment:
      - POSTGRES_DB=gnuhealth
      - POSTGRES_USER=gnuhealth
      - POSTGRES_PASSWORD=gnuhealth
```

## API Protocols

GNU Health supports multiple protocols:

### JSON-RPC (Recommended)
```typescript
const gnuhealth = new GNUHealthIntegration({
  protocol: 'jsonrpc',
  baseUrl: 'https://server.com:8000'
});
```

### XML-RPC (Legacy)
```typescript
const gnuhealth = new GNUHealthIntegration({
  protocol: 'xmlrpc',
  baseUrl: 'https://server.com:8000'
});
```

## Testing

```bash
# Test connection
npm test -- --testNamePattern="GNU Health Connection"

# Test hospital module
npm test -- --testNamePattern="GNU Health Hospital"

# Test LIS integration
npm test -- --testNamePattern="GNU Health LIS"
```

## Support

- [GNU Health Documentation](https://www.gnuhealth.org/documentation/)
- [GNU Health Manual](https://en.wikibooks.org/wiki/GNU_Health)
- [GNU Health Community](https://www.gnuhealth.org/community/)
- [WebQX Integration Support](https://github.com/WebQx/webqx/discussions)

## License

This GNU Health integration is licensed under Apache License 2.0. GNU Health itself is licensed under GPL v3+.