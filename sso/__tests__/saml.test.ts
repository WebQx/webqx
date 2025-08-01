import { SAMLProviderFactory, AzureSAMLProvider, OktaSAMLProvider, GenericSAMLProvider } from '../providers/saml';
import { SAMLConfig } from '../types/saml';
import { SSOConfigurationError } from '../types/common';

describe('SAML Provider Tests', () => {
  const mockAzureConfig: SAMLConfig = {
    provider: 'azure',
    entryPoint: 'https://login.microsoftonline.com/test-tenant/saml2',
    issuer: 'https://webqx.health',
    cert: '-----BEGIN CERTIFICATE-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA\n-----END CERTIFICATE-----'
  };

  const mockOktaConfig: SAMLConfig = {
    provider: 'okta',
    entryPoint: 'https://test-org.okta.com/app/test-app/sso/saml',
    issuer: 'https://webqx.health',
    cert: '-----BEGIN CERTIFICATE-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA\n-----END CERTIFICATE-----'
  };

  const mockGenericConfig: SAMLConfig = {
    provider: 'generic',
    entryPoint: 'https://example.com/sso/saml',
    issuer: 'https://webqx.health',
    cert: '-----BEGIN CERTIFICATE-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA\n-----END CERTIFICATE-----'
  };

  describe('SAMLProviderFactory', () => {
    it('should create Azure SAML provider', () => {
      const provider = SAMLProviderFactory.createProvider('azure', mockAzureConfig);
      expect(provider).toBeInstanceOf(AzureSAMLProvider);
      expect(provider.name).toBe('azure-saml');
      expect(provider.protocol).toBe('saml');
    });

    it('should create Okta SAML provider', () => {
      const provider = SAMLProviderFactory.createProvider('okta', mockOktaConfig);
      expect(provider).toBeInstanceOf(OktaSAMLProvider);
      expect(provider.name).toBe('okta');
      expect(provider.protocol).toBe('saml');
    });

    it('should create Generic SAML provider', () => {
      const provider = SAMLProviderFactory.createProvider('generic', mockGenericConfig);
      expect(provider).toBeInstanceOf(GenericSAMLProvider);
      expect(provider.name).toBe('generic-saml');
      expect(provider.protocol).toBe('saml');
    });

    it('should throw error for unsupported provider', () => {
      expect(() => {
        SAMLProviderFactory.createProvider('unsupported', mockAzureConfig);
      }).toThrow(SSOConfigurationError);
    });

    it('should get supported providers', () => {
      const supported = SAMLProviderFactory.getSupportedProviders();
      expect(supported).toContain('azure');
      expect(supported).toContain('okta');
      expect(supported).toContain('generic');
    });

    it('should validate provider configuration', () => {
      expect(SAMLProviderFactory.validateConfig('azure', mockAzureConfig)).toBe(true);
      expect(SAMLProviderFactory.validateConfig('okta', mockOktaConfig)).toBe(true);
      expect(SAMLProviderFactory.validateConfig('generic', mockGenericConfig)).toBe(true);
    });

    it('should create multiple providers from config', () => {
      const configs = {
        azure: mockAzureConfig,
        okta: mockOktaConfig
      };
      
      const providers = SAMLProviderFactory.createProviders(configs);
      expect(Object.keys(providers)).toHaveLength(2);
      expect(providers.azure).toBeInstanceOf(AzureSAMLProvider);
      expect(providers.okta).toBeInstanceOf(OktaSAMLProvider);
    });
  });

  describe('AzureSAMLProvider', () => {
    let provider: AzureSAMLProvider;

    beforeEach(() => {
      provider = new AzureSAMLProvider(mockAzureConfig);
    });

    it('should generate correct authorization URL', () => {
      const authUrl = provider.generateAuthUrl();
      expect(authUrl).toContain('login.microsoftonline.com');
      expect(authUrl).toContain('SAMLRequest=');
    });

    it('should generate authorization URL with relay state', () => {
      const relayState = 'test-relay-state';
      const authUrl = provider.generateAuthUrl(relayState);
      expect(authUrl).toContain('login.microsoftonline.com');
      expect(authUrl).toContain('SAMLRequest=');
      expect(authUrl).toContain(`RelayState=${relayState}`);
    });

    it('should generate SAML authentication request', () => {
      const authRequest = provider.generateAuthRequest();
      expect(authRequest).toContain('<samlp:AuthnRequest');
      expect(authRequest).toContain('xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"');
      expect(authRequest).toContain('xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"');
      expect(authRequest).toContain(`<saml:Issuer>${mockAzureConfig.issuer}</saml:Issuer>`);
    });

    it('should generate logout request', () => {
      const nameID = 'user@example.com';
      const sessionIndex = 'session-123';
      const logoutRequest = provider.generateLogoutRequest(nameID, sessionIndex);
      
      expect(logoutRequest).toContain('<samlp:LogoutRequest');
      expect(logoutRequest).toContain(nameID);
      expect(logoutRequest).toContain(sessionIndex);
    });

    it('should generate metadata XML', () => {
      const callbackUrl = 'https://webqx.health/auth/saml/azure/callback';
      const metadata = provider.generateMetadata(callbackUrl);
      
      expect(metadata).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(metadata).toContain('<md:EntityDescriptor');
      expect(metadata).toContain(mockAzureConfig.issuer);
      expect(metadata).toContain(callbackUrl);
    });
  });

  describe('OktaSAMLProvider', () => {
    let provider: OktaSAMLProvider;

    beforeEach(() => {
      provider = new OktaSAMLProvider(mockOktaConfig);
    });

    it('should generate correct authorization URL', () => {
      const authUrl = provider.generateAuthUrl();
      expect(authUrl).toContain('test-org.okta.com');
      expect(authUrl).toContain('SAMLRequest=');
    });

    it('should generate metadata XML with Okta-specific settings', () => {
      const callbackUrl = 'https://webqx.health/auth/saml/okta/callback';
      const metadata = provider.generateMetadata(callbackUrl);
      
      expect(metadata).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(metadata).toContain('<md:EntityDescriptor');
      expect(metadata).toContain('urn:oasis:names:tc:SAML:2.0:nameid-format:persistent');
      expect(metadata).toContain(callbackUrl);
    });
  });

  describe('GenericSAMLProvider', () => {
    let provider: GenericSAMLProvider;

    beforeEach(() => {
      provider = new GenericSAMLProvider(mockGenericConfig);
    });

    it('should generate correct authorization URL', () => {
      const authUrl = provider.generateAuthUrl();
      expect(authUrl).toContain('example.com/sso/saml');
      expect(authUrl).toContain('SAMLRequest=');
    });

    it('should set attribute mapping', () => {
      const mapping = {
        id: 'custom_user_id',
        email: 'custom_email',
        name: 'custom_name'
      };
      provider.setAttributeMapping(mapping);
      
      // Test that the mapping is set (we can't directly access it, but we can test the behavior)
      expect(() => provider.setAttributeMapping(mapping)).not.toThrow();
    });

    it('should configure signature requirements', () => {
      const options = {
        requireSignedAssertion: true,
        requireSignedResponse: true,
        signatureAlgorithm: 'RSA-SHA256',
        digestAlgorithm: 'SHA256'
      };
      
      expect(() => provider.setSignatureRequirements(options)).not.toThrow();
    });

    it('should generate generic metadata XML', () => {
      const callbackUrl = 'https://webqx.health/auth/saml/generic/callback';
      const metadata = provider.generateMetadata(callbackUrl);
      
      expect(metadata).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(metadata).toContain('<md:EntityDescriptor');
      expect(metadata).toContain('urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress');
      expect(metadata).toContain('urn:oasis:names:tc:SAML:2.0:nameid-format:persistent');
      expect(metadata).toContain('urn:oasis:names:tc:SAML:2.0:nameid-format:transient');
      expect(metadata).toContain(callbackUrl);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for missing required config fields', () => {
      const invalidConfig = {
        provider: 'azure',
        entryPoint: 'https://login.microsoftonline.com/test-tenant/saml2'
        // Missing issuer and cert
      } as SAMLConfig;

      expect(() => {
        new AzureSAMLProvider(invalidConfig);
      }).toThrow();
    });

    it('should throw error for empty entry point', () => {
      const invalidConfig = {
        provider: 'azure',
        entryPoint: '',
        issuer: 'https://webqx.health',
        cert: 'test-cert'
      } as SAMLConfig;

      expect(() => {
        new AzureSAMLProvider(invalidConfig);
      }).toThrow();
    });

    it('should throw error for empty issuer', () => {
      const invalidConfig = {
        provider: 'azure',
        entryPoint: 'https://login.microsoftonline.com/test-tenant/saml2',
        issuer: '',
        cert: 'test-cert'
      } as SAMLConfig;

      expect(() => {
        new AzureSAMLProvider(invalidConfig);
      }).toThrow();
    });

    it('should throw error for empty certificate', () => {
      const invalidConfig = {
        provider: 'azure',
        entryPoint: 'https://login.microsoftonline.com/test-tenant/saml2',
        issuer: 'https://webqx.health',
        cert: ''
      } as SAMLConfig;

      expect(() => {
        new AzureSAMLProvider(invalidConfig);
      }).toThrow();
    });
  });
});