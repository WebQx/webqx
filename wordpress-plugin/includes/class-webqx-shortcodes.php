<?php
/**
 * WebQX Shortcodes Class
 *
 * @package WebQX_Integration
 * @since 1.0.0
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

/**
 * WebQX Shortcodes Class
 */
class WebQX_Shortcodes {
    
    /**
     * Initialize shortcodes
     */
    public static function init() {
        // Register shortcodes
        add_shortcode('webqx_module', array(__CLASS__, 'module_shortcode'));
        add_shortcode('webqx_patient_portal', array(__CLASS__, 'patient_portal_shortcode'));
        add_shortcode('webqx_provider_panel', array(__CLASS__, 'provider_panel_shortcode'));
        add_shortcode('webqx_appointment_booking', array(__CLASS__, 'appointment_booking_shortcode'));
        add_shortcode('webqx_medical_records', array(__CLASS__, 'medical_records_shortcode'));
        add_shortcode('webqx_secure_messaging', array(__CLASS__, 'secure_messaging_shortcode'));
        add_shortcode('webqx_prescriptions', array(__CLASS__, 'prescriptions_shortcode'));
        add_shortcode('webqx_ehr_dashboard', array(__CLASS__, 'ehr_dashboard_shortcode'));
        add_shortcode('webqx_clinical_alerts', array(__CLASS__, 'clinical_alerts_shortcode'));
        add_shortcode('webqx_voice_transcription', array(__CLASS__, 'voice_transcription_shortcode'));
        add_shortcode('webqx_pacs_viewer', array(__CLASS__, 'pacs_viewer_shortcode'));
        add_shortcode('webqx_fhir_tester', array(__CLASS__, 'fhir_tester_shortcode'));
    }
    
    /**
     * Generic WebQX module shortcode
     * Usage: [webqx_module type="patient-portal" id="123"]
     */
    public static function module_shortcode($atts) {
        $atts = shortcode_atts(array(
            'type' => '',
            'id' => '',
            'class' => '',
            'style' => '',
        ), $atts, 'webqx_module');
        
        if (empty($atts['type'])) {
            return '<div class="webqx-error">' . __('WebQX module type is required.', 'webqx-integration') . '</div>';
        }
        
        return webqx_display_module($atts['type'], $atts['id'], $atts);
    }
    
    /**
     * Patient Portal shortcode
     * Usage: [webqx_patient_portal]
     */
    public static function patient_portal_shortcode($atts) {
        $atts = shortcode_atts(array(
            'view' => 'dashboard',
            'user_id' => '',
        ), $atts, 'webqx_patient_portal');
        
        if (!is_user_logged_in() && empty($atts['user_id'])) {
            return self::login_required_message();
        }
        
        $user_id = !empty($atts['user_id']) ? $atts['user_id'] : get_current_user_id();
        
        ob_start();
        ?>
        <div class="webqx-patient-portal" data-user-id="<?php echo esc_attr($user_id); ?>">
            <div class="webqx-portal-header">
                <h3><?php _e('Patient Portal', 'webqx-integration'); ?></h3>
                <div class="webqx-portal-nav">
                    <button class="webqx-nav-btn active" data-view="dashboard"><?php _e('Dashboard', 'webqx-integration'); ?></button>
                    <button class="webqx-nav-btn" data-view="appointments"><?php _e('Appointments', 'webqx-integration'); ?></button>
                    <button class="webqx-nav-btn" data-view="records"><?php _e('Medical Records', 'webqx-integration'); ?></button>
                    <button class="webqx-nav-btn" data-view="messages"><?php _e('Messages', 'webqx-integration'); ?></button>
                </div>
            </div>
            
            <div class="webqx-portal-content">
                <div id="webqx-portal-loading" class="webqx-loading">
                    <?php _e('Loading patient data...', 'webqx-integration'); ?>
                </div>
                <div id="webqx-portal-data" class="webqx-portal-data" style="display: none;"></div>
                <div id="webqx-portal-error" class="webqx-error" style="display: none;"></div>
            </div>
        </div>
        
        <script>
        jQuery(document).ready(function($) {
            webqxLoadPatientPortal('<?php echo esc_js($atts['view']); ?>');
        });
        </script>
        <?php
        return ob_get_clean();
    }
    
