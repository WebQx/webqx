/**
 * PACS Viewer Component
 * Integrates OHIF viewer with WebQX for medical imaging display and transcription overlays
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PACSService, StudyInfo, DICOMImage, TranscriptionOverlay } from '../../services/pacsService';
import { BatchTranscriptionOverlayService, BatchJob, OverlaySettings } from '../../services/batchTranscriptionOverlayService';

interface PACSViewerProps {
  patientId?: string;
  studyInstanceUID?: string;
  pacsService: PACSService;
  overlayService: BatchTranscriptionOverlayService;
  enableTranscription?: boolean;
  enableBatchProcessing?: boolean;
  className?: string;
}

interface ViewerState {
  studies: StudyInfo[];
  selectedStudy: StudyInfo | null;
  selectedImage: DICOMImage | null;
  overlays: TranscriptionOverlay[];
  isLoading: boolean;
  error: string | null;
  viewerUrl: string | null;
}

const PACSViewer: React.FC<PACSViewerProps> = ({
  patientId,
  studyInstanceUID,
  pacsService,
  overlayService,
  enableTranscription = true,
  enableBatchProcessing = true,
  className = ''
}) => {
  const [state, setState] = useState<ViewerState>({
    studies: [],
    selectedStudy: null,
    selectedImage: null,
    overlays: [],
    isLoading: false,
    error: null,
    viewerUrl: null
  });

  const [batchJobs, setBatchJobs] = useState<BatchJob[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [overlaySettings, setOverlaySettings] = useState<OverlaySettings>({
    position: 'bottom-left',
    fontSize: 'medium',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    textColor: '#ffffff',
    opacity: 0.9,
    padding: 10,
    borderRadius: 5,
    maxWidth: 300,
    showSpeaker: true,
    showTimestamp: true,
    showConfidence: false
  });

  const supportedLanguages = useMemo(() => 
    overlayService.getSupportedLanguages(), [overlayService]
  );

  // Load studies on component mount or when patientId changes
  useEffect(() => {
    if (patientId) {
      loadStudies();
    } else if (studyInstanceUID) {
      loadSingleStudy();
    }
  }, [patientId, studyInstanceUID]);

  // Update batch jobs list
  useEffect(() => {
    const updateJobs = () => setBatchJobs(overlayService.getAllJobs());
    
    overlayService.on('jobCreated', updateJobs);
    overlayService.on('jobCompleted', updateJobs);
    overlayService.on('jobFailed', updateJobs);
    overlayService.on('jobProgress', updateJobs);

    return () => {
      overlayService.removeListener('jobCreated', updateJobs);
      overlayService.removeListener('jobCompleted', updateJobs);
      overlayService.removeListener('jobFailed', updateJobs);
      overlayService.removeListener('jobProgress', updateJobs);
    };
  }, [overlayService]);

  const loadStudies = async () => {
    if (!patientId) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const studies = await pacsService.getStudies(patientId);
      setState(prev => ({ 
        ...prev, 
        studies, 
        isLoading: false,
        selectedStudy: studies.length > 0 ? studies[0] : null
      }));

      if (studies.length > 0) {
        selectStudy(studies[0]);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setState(prev => ({ 
        ...prev, 
        error: errorMessage, 
        isLoading: false 
      }));
    }
  };

  const loadSingleStudy = async () => {
    if (!studyInstanceUID) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const study = await pacsService.getStudyDetails(studyInstanceUID);
      setState(prev => ({ 
        ...prev, 
        studies: [study], 
        selectedStudy: study,
        isLoading: false 
      }));
      
      selectStudy(study);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setState(prev => ({ 
        ...prev, 
        error: errorMessage, 
        isLoading: false 
      }));
    }
  };

  const selectStudy = useCallback((study: StudyInfo) => {
    const viewerUrl = pacsService.getViewerUrl(study.studyInstanceUID);
    setState(prev => ({ 
      ...prev, 
      selectedStudy: study, 
      viewerUrl,
      selectedImage: study.series[0]?.images[0] || null
    }));

    // Load overlays for the first image
    if (study.series[0]?.images[0]) {
      loadImageOverlays(study.series[0].images[0].id);
    }
  }, [pacsService]);

  const selectImage = useCallback((image: DICOMImage) => {
    setState(prev => ({ ...prev, selectedImage: image }));
    loadImageOverlays(image.id);
  }, []);

  const loadImageOverlays = (imageId: string) => {
    const overlays = overlayService.getImageOverlays(imageId);
    setState(prev => ({ ...prev, overlays }));
  };

  const handleAudioUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !state.selectedImage) return;

    const audioFiles = Array.from(files).map(file => ({
      imageId: state.selectedImage!.id,
      audioFile: file,
      language: selectedLanguage
    }));

    try {
      const jobId = await overlayService.createBatchJob(
        `Transcription for ${state.selectedImage.id}`,
        [state.selectedImage.id],
        audioFiles
      );

      await overlayService.processBatchJob(jobId);
      
      // Reload overlays after processing
      setTimeout(() => loadImageOverlays(state.selectedImage!.id), 1000);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setState(prev => ({ ...prev, error: errorMessage }));
    }
  };

  const handleBatchProcessing = async () => {
    if (!state.selectedStudy) return;

    const allImages = state.selectedStudy.series.flatMap(series => series.images);
    const imageIds = allImages.map(img => img.id);

    try {
      const jobId = await overlayService.createBatchJob(
        `Batch processing for study ${state.selectedStudy.studyInstanceUID}`,
        imageIds,
        [] // Audio files would be provided separately
      );

      // In a real implementation, this would prompt for audio files
      console.log('Batch job created:', jobId);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setState(prev => ({ ...prev, error: errorMessage }));
    }
  };

  const toggleOverlay = async (overlay: TranscriptionOverlay) => {
    if (!state.selectedImage) return;

    try {
      const result = await overlayService.applyOverlayToImage(
        state.selectedImage.id,
        overlay,
        overlaySettings
      );

      if (result.success) {
        console.log('Overlay applied successfully:', result.overlayImageUrl);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setState(prev => ({ ...prev, error: errorMessage }));
    }
  };

  const renderStudyList = () => (
    <div className="pacs-study-list">
      <h3>Studies</h3>
      {state.studies.map(study => (
        <div 
          key={study.studyInstanceUID}
          className={`study-item ${state.selectedStudy?.studyInstanceUID === study.studyInstanceUID ? 'selected' : ''}`}
          onClick={() => selectStudy(study)}
        >
          <div className="study-info">
            <div className="study-date">{study.studyDate}</div>
            <div className="study-description">{study.studyDescription}</div>
            <div className="study-details">
              {study.modality} • {study.numberOfSeries} series • {study.numberOfImages} images
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderImageThumbnails = () => {
    if (!state.selectedStudy) return null;

    return (
      <div className="pacs-thumbnails">
        <h4>Images</h4>
        <div className="thumbnail-grid">
          {state.selectedStudy.series.map(series => (
            <div key={series.seriesInstanceUID} className="series-group">
              <h5>Series {series.seriesNumber}: {series.seriesDescription}</h5>
              <div className="thumbnail-row">
                {series.images.map(image => (
                  <div 
                    key={image.id}
                    className={`thumbnail-item ${state.selectedImage?.id === image.id ? 'selected' : ''}`}
                    onClick={() => selectImage(image)}
                  >
                    <img 
                      src={image.thumbnailUrl || image.imageUrl} 
                      alt={`${image.modality} ${image.bodyPart}`}
                      className="thumbnail-image"
                    />
                    <div className="thumbnail-info">
                      <div>{image.modality}</div>
                      <div>{image.bodyPart}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTranscriptionControls = () => {
    if (!enableTranscription || !state.selectedImage) return null;

    return (
      <div className="transcription-controls">
        <h4>Transcription Overlay</h4>
        
        <div className="control-group">
          <label htmlFor="language-select">Language:</label>
          <select 
            id="language-select"
            value={selectedLanguage} 
            onChange={(e) => setSelectedLanguage(e.target.value)}
          >
            {supportedLanguages.map(lang => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label htmlFor="audio-upload">Upload Audio:</label>
          <input 
            id="audio-upload"
            type="file" 
            accept="audio/*" 
            multiple 
            onChange={handleAudioUpload}
          />
        </div>

        <div className="overlay-settings">
          <h5>Overlay Settings</h5>
          
          <div className="setting-group">
            <label>Position:</label>
            <select 
              value={overlaySettings.position} 
              onChange={(e) => setOverlaySettings(prev => ({ 
                ...prev, 
                position: e.target.value as any 
              }))}
            >
              <option value="top-left">Top Left</option>
              <option value="top-right">Top Right</option>
              <option value="bottom-left">Bottom Left</option>
              <option value="bottom-right">Bottom Right</option>
              <option value="center">Center</option>
            </select>
          </div>

          <div className="setting-group">
            <label>Font Size:</label>
            <select 
              value={overlaySettings.fontSize} 
              onChange={(e) => setOverlaySettings(prev => ({ 
                ...prev, 
                fontSize: e.target.value as any 
              }))}
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>

          <div className="setting-group">
            <label>Opacity:</label>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.1" 
              value={overlaySettings.opacity}
              onChange={(e) => setOverlaySettings(prev => ({ 
                ...prev, 
                opacity: parseFloat(e.target.value) 
              }))}
            />
            <span>{Math.round(overlaySettings.opacity * 100)}%</span>
          </div>
        </div>

        {state.overlays.length > 0 && (
          <div className="existing-overlays">
            <h5>Existing Overlays</h5>
            {state.overlays.map((overlay, index) => (
              <div key={index} className="overlay-item">
                <div className="overlay-text">{overlay.transcription}</div>
                <div className="overlay-meta">
                  {overlay.language} • {overlay.confidence}% confidence
                </div>
                <button onClick={() => toggleOverlay(overlay)}>
                  Apply Overlay
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderBatchJobs = () => {
    if (!enableBatchProcessing || batchJobs.length === 0) return null;

    return (
      <div className="batch-jobs">
        <h4>Batch Processing Jobs</h4>
        {batchJobs.map(job => (
          <div key={job.id} className="job-item">
            <div className="job-header">
              <span className="job-name">{job.name}</span>
              <span className={`job-status ${job.status}`}>{job.status}</span>
            </div>
            <div className="job-progress">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${job.progress}%` }}
                />
              </div>
              <span>{job.progress}%</span>
            </div>
            {job.errors.length > 0 && (
              <div className="job-errors">
                {job.errors.map((error, index) => (
                  <div key={index} className="error-message">{error}</div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderViewer = () => {
    if (!state.viewerUrl) return null;

    return (
      <div className="ohif-viewer-container">
        <iframe 
          src={state.viewerUrl}
          title="OHIF DICOM Viewer"
          className="ohif-viewer"
          width="100%"
          height="600px"
          frameBorder="0"
        />
      </div>
    );
  };

  if (state.isLoading) {
    return (
      <div className={`pacs-viewer loading ${className}`}>
        <div className="loading-spinner">Loading medical images...</div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className={`pacs-viewer error ${className}`}>
        <div className="error-message">
          <h3>Error Loading Images</h3>
          <p>{state.error}</p>
          <button onClick={() => patientId ? loadStudies() : loadSingleStudy()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`pacs-viewer ${className}`}>
      <div className="pacs-layout">
        <div className="pacs-sidebar">
          {renderStudyList()}
          {renderImageThumbnails()}
          {renderTranscriptionControls()}
          {renderBatchJobs()}
        </div>
        
        <div className="pacs-main">
          <div className="pacs-header">
            <h2>Medical Imaging Viewer</h2>
            {state.selectedStudy && (
              <div className="study-info">
                <span>Patient: {state.selectedStudy.patientName}</span>
                <span>Study: {state.selectedStudy.studyDescription}</span>
                <span>Date: {state.selectedStudy.studyDate}</span>
              </div>
            )}
          </div>
          
          {renderViewer()}
          
          {enableBatchProcessing && (
            <div className="batch-controls">
              <button 
                onClick={handleBatchProcessing}
                disabled={!state.selectedStudy}
              >
                Start Batch Processing
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .pacs-viewer {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: #f5f5f5;
        }

        .pacs-layout {
          display: flex;
          flex: 1;
          gap: 20px;
          padding: 20px;
        }

        .pacs-sidebar {
          width: 350px;
          background: white;
          border-radius: 8px;
          padding: 20px;
          overflow-y: auto;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .pacs-main {
          flex: 1;
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .study-item {
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          margin-bottom: 10px;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .study-item:hover {
          background-color: #f8f9fa;
        }

        .study-item.selected {
          background-color: #e3f2fd;
          border-color: #2196f3;
        }

        .thumbnail-grid {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .thumbnail-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .thumbnail-item {
          cursor: pointer;
          border: 2px solid transparent;
          border-radius: 4px;
          padding: 5px;
          transition: border-color 0.2s;
        }

        .thumbnail-item:hover {
          border-color: #ddd;
        }

        .thumbnail-item.selected {
          border-color: #2196f3;
        }

        .thumbnail-image {
          width: 60px;
          height: 60px;
          object-fit: cover;
          border-radius: 4px;
        }

        .thumbnail-info {
          font-size: 10px;
          text-align: center;
          margin-top: 2px;
        }

        .control-group, .setting-group {
          margin-bottom: 15px;
        }

        .control-group label, .setting-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
        }

        .control-group input, .control-group select,
        .setting-group input, .setting-group select {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }

        .overlay-item {
          background: #f8f9fa;
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 10px;
        }

        .overlay-text {
          font-size: 14px;
          margin-bottom: 5px;
        }

        .overlay-meta {
          font-size: 12px;
          color: #666;
          margin-bottom: 10px;
        }

        .job-item {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 4px;
          margin-bottom: 10px;
        }

        .job-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .job-status {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
        }

        .job-status.pending {
          background: #fff3cd;
          color: #856404;
        }

        .job-status.processing {
          background: #cce5ff;
          color: #004085;
        }

        .job-status.completed {
          background: #d4edda;
          color: #155724;
        }

        .job-status.failed {
          background: #f8d7da;
          color: #721c24;
        }

        .progress-bar {
          background: #e9ecef;
          height: 8px;
          border-radius: 4px;
          overflow: hidden;
          flex: 1;
          margin-right: 10px;
        }

        .progress-fill {
          background: #28a745;
          height: 100%;
          transition: width 0.3s ease;
        }

        .job-progress {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .ohif-viewer {
          border: 1px solid #ddd;
          border-radius: 4px;
        }

        .loading-spinner {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 200px;
          font-size: 18px;
          color: #666;
        }

        .error-message {
          text-align: center;
          padding: 40px;
          color: #721c24;
          background: #f8d7da;
          border-radius: 4px;
        }

        button {
          background: #007bff;
          color: white;
          border: none;
          padding: 10px 15px;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        button:hover {
          background: #0056b3;
        }

        button:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default PACSViewer;