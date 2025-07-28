# WebQX FHIR R4 API Documentation

This document provides comprehensive documentation for the WebQX FHIR R4 API implementation, which enables full healthcare interoperability according to HL7 FHIR standards.

## Base URL
```
http://localhost:3001/fhir
```

## Authentication
The FHIR API uses OAuth2 JWT Bearer tokens for authentication. In development mode, some GET operations may work without authentication.

### Get Test Token
```bash
curl http://localhost:3001/dev/token
```

### Using Authentication
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3001/fhir/Patient
```

## FHIR Capability Statement
Retrieve the server's capabilities and supported resources:

```bash
GET /fhir/metadata
```

**Response:**
```json
{
  "resourceType": "CapabilityStatement",
  "id": "webqx-fhir-server",
  "version": "1.0.0",
  "name": "WebQX FHIR Server",
  "status": "active",
  "fhirVersion": "4.0.1",
  "format": ["application/fhir+json"],
  "rest": [{
    "mode": "server",
    "security": {
      "cors": true,
      "service": [{"coding": [{"code": "OAuth"}]}]
    },
    "resource": [
      {"type": "Patient", "interaction": ["read", "create", "update", "delete", "search-type"]},
      {"type": "Appointment", "interaction": ["read", "create", "update", "delete", "search-type"]}
    ]
  }]
}
```

## Patient Resource

### Search Patients
```bash
GET /fhir/Patient
GET /fhir/Patient?name=John
GET /fhir/Patient?gender=male
GET /fhir/Patient?birthdate=1985-03-15
GET /fhir/Patient?active=true
GET /fhir/Patient?identifier=WQX001
GET /fhir/Patient?_count=10&_offset=0
```

**Response:**
```json
{
  "resourceType": "Bundle",
  "type": "searchset",
  "total": 2,
  "entry": [
    {
      "resource": {
        "resourceType": "Patient",
        "id": "patient-001",
        "meta": {
          "versionId": "1",
          "lastUpdated": "2025-07-28T21:59:24.311Z"
        },
        "identifier": [{
          "use": "usual",
          "type": {"coding": [{"code": "MR", "display": "Medical Record Number"}]},
          "system": "http://webqx.health/patient-id",
          "value": "WQX001"
        }],
        "active": true,
        "name": [{
          "use": "official",
          "family": "Doe",
          "given": ["John", "Michael"]
        }],
        "gender": "male",
        "birthDate": "1985-03-15"
      }
    }
  ]
}
```

### Read Patient
```bash
GET /fhir/Patient/patient-001
```

### Create Patient
```bash
POST /fhir/Patient
Content-Type: application/fhir+json

{
  "resourceType": "Patient",
  "name": [{
    "family": "Smith",
    "given": ["Jane"]
  }],
  "gender": "female",
  "birthDate": "1990-05-15",
  "telecom": [{
    "system": "email",
    "value": "jane.smith@example.com"
  }]
}
```

### Update Patient
```bash
PUT /fhir/Patient/patient-001
Content-Type: application/fhir+json

{
  "resourceType": "Patient",
  "id": "patient-001",
  "name": [{
    "family": "Doe",
    "given": ["John", "Michael", "Updated"]
  }],
  "gender": "male",
  "birthDate": "1985-03-15"
}
```

### Delete Patient
```bash
DELETE /fhir/Patient/patient-001
```

### Patient Summary
```bash
GET /fhir/Patient/patient-001/$summary
```

**Response:**
```json
{
  "id": "patient-001",
  "name": "John Michael Doe",
  "gender": "male",
  "birthDate": "1985-03-15",
  "active": true,
  "lastUpdated": "2025-07-28T21:59:24.311Z"
}
```

### Patient Count
```bash
GET /fhir/Patient/$count
```

**Response:**
```json
{
  "resourceType": "Parameters",
  "parameter": [{
    "name": "count",
    "valueInteger": 2
  }]
}
```

## Appointment Resource

### Search Appointments
```bash
GET /fhir/Appointment
GET /fhir/Appointment?patient=patient-001
GET /fhir/Appointment?practitioner=practitioner-001
GET /fhir/Appointment?status=booked
GET /fhir/Appointment?date=2025-07-29
GET /fhir/Appointment?service-type=Consultation
```

**Response:**
```json
{
  "resourceType": "Bundle",
  "type": "searchset",
  "total": 2,
  "entry": [
    {
      "resource": {
        "resourceType": "Appointment",
        "id": "appointment-001",
        "meta": {
          "versionId": "1",
          "lastUpdated": "2025-07-28T21:59:24.311Z"
        },
        "status": "booked",
        "serviceType": [{
          "coding": [{"code": "11429006", "display": "Consultation"}],
          "text": "General Consultation"
        }],
        "description": "Annual physical examination",
        "start": "2025-07-29T10:00:00.000Z",
        "end": "2025-07-29T10:30:00.000Z",
        "minutesDuration": 30,
        "participant": [
          {
            "actor": {"reference": "Patient/patient-001", "display": "John Doe"},
            "required": "required",
            "status": "accepted"
          },
          {
            "actor": {"reference": "Practitioner/practitioner-001", "display": "Dr. Sarah Johnson"},
            "required": "required",
            "status": "accepted"
          }
        ]
      }
    }
  ]
}
```

### Read Appointment
```bash
GET /fhir/Appointment/appointment-001
```

### Create Appointment
```bash
POST /fhir/Appointment
Content-Type: application/fhir+json

