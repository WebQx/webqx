<?php
/**
 * WebQX Core Functionality
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
 * WebQX Core Class
 * 
 * Handles core plugin functionality and coordination between components
 */
class WebQX_Core {

    /**
     * Class instance
     * 
     * @var WebQX_Core
     */
    private static $instance = null;

    /**
     * Plugin options
     * 
     * @var array
     */
    private $options = array();

    /**
     * Get instance
     * 
     * @return WebQX_Core
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
        $this->load_options();
        $this->init_hooks();
    }

    /**
     * Load plugin options
     */
    private function load_options() {
        $this->options = array(
            'backend_url' => get_option('webqx_backend_url', 'http://localhost:3000'),
            'api_timeout' => get_option('webqx_api_timeout', 30),
            'enable_logging' => get_option('webqx_enable_logging', true),
            'log_level' => get_option('webqx_log_level', 'info'),
            'enable_hipaa_mode' => get_option('webqx_enable_hipaa_mode', true),
            'patient_portal_enabled' => get_option('webqx_patient_portal_enabled', true),
            'provider_portal_enabled' => get_option('webqx_provider_portal_enabled', true),
            'admin_console_enabled' => get_option('webqx_admin_console_enabled', true),
        );
    }

    /**
     * Initialize hooks
     */
    private function init_hooks() {
        add_action('wp_enqueue_scripts', array($this, 'enqueue_frontend_scripts'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_scripts'));
        add_filter('user_has_cap', array($this, 'maybe_grant_webqx_caps'), 10, 3);
    }

    /**
     * Enqueue frontend scripts and styles
     */
    public function enqueue_frontend_scripts() {
        // Only enqueue on pages that need WebQX functionality
        if (!$this->is_webqx_page()) {
            return;
        }

        wp_enqueue_style(
            'webqx-frontend',
            WEBQX_PLUGIN_URL . 'public/css/webqx-frontend.css',
            array(),
            WEBQX_PLUGIN_VERSION
        );

        wp_enqueue_script(
            'webqx-frontend',
            WEBQX_PLUGIN_URL . 'public/js/webqx-frontend.js',
            array('jquery'),
            WEBQX_PLUGIN_VERSION,
            true
        );

        // Localize script for AJAX
        wp_localize_script('webqx-frontend', 'webqx_ajax', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('webqx_frontend_nonce'),
            'backend_url' => $this->get_option('backend_url'),
        ));
    }

    /**
     * Enqueue admin scripts and styles
     */
    public function enqueue_admin_scripts($hook) {
        // Only enqueue on WebQX admin pages
        if (!$this->is_webqx_admin_page($hook)) {
            return;
        }

        wp_enqueue_style(
            'webqx-admin',
            WEBQX_PLUGIN_URL . 'admin/css/webqx-admin.css',
            array(),
            WEBQX_PLUGIN_VERSION
        );

        wp_enqueue_script(
            'webqx-admin',
            WEBQX_PLUGIN_URL . 'admin/js/webqx-admin.js',
            array('jquery', 'wp-util'),
            WEBQX_PLUGIN_VERSION,
            true
        );

        // Localize script for AJAX
        wp_localize_script('webqx-admin', 'webqx_admin_ajax', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('webqx_admin_nonce'),
            'backend_url' => $this->get_option('backend_url'),
        ));
    }

    /**
     * Check if current page needs WebQX functionality
     * 
     * @return bool
     */
    private function is_webqx_page() {
        global $post;
        
        // Check for WebQX shortcodes
        if ($post && has_shortcode($post->post_content, 'webqx_patient_portal')) {
            return true;
        }
        
        if ($post && has_shortcode($post->post_content, 'webqx_provider_portal')) {
            return true;
        }
        
        if ($post && has_shortcode($post->post_content, 'webqx_appointment_booking')) {
            return true;
        }
        
        // Check for WebQX query vars
        if (get_query_var('webqx_action')) {
            return true;
        }
        
        return false;
    }

    /**
     * Check if current admin page is WebQX related
     * 
     * @param string $hook
     * @return bool
     */
    private function is_webqx_admin_page($hook) {
        $webqx_pages = array(
            'toplevel_page_webqx-healthcare',
            'webqx-healthcare_page_webqx-settings',
            'webqx-healthcare_page_webqx-patients',
            'webqx-healthcare_page_webqx-appointments',
            'webqx-healthcare_page_webqx-providers',
        );
        
        return in_array($hook, $webqx_pages, true);
    }

