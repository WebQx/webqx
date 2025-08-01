/**
 * WebQX™ OpenEMR Keycloak Integration
 * 
 * Integrates Keycloak authentication with OpenEMR EHR system.
 * Provides token validation, role mapping, and secure API gateway functionality.
 */

import { Request, Response, NextFunction } from 'express';
import { 
  keycloakMiddleware, 
  validateKeycloakToken, 
  mapKeycloakRoles,
  requireKeycloakRole,
  requireKeycloakSpecialty,
  requireVerifiedProvider 
} from '../../../auth/keycloak/middleware';
import { 
  KeycloakUser, 
  KeycloakTokenParsed, 
  KeycloakProviderConfig 
} from '../../../auth/keycloak/types';
import { getKeycloakProviderConfig } from '../../../auth/keycloak/client';
import { User, UserRole, MedicalSpecialty } from '../../../auth/types';
import { OAuth2Connector, TokenExchangeRequest } from '../connectors/oauth2-connector';

// Extend Express Request to include both Keycloak and OpenEMR context
declare global {
  namespace Express {
    interface Request {
      keycloakUser?: KeycloakUser;
      keycloakToken?: string;
      openemrUser?: User;
      openemrTokens?: {
        accessToken: string;
        tokenType: string;
        expiresIn: number;
        refreshToken?: string;
      };
    }
  }
}

export interface OpenEMRKeycloakConfig {
  keycloak: KeycloakProviderConfig;
  openemr: {
    baseUrl: string;
    clientId: string;
    clientSecret: string;
    apiVersion: string;
    timeout: number;
  };
  integration: {
    enableTokenExchange: boolean;
    enableRoleMapping: boolean;
    enableProviderVerification: boolean;
    defaultPatientAccess: boolean;
    auditAllRequests: boolean;
  };
}

/**
 * OpenEMR Keycloak Integration Class
 */
export class OpenEMRKeycloakIntegration {
  private config: OpenEMRKeycloakConfig;
  private oauth2Connector: OAuth2Connector;
  private tokenCache: Map<string, {
    openemrTokens: any;
    expiresAt: number;
    keycloakUser: KeycloakUser;
  }>;

  constructor(config: OpenEMRKeycloakConfig, oauth2Connector: OAuth2Connector) {
    this.config = config;
    this.oauth2Connector = oauth2Connector;
    this.tokenCache = new Map();
  }

  /**
   * Initialize the integration
   */
  async initialize(): Promise<void> {
    console.log('Initializing OpenEMR Keycloak Integration...');
    
    try {
      await this.oauth2Connector.initialize();
      console.log('OpenEMR Keycloak Integration initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OpenEMR Keycloak Integration:', error);
      throw error;
    }
  }

  /**
   * Middleware to authenticate and authorize OpenEMR requests with Keycloak
   */
  createAuthenticationMiddleware() {
    return [
      // First, validate Keycloak token
      keycloakMiddleware,
      
      // Then, handle OpenEMR token exchange and user mapping
      this.handleOpenEMRIntegration.bind(this),
    ];
  }

  /**
   * Handle OpenEMR integration after Keycloak authentication
   */
  private async handleOpenEMRIntegration(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.keycloakUser || !req.keycloakToken) {
        res.status(401).json({
          error: 'KEYCLOAK_AUTH_REQUIRED',
          message: 'Keycloak authentication required'
        });
        return;
      }

      // Check cache first
      const cached = this.tokenCache.get(req.keycloakToken);
      if (cached && cached.expiresAt > Date.now()) {
        req.openemrTokens = cached.openemrTokens;
        req.openemrUser = this.keycloakUserToOpenEMRUser(cached.keycloakUser);
        next();
        return;
      }

