# WebQX FHIR Sandbox Environment

This document describes how to set up and use the WebQX FHIR sandbox environment for testing interoperability with external systems.

## Quick Start

### 1. Start the Server
```bash
cd /home/runner/work/webqx/webqx
NODE_ENV=development PORT=3001 node server.js
```

### 2. Verify Server Health
```bash
curl http://localhost:3001/health
```

### 3. Get FHIR Capability Statement
```bash
curl http://localhost:3001/fhir/metadata
```

### 4. Run Comprehensive API Tests
```bash
./docs/fhir/test-api.sh
```

## Authentication

### Development Token
Get a test token for development:
```bash
curl http://localhost:3001/dev/token
```

### Using Authentication
```bash
TOKEN=$(curl -s http://localhost:3001/dev/token | jq -r '.access_token')
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/fhir/Patient
```

## Sandbox Data

The sandbox comes pre-loaded with:

### Patients
- `patient-001`: John Michael Doe (male, 1985-03-15)
- `patient-002`: Jane Elizabeth Smith (female, 1990-07-22)

### Appointments
- `appointment-001`: Booked consultation (tomorrow 10:00 AM)
- `appointment-002`: Pending cardiology follow-up (next week 2:30 PM)

### Available Slots
- 50 automatically generated slots for next 14 days
- Business hours: 9 AM - 12 PM, 2 PM - 5 PM
- Excludes weekends

## Testing Scenarios

### 1. Patient Management
```bash
# Search patients
curl http://localhost:3001/fhir/Patient

# Create patient
curl -X POST http://localhost:3001/fhir/Patient \
  -H "Content-Type: application/fhir+json" \
  -d @docs/fhir/examples/patient-create.json

# Update patient
curl -X PUT http://localhost:3001/fhir/Patient/{id} \
  -H "Content-Type: application/fhir+json" \
  -d @docs/fhir/examples/patient-update.json
```

### 2. Real-time Appointment Booking
```bash
# Get available slots
curl http://localhost:3001/fhir/Appointment/\$available-slots

# Book appointment
curl -X POST http://localhost:3001/fhir/Appointment/\$book \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @docs/fhir/examples/appointment-book.json

# Cancel appointment
curl -X POST http://localhost:3001/fhir/Appointment/{id}/\$cancel \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @docs/fhir/examples/appointment-cancel.json
```

### 3. Cross-Border Healthcare Testing
```bash
# Multi-language patient search
curl "http://localhost:3001/fhir/Patient?name=Smith&_format=json"

# International appointment booking
curl -X POST http://localhost:3001/fhir/Appointment/\$book \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "patientId": "patient-002",
    "practitionerId": "practitioner-002",
    "slotId": "slot-123456789",
    "serviceType": "Telemedicine Consultation",
    "description": "Cross-border consultation"
  }'
```

## Interoperability Testing

### FHIR Compliance
- All resources follow FHIR R4 specification
- Proper Bundle responses for search operations
- OperationOutcome for error handling
- Standard HTTP status codes

### Standards Support
- **HL7 FHIR R4**: Complete implementation
- **OAuth2**: JWT Bearer token authentication
- **CORS**: Cross-origin resource sharing enabled
- **Rate Limiting**: 100 requests per 15 minutes
- **Security Headers**: Helmet.js protection

### External System Integration
To test with external FHIR clients:

1. **Point your FHIR client to**: `http://localhost:3001/fhir`
2. **Use OAuth2 flow**: Get token from `/oauth/authorize` endpoint
3. **Test operations**: Create, Read, Update, Delete, Search
4. **Validate responses**: All responses are FHIR-compliant JSON

## Monitoring and Logs

### Health Monitoring
```bash
# Server health
curl http://localhost:3001/health

# Resource counts
curl http://localhost:3001/fhir/Patient/\$count
curl http://localhost:3001/fhir/Appointment/\$count

# Available capacity
curl http://localhost:3001/fhir/Appointment/\$available-slots
```

### Error Testing
```bash
# Test invalid resource
curl http://localhost:3001/fhir/Patient/invalid-id

# Test malformed request
curl -X POST http://localhost:3001/fhir/Patient \
  -H "Content-Type: application/json" \
  -d '{"invalid": "data"}'

# Test unauthorized access
curl -X POST http://localhost:3001/fhir/Appointment/\$book \
  -d '{"test": "data"}'
```

## Performance Benchmarks

### Expected Response Times
- Patient search: < 50ms
- Appointment booking: < 100ms
- Available slots: < 200ms (50 slots)
- Resource creation: < 150ms

### Throughput
- 100 requests per 15-minute window per IP
- Concurrent connections: Limited by system resources
- Memory usage: ~50MB for sandbox data

## Data Reset

To reset sandbox data:
```bash
# Restart the server (data is in-memory)
pkill -f "node server.js"
NODE_ENV=development PORT=3001 node server.js
```

## Troubleshooting

### Common Issues
1. **Port already in use**: Change PORT environment variable
2. **CORS errors**: Ensure proper headers are set
3. **Authentication failures**: Verify token format and expiration
4. **Rate limiting**: Wait for rate limit window to reset

### Debug Mode
```bash
DEBUG=* NODE_ENV=development PORT=3001 node server.js
```

## Next Steps

After testing in the sandbox:
1. Deploy to production environment
2. Configure real database connections
3. Set up proper OAuth2 provider
4. Enable production logging and monitoring
5. Configure SSL/TLS certificates
6. Set up backup and disaster recovery

## Support

For issues or questions:
- Check the FHIR API documentation: `/docs/fhir/README.md`
- Run the test suite: `./docs/fhir/test-api.sh`
- Review server logs for detailed error information