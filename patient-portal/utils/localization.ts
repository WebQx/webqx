import { LocalizationTexts, SupportedLanguage, LanguageOption } from '../types/localization';

/**
 * Localization data for different languages
 */
export const translations: Record<SupportedLanguage, LocalizationTexts> = {
  en: {
    portalTitle: "🌐 Welcome to WebQX™ Patient Portal",
    portalTagline: "Empowering Patients and Supporting Health Care Providers",
    welcomeBack: "Welcome back",
    languageLabel: "Language / Idioma / Langue / Sprache / 语言",
    
    appointments: "📅 Your Appointments",
    quickActions: "🎯 Quick Actions",
    healthOverview: "📊 Health Overview",
    healthEducation: "📚 Health Education",
    emergencyInfo: "🚨 Emergency Information",
    
    scheduleAppointment: "🗓️ Schedule Appointment",
    viewLabResults: "🧪 View Lab Results",
    messageProvider: "💬 Message Provider",
    refillPrescription: "💊 Refill Prescription",
    
    recentVitals: "📈 Recent Vitals",
    healthAlerts: "🔔 Health Alerts",
    
    emergencyNotice: "For medical emergencies, call 911 immediately",
    urgentCare: "For urgent but non-emergency healthcare needs:"
  },
  es: {
    portalTitle: "🌐 Bienvenido al Portal de Pacientes WebQX™",
    portalTagline: "Empoderando a los Pacientes y Apoyando a los Proveedores de Atención Médica",
    welcomeBack: "Bienvenido de nuevo",
    languageLabel: "Language / Idioma / Langue / Sprache / 语言",
    
    appointments: "📅 Sus Citas",
    quickActions: "🎯 Acciones Rápidas",
    healthOverview: "📊 Resumen de Salud",
    healthEducation: "📚 Educación de Salud",
    emergencyInfo: "🚨 Información de Emergencia",
    
    scheduleAppointment: "🗓️ Programar Cita",
    viewLabResults: "🧪 Ver Resultados de Laboratorio",
    messageProvider: "💬 Mensaje al Proveedor",
    refillPrescription: "💊 Renovar Receta",
    
    recentVitals: "📈 Signos Vitales Recientes",
    healthAlerts: "🔔 Alertas de Salud",
    
    emergencyNotice: "Para emergencias médicas, llame al 911 inmediatamente",
    urgentCare: "Para necesidades de atención médica urgentes pero no de emergencia:"
  },
  fr: {
    portalTitle: "🌐 Bienvenue sur le Portail Patient WebQX™",
    portalTagline: "Autonomiser les Patients et Soutenir les Fournisseurs de Soins de Santé",
    welcomeBack: "Bon retour",
    languageLabel: "Language / Idioma / Langue / Sprache / 语言",
    
    appointments: "📅 Vos Rendez-vous",
    quickActions: "🎯 Actions Rapides",
    healthOverview: "📊 Aperçu de la Santé",
    healthEducation: "📚 Éducation Sanitaire",
    emergencyInfo: "🚨 Informations d'Urgence",
    
    scheduleAppointment: "🗓️ Planifier un Rendez-vous",
    viewLabResults: "🧪 Voir les Résultats de Laboratoire",
    messageProvider: "💬 Message au Fournisseur",
    refillPrescription: "💊 Renouveler l'Ordonnance",
    
    recentVitals: "📈 Signes Vitaux Récents",
    healthAlerts: "🔔 Alertes de Santé",
    
    emergencyNotice: "Pour les urgences médicales, appelez le 911 immédiatement",
    urgentCare: "Pour les besoins de soins de santé urgents mais non urgents:"
  },
  de: {
    portalTitle: "🌐 Willkommen im WebQX™ Patientenportal",
    portalTagline: "Patienten stärken und Gesundheitsdienstleister unterstützen",
    welcomeBack: "Willkommen zurück",
    languageLabel: "Language / Idioma / Langue / Sprache / 语言",
    
    appointments: "📅 Ihre Termine",
    quickActions: "🎯 Schnelle Aktionen",
    healthOverview: "📊 Gesundheitsübersicht",
    healthEducation: "📚 Gesundheitsbildung",
    emergencyInfo: "🚨 Notfallinformationen",
    
    scheduleAppointment: "🗓️ Termin Vereinbaren",
    viewLabResults: "🧪 Laborergebnisse Anzeigen",
    messageProvider: "💬 Nachricht an Anbieter",
    refillPrescription: "💊 Rezept Erneuern",
    
    recentVitals: "📈 Aktuelle Vitalwerte",
    healthAlerts: "🔔 Gesundheitswarnungen",
    
    emergencyNotice: "Für medizinische Notfälle rufen Sie sofort 911 an",
    urgentCare: "Für dringende, aber nicht notfallmäßige Gesundheitsbedürfnisse:"
  },
  zh: {
    portalTitle: "🌐 欢迎使用WebQX™患者门户",
    portalTagline: "赋能患者，支持医疗服务提供者",
    welcomeBack: "欢迎回来",
    languageLabel: "Language / Idioma / Langue / Sprache / 语言",
    
    appointments: "📅 您的预约",
    quickActions: "🎯 快速操作",
    healthOverview: "📊 健康概览",
    healthEducation: "📚 健康教育",
    emergencyInfo: "🚨 紧急信息",
    
    scheduleAppointment: "🗓️ 安排预约",
    viewLabResults: "🧪 查看实验室结果",
    messageProvider: "💬 联系医生",
    refillPrescription: "💊 续开处方",
    
    recentVitals: "📈 最近生命体征",
    healthAlerts: "🔔 健康警报",
    
    emergencyNotice: "医疗紧急情况，请立即拨打911",
    urgentCare: "对于紧急但非急诊的医疗需求："
  }
};

/**
 * Available language options for the language selector
 */
export const languageOptions: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' }
];

/**
 * Get translations for a specific language
 */
export const getTranslations = (language: SupportedLanguage): LocalizationTexts => {
  return translations[language] || translations.en;
};

/**
 * Get language option by code
 */
export const getLanguageOption = (code: SupportedLanguage): LanguageOption => {
  return languageOptions.find(option => option.code === code) || languageOptions[0];
};