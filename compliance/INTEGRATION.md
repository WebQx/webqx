# WebQX Compliance Framework Integration Guide

This guide demonstrates how to integrate the WebQX compliance framework into your healthcare application.

## Quick Start

### 1. Basic Setup

```typescript
import express from 'express';
import { ComplianceManager } from './compliance/services/complianceManager';
import { 
  createComplianceMiddleware,
  hipaaMiddleware,
  gdprConsentMiddleware,
  auditMiddleware 
} from './compliance/middleware/complianceMiddleware';
import { createGDPRRoutes } from './compliance/routes/gdprRoutes';
import { AuditLogger } from './ehr-integrations/services/auditLogger';

// Initialize compliance manager
const auditLogger = new AuditLogger({
  enabled: true,
  maxInMemoryEntries: 10000,
  retentionDays: 2555, // 7 years HIPAA requirement
  logToConsole: true,
  logToFile: false,
  logToExternalService: false,
  externalServiceEndpoint: '[NOT_CONFIGURED]'
});

const complianceManager = new ComplianceManager({
  hipaa: {
    enabled: true,
    strictMode: true,
    breachNotificationEmail: 'compliance@webqx.health',
    phiRetentionDays: 2555,
    auditRetentionDays: 2555
  },
  gdpr: {
    enabled: true,
    region: 'EU',
    dataProcessingLegalBasis: 'consent',
    consentExpiryDays: 365,
    erasureTimeframeDays: 30
  },
  iso27001: {
    enabled: true,
    auditLevel: 'detailed',
    riskAssessmentInterval: 365,
    incidentResponseEnabled: true
  }
}, auditLogger);

// Initialize services
await complianceManager.initialize();

const app = express();

// Global compliance middleware
app.use(auditMiddleware({ complianceManager }));

// GDPR routes
app.use('/api/gdpr', createGDPRRoutes({ complianceManager }));
```

### 2. Protecting Patient Data Endpoints

```typescript
// Apply HIPAA compliance to patient routes
app.use('/api/patients',
  hipaaMiddleware({ 
    complianceManager,
    blockUnauthorized: true 
  }),
  patientRoutes
);

// Apply GDPR consent validation
app.use('/api/users',
  gdprConsentMiddleware({
    complianceManager,
    requiredConsentTypes: ['data_processing', 'medical_treatment'],
    blockWithoutConsent: true
  }),
  userRoutes
);

// Apply comprehensive compliance validation
app.use('/api/medical-records',
  createComplianceMiddleware({
    complianceManager,
    enforceStandards: ['HIPAA', 'GDPR', 'ISO27001'],
    defaultSensitivityLevel: 'restricted',
    blockNonCompliant: true
  }),
  medicalRecordsRoutes
);
```

## Advanced Usage Examples

### Manual PHI Access Logging

```typescript
import { PHIAction, PHIPurpose } from './compliance/types/hipaa';

app.get('/api/patients/:patientId/records', async (req, res) => {
  const hipaaService = complianceManager.getHIPAAService();
  const context = {
    userId: req.user.id,
    userRole: req.user.role,
    sessionId: req.sessionID,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.get('X-Request-ID'),
    timestamp: new Date()
  };

  // Check authorization
  const authResult = await hipaaService?.checkPHIAuthorization(
    context,
    req.params.patientId,
    'view' as PHIAction,
    'treatment' as PHIPurpose
  );

  if (!authResult?.success || !authResult.data?.authorized) {
    return res.status(403).json({
      error: 'PHI access denied',
      reason: authResult?.data?.reason
    });
  }

  // Log the access
  await hipaaService?.logPHIAccess(context, {
    patientId: req.params.patientId,
    patientMRN: 'MRN-' + req.params.patientId,
    phiType: ['medical_information'],
    action: 'view',
    purpose: 'treatment',
    accessMethod: 'api',
    systemId: 'webqx-patient-portal',
    success: true,
    authorization: {
      granted: true,
      grantedBy: 'system',
      grantedAt: new Date()
    },
    context: {
      endpoint: req.path,
      method: req.method
    }
  });

  // Fetch and return patient records
  const records = await getPatientRecords(req.params.patientId);
  res.json(records);
});
```

