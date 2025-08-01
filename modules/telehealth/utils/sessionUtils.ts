/**
 * Telehealth Session Utilities
 * 
 * Utility functions for telehealth session management including
 * URL generation, token validation, and session state helpers.
 * 
 * @author WebQX Health  
 * @version 1.0.0
 */

import {
  TelehealthSession,
  TelehealthSessionStatus,
  SessionJoinValidation,
  VideoPlatform
} from '../types';

/**
 * Generate secure session access token
 */
export function generateSessionToken(
  sessionId: string,
  userId: string,
  userRole: 'patient' | 'provider',
  expirationMinutes: number = 60
): string {
  const payload = {
    sessionId,
    userId,
    userRole,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (expirationMinutes * 60)
  };
  
  // In production, this should use JWT with proper signing
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * Validate session access token
 */
export function validateSessionToken(token: string): {
  isValid: boolean;
  payload?: any;
  error?: string;
} {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    const now = Math.floor(Date.now() / 1000);
    
    if (!decoded.exp || decoded.exp < now) {
      return {
        isValid: false,
        error: 'Token expired'
      };
    }
    
    if (!decoded.sessionId || !decoded.userId || !decoded.userRole) {
      return {
        isValid: false,
        error: 'Invalid token format'
      };
    }
    
    return {
      isValid: true,
      payload: decoded
    };
  } catch (error) {
    return {
      isValid: false,
      error: 'Invalid token'
    };
  }
}

/**
 * Check if session can be joined at current time
 */
export function canJoinSession(session: TelehealthSession): SessionJoinValidation {
  const now = new Date();
  const sessionStart = new Date(session.scheduledDateTime);
  const sessionEnd = new Date(sessionStart.getTime() + session.durationMinutes * 60000);
  
  // Allow joining 15 minutes before session start
  const earlyJoinWindow = new Date(sessionStart.getTime() - 15 * 60000);
  
  // Allow joining up to 30 minutes after session end
  const lateJoinWindow = new Date(sessionEnd.getTime() + 30 * 60000);
  
  // Check if session is cancelled
  if (session.status === 'cancelled') {
    return {
      canJoin: false,
      reason: 'Session has been cancelled'
    };
  }
  
  // Check if session is completed
  if (session.status === 'completed') {
    return {
      canJoin: false,
      reason: 'Session has already been completed'
    };
  }
  
  // Check timing windows
  if (now < earlyJoinWindow) {
    return {
      canJoin: false,
      reason: 'Session is not yet available for joining',
      availableAt: earlyJoinWindow
    };
  }
  
  if (now > lateJoinWindow) {
    return {
      canJoin: false,
      reason: 'Session window has passed'
    };
  }
  
  // Check technical requirements
  return {
    canJoin: true,
    technicalRequirements: {
      browserSupported: checkBrowserSupport(),
      cameraAccess: true, // Would check actual permissions
      microphoneAccess: true, // Would check actual permissions
      internetConnection: true // Would check actual connection
    }
  };
}

/**
 * Get session status display text
 */
export function getSessionStatusText(status: TelehealthSessionStatus): string {
  const statusTexts: Record<TelehealthSessionStatus, string> = {
    scheduled: 'Scheduled',
    invitation_sent: 'Invitation Sent',
    ready_to_start: 'Ready to Start',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    no_show: 'No Show'
  };
  
  return statusTexts[status] || 'Unknown';
}

/**
 * Get session status CSS class for styling
 */
export function getSessionStatusClass(status: TelehealthSessionStatus): string {
  const statusClasses: Record<TelehealthSessionStatus, string> = {
    scheduled: 'status-scheduled',
    invitation_sent: 'status-pending',
    ready_to_start: 'status-ready',
    in_progress: 'status-active',
    completed: 'status-completed',
    cancelled: 'status-cancelled',
    no_show: 'status-cancelled'
  };
  
  return statusClasses[status] || 'status-unknown';
}

/**
 * Generate platform-specific join URL
 */
export function generatePlatformJoinUrl(
  session: TelehealthSession,
  userRole: 'patient' | 'provider',
  accessToken: string
): string {
  const baseUrl = session.platform.joinUrl || `/telehealth/session/${session.id}`;
  
  switch (session.platform.type) {
    case 'webrtc_native':
      return `${baseUrl}?role=${userRole}&token=${accessToken}`;
      
    case 'zoom':
      return session.platform.joinUrl || `https://zoom.us/j/${session.platform.meetingId}`;
      
    case 'teams':
      return session.platform.joinUrl || `https://teams.microsoft.com/l/meetup-join/${session.platform.meetingId}`;
      
    case 'webex':
      return session.platform.joinUrl || `https://webex.com/join/${session.platform.meetingId}`;
      
    default:
      return `${baseUrl}?role=${userRole}&token=${accessToken}`;
  }
}

/**
 * Format session duration for display
 */
