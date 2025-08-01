import { OAuth2Provider, OAuth2Config, OAuth2TokenResponse, OAuth2UserInfo, OAuth2State } from '../../types/oauth2';
import { SSOUser, SSOAuthenticationError, SSOValidationError } from '../../types/common';
import { CryptoUtils } from '../../utils/crypto';

/**
 * Base OAuth2 provider implementation
 * Provides common OAuth2 functionality that can be extended by specific providers
 */
export abstract class BaseOAuth2Provider implements OAuth2Provider {
  public protocol: 'oauth2' = 'oauth2';
  public name: string;
  public config: OAuth2Config;

  constructor(name: string, config: OAuth2Config) {
    this.name = name;
    this.config = config;
    this.validateConfig();
  }

  /**
   * Validate provider configuration
   */
  protected validateConfig(): void {
    const required = ['clientId', 'clientSecret', 'redirectUri', 'scope'];
    for (const field of required) {
      if (!this.config[field as keyof OAuth2Config]) {
        throw new SSOValidationError(`Missing required OAuth2 config field: ${field}`);
      }
    }
  }

  /**
   * Generate authorization URL
   */
  generateAuthUrl(state?: string): string {
    const authUrl = this.getAuthorizationURL();
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.config.redirectUri,
      scope: this.config.scope.join(' '),
      state: state || CryptoUtils.generateState()
    });

    // Add provider-specific parameters
    this.addAuthParams(params);

    return `${authUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string, state?: string): Promise<OAuth2TokenResponse> {
    const tokenUrl = this.getTokenURL();
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code,
      redirect_uri: this.config.redirectUri
    });

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new SSOAuthenticationError(`Token exchange failed: ${errorText}`);
      }

      const tokenData = await response.json();
      return this.processTokenResponse(tokenData);
    } catch (error) {
      if (error instanceof SSOAuthenticationError) {
        throw error;
      }
      throw new SSOAuthenticationError(`Token exchange error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Fetch user information using access token
   */
  async fetchUserInfo(accessToken: string): Promise<OAuth2UserInfo> {
    const userInfoUrl = this.getUserInfoURL();
    
    try {
      const response = await fetch(userInfoUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new SSOAuthenticationError(`User info fetch failed: ${errorText}`);
      }

      const userData = await response.json();
      return this.processUserInfo(userData);
    } catch (error) {
      if (error instanceof SSOAuthenticationError) {
        throw error;
      }
      throw new SSOAuthenticationError(`User info fetch error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Complete authentication flow
   */
  async authenticate(req: any): Promise<SSOUser> {
    const { code, state } = req.query;
    
    if (!code) {
      throw new SSOValidationError('Missing authorization code');
    }

    // Exchange code for token
    const tokenResponse = await this.exchangeCodeForToken(code, state);
    
    // Fetch user information
    const userInfo = await this.fetchUserInfo(tokenResponse.access_token);
    
    // Convert to standard user format
    return this.mapToSSOUser(userInfo);
  }

  /**
   * Create OAuth2 state object
   */
  createState(redirectUri?: string): OAuth2State {
    return {
      state: CryptoUtils.generateState(),
      nonce: CryptoUtils.generateNonce(),
      redirectUri,
      provider: this.name,
      timestamp: Date.now()
    };
  }

  /**
   * Validate OAuth2 state
   */
  validateState(stateParam: string, storedState: OAuth2State): boolean {
    if (!stateParam || !storedState) {
      return false;
    }

    // Check if state matches
    if (stateParam !== storedState.state) {
      return false;
    }

    // Check if state is not too old (5 minutes)
    const maxAge = 5 * 60 * 1000; // 5 minutes
    if (Date.now() - storedState.timestamp > maxAge) {
      return false;
    }

    return true;
  }

  // Abstract methods to be implemented by specific providers
  protected abstract getAuthorizationURL(): string;
  protected abstract getTokenURL(): string;
  protected abstract getUserInfoURL(): string;
  protected abstract addAuthParams(params: URLSearchParams): void;
  protected abstract processTokenResponse(tokenData: any): OAuth2TokenResponse;
  protected abstract processUserInfo(userData: any): OAuth2UserInfo;
  protected abstract mapToSSOUser(userInfo: OAuth2UserInfo): SSOUser;
}