### GDPR Consent Management

```typescript
import { ConsentType, LegalBasis } from './compliance/types/gdpr';

// Consent recording endpoint
app.post('/api/consent', async (req, res) => {
  const gdprService = complianceManager.getGDPRService();
  const context = extractComplianceContext(req);

  const result = await gdprService?.recordConsent(context, {
    subjectId: req.body.userId,
    subjectEmail: req.body.email,
    consentType: req.body.consentType as ConsentType,
    legalBasis: 'consent' as LegalBasis,
    purpose: req.body.purpose,
    dataCategories: req.body.dataCategories,
    processingActivities: req.body.processingActivities || [],
    granted: req.body.granted,
    consentMethod: 'explicit',
    captureMethod: 'web_form',
    policyVersion: '2024-v1',
    consentVersion: '1.0',
    renewalRequired: false,
    metadata: {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  if (!result?.success) {
    return res.status(400).json({
      error: 'Failed to record consent',
      details: result?.error
    });
  }

  res.status(201).json({
    success: true,
    consentId: result.data?.consentId,
    message: 'Consent recorded successfully'
  });
});

// Right to erasure implementation
app.delete('/api/users/:userId/data', async (req, res) => {
  const gdprService = complianceManager.getGDPRService();
  const context = extractComplianceContext(req);

  // Create erasure request
  const requestResult = await gdprService?.handleDataSubjectRequest(context, {
    type: 'erasure',
    subjectId: req.params.userId,
    subjectEmail: req.body.email,
    requestDate: new Date(),
    description: 'User requested account deletion',
    status: 'submitted',
    communications: []
  });

  if (!requestResult?.success) {
    return res.status(400).json({
      error: 'Failed to create erasure request',
      details: requestResult?.error
    });
  }

  // Process the erasure
  const erasureResult = await gdprService?.processErasureRequest(
    context,
    requestResult.data!.requestId
  );

  if (!erasureResult?.success) {
    return res.status(500).json({
      error: 'Failed to process erasure request',
      details: erasureResult?.error
    });
  }

  res.json({
    success: true,
    deletedRecords: erasureResult.data?.deletedRecords,
    pendingDeletions: erasureResult.data?.pendingDeletions,
    message: 'Data erasure completed successfully'
  });
});
```

### ISO 27001 Security Controls

```typescript
// Security incident reporting
app.post('/api/security/incidents', async (req, res) => {
  const iso27001Service = complianceManager.getISO27001Service();
  const context = extractComplianceContext(req);

  // Only allow security team to report incidents
  if (!['security_officer', 'admin', 'ciso'].includes(context.userRole)) {
    return res.status(403).json({
      error: 'Access denied',
      message: 'Only security personnel can report incidents'
    });
  }

  const result = await iso27001Service?.recordSecurityIncident(context, {
    title: req.body.title,
    description: req.body.description,
    category: req.body.category,
    severity: req.body.severity,
    detectedAt: new Date(req.body.detectedAt),
    detectedBy: context.userId,
    detectionMethod: req.body.detectionMethod || 'manual',
    classification: 'security_incident',
    impactAssessment: req.body.impactAssessment,
    affectedAssets: req.body.affectedAssets || [],
    metadata: {
      reportedVia: 'api',
      reportingSystem: 'webqx-security-portal'
    }
  });

  if (!result?.success) {
    return res.status(400).json({
      error: 'Failed to record security incident',
      details: result?.error
    });
  }

  res.status(201).json({
    success: true,
    incidentId: result.data?.incidentId,
    message: 'Security incident recorded successfully'
  });
});

// Cloud activity logging
app.use('/api/cloud/*', async (req, res, next) => {
  const iso27001Service = complianceManager.getISO27001Service();
  const context = extractComplianceContext(req);

  // Log cloud API access
  await iso27001Service?.logCloudActivity(context, {
    service: req.params[0].split('/')[0] || 'unknown',
    action: req.method.toLowerCase(),
    resource: req.path,
    riskLevel: determinateCloudRiskLevel(req),
    metadata: {
      endpoint: req.path,
      queryParams: Object.keys(req.query).length,
      hasBody: !!req.body
    }
  });

  next();
});
```

