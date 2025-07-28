const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const cors = require('cors');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');

/**
 * HIPAA-Compliant Security Middleware
 * Implements security headers, rate limiting, and audit logging
 */

// Security headers configuration for HIPAA compliance
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: true,
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  ieNoOpen: true,
  noSniff: true,
  permittedCrossDomainPolicies: false,
  xssFilter: true,
});

// Rate limiting for API protection
const createRateLimit = (windowMs = 15 * 60 * 1000, max = 100) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      // Log rate limit violations for security monitoring
      console.warn(`Rate limit exceeded for IP: ${req.ip}, Path: ${req.path}, User-Agent: ${req.get('User-Agent')}`);
      res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// Specific rate limits for different endpoints
const generalRateLimit = createRateLimit(); // 100 requests per 15 minutes
const authRateLimit = createRateLimit(15 * 60 * 1000, 5); // 5 login attempts per 15 minutes
const apiRateLimit = createRateLimit(60 * 1000, 30); // 30 API calls per minute

// CORS configuration for healthcare applications
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests from allowed origins or no origin (mobile apps)
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000', 'https://webqx.health'];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Session-ID'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
};

// Compression middleware with security considerations
const compressionOptions = {
  level: 6, // Balance between speed and compression
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    // Don't compress if the request includes a Cache-Control: no-transform directive
    if (req.headers['cache-control'] && req.headers['cache-control'].includes('no-transform')) {
      return false;
    }
    // Use compression filter function
    return compression.filter(req, res);
  }
};

// Request ID middleware for audit trails
const requestId = (req, res, next) => {
  req.id = uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
};

// Security logging with Morgan
const securityLogger = morgan((tokens, req, res) => {
  const logData = {
    requestId: req.id,
    method: tokens.method(req, res),
    url: tokens.url(req, res),
    status: tokens.status(req, res),
    contentLength: tokens.res(req, res, 'content-length'),
    responseTime: tokens['response-time'](req, res),
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    forwardedFor: req.get('X-Forwarded-For'),
    timestamp: new Date().toISOString(),
    userId: req.user ? req.user.id : null,
    sessionId: req.sessionID || null
  };
  
  // Log to console in development, should be sent to secure logging service in production
  if (process.env.NODE_ENV !== 'production') {
    console.log('Security Log:', JSON.stringify(logData, null, 2));
  }
  
  return JSON.stringify(logData);
});

// Middleware to validate request headers for security
const validateHeaders = (req, res, next) => {
  // Check for required security headers in API requests
  if (req.path.startsWith('/api/')) {
    const requiredHeaders = ['content-type'];
    const missingHeaders = requiredHeaders.filter(header => !req.headers[header]);
    
    if (missingHeaders.length > 0) {
      return res.status(400).json({
        error: 'Missing required headers',
        missingHeaders
      });
    }
  }
  
  // Validate Content-Type for POST/PUT requests
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.path.startsWith('/api/')) {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({
        error: 'Invalid Content-Type',
        expected: 'application/json'
      });
    }
  }
  
  next();
};

// Session security middleware
const sessionSecurity = (req, res, next) => {
  // Set secure session cookies
  if (req.session) {
    req.session.secure = process.env.NODE_ENV === 'production';
    req.session.httpOnly = true;
    req.session.sameSite = 'strict';
    req.session.maxAge = 30 * 60 * 1000; // 30 minutes
  }
  
  next();
};

// Error handling middleware for security
const securityErrorHandler = (err, req, res, next) => {
  // Log security-related errors
  if (err) {
    console.error('Security Error:', {
      requestId: req.id,
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });
  }
  
  // Don't expose error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Invalid JSON',
      message: 'Request body contains invalid JSON'
    });
  }
  
  if (err.code === 'CORS_ERROR') {
    return res.status(403).json({
      error: 'CORS Error',
      message: 'Cross-origin request not allowed'
    });
  }
  
  // Generic error response
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: isDevelopment ? err.message : 'An error occurred processing your request',
    requestId: req.id
  });
};

module.exports = {
  securityHeaders,
  generalRateLimit,
  authRateLimit,
  apiRateLimit,
  cors: cors(corsOptions),
  compression: compression(compressionOptions),
  requestId,
  securityLogger,
  validateHeaders,
  sessionSecurity,
  securityErrorHandler
};