    /**
     * Provider Panel shortcode
     * Usage: [webqx_provider_panel]
     */
    public static function provider_panel_shortcode($atts) {
        $atts = shortcode_atts(array(
            'view' => 'dashboard',
            'provider_id' => '',
        ), $atts, 'webqx_provider_panel');
        
        if (!current_user_can('edit_posts')) {
            return '<div class="webqx-error">' . __('Access denied. Provider privileges required.', 'webqx-integration') . '</div>';
        }
        
        ob_start();
        ?>
        <div class="webqx-provider-panel">
            <div class="webqx-panel-header">
                <h3><?php _e('Provider Panel', 'webqx-integration'); ?></h3>
                <div class="webqx-panel-nav">
                    <button class="webqx-nav-btn active" data-view="dashboard"><?php _e('Dashboard', 'webqx-integration'); ?></button>
                    <button class="webqx-nav-btn" data-view="patients"><?php _e('Patients', 'webqx-integration'); ?></button>
                    <button class="webqx-nav-btn" data-view="appointments"><?php _e('Appointments', 'webqx-integration'); ?></button>
                    <button class="webqx-nav-btn" data-view="ehr"><?php _e('EHR', 'webqx-integration'); ?></button>
                </div>
            </div>
            
            <div class="webqx-panel-content">
                <div id="webqx-panel-loading" class="webqx-loading">
                    <?php _e('Loading provider data...', 'webqx-integration'); ?>
                </div>
                <div id="webqx-panel-data" class="webqx-panel-data" style="display: none;"></div>
            </div>
        </div>
        
        <script>
        jQuery(document).ready(function($) {
            webqxLoadProviderPanel('<?php echo esc_js($atts['view']); ?>');
        });
        </script>
        <?php
        return ob_get_clean();
    }
    
    /**
     * Appointment Booking shortcode
     * Usage: [webqx_appointment_booking]
     */
    public static function appointment_booking_shortcode($atts) {
        $atts = shortcode_atts(array(
            'provider_id' => '',
            'specialty' => '',
        ), $atts, 'webqx_appointment_booking');
        
        ob_start();
        ?>
        <div class="webqx-appointment-booking" data-provider="<?php echo esc_attr($atts['provider_id']); ?>" data-specialty="<?php echo esc_attr($atts['specialty']); ?>">
            <h4><?php _e('Schedule an Appointment', 'webqx-integration'); ?></h4>
            
            <div class="webqx-booking-form">
                <div class="webqx-form-group">
                    <label for="webqx-appointment-type"><?php _e('Appointment Type:', 'webqx-integration'); ?></label>
                    <select id="webqx-appointment-type" class="webqx-form-control">
                        <option value=""><?php _e('Select appointment type', 'webqx-integration'); ?></option>
                        <option value="consultation"><?php _e('Consultation', 'webqx-integration'); ?></option>
                        <option value="follow-up"><?php _e('Follow-up', 'webqx-integration'); ?></option>
                        <option value="routine"><?php _e('Routine Check-up', 'webqx-integration'); ?></option>
                        <option value="emergency"><?php _e('Urgent Care', 'webqx-integration'); ?></option>
                    </select>
                </div>
                
                <div class="webqx-form-group">
                    <label for="webqx-appointment-date"><?php _e('Preferred Date:', 'webqx-integration'); ?></label>
                    <input type="date" id="webqx-appointment-date" class="webqx-form-control" min="<?php echo date('Y-m-d'); ?>">
                </div>
                
                <div class="webqx-form-group">
                    <label for="webqx-appointment-time"><?php _e('Preferred Time:', 'webqx-integration'); ?></label>
                    <select id="webqx-appointment-time" class="webqx-form-control">
                        <option value=""><?php _e('Select time slot', 'webqx-integration'); ?></option>
                    </select>
                </div>
                
                <div class="webqx-form-group">
                    <label for="webqx-appointment-notes"><?php _e('Notes (optional):', 'webqx-integration'); ?></label>
                    <textarea id="webqx-appointment-notes" class="webqx-form-control" rows="3" placeholder="<?php _e('Reason for visit or additional information', 'webqx-integration'); ?>"></textarea>
                </div>
                
                <button id="webqx-book-appointment" class="webqx-btn webqx-btn-primary">
                    <?php _e('Book Appointment', 'webqx-integration'); ?>
                </button>
            </div>
            
            <div id="webqx-booking-result" class="webqx-booking-result" style="display: none;"></div>
        </div>
        
        <script>
        jQuery(document).ready(function($) {
            webqxInitAppointmentBooking();
        });
        </script>
        <?php
        return ob_get_clean();
    }
    
