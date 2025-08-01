/**
 * WebQX™ Keycloak Authentication Provider
 * 
 * Main authentication provider implementation for Keycloak integration.
 */

import { 
  AuthProvider, 
  AuthCredentials, 
  AuthResult, 
  CreateUserData, 
  User, 
  AuthSession,
  AuthProviderConfig 
} from '../types';
import { 
  KeycloakConfig, 
  KeycloakUser, 
  KeycloakAuthResult, 
  KeycloakProviderConfig,
  KeycloakTokenInfo 
} from './types';
import { 
  getKeycloakProviderConfig, 
  createKeycloakConnect 
} from './client';
import { 
  validateKeycloakToken, 
  mapKeycloakRoles, 
  tokenToUser 
} from './middleware';
import { v4 as uuidv4 } from 'uuid';

export class KeycloakAuthProvider implements AuthProvider {
  public readonly name = 'keycloak';
  private config: KeycloakProviderConfig;
  private keycloakConnect: any;
  private initialized = false;

  constructor() {
    this.config = getKeycloakProviderConfig();
  }

  /**
   * Initialize the Keycloak provider
   */
  async initialize(config: AuthProviderConfig): Promise<void> {
    try {
      // Override default config with provided values
      if (config.keycloakUrl) this.config.keycloak.url = config.keycloakUrl;
      if (config.keycloakRealm) this.config.keycloak.realm = config.keycloakRealm;
      if (config.keycloakClientId) this.config.keycloak.clientId = config.keycloakClientId;
      if (config.keycloakClientSecret) this.config.keycloak.clientSecret = config.keycloakClientSecret;

      // Initialize Keycloak Connect for server-side operations
      // Note: Session would be provided by the application
      this.keycloakConnect = createKeycloakConnect(null, this.config.keycloak);

      this.initialized = true;
      console.log('Keycloak Auth Provider initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Keycloak Auth Provider:', error);
      throw error;
    }
  }

  /**
   * Authenticate user with Keycloak token
   * Note: This assumes the client has already obtained the token from Keycloak
   */
  async authenticate(credentials: AuthCredentials & { token?: string }): Promise<AuthResult> {
    if (!this.initialized) {
      throw new Error('Keycloak provider not initialized');
    }

    try {
      // If token is provided, validate it directly
      if (credentials.token) {
        return await this.authenticateWithToken(credentials.token);
      }

      // For username/password authentication, we'd need to use Keycloak Admin API
      // This is typically handled client-side with Keycloak JS
      return {
        success: false,
        error: {
          code: 'UNSUPPORTED_AUTH_METHOD',
          message: 'Direct username/password authentication not supported. Use token-based authentication.',
          details: 'Keycloak authentication should be handled client-side, then the token provided for validation.'
        }
      };
    } catch (error) {
      console.error('Keycloak authentication error:', error);
      return {
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Authenticate with Keycloak token
   */
  private async authenticateWithToken(token: string): Promise<AuthResult> {
    try {
      const tokenParsed = await validateKeycloakToken(
        token,
        this.config.keycloak.url,
        this.config.keycloak.realm,
        this.config.keycloak.clientId
      );

      if (!tokenParsed) {
        return {
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Token validation failed'
          }
        };
      }

      // Convert token to WebQX user
      const keycloakUser = tokenToUser(tokenParsed, this.config.roleMappings);
      const user = this.keycloakUserToWebQXUser(keycloakUser);

      // Create session
      const session: AuthSession = {
        id: uuidv4(),
        userId: user.id,
        token: token,
        refreshToken: '', // Would need to be provided by client
        expiresAt: new Date(tokenParsed.exp * 1000),
        ipAddress: 'unknown', // Would be set by middleware
        userAgent: 'unknown', // Would be set by middleware
        isActive: true,
        createdAt: new Date(),
      };

      return {
        success: true,
        user,
        session
      };
    } catch (error) {
      console.error('Token authentication error:', error);
      return {
        success: false,
        error: {
          code: 'TOKEN_VALIDATION_ERROR',
          message: 'Token validation failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Create user in Keycloak
   * Note: This requires Keycloak Admin API access
   */
  async createUser(userData: CreateUserData): Promise<User> {
    if (!this.initialized) {
      throw new Error('Keycloak provider not initialized');
    }

    // This would require Keycloak Admin API integration
    throw new Error('User creation through Keycloak Admin API not implemented. Users should be created in Keycloak directly.');
  }

  /**
   * Verify session token
   */
  async verifySession(token: string): Promise<User | null> {
    if (!this.initialized) {
      throw new Error('Keycloak provider not initialized');
    }

    try {
      const tokenParsed = await validateKeycloakToken(
        token,
        this.config.keycloak.url,
        this.config.keycloak.realm,
        this.config.keycloak.clientId
      );

      if (!tokenParsed) {
        return null;
      }

      const keycloakUser = tokenToUser(tokenParsed, this.config.roleMappings);
      return this.keycloakUserToWebQXUser(keycloakUser);
    } catch (error) {
      console.error('Session verification error:', error);
      return null;
    }
  }

  /**
   * Revoke session
   * Note: This would require calling Keycloak's logout endpoint
   */
  async revokeSession(sessionId: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Keycloak provider not initialized');
    }

    // This would require calling Keycloak's logout endpoint
    console.log(`Session ${sessionId} revocation requested - implement Keycloak logout endpoint call`);
  }

  /**
   * Refresh token
   * Note: This would require calling Keycloak's token refresh endpoint
   */
  async refreshToken(refreshToken: string): Promise<AuthSession> {
    if (!this.initialized) {
      throw new Error('Keycloak provider not initialized');
    }

    // This would require calling Keycloak's token refresh endpoint
    throw new Error('Token refresh not implemented - implement Keycloak token refresh endpoint call');
  }

  /**
   * Convert Keycloak user to WebQX user format
   */
  private keycloakUserToWebQXUser(keycloakUser: KeycloakUser): User {
    return {
      id: keycloakUser.id,
      email: keycloakUser.email,
      firstName: keycloakUser.firstName || '',
      lastName: keycloakUser.lastName || '',
      role: keycloakUser.webqxRole,
      specialty: keycloakUser.medicalSpecialty,
      isVerified: keycloakUser.verificationStatus === 'VERIFIED',
      mfaEnabled: false, // Would need to be determined from Keycloak
      lastLogin: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Get provider configuration
   */
  getConfig(): KeycloakProviderConfig {
    return this.config;
  }

  /**
   * Check if provider is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}