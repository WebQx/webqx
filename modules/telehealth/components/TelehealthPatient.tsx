import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { languageManager } from '../utils/i18n';

interface TelehealthPatientProps {
  sessionId: string;
  patientId?: string;
  language?: string;
  enableAutoTranslation?: boolean;
  onSessionEnd?: () => void;
}

interface PatientSessionState {
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'waiting' | 'disconnected' | 'error';
  providerJoined: boolean;
  transcriptionEnabled: boolean;
  liveTranscription: string;
  showTechnicalSupport: boolean;
}

/**
 * Telehealth Patient Interface Component
 * 
 * Patient-facing interface for telehealth sessions with accessibility features,
 * language support, and simplified controls.
 */
export const TelehealthPatient: React.FC<TelehealthPatientProps> = ({
  sessionId,
  patientId,
  language = 'en',
  enableAutoTranslation = false,
  onSessionEnd
}) => {
  const { t } = useTranslation();
  const [sessionState, setSessionState] = useState<PatientSessionState>({
    isConnected: false,
    connectionStatus: 'connecting',
    providerJoined: false,
    transcriptionEnabled: false,
    liveTranscription: '',
    showTechnicalSupport: false
  });

  const [currentLanguage, setCurrentLanguage] = useState(language);
  const [devicePermissions, setDevicePermissions] = useState({
    camera: false,
    microphone: false
  });
  const [accessibilitySettings, setAccessibilitySettings] = useState({
    captions: false,
    highContrast: false,
    largeText: false
  });

  useEffect(() => {
    initializeSession();
    checkDevicePermissions();
    
    // Auto-detect language if not specified
    if (enableAutoTranslation) {
      autoDetectLanguage();
    }

    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    // Handle language changes
    languageManager.changeLanguage(currentLanguage);
    
    // Apply accessibility settings to document
    applyAccessibilitySettings();
  }, [currentLanguage, accessibilitySettings]);

  const initializeSession = async () => {
    try {
      // Simulate connection to telehealth session
      setSessionState(prev => ({
        ...prev,
        connectionStatus: 'connecting'
      }));

      // Simulate connection delay
      setTimeout(() => {
        setSessionState(prev => ({
          ...prev,
          isConnected: true,
          connectionStatus: 'waiting' // Waiting for provider
        }));
      }, 2000);

      // Simulate provider joining
      setTimeout(() => {
        setSessionState(prev => ({
          ...prev,
          providerJoined: true,
          connectionStatus: 'connected'
        }));
      }, 5000);

    } catch (error) {
      console.error('[Telehealth Patient] Session initialization failed:', error);
      setSessionState(prev => ({
        ...prev,
        connectionStatus: 'error'
      }));
    }
  };

  const autoDetectLanguage = async () => {
    try {
      const detectedLanguage = await languageManager.autoDetectLanguage();
      setCurrentLanguage(detectedLanguage);
    } catch (error) {
      console.error('[Telehealth Patient] Language auto-detection failed:', error);
    }
  };

  const checkDevicePermissions = async () => {
    try {
      // Check camera permission
      const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setDevicePermissions(prev => ({ ...prev, camera: true }));
      cameraStream.getTracks().forEach(track => track.stop());

      // Check microphone permission
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setDevicePermissions(prev => ({ ...prev, microphone: true }));
      audioStream.getTracks().forEach(track => track.stop());

    } catch (error) {
      console.error('[Telehealth Patient] Device permission check failed:', error);
    }
  };

  const applyAccessibilitySettings = () => {
    const root = document.documentElement;
    
    if (accessibilitySettings.highContrast) {
      root.style.setProperty('--bg-color', '#000000');
      root.style.setProperty('--text-color', '#ffffff');
      root.style.setProperty('--border-color', '#ffffff');
    } else {
      root.style.removeProperty('--bg-color');
      root.style.removeProperty('--text-color');
      root.style.removeProperty('--border-color');
    }

    if (accessibilitySettings.largeText) {
      root.style.setProperty('--base-font-size', '1.2em');
    } else {
      root.style.removeProperty('--base-font-size');
    }
  };

  const cleanup = () => {
    // Cleanup resources when component unmounts
    console.log('[Telehealth Patient] Cleaning up session:', sessionId);
  };

  const handleToggleCaptions = () => {
    setAccessibilitySettings(prev => ({
      ...prev,
      captions: !prev.captions
    }));
    
    if (!accessibilitySettings.captions) {
      setSessionState(prev => ({
        ...prev,
        transcriptionEnabled: true
      }));
    }
  };

  const handleAccessibilityToggle = (setting: keyof typeof accessibilitySettings) => {
    setAccessibilitySettings(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }));
  };

  const getConnectionStatusMessage = () => {
    switch (sessionState.connectionStatus) {
      case 'connecting':
        return t('telehealth.status.connecting');
      case 'waiting':
        return t('telehealth.session.waiting');
      case 'connected':
        return t('telehealth.status.connected');
      case 'disconnected':
        return t('telehealth.status.disconnected');
      case 'error':
        return t('telehealth.status.error');
      default:
        return '';
    }
  };

  const getStatusColor = () => {
    switch (sessionState.connectionStatus) {
      case 'connected':
        return '#28a745';
      case 'connecting':
      case 'waiting':
        return '#ffc107';
      case 'disconnected':
      case 'error':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  return (
    <div 
      className="telehealth-patient-interface" 
      style={{ 
        padding: '20px', 
        maxWidth: '1000px', 
        margin: '0 auto',
        fontSize: accessibilitySettings.largeText ? '1.2em' : '1em',
        backgroundColor: accessibilitySettings.highContrast ? '#000000' : '#ffffff',
        color: accessibilitySettings.highContrast ? '#ffffff' : '#000000'
      }}
    >
      {/* Header */}
      <div className="patient-header" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px',
        padding: '15px',
        backgroundColor: accessibilitySettings.highContrast ? '#333333' : '#f8f9fa',
        borderRadius: '8px'
      }}>
        <h1>{t('telehealth.patient.title')}</h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {/* Language Selector */}
          <select 
            value={currentLanguage} 
            onChange={(e) => setCurrentLanguage(e.target.value)}
            style={{ 
              padding: '8px 12px', 
              borderRadius: '4px', 
              border: '1px solid #ccc',
              fontSize: '14px'
            }}
            aria-label={t('telehealth.language.select')}
          >
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
          </select>

          {/* Technical Support Button */}
          <button 
            onClick={() => setSessionState(prev => ({ 
              ...prev, 
              showTechnicalSupport: !prev.showTechnicalSupport 
            }))}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            📞 {t('telehealth.patient.technical')}
          </button>
        </div>
      </div>

      {/* Connection Status */}
      <div style={{
        backgroundColor: getStatusColor(),
        color: 'white',
        padding: '15px',
        borderRadius: '8px',
        marginBottom: '20px',
        textAlign: 'center',
        fontSize: '18px',
        fontWeight: 'bold'
      }}>
        {getConnectionStatusMessage()}
      </div>

      {/* Welcome Message */}
      {sessionState.connectionStatus === 'waiting' && (
        <div style={{
          backgroundColor: accessibilitySettings.highContrast ? '#333333' : '#e3f2fd',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          <h2>{t('telehealth.patient.welcome')}</h2>
          <p>{t('telehealth.patient.instructions')}</p>
        </div>
      )}

      {/* Main Content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '20px' }}>
        {/* Video Area */}
        <div className="video-section">
          <div style={{
            backgroundColor: '#000',
            borderRadius: '8px',
            minHeight: '400px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '18px',
            position: 'relative'
          }}>
            {/* Video placeholder */}
            <div style={{ textAlign: 'center' }}>
              📹 Video Conference
              {!devicePermissions.camera && (
                <div style={{ marginTop: '10px', fontSize: '14px', color: '#ffc107' }}>
                  ⚠️ Camera permission required
                </div>
              )}
            </div>

            {/* Live Captions */}
            {accessibilitySettings.captions && sessionState.transcriptionEnabled && (
              <div style={{
                position: 'absolute',
                bottom: '20px',
                left: '20px',
                right: '20px',
                backgroundColor: 'rgba(0,0,0,0.8)',
                color: 'white',
                padding: '10px',
                borderRadius: '4px',
                fontSize: '16px'
              }}>
                {sessionState.liveTranscription || t('telehealth.accessibility.transcription')}
              </div>
            )}
          </div>

          {/* Simple Controls for Patient */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '15px',
            marginTop: '15px'
          }}>
            <button 
              style={{
                padding: '12px 20px',
                backgroundColor: devicePermissions.microphone ? '#28a745' : '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
              aria-label={t('telehealth.video.microphone')}
            >
              🎤 {devicePermissions.microphone ? t('telehealth.video.unmute') : t('telehealth.video.mute')}
            </button>
            
            <button 
              style={{
                padding: '12px 20px',
                backgroundColor: devicePermissions.camera ? '#007bff' : '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
              aria-label={t('telehealth.video.camera')}
            >
              📹 {devicePermissions.camera ? t('telehealth.video.videoOn') : t('telehealth.video.videoOff')}
            </button>
          </div>
        </div>

        {/* Side Panel */}
        <div className="side-panel">
          {/* Accessibility Controls */}
          <div style={{
            backgroundColor: accessibilitySettings.highContrast ? '#333333' : '#f8f9fa',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '15px'
          }}>
            <h3>{t('telehealth.accessibility.captions')}</h3>
            
            <label style={{ display: 'block', marginBottom: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={accessibilitySettings.captions}
                onChange={handleToggleCaptions}
                style={{ marginRight: '8px' }}
              />
              {t('telehealth.accessibility.captions')}
            </label>

            <label style={{ display: 'block', marginBottom: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={accessibilitySettings.highContrast}
                onChange={() => handleAccessibilityToggle('highContrast')}
                style={{ marginRight: '8px' }}
              />
              {t('telehealth.accessibility.highContrast')}
            </label>

            <label style={{ display: 'block', marginBottom: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={accessibilitySettings.largeText}
                onChange={() => handleAccessibilityToggle('largeText')}
                style={{ marginRight: '8px' }}
              />
              {t('telehealth.accessibility.largeText')}
            </label>
          </div>

          {/* Session Info */}
          <div style={{
            backgroundColor: accessibilitySettings.highContrast ? '#333333' : '#f8f9fa',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '15px'
          }}>
            <h3>Session Information</h3>
            <p style={{ fontSize: '14px', margin: '5px 0' }}>
              <strong>Session ID:</strong> {sessionId.substring(0, 8)}...
            </p>
            {patientId && (
              <p style={{ fontSize: '14px', margin: '5px 0' }}>
                <strong>Patient ID:</strong> {patientId.substring(0, 8)}...
              </p>
            )}
            <p style={{ fontSize: '14px', margin: '5px 0' }}>
              <strong>Language:</strong> {currentLanguage.toUpperCase()}
            </p>
          </div>

          {/* Technical Support */}
          {sessionState.showTechnicalSupport && (
            <div style={{
              backgroundColor: accessibilitySettings.highContrast ? '#333333' : '#fff3cd',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '15px',
              border: '1px solid #ffeaa7'
            }}>
              <h3>Technical Support</h3>
              <p style={{ fontSize: '14px', marginBottom: '10px' }}>
                Need help with your session?
              </p>
              <button style={{
                width: '100%',
                padding: '8px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginBottom: '8px'
              }}>
                📞 Call Support
              </button>
              <button style={{
                width: '100%',
                padding: '8px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}>
                💬 Chat Support
              </button>
            </div>
          )}

          {/* Connection Quality */}
          <div style={{
            backgroundColor: accessibilitySettings.highContrast ? '#333333' : '#f8f9fa',
            padding: '15px',
            borderRadius: '8px'
          }}>
            <h3>Connection Quality</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '20px',
                height: '20px',
                backgroundColor: sessionState.isConnected ? '#28a745' : '#dc3545',
                borderRadius: '50%'
              }}></div>
              <span style={{ fontSize: '14px' }}>
                {sessionState.isConnected ? 'Good' : 'Poor'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer with Session End */}
      <div style={{
        marginTop: '30px',
        textAlign: 'center',
        padding: '20px',
        borderTop: `1px solid ${accessibilitySettings.highContrast ? '#666666' : '#e0e0e0'}`
      }}>
        <button 
          onClick={onSessionEnd}
          style={{
            padding: '12px 30px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        >
          {t('telehealth.session.end')}
        </button>
        <p style={{ 
          marginTop: '10px', 
          fontSize: '12px', 
          color: accessibilitySettings.highContrast ? '#cccccc' : '#666666' 
        }}>
          Session will end automatically when provider disconnects
        </p>
      </div>
    </div>
  );
};