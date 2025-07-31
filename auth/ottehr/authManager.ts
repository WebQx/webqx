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
   * Set current token and handle storage
   */
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

  return new OttehrAuthManager({ ...defaultConfig, ...config });
}

export default OttehrAuthManager;