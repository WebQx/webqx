/**
 * @fileoverview Patient Portal Image Viewer for WebQX PACS Ecosystem
 * 
 * This module provides a simplified, patient-friendly image viewer for displaying
 * medical images to patients. It focuses on ease of use, accessibility, and
 * educational features while maintaining privacy and security.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

/**
 * Patient viewer configuration
 */
class PatientViewerConfig {
  constructor(config = {}) {
    this.containerId = config.containerId || 'patient-image-viewer';
    this.width = config.width || 600;
    this.height = config.height || 500;
    this.enableZoom = config.enableZoom !== false;
    this.enablePan = config.enablePan || false; // Simplified for patients
    this.showImageInfo = config.showImageInfo !== false;
    this.showInstructions = config.showInstructions !== false;
    this.language = config.language || 'en';
    this.accessibilityMode = config.accessibilityMode || false;
    this.theme = config.theme || 'light'; // Patient-friendly light theme
    this.allowDownload = config.allowDownload || false;
  }
}

/**
 * Image information display object
 */
class ImageInfo {
  constructor(imageData) {
    this.studyDate = imageData.studyDate || '';
    this.studyDescription = imageData.studyDescription || '';
    this.seriesDescription = imageData.seriesDescription || '';
    this.modality = imageData.modality || '';
    this.institutionName = imageData.institutionName || '';
    this.bodyPart = imageData.bodyPart || '';
    this.patientFriendlyDescription = this._generatePatientFriendlyDescription();
  }

  _generatePatientFriendlyDescription() {
    // Generate patient-friendly descriptions based on modality
    const modalityDescriptions = {
      'CT': 'CT Scan (Computed Tomography) - Detailed cross-sectional images',
      'MR': 'MRI Scan (Magnetic Resonance Imaging) - Detailed soft tissue images',
      'XR': 'X-Ray - Standard radiographic image',
      'US': 'Ultrasound - Sound wave imaging',
      'NM': 'Nuclear Medicine - Functional imaging study',
      'PT': 'PET Scan (Positron Emission Tomography) - Metabolic activity imaging',
      'CR': 'Digital X-Ray - Computed radiography image',
      'DR': 'Digital X-Ray - Direct radiography image'
    };

    return modalityDescriptions[this.modality] || 'Medical imaging study';
  }
}

/**
 * Patient Image Viewer Class
 * Simplified, patient-focused medical image viewer
 */
class PatientImageViewer {
  constructor(config = {}) {
    this.config = new PatientViewerConfig(config);
    this.currentImage = null;
    this.imageInfo = null;
    this.viewportState = {
      zoom: 1.0,
      pan: { x: 0, y: 0 },
      rotation: 0
    };
    this.isInitialized = false;
    this.translations = this._loadTranslations();
  }

  /**
   * Initializes the patient image viewer
   * @returns {Promise<boolean>} - Initialization success
   */
  async initialize() {
    try {
      const container = document.getElementById(this.config.containerId);
      if (!container) {
        throw new Error(`Container with ID '${this.config.containerId}' not found`);
      }

      await this._setupViewerInterface(container);
      await this._setupEventListeners();
      this._setupAccessibilityFeatures();
      
      this.isInitialized = true;
      this._triggerEvent('viewer:initialized');
      
      return true;

    } catch (error) {
      console.error('Patient viewer initialization error:', error);
      return false;
    }
  }

  /**
   * Loads an image for patient viewing
   * @param {Object} imageData - Image data (anonymized for patient)
   * @returns {Promise<boolean>} - Load success
   */
  async loadImage(imageData) {
    try {
      if (!this.isInitialized) {
        throw new Error('Viewer not initialized');
      }

      // Ensure image data is anonymized for patient viewing
      this.currentImage = this._anonymizeImageData(imageData);
      this.imageInfo = new ImageInfo(this.currentImage);
      
      // Reset viewport state for new image
      this.viewportState = {
        zoom: 1.0,
        pan: { x: 0, y: 0 },
        rotation: 0
      };

      await this._renderImage();
      this._updateImageInfo();
      this._showViewingInstructions();
      this._triggerEvent('image:loaded', { image: this.currentImage });
      
      return true;

    } catch (error) {
      console.error('Image load error:', error);
      this._showError(this.translations.loadError);
      return false;
    }
  }

