# WebQX™ Keycloak-OpenEMR Integration Guide

This guide provides step-by-step instructions for integrating OpenEMR with Keycloak for Single Sign-On (SSO) and centralized authentication in the WebQX healthcare platform.

## Overview

The WebQX Keycloak-OpenEMR integration enables:

- **Single Sign-On (SSO)** across the WebQX platform and OpenEMR
- **Centralized authentication** through Keycloak Identity Provider
- **OAuth2/OpenID Connect** protocol compliance
- **Role-based access control** with healthcare specialties
- **Token validation and exchange** for secure API access
- **Provider verification** with NPI, DEA, and medical license validation

## Prerequisites

### Software Requirements

- **Keycloak** 15.0.0 or higher
- **OpenEMR** 6.0.0 or higher
- **Node.js** 16.0.0 or higher
- **PostgreSQL** 12.0 or higher (for user data)
- **Redis** 6.0 or higher (optional, for caching)

### Network Requirements

- Keycloak server accessible from OpenEMR and WebQX platform
- HTTPS/TLS encryption for production environments
- Firewall rules allowing communication between services

## Installation Steps

### 1. Keycloak Server Setup

#### Install Keycloak

```bash
# Download and extract Keycloak
wget https://github.com/keycloak/keycloak/releases/download/15.0.2/keycloak-15.0.2.tar.gz
tar -xzf keycloak-15.0.2.tar.gz
cd keycloak-15.0.2

# Start Keycloak (development mode)
bin/standalone.sh -Djboss.bind.address=0.0.0.0
```

#### Configure Keycloak Database (Production)

```bash
# Edit standalone.xml to use PostgreSQL
vi standalone/configuration/standalone.xml

# Add datasource configuration
<datasource jndi-name="java:jboss/datasources/KeycloakDS" pool-name="KeycloakDS">
    <connection-url>jdbc:postgresql://localhost:5432/keycloak</connection-url>
    <driver>postgresql</driver>
    <security>
        <user-name>keycloak</user-name>
        <password>password</password>
    </security>
</datasource>
```

### 2. Keycloak Realm Configuration

#### Import WebQX Healthcare Realm

1. Access Keycloak Admin Console: `http://localhost:8080/auth/admin`
2. Create admin user if first time setup
3. Import realm configuration:

```bash
# Import the WebQX Healthcare realm
bin/standalone.sh -Dkeycloak.migration.action=import \
  -Dkeycloak.migration.provider=singleFile \
  -Dkeycloak.migration.file=/path/to/webqx-healthcare-realm.json
```

Or via Admin Console:
1. Select "Add realm"
2. Choose "Import" and upload `config/keycloak/webqx-healthcare-realm.json`
3. Click "Create"

#### Configure Client Secret

1. Navigate to "Clients" → "webqx-openemr"
2. Go to "Credentials" tab
3. Copy the client secret or regenerate a new one
4. Update your environment variables with the secret

### 3. WebQX Platform Configuration

#### Environment Variables

Copy and configure the environment variables:

```bash
cp .env.example .env
```

Update the Keycloak configuration in `.env`:

```env
# Keycloak Configuration
KEYCLOAK_URL=http://localhost:8080/auth
KEYCLOAK_REALM=webqx-healthcare
KEYCLOAK_CLIENT_ID=webqx-openemr
KEYCLOAK_CLIENT_SECRET=your_actual_client_secret_here
KEYCLOAK_PUBLIC_CLIENT=false
KEYCLOAK_BEARER_ONLY=true

# OpenEMR Integration
OPENEMR_BASE_URL=https://your-openemr-instance.com
OPENEMR_CLIENT_ID=webqx-integration
OPENEMR_CLIENT_SECRET=your_openemr_client_secret
OPENEMR_ENABLE_TOKEN_EXCHANGE=true
OPENEMR_ENABLE_ROLE_MAPPING=true
OPENEMR_ENABLE_PROVIDER_VERIFICATION=true
```

#### Install Dependencies