    /**
     * Medical Records shortcode
     * Usage: [webqx_medical_records]
     */
    public static function medical_records_shortcode($atts) {
        $atts = shortcode_atts(array(
            'patient_id' => '',
            'type' => 'all',
        ), $atts, 'webqx_medical_records');
        
        if (!is_user_logged_in()) {
            return self::login_required_message();
        }
        
        ob_start();
        ?>
        <div class="webqx-medical-records">
            <h4><?php _e('Medical Records', 'webqx-integration'); ?></h4>
            
            <div class="webqx-records-filter">
                <select id="webqx-records-type" class="webqx-form-control">
                    <option value="all"><?php _e('All Records', 'webqx-integration'); ?></option>
                    <option value="lab-results"><?php _e('Lab Results', 'webqx-integration'); ?></option>
                    <option value="imaging"><?php _e('Imaging Studies', 'webqx-integration'); ?></option>
                    <option value="medications"><?php _e('Medications', 'webqx-integration'); ?></option>
                    <option value="visits"><?php _e('Visit Notes', 'webqx-integration'); ?></option>
                </select>
            </div>
            
            <div id="webqx-records-content" class="webqx-records-content">
                <div class="webqx-loading"><?php _e('Loading medical records...', 'webqx-integration'); ?></div>
            </div>
        </div>
        
        <script>
        jQuery(document).ready(function($) {
            webqxLoadMedicalRecords('<?php echo esc_js($atts['type']); ?>');
        });
        </script>
        <?php
        return ob_get_clean();
    }
    
    /**
     * Secure Messaging shortcode
     * Usage: [webqx_secure_messaging]
     */
    public static function secure_messaging_shortcode($atts) {
        $atts = shortcode_atts(array(
            'thread_id' => '',
        ), $atts, 'webqx_secure_messaging');
        
        if (!is_user_logged_in()) {
            return self::login_required_message();
        }
        
        ob_start();
        ?>
        <div class="webqx-secure-messaging">
            <h4><?php _e('Secure Messages', 'webqx-integration'); ?></h4>
            
            <div class="webqx-message-interface">
                <div id="webqx-message-threads" class="webqx-message-threads">
                    <div class="webqx-loading"><?php _e('Loading messages...', 'webqx-integration'); ?></div>
                </div>
                
                <div id="webqx-message-composer" class="webqx-message-composer" style="display: none;">
                    <textarea id="webqx-new-message" placeholder="<?php _e('Type your message...', 'webqx-integration'); ?>"></textarea>
                    <button id="webqx-send-message" class="webqx-btn webqx-btn-primary">
                        <?php _e('Send Message', 'webqx-integration'); ?>
                    </button>
                </div>
            </div>
        </div>
        
        <script>
        jQuery(document).ready(function($) {
            webqxLoadSecureMessaging();
        });
        </script>
        <?php
        return ob_get_clean();
    }
    
    /**
     * Prescriptions shortcode
     * Usage: [webqx_prescriptions]
     */
    public static function prescriptions_shortcode($atts) {
        $atts = shortcode_atts(array(
            'status' => 'active',
        ), $atts, 'webqx_prescriptions');
        
        if (!is_user_logged_in()) {
            return self::login_required_message();
        }
        
        ob_start();
        ?>
        <div class="webqx-prescriptions">
            <h4><?php _e('Prescriptions', 'webqx-integration'); ?></h4>
            
            <div class="webqx-prescription-tabs">
                <button class="webqx-tab-btn active" data-status="active"><?php _e('Active', 'webqx-integration'); ?></button>
                <button class="webqx-tab-btn" data-status="history"><?php _e('History', 'webqx-integration'); ?></button>
            </div>
            
            <div id="webqx-prescription-list" class="webqx-prescription-list">
                <div class="webqx-loading"><?php _e('Loading prescriptions...', 'webqx-integration'); ?></div>
            </div>
        </div>
        
        <script>
        jQuery(document).ready(function($) {
            webqxLoadPrescriptions('<?php echo esc_js($atts['status']); ?>');
        });
        </script>
        <?php
        return ob_get_clean();
    }
    
