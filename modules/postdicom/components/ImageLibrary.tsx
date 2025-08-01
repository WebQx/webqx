/**
 * PostDICOM Image Library Component
 * React component for browsing and managing DICOM studies
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ImageLibraryProps,
  DICOMStudy,
  StudySearchParams,
  APIResponse
} from '../types/postdicom.types';

const ImageLibrary: React.FC<ImageLibraryProps> = ({
  patientID,
  searchParams,
  onStudySelect,
  onImageSelect,
  showUploadButton = false,
  userPermissions
}) => {
  const [studies, setStudies] = useState<DICOMStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSearch, setCurrentSearch] = useState<StudySearchParams>({
    patientID: patientID,
    limit: 20,
    offset: 0,
    sortBy: 'studyDate',
    sortOrder: 'desc',
    ...searchParams
  });
  const [selectedStudy, setSelectedStudy] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  // Load studies
  const loadStudies = useCallback(async (params: StudySearchParams) => {
    try {
      setLoading(true);
      setError(null);

      // Get authentication token
      const token = localStorage.getItem('webqx_token');
      if (!token) {
        throw new Error('Authentication required');
      }

      // Build query parameters
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (typeof value === 'object') {
            queryParams.append(key, JSON.stringify(value));
          } else {
            queryParams.append(key, value.toString());
          }
        }
      });

      const response = await fetch(`/postdicom/studies?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load studies: ${response.statusText}`);
      }

      const result: APIResponse<DICOMStudy[]> = await response.json();
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to load studies');
      }

      setStudies(result.data || []);
      setTotalCount(result.metadata?.totalCount || 0);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error loading studies:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load studies on component mount or when search params change
  useEffect(() => {
    loadStudies(currentSearch);
  }, [currentSearch, loadStudies]);

  // Handle search form submission
  const handleSearch = (newParams: Partial<StudySearchParams>) => {
    setCurrentSearch(prev => ({
      ...prev,
      ...newParams,
      offset: 0 // Reset to first page
    }));
  };

  // Handle pagination
  const handlePageChange = (direction: 'next' | 'prev') => {
    setCurrentSearch(prev => {
      const newOffset = direction === 'next' 
        ? prev.offset! + prev.limit!
        : Math.max(0, prev.offset! - prev.limit!);
      
      return { ...prev, offset: newOffset };
    });
  };

  // Handle study selection
  const handleStudyClick = (study: DICOMStudy) => {
    setSelectedStudy(study.studyInstanceUID);
    if (onStudySelect) {
      onStudySelect(study);
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  // Format date
  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  // Get modality icon
  const getModalityIcon = (modality: string): string => {
    const icons: { [key: string]: string } = {
      'CT': '🖥️',
      'MRI': '🧲',
      'XR': '🦴',
      'US': '🔊',
      'ECG': '💓',
      'ECHO': '❤️',
      'PT': '☢️',
      'NM': '⚛️'
    };
    return icons[modality] || '📄';
  };

  return (
    <div className="image-library">
      {/* Search Header */}
      <div className="library-header">
        <h2>Medical Imaging Library</h2>
        {showUploadButton && userPermissions.canView && (
          <button className="upload-btn">
            📤 Upload Study
          </button>
        )}
      </div>

      {/* Search Filters */}
      <div className="search-filters">
        <div className="filter-group">
          <input
            type="text"
            placeholder="Patient ID"
            value={currentSearch.patientID || ''}
            onChange={(e) => handleSearch({ patientID: e.target.value || undefined })}
          />
        </div>
        
        <div className="filter-group">
          <select
            value={currentSearch.modality || ''}
            onChange={(e) => handleSearch({ modality: e.target.value || undefined })}
          >
            <option value="">All Modalities</option>
            <option value="CT">CT</option>
            <option value="MRI">MRI</option>
            <option value="XR">X-Ray</option>
            <option value="US">Ultrasound</option>
            <option value="ECG">ECG</option>
            <option value="ECHO">Echo</option>
          </select>
        </div>
        
        <div className="filter-group">
          <input
            type="date"
            value={currentSearch.studyDate || ''}
            onChange={(e) => handleSearch({ studyDate: e.target.value || undefined })}
          />
        </div>
        
        <div className="filter-group">
          <select
            value={currentSearch.sortBy || 'studyDate'}
            onChange={(e) => handleSearch({ sortBy: e.target.value as any })}
          >
            <option value="studyDate">Study Date</option>
            <option value="patientName">Patient Name</option>
            <option value="modality">Modality</option>
          </select>
        </div>
        
        <button onClick={() => loadStudies(currentSearch)} className="search-btn">
          🔍 Search
        </button>
      </div>

      {/* Results */}
      <div className="library-content">
        {loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading studies...</p>
          </div>
        )}

        {error && (
          <div className="error-state">
            <p>❌ {error}</p>
            <button onClick={() => loadStudies(currentSearch)}>Retry</button>
          </div>
        )}

        {!loading && !error && studies.length === 0 && (
          <div className="empty-state">
            <p>📂 No studies found</p>
            <p>Try adjusting your search criteria</p>
          </div>
        )}

        {!loading && !error && studies.length > 0 && (
          <>
            {/* Results Summary */}
            <div className="results-summary">
              <p>
                Showing {studies.length} of {totalCount} studies
                {currentSearch.patientID && ` for patient ${currentSearch.patientID}`}
              </p>
            </div>

            {/* Studies Grid */}
            <div className="studies-grid">
              {studies.map((study) => (
                <div
                  key={study.studyInstanceUID}
                  className={`study-card ${selectedStudy === study.studyInstanceUID ? 'selected' : ''}`}
                  onClick={() => handleStudyClick(study)}
                >
                  <div className="study-header">
                    <div className="modality-badge">
                      <span className="modality-icon">{getModalityIcon(study.modality)}</span>
                      <span className="modality-text">{study.modality}</span>
                    </div>
                    <div className="access-level">
                      {study.accessLevel === 'confidential' && '🔒'}
                      {study.accessLevel === 'restricted' && '🔐'}
                      {study.accessLevel === 'public' && '🔓'}
                    </div>
                  </div>

                  <div className="study-info">
                    <h3>{study.studyDescription || 'Unnamed Study'}</h3>
                    <p className="patient-info">
                      <strong>Patient:</strong> {study.patientName}
                    </p>
                    <p className="patient-info">
                      <strong>ID:</strong> {study.patientID}
                    </p>
                    <p className="study-date">
                      <strong>Date:</strong> {formatDate(study.studyDate)}
                    </p>
                  </div>

                  <div className="study-stats">
                    <div className="stat">
                      <span className="stat-value">{study.seriesCount}</span>
                      <span className="stat-label">Series</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value">{study.imageCount}</span>
                      <span className="stat-label">Images</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value">{formatFileSize(study.studySize)}</span>
                      <span className="stat-label">Size</span>
                    </div>
                  </div>

                  <div className="study-actions">
                    {userPermissions.canView && (
                      <button className="action-btn view-btn">👁️ View</button>
                    )}
                    {userPermissions.canDownload && (
                      <button className="action-btn download-btn">💾 Download</button>
                    )}
                    {userPermissions.canShare && (
                      <button className="action-btn share-btn">📤 Share</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="pagination">
              <button
                onClick={() => handlePageChange('prev')}
                disabled={currentSearch.offset === 0}
                className="pagination-btn"
              >
                ← Previous
              </button>
              
              <span className="pagination-info">
                Page {Math.floor((currentSearch.offset || 0) / (currentSearch.limit || 20)) + 1}
              </span>
              
              <button
                onClick={() => handlePageChange('next')}
                disabled={(currentSearch.offset || 0) + (currentSearch.limit || 20) >= totalCount}
                className="pagination-btn"
              >
                Next →
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        .image-library {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #f8f9fa;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .library-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          background: white;
          border-bottom: 1px solid #e9ecef;
        }

        .library-header h2 {
          margin: 0;
          color: #343a40;
        }

        .upload-btn {
          background: #007bff;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
        }

        .upload-btn:hover {
          background: #0056b3;
        }

        .search-filters {
          display: flex;
          gap: 15px;
          padding: 20px;
          background: white;
          border-bottom: 1px solid #e9ecef;
          flex-wrap: wrap;
        }

        .filter-group input,
        .filter-group select {
          padding: 8px 12px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          font-size: 14px;
          min-width: 150px;
        }

        .search-btn {
          background: #28a745;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
        }

        .search-btn:hover {
          background: #1e7e34;
        }

        .library-content {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
        }

        .loading-state,
        .error-state,
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          text-align: center;
          color: #6c757d;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #e9ecef;
          border-top: 4px solid #007bff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 15px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .error-state button {
          background: #dc3545;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          margin-top: 10px;
        }

        .results-summary {
          margin-bottom: 20px;
          color: #6c757d;
          font-size: 14px;
        }

        .studies-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }

        .study-card {
          background: white;
          border: 1px solid #e9ecef;
          border-radius: 8px;
          padding: 20px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .study-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          transform: translateY(-2px);
        }

        .study-card.selected {
          border-color: #007bff;
          box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
        }

        .study-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }

        .modality-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #e9ecef;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }

        .modality-icon {
          font-size: 16px;
        }

        .access-level {
          font-size: 16px;
        }

        .study-info h3 {
          margin: 0 0 10px 0;
          color: #343a40;
          font-size: 16px;
          font-weight: 600;
        }

        .patient-info,
        .study-date {
          margin: 4px 0;
          font-size: 14px;
          color: #6c757d;
        }

        .study-stats {
          display: flex;
          gap: 20px;
          margin: 15px 0;
          padding: 10px 0;
          border-top: 1px solid #e9ecef;
        }

        .stat {
          text-align: center;
        }

        .stat-value {
          display: block;
          font-size: 18px;
          font-weight: 600;
          color: #007bff;
        }

        .stat-label {
          display: block;
          font-size: 12px;
          color: #6c757d;
          margin-top: 2px;
        }

        .study-actions {
          display: flex;
          gap: 8px;
          padding-top: 15px;
          border-top: 1px solid #e9ecef;
        }

        .action-btn {
          flex: 1;
          padding: 6px 12px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          background: white;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s ease;
        }

        .view-btn:hover {
          background: #007bff;
          color: white;
          border-color: #007bff;
        }

        .download-btn:hover {
          background: #28a745;
          color: white;
          border-color: #28a745;
        }

        .share-btn:hover {
          background: #17a2b8;
          color: white;
          border-color: #17a2b8;
        }

        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 20px;
          padding: 20px 0;
        }

        .pagination-btn {
          background: #007bff;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
        }

        .pagination-btn:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }

        .pagination-btn:not(:disabled):hover {
          background: #0056b3;
        }

        .pagination-info {
          color: #6c757d;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
};

export default ImageLibrary;