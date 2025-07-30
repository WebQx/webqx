# Mock FHIR and openEHR Servers Setup Guide

This guide provides instructions for setting up and using the mock FHIR and openEHR servers included in the WebQX Healthcare Platform.

## Overview

The WebQX platform includes two independent mock servers to facilitate local testing and validation:

1. **Mock FHIR Server** - Implements FHIR R4 standard endpoints
2. **Mock openEHR Server** - Implements openEHR REST API endpoints

Both servers run on the same port (3000 by default) with different API path prefixes and provide basic CRUD operations for healthcare resources.

## Prerequisites

- Node.js >= 16.0.0
- npm package manager

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   # Development mode with authentication tokens
   NODE_ENV=development npm start
   
   # or Production mode
   npm start
   ```

3. **Verify both servers are running:**
   ```bash
   curl http://localhost:3000/health
   ```
   
   Expected response:
   ```json
   {
     "status": "healthy",
     "service": "WebQX Healthcare Platform",
     "fhir": "enabled",
     "openehr": "enabled",
     "timestamp": "2025-07-30T19:20:26.944Z"
   }
   ```

## Server Architecture

### FHIR Mock Server
- **Base URL**: `http://localhost:3000/fhir`
- **Authentication**: OAuth2 Bearer tokens (development mode provides test tokens)
- **Resources Supported**: Patient, Observation, Appointment
- **Standards Compliance**: FHIR R4

### openEHR Mock Server
- **Base URL**: `http://localhost:3000/openehr/v1`
- **Authentication**: None (for demo purposes)
- **Resources Supported**: EHR, Composition, AQL Queries
- **Standards Compliance**: openEHR REST API

## Authentication (FHIR Only)

### Development Mode
Get a test token:
```bash
curl http://localhost:3000/dev/token
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "patient/*.read patient/*.write user/*.read"
}
```

### Using Authentication
Include the token in all FHIR requests:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
     -H "Accept: application/fhir+json" \
     http://localhost:3000/fhir/Patient
```

## Data Validation

### FHIR Server
- Validates resource structure according to FHIR R4 specification
- Checks required fields and data types
- Returns OperationOutcome resources for errors

### openEHR Server
- Validates composition structure according to openEHR specification
- Checks required archetype elements
- Returns structured error responses

## Test Data

Both servers come pre-populated with test data for immediate use:

### FHIR Test Data
- 2 test patients (patient-001, patient-002)
- 3 test observations (vital signs, lab results)
- Sample appointments

### openEHR Test Data
- 2 test EHRs (ehr-001, ehr-002)
- 2 test compositions (patient encounter, lab report)
- Sample vital signs and laboratory data

## Storage

Both servers use **in-memory storage** for simplicity:
- Data persists only while the server is running
- Restarting the server resets to initial test data
- Perfect for development and testing scenarios
- No database setup required

## Performance

The mock servers are designed for development use:
- Lightweight and fast responses
- No external dependencies
- Suitable for local testing and CI/CD pipelines
- Not intended for production healthcare data

## Integration Testing

Run the included test suites:
```bash
# Test FHIR mock server
npm test -- --testPathPatterns="fhir.*mock-server"

# Test openEHR mock server  
npm test -- --testPathPatterns="openehr.*mock-server"

# Test both
npm test -- --testPathPatterns="mock-server"
```

## Extending the Servers

### Adding New FHIR Resources
1. Create model in `fhir/models/`
2. Create service in `fhir/services/`
3. Create routes in `fhir/routes/`
4. Add routes to `server.js`

### Adding New openEHR Archetypes
1. Extend composition content in `openehr/services/OpenEHRService.js`
2. Add validation logic in `openehr/models/Composition.js`
3. Create specific route handlers if needed

## Troubleshooting

### Server Won't Start
- Check Node.js version: `node --version`
- Verify port 3000 is available: `lsof -i :3000`
- Check for dependency issues: `npm install`

### Authentication Issues (FHIR)
- Ensure NODE_ENV=development for test tokens
- Check token expiration (default 1 hour)
- Verify token format in Authorization header

### Invalid Responses
- Check request Content-Type headers
- Verify request body structure matches specifications
- Review server logs for validation errors

## Next Steps

- Review the [FHIR API Examples](./FHIR_API_EXAMPLES.md)
- Review the [openEHR API Examples](./OPENEHR_API_EXAMPLES.md)
- Explore the [Integration Guide](./INTEGRATION_GUIDE.md)