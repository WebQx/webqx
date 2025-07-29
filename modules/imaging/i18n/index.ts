/**
 * Internationalization configuration for WebQX™ OHIF Integration
 * 
 * Provides multilingual support for DICOM metadata, UI elements,
 * and clinical terminology aligned with WebQX™ platform.
 */

import { LocalizationConfig, TranslationResources } from '../types';

export const localizationConfig: LocalizationConfig = {
  defaultLanguage: 'en',
  supportedLanguages: ['en', 'es', 'fr', 'de', 'pt', 'it', 'ja', 'ko', 'zh', 'ar'],
  fallbackLanguage: 'en',
  namespaces: [
    'imaging',
    'dicom',
    'ui',
    'clinical',
    'tools',
    'workflows',
    'errors',
    'measurements'
  ]
};

export const translationResources: TranslationResources = {
  en: {
    imaging: {
      'viewer.title': 'OHIF Viewer',
      'study.loading': 'Loading study...',
      'study.notFound': 'Study not found',
      'study.accessDenied': 'Access denied to this study',
      'series.loading': 'Loading series...',
      'image.loading': 'Loading image...',
      'annotation.save': 'Save Annotation',
      'annotation.delete': 'Delete Annotation',
      'measurement.length': 'Length Measurement',
      'measurement.area': 'Area Measurement',
      'measurement.angle': 'Angle Measurement',
      'tool.zoom': 'Zoom',
      'tool.pan': 'Pan',
      'tool.windowLevel': 'Window/Level',
      'tool.rotate': 'Rotate',
      'tool.flip': 'Flip',
      'tool.invert': 'Invert',
      'tool.magnify': 'Magnify',
      'workflow.radiology': 'Radiology Interpretation',
      'workflow.cardiology': 'Cardiac Analysis',
      'workflow.oncology': 'Oncology Review'
    },
    dicom: {
      'patient.name': 'Patient Name',
      'patient.id': 'Patient ID',
      'patient.birthDate': 'Birth Date',
      'patient.sex': 'Sex',
      'study.date': 'Study Date',
      'study.time': 'Study Time',
      'study.description': 'Study Description',
      'study.instanceUID': 'Study Instance UID',
      'series.number': 'Series Number',
      'series.description': 'Series Description',
      'series.modality': 'Modality',
      'series.instanceUID': 'Series Instance UID',
      'image.number': 'Image Number',
      'image.position': 'Image Position',
      'image.orientation': 'Image Orientation',
      'modality.CT': 'Computed Tomography',
      'modality.MR': 'Magnetic Resonance',
      'modality.US': 'Ultrasound',
      'modality.XA': 'X-Ray Angiography',
      'modality.RF': 'Radiofluoroscopy',
      'modality.DX': 'Digital Radiography',
      'modality.CR': 'Computed Radiography',
      'modality.MG': 'Mammography',
      'modality.PT': 'Positron Emission Tomography',
      'modality.NM': 'Nuclear Medicine'
    },
    ui: {
      'button.save': 'Save',
      'button.cancel': 'Cancel',
      'button.delete': 'Delete',
      'button.edit': 'Edit',
      'button.close': 'Close',
      'button.next': 'Next',
      'button.previous': 'Previous',
      'button.first': 'First',
      'button.last': 'Last',
      'menu.file': 'File',
      'menu.edit': 'Edit',
      'menu.view': 'View',
      'menu.tools': 'Tools',
      'menu.help': 'Help',
      'status.ready': 'Ready',
      'status.loading': 'Loading...',
      'status.error': 'Error',
      'status.complete': 'Complete'
    },
    clinical: {
      'specialty.radiology': 'Radiology',
      'specialty.cardiology': 'Cardiology',
      'specialty.oncology': 'Oncology',
      'specialty.neurology': 'Neurology',
      'specialty.orthopedics': 'Orthopedics',
      'specialty.primaryCare': 'Primary Care',
      'specialty.emergency': 'Emergency Medicine',
      'specialty.pathology': 'Pathology',
      'priority.urgent': 'Urgent',
      'priority.high': 'High',
      'priority.normal': 'Normal',
      'priority.low': 'Low',
      'role.radiologist': 'Radiologist',
      'role.physician': 'Physician',
      'role.technician': 'Technician',
      'role.nurse': 'Nurse',
      'role.student': 'Student',
      'role.patient': 'Patient'
    },
    tools: {
      'annotation.text': 'Text Annotation',
      'annotation.arrow': 'Arrow',
      'annotation.circle': 'Circle',
      'annotation.rectangle': 'Rectangle',
      'annotation.polygon': 'Polygon',
      'measurement.length': 'Length',
      'measurement.area': 'Area',
      'measurement.volume': 'Volume',
      'measurement.angle': 'Angle',
      'measurement.density': 'Density'
    },
    workflows: {
      'step.initialReview': 'Initial Review',
      'step.measurements': 'Measurements',
      'step.annotation': 'Annotation',
      'step.reporting': 'Reporting',
      'step.approval': 'Approval'
    },
    errors: {
      'network.connectionFailed': 'Network connection failed',
      'auth.accessDenied': 'Access denied',
      'auth.sessionExpired': 'Session expired',
      'dicom.loadFailed': 'Failed to load DICOM data',
      'image.renderFailed': 'Failed to render image',
      'annotation.saveFailed': 'Failed to save annotation',
      'measurement.invalid': 'Invalid measurement'
    },
    measurements: {
      'unit.mm': 'mm',
      'unit.cm': 'cm',
      'unit.mm2': 'mm²',
      'unit.cm2': 'cm²',
      'unit.mm3': 'mm³',
      'unit.cm3': 'cm³',
      'unit.degree': '°',
      'unit.hu': 'HU'
    }
  },
  es: {
    imaging: {
      'viewer.title': 'Visor OHIF',
      'study.loading': 'Cargando estudio...',
      'study.notFound': 'Estudio no encontrado',
      'study.accessDenied': 'Acceso denegado a este estudio',
      'series.loading': 'Cargando series...',
      'image.loading': 'Cargando imagen...',
      'annotation.save': 'Guardar Anotación',
      'annotation.delete': 'Eliminar Anotación',
      'measurement.length': 'Medición de Longitud',
      'measurement.area': 'Medición de Área',
      'measurement.angle': 'Medición de Ángulo',
      'tool.zoom': 'Zoom',
      'tool.pan': 'Panorámica',
      'tool.windowLevel': 'Ventana/Nivel',
      'tool.rotate': 'Rotar',
      'tool.flip': 'Voltear',
      'tool.invert': 'Invertir',
      'tool.magnify': 'Magnificar',
      'workflow.radiology': 'Interpretación Radiológica',
      'workflow.cardiology': 'Análisis Cardíaco',
      'workflow.oncology': 'Revisión Oncológica'
    },
    dicom: {
      'patient.name': 'Nombre del Paciente',
      'patient.id': 'ID del Paciente',
      'patient.birthDate': 'Fecha de Nacimiento',
      'patient.sex': 'Sexo',
      'study.date': 'Fecha del Estudio',
      'study.time': 'Hora del Estudio',
      'study.description': 'Descripción del Estudio',
      'study.instanceUID': 'UID de Instancia del Estudio',
      'series.number': 'Número de Serie',
      'series.description': 'Descripción de la Serie',
      'series.modality': 'Modalidad',
      'series.instanceUID': 'UID de Instancia de la Serie',
      'image.number': 'Número de Imagen',
      'image.position': 'Posición de la Imagen',
      'image.orientation': 'Orientación de la Imagen',
      'modality.CT': 'Tomografía Computarizada',
      'modality.MR': 'Resonancia Magnética',
      'modality.US': 'Ultrasonido',
      'modality.XA': 'Angiografía de Rayos X',
      'modality.RF': 'Radiofluoroscopía',
      'modality.DX': 'Radiografía Digital',
      'modality.CR': 'Radiografía Computarizada',
      'modality.MG': 'Mamografía',
      'modality.PT': 'Tomografía por Emisión de Positrones',
      'modality.NM': 'Medicina Nuclear'
    },
    clinical: {
      'specialty.radiology': 'Radiología',
      'specialty.cardiology': 'Cardiología',
      'specialty.oncology': 'Oncología',
      'specialty.neurology': 'Neurología',
      'specialty.orthopedics': 'Ortopedia',
      'specialty.primaryCare': 'Atención Primaria',
      'specialty.emergency': 'Medicina de Emergencia',
      'specialty.pathology': 'Patología',
      'priority.urgent': 'Urgente',
      'priority.high': 'Alta',
      'priority.normal': 'Normal',
      'priority.low': 'Baja',
      'role.radiologist': 'Radiólogo',
      'role.physician': 'Médico',
      'role.technician': 'Técnico',
      'role.nurse': 'Enfermera',
      'role.student': 'Estudiante',
      'role.patient': 'Paciente'
    }
  },
  fr: {
    imaging: {
      'viewer.title': 'Visualiseur OHIF',
      'study.loading': 'Chargement de l\'étude...',
      'study.notFound': 'Étude introuvable',
      'study.accessDenied': 'Accès refusé à cette étude',
      'series.loading': 'Chargement des séries...',
      'image.loading': 'Chargement de l\'image...',
      'annotation.save': 'Enregistrer l\'Annotation',
      'annotation.delete': 'Supprimer l\'Annotation',
      'measurement.length': 'Mesure de Longueur',
      'measurement.area': 'Mesure de Surface',
      'measurement.angle': 'Mesure d\'Angle',
      'tool.zoom': 'Zoom',
      'tool.pan': 'Panoramique',
      'tool.windowLevel': 'Fenêtre/Niveau',
      'tool.rotate': 'Rotation',
      'tool.flip': 'Retournement',
      'tool.invert': 'Inversion',
      'tool.magnify': 'Grossissement',
      'workflow.radiology': 'Interprétation Radiologique',
      'workflow.cardiology': 'Analyse Cardiaque',
      'workflow.oncology': 'Révision Oncologique'
    },
    dicom: {
      'patient.name': 'Nom du Patient',
      'patient.id': 'ID du Patient',
      'patient.birthDate': 'Date de Naissance',
      'patient.sex': 'Sexe',
      'study.date': 'Date de l\'Étude',
      'study.time': 'Heure de l\'Étude',
      'study.description': 'Description de l\'Étude',
      'study.instanceUID': 'UID d\'Instance de l\'Étude',
      'series.number': 'Numéro de Série',
      'series.description': 'Description de la Série',
      'series.modality': 'Modalité',
      'series.instanceUID': 'UID d\'Instance de la Série',
      'image.number': 'Numéro d\'Image',
      'image.position': 'Position de l\'Image',
      'image.orientation': 'Orientation de l\'Image',
      'modality.CT': 'Tomodensitométrie',
      'modality.MR': 'Imagerie par Résonance Magnétique',
      'modality.US': 'Échographie',
      'modality.XA': 'Angiographie aux Rayons X',
      'modality.RF': 'Radioscopie',
      'modality.DX': 'Radiographie Numérique',
      'modality.CR': 'Radiographie Informatisée',
      'modality.MG': 'Mammographie',
      'modality.PT': 'Tomographie par Émission de Positrons',
      'modality.NM': 'Médecine Nucléaire'
    },
    clinical: {
      'specialty.radiology': 'Radiologie',
      'specialty.cardiology': 'Cardiologie',
      'specialty.oncology': 'Oncologie',
      'specialty.neurology': 'Neurologie',
      'specialty.orthopedics': 'Orthopédie',
      'specialty.primaryCare': 'Soins Primaires',
      'specialty.emergency': 'Médecine d\'Urgence',
      'specialty.pathology': 'Pathologie',
      'priority.urgent': 'Urgent',
      'priority.high': 'Élevée',
      'priority.normal': 'Normale',
      'priority.low': 'Faible',
      'role.radiologist': 'Radiologue',
      'role.physician': 'Médecin',
      'role.technician': 'Technicien',
      'role.nurse': 'Infirmière',
      'role.student': 'Étudiant',
      'role.patient': 'Patient'
    }
  },
  de: {
    imaging: {
      'viewer.title': 'OHIF Betrachter',
      'study.loading': 'Studie wird geladen...',
      'study.notFound': 'Studie nicht gefunden',
      'study.accessDenied': 'Zugriff auf diese Studie verweigert',
      'series.loading': 'Serien werden geladen...',
      'image.loading': 'Bild wird geladen...',
      'annotation.save': 'Annotation Speichern',
      'annotation.delete': 'Annotation Löschen',
      'measurement.length': 'Längenmessung',
      'measurement.area': 'Flächenmessung',
      'measurement.angle': 'Winkelmessung',
      'tool.zoom': 'Zoom',
      'tool.pan': 'Schwenken',
      'tool.windowLevel': 'Fenster/Stufe',
      'tool.rotate': 'Drehen',
      'tool.flip': 'Spiegeln',
      'tool.invert': 'Umkehren',
      'tool.magnify': 'Vergrößern',
      'workflow.radiology': 'Radiologische Interpretation',
      'workflow.cardiology': 'Herzanalyse',
      'workflow.oncology': 'Onkologische Überprüfung'
    },
    dicom: {
      'patient.name': 'Patientenname',
      'patient.id': 'Patienten-ID',
      'patient.birthDate': 'Geburtsdatum',
      'patient.sex': 'Geschlecht',
      'study.date': 'Studiendatum',
      'study.time': 'Studienzeit',
      'study.description': 'Studienbeschreibung',
      'study.instanceUID': 'Studien-Instanz-UID',
      'series.number': 'Seriennummer',
      'series.description': 'Serienbeschreibung',
      'series.modality': 'Modalität',
      'series.instanceUID': 'Serien-Instanz-UID',
      'image.number': 'Bildnummer',
      'image.position': 'Bildposition',
      'image.orientation': 'Bildorientierung',
      'modality.CT': 'Computertomographie',
      'modality.MR': 'Magnetresonanztomographie',
      'modality.US': 'Ultraschall',
      'modality.XA': 'Röntgenangiographie',
      'modality.RF': 'Röntgenfluoroskopie',
      'modality.DX': 'Digitale Radiographie',
      'modality.CR': 'Computerradiographie',
      'modality.MG': 'Mammographie',
      'modality.PT': 'Positronen-Emissions-Tomographie',
      'modality.NM': 'Nuklearmedizin'
    },
    clinical: {
      'specialty.radiology': 'Radiologie',
      'specialty.cardiology': 'Kardiologie',
      'specialty.oncology': 'Onkologie',
      'specialty.neurology': 'Neurologie',
      'specialty.orthopedics': 'Orthopädie',
      'specialty.primaryCare': 'Hausarztpraxis',
      'specialty.emergency': 'Notfallmedizin',
      'specialty.pathology': 'Pathologie',
      'priority.urgent': 'Dringend',
      'priority.high': 'Hoch',
      'priority.normal': 'Normal',
      'priority.low': 'Niedrig',
      'role.radiologist': 'Radiologe',
      'role.physician': 'Arzt',
      'role.technician': 'Techniker',
      'role.nurse': 'Krankenschwester',
      'role.student': 'Student',
      'role.patient': 'Patient'
    }
  }
};

