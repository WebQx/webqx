import { BaseOAuth2Provider } from './base';
import { OAuth2Config, OAuth2TokenResponse, OAuth2UserInfo } from '../../types/oauth2';
import { SSOUser, SSOValidationError } from '../../types/common';

/**
 * Generic OAuth2 provider for custom identity providers
 */
export class GenericOAuth2Provider extends BaseOAuth2Provider {
  constructor(config: OAuth2Config) {
    super('generic', config);
    this.validateGenericConfig();
  }

  private validateGenericConfig(): void {
    const required = ['authorizationURL', 'tokenURL', 'userInfoURL'];
    for (const field of required) {
      if (!this.config[field as keyof OAuth2Config]) {
        throw new SSOValidationError(`Generic OAuth2 provider requires ${field}`);
      }
    }
  }

  protected getAuthorizationURL(): string {
    return this.config.authorizationURL!;
  }

  protected getTokenURL(): string {
    return this.config.tokenURL!;
  }

  protected getUserInfoURL(): string {
    return this.config.userInfoURL!;
  }

  protected addAuthParams(params: URLSearchParams): void {
    // Add any custom parameters from config
    if (this.config.customParams) {
      Object.entries(this.config.customParams).forEach(([key, value]) => {
        params.set(key, value);
      });
    }
  }

  protected processTokenResponse(tokenData: any): OAuth2TokenResponse {
    return {
      access_token: tokenData.access_token,
      token_type: tokenData.token_type || 'Bearer',
      expires_in: tokenData.expires_in,
      refresh_token: tokenData.refresh_token,
      scope: tokenData.scope,
      id_token: tokenData.id_token
    };
  }

  protected processUserInfo(userData: any): OAuth2UserInfo {
    // Use custom field mapping if provided
    const mapping = this.config.fieldMapping || {};
    
    return {
      sub: userData[mapping.id || 'sub'] || userData.id || userData.sub,
      id: userData[mapping.id || 'id'] || userData.id || userData.sub,
      email: userData[mapping.email || 'email'] || userData.email,
      name: userData[mapping.name || 'name'] || userData.name,
      given_name: userData[mapping.given_name || 'given_name'] || userData.given_name,
      family_name: userData[mapping.family_name || 'family_name'] || userData.family_name,
      picture: userData[mapping.picture || 'picture'] || userData.picture,
      roles: userData[mapping.roles || 'roles'] || userData.roles,
      groups: userData[mapping.groups || 'groups'] || userData.groups,
      // Include all original data for flexibility
      ...userData
    };
  }

  protected mapToSSOUser(userInfo: OAuth2UserInfo): SSOUser {
    return {
      id: userInfo.id || userInfo.sub || '',
      email: userInfo.email || '',
      name: userInfo.name || '',
      roles: Array.isArray(userInfo.roles) ? userInfo.roles : [],
      groups: Array.isArray(userInfo.groups) ? userInfo.groups : [],
      metadata: {
        provider: 'generic',
        protocol: 'oauth2',
        ...userInfo
      }
    };
  }

  /**
   * Set custom field mapping for user information
   */
  setFieldMapping(mapping: {
    id?: string;
    email?: string;
    name?: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
    roles?: string;
    groups?: string;
  }): void {
    this.config.fieldMapping = mapping;
  }

  /**
   * Set custom authentication parameters
   */
  setCustomParams(params: Record<string, string>): void {
    this.config.customParams = params;
  }

  /**
   * Configure token validation endpoint
   */
  setTokenValidationURL(url: string): void {
    this.config.tokenValidationURL = url;
  }

  /**
   * Validate token with provider's validation endpoint
   */
  async validateToken(accessToken: string): Promise<boolean> {
    if (!this.config.tokenValidationURL) {
      return true; // Skip validation if no endpoint configured
    }

    try {
      const response = await fetch(this.config.tokenValidationURL, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}