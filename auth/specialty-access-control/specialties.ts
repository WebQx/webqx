/**
 * Medical Specialty Access Control for WebQX™
 * 
 * Defines specialty-specific permissions, tools, and protocols for different
 * medical specialties with clinical workflow integration.
 */

import { MedicalSpecialty, SpecialtyAccess } from '../types';

/**
 * Comprehensive specialty permissions and access controls
 */
export const SPECIALTY_PERMISSIONS: Record<MedicalSpecialty, SpecialtyAccess> = {
  PRIMARY_CARE: {
    specialty: 'PRIMARY_CARE',
    tools: [
      'basic_ehr',
      'appointment_scheduling',
      'prescription_pad',
      'lab_ordering',
      'referral_system',
      'preventive_care_alerts',
      'chronic_disease_management',
      'patient_education_materials'
    ],
    protocols: [
      'wellness_protocols',
      'vaccination_schedules',
      'screening_guidelines',
      'chronic_care_protocols',
      'preventive_medicine',
      'health_maintenance'
    ],
    requiredCertifications: [
      'board_certification_family_medicine',
      'board_certification_internal_medicine'
    ]
  },

  RADIOLOGY: {
    specialty: 'RADIOLOGY',
    tools: [
      'dicom_viewer',
      'pacs_access',
      '3d_reconstruction',
      'image_analysis_tools',
      'contrast_injection_protocols',
      'radiation_dose_monitoring',
      'ai_assisted_diagnosis',
      'teleradiology_platform'
    ],
    protocols: [
      'imaging_protocols',
      'contrast_guidelines',
      'radiation_safety',
      'quality_assurance',
      'emergency_imaging',
      'pediatric_imaging'
    ],
    requiredCertifications: [
      'board_certification_radiology',
      'radiation_safety_certification'
    ]
  },

  CARDIOLOGY: {
    specialty: 'CARDIOLOGY',
    tools: [
      'ecg_analysis',
      'echo_viewer',
      'cath_lab_tools',
      'cardiac_imaging',
      'holter_monitor_analysis',
      'stress_test_protocols',
      'cardiac_catheterization',
      'electrophysiology_tools'
    ],
    protocols: [
      'cardiac_protocols',
      'intervention_guidelines',
      'emergency_cardiac_care',
      'post_procedure_monitoring',
      'anticoagulation_protocols',
      'heart_failure_management'
    ],
    requiredCertifications: [
      'board_certification_cardiology',
      'interventional_cardiology_certification'
    ]
  },

  PEDIATRICS: {
    specialty: 'PEDIATRICS',
    tools: [
      'pediatric_ehr',
      'growth_charts',
      'vaccination_tracker',
      'developmental_assessments',
      'pediatric_dosing_calculator',
      'newborn_screening',
      'child_abuse_reporting',
      'family_communication_tools'
    ],
    protocols: [
      'pediatric_protocols',
      'vaccination_schedules',
      'developmental_milestones',
      'child_safety_guidelines',
      'adolescent_care',
      'neonatal_protocols'
    ],
    requiredCertifications: [
      'board_certification_pediatrics',
      'pediatric_advanced_life_support'
    ]
  },

  ONCOLOGY: {
    specialty: 'ONCOLOGY',
    tools: [
      'chemotherapy_protocols',
      'radiation_planning',
      'tumor_board_platform',
      'clinical_trial_management',
      'biomarker_analysis',
      'imaging_for_oncology',
      'palliative_care_tools',
      'survivorship_planning'
    ],
    protocols: [
      'cancer_treatment_protocols',
      'chemotherapy_guidelines',
      'radiation_protocols',
      'supportive_care',
      'clinical_trials',
      'genetic_counseling'
    ],
    requiredCertifications: [
      'board_certification_oncology',
      'chemotherapy_administration'
    ]
  },

  PSYCHIATRY: {
    specialty: 'PSYCHIATRY',
    tools: [
      'mental_health_assessments',
      'psychiatric_rating_scales',
      'medication_management',
      'therapy_session_notes',
      'crisis_intervention_tools',
      'substance_abuse_screening',
      'cognitive_assessments',
      'telepsychiatry_platform'
    ],
    protocols: [
      'psychiatric_protocols',
      'crisis_intervention',
      'medication_monitoring',
      'therapy_guidelines',
      'suicide_risk_assessment',
      'substance_abuse_treatment'
    ],
    restrictedAreas: [
      'surgical_planning',
      'radiation_tools',
      'interventional_procedures'
    ],
    requiredCertifications: [
      'board_certification_psychiatry'
    ]
  },

  ENDOCRINOLOGY: {
    specialty: 'ENDOCRINOLOGY',
    tools: [
      'diabetes_management',
      'insulin_pump_programming',
      'glucose_monitoring_analysis',
      'thyroid_function_tools',
      'hormone_replacement_protocols',
      'metabolic_assessments',
      'bone_density_analysis',
      'continuous_glucose_monitoring'
    ],
    protocols: [
      'diabetes_protocols',
      'thyroid_management',
      'hormone_therapy',
      'metabolic_disorders',
      'osteoporosis_treatment',
      'adrenal_disorders'
    ],
    requiredCertifications: [
      'board_certification_endocrinology'
    ]
  },

  ORTHOPEDICS: {
    specialty: 'ORTHOPEDICS',
    tools: [
      'orthopedic_imaging',
      'surgical_planning',
      'joint_replacement_tools',
      'fracture_analysis',
      'arthroscopy_planning',
      'physical_therapy_protocols',
      'biomechanical_analysis',
      'sports_medicine_tools'
    ],
    protocols: [
      'surgical_protocols',
      'fracture_treatment',
      'joint_replacement',
      'sports_injury_management',
      'rehabilitation_protocols',
      'pain_management'
    ],
    requiredCertifications: [
      'board_certification_orthopedics',
      'surgical_privileges'
    ]
  },

  NEUROLOGY: {
    specialty: 'NEUROLOGY',
    tools: [
      'eeg_analysis',
      'neuroimaging_tools',
      'stroke_protocols',
      'seizure_monitoring',
      'neuropsychological_testing',
      'movement_disorder_tools',
      'dementia_assessments',
      'electromyography'
    ],
    protocols: [
      'neurological_protocols',
      'stroke_care',
      'seizure_management',
      'neurodegenerative_disease',
      'headache_treatment',
      'neurological_emergencies'
    ],
    requiredCertifications: [
      'board_certification_neurology'
    ]
  },

  GASTROENTEROLOGY: {
    specialty: 'GASTROENTEROLOGY',
    tools: [
      'endoscopy_planning',
      'gi_imaging_tools',
      'liver_function_analysis',
      'inflammatory_bowel_disease_tools',
      'colonoscopy_scheduling',
      'nutrition_assessments',
      'hepatology_tools',
      'motility_studies'
    ],
    protocols: [
      'endoscopy_protocols',
      'gi_bleeding_management',
      'inflammatory_bowel_disease',
      'liver_disease_protocols',
      'colorectal_cancer_screening',
      'nutrition_therapy'
    ],
    requiredCertifications: [
      'board_certification_gastroenterology',
      'endoscopy_privileges'
    ]
  },

  PULMONOLOGY: {
    specialty: 'PULMONOLOGY',
    tools: [
      'pulmonary_function_tests',
      'chest_imaging_analysis',
      'bronchoscopy_planning',
      'sleep_study_analysis',
      'ventilator_management',
      'asthma_action_plans',
      'copd_management_tools',
      'lung_cancer_screening'
    ],
    protocols: [
      'respiratory_protocols',
      'asthma_management',
      'copd_treatment',
      'sleep_disorders',
      'critical_care_ventilation',
      'lung_cancer_protocols'
    ],
    requiredCertifications: [
      'board_certification_pulmonology'
    ]
  },

  DERMATOLOGY: {
    specialty: 'DERMATOLOGY',
    tools: [
      'dermoscopy_imaging',
      'skin_cancer_screening',
      'phototherapy_protocols',
      'cosmetic_procedure_planning',
      'pathology_correlation',
      'mole_mapping',
      'surgical_dermatology_tools',
      'teledermatology_platform'
    ],
    protocols: [
      'skin_cancer_protocols',
      'dermatologic_surgery',
      'inflammatory_skin_disease',
      'cosmetic_procedures',
      'pediatric_dermatology',
      'immunodermatology'
    ],
    requiredCertifications: [
      'board_certification_dermatology'
    ]
  },

  OBGYN: {
    specialty: 'OBGYN',
    tools: [
      'ultrasound_imaging',
      'fetal_monitoring',
      'contraception_counseling',
      'prenatal_care_protocols',
      'labor_management_tools',
      'gynecologic_surgery_planning',
      'fertility_assessments',
      'menopause_management'
    ],
    protocols: [
      'obstetric_protocols',
      'gynecologic_procedures',
      'prenatal_care',
      'labor_delivery',
      'contraceptive_methods',
      'reproductive_health'
    ],
    requiredCertifications: [
      'board_certification_obgyn',
      'surgical_privileges'
    ]
  },

  ANESTHESIOLOGY: {
    specialty: 'ANESTHESIOLOGY',
    tools: [
      'anesthesia_monitoring',
      'drug_calculation_tools',
      'airway_management',
      'pain_management_protocols',
      'regional_anesthesia_guidance',
      'critical_care_tools',
      'perioperative_management',
      'emergency_airway_tools'
    ],
    protocols: [
      'anesthesia_protocols',
      'perioperative_care',
      'pain_management',
      'critical_care_anesthesia',
      'pediatric_anesthesia',
      'cardiac_anesthesia'
    ],
    requiredCertifications: [
      'board_certification_anesthesiology',
      'anesthesia_privileges'
    ]
  },

  EMERGENCY_MEDICINE: {
    specialty: 'EMERGENCY_MEDICINE',
    tools: [
      'triage_protocols',
      'emergency_procedures',
      'trauma_assessment',
      'rapid_diagnostics',
      'resuscitation_tools',
      'poison_control_protocols',
      'disaster_management',
      'emergency_imaging'
    ],
    protocols: [
      'emergency_protocols',
      'trauma_care',
      'resuscitation_guidelines',
      'triage_algorithms',
      'toxicology_protocols',
      'emergency_procedures'
    ],
    requiredCertifications: [
      'board_certification_emergency_medicine',
      'advanced_cardiac_life_support',
      'advanced_trauma_life_support'
    ]
  },

  PATHOLOGY: {
    specialty: 'PATHOLOGY',
    tools: [
      'microscopy_imaging',
      'digital_pathology',
      'molecular_diagnostics',
      'autopsy_protocols',
      'laboratory_information_system',
      'immunohistochemistry',
      'flow_cytometry',
      'telepathology'
    ],
    protocols: [
      'pathology_protocols',
      'specimen_handling',
      'diagnostic_criteria',
      'quality_assurance',
      'molecular_testing',
      'laboratory_safety'
    ],
    requiredCertifications: [
      'board_certification_pathology'
    ]
  },

  SURGERY: {
    specialty: 'SURGERY',
    tools: [
      'surgical_planning',
      'operative_scheduling',
      'surgical_instruments_tracking',
      'anesthesia_coordination',
      'post_operative_monitoring',
      'minimally_invasive_tools',
      'robotic_surgery_platform',
      'surgical_navigation'
    ],
    protocols: [
      'surgical_protocols',
      'preoperative_preparation',
      'operative_procedures',
      'postoperative_care',
      'infection_prevention',
      'surgical_safety'
    ],
    requiredCertifications: [
      'board_certification_surgery',
      'surgical_privileges'
    ]
  },

  UROLOGY: {
    specialty: 'UROLOGY',
    tools: [
      'urologic_imaging',
      'endoscopic_procedures',
      'stone_analysis',
      'prostate_assessment',
      'fertility_evaluation',
      'urodynamics',
      'robotic_urology_tools',
      'oncologic_urology'
    ],
    protocols: [
      'urologic_protocols',
      'stone_management',
      'prostate_treatment',
      'urologic_oncology',
      'pediatric_urology',
      'reconstructive_urology'
    ],
    requiredCertifications: [
      'board_certification_urology'
    ]
  },

  OPHTHALMOLOGY: {
    specialty: 'OPHTHALMOLOGY',
    tools: [
      'retinal_imaging',
      'visual_field_testing',
      'optical_coherence_tomography',
      'surgical_microscopy',
      'laser_therapy_tools',
      'corneal_topography',
      'glaucoma_monitoring',
      'pediatric_ophthalmology'
    ],
    protocols: [
      'ophthalmic_protocols',
      'retinal_treatment',
      'glaucoma_management',
      'cataract_surgery',
      'corneal_procedures',
      'oculoplastic_surgery'
    ],
    requiredCertifications: [
      'board_certification_ophthalmology'
    ]
  },

  ENT: {
    specialty: 'ENT',
    tools: [
      'endoscopic_procedures',
      'audiometry_tools',
      'sinus_imaging',
      'surgical_navigation',
      'voice_analysis',
      'balance_testing',
      'allergy_testing',
      'head_neck_surgery_tools'
    ],
    protocols: [
      'ent_protocols',
      'sinus_surgery',
      'hearing_loss_management',
      'voice_disorders',
      'head_neck_oncology',
      'pediatric_ent'
    ],
    requiredCertifications: [
      'board_certification_ent'
    ]
  }
};

