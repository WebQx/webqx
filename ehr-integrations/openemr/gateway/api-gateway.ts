/**
 * Modular API Gateway for OpenEMR Integration
 * 
 * Provides secure API gateway functionality for routing and authenticating
 * requests to OpenEMR through the WebQx platform.
 * 
 * Features:
 * - Request authentication and authorization
 * - Request routing and transformation
 * - Rate limiting and throttling
 * - Request/response logging and auditing
 * - Error handling and circuit breaker patterns
 */

import express, { Request, Response, NextFunction, Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { 
  User, 
  AuthSession, 
  Permission,
  UserRole 
} from '../../../auth/types/index';

import type { 
  OpenEMRTokens, 
  OpenEMROperationResult,
  OpenEMRAuditEvent 
} from '../types/index';

import { OAuth2Connector, TokenExchangeRequest } from '../connectors/oauth2-connector';

export interface APIGatewayConfig {
  // Server Configuration
  server: {
    port: number;
    host: string;
    basePath: string;
    enableCors: boolean;
    corsOrigins: string[];
  };
  
  // Authentication Configuration
  auth: {
    enableTokenValidation: boolean;
    tokenCacheTtl: number; // seconds
    requireValidSession: boolean;
  };
  
  // Rate Limiting Configuration
  rateLimit: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
  };
  
  // OpenEMR Routing Configuration
  routing: {
    openemrBaseUrl: string;
    timeoutMs: number;
    retryAttempts: number;
    retryDelayMs: number;
  };
  
  // Circuit Breaker Configuration
  circuitBreaker: {
    enabled: boolean;
    failureThreshold: number;
    recoveryTimeMs: number;
    monitoringWindowMs: number;
  };
  
  // Audit Configuration
  audit: {
    enabled: boolean;
    logRequests: boolean;
    logResponses: boolean;
    logHeaders: boolean;
  };
}

export interface GatewayRequest extends Request {
  user?: User;
  session?: AuthSession;
  openemrTokens?: OpenEMRTokens;
  requestId?: string;
}

export interface RouteConfig {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  requiredPermissions: Permission[];
  requiredRole?: UserRole;
  openemrEndpoint: string;
  transformRequest?: (req: GatewayRequest) => any;
  transformResponse?: (data: any) => any;
  skipAuth?: boolean;
  rateLimit?: {
    windowMs: number;
    maxRequests: number;
  };
}

export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

/**
 * Modular API Gateway for OpenEMR Integration
 */
export class APIGateway {
  private config: APIGatewayConfig;
  private oauth2Connector: OAuth2Connector;
  private app: express.Application;
  private router: Router;
  private tokenCache: Map<string, { user: User; tokens: OpenEMRTokens; expiresAt: number }>;
  private circuitBreakerState: CircuitBreakerState;
  private auditEvents: OpenEMRAuditEvent[] = [];