export function formatSessionDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  
  return `${hours} hour${hours !== 1 ? 's' : ''} ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
}

/**
 * Format session date and time for display
 */
export function formatSessionDateTime(date: Date, includeTime: boolean = true): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  
  if (includeTime) {
    options.hour = 'numeric';
    options.minute = '2-digit';
    options.timeZoneName = 'short';
  }
  
  return date.toLocaleString('en-US', options);
}

/**
 * Calculate time until session starts
 */
export function getTimeUntilSession(sessionDateTime: Date): {
  isPast: boolean;
  timeText: string;
  minutes: number;
} {
  const now = new Date();
  const diffMs = sessionDateTime.getTime() - now.getTime();
  const minutes = Math.floor(diffMs / 60000);
  
  if (minutes < 0) {
    const pastMinutes = Math.abs(minutes);
    if (pastMinutes < 60) {
      return {
        isPast: true,
        timeText: `${pastMinutes} minute${pastMinutes !== 1 ? 's' : ''} ago`,
        minutes: pastMinutes
      };
    } else {
      const hours = Math.floor(pastMinutes / 60);
      return {
        isPast: true,
        timeText: `${hours} hour${hours !== 1 ? 's' : ''} ago`,
        minutes: pastMinutes
      };
    }
  }
  
  if (minutes < 60) {
    return {
      isPast: false,
      timeText: `in ${minutes} minute${minutes !== 1 ? 's' : ''}`,
      minutes
    };
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return {
      isPast: false,
      timeText: `in ${hours} hour${hours !== 1 ? 's' : ''}`,
      minutes
    };
  }
  
  return {
    isPast: false,
    timeText: `in ${hours} hour${hours !== 1 ? 's' : ''} ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`,
    minutes
  };
}

/**
 * Check if session is starting soon (within 15 minutes)
 */
export function isSessionStartingSoon(sessionDateTime: Date): boolean {
  const timeUntil = getTimeUntilSession(sessionDateTime);
  return !timeUntil.isPast && timeUntil.minutes <= 15;
}

/**
 * Check if session can be cancelled
 */
export function canCancelSession(session: TelehealthSession): boolean {
  const now = new Date();
  const sessionStart = new Date(session.scheduledDateTime);
  const minCancellationTime = new Date(sessionStart.getTime() - 24 * 60 * 60000); // 24 hours before
  
  // Cannot cancel if session is already in progress or completed
  if (['in_progress', 'completed', 'cancelled'].includes(session.status)) {
    return false;
  }
  
  // Cannot cancel if within 24 hours of session (configurable)
  if (now > minCancellationTime) {
    return false;
  }
  
  return true;
}

/**
 * Check if session can be rescheduled
 */
export function canRescheduleSession(session: TelehealthSession): boolean {
  // Similar rules to cancellation but might have different timing requirements
  return canCancelSession(session);
}

/**
 * Generate session invitation text for sharing
 */
export function generateSessionInvitationText(session: TelehealthSession): string {
  return `
You have a telehealth appointment scheduled:

📅 ${formatSessionDateTime(session.scheduledDateTime)}
👨‍⚕️ Provider: ${session.provider.name}
⏱️ Duration: ${formatSessionDuration(session.durationMinutes)}

Join your session: ${session.accessUrls.patient}

Please join a few minutes before your appointment time.
  `.trim();
}

/**
 * Validate session configuration
 */
export function validateSessionConfig(session: Partial<TelehealthSession>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!session.patient?.id) {
    errors.push('Patient information is required');
  }
  
  if (!session.provider?.id) {
    errors.push('Provider information is required');
  }
  
  if (!session.scheduledDateTime) {
    errors.push('Scheduled date and time is required');
  } else {
    const sessionDate = new Date(session.scheduledDateTime);
    if (sessionDate <= new Date()) {
      errors.push('Session must be scheduled in the future');
    }
  }
  
  if (!session.durationMinutes || session.durationMinutes <= 0) {
    errors.push('Valid session duration is required');
  } else if (session.durationMinutes > 240) { // 4 hours max
    errors.push('Session duration cannot exceed 4 hours');
  }
  
  if (!session.platform?.type) {
    errors.push('Video platform configuration is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get recommended session reminder times
 */
export function getRecommendedReminderTimes(sessionDateTime: Date): Date[] {
  const reminders: Date[] = [];
  
  // 24 hours before
  reminders.push(new Date(sessionDateTime.getTime() - 24 * 60 * 60000));
  
  // 1 hour before
  reminders.push(new Date(sessionDateTime.getTime() - 60 * 60000));
  
  // 15 minutes before
  reminders.push(new Date(sessionDateTime.getTime() - 15 * 60000));
  
  return reminders.filter(reminderTime => reminderTime > new Date());
}

/**
 * Check browser support for WebRTC
 */
function checkBrowserSupport(): boolean {
  // Check for WebRTC support
  const hasWebRTC = !!(
    (window as any).RTCPeerConnection ||
    (window as any).webkitRTCPeerConnection ||
    (window as any).mozRTCPeerConnection
  );
  
  // Check for getUserMedia support
  const hasGetUserMedia = !!(
    navigator.mediaDevices?.getUserMedia ||
    (navigator as any).getUserMedia ||
    (navigator as any).webkitGetUserMedia ||
    (navigator as any).mozGetUserMedia
  );
  
  return hasWebRTC && hasGetUserMedia;
}

/**
 * Extract session ID from various URL formats
 */
export function extractSessionIdFromUrl(url: string): string | null {
  const patterns = [
    /\/telehealth\/session\/([a-f0-9-]+)/i,
    /\/telehealth\/invitation\/([a-f0-9-]+)/i,
    /sessionId=([a-f0-9-]+)/i,
    /\/sessions\/([a-f0-9-]+)/i
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Sanitize session notes and comments
 */
export function sanitizeSessionText(text: string): string {
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: links
    .trim()
    .substring(0, 1000); // Limit length
}