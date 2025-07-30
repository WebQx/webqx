# openEHR Mock Server API Examples

This document provides comprehensive examples for using the openEHR mock server endpoints.

## Base URL
```
http://localhost:3000/openehr/v1
```

## Authentication
The openEHR mock server requires **no authentication** for demo purposes. All endpoints are publicly accessible.

## EHR Resource Examples

### 1. Get EHR by ID

**Request:**
```bash
curl -H "Accept: application/json" \
     "http://localhost:3000/openehr/v1/ehr/ehr-001"
```

**Response:**
```json
{
  "ehr_id": "ehr-001",
  "system_id": "webqx.health",
  "ehr_status": {
    "archetype_node_id": "openEHR-EHR-EHR_STATUS.generic.v1",
    "name": {
      "value": "EHR Status"
    },
    "uid": "550e8400-e29b-41d4-a716-446655440000::webqx.health::1",
    "subject": {
      "external_ref": {
        "id": {
          "value": "patient-001"
        },
        "namespace": "DEMOGRAPHIC",
        "type": "PERSON"
      }
    },
    "is_modifiable": true,
    "is_queryable": true
  },
  "time_created": "2025-07-30T19:20:00.000Z",
  "compositions": [
    {
      "uid": "comp-001::webqx.health::1",
      "archetype_node_id": "openEHR-EHR-COMPOSITION.encounter.v1",
      "name": "Patient Encounter",
      "created": "2025-07-30T08:00:00.000Z"
    }
  ]
}
```

### 2. Create New EHR

**Request:**
```bash
curl -X POST \
     -H "Content-Type: application/json" \
     -H "Accept: application/json" \
     -d '{
       "subject_id": "patient-123",
       "ehr_status": {
         "is_modifiable": true,
         "is_queryable": true
       }
     }' \
     "http://localhost:3000/openehr/v1/ehr"
```

**Response:** 201 Created
```json
{
  "ehr_id": "generated-uuid",
  "system_id": "webqx.health",
  "ehr_status": {
    "archetype_node_id": "openEHR-EHR-EHR_STATUS.generic.v1",
    "name": {
      "value": "EHR Status"
    },
    "uid": "generated-uuid::webqx.health::1",
    "subject": {
      "external_ref": {
        "id": {
          "value": "patient-123"
        },
        "namespace": "DEMOGRAPHIC",
        "type": "PERSON"
      }
    },
    "is_modifiable": true,
    "is_queryable": true
  },
  "time_created": "2025-07-30T19:30:00.000Z",
  "compositions": []
}
```

### 3. Get EHR Status

**Request:**
```bash
curl -H "Accept: application/json" \
     "http://localhost:3000/openehr/v1/ehr/ehr-001/ehr_status"
```

**Response:**
```json
{
  "archetype_node_id": "openEHR-EHR-EHR_STATUS.generic.v1",
  "name": {
    "value": "EHR Status"
  },
  "uid": "550e8400-e29b-41d4-a716-446655440000::webqx.health::1",
  "subject": {
    "external_ref": {
      "id": {
        "value": "patient-001"
      },
      "namespace": "DEMOGRAPHIC",
      "type": "PERSON"
    }
  },
  "is_modifiable": true,
  "is_queryable": true
}
```

### 4. Update EHR Status

**Request:**
```bash
curl -X PUT \
     -H "Content-Type: application/json" \
     -H "Accept: application/json" \
     -d '{
       "is_modifiable": false,
       "is_queryable": true
     }' \
     "http://localhost:3000/openehr/v1/ehr/ehr-001/ehr_status"
```

## Composition Resource Examples

### 1. Get All Compositions

**Request:**
```bash
curl -H "Accept: application/json" \
     "http://localhost:3000/openehr/v1/composition"
```

