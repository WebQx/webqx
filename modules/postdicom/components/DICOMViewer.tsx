/**
 * PostDICOM DICOM Viewer Component
 * React component for viewing DICOM images in the patient portal
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  DICOMViewerProps,
  DICOMImage,
  ViewerConfig,
  PostDICOMError
} from '../types/postdicom.types';

// Mock DICOM viewer implementation
const DICOMViewer: React.FC<DICOMViewerProps> = ({
  studyInstanceUID,
  seriesInstanceUID,
  sopInstanceUID,
  viewerConfig = {
    enableMeasurements: true,
    enableAnnotations: false,
    enableZoom: true,
    enablePan: true,
    enableRotation: true,
    enableWindowLevel: true,
    showThumbnails: true,
    showMetadata: true
  },
  onImageLoad,
  onError
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentImage, setCurrentImage] = useState<DICOMImage | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [windowLevel, setWindowLevel] = useState({ center: 40, width: 400 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);

  // Load DICOM image
  const loadImage = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get authentication token
      const token = localStorage.getItem('webqx_token');
      if (!token) {
        throw new Error('Authentication required');
      }

      // Fetch image metadata first
      const metadataResponse = await fetch(
        `/postdicom/images/${sopInstanceUID}/metadata`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!metadataResponse.ok) {
        throw new Error(`Failed to load image metadata: ${metadataResponse.statusText}`);
      }

      const metadataResult = await metadataResponse.json();
      if (!metadataResult.success) {
        throw new Error(metadataResult.error?.message || 'Failed to load image metadata');
      }

      const imageMetadata = metadataResult.data;
      setCurrentImage(imageMetadata);

      // Generate pre-signed URL for image data
      const urlResponse = await fetch(
        `/postdicom/images/${sopInstanceUID}/presigned-url`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ expiresIn: 3600 })
        }
      );

      if (!urlResponse.ok) {
        throw new Error(`Failed to generate image URL: ${urlResponse.statusText}`);
      }

      const urlResult = await urlResponse.json();
      if (!urlResult.success) {
        throw new Error(urlResult.error?.message || 'Failed to generate image URL');
      }

      setImageUrl(urlResult.data.url);

      // Set initial window/level from metadata
      if (imageMetadata.metadata?.windowCenter && imageMetadata.metadata?.windowWidth) {
        setWindowLevel({
          center: imageMetadata.metadata.windowCenter,
          width: imageMetadata.metadata.windowWidth
        });
      }

      // Notify parent component
      if (onImageLoad) {
        onImageLoad(imageMetadata);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      
      if (onError) {
        onError(new Error(errorMessage));
      }
    } finally {
      setLoading(false);
    }
  }, [sopInstanceUID, onImageLoad, onError]);

  // Load image on component mount or when UID changes
  useEffect(() => {
    if (sopInstanceUID) {
      loadImage();
    }
  }, [sopInstanceUID, loadImage]);

  // Handle zoom
  const handleZoom = (direction: 'in' | 'out') => {
    if (!viewerConfig.enableZoom) return;
    
    setZoom(prev => {
      const factor = direction === 'in' ? 1.25 : 0.8;
      return Math.max(0.1, Math.min(5, prev * factor));
    });
  };

  // Handle window/level adjustment
  const handleWindowLevel = (centerDelta: number, widthDelta: number) => {
    if (!viewerConfig.enableWindowLevel) return;
    
    setWindowLevel(prev => ({
      center: Math.max(0, Math.min(4096, prev.center + centerDelta)),
      width: Math.max(1, Math.min(4096, prev.width + widthDelta))
    }));
  };

  // Handle rotation
  const handleRotation = (degrees: number) => {
    if (!viewerConfig.enableRotation) return;
    
    setRotation(prev => (prev + degrees) % 360);
  };

  // Reset view
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
    if (currentImage?.metadata) {
      setWindowLevel({
        center: currentImage.metadata.windowCenter || 40,
        width: currentImage.metadata.windowWidth || 400
      });
    }
  };

  if (loading) {
    return (
      <div className="dicom-viewer loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading DICOM image...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dicom-viewer error">
        <div className="error-message">
          <h3>Error Loading Image</h3>
          <p>{error}</p>
          <button onClick={loadImage}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dicom-viewer">
      {/* Viewer Toolbar */}
      <div className="viewer-toolbar">
        {viewerConfig.enableZoom && (
          <div className="toolbar-group">
            <button onClick={() => handleZoom('in')} title="Zoom In">🔍+</button>
            <button onClick={() => handleZoom('out')} title="Zoom Out">🔍-</button>
            <span className="zoom-level">{Math.round(zoom * 100)}%</span>
          </div>
        )}
        
        {viewerConfig.enableRotation && (
          <div className="toolbar-group">
            <button onClick={() => handleRotation(90)} title="Rotate 90°">↻</button>
            <button onClick={() => handleRotation(-90)} title="Rotate -90°">↺</button>
          </div>
        )}
        
        {viewerConfig.enableWindowLevel && (
          <div className="toolbar-group">
            <label>W/L: {windowLevel.width}/{windowLevel.center}</label>
            <button onClick={() => handleWindowLevel(0, 50)} title="Increase Width">W+</button>
            <button onClick={() => handleWindowLevel(0, -50)} title="Decrease Width">W-</button>
            <button onClick={() => handleWindowLevel(10, 0)} title="Increase Level">L+</button>
            <button onClick={() => handleWindowLevel(-10, 0)} title="Decrease Level">L-</button>
          </div>
        )}
        
        <div className="toolbar-group">
          <button onClick={resetView} title="Reset View">Reset</button>
        </div>
      </div>

      {/* Main Viewer Area */}
      <div className="viewer-main">
        {/* Image Display */}
        <div className="image-container">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`DICOM Image ${sopInstanceUID}`}
              style={{
                transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg)`,
                filter: `contrast(${windowLevel.width / 400}) brightness(${windowLevel.center / 40})`
              }}
              onError={() => setError('Failed to load image data')}
            />
          ) : (
            <div className="no-image">No image data available</div>
          )}
        </div>

        {/* Metadata Panel */}
        {viewerConfig.showMetadata && currentImage && (
          <div className="metadata-panel">
            <h4>Image Information</h4>
            <div className="metadata-grid">
              <div><strong>Patient ID:</strong> {currentImage.metadata?.patientID || 'N/A'}</div>
              <div><strong>Series:</strong> {currentImage.seriesInstanceUID}</div>
              <div><strong>Instance:</strong> {currentImage.instanceNumber}</div>
              <div><strong>Image Type:</strong> {currentImage.imageType}</div>
              <div><strong>Dimensions:</strong> {currentImage.rows} × {currentImage.columns}</div>
              <div><strong>Bits Allocated:</strong> {currentImage.bitsAllocated}</div>
              <div><strong>Transfer Syntax:</strong> {currentImage.transferSyntax}</div>
              {currentImage.metadata?.sliceThickness && (
                <div><strong>Slice Thickness:</strong> {currentImage.metadata.sliceThickness}mm</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {viewerConfig.showThumbnails && (
        <div className="thumbnails-panel">
          <h4>Series Images</h4>
          <div className="thumbnails-grid">
            {/* Placeholder for thumbnails - would be populated with series images */}
            <div className="thumbnail active">
              <img src={currentImage?.thumbnailUrl || '/placeholder-dicom.png'} alt="Thumbnail" />
              <span>Image {currentImage?.instanceNumber}</span>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .dicom-viewer {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #1a1a1a;
          color: #ffffff;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .viewer-toolbar {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 10px 15px;
          background: #2a2a2a;
          border-bottom: 1px solid #3a3a3a;
        }

        .toolbar-group {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .toolbar-group button {
          background: #3a3a3a;
          color: #ffffff;
          border: 1px solid #4a4a4a;
          padding: 5px 10px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }

        .toolbar-group button:hover {
          background: #4a4a4a;
        }

        .zoom-level {
          min-width: 50px;
          text-align: center;
          font-size: 12px;
        }

        .viewer-main {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .image-container {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #000000;
          overflow: hidden;
          position: relative;
        }

        .image-container img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          transition: transform 0.2s ease;
        }

        .metadata-panel {
          width: 300px;
          background: #2a2a2a;
          border-left: 1px solid #3a3a3a;
          padding: 15px;
          overflow-y: auto;
        }

        .metadata-panel h4 {
          margin: 0 0 15px 0;
          color: #ffffff;
        }

        .metadata-grid {
          display: grid;
          gap: 8px;
          font-size: 12px;
        }

        .metadata-grid div {
          color: #cccccc;
        }

        .thumbnails-panel {
          width: 150px;
          background: #2a2a2a;
          border-left: 1px solid #3a3a3a;
          padding: 10px;
        }

        .thumbnails-panel h4 {
          margin: 0 0 10px 0;
          font-size: 14px;
        }

        .thumbnails-grid {
          display: grid;
          gap: 5px;
        }

        .thumbnail {
          text-align: center;
          cursor: pointer;
          padding: 5px;
          border-radius: 4px;
        }

        .thumbnail:hover {
          background: #3a3a3a;
        }

        .thumbnail.active {
          background: #4a4a4a;
        }

        .thumbnail img {
          width: 100%;
          height: 60px;
          object-fit: cover;
          border-radius: 2px;
        }

        .thumbnail span {
          display: block;
          font-size: 10px;
          margin-top: 2px;
        }

        .loading, .error {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 400px;
          text-align: center;
        }

        .loading-spinner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 15px;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #3a3a3a;
          border-top: 4px solid #ffffff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .error-message {
          background: #2a2a2a;
          padding: 20px;
          border-radius: 8px;
          border: 1px solid #ff4444;
        }

        .error-message h3 {
          color: #ff4444;
          margin: 0 0 10px 0;
        }

        .error-message button {
          background: #ff4444;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          margin-top: 10px;
        }

        .no-image {
          color: #666666;
          font-style: italic;
        }
      `}</style>
    </div>
  );
};

export default DICOMViewer;