```bash
npm install
```

#### Start WebQX Platform

```bash
npm start
```

### 4. OpenEMR Configuration

#### Copy Configuration File

```bash
# Copy the Keycloak configuration to OpenEMR
cp config/openemr/keycloak-config.php /path/to/openemr/sites/default/config/
```

#### Update OpenEMR Configuration

Edit the configuration file to match your environment:

```php
// In /path/to/openemr/sites/default/config/keycloak-config.php

$GLOBALS['oauth2_keycloak_config'] = array(
    'enabled' => true,
    'server_url' => 'http://localhost:8080/auth',
    'realm' => 'webqx-healthcare',
    'client_id' => 'webqx-openemr',
    'client_secret' => 'your_actual_client_secret_here',
    // ... other settings
);
```

#### Enable OAuth2 in OpenEMR

1. Access OpenEMR Admin: `https://your-openemr.com/interface/login/login.php`
2. Navigate to "Administration" → "Globals" → "Security"
3. Enable "OAuth2 Authentication"
4. Set "OAuth2 Provider" to "Keycloak"
5. Save configuration

### 5. User Management

#### Create Healthcare Users in Keycloak

1. Access Keycloak Admin Console
2. Navigate to "Users" in the webqx-healthcare realm
3. Click "Add user"
4. Fill in user details:

```
Username: john.doe
Email: john.doe@hospital.com
First Name: John
Last Name: Doe
Email Verified: Yes
```

5. Set password in "Credentials" tab
6. Assign roles in "Role Mappings" tab:
   - For physicians: `healthcare-provider`, `primary-care-physician`
   - For nurses: `nurse`
   - For patients: `patient`

#### Configure User Attributes

Add healthcare-specific attributes:

1. Go to user details
2. Click "Attributes" tab
3. Add attributes:

```
npi_number: 1234567890
medical_license: MD123456
dea_number: AB1234567 (for prescribing providers)
specialty: PRIMARY_CARE
department: Internal Medicine
provider_verification_status: VERIFIED
```

### 6. Testing the Integration

#### Test Authentication Flow

1. Access WebQX platform: `http://localhost:3000`
2. Click "Login with Keycloak"
3. Enter Keycloak credentials
4. Verify successful authentication and token exchange

#### Test API Access

```bash
# Get token from Keycloak
curl -X POST "http://localhost:8080/auth/realms/webqx-healthcare/protocol/openid_connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=webqx-openemr" \
  -d "client_secret=your_client_secret" \
  -d "username=john.doe" \
  -d "password=password"

# Use token to access WebQX API
curl -X GET "http://localhost:3000/api/patient/123" \
  -H "Authorization: Bearer your_access_token"
```

#### Test OpenEMR Integration

1. Access OpenEMR with Keycloak authentication
2. Verify user roles and permissions are correctly mapped
3. Test FHIR API access with Keycloak tokens

## Security Configuration

### HTTPS/TLS Setup

#### Keycloak HTTPS

```bash
# Generate keystore for Keycloak
keytool -genkey -alias keycloak -keyalg RSA -keystore keycloak.jks -keysize 2048

# Configure standalone.xml
<security-realm name="ApplicationRealm">
    <server-identities>
        <ssl>
            <keystore path="keycloak.jks" relative-to="jboss.server.config.dir" 
                     keystore-password="password" alias="keycloak" key-password="password"/>
        </ssl>
    </server-identities>
</security-realm>
```

#### WebQX Platform HTTPS

```bash
# Generate SSL certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365

# Update server.js to use HTTPS
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

https.createServer(options, app).listen(443);
```

### Firewall Configuration

```bash
# Allow Keycloak port
sudo ufw allow 8080/tcp

# Allow WebQX platform port
sudo ufw allow 3000/tcp

# Allow HTTPS
sudo ufw allow 443/tcp
```

## Monitoring and Maintenance

### Health Checks

Set up monitoring for key endpoints:

```bash
# Keycloak health check
curl http://localhost:8080/auth/realms/webqx-healthcare/.well-known/openid_connect_configuration

# WebQX platform health check
curl http://localhost:3000/health

# OpenEMR health check
curl https://your-openemr.com/apis/default/api/facility
```

### Log Monitoring

Monitor logs for authentication events:

```bash
# Keycloak logs
tail -f keycloak-15.0.2/standalone/log/server.log

# WebQX platform logs
tail -f logs/webqx-platform.log

# OpenEMR logs
tail -f /var/log/apache2/error.log
```

### Token Rotation

Set up automatic token rotation:

1. Configure shorter token lifespans in Keycloak
2. Implement refresh token logic in client applications
3. Monitor token expiration and renewal

## Troubleshooting

### Common Issues

#### 1. Token Validation Fails

**Symptoms**: 401 Unauthorized errors when accessing APIs

**Solutions**:
- Verify Keycloak server is accessible
- Check client ID and secret configuration
- Validate token expiration and clock synchronization
- Ensure HTTPS is properly configured

```bash
# Debug token validation
curl -X POST "http://localhost:8080/auth/realms/webqx-healthcare/protocol/openid_connect/token/introspect" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "token=your_access_token" \
  -d "client_id=webqx-openemr" \
  -d "client_secret=your_client_secret"
```

#### 2. Role Mapping Issues

**Symptoms**: Users have incorrect permissions in OpenEMR

**Solutions**:
- Verify role assignments in Keycloak
- Check role mapping configuration in both systems
- Ensure user attributes are properly configured

#### 3. CORS Errors

**Symptoms**: Browser blocks requests between WebQX and Keycloak

**Solutions**:
- Configure CORS settings in Keycloak client
- Update WebQX CORS configuration
- Ensure all origins are properly whitelisted

#### 4. Provider Verification Failures

**Symptoms**: Verified providers cannot access system

**Solutions**:
- Check NPI number format and validation
- Verify medical license attributes
- Ensure verification status is set correctly

### Debugging Tools

#### Enable Debug Logging

In WebQX platform:
```javascript
// In .env file
KEYCLOAK_ENABLE_LOGGING=true
NODE_ENV=development
```

In Keycloak:
```xml
<!-- In standalone.xml -->
<logger category="org.keycloak">
    <level name="DEBUG"/>
</logger>
```

#### JWT Token Inspection

Use [jwt.io](https://jwt.io) to decode and inspect JWT tokens for debugging.

## Production Deployment

### Performance Optimization

1. **Database Tuning**: Optimize PostgreSQL for Keycloak
2. **Caching**: Enable Redis for token caching
3. **Load Balancing**: Use nginx or HAProxy for multiple instances
4. **CDN**: Serve static assets through CDN

### Backup and Recovery

1. **Database Backups**: Regular PostgreSQL backups
2. **Configuration Backups**: Version control all configuration files
3. **Certificate Management**: Automated SSL certificate renewal

### Security Hardening

1. **Network Segmentation**: Isolate authentication services
2. **Access Control**: Implement IP whitelisting where possible
3. **Audit Logging**: Enable comprehensive audit logging
4. **Penetration Testing**: Regular security assessments

## Support and Resources

### Documentation Links

- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [OpenEMR Documentation](https://open-emr.org/wiki/index.php/OpenEMR_Wiki_Home_Page)
- [OAuth2/OpenID Connect Specification](https://openid.net/connect/)

### WebQX Support

- **GitHub Issues**: [WebQX Repository Issues](https://github.com/WebQx/webqx/issues)
- **Documentation**: [WebQX Documentation](https://webqx.health/docs)
- **Community Forum**: [WebQX Community](https://community.webqx.health)

### Healthcare Compliance

- [HIPAA Compliance Guide](https://www.hhs.gov/hipaa/index.html)
- [FHIR Security Guidelines](https://www.hl7.org/fhir/security.html)
- [Healthcare Data Protection Best Practices](https://www.healthit.gov/topic/privacy-security-and-hipaa)