<?php
/**
 * WebQX Admin Interface
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
 * WebQX Admin Class
 * 
 * Handles WordPress admin interface for WebQX
 */
class WebQX_Admin {

    /**
     * Class instance
     * 
     * @var WebQX_Admin
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
     * @return WebQX_Admin
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
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'admin_init'));
        add_action('admin_notices', array($this, 'admin_notices'));
        add_action('wp_ajax_webqx_save_settings', array($this, 'save_settings'));
        add_action('wp_ajax_webqx_test_connection', array($this, 'test_connection'));
    }

    /**
     * Add admin menu
     */
    public function add_admin_menu() {
        // Main menu
        add_menu_page(
            __('WebQX Healthcare', 'webqx-healthcare'),
            __('WebQX Healthcare', 'webqx-healthcare'),
            'manage_webqx',
            'webqx-healthcare',
            array($this, 'admin_page_dashboard'),
            'dashicons-heart',
            30
        );

        // Dashboard
        add_submenu_page(
            'webqx-healthcare',
            __('Dashboard', 'webqx-healthcare'),
            __('Dashboard', 'webqx-healthcare'),
            'manage_webqx',
            'webqx-healthcare',
            array($this, 'admin_page_dashboard')
        );

        // Settings
        add_submenu_page(
            'webqx-healthcare',
            __('Settings', 'webqx-healthcare'),
            __('Settings', 'webqx-healthcare'),
            'manage_webqx',
            'webqx-settings',
            array($this, 'admin_page_settings')
        );

        // Patients
        add_submenu_page(
            'webqx-healthcare',
            __('Patients', 'webqx-healthcare'),
            __('Patients', 'webqx-healthcare'),
            'edit_webqx_patients',
            'webqx-patients',
            array($this, 'admin_page_patients')
        );

        // Appointments
        add_submenu_page(
            'webqx-healthcare',
            __('Appointments', 'webqx-healthcare'),
            __('Appointments', 'webqx-healthcare'),
            'edit_webqx_appointments',
            'webqx-appointments',
            array($this, 'admin_page_appointments')
        );

        // Providers
        add_submenu_page(
            'webqx-healthcare',
            __('Providers', 'webqx-healthcare'),
            __('Providers', 'webqx-healthcare'),
            'edit_webqx_providers',
            'webqx-providers',
            array($this, 'admin_page_providers')
        );
    }

    /**
     * Admin initialization
     */
    public function admin_init() {
        // Register settings
        $this->register_settings();
    }

    /**
     * Register plugin settings
     */
    private function register_settings() {
        // Backend configuration
        register_setting('webqx_backend', 'webqx_backend_url');
        register_setting('webqx_backend', 'webqx_api_timeout');
        
        // Logging settings
        register_setting('webqx_logging', 'webqx_enable_logging');
        register_setting('webqx_logging', 'webqx_log_level');
        
        // Security settings
        register_setting('webqx_security', 'webqx_enable_hipaa_mode');
        register_setting('webqx_security', 'webqx_require_2fa');
        
        // Module settings
        register_setting('webqx_modules', 'webqx_patient_portal_enabled');
        register_setting('webqx_modules', 'webqx_provider_portal_enabled');
        register_setting('webqx_modules', 'webqx_admin_console_enabled');
    }

    /**
     * Display admin notices
     */
    public function admin_notices() {
        // Check if backend is configured and accessible
        $backend_url = $this->core->get_option('backend_url');
        if (empty($backend_url) || $backend_url === 'http://localhost:3000') {
            $this->display_notice(
                __('WebQX Healthcare: Please configure your backend URL in the settings.', 'webqx-healthcare'),
                'warning'
            );
        }
        
        // Check connection status periodically
        $last_check = get_option('webqx_last_connection_check', 0);
        if (time() - $last_check > 300) { // Check every 5 minutes
            $status = $this->api->check_backend_connection();
            update_option('webqx_last_connection_check', time());
            update_option('webqx_backend_connection_status', $status);
            
            if (!$status['connected']) {
                $this->display_notice(
                    __('WebQX Healthcare: Unable to connect to backend server. Please check your configuration.', 'webqx-healthcare'),
                    'error'
                );
            }
        }
    }

    /**
     * Display admin notice
     * 
     * @param string $message
     * @param string $type
     */
    private function display_notice($message, $type = 'info') {
        printf(
            '<div class="notice notice-%s is-dismissible"><p>%s</p></div>',
            esc_attr($type),
            esc_html($message)
        );
    }

    /**
     * Dashboard admin page
     */
    public function admin_page_dashboard() {
        $backend_status = get_option('webqx_backend_connection_status', array('connected' => false));
        
        include WEBQX_PLUGIN_DIR . 'admin/partials/dashboard.php';
    }

    /**
     * Settings admin page
     */
    public function admin_page_settings() {
        $active_tab = isset($_GET['tab']) ? sanitize_text_field($_GET['tab']) : 'backend';
        
        include WEBQX_PLUGIN_DIR . 'admin/partials/settings.php';
    }

    /**
     * Patients admin page
     */
    public function admin_page_patients() {
        include WEBQX_PLUGIN_DIR . 'admin/partials/patients.php';
    }

    /**
     * Appointments admin page
     */
    public function admin_page_appointments() {
        include WEBQX_PLUGIN_DIR . 'admin/partials/appointments.php';
    }

