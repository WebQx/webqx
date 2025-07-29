/**
 * PACS Viewer Component
 * 
 * Web-based DICOM image viewer with specialty-specific customization
 * and integrated routing capabilities.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

class PacsViewer {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      specialty: 'radiology',
      enableMeasurements: true,
      enableAnnotations: true,
      enableWindowLeveling: true,
      enableZoom: true,
      enablePan: true,
      apiBaseUrl: '/fhir/ImagingStudy',
      ...options
    };
    
    this.currentStudy = null;
    this.currentSeries = null;
    this.currentInstance = 0;
    this.images = [];
    this.canvas = null;
    this.ctx = null;
    
    this.init();
  }

  /**
   * Initialize the viewer
   */
  init() {
    this.createViewerUI();
    this.setupEventListeners();
    this.loadSpecialtyConfig();
  }

  /**
   * Create the viewer user interface
   */
  createViewerUI() {
    this.container.innerHTML = `
      <div class="pacs-viewer">
        <div class="pacs-toolbar">
          <div class="toolbar-group">
            <button id="zoom-in" class="tool-btn" title="Zoom In">🔍+</button>
            <button id="zoom-out" class="tool-btn" title="Zoom Out">🔍-</button>
            <button id="pan-tool" class="tool-btn" title="Pan">✋</button>
            <button id="window-level" class="tool-btn" title="Window/Level">🔳</button>
          </div>
          <div class="toolbar-group">
            <button id="measure-tool" class="tool-btn" title="Measure">📏</button>
            <button id="annotate-tool" class="tool-btn" title="Annotate">✏️</button>
            <button id="reset-view" class="tool-btn" title="Reset">🔄</button>
          </div>
          <div class="toolbar-group">
            <span class="study-info" id="study-info"></span>
          </div>
          <div class="toolbar-group">
            <select id="specialty-filter" class="specialty-select">
              <option value="">All Specialties</option>
              <option value="radiology">Radiology</option>
              <option value="cardiology">Cardiology</option>
              <option value="orthopedics">Orthopedics</option>
              <option value="neurology">Neurology</option>
              <option value="pulmonology">Pulmonology</option>
            </select>
          </div>
        </div>
        
        <div class="pacs-content">
          <div class="pacs-sidebar">
            <div class="study-list" id="study-list">
              <h3>Studies</h3>
              <div class="studies-container" id="studies-container">
                <!-- Studies will be loaded here -->
              </div>
            </div>
            
            <div class="series-list" id="series-list">
              <h3>Series</h3>
              <div class="series-container" id="series-container">
                <!-- Series will be loaded here -->
              </div>
            </div>
          </div>
          
          <div class="pacs-viewport">
            <canvas id="dicom-canvas" class="dicom-canvas"></canvas>
            <div class="viewport-info" id="viewport-info">
              <div class="patient-info" id="patient-info"></div>
              <div class="study-details" id="study-details"></div>
              <div class="image-info" id="image-info"></div>
            </div>
          </div>
          
          <div class="pacs-controls">
            <div class="instance-navigator">
              <button id="prev-instance" class="nav-btn">◀</button>
              <span id="instance-counter">1 / 1</span>
              <button id="next-instance" class="nav-btn">▶</button>
            </div>
            
            <div class="specialty-panel" id="specialty-panel">
              <!-- Specialty-specific tools will be loaded here -->
            </div>
            
            <div class="routing-panel" id="routing-panel">
              <h4>Routing Information</h4>
              <div class="routing-info" id="routing-info">
                <!-- Routing details will be displayed here -->
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add CSS styles
    this.addViewerStyles();
    
    // Setup canvas
    this.canvas = document.getElementById('dicom-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();
  }

  /**
   * Add CSS styles for the viewer
   */
  addViewerStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .pacs-viewer {
        display: flex;
        flex-direction: column;
        height: 100vh;
        background: #1a1a1a;
        color: #ffffff;
        font-family: Arial, sans-serif;
      }

      .pacs-toolbar {
        display: flex;
        gap: 20px;
        padding: 10px;
        background: #2d2d2d;
        border-bottom: 1px solid #444;
        align-items: center;
      }

      .toolbar-group {
        display: flex;
        gap: 5px;
        align-items: center;
      }

      .tool-btn {
        padding: 8px 12px;
        background: #444;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      }

      .tool-btn:hover {
        background: #555;
      }

      .tool-btn.active {
        background: #0066cc;
      }

      .specialty-select {
        padding: 6px 10px;
        background: #444;
        color: white;
        border: 1px solid #666;
        border-radius: 4px;
      }

      .pacs-content {
        display: flex;
        flex: 1;
        overflow: hidden;
      }

      .pacs-sidebar {
        width: 250px;
        background: #2d2d2d;
        border-right: 1px solid #444;
        display: flex;
        flex-direction: column;
      }

      .study-list, .series-list {
        flex: 1;
        padding: 10px;
        overflow-y: auto;
      }

      .study-list h3, .series-list h3 {
        margin: 0 0 10px 0;
        font-size: 14px;
        color: #ccc;
      }

      .study-item, .series-item {
        padding: 8px;
        margin: 5px 0;
        background: #3d3d3d;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }

      .study-item:hover, .series-item:hover {
        background: #4d4d4d;
      }

      .study-item.selected, .series-item.selected {
        background: #0066cc;
      }

      .pacs-viewport {
        flex: 1;
        position: relative;
        background: #000;
      }

      .dicom-canvas {
        width: 100%;
        height: 100%;
        cursor: crosshair;
      }

      .viewport-info {
        position: absolute;
        top: 10px;
        left: 10px;
        background: rgba(0, 0, 0, 0.7);
        padding: 10px;
        border-radius: 4px;
        font-size: 12px;
        max-width: 250px;
      }

      .pacs-controls {
        width: 250px;
        background: #2d2d2d;
        border-left: 1px solid #444;
        padding: 10px;
        overflow-y: auto;
      }

      .instance-navigator {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        margin-bottom: 20px;
      }

      .nav-btn {
        padding: 8px 12px;
        background: #444;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }

      .nav-btn:hover {
        background: #555;
      }

      .nav-btn:disabled {
        background: #333;
        cursor: not-allowed;
      }

      .specialty-panel, .routing-panel {
        margin-bottom: 20px;
      }

      .specialty-panel h4, .routing-panel h4 {
        margin: 0 0 10px 0;
        font-size: 14px;
        color: #ccc;
      }

      .routing-info {
        background: #3d3d3d;
        padding: 10px;
        border-radius: 4px;
        font-size: 12px;
      }

      .routing-specialty {
        color: #4CAF50;
        font-weight: bold;
      }

      .routing-priority {
        color: #FF9800;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Toolbar controls
    document.getElementById('zoom-in').addEventListener('click', () => this.zoomIn());
    document.getElementById('zoom-out').addEventListener('click', () => this.zoomOut());
    document.getElementById('reset-view').addEventListener('click', () => this.resetView());
    
    // Navigation controls
    document.getElementById('prev-instance').addEventListener('click', () => this.previousInstance());
    document.getElementById('next-instance').addEventListener('click', () => this.nextInstance());
    
    // Specialty filter
    document.getElementById('specialty-filter').addEventListener('change', (e) => {
      this.filterBySpecialty(e.target.value);
    });

    // Canvas interactions
    this.setupCanvasEvents();
    
    // Window resize
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  /**
   * Setup canvas event handlers
   */
  setupCanvasEvents() {
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    this.canvas.addEventListener('mousedown', (e) => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const deltaX = e.clientX - lastX;
        const deltaY = e.clientY - lastY;
        this.pan(deltaX, deltaY);
        lastX = e.clientX;
        lastY = e.clientY;
      }
    });

    this.canvas.addEventListener('mouseup', () => {
      isDragging = false;
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        this.zoomIn();
      } else {
        this.zoomOut();
      }
    });
  }

  /**
   * Load studies for a patient
   */
  async loadStudies(patientId) {
    try {
      const response = await fetch(`${this.options.apiBaseUrl}?patient=Patient/${patientId}`);
      const bundle = await response.json();
      
      if (bundle.resourceType === 'Bundle') {
        this.displayStudies(bundle.entry.map(entry => entry.resource));
      }
    } catch (error) {
      console.error('Failed to load studies:', error);
    }
  }

  /**
   * Display studies in the sidebar
   */
  displayStudies(studies) {
    const container = document.getElementById('studies-container');
    container.innerHTML = '';
    
    studies.forEach(study => {
      const studyItem = document.createElement('div');
      studyItem.className = 'study-item';
      studyItem.innerHTML = `
        <div><strong>${study.description || 'Study'}</strong></div>
        <div>Date: ${new Date(study.started).toLocaleDateString()}</div>
        <div>Modality: ${study.modality?.[0]?.display || 'Unknown'}</div>
        <div>Series: ${study.numberOfSeries || 0}</div>
      `;
      
      studyItem.addEventListener('click', () => this.selectStudy(study));
      container.appendChild(studyItem);
    });
  }

  /**
   * Select a study and load its series
   */
  async selectStudy(study) {
    this.currentStudy = study;
    
    // Update selection UI
    document.querySelectorAll('.study-item').forEach(item => item.classList.remove('selected'));
    event.target.closest('.study-item').classList.add('selected');
    
    // Load routing information
    await this.loadRoutingInfo(study.id);
    
    // Display series
    this.displaySeries(study.series || []);
    
    // Update study info
    this.updateStudyInfo(study);
  }

  /**
   * Display series for the selected study
   */
  displaySeries(series) {
    const container = document.getElementById('series-container');
    container.innerHTML = '';
    
    series.forEach((s, index) => {
      const seriesItem = document.createElement('div');
      seriesItem.className = 'series-item';
      seriesItem.innerHTML = `
        <div><strong>Series ${s.number || index + 1}</strong></div>
        <div>${s.description || 'No description'}</div>
        <div>Instances: ${s.numberOfInstances || 0}</div>
        <div>Modality: ${s.modality?.display || 'Unknown'}</div>
      `;
      
      seriesItem.addEventListener('click', () => this.selectSeries(s, index));
      container.appendChild(seriesItem);
    });
  }

  /**
   * Select a series and load its images
   */
  async selectSeries(series, index) {
    this.currentSeries = series;
    this.currentInstance = 0;
    
    // Update selection UI
    document.querySelectorAll('.series-item').forEach(item => item.classList.remove('selected'));
    event.target.closest('.series-item').classList.add('selected');
    
    // Load images for this series
    await this.loadImages(this.currentStudy.id, series.uid);
    
    // Update navigation
    this.updateInstanceNavigation();
  }

  /**
   * Load images for a series
   */
  async loadImages(studyId, seriesId) {
    try {
      const response = await fetch(`${this.options.apiBaseUrl}/${studyId}/$images?series=${seriesId}`);
      const bundle = await response.json();
      
      if (bundle.resourceType === 'Bundle') {
        this.images = bundle.entry.map(entry => entry.resource);
        if (this.images.length > 0) {
          this.displayImage(0);
        }
      }
    } catch (error) {
      console.error('Failed to load images:', error);
    }
  }

  /**
   * Display an image on the canvas
   */
  displayImage(index) {
    if (index < 0 || index >= this.images.length) return;
    
    this.currentInstance = index;
    const image = this.images[index];
    
    // In a real implementation, this would load and display DICOM image data
    // For now, show a placeholder
    this.ctx.fillStyle = '#333';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '20px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(
      `DICOM Image ${index + 1}`,
      this.canvas.width / 2,
      this.canvas.height / 2
    );
    
    this.ctx.fillText(
      `URL: ${image.url}`,
      this.canvas.width / 2,
      this.canvas.height / 2 + 30
    );
    
    this.updateImageInfo(image);
    this.updateInstanceNavigation();
  }

  /**
   * Load and display routing information
   */
  async loadRoutingInfo(studyId) {
    try {
      const response = await fetch(`${this.options.apiBaseUrl}/${studyId}/$route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      const params = await response.json();
      this.displayRoutingInfo(params);
    } catch (error) {
      console.error('Failed to load routing info:', error);
    }
  }

  /**
   * Display routing information
   */
  displayRoutingInfo(params) {
    const container = document.getElementById('routing-info');
    const routing = {};
    
    params.parameter?.forEach(param => {
      routing[param.name] = param.valueString || param.valueCode;
    });
    
    container.innerHTML = `
      <div>Primary: <span class="routing-specialty">${routing.primarySpecialty || 'N/A'}</span></div>
      <div>Priority: <span class="routing-priority">${routing.priority || 'normal'}</span></div>
      <div>Rule: ${routing.routingRule || 'default'}</div>
      ${routing.secondarySpecialties ? `<div>Secondary: ${routing.secondarySpecialties}</div>` : ''}
    `;
  }

  /**
   * Update study information display
   */
  updateStudyInfo(study) {
    document.getElementById('study-info').textContent = 
      `${study.description || 'Study'} - ${study.subject?.display || 'Unknown Patient'}`;
    
    document.getElementById('patient-info').innerHTML = `
      <div><strong>Patient:</strong> ${study.subject?.display || 'Unknown'}</div>
      <div><strong>Study Date:</strong> ${new Date(study.started).toLocaleDateString()}</div>
    `;
    
    document.getElementById('study-details').innerHTML = `
      <div><strong>Study:</strong> ${study.description || 'N/A'}</div>
      <div><strong>Modality:</strong> ${study.modality?.[0]?.display || 'Unknown'}</div>
      <div><strong>Series:</strong> ${study.numberOfSeries || 0}</div>
      <div><strong>Images:</strong> ${study.numberOfInstances || 0}</div>
    `;
  }

  /**
   * Update image information display
   */
  updateImageInfo(image) {
    document.getElementById('image-info').innerHTML = `
      <div><strong>Instance:</strong> ${this.currentInstance + 1} / ${this.images.length}</div>
      <div><strong>Type:</strong> ${image.contentType || 'Unknown'}</div>
    `;
  }

  /**
   * Update instance navigation controls
   */
  updateInstanceNavigation() {
    document.getElementById('instance-counter').textContent = 
      `${this.currentInstance + 1} / ${this.images.length}`;
    
    document.getElementById('prev-instance').disabled = this.currentInstance === 0;
    document.getElementById('next-instance').disabled = this.currentInstance >= this.images.length - 1;
  }

  /**
   * Navigation methods
   */
  previousInstance() {
    if (this.currentInstance > 0) {
      this.displayImage(this.currentInstance - 1);
    }
  }

  nextInstance() {
    if (this.currentInstance < this.images.length - 1) {
      this.displayImage(this.currentInstance + 1);
    }
  }

  /**
   * Zoom and pan methods
   */
  zoomIn() {
    // Implement zoom in functionality
    console.log('Zoom in');
  }

  zoomOut() {
    // Implement zoom out functionality
    console.log('Zoom out');
  }

  pan(deltaX, deltaY) {
    // Implement pan functionality
    console.log('Pan:', deltaX, deltaY);
  }

  resetView() {
    // Reset zoom and pan to default
    this.displayImage(this.currentInstance);
  }

  /**
   * Filter studies by specialty
   */
  filterBySpecialty(specialty) {
    // Implement specialty-based filtering
    console.log('Filter by specialty:', specialty);
  }

  /**
   * Load specialty-specific configuration
   */
  loadSpecialtyConfig() {
    // Load specialty-specific tools and settings
    const specialtyPanel = document.getElementById('specialty-panel');
    
    switch (this.options.specialty) {
      case 'cardiology':
        specialtyPanel.innerHTML = `
          <h4>Cardiology Tools</h4>
          <button class="tool-btn">Cardiac Function</button>
          <button class="tool-btn">EF Calculation</button>
        `;
        break;
      case 'orthopedics':
        specialtyPanel.innerHTML = `
          <h4>Orthopedic Tools</h4>
          <button class="tool-btn">Angle Measurement</button>
          <button class="tool-btn">Bone Density</button>
        `;
        break;
      default:
        specialtyPanel.innerHTML = `
          <h4>General Tools</h4>
          <button class="tool-btn">Distance</button>
          <button class="tool-btn">Area</button>
        `;
    }
  }

  /**
   * Resize canvas to fit viewport
   */
  resizeCanvas() {
    const viewport = document.querySelector('.pacs-viewport');
    if (viewport && this.canvas) {
      this.canvas.width = viewport.clientWidth;
      this.canvas.height = viewport.clientHeight;
      
      // Redraw current image if available
      if (this.images.length > 0) {
        this.displayImage(this.currentInstance);
      }
    }
  }
}

// Make PacsViewer available globally
window.PacsViewer = PacsViewer;