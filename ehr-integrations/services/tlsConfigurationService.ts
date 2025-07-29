/**
 * Enhanced TLS Configuration Service
 * 
 * Manages TLS 1.3 configuration, secure communication protocols,
 * and fallback mechanisms for healthcare data transmission
 * with HIPAA compliance requirements.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { EHRApiResponse, EHRApiError } from '../types';

/**
 * TLS version support
 */
export type TLSVersion = 'TLS1.0' | 'TLS1.1' | 'TLS1.2' | 'TLS1.3';

/**
 * Cipher suite categories
 */
export type CipherSuiteCategory = 
  | 'strong'
  | 'acceptable'
  | 'weak'
  | 'deprecated';

/**
 * TLS cipher suite configuration
 */
export interface CipherSuite {
  /** Cipher suite name */
  name: string;
  /** TLS versions that support this cipher */
  supportedVersions: TLSVersion[];
  /** Security category */
  category: CipherSuiteCategory;
  /** Key exchange algorithm */
  keyExchange: string;
  /** Authentication algorithm */
  authentication: string;
  /** Encryption algorithm */
  encryption: string;
  /** MAC algorithm */
  mac: string;
  /** Whether forward secrecy is provided */
  forwardSecrecy: boolean;
  /** FIPS 140-2 approved */
  fipsApproved: boolean;
  /** Recommended for healthcare use */
  healthcareRecommended: boolean;
}

/**
 * TLS configuration profile
 */
export interface TLSProfile {
  /** Profile identifier */
  id: string;
  /** Profile name */
  name: string;
  /** Description */
  description: string;
  /** Supported TLS versions in order of preference */
  supportedVersions: TLSVersion[];
  /** Allowed cipher suites in order of preference */
  allowedCipherSuites: string[];
  /** Minimum key size for RSA */
  minRSAKeySize: number;
  /** Minimum key size for ECDSA */
  minECDSAKeySize: number;
  /** Require perfect forward secrecy */
  requirePFS: boolean;
  /** Require FIPS 140-2 approved algorithms */
  requireFIPS: boolean;
  /** HSTS max age in seconds */
  hstsMaxAge: number;
  /** Enable HSTS includeSubDomains */
  hstsIncludeSubDomains: boolean;
  /** Enable OCSP stapling */
  enableOCSPStapling: boolean;
  /** Certificate validation level */
  certValidationLevel: 'basic' | 'enhanced' | 'strict';
  /** Session resumption settings */
  sessionResumption: {
    enableSessionTickets: boolean;
    sessionTimeout: number;
    maxSessions: number;
  };
  /** HIPAA compliant */
  hipaaCompliant: boolean;
  /** Active status */
  isActive: boolean;
}

/**
 * TLS connection information
 */
export interface TLSConnectionInfo {
  /** Connection identifier */
  id: string;
  /** Remote host */
  remoteHost: string;
  /** Remote port */
  remotePort: number;
  /** Negotiated TLS version */
  tlsVersion: TLSVersion;
  /** Negotiated cipher suite */
  cipherSuite: string;
  /** Certificate chain */
  certificateChain: {
    subject: string;
    issuer: string;
    serialNumber: string;
    notBefore: Date;
    notAfter: Date;
    fingerprint: string;
  }[];
  /** Connection establishment time */
  establishedAt: Date;
  /** Bytes transmitted */
  bytesTransmitted: number;
  /** Bytes received */
  bytesReceived: number;
  /** Connection errors */
  errors: string[];
  /** Security warnings */
  warnings: string[];
}

/**
 * TLS audit event
 */
export interface TLSAuditEvent {
  /** Event identifier */
  id: string;
  /** Event timestamp */
  timestamp: Date;
  /** Event type */
  type: 'connection_established' | 'connection_failed' | 'certificate_error' | 'protocol_downgrade' | 'weak_cipher';
  /** Connection information */
  connection: Partial<TLSConnectionInfo>;
  /** Event severity */
  severity: 'info' | 'warning' | 'error' | 'critical';
  /** Event description */
  description: string;
  /** Remediation advice */
  remediation?: string;
}

