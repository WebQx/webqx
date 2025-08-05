/**
 * @fileoverview OpenEvidence Authentication Module
 * 
 * This module provides login functionality for OpenEvidence, an AI-powered platform
 * designed for medical professionals to access and synthesize clinically relevant evidence.
 * 
 * The integration leverages the existing WebQx authentication infrastructure while
 * providing OpenEvidence-specific features and compliance requirements.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { User, AuthResult, AuthCredentials, AuthSession, UserRole, MedicalSpecialty } from '../types';
import { webqxLogin } from '../webqx-login-manager';

// ============================================================================
// OpenEvidence-Specific Types
// ============================================================================

export interface OpenEvidenceUser extends User {
  openEvidenceRole: OpenEvidenceRole;
  evidenceAccessLevel: EvidenceAccessLevel;
  researchPermissions: ResearchPermission[];
  lastEvidenceAccess?: Date;
  consentToDataUse: boolean;
  institutionalAffiliation?: string;
}

export type OpenEvidenceRole = 
  | 'PHYSICIAN'
  | 'RESEARCHER'
  | 'CLINICAL_ADMIN'
  | 'EVIDENCE_REVIEWER'
  | 'SYSTEM_ADMIN';

export type EvidenceAccessLevel = 
  | 'BASIC'        // Access to public evidence summaries
  | 'ADVANCED'     // Access to detailed analyses and methodologies
  | 'RESEARCH'     // Access to raw data and research tools
  | 'INSTITUTIONAL'; // Full access for institutional users

export type ResearchPermission = 
  | 'VIEW_EVIDENCE'
  | 'EXPORT_SUMMARIES'
  | 'CREATE_RESEARCH_QUERIES'
  | 'ACCESS_RAW_DATA'
  | 'CONTRIBUTE_EVIDENCE'
  | 'MODERATE_CONTENT'
  | 'ADMIN_USERS';

export interface OpenEvidenceAuthConfig {
  enableResearchMode: boolean;
  requireInstitutionalAffiliation: boolean;
  enableDataExport: boolean;
  maxSessionDuration: number;
  requireConsentAgreement: boolean;
}

export interface OpenEvidenceSession extends AuthSession {
  evidenceRole: OpenEvidenceRole;
  accessLevel: EvidenceAccessLevel;
  researchPermissions: ResearchPermission[];
  consentVersion: string;
  institutionalId?: string;
}

// ============================================================================
// OpenEvidence Authentication Manager
// ============================================================================

export class OpenEvidenceAuthManager extends EventEmitter {
  private config: OpenEvidenceAuthConfig;
  private activeSessions: Map<string, OpenEvidenceSession> = new Map();
  private sessionTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: Partial<OpenEvidenceAuthConfig> = {}) {
    super();
    
    this.config = {
      enableResearchMode: true,
      requireInstitutionalAffiliation: false,
      enableDataExport: false,
      maxSessionDuration: 8 * 60 * 60 * 1000, // 8 hours
      requireConsentAgreement: true,
      ...config
    };

    // Listen to WebQx authentication events
    webqxLogin.on('userAuthenticated', this.handleWebQxAuthentication.bind(this));
    webqxLogin.on('userLoggedOut', this.handleWebQxLogout.bind(this));
    webqxLogin.on('authenticationError', this.handleWebQxAuthError.bind(this));

    console.log('[OpenEvidence Auth] Manager initialized with config:', this.config);
  }

  /**
   * Handle WebQx authentication success and create OpenEvidence session
   */
  private async handleWebQxAuthentication(authData: any): Promise<void> {
    try {
      const { user, roles, tokenInfo } = authData;
      
      // Validate user eligibility for OpenEvidence
      const eligibilityCheck = await this.checkUserEligibility(user, roles);
      if (!eligibilityCheck.eligible) {
        this.emit('authenticationFailed', {
          reason: 'USER_NOT_ELIGIBLE',
          message: eligibilityCheck.reason,
          user
        });
        return;
      }

      // Create OpenEvidence-specific session
      const openEvidenceSession = await this.createOpenEvidenceSession(user, roles, tokenInfo);
      
      if (openEvidenceSession) {
        this.activeSessions.set(openEvidenceSession.id, openEvidenceSession);
        this.setupSessionTimeout(openEvidenceSession.id);
        
        this.emit('openEvidenceAuthenticated', {
          session: openEvidenceSession,
          user: this.transformToOpenEvidenceUser(user, openEvidenceSession)
        });

        console.log(`[OpenEvidence Auth] User authenticated: ${user.email} with role: ${openEvidenceSession.evidenceRole}`);
      }
    } catch (error) {
      console.error('[OpenEvidence Auth] Failed to handle WebQx authentication:', error);
      this.emit('authenticationFailed', { reason: 'INTERNAL_ERROR', error });
    }
  }

  /**
   * Handle WebQx logout
   */
  private handleWebQxLogout(): void {
    // Clear all OpenEvidence sessions
    for (const sessionId of this.activeSessions.keys()) {
      this.terminateSession(sessionId);
    }
    
    this.emit('openEvidenceLogout');
    console.log('[OpenEvidence Auth] User logged out, all sessions cleared');
  }

  /**
   * Handle WebQx authentication error
   */
  private handleWebQxAuthError(error: any): void {
    this.emit('authenticationFailed', { reason: 'WEBQX_AUTH_ERROR', error });
  }

  /**
   * Check if user is eligible for OpenEvidence access
   */
  private async checkUserEligibility(user: User, roles: string[]): Promise<{ eligible: boolean; reason?: string }> {
    // Check if user has medical role
    const medicalRoles = ['PROVIDER', 'RESIDENT', 'FELLOW', 'ATTENDING', 'NURSE'];
    const hasValidRole = roles.some(role => medicalRoles.includes(role));
    
    if (!hasValidRole && user.role !== 'ADMIN') {
      return { eligible: false, reason: 'User must have a medical role to access OpenEvidence' };
    }

    // Check if institutional affiliation is required but missing
    if (this.config.requireInstitutionalAffiliation && !user.email.includes('@')) {
      return { eligible: false, reason: 'Institutional email address required' };
    }

    // Additional eligibility checks can be added here
    // e.g., license verification, specialty requirements, etc.

    return { eligible: true };
  }

  /**
   * Create OpenEvidence-specific session
   */
  private async createOpenEvidenceSession(
    user: User, 
    roles: string[], 
    tokenInfo: any
  ): Promise<OpenEvidenceSession | null> {
    try {
      const evidenceRole = this.mapToOpenEvidenceRole(user.role, roles);
      const accessLevel = this.determineAccessLevel(user, roles);
      const researchPermissions = this.determineResearchPermissions(evidenceRole, accessLevel);

      const session: OpenEvidenceSession = {
        id: `oe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: user.id,
        token: tokenInfo.access_token || tokenInfo.token,
        refreshToken: tokenInfo.refresh_token || '',
        expiresAt: new Date(Date.now() + this.config.maxSessionDuration),
        ipAddress: '', // Will be set by middleware
        userAgent: '', // Will be set by middleware
        isActive: true,
        createdAt: new Date(),
        evidenceRole,
        accessLevel,
        researchPermissions,
        consentVersion: '1.0', // Current consent version
        institutionalId: this.extractInstitutionalId(user.email)
      };

      return session;
    } catch (error) {
      console.error('[OpenEvidence Auth] Failed to create session:', error);
      return null;
    }
  }

  /**
   * Map WebQx role to OpenEvidence role
   */
  private mapToOpenEvidenceRole(userRole: UserRole, roles: string[]): OpenEvidenceRole {
    if (userRole === 'ADMIN' || roles.includes('ADMIN')) {
      return 'SYSTEM_ADMIN';
    }
    
    if (userRole === 'ATTENDING' || roles.includes('ATTENDING')) {
      return 'PHYSICIAN';
    }
    
    if (userRole === 'PROVIDER' || roles.includes('PROVIDER')) {
      return 'PHYSICIAN';
    }
    
    if (roles.includes('RESEARCHER') || userRole === 'RESIDENT' || userRole === 'FELLOW') {
      return 'RESEARCHER';
    }
    
    if (userRole === 'STAFF' || roles.includes('STAFF')) {
      return 'CLINICAL_ADMIN';
    }
    
    // Default role
    return 'EVIDENCE_REVIEWER';
  }

  /**
   * Determine evidence access level based on user role and credentials
   */
  private determineAccessLevel(user: User, roles: string[]): EvidenceAccessLevel {
    if (roles.includes('ADMIN') || user.role === 'ADMIN') {
      return 'INSTITUTIONAL';
    }
    
    if (roles.includes('RESEARCHER') || user.role === 'RESIDENT' || user.role === 'FELLOW') {
      return 'RESEARCH';
    }
    
    if (user.role === 'ATTENDING' || user.role === 'PROVIDER') {
      return 'ADVANCED';
    }
    
    return 'BASIC';
  }

  /**
   * Determine research permissions based on role and access level
   */
  private determineResearchPermissions(role: OpenEvidenceRole, accessLevel: EvidenceAccessLevel): ResearchPermission[] {
    const permissions: ResearchPermission[] = ['VIEW_EVIDENCE'];
    
    switch (role) {
      case 'SYSTEM_ADMIN':
        permissions.push('ADMIN_USERS', 'MODERATE_CONTENT', 'ACCESS_RAW_DATA', 'EXPORT_SUMMARIES', 'CREATE_RESEARCH_QUERIES', 'CONTRIBUTE_EVIDENCE');
        break;
      case 'PHYSICIAN':
        permissions.push('EXPORT_SUMMARIES', 'CREATE_RESEARCH_QUERIES');
        if (accessLevel === 'RESEARCH' || accessLevel === 'INSTITUTIONAL') {
          permissions.push('ACCESS_RAW_DATA', 'CONTRIBUTE_EVIDENCE');
        }
        break;
      case 'RESEARCHER':
        permissions.push('CREATE_RESEARCH_QUERIES', 'EXPORT_SUMMARIES', 'ACCESS_RAW_DATA', 'CONTRIBUTE_EVIDENCE');
        break;
      case 'CLINICAL_ADMIN':
        permissions.push('EXPORT_SUMMARIES', 'MODERATE_CONTENT');
        break;
      case 'EVIDENCE_REVIEWER':
        permissions.push('MODERATE_CONTENT');
        break;
    }
    
    return permissions;
  }

  /**
   * Extract institutional ID from email
   */
  private extractInstitutionalId(email: string): string | undefined {
    const match = email.match(/@(.+)$/);
    return match ? match[1] : undefined;
  }

  /**
   * Transform WebQx user to OpenEvidence user
   */
  private transformToOpenEvidenceUser(user: User, session: OpenEvidenceSession): OpenEvidenceUser {
    return {
      ...user,
      openEvidenceRole: session.evidenceRole,
      evidenceAccessLevel: session.accessLevel,
      researchPermissions: session.researchPermissions,
      lastEvidenceAccess: new Date(),
      consentToDataUse: true, // Assuming consent is given during login
      institutionalAffiliation: session.institutionalId
    };
  }

  /**
   * Setup session timeout
   */
  private setupSessionTimeout(sessionId: string): void {
    const timeout = setTimeout(() => {
      this.terminateSession(sessionId);
    }, this.config.maxSessionDuration);
    
    this.sessionTimeouts.set(sessionId, timeout);
  }

  /**
   * Terminate a session
   */
  public terminateSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.isActive = false;
      this.activeSessions.delete(sessionId);
      
      const timeout = this.sessionTimeouts.get(sessionId);
      if (timeout) {
        clearTimeout(timeout);
        this.sessionTimeouts.delete(sessionId);
      }
      
      this.emit('sessionTerminated', { sessionId, userId: session.userId });
      console.log(`[OpenEvidence Auth] Session terminated: ${sessionId}`);
    }
  }

  /**
   * Get active session by ID
   */
  public getSession(sessionId: string): OpenEvidenceSession | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Get all active sessions for a user
   */
  public getUserSessions(userId: string): OpenEvidenceSession[] {
    return Array.from(this.activeSessions.values()).filter(session => session.userId === userId);
  }

  /**
   * Check if user has specific permission
   */
  public hasPermission(sessionId: string, permission: ResearchPermission): boolean {
    const session = this.activeSessions.get(sessionId);
    return session ? session.researchPermissions.includes(permission) : false;
  }

  /**
   * Check if user has required access level
   */
  public hasAccessLevel(sessionId: string, requiredLevel: EvidenceAccessLevel): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;
    
    const levelHierarchy: EvidenceAccessLevel[] = ['BASIC', 'ADVANCED', 'RESEARCH', 'INSTITUTIONAL'];
    const currentIndex = levelHierarchy.indexOf(session.accessLevel);
    const requiredIndex = levelHierarchy.indexOf(requiredLevel);
    
    return currentIndex >= requiredIndex;
  }

  /**
   * Update session activity
   */
  public updateSessionActivity(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      // Clear existing timeout
      const timeout = this.sessionTimeouts.get(sessionId);
      if (timeout) {
        clearTimeout(timeout);
      }
      
      // Set new timeout
      this.setupSessionTimeout(sessionId);
      
      // Log activity
      console.log(`[OpenEvidence Auth] Session activity updated: ${sessionId}`);
    }
  }

  /**
   * Get session statistics
   */
  public getSessionStats(): {
    totalActiveSessions: number;
    sessionsByRole: Record<OpenEvidenceRole, number>;
    sessionsByAccessLevel: Record<EvidenceAccessLevel, number>;
  } {
    const sessions = Array.from(this.activeSessions.values());
    
    const sessionsByRole: Record<OpenEvidenceRole, number> = {
      'PHYSICIAN': 0,
      'RESEARCHER': 0,
      'CLINICAL_ADMIN': 0,
      'EVIDENCE_REVIEWER': 0,
      'SYSTEM_ADMIN': 0
    };
    
    const sessionsByAccessLevel: Record<EvidenceAccessLevel, number> = {
      'BASIC': 0,
      'ADVANCED': 0,
      'RESEARCH': 0,
      'INSTITUTIONAL': 0
    };
    
    sessions.forEach(session => {
      sessionsByRole[session.evidenceRole]++;
      sessionsByAccessLevel[session.accessLevel]++;
    });
    
    return {
      totalActiveSessions: sessions.length,
      sessionsByRole,
      sessionsByAccessLevel
    };
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    // Clear all sessions
    for (const sessionId of this.activeSessions.keys()) {
      this.terminateSession(sessionId);
    }
    
    // Remove all listeners
    this.removeAllListeners();
    
    console.log('[OpenEvidence Auth] Manager destroyed');
  }
}

// ============================================================================
// Default Export and Utility Functions
// ============================================================================

/**
 * Default OpenEvidence authentication manager instance
 */
export const openEvidenceAuth = new OpenEvidenceAuthManager();

/**
 * Utility functions for OpenEvidence authentication
 */
export const OpenEvidenceAuthUtils = {
  /**
   * Check if a medical specialty is relevant for evidence research
   */
  isResearchRelevantSpecialty(specialty: MedicalSpecialty): boolean {
    const researchRelevantSpecialties: MedicalSpecialty[] = [
      'ONCOLOGY',
      'CARDIOLOGY',
      'NEUROLOGY',
      'PSYCHIATRY',
      'ENDOCRINOLOGY',
      'GASTROENTEROLOGY',
      'PULMONOLOGY',
      'EMERGENCY_MEDICINE',
      'PATHOLOGY'
    ];
    
    return researchRelevantSpecialties.includes(specialty);
  },

  /**
   * Generate evidence access audit log entry
   */
  createAuditLogEntry(sessionId: string, action: string, resource: string, metadata?: any) {
    return {
      timestamp: new Date().toISOString(),
      sessionId,
      action,
      resource,
      metadata: metadata || {},
      platform: 'OpenEvidence'
    };
  },

  /**
   * Validate consent version compatibility
   */
  isConsentVersionValid(userConsentVersion: string, requiredVersion: string): boolean {
    // Simple version check - in production, use semantic versioning
    return userConsentVersion >= requiredVersion;
  }
};

export default OpenEvidenceAuthManager;