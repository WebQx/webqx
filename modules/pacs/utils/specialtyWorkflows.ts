/**
 * Specialty Workflows Configuration
 * 
 * Specialty-specific workflow configurations for different medical disciplines.
 */

import { 
  SpecialtyWorkflowConfiguration, 
  MedicalSpecialty, 
  DICOMTag, 
  ProcessingRule,
  WindowingPreset 
} from '../types';

export class SpecialtyWorkflows {
  /**
   * Get all available specialty workflows
   */
  static getAllWorkflows(): SpecialtyWorkflowConfiguration[] {
    return [
      this.getRadiologyWorkflow(),
      this.getCardiologyWorkflow(),
      this.getOrthopedicsWorkflow(),
      this.getNeurologyWorkflow(),
      this.getOncologyWorkflow(),
      this.getPulmonologyWorkflow(),
      this.getGastroenterologyWorkflow(),
      this.getPediatricsWorkflow(),
      this.getEmergencyWorkflow(),
      this.getPrimaryCareWorkflow()
    ];
  }

  /**
   * Get workflow by specialty
   */
  static getWorkflowBySpecialty(specialty: MedicalSpecialty): SpecialtyWorkflowConfiguration | null {
    const workflows = this.getAllWorkflows();
    return workflows.find(w => w.specialty === specialty) || null;
  }

  /**
   * Radiology Workflow Configuration
   */
  static getRadiologyWorkflow(): SpecialtyWorkflowConfiguration {
    return {
      specialty: 'radiology',
      name: 'General Radiology Workflow',
      description: 'Comprehensive workflow for general radiological imaging including CT, MR, X-ray, and ultrasound studies.',
      defaultModalitities: ['CT', 'MR', 'CR', 'DR', 'DX', 'US', 'RF', 'MG'],
      requiredFields: ['studyInstanceUID', 'patientID', 'studyDate', 'modality'],
      customTags: [
        {
          group: '0008',
          element: '1030',
          vr: 'LO',
          name: 'StudyDescription',
          description: 'Description of the study',
          required: true,
          defaultValue: ''
        },
        {
          group: '0018',
          element: '0050',
          vr: 'DS',
          name: 'SliceThickness',
          description: 'Thickness of the image slice',
          required: false,
          defaultValue: null
        },
        {
          group: '0028',
          element: '1050',
          vr: 'DS',
          name: 'WindowCenter',
          description: 'Window center for display',
          required: false,
          defaultValue: null
        }
      ],
      reportTemplate: 'radiology-standard-report',
      autoProcessingRules: [
        {
          name: 'Auto-route urgent studies',
          condition: 'studyDescription.includes("STAT") || studyDescription.includes("URGENT")',
          action: 'setPriority',
          parameters: { priority: 'urgent', notifyRadiologist: true }
        },
        {
          name: 'Auto-apply bone windowing for orthopedic studies',
          condition: 'bodyPart.includes("bone") || bodyPart.includes("joint")',
          action: 'setDefaultWindowing',
          parameters: { windowCenter: 400, windowWidth: 1000 }
        }
      ],
      viewerSettings: {
        defaultWindowing: [
          { name: 'Soft Tissue', windowCenter: 40, windowWidth: 400 },
          { name: 'Lung', windowCenter: -600, windowWidth: 1600 },
          { name: 'Bone', windowCenter: 400, windowWidth: 1000 },
          { name: 'Brain', windowCenter: 40, windowWidth: 80 }
        ],
        enabledTools: [
          'WindowLevel', 'Zoom', 'Pan', 'Length', 'Bidirectional',
          'EllipticalRoi', 'RectangleRoi', 'Angle', 'Probe', 'Cine'
        ],
        layoutPreference: 'oneByTwo',
        measurementUnits: 'mm',
        annotationSettings: {
          enableRuler: true,
          enableAngle: true,
          enableFreehand: true,
          enableText: true,
          defaultColor: '#FFFF00',
          defaultThickness: 2
        }
      }
    };
  }