      // Exchange Keycloak token for OpenEMR tokens if enabled
      if (this.config.integration.enableTokenExchange) {
        const exchangeResult = await this.exchangeTokens(req.keycloakToken, req.keycloakUser);
        if (!exchangeResult.success) {
          res.status(500).json({
            error: 'TOKEN_EXCHANGE_FAILED',
            message: 'Failed to exchange Keycloak token for OpenEMR access',
            details: exchangeResult.error
          });
          return;
        }

        req.openemrTokens = exchangeResult.openemrTokens;
        
        // Cache the tokens
        this.tokenCache.set(req.keycloakToken, {
          openemrTokens: exchangeResult.openemrTokens,
          expiresAt: Date.now() + (exchangeResult.openemrTokens.expiresIn * 1000),
          keycloakUser: req.keycloakUser
        });
      }

      // Map Keycloak user to OpenEMR user context
      req.openemrUser = this.keycloakUserToOpenEMRUser(req.keycloakUser);

      // Provider verification if enabled
      if (this.config.integration.enableProviderVerification) {
        const providerRoles: UserRole[] = ['PROVIDER', 'RESIDENT', 'FELLOW', 'ATTENDING'];
        if (providerRoles.includes(req.keycloakUser.webqxRole)) {
          if (req.keycloakUser.verificationStatus !== 'VERIFIED') {
            res.status(403).json({
              error: 'PROVIDER_NOT_VERIFIED',
              message: 'Provider verification required for this action',
              verificationStatus: req.keycloakUser.verificationStatus
            });
            return;
          }
        }
      }

      // Audit logging if enabled
      if (this.config.integration.auditAllRequests) {
        this.auditLog({
          action: 'openemr_keycloak_auth',
          userId: req.keycloakUser.id,
          userRole: req.keycloakUser.webqxRole,
          specialty: req.keycloakUser.medicalSpecialty,
          requestPath: req.path,
          requestMethod: req.method,
          timestamp: new Date(),
          outcome: 'success'
        });
      }

