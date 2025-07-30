# HospitalRun Integration

Ready-to-deploy integration with HospitalRun, a modern hospital information system designed for developing world hospitals.

## Overview

HospitalRun is built with modern web technologies and designed for offline-first environments. This integration provides:

- **Offline-First Architecture** with data synchronization
- **Patient Management** with photo identification
- **Appointment Scheduling** and patient flow
- **Inventory Management** for medical supplies
- **Billing and Invoicing** capabilities
- **Modern Web Interface** built with Ember.js

## Quick Start

```typescript
import { HospitalRunIntegration } from '../ehr-integrations/hospitalrun';

const hospitalrun = new HospitalRunIntegration({
  baseUrl: 'https://your-hospitalrun-instance.com',
  authentication: {
    username: 'your-username',
    password: 'your-password'
  },
  features: {
    enableOfflineSync: true,
    syncInterval: 300000, // 5 minutes
    enablePhotos: true
  }
});

await hospitalrun.initialize();

// Get patient with photo
const patient = await hospitalrun.getPatient('patient-id', {
  includePhoto: true
});

// Search patients
const patients = await hospitalrun.searchPatients({
  firstName: 'John',
  lastName: 'Doe',
  limit: 10
});

// Schedule appointment
const appointment = await hospitalrun.scheduleAppointment({
  patient: 'patient-id',
  appointmentType: 'follow-up',
  startDate: '2024-01-15T10:00:00Z',
  endDate: '2024-01-15T10:30:00Z',
  location: 'clinic-room-1'
});

// Check inventory
const inventory = await hospitalrun.getInventoryItem('medication-id');

// Create invoice
const invoice = await hospitalrun.createInvoice({
  patient: 'patient-id',
  lineItems: [
    {
      item: 'consultation',
      quantity: 1,
      price: 50.00
    }
  ]
});
```

## Configuration

```bash
# HospitalRun Instance
HOSPITALRUN_BASE_URL=https://your-hospitalrun-instance.com
HOSPITALRUN_API_VERSION=1.0

# Authentication
HOSPITALRUN_USERNAME=your-username
HOSPITALRUN_PASSWORD=your-password

# Features
HOSPITALRUN_ENABLE_OFFLINE_SYNC=true
HOSPITALRUN_SYNC_INTERVAL_MS=300000
HOSPITALRUN_ENABLE_PHOTOS=true
HOSPITALRUN_ENABLE_INVENTORY=true

# Storage
HOSPITALRUN_LOCAL_STORAGE_PATH=./hospitalrun-cache
HOSPITALRUN_MAX_CACHE_SIZE_MB=100
```

## Features

### Patient Management
- **Patient Registration** with photo capture
- **Medical Records** and clinical notes
- **Patient Search** with flexible criteria
- **Demographics Management**

### Appointment System
- **Appointment Scheduling** with calendar view
- **Patient Check-in/Check-out**
- **Appointment Types** and locations
- **Wait Time Tracking**

### Clinical Workflows
- **Visit Management** and encounter tracking
- **Diagnosis and Problem Lists**
- **Medication Management**
- **Lab and Imaging Orders**

### Inventory Management
- **Medical Supply Tracking**
- **Medication Inventory**
- **Purchase Orders**
- **Stock Alerts**

### Billing System
- **Invoice Generation**
- **Payment Tracking**
- **Insurance Processing**
- **Financial Reporting**

### Offline Capabilities
- **Offline-First Design**
- **Automatic Synchronization**
- **Conflict Resolution**
- **Local Data Storage**

## Architecture

HospitalRun uses a modern web architecture:

```
┌─────────────────────────────────────────────────┐
│                 WebQX Integration               │
├─────────────────────────────────────────────────┤
│              HospitalRun Frontend               │
├─────────────────────────────────────────────────┤
│               HospitalRun Server                │
├─────────────────────────────────────────────────┤
│              CouchDB Database                   │
└─────────────────────────────────────────────────┘
```

## API Reference

### Patient Operations

