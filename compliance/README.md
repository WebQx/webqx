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

# WebQX Compliance Framework

This directory contains modular compliance services for HIPAA (US), GDPR (EU), and LGPD (Brazil) standards.

## ✨ Enhanced Features

### HIPAA Compliance ✅
- ✅ PHI (Protected Health Information) protection mechanisms
- ✅ Enhanced access logging for PHI access tracking  
- ✅ Business Associate Agreement (BAA) management
- ✅ Automated breach detection and notification system
- ✅ Role-based access controls
- ✅ Comprehensive audit trails

### GDPR Compliance ✅
- ✅ Consent management system with detailed audit trails
- ✅ Right-to-erasure (right to be forgotten) implementation
- ✅ Consent revocation APIs
- ✅ Data portability support
- ✅ Breach notification requirements
- ✅ Data subject rights management

### LGPD Compliance ✅ **NEW**
- ✅ LGPD service adapting GDPR features for Brazil's requirements
- ✅ Pseudonymization features
- ✅ Explicit consent management for sensitive data
- ✅ Portuguese language support
- ✅ Brazilian timezone handling
- ✅ CPF validation and masking
- ✅ ANPD notification requirements

### Integration Across Modules ✅
- ✅ Compliance middleware for route protection
- ✅ API endpoints for all compliance operations
- ✅ Dynamic enabling/disabling of compliance features
- ✅ Comprehensive test suites (63 tests passing)
- ✅ Configuration management system

## Structure

```
compliance/
├── README.md                    # This file
├── config/                      # Compliance configuration
│   ├── configLoader.ts         # ✅ Dynamic configuration system
│   ├── hipaa.json              # HIPAA-specific settings
│   ├── gdpr.json               # GDPR-specific settings
│   └── lgpd.json               # ✅ LGPD-specific settings
├── services/                    # Core compliance services
│   ├── complianceManager.ts    # ✅ Enhanced compliance orchestrator
│   ├── hipaaService.ts         # ✅ HIPAA compliance service
│   ├── gdprService.ts          # ✅ GDPR compliance service
│   ├── lgpdService.ts          # ✅ LGPD compliance service (NEW)
│   └── iso27001Service.ts      # ISO/IEC 27001 compliance service
├── middleware/                  # Express middleware
│   ├── complianceMiddleware.ts # ✅ Request compliance validation
│   ├── auditMiddleware.ts      # Enhanced audit logging
│   └── consentMiddleware.ts    # Consent validation
├── routes/                      # API endpoints
│   ├── complianceRoutes.ts     # ✅ Main compliance router (NEW)
│   ├── gdprRoutes.ts           # ✅ GDPR-specific endpoints
│   ├── lgpdRoutes.ts           # ✅ LGPD-specific endpoints (NEW)
│   ├── consentRoutes.ts        # Consent management endpoints
│   └── auditRoutes.ts          # Audit access endpoints
├── types/                       # TypeScript definitions
│   ├── compliance.ts           # ✅ Enhanced compliance types
│   ├── hipaa.ts                # HIPAA-specific types
│   ├── gdpr.ts                 # GDPR-specific types
│   ├── lgpd.ts                 # ✅ LGPD-specific types (NEW)
│   └── iso27001.ts             # ISO/IEC 27001 types
├── examples/                    # Integration examples
│   └── integrationExample.ts   # ✅ Complete integration example (NEW)
├── templates/                   # Document templates
│   ├── baa-template.md         # Business Associate Agreement
│   ├── privacy-policy.md       # Privacy policy template
│   └── breach-notification.md  # Breach notification template
└── __tests__/                   # ✅ Comprehensive test suites
    ├── hipaa.test.ts           # ✅ HIPAA tests (18 tests)
    ├── gdpr.test.ts            # ✅ GDPR tests (26 tests)
    └── lgpd.test.ts            # ✅ LGPD tests (26 tests) (NEW)
```

## Quick Start

### 1. Basic Setup

```typescript
import { createConfiguredComplianceManager } from './config/configLoader';
import { createComplianceRoutes } from './routes/complianceRoutes';

// Initialize compliance manager
const complianceManager = await createConfiguredComplianceManager();

// Add to Express app
app.use('/api/compliance', createComplianceRoutes(complianceManager));
```

### 2. Environment Configuration

```bash
# HIPAA Configuration
HIPAA_ENABLED=true
HIPAA_STRICT_MODE=true
HIPAA_PHI_RETENTION_DAYS=2555
HIPAA_AUDIT_RETENTION_DAYS=2555

# GDPR Configuration  
GDPR_ENABLED=true
GDPR_REGION=EU
GDPR_CONSENT_EXPIRY_DAYS=365

# LGPD Configuration
LGPD_ENABLED=true
LGPD_LANGUAGE=pt-BR
LGPD_PSEUDONYMIZATION_REQUIRED=true
LGPD_ELIMINATION_TIMEFRAME_DAYS=15
```

### 3. Route Protection

```typescript
// Protect PHI routes (HIPAA)
app.use('/api/patients', createPHIMiddleware(complianceManager));

// Protect personal data routes (GDPR/LGPD)
app.use('/api/users', createPersonalDataMiddleware(complianceManager));
```

