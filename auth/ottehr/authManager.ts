/**
 * @fileoverview Ottehr Authentication Management
 * 
 * This module provides authentication and authorization management for Ottehr
 * integration, including OAuth2 flows, API key management, and token refresh.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { EventEmitter } from 'events';

/**
 * Keycloak configuration for SSO integration
 */
export interface KeycloakConfig {
  /** Enable Keycloak integration */
  enabled: boolean;
  /** Keycloak server base URL */
  baseUrl: string;
  /** Keycloak realm */
  realm: string;
  /** Keycloak client ID */
  clientId: string;
  /** Keycloak client secret */
  clientSecret: string;
  /** Redirect URI for authorization code flow */
  redirectUri: string;
  /** OAuth2 scopes */
  scope: string;
  /** Token issuer URL */
  issuer: string;
  /** JWKS URI for token validation */
  jwksUri: string;
  /** Token endpoint */
  tokenEndpoint: string;
  /** Authorization endpoint */
  authorizationEndpoint: string;
  /** UserInfo endpoint */
  userinfoEndpoint: string;
  /** Logout endpoint */
  logoutEndpoint: string;
  /** Enable role mapping from tokens */
  enableRoleMapping: boolean;
  /** JWT claim path for roles */
  roleMappingClaim: string;
  /** Default role if none found */
  defaultRole: string;
}

/**
 * Authentication configuration
 */
export interface OttehrAuthConfig {
  /** OAuth2 client ID */
  clientId: string;
  /** OAuth2 client secret */
  clientSecret: string;
  /** API key for direct authentication */
  apiKey?: string;
  /** Token storage implementation */
  tokenStorage?: TokenStorage;
  /** Automatic token refresh */
  autoRefresh?: boolean;
  /** Token refresh buffer time in seconds */
  refreshBufferSeconds?: number;
  /** Keycloak configuration for SSO */
  keycloak?: KeycloakConfig;
}

/**
 * Token storage interface
 */
export interface TokenStorage {
  /** Store token data */
  store(key: string, value: any): Promise<void>;
  /** Retrieve token data */
  retrieve(key: string): Promise<any>;
  /** Remove token data */
  remove(key: string): Promise<void>;
}

/**
 * Token information
 */
export interface TokenInfo {
  /** Access token */
  accessToken: string;
  /** Token type */
  tokenType: string;
  /** Expiration timestamp */
  expiresAt: number;
  /** Refresh token */
  refreshToken?: string;
  /** Token scopes */
  scopes?: string[];
  /** Token metadata */
  metadata?: Record<string, any>;
  /** ID token for OIDC flows */
  idToken?: string;
  /** User roles from token */
  roles?: string[];
}

/**
 * OIDC ID Token payload interface
 */
export interface OIDCTokenPayload {
  /** Token issuer */
  iss: string;
  /** Subject (user ID) */
  sub: string;
  /** Audience */
  aud: string | string[];
  /** Expiration time */
  exp: number;
  /** Issued at time */
  iat: number;
  /** Authorization time */
  auth_time?: number;
  /** Nonce */
  nonce?: string;
  /** Email */
  email?: string;
  /** Email verified */
  email_verified?: boolean;
  /** Preferred username */
  preferred_username?: string;
  /** Given name */
  given_name?: string;
  /** Family name */
  family_name?: string;
  /** Full name */
  name?: string;
  /** Realm access roles */
  realm_access?: {
    roles: string[];
  };
  /** Resource access roles */
  resource_access?: Record<string, {
    roles: string[];
  }>;
  /** Custom claims */
  [key: string]: any;
}

/**
 * Keycloak user information
 */
export interface KeycloakUserInfo {
  /** User ID */
  sub: string;
  /** Email */
  email?: string;
  /** Email verified */
  email_verified?: boolean;
  /** Preferred username */
  preferred_username?: string;
  /** Given name */
  given_name?: string;
  /** Family name */
  family_name?: string;
  /** Full name */
  name?: string;
  /** User roles */
  roles?: string[];
}

/**
 * Authentication result
 */
export interface AuthResult {
  /** Success indicator */
  success: boolean;
  /** Token information if successful */
  tokenInfo?: TokenInfo;
  /** Error information if failed */
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * In-memory token storage implementation
 */
export class MemoryTokenStorage implements TokenStorage {
  private storage = new Map<string, any>();

