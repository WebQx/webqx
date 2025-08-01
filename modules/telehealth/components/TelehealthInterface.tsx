import React, { useState, useEffect, useCallback } from 'react';
import { TelehealthSession, TelehealthSessionStatus, JitsiRoomLink } from '../types';
import { telehealthService } from '../services/telehealthService';
import { jitsiService } from '../services/jitsiService';

/**
 * Props for TelehealthInterface component
 */
export interface TelehealthInterfaceProps {
  /** Current session */
  session: TelehealthSession;
  /** Current user ID */
  userId: string;
  /** Current user role */
  userRole: 'patient' | 'provider' | 'caregiver';
  /** Current user name */
  userName: string;
  /** Callback for session status changes */
  onSessionStatusChange?: (status: TelehealthSessionStatus) => void;
  /** Callback for session end */
  onSessionEnd?: (session: TelehealthSession) => void;
  /** Callback for errors */
  onError?: (error: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * TelehealthInterface component provides the main telehealth session interface
 */
export const TelehealthInterface: React.FC<TelehealthInterfaceProps> = ({
  session,
  userId,
  userRole,
  userName,
  onSessionStatusChange,
  onSessionEnd,
  onError,
  className = ''
}) => {
  const [roomLinks, setRoomLinks] = useState<JitsiRoomLink | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState(session.participants);
  const [sessionStatus, setSessionStatus] = useState(session.status);

  /**
   * Generate room links on component mount
   */
  useEffect(() => {
    const generateLinks = async () => {
      try {
        setIsLoading(true);
        const result = await jitsiService.generateRoomLinks(session.jitsiRoom);
        
        if (result.success && result.data) {
          setRoomLinks(result.data);
        } else {
          const errorMsg = result.error?.message || 'Failed to generate room links';
          setError(errorMsg);
          onError?.(errorMsg);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        onError?.(errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    generateLinks();
  }, [session.jitsiRoom, onError]);

  /**
   * Join session handler
   */
  const handleJoinSession = useCallback(async () => {
    try {
      // Add current user as participant
      const participantResult = await telehealthService.addParticipant(session.id, {
        type: userRole,
        name: userName,
        email: '' // Would typically come from user profile
      });

      if (participantResult.success && participantResult.data) {
        setParticipants(participantResult.data.participants);
        
        // Update session status to in_progress if not already
        if (sessionStatus === 'scheduled' || sessionStatus === 'waiting_room') {
          const statusResult = await telehealthService.updateSessionStatus(
            session.id,
            'in_progress'
          );
          
          if (statusResult.success) {
            setSessionStatus('in_progress');
            onSessionStatusChange?.('in_progress');
          }
        }

        // Open Jitsi room in new window/tab
        if (roomLinks?.webLink) {
          window.open(roomLinks.webLink, '_blank', 'width=1200,height=800');
        }
      } else {
        const errorMsg = participantResult.error?.message || 'Failed to join session';
        setError(errorMsg);
        onError?.(errorMsg);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error joining session';
      setError(errorMsg);
      onError?.(errorMsg);
    }
  }, [session.id, userRole, userName, sessionStatus, roomLinks, onSessionStatusChange, onError]);

  /**
   * End session handler
   */
  const handleEndSession = useCallback(async () => {
    try {
      // Remove current user as participant
      const currentParticipant = participants.find(p => p.name === userName);
      if (currentParticipant) {
        await telehealthService.removeParticipant(session.id, currentParticipant.id);
      }

      // Update session status to completed if provider
      if (userRole === 'provider') {
        const statusResult = await telehealthService.updateSessionStatus(
          session.id,
          'completed'
        );
        
        if (statusResult.success && statusResult.data) {
          setSessionStatus('completed');
          onSessionEnd?.(statusResult.data);
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error ending session';
      setError(errorMsg);
      onError?.(errorMsg);
    }
  }, [session.id, participants, userName, userRole, onSessionEnd, onError]);

  /**
   * Copy room link to clipboard
   */
  const handleCopyLink = useCallback(() => {
    if (roomLinks?.webLink) {
      navigator.clipboard.writeText(roomLinks.webLink).then(() => {
        alert('Room link copied to clipboard!');
      }).catch(() => {
        alert('Failed to copy link to clipboard');
      });
    }
  }, [roomLinks]);

  if (isLoading) {
    return (
      <div className={`telehealth-interface loading ${className}`}>
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Setting up your telehealth session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`telehealth-interface error ${className}`}>
        <div className="error-container">
          <h2>⚠️ Session Error</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`telehealth-interface ${className}`}>
      {/* Session Header */}
      <header className="session-header">
        <h1>🏥 Telehealth Session</h1>
        <div className="session-info">
          <div className="session-details">
            <p><strong>Session ID:</strong> {session.id.slice(0, 8)}</p>
            <p><strong>Status:</strong> 
              <span className={`status ${sessionStatus}`}>
                {sessionStatus.replace('_', ' ').toUpperCase()}
              </span>
            </p>
            <p><strong>Scheduled:</strong> {session.scheduledStartTime.toLocaleString()}</p>
            {session.chiefComplaint && (
              <p><strong>Chief Complaint:</strong> {session.chiefComplaint}</p>
            )}
          </div>
          <div className="participant-count">
            <span className="count">{participants.length}</span>
            <span className="label">Participant{participants.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </header>

      {/* Room Information */}
      <section className="room-info">
        <h2>📹 Video Conference Room</h2>
        <div className="room-details">
          <p><strong>Room:</strong> {session.jitsiRoom.displayName}</p>
          {session.jitsiRoom.password && (
            <p><strong>Password:</strong> 
              <code className="room-password">{session.jitsiRoom.password}</code>
            </p>
          )}
          {roomLinks && (
            <div className="room-links">
              <button 
                className="join-button primary"
                onClick={handleJoinSession}
                disabled={sessionStatus === 'completed' || sessionStatus === 'cancelled'}
              >
                🎥 Join Video Call
              </button>
              <button 
                className="copy-link-button secondary"
                onClick={handleCopyLink}
              >
                📋 Copy Link
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Participants */}
      <section className="participants">
        <h3>👥 Participants</h3>
        <div className="participant-list">
          {participants.length === 0 ? (
            <p className="no-participants">No participants have joined yet.</p>
          ) : (
            participants.map((participant) => (
              <div key={participant.id} className="participant-card">
                <div className="participant-info">
                  <span className="participant-name">{participant.name}</span>
                  <span className={`participant-type ${participant.type}`}>
                    {participant.type}
                  </span>
                </div>
                <div className="participant-status">
                  {participant.joinedAt && !participant.leftAt && (
                    <span className="status-indicator online">🟢 Online</span>
                  )}
                  {participant.leftAt && (
                    <span className="status-indicator offline">🔴 Left</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Session Controls */}
      <section className="session-controls">
        <div className="control-buttons">
          {userRole === 'provider' && sessionStatus === 'in_progress' && (
            <button 
              className="end-session-button danger"
              onClick={handleEndSession}
            >
              ⏹️ End Session
            </button>
          )}
          
          {sessionStatus === 'in_progress' && (
            <button 
              className="leave-session-button warning"
              onClick={handleEndSession}
            >
              🚪 Leave Session
            </button>
          )}
        </div>
      </section>

      {/* Session Notes */}
      {session.notes && (
        <section className="session-notes">
          <h3>📝 Session Notes</h3>
          <div className="notes-content">
            <p>{session.notes}</p>
          </div>
        </section>
      )}

      {/* Technical Information */}
      <details className="technical-info">
        <summary>🔧 Technical Information</summary>
        <div className="tech-details">
          <p><strong>Room Name:</strong> {session.jitsiRoom.roomName}</p>
          <p><strong>Server:</strong> {jitsiService.getConfig().serverUrl}</p>
          {roomLinks && (
            <>
              <p><strong>Web Link:</strong> 
                <code className="tech-link">{roomLinks.webLink}</code>
              </p>
              {roomLinks.mobileLink && (
                <p><strong>Mobile Link:</strong> 
                  <code className="tech-link">{roomLinks.mobileLink}</code>
                </p>
              )}
            </>
          )}
        </div>
      </details>

      {/* Styles */}
      <style jsx>{`
        .telehealth-interface {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .loading-container, .error-container {
          text-align: center;
          padding: 40px;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #007bff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .session-header {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .session-header h1 {
          margin: 0 0 15px 0;
          color: #333;
        }

        .session-info {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .participant-count {
          text-align: center;
          background: #007bff;
          color: white;
          padding: 10px;
          border-radius: 50px;
          min-width: 80px;
        }

        .participant-count .count {
          display: block;
          font-size: 24px;
          font-weight: bold;
        }

        .participant-count .label {
          font-size: 12px;
        }

        .status {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
        }

        .status.scheduled { background: #ffc107; color: #000; }
        .status.in_progress { background: #28a745; color: white; }
        .status.completed { background: #6c757d; color: white; }
        .status.cancelled { background: #dc3545; color: white; }

        .room-info, .participants, .session-controls, .session-notes {
          background: white;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .room-info h2, .participants h3, .session-notes h3 {
          margin: 0 0 15px 0;
          color: #333;
        }

        .room-password {
          background: #f8f9fa;
          padding: 4px 8px;
          border-radius: 4px;
          font-family: monospace;
          margin-left: 10px;
        }

        .room-links {
          margin-top: 15px;
        }

        .join-button, .copy-link-button, .end-session-button, .leave-session-button {
          padding: 12px 24px;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          margin-right: 10px;
          margin-bottom: 10px;
        }

        .join-button.primary {
          background: #28a745;
          color: white;
        }

        .copy-link-button.secondary {
          background: #6c757d;
          color: white;
        }

        .end-session-button.danger {
          background: #dc3545;
          color: white;
        }

        .leave-session-button.warning {
          background: #ffc107;
          color: #000;
        }

        .join-button:hover, .copy-link-button:hover, .end-session-button:hover, .leave-session-button:hover {
          opacity: 0.9;
        }

        .join-button:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }

        .participant-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px;
          border: 1px solid #dee2e6;
          border-radius: 6px;
          margin-bottom: 10px;
        }

        .participant-type {
          background: #e9ecef;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 12px;
          margin-left: 10px;
        }

        .participant-type.provider { background: #d4edda; }
        .participant-type.patient { background: #cce5ff; }

        .status-indicator {
          font-size: 14px;
        }

        .technical-info {
          margin-top: 20px;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          padding: 15px;
        }

        .technical-info summary {
          cursor: pointer;
          font-weight: bold;
          margin-bottom: 10px;
        }

        .tech-link {
          background: #f8f9fa;
          padding: 2px 4px;
          border-radius: 3px;
          font-family: monospace;
          font-size: 12px;
          word-break: break-all;
        }

        .no-participants {
          color: #6c757d;
          font-style: italic;
        }

        .error-container {
          color: #dc3545;
        }

        .error-container button {
          background: #007bff;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
          margin-top: 15px;
        }
      `}</style>
    </div>
  );
};

export default TelehealthInterface;