## API Endpoints

### HIPAA Endpoints
- `POST /api/compliance/hipaa/phi-access` - Log PHI access
- `POST /api/compliance/hipaa/authorize` - Check PHI authorization
- `POST /api/compliance/hipaa/breach` - Record HIPAA breach

### GDPR Endpoints  
- `POST /api/compliance/gdpr/consent` - Record consent
- `DELETE /api/compliance/gdpr/consent/:consentId` - Withdraw consent
- `GET /api/compliance/gdpr/consent/:subjectId/:consentType` - Check consent
- `POST /api/compliance/gdpr/subject-request` - Data subject request
- `POST /api/compliance/gdpr/erasure/:requestId` - Right to erasure
- `POST /api/compliance/gdpr/export/:subjectId` - Data portability

### LGPD Endpoints 🇧🇷
- `POST /api/compliance/lgpd/consentimento` - Registrar consentimento
- `DELETE /api/compliance/lgpd/consentimento/:consentId` - Revogar consentimento
- `POST /api/compliance/lgpd/solicitacao-titular` - Direitos do titular
- `POST /api/compliance/lgpd/eliminacao/:requestId` - Eliminação de dados
- `POST /api/compliance/lgpd/pseudonimizacao` - Aplicar pseudonimização
- `POST /api/compliance/lgpd/exportacao/:subjectId` - Portabilidade de dados
- `POST /api/compliance/lgpd/incidente` - Registrar incidente

### Configuration Management
- `GET /api/compliance/config` - Get current configuration
- `PUT /api/compliance/config` - Update configuration
- `POST /api/compliance/standards/:standard/enable` - Enable standard
- `POST /api/compliance/standards/:standard/disable` - Disable standard

## Integration Examples

### HIPAA PHI Protection

```typescript
// Log PHI access
await hipaaService.logPHIAccess(context, {
  patientId: 'patient-123',
  patientMRN: 'MRN-456', 
  phiType: ['medical_information'],
  action: 'view',
  purpose: 'treatment',
  accessMethod: 'api',
  systemId: 'webqx-portal',
  success: true,
  authorization: {
    granted: true,
    grantedBy: 'system',
    grantedAt: new Date()
  }
});
```

### GDPR Consent Management

```typescript
// Record GDPR consent
await gdprService.recordConsent(context, {
  subjectId: 'user-123',
  subjectEmail: 'user@example.com',
  consentType: 'data_processing',
  legalBasis: 'consent',
  granted: true,
  consentText: 'I consent to processing of my personal data',
  purpose: 'Healthcare service provision',
  dataCategories: ['personal_identifiers', 'health_data']
});
```

### LGPD Compliance (Brazilian)

```typescript
// Registrar consentimento LGPD
await lgpdService.recordConsent(context, {
  subjectId: 'titular-123',
  subjectEmail: 'usuario@exemplo.com.br',
  subjectCPF: '123.456.789-00',
  consentType: 'dados_sensiveis',
  legalBasis: 'consentimento',
  granted: true,
  consentText: 'Eu consinto com o tratamento dos meus dados pessoais sensíveis',
  explicitConsent: true, // Required for sensitive data
  pseudonymizationRequired: true,
  language: 'pt-BR'
});
```

## Testing

The compliance framework includes comprehensive test suites:

```bash
# Run all compliance tests (63 tests)
npm test -- compliance/__tests__/

# Run specific standard tests
npm test -- compliance/__tests__/hipaa.test.ts    # 18 tests
npm test -- compliance/__tests__/gdpr.test.ts     # 26 tests  
npm test -- compliance/__tests__/lgpd.test.ts     # 26 tests
```

## Features by Standard

| Feature | HIPAA | GDPR | LGPD |
|---------|-------|------|------|
| Consent Management | ✅ | ✅ | ✅ |
| Access Logging | ✅ | ✅ | ✅ |
| Breach Notification | ✅ | ✅ | ✅ |
| Data Subject Rights | ❌ | ✅ | ✅ |
| Right to Erasure | ❌ | ✅ | ✅ |
| Data Portability | ❌ | ✅ | ✅ |
| Pseudonymization | ❌ | ✅ | ✅ |
| Business Agreements | ✅ (BAA) | ❌ | ❌ |
| Role-based Access | ✅ | ✅ | ✅ |
| Multilingual Support | ❌ | Limited | ✅ (PT-BR) |

## Dynamic Configuration

The framework supports runtime configuration changes:

```typescript
const configLoader = ComplianceConfigLoader.getInstance();

// Enable LGPD compliance
await configLoader.enableStandard('lgpd');

// Update configuration
await configLoader.updateConfig({
  lgpd: {
    enabled: true,
    pseudonymizationRequired: true,
    language: 'pt-BR'
  }
});
```

## Health Monitoring

Check compliance service health:

```bash
curl http://localhost:3000/health/compliance
```

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "services": {
      "hipaa": { "enabled": true, "initialized": true },
      "gdpr": { "enabled": true, "initialized": true },
      "lgpd": { "enabled": true, "initialized": true },
      "iso27001": { "enabled": true, "initialized": true }
    }
  }
}
```