  constructor(config: APIGatewayConfig, oauth2Connector: OAuth2Connector) {
    this.config = config;
    this.oauth2Connector = oauth2Connector;
    this.app = express();
    this.router = Router();
    this.tokenCache = new Map();
    this.circuitBreakerState = {
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0
    };
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Initialize the API Gateway
   */
  async initialize(): Promise<void> {
    this.log('Initializing API Gateway...');
    
    try {
      await this.oauth2Connector.initialize();
      
      this.log('API Gateway initialized successfully');
      this.auditLog({
        action: 'api_gateway_initialized',
        resourceType: 'api_gateway',
        userId: 'system',
        timestamp: new Date(),
        outcome: 'success'
      });
    } catch (error) {
      this.log('Failed to initialize API Gateway:', error);
      throw error;
    }
  }

  /**
   * Start the API Gateway server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.app.listen(this.config.server.port, this.config.server.host, () => {
          this.log(`API Gateway started on ${this.config.server.host}:${this.config.server.port}`);
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get Express app instance
   */
  getApp(): express.Application {
    return this.app;
  }

  /**
   * Register a new route
   */
  registerRoute(routeConfig: RouteConfig): void {
    const { path, method, requiredPermissions, requiredRole, openemrEndpoint } = routeConfig;
    
    this.log(`Registering route: ${method} ${path} -> ${openemrEndpoint}`);
    
    // Create route-specific rate limiter if configured
    const routeRateLimit = routeConfig.rateLimit ? 
      rateLimit({
        windowMs: routeConfig.rateLimit.windowMs,
        max: routeConfig.rateLimit.maxRequests,
        message: 'Too many requests to this endpoint'
      }) : null;

    // Setup route handler
    const handlers: any[] = [];
    
    if (routeRateLimit) {
      handlers.push(routeRateLimit);
    }
    
    if (!routeConfig.skipAuth) {
      handlers.push(this.authenticateRequest.bind(this));
      handlers.push(this.authorizeRequest(requiredPermissions, requiredRole));
    }
    
    handlers.push(this.proxyToOpenEMR(routeConfig));

    // Register the route
    (this.router as any)[method.toLowerCase()](path, ...handlers);
  }

  /**
   * Register multiple routes
   */
  registerRoutes(routes: RouteConfig[]): void {
    routes.forEach(route => this.registerRoute(route));
  }

  // Private methods

  private setupMiddleware(): void {
    // Basic middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Request ID middleware
    this.app.use((req: GatewayRequest, res: Response, next: NextFunction) => {
      req.requestId = this.generateRequestId();
      res.setHeader('X-Request-ID', req.requestId);
      next();
    });
    
    // CORS middleware
    if (this.config.server.enableCors) {
      this.app.use((req: Request, res: Response, next: NextFunction) => {
        const origin = req.headers.origin as string;
        if (this.config.server.corsOrigins.includes('*') || 
            this.config.server.corsOrigins.includes(origin)) {
          res.setHeader('Access-Control-Allow-Origin', origin || '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
          res.setHeader('Access-Control-Allow-Credentials', 'true');
        }
        
        if (req.method === 'OPTIONS') {
          res.sendStatus(200);
        } else {
          next();
        }
      });
    }
    
    // Global rate limiting
    if (this.config.rateLimit.enabled) {
      const globalRateLimit = rateLimit({
        windowMs: this.config.rateLimit.windowMs,
        max: this.config.rateLimit.maxRequests,
        skip: (req, res) => {
          return this.config.rateLimit.skipSuccessfulRequests && res.statusCode < 400;
        },
        message: 'Too many requests from this IP'
      });
      this.app.use(globalRateLimit);
    }
    
    // Request logging middleware
    if (this.config.audit.logRequests) {
      this.app.use(this.logRequest.bind(this));
    }
    
    // Circuit breaker middleware
    if (this.config.circuitBreaker.enabled) {
      this.app.use(this.circuitBreakerMiddleware.bind(this));
    }
    
    // Mount router
    this.app.use(this.config.server.basePath, this.router);
    
    // Error handling middleware
    this.app.use(this.errorHandler.bind(this));
  }

  private setupRoutes(): void {
    // Default health check route
    this.router.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        circuitBreakerState: this.circuitBreakerState.state
      });
    });
    
    // Default OpenEMR routes
    const defaultRoutes: RouteConfig[] = [
      {
        path: '/patient/:id',
        method: 'GET',
        requiredPermissions: ['read:patient_records'],
        openemrEndpoint: '/apis/default/api/patient/:id'
      },
      {
        path: '/patient/:id/appointments',
        method: 'GET',
        requiredPermissions: ['read:patient_records'],
        openemrEndpoint: '/apis/default/api/patient/:id/appointment'
      },
      {
        path: '/appointment',
        method: 'POST',
        requiredPermissions: ['create:appointments'],
        openemrEndpoint: '/apis/default/api/appointment'
      },
      {
        path: '/slot',
        method: 'GET',
        requiredPermissions: ['read:patient_records'],
        openemrEndpoint: '/apis/default/fhir/Slot'
      }
    ];
    
    this.registerRoutes(defaultRoutes);
  }

  private async authenticateRequest(req: GatewayRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid authorization header' });
        return;
      }
      
      const token = authHeader.substring(7);
      
      // Check token cache first
      const cached = this.tokenCache.get(token);
      if (cached && cached.expiresAt > Date.now()) {
        req.user = cached.user;
        req.openemrTokens = cached.tokens;
        next();
        return;
      }
      
      // Validate token with central IDP
      const validation = await this.oauth2Connector.validateCentralToken(token);
      if (!validation.valid) {
        res.status(401).json({ error: 'Invalid token', details: validation.error });
        return;
      }
      
      // Exchange for OpenEMR tokens
      const user = this.mapClaimsToUser(validation.claims!);
      const exchangeRequest: TokenExchangeRequest = {
        centralIdpToken: token,
        userContext: user
      };
      
      const exchangeResult = await this.oauth2Connector.exchangeForOpenEMRTokens(exchangeRequest);
      if (!exchangeResult.success) {
        res.status(500).json({ error: 'Failed to exchange tokens', details: exchangeResult.error });
        return;
      }
      
      // Cache the result
      this.tokenCache.set(token, {
        user,
        tokens: exchangeResult.openemrTokens!,
        expiresAt: Date.now() + (this.config.auth.tokenCacheTtl * 1000)
      });
      
      req.user = user;
      req.openemrTokens = exchangeResult.openemrTokens;
      
      this.auditLog({
        action: 'request_authenticated',
        resourceType: 'request',
        userId: user.id,
        timestamp: new Date(),
        outcome: 'success',
        details: { requestId: req.requestId }
      });
      
      next();
    } catch (error) {
      this.log('Authentication error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  }

  private authorizeRequest(requiredPermissions: Permission[], requiredRole?: UserRole) {
    return (req: GatewayRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      // Check role if specified
      if (requiredRole && req.user.role !== requiredRole) {
        this.auditLog({
          action: 'authorization_denied_role',
          resourceType: 'request',
          userId: req.user.id,
          timestamp: new Date(),
          outcome: 'failure',
          details: { 
            requestId: req.requestId,
            requiredRole,
            userRole: req.user.role
          }
        });
        
        res.status(403).json({ error: 'Insufficient role privileges' });
        return;
      }
      
      // Check permissions (simplified - in real implementation, this would use a proper RBAC system)
      const hasPermissions = this.checkPermissions(req.user, requiredPermissions);
      if (!hasPermissions) {
        this.auditLog({
          action: 'authorization_denied_permission',
          resourceType: 'request',
          userId: req.user.id,
          timestamp: new Date(),
          outcome: 'failure',
          details: { 
            requestId: req.requestId,
            requiredPermissions,
            userRole: req.user.role
          }
        });
        
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }
      
      next();
    };
  }

  private proxyToOpenEMR(routeConfig: RouteConfig) {
    return async (req: GatewayRequest, res: Response) => {
      try {
        // Check circuit breaker
        if (this.circuitBreakerState.state === 'OPEN') {
          if (Date.now() < this.circuitBreakerState.nextAttemptTime) {
            res.status(503).json({ error: 'Service temporarily unavailable' });
            return;
          } else {
            this.circuitBreakerState.state = 'HALF_OPEN';
          }
        }
        
        // Transform request if needed
        let requestBody = req.body;
        if (routeConfig.transformRequest) {
          requestBody = routeConfig.transformRequest(req);
        }
        
        // Build OpenEMR URL
        let openemrPath = routeConfig.openemrEndpoint;
        Object.keys(req.params).forEach(param => {
          openemrPath = openemrPath.replace(`:${param}`, req.params[param]);
        });
        
        const openemrUrl = `${this.config.routing.openemrBaseUrl}${openemrPath}`;
        const queryString = new URLSearchParams(req.query as any).toString();
        const fullUrl = queryString ? `${openemrUrl}?${queryString}` : openemrUrl;
        
        // Make request to OpenEMR
        const response = await fetch(fullUrl, {
          method: req.method,
          headers: {
            'Authorization': `${req.openemrTokens?.tokenType || 'Bearer'} ${req.openemrTokens?.accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: requestBody ? JSON.stringify(requestBody) : undefined,
          timeout: this.config.routing.timeoutMs
        });
        
        if (!response.ok) {
          this.handleCircuitBreakerFailure();
          throw new Error(`OpenEMR request failed: ${response.statusText}`);
        }
        
        this.handleCircuitBreakerSuccess();
        
        let responseData = await response.json();
        
        // Transform response if needed
        if (routeConfig.transformResponse) {
          responseData = routeConfig.transformResponse(responseData);
        }
        
        // Log response if enabled
        if (this.config.audit.logResponses) {
          this.auditLog({
            action: 'openemr_request_success',
            resourceType: 'openemr_request',
            userId: req.user?.id || 'anonymous',
            timestamp: new Date(),
            outcome: 'success',
            details: { 
              requestId: req.requestId,
              endpoint: openemrPath,
              statusCode: response.status
            }
          });
        }
        
        res.status(response.status).json(responseData);
      } catch (error) {
        this.handleCircuitBreakerFailure();
        this.log('OpenEMR proxy error:', error);
        
        this.auditLog({
          action: 'openemr_request_failure',
          resourceType: 'openemr_request',
          userId: req.user?.id || 'anonymous',
          timestamp: new Date(),
          outcome: 'failure',
          details: { 
            requestId: req.requestId,
            error: error.message
          }
        });
        
        res.status(500).json({ error: 'Internal server error' });
      }
    };
  }

  private logRequest(req: GatewayRequest, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      this.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    });
    
    next();
  }

  private circuitBreakerMiddleware(req: GatewayRequest, res: Response, next: NextFunction): void {
    if (this.circuitBreakerState.state === 'OPEN') {
      if (Date.now() < this.circuitBreakerState.nextAttemptTime) {
        res.status(503).json({ 
          error: 'Service temporarily unavailable',
          retryAfter: Math.ceil((this.circuitBreakerState.nextAttemptTime - Date.now()) / 1000)
        });
        return;
      }
    }
    next();
  }

  private errorHandler(error: any, req: GatewayRequest, res: Response, next: NextFunction): void {
    this.log('Unhandled error:', error);
    
    if (res.headersSent) {
      return next(error);
    }
    
    res.status(500).json({
      error: 'Internal server error',
      requestId: req.requestId
    });
  }

  private handleCircuitBreakerSuccess(): void {
    if (this.circuitBreakerState.state === 'HALF_OPEN') {
      this.circuitBreakerState.state = 'CLOSED';
      this.circuitBreakerState.failureCount = 0;
    }
  }

  private handleCircuitBreakerFailure(): void {
    this.circuitBreakerState.failureCount++;
    this.circuitBreakerState.lastFailureTime = Date.now();
    
    if (this.circuitBreakerState.failureCount >= this.config.circuitBreaker.failureThreshold) {
      this.circuitBreakerState.state = 'OPEN';
      this.circuitBreakerState.nextAttemptTime = Date.now() + this.config.circuitBreaker.recoveryTimeMs;
      this.log('Circuit breaker opened due to failures');
    }
  }

  private mapClaimsToUser(claims: any): User {
    return {
      id: claims.sub,
      email: claims.email,
      firstName: claims.given_name || '',
      lastName: claims.family_name || '',
      role: this.mapRole(claims.role),
      specialty: claims.specialty,
      isVerified: claims.email_verified === true,
      mfaEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private mapRole(role: string): UserRole {
    const roleMapping: Record<string, UserRole> = {
      'patient': 'PATIENT',
      'provider': 'PROVIDER',
      'nurse': 'NURSE',
      'admin': 'ADMIN',
      'staff': 'STAFF',
      'resident': 'RESIDENT',
      'fellow': 'FELLOW',
      'attending': 'ATTENDING'
    };
    
    return roleMapping[role?.toLowerCase()] || 'PATIENT';
  }

  private checkPermissions(user: User, requiredPermissions: Permission[]): boolean {
    // Simplified permission check - in real implementation, this would be more sophisticated
    const rolePermissions: Record<UserRole, Permission[]> = {
      'PATIENT': ['read:own_records', 'create:appointments'],
      'PROVIDER': ['read:patient_records', 'write:prescriptions', 'write:clinical_notes'],
      'NURSE': ['read:patient_records', 'write:vitals', 'administer:medications'],
      'ADMIN': ['manage:users', 'configure:system', 'view:audit_logs'],
      'STAFF': ['read:patient_records', 'create:appointments'],
      'RESIDENT': ['read:patient_records', 'write:clinical_notes'],
      'FELLOW': ['read:patient_records', 'write:prescriptions', 'write:clinical_notes'],
      'ATTENDING': ['read:patient_records', 'write:prescriptions', 'write:clinical_notes', 'supervise:residents']
    };
    
    const userPermissions = rolePermissions[user.role] || [];
    return requiredPermissions.every(permission => userPermissions.includes(permission));
  }

  private generateRequestId(): string {
    return 'req_' + Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  private auditLog(event: OpenEMRAuditEvent): void {
    if (this.config.audit?.enabled) {
      this.auditEvents.push(event);
      this.log(`[AUDIT] ${event.action}: ${event.outcome}`);
    }
  }

  private log(message: string, ...args: any[]): void {
    console.log(`[API Gateway] ${message}`, ...args);
  }
}