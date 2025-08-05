/**
 * @fileoverview OpenEvidence Authentication Tests
 * 
 * Comprehensive test suite for OpenEvidence authentication functionality,
 * including session management, role-based access control, and security features.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { 
  OpenEvidenceAuthManager, 
  OpenEvidenceUser, 
  OpenEvidenceSession,
  OpenEvidenceAuthUtils 
} from '../index';
import { User, UserRole, MedicalSpecialty } from '../../types';

// Mock WebQx login manager
jest.mock('../../webqx-login-manager', () => ({
  webqxLogin: {
    on: jest.fn(),
    getCurrentUser: jest.fn(),
    isAuthenticated: jest.fn()
  }
}));

describe('OpenEvidence Authentication Manager', () => {
  let authManager: OpenEvidenceAuthManager;
  let mockUser: User;
  let mockRoles: string[];

  beforeEach(() => {
    authManager = new OpenEvidenceAuthManager({
      enableResearchMode: true,
      requireInstitutionalAffiliation: false,
      enableDataExport: true,
      maxSessionDuration: 3600000, // 1 hour for testing
      requireConsentAgreement: true
    });

    mockUser = {
      id: 'user-123',
      email: 'doctor@hospital.edu',
      firstName: 'John',
      lastName: 'Doe',
      role: 'PROVIDER' as UserRole,
      specialty: 'CARDIOLOGY' as MedicalSpecialty,
      isVerified: true,
      mfaEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    mockRoles = ['PROVIDER', 'ATTENDING'];
  });

  afterEach(() => {
    authManager.destroy();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultManager = new OpenEvidenceAuthManager();
      expect(defaultManager).toBeInstanceOf(OpenEvidenceAuthManager);
      expect(defaultManager).toBeInstanceOf(EventEmitter);
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        enableResearchMode: false,
        maxSessionDuration: 1800000 // 30 minutes
      };
      
      const customManager = new OpenEvidenceAuthManager(customConfig);
      expect(customManager).toBeInstanceOf(OpenEvidenceAuthManager);
      customManager.destroy();
    });
  });

  describe('User Eligibility', () => {
    it('should approve eligible medical professionals', async () => {
      const authData = {
        user: mockUser,
        roles: mockRoles,
        tokenInfo: { access_token: 'mock-token' }
      };

      // Simulate WebQx authentication event
      const promise = new Promise((resolve) => {
        authManager.on('openEvidenceAuthenticated', resolve);
      });

      // Trigger authentication handler
      (authManager as any).handleWebQxAuthentication(authData);

      const result = await promise;
      expect(result).toBeDefined();
      expect((result as any).user).toBeDefined();
      expect((result as any).session).toBeDefined();
    });

    it('should reject non-medical users', async () => {
      const nonMedicalUser = {
        ...mockUser,
        role: 'PATIENT' as UserRole
      };

      const authData = {
        user: nonMedicalUser,
        roles: ['PATIENT'],
        tokenInfo: { access_token: 'mock-token' }
      };

      const promise = new Promise((resolve) => {
        authManager.on('authenticationFailed', resolve);
      });

      (authManager as any).handleWebQxAuthentication(authData);

      const result = await promise;
      expect((result as any).reason).toBe('USER_NOT_ELIGIBLE');
    });

    it('should handle institutional affiliation requirements', () => {
      const institutionalManager = new OpenEvidenceAuthManager({
        requireInstitutionalAffiliation: true
      });

      // Test with institutional email
      const institutionalUser = {
        ...mockUser,
        email: 'doctor@hospital.edu'
      };

      const eligibilityCheck = (institutionalManager as any).checkUserEligibility(
        institutionalUser, 
        mockRoles
      );

      expect(eligibilityCheck).resolves.toEqual({ eligible: true });

      institutionalManager.destroy();
    });
  });

  describe('Role Mapping', () => {
    it('should map WebQx roles to OpenEvidence roles correctly', () => {
      const testCases = [
        { userRole: 'ADMIN', roles: ['ADMIN'], expected: 'SYSTEM_ADMIN' },
        { userRole: 'ATTENDING', roles: ['ATTENDING'], expected: 'PHYSICIAN' },
        { userRole: 'PROVIDER', roles: ['PROVIDER'], expected: 'PHYSICIAN' },
        { userRole: 'RESIDENT', roles: ['RESEARCHER'], expected: 'RESEARCHER' },
        { userRole: 'STAFF', roles: ['STAFF'], expected: 'CLINICAL_ADMIN' }
      ];

      testCases.forEach(({ userRole, roles, expected }) => {
        const result = (authManager as any).mapToOpenEvidenceRole(userRole, roles);
        expect(result).toBe(expected);
      });
    });

    it('should determine access levels based on roles', () => {
      const testCases = [
        { user: { ...mockUser, role: 'ADMIN' }, roles: ['ADMIN'], expected: 'INSTITUTIONAL' },
        { user: { ...mockUser, role: 'ATTENDING' }, roles: ['ATTENDING'], expected: 'ADVANCED' },
        { user: { ...mockUser, role: 'RESIDENT' }, roles: ['RESEARCHER'], expected: 'RESEARCH' },
        { user: { ...mockUser, role: 'NURSE' }, roles: ['NURSE'], expected: 'BASIC' }
      ];

      testCases.forEach(({ user, roles, expected }) => {
        const result = (authManager as any).determineAccessLevel(user, roles);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Session Management', () => {
    let testSession: OpenEvidenceSession;

    beforeEach(async () => {
      const authData = {
        user: mockUser,
        roles: mockRoles,
        tokenInfo: { access_token: 'mock-token', refresh_token: 'mock-refresh' }
      };

      const promise = new Promise<any>((resolve) => {
        authManager.on('openEvidenceAuthenticated', resolve);
      });

      (authManager as any).handleWebQxAuthentication(authData);
      const result = await promise;
      testSession = result.session;
    });

    it('should create valid sessions', () => {
      expect(testSession).toBeDefined();
      expect(testSession.id).toMatch(/^oe_\d+_[a-z0-9]+$/);
      expect(testSession.userId).toBe(mockUser.id);
      expect(testSession.evidenceRole).toBe('PHYSICIAN');
      expect(testSession.accessLevel).toBe('ADVANCED');
      expect(testSession.isActive).toBe(true);
      expect(testSession.consentVersion).toBe('1.0');
    });

    it('should retrieve sessions by ID', () => {
      const retrievedSession = authManager.getSession(testSession.id);
      expect(retrievedSession).toEqual(testSession);
    });

    it('should retrieve sessions by user ID', () => {
      const userSessions = authManager.getUserSessions(mockUser.id);
      expect(userSessions).toHaveLength(1);
      expect(userSessions[0]).toEqual(testSession);
    });

    it('should terminate sessions', () => {
      const terminationPromise = new Promise((resolve) => {
        authManager.on('sessionTerminated', resolve);
      });

      authManager.terminateSession(testSession.id);

      expect(authManager.getSession(testSession.id)).toBeNull();
      return terminationPromise;
    });

    it('should update session activity', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      authManager.updateSessionActivity(testSession.id);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Session activity updated')
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle session timeouts', (done) => {
      const shortTimeoutManager = new OpenEvidenceAuthManager({
        maxSessionDuration: 100 // 100ms for testing
      });

      shortTimeoutManager.on('sessionTerminated', ({ sessionId }) => {
        expect(sessionId).toBeDefined();
        shortTimeoutManager.destroy();
        done();
      });

      // Create a session that will timeout quickly
      const authData = {
        user: mockUser,
        roles: mockRoles,
        tokenInfo: { access_token: 'test-token' }
      };

      (shortTimeoutManager as any).handleWebQxAuthentication(authData);
    });
  });

  describe('Permission System', () => {
    let testSession: OpenEvidenceSession;

    beforeEach(async () => {
      const authData = {
        user: mockUser,
        roles: ['PROVIDER', 'RESEARCHER'],
        tokenInfo: { access_token: 'mock-token' }
      };

      const promise = new Promise<any>((resolve) => {
        authManager.on('openEvidenceAuthenticated', resolve);
      });

      (authManager as any).handleWebQxAuthentication(authData);
      const result = await promise;
      testSession = result.session;
    });

    it('should check permissions correctly', () => {
      expect(authManager.hasPermission(testSession.id, 'VIEW_EVIDENCE')).toBe(true);
      expect(authManager.hasPermission(testSession.id, 'EXPORT_SUMMARIES')).toBe(true);
      expect(authManager.hasPermission(testSession.id, 'ADMIN_USERS')).toBe(false);
    });

    it('should check access levels correctly', () => {
      expect(authManager.hasAccessLevel(testSession.id, 'BASIC')).toBe(true);
      expect(authManager.hasAccessLevel(testSession.id, 'RESEARCH')).toBe(true);
      expect(authManager.hasAccessLevel(testSession.id, 'INSTITUTIONAL')).toBe(false);
    });

    it('should determine research permissions based on role', () => {
      const researcherPermissions = (authManager as any).determineResearchPermissions('RESEARCHER', 'RESEARCH');
      
      expect(researcherPermissions).toContain('VIEW_EVIDENCE');
      expect(researcherPermissions).toContain('CREATE_RESEARCH_QUERIES');
      expect(researcherPermissions).toContain('ACCESS_RAW_DATA');
      expect(researcherPermissions).toContain('CONTRIBUTE_EVIDENCE');
    });
  });

  describe('Statistics and Monitoring', () => {
    beforeEach(async () => {
      // Create multiple sessions for testing
      const users = [
        { ...mockUser, id: 'user-1', role: 'PROVIDER' as UserRole },
        { ...mockUser, id: 'user-2', role: 'RESEARCHER' as UserRole },
        { ...mockUser, id: 'user-3', role: 'ADMIN' as UserRole }
      ];

      const promises = users.map(async (user) => {
        const authData = {
          user,
          roles: [user.role],
          tokenInfo: { access_token: 'mock-token' }
        };

        return new Promise((resolve) => {
          authManager.once('openEvidenceAuthenticated', resolve);
          (authManager as any).handleWebQxAuthentication(authData);
        });
      });

      await Promise.all(promises);
    }, 10000); // Increase timeout to 10 seconds

    it('should provide session statistics', () => {
      const stats = authManager.getSessionStats();
      
      // Verify we have some active sessions
      expect(stats.totalActiveSessions).toBeGreaterThan(0);
      expect(stats.sessionsByRole).toBeDefined();
      expect(stats.sessionsByAccessLevel).toBeDefined();
      
      // Verify structure of statistics
      expect(typeof stats.sessionsByRole['PHYSICIAN']).toBe('number');
      expect(typeof stats.sessionsByRole['RESEARCHER']).toBe('number');
      expect(typeof stats.sessionsByRole['SYSTEM_ADMIN']).toBe('number');
    });
  });

  describe('Cleanup', () => {
    it('should properly cleanup resources', () => {
      const testManager = new OpenEvidenceAuthManager();
      const removeAllListenersSpy = jest.spyOn(testManager, 'removeAllListeners');
      
      testManager.destroy();
      
      expect(removeAllListenersSpy).toHaveBeenCalled();
    });
  });
});

describe('OpenEvidence Authentication Utils', () => {
  describe('Research Specialty Check', () => {
    it('should identify research-relevant specialties', () => {
      expect(OpenEvidenceAuthUtils.isResearchRelevantSpecialty('ONCOLOGY')).toBe(true);
      expect(OpenEvidenceAuthUtils.isResearchRelevantSpecialty('CARDIOLOGY')).toBe(true);
      expect(OpenEvidenceAuthUtils.isResearchRelevantSpecialty('PSYCHIATRY')).toBe(true);
      expect(OpenEvidenceAuthUtils.isResearchRelevantSpecialty('DERMATOLOGY')).toBe(false);
    });
  });

  describe('Audit Log Creation', () => {
    it('should create proper audit log entries', () => {
      const entry = OpenEvidenceAuthUtils.createAuditLogEntry(
        'session-123',
        'EVIDENCE_ACCESS',
        'clinical-trial-data',
        { query: 'cardiovascular outcomes' }
      );

      expect(entry.sessionId).toBe('session-123');
      expect(entry.action).toBe('EVIDENCE_ACCESS');
      expect(entry.resource).toBe('clinical-trial-data');
      expect(entry.platform).toBe('OpenEvidence');
      expect(entry.metadata.query).toBe('cardiovascular outcomes');
      expect(entry.timestamp).toBeDefined();
    });
  });

  describe('Consent Version Validation', () => {
    it('should validate consent versions correctly', () => {
      expect(OpenEvidenceAuthUtils.isConsentVersionValid('1.0', '1.0')).toBe(true);
      expect(OpenEvidenceAuthUtils.isConsentVersionValid('1.1', '1.0')).toBe(true);
      expect(OpenEvidenceAuthUtils.isConsentVersionValid('0.9', '1.0')).toBe(false);
    });
  });
});

describe('Error Handling', () => {
  let authManager: OpenEvidenceAuthManager;

  beforeEach(() => {
    authManager = new OpenEvidenceAuthManager();
  });

  afterEach(() => {
    authManager.destroy();
  });

  it('should handle authentication failures gracefully', async () => {
    const invalidAuthData = {
      user: null,
      roles: [],
      tokenInfo: {}
    };

    const promise = new Promise((resolve) => {
      authManager.once('authenticationFailed', resolve);
    });

    (authManager as any).handleWebQxAuthentication(invalidAuthData);

    const result = await promise;
    expect((result as any).reason).toBe('INTERNAL_ERROR');
  });

  it('should handle missing sessions gracefully', () => {
    expect(authManager.getSession('nonexistent')).toBeNull();
    expect(authManager.hasPermission('nonexistent', 'VIEW_EVIDENCE')).toBe(false);
    expect(authManager.hasAccessLevel('nonexistent', 'BASIC')).toBe(false);
  });

  it('should handle logout events properly', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    (authManager as any).handleWebQxLogout();
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('User logged out, all sessions cleared')
    );
    
    consoleSpy.mockRestore();
  });
});