      next();
    } catch (error) {
      console.error('OpenEMR Keycloak integration error:', error);
      res.status(500).json({
        error: 'INTEGRATION_ERROR',
        message: 'Internal integration error'
      });
    }
  }

  /**
   * Exchange Keycloak token for OpenEMR tokens
   */
  private async exchangeTokens(keycloakToken: string, keycloakUser: KeycloakUser): Promise<{
    success: boolean;
    openemrTokens?: any;
    error?: string;
  }> {
    try {
      const exchangeRequest: TokenExchangeRequest = {
        centralIdpToken: keycloakToken,
        userContext: this.keycloakUserToOpenEMRUser(keycloakUser)
      };

      const result = await this.oauth2Connector.exchangeForOpenEMRTokens(exchangeRequest);
      return result;
    } catch (error) {
      console.error('Token exchange error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Convert Keycloak user to OpenEMR user format
   */
  private keycloakUserToOpenEMRUser(keycloakUser: KeycloakUser): User {
    return {
      id: keycloakUser.id,
      email: keycloakUser.email,
      firstName: keycloakUser.firstName || '',
      lastName: keycloakUser.lastName || '',
      role: keycloakUser.webqxRole,
      specialty: keycloakUser.medicalSpecialty,
      isVerified: keycloakUser.verificationStatus === 'VERIFIED',
      mfaEnabled: false, // Would need to be determined from Keycloak
      lastLogin: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Create role-based middleware for OpenEMR endpoints
   */
  createRoleMiddleware(requiredRoles: UserRole[]) {
    return requireKeycloakRole(requiredRoles);
  }

  /**
   * Create specialty-based middleware for OpenEMR endpoints
   */
  createSpecialtyMiddleware(requiredSpecialties: MedicalSpecialty[]) {
    return requireKeycloakSpecialty(requiredSpecialties);
  }

  /**
   * Create verified provider middleware for OpenEMR endpoints
   */
  createVerifiedProviderMiddleware() {
    return requireVerifiedProvider;
  }

  /**
   * Get user context for OpenEMR API calls
   */
  getUserContext(req: Request): {
    keycloakUser?: KeycloakUser;
    openemrUser?: User;
    tokens?: any;
  } {
    return {
      keycloakUser: req.keycloakUser,
      openemrUser: req.openemrUser,
      tokens: req.openemrTokens
    };
  }

  /**
   * Validate user has access to specific patient
   */
  async validatePatientAccess(req: Request, patientId: string): Promise<{
    hasAccess: boolean;
    reason?: string;
  }> {
    const { keycloakUser, openemrUser } = this.getUserContext(req);
    
    if (!keycloakUser || !openemrUser) {
      return { hasAccess: false, reason: 'User not authenticated' };
    }

    // Patient can only access their own records
    if (keycloakUser.webqxRole === 'PATIENT') {
      const hasAccess = keycloakUser.id === patientId || this.config.integration.defaultPatientAccess;
      return { 
        hasAccess, 
        reason: hasAccess ? undefined : 'Patients can only access their own records' 
      };
    }

    // Providers can access all patient records (simplified - in real implementation, 
    // this would check care relationships, department assignments, etc.)
    const providerRoles: UserRole[] = ['PROVIDER', 'NURSE', 'RESIDENT', 'FELLOW', 'ATTENDING'];
    if (providerRoles.includes(keycloakUser.webqxRole)) {
      return { hasAccess: true };
    }

    // Admin can access all records
    if (keycloakUser.webqxRole === 'ADMIN') {
      return { hasAccess: true };
    }

    return { hasAccess: false, reason: 'Insufficient privileges for patient access' };
  }

  /**
   * Audit logging helper
   */
  private auditLog(event: {
    action: string;
    userId: string;
    userRole: UserRole;
    specialty?: MedicalSpecialty;
    requestPath: string;
    requestMethod: string;
    timestamp: Date;
    outcome: 'success' | 'failure';
    details?: any;
  }): void {
    console.log(`[AUDIT][OpenEMR-Keycloak] ${event.action}:`, {
      userId: event.userId,
      userRole: event.userRole,
      specialty: event.specialty,
      request: `${event.requestMethod} ${event.requestPath}`,
      outcome: event.outcome,
      timestamp: event.timestamp.toISOString(),
      details: event.details
    });
  }

  /**
   * Get integration configuration
   */
  getConfig(): OpenEMRKeycloakConfig {
    return this.config;
  }
}

/**
 * Factory function to create OpenEMR Keycloak integration
 */
export function createOpenEMRKeycloakIntegration(
  oauth2Connector: OAuth2Connector,
  customConfig?: Partial<OpenEMRKeycloakConfig>
): OpenEMRKeycloakIntegration {
  const defaultConfig: OpenEMRKeycloakConfig = {
    keycloak: getKeycloakProviderConfig(),
    openemr: {
      baseUrl: process.env.OPENEMR_BASE_URL || 'https://openemr.example.com',
      clientId: process.env.OPENEMR_CLIENT_ID || 'webqx-integration',
      clientSecret: process.env.OPENEMR_CLIENT_SECRET || '',
      apiVersion: process.env.OPENEMR_API_VERSION || 'v1',
      timeout: parseInt(process.env.OPENEMR_TIMEOUT || '30000'),
    },
    integration: {
      enableTokenExchange: process.env.OPENEMR_ENABLE_TOKEN_EXCHANGE !== 'false',
      enableRoleMapping: process.env.OPENEMR_ENABLE_ROLE_MAPPING !== 'false',
      enableProviderVerification: process.env.OPENEMR_ENABLE_PROVIDER_VERIFICATION === 'true',
      defaultPatientAccess: process.env.OPENEMR_DEFAULT_PATIENT_ACCESS === 'true',
      auditAllRequests: process.env.OPENEMR_AUDIT_ALL_REQUESTS !== 'false',
    },
  };

  const config = { ...defaultConfig, ...customConfig };
  return new OpenEMRKeycloakIntegration(config, oauth2Connector);
}