/**
 * Get translated text with interpolation support
 */
export function t(
  key: string, 
  language: string = 'en', 
  namespace: string = 'imaging',
  interpolation: Record<string, string> = {}
): string {
  const langResources = translationResources[language];
  if (!langResources) {
    // Fallback to default language
    return t(key, localizationConfig.fallbackLanguage, namespace, interpolation);
  }

  const namespaceResources = langResources[namespace];
  if (!namespaceResources) {
    // Try fallback language
    if (language !== localizationConfig.fallbackLanguage) {
      return t(key, localizationConfig.fallbackLanguage, namespace, interpolation);
    }
    return key; // Return key if translation not found
  }

  let translation = namespaceResources[key];
  if (!translation) {
    // Try fallback language
    if (language !== localizationConfig.fallbackLanguage) {
      return t(key, localizationConfig.fallbackLanguage, namespace, interpolation);
    }
    return key; // Return key if translation not found
  }

  // Apply interpolations
  Object.entries(interpolation).forEach(([placeholder, value]) => {
    translation = translation.replace(new RegExp(`{{${placeholder}}}`, 'g'), value);
  });

  return translation;
}

/**
 * Format DICOM date for display based on locale
 */
export function formatDICOMDate(dicomDate: string, language: string = 'en'): string {
  if (!dicomDate || dicomDate.length !== 8) {
    return dicomDate;
  }

  const year = dicomDate.substring(0, 4);
  const month = dicomDate.substring(4, 6);
  const day = dicomDate.substring(6, 8);
  
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  
  const locales: Record<string, string> = {
    'en': 'en-US',
    'es': 'es-ES',
    'fr': 'fr-FR',
    'de': 'de-DE',
    'pt': 'pt-BR',
    'it': 'it-IT',
    'ja': 'ja-JP',
    'ko': 'ko-KR',
    'zh': 'zh-CN',
    'ar': 'ar-SA'
  };

  const locale = locales[language] || 'en-US';
  
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format DICOM time for display based on locale
 */
export function formatDICOMTime(dicomTime: string, language: string = 'en'): string {
  if (!dicomTime || dicomTime.length < 6) {
    return dicomTime;
  }

  const hour = dicomTime.substring(0, 2);
  const minute = dicomTime.substring(2, 4);
  const second = dicomTime.substring(4, 6);
  
  const date = new Date();
  date.setHours(parseInt(hour), parseInt(minute), parseInt(second));
  
  const locales: Record<string, string> = {
    'en': 'en-US',
    'es': 'es-ES',
    'fr': 'fr-FR',
    'de': 'de-DE',
    'pt': 'pt-BR',
    'it': 'it-IT',
    'ja': 'ja-JP',
    'ko': 'ko-KR',
    'zh': 'zh-CN',
    'ar': 'ar-SA'
  };

  const locale = locales[language] || 'en-US';
  
  return date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Get direction for RTL languages
 */
export function getTextDirection(language: string): 'ltr' | 'rtl' {
  const rtlLanguages = ['ar', 'he', 'fa', 'ur'];
  return rtlLanguages.includes(language) ? 'rtl' : 'ltr';
}

/**
 * Get supported languages list with native names
 */
export function getSupportedLanguages(): Array<{ code: string; name: string; nativeName: string }> {
  return [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'es', name: 'Spanish', nativeName: 'Español' },
    { code: 'fr', name: 'French', nativeName: 'Français' },
    { code: 'de', name: 'German', nativeName: 'Deutsch' },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
    { code: 'it', name: 'Italian', nativeName: 'Italiano' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語' },
    { code: 'ko', name: 'Korean', nativeName: '한국어' },
    { code: 'zh', name: 'Chinese', nativeName: '中文' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية' }
  ];
}

export default {
  localizationConfig,
  translationResources,
  t,
  formatDICOMDate,
  formatDICOMTime,
  getTextDirection,
  getSupportedLanguages
};