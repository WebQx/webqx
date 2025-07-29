/**
 * @fileoverview Patient Portal DICOM Viewer
 * 
 * Simplified DICOM viewer for patients with basic viewing functionality
 * and read-only metadata access. No measurement or annotation tools.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import DicomViewer from './DicomViewer';
import MetadataDisplay from './MetadataDisplay';
import { ViewerConfig, ViewerState, DicomImage } from './types';

interface PatientViewerProps {
  studyInstanceUID: string;
  seriesInstanceUID?: string;
  onViewComplete?: () => void;
  className?: string;
}

const PATIENT_VIEWER_CONFIG: ViewerConfig = {
  enableZoom: true,
  enablePan: true,
  enableRotate: true,
  enableBrightnessContrast: false, // Simplified for patients
  enableMeasurements: false,       // Disabled for patients
  enableAnnotations: false,        // Disabled for patients
  enableCine: true,
  enableFullscreen: true,
  enableMetadataDisplay: true,
  enableWindowLevel: false,        // Simplified for patients
  readOnly: true,
};

export const PatientViewer: React.FC<PatientViewerProps> = ({
  studyInstanceUID,
  seriesInstanceUID,
  onViewComplete,
  className = '',
}) => {
  const { t } = useTranslation();
  
  const [viewerState, setViewerState] = useState<ViewerState>({
    zoom: 1.0,
    pan: { x: 0, y: 0 },
    rotation: 0,
    brightness: 0,
    contrast: 0,
    windowCenter: 128,
    windowWidth: 256,
    isPlaying: false,
    currentImageIndex: 0,
  });

  const [currentImage, setCurrentImage] = useState<DicomImage | null>(null);
  const [showMetadata, setShowMetadata] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewStartTime] = useState(new Date());

  /**
   * Handle image load
   */
  const handleImageLoad = useCallback((image: DicomImage) => {
    setCurrentImage(image);
  }, []);

  /**
   * Handle viewer state changes
   */
  const handleStateChange = useCallback((newState: ViewerState) => {
    setViewerState(newState);
  }, []);

  /**
   * Handle view reset
   */
  const handleReset = useCallback(() => {
    setViewerState(prev => ({
      ...prev,
      zoom: 1.0,
      pan: { x: 0, y: 0 },
      rotation: 0,
      brightness: 0,
      contrast: 0,
    }));
  }, []);

  /**
   * Handle fullscreen toggle
   */
  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  /**
   * Handle error cases
   */
  const handleError = useCallback((error: Error) => {
    console.error('Patient viewer error:', error);
    // Could notify parent component or show user-friendly error
  }, []);

  /**
   * Track viewing session completion
   */
  const handleViewingComplete = useCallback(() => {
    const viewDuration = Date.now() - viewStartTime.getTime();
    
    // Log viewing session
    fetch('/api/imaging/viewing-session', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        studyInstanceUID,
        seriesInstanceUID,
        viewDuration,
        timestamp: new Date().toISOString(),
      }),
    }).catch(console.error);

    onViewComplete?.();
  }, [studyInstanceUID, seriesInstanceUID, viewStartTime, onViewComplete]);

  return (
    <div className={`patient-viewer ${isFullscreen ? 'fullscreen' : ''} ${className}`}>
      {/* Viewer Header */}
      <div className="viewer-header">
        <div className="header-left">
          <h2>{t('imaging.patient_viewer')}</h2>
          {currentImage && (
            <div className="study-info">
              <span className="study-date">
                {new Date(currentImage.metadata.studyDate).toLocaleDateString()}
              </span>
              <span className="study-type">
                {currentImage.metadata.modality} - {currentImage.metadata.studyDescription}
              </span>
            </div>
          )}
        </div>
        
        <div className="header-right">
          <button 
            onClick={() => setShowMetadata(!showMetadata)}
            className={`toggle-button ${showMetadata ? 'active' : ''}`}
            title={t('imaging.toggle_metadata')}
          >
            ℹ️ {t('imaging.info')}
          </button>
          
          <button 
            onClick={handleViewingComplete}
            className="done-button"
            title={t('imaging.done_viewing')}
          >
            ✓ {t('common.done')}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="viewer-content">
        {/* Center Panel - Viewer */}
        <div className={`viewer-panel ${showMetadata ? 'with-metadata' : 'full-width'}`}>
          <DicomViewer
            studyInstanceUID={studyInstanceUID}
            seriesInstanceUID={seriesInstanceUID}
            config={PATIENT_VIEWER_CONFIG}
            onImageLoad={handleImageLoad}
            onError={handleError}
            onStateChange={handleStateChange}
            className="patient-dicom-viewer"
          />

          {/* Simple Controls Overlay */}
          <div className="simple-controls">
            <div className="control-group zoom-controls">
              <button 
                onClick={() => setViewerState(prev => ({ ...prev, zoom: Math.min(5.0, prev.zoom * 1.25) }))}
                title={t('imaging.zoom_in')}
                className="control-btn"
              >
                🔍+
              </button>
              
              <span className="zoom-display">
                {Math.round(viewerState.zoom * 100)}%
              </span>
              
              <button 
                onClick={() => setViewerState(prev => ({ ...prev, zoom: Math.max(0.1, prev.zoom * 0.8) }))}
                title={t('imaging.zoom_out')}
                className="control-btn"
              >
                🔍-
              </button>
            </div>

            <div className="control-group rotation-controls">
              <button 
                onClick={() => setViewerState(prev => ({ ...prev, rotation: (prev.rotation - 90 + 360) % 360 }))}
                title={t('imaging.rotate_left')}
                className="control-btn"
              >
                ↺
              </button>
              
              <button 
                onClick={() => setViewerState(prev => ({ ...prev, rotation: (prev.rotation + 90) % 360 }))}
                title={t('imaging.rotate_right')}
                className="control-btn"
              >
                ↻
              </button>
            </div>

            <div className="control-group general-controls">
              <button 
                onClick={handleReset}
                title={t('imaging.reset_view')}
                className="control-btn"
              >
                🔄
              </button>
              
              <button 
                onClick={handleFullscreen}
                title={t('imaging.fullscreen')}
                className="control-btn"
              >
                ⛶
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel - Metadata (when shown) */}
        {showMetadata && currentImage && (
          <div className="metadata-panel">
            <MetadataDisplay
              metadata={currentImage.metadata}
              readOnly={true}
              className="patient-metadata"
            />
            
            {/* Patient-specific disclaimers */}
            <div className="patient-disclaimers">
              <div className="disclaimer-section">
                <h4>{t('imaging.important_notice')}</h4>
                <p>{t('imaging.patient_viewer_disclaimer')}</p>
              </div>
              
              <div className="disclaimer-section">
                <h4>{t('imaging.questions')}</h4>
                <p>{t('imaging.contact_provider_message')}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Patient-friendly Status Bar */}
      <div className="viewer-status-bar">
        <div className="status-left">
          <span className="viewing-info">
            {t('imaging.viewing_study')}: {currentImage?.metadata.studyDescription}
          </span>
        </div>
        
        <div className="status-right">
          <span className="help-text">
            💡 {t('imaging.patient_help_text')}
          </span>
        </div>
      </div>

      {/* Patient Help Modal (if needed) */}
      <div className="patient-help-info">
        <div className="help-content">
          <h3>{t('imaging.how_to_use')}</h3>
          <ul>
            <li>🔍 {t('imaging.help_zoom')}</li>
            <li>🖱️ {t('imaging.help_pan')}</li>
            <li>↻ {t('imaging.help_rotate')}</li>
            <li>ℹ️ {t('imaging.help_info')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PatientViewer;