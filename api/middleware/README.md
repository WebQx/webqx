# API Middleware

This directory contains common middleware functions used across all API endpoints in the WebQx EHR system.

## Purpose

Provides reusable middleware components for authentication, logging, error handling, request validation, and other cross-cutting concerns that apply to all API operations.

## Features

- **Authentication Middleware** - JWT token validation and user context
- **Authorization Middleware** - Role-based access control enforcement
- **Logging Middleware** - Request/response logging and audit trails
- **Rate Limiting Middleware** - API throttling and abuse prevention
- **Validation Middleware** - Request data validation and sanitization
- **Error Handling Middleware** - Centralized error processing and formatting
- **CORS Middleware** - Cross-origin request handling
- **Security Headers Middleware** - Security-focused HTTP headers

## Initial Setup

1. Configure middleware chain order and dependencies
2. Set up authentication and authorization rules
3. Configure logging levels and audit requirements
4. Set rate limiting thresholds and policies
5. Define validation schemas for API endpoints
6. Configure error handling and response formats

## Middleware Components

### Security Middleware
```javascript
// Authentication middleware
app.use('/api', authenticateJWT);

// Authorization middleware
app.use('/api', authorizeRole(['provider', 'admin']));

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  }
}));
```

### Operational Middleware
```javascript
// Request logging
app.use(morgan('combined', {
  stream: auditLogger.stream
}));

// Rate limiting
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));

// Request validation
app.use('/api', validateRequest);
```

## Error Handling

Standardized error response format:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": {
      "field": "email",
      "issue": "Invalid email format"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req-12345"
  }
}
```