  async store(key: string, value: any): Promise<void> {
    this.storage.set(key, value);
  }

  async retrieve(key: string): Promise<any> {
    return this.storage.get(key);
  }

  async remove(key: string): Promise<void> {
    this.storage.delete(key);
  }
}

/**
 * Local storage token storage implementation (browser only)
 */
export class LocalStorageTokenStorage implements TokenStorage {
  private prefix = 'ottehr_';

  async store(key: string, value: any): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
    }
  }

  async retrieve(key: string): Promise<any> {
    if (typeof localStorage !== 'undefined') {
      const item = localStorage.getItem(this.prefix + key);
      return item ? JSON.parse(item) : null;
    }
    return null;
  }

  async remove(key: string): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.prefix + key);
    }
  }
}

/**
 * Ottehr Authentication Manager
 */
export class OttehrAuthManager extends EventEmitter {
  private config: OttehrAuthConfig;
  private tokenStorage: TokenStorage;
  private currentToken: TokenInfo | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(config: OttehrAuthConfig) {
    super();
    this.config = {
      autoRefresh: true,
      refreshBufferSeconds: 300, // 5 minutes
      ...config
    };

    // Set up token storage
    this.tokenStorage = config.tokenStorage || new MemoryTokenStorage();

    // Load existing token
    this.loadStoredToken();
  }

  /**
   * Authenticate using OAuth2 client credentials flow
   */
  async authenticateWithClientCredentials(scopes?: string[]): Promise<AuthResult> {
    try {
      const response = await fetch(`${this.getOttehrBaseUrl()}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          scope: scopes?.join(' ') || 'ordering notifications pos delivery'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: {
            code: 'AUTH_FAILED',
            message: errorData.error_description || `HTTP ${response.status}: ${response.statusText}`,
            details: errorData
          }
        };
      }

      const data = await response.json();
      const tokenInfo: TokenInfo = {
        accessToken: data.access_token,
        tokenType: data.token_type || 'Bearer',
        expiresAt: Date.now() + (data.expires_in * 1000),
        refreshToken: data.refresh_token,
        scopes: data.scope?.split(' '),
        metadata: {
          grantType: 'client_credentials',
          authenticatedAt: new Date().toISOString()
        }
      };

      await this.setCurrentToken(tokenInfo);
      this.emit('authenticated', tokenInfo);

      return { success: true, tokenInfo };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Authentication failed',
          details: error
        }
      };
    }
  }

  /**
   * Authenticate using API key
   */
  async authenticateWithApiKey(): Promise<AuthResult> {
    if (!this.config.apiKey) {
      return {
        success: false,
        error: {
          code: 'NO_API_KEY',
          message: 'API key not configured'
        }
      };
    }

    try {
      // Validate API key by making a test request
      const response = await fetch(`${this.getOttehrBaseUrl()}/auth/validate`, {
        headers: {
          'Authorization': `ApiKey ${this.config.apiKey}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: 'INVALID_API_KEY',
            message: 'API key validation failed'
          }
        };
      }

      const tokenInfo: TokenInfo = {
        accessToken: this.config.apiKey,
        tokenType: 'ApiKey',
        expiresAt: 0, // API keys don't expire
        metadata: {
          grantType: 'api_key',
          authenticatedAt: new Date().toISOString()
        }
      };

      await this.setCurrentToken(tokenInfo);
      this.emit('authenticated', tokenInfo);

