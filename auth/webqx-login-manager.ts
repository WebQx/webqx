/**
 * @fileoverview WebQX Unified Login System - Keycloak Integration Example
 * 
 * This file demonstrates how to integrate Keycloak authentication
 * with the WebQX Unified Login System for seamless SSO experience.
 * 
 * @author WebQX Health
 * @version v0.1.0
 */

import type { KeycloakUser, KeycloakTokenInfo } from './keycloak/types';
import { getKeycloakProviderConfig } from './keycloak/client';

// Minimal auth shim to satisfy the interface used in this file without pulling in any external vendor-specific manager.
// In a real browser app, these would be implemented via keycloak-js or backend endpoints.
type TokenInfo = Partial<KeycloakTokenInfo> & { roles?: string[]; metadata?: Record<string, any> };
type KeycloakUserInfo = KeycloakUser;
type IdentityProviderName = 'keycloak' | 'microsoft' | 'google' | 'apple';

class MinimalAuthShim {
  private listeners: Record<string, Function[]> = {};
  generateKeycloakAuthUrl(identityProvider: string = 'keycloak'): { url: string; codeVerifier: string; state: string; nonce: string } {
    const providerConfig = getKeycloakProviderConfig();
    const cfg = providerConfig.keycloak;
    const state = Math.random().toString(36).slice(2);
    const nonce = Math.random().toString(36).slice(2);
    const codeVerifier = Math.random().toString(36).slice(2);
    const base = `${cfg.url}/realms/${cfg.realm}/protocol/openid-connect/auth`;
    const params = new URLSearchParams({
      client_id: cfg.clientId,
      response_type: 'code',
      redirect_uri: cfg.logoutRedirectUri || window.location.origin,
      state,
      nonce
    });
    if (identityProvider && identityProvider !== 'keycloak') {
      const idpHint = providerConfig.identityProviders?.[identityProvider]?.idpHint || identityProvider;
      if (idpHint) {
        params.append('kc_idp_hint', idpHint);
      }
    }
    const url = `${base}?${params.toString()}`;
    return { url, codeVerifier, state, nonce };
  }
  async exchangeKeycloakCode(_code: string, _verifier: string, _state: string, _nonce?: string): Promise<{ success: boolean; error?: { message: string } }> {
    // Delegate to backend in production; here we just return a stubbed success for typing
    return { success: true };
  }
  async logoutFromKeycloak(_redirectUrl?: string): Promise<{ success: boolean; logoutUrl?: string }> { return { success: true }; }
  async logout() { /* noop */ }
  isAuthenticated(): boolean { return false; }
  async getValidToken(): Promise<string | null> { return null; }
  async getAuthorizationHeader(): Promise<string | null> { return null; }
  async getKeycloakUserInfo(): Promise<{ success: boolean; userInfo?: KeycloakUserInfo }> { return { success: false }; }
  on(event: string, listener: Function) { (this.listeners[event] ||= []).push(listener); }
  off(event: string, listener: Function) { this.listeners[event] = (this.listeners[event] || []).filter(l => l !== listener); }
  emit(event: string, ...args: any[]) { (this.listeners[event] || []).forEach(fn => fn(...args)); }
  destroy() { this.listeners = {}; }
}

/**
 * WebQX Unified Login Manager with Keycloak SSO support
 */
export class WebQXLoginManager {
  private authManager = new MinimalAuthShim();
  private currentUser: KeycloakUserInfo | null = null;
  private userRoles: string[] = [];
  private activeIdentityProvider: string = 'keycloak';

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for authentication events
   */
  private setupEventListeners(): void {
    this.authManager.on('keycloakAuthenticated', this.handleKeycloakAuth.bind(this));
    this.authManager.on('authenticated', this.handleAuthentication.bind(this));
    this.authManager.on('authenticationFailed', this.handleAuthFailure.bind(this));
    this.authManager.on('logout', this.handleLogout.bind(this));
  }

  /**
   * Handle successful Keycloak authentication
   */
  private handleKeycloakAuth({ tokenInfo, userInfo }: { tokenInfo: TokenInfo; userInfo: KeycloakUserInfo }): void {
    this.currentUser = userInfo;
    this.userRoles = tokenInfo.roles || [];
    const provider = this.activeIdentityProvider || 'keycloak';
    
    // Emit custom event for WebQX application
    this.emit('userAuthenticated', {
      user: userInfo,
      roles: this.userRoles,
      provider,
      tokenInfo
    });

  console.log(`[WebQX Login] User authenticated via ${provider}:`, userInfo.username);
  }

