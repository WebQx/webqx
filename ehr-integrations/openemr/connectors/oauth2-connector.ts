/**
 * OAuth2/OIDC Connector for OpenEMR Integration
 * 
 * Provides OAuth2 and OpenID Connect capabilities for integrating OpenEMR
 * with the WebQx platform's Unified Provider Login System.
 * 
 * Features:
 * - Central IDP delegation
 * - Token management and validation
 * - Secure token exchange
 * - User context mapping
 */

import type { 
  User, 
  AuthSession, 
  AuthResult, 
  AuthError,
  UserRole 
} from '../../../auth/types';

import type { 
  OpenEMRTokens, 
  OpenEMROperationResult,
  OpenEMRAuditEvent 
} from '../types';

export interface OAuth2ConnectorConfig {
  // Central IDP Configuration
  centralIdp: {
    issuer: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: string[];
    discoveryUrl?: string;
  };
  
  // OpenEMR Configuration
  openemr: {
    baseUrl: string;
    clientId: string;
    clientSecret: string;
    apiVersion: string;
  };
  
  // Token Configuration
  tokens: {
    accessTokenTtl: number; // seconds
    refreshTokenTtl: number; // seconds
    enableRefresh: boolean;
  };
  
  // Security Configuration
  security: {
    validateIssuer: boolean;
    validateAudience: boolean;
    clockSkewTolerance: number; // seconds
    enablePKCE: boolean;
  };
  
  // Audit Configuration
  audit: {
    enabled: boolean;
    logTokenExchange: boolean;
    logUserMapping: boolean;
  };
}

export interface TokenExchangeRequest {
  centralIdpToken: string;
  userContext: User;
  requestedScopes?: string[];
}

export interface TokenExchangeResult {
  success: boolean;
  openemrTokens?: OpenEMRTokens;
  error?: AuthError;
  userMapping?: OpenEMRUserMapping;
}

export interface OpenEMRUserMapping {
  webqxUserId: string;
  openemrUserId?: string;
  role: UserRole;
  permissions: string[];
  facilityAccess: string[];
  specialty?: string;
}

export interface PKCE {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256' | 'plain';
}

/**
 * OAuth2/OIDC Connector for OpenEMR Integration
 */
export class OAuth2Connector {
  private config: OAuth2ConnectorConfig;
  private discoveryDocument?: any;
  private auditEvents: OpenEMRAuditEvent[] = [];

  constructor(config: OAuth2ConnectorConfig) {
    this.config = config;
    
    // Validate configuration on construction
    this.validateConfig();
  }

  /**
   * Initialize the OAuth2 connector
   */
  async initialize(): Promise<void> {
    this.log('Initializing OAuth2 connector...');
    
    try {
      // Discover OIDC endpoints if discovery URL is provided
      if (this.config.centralIdp.discoveryUrl) {
        await this.discoverOIDCEndpoints();
      }
      
      // Validate configuration
      this.validateConfig();
      
      this.log('OAuth2 connector initialized successfully');
      this.auditLog({
        action: 'oauth_connector_initialized',
        resourceType: 'oauth_connector',
        userId: 'system',
        timestamp: new Date(),
        outcome: 'success'
      });
    } catch (error) {
      this.log('Failed to initialize OAuth2 connector:', error);
      this.auditLog({
        action: 'oauth_connector_initialization_failed',
        resourceType: 'oauth_connector',
        userId: 'system',
        timestamp: new Date(),
        outcome: 'failure',
        details: { error: error instanceof Error ? error.message : String(error) }
      });
      throw error;
    }
  }

  /**
   * Generate PKCE parameters for enhanced security
   */
  generatePKCE(): PKCE {
    const codeVerifier = this.generateRandomString(128);
    const codeChallenge = this.base64URLEncode(this.sha256(codeVerifier));
    
    return {
      codeVerifier,
      codeChallenge,
      codeChallengeMethod: 'S256'
    };
  }