    /**
     * Providers admin page
     */
    public function admin_page_providers() {
        include WEBQX_PLUGIN_DIR . 'admin/partials/providers.php';
    }

    /**
     * Save settings via AJAX
     */
    public function save_settings() {
        if (!wp_verify_nonce($_POST['nonce'], 'webqx_admin_nonce')) {
            wp_die(__('Security check failed', 'webqx-healthcare'));
        }

        if (!current_user_can('manage_webqx')) {
            wp_send_json_error(__('Insufficient permissions', 'webqx-healthcare'));
        }

        $settings = isset($_POST['settings']) ? $_POST['settings'] : array();
        $updated = array();
        $errors = array();

        foreach ($settings as $key => $value) {
            $sanitized_key = sanitize_key($key);
            
            // Validate specific settings
            if ($sanitized_key === 'webqx_backend_url') {
                $value = esc_url_raw($value);
                if (empty($value) || !filter_var($value, FILTER_VALIDATE_URL)) {
                    $errors[] = __('Invalid backend URL', 'webqx-healthcare');
                    continue;
                }
            } elseif ($sanitized_key === 'webqx_api_timeout') {
                $value = absint($value);
                if ($value < 1 || $value > 300) {
                    $errors[] = __('API timeout must be between 1 and 300 seconds', 'webqx-healthcare');
                    continue;
                }
            } elseif ($sanitized_key === 'webqx_log_level') {
                $allowed_levels = array('debug', 'info', 'warning', 'error');
                if (!in_array($value, $allowed_levels, true)) {
                    $errors[] = __('Invalid log level', 'webqx-healthcare');
                    continue;
                }
            } else {
                $value = sanitize_text_field($value);
            }

            if (update_option($sanitized_key, $value)) {
                $updated[] = $sanitized_key;
            }
        }

        if (!empty($errors)) {
            wp_send_json_error(array(
                'message' => __('Some settings could not be saved', 'webqx-healthcare'),
                'errors' => $errors,
            ));
        }

        wp_send_json_success(array(
            'message' => __('Settings saved successfully', 'webqx-healthcare'),
            'updated' => $updated,
        ));
    }

    /**
     * Test backend connection via AJAX
     */
    public function test_connection() {
        if (!wp_verify_nonce($_POST['nonce'], 'webqx_admin_nonce')) {
            wp_die(__('Security check failed', 'webqx-healthcare'));
        }

        if (!current_user_can('manage_webqx')) {
            wp_send_json_error(__('Insufficient permissions', 'webqx-healthcare'));
        }

        $backend_url = isset($_POST['backend_url']) ? esc_url_raw($_POST['backend_url']) : '';
        
        if (empty($backend_url)) {
            wp_send_json_error(__('Backend URL is required', 'webqx-healthcare'));
        }

        // Temporarily set the backend URL for testing
        $original_url = $this->core->get_option('backend_url');
        $this->core->set_option('backend_url', $backend_url);

        // Test the connection
        $status = $this->api->check_backend_connection();

        // Restore original URL
        $this->core->set_option('backend_url', $original_url);

        wp_send_json_success($status);
    }

    /**
     * Get dashboard statistics
     * 
     * @return array
     */
    public function get_dashboard_stats() {
        $stats = array(
            'patients' => 0,
            'appointments' => 0,
            'providers' => 0,
            'recent_activity' => array(),
        );

        // Get patient count
        $patients = wp_count_posts('webqx_patient');
        $stats['patients'] = isset($patients->publish) ? $patients->publish : 0;

        // Get appointment count
        $appointments = wp_count_posts('webqx_appointment');
        $stats['appointments'] = isset($appointments->publish) ? $appointments->publish : 0;

        // Get provider count
        $providers = wp_count_posts('webqx_provider');
        $stats['providers'] = isset($providers->publish) ? $providers->publish : 0;

        // Get recent activity from logs
        global $wpdb;
        $table_name = $wpdb->prefix . 'webqx_integration_logs';
        $recent_logs = $wpdb->get_results(
            "SELECT * FROM {$table_name} ORDER BY timestamp DESC LIMIT 10",
            ARRAY_A
        );

        $stats['recent_activity'] = $recent_logs ?: array();

        return $stats;
    }

    /**
     * Get system information
     * 
     * @return array
     */
    public function get_system_info() {
        return array(
            'wordpress_version' => get_bloginfo('version'),
            'php_version' => PHP_VERSION,
            'plugin_version' => WEBQX_PLUGIN_VERSION,
            'mysql_version' => $this->get_mysql_version(),
            'server_info' => isset($_SERVER['SERVER_SOFTWARE']) ? sanitize_text_field(wp_unslash($_SERVER['SERVER_SOFTWARE'])) : 'Unknown',
            'max_execution_time' => ini_get('max_execution_time'),
            'memory_limit' => ini_get('memory_limit'),
            'upload_max_filesize' => ini_get('upload_max_filesize'),
            'extensions' => array(
                'curl' => extension_loaded('curl'),
                'json' => extension_loaded('json'),
                'openssl' => extension_loaded('openssl'),
                'mbstring' => extension_loaded('mbstring'),
            ),
        );
    }

    /**
     * Get MySQL version
     * 
     * @return string
     */
    private function get_mysql_version() {
        global $wpdb;
        $result = $wpdb->get_var('SELECT VERSION()');
        return $result ?: 'Unknown';
    }
}