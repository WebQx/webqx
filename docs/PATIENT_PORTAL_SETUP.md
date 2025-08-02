# Patient Access Portal - Technical Setup Guide

## Overview

This guide covers the technical setup and configuration of the Patient Access Portal with Microsoft Entra ID integration, email/password authentication, and SMS-based multi-factor authentication.

## Prerequisites

### System Requirements
- Node.js 16+ with npm
- PostgreSQL or compatible database
- Redis (optional, for session storage)
- SSL certificate for production

### Azure Prerequisites
- Microsoft Entra ID tenant
- Azure subscription with Communication Services
- Admin access to configure app registrations

## Configuration

### Environment Variables

Create a `.env` file with the following configurations:

```bash
# Server Configuration
PORT=3000
NODE_ENV=production

# Database Configuration
DATABASE_URL=postgresql://username:password@hostname:port/database_name

# Security & Authentication
JWT_SECRET=your_jwt_secret_key_min_32_characters
ENCRYPTION_KEY=your_encryption_key_for_hipaa_compliance
SESSION_SECRET=your_session_secret_key

# Microsoft Entra ID Configuration
AZURE_PATIENT_TENANT_ID=your_patient_portal_tenant_id
AZURE_PATIENT_CLIENT_ID=your_patient_portal_client_id
AZURE_PATIENT_CLIENT_SECRET=your_patient_portal_client_secret
AZURE_PATIENT_AUTHORITY=https://login.microsoftonline.com/your_tenant_id

# Azure Communication Services (SMS)
AZURE_COMMUNICATION_CONNECTION_STRING=endpoint=https://your-resource.communication.azure.com/;accesskey=your_access_key

# Optional: Separate Provider Portal Configuration
AZURE_PROVIDER_TENANT_ID=your_provider_portal_tenant_id
AZURE_PROVIDER_CLIENT_ID=your_provider_portal_client_id
AZURE_PROVIDER_CLIENT_SECRET=your_provider_portal_client_secret
```

## Azure Entra ID Setup

### 1. App Registration

1. Sign in to the Azure portal
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Configure the application:
   - **Name**: WebQX Patient Portal
   - **Supported account types**: Accounts in this organizational directory only
   - **Redirect URI**: Web - `https://your-domain.com/api/auth/azure/callback`

### 2. Authentication Configuration

1. In the app registration, go to **Authentication**
2. Add redirect URIs:
   - Production: `https://portal.webqx.health/api/auth/azure/callback`
   - Development: `http://localhost:3000/api/auth/azure/callback`
3. Configure logout URL: `https://your-domain.com/logout`
4. Enable **Access tokens** and **ID tokens**

### 3. API Permissions

Add the following Microsoft Graph permissions:
- `User.Read` (Delegated)
- `User.Read.All` (Application, for admin features)
- `Directory.Read.All` (Application, for group membership)
- `openid` (Delegated)
- `profile` (Delegated)
- `email` (Delegated)

### 4. Client Secret

1. Go to **Certificates & secrets**
2. Click **New client secret**
3. Set description: "WebQX Patient Portal Secret"
4. Set expiration as appropriate
5. Copy the secret value (store securely)

## Conditional Access Policies

### 1. Create Patient Portal Policy

1. Navigate to **Azure AD** > **Security** > **Conditional Access**
2. Click **New policy**
3. Configure:
   - **Name**: Patient Portal MFA Policy
   - **Users**: Select patient user groups
   - **Cloud apps**: Select WebQX Patient Portal app
   - **Conditions**: Configure as needed (device, location, risk)
   - **Grant**: Require multi-factor authentication

### 2. Healthcare-Specific Policies

```json
{
  "displayName": "Healthcare Patient Access",
  "state": "enabled",
  "conditions": {
    "applications": {
      "includeApplications": ["your-app-id"]
    },
    "users": {
      "includeGroups": ["healthcare-patients-group-id"]
    },
    "locations": {
      "includeLocations": ["trusted-healthcare-locations"]
    }
  },
  "grantControls": {
    "operator": "AND",
    "builtInControls": [
      "mfa",
      "compliantDevice"
    ]
  }
}
```

## Azure Communication Services Setup

### 1. Create Communication Service Resource

1. In Azure portal, create new **Communication Services** resource
2. Note the connection string
3. Configure phone numbers for SMS

### 2. Phone Number Configuration

1. In Communication Services, go to **Phone numbers**
2. Purchase phone numbers for SMS
3. Configure SMS capabilities
4. Set up toll-free numbers if required

### 3. SMS Configuration

Update the SMS service configuration:

```javascript
// In patient-portal/auth/mfaService.js
const { SmsClient } = require("@azure/communication-sms");

const smsClient = new SmsClient(process.env.AZURE_COMMUNICATION_CONNECTION_STRING);

const sendSMS = async (phoneNumber, message) => {
  try {
    const sendRequest = {
      from: "+1234567890", // Your Azure Communication Services phone number
      to: [phoneNumber],
      message: message
    };

    const sendResults = await smsClient.send(sendRequest);
    
    return {
      success: sendResults[0].successful,
      messageId: sendResults[0].messageId,
      cost: 0.01 // Actual cost from Azure
    };
  } catch (error) {
    console.error('Azure SMS error:', error);
    return {
      success: false,
      error: 'Failed to send SMS',
      code: 'SMS_SEND_FAILED'
    };
  }
};
```

