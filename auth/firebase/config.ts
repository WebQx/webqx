/**
 * Firebase Configuration for WebQX™
 * 
 * Centralized configuration management for Firebase authentication
 * with healthcare-specific security settings.
 */

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
}

export interface FirebaseSecurityConfig {
  enableMFA: boolean;
  sessionTimeout: number;
  maxFailedAttempts: number;
  accountLockoutDuration: number;
  requireEmailVerification: boolean;
  allowedDomains?: string[];
  enableAuditLogging: boolean;
}

/**
 * Default Firebase configuration for healthcare compliance
 */
export const DEFAULT_FIREBASE_SECURITY_CONFIG: FirebaseSecurityConfig = {
  enableMFA: true,
  sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
  maxFailedAttempts: 5,
  accountLockoutDuration: 30 * 60 * 1000, // 30 minutes
  requireEmailVerification: true,
  enableAuditLogging: true
};

/**
 * Firebase configuration builder with healthcare defaults
 */
export class FirebaseConfigBuilder {
  private config: Partial<FirebaseConfig & FirebaseSecurityConfig> = {};

  constructor() {
    // Apply healthcare-specific defaults
    this.config = { ...DEFAULT_FIREBASE_SECURITY_CONFIG };
  }

  /**
   * Set Firebase project configuration
   */
  setProject(config: FirebaseConfig): this {
    this.config = { ...this.config, ...config };
    return this;
  }

  /**
   * Set security configuration
   */
  setSecurity(securityConfig: Partial<FirebaseSecurityConfig>): this {
    this.config = { ...this.config, ...securityConfig };
    return this;
  }

  /**
   * Enable healthcare-specific features
   */
  enableHealthcareMode(): this {
    this.config = {
      ...this.config,
      enableMFA: true,
      requireEmailVerification: true,
      enableAuditLogging: true,
      sessionTimeout: 8 * 60 * 60 * 1000, // 8 hours for healthcare
      maxFailedAttempts: 3 // Stricter for healthcare
    };
    return this;
  }

  /**
   * Build final configuration
   */
  build(): FirebaseConfig & FirebaseSecurityConfig {
    if (!this.config.apiKey || !this.config.authDomain || !this.config.projectId) {
      throw new Error('Firebase configuration incomplete: apiKey, authDomain, and projectId are required');
    }

    return this.config as FirebaseConfig & FirebaseSecurityConfig;
  }
}

/**
 * Environment-based configuration loader
 */
export function loadFirebaseConfig(): FirebaseConfig & FirebaseSecurityConfig {
  const builder = new FirebaseConfigBuilder();

  // Load from environment variables
  const envConfig: FirebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID
  };

  // Load security configuration from environment
  const securityConfig: Partial<FirebaseSecurityConfig> = {
    enableMFA: process.env.FIREBASE_ENABLE_MFA === 'true',
    sessionTimeout: process.env.FIREBASE_SESSION_TIMEOUT 
      ? parseInt(process.env.FIREBASE_SESSION_TIMEOUT) 
      : undefined,
    maxFailedAttempts: process.env.FIREBASE_MAX_FAILED_ATTEMPTS 
      ? parseInt(process.env.FIREBASE_MAX_FAILED_ATTEMPTS) 
      : undefined,
    accountLockoutDuration: process.env.FIREBASE_LOCKOUT_DURATION 
      ? parseInt(process.env.FIREBASE_LOCKOUT_DURATION) 
      : undefined,
    requireEmailVerification: process.env.FIREBASE_REQUIRE_EMAIL_VERIFICATION === 'true',
    allowedDomains: process.env.FIREBASE_ALLOWED_DOMAINS?.split(','),
    enableAuditLogging: process.env.FIREBASE_ENABLE_AUDIT_LOGGING !== 'false'
  };

  return builder
    .setProject(envConfig)
    .setSecurity(securityConfig)
    .enableHealthcareMode()
    .build();
}

/**
 * Validate Firebase configuration for healthcare compliance
 */
export function validateHealthcareCompliance(config: FirebaseConfig & FirebaseSecurityConfig): {
  isCompliant: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check MFA requirement
  if (!config.enableMFA) {
    issues.push('Multi-factor authentication must be enabled for healthcare compliance');
  }

  // Check session timeout (should not exceed 24 hours)
  if (config.sessionTimeout > 24 * 60 * 60 * 1000) {
    issues.push('Session timeout should not exceed 24 hours for healthcare compliance');
  }

  // Check failed attempt limits
  if (config.maxFailedAttempts > 5) {
    issues.push('Maximum failed attempts should not exceed 5 for healthcare security');
  }

  // Check email verification requirement
  if (!config.requireEmailVerification) {
    issues.push('Email verification is required for healthcare compliance');
  }

  // Check audit logging
  if (!config.enableAuditLogging) {
    issues.push('Audit logging must be enabled for healthcare compliance');
  }

  return {
    isCompliant: issues.length === 0,
    issues
  };
}

export default {
  FirebaseConfigBuilder,
  loadFirebaseConfig,
  validateHealthcareCompliance,
  DEFAULT_FIREBASE_SECURITY_CONFIG
};