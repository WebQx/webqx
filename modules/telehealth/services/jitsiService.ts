/**
 * @fileoverview Jitsi Service for Telehealth Platform
 * 
 * This service provides secure Jitsi room management using patient UUIDs
 * for telehealth sessions. It includes room generation, configuration,
 * and security features for HIPAA-compliant video conferencing.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import { v4 as uuid } from 'uuid';
import {
  JitsiRoomConfig,
  JitsiRoomOptions,
  JitsiRoomLink,
  TelehealthApiResponse,
  generateRoomName
} from '../types';

/**
 * Configuration interface for the Jitsi service
 */
export interface JitsiServiceConfig {
  /** Jitsi Meet server URL */
  serverUrl?: string;
  /** Default room options */
  defaultRoomOptions?: JitsiRoomOptions;
  /** Room expiration time in hours */
  defaultExpirationHours?: number;
  /** Enable room passwords by default */
  enablePasswordsByDefault?: boolean;
  /** Maximum participants per room */
  maxParticipants?: number;
  /** Enable lobby mode by default */
  enableLobbyByDefault?: boolean;
}

/**
 * Default configuration for the Jitsi service
 */
const DEFAULT_CONFIG: Required<JitsiServiceConfig> = {
  serverUrl: (typeof process !== 'undefined' && process.env?.JITSI_SERVER_URL) || 'https://meet.jit.si',
  defaultRoomOptions: {
    enableLobby: true,
    requirePassword: true,
    enableChat: true,
    enableScreenSharing: true,
    enableAudioMute: true,
    enableVideoMute: true,
    enableBackgroundFeatures: true,
    enableNoiseSuppression: true
  },
  defaultExpirationHours: 24,
  enablePasswordsByDefault: true,
  maxParticipants: 10,
  enableLobbyByDefault: true
};

/**
 * JitsiService class provides secure room management for telehealth sessions
 */
export class JitsiService {
  private config: Required<JitsiServiceConfig>;

  /**
   * Creates a new JitsiService instance
   * @param config - Optional configuration overrides
   */
  constructor(config: JitsiServiceConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Validate server URL is configured
    if (!this.config.serverUrl) {
      throw new Error('Jitsi server URL must be configured via JITSI_SERVER_URL environment variable or config');
    }
  }

  /**
   * Generate a secure room name using patient UUID
   * @param patientId - Patient UUID
   * @param sessionId - Optional session ID for additional uniqueness
   * @returns Generated room name
   */
  public generateSecureRoomName(patientId: string, sessionId?: string): string {
    // Validate patient ID format (should be UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(patientId)) {
      throw new Error('Patient ID must be a valid UUID format');
    }

