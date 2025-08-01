/**
 * @fileoverview Telehealth Service for Session Management
 * 
 * This service provides comprehensive telehealth session management including
 * session creation, participant management, recording, transcription, and
 * analytics logging for the modular dashboard.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { v4 as uuid } from 'uuid';
import {
  TelehealthSession,
  TelehealthSessionStatus,
  CreateSessionRequest,
  SessionSearchCriteria,
  TelehealthApiResponse,
  SessionParticipant,
  ParticipantType,
  SessionMetadata,
  AuditEntry,
  DashboardSummary,
  TelehealthDashboardData,
  UsageAnalytics,
  QualityInsights,
  validateSession,
  calculateSessionDuration,
  generateSessionSummary
} from '../types';
import { jitsiService, JitsiService } from './jitsiService';

/**
 * Configuration interface for the Telehealth service
 */
export interface TelehealthServiceConfig {
  /** Default session duration in minutes */
  defaultSessionDuration?: number;
  /** Enable session recording by default */
  enableRecordingByDefault?: boolean;
  /** Enable session transcription */
  enableTranscription?: boolean;
  /** Default locale for new sessions */
  defaultLocale?: string;
  /** Maximum concurrent sessions per provider */
  maxConcurrentSessions?: number;
  /** Session timeout in minutes */
  sessionTimeoutMinutes?: number;
  /** Enable analytics logging */
  enableAnalytics?: boolean;
}

/**
 * Default configuration for the Telehealth service
 */
const DEFAULT_CONFIG: Required<TelehealthServiceConfig> = {
  defaultSessionDuration: 30,
  enableRecordingByDefault: false,
  enableTranscription: true,
  defaultLocale: 'en',
  maxConcurrentSessions: 5,
  sessionTimeoutMinutes: 60,
  enableAnalytics: true
};

/**
 * In-memory storage for sessions (in real implementation, use database)
 */
const sessionStorage = new Map<string, TelehealthSession>();
const dashboardData = new Map<string, TelehealthDashboardData>();

/**
 * TelehealthService class provides comprehensive session management
 */
export class TelehealthService {
  private config: Required<TelehealthServiceConfig>;
  private jitsiService: JitsiService;

  /**
   * Creates a new TelehealthService instance
   * @param config - Optional configuration overrides
   * @param jitsiServiceInstance - Optional Jitsi service instance
   */
  constructor(
    config: TelehealthServiceConfig = {},
    jitsiServiceInstance?: JitsiService
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.jitsiService = jitsiServiceInstance || jitsiService;
  }

