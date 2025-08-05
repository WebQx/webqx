/**
 * Compliance Middleware
 * 
 * Express middleware for validating compliance requirements on protected routes
 * Integrates with HIPAA, GDPR, and ISO/IEC 27001 services
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express';
import { ComplianceManager } from '../services/complianceManager';
import { 
  ComplianceContext, 
  DataSensitivityLevel, 
  ComplianceStandard,
  ComplianceError 
} from '../types/compliance';

/**
 * Extended Express Request with compliance context
 */
export interface ComplianceRequest extends Request {
  compliance?: {
    context: ComplianceContext;
    validationResults?: {
      compliant: boolean;
      warnings: string[];
      requiredActions: string[];
    };
  };
}

/**
 * Compliance middleware configuration
 */
export interface ComplianceMiddlewareConfig {
  /** Compliance manager instance */
  complianceManager: ComplianceManager;
  
  /** Standards to enforce */
  enforceStandards: ComplianceStandard[];
  
  /** Default sensitivity level if not specified */
  defaultSensitivityLevel: DataSensitivityLevel;
  
  /** Whether to block non-compliant requests */
  blockNonCompliant: boolean;
  
  /** Custom error handler */
  errorHandler?: (error: ComplianceError, req: Request, res: Response) => void;
}

/**
 * Create compliance validation middleware
 */
export function createComplianceMiddleware(config: ComplianceMiddlewareConfig) {
  return async (req: ComplianceRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Extract compliance context from request
      const context = extractComplianceContext(req);
      
      // Attach compliance context to request
      req.compliance = { context };

      // Determine resource sensitivity level
      const sensitivityLevel = determineSensitivityLevel(req, config.defaultSensitivityLevel);

      // Validate compliance for this request
      const validationResult = await config.complianceManager.validateCompliance(context, {
        type: req.method.toLowerCase(),
        resourceType: extractResourceType(req),
        resourceId: extractResourceId(req),
        patientId: extractPatientId(req),
        sensitivityLevel
      });

      if (!validationResult.success) {
        const error: ComplianceError = validationResult.error || {
          code: 'COMPLIANCE_VALIDATION_FAILED',
          message: 'Compliance validation failed',
          standard: 'HIPAA',
          severity: 'high'
        };

        if (config.errorHandler) {
          config.errorHandler(error, req, res);
          return;
        } else {
          res.status(403).json({
            error: 'Compliance validation failed',
            code: error.code,
            message: error.message,
            standard: error.standard
          });
          return;
        }
      }

      // Store validation results
      req.compliance.validationResults = validationResult.data!;

      // If not compliant and blocking is enabled
      if (config.blockNonCompliant && !validationResult.data!.compliant) {
        res.status(403).json({
          error: 'Request blocked due to compliance violations',
          warnings: validationResult.data!.warnings,
          requiredActions: validationResult.data!.requiredActions
        });
        return;
      }

      // Add compliance warnings to response headers (if not blocking)
      if (!validationResult.data!.compliant) {
        res.setHeader('X-Compliance-Warnings', JSON.stringify(validationResult.data!.warnings));
        res.setHeader('X-Compliance-Actions', JSON.stringify(validationResult.data!.requiredActions));
      }

      next();

    } catch (error) {
      console.error('[Compliance Middleware] Validation error:', error);
      
      if (config.blockNonCompliant) {
        res.status(500).json({
          error: 'Compliance validation error',
          message: 'Unable to validate compliance requirements'
        });
      } else {
        // Continue with warning header
        res.setHeader('X-Compliance-Error', 'Validation failed - proceeding with caution');
        next();
      }
    }
  };
}

/**
 * HIPAA-specific middleware for PHI protection
 */
