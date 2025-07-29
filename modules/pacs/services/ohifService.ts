/**
 * OHIF Viewer Service
 * 
 * Service for integrating with OHIF viewer for DICOM image visualization.
 */

import { 
  OHIFConfiguration, 
  SpecialtyViewerSettings,
  MedicalSpecialty,
  PACSServiceError 
} from '../types';

export class OHIFService {
  private config: OHIFConfiguration;
  private baseUrl: string;

  constructor(config: OHIFConfiguration) {
    this.config = config;
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Generate OHIF viewer URL for a study
   */
  generateViewerUrl(studyInstanceUID: string, viewerSettings?: SpecialtyViewerSettings): string {
    try {
      const params = new URLSearchParams();
      
      // Basic study parameters
      params.set('studyInstanceUIDs', studyInstanceUID);
      params.set('wadoRsRoot', this.config.wadoRsRoot);
      params.set('qidoRsRoot', this.config.qidoRsRoot);

      // Viewer configuration
      if (viewerSettings) {
        params.set('layout', viewerSettings.layoutPreference);
        
        // Window/Level presets
        if (viewerSettings.defaultWindowing.length > 0) {
          const windowingPreset = viewerSettings.defaultWindowing[0];
          params.set('windowCenter', windowingPreset.windowCenter.toString());
          params.set('windowWidth', windowingPreset.windowWidth.toString());
        }

        // Enabled tools
        if (viewerSettings.enabledTools.length > 0) {
          params.set('tools', viewerSettings.enabledTools.join(','));
        }
      }

      // Default configuration
      if (this.config.defaultLayout) {
        params.set('layout', this.config.defaultLayout);
      }

      params.set('enableMeasurements', this.config.enableMeasurements.toString());
      params.set('enableAnnotations', this.config.enableAnnotations.toString());

      return `${this.baseUrl}/viewer?${params.toString()}`;

    } catch (error) {
      throw new PACSServiceError('OHIF_URL_GENERATION_FAILED', `Failed to generate OHIF URL: ${error.message}`);
    }
  }

  /**
   * Generate embedded viewer configuration
   */
  generateEmbeddedConfig(studyInstanceUID: string, specialty: MedicalSpecialty): any {
    const specialtyPreset = this.config.viewerPresets.find(preset => preset.specialty === specialty);
    
    return {
      studyInstanceUIDs: [studyInstanceUID],
      dataSources: [
        {
          namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
          configuration: {
            friendlyName: 'WebQX PACS',
            name: 'webqx',
            wadoRsRoot: this.config.wadoRsRoot,
            qidoRsRoot: this.config.qidoRsRoot,
            wadoUriRoot: this.config.wadoRsRoot.replace('/wado-rs', '/wado'),
            qidoSupportsIncludeField: true,
            supportsReject: false,
            imageRendering: 'wadors',
            thumbnailRendering: 'wadors',
            enableStudyLazyLoad: true,
            supportsFuzzyMatching: false,
            supportsWildcard: true,
            staticWado: true
          }
        }
      ],
      defaultDataSourceName: 'webqx',
      hotkeys: [
        { commandName: 'incrementActiveViewport', label: 'Next Viewport', keys: ['right'] },
        { commandName: 'decrementActiveViewport', label: 'Previous Viewport', keys: ['left'] },
        { commandName: 'rotateViewportCW', label: 'Rotate Right', keys: ['r'] },
        { commandName: 'rotateViewportCCW', label: 'Rotate Left', keys: ['l'] },
        { commandName: 'invertViewport', label: 'Invert', keys: ['i'] },
        { commandName: 'flipViewportVertical', label: 'Flip Horizontally', keys: ['h'] },
        { commandName: 'flipViewportHorizontal', label: 'Flip Vertically', keys: ['v'] },
        { commandName: 'scaleUpViewport', label: 'Zoom In', keys: ['+'] },
        { commandName: 'scaleDownViewport', label: 'Zoom Out', keys: ['-'] },
        { commandName: 'fitViewportToWindow', label: 'Zoom to Fit', keys: ['='] },
        { commandName: 'resetViewport', label: 'Reset', keys: ['space'] }
      ],
      cornerstoneExtensionConfig: {
        tools: this.getSpecialtyTools(specialty),
        enableCineDialog: specialty === 'cardiology',
        enableSRDisplay: true
      },
      whiteLabeling: {
        createLogoComponentFn: () => null,
        appTitle: 'WebQX PACS Viewer'
      },
      showStudyList: false,
      maxNumberOfWebWorkers: 4,
      showLoadingIndicator: true,
      strictZSpacingForVolumeViewport: true,
      ...(specialtyPreset && {
        layout: specialtyPreset.layout,
        tools: specialtyPreset.tools,
        windowing: specialtyPreset.windowing
      })
    };
  }

  /**
   * Get viewer embed code for patient portal
   */
  getEmbedCode(studyInstanceUID: string, specialty: MedicalSpecialty, width = '100%', height = '600px'): string {
    const config = this.generateEmbeddedConfig(studyInstanceUID, specialty);
    
    return `
      <div id="ohif-viewer" style="width: ${width}; height: ${height};"></div>
      <script>
        window.config = ${JSON.stringify(config)};
        window.ohifViewer = {
          installViewer: function() {
            // OHIF viewer initialization code would go here
            console.log('OHIF Viewer initialized with config:', window.config);
          }
        };
        
        // Initialize viewer when DOM is ready
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', window.ohifViewer.installViewer);
        } else {
          window.ohifViewer.installViewer();
        }
      </script>
    `;
  }

  /**
   * Generate study thumbnail URL
   */
  getThumbnailUrl(studyInstanceUID: string, seriesInstanceUID?: string, instanceNumber = 1): string {
    let path = `/studies/${studyInstanceUID}`;
    
    if (seriesInstanceUID) {
      path += `/series/${seriesInstanceUID}`;
    }
    
    path += `/instances/${instanceNumber}/rendered?thumbnail=true&viewport=256x256`;
    
    return `${this.config.wadoRsRoot}${path}`;
  }

  /**
   * Get available viewer layouts for a specialty
   */
  getSpecialtyLayouts(specialty: MedicalSpecialty): string[] {
    const specialtyLayouts: Record<MedicalSpecialty, string[]> = {
      'radiology': ['oneByOne', 'oneByTwo', 'twoByTwo', 'twoByThree'],
      'cardiology': ['oneByOne', 'oneByTwo', 'mpr'],
      'orthopedics': ['oneByOne', 'oneByTwo', 'twoByTwo', 'mpr'],
      'neurology': ['oneByOne', 'oneByTwo', 'mpr', 'volume'],
      'oncology': ['oneByOne', 'oneByTwo', 'twoByTwo', 'fusion'],
      'pulmonology': ['oneByOne', 'oneByTwo', 'twoByTwo'],
      'gastroenterology': ['oneByOne', 'oneByTwo'],
      'pediatrics': ['oneByOne', 'oneByTwo'],
      'emergency': ['oneByOne', 'oneByTwo', 'twoByTwo'],
      'primary-care': ['oneByOne', 'oneByTwo']
    };

    return specialtyLayouts[specialty] || ['oneByOne', 'oneByTwo'];
  }

  // Private helper methods

  private getSpecialtyTools(specialty: MedicalSpecialty): string[] {
    const specialtyTools: Record<MedicalSpecialty, string[]> = {
      'radiology': [
        'WindowLevel', 'Zoom', 'Pan', 'Length', 'Bidirectional', 
        'EllipticalRoi', 'RectangleRoi', 'Angle', 'Probe', 'Cine'
      ],
      'cardiology': [
        'WindowLevel', 'Zoom', 'Pan', 'Length', 'Bidirectional',
        'Angle', 'Cine', 'PlayClip', 'HeartRate', 'EjectionFraction'
      ],
      'orthopedics': [
        'WindowLevel', 'Zoom', 'Pan', 'Length', 'Bidirectional',
        'Angle', 'CobbAngle', 'EllipticalRoi', 'RectangleRoi'
      ],
      'neurology': [
        'WindowLevel', 'Zoom', 'Pan', 'Length', 'Bidirectional',
        'EllipticalRoi', 'RectangleRoi', 'Angle', 'Crosshairs', 'MPR'
      ],
      'oncology': [
        'WindowLevel', 'Zoom', 'Pan', 'Length', 'Bidirectional',
        'EllipticalRoi', 'RectangleRoi', 'Angle', 'SUVDisplay', 'PETFusion'
      ],
      'pulmonology': [
        'WindowLevel', 'Zoom', 'Pan', 'Length', 'Bidirectional',
        'EllipticalRoi', 'RectangleRoi', 'Angle', 'LungSegmentation'
      ],
      'gastroenterology': [
        'WindowLevel', 'Zoom', 'Pan', 'Length', 'Bidirectional',
        'EllipticalRoi', 'RectangleRoi', 'Angle'
      ],
      'pediatrics': [
        'WindowLevel', 'Zoom', 'Pan', 'Length', 'Bidirectional',
        'EllipticalRoi', 'RectangleRoi', 'Angle'
      ],
      'emergency': [
        'WindowLevel', 'Zoom', 'Pan', 'Length', 'Bidirectional',
        'EllipticalRoi', 'RectangleRoi', 'Angle', 'Probe'
      ],
      'primary-care': [
        'WindowLevel', 'Zoom', 'Pan', 'Length', 'Bidirectional',
        'EllipticalRoi', 'RectangleRoi'
      ]
    };

    return specialtyTools[specialty] || specialtyTools['primary-care'];
  }
}