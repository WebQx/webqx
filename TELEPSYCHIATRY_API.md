# Telepsychiatry API Platform Documentation

## Overview

The WebQX Telepsychiatry API Platform provides a comprehensive set of RESTful endpoints for managing telepsychiatry consultations, consent, clinical workflows, and data analytics. The implementation leverages the existing WebQX healthcare infrastructure with OAuth2/Keycloak authentication and FHIR compliance.

## API Endpoints

### 🔐 Authentication (`/auth`)
- **POST /auth/login** - OAuth2 authentication via Keycloak
- **POST /auth/logout** - Revokes tokens to terminate sessions  
- **GET /auth/me** - Returns user role and session metadata

### 📝 Consent Management (`/consent`)
- **POST /consent/record** - Stores signed consent forms with encryption
- **GET /consent/audit** - Queries consent logs with filtering options
- **GET /consent/:consentId** - Retrieves specific consent record

### 🎥 Video Consultation (`/session`)
- **POST /session/start** - Initiates Jitsi video session with security features
- **GET /session/active** - Lists ongoing consultations for providers
- **POST /session/transcribe** - Whisper STT transcription with encryption
- **GET /session/transcript/:id** - Retrieves encrypted transcripts
- **POST /session/:sessionId/end** - Ends video consultation session

### 🏥 Electronic Medical Records (`/emr`)
- **GET /emr/records/:patientId** - Fetches HL7/FHIR-compliant patient records
- **POST /emr/tag** - Adds ICD-10/DSM-5 annotations to records
- **GET /emr/annotations/:patientId** - Retrieves patient annotations

### 🌐 User Interface Customization (`/ui`)
- **GET /ui/languages** - Lists supported locales with RTL/LTR info
- **POST /ui/customize** - Configures region-specific phrases and text directions
- **GET /ui/customize/:languageCode** - Retrieves language customization
- **DELETE /ui/customize/:languageCode** - Resets language to default

### ⚙️ Clinical Workflow Automation (`/workflow`)
- **GET /workflow/triage** - Provides culturally adapted triage prompts
- **POST /workflow/plan** - Automatically generates care plans
- **GET /workflow/plan/:planId** - Retrieves specific care plan
- **PUT /workflow/plan/:planId** - Updates existing care plan

### 📊 Data and Reporting (`/analytics`)
- **GET /analytics/deidentified** - Exports anonymized data for research
- **GET /analytics/community** - Provides public health summaries
- **POST /analytics/report** - Submits analytical findings to admin dashboard
- **GET /analytics/reports** - Lists submitted reports (admin only)

## Key Features

### 🛡️ Security & Compliance
- OAuth2/Keycloak integration for authentication
- Data encryption for sensitive information (consent, transcripts)
- Comprehensive audit logging
- Role-based access control (RBAC)
- Input validation and sanitization
- Rate limiting and security middleware

### 🌍 Multi-language & Cultural Support
- 12 supported languages including RTL (Arabic, Hebrew)
- Cultural adaptation for triage workflows
- Region-specific customization
- Localized UI phrases and directions

### 🔬 Clinical Workflow Features
- Automated triage with cultural sensitivity
- AI-powered care plan generation
- ICD-10 and DSM-5 coding support
- Progress tracking and outcomes measurement

### 📈 Analytics & Research
- Anonymized data export for research
- Public health trend analysis
- Treatment outcome reporting
- Community mental health insights

## Authentication

All protected endpoints require authentication via:
- Session cookie: `sessionId`
- Header: `x-session-id: <session-id>`
- Bearer token: `Authorization: Bearer <token>`

## Response Format

All endpoints return JSON responses with consistent structure:

```json
{
  "status": "success|error",
  "data": { ... },
  "message": "Human-readable message",
  "timestamp": "2024-01-15T10:00:00Z"
}
```

Error responses include:
```json
{
  "error": "ERROR_CODE",
  "message": "Description of error",
  "details": [ ... ]
}
```

## Sample Usage

### Start Video Session
```bash
curl -X POST http://localhost:3000/session/start \
  -H "x-session-id: your-session-id" \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "patient-123",
    "sessionType": "consultation",
    "duration": 60,
    "recordingEnabled": false,
    "transcriptionEnabled": true
  }'
```

### Generate Care Plan
```bash
curl -X POST http://localhost:3000/workflow/plan \
  -H "x-session-id: your-session-id" \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "patient-123",
    "assessmentData": {
      "primaryCondition": "Depression",
      "severity": "moderate",
      "symptoms": ["low mood", "fatigue", "sleep issues"]
    },
    "preferences": {
      "therapyPreference": "CBT"
    },
    "culturalFactors": {
      "religiousConsiderations": true
    }
  }'
```

### Get UI Languages
```bash
curl http://localhost:3000/ui/languages
```

## Development & Testing

The API includes comprehensive input validation, error handling, and test coverage. All endpoints are tested for security, functionality, and compliance with healthcare standards.

### Test Server
```bash
npm start
# Server runs on http://localhost:3000
```

### Health Check
```bash
curl http://localhost:3000/health
```

## Production Deployment

For production deployment:

1. **Database Integration**: Replace in-memory storage with secure database
2. **Jitsi Configuration**: Set up dedicated Jitsi Meet server
3. **Whisper Integration**: Configure Whisper API service
4. **FHIR Server**: Connect to production FHIR endpoint
5. **SSL/TLS**: Configure HTTPS with valid certificates
6. **Environment Variables**: Set production configuration
7. **Monitoring**: Set up health checks and monitoring
8. **Backup**: Configure data backup and recovery

## Architecture

The Telepsychiatry API follows microservices principles with:
- Modular route structure (`/routes/*.js`)
- Middleware-based authentication
- Service layer abstraction
- Clean separation of concerns
- Scalable Express.js foundation

Built on the existing WebQX healthcare platform infrastructure with full FHIR compliance and OAuth2 security integration.