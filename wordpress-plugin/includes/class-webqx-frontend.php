<?php
/**
 * WebQX Frontend Interface
 * 
 * @package WebQX_Healthcare
 * @author WebQX Health
 * @license GPL v2 or later
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

/**
 * WebQX Frontend Class
 * 
 * Handles frontend functionality and shortcodes
 */
class WebQX_Frontend {

    /**
     * Class instance
     * 
     * @var WebQX_Frontend
     */
    private static $instance = null;

    /**
     * Core instance
     * 
     * @var WebQX_Core
     */
    private $core;

    /**
     * API instance
     * 
     * @var WebQX_API
     */
    private $api;

    /**
     * Get instance
     * 
     * @return WebQX_Frontend
     */
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Constructor
     */
    private function __construct() {
        $this->core = WebQX_Core::get_instance();
        $this->api = WebQX_API::get_instance();
        $this->init_hooks();
    }

    /**
     * Initialize hooks
     */
    private function init_hooks() {
        add_action('init', array($this, 'init'));
        add_action('wp_ajax_webqx_frontend_action', array($this, 'handle_frontend_action'));
        add_action('wp_ajax_nopriv_webqx_frontend_action', array($this, 'handle_frontend_action'));
        add_filter('query_vars', array($this, 'add_query_vars'));
        add_action('template_redirect', array($this, 'handle_webqx_endpoints'));
    }

    /**
     * Initialize frontend functionality
     */
    public function init() {
        $this->register_shortcodes();
        $this->add_rewrite_rules();
    }

    /**
     * Register shortcodes
     */
    private function register_shortcodes() {
        add_shortcode('webqx_patient_portal', array($this, 'shortcode_patient_portal'));
        add_shortcode('webqx_provider_portal', array($this, 'shortcode_provider_portal'));
        add_shortcode('webqx_appointment_booking', array($this, 'shortcode_appointment_booking'));
        add_shortcode('webqx_provider_directory', array($this, 'shortcode_provider_directory'));
        add_shortcode('webqx_health_dashboard', array($this, 'shortcode_health_dashboard'));
    }

    /**
     * Add rewrite rules for WebQX endpoints
     */
    private function add_rewrite_rules() {
        add_rewrite_rule(
            '^webqx/patient-portal/?([^/]*)/?',
            'index.php?webqx_action=patient_portal&webqx_subaction=$matches[1]',
            'top'
        );
        
        add_rewrite_rule(
            '^webqx/provider-portal/?([^/]*)/?',
            'index.php?webqx_action=provider_portal&webqx_subaction=$matches[1]',
            'top'
        );
        
        add_rewrite_rule(
            '^webqx/api/([^/]+)/?([^/]*)/?',
            'index.php?webqx_action=api&webqx_endpoint=$matches[1]&webqx_params=$matches[2]',
            'top'
        );
    }

    /**
     * Add query vars
     * 
     * @param array $vars
     * @return array
     */
    public function add_query_vars($vars) {
        $vars[] = 'webqx_action';
        $vars[] = 'webqx_subaction';
        $vars[] = 'webqx_endpoint';
        $vars[] = 'webqx_params';
        return $vars;
    }

    /**
     * Handle WebQX endpoints
     */
    public function handle_webqx_endpoints() {
        $action = get_query_var('webqx_action');
        
        if (empty($action)) {
            return;
        }
        
        switch ($action) {
            case 'patient_portal':
                $this->handle_patient_portal();
                break;
            case 'provider_portal':
                $this->handle_provider_portal();
                break;
            case 'api':
                $this->handle_api_endpoint();
                break;
            default:
                wp_die(__('Invalid WebQX action', 'webqx-healthcare'), 404);
        }
    }

    /**
     * Patient Portal shortcode
     * 
     * @param array $atts
     * @return string
     */
    public function shortcode_patient_portal($atts) {
        if (!$this->core->get_option('patient_portal_enabled')) {
            return '<p>' . __('Patient portal is currently disabled.', 'webqx-healthcare') . '</p>';
        }
        
        $atts = shortcode_atts(array(
            'view' => 'dashboard',
            'user_id' => get_current_user_id(),
        ), $atts, 'webqx_patient_portal');
        
        if (!is_user_logged_in()) {
            return '<p>' . __('Please log in to access the patient portal.', 'webqx-healthcare') . '</p>';
        }
        
        ob_start();
        include WEBQX_PLUGIN_DIR . 'public/partials/patient-portal.php';
        return ob_get_clean();
    }

