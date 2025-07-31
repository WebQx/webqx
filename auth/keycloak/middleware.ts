/**
 * WebQX™ Keycloak Middleware
 * 
 * Express middleware for Keycloak authentication, token validation, and role mapping.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { KeycloakTokenParsed, KeycloakUser, KeycloakAuthResult, KeycloakRoleMapping } from './types';
import { UserRole, MedicalSpecialty } from '../types';
import { getKeycloakProviderConfig } from './client';

// Extend Express Request to include Keycloak user
declare global {
  namespace Express {
    interface Request {
      keycloakUser?: KeycloakUser;
      keycloakToken?: string;
    }
  }
}

/**
 * JWKS client for token verification
 */
let jwksClientInstance: jwksClient.JwksClient | null = null;

function getJwksClient(keycloakUrl: string, realm: string): jwksClient.JwksClient {
  if (!jwksClientInstance) {
    const jwksUri = `${keycloakUrl}/realms/${realm}/protocol/openid_connect/certs`;
    jwksClientInstance = jwksClient({
      jwksUri,
      requestHeaders: {},
      timeout: 30000,
    });
  }
  return jwksClientInstance;
}

/**
 * Validates a Keycloak JWT token
 */
export async function validateKeycloakToken(
  token: string,
  keycloakUrl: string,
  realm: string,
  clientId: string
): Promise<KeycloakTokenParsed | null> {
  try {
    // Get the kid from token header
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || !decoded.header.kid) {
      throw new Error('Invalid token format');
    }

    // Get public key from JWKS
    const client = getJwksClient(keycloakUrl, realm);
    const key = await client.getSigningKey(decoded.header.kid);
    const signingKey = key.getPublicKey();

    // Verify token
    const tokenParsed = jwt.verify(token, signingKey, {
      audience: clientId,
      issuer: `${keycloakUrl}/realms/${realm}`,
      algorithms: ['RS256'],
    }) as KeycloakTokenParsed;

    return tokenParsed;
  } catch (error) {
    console.error('Token validation failed:', error);
    return null;
  }
}

/**
 * Maps Keycloak roles to WebQX roles and specialties
 */
export function mapKeycloakRoles(
  tokenParsed: KeycloakTokenParsed,
  roleMappings: KeycloakRoleMapping[]
): { role: UserRole; specialty?: MedicalSpecialty; permissions: string[] } {
  const userRoles = [
    ...(tokenParsed.realm_access?.roles || []),
    ...Object.values(tokenParsed.resource_access || {}).flatMap(ra => ra.roles || [])
  ];

  // Find best matching role mapping
  let bestMatch: KeycloakRoleMapping | null = null;
  let highestPriority = -1;

  for (const mapping of roleMappings) {
    if (userRoles.includes(mapping.keycloakRole)) {
      const priority = mapping.specialty ? 10 : 5; // Specialty-specific roles have higher priority
      if (priority > highestPriority) {
        bestMatch = mapping;
        highestPriority = priority;
      }
    }
  }

  // Default to patient role if no match found
  if (!bestMatch) {
    return {
      role: 'PATIENT',
      permissions: ['read:own_records', 'create:appointments', 'read:lab_results', 'send:messages']
    };
  }

  return {
    role: bestMatch.webqxRole,
    specialty: bestMatch.specialty,
    permissions: bestMatch.permissions
  };
}

/**
 * Converts Keycloak token to WebQX user object
 */
export function tokenToUser(
  tokenParsed: KeycloakTokenParsed,
  roleMappings: KeycloakRoleMapping[]
): KeycloakUser {
  const { role, specialty, permissions } = mapKeycloakRoles(tokenParsed, roleMappings);

  return {
    id: tokenParsed.sub,
    username: tokenParsed.preferred_username || tokenParsed.email || tokenParsed.sub,
    email: tokenParsed.email || '',
    firstName: tokenParsed.given_name,
    lastName: tokenParsed.family_name,
    emailVerified: tokenParsed.email_verified || false,
    roles: [
      ...(tokenParsed.realm_access?.roles || []),
      ...Object.values(tokenParsed.resource_access || {}).flatMap(ra => ra.roles || [])
    ],
    groups: [], // Groups would need to be fetched separately from Keycloak API
    attributes: {
      npi_number: tokenParsed.npi_number,
      medical_license: tokenParsed.medical_license,
      dea_number: tokenParsed.dea_number,
      specialty: tokenParsed.specialty,
      department: tokenParsed.department,
      provider_verification_status: tokenParsed.provider_verification_status,
    },
    // WebQX mapped fields
    webqxRole: role,
    medicalSpecialty: specialty,
    npiNumber: tokenParsed.npi_number,
    medicalLicense: tokenParsed.medical_license,
    deaNumber: tokenParsed.dea_number,
    department: tokenParsed.department,
    verificationStatus: (tokenParsed.provider_verification_status as any) || 'PENDING',
  };
}

