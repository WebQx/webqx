/**
 * @fileoverview DICOM Viewer Controls Component
 * 
 * Provides interactive controls for DICOM viewer including zoom, pan,
 * rotate, brightness/contrast adjustments, and tool selection.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ViewerControlsProps } from './types';

export const ViewerControls: React.FC<ViewerControlsProps> = ({
  config,
  state,
  tools,
  onZoom,
  onPan,
  onRotate,
  onBrightnessChange,
  onContrastChange,
  onWindowLevel,
  onToolSelect,
  onReset,
  onFullscreen,
}) => {
  const { t } = useTranslation();

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    onZoom(value);
  };

  const handleBrightnessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    onBrightnessChange(value);
  };

  const handleContrastChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    onContrastChange(value);
  };

  const handleWindowCenterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    onWindowLevel(value, state.windowWidth);
  };

  const handleWindowWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    onWindowLevel(state.windowCenter, value);
  };

  const renderZoomControls = () => {
    if (!config.enableZoom) return null;

    return (
      <div className="control-group zoom-controls">
        <label>{t('imaging.zoom')}</label>
        <div className="zoom-buttons">
          <button onClick={() => onZoom(state.zoom * 0.8)} title={t('imaging.zoom_out')}>
            🔍-
          </button>
          <input
            type="range"
            min="0.1"
            max="5.0"
            step="0.1"
            value={state.zoom}
            onChange={handleZoomChange}
            className="zoom-slider"
          />
          <button onClick={() => onZoom(state.zoom * 1.25)} title={t('imaging.zoom_in')}>
            🔍+
          </button>
          <span className="zoom-value">{Math.round(state.zoom * 100)}%</span>
        </div>
      </div>
    );
  };

  const renderRotationControls = () => {
    if (!config.enableRotate) return null;

    return (
      <div className="control-group rotation-controls">
        <label>{t('imaging.rotation')}</label>
        <div className="rotation-buttons">
          <button 
            onClick={() => onRotate(-90)} 
            title={t('imaging.rotate_left')}
          >
            ↺
          </button>
          <span className="rotation-value">{state.rotation}°</span>
          <button 
            onClick={() => onRotate(90)} 
            title={t('imaging.rotate_right')}
          >
            ↻
          </button>
        </div>
      </div>
    );
  };

  const renderBrightnessContrastControls = () => {
    if (!config.enableBrightnessContrast) return null;

    return (
      <div className="control-group brightness-contrast-controls">
        <div className="brightness-controls">
          <label>{t('imaging.brightness')}</label>
          <input
            type="range"
            min="-100"
            max="100"
            value={state.brightness}
            onChange={handleBrightnessChange}
            className="brightness-slider"
          />
          <span className="brightness-value">{state.brightness}</span>
        </div>
        
        <div className="contrast-controls">
          <label>{t('imaging.contrast')}</label>
          <input
            type="range"
            min="-100"
            max="100"
            value={state.contrast}
            onChange={handleContrastChange}
            className="contrast-slider"
          />
          <span className="contrast-value">{state.contrast}</span>
        </div>
      </div>
    );
  };

  const renderWindowLevelControls = () => {
    if (!config.enableWindowLevel) return null;

    return (
      <div className="control-group window-level-controls">
        <div className="window-center-controls">
          <label>{t('imaging.window_center')}</label>
          <input
            type="range"
            min="0"
            max="4095"
            value={state.windowCenter}
            onChange={handleWindowCenterChange}
            className="window-center-slider"
          />
          <span className="window-center-value">{state.windowCenter}</span>
        </div>
        
        <div className="window-width-controls">
          <label>{t('imaging.window_width')}</label>
          <input
            type="range"
            min="1"
            max="4095"
            value={state.windowWidth}
            onChange={handleWindowWidthChange}
            className="window-width-slider"
          />
          <span className="window-width-value">{state.windowWidth}</span>
        </div>
      </div>
    );
  };

  const renderToolControls = () => {
    if (!config.enableMeasurements && !config.enableAnnotations) return null;

    const availableTools = [];
    
    if (config.enableMeasurements) {
      availableTools.push(
        { id: 'distance', label: t('imaging.distance_tool'), icon: '📏' },
        { id: 'angle', label: t('imaging.angle_tool'), icon: '📐' },
        { id: 'area', label: t('imaging.area_tool'), icon: '▢' }
      );
    }
    
    if (config.enableAnnotations) {
      availableTools.push(
        { id: 'arrow', label: t('imaging.arrow_tool'), icon: '→' },
        { id: 'text', label: t('imaging.text_tool'), icon: 'T' },
        { id: 'rectangle', label: t('imaging.rectangle_tool'), icon: '▭' },
        { id: 'circle', label: t('imaging.circle_tool'), icon: '○' }
      );
    }

    return (
      <div className="control-group tool-controls">
        <label>{t('imaging.tools')}</label>
        <div className="tool-buttons">
          <button
            onClick={() => onToolSelect(null)}
            className={`tool-button ${tools.activeTool === null ? 'active' : ''}`}
            title={t('imaging.select_tool')}
          >
            🖱️
          </button>
          {availableTools.map(tool => (
            <button
              key={tool.id}
              onClick={() => onToolSelect(tool.id)}
              className={`tool-button ${tools.activeTool === tool.id ? 'active' : ''}`}
              title={tool.label}
            >
              {tool.icon}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderGeneralControls = () => (
    <div className="control-group general-controls">
      <button onClick={onReset} className="control-button reset-button" title={t('imaging.reset_view')}>
        🔄 {t('imaging.reset')}
      </button>
      
      {config.enableFullscreen && (
        <button onClick={onFullscreen} className="control-button fullscreen-button" title={t('imaging.fullscreen')}>
          ⛶ {t('imaging.fullscreen')}
        </button>
      )}
    </div>
  );

  const renderMeasurementsPanel = () => {
    if (!config.enableMeasurements || tools.measurements.length === 0) return null;

    return (
      <div className="measurements-panel">
        <h4>{t('imaging.measurements')}</h4>
        <div className="measurements-list">
          {tools.measurements.map(measurement => (
            <div key={measurement.id} className="measurement-item">
              <span className="measurement-type">{t(`imaging.${measurement.type}`)}</span>
              <span className="measurement-value">
                {measurement.value.toFixed(2)} {measurement.unit}
              </span>
              {measurement.label && (
                <span className="measurement-label">{measurement.label}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderAnnotationsPanel = () => {
    if (!config.enableAnnotations || tools.annotations.length === 0) return null;

    return (
      <div className="annotations-panel">
        <h4>{t('imaging.annotations')}</h4>
        <div className="annotations-list">
          {tools.annotations.map(annotation => (
            <div key={annotation.id} className="annotation-item">
              <span className="annotation-type">{t(`imaging.${annotation.type}`)}</span>
              {annotation.text && (
                <span className="annotation-text">{annotation.text}</span>
              )}
              <span className="annotation-date">
                {annotation.createdAt.toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="viewer-controls">
      <div className="controls-toolbar">
        {renderZoomControls()}
        {renderRotationControls()}
        {renderBrightnessContrastControls()}
        {renderWindowLevelControls()}
        {renderToolControls()}
        {renderGeneralControls()}
      </div>
      
      <div className="controls-panels">
        {renderMeasurementsPanel()}
        {renderAnnotationsPanel()}
      </div>
    </div>
  );
};

export default ViewerControls;