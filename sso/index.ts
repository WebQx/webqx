import { Request, Response } from 'express';
import { SSOConfig, SSOUser, SSOSession, SSOConfigurationError } from './types/common';
import { OAuth2Provider } from './types/oauth2';
import { SAMLProvider } from './types/saml';
import { OAuth2ProviderFactory } from './providers/oauth2';
import { SAMLProviderFactory } from './providers/saml';
import { SSOConfigManager } from './config';
import { AuthMiddleware } from './middleware/auth';
import { JWTUtils } from './utils/jwt';
import { AuditLogger } from './utils/audit';

/**
 * Main SSO Manager class
 * Orchestrates OAuth2 and SAML authentication flows
 */
export class SSOManager {
  private config: SSOConfigManager;
  private oauth2Providers: Record<string, OAuth2Provider>;
  private samlProviders: Record<string, SAMLProvider>;
  private authMiddleware: AuthMiddleware;
  private jwtUtils: JWTUtils;
  private auditLogger: AuditLogger;

  constructor(config: Partial<SSOConfig>) {
    this.config = new SSOConfigManager(config);
    this.oauth2Providers = {};
    this.samlProviders = {};
    
    // Initialize utilities
    this.jwtUtils = new JWTUtils(this.config.getSecretKey());
    this.auditLogger = new AuditLogger({
      logToConsole: true,
      maxEvents: 10000
    });
    
    // Initialize middleware
    this.authMiddleware = new AuthMiddleware(this.config.getSecretKey(), {
      auditLogger: this.auditLogger
    });

    // Initialize providers
    this.initializeProviders();
  }

  /**
   * Initialize OAuth2 and SAML providers from configuration
   */
  private initializeProviders(): void {
    // Initialize OAuth2 providers
    const oauth2Configs = this.config.getOAuth2Providers();
    this.oauth2Providers = OAuth2ProviderFactory.createProviders(oauth2Configs);

    // Initialize SAML providers
    const samlConfigs = this.config.getSAMLProviders();
    this.samlProviders = SAMLProviderFactory.createProviders(samlConfigs);
  }

  /**
   * Get OAuth2 authentication URL
   */
  getOAuth2AuthUrl(provider: string, redirectUri?: string): string {
    const oauth2Provider = this.oauth2Providers[provider];
    if (!oauth2Provider) {
      throw new SSOConfigurationError(`OAuth2 provider '${provider}' not found`);
    }

    const state = oauth2Provider.createState(redirectUri);
    return oauth2Provider.generateAuthUrl(state.state);
  }

  /**
   * Get SAML authentication URL
   */
  getSAMLAuthUrl(provider: string, relayState?: string): string {
    const samlProvider = this.samlProviders[provider];
    if (!samlProvider) {
      throw new SSOConfigurationError(`SAML provider '${provider}' not found`);
    }

    return samlProvider.generateAuthUrl(relayState);
  }

