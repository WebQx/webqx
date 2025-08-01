/**
 * OpenEMR Modular Connectors - Main Entry Point
 * 
 * This module provides the main entry point for the OpenEMR modular connectors
 * that integrate with the WebQx platform's Unified Provider Login System.
 * 
 * Features:
 * - OAuth2/OIDC connector for central IDP delegation
 * - Modular API Gateway for request routing and authentication
 * - Auth Proxy middleware for token validation and RBAC
 * - Comprehensive error handling and audit logging
 * - Configuration management and validation
 */

import express from 'express';
import { OAuth2Connector } from './oauth2-connector';
import { APIGateway, RouteConfig } from '../gateway/api-gateway';
import { AuthProxyMiddleware } from '../middleware/auth-proxy';
import { 
  defaultOAuth2Config, 
  defaultAPIGatewayConfig, 
  defaultAuthProxyConfig,
  loadConfigFromEnvironment,
  validateConfig
} from '../config/connectors/default';

import type { 
  OAuth2ConnectorConfig,
  TokenExchangeRequest 
} from './oauth2-connector';
import type { APIGatewayConfig } from '../gateway/api-gateway';
import type { AuthProxyConfig } from '../middleware/auth-proxy';
import type { OpenEMROperationResult } from '../types';

export interface ConnectorManagerConfig {
  oauth2: OAuth2ConnectorConfig;
  apiGateway: APIGatewayConfig;
  authProxy: AuthProxyConfig;
  autoStart?: boolean;
  enableHealthChecks?: boolean;
}

export interface ConnectorStatus {
  oauth2: 'healthy' | 'unhealthy' | 'initializing';
  apiGateway: 'healthy' | 'unhealthy' | 'initializing';
  authProxy: 'healthy' | 'unhealthy' | 'initializing';
  overall: 'healthy' | 'unhealthy' | 'initializing';
}

/**
 * OpenEMR Connector Manager
 * 
 * Manages all OpenEMR connector components and provides a unified interface
 * for initialization, configuration, and health monitoring.
 */
export class OpenEMRConnectorManager {
  private config: ConnectorManagerConfig;
  private oauth2Connector: OAuth2Connector;
  private apiGateway: APIGateway;
  private authProxy: AuthProxyMiddleware;
  private status: ConnectorStatus;
  private isInitialized: boolean = false;

  constructor(config?: Partial<ConnectorManagerConfig>) {
    // Load default configuration and merge with provided config
    const defaultConfig = loadConfigFromEnvironment();
    
    this.config = {
      oauth2: { ...defaultConfig.oauth2, ...config?.oauth2 },
      apiGateway: { ...defaultConfig.apiGateway, ...config?.apiGateway },
      authProxy: { ...defaultConfig.authProxy, ...config?.authProxy },
      autoStart: config?.autoStart ?? false,
      enableHealthChecks: config?.enableHealthChecks ?? true
    };

    // Validate configuration
    const validation = validateConfig({
      oauth2: this.config.oauth2,
      apiGateway: this.config.apiGateway,
      authProxy: this.config.authProxy
    });

    if (!validation.valid) {
      throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
    }

    // Initialize components
    this.oauth2Connector = new OAuth2Connector(this.config.oauth2);
    this.apiGateway = new APIGateway(this.config.apiGateway, this.oauth2Connector);
    this.authProxy = new AuthProxyMiddleware(this.config.authProxy, this.oauth2Connector);

    this.status = {
      oauth2: 'initializing',
      apiGateway: 'initializing',
      authProxy: 'initializing',
      overall: 'initializing'
    };

    this.log('OpenEMR Connector Manager created');
  }

  /**
   * Initialize all connector components
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.log('Connector Manager already initialized');
      return;
    }

    this.log('Initializing OpenEMR Connector Manager...');

    try {
      // Initialize OAuth2 Connector
      this.log('Initializing OAuth2 Connector...');
      await this.oauth2Connector.initialize();
      this.status.oauth2 = 'healthy';
      this.log('OAuth2 Connector initialized successfully');

      // Initialize API Gateway
      this.log('Initializing API Gateway...');
      await this.apiGateway.initialize();
      this.status.apiGateway = 'healthy';
      this.log('API Gateway initialized successfully');

      // Auth Proxy doesn't need async initialization
      this.status.authProxy = 'healthy';
      this.log('Auth Proxy ready');

      this.status.overall = 'healthy';
      this.isInitialized = true;

      this.log('OpenEMR Connector Manager initialized successfully');

      // Auto-start if configured
      if (this.config.autoStart) {
        await this.start();
      }
    } catch (error) {
      this.status.overall = 'unhealthy';
      this.log('Failed to initialize OpenEMR Connector Manager:', error);
      throw error;
    }
  }

  /**
   * Start the connector services
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.log('Starting OpenEMR Connector Manager services...');

    try {
      // Start API Gateway server
      await this.apiGateway.start();
      this.log('API Gateway server started');

      // Setup health check endpoints if enabled
      if (this.config.enableHealthChecks) {
        this.setupHealthChecks();
      }

      this.log('OpenEMR Connector Manager services started successfully');
    } catch (error) {
      this.log('Failed to start OpenEMR Connector Manager services:', error);
      throw error;
    }
  }

  /**
   * Get the status of all components
   */
  getStatus(): ConnectorStatus {
    return { ...this.status };
  }

