/**
 * OHIF Viewer React Component for WebQX™ Integration
 * 
 * Main viewer component that embeds OHIF with WebQX™ features including
 * RBAC, multilingual support, custom workflows, and performance optimization.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  WebQXUser, 
  WebQXStudyMetadata, 
  ImagingWorkflow, 
  UIConfiguration,
  StudyAnnotation,
  PerformanceMetrics 
} from '../../types';
import { ImagingAPI } from '../../services/imagingApi';
import { ImagingRBAC } from '../../auth/rbac';
import { t, formatDICOMDate, formatDICOMTime } from '../../i18n';

interface OHIFViewerProps {
  studyInstanceUID: string;
  seriesInstanceUID?: string;
  user: WebQXUser;
  workflow?: string;
  language?: string;
  theme?: 'light' | 'dark';
  onStudyLoad?: (study: WebQXStudyMetadata) => void;
  onAnnotationSave?: (annotation: StudyAnnotation) => void;
  onError?: (error: Error) => void;
  configuration?: Partial<UIConfiguration>;
}

interface ViewerState {
  study: WebQXStudyMetadata | null;
  currentSeries: string | null;
  currentImage: number;
  isLoading: boolean;
  error: string | null;
  annotations: StudyAnnotation[];
  workflow: ImagingWorkflow | null;
  metrics: PerformanceMetrics | null;
}

export const OHIFViewer: React.FC<OHIFViewerProps> = ({
  studyInstanceUID,
  seriesInstanceUID,
  user,
  workflow: workflowId,
  language = 'en',
  theme = 'dark',
  onStudyLoad,
  onAnnotationSave,
  onError,
  configuration
}) => {
  const [state, setState] = useState<ViewerState>({
    study: null,
    currentSeries: seriesInstanceUID || null,
    currentImage: 0,
    isLoading: true,
    error: null,
    annotations: [],
    workflow: null,
    metrics: null
  });

  const viewerRef = useRef<HTMLDivElement>(null);
  const imagingAPI = useRef<ImagingAPI | null>(null);
  const rbac = useRef<ImagingRBAC | null>(null);

  // Initialize services
  useEffect(() => {
    imagingAPI.current = new ImagingAPI({
      dicomBaseUrl: process.env.REACT_APP_DICOM_URL || 'http://localhost:8080/dcm4chee-arc',
      enablePerformanceOptimization: true,
      cacheSize: 1024
    });

    rbac.current = new ImagingRBAC();
  }, []);

  // Load study data
  useEffect(() => {
    if (!imagingAPI.current || !rbac.current) return;

    const loadStudy = async () => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await imagingAPI.current!.getStudy(studyInstanceUID, user, {
          includeAnnotations: true,
          prefetchSeries: true,
          workflow: workflowId
        });

        if (!response.success) {
          throw new Error(response.error?.message || 'Failed to load study');
        }

        const study = response.data!;

        // Check access permissions
        if (!rbac.current!.canAccessStudy(user, study)) {
          throw new Error(t('study.accessDenied', language, 'imaging'));
        }

        setState(prev => ({
          ...prev,
          study,
          isLoading: false,
          annotations: study.annotations || [],
          currentSeries: seriesInstanceUID || (study.series?.[0]?.seriesInstanceUID)
        }));

        onStudyLoad?.(study);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setState(prev => ({ ...prev, error: errorMessage, isLoading: false }));
        onError?.(error instanceof Error ? error : new Error(errorMessage));
      }
    };

    loadStudy();
  }, [studyInstanceUID, user, workflowId, language, onStudyLoad, onError, seriesInstanceUID]);

  // Update performance metrics
  useEffect(() => {
    if (!imagingAPI.current) return;

    const updateMetrics = () => {
      const metrics = imagingAPI.current!.getPerformanceMetrics();
      setState(prev => ({ ...prev, metrics }));
    };

    const interval = setInterval(updateMetrics, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  // Handle annotation save
  const handleAnnotationSave = useCallback(async (annotation: Omit<StudyAnnotation, 'id' | 'timestamp'>) => {
    if (!imagingAPI.current || !rbac.current) return;

    try {
      // Check permission
      if (!rbac.current.hasPermission(user, 'annotate_images')) {
        throw new Error(t('errors.auth.accessDenied', language, 'errors'));
      }

      const response = await imagingAPI.current.saveAnnotation(studyInstanceUID, annotation, user);

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to save annotation');
      }

      const savedAnnotation = response.data!;
      setState(prev => ({
        ...prev,
        annotations: [...prev.annotations, savedAnnotation]
      }));

      onAnnotationSave?.(savedAnnotation);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save annotation';
      setState(prev => ({ ...prev, error: errorMessage }));
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  }, [user, studyInstanceUID, language, onAnnotationSave, onError]);

  // Handle series change
  const handleSeriesChange = useCallback(async (newSeriesInstanceUID: string) => {
    if (!imagingAPI.current) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const response = await imagingAPI.current.getSeries(
        studyInstanceUID,
        newSeriesInstanceUID,
        user,
        { preloadImages: true }
      );

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to load series');
      }

      setState(prev => ({
        ...prev,
        currentSeries: newSeriesInstanceUID,
        currentImage: 0,
        isLoading: false
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load series';
      setState(prev => ({ ...prev, error: errorMessage, isLoading: false }));
    }
  }, [studyInstanceUID, user]);

  // Render loading state
  if (state.isLoading) {
    return (
      <div className="ohif-viewer-loading">
        <div className="loading-spinner" />
        <p>{t('study.loading', language, 'imaging')}</p>
      </div>
    );
  }

  // Render error state
  if (state.error) {
    return (
      <div className="ohif-viewer-error">
        <div className="error-icon">⚠️</div>
        <p>{state.error}</p>
        <button onClick={() => window.location.reload()}>
          {t('button.retry', language, 'ui')}
        </button>
      </div>
    );
  }

  // Render main viewer
  return (
    <div className={`ohif-viewer ohif-viewer--${theme}`} ref={viewerRef}>
      {/* Header */}
      <ViewerHeader 
        study={state.study}
        user={user}
        language={language}
        metrics={state.metrics}
      />

      {/* Main viewport area */}
      <div className="ohif-viewer__main">
        {/* Left panel - Study browser */}
        <ViewerStudyPanel 
          study={state.study}
          currentSeries={state.currentSeries}
          onSeriesChange={handleSeriesChange}
          language={language}
        />

        {/* Center - Image viewport */}
        <ViewerViewport 
          study={state.study}
          currentSeries={state.currentSeries}
          currentImage={state.currentImage}
          annotations={state.annotations}
          user={user}
          language={language}
          onAnnotationSave={handleAnnotationSave}
        />

        {/* Right panel - Tools and annotations */}
        <ViewerToolPanel 
          user={user}
          annotations={state.annotations}
          workflow={state.workflow}
          language={language}
          onAnnotationSave={handleAnnotationSave}
        />
      </div>

      {/* Footer - Status and controls */}
      <ViewerFooter 
        currentImage={state.currentImage}
        totalImages={state.study?.series?.find(s => s.seriesInstanceUID === state.currentSeries)?.images?.length || 0}
        language={language}
      />
    </div>
  );
};