    /**
     * EHR Dashboard shortcode
     * Usage: [webqx_ehr_dashboard]
     */
    public static function ehr_dashboard_shortcode($atts) {
        if (!current_user_can('edit_posts')) {
            return '<div class="webqx-error">' . __('Access denied. Provider privileges required.', 'webqx-integration') . '</div>';
        }
        
        ob_start();
        ?>
        <div class="webqx-ehr-dashboard">
            <h4><?php _e('EHR Dashboard', 'webqx-integration'); ?></h4>
            
            <div class="webqx-ehr-stats">
                <div class="webqx-stat-card">
                    <h5><?php _e('Today\'s Patients', 'webqx-integration'); ?></h5>
                    <span id="webqx-today-patients" class="webqx-stat-number">--</span>
                </div>
                <div class="webqx-stat-card">
                    <h5><?php _e('Pending Notes', 'webqx-integration'); ?></h5>
                    <span id="webqx-pending-notes" class="webqx-stat-number">--</span>
                </div>
                <div class="webqx-stat-card">
                    <h5><?php _e('System Status', 'webqx-integration'); ?></h5>
                    <span id="webqx-system-status" class="webqx-stat-status">--</span>
                </div>
            </div>
            
            <div id="webqx-ehr-content" class="webqx-ehr-content">
                <div class="webqx-loading"><?php _e('Loading EHR data...', 'webqx-integration'); ?></div>
            </div>
        </div>
        
        <script>
        jQuery(document).ready(function($) {
            webqxLoadEHRDashboard();
        });
        </script>
        <?php
        return ob_get_clean();
    }
    
    /**
     * Clinical Alerts shortcode
     * Usage: [webqx_clinical_alerts]
     */
    public static function clinical_alerts_shortcode($atts) {
        if (!current_user_can('edit_posts')) {
            return '<div class="webqx-error">' . __('Access denied. Provider privileges required.', 'webqx-integration') . '</div>';
        }
        
        ob_start();
        ?>
        <div class="webqx-clinical-alerts">
            <h4><?php _e('Clinical Alerts', 'webqx-integration'); ?></h4>
            
            <div id="webqx-alerts-list" class="webqx-alerts-list">
                <div class="webqx-loading"><?php _e('Loading clinical alerts...', 'webqx-integration'); ?></div>
            </div>
        </div>
        
        <script>
        jQuery(document).ready(function($) {
            webqxLoadClinicalAlerts();
        });
        </script>
        <?php
        return ob_get_clean();
    }
    
    /**
     * Voice Transcription shortcode
     * Usage: [webqx_voice_transcription]
     */
    public static function voice_transcription_shortcode($atts) {
        if (!current_user_can('edit_posts')) {
            return '<div class="webqx-error">' . __('Access denied. Provider privileges required.', 'webqx-integration') . '</div>';
        }
        
        ob_start();
        ?>
        <div class="webqx-voice-transcription">
            <h4><?php _e('Voice Transcription', 'webqx-integration'); ?></h4>
            
            <div class="webqx-transcription-controls">
                <button id="webqx-start-recording" class="webqx-btn webqx-btn-primary">
                    <?php _e('Start Recording', 'webqx-integration'); ?>
                </button>
                <button id="webqx-stop-recording" class="webqx-btn webqx-btn-secondary" disabled>
                    <?php _e('Stop Recording', 'webqx-integration'); ?>
                </button>
                <button id="webqx-clear-transcription" class="webqx-btn webqx-btn-outline">
                    <?php _e('Clear', 'webqx-integration'); ?>
                </button>
            </div>
            
            <div id="webqx-transcription-output" class="webqx-transcription-output">
                <textarea id="webqx-transcription-text" placeholder="<?php _e('Transcribed text will appear here...', 'webqx-integration'); ?>"></textarea>
            </div>
            
            <div class="webqx-transcription-actions">
                <button id="webqx-save-transcription" class="webqx-btn webqx-btn-primary">
                    <?php _e('Save to EHR', 'webqx-integration'); ?>
                </button>
            </div>
        </div>
        
        <script>
        jQuery(document).ready(function($) {
            webqxInitVoiceTranscription();
        });
        </script>
        <?php
        return ob_get_clean();
    }
    
