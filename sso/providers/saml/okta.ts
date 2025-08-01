import { BaseSAMLProvider } from './base';
import { SAMLConfig, SAMLAssertion } from '../../types/saml';
import { SSOUser } from '../../types/common';

/**
 * Okta SAML provider
 */
export class OktaSAMLProvider extends BaseSAMLProvider {
  constructor(config: SAMLConfig) {
    super('okta', config);
  }

  protected mapToSSOUser(assertion: SAMLAssertion): SSOUser {
    const attrs = assertion.attributes;
    
    // Okta attribute mappings
    const email = this.getAttributeValue(attrs, [
      'email',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'
    ]) || assertion.nameID;

    const name = this.getAttributeValue(attrs, [
      'displayName',
      'name',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'
    ]) || '';

    const firstName = this.getAttributeValue(attrs, [
      'firstName',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'
    ]);

    const lastName = this.getAttributeValue(attrs, [
      'lastName',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'
    ]);

    const groups = this.getAttributeValues(attrs, [
      'groups',
      'memberOf'
    ]);

    const roles = this.getAttributeValues(attrs, [
      'roles',
      'role'
    ]);

    const department = this.getAttributeValue(attrs, [
      'department',
      'dept'
    ]);

    const title = this.getAttributeValue(attrs, [
      'title',
      'jobTitle'
    ]);

    const userId = this.getAttributeValue(attrs, [
      'userId',
      'uid',
      'login'
    ]) || assertion.nameID;

    return {
      id: userId,
      email,
      name,
      roles,
      groups,
      metadata: {
        provider: 'okta',
        protocol: 'saml',
        sessionIndex: assertion.sessionIndex,
        issuer: assertion.issuer,
        nameID: assertion.nameID,
        nameIDFormat: assertion.nameIDFormat,
        firstName,
        lastName,
        department,
        title,
        attributes: attrs
      }
    };
  }

  /**
   * Get single attribute value with fallback options
   */
  private getAttributeValue(
    attributes: Record<string, string | string[]>, 
    names: string[]
  ): string | undefined {
    for (const name of names) {
      if (attributes[name]) {
        const value = attributes[name];
        return Array.isArray(value) ? value[0] : value;
      }
    }
    return undefined;
  }

  /**
   * Get multiple attribute values
   */
  private getAttributeValues(
    attributes: Record<string, string | string[]>, 
    names: string[]
  ): string[] {
    for (const name of names) {
      if (attributes[name]) {
        const value = attributes[name];
        return Array.isArray(value) ? value : [value];
      }
    }
    return [];
  }

  /**
   * Get Okta-specific logout URL
   */
  protected getLogoutURL(): string {
    // Okta logout endpoint
    const baseUrl = this.config.entryPoint.replace('/sso/saml', '/logout');
    return baseUrl;
  }

  /**
   * Generate Okta-specific metadata XML
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
}