// Sub-components

interface ViewerHeaderProps {
  study: WebQXStudyMetadata | null;
  user: WebQXUser;
  language: string;
  metrics: PerformanceMetrics | null;
}

const ViewerHeader: React.FC<ViewerHeaderProps> = ({ study, user, language, metrics }) => {
  return (
    <div className="ohif-viewer__header">
      <div className="header__left">
        <h1>{t('viewer.title', language, 'imaging')}</h1>
        {study && (
          <div className="study-info">
            <span className="patient-name">{study.patientName}</span>
            <span className="study-date">{formatDICOMDate(study.studyDate, language)}</span>
            <span className="study-description">{study.studyDescription}</span>
          </div>
        )}
      </div>
      <div className="header__right">
        <div className="user-info">
          <span className="user-role">{t(`role.${user.role}`, language, 'clinical')}</span>
          <span className="user-specialty">{user.specialty && t(`specialty.${user.specialty}`, language, 'clinical')}</span>
        </div>
        {metrics && (
          <div className="performance-metrics">
            <span title="Cache Hit Rate">{Math.round(metrics.cacheHitRate * 100)}%</span>
            <span title="Memory Usage">{Math.round(metrics.memoryUsage)}MB</span>
          </div>
        )}
      </div>
    </div>
  );
};