  /**
   * Handle OAuth2 callback
   */
  async handleOAuth2Callback(provider: string, req: Request): Promise<{ user: SSOUser; token: string; session: SSOSession }> {
    const oauth2Provider = this.oauth2Providers[provider];
    if (!oauth2Provider) {
      throw new SSOConfigurationError(`OAuth2 provider '${provider}' not found`);
    }

    this.auditLogger.logLoginAttempt(provider, 'oauth2', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    try {
      // Authenticate user
      const user = await oauth2Provider.authenticate(req);
      
      // Create session
      const session = this.authMiddleware.createSession(user, provider, 'oauth2');
      
      // Generate JWT token
      const token = this.jwtUtils.createToken(user, session);

      return { user, token, session };
    } catch (error) {
      this.auditLogger.logLoginFailure(provider, 'oauth2', error instanceof Error ? error.message : String(error), {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      throw error;
    }
  }

  /**
   * Handle SAML callback
   */
  async handleSAMLCallback(provider: string, req: Request): Promise<{ user: SSOUser; token: string; session: SSOSession }> {
    const samlProvider = this.samlProviders[provider];
    if (!samlProvider) {
      throw new SSOConfigurationError(`SAML provider '${provider}' not found`);
    }

    this.auditLogger.logLoginAttempt(provider, 'saml', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    try {
      // Authenticate user
      const user = await samlProvider.authenticate(req);
      
      // Create session
      const session = this.authMiddleware.createSession(user, provider, 'saml');
      
      // Generate JWT token
      const token = this.jwtUtils.createToken(user, session);

      return { user, token, session };
    } catch (error) {
      this.auditLogger.logLoginFailure(provider, 'saml', error instanceof Error ? error.message : String(error), {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      throw error;
    }
  }

  /**
   * Validate and refresh token
   */
  async refreshToken(token: string): Promise<string> {
    try {
      return this.jwtUtils.refreshToken(token);
    } catch (error) {
      throw new SSOConfigurationError('Failed to refresh token');
    }
  }

  /**
   * Handle logout and clean up session
   */
  async handleLogout(token: string): Promise<void> {
    try {
      const decoded = this.jwtUtils.verifyToken(token);
      const sessionData = this.jwtUtils.getSessionFromToken(token);
      
      this.auditLogger.logLogout(
        sessionData.provider || 'unknown',
        sessionData.protocol || 'oauth2',
        decoded.sub,
        sessionData.sessionId || ''
      );
    } catch {
      // Token might be invalid, but that's okay for logout
    }
  }

  /**
   * Get user from token
   */
  getUserFromToken(token: string): SSOUser {
    return this.jwtUtils.getUserFromToken(token);
  }

  /**
   * Get authentication middleware
   */
  get requireAuth() {
    return this.authMiddleware.requireAuth;
  }

  /**
   * Get optional authentication middleware
   */
  get optionalAuth() {
    return this.authMiddleware.optionalAuth;
  }

  /**
   * Get role-based authentication middleware
   */
  requireRoles(roles: string | string[]) {
    return this.authMiddleware.requireRoles(roles);
  }

  /**
   * Get group-based authentication middleware
   */
  requireGroups(groups: string | string[]) {
    return this.authMiddleware.requireGroups(groups);
  }

  /**
   * Get logout middleware
   */
  get logout() {
    return this.authMiddleware.logout;
  }

  /**
   * Get audit logger
   */
  getAuditLogger(): AuditLogger {
    return this.auditLogger;
  }

  /**
   * Get supported providers
   */
  getSupportedProviders(): { oauth2: string[]; saml: string[] } {
    return {
      oauth2: Object.keys(this.oauth2Providers),
      saml: Object.keys(this.samlProviders)
    };
  }

  /**
   * Add OAuth2 provider dynamically
   */
  addOAuth2Provider(name: string, config: any): void {
    this.config.addOAuth2Provider(name, config);
    const provider = OAuth2ProviderFactory.createProvider(config.provider || name, config);
    this.oauth2Providers[name] = provider;
  }

  /**
   * Add SAML provider dynamically
   */
  addSAMLProvider(name: string, config: any): void {
    this.config.addSAMLProvider(name, config);
    const provider = SAMLProviderFactory.createProvider(config.provider || name, config);
    this.samlProviders[name] = provider;
  }

  /**
   * Remove provider dynamically
   */
  removeProvider(protocol: 'oauth2' | 'saml', name: string): void {
    this.config.removeProvider(protocol, name);
    
    if (protocol === 'oauth2') {
      delete this.oauth2Providers[name];
    } else {
      delete this.samlProviders[name];
    }
  }

  /**
   * Get provider health status
   */
  async getProviderHealth(): Promise<Record<string, { status: 'healthy' | 'unhealthy'; lastCheck: Date }>> {
    const health: Record<string, { status: 'healthy' | 'unhealthy'; lastCheck: Date }> = {};
    const now = new Date();

    // Check OAuth2 providers
    for (const [name, provider] of Object.entries(this.oauth2Providers)) {
      try {
        // Simple health check - try to generate auth URL
        provider.generateAuthUrl();
        health[`oauth2_${name}`] = { status: 'healthy', lastCheck: now };
      } catch {
        health[`oauth2_${name}`] = { status: 'unhealthy', lastCheck: now };
      }
    }

    // Check SAML providers
    for (const [name, provider] of Object.entries(this.samlProviders)) {
      try {
        // Simple health check - try to generate auth URL
        provider.generateAuthUrl();
        health[`saml_${name}`] = { status: 'healthy', lastCheck: now };
      } catch {
        health[`saml_${name}`] = { status: 'unhealthy', lastCheck: now };
      }
    }

    return health;
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): void {
    this.authMiddleware.cleanupExpiredSessions();
  }
}