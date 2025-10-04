# OpenEMR Integration Setup Guide for WebQX™ Provider Portal

## Overview

This guide will help you configure and launch OpenEMR from the WebQX™ Provider Portal with proper OAuth2 authentication and FHIR R4 integration.

## Prerequisites

### OpenEMR Requirements
- OpenEMR 7.0.0 or higher (recommended for full FHIR support)
- OAuth2 authentication enabled
- FHIR R4 API enabled
- SSL/HTTPS configured (recommended for production)

### WebQX™ Portal Requirements
- Modern web browser with JavaScript enabled
- Network access to your OpenEMR instance
- Valid OAuth2 client credentials

## Quick Setup

### 0. Configure Provider SSO Bridge (Server)

The provider SSO finalize route now exchanges Keycloak (or other central IdP) tokens for OpenEMR credentials before returning control to the browser. Make sure the backend process that serves `auth/providers/routes.js` is provisioned with the following environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENEMR_BASE_URL` | ✅ | Base URL of your OpenEMR deployment (e.g., `https://openemr.example.com`). Trailing slashes are trimmed automatically. |
| `OPENEMR_CLIENT_ID` | ✅ | OAuth2 client ID registered inside OpenEMR. |
| `OPENEMR_CLIENT_SECRET` | ✅ | OAuth2 client secret for the client above. |
| `OPENEMR_SSO_SCOPES` | Optional | Space-delimited scope override sent to OpenEMR during the client-credential exchange. Defaults to a safe read/write bundle if omitted. |
| `CENTRAL_IDP_ISSUER` | Optional (recommended) | Issuer URL for the central IdP (Keycloak, Azure AD, etc.). Used to derive the `/userinfo` endpoint for token validation. |
| `CENTRAL_IDP_USERINFO_URL` | Optional | Explicit `userinfo` URL. If omitted the route attempts to derive it from the issuer. |

When these are present the finalize handler will:

1. Validate the Keycloak access token against the IdP `userinfo` endpoint (if configured).
2. Request an OpenEMR access token using the client credentials.
3. Persist the OpenEMR token bundle (access token, expiry, scopes) in the session payload and make it available to the frontend.
4. Set `provider_token` and OpenEMR session cookies for subsequent API calls.

On failure, the handler returns a descriptive status (e.g., `OPENEMR_TOKEN_EXCHANGE_FAILED`) and no OpenEMR tokens are cached.

### 0.1 Frontend Session Handling

The provider portal SSO manager (`auth/providers/js/sso.js`) now stores the OpenEMR token bundle in `localStorage` under `webqx_openemr_session` and dispatches a `webqx:openemr-session` event whenever the session changes. Launcher scripts can consume this event to react to new or cleared sessions:

```javascript
window.addEventListener('webqx:openemr-session', ({ detail }) => {
    if (detail && detail.enabled) {
        console.log('OpenEMR ready', detail.baseUrl);
    } else {
        console.warn('OpenEMR session cleared');
    }
});
```

Stale session data is automatically removed when the finalize flow errors or when the backend reports `enabled: false`.

### 1. Configure OpenEMR Instance

#### Enable APIs in OpenEMR
1. Log in to OpenEMR as administrator
2. Navigate to **Administration → Globals → Connectors**
3. Enable the following:
   - ✅ Enable REST API
   - ✅ Enable FHIR REST API
   - ✅ Enable OAuth2 Authentication

#### Register OAuth2 Client
1. Go to **Administration → System → API Clients**
2. Click **"Add New Client"**
3. Configure the client:
   - **Client Name**: `WebQX Provider Portal`
   - **Client Type**: `Public` (for browser-based authentication)
   - **Grant Types**: `authorization_code`
   - **Redirect URI**: `https://webqx.github.io/webqx/provider/openemr-callback.html`
   - **Scopes**: Select all required scopes (see below)

#### Required OAuth2 Scopes
```
openid
fhirUser
patient/Patient.read
patient/Patient.write
patient/Appointment.read
patient/Appointment.write
patient/Encounter.read
patient/Encounter.write
patient/Observation.read
patient/DocumentReference.read
user/Practitioner.read
```

### 2. Configure WebQX™ Portal

#### Update Configuration File
Edit `provider/openemr-config.js`:

```javascript
window.openEMRConfig = {
    // Your OpenEMR instance URL
    baseUrl: 'https://your-openemr.yourorganization.com',
    
    // OAuth2 client ID from step 1
    clientId: 'your-client-id-here',
    
    // Other settings...
};
```

#### Environment Variables (Optional)
Set these environment variables for automated configuration:

```bash
OPENEMR_BASE_URL=https://your-openemr.yourorganization.com
OPENEMR_CLIENT_ID=your-client-id
OPENEMR_CLIENT_SECRET=your-client-secret
```

### 3. Test the Integration

1. Open the WebQX™ Provider Portal
2. Click on **"OpenEMR Patient Management"** module
3. You should see authentication prompt
4. Complete OAuth2 flow
5. OpenEMR should launch successfully

## Launch Modes

The integration supports multiple launch modes:

### Window Mode (Default)
```javascript
window.openEMRLauncher.launchOpenEMR({
    mode: 'window',
    newWindow: true
});
```
- Opens OpenEMR in a new browser window
- Best for full OpenEMR functionality
- Allows multiple windows