    /**
     * Provider Portal shortcode
     * 
     * @param array $atts
     * @return string
     */
    public function shortcode_provider_portal($atts) {
        if (!$this->core->get_option('provider_portal_enabled')) {
            return '<p>' . __('Provider portal is currently disabled.', 'webqx-healthcare') . '</p>';
        }
        
        $atts = shortcode_atts(array(
            'view' => 'dashboard',
            'provider_id' => get_current_user_id(),
        ), $atts, 'webqx_provider_portal');
        
        if (!is_user_logged_in() || !current_user_can('read_webqx_patient')) {
            return '<p>' . __('Please log in as a healthcare provider to access this portal.', 'webqx-healthcare') . '</p>';
        }
        
        ob_start();
        include WEBQX_PLUGIN_DIR . 'public/partials/provider-portal.php';
        return ob_get_clean();
    }

    /**
     * Appointment Booking shortcode
     * 
     * @param array $atts
     * @return string
     */
    public function shortcode_appointment_booking($atts) {
        $atts = shortcode_atts(array(
            'provider_id' => '',
            'specialty' => '',
            'location' => '',
        ), $atts, 'webqx_appointment_booking');
        
        ob_start();
        include WEBQX_PLUGIN_DIR . 'public/partials/appointment-booking.php';
        return ob_get_clean();
    }

    /**
     * Provider Directory shortcode
     * 
     * @param array $atts
     * @return string
     */
    public function shortcode_provider_directory($atts) {
        $atts = shortcode_atts(array(
            'specialty' => '',
            'location' => '',
            'per_page' => 10,
            'search' => true,
            'filters' => true,
        ), $atts, 'webqx_provider_directory');
        
        ob_start();
        include WEBQX_PLUGIN_DIR . 'public/partials/provider-directory.php';
        return ob_get_clean();
    }

    /**
     * Health Dashboard shortcode
     * 
     * @param array $atts
     * @return string
     */
    public function shortcode_health_dashboard($atts) {
        if (!is_user_logged_in()) {
            return '<p>' . __('Please log in to view your health dashboard.', 'webqx-healthcare') . '</p>';
        }
        
        $atts = shortcode_atts(array(
            'user_id' => get_current_user_id(),
            'widgets' => 'vitals,appointments,medications,lab_results',
        ), $atts, 'webqx_health_dashboard');
        
        ob_start();
        include WEBQX_PLUGIN_DIR . 'public/partials/health-dashboard.php';
        return ob_get_clean();
    }

    /**
     * Handle patient portal requests
     */
    private function handle_patient_portal() {
        if (!is_user_logged_in()) {
            wp_redirect(wp_login_url(home_url('/webqx/patient-portal/')));
            exit;
        }
        
        $subaction = get_query_var('webqx_subaction');
        
        // Load patient portal template
        $template = locate_template('webqx/patient-portal.php');
        if (!$template) {
            $template = WEBQX_PLUGIN_DIR . 'public/templates/patient-portal.php';
        }
        
        if (file_exists($template)) {
            include $template;
            exit;
        }
        
        wp_die(__('Patient portal template not found', 'webqx-healthcare'), 404);
    }

    /**
     * Handle provider portal requests
     */
    private function handle_provider_portal() {
        if (!is_user_logged_in() || !current_user_can('read_webqx_patient')) {
            wp_redirect(wp_login_url(home_url('/webqx/provider-portal/')));
            exit;
        }
        
        $subaction = get_query_var('webqx_subaction');
        
        // Load provider portal template
        $template = locate_template('webqx/provider-portal.php');
        if (!$template) {
            $template = WEBQX_PLUGIN_DIR . 'public/templates/provider-portal.php';
        }
        
        if (file_exists($template)) {
            include $template;
            exit;
        }
        
        wp_die(__('Provider portal template not found', 'webqx-healthcare'), 404);
    }

