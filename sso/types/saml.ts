import { SSOProvider } from './common';

// SAML specific types
export interface SAMLConfig {
  provider: string;
  entryPoint: string;
  issuer: string;
  cert: string;
  privateCert?: string;
  decryptionPvk?: string;
  signatureAlgorithm?: string;
  digestAlgorithm?: string;
  nameIDFormat?: string;
  attributes?: string[];
}

export interface SAMLAssertion {
  nameID: string;
  nameIDFormat: string;
  sessionIndex: string;
  attributes: Record<string, string | string[]>;
  issuer: string;
  inResponseTo?: string;
  notBefore?: Date;
  notOnOrAfter?: Date;
}

export interface SAMLProvider extends SSOProvider {
  protocol: 'saml';
  config: SAMLConfig;
  generateAuthRequest(relayState?: string): string;
  validateAssertion(samlResponse: string): Promise<SAMLAssertion>;
}

export interface SAMLRequest {
  id: string;
  issueInstant: string;
  destination: string;
  issuer: string;
  nameIDPolicy?: {
    format: string;
    allowCreate: boolean;
  };
}

export interface SAMLLogoutRequest {
  id: string;
  issueInstant: string;
  destination: string;
  issuer: string;
  nameID: string;
  sessionIndex: string;
}