  /**
   * Cardiology Workflow Configuration
   */
  static getCardiologyWorkflow(): SpecialtyWorkflowConfiguration {
    return {
      specialty: 'cardiology',
      name: 'Cardiology Imaging Workflow',
      description: 'Specialized workflow for cardiac imaging including angiography, echocardiography, and cardiac CT/MR.',
      defaultModalitities: ['XA', 'ES', 'CT', 'MR', 'US'],
      requiredFields: ['studyInstanceUID', 'patientID', 'studyDate', 'modality', 'heartRate'],
      customTags: [
        {
          group: '0018',
          element: '1088',
          vr: 'IS',
          name: 'HeartRate',
          description: 'Heart rate in beats per minute',
          required: true,
          defaultValue: null
        },
        {
          group: '0018',
          element: '1060',
          vr: 'DS',
          name: 'TriggerTime',
          description: 'Trigger time for cardiac gating',
          required: false,
          defaultValue: null
        }
      ],
      reportTemplate: 'cardiology-cardiac-report',
      autoProcessingRules: [
        {
          name: 'Auto-calculate ejection fraction',
          condition: 'modality === "ES" && studyDescription.includes("ECHO")',
          action: 'calculateEjectionFraction',
          parameters: { method: 'biplane' }
        },
        {
          name: 'Auto-detect arrhythmia',
          condition: 'heartRate < 60 || heartRate > 100',
          action: 'flagForReview',
          parameters: { reason: 'arrhythmia_detected' }
        }
      ],
      viewerSettings: {
        defaultWindowing: [
          { name: 'Cardiac', windowCenter: 50, windowWidth: 350 },
          { name: 'Vessel', windowCenter: 200, windowWidth: 700 },
          { name: 'Mediastinum', windowCenter: 50, windowWidth: 400 }
        ],
        enabledTools: [
          'WindowLevel', 'Zoom', 'Pan', 'Length', 'Bidirectional',
          'Angle', 'Cine', 'PlayClip', 'HeartRate', 'EjectionFraction'
        ],
        layoutPreference: 'oneByOne',
        measurementUnits: 'mm',
        annotationSettings: {
          enableRuler: true,
          enableAngle: true,
          enableFreehand: false,
          enableText: true,
          defaultColor: '#FF0000',
          defaultThickness: 1
        }
      }
    };
  }

  /**
   * Orthopedics Workflow Configuration
   */
  static getOrthopedicsWorkflow(): SpecialtyWorkflowConfiguration {
    return {
      specialty: 'orthopedics',
      name: 'Orthopedic Imaging Workflow',
      description: 'Specialized workflow for musculoskeletal imaging and orthopedic assessments.',
      defaultModalitities: ['CR', 'DR', 'DX', 'CT', 'MR'],
      requiredFields: ['studyInstanceUID', 'patientID', 'studyDate', 'modality', 'bodyPart'],
      customTags: [
        {
          group: '0018',
          element: '0015',
          vr: 'CS',
          name: 'BodyPart',
          description: 'Body part examined',
          required: true,
          defaultValue: ''
        },
        {
          group: '0018',
          element: '5101',
          vr: 'CS',
          name: 'ViewPosition',
          description: 'Patient position for view',
          required: false,
          defaultValue: null
        }
      ],
      reportTemplate: 'orthopedics-msk-report',
      autoProcessingRules: [
        {
          name: 'Auto-apply bone windowing',
          condition: 'modality === "CT"',
          action: 'setDefaultWindowing',
          parameters: { windowCenter: 400, windowWidth: 1000 }
        },
        {
          name: 'Auto-detect fractures',
          condition: 'studyDescription.includes("TRAUMA") || studyDescription.includes("FRACTURE")',
          action: 'enableFractureDetection',
          parameters: { algorithm: 'bone_fracture_ai' }
        }
      ],
      viewerSettings: {
        defaultWindowing: [
          { name: 'Bone', windowCenter: 400, windowWidth: 1000 },
          { name: 'Soft Tissue', windowCenter: 50, windowWidth: 400 },
          { name: 'Joint', windowCenter: 200, windowWidth: 600 }
        ],
        enabledTools: [
          'WindowLevel', 'Zoom', 'Pan', 'Length', 'Bidirectional',
          'Angle', 'CobbAngle', 'EllipticalRoi', 'RectangleRoi'
        ],
        layoutPreference: 'twoByTwo',
        measurementUnits: 'mm',
        annotationSettings: {
          enableRuler: true,
          enableAngle: true,
          enableFreehand: false,
          enableText: true,
          defaultColor: '#00FF00',
          defaultThickness: 2
        }
      }
    };
  }