  /**
   * Get authorization URL for central IDP
   */
  getAuthorizationUrl(state: string, pkce?: PKCE): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.centralIdp.clientId,
      redirect_uri: this.config.centralIdp.redirectUri,
      scope: this.config.centralIdp.scopes.join(' '),
      state: state
    });

    if (pkce && this.config.security.enablePKCE) {
      params.append('code_challenge', pkce.codeChallenge);
      params.append('code_challenge_method', pkce.codeChallengeMethod);
    }

    const authUrl = this.discoveryDocument?.authorization_endpoint || 
                   `${this.config.centralIdp.issuer}/oauth2/authorize`;
    
    return `${authUrl}?${params}`;
  }

  /**
   * Exchange authorization code for central IDP tokens
   */
  async exchangeCodeForCentralTokens(
    code: string, 
    state: string, 
    codeVerifier?: string
  ): Promise<AuthResult> {
    this.log('Exchanging authorization code for central IDP tokens...');

    try {
      const tokenEndpoint = this.discoveryDocument?.token_endpoint || 
                           `${this.config.centralIdp.issuer}/oauth2/token`;

      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.centralIdp.redirectUri,
        client_id: this.config.centralIdp.clientId
      });

      if (codeVerifier && this.config.security.enablePKCE) {
        body.append('code_verifier', codeVerifier);
      }

      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${this.base64Encode(`${this.config.centralIdp.clientId}:${this.config.centralIdp.clientSecret}`)}`
        },
        body
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token exchange failed: ${response.statusText} - ${errorText}`);
      }

      const tokenData = await response.json();
      
      // Validate and decode the ID token
      const userInfo = await this.validateAndDecodeToken(tokenData.id_token);
      
      const user: User = this.mapTokenToUser(userInfo);
      
      const session: AuthSession = {
        id: this.generateSessionId(),
        userId: user.id,
        token: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        ipAddress: 'unknown', // Will be set by middleware
        userAgent: 'unknown', // Will be set by middleware
        isActive: true,
        createdAt: new Date()
      };

      this.auditLog({
        action: 'central_idp_authentication_success',
        resourceType: 'oauth_token',
        userId: user.id,
        timestamp: new Date(),
        outcome: 'success'
      });

      return {
        success: true,
        user,
        session
      };
    } catch (error) {
      this.log('Central IDP token exchange failed:', error);
      this.auditLog({
        action: 'central_idp_authentication_failure',
        resourceType: 'oauth_token',
        userId: 'unknown',
        timestamp: new Date(),
        outcome: 'failure',
        details: { error: error instanceof Error ? error.message : String(error) }
      });
      
      return {
        success: false,
        error: {
          code: 'CENTRAL_IDP_TOKEN_EXCHANGE_FAILED' as const,
          message: error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error)
        }
      };
    }
  }

  /**
   * Exchange central IDP token for OpenEMR tokens
   */
  async exchangeForOpenEMRTokens(request: TokenExchangeRequest): Promise<TokenExchangeResult> {
    this.log('Exchanging central IDP token for OpenEMR tokens...');

    try {
      // Validate the central IDP token
      const tokenValidation = await this.validateCentralToken(request.centralIdpToken);
      if (!tokenValidation.valid) {
        throw new Error('Invalid central IDP token');
      }

      // Map user to OpenEMR context
      const userMapping = await this.mapUserToOpenEMR(request.userContext);
      
      // Request OpenEMR tokens using client credentials or token exchange
      const openemrTokens = await this.requestOpenEMRTokens(userMapping, request.requestedScopes);

      this.auditLog({
        action: 'openemr_token_exchange_success',
        resourceType: 'oauth_token',
        userId: request.userContext.id,
        timestamp: new Date(),
        outcome: 'success',
        details: { 
          openemrUserId: userMapping.openemrUserId,
          scopes: request.requestedScopes
        }
      });

      return {
        success: true,
        openemrTokens,
        userMapping
      };
    } catch (error) {
      this.log('OpenEMR token exchange failed:', error);
      this.auditLog({
        action: 'openemr_token_exchange_failure',
        resourceType: 'oauth_token',
        userId: request.userContext.id,
        timestamp: new Date(),
        outcome: 'failure',
        details: { error: error instanceof Error ? error.message : String(error) }
      });
      
      return {
        success: false,
        error: {
          code: 'OPENEMR_TOKEN_EXCHANGE_FAILED' as const,
          message: error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error)
        }
      };
    }
  }

  /**
   * Validate central IDP token
   */
  async validateCentralToken(token: string): Promise<{ valid: boolean; claims?: any; error?: string }> {
    try {
      const userInfoEndpoint = this.discoveryDocument?.userinfo_endpoint || 
                              `${this.config.centralIdp.issuer}/oauth2/userinfo`;

      const response = await fetch(userInfoEndpoint, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        return { 
          valid: false, 
          error: `Token validation failed: ${response.statusText}` 
        };
      }

      const claims = await response.json();
      
      // Additional validation based on configuration
      if (this.config.security.validateIssuer && claims.iss !== this.config.centralIdp.issuer) {
        return { 
          valid: false, 
          error: 'Invalid token issuer' 
        };
      }

      if (this.config.security.validateAudience && !claims.aud?.includes(this.config.centralIdp.clientId)) {
        return { 
          valid: false, 
          error: 'Invalid token audience' 
        };
      }

      return { valid: true, claims };
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Refresh OpenEMR tokens
   */
  async refreshOpenEMRTokens(refreshToken: string): Promise<OpenEMROperationResult<OpenEMRTokens>> {
    this.log('Refreshing OpenEMR tokens...');

    try {
      const response = await fetch(`${this.config.openemr.baseUrl}/oauth2/default/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${this.base64Encode(`${this.config.openemr.clientId}:${this.config.openemr.clientSecret}`)}`
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        })
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const tokenData = await response.json();
      
      const tokens: OpenEMRTokens = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || refreshToken,
        tokenType: tokenData.token_type || 'Bearer',
        expiresIn: tokenData.expires_in,
        scope: tokenData.scope,
        idToken: tokenData.id_token
      };

      return { success: true, data: tokens };
    } catch (error) {
      this.log('Token refresh failed:', error);
      return {
        success: false,
        error: {
          code: 'TOKEN_REFRESH_FAILED',
          message: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  /**
   * Revoke tokens
   */
  async revokeTokens(accessToken: string, refreshToken?: string): Promise<OpenEMROperationResult<boolean>> {
    this.log('Revoking tokens...');

    try {
      const revocationEndpoint = this.discoveryDocument?.revocation_endpoint || 
                                `${this.config.centralIdp.issuer}/oauth2/revoke`;

      // Revoke access token
      await fetch(revocationEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${this.base64Encode(`${this.config.centralIdp.clientId}:${this.config.centralIdp.clientSecret}`)}`
        },
        body: new URLSearchParams({
          token: accessToken,
          token_type_hint: 'access_token'
        })
      });

      // Revoke refresh token if provided
      if (refreshToken) {
        await fetch(revocationEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${this.base64Encode(`${this.config.centralIdp.clientId}:${this.config.centralIdp.clientSecret}`)}`
          },
          body: new URLSearchParams({
            token: refreshToken,
            token_type_hint: 'refresh_token'
          })
        });
      }

      return { success: true, data: true };
    } catch (error) {
      this.log('Token revocation failed:', error);
      return {
        success: false,
        error: {
          code: 'TOKEN_REVOCATION_FAILED',
          message: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  // Private helper methods

  private base64Encode(text: string): string {
    return Buffer.from(text).toString('base64');
  }

  private async discoverOIDCEndpoints(): Promise<void> {
    try {
      const response = await fetch(this.config.centralIdp.discoveryUrl!);
      if (!response.ok) {
        throw new Error(`OIDC discovery failed: ${response.statusText}`);
      }
      this.discoveryDocument = await response.json();
      this.log('OIDC endpoints discovered successfully');
    } catch (error) {
      this.log('OIDC discovery failed:', error);
      throw error;
    }
  }

  private validateConfig(): void {
    const required = [
      'centralIdp.issuer',
      'centralIdp.clientId', 
      'centralIdp.clientSecret',
      'centralIdp.redirectUri',
      'openemr.baseUrl',
      'openemr.clientId',
      'openemr.clientSecret'
    ];

    for (const field of required) {
      const keys = field.split('.');
      let value = this.config as any;
      for (const key of keys) {
        value = value?.[key];
      }
      if (!value) {
        throw new Error(`Missing required configuration: ${field}`);
      }
    }
  }

  private async validateAndDecodeToken(token: string): Promise<any> {
    // In a real implementation, this would validate the JWT signature
    // and decode the token properly using a JWT library
    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
      return decoded;
    } catch (error) {
      throw new Error('Invalid ID token format');
    }
  }

  private mapTokenToUser(tokenClaims: any): User {
    return {
      id: tokenClaims.sub,
      email: tokenClaims.email,
      firstName: tokenClaims.given_name || tokenClaims.name?.split(' ')[0] || '',
      lastName: tokenClaims.family_name || tokenClaims.name?.split(' ').slice(1).join(' ') || '',
      role: this.mapRoleFromToken(tokenClaims),
      specialty: tokenClaims.specialty,
      isVerified: tokenClaims.email_verified === true,
      mfaEnabled: false, // Will be determined by additional checks
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private mapRoleFromToken(tokenClaims: any): UserRole {
    const roleMapping: Record<string, UserRole> = {
      'patient': 'PATIENT',
      'provider': 'PROVIDER',
      'nurse': 'NURSE',
      'admin': 'ADMIN',
      'staff': 'STAFF',
      'resident': 'RESIDENT',
      'fellow': 'FELLOW',
      'attending': 'ATTENDING'
    };

    const tokenRole = tokenClaims.role || tokenClaims['custom:role'] || 'patient';
    return roleMapping[tokenRole.toLowerCase()] || 'PATIENT';
  }

  private async mapUserToOpenEMR(user: User): Promise<OpenEMRUserMapping> {
    // This would typically involve looking up the user in OpenEMR
    // or creating a mapping between WebQx and OpenEMR user IDs
    return {
      webqxUserId: user.id,
      openemrUserId: user.id, // Simplified mapping
      role: user.role,
      permissions: this.getPermissionsForRole(user.role),
      facilityAccess: [], // Would be determined based on user's affiliations
      specialty: user.specialty
    };
  }

  private getPermissionsForRole(role: UserRole): string[] {
    const rolePermissions: Record<UserRole, string[]> = {
      'PATIENT': ['read:own_records', 'create:appointments'],
      'PROVIDER': ['read:patient_records', 'write:prescriptions', 'write:clinical_notes'],
      'NURSE': ['read:patient_records', 'write:vitals', 'administer:medications'],
      'ADMIN': ['manage:users', 'configure:system', 'view:audit_logs'],
      'STAFF': ['read:patient_records', 'create:appointments'],
      'RESIDENT': ['read:patient_records', 'write:clinical_notes'],
      'FELLOW': ['read:patient_records', 'write:prescriptions', 'write:clinical_notes'],
      'ATTENDING': ['read:patient_records', 'write:prescriptions', 'write:clinical_notes', 'supervise:residents']
    };

    return rolePermissions[role] || [];
  }

  private async requestOpenEMRTokens(
    userMapping: OpenEMRUserMapping, 
    scopes?: string[]
  ): Promise<OpenEMRTokens> {
    const response = await fetch(`${this.config.openemr.baseUrl}/oauth2/default/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${this.base64Encode(`${this.config.openemr.clientId}:${this.config.openemr.clientSecret}`)}`
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: scopes?.join(' ') || 'openid fhirUser patient/Patient.read'
      })
    });

    if (!response.ok) {
      throw new Error(`OpenEMR token request failed: ${response.statusText}`);
    }

    const tokenData = await response.json();
    
    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenType: tokenData.token_type || 'Bearer',
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope,
      idToken: tokenData.id_token
    };
  }

  private generateSessionId(): string {
    return 'sess_' + Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  private generateRandomString(length: number): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
  }

  private sha256(text: string): ArrayBuffer {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(text);
    return hash.digest();
  }

  private base64URLEncode(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const binary = String.fromCharCode(...bytes);
    return Buffer.from(binary, 'binary').toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private auditLog(event: OpenEMRAuditEvent): void {
    if (this.config.audit?.enabled) {
      this.auditEvents.push(event);
      this.log(`[AUDIT] ${event.action}: ${event.outcome}`);
    }
  }

  private log(message: string, ...args: any[]): void {
    console.log(`[OAuth2 Connector] ${message}`, ...args);
  }
}