### Business Associate Agreement Management

```typescript
// BAA creation endpoint (admin only)
app.post('/api/hipaa/baa', async (req, res) => {
  const hipaaService = complianceManager.getHIPAAService();
  const context = extractComplianceContext(req);

  // Check admin privileges
  if (!['admin', 'compliance_officer', 'privacy_officer'].includes(context.userRole)) {
    return res.status(403).json({
      error: 'Access denied',
      message: 'Only authorized personnel can manage BAAs'
    });
  }

  const result = await hipaaService?.manageBBA(context, 'create', {
    organizationName: req.body.organizationName,
    contactPerson: req.body.contactPerson,
    contactEmail: req.body.contactEmail,
    contactPhone: req.body.contactPhone,
    agreementType: req.body.agreementType || 'standard',
    signedDate: new Date(req.body.signedDate),
    effectiveDate: new Date(req.body.effectiveDate),
    expirationDate: new Date(req.body.expirationDate),
    servicesDescription: req.body.servicesDescription,
    phiTypesAccessed: req.body.phiTypesAccessed || [],
    documentUrl: req.body.documentUrl,
    signatureHash: req.body.signatureHash
  });

  if (!result?.success) {
    return res.status(400).json({
      error: 'Failed to create BAA',
      details: result?.error
    });
  }

  res.status(201).json({
    success: true,
    baaId: result.data?.baaId,
    message: 'Business Associate Agreement created successfully'
  });
});
```

## Monitoring and Reporting

### Compliance Dashboard Endpoints

```typescript
// Compliance status overview
app.get('/api/compliance/status', async (req, res) => {
  const context = extractComplianceContext(req);
  
  // Get recent audit entries
  const auditResult = await complianceManager.searchComplianceAudit(context, {
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
    limit: 100
  });

  const status = {
    standards: {
      hipaa: {
        enabled: complianceManager.getHIPAAService() !== undefined,
        status: 'compliant',
        lastAssessment: new Date()
      },
      gdpr: {
        enabled: complianceManager.getGDPRService() !== undefined,
        status: 'compliant',
        lastAssessment: new Date()
      },
      iso27001: {
        enabled: complianceManager.getISO27001Service() !== undefined,
        status: 'compliant',
        lastAssessment: new Date()
      }
    },
    recentActivity: auditResult.success ? auditResult.data?.entries.slice(0, 10) : [],
    summary: {
      totalEvents: auditResult.data?.total || 0,
      riskLevels: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
      }
    }
  };

  res.json(status);
});

// Generate compliance reports
app.post('/api/compliance/reports', async (req, res) => {
  const context = extractComplianceContext(req);
  
  const reportResult = await complianceManager.generateComplianceReport(
    context,
    req.body.reportType || 'summary',
    {
      startDate: new Date(req.body.startDate),
      endDate: new Date(req.body.endDate)
    },
    req.body.standards
  );

  if (!reportResult.success) {
    return res.status(400).json({
      error: 'Failed to generate report',
      details: reportResult.error
    });
  }

  res.json({
    success: true,
    reportId: reportResult.data?.reportId,
    downloadUrl: reportResult.data?.downloadUrl,
    message: 'Compliance report generated successfully'
  });
});
```

### Health Check Endpoints