  /**
   * Neurology Workflow Configuration
   */
  static getNeurologyWorkflow(): SpecialtyWorkflowConfiguration {
    return {
      specialty: 'neurology',
      name: 'Neurological Imaging Workflow',
      description: 'Specialized workflow for brain and spine imaging studies.',
      defaultModalitities: ['CT', 'MR', 'NM', 'PT'],
      requiredFields: ['studyInstanceUID', 'patientID', 'studyDate', 'modality'],
      customTags: [
        {
          group: '0008',
          element: '0070',
          vr: 'LO',
          name: 'Manufacturer',
          description: 'Equipment manufacturer',
          required: false,
          defaultValue: null
        }
      ],
      reportTemplate: 'neurology-brain-report',
      autoProcessingRules: [
        {
          name: 'Auto-apply brain windowing',
          condition: 'modality === "CT" && bodyPart.includes("BRAIN")',
          action: 'setDefaultWindowing',
          parameters: { windowCenter: 40, windowWidth: 80 }
        }
      ],
      viewerSettings: {
        defaultWindowing: [
          { name: 'Brain', windowCenter: 40, windowWidth: 80 },
          { name: 'Subdural', windowCenter: 75, windowWidth: 215 },
          { name: 'Stroke', windowCenter: 40, windowWidth: 40 }
        ],
        enabledTools: [
          'WindowLevel', 'Zoom', 'Pan', 'Length', 'Bidirectional',
          'EllipticalRoi', 'RectangleRoi', 'Angle', 'Crosshairs', 'MPR'
        ],
        layoutPreference: 'oneByTwo',
        measurementUnits: 'mm',
        annotationSettings: {
          enableRuler: true,
          enableAngle: true,
          enableFreehand: true,
          enableText: true,
          defaultColor: '#0000FF',
          defaultThickness: 1
        }
      }
    };
  }

  /**
   * Oncology Workflow Configuration
   */
  static getOncologyWorkflow(): SpecialtyWorkflowConfiguration {
    return {
      specialty: 'oncology',
      name: 'Oncology Imaging Workflow',
      description: 'Specialized workflow for oncological imaging including PET/CT, radiation therapy planning.',
      defaultModalitities: ['CT', 'MR', 'PT', 'NM', 'RTIMAGE', 'RTDOSE', 'RTSTRUCT', 'RTPLAN'],
      requiredFields: ['studyInstanceUID', 'patientID', 'studyDate', 'modality'],
      customTags: [
        {
          group: '0054',
          element: '1001',
          vr: 'CS',
          name: 'RadiopharmaceuticalInformationSequence',
          description: 'Radiopharmaceutical information',
          required: false,
          defaultValue: null
        }
      ],
      reportTemplate: 'oncology-tumor-report',
      autoProcessingRules: [
        {
          name: 'Auto-calculate SUV values',
          condition: 'modality === "PT"',
          action: 'calculateSUV',
          parameters: { bodyWeightCorrected: true }
        }
      ],
      viewerSettings: {
        defaultWindowing: [
          { name: 'Soft Tissue', windowCenter: 40, windowWidth: 400 },
          { name: 'PET SUV', windowCenter: 2.5, windowWidth: 5 },
          { name: 'Lung', windowCenter: -600, windowWidth: 1600 }
        ],
        enabledTools: [
          'WindowLevel', 'Zoom', 'Pan', 'Length', 'Bidirectional',
          'EllipticalRoi', 'RectangleRoi', 'Angle', 'SUVDisplay', 'PETFusion'
        ],
        layoutPreference: 'oneByTwo',
        measurementUnits: 'mm',
        annotationSettings: {
          enableRuler: true,
          enableAngle: true,
          enableFreehand: true,
          enableText: true,
          defaultColor: '#FF00FF',
          defaultThickness: 2
        }
      }
    };
  }

