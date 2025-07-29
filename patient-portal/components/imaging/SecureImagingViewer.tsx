/**
 * @fileoverview Secure Imaging Viewer Component
 * 
 * OHIF-based imaging viewer with annotations disabled for patient portal.
 * Includes multilingual support and request-to-release flow for sensitive results.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

// Types for imaging viewer
export interface ImagingStudy {
  id: string;
  patientId: string;
  studyDate: string;
  modality: string;
  description: string;
  seriesCount: number;
  instanceCount: number;
  status: 'available' | 'pending_release' | 'restricted';
  sensitivity: 'normal' | 'sensitive' | 'confidential';
  thumbnailUrl?: string;
  viewerUrl?: string;
}

export interface ViewerConfig {
  enableAnnotations: boolean;
  enableMeasurements: boolean;
  enableCine: boolean;
  enableWindowLevel: boolean;
  enablePan: boolean;
  enableZoom: boolean;
  enableRotate: boolean;
  enableFullscreen: boolean;
}

export interface ReleaseRequest {
  studyId: string;
  requestReason: string;
  urgency: 'routine' | 'urgent' | 'emergency';
  requestedBy: string;
  timestamp: Date;
}

interface SecureImagingViewerProps {
  studyId: string;
  patientId: string;
  onReleaseRequest?: (request: ReleaseRequest) => void;
  onViewerLoad?: () => void;
  onViewerError?: (error: Error) => void;
  className?: string;
}

/**
 * Default viewer configuration optimized for patient portal
 */
const DEFAULT_VIEWER_CONFIG: ViewerConfig = {
  enableAnnotations: false, // Disabled for patient portal
  enableMeasurements: false, // Disabled for patient portal
  enableCine: true,
  enableWindowLevel: true,
  enablePan: true,
  enableZoom: true,
  enableRotate: true,
  enableFullscreen: true,
};

/**
 * SecureImagingViewer component provides OHIF-based image viewing
 * with patient-appropriate restrictions and request-to-release flow
 */
