# API Version 1

This directory contains the first version of the WebQx EHR API endpoints.

## Purpose

Provides core API functionality for the WebQx EHR system, including patient management, appointments, prescriptions, and basic clinical operations.

## Endpoints Overview

### Patient Management
- `GET /api/v1/patients` - List patients with filtering and pagination
- `POST /api/v1/patients` - Create new patient record
- `GET /api/v1/patients/{id}` - Get patient details
- `PUT /api/v1/patients/{id}` - Update patient information
- `DELETE /api/v1/patients/{id}` - Deactivate patient record

### Appointments
- `GET /api/v1/appointments` - List appointments
- `POST /api/v1/appointments` - Schedule new appointment
- `PUT /api/v1/appointments/{id}` - Update appointment
- `DELETE /api/v1/appointments/{id}` - Cancel appointment

### Prescriptions
- `GET /api/v1/prescriptions` - List prescriptions
- `POST /api/v1/prescriptions` - Create prescription
- `PUT /api/v1/prescriptions/{id}` - Update prescription
- `GET /api/v1/prescriptions/{id}/status` - Check prescription status

### Clinical Data
- `GET /api/v1/observations` - Get clinical observations
- `POST /api/v1/observations` - Record new observation
- `GET /api/v1/diagnostics` - Get diagnostic reports
- `POST /api/v1/diagnostics` - Create diagnostic report

## Authentication

All endpoints require valid JWT token in Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Response Format

```json
{
  "status": "success|error",
  "data": {},
  "message": "Optional message",
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

## Error Codes

- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

## Rate Limiting

- 1000 requests per hour per API key
- 100 requests per minute per endpoint
- Higher limits available for premium accounts