export function hipaaMiddleware(config: { 
  complianceManager: ComplianceManager;
  blockUnauthorized?: boolean;
}) {
  return async (req: ComplianceRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const hipaaService = config.complianceManager.getHIPAAService();
      if (!hipaaService) {
        console.warn('[HIPAA Middleware] HIPAA service not available');
        next();
        return;
      }

      const context = extractComplianceContext(req);
      const patientId = extractPatientId(req);
      
      if (!patientId) {
        // No patient data involved, continue
        next();
        return;
      }

      // Check PHI authorization
      const authResult = await hipaaService.checkPHIAuthorization(
        context,
        patientId,
        mapHttpMethodToPHIAction(req.method),
        determinePHIPurpose(req)
      );

      if (!authResult.success || !authResult.data?.authorized) {
        if (config.blockUnauthorized !== false) {
          res.status(403).json({
            error: 'PHI access denied',
            reason: authResult.data?.reason || 'Insufficient authorization',
            standard: 'HIPAA'
          });
          return;
        }
      }

      // Log PHI access attempt
      await hipaaService.logPHIAccess(context, {
        patientId,
        action: mapHttpMethodToPHIAction(req.method),
        purpose: determinePHIPurpose(req),
        phiType: ['medical_information'], // Would be more specific in real implementation
        accessMethod: 'api',
        systemId: 'webqx-api',
        success: authResult.success && (authResult.data?.authorized || false),
        errorMessage: authResult.data?.reason,
        authorization: {
          granted: authResult.data?.authorized || false,
          grantedBy: 'system',
          grantedAt: new Date(),
          reason: authResult.data?.reason
        },
        context: {
          endpoint: req.path,
          method: req.method,
          userAgent: req.get('User-Agent') || 'unknown'
        }
      });

      next();

    } catch (error) {
      console.error('[HIPAA Middleware] Error:', error);
      
      if (config.blockUnauthorized !== false) {
        res.status(500).json({
          error: 'HIPAA validation error',
          message: 'Unable to validate PHI access authorization'
        });
      } else {
        next();
      }
    }
  };
}

/**
 * GDPR consent validation middleware
 */
export function gdprConsentMiddleware(config: { 
  complianceManager: ComplianceManager;
  requiredConsentTypes: string[];
  blockWithoutConsent?: boolean;
}) {
  return async (req: ComplianceRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const gdprService = config.complianceManager.getGDPRService();
      if (!gdprService) {
        console.warn('[GDPR Middleware] GDPR service not available');
        next();
        return;
      }

      const context = extractComplianceContext(req);
      const subjectId = extractSubjectId(req);
      
      if (!subjectId) {
        // No personal data processing, continue
        next();
        return;
      }

      // Check consent for each required type
      const consentChecks = await Promise.all(
        config.requiredConsentTypes.map(async (consentType) => {
          const result = await gdprService.checkConsent(context, subjectId, consentType as any);
          return {
            consentType,
            hasValidConsent: result.success && result.data?.hasValidConsent,
            error: result.error
          };
        })
      );

      const missingConsents = consentChecks.filter(check => !check.hasValidConsent);

      if (missingConsents.length > 0) {
        if (config.blockWithoutConsent !== false) {
          res.status(403).json({
            error: 'GDPR consent required',
            missingConsents: missingConsents.map(c => c.consentType),
            message: 'Valid consent is required for processing personal data',
            standard: 'GDPR'
          });
          return;
        } else {
          // Add consent warnings to headers
          res.setHeader('X-GDPR-Missing-Consents', JSON.stringify(missingConsents.map(c => c.consentType)));
        }
      }

      next();

    } catch (error) {
      console.error('[GDPR Middleware] Error:', error);
      
      if (config.blockWithoutConsent !== false) {
        res.status(500).json({
          error: 'GDPR consent validation error',
          message: 'Unable to validate consent requirements'
        });
      } else {
        next();
      }
    }
  };
}

/**
 * Enhanced audit logging middleware
 */
export function auditMiddleware(config: { complianceManager: ComplianceManager }) {
  return async (req: ComplianceRequest, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    
    // Capture original response methods
    const originalSend = res.send;
    const originalJson = res.json;
    
    let responseBody: any;
    let responseSize = 0;

    // Override response methods to capture response data
    res.send = function(data: any) {
      responseBody = data;
      responseSize = Buffer.byteLength(data || '', 'utf8');
      return originalSend.call(this, data);
    };

    res.json = function(data: any) {
      responseBody = data;
      responseSize = Buffer.byteLength(JSON.stringify(data || {}), 'utf8');
      return originalJson.call(this, data);
    };

    // Continue with request processing
    next();

    // Log after response is sent
    res.on('finish', async () => {
      try {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        const context = req.compliance?.context || extractComplianceContext(req);
        
        await config.complianceManager.logComplianceEvent(context, 'ISO27001', 'access_control_audit', {
          resourceType: extractResourceType(req),
          resourceId: extractResourceId(req),
          patientId: extractPatientId(req),
          action: `${req.method}_${req.path}`,
          success: res.statusCode < 400,
          sensitivityLevel: determineSensitivityLevel(req, 'internal'),
          riskLevel: determineRiskLevel(req, res),
          errorMessage: res.statusCode >= 400 ? `HTTP ${res.statusCode}` : undefined,
          additionalContext: {
            httpMethod: req.method,
            endpoint: req.path,
            statusCode: res.statusCode,
            responseSize,
            duration,
            queryParams: Object.keys(req.query).length > 0,
            hasBody: !!req.body,
            complianceValidated: !!req.compliance?.validationResults
          }
        });

      } catch (error) {
        console.error('[Audit Middleware] Logging error:', error);
      }
    });
  };
}