  /**
   * Create a new telehealth session
   * @param request - Session creation request
   * @returns Promise resolving to created session
   */
  public async createSession(
    request: CreateSessionRequest
  ): Promise<TelehealthApiResponse<TelehealthSession>> {
    try {
      // Validate request
      const validation = validateSession(request);
      if (!validation.valid) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid session data',
            details: validation.errors.join(', ')
          }
        };
      }

      // Generate session ID
      const sessionId = uuid();

      // Create Jitsi room
      const roomDisplayName = `WebQX Telehealth - ${new Date().toLocaleString()}`;
      const roomResult = await this.jitsiService.createRoom(
        request.patientId,
        roomDisplayName,
        request.roomConfig
      );

      if (!roomResult.success || !roomResult.data) {
        return {
          success: false,
          error: {
            code: 'ROOM_CREATION_ERROR',
            message: 'Failed to create Jitsi room',
            details: roomResult.error?.message || 'Unknown error'
          }
        };
      }

      // Create session metadata
      const now = new Date();
      const metadata: SessionMetadata = {
        createdAt: now,
        updatedAt: now,
        locale: this.config.defaultLocale,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        technicalInfo: {
          jitsiServer: this.jitsiService.getConfig().serverUrl,
          protocolVersion: '1.0',
          codecInfo: {
            audioCodec: 'opus',
            videoCodec: 'vp8'
          },
          serverRegion: 'auto'
        },
        auditInfo: {
          hipaaCompliant: true,
          encrypted: true,
          auditTrail: [
            {
              id: uuid(),
              action: 'session_created',
              performedBy: request.providerId,
              timestamp: now,
              details: {
                sessionId,
                patientId: request.patientId,
                scheduledStartTime: request.scheduledStartTime
              }
            }
          ]
        }
      };

      // Create session
      const session: TelehealthSession = {
        id: sessionId,
        patientId: request.patientId,
        providerId: request.providerId,
        status: 'scheduled',
        scheduledStartTime: request.scheduledStartTime,
        durationMinutes: request.durationMinutes || this.config.defaultSessionDuration,
        jitsiRoom: roomResult.data,
        participants: [],
        metadata,
        chiefComplaint: request.chiefComplaint,
        notes: request.notes,
        appointmentId: request.appointmentId
      };

      // Add recording configuration if enabled
      if (request.recordingConfig?.enabled || this.config.enableRecordingByDefault) {
        session.recording = {
          id: uuid(),
          status: 'not_recorded',
          consent: {
            consentObtained: !request.recordingConfig?.requireConsent,
            consentMethod: 'checkbox'
          }
        };
      }

      // Store session
      sessionStorage.set(sessionId, session);

      // Log analytics
      if (this.config.enableAnalytics) {
        await this.logSessionEvent(sessionId, 'session_created', {
          patientId: request.patientId,
          providerId: request.providerId,
          scheduledStartTime: request.scheduledStartTime
        });
      }

      return {
        success: true,
        data: session,
        metadata: {
          requestId: uuid(),
          timestamp: now,
          processingTimeMs: 0
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SESSION_CREATION_ERROR',
          message: 'Failed to create telehealth session',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Get session by ID
   * @param sessionId - Session ID
   * @returns Promise resolving to session data
   */
  public async getSession(sessionId: string): Promise<TelehealthApiResponse<TelehealthSession>> {
    try {
      const session = sessionStorage.get(sessionId);
      
      if (!session) {
        return {
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: 'Session not found',
            details: `No session found with ID: ${sessionId}`
          }
        };
      }

      return {
        success: true,
        data: session,
        metadata: {
          requestId: uuid(),
          timestamp: new Date(),
          processingTimeMs: 0
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SESSION_RETRIEVAL_ERROR',
          message: 'Failed to retrieve session',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Update session status
   * @param sessionId - Session ID
   * @param status - New status
   * @param metadata - Optional metadata updates
   * @returns Promise resolving to updated session
   */
  public async updateSessionStatus(
    sessionId: string,
    status: TelehealthSessionStatus,
    metadata?: Record<string, unknown>
  ): Promise<TelehealthApiResponse<TelehealthSession>> {
    try {
      const session = sessionStorage.get(sessionId);
      
      if (!session) {
        return {
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: 'Session not found'
          }
        };
      }

      // Update session status and metadata
      const now = new Date();
      session.status = status;
      session.metadata.updatedAt = now;

      // Handle status-specific updates
      switch (status) {
        case 'in_progress':
          session.actualStartTime = now;
          break;
        case 'completed':
          session.endTime = now;
          if (session.actualStartTime) {
            session.durationMinutes = calculateSessionDuration(session.actualStartTime, now);
          }
          break;
      }

      // Add audit entry
      const auditEntry: AuditEntry = {
        id: uuid(),
        action: `status_changed_to_${status}`,
        performedBy: session.providerId,
        timestamp: now,
        details: {
          sessionId,
          previousStatus: sessionStorage.get(sessionId)?.status,
          newStatus: status,
          ...metadata
        }
      };
      session.metadata.auditInfo?.auditTrail.push(auditEntry);

      // Update storage
      sessionStorage.set(sessionId, session);

      // Log analytics
      if (this.config.enableAnalytics) {
        await this.logSessionEvent(sessionId, `status_${status}`, {
          sessionId,
          status,
          timestamp: now
        });
      }

      return {
        success: true,
        data: session,
        metadata: {
          requestId: uuid(),
          timestamp: now,
          processingTimeMs: 0
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SESSION_UPDATE_ERROR',
          message: 'Failed to update session status',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Add participant to session
   * @param sessionId - Session ID
   * @param participant - Participant information
   * @returns Promise resolving to updated session
   */
  public async addParticipant(
    sessionId: string,
    participant: Omit<SessionParticipant, 'id' | 'joinedAt'>
  ): Promise<TelehealthApiResponse<TelehealthSession>> {
    try {
      const session = sessionStorage.get(sessionId);
      
      if (!session) {
        return {
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: 'Session not found'
          }
        };
      }

      // Create participant with ID and join time
      const newParticipant: SessionParticipant = {
        ...participant,
        id: uuid(),
        joinedAt: new Date()
      };

      // Add participant to session
      session.participants.push(newParticipant);
      session.metadata.updatedAt = new Date();

      // Update storage
      sessionStorage.set(sessionId, session);

      // Log analytics
      if (this.config.enableAnalytics) {
        await this.logSessionEvent(sessionId, 'participant_joined', {
          participantId: newParticipant.id,
          participantType: participant.type,
          participantName: participant.name
        });
      }

      return {
        success: true,
        data: session,
        metadata: {
          requestId: uuid(),
          timestamp: new Date(),
          processingTimeMs: 0
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PARTICIPANT_ADD_ERROR',
          message: 'Failed to add participant',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Remove participant from session
   * @param sessionId - Session ID
   * @param participantId - Participant ID
   * @returns Promise resolving to updated session
   */
  public async removeParticipant(
    sessionId: string,
    participantId: string
  ): Promise<TelehealthApiResponse<TelehealthSession>> {
    try {
      const session = sessionStorage.get(sessionId);
      
      if (!session) {
        return {
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: 'Session not found'
          }
        };
      }

      // Find and update participant
      const participantIndex = session.participants.findIndex(p => p.id === participantId);
      if (participantIndex === -1) {
        return {
          success: false,
          error: {
            code: 'PARTICIPANT_NOT_FOUND',
            message: 'Participant not found'
          }
        };
      }

      // Set leave time
      session.participants[participantIndex].leftAt = new Date();
      session.metadata.updatedAt = new Date();

      // Update storage
      sessionStorage.set(sessionId, session);

      // Log analytics
      if (this.config.enableAnalytics) {
        await this.logSessionEvent(sessionId, 'participant_left', {
          participantId,
          participantType: session.participants[participantIndex].type
        });
      }

      return {
        success: true,
        data: session,
        metadata: {
          requestId: uuid(),
          timestamp: new Date(),
          processingTimeMs: 0
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PARTICIPANT_REMOVE_ERROR',
          message: 'Failed to remove participant',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Search sessions based on criteria
   * @param criteria - Search criteria
   * @returns Promise resolving to matching sessions
   */
  public async searchSessions(
    criteria: SessionSearchCriteria
  ): Promise<TelehealthApiResponse<TelehealthSession[]>> {
    try {
      let sessions = Array.from(sessionStorage.values());

      // Apply filters
      if (criteria.patientId) {
        sessions = sessions.filter(s => s.patientId === criteria.patientId);
      }

      if (criteria.providerId) {
        sessions = sessions.filter(s => s.providerId === criteria.providerId);
      }

      if (criteria.status && criteria.status.length > 0) {
        sessions = sessions.filter(s => criteria.status!.includes(s.status));
      }

      if (criteria.dateRange) {
        sessions = sessions.filter(s => {
          const sessionDate = s.scheduledStartTime;
          return sessionDate >= criteria.dateRange!.startDate && 
                 sessionDate <= criteria.dateRange!.endDate;
        });
      }

      if (criteria.searchText) {
        const searchLower = criteria.searchText.toLowerCase();
        sessions = sessions.filter(s => 
          s.chiefComplaint?.toLowerCase().includes(searchLower) ||
          s.notes?.toLowerCase().includes(searchLower) ||
          s.jitsiRoom.displayName.toLowerCase().includes(searchLower)
        );
      }

      // Apply sorting
      if (criteria.sortBy) {
        sessions.sort((a, b) => {
          let aValue: any;
          let bValue: any;

          switch (criteria.sortBy) {
            case 'scheduledStartTime':
              aValue = a.scheduledStartTime.getTime();
              bValue = b.scheduledStartTime.getTime();
              break;
            case 'actualStartTime':
              aValue = a.actualStartTime?.getTime() || 0;
              bValue = b.actualStartTime?.getTime() || 0;
              break;
            case 'durationMinutes':
              aValue = a.durationMinutes || 0;
              bValue = b.durationMinutes || 0;
              break;
            case 'status':
              aValue = a.status;
              bValue = b.status;
              break;
            default:
              aValue = a.scheduledStartTime.getTime();
              bValue = b.scheduledStartTime.getTime();
          }

          if (criteria.sortOrder === 'desc') {
            return bValue > aValue ? 1 : -1;
          }
          return aValue > bValue ? 1 : -1;
        });
      }

      // Apply pagination
      const page = criteria.page || 1;
      const pageSize = criteria.pageSize || 10;
      const startIndex = (page - 1) * pageSize;
      const paginatedSessions = sessions.slice(startIndex, startIndex + pageSize);

      return {
        success: true,
        data: paginatedSessions,
        metadata: {
          requestId: uuid(),
          timestamp: new Date(),
          processingTimeMs: 0
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SESSION_SEARCH_ERROR',
          message: 'Failed to search sessions',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Get dashboard data for analytics
   * @param providerId - Optional provider ID filter
   * @param dateRange - Optional date range filter
   * @returns Promise resolving to dashboard data
   */
  public async getDashboardData(
    providerId?: string,
    dateRange?: { startDate: Date; endDate: Date }
  ): Promise<TelehealthApiResponse<TelehealthDashboardData>> {
    try {
      let sessions = Array.from(sessionStorage.values());

      // Apply filters
      if (providerId) {
        sessions = sessions.filter(s => s.providerId === providerId);
      }

      if (dateRange) {
        sessions = sessions.filter(s => {
          const sessionDate = s.scheduledStartTime;
          return sessionDate >= dateRange.startDate && sessionDate <= dateRange.endDate;
        });
      }

      // Calculate summary statistics
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      const summary: DashboardSummary = {
        totalSessions: sessions.length,
        sessionsToday: sessions.filter(s => s.scheduledStartTime >= today).length,
        sessionsThisWeek: sessions.filter(s => s.scheduledStartTime >= weekAgo).length,
        sessionsThisMonth: sessions.filter(s => s.scheduledStartTime >= monthAgo).length,
        averageSessionDuration: sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0) / sessions.length || 0,
        noShowRate: sessions.filter(s => s.status === 'no_show').length / sessions.length || 0,
        completionRate: sessions.filter(s => s.status === 'completed').length / sessions.length || 0
      };

      // Generate analytics data
      const analytics: UsageAnalytics = {
        sessionsByPeriod: this.generateSessionsByPeriod(sessions),
        sessionsByHour: this.generateSessionsByHour(sessions),
        deviceTypes: this.generateDeviceTypeDistribution(sessions),
        localeDistribution: this.generateLocaleDistribution(sessions)
      };

      // Generate quality insights
      const qualityInsights: QualityInsights = {
        qualityTrend: this.generateQualityTrend(sessions),
        commonIssues: this.generateCommonIssues(sessions),
        qualityByDevice: this.generateQualityByDevice(sessions),
        networkTrends: this.generateNetworkTrends(sessions)
      };

      const dashboardData: TelehealthDashboardData = {
        summary,
        recentSessions: sessions.slice(-10).reverse(),
        analytics,
        qualityInsights
      };

      return {
        success: true,
        data: dashboardData,
        metadata: {
          requestId: uuid(),
          timestamp: new Date(),
          processingTimeMs: 0
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'DASHBOARD_DATA_ERROR',
          message: 'Failed to generate dashboard data',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Log session event for analytics
   * @param sessionId - Session ID
   * @param event - Event name
   * @param data - Event data
   */
  private async logSessionEvent(
    sessionId: string,
    event: string,
    data: Record<string, unknown>
  ): Promise<void> {
    // In a real implementation, this would log to analytics service
    // For now, just log to console
    console.log(`[Telehealth Analytics] ${event}:`, {
      sessionId,
      timestamp: new Date(),
      ...data
    });
  }

  // Helper methods for analytics generation
  private generateSessionsByPeriod(sessions: TelehealthSession[]) {
    // Implementation for generating sessions by period
    return [];
  }

  private generateSessionsByHour(sessions: TelehealthSession[]) {
    // Implementation for generating sessions by hour
    return [];
  }

  private generateDeviceTypeDistribution(sessions: TelehealthSession[]) {
    // Implementation for device type distribution
    return [];
  }

  private generateLocaleDistribution(sessions: TelehealthSession[]) {
    // Implementation for locale distribution
    return [];
  }

  private generateQualityTrend(sessions: TelehealthSession[]) {
    // Implementation for quality trend
    return [];
  }

  private generateCommonIssues(sessions: TelehealthSession[]) {
    // Implementation for common issues
    return [];
  }

  private generateQualityByDevice(sessions: TelehealthSession[]) {
    // Implementation for quality by device
    return [];
  }

  private generateNetworkTrends(sessions: TelehealthSession[]) {
    // Implementation for network trends
    return [];
  }

  /**
   * Get current service configuration
   * @returns Current configuration
   */
  public getConfig(): Required<TelehealthServiceConfig> {
    return { ...this.config };
  }

  /**
   * Update service configuration
   * @param newConfig - Configuration updates
   */
  public updateConfig(newConfig: Partial<TelehealthServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

/**
 * Default TelehealthService instance for easy importing
 */
export const telehealthService = new TelehealthService();

export default telehealthService;