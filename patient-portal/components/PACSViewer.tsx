/**
 * PACS Viewer Component
 * 
 * React component for viewing DICOM studies in the patient portal.
 * Integrates with OHIF viewer for secure patient access to imaging.
 */

import React, { useState, useEffect, useCallback } from 'react';

interface Study {
  studyInstanceUID: string;
  patientID: string;
  patientName: string;
  studyDate: string;
  studyTime?: string;
  studyDescription?: string;
  modality: string;
  accessionNumber?: string;
  specialty: string;
  seriesCount: number;
  instanceCount: number;
  status: string;
}

interface PACSViewerProps {
  patientId?: string;
  className?: string;
}

export const PACSViewer: React.FC<PACSViewerProps> = ({ 
  patientId,
  className = ''
}) => {
  const [studies, setStudies] = useState<Study[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudy, setSelectedStudy] = useState<Study | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useState({
    patientID: patientId || '',
    studyDateFrom: '',
    studyDateTo: '',
    modality: '',
    specialty: ''
  });

  // Fetch studies from PACS API
  const fetchStudies = useCallback(async () => {
    if (!searchParams.patientID && !patientId) return;

    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      
      if (searchParams.patientID || patientId) {
        queryParams.set('patientID', searchParams.patientID || patientId!);
      }
      if (searchParams.studyDateFrom) {
        queryParams.set('studyDateFrom', searchParams.studyDateFrom);
      }
      if (searchParams.studyDateTo) {
        queryParams.set('studyDateTo', searchParams.studyDateTo);
      }
      if (searchParams.modality) {
        queryParams.set('modality', searchParams.modality);
      }
      if (searchParams.specialty) {
        queryParams.set('specialty', searchParams.specialty);
      }

      const response = await fetch(`/api/pacs/studies?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('webqx_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch studies: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setStudies(result.data.studies);
      } else {
        throw new Error(result.message || 'Failed to fetch studies');
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('PACS fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [searchParams, patientId]);

  // Get viewer URL for selected study
  const openViewer = async (study: Study) => {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/pacs/studies/${study.studyInstanceUID}/viewer?specialty=${study.specialty}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('webqx_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get viewer URL: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setSelectedStudy(study);
        setViewerUrl(result.data.viewerUrl);
      } else {
        throw new Error(result.message || 'Failed to get viewer URL');
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open viewer');
      console.error('Viewer URL error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (patientId) {
      fetchStudies();
    }
  }, [patientId, fetchStudies]);

  // Handle search parameter changes
  const handleSearchChange = (field: string, value: string) => {
    setSearchParams(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Close viewer
  const closeViewer = () => {
    setSelectedStudy(null);
    setViewerUrl(null);
  };

  return (
    <div className={`pacs-viewer ${className}`}>
      <div className="pacs-header">
        <h2>Medical Imaging</h2>
        <p className="text-muted">View your diagnostic images and reports</p>
      </div>

      {/* Search Interface (only show if no patientId prop) */}
      {!patientId && (
        <div className="pacs-search bg-light p-3 rounded mb-4">
          <h5>Search Studies</h5>
          <div className="row g-3">
            <div className="col-md-3">
              <label className="form-label">Patient ID</label>
              <input
                type="text"
                className="form-control"
                value={searchParams.patientID}
                onChange={(e) => handleSearchChange('patientID', e.target.value)}
                placeholder="Enter Patient ID"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">From Date</label>
              <input
                type="date"
                className="form-control"
                value={searchParams.studyDateFrom}
                onChange={(e) => handleSearchChange('studyDateFrom', e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">To Date</label>
              <input
                type="date"
                className="form-control"
                value={searchParams.studyDateTo}
                onChange={(e) => handleSearchChange('studyDateTo', e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Modality</label>
              <select
                className="form-select"
                value={searchParams.modality}
                onChange={(e) => handleSearchChange('modality', e.target.value)}
              >
                <option value="">All Modalities</option>
                <option value="CT">CT Scan</option>
                <option value="MR">MRI</option>
                <option value="XA">Angiography</option>
                <option value="US">Ultrasound</option>
                <option value="CR">X-Ray</option>
                <option value="DR">Digital X-Ray</option>
              </select>
            </div>
          </div>
          <div className="mt-3">
            <button
              className="btn btn-primary"
              onClick={fetchStudies}
              disabled={loading}
            >
              {loading ? 'Searching...' : 'Search Studies'}
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="alert alert-danger" role="alert">
          <strong>Error:</strong> {error}
          <button
            type="button"
            className="btn-close"
            onClick={() => setError(null)}
            aria-label="Close"
          ></button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-4">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading studies...</p>
        </div>
      )}

      {/* Studies List */}
      {!loading && studies.length > 0 && (
        <div className="pacs-studies">
          <h5>Available Studies ({studies.length})</h5>
          <div className="table-responsive">
            <table className="table table-hover">
              <thead className="table-light">
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Modality</th>
                  <th>Specialty</th>
                  <th>Series</th>
                  <th>Images</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {studies.map((study) => (
                  <tr key={study.studyInstanceUID}>
                    <td>
                      <div className="fw-bold">{study.studyDate}</div>
                      {study.studyTime && (
                        <small className="text-muted">{study.studyTime}</small>
                      )}
                    </td>
                    <td>
                      <div className="fw-bold">{study.studyDescription || 'No description'}</div>
                      {study.accessionNumber && (
                        <small className="text-muted">Acc: {study.accessionNumber}</small>
                      )}
                    </td>
                    <td>
                      <span className="badge bg-secondary">{study.modality}</span>
                    </td>
                    <td>
                      <span className="badge bg-info text-dark">{study.specialty}</span>
                    </td>
                    <td>{study.seriesCount}</td>
                    <td>{study.instanceCount}</td>
                    <td>
                      <span className={`badge ${
                        study.status === 'completed' ? 'bg-success' :
                        study.status === 'in-progress' ? 'bg-warning' :
                        'bg-secondary'
                      }`}>
                        {study.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => openViewer(study)}
                        disabled={loading}
                      >
                        <i className="fas fa-eye me-1"></i>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No Studies Message */}
      {!loading && studies.length === 0 && !error && (
        <div className="text-center py-5">
          <i className="fas fa-images fa-3x text-muted mb-3"></i>
          <h5 className="text-muted">No Studies Found</h5>
          <p className="text-muted">
            {patientId 
              ? 'No imaging studies are available for this patient.' 
              : 'Enter search criteria to find imaging studies.'
            }
          </p>
        </div>
      )}

      {/* DICOM Viewer Modal */}
      {selectedStudy && viewerUrl && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
          <div className="modal-dialog modal-fullscreen">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {selectedStudy.studyDescription || 'DICOM Viewer'}
                </h5>
                <div className="ms-auto me-3">
                  <small className="text-muted">
                    Patient: {selectedStudy.patientName} | 
                    Date: {selectedStudy.studyDate} |
                    Modality: {selectedStudy.modality}
                  </small>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={closeViewer}
                  aria-label="Close"
                ></button>
              </div>
              <div className="modal-body p-0">
                <iframe
                  src={viewerUrl}
                  width="100%"
                  height="100%"
                  style={{ minHeight: '80vh', border: 'none' }}
                  title="DICOM Viewer"
                  allowFullScreen
                />
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeViewer}
                >
                  Close Viewer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Notice */}
      <div className="pacs-footer mt-4">
        <div className="alert alert-info d-flex align-items-center">
          <i className="fas fa-shield-alt me-2"></i>
          <small>
            <strong>Privacy Notice:</strong> Your medical images are encrypted and secure. 
            Access is logged for security purposes. Only authorized healthcare providers 
            can view your complete imaging studies.
          </small>
        </div>
      </div>
    </div>
  );
};

export default PACSViewer;