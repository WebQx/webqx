import { BaseOAuth2Provider } from './base';
import { OAuth2Config, OAuth2TokenResponse, OAuth2UserInfo } from '../../types/oauth2';
import { SSOUser } from '../../types/common';

/**
 * Azure Active Directory OAuth2 provider
 */
export class AzureOAuth2Provider extends BaseOAuth2Provider {
  constructor(config: OAuth2Config) {
    super('azure', config);
  }

  protected getAuthorizationURL(): string {
    const tenant = this.config.tenant || 'common';
    return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`;
  }

  protected getTokenURL(): string {
    const tenant = this.config.tenant || 'common';
    return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
  }

  protected getUserInfoURL(): string {
    return 'https://graph.microsoft.com/v1.0/me';
  }

  protected addAuthParams(params: URLSearchParams): void {
    // Azure AD specific parameters
    params.set('response_mode', 'query');
    
    // Add prompt parameter if needed for re-authentication
    if (this.config.prompt) {
      params.set('prompt', this.config.prompt);
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
      email: userData.mail || userData.userPrincipalName,
      name: userData.displayName,
      given_name: userData.givenName,
      family_name: userData.surname,
      picture: userData.photo?.['@odata.mediaReadLink'],
      jobTitle: userData.jobTitle,
      department: userData.department,
      companyName: userData.companyName,
      officeLocation: userData.officeLocation,
      businessPhones: userData.businessPhones,
      mobilePhone: userData.mobilePhone
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
        provider: 'azure',
        protocol: 'oauth2',
        jobTitle: userInfo.jobTitle,
        department: userInfo.department,
        companyName: userInfo.companyName,
        officeLocation: userInfo.officeLocation,
        businessPhones: userInfo.businessPhones,
        mobilePhone: userInfo.mobilePhone,
        picture: userInfo.picture
      }
    };
  }

  /**
   * Fetch user groups from Microsoft Graph
   */
  async fetchUserGroups(accessToken: string): Promise<string[]> {
    try {
      const response = await fetch('https://graph.microsoft.com/v1.0/me/memberOf', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.value?.map((group: any) => group.displayName || group.id) || [];
    } catch {
      return [];
    }
  }

  /**
   * Fetch user photo from Microsoft Graph
   */
  async fetchUserPhoto(accessToken: string): Promise<string | null> {
    try {
      const response = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        return null;
      }

      const photoBlob = await response.blob();
      // Convert blob to base64 data URL
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(photoBlob);
      });
    } catch {
      return null;
    }
  }

  /**
   * Enhanced authentication with additional Microsoft Graph data
   */
  async authenticateWithExtendedInfo(req: any): Promise<SSOUser> {
    const user = await this.authenticate(req);
    const { code } = req.query;
    
    // Get fresh token response for additional API calls
    const tokenResponse = await this.exchangeCodeForToken(code);
    
    // Fetch additional user data
    const [groups, photo] = await Promise.all([
      this.fetchUserGroups(tokenResponse.access_token),
      this.fetchUserPhoto(tokenResponse.access_token)
    ]);

    // Update user with additional information
    user.groups = groups;
    if (photo) {
      user.metadata = { ...user.metadata, photo };
    }

    return user;
  }
}