  /**
   * Zooms the image (patient-friendly implementation)
   * @param {string} direction - 'in' or 'out'
   */
  zoom(direction) {
    const zoomStep = 0.25;
    const minZoom = 0.5;
    const maxZoom = 3.0;

    if (direction === 'in') {
      this.viewportState.zoom = Math.min(maxZoom, this.viewportState.zoom + zoomStep);
    } else if (direction === 'out') {
      this.viewportState.zoom = Math.max(minZoom, this.viewportState.zoom - zoomStep);
    }

    this._applyTransform();
    this._triggerEvent('zoom:changed', { zoom: this.viewportState.zoom });
    
    // Announce zoom level for accessibility
    if (this.config.accessibilityMode) {
      this._announceToScreenReader(`Zoom level: ${Math.round(this.viewportState.zoom * 100)}%`);
    }
  }

  /**
   * Resets the image to its original size and position
   */
  resetView() {
    this.viewportState = {
      zoom: 1.0,
      pan: { x: 0, y: 0 },
      rotation: 0
    };
    this._applyTransform();
    this._triggerEvent('view:reset');
    
    if (this.config.accessibilityMode) {
      this._announceToScreenReader(this.translations.viewReset);
    }
  }

  /**
   * Toggles between normal and accessibility mode
   */
  toggleAccessibilityMode() {
    this.config.accessibilityMode = !this.config.accessibilityMode;
    this._updateAccessibilityFeatures();
    this._triggerEvent('accessibility:toggled', { enabled: this.config.accessibilityMode });
  }

  /**
   * Changes the viewer language
   * @param {string} languageCode - Language code (e.g., 'en', 'es', 'fr')
   */
  setLanguage(languageCode) {
    this.config.language = languageCode;
    this.translations = this._loadTranslations();
    this._updateInterface();
    this._triggerEvent('language:changed', { language: languageCode });
  }

