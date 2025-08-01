import React, { useState, useEffect } from 'react';

/**
 * Enhanced Appointment Card with Telehealth Integration
 * 
 * This component extends the existing appointment card to include
 * telehealth session management capabilities for patients.
 */

interface TelehealthSession {
  sessionId: string;
  status: 'scheduled' | 'invitation_sent' | 'ready_to_start' | 'in_progress' | 'completed' | 'cancelled';
  joinUrl?: string;
  canJoin: boolean;
  joinAvailableAt?: Date;
  sessionNotes?: string;
  platform: 'webrtc_native' | 'zoom' | 'teams' | 'webex';
}

interface AppointmentCardProps {
  /** Appointment title */
  title: string;
  /** Appointment date and time */
  datetime: string;
  /** Provider information */
  provider: string;
  /** Appointment details */
  details: string;
  /** Additional CSS classes */
  className?: string;
  /** Telehealth session information (if applicable) */
  telehealthSession?: TelehealthSession;
  /** Callback when joining telehealth session */
  onJoinSession?: (sessionId: string) => void;
  /** Callback when testing connection */
  onTestConnection?: () => void;
}

/**
 * Enhanced Appointment Card Component with Telehealth Support
 */
const AppointmentCard: React.FC<AppointmentCardProps> = ({
  title,
  datetime,
  provider,
  details,
  className = '',
  telehealthSession,
  onJoinSession,
  onTestConnection
}) => {
  const [timeUntilSession, setTimeUntilSession] = useState<string>('');
  const [canJoinNow, setCanJoinNow] = useState<boolean>(false);

  // Update countdown timer for telehealth sessions
  useEffect(() => {
    if (!telehealthSession?.joinAvailableAt) return;

    const updateTimer = () => {
      const now = new Date();
      const joinTime = new Date(telehealthSession.joinAvailableAt!);
      const diffMs = joinTime.getTime() - now.getTime();

      if (diffMs <= 0) {
        setTimeUntilSession('Available now');
        setCanJoinNow(true);
      } else {
        const minutes = Math.floor(diffMs / 60000);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
          setTimeUntilSession(`Available in ${hours}h ${minutes % 60}m`);
        } else {
          setTimeUntilSession(`Available in ${minutes}m`);
        }
        setCanJoinNow(false);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [telehealthSession?.joinAvailableAt]);

  const handleJoinSession = () => {
    if (telehealthSession && onJoinSession) {
      onJoinSession(telehealthSession.sessionId);
    }
  };

  const getSessionStatusText = (status: TelehealthSession['status']): string => {
    const statusTexts = {
      scheduled: 'Scheduled',
      invitation_sent: 'Invitation Sent',
      ready_to_start: 'Ready to Start',
      in_progress: 'In Progress',
      completed: 'Completed',
      cancelled: 'Cancelled'
    };
    return statusTexts[status] || 'Unknown';
  };

  const getSessionStatusClass = (status: TelehealthSession['status']): string => {
    const statusClasses = {
      scheduled: 'bg-blue-100 text-blue-800',
      invitation_sent: 'bg-yellow-100 text-yellow-800',
      ready_to_start: 'bg-green-100 text-green-800',
      in_progress: 'bg-orange-100 text-orange-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return statusClasses[status] || 'bg-gray-100 text-gray-800';
  };

  const getPlatformIcon = (platform: TelehealthSession['platform']): string => {
    const platformIcons = {
      webrtc_native: '🎥',
      zoom: '📹',
      teams: '💼',
      webex: '🌐'
    };
    return platformIcons[platform] || '🎥';
  };

  const isUpcoming = () => {
    const appointmentDate = new Date(datetime);
    const now = new Date();
    return appointmentDate > now;
  };

  return (
    <div 
      className={`appointment-card bg-white rounded-lg shadow-md p-6 transition-all duration-200 hover:shadow-lg ${className}`}
      role="listitem"
    >
      {/* Main Appointment Information */}
      <div className="mb-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          {telehealthSession && (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSessionStatusClass(telehealthSession.status)}`}>
              {getPlatformIcon(telehealthSession.platform)} {getSessionStatusText(telehealthSession.status)}
            </span>
          )}
        </div>
        
        <div className="space-y-1 text-sm text-gray-600">
          <p className="flex items-center">
            <span className="mr-2">📅</span>
            {datetime}
          </p>
          <p className="flex items-center">
            <span className="mr-2">👨‍⚕️</span>
            {provider}
          </p>
          {details && (
            <p className="flex items-center">
              <span className="mr-2">📋</span>
              {details}
            </p>
          )}
        </div>
      </div>

      {/* Telehealth Session Section */}
      {telehealthSession && (
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-800 flex items-center">
              🎥 Telehealth Session
            </h4>
          </div>

          {/* Session Status and Controls */}
          <div className="space-y-3">
            {/* Join Session Button */}
            {telehealthSession.canJoin && (canJoinNow || telehealthSession.status === 'ready_to_start') && (
              <button
                onClick={handleJoinSession}
                className="w-full px-4 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center"
                aria-label={`Join telehealth session for ${title}`}
              >
                🎥 Join Session Now
              </button>
            )}

            {/* Session Not Ready */}
            {telehealthSession.canJoin && !canJoinNow && telehealthSession.status !== 'ready_to_start' && isUpcoming() && (
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-800 mb-1">Session will be available soon</p>
                <p className="text-xs text-blue-600">{timeUntilSession}</p>
              </div>
            )}

            {/* Session Completed */}
            {telehealthSession.status === 'completed' && (
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-800">Session completed</p>
                {telehealthSession.sessionNotes && (
                  <p className="text-xs text-gray-600 mt-1">{telehealthSession.sessionNotes}</p>
                )}
              </div>
            )}

            {/* Session Cancelled */}
            {telehealthSession.status === 'cancelled' && (
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <p className="text-sm font-medium text-red-800">Session cancelled</p>
                <p className="text-xs text-red-600">Please contact your provider to reschedule</p>
              </div>
            )}

            {/* Invitation Sent */}
            {telehealthSession.status === 'invitation_sent' && (
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <p className="text-sm font-medium text-yellow-800">Invitation sent to your email</p>
                <p className="text-xs text-yellow-600">Check your email for session details</p>
              </div>
            )}

            {/* Technical Preparation */}
            {isUpcoming() && telehealthSession.status !== 'cancelled' && (
              <div className="border-t pt-3">
                <h5 className="text-sm font-medium text-gray-700 mb-2">📋 Before your session:</h5>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• Test your camera and microphone</li>
                  <li>• Ensure stable internet connection</li>
                  <li>• Find a quiet, private space</li>
                  <li>• Have your insurance card ready</li>
                </ul>
                
                {onTestConnection && (
                  <button
                    onClick={onTestConnection}
                    className="mt-2 w-full px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50 transition-colors"
                    aria-label="Test your camera and microphone"
                  >
                    🔧 Test Camera & Microphone
                  </button>
                )}
              </div>
            )}

            {/* Platform Information */}
            <div className="text-xs text-gray-500 text-center">
              Platform: {telehealthSession.platform === 'webrtc_native' ? 'WebQX Built-in Video' : 
                        telehealthSession.platform === 'zoom' ? 'Zoom' :
                        telehealthSession.platform === 'teams' ? 'Microsoft Teams' :
                        telehealthSession.platform === 'webex' ? 'Cisco Webex' : 'Unknown'}
            </div>
          </div>
        </div>
      )}

      {/* Regular Appointment Actions (for non-telehealth) */}
      {!telehealthSession && isUpcoming() && (
        <div className="border-t pt-4">
          <div className="flex space-x-2">
            <button className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors text-sm">
              📅 Reschedule
            </button>
            <button className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors text-sm">
              ❌ Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentCard;