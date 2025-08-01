import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AmbientDocumentationService } from '../services/AmbientDocumentationService';
import { TelehealthMessagingService } from '../services/TelehealthMessagingService';
import { languageManager } from '../utils/i18n';

interface TelehealthProviderProps {
  patientId: string;
  providerId: string;
  sessionId: string;
  enableTranscription?: boolean;
  language?: string;
  specialtyContext?: string;
  onSessionEnd?: () => void;
}

interface SessionState {
  isConnected: boolean;
  isTranscribing: boolean;
  transcriptionText: string;
  clinicalNote?: any;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
}

/**
 * Telehealth Provider Interface Component
 * 
 * Main provider interface for telehealth sessions with ambient documentation,
 * video controls, and clinical note management.
 */
export const TelehealthProvider: React.FC<TelehealthProviderProps> = ({
  patientId,
  providerId,
  sessionId,
  enableTranscription = true,
  language = 'en',
  specialtyContext = 'primary-care',
  onSessionEnd
}) => {
  const { t } = useTranslation();
  const [sessionState, setSessionState] = useState<SessionState>({
    isConnected: false,
    isTranscribing: false,
    transcriptionText: '',
    connectionStatus: 'connecting'
  });

  const [showClinicalNotes, setShowClinicalNotes] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(language);

  // Service instances
  const ambientDocsService = useRef(new AmbientDocumentationService());
  const messagingService = useRef(new TelehealthMessagingService());

  useEffect(() => {
    initializeSession();
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    // Handle language changes
    languageManager.changeLanguage(currentLanguage);
  }, [currentLanguage]);

  const initializeSession = async () => {
    try {
      // Initialize ambient documentation session
      const success = await ambientDocsService.current.startSession({
        sessionId,
        patientId,
        providerId,
        specialtyContext,
        language: currentLanguage,
        enableRealTime: enableTranscription
      });

      if (success) {
        setSessionState(prev => ({
          ...prev,
          connectionStatus: 'connected',
          isConnected: true,
          isTranscribing: enableTranscription
        }));
      } else {
        throw new Error('Failed to start ambient documentation session');
      }
    } catch (error) {
      console.error('[Telehealth Provider] Session initialization failed:', error);
      setSessionState(prev => ({
        ...prev,
        connectionStatus: 'error'
      }));
    }
  };

  const cleanup = async () => {
    await ambientDocsService.current.endSession(sessionId);
  };

  const handleToggleTranscription = async () => {
    const newTranscribing = !sessionState.isTranscribing;
    
    if (newTranscribing) {
      // Start transcription
      const success = await ambientDocsService.current.startSession({
        sessionId,
        patientId,
        providerId,
        specialtyContext,
        language: currentLanguage,
        enableRealTime: true
      });

      if (success) {
        setSessionState(prev => ({
          ...prev,
          isTranscribing: true
        }));
      }
    } else {
      // Stop transcription
      await ambientDocsService.current.endSession(sessionId);
      setSessionState(prev => ({
        ...prev,
        isTranscribing: false
      }));
    }
  };

  const handleAudioUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setAudioFile(file);
    setIsProcessing(true);

    try {
      const result = await ambientDocsService.current.processAudioFile(file, {
        sessionId,
        patientId,
        providerId,
        specialtyContext,
        language: currentLanguage
      });

      if (result.success) {
        setSessionState(prev => ({
          ...prev,
          transcriptionText: result.transcriptionText || '',
          clinicalNote: result.clinicalNote
        }));
      } else {
        alert(t('telehealth.documentation.error') + ': ' + result.error);
      }
    } catch (error) {
      console.error('[Telehealth Provider] Audio processing failed:', error);
      alert(t('telehealth.documentation.error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveClinicalNote = async () => {
    if (!sessionState.clinicalNote) return;

    try {
      // In a real implementation, this would save to the FHIR server
      console.log('[Telehealth Provider] Saving clinical note:', sessionState.clinicalNote);
      alert(t('telehealth.documentation.saved'));
    } catch (error) {
      console.error('[Telehealth Provider] Failed to save clinical note:', error);
      alert(t('telehealth.errors.saveFailed'));
    }
  };

  const handleSendPostVisitSummary = async () => {
    try {
      const summary = {
        sessionId,
        patientId,
        providerId,
        visitDate: new Date().toISOString(),
        summary: sessionState.transcriptionText || 'Telehealth consultation completed',
        language: currentLanguage
      };

      const result = await messagingService.current.sendPostVisitSummary(summary);
      
      if (result.success) {
        alert(t('telehealth.messaging.sendSummary') + ' - Success');
      } else {
        alert('Failed to send summary: ' + result.error);
      }
    } catch (error) {
      console.error('[Telehealth Provider] Failed to send post-visit summary:', error);
    }
  };

  const handleEndSession = async () => {
    await cleanup();
    onSessionEnd?.();
  };

  const getConnectionStatusIcon = () => {
    switch (sessionState.connectionStatus) {
      case 'connected':
        return '🟢';
      case 'connecting':
        return '🟡';
      case 'disconnected':
        return '🔴';
      case 'error':
        return '❌';
      default:
        return '⚪';
    }
  };

  return (
    <div className="telehealth-provider-interface" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div className="session-header" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px'
      }}>
        <h1>{t('telehealth.provider.title')}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {/* Language Selector */}
          <select 
            value={currentLanguage} 
            onChange={(e) => setCurrentLanguage(e.target.value)}
            style={{ padding: '5px 10px', borderRadius: '4px', border: '1px solid #ccc' }}
            aria-label={t('telehealth.language.select')}
          >
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
          </select>

          {/* Connection Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span>{getConnectionStatusIcon()}</span>
            <span>{t(`telehealth.status.${sessionState.connectionStatus}`)}</span>
          </div>

          {/* End Session Button */}
          <button 
            onClick={handleEndSession}
            style={{
              padding: '8px 16px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {t('telehealth.provider.endVisit')}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px' }}>
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
            fontSize: '18px'
          }}>
            {/* Placeholder for video component */}
            📹 {t('telehealth.video.camera')} - Video Conference Area
          </div>

          {/* Video Controls */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '10px',
            marginTop: '15px'
          }}>
            <button 
              style={{
                padding: '10px 15px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              🎤 {t('telehealth.video.mute')}
            </button>
            <button 
              style={{
                padding: '10px 15px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              📹 {t('telehealth.video.videoOn')}
            </button>
            <button 
              style={{
                padding: '10px 15px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              🖥️ {t('telehealth.video.screen')}
            </button>
          </div>
        </div>

        {/* Side Panel */}
        <div className="side-panel">
          {/* Patient Info */}
          <div style={{
            backgroundColor: '#f8f9fa',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '15px'
          }}>
            <h3>{t('telehealth.provider.patientInfo')}</h3>
            <p>Patient ID: {patientId}</p>
            <p>Session: {sessionId}</p>
          </div>

          {/* Ambient Documentation */}
          <div style={{
            backgroundColor: '#f8f9fa',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '15px'
          }}>
            <h3>{t('telehealth.documentation.title')}</h3>
            
            {/* Transcription Toggle */}
            <button
              onClick={handleToggleTranscription}
              style={{
                width: '100%',
                padding: '10px',
                marginBottom: '10px',
                backgroundColor: sessionState.isTranscribing ? '#dc3545' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
              aria-label={sessionState.isTranscribing ? t('telehealth.documentation.disable') : t('telehealth.documentation.enable')}
            >
              {sessionState.isTranscribing ? '⏹️' : '🎙️'} 
              {sessionState.isTranscribing ? t('telehealth.documentation.disable') : t('telehealth.documentation.enable')}
            </button>

            {sessionState.isTranscribing && (
              <div style={{
                padding: '10px',
                backgroundColor: '#fff3cd',
                borderRadius: '4px',
                marginBottom: '10px',
                fontSize: '14px'
              }}>
                🎙️ {t('telehealth.documentation.recording')}
              </div>
            )}

            {/* Audio Upload */}
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>
                Upload Audio File:
              </label>
              <input
                type="file"
                accept="audio/*"
                onChange={handleAudioUpload}
                disabled={isProcessing}
                style={{ width: '100%', padding: '5px' }}
              />
            </div>

            {isProcessing && (
              <div style={{
                padding: '10px',
                backgroundColor: '#d1ecf1',
                borderRadius: '4px',
                marginBottom: '10px',
                fontSize: '14px'
              }}>
                ⏳ {t('telehealth.documentation.processing')}
              </div>
            )}

            {/* Transcription Text */}
            {sessionState.transcriptionText && (
              <div>
                <textarea
                  value={sessionState.transcriptionText}
                  onChange={(e) => setSessionState(prev => ({
                    ...prev,
                    transcriptionText: e.target.value
                  }))}
                  style={{
                    width: '100%',
                    height: '150px',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    marginBottom: '10px',
                    fontSize: '14px'
                  }}
                  placeholder="Transcription will appear here..."
                />
                
                <button
                  onClick={handleSaveClinicalNote}
                  disabled={!sessionState.clinicalNote}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: sessionState.clinicalNote ? '#28a745' : '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: sessionState.clinicalNote ? 'pointer' : 'not-allowed'
                  }}
                >
                  💾 {t('telehealth.documentation.save')}
                </button>
              </div>
            )}
          </div>

          {/* Post-Visit Actions */}
          <div style={{
            backgroundColor: '#f8f9fa',
            padding: '15px',
            borderRadius: '8px'
          }}>
            <h3>{t('telehealth.messaging.postVisit')}</h3>
            <button
              onClick={handleSendPostVisitSummary}
              disabled={!sessionState.transcriptionText}
              style={{
                width: '100%',
                padding: '10px',
                marginBottom: '10px',
                backgroundColor: sessionState.transcriptionText ? '#007bff' : '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: sessionState.transcriptionText ? 'pointer' : 'not-allowed'
              }}
            >
              📧 {t('telehealth.messaging.sendSummary')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};