  /**
   * Handle general authentication (fallback for non-Keycloak flows)
   */
  private handleAuthentication(tokenInfo: TokenInfo): void {
    if (tokenInfo.metadata?.provider !== 'keycloak') {
      // Handle other authentication methods
      this.emit('userAuthenticated', {
        tokenInfo,
        provider: tokenInfo.metadata?.grantType || 'custom'
      });
    }
  }

  /**
   * Handle authentication failure
   */
  private handleAuthFailure(error: any): void {
    console.error('[WebQX Login] Authentication failed:', error);
    this.emit('authenticationError', error);
  }

  /**
   * Handle logout
   */
  private handleLogout(): void {
    this.currentUser = null;
    this.userRoles = [];
    this.activeIdentityProvider = 'keycloak';
    this.emit('userLoggedOut');
    console.log('[WebQX Login] User logged out');
  }

  /**
   * Initiate Keycloak SSO login
   */
  async loginWithKeycloak(redirectAfterLogin?: string): Promise<void> {
    return this.loginWithIdentityProvider('keycloak', redirectAfterLogin);
  }

  async loginWithIdentityProvider(provider: IdentityProviderName, redirectAfterLogin?: string): Promise<void> {
    await this.initiateKeycloakLogin(provider, redirectAfterLogin);
  }

  async loginWithMicrosoft(redirectAfterLogin?: string): Promise<void> {
    return this.loginWithIdentityProvider('microsoft', redirectAfterLogin);
  }

  async loginWithGoogle(redirectAfterLogin?: string): Promise<void> {
    return this.loginWithIdentityProvider('google', redirectAfterLogin);
  }

  async loginWithApple(redirectAfterLogin?: string): Promise<void> {
    return this.loginWithIdentityProvider('apple', redirectAfterLogin);
  }

  private async initiateKeycloakLogin(provider: IdentityProviderName, redirectAfterLogin?: string): Promise<void> {
    try {
      const { url, codeVerifier, state, nonce } = this.authManager.generateKeycloakAuthUrl(provider);
      this.activeIdentityProvider = provider || 'keycloak';

      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('webqx_keycloak_provider', this.activeIdentityProvider);
        sessionStorage.setItem('webqx_keycloak_verifier', codeVerifier);
        sessionStorage.setItem('webqx_keycloak_state', state);
        sessionStorage.setItem('webqx_keycloak_nonce', nonce);
        if (redirectAfterLogin) {
          sessionStorage.setItem('webqx_redirect_after_login', redirectAfterLogin);
        }
      }

      window.location.href = url;
    } catch (error) {
      console.error(`[WebQX Login] Failed to initiate ${provider} login:`, error);
      throw error;
    }
  }

  /**
   * Handle Keycloak callback after authentication
   */
  async handleKeycloakCallback(): Promise<boolean> {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');

      if (error) {
        throw new Error(`Keycloak authentication error: ${error}`);
      }

      if (!code || !state) {
        throw new Error('Missing authorization code or state parameter');
      }

      // Retrieve PKCE parameters
      let codeVerifier: string | null = null;
      let expectedState: string | null = null;
      let expectedNonce: string | null = null;

      if (typeof sessionStorage !== 'undefined') {
        codeVerifier = sessionStorage.getItem('webqx_keycloak_verifier');
        expectedState = sessionStorage.getItem('webqx_keycloak_state');
        expectedNonce = sessionStorage.getItem('webqx_keycloak_nonce');
        const storedProvider = sessionStorage.getItem('webqx_keycloak_provider');
        if (storedProvider) {
          this.activeIdentityProvider = storedProvider as IdentityProviderName;
        } else {
          this.activeIdentityProvider = 'keycloak';
        }
      }

      if (!codeVerifier || !expectedState) {
        throw new Error('Missing PKCE parameters or session data');
      }

      // Validate state parameter
      if (state !== expectedState) {
        throw new Error('Invalid state parameter - possible CSRF attack');
      }

      // Exchange code for tokens
      const result = await this.authManager.exchangeKeycloakCode(
        code,
        codeVerifier,
        state,
        expectedNonce || undefined
      );

      if (!result.success) {
        throw new Error(result.error?.message || 'Token exchange failed');
      }

      // Clean up session storage
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('webqx_keycloak_verifier');
        sessionStorage.removeItem('webqx_keycloak_state');
        sessionStorage.removeItem('webqx_keycloak_nonce');
        sessionStorage.removeItem('webqx_keycloak_provider');
        
        // Handle redirect after login
        const redirectUrl = sessionStorage.getItem('webqx_redirect_after_login');
        if (redirectUrl) {
          sessionStorage.removeItem('webqx_redirect_after_login');
          window.location.href = redirectUrl;
          return true;
        }
      }

      // Authentication successful
      return true;

    } catch (error) {
      console.error('[WebQX Login] Keycloak callback handling failed:', error);
      this.emit('authenticationError', error);
      this.activeIdentityProvider = 'keycloak';
      return false;
    }
  }

  /**
   * Logout from all systems
   */
  async logout(redirectUrl?: string): Promise<void> {
    try {
      if (this.currentUser) {
        // Logout from Keycloak and redirect
        const result = await this.authManager.logoutFromKeycloak(redirectUrl);
        if (result.success && result.logoutUrl) {
          window.location.href = result.logoutUrl;
          return;
        }
      }

      // Fallback: local logout only
      await this.authManager.logout();
      
      if (redirectUrl) {
        window.location.href = redirectUrl;
      }
    } catch (error) {
      console.error('[WebQX Login] Logout failed:', error);
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.authManager.isAuthenticated();
  }

  /**
   * Get current user information
   */
  getCurrentUser(): KeycloakUserInfo | null {
    return this.currentUser;
  }

  /**
   * Get user roles
   */
  getUserRoles(): string[] {
    return [...this.userRoles];
  }

  /**
   * Check if user has specific role
   */
  hasRole(role: string): boolean {
    return this.userRoles.includes(role);
  }

  /**
   * Check if user has any of the specified roles
   */
  hasAnyRole(roles: string[]): boolean {
    return roles.some(role => this.userRoles.includes(role));
  }

  /**
   * Check if user has all of the specified roles
   */
  hasAllRoles(roles: string[]): boolean {
    return roles.every(role => this.userRoles.includes(role));
  }

  /**
   * Get access token for API calls
   */
  async getAccessToken(): Promise<string | null> {
    return await this.authManager.getValidToken();
  }

  /**
   * Get authorization header for API requests
   */
  async getAuthorizationHeader(): Promise<string | null> {
    return await this.authManager.getAuthorizationHeader();
  }

  /**
   * Refresh user information from Keycloak
   */
  async refreshUserInfo(): Promise<boolean> {
    try {
      const result = await this.authManager.getKeycloakUserInfo();
      if (result.success && result.userInfo) {
        this.currentUser = result.userInfo;
        return true;
      }
      return false;
    } catch (error) {
      console.error('[WebQX Login] Failed to refresh user info:', error);
      return false;
    }
  }

  /**
   * Event emitter functionality
   */
  private eventListeners: { [event: string]: Function[] } = {};

  on(event: string, listener: Function): void {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(listener);
  }

  off(event: string, listener: Function): void {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter(l => l !== listener);
    }
  }

  private emit(event: string, ...args: any[]): void {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(listener => listener(...args));
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.authManager.destroy();
    this.eventListeners = {};
    this.currentUser = null;
    this.userRoles = [];
    this.activeIdentityProvider = 'keycloak';
  }
}

/**
 * Default WebQX Login Manager instance
 */
export const webqxLogin = new WebQXLoginManager();

/**
 * Utility functions for role-based access control
 */
export const RoleGuards = {
  /**
   * Check if current user can access admin features
   */
  canAccessAdmin(): boolean {
    return webqxLogin.hasRole('admin');
  },

  /**
   * Check if current user can access pharmacy features
   */
  canAccessPharmacy(): boolean {
    return webqxLogin.hasAnyRole(['admin', 'pharmacy']);
  },

  /**
   * Check if current user can access delivery features
   */
  canAccessDelivery(): boolean {
    return webqxLogin.hasAnyRole(['admin', 'delivery']);
  },

  /**
   * Check if current user is a standard user
   */
  isStandardUser(): boolean {
    return webqxLogin.hasRole('user');
  },

  /**
   * Higher-order component for role-based access
   */
  requireRole(role: string): (target: any) => any {
    return function(target: any) {
      const originalMethod = target;
      return function(this: unknown, ...args: any[]) {
        if (!webqxLogin.hasRole(role)) {
          throw new Error(`Access denied: ${role} role required`);
        }
        return originalMethod.apply(this, args);
      };
    };
  },

  /**
   * Middleware for role-based route protection (Express.js style)
   */
  requireRoles(roles: string[]) {
    return (req: any, res: any, next: any) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'No authorization header' });
      }

      // In a real implementation, you would validate the token here
      // and extract roles from it
      if (!webqxLogin.hasAnyRole(roles)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    };
  }
};

export default WebQXLoginManager;