    /**
     * PACS Viewer shortcode
     * Usage: [webqx_pacs_viewer study_id="123"]
     */
    public static function pacs_viewer_shortcode($atts) {
        $atts = shortcode_atts(array(
            'study_id' => '',
            'patient_id' => '',
        ), $atts, 'webqx_pacs_viewer');
        
        if (!current_user_can('edit_posts') && !is_user_logged_in()) {
            return self::login_required_message();
        }
        
        ob_start();
        ?>
        <div class="webqx-pacs-viewer" data-study-id="<?php echo esc_attr($atts['study_id']); ?>">
            <h4><?php _e('Medical Imaging Viewer', 'webqx-integration'); ?></h4>
            
            <div id="webqx-pacs-content" class="webqx-pacs-content">
                <div class="webqx-loading"><?php _e('Loading imaging studies...', 'webqx-integration'); ?></div>
            </div>
        </div>
        
        <script>
        jQuery(document).ready(function($) {
            webqxLoadPACSViewer('<?php echo esc_js($atts['study_id']); ?>');
        });
        </script>
        <?php
        return ob_get_clean();
    }
    
    /**
     * FHIR Tester shortcode
     * Usage: [webqx_fhir_tester]
     */
    public static function fhir_tester_shortcode($atts) {
        if (!current_user_can('manage_options')) {
            return '<div class="webqx-error">' . __('Access denied. Administrator privileges required.', 'webqx-integration') . '</div>';
        }
        
        ob_start();
        ?>
        <div class="webqx-fhir-tester">
            <h4><?php _e('FHIR R4 API Tester', 'webqx-integration'); ?></h4>
            
            <div class="webqx-fhir-form">
                <div class="webqx-form-group">
                    <label for="webqx-fhir-resource"><?php _e('Resource Type:', 'webqx-integration'); ?></label>
                    <select id="webqx-fhir-resource" class="webqx-form-control">
                        <option value="Patient">Patient</option>
                        <option value="Observation">Observation</option>
                        <option value="Appointment">Appointment</option>
                        <option value="Practitioner">Practitioner</option>
                        <option value="Organization">Organization</option>
                    </select>
                </div>
                
                <div class="webqx-form-group">
                    <label for="webqx-fhir-method"><?php _e('HTTP Method:', 'webqx-integration'); ?></label>
                    <select id="webqx-fhir-method" class="webqx-form-control">
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="DELETE">DELETE</option>
                    </select>
                </div>
                
                <div class="webqx-form-group">
                    <label for="webqx-fhir-id"><?php _e('Resource ID (optional):', 'webqx-integration'); ?></label>
                    <input type="text" id="webqx-fhir-id" class="webqx-form-control" placeholder="e.g., patient-123">
                </div>
                
                <button id="webqx-test-fhir" class="webqx-btn webqx-btn-primary">
                    <?php _e('Test FHIR API', 'webqx-integration'); ?>
                </button>
            </div>
            
            <div id="webqx-fhir-response" class="webqx-fhir-response" style="display: none;">
                <h5><?php _e('API Response:', 'webqx-integration'); ?></h5>
                <pre id="webqx-fhir-response-content"></pre>
            </div>
        </div>
        
        <script>
        jQuery(document).ready(function($) {
            webqxInitFHIRTester();
        });
        </script>
        <?php
        return ob_get_clean();
    }
    
    /**
     * Login required message
     */
    private static function login_required_message() {
        return '<div class="webqx-login-required">
            <p>' . __('Please log in to access this feature.', 'webqx-integration') . '</p>
            <a href="' . esc_url(wp_login_url(get_permalink())) . '" class="webqx-btn webqx-btn-primary">' . __('Login', 'webqx-integration') . '</a>
        </div>';
    }
}
?>