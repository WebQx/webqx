/**
 * WebQx EMR Jitsi Meet Integration Component
 * React component for embedding Jitsi Meet in telehealth sessions
 * with OpenEMR integration and HIPAA compliance
 */

import React, { useEffect, useRef, useState } from 'react';

/**
 * JitsiMeet React Component for WebQx EMR
 * @param {Object} props - Component props
 * @param {Object} props.sessionConfig - Telehealth session configuration
 * @param {Function} props.onSessionStart - Callback when session starts
 * @param {Function} props.onSessionEnd - Callback when session ends
 * @param {Function} props.onError - Callback for errors
 * @param {string} props.className - CSS class name
 */
export const WebQxJitsiMeet = ({
    sessionConfig,
    onSessionStart,
    onSessionEnd,
    onError,
    className = 'webqx-jitsi-meet'
}) => {
    const meetingRef = useRef(null);
    const apiRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);
    const [meetingState, setMeetingState] = useState('initializing');

    useEffect(() => {
        if (sessionConfig && meetingRef.current) {
            initializeJitsiMeet();
        }

        return () => {
            if (apiRef.current) {
                apiRef.current.dispose();
            }
        };
    }, [sessionConfig]);

    /**
     * Initialize Jitsi Meet with WebQx EMR configuration
     */
    const initializeJitsiMeet = async () => {
        try {
            setIsLoading(true);
            setMeetingState('initializing');

            // Load Jitsi Meet API if not already loaded
            if (!window.JitsiMeetExternalAPI) {
                await loadJitsiMeetAPI();
            }

            // Configure meeting for healthcare use
            const meetingConfig = {
                roomName: sessionConfig.roomName,
                width: '100%',
                height: '100%',
                parentNode: meetingRef.current,
                
                // HIPAA-compliant configuration
                configOverwrite: {
                    // Security settings
                    requireDisplayName: true,
                    enableE2EE: true,
                    disableThirdPartyRequests: true,
                    
                    // Audio/Video optimization for healthcare
                    resolution: 720,
                    constraints: {
                        video: {
                            height: { ideal: 720, max: 1080, min: 480 },
                            facingMode: 'user'
                        },
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true
                        }
                    },
                    
                    // Healthcare-specific features
                    disableChat: sessionConfig.sessionType === 'telepsychiatry' ? true : false,
                    disableFilmstrip: false,
                    disableInviteFunctions: true,
                    enableLobby: true,
                    
                    // Branding for WebQx EMR
                    defaultRemoteDisplayName: getDefaultDisplayName('provider'),
                    defaultLocalDisplayName: getDefaultDisplayName('patient'),
                    
                    // Recording settings (if enabled)
                    localRecording: {
                        enabled: sessionConfig.features?.includes('recording') || false,
                        format: 'flac'
                    }
                },
                
                // Interface customization for healthcare
                interfaceConfigOverwrite: {
                    TOOLBAR_BUTTONS: getHealthcareToolbarButtons(),
                    SETTINGS_SECTIONS: ['devices', 'language'],
                    SHOW_JITSI_WATERMARK: false,
                    SHOW_WATERMARK_FOR_GUESTS: false,
                    SHOW_BRAND_WATERMARK: true,
                    BRAND_WATERMARK_LINK: sessionConfig.returnUrl || '/',
                    
                    // WebQx EMR branding
                    APP_NAME: 'WebQx EMR Telehealth',
                    NATIVE_APP_NAME: 'WebQx EMR',
                    
                    // Healthcare UI preferences
                    DEFAULT_BACKGROUND: '#f8f9fa',
                    DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
                    HIDE_INVITE_MORE_HEADER: true,
                    
                    // Custom buttons for healthcare workflow
                    TOOLBAR_TIMEOUT: 600000, // 10 minutes - longer for healthcare
                    INITIAL_TOOLBAR_TIMEOUT: 20000 // 20 seconds
                }
            };

            // Add JWT token if available
            if (sessionConfig.jwt) {
                meetingConfig.jwt = sessionConfig.jwt;
            }

            // Initialize Jitsi Meet API
            apiRef.current = new window.JitsiMeetExternalAPI(
                sessionConfig.domain || 'meet.jitsi.webqx.health',
                meetingConfig
            );

            // Setup event handlers for EMR integration
            setupEventHandlers();

            setIsLoading(false);
            setMeetingState('ready');

        } catch (error) {
            console.error('Failed to initialize Jitsi Meet:', error);
            setIsLoading(false);
            setMeetingState('error');
            onError?.(error);
        }
    };

    /**
     * Load Jitsi Meet External API script
     */
    const loadJitsiMeetAPI = () => {
        return new Promise((resolve, reject) => {
            if (window.JitsiMeetExternalAPI) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = `https://${sessionConfig.domain || 'meet.jitsi.webqx.health'}/external_api.js`;
            script.async = true;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    };

    /**
     * Setup event handlers for EMR integration
     */
    const setupEventHandlers = () => {
        if (!apiRef.current) return;

        // Session lifecycle events
        apiRef.current.addEventListener('videoConferenceJoined', (event) => {
            console.log('WebQx EMR: Telehealth session joined', event);
            setMeetingState('active');
            onSessionStart?.(event);
            
            // Log to EMR encounter
            logToEMREncounter('session_joined', {
                displayName: event.displayName,
                roomName: event.roomName,
                timestamp: new Date().toISOString()
            });
        });

        apiRef.current.addEventListener('videoConferenceLeft', (event) => {
            console.log('WebQx EMR: Telehealth session ended', event);
            setMeetingState('ended');
            onSessionEnd?.(event);
            
            // Log to EMR encounter
            logToEMREncounter('session_ended', {
                roomName: event.roomName,
                timestamp: new Date().toISOString()
            });
        });

        // Participant events for audit logging
        apiRef.current.addEventListener('participantJoined', (event) => {
            logToEMREncounter('participant_joined', {
                participantId: event.id,
                displayName: event.displayName,
                timestamp: new Date().toISOString()
            });
        });

        apiRef.current.addEventListener('participantLeft', (event) => {
            logToEMREncounter('participant_left', {
                participantId: event.id,
                displayName: event.displayName,
                timestamp: new Date().toISOString()
            });
        });

        // Recording events for compliance
        apiRef.current.addEventListener('recordingStatusChanged', (event) => {
            logToEMREncounter('recording_' + event.status, {
                recordingStatus: event.status,
                timestamp: new Date().toISOString()
            });
        });

        // Error handling
        apiRef.current.addEventListener('errorOccurred', (event) => {
            console.error('WebQx EMR: Jitsi Meet error', event);
            onError?.(event.error);
            
            logToEMREncounter('meeting_error', {
                errorType: event.error?.name || 'unknown',
                errorMessage: event.error?.message || 'Unknown error',
                timestamp: new Date().toISOString()
            });
        });

        // Custom EMR integration events
        setupEMRIntegrationEvents();
    };

    /**
     * Setup EMR-specific integration events
     */
    const setupEMRIntegrationEvents = () => {
        // Custom command handlers for EMR integration
        apiRef.current.addEventListener('customCommand', (event) => {
            switch (event.command) {
                case 'updateEncounter':
                    updateEMREncounter(event.data);
                    break;
                case 'saveNotes':
                    saveSessionNotes(event.data);
                    break;
                case 'endSession':
                    endSessionAndReturnToEMR();
                    break;
            }
        });
    };

    /**
     * Get default display name based on role
     */
    const getDefaultDisplayName = (role) => {
        switch (role) {
            case 'provider':
                return sessionConfig.providerName || 'Healthcare Provider';
            case 'patient':
                return sessionConfig.patientName || 'Patient';
            default:
                return 'Participant';
        }
    };

    /**
     * Get healthcare-optimized toolbar buttons
     */
    const getHealthcareToolbarButtons = () => {
        const buttons = ['microphone', 'camera', 'chat', 'hangup'];
        
        if (sessionConfig.features?.includes('recording')) {
            buttons.splice(-1, 0, 'recording');
        }
        
        if (sessionConfig.features?.includes('screenshare') && 
            sessionConfig.sessionType !== 'telepsychiatry') {
            buttons.splice(-1, 0, 'desktop');
        }
        
        if (sessionConfig.features?.includes('whiteboard')) {
            buttons.splice(-1, 0, 'whiteboard');
        }
        
        return buttons;
    };

    /**
     * Log events to EMR encounter
     */
    const logToEMREncounter = async (eventType, eventData) => {
        try {
            // This would integrate with OpenEMR's API
            const logEntry = {
                encounter_id: sessionConfig.encounterId,
                event_type: eventType,
                event_data: eventData,
                session_id: sessionConfig.sessionId,
                timestamp: new Date().toISOString(),
                hipaa_audit: true
            };

            console.log('EMR Audit Log:', logEntry);
            
            // Send to EMR audit system
            if (sessionConfig.emrApiEndpoint) {
                await fetch(`${sessionConfig.emrApiEndpoint}/audit/telehealth`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${sessionConfig.emrToken}`
                    },
                    body: JSON.stringify(logEntry)
                });
            }
        } catch (error) {
            console.error('Failed to log to EMR encounter:', error);
        }
    };

    /**
     * Update EMR encounter with session data
     */
    const updateEMREncounter = async (data) => {
        try {
            const updateData = {
                encounter_id: sessionConfig.encounterId,
                telehealth_session_id: sessionConfig.sessionId,
                session_duration: data.duration,
                session_notes: data.notes,
                participants: data.participants,
                updated_at: new Date().toISOString()
            };

            if (sessionConfig.emrApiEndpoint) {
                await fetch(`${sessionConfig.emrApiEndpoint}/encounter/update`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${sessionConfig.emrToken}`
                    },
                    body: JSON.stringify(updateData)
                });
            }
        } catch (error) {
            console.error('Failed to update EMR encounter:', error);
        }
    };

    /**
     * Save session notes to EMR
     */
    const saveSessionNotes = async (notes) => {
        try {
            const noteData = {
                encounter_id: sessionConfig.encounterId,
                note_type: 'telehealth_session',
                content: notes,
                created_by: sessionConfig.providerId,
                created_at: new Date().toISOString()
            };

            if (sessionConfig.emrApiEndpoint) {
                await fetch(`${sessionConfig.emrApiEndpoint}/notes/create`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${sessionConfig.emrToken}`
                    },
                    body: JSON.stringify(noteData)
                });
            }
        } catch (error) {
            console.error('Failed to save session notes to EMR:', error);
        }
    };

    /**
     * End session and return to EMR
     */
    const endSessionAndReturnToEMR = () => {
        if (apiRef.current) {
            apiRef.current.executeCommand('hangup');
        }
        
        // Return to EMR encounter page
        if (sessionConfig.returnUrl) {
            window.location.href = sessionConfig.returnUrl;
        }
    };

    // Render loading state
    if (isLoading) {
        return (
            <div className={`${className} ${className}--loading`}>
                <div className="webqx-telehealth-loader">
                    <div className="loader-spinner"></div>
                    <h3>Initializing Secure Telehealth Session...</h3>
                    <p>Please wait while we prepare your HIPAA-compliant video conference.</p>
                    <div className="security-indicators">
                        <span className="indicator">🔒 End-to-End Encrypted</span>
                        <span className="indicator">🏥 HIPAA Compliant</span>
                        <span className="indicator">📋 EMR Integrated</span>
                    </div>
                </div>
            </div>
        );
    }

    // Render error state
    if (meetingState === 'error') {
        return (
            <div className={`${className} ${className}--error`}>
                <div className="webqx-telehealth-error">
                    <h3>Unable to Start Telehealth Session</h3>
                    <p>We encountered an issue while setting up your video conference. Please try again or contact support.</p>
                    <button onClick={initializeJitsiMeet} className="retry-button">
                        Retry Connection
                    </button>
                    <button onClick={endSessionAndReturnToEMR} className="return-button">
                        Return to EMR
                    </button>
                </div>
            </div>
        );
    }

    // Render Jitsi Meet container
    return (
        <div className={`${className} ${className}--${meetingState}`}>
            <div className="webqx-telehealth-header">
                <div className="session-info">
                    <span className="session-type">
                        {sessionConfig.sessionType === 'telepsychiatry' ? 
                            'Telepsychiatry Session' : 'Telehealth Consultation'}
                    </span>
                    <span className="encounter-id">Encounter: {sessionConfig.encounterId}</span>
                </div>
                <div className="security-status">
                    <span className="encrypted-badge">🔒 Encrypted</span>
                    <span className="hipaa-badge">HIPAA Compliant</span>
                </div>
            </div>
            
            <div 
                ref={meetingRef} 
                className="jitsi-meet-container"
                style={{ width: '100%', height: 'calc(100% - 60px)' }}
            />
            
            <div className="webqx-telehealth-footer">
                <div className="emr-integration-status">
                    <span>Connected to WebQx EMR</span>
                </div>
            </div>
        </div>
    );
};

export default WebQxJitsiMeet;