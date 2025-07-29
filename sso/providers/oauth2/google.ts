import { BaseOAuth2Provider } from './base';
import { OAuth2Config, OAuth2TokenResponse, OAuth2UserInfo } from '../../types/oauth2';
import { SSOUser } from '../../types/common';

/**
 * Google OAuth2 provider
 */
export class GoogleOAuth2Provider extends BaseOAuth2Provider {
  constructor(config: OAuth2Config) {
    super('google', config);
  }

  protected getAuthorizationURL(): string {
    return 'https://accounts.google.com/o/oauth2/v2/auth';
  }

  protected getTokenURL(): string {
    return 'https://oauth2.googleapis.com/token';
  }

  protected getUserInfoURL(): string {
    return 'https://www.googleapis.com/oauth2/v2/userinfo';
  }

  protected addAuthParams(params: URLSearchParams): void {
    // Google specific parameters
    params.set('access_type', 'offline');
    params.set('include_granted_scopes', 'true');
    
    // Add hosted domain restriction if configured
    if (this.config.hostedDomain) {
      params.set('hd', this.config.hostedDomain);
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
    return {
      sub: userData.id,
      id: userData.id,
      email: userData.email,
      name: userData.name,
      given_name: userData.given_name,
      family_name: userData.family_name,
      picture: userData.picture,
      locale: userData.locale,
      verified_email: userData.verified_email,
      hd: userData.hd // Hosted domain
    };
  }

  protected mapToSSOUser(userInfo: OAuth2UserInfo): SSOUser {
    return {
      id: userInfo.id || userInfo.sub,
      email: userInfo.email || '',
      name: userInfo.name || '',
      roles: userInfo.roles || [],
      groups: userInfo.groups || [],
      metadata: {
        provider: 'google',
        protocol: 'oauth2',
        given_name: userInfo.given_name,
        family_name: userInfo.family_name,
        picture: userInfo.picture,
        locale: userInfo.locale,
        verified_email: userInfo.verified_email,
        hd: userInfo.hd
      }
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuth2TokenResponse> {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });

    const response = await fetch(this.getTokenURL(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const tokenData = await response.json();
    return this.processTokenResponse(tokenData);
  }

  /**
   * Revoke access token
   */
  async revokeToken(token: string): Promise<boolean> {
    try {
      const response = await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}