  /**
   * Get the OAuth2 connector instance
   */
  getOAuth2Connector(): OAuth2Connector {
    return this.oauth2Connector;
  }

  /**
   * Get the API Gateway instance
   */
  getAPIGateway(): APIGateway {
    return this.apiGateway;
  }

  /**
   * Get the Auth Proxy middleware instance
   */
  getAuthProxy(): AuthProxyMiddleware {
    return this.authProxy;
  }

  /**
   * Register custom routes with the API Gateway
   */
  registerRoutes(routes: RouteConfig[]): void {
    this.apiGateway.registerRoutes(routes);
    this.log(`Registered ${routes.length} custom routes`);
  }

  /**
   * Create an Express application with all middleware configured
   */
  createExpressApp(): express.Application {
    const app = express();

    // Add basic middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Add auth proxy middleware
    app.use(this.authProxy.authenticate());
    app.use(this.authProxy.validateRequest());
    app.use(this.authProxy.manageSession());

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: this.status.overall,
        components: this.status,
        timestamp: new Date().toISOString()
      });
    });

    return app;
  }

  /**
   * Perform health checks on all components
   */
  async performHealthChecks(): Promise<ConnectorStatus> {
    try {
      // Check OAuth2 Connector
      try {
        const validation = await this.oauth2Connector.validateCentralToken('dummy-token');
        this.status.oauth2 = 'healthy'; // Even if token is invalid, the service is responding
      } catch (error) {
        this.status.oauth2 = 'unhealthy';
      }

      // Check API Gateway (simplified check)
      try {
        const app = this.apiGateway.getApp();
        this.status.apiGateway = app !== null && app !== undefined ? 'healthy' : 'unhealthy';
      } catch (error) {
        this.status.apiGateway = 'unhealthy';
      }

      // Auth Proxy is always healthy if initialized
      this.status.authProxy = this.isInitialized ? 'healthy' : 'unhealthy';

      // Overall status
      const components = [this.status.oauth2, this.status.apiGateway, this.status.authProxy];
      this.status.overall = components.every(s => s === 'healthy') ? 'healthy' : 'unhealthy';

      return this.status;
    } catch (error) {
      this.log('Health check failed:', error);
      this.status.overall = 'unhealthy';
      return this.status;
    }
  }

  /**
   * Exchange central IDP token for OpenEMR tokens
   */
  async exchangeTokens(request: TokenExchangeRequest): Promise<OpenEMROperationResult<any>> {
    try {
      const result = await this.oauth2Connector.exchangeForOpenEMRTokens(request);
      return {
        success: result.success,
        data: result.openemrTokens,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'TOKEN_EXCHANGE_ERROR',
          message: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  // Private methods

  private setupHealthChecks(): void {
    const app = this.apiGateway.getApp();

    // Detailed health check endpoint
    app.get('/health/detailed', async (req, res) => {
      const status = await this.performHealthChecks();
      res.status(status.overall === 'healthy' ? 200 : 503).json({
        status: status.overall,
        components: status,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || 'unknown'
      });
    });

    // Component-specific health checks
    app.get('/health/oauth2', (req, res) => {
      res.json({
        status: this.status.oauth2,
        timestamp: new Date().toISOString()
      });
    });

    app.get('/health/gateway', (req, res) => {
      res.json({
        status: this.status.apiGateway,
        timestamp: new Date().toISOString()
      });
    });

    app.get('/health/proxy', (req, res) => {
      res.json({
        status: this.status.authProxy,
        timestamp: new Date().toISOString()
      });
    });

    this.log('Health check endpoints configured');
  }

  private log(message: string, ...args: any[]): void {
    console.log(`[OpenEMR Connector Manager] ${message}`, ...args);
  }
}

/**
 * Factory function to create and initialize a connector manager
 */
export async function createConnectorManager(config?: Partial<ConnectorManagerConfig>): Promise<OpenEMRConnectorManager> {
  const manager = new OpenEMRConnectorManager(config);
  await manager.initialize();
  return manager;
}

/**
 * Utility function to create a complete Express app with all connectors
 */
export async function createConnectorApp(config?: Partial<ConnectorManagerConfig>): Promise<express.Application> {
  const manager = await createConnectorManager(config);
  return manager.createExpressApp();
}

// Export individual components for direct use
export { OAuth2Connector } from './oauth2-connector';
export { APIGateway } from '../gateway/api-gateway';
export { AuthProxyMiddleware } from '../middleware/auth-proxy';
export * from '../config/connectors/default';

// Export types
export type {
  OAuth2ConnectorConfig,
  TokenExchangeRequest,
  TokenExchangeResult
} from './oauth2-connector';
export type { APIGatewayConfig, RouteConfig } from '../gateway/api-gateway';
export type { AuthProxyConfig } from '../middleware/auth-proxy';