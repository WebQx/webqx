/**
 * @fileoverview Telehealth Session Manager Component
 * 
 * React component for managing telehealth sessions with FHIR integration,
 * Comlink and Jitsi support, and comprehensive accessibility features.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Component props interface
 */
interface TelehealthSessionManagerProps {
  /** Current user ID */
  userId: string;
  /** User type (patient or provider) */
  userType: 'patient' | 'provider';
  /** FHIR server base URL */
  fhirServerUrl?: string;
  /** Authentication token for FHIR requests */
  authToken?: string;
  /** Default appointment ID (for direct session launch) */
  appointmentId?: string;
  /** Callback when session is started */
  onSessionStarted?: (session: TelehealthSession) => void;
  /** Callback when session ends */
  onSessionEnded?: (sessionId: string) => void;
  /** Callback for errors */
  onError?: (error: { code: string; message: string }) => void;
  /** Custom CSS class */
  className?: string;
  /** Enable accessibility features */
  enableAccessibility?: boolean;
}

/**
 * Telehealth session interface
 */
interface TelehealthSession {
  id: string;
  patientId: string;
  providerId: string;
  status: 'scheduled' | 'active' | 'ended' | 'cancelled' | 'failed';
  provider: 'comlink' | 'jitsi';
  startTime?: string;
  endTime?: string;
  appointmentId?: string;
  encounterId?: string;
  joinUrl?: string;
  metadata?: {
    appointmentType?: string;
    specialty?: string;
    recording?: boolean;
  };
}

/**
 * Provider information interface
 */
interface TelehealthProvider {
  name: string;
  display: string;
  available: boolean;
  features?: string[];
  error?: string;
}

/**
 * Session launch form data interface
 */
interface SessionLaunchForm {
  patientId: string;
  providerId: string;
  sessionType: 'consultation' | 'follow-up' | 'emergency' | 'second-opinion';
  specialty: string;
  preferredProvider: 'comlink' | 'jitsi' | 'auto';
  enableRecording: boolean;
  enableCaptions: boolean;
  audioOnly: boolean;
  maxDuration: number;
}

/**
 * TelehealthSessionManager component
 */
