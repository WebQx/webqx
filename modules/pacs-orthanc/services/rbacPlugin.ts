/**
 * WebQX™ Orthanc PACS Integration - RBAC Plugin
 * Role-Based Access Control for DICOM files and metadata
 */

import { EventEmitter } from 'events';
import {
  RBACConfig,
  Permission,
  UserContext,
  AccessLog,
  ResourceType,
  ActionType,
  PermissionCondition,
  PluginConfig,
  HealthStatus
} from '../types';
import { OrthancClient } from '../utils/orthancClient';

export class RBACPlugin extends EventEmitter {
  private config: RBACConfig;
  private pluginConfig: PluginConfig;
  private orthancClient: OrthancClient;
  private accessProvider: AccessProvider;
  private activeSessions: Map<string, UserContext> = new Map();
  private accessLogs: AccessLog[] = [];
  private isInitialized = false;

  constructor(
    config: RBACConfig,
    pluginConfig: PluginConfig,
    orthancClient: OrthancClient,
    accessProvider: AccessProvider
  ) {
    super();
    this.config = config;
    this.pluginConfig = pluginConfig;
    this.orthancClient = orthancClient;
    this.accessProvider = accessProvider;
  }

  /**
   * Initialize the RBAC plugin
   */
  async initialize(): Promise<void> {
    try {
      if (!this.config.enabled) {
        console.log('[RBAC Plugin] RBAC is disabled, skipping initialization');
        return;
      }

      // Initialize access provider
      await this.accessProvider.initialize();
      
      // Set up session management
      this.setupSessionManagement();
      
      // Set up audit logging
      this.setupAuditLogging();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      console.log('[RBAC Plugin] Successfully initialized');
    } catch (error) {
      this.emit('error', {
        code: 'INITIALIZATION_FAILED',
        message: 'Failed to initialize RBAC plugin',
        details: error,
        timestamp: new Date(),
        pluginName: 'RBACPlugin',
        severity: 'critical'
      });
      throw error;
    }
  }

  /**
   * Get health status of the plugin
   */
  async getHealthStatus(): Promise<HealthStatus> {
    try {
      if (!this.config.enabled) {
        return {
          status: 'healthy',
          message: 'RBAC disabled',
          timestamp: new Date(),
          version: '1.0.0'
        };
      }

      if (!this.isInitialized) {
        return {
          status: 'unhealthy',
          message: 'Plugin not initialized',
          timestamp: new Date(),
          version: '1.0.0'
        };
      }

      // Check access provider health
      const providerHealth = await this.accessProvider.healthCheck();
      
      // Check Orthanc connectivity
      const orthancHealth = await this.orthancClient.healthCheck();

      if (!orthancHealth) {
        return {
          status: 'degraded',
          message: 'Orthanc server not accessible',
          details: { orthancHealth, providerHealth },
          timestamp: new Date(),
          version: '1.0.0'
        };
      }

      if (!providerHealth) {
        return {
          status: 'degraded',
          message: 'Access provider not accessible',
          details: { orthancHealth, providerHealth },
          timestamp: new Date(),
          version: '1.0.0'
        };
      }

      return {
        status: 'healthy',
        message: 'All systems operational',
        details: {
          orthancHealth,
          providerHealth,
          activeSessions: this.activeSessions.size,
          auditLogsCount: this.accessLogs.length,
          rbacEnabled: this.config.enabled
        },
        timestamp: new Date(),
        version: '1.0.0'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Health check failed',
        details: error,
        timestamp: new Date(),
        version: '1.0.0'
      };
    }
  }

