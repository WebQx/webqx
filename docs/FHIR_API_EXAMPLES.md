# FHIR Mock Server API Examples

This document provides comprehensive examples for using the FHIR mock server endpoints.

## Base URL
```
http://localhost:3000/fhir
```

## Authentication
All FHIR endpoints require Bearer token authentication. Get a development token:

```bash
curl http://localhost:3000/dev/token
```

Set the token for all requests:
```bash
export TOKEN="your_access_token_here"
```

## Patient Resource Examples

### 1. Get All Patients

**Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
     -H "Accept: application/fhir+json" \
     "http://localhost:3000/fhir/Patient"
```

**Response:**
```json
{
  "resourceType": "Bundle",
  "id": "search-1753902777495",
  "type": "searchset",
  "total": 2,
  "entry": [
    {
      "resource": {
        "resourceType": "Patient",
        "id": "patient-001",
        "meta": {
          "versionId": "1",
          "lastUpdated": "2025-07-30T19:12:28.205Z",
          "profile": ["http://hl7.org/fhir/StructureDefinition/Patient"]
        },
        "identifier": [
          {
            "use": "usual",
            "type": {
              "coding": [
                {
                  "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                  "code": "MR",
                  "display": "Medical Record Number"
                }
              ]
            },
            "system": "http://webqx.health/patient-id",
            "value": "WQX001"
          }
        ],
        "active": true,
        "name": [
          {
            "use": "official",
            "family": "Doe",
            "given": ["John", "Michael"]
          }
        ],
        "gender": "male",
        "birthDate": "1985-03-15"
      }
    }
  ]
}
```

### 2. Get Patient by ID

**Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
     -H "Accept: application/fhir+json" \
     "http://localhost:3000/fhir/Patient/patient-001"
```

**Response:**
```json
{
  "resourceType": "Patient",
  "id": "patient-001",
  "meta": {
    "versionId": "1",
    "lastUpdated": "2025-07-30T19:12:28.205Z",
    "profile": ["http://hl7.org/fhir/StructureDefinition/Patient"]
  },
  "identifier": [
    {
      "use": "usual",
      "type": {
        "coding": [
          {
            "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
            "code": "MR",
            "display": "Medical Record Number"
          }
        ]
      },
      "system": "http://webqx.health/patient-id",
      "value": "WQX001"
    }
  ],
  "active": true,
  "name": [
    {
      "use": "official",
      "family": "Doe",
      "given": ["John", "Michael"]
    }
  ],
  "telecom": [
    {
      "system": "phone",
      "value": "+1-555-0123",
      "use": "home"
    },
    {
      "system": "email",
      "value": "john.doe@example.com",
      "use": "home"
    }
  ],
  "gender": "male",
  "birthDate": "1985-03-15",
  "address": [
    {
      "use": "home",
      "type": "both",
      "line": ["123 Main Street"],
      "city": "Anytown",
      "state": "NY",
      "postalCode": "12345",
      "country": "US"
    }
  ]
}
```

### 3. Create New Patient

**Request:**
```bash
curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/fhir+json" \
     -H "Accept: application/fhir+json" \
     -d '{
       "resourceType": "Patient",
       "name": [
         {
           "use": "official",
           "family": "Smith",
           "given": ["Jane", "Marie"]
         }
       ],
       "gender": "female",
       "birthDate": "1992-08-15",
       "telecom": [
         {
           "system": "email",
           "value": "jane.smith@example.com",
           "use": "home"
         }
       ]
     }' \
     "http://localhost:3000/fhir/Patient"
```

**Response:** 201 Created
```json
{
  "resourceType": "Patient",
  "id": "generated-uuid",
  "meta": {
    "versionId": "1",
    "lastUpdated": "2025-07-30T19:30:00.000Z",
    "profile": ["http://hl7.org/fhir/StructureDefinition/Patient"]
  },
  "name": [
    {
      "use": "official",
      "family": "Smith",
      "given": ["Jane", "Marie"]
    }
  ],
  "gender": "female",
  "birthDate": "1992-08-15"
}
```

### 4. Search Patients

**By name:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
     -H "Accept: application/fhir+json" \
     "http://localhost:3000/fhir/Patient?name=Doe"
```

**By gender:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
     -H "Accept: application/fhir+json" \
     "http://localhost:3000/fhir/Patient?gender=female"
```

**With pagination:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
     -H "Accept: application/fhir+json" \
     "http://localhost:3000/fhir/Patient?_count=10&_offset=0"
