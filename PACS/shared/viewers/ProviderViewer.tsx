/**
 * @fileoverview Provider Panel DICOM Viewer
 * 
 * Advanced DICOM viewer for healthcare providers with full functionality
 * including measurements, annotations, and advanced imaging tools.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import DicomViewer from './DicomViewer';
import ViewerControls from './ViewerControls';
import MetadataDisplay from './MetadataDisplay';
import { 
  ViewerConfig, 
  ViewerState, 
  ViewerTools, 
  Measurement, 
  Annotation,
  DicomImage 
} from './types';

interface ProviderViewerProps {
  studyInstanceUID: string;
  seriesInstanceUID?: string;
  onSave?: (data: { measurements: Measurement[]; annotations: Annotation[] }) => void;
  onPrint?: () => void;
  onExport?: (format: 'pdf' | 'dicom' | 'png') => void;
  className?: string;
}

const PROVIDER_VIEWER_CONFIG: ViewerConfig = {
  enableZoom: true,
  enablePan: true,
  enableRotate: true,
  enableBrightnessContrast: true,
  enableMeasurements: true,
  enableAnnotations: true,
  enableCine: true,
  enableFullscreen: true,
  enableMetadataDisplay: true,
  enableWindowLevel: true,
  readOnly: false,
};

export const ProviderViewer: React.FC<ProviderViewerProps> = ({
  studyInstanceUID,
  seriesInstanceUID,
  onSave,
  onPrint,
  onExport,
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

  const [tools, setTools] = useState<ViewerTools>({
    measurements: [],
    annotations: [],
    activeTool: null,
  });

  const [currentImage, setCurrentImage] = useState<DicomImage | null>(null);
  const [showMetadata, setShowMetadata] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  /**
   * Handle zoom changes
   */
  const handleZoom = useCallback((factor: number) => {
    setViewerState(prev => ({
      ...prev,
      zoom: Math.max(0.1, Math.min(5.0, factor)),
    }));
  }, []);

  /**
   * Handle pan changes
   */
  const handlePan = useCallback((delta: { x: number; y: number }) => {
    setViewerState(prev => ({
      ...prev,
      pan: {
        x: prev.pan.x + delta.x,
        y: prev.pan.y + delta.y,
      },
    }));
  }, []);

  /**
   * Handle rotation changes
   */
  const handleRotate = useCallback((angle: number) => {
    setViewerState(prev => ({
      ...prev,
      rotation: (prev.rotation + angle) % 360,
    }));
  }, []);

  /**
   * Handle brightness changes
   */
  const handleBrightnessChange = useCallback((value: number) => {
    setViewerState(prev => ({
      ...prev,
      brightness: Math.max(-100, Math.min(100, value)),
    }));
  }, []);

  /**
   * Handle contrast changes
   */
  const handleContrastChange = useCallback((value: number) => {
    setViewerState(prev => ({
      ...prev,
      contrast: Math.max(-100, Math.min(100, value)),
    }));
  }, []);

  /**
   * Handle window level changes
   */
  const handleWindowLevel = useCallback((center: number, width: number) => {
    setViewerState(prev => ({
      ...prev,
      windowCenter: center,
      windowWidth: width,
    }));
  }, []);

  /**
   * Handle tool selection
   */
  const handleToolSelect = useCallback((tool: string | null) => {
    setTools(prev => ({
      ...prev,
      activeTool: tool,
    }));
  }, []);

  /**
   * Handle view reset
   */
  const handleReset = useCallback(() => {
    setViewerState({
      zoom: 1.0,
      pan: { x: 0, y: 0 },
      rotation: 0,
      brightness: 0,
      contrast: 0,
      windowCenter: 128,
      windowWidth: 256,
      isPlaying: false,
      currentImageIndex: viewerState.currentImageIndex,
    });
  }, [viewerState.currentImageIndex]);

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
   * Handle measurement creation
   */
  const handleMeasurement = useCallback((measurement: Measurement) => {
    setTools(prev => ({
      ...prev,
      measurements: [...prev.measurements, measurement],
    }));
  }, []);

  /**
   * Handle annotation creation
   */
  const handleAnnotation = useCallback((annotation: Annotation) => {
    setTools(prev => ({
      ...prev,
      annotations: [...prev.annotations, annotation],
    }));
  }, []);

  /**
   * Handle image load
   */
  const handleImageLoad = useCallback((image: DicomImage) => {
    setCurrentImage(image);
    
    // Set default window level from image metadata
    if (image.metadata.windowCenter && image.metadata.windowWidth) {
      setViewerState(prev => ({
        ...prev,
        windowCenter: image.metadata.windowCenter!,
        windowWidth: image.metadata.windowWidth!,
      }));
    }
  }, []);

  /**
   * Handle save functionality
   */
  const handleSave = useCallback(async () => {
    try {
      const data = {
        measurements: tools.measurements,
        annotations: tools.annotations,
      };

      // Save to backend
      const response = await fetch(`/api/dicom/studies/${studyInstanceUID}/annotations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to save annotations');
      }

      onSave?.(data);
      alert(t('imaging.save_success'));
    } catch (error) {
      console.error('Save error:', error);
      alert(t('imaging.save_error'));
    }
  }, [tools, studyInstanceUID, onSave, t]);

  /**
   * Handle export functionality
   */
  const handleExport = useCallback((format: 'pdf' | 'dicom' | 'png') => {
    onExport?.(format);
  }, [onExport]);

  return (
    <div className={`provider-viewer ${isFullscreen ? 'fullscreen' : ''} ${className}`}>
      {/* Viewer Header */}
      <div className="viewer-header">
        <div className="header-left">
          <h2>{t('imaging.provider_viewer')}</h2>
          {currentImage && (
            <span className="study-info">
              {currentImage.metadata.studyDescription} - {currentImage.metadata.modality}
            </span>
          )}
        </div>
        
        <div className="header-right">
          <button 
            onClick={() => setShowMetadata(!showMetadata)}
            className={`toggle-button ${showMetadata ? 'active' : ''}`}
            title={t('imaging.toggle_metadata')}
          >
            📋
          </button>
          
          <button 
            onClick={() => setShowControls(!showControls)}
            className={`toggle-button ${showControls ? 'active' : ''}`}
            title={t('imaging.toggle_controls')}
          >
            🎛️
          </button>
          
          <div className="action-buttons">
            <button onClick={handleSave} className="save-button">
              💾 {t('common.save')}
            </button>
            
            <button onClick={onPrint} className="print-button">
              🖨️ {t('common.print')}
            </button>
            
            <div className="export-dropdown">
              <button className="export-button">
                📤 {t('common.export')} ▼
              </button>
              <div className="export-menu">
                <button onClick={() => handleExport('pdf')}>PDF</button>
                <button onClick={() => handleExport('png')}>PNG</button>
                <button onClick={() => handleExport('dicom')}>DICOM</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="viewer-content">
        {/* Left Panel - Controls */}
        {showControls && (
          <div className="controls-panel">
            <ViewerControls
              config={PROVIDER_VIEWER_CONFIG}
              state={viewerState}
              tools={tools}
              onZoom={handleZoom}
              onPan={handlePan}
              onRotate={handleRotate}
              onBrightnessChange={handleBrightnessChange}
              onContrastChange={handleContrastChange}
              onWindowLevel={handleWindowLevel}
              onToolSelect={handleToolSelect}
              onReset={handleReset}
              onFullscreen={handleFullscreen}
            />
          </div>
        )}

        {/* Center Panel - Viewer */}
        <div className="viewer-panel">
          <DicomViewer
            studyInstanceUID={studyInstanceUID}
            seriesInstanceUID={seriesInstanceUID}
            config={PROVIDER_VIEWER_CONFIG}
            onImageLoad={handleImageLoad}
            onMeasurement={handleMeasurement}
            onAnnotation={handleAnnotation}
            onStateChange={setViewerState}
            className="provider-dicom-viewer"
          />
        </div>

        {/* Right Panel - Metadata */}
        {showMetadata && currentImage && (
          <div className="metadata-panel">
            <MetadataDisplay
              metadata={currentImage.metadata}
              readOnly={false}
              className="provider-metadata"
            />
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="viewer-status-bar">
        <span className="status-info">
          {t('imaging.zoom')}: {Math.round(viewerState.zoom * 100)}% | 
          {t('imaging.rotation')}: {viewerState.rotation}° |
          {t('imaging.window_level')}: C:{viewerState.windowCenter} W:{viewerState.windowWidth}
        </span>
        
        <span className="tool-info">
          {tools.activeTool ? t(`imaging.${tools.activeTool}_tool`) : t('imaging.select_tool')} |
          {t('imaging.measurements')}: {tools.measurements.length} |
          {t('imaging.annotations')}: {tools.annotations.length}
        </span>
      </div>
    </div>
  );
};

export default ProviderViewer;