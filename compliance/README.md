# WebQX Compliance Framework

This directory contains modular compliance services for HIPAA (US), GDPR (EU), and ISO/IEC 27001 standards.

## Structure

```
compliance/
├── README.md                    # This file
├── config/                      # Compliance configuration
│   ├── hipaa.json              # HIPAA-specific settings
│   ├── gdpr.json               # GDPR-specific settings
│   └── iso27001.json           # ISO/IEC 27001 settings
├── services/                    # Core compliance services
│   ├── complianceManager.ts    # Main compliance orchestrator
│   ├── hipaaService.ts         # HIPAA compliance service
│   ├── gdprService.ts          # GDPR compliance service
│   ├── iso27001Service.ts      # ISO/IEC 27001 compliance service
│   ├── consentManager.ts       # Consent management
│   ├── breachNotification.ts   # Breach notification system
│   └── encryptionPolicy.ts     # Encryption policy enforcement
├── middleware/                  # Express middleware
│   ├── complianceMiddleware.ts # Request compliance validation
│   ├── auditMiddleware.ts      # Enhanced audit logging
│   └── consentMiddleware.ts    # Consent validation
├── routes/                      # API endpoints
│   ├── gdprRoutes.ts           # GDPR-specific endpoints
│   ├── consentRoutes.ts        # Consent management endpoints
│   └── auditRoutes.ts          # Audit access endpoints
├── types/                       # TypeScript definitions
│   ├── compliance.ts           # Main compliance types
│   ├── hipaa.ts                # HIPAA-specific types
│   ├── gdpr.ts                 # GDPR-specific types
│   └── iso27001.ts             # ISO/IEC 27001 types
├── templates/                   # Document templates
│   ├── baa-template.md         # Business Associate Agreement
│   ├── privacy-policy.md       # Privacy policy template
│   └── breach-notification.md  # Breach notification template
└── __tests__/                   # Compliance tests
    ├── hipaa.test.ts
    ├── gdpr.test.ts
    └── iso27001.test.ts
```

## Features

### HIPAA Compliance
- PHI (Protected Health Information) protection mechanisms
- Enhanced access logging for PHI access tracking
- Business Associate Agreement (BAA) management
- Automated breach detection and notification system

### GDPR Compliance  
- Consent management system with audit trails
- Right-to-erasure (right to be forgotten) implementation
- Consent revocation APIs
- Data portability support

### ISO/IEC 27001 Compliance
- Encryption policy definition and enforcement
- Access control audit system
- Cloud risk assessment and logging
- Security incident management

## Integration

The compliance framework integrates seamlessly with existing WebQX infrastructure:

- **Audit System**: Extends existing `ehr-integrations/services/auditLogger.ts`
- **Authentication**: Works with existing Keycloak/OAuth2 auth system
- **Database**: Compatible with existing PostgreSQL/Redis infrastructure
- **APIs**: RESTful endpoints following WebQX API patterns

## Configuration

Compliance features are configurable and can be enabled/disabled as needed:

```typescript
import { ComplianceManager } from './services/complianceManager';

const compliance = new ComplianceManager({
  hipaa: { enabled: true, strictMode: true },
  gdpr: { enabled: true, region: 'EU' },
  iso27001: { enabled: true, auditLevel: 'detailed' }
});
```

## Usage

```typescript
// Apply compliance middleware to protected routes
app.use('/api/patients', complianceMiddleware, patientRoutes);

// Log PHI access for HIPAA compliance
await hipaaService.logPhiAccess({
  userId: 'user123',
  patientId: 'patient456', 
  action: 'view_record',
  ipAddress: req.ip
});

// Handle GDPR consent
await gdprService.recordConsent({
  userId: 'user123',
  consentType: 'data_processing',
  granted: true
});
```