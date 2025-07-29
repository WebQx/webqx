/**
 * Utility functions for WebQX™ OHIF Integration
 */

import { 
  ImagingWorkflow, 
  WebQXStudyMetadata, 
  MedicalSpecialty, 
  UserRole,
  WorkflowStep,
  UIConfiguration 
} from '../types';

/**
 * Create a custom imaging workflow
 */
export function createImagingWorkflow(
  id: string,
  name: string,
  specialty: MedicalSpecialty,
  steps: Omit<WorkflowStep, 'id'>[]
): ImagingWorkflow {
  const workflowSteps: WorkflowStep[] = steps.map((step, index) => ({
    id: `${id}_step_${index + 1}`,
    ...step,
    order: step.order || index + 1
  }));

  return {
    id,
    name,
    specialty,
    steps: workflowSteps,
    permissions: getWorkflowPermissions(specialty),
    uiConfig: getDefaultUIConfig(specialty)
  };
}

/**
 * Validate DICOM data structure
 */
export function validateDICOMData(data: any): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // Check required DICOM fields
  const requiredFields = [
    'studyInstanceUID',
    'patientID',
    'patientName'
  ];

  return requiredFields.every(field => data[field] !== undefined);
}

/**
 * Get default permissions for workflow specialty
 */
function getWorkflowPermissions(specialty: MedicalSpecialty) {
  const permissionMap = {
    'radiology': ['view_images', 'annotate_images', 'measure_images', 'download_images'],
    'cardiology': ['view_images', 'measure_images', 'annotate_images'],
    'oncology': ['view_images', 'annotate_images', 'share_studies'],
    'neurology': ['view_images', 'measure_images'],
    'orthopedics': ['view_images', 'measure_images'],
    'primary_care': ['view_images'],
    'emergency': ['view_images', 'share_studies'],
    'pathology': ['view_images', 'annotate_images', 'measure_images']
  };

  return permissionMap[specialty] || ['view_images'];
}

/**
 * Get default UI configuration for specialty
 */
function getDefaultUIConfig(specialty: MedicalSpecialty): UIConfiguration {
  const baseConfig: UIConfiguration = {
    layout: {
      type: 'grid',
      rows: 1,
      columns: 2,
      viewports: [
        { id: 'viewport-1', position: { row: 0, col: 0 }, defaultTool: 'zoom' },
        { id: 'viewport-2', position: { row: 0, col: 1 }, defaultTool: 'windowLevel' }
      ]
    },
    panels: [
      {
        id: 'study-panel',
        position: 'left',
        width: 300,
        collapsible: true,
        defaultCollapsed: false,
        components: ['studyBrowser', 'seriesList']
      },
      {
        id: 'tool-panel',
        position: 'right',
        width: 250,
        collapsible: true,
        defaultCollapsed: false,
        components: ['tools', 'annotations']
      }
    ],
    tools: [
      {
        id: 'zoom',
        name: 'Zoom',
        icon: 'zoom',
        category: 'manipulation',
        permissions: ['view_images'],
        enabled: true
      },
      {
        id: 'pan',
        name: 'Pan',
        icon: 'pan',
        category: 'manipulation',
        permissions: ['view_images'],
        enabled: true
      },
      {
        id: 'windowLevel',
        name: 'Window/Level',
        icon: 'windowLevel',
        category: 'manipulation',
        permissions: ['view_images'],
        enabled: true
      }
    ],
    theme: {
      name: 'webqx-default',
      colors: {
        primary: '#1976d2',
        secondary: '#424242',
        background: '#fafafa',
        surface: '#ffffff',
        text: '#212121',
        border: '#e0e0e0',
        accent: '#2196f3',
        warning: '#ff9800',
        error: '#f44336',
        success: '#4caf50'
      },
      typography: {
        fontFamily: 'Roboto, sans-serif',
        fontSize: {
          small: '12px',
          medium: '14px',
          large: '16px'
        },
        fontWeight: {
          light: 300,
          normal: 400,
          medium: 500,
          bold: 700
        },
        lineHeight: {
          tight: 1.2,
          normal: 1.5,
          loose: 1.8
        }
      },
      spacing: {
        unit: 8,
        scale: [0, 4, 8, 16, 24, 32, 40, 48, 56, 64]
      },
      animations: {
        duration: {
          short: 150,
          medium: 300,
          long: 500
        },
        easing: {
          easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
          easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
          easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)'
        }
      }
    }
  };

  // Specialty-specific customizations
  switch (specialty) {
    case 'radiology':
      baseConfig.tools.push(
        {
          id: 'length',
          name: 'Length Measurement',
          icon: 'length',
          category: 'measurement',
          permissions: ['measure_images'],
          enabled: true
        },
        {
          id: 'annotation',
          name: 'Annotation',
          icon: 'annotation',
          category: 'annotation',
          permissions: ['annotate_images'],
          enabled: true
        }
      );
      baseConfig.theme.name = 'webqx-radiology';
      baseConfig.theme.colors.background = '#121212';
      baseConfig.theme.colors.surface = '#1e1e1e';
      baseConfig.theme.colors.text = '#ffffff';
      break;

    case 'cardiology':
      baseConfig.layout.rows = 2;
      baseConfig.layout.columns = 2;
      baseConfig.layout.viewports = [
        { id: 'viewport-1', position: { row: 0, col: 0 } },
        { id: 'viewport-2', position: { row: 0, col: 1 } },
        { id: 'viewport-3', position: { row: 1, col: 0 } },
        { id: 'viewport-4', position: { row: 1, col: 1 } }
      ];
      baseConfig.tools.push({
        id: 'cardiac-measurement',
        name: 'Cardiac Measurement',
        icon: 'heart',
        category: 'measurement',
        permissions: ['measure_images'],
        enabled: true
      });
      break;

    case 'oncology':
      baseConfig.tools.push(
        {
          id: 'tumor-measurement',
          name: 'Tumor Measurement',
          icon: 'measure',
          category: 'measurement',
          permissions: ['measure_images'],
          enabled: true
        },
        {
          id: 'lesion-annotation',
          name: 'Lesion Annotation',
          icon: 'target',
          category: 'annotation',
          permissions: ['annotate_images'],
          enabled: true
        }
      );
      break;
  }

  return baseConfig;
}