  /**
   * Downloads the current image (if allowed)
   * @returns {Promise<boolean>} - Download success
   */
  async downloadImage() {
    try {
      if (!this.config.allowDownload) {
        throw new Error('Download not permitted');
      }

      // Create a download link for the current image
      const canvas = document.getElementById('patient-canvas');
      if (canvas) {
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `medical_image_${Date.now()}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        });
      }

      return true;

    } catch (error) {
      console.error('Download error:', error);
      this._showError(this.translations.downloadError);
      return false;
    }
  }

  /**
   * Shows help information to the patient
   */
  showHelp() {
    const helpModal = this._createHelpModal();
    document.body.appendChild(helpModal);
    this._triggerEvent('help:shown');
  }

  /**
   * Private method to setup the patient-friendly viewer interface
   * @private
   */
  async _setupViewerInterface(container) {
    container.innerHTML = `
      <div class="patient-viewer-container" style="width: ${this.config.width}px; height: ${this.config.height}px;">
        <div class="patient-viewer-header">
          <h3 class="viewer-title">${this.translations.title}</h3>
          <div class="viewer-controls">
            ${this.config.enableZoom ? `
              <button class="control-btn zoom-in-btn" aria-label="${this.translations.zoomIn}">🔍+</button>
              <button class="control-btn zoom-out-btn" aria-label="${this.translations.zoomOut}">🔍-</button>
              <button class="control-btn reset-btn" aria-label="${this.translations.reset}">↺</button>
            ` : ''}
            <button class="control-btn help-btn" aria-label="${this.translations.help}">❓</button>
            <button class="control-btn accessibility-btn" aria-label="${this.translations.accessibility}">♿</button>
            ${this.config.allowDownload ? `
              <button class="control-btn download-btn" aria-label="${this.translations.download}">💾</button>
            ` : ''}
          </div>
        </div>
        
        <div class="viewer-content">
          <canvas id="patient-canvas" 
                  width="${this.config.width}" 
                  height="${this.config.height - 100}"
                  role="img"
                  aria-label="${this.translations.imageCanvas}">
          </canvas>
          
          <div class="image-loading" id="loading-indicator" style="display: none;">
            <div class="loading-spinner"></div>
            <p>${this.translations.loading}</p>
          </div>
          
          <div class="error-message" id="error-display" style="display: none;"></div>
        </div>
        
        ${this.config.showImageInfo ? `
          <div class="image-info-panel">
            <div class="info-content" id="image-info-content">
              ${this.translations.noImageLoaded}
            </div>
          </div>
        ` : ''}
        
        ${this.config.showInstructions ? `
          <div class="instructions-panel" id="instructions">
            <p>${this.translations.instructions}</p>
          </div>
        ` : ''}
      </div>
    `;

    this._applyPatientFriendlyStyles();
  }

  /**
   * Private method to setup event listeners for patient viewer
   * @private
   */
  async _setupEventListeners() {
    const container = document.getElementById(this.config.containerId);
    
    // Control button events
    container.addEventListener('click', (e) => {
      if (e.target.classList.contains('zoom-in-btn')) {
        this.zoom('in');
      } else if (e.target.classList.contains('zoom-out-btn')) {
        this.zoom('out');
      } else if (e.target.classList.contains('reset-btn')) {
        this.resetView();
      } else if (e.target.classList.contains('help-btn')) {
        this.showHelp();
      } else if (e.target.classList.contains('accessibility-btn')) {
        this.toggleAccessibilityMode();
      } else if (e.target.classList.contains('download-btn')) {
        this.downloadImage();
      }
    });

    // Canvas zoom on double-click
    const canvas = container.querySelector('#patient-canvas');
    if (canvas) {
      canvas.addEventListener('dblclick', () => {
        this.zoom('in');
      });
    }
  }

  /**
   * Private method to setup accessibility features
   * @private
   */
  _setupAccessibilityFeatures() {
    // Add ARIA labels and descriptions
    const container = document.getElementById(this.config.containerId);
    container.setAttribute('role', 'application');
    container.setAttribute('aria-label', this.translations.viewerAriaLabel);

    // Setup keyboard navigation
    container.setAttribute('tabindex', '0');
    container.addEventListener('keydown', (e) => {
      switch (e.key) {
        case '+':
        case '=':
          e.preventDefault();
          this.zoom('in');
          break;
        case '-':
          e.preventDefault();
          this.zoom('out');
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          this.resetView();
          break;
        case 'h':
        case 'H':
          e.preventDefault();
          this.showHelp();
          break;
      }
    });
  }

  /**
   * Private method to anonymize image data for patient viewing
   * @private
   */
  _anonymizeImageData(imageData) {
    // Remove or anonymize sensitive data for patient viewing
    const anonymized = { ...imageData };
    
    // Remove specific patient identifiers if present
    delete anonymized.patientName;
    delete anonymized.patientId;
    delete anonymized.physicianName;
    
    return anonymized;
  }

  /**
   * Private method to render the image
   * @private
   */
  async _renderImage() {
    const canvas = document.getElementById('patient-canvas');
    const ctx = canvas.getContext('2d');
    
    // Show loading indicator
    this._showLoading(true);
    
    try {
      // Placeholder for actual image rendering
      // In a real implementation, this would load and display the DICOM image
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw a placeholder indicating image content
      ctx.fillStyle = '#666';
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(this.translations.imagePlaceholder, canvas.width / 2, canvas.height / 2);
      
      this._applyTransform();
      
    } finally {
      this._showLoading(false);
    }
  }

  /**
   * Private method to apply viewport transformations
   * @private
   */
  _applyTransform() {
    const canvas = document.getElementById('patient-canvas');
    const ctx = canvas.getContext('2d');
    
    // Apply zoom and pan transformations
    ctx.setTransform(
      this.viewportState.zoom, 0, 0, this.viewportState.zoom,
      this.viewportState.pan.x, this.viewportState.pan.y
    );
  }

  /**
   * Private method to update image information display
   * @private
   */
  _updateImageInfo() {
    const infoElement = document.getElementById('image-info-content');
    if (infoElement && this.imageInfo) {
      infoElement.innerHTML = `
        <div class="info-item">
          <strong>${this.translations.imageType}:</strong> 
          ${this.imageInfo.patientFriendlyDescription}
        </div>
        ${this.imageInfo.studyDate ? `
          <div class="info-item">
            <strong>${this.translations.studyDate}:</strong> 
            ${this._formatDate(this.imageInfo.studyDate)}
          </div>
        ` : ''}
        ${this.imageInfo.bodyPart ? `
          <div class="info-item">
            <strong>${this.translations.bodyPart}:</strong> 
            ${this.imageInfo.bodyPart}
          </div>
        ` : ''}
        ${this.imageInfo.institutionName ? `
          <div class="info-item">
            <strong>${this.translations.facility}:</strong> 
            ${this.imageInfo.institutionName}
          </div>
        ` : ''}
      `;
    }
  }

  /**
   * Private method to show viewing instructions
   * @private
   */
  _showViewingInstructions() {
    const instructionsElement = document.getElementById('instructions');
    if (instructionsElement) {
      instructionsElement.style.display = 'block';
      
      // Auto-hide instructions after 10 seconds
      setTimeout(() => {
        if (instructionsElement) {
          instructionsElement.style.display = 'none';
        }
      }, 10000);
    }
  }

  /**
   * Private method to show/hide loading indicator
   * @private
   */
  _showLoading(show) {
    const loadingElement = document.getElementById('loading-indicator');
    if (loadingElement) {
      loadingElement.style.display = show ? 'flex' : 'none';
    }
  }

  /**
   * Private method to show error messages
   * @private
   */
  _showError(message) {
    const errorElement = document.getElementById('error-display');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';
      
      // Auto-hide error after 5 seconds
      setTimeout(() => {
        if (errorElement) {
          errorElement.style.display = 'none';
        }
      }, 5000);
    }
  }

  /**
   * Private method to create help modal
   * @private
   */
  _createHelpModal() {
    const modal = document.createElement('div');
    modal.className = 'help-modal-overlay';
    modal.innerHTML = `
      <div class="help-modal">
        <div class="help-header">
          <h3>${this.translations.helpTitle}</h3>
          <button class="help-close-btn" aria-label="${this.translations.close}">×</button>
        </div>
        <div class="help-content">
          <h4>${this.translations.controlsTitle}</h4>
          <ul>
            <li><strong>🔍+</strong> ${this.translations.zoomInHelp}</li>
            <li><strong>🔍-</strong> ${this.translations.zoomOutHelp}</li>
            <li><strong>↺</strong> ${this.translations.resetHelp}</li>
            <li><strong>${this.translations.doubleClick}</strong> ${this.translations.doubleClickHelp}</li>
          </ul>
          
          <h4>${this.translations.keyboardTitle}</h4>
          <ul>
            <li><strong>+ / =</strong> ${this.translations.zoomInHelp}</li>
            <li><strong>-</strong> ${this.translations.zoomOutHelp}</li>
            <li><strong>R</strong> ${this.translations.resetHelp}</li>
            <li><strong>H</strong> ${this.translations.showHelp}</li>
          </ul>
          
          <h4>${this.translations.aboutTitle}</h4>
          <p>${this.translations.aboutText}</p>
        </div>
      </div>
    `;

    // Close modal when clicking close button or overlay
    modal.addEventListener('click', (e) => {
      if (e.target.classList.contains('help-close-btn') || 
          e.target.classList.contains('help-modal-overlay')) {
        document.body.removeChild(modal);
      }
    });

    return modal;
  }

  /**
   * Private method to load translations
   * @private
   */
  _loadTranslations() {
    const translations = {
      en: {
        title: 'Your Medical Images',
        zoomIn: 'Zoom In',
        zoomOut: 'Zoom Out',
        reset: 'Reset View',
        help: 'Help',
        accessibility: 'Accessibility Mode',
        download: 'Download Image',
        imageCanvas: 'Medical image display',
        loading: 'Loading your image...',
        noImageLoaded: 'No image loaded',
        instructions: 'Use the buttons above to zoom and navigate the image. Click ? for help.',
        viewerAriaLabel: 'Medical image viewer for patients',
        imagePlaceholder: 'Medical Image',
        imageType: 'Image Type',
        studyDate: 'Study Date',
        bodyPart: 'Body Part',
        facility: 'Medical Facility',
        loadError: 'Error loading image. Please try again.',
        downloadError: 'Error downloading image.',
        viewReset: 'View reset to original size',
        helpTitle: 'How to Use the Image Viewer',
        controlsTitle: 'Controls',
        keyboardTitle: 'Keyboard Shortcuts',
        aboutTitle: 'About Your Images',
        aboutText: 'These are your medical images. You can zoom in to see details or zoom out for an overview. If you have questions about what you see, please contact your healthcare provider.',
        close: 'Close',
        doubleClick: 'Double-click',
        doubleClickHelp: 'Zoom in on the image',
        zoomInHelp: 'Make the image larger',
        zoomOutHelp: 'Make the image smaller',
        resetHelp: 'Return to original size',
        showHelp: 'Show this help dialog'
      },
      es: {
        title: 'Sus Imágenes Médicas',
        zoomIn: 'Acercar',
        zoomOut: 'Alejar',
        reset: 'Restablecer Vista',
        help: 'Ayuda',
        accessibility: 'Modo de Accesibilidad',
        download: 'Descargar Imagen',
        imageCanvas: 'Visualización de imagen médica',
        loading: 'Cargando su imagen...',
        noImageLoaded: 'No hay imagen cargada',
        instructions: 'Use los botones de arriba para hacer zoom y navegar por la imagen. Haga clic en ? para ayuda.',
        viewerAriaLabel: 'Visor de imágenes médicas para pacientes',
        imagePlaceholder: 'Imagen Médica',
        imageType: 'Tipo de Imagen',
        studyDate: 'Fecha del Estudio',
        bodyPart: 'Parte del Cuerpo',
        facility: 'Centro Médico',
        loadError: 'Error al cargar la imagen. Por favor, inténtelo de nuevo.',
        downloadError: 'Error al descargar la imagen.',
        viewReset: 'Vista restablecida al tamaño original'
      }
    };

    return translations[this.config.language] || translations.en;
  }

  /**
   * Private method to apply patient-friendly styles
   * @private
   */
  _applyPatientFriendlyStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .patient-viewer-container {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        background: #ffffff;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
      
      .patient-viewer-header {
        background: #f8f9fa;
        padding: 12px 16px;
        border-bottom: 1px solid #e0e0e0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .viewer-title {
        margin: 0;
        color: #333;
        font-size: 18px;
      }
      
      .control-btn {
        background: #007bff;
        color: white;
        border: none;
        padding: 8px 12px;
        margin: 0 4px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 16px;
        transition: background 0.2s;
      }
      
      .control-btn:hover {
        background: #0056b3;
      }
      
      .control-btn:focus {
        outline: 2px solid #ffc107;
        outline-offset: 2px;
      }
      
      .viewer-content {
        position: relative;
        background: #f5f5f5;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      
      #patient-canvas {
        border: 1px solid #ccc;
        background: white;
      }
      
      .image-loading {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
        background: rgba(255,255,255,0.9);
        padding: 20px;
        border-radius: 8px;
      }
      
      .loading-spinner {
        width: 40px;
        height: 40px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #007bff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 10px;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      .error-message {
        position: absolute;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        background: #dc3545;
        color: white;
        padding: 10px 16px;
        border-radius: 4px;
        z-index: 1000;
      }
      
      .image-info-panel {
        background: #f8f9fa;
        padding: 12px 16px;
        border-top: 1px solid #e0e0e0;
        font-size: 14px;
      }
      
      .info-item {
        margin: 4px 0;
      }
      
      .instructions-panel {
        background: #e3f2fd;
        padding: 8px 16px;
        border-top: 1px solid #bbdefb;
        font-size: 14px;
        color: #1565c0;
      }
      
      .help-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
      }
      
      .help-modal {
        background: white;
        padding: 24px;
        border-radius: 8px;
        max-width: 500px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      }
      
      .help-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        border-bottom: 1px solid #e0e0e0;
        padding-bottom: 10px;
      }
      
      .help-close-btn {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Private method to format dates for display
   * @private
   */
  _formatDate(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(this.config.language);
    } catch {
      return dateString;
    }
  }

  /**
   * Private method to announce text to screen readers
   * @private
   */
  _announceToScreenReader(text) {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.style.width = '1px';
    announcement.style.height = '1px';
    announcement.style.overflow = 'hidden';
    announcement.textContent = text;
    
    document.body.appendChild(announcement);
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }

  /**
   * Private method to update accessibility features
   * @private
   */
  _updateAccessibilityFeatures() {
    const container = document.getElementById(this.config.containerId);
    container.classList.toggle('accessibility-mode', this.config.accessibilityMode);
    
    if (this.config.accessibilityMode) {
      // Enhance accessibility features
      container.style.border = '3px solid #ffc107';
      container.style.outline = '2px solid #007bff';
    } else {
      // Restore normal appearance
      container.style.border = '2px solid #e0e0e0';
      container.style.outline = 'none';
    }
  }

  /**
   * Private method to update interface text after language change
   * @private
   */
  _updateInterface() {
    // Re-render the interface with new translations
    if (this.isInitialized) {
      const container = document.getElementById(this.config.containerId);
      this._setupViewerInterface(container);
      this._setupEventListeners();
      
      if (this.currentImage) {
        this._renderImage();
        this._updateImageInfo();
      }
    }
  }

  /**
   * Private method to trigger custom events
   * @private
   */
  _triggerEvent(eventName, data = {}) {
    const event = new CustomEvent(eventName, { detail: data });
    document.dispatchEvent(event);
  }
}

/**
 * Factory function to create PatientImageViewer instance
 * @param {Object} config - Configuration options
 * @returns {PatientImageViewer} - New viewer instance
 */
function createPatientImageViewer(config = {}) {
  return new PatientImageViewer(config);
}

// Export for CommonJS and ES modules compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PatientImageViewer,
    PatientViewerConfig,
    ImageInfo,
    createPatientImageViewer
  };
}

// ES module export
export { 
  PatientImageViewer, 
  PatientViewerConfig, 
  ImageInfo, 
  createPatientImageViewer 
};

// Default export
export default PatientImageViewer;