/**
 * Main Keycloak authentication middleware
 */
export function keycloakMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'MISSING_TOKEN',
      message: 'Authorization header with Bearer token is required'
    });
    return;
  }

  const token = authHeader.substring(7);
  const config = getKeycloakProviderConfig();

  validateKeycloakToken(token, config.keycloak.url, config.keycloak.realm, config.keycloak.clientId)
    .then((tokenParsed) => {
      if (!tokenParsed) {
        res.status(401).json({
          error: 'INVALID_TOKEN',
          message: 'Token validation failed'
        });
        return;
      }

      // Additional token validation
      if (config.tokenValidation.checkTokenType && tokenParsed.typ !== 'Bearer') {
        res.status(401).json({
          error: 'INVALID_TOKEN_TYPE',
          message: 'Token type must be Bearer'
        });
        return;
      }

      // Check token age
      const now = Math.floor(Date.now() / 1000);
      const tokenAge = now - tokenParsed.iat;
      
      if (config.tokenValidation.minimumTokenAge && tokenAge < config.tokenValidation.minimumTokenAge) {
        res.status(401).json({
          error: 'TOKEN_TOO_NEW',
          message: 'Token is too new'
        });
        return;
      }

      if (config.tokenValidation.maximumTokenAge && tokenAge > config.tokenValidation.maximumTokenAge) {
        res.status(401).json({
          error: 'TOKEN_TOO_OLD',
          message: 'Token is too old'
        });
        return;
      }

      // Convert token to user and attach to request
      const user = tokenToUser(tokenParsed, config.roleMappings);
      req.keycloakUser = user;
      req.keycloakToken = token;

      next();
    })
    .catch((error) => {
      console.error('Keycloak middleware error:', error);
      res.status(500).json({
        error: 'AUTHENTICATION_ERROR',
        message: 'Internal authentication error'
      });
    });
}

/**
 * Middleware to require specific roles
 */
export function requireKeycloakRole(requiredRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.keycloakUser) {
      res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required'
      });
      return;
    }

    if (!requiredRoles.includes(req.keycloakUser.webqxRole)) {
      res.status(403).json({
        error: 'INSUFFICIENT_ROLE',
        message: `Required role: ${requiredRoles.join(', ')}, current role: ${req.keycloakUser.webqxRole}`
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to require specific medical specialty
 */
export function requireKeycloakSpecialty(requiredSpecialties: MedicalSpecialty[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.keycloakUser) {
      res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required'
      });
      return;
    }

    if (!req.keycloakUser.medicalSpecialty || !requiredSpecialties.includes(req.keycloakUser.medicalSpecialty)) {
      res.status(403).json({
        error: 'INSUFFICIENT_SPECIALTY',
        message: `Required specialty: ${requiredSpecialties.join(', ')}, current specialty: ${req.keycloakUser.medicalSpecialty || 'none'}`
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to require verified provider status
 */
export function requireVerifiedProvider(req: Request, res: Response, next: NextFunction): void {
  if (!req.keycloakUser) {
    res.status(401).json({
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication required'
    });
    return;
  }

  const providerRoles: UserRole[] = ['PROVIDER', 'RESIDENT', 'FELLOW', 'ATTENDING'];
  if (!providerRoles.includes(req.keycloakUser.webqxRole)) {
    res.status(403).json({
      error: 'PROVIDER_ROLE_REQUIRED',
      message: 'Provider role required'
    });
    return;
  }

  if (req.keycloakUser.verificationStatus !== 'VERIFIED') {
    res.status(403).json({
      error: 'PROVIDER_NOT_VERIFIED',
      message: 'Provider verification required'
    });
    return;
  }

  next();
}