**Response:**
```json
{
  "total": 2,
  "compositions": [
    {
      "uid": "comp-001::webqx.health::1",
      "archetype_node_id": "openEHR-EHR-COMPOSITION.encounter.v1",
      "name": {
        "value": "Patient Encounter"
      },
      "composer": {
        "name": "Dr. Sarah Johnson"
      },
      "category": {
        "value": "event",
        "defining_code": {
          "terminology_id": {
            "value": "openehr"
          },
          "code_string": "433"
        }
      },
      "territory": {
        "terminology_id": {
          "value": "ISO_3166-1"
        },
        "code_string": "US"
      },
      "language": {
        "terminology_id": {
          "value": "ISO_639-1"
        },
        "code_string": "en"
      },
      "content": [
        {
          "archetype_node_id": "openEHR-EHR-OBSERVATION.vital_signs.v1",
          "name": {
            "value": "Vital Signs"
          },
          "data": {
            "events": [
              {
                "time": "2025-07-30T08:30:00Z",
                "data": {
                  "items": [
                    {
                      "name": {
                        "value": "Body temperature"
                      },
                      "value": {
                        "magnitude": 98.6,
                        "units": "°F"
                      }
                    }
                  ]
                }
              }
            ]
          }
        }
      ]
    }
  ],
  "timestamp": "2025-07-30T19:30:00.000Z"
}
```

### 2. Get Composition by UID

**Request:**
```bash
curl -H "Accept: application/json" \
     "http://localhost:3000/openehr/v1/composition/comp-001::webqx.health::1"
```

**Response:**
```json
{
  "uid": "comp-001::webqx.health::1",
  "archetype_node_id": "openEHR-EHR-COMPOSITION.encounter.v1",
  "name": {
    "value": "Patient Encounter"
  },
  "composer": {
    "name": "Dr. Sarah Johnson"
  },
  "category": {
    "value": "event",
    "defining_code": {
      "terminology_id": {
        "value": "openehr"
      },
      "code_string": "433"
    }
  },
  "territory": {
    "terminology_id": {
      "value": "ISO_3166-1"
    },
    "code_string": "US"
  },
  "language": {
    "terminology_id": {
      "value": "ISO_639-1"
    },
    "code_string": "en"
  },
  "context": {
    "start_time": "2025-07-30T08:00:00Z",
    "setting": {
      "value": "primary medical care",
      "defining_code": {
        "terminology_id": {
          "value": "openehr"
        },
        "code_string": "228"
      }
    }
  },
  "content": [
    {
      "archetype_node_id": "openEHR-EHR-OBSERVATION.vital_signs.v1",
      "name": {
        "value": "Vital Signs"
      },
      "data": {
        "events": [
          {
            "time": "2025-07-30T08:30:00Z",
            "data": {
              "items": [
                {
                  "name": {
                    "value": "Body temperature"
                  },
                  "value": {
                    "magnitude": 98.6,
                    "units": "°F"
                  }
                },
                {
                  "name": {
                    "value": "Heart rate"
                  },
                  "value": {
                    "magnitude": 72,
                    "units": "/min"
                  }
                }
              ]
            }
          }
        ]
      }
    }
  ],
  "_metadata": {
    "created": "2025-07-30T08:00:00.000Z",
    "modified": "2025-07-30T08:00:00.000Z",
    "version": 1
  }
}
```

### 3. Create New Composition

**Request:**
```bash
curl -X POST \
     -H "Content-Type: application/json" \
     -H "Accept: application/json" \
     -H "openEHR-TEMPLATE_ID: vital_signs.v1" \
     -d '{
       "name": {
         "value": "New Vital Signs Assessment"
       },
       "composer": {
         "name": "Dr. Jane Wilson"
       },
       "archetype_node_id": "openEHR-EHR-COMPOSITION.encounter.v1",
       "context": {
         "start_time": "2025-07-30T14:00:00Z",
         "setting": {
           "value": "primary medical care",
           "defining_code": {
             "terminology_id": {
               "value": "openehr"
             },
             "code_string": "228"
           }
         }
       },
       "content": [
         {
           "archetype_node_id": "openEHR-EHR-OBSERVATION.vital_signs.v1",
           "name": {
             "value": "Current Vital Signs"
           },
           "data": {
             "events": [
               {
                 "time": "2025-07-30T14:00:00Z",
                 "data": {
                   "items": [
                     {
                       "name": {
                         "value": "Systolic blood pressure"
                       },
                       "value": {
                         "magnitude": 120,
                         "units": "mmHg"
                       }
                     },
                     {
                       "name": {
                         "value": "Diastolic blood pressure"
                       },
                       "value": {
                         "magnitude": 80,
                         "units": "mmHg"
                       }
                     }
                   ]
                 }
               }
             ]
           }
         }
       ]
     }' \
     "http://localhost:3000/openehr/v1/ehr/ehr-001/composition"
```

