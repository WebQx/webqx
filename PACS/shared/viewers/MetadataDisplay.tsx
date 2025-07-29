/**
 * @fileoverview DICOM Metadata Display Component
 * 
 * Component for displaying DICOM metadata in a structured format.
 * Supports both compact and detailed views with read-only mode.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { DicomMetadata, MetadataDisplayProps } from './types';

export const MetadataDisplay: React.FC<MetadataDisplayProps> = ({
  metadata,
  compact = false,
  readOnly = false,
  className = '',
}) => {
  const { t } = useTranslation();

  const formatDate = (dateStr: string) => {
    try {
      // DICOM date format: YYYYMMDD
      if (dateStr.length === 8) {
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        return new Date(`${year}-${month}-${day}`).toLocaleDateString();
      }
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '';
    try {
      // DICOM time format: HHMMSS.FFFFFF
      if (timeStr.length >= 6) {
        const hour = timeStr.substring(0, 2);
        const minute = timeStr.substring(2, 4);
        const second = timeStr.substring(4, 6);
        return `${hour}:${minute}:${second}`;
      }
      return timeStr;
    } catch {
      return timeStr;
    }
  };

  const renderPatientInfo = () => (
    <div className="metadata-section patient-info">
      <h4>{t('imaging.patient_information')}</h4>
      <div className="metadata-grid">
        <div className="metadata-item">
          <label>{t('imaging.patient_name')}:</label>
          <span>{metadata.patientName || t('common.not_available')}</span>
        </div>
        <div className="metadata-item">
          <label>{t('imaging.patient_id')}:</label>
          <span>{metadata.patientId || t('common.not_available')}</span>
        </div>
      </div>
    </div>
  );

  const renderStudyInfo = () => (
    <div className="metadata-section study-info">
      <h4>{t('imaging.study_information')}</h4>
      <div className="metadata-grid">
        <div className="metadata-item">
          <label>{t('imaging.study_date')}:</label>
          <span>{formatDate(metadata.studyDate)}</span>
        </div>
        {metadata.studyTime && (
          <div className="metadata-item">
            <label>{t('imaging.study_time')}:</label>
            <span>{formatTime(metadata.studyTime)}</span>
          </div>
        )}
        <div className="metadata-item">
          <label>{t('imaging.modality')}:</label>
          <span>{metadata.modality}</span>
        </div>
        <div className="metadata-item">
          <label>{t('imaging.study_description')}:</label>
          <span>{metadata.studyDescription || t('common.not_available')}</span>
        </div>
        <div className="metadata-item">
          <label>{t('imaging.series_description')}:</label>
          <span>{metadata.seriesDescription || t('common.not_available')}</span>
        </div>
      </div>
    </div>
  );

  const renderInstitutionInfo = () => (
    <div className="metadata-section institution-info">
      <h4>{t('imaging.institution_information')}</h4>
      <div className="metadata-grid">
        {metadata.institutionName && (
          <div className="metadata-item">
            <label>{t('imaging.institution_name')}:</label>
            <span>{metadata.institutionName}</span>
          </div>
        )}
        {metadata.physicianName && (
          <div className="metadata-item">
            <label>{t('imaging.physician_name')}:</label>
            <span>{metadata.physicianName}</span>
          </div>
        )}
      </div>
    </div>
  );

  const renderImageInfo = () => (
    <div className="metadata-section image-info">
      <h4>{t('imaging.image_information')}</h4>
      <div className="metadata-grid">
        {metadata.rows && metadata.columns && (
          <div className="metadata-item">
            <label>{t('imaging.image_size')}:</label>
            <span>{metadata.columns} × {metadata.rows}</span>
          </div>
        )}
        {metadata.pixelSpacing && (
          <div className="metadata-item">
            <label>{t('imaging.pixel_spacing')}:</label>
            <span>{metadata.pixelSpacing[0].toFixed(3)} × {metadata.pixelSpacing[1].toFixed(3)} mm</span>
          </div>
        )}
        {metadata.sliceThickness && (
          <div className="metadata-item">
            <label>{t('imaging.slice_thickness')}:</label>
            <span>{metadata.sliceThickness} mm</span>
          </div>
        )}
        {metadata.windowCenter && metadata.windowWidth && (
          <div className="metadata-item">
            <label>{t('imaging.window_level')}:</label>
            <span>C: {metadata.windowCenter}, W: {metadata.windowWidth}</span>
          </div>
        )}
        {metadata.bitsAllocated && (
          <div className="metadata-item">
            <label>{t('imaging.bits_allocated')}:</label>
            <span>{metadata.bitsAllocated}</span>
          </div>
        )}
        {metadata.photometricInterpretation && (
          <div className="metadata-item">
            <label>{t('imaging.photometric_interpretation')}:</label>
            <span>{metadata.photometricInterpretation}</span>
          </div>
        )}
      </div>
    </div>
  );

  const renderCompactView = () => (
    <div className="metadata-compact">
      <div className="compact-row">
        <strong>{metadata.patientName}</strong> • {metadata.patientId}
      </div>
      <div className="compact-row">
        {formatDate(metadata.studyDate)} • {metadata.modality} • {metadata.studyDescription}
      </div>
      {metadata.seriesDescription && (
        <div className="compact-row">
          {metadata.seriesDescription}
        </div>
      )}
    </div>
  );

  if (compact) {
    return (
      <div className={`metadata-display metadata-compact ${className}`}>
        {renderCompactView()}
      </div>
    );
  }

  return (
    <div className={`metadata-display ${readOnly ? 'read-only' : ''} ${className}`}>
      <div className="metadata-header">
        <h3>{t('imaging.dicom_metadata')}</h3>
        {readOnly && (
          <span className="read-only-indicator">
            🔒 {t('imaging.read_only')}
          </span>
        )}
      </div>

      <div className="metadata-content">
        {renderPatientInfo()}
        {renderStudyInfo()}
        {renderInstitutionInfo()}
        {renderImageInfo()}
      </div>
    </div>
  );
};

export default MetadataDisplay;