  /**
   * Authenticate user and create session
   */
  async authenticateUser(token: string, ipAddress?: string, userAgent?: string): Promise<UserContext> {
    if (!this.config.enabled) {
      throw new Error('RBAC is disabled');
    }

    try {
      // Validate token with access provider
      const userInfo = await this.accessProvider.validateToken(token);
      
      // Get user permissions
      const permissions = await this.getUserPermissions(userInfo.userId, userInfo.roles);
      
      // Create user context
      const userContext: UserContext = {
        userId: userInfo.userId,
        username: userInfo.username,
        roles: userInfo.roles,
        permissions,
        institutionId: userInfo.institutionId,
        departmentId: userInfo.departmentId,
        specialties: userInfo.specialties || [],
        sessionId: this.generateSessionId(),
        isActive: true,
        lastActivity: new Date()
      };

      // Store session
      this.activeSessions.set(userContext.sessionId, userContext);

      // Log authentication
      await this.logAccess({
        userId: userContext.userId,
        resource: 'system',
        action: 'auth',
        allowed: true,
        timestamp: new Date(),
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown',
        reasoning: 'User authenticated successfully'
      });

      this.emit('user_authenticated', userContext);

      return userContext;
    } catch (error) {
      // Log failed authentication
      await this.logAccess({
        userId: 'unknown',
        resource: 'system',
        action: 'auth',
        allowed: false,
        timestamp: new Date(),
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown',
        reasoning: `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });

      throw error;
    }
  }

  /**
   * Check if user has permission to access resource
   */
  async checkPermission(
    sessionId: string,
    resource: ResourceType,
    action: ActionType,
    resourceId?: string,
    metadata?: any
  ): Promise<boolean> {
    if (!this.config.enabled) {
      return true; // Allow all access when RBAC is disabled
    }

    const userContext = this.activeSessions.get(sessionId);
    if (!userContext) {
      await this.logAccess({
        userId: 'unknown',
        resource: `${resource}:${resourceId || 'unknown'}`,
        action,
        allowed: false,
        timestamp: new Date(),
        ipAddress: 'unknown',
        userAgent: 'unknown',
        reasoning: 'Invalid or expired session'
      });
      return false;
    }

    // Update last activity
    userContext.lastActivity = new Date();

    try {
      // Check if user has required permission
      const hasPermission = this.evaluatePermissions(userContext, resource, action, metadata);
      
      // Additional resource-specific checks
      if (hasPermission && resourceId) {
        const resourceAccess = await this.checkResourceAccess(userContext, resource, resourceId, metadata);
        if (!resourceAccess.allowed) {
          await this.logAccess({
            userId: userContext.userId,
            resource: `${resource}:${resourceId}`,
            action,
            allowed: false,
            timestamp: new Date(),
            ipAddress: 'unknown',
            userAgent: 'unknown',
            reasoning: resourceAccess.reason
          });
          return false;
        }
      }

      // Log access attempt
      await this.logAccess({
        userId: userContext.userId,
        resource: `${resource}:${resourceId || 'unknown'}`,
        action,
        allowed: hasPermission,
        timestamp: new Date(),
        ipAddress: 'unknown',
        userAgent: 'unknown',
        reasoning: hasPermission ? 'Permission granted' : 'Permission denied'
      });

      return hasPermission;
    } catch (error) {
      await this.logAccess({
        userId: userContext.userId,
        resource: `${resource}:${resourceId || 'unknown'}`,
        action,
        allowed: false,
        timestamp: new Date(),
        ipAddress: 'unknown',
        userAgent: 'unknown',
        reasoning: `Permission check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      return false;
    }
  }

  /**
   * Get user context from session
   */
  getUserContext(sessionId: string): UserContext | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Logout user and invalidate session
   */
  async logoutUser(sessionId: string): Promise<void> {
    const userContext = this.activeSessions.get(sessionId);
    if (userContext) {
      this.activeSessions.delete(sessionId);
      
      await this.logAccess({
        userId: userContext.userId,
        resource: 'system',
        action: 'auth',
        allowed: true,
        timestamp: new Date(),
        ipAddress: 'unknown',
        userAgent: 'unknown',
        reasoning: 'User logged out'
      });

      this.emit('user_logged_out', userContext);
    }
  }

  /**
   * Get access logs for audit purposes
   */
  getAccessLogs(
    userId?: string,
    resource?: string,
    fromDate?: Date,
    toDate?: Date,
    limit = 100
  ): AccessLog[] {
    let logs = this.accessLogs;

    if (userId) {
      logs = logs.filter(log => log.userId === userId);
    }

    if (resource) {
      logs = logs.filter(log => log.resource.includes(resource));
    }

    if (fromDate) {
      logs = logs.filter(log => log.timestamp >= fromDate);
    }

    if (toDate) {
      logs = logs.filter(log => log.timestamp <= toDate);
    }

    return logs.slice(-limit);
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): UserContext[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Force logout all sessions for a user
   */
  async forceLogoutUser(userId: string): Promise<void> {
    const sessionsToRemove: string[] = [];
    
    for (const [sessionId, userContext] of this.activeSessions.entries()) {
      if (userContext.userId === userId) {
        sessionsToRemove.push(sessionId);
      }
    }

    for (const sessionId of sessionsToRemove) {
      await this.logoutUser(sessionId);
    }
  }

  private async getUserPermissions(userId: string, roles: string[]): Promise<Permission[]> {
    const permissions: Permission[] = [...this.config.defaultPermissions];
    
    // Get role-based permissions
    for (const role of roles) {
      const rolePermissions = await this.accessProvider.getRolePermissions(role);
      permissions.push(...rolePermissions);
    }

    // Get user-specific permissions
    const userPermissions = await this.accessProvider.getUserPermissions(userId);
    permissions.push(...userPermissions);

    // Remove duplicates and apply hierarchy
    return this.deduplicatePermissions(permissions);
  }

  private evaluatePermissions(
    userContext: UserContext,
    resource: ResourceType,
    action: ActionType,
    metadata?: any
  ): boolean {
    // Check if user has specific permission
    for (const permission of userContext.permissions) {
      if (permission.resource === resource && permission.action === action) {
        // Check conditions if any
        if (permission.conditions) {
          const conditionsMet = this.evaluateConditions(permission.conditions, userContext, metadata);
          if (conditionsMet) {
            return true;
          }
        } else {
          return true;
        }
      }
    }

    // Check for admin permissions
    if (userContext.roles.includes('admin')) {
      return true;
    }

    // Check role hierarchy
    for (const role of userContext.roles) {
      const inheritedRoles = this.config.roleHierarchy[role] || [];
      for (const inheritedRole of inheritedRoles) {
        if (this.hasRolePermission(inheritedRole, resource, action)) {
          return true;
        }
      }
    }

    return false;
  }

  private evaluateConditions(
    conditions: PermissionCondition[],
    userContext: UserContext,
    metadata?: any
  ): boolean {
    for (const condition of conditions) {
      if (!this.evaluateCondition(condition, userContext, metadata)) {
        return false;
      }
    }
    return true;
  }

  private evaluateCondition(
    condition: PermissionCondition,
    userContext: UserContext,
    metadata?: any
  ): boolean {
    let fieldValue: any;

    // Get field value from user context or metadata
    if (condition.field.startsWith('user.')) {
      const userField = condition.field.substring(5);
      fieldValue = (userContext as any)[userField];
    } else if (metadata) {
      fieldValue = metadata[condition.field];
    } else {
      return false;
    }

    // Evaluate condition
    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'contains':
        return typeof fieldValue === 'string' && fieldValue.includes(condition.value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
      case 'date_range':
        if (Array.isArray(condition.value) && condition.value.length === 2) {
          const date = new Date(fieldValue);
          const startDate = new Date(condition.value[0]);
          const endDate = new Date(condition.value[1]);
          return date >= startDate && date <= endDate;
        }
        return false;
      default:
        return false;
    }
  }

  private async checkResourceAccess(
    userContext: UserContext,
    resource: ResourceType,
    resourceId: string,
    metadata?: any
  ): Promise<{ allowed: boolean; reason: string }> {
    try {
      // Get resource metadata from Orthanc if not provided
      if (!metadata) {
        switch (resource) {
          case 'study':
            const studyResponse = await this.orthancClient.getStudyTags(resourceId);
            metadata = studyResponse.data;
            break;
          case 'series':
            const seriesResponse = await this.orthancClient.getSeriesTags(resourceId);
            metadata = seriesResponse.data;
            break;
          case 'instance':
            const instanceResponse = await this.orthancClient.getInstanceTags(resourceId);
            metadata = instanceResponse.data;
            break;
        }
      }

      // Institution-based access control
      if (userContext.institutionId && metadata?.InstitutionName) {
        const userInstitution = await this.accessProvider.getInstitutionName(userContext.institutionId);
        if (userInstitution !== metadata.InstitutionName) {
          return {
            allowed: false,
            reason: 'Access denied: Different institution'
          };
        }
      }

      // Specialty-based access control
      if (userContext.specialties.length > 0 && metadata?.Modality) {
        const modalitySpecialties = this.getModalitySpecialties(metadata.Modality);
        const hasSpecialtyAccess = userContext.specialties.some(specialty => 
          modalitySpecialties.includes(specialty)
        );
        
        if (!hasSpecialtyAccess) {
          return {
            allowed: false,
            reason: 'Access denied: Specialty restriction'
          };
        }
      }

      return { allowed: true, reason: 'Access granted' };
    } catch (error) {
      return {
        allowed: false,
        reason: `Resource access check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private getModalitySpecialties(modality: string): string[] {
    const modalityMap: Record<string, string[]> = {
      'CT': ['radiology', 'emergency', 'surgery'],
      'MR': ['radiology', 'neurology', 'orthopedics'],
      'US': ['radiology', 'obstetrics', 'cardiology', 'emergency'],
      'XR': ['radiology', 'orthopedics', 'emergency'],
      'CR': ['radiology', 'emergency'],
      'DX': ['radiology', 'emergency'],
      'MG': ['radiology', 'breast-imaging'],
      'PT': ['nuclear-medicine', 'oncology'],
      'NM': ['nuclear-medicine'],
      'RF': ['radiology', 'gastroenterology'],
      'ECG': ['cardiology'],
      'EPS': ['cardiology']
    };

    return modalityMap[modality] || ['radiology'];
  }

  private hasRolePermission(role: string, resource: ResourceType, action: ActionType): boolean {
    // Role-based permission logic
    const rolePermissions: Record<string, Permission[]> = {
      'admin': [
        { resource: 'system', action: 'admin' },
        { resource: 'study', action: 'read' },
        { resource: 'study', action: 'write' },
        { resource: 'study', action: 'delete' }
      ],
      'radiologist': [
        { resource: 'study', action: 'read' },
        { resource: 'study', action: 'write' },
        { resource: 'study', action: 'annotate' }
      ],
      'technician': [
        { resource: 'study', action: 'read' },
        { resource: 'instance', action: 'read' }
      ],
      'viewer': [
        { resource: 'study', action: 'read' },
        { resource: 'series', action: 'read' },
        { resource: 'instance', action: 'read' }
      ]
    };

    const permissions = rolePermissions[role] || [];
    return permissions.some(p => p.resource === resource && p.action === action);
  }

  private deduplicatePermissions(permissions: Permission[]): Permission[] {
    const seen = new Set<string>();
    const unique: Permission[] = [];

    for (const permission of permissions) {
      const key = `${permission.resource}:${permission.action}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(permission);
      }
    }

    return unique;
  }

  private generateSessionId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  private setupSessionManagement(): void {
    // Clean up expired sessions every 5 minutes
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 5 * 60 * 1000);
  }

  private setupAuditLogging(): void {
    if (this.config.auditLogging) {
      // Clean up old audit logs daily
      setInterval(() => {
        this.cleanupOldAuditLogs();
      }, 24 * 60 * 60 * 1000);
    }
  }

  private cleanupExpiredSessions(): void {
    const now = new Date();
    const expiredSessions: string[] = [];

    for (const [sessionId, userContext] of this.activeSessions.entries()) {
      const inactiveTime = now.getTime() - userContext.lastActivity.getTime();
      if (inactiveTime > this.config.sessionTimeout * 1000) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      this.logoutUser(sessionId);
    }
  }

  private cleanupOldAuditLogs(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90); // Keep logs for 90 days

    this.accessLogs = this.accessLogs.filter(log => log.timestamp >= cutoffDate);
  }

  private async logAccess(log: AccessLog): Promise<void> {
    if (this.config.auditLogging) {
      this.accessLogs.push(log);
      
      // Keep only recent logs in memory
      if (this.accessLogs.length > 10000) {
        this.accessLogs = this.accessLogs.slice(-5000);
      }

      this.emit('access_logged', log);
    }
  }
}

// Abstract base class for access providers
export abstract class AccessProvider {
  abstract initialize(): Promise<void>;
  abstract healthCheck(): Promise<boolean>;
  abstract validateToken(token: string): Promise<any>;
  abstract getRolePermissions(role: string): Promise<Permission[]>;
  abstract getUserPermissions(userId: string): Promise<Permission[]>;
  abstract getInstitutionName(institutionId: string): Promise<string>;
}

// WebQX Integration Access Provider
export class WebQXAccessProvider extends AccessProvider {
  private webqxApiUrl: string;
  private apiKey: string;

