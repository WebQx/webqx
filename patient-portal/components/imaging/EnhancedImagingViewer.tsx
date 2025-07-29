/**
 * @fileoverview Enhanced Patient Portal Imaging Component
 * 
 * Example integration of the new PACS shared viewers with the existing
 * patient portal imaging component.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PatientViewer } from '../../../PACS/shared/viewers';
import { ImagingStudy } from './SecureImagingViewer';
import '../../../PACS/shared/viewers/styles.css';

interface EnhancedImagingViewerProps {
  studyId: string;
  patientId: string;
  onViewComplete?: () => void;
  onError?: (error: Error) => void;
  className?: string;
}

/**
 * Enhanced imaging viewer that integrates the new PACS shared components
 * with the existing patient portal infrastructure
 */
export const EnhancedImagingViewer: React.FC<EnhancedImagingViewerProps> = ({
  studyId,
  patientId,
  onViewComplete,
  onError,
  className = '',
}) => {
  const { t } = useTranslation();
  const [study, setStudy] = useState<ImagingStudy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load study information to check availability and permissions
   */
  const loadStudyInfo = useCallback(async () => {
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setIsLoading(false);
    }
  }, [studyId, onError]);

  /**
   * Handle viewing completion
   */
  const handleViewComplete = useCallback(() => {
    // Log viewing completion
    console.log(`Patient ${patientId} completed viewing study ${studyId}`);
    onViewComplete?.();
  }, [patientId, studyId, onViewComplete]);

  /**
   * Handle viewer errors
   */
  const handleViewerError = useCallback((error: Error) => {
    console.error('PACS viewer error:', error);
    setError(error.message);
    onError?.(error);
  }, [onError]);

  // Load study info on mount
  React.useEffect(() => {
    loadStudyInfo();
  }, [loadStudyInfo]);

  // Render loading state
  if (isLoading) {
    return (
      <div className={`enhanced-imaging-viewer loading ${className}`}>
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>{t('imaging.loading_study')}</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={`enhanced-imaging-viewer error ${className}`}>
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h3>{t('imaging.error_title')}</h3>
          <p>{error}</p>
          <button onClick={loadStudyInfo} className="retry-button">
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  // Render study not found
  if (!study) {
    return (
      <div className={`enhanced-imaging-viewer empty ${className}`}>
        <div className="empty-container">
          <div className="empty-icon">📋</div>
          <h3>{t('imaging.study_not_found')}</h3>
          <p>{t('imaging.study_not_found_description')}</p>
        </div>
      </div>
    );
  }

  // Check if study is available for viewing
  if (study.status !== 'available') {
    return (
      <div className={`enhanced-imaging-viewer restricted ${className}`}>
        <div className="restriction-notice">
          <div className="restriction-icon">🔒</div>
          <h3>{t('imaging.restricted_access_title')}</h3>
          <p>{t('imaging.restricted_access_description')}</p>
          
          <div className="study-info">
            <h4>{study.description}</h4>
            <p>{t('imaging.study_date')}: {new Date(study.studyDate).toLocaleDateString()}</p>
            <p>{t('imaging.modality')}: {study.modality}</p>
          </div>

          <div className="status-message">
            <p>{t(`imaging.status_${study.status}`)}</p>
          </div>
        </div>
      </div>
    );
  }

  // Render the enhanced patient viewer
  return (
    <div className={`enhanced-imaging-viewer ${className}`}>
      <div className="viewer-header">
        <div className="study-summary">
          <h3>{study.description}</h3>
          <div className="study-metadata">
            <span>{t('imaging.study_date')}: {new Date(study.studyDate).toLocaleDateString()}</span>
            <span>{t('imaging.modality')}: {study.modality}</span>
            <span>{t('imaging.series_count')}: {study.seriesCount}</span>
          </div>
        </div>
      </div>

      <div className="viewer-content">
        <PatientViewer
          studyInstanceUID={studyId}
          onViewComplete={handleViewComplete}
          onError={handleViewerError}
          className="patient-dicom-viewer"
        />
      </div>

      <div className="viewer-footer">
        <div className="patient-guidance">
          <h4>{t('imaging.viewing_guidance')}</h4>
          <ul>
            <li>{t('imaging.guidance_zoom')}</li>
            <li>{t('imaging.guidance_navigate')}</li>
            <li>{t('imaging.guidance_questions')}</li>
          </ul>
        </div>
        
        <div className="important-notice">
          <p>{t('imaging.patient_viewer_disclaimer')}</p>
        </div>
      </div>
    </div>
  );
};

export default EnhancedImagingViewer;