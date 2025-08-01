import { OAuth2Provider, OAuth2Config } from '../../types/oauth2';
import { SSOConfigurationError } from '../../types/common';
import { AzureOAuth2Provider } from './azure';
import { GoogleOAuth2Provider } from './google';
import { GenericOAuth2Provider } from './generic';

/**
 * OAuth2 provider factory
 * Creates appropriate OAuth2 provider instances based on configuration
 */
export class OAuth2ProviderFactory {
  /**
   * Create OAuth2 provider instance
   */
  static createProvider(providerName: string, config: OAuth2Config): OAuth2Provider {
    switch (providerName.toLowerCase()) {
      case 'azure':
      case 'azuread':
      case 'microsoft':
        return new AzureOAuth2Provider(config);
      
      case 'google':
        return new GoogleOAuth2Provider(config);
      
      case 'generic':
      case 'custom':
        return new GenericOAuth2Provider(config);
      
      default:
        throw new SSOConfigurationError(`Unsupported OAuth2 provider: ${providerName}`);
    }
  }

  /**
   * Get list of supported providers
   */
  static getSupportedProviders(): string[] {
    return ['azure', 'google', 'generic'];
  }

  /**
   * Validate provider configuration
   */
  static validateConfig(providerName: string, config: OAuth2Config): boolean {
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
  static createProviders(configs: Record<string, OAuth2Config>): Record<string, OAuth2Provider> {
    const providers: Record<string, OAuth2Provider> = {};
    
    Object.entries(configs).forEach(([name, config]) => {
      providers[name] = this.createProvider(config.provider || name, config);
    });
    
    return providers;
  }
}

// Export provider classes for direct use
export { AzureOAuth2Provider, GoogleOAuth2Provider, GenericOAuth2Provider };
export { BaseOAuth2Provider } from './base';