/**
 * Get specialty-specific tools for a medical specialty
 */
export function getSpecialtyTools(specialty: MedicalSpecialty): string[] {
  return SPECIALTY_PERMISSIONS[specialty]?.tools || [];
}

/**
 * Get specialty-specific protocols for a medical specialty
 */
export function getSpecialtyProtocols(specialty: MedicalSpecialty): string[] {
  return SPECIALTY_PERMISSIONS[specialty]?.protocols || [];
}

/**
 * Check if a specialty has access to a specific tool
 */
export function hasToolAccess(specialty: MedicalSpecialty, tool: string): boolean {
  const specialtyAccess = SPECIALTY_PERMISSIONS[specialty];
  if (!specialtyAccess) return false;
  
  return specialtyAccess.tools.includes(tool);
}

/**
 * Check if a specialty has access to a specific protocol
 */
export function hasProtocolAccess(specialty: MedicalSpecialty, protocol: string): boolean {
  const specialtyAccess = SPECIALTY_PERMISSIONS[specialty];
  if (!specialtyAccess) return false;
  
  return specialtyAccess.protocols.includes(protocol);
}

/**
 * Get required certifications for a specialty
 */
export function getRequiredCertifications(specialty: MedicalSpecialty): string[] {
  return SPECIALTY_PERMISSIONS[specialty]?.requiredCertifications || [];
}

/**
 * Get restricted areas for a specialty
 */
export function getRestrictedAreas(specialty: MedicalSpecialty): string[] {
  return SPECIALTY_PERMISSIONS[specialty]?.restrictedAreas || [];
}

/**
 * Check if a resource is restricted for a specialty
 */
export function isResourceRestricted(specialty: MedicalSpecialty, resource: string): boolean {
  const restrictedAreas = getRestrictedAreas(specialty);
  return restrictedAreas.some(area => resource.includes(area));
}

export default {
  SPECIALTY_PERMISSIONS,
  getSpecialtyTools,
  getSpecialtyProtocols,
  hasToolAccess,
  hasProtocolAccess,
  getRequiredCertifications,
  getRestrictedAreas,
  isResourceRestricted
};