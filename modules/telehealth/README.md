# WebQX Telehealth Module

## Overview

The WebQX Telehealth Module provides secure, FHIR-compliant telehealth session management with integrated patient consent tracking. This implementation meets the specified requirements for secure session access links, email/SMS notifications, interactive consent screens, and FHIR Consent resource logging.

## Features Implemented

### ✅ Requirements Met

1. **Secure Session Links via Email/SMS**
   - Encrypted access tokens with automatic expiration
   - Email and SMS notification services with mock implementations
   - Secure link generation with built-in security features

2. **Interactive Consent Screen**
   - Professional consent interface with detailed information
   - Patient must interact with consent screen before joining
   - HIPAA-compliant consent collection process

3. **FHIR Consent Resource Logging**
   - Full FHIR R4 compliant Consent resources
   - Automatic consent verification and recording
   - Compliance tracking with audit trails

### 🛠 Technical Implementation

#### Files Created

```
fhir/models/Consent.js                           # FHIR Consent resource model
modules/telehealth/services/sessionService.js   # Session management service
modules/telehealth/services/notificationService.js # Email/SMS notifications  
modules/telehealth/routes/telehealth.js         # API routes
modules/telehealth/routes/web.js                # Web interface routes
modules/telehealth/components/consent.html      # Consent screen component
modules/telehealth/__tests__/*.test.js          # Comprehensive test suite
telehealth-demo.html                            # Demo and testing interface
```

#### Architecture

- **Modular Design**: Follows existing WebQX module patterns
- **FHIR Compliance**: Full FHIR R4 Consent resource implementation
- **Security**: Encrypted session tokens, automatic expiration, audit logging
- **Extensibility**: Plugin architecture for notification providers
- **Testing**: 28 comprehensive tests covering all functionality

## API Endpoints

### Session Management
- `POST /api/telehealth/sessions` - Create new telehealth session
- `GET /api/telehealth/sessions/validate` - Validate session access token
- `GET /api/telehealth/sessions/:id` - Get session information
- `POST /api/telehealth/sessions/:id/start` - Start session
- `POST /api/telehealth/sessions/:id/end` - End session

### Consent Management
- `POST /api/telehealth/consent` - Record patient consent
- `GET /api/telehealth/sessions/:id/consent` - Get FHIR consent record

### Web Interface
- `GET /telehealth/join?access=<token>` - Patient consent screen
- `GET /telehealth/session?token=<token>` - Telehealth session interface

## Usage Examples

### 1. Creating a Telehealth Session

```javascript
const response = await fetch('/api/telehealth/sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    patientId: 'patient-123',
    providerId: 'provider-456',
    sessionType: 'consultation',
    specialty: 'cardiology',
    patientEmail: 'patient@example.com',
    patientName: 'John Doe',
    providerName: 'Dr. Smith'
  })
});

const session = await response.json();
// Returns: { sessionId, accessLink, consentRequired, status, ... }
```

### 2. Patient Consent Flow

```javascript
// Patient visits the secure link
// GET /telehealth/join?access=<encrypted_token>

// System validates token and shows consent screen
// Patient provides consent through interactive UI

// Consent is recorded as FHIR resource
const consentResponse = await fetch('/api/telehealth/consent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    accessToken: token,
    consentGiven: true,
    ipAddress: '192.168.1.100',
    userAgent: navigator.userAgent
  })
});
```

### 3. FHIR Consent Resource

The system automatically creates compliant FHIR Consent resources:

```json
{
  "resourceType": "Consent",
  "id": "consent-id-123",
  "status": "active",
  "scope": {
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/consentscope",
      "code": "treatment",
      "display": "Treatment"
    }]
  },
  "patient": {
    "reference": "Patient/patient-123"
  },
  "dateTime": "2025-08-01T14:41:46.971Z",
  "policyRule": {
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
      "code": "HIPAA-Auth",
      "display": "HIPAA Authorization"
    }]
  },
  "extension": [{
    "url": "http://webqx.health/fhir/StructureDefinition/telehealth-consent",
    "extension": [
      { "url": "sessionId", "valueString": "session-123" },
      { "url": "consentMethod", "valueString": "electronic" },
      { "url": "ipAddress", "valueString": "192.168.1.100" }
    ]
  }]
}
```

## Testing

### Running Tests

```bash
npm test -- modules/telehealth
```

### Test Coverage

28 comprehensive tests covering:
- ✅ FHIR Consent model validation and creation
- ✅ Session creation and management
- ✅ Access link encryption/decryption
- ✅ Consent recording and verification
- ✅ Session lifecycle management
- ✅ Notification service functionality
- ✅ API endpoint validation

### Demo Interface

Visit `/telehealth-demo` for an interactive demonstration of all features.

## Security Features

- **Encrypted Session Tokens**: AES encryption for access links
- **Automatic Expiration**: Sessions expire automatically for security
- **Audit Logging**: Complete audit trail for compliance
- **IP Address Tracking**: Records patient location for consent
- **User Agent Logging**: Tracks browser/device information
- **HIPAA Compliance**: Follows healthcare privacy regulations

## Integration

The telehealth module integrates seamlessly with the existing WebQX infrastructure:

- Uses existing FHIR model patterns
- Follows authentication middleware patterns
- Integrates with existing messaging infrastructure
- Maintains consistency with codebase conventions

## Future Enhancements

- Integration with video conferencing providers (Zoom, WebRTC)
- Real-time notification delivery via WebSockets
- Advanced consent management features
- Multi-language support for consent screens
- Integration with calendar systems for scheduling
- Mobile app support for session access

## Compliance

- **FHIR R4**: Full compliance with FHIR Consent resource specification
- **HIPAA**: Secure handling of protected health information
- **21 CFR Part 11**: Electronic signature compliance ready
- **Audit Trails**: Complete logging for regulatory requirements