## Database Setup

### User Table Schema

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    mfa_enabled BOOLEAN DEFAULT FALSE,
    account_status VARCHAR(50) DEFAULT 'active',
    azure_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_azure_id ON users(azure_id);
```

### MFA Sessions Table

```sql
CREATE TABLE mfa_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    otp_code VARCHAR(10) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mfa_sessions_user_id ON mfa_sessions(user_id);
CREATE INDEX idx_mfa_sessions_expires_at ON mfa_sessions(expires_at);
```

### SMS Log Table

```sql
CREATE TABLE sms_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    phone_number VARCHAR(20) NOT NULL,
    message_type VARCHAR(50) NOT NULL,
    message_content TEXT NOT NULL,
    status VARCHAR(20) NOT NULL,
    tracking_id VARCHAR(255),
    cost DECIMAL(10,4),
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sms_logs_user_id ON sms_logs(user_id);
CREATE INDEX idx_sms_logs_sent_at ON sms_logs(sent_at);
```

## Security Configuration

### HTTPS Setup

```nginx
server {
    listen 443 ssl http2;
    server_name portal.webqx.health;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

// Authentication endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: 'Too many authentication attempts',
    standardHeaders: true,
    legacyHeaders: false,
});

// MFA endpoints
const mfaLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 3, // 3 OTP requests per minute
    message: 'Too many OTP requests',
});
```

## Monitoring and Logging

### Audit Logging

```javascript
const auditLog = {
    loginAttempt: (email, method, ip, success) => {
        console.log(JSON.stringify({
            event: 'login_attempt',
            email: email,
            method: method,
            ip: ip,
            success: success,
            timestamp: new Date().toISOString()
        }));
    },
    
    mfaAttempt: (userId, success, attemptsRemaining) => {
        console.log(JSON.stringify({
            event: 'mfa_attempt',
            userId: userId,
            success: success,
            attemptsRemaining: attemptsRemaining,
            timestamp: new Date().toISOString()
        }));
    }
};
```

### Health Checks

```javascript
// Add to server.js
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
            database: 'connected',
            azure: 'connected',
            sms: 'connected'
        }
    });
});
```

## Testing

### Running Tests

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run specific patient portal tests
npm test patient-portal/__tests__/patientPortalCore.test.js

# Run with coverage
npm run test:coverage
```

### Test Configuration

Create a test environment file:

```bash
# .env.test
NODE_ENV=test
JWT_SECRET=test-secret-key
AZURE_TENANT_ID=test-tenant
AZURE_CLIENT_ID=test-client
AZURE_CLIENT_SECRET=test-secret
```

## Deployment

### Production Checklist

- [ ] SSL certificate installed and configured
- [ ] Environment variables set securely
- [ ] Database migrations applied
- [ ] Azure app registration configured
- [ ] Conditional access policies enabled
- [ ] SMS service configured and tested
- [ ] Rate limiting enabled
- [ ] Monitoring and logging configured
- [ ] Backup and recovery procedures tested

### Docker Deployment

```dockerfile
FROM node:16-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
EXPOSE 3000

CMD ["npm", "start"]
```

### Kubernetes Configuration

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: patient-portal
spec:
  replicas: 3
  selector:
    matchLabels:
      app: patient-portal
  template:
    metadata:
      labels:
        app: patient-portal
    spec:
      containers:
      - name: patient-portal
        image: webqx/patient-portal:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: patient-portal-secrets
              key: jwt-secret
```

## Troubleshooting

### Common Issues

1. **Azure SSO not working**
   - Check app registration redirect URIs
   - Verify client secret hasn't expired
   - Ensure proper permissions are granted

2. **SMS not sending**
   - Verify Azure Communication Services connection string
   - Check phone number format (E.164)
   - Ensure SMS service has sufficient credits

3. **MFA codes not received**
   - Check phone number validation
   - Verify SMS service configuration
   - Check for carrier blocking

### Logs and Monitoring

```bash
# View application logs
docker logs patient-portal

# Check Azure AD sign-in logs
# Azure Portal > Azure AD > Sign-in logs

# Monitor SMS delivery
# Azure Portal > Communication Services > Insights
```

## Support and Maintenance

### Regular Maintenance Tasks

- Monitor SSL certificate expiration
- Review and rotate client secrets
- Update dependencies regularly
- Review audit logs weekly
- Test backup and recovery procedures monthly

### Emergency Procedures

1. **Service outage**: Use health check endpoints to identify issues
2. **Security incident**: Disable accounts via Azure AD if needed
3. **SMS service failure**: Enable backup notification methods
4. **Database issues**: Ensure backups are current and tested

For technical support, contact the WebQX development team or refer to the project's GitHub repository.