  constructor(webqxApiUrl: string, apiKey: string) {
    super();
    this.webqxApiUrl = webqxApiUrl;
    this.apiKey = apiKey;
  }

  async initialize(): Promise<void> {
    console.log('[WebQX Access Provider] Initialized WebQX access provider');
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Check WebQX API health
      const response = await fetch(`${this.webqxApiUrl}/health`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async validateToken(token: string): Promise<any> {
    // Validate token with WebQX authentication service
    const response = await fetch(`${this.webqxApiUrl}/auth/validate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Invalid token');
    }

    return response.json();
  }

  async getRolePermissions(role: string): Promise<Permission[]> {
    // Get role permissions from WebQX
    const response = await fetch(`${this.webqxApiUrl}/auth/roles/${role}/permissions`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` }
    });

    if (response.ok) {
      return response.json();
    }

    return [];
  }

  async getUserPermissions(userId: string): Promise<Permission[]> {
    // Get user-specific permissions from WebQX
    const response = await fetch(`${this.webqxApiUrl}/auth/users/${userId}/permissions`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` }
    });

    if (response.ok) {
      return response.json();
    }

    return [];
  }

  async getInstitutionName(institutionId: string): Promise<string> {
    // Get institution name from WebQX
    const response = await fetch(`${this.webqxApiUrl}/institutions/${institutionId}`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` }
    });

    if (response.ok) {
      const institution = await response.json();
      return institution.name;
    }

    return '';
  }
}