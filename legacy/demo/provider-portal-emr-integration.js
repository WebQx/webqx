/**
 * WebQX Provider Portal - EMR Integration
 * Connects provider portal to real OpenEMR clinical workflow
 */

// Provider Portal EMR Configuration
const PROVIDER_EMR_CONFIG = {
    EMR_BASE: 'https://fuzzy-goldfish-7vx645x7wgvv3rjxg-8085.app.github.dev',
    API_BASE: 'https://fuzzy-goldfish-7vx645x7wgvv3rjxg-8080.app.github.dev',
    
    endpoints: {
        // Clinical workflow endpoints
        main_interface: '/interface/main/main.php',
        patient_list: '/interface/main/finder/patient_select.php',
        new_patient: '/interface/new/new.php',
        calendar: '/interface/main/calendar/index.php',
        
        // Patient care endpoints
        patient_summary: '/interface/patient_file/summary/demographics.php',
        clinical_notes: '/interface/forms/SOAP/new.php',
        prescriptions: '/interface/drugs/dispense_drug.php',
        lab_orders: '/interface/orders/orders_results.php',
        
        // Documentation
        encounter_forms: '/interface/encounter/forms.php',
        vital_signs: '/interface/forms/vitals/new.php',
        immunizations: '/interface/patient_file/summary/stats.php',
        
        // Reports and analytics
        patient_reports: '/interface/reports/custom_report.php',
        billing_reports: '/interface/billing/billing_report.php',
        quality_measures: '/interface/reports/cqm.php',
        
        // Community health features
        community_health: '/webqx-api.php?action=community-stats',
        mobile_clinic_schedule: '/interface/main/calendar/index.php?pc_cattype=mobile_clinic',
        telemedicine_sessions: '/interface/main/calendar/index.php?pc_cattype=telehealth',
        
        // WebQX specific features
        underserved_patients: '/interface/reports/custom_report.php?report=underserved',
        free_services_tracking: '/interface/reports/custom_report.php?report=free_services'
    }
};

// Provider Portal Module
class WebQXProviderPortal {
    constructor() {
        this.providerData = null;
        this.isLoggedIn = false;
        this.currentPatient = null;
        this.init();
    }
    
    init() {
        console.log('👨‍⚕️ Initializing WebQX Provider Portal with EMR integration');
        this.setupProviderFunctions();
        this.checkEMRConnection();
        this.loadProviderDashboard();
    }
    