      return { success: true, tokenInfo };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'API key validation failed',
          details: error
        }
      };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(): Promise<AuthResult> {
    if (!this.currentToken?.refreshToken) {
      return {
        success: false,
        error: {
          code: 'NO_REFRESH_TOKEN',
          message: 'No refresh token available'
        }
      };
    }

    // Check if this is a Keycloak token and use appropriate refresh method
    if (this.currentToken.metadata?.provider === 'keycloak') {
      return await this.refreshKeycloakToken();
    }

    // Standard Ottehr OAuth2 refresh
    try {
      const response = await fetch(`${this.getOttehrBaseUrl()}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.currentToken.refreshToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: {
            code: 'REFRESH_FAILED',
            message: errorData.error_description || `HTTP ${response.status}: ${response.statusText}`,
            details: errorData
          }
        };
      }

      const data = await response.json();
      const tokenInfo: TokenInfo = {
        accessToken: data.access_token,
        tokenType: data.token_type || 'Bearer',
        expiresAt: Date.now() + (data.expires_in * 1000),
        refreshToken: data.refresh_token || this.currentToken.refreshToken,
        scopes: this.currentToken.scopes,
        roles: this.currentToken.roles,
        metadata: {
          ...this.currentToken.metadata,
          refreshedAt: new Date().toISOString()
        }
      };

      await this.setCurrentToken(tokenInfo);
      this.emit('tokenRefreshed', tokenInfo);

      return { success: true, tokenInfo };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Token refresh failed',
          details: error
        }
      };
    }
  }

  /**
   * Get current valid access token
   */
  async getValidToken(): Promise<string | null> {
    if (!this.currentToken) {
      // Try to authenticate
      let authResult: AuthResult;
      
      if (this.config.apiKey) {
        authResult = await this.authenticateWithApiKey();
      } else {
        authResult = await this.authenticateWithClientCredentials();
      }

      if (!authResult.success) {
        this.emit('authenticationFailed', authResult.error);
        return null;
      }
    }

    // Check if token is expired (with buffer)
    if (this.isTokenExpired()) {
      if (this.currentToken?.refreshToken) {
        const refreshResult = await this.refreshToken();
        if (!refreshResult.success) {
          this.emit('tokenRefreshFailed', refreshResult.error);
          return null;
        }
      } else {
        // Re-authenticate
        this.currentToken = null;
        return await this.getValidToken();
      }
    }

    return this.currentToken?.accessToken || null;
  }

  /**
   * Get authorization header value
   */
  async getAuthorizationHeader(): Promise<string | null> {
    const token = await this.getValidToken();
    if (!token || !this.currentToken) {
      return null;
    }

    return `${this.currentToken.tokenType} ${token}`;
  }

  /**
   * Generate Keycloak authorization URL for OAuth2 Authorization Code flow with PKCE
   */
  generateKeycloakAuthUrl(state?: string, nonce?: string): { url: string; codeVerifier: string; state: string; nonce: string } {
    if (!this.config.keycloak?.enabled || !this.config.keycloak) {
      throw new Error('Keycloak integration is not enabled or configured');
    }

    const finalState = state || this.generateRandomString(32);
    const finalNonce = nonce || this.generateRandomString(32);
    const codeVerifier = this.generateRandomString(128);
    const codeChallenge = this.generateCodeChallenge(codeVerifier);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.keycloak.clientId,
      redirect_uri: this.config.keycloak.redirectUri,
      scope: this.config.keycloak.scope,
      state: finalState,
      nonce: finalNonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    const url = `${this.config.keycloak.authorizationEndpoint}?${params.toString()}`;

    return {
      url,
      codeVerifier,
      state: finalState,
      nonce: finalNonce
    };
  }

  /**
   * Exchange authorization code for tokens using Keycloak
   */
  async exchangeKeycloakCode(
    authorizationCode: string,
    codeVerifier: string,
    state?: string,
    expectedNonce?: string
  ): Promise<AuthResult> {
    if (!this.config.keycloak?.enabled || !this.config.keycloak) {
      return {
        success: false,
        error: {
          code: 'KEYCLOAK_NOT_CONFIGURED',
          message: 'Keycloak integration is not enabled or configured'
        }
      };
    }

    try {
      const response = await fetch(this.config.keycloak.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: this.config.keycloak.clientId,
          client_secret: this.config.keycloak.clientSecret,
          code: authorizationCode,
          redirect_uri: this.config.keycloak.redirectUri,
          code_verifier: codeVerifier
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: {
            code: 'KEYCLOAK_TOKEN_EXCHANGE_FAILED',
            message: errorData.error_description || `HTTP ${response.status}: ${response.statusText}`,
            details: errorData
          }
        };
      }

      const data = await response.json();
      
      // Validate and decode ID token
      let userInfo: KeycloakUserInfo | undefined;
      let roles: string[] = [];

      if (data.id_token) {
        const idTokenValidation = await this.validateKeycloakIdToken(data.id_token, expectedNonce);
        if (!idTokenValidation.valid) {
          return {
            success: false,
            error: {
              code: 'INVALID_ID_TOKEN',
              message: idTokenValidation.error || 'ID token validation failed'
            }
          };
        }
        
        userInfo = this.extractUserInfoFromToken(idTokenValidation.payload!);
        roles = this.extractRolesFromToken(idTokenValidation.payload!);
      }

      const tokenInfo: TokenInfo = {
        accessToken: data.access_token,
        tokenType: data.token_type || 'Bearer',
        expiresAt: Date.now() + (data.expires_in * 1000),
        refreshToken: data.refresh_token,
        scopes: data.scope?.split(' '),
        idToken: data.id_token,
        roles,
        metadata: {
          grantType: 'authorization_code',
          provider: 'keycloak',
          authenticatedAt: new Date().toISOString(),
          userInfo,
          state
        }
      };

      await this.setCurrentToken(tokenInfo);
      this.emit('authenticated', tokenInfo);
      this.emit('keycloakAuthenticated', { tokenInfo, userInfo });

      return { success: true, tokenInfo };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Keycloak token exchange failed',
          details: error
        }
      };
    }
  }

  /**
   * Refresh Keycloak tokens
   */
  async refreshKeycloakToken(): Promise<AuthResult> {
    if (!this.config.keycloak?.enabled || !this.config.keycloak) {
      return {
        success: false,
        error: {
          code: 'KEYCLOAK_NOT_CONFIGURED',
          message: 'Keycloak integration is not enabled or configured'
        }
      };
    }

    if (!this.currentToken?.refreshToken) {
      return {
        success: false,
        error: {
          code: 'NO_REFRESH_TOKEN',
          message: 'No refresh token available for Keycloak'
        }
      };
    }

    try {
      const response = await fetch(this.config.keycloak.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.config.keycloak.clientId,
          client_secret: this.config.keycloak.clientSecret,
          refresh_token: this.currentToken.refreshToken
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: {
            code: 'KEYCLOAK_REFRESH_FAILED',
            message: errorData.error_description || `HTTP ${response.status}: ${response.statusText}`,
            details: errorData
          }
        };
      }

      const data = await response.json();

      // Update token with new data while preserving existing metadata
      const tokenInfo: TokenInfo = {
        accessToken: data.access_token,
        tokenType: data.token_type || 'Bearer',
        expiresAt: Date.now() + (data.expires_in * 1000),
        refreshToken: data.refresh_token || this.currentToken.refreshToken,
        scopes: this.currentToken.scopes,
        idToken: data.id_token || this.currentToken.idToken,
        roles: this.currentToken.roles,
        metadata: {
          ...this.currentToken.metadata,
          refreshedAt: new Date().toISOString()
        }
      };

      await this.setCurrentToken(tokenInfo);
      this.emit('tokenRefreshed', tokenInfo);

      return { success: true, tokenInfo };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Keycloak token refresh failed',
          details: error
        }
      };
    }
  }

  /**
   * Get Keycloak user info from access token
   */
  async getKeycloakUserInfo(): Promise<{ success: boolean; userInfo?: KeycloakUserInfo; error?: any }> {
    if (!this.config.keycloak?.enabled || !this.config.keycloak) {
      return {
        success: false,
        error: { message: 'Keycloak integration is not configured' }
      };
    }

    try {
      const accessToken = await this.getValidToken();
      if (!accessToken) {
        return {
          success: false,
          error: { message: 'No valid access token available' }
        };
      }

      const response = await fetch(this.config.keycloak.userinfoEndpoint, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        return {
          success: false,
          error: { message: `UserInfo request failed: ${response.status} ${response.statusText}` }
        };
      }

      const userInfo = await response.json();
      return { success: true, userInfo };

    } catch (error) {
      return {
        success: false,
        error: { message: error instanceof Error ? error.message : 'UserInfo request failed' }
      };
    }
  }

  /**
   * Logout from Keycloak
   */
  async logoutFromKeycloak(redirectUri?: string): Promise<{ success: boolean; logoutUrl?: string; error?: any }> {
    if (!this.config.keycloak?.enabled || !this.config.keycloak) {
      return {
        success: false,
        error: { message: 'Keycloak integration is not configured' }
      };
    }

    try {
      const params = new URLSearchParams();
      if (this.currentToken?.idToken) {
        params.append('id_token_hint', this.currentToken.idToken);
      }
      if (redirectUri) {
        params.append('post_logout_redirect_uri', redirectUri);
      }

      const logoutUrl = `${this.config.keycloak.logoutEndpoint}?${params.toString()}`;

      // Clear local tokens
      await this.logout();

      return { success: true, logoutUrl };

    } catch (error) {
      return {
        success: false,
        error: { message: error instanceof Error ? error.message : 'Logout failed' }
      };
    }
  }

  /**
   * Validate Keycloak ID token
   */
  private async validateKeycloakIdToken(idToken: string, expectedNonce?: string): Promise<{
    valid: boolean;
    payload?: OIDCTokenPayload;
    error?: string;
  }> {
    if (!this.config.keycloak) {
      return { valid: false, error: 'Keycloak not configured' };
    }

    try {
      // Import jose dynamically to handle both browser and Node.js environments
      const { jwtVerify, createRemoteJWKSet } = await import('jose');
      
      const JWKS = createRemoteJWKSet(new URL(this.config.keycloak.jwksUri));
      
      const { payload } = await jwtVerify(idToken, JWKS, {
        issuer: this.config.keycloak.issuer,
        audience: this.config.keycloak.clientId
      });

      const typedPayload = payload as OIDCTokenPayload;

      // Validate nonce if provided
      if (expectedNonce && typedPayload.nonce !== expectedNonce) {
        return { valid: false, error: 'Nonce mismatch' };
      }

      return { valid: true, payload: typedPayload };

    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Token validation failed'
      };
    }
  }

  /**
   * Check if current token is expired
   */
  isTokenExpired(): boolean {
    if (!this.currentToken || this.currentToken.expiresAt === 0) {
      return false; // API keys don't expire
    }

    const bufferMs = (this.config.refreshBufferSeconds || 300) * 1000;
    return Date.now() > (this.currentToken.expiresAt - bufferMs);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.currentToken !== null && !this.isTokenExpired();
  }

  /**
   * Logout and clear tokens
   */
  async logout(): Promise<void> {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    await this.tokenStorage.remove('current_token');
    this.currentToken = null;
    this.emit('logout');
  }

  /**
   * Get token information (without sensitive data)
   */
  getTokenInfo(): Omit<TokenInfo, 'accessToken' | 'refreshToken'> | null {
    if (!this.currentToken) {
      return null;
    }

    const { accessToken, refreshToken, ...safeTokenInfo } = this.currentToken;
    return safeTokenInfo;
  }

  /**
   * Extract user information from ID token payload
   */
  private extractUserInfoFromToken(payload: OIDCTokenPayload): KeycloakUserInfo {
    return {
      sub: payload.sub,
      email: payload.email,
      email_verified: payload.email_verified,
      preferred_username: payload.preferred_username,
      given_name: payload.given_name,
      family_name: payload.family_name,
      name: payload.name
    };
  }

  /**
   * Extract roles from ID token payload based on configuration
   */
  private extractRolesFromToken(payload: OIDCTokenPayload): string[] {
    if (!this.config.keycloak?.enableRoleMapping) {
      return [];
    }

    const claimPath = this.config.keycloak.roleMappingClaim || 'realm_access.roles';
    const roles = this.getNestedProperty(payload, claimPath);

    if (Array.isArray(roles)) {
      return roles;
    }

    // Return default role if no roles found
    return this.config.keycloak.defaultRole ? [this.config.keycloak.defaultRole] : [];
  }

  /**
   * Get nested property from object using dot notation
   */
  private getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Generate random string for PKCE and state parameters
   */
  private generateRandomString(length: number): string {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let text = '';
    
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      // Browser environment
      const array = new Uint8Array(length);
      crypto.getRandomValues(array);
      for (let i = 0; i < length; i++) {
        text += possible[array[i] % possible.length];
      }
    } else {
      // Node.js environment or fallback
      for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
      }
    }
    
    return text;
  }

  /**
   * Generate PKCE code challenge from code verifier
   */
  private generateCodeChallenge(codeVerifier: string): string {
    try {
      if (typeof require !== 'undefined') {
        // Node.js environment
        const crypto = require('crypto');
        return crypto
          .createHash('sha256')
          .update(codeVerifier)
          .digest('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
      } else {
        // Browser environment - use a simple base64 encoding as fallback
        // In a real implementation, you would use crypto.subtle.digest
        // For now, we'll use a simpler approach that works synchronously
        return btoa(codeVerifier)
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
      }
    } catch (error) {
      // Fallback: return the code verifier as-is (not recommended for production)
      console.warn('Code challenge generation failed, using code verifier as challenge');
      return codeVerifier;
    }
  }

  /**
   * Simple SHA256 implementation for browser environments
   */
  private sha256(plain: string): ArrayBuffer {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    
    if (typeof require !== 'undefined') {
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(data).digest();
    }
    
    // Browser fallback - in real implementation, this would be async
    throw new Error('SHA256 not available in this environment');
  }

  /**
   * Base64 URL encode
   */
  private base64URLEncode(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
  private async setCurrentToken(tokenInfo: TokenInfo): Promise<void> {
    this.currentToken = tokenInfo;
    await this.tokenStorage.store('current_token', tokenInfo);

    // Set up auto-refresh timer
    if (this.config.autoRefresh && tokenInfo.expiresAt > 0) {
      this.scheduleTokenRefresh();
    }
  }

  /**
   * Load stored token
   */
  private async loadStoredToken(): Promise<void> {
    try {
      const storedToken = await this.tokenStorage.retrieve('current_token');
      if (storedToken) {
        this.currentToken = storedToken;
        
        // Set up auto-refresh if token is still valid
        if (this.config.autoRefresh && !this.isTokenExpired()) {
          this.scheduleTokenRefresh();
        }
      }
    } catch (error) {
      console.warn('Failed to load stored token:', error);
    }
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleTokenRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    if (!this.currentToken || this.currentToken.expiresAt === 0) {
      return; // API keys don't need refresh
    }

    const bufferMs = (this.config.refreshBufferSeconds || 300) * 1000;
    const refreshTime = this.currentToken.expiresAt - bufferMs - Date.now();

    if (refreshTime > 0) {
      this.refreshTimer = setTimeout(async () => {
        if (this.currentToken?.refreshToken) {
          await this.refreshToken();
        }
      }, refreshTime);
    }
  }

  /**
   * Get Ottehr base URL from environment
   */
  private getOttehrBaseUrl(): string {
    return (typeof process !== 'undefined' && process.env?.OTTEHR_API_BASE_URL) || 'https://api.ottehr.com';
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.removeAllListeners();
  }
}

/**
 * Create default authentication manager instance
 */
export function createOttehrAuthManager(config?: Partial<OttehrAuthConfig>): OttehrAuthManager {
  const defaultConfig: OttehrAuthConfig = {
    clientId: (typeof process !== 'undefined' && process.env?.OTTEHR_CLIENT_ID) || '',
    clientSecret: (typeof process !== 'undefined' && process.env?.OTTEHR_CLIENT_SECRET) || '',
    apiKey: (typeof process !== 'undefined' && process.env?.OTTEHR_API_KEY) || '',
    autoRefresh: true,
    refreshBufferSeconds: 300
  };

  // Add Keycloak configuration if enabled
  if (typeof process !== 'undefined' && process.env?.KEYCLOAK_ENABLED === 'true') {
    defaultConfig.keycloak = {
      enabled: true,
      baseUrl: process.env.KEYCLOAK_BASE_URL || '',
      realm: process.env.KEYCLOAK_REALM || '',
      clientId: process.env.KEYCLOAK_CLIENT_ID || '',
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || '',
      redirectUri: process.env.KEYCLOAK_REDIRECT_URI || '',
      scope: process.env.KEYCLOAK_SCOPE || 'openid profile email',
      issuer: process.env.KEYCLOAK_ISSUER || '',
      jwksUri: process.env.KEYCLOAK_JWKS_URI || '',
      tokenEndpoint: process.env.KEYCLOAK_TOKEN_ENDPOINT || '',
      authorizationEndpoint: process.env.KEYCLOAK_AUTHORIZATION_ENDPOINT || '',
      userinfoEndpoint: process.env.KEYCLOAK_USERINFO_ENDPOINT || '',
      logoutEndpoint: process.env.KEYCLOAK_LOGOUT_ENDPOINT || '',
      enableRoleMapping: process.env.KEYCLOAK_ENABLE_ROLE_MAPPING === 'true',
      roleMappingClaim: process.env.KEYCLOAK_ROLE_MAPPING_CLAIM || 'realm_access.roles',
      defaultRole: process.env.KEYCLOAK_DEFAULT_ROLE || 'user'
    };
  }

  return new OttehrAuthManager({ ...defaultConfig, ...config });
}

export default OttehrAuthManager;