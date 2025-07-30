import { SSOProvider } from './common';

// OAuth2 specific types
export interface OAuth2Config {
  provider: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
  authorizationURL?: string;
  tokenURL?: string;
  userInfoURL?: string;
  tenant?: string; // For Azure AD multi-tenant
  prompt?: string; // For re-authentication prompts
  hostedDomain?: string; // For Google hosted domain
  customParams?: Record<string, string>; // For generic providers
  fieldMapping?: Record<string, string>; // For custom field mapping
  tokenValidationURL?: string; // For token validation
}

export interface OAuth2TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

export interface OAuth2UserInfo {
  sub?: string;
  id?: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  groups?: string[];
  roles?: string[];
  [key: string]: any;
}

export interface OAuth2Provider extends SSOProvider {
  protocol: 'oauth2';
  config: OAuth2Config;
  exchangeCodeForToken(code: string, state?: string): Promise<OAuth2TokenResponse>;
  fetchUserInfo(accessToken: string): Promise<OAuth2UserInfo>;
  createState(redirectUri?: string): OAuth2State;
  generateAuthUrl(state?: string): string;
}

export interface OAuth2State {
  state: string;
  nonce?: string;
  redirectUri?: string;
  provider: string;
  timestamp: number;
}