    return generateRoomName(patientId, sessionId);
  }

  /**
   * Generate a secure room password
   * @returns Generated password
   */
  private generateRoomPassword(): string {
    // Generate a secure 8-character password with mixed case and numbers
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  /**
   * Create a new Jitsi room configuration for a telehealth session
   * @param patientId - Patient UUID
   * @param displayName - Human-readable room name
   * @param options - Optional room configuration overrides
   * @returns Promise resolving to room configuration
   */
  public async createRoom(
    patientId: string,
    displayName: string,
    options: Partial<JitsiRoomOptions> = {}
  ): Promise<TelehealthApiResponse<JitsiRoomConfig>> {
    try {
      // Generate secure room name
      const roomName = this.generateSecureRoomName(patientId);

      // Merge options with defaults
      const roomOptions: JitsiRoomOptions = {
        ...this.config.defaultRoomOptions,
        ...options
      };

      // Generate password if required
      const password = roomOptions.requirePassword || this.config.enablePasswordsByDefault
        ? this.generateRoomPassword()
        : undefined;

      // Set expiration time
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.config.defaultExpirationHours);

      // Create room configuration
      const roomConfig: JitsiRoomConfig = {
        roomName,
        displayName,
        password,
        maxParticipants: this.config.maxParticipants,
        enableRecording: false, // Default to false for privacy
        expiresAt,
        options: roomOptions
      };

      return {
        success: true,
        data: roomConfig,
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
          code: 'ROOM_CREATION_ERROR',
          message: 'Failed to create Jitsi room',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        metadata: {
          requestId: uuid(),
          timestamp: new Date(),
          processingTimeMs: 0
        }
      };
    }
  }

  /**
   * Generate room access links for different platforms
   * @param roomConfig - Room configuration
   * @returns Promise resolving to room links
   */
  public async generateRoomLinks(
    roomConfig: JitsiRoomConfig
  ): Promise<TelehealthApiResponse<JitsiRoomLink>> {
    try {
      const baseUrl = this.config.serverUrl.replace(/\/$/, ''); // Remove trailing slash
      const roomName = encodeURIComponent(roomConfig.roomName);
      
      // Base room URL
      const roomUrl = `${baseUrl}/${roomName}`;
      
      // Web link with optional password parameter
      let webLink = roomUrl;
      if (roomConfig.password) {
        webLink += `#config.roomPassword="${encodeURIComponent(roomConfig.password)}"`;
      }

      // Mobile deep links (Jitsi Meet app)
      const mobileLink = `jitsi-meet://${baseUrl.replace(/^https?:\/\//, '')}/${roomName}`;

      const roomLinks: JitsiRoomLink = {
        roomUrl,
        roomName: roomConfig.roomName,
        webLink,
        mobileLink,
        expiresAt: roomConfig.expiresAt
      };

      return {
        success: true,
        data: roomLinks,
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
          code: 'LINK_GENERATION_ERROR',
          message: 'Failed to generate room links',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        metadata: {
          requestId: uuid(),
          timestamp: new Date(),
          processingTimeMs: 0
        }
      };
    }
  }

  /**
   * Validate room configuration
   * @param roomConfig - Room configuration to validate
   * @returns Validation result
   */
  public validateRoomConfig(roomConfig: JitsiRoomConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!roomConfig.roomName) {
      errors.push('Room name is required');
    }

    if (!roomConfig.displayName) {
      errors.push('Display name is required');
    }

    if (roomConfig.maxParticipants && roomConfig.maxParticipants < 2) {
      errors.push('Maximum participants must be at least 2');
    }

    if (roomConfig.maxParticipants && roomConfig.maxParticipants > 50) {
      errors.push('Maximum participants cannot exceed 50');
    }

    if (roomConfig.expiresAt && roomConfig.expiresAt <= new Date()) {
      errors.push('Room expiration time must be in the future');
    }

    if (roomConfig.password && roomConfig.password.length < 6) {
      errors.push('Room password must be at least 6 characters');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate JWT token for room access (if using Jitsi with JWT)
   * @param roomName - Room name
   * @param userInfo - User information for token
   * @returns JWT token string
   */
  public async generateAccessToken(
    roomName: string,
    userInfo: {
      id: string;
      name: string;
      email?: string;
      role: 'moderator' | 'participant';
    }
  ): Promise<TelehealthApiResponse<string>> {
    try {
      // This is a placeholder for JWT token generation
      // In a real implementation, you would:
      // 1. Use a JWT library like 'jsonwebtoken'
      // 2. Sign with your Jitsi JWT secret
      // 3. Include proper claims (room, user info, expiration)
      
      const jwtSecret = process.env.JITSI_JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT secret not configured');
      }

      // For now, return a placeholder token structure
      const tokenPayload = {
        iss: 'webqx-telehealth',
        aud: 'jitsi',
        sub: this.config.serverUrl,
        room: roomName,
        context: {
          user: {
            id: userInfo.id,
            name: userInfo.name,
            email: userInfo.email
          },
          features: {
            livestreaming: userInfo.role === 'moderator',
            recording: userInfo.role === 'moderator',
            'outbound-call': userInfo.role === 'moderator'
          }
        },
        moderator: userInfo.role === 'moderator',
        exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour expiration
      };

      // In real implementation, sign this payload with JWT
      const accessToken = `placeholder.${btoa(JSON.stringify(tokenPayload))}.signature`;

      return {
        success: true,
        data: accessToken,
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
          code: 'TOKEN_GENERATION_ERROR',
          message: 'Failed to generate access token',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        metadata: {
          requestId: uuid(),
          timestamp: new Date(),
          processingTimeMs: 0
        }
      };
    }
  }

  /**
   * Update room configuration
   * @param roomName - Room name to update
   * @param updates - Configuration updates
   * @returns Promise resolving to updated configuration
   */
  public async updateRoomConfig(
    roomName: string,
    updates: Partial<JitsiRoomConfig>
  ): Promise<TelehealthApiResponse<JitsiRoomConfig>> {
    try {
      // In a real implementation, this would update the room configuration
      // on the Jitsi server via API calls
      
      // For now, return success with merged configuration
      const updatedConfig: JitsiRoomConfig = {
        roomName,
        displayName: updates.displayName || `Room ${roomName}`,
        password: updates.password,
        maxParticipants: updates.maxParticipants || this.config.maxParticipants,
        enableRecording: updates.enableRecording || false,
        expiresAt: updates.expiresAt,
        options: {
          ...this.config.defaultRoomOptions,
          ...updates.options
        }
      };

      return {
        success: true,
        data: updatedConfig,
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
          code: 'ROOM_UPDATE_ERROR',
          message: 'Failed to update room configuration',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        metadata: {
          requestId: uuid(),
          timestamp: new Date(),
          processingTimeMs: 0
        }
      };
    }
  }

  /**
   * Delete/invalidate a room
   * @param roomName - Room name to delete
   * @returns Promise resolving to deletion result
   */
  public async deleteRoom(roomName: string): Promise<TelehealthApiResponse<boolean>> {
    try {
      // In a real implementation, this would delete the room on the Jitsi server
      // For now, return success
      
      return {
        success: true,
        data: true,
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
          code: 'ROOM_DELETION_ERROR',
          message: 'Failed to delete room',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        metadata: {
          requestId: uuid(),
          timestamp: new Date(),
          processingTimeMs: 0
        }
      };
    }
  }

  /**
   * Get current service configuration
   * @returns Current configuration
   */
  public getConfig(): Required<JitsiServiceConfig> {
    return { ...this.config };
  }

  /**
   * Update service configuration
   * @param newConfig - Configuration updates
   */
  public updateConfig(newConfig: Partial<JitsiServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Check if a room name is valid and secure
   * @param roomName - Room name to check
   * @returns Whether the room name is valid
   */
  public isValidRoomName(roomName: string): boolean {
    // Check if room name follows our secure format
    const roomNamePattern = /^webqx-[a-f0-9]{8}-[a-f0-9]{8}-[a-z0-9]{6,8}$/;
    return roomNamePattern.test(roomName);
  }

  /**
   * Extract patient ID from room name (if possible)
   * @param roomName - Room name to parse
   * @returns Patient ID if extractable, null otherwise
   */
  public extractPatientIdFromRoom(roomName: string): string | null {
    if (!this.isValidRoomName(roomName)) {
      return null;
    }

    // Extract the patient ID portion from the room name
    const match = roomName.match(/^webqx-([a-f0-9]{8})-/);
    return match ? match[1] : null;
  }
}

/**
 * Default JitsiService instance for easy importing
 */
export const jitsiService = new JitsiService();

/**
 * Convenience function for creating a room with minimal configuration
 * @param patientId - Patient UUID
 * @param displayName - Room display name
 * @returns Promise resolving to room configuration and links
 */
export async function createTelehealthRoom(
  patientId: string,
  displayName: string
): Promise<{
  roomConfig: JitsiRoomConfig | null;
  roomLinks: JitsiRoomLink | null;
  error?: string;
}> {
  try {
    const roomResult = await jitsiService.createRoom(patientId, displayName);
    if (!roomResult.success || !roomResult.data) {
      return {
        roomConfig: null,
        roomLinks: null,
        error: roomResult.error?.message || 'Failed to create room'
      };
    }

    const linksResult = await jitsiService.generateRoomLinks(roomResult.data);
    if (!linksResult.success || !linksResult.data) {
      return {
        roomConfig: roomResult.data,
        roomLinks: null,
        error: linksResult.error?.message || 'Failed to generate room links'
      };
    }

    return {
      roomConfig: roomResult.data,
      roomLinks: linksResult.data
    };
  } catch (error) {
    return {
      roomConfig: null,
      roomLinks: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export default jitsiService;