{
  "resourceType": "Appointment",
  "status": "proposed",
  "description": "Follow-up consultation",
  "start": "2025-08-01T14:00:00.000Z",
  "end": "2025-08-01T14:30:00.000Z",
  "participant": [
    {
      "actor": {"reference": "Patient/patient-002"},
      "required": "required",
      "status": "needs-action"
    },
    {
      "actor": {"reference": "Practitioner/practitioner-001"},
      "required": "required",
      "status": "accepted"
    }
  ]
}
```

### Update Appointment
```bash
PUT /fhir/Appointment/appointment-001
Content-Type: application/fhir+json

{
  "resourceType": "Appointment",
  "id": "appointment-001",
  "status": "confirmed",
  "description": "Updated: Annual physical examination"
}
```

### Delete Appointment
```bash
DELETE /fhir/Appointment/appointment-001
```

## Real-Time Appointment Booking

### Get Available Slots
Get available appointment slots for booking:

```bash
GET /fhir/Appointment/$available-slots
GET /fhir/Appointment/$available-slots?start=2025-07-29T00:00:00Z&end=2025-07-30T23:59:59Z
GET /fhir/Appointment/$available-slots?practitioner=practitioner-001
```

**Response:**
```json
{
  "resourceType": "Parameters",
  "parameter": [{
    "name": "slots",
    "part": [
      {
        "name": "slot",
        "resource": {
          "resourceType": "Slot",
          "id": "slot-1753747200000",
          "status": "free",
          "start": "2025-07-29T09:00:00.000Z",
          "end": "2025-07-29T09:30:00.000Z",
          "schedule": {
            "reference": "Practitioner/practitioner-001"
          }
        }
      }
    ]
  }]
}
```

### Book Appointment
Book an appointment in real-time using an available slot:

```bash
POST /fhir/Appointment/$book
Content-Type: application/json

{
  "patientId": "patient-001",
  "practitionerId": "practitioner-001",
  "slotId": "slot-1753747200000",
  "serviceType": "General Consultation",
  "description": "Annual checkup",
  "priority": 5
}
```

**Response:**
```json
{
  "resourceType": "Appointment",
  "id": "appointment-003",
  "status": "booked",
  "description": "Annual checkup",
  "start": "2025-07-29T09:00:00.000Z",
  "end": "2025-07-29T09:30:00.000Z",
  "minutesDuration": 30,
  "participant": [
    {
      "actor": {"reference": "Patient/patient-001", "display": "Patient"},
      "required": "required",
      "status": "accepted"
    },
    {
      "actor": {"reference": "Practitioner/practitioner-001", "display": "Healthcare Provider"},
      "required": "required",
      "status": "accepted"
    }
  ]
}
```

### Cancel Appointment
```bash
POST /fhir/Appointment/appointment-001/$cancel
Content-Type: application/json

{
  "reason": "Patient unable to attend"
}
```

**Response:**
```json
{
  "resourceType": "Appointment",
  "id": "appointment-001",
  "status": "cancelled",
  "cancelationReason": {
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/appointment-cancellation-reason",
      "code": "other",
      "display": "Patient unable to attend"
    }]
  }
}
```

## Appointment Utilities

### Today's Appointments
```bash
GET /fhir/Appointment/$today
```

### Upcoming Appointments
```bash
GET /fhir/Appointment/$upcoming
GET /fhir/Appointment/$upcoming?days=14
```

### Appointment Count
```bash
GET /fhir/Appointment/$count
```

### Appointment Summary
```bash
GET /fhir/Appointment/appointment-001/$summary
```

**Response:**
```json
{
  "id": "appointment-001",
  "status": "booked",
  "start": "2025-07-29T10:00:00.000Z",
  "end": "2025-07-29T10:30:00.000Z",
  "duration": 30,
  "description": "Annual physical examination",
  "patient": "John Doe",
  "practitioner": "Dr. Sarah Johnson",
  "serviceType": "General Consultation",
  "lastUpdated": "2025-07-28T21:59:24.311Z"
}
```

## Error Handling

All errors return FHIR OperationOutcome resources:

```json
{
  "resourceType": "OperationOutcome",
  "issue": [{
    "severity": "error",
    "code": "processing",
    "diagnostics": "Patient not found"
  }]
}
```

### Common HTTP Status Codes
- `200 OK` - Successful GET, PUT
- `201 Created` - Successful POST
- `204 No Content` - Successful DELETE
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

## Rate Limiting
The API implements rate limiting:
- 100 requests per 15-minute window per IP
- Rate limit headers included in responses:
  - `X-RateLimit-Limit`: Request limit
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset timestamp

## FHIR Compliance
This implementation follows FHIR R4 specifications:
- Proper resource structures and validation
- FHIR-compliant search parameters
- Standard HTTP methods and status codes
- FHIR Bundle responses for search operations
- OperationOutcome for error responses
- Proper FHIR content types (`application/fhir+json`)

## Cross-Border Healthcare Access
The system supports interoperability features for global healthcare:
- Multi-language communication support
- Standardized coding systems (SNOMED CT, LOINC)
- OAuth2 security for secure data exchange
- Real-time appointment synchronization
- Cross-reference patient identifiers

## Testing and Validation
The implementation includes comprehensive test coverage:
- 40+ unit tests for Patient resources
- Integration tests for API endpoints
- FHIR validation tests
- Real-time booking scenarios
- Error handling validation

See the `/fhir/tests/` directory for test examples.