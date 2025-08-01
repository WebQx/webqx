import { Request, Response, NextFunction } from 'express';
import { body, validationResult, ValidationChain } from 'express-validator';
import { SSOValidationError } from '../types/common';

/**
 * Validation middleware for SSO requests
 */
export class ValidationMiddleware {
  /**
   * Validate OAuth2 callback request
   */
  static validateOAuth2Callback(): ValidationChain[] {
    return [
      body('code')
        .notEmpty()
        .withMessage('Authorization code is required')
        .isLength({ min: 1, max: 2048 })
        .withMessage('Invalid authorization code length'),
      
      body('state')
        .optional()
        .isLength({ min: 1, max: 256 })
        .withMessage('Invalid state parameter length'),
      
      body('error')
        .optional()
        .isString()
        .withMessage('Error parameter must be a string'),
      
      body('error_description')
        .optional()
        .isString()
        .withMessage('Error description must be a string')
    ];
  }

  /**
   * Validate SAML callback request
   */
  static validateSAMLCallback(): ValidationChain[] {
    return [
      body('SAMLResponse')
        .notEmpty()
        .withMessage('SAML response is required')
        .isBase64()
        .withMessage('SAML response must be base64 encoded'),
      
      body('RelayState')
        .optional()
        .isLength({ min: 1, max: 256 })
        .withMessage('Invalid relay state length')
    ];
  }

  /**
   * Validate provider parameter
   */
  static validateProvider(): ValidationChain[] {
    return [
      body('provider')
        .notEmpty()
        .withMessage('Provider is required')
        .isAlphanumeric()
        .withMessage('Provider name must be alphanumeric')
        .isLength({ min: 1, max: 50 })
        .withMessage('Provider name must be between 1 and 50 characters')
    ];
  }

  /**
   * Validate email format
   */
  static validateEmail(): ValidationChain[] {
    return [
      body('email')
        .isEmail()
        .withMessage('Valid email address is required')
        .normalizeEmail()
    ];
  }

  /**
   * Validate session ID
   */
  static validateSessionId(): ValidationChain[] {
    return [
      body('sessionId')
        .notEmpty()
        .withMessage('Session ID is required')
        .matches(/^sess_[a-zA-Z0-9]+$/)
        .withMessage('Invalid session ID format')
    ];
  }

  /**
   * Sanitize and validate redirect URI
   */
  static validateRedirectUri(): ValidationChain[] {
    return [
      body('redirectUri')
        .optional()
        .isURL({
          protocols: ['http', 'https'],
          require_protocol: true
        })
        .withMessage('Invalid redirect URI')
        .custom((value) => {
          // Additional security checks for redirect URI
          const url = new URL(value);
          
          // Prevent open redirects to external domains
          const allowedDomains = process.env.ALLOWED_REDIRECT_DOMAINS?.split(',') || [];
          if (allowedDomains.length > 0 && !allowedDomains.includes(url.hostname)) {
            throw new Error('Redirect URI domain not allowed');
          }
          
          return true;
        })
    ];
  }

  /**
   * Validate JWT token format
   */
  static validateJWTToken(): ValidationChain[] {
    return [
      body('token')
        .notEmpty()
        .withMessage('Token is required')
        .matches(/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/)
        .withMessage('Invalid JWT token format')
    ];
  }

  /**
   * Validate user roles
   */
  static validateRoles(): ValidationChain[] {
    return [
      body('roles')
        .optional()
        .isArray()
        .withMessage('Roles must be an array')
        .custom((roles) => {
          if (roles.length > 50) {
            throw new Error('Too many roles specified');
          }
          
          roles.forEach((role: any) => {
            if (typeof role !== 'string' || role.length > 100) {
              throw new Error('Invalid role format');
            }
          });
          
          return true;
        })
    ];
  }

  /**
   * Validate user groups
   */
  static validateGroups(): ValidationChain[] {
    return [
      body('groups')
        .optional()
        .isArray()
        .withMessage('Groups must be an array')
        .custom((groups) => {
          if (groups.length > 100) {
            throw new Error('Too many groups specified');
          }
          
          groups.forEach((group: any) => {
            if (typeof group !== 'string' || group.length > 200) {
              throw new Error('Invalid group format');
            }
          });
          
          return true;
        })
    ];
  }

  /**
   * Middleware to handle validation errors
   */
  static handleValidationErrors() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const errors = validationResult(req);
      
      if (!errors.isEmpty()) {
        const validationError = new SSOValidationError('Validation failed');
        
        res.status(400).json({
          error: 'Validation failed',
          message: validationError.message,
          code: validationError.code,
          details: errors.array()
        });
        
        return;
      }
      
      next();
    };
  }

  /**
   * Sanitize user input to prevent XSS and injection attacks
   */
  static sanitizeInput() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const sanitizeString = (str: string): string => {
        return str
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<.*?>/g, '')
          .trim();
      };

      const sanitizeObject = (obj: any): any => {
        if (typeof obj === 'string') {
          return sanitizeString(obj);
        }
        
        if (Array.isArray(obj)) {
          return obj.map(sanitizeObject);
        }
        
        if (obj && typeof obj === 'object') {
          const sanitized: any = {};
          for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
              sanitized[key] = sanitizeObject(obj[key]);
            }
          }
          return sanitized;
        }
        
        return obj;
      };

      // Sanitize request body
      if (req.body) {
        req.body = sanitizeObject(req.body);
      }

      // Sanitize query parameters
      if (req.query) {
        req.query = sanitizeObject(req.query);
      }

      next();
    };
  }

  /**
   * Rate limiting validation
   */
  static validateRateLimit() {
    const requestCounts = new Map<string, { count: number; resetTime: number }>();
    const maxRequests = 100;
    const windowMs = 15 * 60 * 1000; // 15 minutes

    return (req: Request, res: Response, next: NextFunction): void => {
      const clientId = req.ip || 'unknown';
      const now = Date.now();
      
      const clientData = requestCounts.get(clientId);
      
      if (!clientData || now > clientData.resetTime) {
        // Reset or initialize counter
        requestCounts.set(clientId, {
          count: 1,
          resetTime: now + windowMs
        });
        next();
        return;
      }
      
      if (clientData.count >= maxRequests) {
        res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Too many requests, please try again later',
          retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
        });
        return;
      }
      
      // Increment counter
      clientData.count++;
      requestCounts.set(clientId, clientData);
      
      next();
    };
  }

  /**
   * Validate content type for POST requests
   */
  static validateContentType(allowedTypes: string[] = ['application/json', 'application/x-www-form-urlencoded']) {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        const contentType = req.get('Content-Type');
        
        if (!contentType || !allowedTypes.some(type => contentType.includes(type))) {
          res.status(415).json({
            error: 'Unsupported Media Type',
            message: `Content-Type must be one of: ${allowedTypes.join(', ')}`,
            allowed: allowedTypes
          });
          return;
        }
      }
      
      next();
    };
  }
}