    /**
     * Handle API endpoint requests
     */
    private function handle_api_endpoint() {
        $endpoint = get_query_var('webqx_endpoint');
        $params = get_query_var('webqx_params');
        
        if (empty($endpoint)) {
            wp_die(__('API endpoint is required', 'webqx-healthcare'), 400);
        }
        
        // Set JSON headers
        header('Content-Type: application/json');
        
        try {
            $response = $this->api->make_request("/api/{$endpoint}");
            
            if (is_wp_error($response)) {
                http_response_code(500);
                echo json_encode(array(
                    'error' => true,
                    'message' => $response->get_error_message(),
                ));
            } else {
                echo json_encode($response);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(array(
                'error' => true,
                'message' => 'Internal server error',
            ));
        }
        
        exit;
    }

    /**
     * Handle frontend AJAX actions
     */
    public function handle_frontend_action() {
        if (!wp_verify_nonce($_POST['nonce'], 'webqx_frontend_nonce')) {
            wp_die(__('Security check failed', 'webqx-healthcare'));
        }
        
        $action = sanitize_text_field($_POST['frontend_action'] ?? '');
        
        switch ($action) {
            case 'get_appointments':
                $this->ajax_get_appointments();
                break;
            case 'book_appointment':
                $this->ajax_book_appointment();
                break;
            case 'get_providers':
                $this->ajax_get_providers();
                break;
            case 'get_patient_data':
                $this->ajax_get_patient_data();
                break;
            default:
                wp_send_json_error(__('Invalid action', 'webqx-healthcare'));
        }
    }

    /**
     * AJAX: Get appointments
     */
    private function ajax_get_appointments() {
        if (!is_user_logged_in()) {
            wp_send_json_error(__('User not logged in', 'webqx-healthcare'));
        }
        
        $user_id = get_current_user_id();
        $filters = array('patient_id' => $user_id);
        
        $response = $this->api->get_appointments($filters);
        
        if (is_wp_error($response)) {
            wp_send_json_error($response->get_error_message());
        }
        
        wp_send_json_success($response);
    }

    /**
     * AJAX: Book appointment
     */
    private function ajax_book_appointment() {
        if (!is_user_logged_in()) {
            wp_send_json_error(__('User not logged in', 'webqx-healthcare'));
        }
        
        $appointment_data = array(
            'patient_id' => get_current_user_id(),
            'provider_id' => sanitize_text_field($_POST['provider_id'] ?? ''),
            'date' => sanitize_text_field($_POST['date'] ?? ''),
            'time' => sanitize_text_field($_POST['time'] ?? ''),
            'reason' => sanitize_textarea_field($_POST['reason'] ?? ''),
        );
        
        // Validate required fields
        if (empty($appointment_data['provider_id']) || empty($appointment_data['date']) || empty($appointment_data['time'])) {
            wp_send_json_error(__('Missing required appointment information', 'webqx-healthcare'));
        }
        
        $response = $this->api->create_appointment($appointment_data);
        
        if (is_wp_error($response)) {
            wp_send_json_error($response->get_error_message());
        }
        
        wp_send_json_success($response);
    }

    /**
     * AJAX: Get providers
     */
    private function ajax_get_providers() {
        $filters = array();
        
        if (!empty($_POST['specialty'])) {
            $filters['specialty'] = sanitize_text_field($_POST['specialty']);
        }
        
        if (!empty($_POST['location'])) {
            $filters['location'] = sanitize_text_field($_POST['location']);
        }
        
        $response = $this->api->get_providers($filters);
        
        if (is_wp_error($response)) {
            wp_send_json_error($response->get_error_message());
        }
        
        wp_send_json_success($response);
    }

    /**
     * AJAX: Get patient data
     */
    private function ajax_get_patient_data() {
        if (!is_user_logged_in()) {
            wp_send_json_error(__('User not logged in', 'webqx-healthcare'));
        }
        
        $user_id = get_current_user_id();
        $response = $this->api->get_patient($user_id);
        
        if (is_wp_error($response)) {
            wp_send_json_error($response->get_error_message());
        }
        
        // Sanitize data if HIPAA mode is enabled
        if ($this->core->is_hipaa_mode_enabled()) {
            $response = $this->core->sanitize_healthcare_data($response);
        }
        
        wp_send_json_success($response);
    }
}