```typescript
// Overall compliance health check
app.get('/api/compliance/health', (req, res) => {
  const hipaaEnabled = complianceManager.getHIPAAService() !== undefined;
  const gdprEnabled = complianceManager.getGDPRService() !== undefined;
  const iso27001Enabled = complianceManager.getISO27001Service() !== undefined;

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      hipaa: hipaaEnabled ? 'active' : 'disabled',
      gdpr: gdprEnabled ? 'active' : 'disabled',
      iso27001: iso27001Enabled ? 'active' : 'disabled'
    },
    features: {
      phiProtection: hipaaEnabled,
      breachDetection: hipaaEnabled,
      consentManagement: gdprEnabled,
      dataSubjectRights: gdprEnabled,
      riskAssessment: iso27001Enabled,
      securityControls: iso27001Enabled,
      auditLogging: true,
      complianceReporting: true
    }
  });
});
```

## Utility Functions

```typescript
// Helper function to extract compliance context
function extractComplianceContext(req: any): ComplianceContext {
  return {
    userId: req.user?.id || req.get('X-User-ID') || 'anonymous',
    userRole: req.user?.role || req.get('X-User-Role') || 'unknown',
    sessionId: req.sessionID || req.get('X-Session-ID') || 'no-session',
    ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    requestId: req.get('X-Request-ID') || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date()
  };
}

// Helper function to determine cloud risk level
function determinateCloudRiskLevel(req: any): 'low' | 'medium' | 'high' | 'very_high' {
  const path = req.path.toLowerCase();
  
  if (path.includes('/admin') || path.includes('/delete')) return 'high';
  if (path.includes('/create') || path.includes('/update')) return 'medium';
  if (req.method === 'GET') return 'low';
  
  return 'medium';
}
```

## Configuration Examples

### Environment-based Configuration

```typescript
// config/compliance.ts
export const complianceConfig = {
  hipaa: {
    enabled: process.env.HIPAA_ENABLED === 'true',
    strictMode: process.env.HIPAA_STRICT_MODE === 'true',
    breachNotificationEmail: process.env.HIPAA_BREACH_EMAIL || 'compliance@webqx.health',
    phiRetentionDays: parseInt(process.env.HIPAA_PHI_RETENTION_DAYS || '2555'),
    auditRetentionDays: parseInt(process.env.HIPAA_AUDIT_RETENTION_DAYS || '2555')
  },
  gdpr: {
    enabled: process.env.GDPR_ENABLED === 'true',
    region: (process.env.GDPR_REGION as 'EU' | 'UK' | 'GLOBAL') || 'EU',
    dataProcessingLegalBasis: process.env.GDPR_LEGAL_BASIS || 'consent',
    consentExpiryDays: parseInt(process.env.GDPR_CONSENT_EXPIRY_DAYS || '365'),
    erasureTimeframeDays: parseInt(process.env.GDPR_ERASURE_TIMEFRAME_DAYS || '30')
  },
  iso27001: {
    enabled: process.env.ISO27001_ENABLED === 'true',
    auditLevel: (process.env.ISO27001_AUDIT_LEVEL as 'basic' | 'detailed' | 'comprehensive') || 'detailed',
    riskAssessmentInterval: parseInt(process.env.ISO27001_RISK_ASSESSMENT_INTERVAL || '365'),
    incidentResponseEnabled: process.env.ISO27001_INCIDENT_RESPONSE === 'true'
  }
};
```

### Docker Environment Variables

```bash
# .env file for Docker deployment
HIPAA_ENABLED=true
HIPAA_STRICT_MODE=true
HIPAA_BREACH_EMAIL=compliance@webqx.health
HIPAA_PHI_RETENTION_DAYS=2555
HIPAA_AUDIT_RETENTION_DAYS=2555

GDPR_ENABLED=true
GDPR_REGION=EU
GDPR_LEGAL_BASIS=consent
GDPR_CONSENT_EXPIRY_DAYS=365
GDPR_ERASURE_TIMEFRAME_DAYS=30

ISO27001_ENABLED=true
ISO27001_AUDIT_LEVEL=detailed
ISO27001_RISK_ASSESSMENT_INTERVAL=365
ISO27001_INCIDENT_RESPONSE=true
```

This integration guide provides comprehensive examples for implementing the WebQX compliance framework in your healthcare application. The framework is designed to be flexible, configurable, and production-ready while maintaining compatibility with existing WebQX infrastructure.