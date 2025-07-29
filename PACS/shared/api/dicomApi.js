/**
 * @fileoverview DICOM API Service for WebQX PACS Ecosystem
 * 
 * This module provides APIs for uploading, retrieving, and managing DICOM files
 * within the PACS system. It includes authentication, validation, and storage management.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

/**
 * API response interface for DICOM operations
 */
class DicomApiResponse {
  constructor(success = false, data = null, error = null) {
    this.success = success;
    this.data = data;
    this.error = error;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * DICOM study information
 */
class DicomStudy {
  constructor() {
    this.studyInstanceUID = '';
    this.patientId = '';
    this.patientName = '';
    this.studyDate = '';
    this.studyTime = '';
    this.studyDescription = '';
    this.modalities = [];
    this.numberOfSeries = 0;
    this.numberOfInstances = 0;
    this.institutionName = '';
  }
}

/**
 * DICOM API Service Class
 * Handles all DICOM-related API operations
 */
class DicomApi {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || process.env.PACS_API_URL || '/api/v1/dicom',
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
      chunkSize: config.chunkSize || 1024 * 1024, // 1MB chunks for large file uploads
      ...config
    };

    this.authToken = null;
  }

  /**
   * Sets authentication token for API requests
   * @param {string} token - JWT or API token
   */
  setAuthToken(token) {
    this.authToken = token;
  }

  /**
   * Uploads a DICOM file to the PACS system
   * @param {File} file - DICOM file to upload
   * @param {Object} metadata - Additional metadata
   * @param {Function} progressCallback - Upload progress callback
   * @returns {Promise<DicomApiResponse>} - Upload response
   */
  async uploadDicomFile(file, metadata = {}, progressCallback = null) {
    try {
      if (!file) {
        throw new Error('No file provided for upload');
      }

      const formData = new FormData();
      formData.append('dicom_file', file);
      formData.append('metadata', JSON.stringify(metadata));

      const xhr = new XMLHttpRequest();
      
      return new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (progressCallback && event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100;
            progressCallback(progress);
          }
        });

