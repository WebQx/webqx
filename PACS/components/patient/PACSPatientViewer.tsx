/**
 * PACS Patient Viewer Component
 * 
 * React component for patient-facing PACS interface.
 * Provides secure access to patient's medical imaging studies with educational features.
 */

import React, { useState, useEffect } from 'react';
import { 
  DICOMStudy, 
  ImagingSession, 
  PatientImagingAccess,
  ImagingReport
} from '../../types';
import { PACSService } from '../../services/pacsService';
import { ImagingWorkflowService } from '../../services/imagingWorkflowService';

interface PACSPatientViewerProps {
  patientID: string;
  className?: string;
  enableEducationalContent?: boolean;
  enableDownload?: boolean;
  enableSharing?: boolean;
}

export const PACSPatientViewer: React.FC<PACSPatientViewerProps> = ({
  patientID,
  className = '',
  enableEducationalContent = true,
  enableDownload = false,
  enableSharing = false
}) => {
  const [studies, setStudies] = useState<DICOMStudy[]>([]);
  const [selectedStudy, setSelectedStudy] = useState<DICOMStudy | null>(null);
  const [session, setSession] = useState<ImagingSession | null>(null);
  const [reports, setReports] = useState<ImagingReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEducationalContent, setShowEducationalContent] = useState(false);

  const pacsService = new PACSService();
  const workflowService = new ImagingWorkflowService(pacsService);

  useEffect(() => {
    loadPatientStudies();
  }, [patientID]);

  const loadPatientStudies = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await workflowService.getPatientAccessibleStudies(patientID);
      if (result.success && result.data) {
        setStudies(result.data);
        
        // Load reports for each study
        const allReports: ImagingReport[] = [];
        for (const study of result.data) {
          const reportsResult = await workflowService.getReportsByStudy(study.studyInstanceUID);
          if (reportsResult.success && reportsResult.data) {
            allReports.push(...reportsResult.data);
          }
        }
        setReports(allReports);
      } else {
        setError(result.error?.message || 'Failed to load studies');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load patient studies');
    } finally {
      setLoading(false);
    }
  };

  const handleStudySelect = async (study: DICOMStudy) => {
    try {
      setSelectedStudy(study);
      
      // Create patient session for viewing
      const sessionResult = await pacsService.createPatientSession(
        patientID, 
        study.studyInstanceUID, 
        'view'
      );
      
      if (sessionResult.success && sessionResult.data) {
        setSession(sessionResult.data);
      } else {
        setError(sessionResult.error?.message || 'Failed to create viewing session');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open study');
    }
  };

  const handleViewInViewer = () => {
    if (selectedStudy && session) {
      const viewerUrl = pacsService.getViewerURL(selectedStudy.studyInstanceUID, session.sessionID);
      window.open(viewerUrl, '_blank', 'width=1200,height=800');
    }
  };

  const getModalityDescription = (modality: string): string => {
    const descriptions: Record<string, string> = {
      'CT': 'Computed Tomography (CT) Scan',
      'MR': 'Magnetic Resonance Imaging (MRI)',
      'XR': 'X-Ray',
      'US': 'Ultrasound',
      'MG': 'Mammography',
      'PT': 'Positron Emission Tomography (PET)',
      'NM': 'Nuclear Medicine',
      'RF': 'Radiofluoroscopy'
    };
    return descriptions[modality] || modality;
  };

  const getModalityExplanation = (modality: string): string => {
    const explanations: Record<string, string> = {
      'CT': 'CT scans use X-rays to create detailed cross-sectional images of your body. They can show bones, organs, and soft tissues clearly.',
      'MR': 'MRI uses powerful magnets and radio waves to create detailed images of organs and tissues without using radiation.',
      'XR': 'X-rays use small amounts of radiation to create images of bones and some soft tissues. They are commonly used to check for fractures.',
      'US': 'Ultrasound uses sound waves to create images of organs and tissues. It is safe and does not use radiation.',
      'MG': 'Mammography is a specialized X-ray examination of the breasts used for cancer screening and diagnosis.',
      'PT': 'PET scans use a small amount of radioactive material to show how organs and tissues are functioning.',
      'NM': 'Nuclear medicine uses small amounts of radioactive materials to diagnose and treat diseases.',
      'RF': 'Fluoroscopy uses X-rays to create real-time moving images of internal structures.'
    };
    return explanations[modality] || 'Specialized medical imaging technique.';
  };

  const getStudyReports = (studyUID: string): ImagingReport[] => {
    return reports.filter(report => report.studyInstanceUID === studyUID);
  };

  if (loading) {
    return (
      <div className={`pacs-patient-viewer loading ${className}`}>
        <div className="loading-message">
          <div className="spinner"></div>
          <p>Loading your medical images...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`pacs-patient-viewer ${className}`}>
      <div className="viewer-header">
        <h2>My Medical Images</h2>
        <p>Secure access to your imaging studies and reports</p>
      </div>

      {error && (
        <div className="error-message" role="alert">
          <strong>Error:</strong> {error}
          <button onClick={() => setError(null)} aria-label="Dismiss error">×</button>
        </div>
      )}

      <div className="viewer-content">
        {studies.length === 0 ? (
          <div className="no-studies">
            <div className="no-studies-icon">📋</div>
            <h3>No Imaging Studies Available</h3>
            <p>
              You currently don't have any medical imaging studies available for viewing. 
              If you believe this is an error, please contact your healthcare provider.
            </p>
          </div>
        ) : (
          <div className="studies-layout">
            <div className="studies-list">
              <h3>Available Studies ({studies.length})</h3>
              {studies.map(study => {
                const studyReports = getStudyReports(study.studyInstanceUID);
                const isSelected = selectedStudy?.studyInstanceUID === study.studyInstanceUID;
                
                return (
                  <div 
                    key={study.studyInstanceUID} 
                    className={`study-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleStudySelect(study)}
                  >
                    <div className="study-preview">
                      <div className="study-icon">
                        {study.modalities.includes('CT') && '🏥'}
                        {study.modalities.includes('MR') && '🧲'}
                        {study.modalities.includes('XR') && '🦴'}
                        {study.modalities.includes('US') && '〰️'}
                        {!['CT', 'MR', 'XR', 'US'].some(m => study.modalities.includes(m)) && '📸'}
                      </div>
                      <div className="study-info">
                        <h4>{study.studyDescription}</h4>
                        <p className="study-date">
                          {new Date(study.studyDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                        <p className="study-modalities">
                          {study.modalities.map(getModalityDescription).join(', ')}
                        </p>
                        <div className="study-stats">
                          <span>{study.numberOfSeries} series</span>
                          <span>{study.numberOfImages} images</span>
                        </div>
                        {studyReports.length > 0 && (
                          <div className="report-status">
                            <span className="report-icon">📄</span>
                            <span>{studyReports.length} report(s) available</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedStudy && (
              <div className="study-details">
                <div className="study-header">
                  <h3>{selectedStudy.studyDescription}</h3>
                  <div className="study-actions">
                    <button 
                      onClick={handleViewInViewer}
                      className="primary-button"
                      disabled={!session}
                    >
                      🔍 View Images
                    </button>
                    {enableEducationalContent && (
                      <button 
                        onClick={() => setShowEducationalContent(!showEducationalContent)}
                        className="secondary-button"
                      >
                        📚 Learn More
                      </button>
                    )}
                  </div>
                </div>

                <div className="study-metadata">
                  <div className="metadata-grid">
                    <div className="metadata-item">
                      <strong>Study Date:</strong>
                      <span>{new Date(selectedStudy.studyDate).toLocaleDateString()}</span>
                    </div>
                    <div className="metadata-item">
                      <strong>Imaging Types:</strong>
                      <span>{selectedStudy.modalities.join(', ')}</span>
                    </div>
                    <div className="metadata-item">
                      <strong>Number of Series:</strong>
                      <span>{selectedStudy.numberOfSeries}</span>
                    </div>
                    <div className="metadata-item">
                      <strong>Total Images:</strong>
                      <span>{selectedStudy.numberOfImages}</span>
                    </div>
                  </div>
                </div>

                {showEducationalContent && enableEducationalContent && (
                  <div className="educational-content">
                    <h4>About This Study</h4>
                    {selectedStudy.modalities.map(modality => (
                      <div key={modality} className="modality-explanation">
                        <h5>{getModalityDescription(modality)}</h5>
                        <p>{getModalityExplanation(modality)}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reports Section */}
                {getStudyReports(selectedStudy.studyInstanceUID).length > 0 && (
                  <div className="study-reports">
                    <h4>Reports</h4>
                    {getStudyReports(selectedStudy.studyInstanceUID).map(report => (
                      <div key={report.reportID} className="report-summary">
                        <div className="report-header">
                          <h5>Report from {new Date(report.reportDate).toLocaleDateString()}</h5>
                          <span className={`report-status ${report.status}`}>
                            {report.status}
                          </span>
                        </div>
                        <div className="report-content">
                          <div className="report-section">
                            <h6>Key Findings:</h6>
                            <p>{report.findings}</p>
                          </div>
                          <div className="report-section">
                            <h6>Summary:</h6>
                            <p>{report.impression}</p>
                          </div>
                          {report.recommendations && (
                            <div className="report-section recommendations">
                              <h6>Recommendations:</h6>
                              <p>{report.recommendations}</p>
                            </div>
                          )}
                          {!report.isAbnormal && (
                            <div className="normal-findings">
                              ✅ No significant abnormalities detected
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Patient Guidelines */}
                <div className="patient-guidelines">
                  <h4>Important Information</h4>
                  <ul>
                    <li>
                      <strong>Privacy:</strong> Your medical images are securely stored and can only be accessed by you and your authorized healthcare providers.
                    </li>
                    <li>
                      <strong>Questions:</strong> If you have questions about your images or reports, please contact your healthcare provider.
                    </li>
                    <li>
                      <strong>Emergency:</strong> These images are for informational purposes. In case of a medical emergency, contact emergency services immediately.
                    </li>
                    {enableSharing && (
                      <li>
                        <strong>Sharing:</strong> You can share these images with other healthcare providers through secure channels.
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="viewer-help">
        <details>
          <summary>Need Help? 📞</summary>
          <div className="help-content">
            <p>
              <strong>Technical Support:</strong> If you're having trouble viewing your images, 
              please contact our technical support team.
            </p>
            <p>
              <strong>Medical Questions:</strong> For questions about your medical images or reports, 
              please contact your healthcare provider directly.
            </p>
            <p>
              <strong>Privacy Concerns:</strong> We take your privacy seriously. Your medical images 
              are protected under HIPAA and are only accessible to authorized individuals.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
};

export default PACSPatientViewer;