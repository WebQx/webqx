# 🔐 WebQX™ Authentication & Access Control

The `auth/` directory houses all authentication and access control mechanisms for the WebQX™ healthcare platform. This modular architecture ensures secure, HIPAA-compliant authentication while supporting diverse healthcare roles and provider verification requirements.

## 🏗️ Architecture Overview

The authentication system is designed with healthcare-specific requirements in mind:

- **Role-Based Access Control (RBAC)** for patients, providers, and administrators
- **Provider Verification** with medical license validation
- **Specialty-Aware Access Control** for different medical specialties
- **HIPAA-Compliant** audit logging and session management
- **Modular Design** for easy integration and updates

## 📁 Directory Structure

```
auth/
├── README.md                    # This file - authentication documentation
├── types/                       # TypeScript type definitions
│   └── index.ts                # Core authentication types
├── firebase/                    # Firebase authentication provider
│   ├── index.ts                # Firebase auth service
│   ├── config.ts               # Firebase configuration
│   └── middleware.ts           # Firebase middleware
├── specialty-access-control/    # Healthcare role & specialty access control
│   ├── index.ts                # Access control service
│   ├── roles.ts                # Role definitions and permissions
│   └── specialties.ts          # Medical specialty access rules
└── provider-verification/       # Medical provider verification
    ├── index.ts                # Provider verification service
    ├── license-validator.ts    # Medical license validation
    └── credentials.ts          # Provider credential management
```

## 🚀 Quick Start

### 1. Environment Setup

Create a `.env` file in the project root with the following authentication variables:

```bash
# Firebase Configuration
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id

# Provider Verification
NPDB_API_KEY=your_npdb_api_key
STATE_LICENSE_API_KEY=your_state_license_api_key

# JWT Configuration
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRATION=24h

# Session Configuration
SESSION_SECRET=your_session_secret
SESSION_TIMEOUT=3600000
```

### 2. Initialize Authentication

```typescript
import { AuthService } from './auth';

// Initialize the authentication service
const authService = new AuthService({
  provider: 'firebase', // or 'custom'
  enableProviderVerification: true,
  enableAuditLogging: true,
  specialtyAccess: true
});

// Start authentication service
await authService.initialize();
```

### 3. Basic Usage

```typescript
// User authentication
const user = await authService.authenticate(credentials);

// Provider verification
const isVerified = await authService.verifyProvider(providerId, specialty);

// Role-based access check
const hasAccess = await authService.checkAccess(userId, resource, action);
```

## 🏥 Healthcare-Specific Features

### Provider Verification

The provider verification module validates:

- **Medical License Status** - Active, expired, or revoked licenses
- **Board Certifications** - Specialty-specific certifications
- **DEA Numbers** - For prescription authority verification
- **NPI Numbers** - National Provider Identifier validation
- **Hospital Privileges** - Facility-specific access rights

### Specialty Access Control

Supports fine-grained access control for:

- **Primary Care** - General practice access
- **Radiology** - DICOM/PACS access and imaging tools
- **Cardiology** - Cardiac imaging and monitoring tools
- **Pediatrics** - Age-appropriate interfaces and protocols
- **Oncology** - Cancer treatment protocols and chemotherapy
- **Psychiatry** - Mental health assessment tools
- **Endocrinology** - Diabetes and hormone management
- **Orthopedics** - Musculoskeletal imaging and procedures
- **Neurology** - Neurological assessment and monitoring
- **Gastroenterology** - GI procedures and endoscopy
- **Pulmonology** - Respiratory function and sleep studies
- **Dermatology** - Skin condition imaging and treatment
- **OBGYN** - Women's health and reproductive care

### Patient Access Controls

- **Health Records Access** - Granular consent management
- **Provider Communication** - Secure messaging channels
- **Appointment Scheduling** - Specialty-appropriate booking
- **Lab Results** - Time-delayed release for sensitive results
- **Medication Management** - Prescription access and refills

## 🔒 Security Features

### HIPAA Compliance

- **Audit Logging** - All authentication events are logged
- **Session Management** - Secure session handling with timeout
- **Data Encryption** - All sensitive data encrypted at rest and in transit
- **Access Controls** - Minimum necessary access principles
- **User Activity Tracking** - Comprehensive activity monitoring

### Security Best Practices

- **Multi-Factor Authentication (MFA)** - Required for all provider accounts
- **Password Policies** - Healthcare-grade password requirements
- **Session Timeout** - Automatic logout for inactive sessions
- **Failed Login Protection** - Account lockout after failed attempts
- **IP Whitelisting** - Restrict access to approved locations

