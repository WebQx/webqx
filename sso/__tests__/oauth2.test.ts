import { OAuth2ProviderFactory, AzureOAuth2Provider, GoogleOAuth2Provider, GenericOAuth2Provider } from '../providers/oauth2';
import { OAuth2Config } from '../types/oauth2';
import { SSOConfigurationError } from '../types/common';

describe('OAuth2 Provider Tests', () => {
  const mockAzureConfig: OAuth2Config = {
    provider: 'azure',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'https://localhost:3000/auth/oauth2/azure/callback',
    scope: ['openid', 'profile', 'email'],
    tenant: 'test-tenant'
  };

  const mockGoogleConfig: OAuth2Config = {
    provider: 'google',
    clientId: 'test-client-id.googleusercontent.com',
    clientSecret: 'test-client-secret',
    redirectUri: 'https://localhost:3000/auth/oauth2/google/callback',
    scope: ['openid', 'profile', 'email']
  };

  const mockGenericConfig: OAuth2Config = {
    provider: 'generic',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'https://localhost:3000/auth/oauth2/generic/callback',
    scope: ['openid', 'profile', 'email'],
    authorizationURL: 'https://example.com/oauth2/authorize',
    tokenURL: 'https://example.com/oauth2/token',
    userInfoURL: 'https://example.com/oauth2/userinfo'
  };

  describe('OAuth2ProviderFactory', () => {
    it('should create Azure OAuth2 provider', () => {
      const provider = OAuth2ProviderFactory.createProvider('azure', mockAzureConfig);
      expect(provider).toBeInstanceOf(AzureOAuth2Provider);
      expect(provider.name).toBe('azure');
      expect(provider.protocol).toBe('oauth2');
    });

    it('should create Google OAuth2 provider', () => {
      const provider = OAuth2ProviderFactory.createProvider('google', mockGoogleConfig);
      expect(provider).toBeInstanceOf(GoogleOAuth2Provider);
      expect(provider.name).toBe('google');
      expect(provider.protocol).toBe('oauth2');
    });

    it('should create Generic OAuth2 provider', () => {
      const provider = OAuth2ProviderFactory.createProvider('generic', mockGenericConfig);
      expect(provider).toBeInstanceOf(GenericOAuth2Provider);
      expect(provider.name).toBe('generic');
      expect(provider.protocol).toBe('oauth2');
    });

    it('should throw error for unsupported provider', () => {
      expect(() => {
        OAuth2ProviderFactory.createProvider('unsupported', mockAzureConfig);
      }).toThrow(SSOConfigurationError);
    });

    it('should get supported providers', () => {
      const supported = OAuth2ProviderFactory.getSupportedProviders();
      expect(supported).toContain('azure');
      expect(supported).toContain('google');
      expect(supported).toContain('generic');
    });

    it('should validate provider configuration', () => {
      expect(OAuth2ProviderFactory.validateConfig('azure', mockAzureConfig)).toBe(true);
      expect(OAuth2ProviderFactory.validateConfig('google', mockGoogleConfig)).toBe(true);
      expect(OAuth2ProviderFactory.validateConfig('generic', mockGenericConfig)).toBe(true);
    });

    it('should create multiple providers from config', () => {
      const configs = {
        azure: mockAzureConfig,
        google: mockGoogleConfig
      };
      
      const providers = OAuth2ProviderFactory.createProviders(configs);
      expect(Object.keys(providers)).toHaveLength(2);
      expect(providers.azure).toBeInstanceOf(AzureOAuth2Provider);
      expect(providers.google).toBeInstanceOf(GoogleOAuth2Provider);
    });
  });

  describe('AzureOAuth2Provider', () => {
    let provider: AzureOAuth2Provider;

    beforeEach(() => {
      provider = new AzureOAuth2Provider(mockAzureConfig);
    });

    it('should generate correct authorization URL', () => {
      const authUrl = provider.generateAuthUrl();
      expect(authUrl).toContain('login.microsoftonline.com');
      expect(authUrl).toContain('test-tenant');
      expect(authUrl).toContain('client_id=test-client-id');
      expect(authUrl).toContain('scope=openid+profile+email');
    });

    it('should create state object', () => {
      const state = provider.createState('https://example.com/redirect');
      expect(state.state).toBeDefined();
      expect(state.nonce).toBeDefined();
      expect(state.provider).toBe('azure');
      expect(state.redirectUri).toBe('https://example.com/redirect');
      expect(state.timestamp).toBeCloseTo(Date.now(), -100);
    });

    it('should validate state correctly', () => {
      const state = provider.createState();
      expect(provider.validateState(state.state, state)).toBe(true);
      expect(provider.validateState('invalid-state', state)).toBe(false);
      expect(provider.validateState(state.state, { ...state, timestamp: Date.now() - 10 * 60 * 1000 })).toBe(false);
    });
  });

  describe('GoogleOAuth2Provider', () => {
    let provider: GoogleOAuth2Provider;

    beforeEach(() => {
      provider = new GoogleOAuth2Provider(mockGoogleConfig);
    });

    it('should generate correct authorization URL', () => {
      const authUrl = provider.generateAuthUrl();
      expect(authUrl).toContain('accounts.google.com');
      expect(authUrl).toContain('client_id=test-client-id.googleusercontent.com');
      expect(authUrl).toContain('access_type=offline');
      expect(authUrl).toContain('include_granted_scopes=true');
    });
  });

  describe('GenericOAuth2Provider', () => {
    let provider: GenericOAuth2Provider;

    beforeEach(() => {
      provider = new GenericOAuth2Provider(mockGenericConfig);
    });

    it('should generate correct authorization URL', () => {
      const authUrl = provider.generateAuthUrl();
      expect(authUrl).toContain('example.com/oauth2/authorize');
      expect(authUrl).toContain('client_id=test-client-id');
    });

    it('should set field mapping', () => {
      const mapping = {
        id: 'user_id',
        email: 'email_address',
        name: 'full_name'
      };
      provider.setFieldMapping(mapping);
      expect(provider.config.fieldMapping).toEqual(mapping);
    });

    it('should set custom parameters', () => {
      const params = {
        prompt: 'consent',
        custom_param: 'value'
      };
      provider.setCustomParams(params);
      expect(provider.config.customParams).toEqual(params);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for missing required config fields', () => {
      const invalidConfig = {
        provider: 'azure',
        clientId: 'test-client-id'
        // Missing clientSecret, redirectUri, scope
      } as OAuth2Config;

      expect(() => {
        new AzureOAuth2Provider(invalidConfig);
      }).toThrow();
    });

    it('should throw error for generic provider without required URLs', () => {
      const invalidConfig = {
        provider: 'generic',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'https://localhost:3000/callback',
        scope: ['openid']
        // Missing authorizationURL, tokenURL, userInfoURL
      } as OAuth2Config;

      expect(() => {
        new GenericOAuth2Provider(invalidConfig);
      }).toThrow();
    });
  });
});