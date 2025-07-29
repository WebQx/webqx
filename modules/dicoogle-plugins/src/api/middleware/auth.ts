/**
 * Authentication and Authorization Middleware for Dicoogle Plugins
 * 
 * Integrates with WebQX's user management and provides RBAC for PACS functionality
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { configManager } from '../../config';

/**
 * User context interface
 */
export interface UserContext {
  userId: string;
  username: string;
  email: string;
  roles: string[];
  organizationId?: string;
  permissions: string[];
  specialty?: string;
  department?: string;
  isActive: boolean;
  lastLoginAt?: Date;
}

/**
 * Extended request interface with user context
 */
export interface AuthenticatedRequest extends Request {
  user?: UserContext;
  organizationId?: string;
  requestId: string;
}

/**
 * Permission definitions for PACS operations
 */
export const PERMISSIONS = {
  // Query permissions
  'pacs:query:basic': 'Basic DICOM query operations',
  'pacs:query:advanced': 'Advanced query with custom filters',
  'pacs:query:all_patients': 'Query all patients across organization',
  'pacs:query:cross_organization': 'Query across multiple organizations',
  
  // Index permissions
  'pacs:index:read': 'Read index configuration and statistics',
  'pacs:index:configure': 'Configure indexing fields and settings',
  'pacs:index:manage': 'Start, stop, and manage indexing jobs',
  'pacs:index:admin': 'Full index administration including backup/restore',
  
  // Filter permissions
  'pacs:filter:create': 'Create custom filters',
  'pacs:filter:share': 'Share filters with other users',
  'pacs:filter:manage': 'Manage organization-wide filters',
  
  // Data access permissions
  'pacs:data:read': 'Read DICOM metadata',
  'pacs:data:download': 'Download DICOM files',
  'pacs:data:upload': 'Upload DICOM files',
  'pacs:data:delete': 'Delete DICOM data',
  
  // System permissions
  'pacs:system:monitor': 'Monitor system performance and statistics',
  'pacs:system:configure': 'Configure system settings',
  'pacs:system:admin': 'Full system administration',
} as const;

/**
 * Role-based permission mappings
 */
export const ROLE_PERMISSIONS = {
  'viewer': [
    'pacs:query:basic',
    'pacs:data:read',
    'pacs:filter:create',
  ],
  'technologist': [
    'pacs:query:basic',
    'pacs:query:advanced',
    'pacs:data:read',
    'pacs:data:upload',
    'pacs:filter:create',
    'pacs:filter:share',
  ],
  'provider': [
    'pacs:query:basic',
    'pacs:query:advanced',
    'pacs:data:read',
    'pacs:data:download',
    'pacs:filter:create',
    'pacs:filter:share',
  ],
  'radiologist': [
    'pacs:query:basic',
    'pacs:query:advanced',
    'pacs:query:all_patients',
    'pacs:data:read',
    'pacs:data:download',
    'pacs:filter:create',
    'pacs:filter:share',
    'pacs:filter:manage',
    'pacs:system:monitor',
  ],
  'admin': [
    'pacs:query:basic',
    'pacs:query:advanced',
    'pacs:query:all_patients',
    'pacs:query:cross_organization',
    'pacs:index:read',
    'pacs:index:configure',
    'pacs:index:manage',
    'pacs:index:admin',
    'pacs:data:read',
    'pacs:data:download',
    'pacs:data:upload',
    'pacs:data:delete',
    'pacs:filter:create',
    'pacs:filter:share',
    'pacs:filter:manage',
    'pacs:system:monitor',
    'pacs:system:configure',
    'pacs:system:admin',
  ],
  'superadmin': Object.keys(PERMISSIONS),
} as const;

/**
 * Rate limiting configuration
 */
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipIf?: (req: Request) => boolean;
}

/**
 * Rate limiting store
 */
class RateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>();
  
  increment(key: string): { count: number; resetTime: number } {
    const now = Date.now();
    const existing = this.store.get(key);
    
    if (!existing || now > existing.resetTime) {
      const entry = { count: 1, resetTime: now + 900000 }; // 15 minutes
      this.store.set(key, entry);
      return entry;
    }
    
    existing.count++;
    this.store.set(key, existing);
    return existing;
  }
  
  reset(key: string): void {
    this.store.delete(key);
  }
  
  cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.store.entries()) {
      if (now > value.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

const rateLimitStore = new RateLimitStore();

// Cleanup rate limit store every 5 minutes
setInterval(() => rateLimitStore.cleanup(), 300000);

/**
 * Authenticate user from WebQX token
 */
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const config = configManager.getSection('auth');
  
  if (!config.enabled) {
    // Authentication disabled, create mock user
    req.user = {
      userId: 'anonymous',
      username: 'anonymous',
      email: 'anonymous@webqx.health',
      roles: ['viewer'],
      permissions: ROLE_PERMISSIONS.viewer,
      isActive: true,
    };
    return next();
  }

  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: 'Authentication token required',
      code: 'AUTH_TOKEN_MISSING',
    });
  }

  try {
    const decoded = jwt.verify(token, config.secretKey || 'fallback-secret') as any;
    
    // Validate token structure
    if (!decoded.userId || !decoded.roles) {
      throw new Error('Invalid token structure');
    }

    // Build user context
    const userPermissions = decoded.roles.flatMap((role: string) => 
      ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] || []
    );

    req.user = {
      userId: decoded.userId,
      username: decoded.username || decoded.userId,
      email: decoded.email || '',
      roles: decoded.roles,
      organizationId: decoded.organizationId,
      permissions: [...new Set(userPermissions)], // Remove duplicates
      specialty: decoded.specialty,
      department: decoded.department,
      isActive: decoded.isActive !== false,
      lastLoginAt: decoded.lastLoginAt ? new Date(decoded.lastLoginAt) : undefined,
    };

    // Set organization context
    req.organizationId = decoded.organizationId;

    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Invalid authentication token',
      code: 'AUTH_TOKEN_INVALID',
      details: error.message,
    });
  }
}

