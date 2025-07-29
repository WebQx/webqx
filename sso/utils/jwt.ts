import jwt from 'jsonwebtoken';
import { SSOUser, SSOSession, SSOError, SSOValidationError } from '../types/common';

/**
 * JWT utilities for SSO session management
 * Handles token creation, validation, and refresh
 */
export class JWTUtils {
  private secretKey: string;
  private issuer: string;
  private defaultExpiresIn: string;

  constructor(secretKey: string, issuer: string = 'webqx-sso', defaultExpiresIn: string = '1h') {
    if (!secretKey || secretKey.length < 32) {
      throw new SSOError('JWT secret key must be at least 32 characters', 'INVALID_SECRET');
    }
    this.secretKey = secretKey;
    this.issuer = issuer;
    this.defaultExpiresIn = defaultExpiresIn;
  }

  /**
   * Create a JWT token for a user session
   */
  createToken(user: SSOUser, session: SSOSession, expiresIn?: string): string {
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles || [],
      groups: user.groups || [],
      sessionId: session.sessionId,
      provider: session.provider,
      protocol: session.protocol,
      iat: Math.floor(Date.now() / 1000),
      metadata: {
        ...user.metadata,
        ...session.metadata
      }
    };

    const options: jwt.SignOptions = {
      issuer: this.issuer,
      audience: 'webqx-healthcare',
      expiresIn: expiresIn || this.defaultExpiresIn,
      algorithm: 'HS256'
    };

    return jwt.sign(payload, this.secretKey, options);
  }

  /**
   * Verify and decode a JWT token
   */
  verifyToken(token: string): any {
    try {
      return jwt.verify(token, this.secretKey, {
        issuer: this.issuer,
        audience: 'webqx-healthcare',
        algorithms: ['HS256']
      });
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new SSOValidationError('Token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new SSOValidationError('Invalid token');
      } else {
        throw new SSOValidationError('Token validation failed');
      }
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token: string): any {
    return jwt.decode(token);
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    try {
      const decoded = this.decodeToken(token);
      if (!decoded || !decoded.exp) {
        return true;
      }
      return Date.now() >= decoded.exp * 1000;
    } catch {
      return true;
    }
  }

  /**
   * Get token expiration time
   */
  getTokenExpiration(token: string): Date | null {
    try {
      const decoded = this.decodeToken(token);
      if (!decoded || !decoded.exp) {
        return null;
      }
      return new Date(decoded.exp * 1000);
    } catch {
      return null;
    }
  }

  /**
   * Refresh a token (create new token with updated expiration)
   */
  refreshToken(token: string, expiresIn?: string): string {
    const decoded = this.verifyToken(token);
    
    // Create new token with same payload but updated expiration
    const newPayload = {
      ...decoded,
      iat: Math.floor(Date.now() / 1000)
    };

    // Remove old JWT claims
    delete newPayload.exp;
    delete newPayload.aud;
    delete newPayload.iss;

    const options: jwt.SignOptions = {
      issuer: this.issuer,
      audience: 'webqx-healthcare',
      expiresIn: expiresIn || this.defaultExpiresIn,
      algorithm: 'HS256'
    };

    return jwt.sign(newPayload, this.secretKey, options);
  }

  /**
   * Extract user information from token
   */
  getUserFromToken(token: string): SSOUser {
    const decoded = this.verifyToken(token);
    
    return {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      roles: decoded.roles || [],
      groups: decoded.groups || [],
      metadata: decoded.metadata || {}
    };
  }

  /**
   * Extract session information from token
   */
  getSessionFromToken(token: string): Partial<SSOSession> {
    const decoded = this.verifyToken(token);
    
    return {
      sessionId: decoded.sessionId,
      userId: decoded.sub,
      provider: decoded.provider,
      protocol: decoded.protocol,
      expiresAt: new Date(decoded.exp * 1000),
      metadata: decoded.metadata || {}
    };
  }

  /**
   * Create a short-lived token for specific operations
   */
  createShortLivedToken(user: SSOUser, purpose: string, expiresIn: string = '5m'): string {
    const payload = {
      sub: user.id,
      email: user.email,
      purpose,
      iat: Math.floor(Date.now() / 1000)
    };

    const options: jwt.SignOptions = {
      issuer: this.issuer,
      audience: 'webqx-healthcare',
      expiresIn,
      algorithm: 'HS256'
    };

    return jwt.sign(payload, this.secretKey, options);
  }

  /**
   * Validate token structure and claims
   */
  validateTokenStructure(token: string): boolean {
    try {
      const decoded = this.decodeToken(token);
      
      // Check required claims
      const requiredClaims = ['sub', 'email', 'iat', 'exp', 'iss', 'aud'];
      for (const claim of requiredClaims) {
        if (!(claim in decoded)) {
          return false;
        }
      }

      // Check issuer and audience
      if (decoded.iss !== this.issuer || decoded.aud !== 'webqx-healthcare') {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }
}