## 🔧 Configuration

### Role Configuration

Define roles in `specialty-access-control/roles.ts`:

```typescript
export const HEALTHCARE_ROLES = {
  PATIENT: {
    permissions: ['read:own_records', 'create:appointments'],
    resources: ['patient_portal', 'messaging']
  },
  PROVIDER: {
    permissions: ['read:patient_records', 'write:prescriptions'],
    resources: ['ehr_system', 'clinical_tools']
  },
  NURSE: {
    permissions: ['read:patient_records', 'write:vitals'],
    resources: ['nursing_station', 'patient_monitoring']
  },
  ADMIN: {
    permissions: ['manage:users', 'configure:system'],
    resources: ['admin_console', 'system_settings']
  }
};
```

### Specialty Configuration

Configure specialty-specific access in `specialty-access-control/specialties.ts`:

```typescript
export const SPECIALTY_PERMISSIONS = {
  RADIOLOGY: {
    tools: ['dicom_viewer', 'pacs_access', '3d_reconstruction'],
    protocols: ['imaging_protocols', 'contrast_guidelines']
  },
  CARDIOLOGY: {
    tools: ['ecg_analysis', 'echo_viewer', 'cath_lab'],
    protocols: ['cardiac_protocols', 'intervention_guidelines']
  }
  // ... additional specialties
};
```

## 🧪 Testing

The authentication system includes comprehensive tests:

```bash
# Run all authentication tests
npm test auth/

# Run specific module tests
npm test auth/firebase/
npm test auth/provider-verification/
npm test auth/specialty-access-control/
```

## 🚀 Integration Examples

### Express.js Middleware

```typescript
import { authMiddleware } from './auth/middleware';

// Protect routes with authentication
app.use('/api/patient', authMiddleware.requireAuth);

// Require specific roles
app.use('/api/admin', authMiddleware.requireRole('ADMIN'));

// Require provider verification
app.use('/api/prescriptions', authMiddleware.requireVerifiedProvider);
```

### React Components

```typescript
import { useAuth } from './auth/hooks';

function ProtectedComponent() {
  const { user, isAuthenticated, hasRole } = useAuth();
  
  if (!isAuthenticated) {
    return <LoginComponent />;
  }
  
  if (!hasRole('PROVIDER')) {
    return <UnauthorizedComponent />;
  }
  
  return <ProviderDashboard user={user} />;
}
```

## 📚 API Reference

### AuthService

#### Methods

- `authenticate(credentials)` - Authenticate user with credentials
- `verifyProvider(providerId, specialty)` - Verify medical provider
- `checkAccess(userId, resource, action)` - Check user permissions
- `createSession(user)` - Create authenticated session
- `revokeSession(sessionId)` - Revoke user session
- `auditLog(event, metadata)` - Log authentication events

### Provider Verification

#### Methods

- `validateLicense(licenseNumber, state)` - Validate medical license
- `checkBoardCertification(providerId)` - Check board certifications
- `validateDEA(deaNumber)` - Validate DEA registration
- `verifyNPI(npiNumber)` - Verify National Provider Identifier

## 🔄 Updates and Maintenance

### Adding New Authentication Methods

1. Create new provider directory under `auth/`
2. Implement the `AuthProvider` interface
3. Add configuration options
4. Update the main `AuthService` to support the new provider
5. Add comprehensive tests

### Adding New Specialties

1. Update `specialty-access-control/specialties.ts`
2. Define specialty-specific permissions and tools
3. Update role mappings if needed
4. Add specialty-specific tests

### Security Updates

- Regularly update authentication dependencies
- Review and update security policies
- Conduct periodic security audits
- Monitor authentication logs for suspicious activity

## 🆘 Troubleshooting

### Common Issues

1. **Firebase Connection Issues**
   - Verify Firebase credentials in `.env`
   - Check Firebase project settings
   - Ensure Firebase Auth is enabled

2. **Provider Verification Failures**
   - Verify external API credentials
   - Check provider license status manually
   - Review audit logs for error details

3. **Permission Denied Errors**
   - Check user role assignments
   - Verify specialty permissions
   - Review access control configurations

### Support

For authentication-related issues:
1. Check the audit logs in `/logs/auth.log`
2. Review the troubleshooting section above
3. Contact the WebQX™ development team
4. Submit issues to the GitHub repository

---

**⚠️ Security Notice**: This authentication system handles sensitive healthcare data. Always follow HIPAA guidelines and security best practices when implementing or modifying authentication mechanisms.

---

Built with ❤️ for secure healthcare technology by the WebQX™ team.