/**
 * Enhanced TLS Configuration Service
 */
export class TLSConfigurationService {
  private profiles: Map<string, TLSProfile> = new Map();
  private cipherSuites: Map<string, CipherSuite> = new Map();
  private activeConnections: Map<string, TLSConnectionInfo> = new Map();
  private auditEvents: TLSAuditEvent[] = [];

  constructor() {
    this.initializeCipherSuites();
    this.initializeDefaultProfiles();
  }

  /**
   * Create TLS configuration profile
   * @param profile TLS profile configuration
   * @returns Promise resolving to creation result
   */
  async createTLSProfile(profile: Omit<TLSProfile, 'id'>): Promise<EHRApiResponse<{
    profileId: string;
    validated: boolean;
    warnings: string[];
  }>> {
    try {
      const profileId = this.generateProfileId();
      const warnings: string[] = [];

      // Validate profile configuration
      const validation = await this.validateTLSProfile(profile);
      if (!validation.valid) {
        return {
          success: false,
          error: {
            code: 'INVALID_TLS_PROFILE',
            message: 'TLS profile validation failed',
            details: validation.errors.join('; '),
            retryable: false
          }
        };
      }

      warnings.push(...validation.warnings);

      // Check HIPAA compliance
      const complianceCheck = this.checkHIPAACompliance(profile);
      if (!complianceCheck.compliant) {
        warnings.push(...complianceCheck.warnings);
      }

      const fullProfile: TLSProfile = {
        ...profile,
        id: profileId,
        hipaaCompliant: complianceCheck.compliant
      };

      this.profiles.set(profileId, fullProfile);

      // Log profile creation
      await this.logTLSEvent({
        type: 'connection_established',
        connection: {},
        severity: 'info',
        description: `TLS profile ${profile.name} created with ID ${profileId}`
      });

      return {
        success: true,
        data: {
          profileId,
          validated: true,
          warnings
        }
      };

    } catch (error) {
      const apiError: EHRApiError = {
        code: 'TLS_PROFILE_CREATION_ERROR',
        message: 'Failed to create TLS profile',
        details: error instanceof Error ? error.message : 'Unknown TLS error',
        retryable: true
      };

      return { success: false, error: apiError };
    }
  }

  /**
   * Validate TLS connection and establish secure channel
   * @param host Remote host
   * @param port Remote port
   * @param profileId TLS profile to use
   * @returns Promise resolving to connection result
   */
  async establishSecureConnection(
    host: string,
    port: number,
    profileId: string
  ): Promise<EHRApiResponse<{
    connectionId: string;
    tlsVersion: TLSVersion;
    cipherSuite: string;
    securityScore: number;
  }>> {
    try {
      const profile = this.profiles.get(profileId);
      if (!profile) {
        return {
          success: false,
          error: {
            code: 'PROFILE_NOT_FOUND',
            message: 'TLS profile not found',
            retryable: false
          }
        };
      }

      if (!profile.isActive) {
        return {
          success: false,
          error: {
            code: 'PROFILE_INACTIVE',
            message: 'TLS profile is not active',
            retryable: false
          }
        };
      }

      // Simulate TLS handshake
      const connectionResult = await this.simulateTLSHandshake(host, port, profile);
      
      if (!connectionResult.success) {
        await this.logTLSEvent({
          type: 'connection_failed',
          connection: { remoteHost: host, remotePort: port },
          severity: 'error',
          description: `TLS connection failed: ${connectionResult.error}`,
          remediation: 'Check network connectivity and TLS configuration'
        });

        return {
          success: false,
          error: {
            code: 'CONNECTION_FAILED',
            message: 'Failed to establish TLS connection',
            details: connectionResult.error,
            retryable: true
          }
        };
      }

      const connectionId = this.generateConnectionId();
      const connection: TLSConnectionInfo = {
        id: connectionId,
        remoteHost: host,
        remotePort: port,
        tlsVersion: connectionResult.tlsVersion!,
        cipherSuite: connectionResult.cipherSuite!,
        certificateChain: connectionResult.certificates!,
        establishedAt: new Date(),
        bytesTransmitted: 0,
        bytesReceived: 0,
        errors: [],
        warnings: connectionResult.warnings || []
      };

      this.activeConnections.set(connectionId, connection);

      // Calculate security score
      const securityScore = this.calculateSecurityScore(connection);

      // Log successful connection
      await this.logTLSEvent({
        type: 'connection_established',
        connection,
        severity: 'info',
        description: `Secure TLS connection established using ${connectionResult.tlsVersion} with ${connectionResult.cipherSuite}`
      });

      // Check for security warnings
      if (connection.warnings.length > 0) {
        await this.logTLSEvent({
          type: 'weak_cipher',
          connection,
          severity: 'warning',
          description: `TLS connection warnings: ${connection.warnings.join(', ')}`,
          remediation: 'Consider upgrading TLS configuration for enhanced security'
        });
      }

      return {
        success: true,
        data: {
          connectionId,
          tlsVersion: connectionResult.tlsVersion!,
          cipherSuite: connectionResult.cipherSuite!,
          securityScore
        }
      };

    } catch (error) {
      const apiError: EHRApiError = {
        code: 'TLS_CONNECTION_ERROR',
        message: 'Failed to establish TLS connection',
        details: error instanceof Error ? error.message : 'Unknown TLS connection error',
        retryable: true
      };

      return { success: false, error: apiError };
    }
  }