    async checkEMRConnection() {
        try {
            const response = await fetch(`${PROVIDER_EMR_CONFIG.EMR_BASE}/webqx-api.php?action=health`);
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Provider Portal connected to EMR:', data);
                this.updateConnectionStatus(true);
                
                // Load community health stats for providers
                this.loadCommunityHealthStats();
                
            } else {
                throw new Error('EMR not accessible');
            }
        } catch (error) {
            console.error('❌ Provider Portal EMR connection failed:', error);
            this.updateConnectionStatus(false);
        }
    }
    
    updateConnectionStatus(connected) {
        const statusElement = document.querySelector('.emr-status') || document.querySelector('.connection-status');
        if (statusElement) {
            statusElement.className = `emr-status ${connected ? 'connected' : 'disconnected'}`;
            statusElement.textContent = connected ? 'EMR Connected' : 'EMR Offline';
        }
        
        // Update clinical tools availability
        const toolCards = document.querySelectorAll('.tool-card, .clinical-tool');
        toolCards.forEach(card => {
            if (!connected) {
                card.style.opacity = '0.5';
                card.title = 'EMR connection required for clinical tools';
            } else {
                card.style.opacity = '1';
                card.title = 'Click to access EMR clinical tool';
            }
        });
    }
    
    setupProviderFunctions() {
        // Setup clinical workflow functions
        window.clinicalAPI = {
            // Patient Management
            openPatientList: () => this.openPatientList(),
            searchPatients: () => this.searchPatients(),
            newPatient: () => this.newPatient(),
            openPatientChart: (patientId) => this.openPatientChart(patientId),
            
            // Clinical Documentation
            openSOAPNotes: () => this.openSOAPNotes(),
            openEncounterForms: () => this.openEncounterForms(),
            recordVitalSigns: () => this.recordVitalSigns(),
            updateImmunizations: () => this.updateImmunizations(),
            
            // Orders and Prescriptions
            orderLabs: () => this.orderLabs(),
            prescribeMedication: () => this.prescribeMedication(),
            reviewLabResults: () => this.reviewLabResults(),
            
            // Scheduling
            openCalendar: () => this.openCalendar(),
            scheduleAppointment: () => this.scheduleAppointment(),
            manageMobileClinic: () => this.manageMobileClinic(),
            
            // Community Health
            viewCommunityStats: () => this.viewCommunityStats(),
            trackUnderservedCare: () => this.trackUnderservedCare(),
            manageFreeServices: () => this.manageFreeServices(),
            
            // Telemedicine
            startTelemedicine: () => this.startTelemedicine(),
            reviewTelemedicineSessions: () => this.reviewTelemedicineSessions()
        };
    }
    
    // Patient Management Functions
    openPatientList() {
        console.log('👥 Opening Patient List');
        window.open(`${PROVIDER_EMR_CONFIG.EMR_BASE}${PROVIDER_EMR_CONFIG.endpoints.patient_list}`, '_blank');
    }
    
    searchPatients() {
        console.log('🔍 Opening Patient Search');
        window.open(`${PROVIDER_EMR_CONFIG.EMR_BASE}${PROVIDER_EMR_CONFIG.endpoints.patient_list}`, '_blank');
    }
    
    newPatient() {
        console.log('👤 Opening New Patient Registration');
        window.open(`${PROVIDER_EMR_CONFIG.EMR_BASE}${PROVIDER_EMR_CONFIG.endpoints.new_patient}`, '_blank');
    }
    
    openPatientChart(patientId = null) {
        console.log('📋 Opening Patient Chart');
        let url = `${PROVIDER_EMR_CONFIG.EMR_BASE}${PROVIDER_EMR_CONFIG.endpoints.patient_summary}`;
        if (patientId) {
            url += `?pid=${patientId}`;
        }
        window.open(url, '_blank');
    }
    
    // Clinical Documentation Functions
    openSOAPNotes() {
        console.log('📝 Opening SOAP Notes');
        window.open(`${PROVIDER_EMR_CONFIG.EMR_BASE}${PROVIDER_EMR_CONFIG.endpoints.clinical_notes}`, '_blank');
    }
    
    openEncounterForms() {
        console.log('📋 Opening Encounter Forms');
        window.open(`${PROVIDER_EMR_CONFIG.EMR_BASE}${PROVIDER_EMR_CONFIG.endpoints.encounter_forms}`, '_blank');
    }
    
    recordVitalSigns() {
        console.log('🌡️ Opening Vital Signs Entry');
        window.open(`${PROVIDER_EMR_CONFIG.EMR_BASE}${PROVIDER_EMR_CONFIG.endpoints.vital_signs}`, '_blank');
    }
    
    updateImmunizations() {
        console.log('💉 Opening Immunization Records');
        window.open(`${PROVIDER_EMR_CONFIG.EMR_BASE}${PROVIDER_EMR_CONFIG.endpoints.immunizations}`, '_blank');
    }
    
    // Orders and Prescriptions
    orderLabs() {
        console.log('🧪 Opening Lab Orders');
        window.open(`${PROVIDER_EMR_CONFIG.EMR_BASE}${PROVIDER_EMR_CONFIG.endpoints.lab_orders}`, '_blank');
    }
    
    prescribeMedication() {
        console.log('💊 Opening Prescription System');
        window.open(`${PROVIDER_EMR_CONFIG.EMR_BASE}${PROVIDER_EMR_CONFIG.endpoints.prescriptions}`, '_blank');
    }
    
    reviewLabResults() {
        console.log('📊 Opening Lab Results Review');
        window.open(`${PROVIDER_EMR_CONFIG.EMR_BASE}${PROVIDER_EMR_CONFIG.endpoints.lab_orders}`, '_blank');
    }
    
    // Scheduling Functions
    openCalendar() {
        console.log('📅 Opening Provider Calendar');
        window.open(`${PROVIDER_EMR_CONFIG.EMR_BASE}${PROVIDER_EMR_CONFIG.endpoints.calendar}`, '_blank');
    }
    
    scheduleAppointment() {
        console.log('🗓️ Opening Appointment Scheduling');
        window.open(`${PROVIDER_EMR_CONFIG.EMR_BASE}/interface/main/calendar/add_edit_event.php`, '_blank');
    }
    
    manageMobileClinic() {
        console.log('🚐 Opening Mobile Clinic Management');
        window.open(`${PROVIDER_EMR_CONFIG.EMR_BASE}${PROVIDER_EMR_CONFIG.endpoints.mobile_clinic_schedule}`, '_blank');
    }
    
    // Community Health Functions
    viewCommunityStats() {
        console.log('🌍 Opening Community Health Statistics');
        window.open(`${PROVIDER_EMR_CONFIG.EMR_BASE}${PROVIDER_EMR_CONFIG.endpoints.community_health}`, '_blank');
    }
    
    trackUnderservedCare() {
        console.log('📊 Opening Underserved Patient Tracking');
        window.open(`${PROVIDER_EMR_CONFIG.EMR_BASE}${PROVIDER_EMR_CONFIG.endpoints.underserved_patients}`, '_blank');
    }
    
    manageFreeServices() {
        console.log('💝 Opening Free Services Management');
        window.open(`${PROVIDER_EMR_CONFIG.EMR_BASE}${PROVIDER_EMR_CONFIG.endpoints.free_services_tracking}`, '_blank');
    }
    
    // Telemedicine Functions
    startTelemedicine() {
        console.log('📹 Starting Telemedicine Session');
        window.open(`${PROVIDER_EMR_CONFIG.EMR_BASE}${PROVIDER_EMR_CONFIG.endpoints.telemedicine_sessions}`, '_blank');
    }
    
    reviewTelemedicineSessions() {
        console.log('📺 Reviewing Telemedicine Sessions');
        window.open(`${PROVIDER_EMR_CONFIG.EMR_BASE}${PROVIDER_EMR_CONFIG.endpoints.telemedicine_sessions}`, '_blank');
    }
    
    // Reports and Analytics
    openReports() {
        console.log('📈 Opening Clinical Reports');
        window.open(`${PROVIDER_EMR_CONFIG.EMR_BASE}${PROVIDER_EMR_CONFIG.endpoints.patient_reports}`, '_blank');
    }
    
    openQualityMeasures() {
        console.log('📊 Opening Quality Measures');
        window.open(`${PROVIDER_EMR_CONFIG.EMR_BASE}${PROVIDER_EMR_CONFIG.endpoints.quality_measures}`, '_blank');
    }
    
    // Dashboard Functions
    async loadProviderDashboard() {
        try {
            console.log('📊 Loading provider dashboard data...');
            
            // Load demo provider data
            this.providerData = {
                name: 'Dr. Sarah Johnson, MD',
                specialty: 'Family Medicine',
                patients_today: 12,
                appointments_remaining: 8,
                urgent_messages: 3,
                lab_results_pending: 5,
                community_patients: 23,
                free_services_this_month: 15
            };
            
            this.displayProviderDashboard();
            
        } catch (error) {
            console.error('❌ Failed to load provider dashboard:', error);
        }
    }
    
    displayProviderDashboard() {
        if (!this.providerData) return;
        
        // Update provider dashboard displays
        const dashboardElements = {
            'provider-name': this.providerData.name,
            'provider-specialty': this.providerData.specialty,
            'patients-today': this.providerData.patients_today,
            'appointments-remaining': this.providerData.appointments_remaining,
            'urgent-messages': this.providerData.urgent_messages,
            'pending-labs': this.providerData.lab_results_pending,
            'community-patients': this.providerData.community_patients,
            'free-services': this.providerData.free_services_this_month
        };
        
        Object.entries(dashboardElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }
    
    async loadCommunityHealthStats() {
        try {
            const response = await fetch(`${PROVIDER_EMR_CONFIG.EMR_BASE}/webqx-api.php?action=community-stats`);
            
            if (response.ok) {
                const stats = await response.json();
                console.log('📊 Community health stats loaded:', stats);
                
                // Update community health displays
                const communityElements = {
                    'total-underserved': stats.underserved_patients,
                    'total-free-services': stats.free_services_provided,
                    'mobile-clinic-visits': stats.mobile_clinic_visits,
                    'telehealth-sessions': stats.telemedicine_consults
                };
                
                Object.entries(communityElements).forEach(([id, value]) => {
                    const element = document.getElementById(id);
                    if (element) {
                        element.textContent = value.toLocaleString();
                    }
                });
            }
        } catch (error) {
            console.error('⚠️ Could not load community health stats:', error);
        }
    }
}

// Initialize Provider Portal
document.addEventListener('DOMContentLoaded', function() {
    console.log('👨‍⚕️ WebQX Provider Portal - EMR Integration loaded');
    
    // Initialize provider portal
    window.providerPortal = new WebQXProviderPortal();
    
    // Update page branding
    document.title = 'WebQX EMR - Provider Portal';
    
    // Make clinical API available globally for onclick events
    window.openPatientList = () => window.providerPortal.openPatientList();
    window.openSOAPNotes = () => window.providerPortal.openSOAPNotes();
    window.orderLabs = () => window.providerPortal.orderLabs();
    window.prescribeMedication = () => window.providerPortal.prescribeMedication();
    window.openCalendar = () => window.providerPortal.openCalendar();
    window.viewCommunityStats = () => window.providerPortal.viewCommunityStats();
    window.startTelemedicine = () => window.providerPortal.startTelemedicine();
    window.manageMobileClinic = () => window.providerPortal.manageMobileClinic();
    
    console.log('✅ Provider Portal connected to EMR server');
});

// Make available globally
window.PROVIDER_EMR_CONFIG = PROVIDER_EMR_CONFIG;