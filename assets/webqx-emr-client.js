/**
 * WebQx EMR™ Client Library
 * Unified JavaScript API for Nextcloud + Medplum + OpenAI Whisper
 * 
 * **PRODUCTION READY** - Auto-detects Railway production vs localhost development
 * 
 * @version 1.0.0
 * @author WebQx Health
 * @license Apache-2.0
 */

(function(window) {
    'use strict';

    /**
     * Main WebQx EMR Client Class
     */
    class WebQxEMR {
        constructor(config = {}) {
            // Auto-detect production vs development
            const isProduction = window.location.hostname !== 'localhost' && 
                                window.location.hostname !== '127.0.0.1';
            
            // Use relative paths in production (proxied through unified-server)
            // Use absolute localhost URLs in development (direct to WebQx EMR service)
            this.baseUrl = config.baseUrl || '/emr';
            
            // WebSocket URL - use wss:// in production, ws:// in development
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            this.wsUrl = config.wsUrl || `${wsProtocol}//${window.location.host}/emr/transcribe-stream`;
            
            this.debug = config.debug || false;
            
            if (this.debug) {
                console.log('🏥 WebQx EMR™ initialized:', {
                    baseUrl: this.baseUrl,
                    wsUrl: this.wsUrl,
                    environment: isProduction ? 'production' : 'development',
                    host: window.location.host
                });
            }
            
            // Cache for frequently accessed data
            this.cache = {
                patients: new Map(),
                files: new Map(),
                status: null,
                statusExpiry: 0
            };
            
            // Active WebSocket connection
            this.wsConnection = null;
            
            this.log('WebQx EMR Client initialized', config);
        }

        // ============================================
        // UTILITY METHODS
        // ============================================

        log(...args) {
            if (this.debug) {
                console.log('[WebQx EMR]', ...args);
            }
        }

        error(...args) {
            console.error('[WebQx EMR Error]', ...args);
        }

        async request(endpoint, options = {}) {
            const url = `${this.baseUrl}${endpoint}`;
            const config = {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            };

            try {
                this.log('Request:', url, config);
                const response = await fetch(url, config);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                this.log('Response:', data);
                return data;
            } catch (error) {
                this.error('Request failed:', error);
                throw error;
            }
        }

        // ============================================
        // MEDPLUM - PATIENT DATA (FHIR)
        // ============================================

        /**
         * Search for patients by name, MRN, or DOB
         * @param {string} query - Search query
         * @param {number} limit - Maximum results (default 20)
         * @returns {Promise<Array>} Array of patient objects
         */
        async searchPatients(query, limit = 20) {
            if (!query || query.trim().length === 0) {
                return [];
            }

            try {
                const data = await this.request(`/patients?search=${encodeURIComponent(query)}&limit=${limit}`);
                
                // Cache results
                if (data.patients) {
                    data.patients.forEach(patient => {
                        this.cache.patients.set(patient.id, patient);
                    });
                }
                
                return data.patients || [];
            } catch (error) {
                this.error('Patient search failed:', error);
                return [];
            }
        }

        /**
         * Get patient by ID
         * @param {string} patientId - Patient ID
         * @returns {Promise<Object>} Patient object with demographics
         */
        async getPatient(patientId) {
            // Check cache first
            if (this.cache.patients.has(patientId)) {
                this.log('Patient from cache:', patientId);
                return this.cache.patients.get(patientId);
            }

            try {
                const data = await this.request(`/patient/${patientId}`);
                
                // Cache result
                if (data.patient) {
                    this.cache.patients.set(patientId, data.patient);
                }
                
                return data.patient;
            } catch (error) {
                this.error('Get patient failed:', error);
                throw error;
            }
        }

        /**
         * Get patient encounters (visits)
         * @param {string} patientId - Patient ID
         * @returns {Promise<Array>} Array of encounter objects
         */
        async getPatientEncounters(patientId) {
            try {
                const data = await this.request(`/patient/${patientId}/encounters`);
                return data.encounters || [];
            } catch (error) {
                this.error('Get encounters failed:', error);
                return [];
            }
        }

        /**
         * Get patient medications
         * @param {string} patientId - Patient ID
         * @returns {Promise<Array>} Array of medication objects
         */
        async getPatientMedications(patientId) {
            try {
                const data = await this.request(`/patient/${patientId}/medications`);
                return data.medications || [];
            } catch (error) {
                this.error('Get medications failed:', error);
                return [];
            }
        }

        /**
         * Get patient lab results (observations)
         * @param {string} patientId - Patient ID
         * @returns {Promise<Array>} Array of observation objects
         */
        async getPatientLabs(patientId) {
            try {
                const data = await this.request(`/patient/${patientId}/observations`);
                return data.observations || [];
            } catch (error) {
                this.error('Get lab results failed:', error);
                return [];
            }
        }

        /**
         * Get patient allergies
         * @param {string} patientId - Patient ID
         * @returns {Promise<Array>} Array of allergy objects
         */
        async getPatientAllergies(patientId) {
            try {
                const data = await this.request(`/patient/${patientId}/allergies`);
                return data.allergies || [];
            } catch (error) {
                this.error('Get allergies failed:', error);
                return [];
            }
        }

        /**
         * Get patient appointments
         * @param {string} patientId - Patient ID
         * @returns {Promise<Array>} Array of appointment objects
         */
        async getPatientAppointments(patientId) {
            try {
                const data = await this.request(`/patient/${patientId}/appointments`);
                return data.appointments || [];
            } catch (error) {
                this.error('Get appointments failed:', error);
                return [];
            }
        }

        /**
         * Create new appointment
         * @param {Object} appointment - Appointment data
         * @returns {Promise<Object>} Created appointment
         */
        async createAppointment(appointment) {
            try {
                const data = await this.request('/appointment', {
                    method: 'POST',
                    body: JSON.stringify(appointment)
                });
                return data.appointment;
            } catch (error) {
                this.error('Create appointment failed:', error);
                throw error;
            }
        }

        // ============================================
        // NEXTCLOUD - FILE STORAGE
        // ============================================

        /**
         * Get patient files from Nextcloud
         * @param {string} patientId - Patient ID
         * @param {string} category - Optional file category filter
         * @returns {Promise<Array>} Array of file objects
         */
        async getPatientFiles(patientId, category = null) {
            try {
                let endpoint = `/patient/${patientId}/files`;
                if (category) {
                    endpoint += `?category=${encodeURIComponent(category)}`;
                }
                
                const data = await this.request(endpoint);
                return data.files || [];
            } catch (error) {
                this.error('Get patient files failed:', error);
                return [];
            }
        }

        /**
         * Upload file to Nextcloud for a patient
         * @param {string} patientId - Patient ID
         * @param {File} file - File object to upload
         * @param {string} category - File category (lab, imaging, consent, etc.)
         * @param {Object} metadata - Optional metadata
         * @returns {Promise<Object>} Upload result with file ID
         */
        async uploadFile(patientId, file, category = 'general', metadata = {}) {
            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('category', category);
                formData.append('metadata', JSON.stringify(metadata));
                
                const url = `${this.baseUrl}/patient/${patientId}/upload`;
                const response = await fetch(url, {
                    method: 'POST',
                    body: formData
                });
                
                if (!response.ok) {
                    throw new Error(`Upload failed: ${response.statusText}`);
                }
                
                const data = await response.json();
                this.log('File uploaded:', data);
                return data;
            } catch (error) {
                this.error('File upload failed:', error);
                throw error;
            }
        }

        /**
         * Download file from Nextcloud
         * @param {string} fileId - File ID
         * @returns {Promise<Blob>} File blob
         */
        async downloadFile(fileId) {
            try {
                const url = `${this.baseUrl}/file/${fileId}`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`Download failed: ${response.statusText}`);
                }
                
                return await response.blob();
            } catch (error) {
                this.error('File download failed:', error);
                throw error;
            }
        }

        /**
         * Delete file from Nextcloud
         * @param {string} fileId - File ID
         * @returns {Promise<boolean>} Success status
         */
        async deleteFile(fileId) {
            try {
                const data = await this.request(`/file/${fileId}`, {
                    method: 'DELETE'
                });
                return data.success || false;
            } catch (error) {
                this.error('File deletion failed:', error);
                return false;
            }
        }

        // ============================================
        // OPENAI WHISPER - TRANSCRIPTION
        // ============================================

        /**
         * Transcribe audio file using OpenAI Whisper
         * @param {Blob} audioBlob - Audio blob (WAV, MP3, M4A, etc.)
         * @param {Object} options - Transcription options
         * @returns {Promise<Object>} Transcription result
         */
        async transcribeAudio(audioBlob, options = {}) {
            try {
                const formData = new FormData();
                formData.append('audio', audioBlob, 'recording.webm');
                formData.append('language', options.language || 'en');
                formData.append('format', options.format || 'json');
                
                if (options.patientId) {
                    formData.append('patientId', options.patientId);
                }
                
                const url = `${this.baseUrl}/transcribe`;
                const response = await fetch(url, {
                    method: 'POST',
                    body: formData
                });
                
                if (!response.ok) {
                    throw new Error(`Transcription failed: ${response.statusText}`);
                }
                
                const data = await response.json();
                this.log('Transcription completed:', data);
                return data;
            } catch (error) {
                this.error('Audio transcription failed:', error);
                throw error;
            }
        }

        /**
         * Start streaming transcription (WebSocket)
         * @param {Function} onPartial - Callback for partial transcripts
         * @param {Function} onFinal - Callback for final transcript
         * @param {Function} onError - Callback for errors
         * @returns {Object} WebSocket connection with controls
         */
        startStreamingTranscription(onPartial, onFinal, onError) {
            try {
                this.log('Connecting to streaming transcription:', this.wsUrl);
                
                const ws = new WebSocket(this.wsUrl);
                this.wsConnection = ws;
                
                ws.onopen = () => {
                    this.log('Streaming transcription connected');
                };
                
                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        
                        if (data.isFinal && onFinal) {
                            onFinal(data.text, data);
                        } else if (onPartial) {
                            onPartial(data.text, data);
                        }
                    } catch (error) {
                        this.error('Failed to parse WebSocket message:', error);
                    }
                };
                
                ws.onerror = (error) => {
                    this.error('WebSocket error:', error);
                    if (onError) onError(error);
                };
                
                ws.onclose = () => {
                    this.log('Streaming transcription disconnected');
                    this.wsConnection = null;
                };
                
                return {
                    send: (audioChunk) => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(audioChunk);
                        }
                    },
                    close: () => {
                        ws.close();
                    }
                };
            } catch (error) {
                this.error('Failed to start streaming transcription:', error);
                if (onError) onError(error);
                return null;
            }
        }

        /**
         * Stop streaming transcription
         */
        stopStreamingTranscription() {
            if (this.wsConnection) {
                this.wsConnection.close();
                this.wsConnection = null;
            }
        }

        // ============================================
        // SYSTEM STATUS & HEALTH
        // ============================================

        /**
         * Get WebQx EMR backend status
         * @param {boolean} forceRefresh - Skip cache and force refresh
         * @returns {Promise<Object>} Status object with all three backends
         */
        async getStatus(forceRefresh = false) {
            const now = Date.now();
            
            // Return cached status if still valid (30 seconds)
            if (!forceRefresh && this.cache.status && now < this.cache.statusExpiry) {
                this.log('Status from cache');
                return this.cache.status;
            }
            
            try {
                const data = await this.request('/status');
                
                // Cache for 30 seconds
                this.cache.status = data;
                this.cache.statusExpiry = now + 30000;
                
                return data;
            } catch (error) {
                this.error('Get status failed:', error);
                return {
                    status: 'offline',
                    dependencies: {
                        medplum: { status: 'unknown' },
                        nextcloud: { status: 'unknown' },
                        whisper: { status: 'unknown' }
                    }
                };
            }
        }

        /**
         * Clear all caches
         */
        clearCache() {
            this.cache.patients.clear();
            this.cache.files.clear();
            this.cache.status = null;
            this.cache.statusExpiry = 0;
            this.log('Cache cleared');
        }
    }

    // ============================================
    // UI HELPER FUNCTIONS
    // ============================================

    /**
     * Format patient name for display
     * @param {Object} patient - Patient object
     * @returns {string} Formatted name
     */
    WebQxEMR.formatPatientName = function(patient) {
        if (!patient) return 'Unknown Patient';
        
        const parts = [];
        if (patient.name) {
            if (typeof patient.name === 'string') {
                return patient.name;
            }
            if (patient.name.family) parts.push(patient.name.family);
            if (patient.name.given) {
                parts.unshift(patient.name.given.join(' '));
            }
        }
        
        return parts.join(' ') || 'Unknown Patient';
    };

    /**
     * Format date for display
     * @param {string} dateString - ISO date string
     * @param {string} format - 'short', 'long', or 'relative'
     * @returns {string} Formatted date
     */
    WebQxEMR.formatDate = function(dateString, format = 'short') {
        if (!dateString) return '';
        
        const date = new Date(dateString);
        
        if (format === 'relative') {
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);
            
            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays < 7) return `${diffDays}d ago`;
        }
        
        if (format === 'long') {
            return date.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
        
        return date.toLocaleDateString('en-US');
    };

    /**
     * Format file size for display
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted file size
     */
    WebQxEMR.formatFileSize = function(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    // ============================================
    // EXPOSE TO GLOBAL SCOPE
    // ============================================

    window.WebQxEMR = WebQxEMR;
    
    // Create default instance
    window.webqxEMR = new WebQxEMR({
        debug: window.location.hostname === 'localhost'
    });
    
    console.log('WebQx EMR Client Library loaded successfully');

})(window);