const TelehealthSessionManager: React.FC<TelehealthSessionManagerProps> = ({
  userId,
  userType,
  fhirServerUrl = '/fhir',
  authToken,
  appointmentId,
  onSessionStarted,
  onSessionEnded,
  onError,
  className = '',
  enableAccessibility = true
}) => {
  // State management
  const [sessions, setSessions] = useState<TelehealthSession[]>([]);
  const [providers, setProviders] = useState<TelehealthProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLaunchForm, setShowLaunchForm] = useState(false);
  const [joiningSessions, setJoiningSessions] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState<SessionLaunchForm>({
    patientId: userType === 'patient' ? userId : '',
    providerId: userType === 'provider' ? userId : '',
    sessionType: 'consultation',
    specialty: '',
    preferredProvider: 'auto',
    enableRecording: false,
    enableCaptions: enableAccessibility,
    audioOnly: false,
    maxDuration: 60
  });

  // Refs for accessibility
  const announceRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  /**
   * Make FHIR API request
   */
  const makeFHIRRequest = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const url = `${fhirServerUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/fhir+json',
      'Accept': 'application/fhir+json',
      ...options.headers as Record<string, string>
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.issue?.[0]?.details?.text || `HTTP ${response.status}`);
    }

    return response.json();
  }, [fhirServerUrl, authToken]);

  /**
   * Announce message for screen readers
   */
  const announceToScreenReader = useCallback((message: string) => {
    if (enableAccessibility && announceRef.current) {
      announceRef.current.textContent = message;
      // Clear after a delay to allow re-announcing the same message
      setTimeout(() => {
        if (announceRef.current) {
          announceRef.current.textContent = '';
        }
      }, 1000);
    }
  }, [enableAccessibility]);

  /**
   * Load active sessions
   */
  const loadActiveSessions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await makeFHIRRequest(`/telehealth/sessions?userId=${userId}&userType=${userType}`);
      
      if (response.resourceType === 'Bundle') {
        const sessionData = response.entry?.map((entry: any) => {
          const params = entry.resource.parameter || [];
          const session: Partial<TelehealthSession> = {};
          
          params.forEach((param: any) => {
            switch (param.name) {
              case 'sessionId':
                session.id = param.valueString;
                break;
              case 'status':
                session.status = param.valueString;
                break;
              case 'provider':
                session.provider = param.valueString;
                break;
              case 'patientId':
                session.patientId = param.valueString;
                break;
              case 'providerId':
                session.providerId = param.valueString;
                break;
              case 'startTime':
                session.startTime = param.valueDateTime;
                break;
              case 'appointmentId':
                session.appointmentId = param.valueString;
                break;
              case 'encounterId':
                session.encounterId = param.valueString;
                break;
            }
          });
          
          return session as TelehealthSession;
        }) || [];
        
        setSessions(sessionData);
        announceToScreenReader(`Loaded ${sessionData.length} active sessions`);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
      onError?.({ code: 'LOAD_SESSIONS_FAILED', message: (error as Error).message });
    } finally {
      setLoading(false);
    }
  }, [userId, userType, makeFHIRRequest, announceToScreenReader, onError]);

  /**
   * Load available providers
   */
  const loadProviders = useCallback(async () => {
    try {
      const response = await makeFHIRRequest('/telehealth/providers');
      
      if (response.resourceType === 'Parameters') {
        const providersParam = response.parameter?.find((p: any) => p.name === 'providers');
        if (providersParam?.part) {
          const providerData = providersParam.part.map((provider: any) => {
            const providerInfo: Partial<TelehealthProvider> = { name: provider.name };
            
            provider.part?.forEach((param: any) => {
              switch (param.name) {
                case 'display':
                  providerInfo.display = param.valueString;
                  break;
                case 'available':
                  providerInfo.available = param.valueBoolean;
                  break;
                case 'features':
                  providerInfo.features = param.valueString?.split(',') || [];
                  break;
                case 'error':
                  providerInfo.error = param.valueString;
                  break;
              }
            });
            
            return providerInfo as TelehealthProvider;
          });
          
          setProviders(providerData);
        }
      }
    } catch (error) {
      console.error('Failed to load providers:', error);
      // Continue without provider info - not critical
    }
  }, [makeFHIRRequest]);

  /**
   * Launch new session
   */
  const launchSession = useCallback(async () => {
    try {
      setLoading(true);
      announceToScreenReader('Launching telehealth session...');

      const sessionRequest = {
        patientId: formData.patientId,
        providerId: formData.providerId,
        appointmentId,
        sessionType: formData.sessionType,
        specialty: formData.specialty || undefined,
        preferredProvider: formData.preferredProvider,
        options: {
          enableRecording: formData.enableRecording,
          enableCaptions: formData.enableCaptions,
          audioOnly: formData.audioOnly,
          maxDuration: formData.maxDuration * 60000 // Convert to milliseconds
        }
      };

      const response = await makeFHIRRequest('/telehealth/sessions', {
        method: 'POST',
        body: JSON.stringify(sessionRequest)
      });

      if (response.resourceType === 'Parameters') {
        const params = response.parameter || [];
        const sessionData: Partial<TelehealthSession> = {};
        let joinUrl = '';

        params.forEach((param: any) => {
          switch (param.name) {
            case 'sessionId':
              sessionData.id = param.valueString;
              break;
            case 'joinUrl':
              joinUrl = param.valueUrl;
              sessionData.joinUrl = param.valueUrl;
              break;
            case 'provider':
              sessionData.provider = param.valueString;
              break;
            case 'status':
              sessionData.status = param.valueString;
              break;
            case 'appointmentId':
              sessionData.appointmentId = param.valueString;
              break;
            case 'encounterId':
              sessionData.encounterId = param.valueString;
              break;
          }
        });

        const newSession: TelehealthSession = {
          ...sessionData,
          patientId: formData.patientId,
          providerId: formData.providerId,
          startTime: new Date().toISOString(),
          metadata: {
            appointmentType: formData.sessionType,
            specialty: formData.specialty,
            recording: formData.enableRecording
          }
        } as TelehealthSession;

        setSessions(prev => [...prev, newSession]);
        setShowLaunchForm(false);
        onSessionStarted?.(newSession);
        
        announceToScreenReader(`Session launched successfully using ${sessionData.provider}. Redirecting to video call...`);

        // Open video session in new window/tab
        if (joinUrl) {
          window.open(joinUrl, '_blank', 'noopener,noreferrer');
        }
      }
    } catch (error) {
      console.error('Failed to launch session:', error);
      announceToScreenReader('Failed to launch session');
      onError?.({ code: 'LAUNCH_FAILED', message: (error as Error).message });
    } finally {
      setLoading(false);
    }
  }, [formData, appointmentId, makeFHIRRequest, announceToScreenReader, onSessionStarted, onError]);

  /**
   * Join existing session
   */
  const joinSession = useCallback(async (sessionId: string) => {
    try {
      setJoiningSessions(prev => new Set(prev).add(sessionId));
      announceToScreenReader('Joining telehealth session...');

      const response = await makeFHIRRequest(`/telehealth/sessions/${sessionId}/join`, {
        method: 'POST',
        body: JSON.stringify({ userType })
      });

      if (response.resourceType === 'Parameters') {
        const joinUrlParam = response.parameter?.find((p: any) => p.name === 'joinUrl');
        if (joinUrlParam?.valueUrl) {
          announceToScreenReader('Redirecting to video call...');
          window.open(joinUrlParam.valueUrl, '_blank', 'noopener,noreferrer');
        }
      }
    } catch (error) {
      console.error('Failed to join session:', error);
      announceToScreenReader('Failed to join session');
      onError?.({ code: 'JOIN_FAILED', message: (error as Error).message });
    } finally {
      setJoiningSessions(prev => {
        const newSet = new Set(prev);
        newSet.delete(sessionId);
        return newSet;
      });
    }
  }, [userType, makeFHIRRequest, announceToScreenReader, onError]);

  /**
   * End session
   */
  const endSession = useCallback(async (sessionId: string) => {
    try {
      announceToScreenReader('Ending telehealth session...');

      await makeFHIRRequest(`/telehealth/sessions/${sessionId}`, {
        method: 'DELETE'
      });

      setSessions(prev => prev.filter(s => s.id !== sessionId));
      onSessionEnded?.(sessionId);
      announceToScreenReader('Session ended successfully');
    } catch (error) {
      console.error('Failed to end session:', error);
      announceToScreenReader('Failed to end session');
      onError?.({ code: 'END_FAILED', message: (error as Error).message });
    }
  }, [makeFHIRRequest, announceToScreenReader, onSessionEnded, onError]);

  /**
   * Handle form input changes
   */
  const handleFormChange = useCallback((field: keyof SessionLaunchForm, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (enableAccessibility) {
      if (event.key === 'Escape' && showLaunchForm) {
        setShowLaunchForm(false);
        announceToScreenReader('Session launch form closed');
      }
    }
  }, [enableAccessibility, showLaunchForm, announceToScreenReader]);

  // Load data on mount
  useEffect(() => {
    loadActiveSessions();
    loadProviders();
  }, [loadActiveSessions, loadProviders]);

  // Focus management for accessibility
  useEffect(() => {
    if (showLaunchForm && modalRef.current && enableAccessibility) {
      modalRef.current.focus();
    }
  }, [showLaunchForm, enableAccessibility]);

  return (
    <div className={`telehealth-session-manager ${className}`} onKeyDown={handleKeyDown}>
      {/* Screen reader announcements */}
      {enableAccessibility && (
        <div
          ref={announceRef}
          className="sr-only"
          aria-live="polite"
          aria-atomic="true"
        />
      )}

      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Telehealth Sessions
        </h2>
        <p className="text-gray-600">
          Manage your virtual healthcare appointments with integrated video conferencing
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-4 mb-6">
        {userType === 'provider' && (
          <button
            onClick={() => setShowLaunchForm(true)}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            aria-describedby="launch-session-help"
          >
            Launch New Session
          </button>
        )}
        
        <button
          onClick={loadActiveSessions}
          disabled={loading}
          className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {userType === 'provider' && (
        <p id="launch-session-help" className="text-sm text-gray-500 mb-4">
          Launch a new telehealth session to start a video consultation with a patient
        </p>
      )}

      {/* Active sessions list */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Active Sessions ({sessions.length})
        </h3>
        
        {sessions.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            No active sessions found
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-semibold text-gray-900">
                    Session {session.id.split('-').pop()}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {userType === 'patient' ? 'Provider' : 'Patient'}: {
                      userType === 'patient' ? session.providerId : session.patientId
                    }
                  </p>
                  {session.metadata?.specialty && (
                    <p className="text-sm text-gray-600">
                      Specialty: {session.metadata.specialty}
                    </p>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    session.status === 'active' ? 'bg-green-100 text-green-800' :
                    session.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {session.status}
                  </span>
                  
                  <span className="text-xs text-gray-500">
                    {session.provider === 'comlink' ? 'Comlink' : 'Jitsi'}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                {session.status === 'active' && (
                  <button
                    onClick={() => joinSession(session.id)}
                    disabled={joiningSessions.has(session.id)}
                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                  >
                    {joiningSessions.has(session.id) ? 'Joining...' : 'Join Session'}
                  </button>
                )}
                
                {userType === 'provider' && session.status === 'active' && (
                  <button
                    onClick={() => endSession(session.id)}
                    className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    End Session
                  </button>
                )}
              </div>

              {session.startTime && (
                <p className="text-xs text-gray-500 mt-2">
                  Started: {new Date(session.startTime).toLocaleString()}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Session launch modal */}
      {showLaunchForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            ref={modalRef}
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto"
            tabIndex={-1}
            role="dialog"
            aria-labelledby="launch-session-title"
          >
            <h3 id="launch-session-title" className="text-lg font-semibold mb-4">
              Launch New Telehealth Session
            </h3>

            <form onSubmit={(e) => { e.preventDefault(); launchSession(); }}>
              <div className="space-y-4">
                {userType === 'provider' && (
                  <div>
                    <label htmlFor="patient-id" className="block text-sm font-medium text-gray-700 mb-1">
                      Patient ID *
                    </label>
                    <input
                      id="patient-id"
                      type="text"
                      value={formData.patientId}
                      onChange={(e) => handleFormChange('patientId', e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {userType === 'patient' && (
                  <div>
                    <label htmlFor="provider-id" className="block text-sm font-medium text-gray-700 mb-1">
                      Provider ID *
                    </label>
                    <input
                      id="provider-id"
                      type="text"
                      value={formData.providerId}
                      onChange={(e) => handleFormChange('providerId', e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="session-type" className="block text-sm font-medium text-gray-700 mb-1">
                    Session Type
                  </label>
                  <select
                    id="session-type"
                    value={formData.sessionType}
                    onChange={(e) => handleFormChange('sessionType', e.target.value as SessionLaunchForm['sessionType'])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="consultation">Consultation</option>
                    <option value="follow-up">Follow-up</option>
                    <option value="emergency">Emergency</option>
                    <option value="second-opinion">Second Opinion</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="specialty" className="block text-sm font-medium text-gray-700 mb-1">
                    Specialty
                  </label>
                  <input
                    id="specialty"
                    type="text"
                    value={formData.specialty}
                    onChange={(e) => handleFormChange('specialty', e.target.value)}
                    placeholder="e.g., Cardiology, Primary Care"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="preferred-provider" className="block text-sm font-medium text-gray-700 mb-1">
                    Video Platform
                  </label>
                  <select
                    id="preferred-provider"
                    value={formData.preferredProvider}
                    onChange={(e) => handleFormChange('preferredProvider', e.target.value as SessionLaunchForm['preferredProvider'])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="auto">Auto (Best Available)</option>
                    <option value="comlink">Comlink (Premium)</option>
                    <option value="jitsi">Jitsi (Open Source)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="max-duration" className="block text-sm font-medium text-gray-700 mb-1">
                      Max Duration (minutes)
                    </label>
                    <input
                      id="max-duration"
                      type="number"
                      min="15"
                      max="480"
                      value={formData.maxDuration}
                      onChange={(e) => handleFormChange('maxDuration', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.enableRecording}
                      onChange={(e) => handleFormChange('enableRecording', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Enable Recording</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.enableCaptions}
                      onChange={(e) => handleFormChange('enableCaptions', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Enable Captions</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.audioOnly}
                      onChange={(e) => handleFormChange('audioOnly', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Audio Only</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loading ? 'Launching...' : 'Launch Session'}
                </button>
                
                <button
                  type="button"
                  onClick={() => setShowLaunchForm(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Provider status */}
      {providers.length > 0 && (
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Available Video Platforms</h4>
          <div className="space-y-1">
            {providers.map((provider) => (
              <div key={provider.name} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{provider.display}</span>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  provider.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {provider.available ? 'Available' : (provider.error || 'Unavailable')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TelehealthSessionManager;