  /**
   * Pulmonology Workflow Configuration
   */
  static getPulmonologyWorkflow(): SpecialtyWorkflowConfiguration {
    return {
      specialty: 'pulmonology',
      name: 'Pulmonology Imaging Workflow',
      description: 'Specialized workflow for chest and lung imaging studies.',
      defaultModalitities: ['CT', 'CR', 'DR', 'DX'],
      requiredFields: ['studyInstanceUID', 'patientID', 'studyDate', 'modality'],
      customTags: [],
      reportTemplate: 'pulmonology-chest-report',
      autoProcessingRules: [
        {
          name: 'Auto-apply lung windowing',
          condition: 'modality === "CT" && bodyPart.includes("CHEST")',
          action: 'setDefaultWindowing',
          parameters: { windowCenter: -600, windowWidth: 1600 }
        }
      ],
      viewerSettings: {
        defaultWindowing: [
          { name: 'Lung', windowCenter: -600, windowWidth: 1600 },
          { name: 'Mediastinum', windowCenter: 50, windowWidth: 400 },
          { name: 'Pleura', windowCenter: 0, windowWidth: 200 }
        ],
        enabledTools: [
          'WindowLevel', 'Zoom', 'Pan', 'Length', 'Bidirectional',
          'EllipticalRoi', 'RectangleRoi', 'Angle', 'LungSegmentation'
        ],
        layoutPreference: 'oneByTwo',
        measurementUnits: 'mm',
        annotationSettings: {
          enableRuler: true,
          enableAngle: true,
          enableFreehand: false,
          enableText: true,
          defaultColor: '#00FFFF',
          defaultThickness: 2
        }
      }
    };
  }

  /**
   * Gastroenterology Workflow Configuration
   */
  static getGastroenterologyWorkflow(): SpecialtyWorkflowConfiguration {
    return {
      specialty: 'gastroenterology',
      name: 'Gastroenterology Imaging Workflow',
      description: 'Specialized workflow for abdominal and GI tract imaging.',
      defaultModalitities: ['CT', 'MR', 'US', 'CR', 'DR'],
      requiredFields: ['studyInstanceUID', 'patientID', 'studyDate', 'modality'],
      customTags: [],
      reportTemplate: 'gastroenterology-abdomen-report',
      autoProcessingRules: [],
      viewerSettings: {
        defaultWindowing: [
          { name: 'Abdomen', windowCenter: 50, windowWidth: 400 },
          { name: 'Liver', windowCenter: 60, windowWidth: 160 },
          { name: 'Bowel', windowCenter: 40, windowWidth: 400 }
        ],
        enabledTools: [
          'WindowLevel', 'Zoom', 'Pan', 'Length', 'Bidirectional',
          'EllipticalRoi', 'RectangleRoi', 'Angle'
        ],
        layoutPreference: 'oneByTwo',
        measurementUnits: 'mm',
        annotationSettings: {
          enableRuler: true,
          enableAngle: true,
          enableFreehand: false,
          enableText: true,
          defaultColor: '#FFA500',
          defaultThickness: 2
        }
      }
    };
  }