        xhr.addEventListener('load', () => {
          try {
            const response = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(new DicomApiResponse(true, response));
            } else {
              resolve(new DicomApiResponse(false, null, response.error || 'Upload failed'));
            }
          } catch (error) {
            reject(new DicomApiResponse(false, null, 'Invalid response format'));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new DicomApiResponse(false, null, 'Network error during upload'));
        });

        xhr.addEventListener('timeout', () => {
          reject(new DicomApiResponse(false, null, 'Upload timeout'));
        });

        xhr.open('POST', `${this.config.baseUrl}/upload`);
        xhr.timeout = this.config.timeout;
        
        if (this.authToken) {
          xhr.setRequestHeader('Authorization', `Bearer ${this.authToken}`);
        }

        xhr.send(formData);
      });

    } catch (error) {
      console.error('DICOM upload error:', error);
      return new DicomApiResponse(false, null, error.message);
    }
  }

  /**
   * Retrieves DICOM studies for a patient
   * @param {string} patientId - Patient identifier
   * @param {Object} filters - Optional filters (date range, modality, etc.)
   * @returns {Promise<DicomApiResponse>} - Studies response
   */
  async getPatientStudies(patientId, filters = {}) {
    try {
      if (!patientId) {
        throw new Error('Patient ID is required');
      }

      const queryParams = new URLSearchParams({
        patient_id: patientId,
        ...filters
      });

      const response = await this._makeRequest(
        'GET',
        `/studies?${queryParams.toString()}`
      );

      return response;

    } catch (error) {
      console.error('Get patient studies error:', error);
      return new DicomApiResponse(false, null, error.message);
    }
  }

  /**
   * Retrieves a specific DICOM study
   * @param {string} studyInstanceUID - Study instance UID
   * @returns {Promise<DicomApiResponse>} - Study response
   */
  async getStudy(studyInstanceUID) {
    try {
      if (!studyInstanceUID) {
        throw new Error('Study Instance UID is required');
      }

      const response = await this._makeRequest(
        'GET',
        `/studies/${encodeURIComponent(studyInstanceUID)}`
      );

      return response;

    } catch (error) {
      console.error('Get study error:', error);
      return new DicomApiResponse(false, null, error.message);
    }
  }

  /**
   * Retrieves DICOM instances for a series
   * @param {string} studyInstanceUID - Study instance UID
   * @param {string} seriesInstanceUID - Series instance UID
   * @returns {Promise<DicomApiResponse>} - Instances response
   */
  async getSeriesInstances(studyInstanceUID, seriesInstanceUID) {
    try {
      if (!studyInstanceUID || !seriesInstanceUID) {
        throw new Error('Study and Series Instance UIDs are required');
      }

      const response = await this._makeRequest(
        'GET',
        `/studies/${encodeURIComponent(studyInstanceUID)}/series/${encodeURIComponent(seriesInstanceUID)}/instances`
      );

      return response;

    } catch (error) {
      console.error('Get series instances error:', error);
      return new DicomApiResponse(false, null, error.message);
    }
  }

  /**
   * Downloads a DICOM instance
   * @param {string} studyInstanceUID - Study instance UID
   * @param {string} seriesInstanceUID - Series instance UID
   * @param {string} sopInstanceUID - SOP instance UID
   * @returns {Promise<DicomApiResponse>} - Download response with blob data
   */
  async downloadInstance(studyInstanceUID, seriesInstanceUID, sopInstanceUID) {
    try {
      if (!studyInstanceUID || !seriesInstanceUID || !sopInstanceUID) {
        throw new Error('Study, Series, and SOP Instance UIDs are required');
      }

      const url = `/studies/${encodeURIComponent(studyInstanceUID)}/series/${encodeURIComponent(seriesInstanceUID)}/instances/${encodeURIComponent(sopInstanceUID)}`;
      
      const response = await this._makeRequest('GET', url, null, 'blob');

      return response;

    } catch (error) {
      console.error('Download instance error:', error);
      return new DicomApiResponse(false, null, error.message);
    }
  }

  /**
   * Searches for DICOM studies across the PACS
   * @param {Object} searchCriteria - Search parameters
   * @returns {Promise<DicomApiResponse>} - Search results
   */
  async searchStudies(searchCriteria = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      Object.keys(searchCriteria).forEach(key => {
        if (searchCriteria[key]) {
          queryParams.append(key, searchCriteria[key]);
        }
      });

      const response = await this._makeRequest(
        'GET',
        `/search?${queryParams.toString()}`
      );

      return response;

    } catch (error) {
      console.error('Search studies error:', error);
      return new DicomApiResponse(false, null, error.message);
    }
  }

  /**
   * Deletes a DICOM study (with appropriate permissions)
   * @param {string} studyInstanceUID - Study instance UID
   * @returns {Promise<DicomApiResponse>} - Deletion response
   */
  async deleteStudy(studyInstanceUID) {
    try {
      if (!studyInstanceUID) {
        throw new Error('Study Instance UID is required');
      }

      const response = await this._makeRequest(
        'DELETE',
        `/studies/${encodeURIComponent(studyInstanceUID)}`
      );

      return response;

    } catch (error) {
      console.error('Delete study error:', error);
      return new DicomApiResponse(false, null, error.message);
    }
  }

  /**
   * Private method to make HTTP requests
   * @private
   */
  async _makeRequest(method, endpoint, body = null, responseType = 'json') {
    try {
      const url = `${this.config.baseUrl}${endpoint}`;
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
        }
      };

      if (body && method !== 'GET') {
        options.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      const response = await fetch(url, options);
      
      let data;
      if (responseType === 'blob') {
        data = await response.blob();
      } else {
        data = await response.json();
      }

      if (response.ok) {
        return new DicomApiResponse(true, data);
      } else {
        return new DicomApiResponse(false, null, data.error || `HTTP ${response.status}`);
      }

    } catch (error) {
      throw new Error(`API request failed: ${error.message}`);
    }
  }
}

/**
 * Factory function to create DicomApi instance
 * @param {Object} config - Configuration options
 * @returns {DicomApi} - New DicomApi instance
 */
function createDicomApi(config = {}) {
  return new DicomApi(config);
}

// Export for CommonJS and ES modules compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DicomApi,
    DicomApiResponse,
    DicomStudy,
    createDicomApi
  };
}

// ES module export
export { DicomApi, DicomApiResponse, DicomStudy, createDicomApi };

// Default export
export default DicomApi;