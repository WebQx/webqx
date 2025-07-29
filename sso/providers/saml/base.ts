import { SAMLProvider, SAMLConfig, SAMLAssertion } from '../../types/saml';
import { SSOUser, SSOAuthenticationError, SSOValidationError } from '../../types/common';
import { CryptoUtils } from '../../utils/crypto';
import { XMLUtils } from '../../utils/xml';

/**
 * Base SAML provider implementation
 */
export abstract class BaseSAMLProvider implements SAMLProvider {
  public protocol: 'saml' = 'saml';
  public name: string;
  public config: SAMLConfig;

  constructor(name: string, config: SAMLConfig) {
    this.name = name;
    this.config = config;
    this.validateConfig();
  }

  protected validateConfig(): void {
    const required = ['entryPoint', 'issuer', 'cert'];
    for (const field of required) {
      if (!this.config[field as keyof SAMLConfig]) {
        throw new SSOValidationError(`Missing required SAML config field: ${field}`);
      }
    }
  }

  /**
   * Generate authorization URL with SAML request
   */
  generateAuthUrl(relayState?: string): string {
    const samlRequest = this.generateAuthRequest(relayState);
    const encodedRequest = XMLUtils.deflateAndEncode(samlRequest);
    
    const params = new URLSearchParams({
      SAMLRequest: encodedRequest
    });

    if (relayState) {
      params.set('RelayState', relayState);
    }

    return `${this.config.entryPoint}?${params.toString()}`;
  }

  /**
   * Generate SAML authentication request
   */
  generateAuthRequest(relayState?: string): string {
    const id = '_' + CryptoUtils.generateSecureRandom(16);
    const issueInstant = new Date().toISOString();
    
    return XMLUtils.createAuthnRequest({
      id,
      issueInstant,
      destination: this.config.entryPoint,
      issuer: this.config.issuer,
      nameIDFormat: this.config.nameIDFormat
    });
  }

  /**
   * Validate SAML assertion
   */
  async validateAssertion(samlResponse: string): Promise<SAMLAssertion> {
    try {
      // Decode SAML response
      const decodedResponse = XMLUtils.base64Decode(samlResponse);
      const xmlDoc = XMLUtils.parseXML(decodedResponse);
      
      // Extract assertion
      const assertion = XMLUtils.extractAssertion(decodedResponse);
      
      // Validate signature if required
      if (this.config.cert) {
        const isValidSignature = XMLUtils.validateSignature(assertion, this.config.cert);
        if (!isValidSignature) {
          throw new SSOAuthenticationError('Invalid SAML assertion signature');
        }
      }

      // Extract assertion data
      const nameID = XMLUtils.extractNameID(assertion);
      const attributes = XMLUtils.extractAttributes(assertion);
      
      // Get session index and other metadata
      const sessionIndex = this.extractSessionIndex(assertion);
      const issuer = this.extractIssuer(assertion);
      
      return {
        nameID,
        nameIDFormat: this.config.nameIDFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        sessionIndex,
        attributes,
        issuer,
        notBefore: this.extractNotBefore(assertion),
        notOnOrAfter: this.extractNotOnOrAfter(assertion)
      };
    } catch (error) {
      if (error instanceof SSOAuthenticationError) {
        throw error;
      }
      throw new SSOAuthenticationError(`SAML assertion validation failed: ${error.message}`);
    }
  }

  /**
   * Complete authentication flow
   */
  async authenticate(req: any): Promise<SSOUser> {
    const { SAMLResponse, RelayState } = req.body;
    
    if (!SAMLResponse) {
      throw new SSOValidationError('Missing SAML response');
    }

    // Validate assertion
    const assertion = await this.validateAssertion(SAMLResponse);
    
    // Convert to standard user format
    return this.mapToSSOUser(assertion);
  }

  /**
   * Generate SAML logout request
   */
  generateLogoutRequest(nameID: string, sessionIndex?: string): string {
    const id = '_' + CryptoUtils.generateSecureRandom(16);
    const issueInstant = new Date().toISOString();
    
    return XMLUtils.createLogoutRequest({
      id,
      issueInstant,
      destination: this.getLogoutURL(),
      issuer: this.config.issuer,
      nameID,
      sessionIndex
    });
  }

  /**
   * Get logout URL
   */
  protected getLogoutURL(): string {
    // Default to entry point, can be overridden by specific providers
    return this.config.entryPoint;
  }

  /**
   * Extract session index from assertion
   */
  protected extractSessionIndex(assertion: any): string {
    const authnStatement = XMLUtils.findElement(assertion, 'AuthnStatement');
    return authnStatement ? XMLUtils.getElementAttribute(authnStatement, 'SessionIndex') : '';
  }

  /**
   * Extract issuer from assertion
   */
  protected extractIssuer(assertion: any): string {
    const issuerElement = XMLUtils.findElement(assertion, 'Issuer');
    return issuerElement ? XMLUtils.getElementText(issuerElement) : '';
  }

  /**
   * Extract NotBefore condition
   */
  protected extractNotBefore(assertion: any): Date | undefined {
    const conditions = XMLUtils.findElement(assertion, 'Conditions');
    if (conditions) {
      const notBefore = XMLUtils.getElementAttribute(conditions, 'NotBefore');
      return notBefore ? new Date(notBefore) : undefined;
    }
    return undefined;
  }

  /**
   * Extract NotOnOrAfter condition
   */
  protected extractNotOnOrAfter(assertion: any): Date | undefined {
    const conditions = XMLUtils.findElement(assertion, 'Conditions');
    if (conditions) {
      const notOnOrAfter = XMLUtils.getElementAttribute(conditions, 'NotOnOrAfter');
      return notOnOrAfter ? new Date(notOnOrAfter) : undefined;
    }
    return undefined;
  }

  /**
   * Validate assertion conditions (timing, audience, etc.)
   */
  protected validateConditions(assertion: SAMLAssertion): boolean {
    const now = new Date();
    
    // Check NotBefore
    if (assertion.notBefore && now < assertion.notBefore) {
      return false;
    }
    
    // Check NotOnOrAfter
    if (assertion.notOnOrAfter && now >= assertion.notOnOrAfter) {
      return false;
    }
    
    return true;
  }

  // Abstract method to be implemented by specific providers
  protected abstract mapToSSOUser(assertion: SAMLAssertion): SSOUser;
}