```typescript
// Create patient with photo
const patient = await hospitalrun.createPatient({
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1980-01-01',
  gender: 'M',
  photo: base64ImageData, // Optional
  contacts: [
    {
      name: 'Emergency Contact',
      phone: '+1-555-0123',
      relationship: 'spouse'
    }
  ]
});

// Update patient
await hospitalrun.updatePatient('patient-id', {
  phone: '+1-555-0456',
  address: '123 Main St, Anytown, ST 12345'
});
```

### Appointment Management

```typescript
// Get appointments for date range
const appointments = await hospitalrun.getAppointments({
  startDate: '2024-01-15',
  endDate: '2024-01-15',
  location: 'clinic-room-1'
});

// Update appointment status
await hospitalrun.updateAppointment('appointment-id', {
  status: 'completed',
  notes: 'Patient completed follow-up successfully'
});
```

### Inventory Operations

```typescript
// Add inventory item
const item = await hospitalrun.addInventoryItem({
  name: 'Acetaminophen 500mg',
  type: 'medication',
  quantity: 100,
  unit: 'tablets',
  cost: 0.25,
  vendor: 'Pharma Supply Co'
});

// Update inventory
await hospitalrun.updateInventory('item-id', {
  quantity: 75,
  notes: 'Dispensed 25 tablets'
});

// Check low stock
const lowStock = await hospitalrun.getLowStockItems();
```

## Deployment

### Docker Compose

```yaml
version: '3.8'
services:
  webqx:
    build: .
    environment:
      - HOSPITALRUN_BASE_URL=http://hospitalrun-frontend:4200
      - HOSPITALRUN_USERNAME=hradmin
      - HOSPITALRUN_PASSWORD=test
    depends_on:
      - hospitalrun-frontend

  hospitalrun-frontend:
    image: hospitalrun/frontend:latest
    ports:
      - "4200:4200"
    environment:
      - EMBER_ENV=production
    depends_on:
      - hospitalrun-server

  hospitalrun-server:
    image: hospitalrun/server:latest
    ports:
      - "3000:3000"
    environment:
      - COUCH_DB_URL=http://couchdb:5984
      - COUCH_DB_PASSWORD=password
    depends_on:
      - couchdb

  couchdb:
    image: couchdb:3.1
    ports:
      - "5984:5984"
    environment:
      - COUCHDB_USER=admin
      - COUCHDB_PASSWORD=password
```

### Offline Synchronization

```typescript
// Enable offline mode
await hospitalrun.enableOfflineMode({
  syncInterval: 300000, // 5 minutes
  maxRetries: 3,
  conflictResolution: 'server-wins' // or 'client-wins', 'manual'
});

// Manual sync
await hospitalrun.syncNow();

// Check sync status
const syncStatus = await hospitalrun.getSyncStatus();
console.log('Last sync:', syncStatus.lastSync);
console.log('Pending changes:', syncStatus.pendingChanges);
```

## Testing

```typescript
describe('HospitalRun Integration', () => {
  let hospitalrun: HospitalRunIntegration;

  beforeEach(async () => {
    hospitalrun = new HospitalRunIntegration(testConfig);
    await hospitalrun.initialize();
  });

  test('should create patient with photo', async () => {
    const patient = await hospitalrun.createPatient({
      firstName: 'Test',
      lastName: 'Patient',
      photo: mockPhotoData
    });
    expect(patient.id).toBeDefined();
    expect(patient.photo).toBeDefined();
  });
});
```

## Troubleshooting

### Common Issues

1. **Offline Sync Conflicts**
   - Review conflict resolution strategy
   - Check network connectivity
   - Verify CouchDB replication

2. **Photo Upload Issues**
   - Check file size limits
   - Verify base64 encoding
   - Review storage permissions

3. **Performance Issues**
   - Monitor CouchDB performance
   - Optimize sync intervals
   - Review local cache size

## Support

- [HospitalRun Documentation](https://docs.hospitalrun.io/)
- [HospitalRun GitHub](https://github.com/HospitalRun/hospitalrun)
- [HospitalRun Community](https://hospitalrun.io/contribute/)
- [WebQX Integration Support](https://github.com/WebQx/webqx/discussions)

## License

This HospitalRun integration is licensed under Apache License 2.0. HospitalRun itself is licensed under MIT License.