/**
 * Require specific permissions
 */
export function requirePermissions(...requiredPermissions: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    if (!req.user.isActive) {
      return res.status(403).json({
        error: 'Account is inactive',
        code: 'ACCOUNT_INACTIVE',
      });
    }

    const hasAllPermissions = requiredPermissions.every(permission => 
      req.user!.permissions.includes(permission)
    );

    if (!hasAllPermissions) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: requiredPermissions,
        available: req.user.permissions,
      });
    }

    next();
  };
}

/**
 * Require specific roles
 */
export function requireRoles(...requiredRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    const hasRequiredRole = requiredRoles.some(role => 
      req.user!.roles.includes(role)
    );

    if (!hasRequiredRole) {
      return res.status(403).json({
        error: 'Insufficient role privileges',
        code: 'INSUFFICIENT_ROLES',
        required: requiredRoles,
        available: req.user.roles,
      });
    }

    next();
  };
}

/**
 * Organization-based access control
 */
export function requireOrganizationAccess(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
  }

  // Super admins can access any organization
  if (req.user.roles.includes('superadmin')) {
    return next();
  }

  // Check if user has cross-organization permissions
  if (req.user.permissions.includes('pacs:query:cross_organization')) {
    return next();
  }

  // Get requested organization from query params or request body
  const requestedOrgId = req.query.organizationId || req.body.organizationId || req.params.organizationId;

  // If no specific organization requested, use user's organization
  if (!requestedOrgId) {
    req.organizationId = req.user.organizationId;
    return next();
  }

  // Check if user belongs to the requested organization
  if (req.user.organizationId !== requestedOrgId) {
    return res.status(403).json({
      error: 'Access denied to requested organization',
      code: 'ORGANIZATION_ACCESS_DENIED',
      userOrganization: req.user.organizationId,
      requestedOrganization: requestedOrgId,
    });
  }

  req.organizationId = requestedOrgId as string;
  next();
}

/**
 * Rate limiting middleware
 */
export function rateLimit(config: RateLimitConfig) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const securityConfig = configManager.getSection('security');
    
    if (!securityConfig.rateLimiting.enabled) {
      return next();
    }

    if (config.skipIf && config.skipIf(req)) {
      return next();
    }

    // Use user ID or IP address as key
    const key = req.user?.userId || req.ip || 'anonymous';
    const result = rateLimitStore.increment(key);

    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': config.maxRequests.toString(),
      'X-RateLimit-Remaining': Math.max(0, config.maxRequests - result.count).toString(),
      'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
    });

    if (result.count > config.maxRequests) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: result.resetTime - Date.now(),
      });
    }

    next();
  };
}

/**
 * Audit logging middleware
 */
export function auditLog(action: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const config = configManager.getSection('security');
    
    if (!config.enableAuditLogging) {
      return next();
    }

    // Generate request ID for tracking
    req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const auditData = {
      requestId: req.requestId,
      action,
      userId: req.user?.userId,
      username: req.user?.username,
      roles: req.user?.roles,
      organizationId: req.organizationId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date(),
      path: req.path,
      method: req.method,
      query: req.query,
      params: req.params,
    };

    // Log the audit entry
    console.log('[AUDIT]', JSON.stringify(auditData));

    // Store original res.json to capture response
    const originalJson = res.json;
    res.json = function(body: any) {
      // Log response status and basic info
      console.log('[AUDIT_RESPONSE]', JSON.stringify({
        requestId: req.requestId,
        statusCode: res.statusCode,
        success: res.statusCode < 400,
        timestamp: new Date(),
      }));
      
      return originalJson.call(this, body);
    };

    next();
  };
}

/**
 * Request validation middleware
 */
export function validateRequest(schema: any) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Basic validation implementation
    // In a real implementation, this would use a schema validation library like Joi or Yup
    
    const errors: string[] = [];

    // Validate required fields
    if (schema.required) {
      schema.required.forEach((field: string) => {
        const value = req.body[field] || req.query[field] || req.params[field];
        if (value === undefined || value === null || value === '') {
          errors.push(`${field} is required`);
        }
      });
    }

    // Validate field types
    if (schema.types) {
      Object.entries(schema.types).forEach(([field, expectedType]) => {
        const value = req.body[field] || req.query[field] || req.params[field];
        if (value !== undefined && typeof value !== expectedType) {
          errors.push(`${field} must be of type ${expectedType}`);
        }
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors,
      });
    }

    next();
  };
}

/**
 * Error handling middleware
 */
export function errorHandler(error: any, req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  console.error('[ERROR]', {
    requestId: req.requestId,
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.userId,
  });

  // Don't leak sensitive information in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(error.statusCode || 500).json({
    error: error.message || 'Internal server error',
    code: error.code || 'INTERNAL_ERROR',
    requestId: req.requestId,
    ...(isDevelopment && { stack: error.stack }),
  });
}

/**
 * Add request ID to all requests
 */
export function addRequestId(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  res.set('X-Request-ID', req.requestId);
  next();
}

/**
 * CORS middleware for Dicoogle API
 */
export function corsHandler(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];

  if (allowedOrigins.includes(origin || '')) {
    res.header('Access-Control-Allow-Origin', origin);
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
}