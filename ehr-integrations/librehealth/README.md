# LibreHealth Integration

Ready-to-deploy integration with LibreHealth EHR, a community-driven open source health IT tools and systems collection.

## Overview

LibreHealth provides multiple health IT solutions including LibreHealth EHR (based on OpenEMR) and LibreHealth Toolkit. This integration supports:

- **REST API Integration** with LibreHealth EHR
- **Patient Management** and clinical workflows
- **Appointment Scheduling** and calendar management
- **Clinical Documentation** and notes
- **Billing and Practice Management** features

## Quick Start

```typescript
import { LibreHealthIntegration } from '../ehr-integrations/librehealth';

const librehealth = new LibreHealthIntegration({
  baseUrl: 'https://your-librehealth-instance.com',
  authentication: {
    type: 'api_key', // or 'oauth2'
    apiKey: 'your-api-key',
    // For OAuth2:
    // clientId: 'your-client-id',
    // clientSecret: 'your-client-secret'
  },
  version: '7.0.0'
});

await librehealth.initialize();

// Get patient
const patient = await librehealth.getPatient('patient-id');

// Search patients
const patients = await librehealth.searchPatients({
  name: 'John Doe',
  dob: '1980-01-01'
});

// Book appointment
const appointment = await librehealth.bookAppointment({
  patient: 'patient-id',
  provider: 'provider-id',
  datetime: '2024-01-15T10:00:00Z',
  duration: 30
});
```

## Configuration

```bash
# LibreHealth Instance
LIBREHEALTH_BASE_URL=https://your-librehealth-instance.com
LIBREHEALTH_VERSION=7.0.0

# Authentication
LIBREHEALTH_API_KEY=your-api-key
# Or OAuth2
LIBREHEALTH_CLIENT_ID=your-client-id
LIBREHEALTH_CLIENT_SECRET=your-client-secret

# Features
LIBREHEALTH_ENABLE_FHIR=true
LIBREHEALTH_ENABLE_AUDIT=true
```

## Features

- **Patient Registration and Management**
- **Appointment Scheduling**
- **Clinical Documentation**
- **Prescription Management**
- **Lab Results Integration**
- **Billing and Insurance**
- **Reporting and Analytics**

## Supported Versions

- LibreHealth EHR 7.x (recommended)
- LibreHealth EHR 6.x (limited support)
- LibreHealth Toolkit integration

## Support

- [LibreHealth Documentation](https://librehealth.io/docs/)
- [LibreHealth EHR Documentation](https://librehealth.io/projects/lh-ehr/)
- [WebQX Integration Support](https://github.com/WebQx/webqx/discussions)

## License

Licensed under Apache License 2.0. LibreHealth projects use various open source licenses.