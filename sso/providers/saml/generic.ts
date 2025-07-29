import { BaseSAMLProvider } from './base';
import { SAMLConfig, SAMLAssertion } from '../../types/saml';
import { SSOUser, SSOValidationError } from '../../types/common';

/**
 * Generic SAML provider for custom identity providers
 */
export class GenericSAMLProvider extends BaseSAMLProvider {
  private attributeMapping: Record<string, string>;

  constructor(config: SAMLConfig) {
    super('generic-saml', config);
    this.attributeMapping = config.attributeMapping || this.getDefaultAttributeMapping();
  }

  /**
   * Get default attribute mapping
   */
  private getDefaultAttributeMapping(): Record<string, string> {
    return {
      id: 'nameidentifier',
      email: 'emailaddress',
      name: 'name',
      firstName: 'givenname',
      lastName: 'surname',
      groups: 'groups',
      roles: 'role'
    };
  }

  protected mapToSSOUser(assertion: SAMLAssertion): SSOUser {
    const attrs = assertion.attributes;
    
    // Use flexible attribute mapping
    const email = this.getAttributeByMapping(attrs, 'email') || assertion.nameID;
    const name = this.getAttributeByMapping(attrs, 'name') || '';
    const firstName = this.getAttributeByMapping(attrs, 'firstName');
    const lastName = this.getAttributeByMapping(attrs, 'lastName');
    const groups = this.getMultipleAttributesByMapping(attrs, 'groups');
    const roles = this.getMultipleAttributesByMapping(attrs, 'roles');
    
    const userId = this.getAttributeByMapping(attrs, 'id') || assertion.nameID;

    return {
      id: userId,
      email,
      name,
      roles,
      groups,
      metadata: {
        provider: 'generic-saml',
        protocol: 'saml',
        sessionIndex: assertion.sessionIndex,
        issuer: assertion.issuer,
        nameID: assertion.nameID,
        nameIDFormat: assertion.nameIDFormat,
        firstName,
        lastName,
        attributes: attrs
      }
    };
  }

  /**
   * Get attribute value using configured mapping
   */
  private getAttributeByMapping(
    attributes: Record<string, string | string[]>, 
    mappingKey: string
  ): string | undefined {
    const attributeName = this.attributeMapping[mappingKey];
    if (!attributeName) return undefined;

    // Try exact match first
    if (attributes[attributeName]) {
      const value = attributes[attributeName];
      return Array.isArray(value) ? value[0] : value;
    }

    // Try case-insensitive match
    const lowerAttributeName = attributeName.toLowerCase();
    for (const [key, value] of Object.entries(attributes)) {
      if (key.toLowerCase() === lowerAttributeName) {
        return Array.isArray(value) ? value[0] : value;
      }
    }

    // Try partial match for URN-style attributes
    for (const [key, value] of Object.entries(attributes)) {
      if (key.toLowerCase().includes(lowerAttributeName)) {
        return Array.isArray(value) ? value[0] : value;
      }
    }

    return undefined;
  }

  /**
   * Get multiple attribute values using configured mapping
   */
  private getMultipleAttributesByMapping(
    attributes: Record<string, string | string[]>, 
    mappingKey: string
  ): string[] {
    const attributeName = this.attributeMapping[mappingKey];
    if (!attributeName) return [];

    // Try exact match first
    if (attributes[attributeName]) {
      const value = attributes[attributeName];
      return Array.isArray(value) ? value : [value];
    }

    // Try case-insensitive match
    const lowerAttributeName = attributeName.toLowerCase();
    for (const [key, value] of Object.entries(attributes)) {
      if (key.toLowerCase() === lowerAttributeName) {
        return Array.isArray(value) ? value : [value];
      }
    }

    // Try partial match for URN-style attributes
    for (const [key, value] of Object.entries(attributes)) {
      if (key.toLowerCase().includes(lowerAttributeName)) {
        return Array.isArray(value) ? value : [value];
      }
    }

    return [];
  }

  /**
   * Set custom attribute mapping
   */
  setAttributeMapping(mapping: Record<string, string>): void {
    this.attributeMapping = { ...this.attributeMapping, ...mapping };
  }

  /**
   * Generate generic metadata XML
   */
  generateMetadata(callbackUrl: string): string {
    const issuer = this.config.issuer;
    const entityId = issuer;

    return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
                     xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
                     entityID="${entityId}">
  <md:SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:persistent</md:NameIDFormat>
    <md:NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:transient</md:NameIDFormat>
    <md:AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${callbackUrl}"
      index="0"
      isDefault="true" />
    <md:SingleLogoutService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
      Location="${callbackUrl}/logout" />
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
  }

  /**
   * Configure signature requirements
   */
  setSignatureRequirements(options: {
    requireSignedAssertion?: boolean;
    requireSignedResponse?: boolean;
    signatureAlgorithm?: string;
    digestAlgorithm?: string;
  }): void {
    this.config = {
      ...this.config,
      ...options
    };
  }
}