// Helper functions

function extractComplianceContext(req: Request): ComplianceContext {
  return {
    userId: (req as any).user?.id || req.get('X-User-ID') || 'anonymous',
    userRole: (req as any).user?.role || req.get('X-User-Role') || 'unknown',
    sessionId: (req as any).sessionID || req.get('X-Session-ID') || 'no-session',
    ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    requestId: req.get('X-Request-ID') || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date()
  };
}

function extractResourceType(req: Request): string {
  // Extract resource type from URL path
  const pathSegments = req.path.split('/').filter(Boolean);
  return pathSegments[1] || pathSegments[0] || 'unknown';
}

function extractResourceId(req: Request): string {
  // Extract resource ID from URL parameters
  const pathSegments = req.path.split('/').filter(Boolean);
  const lastSegment = pathSegments[pathSegments.length - 1];
  
  // Check if last segment looks like an ID
  if (lastSegment && (lastSegment.match(/^\d+$/) || lastSegment.length > 10)) {
    return lastSegment;
  }
  
  // Check URL parameters
  return req.params.id || req.params.resourceId || req.query.id as string || 'unknown';
}

function extractPatientId(req: Request): string | undefined {
  return req.params.patientId || 
         req.params.patient_id || 
         req.query.patientId as string || 
         req.query.patient_id as string ||
         (req.body && req.body.patientId) ||
         (req.body && req.body.patient_id) ||
         undefined;
}

function extractSubjectId(req: Request): string | undefined {
  return extractPatientId(req) || 
         req.params.userId || 
         req.params.user_id ||
         req.query.userId as string ||
         req.query.user_id as string ||
         (req.body && req.body.userId) ||
         (req.body && req.body.user_id) ||
         undefined;
}

function determineSensitivityLevel(req: Request, defaultLevel: DataSensitivityLevel): DataSensitivityLevel {
  // Determine based on endpoint path
  const path = req.path.toLowerCase();
  
  if (path.includes('/patients') || path.includes('/medical') || path.includes('/phi')) {
    return 'restricted';
  }
  
  if (path.includes('/billing') || path.includes('/insurance') || path.includes('/personal')) {
    return 'confidential';
  }
  
  if (path.includes('/public') || path.includes('/health')) {
    return 'public';
  }
  
  return defaultLevel;
}

function determineRiskLevel(req: Request, res: Response): 'low' | 'medium' | 'high' | 'critical' {
  // Determine risk based on various factors
  if (res.statusCode >= 500) return 'high';
  if (res.statusCode >= 400) return 'medium';
  
  const sensitivityLevel = determineSensitivityLevel(req, 'internal');
  if (sensitivityLevel === 'restricted') return 'high';
  if (sensitivityLevel === 'confidential') return 'medium';
  
  return 'low';
}

function mapHttpMethodToPHIAction(method: string): any {
  switch (method.toUpperCase()) {
    case 'GET': return 'view';
    case 'POST': return 'create';
    case 'PUT':
    case 'PATCH': return 'update';
    case 'DELETE': return 'delete';
    default: return 'view';
  }
}

function determinePHIPurpose(req: Request): any {
  // Determine purpose based on endpoint or headers
  const path = req.path.toLowerCase();
  
  if (path.includes('/treatment') || path.includes('/clinical')) {
    return 'treatment';
  }
  
  if (path.includes('/billing') || path.includes('/payment')) {
    return 'payment';
  }
  
  if (path.includes('/quality') || path.includes('/audit')) {
    return 'quality_assurance';
  }
  
  if (path.includes('/research')) {
    return 'research';
  }
  
  return 'healthcare_operations';
}