export const SecureImagingViewer: React.FC<SecureImagingViewerProps> = ({
  studyId,
  patientId,
  onReleaseRequest,
  onViewerLoad,
  onViewerError,
  className = '',
}) => {
  const { t } = useTranslation();
  
  // Component state
  const [study, setStudy] = useState<ImagingStudy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReleaseRequest, setShowReleaseRequest] = useState(false);
  const [releaseRequestReason, setReleaseRequestReason] = useState('');
  const [releaseRequestUrgency, setReleaseRequestUrgency] = useState<'routine' | 'urgent' | 'emergency'>('routine');
  const [viewerLoaded, setViewerLoaded] = useState(false);

  /**
   * Load study information from API
   */
  const loadStudy = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/imaging/studies/${studyId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load study: ${response.statusText}`);
      }

      const studyData: ImagingStudy = await response.json();
      setStudy(studyData);

      // Load viewer if study is available
      if (studyData.status === 'available' && studyData.viewerUrl) {
        loadOHIFViewer(studyData.viewerUrl);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      onViewerError?.(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setIsLoading(false);
    }
  }, [studyId, onViewerError]);

  /**
   * Load OHIF viewer in iframe with patient-safe configuration
   */
  const loadOHIFViewer = useCallback(async (viewerUrl: string) => {
    try {
      // Configure OHIF for patient portal use
      const config = {
        ...DEFAULT_VIEWER_CONFIG,
        studyInstanceUIDs: [studyId],
        patientMode: true, // Custom flag for patient portal restrictions
      };

      // Build viewer URL with configuration
      const configuredUrl = new URL(viewerUrl);
      configuredUrl.searchParams.set('config', JSON.stringify(config));
      configuredUrl.searchParams.set('patientMode', 'true');

      // Update iframe src
      const iframe = document.getElementById('ohif-viewer') as HTMLIFrameElement;
      if (iframe) {
        iframe.src = configuredUrl.toString();
        iframe.onload = () => {
          setViewerLoaded(true);
          onViewerLoad?.();
        };
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load viewer';
      setError(errorMessage);
      onViewerError?.(err instanceof Error ? err : new Error(errorMessage));
    }
  }, [studyId, onViewerLoad, onViewerError]);

  /**
   * Handle release request submission
   */
  const handleReleaseRequest = useCallback(async () => {
    if (!study || !releaseRequestReason.trim()) {
      return;
    }

    try {
      const request: ReleaseRequest = {
        studyId: study.id,
        requestReason: releaseRequestReason.trim(),
        urgency: releaseRequestUrgency,
        requestedBy: patientId,
        timestamp: new Date(),
      };

      // Submit request via API
      const response = await fetch('/api/imaging/release-requests', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Failed to submit release request: ${response.statusText}`);
      }

      // Notify parent component
      onReleaseRequest?.(request);

      // Reset form and close modal
      setReleaseRequestReason('');
      setReleaseRequestUrgency('routine');
      setShowReleaseRequest(false);

      // Show success message
      alert(t('imaging.release_request_submitted'));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit request';
      alert(t('imaging.release_request_error', { error: errorMessage }));
    }
  }, [study, releaseRequestReason, releaseRequestUrgency, patientId, onReleaseRequest, t]);

  // Load study on mount
  useEffect(() => {
    loadStudy();
  }, [loadStudy]);

  // Render loading state
  if (isLoading) {
    return (
      <div className={`imaging-viewer-loading ${className}`}>
        <div className="loading-spinner" />
        <p>{t('imaging.loading_study')}</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={`imaging-viewer-error ${className}`}>
        <div className="error-icon">⚠️</div>
        <h3>{t('imaging.error_title')}</h3>
        <p>{error}</p>
        <button onClick={loadStudy} className="retry-button">
          {t('common.retry')}
        </button>
      </div>
    );
  }

  // Render study not found
  if (!study) {
    return (
      <div className={`imaging-viewer-empty ${className}`}>
        <div className="empty-icon">📋</div>
        <h3>{t('imaging.study_not_found')}</h3>
        <p>{t('imaging.study_not_found_description')}</p>
      </div>
    );
  }

  // Render restricted study with request option
  if (study.status === 'pending_release' || study.status === 'restricted') {
    return (
      <div className={`imaging-viewer-restricted ${className}`}>
        <div className="restriction-notice">
          <div className="restriction-icon">🔒</div>
          <h3>{t('imaging.restricted_access_title')}</h3>
          <p>{t('imaging.restricted_access_description')}</p>
          
          <div className="study-info">
            <h4>{study.description}</h4>
            <p>{t('imaging.study_date')}: {new Date(study.studyDate).toLocaleDateString()}</p>
            <p>{t('imaging.modality')}: {study.modality}</p>
            {study.sensitivity !== 'normal' && (
              <p className="sensitivity-notice">
                {t('imaging.sensitivity')}: {t(`imaging.sensitivity_${study.sensitivity}`)}
              </p>
            )}
          </div>

          <button 
            onClick={() => setShowReleaseRequest(true)}
            className="request-release-button"
          >
            {t('imaging.request_access')}
          </button>
        </div>

        {/* Release Request Modal */}
        {showReleaseRequest && (
          <div className="release-request-modal">
            <div className="modal-content">
              <h3>{t('imaging.request_access_title')}</h3>
              
              <div className="form-group">
                <label htmlFor="reason">{t('imaging.request_reason')}</label>
                <textarea
                  id="reason"
                  value={releaseRequestReason}
                  onChange={(e) => setReleaseRequestReason(e.target.value)}
                  placeholder={t('imaging.request_reason_placeholder')}
                  rows={4}
                />
              </div>

              <div className="form-group">
                <label htmlFor="urgency">{t('imaging.request_urgency')}</label>
                <select
                  id="urgency"
                  value={releaseRequestUrgency}
                  onChange={(e) => setReleaseRequestUrgency(e.target.value as 'routine' | 'urgent' | 'emergency')}
                >
                  <option value="routine">{t('imaging.urgency_routine')}</option>
                  <option value="urgent">{t('imaging.urgency_urgent')}</option>
                  <option value="emergency">{t('imaging.urgency_emergency')}</option>
                </select>
              </div>

              <div className="modal-actions">
                <button 
                  onClick={() => setShowReleaseRequest(false)}
                  className="cancel-button"
                >
                  {t('common.cancel')}
                </button>
                <button 
                  onClick={handleReleaseRequest}
                  disabled={!releaseRequestReason.trim()}
                  className="submit-button"
                >
                  {t('imaging.submit_request')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render available study with OHIF viewer
  return (
    <div className={`imaging-viewer-container ${className}`}>
      <div className="viewer-header">
        <h3>{study.description}</h3>
        <div className="study-metadata">
          <span>{t('imaging.study_date')}: {new Date(study.studyDate).toLocaleDateString()}</span>
          <span>{t('imaging.modality')}: {study.modality}</span>
          <span>{t('imaging.series_count')}: {study.seriesCount}</span>
        </div>
      </div>

      <div className="viewer-content">
        <iframe
          id="ohif-viewer"
          title={t('imaging.viewer_title')}
          width="100%"
          height="600px"
          frameBorder="0"
          sandbox="allow-scripts allow-same-origin allow-popups"
          style={{
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            backgroundColor: '#000000',
          }}
        />
        
        {!viewerLoaded && (
          <div className="viewer-loading-overlay">
            <div className="loading-spinner" />
            <p>{t('imaging.loading_viewer')}</p>
          </div>
        )}
      </div>

      <div className="viewer-footer">
        <p className="disclaimer">
          {t('imaging.patient_viewer_disclaimer')}
        </p>
      </div>
    </div>
  );
};

export default SecureImagingViewer;