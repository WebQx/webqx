import { BaseSAMLProvider } from './base';
import { SAMLConfig, SAMLAssertion } from '../../types/saml';
import { SSOUser } from '../../types/common';

/**
 * Azure Active Directory SAML provider
 */
export class AzureSAMLProvider extends BaseSAMLProvider {
  constructor(config: SAMLConfig) {
    super('azure-saml', config);
  }

  protected mapToSSOUser(assertion: SAMLAssertion): SSOUser {
    const attrs = assertion.attributes;
    
    // Azure AD attribute mappings
    const email = this.getAttributeValue(attrs, [
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
      'emailaddress'
    ]) || assertion.nameID;

    const name = this.getAttributeValue(attrs, [
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/displayname',
      'name',
      'displayname'
    ]) || '';

    const firstName = this.getAttributeValue(attrs, [
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
      'givenname'
    ]);

    const lastName = this.getAttributeValue(attrs, [
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
      'surname'
    ]);

    const groups = this.getAttributeValues(attrs, [
      'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups',
      'groups'
    ]);

    const roles = this.getAttributeValues(attrs, [
      'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
      'http://schemas.xmlsoap.org/claims/Group',
      'role'
    ]);

    const jobTitle = this.getAttributeValue(attrs, [
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/jobtitle',
      'jobtitle'
    ]);

    const department = this.getAttributeValue(attrs, [
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/department',
      'department'
    ]);

    const userId = this.getAttributeValue(attrs, [
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
      'http://schemas.microsoft.com/identity/claims/objectidentifier',
      'nameidentifier',
      'objectidentifier'
    ]) || assertion.nameID;

    return {
      id: userId,
      email,
      name,
      roles,
      groups,
      metadata: {
        provider: 'azure-saml',
        protocol: 'saml',
        sessionIndex: assertion.sessionIndex,
        issuer: assertion.issuer,
        nameID: assertion.nameID,
        nameIDFormat: assertion.nameIDFormat,
        firstName,
        lastName,
        jobTitle,
        department,
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
   * Get Azure-specific logout URL
   */
  protected getLogoutURL(): string {
    // Azure AD logout endpoint
    const baseUrl = this.config.entryPoint.replace('/saml2', '/logout');
    return baseUrl;
  }

  /**
   * Generate Azure-specific metadata XML
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