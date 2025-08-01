/**
 * UI Components for Telehealth Session Module
 * Note: These are basic component interfaces. In a real implementation,
 * these would be full React/Vue/Angular components.
 */

export interface SessionControlsProps {
  sessionId: string;
  participantId: string;
  permissions: import('../types').ParticipantPermissions;
  onMute: (muted: boolean) => void;
  onVideo: (enabled: boolean) => void;
  onScreenShare: (enabled: boolean) => void;
  onRecord: (enabled: boolean) => void;
  onEndSession: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
}

export interface ParticipantListProps {
  participants: import('../types').SessionParticipant[];
  currentParticipantId: string;
  onMuteParticipant: (participantId: string, muted: boolean) => void;
  onRemoveParticipant: (participantId: string) => void;
  onInviteParticipant: () => void;
}

export interface VideoGridProps {
  participants: import('../types').SessionParticipant[];
  localStream: MediaStream | null;
  screenShareStream: MediaStream | null;
  isMinimized: boolean;
}

export interface InvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (email: string, name: string, role: import('../types').SessionParticipant['role'], message?: string) => void;
}

export interface SessionStatusProps {
  status: import('../types').SessionState['status'];
  duration: number;
  participantCount: number;
  isRecording: boolean;
  hasScreenShare: boolean;
}

// Component placeholder implementations
export const SessionControls = 'SessionControls';
export const ParticipantList = 'ParticipantList';
export const VideoGrid = 'VideoGrid';
export const InvitationModal = 'InvitationModal';
export const SessionStatus = 'SessionStatus';