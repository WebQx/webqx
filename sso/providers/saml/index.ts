import { SAMLProvider, SAMLConfig } from '../../types/saml';
import { SSOConfigurationError } from '../../types/common';
import { AzureSAMLProvider } from './azure';
import { OktaSAMLProvider } from './okta';
import { GenericSAMLProvider } from './generic';

/**
 * SAML provider factory
 * Creates appropriate SAML provider instances based on configuration
 */
export class SAMLProviderFactory {
  /**
   * Create SAML provider instance
   */
  static createProvider(providerName: string, config: SAMLConfig): SAMLProvider {
    switch (providerName.toLowerCase()) {
      case 'azure':
      case 'azuread':
      case 'azure-saml':
        return new AzureSAMLProvider(config);
      
      case 'okta':
        return new OktaSAMLProvider(config);
      
      case 'generic':
      case 'generic-saml':
      case 'custom':
        return new GenericSAMLProvider(config);
      
      default:
        throw new SSOConfigurationError(`Unsupported SAML provider: ${providerName}`);
    }
  }

  /**
   * Get list of supported providers
   */
  static getSupportedProviders(): string[] {
    return ['azure', 'okta', 'generic'];
  }

  /**
   * Validate provider configuration
   */
  static validateConfig(providerName: string, config: SAMLConfig): boolean {
    try {
      this.createProvider(providerName, config);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create multiple providers from configuration
   */
  static createProviders(configs: Record<string, SAMLConfig>): Record<string, SAMLProvider> {
    const providers: Record<string, SAMLProvider> = {};
    
    Object.entries(configs).forEach(([name, config]) => {
      providers[name] = this.createProvider(config.provider || name, config);
    });
    
    return providers;
  }
}

// Export provider classes for direct use
export { AzureSAMLProvider, OktaSAMLProvider, GenericSAMLProvider };
export { BaseSAMLProvider } from './base';