    /**
     * Maybe grant WebQX capabilities to users
     * 
     * @param array $allcaps
     * @param array $caps
     * @param array $args
     * @return array
     */
    public function maybe_grant_webqx_caps($allcaps, $caps, $args) {
        // Grant capabilities based on user roles and WebQX context
        if (isset($args[0]) && strpos($args[0], 'webqx_') === 0) {
            $user_id = $args[1];
            $user = get_userdata($user_id);
            
            if ($user) {
                // Healthcare providers get provider capabilities
                if (in_array('healthcare_provider', $user->roles, true)) {
                    $allcaps['read_webqx_patient'] = true;
                    $allcaps['edit_webqx_patients'] = true;
                    $allcaps['read_webqx_appointment'] = true;
                    $allcaps['edit_webqx_appointments'] = true;
                }
                
                // Patients get limited patient capabilities
                if (in_array('patient', $user->roles, true)) {
                    $allcaps['read_webqx_patient'] = true;
                    $allcaps['edit_own_webqx_patient'] = true;
                    $allcaps['read_webqx_appointment'] = true;
                    $allcaps['edit_own_webqx_appointment'] = true;
                }
            }
        }
        
        return $allcaps;
    }

    /**
     * Get plugin option
     * 
     * @param string $key
     * @param mixed $default
     * @return mixed
     */
    public function get_option($key, $default = null) {
        return isset($this->options[$key]) ? $this->options[$key] : $default;
    }

    /**
     * Set plugin option
     * 
     * @param string $key
     * @param mixed $value
     * @return bool
     */
    public function set_option($key, $value) {
        $this->options[$key] = $value;
        return update_option('webqx_' . $key, $value);
    }

    /**
     * Get all plugin options
     * 
     * @return array
     */
    public function get_options() {
        return $this->options;
    }

    /**
     * Log message
     * 
     * @param string $message
     * @param string $level
     * @param array $context
     */
    public function log($message, $level = 'info', $context = array()) {
        if (!$this->get_option('enable_logging')) {
            return;
        }
        
        $log_level = $this->get_option('log_level', 'info');
        $levels = array('debug' => 0, 'info' => 1, 'warning' => 2, 'error' => 3);
        
        if (!isset($levels[$level]) || !isset($levels[$log_level])) {
            return;
        }
        
        if ($levels[$level] < $levels[$log_level]) {
            return;
        }
        
        // Log to database
        global $wpdb;
        $table_name = $wpdb->prefix . 'webqx_integration_logs';
        
        $wpdb->insert(
            $table_name,
            array(
                'level' => $level,
                'message' => $message,
                'context' => json_encode($context),
                'user_id' => get_current_user_id(),
                'ip_address' => $this->get_client_ip(),
            ),
            array('%s', '%s', '%s', '%d', '%s')
        );
        
        // Also log to PHP error log in debug mode
        if ($level === 'debug' || WP_DEBUG) {
            error_log("[WebQX] [{$level}] {$message}");
        }
    }

    /**
     * Get client IP address
     * 
     * @return string
     */
    private function get_client_ip() {
        $ip_keys = array('HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'HTTP_CLIENT_IP', 'REMOTE_ADDR');
        
        foreach ($ip_keys as $key) {
            if (!empty($_SERVER[$key])) {
                $ip = sanitize_text_field(wp_unslash($_SERVER[$key]));
                // Handle comma-separated IPs (X-Forwarded-For)
                if (strpos($ip, ',') !== false) {
                    $ip = trim(explode(',', $ip)[0]);
                }
                if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                    return $ip;
                }
            }
        }
        
        return '127.0.0.1';
    }

    /**
     * Check if HIPAA mode is enabled
     * 
     * @return bool
     */
    public function is_hipaa_mode_enabled() {
        return $this->get_option('enable_hipaa_mode', true);
    }

    /**
     * Sanitize healthcare data according to HIPAA requirements
     * 
     * @param array $data
     * @return array
     */
    public function sanitize_healthcare_data($data) {
        if (!$this->is_hipaa_mode_enabled()) {
            return $data;
        }
        
        // Remove or redact sensitive information
        $sensitive_fields = array('ssn', 'social_security_number', 'dob', 'date_of_birth');
        
        foreach ($sensitive_fields as $field) {
            if (isset($data[$field])) {
                // Redact instead of removing
                $data[$field] = '***REDACTED***';
            }
        }
        
        return $data;
    }
}