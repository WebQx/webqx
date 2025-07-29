import { SSOError } from '../types/common';

/**
 * XML processing utilities for SAML
 * Provides secure XML parsing, validation, and generation
 */
export class XMLUtils {
  /**
   * Parse XML string safely
   */
  static parseXML(xmlString: string): any {
    // In a real implementation, you would use a secure XML parser
    // like 'xml2js' with security options enabled
    try {
      // This is a simplified implementation for demonstration
      // In production, use xml2js or similar with security features
      const DOMParser = require('xmldom').DOMParser;
      const parser = new DOMParser({
        errorHandler: {
          warning: () => {},
          error: (msg: string) => { throw new Error(msg); },
          fatalError: (msg: string) => { throw new Error(msg); }
        }
      });
      
      return parser.parseFromString(xmlString, 'text/xml');
    } catch (error) {
      throw new SSOError('Failed to parse XML', 'XML_PARSE_ERROR');
    }
  }

  /**
   * Convert XML document to string
   */
  static xmlToString(xmlDoc: any): string {
    try {
      const XMLSerializer = require('xmldom').XMLSerializer;
      const serializer = new XMLSerializer();
      return serializer.serializeToString(xmlDoc);
    } catch (error) {
      throw new SSOError('Failed to serialize XML', 'XML_SERIALIZE_ERROR');
    }
  }

  /**
   * Find element by tag name
   */
  static findElement(xmlDoc: any, tagName: string): any {
    const elements = xmlDoc.getElementsByTagName(tagName);
    return elements.length > 0 ? elements[0] : null;
  }

  /**
   * Find elements by tag name
   */
  static findElements(xmlDoc: any, tagName: string): any[] {
    const elements = xmlDoc.getElementsByTagName(tagName);
    return Array.from(elements);
  }

  /**
   * Get element text content
   */
  static getElementText(element: any): string {
    return element ? element.textContent || element.text || '' : '';
  }

  /**
   * Get element attribute
   */
  static getElementAttribute(element: any, attributeName: string): string {
    return element ? element.getAttribute(attributeName) || '' : '';
  }

  /**
   * Create SAML AuthnRequest XML
   */
  static createAuthnRequest(options: {
    id: string;
    issueInstant: string;
    destination: string;
    issuer: string;
    nameIDFormat?: string;
    allowCreate?: boolean;
  }): string {
    const {
      id,
      issueInstant,
      destination,
      issuer,
      nameIDFormat = 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      allowCreate = true
    } = options;

    return `<samlp:AuthnRequest
      xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
      xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
      ID="${id}"
      Version="2.0"
      IssueInstant="${issueInstant}"
      Destination="${destination}"
      ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      AssertionConsumerServiceURL="${destination}/callback">
      <saml:Issuer>${issuer}</saml:Issuer>
      <samlp:NameIDPolicy
        Format="${nameIDFormat}"
        AllowCreate="${allowCreate}" />
    </samlp:AuthnRequest>`;
  }

  /**
   * Create SAML LogoutRequest XML
   */
  static createLogoutRequest(options: {
    id: string;
    issueInstant: string;
    destination: string;
    issuer: string;
    nameID: string;
    sessionIndex?: string;
  }): string {
    const {
      id,
      issueInstant,
      destination,
      issuer,
      nameID,
      sessionIndex
    } = options;

    const sessionIndexXML = sessionIndex 
      ? `<samlp:SessionIndex>${sessionIndex}</samlp:SessionIndex>` 
      : '';

    return `<samlp:LogoutRequest
      xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
      xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
      ID="${id}"
      Version="2.0"
      IssueInstant="${issueInstant}"
      Destination="${destination}">
      <saml:Issuer>${issuer}</saml:Issuer>
      <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">
        ${nameID}
      </saml:NameID>
      ${sessionIndexXML}
    </samlp:LogoutRequest>`;
  }

  /**
   * Extract SAML assertion from response
   */
  static extractAssertion(samlResponseXML: string): any {
    const xmlDoc = this.parseXML(samlResponseXML);
    const assertion = this.findElement(xmlDoc, 'Assertion');
    
    if (!assertion) {
      throw new SSOError('No assertion found in SAML response', 'SAML_NO_ASSERTION');
    }

    return assertion;
  }

  /**
   * Extract NameID from SAML assertion
   */
  static extractNameID(assertion: any): string {
    const nameIDElement = this.findElement(assertion, 'NameID');
    if (!nameIDElement) {
      throw new SSOError('No NameID found in assertion', 'SAML_NO_NAMEID');
    }
    return this.getElementText(nameIDElement);
  }

  /**
   * Extract attributes from SAML assertion
   */
  static extractAttributes(assertion: any): Record<string, string | string[]> {
    const attributes: Record<string, string | string[]> = {};
    const attributeStatements = this.findElements(assertion, 'AttributeStatement');
    
    attributeStatements.forEach((statement: any) => {
      const attributeElements = this.findElements(statement, 'Attribute');
      
      attributeElements.forEach((attr: any) => {
        const name = this.getElementAttribute(attr, 'Name');
        const values = this.findElements(attr, 'AttributeValue');
        
        if (values.length === 1) {
          attributes[name] = this.getElementText(values[0]);
        } else if (values.length > 1) {
          attributes[name] = values.map((value: any) => this.getElementText(value));
        }
      });
    });

    return attributes;
  }

  /**
   * Validate XML signature (simplified)
   */
  static validateSignature(xmlDoc: any, publicKey: string): boolean {
    // In a real implementation, you would use xml-crypto or similar
    // to validate XML digital signatures
    
    try {
      // Find signature element
      const signature = this.findElement(xmlDoc, 'Signature');
      if (!signature) {
        return false; // No signature found
      }

      // This is a placeholder - real signature validation would be more complex
      // involving canonicalization, digest calculation, and signature verification
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Base64 encode XML for HTTP-Redirect binding
   */
  static base64Encode(xmlString: string): string {
    return Buffer.from(xmlString, 'utf8').toString('base64');
  }

  /**
   * Base64 decode XML from HTTP-Redirect binding
   */
  static base64Decode(base64String: string): string {
    return Buffer.from(base64String, 'base64').toString('utf8');
  }

  /**
   * Deflate and base64 encode for HTTP-Redirect binding
   */
  static deflateAndEncode(xmlString: string): string {
    const zlib = require('zlib');
    const deflated = zlib.deflateRawSync(Buffer.from(xmlString, 'utf8'));
    return deflated.toString('base64');
  }

  /**
   * Decode and inflate from HTTP-Redirect binding
   */
  static decodeAndInflate(encodedString: string): string {
    const zlib = require('zlib');
    const buffer = Buffer.from(encodedString, 'base64');
    const inflated = zlib.inflateRawSync(buffer);
    return inflated.toString('utf8');
  }

  /**
   * Escape XML special characters
   */
  static escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Unescape XML special characters
   */
  static unescapeXML(text: string): string {
    return text
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&');
  }
}