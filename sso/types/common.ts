// Common types used across the SSO module
export interface SSOUser {
  id: string;
  email: string;
  name: string;
  roles?: string[];
  groups?: string[];
  metadata?: Record<string, any>;
}

// Legacy user interface for backward compatibility with existing modules
export interface LegacyUser {
  userId: string;
  role: string;
  specialties: string[];
  sessionId: string;
}

// Extended SSO user that includes legacy compatibility
export interface CompatibleSSOUser extends SSOUser {
  userId: string;
  role: string;
  specialties: string[];
  sessionId: string;
}

export interface SSOSession {
  sessionId: string;
  userId: string;
  provider: string;
  protocol: 'oauth2' | 'saml';
  createdAt: Date;
  expiresAt: Date;
  lastActivity: Date;
  metadata?: Record<string, any>;
}

export interface SSOConfig {
  secretKey: string;
  sessionTimeout: number;
  auditEnabled: boolean;
  providers: {
    oauth2?: Record<string, any>;
    saml?: Record<string, any>;
  };
  userMapping?: {
    oauth2?: UserMappingConfig;
    saml?: UserMappingConfig;
  };
}

export interface UserMappingConfig {
  id: string;
  email: string;
  name: string;
  roles?: string;
  groups?: string;
}

export interface SSOAuditEvent {
  timestamp: Date;
  event: 'login_attempt' | 'login_success' | 'login_failure' | 'logout' | 'session_expired';
  provider: string;
  protocol: 'oauth2' | 'saml';
  userId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export interface SSOProvider {
  name: string;
  protocol: 'oauth2' | 'saml';
  config: Record<string, any>;
  authenticate(req: any): Promise<SSOUser>;
  generateAuthUrl(state?: string): string;
}

export class SSOError extends Error {
  public code: string;
  public statusCode: number;

  constructor(message: string, code: string, statusCode: number = 500) {
    super(message);
    this.name = 'SSOError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class SSOAuthenticationError extends SSOError {
  constructor(message: string) {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'SSOAuthenticationError';
  }
}

export class SSOConfigurationError extends SSOError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR', 500);
    this.name = 'SSOConfigurationError';
  }
}

export class SSOValidationError extends SSOError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'SSOValidationError';
  }
}

export class SSOSessionError extends SSOError {
  constructor(message: string) {
    super(message, 'SESSION_ERROR', 401);
    this.name = 'SSOSessionError';
  }
}

// Utility functions for user conversion
export const convertSSOUserToLegacy = (ssoUser: SSOUser, sessionId: string): LegacyUser => {
  return {
    userId: ssoUser.id,
    role: ssoUser.roles?.[0] || 'user',
    specialties: ssoUser.groups || [],
    sessionId
  };
};

export const convertLegacyToSSOUser = (legacyUser: LegacyUser): CompatibleSSOUser => {
  return {
    id: legacyUser.userId,
    userId: legacyUser.userId,
    email: `${legacyUser.userId}@system.local`, // Default email if not available
    name: legacyUser.userId, // Default name if not available
    roles: [legacyUser.role],
    groups: legacyUser.specialties,
    role: legacyUser.role,
    specialties: legacyUser.specialties,
    sessionId: legacyUser.sessionId
  };
};