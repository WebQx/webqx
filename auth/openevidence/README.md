# OpenEvidence Authentication Integration

This document provides comprehensive setup and configuration instructions for the OpenEvidence authentication system, an AI-powered platform designed for medical professionals to access and synthesize clinically relevant evidence.

## Overview

The OpenEvidence authentication system is built as an extension to the existing WebQx healthcare platform, leveraging its robust OAuth2, RBAC, and session management infrastructure while providing specialized features for evidence-based medical research.

## Features

### ✅ Implemented Features

- **OAuth2 Authentication**: Secure login using existing WebQx credentials
- **Single Sign-On (SSO)**: Seamless integration with WebQx/Keycloak authentication
- **Multi-Factor Authentication (MFA)**: Enhanced security for sensitive research data
- **Role-Based Access Control (RBAC)**: Specialized roles for medical evidence access
- **Session Management**: Automatic timeout with configurable duration
- **Audit Logging**: Comprehensive logging for HIPAA compliance
- **HIPAA Compliance**: Built-in healthcare data protection measures

### 🔐 Security Features

- **Session Timeouts**: Configurable automatic logout after inactivity
- **Rate Limiting**: Per-session request limiting to prevent abuse
- **Consent Management**: Version-controlled consent agreements
- **Institutional Access**: Verification of institutional affiliations
- **IP-based Restrictions**: Optional IP whitelisting for enhanced security

## Architecture

```
┌─ WebQx Authentication Layer ─┐
│  • OAuth2/Keycloak           │
│  • Basic RBAC                │
│  • User Management           │
└───────────────────────────────┘
            │
            ▼
┌─ OpenEvidence Layer ─────────┐
│  • Evidence-specific roles   │
│  • Research permissions      │
│  • Session management        │
│  • Audit & compliance        │
└───────────────────────────────┘
```

## Installation & Setup

### 1. Prerequisites

- Node.js 16+ installed
- Existing WebQx platform deployed
- Keycloak server configured
- PostgreSQL database (optional, for session persistence)

### 2. Environment Configuration

Add the following variables to your `.env` file:

```env
# OpenEvidence Configuration
OPENEVIDENCE_ENABLED=true
OPENEVIDENCE_MAX_SESSION_DURATION=28800000
OPENEVIDENCE_ENABLE_RESEARCH_MODE=true
OPENEVIDENCE_REQUIRE_INSTITUTIONAL_AFFILIATION=false
OPENEVIDENCE_ENABLE_DATA_EXPORT=false
OPENEVIDENCE_REQUIRE_CONSENT_AGREEMENT=true
OPENEVIDENCE_CONSENT_VERSION=1.0
OPENEVIDENCE_RATE_LIMIT_PER_SESSION=100
OPENEVIDENCE_RATE_LIMIT_WINDOW_MS=60000
OPENEVIDENCE_ENABLE_MFA_REQUIREMENT=false
OPENEVIDENCE_ALLOWED_ORIGINS=https://openevidence.webqx.health,https://evidence.webqx.health
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start the Server

```bash
npm start
```

The OpenEvidence authentication endpoints will be available at `/auth/openevidence/*`.

## API Endpoints

### Authentication Endpoints

#### `POST /auth/openevidence/login`
Initiates OpenEvidence login via WebQx SSO.

**Request Body:**
```json
{
  "redirectUrl": "/openevidence/dashboard"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Authentication initiated",
  "requiresRedirect": true,
  "platform": "OpenEvidence"
}
```

#### `GET /auth/openevidence/callback`
Handles authentication callback from WebQx/Keycloak.

#### `POST /auth/openevidence/logout`
Logs out from OpenEvidence and WebQx.

**Headers:** `X-OpenEvidence-Session: <session-id>`

### Session Management

#### `GET /auth/openevidence/session`
Retrieves current session information.

**Response:**
```json
{
  "success": true,
  "session": {
    "id": "oe_1234567890_abc123",
    "userId": "user-123",
    "evidenceRole": "PHYSICIAN",
    "accessLevel": "ADVANCED",
    "researchPermissions": ["VIEW_EVIDENCE", "EXPORT_SUMMARIES"],
    "institutionalId": "hospital.edu",
    "consentVersion": "1.0",
    "expiresAt": "2025-01-01T12:00:00Z",
    "isActive": true
  }
}
```

#### `GET /auth/openevidence/sessions`
Lists all active sessions for the current user.

#### `DELETE /auth/openevidence/sessions/:sessionId`
Terminates a specific session.

#### `POST /auth/openevidence/sessions/refresh`
Refreshes the current session (extends timeout).

### User Profile

#### `GET /auth/openevidence/profile`
Retrieves OpenEvidence user profile information.

**Response:**
```json
{
  "success": true,
  "profile": {
    "id": "user-123",
    "email": "doctor@hospital.edu",
    "name": "Dr. John Doe",
    "openEvidenceRole": "PHYSICIAN",
    "accessLevel": "ADVANCED",
    "researchPermissions": ["VIEW_EVIDENCE", "EXPORT_SUMMARIES"],
    "institutionalAffiliation": "hospital.edu",
    "lastAccess": "2025-01-01T12:00:00Z"
  }
}
```

### Consent Management

#### `GET /auth/openevidence/consent`
Retrieves current consent information.

#### `POST /auth/openevidence/consent`
Updates consent agreement.

**Request Body:**
```json
{
  "version": "1.0",
  "agreed": true
}
```

## User Roles & Permissions

### OpenEvidence Roles

| Role | Description | Access Level |
|------|-------------|--------------|
| `PHYSICIAN` | Licensed medical doctors | ADVANCED |
| `RESEARCHER` | Research scientists | RESEARCH |
| `CLINICAL_ADMIN` | Clinical administrators | BASIC |
| `EVIDENCE_REVIEWER` | Content reviewers | BASIC |
| `SYSTEM_ADMIN` | System administrators | INSTITUTIONAL |

### Access Levels

| Level | Description | Capabilities |
|-------|-------------|--------------|
| `BASIC` | Basic evidence access | View public summaries |
| `ADVANCED` | Advanced clinical access | Detailed analyses, export summaries |
| `RESEARCH` | Research-level access | Raw data, research tools |
| `INSTITUTIONAL` | Full institutional access | All features, admin functions |

### Research Permissions

- `VIEW_EVIDENCE` - Access to evidence summaries
- `EXPORT_SUMMARIES` - Export evidence reports
- `CREATE_RESEARCH_QUERIES` - Create complex research queries
- `ACCESS_RAW_DATA` - Access to raw research data
- `CONTRIBUTE_EVIDENCE` - Contribute evidence to the platform
- `MODERATE_CONTENT` - Moderate user-contributed content
- `ADMIN_USERS` - Administer user accounts

## Middleware Usage

### Basic Authentication

```javascript
import { requireOpenEvidenceAuth } from './auth/openevidence/middleware';

app.get('/api/evidence', requireOpenEvidenceAuth, (req, res) => {
  // Access req.openEvidenceSession
  res.json({ evidence: [] });
});
```

### Permission-Based Access

```javascript
import { requirePermissions } from './auth/openevidence/middleware';

app.post('/api/evidence/export', 
  requireOpenEvidenceAuth,
  requirePermissions(['EXPORT_SUMMARIES']),
  (req, res) => {
    // Handle export logic
  }
);
```

### Access Level Requirements

```javascript
import { requireAccessLevel } from './auth/openevidence/middleware';

app.get('/api/research/data',
  requireOpenEvidenceAuth,
  requireAccessLevel('RESEARCH'),
  (req, res) => {
    // Provide research data
  }
);
```

### Pre-composed Middleware Stacks

```javascript
import { basicAuth, researchAuth, adminAuth } from './auth/openevidence/middleware';

// Basic authentication with CORS and audit
app.use('/api/evidence', basicAuth);

// Research-level with consent and rate limiting
app.use('/api/research', researchAuth);

// Admin-level with MFA requirement
app.use('/api/admin', adminAuth);
```

## Testing

### Run Tests

```bash
# Run all tests
npm test

# Run only OpenEvidence tests
npm test -- --testPathPattern=openevidence

# Run with coverage
npm test -- --coverage
```

### Test Coverage

The test suite covers:
- ✅ Authentication manager functionality
- ✅ Session management and timeouts
- ✅ Role mapping and permissions
- ✅ Middleware authentication and authorization
- ✅ Rate limiting and security features
- ✅ Error handling and edge cases

## Security Considerations

### HIPAA Compliance

- **Audit Logging**: All authentication events are logged
- **Session Security**: Secure session tokens with configurable timeouts
- **Data Encryption**: All sensitive data encrypted in transit
- **Access Controls**: Granular permission system
- **Consent Management**: Version-controlled consent tracking

### Best Practices

1. **Session Management**
   - Set appropriate session timeouts (8 hours default)
   - Regularly monitor active sessions
   - Implement session cleanup processes

2. **Rate Limiting**
   - Configure per-session limits based on usage patterns
   - Monitor for suspicious activity
   - Implement graduated responses

3. **MFA Requirements**
   - Enable MFA for sensitive operations
   - Verify MFA status in middleware
   - Provide clear MFA setup instructions

4. **Institutional Verification**
   - Validate institutional email addresses
   - Maintain whitelist of approved institutions
   - Regular verification of affiliations

## Monitoring & Maintenance

### Log Monitoring

Monitor these log patterns:
- `[OpenEvidence Auth]` - Authentication events
- `[OpenEvidence Audit]` - Access and usage audit
- `[OpenEvidence Security]` - Security violations

### Health Checks

```bash
curl http://localhost:3000/auth/openevidence/health
```

### Session Statistics

Access admin endpoints to monitor:
- Active session counts
- Session distribution by role
- Rate limiting violations

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   ```
   Error: USER_NOT_ELIGIBLE
   Solution: Verify user has medical role in WebQx
   ```

2. **Session Expiration**
   ```
   Error: SESSION_EXPIRED  
   Solution: Check session timeout configuration
   ```

3. **Permission Denied**
   ```
   Error: INSUFFICIENT_PERMISSIONS
   Solution: Verify user role mapping and permissions
   ```

### Debug Mode

Enable debug logging:
```env
NODE_ENV=development
DEBUG=openevidence:*
```

## Integration Examples

### Frontend Integration

```javascript
// Initialize OpenEvidence authentication
const auth = {
  async login() {
    const response = await fetch('/auth/openevidence/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ redirectUrl: window.location.pathname })
    });
    return response.json();
  },

  async getSession() {
    const response = await fetch('/auth/openevidence/session', {
      headers: { 'X-OpenEvidence-Session': sessionStorage.getItem('sessionId') }
    });
    return response.json();
  },

  async logout() {
    await fetch('/auth/openevidence/logout', {
      method: 'POST',
      headers: { 'X-OpenEvidence-Session': sessionStorage.getItem('sessionId') }
    });
    sessionStorage.removeItem('sessionId');
  }
};
```

### Backend Service Integration

```javascript
// Service that uses OpenEvidence authentication
class EvidenceService {
  constructor() {
    this.authManager = require('./auth/openevidence').openEvidenceAuth;
  }

  async getEvidence(sessionId, query) {
    const session = this.authManager.getSession(sessionId);
    if (!session) throw new Error('Invalid session');

    if (!this.authManager.hasPermission(sessionId, 'VIEW_EVIDENCE')) {
      throw new Error('Insufficient permissions');
    }

    // Fetch evidence based on user's access level
    return this.fetchEvidenceForLevel(session.accessLevel, query);
  }
}
```

## Support & Contributing

### Getting Help

- Check the troubleshooting section above
- Review the test files for usage examples
- Examine the middleware implementations for customization

### Contributing

1. Follow the existing code patterns
2. Add comprehensive tests for new features
3. Update documentation for any changes
4. Ensure HIPAA compliance for healthcare features

### License

This OpenEvidence authentication system is part of the WebQx healthcare platform and follows the same Apache 2.0 license terms.

---

**Version**: 1.0.0  
**Last Updated**: January 2025  
**Maintained by**: WebQx Health Team