  /**
   * Pediatrics Workflow Configuration
   */
  static getPediatricsWorkflow(): SpecialtyWorkflowConfiguration {
    return {
      specialty: 'pediatrics',
      name: 'Pediatric Imaging Workflow',
      description: 'Specialized workflow for pediatric imaging with reduced radiation protocols.',
      defaultModalitities: ['CR', 'DR', 'DX', 'US', 'MR'],
      requiredFields: ['studyInstanceUID', 'patientID', 'studyDate', 'modality', 'patientAge'],
      customTags: [
        {
          group: '0010',
          element: '1010',
          vr: 'AS',
          name: 'PatientAge',
          description: 'Patient age',
          required: true,
          defaultValue: null
        }
      ],
      reportTemplate: 'pediatrics-child-report',
      autoProcessingRules: [
        {
          name: 'Low-dose protocol reminder',
          condition: 'modality === "CT" && patientAge < "18Y"',
          action: 'flagForReview',
          parameters: { reason: 'pediatric_low_dose_protocol' }
        }
      ],
      viewerSettings: {
        defaultWindowing: [
          { name: 'Pediatric Soft Tissue', windowCenter: 30, windowWidth: 300 },
          { name: 'Pediatric Bone', windowCenter: 300, windowWidth: 800 },
          { name: 'Pediatric Brain', windowCenter: 35, windowWidth: 70 }
        ],
        enabledTools: [
          'WindowLevel', 'Zoom', 'Pan', 'Length', 'Bidirectional',
          'EllipticalRoi', 'RectangleRoi', 'Angle'
        ],
        layoutPreference: 'oneByOne',
        measurementUnits: 'mm',
        annotationSettings: {
          enableRuler: true,
          enableAngle: true,
          enableFreehand: false,
          enableText: true,
          defaultColor: '#FF69B4',
          defaultThickness: 2
        }
      }
    };
  }

  /**
   * Emergency Workflow Configuration
   */
  static getEmergencyWorkflow(): SpecialtyWorkflowConfiguration {
    return {
      specialty: 'emergency',
      name: 'Emergency Department Imaging Workflow',
      description: 'Fast-track workflow for emergency imaging with priority handling.',
      defaultModalitities: ['CT', 'CR', 'DR', 'DX', 'US'],
      requiredFields: ['studyInstanceUID', 'patientID', 'studyDate', 'modality', 'urgencyLevel'],
      customTags: [
        {
          group: '0040',
          element: '1003',
          vr: 'SH',
          name: 'RequestedProcedurePriority',
          description: 'Priority of the requested procedure',
          required: true,
          defaultValue: 'URGENT'
        }
      ],
      reportTemplate: 'emergency-trauma-report',
      autoProcessingRules: [
        {
          name: 'Urgent notification',
          condition: 'urgencyLevel === "STAT"',
          action: 'sendNotification',
          parameters: { recipients: ['emergency_radiologist'], priority: 'high' }
        }
      ],
      viewerSettings: {
        defaultWindowing: [
          { name: 'Emergency Soft Tissue', windowCenter: 40, windowWidth: 400 },
          { name: 'Emergency Bone', windowCenter: 400, windowWidth: 1000 },
          { name: 'Emergency Brain', windowCenter: 40, windowWidth: 80 }
        ],
        enabledTools: [
          'WindowLevel', 'Zoom', 'Pan', 'Length', 'Bidirectional',
          'EllipticalRoi', 'RectangleRoi', 'Angle', 'Probe'
        ],
        layoutPreference: 'oneByTwo',
        measurementUnits: 'mm',
        annotationSettings: {
          enableRuler: true,
          enableAngle: true,
          enableFreehand: false,
          enableText: true,
          defaultColor: '#FF0000',
          defaultThickness: 3
        }
      }
    };
  }

  /**
   * Primary Care Workflow Configuration
   */
  static getPrimaryCareWorkflow(): SpecialtyWorkflowConfiguration {
    return {
      specialty: 'primary-care',
      name: 'Primary Care Imaging Workflow',
      description: 'Basic workflow for primary care imaging needs.',
      defaultModalitities: ['CR', 'DR', 'DX', 'US'],
      requiredFields: ['studyInstanceUID', 'patientID', 'studyDate', 'modality'],
      customTags: [],
      reportTemplate: 'primary-care-basic-report',
      autoProcessingRules: [],
      viewerSettings: {
        defaultWindowing: [
          { name: 'General', windowCenter: 50, windowWidth: 400 },
          { name: 'Bone', windowCenter: 400, windowWidth: 1000 }
        ],
        enabledTools: [
          'WindowLevel', 'Zoom', 'Pan', 'Length', 'Bidirectional',
          'EllipticalRoi', 'RectangleRoi'
        ],
        layoutPreference: 'oneByOne',
        measurementUnits: 'mm',
        annotationSettings: {
          enableRuler: true,
          enableAngle: false,
          enableFreehand: false,
          enableText: true,
          defaultColor: '#000000',
          defaultThickness: 2
        }
      }
    };
  }
}