  /**
   * Get TLS security report
   * @param startDate Report start date
   * @param endDate Report end date
   * @returns Promise resolving to security report
   */
  async getTLSSecurityReport(
    startDate: Date,
    endDate: Date
  ): Promise<EHRApiResponse<{
    totalConnections: number;
    secureConnections: number;
    protocolDistribution: Record<TLSVersion, number>;
    cipherSuiteDistribution: Record<string, number>;
    securityEvents: TLSAuditEvent[];
    complianceScore: number;
    recommendations: string[];
  }>> {
    try {
      const filteredEvents = this.auditEvents.filter(
        event => event.timestamp >= startDate && event.timestamp <= endDate
      );

      const totalConnections = filteredEvents.filter(
        event => event.type === 'connection_established'
      ).length;

      const secureConnections = filteredEvents.filter(
        event => event.type === 'connection_established' && 
        event.connection.tlsVersion && 
        ['TLS1.2', 'TLS1.3'].includes(event.connection.tlsVersion)
      ).length;

      const protocolDistribution: Record<TLSVersion, number> = {
        'TLS1.0': 0,
        'TLS1.1': 0,
        'TLS1.2': 0,
        'TLS1.3': 0
      };

      const cipherSuiteDistribution: Record<string, number> = {};

      // Analyze events
      filteredEvents.forEach(event => {
        if (event.connection.tlsVersion) {
          protocolDistribution[event.connection.tlsVersion]++;
        }
        if (event.connection.cipherSuite) {
          cipherSuiteDistribution[event.connection.cipherSuite] = 
            (cipherSuiteDistribution[event.connection.cipherSuite] || 0) + 1;
        }
      });

      const securityEvents = filteredEvents.filter(
        event => ['warning', 'error', 'critical'].includes(event.severity)
      );

      const complianceScore = this.calculateTLSComplianceScore(filteredEvents);
      const recommendations = this.generateTLSRecommendations(filteredEvents);

      return {
        success: true,
        data: {
          totalConnections,
          secureConnections,
          protocolDistribution,
          cipherSuiteDistribution,
          securityEvents,
          complianceScore,
          recommendations
        }
      };

    } catch (error) {
      const apiError: EHRApiError = {
        code: 'TLS_REPORT_ERROR',
        message: 'Failed to generate TLS security report',
        details: error instanceof Error ? error.message : 'Unknown report error',
        retryable: true
      };

      return { success: false, error: apiError };
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Initialize supported cipher suites
   */
  private initializeCipherSuites(): void {
    // TLS 1.3 cipher suites (recommended)
    this.cipherSuites.set('TLS_AES_256_GCM_SHA384', {
      name: 'TLS_AES_256_GCM_SHA384',
      supportedVersions: ['TLS1.3'],
      category: 'strong',
      keyExchange: 'ECDHE',
      authentication: 'RSA/ECDSA',
      encryption: 'AES-256-GCM',
      mac: 'SHA384',
      forwardSecrecy: true,
      fipsApproved: true,
      healthcareRecommended: true
    });

    this.cipherSuites.set('TLS_CHACHA20_POLY1305_SHA256', {
      name: 'TLS_CHACHA20_POLY1305_SHA256',
      supportedVersions: ['TLS1.3'],
      category: 'strong',
      keyExchange: 'ECDHE',
      authentication: 'RSA/ECDSA',
      encryption: 'ChaCha20-Poly1305',
      mac: 'SHA256',
      forwardSecrecy: true,
      fipsApproved: false,
      healthcareRecommended: true
    });

    this.cipherSuites.set('TLS_AES_128_GCM_SHA256', {
      name: 'TLS_AES_128_GCM_SHA256',
      supportedVersions: ['TLS1.3'],
      category: 'strong',
      keyExchange: 'ECDHE',
      authentication: 'RSA/ECDSA',
      encryption: 'AES-128-GCM',
      mac: 'SHA256',
      forwardSecrecy: true,
      fipsApproved: true,
      healthcareRecommended: true
    });

    // TLS 1.2 cipher suites (acceptable)
    this.cipherSuites.set('ECDHE-RSA-AES256-GCM-SHA384', {
      name: 'ECDHE-RSA-AES256-GCM-SHA384',
      supportedVersions: ['TLS1.2'],
      category: 'acceptable',
      keyExchange: 'ECDHE',
      authentication: 'RSA',
      encryption: 'AES-256-GCM',
      mac: 'SHA384',
      forwardSecrecy: true,
      fipsApproved: true,
      healthcareRecommended: true
    });

    // Legacy cipher suites (deprecated)
    this.cipherSuites.set('RC4-MD5', {
      name: 'RC4-MD5',
      supportedVersions: ['TLS1.0', 'TLS1.1'],
      category: 'deprecated',
      keyExchange: 'RSA',
      authentication: 'RSA',
      encryption: 'RC4',
      mac: 'MD5',
      forwardSecrecy: false,
      fipsApproved: false,
      healthcareRecommended: false
    });
  }

  /**
   * Initialize default TLS profiles
   */
  private initializeDefaultProfiles(): void {
    // HIPAA Compliant Profile (TLS 1.3 preferred)
    const hipaaProfile: TLSProfile = {
      id: 'hipaa_compliant',
      name: 'HIPAA Compliant',
      description: 'HIPAA-compliant TLS configuration with TLS 1.3 and strong cipher suites',
      supportedVersions: ['TLS1.3', 'TLS1.2'],
      allowedCipherSuites: [
        'TLS_AES_256_GCM_SHA384',
        'TLS_AES_128_GCM_SHA256',
        'ECDHE-RSA-AES256-GCM-SHA384'
      ],
      minRSAKeySize: 2048,
      minECDSAKeySize: 256,
      requirePFS: true,
      requireFIPS: true,
      hstsMaxAge: 31536000, // 1 year
      hstsIncludeSubDomains: true,
      enableOCSPStapling: true,
      certValidationLevel: 'strict',
      sessionResumption: {
        enableSessionTickets: true,
        sessionTimeout: 3600,
        maxSessions: 1000
      },
      hipaaCompliant: true,
      isActive: true
    };

    this.profiles.set(hipaaProfile.id, hipaaProfile);

    // Legacy Support Profile (for compatibility)
    const legacyProfile: TLSProfile = {
      id: 'legacy_support',
      name: 'Legacy Support',
      description: 'Legacy TLS configuration for compatibility with older systems',
      supportedVersions: ['TLS1.2', 'TLS1.1'],
      allowedCipherSuites: [
        'ECDHE-RSA-AES256-GCM-SHA384',
        'AES256-SHA256'
      ],
      minRSAKeySize: 1024,
      minECDSAKeySize: 224,
      requirePFS: false,
      requireFIPS: false,
      hstsMaxAge: 86400, // 1 day
      hstsIncludeSubDomains: false,
      enableOCSPStapling: false,
      certValidationLevel: 'basic',
      sessionResumption: {
        enableSessionTickets: false,
        sessionTimeout: 1800,
        maxSessions: 100
      },
      hipaaCompliant: false,
      isActive: false // Disabled by default
    };

    this.profiles.set(legacyProfile.id, legacyProfile);
  }

  /**
   * Validate TLS profile configuration
   * @param profile TLS profile to validate
   * @returns Validation result
   */
  private async validateTLSProfile(profile: Omit<TLSProfile, 'id'>): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check TLS versions
    if (profile.supportedVersions.length === 0) {
      errors.push('At least one TLS version must be supported');
    }

    if (profile.supportedVersions.includes('TLS1.0') || profile.supportedVersions.includes('TLS1.1')) {
      warnings.push('TLS 1.0 and 1.1 are deprecated and should be avoided');
    }

    // Check cipher suites
    if (profile.allowedCipherSuites.length === 0) {
      errors.push('At least one cipher suite must be allowed');
    }

    for (const cipherName of profile.allowedCipherSuites) {
      const cipher = this.cipherSuites.get(cipherName);
      if (!cipher) {
        warnings.push(`Unknown cipher suite: ${cipherName}`);
      } else if (cipher.category === 'weak' || cipher.category === 'deprecated') {
        warnings.push(`Weak/deprecated cipher suite: ${cipherName}`);
      }
    }

    // Check key sizes
    if (profile.minRSAKeySize < 2048) {
      warnings.push('RSA key size below 2048 bits is not recommended');
    }

    if (profile.minECDSAKeySize < 256) {
      warnings.push('ECDSA key size below 256 bits is not recommended');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check HIPAA compliance for TLS profile
   * @param profile TLS profile to check
   * @returns Compliance result
   */
  private checkHIPAACompliance(profile: Omit<TLSProfile, 'id'>): {
    compliant: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];
    let compliant = true;

    // HIPAA requires encryption in transit
    if (!profile.supportedVersions.includes('TLS1.2') && !profile.supportedVersions.includes('TLS1.3')) {
      compliant = false;
      warnings.push('HIPAA requires TLS 1.2 or higher');
    }

    // Check for weak protocols
    if (profile.supportedVersions.includes('TLS1.0') || profile.supportedVersions.includes('TLS1.1')) {
      compliant = false;
      warnings.push('TLS 1.0 and 1.1 are not HIPAA compliant');
    }

    // Check for strong cipher suites
    const hasStrongCipher = profile.allowedCipherSuites.some(cipherName => {
      const cipher = this.cipherSuites.get(cipherName);
      return cipher && cipher.category === 'strong';
    });

    if (!hasStrongCipher) {
      compliant = false;
      warnings.push('HIPAA requires strong encryption cipher suites');
    }

    // Perfect Forward Secrecy recommendation
    if (!profile.requirePFS) {
      warnings.push('Perfect Forward Secrecy is recommended for HIPAA compliance');
    }

    return { compliant, warnings };
  }

  /**
   * Simulate TLS handshake process
   * @param host Remote host
   * @param port Remote port
   * @param profile TLS profile
   * @returns Handshake result
   */
  private async simulateTLSHandshake(
    host: string,
    port: number,
    profile: TLSProfile
  ): Promise<{
    success: boolean;
    tlsVersion?: TLSVersion;
    cipherSuite?: string;
    certificates?: any[];
    warnings?: string[];
    error?: string;
  }> {
    // Simulate handshake - in real implementation, this would perform actual TLS negotiation
    const warnings: string[] = [];

    // Simulate version negotiation (prefer highest version)
    const tlsVersion = profile.supportedVersions[0]; // First is highest preference

    // Simulate cipher suite selection
    const cipherSuite = profile.allowedCipherSuites[0]; // First is highest preference

    // Simulate certificate chain
    const certificates = [{
      subject: `CN=${host}`,
      issuer: 'CN=WebQX CA',
      serialNumber: '12345',
      notBefore: new Date(),
      notAfter: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      fingerprint: 'SHA256:1234567890abcdef'
    }];

    // Check for warnings
    if (tlsVersion === 'TLS1.2') {
      warnings.push('Consider upgrading to TLS 1.3 for enhanced security');
    }

    const cipher = this.cipherSuites.get(cipherSuite);
    if (cipher && !cipher.forwardSecrecy) {
      warnings.push('Cipher suite does not provide Perfect Forward Secrecy');
    }

    return {
      success: true,
      tlsVersion,
      cipherSuite,
      certificates,
      warnings
    };
  }

  /**
   * Calculate security score for TLS connection
   * @param connection TLS connection info
   * @returns Security score (0-100)
   */
  private calculateSecurityScore(connection: TLSConnectionInfo): number {
    let score = 0;

    // TLS version scoring
    switch (connection.tlsVersion) {
      case 'TLS1.3':
        score += 40;
        break;
      case 'TLS1.2':
        score += 30;
        break;
      case 'TLS1.1':
        score += 15;
        break;
      case 'TLS1.0':
        score += 5;
        break;
    }

    // Cipher suite scoring
    const cipher = this.cipherSuites.get(connection.cipherSuite);
    if (cipher) {
      switch (cipher.category) {
        case 'strong':
          score += 30;
          break;
        case 'acceptable':
          score += 20;
          break;
        case 'weak':
          score += 10;
          break;
        case 'deprecated':
          score += 0;
          break;
      }

      if (cipher.forwardSecrecy) score += 10;
      if (cipher.fipsApproved) score += 10;
      if (cipher.healthcareRecommended) score += 10;
    }

    return Math.min(100, score);
  }

  /**
   * Calculate TLS compliance score
   * @param events TLS audit events
   * @returns Compliance score (0-100)
   */
  private calculateTLSComplianceScore(events: TLSAuditEvent[]): number {
    if (events.length === 0) return 100;

    const criticalEvents = events.filter(e => e.severity === 'critical').length;
    const errorEvents = events.filter(e => e.severity === 'error').length;
    const warningEvents = events.filter(e => e.severity === 'warning').length;

    const totalIssues = criticalEvents * 4 + errorEvents * 2 + warningEvents;
    const maxPossibleIssues = events.length * 4;

    return Math.max(0, 100 - (totalIssues / maxPossibleIssues) * 100);
  }

  /**
   * Generate TLS security recommendations
   * @param events TLS audit events
   * @returns Array of recommendations
   */
  private generateTLSRecommendations(events: TLSAuditEvent[]): string[] {
    const recommendations: string[] = [];

    const hasLegacyTLS = events.some(e => 
      e.connection.tlsVersion === 'TLS1.0' || e.connection.tlsVersion === 'TLS1.1'
    );
    if (hasLegacyTLS) {
      recommendations.push('Disable TLS 1.0 and 1.1, use only TLS 1.2 and 1.3');
    }

    const hasWeakCiphers = events.some(e => e.type === 'weak_cipher');
    if (hasWeakCiphers) {
      recommendations.push('Remove weak cipher suites from configuration');
    }

    const hasCertErrors = events.some(e => e.type === 'certificate_error');
    if (hasCertErrors) {
      recommendations.push('Review and update SSL/TLS certificates');
    }

    recommendations.push('Implement regular TLS configuration audits');
    recommendations.push('Monitor for TLS security advisories and updates');

    return recommendations;
  }

  /**
   * Log TLS audit event
   * @param event TLS event data
   */
  private async logTLSEvent(event: Omit<TLSAuditEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: TLSAuditEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date()
    };

    this.auditEvents.push(fullEvent);

    // Keep only last 10000 events
    if (this.auditEvents.length > 10000) {
      this.auditEvents = this.auditEvents.slice(-10000);
    }

    // Log to console for immediate visibility
    console.log(`[TLS Security] ${fullEvent.severity.toUpperCase()}: ${fullEvent.description}`);
  }

  /**
   * Generate unique profile ID
   * @returns Profile ID
   */
  private generateProfileId(): string {
    return `tls_profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique connection ID
   * @returns Connection ID
   */
  private generateConnectionId(): string {
    return `tls_conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique event ID
   * @returns Event ID
   */
  private generateEventId(): string {
    return `tls_event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default TLSConfigurationService;