**Response:** 201 Created
```json
{
  "uid": "generated-uuid::webqx.health::1",
  "archetype_node_id": "openEHR-EHR-COMPOSITION.encounter.v1",
  "name": {
    "value": "New Vital Signs Assessment"
  },
  "composer": {
    "name": "Dr. Jane Wilson"
  },
  "content": [
    {
      "archetype_node_id": "openEHR-EHR-OBSERVATION.vital_signs.v1",
      "name": {
        "value": "Current Vital Signs"
      },
      "data": {
        "events": [
          {
            "time": "2025-07-30T14:00:00Z",
            "data": {
              "items": [
                {
                  "name": {
                    "value": "Systolic blood pressure"
                  },
                  "value": {
                    "magnitude": 120,
                    "units": "mmHg"
                  }
                }
              ]
            }
          }
        ]
      }
    }
  ],
  "_metadata": {
    "created": "2025-07-30T19:30:00.000Z",
    "modified": "2025-07-30T19:30:00.000Z",
    "version": 1
  }
}
```

### 4. Update Composition

**Request:**
```bash
curl -X PUT \
     -H "Content-Type: application/json" \
     -H "Accept: application/json" \
     -H "openEHR-TEMPLATE_ID: vital_signs.v1" \
     -d '{
       "name": {
         "value": "Updated Vital Signs Assessment"
       },
       "composer": {
         "name": "Dr. Jane Wilson"
       }
     }' \
     "http://localhost:3000/openehr/v1/ehr/ehr-001/composition/comp-001::webqx.health::1"
```

### 5. Search Compositions

**By EHR ID:**
```bash
curl -H "Accept: application/json" \
     "http://localhost:3000/openehr/v1/composition?ehr_id=ehr-001"
```

**By archetype:**
```bash
curl -H "Accept: application/json" \
     "http://localhost:3000/openehr/v1/composition?archetype_node_id=openEHR-EHR-COMPOSITION.encounter.v1"
```

**By composer:**
```bash
curl -H "Accept: application/json" \
     "http://localhost:3000/openehr/v1/composition?composer=Dr.%20Sarah"
```

### 6. Delete Composition

**Request:**
```bash
curl -X DELETE \
     "http://localhost:3000/openehr/v1/ehr/ehr-001/composition/comp-001::webqx.health::1"
```

**Response:** 204 No Content

## AQL Query Examples

### 1. Execute AQL Query (POST)

**Request:**
```bash
curl -X POST \
     -H "Content-Type: application/json" \
     -H "Accept: application/json" \
     -d '{
       "q": "SELECT c FROM COMPOSITION c WHERE c/name/value = '\''Patient Encounter'\''",
       "query_parameters": {},
       "offset": 0,
       "fetch": 10
     }' \
     "http://localhost:3000/openehr/v1/query/aql"
```

**Response:**
```json
{
  "meta": {
    "href": "/rest/v1/query/aql",
    "type": "RESULTSET",
    "schema_version": "1.0.0",
    "created": "2025-07-30T19:30:00.000Z",
    "generator": "WebQX openEHR Mock Service",
    "executed_aql": "SELECT c FROM COMPOSITION c WHERE c/name/value = 'Patient Encounter'"
  },
  "q": "SELECT c FROM COMPOSITION c WHERE c/name/value = 'Patient Encounter'",
  "columns": [
    {
      "name": "result",
      "path": "/"
    }
  ],
  "rows": [
    [
      {
        "uid": "comp-001::webqx.health::1",
        "archetype_node_id": "openEHR-EHR-COMPOSITION.encounter.v1",
        "name": {
          "value": "Patient Encounter"
        }
      }
    ]
  ]
}
```

### 2. Execute AQL Query (GET)

**Simple query:**
```bash
curl -H "Accept: application/json" \
     "http://localhost:3000/openehr/v1/query/aql?q=SELECT%20c%20FROM%20COMPOSITION%20c"
```