interface ViewerStudyPanelProps {
  study: WebQXStudyMetadata | null;
  currentSeries: string | null;
  onSeriesChange: (seriesInstanceUID: string) => void;
  language: string;
}

const ViewerStudyPanel: React.FC<ViewerStudyPanelProps> = ({ 
  study, 
  currentSeries, 
  onSeriesChange, 
  language 
}) => {
  if (!study) return null;

  return (
    <div className="ohif-viewer__study-panel">
      <h3>{t('study.series', language, 'imaging')}</h3>
      <div className="series-list">
        {study.series?.map((series) => (
          <div 
            key={series.seriesInstanceUID}
            className={`series-item ${series.seriesInstanceUID === currentSeries ? 'active' : ''}`}
            onClick={() => onSeriesChange(series.seriesInstanceUID)}
          >
            <div className="series-thumbnail">
              {/* Placeholder for series thumbnail */}
              <div className="thumbnail-placeholder" />
            </div>
            <div className="series-details">
              <div className="series-number">{t('series.number', language, 'dicom')}: {series.seriesNumber}</div>
              <div className="series-description">{series.seriesDescription}</div>
              <div className="series-modality">{t(`modality.${series.modality}`, language, 'dicom')}</div>
              <div className="series-images">{series.images?.length || 0} images</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface ViewerViewportProps {
  study: WebQXStudyMetadata | null;
  currentSeries: string | null;
  currentImage: number;
  annotations: StudyAnnotation[];
  user: WebQXUser;
  language: string;
  onAnnotationSave: (annotation: Omit<StudyAnnotation, 'id' | 'timestamp'>) => void;
}

const ViewerViewport: React.FC<ViewerViewportProps> = ({ 
  study, 
  currentSeries, 
  currentImage, 
  annotations, 
  user, 
  language, 
  onAnnotationSave 
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);

  // Initialize OHIF viewer in the viewport
  useEffect(() => {
    if (!viewportRef.current || !study || !currentSeries) return;

    // Mock OHIF initialization - in real implementation, this would
    // initialize the actual OHIF viewer with the study data
    const initializeOHIF = () => {
      // Placeholder for OHIF viewer initialization
      if (viewportRef.current) {
        viewportRef.current.innerHTML = `
          <div class="mock-ohif-viewport">
            <div class="viewport-header">
              <span>Series: ${currentSeries}</span>
              <span>Image: ${currentImage + 1}</span>
            </div>
            <div class="viewport-canvas">
              <div class="mock-dicom-image">
                <p>DICOM Image Placeholder</p>
                <p>Study: ${study.studyInstanceUID}</p>
                <p>Series: ${currentSeries}</p>
                <p>User: ${user.role}</p>
              </div>
            </div>
            <div class="viewport-tools">
              <button onclick="window.ohifZoom?.()">Zoom</button>
              <button onclick="window.ohifPan?.()">Pan</button>
              <button onclick="window.ohifMeasure?.()">Measure</button>
            </div>
          </div>
        `;
      }
    };

    initializeOHIF();
  }, [study, currentSeries, currentImage, user]);

  return (
    <div className="ohif-viewer__viewport">
      <div ref={viewportRef} className="viewport-container" />
      {annotations.length > 0 && (
        <div className="annotations-overlay">
          {annotations.map((annotation) => (
            <div 
              key={annotation.id}
              className="annotation-marker"
              style={{
                left: annotation.content.coordinates[0],
                top: annotation.content.coordinates[1]
              }}
              title={annotation.content.text}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface ViewerToolPanelProps {
  user: WebQXUser;
  annotations: StudyAnnotation[];
  workflow: ImagingWorkflow | null;
  language: string;
  onAnnotationSave: (annotation: Omit<StudyAnnotation, 'id' | 'timestamp'>) => void;
}

const ViewerToolPanel: React.FC<ViewerToolPanelProps> = ({ 
  user, 
  annotations, 
  workflow, 
  language, 
  onAnnotationSave 
}) => {
  const [activeTab, setActiveTab] = useState<'tools' | 'annotations'>('tools');

  const handleAnnotationAdd = () => {
    const annotation: Omit<StudyAnnotation, 'id' | 'timestamp'> = {
      type: 'text',
      authorId: user.id,
      authorRole: user.role,
      content: {
        text: 'New annotation',
        coordinates: [100, 100],
        style: {
          color: '#ff0000',
          thickness: 2,
          opacity: 0.8
        }
      },
      visibility: 'public'
    };
    onAnnotationSave(annotation);
  };

  return (
    <div className="ohif-viewer__tool-panel">
      <div className="panel-tabs">
        <button 
          className={activeTab === 'tools' ? 'active' : ''}
          onClick={() => setActiveTab('tools')}
        >
          {t('menu.tools', language, 'ui')}
        </button>
        <button 
          className={activeTab === 'annotations' ? 'active' : ''}
          onClick={() => setActiveTab('annotations')}
        >
          {t('annotations', language, 'imaging')}
        </button>
      </div>

      {activeTab === 'tools' && (
        <div className="tools-tab">
          <div className="tool-group">
            <h4>{t('tools.navigation', language, 'tools')}</h4>
            <button className="tool-button">{t('tool.zoom', language, 'imaging')}</button>
            <button className="tool-button">{t('tool.pan', language, 'imaging')}</button>
            <button className="tool-button">{t('tool.windowLevel', language, 'imaging')}</button>
          </div>
          
          {user.permissions.includes('measure_images') && (
            <div className="tool-group">
              <h4>{t('tools.measurement', language, 'tools')}</h4>
              <button className="tool-button">{t('measurement.length', language, 'imaging')}</button>
              <button className="tool-button">{t('measurement.area', language, 'imaging')}</button>
              <button className="tool-button">{t('measurement.angle', language, 'imaging')}</button>
            </div>
          )}

          {user.permissions.includes('annotate_images') && (
            <div className="tool-group">
              <h4>{t('tools.annotation', language, 'tools')}</h4>
              <button className="tool-button" onClick={handleAnnotationAdd}>
                {t('annotation.text', language, 'tools')}
              </button>
              <button className="tool-button">{t('annotation.arrow', language, 'tools')}</button>
              <button className="tool-button">{t('annotation.circle', language, 'tools')}</button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'annotations' && (
        <div className="annotations-tab">
          <div className="annotations-list">
            {annotations.map((annotation) => (
              <div key={annotation.id} className="annotation-item">
                <div className="annotation-type">{annotation.type}</div>
                <div className="annotation-text">{annotation.content.text}</div>
                <div className="annotation-author">
                  {t(`role.${annotation.authorRole}`, language, 'clinical')}
                </div>
                <div className="annotation-timestamp">
                  {formatDICOMTime(annotation.timestamp.toISOString(), language)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface ViewerFooterProps {
  currentImage: number;
  totalImages: number;
  language: string;
}

const ViewerFooter: React.FC<ViewerFooterProps> = ({ currentImage, totalImages, language }) => {
  return (
    <div className="ohif-viewer__footer">
      <div className="image-navigation">
        <button>{t('button.first', language, 'ui')}</button>
        <button>{t('button.previous', language, 'ui')}</button>
        <span className="image-counter">
          {currentImage + 1} / {totalImages}
        </span>
        <button>{t('button.next', language, 'ui')}</button>
        <button>{t('button.last', language, 'ui')}</button>
      </div>
      <div className="status-info">
        <span className="status">{t('status.ready', language, 'ui')}</span>
      </div>
    </div>
  );
};

// Export as default for backwards compatibility
export default OHIFViewer;