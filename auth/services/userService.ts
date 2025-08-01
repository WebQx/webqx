/**
 * HIPAA-Compliant User Management Service
 * 
 * Handles secure user authentication, password management, and audit logging
 * for the WebQX patient portal system.
 */

import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { 
  User, 
  AuthCredentials, 
  AuthResult, 
  CreateUserData, 
  AuthSession,
  AuthAuditEvent,
  AuthEventType 
} from '../types';

// Salt rounds for bcrypt (12 is recommended for production)
const SALT_ROUNDS = 12;

// Account lockout settings
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// In-memory stores (in production, use proper database)
const users = new Map<string, User & { 
  passwordHash: string; 
  failedAttempts: number; 
  lockoutUntil?: Date;
  lastPasswordChange: Date;
}>();
const sessions = new Map<string, AuthSession>();
const auditLogs: AuthAuditEvent[] = [];

export interface UserWithPassword extends User {
  passwordHash: string;
  failedAttempts: number;
  lockoutUntil?: Date;
  lastPasswordChange: Date;
}

export class SecureUserService {
  
  /**
   * Create a new user with secure password hashing
   */
  async createUser(userData: CreateUserData & { password: string }): Promise<User> {
    // Check if user already exists
    const existingUser = Array.from(users.values()).find(u => u.email === userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Validate password strength
    this.validatePassword(userData.password);

    // Hash password
    const passwordHash = await bcrypt.hash(userData.password, SALT_ROUNDS);

    // Create user
    const user: UserWithPassword = {
      id: uuidv4(),
      email: userData.email.toLowerCase(),
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role,
      specialty: userData.specialty,
      isVerified: false,
      mfaEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      passwordHash,
      failedAttempts: 0,
      lastPasswordChange: new Date()
    };

    users.set(user.id, user);

    // Log user creation
    await this.logAuditEvent({
      eventType: 'LOGIN_ATTEMPT', // Using closest available type
      userId: user.id,
      success: true,
      details: {
        action: 'USER_CREATED',
        email: userData.email,
        role: userData.role
      }
    });

    // Return user without password hash
    const { passwordHash: _, failedAttempts: __, lockoutUntil: ___, lastPasswordChange: ____, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Authenticate user with email and password
   */
  async authenticateUser(credentials: AuthCredentials, ipAddress: string, userAgent: string): Promise<AuthResult> {
    const email = credentials.email.toLowerCase();
    
    // Find user
    const user = Array.from(users.values()).find(u => u.email === email);
    if (!user) {
      await this.logAuditEvent({
        eventType: 'LOGIN_FAILURE',
        success: false,
        ipAddress,
        userAgent,
        details: {
          email,
          reason: 'USER_NOT_FOUND'
        }
      });
      
      return {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      };
    }

    // Check if account is locked
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      await this.logAuditEvent({
        eventType: 'LOGIN_FAILURE',
        userId: user.id,
        success: false,
        ipAddress,
        userAgent,
        details: {
          email,
          reason: 'ACCOUNT_LOCKED',
          lockoutUntil: user.lockoutUntil
        }
      });

      return {
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: 'Account is temporarily locked due to too many failed attempts'
        }
      };
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(credentials.password, user.passwordHash);
    
    if (!isPasswordValid) {
      // Increment failed attempts
      user.failedAttempts += 1;
      
      // Lock account if too many failures
      if (user.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        user.lockoutUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        
        await this.logAuditEvent({
          eventType: 'ACCOUNT_LOCKED',
          userId: user.id,
          success: false,
          ipAddress,
          userAgent,
          details: {
            email,
            failedAttempts: user.failedAttempts,
            lockoutUntil: user.lockoutUntil
          }
        });
      } else {
        await this.logAuditEvent({
          eventType: 'LOGIN_FAILURE',
          userId: user.id,
          success: false,
          ipAddress,
          userAgent,
          details: {
            email,
            reason: 'INVALID_PASSWORD',
            failedAttempts: user.failedAttempts
          }
        });
      }

      users.set(user.id, user);

      return {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      };
    }

    // Reset failed attempts on successful login
    user.failedAttempts = 0;
    user.lockoutUntil = undefined;
    user.lastLogin = new Date();
    users.set(user.id, user);

    // Create session
    const session = await this.createSession(user, ipAddress, userAgent);

    // Log successful authentication
    await this.logAuditEvent({
      eventType: 'LOGIN_SUCCESS',
      userId: user.id,
      sessionId: session.id,
      success: true,
      ipAddress,
      userAgent,
      details: {
        email,
        lastLogin: user.lastLogin
      }
    });

    // Return user without sensitive data
    const { passwordHash: _, failedAttempts: __, lockoutUntil: ___, lastPasswordChange: ____, ...userWithoutPassword } = user;
    
    return {
      success: true,
      user: userWithoutPassword,
      session
    };
  }

  /**
   * Verify session token
   */
  async verifySession(sessionId: string): Promise<User | null> {
    const session = sessions.get(sessionId);
    
    if (!session || !session.isActive || session.expiresAt < new Date()) {
      if (session) {
        // Mark session as inactive
        session.isActive = false;
        sessions.set(sessionId, session);
        
        await this.logAuditEvent({
          eventType: 'SESSION_EXPIRED',
          userId: session.userId,
          sessionId: session.id,
          success: false,
          details: {
            reason: 'SESSION_EXPIRED',
            expiresAt: session.expiresAt
          }
        });
      }
      return null;
    }

    // Get user
    const user = users.get(session.userId);
    if (!user) {
      return null;
    }

    // Return user without sensitive data
    const { passwordHash: _, failedAttempts: __, lockoutUntil: ___, lastPasswordChange: ____, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Logout user and invalidate session
   */
  async logout(sessionId: string): Promise<void> {
    const session = sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      sessions.set(sessionId, session);

      await this.logAuditEvent({
        eventType: 'LOGOUT',
        userId: session.userId,
        sessionId: session.id,
        success: true,
        details: {
          logoutTime: new Date()
        }
      });
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    const user = users.get(userId);
    if (!user) {
      return null;
    }

    const { passwordHash: _, failedAttempts: __, lockoutUntil: ___, lastPasswordChange: ____, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Update user password
   */
  async updatePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
    const user = users.get(userId);
    if (!user) {
      return false;
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      return false;
    }

    // Validate new password
    this.validatePassword(newPassword);

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    
    user.passwordHash = newPasswordHash;
    user.lastPasswordChange = new Date();
    user.updatedAt = new Date();
    
    users.set(userId, user);

    await this.logAuditEvent({
      eventType: 'PASSWORD_RESET',
      userId: user.id,
      success: true,
      details: {
        passwordChangeTime: user.lastPasswordChange
      }
    });

    return true;
  }

  /**
   * Get audit logs (filtered to remove sensitive data)
   */
  getAuditLogs(userId?: string): AuthAuditEvent[] {
    let logs = auditLogs;
    
    if (userId) {
      logs = logs.filter(log => log.userId === userId);
    }

    // Remove sensitive details from logs
    return logs.map(log => ({
      ...log,
      details: {
        ...log.details,
        password: undefined,
        passwordHash: undefined
      }
    }));
  }

  /**
   * Create a new session
   */
  private async createSession(user: UserWithPassword, ipAddress: string, userAgent: string): Promise<AuthSession> {
    const session: AuthSession = {
      id: uuidv4(),
      userId: user.id,
      token: this.generateSecureToken(),
      refreshToken: this.generateSecureToken(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      ipAddress,
      userAgent,
      isActive: true,
      createdAt: new Date()
    };

    sessions.set(session.id, session);
    return session;
  }

  /**
   * Generate a secure token
   */
  private generateSecureToken(): string {
    return uuidv4() + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Validate password strength
   */
  private validatePassword(password: string): void {
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    
    if (!/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }
    
    if (!/[0-9]/.test(password)) {
      throw new Error('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      throw new Error('Password must contain at least one special character');
    }
  }

  /**
   * Log audit event for HIPAA compliance
   */
  private async logAuditEvent(event: Partial<AuthAuditEvent>): Promise<void> {
    const auditEvent: AuthAuditEvent = {
      id: uuidv4(),
      eventType: event.eventType!,
      userId: event.userId,
      sessionId: event.sessionId,
      ipAddress: event.ipAddress || '127.0.0.1',
      userAgent: event.userAgent || 'Unknown',
      success: event.success || false,
      details: {
        ...event.details,
        // Always mask sensitive data
        password: undefined,
        passwordHash: undefined
      },
      timestamp: new Date()
    };

    auditLogs.push(auditEvent);

    // Log to console (in production, store in encrypted database)
    console.log('[HIPAA Audit Log]', JSON.stringify(auditEvent, null, 2));
  }

  /**
   * Cleanup expired sessions (should be run periodically)
   */
  cleanupExpiredSessions(): void {
    const now = new Date();
    for (const [sessionId, session] of sessions.entries()) {
      if (session.expiresAt < now) {
        session.isActive = false;
        sessions.set(sessionId, session);
      }
    }
  }
}

// Export singleton instance
export const userService = new SecureUserService();