```

## Observation Resource Examples

### 1. Get All Observations

**Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
     -H "Accept: application/fhir+json" \
     "http://localhost:3000/fhir/Observation"
```

### 2. Get Observation by ID

**Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
     -H "Accept: application/fhir+json" \
     "http://localhost:3000/fhir/Observation/observation-001"
```

**Response:**
```json
{
  "resourceType": "Observation",
  "id": "observation-001",
  "meta": {
    "versionId": "1",
    "lastUpdated": "2025-07-30T19:12:28.205Z",
    "profile": ["http://hl7.org/fhir/StructureDefinition/Observation"]
  },
  "status": "final",
  "category": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/observation-category",
          "code": "vital-signs",
          "display": "Vital Signs"
        }
      ]
    }
  ],
  "code": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "8310-5",
        "display": "Body temperature"
      }
    ]
  },
  "subject": {
    "reference": "Patient/patient-001",
    "display": "John Michael Doe"
  },
  "effectiveDateTime": "2025-07-30T08:30:00Z",
  "valueQuantity": {
    "value": 98.6,
    "unit": "degrees F",
    "system": "http://unitsofmeasure.org",
    "code": "[degF]"
  },
  "interpretation": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
          "code": "N",
          "display": "Normal"
        }
      ]
    }
  ]
}
```

### 3. Create New Observation

**Request:**
```bash
curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/fhir+json" \
     -H "Accept: application/fhir+json" \
     -d '{
       "resourceType": "Observation",
       "status": "final",
       "category": [
         {
           "coding": [
             {
               "system": "http://terminology.hl7.org/CodeSystem/observation-category",
               "code": "vital-signs",
               "display": "Vital Signs"
             }
           ]
         }
       ],
       "code": {
         "coding": [
           {
             "system": "http://loinc.org",
             "code": "29463-7",
             "display": "Body weight"
           }
         ]
       },
       "subject": {
         "reference": "Patient/patient-001",
         "display": "John Michael Doe"
       },
       "effectiveDateTime": "2025-07-30T10:00:00Z",
       "valueQuantity": {
         "value": 70,
         "unit": "kg",
         "system": "http://unitsofmeasure.org",
         "code": "kg"
       }
     }' \
     "http://localhost:3000/fhir/Observation"
```

### 4. Search Observations

**By patient:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
     -H "Accept: application/fhir+json" \
     "http://localhost:3000/fhir/Observation?patient=patient-001"
```

**By category:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
     -H "Accept: application/fhir+json" \
     "http://localhost:3000/fhir/Observation?category=vital-signs"
```

**By status:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
     -H "Accept: application/fhir+json" \
     "http://localhost:3000/fhir/Observation?status=final"
```

## Utility Endpoints

### 1. Get Patient Count

**Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
     -H "Accept: application/fhir+json" \
     "http://localhost:3000/fhir/Patient/\$count"
```

**Response:**
```json
{
  "resourceType": "Parameters",
  "parameter": [
    {
      "name": "count",
      "valueInteger": 2
    }
  ]
}
```

### 2. Get Patient Summary

**Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
     -H "Accept: application/fhir+json" \
     "http://localhost:3000/fhir/Patient/patient-001/\$summary"
```

**Response:**
```json
{
  "id": "patient-001",
  "name": "John Michael Doe",
  "gender": "male",
  "birthDate": "1985-03-15",
  "active": true,
  "lastUpdated": "2025-07-30T19:12:28.205Z"
}
```

## Error Handling

All errors return FHIR OperationOutcome resources:

**Example Error Response (404):**
```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "processing",
      "diagnostics": "Patient not found"
    }
  ]
}
```

**Example Validation Error (400):**
```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "processing",
      "diagnostics": "Patient validation failed: At least one name is required"
    }
  ]
}
```

## Rate Limiting

The FHIR server includes rate limiting:
- 100 requests per 15-minute window per IP
- Returns 429 Too Many Requests with OperationOutcome when exceeded

## Supported Operations

| Resource | Create | Read | Update | Delete | Search |
|----------|--------|------|--------|--------|--------|
| Patient  | ✅     | ✅   | ✅     | ✅     | ✅     |
| Observation | ✅  | ✅   | ✅     | ✅     | ✅     |
| Appointment | ✅  | ✅   | ✅     | ✅     | ✅     |

## FHIR Compliance

- FHIR R4 specification compliance
- Proper HTTP status codes
- FHIR-compliant JSON responses
- Standard search parameters
- Proper resource validation