**With parameters:**
```bash
curl -H "Accept: application/json" \
     "http://localhost:3000/openehr/v1/query/aql?q=SELECT%20e%20FROM%20EHR%20e&offset=0&fetch=5"
```

### 3. Common AQL Query Patterns

**Get all compositions:**
```bash
curl -X POST \
     -H "Content-Type: application/json" \
     -d '{"q": "SELECT c FROM COMPOSITION c"}' \
     "http://localhost:3000/openehr/v1/query/aql"
```

**Get all EHRs:**
```bash
curl -X POST \
     -H "Content-Type: application/json" \
     -d '{"q": "SELECT e FROM EHR e"}' \
     "http://localhost:3000/openehr/v1/query/aql"
```

**Get compositions by archetype:**
```bash
curl -X POST \
     -H "Content-Type: application/json" \
     -d '{"q": "SELECT c FROM COMPOSITION c WHERE c/archetype_node_id = '\''openEHR-EHR-COMPOSITION.encounter.v1'\''"}' \
     "http://localhost:3000/openehr/v1/query/aql"
```

## Utility Endpoints

### 1. Get EHR Count

**Request:**
```bash
curl -H "Accept: application/json" \
     "http://localhost:3000/openehr/v1/ehr/\$count"
```

**Response:**
```json
{
  "count": 2,
  "timestamp": "2025-07-30T19:30:00.000Z"
}
```

### 2. Get Composition Count

**Request:**
```bash
curl -H "Accept: application/json" \
     "http://localhost:3000/openehr/v1/composition/\$count"
```

**Response:**
```json
{
  "count": 2,
  "timestamp": "2025-07-30T19:30:00.000Z"
}
```

### 3. Get Composition Summary

**Request:**
```bash
curl -H "Accept: application/json" \
     "http://localhost:3000/openehr/v1/composition/comp-001::webqx.health::1/\$summary"
```

**Response:**
```json
{
  "uid": "comp-001::webqx.health::1",
  "name": "Patient Encounter",
  "archetype_node_id": "openEHR-EHR-COMPOSITION.encounter.v1",
  "composer": "Dr. Sarah Johnson",
  "created": "2025-07-30T08:00:00.000Z",
  "modified": "2025-07-30T08:00:00.000Z",
  "version": 1,
  "content_count": 1
}
```

## Error Handling

All errors return structured JSON error responses:

**Example Error Response (404):**
```json
{
  "error": {
    "message": "EHR not found",
    "code": 404
  },
  "timestamp": "2025-07-30T19:30:00.000Z"
}
```

**Example Validation Error (400):**
```json
{
  "error": {
    "message": "Composition validation failed: Name with value is required",
    "code": 400
  },
  "timestamp": "2025-07-30T19:30:00.000Z"
}
```

## openEHR Headers

### Template ID Header
For composition operations, specify the template:
```
openEHR-TEMPLATE_ID: template_name.v1
```

### Version Headers
For versioned operations (not fully implemented in mock):
```
openEHR-VERSION_AT_TIME: 2025-07-30T19:30:00.000Z
openEHR-AUDIT_DETAILS: {"change_type": "creation"}
```

## Supported Operations

| Resource | Create | Read | Update | Delete | Search | AQL |
|----------|--------|------|--------|--------|--------|-----|
| EHR      | ✅     | ✅   | ✅     | ❌     | ❌     | ✅  |
| Composition | ✅  | ✅   | ✅     | ✅     | ✅     | ✅  |
| AQL Query | N/A   | N/A  | N/A    | N/A    | N/A    | ✅  |

## openEHR Compliance

- openEHR REST API specification compliance
- Proper HTTP status codes
- JSON format responses
- Standard archetype structures
- Basic AQL query support
- UID-based resource identification

## Advanced Features

### Versioning
All compositions support versioning with automatic version increments on updates.

### Archetype Support
The mock server supports common openEHR archetypes:
- COMPOSITION.encounter.v1
- COMPOSITION.report.v1
- OBSERVATION.vital_signs.v1
- OBSERVATION.laboratory_test_result.v1

### Context Support
Compositions can include context information for encounters, reports, and other clinical scenarios.