### Modal Mode
```javascript
window.openEMRLauncher.launchOpenEMR({
    mode: 'modal'
});
```
- Opens OpenEMR in a modal overlay
- Keeps user within the portal
- Good for quick tasks

### Embedded Mode
```javascript
window.openEMRLauncher.launchOpenEMR({
    mode: 'embed'
});
```
- Embeds OpenEMR directly in the portal
- Seamless integration experience
- Limited screen real estate

### Redirect Mode
```javascript
window.openEMRLauncher.launchOpenEMR({
    mode: 'redirect'
});
```
- Redirects entire browser to OpenEMR
- Full screen OpenEMR experience
- Requires navigation back to portal

## Advanced Configuration

### Custom Launch Context
```javascript
window.openEMRLauncher.launchOpenEMR({
    mode: 'window',
    patient: 'patient-123',      // Pre-select patient
    encounter: 'encounter-456',  // Pre-select encounter
    module: 'appointments'       // Go to specific module
});
```

### Security Settings
```javascript
window.openEMRConfig.security = {
    verifySSL: true,        // Verify SSL certificates
    enablePKCE: true,       // Use PKCE for OAuth2
    timeout: 30000          // Request timeout in ms
};
```

### FHIR Configuration
```javascript
window.openEMRConfig.fhir = {
    enabled: true,
    version: 'R4',
    baseUrl: 'https://your-openemr.com/apis/default/fhir'
};
```

## Troubleshooting

### Common Issues

#### 1. Authentication Fails
**Symptoms**: OAuth2 errors, "Invalid client" messages
**Solutions**:
- Verify client ID and redirect URI in OpenEMR
- Check that OAuth2 is enabled in OpenEMR
- Ensure scopes are properly configured

#### 2. OpenEMR Won't Launch
**Symptoms**: Blank window, loading errors
**Solutions**:
- Check browser popup blocker settings
- Verify OpenEMR URL is accessible
- Check browser console for JavaScript errors

#### 3. FHIR Endpoints Not Working
**Symptoms**: "FHIR not available" messages
**Solutions**:
- Enable FHIR API in OpenEMR globals
- Verify FHIR endpoint URL
- Check FHIR permissions in OAuth2 scopes

#### 4. SSL/Certificate Issues
**Symptoms**: "Certificate error", "SSL handshake failed"
**Solutions**:
- Use valid SSL certificates in production
- Set `verifySSL: false` for development/testing only
- Check certificate chain and validity

### Debug Mode

Enable debug mode for detailed logging:

```javascript
window.openEMRConfig.launch.enableDebug = true;
```

This will log detailed information to the browser console.

### Network Diagnostics

Test network connectivity:

```javascript
// Test basic connectivity
fetch('https://your-openemr.com/apis/default/api/version')
    .then(response => console.log('OpenEMR accessible:', response.ok))
    .catch(error => console.error('Connection failed:', error));

// Test FHIR endpoint
fetch('https://your-openemr.com/apis/default/fhir/metadata')
    .then(response => console.log('FHIR accessible:', response.ok))
    .catch(error => console.error('FHIR failed:', error));
```

## Production Deployment

### Security Checklist
- [ ] Use HTTPS for all endpoints
- [ ] Valid SSL certificates installed
- [ ] OAuth2 scopes minimized to required permissions
- [ ] Client secrets properly secured (if using confidential client)
- [ ] CORS properly configured
- [ ] Audit logging enabled

### Performance Optimization
- [ ] Enable token caching
- [ ] Configure appropriate timeouts
- [ ] Use connection pooling
- [ ] Monitor network latency

### Monitoring
- [ ] Set up health checks
- [ ] Monitor authentication success rates
- [ ] Track API response times
- [ ] Log security events

## Support and Resources

### Documentation
- [OpenEMR Documentation](https://open-emr.org/wiki/)
- [FHIR R4 Specification](https://hl7.org/fhir/R4/)
- [OAuth2 RFC](https://tools.ietf.org/html/rfc6749)

### Community
- [OpenEMR Forums](https://community.open-emr.org/)
- [WebQX™ GitHub Repository](https://github.com/WebQx/webqx)
- [FHIR Implementation Guides](https://www.hl7.org/fhir/implementationguide.html)

### Professional Support
For enterprise support and custom integration services, contact the WebQX™ team at [support@webqx.health](mailto:support@webqx.health).

---

## Example Configurations

### Development Environment
```javascript
window.openEMRConfig = {
    baseUrl: 'https://dev-openemr.yourorganization.com',
    clientId: 'webqx-dev-client',
    security: {
        verifySSL: false,
        enablePKCE: true,
        timeout: 60000
    },
    launch: {
        enableDebug: true,
        defaultMode: 'modal'
    }
};
```

### Production Environment
```javascript
window.openEMRConfig = {
    baseUrl: 'https://openemr.yourorganization.com',
    clientId: 'webqx-prod-client',
    security: {
        verifySSL: true,
        enablePKCE: true,
        timeout: 30000
    },
    launch: {
        enableDebug: false,
        defaultMode: 'window'
    },
    features: {
        enableAudit: true,
        enableSync: true
    }
};
```

This setup guide should help you successfully integrate OpenEMR with the WebQX™ Provider Portal. For additional questions or custom requirements, please refer to the support resources above.
