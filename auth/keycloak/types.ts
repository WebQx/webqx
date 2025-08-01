/**
 * WebQX™ Keycloak Types
 * 
 * Type definitions for Keycloak integration in healthcare authentication.
 */

import { UserRole, MedicalSpecialty } from '../types';

export interface KeycloakConfig {
  realm: string;
  url: string;
  clientId: string;
  clientSecret?: string;
  publicClient?: boolean;
  bearerOnly?: boolean;
  checkLoginIframe?: boolean;
  checkLoginIframeInterval?: number;
  onLoad?: 'login-required' | 'check-sso';
  responseMode?: 'fragment' | 'query';
  flow?: 'standard' | 'implicit' | 'hybrid';
  enableLogging?: boolean;
  pkceMethod?: 'S256';
  logoutRedirectUri?: string;
}

export interface KeycloakTokenInfo {
  token: string;
  refreshToken: string;
  idToken?: string;
  tokenParsed: KeycloakTokenParsed;
  refreshTokenParsed?: any;
  idTokenParsed?: any;
  timeSkew: number;
  authenticated: boolean;
  sessionId?: string;
  subject?: string;
}

export interface KeycloakTokenParsed {
  exp: number;
  iat: number;
  auth_time?: number;
  jti: string;
  iss: string;
  aud: string | string[];
  sub: string;
  typ: string;
  azp?: string;
  session_state?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  email?: string;
  email_verified?: boolean;
  realm_access?: {
    roles: string[];
  };
  resource_access?: {
    [clientId: string]: {
      roles: string[];
    };
  };
  scope?: string;
  // Healthcare-specific claims
  npi_number?: string;
  medical_license?: string;
  dea_number?: string;
  specialty?: string;
  department?: string;
  provider_verification_status?: string;
}

export interface KeycloakUser {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  emailVerified: boolean;
  roles: string[];
  groups: string[];
  attributes: Record<string, any>;
  // WebQX mapped fields
  webqxRole: UserRole;
  medicalSpecialty?: MedicalSpecialty;
  npiNumber?: string;
  medicalLicense?: string;
  deaNumber?: string;
  department?: string;
  verificationStatus?: 'VERIFIED' | 'PENDING' | 'REJECTED';
}

export interface KeycloakRoleMapping {
  keycloakRole: string;
  webqxRole: UserRole;
  specialty?: MedicalSpecialty;
  permissions: string[];
  requiredAttributes?: string[];
}

export interface KeycloakAuthResult {
  success: boolean;
  user?: KeycloakUser;
  token?: KeycloakTokenInfo;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface KeycloakProviderConfig {
  keycloak: KeycloakConfig;
  roleMappings: KeycloakRoleMapping[];
  enableProviderVerification: boolean;
  enableAuditLogging: boolean;
  tokenValidation: {
    checkTokenType: boolean;
    checkAudience: boolean;
    allowedAudiences?: string[];
    minimumTokenAge?: number;
    maximumTokenAge?: number;
  };
}