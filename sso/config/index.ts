import { SSOConfig, SSOConfigurationError } from '../types/common';

/**
 * SSO configuration management
 */
export class SSOConfigManager {
  private config: SSOConfig;

  constructor(config: Partial<SSOConfig>) {
    this.config = this.validateAndMergeConfig(config);
  }

  /**
   * Validate and merge configuration with defaults
   */
  private validateAndMergeConfig(userConfig: Partial<SSOConfig>): SSOConfig {
    const defaultConfig: SSOConfig = {
      secretKey: '',
      sessionTimeout: 3600000, // 1 hour
      auditEnabled: true,
      providers: {}
    };

    const mergedConfig = { ...defaultConfig, ...userConfig };

    // Validate required fields
    if (!mergedConfig.secretKey) {
      throw new SSOConfigurationError('SSO secret key is required');
    }

    if (mergedConfig.secretKey.length < 32) {
      throw new SSOConfigurationError('SSO secret key must be at least 32 characters long');
    }

    if (mergedConfig.sessionTimeout < 60000) {
      throw new SSOConfigurationError('Session timeout must be at least 60 seconds');
    }

    return mergedConfig;
  }

  /**
   * Get configuration
   */
  getConfig(): SSOConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<SSOConfig>): void {
    this.config = this.validateAndMergeConfig({ ...this.config, ...updates });
  }

  /**
   * Get secret key
   */
  getSecretKey(): string {
    return this.config.secretKey;
  }

  /**
   * Get session timeout
   */
  getSessionTimeout(): number {
    return this.config.sessionTimeout;
  }

  /**
   * Check if audit logging is enabled
   */
  isAuditEnabled(): boolean {
    return this.config.auditEnabled;
  }

  /**
   * Get OAuth2 provider configurations
   */
  getOAuth2Providers(): Record<string, any> {
    return this.config.providers.oauth2 || {};
  }

  /**
   * Get SAML provider configurations
   */
  getSAMLProviders(): Record<string, any> {
    return this.config.providers.saml || {};
  }

  /**
   * Get user mapping configuration
   */
  getUserMapping(): SSOConfig['userMapping'] {
    return this.config.userMapping;
  }

  /**
   * Add OAuth2 provider
   */
  addOAuth2Provider(name: string, config: any): void {
    if (!this.config.providers.oauth2) {
      this.config.providers.oauth2 = {};
    }
    this.config.providers.oauth2[name] = config;
  }

  /**
   * Add SAML provider
   */
  addSAMLProvider(name: string, config: any): void {
    if (!this.config.providers.saml) {
      this.config.providers.saml = {};
    }
    this.config.providers.saml[name] = config;
  }

  /**
   * Remove provider
   */
  removeProvider(protocol: 'oauth2' | 'saml', name: string): void {
    if (this.config.providers[protocol] && this.config.providers[protocol][name]) {
      delete this.config.providers[protocol][name];
    }
  }

  /**
   * Load configuration from environment variables
   */
  static fromEnvironment(): SSOConfigManager {
    const config: Partial<SSOConfig> = {
      secretKey: process.env.SSO_SECRET_KEY || '',
      sessionTimeout: parseInt(process.env.SSO_SESSION_TIMEOUT || '3600000'),
      auditEnabled: process.env.SSO_AUDIT_ENABLED !== 'false',
      providers: {}
    };

    // Load OAuth2 providers from environment
    if (process.env.OAUTH2_CLIENT_ID) {
      config.providers!.oauth2 = {
        default: {
          provider: process.env.OAUTH2_PROVIDER || 'generic',
          clientId: process.env.OAUTH2_CLIENT_ID,
          clientSecret: process.env.OAUTH2_CLIENT_SECRET,
          redirectUri: process.env.OAUTH2_REDIRECT_URI,
          scope: (process.env.OAUTH2_SCOPE || 'openid profile email').split(' '),
          authorizationURL: process.env.OAUTH2_AUTHORIZATION_URL,
          tokenURL: process.env.OAUTH2_TOKEN_URL,
          userInfoURL: process.env.OAUTH2_USERINFO_URL,
          tenant: process.env.OAUTH2_TENANT
        }
      };
    }

    // Load SAML providers from environment
    if (process.env.SAML_ENTRY_POINT) {
      config.providers!.saml = {
        default: {
          provider: process.env.SAML_PROVIDER || 'generic',
          entryPoint: process.env.SAML_ENTRY_POINT,
          issuer: process.env.SAML_ISSUER,
          cert: process.env.SAML_CERT,
          privateCert: process.env.SAML_PRIVATE_CERT,
          decryptionPvk: process.env.SAML_DECRYPTION_PVK
        }
      };
    }

    return new SSOConfigManager(config);
  }

  /**
   * Load configuration from JSON file
   */
  static fromFile(filePath: string): SSOConfigManager {
    try {
      const fs = require('fs');
      const configData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return new SSOConfigManager(configData);
    } catch (error) {
      throw new SSOConfigurationError(`Failed to load configuration from ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Export configuration to JSON
   */
  toJSON(): string {
    // Remove sensitive data for export
    const exportConfig = { ...this.config };
    exportConfig.secretKey = '[REDACTED]';
    
    if (exportConfig.providers.oauth2) {
      Object.keys(exportConfig.providers.oauth2).forEach(key => {
        if (exportConfig.providers.oauth2![key].clientSecret) {
          exportConfig.providers.oauth2![key].clientSecret = '[REDACTED]';
        }
      });
    }

    if (exportConfig.providers.saml) {
      Object.keys(exportConfig.providers.saml).forEach(key => {
        if (exportConfig.providers.saml![key].privateCert) {
          exportConfig.providers.saml![key].privateCert = '[REDACTED]';
        }
        if (exportConfig.providers.saml![key].decryptionPvk) {
          exportConfig.providers.saml![key].decryptionPvk = '[REDACTED]';
        }
      });
    }

    return JSON.stringify(exportConfig, null, 2);
  }
}