/**
 * @fileoverview Core DICOM Viewer Component
 * 
 * Base DICOM viewer component providing essential viewing functionality
 * including zoom, pan, rotate, and window level adjustments.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DicomImage, ViewerConfig, ViewerState, ViewerProps, DicomMetadata } from './types';

const DEFAULT_VIEWER_STATE: ViewerState = {
  zoom: 1.0,
  pan: { x: 0, y: 0 },
  rotation: 0,
  brightness: 0,
  contrast: 0,
  windowCenter: 128,
  windowWidth: 256,
  isPlaying: false,
  currentImageIndex: 0,
};

export const DicomViewer: React.FC<ViewerProps> = ({
  studyInstanceUID,
  seriesInstanceUID,
  config,
  onImageLoad,
  onError,
  onStateChange,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [images, setImages] = useState<DicomImage[]>([]);
  const [currentImage, setCurrentImage] = useState<DicomImage | null>(null);
  const [viewerState, setViewerState] = useState<ViewerState>(DEFAULT_VIEWER_STATE);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  /**
   * Load DICOM images for the study/series
   */
  const loadImages = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const url = seriesInstanceUID 
        ? `/api/dicom/series/${seriesInstanceUID}/images`
        : `/api/dicom/studies/${studyInstanceUID}/images`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load images: ${response.statusText}`);
      }

      const imageData: DicomImage[] = await response.json();
      setImages(imageData);

      if (imageData.length > 0) {
        setCurrentImage(imageData[0]);
        onImageLoad?.(imageData[0]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load images';
      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setIsLoading(false);
    }
  }, [studyInstanceUID, seriesInstanceUID, onImageLoad, onError]);

  /**
   * Update viewer state and notify parent
   */
  const updateViewerState = useCallback((updates: Partial<ViewerState>) => {
    setViewerState(prev => {
      const newState = { ...prev, ...updates };
      onStateChange?.(newState);
      return newState;
    });
  }, [onStateChange]);

  /**
   * Render DICOM image on canvas with current transformations
   */
  const renderImage = useCallback(() => {
    if (!currentImage || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Apply transformations
      ctx.save();
      
      // Center the transformation
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      ctx.translate(centerX, centerY);
      
      // Apply zoom
      ctx.scale(viewerState.zoom, viewerState.zoom);
      
      // Apply rotation
      ctx.rotate((viewerState.rotation * Math.PI) / 180);
      
      // Apply pan
      ctx.translate(viewerState.pan.x, viewerState.pan.y);
      
      // Draw image centered
      const imgWidth = img.width;
      const imgHeight = img.height;
      ctx.drawImage(img, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
      
      // Apply brightness/contrast filter
      if (viewerState.brightness !== 0 || viewerState.contrast !== 0) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        applyBrightnessContrast(imageData, viewerState.brightness, viewerState.contrast);
        ctx.putImageData(imageData, 0, 0);
      }
      
      ctx.restore();
    };
    
    img.src = currentImage.url;
  }, [currentImage, viewerState]);

  /**
   * Apply brightness and contrast adjustments to image data
   */
  const applyBrightnessContrast = (imageData: ImageData, brightness: number, contrast: number) => {
    const data = imageData.data;
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    
    for (let i = 0; i < data.length; i += 4) {
      // Apply brightness and contrast to RGB channels
      data[i] = Math.max(0, Math.min(255, factor * (data[i] - 128) + 128 + brightness));     // Red
      data[i + 1] = Math.max(0, Math.min(255, factor * (data[i + 1] - 128) + 128 + brightness)); // Green
      data[i + 2] = Math.max(0, Math.min(255, factor * (data[i + 2] - 128) + 128 + brightness)); // Blue
      // Alpha channel remains unchanged
    }
  };

  /**
   * Handle mouse events for pan functionality
   */
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!config.enablePan) return;
    
    setIsDragging(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !config.enablePan) return;
    
    const deltaX = e.clientX - lastMousePos.x;
    const deltaY = e.clientY - lastMousePos.y;
    
    updateViewerState({
      pan: {
        x: viewerState.pan.x + deltaX / viewerState.zoom,
        y: viewerState.pan.y + deltaY / viewerState.zoom,
      },
    });
    
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  /**
   * Handle mouse wheel for zoom
   */
  const handleWheel = (e: React.WheelEvent) => {
    if (!config.enableZoom) return;
    
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(5.0, viewerState.zoom * delta));
    
    updateViewerState({ zoom: newZoom });
  };

  /**
   * Navigate between images in series
   */
  const navigateToImage = (index: number) => {
    if (index >= 0 && index < images.length) {
      setCurrentImage(images[index]);
      updateViewerState({ currentImageIndex: index });
      onImageLoad?.(images[index]);
    }
  };

  // Viewer control functions
  const zoomIn = () => {
    if (config.enableZoom) {
      updateViewerState({ zoom: Math.min(5.0, viewerState.zoom * 1.25) });
    }
  };

  const zoomOut = () => {
    if (config.enableZoom) {
      updateViewerState({ zoom: Math.max(0.1, viewerState.zoom * 0.8) });
    }
  };

  const rotateClockwise = () => {
    if (config.enableRotate) {
      updateViewerState({ rotation: (viewerState.rotation + 90) % 360 });
    }
  };

  const rotateCounterClockwise = () => {
    if (config.enableRotate) {
      updateViewerState({ rotation: (viewerState.rotation - 90 + 360) % 360 });
    }
  };

  const resetView = () => {
    updateViewerState(DEFAULT_VIEWER_STATE);
  };

  const adjustBrightness = (value: number) => {
    if (config.enableBrightnessContrast) {
      updateViewerState({ brightness: Math.max(-100, Math.min(100, value)) });
    }
  };

  const adjustContrast = (value: number) => {
    if (config.enableBrightnessContrast) {
      updateViewerState({ contrast: Math.max(-100, Math.min(100, value)) });
    }
  };

  // Load images on mount
  useEffect(() => {
    loadImages();
  }, [loadImages]);

  // Re-render when state changes
  useEffect(() => {
    renderImage();
  }, [renderImage]);

  // Set up canvas size
  useEffect(() => {
    if (canvasRef.current && containerRef.current) {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      
      const resizeCanvas = () => {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        renderImage();
      };
      
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
      
      return () => window.removeEventListener('resize', resizeCanvas);
    }
  }, [renderImage]);

  if (isLoading) {
    return (
      <div className={`dicom-viewer-loading ${className}`}>
        <div className="loading-spinner" />
        <p>Loading DICOM images...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`dicom-viewer-error ${className}`}>
        <div className="error-icon">⚠️</div>
        <h3>Error Loading Images</h3>
        <p>{error}</p>
        <button onClick={loadImages}>Retry</button>
      </div>
    );
  }

  return (
    <div className={`dicom-viewer ${className}`} ref={containerRef}>
      <canvas
        ref={canvasRef}
        style={{
          cursor: config.enablePan ? (isDragging ? 'grabbing' : 'grab') : 'default',
          width: '100%',
          height: '100%',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />
      
      {/* Basic Controls */}
      <div className="viewer-controls">
        {config.enableZoom && (
          <div className="zoom-controls">
            <button onClick={zoomIn} title="Zoom In">🔍+</button>
            <span>{Math.round(viewerState.zoom * 100)}%</span>
            <button onClick={zoomOut} title="Zoom Out">🔍-</button>
          </div>
        )}
        
        {config.enableRotate && (
          <div className="rotation-controls">
            <button onClick={rotateCounterClockwise} title="Rotate Left">↺</button>
            <button onClick={rotateClockwise} title="Rotate Right">↻</button>
          </div>
        )}
        
        <button onClick={resetView} title="Reset View">🔄</button>
      </div>

      {/* Multi-image navigation */}
      {images.length > 1 && (
        <div className="image-navigation">
          <button 
            onClick={() => navigateToImage(viewerState.currentImageIndex - 1)}
            disabled={viewerState.currentImageIndex === 0}
          >
            ←
          </button>
          <span>
            {viewerState.currentImageIndex + 1} / {images.length}
          </span>
          <button 
            onClick={() => navigateToImage(viewerState.currentImageIndex + 1)}
            disabled={viewerState.currentImageIndex === images.length - 1}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
};

export default DicomViewer;